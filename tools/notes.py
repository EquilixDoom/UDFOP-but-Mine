#!/usr/bin/env python3
"""Release-notes workflow for the DFO Online wiki. Run from the project root.

  python tools/notes.py status             what is pending / stale
  python tools/notes.py fetch [--dry-run]  pull new GitHub releases into data/release_notes.md
  python tools/notes.py prepare            write pending.md, topics.txt and a pre-filled rows.draft.jsonl
  (review rows.draft.jsonl: fix the fields listed in each row's _review, then:)
  python tools/notes.py approve            turn the reviewed draft into rows.jsonl
  python tools/notes.py ingest             validate rows.jsonl, append to data/normalized, assign hubs
  python tools/notes.py describe           write data/inbox/describe.md (topics needing a new description)
  (descriptions: write data/descriptions/patch-<version>.txt, lines "Topic ||| text")
  python tools/notes.py build              rebuild web/data.js and web/shards/ and report problems
  python tools/notes.py backtest [--last N] score the prefill guesses against already-ingested releases
  python tools/notes.py selftest           run the whole pipeline in a temp copy and check your real files are untouched
  python tools/notes.py validate           check all stored rows, releases and description files against the taxonomy (writes nothing; CI runs it)
  python tools/notes.py backup             snapshot data/ and web/ into _backups/
"""
import argparse, csv, glob, json, os, re, shutil, subprocess, sys, urllib.request
from collections import Counter, defaultdict

REPO = "Lattymoy/daggerfall-js-source"
D = "data"
NOTES = f"{D}/release_notes.md"
ALL = f"{D}/normalized/all.jsonl"
RELS = f"{D}/normalized/releases.jsonl"
SOURCES = f"{D}/normalized/sources.jsonl"   # verbatim bullet text, kept local (git-ignored)
TAX = f"{D}/normalized/taxonomy.json"
HUBS = f"{D}/hub_assignment.csv"
INBOX = f"{D}/inbox"
DESC = f"{D}/descriptions"
STATE = f"{DESC}/.state.json"
MINUS = "−"

sys.stdout.reconfigure(encoding="utf-8")


def vkey(v):
    return [int(x) for x in v.split(".")]


def read_jsonl(path):
    if not os.path.exists(path):
        return []
    return [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()]


def write_jsonl(path, rows, mode="w"):
    with open(path, mode, encoding="utf-8", newline="\n") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")


def parse_notes():
    """release_notes.md -> list of dicts (newest first), keyed by tag."""
    if not os.path.exists(NOTES):       # a fresh clone: `fetch` creates it
        return []
    text = open(NOTES, encoding="utf-8-sig").read().replace("\r\n", "\n")
    out = []
    for block in re.split(r"(?m)^## (?=.*\[[^\]]+\]\n)", text):
        m = re.match(r"(.*)\[([^\]]+)\]\n\nPublished: (\S+)\n\n(.*)", block, re.S)
        if not m:
            continue
        name, tag, pub, body = m.groups()
        body = re.sub(r"\n---\s*$", "", body.rstrip()).strip()
        prs = [dict(number=int(n), title=t.strip(), url=u) for t, u, n in re.findall(
            r"(?m)^\* (.*?) by @\S+ in (https://github\.com/[^\s]+/pull/(\d+))", body)]
        version = tag.replace("app-v", "")
        um = re.match(r"Update (\S+)", name.strip())
        tm = re.search(r"(?m)^# (.+)$", body)
        title = re.sub(r"^Patch Notes:\s*", "", tm.group(1).strip()) if tm else ""
        out.append(dict(tag=tag, version=version, published=pub, date=pub[:10], body=body, prs=prs,
                        update=um.group(1) if um else None, title=title or None,
                        has_body_notes=bool(re.search(r"(?m)^## (?!What's Changed)", body)) or "\n- " in body))
    return out


# Release grouping (rule 7). `kind` is a hint for readers, not a fact from the source:
#   bulk-import     a catch-up release listed in BULK_IMPORTS (it holds hundreds of earlier changes)
#   likely-hotfix   the title contains fix, fixes, hotfix or boot (a person may correct it by hand)
#   release         everything else
# `update` (the developers' "Update 0.0.N" name) and `title` are empty when the source has none. `tier` is
# reserved for Major/Expansion levels and stays empty until the source provides them.
BULK_IMPORTS = {"0.1.3"}
HOTFIX_TITLE = re.compile(r"\b(fix|fixes|hotfix|boot)\b", re.I)


def release_kind(version, title):
    if version in BULK_IMPORTS:
        return "bulk-import"
    return "likely-hotfix" if title and HOTFIX_TITLE.search(title) else "release"


def release_meta(r):
    return dict(update=r.get("update"), title=r.get("title"), kind=release_kind(r["version"], r.get("title")), tier=None)


def cmd_relmeta(a):
    """Add update, title, kind and tier to every releases.jsonl entry from release_notes.md (safe to re-run)."""
    notes = {r["version"]: r for r in parse_notes()}
    old = read_jsonl(RELS)
    out, missing = [], []
    for x in old:
        n = notes.get(x["version"])
        if not n:
            missing.append(x["version"])
            meta = dict(update=x.get("update"), title=x.get("title"), kind=release_kind(x["version"], x.get("title")), tier=x.get("tier"))
        else:
            meta = release_meta(n)
            meta["tier"] = x.get("tier")      # a hand-set tier is kept
        y = {k: v for k, v in x.items() if k not in ("update", "title", "kind", "tier")}
        y.update(meta)
        out.append(y)
    if missing:
        print("not found in release_notes.md (run fetch):", ", ".join(missing[:10]))
    if a.dry_run:
        print(f"would update {len(out)} releases")
        return
    write_jsonl(RELS, out)
    kinds = Counter(x["kind"] for x in out)
    print(f"releases.jsonl: {len(out)} releases; {sum(1 for x in out if x['update'])} with an Update name, "
          f"{sum(1 for x in out if x['title'])} with a title; kinds: {dict(kinds)}")


def pending_releases():
    done = {r["source_tag"] for r in read_jsonl(RELS)}
    return [r for r in parse_notes() if r["tag"] not in done]


def load_state():
    return json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else None


def row_counts():
    return Counter(r["entity"] for r in read_jsonl(ALL))


