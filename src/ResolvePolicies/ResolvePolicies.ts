import { ResolveOption } from "../enums"
import {
	ResolveLogic,
	FileRPConfig,
	FileResolveMap,
	DirResolveMap,
	DirRPConfig,
} from "../interfaces"
import rp from "./resolves"

function assign(key: string, i: number): ResolveLogic {
	const ps = rp.get(key)
	if (!ps) throw Error("FileResolvePolicies.assign: undefined from get")
	return ps[i]
}

export function makefpmap(
	config: FileRPConfig
): [FileResolveMap, Map<string, ResolveOption>] {
	const frm = {
		addadd: assign("addadd", config.addadd),
		addrem: assign("addrem", config.addrem),
		addchg: assign("addchg", config.addrem),
		remrem: assign("remrem", config.addrem),
		remchg: assign("remchg", config.addrem),
		chgchg: assign("chgchg", config.addrem),
	}

	const fr = new Map<string, ResolveOption>()
		.set("addadd", config.addadd)
		.set("addrem", config.addrem)
		.set("addchg", config.addrem)
		.set("remrem", config.addrem)
		.set("remchg", config.addrem)
		.set("chgchg", config.addrem)

	return [frm, fr]
}

export function makedpmap(
	config: DirRPConfig
): [DirResolveMap, Map<string, ResolveOption>] {
	const frm = {
		addadd: assign("addadd", config.addadd),
		addrem: assign("addrem", config.addrem),
		remrem: assign("remrem", config.addrem),
	}

	const fr = new Map<string, ResolveOption>()
		.set("addadd", config.addadd)
		.set("addrem", config.addrem)
		.set("remrem", config.addrem)

	return [frm, fr]
}
