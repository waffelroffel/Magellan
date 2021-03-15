import { createReadStream } from "fs"
import HTTPProxy from "../src/Proxies/HTTPProxy"
import CargoList from "../src/CargoList"
import { ItemType, ActionType } from "../src/enums"

const rs = createReadStream("testroot/dave/root/4.txt")
const item = CargoList.newItem(
	"path123",
	"uuid123",
	ItemType.File,
	123,
	ActionType.Add,
	"user123"
)

const hp = new HTTPProxy("localhost", 8000)
hp.send(item, rs)
