// ---------------- CARGOLIST ----------------
export const enum ItemTypes {
	//RootFolder,
	//RootFile,
	Folder,
	File,
}

export const stringToItemType = (value: string): ItemTypes => {
	switch (value) {
		case "0":
			return ItemTypes.Folder
		case "1":
			return ItemTypes.File
		default:
			throw Error("stringToItemType: invalid type")
	}
}

export const enum TombTypes {
	Moved,
	Renamed,
	Deleted,
}

export const stringToTombTypes = (value: string): TombTypes => {
	switch (value) {
		case "0":
			return TombTypes.Moved
		case "1":
			return TombTypes.Renamed
		case "2":
			return TombTypes.Deleted
		default:
			throw Error("stringToTombTypes: invalid type")
	}
}

export const enum ActionTypes {
	Add = "ADD",
	Remove = "REM",
	Move = "MOV",
	Change = "CHG",
	Rename = "RNM",
}

export const stringToActionType = (value: string): ActionTypes => {
	switch (value) {
		case ActionTypes.Add:
			return ActionTypes.Add
		case ActionTypes.Remove:
			return ActionTypes.Remove
		case ActionTypes.Move:
			return ActionTypes.Move
		case ActionTypes.Rename:
			return ActionTypes.Rename
		case ActionTypes.Change:
			return ActionTypes.Change
		default:
			throw Error("stringToActionType: invalid type")
	}
}

// ---------------- NETWORK ----------------
export const enum Medium {
	http,
	socket,
	local,
}

// ---------------- RESOLVES ----------------
//TODO clean values
export const enum FileResolveOption {
	LWW = 0,
	DUP = 1,
}