def descriptions():
    """topic -> (text, file) with later files overriding earlier ones."""
    d = {}
    for f in sorted(glob.glob(f"{DESC}/*.txt")):
        for line in open(f, encoding="utf-8"):
            if " ||| " in line:
                k, v = line.rstrip("\n").split(" ||| ", 1)
                d[k] = (v, os.path.basename(f))
    return d


def merge_alias():
    p = f"{D}/merges.csv"
    if not os.path.exists(p):
        return {}
    return {m["from"]: m["to"] for m in csv.DictReader(open(p, encoding="utf-8")) if m["recommend"] == "merge" and m["from"] != m["to"]}


def topic_of(entity, alias):
    return alias.get(entity, entity)


# ------------------------------------------------------------------ fetch
def cmd_fetch(a):
    have = {r["tag"] for r in parse_notes()}
    new, page = [], 1
    while True:
        req = urllib.request.Request(
            f"https://api.github.com/repos/{REPO}/releases?per_page=100&page={page}",
            headers={"Accept": "application/vnd.github+json", "User-Agent": "udfop-notes",
                     **({"Authorization": "Bearer " + os.environ["GITHUB_TOKEN"]} if os.environ.get("GITHUB_TOKEN") else {})})
        with urllib.request.urlopen(req, timeout=30) as resp:
            batch = json.load(resp)
        if not batch:
            break
        stop = False
        for r in batch:
            if r.get("draft"):
                continue
            if r["tag_name"] in have:
                stop = True
                continue
            new.append(r)
        if stop or len(batch) < 100:
            break
        page += 1
    new.sort(key=lambda r: r["published_at"], reverse=True)
    print(f"{len(new)} new release(s):", ", ".join(r["tag_name"] for r in new) or "none")
    if not new or a.dry_run:
        return
    chunk = "".join(
        f"## {r.get('name') or r['tag_name']} [{r['tag_name']}]\n\nPublished: {r.get('published_at') or 'draft'}\n\n"
        f"{(r.get('body') or '').replace(chr(13) + chr(10), chr(10))}\n\n---\n\n" for r in new)
    old = open(NOTES, encoding="utf-8-sig").read() if os.path.exists(NOTES) else ""
    open(NOTES, "w", encoding="utf-8", newline="\n").write(chunk + old.lstrip("\n"))
    print(f"prepended to {NOTES}. Next: python tools/notes.py prepare")


# ------------------------------------------------------------------ prepare
def cmd_prepare(a):
    pend = sorted(pending_releases(), key=lambda r: vkey(r["version"]))
    if not pend:
        print("Nothing pending: every release in release_notes.md is already ingested.")
        return
    os.makedirs(INBOX, exist_ok=True)
    tax = json.load(open(TAX, encoding="utf-8-sig"))
    lines = [f"# Pending releases ({len(pend)})", "",
             "Turn each release below into rows in data/inbox/rows.jsonl, following the add-release-notes skill / README.md.",
             "Allowed values:", f"- system: {', '.join(tax['systems'])}", f"- change_type: {', '.join(tax['change_types'])}",
             f"- direction: + {MINUS} ~ n/a", f"- platforms: {', '.join(tax['platform_values'])}",
             f"- tags: {', '.join(tax['tags'])}", "", "Body rules already agreed:"] + [f"- {r}" for r in tax["body_rules"]] + [""]
    for r in pend:
        lines += [f"---", f"## {r['version']}  (tag {r['tag']}, {r['date']})", f"ids start at {r['version']}-001", ""]
        if r["prs"]:
            lines += ["Pull requests:"] + [f"- #{p['number']} {p['title']}" for p in r["prs"]] + [""]
        lines += ["Raw notes:", "", r["body"], ""]
    open(f"{INBOX}/pending.md", "w", encoding="utf-8").write("\n".join(lines))
    rows = read_jsonl(ALL)
    alias = merge_alias()
    hub = {h["topic"]: h["primary_hub"] for h in csv.DictReader(open(HUBS, encoding="utf-8"))}
    by = defaultdict(set)
    for r in rows:
        by[topic_of(r["entity"], alias)].add(r["system"])
    cnt = Counter(topic_of(r["entity"], alias) for r in rows)
    topics = [f"{t} | {hub.get(t, '-')} | {', '.join(sorted(by[t]))} | {cnt[t]}" for t in sorted(by)]
    open(f"{INBOX}/topics.txt", "w", encoding="utf-8").write(
        "# existing topic | hub | systems | changes. Reuse these names exactly for entity; a new name creates a new topic.\n" + "\n".join(topics))
    g = Guesser(rows)
    draft, skip = [], []
    for r in pend:
        d, s = draft_for(r, g)
        draft += d
        skip += [f"{r['version']} [{b['section']}] {b['text']}" for b in s]
    write_jsonl(f"{INBOX}/rows.draft.jsonl", draft)
    open(f"{INBOX}/skipped.txt", "w", encoding="utf-8").write("\n".join(skip) + "\n")
    flags = Counter(f for r in draft for f in r["_review"])
    print(f"{len(pend)} pending release(s): {', '.join(r['version'] for r in pend)}")
    print(f"wrote {INBOX}/pending.md, topics.txt, rows.draft.jsonl ({len(draft)} draft rows), skipped.txt ({len(skip)} bullets left out)")
    print(f"draft fields flagged for review: {dict(flags)}; entity TODO on {sum(r['entity'] == 'TODO' for r in draft)} rows")
    print(f"Next: review {INBOX}/rows.draft.jsonl (fix flagged fields, check skipped.txt), then: python tools/notes.py approve, then ingest")


# ------------------------------------------------------------------ draft (prefill)
SKIP_SECTION = re.compile(r"rollout|credits|for developers|for the team|deploy|what's changed|changelog|thanks|acknowledg", re.I)
SKIP_TEXT = re.compile(r"\b(unchanged|exactly as before|as before\.?$|(is|are) not affected|no gameplay changes|nothing else changed|"
                       r"keeps? (working )?as before|can still pick|still (works?|sails?|plays?) as)\b", re.I)
HEAD_SYSTEM = [("online", "Online"), ("combat", "Combat"), ("graphic", "Graphics"), ("visual", "Graphics"), ("render", "Graphics"),
               ("ui", "UI"), ("interface", "UI"), ("hud", "UI"), ("menu", "UI"), ("control", "Controls"), ("mod", "Mods"),
               ("item", "Items"), ("character", "Character"), ("platform", "Platform"), ("engine", "Engine"), ("under the hood", "Engine"),
               ("world", "World"), ("overworld", "World"), ("quest", "World")]
