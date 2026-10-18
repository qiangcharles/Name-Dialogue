import type { Character } from "../../types";
import { characterListCard } from "./characterListCard";

export class CharacterListEditor {
	constructor(private characters: Character[]) {}

	private nextCharacterId(): number { return Math.max(0, ...this.characters.map(({ id }) => id)) + 1 }
	render(container: HTMLElement): void {

		const addButton = container.createEl("button", { text: "Add character" })
		addButton.addEventListener("click", () => {
			this.characters.push({
				id: this.nextCharacterId(),
				name: "",
				aliases: [],
				colour: "#676767"
			});
			container.empty();
			this.render(container);
		})

		// Empty list handling
		if (this.characters.length === 0) {
			container.createEl("p", { text: "No characters exist yet." });
			return;
		}

		// Reads list of characters if empty list handler doesn't return, iterates through each chara and builds the card
		for (const character of this.characters) {
			characterListCard(container, character, () => {
				this.characters.splice(this.characters.indexOf(character), 1);
				container.empty(); this.render(container)
			})
		}
	}
}
