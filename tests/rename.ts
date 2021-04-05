import { writeFileSync } from "fs"
import { join } from "path"
import Vessel from "../src/Vessel"
import { TESTROOT } from "./config"
import make_test_env from "./setup_env"
import { assertDirsAndFiles, assertIndices } from "./utils"
// TODO: deactivate watcher
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
		nid: { host: "localhost", port: 8617 },
		peers: [
			{ nid: { host: "localhost", port: 8124 } },
			{ nid: { host: "localhost", port: 8554 } },
		],
		sharetype: "A2A",
		privs: { write: true, read: true },
		ignores: [
			"testroot\\dave",
			"testroot\\dave\\indextable.json",
			"testroot\\dave\\settings.json",
		],
		loggerconf: {
			init: false,
			ready: false,
			update: false,
			send: true,
			local: true,
			remote: true,
			error: true,
			online: false,
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
		nid: { host: "localhost", port: 8124 },
		peers: [
			{ nid: { host: "localhost", port: 8617 } },
			{ nid: { host: "localhost", port: 8554 } },
		],
		sharetype: "A2A",
		privs: { write: true, read: true },
		ignores: [
			"testroot\\evan",
			"testroot\\evan\\indextable.json",
			"testroot\\evan\\settings.json",
		],
		loggerconf: {
			init: false,
			ready: false,
			update: false,
			send: true,
			local: true,
			remote: true,
			error: true,
			online: false,
			vanish: true,
		},
		admin: false,
	},
	{
		user: "frank",
		root: "testroot\\frank",
		rooti: 14,
		rootarr: ["testroot", "frank"],
		tableEnd: "indextable.json",
		tablePath: "testroot\\frank\\indextable.json",
		settingsEnd: "settings.json",
		settingsPath: "testroot\\frank\\settings.json",
		nid: { host: "localhost", port: 8554 },
		peers: [
			{ nid: { host: "localhost", port: 8617 } },
			{ nid: { host: "localhost", port: 8124 } },
		],
		sharetype: "A2A",
		privs: { write: true, read: true },
		ignores: [
			"testroot\\frank",
			"testroot\\frank\\indextable.json",
			"testroot\\frank\\settings.json",
		],
		loggerconf: {
			init: false,
			ready: false,
			update: false,
			send: true,
			local: true,
			remote: true,
			error: true,
			online: false,
			vanish: true,
		},
		admin: false,
	},
]

const users = ["dave", "evan", "frank"]

make_test_env(users, [0, 0, 0], [0, 0, 0])

const roots = users.map(u => join(TESTROOT, u))

roots.forEach((r, i) => {
	writeFileSync(join(r, "settings.json"), JSON.stringify(settings[i]))
	writeFileSync(join(r, "indextable.json"), "[]")
})

const vessels = roots.map((ur, i) => new Vessel(users[i], ur))

vessels.forEach(v => v.rejoin())

const f = "dup.txt"

setTimeout(() => {
	roots.forEach((r, i) => writeFileSync(join(r, f), users[i]))
	setTimeout(() => {
		vessels.forEach(v => v.connect())
		setTimeout(() => {
			console.log("Indices equal:", assertIndices(vessels))
			console.log("Dirs and Files equal:", assertDirsAndFiles(roots))
		}, 3000)
	}, 5000)
}, 3000)
