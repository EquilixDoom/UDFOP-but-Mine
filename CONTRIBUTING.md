# Contributing to UDFOP

UDFOP has three parts:

| Part | What it is | How it is updated |
|---|---|---|
| **Game Guide** (`web/guide/`) | How things in Daggerfall Online work, written by the community | By hand: anyone can add or edit a page |
| **Site Guide** (`web/site/`) | Help for contributors and reviewers: how to write a page, formatting, troubleshooting, reviewing | By hand, by maintainers |
| **Patch Notes** (`data/`, `web/data.js`) | Every change from the developers' release notes | By script, once per release (see the README) |

## Game Guide pages

**The full instructions are on the site:** [How to write a guide page](https://tau-samsara.github.io/udfop/#/site/how-to-write-a-page). They cover the page format, links, how a page connects to the Game Guide index, search and the patch notes, and a formatting cheat sheet.

The short version: **fork the project first, on its GitHub page** ([github.com/tau-samsara/udfop](https://github.com/tau-samsara/udfop) → **Fork** → **Create fork**), then in your copy open `web/guide`, choose **Add file → Create new file**, paste the template, write your page, and **Commit changes** on a new branch to start a pull request. Click **Create pull request** (twice) to send it to the maintainers. You need a free GitHub account with a verified email, and nothing installed.

Do not rely on the site's **Edit this page** link or the red links to missing pages to create your fork: forking from GitHub's editor can fail. They are shortcuts for people who already have one. The site's guide spells out each screen.

The starter template is [`web/guide/_template.md`](web/guide/_template.md). It is the only copy: the site's editor links (red links to missing pages) load it, so edit that file to change what new pages start with.

## Licence of what you contribute

By submitting a Game Guide page you agree that your writing is released under [CC BY 4.0](LICENSE-CONTENT.md), credited to "UDFOP contributors". Use your own words and your own pictures: do not paste the developers' release text, or text or images from other sites. Code contributions are under the [MIT licence](LICENSE).

## Review

A maintainer reviews every pull request. A check (`python tools/guide.py --check`) runs automatically on guide changes and reports duplicate titles, empty pages and similar problems.

## Corrections to the Patch Notes

See the README: the usual fixes are editing a description in `data/descriptions/`, a row in `data/normalized/all.jsonl`, or a category in `data/hub_assignment.csv`. New patches are added by a maintainer with the release script.

## Credit

Contributors who agree to it are listed by GitHub username in [CONTRIBUTORS.md](CONTRIBUTORS.md).
