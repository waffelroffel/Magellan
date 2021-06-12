import { ActionType as AT, ItemType as IT } from "../src/enums"
import { TESTROOT, TEST_TEXT } from "./config"
import ABCStorage from "../src/Storages/ABCStorage"
import { LocalDrive } from "../src/Storages/LocalDrive"
import { Item } from "../src/interfaces"
import { existsSync, readFileSync, statSync } from "fs"
import { join } from "path"

let drive: ABCStorage

const fileadd: Item = {
	path: "test.txt",
	id: "1b45d92d-829a-4204-934e-1494306f99b2",
	type: IT.File,
	lastModified: 0,
	lastAction: AT.Add,
	lastActionBy: "robot",
	actionId: "1b45d92d-829a-4204-934e-1414306f99b2",
	hash: "001aa9b3369386a9ee468c74a74330d8f4aaf9656d115579aa304b5aac950194",
	clock: [["robot", 1]],
}
const filechg: Item = {
	path: "test.txt",
	id: "1b45d92d-829a-4204-934e-1494306f99b2",
	type: IT.File,
	lastModified: 0,
	lastAction: AT.Change,
	lastActionBy: "robot",
	actionId: "1b45d92d-829a-4204-934e-1414306f99b2",
	hash: "eaa3abc116c050804eccf1b16b0cf4b83a8776197b7f57ea5cc6bf50225cf9fd",
	clock: [["robot", 1]],
}
const filerem: Item = {
	path: "test.txt",
	id: "1b45d92d-829a-4204-934e-1494306f99b2",
	type: IT.File,
	lastModified: 0,
	lastAction: AT.Remove,
	lastActionBy: "robot",
	actionId: "1b45d92d-829a-4204-934e-1414306f99b2",
	hash: "eaa3abc116c050804eccf1b16b0cf4b83a8776197b7f57ea5cc6bf50225cf9fd",
	clock: [["robot", 1]],
}
const diradd: Item = {
	path: "test",
	id: "1b45d92d-829a-4204-934e-149430619912",
	type: IT.Dir,
	lastModified: 0,
	lastAction: AT.Add,
	lastActionBy: "robot",
	actionId: "1b45d92d-829a-4204-934e-1494106f99b2",
	clock: [["robot", 1]],
}
const dirrem: Item = {
	path: "test",
	id: "1b45d92d-829a-4204-934e-149430619912",
	type: IT.Dir,
	lastModified: 0,
	lastAction: AT.Remove,
	lastActionBy: "robot",
	actionId: "1b45d92d-829a-4204-934e-1494106f99b2",
	clock: [["robot", 1]],
}

function relpath(item: Item): string {
	return join(TESTROOT, item.path)
}

beforeAll(() => {
	drive = new LocalDrive(TESTROOT)
})

describe("LocalDrive", () => {
	test("file", () => {
		drive.applyFileIO(fileadd, TEST_TEXT)
		const data = drive.getData(fileadd)
		expect(data).toBe(TEST_TEXT)

		const hash = drive.computehash(fileadd)
		expect(hash).toBe(fileadd.hash)

		const actualadd = readFileSync(relpath(fileadd), { encoding: "utf8" })
		expect(actualadd).toBe(TEST_TEXT)

		drive.applyFileIO(filechg, TEST_TEXT + TEST_TEXT)
		const actualchg = readFileSync(relpath(filechg), { encoding: "utf8" })
		expect(actualchg).toBe(TEST_TEXT + TEST_TEXT)

		drive.applyFileIO(filerem, TEST_TEXT + TEST_TEXT)
		expect(existsSync(relpath(filechg))).toBeFalsy()
	})
	test("folder", () => {
		drive.applyFolderIO(diradd)
		expect(existsSync(relpath(diradd))).toBeTruthy()
		expect(statSync(relpath(diradd)).isDirectory()).toBeTruthy()

		drive.applyFolderIO(dirrem)
		expect(existsSync(relpath(dirrem))).toBeFalsy()
	})
})
