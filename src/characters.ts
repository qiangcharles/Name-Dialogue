import type { Character } from "./types";

function validateNames(names: readonly string[]): boolean {
	return new Set(names).size === names.length;
}

function validateAliases(validCharacter: readonly string[]): boolean {
	return new Set(validCharacter).size === validCharacter.length;
}

export function validateHexColour(value: string): boolean {
	return /^#[\da-f]{6}$/i.test(value);
}

export function validateCharacter(characters: readonly Character[]): string | null {
	const normalizedNames = characters
		.map(({ name }) => name.trim().toLocaleLowerCase())
		.filter(Boolean);
	const validCharacter = characters
		.flatMap((character) => [character.name, ...character.aliases])
		.map((nameOrAlias) => nameOrAlias.trim().toLocaleLowerCase())
		.filter(Boolean);

	if (characters.some(({ colour }) =>
		!validateHexColour(colour))) { return "Colours must be hex codes." }
	if (!validateNames(normalizedNames) || !validateAliases(validCharacter)) {
		return "Character names and aliases must be unique.";
	}
	return null;
}
