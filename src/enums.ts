// ---------------- Vessel ----------------
export const enum SHARE_TYPE {
	All2All = "A2A", // everyone can do whatever they want
	One2Aall = "12A", // one to many
}

const SHARE_TYPES = [SHARE_TYPE.All2All, SHARE_TYPE.One2Aall]

export const toShareType = (value: string): SHARE_TYPE => {
	const type = SHARE_TYPES.find(st => st === value)
	if (!type) throw Error("toShareType: invalid value")
	return type
}

// ---------------- CARGOLIST ----------------
export const enum ItemType {
	Dir = "D",
	File = "F",
}

const ITEM_TYPES = [ItemType.Dir, ItemType.File]

export const toItemType = (value: string): ItemType => {
	const type = ITEM_TYPES.find(it => it === value)
	if (!type) throw Error("toItemType: invalid value")
	return type
}

export const enum TombType {
	Moved = "M",
	//Renamed = "R",
	Deleted = "D",
}

const TOMB_TYPES = [TombType.Moved, TombType.Deleted]

export const toTombTypes = (value: string): TombType => {
	const tomb = TOMB_TYPES.find(tt => tt === value)
	if (!tomb) throw Error("toTombTypes: invalid value")
	return tomb
}

export const enum ActionType {
	Add = "ADD",
	Remove = "REM",
	Change = "CHG",
	MovedFrom = "MOV_FROM",
	MovedTo = "MOV_TO",
}

const ACTION_TYPES = [
	ActionType.Add,
	ActionType.Remove,
	ActionType.Change,
	ActionType.MovedFrom,
	ActionType.MovedTo,
]

export const toActionType = (value: string): ActionType => {
	const action = ACTION_TYPES.find(at => at === value)
	if (!action) throw Error("toActionType: invalid value")
	return action
}

// ---------------- NETWORK ----------------
export const enum Medium {
	http,
	//socket,
	local,
}

// ---------------- SERVER ----------------
export const enum ResponseCode {
	DNE = "DNE",
	NXT = "NXT",
	ERR = "ERR",
}

// ---------------- RESOLVES ----------------
export const enum ResolveOption {
	LWW = "LWW",
	DUP = "DUP",
}

// ---------------- PERMISSIONS ----------------
export const enum PERMISSION {
	WRITE = "W",
	READ = "R",
}

const PERMISSIONS = [PERMISSION.WRITE, PERMISSION.READ]

export const toPermission = (value: string): PERMISSION => {
	const type = PERMISSIONS.find(st => st === value)
	if (!type) throw Error("toPermission: invalid value")
	return type
}
