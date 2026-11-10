import type { Character } from "./types"

export const DEFAULT_CHARACTER_COLOUR = "#676767"

function validateNames(names: readonly string[]): boolean {
	return new Set(names).size === names.length
}

function validateAliases(characterAliases: readonly string[]): boolean {
	return new Set(characterAliases).size === characterAliases.length
}

export function validateHexColour(value: string): boolean {
	return /^#[\da-f]{6}$/i.test(value)
}

export function validateCharacters(characters: readonly Character[]): string | null {
	const normalizedNames = characters
		.map(({ name }) => name.trim().toLocaleLowerCase())
		.filter(Boolean)
	const characterAliases = characters
		.flatMap((character) => [character.name, ...character.aliases])
		.map((nameOrAlias) => nameOrAlias.trim().toLocaleLowerCase())
		.filter(Boolean)

	if (characters.some(({ colour }) => !validateHexColour(colour))) {
		return "Colours must be hex codes."
	}

	if (!validateNames(normalizedNames) || !validateAliases(characterAliases)) {
		return "Character names and aliases must be unique."
	}
	return null
}
