import { ReadStream } from "fs"
import { Socket } from "net"
import CargoList from "../CargoList"
import { Medium } from "../enums"
import { NID, Item, Streamable } from "../interfaces"
import Proxy from "./Proxy"

export default class HTTPProxy extends Proxy {
	type = Medium.http

	send(item: Item, rs?: Streamable, src?: NID): void {
		throw Error("HTTPProxy.send: not implemented")
	}

	fetch(items: Item[], src: NID): Streamable[] {
		throw Error("HTTPProxy.fetch: not implemented")
	}

	fetchIndex(src: NID): ReadStream | Socket | CargoList | null {
		throw Error("HTTPProxy.fetchIndex: not implemented")
	}
}
