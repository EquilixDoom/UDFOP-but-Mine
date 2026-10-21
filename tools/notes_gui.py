#!/usr/bin/env python3
"""Local review tool for adding release notes. Standard library only; run from the project root:

  python tools/notes_gui.py          starts http://127.0.0.1:8765 and opens it in your browser

It wraps tools/notes.py (fetch, prepare, approve, ingest, build, validate, selftest). Nothing is written to
data/normalized until every row has been confirmed by a person. The guesses it fills in are rule-based
(Guesser in notes.py), not a language model; anything a language model would normally write (topic descriptions)
is typed by a person, with an optional prompt to copy into an LLM.
"""
import json, os, re, subprocess, sys, threading, webbrowser
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
        "warnings": N.topic_name_warnings(draft, {r["entity"] for r in rows}) if draft else [],
    }


def save_draft(body):
    """Write the edited draft. Ids are renumbered per version in the order given; confirmations follow the rows."""
    rows, conf, ids = [], {}, {}
    for r in body["rows"]:
        n = ids[r["version"]] = ids.get(r["version"], 0) + 1
        new = f"{r['version']}-{n:03d}"
        if r.get("_confirmed"):
            conf[new] = True
        rows.append({k: v for k, v in r.items() if k != "_confirmed"} | {"id": new})
    os.makedirs(N.INBOX, exist_ok=True)
    N.write_jsonl(DRAFT, rows)
    with open(SKIPPED, "w", encoding="utf-8", newline="\n") as f:
        f.write("".join(f"{s['version']} [{s['section']}] {s['text']}\n" for s in body.get("skipped", [])))
    json.dump({"confirmed": conf}, open(REVIEW, "w", encoding="utf-8"))
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
    for r in rows:
        r["summary"] = f"{r['entity']}: {lower_first(r['source'], r['entity'])}"
    N.write_jsonl(DRAFT, rows)
    a = run("approve")
    if not a["ok"]:
        return a
    b = run("ingest")
    b["out"] = a["out"] + "\n" + b["out"]
    if b["ok"]:
        for f in (DRAFT, SKIPPED, REVIEW):
            if os.path.exists(f):
                os.remove(f)
    return b


def change_lines(topic):
    alias = N.merge_alias()
    src = {d["id"]: d["source"] for d in N.read_jsonl(N.SOURCES)}
    rs = sorted((r for r in N.read_jsonl(N.ALL) if N.topic_of(r["entity"], alias) == topic), key=lambda r: (N.vkey(r["version"]), r["id"]))
    return [{"version": r["version"], "type": r["change_type"], "direction": r["direction"], "text": src.get(r["id"], r["summary"])} for r in rs]


def describe():
    alias = N.merge_alias()
    desc = N.descriptions()
    hub = {h["topic"]: h["primary_hub"] for h in N.csv.DictReader(open(N.HUBS, encoding="utf-8"))}
    stale, cnt, state_ = N.stale_topics()
    return [{"topic": t, "hub": hub.get(t, "-"), "n": cnt[t], "new": t not in desc, "was": state_.get(t),
             "current": desc[t][0] if t in desc else "", "changes": change_lines(t)} for t in stale]


def prompt_for(topic):
    d = next((x for x in describe() if x["topic"] == topic), None) or {"topic": topic, "current": "", "changes": change_lines(topic)}
    lines = [f"Write the description for the topic \"{d['topic']}\" of a Daggerfall Online patch notes wiki.",
             "Rules: 1 to 4 plain sentences saying what the topic is and how it works as of its latest change. Later changes override earlier ones, so describe the current behaviour and mention what changed only when it explains the current state. Never invent anything the changes do not say. Keep numbers, names and units exactly. Reply with the description only.", ""]
    if d["current"]:
        lines += ["Current description (update it rather than starting over):", d["current"], ""]
    lines.append("Changes, oldest first:")
    for c in d["changes"]:
        lines.append(f"- {c['version']} {c['type']}{'' if c['direction'] == 'n/a' else c['direction']}: {c['text']}")
    return "\n".join(lines)


def save_description(topic, text):
    text = " ".join(text.split())
    if not text or " ||| " in text:
        return {"ok": False, "out": "Empty description."}
    ver = max((r["version"] for r in N.read_jsonl(N.ALL)), key=N.vkey)
    path = f"{N.DESC}/patch-{ver}.txt"
    lines = [l for l in (open(path, encoding="utf-8").read().splitlines() if os.path.exists(path) else []) if not l.startswith(topic + " ||| ")]
    lines.append(f"{topic} ||| {text}")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
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
                    save_draft(body)
                    return self.send({"ok": True})
                if self.path == "/api/restore":
                    r = new_row(body["version"], body["text"], body.get("section"))
                    return self.send({"ok": bool(r), "row": r})
                if self.path == "/api/ingest":
                    return self.send(ingest(body))
                if self.path == "/api/prompt":
                    return self.send({"prompt": prompt_for(body["topic"])})
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
