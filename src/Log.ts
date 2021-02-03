import { Item } from "./CargoList"

interface LogId {
	n: number
	user: string
}

interface LogItem {
	id: LogId
	item: Item
}

export default class Log {
	history: LogItem[] = []
	private n = 0

	push(item: Item, user: string): void {
		this.history.push({ id: { n: ++this.n, user }, item })
	}

	interleave(log: LogItem[]): void {
		let i = 0
		let id = log[i].id
		let ii = this.bisearch(id)
		let cond = false
		while (i < log.length) {
			cond = this.comp(this.history[ii].id, log[i].id)
			if (!cond) ii++
			else {
				this.history.splice(ii, 0, log[i])
				i++
			}
		}
		this.n = this.history[this.history.length - 1].id.n
	}

	getAllFrom(id: LogId): LogItem[] {
		return this.history.splice(this.bisearch(id))
	}

	private bisearch(id: LogId): number {
		const arr = this.history

		let start = 0,
			end = arr.length - 1,
			mid = -1

		while (start <= end) {
			mid = Math.floor((start + end) / 2)
			if (arr[mid].id === id) return mid
			if (this.comp(arr[mid].id, id)) start = mid + 1
			else end = mid - 1
		}

		return mid // TODO: consider if not precise match
	}

	private comp(id1: LogId, id2: LogId) {
		return id1.n !== id2.n ? id1.n < id2.n : id1.user < id2.user
	}
}
