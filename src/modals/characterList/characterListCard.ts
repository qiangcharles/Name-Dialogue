import { Setting } from "obsidian"
import type { Character } from "../../types";

export function characterListCard(container: HTMLElement,
								  index: number,
								  character: Character,
								  characterCount: number,
								  onDelete: () => void,
								  onMove: (direction: -1 | 1) => void): void {

	// TODO: try to find out how to make the interface more compact using built-in elements, otherwise offload rendering to CSS styles for ideal UX
	// Rendering of the characterList card for the editor; adds element by calling card:HTMLDivElement
	const card:HTMLDivElement = container.createDiv({ cls: "character-card" });
	const controls = new Setting(card)

	// Renders each separate field; name, aliases, and colour
	new Setting(card).setName("Name").addText((text) =>
		text.setValue(character.name).onChange((value) => { character.name = value })) // Update modal draft

	new Setting(card).setName("Aliases").addText((text) =>
		text.setValue(character.aliases.join(", ")).onChange((value) => {
			character.aliases = value.split(",").map((alias) => alias.trim()).filter(Boolean) }))

	new Setting(card).setName("Colour").addColorPicker((picker) =>
		picker.setValue(character.colour).onChange((value) =>
		{ character.colour = value }))

	controls.addButton((button) =>
		button.setIcon("trash").setTooltip("Delete")
			.setDestructive()
			.onClick(onDelete))

	controls.addButton((button) =>
		button.setIcon("arrow-up").setTooltip("Move up")
			.setDisabled(index === 0)
			.onClick(() => onMove(-1)))

	controls.addButton((button) =>
		button.setIcon("arrow-down").setTooltip("Move down")
			.setDisabled(index === characterCount - 1)
			.onClick(() => onMove(1)))

}
