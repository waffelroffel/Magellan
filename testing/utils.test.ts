import { readdirSync } from "fs"
import { join } from "path"
import CargoList from "../src/CargoList"
import { Item, Tomb } from "../src/interfaces"
import { LocalStorage } from "../src/Storages/LocalDrive"
import Vessel from "../src/Vessel"

const local = new LocalStorage("")
export function compFiles(root1: string, root2: string): boolean {
	const [ds1, fs1] = getAllFiles(root1)
	const [ds2, fs2] = getAllFiles(root2)
	if (ds1.length !== ds2.length) return false
	if (ds1.some((d1, i) => d1 !== ds2[i])) return false
	if (fs1.length !== fs2.length) return false
	if (fs1.some((f1, i) => !compFile(root1, f1, root2, fs2[i]))) return false
	return true
}

function compFile(r1: string, f1: string, r2: string, f2: string): boolean {
	return local.computehash(join(r1, f1)) === local.computehash(join(r2, f2))
}

function getAllFiles(path: string): [string[], string[]] {
	const _getAllFiles = (
		path: string,
		parent: string,
		dirs: string[],
		files: string[]
	): void => {
		readdirSync(path, { withFileTypes: true }).forEach(d => {
			if (d.name === "indextable.json" || d.name === "settings.json") return
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

export function isDeepEqual(c1: CargoList, c2: CargoList): boolean {
	const index1 = c1.testGet()
	const index2 = c2.testGet()
	const keys1 = [...index1.keys()]
	const keys2 = [...index2.keys()]
	if (keys1.length !== keys2.length) return false

	for (const key of keys1) {
		const arr1 = index1.get(key)
		const arr2 = index2.get(key)
		if (!arr1 || !arr2) return false
		if (!equalItemArray(arr1, arr2)) return false
	}
	return true
}

function equalItemArray(arr1: Item[], arr2: Item[]): boolean {
	if (arr1.length === 0 && arr2.length === 0) return true
	if (arr1.length !== arr2.length) return false

	for (let i = 0; i < arr1.length; i++) {
		const item1 = arr1[i]
		const item2 = arr2[i]
		if (!equalItem(item1, item2)) return false //if (!isDeepStrictEqual(item1, item2)) return false
	}
	return true
}

function equalItem(i1: Item, i2: Item): boolean {
	if (i1.actionId !== i2.actionId) return false
	if (i1.hash !== i2.hash) return false
	if (i1.lastAction !== i2.lastAction) return false
	if (i1.lastActionBy !== i2.lastActionBy) return false
	if (i1.lastModified !== i2.lastModified) return false
	if (i1.path !== i2.path) return false
	if (i1.type !== i2.type) return false
	if (i1.uuid !== i2.uuid) return false
	if (!i1.tomb && i2.tomb) return false
	if (i1.tomb && !i2.tomb) return false
	if (i1.tomb && i2.tomb) return equalTomb(i1.tomb, i2.tomb)
	return true
}

function equalTomb(t1: Tomb, t2: Tomb): boolean {
	if (t1.type !== t2.type) return false
	if (t1.movedTo !== t2.movedTo) return false
	return true
}

export function assert_index_and_files(
	vessels: Vessel[],
	roots: string[],
	timeout: number,
	prefix: string
): void {
	setTimeout(() => {
		console.log(
			prefix,
			"index equal:",
			isDeepEqual(vessels[0].index, vessels[1].index)
		)
		console.log(prefix, "files equal:", compFiles(roots[0], roots[1]))
	}, timeout)
}
