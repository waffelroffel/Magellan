import { Medium, ResponseCode } from "../enums"
import { Item, IndexArray, Invite } from "../interfaces"
import Vessel from "../Vessel"
import Proxy from "./Proxy"

export default class LocalProxy extends Proxy {
	type = Medium.local
	private local: Vessel

	constructor(vessel: Vessel, admin?: boolean) {
		super(admin)
		this.local = vessel
	}

	send(item: Item, rs?: NodeJS.ReadableStream) {
		this.local.applyIncoming(JSON.parse(JSON.stringify(item)), rs)
	}

	fetchItems(items: Item[]): (NodeJS.ReadableStream | null)[] {
		return items.map(i => this.local.getRS(i))
	}

	fetchIndex(): IndexArray {
		return JSON.parse(this.local.index.serialize())
	}

	getinvite(): Invite {
		return {
			sharetype: this.local.sharetype,
			peers: this.local.proxylist.serialize().map(p => p.nid),
			privs: this.local.genDefaultPrivs(),
		}
	}

	addPeer(vessel: Vessel): ResponseCode {
		this.local.addVessel(vessel)
		return ResponseCode.DNE
	}
}
