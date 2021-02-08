import { Streamable } from "./interfaces"

export abstract class ABCVessel {
	constructor() {}
	abstract createRS(path: string): Streamable
}
