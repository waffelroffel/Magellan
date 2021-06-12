import { createHash } from "crypto"
import {
	existsSync,
	statSync,
	mkdirSync,
	rmdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "fs"
import { join } from "path"
import { ActionType as AT, ItemType as IT } from "../enums"
import { Item } from "../interfaces"
import { uuid } from "../utils"
import ABCStorage from "./ABCStorage"

export class LocalDrive extends ABCStorage {
	root: string
	canwrite: AT[] = [AT.Add, AT.Change, AT.MovedTo]
	tempfolder = ".temp"
	tempdeleted = new Map<string, [string, number]>()
	iocache = new Map<string, string>() // TODO add timer and cache

	constructor(root: string) {
		super()
		this.root = root
		const temp = join(this.root, this.tempfolder)
		if (!existsSync(temp)) mkdirSync(join(this.root, this.tempfolder))
	}

	exists(item: Item): boolean {
		return existsSync(this.relpath(item))
	}

	relpath(item: Item): string {
		return join(this.root, item.path)
	}

	lastmodified(item: Item): number | null {
		const relpath = this.relpath(item)
		if (!existsSync(relpath)) return null
		return statSync(relpath).mtimeMs
	}

	computehash(item: Item): string {
		const relpath = this.relpath(item)
		if (!existsSync(relpath)) throw Error()
		const hash = createHash("sha256")
		const data = readFileSync(relpath)
		return hash.update(data).digest("hex")
	}

	hash(data: string): string {
		return createHash("sha256").update(data).digest("hex")
	}

	applyFolderIO(item: Item): boolean {
		const relpath = this.relpath(item)
		const exists = existsSync(relpath)
		if (item.lastAction === AT.Remove && exists) {
			rmdirSync(relpath, { recursive: true })
			return true
		}
		if (item.lastAction === AT.Add && !exists) {
			mkdirSync(relpath, { recursive: true })
			return true
		}
		return false
	}

	applyFileIO(item: Item, data?: string): boolean {
		if (!item.hash) throw Error()
		const relpath = this.relpath(item)
		const exists = existsSync(relpath)
		if (item.lastAction === AT.Remove && exists) {
			const tmppath = join(this.root, this.tempfolder, uuid())
			this.tempdeleted.set(item.hash, [tmppath, new Date().valueOf()])
			this.iocache.delete(item.path)
			renameSync(relpath, tmppath)
			return true
		}
		if (this.canwrite.includes(item.lastAction)) {
			const fpath = this.tempdeleted.get(item.hash)?.[0]
			if (fpath) {
				const data = readFileSync(fpath, { encoding: "utf8" })
				if (createHash("sha256").update(data).digest("hex") !== item.hash)
					console.log("hash wrong")
				this.iocache.set(item.path, data)
				writeFileSync(relpath, data)
				this.tempdeleted.delete(item.hash)
				return true
			} else if (data) {
				this.iocache.set(item.path, data)
				writeFileSync(relpath, data)
				return true
			}
		}
		return false
	}

	updateCache(item: Item): void {
		this.iocache.set(
			item.path,
			readFileSync(this.relpath(item), { encoding: "utf8" })
		)
	}

	getData(item: Item): string | null {
		if (item.type === IT.Dir || item.lastAction === AT.Remove) return null
		const cached = this.iocache.get(item.path)
		if (cached) {
			//console.log("reading from cache", cached)
			if (this.hash(cached) === item.hash) return cached
			const newdata = readFileSync(this.relpath(item), { encoding: "utf8" }) //
			this.iocache.set(item.path, newdata)
			//console.log("updating cache getData:", newdata)
			return newdata
		}
		const relpath = this.relpath(item)
		if (!existsSync(relpath)) throw Error(`${relpath} doesn't exist`)
		const data = readFileSync(relpath, { encoding: "utf8" })
		if (createHash("sha256").update(data).digest("hex") !== item.hash)
			throw Error("getData: hash wrong")
		return data
	}

	createRS(item: Item): NodeJS.ReadableStream | null {
		item // TODO: placeholder
		return null
	}

	move(from: Item, to: Item): boolean {
		if (from.type !== to.type) throw Error()
		if (this.canwrite.includes(from.lastAction)) return false
		if (!this.canwrite.includes(to.lastAction)) return false
		renameSync(this.relpath(from), this.relpath(to))
		return true
	}

	flush(): void {
		this.iocache.forEach((v, k) => writeFileSync(join(this.root, k), v))
	}
}
