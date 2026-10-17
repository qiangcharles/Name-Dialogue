# Name: Dialogue
Pre-release: 0.0.1

### A lightweight Obsidian plugin for writing manuscripts and screenplays.

**Name: Dialogue** is a barebones plugin that formats dialogue to be a bit more visually appealing.

## Motivation

I write my dialogue like:

```
Alice and Bob meet at a park.

Alice: "Hi, Bob."
Bob: "Hi, Alice."
Alice: "How are you?"
Bob: (happily) "I'm great! You?"
Alice (sighing): "I'm alright. Tough day."
etc...
```
It's all good and fine, but staring at two-tone pages of dialogue doesn't sit right with my ADHD brain. So, I just wanted to make it a bit more easier for me to parse through long sprawls of sometimes, seemingly monotonous dialogue.

## Proposed functionality

I want to have colour-coded dialogue boxes for the characters, and I want different styles of dialogue to be represented in different styles. For instance: regular dialogue looks like standard speech bubbles, with solid outlines and quotation marks around what they are saying. Thought bubbles can be italicized, and have a dotted or dashed outline.
Each character's colour can be changed easily with a settings menu.

It should be as simple as typing: `character_name:dialogue` and the plugin will automatically format it according to the configuration of the plugin. This namespace format will also be further iterated upon with the ability to change aspects of the dialogue box.
- Example: if you wanted to simulate a text conversation where the recipient and sender are on opposite sides of the screen (left and right respectively, for this example), you can format it as `sender_name:right:dialogue` and `contact_name:left:dialogue`

I hope to eventually ship **Name: Dialogue** as an all-in-one world-building and writing plugin for playwrights, screenwriters, comic writers, and creative writers alike.
Future implementation of rendering or previews in proper standardized formats is planned. Keep in mind that because I do not have formal training in these trades, I tend to use informal styles.

## Current implementation

Adding a barebones structure for the program. [main.ts](src/main.ts), [settings.ts](src/settings.ts), [types.ts](src/types.ts), and [styles.css](styles.css) should be as slim as possible.
Modals such as an initial way to view ([characterListModal.ts](src/modals/characterList/characterListModal.ts)) add and edit characters ([characterListEditor.ts](src/modals/characterList/characterListEditor.ts)) are done through [characterList](src/modals/characterList).
