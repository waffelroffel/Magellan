import { watch as chokidar } from "chokidar"
import { FSWatcher, createReadStream, writeFileSync, readFileSync } from "fs"
import { join, sep } from "path"
import { v4 as uuid4 } from "uuid"
import { ABCVessel } from "./Proxies/ABCVessel"
import CargoList from "./CargoList"
import {
	ItemType as IT,
	ActionType as AT,
	Medium,
	ResolveOption as RO,
	SHARE_TYPE as ST,
} from "./enums"
import {
	Item,
	NID,
	Privileges,
	Settings,
	StartupFlags,
	PIndexArray,
	LoggerConfig,
} from "./interfaces"
import ProxyInterface from "./ProxyInterface"
import {
	cts,
	ct,
	computehash,
	randint,
	applyFolderIO,
	applyFileIO,
	createRS,
} from "./utils"
import Proxy from "./Proxies/Proxy"
import VesselServer from "./VesselServer"

const TABLE_END = "indextable.json"
const SETTINGS_END = "settings.json"
const DEFAULT_LOGGER: LoggerConfig = {
	init: true,
	ready: true,
	update: true,
	send: true,
	local: true,
	remote: true,
	error: true,
	online: true,
	vanish: true,
}

/**
 * TODO
 * - since mem footprint is not really an issue, at least for small amount of files, 4000 files is about 0.5 MB
 * 	 the crdt can be treated as an state-based crdt during network init and rejoin
 *   and as an operation-based when online (need log for transmission gurantee) (or even just send whole state in updates)
 * - matching file hashes needs to be handled differently
 *
 */
export default class Vessel extends ABCVessel {
	user: string
	root: string
	rooti: number
	rootarr: string[]
	tableEnd = TABLE_END
	tablePath = TABLE_END
	settingsEnd = SETTINGS_END
	settingsPath = SETTINGS_END
	index: CargoList
	skiplist = new Set<string>()
	startupFlags: StartupFlags = { init: true, skip: false, check: false }
	proxyinterface = new ProxyInterface()
	privs: Privileges = { read: true, write: false }
	ignores: Set<string>
	nid: NID
	loggerconf: LoggerConfig
	//admin: boolean

	private _watcher?: FSWatcher
	private _server?: VesselServer
	private _sharetype?: ST

	constructor(user: string, root: string, loggerconf?: LoggerConfig) {
		super()
		this.user = user
		this.root = root
		this.rooti = root.length
		this.rootarr = root.split(sep)
		this.tablePath = join(root, this.tableEnd)
		this.settingsPath = join(root, this.settingsEnd)
		this.ignores = new Set<string>()
			.add(this.root)
			.add(this.tablePath)
			.add(this.settingsPath)
		this.index = new CargoList(root)
		this.nid = { host: "localhost", port: randint(8000, 8888) }
		this.loggerconf = this.checkLoggerConfig(loggerconf)
	}

	private checkLoggerConfig(conf?: LoggerConfig): LoggerConfig {
		return {
			init: conf?.init ?? DEFAULT_LOGGER.init,
			ready: conf?.ready ?? DEFAULT_LOGGER.ready,
			update: conf?.update ?? DEFAULT_LOGGER.update,
			send: conf?.send ?? DEFAULT_LOGGER.send,
			local: conf?.local ?? DEFAULT_LOGGER.local,
			remote: conf?.remote ?? DEFAULT_LOGGER.remote,
			error: conf?.error ?? DEFAULT_LOGGER.error,
			online: conf?.online ?? DEFAULT_LOGGER.online,
			vanish: conf?.vanish ?? DEFAULT_LOGGER.vanish,
		}
	}

	get sharetype(): ST {
		return this.resolve(this._sharetype)
	}

	private get watcher(): FSWatcher {
		return this.resolve(this._watcher)
	}

	private get server(): VesselServer {
		return this.resolve(this._server)
	}

	rejoin(addnew = false): Vessel {
		this.load()
		this._server = new VesselServer(this, this.nid.host, this.nid.port)
		this.startupFlags.skip = !addnew // TODO: use file hash to determine new files
		this.startupFlags.check = true
		this.index.mergewithlocal() // Assuming no changes when process is not running
		return this.startServer()
	}

