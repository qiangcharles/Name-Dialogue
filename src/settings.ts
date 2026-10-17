import type { Character } from "./types";

export interface NameDialogueSettings {
	speakerLineRegex: string;
	characters: Character[];
}

export const DEFAULT_SETTINGS: NameDialogueSettings = {
	speakerLineRegex: String.raw`^(?<name>[^:]+):\s*(?<dialogue>.*)$`,
	characters: [],
};
