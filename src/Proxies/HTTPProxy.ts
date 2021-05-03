import fetch, { Response } from "node-fetch"
import APIS from "../apis"
import { ItemType as IT, ResponseCode } from "../enums"
import {
	Item,
	IndexArray,
	NID,
	Invite,
	VesselResponse,
	Sid,
	Api,
	FetchOptions,
	PermissionGrant,
} from "../interfaces"
import Proxy from "./Proxy"

export default class HTTPProxy extends Proxy {
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

	async send(item: Item, data?: string): Promise<void> {
		const res = await this.fetch(APIS.senditemmeta, {
			body: JSON.stringify(item),
		})
		if (!res) return
		const resobj: VesselResponse<Sid> = await res.json()
		if (resobj.code === ResponseCode.DNE) return
		if (!resobj.data?.sid) throw Error("HTTPProxy.send: no Sid received")
		this.fetch(APIS.senditemdata, {
			params: resobj.data.sid,
			body: JSON.stringify({ data }),
		})
	}

	fetchItems(items: Item[]): Promise<string | null>[] {
		return items.map(i => this.fetchItem(i))
	}

	private async fetchItem(item: Item): Promise<string | null> {
		if (item.type === IT.Dir) return null
		const res = await this.fetch(APIS.getitem, {
			body: JSON.stringify(item),
		})
		if (!res) return null
		const resobj: VesselResponse<string> = await res.json()
		return resobj.data ?? null
	}

	async fetchIndex(): Promise<IndexArray | null> {
		const res = await this.fetch(APIS.getindex)
		if (!res) return null
		const resobj: VesselResponse<IndexArray> = await res.json()
		if (!resobj?.data)
			throw Error("HTTPProxy.fetchIndex: no IndexArray received")
		return resobj.data
	}

	async getinvite(src: NID): Promise<Invite | null> {
		const res = await this.fetch(APIS.getinvite, { body: JSON.stringify(src) })
		if (!res) return null
		const resobj: VesselResponse<Invite> = await res.json()
		if (!resobj.data) throw Error("HTTPProxy.getinvite: no Invite received")
		return resobj.data
	}

	async addPeer(src: NID): Promise<void> {
		const res = await this.fetch(APIS.addpeer, { body: JSON.stringify(src) })
		if (!res) throw Error("no res")
		const resobj: VesselResponse = await res.json()
		if (resobj.code !== ResponseCode.DNE) throw Error(resobj.msg)
	}

	async reqPerm(src: NID): Promise<void> {
		const res = await this.fetch(APIS.reqPerm, { body: JSON.stringify(src) })
		if (!res) return
		const resobj: VesselResponse = await res.json()
		if (resobj.code !== ResponseCode.DNE)
			throw Error("HTTPProxy.reqPerm: permission request not received")
	}

	async grantPerm(grant: PermissionGrant): Promise<void> {
		const res = await this.fetch(APIS.grantPerm, {
			body: JSON.stringify(grant),
		})
		if (!res) return
		const resobj: VesselResponse = await res.json()
		if (resobj.code !== ResponseCode.DNE)
			throw Error("HTTPProxy.grantPerm: permission grant not received")
	}

	async checkIndexVer(id: string): Promise<IndexArray | null> {
		const res = await this.fetch(APIS.checkIndexVer, {
			body: JSON.stringify({ id }),
		})
		if (!res) return null
		const resobj: VesselResponse<IndexArray> = await res.json()
		return resobj.data ?? null
	}
}
