import { extname } from "path"
import { ResolveOption as RO } from "../enums"
import { Item, Resolution, ResolveLogic } from "../interfaces"
import { comp, deepcopy, identical } from "../utils"

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

function lww(i1: Item, i2: Item): Resolution[] {
	if (identical(i1.clock, i2.clock))
		return [{ after: i2, ro: RO.LWW, new: true }]
	switch (comp(i1.clock, i2.clock)) {
		case 1:
			return [{ after: i2, ro: RO.LWW, new: true }]
		case -1:
			return [{ after: i1, ro: RO.LWW, new: false }]
		case 0:
			//const cond = compLamport(i1, i2)
			//const lastest = cond ? i2 : i1
			//return [{ after: lastest, ro: RO.LWW, new: cond }]
			return dup(i1, i2)
		default:
			throw Error()
	}
}

function dup(i1: Item, i2: Item): Resolution[] {
	if (i1.lastActionBy === i2.lastActionBy) throw Error("TEMP: dup")

	const cond = compLamport(i1, i2)
	if (cond) {
		// cond===true: new Item renamed
		const newi = {
			before: i2,
			after: newname(deepcopy(i2)),
			ro: RO.DUP,
			new: true,
			rename: true,
		}
		return [newi]
	}
	// cond===false: old Item renamed
	const oldi = {
		before: i1,
		after: newname(deepcopy(i1)),
		ro: RO.DUP,
		rename: true,
	}
	const newi = {
		before: i2, // temp
		after: i2,
		ro: RO.DUP,
		new: true,
		overwrite: true,
	}
	return [oldi, newi]
}

function newname(i: Item): Item {
	const name = i.path.substring(0, i.path.lastIndexOf("."))
	const user = i.lastActionBy
	const ext = extname(i.path)
	i.path = `${name}-${user}${ext}`
	return i
}

const addaddlww: ResolveLogic = lww

const addadddup: ResolveLogic = lww

const addremlww: ResolveLogic = lww

const addremdup: ResolveLogic = lww

const addchglww: ResolveLogic = lww

const addchgdup: ResolveLogic = lww

const remchglww: ResolveLogic = lww

const chgchglww: ResolveLogic = lww

const chgchgdup: ResolveLogic = lww

const rp = new Map<string, ResolveLogic[]>()
	.set("addadd", [addaddlww, addadddup])
	.set("addrem", [addremlww, addremdup])
	.set("addchg", [addchglww, addchgdup])
	.set("remrem", [addaddlww, addadddup])
	.set("remchg", [remchglww])
	.set("chgchg", [chgchglww, chgchgdup])

export default rp
