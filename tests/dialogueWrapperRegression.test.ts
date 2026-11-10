import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { EditorState } from "@codemirror/state"
import { Decoration, EditorView } from "@codemirror/view"
import { createView } from "../src/decoration/decorationView"
import { DEFAULT_DECORATORS } from "../src/decorators"
import type { NameDialogueSettings } from "../src/settings"

const settings: NameDialogueSettings = {
	schemaVersion: 1,
	namespaceRegex: String.raw`^(?<name>[^:]+):(?:(?<namespaces>(?:[^:]+:)+))?(?<dialogue>(?:[^:]|::)*)$`,
	characters: [{ id: 1, name: "Alice", aliases: ["Ally"], colour: "#123456" }],
	decorators: DEFAULT_DECORATORS,
}

const views: EditorView[] = []

beforeAll(() => {
	vi.stubGlobal("createSpan", () => document.createElement("span"))
})

afterEach(() => {
	for (const view of views.splice(0)) view.destroy()
	document.body.replaceChildren()
})

function openEditor(source: string, formatted: readonly string[] = []): EditorView {
	const marks = formatted.map((text) => {
		const start = source.indexOf(text)
		if (start < 0) throw new Error(`Missing formatted text: ${text}`)
		return Decoration.mark({ class: "cm-em" }).range(start, start + text.length)
	})
	const parent = document.createElement("div")
	document.body.append(parent)
	const view = new EditorView({
		parent,
		state: EditorState.create({
			doc: source,
			selection: { anchor: source.length },
			extensions: [
				createView(() => settings),
				EditorView.decorations.of(Decoration.set(marks, true)),
			],
		}),
	})
	views.push(view)
	return view
}

function expectWrappers(view: EditorView, opening: string, closing: string): void {
	const wrappers = view.dom.querySelectorAll(".dialogue-wrapper")
	expect(Array.from(wrappers, (element) => element.textContent)).toEqual([opening, closing])
}

describe("wrapper rendering", () => {
	for (const { source, formatted, opening, closing, displayed } of [
		{
			source: "Alice:Looks like *normal dialogue* to me.",
			formatted: ["*normal dialogue*"], opening: '"', closing: '"',
			displayed: 'Alice"Looks like *normal dialogue* to me."',
		},
		{
			source: "Alice:Looks like _normal dialogue_ to me.",
			formatted: ["_normal dialogue_"], opening: '"', closing: '"',
			displayed: 'Alice"Looks like _normal dialogue_ to me."',
		},
		{
			source: "Alice:thought:A *quiet* _thought_",
			formatted: ["*quiet*", "_thought_"], opening: "(", closing: ")",
			displayed: "Alice(A *quiet* _thought_)",
		},
		{
			source: "Alice:Plain dialogue", formatted: [], opening: '"', closing: '"',
			displayed: 'Alice"Plain dialogue"',
		},
	]) {
		it(`single wrapper pair: [${source}] -> [${displayed}]`, () => {
			const view = openEditor(source, formatted)
			expectWrappers(view, opening, closing)
			expect(view.dom.querySelector(".cm-line")?.textContent).toBe(displayed)
			expect(view.dom.querySelectorAll(".dialogue-text-start, .dialogue-text-end")).toHaveLength(0)
			expect(view.dom.querySelectorAll(".dialogue-style-default, .dialogue-style-thought")).toHaveLength(0)
			expect(view.state.doc.toString()).toBe(source)
			expect(view.dom.querySelectorAll(".cm-em")).toHaveLength(formatted.length)
			if (formatted.length > 0) {
				expect(view.dom.querySelectorAll(".dialogue-text").length).toBeGreaterThan(1)
			}
		})
	}
})

describe("escaped symbol behaviour", () => {
	for (const { source, displayed } of [
		{ source: "Alice:::first", displayed: 'Alice":first"' },
		{ source: "Alice:middle::value", displayed: 'Alice"middle:value"' },
		{ source: "Alice:last::", displayed: 'Alice"last:"' },
		{ source: "Alice:::::", displayed: 'Alice"::"' },
	]) {
		it(`escaped colon: [${source}] -> [${displayed}]`, () => {
			const view = openEditor(source)
			expect(view.dom.querySelector(".cm-line")?.textContent).toBe(displayed)
			expect(view.state.doc.toString()).toBe(source)
			expect(view.dom.querySelectorAll(".dialogue-wrapper")).toHaveLength(2)
		})
	}
})

