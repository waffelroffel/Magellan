import { watch as chokidar } from "chokidar"
import { FSWatcher, writeFileSync, readFileSync } from "fs"
import { join, resolve as abspath } from "path"
import CargoList from "./CargoList"
import {
	ItemType as IT,
	ActionType as AT,
	Medium,
	SHARE_TYPE as ST,
	PERMISSION,
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
	Resolution,
} from "./interfaces"
import ProxyInterface from "./ProxyInterface"
import { cts, increment, randint } from "./utils"
import Proxy from "./Proxies/Proxy"
import VesselServer from "./VesselServer"
import LocalProxy from "./Proxies/LocalProxy"
import PermissionManager from "./Permissions"
import ABCStorage from "./Storages/ABCStorage"
import { LocalStorage } from "./Storages/LocalDrive"
import SkipList from "./SkipList"
import { checkLoggerConfig } from "./defaultconf"

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
	tablepath: string
	TABLE_END = "indextable.json"
	settingspath: string
	SETTINGS_END = "settings.json"
	skiplist = new SkipList()
	init = true
	ignored: string[]
	nid: NID
	loggerconf: LoggerConfig
	online = false
	synced = false
	store: ABCStorage

	private _index: CargoList
	private _proxylist = new ProxyInterface()
	private admin = false
	private permissions: Permissions = { write: false, read: false }
	private permmanager?: PermissionManager
	private afterOnline?: () => void
	private apply = this.applyInit

	private _watcher?: FSWatcher
	private _server?: VesselServer // TODO: move inside contructor?
	private _sharetype?: ST
	private _setupready?: Promise<void>

	get index(): CargoList {
		return this._index
	}

	get proxylist(): ProxyInterface {
		return this._proxylist
	}

	get isAdmin(): boolean {
		return this.admin
	}

	get sharetype(): ST {
		return this.resolve(this._sharetype)
	}

	get watcher(): FSWatcher {
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
		this.tablepath = join(root, this.TABLE_END)
		this.settingspath = join(root, this.SETTINGS_END)
		this.ignored = [this.TABLE_END, this.SETTINGS_END]
		this._index = new CargoList(this.tablepath, opts)
		this.nid = { host: "localhost", port: randint(8000, 8888) }
		this.loggerconf = checkLoggerConfig(opts?.loggerconf)
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

	getIndexArray(): IndexArray {
		return this.index.asArray()
	}

	addPeer(nid: NID): boolean {
		if (this.proxylist.has(nid)) return false
		this.proxylist.addNode(Medium.http, { nid })
		this.saveSettings()
		return true
	}

	rejoin(): Vessel {
		this.loadSettings()
		this.index.mergewithlocal()
		this._server = new VesselServer(this, this.nid.host, this.nid.port)
		this._setupready = this.setupEvents()
		this.afterOnline = async () => {
			const indices: [IndexArray, Proxy][] = []
			for (const p of this.proxylist) {
				const index = await p.fetchIndex()
				if (!index) throw Error()
				indices.push([index, p])
			}
			this.updateCargo(indices)
		}
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

	disconnect(): Vessel {
		this.online = false
		this.server.close()
		this.logger(this.loggerconf.offline, "OFFLINE")
		return this
	}

	exit(): Vessel {
		if (this.online) this.disconnect()
		this.watcher.close()
		this.saveSettings()
		this.index.save()
		this.logger(this.loggerconf.offline, "EXITED")
		return this
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
		const index = await proxy.fetchIndex()
		if (!index) throw Error()
		this.updateCargo([[index, proxy]])
		this.saveSettings()
	}

	loadSettings(): Vessel {
		const data = readFileSync(this.settingspath, { encoding: "utf8" })
		const settings: Settings = JSON.parse(data)
		this.user = settings.user
		this.root = settings.root
		this.tablepath = settings.tablepath
		this.settingspath = settings.settingspath
		this.nid = settings.nid
		settings.peers.forEach(({ nid }) =>
			this.proxylist.addNode(Medium.http, { nid })
		)
		this._sharetype = settings.sharetype
		this.permissions = settings.privs
		this.ignored = settings.ignored
		this.loggerconf = settings.loggerconf
		this.admin = settings.admin
		return this
	}

	saveSettings(): Vessel {
		const settings: Settings = {
			user: this.user,
			root: this.root,
			tablepath: this.tablepath,
			settingspath: this.settingspath,
			nid: this.nid,
			peers: this.proxylist.serialize(),
			sharetype: this.sharetype,
			privs: this.permissions,
			ignored: this.ignored,
			loggerconf: this.loggerconf,
			admin: this.admin,
		}
		writeFileSync(this.settingspath, JSON.stringify(settings))
		return this
	}

	private resolve<T>(value: T | undefined): T {
		if (value === undefined) throw Error()
		return value
	}

	logger(print?: boolean, ...msg: string[]): void {
		if (print) console.log(cts(), this.user, ...msg)
	}

	private async startServer(): Promise<void> {
		await this.setupready
		this.logger(this.loggerconf.online, "ONLINE", await this.server.listen())
		this.online = true
	}

	private setupEvents(): Promise<void> {
		return new Promise(resolve => {
			this._watcher = chokidar("", {
				cwd: abspath(this.root),
				disableGlobbing: true,
				ignored: this.ignored,
				ignoreInitial: false, // TODO
				awaitWriteFinish: { stabilityThreshold: 1000 },
			})
				.on("add", (path: string) => this.apply(path, IT.File, AT.Add))
				.on("change", (path: string) => this.apply(path, IT.File, AT.Change))
				.on("unlink", (path: string) => this.apply(path, IT.File, AT.Remove))
				.on("addDir", (path: string) => this.apply(path, IT.Dir, AT.Add))
				.on("unlinkDir", (path: string) => this.apply(path, IT.Dir, AT.Remove)) // FIXME: error when deleting folder with folders due to order of deletion parent->child
				.on("error", e =>
					this.logger(this.loggerconf.error, "ERROR", e.message)
				) // BUG: when empty folder gets deleted throws error TODO: add {ignorePermissionErrors: true} to chokidar
				.on("ready", () => {
					this.init = false
					this.apply = this.applyLocal
					this.index.save()
					this.logger(this.loggerconf.ready, "PLVS VLTRA!")
					resolve()
				})
		})
	}

	private async applyInit(path: string, type: IT, action: AT): Promise<void> {
		if (path === "") return
		if (!this.permissions.write) return
		if (!this.init) return
		if (action !== AT.Add) return

		const item = CargoList.Item(path, type, action, this.user)
		item.lastModified = this.store.lastmodified(item)
		//item.onDevice = true

		const latest = this.index.getLatest(item.path)
		if (latest && item.lastModified < latest.lastModified) return
		if (type === IT.File) {
			item.hash = await this.store.computehash(item)
			if (latest && latest.hash !== item.hash) throw Error("hash unequal")
			item.id = latest?.id ?? item.id
			item.clock = latest?.clock ?? item.clock
		}

		this.logger(this.loggerconf.init && this.init, "INIT", action, item.path)

		this.index.apply(item)
	}

	private async applyLocal(path: string, type: IT, action: AT): Promise<void> {
		if (!this.permissions.write) return
		if (this.skiplist.reduce(path)) return

		const item = CargoList.Item(path, type, action, this.user)
		item.lastModified = this.store.lastmodified(item)
		//item.onDevice = true
		if (action === AT.Change || action === AT.Remove) {
			const latest = this.index.getLatest(item.path)
			item.id = latest?.id ?? item.id
			item.clock = latest ? increment(latest.clock, this.user) : item.clock
		}
		if (type === IT.File && (action === AT.Add || action === AT.Change))
			item.hash = await this.store.computehash(item)

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
		if (!this.permissions.read) return

		this.logger(this.loggerconf.remote, "<-", item.lastAction, item.path)
		this.index.apply(item).forEach(res => {
			if (res.new) this.applyIO(res.after, rs)
			else if (res.rename && res.before) this.moveFile(res.before, res.after)
			else throw Error()
		})
		this.index.save()

		//TODO: forward to known peers
	}

	private moveFile(from: Item, to: Item): void {
		// TODO: error handling on failed move
		this.skiplist.add(to.path, 1)
		this.store
			.move(from, to)
			.then(written => !written && this.skiplist.reduce(to.path))
	}

	private applyIO(item: Item, rs?: NodeJS.ReadableStream): void {
		// TODO: error handling on failed io op
		//item.onDevice = !item.tomb
		this.skiplist.add(item.path, 1)
		if (item.type === IT.Dir && !this.store.applyFolderIO(item))
			this.skiplist.reduce(item.path)
		else if (item.type === IT.File && !this.store.applyFileIO(item, rs))
			this.skiplist.reduce(item.path)
	}

	getRS(item: Item): NodeJS.ReadableStream | null {
		const latest = this.index.dig(item)
		if (latest.tomb) throw Error()
		if (latest?.id !== item.id) console.log(this.user, "Sending wrong file")
		const rs = this.store.createRS(latest)
		if (rs) this.logger(this.loggerconf.send, "SENDING", latest.path)
		return rs
	}

	/**
	 * localproxy only
	 */
	addVessel(vessel: Vessel): void {
		const proxy = this.proxylist.addNode(Medium.local, { vessel })
		if (!(proxy instanceof LocalProxy))
			throw Error("Vessel.addVessel: not localproxy")
		this.updateCargo([[proxy.fetchIndex(), proxy]])
		proxy.addPeer(vessel)
	}

	private async updateCargo(indices: [IndexArray, Proxy][]): Promise<void> {
		this.logger(this.loggerconf.update, "UPDATING")
		const itemarr: [Item, Proxy][] = []
		indices.forEach(([index, p]) =>
			index.forEach(([, v]) => v.forEach(i => itemarr.push([i, p])))
		)
		const ressarr: [Resolution, Proxy][] = []
		itemarr.map(([i, p]) =>
			this.index.apply(i).forEach(res => ressarr.push([res, p]))
		)

		ressarr.forEach(([res]) => {
			if (res.rename && !res.new) {
				if (res.before) this.moveFile(res.before, res.after)
			}
		})

		ressarr.forEach(([res, p]) => {
			if (!res.new) return
			p.fetchItems([res.before ?? res.after]).forEach(async prs =>
				this.applyIO(res.after, (await prs) ?? undefined)
			)
		})

		this.index.save()
	}

	// TODO
	grantPrivs(nid: NID, priv: PERMISSION): boolean {
		nid
		priv
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