STOP_ENTITY = {"Game", "Table", "Page", "Hold", "Floor", "Input", "Social", "Economy", "Interface", "Settings", "Messages", "Card",
               "Sky", "Sea", "Server", "Moon", "Body", "Bodies", "Arms", "Rain", "Wind", "Crouch", "Escape", "Music", "Weather",
               "Crime", "Death", "Watch", "Shield", "Spells", "Smith", "Ghost", "Glare", "Gore", "Swing", "Thrust", "Pointer"}


def clean(t):
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t).replace("**", "").replace("`", "")
    return re.sub(r"\s+", " ", t).strip()


def bullets_of(rel):
    """-> (bullets, skipped). Each bullet: dict(section, text). Falls back to PR titles when there is no body list."""
    body = rel["body"].split("## What's Changed")[0]
    out, skipped, section, skip_sec, cur = [], [], None, False, None
    for line in body.split("\n"):
        h = re.match(r"^(#{1,3}) (.*)", line)
        if h:
            cur = None
            if len(h.group(1)) >= 2:
                section, skip_sec = h.group(2).strip(), bool(SKIP_SECTION.search(h.group(2)))
            continue
        if re.match(r"^\s*[-*] ", line):
            cur = {"section": section, "text": clean(re.sub(r"^\s*[-*] ", "", line))}
            (skipped if skip_sec else out).append(cur)
        elif cur is not None and line.startswith("  ") and line.strip():
            cur["text"] = clean(cur["text"] + " " + line.strip())
        elif not line.strip():
            cur = None
    keep = []
    for b in out:
        (skipped if SKIP_TEXT.search(b["text"]) else keep).append(b)
    if not keep and not skipped and rel["prs"]:
        keep = [{"section": None, "text": p["title"]} for p in rel["prs"] if "release" not in p["title"].lower()[:12]]
    return keep, skipped


class Guesser:
    def __init__(self, rows):
        self.names = Counter(r["entity"] for r in rows)
        self.sys = defaultdict(Counter)
        self.tags = defaultdict(Counter)
        for r in rows:
            self.sys[r["entity"]][r["system"]] += 1
            for t in r["tags"]:
                self.tags[r["entity"]][t] += 1
        self.lower = {n.lower(): n for n in self.names}
        def pat(n):
            stem = n[:-1] if n.endswith("s") and len(n) > 5 else n
            return re.compile(r"(?<![A-Za-z])" + re.escape(stem) + r"s?(?![A-Za-z])", re.I)
        self.pats = [(n, pat(n)) for n in self.names if n not in STOP_ENTITY and (len(n) >= 4 or " " in n)]
        tax = json.load(open(TAX, encoding="utf-8-sig"))
        self.taxtags = [t for t in tax["tags"] if len(t) >= 4]

    def scores(self, text, section=None):
        out = {}
        for n, p in self.pats:
            m = p.search(text)
            if m:
                multi = " " in n
                out[n] = len(n) + (20 if multi else 0) + (40 if multi and m.start() < 40 else 0) + (60 if section and n.lower() == section.lower() else 0) + min(self.names[n], 30) / 3
        return out

    def entity(self, text, section, sec_votes=None):
        own = self.scores(text, section)
        best, sc = max(own.items(), key=lambda kv: kv[1]) if own else (None, 0)
        if best and sc >= 75:
            return best, "strong"
        if sec_votes:
            win, tot = max(sec_votes.items(), key=lambda kv: kv[1])
            if tot >= 45:
                return win, "section"
        if best:
            return best, "text"
        if section and section.lower() in self.lower:
            return self.lower[section.lower()], "heading"
        generic = {"changes", "fixes", "fixed", "new", "other", "general", "what's new", "changed"}
        return (section.title() if section and section.lower() not in generic else "TODO"), "none"

    def system(self, entity, section, text):
        """-> (system, confident). Confident only when the heading and the topic's own history agree."""
        heads = [s for k, s in HEAD_SYSTEM if section and k in section.lower()]
        known = self.sys.get(entity)
        if heads and known and heads[0] in known:
            return heads[0], True
        if known and len(known) == 1:
            return next(iter(known)), True
        if heads:
            return heads[0], False
        if known:
            return known.most_common(1)[0][0], False
        return "World", False

    def type(self, text, section):
        t, s = text.lower(), (section or "").lower()
        if "fix" in s or re.match(r"fixed\b", t) or re.search(r"\bcrash|\bno longer\b|\bwon't\b|\bwouldn't\b|\bcould not\b|\bcan't be\b", t):
            return "Fix", True
        if "perform" in s or re.search(r"\bfaster\b|\bsmoother\b|cost(s)? (much )?less|\blag\b|frame rate|\bmemory\b", t):
            return "Performance", True
        if re.search(r"\bremoved\b|\bis gone\b|\bare gone\b|\bretired\b|\bdropped\b", t):
            return "Removal", True
        if re.search(r"\binstead\b|\brather than\b|\breworked\b|\breplaced\b|→|\bwas \d|\bnow (works|uses|takes|reads)\b", t):
            return "Rework", False
        if re.match(r"(a |an |the )?(new|brand-new)\b", t) or re.search(r"\bcan now\b|\badded\b|\badds\b|\bintroduc", t):
            return "New", True
        return "New", False

    def tags_for(self, entity, text):
        out = [t for t, _ in self.tags.get(entity, Counter()).most_common(2)]
        low = text.lower()
        for t in self.taxtags:
            if len(out) >= 3:
                break
            if t.replace("-", " ") in low and t not in out and t not in ("online", "mod"):
                out.append(t)
        return out


