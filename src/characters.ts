import type { Character } from "./types";

export function normalizeName(label: string): string {
	return label.trim().toLocaleLowerCase()
}

export function validateCharacters(characters: readonly Character[]): string | null {

	const labels = characters
		.flatMap((character) => [character.name, ...character.aliases])
		.map(normalizeName)
		.filter(Boolean);

	if (new Set(labels).size !== labels.length) {
		return "Character names and aliases must be unique."
	}

	return null;
}
