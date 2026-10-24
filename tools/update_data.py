"""Optional: rebuild the site's data from data/normalized/*.jsonl (+ merges.csv, hub_assignment.csv, descriptions).
The site itself is plain HTML/CSS/JS in web/; this only refreshes its data files. Run from the project root.

  web/data.js            the core file every page loads: hubs, every release, descriptions, a count and last patch for each topic
  web/shards/<key>.js    the change rows, one file per period (a month, or part of a month when it would be too big);
                         a page loads only the shards it needs
"""
import json, csv, glob, gzip, hashlib, os, re, sys
from collections import Counter

CHECK = '--check' in sys.argv   # write nothing; exit 1 if the committed web/ files differ from what a build would produce
stale = []


def write(fn, text):
    if CHECK:
        try: same = open(fn, encoding='utf-8', newline='').read() == text
        except OSError: same = False
        if not same: stale.append(fn)
    else:
        open(fn, 'w', encoding='utf-8', newline='\n').write(text)


SHARD_LIMIT_GZ = 500 * 1024   # Provisional: each shard stays under 500 KB gzipped; a bigger month is split in two, again and again

rows = [json.loads(l) for l in open('data/normalized/all.jsonl', encoding='utf-8')]
alias = {m['from']: m['to'] for m in csv.DictReader(open('data/merges.csv', encoding='utf-8'))
         if m['recommend'] == 'merge' and m['from'] != m['to']}
hub = {h['topic']: h['primary_hub'] for h in csv.DictReader(open('data/hub_assignment.csv', encoding='utf-8'))}
# x is the developer's own bullet (sources.jsonl), unchanged apart from Markdown emphasis marks; the wiki's wording is only a fallback
src = {d['id']: d['source'] for d in map(json.loads, open('data/normalized/sources.jsonl', encoding='utf-8'))}
# b is a table the developers put under a bullet (data/normalized/tables.json: row id -> a list of rows, the first row the header)
tables = json.load(open('data/normalized/tables.json', encoding='utf-8')) if os.path.exists('data/normalized/tables.json') else {}


def split_table(o):
    """A developer bullet that holds a Markdown table (the bullets are one line each, so its rows run together as '| a | b | |---|---| | 1 | 2 |')
    -> (the text before the table, the table as a list of rows with the header first, the text after it), or None when it holds no well-formed table."""
    i = o.find('|')
    if i < 0 or not re.search(r'\|\s*:?-{3,}:?\s*\|', o[i:]): return None
    parts = re.split(r'\|\s+\|', o[i:].strip().strip('|'))
    cells = [[c.strip() for c in p.split('|')] for p in parts]
    if len(cells) < 3 or not all(re.fullmatch(r':?-{3,}:?', c) for c in cells[1]): return None
    w, post = len(cells[0]), ''
    if len(cells[-1]) == w + 1: post = cells[-1].pop()   # the table is followed by more text: it comes after the last row's final pipe
    t = [cells[0]] + cells[2:]
    return (o[:i].strip(), t, post) if all(len(x) == w for x in t) else None


out = []
seen_table = set()   # rows split from one bullet each carry the whole bullet; its table is shown once, on the first of them
for r in rows:
    e = alias.get(r['entity'], r['entity']); s = r['summary']
    for p in (r['entity'] + ': ', e + ': '):
        if s.startswith(p): s = s[len(p):]; break
    o = src.get(r['id'])
    n = r['dev_note']
    tb, after = tables.get(r['id']), ''
    if o:
        o = o.replace('**', '').replace('`', '')
        if n and n.lower()[:25] in o.lower(): n = ''   # the bullet already says it
        sp = split_table(o)
        if sp:
            first = o not in seen_table; seen_table.add(o)
            if first: tb, after = tb or sp[1], sp[2]
            if first and sp[0]: s = sp[0]   # the text before the table; a bullet that is only a table, and the rows after the first, keep the wiki's own wording
        else:
            s = o
    out.append(dict(id=r['id'], v=r['version'], d=r['date'], e=e, t=r['change_type'],
                    x=s, g=r['tags'], n=n, **({'b': tb} if tb else {}), **({'a': after} if tb and after else {})))
nrows = Counter(r['version'] for r in rows)
# per release: u = Update name, t = title, k = kind (release, likely-hotfix, bulk-import), c = recorded changes, tier only when set
rels = {}
for x in (json.loads(l) for l in open('data/normalized/releases.jsonl', encoding='utf-8')):
    rels[x['version']] = {'date': x['date'], 'prs': [{'n': p['number'], 't': p['title'], 'u': p['url']} for p in x['prs']],
                          'u': x.get('update'), 't': x.get('title'), 'k': x.get('kind', 'release'), 'c': nrows.get(x['version'], 0)}
    if x.get('tier'): rels[x['version']]['tier'] = x['tier']
