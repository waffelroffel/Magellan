import { Readable } from "stream"
import { ActionType, ItemType, SHARE_TYPE } from "../src/enums"
import {
	IndexArray,
	Invite,
	Item,
	VesselOptions,
	Settings,
} from "../src/interfaces"

export const TESTROOT = "testroot"

export const TEST_VESSEL_OPTS: VesselOptions = {
	loggerconf: {
		init: false,
		ready: false,
		update: false,
		send: false,
		local: false,
		remote: false,
		error: false,
		online: false,
		offline: false,
		vanish: false,
	},
}

export const TEST_ITEM: Item = {
	path: "test.txt",
	id: "a3ed478b-b863-420c-a830-713ef8bfef4c",
	type: ItemType.File,
	lastModified: 1617641396263,
	lastAction: ActionType.Add,
	lastActionBy: "bob",
	actionId: "f59d8076-36ce-4598-bf4e-6b891bf9124a",
	clock: [["bob", 1]],
	//parent: null,
	hash: "eaa3abc116c050804eccffb16b0cf4b83a8776197b7f57ea5cc6bf50225cf9fd",
}

export const TEST_INDEXARRAY: IndexArray = [["root.txt", [TEST_ITEM]]]

export const TEST_INVITE: Invite = {
	sharetype: SHARE_TYPE.All2All,
	perms: { write: true, read: true },
	peers: [{ host: "localhost", port: 8080 }],
}

export const TEST_TEXT = "TOP SECRET DATA. DON'T SHARE!"

export const TEST_READSTREAM: NodeJS.ReadableStream = Readable.from(TEST_TEXT)

export const TEST_WRITESTREAM: NodeJS.ReadableStream = Readable.from("SECRET")

export const SETTINGS_3P: Settings[] = [
	{
		user: "dave",
		root: "testroot\\dave",
		tablepath: "testroot\\dave\\indextable.json",
		settingspath: "testroot\\dave\\settings.json",
		nid: { host: "localhost", port: 8617 },
		peers: [
			{ nid: { host: "localhost", port: 8124 } },
			{ nid: { host: "localhost", port: 8554 } },
		],
		sharetype: SHARE_TYPE.All2All,
		privs: { write: true, read: true },
		ignored: ["indextable.json", "settings.json"],
		loggerconf: {
			init: false,
			ready: false,
			update: false,
			send: false,
			local: false,
			remote: false,
			error: false,
			online: false,
			vanish: false,
		},
		admin: true,
	},
	{
		user: "evan",
		root: "testroot\\evan",
		tablepath: "testroot\\evan\\indextable.json",
		settingspath: "testroot\\evan\\settings.json",
		nid: { host: "localhost", port: 8124 },
		peers: [
			{ nid: { host: "localhost", port: 8617 } },
			{ nid: { host: "localhost", port: 8554 } },
		],
		sharetype: SHARE_TYPE.All2All,
		privs: { write: true, read: true },
		ignored: ["indextable.json", "settings.json"],
		loggerconf: {
			init: false,
			ready: false,
			update: false,
			send: false,
			local: false,
			remote: false,
			error: false,
			online: false,
			vanish: false,
		},
		admin: false,
	},
	{
		user: "frank",
		root: "testroot\\frank",
		tablepath: "testroot\\frank\\indextable.json",
		settingspath: "testroot\\frank\\settings.json",
		nid: { host: "localhost", port: 8554 },
		peers: [
			{ nid: { host: "localhost", port: 8617 } },
			{ nid: { host: "localhost", port: 8124 } },
		],
		sharetype: SHARE_TYPE.All2All,
		privs: { write: true, read: true },
		ignored: ["indextable.json", "settings.json"],
		loggerconf: {
			init: false,
			ready: false,
			update: false,
			send: false,
			local: false,
			remote: false,
			error: false,
			online: false,
			vanish: false,
		},
		admin: false,
	},
]
