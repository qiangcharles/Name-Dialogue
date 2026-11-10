import { StateEffect } from "@codemirror/state"
import { ViewPlugin } from "@codemirror/view"
import type { DecorationSet, EditorView, ViewUpdate } from "@codemirror/view"
import type { NameDialogueSettings } from "../settings"
import { buildDecorations } from "./decorationScanner"
import { dialogueDrag } from "./dialogueDrag"
import { dialoguePreview } from "./dialoguePreview"

const refreshDecorationsEffect = StateEffect.define<null>()
const activeViews = new Set<EditorView>()

export function refreshDecorations(): void {
	for (const view of [...activeViews]) {
		view.dispatch({ effects: refreshDecorationsEffect.of(null) })
	}
}

export function createView(getSettings: () => NameDialogueSettings) {
	const decorations = ViewPlugin.fromClass(
		class {
			decorations!: DecorationSet
			private view: EditorView
			private updateDecorations(view: EditorView): void {
				const built = buildDecorations(view, getSettings())
				view.contentDOM.classList.toggle("dialogue-content", built.hasDialogue)
				this.decorations = built.decorations
			}
			constructor(view: EditorView) {
				this.view = view
				activeViews.add(view)
				this.updateDecorations(view)
			}
			update(update: ViewUpdate): void {
				const settingsChanged = update.transactions.some((transaction) =>
					transaction.reconfigured
					|| transaction.effects.some((effect) => effect.is(refreshDecorationsEffect)),
				)
				if (update.docChanged
					|| update.viewportChanged
					|| update.selectionSet
					|| update.geometryChanged
					|| settingsChanged
				) { this.updateDecorations(update.view) }
			}
			destroy(): void {
				activeViews.delete(this.view)
				this.view.contentDOM.classList.remove("dialogue-content")
			}
		},
		{ decorations: (plugin) => plugin.decorations })
	return [dialoguePreview, dialogueDrag, decorations]
}
