#!/usr/bin/env python3
"""Local review tool for adding release notes. Standard library only; run from the project root:

  python tools/notes_gui.py          starts http://127.0.0.1:8765 and opens it in your browser

It wraps tools/notes.py (fetch, prepare, approve, ingest, build, validate, selftest). Nothing is written to
data/normalized until every row has been confirmed by a person. The guesses it fills in are rule-based
(Guesser in notes.py), not a language model; anything a language model would normally write (topic descriptions)
is typed by a person, with an optional prompt to copy into an LLM.
"""
import csv, difflib, glob, io, json, os, re, subprocess, sys, threading, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import notes as N

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
PORT = int(os.environ.get("NOTES_GUI_PORT", "8765"))
DRAFT, SKIPPED, REVIEW = f"{N.INBOX}/rows.draft.jsonl", f"{N.INBOX}/skipped.txt", f"{N.INBOX}/review.json"
RUNNABLE = {"fetch", "prepare", "build", "validate", "selftest", "status", "backup"}
LOCK = threading.Lock()


def run(*args):
    p = subprocess.run([sys.executable, "tools/notes.py", *args], capture_output=True, text=True, encoding="utf-8", errors="replace")
    return {"ok": p.returncode == 0, "out": (p.stdout + p.stderr).strip()}


def lower_first(text, entity):
    first = text.split(" ", 1)[0]
    keep = (first.isupper() and len(first) > 1) or re.search(r"\d", first) or first in entity.split()
    return text if keep else text[:1].lower() + text[1:]


def read_skipped():
    out = []
    for line in (open(SKIPPED, encoding="utf-8").read().splitlines() if os.path.exists(SKIPPED) else []):
        m = re.match(r"^(\S+) \[(.*?)\] (.*)$", line)
        if m:
            out.append({"version": m.group(1), "section": None if m.group(2) == "None" else m.group(2), "text": m.group(3)})
    return out


def state():
    rows = N.read_jsonl(N.ALL)
    alias = N.merge_alias()
    hub = {h["topic"]: h["primary_hub"] for h in N.csv.DictReader(open(N.HUBS, encoding="utf-8"))}
    by, cnt = N.defaultdict(set), N.Counter()
    for r in rows:
        t = N.topic_of(r["entity"], alias)
        by[t].add(r["system"])
        cnt[t] += 1
    pend = sorted(N.pending_releases(), key=lambda r: N.vkey(r["version"])) if os.path.exists(N.NOTES) else []
    behind = N.notes_behind() if os.path.exists(N.NOTES) else None
    draft = N.read_jsonl(DRAFT)
    review = json.load(open(REVIEW, encoding="utf-8")) if os.path.exists(REVIEW) else {}
    stale, _, _ = N.stale_topics()
    return {
        "tax": json.load(open(N.TAX, encoding="utf-8-sig")),
        "topics": [{"name": t, "hub": hub.get(t, "-"), "systems": sorted(by[t]), "n": cnt[t]} for t in sorted(by)],
        "pending": [{"version": r["version"], "date": r["date"], "prs": len(r["prs"]), "body": r["has_body_notes"]} for r in pend],
        "behind": behind, "rows_total": len(rows), "last_version": max((r["version"] for r in rows), key=N.vkey, default=""),
        "have_notes": os.path.exists(N.NOTES),
        "draft": draft, "skipped": read_skipped(), "confirmed": review.get("confirmed", {}), "stale": stale,
        "hubs": review.get("hubs", {}), "check": check(draft) if draft else None,
    }


_G = {}


def guesser():
    """The Guesser is slow to build, so it is rebuilt only when the stored rows change."""
    m = os.path.getmtime(N.ALL)
    if _G.get("m") != m:
        _G.update(m=m, g=N.Guesser(N.read_jsonl(N.ALL)))
    return _G["g"]


def summary_for(r):
    return f"{r['entity']}: {lower_first(r['source'], r['entity'])}"


