import { describe, expect, it } from "vitest"
import { validateCharacters } from "../src/characters"
import { parseSource } from "../src/dialogue"
import { DEFAULT_SETTINGS } from "../src/settings/settingsData"

const characters = [
	{ id: 1, name: "Alice", aliases: ["Ally"], colour: "#123456" },
	{ id: 2, name: "Bob", aliases: ["Bobby"], colour: "#654321" },
]

describe("character validation", () => {
	it("unique names and aliases: [Alice, Ally, Bob, Bobby] -> [valid]", () => {
		expect(validateCharacters(characters)).toBeNull()
	})

	it("name and alias collision: [Alice, ally, Ally] -> [duplicate error]", () => {
		const collision = [characters[0]!, { id: 3, name: "ally", aliases: [], colour: "#123456" }]
		expect(validateCharacters(collision)).toBe("Character names and aliases must be unique.")
	})

	it("invalid colour: [Alice, invalid] -> [colour error]", () => {
		expect(validateCharacters([{ id: 1, name: "Alice", aliases: [], colour: "invalid" }]))
			.toBe("Colours must be hex codes.")
	})
})

describe("dialogue source ranges", () => {
	it("trimmed dialogue and colon: [Ally:thought:  Hello:: there  ] -> [Hello: there]", () => {
		const source = "Ally:thought:  Hello:: there  "
		const parsed = parseSource(source, new RegExp(DEFAULT_SETTINGS.namespaceRegex), characters)
		expect(parsed?.dialogue).toBe("Hello: there")
		expect(parsed?.dialogueStart).toBe(source.indexOf("Hello"))
		expect(parsed?.dialogueEnd).toBe(source.length - 2)
		expect(parsed?.escapedColonOffsets).toEqual([source.indexOf("::")])
		expect(parsed?.namespaceEnd).toBe(source.indexOf("  Hello"))
	})
})