def draft_for(rel, g):
    bl, skipped = bullets_of(rel)
    votes = defaultdict(Counter)
    for b in bl:
        if b["section"]:
            for n, sc in g.scores(b["text"], b["section"]).items():
                votes[b["section"]][n] += sc
            for n, sc in g.scores(b["section"]).items():
                votes[b["section"]][n] += 2 * sc
    rows = []
    for i, b in enumerate(bl, 1):
        text = b["text"]
        ent, how = g.entity(text, b["section"], votes.get(b["section"]))
        system, sys_ok = g.system(ent, b["section"], text)
        typ, typ_ok = g.type(text, b["section"])
        first = text.split(" ", 1)[0]
        low = text if (first.isupper() and len(first) > 1) or re.search(r"\d", first) or first in ent.split() else text[0].lower() + text[1:]
        sent = re.split(r"(?<=[.!?])\s+(?=[A-Z])", low, maxsplit=1)[0]
        review = ["summary"]
        if how != "strong":
            review.append("entity")
        if not sys_ok:
            review.append("system")
        if not typ_ok:
            review.append("change_type")
        if re.search(r"\b(more|less|faster|slower|twice|half|cheaper|damage|%|longer|shorter)\b", text, re.I):
            review.append("direction")
        plat = ["all"]
        for k in ("phone", "touch", "android", "linux", "windows", "desktop"):
            if re.search(r"\b" + k + r"\b", text, re.I):
                plat, review = [k], review + ["platforms"]
                break
        rows.append({"id": f"{rel['version']}-{i:03d}", "version": rel["version"], "date": rel["date"], "system": system, "entity": ent,
                     "change_type": typ, "direction": "n/a", "summary": f"{ent}: {sent}", "tags": g.tags_for(ent, text),
                     "platforms": plat, "dev_note": None, "source": text, "_review": review})
    return rows, skipped


# ------------------------------------------------------------------ topic-name check
GENERIC_TOPICS = {"unchanged", "balance", "online", "offline", "changes", "fixes", "fix", "other", "misc", "general", "various",
                  "update", "updates", "improvements", "everything", "new", "notes", "stuff", "bugs"}
SMALL_WORDS = {"of", "the", "and", "in", "to", "for", "on", "with", "a", "an", "at", "by", "from", "as", "or", "is", "it", "its",
               "your", "you", "yours", "their", "instead", "what", "where", "when", "now", "no", "not", "more"}


def _plain(name):
    return re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()


def topic_name_warnings(rows, known):
    """New topic names that look like a headline fragment or a near-duplicate of an existing topic.
    Topics are short noun phrases ("Magic Repair", "Gathering Nodes"); a drafted entity is often the start of the bullet instead.
    Only names not already in the data are checked, so an established topic is never flagged.
    Strong signals say "looks wrong"; weak ones only say "worth a look"."""
    import difflib
    by_plain = {}
    for k in known:
        by_plain.setdefault(_plain(k), k)
    strong, weak = [], []
    for name in sorted({r.get("entity", "") for r in rows}):
        if not name or name == "TODO" or name in known:
            continue
        words = name.split()
        n = sum(1 for r in rows if r.get("entity") == name)
        rowtxt = f"({n} row{'s' if n != 1 else ''})"
        why, soft = [], []
        if len(words) >= 6:
            why.append(f"{len(words)} words long")
        elif len(words) >= 4:
            soft.append(f"{len(words)} words long")
        if "," in name:
            why.append("contains a comma")
        if re.search(r"'S\b", name):
            why.append("has a capital S after an apostrophe")
        mid = [w for w in words[1:] if w.lower() in SMALL_WORDS and w[:1].isupper()]
        if mid and len(words) >= 3:
            why.append("is in headline Title Case (" + ", ".join(sorted(set(mid))) + " capitalised mid-name)")
        if _plain(name) in GENERIC_TOPICS:
            why.append("is a generic word, not a topic")
        sim = []
        if _plain(name) in by_plain and by_plain[_plain(name)] != name:
            sim.append(by_plain[_plain(name)])
            why.append("differs from an existing topic only in capitals or punctuation")
        sim += [by_plain[m] for m in difflib.get_close_matches(_plain(name), list(by_plain), n=3, cutoff=0.78) if by_plain[m] not in sim]
        if sim and not why:
            soft.append("is very like an existing topic")
        if not why and len(words) >= 2 and len(words[0]) >= 5:
            kin = sorted(k for k in known if k.split()[:1] == words[:1] and k != name)
            if kin:
                soft.append("shares its first word with existing topics " + ", ".join(repr(k) for k in kin[:3]) + "; is it part of one of them?")
        if why:
            msg = f"new topic {name!r} {rowtxt} looks wrong: " + "; ".join(why + soft) + "."
            if sim:
                msg += " Existing topics it resembles: " + ", ".join(repr(x) for x in sim[:3]) + "."
            strong.append(msg)
        elif soft:
            msg = f"new topic {name!r} {rowtxt}: worth a look: " + "; ".join(soft) + "."
            if sim:
                msg += " Resembles: " + ", ".join(repr(x) for x in sim[:3]) + "."
            weak.append(msg)
    out = strong + weak
    if strong:
        out.append("A topic should be a short noun phrase for the thing that changed. Rename the ones marked 'looks wrong' in the rows file "
                   "(or reuse an existing topic) before continuing; if a name really is right, ignore the warning.")
    return out


def cmd_approve(a):
    p = f"{INBOX}/rows.draft.jsonl"
    if not os.path.exists(p):
        sys.exit(f"{p} not found; run prepare first.")
    rows = read_jsonl(p)
    bad = [r["id"] for r in rows if r["entity"] == "TODO"]
    if bad:
        sys.exit(f"entity is still TODO in: {', '.join(bad)}. Set it (or delete the row), then approve.")
    for w in topic_name_warnings(rows, {r["entity"] for r in read_jsonl(ALL)}):
        print("warn:", w)
    n = Counter(f for r in rows for f in r.get("_review", []))
    for r in rows:
        r.pop("_review", None)
    write_jsonl(f"{INBOX}/rows.jsonl", rows)
    print(f"wrote {INBOX}/rows.jsonl ({len(rows)} rows). Fields that were flagged for review in the draft: {dict(n)}")
    print("Next: python tools/notes.py ingest")


def norm_src(s):
    return re.sub(r"[^a-z0-9]+", " ", clean(s).lower()).strip()


