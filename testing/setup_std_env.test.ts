import { mkdirSync, rmdirSync, writeFileSync } from "fs"
import { join } from "path"

function stdenv() {
	rmdirSync("testroot", { recursive: true })

	const p0 = "testroot"
	const p1 = join(p0, "dave")
	const p2 = join(p0, "evan")
	const p3 = join(p1, "root")
	const p4 = join(p2, "root")
	const p5 = join(p4, "dir1")

	const p = [p0, p1, p2, p3, p4, p5]

	mkdirSync(p5, { recursive: true })
	mkdirSync(p3, { recursive: true })

	for (const [i, pn] of p.entries()) {
		if (i < 3) continue
		writeFileSync(join(pn, i + ".txt"), pn)
	}

	console.log("Finished initializing standard test environment")
}

if (require.main === module) stdenv()
