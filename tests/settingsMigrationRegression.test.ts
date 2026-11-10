import { describe, expect, it, vi } from "vitest"
import { createBackup, deletePreviousBackup } from "../src/settings/settingsBackup"
import { loadVersionedSettings, type SettingsStorage } from "../src/settings/settingsMigration"

const directory = "vault-config/plugins/name-dialogue"
const dataPath = `${directory}/data.json`
const time = new Date("2026-01-02T03:04:05.678Z")
const backupPath = `${directory}/data.json.backup(2026-01-02T03-04-05-678Z)`
const previousName = "data.json.backup(2025-01-01T00-00-00-000Z)"
const previousPath = `${directory}/${previousName}`

function bytes(text: string): ArrayBuffer {
	return new Uint8Array(new TextEncoder().encode(text)).buffer
}

function text(value: ArrayBuffer): string {
	return new TextDecoder().decode(value)
}

function storageWith(data?: string) {
	const files = new Map<string, ArrayBuffer>()
	if (data !== undefined) files.set(dataPath, bytes(data))
	const adapter = {
		exists: vi.fn(async (path: string) => files.has(path)),
		readBinary: vi.fn(async (path: string) => {
			const content = files.get(path)
			if (!content) throw new Error("Missing file.")
			return content.slice(0)
		}),
		copy: vi.fn(async (source: string, target: string) => {
			if (files.has(target)) throw new Error("Destination exists.")
			const content = files.get(source)
			if (!content) throw new Error("Missing file.")
			files.set(target, content.slice(0))
		}),
		remove: vi.fn(async (path: string) => {
			if (!files.delete(path)) throw new Error("Missing file.")
		}),
		process: vi.fn(async (path: string, update: (value: string) => string) => {
			const content = files.get(path)
			if (!content) throw new Error("Missing file.")
			const updated = update(text(content))
			files.set(path, bytes(updated))
			return updated
		}),
	}
	const loadData = vi.fn(async (): Promise<unknown> => {
		const content = files.get(dataPath)
		return content ? JSON.parse(text(content)) : null
	})
	const prompts = {
		confirmMigration: vi.fn(async () => true),
		warnOutdated: vi.fn(async () => true),
		saveBackup: vi.fn(async (_snapshot: ArrayBuffer) => true),
		confirmDeleteBackup: vi.fn(async (_name: string) => false),
		reportCleanupFailure: vi.fn(),
	}
	const onUnmigratedSnapshot = vi.fn((_snapshot: ArrayBuffer) => {})
	const storage: SettingsStorage = {
		adapter, directory, loadData, prompts, onUnmigratedSnapshot, now: () => time,
		incompatibleSchemas: new Set([0]),
	}
	return { files, adapter, loadData, prompts, onUnmigratedSnapshot, storage }
}

