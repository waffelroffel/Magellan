import { existsSync, readFileSync, writeFileSync } from "fs"
import {
	ResolveOption as RO,
	ItemType as IT,
	ActionType as AT,
	TombType as TT,
} from "./enums"
import {
	Item,
	IndexArray,
	ResolveLogic as RL,
	CargoListOptions,
} from "./interfaces"
import { LWWDirConfig, LWWFileConfig } from "./ResolvePolicies/defaultconfigs"
import { makefpmap, makedpmap } from "./ResolvePolicies/ResolvePolicies"
import { Resolution } from "./interfaces"
import { increment, uuid } from "./utils"

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
	private rsfile: Map<string, RL>
	private rsfilep: Map<string, RO>
	private rsdir: Map<string, RL>
	private rsdirp: Map<string, RO>
	private lastActionId = "0"

	get DUMMY(): Item {
		return CargoList.Item("", IT.File, AT.Change, "zzz")
	}

	constructor(indexpath: string, opts?: CargoListOptions) {
		this.index = new Map()
		this.indexpath = indexpath
		const frs = makefpmap(opts?.filerp ?? LWWFileConfig)
		this.rsfile = frs[0]
		this.rsfilep = frs[1]
		const drs = makedpmap(opts?.dirrp ?? LWWDirConfig)
		this.rsdir = drs[0]
		this.rsdirp = drs[1]
	}

	equal(actionid: string): boolean {
		return this.lastActionId === actionid
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

	static Item(path: string, type: IT, action: AT, user: string): Item {
		const item: Item = {
			path,
			id: uuid(),
			type,
			lastModified: 0,
			lastAction: action,
			lastActionBy: user,
			actionId: uuid(),
			//parent: null,
			//onDevice: false,
			clock: [],
		}
		increment(item.clock, user)
		if (action === AT.Remove) item.tomb = { type: TT.Deleted }
		return item
	}

	/**
	 * Checking for (type, hash), and (lastAction, tomb)
	 */
	static validateItem(item: Item): boolean {
		item
		/*
		if (item.lastAction === AT.Remove && !item.tomb) return false
		if (item.lastAction !== AT.Remove && item.tomb) return false
		if (item.type === IT.Dir && item.hash) return false
		if (item.type === IT.File) {
			if (item.lastAction === AT.Remove && item.hash) return false
			if (item.lastAction !== AT.Remove && !item.hash) return false
		}
		if (item.clock.length === 0) return false
		// TODO: add checks for tomb.type and tomb.movedTo for different ActionType
		// TODO: add checks all enum values (isEnum(...))
		*/
		return true
	}

	mergewithlocal(): void {
		if (!existsSync(this.indexpath))
			throw Error(`CargoList.mergewithlocal: ${this.indexpath} doesn't exist`)
		const oldindex: IndexArray = JSON.parse(
			readFileSync(this.indexpath, { encoding: "utf8" })
		)

		oldindex.forEach(([, arr]) => arr.forEach(i => this.apply(i)))
		this.save()
	}

	apply(item: Item): Resolution[] {
		this.lastActionId = item.actionId
		if (item.path === this.indexpath) return []
		if (item.type === IT.File) {
			if (item.lastAction === AT.Add) return this.applyADDFile(item)
			if (item.lastAction === AT.Remove) return this.applyREMOVEFile(item)
			if (item.lastAction === AT.Change) return this.applyCHANGEFile(item)
			if (item.lastAction === AT.MovedFrom) return this.applyREMOVEFile(item)
			if (item.lastAction === AT.MovedTo) return this.applyADDFile(item)
			else throw Error(`CargoList.apply: illegal action (${item.lastAction})`)
		}
		if (item.lastAction === AT.Add) return this.applyADDFolder(item)
		if (item.lastAction === AT.Remove) return this.applyREMOVEFolder(item)
		else if (item.lastAction === AT.Change)
			throw Error(`CargoList.apply: illegal action (${item.lastAction})`)
		return []
	}

	getLatest(path: string): Item | null {
		const latest = this.index.get(path)?.reduce((a, b) => {
			if (a.tomb && b.tomb) return this.DUMMY
			if (a.tomb) return b
			if (b.tomb) return a
			return a.lastModified > b.lastModified ? a : b
		})
		if (!latest) return null
		return latest === this.DUMMY ? null : latest
	}

	findById(item: Item): Item | null {
		return this.index.get(item.path)?.find(i => i.id === item.id) ?? null
	}

	// TODO: unused
	findbyhash(path: string, hash: string): Item | null {
		return this.index.get(path)?.find(n => n.hash === hash) ?? null
	}

	private push(item: Item): void {
		const itemlist = this.index.get(item.path)
		if (itemlist === undefined) this.index.set(item.path, [item])
		else itemlist.push(item)
	}

	private update(res: Resolution): void {
		switch (res.ro) {
			case RO.LWW: {
				if (!res.new) return
				const arr = this.index.get(res.after.path)
				if (!arr) {
					this.index.set(res.after.path, [res.after])
					return
				}
				const i = arr.findIndex(item => item.id === res.after.id)
				if (i === -1) arr.push(res.after)
				else arr[i] = res.after
				return
			}
			case RO.DUP:
				if (!res.before) throw Error()
				if (res.new) {
					if (res.rename) {
						this.push(res.before)
						res.before.lastAction = AT.MovedFrom
						res.after.lastAction = AT.MovedTo
						res.before.tomb = { type: TT.Moved, movedTo: res.after.path }
						this.push(res.after)
					} else if (res.overwrite) this.push(res.after)
				} else if (res.rename) {
					res.before.lastAction = AT.MovedFrom
					res.after.lastAction = AT.MovedTo
					res.before.tomb = { type: TT.Moved, movedTo: res.after.path }
					this.push(res.after)
				}
		}
	}

	private getResPol(type: IT, pol: string): [RL, RO] {
		const rl = (type === IT.File ? this.rsfile : this.rsdir).get(pol)
		const ro = (type === IT.File ? this.rsfilep : this.rsdirp).get(pol)
		if (!rl || !ro) throw Error()
		return [rl, ro]
	}

	// TODO: conflicts at dst (res.after.path) need to be considered
	private resolve(oldi: Item, newi: Item, pol: string): Resolution[] {
		const _oldi = oldi // this.dig(oldi) // TEST
		const [rl] = this.getResPol(newi.type, pol)
		const resarr = rl(_oldi, newi)
		resarr.forEach(r => this.update(r))
		return resarr
	}

	dig(item: Item): Item {
		if (!item.tomb?.movedTo) return item
		const newi = this.index.get(item.tomb.movedTo)?.find(i => i.id === item.id)
		if (!newi) throw Error("Tomb leads to nowhere")
		return this.dig(newi)
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
			case AT.MovedFrom:
				return this.resolve(olditem, newitem, "addchg")
			case AT.MovedTo:
				return this.resolve(olditem, newitem, "addchg")
			default:
				throw Error(olditem.lastAction)
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
			case AT.MovedFrom:
				return this.resolve(olditem, newitem, "remchg")
			case AT.MovedTo:
				return this.resolve(olditem, newitem, "addchg")
			default:
				throw Error(olditem.lastAction)
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
			case AT.MovedFrom:
				return this.resolve(olditem, newitem, "chgchg")
			case AT.MovedTo:
				return this.resolve(olditem, newitem, "addchg")
			default:
				throw Error(olditem.lastAction)
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
				throw Error(olditem.lastAction)
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
				throw Error(olditem.lastAction)
		}
	}
}
