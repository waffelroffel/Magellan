import { Medium } from "./enums"
import { NID, Item, ProxyOption } from "./interfaces"
import LocalProxy from "./Proxies/LocalProxy"
import Proxy from "./Proxies/Proxy"
import HTTPProxy from "./Proxies/HTTPProxy"

export default class ProxyList extends Array<Proxy> {
	addNode(type: Medium, data: ProxyOption): Proxy {
		const proxy = this.createProxy(type, data)
		if (!proxy) throw Error("NetworkInterface.addNode: null from createProxy")
		this.push(proxy)
		return proxy
	}

	get(nid: NID): Proxy | null {
		const p = this.filter(p => p instanceof HTTPProxy).find(
			p =>
				p instanceof HTTPProxy &&
				p.nid.host === nid.host &&
				p.nid.port === nid.port
		)
		return p ?? null
	}

	has(nid: NID): boolean {
		return this.some(
			p =>
				p instanceof HTTPProxy &&
				p.nid.host === nid.host &&
				p.nid.port === nid.port
		)
	}

	private createProxy(type: Medium, data: ProxyOption): Proxy | null {
		switch (type) {
			case Medium.local:
				return data.vessel ? new LocalProxy(data.vessel) : null
			case Medium.http:
				return data.nid ? new HTTPProxy(data.nid) : null
		}
	}

	removeNode(proxy: Proxy): void {
		const i = this.indexOf(proxy)
		if (i === -1) throw Error("ProxyInterface.removeNode: not in array")
		this.splice(i, 1)
	}

	broadcast(item: Item, data?: string): void {
		// getData: () => string | null
		this.forEach(p => p.send(item, data))
	}

	serialize(): { nid: NID }[] {
		return this.filter(p => p instanceof HTTPProxy).map(p => {
			return { nid: (p as HTTPProxy).nid }
		})
	}
}
