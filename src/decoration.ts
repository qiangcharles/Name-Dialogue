// eslint-disable-next-line import/no-extraneous-dependencies -- Obsidian supplies CodeMirror and esbuild externalizes it.
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, ViewPlugin, WidgetType } from "@codemirror/view";
import type { DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";
import { parseDialogueLine, type ParsedDialogue } from "./dialogue";
import type { NameDialogueSettings } from "./settings";

interface NamespaceOptions {
	thought: boolean;
	alignment?: "left" | "right";
	nameMode?: "full";
}

class InlineTextWidget extends WidgetType {
	constructor(
		private readonly text: string,
		private readonly className: string,
	) { super() }

	eq(other: InlineTextWidget): boolean {
		return this.text === other.text && this.className === other.className;
	}

	toDOM(): HTMLElement {
		const element = createSpan();
		element.className = this.className;
		element.textContent = this.text;
		return element;
	}

	ignoreEvent(): boolean { return false }
}

function resolveNamespaces(namespaces: readonly string[]): NamespaceOptions | null {
	const options: NamespaceOptions = { thought: false };

	for (const namespace of namespaces) {
		switch (namespace) {
			case "thought":
				options.thought = true;
				break;
			case "full":
				options.nameMode = namespace;
				break;
			case "left":
			case "right":
				options.alignment = namespace;
				break;
			default:
				return null;
		}
	}

	return options;
}

function addDialogueTextDecorations(builder: RangeSetBuilder<Decoration>,
									lineFrom: number,
									parsed: ParsedDialogue,
									isThought: boolean): void {
	const dialogueFrom = lineFrom + parsed.dialogueFrom;
	const dialogueTo = lineFrom + parsed.dialogueTo;
	const open = isThought ? "(" : "\"";
	const close = isThought ? ")" : "\"";
	const hasExplicitWrapper =
		parsed.rawDialogue.length >= open.length + close.length
		&& parsed.rawDialogue.startsWith(open)
		&& parsed.rawDialogue.endsWith(close);
	const bodyFrom = dialogueFrom + (hasExplicitWrapper ? open.length : 0);
	const bodyTo = dialogueTo - (hasExplicitWrapper ? close.length : 0);

	if (!hasExplicitWrapper && dialogueFrom < dialogueTo) {
		builder.add(
			dialogueFrom,
			dialogueFrom,
			Decoration.widget({
				widget: new InlineTextWidget(open, "dialogue-wrapper"),
				side: -1,
			}),
		);
	} else if (hasExplicitWrapper) {
		builder.add(
			dialogueFrom,
			bodyFrom,
			Decoration.mark({ class: "dialogue-wrapper" }),
		);
	}

	let contentFrom = bodyFrom;
	for (const escapedColonOffset of parsed.escapedColonOffsets) {
		const escapedColonFrom = lineFrom + escapedColonOffset;
		const escapedColonTo = escapedColonFrom + 2;
		if (escapedColonFrom < contentFrom || escapedColonTo > bodyTo) continue;

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

	if (contentFrom < bodyTo) {
		builder.add(
			contentFrom,
			bodyTo,
			Decoration.mark({ class: "dialogue-text" }),
		);
	}

	if (!hasExplicitWrapper && dialogueFrom < dialogueTo) {
		builder.add(
			dialogueTo,
			dialogueTo,
			Decoration.widget({
				widget: new InlineTextWidget(close, "dialogue-wrapper"),
				side: 1,
			}),
		);
	} else if (hasExplicitWrapper) {
		builder.add(
			bodyTo,
			dialogueTo,
			Decoration.mark({ class: "dialogue-wrapper" }),
		);
	}
}

function addDialogueDecorations(
	builder: RangeSetBuilder<Decoration>,
	lineFrom: number,
	parsed: ParsedDialogue,
	options: NamespaceOptions,
): void {
	const lineClasses = [
		"dialogue-box",
		options.thought ? "dialogue-style-thought" : "dialogue-style-speech",
	];
	if (options.alignment) lineClasses.push(`dialogue-line-${options.alignment}`);

	const attributes: Record<string, string> = {
		style: `--character-colour: ${parsed.character.colour};`,
		"data-dialogue-type": options.thought ? "thought" : "speech",
	};
	if (options.nameMode) attributes["data-name-mode"] = options.nameMode;

	builder.add(
		lineFrom,
		lineFrom,
		Decoration.line({ class: lineClasses.join(" "), attributes }),
	);
	builder.add(
		lineFrom,
		lineFrom + parsed.dialogueFrom,
		Decoration.replace({
			widget: new InlineTextWidget(parsed.character.name, "character-label"),
		}),
	);

	addDialogueTextDecorations(builder, lineFrom, parsed, options.thought);
}

function buildDecorations(view: EditorView, settings: NameDialogueSettings): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const regex = new RegExp(settings.namespaceRegex);

	for (const visibleRange of view.visibleRanges) {
		let position = visibleRange.from;

		while (position <= visibleRange.to) {
			const line = view.state.doc.lineAt(position);
			const parsed = parseDialogueLine(line.text, regex, settings.characters);

			if (parsed) {
				const options = resolveNamespaces(parsed.namespaces);
				if (options) {
					addDialogueDecorations(builder, line.from, parsed, options);
				} else {
					builder.add(
						line.from,
						line.from,
						Decoration.line({ class: "dialogue-invalid" }),
					);
				}
			}

			if (line.to >= visibleRange.to) break;
			position = line.to + 1;
		}
	}

	return builder.finish();
}

export function createDialogueExtension(getSettings: () => NameDialogueSettings) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildDecorations(view, getSettings());
			}

			update(update: ViewUpdate): void {
				if (
					update.docChanged
					|| update.viewportChanged
					|| update.selectionSet
					|| update.geometryChanged
				) {
					this.decorations = buildDecorations(update.view, getSettings());
				}
			}
		},
		{
			decorations: (plugin) => plugin.decorations,
		},
	);
}
