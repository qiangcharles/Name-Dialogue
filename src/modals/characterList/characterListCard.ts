import { Setting } from "obsidian"
import type { Character } from "../../types";

export function characterListCard(container: HTMLElement, character: Character, onDelete: () => void): void {
	// Rendering of the characterList card for the editor; adds element by calling card:HTMLDivElement
	const card:HTMLDivElement = container.createDiv({ cls: "character-card" });

	// Renders each separate field; name, aliases, and colour
	new Setting(card).setName("Name").addText((text) =>
		text.setValue(character.name).onChange((value) => { character.name = value })) // Update modal draft

	new Setting(card).setName("Aliases").addText((text) =>
		text.setValue(character.aliases.join(", ")).onChange((value) => {
			character.aliases = value.split(",").map((alias) => alias.trim()).filter(Boolean) }))

	new Setting(card).setName("Colour").addColorPicker((picker) =>
		picker.setValue(character.colour).onChange((value) =>
		{ character.colour = value }))

	new Setting(card).addButton((button) =>
		button.setButtonText("Delete").setDestructive().onClick(onDelete))
}
