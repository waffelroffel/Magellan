// ---------------- Vessel ----------------
export const enum SHARE_TYPE {
	All2All, // everyone can do whatever they want
	One2Aall, // one/few admin(s)
}

// ---------------- CARGOLIST ----------------
export const enum ItemType {
	Folder,
	File,
}

const ITEM_TYPES = [ItemType.Folder, ItemType.File]

export const toItemType = (value: string): ItemType => {
	const type = ITEM_TYPES.find(it => it.toString() === value)
	if (type === undefined) throw Error("toItemType: invalid type")
	return type
}

export const enum TombType {
	Moved,
	Renamed,
	Deleted,
}

const TOMB_TYPES = [TombType.Moved, TombType.Renamed, TombType.Deleted]

export const toTombTypes = (value: string): TombType => {
	const tomb = TOMB_TYPES.find(tt => tt.toString() === value)
	if (tomb === undefined) throw Error("toTombTypes: invalid type")
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
	if (action === undefined) throw Error("toActionType: invalid type")
	return action
}

// ---------------- NETWORK ----------------
export const enum Medium {
	http,
	//socket,
	local,
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
