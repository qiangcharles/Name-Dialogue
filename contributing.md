# Contributing to Name Dialogue

Thank you for considering contributing to my little project! All types of contributions are encouraged, and I look forward to seeing what you might be able to provide to help make this plugin better!
I highly recommend reviewing the planned functionality section in README.md, or visiting the issues page to see whether your contribution or idea is already planned or being worked on.

Until I see a need for it, I'm going to keep `contributing.md` very sweet and short:
- I assume you've read README.md
- Feel free to ask questions or open issues

## Style guide

Use camelCase for TypeScript identifiers and dashed names for CSS. Prefer short, complete words without abbreviations

- `character`: a saved subject identified by a name or alias
- `namespace`: the complete prefix before the dialogue, including the character, any options, and the final colon
- `option`: a keyword in the namespace after the character, such as `thought` or `right`
- `dialogue`: the text after the namespace
- `wrapper`: a visual symbol added around the dialogue, such as quotation marks or parentheses. Symbols typed in the dialogue remain part of the text
- `decorator`: the visual treatment of a dialogue box, such as its border, fill, and shape. The built-in decorators are `default` and `thought`
- `text style`: formatting applied to the dialogue text, such as italic thought text

Example:
```plaintext
Alice:Hi!
Bob:thought:right:Who is she talking to?
```
`Alice` is the `character`, `Hi!` is the `dialogue`
`Bob` is the `character`, `thought` is the first option, `right` is the second option, and `Bob:thought:right:` encompasses the `namespace`
`Who is she talking to?` is the `dialogue`

The saved `namespaceRegex` uses named groups `name`, `namespaces`, and `dialogue`. The `namespaces` group contains the options; its name is retained for compatibility with existing settings

## Testing

To test code, I use `Vitest` and `jsdom`. Then, I manually review on Obsidian
- Run `npm test` for regression tests. The test runner requires Node.js 22.12+
- Run `npm run build` for the production bundle and `npm run lint` for lint checks. Changes to the editor should also be manually reviewed in Obsidian

jsdom tests *only* simulate CodeMirror formatting, so make sure you also do the manual review.

## Decorations

This is probably the most convoluted aspect of the project, but I've tried to neatly contain it in the following style:
- When the plugin parses each _visible_ line in the active Obsidian file, checking if any line matches the regex for a `name-dialogue` style line
  - On `true`, it will then scan said line to identify the `namespace` and `dialogue`
  - Then, it will parse the `namespace` to determine the `character` and `options`
