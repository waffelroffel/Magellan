// ---------------- CARGOLIST ----------------
export const enum ItemTypes {
	//RootFolder,
	//RootFile,
	Folder,
	File,
}

export const enum TombTypes {
	Moved,
	Renamed,
	Deleted,
}

export const enum ActionTypes {
	Add = "ADD",
	Remove = "REM",
	Move = "MOV",
	Change = "CHG",
	Rename = "RNM",
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
