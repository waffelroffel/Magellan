import { createHash } from "crypto"
import {
	createReadStream,
	createWriteStream,
	existsSync,
	mkdirSync,
	readFileSync,
	rmdirSync,
	rmSync,
} from "fs"
import { join } from "path"
import { v4 } from "uuid"
import { ActionType as AT, ItemType as IT } from "./enums"
import { Item } from "./interfaces"

export function uuid(): string {
	return v4()
}

/**
 * timestamp for log
 */
export function cts(): string {
	return `[${new Date().toISOString().replace(/T/, " ").replace(/\..+/, "")}]`
}

/**
 * timestamp for lastmodified field
 */
export function ct(): number {
	return new Date().valueOf()
}

export function computehash(path: string): string {
	const hash = createHash("sha256")
	return hash.update(readFileSync(path)).digest("hex") // TODO: change to stream
	/*return new Promise(resolve =>
		createReadStream(path)
			.on("end", () => resolve(hash.digest("hex")))
			.pipe(hash)
	)*/
}

export function deepcopy<T>(json: T): T {
	return JSON.parse(JSON.stringify(json))
}

export function randint(min: number, max: number): number {
	min = Math.floor(min)
	max = Math.floor(max)
	return min + Math.floor(Math.random() * (max - min))
}

export function applyFolderIO(item: Item, fullpath: string): boolean {
	const exists = existsSync(fullpath)
	if (item.lastAction === AT.Remove && exists) {
		rmdirSync(fullpath, { recursive: true })
		return true
	} else if (item.lastAction === AT.Add && !exists) {
		mkdirSync(fullpath, { recursive: true })
		return true
	}
	return false
}

export function applyFileIO(
	item: Item,
	fullpath: string,
	rs?: NodeJS.ReadableStream
): boolean {
	const exists = existsSync(fullpath)
	if (item.lastAction === AT.Remove && exists) {
		rmSync(fullpath)
		return true
	} else if (item.lastAction === AT.Add || item.lastAction === AT.Change) {
		rs?.pipe(createWriteStream(fullpath))
		return true
	}
	return false
}

export function createRS(
	item: Item,
	root: string
): NodeJS.ReadableStream | null {
	if (item.type === IT.Dir || item.lastAction === AT.Remove) return null
	return createReadStream(join(root, item.path))
}
