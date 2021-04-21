import { ResponseCode, PERMISSION } from "../src/enums"
import VesselServer from "../src/VesselServer"
import Vessel from "../src/Vessel"
import fetch from "node-fetch"
import {
	Api,
	FetchOptions,
	IndexArray,
	Invite,
	PermissionGrant,
	Sid,
	VesselResponse,
} from "../src/interfaces"
import {
	TEST_INDEXARRAY,
	TEST_INVITE,
	TEST_ITEM,
	TEST_READSTREAM,
	TEST_TEXT,
	TEST_WRITESTREAM,
} from "./config"
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

function mockVesselFns(vessel: Vessel): void {
	Object.defineProperty(vessel, "isAdmin", { get: jest.fn(() => true) }) // jest.spyOn(vessel, "isAdmin", "get").mockReturnValue(true)
	vessel.getIndexArray = () => TEST_INDEXARRAY
	vessel.invite = () => TEST_INVITE
	vessel.getRS = () => TEST_READSTREAM
	vessel.addPeer = () => true
	vessel.grantPrivs = () => true
}

beforeAll(async () => {
	vessel = new Vessel("alice", "testroot")
	mockVesselFns(vessel)
	server = new VesselServer(vessel, "localhost", 8180)
	await server.listen()
})

describe("VesselServer CMDs", () => {
	test("nid", async () => {
		const res = await cmdfetch("nid")
		expect(res.code).toBe(ResponseCode.DNE)
	})
	test("connect", async () => {
		const res = await cmdfetch("connect")
		expect(res.code).toBe(ResponseCode.DNE)
	})
	test("default", async () => {
		const res = await cmdfetch("something")
		expect(res.code).toBe(ResponseCode.ERR)
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
		const res = await fetch(`http://localhost:8180${APIS.getitem.end}`, {
			method: APIS.getitem.method,
			headers: APIS.getitem.headers,
			body: JSON.stringify(TEST_ITEM),
		})
		expect(res.body.setEncoding("utf8").read()).toBe(TEST_TEXT)
	})
	test("item/(meta|data)", async () => {
		// TODO: test for ActionType.Remove
		const res1 = await apifetch<Sid>(APIS.senditemmeta, {
			body: JSON.stringify(TEST_ITEM),
		})
		if (!res1.data?.sid) fail("data undefined")
		expect(res1.code).toBe(ResponseCode.NXT)
		expect(server.tempitems.size).toBe(1)

		const res2 = await apifetch(APIS.senditemdata, {
			params: res1.data.sid,
			body: TEST_WRITESTREAM,
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
	test("permission", async () => {
		const res = await apifetch<PermissionGrant>(APIS.getPriv, {
			params: `?get=${PERMISSION.WRITE}`,
			body: JSON.stringify({ host: "localhost", port: 8111 }),
		})
		expect(res.code).toBe(ResponseCode.DNE)
	})
})

afterAll(() => server.close())
