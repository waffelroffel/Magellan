import CargoList from "./CargoList"

const root = String.raw`testroot`
const cl = new CargoList(root)

if (false) {
	cl.initfromroot()
	cl.show()
	cl.save()
} else {
	cl.load()
	cl.show()
}
