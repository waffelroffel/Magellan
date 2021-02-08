import { FileResolveOption } from "../enums"
import { ResolveLogic, FileRPConfig, FileResolveMap } from "../interfaces"
import fileresolvepolicies from "./fileresolves"

const fsp: Map<string, ResolveLogic[]> = fileresolvepolicies

function assign(key: string, i: number): ResolveLogic {
	const ps = fsp.get(key)
	if (!ps) throw Error("FileResolvePolicies.assign: undefined from get")
	return ps[i]
}

export default function makemap(
	config: FileRPConfig
): [FileResolveMap, Map<string, FileResolveOption>] {
	const frm = {
		addadd: assign("addadd", config.addadd),
		addrem: assign("addrem", config.addrem),
		addchg: assign("addchg", config.addrem),
		remrem: assign("remrem", config.addrem),
		remchg: assign("remchg", config.addrem),
		chgchg: assign("chgchg", config.addrem),
	}

	const fr = new Map<string, FileResolveOption>()
		.set("addadd", config.addadd)
		.set("addrem", config.addrem)
		.set("addchg", config.addrem)
		.set("remrem", config.addrem)
		.set("remchg", config.addrem)
		.set("chgchg", config.addrem)

	return [frm, fr]
}

export const LWWConfig = {
	addadd: FileResolveOption.LWW,
	addrem: FileResolveOption.LWW,
	addchg: FileResolveOption.LWW,
	remrem: FileResolveOption.LWW,
	remchg: FileResolveOption.LWW,
	chgchg: FileResolveOption.LWW,
}
