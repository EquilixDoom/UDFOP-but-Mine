"""Stored-data management for the notes tool (tools/notes_gui.py): search and bulk edits over every ingested row, topic and tag
management, a change journal with revert, splitting a stored row, a duplicate finder and a commit helper.
Standard library only. notes_gui.py calls bind() so these functions can use its helpers (check, guesser, run, ...)."""
import csv, difflib, glob, json, os, re, subprocess, threading, time
import notes as N

G = None
JOURNAL = "_backups/stored_journal.jsonl"   # git-ignored; one JSON object per line
EDITABLE = ("entity", "change_type", "tags", "platforms", "dev_note")
_FL = {"key": None, "flags": {}}
_FLLOCK = threading.Lock()


def bind(g):
    global G
    G = g


# ------------------------------------------------------------------ small readers
def sources():
    return {d["id"]: d["source"] for d in N.read_jsonl(N.SOURCES)}


def hubs():
    return {h["topic"]: h["primary_hub"] for h in csv.DictReader(open(N.HUBS, encoding="utf-8"))}


def view(r, src, done, fl):
    out = dict(r)
    out["source"] = src.get(r["id"], r["summary"].split(": ", 1)[-1])
    out["_confirmed"] = bool(done.get(r["id"]))
    out["flags"] = fl.get(r["id"], [])
    return out


# ------------------------------------------------------------------ flags: why a stored row deserves a second look
def _key():
    return (os.path.getmtime(N.ALL), os.path.getmtime(N.SOURCES) if os.path.exists(N.SOURCES) else 0)


def _flags_for(r, text, g, alias):
    f = []
    if r["change_type"] == "Other":
        f.append("type Other")
    if not r["tags"]:
        f.append("no tags")
    if G_long(text):
        f.append("long bullet")
    sc = g.scores(text)
    if sc:
        best, top = max(sc.items(), key=lambda kv: kv[1])
        names = {N.topic_of(n, alias) for n in sc}
        if top >= 75 and N.topic_of(r["entity"], alias) not in names:
            f.append("topic? text names " + N.topic_of(best, alias))
    return f


def flags_index():
    """Every stored row's flags. Built once (about 15 s) and kept in step by reflag() after the tool's own writes."""
    with _FLLOCK:
        key = _key()
        if _FL["key"] == key:
            return _FL["flags"]
        rows = N.read_jsonl(N.ALL)
        src = sources()
        g = G.guesser()
        alias = N.merge_alias()
        flags = {}
        for r in rows:
            f = _flags_for(r, src.get(r["id"], r["summary"]), g, alias)
            if f:
                flags[r["id"]] = f
        _FL.update(key=key, flags=flags)
        return flags


def fresh():
    return _FL["key"] is not None and _FL["key"] == _key()


def reflag(ids, was_fresh=True):
    """After a write by this tool: recompute the flags of the rows it touched only, so the next search does not wait for a full rebuild."""
    ids = set(ids)
    with _FLLOCK:
        if _FL["key"] is None or not ids or not was_fresh:
            return   # not built yet, or something else changed the data since: the next search rebuilds it
        rows = {r["id"]: r for r in N.read_jsonl(N.ALL) if r["id"] in ids}
        src = sources()
        g = G.guesser()
        alias = N.merge_alias()
        for i in ids:
            r = rows.get(i)
            f = _flags_for(r, src.get(i, r["summary"]), g, alias) if r else []
            if f:
                _FL["flags"][i] = f
            else:
                _FL["flags"].pop(i, None)
        _FL["key"] = _key()


def G_long(text):
    return len(text) > 300 or len(re.findall(r"[.!?] [A-Z]", text)) >= 3


# ------------------------------------------------------------------ journal
def journal_read():
    return N.read_jsonl(JOURNAL) if os.path.exists(JOURNAL) else []


def journal_append(entries):
    if not entries:
        return
    os.makedirs(os.path.dirname(JOURNAL), exist_ok=True)
    N.write_jsonl(JOURNAL, entries, "a")


def mark_built():
    journal_append([{"built": time.strftime("%Y-%m-%d %H:%M:%S")}])


def snap(r):
    return {k: r[k] for k in ("entity", "change_type", "tags", "platforms", "dev_note", "summary")}


