import { v4 as uuid4 } from "uuid"

export abstract class ABCVessel {
	id = uuid4()

	equals(other: ABCVessel): boolean {
		return this.id === other.id
	}
}
