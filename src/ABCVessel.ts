import { Streamable } from "./NetworkInterface"

export abstract class ABCVessel {
	constructor() {}
	abstract createRS(path: string): Streamable
}
