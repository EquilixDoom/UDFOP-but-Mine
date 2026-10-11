---
title: Anatomy of a page
category: Contributing
summary: The parts of a page on the site, which part of your file makes each one, and what the site adds by itself.
---

A Game Guide page looks like more than the file you wrote. The site builds a title block, a Contents list, a References section and more around your text. This page names each part, so you know what you control and what you leave to the site. For the steps of writing a page, see [[How to write a guide page]].

## The whole screen

```text
+--------------------------------------------------------------+
| header:  ☰ Main menu   logo   search box                  ⚙  |
+------------+------------------------------------+------------+
| left       | title block                        | right      |
| sidebar    | ------------------------------     | sidebar    |
|            | your text, in sections             |            |
| Contents   |   ...                              | Settings   |
| (and the   | References                         |            |
| Main menu, | Edit this page                     |            |
| if docked) | ------------------------------     |            |
|            | footer                             |            |
+------------+------------------------------------+------------+
```

- **The header** is on every page. It holds the Main menu button, the logo, the search box and the Settings gear.
- **The left sidebar** holds the Contents list, and the Main menu if the reader docked it there. It is empty when both are hidden.
- **The right sidebar** holds Settings, which is docked there by default on wide windows.
- **The middle column** is the page itself. Its width is the reader's choice (see [[Using the site]]), not yours.

You write only the middle column. Readers decide what appears in the sidebars.

## The page itself

From the top of the middle column down:

| Part | Where it comes from |
|---|---|
| **Title** | Your `title` line. If your text starts with a heading that repeats the title, the site drops it. |
| **"From Unofficial Daggerfall Online Pages"** | Added by the site on every page. |
| **Breadcrumb** | Built from your `category`: Game Guide › your category, with both parts linked. A page with `unlisted: yes` has none. |
| **Contents button (☰)** | Added by the site, and shown only when the reader has not docked Contents in the sidebar. It sits beside the title, and once the reader scrolls past the title it floats at the top left of the window. It opens the Contents as a pop-up. |
| **Your text** | Everything below the front matter. Each `##` and `###` heading starts a section. |
| **References** | Built from the links in your text and your `related` line. |
| **Edit line** | "Edit this page (fork the project first) · How to contribute." Added by the site. |
| **Footer** | The change, topic and patch counts, the Feedback & Bugs link and the disclaimer. Added by the site. |

A Site Guide page, such as this one, has the same parts, except its breadcrumb reads "Site Guide", and the Site Guide front page has none.

## Your text

### Sections and the Contents list

Every `##` and `###` heading becomes a section with a rule under it, and an entry in the Contents list. The Contents list starts with a **(Top)** link, then lists your `##` sections. Each `###` subsection is nested under its section, behind a small arrow that the reader opens. Nothing is opened for them.

A heading with a single `#` is treated as `##`, so it is listed too. Headings with `####` or deeper are shown but not listed.

### Pictures

A picture on its own line fills the column. With a caption or a side, it floats beside the text with a framed caption, and text wraps around it. A heading, a table or a centered picture always starts below it. On a phone, a floated picture moves above the text. See [[Formatting reference]].

### Boxes

Notice boxes (Note, Tip, Important, Warning, Caution) are full-width colored panels with a label. Code boxes have a bar with the language name and a Copy button, and long lines scroll sideways inside them. Tables size to their content.

### Links

Each link carries a small marker after it that says where it goes: **GP** for the Game Guide, **SG** for the Site Guide, **PN** for the Patch Notes, **↗** for another website. A link to a page that does not exist is red. On a computer, pointing at a link to a page shows a **preview** card with the page's category and its `summary`, so a good summary does double duty.

## What the site adds

You do not write any of these. They come from what you wrote, or from the site itself.

- **The Contents list.** One entry for each of your headings.
- **The References section.** One entry for each page, topic, patch or website you linked, in the order you first linked it, plus anything in `related`. It is split into Game Guide, Site Guide, Patch Notes and External Links.
- **The breadcrumb and the list entries.** Your page appears in the Game Guide under its category, with its `summary` beside its name, and in search.
- **The preview card, the link markers and the colors in code boxes.**

## On a narrow screen

On a phone, or any window under about 860 pixels wide, the page is one column. The sidebars are gone, so:

- **There is no Contents list.** Instead, each `##` and `###` section **folds**, closed to begin with. Tapping a heading opens it.
- **The Main menu and Settings** open as pop-ups from the header buttons.
- **Floated pictures** move above the text and take the full width.

Check that your page makes sense with every section closed: the headings are all a reader sees at first, so make each one say what is inside.

## What you cannot control

The reader's choices decide these, and the site does the rest.

- **Theme, color mode, text size and page width.** See [[Using the site]].
- **Whether the sidebars are shown.**
- **Where your page appears in the Game Guide.** It is alphabetical within its category, and the category order is alphabetical too.
- **Which pages appear in the main menu.** The menu has only a few fixed links. Pages are found through the Game Guide, categories, search and the links other pages make.

Back to the [Site Guide](#/site).
