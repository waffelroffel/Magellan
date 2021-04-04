import { watch as chokidar } from "chokidar"
import { FSWatcher, writeFileSync, readFileSync, statSync } from "fs"
import { join, sep } from "path"
import CargoList from "./CargoList"
import {
	ItemType as IT,
	ActionType as AT,
	Medium,
	SHARE_TYPE as ST,
	PERMISSION,
	ResolveOption as RO,
} from "./enums"
import {
	Item,
	NID,
	Permissions,
	Settings,
	LoggerConfig,
	Invite,
	VesselOptions,
	IndexArray,
	ProxyRes,
} from "./interfaces"
import ProxyInterface from "./ProxyInterface"
import { cts, increment, randint } from "./utils"
import Proxy from "./Proxies/Proxy"
import VesselServer from "./VesselServer"
import LocalProxy from "./Proxies/LocalProxy"
import PermissionManager from "./Permissions"
import ABCStorage from "./Storages/ABCStorage"
import { LocalStorage } from "./Storages/LocalDrive"
import { DupDirConfig, DupFileConfig } from "./ResolvePolicies/defaultconfigs"
import SkipList from "./SkipList"

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
export default class Vessel {
	user: string
	root: string
	rooti: number
	rootarr: string[]
	tableEnd = TABLE_END
	tablePath = TABLE_END
	settingsEnd = SETTINGS_END
	settingsPath = SETTINGS_END
	index: CargoList
	skiplist = new SkipList()
	init: boolean = true
	proxylist = new ProxyInterface()
	ignores: Set<string>
	nid: NID
	loggerconf: LoggerConfig
	online = false
	synced = false
	store: ABCStorage

	private admin = false
	private permissions: Permissions = { write: false, read: false }
	private permmanager?: PermissionManager
	private afterOnline?: () => void
	private apply = this.applyInit

	private _watcher?: FSWatcher
	private _server?: VesselServer // TODO: move inside contructor?
	private _sharetype?: ST
	private _setupready?: Promise<void>

	get isAdmin(): boolean {
		return this.admin
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

	private get setupready(): Promise<void> {
		return this.resolve(this._setupready)
	}

	constructor(user: string, root: string, opts?: VesselOptions) {
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
		this.index = new CargoList(root, opts)
		this.nid = { host: "localhost", port: randint(8000, 8888) } // TODO:
		this.loggerconf = this.checkLoggerConfig(opts?.loggerconf)
		this.store = this.initStorage(root, "local")
	}

	private initStorage(root: string, type: string): ABCStorage {
		switch (type) {
			case "local":
				return new LocalStorage(root)
			default:
				throw Error()
		}
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

	rejoin(): Vessel {
		this.loadSettings()
		this.index.mergewithlocal()
		this._server = new VesselServer(this, this.nid.host, this.nid.port)
		this._setupready = this.setupEvents()
		this.afterOnline = () =>
			this.proxylist.forEach(p => this.updateCargo(p.fetchIndex(), p))
		return this
	}

	join(nid: NID): Vessel {
		this._server = new VesselServer(this, this.nid.host, this.nid.port)
		this._setupready = this.setupEvents()
		this.afterOnline = () => this.joinvia(nid)
		return this
	}

	new(sharetype: ST): Vessel {
		this._server = new VesselServer(this, this.nid.host, this.nid.port)
		this._sharetype = sharetype
		this.permissions = PermissionManager.defaultPerms(sharetype)
		this.permmanager = new PermissionManager()
		this.permmanager.grantAll(this.permissions, this.nid)
		this.admin = true
		this._setupready = this.setupEvents()
		this.saveSettings()
		return this
	}

	connect(): Vessel {
		this.startServer().then(() => this.afterOnline?.())
		return this
	}

	vanish(): void {
		this.logger(this.loggerconf.vanish, "POFF! GONE.")
	}

	disconnect(): void {
		this.logger(true, "OFFLINE")
		this.online = false
		this.watcher.close()
		this.server.close()
		this.saveSettings()
		this.index.save()
	}

	private async joinvia(nid: NID): Promise<void> {
		const proxy = this.proxylist.addNode(Medium.http, { nid })
		const ir = await proxy.getinvite(this.nid)
		if (!ir)
			return this.logger(this.loggerconf.error, "ERROR: couldn't fetch invite")
		this._sharetype = ir.sharetype
		this.permissions = ir.perms
		ir.peers.forEach(nid => {
			if (this.proxylist.has(nid)) return
			this.proxylist.addNode(Medium.http, { nid }).addPeer(this.nid)
		})
		this.updateCargo(proxy.fetchIndex(), proxy)
		this.saveSettings()
	}

	loadSettings(): Vessel {
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
			this.proxylist.addNode(Medium.http, { nid: peer.nid })
		)
		this._sharetype = settings.sharetype
		this.permissions = settings.privs
		this.ignores = new Set<string>(settings.ignores)
		this.loggerconf = settings.loggerconf
		this.admin = settings.admin
		return this
	}

	// TODO: async
	saveSettings(): Vessel {
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
			peers: this.proxylist.serialize(),
			sharetype: this.sharetype,
			privs: this.permissions,
			ignores: [...this.ignores],
			loggerconf: this.loggerconf,
			admin: this.admin,
		}
		writeFileSync(this.settingsPath, JSON.stringify(settings))
		return this
	}

