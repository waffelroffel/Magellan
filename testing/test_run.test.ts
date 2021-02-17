import { join } from "path"
import { isDeepStrictEqual } from "util"
import CargoList from "../src/CargoList"
import { Medium } from "../src/enums"
import { Item } from "../src/interfaces"
import Vessel from "../src/Vessel"

const dave = new Vessel("dave", join("testroot", "dave", "root")).rejoin()
const evan = new Vessel("evan", join("testroot", "evan", "root")).rejoin()

setTimeout(() => {
	console.log("Pre index equal: ", isDeepEqual(dave.index, evan.index))
}, 1000)

setTimeout(() => {
	//dave.addVessel(Medium.local, { vessel: evan })
	//evan.addVessel(Medium.local, { vessel: dave })
	dave.addVessel(Medium.http, { nid: evan.networkinterface.nid })
	evan.addVessel(Medium.http, { nid: dave.networkinterface.nid })

	setTimeout(() => {
		console.log("Post index equal: ", isDeepEqual(dave.index, evan.index))
	}, 5000)
}, 2000)

function isDeepEqual(c1: CargoList, c2: CargoList): boolean {
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
		if (!isDeepStrictEqual(item1, item2)) return false
	}
	return true
}
