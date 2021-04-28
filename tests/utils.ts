import { createHash } from "crypto"
import { readdirSync, readFileSync } from "fs"
import { join } from "path"
import { Item, Tomb, VectorClock } from "../src/interfaces"
import Vessel from "../src/Vessel"

// UTILS
export async function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function transpose<T>(narr: T[][]): T[][] {
	return narr[0].map((_, i) => narr.map(x => x[i]))
}

function equalNames(narr: string[][]): boolean {
	const tposed = transpose(narr)
	return tposed.map(arr => allSame(arr)).every(Boolean)
}

function allSame<T>(arr: T[]): boolean {
	return arr.every(e => e === arr[0])
}

function hash(path: string): string {
	return createHash("sha256").update(readFileSync(path)).digest("hex")
}

// COMPARE FIELS AND DIRECTORIES
export function assertDirsAndFiles(roots: string[]): boolean {
	const arrs = roots.map(r => getAllFiles(r))
	const dirs = arrs.map(arr => arr[0])
	const files = arrs.map(arr => arr[1])
	if (dirs.some(d => d.length !== dirs[0].length)) return false
	if (!equalNames(dirs)) return false
	if (files.some(f => f.length !== files[0].length)) return false
	if (!equalNames(files)) return false
	if (!equalContent(files, roots)) return false
	return true
}

function equalContent(nfiles: string[][], roots: string[]): boolean {
	const tposed = transpose(nfiles)
	const nabspaths = tposed.map(files => roots.map((r, i) => join(r, files[i])))
	const nhashes = nabspaths.map(paths => paths.map(p => hash(p)))
	return nhashes.map(hashes => allSame(hashes)).every(Boolean)
}

function getAllFiles(path: string): [string[], string[]] {
	const _getAllFiles = (
		path: string,
		parent: string,
		dirs: string[],
		files: string[]
	): void => {
		readdirSync(path, { withFileTypes: true }).forEach(d => {
			if (["indextable.json", "settings.json", ".temp"].includes(d.name)) return
			const subpath = join(parent, d.name)
			if (d.isDirectory()) {
				dirs.push(subpath)
				_getAllFiles(join(path, d.name), subpath, dirs, files)
			} else if (d.isFile()) files.push(subpath)
		})
	}

	const dirs: string[] = []
	const files: string[] = []
	_getAllFiles(path, "", dirs, files)
	return [dirs, files]
}

// COMPARE INDICES
export function assertIndices(vessels: Vessel[]): boolean {
	const indices = vessels.map(v => v.index.testGet())
	const nkeys = indices.map(index => [...index.keys()].sort())
	if (nkeys.some(keys => keys.length !== nkeys[0].length)) return false
	if (!equalNames(nkeys)) return false
	for (const key of nkeys[0]) {
		const itemlists = indices.map(index => index.get(key))
		if (!itemlists.every(Boolean)) return false
		if (!equalItemLists(itemlists as Item[][])) return false
	}
	return true
}

function equalItemLists(itemlists: Item[][]): boolean {
	if (itemlists.some(list => list.length !== itemlists[0].length)) return false
	itemlists.forEach(list => list.sort((i1, i2) => i1.id.localeCompare(i2.id)))
	const tposed = transpose(itemlists)
	return tposed.map(items => equalItems(items)).every(Boolean)
}

function equalItems(items: Item[]): boolean {
	for (let i = 1; i < items.length; i++) {
		if (i === items.length - 1) break
		if (!compItem(items[i], items[i + 1])) return false
	}
	return true
}

function compItem(i1: Item, i2: Item): boolean {
	if (i1.actionId !== i2.actionId) return false
	if (i1.hash !== i2.hash) return false
	if (i1.lastAction !== i2.lastAction) return false
	if (i1.lastActionBy !== i2.lastActionBy) return false
	if (i1.lastModified !== i2.lastModified) return false
	if (i1.path !== i2.path) return false
	if (i1.type !== i2.type) return false
	if (i1.id !== i2.id) return false
	if (!!i1.tomb !== !!i2.tomb) return false
	if (i1.tomb && i2.tomb && !compTomb(i1.tomb, i2.tomb)) return false
	if (!compClock(i1.clock, i2.clock)) return false
	return true
}

function compTomb(t1: Tomb, t2: Tomb): boolean {
	if (t1.type !== t2.type) return false
	if (t1.movedTo !== t2.movedTo) return false
	return true
}

function compClock(vc1: VectorClock, vc2: VectorClock): boolean {
	if (vc1.length !== vc2.length) return false
	vc1.sort()
	vc2.sort()
	return vc1.every(([id, c], i) => id === vc2[i][0] && c === vc2[i][1])
}
