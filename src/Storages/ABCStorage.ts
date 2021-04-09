import { Item } from "../interfaces"

/**
 * Responsible for persistant storage
 * TODO async
 */
export default abstract class ABCStorage {
	abstract relpath(item: Item): string
	abstract lastmodified(item: Item): number
	abstract computehash(item: Item): Promise<string>
	abstract applyFolderIO(item: Item): Promise<boolean>
	abstract applyFileIO(item: Item, rs?: NodeJS.ReadableStream): Promise<boolean>
	abstract createRS(item: Item): NodeJS.ReadableStream | null
	abstract move(from: Item, to: Item): Promise<boolean>
}
