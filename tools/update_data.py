"""Optional: rebuild the site's data from data/normalized/*.jsonl (+ merges.csv, hub_assignment.csv, descriptions).
The site itself is plain HTML/CSS/JS in web/; this only refreshes its data files. Run from the project root.

  web/data.js            the core file every page loads: hubs, every release, descriptions, a count and last patch for each topic
  web/shards/<key>.js    the change rows, one file per period (a month, or part of a month when it would be too big);
                         a page loads only the shards it needs
"""
import json, csv, glob, gzip, hashlib, os
from collections import Counter

SHARD_LIMIT_GZ = 500 * 1024   # Provisional: each shard stays under 500 KB gzipped; a bigger month is split in two, again and again

rows = [json.loads(l) for l in open('data/normalized/all.jsonl', encoding='utf-8')]
alias = {m['from']: m['to'] for m in csv.DictReader(open('data/merges.csv', encoding='utf-8'))
         if m['recommend'] == 'merge' and m['from'] != m['to']}
hub = {h['topic']: h['primary_hub'] for h in csv.DictReader(open('data/hub_assignment.csv', encoding='utf-8'))}
out = []
for r in rows:
    e = alias.get(r['entity'], r['entity']); s = r['summary']
    for p in (r['entity'] + ': ', e + ': '):
        if s.startswith(p): s = s[len(p):]; break
    out.append(dict(id=r['id'], v=r['version'], d=r['date'], s=r['system'], e=e, t=r['change_type'],
                    r=r['direction'], x=s, g=r['tags'], n=r['dev_note']))
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


# topic stats for the core file: [changes, last patch, first patch]; system counts
tstat, systems = {}, Counter()
for r in out:
    c, last, first = tstat.get(r['e'], [0, '', ''])
    tstat[r['e']] = [c + 1, r['v'] if not last or vkey(r['v']) > vkey(last) else last,
                     r['v'] if not first or vkey(r['v']) < vkey(first) else first]
    systems[r['s']] += 1

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
os.makedirs('web/shards', exist_ok=True)
keep = set()
for month in sorted(by_month):
    for key, rs in split(month, by_month[month]):
        rs.sort(key=lambda r: (vkey(r['v']), r['id']))
        body = js(rs)
        h = hashlib.sha1(body.encode('utf-8')).hexdigest()[:8]
        fn = 'web/shards/%s.js' % key
        open(fn, 'w', encoding='utf-8', newline='\n').write('window.UDFOP_SHARD(%s,%s);\n' % (js(key), body))
        keep.add(os.path.abspath(fn))
        days = sorted(rels[r['v']]['date'] for r in rs)
        shards[key] = {'h': h, 'n': len(rs), 'd': [days[0], days[-1]]}   # d: the first and last release date it holds, so a date range can pick shards
        for v in {r['v'] for r in rs}: shard_of[v] = key
        print('  shard %-9s %5d changes %5d KB gzipped' % (key, len(rs), gz(rs) // 1024))
for f in glob.glob('web/shards/*.js'):      # a month that has been split leaves its old file behind
    if os.path.abspath(f) not in keep: os.remove(f)

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

core = dict(hubs=hub, releases=rels, desc=desc, tstat=tstat, systems=dict(systems), shards=shards, shardOf=shard_of,
            alias={o: n for o, n in alias.items() if n in tstat}, aka=aka, legacy=legacy,
            totals=dict(rows=len(out), topics=len(tstat), versions=sum(1 for v in nrows if nrows[v])))
open('web/data.js', 'w', encoding='utf-8').write('window.DATA=' + js(core) + ';\n')
print('  core  web/data.js %d KB gzipped' % (gz(core) // 1024))
