import { readFileSync } from "fs";
import { Socket } from "net";
import { join } from "path";
import { ActionTypes, NodeItem } from "../IndexTable";
import Ship from "../Ship";
import PeerManager from "./PeerManager";

export default class UploadManager {
	Magellan: Ship;
	PM: PeerManager;

	constructor(magallan: Ship, pm: PeerManager) {
		this.Magellan = magallan;
		this.PM = pm;
	}

	broadcastFile(name: string,): void {
		const path = join(this.Magellan.root, name)
		const meta = this.Magellan.index.index.get(name)
		if (!meta) return
		console.log("send", meta)
		this.PM.swarm.connections.forEach(async (socket: Socket) => {
			let payload: Payload
			if (meta.lastAction === ActionTypes.Remove) {
				payload = { name, meta }
			}
			else {
				const data = readFileSync(path).toJSON()
				payload = { name, meta, data }
			}
			socket.end(JSON.stringify(payload))
		});
	}
}
export interface Payload {
	name: string,
	meta: NodeItem,
	data?: {
		type: "Buffer";
		data: number[];
	}
}