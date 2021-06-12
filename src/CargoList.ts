import { existsSync, readFileSync, writeFileSync } from "fs"
import {
	ResolveOption as RO,
	ItemType as IT,
	ActionType as AT,
	TombType as TT,
	isValidActionType,
} from "./enums"
import { Item, IndexArray, QueueItem } from "./interfaces"
import { Resolution } from "./interfaces"
import { defaultRes, resolve } from "./resolvesPolicies"
import { increment, uuid } from "./utils"

export default class CargoList {
	private index: Map<string, Item[]>
	private indexpath: string
	private lastActionId = ""
	private queue: QueueItem[] = []
	private timerid: NodeJS.Timeout
	private busy = false

	get DUMMY(): Item {
		return CargoList.Item("", IT.File, AT.Change, "")
	}

	constructor(indexpath: string) {
		this.index = new Map()
		this.indexpath = indexpath
		this.timerid = setInterval(() => this.processNext(), 100)
	}

	stop(): void {
		clearInterval(this.timerid)
		this.save()
	}

	verEq(actionid: string): boolean {
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
			clock: [],
		}
		increment(item.clock, user)
		if (action === AT.Remove) item.tomb = { type: TT.Deleted }
		return item
	}

	static validateItem(item: Item): boolean {
		if (item.lastAction === AT.Remove && !item.tomb) return false
		if (item.lastAction === AT.MovedFrom && !item.tomb?.movedTo) return false
		if (item.type === IT.Dir && item.hash) return false
		if (item.clock.length === 0) return false
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

	putInQ(item: Item, post?: (resarr: Resolution[]) => void): void {
		this.queue.push({ item, post })
	}

	processNext(): void {
		if (this.queue.length === 0) return
		if (this.busy) return
		this.busy = true
		const qitem = this.queue.shift()
		if (!qitem) return
		const resarr = this.apply(qitem.item)
		qitem.post?.(resarr)
		this.busy = false
	}

	apply(item: Item): Resolution[] {
		this.lastActionId = item.actionId // TODO
		if (item.path === this.indexpath) return []
		if (!isValidActionType(item.lastAction))
			throw Error(`CargoList.apply: illegal action (${item.lastAction})`)
		const olditem = this.getLatest(item.path)
		return olditem ? this.resolve(olditem, item) : this.noresolve(item)
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
						const newid = uuid(res.after.path)
						res.before.id = newid
						res.after.id = newid
						res.before.tomb = { type: TT.Moved, movedTo: res.after.path }
						this.push(res.after)
					} else if (res.overwrite) this.push(res.after)
				} else if (res.rename) {
					res.before.lastAction = AT.MovedFrom
					res.after.lastAction = AT.MovedTo
					const newid = uuid(res.after.path)
					res.before.id = newid
					res.after.id = newid
					res.before.tomb = { type: TT.Moved, movedTo: res.after.path }
					this.push(res.after)
				}
		}
	}

	private noresolve(item: Item): Resolution[] {
		const resarr = defaultRes(item)
		resarr.forEach(r => this.update(r))
		return resarr
	}

	private resolve(oldi: Item, newi: Item): Resolution[] {
		const resarr = resolve(oldi, newi)
		resarr.forEach(r => this.update(r))
		return resarr
	}

	dig(item: Item): Item {
		if (!item.tomb?.movedTo) return item
		const newi = this.index.get(item.tomb.movedTo)?.find(i => i.id === item.id)
		if (!newi) throw Error("Tomb leads to nowhere")
		return this.dig(newi)
	}
}
