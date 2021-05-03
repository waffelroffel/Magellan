import { ResponseCode } from "../enums"
import {
	Item,
	NID,
	ProxyRes,
	Invite,
	IndexArray,
	PermissionGrant,
} from "../interfaces"
import Vessel from "../Vessel"

export default abstract class Proxy {
	// abstract send(item: Item, rs?: NodeJS.ReadableStream): void
	abstract send(item: Item, data?: string): void
	abstract fetchItems(items: Item[]): ProxyRes<string>[]
	abstract fetchIndex(): ProxyRes<IndexArray>
	abstract getinvite(src: NID): ProxyRes<Invite>
	abstract addPeer(src: Vessel | NID): ProxyRes<ResponseCode>
	abstract reqPerm(src: NID): void
	abstract grantPerm(grant: PermissionGrant): void
	abstract checkIndexVer(id: string): ProxyRes<IndexArray>
}
