import { VesselOptions } from "../src/interfaces"

export const TESTROOT = "testroot"

export const TEST_VESSEL_OPTS: VesselOptions = {
	loggerconf: {
		init: false,
		ready: false,
		update: false,
		send: false,
		local: false,
		remote: false,
		error: false,
		online: false,
		vanish: false,
	},
}
