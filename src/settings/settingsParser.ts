import { DEFAULT_CHARACTER_COLOUR, validateHexColour } from "../characters"
import { DEFAULT_DECORATORS, type DecoratorBoxSettings, type DecoratorSettings } from "../decorators"
import type { Character } from "../types"
import { DEFAULT_SETTINGS, SETTINGS_SCHEMA_VERSION, type NameDialogueSettings } from "./settingsData"
import { isBackupName } from "./settingsBackup"

type RecordValue = Record<string, unknown>

export interface ParsedSettings {
	settings: NameDialogueSettings
	characterDrafts: Character[]
	charactersEditable: boolean
	warnings: string[]
}

export function isSettingsRecord(value: unknown): value is RecordValue {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function property<T>(
	record: RecordValue,
	key: string,
	isValid: (value: unknown) => value is T,
	fallback: T,
	warnings: string[],
	path: string,
): T {
	if (!Object.prototype.hasOwnProperty.call(record, key)) return fallback
	const value = record[key]
	if (isValid(value)) return value
	warnings.push(path)
	return fallback
}

function isString(value: unknown): value is string { return typeof value === "string" }
function isNumber(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) }
function isAliases(value: unknown): value is string[] {
	return Array.isArray(value) && value.every(isString)
}

function isPattern(value: unknown): value is string {
	if (!isString(value)) return false
	try {
		new RegExp(value)
		return true
	} catch {
		return false
	}
}

function isVersion(value: unknown): value is number {
	return isNumber(value) && Number.isSafeInteger(value) && value >= 0
}

function parseBox(value: unknown,
				  fallback: DecoratorBoxSettings,
				  warnings: string[],
				  path: string): DecoratorBoxSettings {
	if (value === undefined) return { ...fallback }
	if (!isSettingsRecord(value)) {
		warnings.push(path)
		return { ...fallback }
	}
	const bounded = (minimum: number, maximum: number) =>
		(candidate: unknown): candidate is number =>
			isNumber(candidate) && candidate >= minimum && candidate <= maximum
	return {
		borderThickness: property(
			value, "borderThickness", bounded(0, 8), fallback.borderThickness, warnings, `${path}.borderThickness`,
		),
		fillOpacity: property(
			value, "fillOpacity", bounded(0, 100), fallback.fillOpacity, warnings, `${path}.fillOpacity`,
		),
		cornerRadius: property(
			value, "cornerRadius", bounded(0, 48), fallback.cornerRadius, warnings, `${path}.cornerRadius`,
		),
	}
}

function parseDecorators(value: unknown, warnings: string[]): DecoratorSettings {
	if (value === undefined) return {
		...DEFAULT_DECORATORS,
		default: { ...DEFAULT_DECORATORS.default },
		thought: { ...DEFAULT_DECORATORS.thought },
	}
	if (!isSettingsRecord(value)) {
		warnings.push("decorators")
		return parseDecorators(undefined, warnings)
	}
	if (value.default === null) warnings.push("decorators.default")
	return {
		verticalGap: property(value, "verticalGap",
			(candidate): candidate is number => isNumber(candidate) && candidate >= 0 && candidate <= 4,
			DEFAULT_DECORATORS.verticalGap, warnings, "decorators.verticalGap"),
		default: parseBox(value.default ?? value.speech, DEFAULT_DECORATORS.default, warnings, "decorators.default"),
		thought: parseBox(value.thought, DEFAULT_DECORATORS.thought, warnings, "decorators.thought"),
	}
}

export function parseSettings(value: unknown): ParsedSettings {
	if (!isSettingsRecord(value)) throw new Error("Invalid plugin settings data.")
	const warnings: string[] = []
	const version = property(value, "schemaVersion", isVersion, SETTINGS_SCHEMA_VERSION, warnings, "schemaVersion")
	if (version > SETTINGS_SCHEMA_VERSION) warnings.push("schemaVersion")
	const characters: Character[] = []
	const characterDrafts: Character[] = []
	let charactersEditable = true
	const ids = new Set<number>()
	const source = value.characters
	if (value.decorators === null) warnings.push("decorators")
	if (value.lastMigrationBackup !== undefined
		&& (typeof value.lastMigrationBackup !== "string" || !isBackupName(value.lastMigrationBackup))) {
		warnings.push("lastMigrationBackup")
	}
	if (source !== undefined && !Array.isArray(source)) {
		warnings.push("characters")
		charactersEditable = false
	}
	if (Array.isArray(source)) {
		for (const [index, item] of source.entries()) {
			if (!isSettingsRecord(item)) {
				warnings.push(`characters.${index}`)
				charactersEditable = false
				continue
			}
			const id = property(item, "id", isNumber, -(index + 1), warnings, `characters.${index}.id`)
			if (!isNumber(item.id) || ids.has(id)) {
				charactersEditable = false
				if (item.id === undefined || ids.has(id)) warnings.push(`characters.${index}.id`)
			}
			ids.add(id)
			const name = property(item, "name", isString, "", warnings, `characters.${index}.name`)
			const aliases = property(item, "aliases", isAliases, [], warnings, `characters.${index}.aliases`)
			const colour = property(item, "colour", isString, DEFAULT_CHARACTER_COLOUR, warnings, `characters.${index}.colour`)
			if ((item.name !== undefined && !isString(item.name))
				|| (item.aliases !== undefined && !isAliases(item.aliases))
				|| (item.colour !== undefined && !isString(item.colour))) charactersEditable = false
			if (!validateHexColour(colour)) warnings.push(`characters.${index}.colour`)
			characterDrafts.push({ id, name, aliases: [...aliases], colour })
			characters.push({
				id, name, aliases: [...aliases],
				colour: validateHexColour(colour) ? colour : DEFAULT_CHARACTER_COLOUR,
			})
		}
	}
	return {
		settings: {
			schemaVersion: version,
			...(typeof value.lastMigrationBackup === "string" && isBackupName(value.lastMigrationBackup)
				? { lastMigrationBackup: value.lastMigrationBackup }
				: {}),
			namespaceRegex: property(
				value, "namespaceRegex", isPattern, DEFAULT_SETTINGS.namespaceRegex, warnings, "namespaceRegex",
			),
			characters,
			decorators: parseDecorators(value.decorators ?? value.dialogueStyles, warnings),
		},
		characterDrafts,
		charactersEditable,
		warnings,
	}
}
