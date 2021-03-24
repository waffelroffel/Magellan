import fetch from "node-fetch"
import { ItemType as IT, Medium, ResponseCode } from "../enums"
import { Item, IndexArray, NID, InviteResponse, MetaBody } from "../interfaces"
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
	private urlpostitem: string
	private urlpostitemmeta: string
	private urlpostitemdata: string
	private urlgetindex: string
	private urlgetinvite: string
	private urladdpeer: string

	constructor(host: string, port: number, admin?: boolean) {
		super(admin)
		this.host = host
		this.port = port
		this.base = `${this.protocol}${host}:${port}`
		this.urlpostitem = `${this.base}/item` // get item
		this.urlpostitemmeta = `${this.base}/item/meta` // send item meta
		this.urlpostitemdata = `${this.base}/item/data/` // send item data
		this.urlgetindex = `${this.base}/index`
		this.urlgetinvite = `${this.base}/invite`
		this.urladdpeer = `${this.base}/addpeer`
	}

	get nid(): NID {
		return { host: this.host, port: this.port }
	}

	async send(item: Item, rs: NodeJS.ReadableStream | null): Promise<void> {
		const res = await fetch(this.urlpostitemmeta, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(item),
		})
		const resobj: MetaBody = await res.json()
		await fetch(this.urlpostitemdata + resobj.sid, {
			method: "POST",
			headers: { "content-type": "application/binary" },
			body: rs || undefined, // TODO: clean
		})
	}

	fetchItems(items: Item[]): (Promise<NodeJS.ReadableStream> | null)[] {
		return items.map(item =>
			item.type === IT.File ? this.fetchItem(item) : null
		)
	}

	private fetchItem(item: Item): Promise<NodeJS.ReadableStream> {
		return fetch(this.urlpostitem, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(item),
		}).then(res => res.body)
	}

	fetchIndex(): Promise<IndexArray> {
		return fetch(this.urlgetindex, {
			method: "GET",
		}).then(res => res.json())
	}

	getinvite(src: NID): Promise<InviteResponse> {
		return fetch(`${this.urlgetinvite}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(src),
		}).then(res => res.json())
	}

	addPeer(nid: NID): Promise<ResponseCode> {
		return fetch(this.urladdpeer, {
			method: "POST",
			body: JSON.stringify(nid),
		})
			.then(() => ResponseCode.OK)
			.catch(() => ResponseCode.ERROR)
	}
}
