import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";


export class DiscardChangesModal extends Modal {
	constructor(app: App, private onDiscard: () => void) { super(app) }
	onOpen(): void {
		this.setTitle("Unsaved changes");
		this.contentEl.createEl("p", { text: "Discard unsaved changes?" });
		const actions = new Setting(this.contentEl)
		actions.addButton((button) =>
			button.setButtonText("Keep editing").onClick(() =>
				this.close()))
		actions.addButton((button) =>
			button.setButtonText("Discard changes").onClick(() => {
				this.close(); this.onDiscard() }))
	}
}
