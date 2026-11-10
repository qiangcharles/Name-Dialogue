import { Modal, Notice, Setting } from "obsidian"
import type { App, ButtonComponent } from "obsidian"

export interface MigrationModal {
	confirmMigration(): Promise<boolean>
	warnOutdated(): Promise<boolean>
	saveBackup(snapshot: ArrayBuffer): Promise<boolean>
	confirmDeleteBackup(name: string): Promise<boolean>
	reportCleanupFailure(): void
}

class ChoiceModal extends Modal {
	private resolve!: (value: boolean) => void
	private settled = false

	constructor(
		app: App,
		private render: (modal: ChoiceModal) => void,
	) {
		super(app)
	}

	ask(): Promise<boolean> {
		return new Promise((resolve) => {
			this.resolve = resolve
			this.open()
		})
	}

	answer(value: boolean): void {
		if (this.settled) return
		this.settled = true
		this.resolve(value)
		this.close()
	}

	onOpen(): void {
		this.render(this)
	}

	onClose(): void {
		if (!this.settled) {
			this.settled = true
			this.resolve(false)
		}
		this.contentEl.empty()
	}

	get isSettled(): boolean {
		return this.settled
	}
}

export class MigrationPrompts implements MigrationModal {
	private activeModal: ChoiceModal | undefined
	private disposed = false

	constructor(private app: App) {}

	dispose(): void {
		this.disposed = true
		this.activeModal?.close()
	}

	private async ask(render: (modal: ChoiceModal) => void): Promise<boolean> {
		if (this.disposed) return false
		const modal = new ChoiceModal(this.app, render)
		this.activeModal = modal
		try {
			return await modal.ask()
		} finally {
			if (this.activeModal === modal) this.activeModal = undefined
		}
	}

	confirmMigration(): Promise<boolean> {
		return this.ask((modal) => {
			modal.setTitle("Update settings")
			modal.contentEl.createEl("p", {
				text: "Your settings use an older format. Would you like to update them?",
			})
			const actions = new Setting(modal.contentEl)
			actions.addButton((button) => button.setButtonText("Not now")
				.onClick(() => modal.answer(false)))
			actions.addButton((button) => button.setButtonText("Update settings").setCta()
				.onClick(() => modal.answer(true)))
		})
	}

	async warnOutdated(): Promise<boolean> {
		if (this.disposed) return false
		const acknowledged = await this.ask((modal) => {
			modal.setTitle("Outdated settings")
			modal.contentEl.createEl("p", {
				text: "The plugin probably won't work correctly with outdated settings.",
			})
			modal.contentEl.createEl("p", {
				text: "Changing characters or decorators can rewrite your settings in the new format without a backup.",
			})
			const link = modal.contentEl.createEl("a", {
				text: "View previous releases",
				href: "https://github.com/qiangcharles/Name-Dialogue/releases",
			})
			link.setAttribute("target", "_blank")
			link.setAttribute("rel", "noopener noreferrer")
			new Setting(modal.contentEl).addButton((button) => button.setButtonText("I understand")
				.setCta().onClick(() => modal.answer(true)))
		})
		const warning = "Don't say I didn't warn you!"
		if (acknowledged && !this.disposed) new Notice(warning, 8000)
		return acknowledged && !this.disposed
	}

	saveBackup(snapshot: ArrayBuffer): Promise<boolean> {
		return this.ask((modal) => {
			modal.setTitle("Save a settings backup")
			modal.contentEl.createEl("p", {
				text: "Save a copy before updating. Clipboard contents are temporary: paste and save them somewhere safe.",
			})
			modal.contentEl.createEl("p", {
				text: "Native file saving is unavailable because a vault-only save dialog is not supported. Use copy to clipboard instead.",
			})
			const status = modal.contentEl.createEl("p")
			const actions = new Setting(modal.contentEl)
			let copyButton: ButtonComponent
			actions.addButton((button) => button.setButtonText("Save file").setDisabled(true))
			actions.addButton((button) => {
				copyButton = button
				button.setButtonText("Copy to clipboard").setCta().onClick(() => {
					copyButton.setDisabled(true)
					status.setText("Copying backup...")
					void (async () => {
						try {
							if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable.")
							const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(snapshot)
							await navigator.clipboard.writeText(text)
							if (!modal.isSettled) {
								new Notice("Backup copied. Paste and save it somewhere safe.", 8000)
								modal.answer(true)
							}
						} catch {
							if (!modal.isSettled) {
								status.setText("Could not copy the backup. Check clipboard permissions and try again.")
								copyButton.setDisabled(false)
							}
						}
					})()
				})
			})
			actions.addButton((button) => button.setButtonText("Cancel").onClick(() => modal.answer(false)))
		})
	}

	confirmDeleteBackup(name: string): Promise<boolean> {
		return this.ask((modal) => {
			modal.setTitle("Delete previous backup?")
			modal.contentEl.createEl("p", {
				text: `The update succeeded and a new backup was saved. Delete the previous backup ${name}?`,
			})
			const actions = new Setting(modal.contentEl)
			actions.addButton((button) => button.setButtonText("Keep backup")
				.onClick(() => modal.answer(false)))
			actions.addButton((button) => button.setButtonText("Delete backup").setDestructive()
				.onClick(() => modal.answer(true)))
		})
	}

	reportCleanupFailure(): void {
		new Notice("Could not confirm removal of the previous settings backup. Check your backups.", 0)
	}
}
