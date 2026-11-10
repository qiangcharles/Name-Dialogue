import { EditorState, Transaction, type ChangeSpec } from "@codemirror/state"
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view"
import { isolateHistory } from "@codemirror/commands"
import {
	dialoguePreview,
	PointerGhost,
	setDialoguePreview,
	snapshotDialogue,
	type DialogueSnapshot,
} from "./dialoguePreview"

function moveDestination(state: EditorState, source: number, boundary: number): number | null {
	const document = state.doc
	const lastLine = document.line(document.lines)
	const lineCount = lastLine.text === "" && document.lines > 1 ? document.lines - 1 : document.lines
	if (source < 0 || source >= lineCount || boundary < 0 || boundary > document.lines) return null
	const destination = Math.min(boundary, lineCount)
	if (destination === source || destination === source + 1) return null
	return destination
}

export function moveDialogueLine(state: EditorState, source: number, boundary: number): ChangeSpec | null {
	const destination = moveDestination(state, source, boundary)
	if (destination === null) return null
	const document = state.doc
	const start = Math.min(source, destination)
	const end = Math.max(source, destination - 1)
	const firstLine = document.line(start + 1)
	const lastAffectedLine = document.line(end + 1)
	const lines: string[] = []
	for (let index = start; index <= end; index++) lines.push(document.line(index + 1).text)
	const removed = lines.splice(source - start, 1)[0]
	if (removed === undefined) return null
	lines.splice(destination - start - (source < destination ? 1 : 0), 0, removed)
	return { from: firstLine.from, to: lastAffectedLine.to, insert: lines.join(state.lineBreak) }
}

function isTextAtPoint(line: HTMLElement, x: number, y: number): boolean {
	const document = line.ownerDocument
	const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
	while (walker.nextNode()) {
		const range = document.createRange()
		range.selectNodeContents(walker.currentNode)
		for (const rectangle of Array.from(range.getClientRects())) {
			if (x >= rectangle.left && x <= rectangle.right && y >= rectangle.top && y <= rectangle.bottom) {
				return true
			}
		}
	}
	return false
}

class DialogueDrag {
	private startX = 0
	private startY = 0
	private source: number | null = null
	private originalDocument: EditorState["doc"] | null = null
	private boundary: number | null = null
	private dragging = false
	private snapshot: DialogueSnapshot | null = null
	private ghost: PointerGhost | null = null
	private scrollFrame: number | null = null
	private pointerX = 0
	private pointerY = 0

	constructor(private view: EditorView) {}

	start(event: MouseEvent): boolean {
		if (event.button !== 0 || this.view.state.readOnly || !this.view.state.facet(EditorView.editable)) return false
		const target = event.target
		const element = this.view.dom.ownerDocument.defaultView?.HTMLElement
		if (!element || !(target instanceof element)) return false
		const handle = target.closest(".dialogue-drag-handle")
		const line = handle?.closest<HTMLElement>(".cm-line.dialogue-box")
			?? (target.matches(".cm-line.dialogue-box") ? target : null)
		if (!line || !this.view.contentDOM.contains(line)) return false
		if (!handle && isTextAtPoint(target, event.clientX, event.clientY)) return false
		const position = this.view.posAtDOM(line)
		this.source = this.view.state.doc.lineAt(position).number - 1
		this.originalDocument = this.view.state.doc
		this.snapshot = snapshotDialogue(this.view, line, event.clientX, event.clientY)
		this.startX = event.clientX
		this.startY = event.clientY
		const document = this.view.dom.ownerDocument
		document.addEventListener("mousemove", this.move)
		document.addEventListener("mouseup", this.finish)
		document.addEventListener("keydown", this.keydown)
		document.defaultView?.addEventListener("blur", this.cancel)
		document.defaultView?.addEventListener("resize", this.resize)
		if (handle) {
			event.preventDefault()
			return true
		}
		return false
	}

	update(update: ViewUpdate): void {
		if (update.docChanged
			|| (this.source !== null && (update.state.readOnly || !update.state.facet(EditorView.editable)))) {
			this.end(false)
		}
	}

	destroy(): void {
		this.end(false)
	}

	private move = (event: MouseEvent): void => {
		if (this.source === null) return
		this.pointerX = event.clientX
		this.pointerY = event.clientY
		if (!this.dragging) {
			if (Math.hypot(event.clientX - this.startX, event.clientY - this.startY) < 5) return
			if (!this.snapshot) return
			this.dragging = true
			this.ghost = new PointerGhost(this.view, this.snapshot)
			this.showPreview(null)
		}
		event.preventDefault()
		this.ghost?.move(event.clientX, event.clientY)
		this.updateTarget()
		this.scheduleScroll()
	}