def cmd_backtest(a):
    rows = read_jsonl(ALL)
    src = {r["id"]: r["source"] for r in read_jsonl(SOURCES)}
    if not src or not os.path.exists(NOTES):
        sys.exit("backtest needs the original release text, which is not stored in the repo. Run `python tools/notes.py fetch` "
                 "to download data/release_notes.md, and restore data/normalized/sources.jsonl (kept locally, git-ignored).")
    rows = [dict(r, source=src[r["id"]]) for r in rows if r["id"] in src]   # rows with no local source text cannot be scored
    rels = [r for r in parse_notes() if r["has_body_notes"]]
    rels = sorted(rels, key=lambda r: vkey(r["version"]))[-a.last:]
    tot, ok = Counter(), Counter()
    for rel in rels:
        g = Guesser([r for r in rows if vkey(r["version"]) < vkey(rel["version"])])
        truth = {norm_src(r["source"]): r for r in rows if r["version"] == rel["version"]}
        d, _ = draft_for(rel, g)
        tot["truth"] += len(truth)
        for r in d:
            t = truth.get(norm_src(r["source"]))
            if not t:
                continue
            tot["matched"] += 1
            for f in ("entity", "system", "change_type"):
                key = (f, f in r["_review"])
                tot[key] += 1
                ok[key] += r[f] == t[f]
            tot["tags"] += 1
            ok["tags"] += bool(set(r["tags"]) & set(t["tags"])) or not t["tags"]
    print(f"{len(rels)} releases, {tot['truth']} real rows, {tot['matched']} matched to a drafted bullet ({100 * tot['matched'] // max(tot['truth'], 1)}% coverage)")
    print("accuracy of each guessed field, split by whether the draft flagged it for review:")
    for f in ("entity", "system", "change_type"):
        u, fl = (f, False), (f, True)
        allc = (ok[u] + ok[fl]) * 100 // max(tot[u] + tot[fl], 1)
        print(f"  {f:12} overall {allc:3}% | unflagged {100 * ok[u] // max(tot[u], 1):3}% right ({tot[u]} rows) | flagged {100 * ok[fl] // max(tot[fl], 1):3}% right ({tot[fl]} rows)")
    print(f"  tags         {100 * ok['tags'] // max(tot['tags'], 1)}% share at least one tag with the real row")


# ------------------------------------------------------------------ selftest / backup
def _hash(path):
    import hashlib
    return hashlib.sha256(open(path, "rb").read()).hexdigest() if os.path.exists(path) else None


def cmd_backup(a):
    import time
    dest = f"_backups/{time.strftime('%Y%m%d-%H%M%S')}"
    os.makedirs(dest)
    for d in (D, "web"):
        shutil.copytree(d, f"{dest}/{d}", ignore=shutil.ignore_patterns("done"))
    size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(dest) for f in fs) / 1e6
    print(f"snapshot of data/ and web/ saved to {dest} ({size:.1f} MB). Restore by copying the folders back.")


def cmd_selftest(a):
    import tempfile
    if not os.path.exists(NOTES):
        sys.exit("selftest needs the raw release notes, which are not stored in the repo. Run `python tools/notes.py fetch` first.")
    behind = notes_behind()
    if behind:
        sys.exit(f"selftest needs release_notes.md to be current: it ends at {behind[0]} but the ingested rows reach {behind[1]} "
                 "(someone else added newer patches). Run `python tools/notes.py fetch` first.")
    real = [ALL, RELS, HUBS, "web/data.js", NOTES, f"{D}/merges.csv"] + sorted(glob.glob("web/shards/*.js")) + sorted(glob.glob(f"{DESC}/*.txt"))
    before = {p: _hash(p) for p in real}
    results = []

    def check(name, ok, detail=""):
        results.append(ok)
        print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail and not ok else ""))

    tmp = tempfile.mkdtemp(prefix="notes-selftest-")
    try:
        for d in (D, "tools", "web"):
            shutil.copytree(d, f"{tmp}/{d}", ignore=shutil.ignore_patterns("done", "inbox"))

        def run(*args):
            r = subprocess.run([sys.executable, "tools/notes.py", *args], cwd=tmp, capture_output=True, text=True, encoding="utf-8")
            return r.returncode, r.stdout + r.stderr

        def t(p):
            return f"{tmp}/{p}"
        rows = read_jsonl(t(ALL))
        withbody = sorted({r["version"] for r in rows}, key=vkey)[-3:]
        keep = [r for r in rows if r["version"] not in withbody]
        write_jsonl(t(ALL), keep)
        write_jsonl(t(RELS), [r for r in read_jsonl(t(RELS)) if r["version"] not in withbody])
        print(f"sandbox: {tmp}\nsimulating {len(withbody)} new release(s): {', '.join(withbody)}")

        rc, out = run("status")
        check("status sees the simulated releases as pending", rc == 0 and all(v in out for v in withbody), out[-200:])
        rc, out = run("prepare")
        check("prepare runs", rc == 0, out[-300:])
        draft = read_jsonl(t(f"{INBOX}/rows.draft.jsonl"))
        check("draft has rows and sources", len(draft) > 0 and all(r["source"] for r in draft))
        check("draft ids are sequential per version", all(
            r["id"] == f"{r['version']}-{i:03d}" for v in {x["version"] for x in draft}
            for i, r in enumerate([x for x in draft if x["version"] == v], 1)))
        write_jsonl(t(f"{INBOX}/rows.draft.jsonl"), [dict(r, entity="TODO") if i == 0 else r for i, r in enumerate(draft)])
        rc, out = run("approve")
        check("approve refuses a draft with an unresolved TODO entity", rc != 0 and not os.path.exists(t(f"{INBOX}/rows.jsonl")))
        fixed = [dict(r, entity="Selftest Topic", summary="Selftest Topic: " + r["summary"].split(": ", 1)[-1]) if i == 0 else r
                 for i, r in enumerate(draft)]
        write_jsonl(t(f"{INBOX}/rows.draft.jsonl"), fixed)
        rc, out = run("approve")
        check("approve accepts the fixed draft and strips _review", rc == 0 and all("_review" not in r for r in read_jsonl(t(f"{INBOX}/rows.jsonl"))), out[-200:])

        good = read_jsonl(t(f"{INBOX}/rows.jsonl"))
        bad = [dict(r) for r in good]
        bad[0]["system"] = "Nonsense"
        bad[-1]["id"] = "0.1.9999-001"
        write_jsonl(t(f"{INBOX}/rows.jsonl"), bad)
        h = _hash(t(ALL))
        rc, out = run("ingest")
        check("ingest rejects a bad batch", rc != 0)
        check("a rejected batch writes nothing", _hash(t(ALL)) == h)
        write_jsonl(t(f"{INBOX}/rows.jsonl"), good)
        rc, out = run("ingest", "--dry-run")
        check("ingest --dry-run validates without writing", rc == 0 and _hash(t(ALL)) == h, out[-200:])
        rc, out = run("ingest")
        after = read_jsonl(t(ALL))
        check("ingest appends exactly the approved rows", rc == 0 and len(after) == len(keep) + len(good), out[-300:])
        check("all row ids are unique", len({r["id"] for r in after}) == len(after))
        check("releases are recorded", {r["version"] for r in read_jsonl(t(RELS))} >= set(withbody))
        check("new topic got a hub", "Selftest Topic" in open(t(HUBS), encoding="utf-8").read())
        check("describe wrote a worklist", os.path.exists(t(f"{INBOX}/describe.md")))
        rc, out = run("build")
        js = "".join(open(f, encoding="utf-8").read() for f in glob.glob(t("web/shards/*.js")))
        check("build regenerates the data shards with the new versions", rc == 0 and all(f'"v":"{v}"' in js for v in withbody), out[-300:])
        rc, out = run("status")
        check("status shows nothing pending afterwards", "pending (in notes, not ingested): none" in out, out[-200:])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    check("your real files were not touched", all(_hash(p) == before[p] for p in real), "a real file changed")
    print(f"\n{sum(results)}/{len(results)} checks passed" + ("" if all(results) else "  <-- FAILURES"))
    sys.exit(0 if all(results) else 1)


