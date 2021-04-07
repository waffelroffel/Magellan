import { createHash } from "crypto"
import {
	readFileSync,
	existsSync,
	rmdirSync,
	mkdirSync,
	rmSync,
	createWriteStream,
	createReadStream,
	statSync,
	writeFileSync,
} from "fs"
import { join } from "path"
import { ActionType, ItemType } from "../enums"
import { Item } from "../interfaces"
import ABCStorage from "./ABCStorage"

/**
 * interface to local storage
 * TODO: move chokidar inside
 */
export class LocalStorage extends ABCStorage {
	root: string

	constructor(root: string) {
		super()
		this.root = root
	}

	abspath(item: Item): string {
		return join(this.root, item.path)
	}

	lastmodified(item: Item): number {
		return statSync(this.abspath(item)).mtimeMs
	}

	computehash(item: Item): string {
		const hash = createHash("sha256")
		return hash.update(readFileSync(this.abspath(item))).digest("hex") // TODO: change to stream
		/*return new Promise(resolve =>
            createReadStream(path)
                .on("end", () => resolve(hash.digest("hex")))
                .pipe(hash)
        )*/
	}

	applyFolderIO(item: Item): boolean {
		const abspath = this.abspath(item)
		const exists = existsSync(abspath)
		if (item.lastAction === ActionType.Remove && exists) {
			rmdirSync(abspath, { recursive: true })
			return true
		} else if (item.lastAction === ActionType.Add && !exists) {
			mkdirSync(abspath, { recursive: true })
			return true
		}
		return false
	}

	applyFileIO(item: Item, rs?: NodeJS.ReadableStream): boolean {
		const abspath = this.abspath(item)
		const exists = existsSync(abspath)
		if (item.lastAction === ActionType.Remove && exists) {
			rmSync(abspath)
			return true
		} else if (
			// TODO: split rename to renamedFrom and renamedTo
			[ActionType.Add, ActionType.Change, ActionType.Rename].includes(
				item.lastAction
			) &&
			rs
		) {
			rs.pipe(createWriteStream(abspath))
			return true
		}
		return false
	}

	createRS(item: Item): NodeJS.ReadableStream | null {
		if (item.type === ItemType.Dir || item.lastAction === ActionType.Remove)
			return null
		return createReadStream(this.abspath(item))
	}

	move(from: Item, to: Item): void {
		writeFileSync(this.abspath(to), readFileSync(this.abspath(from))) // TODO: change to stream
	}
}