desc = {}
for f in sorted(glob.glob('data/descriptions/*.txt')):
    for line in open(f, encoding='utf-8'):
        if ' ||| ' in line:
            k, v = line.rstrip('\n').split(' ||| ', 1)
            desc[k] = v


def vkey(v): return [int(p) for p in v.split('.')]


def js(o): return json.dumps(o, ensure_ascii=False, separators=(',', ':'))


def gz(o): return len(gzip.compress(js(o).encode('utf-8')))


# topic stats for the core file: [changes, last patch, first patch]
tstat = {}
for r in out:
    c, last, first = tstat.get(r['e'], [0, '', ''])
    tstat[r['e']] = [c + 1, r['v'] if not last or vkey(r['v']) > vkey(last) else last,
                     r['v'] if not first or vkey(r['v']) < vkey(first) else first]

# shards: one per month of the release date; a month over the limit is split in two by patch, and so on
by_month = {}
for r in out:
    by_month.setdefault(rels[r['v']]['date'][:7], []).append(r)


def split(key, rs):
    if gz(rs) <= SHARD_LIMIT_GZ or len({r['v'] for r in rs}) < 2:
        return [(key, rs)]
    vs = sorted({r['v'] for r in rs}, key=vkey)
    half = set(vs[:len(vs) // 2])
    a, b = [r for r in rs if r['v'] in half], [r for r in rs if r['v'] not in half]
    return split(key + 'a', a) + split(key + 'b', b)


shards, shard_of = {}, {}
if not CHECK: os.makedirs('web/shards', exist_ok=True)
keep = set()
for month in sorted(by_month):
    for key, rs in split(month, by_month[month]):
        rs.sort(key=lambda r: (vkey(r['v']), r['id']))
        body = js(rs)
        h = hashlib.sha1(body.encode('utf-8')).hexdigest()[:8]
        fn = 'web/shards/%s.js' % key
        write(fn, 'window.UDFOP_SHARD(%s,%s);\n' % (js(key), body))
        keep.add(os.path.abspath(fn))
        days = sorted(rels[r['v']]['date'] for r in rs)
        shards[key] = {'h': h, 'n': len(rs), 'd': [days[0], days[-1]]}   # d: the first and last release date it holds, so a date range can pick shards
        for v in sorted({r['v'] for r in rs}, key=vkey): shard_of[v] = key   # sorted: set order differs between runs
        print('  shard %-9s %5d changes %5d KB gzipped' % (key, len(rs), gz(rs) // 1024))
for f in glob.glob('web/shards/*.js'):      # a month that has been split leaves its old file behind
    if os.path.abspath(f) not in keep:
        if CHECK: stale.append(f)
        else: os.remove(f)

# Former names: a topic merged into another keeps its old name as a redirect and a "Formerly recorded as" note.
# legacy: topics kept as a record of removed content, listed by hand in data/legacy.csv (topic, removed_in, note).
aka = {}
for old, new in sorted(alias.items()):
    if new in tstat: aka.setdefault(new, []).append(old)
legacy = {}
if os.path.exists('data/legacy.csv'):
    for r in csv.DictReader(open('data/legacy.csv', encoding='utf-8-sig')):
        if r['topic'] not in tstat:
            print('  WARNING: data/legacy.csv names a topic that does not exist:', r['topic'])
        elif r['removed_in'] and r['removed_in'] not in rels:
            print('  WARNING: data/legacy.csv: %s was removed in %s, which is not a release' % (r['topic'], r['removed_in']))
        else:
            legacy[r['topic']] = {'v': r['removed_in'], 'n': r.get('note', '')}
last_row = {}
for r in sorted(out, key=lambda r: (vkey(r['v']), r['id'])): last_row[r['e']] = r
cands = sorted(t for t, r in last_row.items() if r['t'] == 'Removal' and t not in legacy)
if cands:
    print('  Legacy candidates (the latest change is a Removal; a person decides, add real ones to data/legacy.csv):', ', '.join(cands))

core = dict(hubs=hub, releases=rels, desc=desc, tstat=tstat, shards=shards, shardOf=shard_of,
            alias={o: n for o, n in alias.items() if n in tstat}, aka=aka, legacy=legacy,
            totals=dict(rows=len(out), topics=len(tstat), versions=sum(1 for v in nrows if nrows[v])))
write('web/data.js', 'window.DATA=' + js(core) + ';\n')
print('  core  web/data.js %d KB gzipped' % (gz(core) // 1024))
if CHECK:
    if stale:
        print('  OUT OF DATE: run `python tools/notes.py build` and commit:', ', '.join(sorted(stale)))
        sys.exit(1)
    print('  web/data.js and web/shards/ match the data')
