import { join } from "path"
import Vessel from "../src/Vessel"

const dave = new Vessel("dave", join("testroot", "dave", "root"))
const evan = new Vessel("evan", join("testroot", "evan", "root"))

dave.addToNetwork(evan)
evan.addToNetwork(dave)
