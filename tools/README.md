# Patch notes manager (`notes_gui.py`)

Local browser tool for adding new patch notes and for reviewing and editing every stored row. Python standard library only. It wraps `tools/notes.py`; the guesses it fills in are rule-based, not a language model.

## Start

```bash
python tools/notes_gui.py
```

Opens http://127.0.0.1:8765 (local machine only). Options: `--no-browser`; `NOTES_GUI_PORT=8800` to change the port. Stop with Ctrl+C.

The Manage tab builds a flags index on first use (about 20 s); it is kept current by the tool's own writes.

## Tabs

| Tab | Purpose |
|---|---|
| 1 Get notes | Fetch releases, prepare the draft, discard the draft |
| 2 Review rows | Confirm draft rows (new patches) or review stored rows |
| 3 Descriptions | Write and review topic descriptions |
| 4 Build & check | Build, validate, self-test, commit |
| 5 Manage | Search, bulk edits, topics, tags, change log, duplicates |

## Add new patch notes

1. **Get notes**: fetch, then prepare. A draft appears in `data/inbox/` (git-ignored). The button **Discard this draft** removes the draft rows, the left-out list and the confirmations; nothing is ingested.
2. **Review rows** (draft mode): rows are grouped by patch, shown as a list on the left and a detail panel on the right. Each row shows the developers' bullet verbatim, the guessed topic (entity), type, direction, tags, platforms and the summary preview. Check or fix, then confirm. Every row needs a person's confirmation; ingest stays blocked until all are confirmed.
3. **Ingest** once everything is confirmed. Rows are written to `data/normalized/`.
4. **Descriptions**: topics changed by the new rows are stale; write or edit the description and mark it reviewed.
5. **Build & check**: Build, Validate, Self-test, then the commit helper.

### Row keys

| Key | Action |
|---|---|
| `J` / `K` or arrows | Next / previous row |
| `Enter`, `Space` | Confirm row and advance |
| `U` | Unconfirm |
| `E` | Open / close the edit fields |
| `T` | Edit the topic |
| `G` | Add a tag (type in the tag box, Enter) |
| `1`–`9` | Set change type (order shown under the detail) |
| `S` | Split a bullet that holds two changes |
| `X` | Leave out (draft only) |
| `Z` | Undo (draft only) |
| `[` / `]` | Previous / next patch |
| `Esc` | Close fields |

Choosing Buff / Nerf sets the direction. Tag suggestions appear as chips above the tag list; a count on each tag chip shows how many rows use it.

## Review stored rows

In **Review rows**, switch the mode bar to **Stored patches**. Pick a patch in the selector, or open a list of rows from the Manage tab (**Review these**, **Review the N selected in order**, **Review its rows in order**, **Review rows** on a tag). Same screen and keys as the draft. Edits save on change and write to `data/normalized/all.jsonl` immediately. Editable fields: topic, type, tags, platforms, developer's reasoning (`dev_note`, verbatim, empty when the notes give none). Confirming a row records it in `data/normalized/row_review.json`.

Each patch header links to its GitHub release.

**Split** in stored mode adds a copy of the row with the next free id; both rows keep the whole bullet as source text.

The first write of a session snapshots the data to `_backups/` (git-ignored) and every change is journaled.

## Descriptions

Topics with a description that no person has reviewed are stale: every description starts stale, and a new change to a topic makes it stale again. Edit the text, save, and it is marked reviewed (`data/descriptions/.reviewed.json`). **Copy LLM prompt** (per topic) or **Copy one prompt for the N** (all stale topics) puts a prompt on the clipboard for an external LLM; paste its reply (`Topic ||| text` per line) back into the box. The tool never calls an LLM.

## Manage tab

| Sub-tab | Use |
|---|---|
| Search | Filter by words, topic, type, tag, patch range, or flags. **Needs a look** lists rows with any unconfirmed flag. Flags: type Other, no tags, long bullet, `topic?` (text names a different topic). Open the results in the review screen, or apply a bulk action to the selection: Set type, Set topic, Add tag, Remove tag, Confirm, Unconfirm. |
| Topics | **Rename / merge**, change hub (`data/hub_assignment.csv`, `data/merges.csv`). Shows rows, last change and description state. |
| Tags | Add a tag to the taxonomy, rename, remove (removes it from all rows). |
| Changes | Journal of edits made by the tool. **Revert** restores the row fields from before the edits. Reverts cover rows only; hub, description and tag-list changes need git. |
| Duplicates | Groups of rows with near-identical text, opened in the review screen. |

## Commit helper (Build & check)

Shows changed files under `data/` and `web/`, and edits since the last build. **Commit data and web** stages `data` and `web` and commits with the message you type. It never pushes.

## Files touched

| Path | Content |
|---|---|
| `data/normalized/all.jsonl`, `sources.jsonl`, `releases.jsonl` | Rows, developers' text, releases |
| `data/normalized/taxonomy.json` | Types, tags, platforms |
| `data/normalized/row_review.json` | Stored rows a person has confirmed |
| `data/hub_assignment.csv`, `data/merges.csv` | Topic hubs and merges |
| `data/descriptions/` | Topic descriptions, `.reviewed.json` |
| `data/inbox/` | Draft (git-ignored) |
| `_backups/` | Snapshots and journal (git-ignored) |

## Limits

- Topic, tag-list and hub changes are not reverted by **Revert**; use git.
- Close other copies of the tool before running `notes.py` commands that write data.
