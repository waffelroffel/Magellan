import fetch, { Response } from "node-fetch"
import { ItemType as IT, Medium, ResponseCode } from "../enums"
import {
	Item,
	IndexArray,
	NID,
	Invite,
	VesselResponse,
	Sid,
	Api,
	FetchOptions,
	VesselAPIs,
} from "../interfaces"
import Proxy from "./Proxy"

// TODO: put it somewhere else
export const APIS: VesselAPIs = {
	senditemmeta: {
		end: "/item/meta",
		method: "POST",
		headers: { "Content-Type": "application/json" },
	},
	senditemdata: {
		end: "/item/data/",
		method: "POST",
		headers: { "content-type": "application/binary" },
	},
	getitem: {
		end: "/item",
		method: "POST",
		headers: { "Content-Type": "application/json" },
	},
	getindex: {
		end: "/index",
		method: "GET",
	},
	getinvite: {
		end: "/invite",
		method: "POST",
		headers: { "Content-Type": "application/json" },
	},
	addpeer: {
		end: "/addpeer",
		method: "POST",
		headers: { "Content-Type": "application/json" },
	},
}

export default class HTTPProxy extends Proxy {
	type = Medium.http
	nid: NID
	private protocol = "http://"
	private base: string

	constructor(nid: NID, admin?: boolean) {
		super(admin)
		this.nid = nid
		this.base = `${this.protocol}${nid.host}:${nid.port}`
	}

	private fetch(api: Api, opts?: FetchOptions): Promise<Response> {
		return fetch(`${this.base}${api.end}${opts?.params ?? ""}`, {
			method: api.method,
			headers: api.headers,
			body: opts?.body,
		})
	}

	async send(item: Item, rs?: NodeJS.ReadableStream): Promise<void> {
		const res = await this.fetch(APIS.senditemmeta, {
			body: JSON.stringify(item),
		})
		const resobj: VesselResponse<Sid> = await res.json()
		if (resobj.code === ResponseCode.DNE) return
		if (!resobj.data?.sid) throw Error("HTTPProxy.send: no Sid received") // TODO: error logic
		this.fetch(APIS.senditemdata, { params: resobj.data.sid, body: rs })
	}

	fetchItems(items: Item[]): (Promise<NodeJS.ReadableStream> | null)[] {
		return items.map(i => (i.type === IT.File ? this.fetchItem(i) : null))
	}

	private fetchItem(item: Item): Promise<NodeJS.ReadableStream> {
		return this.fetch(APIS.getitem, { body: JSON.stringify(item) }).then(
			res => res.body
		)
	}

	fetchIndex(): Promise<IndexArray> {
		return this.fetch(APIS.getindex).then(res => res.json())
	}

	async getinvite(src: NID): Promise<Invite> {
		const res = await this.fetch(APIS.getinvite, { body: JSON.stringify(src) })
		const json: VesselResponse<Invite> = await res.json()
		if (!json.data) throw Error("HTTPProxy.getinvite: no Invite received") // TODO: error logic
		return json.data
	}

	async addPeer(nid: NID): Promise<ResponseCode> {
		this.fetch(APIS.addpeer, { body: JSON.stringify(nid) })
		return ResponseCode.DNE // TODO: ¯\_(ツ)_/¯
	}
}
