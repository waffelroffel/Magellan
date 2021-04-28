import { ResponseCode } from "../enums"
import { Item, IndexArray, Invite, PermissionGrant } from "../interfaces"
import PermissionManager from "../Permissions"
import Vessel from "../Vessel"
import Proxy from "./Proxy"

export default class LocalProxy extends Proxy {
	private local: Vessel

	constructor(vessel: Vessel) {
		super()
		this.local = vessel
	}

	send(item: Item, rs?: NodeJS.ReadableStream): void {
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
			perms: PermissionManager.defaultPerms(this.local.sharetype),
		}
	}

	addPeer(src: Vessel): ResponseCode {
		this.local.addVessel(src)
		return ResponseCode.DNE
	}

	reqPerm(): PermissionGrant {
		throw Error("LocalProxy.reqPerm: not implemented")
	}

	grantPerm(): PermissionGrant {
		throw Error("LocalProxy.grantPerm: not implemented")
	}

	checkIndexVer(): IndexArray | null {
		throw Error("LocalProxy.checkIndexVer: not implemented")
	}
}
