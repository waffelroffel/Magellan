import { extname, join } from "path"
import { Item, ResolveLogic } from "../interfaces"

function comp(i1: Item, i2: Item): boolean {
	return i1.lastModified !== i2.lastModified
		? i1.lastModified < i2.lastModified
		: i1.lastActionBy < i2.lastActionBy
}

function lww(i1: Item, i2: Item): [Item, number] {
	return comp(i1, i2) ? [i2, 1] : [i1, 0]
}

function dup(i1: Item, i2: Item): [Item, number] {
	return comp(i1, i2) ? [insertname(i2), 1] : [insertname(i1), 0]
}

function insertname(i: Item): Item {
	i.path = join(
		i.path.substring(0, i.path.lastIndexOf(".")),
		i.lastActionBy,
		extname(i.path)
	)
	return i
}

const addaddlww: ResolveLogic = (item1, item2) => lww(item1, item2)

// TODO
const addadddup: ResolveLogic = (item1, item2) => dup(item1, item2)

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
