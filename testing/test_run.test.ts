import { join } from "path"
import { Medium } from "../src/enums"
import Vessel from "../src/Vessel"
import { compFiles, isDeepEqual } from "./utils.test"

const daveroot = join("testroot", "dave")
const evanroot = join("testroot", "evan")

const dave = new Vessel("dave", daveroot).rejoin()
const evan = new Vessel("evan", evanroot).rejoin()

setTimeout(() => {
	console.log("Pre index equal: ", isDeepEqual(dave.index, evan.index))
	console.log("Pre files equal: ", compFiles(daveroot, evanroot))
}, 1000)

setTimeout(() => {
	//dave.addVessel(Medium.local, { vessel: evan })
	//evan.addVessel(Medium.local, { vessel: dave })
	dave.addVessel(Medium.http, { nid: evan.nid() })
	evan.addVessel(Medium.http, { nid: dave.nid() })

	setTimeout(() => {
		console.log("Post index equal: ", isDeepEqual(dave.index, evan.index))
		console.log("Post files equal: ", compFiles(daveroot, evanroot))
	}, 2000)
}, 2000)
