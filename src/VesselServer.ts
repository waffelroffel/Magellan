import fastify, { FastifyInstance } from "fastify"
import CargoList from "./CargoList"
import { ActionType, PERMISSION, ResponseCode as RC } from "./enums"
import {
	Item,
	NID,
	Invite,
	Sid,
	VesselResponse,
	StreamResponse,
	IndexArray,
	PermissionGrant,
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
		this.setupClientApi()
		this.setupRoutes()
		this.server.addContentTypeParser("application/binary", (r, q, d) => d(null))
	}

	listen(): Promise<string> {
		return this.server.listen(this.port, this.host)
	}

	close(): void {
		this.server.close()
	}

	private setupClientApi(): void {
		this.server.get<{ Querystring: { cmd: string }; Reply: VesselResponse }>(
			"/",
			async req => {
				if (req.hostname.split(":")[0] !== "localhost")
					return { msg: "no remote execution", code: RC.ERR }
				switch (req.query.cmd) {
					case "nid":
						return { msg: `vessel nid: ${this.vessel.nid}`, code: RC.DNE }
					case "connect":
						this.vessel.connect()
						return { msg: "vessel online", code: RC.DNE }
					case "exit":
						this.vessel.disconnect()
						return { msg: "vessel offline", code: RC.DNE }
					case "vanish":
						this.vessel.vanish()
						return { msg: "vessel vanished", code: RC.DNE }
					default:
						return { msg: "unknown cmd", code: RC.ERR }
				}
			}
		)
	}

	private setupRoutes(): void {
		this.server.get<{ Reply: VesselResponse<IndexArray> }>(
			"/index",
			async () => {
				return { msg: "Index", code: RC.DNE, data: this.vessel.getIndexArray() }
			}
		)

		this.server.post<{ Body: NID; Reply: VesselResponse<Invite> }>(
			"/invite",
			async req => {
				const invite = this.vessel.invite(req.body)
				return invite
					? { msg: "Access granted", code: RC.DNE, data: invite }
					: { msg: "Couldn't grant access", code: RC.ERR }
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

		this.server.post<{ Body: Item; Reply: VesselResponse<Sid> }>(
			"/item/meta",
			async req => {
				if (!CargoList.validateItem(req.body))
					return { msg: "Illegal item state", code: RC.ERR }
				if (req.body.lastAction === ActionType.Remove) {
					this.vessel.applyIncoming(req.body)
					return { msg: "No further action required", code: RC.DNE }
				}
				const sid = uuid()
				this.tempitems.set(sid, req.body)
				return { msg: "Send Data with sid", code: RC.NXT, data: { sid } }
			}
		)

		// TODO: add schema for body
		this.server.post<{ Params: Sid; Reply: VesselResponse }>(
			"/item/data/:sid",
			async req => {
				const item = this.tempitems.get(req.params.sid)
				if (!item) return { msg: "Sid not in queue", code: RC.ERR }
				this.tempitems.delete(req.params.sid)
				this.vessel.applyIncoming(item, req.raw) // TODO: req.body, return boolean ?
				return { msg: "Transfer successful", code: RC.DNE }
			}
		)

		this.server.post<{ Body: NID; Reply: VesselResponse }>(
			"/addpeer",
			async req => {
				// Assuming no updateCargo is needed
				if (this.vessel.addPeer(req.body))
					return { msg: "Peer already registred", code: RC.DNE }
				return { msg: "Peer added", code: RC.DNE }
			}
		)

		this.server.post<{
			Querystring: { get: PERMISSION }
			Body: NID
			Reply: VesselResponse<PermissionGrant>
		}>("/permission", async req => {
			if (!this.vessel.isAdmin) return { msg: "Peer not admin", code: RC.ERR }
			const privreq = req.query.get
			const grant = this.vessel.grantPrivs(req.body, privreq)
			return {
				msg: `${privreq} permission granted`,
				code: RC.DNE,
				data: { priv: privreq, grant },
			}
		})
	}
}
