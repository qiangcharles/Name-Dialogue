import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";
import type { Character } from "../../types";
import { CharacterListEditor } from "./characterListEditor";
import { DiscardChangesModal } from "./discardChangesModal";
import { validateCharacter } from "../../characters";

export class CharacterListModal extends Modal {
	constructor(
		app: App,
		private characters: Character[],
		private onSave: (characters: Character[]) => Promise<void>
	) {
		super(app);
		this.characters = characters.map((character) =>
			({...character, aliases: [...character.aliases]})); // Draft modal; separate alias array
		this.previousCharacters = JSON.stringify(this.characters)
	}

	// Edit check for save/close checks
	private previousCharacters = ""
	private discardConfirmed = false
	private hasUnsavedChanges(): boolean {
		return JSON.stringify(this.characters) !== this.previousCharacters
	}

	private async saveCharacters(): Promise<void> {
		if (this.characters.some((character) =>
			!character.name.trim())) {
			new Notice("Character name cannot be blank or spaces."); return
		}
		const validationError = validateCharacter(this.characters);
		if (validationError) {
			new Notice(validationError);
			return;
		} try {
			await this.onSave(this.characters)
			this.previousCharacters = JSON.stringify(this.characters)
		} catch (error) {
			new Notice(error instanceof Error ? error.message : "Unable to save characters.");
			console.error("[name-dialogue]", error);
			return;
		}
	}

	override close(): void {
		if (this.hasUnsavedChanges() && !this.discardConfirmed) {
			new DiscardChangesModal(this.app, () => {
				this.discardConfirmed = true; this.close()}).open(); return } super.close()
	}

	onOpen(): void {
		this.modalEl.classList.add("character-list-modal");
		this.setTitle("Characters");
		new CharacterListEditor(this.characters).render(this.contentEl.createDiv())
		const actions = new Setting(this.contentEl);

		actions.addButton((button) =>
			button.setButtonText("Close").onClick(() =>
				this.close()))

		actions.addButton((button) =>
			button.setButtonText("Save").onClick(() =>
				void this.saveCharacters()))
	}
}
