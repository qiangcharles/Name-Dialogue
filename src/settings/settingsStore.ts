import { normalizeDecorators, type DecoratorProperty, type DecoratorSettings } from "../decorators"
import type { NameDialogueSettings } from "./settingsData"
import type { Character } from "../types"
import type { SettingsSection } from "./settingsPersistence"

export class SettingsStore {
	private savedSettings: NameDialogueSettings
	private currentSettings: NameDialogueSettings
	private saveQueue: Promise<void> = Promise.resolve()
	private decoratorRevision = 0

	constructor(
		settings: NameDialogueSettings,
		private saveData: (settings: NameDialogueSettings,
						   section: SettingsSection,
						   edited?: DecoratorProperty) => Promise<void>,
		private onChange: (settings: NameDialogueSettings) => void,
	) {
		this.savedSettings = settings
		this.currentSettings = settings
	}

	private publish(settings: NameDialogueSettings): void {
		this.currentSettings = settings
		this.onChange(settings)
	}

	private enqueue(save: () => Promise<void>): Promise<void> {
		const result = this.saveQueue.then(save)
		this.saveQueue = result.then(() => undefined, () => undefined)
		return result
	}

	saveCharacters(characters: Character[], beforeSave?: () => void): Promise<void> {
		const savedCharacters = characters.map((character) =>
			({ ...character, aliases: [...character.aliases] }))
		return this.enqueue(async () => {
			beforeSave?.()
			const updated = { ...this.savedSettings, characters: savedCharacters }
			await this.saveData(updated, "characters")
			this.savedSettings = updated
			this.publish({ ...this.currentSettings, characters: savedCharacters })
		})
	}

	saveDecorators(decorators: DecoratorSettings, edited?: DecoratorProperty): Promise<void> {
		const normalized = normalizeDecorators(decorators)
		const updatedDecorators = {
			...decorators,
			...normalized,
			default: { ...decorators.default, ...normalized.default },
			thought: { ...decorators.thought, ...normalized.thought },
		}
		const revision = ++this.decoratorRevision
		this.publish({ ...this.currentSettings, decorators: updatedDecorators })
		return this.enqueue(async () => {
			const updated = { ...this.savedSettings, decorators: updatedDecorators }
			try {
				await this.saveData(updated, "decorators", edited)
			} catch (error) {
				if (revision === this.decoratorRevision) {
					this.publish({ ...this.currentSettings, decorators: this.savedSettings.decorators })
				}
				throw error
			}
			this.savedSettings = updated
		})
	}
}