describe("empty dialogue handling", () => {
	for (const source of ["Alice:", "Alice:thought:"]) {
		it(`empty dialogue with selected namespace: [${source}] -> [${source}]`, () => {
			const view = openEditor(source)
			expect(view.dom.querySelectorAll(".dialogue-drag-handle")).toHaveLength(1)
			expect(view.dom.querySelectorAll(".dialogue-wrapper")).toHaveLength(0)
			expect(view.dom.querySelector(".cm-line")?.textContent).toBe(source)
			expect(view.state.doc.toString()).toBe(source)
		})
	}
})

describe("dialogue drag handles", () => {
	it("consecutive dialogue: [Alice:Hello | Alice:thought:Quiet] -> [one handle per line]", () => {
		const source = "Alice:Hello\nAlice:thought:Quiet"
		const view = openEditor(source)
		expect(view.dom.querySelectorAll(".dialogue-drag-handle")).toHaveLength(2)
		expect(view.state.doc.toString()).toBe(source)
		expect(view.dom.querySelectorAll(".dialogue-wrapper")).toHaveLength(4)
	})
})

describe("alternative wrapper handling", () => {
	for (const { source, displayed } of [
		{ source: 'Alice:"quoted"', displayed: 'Alice""quoted""' },
		{ source: "Alice:thought:(quiet)", displayed: "Alice((quiet))" },
	]) {
		it(`typed wrappers: [${source}] -> [${displayed}]`, () => {
			const view = openEditor(source)
			expect(view.dom.querySelector(".cm-line")?.textContent).toBe(displayed)
			expect(view.state.doc.toString()).toBe(source)
			expect(view.dom.querySelectorAll(".dialogue-wrapper")).toHaveLength(2)
		})
	}

	for (const { source, displayed, style, otherStyle } of [
		{ source: "Alice:thought:Quiet", displayed: "Alice(Quiet)", style: "thought", otherStyle: "default" },
		{ source: "Alice:Hello", displayed: 'Alice"Hello"', style: "default", otherStyle: "thought" },
	]) {
		it(`${style} wrapper style: [${source}] -> [${displayed}]`, () => {
			const view = openEditor(source)
			expect(view.dom.querySelector(".cm-line")?.textContent).toBe(displayed)
			expect(view.dom.querySelectorAll(`.dialogue-wrapper-${style}`)).toHaveLength(2)
			expect(view.dom.querySelectorAll(`.dialogue-wrapper-${otherStyle}`)).toHaveLength(0)
		})
	}
})

describe("wrapper edge case scenarios", () => {
	const formattedColonDialogue = "Alice:*Hi::there*"
	it(`formatted escaped colon: [${formattedColonDialogue}] -> [Alice"*Hi:there*"]`, () => {
		const source = formattedColonDialogue
		const view = openEditor(source, ["*Hi::there*"])
		expectWrappers(view, '"', '"')
		expect(view.dom.querySelector(".cm-line")?.textContent).toBe('Alice"*Hi:there*"')
		expect(view.state.doc.toString()).toBe(source)
	})

	const consecutiveDialogue = "Alice:Hello\nAlice:thought:*Quiet*"
	it(`consecutive lines: [${consecutiveDialogue.replace("\n", " | ")}] -> [Alice"Hello" | Alice(*Quiet*)]`, () => {
		const source = consecutiveDialogue
		const view = openEditor(source, ["*Quiet*"])
		const lines = view.dom.querySelectorAll(".cm-line")
		expect(lines).toHaveLength(2)
		expect(lines[0]?.textContent).toBe('Alice"Hello"')
		expect(lines[1]?.textContent).toBe("Alice(*Quiet*)")
		expect(view.dom.querySelectorAll(".dialogue-wrapper")).toHaveLength(4)
		expect(view.state.doc.toString()).toBe(source)
	})

	const selectedDialogue = "Ally:thought:Hello:: there"
	it(`selection and edit: [${selectedDialogue}] -> [Alice(Hello: there!)]`, () => {
		const source = selectedDialogue
		const view = openEditor(source)
		view.dispatch({ selection: { anchor: 2 } })
		expect(view.dom.querySelector(".dialogue-namespace-active")).not.toBeNull()
		expectWrappers(view, "(", ")")
		expect(view.state.doc.toString()).toBe(source)
		expect(view.state.selection.main.anchor).toBe(2)

		view.dispatch({
			changes: { from: source.length, insert: "!" },
			selection: { anchor: source.length + 1 },
		})
		expectWrappers(view, "(", ")")
		expect(view.state.doc.toString()).toBe(`${source}!`)
		expect(view.state.selection.main.anchor).toBe(source.length + 1)
		expect(view.dom.querySelector(".cm-line")?.textContent).toBe("Alice(Hello: there!)")
	})
})
