import {
	existsSync,
	lstatSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "fs"
import { join } from "path"
import { v4 as uuid4 } from "uuid"
import makemap, {
	FileResolveMap,
	FileResolveOption,
	FileRPConfig,
	LWWConfig,
} from "./ResolvePolicies/FileResolvePolicies"
import { ct } from "./utils"

export const enum ItemTypes {
	//RootFolder,
	//RootFile,
	Folder,
	File,
}

const enum TombTypes {
	Moved,
	Renamed,
	Deleted,
}

export const enum ActionTypes {
	Add = "ADD",
	Remove = "REM",
	Move = "MOV",
	Change = "CHG",
	Rename = "RNM",
}
interface Tomb {
	type: TombTypes
	movedTo?: string
}

export interface Item {
	path: string
	uuid: string // Buffer
	type: ItemTypes
	lastModified: number
	lastAction: ActionTypes // TODO: referrence to LOG/ LogItem id
	lastActionBy: string
	onDevice?: boolean
	tomb?: Tomb
	creator?: string //TODO
	reachable?: boolean //TODO
}

const tempuser = "bob"
export default class CargoList {
	private index: Map<string, Item[]>
	private indexpath: string
	private rootpath: string
	private tablefile: string = "indextable.json"
	private rsfile: FileResolveMap
	private rsfilep: Map<string, FileResolveOption>
	//private rsfolfer =
	//private duppolicy = 0 // 0: latest timestamp wins, 1: deterministic rename one

	constructor(root: string, fileconfig?: FileRPConfig) {
		this.index = new Map()
		this.rootpath = root
		this.indexpath = join(root, this.tablefile)
		const rs = makemap(fileconfig ?? LWWConfig)
		this.rsfile = rs[0]
		this.rsfilep = rs[1]
	}

	// TODO: remove in favor of mergewithfile
	load(): void {
		if (!existsSync(this.indexpath)) return
		this.index = new Map(
			JSON.parse(readFileSync(this.indexpath, { encoding: "utf8" }))
		)
	}

	save(): void {
		writeFileSync(this.indexpath, JSON.stringify([...this.index])) // change to proper json {data:[...this.index]}
	}

	show(): void {
		console.log(this.index)
	}

	/**
	 * only call during creation of network
	 * @param items
	 */
	init(items: Item[]): void {
		items.forEach(i => this.index.set(i.path, [i]))
		this.index.delete(this.indexpath)
	}

	initfromroot(): void {
		const ts = ct()
		const _init = (root: string) => {
			readdirSync(root, { withFileTypes: true }).forEach(d => {
				if (d.isFile() && d.name !== this.tablefile) {
					this.push(
						CargoList.newItem(
							join(root, d.name),
							uuid4(),
							ItemTypes.File,
							ts,
							ActionTypes.Add,
							tempuser
						)
					)
				} else if (d.isDirectory()) {
					this.push(
						CargoList.newItem(
							join(root, d.name),
							uuid4(),
							ItemTypes.Folder,
							ts,
							ActionTypes.Add,
							tempuser
						)
					)
					_init(join(root, d.name))
				}
			})
		}

		_init(this.rootpath)
	}

	static newItem(
		path: string,
		uuid: string,
		type: ItemTypes,
		ts: number,
		action: ActionTypes,
		user: string
	): Item {
		const item: Item = {
			path,
			uuid,
			type,
			lastModified: ts,
			lastAction: action,
			lastActionBy: user,
		}
		if (action === ActionTypes.Remove) item.tomb = { type: TombTypes.Deleted }
		return item
	}

	[Symbol.iterator](): IterableIterator<Item[]> {
		return this.index.values()
	}

	get(k: string): Item[] | undefined {
		return this.index.get(k)
	}

	set(k: string, v: Item[]): void {
		this.index.set(k, v)
	}

	/**
	 * @deprecated Remove soon
	 */
	merge(v: Item[]): void {
		v.forEach(ri => this.apply(ri))
	}

	// TODO: need testing
	mergewithlocal(): void {
		if (!existsSync(this.indexpath)) return
		const oldindex = JSON.parse(
			readFileSync(this.indexpath, { encoding: "utf8" })
		) as [string, Item][]
		oldindex.forEach(([k, v]) => this.apply(v))
		this.save()
	}

	apply(remoteitem: Item): boolean {
		if (remoteitem.type === ItemTypes.File) {
			if (remoteitem.lastAction === ActionTypes.Add)
				return this.applyADDFile(remoteitem)
			if (remoteitem.lastAction === ActionTypes.Remove)
				return this.applyREMOVEFile(remoteitem)
			if (remoteitem.lastAction === ActionTypes.Change)
				return this.applyCHANGEFile(remoteitem)
		}
		if (remoteitem.lastAction === ActionTypes.Add)
			return this.applyADDFolder(remoteitem)
		if (remoteitem.lastAction === ActionTypes.Remove)
			return this.applyREMOVEFolder(remoteitem)
		if (remoteitem.lastAction === ActionTypes.Change)
			throw Error("Folder CHG should not be happening")
		return false
	}

	getLatest(path: string): Item | null {
		return (
			this.index
				.get(path)
				?.reduce((a, b) => (a.lastModified > b.lastModified ? a : b)) ?? null
		)
	}

	private find(item: Item): Item | null {
		const list = this.index.get(item.path)
		const it = list?.find(n => n.uuid === item.uuid)
		return it ?? null
	}

	private push(item: Item): void {
		const itemlist = this.index.get(item.path)
		if (itemlist === undefined) this.index.set(item.path, [item])
		else itemlist.push(item)
	}

	private update(newitem: Item, rp: FileResolveOption | undefined): void {
		if (rp === FileResolveOption.LWW) {
			this.set(newitem.path, [newitem])
			return
		}
		const itemlist = this.index.get(newitem.path)
		if (!itemlist) return
		const i = itemlist.findIndex(olditem => olditem.uuid === newitem.uuid)
		if (i === -1) return
		itemlist[i] = newitem
	}

	private applyADDFile(newitem: Item): boolean {
		if (newitem.path === this.indexpath) return false
		let olditem = this.find(newitem) // ?? newitem
		let pushed = false

		if (!olditem) {
			// remove, include in update
			this.push(newitem)
			olditem = newitem
			pushed = true
		}
		if (olditem.lastAction === ActionTypes.Add) {
			const [item, n] = this.rsfile.addadd(olditem, newitem)
			this.update(item, this.rsfilep.get("addadd"))
			return pushed || n === 1
		}
		if (olditem.lastAction === ActionTypes.Remove) {
			const [item, n] = this.rsfile.addrem(olditem, newitem)
			this.update(item, this.rsfilep.get("addrem"))
			return pushed || n === 1
		}
		if (olditem.lastAction === ActionTypes.Change) {
			const [item, n] = this.rsfile.addchg(olditem, newitem)
			this.update(item, this.rsfilep.get("addchg"))
			return pushed || n === 1
		}
		return pushed
	}

	private applyREMOVEFile(newitem: Item): boolean {
		if (newitem.path === this.indexpath) return false
		let olditem = this.find(newitem)
		let pushed = false

		if (!olditem) {
			this.push(newitem)
			olditem = newitem
			pushed = true
		}
		if (olditem.lastAction === ActionTypes.Add) {
			const [item, n] = this.rsfile.addadd(olditem, newitem)
			this.update(item, this.rsfilep.get("addrem"))
			return n === 1
		}
		if (olditem.lastAction === ActionTypes.Remove) {
			const [item, n] = this.rsfile.addrem(olditem, newitem)
			this.update(item, this.rsfilep.get("remrem"))
			return n === 1
		}
		if (olditem.lastAction === ActionTypes.Change) {
			const [item, n] = this.rsfile.addchg(olditem, newitem)
			this.update(item, this.rsfilep.get("remchg"))
			return n === 1
		}
		return false
	}

	private applyCHANGEFile(newitem: Item): boolean {
		if (newitem.path === this.indexpath) return false
		let olditem = this.find(newitem)
		let pushed = false

		if (!olditem) {
			this.push(newitem)
			olditem = newitem
			pushed = true
		}
		if (olditem.lastAction === ActionTypes.Add) {
			const [item, n] = this.rsfile.addadd(olditem, newitem)
			this.update(item, this.rsfilep.get("addchg"))
			return n === 1
		}
		if (olditem.lastAction === ActionTypes.Remove) {
			const [item, n] = this.rsfile.addrem(olditem, newitem)
			this.update(item, this.rsfilep.get("remchg"))
			return n === 1
		}
		if (olditem.lastAction === ActionTypes.Change) {
			const [item, n] = this.rsfile.addchg(olditem, newitem)
			this.update(item, this.rsfilep.get("chgchg"))
			return n === 1
		}
		return false
	}

	private applyADDFolder(newitem: Item): boolean {
		if (newitem.path === this.indexpath) return false
		const olditem = this.getLatest(newitem.path) // TODO get back to it later

		if (!olditem) {
			this.push(newitem)
			return true
		}
		if (olditem.lastAction === ActionTypes.Add) {
			// TODO: change to new entry instead of overwriting old
			const cond =
				olditem.lastModified !== newitem.lastModified
					? olditem.lastModified > newitem.lastModified
					: olditem.lastActionBy > newitem.lastActionBy
			if (cond) Object.assign(olditem, newitem)
			return false
		}
		if (olditem.lastAction === ActionTypes.Remove) {
			const cond =
				olditem.lastModified !== newitem.lastModified
					? olditem.lastModified > newitem.lastModified
					: olditem.lastActionBy > newitem.lastActionBy
			if (cond) Object.assign(olditem, newitem)
			return cond
		}
		if (olditem.lastAction === ActionTypes.Change) {
			throw Error("Folder CHG->... event should not be happening")
		}
		return false
	}

	private applyREMOVEFolder(newitem: Item): boolean {
		if (newitem.path === this.indexpath) return false
		const olditem = this.find(newitem)

		if (!olditem) {
			this.push(newitem)
			return true
		}
		if (olditem.lastAction === ActionTypes.Add) {
			const cond =
				olditem.lastModified !== newitem.lastModified
					? olditem.lastModified > newitem.lastModified
					: olditem.lastActionBy > newitem.lastActionBy
			if (cond) Object.assign(olditem, newitem)
			return cond
		}
		if (olditem.lastAction === ActionTypes.Remove) {
			const cond =
				olditem.lastModified !== newitem.lastModified
					? olditem.lastModified > newitem.lastModified
					: olditem.lastActionBy > newitem.lastActionBy
			if (cond) Object.assign(olditem, newitem)
			return false
		}
		if (olditem.lastAction === ActionTypes.Change) {
			throw Error("Folder CHG->... event should not be happening")
		}
		return false
	}
}