describe("settings schema migration", () => {
	it("compatible legacy data: [unversioned settings] -> [load without migration or write]", async () => {
		const original = '{"characters":[],"custom":{"keep":true}}'
		const { storage, files, adapter, prompts } = storageWith(original)
		storage.incompatibleSchemas = new Set()
		expect(await loadVersionedSettings(storage)).toMatchObject({ schemaVersion: 1, characters: [] })
		expect(text(files.get(dataPath)!)).toBe(original)
		expect(prompts.confirmMigration).not.toHaveBeenCalled()
		expect(adapter.copy).not.toHaveBeenCalled()
		expect(adapter.process).not.toHaveBeenCalled()
	})

	it("future data: [newer version and unknown properties] -> [recognized values and warning]", async () => {
		const original = '{"schemaVersion":8,"characters":[],"custom":true}'
		const { storage, files, prompts } = storageWith(original)
		const loaded = vi.fn()
		storage.onLoadedData = loaded
		expect(await loadVersionedSettings(storage)).toMatchObject({ schemaVersion: 8, characters: [] })
		expect(loaded).toHaveBeenCalledWith(JSON.parse(original), true, ["schemaVersion"])
		expect(text(files.get(dataPath)!)).toBe(original)
		expect(prompts.confirmMigration).not.toHaveBeenCalled()
	})

	it("new installation: [missing data.json] -> [defaults without a prompt or write]", async () => {
		const { storage, files, adapter, prompts } = storageWith()
		const settings = await loadVersionedSettings(storage)
		expect(settings).toMatchObject({ schemaVersion: 1, characters: [] })
		expect(files.size).toBe(0)
		expect(adapter.copy).not.toHaveBeenCalled()
		expect(adapter.process).not.toHaveBeenCalled()
		expect(prompts.confirmMigration).not.toHaveBeenCalled()
	})

	it("current settings: [schema 1 and old backups] -> [no prompt, write, or cleanup]", async () => {
		const original = '{"schemaVersion":1,"characters":[],"custom":42}'
		const { storage, files, adapter, prompts } = storageWith(original)
		files.set(previousPath, bytes("manual"))
		files.set(backupPath, bytes("other"))
		expect(await loadVersionedSettings(storage)).toMatchObject({ schemaVersion: 1 })
		expect(text(files.get(dataPath)!)).toBe(original)
		expect(adapter.process).not.toHaveBeenCalled()
		expect(adapter.remove).not.toHaveBeenCalled()
		expect(prompts.confirmMigration).not.toHaveBeenCalled()
	})

	it("accepted migration: [legacy dialogueStyles and speech] -> [preserved settings and verified backup]", async () => {
		const original = JSON.stringify({
			characters: [{ id: 1, name: "Alice", aliases: ["Ally"], colour: "#123456", custom: "kept" }],
			namespaceRegex: "^(?<name>[^:]+):(?<dialogue>.*)$",
			dialogueStyles: {
				verticalGap: 2,
				speech: { borderThickness: 3, fillOpacity: 20, cornerRadius: 9, customBox: true },
				thought: { borderThickness: 2, fillOpacity: 8, cornerRadius: 20 },
				customStyle: "kept",
			},
			customSetting: { keep: true },
		}, null, 2)
		const { storage, files, adapter, prompts } = storageWith(original)
		const settings = await loadVersionedSettings(storage)
		expect(settings).toMatchObject({
			schemaVersion: 1,
			characters: [{ name: "Alice", aliases: ["Ally"] }],
			namespaceRegex: "^(?<name>[^:]+):(?<dialogue>.*)$",
			decorators: { default: { borderThickness: 3, fillOpacity: 20, cornerRadius: 9 } },
		})
		expect(text(files.get(backupPath)!)).toBe(original)
		expect(JSON.parse(text(files.get(dataPath)!))).toMatchObject({
			schemaVersion: 1, customSetting: { keep: true },
			decorators: { customStyle: "kept", default: { customBox: true } },
		})
		expect(prompts.confirmMigration).toHaveBeenCalledOnce()
		expect(text(prompts.saveBackup.mock.calls[0]![0])).toBe(original)
		expect(adapter.process).toHaveBeenCalledOnce()
	})

	it("decorator precedence: [default and speech] -> [default is retained]", async () => {
		const { storage } = storageWith(JSON.stringify({
			decorators: { default: { fillOpacity: 17 }, speech: { fillOpacity: 70 } },
			dialogueStyles: { speech: { fillOpacity: 80 } },
		}))
		expect((await loadVersionedSettings(storage))?.decorators.default.fillOpacity).toBe(17)
	})

	it("declined migration: [acknowledged warning] -> [normalized memory and unchanged files]", async () => {
		const original = '{"characters":[],"custom":42}'
		const { storage, prompts, files, adapter, onUnmigratedSnapshot } = storageWith(original)
		prompts.confirmMigration.mockResolvedValueOnce(false)
		expect(await loadVersionedSettings(storage)).toMatchObject({ schemaVersion: 1 })
		expect(prompts.warnOutdated).toHaveBeenCalledOnce()
		expect(prompts.saveBackup).not.toHaveBeenCalled()
		expect(text(onUnmigratedSnapshot.mock.calls[0]![0])).toBe(original)
		expect(text(files.get(dataPath)!)).toBe(original)
		expect(adapter.copy).not.toHaveBeenCalled()
		expect(adapter.process).not.toHaveBeenCalled()
	})

	it("declined migration: [warning dismissed] -> [no plugin settings and no write]", async () => {
		const { storage, prompts, adapter } = storageWith('{"characters":[]}')
		prompts.confirmMigration.mockResolvedValueOnce(false)
		prompts.warnOutdated.mockResolvedValueOnce(false)
		expect(await loadVersionedSettings(storage)).toBeNull()
		expect(adapter.copy).not.toHaveBeenCalled()
		expect(adapter.process).not.toHaveBeenCalled()
	})

	it("declined migration: [settings changed during warning] -> [changed data retained]", async () => {
		const { storage, prompts, files, adapter } = storageWith('{"characters":[]}')
		prompts.confirmMigration.mockResolvedValueOnce(false)
		prompts.warnOutdated.mockImplementationOnce(async () => {
			files.set(dataPath, bytes('{"external":true}'))
			return true
		})
		await expect(loadVersionedSettings(storage)).rejects.toThrow("changed while awaiting confirmation")
		expect(text(files.get(dataPath)!)).toBe('{"external":true}')
		expect(adapter.copy).not.toHaveBeenCalled()
		expect(adapter.process).not.toHaveBeenCalled()
	})

	it("backup canceled: [migration accepted but no copy] -> [no plugin settings or write]", async () => {
		const original = '{"characters":[]}'
		const { storage, prompts, files, adapter } = storageWith(original)
		prompts.saveBackup.mockResolvedValueOnce(false)
		expect(await loadVersionedSettings(storage)).toBeNull()
		expect(text(files.get(dataPath)!)).toBe(original)
		expect(adapter.copy).not.toHaveBeenCalled()
		expect(adapter.process).not.toHaveBeenCalled()
	})

	for (const { input, description } of [
		{ input: "null", description: "null data" },
		{ input: "{", description: "invalid JSON" },
		{ input: '{"characters":"invalid"}', description: "invalid characters" },
		{ input: '{"namespaceRegex":"["}', description: "invalid pattern" },
		{ input: '{"lastMigrationBackup":"custom data"}', description: "reserved backup field" },
	]) {
		it(`${description}: [invalid data] -> [stop without prompting or overwriting]`, async () => {
			const { storage, files, adapter, prompts } = storageWith(input)
			await expect(loadVersionedSettings(storage)).rejects.toThrow()
			expect(text(files.get(dataPath)!)).toBe(input)
			expect(prompts.confirmMigration).not.toHaveBeenCalled()
			expect(adapter.process).not.toHaveBeenCalled()
		})
	}
})

