import fastify, { FastifyInstance } from "fastify"
import CargoList from "./CargoList"
import { ActionType, PERMISSION, ResponseCode as RC } from "./enums"
import {
	Item,
	NID,
	Invite,
	Sid,
	VesselResponse,
	IndexArray,
	PermissionGrant,
} from "./interfaces"
import { uuid } from "./utils"
import Vessel from "./Vessel"

export default class VesselServer {
	host: string
	port: number
	server: FastifyInstance
	vessel: Vessel
	tempitems = new Map<string, Item>()

	constructor(vessel: Vessel, host: string, port: number) {
		this.vessel = vessel
		this.host = host
		this.port = port
		this.server = fastify()
		this.setupClientApi()
		this.setupRoutes()
		//this.server.addContentTypeParser("app/binary", (_, __, d) => d(null))
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
					case "disconnect":
						this.vessel.disconnect()
						return { msg: "vessel offline", code: RC.DNE }
					case "exit":
						this.vessel.exit()
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

		this.server.post<{ Body: Item; Reply: VesselResponse<string> }>(
			"/item",
			async req => {
				if (!CargoList.validateItem(req.body))
					return { msg: "Illegal item state", code: RC.ERR }
				const data = this.vessel.getData(req.body)
				if (!data) return { msg: "Item doesn't exist", code: RC.ERR }
				return { msg: "Item data", code: RC.ERR, data }
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

		this.server.post<{
			Body: { data: string }
			Params: Sid
			Reply: VesselResponse
		}>("/item/data/:sid", async req => {
			const item = this.tempitems.get(req.params.sid)
			if (!item) return { msg: "Sid not in queue", code: RC.ERR }
			this.tempitems.delete(req.params.sid)
			this.vessel.applyIncoming(item, req.body.data)
			return { msg: "Transfer successful", code: RC.DNE }
		})

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
			Reply: VesselResponse
		}>("/reqpermission", async req => {
			if (!this.vessel.isAdmin) return { msg: "Peer not admin", code: RC.ERR }
			this.vessel.requestPerm(req.body, req.query.get)
			return { msg: `${req.query.get} permission under review`, code: RC.DNE }
		})

		this.server.post<{ Body: PermissionGrant; Reply: VesselResponse }>(
			"/grantpermission",
			async req => {
				this.vessel.setPerm(req.body)
				return { msg: `${req.body.priv} permission received`, code: RC.DNE }
			}
		)

		this.server.post<{
			Body: { nid: NID; id: string }
			Reply: VesselResponse<IndexArray>
		}>("/checkindex", async req => {
			const index = this.vessel.checkIndexVer(req.body.nid, req.body.id)
			if (!index) return { msg: "Index version equal", code: RC.DNE }
			return { msg: "Index not equal", code: RC.DNE, data: index }
		})
	}
}
