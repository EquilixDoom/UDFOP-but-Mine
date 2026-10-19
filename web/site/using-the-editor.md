---
title: How to use the editor
category: Site Guide
summary: How to write a Game Guide page in the browser editor, see it drawn as you type, fix what the Problems check finds, and send it to GitHub.
---

The guide editor is the "Write a guide page" link in the main menu. You type Markdown in the **Editor** pane on the left and see the page drawn in the **Preview** pane on the right as you type. Nothing is uploaded until you submit, and your draft stays in your browser.

The editor always uses the whole width of the window, and the main menu and Settings open as pop-ups while you are in it, whatever you chose in Settings. Your own choices come back when you leave.

> [!NOTE]
> On a narrow screen the preview sits under the text box instead of beside it.

## Writing

A new draft starts from the guide template. Replace the placeholders, delete the Tip box at the top once you have read it, and fill in the `title`, `category` and `summary` lines at the very top. The formatting is described on the page [[site:Formatting reference]].

The text is colored as you type: the front matter, headings, code boxes, notice boxes, bold, italic, code, links and spoilers each have a color. A link to a page that exists is colored as a link, and a link to a page that does not exist is red with a wavy underline.

Each pane has a title bar and a status bar. The Editor's status bar shows the line and column, the word count and when the draft was saved. The Preview's title bar shows the file name the page will get, made from your title, and its status bar shows how much of the Submit link's length limit the page uses.

## Problems

The **Problems** button in the Editor's title bar checks your page every time you type. It is green with a tick when nothing is wrong, amber when there are only warnings, and red when there is an error. Press it to open the Problems panel, which has its own title bar. Press a line in the list to select the text it is about. Drag the thin handle on the panel's top edge, or focus it and press the up and down arrow keys, to change its height; the height is remembered.

**Errors** are things that would break the page or clash with another, and they stop Submit (see below):

- there is no `title`, or the front matter at the top has no closing `---` line
- the page is empty
- another page already has the same title or file name
- a picture does not exist (the editor cannot add pictures, so add them in your pull request)
- a code box is never closed, which turns the rest of the page into code

**Warnings** are worth a look but do not stop Submit:

- no `summary`, or a category spelled differently from the existing pages
- a link to a page, section, topic or patch that does not exist, which shows as a red or plain link. A page you mean to write later can be listed on an `expected-missing:` line in the front matter
- a `related:` entry that matches nothing
- an unknown code box language or notice box type, or a code box line with more than a language name after the backticks
- a Site Guide page or topic linked without its `site:` or `topic:` prefix
- an infobox row with no value, more than one infobox, or an infobox that is not the first thing on the page
- an unclosed spoiler, HTML or script-like text, or an unknown picture option or width

The check reads another page's headings, and looks for picture files, the first time you link to them, so a warning about a section or a picture can take a second to appear or go away.

## The File menu

- **New from template** replaces the text with one of the starter templates (How it works, Item, Place, Creature or boss) and selects the first placeholder so you can type over it.
- **Open a guide page** lists the pages already in the Game Guide, grouped by category with each page's summary. Type to narrow the list (it matches titles, categories and summaries), use the arrow keys and Enter or click to choose a page to edit it (see below).
- **Open from this computer** (Ctrl+O) loads a Markdown or text file (`.md`, `.markdown`, `.mdown` or `.txt`, up to 2 MB) into the editor.
- **Save draft** (Ctrl+S) saves the draft now instead of waiting.
- **Download .md** saves the text as a file named after your title, for example `my-page.md`.
- **Discard draft** deletes the saved draft and starts a new page from the template.

Whenever one of these would replace the text you have written, the editor asks first. You can cancel, replace the text (Ctrl+Z brings the old text back), or choose **Download, then replace** to save a copy to your device before it goes.

## The Edit menu

- **Undo, Redo, Cut, Copy, Delete** and **Select All** work on the text box as usual.
- **Paste** puts the clipboard's text where the caret is, or over the selection. A browser asks before a page may read your clipboard; if you decline, or the browser does not allow it, the status bar says to press Ctrl+V instead.
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
| Tab | Indents the line when several lines are selected, a whole line is selected, or only spaces are to the left of the cursor; then the cursor moves to the end of the line's leading spaces. Anywhere else in a line it types spaces up to the next tab stop |
| Shift+Tab | Decreases the indentation in the same cases. Anywhere else in a line it moves the cursor back one tab stop at a time, until only spaces are left of it, and the next press decreases the line's indentation |
| Ctrl+Shift+Up, Ctrl+Shift+Down | Moves the current line or the selected lines up or down |
| Home | Moves the cursor to the end of the line's leading spaces; from there, to the start of the line. A long line that wraps counts as one line |
| Shift+Home | The same, selecting every character the cursor passes |
| Ctrl+Shift+U | UPPER |
| Ctrl+U | lower |
| Alt+U | Proper |
| Ctrl+Alt+U | Sentence |

