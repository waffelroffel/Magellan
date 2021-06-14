import { existsSync, mkdirSync } from "fs"
import { createInterface } from "readline"
import { SHARE_TYPE } from "./src/enums"
import Vessel from "./src/Vessel"

main()
async function main(): Promise<void> {
	const [, , user, root, join, addr] = process.argv
	if (!existsSync(root)) mkdirSync(root, { recursive: true })
	let v: Vessel
	switch (join as string) {
		case "new":
			v = new Vessel(user, root).new(SHARE_TYPE.All2All).connect()
			break
		case "join": {
			const [host, port] = addr?.split(":")
			const conf = { host, port: +port }
			v = new Vessel(user, root).join(conf).connect()
			break
		}
		case "rejoin":
			v = new Vessel(user, root).rejoin().connect()
			break
		default:
			throw Error("illegal argument")
	}
	console.log(`Your nid: ${v.nid.host}:${v.nid.port}`)

	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	})
		.on("line", input => {
			console.log("Received:", input)
			switch (input) {
				case "exit":
					rl.close()
					return
				case "connect":
					v.connect()
					return
			}
		})
		.on("close", () => {
			console.log("Bye!")
			v.exit()
		})
}
