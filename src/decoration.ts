// eslint-disable-next-line import/no-extraneous-dependencies -- Obsidian supplies CodeMirror and esbuild externalizes it.
import { RangeSetBuilder } from "@codemirror/state";
// eslint-disable-next-line import/no-extraneous-dependencies -- Obsidian supplies CodeMirror and esbuild externalizes it.
import { Decoration, ViewPlugin, WidgetType } from "@codemirror/view";
import type { DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";
import { parseSource, type ParsedDialogue } from "./dialogue";
import type { NameDialogueSettings } from "./settings";

interface NamespaceOptions {
	thought: boolean;
	alignment?: "right";
	nameMode?: "full";
}

class InlineTextWidget extends WidgetType { // CodeMirror
	constructor(private readonly text: string,
				private readonly className: string ) { super() }

	eq(other: InlineTextWidget): boolean {
		return this.text === other.text
			&& this.className === other.className;
	}

	toDOM(): HTMLElement {
		const element = createSpan();
		element.className = this.className;
		element.textContent = this.text;
		return element;
	}

	ignoreEvent(): boolean { return false }
}

function getNamespaces(namespaces: readonly string[]): NamespaceOptions | null {
	const options: NamespaceOptions = { thought: false };

	for (const namespace of namespaces) {
		switch (namespace) {
			case "thought":
				options.thought = true;
				break;
			case "full":
				options.nameMode = namespace;
				break;
			case "right":
				options.alignment = namespace;
				break;
			default:
				return null;
		}
	}

	return options;
}

function hasWrappers(parsed: ParsedDialogue): boolean { return parsed.dialogueFrom < parsed.dialogueTo }

function isNameSelected(view: EditorView,
						lineFrom: number,
						parsed: ParsedDialogue): boolean {
	const nameFrom = lineFrom + parsed.nameFrom;
	const nameTo = lineFrom + parsed.nameTo;

	return view.state.selection.ranges.some(({ from, to }) =>
		from === to
			? from >= nameFrom && from <= nameTo
			: from < nameTo && to > nameFrom,
	);
}

function decorateText(builder: RangeSetBuilder<Decoration>,
					  lineFrom: number,
					  parsed: ParsedDialogue): void {
	const dialogueFrom = lineFrom + parsed.dialogueFrom;
	const dialogueTo = lineFrom + parsed.dialogueTo;
	let contentFrom = dialogueFrom;
	for (const escapedColonOffset of parsed.escapedColonOffsets) {
		const escapedColonFrom = lineFrom + escapedColonOffset;
		const escapedColonTo = escapedColonFrom + 2;
		if (escapedColonFrom < contentFrom || escapedColonTo > dialogueTo) continue;

		if (contentFrom < escapedColonFrom) {
			builder.add(
				contentFrom,
				escapedColonFrom,
				Decoration.mark({ class: "dialogue-text" }),
			);
		}
		builder.add(
			escapedColonFrom,
			escapedColonTo,
			Decoration.replace({
				widget: new InlineTextWidget(":", "dialogue-text"),
			}),
		);
		contentFrom = escapedColonTo;
	}

	if (contentFrom < dialogueTo) {
		builder.add(
			contentFrom,
			dialogueTo,
			Decoration.mark({ class: "dialogue-text" }),
		);
	}
}

function addNameplate(builder: RangeSetBuilder<Decoration>,
						 lineFrom: number,
						 parsed: ParsedDialogue,
						 isNameActive: boolean): void {
	if (!isNameActive) {
		builder.add(
			lineFrom,
			lineFrom + parsed.dialogueFrom,
			Decoration.replace({
				widget: new InlineTextWidget(parsed.character.name, "character-nameplate"),
			}),
		);
		return;
	}

	const nameFrom = lineFrom + parsed.nameFrom;
	const nameTo = lineFrom + parsed.nameTo;
	const prefixTo = lineFrom + parsed.dialogueFrom;
	const hiddenText = Decoration.mark({ class: "dialogue-source-hidden" });

	if (lineFrom < nameFrom) {
		builder.add(lineFrom, nameFrom, hiddenText);
	}
	builder.add(
		nameFrom,
		nameTo,
		Decoration.mark({ class: "character-nameplate character-nameplate-active" }),
	);
	if (nameTo < prefixTo) {
		builder.add(nameTo, prefixTo, hiddenText);
	}
}

function addDecorations(builder: RangeSetBuilder<Decoration>,
						lineFrom: number,
						parsed: ParsedDialogue,
						options: NamespaceOptions,
						isNameActive: boolean): void {
	const showWrappers = hasWrappers(parsed);
	const lineClasses = ["dialogue-box",
		options.thought ? "dialogue-style-thought" : "dialogue-style-speech"];
	if (showWrappers) lineClasses.push("dialogue-has-content");
	lineClasses.push(`dialogue-line-${options.alignment ?? "left"}`);
	if (isNameActive) lineClasses.push("dialogue-name-active");

	const attributes: Record<string, string> = {
		style: `--character-colour: ${parsed.character.colour};`,
		"data-dialogue-type": options.thought ? "thought" : "speech" };
	if (options.nameMode) attributes["data-name-mode"] = options.nameMode;

	builder.add(
		lineFrom,
		lineFrom,
		Decoration.line({ class: lineClasses.join(" "), attributes }));
	addNameplate(builder, lineFrom, parsed, isNameActive);
	decorateText(builder, lineFrom, parsed);
}

function buildDecorations(view: EditorView, settings: NameDialogueSettings): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const regex = new RegExp(settings.namespaceRegex);

	for (const visibleRange of view.visibleRanges) {
		let position = visibleRange.from;

		while (position <= visibleRange.to) {
			const line = view.state.doc.lineAt(position);
			const parsed = parseSource(line.text, regex, settings.characters);

			if (parsed) {
				const options = getNamespaces(parsed.namespaces);
				if (options) {
					addDecorations(
						builder,
						line.from,
						parsed,
						options,
						isNameSelected(view, line.from, parsed),
					);
				} else {
					builder.add(
						line.from,
						line.from,
						Decoration.line({ class: "invalid-namespace" }))}}
			if (line.to >= visibleRange.to) break;
			position = line.to + 1 }}
	return builder.finish();
}

export function createView(getSettings: () => NameDialogueSettings) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			constructor(view: EditorView) { this.decorations = buildDecorations(view, getSettings()) }
			update(update: ViewUpdate): void {
				if (update.docChanged
					|| update.viewportChanged
					|| update.selectionSet
					|| update.geometryChanged
				) { this.decorations = buildDecorations(update.view, getSettings()) }}},
		{ decorations: (plugin) => plugin.decorations });
}
