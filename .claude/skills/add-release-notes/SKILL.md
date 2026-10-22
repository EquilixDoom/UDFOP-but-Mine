---
name: add-release-notes
description: Add new DFO Online release notes to the wiki. Use when the user wants to pull in, process or publish new patches or releases, or says "add the new release notes".
---

Run everything from the project root. The helper is `python tools/notes.py` (see README.md). Two steps need judgement and are done by you: turning raw notes into rows, and rewriting topic descriptions. The rest is scripted.

## 0. Before you start
Community contributors edit Game Guide pages (`web/guide/`) on GitHub, so the remote may have commits the local copy lacks. Run `git fetch` and `git status -sb`; if it says "behind", run `git pull --rebase` first, so the later push is not rejected. This workflow never touches `web/guide/`, `tools/guide.py` or the guide's page list: the Game Guide is hand-written and separate from the generated Patch Notes.

Then refresh the local release notes. `data/release_notes.md` is git-ignored (it is re-downloaded by `fetch`), so it is **never updated by `git pull`**: another maintainer may have ingested newer patches whose notes your copy does not have. Always run `python tools/notes.py fetch` at the start of every session, even when `git pull` brought in new data. If you skip it, `status` prints a WARNING that the notes are behind the rows, and `selftest`, `prepare` and `backtest` stop or mislead. After pulling, `python tools/notes.py status` should show no WARNING and "pending: none" before you start.

## 1. Fetch and prepare
1. `python tools/notes.py fetch` (add `--dry-run` first if the user wants to see what is new). This prepends new GitHub releases to `data/release_notes.md`.
2. `python tools/notes.py prepare`. It writes `data/inbox/pending.md` (raw notes, PR titles, allowed values), `data/inbox/topics.txt` (every existing topic, its hub and systems), `data/inbox/rows.draft.jsonl` (a pre-filled draft) and `data/inbox/skipped.txt` (bullets it left out). If it says nothing is pending, stop.
3. Read pending.md and topics.txt fully before touching the draft.

## 2. Review `data/inbox/rows.draft.jsonl`, then approve
The draft already has `id`, `version`, `date`, `source`, `platforms`, `dev_note` and guesses for the rest. Each row's `_review` lists the fields to check. Do not trust the guesses: on past releases `entity` was right about a quarter of the time and `system` about half. For every row decide `entity`, `system`, `change_type`, `direction` and `tags`; `summary` is not rewritten, because the site shows the developers' own bullet. Split a bullet that bundles several changes into several rows (keep the ids sequential), delete rows that are not changes, and restore anything in `skipped.txt` that was wrongly left out. Replace every `TODO` entity. A topic is a short noun phrase for the thing that changed ("Magic Repair", "Gathering Nodes"), never the start of the bullet ("Five Crafts Instead Of Eight", "Unchanged"). `approve` and `ingest` print `warn:` lines for new topic names that look wrong ("looks wrong") or are very like an existing topic ("worth a look"): act on every one before continuing. Then run `python tools/notes.py approve`, which strips `_review` and writes `data/inbox/rows.jsonl`.
Row rules, for every row: one JSON object per line, one change per row, oldest version first. Fields, in this order:
`id, version, date, system, entity, change_type, direction, summary, tags, platforms, dev_note, source`

