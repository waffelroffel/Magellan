import { ResponseCode } from "../enums"
import {
	Item,
	NID,
	ProxyRes,
	PermissionGrant,
	Invite,
	IndexArray,
} from "../interfaces"
import Vessel from "../Vessel"

export default abstract class Proxy {
	// abstract type: Medium

	abstract send(item: Item, rs?: NodeJS.ReadableStream): void
	abstract fetchItems(items: Item[]): ProxyRes<NodeJS.ReadableStream>[]
	abstract fetchIndex(): ProxyRes<IndexArray>
	abstract getinvite(src: NID): ProxyRes<Invite>
	abstract addPeer(src: Vessel | NID): ProxyRes<ResponseCode>
	abstract getPriv(src: NID): ProxyRes<PermissionGrant>
}
