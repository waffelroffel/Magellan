import {
	createServer,
	IncomingMessage,
	RequestListener,
	Server,
	ServerResponse,
} from "http"
import { URL } from "url"
import { Medium, stringToActionType, stringToItemType } from "./enums"
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
		this.server = createServer(this.makeReqLis(this.base))
		this.vessel = vessel
	}

	listen() {
		this.server.listen(this.port, this.host, () => {
			console.log(this.vessel.user, this.server.address())
		})
	}

	private makeReqLis(base: string): RequestListener {
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
		if (new URL(url, base).searchParams.get("get") === "index")
			return res.end(this.vessel.index.serialize())

		const params = new URL(url, base).searchParams
		// TODO: check for uuid and hash
		// TODO: clean later
		const path = params.get("path")
		const uuid = params.get("uuid")
		const type = params.get("type")
		const lastModified = params.get("lastModified")
		const lastAction = params.get("lastAction")
		const lastActionBy = params.get("lastActionBy")
		if (!path) throw Error("VesselServer.reqPOST: illegal params")
		if (!uuid) throw Error("VesselServer.reqPOST: illegal params")
		if (!type) throw Error("VesselServer.reqPOST: illegal params")
		if (!lastModified) throw Error("VesselServer.reqPOST: illegal params")
		if (!lastAction) throw Error("VesselServer.reqPOST: illegal params")
		if (!lastActionBy) throw Error("VesselServer.reqPOST: illegal params")

		const item: Item = {
			path,
			uuid,
			type: stringToItemType(type),
			lastModified: parseInt(lastModified),
			lastAction: stringToActionType(lastAction),
			lastActionBy,
		}

		this.vessel.createRS(item)?.pipe(res) // TODO: add logic if null

		//throw Error("VesselServer.reqGET: invalid get parameter")
	}

	private reqPOST(
		req: IncomingMessage,
		url: string,
		base: string,
		res: ServerResponse
	): void {
		const params = new URL(url, base).searchParams
		// TODO: clean later
		const path = params.get("path")
		const uuid = params.get("uuid")
		const type = params.get("type")
		const lastModified = params.get("lastModified")
		const lastAction = params.get("lastAction")
		const lastActionBy = params.get("lastActionBy")
		//const hash = params.get("lastActionBy") // TODO: add hash and tomb
		if (!path) throw Error("VesselServer.reqPOST: illegal params")
		if (!uuid) throw Error("VesselServer.reqPOST: illegal params")
		if (!type) throw Error("VesselServer.reqPOST: illegal params")
		if (!lastModified) throw Error("VesselServer.reqPOST: illegal params")
		if (!lastAction) throw Error("VesselServer.reqPOST: illegal params")
		if (!lastActionBy) throw Error("VesselServer.reqPOST: illegal params")

		const item: Item = {
			path,
			uuid,
			type: stringToItemType(type),
			lastModified: parseInt(lastModified),
			lastAction: stringToActionType(lastAction),
			lastActionBy,
		}

		this.vessel.applyIncoming(item, req)
	}
}

//if (require.main === module) new VesselServer().listen()
