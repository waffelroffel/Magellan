import { Medium } from "../enums"
import {
	Item,
	NID,
	PIndexArray,
	PInviteResponse,
	PResponseCode,
	PReadable,
	PPermissionGrant,
} from "../interfaces"
import Vessel from "../Vessel"

export default abstract class Proxy {
	abstract type: Medium // TODO: unused

	abstract send(item: Item, rs?: NodeJS.ReadableStream): void
	abstract fetchItems(items: Item[]): PReadable[]
	abstract fetchIndex(): PIndexArray
	abstract getinvite(src: NID): PInviteResponse
	abstract addPeer(src: Vessel | NID): PResponseCode
	abstract getPriv(src: NID): PPermissionGrant
}
