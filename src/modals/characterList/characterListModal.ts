import { Modal, Notice, Setting } from "obsidian";
import type { App, ButtonComponent } from "obsidian";
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

	private previousCharacters = ""
	private discardConfirmed = false
	private saveButton: ButtonComponent | null = null
	private hasUnsavedChanges(): boolean {
		const hasChanges = JSON.stringify(this.characters) !== this.previousCharacters
		if (hasChanges) {
			this.saveButton?.setCta()
		} else {
			this.saveButton?.removeCta()
		}
		return hasChanges
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
			this.hasUnsavedChanges()
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
		new CharacterListEditor(this.characters, () => {
			this.hasUnsavedChanges()
		})
			.render(this.contentEl.createDiv())
		const actions = new Setting(this.contentEl);

		actions.addButton((button) =>
			button.setButtonText("Close").onClick(() =>
				this.close()))

		actions.addButton((button) => {
			this.saveButton = button
			button.setButtonText("Save").onClick(() =>
				void this.saveCharacters())
		})
	}
}
