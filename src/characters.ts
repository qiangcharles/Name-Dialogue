import type { Character } from "./types";

export function normalizeName(label: string): string {
	return label.trim().toLocaleLowerCase()
}

export function validateCharacters(characters: readonly Character[]): string | null {
	const labels = characters
		.flatMap((character) => [character.name, ...character.aliases])
		.map(normalizeName)
		.filter(Boolean);

	if (characters.some(({ colour }) => !validateHexColour(colour))) {
		return "Colours must be hex codes."
	}

	if (new Set(labels).size !== labels.length) {
		return "Character names and aliases must be unique."
	}

	return null;
}

export function validateHexColour(value: string): boolean {
	return /^#[\da-f]{6}$/i.test(value);
}
