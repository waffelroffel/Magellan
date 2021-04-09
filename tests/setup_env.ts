import { mkdirSync, rmdirSync, writeFileSync } from "fs"
import { join, sep } from "path"
import { TESTROOT } from "./config"

export default function make_test_env(
	users: string[],
	depth: number[],
	width: number[]
): void {
	rmdirSync(TESTROOT, { recursive: true })
	mkdirSync(TESTROOT)

	const roots = users.map(u => join(TESTROOT, u))
	roots.forEach((r, i) => make_sub_files(r, depth[i], width[i]))

	//console.log("Finished initializing test environment")
}

function make_sub_files(root: string, depth: number, width: number): void {
	mkdirSync(root)
	let dir = root
	for (let i = 0; i < depth + 1; i++) {
		if (i !== 0) {
			dir = join(dir, `${root.split(sep)[1][0]}_dir${i}`)
			mkdirSync(dir)
		}
		for (let j = 0; j < width; j++) {
			const file = join(dir, `${root.split(sep)[1][0]}${i}_${j}.txt`)
			writeFileSync(file, file)
		}
	}
}

if (require.main === module) make_test_env(["dave", "evan"], [0, 1], [1, 1])
