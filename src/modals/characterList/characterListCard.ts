import { ButtonComponent, ColorComponent, TextComponent } from "obsidian"
import type { Character } from "../../types";
import { validateHexColour } from "../../characters";

export function characterListCard(container: HTMLElement,
								  index: number,
								  character: Character,
								  characterCount: number,
								  onDelete: () => void,
								  onMove: (direction: -1 | 1) => void): void {

	// Rendering of the characterList card for the editor; adds element by calling card:HTMLDivElement
	const card: HTMLDivElement = container.createDiv({ cls: "character-card" });
	const row = card.createDiv({ cls: "character-card-fields" })

	// Render fields first, then controls
	const nameControls: HTMLDivElement = row.createDiv({ cls: "card-name-field" });
	new TextComponent(nameControls).setPlaceholder("Name")
		.setValue(character.name)
		.onChange((value) => { character.name = value });

	const aliasControls: HTMLDivElement = row.createDiv({ cls: "card-alias-field" });
	new TextComponent(aliasControls).setPlaceholder("Alias 1, alias 2...")
		.setValue(character.aliases.join(", "))
		.onChange((value) => { character.aliases = value
			.split(", ")
			.map((alias) => alias
				.trim()).filter(Boolean) }); // filter(Boolean) handles empty string aliases

	const cardColourControls = row.createDiv({ cls: "character-colour-ctrl" });
	const hexInput = new TextComponent(cardColourControls)
		.setPlaceholder("#676767")
		.setValue(character.colour);
	const picker = new ColorComponent(cardColourControls)
		.setValue(character.colour);
	hexInput.onChange((value) => {
		character.colour = value;
		if (validateHexColour(value)) { picker.setValue(value) }});
	picker.onChange((value) => {
		character.colour = value;
		if (validateHexColour(value)) { hexInput.setValue(value) }});

	const cardControls = row.createDiv({ cls: "character-card-ctrl" });
	new ButtonComponent(cardControls).setIcon("arrow-up").setTooltip("Move up")
		.setDisabled(index === 0)
		.onClick(() => onMove(-1));
	new ButtonComponent(cardControls).setIcon("arrow-down").setTooltip("Move down")
		.setDisabled(index === characterCount - 1)
		.onClick(() => onMove(1));
	new ButtonComponent(cardControls).setIcon("trash").setTooltip("Delete")
		.setDestructive()
		.onClick(onDelete);

}
