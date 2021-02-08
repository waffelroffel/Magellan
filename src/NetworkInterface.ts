import { v4 as uuid4 } from "uuid"
import { Medium } from "./enums"
import { NID, Item, StreamCreator } from "./interfaces"
import LocalProxy from "./Proxies/LocalProxy"
import Vessel from "./Vessel"
import Proxy from "./Proxies/Proxy"

export default class NetworkInterface {
	nid: NID
	network: Proxy[] = []

	constructor() {
		this.nid = this.getIpPort()
	}

	private getIpPort() {
		return { ip: uuid4(), port: uuid4() }
	}

	addNode(type: Medium, vessel?: Vessel, nid?: NID): Proxy {
		const proxy = this.createProxy(type, vessel, nid)
		if (!proxy) throw Error("NetworkInterface.addNode: null from createProxy")
		this.network.push(proxy)
		return proxy
	}

	private createProxy(type: Medium, vessel?: Vessel, nid?: NID): Proxy | null {
		switch (type) {
			case Medium.local:
				return vessel ? new LocalProxy(vessel) : null
			default:
				return null
		}
	}

	removeNode(proxy: Proxy): void {
		this.network = this.network.filter(p => p !== proxy)
	}

	broadcast(item: Item, sc: StreamCreator): void {
		this.network.forEach(p => p.send(item, sc(item, p.type), this.nid))
	}

	/*
	requestItems(src: NID, dst: ABCVessel, items: Item[]): Streamable[] | null {
		const proxy = this.network.find(p => p === dst)
		return proxy?.fetch(items, src) ?? null
	}
	*/
}
