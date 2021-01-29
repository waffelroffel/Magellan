const hs = require("hyperswarm") // TODO: make hyperswarm.d.ts
import * as crypto from "crypto"
import { EventEmitter } from "events"
import { Socket } from "net"
import Ship from "../Ship"

interface Gate {
	address: string
	port: number
}
export default class PeerManager extends EventEmitter {
	swarm
	topic: string | Buffer
	DEFAULT_PORT: number = 13595
	gate: Gate = { address: "", port: this.DEFAULT_PORT }
	port: number
	Magellan: Ship
	sockets: Set<Socket>
	peers = new Set<string>()

	constructor(
		magellan: any,
		topic: string,
		port: number,
		ephemeral: boolean = false
	) {
		super()

		this.Magellan = magellan
		this.swarm = hs({ ephemeral: ephemeral })
		this.topic = this.processTopic(topic)
		this.port = port || this.DEFAULT_PORT
		this.swarm.listen(port)
		this.join(() => {
			this.gate = this.swarm.remoteAddress()
			console.log("Using gate:", this.gate)
		})

		this.sockets = this.swarm.connections

		this.setup()
	}

	processTopic(topic: string): Buffer {
		return crypto.createHash("sha256").update(topic).digest()
	}

	join(cb: any): void {
		if (this.swarm === null) return
		this.swarm.join(
			this.topic,
			{
				lookup: true, // find & connect to peers
				announce: true, // announce self as a connection target
			},
			cb
		)
	}

	setup(): void {
		this.swarm
			.on("connection", (socket: Socket, info: any) => {
				socket.on("error", (error: Error) => this.Magellan.emit("error", error))

				//if (this.Magellan.DM) this.Magellan.DM.add(socket)
			})
			// TODO: fix socket closing
			.on("disconnection", (socket: Socket, info: any) => {
				//console.log(info.host, "disconnected");
				socket.destroy()
				//this.peers.delete(info.host);
			})
			// TODO: fix
			.on("peer", (peer: { host: string; port: number }) => {
				if (this.peers.has(peer.host)) return
				this.peers.add(peer.host)
				this.Magellan.log("Found peer", peer.host, peer.port)
			})
			.on("error", (error: Error) => this.Magellan.emit("error", error))
	}
}
