import { watch as chokidar } from "chokidar"
import {
	FSWatcher,
	existsSync,
	rmdirSync,
	mkdirSync,
	rmSync,
	createWriteStream,
	createReadStream,
} from "fs"
import { join, sep } from "path"
import { v4 as uuid4 } from "uuid"
import { ABCVessel } from "./Proxies/ABCVessel"
import CargoList from "./CargoList"
import {
	ItemType as IT,
	ActionType as AT,
	Medium,
	ResolveOption as RO,
} from "./enums"
import { Item, NID, IndexArray, Streamable } from "./interfaces"
import NetworkInterface from "./NetworkInterface"
import { cts, ct, computehash } from "./utils"
import Proxy from "./Proxies/Proxy"
import LocalProxy from "./Proxies/LocalProxy"
import HTTPProxy from "./Proxies/HTTPProxy"
import VesselServer from "./VesselServer"

/**
 * TODO
 * - since mem footprint is not really an issue, at least for small amount of files, 4000 files is about 0.5 MB
 * 	 the crdt can be treated as an state-based crdt during network init and rejoin
 *   and as an operation-based when online (need log for transmission gurantee) (or even just send whole state in updates)
 * - matching file hashes needs to be handled differently
 *
 */
export default class Vessel extends ABCVessel {
	user: string
	root: string
	rooti: number
	rootarr: string[]
	tableEnd = "indextable.json"
	tablePath = "indextable.json"
	watcher: FSWatcher
	index: CargoList
	skiplist = new Set<string>()
	//log = new Log()
	init = true
	skip = false
	networkinterface = new NetworkInterface()
	server: VesselServer

	localtempfilehashes = new Map<string, string>()

	constructor(user: string, root: string) {
		super()
		this.user = user

		this.root = root
		this.rooti = root.length
		this.rootarr = root.split(sep)
		this.tablePath = join(root, this.tableEnd)

		this.index = new CargoList(root)

		this.watcher = chokidar(root, { persistent: true })
		this.setupEvents()

		const { host, port } = this.networkinterface.nid
		this.server = new VesselServer(this, host, port)
	}

	nid(): NID {
		return this.networkinterface.nid
	}

	rejoin(): Vessel {
		this.skip = true
		this.index.mergewithlocal() // Assuming no changes when process is not running  // TODO: add file checking
		this.server.listen()
		return this
	}

	startnew(): Vessel {
		this.server.listen()
		return this
	}

	load() {}
	save() {}

	private removeRoot(path: string): string {
		return path.substring(this.rooti)
	}

	logger(...msg: any[]): void {
		console.log(cts(), this.user, ...msg)
	}

	private setupEvents() {
		this.watcher
			.on("add", (path: string) => this.applyLocal(path, IT.File, AT.Add))
			.on("change", (path: string) => this.applyLocal(path, IT.File, AT.Change))
			.on("unlink", (path: string) => this.applyLocal(path, IT.File, AT.Remove))
			.on("addDir", (path: string) => this.applyLocal(path, IT.Folder, AT.Add))
			.on("unlinkDir", (path: string) => {
				const patharr = path.split(sep)
				if (this.rootarr.some((p, i) => p !== patharr[i])) return // when deleting folder with files, full path is returned
				this.applyLocal(path, IT.Folder, AT.Remove)
			}) // TODO: error when deleting folder with folders due to order of deletion parent->child
			.on("error", this.logger) // TODO: when empty folder gets deleted throws error
			.on("ready", () => {
				this.init = false
				this.skip = false
				this.index.save()
				this.logger("PLVS VLTRA!")
				//this.logger(this.log.history)
			})
	}

