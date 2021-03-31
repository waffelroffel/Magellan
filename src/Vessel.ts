import { watch as chokidar } from "chokidar"
import { FSWatcher, writeFileSync, readFileSync } from "fs"
import { join, sep } from "path"
import CargoList from "./CargoList"
import {
	ItemType as IT,
	ActionType as AT,
	Medium,
	ResolveOption as RO,
	SHARE_TYPE as ST,
	PERMISSION,
} from "./enums"
import {
	Item,
	NID,
	Permissions,
	Settings,
	StartupFlags,
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
	skiplist = new Set<string>()
	startupFlags: StartupFlags = { init: true, skip: false, check: false }
	proxylist = new ProxyInterface()
	ignores: Set<string>
	nid: NID
	loggerconf: LoggerConfig
	online = false
	store: ABCStorage

	private admin = false
	private permissions: Permissions = { write: false, read: false }
	private permmanager?: PermissionManager
	private afterOnline?: () => {}

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
		this.nid = { host: "localhost", port: randint(8000, 8888) }
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

	rejoin(addnew = false): Vessel {
		this.loadSettings()
		this.index.mergewithlocal()
		this._server = new VesselServer(this, this.nid.host, this.nid.port)
		this.startupFlags.skip = !addnew // TODO: add local files after joining
		this.startupFlags.check = true
		this._setupready = this.setupEvents()
		return this
	}

	join(nid: NID): Vessel {
		this._server = new VesselServer(this, this.nid.host, this.nid.port)
		this.startupFlags.skip = true // overlaps with priv.write in applyLocal
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
				.on("error", e =>
					this.logger(this.loggerconf.error, "ERROR", e.message)
				) // TODO: when empty folder gets deleted throws error
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

	private exists(path: string, type: IT): boolean {
		switch (type) {
			case IT.File:
				return this.index.getLatest(path)?.hash === this.store.computehash(path)
			case IT.Dir:
				return this.index.getLatest(path)?.lastAction !== AT.Remove
		}
	}

	private applyLocal(path: string, type: IT, action: AT): void {
		if (!this.permissions.write) return
		if (this.ignores.has(path)) return
		if (this.startupFlags.check && this.exists(path, type)) return
		if (this.skiplist.delete(path) || this.startupFlags.skip) return

		const item = CargoList.Item(this.remRoot(path), type, action, this.user)

		if (action === AT.Change || action === AT.Remove) {
			const latest = this.index.getLatest(item.path)
			if (!latest) throw Error("latest === null")
			item.uuid = latest.uuid
			item.clock = increment(latest.clock, this.user)
		}
		if (type === IT.File && (action === AT.Add || action === AT.Change))
			item.hash = this.store.computehash(path)

		//this.log.push(item, this.user)
		this.index.apply(item) // TODO: const ress = this.index.apply(item), when implementing other resolve policies
		const inInit = this.loggerconf.init && this.startupFlags.init
		const inLocal = this.loggerconf.local && !this.startupFlags.init
		this.logger(inInit || inLocal, "->", action, item.path)

		if (!this.startupFlags.init) this.index.save()
		if (this.online) this.broadcast(item)
	}

	private broadcast(item: Item): void {
		this.proxylist.broadcast(item, this.getRS(item) ?? undefined)
	}

	applyIncoming(item: Item, rs?: NodeJS.ReadableStream): void {
		if (!this.permissions.read) return // TODO: ¯\_(ツ)_/¯
		if (this.ignores.has(item.path)) return

		const ress = this.index.apply(item)
		this.logger(this.loggerconf.remote, "<-", item.lastAction, item.path)
		if (!ress[0].new) return //&& ress[0].ro === RO.LWW) return

		this.applyIO(item, rs)
		this.index.save()

		//TODO: forward to known peers
	}

	private applyIO(item: Item, rs?: NodeJS.ReadableStream) {
		const fullpath = join(this.root, item.path)
		this.skiplist.add(fullpath)
		if (item.type === IT.Dir && !this.store.applyFolderIO(item))
			this.skiplist.delete(fullpath)
		else if (item.type === IT.File && !this.store.applyFileIO(item, rs))
			this.skiplist.delete(fullpath)
	}

	getRS(item: Item): NodeJS.ReadableStream | null {
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

		const newitems = items
			.flatMap(kv => kv[1])
			.map(i => this.index.apply(i)[0])
			.filter(res => res.new)
			.map(res => res.after)
		this.index.save()

		proxy.fetchItems(newitems).forEach(async (prs, i) => {
			this.applyIO(newitems[i], (await prs) ?? undefined)
		})
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
