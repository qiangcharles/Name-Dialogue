import { normalizeName } from "./characters";
import type { Character } from "./types";

export interface ParsedDialogue {
	character: Character;
	namespaces: string[];
	rawDialogue: string;
	dialogue: string;
	dialogueFrom: number;
	dialogueTo: number;
	escapedColonOffsets: number[];
}

export function parseDialogueLine(line: string,
								  regex: RegExp,
								  characters: Character[]): ParsedDialogue | null {

	const match = regex.exec(line);
	const groups = match?.groups;


	if (!match ||
		match[0] !== line ||
		!groups?.name ||
		groups.dialogue === undefined) {
		return null;
	}

	const enteredName = normalizeName(groups.name);
	const character = characters.find((candidate) =>
		normalizeName(candidate.name) === enteredName
		|| candidate.aliases.some((alias) => normalizeName(alias) === enteredName)
	);

	if (!character) return null;

	const namespaces = (groups.namespaces ?? "")
		.split(":")
		.map(normalizeName)
		.filter(Boolean);
	const rawDialogueGroup = groups.dialogue;
	const prefixEnd = match.index + match[0].length - rawDialogueGroup.length;
	const leadingWhitespace = rawDialogueGroup.length - rawDialogueGroup.trimStart().length;
	const trailingWhitespace = rawDialogueGroup.length - rawDialogueGroup.trimEnd().length;
	const dialogueFrom = prefixEnd + leadingWhitespace;
	const dialogueTo = match.index + match[0].length - trailingWhitespace;
	const rawDialogue = line.slice(dialogueFrom, dialogueTo);
	const escapedColonOffsets: number[] = [];

	for (let index = 0; index < rawDialogue.length - 1; index++) {
		if (rawDialogue[index] === ":" && rawDialogue[index + 1] === ":") {
			escapedColonOffsets.push(dialogueFrom + index);
			index++;
		}
	}

	return {
		character,
		namespaces,
		rawDialogue,
		dialogue: rawDialogue.replace(/::/g, ":"), // colon escape
		dialogueFrom,
		dialogueTo,
		escapedColonOffsets,
	}
}
