import { createReadStream, createWriteStream, ReadStream } from "fs"
import {
	createServer,
	IncomingMessage,
	RequestListener,
	Server,
	ServerOptions,
	ServerResponse,
} from "http"
import { decode } from "querystring"
import { parse, URL } from "url"
import { ActionTypes, ItemTypes } from "./enums"
import { Item } from "./interfaces"

const enum DEFAULT_SETTINGS {
	HOST = "localhost",
	PORT = 8000,
}

export default class VesselServer {
	host: string
	port: number
	base: string
	server: Server
	protocol = "http://"

	constructor(host?: string, port?: number) {
		this.host = host ?? DEFAULT_SETTINGS.HOST
		this.port = port ?? DEFAULT_SETTINGS.PORT
		this.base = `${this.protocol}${this.host}:${this.port}`
		console.log("contructor", this.base)
		this.server = createServer(this.makeRL(this.base))
	}

	listen() {
		this.server.listen(this.port, this.host, () => {
			console.log(this.server.address())
		})
	}

	private makeRL(base: string): RequestListener {
		return (req, res) => {
			if (!req.url) throw Error("VesselServer.requestListener: url undefined")
			const params = new URL(req.url, base).searchParams

			// TODO: clean later
			const path = params.get("path")
			const uuid = params.get("uuid")
			const type = params.get("type")
			const lastModified = params.get("lastModified")
			const lastAction = params.get("lastAction")
			const lastActionBy = params.get("lastActionBy")

			if (!path) throw Error("VesselServer.checkParams: illegal params")
			if (!uuid) throw Error("VesselServer.checkParams: illegal params")
			if (!type) throw Error("VesselServer.checkParams: illegal params")
			if (!lastModified) throw Error("VesselServer.checkParams: illegal params")
			if (!lastAction) throw Error("VesselServer.checkParams: illegal params")
			if (!lastActionBy) throw Error("VesselServer.checkParams: illegal params")

			const item: Item = {
				path,
				uuid,
				type: type === "1" ? ItemTypes.File : ItemTypes.Folder,
				lastModified: parseInt(lastModified),
				lastAction: lastAction === "1" ? ActionTypes.Add : ActionTypes.Remove, // TODO
				lastActionBy,
			}

			console.log(item)

			req.pipe(process.stdout)
			res.end("OK")
		}
	}

	private checkParams(params: URLSearchParams): boolean {
		if (!params.get("path")) return false
		if (!params.get("uuid")) return false
		if (!params.get("type")) return false
		if (!params.get("lastModified")) return false
		if (!params.get("lastAction")) return false
		if (!params.get("lastActionBy")) return false
		return true
	}
}

if (require.main === module) new VesselServer().listen()
