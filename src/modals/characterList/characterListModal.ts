import { Modal } from "obsidian";
import type { App } from "obsidian";
import type { Character } from "../../types";
import { CharacterListEditor } from "./characterListEditor";

export class CharacterListModal extends Modal {
	constructor(app: App, private characters: Character[]) { super(app) }

	onOpen(): void {
		this.setTitle("Characters")
		new CharacterListEditor(this.characters).render(this.contentEl)
	}
}
