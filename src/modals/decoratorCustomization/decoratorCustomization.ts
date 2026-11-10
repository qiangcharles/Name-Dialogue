import { Modal, Notice, Setting } from "obsidian"
import type { App } from "obsidian"
import {
	getDecoratorProperties,
	type DecoratorBoxSettings,
	type DecoratorProperty,
	type DecoratorSettings,
} from "../../decorators"

type DialogueDecorator = "default" | "thought"

export class DecoratorCustomizationModal extends Modal {
	private selectedDecorator: DialogueDecorator = "default"
	private previewChoices = new Map<DialogueDecorator, HTMLDivElement>()
	private controls!: HTMLDivElement
	private warning!: HTMLParagraphElement

	constructor(
		app: App,
		private getDecorators: () => DecoratorSettings,
		private saveDecorators: (decorators: DecoratorSettings, edited: DecoratorProperty) => Promise<void>,
		private getWarnings: () => string[],
	) {
		super(app)
	}

	onOpen(): void {
		this.modalEl.addClass("decorator-customization-modal")
		this.setTitle("Customize dialogue decorators")
		this.warning = this.contentEl.createEl("p")
		this.updateWarnings()
		this.renderPreviews()

		this.controls = this.contentEl.createDiv({ cls: "decorator-controls" })
		this.renderDecoratorControls()
	}

	private updateWarnings(): void {
		const warnings = this.getWarnings()
		this.warning.hidden = warnings.length === 0
		this.warning.setText(`Saved values using defaults: ${warnings.join(", ")}. `
			+ "Select a control to correct a value, or repair invalid structures in data.json.")
	}

	private renderPreviews(): void {
		const previews = this.contentEl.createDiv({ cls: "decorator-previews" })

		for (const decorator of ["default", "thought"] as const) {
			const choice = previews.createDiv({
				cls: "decorator-choice",
				attr: {
					role: "button",
					tabindex: "0",
					"aria-pressed": String(decorator === this.selectedDecorator),
				},
			})
			choice.setAttribute("aria-label", `Customize ${decorator} decorator`)
			choice.addEventListener("click", () => this.selectDecorator(decorator))
			choice.addEventListener("keydown", (event) => {
				if (event.key !== "Enter" && event.key !== " ") return
				event.preventDefault()
				this.selectDecorator(decorator)
			})

			const box = choice.createDiv({
				cls: `dialogue-box decorator-${decorator} dialogue-has-content`,
			})
			const nameplate = box.createSpan({
				cls: "character-nameplate",
				text: "Example",
			})
			const dialogue = box.createSpan({
				cls: `dialogue-text text-style-${decorator}`,
				text: decorator === "thought" ? "Thought" : "Dialogue",
			})
			box.append(nameplate, dialogue)
			this.previewChoices.set(decorator, choice)
		}

		this.updateDecoratorPreviews()
	}

	private selectDecorator(decorator: DialogueDecorator): void {
		this.selectedDecorator = decorator
		this.updatePreviewSelection()
		this.renderDecoratorControls()
	}

	private updatePreviewSelection(): void {
		for (const [decorator, choice] of this.previewChoices) {
			choice.setAttribute("aria-pressed", String(decorator === this.selectedDecorator))
		}
	}

	private updateDecoratorPreviews(): void {
		const decorators = this.getDecorators()
		for (const decorator of ["default", "thought"] as const) {
			const box = this.previewChoices.get(decorator)?.querySelector<HTMLElement>(".dialogue-box")
			if (!box) continue

			const style = decorator === "thought" ? decorators.thought : decorators.default
			box.setCssProps({
				"--character-colour": "var(--interactive-accent)",
				...getDecoratorProperties(decorators.verticalGap, style),
			})
		}
	}

	private updateDecoratorSettings(key: keyof DecoratorBoxSettings, value: number): void {
		const decorators = this.getDecorators()
		const decorator = this.selectedDecorator
		const updatedDecorators = {
			...decorators,
			[decorator]: { ...decorators[decorator], [key]: value },
		}
		void this.persistDecorators(updatedDecorators, `${decorator}.${key}`)
		this.renderDecoratorControls()
		this.updateDecoratorPreviews()
	}

	private renderDecoratorControls(): void {
		this.controls.empty()

		new Setting(this.controls)
			.setName("Vertical gap")
			.setDesc("Space before each dialogue box.")
			.addSlider((slider) => slider
				.setLimits(0, 4, 0.1)
				.setValue(this.getDecorators().verticalGap)
				.setInstant(false)
				.setDisplayFormat((value) => `${value.toFixed(1)} rem`)
				.onChange((value) => {
					void this.persistDecorators({ ...this.getDecorators(), verticalGap: value }, "verticalGap")
					this.updateDecoratorPreviews()
				}))

		new Setting(this.controls)
			.setName("Namespace option")
			.setDesc("Namespace keyword that selects this decorator.")
			.addText((text) => text
				.setValue(this.selectedDecorator === "thought" ? "thought" : "none")
				.setDisabled(true))
		this.addBoxStyleSlider(
			"Border thickness",
			"Thickness of the dialogue box border.",
			0, 8, 0.5,
			(value) => `${value.toFixed(1)} px`,
			"borderThickness",
		)
		this.addBoxStyleSlider(
			"Background fill opacity",
			"Opacity of the character-colour background fill.",
			0, 100, 1,
			(value) => `${value}%`,
			"fillOpacity",
		)
		this.addBoxStyleSlider(
			"Corner roundness",
			"Radius of the dialogue box corners.",
			0, 48, 1,
			(value) => `${value} px`,
			"cornerRadius",
		)
	}

	private async persistDecorators(decorators: DecoratorSettings, edited: DecoratorProperty): Promise<void> {
		try {
			await this.saveDecorators(decorators, edited)
			this.updateWarnings()
		} catch (error) {
			new Notice(error instanceof Error ? error.message : "Unable to save dialogue decorators.")
			console.error("[name-dialogue] Unable to save dialogue decorators.", error)
			this.renderDecoratorControls()
			this.updateDecoratorPreviews()
		}
	}

	private addBoxStyleSlider(
		name: string,
		description: string,
		minimum: number,
		maximum: number,
		step: number,
		format: (value: number) => string,
		key: keyof DecoratorBoxSettings,
	): void {
		const decorators = this.getDecorators()
		const boxStyle = decorators[this.selectedDecorator]
		new Setting(this.controls)
			.setName(name)
			.setDesc(description)
			.addSlider((slider) => slider
				.setLimits(minimum, maximum, step)
				.setValue(boxStyle[key])
				.setInstant(false)
				.setDisplayFormat(format)
				.onChange((value) => this.updateDecoratorSettings(key, value)))
	}
}
