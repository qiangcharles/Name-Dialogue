import type { MarkdownPostProcessorContext } from "obsidian"
import type { Character } from "./types"
import { parseSource, type ParsedDialogue } from "./dialogue"
import { resolveOptions, type DialogueOptions } from "./options"

// Render per section
export function getSourceLines(sectionElement: HTMLElement, context: MarkdownPostProcessorContext): string[] {
	const section = context.getSectionInfo(sectionElement)
	if (!section) return []
	return section.text.split(/\r?\n/).filter((line) => line.trim().length > 0)
}

function applyOptions(options: DialogueOptions, line: HTMLElement): void {
	if (options.nameMode) line.dataset.nameMode = options.nameMode
	if (options.alignment) line.classList.add(`dialogue-line-${options.alignment}`)
}

function stripWrapper(text: string, open: string, close: string): string {
	const trimmed = text.trim()
	return trimmed.startsWith(open) && trimmed.endsWith(close)
		? trimmed.slice(open.length, trimmed.length - close.length)
		: trimmed
}

function createNameplate(character: Character): HTMLSpanElement {
	const nameplate = document.createSpan()
	nameplate.className = "character-nameplate"
	nameplate.textContent = character.name
	return nameplate
}

function createDialogueText(dialogue: string, isThought: boolean): HTMLSpanElement {
	const text = document.createSpan()
	const style = isThought ? "thought" : "default"
	text.className = `dialogue-text text-style-${style}`

	const content = isThought
		? stripWrapper(dialogue, "(", ")")
		: stripWrapper(dialogue, "\"", "\"")
	text.textContent = isThought ? `(${content})` : `"${content}"`

	return text
}

function createDialogueBox(parsed: ParsedDialogue): HTMLDivElement {
	const isThought = parsed.options.includes("thought")
	const dialogueBox = document.createDiv()
	dialogueBox.className = `dialogue-box decorator-${isThought ? "thought" : "default"}`
	dialogueBox.setCssProps({ "--character-colour": parsed.character.colour })
	dialogueBox.append(
		createNameplate(parsed.character),
		createDialogueText(parsed.dialogue, isThought),
	)
	return dialogueBox
}

// to be used for reading mode later on
export function renderDialogue(sectionElement: HTMLElement,
							   context: MarkdownPostProcessorContext,
							   regex: RegExp,
							   characters: Character[]): void {
	const sourceLines = getSourceLines(sectionElement, context)
	if (sourceLines.length === 0) return

	const parsedLines = sourceLines.map((sourceLine) => ({
		sourceLine,
		parsed: parseSource(sourceLine, regex, characters),
	}))
	if (parsedLines.some(({ parsed }) => parsed === null)) return

	const output = createFragment()
	for (const { sourceLine, parsed } of parsedLines) {
		if (!parsed) continue
		const line = createDialogueBox(parsed)
		let invalidOption = false
		for (const option of parsed.options) {
			const resolved = resolveOptions([option])
			if (resolved) {
				applyOptions(resolved, line)
			} else {
				invalidOption = true
			}
		}
		if (invalidOption) {
			line.className = "invalid-namespace"
			line.textContent = sourceLine
		}
		output.appendChild(line)
	}

	sectionElement.replaceWith(output)
}
