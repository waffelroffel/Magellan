import { watch as chokidar } from "chokidar"
import {
	FSWatcher,
	existsSync,
	rmdirSync,
	mkdirSync,
	rmSync,
	createWriteStream,
	createReadStream,
} from "fs"
import { join } from "path"
import { v4 as uuid4 } from "uuid"
import { ABCVessel } from "./Proxies/ABCVessel"
import CargoList from "./CargoList"
import { ItemTypes, ActionTypes, Medium } from "./enums"
import { Item, NID, Streamable, StreamCreator } from "./interfaces"
import NetworkInterface from "./NetworkInterface"
import { cts, ct } from "./utils"
import Proxy from "./Proxies/Proxy"
import LocalProxy from "./Proxies/LocalProxy"

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

	private nid(): NID {
		return this.networkinterface.nid
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
		item.uuid = this.index.getLatest(item.path)?.uuid ?? item.uuid // TODO: check

		//this.log.push(item, this.user)
		const applied = this.index.apply(item)
		this.logger(this.user, action, path, applied)
		if (!applied || this.init) return

		this.index.save()

		this.networkinterface.broadcast(item, this.createSC(this.root))
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

	private updateCargo(index: CargoList, proxy: Proxy): void {
		this.logger(this.user, "DWN")

		const newitems: Item[] = []
		for (const lst of index)
			lst.forEach(item => (this.index.apply(item) ? newitems.push(item) : null))

		proxy.fetch(newitems, this.nid()).forEach((rs, i) => {
			const item = newitems[i]
			const full = join(this.root, item.path)
			if (item.type === ItemTypes.Folder) this.applyFolderIO(item, full)
			else if (item.type === ItemTypes.File) this.applyFileIO(item, full, rs)
		})

		this.index.save()
	}

	createSC(root: string): StreamCreator {
		// TODO clean
		const sc: StreamCreator = (item, type) => {
			switch (type) {
				case Medium.local:
					return item.type === ItemTypes.File &&
						item.lastAction !== ActionTypes.Remove
						? createReadStream(join(root, item.path))
						: null
				default:
					return null
			}
		}
		return sc
	}

	addLocalVessel(vessel: Vessel): void {
		const proxy = this.networkinterface.addNode(Medium.local, vessel)
		if (proxy instanceof LocalProxy) this.updateCargo(proxy.fetchIndex(), proxy)
		else throw Error("Vessel.addLocalVessel: instance not LocalProxy")
	}
}