	private applyLocal(path: string, type: IT, action: AT) {
		if (this.skiplist.delete(path) || this.skip) return
		if ([this.root, this.tablePath].includes(path)) return

		const item = CargoList.newItem(
			this.removeRoot(path),
			uuid4(),
			type,
			ct(),
			action,
			this.user
		)

		const latest = this.index.getLatest(item.path)
		item.uuid = latest?.uuid ?? item.uuid // TODO: need to apply the latest item to preserve uuid and hash
		item.hash = latest?.hash ?? item.hash // TODO: check

		if (type === IT.File && action === AT.Remove) {
			const newpath = this.localtempfilehashes.get(item.hash ?? "") ?? "" //TODO

			//if (newpath) item.tomb = { type: TombTypes.Moved, movedTo: newpath }

			this.localtempfilehashes.delete(item.hash ?? "")
		} else if (type === IT.File && (action === AT.Add || action === AT.Change))
			item.hash = computehash(path)

		//this.log.push(item, this.user)
		const ress = this.index.apply(item)
		this.logger(
			action,
			path,
			ress.map(r => r.io)
		)
		if (this.init) return

		// this.localtempfilehashes.set(item.hash ?? "", item.path) // TODO
		this.index.save()
		this.networkinterface.broadcast(item, this.createRS(item))
	}

	applyIncoming(item: Item, rs?: NodeJS.ReadableStream): void {
		const ress = this.index.apply(item)
		this.logger(
			"REMOTE",
			item.lastAction,
			item.path,
			ress.map(r => r.io)
		)
		if (ress[0].ro === RO.LWW && !ress[0].io) return

		const full = join(this.root, item.path)
		if (item.type === IT.Folder) this.applyFolderIO(item, full)
		else if (item.type === IT.File) this.applyFileIO(item, full, rs)

		this.index.save()
	}

	private applyFolderIO(item: Item, fullpath: string): void {
		if (item.lastAction === AT.Remove && existsSync(fullpath)) {
			this.skiplist.add(fullpath)
			rmdirSync(fullpath, { recursive: true })
		} else if (item.lastAction === AT.Add && !existsSync(fullpath)) {
			this.skiplist.add(fullpath)
			mkdirSync(fullpath, { recursive: true })
		} else console.log("Illegal io op:", item.lastAction, fullpath)
		//throw Error("Vessel.applyFolderIO: illegal argument")
	}

	private applyFileIO(item: Item, fullpath: string, rs?: Streamable) {
		if (item.lastAction === AT.Remove && existsSync(fullpath)) {
			this.skiplist.add(fullpath)
			rmSync(fullpath)
		} else {
			this.skiplist.add(fullpath)
			rs?.pipe(createWriteStream(fullpath))
		}
	}

	createRS(item: Item): Streamable {
		if (item.type === IT.Folder || item.lastAction === AT.Remove) return null
		this.logger("createRS", item.path)
		return createReadStream(join(this.root, item.path))
	}

	addVessel(type: Medium, data: { vessel?: Vessel; nid?: NID }): void {
		const proxy = this.networkinterface.addNode(type, data)
		if (!(proxy instanceof LocalProxy || proxy instanceof HTTPProxy))
			throw Error(`Vessel.addVessel: ${proxy.constructor.name} not implemented`)

		Promise.resolve(proxy.fetchIndex()).then(index =>
			this.updateCargo(index, proxy)
		)
	}

	private updateCargo(
		data: IndexArray | Promise<IndexArray>,
		proxy: Proxy
	): void {
		this.logger("UPDATING")

		Promise.resolve(data).then(arr => {
			const items = arr
				.flatMap(kv => kv[1])
				.map(i => {
					const ress = this.index.apply(i)
					if (ress.length !== 1) throw Error()
					return ress[0]
				})
				.filter(res => {
					const same = res.same
					if (same === undefined) return true
					return !same && res.io
				})
				.map(res => res.after) // TODO: clean

			proxy.fetch(items).forEach((pr, i) => {
				const item = items[i]
				const full = join(this.root, item.path)
				if (item.type === IT.Folder) this.applyFolderIO(item, full)
				else if (item.type === IT.File)
					Promise.resolve(pr).then(rs => this.applyFileIO(item, full, rs))
			})
			this.index.save()
		})
	}
}

if (require.main === module)
	new Vessel("frank", join("testroot", "dave", "root")).rejoin()
