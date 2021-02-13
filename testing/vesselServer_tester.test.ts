import fetch from "node-fetch"
import { createReadStream } from "fs"

const rs = createReadStream("testroot/dave/root/4.txt")

fetch("http://localhost:8000", { method: "POST", body: rs }).then(res =>
	console.log("done")
)
