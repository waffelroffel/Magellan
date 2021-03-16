import fetch from "node-fetch"
import { ItemType as IT, Medium, SHARE_TYPE } from "../enums"
import { Item, Streamable, IndexArray, Tomb, NID } from "../interfaces"
import Proxy from "./Proxy"

/**
 * POST: http://host:port/?...{item=item}
 * GET: http://host:port/?get=index
 * GET: http://host:port/?...{item=item}
 */
export default class HTTPProxy extends Proxy {
	type = Medium.http
	private protocol = "http://"
	private host: string
	private port: number
	private base: string
	private urlgetindex: string
	private urlgetnetinfo: string

	constructor(host: string, port: number) {
		super()
		this.host = host
		this.port = port
		this.base = `${this.protocol}${host}:${port}`
		this.urlgetindex = `${this.base}?get=index`
		this.urlgetnetinfo = `${this.base}?get=netinfo`
	}

	get nid(): NID {
		return { host: this.host, port: this.port }
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
				return t.movedTo ? p + `&tombmovedto=${t.movedTo}` : p
			})
			.join("&")
		return `${this.base}?${params}`
	}

	fetch(items: Item[]): (Promise<NodeJS.ReadableStream> | null)[] {
		return items.map(item =>
			item.type === IT.File
				? fetch(this.makePOST(item), {
						method: "GET",
				  }).then(res => res.body)
				: null
		)
	}

	fetchIndex(): Promise<IndexArray> {
		return fetch(this.urlgetindex, {
			method: "GET",
		}).then(res => res.json())
	}

	fetchNetInfo(): Promise<{ sharetype: SHARE_TYPE }> {
		return fetch(this.urlgetnetinfo, {
			method: "GET",
		}).then(res => res.json())
	}
}
