import type { RangeSetBuilder } from "@codemirror/state"
import { Decoration, WidgetType } from "@codemirror/view"
import type { ParsedDialogue } from "../dialogue"
import type { DialogueOptions } from "../options"
import type { NameDialogueSettings } from "../settings"
import { getDecoratorProperties } from "../decorators"

export class InlineTextWidget extends WidgetType {
	constructor(private readonly text: string,
				private readonly className: string) { super() }

	eq(other: InlineTextWidget): boolean {
		return this.text === other.text
			&& this.className === other.className
	}

	toDOM(): HTMLElement {
		const element = createSpan()
		element.className = this.className
		element.textContent = this.text
		return element
	}

	ignoreEvent(): boolean { return false }
}

class DialogueDragHandle extends WidgetType {
	eq(): boolean { return true }

	toDOM(): HTMLElement {
		const element = createSpan()
		element.className = "dialogue-drag-handle"
		element.setAttribute("title", "Drag dialogue")
		element.setAttribute("aria-hidden", "true")
		return element
	}

	ignoreEvent(): boolean { return false }
}

function decorateText(builder: RangeSetBuilder<Decoration>,
					  lineStart: number,
					  parsed: ParsedDialogue): void {
	const dialogueStart = lineStart + parsed.dialogueStart
	const dialogueEnd = lineStart + parsed.dialogueEnd
	if (dialogueStart >= dialogueEnd) return
	const isThought = parsed.options.includes("thought")
	const style = isThought ? "thought" : "default"
	const textStyle = `text-style-${style}`
	const wrapperStyle = `dialogue-wrapper dialogue-wrapper-${style}`
	const chunks: { start: number; end: number; isEscapedColon: boolean }[] = []
	let contentStart = dialogueStart
	for (const escapedColonOffset of parsed.escapedColonOffsets) {
		const escapedColonStart = lineStart + escapedColonOffset
		const escapedColonEnd = escapedColonStart + 2
		if (escapedColonStart < contentStart || escapedColonEnd > dialogueEnd) continue

		if (contentStart < escapedColonStart) {
			chunks.push({ start: contentStart, end: escapedColonStart, isEscapedColon: false })
		}
		chunks.push({ start: escapedColonStart, end: escapedColonEnd, isEscapedColon: true })
		contentStart = escapedColonEnd
	}

	if (contentStart < dialogueEnd) {
		chunks.push({ start: contentStart, end: dialogueEnd, isEscapedColon: false })
	}

	builder.add(dialogueStart, dialogueStart, Decoration.widget({
		widget: new InlineTextWidget(isThought ? "(" : '"', `${wrapperStyle} dialogue-wrapper-open`),
		side: -1,
	}))
	for (const chunk of chunks) {
		const className = `dialogue-text ${textStyle}`
		builder.add(
			chunk.start,
			chunk.end,
			chunk.isEscapedColon
				? Decoration.replace({
					widget: new InlineTextWidget(":", className),
				})
				: Decoration.mark({ class: className }),
		)
	}
	builder.add(dialogueEnd, dialogueEnd, Decoration.widget({
		widget: new InlineTextWidget(isThought ? ")" : '"', `${wrapperStyle} dialogue-wrapper-close`),
		side: 1,
	}))
}

function addNameplate(builder: RangeSetBuilder<Decoration>,
					  lineStart: number,
					  parsed: ParsedDialogue,
					  isNamespaceActive: boolean): void {
	if (!isNamespaceActive) {
		builder.add(
			lineStart,
			lineStart + parsed.dialogueStart,
			Decoration.replace({
				widget: new InlineTextWidget(parsed.character.name, "character-nameplate"),
			}),
		)
		return
	}

	const namespaceStart = lineStart + parsed.namespaceStart
	const namespaceEnd = lineStart + parsed.namespaceEnd
	builder.add(
		namespaceStart,
		namespaceEnd,
		Decoration.mark({ class: "character-nameplate character-nameplate-active" }),
	)
}

export function addDecorations(builder: RangeSetBuilder<Decoration>,
							   lineStart: number,
							   parsed: ParsedDialogue,
							   options: DialogueOptions,
							   isNamespaceActive: boolean,
							   settings: NameDialogueSettings,
							   canDrag: boolean): void {
	const boxStyle = options.thought
		? settings.decorators.thought
		: settings.decorators.default
	const lineClasses = ["dialogue-box",
		options.thought ? "decorator-thought" : "decorator-default"]
	lineClasses.push(`dialogue-line-${options.alignment ?? "left"}`)
	if (isNamespaceActive) lineClasses.push("dialogue-namespace-active")

	const attributes: Record<string, string> = {
		style: Object.entries({
			"--character-colour": parsed.character.colour,
			...getDecoratorProperties(settings.decorators.verticalGap, boxStyle),
		}).map(([name, value]) => `${name}: ${value};`).join(" "),
		"data-dialogue-type": options.thought ? "thought" : "speech"
	}
	if (options.nameMode) attributes["data-name-mode"] = options.nameMode

	builder.add(
		lineStart,
		lineStart,
		Decoration.line({ class: lineClasses.join(" "), attributes }))
	if (canDrag) {
		builder.add(lineStart, lineStart, Decoration.widget({
			widget: new DialogueDragHandle(),
			side: -1,
		}))
	}
	addNameplate(builder, lineStart, parsed, isNamespaceActive)
	decorateText(builder, lineStart, parsed)
}
