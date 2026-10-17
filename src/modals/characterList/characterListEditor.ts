import type { Character } from "../../types";

export class CharacterListEditor {
	constructor(private characters: Character[]) {}
	render(container: HTMLElement): void {
		// Empty list handling
		if (this.characters.length === 0) {
			container.createEl("p", { text: "No characters exist yet." });
			return;
		}

		// Reads list of characters if empty list handler doesn't return
		for (const character of this.characters)
			container.createEl("p", { text: character.name });
	}
}
