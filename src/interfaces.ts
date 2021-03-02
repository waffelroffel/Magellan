import { Socket } from "net"
import { ReadStream } from "fs"
import {
	TombTypes,
	ItemTypes,
	ActionTypes,
	ResolveOption,
	Medium,
} from "./enums"
import { Response } from "node-fetch"
import { IncomingMessage } from "http"

// ---------------- CARGOLIST ----------------
export interface Tomb {
	type: TombTypes
	movedTo?: string
}

export interface Item {
	path: string
	uuid: string // Buffer
	type: ItemTypes
	lastModified: number
	lastAction: ActionTypes // TODO: referrence to LOG/ LogItem id
	lastActionBy: string
	actionId: string
	hash?: string // Files only
	onDevice?: boolean
	tomb?: Tomb
	creator?: string //TODO
	reachable?: boolean //TODO
}

export type IndexArray = [string, Item[]][]

// ---------------- VESSEL ----------------
export type StreamCreator = (items: Item, type: Medium) => Streamable

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
export type ResolveLogic = (item1: Item, item2: Item) => [Item, number]

export interface FileRPConfig {
	addadd: ResolveOption
	addrem: ResolveOption
	addchg: ResolveOption
	remrem: ResolveOption
	remchg: ResolveOption
	chgchg: ResolveOption
}

export interface FileResolveMap {
	addadd: ResolveLogic
	addrem: ResolveLogic
	addchg: ResolveLogic
	remrem: ResolveLogic
	remchg: ResolveLogic
	chgchg: ResolveLogic
}

export interface DirRPConfig {
	addadd: ResolveOption
	addrem: ResolveOption
	remrem: ResolveOption
}

export interface DirResolveMap {
	addadd: ResolveLogic
	addrem: ResolveLogic
	remrem: ResolveLogic
}
