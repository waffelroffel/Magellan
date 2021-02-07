import { FSWatcher, watch as chokidar } from "chokidar"
import {
	createReadStream,
	createWriteStream,
	existsSync,
	mkdirSync,
	ReadStream,
	rmdirSync,
	rmSync,
} from "fs"
import { join } from "path"
import { v4 as uuid4 } from "uuid"
import { ABCVessel } from "./ABCVessel"
import CargoList, { ActionTypes, Item, ItemTypes } from "./CargoList"
import Log from "./Log"
import NetworkInterface, { Medium, Streamable } from "./NetworkInterface"
import { ct, cts } from "./utils"

/**
 * TODO
 * - since mem footprint is not really an issue, at least for small amount of files, 4000 files is about 0.5 MB
 * 	 the crdt can be treated as an state-based crdt during network init and rejoin
 *   and as an operation-based when online (need log for transmission gurantee) (or even just send whole state in updates)
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

	constructor(user: string, root: string) {
		super()
		this.user = user

		this.root = root
		this.rooti = root.length
		this.tablePath = join(root, this.tableEnd)

		this.index = new CargoList(root)

		this.watcher = chokidar(root, { persistent: true })
		this.setupEvents()
	}

	rejoin(): Vessel {
		this.index.mergewithlocal()
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
		item.uuid = this.index.getLatest(item.path)?.uuid ?? item.uuid

		//this.log.push(item, this.user)
		const applied = this.index.apply(item)
		this.logger(this.user, action, path, applied)
		if (!applied || this.init) return

		this.index.save()

		const rs =
			item.type === ItemTypes.File && item.lastAction !== ActionTypes.Remove
				? this.createRS(item.path)
				: null
		this.networkinterface.broadcast(this.networkinterface.nid(), item, rs)
	}

	applyIncoming(item: Item, rs?: Streamable): void {
		const applied = this.index.apply(item)
		this.logger(this.user, "REMOTE", item.lastAction, item.path, applied)
		if (!applied) return

		const fullpath = join(this.root, item.path)
		if (item.type === ItemTypes.Folder) this.applyFolderIO(item, fullpath)
		else if (item.type === ItemTypes.File) this.applyFileIO(item, fullpath, rs)

		this.index.save()
	}

	private applyFolderIO(item: Item, fullpath: string) {
		if (item.lastAction !== ActionTypes.Remove && existsSync(fullpath)) {
			this.skiplist.add(fullpath)
			rmdirSync(fullpath, { recursive: true })
		} else if (item.lastAction !== ActionTypes.Add && !existsSync(fullpath)) {
			this.skiplist.add(fullpath)
			mkdirSync(fullpath, { recursive: true })
		}
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

	updateCargo(index: CargoList, proxy: ABCVessel): void {
		this.logger(this.user, "DWN")
		for (const v of index) {
			v.forEach(i => {
				const applied = this.index.apply(i)
				if (!applied) return

				const fullpath = join(this.root, i.path)
				this.skiplist.add(fullpath)

				if (i.type === ItemTypes.Folder) this.applyFolderIO(i, fullpath)
				else if (i.type === ItemTypes.File)
					this.applyFileIO(i, fullpath, proxy.createRS(i.path))
			})
		}
		this.index.save()
	}

	createRS(path: string) {
		return createReadStream(join(this.root, path))
	}

	async addVesselToNetwork(vessel: Vessel): Promise<void> {
		const temp = { ip: `local:${this.user}`, port: `local:${this.user}` }
		const proxy = this.networkinterface.addNode(temp, Medium.local, vessel)
		const index = proxy.fetchIndex(this.networkinterface.nid())
		if (index instanceof CargoList) this.updateCargo(index, proxy)
	}
}

//new Vessel("charlie", join("testroot", "dave", "root"))
