import { mkdirSync, rmdirSync, writeFileSync } from "fs"
import { join } from "path"

export default function stdenv() {
	rmdirSync("testroot", { recursive: true })

	const p0 = "testroot"
	const p1 = join(p0, "dave")
	const p2 = join(p0, "evan")
	const p5 = join(p2, "dir1")

	const p = [p0, p1, p2, p5]

	mkdirSync(p5, { recursive: true })
	mkdirSync(p1, { recursive: true })

	p.forEach((pn, i) => i !== 0 && writeFileSync(join(pn, i + ".txt"), pn + i))

	console.log("Finished initializing standard test environment")
}

if (require.main === module) stdenv()
