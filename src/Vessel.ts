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
	ReadStream,
} from "fs"
import { join } from "path"
import { v4 as uuid4 } from "uuid"
import { ABCVessel } from "./Proxies/ABCVessel"
import CargoList from "./CargoList"
import { ItemTypes, ActionTypes, Medium, TombTypes } from "./enums"
import {
	Item,
	NID,
	SerializedIndex,
	Streamable,
	StreamCreator,
} from "./interfaces"
import NetworkInterface from "./NetworkInterface"
import { cts, ct, computehash } from "./utils"
import Proxy from "./Proxies/Proxy"
import LocalProxy from "./Proxies/LocalProxy"
import HTTPProxy from "./Proxies/HTTPProxy"
import VesselServer from "./VesselServer"

/**
 * TODO
 * - since mem footprint is not really an issue, at least for small amount of files, 4000 files is about 0.5 MB
 * 	 the crdt can be treated as an state-based crdt during network init and rejoin
 *   and as an operation-based when online (need log for transmission gurantee) (or even just send whole state in updates)
 * - matching file hashes needs to be handled differently
 * - folder logic in CargoList is a mess
 * - tombs are not carried over http -> index assertion fails
 *
 */
export default class Vessel extends ABCVessel {
	user: string
	root: string
	rooti: number
	tableEnd = "indextable.json"
	tablePath = "indextable.json"
	watcher: FSWatcher
	index: CargoList
	skiplist = new Set<string>()
	//log = new Log()
	init = true
	networkinterface = new NetworkInterface()
	network: Vessel[] = []
	server: VesselServer

	localtempfilehashes = new Map<string, string>()

	constructor(user: string, root: string) {
		super()
		this.user = user

		this.root = root
		this.rooti = root.length
		this.tablePath = join(root, this.tableEnd)

		this.index = new CargoList(root)

		this.watcher = chokidar(root, { persistent: true })
		this.setupEvents()

		const nid = this.nid()
		this.server = new VesselServer(this, nid.ip, nid.port)
	}

	private nid(): NID {
		return this.networkinterface.nid
	}

	rejoin(): Vessel {
		this.index.mergewithlocal()
		this.server.listen()
		return this
	}

	startnew() {}

	load() {}
	save() {}

	private removeRoot(path: string): string {
		return path.substring(this.rooti)
	}

	private logger(...msg: any[]): void {
		console.log(cts(), ...msg)
	}

	private setupEvents() {
		this.watcher
			.on("add", (path: string) =>
				this.applyLocal(path, ItemTypes.File, ActionTypes.Add)
			)
			.on("change", (path: string) =>
				this.applyLocal(path, ItemTypes.File, ActionTypes.Change)
			)
			.on("unlink", (path: string) =>
				this.applyLocal(path, ItemTypes.File, ActionTypes.Remove)
			)
			.on("addDir", (path: string) =>
				this.applyLocal(path, ItemTypes.Folder, ActionTypes.Add)
			)
			.on("unlinkDir", (path: string) =>
				this.applyLocal(path, ItemTypes.Folder, ActionTypes.Remove)
			)
			.on("error", (error: any) => this.logger("error", error))
			.on("ready", () => {
				// ready: gets called AFTER all initial files are added
				this.init = false
				this.index.save()
				this.logger(this.user, "PLVS VLTRA!")
				//this.logger(this.log.history)
			})
	}

	private applyLocal(path: string, type: ItemTypes, action: ActionTypes) {
		if (this.skiplist.delete(path)) return
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

		if (type === ItemTypes.File && action === ActionTypes.Remove) {
			const newpath = this.localtempfilehashes.get(item.hash ?? "") ?? "" //TODO
			item.tomb = { type: TombTypes.Moved, movedTo: newpath }
			this.localtempfilehashes.delete(item.hash ?? "")
		} else if (
			type === ItemTypes.File &&
			(action === ActionTypes.Add || action === ActionTypes.Change)
		)
			item.hash = computehash(path)

		//this.log.push(item, this.user)
		const applied = this.index.apply(item)
		this.logger(this.user, action, path, applied)
		if (/*!applied ||*/ this.init) return

		this.localtempfilehashes.set(item.hash ?? "", item.path) // TODO
		this.index.save()

		this.networkinterface.broadcast(item, this.createRS(item))
	}

	applyIncoming(item: Item, rs?: Streamable): void {
		const applied = this.index.apply(item)
		this.logger(this.user, "REMOTE", item.lastAction, item.path)
		if (!applied) return

		const full = join(this.root, item.path)
		if (item.type === ItemTypes.Folder) this.applyFolderIO(item, full)
		else if (item.type === ItemTypes.File) this.applyFileIO(item, full, rs)

		this.index.save()
	}

	private applyFolderIO(item: Item, fullpath: string): void {
		if (item.lastAction === ActionTypes.Remove && existsSync(fullpath)) {
			this.skiplist.add(fullpath)
			rmdirSync(fullpath, { recursive: true })
		} else if (item.lastAction === ActionTypes.Add && !existsSync(fullpath)) {
			this.skiplist.add(fullpath)
			mkdirSync(fullpath, { recursive: true })
		} else throw Error("Vessel.applyFolderIO: illegal argument")
	}

	private applyFileIO(item: Item, fullpath: string, rs?: Streamable) {
		if (item.lastAction === ActionTypes.Remove && existsSync(fullpath)) {
			this.skiplist.add(fullpath)
			rmSync(fullpath)
		} else {
			this.skiplist.add(fullpath)
			rs?.pipe(createWriteStream(fullpath))
		}
	}

	createRS(item: Item): Streamable {
		this.logger(this.user, "REMOTE", "UP")
		return item.type === ItemTypes.Folder ||
			item.lastAction === ActionTypes.Remove
			? null
			: createReadStream(join(this.root, item.path))
	}

	addVessel(type: Medium, data: { vessel?: Vessel; nid?: NID }): void {
		const proxy = this.networkinterface.addNode(type, data)
		if (!(proxy instanceof LocalProxy || proxy instanceof HTTPProxy))
			throw Error(`Vessel.addVessel: ${proxy.constructor.name} not implemented`)

		Promise.resolve(proxy.fetchIndex()).then(value =>
			this.updateCargo(value, proxy)
		)
	}

	private updateCargo(
		data: SerializedIndex | Promise<SerializedIndex>,
		proxy: Proxy
	): void {
		this.logger(this.user, "REMOTE", "DWN")

		Promise.resolve(data).then(arr => {
			const items = arr.flatMap(kv => kv[1]).filter(i => this.index.apply(i))

			proxy.fetch(items).forEach((pr, i) => {
				const item = items[i]
				const full = join(this.root, item.path)
				if (item.type === ItemTypes.Folder) this.applyFolderIO(item, full)
				else if (item.type === ItemTypes.File)
					Promise.resolve(pr).then(rs => this.applyFileIO(item, full, rs))
			})
			this.index.save()
		})
	}
}

if (require.main === module)
	new Vessel("frank", join("testroot", "dave", "root")).rejoin()
