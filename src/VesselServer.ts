import fastify, { FastifyInstance } from "fastify"
import CargoList from "./CargoList"
import { Medium, ResponseCode as RC } from "./enums"
import {
	Item,
	NID,
	Invite,
	Sid,
	VesselResponse,
	StreamResponse,
} from "./interfaces"
import { uuid } from "./utils"
import Vessel from "./Vessel"

// TODO: move or remove
const DEFAULT_SETTINGS = {
	HOST: "localhost",
	PORT: 8000,
}

export default class VesselServer {
	host: string
	port: number
	server: FastifyInstance
	vessel: Vessel
	tempitems = new Map<string, Item>()

	constructor(vessel: Vessel, host?: string, port?: number) {
		this.vessel = vessel
		this.host = host ?? DEFAULT_SETTINGS.HOST
		this.port = port ?? DEFAULT_SETTINGS.PORT
		this.server = fastify()
		this.setupRoutes()
		this.server.addContentTypeParser("application/binary", (r, q, d) => d(null))
	}

	listen(): Promise<string> {
		return this.server.listen(this.port, this.host)
	}

	close(): void {
		this.server.close()
	}

	// TODO: add response type validation
	private setupRoutes(): void {
		this.server.get("/index", async () => this.vessel.index.serialize())

		this.server.post<{ Body: NID; Reply: VesselResponse<Invite> }>(
			"/invite",
			async req => {
				// TODO: move inside Vessel
				const ir: Invite = {
					sharetype: this.vessel.sharetype,
					peers: this.vessel.proxylist.serialize().map(p => p.nid),
					privs: this.vessel.genDefaultPrivs(),
				}
				this.vessel.proxylist.addNode(Medium.http, { nid: req.body })
				this.vessel.save() // TODO: move inside Vessel
				return { msg: "Access granted", code: RC.OK, data: ir }
			}
		)

		this.server.post<{ Body: Item; Reply: StreamResponse }>(
			"/item",
			async req => {
				if (!CargoList.validateItem(req.body))
					return { msg: "Illegal item state", code: RC.ERR }
				const rs = this.vessel.getRS(req.body)
				return rs ?? { msg: "Item doesn't exist", code: RC.ERR }
			}
		)

		// TODO: fix REM
		this.server.post<{ Body: Item; Reply: VesselResponse<Sid> }>(
			"/item/meta",
			async req => {
				if (!CargoList.validateItem(req.body))
					return { msg: "Illegal item state", code: RC.ERR }
				const sid = uuid()
				this.tempitems.set(sid, req.body)
				return { msg: "Send Data with sid", code: RC.OK, data: { sid } }
			}
		)

		// TODO: add schema for body
		this.server.post<{ Params: Sid; Reply: VesselResponse }>(
			"/item/data/:sid",
			async req => {
				const item = this.tempitems.get(req.params.sid)
				if (!item) return { msg: "Item not in templist", code: RC.ERR }
				this.vessel.applyIncoming(item, req.raw) // TODO: return boolean ?
				return { msg: "Transfer successful", code: RC.OK }
			}
		)

		this.server.post<{ Body: NID; Reply: VesselResponse }>(
			"/item/data/addpeer",
			async req => {
				// Assuming no updateCargo is needed
				if (this.vessel.proxylist.has(req.body))
					return { msg: "Peer already added", code: RC.OK }
				this.vessel.proxylist.addNode(Medium.http, { nid: req.body })
				this.vessel.save() // TODO: move inside Vessel
				return { msg: "Peer added", code: RC.OK }
			}
		)
	}
}
