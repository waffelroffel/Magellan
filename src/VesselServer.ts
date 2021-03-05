import {
	createServer,
	IncomingMessage,
	RequestListener,
	Server,
	ServerResponse,
} from "http"
import { URL } from "url"
import {
	ActionTypes as AT,
	ItemTypes as IT,
	toActionType,
	toItemType,
	toTombTypes,
} from "./enums"
import { Item } from "./interfaces"
import Vessel from "./Vessel"

const enum DEFAULT_SETTINGS {
	HOST = "localhost",
	PORT = 8000,
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
		this.server = createServer(this.reqLis(this.base))
		this.vessel = vessel
	}

	listen() {
		this.server.listen(this.port, this.host, () => {
			this.vessel.logger("ONLINE", this.server.address())
		})
	}

	private reqLis(base: string): RequestListener {
		return (req, res) => {
			if (!req.url) throw Error("VesselServer.requestListener: url undefined")
			if (req.method === "POST") this.reqPOST(req, req.url, base, res)
			else if (req.method === "GET") this.reqGET(req, req.url, base, res)
			else throw Error("VesselServer.requestListener: method not POST nor GET")
		}
	}

	private reqGET(
		req: IncomingMessage,
		url: string,
		base: string,
		res: ServerResponse
	): void {
		const params = new URL(url, base).searchParams
		const get = new URL(url, base).searchParams.get("get")
		if (get === "index") return res.end(this.vessel.index.serialize())
		//if (get === "proxies") return res.end(this.vessel.getProxies())

		// TODO: check for uuid and hash
		const cparams = this.checkCoreParams(params)
		if (!cparams) return res.destroy() // TODO: add error message

		//const hash = params.get("hash")
		//if (!hash) throw Error("VesselServer.reqGET: illegal params")

		const item: Item = {
			path: cparams[0],
			uuid: cparams[1],
			type: toItemType(cparams[2]),
			lastModified: parseInt(cparams[3]),
			lastAction: toActionType(cparams[4]),
			lastActionBy: cparams[5],
			actionId: cparams[6],
		}

		if (item.lastAction === AT.Remove) return res.destroy() // TODO: error message: illegal argument

		// TODO: validate file before creating stream
		this.vessel.createRS(item)?.pipe(res) ?? res.destroy() // TODO: error message: file not found
	}

	private reqPOST(
		req: IncomingMessage,
		url: string,
		base: string,
		res: ServerResponse
	): void {
		const params = new URL(url, base).searchParams

		const cparams = this.checkCoreParams(params)
		if (!cparams) return res.destroy() // TODO: add error message: illegal params

		const item: Item = {
			path: cparams[0],
			uuid: cparams[1],
			type: toItemType(cparams[2]),
			lastModified: parseInt(cparams[3]),
			lastAction: toActionType(cparams[4]),
			lastActionBy: cparams[5],
			actionId: cparams[6],
		}

		if (item.lastAction === AT.Remove && !this.applyTomb(item, params))
			throw Error()

		const hash = params.get("hash")
		if (item.type === IT.File && hash) item.hash = hash
		// else if (item.type === IT.Folder && hash !== "undefined") throw Error("VesselServer.reqPOST: illegal params")

		console.log(item.path)
		this.vessel.applyIncoming(item, req) // TODO: return boolean
		res.end("Transfer successful")
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
