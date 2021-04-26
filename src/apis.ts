import { VesselAPIs } from "./interfaces"

const APIS: VesselAPIs = {
	cmd: {
		end: "/",
		method: "GET",
	},
	senditemmeta: {
		end: "/item/meta",
		method: "POST",
		headers: { "Content-Type": "application/json" },
	},
	senditemdata: {
		end: "/item/data/",
		method: "POST",
		headers: { "content-type": "app/binary" },
	},
	getitem: {
		end: "/item",
		method: "POST",
		headers: { "Content-Type": "application/json" },
	},
	getindex: {
		end: "/index",
		method: "GET",
	},
	getinvite: {
		end: "/invite",
		method: "POST",
		headers: { "Content-Type": "application/json" },
	},
	addpeer: {
		end: "/addpeer",
		method: "POST",
		headers: { "Content-Type": "application/json" },
	},
	reqPerm: {
		end: "/reqpermission",
		method: "POST",
		headers: { "Content-Type": "application/json" },
	},
	grantPerm: {
		end: "/grantpermission",
		method: "POST",
		headers: { "Content-Type": "application/json" },
	},
	checkIndexVer: {
		end: "/checkindex",
		method: "POST",
		headers: { "Content-Type": "application/json" },
	},
}

export default APIS
