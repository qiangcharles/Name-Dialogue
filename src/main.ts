import { Notice, Plugin, normalizePath } from "obsidian"
import {
	NameDialogueSettingsTab,
	type NameDialogueSettings,
} from "./settings"
import type { DecoratorProperty, DecoratorSettings } from "./decorators"
import { CharacterListModal } from "./modals/characterList/characterListModal"
import type { Character } from "./types"
import { createView, refreshDecorations } from "./decoration/decorationView"
import { loadVersionedSettings } from "./settings/settingsMigration"
import { SettingsStore } from "./settings/settingsStore"
import { MigrationPrompts } from "./modals/migration/migrationPrompts"
import { SettingsPersistence } from "./settings/settingsPersistence"
import { SETTINGS_SCHEMA_VERSION } from "./settings/settingsData"

export default class NameDialogue extends Plugin {
	settings!: NameDialogueSettings
	private settingsStore!: SettingsStore
	private settingsPersistence!: SettingsPersistence

	openCharacterList(): void {
		const characters = this.settingsPersistence.getCharacterDrafts()
		let original = JSON.stringify(characters)
		new CharacterListModal(this.app, characters, async (updated) => {
			await this.saveCharacters(updated, original)
			original = JSON.stringify(this.settingsPersistence.getCharacterDrafts())
		}).open()
	}

	private async saveCharacters(characters: Character[], original: string): Promise<void> {
		await this.settingsStore.saveCharacters(characters, () => {
			if (JSON.stringify(this.settingsPersistence.getCharacterDrafts()) !== original) {
				throw new Error("Characters changed since this list was opened. Reopen it before saving.")
			}
		})
	}

	async saveDecorators(decorators: DecoratorSettings, edited?: DecoratorProperty): Promise<void> {
		await this.settingsStore.saveDecorators(decorators, edited)
	}

	getDecoratorWarnings(): string[] {
		return this.settingsPersistence.getDecoratorWarnings()
	}

	async onload(): Promise<void> {
		const prompts = new MigrationPrompts(this.app)
		let active = true
		let raw: Record<string, unknown> = {}
		let hasSettingsFile = false
		this.register(() => {
			active = false
			prompts.dispose()
		})
		try {
			if (!this.manifest.dir) throw new Error("Unable to locate the plugin settings folder.")
			const settings = await loadVersionedSettings({
				adapter: this.app.vault.adapter,
				directory: normalizePath(this.manifest.dir),
				loadData: () => this.loadData(),
				prompts,
				isActive: () => active,
				onLoadedData: (data, exists, warnings) => {
					raw = data
					hasSettingsFile = exists
					if (typeof data.schemaVersion === "number" && data.schemaVersion > SETTINGS_SCHEMA_VERSION) {
						new Notice("These settings are from a newer plugin version and may not be compatible.", 0)
					}
					if (warnings.length > 0) {
						const paths = [...new Set(warnings)].slice(0, 5).join(", ")
						new Notice(`Settings need attention (${paths}). Defaults may be used; check settings before editing.`, 0)
					}
				},
			})
			if (!active) return
			if (!settings) {
				new Notice("Settings were not updated; plugin features are inactive.", 0)
				return
			}
			this.settings = settings
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unable to load plugin settings."
			new Notice(`Name Dialogue: ${message}`, 0)
			console.error("[name-dialogue] Unable to load plugin settings.", message)
			throw new Error(message)
		}
		if (!this.manifest.dir) throw new Error("Unable to locate the plugin settings folder.")
		this.settingsPersistence = new SettingsPersistence(
			this.app.vault.adapter,
			normalizePath(`${this.manifest.dir}/data.json`),
			raw,
			hasSettingsFile,
			(data) => this.saveData(data),
		)
		this.settingsStore = new SettingsStore(
			this.settings,
			(settings, section, edited) => this.settingsPersistence.save(settings, section, edited),
			(settings) => {
				this.settings = settings
				refreshDecorations()
			},
		)
		this.addSettingTab(new NameDialogueSettingsTab(this.app, this))
		this.registerEditorExtension(
			createView(() => this.settings),
		)

		// Interface/command implementation
		this.addRibbonIcon("message-square-heart", "Open character list", () =>
			this.openCharacterList())
		this.addCommand({ id: "open-character-list", name: "Open character list", callback: () =>
				this.openCharacterList() })
	}

	onunload(): void {}
}
