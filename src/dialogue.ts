import type { Character } from "./types";

interface ValidSourceGroups {
	name: string;
	namespaces?: string;
	dialogue: string;
}

interface SourceMatch {
	match: RegExpExecArray;
	groups: ValidSourceGroups;
}

interface SourceOffsets {
	namespaceStart: number;
	namespaceEnd: number;
	dialogueFrom: number;
	dialogueTo: number;
	rawDialogue: string;
}

export interface ParsedDialogue {
	character: Character;
	namespaces: string[];
	rawDialogue: string;
	dialogue: string;
	namespaceStart: number;
	namespaceEnd: number;
	dialogueFrom: number;
	dialogueTo: number;
	escapedColonOffsets: number[];
}

function matchSource(line: string, regex: RegExp): SourceMatch | null {
	const match = regex.exec(line);
	const groups = match?.groups;

	if (!match ||
		match[0] !== line ||
		!groups?.name ||
		groups.dialogue === undefined) {
		return null; // Source not matched.
	}

	return {
		match,
		groups: {
			name: groups.name,
			namespaces: groups.namespaces,
			dialogue: groups.dialogue,
		},
	};
}

function findCharacter(name: string, characters: Character[]): Character | null {
	const normalize = (value: string) => value.trim().toLocaleLowerCase();
	const enteredName = normalize(name);
	return characters.find((candidate) =>
		normalize(candidate.name) === enteredName
		|| candidate.aliases.some((alias) => normalize(alias) === enteredName)
	) ?? null;
}

function getNamespaces(namespaces: string | undefined): string[] {
	const normalize = (value: string) => value.trim().toLocaleLowerCase();
	return (namespaces ?? "")
		.split(":")
		.map(normalize)
		.filter(Boolean);
}

function getSourceOffsets(
	line: string,
	match: RegExpExecArray,
	groups: ValidSourceGroups,
): SourceOffsets {
	const rawDialogueGroup = groups.dialogue;
	const nameOffset = match[0].indexOf(groups.name);
	const namespaceStart = match.index + nameOffset;
	const prefixEnd = match.index + match[0].length - rawDialogueGroup.length;
	const leadingWhitespace = rawDialogueGroup.length - rawDialogueGroup.trimStart().length;
	const trailingWhitespace = rawDialogueGroup.length - rawDialogueGroup.trimEnd().length;
	const dialogueFrom = prefixEnd + leadingWhitespace;
	const dialogueTo = match.index + match[0].length - trailingWhitespace;
	const rawDialogue = line.slice(dialogueFrom, dialogueTo);
	return { namespaceStart, namespaceEnd: prefixEnd, dialogueFrom, dialogueTo, rawDialogue };
}

function getEscapedColonOffsets(rawDialogue: string, dialogueFrom: number): number[] {
	const escapedColonOffsets: number[] = [];
	for (let index = 0; index < rawDialogue.length - 1; index++) {
		if (rawDialogue[index] === ":" && rawDialogue[index + 1] === ":") {
			escapedColonOffsets.push(dialogueFrom + index);
			index++;
		}
	}
	return escapedColonOffsets;
}

export function parseSource(
	line: string,
	regex: RegExp,
	characters: Character[],
): ParsedDialogue | null {
	// Checks if source line is valid (i.e: matches regex pattern) and checks if the character is valid
	const sourceMatch = matchSource(line, regex);
	if (!sourceMatch) return null; // Break if not regex pattern
	const character = findCharacter(sourceMatch.groups.name, characters);
	if (!character) return null; // Break if the character is invalid

	// If regex pattern valid and character valid, then parse the line
	const namespaces = getNamespaces(sourceMatch.groups.namespaces);
	const offsets = getSourceOffsets(line, sourceMatch.match, sourceMatch.groups);
	const escapedColonOffsets = getEscapedColonOffsets(
		offsets.rawDialogue,
		offsets.dialogueFrom,
	);
	return {
		character,
		namespaces,
		rawDialogue: offsets.rawDialogue,
		dialogue: offsets.rawDialogue.replace(/::/g, ":"), // colon escape
		namespaceStart: offsets.namespaceStart,
		namespaceEnd: offsets.namespaceEnd,
		dialogueFrom: offsets.dialogueFrom,
		dialogueTo: offsets.dialogueTo,
		escapedColonOffsets,
	};
}
