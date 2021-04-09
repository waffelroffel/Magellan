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
	tablepath: string
	settingspath: string
	nid: NID
	peers: { nid: NID }[]
	sharetype: SHARE_TYPE
	privs: Permissions
	ignored: string[]
	loggerconf: LoggerConfig
	admin: boolean
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
	offline?: boolean
	vanish?: boolean
}

export interface VesselOptions extends CargoListOptions {
	loggerconf?: LoggerConfig
}

// ---------------- CARGOLIST ----------------
export interface Tomb {
	type: TombType
	movedTo?: string
}
export interface Item {
	path: string
	id: string
	type: ItemType
	lastModified: number
	lastAction: ActionType // TODO: referrence to LOG/ LogItem id
	lastActionBy: string
	actionId: string
	hash?: string // Files only
	//onDevice: boolean
	tomb?: Tomb
	parent?: { path: string; id: string } //TODO
	reachable?: boolean //TODO
	clock: VectorClock
}

export type VectorClock = [string, number][]

export type IndexArray = [string, Item[]][]

export interface CargoListOptions {
	filerp?: FileRPConfig
	dirrp?: DirRPConfig
}

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
export type ProxyRes<T> = T | null | Promise<T | null>

// ---------------- RESOLVES ----------------
export interface Resolution {
	before?: Item
	after: Item
	ro: ResolveOption
	new?: boolean
	rename?: boolean
	overwrite?: boolean
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

// ---------------- PERMISSIONS ----------------
export interface Permissions {
	read: boolean
	write: boolean
}

// ---------------- SERVER ----------------
export interface Invite {
	sharetype: SHARE_TYPE
	perms: { write: boolean; read: boolean }
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
	cmd: Api
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
