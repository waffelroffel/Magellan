import {
	createServer,
	IncomingMessage,
	RequestListener,
	Server,
	ServerResponse,
} from "http"
import { URL } from "url"
import {
	ActionTypes,
	ItemTypes,
	stringToActionType,
	stringToItemType,
	stringToTombTypes,
	TombTypes,
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
		const params = new URL(url, base).searchParams
		const get = new URL(url, base).searchParams.get("get")
		if (get === "index") return res.end(this.vessel.index.serialize())
		//if (get === "proxies") return res.end(this.vessel.getProxies())

		// TODO: check for uuid and hash
		// TODO: clean later
		const path = params.get("path")
		const uuid = params.get("uuid")
		const type = params.get("type")
		const lastModified = params.get("lastModified")
		const lastAction = params.get("lastAction")
		const lastActionBy = params.get("lastActionBy")
		const actionId = params.get("actionId")
		//const hash = params.get("hash")
		//const tombtype = params.get("tombtype")
		//const tombmovedto = params.get("tombtype")
		if (!path) throw Error("VesselServer.reqGET: illegal params")
		if (!uuid) throw Error("VesselServer.reqGET: illegal params")
		if (!type) throw Error("VesselServer.reqGET: illegal params")
		if (!lastModified) throw Error("VesselServer.reqGET: illegal params")
		if (!lastAction) throw Error("VesselServer.reqGET: illegal params")
		if (!lastActionBy) throw Error("VesselServer.reqGET: illegal params")
		if (!actionId) throw Error("VesselServer.reqGET: illegal params")
		//if (!hash) throw Error("VesselServer.reqGET: illegal params")
		//if (!tombtype) throw Error("VesselServer.reqGET: illegal params")
		//if (!tombmovedto) throw Error("VesselServer.reqGET: illegal params")

		const item: Item = {
			path,
			uuid,
			type: stringToItemType(type),
			lastModified: parseInt(lastModified),
			lastAction: stringToActionType(lastAction),
			lastActionBy,
			actionId,
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
		console.log(params)
		// TODO: clean later
		const path = params.get("path")
		const uuid = params.get("uuid")
		const type = params.get("type")
		const lastModified = params.get("lastModified")
		const lastAction = params.get("lastAction")
		const lastActionBy = params.get("lastActionBy")
		const actionId = params.get("actionId")
		const hash = params.get("hash")
		const tombtype = params.get("tombtype")
		const tombmovedto = params.get("tombmovedto")
		if (!path) throw Error("VesselServer.reqPOST: illegal params")
		if (!uuid) throw Error("VesselServer.reqPOST: illegal params")
		if (!type) throw Error("VesselServer.reqPOST: illegal params")
		if (!lastModified) throw Error("VesselServer.reqPOST: illegal params")
		if (!lastAction) throw Error("VesselServer.reqPOST: illegal params")
		if (!lastActionBy) throw Error("VesselServer.reqPOST: illegal params")
		if (!actionId) throw Error("VesselServer.reqPOST: illegal params")
		if (!hash) throw Error("VesselServer.reqPOST: illegal params")

		const item: Item = {
			path,
			uuid,
			type: stringToItemType(type),
			lastModified: parseInt(lastModified),
			lastAction: stringToActionType(lastAction),
			lastActionBy,
			actionId,
		}

		if (stringToActionType(lastAction) === ActionTypes.Remove) {
			if (tombtype) {
				console.log("tombtype", tombtype, typeof tombtype)
				item.tomb = { type: stringToTombTypes(tombtype) }
				if (tombmovedto) {
					console.log("moveto", tombmovedto, typeof tombmovedto)
					item.tomb.movedTo = tombmovedto
				}
			}
		}

		if (stringToItemType(type) === ItemTypes.File && hash) item.hash = hash
		else if (
			stringToItemType(type) === ItemTypes.Folder &&
			hash !== "undefined"
		)
			throw Error("VesselServer.reqPOST: illegal params")

		this.vessel.applyIncoming(item, req)
	}
}
