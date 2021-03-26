import { HeaderInit } from "node-fetch"
import {
	TombType,
	ItemType,
	ActionType,
	ResolveOption,
	SHARE_TYPE,
	ResponseCode,
	PERMISSION,
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
	peers: { nid: NID }[]
	sharetype: SHARE_TYPE
	privs: Privileges
	ignores: string[]
	loggerconf: LoggerConfig
	admin: boolean
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
	uuid: string
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

// ---------------- PROXY ----------------
export type PReadable =
	| NodeJS.ReadableStream
	| null
	| Promise<NodeJS.ReadableStream | null>
export type PIndexArray = IndexArray | Promise<IndexArray>
export type PInviteResponse = Invite | Promise<Invite>
export type PResponseCode = ResponseCode | Promise<ResponseCode>
export type PPermissionGrant = PermissionGrant | Promise<PermissionGrant>

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

// ---------------- SERVER ----------------
export interface Invite {
	sharetype: SHARE_TYPE
	privs: { write: boolean; read: boolean }
	peers: NID[]
}
export interface Sid {
	sid: string
}

export interface VesselResponse<D = undefined> {
	msg: string
	code: ResponseCode
	data?: D
}

export type StreamResponse = NodeJS.ReadableStream | VesselResponse

export interface FetchOptions {
	params?: string
	body?: NodeJS.ReadableStream | string
}
export interface Api {
	end: string
	method: string
	headers?: HeaderInit
}

export interface VesselAPIs {
	senditemmeta: Api
	senditemdata: Api
	getitem: Api
	getindex: Api
	getinvite: Api
	addpeer: Api
	getPriv: Api
}

export interface PermissionGrant {
	priv: PERMISSION
	grant: boolean
}
