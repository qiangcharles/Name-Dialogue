import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type NameDialogueSettings } from "./settings";
import { CharacterListModal } from "./modals/characterList/characterListModal";

export default class NameDialogue extends Plugin {
	settings!: NameDialogueSettings;

	async onload(): Promise<void> {
		// Settings loading
		const savedSettings = (await this.loadData()) as Partial<NameDialogueSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(savedSettings ?? {}) };

		// Interface/command implementation
		this.addRibbonIcon("message-square-heart", "Open character list", () => new CharacterListModal(this.app, this.settings.characters).open());
		this.addCommand({ id: "open-character-list", name: "Open character list", callback: () => new CharacterListModal(this.app, this.settings.characters).open() });
	}

	onunload(): void {}
}
