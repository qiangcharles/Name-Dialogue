# Contributing to Name Dialogue

Thank you for considering contributing to my little project! All types of contributions are encouraged, and I look forward to seeing what you might be able to provide to help make this plugin better!
I highly recommend reviewing the planned functionality section in README.md, or visiting the issues page to see whether your contribution or idea is already planned or being worked on.

Until I see a need for it, I'm going to keep `contributing.md` very sweet and short:
- I assume you've read README.md
- Feel free to ask questions or open issues

## Style guide

I prefer camelCase, while CSS is dashed. and I'm in the process of also standardizing the terms.

- `namespace` refers to the first part of any `Name Dialogue` line (i.e: namespace:dialogue); it encompasses `character` and `options` before `dialogue`
	- `character` refers to a subject that is added in the options of the plugin
	- `options` refers to any keywords or terms in the namespace after the character
- `wrapper` refers to any surrounding plaintext symbols (i.e: "quotation marks for spoken dialogue" or (parentheses in the case of thought dialogue))
- `dialogue` strictly refers to the plaintext after the namespaces
- `decorator` refers to the visual treatment of a dialogue box, such as its border, fill, and shape; the built-in decorators are `default` and `thought`
- `dialogue-style` refers to formatting applied to the `dialogue` (i.e: italic thought text)

Example:
```plaintext
Alice:Hi!
Bob:thought:right:Who is she talking to?
```
`Alice` is the `character`, `Hi!` is the `dialogue`.
`Bob` is the `character`, `thought` is the first option, `right` is the second option, and `Bob:thought:right:` encompasses the `namespace`.
`Who is she talking to?` is the `dialogue`.
