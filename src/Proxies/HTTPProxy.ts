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
	PermissionGrant,
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
	getPriv: {
		end: "/permission",
		method: "POST",
		headers: { "Content-Type": "application/json" },
	},
}

export default class HTTPProxy extends Proxy {
	type = Medium.http
	nid: NID
	private protocol = "http://"
	private base: string

	constructor(nid: NID) {
		super()
		this.nid = nid
		this.base = `${this.protocol}${nid.host}:${nid.port}`
	}

	private async fetch(api: Api, opts?: FetchOptions): Promise<Response | null> {
		try {
			return await fetch(`${this.base}${api.end}${opts?.params ?? ""}`, {
				method: api.method,
				headers: api.headers,
				body: opts?.body,
			})
		} catch (error) {
			return null
		}
	}

	async send(item: Item, rs?: NodeJS.ReadableStream): Promise<void> {
		const res = await this.fetch(APIS.senditemmeta, {
			body: JSON.stringify(item),
		})
		if (!res) return
		const resobj: VesselResponse<Sid> = await res.json()
		if (resobj.code === ResponseCode.DNE) return
		if (!resobj.data?.sid) throw Error("HTTPProxy.send: no Sid received") // TODO: error logic
		this.fetch(APIS.senditemdata, { params: resobj.data.sid, body: rs })
	}

	fetchItems(items: Item[]): Promise<NodeJS.ReadableStream | null>[] {
		return items.map(i => this.fetchItem(i))
	}

	private async fetchItem(item: Item): Promise<NodeJS.ReadableStream | null> {
		if (item.type === IT.Dir) return null
		const res = await this.fetch(APIS.getitem, { body: JSON.stringify(item) })
		if (!res) return null
		return res.body
	}

	async fetchIndex(): Promise<IndexArray | null> {
		const res = await this.fetch(APIS.getindex)
		if (!res) return null
		const resobj: VesselResponse<IndexArray> = await res.json()
		if (!resobj?.data)
			throw Error("HTTPProxy.fetchIndex: no IndexArray received") // TODO: error logic
		return resobj.data
	}

	async getinvite(src: NID): Promise<Invite | null> {
		const res = await this.fetch(APIS.getinvite, { body: JSON.stringify(src) })
		if (!res) return null
		const resobj: VesselResponse<Invite> = await res.json()
		if (!resobj.data) throw Error("HTTPProxy.getinvite: no Invite received") // TODO: error logic
		return resobj.data
	}

	async addPeer(src: NID): Promise<ResponseCode> {
		this.fetch(APIS.addpeer, { body: JSON.stringify(src) })
		return ResponseCode.DNE // TODO: ¯\_(ツ)_/¯
	}

	async getPriv(src: NID): Promise<PermissionGrant | null> {
		const res = await this.fetch(APIS.getPriv, { body: JSON.stringify(src) })
		if (!res) return null
		const resobj: VesselResponse<PermissionGrant> = await res.json()
		if (resobj.code === ResponseCode.ERR)
			throw Error("HTTPProxy.getPriv: error code") // TODO: error logic
		if (!resobj.data) throw Error("HTTPProxy.getPriv: no grant received") // TODO: error logic
		return resobj.data
	}
}
