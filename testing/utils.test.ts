import CargoList from "../src/CargoList"
import { Item, Tomb } from "../src/interfaces"

export default function isDeepEqual(c1: CargoList, c2: CargoList): boolean {
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
