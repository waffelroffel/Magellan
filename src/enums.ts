// ---------------- CARGOLIST ----------------
export const enum ItemTypes {
	Folder,
	File,
}

const ITEM_TYPES = [ItemTypes.Folder, ItemTypes.File]

export const toItemType = (value: string): ItemTypes => {
	const type = ITEM_TYPES.find(it => it.toString() === value)
	if (type === undefined) throw Error("toItemType: invalid type")
	return type
}

export const enum TombTypes {
	Moved,
	Renamed,
	Deleted,
}

const TOMB_TYPES = [TombTypes.Moved, TombTypes.Renamed, TombTypes.Deleted]

export const toTombTypes = (value: string): TombTypes => {
	const tomb = TOMB_TYPES.find(tt => tt.toString() === value)
	if (tomb === undefined) throw Error("toTombTypes: invalid type")
	return tomb
}

export const enum ActionTypes {
	Add = "ADD",
	Remove = "REM",
	Move = "MOV",
	Change = "CHG",
	Rename = "RNM",
}

const ACTION_TYPES = [
	ActionTypes.Add,
	ActionTypes.Remove,
	ActionTypes.Move,
	ActionTypes.Change,
	ActionTypes.Rename,
]

export const toActionType = (value: string): ActionTypes => {
	const action = ACTION_TYPES.find(at => at === value)
	if (action === undefined) throw Error("toActionType: invalid type")
	return action
}

//export type Resolution = [boolean, string, () => {}]

// ---------------- NETWORK ----------------
export const enum Medium {
	http,
	//socket,
	local,
}

// ---------------- RESOLVES ----------------
//TODO clean values
export const enum ResolveOption {
	LWW,
	DUP,
}
