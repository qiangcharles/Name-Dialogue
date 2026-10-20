# Name: Dialogue
A barebones Obsidian plugin that formats dialogue to be a bit more visually appealing.
### Pre-release: 0.3.0-0

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
This README outlines the original proposed functionality, functions that are currently implemented and operable, as well as functionality I intend on implementing sooner rather than later.

## Proposed functionality

I want to have colour-coded dialogue boxes for the characters, and I want different styles of dialogue to be represented in different styles. For instance: regular dialogue looks like standard speech bubbles, with solid outlines and quotation marks around what they are saying. Thought bubbles can be italicized, and have a dotted or dashed outline.
Each character's colour can be changed easily with a settings menu.

It should be as simple as typing: `character_name:dialogue` and the plugin will automatically format it according to the configuration of the plugin. This namespace format will also be further iterated upon with the ability to change aspects of the dialogue box.
- Example: if you wanted to simulate a text conversation where the recipient and sender are on opposite sides of the screen (left and right respectively, for this example), you can format it as `sender_name:right:dialogue` and `contact_name:left:dialogue`

I hope to eventually ship **Name: Dialogue** as an all-in-one world-building and writing plugin for playwrights, screenwriters, comic writers, and creative writers alike.
CodeMirror editor rendering is implemented; Reading View rendering and previews in standardized formats remain future work. Keep in mind that because I do not have formal training in these trades, I tend to use informal styles.

## Current functionality
- Editing, creating, renaming, colouring characters are done through the [characterList](src/modals/characterList) modal.
  - You're able to save your characters' names, set their aliases, set a colour, and rearrange them
  - Editor window prompts for confirmation when exiting; doesn't immediately save on edit
  - Resizes appropriately, according to viewport size
  - Lists characters in a row
- The namespace format regex parses the following:
  - `[name]:[options]:[dialogue]`
  - The default options are: `thought`, `left`, `right`

## Planned functionality
- [`./settings.ts`](src/settings.ts)
  - Editable namespace/parsing regex for dialogue; by default it will be `name:extras:dialogue`~~, and type of speech will be primarily denoted by the wrappers `"..."` and `(...)` for regular speech and thought, respectively~~
    - As of 0.4, it is no longer the case that wrappers will denote speech type; it is handled purely through namespace appends
- [`./modals/characterList`](src/modals/characterList)
  - Add `import` function
  - Rearrange UI so that its more compact; make it scrollable
  - Needs visual indicator when a save is made, or when there are unchanged settings
  - Make character entries (cards) reorderable by dragging
  - Want to restructure narrow screen handling with custom condensed layout rather than just wrapping
  - Perhaps have different layouts and option to represent characters by image chips/squares rather than just lines of text
