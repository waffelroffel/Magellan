import { Medium, ProxyResponseCode } from "../enums"
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
	admin: boolean

	abstract send(item: Item, rs?: Streamable | null): void
	abstract fetch(items: Item[]): (Streamable | Promise<Streamable> | null)[]
	abstract fetchIndex(): IndexArray | Promise<IndexArray>
	abstract getinvite(src: NID): INVITE_RESPONSE | Promise<INVITE_RESPONSE>
	abstract addPeer(src: NID): ProxyResponseCode | Promise<ProxyResponseCode> // TODO: return type

	constructor(admin?: boolean) {
		super()
		this.admin = admin ?? false
	}
}
