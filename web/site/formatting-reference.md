---
title: Formatting reference
category: Site Guide
summary: Every kind of formatting a guide page can use, with the syntax to type and how it looks.
expected-missing: Example of a missing page
---

Everything you can write in a guide page, with examples in plain text syntax and rendered. For the steps of adding or editing a page, see [[How to write a guide page]]. If something does not look right, see [[Troubleshooting and FAQ]].

## Quick reference

| You type | You get | Details under |
|---|---|---|
| `## Heading` | a section heading (`###` for a sub-section) | Headings |
| `**bold**` and `*italic*` | **bold** and *italic* | Bold and italic |
| `- item` or `1. item` | a bullet or a numbered list | Lists |
| `> words` | a quotation | Quotations |
| `---` | a divider | Horizontal divider |
| `` `inline code` `` | `inline code` | Inline code |
| three backticks, then a language name `` ```[language] `` | a code box with a Copy button | Code blocks |
| `[words](https://example.com)` | a link to another website | Links to other websites |
| `[[Page title]]` | a link to a guide page | Links to other pages |
| `[[topic:Name]]` and `[[patch:0.1.6656]]` | a link to a Patch Notes topic or patch | Links to other pages |
| `![alt](images/x.png "Caption"){right 220}` | a picture, with a caption, on one side | Picture captions and placement |
| `> [!NOTE]` then the text on the next line | a notice box | Notice boxes |
| `>!hidden words!<` | words hidden until clicked | Spoilers |
| `{{W}}` and `{{Shift+Right click}}` | keycaps | Keys and buttons |

## Basic formatting

These are plain Markdown, the same on any site that uses it. Each one has the rule, then the plain syntax as you type it, then how it looks to readers.

### Paragraphs

A blank line starts a new paragraph. A single line break inside a paragraph is only a space.

``` md
First line
second line, same paragraph

A new paragraph
```

Rendered:

First line
second line, same paragraph

A new paragraph

If you want something on its own line, make it its own paragraph, or use a list.

### Headings

Start a line with `##` and a space for a section heading, `###` for a sub-section, and `####` to `######` for deeper levels. The page title is added for you, so start at `##`.

``` md
## A section
### A smaller section
```

Rendered: the headings you are reading on this page are made this way, such as "Headings" just above. There is no separate rendered sample because headings are also what the **Contents** list is built from, and a sample here would add a false entry to it.

### Bold and italic

Put `**` around text for bold, and `*` or `_` around it for italic.

```markdown
This is **bold**, this is *italic*, and this is _also italic_.
```

Rendered:

This is **bold**, this is *italic*, and this is _also italic_.

### Lists

Start lines with `- ` or `* ` for bullets and `1. ` for numbers. Indent a line two spaces more than the item above it to nest it one level deeper. There is no limit on the number of levels, but a list reads best with no more than three.

``` md
- A bullet
- Another bullet
  - A nested bullet
    - A third level

1. First step
2. Second step
   - A bullet inside a step
```

Rendered:

- A bullet
- Another bullet
  - A nested bullet
    - A third level

1. First step
2. Second step
   - A bullet inside a step

### Quotations

Start a line with `>` for a quotation, which suits in-game text or developer statements. Always say who said it and where it came from, in a line under the quotation, and add a link when there is one. Put a `>` on the blank line between the two as well.

```md
> Quotations are set off from the text.
>
> Who said it, and where it came from
```

Rendered:

> Quotations are set off from the text.
>
> Who said it, and where it came from

A quotation whose first line is a tag such as `[!NOTE]` becomes a notice box instead. See **Notice boxes** under Extended features.

### Horizontal divider

Three dashes on a line of their own draw a divider.

```md
---
```

Rendered:

---

### Inline code

Put a short stretch between single backticks to show it exactly as typed. This is also how to show markup literally, so it is not turned into a link or bold. Inline code is shown in an accent color on a faint background, so it stands out from plain text and is never mistaken for a link: amber on the default and Iliac Bay themes, green on Parchment and blue on Oblivion.

```md
Press `Jump` to climb, and write `[[a page]]` to link.
```

Rendered:

Press `Jump` to climb, and write `[[a page]]` to link.

**Showing a backtick.** To put a backtick inside inline code, open and close the code with more backticks than the code contains, and leave a space inside each end so the backticks do not touch. The code ends at the next run of backticks of the same length as the one that opened it.

```md
Write `` `word` `` to show word in backticks, and `` ` `` for one backtick on its own.
```

Rendered:

Write `` `word` `` to show word in backticks, and `` ` `` for one backtick on its own.

- One space is dropped from each end when both ends have one, so `` ` `` shows a single backtick and not a backtick with spaces around it.
- A backslash does nothing inside code, so `` \` `` does not escape a backtick.
- A run of backticks with no matching run to close it is shown as plain text.

### Code blocks

For several lines shown exactly as typed, put a line of three backticks above them and another below. That suits commands, in-game chat lines, settings and data, and it is how the gray boxes in this page are written. Spacing and line breaks are kept, and long lines scroll sideways. Every box has a **Copy** button in its top bar, which copies the text exactly as typed, without the colors.

(Optional) Put a language name straight after the opening backticks, for example `json`. The name then appears in the box's top bar and the code is colored. A box with no name, or with a name the site does not know, is shown plain with no colors, and a name you gave still appears in the bar. Names are not case sensitive.

| You write | The code is colored as |
|:---|:---|
| `json` | JSON |
| `js`, `javascript`, `ts`, `typescript` | JavaScript and TypeScript |
| `bash`, `sh`, `zsh`, `shell`, `console` | Shell commands (a leading `$` or `>` prompt is picked out) |
| `powershell`, `ps1`, `pwsh` | PowerShell |
| `bat`, `batch`, `cmd` | Windows batch files |
| `ini`, `conf`, `cfg`, `config`, `toml`, `properties` | Settings files |
| `yaml`, `yml` | YAML |
| `lua` | Lua |
| `cs`, `csharp`, `c#` | C# |
| `xml`, `html`, `xaml`, `svg` | XML and HTML |
| `python`, `py` | Python |
| `markdown`, `md` | Markdown, including `[[links]]` and `{{keys}}` |
| `text`, `txt`, or no name | no colors |

> [!NOTE]
> The coloring is a guide for the eye, not a full reader of the language, so unusual code may be colored imperfectly. That does no harm, and the text itself is never changed. Very long boxes (over about 20,000 characters) are shown without colors.

**Showing the fence itself.** A code box ends only at a line of backticks that is at least as long as the line that opened it. To show a box that contains three backticks, open and close it with four. Tildes, written `~~~`, work as fences too.

````md
```bash
echo "a box inside a box"
```
````

Each box below was written with the name shown in its top bar:

```json
{"name": "my-mod", "version": 2, "enabled": true, "tags": ["audio", null]}
```

```bash
# list the save files
$ ls -la "$HOME/saves" --color=never
export GAME_DIR="$HOME/daggerfall"
```

```powershell
# list the save files
Get-ChildItem -Path "C:\Games\Saves" -Recurse | Where-Object { $_.Length -gt 1MB }
```

```bat
@echo off
REM start the game
set GAME=daggerfall.exe
if exist "%GAME%" start "" "%GAME%"
```

```ini
; display settings
[Graphics]
resolution = 1920
fullscreen = true
```

```yaml
# a mod list
name: my-mod
mods:
  - audio-pack
  - map-fix
enabled: true
```

```js
// log a message
function greet(name) { return console.log("Hello, " + name); }
```

```lua
-- print a message
local greeting = "Hello"
function greet(name) print(greeting, name) end
```

```cs
// a message
public class Greeter { public void Greet(string name) { Console.WriteLine($"Hello {name}"); } }
```

```xml
<!-- a config file -->
<settings enabled="true"><volume>80</volume></settings>
```

```python
# print a message
def greet(name):
    return f"Hello {name}"
```

```markdown
## A heading
Some **bold** words, a `code` word, a [[Guide page]] link and a {{W}} key.
- a list item
```

### Links to other websites

Write the words in square brackets and the address in round brackets.

```md
[a link to GitHub](https://github.com)
```

Rendered:

[a link to GitHub](https://github.com)

### Tables

A header row, a line of three dashes per column under it, then one row per line, with `|` between the cells. Cells can hold bold text, links and code. Colons in the line of dashes set each column's alignment: a colon on the left (`:---`) aligns left, which is the default, a colon on both sides (`:---:`) centers, and a colon on the right (`---:`) aligns right. Right alignment suits numbers.

```md
| Item | Where it goes | Count |
|:---|:---:|---:|
| Rows | one per line | 12 |
| Cells | separated by pipes | 1,234 |
```

Rendered:

| Item | Where it goes | Count |
|:---|:---:|---:|
| Rows | one per line | 12 |
| Cells | separated by pipes | 1,234 |

> [!WARNING]
> A `|` that belongs inside a cell needs a backslash before it, written `\|`. Without it, the site reads it as the start of a new cell.

### Pictures

An exclamation mark, the description in square brackets, and the picture's path in round brackets. How to add the picture file itself is explained in [[How to write a guide page|the how-to]], under **Adding pictures**.

```md
![Sarsaparilla looking majestic](images/sarsaparilla-01s.jpg)
```

Rendered:

![Sarsaparilla looking majestic](images/sarsaparilla-01s.jpg)

Readers can click any picture to open it, move through the page's pictures as a carousel, and click again to zoom in, so a screenshot can be shown small on the page without losing its detail.

## Extended features

These go beyond plain Markdown. They are what lets Game Guide pages connect to each other and to the Patch Notes, and each one is explained here with an example.

### Links to other pages

Double square brackets link to another page on this site. They are the way to link a guide page, a Patch Notes topic or a patch, because the site then knows what you linked and can show it in the References section. A link to a guide page uses the page's title, and matching is case-insensitive. Put `topic:` before the name of a Patch Notes topic and `patch:` before a version number. A bar followed by your own words changes the text that is shown.

| You type | What it does | Result |
|---|---|---|
| `[[Controls]]` | links to a guide page by its title, marked **GP** | [[Controls]] |
| `[[Controls\|the key bindings]]` | the same page, with your own words, still marked **GP** | [[Controls\|the key bindings]] |
| `[[topic:Revenants]]` | links to a Patch Notes topic, marked **PN** | [[topic:Revenants]] |
| `[[patch:0.1.6656]]` | links to a patch's page, marked **PN** | [[patch:0.1.6656]] |
| `[text](https://example.com)` | links to another website, marked **↗** | [an outside link](https://example.com) |
| `[[Example of a missing page]]` | links to a page that does not exist yet: the link is **red**, and clicking it starts that page | [[Example of a missing page]] |

If the page you name does not exist yet, the link shows in red, and clicking it starts that page. That lets you plan a set of pages by linking first.

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
| `[Audio](#/hub/Audio)` | [Audio](#/hub/Audio) (a Patch Notes category) |
| `[all patches](#/patches)` | [all patches](#/patches) |
| `[recent changes](#/recent)` | [recent changes](#/recent) |
| `[all topics](#/topics)` | [all topics](#/topics) |
| `[Feedback & Bugs](#/feedback)` | [Feedback & Bugs](#/feedback) |

> [!NOTE]
> These are plain links: they have no PN or arrow marker and they do not appear in the References section, so use the double-bracket forms from the linking examples above when you want a topic, patch or guide page listed there.

### Link previews

On a computer, pointing at a link to a guide page, a topic, a patch, a category or a system shows a short preview of what is there. You do not write anything for this. Point at any link in the Result columns on this page to see it. Readers can turn previews off in the settings panel.

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

**`related:` (Optional).** To list a page, topic or patch that does not belong in a sentence, add a `related:` line to the front matter at the top of the page, with names separated by commas. Start each name with `guide:`, `topic:` or `patch:` to say which kind it is:

```md
related: guide:Party rest, topic:Resting, patch:0.1.6656
```

`guide:` names a Game Guide page by its title, `topic:` a Patch Notes topic and `patch:` a patch version, matching the double-bracket links in the text. Guide pages go under Game Guide in the References section and topics and patches under Patch Notes. The check warns about names that match nothing.

> [!TIP]
> Use the prefix whenever a guide page and a topic share a name. Without it, the name is matched to a guide page first and to a topic second.

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
| `![alt](images/x.png)` | the plain picture, as in the basic formatting above |

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

Raw HTML (it is shown as plain text, which keeps pages safe and consistent), strikethrough, underline, colored text, footnotes, task-list checkboxes, merged table cells, embedded video or other media, forced line breaks inside a paragraph, and links to a section inside a page. Leave these out and the page will look right everywhere.

Back to the [Site Guide](#/site).
