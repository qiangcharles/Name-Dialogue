import { Notice, Plugin } from "obsidian";
import {
	DEFAULT_SETTINGS,
	NameDialogueSettingsTab,
	normalizeDecorators,
	type DecoratorSettings,
	type NameDialogueSettings,
} from "./settings";
import { CharacterListModal } from "./modals/characterList/characterListModal";
import type { Character } from "./types"
import { createView, refreshDialogueDecorations } from "./decoration";

export default class NameDialogue extends Plugin {
	settings!: NameDialogueSettings;
	private settingsSaveQueue: Promise<void> = Promise.resolve();

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

	async saveDecorators(decorators: DecoratorSettings): Promise<void> {
		const updatedSettings = {
			...this.settings,
			decorators: normalizeDecorators(decorators),
		};
		this.settings = updatedSettings;
		refreshDialogueDecorations();

		this.settingsSaveQueue = this.settingsSaveQueue.then(async () => {
			try {
				await this.saveData(updatedSettings);
			} catch (error) {
				new Notice(error instanceof Error ? error.message : "Unable to save dialogue decorators.");
				console.error("[name-dialogue]", error);
			}
		});
		await this.settingsSaveQueue;
	}

	async onload(): Promise<void> {
		// Settings loading
		const savedSettings = (await this.loadData()) as
			(Partial<NameDialogueSettings> & { dialogueStyles?: unknown }) | null;
		const { dialogueStyles: legacyDialogueStyles, ...settingsData } = savedSettings ?? {};
		this.settings = {
			...DEFAULT_SETTINGS,
			...settingsData,
			decorators: normalizeDecorators(settingsData.decorators ?? legacyDialogueStyles),
		};
		this.addSettingTab(new NameDialogueSettingsTab(this.app, this))
		this.registerEditorExtension(
			createView(() => this.settings),
		);

		// Interface/command implementation
		this.addRibbonIcon("message-square-heart", "Open character list", () =>
			this.openCharacterList())
		this.addCommand({ id: "open-character-list", name: "Open character list", callback: () =>
				this.openCharacterList() })
	}

	onunload(): void {}
}
