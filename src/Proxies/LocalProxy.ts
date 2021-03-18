import { ReadStream } from "fs"
import { Medium } from "../enums"
import { Item, IndexArray, INVITE_RESPONSE } from "../interfaces"
import Vessel from "../Vessel"
import HTTPProxy from "./HTTPProxy"
import Proxy from "./Proxy"

export default class LocalProxy extends Proxy {
	type = Medium.local
	private local: Vessel

	constructor(vessel: Vessel) {
		super()
		this.local = vessel
	}

	send(item: Item, rs?: ReadStream) {
		this.local.applyIncoming(JSON.parse(JSON.stringify(item)), rs)
	}

	fetch(items: Item[]): (ReadStream | null)[] {
		return items.map(i => {
			const rs = this.local.createRS(i)
			if (!rs || rs instanceof ReadStream) return rs
			else throw Error("LocalProxy.fetch: failed to create ReadStream")
		})
	}

	fetchIndex(): IndexArray {
		return JSON.parse(this.local.index.serialize())
	}

	getinvite(): INVITE_RESPONSE {
		return {
			sharetype: this.local.sharetype,
			peers: this.local.proxyinterface.network
				.filter(p => p instanceof HTTPProxy)
				.map(p => (p as HTTPProxy).nid),
		}
	}

	addPeer(): string {
		throw Error("LocalProxy.addPeer: should not be called")
	}
}
