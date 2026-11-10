import { beforeAll, describe, expect, it, vi } from "vitest"
import { characterListCard } from "../src/modals/characterList/characterListCard"

const controls = vi.hoisted(() => ({ textValues: [] as string[], colourValues: [] as string[] }))

vi.mock("obsidian", () => ({
	TextComponent: class {
		setPlaceholder(): this { return this }
		setValue(value: string): this { controls.textValues.push(value); return this }
		onChange(): this { return this }
	},
	ColorComponent: class {
		setValue(value: string): this { controls.colourValues.push(value); return this }
		onChange(): this { return this }
	},
	ButtonComponent: class {
		setIcon(): this { return this }
		setTooltip(): this { return this }
		setDisabled(): this { return this }
		setDestructive(): this { return this }
		onClick(): this { return this }
	},
}))

beforeAll(() => {
	Object.defineProperty(HTMLElement.prototype, "createDiv", {
		configurable: true,
		value(this: HTMLElement) {
			const element = document.createElement("div")
			this.append(element)
			return element
		},
	})
})

describe("invalid stored character colour", () => {
	it("invalid colour: [not-hex] -> [original text and safe picker colour]", () => {
		controls.textValues.length = 0
		controls.colourValues.length = 0
		characterListCard(
			document.createElement("div"), 0,
			{ id: 1, name: "Alice", aliases: [], colour: "not-hex" },
			1, () => {}, () => {}, () => {},
		)
		expect(controls.textValues).toContain("not-hex")
		expect(controls.colourValues).toEqual(["#676767"])
	})
})