def net_changes():
    """Per row, what changed since the last Build: the first 'before' and the last 'after' recorded for it."""
    net, order = {}, []
    for e in journal_read():
        if "built" in e:
            net, order = {}, []
            continue
        i = e["id"]
        if i not in net:
            net[i] = {"id": i, "kind": e["kind"], "before": e.get("before"), "after": e.get("after"), "of": e.get("of")}
            order.append(i)
        else:
            net[i]["after"] = e.get("after")
            if e["kind"] == "revert-split":
                net[i]["kind"] = "revert-split"
    out = []
    for i in order:
        n = net[i]
        if n["kind"] == "revert-split":
            continue
        if n["kind"] == "edit" and n["before"] == n["after"]:
            continue
        out.append(n)
    return out


# ------------------------------------------------------------------ the one writer for stored rows
def apply_edits(changes, confirms=None, hubs_pick=None, kind="edit"):
    """changes: {id: {field: value}} (EDITABLE fields); confirms: {id: bool}. Validates everything first, takes a snapshot before the
    first change of the session, keeps each summary's topic prefix in step, records the change in the journal, gives a new topic a hub."""
    tax = json.load(open(N.TAX, encoding="utf-8-sig"))
    allrows = N.read_jsonl(N.ALL)
    by = {r["id"]: r for r in allrows}
    plan, errs = [], []
    for i, ch in changes.items():
        o = by.get(i)
        if o is None:
            errs.append(f"{i}: not a stored row")
            continue
        n = {k: ch.get(k, o.get(k)) for k in EDITABLE}
        n["entity"] = " ".join(str(n["entity"] or "").split())
        n["dev_note"] = (str(n["dev_note"]).strip() or None) if n["dev_note"] is not None else None
        if not n["entity"] or n["entity"] == "TODO":
            errs.append(f"{i}: set a topic")
        elif n["change_type"] not in tax["change_types"]:
            errs.append(f"{i}: change type {n['change_type']!r} is not in the taxonomy")
        elif len(n["tags"]) > 3:
            errs.append(f"{i}: at most 3 tags")
        elif not n["platforms"] or any(p not in tax["platform_values"] for p in n["platforms"]):
            errs.append(f"{i}: platforms must be listed in the taxonomy")
        else:
            plan.append((o, n))
    if errs:
        return {"ok": False, "out": "; ".join(errs[:3]) + (f" (and {len(errs) - 3} more)" if len(errs) > 3 else "") + ". Nothing was saved."}
    batch = int(time.time() * 1000)
    stamp = time.strftime("%Y-%m-%d %H:%M:%S")
    entries, changed = [], 0
    for o, n in plan:
        if all(o.get(k) == n[k] for k in EDITABLE):
            continue
        if not G._BACKED_UP:
            b = G.run("backup")
            if not b["ok"]:
                return {"ok": False, "out": "Could not take the snapshot first: " + b["out"]}
            G._BACKED_UP.append(b["out"])
        before = snap(o)
        if o["summary"].startswith(o["entity"] + ": "):
            o["summary"] = n["entity"] + ": " + o["summary"][len(o["entity"]) + 2:]
        for k in EDITABLE:
            o[k] = n[k]
        entries.append({"b": batch, "t": stamp, "id": o["id"], "kind": kind, "before": before, "after": snap(o)})
        changed += 1
    if changed:
        was = fresh()
        N.write_jsonl(N.ALL, allrows)
        journal_append(entries)
        reflag([e["id"] for e in entries], was)
        ensure_hubs(allrows, {n["entity"] for _, n in plan}, hubs_pick or {})
    if confirms:
        done = G.row_review()
        was = dict(done)
        for i, c in confirms.items():
            if c:
                done[i] = True
            else:
                done.pop(i, None)
        if done != was:
            with open(G.ROWREV, "w", encoding="utf-8", newline="\n") as f:
                json.dump(done, f, indent=0, sort_keys=True)
    return {"ok": True, "changed": changed, "backup": G._BACKED_UP[0] if G._BACKED_UP else None}


