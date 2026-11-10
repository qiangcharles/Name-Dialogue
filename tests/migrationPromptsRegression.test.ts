import { beforeEach, describe, expect, it, vi } from "vitest"
import type { App } from "obsidian"
import { MigrationPrompts } from "../src/modals/migration/migrationPrompts"

const mocks = vi.hoisted(() => ({ notice: vi.fn() }))

vi.mock("obsidian", () => {
	class Modal {
		contentEl = document.createElement("div")
		setTitle(title: string): void {
			const heading = document.createElement("h2")
			heading.textContent = title
			this.contentEl.append(heading)
		}
		open(): void { document.body.append(this.contentEl); this.onOpen() }
		close(): void { this.onClose(); this.contentEl.remove() }
		onOpen(): void {}
		onClose(): void {}
	}
	class Button {
		element = document.createElement("button")
		setButtonText(text: string): this { this.element.textContent = text; return this }
		setDisabled(value: boolean): this { this.element.disabled = value; return this }
		setCta(): this { return this }
		setDestructive(): this { return this }
		onClick(callback: () => void): this { this.element.addEventListener("click", callback); return this }
	}
	class Setting {
		constructor(private parent: HTMLElement) {}
		addButton(render: (button: Button) => void): this {
			const button = new Button()
			render(button)
			this.parent.append(button.element)
			return this
		}
	}
	return { Modal, Setting, Notice: mocks.notice }
})

function button(name: string): HTMLButtonElement {
	const found = Array.from(document.querySelectorAll("button")).find((element) => element.textContent === name)
	if (!found) throw new Error(`Missing button: ${name}`)
	return found
}

beforeEach(() => {
	document.body.replaceChildren()
	vi.clearAllMocks()
	Object.defineProperty(HTMLElement.prototype, "createEl", {
		configurable: true,
		value(this: HTMLElement, tag: string, options?: { text?: string; href?: string }) {
			const element = document.createElement(tag)
			if (options?.text) element.textContent = options.text
			if (options?.href) element.setAttribute("href", options.href)
			this.append(element)
			return element
		},
	})
	Object.defineProperty(HTMLElement.prototype, "empty", {
		configurable: true, value(this: HTMLElement) { this.replaceChildren() },
	})
	Object.defineProperty(HTMLElement.prototype, "setText", {
		configurable: true, value(this: HTMLElement, value: string) { this.textContent = value },
	})
})

describe("migration consent dialogs", () => {
	it("migration consent: [update settings] -> [accepted]", async () => {
		const prompts = new MigrationPrompts({} as App)
		const result = prompts.confirmMigration()
		button("Update settings").click()
		expect(await result).toBe(true)
	})

	it("migration warning: [acknowledgment] -> [warning notice and previous releases link]", async () => {
		const prompts = new MigrationPrompts({} as App)
		const result = prompts.warnOutdated()
		expect(document.body.textContent).toContain("without a backup")
		expect(document.querySelector("a")?.getAttribute("href"))
			.toBe("https://github.com/qiangcharles/Name-Dialogue/releases")
		button("I understand").click()
		expect(await result).toBe(true)
		expect(mocks.notice).toHaveBeenCalledWith("Don't say I didn't warn you!", 8000)
	})

	it("previous backup: [keep backup] -> [deletion declined]", async () => {
		const prompts = new MigrationPrompts({} as App)
		const result = prompts.confirmDeleteBackup("data.json.backup(example)")
		expect(document.body.textContent).toContain("data.json.backup(example)")
		button("Keep backup").click()
		expect(await result).toBe(false)
	})

	it("previous backup: [delete backup] -> [deletion confirmed]", async () => {
		const prompts = new MigrationPrompts({} as App)
		const result = prompts.confirmDeleteBackup("data.json.backup(example)")
		button("Delete backup").click()
		expect(await result).toBe(true)
	})

	it("plugin unload: [open consent dialog] -> [dialog closed without consent]", async () => {
		const prompts = new MigrationPrompts({} as App)
		const result = prompts.confirmMigration()
		prompts.dispose()
		expect(await result).toBe(false)
		expect(document.querySelector("button")).toBeNull()
	})
})

describe("backup dialog", () => {
	it("clipboard backup: [copy settings] -> [exact text copied after user action]", async () => {
		const copy = vi.fn(async (_value: string) => {})
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } })
		const prompts = new MigrationPrompts({} as App)
		const snapshot = new Uint8Array(new TextEncoder().encode('{"characters":["Alice"]}')).buffer
		const result = prompts.saveBackup(snapshot)
		expect(copy).not.toHaveBeenCalled()
		expect(button("Save file").disabled).toBe(true)
		expect(document.body.textContent).toContain("paste and save")
		button("Copy to clipboard").click()
		expect(await result).toBe(true)
		expect(copy).toHaveBeenCalledExactlyOnceWith('{"characters":["Alice"]}')
		expect(mocks.notice).toHaveBeenCalledWith("Backup copied. Paste and save it somewhere safe.", 8000)
	})

	it("clipboard failure: [permission denied] -> [visible error and retry]", async () => {
		const copy = vi.fn<(value: string) => Promise<void>>()
			.mockRejectedValueOnce(new Error("denied"))
			.mockResolvedValueOnce(undefined)
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } })
		const prompts = new MigrationPrompts({} as App)
		const result = prompts.saveBackup(new Uint8Array(new TextEncoder().encode("{}")).buffer)
		button("Copy to clipboard").click()
		await vi.waitFor(() => expect(document.body.textContent).toContain("Could not copy"))
		expect(button("Copy to clipboard").disabled).toBe(false)
		button("Copy to clipboard").click()
		expect(await result).toBe(true)
		expect(copy).toHaveBeenCalledTimes(2)
	})

	it("backup canceled: [clipboard action still pending] -> [no migration consent]", async () => {
		let finish!: () => void
		const copy = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } })
		const prompts = new MigrationPrompts({} as App)
		const result = prompts.saveBackup(new Uint8Array(new TextEncoder().encode("{}")).buffer)
		button("Copy to clipboard").click()
		button("Cancel").click()
		expect(await result).toBe(false)
		finish()
		await Promise.resolve()
		expect(document.querySelector("button")).toBeNull()
	})
})
