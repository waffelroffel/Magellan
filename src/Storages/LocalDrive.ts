import { createHash } from "crypto"
import {
	readFileSync,
	existsSync,
	rmdirSync,
	mkdirSync,
	rmSync,
	createWriteStream,
	createReadStream,
	renameSync,
	write,
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

	fullpath(item: Item): string {
		return join(this.root, item.path)
	}

	computehash(path: string): string {
		const hash = createHash("sha256")
		return hash.update(readFileSync(path)).digest("hex") // TODO: change to stream
		/*return new Promise(resolve =>
            createReadStream(path)
                .on("end", () => resolve(hash.digest("hex")))
                .pipe(hash)
        )*/
	}

	applyFolderIO(item: Item): boolean {
		const fullpath = this.fullpath(item)
		const exists = existsSync(fullpath)
		if (item.lastAction === ActionType.Remove && exists) {
			rmdirSync(fullpath, { recursive: true })
			return true
		} else if (item.lastAction === ActionType.Add && !exists) {
			mkdirSync(fullpath, { recursive: true })
			return true
		}
		return false
	}

	applyFileIO(item: Item, rs?: NodeJS.ReadableStream): boolean {
		const fullpath = this.fullpath(item)
		const exists = existsSync(fullpath)
		if (item.lastAction === ActionType.Remove && exists) {
			rmSync(fullpath)
			return true
		} else if (
			// TODO: split rename to renamedFrom and renamedTo
			[ActionType.Add, ActionType.Change, ActionType.Rename].includes(
				item.lastAction
			) &&
			rs
		) {
			rs.pipe(createWriteStream(fullpath))
			return true
		}
		return false
	}

	createRS(item: Item): NodeJS.ReadableStream | null {
		if (item.type === ItemType.Dir || item.lastAction === ActionType.Remove)
			return null
		return createReadStream(this.fullpath(item))
	}

	move(from: Item, to: Item): void {
		createReadStream(this.fullpath(from)).pipe(
			createWriteStream(this.fullpath(to))
		)
	}
}
