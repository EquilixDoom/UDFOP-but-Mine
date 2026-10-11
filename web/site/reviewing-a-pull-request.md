---
title: Reviewing a pull request
category: Site Guide
summary: What to check when someone sends a guide page, how to give kind feedback, and how to merge it.
---

This page is for the people who review guide pages: what to check, how to give feedback, and how to merge. A maintainer reads every new or edited guide page before it goes live. You need only a browser and your own reading. For what contributors are told, see [[How to write a guide page]].

## Before you start

Most contributors are new to GitHub, and many have never opened a pull request. Sending one is the hard part. Start by thanking them, say what you liked, and keep your requests few and specific. A kind review is the reason the next page gets written.

> [!NOTE]
> The aim is a page that is accurate, in the contributor's own words, and easy to find. It does not have to be perfect to be merged: anything small can be fixed in a later pull request, and nothing has to be undone first.

## 1. Open the pull request

On the project page, open the **Pull requests** tab, then the pull request. Read its description and see which files it changes in the **Files changed** tab.

> [!IMPORTANT]
> A Game Guide pull request should only change files inside `web/guide/`: pages (`.md` files) and pictures. If it changes anything else, such as `web/app.js`, `tools/`, `.github/` or the Site Guide in `web/site/`, ask the contributor why before going further.

## 2. Look at the automatic check

Near the bottom of the pull request is the **Check Game Guide** result. It runs the same page check described in [[Troubleshooting and FAQ]].

- **A green tick** means no errors. There may still be notes. Open **Details** to read them.
- **A red cross** means an error, such as a duplicate title or a missing picture. The contributor has to fix it before it can be merged. Point them to the matching row in the page-check table in [[Troubleshooting and FAQ]].

## 3. Read the page

Open the **Files changed** tab. For a page, use the three dots on the file's header and choose **View file** to read it as formatted text. GitHub shows the standard Markdown and the notice boxes, but not the site's keycaps or link markers. Those show literally, such as `{{W}}`.

To see the page exactly as readers will, check out the contributor's branch and preview it:

```bash
python tools/guide.py --check
python -m http.server 8000 --directory web
```

Then open <http://localhost:8000>. This is optional.

## 4. The checklist

**Their own words and pictures**
- It is written in the contributor's own words. Quotations are short, set off as quotations, and say who said it and where.
- It does not paste release notes, developer posts or text from other websites.
- Every picture is the contributor's own screenshot or diagram. No artwork or images from other sites.

**Accuracy**
- It says how the contributor knows what they wrote, or at least gives the game version where a number or key might change.
- It explains how something works now. History belongs to the Patch Notes, and the page can link to the topic.
- One subject per page, linking to other pages instead of repeating them.

**Findability**
- The title is clear and not likely to clash with another page.
- There is a one-line `summary`.
- The `category` reuses an existing group instead of inventing a near-duplicate, such as "Combat" and "Combat system". The Game Guide page lists the groups already in use.
- It links to related guide pages and to the topics in the Patch Notes where that helps.

**Formatting**
- Links work. A red link is fine only if it is meant to start a new page.
- Pictures have alt text, are under about 500 KB, and sit in an `images` folder.
- Notice boxes and spoilers are used sparingly.

**Safety**
- No email addresses, passwords or other personal details.
- External links go where they say they do.
- The page check mentions any HTML-like text. The site shows it as plain text, so it is safe, but ask what it is for.

> [!NOTE]
> The project has not settled on one spelling variant for guide content, so do not hold a pull request over it.

## 5. Give your feedback

Select the lines you want to comment on, click the blue **+**, and write your comment. For a small fix, use **Add a suggestion**, which lets the contributor accept your change with one click.

When you are done, click **Review changes** and choose:

- **Approve** when the page is good enough to publish.
- **Request changes** when something must be fixed first.
- **Comment** when you only have questions.

Some wording that helps:

| Instead of | Try |
|---|---|
| "This is wrong." | "I could not find this in the game. Where did you see it?" |
| "Rewrite this." | "Could you say this in your own words? It reads close to the release notes." |
| "Fix the formatting." | "Table rows need a dashed line under the header. I have suggested one." |
| "Rejected." | "Thank you for this. Before we merge, could you…" |

## 6. Merge

When you are satisfied, click **Merge pull request**. The site rebuilds automatically and the page appears within a few minutes.

Afterwards:

1. Open the live page and check it looks right, including its picture.
2. Thank the contributor.
3. If they agree, add their GitHub username to `CONTRIBUTORS.md`. Add only people who have said yes.

## If something goes wrong after merging

Fix it the way anything else is fixed: edit the page and send another pull request. For a page that should not have been published, remove the file the same way. Nothing needs to be undone first.

Back to the [Site Guide](#/site).
