import type { DataAdapter } from "obsidian"
import { normalizeDecorators } from "../decorators"
import { DEFAULT_SETTINGS, SETTINGS_SCHEMA_VERSION, type NameDialogueSettings } from "./settingsData"
import { createBackup, deletePreviousBackup, equalBytes, isBackupName } from "./settingsBackup"
import type { MigrationModal } from "../modals/migration/migrationPrompts"
import type { Character } from "../types"
import { parseSettings } from "./settingsParser"

type SettingsAdapter = Pick<DataAdapter, "exists" | "readBinary" | "copy" | "remove" | "process">

export interface SettingsStorage {
	adapter: SettingsAdapter
	directory: string
	loadData: () => Promise<unknown>
	prompts: MigrationModal
	isActive?: () => boolean
	onUnmigratedSnapshot?: (snapshot: ArrayBuffer) => void
	onLoadedData?: (data: Record<string, unknown>, exists: boolean, warnings: string[]) => void
	incompatibleSchemas?: ReadonlySet<number>
	now?: () => Date
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getRecord(value: unknown, name: string): Record<string, unknown> {
	if (!isRecord(value)) throw new Error(`Invalid ${name} in plugin settings.`)
	return value
}

function validateCharacters(value: unknown): asserts value is Character[] {
	if (!Array.isArray(value) || value.some((character: unknown) =>
		!isRecord(character)
		|| typeof character.id !== "number"
		|| !Number.isFinite(character.id)
		|| typeof character.name !== "string"
		|| !Array.isArray(character.aliases)
		|| character.aliases.some((alias: unknown) => typeof alias !== "string")
		|| typeof character.colour !== "string")) {
		throw new Error("Invalid characters in plugin settings.")
	}
}

function validateDecoratorSettings(value: Record<string, unknown>): void {
	if (value.verticalGap !== undefined
		&& (typeof value.verticalGap !== "number" || !Number.isFinite(value.verticalGap))) {
		throw new Error("Invalid dialogue box spacing in plugin settings.")
	}
	for (const key of ["default", "speech", "thought"] as const) {
		if (value[key] === undefined || value[key] === null) continue
		const box = getRecord(value[key], "dialogue box style")
		for (const field of ["borderThickness", "fillOpacity", "cornerRadius"] as const) {
			if (box[field] !== undefined
				&& (typeof box[field] !== "number" || !Number.isFinite(box[field]))) {
				throw new Error("Invalid dialogue box style in plugin settings.")
			}
		}
	}
}

export function normalizeSettings(value: unknown): NameDialogueSettings {
	const data = getRecord(value, "data")
	if (data.lastMigrationBackup !== undefined
		&& (typeof data.lastMigrationBackup !== "string" || !isBackupName(data.lastMigrationBackup))) {
		throw new Error("Invalid settings backup reference.")
	}
	if (data.namespaceRegex !== undefined) {
		if (typeof data.namespaceRegex !== "string") {
			throw new Error("Invalid namespace pattern in plugin settings.")
		}
		try {
			new RegExp(data.namespaceRegex)
		} catch {
			throw new Error("Invalid namespace pattern in plugin settings.")
		}
	}
	if (data.characters !== undefined) validateCharacters(data.characters)

	const source = data.decorators ?? data.dialogueStyles
	const decorators = source === undefined || source === null
		? {}
		: getRecord(source, "decorators")
	validateDecoratorSettings(decorators)
	const normalized = normalizeDecorators(decorators)
	const defaultBox = decorators.default ?? decorators.speech
	const thoughtBox = decorators.thought

	return {
		...DEFAULT_SETTINGS,
		...data,
		schemaVersion: SETTINGS_SCHEMA_VERSION,
		...(typeof data.lastMigrationBackup === "string"
			? { lastMigrationBackup: data.lastMigrationBackup }
			: {}),
		namespaceRegex: typeof data.namespaceRegex === "string"
			? data.namespaceRegex
			: DEFAULT_SETTINGS.namespaceRegex,
		characters: data.characters === undefined
			? DEFAULT_SETTINGS.characters
			: data.characters,
		decorators: {
			...decorators,
			...normalized,
			default: { ...(isRecord(defaultBox) ? defaultBox : {}), ...normalized.default },
			thought: { ...(isRecord(thoughtBox) ? thoughtBox : {}), ...normalized.thought },
		},
	}
}

function getSchemaVersion(data: Record<string, unknown>): number | null {
	if (!Object.prototype.hasOwnProperty.call(data, "schemaVersion")) return 0
	if (typeof data.schemaVersion !== "number"
		|| !Number.isSafeInteger(data.schemaVersion)
		|| data.schemaVersion < 0) {
		return null
	}
	return data.schemaVersion
}

const incompatibleSchemas = new Set<number>()

function parseSnapshot(snapshot: ArrayBuffer): Record<string, unknown> {
	try {
		const text = new TextDecoder("utf-8", { fatal: true }).decode(snapshot)
		return getRecord(JSON.parse(text), "data")
	} catch {
		throw new Error("Unable to read valid plugin settings from data.json.")
	}
}

function migrateSettings(data: Record<string, unknown>, version: number): NameDialogueSettings {
	let current = data
	while (version < SETTINGS_SCHEMA_VERSION) {
		switch (version) {
			case 0:
				current = { ...normalizeSettings(current), schemaVersion: 1 }
				version = 1
				break
			default:
				throw new Error(`No settings migration exists for schema version ${version}.`)
		}
	}
	return normalizeSettings(current)
}

class SettingsMigrationError extends Error {
	constructor(
		message: string,
		readonly underlyingError: unknown,
	) {
		super(message)
	}
}

class SettingsChangedError extends Error {}

async function loadData(storage: SettingsStorage): Promise<unknown> {
	try {
		return await storage.loadData()
	} catch (error) {
		throw new SettingsMigrationError("Unable to read plugin settings.", error)
	}
}

export async function loadVersionedSettings(storage: SettingsStorage): Promise<NameDialogueSettings | null> {
	const dataPath = `${storage.directory}/data.json`
	if (!(await storage.adapter.exists(dataPath))) {
		const loaded = await loadData(storage)
		if (loaded !== null || await storage.adapter.exists(dataPath)) {
			throw new Error("Plugin settings changed while loading. Try again.")
		}
		const parsed = parseSettings({})
		storage.onLoadedData?.({}, false, parsed.warnings)
		return parsed.settings
	}

	const snapshot = await storage.adapter.readBinary(dataPath)
	const savedData = parseSnapshot(snapshot)
	const loaded = await loadData(storage)
	if (JSON.stringify(loaded) !== JSON.stringify(savedData)) {
		throw new Error("Plugin settings changed while loading. Try again.")
	}
	const version = getSchemaVersion(savedData)
	if (version === null || !(storage.incompatibleSchemas ?? incompatibleSchemas).has(version)) {
		const parsed = parseSettings(savedData)
		storage.onLoadedData?.(savedData, true, parsed.warnings)
		return parsed.settings
	}

	if (version === 0 && Object.prototype.hasOwnProperty.call(savedData, "lastMigrationBackup")) {
		throw new Error("Legacy settings contain a reserved backup reference; migration was stopped.")
	}
	const migrated = migrateSettings(savedData, version)
	if (!(await storage.prompts.confirmMigration())) {
		if (!(await storage.prompts.warnOutdated())) return null
		if (!equalBytes(snapshot, await storage.adapter.readBinary(dataPath))) {
			throw new Error("Plugin settings changed while awaiting confirmation. Try again.")
		}
		storage.onUnmigratedSnapshot?.(snapshot)
		const parsed = parseSettings(savedData)
		storage.onLoadedData?.(savedData, true, parsed.warnings)
		return parsed.settings
	}
	if (storage.isActive && !storage.isActive()) return null
	if (!(await storage.prompts.saveBackup(snapshot))) return null
	if (storage.isActive && !storage.isActive()) return null
	const previousBackup = typeof savedData.lastMigrationBackup === "string"
		? savedData.lastMigrationBackup
		: undefined
	const backupPath = await createBackup(
		storage.adapter, storage.directory, dataPath, snapshot, (storage.now ?? (() => new Date()))(),
	)
	const settings = {
		...migrated,
		lastMigrationBackup: backupPath.slice(storage.directory.length + 1),
	}
	const originalText = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(snapshot)
	try {
		await storage.adapter.process(dataPath, (current) => {
			if (storage.isActive && !storage.isActive()) throw new Error("Plugin was unloaded.")
			if (current !== originalText) throw new SettingsChangedError("Plugin settings changed before migration.")
			return JSON.stringify(settings, null, "\t")
		})
	} catch (error) {
		throw new SettingsMigrationError(
			error instanceof SettingsChangedError
				? `Plugin settings changed before migration. Backup: ${backupPath}`
				: `Settings migration failed; check data.json before retrying. Backup: ${backupPath}`,
			error,
		)
	}
	let saved: Record<string, unknown>
	try {
		saved = parseSnapshot(await storage.adapter.readBinary(dataPath))
	} catch (error) {
		throw new SettingsMigrationError(
			`Updated settings could not be verified. Backup: ${backupPath}`,
			error,
		)
	}
	if (JSON.stringify(saved) !== JSON.stringify(settings)) {
		throw new Error(`Updated settings changed or could not be verified. Backup: ${backupPath}`)
	}
	try {
		await deletePreviousBackup(
			storage.adapter, storage.directory, previousBackup, backupPath, snapshot,
			(name) => storage.prompts.confirmDeleteBackup(name),
		)
	} catch {
		storage.prompts.reportCleanupFailure()
	}
	const parsed = parseSettings(saved)
	storage.onLoadedData?.(saved, true, parsed.warnings)
	return parsed.settings
}
