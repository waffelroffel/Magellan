import { Medium } from "./enums"
import { NID, Item, Streamable, ProxyOption } from "./interfaces"
import LocalProxy from "./Proxies/LocalProxy"
import Vessel from "./Vessel"
import Proxy from "./Proxies/Proxy"
import HTTPProxy from "./Proxies/HTTPProxy"

export default class NetworkInterface {
	nid: NID
	network: Proxy[] = []

	constructor() {
		this.nid = this.getIpPort()
	}

	private getIpPort() {
		return { host: "localhost", port: 8000 + Math.floor(Math.random() * 888) }
	}

	addNode(type: Medium, data: ProxyOption): Proxy {
		const proxy = this.createProxy(type, data)
		if (!proxy) throw Error("NetworkInterface.addNode: null from createProxy")
		this.network.push(proxy)
		return proxy
	}

	private createProxy(type: Medium, data: ProxyOption): Proxy | null {
		switch (type) {
			case Medium.local:
				return data.vessel ? new LocalProxy(data.vessel) : null
			case Medium.http:
				return data.nid ? new HTTPProxy(data.nid.host, data.nid.port) : null
			default:
				return null
		}
	}

	removeNode(proxy: Proxy): void {
		this.network = this.network.filter(p => p !== proxy)
	}

	broadcast(item: Item, rs: Streamable): void {
		this.network.forEach(p => p.send(item, rs))
	}
}