	private resolve<T>(value: T | undefined): T {
		if (value === undefined) throw Error()
		return value
	}

	private remRoot(path: string): string {
		return path.substring(this.rooti)
	}

	logger(print?: boolean, ...msg: any[]): void {
		if (print) console.log(cts(), this.user, ...msg)
	}

	private async startServer(): Promise<void> {
		await this.setupready
		this.logger(this.loggerconf.online, "ONLINE", await this.server.listen())
		this.online = true
	}

	private setupEvents(): Promise<void> {
		return new Promise(resolve => {
			this._watcher = chokidar(this.root, { persistent: true })
				.on("add", (path: string) => this.apply(path, IT.File, AT.Add))
				.on("change", (path: string) => this.apply(path, IT.File, AT.Change))
				.on("unlink", (path: string) => this.apply(path, IT.File, AT.Remove))
				.on("addDir", (path: string) => this.apply(path, IT.Dir, AT.Add))
				.on("unlinkDir", (path: string) => {
					const patharr = path.split(sep)
					if (this.rootarr.some((p, i) => p !== patharr[i])) return // when deleting folder with files, full path is returned
					this.apply(path, IT.Dir, AT.Remove)
				}) // TODO: error when deleting folder with folders due to order of deletion parent->child
				.on("error", e =>
					this.logger(this.loggerconf.error, "ERROR", e.message)
				) // TODO: when empty folder gets deleted throws error
				.on("ready", () => {
					this.init = false
					this.apply = this.applyLocal
					this.index.save()
					this.logger(this.loggerconf.ready, "PLVS VLTRA!")
					resolve()
				})
		})
	}

	private applyInit(path: string, type: IT, action: AT): void {
		if (!this.permissions.write) return
		if (!this.init) return
		if (action !== AT.Add) return
		if (this.ignores.has(path)) return

		const item = CargoList.Item(this.remRoot(path), type, action, this.user)
		//item.onDevice = true

		const latest = this.index.getLatest(item.path)
		if (latest && statSync(path).mtimeMs < latest.lastModified) return
		if (type === IT.File) {
			item.hash = this.store.computehash(path)
			if (latest && latest.hash !== item.hash) throw Error("hash unequal")
			item.id = latest?.id ?? item.id
			item.clock = latest?.clock ?? item.clock
		}

		this.logger(this.loggerconf.init && this.init, "INIT", action, item.path)

		this.index.apply(item)
	}

	private applyLocal(path: string, type: IT, action: AT): void {
		if (!this.permissions.write) return
		if (this.ignores.has(path)) return
		if (this.skiplist.reduce(path)) return

		const item = CargoList.Item(this.remRoot(path), type, action, this.user)
		//item.onDevice = true
		if (action === AT.Change || action === AT.Remove) {
			const latest = this.index.getLatest(item.path)
			item.id = latest?.id ?? item.id
			item.clock = latest ? increment(latest.clock, this.user) : item.clock
		}
		if (type === IT.File && (action === AT.Add || action === AT.Change))
			item.hash = this.store.computehash(path)

		// Assuming no local conflicts
		const resarr = this.index.apply(item)
		if (resarr.length > 1) throw Error("local conflicts")
		this.index.save()

		this.logger(this.loggerconf.local, "->", action, item.path)
		if (this.online) this.broadcast(item)
	}

