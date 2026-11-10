# `Name Dialogue` Version 2.3
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

I wanted to make a plugin that makes dialogue pretty so that I can visually discern different lines from afar, and also apply fancy decorations to them.

### Latest changes
- Major refactor of a lot of decoration functions
- Fixed symbols escaping and adding additional wrappers in dialogue boxes
- Included `Vitest` and `jsdom` testing 
  - Added regression test for wrappers
- Added `data.json` updating, and large `data.json` schema update
  - Should support _n_-properties, and now the plugin only loads valid properties
- Made the decorated dialogue boxes **draggable**

Keep in mind: this is a very informal way of writing scripts. For those interested in writing proper formal scripts, I would look into formal screenplay templates. However, an export/conversion method from `name-dialogue` files to official scripts is in the planned functions section.

## Future schema updates
- Character information and other settings are stored in `data.json` in the plugin installation directory
- You should regularly update the plugin every so often; when a version is incompatible with `data.json` the migration modal will try to update it

## Current functionality
- Editing, creating, renaming, colouring characters are done through the [characterList](src/modals/characterList) modal
  - You're able to save your characters' names, set their aliases, set a colour, and rearrange them
  - Unsaved changes are indicated by the save button changing colour
  - Exiting with unsaved changes will prompt for confirmation
  - Resizes appropriately, according to viewport size
  - Lists characters as rows in a single column
- The namespace format is `[character]:[options]:[dialogue]`
  - `[options]` are... Well... Optional
    - Default `[options]` are `thought` and `right`
  - `[namespace]` encompasses `[character]:[options]:`
  - Write `::` in dialogue to display a colon
- You can edit decorator styling through the [decoratorCustomization](src/modals/decoratorCustomization) modal
  - You can edit the border thickness, opacity, etc. 
- In the editor, selecting the `[namespace]:` reveals the original text for editing, including any alias used in the source
- Dialogue wrappers (speech quotes and thought parentheses) are added by the plugin; wrapper characters typed in the dialogue remain visible as regular dialogue text on purpose, if you like to use those characters for emphasis
- Settings schema updates are optional and require a backup before migration; migration helper modal added to facilitate updates
- Draggable dialogue boxes
  - Hover over the decorator to reveal a handle, then click and drag
  - Currently only mouse implementation works

## Planned functionality
### Visual and syntax customization
- Fancier colours/style editing for characters
  - Gradients, different fonts, etc.
- Customize wrappers and dialogue text styles, including font weight and size
- Add "badge" decorator (little icons that might add context?)
- Add "subname" decorator
- 
### Medium priority
- [`./settings.ts`](src/settings.ts)
  - Editable namespace/parsing regex for dialogue
- [`./modals/characterList`](src/modals/characterList)
  - Make character entries (cards) reorderable by dragging
  - Want to restructure narrow screen handling with custom condensed layout rather than just wrapping
  - Perhaps have different layouts and option to represent characters by image chips/squares rather than just lines of text
- Add a proper playwright/screenwriter render and export
- Add additional namespace options
  - Loud, yelling dialogue box option 
  - Uneasy dialogue box where the line is wavy/shaky
