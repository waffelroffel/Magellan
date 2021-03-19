import { join } from "path"
import { Medium, SHARE_TYPE } from "../src/enums"
import Vessel from "../src/Vessel"
import { TESTROOT } from "./config.test"
import make_test_env from "./setup_env.test"
import { assert_index_and_files } from "./utils.test"

const users = ["dave", "evan"]

make_test_env(users, [0, 1], [1, 1])

const roots = users.map(u => join(TESTROOT, u))
const vessels = roots.map(
	(ur, i) => new Vessel(users[i], ur).new(SHARE_TYPE.All2All) // TODO: rewrite
)

assert_index_and_files(vessels, roots, 1000, "Pre")

setTimeout(() => {
	vessels[0].addVessel(Medium.http, { nid: vessels[1].nid })
	vessels[1].addVessel(Medium.http, { nid: vessels[0].nid })

	assert_index_and_files(vessels, roots, 2000, "Post")
}, 2000)
