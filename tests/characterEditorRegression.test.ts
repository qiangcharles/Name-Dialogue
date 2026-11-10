import { beforeAll, describe, expect, it, vi } from "vitest"
import { CharacterListEditor } from "../src/modals/characterList/characterListEditor"

vi.mock("obsidian", () => ({
	ButtonComponent: class {
		private element = document.createElement("button")
		constructor(parent: HTMLElement) { parent.append(this.element) }
		setIcon(icon: string): this { this.element.dataset.icon = icon; return this }
		setTooltip(): this { return this }
		setDisabled(value: boolean): this { this.element.disabled = value; return this }
		onClick(callback: () => void): this { this.element.addEventListener("click", callback); return this }
	},
}))

vi.mock("../src/modals/characterList/characterListCard", () => ({
	characterListCard: (
		container: HTMLElement, _index: number, _character: unknown, _count: number, onDelete: () => void,
	) => {
		const button = document.createElement("button")
		button.dataset.icon = "delete"
		button.addEventListener("click", onDelete)
		container.append(button)
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
	Object.defineProperty(HTMLElement.prototype, "empty", {
		configurable: true, value(this: HTMLElement) { this.replaceChildren() },
	})
	Object.defineProperty(HTMLElement.prototype, "createEl", {
		configurable: true,
		value(this: HTMLElement, tag: string) {
			const element = document.createElement(tag)
			this.append(element)
			return element
		},
	})
})

describe("character identity", () => {
	it("delete and add: [Alice id 1] -> [new character with a different id]", () => {
		const characters = [{ id: 1, name: "Alice", aliases: [], colour: "#123456" }]
		const container = document.createElement("div")
		new CharacterListEditor(characters, () => {}).render(container)
		container.querySelector<HTMLButtonElement>('[data-icon="delete"]')?.click()
		container.querySelector<HTMLButtonElement>('[data-icon="plus"]')?.click()
		expect(characters).toHaveLength(1)
		expect(characters[0]?.id).toBe(2)
	})
})
