import { ResolveOption } from "../enums"
import { ResolveLogic, FileRPConfig, DirRPConfig } from "../interfaces"
import rp from "./resolves"

function assign(key: string, i: number): ResolveLogic {
	const ps = rp.get(key)
	if (!ps) throw Error("FileResolvePolicies.assign: undefined from get")
	return ps[i]
}

export function makefpmap(
	config: FileRPConfig
): [Map<string, ResolveLogic>, Map<string, ResolveOption>] {
	const frm = new Map<string, ResolveLogic>()
		.set("addadd", assign("addadd", config.addadd))
		.set("addrem", assign("addrem", config.addrem))
		.set("addchg", assign("addchg", config.addchg))
		.set("remrem", assign("remrem", config.remrem))
		.set("remchg", assign("remchg", config.remchg))
		.set("chgchg", assign("chgchg", config.chgchg))

	const fr = new Map<string, ResolveOption>()
		.set("addadd", config.addadd)
		.set("addrem", config.addrem)
		.set("addchg", config.addchg)
		.set("remrem", config.remrem)
		.set("remchg", config.remchg)
		.set("chgchg", config.chgchg)

	return [frm, fr]
}

export function makedpmap(
	config: DirRPConfig
): [Map<string, ResolveLogic>, Map<string, ResolveOption>] {
	const drm = new Map<string, ResolveLogic>()
		.set("addadd", assign("addadd", config.addadd))
		.set("addrem", assign("addrem", config.addrem))
		.set("remrem", assign("remrem", config.remrem))

	const dr = new Map<string, ResolveOption>()
		.set("addadd", config.addadd)
		.set("addrem", config.addrem)
		.set("remrem", config.remrem)

	return [drm, dr]
}
