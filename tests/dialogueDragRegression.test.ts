import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { Compartment, EditorState, type Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { history, redo, undo } from "@codemirror/commands"
import { createView } from "../src/decoration/decorationView"
import { moveDialogueLine } from "../src/decoration/dialogueDrag"
import { dialoguePreview } from "../src/decoration/dialoguePreview"
import { DEFAULT_SETTINGS } from "../src/settings/settingsData"

const settings = {
	...DEFAULT_SETTINGS,
	characters: [{ id: 1, name: "Alice", aliases: [], colour: "#123456" }],
}

const views: EditorView[] = []

beforeAll(() => {
	vi.stubGlobal("createSpan", () => document.createElement("span"))
	Object.defineProperty(HTMLElement.prototype, "createDiv", {
		configurable: true,
		value(this: HTMLElement, options: { cls: string }) {
			const element = document.createElement("div")
			element.className = options.cls
			this.append(element)
			return element
		},
	})
	Object.defineProperty(Node.prototype, "createSpan", {
		configurable: true,
		value(this: Node, options: { cls?: string }) {
			const element = document.createElement("span")
			element.className = options?.cls ?? ""
			this.appendChild(element)
			return element
		},
	})
	Object.defineProperty(Node.prototype, "createEl", {
		configurable: true,
		value(this: Node, tag: string) {
			const element = document.createElement(tag)
			this.appendChild(element)
			return element
		},
	})
	Object.defineProperty(Range.prototype, "getClientRects", {
		configurable: true, value: () => [],
	})
})

afterAll(() => { vi.unstubAllGlobals() })

afterEach(() => {
	for (const view of views.splice(0)) view.destroy()
	document.body.replaceChildren()
	vi.restoreAllMocks()
})

function openEditor(source = "Alice:Hello\nnext", extensions: Extension[] = [], targetLine?: number): EditorView {
	const parent = document.createElement("div")
	document.body.append(parent)
	const view = new EditorView({
		parent,
		state: EditorState.create({
			doc: source,
			extensions: [
				history(),
				createView(() => settings),
				...extensions,
			],
		}),
	})
	views.push(view)
	const line = view.dom.querySelector<HTMLElement>(".dialogue-box")
	if (line) vi.spyOn(line, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 160, 40))
	vi.spyOn(view.scrollDOM, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 400, 200))
	vi.spyOn(view, "documentTop", "get").mockReturnValue(0)
	const block = view.lineBlockAtHeight(0)
	const target = view.state.doc.line(targetLine ?? view.state.doc.lines)
	Object.defineProperties(block, {
		from: { value: target.from }, to: { value: target.to },
		top: { value: 50 }, bottom: { value: 100 },
	})
	vi.spyOn(view, "lineBlockAtHeight").mockReturnValue(block)
	return view
}

function mouse(type: string, x: number, y: number): MouseEvent {
	return new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: x, clientY: y })
}

describe("dialogue line moves", () => {
	for (const { description, input, source, boundary, expected } of [
		{
			description: "move upward",
			input: "one\nAlice:Hello\nthree", source: 1, boundary: 0,
			expected: "Alice:Hello\none\nthree",
		},
		{
			description: "move downward",
			input: "Alice:Hello\ntwo\nthree", source: 0, boundary: 3,
			expected: "two\nthree\nAlice:Hello",
		},
		{
			description: "preserve trailing newline",
			input: "Alice:Hello\ntwo\n", source: 0, boundary: 3,
			expected: "two\nAlice:Hello\n",
		},
		{
			description: "preserve empty lines",
			input: "Alice:Hello\n\nthree\n", source: 0, boundary: 2,
			expected: "\nAlice:Hello\nthree\n",
		},
		{
			description: "preserve source syntax",
			input: "  Alice:thought:*Hello::world*  \ntext", source: 0, boundary: 2,
			expected: "text\n  Alice:thought:*Hello::world*  ",
		},
		{
			description: "same position",
			input: "Alice:Hello\ntwo", source: 0, boundary: 1,
			expected: "Alice:Hello\ntwo",
		},
	]) {
		it(`${description}: [${input.replace(/\n/g, " | ")}] -> [${expected.replace(/\n/g, " | ")}]`, () => {
			const state = EditorState.create({ doc: input })
			const changes = moveDialogueLine(state, source, boundary)
			expect(changes ? state.update({ changes }).state.doc.toString() : state.doc.toString()).toBe(expected)
		})
	}

	it("Windows line endings: [Alice:Hello | two] -> [two | Alice:Hello]", () => {
		const state = EditorState.create({
			doc: "Alice:Hello\r\ntwo\r\n",
			extensions: EditorState.lineSeparator.of("\r\n"),
		})
		const changes = moveDialogueLine(state, 0, 3)
		expect(changes).not.toBeNull()
		if (!changes) throw new Error("Missing move.")
		expect(state.update({ changes }).state.sliceDoc()).toBe("two\r\nAlice:Hello\r\n")
	})
})

