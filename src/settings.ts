import type { Character } from "./types";
import { PluginSettingTab, type SettingDefinitionItem } from "obsidian";
import type { App } from "obsidian";
import type NameDialogue from "./main";
import { DecoratorCustomizationModal } from "./modals/decoratorCustomization/decoratorCustomization";

export interface DecoratorBoxSettings {
	borderThickness: number;
	fillOpacity: number;
	cornerRadius: number;
}

export interface DecoratorSettings {
	verticalGap: number;
	default: DecoratorBoxSettings;
	thought: DecoratorBoxSettings;
}

export interface NameDialogueSettings {
	namespaceRegex: string;
	characters: Character[];
	decorators: DecoratorSettings;
}

export const DEFAULT_DECORATORS: DecoratorSettings = {
	verticalGap: 1.2,
	default: {
		borderThickness: 1.5,
		fillOpacity: 11,
		cornerRadius: 12,
	},
	thought: {
		borderThickness: 1.5,
		fillOpacity: 9,
		cornerRadius: 18,
	},
};

export const DEFAULT_SETTINGS: NameDialogueSettings = {
	namespaceRegex: String.raw`^(?<name>[^:]+):(?:(?<namespaces>(?:[^:]+:)+))?(?<dialogue>(?:[^:]|::)*)$`,
	characters: [],
	decorators: DEFAULT_DECORATORS,
}

function getRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null
		? value as Record<string, unknown>
		: {};
}

function getBoundedNumber(value: unknown,
						  fallback: number,
						  minimum: number,
						  maximum: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(maximum, Math.max(minimum, value));
}

function normalizeDecoratorBox(value: unknown,
							   defaults: DecoratorBoxSettings): DecoratorBoxSettings {
	const style = getRecord(value);
	return {
		borderThickness: getBoundedNumber(style.borderThickness, defaults.borderThickness, 0, 8),
		fillOpacity: getBoundedNumber(style.fillOpacity, defaults.fillOpacity, 0, 100),
		cornerRadius: getBoundedNumber(style.cornerRadius, defaults.cornerRadius, 0, 48),
	};
}

export function normalizeDecorators(value: unknown): DecoratorSettings {
	const decorators = getRecord(value);
	return {
		verticalGap: getBoundedNumber(decorators.verticalGap, DEFAULT_DECORATORS.verticalGap, 0, 4),
		default: normalizeDecoratorBox(
			decorators.default ?? decorators.speech,
			DEFAULT_DECORATORS.default,
		),
		thought: normalizeDecoratorBox(decorators.thought, DEFAULT_DECORATORS.thought),
	};
}

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
				(decorators) => this.plugin.saveDecorators(decorators),
			).open(),
		}];
	}
}
