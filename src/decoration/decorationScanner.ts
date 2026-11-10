import { RangeSetBuilder } from "@codemirror/state"
import { Decoration, EditorView } from "@codemirror/view"
import type { DecorationSet } from "@codemirror/view"
import { parseSource, type ParsedDialogue } from "../dialogue"
import { resolveOptions } from "../options"
import type { NameDialogueSettings } from "../settings"
import { addDecorations } from "./decorationBuilder"

interface BuiltDecorations {
	decorations: DecorationSet
	hasDialogue: boolean
}

function namespaceSelected(view: EditorView,
						   lineStart: number,
						   parsed: ParsedDialogue): boolean {
	const namespaceStart = lineStart + parsed.namespaceStart
	const namespaceEnd = lineStart + parsed.namespaceEnd

	return view.state.selection.ranges.some(({ from: start, to: end }) =>
		start === end
			? start >= namespaceStart && start <= namespaceEnd
			: start < namespaceEnd && end > namespaceStart,
	)
}

export function buildDecorations(view: EditorView, settings: NameDialogueSettings): BuiltDecorations {
	const builder = new RangeSetBuilder<Decoration>()
	const regex = new RegExp(settings.namespaceRegex)
	let hasDialogue = false
	const canDrag = !view.state.readOnly && view.state.facet(EditorView.editable)

	for (const visibleRange of view.visibleRanges) {
		let position = visibleRange.from

		while (position <= visibleRange.to) {
			const line = view.state.doc.lineAt(position)
			const parsed = parseSource(line.text, regex, settings.characters)

			if (parsed) {
				const options = resolveOptions(parsed.options)
				if (options) {
					hasDialogue = true
					addDecorations(
						builder,
						line.from,
						parsed,
						options,
						namespaceSelected(view, line.from, parsed),
						settings,
						canDrag,
					)
				} else {
					builder.add(
						line.from,
						line.from,
						Decoration.line({ class: "invalid-namespace" }))
				}
			}
			if (line.to >= visibleRange.to) break
			position = line.to + 1
		}
	}
	return { decorations: builder.finish(), hasDialogue }
}
