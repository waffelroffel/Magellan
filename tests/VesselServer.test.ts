import { ActionType, ItemType, PERMISSION, ResponseCode } from "../src/enums"
import VesselServer from "../src/VesselServer"
import Vessel from "../src/Vessel"
import fetch from "node-fetch"
import {
	Api,
	FetchOptions,
	IndexArray,
	Invite,
	Item,
	NID,
	Sid,
	VesselResponse,
} from "../src/interfaces"
import { TEST_INDEXARRAY, TEST_INVITE, TEST_ITEM, TEST_TEXT } from "./config"
import APIS from "../src/apis"
jest.mock("../src/Vessel")

let vessel: Vessel
let server: VesselServer

function cmdfetch<T = undefined>(cmd: string): Promise<VesselResponse<T>> {
	return fetch(`http://localhost:8180/?cmd=${cmd}`).then(res => res.json())
}

function apifetch<T = undefined>(
	api: Api,
	opts?: FetchOptions
): Promise<VesselResponse<T>> {
	return fetch(`http://localhost:8180${api.end}${opts?.params ?? ""}`, {
		method: api.method,
		headers: api.headers,
		body: opts?.body,
	}).then(res => res.json())
}

const item: Item = {
	path: "test.txt",
	id: "1b45d92d-829a-4204-934e-1494306f99b2",
	type: ItemType.File,
	lastModified: 0,
	lastAction: ActionType.Add,
	lastActionBy: "robot",
	actionId: "1b45d92d-829a-4204-934e-1414306f99b2",
	hash: "001aa9b3369386a9ee468c74a74330d8f4aaf9656d115579aa304b5aac950194",
	clock: [["robot", 1]],
}

function mockVesselFns(vessel: Vessel): void {
	Object.defineProperty(vessel, "isAdmin", { get: jest.fn(() => true) }) // jest.spyOn(vessel, "isAdmin", "get").mockReturnValue(true)
	vessel.getIndexArray = () => TEST_INDEXARRAY
	vessel.invite = () => TEST_INVITE
	vessel.getData = () => TEST_TEXT
	vessel.addPeer = () => true // TODO
	vessel.checkIndexVer = (_: NID, id: string) =>
		id !== "1234" ? (["", [item]] as unknown as IndexArray) : null
}

beforeAll(async () => {
	vessel = new Vessel("alice", "testroot")
	mockVesselFns(vessel)
	server = new VesselServer(vessel, "localhost", 8180)
	await server.listen()
})

describe("VesselServer CMDs", () => {
	test("default", async () => {
		const res = await cmdfetch("something")
		expect(res.code).toBe(ResponseCode.ERR)
	})
	test("nid", async () => {
		const res = await cmdfetch("nid")
		expect(res.code).toBe(ResponseCode.DNE)
	})
	test("connect", async () => {
		const res = await cmdfetch("connect")
		expect(res.code).toBe(ResponseCode.DNE)
	})
	test("disconnect", async () => {
		const res = await cmdfetch("disconnect")
		expect(res.code).toBe(ResponseCode.DNE)
	})
	test("exit", async () => {
		const res = await cmdfetch("exit")
		expect(res.code).toBe(ResponseCode.DNE)
	})
	test("vanish", async () => {
		const res = await cmdfetch("vanish")
		expect(res.code).toBe(ResponseCode.DNE)
	})
})

describe("VesselServer APIs", () => {
	test("index", async () => {
		const res = await apifetch<IndexArray>(APIS.getindex)
		expect(res.code).toBe(ResponseCode.DNE)
	})
	test("invite", async () => {
		const res = await apifetch<Invite>(APIS.getinvite, {
			body: JSON.stringify({ host: "localhost", port: 8111 }),
		})
		expect(res.code).toBe(ResponseCode.DNE)
	})
	test("item", async () => {
		const res = await apifetch<string>(APIS.getitem, {
			body: JSON.stringify(TEST_ITEM),
		})
		expect(res.data).toBe(TEST_TEXT)
	})
	test("item/(meta|data)", async () => {
		const res1 = await apifetch<Sid>(APIS.senditemmeta, {
			body: JSON.stringify(TEST_ITEM),
		})
		if (!res1.data?.sid) fail("data undefined")
		expect(res1.code).toBe(ResponseCode.NXT)
		expect(server.tempitems.size).toBe(1)

		const res2 = await apifetch(APIS.senditemdata, {
			params: res1.data.sid,
			body: JSON.stringify({ data: "SECRET" }),
		})
		expect(res2.code).toBe(ResponseCode.DNE)
		expect(server.tempitems.size).toBe(0)
	})
	test("addpeer", async () => {
		const res = await apifetch(APIS.addpeer, {
			body: JSON.stringify({ host: "localhost", port: 8111 }),
		})
		expect(res.code).toBe(ResponseCode.DNE)
		expect(res.msg).toBe("Peer already registred")
	})
	test("reqpermission", async () => {
		const res = await apifetch(APIS.reqPerm, {
			params: `?get=${PERMISSION.WRITE}`, // FIX
			body: JSON.stringify({ host: "localhost", port: 8111 }),
		})
		expect(res.code).toBe(ResponseCode.DNE)
		expect(res.msg).toBe(`${PERMISSION.WRITE} permission under review`)
	})
	test("grantpermission", async () => {
		const res = await apifetch(APIS.grantPerm, {
			body: JSON.stringify({ priv: PERMISSION.WRITE, grant: true }),
		})
		expect(res.code).toBe(ResponseCode.DNE)
		expect(res.msg).toBe(`${PERMISSION.WRITE} permission received`)
	})
	test("checkindex", async () => {
		const res1 = await apifetch<IndexArray>(APIS.checkIndexVer, {
			body: JSON.stringify({
				nid: { host: "localhost", port: 8111 },
				id: "1234",
			}),
		})
		expect(res1.data).toBeUndefined()
		expect(res1.code).toBe(ResponseCode.DNE)

		const res2 = await apifetch<IndexArray>(APIS.checkIndexVer, {
			body: JSON.stringify({
				nid: { host: "localhost", port: 8111 },
				id: "1111",
			}),
		})
		expect(res2.data).toBeDefined()
		expect(res2.code).toBe(ResponseCode.DNE)
	})
})

afterAll(() => server.close())
