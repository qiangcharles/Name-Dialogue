import { PluginSettingTab, type SettingDefinitionItem } from "obsidian"
import type { App } from "obsidian"
import type NameDialogue from "./main"
import { DecoratorCustomizationModal } from "./modals/decoratorCustomization/decoratorCustomization"
export { DEFAULT_SETTINGS } from "./settings/settingsData"
export type { NameDialogueSettings } from "./settings/settingsData"

export class NameDialogueSettingsTab extends PluginSettingTab {
	constructor(app: App, private plugin: NameDialogue) { super(app, plugin) }

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [{
			name: "Manage characters",
			desc: "View, add, edit, and reorder characters.",
			action: () => this.plugin.openCharacterList(),
		}, {
			name: "Customize dialogue decorators",
			desc: "Preview and customize dialogue box spacing and styles.",
			action: () => new DecoratorCustomizationModal(
				this.app,
				() => this.plugin.settings.decorators,
				(decorators, edited) => this.plugin.saveDecorators(decorators, edited),
				() => this.plugin.getDecoratorWarnings(),
			).open(),
		}]
	}
}
