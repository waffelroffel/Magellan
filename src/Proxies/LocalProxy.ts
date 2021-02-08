import { ABCVessel } from "../ABCVessel"
import CargoList from "../CargoList"
import { Medium } from "../enums"
import { NID, Item, Streamable } from "../interfaces"
import Vessel from "../Vessel"

export default class Proxy extends ABCVessel {
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
