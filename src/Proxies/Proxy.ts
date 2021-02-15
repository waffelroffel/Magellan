import { Response } from "node-fetch"
import CargoList from "../CargoList"
import { Medium } from "../enums"
import { Streamable, NID, Item, SerializedIndex } from "../interfaces"
import { ABCVessel } from "./ABCVessel"

export default abstract class Proxy extends ABCVessel {
	abstract type: Medium
	abstract send(item: Item, rs?: Streamable): void
	abstract fetch(items: Item[]): (Streamable | Promise<NodeJS.ReadableStream>)[] // overwritten item return null
	abstract fetchIndex(): CargoList | Promise<SerializedIndex>
}
