import fastify, { FastifyInstance } from "fastify"
import CargoList from "./CargoList"
import { Medium } from "./enums"
import { InviteResponse, Item, NID, Sid } from "./interfaces"
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

	// TODO: add proper generics
	private setupRoutes(): void {
		this.server.get("/index", async () => this.vessel.index.serialize())

		this.server.post<{ Body: NID }>("/invite", async req => {
			const ir: InviteResponse = {
				sharetype: this.vessel.sharetype,
				peers: this.vessel.proxylist.serialize().map(p => p.nid),
				privs: this.vessel.genDefaultPrivs(),
			}
			this.vessel.proxylist.addNode(Medium.http, {
				nid: req.body,
			})
			return ir
		})

		this.server.post<{ Body: Item }>("/item", async req => {
			if (!CargoList.validateItem(req.body))
				return { error: "Illegal item state" }
			const rs = this.vessel.getRS(req.body)
			return rs ?? { error: "trying to get folder or deleted item" }
		})

		this.server.post<{ Body: Item }>("/item/meta", async req => {
			if (!CargoList.validateItem(req.body))
				return { error: "Illegal item state" }
			const sid = uuid()
			this.tempitems.set(sid, req.body)
			return { msg: "DATA", sid: sid }
		})

		// TODO: add schema for body
		this.server.post<{ Params: Sid }>("/item/data/:sid", async req => {
			const item = this.tempitems.get(req.params.sid)
			if (!item) return { error: "item not in templist" }
			this.vessel.applyIncoming(item, req.raw) // TODO: return boolean ?
			return { msg: "Transfer succesfull" }
		})
	}
}
