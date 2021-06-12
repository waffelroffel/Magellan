import { Item, IndexArray, Invite, PermissionGrant } from "../interfaces"
import Vessel from "../Vessel"
import Proxy from "./Proxy"
// TODO

export default class LocalProxy extends Proxy {
	private local: Vessel

	constructor(vessel: Vessel) {
		super()
		this.local = vessel
	}

	send(item: Item, data?: string): void {
		this.local.applyIncoming(JSON.parse(JSON.stringify(item)), data)
	}

	fetchItems(items: Item[]): (string | null)[] {
		return items.map(i => this.local.getData(i))
	}

	fetchIndex(): IndexArray {
		return JSON.parse(this.local.index.serialize())
	}

	getinvite(): Invite {
		return {
			sharetype: this.local.sharetype,
			peers: this.local.proxylist.serialize().map(p => p.nid),
			perms: this.local.getDefaultPerms(),
		}
	}

	addPeer(src: Vessel): void {
		this.local.addVessel(src)
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
