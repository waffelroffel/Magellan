import { readFileSync, rmSync, writeFileSync } from "fs"
import { join, sep } from "path"
import { Medium, SHARE_TYPE } from "../src/enums"
import Vessel from "../src/Vessel"
import { TESTROOT } from "./config.test"
import make_test_env from "./setup_env.test"
import { assert_index_and_files } from "./utils.test"

const users = ["dave", "evan", "frank"]

make_test_env(users, [0, 0, 0], [1, 1, 0])

const roots = users.map(u => join(TESTROOT, u))
const vessels = roots.map((ur, i) =>
	new Vessel(users[i], ur).new(SHARE_TYPE.All2All)
)

const pool = make_oplist()

assert_index_and_files(vessels, roots, 1000, "Pre")

setTimeout(() => {
	vessels[0].addVessel(Medium.http, { nid: vessels[1].nid })
	vessels[0].addVessel(Medium.http, { nid: vessels[2].nid })
	vessels[1].addVessel(Medium.http, { nid: vessels[0].nid })
	vessels[1].addVessel(Medium.http, { nid: vessels[2].nid })
	vessels[2].addVessel(Medium.http, { nid: vessels[0].nid })
	vessels[2].addVessel(Medium.http, { nid: vessels[1].nid })

	assert_index_and_files(vessels, roots, 2000, "Post")

	setTimeout(run, 5000, ...vessels)
}, 2000)

// --

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function run(...vessels: Vessel[]): void {
	vessels.forEach(async v => {
		for (let _ = 0; _ < randint(3) + 2; _++) {
			const op = pool[randint(pool.length)]
			const files = v.index.asArray().map(kv => join(v.root, kv[0]))
			const file = files[randint(files.length)]
			try {
				op(file)
				console.log(v.user, op.name, file, true)
			} catch (e) {
				console.log(v.user, op.name, file, false, e.message)
			}
			await delay(randint(1000) + 500)
		}
	})
}

function make_oplist(): ((file: string) => void)[] {
	const ops: [(file: string) => void, number][] = [
		[randappend, 5],
		[randdelete, 2],
		[randcreate, 3],
	]

	const oplist: ((file: string) => void)[] = []

	for (const [op, n] of ops) {
		for (let i = 0; i < n; i++) {
			oplist.push(op)
		}
	}
	return oplist
}

function randappend(file: string): void {
	const data = readFileSync(file, { encoding: "utf8" })
	writeFileSync(file, data + randint(10))
}

function randdelete(file: string): void {
	rmSync(file)
}

function randcreate(file: string): void {
	const pathseg = file.split(sep)
	const dir = pathseg.slice(0, pathseg.length - 1).join(sep)
	const newfile = join(dir, `${randint(100).toString()}.txt`)
	writeFileSync(newfile, randint(10).toString())
}

function randint(max: number): number {
	return Math.floor(Math.random() * max)
}
