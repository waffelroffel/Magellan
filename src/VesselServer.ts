import {
	createServer,
	IncomingMessage,
	RequestListener,
	Server,
	ServerResponse,
} from "http"
import { AddressInfo } from "net"
import { URL } from "url"
import {
	ActionType as AT,
	ItemType as IT,
	Medium,
	toActionType,
	toItemType,
	toTombTypes,
} from "./enums"
import { InviteResponse, Item } from "./interfaces"
import Vessel from "./Vessel"

const DEFAULT_SETTINGS = {
	HOST: "localhost",
	PORT: 8000,
}

export default class VesselServer {
	host: string
	port: number
	base: string
	server: Server
	protocol = "http://"
	vessel: Vessel

	constructor(vessel: Vessel, host?: string, port?: number) {
		this.host = host ?? DEFAULT_SETTINGS.HOST
		this.port = port ?? DEFAULT_SETTINGS.PORT
		this.base = `${this.protocol}${this.host}:${this.port}`
		this.server = createServer(this.reqLis())
		this.vessel = vessel
	}

	listen(post: (nid: string | AddressInfo | null) => void) {
		this.server.listen(this.port, this.host, () => {
			post(this.server.address())
		})
	}

	close() {
		this.server.close()
	}

	private reqLis(): RequestListener {
		return (req, res) => {
			if (req.method === "POST") this.reqPOST(req, res)
			else if (req.method === "GET") this.reqGET(req, res)
			else throw Error(`VesselServer.reqLis: ${req.method} unsupported`)
		}
	}

	private reqGET(req: IncomingMessage, res: ServerResponse): void {
		const params = this.getParams(req)
		const get = params.get("get")
		if (get === "index") return res.end(this.vessel.index.serialize())
		if (get === "nids") return this.getInvite(params, res)

		const cparams = this.checkCoreParams(params)
		if (!cparams) return res.destroy() // TODO: add error message

		const item = this.makeItem(cparams)
		if (item.lastAction === AT.Remove) return res.destroy() // TODO: error message: illegal argument
		// TODO: add hash and validate file before creating stream
		this.vessel.getRS(item)?.pipe(res) ?? res.destroy() // TODO: error message: file not found
	}

	private reqPOST(req: IncomingMessage, res: ServerResponse): void {
		const params = this.getParams(req)
		const cparams = this.checkCoreParams(params)
		if (!cparams) return res.destroy() // TODO: add error message: illegal params

		const item = this.makeItem(cparams)
		if (item.lastAction === AT.Remove && !this.applyTomb(item, params))
			throw Error()
		const hash = params.get("hash")
		if (item.type === IT.File && hash) item.hash = hash
		// else if (item.type === IT.Folder && hash !== "undefined") throw Error("VesselServer.reqPOST: illegal params")

		this.vessel.applyIncoming(item, req) // TODO: return boolean
		res.end("Transfer successful")
	}

	private getInvite(params: URLSearchParams, res: ServerResponse): void {
		const host = params.get("srchost")
		const port = params.get("srcport")
		if (!host || !port) return res.destroy()
		const ir: InviteResponse = {
			sharetype: this.vessel.sharetype,
			peers: this.vessel.proxyinterface.serialize().map(p => p.nid),
		}
		res.end(JSON.stringify(ir))
		this.vessel.addVessel(Medium.http, { nid: { host, port: +port } })
	}

	private getParams(req: IncomingMessage): URLSearchParams {
		if (!req.url) throw Error()
		return new URL(req.url, this.base).searchParams
	}

	private makeItem(params: string[]): Item {
		return {
			path: params[0],
			uuid: params[1],
			type: toItemType(params[2]),
			lastModified: parseInt(params[3]),
			lastAction: toActionType(params[4]),
			lastActionBy: params[5],
			actionId: params[6],
		}
	}

	private checkCoreParams(params: URLSearchParams): string[] | null {
		const cparams = [
			params.get("path"),
			params.get("uuid"),
			params.get("type"),
			params.get("lastModified"),
			params.get("lastAction"),
			params.get("lastActionBy"),
			params.get("actionId"),
		]

		return cparams.every(Boolean) ? (cparams as string[]) : null
	}

	private checkTombParams(params: URLSearchParams): (string | null)[] | null {
		const tparams = [params.get("tombtype"), params.get("movedto")]
		return !tparams[0] && tparams[1] ? null : tparams
	}

	private applyTomb(item: Item, params: URLSearchParams): boolean {
		const tparams = this.checkTombParams(params)
		if (!tparams || !tparams[0]) return false
		item.tomb = { type: toTombTypes(tparams[0]) }
		if (tparams[1]) item.tomb.movedTo = tparams[1]
		return true
	}
}
