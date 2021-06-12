import { Medium } from "../src/enums"
import HTTPProxy from "../src/Proxies/HTTPProxy"
import ProxyList from "../src/ProxyList"
import Vessel from "../src/Vessel"
jest.mock("../src/Vessel")

test("proxylist", () => {
	const pl = new ProxyList()

	pl.addNode(Medium.local, { vessel: new Vessel("", "") })
	expect(pl.length).toBe(1)

	pl.addNode(Medium.http, { nid: { host: "localhost", port: 8080 } })
	expect(pl.length).toBe(2)

	const has = pl.has({ host: "localhost", port: 8080 })
	expect(has).toBeTruthy()

	const proxies = pl.serialize()
	expect(proxies).toEqual([{ nid: { host: "localhost", port: 8080 } }])

	const p = pl.get({ host: "localhost", port: 8080 })
	if (!p) fail("illegal state")
	expect(p instanceof HTTPProxy).toBeTruthy()

	pl.removeNode(p)
	expect(pl.length).toBe(1)
})