	join(nid: NID, addlocal = false): Vessel {
		this._server = new VesselServer(this, this.nid.host, this.nid.port)
		this.startupFlags.skip = !addlocal // TODO: use file hash to determine new files
		return this.startServer(() => {
			this.joinvia(nid)
		})
	}

	new(sharetype: ST): Vessel {
		this._server = new VesselServer(this, this.nid.host, this.nid.port)
		this._sharetype = sharetype
		this.privs.write = true
		this.save()
		return this.startServer()
	}

	vanish(): void {
		this.logger(this.loggerconf.vanish, "POFF! GONE.")
	}

	exit(): void {
		this.watcher.close()
		this.server.close()
		this.save()
		this.index.save()
	}

	private joinvia(nid: NID): void {
		const proxy = this.proxyinterface.addNode(Medium.http, { nid })

		Promise.resolve(proxy.getinvite(this.nid)).then(ir => {
			this._sharetype = ir.sharetype
			if (ir.sharetype === ST.All2All) this.privs.write = true
			ir.peers.forEach(nid => this.proxyinterface.addNode(Medium.http, { nid }))
			this.save()
		})

		Promise.resolve(proxy.fetchIndex()).then(index =>
			this.updateCargo(index, proxy)
		)

		//TODO: option to add local files after joining
	}

	load(): Vessel {
		const data = readFileSync(this.settingsPath, { encoding: "utf8" })
		const settings: Settings = JSON.parse(data)
		this.user = settings.user
		this.root = settings.root
		this.rooti = settings.rooti
		this.rootarr = settings.rootarr
		this.tableEnd = settings.tableEnd
		this.tablePath = settings.tablePath
		this.settingsEnd = settings.settingsEnd
		this.settingsPath = settings.settingsPath
		this.nid = settings.nid
		settings.peers.forEach(peer =>
			this.proxyinterface.addNode(Medium.http, {
				nid: peer.nid,
				admin: peer.admin,
			})
		)
		this._sharetype = settings.sharetype
		this.privs = settings.privs
		this.ignores = new Set<string>()
		settings.ignores.forEach(path => this.ignores.add(path))
		return this
	}

	save(): Vessel {
		const settings: Settings = {
			user: this.user,
			root: this.root,
			rooti: this.rooti,
			rootarr: this.rootarr,
			tableEnd: this.tableEnd,
			tablePath: this.tablePath,
			settingsEnd: this.settingsEnd,
			settingsPath: this.settingsPath,
			nid: this.nid,
			peers: this.proxyinterface.serialize(),
			sharetype: this.sharetype,
			privs: this.privs,
			ignores: [...this.ignores],
		}
		writeFileSync(this.settingsPath, JSON.stringify(settings))
		return this
	}

	private resolve<T>(value: T | undefined): T {
		if (value === undefined) throw Error()
		return value
	}

	private removeRoot(path: string): string {
		return path.substring(this.rooti)
	}

	logger(print?: boolean, ...msg: any[]): void {
		if (print) console.log(cts(), this.user, ...msg)
	}

	private startServer(post?: () => void): Vessel {
		Promise.resolve(this.setupEvents())
			.then(() => {
				this.server.listen(info =>
					this.logger(this.loggerconf.online, "ONLINE", info)
				)
				post?.()
			})
			.catch((e: Error) =>
				this.logger(this.loggerconf.error, "ERROR", e.message)
			)
		return this
	}

	private setupEvents(): Promise<void> {
		return new Promise((resolve, rejects) => {
			this._watcher = chokidar(this.root, { persistent: true })
				.on("add", (path: string) => this.applyLocal(path, IT.File, AT.Add))
				.on("change", (path: string) =>
					this.applyLocal(path, IT.File, AT.Change)
				)
				.on("unlink", (path: string) =>
					this.applyLocal(path, IT.File, AT.Remove)
				)
				.on("addDir", (path: string) => this.applyLocal(path, IT.Dir, AT.Add))
				.on("unlinkDir", (path: string) => {
					const patharr = path.split(sep)
					if (this.rootarr.some((p, i) => p !== patharr[i])) return // when deleting folder with files, full path is returned
					this.applyLocal(path, IT.Dir, AT.Remove)
				}) // TODO: error when deleting folder with folders due to order of deletion parent->child
				.on("error", rejects) // TODO: when empty folder gets deleted throws error
				.on("ready", () => {
					this.startupFlags.init = false
					this.startupFlags.skip = false
					this.startupFlags.check = false
					this.index.save()
					this.logger(this.loggerconf.ready, "PLVS VLTRA!")
					resolve()
					//this.logger(this.log.history)
				})
		})
	}

