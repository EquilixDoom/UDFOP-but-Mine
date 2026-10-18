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

## Your draft

The editor saves your draft in this browser a moment after you stop typing, and the status bar says so. Close the tab and come back, and it is still there. It is not saved anywhere else, so clearing your browser data removes it. Copy the text somewhere safe if the work matters.

## Submitting

Press **Submit on GitHub**. GitHub opens on its "new file" screen with your page already filled in, ready for you to commit and open a pull request. The steps from there are on the page [[site:How to write a guide page]], from step 5.

While the page has an error, the button is outlined in red and pressing it opens a window listing the errors, with **Cancel** and **Submit anyway**. Cancel takes you back and opens the Problems panel. Warnings never open this window.

If the page is too long to carry in the link, the button reads **Copy and paste on GitHub**: it copies the text, then opens GitHub's new-file page, where you paste it.

> [!IMPORTANT]
> As with any contribution, fork the project first. See [[site:How to write a guide page]].