describe("settings backup and recovery", () => {
	it("backup collisions: [original and three alternatives exist] -> [stop without copying]", async () => {
		const original = '{"characters":[]}'
		const { adapter, files } = storageWith(original)
		files.set(backupPath, bytes("existing"))
		for (let attempt = 1; attempt <= 3; attempt++) {
			files.set(`${directory}/data.json.backup(2026-01-02T03-04-05-678Z-${String(attempt).padStart(6, "0")})`, bytes("existing"))
		}
		await expect(createBackup(adapter, directory, dataPath, bytes(original), time))
			.rejects.toThrow("Unable to create a uniquely named settings backup.")
		expect(adapter.copy).not.toHaveBeenCalled()
	})

	it("backup collision: [existing matching files] -> [new backup and originals retained]", async () => {
		const original = '{"characters":[]}'
		const { storage, files, adapter } = storageWith(original)
		files.set(previousPath, bytes("old"))
		files.set(backupPath, bytes("collision"))
		await loadVersionedSettings(storage)
		const latest = `${directory}/data.json.backup(2026-01-02T03-04-05-678Z-000001)`
		expect(text(files.get(latest)!)).toBe(original)
		expect(text(files.get(previousPath)!)).toBe("old")
		expect(text(files.get(backupPath)!)).toBe("collision")
		expect(adapter.remove).not.toHaveBeenCalled()
	})

	it("backup failure: [copy error] -> [original retained without a write]", async () => {
		const original = '{"characters":[]}'
		const { storage, files, adapter } = storageWith(original)
		adapter.copy.mockRejectedValueOnce(new Error("Copy failed."))
		await expect(loadVersionedSettings(storage)).rejects.toThrow("Copy failed.")
		expect(text(files.get(dataPath)!)).toBe(original)
		expect(adapter.process).not.toHaveBeenCalled()
		expect(adapter.copy).toHaveBeenCalledOnce()
	})

	it("backup verification: [incorrect copy] -> [original retained without a write]", async () => {
		const original = '{"characters":[]}'
		const { storage, files, adapter } = storageWith(original)
		adapter.copy.mockImplementationOnce(async (_source, target) => { files.set(target, bytes("incorrect")) })
		await expect(loadVersionedSettings(storage)).rejects.toThrow("backup verification failed")
		expect(text(files.get(dataPath)!)).toBe(original)
		expect(adapter.process).not.toHaveBeenCalled()
	})

	it("concurrent load: [different loaded data] -> [stop without a backup]", async () => {
		const { storage, adapter, loadData } = storageWith('{"characters":[]}')
		loadData.mockResolvedValueOnce({ external: true })
		await expect(loadVersionedSettings(storage)).rejects.toThrow("changed while loading")
		expect(adapter.copy).not.toHaveBeenCalled()
	})

	it("load failure: [unreadable saved data] -> [error without private contents]", async () => {
		const { storage, loadData, adapter } = storageWith('{"characters":[]}')
		loadData.mockRejectedValueOnce(new Error("private settings text"))
		await expect(loadVersionedSettings(storage)).rejects.toThrow("Unable to read plugin settings.")
		expect(adapter.copy).not.toHaveBeenCalled()
	})

	it("concurrent change: [data changed after backup] -> [external data and backup retained]", async () => {
		const original = '{"characters":[]}'
		const { storage, files, adapter } = storageWith(original)
		adapter.copy.mockImplementationOnce(async (_source, target) => {
			files.set(target, bytes(original))
			files.set(dataPath, bytes('{"external":true}'))
		})
		await expect(loadVersionedSettings(storage)).rejects.toThrow("changed before migration")
		expect(text(files.get(dataPath)!)).toBe('{"external":true}')
		expect(text(files.get(backupPath)!)).toBe(original)
	})

	it("write failure: [partial or concurrent data] -> [no blind restoration and backup retained]", async () => {
		const original = '{"characters":[]}'
		const { storage, files, adapter } = storageWith(original)
		adapter.process.mockImplementationOnce(async () => {
			files.set(dataPath, bytes('{"external":true}'))
			throw new Error("Write failed.")
		})
		await expect(loadVersionedSettings(storage)).rejects.toThrow("check data.json")
		expect(text(files.get(dataPath)!)).toBe('{"external":true}')
		expect(text(files.get(backupPath)!)).toBe(original)
	})

	it("unverified write: [unchanged data after process] -> [stop with backup retained]", async () => {
		const original = '{"characters":[]}'
		const { storage, files, adapter } = storageWith(original)
		adapter.process.mockResolvedValueOnce(original)
		await expect(loadVersionedSettings(storage)).rejects.toThrow("could not be verified")
		expect(text(files.get(dataPath)!)).toBe(original)
		expect(text(files.get(backupPath)!)).toBe(original)
	})
})

