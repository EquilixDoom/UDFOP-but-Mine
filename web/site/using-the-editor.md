---
title: How to use the editor
category: Site Guide
summary: How to write a Game Guide page in the browser editor, see it drawn as you type, fix what the Problems check finds, and send it to GitHub.
---

The guide editor is the "Open the editor" link in the main menu. You type Markdown in the **Editor** pane on the left and see the page drawn in the **Preview** pane on the right as you type. Nothing is uploaded until you submit, and your draft stays in your browser.

The editor always uses the whole width of the window, and the main menu and Settings open as pop-ups while you are in it, whatever you chose in Settings. Your own choices come back when you leave.

> [!NOTE]
> On a narrow screen the preview sits under the text box instead of beside it.

## Writing

A new draft starts from the guide template. Replace the placeholders, delete the Tip box at the top once you have read it, and fill in the `title`, `category` and `summary` lines at the very top. The formatting is described on the pages [[site:Formatting reference]] and [[site:Extended formatting]].

The text is colored as you type: the front matter, headings, code boxes, notice boxes, bold, italic, code, links and spoilers each have a color. A link to a page that exists is colored as a link, and a link to a page that does not exist is red with a wavy underline.

The preview shows the page as it will look: the title, then the Game Guide breadcrumb with the category from your front matter (General when there is none; a page marked `unlisted` has no breadcrumb). Links in the preview do nothing when pressed, so you cannot lose your place; only a link to a heading on the same page works, and it scrolls to that heading.

Each pane has a title bar and a status bar. The Editor's status bar shows the line and column, the word count and when the draft was saved. The Preview's title bar shows the file name the page will get, made from your title, and its status bar shows how much of the Submit link's length limit the page uses.

## Problems

The **Problems** button in the Editor's title bar checks your page every time you type. It is green with a tick when nothing is wrong, amber when there are only warnings, and red when there is an error. Press it to open the Problems panel, which has its own title bar. Press a line in the list to select the text it is about. Drag the thin handle on the panel's top edge, or focus it and press the up and down arrow keys, to change its height; the height is remembered.

**Errors** are things that would break the page or clash with another, and they stop Submit (see below):

- there is no `title`, or the front matter at the top has no closing `---` line
- the page is empty
- another page already has the same title or file name
- a picture does not exist (the editor cannot add pictures, so add them in your pull request)
- a code box is never closed, which turns the rest of the page into code
- a footnote reference such as `[^name]` with no note line for it, or a note that is defined twice

**Warnings** are worth a look but do not stop Submit:

- no `summary`, or a category spelled differently from the existing pages
- a link to a page, section, topic or patch that does not exist, which shows as a red or plain link. A page you mean to write later can be listed on an `expected-missing:` line in the front matter
- a `related:` entry that matches nothing
- an unknown code box language or notice box type, or a code box line with more than a language name after the backticks
- a Site Guide page or topic linked without its `site:` or `topic:` prefix
- an infobox row with no value, more than one infobox, or an infobox that is not the first thing on the page
- an unclosed spoiler, HTML or script-like text, or an unknown picture option or width
- a footnote note that no reference uses, so it is not shown

The check reads another page's headings, and looks for picture files, the first time you link to them, so a warning about a section or a picture can take a second to appear or go away.

## The File menu

- **New from template** opens a window listing the starter templates (How it works, Item, Place, Creature or boss), each with a line on what it is for. Choosing one replaces the text with it and selects the first placeholder so you can type over it.
- **Open a guide page** lists the pages already in the Game Guide, grouped by category with each page's summary. Type to narrow the list (it matches titles, categories and summaries), use the arrow keys and {{Enter}} or click to choose a page to edit it (see below).
- **Open from this computer** ({{Ctrl+O}}) loads a Markdown or text file (`.md`, `.markdown`, `.mdown` or `.txt`, up to 2 MB) into the editor.
- **Save draft** ({{Ctrl+S}}) saves the draft now instead of waiting.
- **Download .md** saves the text as a file named after your title, for example `my-page.md`.
- **Discard draft** deletes the saved draft and starts a new page from the template.

