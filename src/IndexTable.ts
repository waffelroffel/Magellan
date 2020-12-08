import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ct } from "./utils";

const enum NodeTypes {
	RootFolder,
	RootFile,
	Folder,
	File
}

const enum TombTypes {
	Moved,
	Renamed,
	Deleted
}


export const enum ActionTypes {
	Add,
	Remove,
	Move,
	Change,
	Rename
}
interface Tomb {
	type: TombTypes,
	movedTo?: string | null
}

export interface NodeItem {
	type?: NodeTypes,
	path?: string,
	lastModified: number,
	lastAction: ActionTypes, // TODO: referrence to LOG/ LogItem id
	lastActionBy: string,
	tomb?: Tomb,
	creator?: string, //TODO
	onDevice?: boolean, //TODO
	reachable?: boolean, //TODO
	hash?: string | Buffer,//TODO
}

type NodeID = string


const temp_test_userid = "user1234"

export default class IndexTable {
	index: Map<NodeID, NodeItem>
	private indexpath: string
	private rootpath: string
	private tablefile: string = "indextable.json"
	private duppolicy = 0 // 0: latest timestamp wins, 1: deterministic rename one

	constructor(rootpath: string) {
		this.index = new Map()
		this.rootpath = rootpath
		this.indexpath = join(rootpath, this.tablefile)
	}

	/**
	 * Only use when creating a new network
	 */
	init() {
		// TODO: check for existing share network
		const t = ct()
		readdirSync(this.rootpath, { withFileTypes: true }).forEach((f) => {
			if (f.name === "indextable.json") return
			if (f.isFile()) this.addFile(f.name, temp_test_userid, t)
		});
	}

	show() {
		console.log(this.index)
	}

	save() {
		writeFileSync(this.indexpath, JSON.stringify([...this.index]))
	}

	load() {
		// TODO: need to check for type
		this.index = new Map<NodeID, NodeItem>(JSON.parse(readFileSync(this.indexpath).toString()));
	}

	apply(nodeid: NodeID, remoteitem: NodeItem): boolean {
		const localnode = this.index.get(nodeid)
		if (!localnode) {
			this.index.set(nodeid, remoteitem)
			return true
		} else if (remoteitem.lastModified <= localnode.lastModified) return false
		else if (remoteitem.lastAction === ActionTypes.Add) return this.addFile(nodeid, remoteitem.lastActionBy, remoteitem.lastModified, remoteitem)
		else if (remoteitem.lastAction === ActionTypes.Remove) return this.removeFile(nodeid, remoteitem.lastActionBy, remoteitem.lastModified, remoteitem)
		else if (remoteitem.lastAction === ActionTypes.Change) return this.changeFile(nodeid, remoteitem.lastActionBy, remoteitem.lastModified, remoteitem)

		return false
	}

	addFile(nodeid: NodeID, user: string, ts: number, meta?: NodeItem): boolean {
		if (nodeid === this.indexpath) return false
		const localnode = this.index.get(nodeid)
		if (!localnode) {
			this.update(nodeid, user, ts, ActionTypes.Add, meta)
			return true
		} else if (localnode.lastAction === ActionTypes.Add) {
			// TODO: choose between overwrite or new file'
			if (ts <= localnode.lastModified) return false
			this.update(nodeid, user, ts, ActionTypes.Add, meta)
			return true
		} else if (localnode.lastAction === ActionTypes.Remove) {
			// TODO: choose between overwrite tombstone or rename
			if (ts <= localnode.lastModified) return false
			this.update(nodeid, user, ts, ActionTypes.Add, meta)
			return true
		} else if (localnode.lastAction === ActionTypes.Change) {
			if (ts <= localnode.lastModified) return false
			this.update(nodeid, user, ts, ActionTypes.Add, meta)
			return true
		}
		return false
	}

	removeFile(nodeid: NodeID, user: string, ts: number, meta?: NodeItem): boolean {
		if (nodeid === this.indexpath) return false
		const localnode = this.index.get(nodeid)
		if (!localnode) return false
		else if (!localnode && meta) {
			this.index.set(nodeid, meta)
			return true
		} else if (localnode.lastAction === ActionTypes.Add) {
			if (ts <= localnode.lastModified) return false
			this.update(nodeid, user, ts, ActionTypes.Remove, meta)
			return true
		} else if (localnode.lastAction === ActionTypes.Remove) {
			// have oldest persist?
			if (ts <= localnode.lastModified && meta) return false
			this.update(nodeid, user, ts, ActionTypes.Remove, meta)
			return false
		} else if (localnode.lastAction === ActionTypes.Change) {
			if (ts <= localnode.lastModified) return false
			this.update(nodeid, user, ts, ActionTypes.Remove, meta)
			return true
		}
		return false
	}

	private newNode(user: string, ts: number, action: ActionTypes): NodeItem {
		const node: NodeItem = {
			lastModified: ts,
			lastAction: action,
			lastActionBy: user
		}
		if (action === ActionTypes.Remove) node.tomb = { type: TombTypes.Deleted }
		return node
	}

	private update(nodeid: NodeID, user: string, ts: number, action: ActionTypes, meta?: NodeItem): void {
		this.index.set(nodeid, meta ?? this.newNode(user, ts, action))
	}

	changeFile(nodeid: NodeID, user: string, ts: number, meta?: NodeItem): boolean {
		if (nodeid === this.indexpath) return false // TODO: refactor
		const localnode = this.index.get(nodeid)
		if (!localnode) {
			this.update(nodeid, user, ts, ActionTypes.Change, meta)
			return true
		} else if (localnode.lastAction === ActionTypes.Add) {
			if (ts <= localnode.lastModified) return false
			this.update(nodeid, user, ts, ActionTypes.Change, meta)
			return true
		} else if (localnode.lastAction === ActionTypes.Remove) {
			if (ts <= localnode.lastModified) return false
			this.update(nodeid, user, ts, ActionTypes.Change, meta)
			return true
		} else if (localnode.lastAction === ActionTypes.Change) {
			console.log("merge", meta)
			if (ts <= localnode.lastModified) return false
			this.update(nodeid, user, ts, ActionTypes.Change, meta)
			return true
		}
		return false
	}
}