import { createHash } from "crypto"
import { createReadStream, lstatSync } from "fs"
import path = require("path")
import { ItemTypes } from "./enums"

// timestamp for log
export function cts(): string {
	return `[${new Date().toLocaleString()}]`
}

// timestamp for crdt
export function ct(): number {
	return new Date().valueOf()
}

export function computehash(path: string): string {
	return createReadStream(path).pipe(createHash("sha256")).digest("hex")
}
