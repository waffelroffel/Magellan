export default class SkipList extends Map<string, number> {
	add(k: string, v: number): this {
		return v <= 0 ? this : this.set(k, (this.get(k) ?? 0) + v)
	}
	reduce(k: string): boolean {
		const value = this.get(k) ?? 0
		if (!value) return false
		const newvalue = value - 1
		this.set(k, newvalue)
		if (newvalue === 0) this.delete(k)
		return true
	}
}
