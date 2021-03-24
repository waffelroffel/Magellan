import { Medium } from "../enums"
import {
	Item,
	NID,
	PIndexArray,
	PInviteResponse,
	PResponseCode,
	PReadable,
} from "../interfaces"
import Vessel from "../Vessel"

export default abstract class Proxy {
	abstract type: Medium
	admin: boolean

	abstract send(item: Item, rs: NodeJS.ReadableStream | null): void
	abstract fetchItems(items: Item[]): PReadable[]
	abstract fetchIndex(): PIndexArray
	abstract getinvite(src: NID): PInviteResponse
	abstract addPeer(src: Vessel | NID): PResponseCode

	constructor(admin?: boolean) {
		this.admin = admin ?? false
	}
}