describe("dialogue mouse dragging", () => {
	it("drag handle: [Alice:Hello | next] -> [next | Alice:Hello]", () => {
		const view = openEditor()
		const handle = view.dom.querySelector<HTMLElement>(".dialogue-drag-handle")
		if (!handle) throw new Error("Missing drag handle.")
		expect(handle.title).toBe("Drag dialogue")
		const down = mouse("mousedown", 10, 10)
		handle.dispatchEvent(down)
		expect(down.defaultPrevented).toBe(true)
		document.dispatchEvent(mouse("mousemove", 10, 90))
		const preview = view.dom.querySelector<HTMLElement>(".dialogue-drop-preview")
		expect(preview?.textContent).toContain("Alice")
		expect(preview?.textContent).toContain("Hello")
		expect(preview?.getAttribute("aria-hidden")).toBe("true")
		expect(preview?.querySelector(".dialogue-drag-handle")).toBeNull()
		expect(view.contentDOM.lastElementChild).toBe(preview)
		expect(view.state.field(dialoguePreview)?.boundary).toBe(2)
		expect(view.dom.querySelector(".dialogue-drag-source")).not.toBeNull()
		expect(document.body.querySelector(".dialogue-pointer-ghost")).not.toBeNull()
		expect(view.state.doc.toString()).toBe("Alice:Hello\nnext")
		document.dispatchEvent(mouse("mouseup", 10, 90))
		expect(view.state.doc.toString()).toBe("next\nAlice:Hello")
		expect(view.dom.querySelector(".dialogue-drop-preview")).toBeNull()
		expect(document.body.querySelector(".dialogue-pointer-ghost")).toBeNull()
		expect(undo(view)).toBe(true)
		expect(view.state.doc.toString()).toBe("Alice:Hello\nnext")
		expect(redo(view)).toBe(true)
		expect(view.state.doc.toString()).toBe("next\nAlice:Hello")
	})

	it("preview gap: [pointer remains in the gap] -> [same drop boundary]", () => {
		const view = openEditor()
		const handle = view.dom.querySelector<HTMLElement>(".dialogue-drag-handle")
		if (!handle) throw new Error("Missing drag handle.")
		handle.dispatchEvent(mouse("mousedown", 10, 10))
		document.dispatchEvent(mouse("mousemove", 10, 90))
		const preview = view.dom.querySelector<HTMLElement>(".dialogue-drop-preview")
		if (!preview) throw new Error("Missing drop preview.")
		vi.spyOn(preview, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 60, 400, 40))
		const lineBlock = vi.spyOn(view, "lineBlockAtHeight")
		lineBlock.mockClear()
		document.dispatchEvent(mouse("mousemove", 10, 80))
		expect(lineBlock).not.toHaveBeenCalled()
		expect(view.state.field(dialoguePreview)?.boundary).toBe(2)
		document.dispatchEvent(mouse("mouseup", 10, 80))
		expect(view.state.doc.toString()).toBe("next\nAlice:Hello")
	})

	it("scaled editor: [Alice:Hello | next] -> [preview after next]", () => {
		const view = openEditor()
		vi.spyOn(view, "scaleY", "get").mockReturnValue(2)
		const lineBlock = vi.spyOn(view, "lineBlockAtHeight")
		lineBlock.mockClear()
		const handle = view.dom.querySelector<HTMLElement>(".dialogue-drag-handle")
		if (!handle) throw new Error("Missing drag handle.")
		handle.dispatchEvent(mouse("mousedown", 10, 10))
		document.dispatchEvent(mouse("mousemove", 10, 90))
		expect(lineBlock).toHaveBeenCalledWith(90)
		expect(view.state.field(dialoguePreview)?.boundary).toBe(2)
		expect(view.dom.querySelector<HTMLElement>(".dialogue-drop-preview")?.style.height).toBe("20px")
		document.dispatchEvent(mouse("mouseup", 10, 90))
		expect(view.state.doc.toString()).toBe("next\nAlice:Hello")
	})

	it("no-op drop: [Alice:Hello | next] -> [ghost without a drop preview]", () => {
		const view = openEditor("Alice:Hello\nnext", [], 1)
		const handle = view.dom.querySelector<HTMLElement>(".dialogue-drag-handle")
		if (!handle) throw new Error("Missing drag handle.")
		handle.dispatchEvent(mouse("mousedown", 10, 10))
		document.dispatchEvent(mouse("mousemove", 10, 90))
		expect(view.state.field(dialoguePreview)?.boundary).toBeNull()
		expect(view.dom.querySelector(".dialogue-drop-preview")).toBeNull()
		expect(document.body.querySelector(".dialogue-pointer-ghost")).not.toBeNull()
		document.dispatchEvent(mouse("mouseup", 10, 90))
		expect(view.state.doc.toString()).toBe("Alice:Hello\nnext")
		expect(document.body.querySelector(".dialogue-pointer-ghost")).toBeNull()
	})

	it("preview contents: [interactive children] -> [inert text without links or images]", () => {
		const view = openEditor()
		const line = view.dom.querySelector<HTMLElement>(".dialogue-box")
		const handle = view.dom.querySelector<HTMLElement>(".dialogue-drag-handle")
		if (!line || !handle) throw new Error("Missing dialogue box.")
		const link = document.createElement("a")
		link.href = "https://example.invalid/"
		link.id = "private-link"
		link.textContent = "Visible link"
		const image = document.createElement("img")
		image.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
		line.append(link, image)
		handle.dispatchEvent(mouse("mousedown", 10, 10))
		document.dispatchEvent(mouse("mousemove", 10, 90))
		const preview = view.dom.querySelector(".dialogue-drop-preview")
		expect(preview?.textContent).toContain("Visible link")
		expect(preview?.querySelector("a, img, [id], [href], [src]")).toBeNull()
		expect(document.body.querySelector(".dialogue-pointer-ghost")?.querySelector("a, img, [id], [href], [src]"))
			.toBeNull()
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
	})

	it("read-only editor: [dialogue] -> [no drag handle]", () => {
		const view = openEditor("Alice:Hello", [EditorState.readOnly.of(true)])
		expect(view.dom.querySelector(".dialogue-drag-handle")).toBeNull()
		expect(view.state.doc.toString()).toBe("Alice:Hello")
	})

	it("editor configuration: [editable -> read-only -> editable] -> [handle removed and restored]", () => {
		const mode = new Compartment()
		const view = openEditor("Alice:Hello", [mode.of(EditorView.editable.of(true))])
		expect(view.dom.querySelectorAll(".dialogue-drag-handle")).toHaveLength(1)
		view.dispatch({ effects: mode.reconfigure(EditorView.editable.of(false)) })
		expect(view.dom.querySelector(".dialogue-drag-handle")).toBeNull()
		view.dispatch({ effects: mode.reconfigure(EditorView.editable.of(true)) })
		expect(view.dom.querySelectorAll(".dialogue-drag-handle")).toHaveLength(1)
		expect(view.state.doc.toString()).toBe("Alice:Hello")
	})

	it("read-only during drag: [Alice:Hello | next] -> [unchanged and drag canceled]", () => {
		const mode = new Compartment()
		const view = openEditor("Alice:Hello\nnext", [mode.of(EditorState.readOnly.of(false))])
		const handle = view.dom.querySelector<HTMLElement>(".dialogue-drag-handle")
		if (!handle) throw new Error("Missing drag handle.")
		handle.dispatchEvent(mouse("mousedown", 10, 10))
		document.dispatchEvent(mouse("mousemove", 10, 90))
		expect(view.dom.querySelector(".dialogue-drop-preview")).not.toBeNull()
		view.dispatch({ effects: mode.reconfigure(EditorState.readOnly.of(true)) })
		expect(view.dom.querySelector(".dialogue-drag-handle")).toBeNull()
		expect(view.dom.querySelector(".dialogue-drop-preview")).toBeNull()
		expect(document.body.querySelector(".dialogue-pointer-ghost")).toBeNull()
		document.dispatchEvent(mouse("mouseup", 10, 90))
		expect(view.state.doc.toString()).toBe("Alice:Hello\nnext")
	})

	it("cancel drag: [Alice:Hello | next] -> [Alice:Hello | next]", () => {
		const view = openEditor()
		const line = view.dom.querySelector<HTMLElement>(".dialogue-box")
		if (!line) throw new Error("Missing dialogue box.")
		line.dispatchEvent(mouse("mousedown", 10, 10))
		document.dispatchEvent(mouse("mousemove", 10, 90))
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
		document.dispatchEvent(mouse("mouseup", 10, 90))
		expect(view.state.doc.toString()).toBe("Alice:Hello\nnext")
		expect(view.dom.querySelector(".dialogue-drop-preview")).toBeNull()
		expect(document.body.querySelector(".dialogue-pointer-ghost")).toBeNull()
	})

	it("terminal newline: [Alice:Hello | next | ] -> [next | Alice:Hello | ]", () => {
		const view = openEditor("Alice:Hello\nnext\n")
		const line = view.dom.querySelector<HTMLElement>(".dialogue-box")
		if (!line) throw new Error("Missing dialogue box.")
		line.dispatchEvent(mouse("mousedown", 10, 10))
		document.dispatchEvent(mouse("mousemove", 10, 90))
		expect(view.state.field(dialoguePreview)?.boundary).toBe(2)
		expect(view.dom.querySelector(".dialogue-drop-preview")).not.toBeNull()
		document.dispatchEvent(mouse("mouseup", 10, 90))
		expect(view.state.doc.toString()).toBe("next\nAlice:Hello\n")
	})

	it("text selection: [drag from text] -> [no dialogue move]", () => {
		const view = openEditor()
		const line = view.dom.querySelector<HTMLElement>(".dialogue-box")
		if (!line) throw new Error("Missing dialogue box.")
		const rectangle = new DOMRect(0, 0, 50, 20)
		const rectangles: DOMRectList = { 0: rectangle, length: 1, item: () => rectangle }
		vi.spyOn(Range.prototype, "getClientRects").mockReturnValue(rectangles)
		line.dispatchEvent(mouse("mousedown", 10, 10))
		document.dispatchEvent(mouse("mousemove", 10, 90))
		document.dispatchEvent(mouse("mouseup", 10, 90))
		expect(view.state.doc.toString()).toBe("Alice:Hello\nnext")
		expect(view.dom.querySelector(".dialogue-drop-preview")).toBeNull()
		expect(document.body.querySelector(".dialogue-pointer-ghost")).toBeNull()
	})

	it("drop outside editor: [Alice:Hello | next] -> [Alice:Hello | next]", () => {
		const view = openEditor()
		const line = view.dom.querySelector<HTMLElement>(".dialogue-box")
		if (!line) throw new Error("Missing dialogue box.")
		line.dispatchEvent(mouse("mousedown", 10, 10))
		document.dispatchEvent(mouse("mousemove", 10, 90))
		document.dispatchEvent(mouse("mouseup", 500, 90))
		expect(view.state.doc.toString()).toBe("Alice:Hello\nnext")
		expect(view.dom.querySelector(".dialogue-drop-preview")).toBeNull()
		expect(document.body.querySelector(".dialogue-pointer-ghost")).toBeNull()
	})

	it("document edit: [drag in progress] -> [cancel without moving dialogue]", () => {
		const view = openEditor()
		const line = view.dom.querySelector<HTMLElement>(".dialogue-box")
		if (!line) throw new Error("Missing dialogue box.")
		line.dispatchEvent(mouse("mousedown", 10, 10))
		document.dispatchEvent(mouse("mousemove", 10, 90))
		view.dispatch({ changes: { from: view.state.doc.length, insert: "!" } })
		document.dispatchEvent(mouse("mouseup", 10, 90))
		expect(view.state.doc.toString()).toBe("Alice:Hello\nnext!")
		expect(view.dom.querySelector(".dialogue-drop-preview")).toBeNull()
		expect(document.body.querySelector(".dialogue-pointer-ghost")).toBeNull()
	})

	it("drag near viewport edge: [pointer near bottom] -> [editor scrolls]", () => {
		const view = openEditor()
		const line = view.dom.querySelector<HTMLElement>(".dialogue-box")
		if (!line) throw new Error("Missing dialogue box.")
		let frame: FrameRequestCallback | undefined
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			frame = callback
			return 1
		})
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
		line.dispatchEvent(mouse("mousedown", 10, 10))
		document.dispatchEvent(mouse("mousemove", 10, 190))
		if (!frame) throw new Error("Missing scroll frame.")
		frame(0)
		expect(view.scrollDOM.scrollTop).toBe(12)
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
	})
})
