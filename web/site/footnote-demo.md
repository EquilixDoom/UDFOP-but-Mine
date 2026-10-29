---
title: Footnote Demo
category: Site Guide
summary: A demo of footnotes: numbering by first use, repeated references, formatted notes, long notes, and references inside lists, tables and quotes.
authors: tau
---

This page shows footnotes at work. A reference is written `[^name]` after the words it supports, and its note is a line of its own anywhere on the page. The notes are listed at the end under Footnotes.

## Numbering

Writs can award Renown XP.[^writs] Numbers follow the order of first use, not the order of the notes at the bottom, so this second reference is number 2.[^wiki] Using a name again reuses its number: writs again.[^writs] A third use gives a third way back from the note.[^writs]

## Notes with formatting

A note can hold **bold**, *italic*, `code`, a link to a guide page, and a link to another website.[^rich] A note that is only an address shows it as a link.[^bare]

## A long note

Some notes need more than one line.[^long]

## Inside other blocks

References work in lists, tables and quotes:

- A list item with a source.[^list]
- Another item that uses the first note again.[^writs]

| Skill | Source |
|---|---|
| Archery | Tested in game.[^table] |
| Block | Same test.[^table] |

> A quoted line with a reference.[^quote]

## What is not a reference

Code is never read as a reference: `[^code]`.

```
[^fenced]: not a note, because it is inside a code box
```

A reference with no note is shown as written, and the page check reports it. A note that is never referenced is not shown, and the page check warns about it. See [[site:Extended formatting#Footnotes]] for the rules.

[^writs]: https://example.com/writs
[^wiki]: https://example.org/wiki/renown
[^rich]: Notes support **bold**, *italic*, `code`, a link to [[Controls]], and [an outside page](https://example.com/page).
[^bare]: https://example.com/a/very/long/address/that/goes/on/for/a/while/to/see/how/it/wraps
[^long]: This note runs over several lines. The lines after the first are indented
    by at least two spaces, and they are joined into one paragraph.
    A third line shows that the joining keeps going.
[^list]: Seen in the list.
[^table]: Seen in the table.
[^quote]: Seen in the quote.
