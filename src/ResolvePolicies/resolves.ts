import { extname } from "path"
import { ResolveOption as RO } from "../enums"
import { Item, Resolution, ResolveLogic } from "../interfaces"
import { deepcopy } from "../utils"

function comp(i1: Item, i2: Item): boolean {
	return i1.lastModified !== i2.lastModified
		? i1.lastModified < i2.lastModified
		: i1.lastActionBy < i2.lastActionBy
}

function lww(i1: Item, i2: Item): Resolution[] {
	const same =
		i1.lastModified === i2.lastModified && i1.actionId === i2.actionId
	if (comp(i1, i2)) return [{ after: i2, io: true, ro: RO.LWW, same }]
	return [{ after: i1, io: false, ro: RO.LWW, same }]
}

function dup(i1: Item, i2: Item): Resolution[] {
	const cond = comp(i1, i2)
	const changed = newname(deepcopy(cond ? i2 : i1))
	const res1 = {
		before: i1,
		after: !cond ? changed : i1,
		io: !cond,
		ro: RO.DUP,
	}
	const res2 = {
		before: i2,
		after: cond ? changed : i2,
		io: cond,
		ro: RO.DUP,
	}
	return [res1, res2]
}

function newname(i: Item): Item {
	const name = i.path.substring(0, i.path.lastIndexOf("."))
	const user = i.lastActionBy
	const ext = extname(i.path)
	i.path = `${name} - (${user})${ext}`
	return i
}

const addaddlww: ResolveLogic = lww

const addadddup: ResolveLogic = dup

const addremlww: ResolveLogic = addaddlww

const addremdup: ResolveLogic = addadddup

const addchglww: ResolveLogic = addaddlww

const addchgdup: ResolveLogic = addadddup

const remchglww: ResolveLogic = addaddlww

const chgchglww: ResolveLogic = addaddlww

const chgchgdup: ResolveLogic = addadddup

const rp = new Map<string, ResolveLogic[]>()
	.set("addadd", [addaddlww, addadddup])
	.set("addrem", [addremlww, addremdup])
	.set("addchg", [addchglww, addchgdup])
	.set("remrem", [addaddlww, addadddup])
	.set("remchg", [remchglww])
	.set("chgchg", [chgchglww, chgchgdup])

export default rp
