import { APIS } from "../src/Proxies/HTTPProxy"
import { ResponseCode, PERMISSION } from "../src/enums"
import VesselServer from "../src/VesselServer"
import Vessel from "../src/Vessel"
import fetch from "node-fetch"
import { Api, FetchOptions, VesselResponse } from "../src/interfaces"
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
	// vessel.index.asArray = () => {}
	// this.vessel.invite(req.body)
	// this.vessel.getRS(req.body)
	// this.vessel.applyIncoming(req.body)
	// this.vessel.proxylist.has(req.body)
	// this.vessel.proxylist.addNode(Medium.http, { nid: req.body })
	// this.vessel.saveSettings()
}

beforeAll(async () => {
	vessel = new Vessel("alice", "testroot")
	mockVesselFns(vessel)
	server = new VesselServer(vessel, "localhost", 8180)
	await server.listen()
})

describe("VesselServer CMDs", () => {
	test("remote denied", async () => {
		// TODO
	})
	test("nid", async () => {
		const res = await cmdfetch("nid")
		expect(res.code).toBe(ResponseCode.DNE)
	})
	test("connect", async () => {
		const res = await cmdfetch("connect")
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
	test("default", async () => {
		const res = await cmdfetch("something")
		expect(res.code).toBe(ResponseCode.ERR)
	})
})

describe("VesselServer APIs", () => {
	// TODO
	test("index", () => {})
	test("invite", () => {})
	test("item", () => {})
	test("item/meta", () => {})
	test("item/data/:sid", () => {})
	test("addpeer", () => {})
	test("permission", async () => {
		// jest.spyOn(vessel, "isAdmin", "get").mockReturnValue(true)
		Object.defineProperty(vessel, "isAdmin", { get: jest.fn(() => true) })
		vessel.grantPrivs = () => true

		const res = await apifetch(APIS.getPriv, {
			params: `?get=${PERMISSION.WRITE}`,
			body: JSON.stringify({ host: "localhost", port: 8111 }),
		})
		expect(res.code).toBe(ResponseCode.DNE)
	})
})

afterAll(() => server.close())
