import { ResolveLogic } from "../interfaces"

const addaddlww: ResolveLogic = (item1, item2) => {
	const cond =
		item1.lastModified !== item2.lastModified
			? item1.lastModified < item2.lastModified
			: item1.lastActionBy < item2.lastActionBy
	return cond ? [item2, 1] : [item1, 0]
}

// TODO
const addadddup: ResolveLogic = (item1, item2) =>
	item1.lastModified <= item2.lastModified ? [item2, 1] : [item1, 0]

const addremlww: ResolveLogic = addaddlww

const addremdup: ResolveLogic = (item1, item2) =>
	item1.lastModified <= item2.lastModified ? [item2, 1] : [item1, 0]

const addchglww: ResolveLogic = addaddlww

const addchgdup: ResolveLogic = (item1, item2) =>
	item1.lastModified <= item2.lastModified ? [item2, 1] : [item1, 0]

const remchglww: ResolveLogic = addaddlww

const chgchglww: ResolveLogic = addaddlww

const chgchgdup: ResolveLogic = (item1, item2) =>
	item1.lastModified <= item2.lastModified ? [item2, 1] : [item1, 0]

const fileresolvepolicies = new Map<string, ResolveLogic[]>()
	.set("addadd", [addaddlww, addadddup])
	.set("addrem", [addremlww, addremdup])
	.set("addchg", [addchglww, addchgdup])
	.set("remrem", [addaddlww, addadddup])
	.set("remchg", [remchglww])
	.set("chgchg", [chgchglww, chgchgdup])

export default fileresolvepolicies