# ------------------------------------------------------------------ ingest
FIELDS = ["id", "version", "date", "system", "entity", "change_type", "direction", "summary", "tags", "platforms", "dev_note", "source"]


def validate(rows, pend, tax, known_entities):
    errs, warns = [], []
    pv = {r["version"]: r for r in pend}
    seen, per, newseen = set(), defaultdict(list), set()
    for i, r in enumerate(rows, 1):
        w = f"row {i} ({r.get('id', '?')})"
        miss = [f for f in FIELDS if f not in r]
        if miss:
            errs.append(f"{w}: missing {miss}")
            continue
        r["direction"] = MINUS if r["direction"] == "-" else r["direction"]
        if r["version"] not in pv:
            errs.append(f"{w}: version {r['version']} is not a pending release")
        elif r["date"] != pv[r["version"]]["date"]:
            errs.append(f"{w}: date {r['date']} should be {pv[r['version']]['date']}")
        if not re.fullmatch(re.escape(r["version"]) + r"-\d{3}", r["id"]):
            errs.append(f"{w}: id must look like {r['version']}-001")
        if r["id"] in seen:
            errs.append(f"{w}: duplicate id")
        seen.add(r["id"])
        per[r["version"]].append(r["id"])
        if r["system"] not in tax["systems"]:
            errs.append(f"{w}: system {r['system']!r} not in taxonomy")
        if r["change_type"] not in tax["change_types"]:
            errs.append(f"{w}: change_type {r['change_type']!r} not in taxonomy")
        if r["direction"] not in ("+", MINUS, "~", "n/a"):
            errs.append(f"{w}: direction {r['direction']!r}")
        for t in r["tags"]:
            if t not in tax["tags"]:
                warns.append(f"{w}: tag {t!r} is not in taxonomy (kept; add it to taxonomy.json)")
        for p in r["platforms"]:
            if p not in tax["platform_values"]:
                errs.append(f"{w}: platform {p!r}")
        if not r["entity"] or not r["summary"].startswith(r["entity"] + ": "):
            errs.append(f"{w}: summary must start with '{r['entity']}: '")
        if r["entity"] not in known_entities and r["entity"] not in newseen:
            newseen.add(r["entity"])
            warns.append(f"{w}: NEW topic {r['entity']!r}")
    for v, ids in per.items():
        want = [f"{v}-{n:03d}" for n in range(1, len(ids) + 1)]
        if sorted(ids) != want:
            errs.append(f"{v}: ids must run {v}-001 to {v}-{len(ids):03d} with no gaps")
    return errs, warns


def guess_hub(rows_for_topic, existing_rows, hub):
    tags = Counter(t for r in rows_for_topic for t in r["tags"])
    score = Counter()
    for r in existing_rows:
        h = hub.get(r["entity"])
        if h:
            score[h] += sum(tags[t] for t in r["tags"] if t in tags)
    return score.most_common(1)[0][0] if score else "Uncategorised"


def cmd_ingest(a):
    path = f"{INBOX}/rows.jsonl"
    if not os.path.exists(path):
        sys.exit(f"{path} not found. Run prepare, then write the rows (see README.md).")
    pend = pending_releases()
    tax = json.load(open(TAX, encoding="utf-8-sig"))
    existing = read_jsonl(ALL)
    alias = merge_alias()
    known = {r["entity"] for r in existing}
    rows = read_jsonl(path)
    errs, warns = validate(rows, pend, tax, known)
    for w in warns:
        print("warn:", w)
    for w in topic_name_warnings(rows, known):
        print("warn:", w)
    if errs:
        print(f"\n{len(errs)} error(s), nothing written:")
        for e in errs:
            print("  ", e)
        sys.exit(1)
    rows.sort(key=lambda r: (vkey(r["version"]), r["id"]))
    rows = [{k: r[k] for k in FIELDS} for r in rows]
    sources = [{"id": r["id"], "source": r["source"]} for r in rows]
    rows = [{k: v for k, v in r.items() if k != "source"} for r in rows]
    # releases.jsonl entries for every pending release, including ones with no rows
    rel = [dict(version=r["version"], date=r["date"], published_utc=r["published"], source_tag=r["tag"],
                has_body_notes=r["has_body_notes"], prs=[dict(number=p["number"], title=p["title"], url=p["url"]) for p in r["prs"]], **release_meta(r))
           for r in sorted(pend, key=lambda r: vkey(r["version"]))]
    hub = {h["topic"]: h["primary_hub"] for h in csv.DictReader(open(HUBS, encoding="utf-8"))}
    newt = defaultdict(list)
    for r in rows:
        t = topic_of(r["entity"], alias)
        if t not in hub:
            newt[t].append(r)
    if not a.dry_run:
        write_jsonl(ALL, rows, "a")
        write_jsonl(SOURCES, sources, "a")
        write_jsonl(RELS, rel, "a")
        with open(HUBS, "a", encoding="utf-8", newline="") as f:
            w = csv.writer(f, lineterminator="\n")
            for t, rs in sorted(newt.items()):
                h = guess_hub(rs, existing, hub)
                w.writerow([t, h, "", len(rs), "; ".join(sorted({r["system"] for r in rs})), "yes" if len(rs) <= 2 else ""])
                print(f"new topic {t!r} -> hub {h!r} (edit {HUBS} to change)")
        arch = f"{INBOX}/done"
        os.makedirs(arch, exist_ok=True)
        stamp = "-".join(sorted({r["version"] for r in rows}, key=vkey)[:1] + sorted({r["version"] for r in rows}, key=vkey)[-1:]) or "empty"
        shutil.move(path, f"{arch}/rows-{stamp}.jsonl")
    print(f"{'would append' if a.dry_run else 'appended'} {len(rows)} row(s) for {len({r['version'] for r in rows})} version(s); "
          f"{len(rel)} release(s) recorded; {len(newt)} new topic(s).")
    if not a.dry_run:
        cmd_describe(a)


