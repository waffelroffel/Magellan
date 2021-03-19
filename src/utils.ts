import { createHash } from "crypto"
import { createReadStream, readFileSync } from "fs"

// timestamp for log
export function cts(): string {
	return `[${new Date().toLocaleString()}]`
}

// timestamp for crdt
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
