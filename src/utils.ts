import { v4 } from "uuid"

export function uuid(): string {
	return v4()
}

/**
 * timestamp for log
 */
export function cts(): string {
	return `[${new Date().toISOString().replace(/T/, " ").replace(/\..+/, "")}]`
}

/**
 * timestamp for lastmodified field
 */
export function ct(): number {
	return new Date().valueOf()
}

export function deepcopy<T>(json: T): T {
	return JSON.parse(JSON.stringify(json))
}

export function randint(min: number, max: number): number {
	min = Math.floor(min)
	max = Math.floor(max)
	return min + Math.floor(Math.random() * (max - min))
}
