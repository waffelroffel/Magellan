import { Item } from "../interfaces"

/**
 * Responsible for persistant storage
 * TODO async
 */
export default abstract class ABCStorage {
	abstract abspath(item: Item): string
	abstract lastmodified(item: Item): number
	abstract computehash(item: Item): string
	abstract applyFolderIO(item: Item): boolean
	abstract applyFileIO(item: Item, rs?: NodeJS.ReadableStream): boolean
	abstract createRS(item: Item): NodeJS.ReadableStream | null
	abstract move(from: Item, to: Item): void
}
