import { writeFileSync } from "fs"
import { join } from "path"
import Vessel from "../src/Vessel"
import { TESTROOT } from "./config.test"
import make_test_env from "./setup_env.test"
import { assert_index_and_files } from "./utils.test"

const settings = [
	{
		user: "dave",
		root: "testroot\\dave",
		rooti: 13,
		rootarr: ["testroot", "dave"],
		tableEnd: "indextable.json",
		tablePath: "testroot\\dave\\indextable.json",
		settingsEnd: "settings.json",
		settingsPath: "testroot\\dave\\settings.json",
		nid: { host: "localhost", port: 8223 },
		peers: [{ nid: { host: "localhost", port: 8014 } }],
		sharetype: "A2A",
		privs: { write: true, read: true },
		ignores: [
			"testroot\\dave",
			"testroot\\dave\\indextable.json",
			"testroot\\dave\\settings.json",
		],
		loggerconf: {
			init: true,
			ready: true,
			update: true,
			send: true,
			local: true,
			remote: true,
			error: true,
			online: true,
			vanish: true,
		},
		admin: true,
	},
	{
		user: "evan",
		root: "testroot\\evan",
		rooti: 13,
		rootarr: ["testroot", "evan"],
		tableEnd: "indextable.json",
		tablePath: "testroot\\evan\\indextable.json",
		settingsEnd: "settings.json",
		settingsPath: "testroot\\evan\\settings.json",
		nid: { host: "localhost", port: 8014 },
		peers: [{ nid: { host: "localhost", port: 8223 } }],
		sharetype: "A2A",
		privs: { write: true, read: true },
		ignores: [
			"testroot\\evan",
			"testroot\\evan\\indextable.json",
			"testroot\\evan\\settings.json",
		],
		loggerconf: {
			init: true,
			ready: true,
			update: true,
			send: true,
			local: true,
			remote: true,
			error: true,
			online: true,
			vanish: true,
		},
		admin: false,
	},
]

const users = ["dave", "evan"] //,"frank"]

make_test_env(users, [0, 0, 0], [0, 0, 0])

const roots = users.map(u => join(TESTROOT, u))
roots.forEach((r, i) => {
	writeFileSync(join(r, "settings.json"), JSON.stringify(settings[i]))
	writeFileSync(join(r, "indextable.json"), "[]")
})
const vessels = roots.map((ur, i) => new Vessel(users[i], ur))
vessels[0].rejoin()
vessels[1].rejoin()
//vessels[2].join(vessels[0].nid)

const f = "dup.txt"
//writeFileSync(join(roots[2], f), users[2])

setTimeout(() => {
	writeFileSync(join(roots[0], f), users[0])
	writeFileSync(join(roots[1], f), users[1])
	setTimeout(() => {
		vessels[0].connect()
		vessels[1].connect()
		//vessels[2].connect()
		assert_index_and_files(vessels, roots, 2000, "Post")
	}, 4000)
}, 2000)
