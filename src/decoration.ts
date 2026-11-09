// eslint-disable-next-line import/no-extraneous-dependencies -- Obsidian supplies CodeMirror and esbuild externalizes it.
import { RangeSetBuilder, StateEffect } from "@codemirror/state";
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

interface BuiltDecorations {
	decorations: DecorationSet;
	hasDialogue: boolean;
}

const refreshDecorationsEffect = StateEffect.define<null>();
const activeViews = new Set<EditorView>();

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

export function refreshDialogueDecorations(): void {
	for (const view of [...activeViews]) {
		view.dispatch({ effects: refreshDecorationsEffect.of(null) });
	}
}

function namespaceSelected(view: EditorView,
						   lineFrom: number,
						   parsed: ParsedDialogue): boolean {
	const namespaceStart = lineFrom + parsed.namespaceStart;
	const namespaceEnd = lineFrom + parsed.namespaceEnd;

	return view.state.selection.ranges.some(({ from, to }) =>
		from === to
			? from >= namespaceStart && from <= namespaceEnd
			: from < namespaceEnd && to > namespaceStart,
	);
}

function decorateText(builder: RangeSetBuilder<Decoration>,
					  lineFrom: number,
					  parsed: ParsedDialogue): void {
	const dialogueFrom = lineFrom + parsed.dialogueFrom;
	const dialogueTo = lineFrom + parsed.dialogueTo;
	const isThought = parsed.namespaces.includes("thought");
	const textStyle = isThought ? "dialogue-style-thought" : "dialogue-style-default";
	const chunks: { from: number; to: number; isEscapedColon: boolean }[] = [];
	let contentFrom = dialogueFrom;
	for (const escapedColonOffset of parsed.escapedColonOffsets) {
		const escapedColonFrom = lineFrom + escapedColonOffset;
		const escapedColonTo = escapedColonFrom + 2;
		if (escapedColonFrom < contentFrom || escapedColonTo > dialogueTo) continue;

		if (contentFrom < escapedColonFrom) {
			chunks.push({ from: contentFrom, to: escapedColonFrom, isEscapedColon: false });
		}
		chunks.push({ from: escapedColonFrom, to: escapedColonTo, isEscapedColon: true });
		contentFrom = escapedColonTo;
	}

	if (contentFrom < dialogueTo) {
		chunks.push({ from: contentFrom, to: dialogueTo, isEscapedColon: false });
	}

	chunks.forEach((chunk, index) => {
		const classes = ["dialogue-text", textStyle];
		if (index === 0) classes.push("dialogue-text-start");
		if (index === chunks.length - 1) classes.push("dialogue-text-end");
		const className = classes.join(" ");

		builder.add(
			chunk.from,
			chunk.to,
			chunk.isEscapedColon
				? Decoration.replace({
					widget: new InlineTextWidget(":", className),
				})
				: Decoration.mark({ class: className }),
		);
	});
}

function addNameplate(builder: RangeSetBuilder<Decoration>,
						 lineFrom: number,
						 parsed: ParsedDialogue,
						 isNamespaceActive: boolean): void {
	if (!isNamespaceActive) {
		builder.add(
			lineFrom,
			lineFrom + parsed.dialogueFrom,
			Decoration.replace({
				widget: new InlineTextWidget(parsed.character.name, "character-nameplate"),
			}),
		);
		return;
	}

	const namespaceStart = lineFrom + parsed.namespaceStart;
	const namespaceEnd = lineFrom + parsed.namespaceEnd;
	builder.add(
		namespaceStart,
		namespaceEnd,
		Decoration.mark({ class: "character-nameplate character-nameplate-active" }),
	);
}

function addDecorations(builder: RangeSetBuilder<Decoration>,
						lineFrom: number,
						parsed: ParsedDialogue,
						options: NamespaceOptions,
						isNamespaceActive: boolean,
						settings: NameDialogueSettings): void {
	const boxStyle = options.thought
		? settings.decorators.thought
		: settings.decorators.default;
	const lineClasses = ["dialogue-box",
		options.thought ? "decorator-thought" : "decorator-default"];
	lineClasses.push(`dialogue-line-${options.alignment ?? "left"}`);
	if (isNamespaceActive) lineClasses.push("dialogue-namespace-active");

	const attributes: Record<string, string> = {
		style: `--character-colour: ${parsed.character.colour}; `
			+ `--decorator-vertical-gap: ${settings.decorators.verticalGap}rem; `
			+ `--decorator-border-thickness: ${boxStyle.borderThickness}px; `
			+ `--decorator-fill-opacity: ${boxStyle.fillOpacity}%; `
			+ `--decorator-box-radius: ${boxStyle.cornerRadius}px;`,
		"data-dialogue-type": options.thought ? "thought" : "speech" };
	if (options.nameMode) attributes["data-name-mode"] = options.nameMode;

	builder.add(
		lineFrom,
		lineFrom,
		Decoration.line({ class: lineClasses.join(" "), attributes }));
	addNameplate(builder, lineFrom, parsed, isNamespaceActive);
	decorateText(builder, lineFrom, parsed);
}

function buildDecorations(view: EditorView, settings: NameDialogueSettings): BuiltDecorations {
	const builder = new RangeSetBuilder<Decoration>();
	const regex = new RegExp(settings.namespaceRegex);
	let hasDialogue = false;

	for (const visibleRange of view.visibleRanges) {
		let position = visibleRange.from;

		while (position <= visibleRange.to) {
			const line = view.state.doc.lineAt(position);
			const parsed = parseSource(line.text, regex, settings.characters);

			if (parsed) {
				const options = getNamespaces(parsed.namespaces);
				if (options) {
					hasDialogue = true;
					addDecorations(
						builder,
						line.from,
						parsed,
						options,
						namespaceSelected(view, line.from, parsed),
						settings,
					);
				} else {
					builder.add(
						line.from,
						line.from,
						Decoration.line({ class: "invalid-namespace" }))}}
			if (line.to >= visibleRange.to) break;
			position = line.to + 1 }}
	return { decorations: builder.finish(), hasDialogue };
}

export function createView(getSettings: () => NameDialogueSettings) {
	return ViewPlugin.fromClass(
		class {
			decorations!: DecorationSet;
			private view: EditorView;
			private updateDecorations(view: EditorView): void {
				const built = buildDecorations(view, getSettings());
				view.contentDOM.classList.toggle("dialogue-content", built.hasDialogue);
				this.decorations = built.decorations;
			}
			constructor(view: EditorView) {
				this.view = view;
				activeViews.add(view);
				this.updateDecorations(view);
			}
			update(update: ViewUpdate): void {
				const settingsChanged = update.transactions.some((transaction) =>
					transaction.effects.some((effect) => effect.is(refreshDecorationsEffect)),
				);
				if (update.docChanged
					|| update.viewportChanged
					|| update.selectionSet
					|| update.geometryChanged
					|| settingsChanged
				) { this.updateDecorations(update.view) }
			}
			destroy(): void {
				activeViews.delete(this.view);
				this.view.contentDOM.classList.remove("dialogue-content");
			}
		},
		{ decorations: (plugin) => plugin.decorations });
}