def check(rows):
    """Per-row help for the review page: topic suggestions, errors ingest would raise, name warnings for new topics,
    and a guessed hub for each new topic."""
    alias = N.merge_alias()
    allrows = N.read_jsonl(N.ALL)
    known = {r["entity"] for r in allrows}
    hub = {h["topic"]: h["primary_hub"] for h in N.csv.DictReader(open(N.HUBS, encoding="utf-8"))}
    by_plain = {N._plain(t): t for t in hub}
    g = guesser()
    out = {"rows": {}, "names": {}, "hubs": {}, "hub_options": sorted(set(hub.values()) | {"Uncategorised"})}
    pats = dict(g.pats)
    for r in rows:
        ent, cand, word = r.get("entity", ""), {}, {}
        src = r.get("source", "")
        for n, sc in g.scores(src).items():
            t = N.topic_of(n, alias)
            if sc > cand.get(t, -1):
                cand[t], word[t] = sc, pats[n].search(src).group(0)
        sug = [t for t, _ in sorted(cand.items(), key=lambda kv: -kv[1]) if t != ent][:4]
        why = {t: {"why": "named in the text", "word": word[t]} for t in sug}
        if ent and N.topic_of(ent, alias) not in hub:
            for m in difflib.get_close_matches(N._plain(ent), list(by_plain), n=3, cutoff=0.7):
                if by_plain[m] != ent and by_plain[m] not in sug:
                    sug.insert(0, by_plain[m])
                    why[by_plain[m]] = {"why": f"close spelling of {ent}", "word": ""}
        te = N.topic_of(ent, alias) if ent else ent
        cur = {"why": "named in the text", "word": word[te]} if te in word else {"why": "from the section heading or the bullets around it, not named in the text", "word": ""}
        out["rows"][r["id"]] = {"sug": [{"t": t, "hub": hub.get(t, "-"), **why[t]} for t in sug[:5]], "cur": cur, "errs": []}
    for name in sorted({r["entity"] for r in rows if r.get("entity") and r["entity"] != "TODO" and N.topic_of(r["entity"], alias) not in hub}):
        mine = [r for r in rows if r["entity"] == name]
        out["names"][name] = [w for w in N.topic_name_warnings(mine, known) if not w.startswith("A topic should be")]
        out["hubs"][name] = N.guess_hub(mine, allrows, hub)
    try:
        tax = json.load(open(N.TAX, encoding="utf-8-sig"))
        tmp = []
        for r in rows:
            c = {k: v for k, v in r.items() if k not in ("_confirmed", "_open", "_review")}
            if c.get("entity") and c["entity"] != "TODO":
                c["summary"] = summary_for(c)
            tmp.append(c)
        errs, _ = N.validate(tmp, N.pending_releases(), tax, known)
    except Exception as e:
        errs = [f"row 0 (?): could not check ({type(e).__name__}: {e})"]
    for e in errs:
        m = re.match(r"row (\d+) \((.*?)\): (.*)", e)
        r = rows[int(m.group(1)) - 1] if m and 0 < int(m.group(1)) <= len(rows) else None
        if r is None:
            out.setdefault("global", []).append(e)
        elif r.get("entity") and r["entity"] != "TODO":
            out["rows"][r["id"]]["errs"].append(m.group(3))
    for r in rows:
        if not r.get("entity") or r["entity"] == "TODO":
            out["rows"][r["id"]]["errs"].insert(0, "set a topic")
    return out


def apply_hubs(picks):
    """Rewrite the hub of the topics ingest just added, for the ones whose hub was chosen in the page."""
    alias = N.merge_alias()
    want = {N.topic_of(e, alias): h for e, h in picks.items() if h}
    lines = open(N.HUBS, encoding="utf-8", newline="").read().splitlines(keepends=True)
    for k, line in enumerate(lines[1:], 1):
        row = next(csv.reader([line]), None)
        if row and row[0] in want and row[1] != want[row[0]]:
            row[1] = want[row[0]]
            b = io.StringIO()
            csv.writer(b, lineterminator="\n").writerow(row)
            lines[k] = b.getvalue()
    with open(N.HUBS, "w", encoding="utf-8", newline="") as f:
        f.write("".join(lines))


def save_draft(body):
    """Write the edited draft. Ids are renumbered per version in the order given; confirmations follow the rows."""
    rows, conf, ids = [], {}, {}
    for r in body["rows"]:
        n = ids[r["version"]] = ids.get(r["version"], 0) + 1
        new = f"{r['version']}-{n:03d}"
        if r.get("_confirmed"):
            conf[new] = True
        rows.append({k: v for k, v in r.items() if k not in ("_confirmed", "_open")} | {"id": new})
    os.makedirs(N.INBOX, exist_ok=True)
    N.write_jsonl(DRAFT, rows)
    with open(SKIPPED, "w", encoding="utf-8", newline="\n") as f:
        f.write("".join(f"{s['version']} [{s['section']}] {s['text']}\n" for s in body.get("skipped", [])))
    json.dump({"confirmed": conf, "hubs": body.get("hubs", {})}, open(REVIEW, "w", encoding="utf-8"))
    return rows


