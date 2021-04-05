export default {
	roots: ["tests"],
	testMatch: ["**/*.test.ts"],
	transform: {
		"^.+\\.ts$": "ts-jest",
	},
}
