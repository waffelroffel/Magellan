import { join } from "path"
import Vessel from "../src/Vessel"

const dave = new Vessel("dave", join("testroot", "dave", "root")).rejoin()
const evan = new Vessel("evan", join("testroot", "evan", "root")).rejoin()

setTimeout(() => {
	dave.addVesselToNetwork(evan)
	evan.addVesselToNetwork(dave)
}, 3000)