Whenever one of these would replace the text you have written, the editor asks first. You can cancel, replace the text ({{Ctrl+Z}} brings the old text back), or choose **Download, then replace** to save a copy to your device before it goes.

## The Edit menu

- **Undo, Redo, Cut, Copy, Delete** and **Select All** work on the text box as usual.
- **Paste** puts the clipboard's text where the caret is, or over the selection. A browser asks before a page may read your clipboard; if you decline, or the browser does not allow it, the status bar says to press {{Ctrl+V}} instead.
- **Paste Special > Paste HTML Content** reads formatted text from the clipboard, such as something copied from a web page or a Word document, and pastes it as Markdown: headings, paragraphs, bold, italic, code, links, pictures, lists, tables, code blocks and quotes. Colors, fonts, scripts and styles are dropped, and so are links that run code. The browser asks for permission here too.
- **Indent** adds or removes two spaces at the start of the selected lines, or of the line the caret is on.
- **Change Case To** changes the selection to UPPER, lower, Proper or Sentence. Proper capitalizes the first letter of each word, skipping anything in front of it that is not a letter, so `(hello)` becomes `(Hello)` and `2nd` becomes `2Nd`. Sentence capitalizes the first letter of the selection, of each line and of each sentence (after a full stop, question mark or exclamation mark), skipping what comes before it, so `## my heading` becomes `## My heading` and `- item` becomes `- Item`. With nothing selected they change the word the caret is in, and Sentence changes the line.
- **Line Operations** work on the lines the selection touches, or on the whole page when nothing is selected. They are Remove Duplicates (keeps the first copy of each line), Remove Consecutive Duplicates, Remove Empty Lines, Remove Empty Line (Blank Characters), Reverse Line Order and the sorts. **Move Up Current Line**, **Move Down Current Line** and the two **Insert Blank Line** items work on the current line or the selected lines.
- **Sorts** can go by character code, ignoring case, by the whole number at the start of each line (Int.), by the number with a decimal point or comma at the start (Dec.), or by line length, each ascending or descending. A line that does not start with a number counts as lower than any number. Lines that compare equal keep their order.
- **Blank Operations** trim spaces and tabs from the end, the start, or both ends of each line, with the same selection rule as Line Operations.
- **Multi-Select All** puts a selection on every place in the page where the text you have selected occurs (with nothing selected, the word the cursor is in), so that you can change them all together; see the next section. The four items say what has to match: **Ignore Case & Whole Word** means neither matters (capitals may differ, and the text may be part of a longer word), **Match Case Only** needs the same capitals, **Match Whole Word Only** needs the match not to touch other letters or digits, and **Match Case & Whole Word** needs both. It selects at most 20,000 matches.
- **Column Mode** opens a short explanation of column mode.

These keys work while the cursor is in the text box:

| Key | What it does |
|---|---|
| {{Tab}} | Indents the line when several lines are selected, a whole line is selected, or only spaces are to the left of the cursor; then the cursor moves to the end of the line's leading spaces. Anywhere else in a line it types spaces up to the next tab stop |
| {{Shift+Tab}} | Decreases the indentation in the same cases. Anywhere else in a line it moves the cursor back one tab stop at a time, until only spaces are left of it, and the next press decreases the line's indentation |
| {{Ctrl+Shift+Up}}, {{Ctrl+Shift+Down}} | Moves the current line or the selected lines up or down |
| {{Home}} | Moves the cursor to the end of the line's leading spaces; from there, to the start of the line. A long line that wraps counts as one line |
| {{Shift+Home}} | The same, selecting every character the cursor passes |
| {{Ctrl+Shift+U}} | UPPER |
| {{Ctrl+U}} | lower |
| {{Alt+U}} | Proper |
| {{Ctrl+Alt+U}} | Sentence |

Tab stops are every two columns. A selection inside one line counts as a cursor at its end for {{Tab}} and at its start for {{Shift+Tab}}. The **Edit > Indent** menu items always indent or outdent the line or the selected lines, wherever the cursor is.

Because {{Tab}} indents, it no longer moves the cursor out of the text box. To leave the box with the keyboard, press {{Esc}} and then {{Tab}}.

Every one of these is a single step for Undo.

## The Search menu

