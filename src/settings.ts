import type { Character } from "./types";
import { PluginSettingTab, type SettingDefinitionItem } from "obsidian";
import type { App } from "obsidian";
import type NameDialogue from "./main";

export interface NameDialogueSettings {
	namespaceRegex: string;
	characters: Character[];
}

export const DEFAULT_SETTINGS: NameDialogueSettings = {
	namespaceRegex: String.raw`^(?<name>[^:]+):(?:(?<namespaces>(?:[^:]+:)+))?(?<dialogue>(?:[^:]|::)*)$`,
	characters: [],
}

export class NameDialogueSettingsTab extends PluginSettingTab {
	constructor(app: App, private plugin: NameDialogue) { super(app, plugin) }
	getSettingDefinitions(): SettingDefinitionItem[] { return [{
		name: "Manage characters",
		desc: "View, add, edit, and reorder characters.",
		action: () => this.plugin.openCharacterList() }]
	}
}
