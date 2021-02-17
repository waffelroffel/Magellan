import { existsSync, readFileSync, writeFileSync, readdirSync } from "fs"
import { join } from "path"
import { v4 as uuid4 } from "uuid"
import { FileResolveOption, ItemTypes, ActionTypes, TombTypes } from "./enums"
import {
	Item,
	FileResolveMap,
	FileRPConfig,
	SerializedIndex,
} from "./interfaces"
import makemap, { LWWConfig } from "./ResolvePolicies/FileResolvePolicies"
import { computehash, ct } from "./utils"

const tempuser = "bob"
/**
 * Simple-LWW: all operations are ADD, REM, and CHG. Concurrent file movements will create duplicates across the system
 *
 * Advanced-LWW: MOV and REN operations are tracked
 *
 * With dups: duplicate files from concurrent ADD or MOV keeps all
 */
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

	testGet(): Map<string, Item[]> {
		return this.index
	}

	asArray(): SerializedIndex {
		return [...this.index]
	}

	serialize(): string {
		return JSON.stringify([...this.index])
	}

	save(): void {
		writeFileSync(this.indexpath, this.serialize()) // change to proper json {data:[...this.index]}
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
		) as SerializedIndex
		oldindex.forEach(([k, v]) => v.forEach(i => this.apply(i)))
		this.save()
	}

	apply(item: Item): boolean {
		if (item.type === ItemTypes.File) {
			if (item.lastAction === ActionTypes.Add) return this.applyADDFile(item)
			if (item.lastAction === ActionTypes.Remove)
				return this.applyREMOVEFile(item)
			if (item.lastAction === ActionTypes.Change)
				return this.applyCHANGEFile(item)
		}
		if (item.lastAction === ActionTypes.Add) return this.applyADDFolder(item)
		if (item.lastAction === ActionTypes.Remove)
			return this.applyREMOVEFolder(item)
		if (item.lastAction === ActionTypes.Change)
			throw Error("CargoList.apply: illegal argument (folder CHG)")
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
		return this.index.get(item.path)?.find(n => n.uuid === item.uuid) ?? null
	}

	findbyhash(path: string, hash: string): Item | null {
		return this.index.get(path)?.find(n => n.hash === hash) ?? null
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
			return pushed || n === 1
		}
		if (olditem.lastAction === ActionTypes.Remove) {
			const [item, n] = this.rsfile.addrem(olditem, newitem)
			this.update(item, this.rsfilep.get("remrem"))
			return pushed || n === 1
		}
		if (olditem.lastAction === ActionTypes.Change) {
			const [item, n] = this.rsfile.addchg(olditem, newitem)
			this.update(item, this.rsfilep.get("remchg"))
			return pushed || n === 1
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
			return pushed || n === 1
		}
		if (olditem.lastAction === ActionTypes.Remove) {
			const [item, n] = this.rsfile.addrem(olditem, newitem)
			this.update(item, this.rsfilep.get("remchg"))
			return pushed || n === 1
		}
		if (olditem.lastAction === ActionTypes.Change) {
			const [item, n] = this.rsfile.addchg(olditem, newitem)
			this.update(item, this.rsfilep.get("chgchg"))
			return pushed || n === 1
		}
		return false
	}

	private applyADDFolder(newitem: Item): boolean {
		if (newitem.path === this.indexpath) return false
		let olditem = this.getLatest(newitem.path) // TODO get back to it later
		let pushed = false

		if (!olditem) {
			this.push(newitem)
			olditem = newitem
			pushed = true
		}
		if (olditem.lastAction === ActionTypes.Add) {
			// TODO: change to new entry instead of overwriting old
			const cond =
				olditem.lastModified !== newitem.lastModified
					? olditem.lastModified > newitem.lastModified
					: olditem.lastActionBy > newitem.lastActionBy
			if (cond) Object.assign(olditem, newitem)
			return pushed || false // TODO: clean
		}
		if (olditem.lastAction === ActionTypes.Remove) {
			const cond =
				olditem.lastModified !== newitem.lastModified
					? olditem.lastModified > newitem.lastModified
					: olditem.lastActionBy > newitem.lastActionBy
			if (cond) Object.assign(olditem, newitem)
			return pushed || cond
		}
		if (olditem.lastAction === ActionTypes.Change)
			throw Error("CargoList.applyADDFolder: olditem.lastAction === CHG")
		return false
	}

	private applyREMOVEFolder(newitem: Item): boolean {
		if (newitem.path === this.indexpath) return false
		let olditem = this.find(newitem)
		let pushed = false

		if (!olditem) {
			this.push(newitem)
			olditem = newitem
			pushed = true
		}
		if (olditem.lastAction === ActionTypes.Add) {
			let cond =
				olditem.lastModified !== newitem.lastModified
					? olditem.lastModified > newitem.lastModified
					: olditem.lastActionBy > newitem.lastActionBy
			if (olditem === newitem) cond = true // TODO: this is a mess
			if (cond) Object.assign(olditem, newitem)
			return pushed || cond
		}
		if (olditem.lastAction === ActionTypes.Remove) {
			const cond =
				olditem.lastModified !== newitem.lastModified
					? olditem.lastModified > newitem.lastModified
					: olditem.lastActionBy > newitem.lastActionBy
			if (cond) Object.assign(olditem, newitem)
			return pushed || false // TODO: clean
		}
		if (olditem.lastAction === ActionTypes.Change)
			throw Error("CargoList.applyREMOVEFolder: olditem.lastAction === CHG")
		return false
	}
}
