import { join } from "path"
import { SHARE_TYPE } from "../src/enums"
import Vessel from "../src/Vessel"
import { TESTROOT } from "./config.test"
import make_test_env from "./setup_env.test"
import { assert_index_and_files } from "./utils.test"

const users = ["dave", "evan"]

make_test_env(users, [1, 0], [1, 0])

const roots = users.map(u => join(TESTROOT, u))
const vessels = roots.map((ur, i) => new Vessel(users[i], ur))
vessels[0].new(SHARE_TYPE.All2All)
vessels[1].join(vessels[0].nid)

assert_index_and_files(vessels, roots, 1000, "Pre")

setTimeout(() => {
	vessels[0].connect()
	vessels[1].connect()
	assert_index_and_files(vessels, roots, 2000, "Post")
}, 2000)