	private updateTarget(): void {
		if (!this.dragging || this.source === null) return
		const rectangle = this.view.scrollDOM.getBoundingClientRect()
		if (this.pointerX < rectangle.left || this.pointerX > rectangle.right
			|| this.pointerY < rectangle.top || this.pointerY > rectangle.bottom) {
			this.boundary = null
			this.showPreview(null)
			return
		}
		const preview = this.view.dom.querySelector<HTMLElement>(".dialogue-drop-preview")
		if (preview && this.boundary !== null) {
			const bounds = preview.getBoundingClientRect()
			if (bounds.height > 0 && this.pointerY >= bounds.top && this.pointerY <= bounds.bottom) return
		}
		const height = this.pointerY - this.view.documentTop
		const block = this.view.lineBlockAtHeight(height)
		const first = this.view.state.doc.lineAt(block.from)
		const last = this.view.state.doc.lineAt(block.to)
		if (first.number !== last.number) {
			this.boundary = null
			this.showPreview(null)
			return
		}
		const terminalNewline = first.number === this.view.state.doc.lines
			&& first.number > 1 && first.text === ""
		const after = !terminalNewline && height >= (block.top + block.bottom) / 2
		const boundary = first.number - (after ? 0 : 1)
		this.boundary = moveDestination(this.view.state, this.source, boundary) === null ? null : boundary
		this.showPreview(this.boundary)
	}

	private showPreview(boundary: number | null): void {
		if (this.source === null || !this.snapshot) return
		const current = this.view.state.field(dialoguePreview, false)
		if (current && current.boundary === boundary && current.snapshot === this.snapshot) return
		const document = this.view.state.doc
		const atEnd = boundary !== null && boundary >= document.lines
		const position = boundary === null ? 0 : atEnd ? document.length : document.line(boundary + 1).from
		this.view.dispatch({
			effects: setDialoguePreview.of({
				source: document.line(this.source + 1).from,
				boundary,
				position,
				side: atEnd ? 1 : -1,
				snapshot: this.snapshot,
			}),
			annotations: Transaction.addToHistory.of(false),
		})
		this.view.requestMeasure()
	}

	private scheduleScroll(): void {
		if (this.scrollFrame !== null) return
		const window = this.view.dom.ownerDocument.defaultView
		if (!window) return
		this.scrollFrame = window.requestAnimationFrame(() => {
			this.scrollFrame = null
			if (!this.dragging) return
			const rectangle = this.view.scrollDOM.getBoundingClientRect()
			if (this.pointerX < rectangle.left || this.pointerX > rectangle.right
				|| this.pointerY < rectangle.top || this.pointerY > rectangle.bottom) return
			const distance = this.pointerY < rectangle.top + 32 ? -12
				: this.pointerY > rectangle.bottom - 32 ? 12 : 0
			if (!distance) return
			const previous = this.view.scrollDOM.scrollTop
			this.view.scrollDOM.scrollTop += distance
			this.updateTarget()
			if (this.view.scrollDOM.scrollTop !== previous) this.scheduleScroll()
		})
	}

	private finish = (event: MouseEvent): void => {
		if (this.dragging) {
			this.pointerX = event.clientX
			this.pointerY = event.clientY
			this.updateTarget()
			const source = this.source
			const boundary = this.boundary
			if (source !== null && boundary !== null && this.view.state.doc === this.originalDocument) {
				const changes = moveDialogueLine(this.view.state, source, boundary)
				if (changes) this.view.dispatch({
					changes,
					effects: setDialoguePreview.of(null),
					annotations: [Transaction.userEvent.of("move"), isolateHistory.of("full")],
				})
			}
			event.preventDefault()
		}
		this.cancel()
	}

	private keydown = (event: KeyboardEvent): void => {
		if (event.key === "Escape") this.cancel()
	}

	private resize = (): void => {
		this.ghost?.measure()
		this.ghost?.move(this.pointerX, this.pointerY)
	}

	private cancel = (): void => { this.end(true) }

	private end(clearPreview: boolean): void {
		const document = this.view.dom.ownerDocument
		document.removeEventListener("mousemove", this.move)
		document.removeEventListener("mouseup", this.finish)
		document.removeEventListener("keydown", this.keydown)
		document.defaultView?.removeEventListener("blur", this.cancel)
		document.defaultView?.removeEventListener("resize", this.resize)
		if (this.scrollFrame !== null) document.defaultView?.cancelAnimationFrame(this.scrollFrame)
		this.scrollFrame = null
		this.ghost?.destroy()
		this.ghost = null
		this.source = null
		this.boundary = null
		this.originalDocument = null
		this.snapshot = null
		this.dragging = false
		if (clearPreview && this.view.state.field(dialoguePreview, false)) {
			this.view.dispatch({
				effects: setDialoguePreview.of(null),
				annotations: Transaction.addToHistory.of(false),
			})
		}
	}
}

export const dialogueDrag = ViewPlugin.fromClass(DialogueDrag, {
	eventHandlers: {
		mousedown(event) { return this.start(event) },
	},
})
