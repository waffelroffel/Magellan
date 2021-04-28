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
	TombType,
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
	PermissionGrant,
} from "./interfaces"
import ProxyInterface from "./ProxyInterface"
import { ct, cts, increment, randint } from "./utils"
import Proxy from "./Proxies/Proxy"
import VesselServer from "./VesselServer"
import LocalProxy from "./Proxies/LocalProxy"
import PermissionManager from "./Permissions"
import ABCStorage from "./Storages/ABCStorage"
import { LocalStorage } from "./Storages/LocalDrive"
import SkipList from "./SkipList"
import { checkLoggerConfig } from "./defaultconf"

export default class Vessel {
	user: string
	root: string
	tablepath: string
	TABLE_END = "indextable.json"
	settingspath: string
	SETTINGS_END = "settings.json"
	skiplist = new SkipList()
	potmovefiles = new Map<string, Item>()
	init = true
	ignoreNewOnRejoin = false
	ignored: string[]
	nid: NID
	loggerconf: LoggerConfig
	online = false
	synced = false
	store: ABCStorage

	private onlocal = new Set<string>()
	private _index: CargoList
	private _proxylist = new ProxyInterface()
	private admin = false
	private permissions: Permissions = { write: false, read: false }
	private permreqlist: { nid: NID; perm: PERMISSION }[] = []
	private afterOnline?: () => void
	private apply = this.applyInit

	private _watcher?: FSWatcher
	private _server?: VesselServer
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
		this.ignored = [this.TABLE_END, this.SETTINGS_END, ".temp/**"]
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

	rejoin(ignoreNew = false): Vessel {
		this.ignoreNewOnRejoin = ignoreNew
		this.loadSettings()
		this.index.mergewithlocal()
		this._server = new VesselServer(this, this.nid.host, this.nid.port)
		this._setupready = this.setupEvents()
		this.afterOnline = async () => {
			const indices: [IndexArray, Proxy][] = []
			for (const p of this.proxylist) {
				const index = await p.fetchIndex()
				if (index) indices.push([index, p])
			}
			this.updateCargo(indices)
		}
		return this
	}

	join(nid: NID, ignoreLocal = true): Vessel {
		this.ignoreNewOnRejoin = ignoreLocal
		this._server = new VesselServer(this, this.nid.host, this.nid.port)
		this._setupready = this.setupEvents()
		this.afterOnline = () => this.joinvia(nid)
		return this
	}

