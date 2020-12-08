import IndexTable from "./IndexTable";

const path = String.raw`root`;
const index = new IndexTable(path)

const i = 0
if (i === 0) {
    index.init()
    index.show()
    index.save()
} else {
    index.load()
    index.show()
}