import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";
import type { DecoratorBoxSettings, DecoratorSettings } from "../../settings";

type DialogueDecorator = "default" | "thought";

export class DecoratorCustomizationModal extends Modal {
	private selectedDecorator: DialogueDecorator = "default";
	private previewOptions = new Map<DialogueDecorator, HTMLDivElement>();
	private controls!: HTMLDivElement;

	constructor(
		app: App,
		private getDecorators: () => DecoratorSettings,
		private saveDecorators: (decorators: DecoratorSettings) => Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("decorator-customization-modal");
		this.setTitle("Customize dialogue decorators");
		this.renderPreviews();

		this.controls = this.contentEl.createDiv({ cls: "decorator-controls" });
		this.renderDecoratorControls();
	}

	private renderPreviews(): void {
		const previews = this.contentEl.createDiv({ cls: "decorator-previews" });

		for (const decorator of ["default", "thought"] as const) {
			const option = previews.createDiv({
				cls: "decorator-option",
				attr: {
					role: "button",
					tabindex: "0",
					"aria-pressed": String(decorator === this.selectedDecorator),
				},
			});
			option.setAttribute("aria-label", `Customize ${decorator} decorator`);
			option.addEventListener("click", () => this.selectDecorator(decorator));
			option.addEventListener("keydown", (event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				this.selectDecorator(decorator);
			});

			const box = option.createDiv({
				cls: `dialogue-box decorator-${decorator} dialogue-has-content`,
			});
			const nameplate = box.createSpan({
				cls: "character-nameplate",
				text: "Example",
			});
			const dialogue = box.createSpan({
				cls: `dialogue-text dialogue-style-${decorator}`,
				text: decorator === "thought" ? "Thought" : "Dialogue",
			});
			box.append(nameplate, dialogue);
			this.previewOptions.set(decorator, option);
		}

		this.updateDecoratorPreviews();
	}

	private selectDecorator(decorator: DialogueDecorator): void {
		this.selectedDecorator = decorator;
		this.updatePreviewSelection();
		this.renderDecoratorControls();
	}

	private updatePreviewSelection(): void {
		for (const [decorator, option] of this.previewOptions) {
			option.setAttribute("aria-pressed", String(decorator === this.selectedDecorator));
		}
	}

	private updateDecoratorPreviews(): void {
		const decorators = this.getDecorators();
		for (const decorator of ["default", "thought"] as const) {
			const box = this.previewOptions.get(decorator)?.querySelector<HTMLElement>(".dialogue-box");
			if (!box) continue;

			const style = decorator === "thought" ? decorators.thought : decorators.default;
			box.setCssProps({
				"--character-colour": "var(--interactive-accent)",
				"--decorator-vertical-gap": `${decorators.verticalGap}rem`,
				"--decorator-border-thickness": `${style.borderThickness}px`,
				"--decorator-fill-opacity": `${style.fillOpacity}%`,
				"--decorator-box-radius": `${style.cornerRadius}px`,
			});
		}
	}

	private updateDecoratorSettings(changes: Partial<DecoratorBoxSettings>): void {
		const decorators = this.getDecorators();
		const key = this.selectedDecorator;
		const updatedDecorators = {
			...decorators,
			[key]: { ...decorators[key], ...changes },
		};
		void this.saveDecorators(updatedDecorators);
		this.renderDecoratorControls();
		this.updateDecoratorPreviews();
	}

	private renderDecoratorControls(): void {
		this.controls.empty();

		new Setting(this.controls)
			.setName("Vertical gap")
			.setDesc("Space before each dialogue bubble.")
			.addSlider((slider) => slider
				.setLimits(0, 4, 0.1)
				.setValue(this.getDecorators().verticalGap)
				.setInstant(false)
				.setDisplayFormat((value) => `${value.toFixed(1)} rem`)
				.onChange((value) => {
					void this.saveDecorators({ ...this.getDecorators(), verticalGap: value });
					this.updateDecoratorPreviews();
				}));

		new Setting(this.controls)
			.setName("Namespace option")
			.setDesc("Namespace keyword that selects this decorator.")
			.addText((text) => text
				.setValue(this.selectedDecorator === "thought" ? "thought" : "none")
				.setDisabled(true));
		this.addBoxStyleSlider(
			"Border thickness",
			"Thickness of the bubble border.",
			0, 8, 0.5,
			(value) => `${value.toFixed(1)} px`,
			"borderThickness",
		);
		this.addBoxStyleSlider(
			"Background fill opacity",
			"Opacity of the character-colour background fill.",
			0, 100, 1,
			(value) => `${value}%`,
			"fillOpacity",
		);
		this.addBoxStyleSlider(
			"Corner roundness",
			"Radius of the bubble corners.",
			0, 48, 1,
			(value) => `${value} px`,
			"cornerRadius",
		);
	}

	private addBoxStyleSlider(
		name: string,
		desc: string,
		min: number,
		max: number,
		step: number,
		format: (value: number) => string,
		key: keyof DecoratorBoxSettings,
	): void {
		const decorators = this.getDecorators();
		const boxStyle = decorators[this.selectedDecorator];
		new Setting(this.controls)
			.setName(name)
			.setDesc(desc)
			.addSlider((slider) => slider
				.setLimits(min, max, step)
				.setValue(boxStyle[key])
				.setInstant(false)
				.setDisplayFormat(format)
				.onChange((value) => this.updateDecoratorSettings({ [key]: value })));
	}
}
