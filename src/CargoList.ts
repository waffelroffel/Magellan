import { existsSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import {
	ResolveOption as RO,
	ItemType as IT,
	ActionType as AT,
	TombType as TT,
} from "./enums"
import {
	Item,
	FileRPConfig,
	IndexArray,
	DirRPConfig,
	ResolveLogic as RL,
} from "./interfaces"
import { LWWDirConfig, LWWFileConfig } from "./ResolvePolicies/defaultconfigs"
import { makefpmap, makedpmap } from "./ResolvePolicies/ResolvePolicies"
import { Resolution } from "./interfaces"
import { uuid } from "./utils"

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
	private tablefile: string = "indextable.json"
	private rsfile: Map<string, RL>
	private rsfilep: Map<string, RO>
	private rsdir: Map<string, RL>
	private rsdirp: Map<string, RO>

	constructor(
		root: string,
		fileconfig?: FileRPConfig,
		dirconfig?: DirRPConfig
	) {
		this.index = new Map()
		this.indexpath = join(root, this.tablefile)
		const frs = makefpmap(fileconfig ?? LWWFileConfig)
		this.rsfile = frs[0]
		this.rsfilep = frs[1]
		const drs = makedpmap(dirconfig ?? LWWDirConfig)
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
		type: IT,
		ts: number,
		action: AT,
		user: string
	): Item {
		const item: Item = {
			path,
			uuid,
			type,
			lastModified: ts,
			lastAction: action,
			lastActionBy: user,
			actionId: this.genActionId(),
		}

		if (action === AT.Remove) item.tomb = { type: TT.Deleted }
		return item
	}

	// TODO:
	static genActionId(): string {
		return uuid()
	}

	/**
	 * Checking for (type, hash), and (lastAction, tomb)
	 */
	static validateItem(item: Item): boolean {
		if (item.type === IT.Dir && item.hash) return false
		if (item.type === IT.File && !item.hash) return false
		if (item.lastAction === AT.Remove && !item.tomb) return false
		if (item.lastAction !== AT.Remove && item.tomb) return false
		// TODO: add checks for tomb.type and tomb.movedTo for different ActionType
		return true
	}

	// TODO
	mergewithlocal(): void {
		if (!existsSync(this.indexpath))
			throw Error(`CargoList.mergewithlocal: ${this.indexpath} doesn't exist`)
		const oldindex: IndexArray = JSON.parse(
			readFileSync(this.indexpath, { encoding: "utf8" })
		)

		oldindex.forEach(([k, v]) => v.forEach(i => this.apply(i)))
		this.save()
	}

	apply(item: Item): Resolution[] {
		if (item.path === this.indexpath) return []
		if (item.type === IT.File) {
			if (item.lastAction === AT.Add) return this.applyADDFile(item)
			if (item.lastAction === AT.Remove) return this.applyREMOVEFile(item)
			if (item.lastAction === AT.Change) return this.applyCHANGEFile(item)
		}
		if (item.lastAction === AT.Add) return this.applyADDFolder(item)
		if (item.lastAction === AT.Remove) return this.applyREMOVEFolder(item)
		if (item.lastAction === AT.Change)
			throw Error("CargoList.apply: illegal argument (folder CHG)")
		return []
	}

	getLatest(path: string): Item | null {
		return (
			this.index
				.get(path)
				?.reduce((a, b) => (a.lastModified > b.lastModified ? a : b)) ?? null
		)
	}

	findById(item: Item): Item | null {
		return this.index.get(item.path)?.find(i => i.uuid === item.uuid) ?? null
	}

	findbyhash(path: string, hash: string): Item | null {
		return this.index.get(path)?.find(n => n.hash === hash) ?? null
	}

	private push(item: Item): void {
		const itemlist = this.index.get(item.path)
		if (itemlist === undefined) this.index.set(item.path, [item])
		else itemlist.push(item)
	}

	private update(res: Resolution, ro?: RO): void {
		switch (ro) {
			case RO.LWW:
				this.index.set(res.after.path, [res.after])
				return
			case RO.DUP:
				if (!res.before) return this.push(res.after)
				const arr = this.index.get(res.after.path)
				if (!arr) {
					this.push(res.after)
					res.before.lastAction = AT.Remove // TODO: change to rename later
					res.before.tomb = { type: TT.Renamed, movedTo: res.after.path }
					return
				}
				const index = arr.findIndex(i => i.uuid === res.after.uuid)
				if (index === -1) arr.push(res.after)
				else arr[index] = res.after
				res.before.lastAction = AT.Remove // TODO: change to rename later
				res.before.tomb = { type: TT.Renamed, movedTo: res.after.path }
				return
		}
	}

	private getResPol(type: IT, pol: string): [RL, RO] {
		const rl = (type === IT.File ? this.rsfile : this.rsdir).get(pol)
		const ro = (type === IT.File ? this.rsfilep : this.rsdirp).get(pol)
		if (!rl || ro === undefined) throw Error()
		return [rl, ro]
	}

	// TODO: conflicts at dst (res.after.path) need to be considered
	private resolve(oldi: Item, newi: Item, pol: string): Resolution[] {
		const [rl, ro] = this.getResPol(oldi.type, pol)
		if (oldi === newi) {
			const res = { after: newi, io: false, ro, new: true }
			this.update(res, ro)
			return [res]
		}
		if (ro === RO.DUP) this.push(newi)
		const resarr = rl(oldi, newi)
		resarr.forEach(r => this.update(r, ro))
		return resarr
	}

	private applyADDFile(newitem: Item): Resolution[] {
		const olditem = this.getLatest(newitem.path) || newitem

		switch (olditem.lastAction) {
			case AT.Add:
				return this.resolve(olditem, newitem, "addadd")
			case AT.Remove:
				return this.resolve(olditem, newitem, "addrem")
			case AT.Change:
				return this.resolve(olditem, newitem, "addchg")
			default:
				return []
		}
	}

	private applyREMOVEFile(newitem: Item): Resolution[] {
		const olditem = this.getLatest(newitem.path) || newitem

		switch (olditem.lastAction) {
			case AT.Add:
				return this.resolve(olditem, newitem, "addrem")
			case AT.Remove:
				return this.resolve(olditem, newitem, "remrem")
			case AT.Change:
				return this.resolve(olditem, newitem, "remchg")
			default:
				return []
		}
	}

	private applyCHANGEFile(newitem: Item): Resolution[] {
		const olditem = this.getLatest(newitem.path) || newitem

		switch (olditem.lastAction) {
			case AT.Add:
				return this.resolve(olditem, newitem, "addchg")
			case AT.Remove:
				return this.resolve(olditem, newitem, "remchg")
			case AT.Change:
				return this.resolve(olditem, newitem, "chgchg")
			default:
				return []
		}
	}

	private applyADDFolder(newitem: Item): Resolution[] {
		const olditem = this.getLatest(newitem.path) || newitem

		switch (olditem.lastAction) {
			case AT.Add:
				return this.resolve(olditem, newitem, "addadd")
			case AT.Remove:
				return this.resolve(olditem, newitem, "addrem")
			case AT.Change:
				throw Error("CargoList.applyADDFolder: olditem.lastAction === CHG")
			default:
				return []
		}
	}

	private applyREMOVEFolder(newitem: Item): Resolution[] {
		const olditem = this.getLatest(newitem.path) || newitem

		switch (olditem.lastAction) {
			case AT.Add:
				return this.resolve(olditem, newitem, "addrem")
			case AT.Remove:
				return this.resolve(olditem, newitem, "remrem")
			case AT.Change:
				throw Error("CargoList.applyREMOVEFolder: olditem.lastAction === CHG")
			default:
				return []
		}
	}
}
