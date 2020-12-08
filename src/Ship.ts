import { EventEmitter } from "events";
import { join } from "path";
import { argv } from "process";
import { v4 as uuid4 } from "uuid";
import IndexTable from "./IndexTable";
import DownloadManager from "./Managers/DownloadManager";
import PeerManager from "./Managers/PeerManager";
import UploadManager from "./Managers/UploadManager";
import { ct, cts } from "./utils";
import Watcher from "./Watcher";

export default class Ship extends EventEmitter {
	root = "";
	tableMid = "";
	tableEnd = "indextable.json";
	tablePath = "indextable.json";
	logPathTo = "";
	logEnd = "log.txt";
	logPath = "log.txt";

	userid: string
	watcher: Watcher;
	index: IndexTable

	PM: PeerManager;
	UM: UploadManager;
	DM: DownloadManager;


	constructor(uid: string, root: string, rootpth: string, logpth: string, topic: string) {
		super();

		this.userid = uid

		this.root = root;
		if (rootpth) {
			this.tableMid = rootpth;
			this.tablePath = join(this.tableMid, this.tableEnd);
		} else {
			this.tablePath = join(this.root, this.tableEnd);
		}
		if (logpth) {
			this.logPathTo = logpth;
			this.logPath = join(this.logPathTo, this.logEnd);
		} else {
			this.logPath = join(this.root, this.tableEnd);
		}

		this.index = new IndexTable(root)

		this.watcher = new Watcher(this, root);

		this.setup();

		this.PM = new PeerManager(
			this,
			"test-crdt-sharing-967345",
			12345,
			false
		);

		this.DM = new DownloadManager(this, this.PM);
		this.UM = new UploadManager(this, this.PM);

	}

	private getName(path: string): string {
		return path.split("\\").pop() ?? "" // TODO: add alt logic
	}

	setup(): void {
		this
			.on("add", (path: string) => {
				const name = this.getName(path)
				if (name === this.tableEnd) return
				this.index.addFile(name, this.userid, ct())
				this.index.save()
				this.UM.broadcastFile(name);
			})
			.on("remove", (path: string) => {
				const name = this.getName(path)
				if (name === this.tableEnd) return
				this.index.removeFile(name, this.userid, ct())
				this.index.save()
				this.UM.broadcastFile(name);
			})
			.on("change", (path: string) => {
				const name = this.getName(path)
				if (name === this.tableEnd) return
				this.index.changeFile(name, this.userid, ct())
				this.index.save()
				this.UM.broadcastFile(name);

			})
			.on("error", (error: Error) => console.log(error))
			.on("ready", () => {
				this.log("Ship sailing!");
				this.log(`Watching: ${this.root}`);
				this.log(`Index loc: ${this.tablePath}`);
				//this.log(`Log loc: ${this.logPath}`);
			}).on("log", (...msg: any[]) => {
				//this.log(msg);
			});

		[
			`exit`,
			`SIGINT`,
			`SIGUSR1`,
			`SIGUSR2`,
			`uncaughtException`,
			`SIGTERM`,
		].forEach((eventType) => {
			process.on(eventType, (...args) => {
				this.index.save()
				this.log("Journey ended", eventType, ...args);
				process.exit(1);
			});
		});
	}

	sail(): void {
		this.watcher.watch();
	}

	log(...msg: any[]): void {
		console.log(cts(), ...msg);
	}
}

const root = argv[2] || "root"
const uid = argv[3] || uuid4()
new Ship(uid, root, "", "", "").sail();
