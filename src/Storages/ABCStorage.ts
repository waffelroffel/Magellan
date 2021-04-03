import { Item } from "../interfaces"

/**
 * Responsible for persistant storage
 */
export default abstract class ABCStorage {
	abstract fullpath(item: Item): string
	abstract computehash(path: string): string
	abstract applyFolderIO(item: Item): boolean
	abstract applyFileIO(item: Item, rs?: NodeJS.ReadableStream): boolean
	abstract createRS(item: Item): NodeJS.ReadableStream | null
	abstract move(from: Item, to: Item): void
}
