import { Socket } from "net"
import { ReadStream } from "fs"
import {
	TombTypes,
	ItemTypes,
	ActionTypes,
	FileResolveOption,
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
	hash?: string // Files only
	onDevice?: boolean
	tomb?: Tomb
	creator?: string //TODO
	reachable?: boolean //TODO
}

export type SerializedIndex = [string, Item[]][]

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
	ip: string
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
	addadd: FileResolveOption
	addrem: FileResolveOption
	addchg: FileResolveOption
	remrem: FileResolveOption
	remchg: FileResolveOption
	chgchg: FileResolveOption
}

export interface FileResolveMap {
	addadd: ResolveLogic
	addrem: ResolveLogic
	addchg: ResolveLogic
	remrem: ResolveLogic
	remchg: ResolveLogic
	chgchg: ResolveLogic
}
