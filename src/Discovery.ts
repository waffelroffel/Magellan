const hs = require("hyperswarm") // TODO: make hyperswarm.d.ts
import { createHash } from "crypto"
import { Socket } from "net"
import { Medium } from "./enums"
import { NID } from "./interfaces"
import NetworkInterface from "./NetworkInterface"

export default class Discovery {
	DEFAULT_PORT = 8000 + Math.floor(Math.random() * 888)
	swarm
	topic: string
	nid: Promise<NID>
	net: NetworkInterface
	added = new Set<NID>()
	src: number

	constructor(
		net: NetworkInterface,
		topic: string,
		port: number,
		temp: boolean = false
	) {
		this.net = net
		this.topic = topic
		this.swarm = hs({ ephemeral: temp })
		this.swarm.listen(this.DEFAULT_PORT)
		this.setup()
		this.src = port

		this.nid = new Promise((resolve, reject) => {
			this.swarm.join(
				this.processTopic(this.topic),
				{
					lookup: true, // find & connect to peers
					announce: true, // announce self as a connection target
				},
				() => {
					this.nid = this.swarm.remoteAddress()
					console.log("Remove Discovery address:", this.nid)
					resolve(this.nid)
				}
			)
		})
	}
	/*
	getNID(): NID {
		if (this.nid) return this.nid
		throw Error("Discovery.getNID: nid should not be undefined")
	}
    */

	processTopic(topic: string): Buffer {
		return createHash("sha256").update(topic).digest()
	}

	join(): void {
		this.swarm.join(
			this.processTopic(this.topic),
			{
				lookup: true, // find & connect to peers
				announce: true, // announce self as a connection target
			},
			() => {
				this.nid = this.swarm.remoteAddress()
				console.log("Address:", this.nid)
			}
		)
	}

	setup(): void {
		this.swarm

			.on("connection", (socket: Socket, info: any) => {
				socket.end(this.src.toString())
				socket.on("data", data => {
					if (!info.peer) return
					if (this.added.has(info.peer.host)) return
					//console.log(info.peer)
					console.log(info.peer.host, parseInt(data.toString()))
					this.net.addNode(Medium.http, {
						nid: { host: info.peer.host, port: parseInt(data.toString()) },
					})
					this.added.add(info.peer.host)
				})
				//const dst = socket.read()
				//console.log("dst=", dst)
				//this.added.add(info.peer)
				//if (this.Magellan.DM) this.Magellan.DM.add(socket)
			})

			.on("disconnection", (socket: Socket, info: any) => {
				//console.log(info.host, "disconnected");
				socket.destroy()
				//this.peers.delete(info.host);
			})

			.on("peer", (nid: NID) => {
				//console.log("peer", nid.host, nid.port)
				//this.net.addTemp(Medium.http, nid.host)
			})
			.on("error", console.log)
	}
}
