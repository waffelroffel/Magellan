import Vessel from "../src/Vessel"

const frank = new Vessel("frank", "testroot")

setTimeout(() => {
	console.log(roughSizeOfObject(frank), "bytes")
}, 5000)

// Turn off script is tsconfig before executing test
// TODO: find size of one Item object and calculate the # to exceed 16 GB
// https://stackoverflow.com/questions/1248302/how-to-get-the-size-of-a-javascript-object
function roughSizeOfObject(object) {
	var objectList = []
	var stack = [object]
	var bytes = 0

	while (stack.length) {
		var value = stack.pop()

		if (typeof value === "boolean") {
			bytes += 4
		} else if (typeof value === "string") {
			bytes += value.length * 2
		} else if (typeof value === "number") {
			bytes += 8
		} else if (typeof value === "object" && objectList.indexOf(value) === -1) {
			objectList.push(value)

			for (var i in value) {
				stack.push(value[i])
			}
		}
	}
	return bytes
}
