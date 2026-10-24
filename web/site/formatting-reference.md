---
title: Formatting reference
category: Site Guide
summary: The plain Markdown a guide page can use, with the syntax to type and how it looks. The site's own extras are on Extended formatting.
---

> [!INFO]
> Kind: Reference
> Covers: The plain Markdown a guide page can use
> Used on: Game Guide and Site Guide pages
> Written in: Markdown, with a few extras
> ## Related
> Extras: [[site:Extended formatting]]
> Steps: [[site:How to write a guide page]]
> Problems: [[site:Fixing a page]]

The plain Markdown you can write in a guide page, with examples in plain text syntax and rendered. The extras that are particular to this site, such as links between pages, notice boxes and keycaps, are on [[site:Extended formatting]]. For the steps of adding or editing a page, see [[site:How to write a guide page]]. If something does not look right, see [[site:Fixing a page]].

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
| `[[Page title]]` | a link to a guide page | [[site:Extended formatting#Links to other pages]] |
| `[[topic:Name]]` and `[[patch:0.1.6656]]` | a link to a Patch Notes topic or patch | [[site:Extended formatting#Links to other pages]] |
| `![alt](images/x.png "Caption"){right 220}` | a picture, with a caption, on one side | [[site:Extended formatting#Picture captions and placement]] |
| `> [!NOTE]` then the text on the next line | a notice box | [[site:Extended formatting#Notice boxes]] |
| `> [!INFO]` then `Key: value` lines | a fact panel beside the text | [[site:Extended formatting#Infoboxes]] |
| `>!hidden words!<` | words hidden until clicked | [[site:Extended formatting#Spoilers]] |
| `{{W}}` and `{{Shift+Right click}}` | keycaps | [[site:Extended formatting#Keys and buttons]] |

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

A quotation whose first line is a tag such as `[!NOTE]` becomes a notice box instead. See **Notice boxes** on [[site:Extended formatting#Notice boxes]].

### Horizontal divider

Three dashes on a line of their own draw a divider.

```md
---
```

Rendered:

---

### Inline code

Put a short stretch between single backticks to show it exactly as typed. This is also how to show markup literally, so it is not turned into a link or bold. Inline code is shown in an accent color on a faint background, so it stands out from plain text and is never mistaken for a link. The exact color depends on the theme and color the reader has chosen.

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

Readers can click a column heading to sort the table, hold **Shift** while clicking to add a second column to the sort, and type in the box above the table to show only the rows that contain those words. These controls are added to every table; nothing is needed in the Markdown. **Copy MD** and **Copy HTML** above a table copy the rows currently shown, in the order shown: the first as an aligned table inside a code block (Discord keeps it lined up, up to its 2,000-character limit), the second as an HTML table that pastes into Excel or Google Sheets as cells (a program that takes only text gets tab-separated columns). A table of more than 15 rows shows 15 and scrolls inside its own box, with the heading row staying at the top of the box. Empty cells and cells holding `-`, `—`, `N/A` or `?` always sort last.

A column is sorted by what its cells hold: numbers as numbers, dates as dates, anything else as text with `Item 2` before `Item 10`. To say what a column holds, put a **type tag** in braces at the end of its cell in the line of dashes. The types are `{num}` (`1,200`, `-3`, `1.5k`), `{pct}` (`85%`), `{dur}` (`1h 30m`, `45s`, `2:30`), `{date}` (`2026-10-24`, `Oct 24, 2026`), `{bool}` (`Yes`/`No`, `✓`/`✗`) and `{text}`. A column with no tag is read as the first type that fits all of its cells. Tags go after the alignment colons.

```md
| Item | Level | Hit chance | Cooldown | Added |
|:---|---:{num}|---:{pct}|---:{dur}|---{date}|
| Sword | 5 | 85% | 1h 30m | 2026-10-01 |
| Dagger | 12 | 95% | 45m | 2026-09-12 |
```

Rendered:

| Item | Level | Hit chance | Cooldown | Added |
|:---|---:{num}|---:{pct}|---:{dur}|---{date}|
| Sword | 5 | 85% | 1h 30m | 2026-10-01 |
| Dagger | 12 | 95% | 45m | 2026-09-12 |

For a list of facts about one thing, use a **key/value table**: leave the heading cells empty and put `{label}` on the first column. It is drawn without a heading row and has nothing to sort or filter. `{label}` on the first column of an ordinary table marks it as the row-label column: its cells are drawn as row headings and stay in view when a wide table is scrolled sideways.

```md
| | |
|---{label}|---|
| Region | Hammerfell |
| Level range | 10 to 20 |
```

Rendered:

| | |
|---{label}|---|
| Region | Hammerfell |
| Level range | 10 to 20 |

In the editor, **Format > Table Column** sets the tag for the column the cursor is in, and **Format > Snippets > Key/Value Table** starts a key/value table.

### Pictures

An exclamation mark, the description in square brackets, and the picture's path in round brackets. How to add the picture file itself is explained in [[site:How to write a guide page|the how-to]], under **Adding pictures**.

```md
![Sarsaparilla looking majestic](images/sarsaparilla-01s.jpg)
```

Rendered:

![Sarsaparilla looking majestic](images/sarsaparilla-01s.jpg)

Readers can click any picture to open it, move through the page's pictures as a carousel, and click again to zoom in, so a screenshot can be shown small on the page without losing its detail.

If a picture's file cannot be found, readers see a gray "No picture yet" box in its place instead of a broken-picture icon. The page check still reports the missing file as an error, so it gets fixed before the page is published.

## Going further

Links between pages, the References section, picture captions and placement, notice boxes, infoboxes, spoilers and keycaps are on [[site:Extended formatting]], which also lists what is not supported. For what the site builds around your text, see [[site:Anatomy of a page]].

Back to the [Site Guide](#/site).