# ------------------------------------------------------------------ describe
def cmd_validate(a):
    """Check everything already stored: rows against the taxonomy, ids, release dates, topics against the hub list. Writes nothing."""
    tax = json.load(open(TAX, encoding="utf-8-sig"))
    rows, rels = read_jsonl(ALL), read_jsonl(RELS)
    alias = merge_alias()
    hub = {h["topic"]: h["primary_hub"] for h in csv.DictReader(open(HUBS, encoding="utf-8"))}
    errs, warns = [], []
    rv = {}
    for r in rels:
        if r["version"] in rv:
            errs.append(f"releases: duplicate version {r['version']}")
        rv[r["version"]] = r
        if r.get("kind", "release") not in ("release", "likely-hotfix", "bulk-import"):
            errs.append(f"releases: {r['version']} has kind {r.get('kind')!r}")
    seen, per, tags_bad, prefix_off = set(), defaultdict(list), set(), []
    need = [f for f in FIELDS if f != "source"]     # the verbatim source text is kept local, not in all.jsonl
    for i, r in enumerate(rows, 1):
        w = f"row {i} ({r.get('id', '?')})"
        miss = [f for f in need if f not in r]
        if miss:
            errs.append(f"{w}: missing {miss}")
            continue
        if r["version"] not in rv:
            errs.append(f"{w}: version {r['version']} is not in releases.jsonl")
        elif r["date"] != rv[r["version"]]["date"]:
            errs.append(f"{w}: date {r['date']} should be {rv[r['version']]['date']}")
        if not re.fullmatch(re.escape(r["version"]) + r"-\d{3}", r["id"]):
            errs.append(f"{w}: id must look like {r['version']}-001")
        if r["id"] in seen:
            errs.append(f"{w}: duplicate id")
        seen.add(r["id"])
        per[r["version"]].append(r["id"])
        if r["system"] not in tax["systems"]:
            errs.append(f"{w}: system {r['system']!r} not in taxonomy")
        if r["change_type"] not in tax["change_types"]:
            errs.append(f"{w}: change_type {r['change_type']!r} not in taxonomy")
        if r["direction"] not in ("+", MINUS, "~", "n/a"):
            errs.append(f"{w}: direction {r['direction']!r}")
        tags_bad |= {t for t in r["tags"] if t not in tax["tags"]}
        for p in r["platforms"]:
            if p not in tax["platform_values"]:
                errs.append(f"{w}: platform {p!r}")
        if not r["entity"]:
            errs.append(f"{w}: empty entity")
        elif not r["summary"].startswith(r["entity"] + ": "):
            prefix_off.append(r["id"])      # ingest enforces the prefix; later hand edits that moved a row to another topic leave the old one, which the site shows in full
        if topic_of(r["entity"], alias) not in hub:
            errs.append(f"{w}: topic {topic_of(r['entity'], alias)!r} is not in {HUBS}")
    for v, ids in per.items():
        if sorted(ids) != [f"{v}-{n:03d}" for n in range(1, len(ids) + 1)]:
            errs.append(f"{v}: ids must run {v}-001 to {v}-{len(ids):03d} with no gaps")
    if prefix_off:
        warns.append(f"{len(prefix_off)} summary(ies) do not start with their topic name: " + ", ".join(prefix_off[:10]))
    if tags_bad:
        warns.append(f"{len(tags_bad)} tag(s) not in taxonomy.json: " + ", ".join(sorted(tags_bad)[:15]))
    topics = {topic_of(r["entity"], alias) for r in rows}
    unused = sorted(t for t in hub if t not in topics)
    if unused:
        warns.append(f"{len(unused)} topic(s) in {HUBS} have no rows: " + ", ".join(unused[:10]))
    src = {r["id"] for r in read_jsonl(SOURCES)}
    if src and not src <= seen:
        errs.append(f"sources.jsonl has {len(src - seen)} id(s) that are not in all.jsonl")
    artifact = re.compile(r"\[cite\b|\b(TODO|FIXME|TBD)\b")      # leftovers from drafting; 210 "[cite: N]" markers once got in
    for f in sorted(glob.glob(f"{DESC}/*.txt")):
        for n, line in enumerate(open(f, encoding="utf-8"), 1):
            line = line.rstrip("\n")
            if not line.strip():
                continue
            w = f"{f}:{n}"
            if " ||| " not in line:
                errs.append(f"{w}: not 'Topic ||| text', so the site would ignore it: {line[:60]!r}")
                continue
            topic, text = line.split(" ||| ", 1)
            if not text.strip():
                errs.append(f"{w}: {topic!r} has an empty description")
            elif " ||| " in text:
                errs.append(f"{w}: {topic!r} has a second ' ||| ' in its text")
            elif artifact.search(text):
                errs.append(f"{w}: {topic!r} contains {artifact.search(text).group(0)!r}")
    for w in warns:
        print("warn:", w)
    if errs:
        print(f"{len(errs)} error(s):")
        for e in errs[:50]:
            print("  ", e)
        if len(errs) > 50:
            print(f"   ... and {len(errs) - 50} more")
        sys.exit(1)
    print(f"ok: {len(rows)} rows, {len(rels)} releases, {len(topics)} topics")


