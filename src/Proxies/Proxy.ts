import { Medium, SHARE_TYPE } from "../enums"
import { Streamable, Item, IndexArray } from "../interfaces"
import { ABCVessel } from "./ABCVessel"

export default abstract class Proxy extends ABCVessel {
	abstract type: Medium
	abstract send(item: Item, rs?: Streamable | null): void
	abstract fetch(items: Item[]): (Streamable | Promise<Streamable> | null)[] // overwritten item return null
	abstract fetchIndex(): IndexArray | Promise<IndexArray>
	//abstract getProxies(): [string, NID][] | Promise<[string, NID][]>
	abstract fetchNetInfo():
		| { sharetype: SHARE_TYPE }
		| Promise<{ sharetype: SHARE_TYPE }>
}
