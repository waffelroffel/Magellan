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
import Log from "./Log"
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
	log = new Log()
	init = true

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

	rejoin() {
		// for rejoining existing network
	}
	startnew() {
		// when starting a new network
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
			.on("error", (error: any) => this.logger("error", error))
			.on("ready", () => {
				// ready: gets called AFTER all initial files are added
				this.init = false
				this.index.save()
				this.logger(this.user, "PLVS VLTRA!")
				//this.logger(this.log.history)
			})
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
		this.log.push(item, this.user)
		const applied = this.index.apply(item)
		this.logger(this.user, action, path, applied)
		if (!applied || this.init) return
		this.index.save()
		const rs = item.type === ItemTypes.File ? createReadStream(path) : undefined // TODO: fix undefined later
		this.network.forEach(v => v.applyIncoming(item, rs))
	}

	private removeRoot(path: string): string {
		return path.substring(this.rooti)
	}

	private logger(...msg: any[]): void {
		console.log(cts(), ...msg)
	}

	applyIncoming(item: Item, rs?: ReadStream): void {
		const applied = this.index.apply(item)
		this.logger(this.user, "REMOTE", item.lastAction, item.path, applied)
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
		this.index.save()
	}

	updateCargo(index: CargoList, tempvessel: Vessel): void {
		this.logger(this.user, "DWN")
		for (const v of index) {
			v.forEach(i => {
				const reqio = this.index.apply(i)
				if (!reqio) return
				const fullpath = join(this.root, i.path)
				if (i.type === ItemTypes.Folder) {
					this.skiplist.add(fullpath)
					mkdirSync(fullpath, { recursive: true })
				} else if (i.type === ItemTypes.File) {
					this.skiplist.add(fullpath)
					const wr = createWriteStream(fullpath)
					tempvessel.fetchRS(i.path).pipe(wr)
				}
			})
		}
		this.index.save()
	}

	fetchRS(path: string): ReadStream {
		return createReadStream(join(this.root, path)) // TODO: clean stream creation
	}

	async addToNetwork(vessel: Vessel): Promise<void> {
		this.network.push(vessel)
		this.updateCargo(vessel.index, vessel)
		//vessel.updateCargo(this.index)
	}
}

//new Vessel("charlie", join("testroot", "dave", "root"))
