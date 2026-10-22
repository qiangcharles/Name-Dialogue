# Name: Dialogue
### Version 2.0.0
`name-dialogue` is a barebones Obsidian plugin that formats dialogue to be a bit more visually appealing. It gets its name from the way I write my scripts. For example:
```
Alice and Bob meet at a park.

Alice: "Hi, Bob."
Bob: "Hi, Alice."
Alice: "How are you?"
Bob: (happily) "I'm great! You?"
Alice (sighing): "I'm alright. Tough day."
etc...
```

Keep in mind: this is a very informal way of writing scripts. For those interested in writing proper formal scripts, I would look into formal screenplay templates. However, an export/conversion method from `name-dialogue` files to official scripts is in the planned functions section.

## Current functionality
- Editing, creating, renaming, colouring characters are done through the [characterList](src/modals/characterList) modal
  - You're able to save your characters' names, set their aliases, set a colour, and rearrange them
  - Editor window prompts for confirmation when exiting; doesn't immediately save on edit
  - Resizes appropriately, according to viewport size
  - Lists characters in a row
- The namespace format regex parses the following:
  - `[name]:[options]:[dialogue]`
  - The default options are: `thought` and `right`
- Dialogue wrappers (speech quotes and thought parentheses) are added by the plugin; wrapper characters typed in the dialogue remain visible as regular dialogue text on purpose, if you like to use those characters for emphasis

## Planned functionality
- 
- [`./settings.ts`](src/settings.ts)
  - Editable namespace/parsing regex for dialogue
- [`./modals/characterList`](src/modals/characterList)
  - Needs visual indicator when a save is made, or when there are unchanged settings
  - Make character entries (cards) reorderable by dragging
  - Want to restructure narrow screen handling with custom condensed layout rather than just wrapping
  - Perhaps have different layouts and option to represent characters by image chips/squares rather than just lines of text
