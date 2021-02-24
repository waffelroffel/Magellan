import { join } from "path"
import { Medium } from "../src/enums"
import Vessel from "../src/Vessel"
import isDeepEqual from "./utils.test"

const dave = new Vessel("dave", join("testroot", "dave", "root")).rejoin()
const evan = new Vessel("evan", join("testroot", "evan", "root")).rejoin()

setTimeout(() => {
	console.log("Pre index equal: ", isDeepEqual(dave.index, evan.index))
}, 1000)

setTimeout(() => {
	//dave.addVessel(Medium.local, { vessel: evan })
	//evan.addVessel(Medium.local, { vessel: dave })
	dave.addVessel(Medium.http, { nid: evan.nid() })
	evan.addVessel(Medium.http, { nid: dave.nid() })

	setTimeout(() => {
		console.log("Post index equal: ", isDeepEqual(dave.index, evan.index))
	}, 2000)
}, 2000)