| Shortcut | Command |
|---|---|
| {{Ctrl+F}} | Find |
| {{Ctrl+H}} | Replace |
| {{Ctrl+Alt+I}} | Incremental Search |
| (menu only) | Find and Select All |

**Find** opens a bar above the text: a search box, `<` and `>` buttons, the **Match case**, **Whole word** and **Regex** checkboxes, **Highlight all**, and the position of the match ("2/5"). {{Enter}} or {{Shift+Enter}} moves to the next or previous match, going round at the ends. If text is selected when you open the bar, it is searched for. **Close** or {{Esc}} closes the bar.

**Replace** adds a second line. Replace changes the selected match and moves to the next; Replace All changes every match as one step for Undo. In a regular expression, $1, $& and \n in the replacement stand for a group, the match and a new line.

**Incremental Search** is the same bar without Whole word and Regex, and without Replace. The text is found as you type, starting from the cursor. {{Enter}} keeps the match selected and closes the bar; {{Esc}} or **Close** closes it and puts the cursor back. The {{Up}} and {{Down}} keys move between matches.

**Find and Select All** opens the Find bar and, with something to find (selected text, or what is already in the box), turns every match into a selection at once. Otherwise type the text and press {{Enter}}. The result is the same as Edit > Multi-Select All: type, delete or paste over all of them, and {{Ctrl+Z}} undoes it in one step. The bar's options (Match case, Whole word, Regex) apply.

## The View menu

| Shortcut | Command |
|---|---|
| {{Ctrl+Plus}}, {{Ctrl+Minus}}, {{Ctrl+0}} | Zoom in, zoom out, default zoom (also {{Ctrl+mouse wheel}}) |

Items with a check mark are switches; the choices are kept in this browser between visits.

**Show Symbol** draws what cannot normally be seen, without moving any text. **Show Space and Tab** marks spaces with a dot and tabs with an arrow. **Show End of Line** marks every line break. **Show Non-Printing Characters** marks the no-break space and the invisible characters such as the zero-width space, soft hyphen and byte order mark, by name. **Show Control Characters & Unicode EOL** names control characters and the Unicode line and paragraph separators. **Show All Characters** switches these four together. **Show Indent Guide** draws a thin line at every second column of the blanks at the start of a line. **Show Wrap Symbol** puts an arrow in the right margin at every row that continues on the next row.

**Zoom** changes the size of the pane that has the focus: the text box, or the preview. Click in a pane first. The menu items change the pane you used last. When the focus is anywhere else, such as the menu bar, {{Ctrl+Plus}} and {{Ctrl+Minus}} are left to the browser, which zooms the whole page.

**Synchronized Scroll** keeps the preview and the text level. Each heading in the text is matched to the same heading in the preview, and between two headings the position is carried over in proportion. Scrolling either one moves the other. It needs the same number of headings in both; if some are drawn differently, the two scroll by the same fraction of their length instead.

