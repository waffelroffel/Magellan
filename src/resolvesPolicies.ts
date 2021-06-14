import { extname } from "path"
import { ActionType, ItemType, ResolveOption as RO } from "./enums"
import { Item, Resolution } from "./interfaces"
import { comp, deepcopy, identical } from "./utils"

function compLamport(i1: Item, i2: Item): boolean {
	return i1.lastModified !== i2.lastModified
		? i1.lastModified < i2.lastModified
		: compUser(i1, i2)
}

function compUser(i1: Item, i2: Item): boolean {
	const cond = i1.lastActionBy.localeCompare(i2.lastActionBy)
	if (cond < 0) return true
	if (cond > 0) return false
	throw Error()
}

export function defaultRes(item: Item): Resolution[] {
	return [{ after: item, ro: RO.LWW, new: true }]
}

export function resolve(i1: Item, i2: Item): Resolution[] {
	if (identical(i1.clock, i2.clock))
		return [{ after: i2, ro: RO.LWW, new: false }]
	switch (comp(i1.clock, i2.clock)) {
		case 1:
			return [{ after: i2, ro: RO.LWW, new: true }] // happened after
		case -1:
			return [{ after: i1, ro: RO.LWW, new: false }] // happened before
		case 0:
			return resolveConcurrent(i1, i2) // concurrent
		default:
			throw Error()
	}
}

function resolveConcurrent(i1: Item, i2: Item): Resolution[] {
	// if (i1.lastActionBy === i2.lastActionBy) throw Error("TEMP: dup action")

	const cond = compLamport(i1, i2)
	if (cond) {
		// new Item renamed
		const newi: Resolution = {
			before: i2,
			after: newname(deepcopy(i2)),
			ro: RO.DUP,
			new: true,
			rename: true,
			noio: i2.lastAction === ActionType.Remove,
		}
		return [newi]
	}
	// old Item renamed and new Item replace old Item's position
	const oldi: Resolution = {
		before: i1,
		after: newname(deepcopy(i1)),
		ro: RO.DUP,
		rename: true,
		noio: i2.lastAction === ActionType.Remove,
	}
	const newi: Resolution = {
		before: i2,
		after: i2,
		ro: RO.DUP,
		new: true,
		overwrite: true,
		noio: i2.lastAction === ActionType.Remove,
	}
	return [oldi, newi]
}

function newname(i: Item): Item {
	const name = i.path.substring(0, i.path.lastIndexOf("."))
	const user = i.lastActionBy
	const ext = extname(i.path)
	i.path =
		i.type === ItemType.Dir ? `${i.path}-${user}` : `${name}-${user}${ext}`
	return i
}
