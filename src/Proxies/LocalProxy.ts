import { Medium, ResponseCode } from "../enums"
import { Item, IndexArray, InviteResponse } from "../interfaces"
import Vessel from "../Vessel"
import Proxy from "./Proxy"

export default class LocalProxy extends Proxy {
	type = Medium.local
	private local: Vessel

	constructor(vessel: Vessel, admin?: boolean) {
		super(admin)
		this.local = vessel
	}

	send(item: Item, rs: NodeJS.ReadableStream | null) {
		this.local.applyIncoming(JSON.parse(JSON.stringify(item)), rs)
	}

	fetch(items: Item[]): (NodeJS.ReadableStream | null)[] {
		return items.map(i => {
			const rs = this.local.getRS(i)
			if (rs) return rs
			else throw Error("LocalProxy.fetch: failed to create ReadableStream")
		})
	}

	fetchIndex(): IndexArray {
		return JSON.parse(this.local.index.serialize())
	}

	getinvite(): InviteResponse {
		return {
			sharetype: this.local.sharetype,
			peers: this.local.proxyinterface.serialize().map(p => p.nid),
		}
	}

	addPeer(): ResponseCode {
		throw Error("LocalProxy.addPeer: should not be called")
	}
}
