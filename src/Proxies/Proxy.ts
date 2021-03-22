import { Medium } from "../enums"
import {
	Item,
	NID,
	PIndexArray,
	PInviteResponse,
	PResponseCode,
	PReadable,
} from "../interfaces"
import { ABCVessel } from "./ABCVessel"

export default abstract class Proxy extends ABCVessel {
	abstract type: Medium
	admin: boolean

	abstract send(item: Item, rs: NodeJS.ReadableStream | null): void
	abstract fetch(items: Item[]): PReadable[]
	abstract fetchIndex(): PIndexArray
	abstract getinvite(src: NID): PInviteResponse
	abstract addPeer(src: NID): PResponseCode

	constructor(admin?: boolean) {
		super()
		this.admin = admin ?? false
	}
}
