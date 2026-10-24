import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";


export class DiscardChangesModal extends Modal {
	constructor(
		app: App,
		private onDiscard: () => void,
		private onSave: () => Promise<boolean>,
		private onCloseAfterSave: () => void,
	) {
		super(app)
	}

	private async saveAndClose(): Promise<void> {
		if (!(await this.onSave())) return;
		this.close();
		this.onCloseAfterSave();
	}

	onOpen(): void {
		this.setTitle("Unsaved changes");
		this.contentEl.createEl("p", { text: "Save changes before closing?" });
		const actions = new Setting(this.contentEl)
		actions.addButton((button) =>
			button.setButtonText("Keep editing").onClick(() =>
				this.close()))
		actions.addButton((button) =>
			button.setButtonText("Save and close").setCta().onClick(() =>
				void this.saveAndClose()))
		actions.addButton((button) =>
			button.setButtonText("Discard changes").onClick(() => {
				this.close(); this.onDiscard() }))
	}
}