- `id`: `<version>-001`, `-002`, ... with no gaps, per release. `version` and `date` come from the release header in pending.md.
- `entity`: the topic this change belongs to. Reuse a name from topics.txt exactly whenever the change is about that thing. Only invent a new name for a genuinely new feature: Title Case, a short noun phrase, no system suffix, no "Changes"/"History".
- `summary`: must start with `<entity>: ` followed by the bullet text. Do not rephrase or tighten it: the site displays `source` (the developers' bullet, verbatim; patch notes are no longer processed by an LLM), and `summary` is only a fallback.
- `source`: the original bullet text, unchanged. It is what the site shows; `sources.jsonl` is committed.
- `system`, `change_type`, `tags`, `platforms`: only values listed in pending.md. 1 to 3 tags. `platforms` is `["all"]` unless the note says otherwise.
- `direction`: `+` for a buff or increase to the player's benefit, `−` (U+2212) for a nerf or decrease, `~` for a change that is neither, `n/a` for everything else (most rows). A "was X, now Y" change is `+` or `−` only when it is clearly better or worse for the player.
- `dev_note`: developer reasoning given in the notes (why, not what), verbatim; otherwise `null`.
- Currency: write the name the release uses (Marks to 0.1.4942, Drakes 0.1.4943 to 0.1.5579, silver from 0.1.5580). The product name is DFO Online.
- Spelling: write new rows and descriptions the way the existing ones are written, which follows the developers' own wording (the data still has British spellings such as "colour", "armour" and "grey"). The site's interface and README use American spelling, and a sweep of the data is deferred until the user asks for it, so do not convert existing text. If a new description needs a spelling choice, ask.

Choosing `change_type`. The site groups every patch page by it, under the headings Additions, Reworks, Fixes, Performance, Economy, Interface and quality of life, Balance, Removals and Other changes, so a wrong type puts a change under the wrong heading. Decide each row with this guide:
- `New`: the game gains something it did not have: a feature, item, place, mechanic or screen.
- `Rework`: something that exists now works differently, and it is not clearly a gain or loss for the player.
- `Fix`: something was broken and now works as intended: bugs, crashes, wrong text or pictures, behaviour that did not match its description.
- `Buff` and `Nerf`: a balance change clearly in the player's favour (direction `+`) or against it (direction `−`), such as a better drop rate or a weaker spell. They share the Balance heading. When the note says something got easier or harder for the player, use these instead of `Rework`, and give the row its direction.
- `Economy`: prices, costs, wages, rewards and how money moves.
- `Performance`: speed, smoothness, memory, loading time or network load, with no change to what the player sees or can do.
- `UI` and `QoL`: `UI` is how something looks or is laid out (icons, screens, labels, colors); `QoL` is a small convenience that saves a step or remembers a choice. They share one heading, so do not spend long on the line between them.
- `Removal`: something is taken out of the game. If a whole topic is gone, say so in your report (see step 5).
- `Other`: a known limitation, or a note that fits none of the above. It is the last resort: about 9% of all rows are Other today, so look for a better type for each one before accepting it.

Skip: the headline title and intro paragraph, statements of no change, rollout, credits, "For developers", "For the team" and deploy-order sections, and Release Tooling pull requests. Keep known limitations as `change_type` Other. A release with no player-visible changes produces no rows (ingest still records it). A bullet that bundles several changes becomes several rows. If a release has no body notes, use each PR title as the source.

## 3. Ingest
`python tools/notes.py ingest`. It validates ids, dates, taxonomy values and the summary prefix, and writes nothing if there is any error: fix the rows and run it again. On success it appends to `data/normalized/`, records the releases, assigns hubs to new topics in `data/hub_assignment.csv` (check those guesses and edit the CSV if a hub is wrong) and writes `data/inbox/describe.md`.
Warnings about tags not in the taxonomy are allowed but add the tag to `data/normalized/taxonomy.json` if it is meant to stay.
Ingest also records four fields for each new release in `data/normalized/releases.jsonl`: `update` (the developers' "Update 0.0.N" name, empty if none), `title` (the `# Patch Notes:` heading), `kind` and `tier`. `kind` is only a hint shown on the Patch index: `likely-hotfix` when the title contains fix, fixes, hotfix or boot, `bulk-import` for the versions listed in `BULK_IMPORTS` in `tools/notes.py`, otherwise `release`. Look at the new releases' lines and tell the user if a hint is clearly wrong. A catch-up release that holds hundreds of earlier changes is added to `BULK_IMPORTS`, then `python tools/notes.py relmeta` recomputes the fields. Leave `tier` empty: it is reserved for levels the developers have not published.

## 4. Descriptions
Read `data/inbox/describe.md`. For each topic listed, write one line `Topic ||| description` into `data/descriptions/patch-<latest version>.txt`. A description is 1 to 4 sentences saying what the topic is and how it works as of its latest change. Later changes override earlier ones, so describe the current behaviour and mention what changed only when it explains the current state. Never invent anything the changes do not say. Where a CURRENT description is shown, update it rather than starting over. A topic with a single vague change gets one honest sentence.

Descriptions you write are drafts for a person to review. A topic stays "stale" (listed by `describe` and `status`) until a person marks it reviewed in `python tools/notes_gui.py` (recorded in `data/descriptions/.reviewed.json`); a new change makes it stale again, and `build` does not mark it current. Tell the user which topics are waiting for review.

## 5. Build and check
`python tools/notes.py build` rebuilds the site's data: `web/data.js` (the core file: hubs, every release, descriptions, a count and last patch per topic) and `web/shards/<period>.js` (the change rows, one file per month, split when a month would be over 500 KB gzipped). It then reports topics with no description, descriptions for unknown topics, stale ones, and **Legacy candidates**: topics whose latest change is a Removal. Never add a topic to `data/legacy.csv` yourself; a removal is sometimes only part of a feature that still exists. Give the user the candidates that are new since last time and let them decide.

Then check the result in a browser. Serve the site (`python -m http.server 8000 --directory web`) and open it; opening `index.html` straight from the folder blocks the Game Guide. Look at:
- the new patch page, `#/patch/<version>`: the headings are the kinds of change with their counts, and every change sits under a sensible one (look hard at "Other changes");
- the Patch Notes front page, `#/patchnotes`: the Latest patch card shows the new version, and the Additions tab of Recent changes by type lists it if it added anything;
- the Patch index, `#/patches`: the new release is under its day with the right name and hint;
- one changed topic's page: the opening description, and the new row in its History table, whose Source link opens the developers' release on GitHub.

Report to the user: which versions were added, how many rows and how many of each change type (so an odd number of Other or Fix rows stands out), any new topics and their hubs, the release hints, the Legacy candidates, and anything uncertain.

## 6. Commit, then hand over the push
Run `python tools/notes.py selftest`, then commit the new data, descriptions, `web/data.js` and `web/shards/` (`git add -A` is safe: generated files such as `web/guide/index.json` and `data/release_notes.md` are git-ignored). Commit with the project identity (tau / tau-samsara@users.noreply.github.com) and no personal email. Do not push: tell the user to run `git pull --rebase` (only if GitHub has new commits) and `git push`, then hard-refresh the site once the deploy finishes. The deploy workflow rebuilds the Game Guide page list by itself.
