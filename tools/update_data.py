"""Optional: rebuild web/data.js from data/normalized/*.jsonl (+ merges.csv, hub_assignment.csv).
The site itself is plain HTML/CSS/JS in web/; this only refreshes its data file. Run from the project root."""
import json, csv
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
from collections import Counter
nrows = Counter(r['version'] for r in rows)
# per release: u = Update name, t = title, k = kind (release, likely-hotfix, bulk-import), c = recorded changes, tier only when set
rels = {}
for x in (json.loads(l) for l in open('data/normalized/releases.jsonl', encoding='utf-8')):
    rels[x['version']] = {'date': x['date'], 'prs': [{'n': p['number'], 't': p['title'], 'u': p['url']} for p in x['prs']],
                          'u': x.get('update'), 't': x.get('title'), 'k': x.get('kind', 'release'), 'c': nrows.get(x['version'], 0)}
    if x.get('tier'): rels[x['version']]['tier'] = x['tier']
import glob
desc = {}
for f in sorted(glob.glob('data/descriptions/*.txt')):
    for line in open(f, encoding='utf-8'):
        if ' ||| ' in line:
            k, v = line.rstrip('\n').split(' ||| ', 1)
            desc[k] = v
open('web/data.js', 'w', encoding='utf-8').write(
    'window.DATA=' + json.dumps(dict(rows=out, hubs=hub, releases=rels, desc=desc), ensure_ascii=False, separators=(',', ':')) + ';\n')
