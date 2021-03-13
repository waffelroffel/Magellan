import { join } from "path"
import { v4 as uuid4 } from "uuid"
import { ActionType as AT, ItemType as IT } from "../src/enums"
import CargoList from "../src/CargoList"
import { ct } from "../src/utils"
import {
	LWWFileConfig,
	LWWDirConfig,
} from "../src/ResolvePolicies/defaultconfigs"

const cl = new CargoList(join("testroot"), LWWFileConfig, LWWDirConfig)
const i1 = CargoList.newItem("a.txt", uuid4(), IT.File, ct(), AT.Add, "adam")
const i2 = CargoList.newItem("a.txt", uuid4(), IT.File, ct(), AT.Add, "eve")

cl.apply(i1)
cl.apply(i2)
cl.save()
