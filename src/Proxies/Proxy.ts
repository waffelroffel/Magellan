import CargoList from "../CargoList"
import { Medium } from "../enums"
import { Streamable, NID, Item } from "../interfaces"
import { ABCVessel } from "./ABCVessel"

export default abstract class Proxy extends ABCVessel {
	abstract type: Medium
	abstract send(item: Item, rs?: Streamable, src?: NID): void
	abstract fetch(items: Item[], src?: NID): Streamable[] // overwritten item return null
	abstract fetchIndex(src: NID): CargoList | Streamable // TODO: remove CargoList
}
