import { existsSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { v4 as uuid4 } from "uuid"
import { ResolveOption, ItemTypes, ActionTypes, TombTypes } from "./enums"
import {
	Item,
	FileResolveMap,
	FileRPConfig,
	IndexArray,
	DirResolveMap,
} from "./interfaces"
import { LWWConfig } from "./ResolvePolicies/defaultconfigs"
import { makefpmap, makedpmap } from "./ResolvePolicies/ResolvePolicies"

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
	private rsfilep: Map<string, ResolveOption>
	private rsdir: DirResolveMap
	private rsdirp: Map<string, ResolveOption>
	//private rsfolfer =
	//private duppolicy = 0 // 0: latest timestamp wins, 1: deterministic rename one

	constructor(root: string, fileconfig?: FileRPConfig) {
		this.index = new Map()
		this.rootpath = root
		this.indexpath = join(root, this.tablefile)
		const frs = makefpmap(fileconfig ?? LWWConfig)
		this.rsfile = frs[0]
		this.rsfilep = frs[1]
		const drs = makedpmap(fileconfig ?? LWWConfig)
		this.rsdir = drs[0]
		this.rsdirp = drs[1]
	}

	testGet(): Map<string, Item[]> {
		return this.index
	}

	asArray(): IndexArray {
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
			actionId: uuid4(),
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
		) as IndexArray
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
		const arr = this.index.get(item.path) // TODO: tombs with MOVED or RENAMED
		return (
			arr?.find(n => n.uuid === item.uuid) ?? // matching id
			arr?.reduce((n1, n2) => (n1.lastModified > n2.lastModified ? n1 : n2)) ?? // latest
			null
		)
	}

	findbyhash(path: string, hash: string): Item | null {
		return this.index.get(path)?.find(n => n.hash === hash) ?? null
	}

	private push(item: Item): void {
		const itemlist = this.index.get(item.path)
		if (itemlist === undefined) this.index.set(item.path, [item])
		else itemlist.push(item)
	}

	private update(newitem: Item, rp: ResolveOption | undefined): void {
		if (rp === ResolveOption.LWW) {
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
		let olditem = this.find(newitem) // TODO get back to it later
		let pushed = false

		if (!olditem) {
			this.push(newitem)
			olditem = newitem
			pushed = true
		}
		if (olditem.lastAction === ActionTypes.Add) {
			const [item, n] = this.rsdir.addadd(olditem, newitem)
			this.update(item, this.rsdirp.get("addadd"))
			return pushed || n === 1
		}
		if (olditem.lastAction === ActionTypes.Remove) {
			const [item, n] = this.rsdir.addrem(olditem, newitem)
			this.update(item, this.rsdirp.get("addrem"))
			return pushed || n === 1
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
			const [item, n] = this.rsdir.addrem(olditem, newitem)
			this.update(item, this.rsdirp.get("addrem"))
			return pushed || n === 1
		}
		if (olditem.lastAction === ActionTypes.Remove) {
			const [item, n] = this.rsdir.remrem(olditem, newitem)
			this.update(item, this.rsdirp.get("remrem"))
			return pushed || n === 1
		}
		if (olditem.lastAction === ActionTypes.Change)
			throw Error("CargoList.applyREMOVEFolder: olditem.lastAction === CHG")
		return false
	}
}
