import { Item } from "../interfaces"

/**
 * Responsible for persistant storage
 * TODO async
 */
export default abstract class ABCStorage {
	abstract relpath(item: Item): string
	abstract lastmodified(item: Item): number | null
	abstract computehash(item: Item): string
	abstract applyFolderIO(item: Item): boolean
	// abstract applyFileIO(item: Item, rs?: NodeJS.ReadableStream): Promise<boolean>
	abstract applyFileIO(item: Item, data?: string): boolean
	abstract getData(item: Item): string | null
	abstract updateCache(item: Item): void
	abstract createRS(item: Item): NodeJS.ReadableStream | null
	abstract move(from: Item, to: Item): boolean
}