def stale_topics():
    cnt = row_counts()
    alias = merge_alias()
    c2 = Counter()
    for e, n in cnt.items():
        c2[topic_of(e, alias)] += n
    state = load_state()
    if state is None:  # first run: treat existing descriptions as current
        state = {t: c2[t] for t in descriptions() if t in c2}
        os.makedirs(DESC, exist_ok=True)
        json.dump(state, open(STATE, "w", encoding="utf-8"), indent=0, ensure_ascii=False)
    return sorted(t for t in c2 if state.get(t) != c2[t]), c2, state


def cmd_describe(a):
    stale, cnt, state = stale_topics()
    if not stale:
        print("All descriptions are current.")
        return
    alias = merge_alias()
    rows = defaultdict(list)
    for r in read_jsonl(ALL):
        rows[topic_of(r["entity"], alias)].append(r)
    hub = {h["topic"]: h["primary_hub"] for h in csv.DictReader(open(HUBS, encoding="utf-8"))}
    desc = descriptions()
    out = ["# Topics needing a description", "",
           "Write each as one line `Topic ||| description` in data/descriptions/patch-<latest version>.txt.",
           "Describe how the topic works as of the latest change; later changes override earlier ones; never invent. "
           "Existing descriptions are shown so you can update them rather than start over.", ""]
    for t in stale:
        l = sorted(rows[t], key=lambda r: (vkey(r["version"]), r["id"]))
        out.append(f"## {t} [{hub.get(t, '-')}] n={len(l)}" + ("  (NEW)" if t not in desc else f"  (was {state.get(t, '?')} changes)"))
        if t in desc:
            out.append(f"CURRENT: {desc[t][0]}")
        for r in l:
            d = "" if r["direction"] == "n/a" else r["direction"]
            n = f" (dev: {r['dev_note']})" if r["dev_note"] else ""
            out.append(f"{r['version'].replace('0.1.', '')} {r['change_type']}{d}: {r['summary'].split(': ', 1)[-1]}{n}")
        out.append("")
    os.makedirs(INBOX, exist_ok=True)
    open(f"{INBOX}/describe.md", "w", encoding="utf-8").write("\n".join(out))
    print(f"{len(stale)} topic(s) need a description: wrote {INBOX}/describe.md")


# ------------------------------------------------------------------ build / status
def cmd_build(a):
    if a.check:        # write nothing; fail if the committed web/data.js and shards differ from what a build gives
        sys.exit(subprocess.run([sys.executable, "tools/update_data.py", "--check"]).returncode)
    subprocess.run([sys.executable, "tools/update_data.py"], check=True)
    stale, cnt, state = stale_topics()
    desc = descriptions()
    for t, (_, f) in desc.items():          # topics described in a patch file are now current
        if f.startswith("patch-") and t in cnt:
            state[t] = cnt[t]
    json.dump(state, open(STATE, "w", encoding="utf-8"), indent=0, ensure_ascii=False)
    stale, _, _ = stale_topics()
    missing = [t for t in cnt if t not in desc]
    unknown = [t for t in desc if t not in cnt]
    print(f"web/data.js and web/shards/ rebuilt: {sum(cnt.values())} changes, {len(cnt)} topics, {len(desc)} descriptions")
    if missing:
        print("topics with NO description:", ", ".join(sorted(missing)[:20]), "..." if len(missing) > 20 else "")
    if unknown:
        print("descriptions for unknown topics:", ", ".join(sorted(unknown)))
    if stale:
        print(f"{len(stale)} stale description(s): run `python tools/notes.py describe`")


def notes_behind():
    """If the local copy of the release notes is older than the data already ingested, return (newest in notes, newest with rows)."""
    notes = parse_notes()
    rows = read_jsonl(ALL)
    if not notes or not rows:
        return None
    last = max((r["version"] for r in rows), key=vkey)
    return (notes[0]["version"], last) if vkey(notes[0]["version"]) < vkey(last) else None


def cmd_status(a):
    notes = parse_notes()
    pend = pending_releases()
    rows = read_jsonl(ALL)
    last = max((r["version"] for r in rows), key=vkey) if rows else "-"
    print(f"release_notes.md: {len(notes)} releases, newest {notes[0]['version'] if notes else '-'}" + ("" if notes else "  (missing: run fetch)"))
    print(f"ingested rows: {len(rows)}, newest version with rows {last}")
    print(f"pending (in notes, not ingested): {', '.join(r['version'] for r in pend) or 'none'}")
    src = {r["id"] for r in read_jsonl(SOURCES)}
    if not src:
        print("sources.jsonl: missing or empty (git-ignored; selftest and backtest need it)")
    else:
        nosrc = [r for r in rows if r["id"] not in src]
        print(f"rows without local source text: {len(nosrc)} in {len({r['version'] for r in nosrc})} release(s); "
              "sources.jsonl is local-only, so rows another maintainer ingested on their own machine have none here (backtest skips them)")
    print(f"inbox rows.jsonl present: {os.path.exists(f'{INBOX}/rows.jsonl')}")
    stale, _, _ = stale_topics()
    print(f"stale descriptions: {len(stale)}")
    behind = notes_behind()
    if behind:
        print(f"WARNING: data/release_notes.md is behind the data (notes end at {behind[0]}, rows reach {behind[1]}). "
              "Someone else ingested newer patches. Run `python tools/notes.py fetch` to refresh it; selftest, prepare and backtest need it current.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    for name, fn in [("status", cmd_status), ("fetch", cmd_fetch), ("prepare", cmd_prepare), ("approve", cmd_approve),
                     ("ingest", cmd_ingest), ("describe", cmd_describe), ("build", cmd_build), ("validate", cmd_validate), ("backtest", cmd_backtest), ("selftest", cmd_selftest), ("backup", cmd_backup), ("relmeta", cmd_relmeta)]:
        p = sp.add_parser(name)
        p.add_argument("--dry-run", action="store_true")
        p.add_argument("--force", action="store_true", help="prepare: overwrite an existing rows.draft.jsonl")
        p.add_argument("--check", action="store_true", help="build: write nothing, exit 1 if web/data.js or web/shards/ are out of date")
        p.add_argument("--last", type=int, default=25, help="backtest: how many recent releases to score")
        p.set_defaults(fn=fn)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
