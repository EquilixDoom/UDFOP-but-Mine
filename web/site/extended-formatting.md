---
title: Extended formatting
category: Site Guide
summary: The formatting beyond plain Markdown: links between pages, the References section, picture captions, notice boxes, infoboxes, spoilers and keycaps.
expected-missing: Example of a missing page
---

> [!INFO]
> Kind: Reference
> Covers: The formatting beyond plain Markdown
> Used on: Game Guide and Site Guide pages
> Written in: Markdown, with a few extras
> ## Related
> Plain Markdown: [[site:Formatting reference]]
> Problems: [[site:Fixing a page]]

These go beyond plain Markdown. They are what lets Game Guide pages connect to each other and to the Patch Notes, and each one is explained here with an example. Plain Markdown is on the [[site:Formatting reference]] page.

### Links to other pages

Double square brackets link to another page on this site. They are the way to link a page, a Patch Notes topic or a patch, because the site then knows what you linked and can show it in the References section. A link to a Game Guide page uses the page's title, and matching is case-insensitive. A plain name always means a Game Guide page (`guide:` before the title says so out loud, and means the same): the site never guesses that you meant a Site Guide page or a Patch Notes topic, even when one has that name. Put `site:` before the title of a Site Guide page, `topic:` before the name of a Patch Notes topic and `patch:` before a version number. A bar followed by your own words changes the text that is shown.

