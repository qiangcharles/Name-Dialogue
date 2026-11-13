# `characterList-update`

Following the n-property update to `settings` and `data.json` schema, I want to implement a more robust `characterList` menu.

## Motivation
Knowing that we have character colours already implemented, I want to be able to have some sort of two-tone character colour setting that we can use. I was thinking that the character decorators can have a gradient between colour 1 and colour 2; but if a colour 2 doesn't exist, then it just uses colour 1 for the whole thing. And if there aren't any colour's decided, we just use the default, funny `#676767`.

This motivation requires defining the current implementation:
- To be reductive and explain our current `characterList` modal's implementation: we are just served a list of rows corresponding to `characterListCard` from `data.json`
- The `characterList` modal has `characterListEditor` to serve different functions like adding new characters to our `characterList`
- Otherwise, `character`-specific editing functions exist in `characterListCard`
- `characterListCard` also only accepts a specific number of `character` properties

Given this understanding of implementation, we need to define what it is exactly from the motivation that is not yet implemented:
- Instead of having a simple modal that serves rows of `characterListCard`, instead we can create a hierarchy of what characters exist in the `data.json`
  - Example: `recent characters` used should be the first ones visible
  - I ran into this recently; I have a lot of characters across a lot of different projects
  - While I still intend to develop a per-folder or per-file `characterList` implementation, recently used characters should also be available
  - Maybe `data.json` can store the identity of recently used characters in memory?
- Instead of rows, we can also create some sort of gallery to show users the list of characters they've saved
- `characterListEditor` is good; we don't have to extract anything from here
- `characterListCard` will be deprecated and its functions will be extracted and expanded into a new `characterCardModal`
  - So now we open `characterListModal`, we are served different squares or cards or whatever of our characters, which is a `characterCardModal`
  - Then, from those cards, we open those up and have an interface to edit only that character
- Create a `propertyView` in `characterCard` that shows all the different aspects of the character
  - Requires determining what properties might be worth defining by default
  - At least `colour1` and `colour2` or `colour-namecard` etc to allow for robust customization
  - `name-font` or `name-style` and such...
  - `default-right`? `default-thought`?
- These properties can be shown as tags in a little box that can be X'd to remove, and a "+" button can be added to "add properties"

## Scaffolding

- Create `characterCardModal`; an additional modal on top of characterListModal
- Create `characterCardEditor`; controls in `characterCardModal`'
- Create `characterCardProperty`; is the visual component of the proposed implementation

Consider: refactor `src/modals/characterList` into `src/modals/character/menu/` and `src/modals/character/card/`, where `menu` is the formerly named `list`.

## Shortcomings

Previously, you could edit various characters nice and easy without having to open and close additional interfaces. This introduces additional clicks for the sake of appearance. Perhaps having a quick-edit or keeping the modal robust by having not a new additional sub-modal open, but splitting the `characterList` modal and having an `activeCard` or `activeCharacter` to edit, while also being able to click between characters. That way, we don't need to open more stuff.
