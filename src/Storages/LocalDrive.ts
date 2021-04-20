import { createHash } from "crypto"
import { existsSync, createWriteStream, createReadStream, statSync } from "fs"
import { mkdir, rm, rmdir } from "fs/promises"
import { join } from "path"
import { ActionType as AT, ItemType as IT } from "../enums"
import { Item } from "../interfaces"
import ABCStorage from "./ABCStorage"

/**
 * interface to local storage
 * TODO: move chokidar inside
 */
export class LocalStorage extends ABCStorage {
	root: string
	canwrite: AT[] = [AT.Add, AT.Change, AT.RenameTo]

	constructor(root: string) {
		super()
		this.root = root
	}

	relpath(item: Item): string {
		return join(this.root, item.path)
	}

	lastmodified(item: Item): number | null {
		if (!existsSync(this.relpath(item))) return null
		return statSync(this.relpath(item)).mtimeMs
	}

	computehash(item: Item): Promise<string> {
		const hash = createHash("sha256")
		const rs = createReadStream(this.relpath(item))
		rs.pipe(hash)
		return new Promise(res => rs.on("end", () => res(hash.digest("hex"))))
	}

	private hashpipe(rs: NodeJS.ReadableStream): Promise<string> {
		const hash = createHash("sha256")
		rs.on("data", (data: string) => hash.write(data))
		return new Promise(res => rs.on("end", () => res(hash.digest("hex"))))
	}

	async applyFolderIO(item: Item): Promise<boolean> {
		const abspath = this.relpath(item)
		const exists = existsSync(abspath)
		if (item.lastAction === AT.Remove && exists)
			return rmdir(abspath, { recursive: true }).then(() => true)
		else if (item.lastAction === AT.Add && !exists)
			return mkdir(abspath, { recursive: true }).then(() => true)
		else return false
	}

	async applyFileIO(item: Item, rs?: NodeJS.ReadableStream): Promise<boolean> {
		// write to .tmp then change ext
		const abspath = this.relpath(item)
		const exists = existsSync(abspath)
		if (item.lastAction === AT.Remove && exists)
			return rm(abspath).then(() => true)
		else if (this.canwrite.includes(item.lastAction) && rs) {
			this.hashpipe(rs).then(hash => {
				if (item.hash !== hash) throw Error("hashes not equal")
			})
			rs.pipe(createWriteStream(abspath))
			return new Promise(res => rs.on("end", () => res(true))) // TODO add reject when unfinished
		} else return false
	}

	createRS(item: Item): NodeJS.ReadableStream | null {
		if (item.type === IT.Dir || item.lastAction === AT.Remove) return null
		return createReadStream(this.relpath(item))
	}

	async move(from: Item, to: Item): Promise<boolean> {
		if (from.type !== to.type) throw Error()
		else if (this.canwrite.includes(from.lastAction)) return false
		else if (!this.canwrite.includes(to.lastAction)) return false
		else if (to.type === IT.File) {
			const rs = createReadStream(this.relpath(from))
			rs.pipe(createWriteStream(this.relpath(to)))
			return new Promise(res => rs.on("end", () => res(true))) // TODO add reject when unfinished
		} else if (to.type === IT.Dir)
			return mkdir(this.relpath(to), { recursive: true }).then(() => true)
		else throw Error()
	}
}
