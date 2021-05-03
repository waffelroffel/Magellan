import { writeFileSync } from "fs"
import { rename, writeFile } from "fs/promises"
import { join } from "path"
import { SHARE_TYPE } from "../src/enums"
import Vessel from "../src/Vessel"
import { SETTINGS_3P, TESTROOT, TEST_VESSEL_OPTS } from "./config"
import make_test_env from "./setup_env"
import { assertDirsAndFiles, assertIndices, delay } from "./utils"

test("initial sync", async () => {
	const users = ["dave", "evan"]

	make_test_env(users, [1, 0], [1, 0])

	const roots = users.map(u => join(TESTROOT, u))
	const vessels = roots.map(
		(ur, i) => new Vessel(users[i], ur, TEST_VESSEL_OPTS)
	)
	vessels[0].new(SHARE_TYPE.All2All)
	vessels[1].join(vessels[0].nid)

	await delay(500)

	expect(assertIndices(vessels)).toBe(false)
	expect(assertDirsAndFiles(roots)).toBe(false)

	vessels[0].connect()
	vessels[1].connect()

	await delay(500)

	vessels[0].exit()
	vessels[1].exit()

	await delay(500)

	expect(assertIndices(vessels)).toBe(true)
	expect(assertDirsAndFiles(roots)).toBe(true)
})

test("concurrent files", async () => {
	const users = ["dave", "evan", "frank"]

	make_test_env(users, [0, 0, 0], [0, 0, 0])

	const roots = users.map(u => join(TESTROOT, u))

	roots.forEach((r, i) => {
		writeFileSync(join(r, "settings.json"), JSON.stringify(SETTINGS_3P[i]))
		writeFileSync(join(r, "indextable.json"), "[]")
	})

	const vessels = roots.map(
		(ur, i) => new Vessel(users[i], ur, TEST_VESSEL_OPTS)
	)

	vessels.forEach(v => v.rejoin())

	await delay(500)

	roots.forEach((r, i) => writeFile(join(r, "dup.txt"), users[i]))

	await delay(1500)

	vessels.forEach(v => v.watcher.close())
	vessels.forEach(v => v.connect())

	await delay(500)

	vessels.forEach(v => v.exit())

	await delay(500)

	expect(assertIndices(vessels)).toBe(true)
	expect(assertDirsAndFiles(roots)).toBe(true)
}, 10000)

test("renaming files", async () => {
	const users = ["dave", "evan"]

	make_test_env(users, [1, 0], [1, 0])

	const roots = users.map(u => join(TESTROOT, u))

	roots.forEach((r, i) => {
		writeFileSync(join(r, "settings.json"), JSON.stringify(SETTINGS_3P[i]))
		writeFileSync(join(r, "indextable.json"), "[]")
	})

	const vessels = roots.map(
		(ur, i) => new Vessel(users[i], ur, TEST_VESSEL_OPTS)
	)

	vessels.forEach(v => v.rejoin())

	await delay(500)

	vessels.forEach(v => v.connect())

	await delay(500)

	rename("testroot/dave/d0_0.txt", "testroot/dave/d_dir1/d0_0.txt")

	await delay(1500)

	vessels.forEach(v => v.exit())

	await delay(500)

	expect(assertIndices(vessels)).toBe(true)
	expect(assertDirsAndFiles(roots)).toBe(true)
}, 10000)
