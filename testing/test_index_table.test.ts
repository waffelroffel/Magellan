import { join } from "path"
import CargoList from "../src/CargoList"

const root = join("testroot", "dave", "root")
const cl = new CargoList(root)

if (false) {
	cl.initfromroot()
	cl.show()
	cl.save()
} else {
	cl.load()
	cl.show()
}
