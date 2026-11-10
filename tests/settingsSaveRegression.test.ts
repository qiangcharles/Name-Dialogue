import { describe, expect, it, vi } from "vitest"
import { DEFAULT_SETTINGS, type NameDialogueSettings } from "../src/settings/settingsData"
import { SettingsStore } from "../src/settings/settingsStore"

function settings(): NameDialogueSettings {
	return {
		...DEFAULT_SETTINGS,
		characters: [],
		decorators: {
			...DEFAULT_SETTINGS.decorators,
			default: { ...DEFAULT_SETTINGS.decorators.default },
			thought: { ...DEFAULT_SETTINGS.decorators.thought },
		},
	}
}

describe("settings save ordering", () => {
	it("stale character draft: [another save completes first] -> [stale save rejected]", async () => {
		const original = settings()
		let version = 0
		const store = new SettingsStore(original, async () => { version++ }, () => {})
		const first = store.saveCharacters([{ id: 1, name: "Alice", aliases: [], colour: "#123456" }])
		const second = store.saveCharacters([{ id: 2, name: "Bob", aliases: [], colour: "#abcdef" }], () => {
			if (version !== 0) throw new Error("Stale character draft.")
		})
		await first
		await expect(second).rejects.toThrow("Stale character draft.")
	})

	it("overlapping saves: [character and decorator changes] -> [both changes persisted]", async () => {
		const original = settings()
		let releaseFirst!: () => void
		const firstSave = new Promise<void>((resolve) => { releaseFirst = resolve })
		const saveData = vi.fn(async (_value: NameDialogueSettings) => {
			if (saveData.mock.calls.length === 1) await firstSave
		})
		let current = original
		const store = new SettingsStore(original, saveData, (updated) => { current = updated })
		const character = { id: 1, name: "Alice", aliases: ["Ally"], colour: "#123456" }
		const first = store.saveCharacters([character])
		const second = store.saveDecorators({ ...original.decorators, verticalGap: 2 })
		expect(current.decorators.verticalGap).toBe(2)
		releaseFirst()
		await Promise.all([first, second])
		expect(saveData).toHaveBeenCalledTimes(2)
		const final = saveData.mock.calls[1]?.[0]
		expect(final).toMatchObject({ schemaVersion: 1, characters: [character], decorators: { verticalGap: 2 } })
		expect(current).toMatchObject({ schemaVersion: 1, characters: [character], decorators: { verticalGap: 2 } })
	})

	it("failed decorator save: [preview change] -> [rollback and later saves continue]", async () => {
		const original = settings()
		const saveData = vi.fn<(value: NameDialogueSettings) => Promise<void>>()
			.mockRejectedValueOnce(new Error("Save failed."))
			.mockResolvedValue(undefined)
		let current = original
		const store = new SettingsStore(original, saveData, (updated) => { current = updated })
		const failed = store.saveDecorators({ ...original.decorators, verticalGap: 3 })
		expect(current.decorators.verticalGap).toBe(3)
		await expect(failed).rejects.toThrow("Save failed.")
		expect(current.decorators.verticalGap).toBe(original.decorators.verticalGap)
		await store.saveCharacters([{ id: 1, name: "Alice", aliases: [], colour: "#123456" }])
		expect(saveData.mock.calls[1]?.[0]).toMatchObject({
			schemaVersion: 1,
			decorators: { verticalGap: original.decorators.verticalGap },
			characters: [{ name: "Alice" }],
		})
	})

	it("overlapping saves: [decorator and character changes] -> [both changes persisted]", async () => {
		const original = settings()
		const saveData = vi.fn<(value: NameDialogueSettings) => Promise<void>>()
			.mockResolvedValue(undefined)
		let current = original
		const store = new SettingsStore(original, saveData, (updated) => { current = updated })
		const first = store.saveDecorators({ ...original.decorators, verticalGap: 2 })
		const second = store.saveCharacters([{ id: 1, name: "Alice", aliases: [], colour: "#123456" }])
		await Promise.all([first, second])
		expect(saveData.mock.calls[1]?.[0]).toMatchObject({
			schemaVersion: 1,
			decorators: { verticalGap: 2 },
			characters: [{ name: "Alice" }],
		})
		expect(current.decorators.verticalGap).toBe(2)
	})

	it("failed character save: [character change] -> [existing settings retained]", async () => {
		const original = settings()
		const saveData = vi.fn<(value: NameDialogueSettings) => Promise<void>>()
			.mockRejectedValueOnce(new Error("Save failed."))
		let current = original
		const store = new SettingsStore(original, saveData, (updated) => { current = updated })
		await expect(store.saveCharacters([{ id: 1, name: "Alice", aliases: [], colour: "#123456" }]))
			.rejects.toThrow("Save failed.")
		expect(current.characters).toEqual([])
		expect(current.schemaVersion).toBe(1)
	})

	it("custom saved fields: [decorator update] -> [unrelated fields retained]", async () => {
		const original = {
			...settings(),
			customSetting: { keep: true },
			decorators: {
				...settings().decorators,
				default: { ...settings().decorators.default, customBox: "kept" },
				customStyle: "kept",
			},
		}
		const saveData = vi.fn<(value: NameDialogueSettings) => Promise<void>>()
			.mockResolvedValue(undefined)
		const store = new SettingsStore(original, saveData, () => {})
		await store.saveDecorators({ ...original.decorators, verticalGap: 2 })
		expect(saveData.mock.calls[0]?.[0]).toMatchObject({
			customSetting: { keep: true },
			decorators: { verticalGap: 2, customStyle: "kept", default: { customBox: "kept" } },
		})
	})
})