def new_row(version, text, section):
    """A draft row for a bullet that was left out (or typed in), guessed like prepare does."""
    rel = next((r for r in N.pending_releases() if r["version"] == version), None)
    g = N.Guesser(N.read_jsonl(N.ALL))
    d, _ = N.draft_for({"version": version, "date": rel["date"] if rel else "", "prs": [], "body": f"## {section or 'Changes'}\n- {text}\n"}, g)
    return d[0] if d else None


def ingest(body):
    if not body["rows"]:
        return {"ok": False, "out": "There are no rows to ingest."}
    unconf = sum(1 for r in body["rows"] if not r.get("_confirmed"))
    todo = sum(1 for r in body["rows"] if r["entity"] in ("", "TODO"))
    if unconf or todo:
        save_draft(body)
        return {"ok": False, "out": f"{unconf} row(s) are not confirmed and {todo} have no topic. Nothing was ingested."}
    rows = save_draft(body)
    chk = check(rows)
    bad = sum(1 for v in chk["rows"].values() if v["errs"])
    picks = {t: h for t, h in body.get("hubs", {}).items() if t in chk["hubs"]}
    if bad:
        return {"ok": False, "out": f"{bad} row(s) have errors. Nothing was ingested."}
    for r in rows:
        r["summary"] = summary_for(r)
    N.write_jsonl(DRAFT, rows)
    a = run("approve")
    if not a["ok"]:
        return a
    b = run("ingest")
    b["out"] = a["out"] + "\n" + b["out"]
    if b["ok"]:
        if picks:
            apply_hubs(picks)
        for f in (DRAFT, SKIPPED, REVIEW):
            if os.path.exists(f):
                os.remove(f)
    return b


def raw_for(version, source):
    """The release note as written: the section holding the bullet, untouched, with the bullet's own lines marked."""
    rel = next((r for r in N.parse_notes() if r["version"] == version), None)
    if not rel:
        return {"found": False}
    want = " ".join(source.split())
    secs, cur, head = [], None, None
    for line in rel["body"].split("## What's Changed")[0].split("\n"):
        if re.match(r"^#{2,3} ", line):
            head, cur = line, {"head": line, "lines": []}
            secs.append(cur)
        elif cur is not None:
            cur["lines"].append(line)
    for sec in secs:
        ls, k = sec["lines"], 0
        while k < len(ls):
            if re.match(r"^\s*[-*] ", ls[k]):
                e = k + 1
                while e < len(ls) and ls[e].startswith("  ") and ls[e].strip():
                    e += 1
                if " ".join(N.clean(" ".join(re.sub(r"^\s*[-*] ", "", ls[k]).split() + [x.strip() for x in ls[k + 1:e]])).split()) == want:
                    return {"found": True, "head": sec["head"], "lines": [{"t": x, "hit": k <= j < e} for j, x in enumerate(ls)]}
                k = e
            else:
                k += 1
    return {"found": False}


def add_system(name):
    """Add a game system to the taxonomy, editing the text in place so the file keeps its layout."""
    name = " ".join(name.split())
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9 &'-]{0,23}", name):
        return {"ok": False, "out": "Use 1 to 24 letters, digits, spaces, & or -, starting with a letter."}
    text = open(N.TAX, encoding="utf-8-sig", newline="").read()
    have = json.loads(text)["systems"]
    dup = next((x for x in have if x.lower() == name.lower()), None)
    if dup:
        return {"ok": True, "name": dup, "systems": have}
    m = re.search(r'("systems"\s*:\s*\[)(.*?)(\s*\])', text, re.S)
    nl = "\r\n" if "\r\n" in text else "\n"
    ent = list(re.finditer(r'[ \t]*"[^"]*"', m.group(2)))
    pad = re.match(r"[ \t]*", ent[-1].group(0)).group(0)
    at = next((e.start() for e in ent if e.group(0).strip() == '"Other"'), None)
    if at is not None:
        body = m.group(2)[:at] + pad + json.dumps(name) + "," + nl + m.group(2)[at:]
    else:
        body = m.group(2) + "," + nl + pad + json.dumps(name)
    out = text[:m.start(2)] + body + text[m.end(2):]
    systems = json.loads(out)["systems"]
    with open(N.TAX, "w", encoding="utf-8-sig", newline="") as f:
        f.write(out)
    return {"ok": True, "name": name, "systems": systems}