| You type | What it does | Result |
|---|---|---|
| `[[Controls]]` | links to a guide page by its title, marked **GP** | [[Controls]] |
| `[[Controls\|the key bindings]]` | the same page, with your own words, still marked **GP** | [[Controls\|the key bindings]] |
| `[[guide:Controls]]` | the same page with the kind spelled out; `guide:` is optional | [[guide:Controls]] |
| `[[site:Fixing a page]]` | links to a Site Guide page, marked **SG** | [[site:Fixing a page]] |
| `[[topic:Revenants]]` | links to a Patch Notes topic, marked **PN** | [[topic:Revenants]] |
| `[[patch:0.1.6656]]` | links to a patch's page, marked **PN** | [[patch:0.1.6656]] |
| `[[Controls#Mouse]]` | links to a section of a guide page; the text shown is the page and the section | [[Controls#Mouse]] |
| `[[Controls#Mouse\|the mouse keys]]` | the same section, with your own words | [[Controls#Mouse\|the mouse keys]] |
| `[[site:Fixing a page#A link is red]]` | a section of a Site Guide page | [[site:Fixing a page#A link is red]] |
| `[[#Link markers]]` | a section of the page you are writing | [[#Link markers]] |
| `[text](https://example.com)` | links to another website, marked **↗** | [an outside link](https://example.com) |
| `[[Example of a missing page]]` | links to a page that does not exist yet: the link is **red**, and clicking it starts that page | [[Example of a missing page]] |

If the page you name does not exist yet, the link shows in red, and clicking it starts that page. That lets you plan a set of pages by linking first.

**Linking to a section.** Put a `#` and the words of a heading after the page name. Capitals and punctuation do not matter, and the heading must be one of the first three levels (`#`, `##` or `###`). Leave the page name out (`[[#Section]]`) to link to a section of the page you are writing. The page check tells you when the page has no such section. Sections work for guide pages and Site Guide pages only, not for topics or patches. For a section of a topic, use a plain link such as `[History](#/topic/Resting#s-history)`.

### Link markers

A small raised marker after a link says where it goes, so readers know before they click.

> [!NOTE]
> The markers are added for you. Do not type them.

| Marker | Where the link goes |
|---|---|
| **GP** | a page in the Game Guide |
| **SG** | a page in the Site Guide |
| **PN** | a Patch Notes topic or patch |
| **↗** | another website |
| none | a plain link to a page of this site, such as a category, and a red link to a page that does not exist yet |

### Other links on this site

A normal Markdown link can point at any page of the site, so you can send readers to a category, to a Patch Notes list or to the feedback page. Write the address starting with `#/`:

| You type | Result |
|---|---|
| `[Player Guide](#/guide/category/Player%20Guide)` | [Player Guide](#/guide/category/Player%20Guide) (a Game Guide category; write a space in its name as `%20`) |
| `[Audio](#/hub/Audio)` | [Audio](#/hub/Audio) (a Patch Notes area) |
| `[all patches](#/patches)` | [all patches](#/patches) |
| `[recent changes](#/recent)` | [recent changes](#/recent) |
| `[all topics](#/topics)` | [all topics](#/topics) |
| `[Feedback & Bugs](#/feedback)` | [Feedback & Bugs](#/feedback) |

> [!NOTE]
> These are plain links: they have no PN or arrow marker and they do not appear in the References section, so use the double-bracket forms from the linking examples above when you want a topic, patch or guide page listed there.

### Link previews

On a computer, pointing at a link to a guide page, a topic, a patch or a category shows a short preview of what is there. You do not write anything for this. Point at any link in the Result columns on this page to see it. Readers can turn previews off in the settings panel.

### The References section

Every guide page that links anywhere gets a **References** section at the bottom.

> [!NOTE]
> Do not write a References section yourself. The site builds it from the links in your text.

| Part | What it lists |
|---|---|
| **Game Guide** | the guide pages you linked, each with its summary |
| **Patch Notes** | the topics and patches you linked, each with when it was last changed |
| **External Links** | the outside websites you linked |

Each link appears once, in the order it first appears in the text. A page is "not linked" when your text has no `[[...]]` link to it and you did not name it in `related:`. The section lists only what you linked or named, so a guide page that exists but that your text never mentions does not appear.

**`related:` (Optional).** To list a page, topic or patch that does not belong in a sentence, add a `related:` line to the front matter at the top of the page, with names separated by commas. A name with no prefix is a Game Guide page, as in the text. Start a name with `site:`, `topic:` or `patch:` for the other kinds (`guide:` is also allowed, to spell out a Game Guide page, just as in the text):

```md
related: guide:Party rest, site:Formatting reference, topic:Resting, patch:0.1.6656
```

`guide:` names a Game Guide page by its title, `site:` a Site Guide page, `topic:` a Patch Notes topic and `patch:` a patch version, matching the double-bracket links in the text. Game Guide pages go under Game Guide in the References section, Site Guide pages under Site Guide, and topics and patches under Patch Notes. The check warns about names that match nothing.

> [!TIP]
> A name with no prefix is a Game Guide page, the same as in the text. A Site Guide page, a Patch Notes topic or a patch always needs its `site:`, `topic:` or `patch:` prefix; it is never guessed.

### Picture captions and placement

To caption a picture or move it to the side, put the caption in quotes after the path, and a side and width in braces after the picture. Both parts are optional. A captioned picture with no side given floats to the right as a framed thumbnail.

> [!WARNING]
> A caption, a side or a width only works when the picture is **alone on its line**.

| You type | You get |
|---|---|
| `![alt](images/x.png "Caption")` | a framed picture on the **right**, 240 pixels wide, with the caption under it (the default for a captioned picture) |
| `![alt](images/x.png "Caption"){left 180}` | the same, floated to the left and 180 pixels wide |
| `![alt](images/x.png "Caption"){center 400}` | centered on its own line, 400 pixels wide |
| `![alt](images/x.png){right 200}` | a floated picture with no caption (the braces alone are enough) |
| `![alt](images/x.png)` | the plain picture, as on the [[site:Formatting reference]] page |

The side is `left`, `right` or `center`, and the width is a number of pixels from 40 to 1200. The picture never grows past its own size or past the page. The check warns about any other word in the braces.

Here is the sample picture from above with a caption, floated to the right:

![Sarsaparilla looking majestic](images/sarsaparilla-01s.jpg "Sarsaparilla, looking majestic."){right 220}

Text next to a floated picture wraps around it, as on Wikipedia, and a heading starts below it. Several pictures floated the same way stack down the side. On a phone the picture moves above the text and takes the full width, because narrow columns of wrapped text are hard to read. Write the caption as a short sentence naming what is shown, and keep the alt text for describing what the picture looks like.

The same picture floated to the left, 150 pixels wide. The text now runs down its right-hand side, which suits a small picture that illustrates the paragraph it sits beside.

![Sarsaparilla looking majestic](images/sarsaparilla-01s.jpg "Floated left, 150 wide."){left 150}

Here the text carries on beside the left-hand picture for a few more lines, so you can see how a left float and the paragraph work together. A heading, a table or a centered picture starts below the float, never beside it, so the page stays tidy.

And centered, 300 pixels wide, standing alone on its line:

![Sarsaparilla looking majestic](images/sarsaparilla-01s.jpg "Centered, 300 wide."){center 300}

### Notice boxes

(Optional) A notice box sets a tip, a warning or an extra fact apart from the text around it. Start a quotation with a tag on a line of its own, then write the text of the box on the lines after it:

```markdown
> [!WARNING]
> Quicksaving during a quest can break it.
```

Choose one of five tags. The tag is not case sensitive.

| You write | The box is labelled | Use it for |
|:---|:---|:---|
| `[!NOTE]` | Note | extra information |
| `[!TIP]` | Tip | helpful advice |
| `[!IMPORTANT]` | Important | something readers must know |
| `[!WARNING]` | Warning | something that can go wrong |
| `[!CAUTION]` | Caution | something that can lose progress or data |

Rendered, one of each:

> [!NOTE]
> Resting is only possible when no enemies are nearby.

> [!TIP]
> Press {{R}} to rest, then pick how many hours.

> [!IMPORTANT]
> Your character sheet saves with the game, not with the server.

> [!WARNING]
> Resting inside a dungeon can wake monsters that were asleep.

> [!CAUTION]
> Deleting a save in the `saves` folder cannot be undone.

Anything you can write in a page also works inside a box: several paragraphs, lists, links, keys and code boxes. Put `>` at the start of every line of the box, including blank lines between paragraphs. Keep each box short. On a normal guide page use them sparingly, since a page full of boxes stops anything standing out. The pages about the site itself use many because each one is something a contributor must not miss.

A tag the site does not know, such as `[!DANGER]`, leaves an ordinary quotation, and the page check mentions it. When you edit on GitHub, its preview draws these boxes too, in its own colors.

### Infoboxes

An infobox is a small panel of key facts that floats beside the first paragraphs of a page, as on most wikis. Players can read the numbers they look up most, such as a price or a weight, at a glance. Start a quotation with `[!INFO]` and an optional title, then write one fact per line as `Key: value`.

```markdown
> [!INFO] Example item
> image: images/sarsaparilla-01s.jpg
> Type: Example
> Value: 100 gold
> ## Where found
> Sold at: General Stores
```

The panel at the top of this page is an infobox written the same way, without the picture row. A picture row draws the picture under the title, above the rows.

- **Title.** Written after `[!INFO]`. Leave it out and the page's own title is used.
- **Rows.** Each `Key: value` line is one row. The value can hold bold text and links. A line with no colon carries on the row above it.
- **Picture.** An optional `image:` line, with the path from the page's folder, puts a picture under the title. Readers can click it to enlarge it, like any other picture.
- **Group headings.** A line starting `## ` adds a gray heading that splits the rows into groups. It is not a section of the page, so it does not appear in the Contents list.
- **Placement.** Put the infobox first, right after the front matter, so it lines up with the top of the page text. It floats on the right, and the text, headings, notice boxes and tables sit beside it. On a phone it moves above the text.

> [!NOTE]
> Use one infobox per page, as the first thing on the page, and keep it to the facts a reader looks up. Long explanations belong in the text. The page check notes a row with no value, a page with more than one panel, and a panel that is not the first thing on the page. In GitHub's preview the panel shows as an ordinary quotation with its text readable.

### Spoilers

To hide a few words until the reader chooses to see them, put `>!` before them and `!<` after them.

```markdown
The final boss is >!the Lich King, who is weak to fire!<, so bring fire spells.
```

Rendered:

The final boss is >!the Lich King, who is weak to fire!<, so bring fire spells.

The words are masked by a dark bar. Clicking them, or pressing {{Enter}} or {{Space}} while they are selected, shows them, and the same action hides them again. Bold, italic, links and keys work inside a spoiler, and a link inside one does nothing until it has been revealed.

> [!NOTE]
> A spoiler hides words from the eye, not from the page. The text is still in the file on GitHub, and a reader can still select it and copy it. Use it for surprises in the game, never for anything private. A spoiler must sit on one line, and a line that starts with `>!` is treated as a paragraph, not a quotation.

### Footnotes

To name the source of a statement without cluttering the sentence, put `[^name]` after it and write the note on a line of its own, anywhere on the page.

```markdown
Writs can award Renown XP.[^writs]

[^writs]: https://example.com/source
```

Rendered:

Writs can award Renown XP.[^writs]

[^writs]: https://example.com/source

The reference becomes a small numbered link, and the notes are listed under a **Footnotes** heading at the end of the page, before References. The [[site:Footnote demo]] page shows more cases.

- **Numbering** follows the order the references first appear in the text, whatever the order of the notes. Using the same name again reuses its number, and the note gets a way back for each use.
- **A note** can hold links, bold, italic and other links of the guide. A note that is only an address shows it as a link. A long note can continue on the lines after it if they are indented.
- **Names** are letters, digits, hyphens and underscores, such as `[^writs]` or `[^1]`. They are never shown, only the numbers.
- **The page check** reports a reference with no note (it is shown as written), a name defined twice, and a note that is never used (it is not shown). In the editor, Format > Snippets > Footnote adds a reference at the caret and its note at the end of the page.

> [!NOTE]
> A note cannot hold another footnote, and a note inside a quote or a notice box is not recognized: write the note on a line of its own, at the left edge.

### Keys and buttons

To show a keyboard key, a mouse button or a gamepad button, put its name between double braces. It is drawn as a small keycap, so readers can see at a glance what to press.

> [!TIP]
> Use keycaps for things you **press**. Use bold for buttons and menu labels you **click on screen**, such as **Rest**, so the two are never mixed up.

```md
Press {{W}} to move forward and hold {{Left Shift}} to run.
{{Shift+Right click}} draws the bow, and {{Mouse 4}} switches the view.
On a controller, hold {{pad:RT}}.
Turn with {{Left}} and {{Right}}, or look with {{Up}} and {{Down}}.
```

Rendered:

Press {{W}} to move forward and hold {{Left Shift}} to run. {{Shift+Right click}} draws the bow, and {{Mouse 4}} switches the view. On a controller, hold {{pad:RT}}. Turn with {{Left}} and {{Right}}, or look with {{Up}} and {{Down}}.

- **Arrow keys** are typed as words, `{{Up}}`, `{{Down}}`, `{{Left}}` and `{{Right}}`, and shown as arrows, ↑ ↓ ← →, which read faster. The words are only for the four arrow keys: `{{Left Shift}}` and `{{Left click}}` are not affected.
- **Combinations** are joined with `+`, and each key gets its own cap, as in `{{Ctrl+Shift+K}}`. For a plus key itself, write `{{+}}`.
- **Mouse buttons** are recognized by name (`Left click`, `Right click`, `Middle click`, `Mouse 3`, `Mouse 4`, `Mouse 5` and `Scroll`) and drawn with rounder corners than keyboard keys.
- **Gamepad buttons** start with `pad:`, as in `{{pad:A}}`, and are drawn round. The prefix is not shown. Use the name printed on the button; the table below lists the Xbox names, which are the game's own, and the PlayStation ones. When a page gives both for one button, put the Xbox name first and the PlayStation name second, such as `{{pad:RB}}, {{pad:R1}}`, and say so once on the page so readers know they are the same button on two controllers.
- **Keys with symbols** are written as the character and named in plain words after it, so readers who do not know the symbol can find it: `{{;}} (semicolon)`, `{{,}} (comma)` or `{{[}} (left bracket)`.
- **Use the same names everywhere** so pages agree. Use these:

| Kind | Names |
|---|---|
| Letters and digits | `A` to `Z` and `0` to `9`, as the character |
| Function and editing | `F1` to `F12`, `Esc`, `Tab`, `Enter`, `Space`, `Backspace`, `Insert`, `Delete`, `Home`, `End`, `PgUp`, `PgDn` |
| Arrows | `Up`, `Down`, `Left`, `Right` (shown as ↑ ↓ ← →) |
| Modifiers | `Shift`, `Left Shift`, `Right Shift`, `Ctrl`, `Alt`, and `Left` or `Right` in front of each |
| Gamepad (Xbox) | `A`, `B`, `X`, `Y`, `LB`, `RB`, `LT`, `RT`, `LSB` (left stick button), `RSB` (right stick button), `D-pad`, `D-pad Up`, `D-pad Down`, `D-pad Left`, `D-pad Right`, `Start`, `Back` |
| Gamepad (PlayStation) | `Cross`, `Circle`, `Square`, `Triangle`, `L1`, `R1`, `L2`, `R2`, `L3`, `R3`, `D-pad`, `Start`, `Select` |
| Number pad | `Numpad 0` to `Numpad 9`, `Numpad +`, `Numpad -`, `Numpad *`, `Numpad /`, `Numpad Enter` |

> [!NOTE]
> Keycaps work in tables and in captions, but not inside the text of a link. Put the example in single backticks, as the code boxes on this page do, when you want to show the braces themselves.

### What the site does for you

You do not write these. They come from what you wrote: a **Contents** list built from the page's headings (docked in the left sidebar by default, where it follows the section being read; subsections are listed under their section behind a small arrow that the reader opens; readers can hide it behind a ☰ button beside the page title that floats at the top left of the window once they scroll past the title, and the site remembers their choice; on a narrow screen such as a phone there is no Contents list: each section and subsection folds instead, closed to begin with, and a reader taps a heading to open it), the page's place in the Game Guide index and breadcrumb from its `category`, its entry in the Game Guide index and in search, the **References** section, the **PN** and **↗** markers on links, and the colors and **Copy** button on code boxes.

## Not supported

Raw HTML (it is shown as plain text, which keeps pages safe and consistent), strikethrough, underline, colored text, task-list checkboxes, merged table cells, embedded video or other media, forced line breaks inside a paragraph, and links to a section of a Patch Notes topic or patch (sections of guide pages and Site Guide pages can be linked, as shown under Links to other pages). Leave these out and the page will look right everywhere.

Back to the [Site Guide](#/site).
