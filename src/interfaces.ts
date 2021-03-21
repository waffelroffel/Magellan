import {
	TombType,
	ItemType,
	ActionType,
	ResolveOption,
	SHARE_TYPE,
	ResponseCode,
} from "./enums"
import Vessel from "./Vessel"

// ---------------- Vessel ----------------
export interface Settings {
	user: string
	root: string
	rooti: number
	rootarr: string[]
	tableEnd: string
	tablePath: string
	settingsEnd: string
	settingsPath: string
	nid: NID
	peers: { nid: NID; admin: boolean }[]
	sharetype: SHARE_TYPE
	privs: Privileges
	ignores: string[]
	// TODO: add loggerconf
}

export interface StartupFlags {
	init: boolean
	skip: boolean
	check: boolean
}

export interface LoggerConfig {
	init?: boolean
	ready?: boolean
	update?: boolean
	send?: boolean
	local?: boolean
	remote?: boolean
	error?: boolean
	online?: boolean
	vanish?: boolean
}

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

export interface ProxyOption {
	vessel?: Vessel
	nid?: NID
	admin?: boolean
}

export interface InviteResponse {
	sharetype: SHARE_TYPE
	peers: NID[]
}

// ---------------- PROXY ----------------
export type PStreamable =
	| NodeJS.ReadableStream
	| Promise<NodeJS.ReadableStream>
	| null
export type PIndexArray = IndexArray | Promise<IndexArray>
export type PInviteResponse = InviteResponse | Promise<InviteResponse>
export type PResponseCode = ResponseCode | Promise<ResponseCode>

// ---------------- RESOLVES ----------------
export interface Resolution {
	before?: Item
	after: Item
	io: boolean
	ro: ResolveOption
	same?: boolean
	new?: boolean
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

// ---------------- PRIVILEGES ----------------
export interface Privileges {
	read: boolean
	write: boolean
}