def change_lines(topic):
    return describe_changes({topic})[topic]


def describe_changes(topics):
    alias = N.merge_alias()
    src = {d["id"]: d["source"] for d in N.read_jsonl(N.SOURCES)}
    by = {t: [] for t in topics}
    for r in N.read_jsonl(N.ALL):
        t = N.topic_of(r["entity"], alias)
        if t in by:
            by[t].append(r)
    return {t: [{"version": r["version"], "type": r["change_type"], "direction": r["direction"], "text": src.get(r["id"], r["summary"])}
                for r in sorted(rs, key=lambda r: (N.vkey(r["version"]), r["id"]))] for t, rs in by.items()}


def describe(only=None):
    """Topics whose description a person has not reviewed since their last change (all of them until reviewed)."""
    desc = N.descriptions()
    hub = {h["topic"]: h["primary_hub"] for h in N.csv.DictReader(open(N.HUBS, encoding="utf-8"))}
    stale, cnt, _ = N.stale_topics()
    reviewed = N.load_reviewed()
    stale = [t for t in stale if only is None or t in only]
    ch = describe_changes(stale)
    return [{"topic": t, "hub": hub.get(t, "-"), "n": cnt[t], "new": t not in desc, "was": reviewed.get(t),
             "current": desc[t][0] if t in desc else "", "changes": ch[t]} for t in stale]


DESC_RULES = ("Rules: 1 to 4 plain sentences saying what the topic is and how it works as of its latest change. Later changes override earlier ones, "
              "so describe the current behaviour and mention what changed only when it explains the current state. Never invent anything the changes do not say. "
              "Keep numbers, names and units exactly.")


def topic_lines(d):
    lines = []
    if d["current"]:
        lines += ["Current description (update it rather than starting over):", d["current"], ""]
    lines.append("Changes, oldest first:")
    for c in d["changes"]:
        lines.append(f"- {c['version']} {c['type']}{'' if c['direction'] == 'n/a' else c['direction']}: {c['text']}")
    return lines


def prompt_for(topic):
    d = next(iter(describe({topic})), None) or {"topic": topic, "current": "", "changes": change_lines(topic)}
    return "\n".join([f"Write the description for the topic \"{d['topic']}\" of a Daggerfall Online patch notes wiki.", DESC_RULES + " Reply with the description only.", ""] + topic_lines(d))


def prompt_all(topics):
    """One prompt for several topics; the reply is one `Topic ||| description` line per topic, which the page can split back out."""
    ds = describe(set(topics))
    lines = ["Write a description for each topic below, for a Daggerfall Online patch notes wiki.", DESC_RULES,
             "Reply with exactly one line per topic in the form `Topic ||| description`, using the topic name exactly as given, and nothing else.", ""]
    for d in ds:
        lines += [f"## {d['topic']}"] + topic_lines(d) + [""]
    return "\n".join(lines)


def last_ingest():
    """Counts for the rows added by the newest ingest (from its archived rows file), for the report after Build."""
    arch = sorted(glob.glob(f"{N.INBOX}/done/rows-*.jsonl"), key=lambda f: N.vkey(os.path.basename(f)[:-6].split("-")[-1]))
    rows = N.read_jsonl(N.ALL)
    if arch:
        ids = {r["id"] for r in N.read_jsonl(arch[-1])}
        mine = [r for r in rows if r["id"] in ids]
    else:
        v = max((r["version"] for r in rows), key=N.vkey, default="")
        mine = [r for r in rows if r["version"] == v]
    alias = N.merge_alias()
    hub = {h["topic"]: h["primary_hub"] for h in N.csv.DictReader(open(N.HUBS, encoding="utf-8"))}
    versions = sorted({r["version"] for r in mine}, key=N.vkey)
    first = {}
    for r in rows:
        first.setdefault(N.topic_of(r["entity"], alias), r["version"])
    new = sorted({N.topic_of(r["entity"], alias) for r in mine if first.get(N.topic_of(r["entity"], alias)) in versions})
    return {"versions": versions, "n": len(mine), "types": dict(N.Counter(r["change_type"] for r in mine)),
            "new_topics": [{"topic": t, "hub": hub.get(t, "-")} for t in new]}


