import { Medium } from "./enums"
import { NID, Item, Streamable, ProxyOption } from "./interfaces"
import LocalProxy from "./Proxies/LocalProxy"
import Proxy from "./Proxies/Proxy"
import HTTPProxy from "./Proxies/HTTPProxy"

// TODO: extend Array<Proxy>?
export default class ProxyInterface {
	peers: Proxy[] = []

	serialize(): { nid: NID; admin: boolean }[] {
		return this.peers
			.filter(p => p instanceof HTTPProxy)
			.map(p => {
				return { nid: (p as HTTPProxy).nid, admin: p.admin }
			})
	}

	addNode(type: Medium, data: ProxyOption): Proxy {
		const proxy = this.createProxy(type, data)
		if (!proxy) throw Error("NetworkInterface.addNode: null from createProxy")
		this.peers.push(proxy)
		return proxy
	}

	private createProxy(type: Medium, data: ProxyOption): Proxy | null {
		switch (type) {
			case Medium.local:
				return data.vessel ? new LocalProxy(data.vessel, data.admin) : null
			case Medium.http:
				return data.nid
					? new HTTPProxy(data.nid.host, data.nid.port, data.admin)
					: null
			default:
				return null
		}
	}

	removeNode(proxy: Proxy): void {
		this.peers = this.peers.filter(p => p !== proxy)
	}

	broadcast(item: Item, rs: Streamable | null): void {
		this.peers.forEach(p => p.send(item, rs))
	}
}
