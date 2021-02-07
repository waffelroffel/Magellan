import { mkdirSync, rmdirSync, writeFileSync } from "fs"
import { join } from "path"

function memenv() {
	rmdirSync("testroot", { recursive: true })
	mkdirSync("testroot")

	const depth = 4
	const width = 1000
	let root = "testroot"

	for (let d = 0; d < depth; d++) {
		for (let i = 0; i < width; i++) {
			writeFileSync(join(root, i + ".txt"), i.toString())
		}
		root = join(root, (d + 1).toString())
		mkdirSync(root)
	}

	console.log("Finished initializing memory test environment")
}

if (require.main === module) memenv()
