import Ship from "./Ship";
import { FSWatcher, watch as chokidarWatch } from "chokidar"
import { EventEmitter } from "events";

export default class Watcher extends EventEmitter {
	private root: string;
	private watcher: FSWatcher | null;
	private magellan: Ship;

	constructor(magellan: Ship, root: string) {
		super();
		this.magellan = magellan;
		this.root = root;
		this.watcher = null;
	}

	watch(folder?: string): void {
		folder = folder ?? this.root;

		// TODO since the nested file/folder watcher is not used, find other watchers or builtin functions?
		this.watcher = chokidarWatch(folder, {
			persistent: true,
			depth: 0
		});

		this.watcher
			.on("add", (path: string) => {
				this.magellan.emit("add", path);
			})
			.on("change", (path: string) => {
				this.magellan.emit("change", path);
			})
			.on("unlink", (path: string) => {
				this.magellan.emit("remove", path);
			})
			.on("error", (error: any) =>
				this.magellan.emit("error", error)
			)
			.on("ready", () => this.magellan.emit("ready"));
	}
}