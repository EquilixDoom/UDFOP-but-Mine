---
title: Troubleshooting and FAQ
category: Contributing
summary: Fixes for the problems people hit most when writing a guide page, and what each page-check message means.
---

Something not working? Find your problem below. If it is not here, report it from [Feedback & Bugs](#/feedback) and say what you tried.

For the steps of adding a page, see [[How to write a guide page]]. For the syntax, see [[Formatting reference]].

## Getting started on GitHub

### Forking fails, or says "An unexpected error occurred"

> [!WARNING]
> Check that your email address is verified in your GitHub settings. Very new accounts are sometimes blocked from forking for a while.

Do the steps by hand from the project page, [github.com/tau-samsara/udfop](https://github.com/tau-samsara/udfop): click **Fork**, then **Create fork**. Do not use the site's **Edit this page** link or a red link to make your first fork, because forking from GitHub's editor fails more often. Once you have your fork, those links work well.

### "Edit this page" asks me to fork, or opens the wrong copy

Fork first, as above. Then open the page's file in your own copy, under `web/guide`, and click the pencil icon.

### My fork is out of date

Open your copy's main page and press **Sync fork**, then **Update branch**. Do this before you start a new page, so you are editing the latest version.

### I saved the file but nothing happened

Saving a file in your copy does not send it anywhere. You have to open a pull request: after **Propose new file**, click **Create pull request** twice. Until you do, nobody knows about your page. You can find your pull requests under the **Pull requests** tab of the project page.

## My page does not show up

Work down this list.

1. **Has it been merged?** A maintainer reads every page first. Open your pull request and look for the purple **Merged** label.
2. **Has it been a few minutes?** The site rebuilds after a merge, which takes a few minutes. Then refresh the page with {{Ctrl+Shift+R}}, because your browser may keep an old copy.
3. **Is the file in the right place?** It must be inside `web/guide/` and its name must end in `.md`.
4. **Does the name start with `_` or `.`?** Those files are ignored on purpose, so remove the underscore.
5. **Does the page say `unlisted: yes`?** That keeps it out of the Game Guide lists. The page still opens by its address and in search.
6. **Is the front matter closed?** The block at the top starts and ends with a line of three dashes. If the closing line is missing, the page check reports an error.
7. **Is the title the same as another page's?** Titles must be unique, even across folders. The check reports the clash as an error.

If it is in search but not in the lists, it is almost certainly `unlisted`. If it is in neither, it has not been published yet.

## Something looks wrong on the page

### My link is plain text, or shows the brackets

Links to other pages use **double** square brackets, `[[Page title]]`. Links to other websites use a square bracket and a round bracket, `[words](https://example.com)`. A link written inside backticks is shown as typed, on purpose.

### A link is red

A red link means no guide page has that title. Check the spelling, or whether the page was renamed. Matching ignores capital letters but not typing mistakes. For a Patch Notes topic or a patch, the name must start with `topic:` or `patch:`. If you meant to link to a page that is not written yet, the red link is correct: clicking it starts that page.

### My picture does not appear

- The path is read from the page's own folder, not from the project's top. A page directly in `web/guide/` writes `images/name.png`. A page inside a folder writes `../images/name.png` to reach the shared folder, or `images/name.png` for an `images` folder beside it.
- Capital letters and spaces in the file name must match exactly.
- Use PNG, JPG, WebP or GIF.
- Make sure you uploaded the picture to the same branch as the page. If you uploaded it after opening the pull request, it joins that pull request automatically.
- The page check names a missing picture as an error.

### My table is broken

Check that the second row is a line of dashes with one set of dashes for each column, such as `|---|---|`. A `|` that belongs inside a cell needs a backslash in front of it, written `\|`.

### My notice box looks like an ordinary quotation

The tag must be alone on the first line of the box, written exactly `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]`. Every line of the box must start with `>`, including blank lines between paragraphs.

### My code box has no colours

Put the language name straight after the three backticks, with no space, and use one of the names in the [[Formatting reference]]. A name the site does not know leaves the box plain. Boxes over about 20,000 characters are never coloured.

### My `{{key}}` shows the braces

Keycaps do not work inside the text of a link or inside backticks. Move the braces out of the link, or write them in a code span if you mean to show them as typed.

### A spoiler is not hidden

Both `>!` and `!<` must be on the same line. A line that begins with `>!` is treated as a paragraph, not a quotation.

### A heading is missing from the Contents list

Only `##` and `###` headings are listed. The page title is added for you, so do not repeat it with a single `#`.

## The page check

When you open a pull request, a check runs on your pages. A red mark means it found an **error**, which must be fixed before the page can be merged. A **note** does not stop anything, but a reviewer may ask about it. Open **Details** next to the check to see the messages.

| The message says | What it means | What to do |
|---|---|---|
| front matter starts with --- but never closes | The block at the top has no closing line. | Add a line of three dashes after the settings. |
| the page is empty | The file has nothing below the front matter. | Write the page. |
| the title or name clashes with "x.md" | Two pages have the same title (or the same name apart from capitals). | Change one title. |
| the picture "x" does not exist | No file is at that path. | Fix the path, or upload the picture. |
| a top-level folder named "category" cannot be used | The site keeps that word for its own addresses. | Rename the folder. |
| no title in the front matter | The page has no `title:` line. | Add one. |
| contains HTML tags, script-like text or control characters | The page has something like `<b>`. The site shows it as plain text. | Remove it, or put it in backticks if you meant to show it. |
| file names are easier to link with only letters, numbers, spaces and hyphens | The file name has other characters. | Rename it, using lower case and hyphens. |
| picture width is outside 40 to 1200 pixels | A width in braces is too small or large. | Use a number from 40 to 1200. |
| unknown picture option | A word in braces is not `left`, `right`, `center` or a width. | Fix or remove it. |
| not a page or a picture the site can show | A file in the guide folder is neither. | Use PNG, JPG, WebP or GIF, or remove it. |
| is N KB, please shrink it | A picture is over about 500 KB. | Crop or shrink it. |
| is not used by any page | A picture is uploaded but no page uses it. | Use it, or remove it. |
| pictures are easier to find in an images folder | A picture is not in an `images` folder. | Move it into one. |
| the code box language is not one the site colours | The language name is not on the list. | Use a listed name, or none. |
| the notice box type is not one the site knows | The tag is not one of the five. | Use NOTE, TIP, IMPORTANT, WARNING or CAUTION. |
| link `[[x]]` matches no guide page or topic yet | Nothing has that title. | Fix the spelling, or write the page. |
| the category is spelled more than one way | Two pages spell the same category differently. | Use one spelling. |
| related: "x" matches no… | A name in `related:` matches nothing. | Fix the name, or add `guide:`, `topic:` or `patch:`. |

## Previewing on your computer

### The Game Guide says it could not be loaded

If you opened `index.html` straight from a folder, your browser blocks it. Serve the `web` folder instead, with `python -m http.server 8000 --directory web`, and open <http://localhost:8000>. If you just added pages, run `python tools/guide.py` first so the list is refreshed.

### Mine shows an old version

Press {{Ctrl+Shift+R}}. If you changed a page, run `python tools/guide.py` again so the list and search text are rebuilt.

Back to the [Site Guide](#/site).
