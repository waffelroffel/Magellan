import { watch as chokidar } from "chokidar"
import {
	FSWatcher,
	existsSync,
	rmdirSync,
	mkdirSync,
	rmSync,
	createWriteStream,
	createReadStream,
	writeFileSync,
	readFileSync,
} from "fs"
import { join, sep } from "path"
import { v4 as uuid4 } from "uuid"
import { ABCVessel } from "./Proxies/ABCVessel"
import CargoList from "./CargoList"
import {
	ItemType as IT,
	ActionType as AT,
	Medium,
	ResolveOption as RO,
	SHARE_TYPE,
} from "./enums"
import {
	Item,
	NID,
	IndexArray,
	Streamable,
	Privileges,
	Settings,
} from "./interfaces"
import ProxyInterface from "./ProxyInterface"
import { cts, ct, computehash } from "./utils"
import Proxy from "./Proxies/Proxy"
import LocalProxy from "./Proxies/LocalProxy"
import HTTPProxy from "./Proxies/HTTPProxy"
import VesselServer from "./VesselServer"

const TABLE_END = "indextable.json"
const SETTINGS_END = "settings.json"

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
	watcher?: FSWatcher
	index: CargoList
	skiplist = new Set<string>() // TODO: wait for skiplist.length === 0 before exiting
	//log = new Log()
	init = true
	skip = false
	proxyinterface = new ProxyInterface()
	server: VesselServer
	private _sharetype?: SHARE_TYPE
	admins = new Set<Proxy>()
	privs: Privileges = { read: true, write: false }
	ignores: Set<string>

	localtempfilehashes = new Map<string, string>()

	constructor(user: string, root: string) {
		super()

		this.user = user

		this.root = root
		this.rooti = root.length
		this.rootarr = root.split(sep)
		this.tablePath = join(root, this.tableEnd)
		this.settingsPath = join(root, this.settingsEnd)
		this.ignores = new Set<string>().add(this.tablePath).add(this.settingsPath)

		this.index = new CargoList(root)

		const { host, port } = this.proxyinterface.nid
		this.server = new VesselServer(this, host, port)
	}

	get nid(): NID {
		return this.proxyinterface.nid
	}

	get sharetype(): SHARE_TYPE {
		return this.resolve(this._sharetype)
	}

	rejoin(): Vessel {
		this.skip = true // TODO: remove and do file hash checking with index
		this.index.mergewithlocal() // Assuming no changes when process is not running  // TODO: add file checking
		return this.connect()
	}

	join(nid: NID): Vessel {
		this.skip = true // TODO: remove and do file hash checking with index
		return this.connect(() => {
			this.fetchNetInfo(nid)
		}) // TODO: change addnode in proxyinterface to remove duplicates
	}

	new(sharetype: SHARE_TYPE): Vessel {
		this._sharetype = sharetype
		this.privs.write = true
		return this.connect()
	}

	vanish(): void {
		this.logger("POFF! GONE.")
	}

	private fetchNetInfo(nid: NID): void {
		const proxy = this.proxyinterface.addNode(Medium.http, { nid })
		if (!(proxy instanceof LocalProxy || proxy instanceof HTTPProxy))
			throw Error()
		Promise.resolve(proxy.fetchNetInfo()).then(
			info => (this._sharetype = info.sharetype)
		)
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
		settings.proxyinterface.forEach(nid => {
			this.proxyinterface.addNode(Medium.http, { nid })
		})
		this._sharetype = settings.sharetype
		settings.admins.forEach(nid => {
			const proxy = this.proxyinterface.get(nid)
			if (!proxy) return console.log("admin proxy not http")
			this.admins.add(proxy)
		})
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
			proxyinterface: this.proxyinterface.serialize(),
			sharetype: this.sharetype,
			admins: this.serializeAdmins(),
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

	private serializeAdmins(): NID[] {
		return [...this.admins]
			.filter(p => p instanceof HTTPProxy)
			.map(p => (p as HTTPProxy).nid)
	}

	private removeRoot(path: string): string {
		return path.substring(this.rooti)
	}

	logger(...msg: any[]): void {
		console.log(cts(), this.user, ...msg)
	}

	private connect(post?: () => void): Vessel {
		Promise.resolve(this.setupEvents())
			.then(() => {
				this.server.listen()
				if (post) post()
			})
			.catch(this.logger)
		return this
	}

	private disconnect(): Vessel {
		this.server.server.close() // TODO: temp
		return this
	}

	private setupEvents(): Promise<void> {
		return new Promise((resolve, rejects) => {
			this.watcher = chokidar(this.root, { persistent: true })
				.on("add", (path: string) => this.applyLocal(path, IT.File, AT.Add))
				.on("change", (path: string) =>
					this.applyLocal(path, IT.File, AT.Change)
				)
				.on("unlink", (path: string) =>
					this.applyLocal(path, IT.File, AT.Remove)
				)
				.on("addDir", (path: string) =>
					this.applyLocal(path, IT.Folder, AT.Add)
				)
				.on("unlinkDir", (path: string) => {
					const patharr = path.split(sep)
					if (this.rootarr.some((p, i) => p !== patharr[i])) return // when deleting folder with files, full path is returned
					this.applyLocal(path, IT.Folder, AT.Remove)
				}) // TODO: error when deleting folder with folders due to order of deletion parent->child
				.on("error", rejects) // TODO: when empty folder gets deleted throws error
				.on("ready", () => {
					this.init = false
					this.skip = false
					this.index.save()
					this.logger("PLVS VLTRA!")
					resolve()
					//this.logger(this.log.history)
				})
		})
	}

	private applyLocal(path: string, type: IT, action: AT): void {
		if (this.ignores.has(path)) return
		if (this.skiplist.delete(path) || this.skip) return
		if ([this.root, this.tablePath].includes(path)) return

		const item = CargoList.newItem(
			this.removeRoot(path),
			uuid4(),
			type,
			ct(),
			action,
			this.user
		)

		const latest = this.index.getLatest(item.path)
		item.uuid = latest?.uuid ?? item.uuid // TODO: need to apply the latest item to preserve uuid and hash
		item.hash = latest?.hash ?? item.hash // TODO: check

		if (type === IT.File && action === AT.Remove) {
			const newpath = this.localtempfilehashes.get(item.hash ?? "") ?? "" //TODO

			//if (newpath) item.tomb = { type: TombTypes.Moved, movedTo: newpath }

			this.localtempfilehashes.delete(item.hash ?? "")
		} else if (type === IT.File && (action === AT.Add || action === AT.Change))
			item.hash = computehash(path)

		//this.log.push(item, this.user)
		const ress = this.index.apply(item)
		this.logger(action, path)
		if (this.init) return

		// this.localtempfilehashes.set(item.hash ?? "", item.path) // TODO
		this.index.save()
		this.proxyinterface.broadcast(item, this.createRS(item))
	}

	applyIncoming(item: Item, rs?: NodeJS.ReadableStream): void {
		if (this.ignores.has(item.path))
			throw Error(`Vessel.applyIncoming: got ${item.path}`)
		const ress = this.index.apply(item)
		this.logger("REMOTE", item.lastAction, item.path)
		if (!ress[0].new && ress[0].ro === RO.LWW && !ress[0].io) return

		const full = join(this.root, item.path)
		if (item.type === IT.Folder) this.applyFolderIO(item, full)
		else if (item.type === IT.File) this.applyFileIO(item, full, rs)

		this.index.save()
	}

	private applyFolderIO(item: Item, fullpath: string): void {
		if (item.lastAction === AT.Remove && existsSync(fullpath)) {
			this.skiplist.add(fullpath)
			rmdirSync(fullpath, { recursive: true })
		} else if (item.lastAction === AT.Add && !existsSync(fullpath)) {
			this.skiplist.add(fullpath)
			mkdirSync(fullpath, { recursive: true })
		} //else console.log("Illegal io op:", item.lastAction, fullpath)
		//throw Error("Vessel.applyFolderIO: illegal argument")
	}

	private applyFileIO(item: Item, fullpath: string, rs?: Streamable | null) {
		if (item.lastAction === AT.Remove && existsSync(fullpath)) {
			this.skiplist.add(fullpath)
			rmSync(fullpath)
		} else {
			this.skiplist.add(fullpath)
			rs?.pipe(createWriteStream(fullpath))
		}
	}

	createRS(item: Item): NodeJS.ReadableStream | null {
		if (item.type === IT.Folder || item.lastAction === AT.Remove) return null
		this.logger("createRS", item.path)
		return createReadStream(join(this.root, item.path))
	}

	addVessel(type: Medium, data: { vessel?: Vessel; nid?: NID }): void {
		const proxy = this.proxyinterface.addNode(type, data)
		if (!(proxy instanceof LocalProxy || proxy instanceof HTTPProxy))
			throw Error(`Vessel.addVessel: ${proxy.constructor.name} not implemented`)

		Promise.resolve(proxy.fetchIndex()).then(index =>
			this.updateCargo(index, proxy)
		)
	}

	private updateCargo(
		data: IndexArray | Promise<IndexArray>,
		proxy: Proxy
	): void {
		this.logger("UPDATING")

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
				if (item.type === IT.Folder) this.applyFolderIO(item, full)
				else if (item.type === IT.File)
					Promise.resolve(pr).then(rs => this.applyFileIO(item, full, rs))
			})
			this.index.save()
		})
	}
}

if (require.main === module) {
	const v = new Vessel("evan", join("testroot", "evan")).new(SHARE_TYPE.All2All)
	setTimeout(() => v.save(), 1000)
}
