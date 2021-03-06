import { ResolveOption } from "../enums"

export const LWWFileConfig = {
	addadd: ResolveOption.LWW,
	addrem: ResolveOption.LWW,
	addchg: ResolveOption.LWW,
	remrem: ResolveOption.LWW,
	remchg: ResolveOption.LWW,
	chgchg: ResolveOption.LWW,
}

export const LWWDirConfig = {
	addadd: ResolveOption.LWW,
	addrem: ResolveOption.LWW,
	remrem: ResolveOption.LWW,
}
