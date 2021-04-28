import { createHash } from "crypto"
import {
	existsSync,
	createWriteStream,
	createReadStream,
	statSync,
	mkdirSync,
} from "fs"
import { mkdir, rename, rmdir } from "fs/promises"
import { join } from "path"
import { ActionType as AT, ItemType as IT } from "../enums"
import { Item } from "../interfaces"
import { uuid } from "../utils"
import ABCStorage from "./ABCStorage"

/**
 * interface to local storage
 * TODO: move chokidar inside
 */
export class LocalStorage extends ABCStorage {
	root: string
	canwrite: AT[] = [AT.Add, AT.Change, AT.MovedTo]
	tempfolder = ".temp"
	tempdeleted = new Map<string, [string, number]>()

	constructor(root: string) {
		super()
		this.root = root
		mkdirSync(join(this.root, this.tempfolder))
	}

	relpath(item: Item): string {
		return join(this.root, item.path)
	}

	lastmodified(item: Item): number | null {
		const relpath = this.relpath(item)
		if (!existsSync(relpath)) return null
		return statSync(relpath).mtimeMs
	}

	computehash(item: Item): Promise<string> {
		const hash = createHash("sha256")
		const rs = createReadStream(this.relpath(item))
		rs.pipe(hash)
		return new Promise(res => rs.on("end", () => res(hash.digest("hex"))))
	}

	private checkhash(rs: NodeJS.ReadableStream, h: string): void {
		const hash = createHash("sha256")
		rs.on("data", (data: string) => hash.write(data))
		rs.on("end", () => {
			if (hash.digest("hex") !== h) throw Error("hashes not equal")
		})
	}

	async applyFolderIO(item: Item): Promise<boolean> {
		const relpath = this.relpath(item)
		const exists = existsSync(relpath)
		if (item.lastAction === AT.Remove && exists)
			return rmdir(relpath, { recursive: true }).then(() => true)
		if (item.lastAction === AT.Add && !exists)
			return mkdir(relpath, { recursive: true }).then(() => true)
		return false
	}

	async applyFileIO(item: Item, rs?: NodeJS.ReadableStream): Promise<boolean> {
		if (!item.hash) throw Error()
		// write to .tmp then change ext
		const relpath = this.relpath(item)
		const exists = existsSync(relpath)
		if (item.lastAction === AT.Remove && exists) {
			const tmppath = join(this.root, this.tempfolder, uuid())
			this.tempdeleted.set(item.hash, [tmppath, new Date().valueOf()])
			return rename(relpath, tmppath).then(() => true)
		}
		if (this.canwrite.includes(item.lastAction)) {
			const fpath = this.tempdeleted.get(item.hash)?.[0]
			if (fpath) {
				const tmprs = createReadStream(fpath)
				this.checkhash(tmprs, item.hash)
				tmprs.pipe(createWriteStream(relpath))
				this.tempdeleted.delete(item.hash)
				return new Promise(res => tmprs.on("end", () => res(true)))
			} else if (rs) {
				this.checkhash(rs, item.hash)
				rs.pipe(createWriteStream(relpath))
				return new Promise(res => rs.on("end", () => res(true)))
			} else throw Error()
		}
		return false
	}

	createRS(item: Item): NodeJS.ReadableStream | null {
		if (item.type === IT.Dir || item.lastAction === AT.Remove) return null
		const relpath = this.relpath(item)
		if (!existsSync(relpath)) throw Error(`${relpath} doesn't exist`)
		return createReadStream(relpath)
	}

	async move(from: Item, to: Item): Promise<boolean> {
		if (from.type !== to.type) throw Error()
		if (this.canwrite.includes(from.lastAction)) return false
		if (!this.canwrite.includes(to.lastAction)) return false
		return rename(this.relpath(from), this.relpath(to)).then(() => true)
	}
}