Tab stops are every two columns. A selection inside one line counts as a cursor at its end for Tab and at its start for Shift+Tab. The **Edit > Indent** menu items always indent or outdent the line or the selected lines, wherever the cursor is.

Because Tab indents, it no longer moves the cursor out of the text box. To leave the box with the keyboard, press Esc and then Tab.

Every one of these is a single step for Undo. **Insert** is listed but does not do anything yet.

## Several cursors and selections

You can hold more than one cursor or selection at once and edit at all of them together. On a Mac, use Cmd where this says Ctrl.

| Key or mouse | What it does |
|---|---|
| Ctrl + click | Adds a cursor where you click. Ctrl + click on a cursor or selection you already added takes it away again |
| Ctrl + double click | Adds the word under the pointer, or the run of spaces or punctuation if you click on that |
| Ctrl + triple click | Adds the whole line under the pointer, with its line break |
| Alt + drag | Box selection: drag a rectangle, and every line it crosses gets a selection over the same columns. It replaces the selections you had. A line shorter than the box is selected only as far as it goes |
| Alt + Shift + Down | Column mode: adds a cursor on the next line down in the same column. If the column grows upward from where it started, it takes the top cursor away instead |
| Alt + Shift + Up | The same upward |
| Escape | Goes back to one cursor, the one you added last |
| A click with no key | Goes back to one cursor where you click |

With several cursors, typing, Backspace, Delete, Ctrl+Backspace, Ctrl+Delete and Enter act at every one. Pasting puts the same text at each cursor, or one line of it at each when the clipboard has as many lines as there are cursors. Copy and cut join the selected pieces with line breaks. The arrow keys, Home and End move every cursor (with Shift they extend every selection, with Ctrl they go a word at a time). Tab, Shift+Tab, the case shortcuts and Move Line, and the Edit menu commands, act on each selection; lines that two selections share are changed once, and the line operations treat lines that touch as one block.

One Ctrl+Z undoes a change made at all the cursors together. It restores the text and one cursor, not all of them. Select All, Page Up and Page Down, and Ctrl+Home and Ctrl+End also go back to one cursor, and so does anything that changes the text another way, such as a File command. A change that would rewrite more than 400,000 characters between the first and last selection is refused.

Some Linux desktops use Alt + drag to move windows, so the box selection may never reach the page there; use Alt + Shift + Up and Down instead. Touch screens have no Ctrl or Alt. Screen readers and the spelling menu only see one of the selections.

## Editing an existing page

There are two ways in: **File > Open a guide page**, or the **Edit in the browser editor** link at the bottom of any Game Guide page. The page's text is loaded into the editor, and the title bar says "editing guide/the-page.md". Change it as you would a new page; the preview, the Problems check and the draft work the same.

Submitting is different. GitHub's page for changing an existing file cannot be filled in from a link, so **Copy and open on GitHub** copies your whole page and opens that file on GitHub. There, select all of the old text (Ctrl+A) and paste yours over it (Ctrl+V), then commit as usual. As always, fork the project first.

The editor keeps one draft. Opening a page replaces the draft, after asking, and the draft remembers which page it is a copy of. Choosing **New from template**, **Open from this computer** or **Discard draft** ends the editing of that page. A page you are editing keeps its file name and its pictures stay where they are; its own title is not counted as a clash, but another page's title still is.

## Your draft

The editor saves your draft in this browser a moment after you stop typing, and the status bar says so. Close the tab and come back, and it is still there. It is not saved anywhere else, so clearing your browser data removes it. Copy the text somewhere safe if the work matters.

## Submitting

Press **Submit on GitHub**. GitHub opens on its "new file" screen with your page already filled in, ready for you to commit and open a pull request. The steps from there are on the page [[site:How to write a guide page]], from step 5.

While the page has an error, the button is outlined in red and pressing it opens a window listing the errors, with **Cancel** and **Submit anyway**. Press a line in the list to go straight to that error in the text. Cancel, Esc, or a click outside the window takes you back and opens the Problems panel. Warnings never open this window.

All the editor's windows work this way: Esc or a click outside closes them without changing anything, and when one asks you to confirm a change, **Cancel** has the focus so pressing Enter never confirms by accident.

If the page is too long to carry in the link, the button reads **Copy and paste on GitHub**: it copies the text, then opens GitHub's new-file page, where you paste it.

> [!IMPORTANT]
> As with any contribution, fork the project first. See [[site:How to write a guide page]].
