import { v4 } from "uuid"
import { VectorClock } from "./interfaces"

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

export function increment(clock: VectorClock, uuid: string): VectorClock {
	const i = clock.findIndex(([k]) => k === uuid)
	if (i === -1) clock.push([uuid, 1])
	else clock[i][1] = clock[i][1] + 1
	return clock
}

/**
 * vc1 > vc2 => 1
 *
 * vc1 < vc2 => -1
 *
 * vc1 || vc2 or vc1 = vc2 => 0
 */
export function comp(vc1: VectorClock, vc2: VectorClock): number {
	const all = new Map<string, [number, number]>()
	vc1.forEach(([k, v]) => {
		const vv = all.get(k)
		if (!vv) all.set(k, [v, 0])
		else vv[0] = v
	})
	vc2.forEach(([k, v]) => {
		const vv = all.get(k)
		if (!vv) all.set(k, [0, v])
		else vv[1] = v
	})

	let [gt, lt] = [0, 0]
	all.forEach(([v1, v2]) => {
		if (v1 < v2) gt = 1
		else if (v1 > v2) lt = 1
	})
	return gt - lt
}

export function concurrent(vc1: VectorClock, vc2: VectorClock): boolean {
	return comp(vc1, vc2) === 0
}

export function identical(vc1: VectorClock, vc2: VectorClock) {
	const all = new Map<string, [number, number]>()
	vc1.forEach(([k, v]) => {
		const i = all.get(k)
		if (!i) return all.set(k, [v, 0])
		i[0] = v
	})
	vc2.forEach(([k, v]) => {
		const i = all.get(k)
		if (!i) return all.set(k, [0, v])
		i[1] = v
	})
	for (const [v1, v2] of all.values()) if (v1 !== v2) return false
	return true
}

export function merge(vc1: VectorClock, vc2: VectorClock): VectorClock {
	const all = new Map<string, [number, number]>()
	vc1.forEach(([k, v]) => {
		const i = all.get(k)
		if (!i) return all.set(k, [v, -1])
		i[0] = v
	})
	vc2.forEach(([k, v]) => {
		const i = all.get(k)
		if (!i) return all.set(k, [-1, v])
		i[1] = v
	})
	return [...all.entries()].map(([k, vv]) => [k, Math.max(...vv)])
}
