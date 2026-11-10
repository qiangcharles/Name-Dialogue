import { describe, expect, it, vi } from "vitest"
import { isSettingsRecord, parseSettings } from "../src/settings/settingsParser"
import { SettingsPersistence } from "../src/settings/settingsPersistence"

function storage(initial: Record<string, unknown>) {
	let raw = JSON.stringify(initial)
	const adapter = {
		exists: vi.fn(async () => true),
		process: vi.fn(async (_path: string, update: (value: string) => string) => {
			raw = update(raw)
			return raw
		}),
	}
	const persistence = new SettingsPersistence(adapter, "data.json", initial, true, vi.fn())
	return {
		persistence,
		adapter,
		read: (): Record<string, unknown> => {
			const value: unknown = JSON.parse(raw)
			if (!isSettingsRecord(value)) throw new Error("Invalid test data.")
			return value
		},
		change: (data: Record<string, unknown>) => { raw = JSON.stringify(data) },
	}
}

describe("settings property parsing", () => {
	it("unknown fields: [extra nested settings] -> [recognized runtime values only]", () => {
		const parsed = parseSettings({
			schemaVersion: 4,
			custom: { nested: true },
			characters: [{ id: 1, name: "Alice", aliases: [], colour: "#123456", custom: true }],
			decorators: { default: { fillOpacity: 20, custom: "kept" }, custom: true },
		})
		expect(parsed.settings).not.toHaveProperty("custom")
		expect(parsed.settings.characters[0]).not.toHaveProperty("custom")
		expect(parsed.settings.decorators).not.toHaveProperty("custom")
		expect(parsed.settings.decorators.default).not.toHaveProperty("custom")
		expect(parsed.settings.schemaVersion).toBe(4)
		expect(parsed.warnings).toContain("schemaVersion")
	})

	it("invalid colour: [not-hex] -> [safe runtime colour and original editor draft]", () => {
		const parsed = parseSettings({
			characters: [{ id: 1, name: "Alice", aliases: [], colour: "not-hex" }],
		})
		expect(parsed.settings.characters[0]?.colour).toBe("#676767")
		expect(parsed.characterDrafts[0]?.colour).toBe("not-hex")
		expect(parsed.warnings).toContain("characters.0.colour")
	})

	it("invalid properties: [bad version and spacing] -> [defaults and diagnostics]", () => {
		const parsed = parseSettings({ schemaVersion: "future", decorators: { verticalGap: 900 } })
		expect(parsed.settings.schemaVersion).toBe(1)
		expect(parsed.settings.decorators.verticalGap).toBe(1.2)
		expect(parsed.warnings).toEqual(["schemaVersion", "decorators.verticalGap"])
	})

	it("unrepairable entries: [invalid character identifier] -> [editing blocked]", () => {
		expect(parseSettings({ characters: [{ id: "bad", name: "Alice", aliases: [], colour: "#123456" }] })
			.charactersEditable).toBe(false)
	})
})

describe("settings property persistence", () => {
	it("character edit: [unknown nested properties] -> [only edited values changed]", async () => {
		const original = {
			schemaVersion: 8,
			custom: { nested: true },
			characters: [{ id: 1, name: "Alice", aliases: ["Ally"], colour: "bad", custom: { keep: true } }],
		}
		const { persistence, read } = storage(original)
		const parsed = parseSettings(original)
		const draft = persistence.getCharacterDrafts()[0]
		if (!draft) throw new Error("Missing draft.")
		await persistence.save({
			...parsed.settings,
			characters: [{ ...draft, colour: "#abcdef" }],
		}, "characters")
		expect(read()).toEqual({
			...original,
			characters: [{ ...original.characters[0], colour: "#abcdef" }],
		})
	})

	it("decorator edit: [legacy speech and extra properties] -> [only edited property changed]", async () => {
		const original = {
			schemaVersion: "future",
			dialogueStyles: { speech: { fillOpacity: 12, custom: { keep: true } }, custom: true },
		}
		const { persistence, read } = storage(original)
		const settings = parseSettings(original).settings
		await persistence.save({
			...settings,
			decorators: { ...settings.decorators, default: { ...settings.decorators.default, fillOpacity: 25 } },
		}, "decorators")
		expect(read()).toEqual({
			schemaVersion: "future",
			dialogueStyles: { speech: { fillOpacity: 25, custom: { keep: true } }, custom: true },
		})
	})

	it("invalid spacing: [900] -> [explicitly selected default]", async () => {
		const original = { decorators: { verticalGap: 900, extra: true } }
		const { persistence, read } = storage(original)
		expect(persistence.getDecoratorWarnings()).toEqual(["decorators.verticalGap: 900"])
		await persistence.save(parseSettings(original).settings, "decorators", "verticalGap")
		expect(read()).toEqual({ decorators: { verticalGap: 1.2, extra: true } })
		expect(persistence.getDecoratorWarnings()).toEqual([])
	})

	it("character reorder: [Bob | Alice] -> [Alice | Bob with extra properties]", async () => {
		const original = {
			characters: [
				{ id: 2, name: "Bob", aliases: [], colour: "#abcdef", extra: { owner: "Bob" } },
				{ id: 1, name: "Alice", aliases: [], colour: "#123456", extra: { owner: "Alice" } },
			],
		}
		const { persistence, read } = storage(original)
		const drafts = persistence.getCharacterDrafts()
		await persistence.save({ ...parseSettings(original).settings, characters: drafts.reverse() }, "characters")
		expect(read()).toEqual({ characters: [original.characters[1], original.characters[0]] })
	})

	it("invalid colour: [edit another character] -> [no write until corrected]", async () => {
		const original = {
			characters: [
				{ id: 1, name: "Alice", aliases: [], colour: "bad" },
				{ id: 2, name: "Bob", aliases: [], colour: "#abcdef" },
			],
		}
		const { persistence, read } = storage(original)
		const drafts = persistence.getCharacterDrafts()
		const bob = drafts[1]
		if (!bob) throw new Error("Missing character.")
		bob.name = "Robert"
		await expect(persistence.save({ ...parseSettings(original).settings, characters: drafts }, "characters"))
			.rejects.toThrow("Colours must be hex codes.")
		expect(read()).toEqual(original)
	})

	it("external edit: [changed data.json] -> [no overwrite]", async () => {
		const original = { characters: [] }
		const { persistence, read, change } = storage(original)
		change({ characters: [], external: true })
		await expect(persistence.save(parseSettings(original).settings, "characters"))
			.rejects.toThrow("Settings changed since loading")
		expect(read()).toEqual({ characters: [], external: true })
	})

	it("unrepairable character: [invalid identifier] -> [no overwrite]", async () => {
		const original = { characters: [{ id: "bad", name: "Alice", aliases: [], colour: "#123456" }] }
		const { persistence, read } = storage(original)
		await expect(persistence.save(parseSettings(original).settings, "characters")).rejects.toThrow("cannot be edited safely")
		expect(read()).toEqual(original)
	})
})
