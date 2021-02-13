import { ReadStream } from "fs"
import { v4 as uuid4 } from "uuid"
import CargoList from "../CargoList"
import { Medium } from "../enums"
import { Item } from "../interfaces"
import Vessel from "../Vessel"
import Proxy from "./Proxy"

export default class LocalProxy extends Proxy {
	type = Medium.local
	private local: Vessel

	constructor(vessel: Vessel) {
		super()
		this.local = vessel
	}

	send(item: Item, rs?: ReadStream): void {
		this.local.applyIncoming(item, rs)
	}

	fetch(items: Item[]): (ReadStream | null)[] {
		return items.map(i => {
			const rs = this.local.createSC(this.local.root)(i, this.type) // TODO: clean
			if (!rs || rs instanceof ReadStream) return rs
			else throw Error("LocalProxy.fetch: failed to create ReadStream")
		})
	}

	fetchIndex(): CargoList {
		return this.local.index
	}
}
