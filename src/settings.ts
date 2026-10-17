import type { Character } from "./types";

export interface NameDialogueSettings {
	namespaceRegex: string;
	characters: Character[];
}

export const DEFAULT_SETTINGS: NameDialogueSettings = {
	namespaceRegex: String.raw`^(?<name>[^:]+):\s*(?<dialogue>.*)$`,
	characters: [],
};
