import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, NameDialogueSettingsTab, type NameDialogueSettings } from "./settings";
import { CharacterListModal } from "./modals/characterList/characterListModal";
import type { Character } from "./types"
import { createDialogueExtension } from "./decoration";

export default class NameDialogue extends Plugin {
	settings!: NameDialogueSettings;

	openCharacterList(): void {
		new CharacterListModal(this.app, this.settings.characters, (characters) =>
			this.saveCharacters(characters)).open()
	}

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
		this.addSettingTab(new NameDialogueSettingsTab(this.app, this))
		this.registerEditorExtension(
			createDialogueExtension(() => this.settings),
		);

		// Interface/command implementation
		this.addRibbonIcon("message-square-heart", "Open character list", () =>
			this.openCharacterList())
		this.addCommand({ id: "open-character-list", name: "Open character list", callback: () =>
				this.openCharacterList() })
	}

	onunload(): void {}
}
