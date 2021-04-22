import { ActionType as AT, ItemType as IT } from "../src/enums"
import CargoList from "../src/CargoList"
import { TESTROOT } from "./config"

test("CargoList test lww", () => {
	const cl = new CargoList(TESTROOT)
	const i1 = CargoList.Item("file1.txt", IT.File, AT.Add, "alice")
	const i2 = CargoList.Item("file2.txt", IT.File, AT.Add, "bob")
	cl.apply(i1)
	cl.apply(i2)
	const indexarr = cl.asArray()
	expect(indexarr.length).toBe(2)
	expect(indexarr[0][1].length).toBe(1)
	expect(indexarr[1][1].length).toBe(1)
})

test("CargoList test dup", () => {
	const cl = new CargoList(TESTROOT)
	const i1 = CargoList.Item("file.txt", IT.File, AT.Add, "alice")
	const i2 = CargoList.Item("file.txt", IT.File, AT.Add, "bob")
	cl.apply(i1)
	cl.apply(i2)
	const indexarr = cl.asArray()
	expect(indexarr.length).toBe(2)
	expect(indexarr[0][1].length).toBe(2)
	expect(indexarr[1][1].length).toBe(1)

	expect(indexarr[0][1][0].tomb).toBeUndefined()
	expect(indexarr[0][1][1].tomb).toBeDefined()
	expect(indexarr[0][1][1]?.tomb?.movedTo).toBe(indexarr[1][1][0].path)
	expect(indexarr[0][1][1].id).toBe(indexarr[1][1][0].id)
})
