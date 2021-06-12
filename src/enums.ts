// ---------------- Vessel ----------------
export const enum SHARE_TYPE {
	All2All = "A2A", // all peers have equal permissions
	One2All = "12A", // one amdin
}

// ---------------- CARGOLIST ----------------
export const enum ItemType {
	Dir = "D",
	File = "F",
}

export const enum TombType {
	Moved = "M",
	// Renamed = "R", // TODO: merge Moved and Renamed
	Deleted = "D",
}

export const enum ActionType {
	Add = "A",
	Remove = "R",
	Change = "C",
	MovedFrom = "F",
	MovedTo = "T",
}

const ACTION_TYPES = [
	ActionType.Add,
	ActionType.Remove,
	ActionType.Change,
	ActionType.MovedFrom,
	ActionType.MovedTo,
]

export const isValidActionType = (at: ActionType): boolean => {
	return ACTION_TYPES.includes(at)
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
