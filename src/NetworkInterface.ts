import { v4 } from "uuid"
import { Medium } from "./enums"
import { NID, Item, Streamable } from "./interfaces"
import Proxy from "./Proxies/LocalProxy"
import Vessel from "./Vessel"

export default class NetworkInterface {
	ip: string
	port: string
	network: Proxy[] = []

	constructor() {
		this.ip = v4()
		this.port = v4()
	}

	nid(): NID {
		return { ip: this.ip, port: this.port }
	}

	addNode(nid: NID, type: Medium, vessel?: Vessel): Proxy {
		const proxy = new Proxy(nid, type, vessel)
		this.network.push(proxy)
		return proxy
	}

	removeNode(nid: NID): void {
		this.network = this.network.filter(p => !p.comp(nid))
	}

	broadcast(src: NID, item: Item, rs?: Streamable): void {
		this.network.forEach(p => p.send(src, item, rs))
	}

	// clean async
	requestItems(
		src: NID,
		dst: NID,
		items: Item[]
	): Promise<Streamable>[] | null {
		const proxy = this.network.find(p => !p.comp(dst))
		return proxy?.fetch(src, items) ?? null
	}
}
