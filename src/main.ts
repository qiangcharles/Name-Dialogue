import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type NameDialogueSettings } from "./settings";
import { CharacterListModal } from "./modals/characterList/characterListModal";
import type { Character } from "./types"

export default class NameDialogue extends Plugin {
	settings!: NameDialogueSettings;

	// Current implementation assumes global storage mode
	// TODO: per-folder and per-document storage mode implementation
	private async saveCharacters(characters: Character[]): Promise<void> {
		const savedCharacters = characters.map((character) =>
			({ ...character, aliases: [...character.aliases] }))
		const updatedSettings = { ...this.settings, characters: savedCharacters }
		await this.saveData(updatedSettings);
		this.settings = updatedSettings;
	}

	async onload(): Promise<void> {
		// Settings loading
		const savedSettings = (await this.loadData()) as Partial<NameDialogueSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(savedSettings ?? {}) };

		// Interface/command implementation
		this.addRibbonIcon("message-square-heart", "Open character list", () =>
			new CharacterListModal(this.app, this.settings.characters, (characters) =>
				this.saveCharacters(characters)).open());
		this.addCommand({ id: "open-character-list", name: "Open character list", callback: () =>
				new CharacterListModal(this.app, this.settings.characters, (characters) =>
					this.saveCharacters(characters)).open() });

	}

	onunload(): void {}
}
