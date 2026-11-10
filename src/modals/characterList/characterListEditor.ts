import type { Character } from "../../types"
import { ButtonComponent } from "obsidian"
import { characterListCard } from "./characterListCard"
import { DEFAULT_CHARACTER_COLOUR } from "../../characters"

export class CharacterListEditor {
	private usedIds: Set<number>

	constructor(private characters: Character[],
				private onChange: () => void) {
		this.usedIds = new Set(characters.map(({ id }) => id))
	}

	private nextCharacterId(): number {
		let id = 1
		while (this.usedIds.has(id)) id++
		this.usedIds.add(id)
		return id
	}

	render(container: HTMLElement): void {
		const modalHeader = container.createDiv({ cls: "modal-editor-head" })
		new ButtonComponent(modalHeader).setIcon("plus").setTooltip("Add a new character")
			.setDisabled(false)
			.onClick(() => {
				this.characters.push({
					id: this.nextCharacterId(),
					name: "",
					aliases: [],
					colour: DEFAULT_CHARACTER_COLOUR
				})
				this.onChange()
				container.empty()
				this.render(container)
			})

		if (this.characters.length === 0) {
			container.createEl("p", { text: "No characters exist yet." })
			return
		}

		for (const [index, character] of this.characters.entries()) {
			characterListCard(container, index, character, this.characters.length, () => {
				this.characters.splice(index, 1)
				this.onChange()
				container.empty()
				this.render(container)
			}, (direction) => this.moveCharacter(container, index, direction), this.onChange)
		}
	}

	private moveCharacter(container: HTMLElement, index: number, direction: -1 | 1): void {
		const destination = index + direction
		if (destination < 0 || destination >= this.characters.length) return
		this.characters.splice(destination, 0, ...this.characters.splice(index, 1))
		this.onChange()
		container.empty()
		this.render(container)
	}
}
