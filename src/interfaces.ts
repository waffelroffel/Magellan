import { Socket } from "net"
import { ReadStream } from "fs"
import { TombType, ItemType, ActionType, ResolveOption } from "./enums"
import { IncomingMessage } from "http"

// ---------------- CARGOLIST ----------------
export interface Tomb {
	type: TombType
	movedTo?: string
}

export interface Item {
	path: string
	uuid: string // Buffer
	type: ItemType
	lastModified: number
	lastAction: ActionType // TODO: referrence to LOG/ LogItem id
	lastActionBy: string
	actionId: string
	hash?: string // Files only
	onDevice?: boolean
	tomb?: Tomb
	creator?: string //TODO
	reachable?: boolean //TODO
}

export type IndexArray = [string, Item[]][]

// ---------------- LOG ----------------
export interface LogId {
	n: number
	user: string
}

export interface LogItem {
	id: LogId
	item: Item
}

// ---------------- NETWORK ----------------
export interface NID {
	host: string
	port: number
}

export type Streamable =
	| ReadStream
	| Socket
	| null
	| IncomingMessage
	| NodeJS.ReadableStream // TODO: workaround null

// ---------------- RESOLVES ----------------
export interface Resolution {
	before?: Item
	after: Item
	io: boolean
}

export type ResolveLogic = (item1: Item, item2: Item) => Resolution[]

export interface FileRPConfig {
	addadd: ResolveOption
	addrem: ResolveOption
	addchg: ResolveOption
	remrem: ResolveOption
	remchg: ResolveOption
	chgchg: ResolveOption
}

export interface DirRPConfig {
	addadd: ResolveOption
	addrem: ResolveOption
	remrem: ResolveOption
}
