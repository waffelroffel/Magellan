import { FSWatcher, watch as chokidar } from "chokidar"
import {
	createReadStream,
	createWriteStream,
	existsSync,
	lstatSync,
	mkdirSync,
	ReadStream,
} from "fs"
import { join } from "path"
import { v4 as uuid4 } from "uuid"
import CargoList, { ActionTypes, Item, ItemTypes } from "./CargoList"
import { ct, cts } from "./utils"

export default class Vessel {
	user: string
	root: string
	rooti: number
	tableEnd = "indextable.json"
	tablePath = "indextable.json"
	watcher: FSWatcher
	index: CargoList
	skiplist = new Set<string>()

	network: Vessel[] = []

	constructor(user: string, root: string) {
		this.user = user

		this.root = root
		this.rooti = root.length
		this.tablePath = join(root, this.tableEnd)

		this.index = new CargoList(root)
		this.watcher = chokidar(root, { persistent: true })

		this.setupEvents()
	}

	private setupEvents() {
		this.watcher
			.on(
				"add",
				(path: string) =>
					this.passToIndex(path, ItemTypes.File, ActionTypes.Add, 0)
				// always new
				// duplicate == overwrite (old deleted)
			)
			.on(
				"change",
				(path: string) =>
					this.passToIndex(path, ItemTypes.File, ActionTypes.Change, 1)
				// update old
			)
			.on(
				"unlink",
				(path: string) =>
					this.passToIndex(path, ItemTypes.File, ActionTypes.Remove, 0)
				// always remove existing
			)
			.on(
				"addDir",
				(path: string) =>
					this.passToIndex(path, ItemTypes.Folder, ActionTypes.Add, 0)
				// always new
				// duplicate == overwrite (old deleted)
			)
			.on(
				"unlinkDir",
				(path: string) =>
					this.passToIndex(path, ItemTypes.Folder, ActionTypes.Remove, 0)
				// always remove existing
			)
			.on("error", (error: any) => this.log("error", error))
			.on("ready", () => this.log(this.user, "PLVS VLTRA!"))
		// ready: gets called after all initial files are added
	}

	private passToIndex(
		path: string,
		type: ItemTypes,
		action: ActionTypes,
		mode: number
	) {
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
		if (mode === 1) {
			const latest = this.index.getLatest(this.removeRoot(path))
			if (latest) item.uuid = latest.uuid
		}

		// this.index.getLatest(path) ?? CargoList...
		// change must update local (onDevice) if possible, add can update or extend depending on the resolve policy
		const applied = this.index.apply(item)
		this.log(this.user, action, path, applied)
		if (!applied) return
		this.index.save() // temp disable save during init
		const rs = item.type === ItemTypes.File ? createReadStream(path) : undefined // TODO: fix later
		this.network.forEach(v => v.applyIncoming(item, rs))
	}

	private removeRoot(path: string): string {
		return path.substring(this.rooti)
	}

	private log(...msg: any[]): void {
		console.log(cts(), ...msg)
	}

	applyIncoming(item: Item, rs?: ReadStream): void {
		console.log(item)
		const applied = this.index.apply(item)
		this.log(this.user, "REMOTE", item.lastAction, item.path, applied)
		if (!applied) return
		const fullpath = join(this.root, item.path)
		if (item.type === ItemTypes.Folder && !existsSync(fullpath)) {
			this.skiplist.add(fullpath)
			mkdirSync(fullpath)
		} else if (item.type === ItemTypes.File) {
			// include logic for existing
			this.skiplist.add(fullpath)
			rs?.pipe(createWriteStream(fullpath))
		}
	}

	addToNetwork(vessel: Vessel) {
		this.network.push(vessel)
	}
}
//new Vessel("charlie", join("testroot", "dir1", "root"))
