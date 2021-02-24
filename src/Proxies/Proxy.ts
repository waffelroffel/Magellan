import { Response } from "node-fetch"
import CargoList from "../CargoList"
import { Medium } from "../enums"
import { Streamable, NID, Item, IndexArray } from "../interfaces"
import { ABCVessel } from "./ABCVessel"

export default abstract class Proxy extends ABCVessel {
	abstract type: Medium
	abstract send(item: Item, rs?: Streamable): void
	abstract fetch(items: Item[]): (Streamable | Promise<Streamable>)[] // overwritten item return null
	abstract fetchIndex(): IndexArray | Promise<IndexArray>
	//abstract getProxies(): [string, NID][] | Promise<[string, NID][]>
}