**Edit in Preview** changes text where you see it in the preview; see [Edit in Preview](#edit-in-preview) below.

**Word Wrap** turns the wrapping of long lines on and off; with it off, the text box scrolls sideways.

**Margin** has **Line Number**, and **Change History**, which draws a bar beside each line changed since the page was opened: orange until you save with {{Ctrl+S}} or File > Save draft, green after. The automatic draft saving does not count as a save. Opening a page or file, or Discard draft, clears the bars. Undo does not take a bar away.

**Current Line Indicator** shades the line that has the cursor, or the lines when there are several cursors.

## Edit in Preview

Switch it on with the **Edit** button above the preview or with **View > Edit in Preview**; {{Esc}} switches it off.

**Edit in Preview** changes the page where you see it. With it on, the preview works on blocks: a paragraph, heading, list, table, code box, picture, notice, infobox, quote or rule. Every change is written into the text as one step for Undo ({{Ctrl+Z}}), and only the lines of that block are rewritten.

- **Typing in a block.** Click a paragraph, heading, list item or table cell and type. A bar above it has **Bold**, **Italic**, inline code, **Link** (also {{Ctrl+K}}) and a menu that turns the block into a paragraph, heading, bullet item or quote. Wiki links and keys show as boxed chips that stay whole. {{Enter}} saves the change into the text, {{Shift+Enter}} is ignored (a block here is one line), {{Esc}} cancels, and clicking another block saves and moves on. In a table cell, the bar also adds or removes the row or column. A block whose text the preview draws differently from how it is written (for example italics written with underscores) is not edited in place: its lines are selected in the text instead.
- **Selecting a block.** Point at a block to see it outlined with a grip (two columns of dots) on its left. Click the grip to select the block. The selected block has a ring and a bar with **Move up**, **Move down**, **Edit…**, **Copy**, **Delete** and **Add**. The bar stays with the selected block while you point at others.
- **Moving.** Drag the grip to another place; a line shows where the block will land. **Move up** and **Move down** do the same one step at a time.
- **Adding.** Point between two blocks and press the line that appears (**Add a block here**), or press **Add** on the bar to add after the selected block. The menu offers a paragraph, heading, list, table (it asks for the size), key/value table, code box, notice, infobox, picture, quote, spoiler or rule, and starts editing it.
- **Table settings.** With the cursor in a table cell, **Table...** on the bar opens a window with the sort type of each column, whether the first column is a row label, and whether the table is a key/value table (no heading row, names in the first column). With the whole table selected, **Edit...** opens the same window.
- **Edit…** opens a window for the parts of a code box (language and code), a picture (file, description, caption and options) or a notice, infobox or quote (type, title and text).
- **Pictures.** A picture placed left or right sits beside the text, so a strip labeled "Picture, left" or "Picture, right" marks where it falls in the text, and a dashed line labeled "Picture starts here" shows the gap it is anchored in. With a picture selected, drag the handle on its lower outer corner to change its width (the size shows while dragging; it is written as the picture's width option).
- **Keyboard.** With the preview focused and nothing selected, {{Up}} and {{Down}} move a highlight from block to block and {{Enter}} selects the highlighted block. With a block selected: {{Enter}} or {{F2}} edits it, {{Up}} and {{Down}} move it, {{Delete}} or {{Backspace}} deletes it, and {{Esc}} deselects it (a second {{Esc}} switches the mode off). For a selected picture, {{Left}} and {{Right}} change its side (left, center, right), and {{+}} and {{-}} change its width by 10 px (50 px with {{Shift}} held).

## The Format menu

| Shortcut | Command |
|---|---|
| {{Ctrl+B}}, {{Ctrl+I}}, {{Ctrl+E}} | Bold, Italic, Inline Code |
| {{Ctrl+K}} | Wiki Link |
| {{Ctrl+2}} to {{Ctrl+6}} | Heading 2 to Heading 6 |

The items put Markdown marks around the selection, or at the start of the lines it touches. Choosing the same item again takes the marks off. Each one is a single step for Undo, and with several cursors the marks, headings, lists, quotes and callouts are done at every one of them.

- **Bold, Italic** and **Bold Italic** add up: italic on bold text makes it both, and bold on bold italic leaves it italic. A selection over several lines is marked line by line, leaving out blank lines and the spaces at the ends of each line.
- With nothing selected, the item marks the word at the cursor. Where the cursor is not in a word, it types an empty pair of marks with the cursor between them; used there again, it removes the pair.
- **Inline Code, Spoiler, Wiki Link** and **Key** work the same way, with `` ` ``, `>!` and `!<`, `[[` and `]]`, and `{{` and `}}`. **Link** makes `[text](url)` and selects the address to be typed; if the selection is an address it becomes the address instead.
- **Heading** sets the lines to the level you choose, replacing the one they have; the same level again, or **Paragraph**, makes them plain text. There is no Heading 1, because the page title is the first heading.
- **Bullet List, Numbered List** and **Quote** add their marks to the lines, replacing another kind of list. Used again on lines that already have them, they remove them. A list inside a quote keeps the quote.
- **Callout** makes the lines a quote that opens with the type you choose: Note, Tip, Important, Warning or Caution. With the cursor inside a callout it changes the whole callout; choosing its own type again, or **Remove Callout**, turns it back into plain lines.
- **Code Block** puts the lines between fence lines. Its list holds Plain Text and every language the site colors (Bash, Batch, C#, Config, Console, HTML, INI, JavaScript, JSON, Lua, Markdown, PowerShell, Properties, Python, Shell, SVG, TOML, TypeScript, XAML, XML, YAML and Zsh), and the choice is written after the opening fence. On lines that are already in a box, a different language changes the box's language, Plain Text removes it, and the same language takes the fence off.
- **Horizontal Rule** adds a line of dashes with a blank line on each side. **Align Table** sets the table the cursor is in out in columns of equal width, keeping the alignment colons and column tags in the divider row. **Table Column** sets how the column under the cursor sorts for readers (number, percent, duration, date, yes/no, text or automatic) and marks the first column as the row label. **Clear Formatting** removes bold, italic, code, spoiler, key and link marks from the selection, or from the line when nothing is selected, and keeps the text.
- **Snippets** insert a starting point and select the words to type over: **Table 2x2** and **Table 3x3** (columns by rows of text, under a heading row), **Key/Value Table**, **Image**, **Spoiler Block**, **Infobox**, **Footnote** and **Front Matter**. Footnote puts a reference such as `[^note1]` at the cursor and its note line at the end of the page, with the note text selected to type over. Front Matter adds the title, category and summary lines at the top of the page, and is greyed out when the page already has them.

## Finishing what you type

The editor closes brackets and marks, carries lists and tables on, and offers names as you type. All of it works with one cursor; with several cursors the keys do what they always do. Nothing is changed inside a code box, except that {{Enter}} keeps the indentation there. Each change is a single step for Undo.

- **Pairs.** Typing `(`, `[`, `{`, `` ` ``, `*` or `>!` adds the closing half and puts the cursor between them, so `[[` makes `[[]]`. Typing the closing half steps over it. Backspace between an empty pair removes both. A `*` makes a pair only where emphasis can begin (after a space or an opening bracket, not at the start of a line, where it is a bullet, or inside a word). With text selected, `*`, `` ` ``, `[`, `(` and `{` put the marks around it and keep it selected, so `[` twice makes a wiki link and `*` twice makes bold.
- {{Enter}} in a list starts the next item, with the next number in a numbered list; on an empty item it ends the list. In a quote or a callout it carries the `>` on, and on an empty quote line it ends the quote. After an opening code fence it adds the closing fence below. In a table it adds a row; in the heading row of a table that has no divider yet it adds the divider as well, and in an empty last row it ends the table.
- {{Tab}} and {{Shift+Tab}} in a table row move to the next or previous cell and set the table out in columns. {{Tab}} in the last cell adds a row. {{Esc}} then {{Tab}} still leaves the text box.
- **Suggestions** appear in a list under the cursor. {{Up}} and {{Down}} choose, {{Enter}} or {{Tab}} or a click accepts, and {{Esc}} closes the list until you type something different. After `[[` they are the Game Guide pages, then `topic:` and `site:` names; after `[[Page#` the headings of that page (after `[[Glossary#`, the glossary's terms); after `[^` the footnote names already used on the page; after `{{` the key and button names; after `> [!` the box types; after `![text](` or an `image:` line the pictures already in the guide's folders. In the front matter they are the field names, the categories already in use, and, after `related:`, the pages and topics. Accepting adds the closing `]]`, `}}` or `)` unless an auto-closed one is already there.

## Several cursors and selections

You can hold more than one cursor or selection at once and edit at all of them together. On a Mac, use {{Cmd}} where this says {{Ctrl}}.

| Key or mouse | What it does |
|---|---|
| {{Ctrl+click}} | Adds a cursor where you click. {{Ctrl+click}} on a cursor or selection you already added takes it away again |
| {{Ctrl+double click}} | Adds the word under the pointer, or the run of spaces or punctuation if you click on that |
| {{Ctrl+triple click}} | Adds the whole line under the pointer, with its line break |
| {{Alt+drag}} | Box selection: drag a rectangle, and every line it crosses gets a selection over the same columns. It replaces the selections you had. A line shorter than the box is selected only as far as it goes |
| {{Alt+Shift+Down}} | Column mode: adds a cursor on the next line down in the same column. If the column grows upward from where it started, it takes the top cursor away instead |
| {{Alt+Shift+Up}} | The same upward |
| {{Esc}} | Goes back to one cursor, the one you added last |
| A click with no key | Goes back to one cursor where you click |

With several cursors, typing, {{Backspace}}, {{Delete}}, {{Ctrl+Backspace}}, {{Ctrl+Delete}} and {{Enter}} act at every one. Pasting puts the same text at each cursor, or one line of it at each when the clipboard has as many lines as there are cursors. Copy and cut join the selected pieces with line breaks. The arrow keys, {{Home}} and {{End}} move every cursor (with {{Shift}} they extend every selection, with {{Ctrl}} they go a word at a time). {{Tab}}, {{Shift+Tab}}, the case shortcuts and Move Line, and the Edit menu commands, act on each selection; lines that two selections share are changed once, and the line operations treat lines that touch as one block.

One {{Ctrl+Z}} undoes a change made at all the cursors together. It restores the text and one cursor, not all of them. Select All, {{Page Up}} and {{Page Down}}, and {{Ctrl+Home}} and {{Ctrl+End}} also go back to one cursor, and so does anything that changes the text another way, such as a File command. A change that would rewrite more than 400,000 characters between the first and last selection is refused.

Some Linux desktops use {{Alt+drag}} to move windows, so the box selection may never reach the page there; use {{Alt+Shift+Up}} and {{Alt+Shift+Down}} instead. Touch screens have no {{Ctrl}} or {{Alt}}. Screen readers and the spelling menu only see one of the selections.

## Help

The **?** at the end of the menu bar, or {{F1}} from anywhere in the editor, opens this help in a window that floats over the editor. It takes no room from the two panes and the text behind it stays editable.

- Drag the title bar to move the window and the bottom-right corner to resize it. It remembers where you left it.
- **Contents** lists five pages: How to use the editor, How to write a guide page, Formatting reference, Extended formatting and Fixing a page. The page you are reading opens out into its sections, and each section is a page of its own.
- **<** and **>**, or the {{Left}} and {{Right}} arrow keys while the window has the focus, go to the previous and next page.
- **Close** or {{Esc}} closes the window. **Open on the site** shows the page in a new tab. Links to other site pages also open in a new tab, so your draft is not disturbed.

On a narrow screen the window fills the editor instead of floating.

## Editing an existing page

There are two ways in: **File > Open a guide page**, or the **Edit in the browser editor** link at the bottom of any Game Guide page. The page's text is loaded into the editor, and the title bar says "editing guide/the-page.md". Change it as you would a new page; the preview, the Problems check and the draft work the same.

Submitting is different. GitHub's page for changing an existing file cannot be filled in from a link, so **Copy and open on GitHub** copies your whole page and opens that file on GitHub. There, select all of the old text ({{Ctrl+A}}) and paste yours over it ({{Ctrl+V}}), then commit as usual. As always, fork the project first.

The editor keeps one draft. Opening a page replaces the draft, after asking, and the draft remembers which page it is a copy of. Choosing **New from template**, **Open from this computer** or **Discard draft** ends the editing of that page. A page you are editing keeps its file name and its pictures stay where they are; its own title is not counted as a clash, but another page's title still is.

## Your draft

The editor saves your draft in this browser a moment after you stop typing, and the status bar says so. Close the tab and come back, and it is still there. It is not saved anywhere else, so clearing your browser data removes it. Copy the text somewhere safe if the work matters.

## Submitting

Press **Submit on GitHub**. GitHub opens on its "new file" screen with your page already filled in, ready for you to commit and open a pull request. The steps from there are on the page [[site:How to write a guide page]], from step 5.

While the page has an error, the button is outlined in red and pressing it opens a window listing the errors, with **Cancel** and **Submit anyway**. Press a line in the list to go straight to that error in the text. Cancel, {{Esc}}, or a click outside the window takes you back and opens the Problems panel. Warnings never open this window.

All the editor's windows work this way: {{Esc}} or a click outside closes them without changing anything, and when one asks you to confirm a change, **Cancel** has the focus so pressing {{Enter}} never confirms by accident.

If the page is too long to carry in the link, the button reads **Copy and paste on GitHub**: it copies the text, then opens GitHub's new-file page, where you paste it.

> [!IMPORTANT]
> As with any contribution, fork the project first. See [[site:How to write a guide page]].