	private broadcast(item: Item): void {
		this.proxylist.broadcast(item, this.getRS(item) ?? undefined)
	}

	applyIncoming(item: Item, rs?: NodeJS.ReadableStream): void {
		if (!this.permissions.read) return // TODO: ¯\_(ツ)_/¯
		if (this.ignores.has(item.path)) return

		this.logger(this.loggerconf.remote, "<-", item.lastAction, item.path)

		this.index.apply(item).forEach(res => {
			//if (res.ro === RO.LWW && res.new) this.applyIO(res.after, rs)
			if (res.new) this.applyIO(res.after, rs)
			else if (res.rename && res.before) this.moveFile(res.before, res.after)
			else throw Error()
		})
		this.index.save()

		//TODO: forward to known peers
	}

	private moveFile(from: Item, to: Item): void {
		this.skiplist.set(this.store.fullpath(to), 2)
		this.store.move(from, to)
	}

	private applyIO(item: Item, rs?: NodeJS.ReadableStream): void {
		//item.onDevice = !item.tomb
		const fullpath = this.store.fullpath(item)
		this.skiplist.add(fullpath, 1)
		if (item.type === IT.Dir && !this.store.applyFolderIO(item))
			this.skiplist.reduce(fullpath)
		else if (item.type === IT.File && !this.store.applyFileIO(item, rs))
			this.skiplist.reduce(fullpath)
	}

	getRS(item: Item): NodeJS.ReadableStream | null {
		// TODO: user local latest and traverse tomb
		const latest = this.index.findById(item)
		if (latest?.id !== item.id) console.log(this.user, "Sending wrong file")
		//console.log(item.id, latest?.id, latest?.tomb)
		//if (!latest) return null
		//console.log(item.tomb)
		const rs = this.store.createRS(item)
		if (rs) this.logger(this.loggerconf.send, "SENDING", item.path)
		return rs
	}

	/**
	 * localproxy only
	 */
	addVessel(vessel: Vessel): void {
		const proxy = this.proxylist.addNode(Medium.local, { vessel })
		if (!(proxy instanceof LocalProxy))
			throw Error("Vessel.addVessel: not localproxy")
		this.updateCargo(proxy.fetchIndex(), proxy)
		proxy.addPeer(vessel)
	}

	private async updateCargo(
		index: ProxyRes<IndexArray>,
		proxy: Proxy
	): Promise<void> {
		this.logger(this.loggerconf.update, "UPDATING")

		const items = await index
		if (!items)
			return this.logger(this.loggerconf.error, "ERROR: couldn't fetch index")
		const resarr = items
			.flatMap(([_, v]) => v)
			.flatMap(i => this.index.apply(i))
		resarr
			.filter(i => i.rename && !i.new)
			.forEach(res => res.before && this.moveFile(res.before, res.after))
		const newitems = resarr.filter(i => i.new)
		const befores = newitems.map(i => i.before ?? i.after)
		const afters = newitems.map(i => i.after) // TODO: get dst from tomb
		proxy.fetchItems(befores).forEach(async (prs, i) => {
			this.applyIO(afters[i], (await prs) ?? undefined)
		})
		this.index.save()
	}

	// TODO
	grantPrivs(nid: NID, priv: PERMISSION): boolean {
		return false
	}

	invite(nid: NID): Invite | null {
		if (!this.isAdmin || !this.permmanager) return null
		const perms = PermissionManager.defaultPerms(this.sharetype)
		if (perms.read) this.permmanager.grant(PERMISSION.READ, nid)
		if (perms.write) this.permmanager.grant(PERMISSION.WRITE, nid)
		const invite = {
			sharetype: this.sharetype,
			peers: this.proxylist.serialize().map(p => p.nid),
			perms: perms,
		}
		this.permmanager.grant
		this.proxylist.addNode(Medium.http, { nid })
		this.saveSettings()
		return invite
	}
}

if (require.main === module) {
	const opts = {
		loggerconf: {
			init: false,
			//ready: false,
			update: false,
			//local: false,
			send: false,
			//online: false,
		},
		filerp: DupFileConfig,
		dirrp: DupDirConfig,
	}

	const evan = new Vessel("evan", join("testroot", "evan"), opts)
		.new(ST.All2All)
		.connect()
	const dave = new Vessel("dave", join("testroot", "dave"), opts)
		.join(evan.nid)
		.connect()
}
