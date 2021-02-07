import { ReadStream } from "fs"
import { Socket } from "net"
import { Stream } from "stream"
import { isRegExp } from "util"
import { v4 } from "uuid"
import { ABCVessel } from "./ABCVessel"
import CargoList, { Item } from "./CargoList"
import Vessel from "./Vessel"

class Proxy extends ABCVessel {
	ip: string
	port: string
	type: Medium
	private local?: Vessel

	constructor(nid: NID, type: Medium, vessel?: Vessel) {
		super()
		this.ip = nid.ip
		this.port = nid.port
		this.type = type
		if (type === Medium.local && vessel) this.local = vessel
		else this.setupCommunication()
	}

	async send(src: NID, item: Item, rs?: Streamable): Promise<void> {
		if (this.type === Medium.local) this.local?.applyIncoming(item, rs)
	}

	private setupCommunication(): void {
		throw new Error("Method not implemented.")
	}

	fetch(src: NID, items: Item[]): Promise<Streamable>[] {
		return items.map(i => this.createStream(i))
	}

	// TODO: clean
	fetchIndex(src: NID): CargoList | Streamable {
		switch (this.type) {
			case Medium.local:
				return this.local?.index ?? null
			case Medium.http:
				throw new Error("Method not implemented.")
			case Medium.socket:
				throw new Error("Method not implemented.")
			default:
				return null
		}
	}

	private async createStream(item: Item): Promise<Streamable> {
		switch (this.type) {
			case Medium.local:
				return this.local?.createRS(item.path) ?? null
			case Medium.http:
				throw new Error("Method not implemented.")
			case Medium.socket:
				throw new Error("Method not implemented.")
			default:
				return null
		}
	}

	//TODO: overload === instead
	comp(nid: NID): boolean {
		return this.ip === nid.ip && this.port === nid.port
	}

	// TODO: temp
	createRS(path: string) {
		return this.local?.createRS(path) ?? null
	}
}

export const enum Medium {
	http,
	socket,
	local,
}

interface NID {
	ip: string
	port: string
}

export type Streamable = ReadStream | Socket | null // TODO: workaround null and add HTTPS

export default class NetworkInterface {
	ip: string
	port: string
	network: Proxy[] = []

	constructor() {
		this.ip = v4()
		this.port = v4()
	}

	nid(): NID {
		return { ip: this.ip, port: this.port }
	}

	addNode(nid: NID, type: Medium, vessel?: Vessel): Proxy {
		const proxy = new Proxy(nid, type, vessel)
		this.network.push(proxy)
		return proxy
	}

	removeNode(nid: NID): void {
		this.network = this.network.filter(p => !p.comp(nid))
	}

	broadcast(src: NID, item: Item, rs?: Streamable): void {
		this.network.forEach(p => p.send(src, item, rs))
	}

	// clean async
	requestItems(
		src: NID,
		dst: NID,
		items: Item[]
	): Promise<Streamable>[] | null {
		const proxy = this.network.find(p => !p.comp(dst))
		return proxy?.fetch(src, items) ?? null
	}
}
