import { unlinkSync, writeFileSync } from "fs"
import { Socket } from "net"
import { ActionTypes } from "../CargoList"
import Ship from "../Ship"
import PeerManager from "./PeerManager"
import { Payload } from "./UploadManager"

export default class DownloadManager {
	Magellan: Ship
	PM: PeerManager
	IOmap = new Map<Socket, Buffer>()

	constructor(magellan: Ship, pm: PeerManager) {
		this.Magellan = magellan
		this.PM = pm
	}

	setup(): void {
		this.PM.sockets.forEach((element: Socket) => {
			console.log(element)
		})
	}

	add(socket: Socket): void {
		socket
			.on("data", (data) => {
				const buf = this.IOmap.get(socket) || Buffer.from("")
				this.IOmap.set(socket, Buffer.concat([buf, data]))
			})
			.on("end", () => {
				const json: Payload = JSON.parse(
					this.IOmap.get(socket)?.toString() || "{}"
				)
				if (!json.name) return
				// index
				if (!this.Magellan.index.apply(json.name, json.meta)) return
				// io
				if (
					json.data &&
					(json.meta.lastAction === ActionTypes.Change ||
						json.meta.lastAction === ActionTypes.Add)
				)
					writeFileSync(
						this.Magellan.root + "\\" + json.name,
						Buffer.from(JSON.stringify(json.data))
					)
				else if (!json.data && json.meta.lastAction === ActionTypes.Remove) {
					try {
						unlinkSync(this.Magellan.root + "\\" + json.name)
					} catch (error) {}
				}
				this.Magellan.index.save()
				this.IOmap.set(socket, Buffer.from(""))
			})
	}
}
