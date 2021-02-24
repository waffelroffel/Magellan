import { ReadStream } from "fs"
import { Medium } from "../enums"
import { Item, NID, IndexArray } from "../interfaces"
import Vessel from "../Vessel"
import Proxy from "./Proxy"

export default class LocalProxy extends Proxy {
	type = Medium.local
	private local: Vessel

	constructor(vessel: Vessel) {
		super()
		this.local = vessel
	}

	send(item: Item, rs?: ReadStream) {
		this.local.applyIncoming(JSON.parse(JSON.stringify(item)), rs)
	}

	fetch(items: Item[]): (ReadStream | null)[] {
		return items.map(i => {
			const rs = this.local.createRS(i)
			if (!rs || rs instanceof ReadStream) return rs
			else throw Error("LocalProxy.fetch: failed to create ReadStream")
		})
	}

	fetchIndex(): IndexArray {
		return JSON.parse(this.local.index.serialize())
	}

	getProxies(): [string, NID][] {
		throw Error()
	}
}
