import { StateEffect, StateField } from "@codemirror/state"
import { Decoration, EditorView, WidgetType } from "@codemirror/view"
import type { DecorationSet } from "@codemirror/view"

export interface DialogueSnapshot {
	template: HTMLElement
	width: number
	height: number
	scaleX: number
	scaleY: number
	offsetX: number
	offsetY: number
}

interface DialoguePreview {
	source: number
	boundary: number | null
	position: number
	side: -1 | 1
	snapshot: DialogueSnapshot
}

export const setDialoguePreview = StateEffect.define<DialoguePreview | null>()

function copyVisibleContent(source: Node, target: Node): void {
	const document = target.ownerDocument
	if (!document) return
	if (source.nodeType === Node.TEXT_NODE) {
		target.appendChild(document.createTextNode(source.textContent ?? ""))
		return
	}
	if (source.nodeType !== Node.ELEMENT_NODE) return
	const element = source as Element
	if (element.matches(".dialogue-drag-handle, .cm-widgetBuffer")
		|| ["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG", "IMG"].includes(element.tagName)) return
	if (element.tagName === "BR") {
		target.createEl("br")
		return
	}
	const copy = target.createSpan({ cls: element.getAttribute("class") ?? "" })
	const window = document.defaultView
	if (window) {
		const style = window.getComputedStyle(element)
		copy.style.fontStyle = style.fontStyle
		copy.style.fontWeight = style.fontWeight
		copy.style.textDecorationLine = style.textDecorationLine
		copy.style.color = style.color
	}
	for (const child of Array.from(source.childNodes)) copyVisibleContent(child, copy)
}

export function snapshotDialogue(view: EditorView, line: HTMLElement, x: number, y: number): DialogueSnapshot {
	const document = view.dom.ownerDocument
	const bounds = line.getBoundingClientRect()
	const scaleX = view.scaleX || 1
	const scaleY = view.scaleY || 1
	const width = bounds.width > 0 ? bounds.width / scaleX : Math.max(view.contentDOM.clientWidth, 1)
	const height = bounds.height > 0 ? bounds.height / scaleY : Math.max(view.defaultLineHeight, 1)
	const template = line.cloneNode(false) as HTMLElement
	for (const attribute of Array.from(template.attributes)) template.removeAttribute(attribute.name)
	template.className = line.className
	template.classList.remove("dialogue-drag-source")
	template.classList.add("dialogue-phantom-box")
	template.setAttribute("aria-hidden", "true")
	template.style.width = `${width}px`
	template.style.height = `${height}px`
	const window = document.defaultView
	if (window) {
		const style = window.getComputedStyle(line)
		for (const property of [
			"--character-colour", "--decorator-vertical-gap", "--decorator-border-thickness",
			"--decorator-fill-opacity", "--decorator-box-radius", "--background-primary",
			"--background-modifier-border", "--text-normal", "--text-muted",
		]) {
			const value = style.getPropertyValue(property)
			if (value) template.style.setProperty(property, value)
		}
		template.style.fontFamily = style.fontFamily
		template.style.fontSize = style.fontSize
		template.style.lineHeight = style.lineHeight
	}
	for (const child of Array.from(line.childNodes)) copyVisibleContent(child, template)
	return {
		template, width, height, scaleX, scaleY,
		offsetX: x - bounds.left,
		offsetY: y - bounds.top,
	}
}

class DropPreview extends WidgetType {
	constructor(private snapshot: DialogueSnapshot) { super() }

	eq(other: DropPreview): boolean { return this.snapshot === other.snapshot }

	get estimatedHeight(): number { return this.snapshot.height * this.snapshot.scaleY }

	toDOM(view: EditorView): HTMLElement {
		const container = view.contentDOM.cloneNode(false) as HTMLElement
		for (const attribute of Array.from(container.attributes)) container.removeAttribute(attribute.name)
		container.className = "dialogue-drop-preview"
		container.setAttribute("aria-hidden", "true")
		container.style.height = `${this.snapshot.height}px`
		container.appendChild(this.snapshot.template.cloneNode(true))
		return container
	}
}

function previewDecorations(preview: DialoguePreview | null): DecorationSet {
	if (!preview) return Decoration.none
	const decorations = [Decoration.line({ class: "dialogue-drag-source" }).range(preview.source)]
	if (preview.boundary !== null) {
		decorations.push(Decoration.widget({
			block: true,
			side: preview.side,
			widget: new DropPreview(preview.snapshot),
		}).range(preview.position))
	}
	return Decoration.set(decorations, true)
}

export const dialoguePreview = StateField.define<DialoguePreview | null>({
	create: () => null,
	update(value, transaction) {
		if (transaction.docChanged || transaction.state.readOnly || !transaction.state.facet(EditorView.editable)) {
			return null
		}
		for (const effect of transaction.effects) {
			if (effect.is(setDialoguePreview)) value = effect.value
		}
		return value
	},
	provide: (field) => EditorView.decorations.from(field, previewDecorations),
})

export class PointerGhost {
	private element: HTMLElement
	private originX = 0
	private originY = 0
	private parentScaleX = 1
	private parentScaleY = 1

	constructor(private view: EditorView, private snapshot: DialogueSnapshot) {
		const document = view.dom.ownerDocument
		this.element = document.body.createDiv({ cls: "cm-editor dialogue-pointer-ghost" })
		this.element.setAttribute("aria-hidden", "true")
		this.element.style.width = `${snapshot.width}px`
		this.element.style.height = `${snapshot.height}px`
		this.element.style.transform = `scale(${snapshot.scaleX}, ${snapshot.scaleY})`
		const content = this.element.createDiv({ cls: "cm-content" })
		content.appendChild(snapshot.template.cloneNode(true))
		this.measure()
	}

	measure(): void {
		this.element.style.removeProperty("left")
		this.element.style.removeProperty("top")
		const bounds = this.element.getBoundingClientRect()
		this.originX = bounds.left
		this.originY = bounds.top
		this.parentScaleX = bounds.width > 0 ? bounds.width / (this.snapshot.width * this.snapshot.scaleX) : 1
		this.parentScaleY = bounds.height > 0 ? bounds.height / (this.snapshot.height * this.snapshot.scaleY) : 1
	}

	move(x: number, y: number): void {
		this.element.style.left = `${(x - this.snapshot.offsetX - this.originX) / this.parentScaleX}px`
		this.element.style.top = `${(y - this.snapshot.offsetY - this.originY) / this.parentScaleY}px`
	}

	destroy(): void {
		this.element.remove()
	}
}