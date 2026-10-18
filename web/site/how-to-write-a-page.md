---
title: How to write a guide page
category: Site Guide
summary: A step-by-step walkthrough for adding a page to the Game Guide or fixing one, from your first fork to seeing it live.
---

This page walks you through adding a page to the Game Guide, or fixing an existing one, from your first fork to seeing the page on the site. Anyone can do it: a page is one plain text file that you write in your browser, and you need only a free GitHub account, with nothing installed.

> [!IMPORTANT]
> The project must be forked before you can contribute to the wiki. Fork from the [project’s own page](https://github.com/tau-samsara/udfop/fork) first. Don’t rely on “Edit this page on github”, because forking from there often fails.

> [!TIP]
> Prefer not to write in GitHub's editor? The [[site:How to use the editor|browser editor]] gives a live preview and checks your page as you type, and sends it to GitHub when it is ready. To change a page that already exists, use **Open this page in the Editor** at the bottom of the page, or **File > Open a guide page** in the editor.

## The short version

1. **Sign in to GitHub.** A free account is enough, and a new account must have its email address confirmed.
2. **Fork the project, once.** Go to the project page, [github.com/tau-samsara/udfop](https://github.com/tau-samsara/udfop), click **Fork** at the top right, then **Create fork**. You are taken to your own copy, at `github.com/your-name/udfop`. Everything below happens in your copy. (Or go straight to the [fork page](https://github.com/tau-samsara/udfop/fork).)
3. **Create your page in your copy.** Open the `web/guide` folder, click **Add file**, then **Create new file**. Name it in lower case with hyphens and end it with `.md`, such as `party-rest.md`. For the starting text, open [the template](https://github.com/tau-samsara/udfop/blob/main/web/guide/_template.md), use its **Copy raw file** button, and paste it in. Writing about an item, a place or a creature? Use [the item template](https://github.com/tau-samsara/udfop/blob/main/web/guide/_template-item.md), [the place template](https://github.com/tau-samsara/udfop/blob/main/web/guide/_template-place.md) or [the creature template](https://github.com/tau-samsara/udfop/blob/main/web/guide/_template-creature.md) instead.
4. **Write the page.** Fill in the three lines at the top (`title`, `category` and `summary`), then write underneath.
5. **Save it.** Click **Commit changes**. Choose **Create a new branch for this commit and start a pull request**, then click **Propose new file**.
6. **Create the pull request.** GitHub shows a comparison of your change. Click **Create pull request**, then click **Create pull request** once more on the next screen.
7. **Wait for review.** A maintainer reads it and may ask for changes, which you make on the same pull request. Once it is merged, the page appears on the site within a few minutes. You do not need to edit any menu or list: the site builds those from the page files.

> [!IMPORTANT]
> Creating the pull request is the step people miss. Until you do it, nobody knows about your page.

To fix an existing page, fork the project as above, open the page's file in your copy under `web/guide`, click the pencil icon to edit it, and finish with the same commit and pull request steps.

> [!TIP]
> If you forked a while ago, press **Sync fork** on your copy's main page first, so you are editing the latest version.

The **Edit this page on github** link and the red links to missing pages open the same editor. They are shortcuts, and they work best once you already have your fork.

> [!WARNING]
> If one fails, or GitHub shows "An unexpected error occurred" while forking, do the steps above by hand and check that your email address is verified. Very new accounts are sometimes blocked from forking for a while. If you are stuck, report it from [Feedback & Bugs](#/feedback).

## How a file becomes a page

This is a whole page file. It is named `party-rest.md`. The top block between the `---` lines is the page's *front matter*: a few labelled settings. Everything below it is the page text.

``` md
---
title: Party rest
category: Survival
summary: How resting works for a party.
related: topic:Resting, guide:Camping
---

Resting restores health while the party camps.

## Who can rest

Anyone in the party. See [[Camping]] and [[topic:Party rest]].
```

Here is where each part shows up on the site:

| In the file | What it does on the site |
|---|---|
| `title` | The page heading and the browser tab. It is also the name other pages use to link to this one: `[[Party rest]]`. Titles must be unique, and link matching is case-insensitive, so `[[controls]]` works too. |
| `category` (Optional) | Puts the page in a group. The group appears on the **Game Guide** page, as its own page listing, and in the breadcrumb at the top of the page. |
| `unlisted` (Optional) | Written `unlisted: yes`. Keeps the page out of the **Game Guide** page and the category pages, and out of the page counts. The page can still be opened by its address, by a link and by search. Pages about the project itself go in the Site Guide instead (`web/site/`). |
| `summary` (Optional) | The one-line description shown next to the page's name in lists and in search results. |
| `related` (Optional) | Pages and topics to list in the References section even though the text does not link them. In the example it adds the Patch Notes topic Resting and the guide page Camping. See the "References section" in the [[site:Formatting reference]]. |
| `expected-missing` (Optional) | Names of links that are meant to point at pages that do not exist, separated by commas. The page check skips them instead of noting them. It is for pages that show a red link as an example, such as the [[site:Formatting reference]]. |
| `## Heading` lines (Optional) | Section headings. Every heading is listed in the page's **Contents** list, which is added automatically, like the one beside this page (in the left sidebar, or behind the ☰ button next to the title). The page title is added for you, so do not repeat it. |
| The file name | The page's web address. The example file `party-rest.md` becomes `#/guide/party-rest`. Use lower case and hyphens. |
| `[[Another page]]` | A link to another guide page, by its title. |
| `[[site:Title]]` | A link to a Site Guide page. |
| `[[topic:Name]]` | A link to a Patch Notes topic page (see below). |

Only `title` is required. Everything else is optional. A page with no `category` goes under **General**.

## How the parts connect

The site has two parts that are built differently. Knowing which is which explains everything that follows.

- **The Game Guide** is written by hand, by people like you. Pages are the files in `web/guide/`.
- **The Patch Notes** are generated by a script from the developers' release notes. Their *topics* (Revenants, Market, Climbing and so on) come from that data.

> [!NOTE]
> You cannot create a Patch Notes topic by writing a file, and you do not need to.

| When you... | ...this happens | Automatic? |
|---|---|---|
| Add a guide page | It appears on the Game Guide index under its category, on that category's page, and in search. | Yes, after the next deploy |
| Use a category name no page has used before | A new group appears on the **Game Guide** page. | Yes. Reuse an existing group where you can (see the tip below the table). |
| Link with `[[Page title]]` | A normal link if that page exists. A **red** link if it does not. Clicking a red link starts that page. | Yes |
| Link with `[[topic:Name]]` | A link to the Patch Notes topic with its full change history. | You add the link by hand |
| Want your page listed in the main menu by name | The main menu has only a few fixed links, not individual pages. People find pages from the Game Guide index, the category page, search and links. | No. Link to your page from related pages. |
| Want a Patch Notes topic page to show your guide page | Topic pages do not list guide pages. | No. The connection is only the links you write. |

> [!TIP]
> Before you invent a category, check the groups already listed on the **Game Guide** page and reuse one. A new name creates a near-duplicate, such as "Combat" and "Combat system".

In short: **a guide page is found through its category, its title, search and the links other pages make to it.** The patch notes are connected only by links you choose to add.

## Writing the page

Pages are written in Markdown: plain text with a few marks that the site turns into headings, bold words, lists and links. These are the ones most pages need:

```markdown
## A section

Resting restores **health** while the party camps. See [[Camping]] and [[topic:Resting]].

- a bullet
- another bullet
```

Start at `##`, because the page title is added for you. Everything else, including pictures with captions, tables, code boxes, notice boxes, spoilers and keycaps for keys and buttons, is in the [[site:Formatting reference]].

### The shape of a page

The starter template follows the shape that suits most pages about how something works in the game. Delete any section that does not fit yours.

1. **An "Applies to" box.** Which play it covers (online, offline or both; classic or enhanced; any setting that turns it on or off), and the patch you checked it against.
2. **Two sentences** saying what the thing is and why a player would care.
3. **How it works.** The steps, in the order a player does them.
4. **Limits and things to know.** Costs, caps, and what catches people out.
5. **Quick start.** Three or four steps for a first try.
6. **Sources.** Where the information comes from.

Pages that are not about a game system, such as a fix for a technical problem, can drop sections or change them.

Items, places and creatures have templates of their own. Each starts with a fact panel (an infobox, see the [[site:Formatting reference]]) holding the numbers readers look up, followed by sections that suit that kind of page: how to get an item, how to reach a place, or how to beat a creature. When you start a missing page from its red link, the "Create this page" screen offers all of them.

Raw HTML is shown as plain text, so leave it out. The [[site:Formatting reference]] lists what is not supported.

## Adding pictures

- Upload pictures to an **`images`** folder. Most pages use the shared one, **`web/guide/images/`**. A page that lives in its own folder may instead keep an `images` folder beside it. In your fork, switch to the branch GitHub made for your page (the branch menu at the top left of the file list), open the folder, and choose **Add file → Upload files**. The picture joins your open pull request automatically.
- Reference a picture by its path from the page's own folder. For a page directly in `web/guide/`, that starts with `images/`. For a page inside a folder such as `web/guide/combat/`, use `../images/` to reach the shared folder, or `images/` to reach one beside the page.
- Write the picture into your page with `![description](images/your-picture.png)`. Captions and placement are in the [[site:Formatting reference]]. Yours will have its own name.
- Name it after your page, such as `party-rest-camp.png`, so names do not clash and people can tell what it belongs to.
- Use PNG, JPG, WebP or GIF, and keep each file under about 500 KB. Crop or shrink large screenshots.
- Always write alt text (the words in the square brackets) describing what the picture shows. It is read aloud by screen readers and shown if the picture cannot load.

> [!important]
> Only upload pictures you made yourself, such as your own screenshots or diagrams. Do not upload other people's artwork or images taken from other sites.
>
> A screenshot of the game is yours only in how you composed it: what you chose to show, the framing, cropping, annotations and caption. The artwork inside it belongs to Bethesda/ZeniMax (*Daggerfall*) or to the Daggerfall Online developers, and your pictures are released under CC BY 4.0 without it. Do not extract, redraw or upload game assets on their own, such as textures, sprites, icons or music.

## Good practice

- **Say how you know.** Write what you know to be true, and say where it comes from, such as testing in the game, a patch number or a developer post. Facts that can change, such as a default key or a number, are easier to trust when they say which game version you checked, so add the patch number when you know it.
- **One subject per page.** Link to other pages instead of repeating them.
- **Say what it applies to.** Many features differ between online and offline play, between classic and enhanced, or depend on a setting. Say which near the top, with the patch you checked, as the template's "Applies to" box does, so readers know whether the page is about their game.
- **Let every heading say what is inside.** On a phone, sections start folded closed, so the headings are all a reader sees at first. See [[site:Anatomy of a page]].
- **Say how it works now.** The Patch Notes already record *what changed*. A guide page should explain *how it works now*, and can link to the topic for the history, for example [[topic:Revenants]].

> [!IMPORTANT]
> **Only submit what is yours, and credit what is not.**
>
> - **Use sources, not their words.** Release notes, developer posts and other sites are good sources, but put what they say in your own words and say where it came from. Quote only short passages, set off as quotations, with who said it and where.
> - **Only upload pictures you made yourself.** The rule, and what it means for game screenshots, is under **Adding pictures** above.
>
> Your writing and pictures are released under a free license, as explained under **Credit** below.

## Checking your page

Once your page is live, look for these:

1. It is listed on the Game Guide index, under its category, with its summary beside the name.
2. If you used a new category, it appears as a group on the **Game Guide** page.
3. The breadcrumb at the top reads Game Guide › your category.
4. Searching for a word from its title finds it.
5. Pictures appear, and any red link opens GitHub's editor with a new page ready.

## Review and credit

### Review

A maintainer reads every new or edited page before it goes live, and may ask for changes. You make those on the same pull request (step 7 of the short version). Once it is merged, the page appears on the site within a few minutes. Reviewers have their own guide: [[site:Reviewing a pull request]].

If a mistake is found after a page is live, it is fixed the same way: someone edits the page and sends another pull request. Nothing has to be undone first.

### Credit

Your writing is released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and credited to "UDOP contributors". GitHub also keeps your name beside every change you make, in the project's history.

### Files the site ignores

A file or folder whose name starts with `_` or `.` is not part of the site, so the Game Guide never lists it. The starter template, `_template.md`, is one.

You can use this to keep an unfinished page out of the site. Name it with a leading underscore, such as `_party-rest.md`, and remove the underscore when it is ready. This only hides the page from the site. The file is still visible in the project on GitHub, so do not put anything private in it.

### Folders and file names

Folders are optional, and most pages sit directly in `web/guide/`. A page's address is its path inside `web/guide/` without `.md`, so `web/guide/combat/party-rest.md` is opened at `#/guide/combat/party-rest`. Addresses ignore capital letters, and a page can also be opened by its title.

**What a folder changes**

- **The category.** The page's category is the name of its first folder, with hyphens shown as spaces and the first letter capitalized, unless the page sets its own `category` line, which always wins. Only the first folder counts, so deeper folders only organize the files.
- **The address.** The folder is part of the address. Moving a page to another folder changes its address and breaks every plain link to the old one. Links written with the title, `[[Party rest]]`, keep working wherever the file is, so prefer those.
- **The picture path.** A picture path starts from the folder the page is in. See the table below.

**What stays the same**

- Titles are unique across all folders, not per folder. Two pages with the same title are an error, even in different folders.
- Folder names may contain spaces and capital letters, but plain lowercase names with hyphens are easiest to link to.

> [!WARNING]
> Do not name a top-level folder `category`. The site uses that word in its own addresses (`#/guide/category/Combat`), so every page inside such a folder would be unreachable. The page check reports this as an error.

> [!NOTE]
> The "create it" link on a missing page always makes a new file directly in `web/guide/`. If the page belongs in a folder, move the file after creating it, or type the folder into the file name on GitHub's page, such as `combat/party-rest.md`.

| The page file | Its category (if it sets none) | A shared picture named `camp.png` is written as |
|---|---|---|
| `web/guide/party-rest.md` | General | `images/camp.png` |
| `web/guide/combat/party-rest.md` | Combat | `../images/camp.png` |
| `web/guide/combat/magic/party-rest.md` | Combat | `../../images/camp.png` |

A picture kept in an `images` folder beside the page, such as `web/guide/combat/images/camp.png`, is written `images/camp.png` from that page.

## Previewing on your computer

> [!NOTE]
> You do not need this to contribute.

To see a page before proposing it, run these from the project folder, then open <http://localhost:8000>

```py
python tools/guide.py --check
python -m http.server 8000 --directory web
```

`guide.py` rebuilds the page list the site reads and reports problems such as duplicate titles. The deploy runs it for you.

## Where to go next

- [[site:Formatting reference]]: every kind of formatting, with examples.
- [[site:Anatomy of a page]]: what the site builds around your text.
- [[site:Troubleshooting and FAQ]]: when a page does not show up or looks wrong, and what each page-check message means.
- [[site:Reviewing a pull request]]: for maintainers and anyone who reviews pages.
- The [Site Guide](#/site): all of these in one place.