def ensure_hubs(allrows, entities, picks):
    alias = N.merge_alias()
    hub = hubs()
    add = sorted({N.topic_of(e, alias) for e in entities} - set(hub))
    if not add:
        return
    with open(N.HUBS, "a", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        for t in add:
            mine = [x for x in allrows if N.topic_of(x["entity"], alias) == t]
            h = picks.get(t) or N.guess_hub(mine, [x for x in allrows if x not in mine], hub)
            w.writerow([t, h, "", len(mine), "yes" if len(mine) <= 2 else ""])


# ------------------------------------------------------------------ search, by ids, bulk
def search(q, limit=300):
    rows = N.read_jsonl(N.ALL)
    src, done, fl = sources(), G.row_review(), flags_index()
    alias = N.merge_alias()
    words = [w for w in (q.get("text") or "").lower().split() if w]
    topic = (q.get("topic") or "").strip().lower()
    exact = (q.get("topic_exact") or "").strip()
    vf, vt = q.get("vfrom") or "", q.get("vto") or ""
    flag = q.get("flag") or ""
    out, total = [], 0
    for r in rows:
        if exact and N.topic_of(r["entity"], alias) != exact:
            continue
        if q.get("type") and r["change_type"] != q["type"]:
            continue
        if q.get("tag") and q["tag"] not in r["tags"]:
            continue
        if vf and N.vkey(r["version"]) < N.vkey(vf):
            continue
        if vt and N.vkey(r["version"]) > N.vkey(vt):
            continue
        if topic and topic not in r["entity"].lower() and topic not in N.topic_of(r["entity"], alias).lower():
            continue
        c = bool(done.get(r["id"]))
        if q.get("status") == "unconfirmed" and c or q.get("status") == "confirmed" and not c:
            continue
        f = fl.get(r["id"], [])
        if flag == "any" and not f or flag not in ("", "any") and not any(x.startswith(flag) for x in f):
            continue
        if words:
            hay = (r["entity"] + " " + src.get(r["id"], r["summary"]) + " " + " ".join(r["tags"])).lower()
            if not all(w in hay for w in words):
                continue
        total += 1
        if len(out) < limit:
            out.append(view(r, src, done, fl))
    return {"rows": out, "total": total, "limit": limit}


def by_ids(ids):
    want = set(ids)
    src, done, fl = sources(), G.row_review(), flags_index()
    rows = [view(r, src, done, fl) for r in N.read_jsonl(N.ALL) if r["id"] in want]
    return {"rows": rows, "check": G.check(rows, stored=True)}


def bulk(body):
    """body: ids, set {change_type, entity, platforms}, add_tags, remove_tags, confirm (True/False/None)."""
    ids, st = body.get("ids") or [], body.get("set") or {}
    if not ids:
        return {"ok": False, "out": "Nothing is selected."}
    by = {r["id"]: r for r in N.read_jsonl(N.ALL)}
    changes = {}
    for i in ids:
        o = by.get(i)
        if o is None:
            continue
        c = {k: v for k, v in st.items() if k in ("change_type", "entity", "platforms") and v}
        tags = list(o["tags"])
        for t in body.get("add_tags") or []:
            if t not in tags:
                tags.append(t)
        tags = [t for t in tags if t not in (body.get("remove_tags") or [])]
        if tags != o["tags"]:
            c["tags"] = tags
        if c:
            changes[i] = c
    conf = {i: bool(body["confirm"]) for i in ids} if body.get("confirm") is not None else None
    res = apply_edits(changes, conf, body.get("hubs"), kind="edit")
    res["rows"] = len(ids)
    return res


# ------------------------------------------------------------------ split a stored row
def split_row(rid):
    allrows = N.read_jsonl(N.ALL)
    at = next((k for k, r in enumerate(allrows) if r["id"] == rid), None)
    if at is None:
        return {"ok": False, "out": "Not a stored row."}
    o = allrows[at]
    nums = [int(r["id"].rsplit("-", 1)[1]) for r in allrows if r["version"] == o["version"]]
    new = dict(json.loads(json.dumps(o)), id=f"{o['version']}-{max(nums) + 1:03d}")
    if not G._BACKED_UP:
        b = G.run("backup")
        if not b["ok"]:
            return {"ok": False, "out": "Could not take the snapshot first: " + b["out"]}
        G._BACKED_UP.append(b["out"])
    allrows.insert(at + 1, new)
    src = N.read_jsonl(N.SOURCES)
    text = next((d["source"] for d in src if d["id"] == rid), o["summary"].split(": ", 1)[-1])
    src.append({"id": new["id"], "source": text})
    was = fresh()
    N.write_jsonl(N.ALL, allrows)
    N.write_jsonl(N.SOURCES, src)
    reflag([new["id"]], was)
    journal_append([{"b": int(time.time() * 1000), "t": time.strftime("%Y-%m-%d %H:%M:%S"), "id": new["id"], "kind": "split", "of": rid, "before": None, "after": snap(new)}])
    return {"ok": True, "new": new["id"], "out": f"Added {new['id']} as a copy of {rid}. Both rows keep the whole bullet."}


def drop_row(rid):
    allrows = [r for r in N.read_jsonl(N.ALL) if r["id"] != rid]
    was = fresh()
    N.write_jsonl(N.ALL, allrows)
    N.write_jsonl(N.SOURCES, [d for d in N.read_jsonl(N.SOURCES) if d["id"] != rid])
    reflag([rid], was)
    done = G.row_review()
    if done.pop(rid, None):
        with open(G.ROWREV, "w", encoding="utf-8", newline="\n") as f:
            json.dump(done, f, indent=0, sort_keys=True)


def revert(ids):
    """Put each listed row back as it was before its first change since the last Build."""
    net = {n["id"]: n for n in net_changes()}
    by = {r["id"]: r for r in N.read_jsonl(N.ALL)}
    todo, skipped, gone = {}, 0, 0
    for i in ids:
        n = net.get(i)
        if n is None or i not in by:
            continue
        if n["kind"] == "split":
            if snap(by[i]) != n["after"]:
                skipped += 1
                continue
            drop_row(i)
            journal_append([{"b": int(time.time() * 1000), "t": time.strftime("%Y-%m-%d %H:%M:%S"), "id": i, "kind": "revert-split", "before": n["after"], "after": None}])
            gone += 1
        else:
            if snap(by[i]) != n["after"]:
                skipped += 1
                continue
            todo[i] = {k: n["before"][k] for k in EDITABLE}
    res = apply_edits(todo, None, None, kind="edit") if todo else {"ok": True, "changed": 0}
    if res["ok"]:
        # a reverted summary may differ in more than the prefix; restore it exactly
        if todo:
            allrows = N.read_jsonl(N.ALL)
            for r in allrows:
                if r["id"] in todo:
                    r["summary"] = net[r["id"]]["before"]["summary"]
            was = fresh()
            N.write_jsonl(N.ALL, allrows)
            reflag(list(todo), was)
    res["reverted"] = len(todo) + gone
    res["skipped"] = skipped
    return res


# ------------------------------------------------------------------ topics
def topics_all():
    alias = N.merge_alias()
    rows = N.read_jsonl(N.ALL)
    desc = N.descriptions()
    reviewed = N.load_reviewed()
    hub = hubs()
    agg = {}
    for r in rows:
        t = N.topic_of(r["entity"], alias)
        a = agg.setdefault(t, {"topic": t, "n": 0, "first": r["version"], "last": r["version"]})
        a["n"] += 1
        if N.vkey(r["version"]) > N.vkey(a["last"]):
            a["last"] = r["version"]
    out = []
    for t, a in agg.items():
        a["hub"] = hub.get(t, "-")
        a["desc"] = t in desc
        a["reviewed"] = reviewed.get(t) == a["n"]
        out.append(a)
    return sorted(out, key=lambda a: a["topic"].lower())


def rewrite_csv_line(path, key_col, old, new_values):
    """Replace (new_values dict) or delete (None) the line whose first column is `old`, leaving every other line as it was."""
    lines = open(path, encoding="utf-8", newline="").read().splitlines(keepends=True)
    out = []
    for k, line in enumerate(lines):
        row = next(csv.reader([line]), None) if k else None
        if row and row[0] == old:
            if new_values is not None:
                import io
                b = io.StringIO()
                csv.writer(b, lineterminator="\n").writerow(new_values(row))
                out.append(b.getvalue())
        else:
            out.append(line)
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write("".join(out))


def rename_topic(frm, to):
    to = " ".join(to.split())
    alias = N.merge_alias()
    if not to or to == frm:
        return {"ok": False, "out": "Give a different, non-empty topic name."}
    if N.topic_of(to, alias) != to:
        return {"ok": False, "out": f"{to!r} is merged into {N.topic_of(to, alias)!r}; use that name."}
    rows = [r for r in N.read_jsonl(N.ALL) if N.topic_of(r["entity"], alias) == frm]
    if not rows:
        return {"ok": False, "out": f"No rows are filed under {frm!r}."}
    hub_before = hubs()
    existed = to in hub_before
    res = apply_edits({r["id"]: {"entity": to} for r in rows}, None, None)
    if not res["ok"]:
        return res
    n_to = sum(1 for r in N.read_jsonl(N.ALL) if N.topic_of(r["entity"], alias) == to)
    if existed:   # a merge: the old hub line goes, the target's count is brought up to date
        rewrite_csv_line(N.HUBS, 0, frm, None)
        rewrite_csv_line(N.HUBS, 0, to, lambda row: row[:3] + [str(n_to), "yes" if n_to <= 2 else ""])
    elif frm in hub_before:   # a rename: the topic keeps its hub (editing already gave the new name a guessed one)
        rewrite_csv_line(N.HUBS, 0, to, None)
        rewrite_csv_line(N.HUBS, 0, frm, lambda row: [to] + row[1:3] + [str(n_to), "yes" if n_to <= 2 else ""])
    # the description follows the topic
    desc = N.descriptions()
    text = desc.get(frm, ("",))[0]
    for f in glob.glob(f"{N.DESC}/*.txt"):
        raw = open(f, encoding="utf-8", newline="").read()
        keep = [l for l in raw.splitlines(keepends=True) if not l.startswith(frm + " ||| ")]
        if len(keep) != len(raw.splitlines(keepends=True)):
            open(f, "w", encoding="utf-8", newline="").write("".join(keep))
    if text and to not in desc:
        ver = max((r["version"] for r in N.read_jsonl(N.ALL)), key=N.vkey)
        path = f"{N.DESC}/patch-{ver}.txt"
        with open(path, "a", encoding="utf-8", newline="\n") as fh:
            fh.write(f"{to} ||| {text}\n")
    rev = N.load_reviewed()
    if frm in rev:
        rev.pop(frm)
        with open(N.REVIEWED, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(rev, fh, indent=0, ensure_ascii=False, sort_keys=True)
    return {"ok": True, "out": f"Moved {len(rows)} row(s) from {frm!r} to {to!r}." + (" The two topics are now one." if existed else ""), "rows": len(rows)}


def set_hub(topic, hub_name):
    if topic not in hubs():
        return {"ok": False, "out": "Unknown topic."}
    rewrite_csv_line(N.HUBS, 0, topic, lambda row: [row[0], hub_name] + row[2:])
    return {"ok": True, "out": f"{topic!r} is now in {hub_name!r}."}


# ------------------------------------------------------------------ tags
def write_tags(tags):
    """Rewrite only the tags list in taxonomy.json, sorted, leaving the rest of the file byte for byte as it was."""
    raw = open(N.TAX, encoding="utf-8", newline="").read()
    m = re.search(r'("tags":\s*\[\r?\n)(.*?)(\r?\n\s*\])', raw, re.S)
    if not m:
        return False
    nl = chr(13) + chr(10) if chr(13) in raw else chr(10)
    pad = re.match(r"[ \t]*", m.group(2)).group(0)
    new = raw[:m.start(2)] + ("," + nl).join(pad + json.dumps(t) for t in sorted(set(tags))) + raw[m.end(2):]
    json.loads(new.lstrip(chr(0xFEFF)))
    with open(N.TAX, "w", encoding="utf-8", newline="") as f:
        f.write(new)
    return True


def tag_stats():
    tax = json.load(open(N.TAX, encoding="utf-8-sig"))
    cnt = N.Counter(t for r in N.read_jsonl(N.ALL) for t in r["tags"])
    names = sorted(set(tax["tags"]) | set(cnt))
    return {"tags": [{"tag": t, "n": cnt.get(t, 0), "listed": t in tax["tags"]} for t in names]}


def rename_tag(frm, to):
    to = to.strip().lower().replace(" ", "-")
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", to) or not 2 <= len(to) <= 30:
        return {"ok": False, "out": "A tag is 2 to 30 letters, digits or hyphens."}
    rows = [r for r in N.read_jsonl(N.ALL) if frm in r["tags"]]
    ch = {}
    for r in rows:
        tags = []
        for t in r["tags"]:
            t = to if t == frm else t
            if t not in tags:
                tags.append(t)
        ch[r["id"]] = {"tags": tags}
    res = apply_edits(ch, None, None) if ch else {"ok": True, "changed": 0}
    if not res["ok"]:
        return res
    tax = json.load(open(N.TAX, encoding="utf-8-sig"))
    write_tags([t for t in tax["tags"] if t != frm] + [to])
    return {"ok": True, "out": f"{frm!r} became {to!r} on {len(rows)} row(s)." if frm != to else "Same name.", "rows": len(rows)}


def remove_tag(tag):
    rows = [r for r in N.read_jsonl(N.ALL) if tag in r["tags"]]
    res = apply_edits({r["id"]: {"tags": [t for t in r["tags"] if t != tag]} for r in rows}, None, None) if rows else {"ok": True}
    if not res["ok"]:
        return res
    tax = json.load(open(N.TAX, encoding="utf-8-sig"))
    write_tags([t for t in tax["tags"] if t != tag])
    return {"ok": True, "out": f"Removed {tag!r} from the list and from {len(rows)} row(s).", "rows": len(rows)}


# ------------------------------------------------------------------ duplicates
def duplicates():
    rows = N.read_jsonl(N.ALL)
    src = sources()
    groups = {}
    for r in rows:
        k = N.norm_src(src.get(r["id"], r["summary"].split(": ", 1)[-1]))
        if len(k) >= 12:
            groups.setdefault(k, []).append(r)
    out = []
    for k, rs in groups.items():
        if len(rs) > 1:
            out.append({"text": src.get(rs[0]["id"], rs[0]["summary"])[:200], "same_version": len({r["version"] for r in rs}) < len(rs),
                        "rows": [{"id": r["id"], "version": r["version"], "entity": r["entity"], "type": r["change_type"]} for r in rs]})
    out.sort(key=lambda g: (-len(g["rows"]), g["text"]))
    return {"groups": out[:200], "total": len(out)}


# ------------------------------------------------------------------ git
def git(*args):
    p = subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8", errors="replace")
    return {"ok": p.returncode == 0, "out": (p.stdout + p.stderr).strip()}


def git_state():
    st = git("status", "--short", "--", "data", "web")
    net = net_changes()
    types = N.Counter()
    for n in net:
        if n["kind"] == "split":
            types["split"] += 1
        elif n["before"]:
            for k, lab in (("entity", "topic"), ("change_type", "type"), ("tags", "tags"), ("platforms", "platforms"), ("dev_note", "developer note")):
                if n["before"][k] != n["after"][k]:
                    types[lab] += 1
    done = G.row_review()
    parts = ", ".join(f"{v} {k}" for k, v in types.most_common())
    msg = "Review stored patch notes" + (f": {len(net)} row(s) edited ({parts})" if net else "") + (f", {len(done)} row(s) confirmed" if done else "")
    return {"status": st["out"], "message": msg, "edited": len(net)}


def commit(message):
    message = (message or "").strip()
    if not message:
        return {"ok": False, "out": "Write a commit message."}
    a = git("add", "-A", "data", "web")
    if not a["ok"]:
        return a
    c = git("-c", "user.name=tau", "-c", "user.email=tau-samsara@users.noreply.github.com", "commit", "-m", message)
    return {"ok": c["ok"], "out": c["out"] + "\nNot pushed: run git push yourself."}


# ------------------------------------------------------------------ routing for notes_gui
def route_get(path):
    if path == "/api/manage/topics":
        return {"topics": topics_all(), "hubs": sorted(set(hubs().values()) | {"Uncategorised"})}
    if path == "/api/manage/tags":
        return tag_stats()
    if path == "/api/manage/journal":
        net = net_changes()
        return {"changes": net, "n": len(net)}
    if path == "/api/manage/dups":
        return duplicates()
    if path == "/api/manage/git":
        return git_state()
    return None


def route_post(path, b):
    if path == "/api/stored/search":
        return search(b.get("q") or {}, int(b.get("limit") or 300))
    if path == "/api/stored/byids":
        return by_ids(b["ids"])
    if path == "/api/stored/bulk":
        return bulk(b)
    if path == "/api/stored/split":
        return split_row(b["id"])
    if path == "/api/manage/topic/rename":
        return rename_topic(b["from"], b["to"])
    if path == "/api/manage/topic/hub":
        return set_hub(b["topic"], b["hub"])
    if path == "/api/manage/tag/rename":
        return rename_tag(b["from"], b["to"])
    if path == "/api/manage/tag/remove":
        return remove_tag(b["tag"])
    if path == "/api/manage/revert":
        return revert(b["ids"])
    if path == "/api/manage/commit":
        return commit(b.get("message"))
    return None
