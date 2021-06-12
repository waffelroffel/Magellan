import { SHARE_TYPE } from "./enums"

export default class PermissionManager {
	/* TODO
	private canread = new Map<NID, boolean>()
	private canwrite = new Map<NID, boolean>()

	grant(priv: PERMISSION, nid: NID): void {
		switch (priv) {
			case PERMISSION.READ:
				this.canread.set(nid, true)
				return
			case PERMISSION.WRITE:
				this.canwrite.set(nid, true)
				return
		}
	}

	grantAll(perms: Permissions, nid: NID): void {
		if (perms.read) this.grant(PERMISSION.READ, nid)
		if (perms.write) this.grant(PERMISSION.WRITE, nid)
	}

	revoke(priv: PERMISSION, nid: NID): void {
		switch (priv) {
			case PERMISSION.READ:
				this.canread.delete(nid)
				return
			case PERMISSION.WRITE:
				this.canwrite.delete(nid)
				return
		}
	}

	can(priv: PERMISSION, nid: NID): boolean {
		switch (priv) {
			case PERMISSION.READ:
				return this.canread.has(nid)
			case PERMISSION.WRITE:
				return this.canwrite.has(nid)
		}
	}
	*/

	static defaultPerms(st: SHARE_TYPE): { write: boolean; read: boolean } {
		switch (st) {
			case SHARE_TYPE.All2All:
				return { write: true, read: true }
			case SHARE_TYPE.One2All:
				return { write: false, read: true }
		}
	}
}
