import fetch from "node-fetch"
import { Medium } from "../enums"
import { Item, Streamable, IndexArray, Tomb } from "../interfaces"
import Proxy from "./Proxy"

/**
 * POST: http://host:port/?...{item=item}
 * GET: http://host:port/?get=index
 * GET: http://host:port/?...{item=item}
 */
export default class HTTPProxy extends Proxy {
	type = Medium.http
	protocol = "http://"
	host: string
	port: number
	base: string
	urlgetindex: string
	//urlgetproxies: string

	constructor(host: string, port: number) {
		super()
		this.host = host
		this.port = port
		this.base = `${this.protocol}${host}:${port}`
		this.urlgetindex = `${this.base}?get=index`
		//this.urlgetproxies = `${this.base}?get=proxies`
	}

	send(item: Item, rs?: Streamable) {
		fetch(this.makePOST(item), {
			method: "POST",
			body: rs ?? undefined,
		})
	}

	private makePOST(item: Item): string {
		const params = Object.entries(item)
			.map(([k, v]) => {
				if (k !== "tomb") return `${k}=${v}`
				const t = v as Tomb
				const p = `tombtype=${t.type}`
				if (t.movedTo) return p + `&tombmovedto=${t.movedTo}`
				return p
			})
			.join("&")
		return `${this.base}?${params}`
	}

	fetch(items: Item[]): Promise<NodeJS.ReadableStream>[] {
		return items.map(item =>
			fetch(this.makePOST(item), {
				method: "GET",
			}).then(res => res.body)
		)
	}

	fetchIndex(): Promise<IndexArray> {
		return fetch(this.urlgetindex, {
			method: "GET",
		}).then(res => res.json())
	}
	/*
	getProxies(): Promise<[string, NID][]> {
		return fetch(this.urlgetproxies, {
			method: "GET",
		}).then(res => res.json())
	}
	*/
}
