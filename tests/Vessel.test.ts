import { join } from "path"
import { SHARE_TYPE } from "../src/enums"
import Vessel from "../src/Vessel"
import { TESTROOT, TEST_VESSEL_OPTS } from "./config"
import make_test_env from "./setup_env"
import { assertDirsAndFiles, assertIndices, delay } from "./utils"
// TODO: Mock chokidar watcher
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

	expect(assertIndices(vessels)).toBe(true)
	expect(assertDirsAndFiles(roots)).toBe(true)
	vessels[0].disconnect()
	vessels[1].disconnect()
})
