export interface DialogueOptions {
	thought: boolean
	alignment?: "right"
	nameMode?: "full"
}

export function parseOptions(source: string | undefined): string[] {
	return (source ?? "")
		.split(":")
		.map((option) => option.trim().toLocaleLowerCase())
		.filter(Boolean)
}

export function resolveOptions(options: readonly string[]): DialogueOptions | null {
	const resolved: DialogueOptions = { thought: false }

	for (const option of options) {
		switch (option) {
			case "thought":
				resolved.thought = true
				break
			case "full":
				resolved.nameMode = option
				break
			case "right":
				resolved.alignment = option
				break
			default:
				return null
		}
	}

	return resolved
}
