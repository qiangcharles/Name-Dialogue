import type { Character } from "../types"
import { DEFAULT_DECORATORS, type DecoratorSettings } from "../decorators"

export const SETTINGS_SCHEMA_VERSION = 1

export interface NameDialogueSettings {
	schemaVersion: number
	lastMigrationBackup?: string
	namespaceRegex: string
	characters: Character[]
	decorators: DecoratorSettings
}

export const DEFAULT_SETTINGS: NameDialogueSettings = {
	schemaVersion: SETTINGS_SCHEMA_VERSION,
	namespaceRegex: String.raw`^(?<name>[^:]+):(?:(?<namespaces>(?:[^:]+:)+))?(?<dialogue>(?:[^:]|::)*)$`,
	characters: [],
	decorators: DEFAULT_DECORATORS,
}
