import type { MarkdownPostProcessorContext } from "obsidian";
import type { Character } from "./types";
import { parseSource, type ParsedDialogue } from "./dialogue";

// Render per section
export function getSourceLines(sectionEl: HTMLElement, context: MarkdownPostProcessorContext): string[] {
	const section = context.getSectionInfo(sectionEl);
	if (!section) return [];
	return section.text.split(/\r?\n/).filter((line) => line.trim().length > 0);
}

function applyNamespace(namespace: string, line: HTMLElement): boolean {
	switch (namespace) {
		case "thought":
			return true;
		case "full":
			line.dataset.nameMode = namespace;
			return true;
		case "right":
			line.classList.add(`dialogue-line-${namespace}`);
			return true;
		default:
			return false;
	}
}

function stripWrapper(text: string, open: string, close: string): string {
	const trimmed = text.trim();
	return trimmed.startsWith(open) && trimmed.endsWith(close)
		? trimmed.slice(open.length, trimmed.length - close.length)
		: trimmed;
}

function createNameplate(character: Character): HTMLSpanElement {
	const nameplate = document.createSpan();
	nameplate.className = "character-nameplate";
	nameplate.textContent = character.name;
	return nameplate;
}

function createDialogueText(dialogue: string, isThought: boolean): HTMLSpanElement {
	const text = document.createSpan();
	text.className = "dialogue-text";

	const content = isThought
		? stripWrapper(dialogue, "(", ")")
		: stripWrapper(dialogue, "\"", "\"");
	text.textContent = isThought ? `(${content})` : `"${content}"`;

	return text;
}

function createDialogueBox(parsed: ParsedDialogue): HTMLDivElement {
	const isThought = parsed.namespaces.includes("thought");
	const dialogueBox = document.createDiv();
	dialogueBox.className = `dialogue-box dialogue-style-${isThought ? "thought" : "speech"}`;
	dialogueBox.style.setProperty("--character-colour", parsed.character.colour);
	dialogueBox.append(
		createNameplate(parsed.character),
		createDialogueText(parsed.dialogue, isThought),
	);
	return dialogueBox;
}

export function renderDialogue(sectionEl: HTMLElement,
							   context: MarkdownPostProcessorContext,
							   regex: RegExp,
							   characters: Character[]): void {
	const sourceLines = getSourceLines(sectionEl, context);
	if (sourceLines.length === 0) return;

	const parsedLines = sourceLines.map((sourceLine) => ({
		sourceLine,
		parsed: parseSource(sourceLine, regex, characters),
	}));
	if (parsedLines.some(({ parsed }) => parsed === null)) return;

	const output = createFragment();
	for (const { sourceLine, parsed } of parsedLines) {
		if (!parsed) continue;
		const line = createDialogueBox(parsed);
		let invalidNamespace = false;
		for (const namespace of parsed.namespaces) { if (!applyNamespace(namespace, line)) invalidNamespace = true }
		if (invalidNamespace) { line.className = "invalid-namespace"; line.textContent = sourceLine }
		output.appendChild(line);
	}

	sectionEl.replaceWith(output);
}
