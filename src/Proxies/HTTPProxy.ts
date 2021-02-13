import { createReadStream, ReadStream } from "fs"
import { Socket } from "net"
import fetch from "node-fetch"
import CargoList from "../CargoList"
import { ActionTypes, ItemTypes, Medium } from "../enums"
import { NID, Item, Streamable } from "../interfaces"
import Proxy from "./Proxy"
export default class HTTPProxy extends Proxy {
	type = Medium.http
	protocol = "http://"
	host: string
	port: number

	constructor(host: string, port: number) {
		super()
		this.host = host
		this.port = port
	}

	send(item: Item, rs?: Streamable): void {
		fetch(this.makeURL(item), {
			method: "POST",
			body: rs ?? undefined,
		}).then(res => res.text().then(txt => console.log(txt)))
	}

	private makeURL(item: Item): string {
		const base = `${this.protocol}${this.host}:${this.port}`
		const params = Object.entries(item)
			.map(([k, v]) => `${k}=${v}`)
			.join("&")
		return `${base}?${params}`
	}

	fetch(items: Item[], src: NID): Streamable[] {
		throw Error("HTTPProxy.fetch: not implemented")
	}

	fetchIndex(src: NID): ReadStream | Socket | CargoList | null {
		throw Error("HTTPProxy.fetchIndex: not implemented")
	}
}
if (require.main === module) {
	const item = CargoList.newItem(
		"path123",
		"uuid123",
		ItemTypes.File,
		123,
		ActionTypes.Add,
		"user123"
	)

	new HTTPProxy("localhost", 8000).send(
		item,
		createReadStream("testroot/dave/root/4.txt")
	)
}
