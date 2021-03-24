// ---------------- Vessel ----------------
export const enum SHARE_TYPE {
	All2All = "A2A", // everyone can do whatever they want
	One2Aall = "121", // one/few admin(s)
}

const SHARE_TYPES = [SHARE_TYPE.All2All, SHARE_TYPE.One2Aall]

export const toShareType = (value: string): SHARE_TYPE => {
	const type = SHARE_TYPES.find(st => st === value)
	if (!type) throw Error("toShareType: invalid type")
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
	if (!type) throw Error("toItemType: invalid type")
	return type
}

export const enum TombType {
	Moved = "M",
	Renamed = "R",
	Deleted = "D",
}

const TOMB_TYPES = [TombType.Moved, TombType.Renamed, TombType.Deleted]

export const toTombTypes = (value: string): TombType => {
	const tomb = TOMB_TYPES.find(tt => tt === value)
	if (!tomb) throw Error("toTombTypes: invalid type")
	return tomb
}

export const enum ActionType {
	Add = "ADD",
	Remove = "REM",
	Move = "MOV",
	Change = "CHG",
	Rename = "RNM",
}

const ACTION_TYPES = [
	ActionType.Add,
	ActionType.Remove,
	ActionType.Move,
	ActionType.Change,
	ActionType.Rename,
]

export const toActionType = (value: string): ActionType => {
	const action = ACTION_TYPES.find(at => at === value)
	if (!action) throw Error("toActionType: invalid type")
	return action
}

// ---------------- NETWORK ----------------
export const enum Medium {
	http,
	//socket,
	local,
}

// ---------------- RESOLVES ----------------
export const enum ResponseCode {
	DNE = "DNE",
	NXT = "NXT",
	ERR = "ERR",
}

// ---------------- RESOLVES ----------------
export const enum ResolveOption {
	LWW,
	DUP,
}

// ---------------- PRIVILEGES ----------------
export const enum PRIVILEGE_TYPE {
	READ,
	WRITE,
}
