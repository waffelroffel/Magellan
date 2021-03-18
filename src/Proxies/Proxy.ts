import { Medium, SHARE_TYPE } from "../enums"
import {
	Streamable,
	Item,
	IndexArray,
	NID,
	INVITE_RESPONSE,
} from "../interfaces"
import { ABCVessel } from "./ABCVessel"

export default abstract class Proxy extends ABCVessel {
	abstract type: Medium
	abstract send(item: Item, rs?: Streamable | null): void
	abstract fetch(items: Item[]): (Streamable | Promise<Streamable> | null)[] // overwritten item return null
	abstract fetchIndex(): IndexArray | Promise<IndexArray>
	//abstract getProxies(): [string, NID][] | Promise<[string, NID][]>
	abstract getinvite(src: NID): INVITE_RESPONSE | Promise<INVITE_RESPONSE>
	abstract addPeer(src: NID): string | Promise<string> // TODO: return type
}