def serve_site(path):
    """Static files of web/ under /site/, so the result can be looked at without a second server."""
    import mimetypes
    rel = path[len("/site/"):].split("?")[0].split("#")[0] or "index.html"
    full = os.path.realpath(os.path.join(ROOT, "web", rel))
    base = os.path.realpath(os.path.join(ROOT, "web"))
    if os.path.isdir(full):
        full = os.path.join(full, "index.html")
    if not full.startswith(base + os.sep) or not os.path.isfile(full):
        return None
    return open(full, "rb").read(), mimetypes.guess_type(full)[0] or "application/octet-stream"


def save_description(topic, text):
    text = " ".join(text.split())
    if not text or " ||| " in text:
        return {"ok": False, "out": "Empty description."}
    if N.descriptions().get(topic, ("",))[0] == text:  # kept as it is: only record the review
        N.mark_reviewed(topic, N.stale_topics()[1][topic])
        return {"ok": True, "out": "kept as it is"}
    ver = max((r["version"] for r in N.read_jsonl(N.ALL)), key=N.vkey)
    path = f"{N.DESC}/patch-{ver}.txt"
    lines = [l for l in (open(path, encoding="utf-8").read().splitlines() if os.path.exists(path) else []) if not l.startswith(topic + " ||| ")]
    lines.append(f"{topic} ||| {text}")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    N.mark_reviewed(topic, N.stale_topics()[1][topic])
    return {"ok": True, "out": f"saved to {path}"}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, obj, code=200, ctype="application/json"):
        data = obj if isinstance(obj, bytes) else json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def local(self):
        return self.headers.get("Host", "").split(":")[0] in ("127.0.0.1", "localhost")

    def do_GET(self):
        if not self.local():
            return self.send({"error": "local only"}, 403)
        if self.path in ("/", "/index.html"):
            return self.send(open("tools/notes_gui.html", "rb").read(), ctype="text/html")
        if self.path == "/api/state":
            with LOCK:
                return self.send(state())
        if self.path == "/api/describe":
            with LOCK:
                return self.send(describe())
        if self.path == "/api/summary":
            with LOCK:
                return self.send(last_ingest())
        if self.path == "/site":
            self.send_response(301)
            self.send_header("Location", "/site/")
            self.end_headers()
            return
        if self.path.startswith("/site/"):
            f = serve_site(self.path)
            return self.send(f[0], ctype=f[1]) if f else self.send({"error": "not found"}, 404)
        self.send({"error": "not found"}, 404)

    def do_POST(self):
        if not self.local():
            return self.send({"error": "local only"}, 403)
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0)) or 0) or b"{}")
        with LOCK:
            try:
                if self.path == "/api/run" and body.get("cmd") in RUNNABLE:
                    return self.send(run(body["cmd"]))
                if self.path == "/api/save":
                    return self.send({"ok": True, "check": check(save_draft(body))})
                if self.path == "/api/restore":
                    r = new_row(body["version"], body["text"], body.get("section"))
                    return self.send({"ok": bool(r), "row": r})
                if self.path == "/api/ingest":
                    return self.send(ingest(body))
                if self.path == "/api/topic":
                    t = body["topic"]
                    hub = {h["topic"]: h["primary_hub"] for h in N.csv.DictReader(open(N.HUBS, encoding="utf-8"))}
                    ch = change_lines(t)
                    return self.send({"topic": t, "hub": hub.get(t), "n": len(ch), "desc": (N.descriptions().get(t) or [""])[0], "recent": ch[-3:][::-1]})
                if self.path == "/api/system":
                    return self.send(add_system(body.get("name", "")))
                if self.path == "/api/raw":
                    return self.send(raw_for(body["version"], body["text"]))
                if self.path == "/api/prompt":
                    return self.send({"prompt": prompt_for(body["topic"])})
                if self.path == "/api/prompt_all":
                    return self.send({"prompt": prompt_all(set(body["topics"]))})
                if self.path == "/api/describe/save":
                    return self.send(save_description(body["topic"], body["text"]))
            except Exception as e:  # shown in the page
                return self.send({"ok": False, "out": f"{type(e).__name__}: {e}"})
        self.send({"error": "not found"}, 404)


def main():
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    url = f"http://127.0.0.1:{PORT}/"
    print(f"Release notes tool at {url}  (Ctrl+C to stop)")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
