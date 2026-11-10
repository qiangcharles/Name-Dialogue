import type { DataAdapter } from "obsidian"
import type { DecoratorProperty, DecoratorSettings } from "../decorators"
import type { Character } from "../types"
import { validateCharacters } from "../characters"
import type { NameDialogueSettings } from "./settingsData"
import { isSettingsRecord, parseSettings } from "./settingsParser"

type SettingsRecord = Record<string, unknown>
export type SettingsSection = "characters" | "decorators"

function sameSerializedValue(first: unknown, second: unknown): boolean {
	return JSON.stringify(first) === JSON.stringify(second)
}

function updateCharacters(raw: SettingsRecord, characters: Character[]): void {
	if (characters.some((character) => !character.name.trim())) throw new Error("Character name cannot be blank.")
	const validation = validateCharacters(characters)
	if (validation) throw new Error(validation)
	if (characters.some((character) => !Number.isFinite(character.id))
		|| new Set(characters.map((character) => character.id)).size !== characters.length) {
		throw new Error("Character identifiers must be valid and unique.")
	}
	const parsed = parseSettings(raw)
	if (!parsed.charactersEditable) {
		throw new Error("Some stored character properties cannot be edited safely. Correct data.json before saving.")
	}
	const originals: unknown[] = Array.isArray(raw.characters) ? raw.characters : []
	raw.characters = characters.map((character) => {
		const previous = originals.find((item: unknown) =>
			isSettingsRecord(item) && item.id === character.id)
		const draft = parsed.characterDrafts.find((item) => item.id === character.id)
		if (!isSettingsRecord(previous) || !draft) return { ...character, aliases: [...character.aliases] }
		const updated = { ...previous }
		for (const key of ["name", "aliases", "colour"] as const) {
			if (!sameSerializedValue(character[key], draft[key])) updated[key] = character[key]
		}
		return updated
	})
}

function writableRecord(parent: SettingsRecord, key: string): SettingsRecord {
	const value = parent[key]
	if (value === undefined || value === null) {
		const created: SettingsRecord = {}
		parent[key] = created
		return created
	}
	if (!isSettingsRecord(value)) {
		throw new Error("Some stored decorator properties cannot be edited safely. Correct data.json before saving.")
	}
	return value
}

function updateDecorators(raw: SettingsRecord, decorators: DecoratorSettings, edited?: DecoratorProperty): void {
	const previous = parseSettings(raw).settings.decorators
	const key = raw.decorators === undefined || raw.decorators === null
		? raw.dialogueStyles === undefined || raw.dialogueStyles === null ? "decorators" : "dialogueStyles"
		: "decorators"
	const source = writableRecord(raw, key)
	if (edited === "verticalGap" || decorators.verticalGap !== previous.verticalGap) {
		source.verticalGap = decorators.verticalGap
	}
	for (const name of ["default", "thought"] as const) {
		const keys = ["borderThickness", "fillOpacity", "cornerRadius"] as const
		const changed = keys.filter((property) =>
			edited === `${name}.${property}` || decorators[name][property] !== previous[name][property])
		if (changed.length === 0) continue
		const boxKey = name === "default" && (source.default === undefined || source.default === null)
			&& source.speech !== undefined && source.speech !== null ? "speech" : name
		const box = writableRecord(source, boxKey)
		for (const property of changed) box[property] = decorators[name][property]
	}
}

export class SettingsPersistence {
	private raw: SettingsRecord
	private exists: boolean

	constructor(
		private adapter: Pick<DataAdapter, "exists" | "process">,
		private path: string,
		raw: SettingsRecord,
		exists: boolean,
		private saveNew: (data: SettingsRecord) => Promise<void>,
	) {
		this.raw = raw
		this.exists = exists
	}

	getCharacterDrafts(): Character[] {
		return parseSettings(this.raw).characterDrafts
	}

	getDecoratorWarnings(): string[] {
		const warnings = [...new Set(parseSettings(this.raw).warnings.filter((path) => path.startsWith("decorators")))]
		return warnings.map((path) => {
			const parts = path.split(".")
			let value: unknown = this.raw.decorators ?? this.raw.dialogueStyles
			if (parts.length === 1 && this.raw.decorators === null) value = null
			for (const part of parts.slice(1)) {
				if (!isSettingsRecord(value)) break
				value = part === "default" && (value.default === undefined
					|| (value.default === null && parts.length > 2))
					? value.speech
					: value[part]
			}
			const shown = value === null || typeof value === "string" || typeof value === "number"
				|| typeof value === "boolean" ? JSON.stringify(value) : "invalid structure"
			return `${path}: ${shown?.slice(0, 80) ?? "invalid value"}`
		})
	}

	async save(settings: NameDialogueSettings,
			   section: SettingsSection,
			   edited?: DecoratorProperty): Promise<void> {
		const update = (original: SettingsRecord): SettingsRecord => {
			const result: unknown = JSON.parse(JSON.stringify(original))
			if (!isSettingsRecord(result)) throw new Error("Unable to copy plugin settings.")
			if (section === "characters") updateCharacters(result, settings.characters)
			else updateDecorators(result, settings.decorators, edited)
			return result
		}
		if (!this.exists) {
			if (await this.adapter.exists(this.path)) throw new Error("Settings changed since loading. Reload the plugin.")
			const updated = update({ ...this.raw, schemaVersion: settings.schemaVersion })
			await this.saveNew(updated)
			this.raw = updated
			this.exists = true
			return
		}
		let updated: SettingsRecord | undefined
		await this.adapter.process(this.path, (current) => {
			let value: unknown
			try {
				value = JSON.parse(current.charCodeAt(0) === 0xfeff ? current.slice(1) : current)
			} catch {
				throw new Error("Settings could not be read. Reload the plugin.")
			}
			if (!isSettingsRecord(value) || !sameSerializedValue(value, this.raw)) {
				throw new Error("Settings changed since loading. Reload the plugin.")
			}
			updated = update(value)
			return JSON.stringify(updated, null, "\t")
		})
		if (!updated) throw new Error("Settings could not be saved.")
		this.raw = updated
	}
}
