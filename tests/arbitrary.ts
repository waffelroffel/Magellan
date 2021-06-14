import { readFileSync, rmSync, writeFileSync } from "fs"
import { join, sep } from "path"
import { SHARE_TYPE } from "../src/enums"
import { randint } from "../src/utils"
import Vessel from "../src/Vessel"
import { TESTROOT, TEST_VESSEL_OPTS } from "./config"
import make_test_env from "./setup_env"
import { assertDirsAndFiles, assertIndices, delay } from "./utils"

main()
async function main(): Promise<void> {
	const users = ["dave", "evan", "frank"]

	make_test_env(users, [0, 0, 0], [1, 0, 0])

	const roots = users.map(u => join(TESTROOT, u))
	const vessels = roots.map(
		(ur, i) => new Vessel(users[i], ur, TEST_VESSEL_OPTS)
	)

	vessels[0].new(SHARE_TYPE.All2All).connect()
	vessels[1].join(vessels[0].nid)
	vessels[2].join(vessels[0].nid)

	await delay(1000)

	vessels[1].connect()

	await delay(2000)

	vessels[2].connect()

	await delay(2000)

	run(vessels)

	await delay(30000)

	vessels.forEach(v => v.exit())

	await delay(5000)

	console.log("Index post assert:", assertIndices(vessels))
	console.log("Files/Dirs post assert:", assertDirsAndFiles(roots))
}

function run(vessels: Vessel[]): void {
	const pool = make_oplist()
	vessels.forEach(async v => {
		for (let _ = 0; _ < 3; _++) {
			await delay(randint(2000, 6000))
			const op = pool[randint(0, pool.length)]
			const files = v.index.asArray().map(kv => join(v.root, kv[0]))
			const file = files[randint(0, files.length)]
			try {
				const [f, d] = op(file)
				console.log(v.user, op.name, f, d)
			} catch (e) {
				console.log(v.user, op.name, file, false, e.message)
			}
		}
	})
}

function make_oplist(): ((file: string) => [string, string])[] {
	const ops: [(file: string) => [string, string], number][] = [
		[randappend, 1],
		[randdelete, 0],
		[randcreate, 3],
	]

	const oplist: ((file: string) => [string, string])[] = []

	for (const [op, n] of ops) {
		for (let i = 0; i < n; i++) {
			oplist.push(op)
		}
	}
	return oplist
}

function randappend(file: string): [string, string] {
	const data = readFileSync(file, { encoding: "utf8" })
	const d = data + randint(0, 10)
	writeFileSync(file, d)
	return [file, d]
}

function randdelete(file: string): [string, string] {
	rmSync(file)
	return [file, ""]
}

function randcreate(file: string): [string, string] {
	const pathseg = file.split(sep)
	const dir = pathseg.slice(0, pathseg.length - 1).join(sep)
	const data = randint(0, 10) + ""
	const newfile = join(dir, `${data}.txt`)
	writeFileSync(newfile, data)
	return [newfile, data]
}
