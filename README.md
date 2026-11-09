# Name Dialogue
### Version 2.1
`name-dialogue` is a barebones Obsidian plugin that formats dialogue to be a bit more visually appealing. It gets its name from the way I write my scripts. For example:

### Latest changes
- Refactored a lot of terms for standardized terms, and added them in [contributing.md](contributing.md):
  - `namespace` refers to the first part of any `Name Dialogue` line (i.e: namespace:dialogue); it encompasses `character` and `options` before `dialogue`
    - `character` refers to a subject that is added in the options of the plugin
    - `options` refers to any keywords or terms in the namespace after the character
  - `wrapper` refers to any surrounding plaintext symbols (i.e: "quotation marks for spoken dialogue" or (parentheses in the case of thought dialogue))
  - `dialogue` strictly refers to the plaintext after the namespaces
  - `decorator` refers to the visual elements that aren't dialogue
  - Anything else is just vibes until I need to clearly define them
- Added a new setting modal: [decoratorCustomization](src/modals/decoratorCustomization)
  - Allows user to edit some visual aspects of the default `dialogue` and `thought` decorator styles
- Finally added vertical spacing between back-to-back dialogue lines

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
  - Unsaved changes are indicated by the save button changing colour
  - Exiting with unsaved changes will prompt for confirmation
  - Resizes appropriately, according to viewport size
  - Lists characters as rows in a single column
- The namespace format regex parses the following:
  - `[name]:[options]:[dialogue]`
    - `[name]:[options]:` can be generally thought of as `[namespace]:`
  - The default options are: `thought` and `right`
- You can edit decorator styling through the [decoratorCustomization](src/modals/decoratorCustomization) modal
  - You can edit the border thickness, opacity, etc. 
- In the editor, selecting the `[namespace]:` reveals the original text for editing, including any alias used in the source
- Dialogue wrappers (speech quotes and thought parentheses) are added by the plugin; wrapper characters typed in the dialogue remain visible as regular dialogue text on purpose, if you like to use those characters for emphasis

## Planned functionality
### High priority
- Fancier colours/style editing for characters
  - Gradients, different fonts, etc.
- Add an additional inline escape, that allows you to write another dialogue box in the same line
- Add narrator namespace or some sort of decorator-less-with-styled-dialogue line format (I'm thinking this is for non-speech bubble text in comics, like onomatopoeia or whispers/fleeting thoughts)
- Add a font weight and a font size namespace
- Add "badge" decorator (little icons that might add context?)
- Add "subname" decorator

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
