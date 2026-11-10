import { beforeEach, describe, expect, it, vi } from "vitest"
import { Notice } from "obsidian"
import NameDialogue from "../src/main"

const prompts = vi.hoisted(() => ({
	confirmMigration: vi.fn(),
	warnOutdated: vi.fn(),
	saveBackup: vi.fn(),
	confirmDeleteBackup: vi.fn(),
	reportCleanupFailure: vi.fn(),
	dispose: vi.fn(),
	incompatible: false,
}))

vi.mock("../src/settings/settingsMigration", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../src/settings/settingsMigration")>()
	return {
		...actual,
		loadVersionedSettings: (storage: import("../src/settings/settingsMigration").SettingsStorage) =>
			actual.loadVersionedSettings(prompts.incompatible ? { ...storage, incompatibleSchemas: new Set([0]) } : storage),
	}
})

vi.mock("../src/modals/migration/migrationPrompts", () => ({
	MigrationPrompts: class {
		confirmMigration = prompts.confirmMigration
		warnOutdated = prompts.warnOutdated
		saveBackup = prompts.saveBackup
		confirmDeleteBackup = prompts.confirmDeleteBackup
		reportCleanupFailure = prompts.reportCleanupFailure
		dispose = prompts.dispose
	},
}))

function pluginWithData(source: string | null) {
	const directory = "vault-config/plugins/name-dialogue"
	const dataPath = `${directory}/data.json`
	const files = new Map<string, ArrayBuffer>()
	const encode = (value: string): ArrayBuffer => new Uint8Array(new TextEncoder().encode(value)).buffer
	if (source !== null) files.set(dataPath, encode(source))
	const adapter = {
		exists: vi.fn(async (path: string) => files.has(path)),
		readBinary: vi.fn(async (path: string) => {
			const data = files.get(path)
			if (!data) throw new Error("Missing file.")
			return data.slice(0)
		}),
		list: vi.fn(async () => ({ files: Array.from(files.keys()), folders: [] })),
		copy: vi.fn(async (sourcePath: string, targetPath: string) => {
			const data = files.get(sourcePath)
			if (!data || files.has(targetPath)) throw new Error("Unable to copy file.")
			files.set(targetPath, data.slice(0))
		}),
		writeBinary: vi.fn(async (path: string, data: ArrayBuffer) => {
			files.set(path, data.slice(0))
		}),
		process: vi.fn(async (path: string, update: (data: string) => string) => {
			const data = files.get(path)
			if (!data) throw new Error("Missing file.")
			const result = update(new TextDecoder().decode(data))
			files.set(path, encode(result))
			return result
		}),
		remove: vi.fn(async (path: string) => { files.delete(path) }),
	}
	const plugin = Object.create(NameDialogue.prototype) as NameDialogue
	Object.defineProperties(plugin, {
		manifest: { value: { dir: directory } },
		app: { value: { vault: { adapter } } },
	})
	const loadData = vi.fn(async (): Promise<unknown> => {
		const data = files.get(dataPath)
		return data ? JSON.parse(new TextDecoder().decode(data)) : null
	})
	const saveData = vi.fn(async (data: unknown) => { files.set(dataPath, encode(JSON.stringify(data))) })
	const addSettingTab = vi.fn()
	const registerEditorExtension = vi.fn()
	const addRibbonIcon = vi.fn()
	const addCommand = vi.fn()
	const register = vi.fn<(callback: () => unknown) => void>()
	plugin.loadData = loadData
	plugin.saveData = saveData
	plugin.addSettingTab = addSettingTab
	plugin.registerEditorExtension = registerEditorExtension
	plugin.addRibbonIcon = addRibbonIcon
	plugin.addCommand = addCommand
	plugin.register = register
	return { plugin, adapter, files, dataPath, saveData, registerEditorExtension, addCommand, register }
}

beforeEach(() => {
	vi.clearAllMocks()
	prompts.incompatible = false
	prompts.confirmMigration.mockResolvedValue(true)
	prompts.warnOutdated.mockResolvedValue(true)
	prompts.saveBackup.mockResolvedValue(true)
	prompts.confirmDeleteBackup.mockResolvedValue(false)
})

