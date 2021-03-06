import { join } from "path"
import { v4 as uuid4 } from "uuid"
import {
	ActionType as AT,
	ItemType as IT,
	ResolveOption as RO,
} from "../src/enums"
import { DirRPConfig, FileRPConfig } from "../src/interfaces"
import CargoList from "../src/CargoList"
import { ct } from "../src/utils"

const filerp: FileRPConfig = {
	addadd: RO.DUP,
	addrem: RO.DUP,
	addchg: RO.DUP,
	remrem: RO.DUP,
	remchg: RO.DUP,
	chgchg: RO.DUP,
}

const dirrp: DirRPConfig = {
	addadd: RO.DUP,
	addrem: RO.DUP,
	remrem: RO.DUP,
}

const cl = new CargoList(join("testroot"), filerp, dirrp)
const i1 = CargoList.newItem("a.txt", uuid4(), IT.File, ct(), AT.Add, "adam")
const i2 = CargoList.newItem("a.txt", uuid4(), IT.File, ct(), AT.Add, "eve")

cl.apply(i1)
cl.apply(i2)
cl.save()