	private checkFile(path: string, type: IT): boolean {
		switch (type) {
			case IT.File:
				return this.index.getLatest(path)?.hash === computehash(path)
			case IT.Dir:
				return this.index.getLatest(path) !== null
			default:
				throw Error()
		}
	}

	private applyLocal(path: string, type: IT, action: AT): void {
		if (!this.privs.write) return
		if (this.ignores.has(path)) return
		if (this.startupFlags.check && this.checkFile(path, type)) return
		if (this.skiplist.delete(path) || this.startupFlags.skip) return

		const item = CargoList.newItem(
			this.removeRoot(path),
			uuid4(),
			type,
			ct(),
			action,
			this.user
		)

		if (action === AT.Change)
			item.uuid = this.index.getLatest(item.path)?.uuid ?? item.uuid
		if (type === IT.File && (action === AT.Add || action === AT.Change))
			item.hash = computehash(path)

		//this.log.push(item, this.user)
		this.index.apply(item) // TODO: const ress = this.index.apply(item), when implementing other resolve policies
		// TODO: clean
		const lcond =
			(this.loggerconf.local && !this.startupFlags.init) ||
			(this.loggerconf.init && this.startupFlags.init)
		this.logger(lcond, action, path)
		if (this.startupFlags.init) return
		this.index.save()
		this.proxyinterface.broadcast(item, this.getRS(item))
	}

	applyIncoming(item: Item, rs: NodeJS.ReadableStream | null): void {
		if (!this.privs.read) return // TODO: ¯\_(ツ)_/¯
		if (this.ignores.has(item.path))
			throw Error(`Vessel.applyIncoming: got ${item.path}`)
		const ress = this.index.apply(item)
		this.logger(this.loggerconf.remote, "REMOTE", item.lastAction, item.path)
		if (!ress[0].new && ress[0].ro === RO.LWW && !ress[0].io) return

		this.applyIO(item, join(this.root, item.path), rs)

		this.index.save()

		//TODO: forward to known peers
	}

	private applyIO(
		item: Item,
		fullpath: string,
		rs: NodeJS.ReadableStream | null
	) {
		this.skiplist.add(fullpath) // TODO: check if unnecessary adds are removed
		if (item.type === IT.Dir && !applyFolderIO(item, fullpath))
			this.skiplist.delete(fullpath)
		else if (item.type === IT.File && !applyFileIO(item, fullpath, rs))
			this.skiplist.delete(fullpath)
	}

	getRS(item: Item): NodeJS.ReadableStream | null {
		const rs = createRS(item, this.root)
		if (rs) this.logger(this.loggerconf.send, "SENDING", item.path)
		return rs
	}

	addVessel(type: Medium, data: { vessel?: Vessel; nid?: NID }): void {
		const proxy = this.proxyinterface.addNode(type, data)
		Promise.resolve(proxy.fetchIndex()).then(ia => this.updateCargo(ia, proxy))
		this.save()
	}

	private updateCargo(data: PIndexArray, proxy: Proxy): void {
		this.logger(this.loggerconf.update, "UPDATING")

		Promise.resolve(data).then(arr => {
			const items = arr
				.flatMap(kv => kv[1])
				.map(i => {
					const ress = this.index.apply(i)
					if (ress.length !== 1) throw Error()
					return ress[0]
				})
				.filter(res => (res.same === undefined ? true : !res.same && res.io))
				.map(res => res.after) // TODO: clean

			proxy.fetch(items).forEach((pr, i) => {
				const item = items[i]
				const full = join(this.root, item.path)
				Promise.resolve(pr).then(rs => this.applyIO(item, full, rs))
				this.index.save()
			})
		})
	}
}

if (require.main === module) {
	const lconf = {
		//init: false,
		//ready: false,
		//update: false,
		//local: false,
		//send: false,
		//online: false,
	}
	const evan = new Vessel("evan", join("testroot", "evan"), lconf).new(
		ST.All2All
	)
	const dave = new Vessel("dave", join("testroot", "dave"), lconf)
	setTimeout(() => dave.join(evan.nid), 1000)
}