describe("plugin settings startup", () => {
	it("new installation: [missing data.json] -> [register plugin with schema 1]", async () => {
		const { plugin, saveData, registerEditorExtension, addCommand } = pluginWithData(null)
		await plugin.onload()
		expect(plugin.settings.schemaVersion).toBe(1)
		expect(saveData).not.toHaveBeenCalled()
		expect(registerEditorExtension).toHaveBeenCalledOnce()
		expect(addCommand).toHaveBeenCalledOnce()
	})

	it("future settings: [schema 2] -> [warning and plugin registration]", async () => {
		const { plugin, adapter, saveData, registerEditorExtension, addCommand } = pluginWithData('{"schemaVersion":2}')
		await plugin.onload()
		expect(vi.mocked(Notice)).toHaveBeenCalled()
		expect(vi.mocked(Notice)).toHaveBeenCalledWith(
			"These settings are from a newer plugin version and may not be compatible.", 0,
		)
		expect(saveData).not.toHaveBeenCalled()
		expect(adapter.list).not.toHaveBeenCalled()
		expect(registerEditorExtension).toHaveBeenCalledOnce()
		expect(addCommand).toHaveBeenCalledOnce()
	})

	it("legacy settings: [unversioned data.json] -> [registered plugin without a write]", async () => {
		const original = '{"characters":[]}'
		const { plugin, adapter, files, dataPath, saveData, registerEditorExtension } = pluginWithData(original)
		await plugin.onload()
		expect(plugin.settings.schemaVersion).toBe(1)
		expect(adapter.copy).not.toHaveBeenCalled()
		expect(new TextDecoder().decode(files.get(dataPath))).toBe(original)
		expect(saveData).not.toHaveBeenCalled()
		expect(adapter.process).not.toHaveBeenCalled()
		expect(registerEditorExtension).toHaveBeenCalledOnce()
	})

	it("declined migration: [outdated data.json] -> [plugin enabled without an immediate write]", async () => {
		const original = '{"characters":[]}'
		const { plugin, files, dataPath, adapter, saveData, registerEditorExtension } = pluginWithData(original)
		prompts.incompatible = true
		prompts.confirmMigration.mockResolvedValueOnce(false)
		await plugin.onload()
		expect(prompts.warnOutdated).toHaveBeenCalledOnce()
		expect(new TextDecoder().decode(files.get(dataPath))).toBe(original)
		expect(adapter.copy).not.toHaveBeenCalled()
		expect(saveData).not.toHaveBeenCalled()
		expect(registerEditorExtension).toHaveBeenCalledOnce()
		await plugin.saveDecorators({ ...plugin.settings.decorators, verticalGap: 2 })
		expect(JSON.parse(new TextDecoder().decode(files.get(dataPath)))).toMatchObject({
			decorators: { verticalGap: 2 },
		})
		expect(adapter.copy).not.toHaveBeenCalled()
	})

	it("declined migration: [settings changed externally before save] -> [external data retained]", async () => {
		const { plugin, files, dataPath, adapter } = pluginWithData('{"characters":[]}')
		prompts.incompatible = true
		prompts.confirmMigration.mockResolvedValueOnce(false)
		await plugin.onload()
		const external = '{"external":true}'
		files.set(dataPath, new Uint8Array(new TextEncoder().encode(external)).buffer)
		await expect(plugin.saveDecorators({ ...plugin.settings.decorators, verticalGap: 2 }))
			.rejects.toThrow("Settings changed since loading")
		expect(new TextDecoder().decode(files.get(dataPath))).toBe(external)
		expect(adapter.copy).not.toHaveBeenCalled()
	})

	it("backup canceled: [migration accepted] -> [no write and no registered features]", async () => {
		const { plugin, adapter, registerEditorExtension, addCommand } = pluginWithData('{"characters":[]}')
		prompts.incompatible = true
		prompts.saveBackup.mockResolvedValueOnce(false)
		await plugin.onload()
		expect(adapter.copy).not.toHaveBeenCalled()
		expect(adapter.process).not.toHaveBeenCalled()
		expect(registerEditorExtension).not.toHaveBeenCalled()
		expect(addCommand).not.toHaveBeenCalled()
		expect(vi.mocked(Notice)).toHaveBeenCalled()
	})

	it("plugin unloaded: [backup prompt pending] -> [no write or registered features]", async () => {
		const { plugin, adapter, registerEditorExtension, register } = pluginWithData('{"characters":[]}')
		prompts.incompatible = true
		let finish!: (value: boolean) => void
		prompts.saveBackup.mockImplementationOnce(() => new Promise<boolean>((resolve) => { finish = resolve }))
		const loading = plugin.onload()
		await vi.waitFor(() => expect(prompts.saveBackup).toHaveBeenCalledOnce())
		const cleanup = register.mock.calls[0]?.[0]
		if (!cleanup) throw new Error("Missing unload cleanup.")
		cleanup()
		finish(true)
		await loading
		expect(prompts.dispose).toHaveBeenCalledOnce()
		expect(adapter.copy).not.toHaveBeenCalled()
		expect(adapter.process).not.toHaveBeenCalled()
		expect(registerEditorExtension).not.toHaveBeenCalled()
	})
})