describe("previous backup confirmation", () => {
	it("declined deletion: [recorded previous backup] -> [both backups retained]", async () => {
		const { adapter, files, prompts } = storageWith()
		files.set(previousPath, bytes("previous"))
		files.set(backupPath, bytes("new"))
		await deletePreviousBackup(adapter, directory, previousName, backupPath, bytes("new"), prompts.confirmDeleteBackup)
		expect(prompts.confirmDeleteBackup).toHaveBeenCalledWith(previousName)
		expect(files.has(previousPath)).toBe(true)
		expect(files.has(backupPath)).toBe(true)
	})

	it("confirmed deletion: [recorded previous backup] -> [only previous backup removed]", async () => {
		const { adapter, files, prompts } = storageWith()
		const unrecognized = `${directory}/data.json.backup(2024-01-01T00-00-00-000Z)`
		files.set(previousPath, bytes("previous"))
		files.set(backupPath, bytes("new"))
		files.set(unrecognized, bytes("manual"))
		prompts.confirmDeleteBackup.mockResolvedValueOnce(true)
		await deletePreviousBackup(adapter, directory, previousName, backupPath, bytes("new"), prompts.confirmDeleteBackup)
		expect(adapter.remove).toHaveBeenCalledExactlyOnceWith(previousPath)
		expect(files.has(unrecognized)).toBe(true)
		expect(files.has(backupPath)).toBe(true)
	})

	it("changed previous backup: [replacement during prompt] -> [both backups retained]", async () => {
		const { adapter, files } = storageWith()
		files.set(previousPath, bytes("previous"))
		files.set(backupPath, bytes("new"))
		const confirm = vi.fn(async () => { files.set(previousPath, bytes("replacement")); return true })
		await expect(deletePreviousBackup(adapter, directory, previousName, backupPath, bytes("new"), confirm))
			.rejects.toThrow("previous settings backup changed")
		expect(adapter.remove).not.toHaveBeenCalled()
	})

	it("changed new backup: [replacement during prompt] -> [previous backup retained]", async () => {
		const { adapter, files } = storageWith()
		files.set(previousPath, bytes("previous"))
		files.set(backupPath, bytes("new"))
		const confirm = vi.fn(async () => { files.set(backupPath, bytes("replacement")); return true })
		await expect(deletePreviousBackup(adapter, directory, previousName, backupPath, bytes("new"), confirm))
			.rejects.toThrow("new settings backup changed")
		expect(adapter.remove).not.toHaveBeenCalled()
	})

	it("unrecorded backup: [matching file without reference] -> [no deletion prompt]", async () => {
		const { adapter, files, prompts } = storageWith()
		files.set(previousPath, bytes("manual"))
		files.set(backupPath, bytes("new"))
		await deletePreviousBackup(adapter, directory, undefined, backupPath, bytes("new"), prompts.confirmDeleteBackup)
		expect(prompts.confirmDeleteBackup).not.toHaveBeenCalled()
		expect(adapter.remove).not.toHaveBeenCalled()
	})
})
