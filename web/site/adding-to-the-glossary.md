---
title: Adding to the glossary
category: Site Guide
summary: How the Glossary is built from one guide page, how to add or change a term, and how to link a term from another page.
authors: tau
---

The [Glossary](#/glossary) gives a short, shared definition for each term the Game Guide uses, so a reader can look a word up once and a page does not have to explain it again. It is written in one Game Guide page, `web/guide/glossary.md`, and the site builds the Glossary from it. Nothing is written twice, and anyone can change it the same way as any other page.

## What belongs in it

A glossary entry says what a term **is**, in a sentence or two. How it works, the numbers, the steps and anything a patch can change belong on the page about it, and the entry links there.

> [!TIP]
> If a definition needs a number, a condition or a list, it is too long for the glossary. Cut it back to what the term means, and put the rest in the **See also** page.

## Adding a term

Open the Glossary page, choose **View Source** or **Open this page in the Editor**, and add an entry anywhere in the file. The site sorts the terms, so the place you put it does not matter. Copy an existing entry and change it:

```markdown
### Renown

*Category:* Renown

*Also called:* Renown level

A progression level earned online, separate from the character's Daggerfall level. It adds maximum health and Magicka.

*See also:* [[Renown]]
```

| Part | How to write it | Required |
|---|---|---|
| Term | A `###` heading (three hashes). Use the one spelling and capitals the game uses. | Yes |
| Definition | One or two sentences under the heading. | Yes |
| `*Category:*` | The group the term is listed under. Reuse a category already on the page where one fits. | No |
| `*Also called:*` | Other names for the same thing, separated by commas. | No |
| `*See also:*` | Links to the pages that explain it in full, such as `[[Firmament]]`. | No |

The order of the lines under the heading does not matter, and neither do the asterisks: `Category: Skills` works as well as `*Category:* Skills`. A heading of any other level, and any text above the first term, is not read as a term, so the page can keep its own introduction.

To change a term, edit its entry. To remove one, delete its heading and the lines under it. A term with no definition is left out.

## How the Glossary page shows it

- **By category** is the default view, with a jump list of the categories. A term with no category goes under **Other**, last.
- **A to Z** lists every term by its first letter, with its category above the definition.
- **The filter box** matches the term, its other names, its category and its definition, and marks the words you typed.
- **The term itself** links to the Game Guide page of the same name. If there is no such page, it shows as a red link that starts one.

The Glossary page has the same **Read**, **View Source** and **History** tabs as any other guide page, so a reader who wants to add a term can go straight to the source. The file is unlisted, which keeps it out of the Game Guide lists but not out of search or the editor.

## Linking to a term

From another guide page, link a term so a reader can see its definition:

| Written | Goes to |
|---|---|
| `[Renown](#/glossary#gl-renown)` | The entry on the Glossary page. The id is `gl-` and the term in lower case, with hyphens between words. |
| `[[Glossary#Renown]]` | The same entry, through the Glossary guide page's heading. The page check tells you if the term does not exist. |
| `[the glossary](#/glossary)` | The whole Glossary page. |

> [!NOTE]
> `[[Glossary#Renown]]` is the safer form, because the editor's Problems list and the page check report a term that is not in the glossary. The first form is not checked.

## When something looks wrong

- **A term is missing from the Glossary.** Its heading must have exactly three hashes and a space (`### Term`), and it needs at least one line of definition under it.
- **A term is in the wrong group.** Check the spelling of its category: `Skill` and `Skills` are two groups.
- **A term shows as a red link.** No Game Guide page has that title yet. That is normal for a term that is only defined here, and it can be left red.

Back to the [Site Guide](#/site).