	new(sharetype: ST): Vessel {
		this._server = new VesselServer(this, this.nid.host, this.nid.port)
		this._sharetype = sharetype
		this.permissions = PermissionManager.defaultPerms(sharetype)
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

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
			this._watcher = chokidar("", {
				cwd: abspath(this.root),
				disableGlobbing: true,
				ignored: this.ignored,
				ignoreInitial: this.ignoreNewOnRejoin,
				awaitWriteFinish: { stabilityThreshold: 1000 },
				ignorePermissionErrors: true,
			})
				.on("add", (path: string) => this.apply(path, IT.File, AT.Add))
				.on("change", (path: string) => this.apply(path, IT.File, AT.Change))
				.on("unlink", (path: string) => this.apply(path, IT.File, AT.Remove))
				.on("addDir", (path: string) => this.apply(path, IT.Dir, AT.Add))
				.on("unlinkDir", (path: string) => this.apply(path, IT.Dir, AT.Remove))
				.on("error", e =>
					this.logger(this.loggerconf.error, "ERROR", e.message)
				) // BUG: when empty folder gets deleted throws error
				.on("ready", () => {
					this.init = false
					this.apply = this.applyLocal
					this.index.save()
					this.logger(this.loggerconf.ready, "PLVS VLTRA!")
					resolve()
					/* // FIX: needs delay in case for ongoing apply(s) to finish 
					setTimeout(() => {
						this.init = false
						this.apply = this.applyLocal
						this.index.save()
						this.logger(this.loggerconf.ready, "PLVS VLTRA!")
						resolve()
					}, 2000)*/
				})
		})
	}

	private async applyInit(path: string, type: IT, action: AT): Promise<void> {
		if (path === "") return
		if (!this.permissions.write) return
		if (!this.init) return
		if (action !== AT.Add) return

		const item = CargoList.Item(path, type, action, this.user)
		item.lastModified = this.store.lastmodified(item) ?? ct()
		this.onlocal.add(item.id)

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
		item.lastModified = this.store.lastmodified(item) ?? ct()

		if (type === IT.File && action !== AT.Remove)
			item.hash = await this.store.computehash(item)

		this.checkIfExisting(item)
		this.checkIfLocal(item)
		const toDelay = false
		this.checkForMoved

		// Assuming no local conflicts
		const resarr = this.index.apply(item)
		if (resarr.length > 1) throw Error("local conflicts")
		this.index.save()

		this.logger(this.loggerconf.local, "->", action, item.path)
		if (!this.online) return
		if (toDelay) setTimeout(() => this.broadcast(item), 2000)
		else this.broadcast(item)
	}

	private checkIfExisting(item: Item): void {
		if (item.lastAction === AT.Add) return
		const latest = this.index.getLatest(item.path)
		if (!latest) throw Error()
		item.id = latest.id
		item.clock = increment(latest.clock, this.user)
		if (item.type === IT.File && item.lastAction === AT.Remove)
			item.hash = latest.hash
	}

	private checkIfLocal(item: Item): void {
		switch (item.lastAction) {
			case AT.Add:
				this.onlocal.add(item.id)
				return
			case AT.Change:
				this.onlocal.add(item.id)
				return
			case AT.Remove:
				this.onlocal.delete(item.id)
				return
			case AT.MovedFrom:
				this.onlocal.delete(item.id)
				return
			case AT.MovedTo:
				this.onlocal.add(item.id)
				return
		}
	}

	private checkForMoved(item: Item): boolean {
		const key = item.hash ?? item.path
		switch (item.lastAction) {
			case AT.Add: {
				const potmoved = this.potmovefiles.get(key)
				if (!potmoved) return false
				item.id = potmoved.id
				item.clock = increment(potmoved.clock, this.user)
				item.lastAction = AT.MovedTo
				potmoved.lastAction = AT.MovedFrom
				potmoved.tomb = { type: TombType.Moved, movedTo: item.path }
				this.potmovefiles.delete(key)
				return true
			}
			case AT.Remove:
				this.potmovefiles.set(key, item)
				setTimeout(() => this.potmovefiles.delete(key), 5000)
				return true
			default:
				return false
		}
	}

	private broadcast(item: Item): void {
		this.proxylist.broadcast(item, this.getRS(item) ?? undefined)
	}

	applyIncoming(item: Item, rs?: NodeJS.ReadableStream): void {
		if (!this.permissions.read) return

		this.logger(this.loggerconf.remote, "<-", item.lastAction, item.path)
		this.index.apply(item).forEach(res => {
			/*
			if (res.after.lastAction === AT.MovedTo) return
			if (res.new && res.after.lastAction === AT.MovedFrom) {
				if (!res.after.tomb?.movedTo) throw Error()
				this.moveFile(res.after, this.index.dig(res.after))
			*/
			if (res.new) this.applyIO(res.after, rs)
			else if (res.rename && res.before) this.moveFile(res.before, res.after)
			else throw Error()
		})
		this.index.save()

		//TODO: forward to known peers
	}

	private moveFile(from: Item, to: Item): void {
		this.checkIfLocal(from)
		this.checkIfLocal(to)
		this.skiplist.add(from.path, 1).add(to.path, 1)
		this.store.move(from, to).then(written => {
			if (written) return
			this.skiplist.reduce(from.path)
			this.skiplist.reduce(to.path)
		})
		setTimeout(() => {
			this.skiplist.delete(from.path)
			this.skiplist.delete(to.path)
		}, 10000)
	}

	private applyIO(item: Item, rs?: NodeJS.ReadableStream): void {
		this.checkIfLocal(item)
		this.skiplist.add(item.path, 2) // BUG: need to test
		if (item.type === IT.Dir && !this.store.applyFolderIO(item))
			this.skiplist.reduce(item.path)
		else if (item.type === IT.File && !this.store.applyFileIO(item, rs))
			this.skiplist.reduce(item.path)
		setTimeout(() => this.skiplist.delete(item.path), 10000)
	}

	getRS(item: Item): NodeJS.ReadableStream | null {
		const latest = this.index.dig(item)
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
			if (res.rename && !res.new && res.before)
				this.moveFile(res.before, res.after)
		})

		ressarr.forEach(([res, p]) => {
			if (!res.new) return
			p.fetchItems([res.before ?? res.after]).forEach(async prs =>
				this.applyIO(res.after, (await prs) ?? undefined)
			)
		})

		this.index.save()
	}

	requestPerm(nid: NID, perm: PERMISSION): void {
		this.permreqlist.push({ nid, perm })
	}

	grantPerm(i: number): void {
		const grantreq = this.permreqlist.splice(i)[0]
		const p = this.proxylist.get(grantreq.nid)
		if (!p) throw Error("Vessel.grantPerm: proxy not found")
		p.grantPerm({ priv: grantreq.perm, grant: true })
	}

	setPerm(pg: PermissionGrant): void {
		if (!pg.grant) return
		switch (pg.priv) {
			case PERMISSION.READ:
				this.permissions.read = pg.grant
				return
			case PERMISSION.WRITE:
				this.permissions.write = pg.grant
				return
		}
	}

	invite(nid: NID): Invite | null {
		if (!this.isAdmin) return null
		const invite: Invite = {
			sharetype: this.sharetype,
			peers: this.proxylist.serialize().map(p => p.nid),
			perms: PermissionManager.defaultPerms(this.sharetype),
		}
		this.proxylist.addNode(Medium.http, { nid })
		this.saveSettings()
		return invite
	}

	checkIndexVer(nid: NID, id: string): IndexArray | null {
		if (this.index.verEq(id)) return null
		const p = this.proxylist.get(nid)
		if (!p) throw Error("Vessel.grantPerm: proxy not found")
		Promise.resolve(p.fetchIndex()).then(index => {
			if (index) this.updateCargo([[index, p]])
		})
		return this.getIndexArray()
	}
}
