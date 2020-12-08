
// timestamp for log
export function cts(): string {
    return `[${new Date().toLocaleString()}]`;
}

// timestamp for crdt
export function ct(): number {
    return new Date().valueOf()
}