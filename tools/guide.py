"""Game Guide and Site Guide tooling. Python 3 standard library only. Run from the project root.

    python tools/guide.py           rebuild web/guide/index.json and web/site/index.json (the site's lists of pages)
    python tools/guide.py --check   also report problems; exit code 1 if there are errors

Game Guide pages are Markdown files under web/guide/ (see CONTRIBUTING.md); Site Guide pages (help for contributors
and reviewers) are Markdown files under web/site/. Files and folders whose name starts with "_" or "." are ignored.
index.json and credits.json (the names on the Credits page, from CONTRIBUTORS.md) are generated, git-ignored, and rebuilt by the deploy workflow, so contributors never have to run this."""
import json, os, re, sys

ROOT = os.path.join('web', 'guide')
SITE = os.path.join('web', 'site')
IMG_EXT = ('.png', '.jpg', '.jpeg', '.webp', '.gif')
MAX_IMG = 500 * 1024
IMAGE = re.compile(r'!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)(?:\{[^}]*\})?')
FIGURE = re.compile(r'^!\[[^\]]*\]\([^)\s]+(?:\s+"([^"]*)")?\)\{([^}]*)\}\s*$', re.M)
LINK = re.compile(r'\[\[([^\]\|]+?)(?:\|[^\]]*)?\]\]')


def split_front(raw):
    """Return (meta dict, body, error). Front matter is optional: '---' lines around 'key: value' lines."""
    raw = raw.lstrip('﻿').replace('\r\n', '\n')
    if not raw.startswith('---\n'):
        return {}, raw, None
    end = raw.find('\n---', 4)
    if end < 0:
        return {}, raw, 'front matter starts with --- but never closes'
    meta = {}
    for line in raw[4:end].split('\n'):
        if ':' in line and not line.lstrip().startswith('#'):
            k, v = line.split(':', 1)
            meta[k.strip().lower()] = v.strip().strip('"\'')
    body = raw[end + 4:].lstrip('\n')
    return meta, body, None


def strip_spans(line):
    """Blank out inline code: a run of backticks closed by a run of the same length (so `` ` `` is code)."""
    return re.sub(r'(?<!`)(`+)(?!`).+?(?<!`)\1(?!`)', ' ', line)


def strip_code(text, spans=True):
    """Blank out code boxes (three or more backticks or tildes, closed by a bare fence at least as long) and, unless spans is False, inline code."""
    out, fence = [], None
    for line in text.split('\n'):
        if fence is None:
            m = re.match(r'^(`{3,})[^`]*$|^(~{3,}).*$', line)
            if m:
                fence = m.group(1) or m.group(2); out.append(''); continue
            out.append(strip_spans(line) if spans else line)
        else:
            m = re.match(r'^(`{3,}|~{3,})[ \t]*$', line)
            if m and m.group(1)[0] == fence[0] and len(m.group(1)) >= len(fence):
                fence = None
            out.append('')
    return '\n'.join(out)


def fence_languages(text):
    """The language names written after the opening fences of code boxes."""
    langs, fence = [], None
    for line in text.split('\n'):
        if fence is None:
            m = re.match(r'^(`{3,}|~{3,})[ \t]*([A-Za-z0-9+#.-]{1,20})?[ \t]*$', line)
            if m:
                fence = m.group(1)
                if m.group(2): langs.append(m.group(2))
            elif re.match(r'^(`{3,})[^`]*$|^(~{3,}).*$', line):
                fence = re.match(r'^(`{3,}|~{3,})', line).group(1)
        else:
            m = re.match(r'^(`{3,}|~{3,})[ \t]*$', line)
            if m and m.group(1)[0] == fence[0] and len(m.group(1)) >= len(fence):
                fence = None
    return langs


def plain(md):
    """Rough plain text of a Markdown body, for the site search."""
    t = strip_code(md, spans=False)
    t = re.sub(r'!\[[^\]]*\]\([^)]*\)(\{[^}]*\})?', ' ', t)
    t = re.sub(r'\[\[([^\]\|]+)(?:\|([^\]]*))?\]\]', lambda m: m.group(2) or m.group(1), t)
    t = re.sub(r'\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO)\]', ' ', t, flags=re.I)
    t = re.sub(r'\{\{(?:pad\s*:\s*)?([^{}]+)\}\}', r'\1', t)
    t = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', t)
    t = re.sub(r'>!|!<', ' ', t)
    t = re.sub(r'[#>*_`|~-]+', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


def humanize(name):
    s = re.sub(r'[-_]+', ' ', name).strip()
    return s[:1].upper() + s[1:]


def scan(root=ROOT, area='guide'):
    pages, problems = [], []
    prefix = 'site/' if area == 'site' else ''
    for base, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if not d.startswith(('_', '.')))
        for f in sorted(files):
            if not f.lower().endswith('.md') or f.startswith(('_', '.')):
                continue
            path = os.path.join(base, f)
            rel = os.path.relpath(path, root).replace(os.sep, '/')
            slug = rel[:-3]
            where = prefix + rel
            raw = open(path, encoding='utf-8').read()
            meta, body, err = split_front(raw)
            if err:
                problems.append(('error', where, err))
            title = meta.get('title')
            if not title:
                m = re.search(r'^#\s+(.+?)\s*#*\s*$', body, flags=re.M)
                title = m.group(1) if m else humanize(os.path.basename(slug))
                problems.append(('warn', where, 'no title in the front matter; using "%s"' % title))
            folder = os.path.dirname(slug)
            if folder.split('/')[0].lower() == 'category':
                problems.append(('error', where, 'a top-level folder named "category" cannot be used: the site reserves that word in addresses (#/guide/category/...), so every page in it would be unreachable. Rename the folder'))
            category = meta.get('category') or (humanize(folder.split('/')[0]) if folder else 'General')
            if re.search(r'<\s*/?\s*(script|iframe|object|embed|style|img|a)\b|javascript:|\bon[a-z]+\s*=|[\x00-\x08\x0b\x0c\x0e-\x1f]', body, flags=re.I):
                problems.append(('warn', where, 'contains HTML tags, script-like text or control characters: the site shows these as plain text, but a reviewer should look'))
            if not body.strip():
                problems.append(('error', where, 'the page is empty'))
            if re.search(r'[^A-Za-z0-9._/ -]', slug):
                problems.append(('warn', where, 'file names are easier to link with only letters, numbers, spaces and hyphens'))
            unlisted = meta.get('unlisted', '').strip().lower() in ('yes', 'true', '1', 'on')
            pages.append(dict(slug=slug, area=area, _where=where, title=title, category=category, summary=meta.get('summary', ''), unlisted=unlisted,
                              text=plain(body)[:6000], _body=body,
                              _related=[x.strip() for x in meta.get('related', '').split(',') if x.strip()],
                              _expected={x.strip().lower() for x in meta.get('expected-missing', '').split(',') if x.strip()}))
    return pages, problems


def topic_names():
    try:
        raw = open(os.path.join('web', 'data.js'), encoding='utf-8').read()
        d = json.loads(raw[raw.index('{'):raw.rindex('}') + 1])
        return {t.lower() for t in d['tstat']}
    except Exception:
        return set()


def check_images(pages, problems, root=ROOT, prefix=''):
    """Pictures live under the section's folder (the convention is an images folder). Report broken, unused, oversized and odd files."""
    used = set()
    for p in pages:
        body = strip_code(p['_body'])
        folder = os.path.dirname(p['slug'])
        refs = IMAGE.findall(body)
        for block in infoboxes(p['_body']):
            for ln in block[1:]:
                mi = re.match(r'^image\s*:\s*(\S+)\s*$', ln.strip(), re.I)
                if mi: refs.append(mi.group(1))
        for ref in refs:
            if re.match(r'^([a-z][a-z0-9+.-]*:|//|/)', ref, flags=re.I):
                continue
            rel = os.path.normpath(os.path.join(folder, ref.lstrip('./') if ref.startswith('./') else ref)).replace(os.sep, '/')
            used.add(rel.lower())
            if not os.path.isfile(os.path.join(root, rel)):
                problems.append(('error', p['_where'], 'the picture "%s" does not exist (put it in an images folder, such as web/guide/images/ or one beside the page, and use the path from the page folder)' % ref))
    for p in pages:
        body = strip_code(p['_body'], spans=False)
        for m in FIGURE.finditer(body):
            for tok in [x for x in re.split(r'[\s,]+', m.group(2).strip().lower()) if x]:
                if tok in ('left', 'right', 'center'):
                    continue
                if re.fullmatch(r'\d+(px)?', tok):
                    if not 40 <= int(tok.rstrip('px')) <= 1200:
                        problems.append(('warn', p['_where'], 'picture width %s is outside 40 to 1200 pixels' % tok))
                    continue
                problems.append(('warn', p['_where'], 'unknown picture option "%s" in braces (use left, right, center and a width in pixels)' % tok))
    for base, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if not d.startswith(('_', '.')))
        for f in sorted(files):
            if f.startswith(('_', '.')) or f.lower().endswith('.md') or f == 'index.json':
                continue
            path = os.path.join(base, f)
            rel = os.path.relpath(path, root).replace(os.sep, '/')
            if not f.lower().endswith(IMG_EXT):
                problems.append(('warn', prefix + rel, 'not a page or a picture the site can show (use PNG, JPG, WebP or GIF)'))
                continue
            if os.path.getsize(path) > MAX_IMG:
                problems.append(('warn', prefix + rel, 'is %d KB; please shrink it below %d KB so pages load quickly' % (os.path.getsize(path) // 1024, MAX_IMG // 1024)))
            if rel.lower() not in used:
                problems.append(('warn', prefix + rel, 'is not used by any page'))
            if os.path.basename(os.path.dirname(rel)) != 'images':
                problems.append(('warn', prefix + rel, 'pictures are easier to find in an images folder (web/guide/images/, or an images folder inside the page folder)'))


def code_languages():
    """The language names the site colors: the keys of ALIASES in web/highlight.js, plus the plain ones."""
    try:
        src = open(os.path.join('web', 'highlight.js'), encoding='utf-8').read()
        block = src[src.index('var ALIASES = {'):src.index('};', src.index('var ALIASES = {'))]
        names = set(re.findall(r'(?:^|[\s,{])"?([A-Za-z0-9#]+)"?\s*:\s*\[', block))
    except Exception:
        return None
    return names | {'text', 'txt', 'plain', 'none', 'log'}


def check_code_languages(pages, problems):
    """A fenced block can name a language after the backticks. An unknown name is shown plain, so say so."""
    names = code_languages()
    if not names:
        return
    for p in pages:
        for lang in fence_languages(p['_body']):
            if lang.lower() not in names:
                problems.append(('warn', p['_where'], 'the code box language "%s" is not one the site colors, so it will be shown plain (see "Code blocks" in the Formatting reference for the names)' % lang))


ALERTS = ('note', 'tip', 'important', 'warning', 'caution', 'info')   # info is the infobox, which has its own checks


INFO_START = re.compile(r'^>[ \t]*\[!INFO\]', re.I | re.M)


def infoboxes(body):
    """Each infobox in a page: (tag line, [its lines without the leading >])."""
    lines = strip_code(body, spans=False).split('\n')
    boxes, i = [], 0
    while i < len(lines):
        if INFO_START.match(lines[i]):
            block = [re.sub(r'^>[ \t]?', '', lines[i])]
            i += 1
            while i < len(lines) and lines[i].startswith('>'):
                block.append(re.sub(r'^>[ \t]?', '', lines[i])); i += 1
            boxes.append(block)
        else:
            i += 1
    return boxes


def check_infoboxes(pages, problems):
    """An infobox row needs a value, a page needs only one box, and the box comes first."""
    for p in pages:
        boxes = infoboxes(p['_body'])
        if boxes:
            first = next((ln for ln in p['_body'].split('\n') if ln.strip()), '')
            if not INFO_START.match(first):
                problems.append(('warn', p['_where'], 'the infobox is not the first thing on the page; move it to the top, right after the front matter, so it lines up with the first paragraph'))
        if len(boxes) > 1:
            problems.append(('warn', p['_where'], 'the page has %d infoboxes; one is enough, and a table can hold the rest' % len(boxes)))
        for block in boxes:
            for ln in block[1:]:
                t = ln.strip()
                m = re.match(r'^([^:|]{1,40}?)\s*:\s*(.*)$', t)
                if m and not m.group(2).strip() and not re.match(r'^image\s*$', m.group(1), re.I):
                    problems.append(('warn', p['_where'], 'the infobox row "%s" has no value' % m.group(1).strip()))
                if re.match(r'^image\s*:\s*$', t, re.I):
                    problems.append(('warn', p['_where'], 'the infobox has an "image:" line with no picture path'))


def check_alerts(pages, problems):
    """A quote that starts [!SOMETHING] is a notice box only for the five known names; any other name stays a plain quote, so say so."""
    for p in pages:
        body = strip_code(p['_body'], spans=False)
        for name in re.findall(r'^>[ \t]*\[!([A-Za-z]+)\][ \t]*$', body, flags=re.M):
            if name.lower() not in ALERTS:
                problems.append(('warn', p['_where'], 'the notice box type "[!%s]" is not one the site knows, so it will show as an ordinary quote (use NOTE, TIP, IMPORTANT, WARNING or CAUTION, or INFO for a fact panel)' % name))


def patch_versions():
    try:
        raw = open(os.path.join('web', 'data.js'), encoding='utf-8').read()
        return set(json.loads(raw[raw.index('{'):raw.rindex('}') + 1])['releases'])
    except Exception:
        return set()


PERSON = re.compile(r'^[-*]\s+\[([^\]]+)\]\((\S+?)\)\s*(?:[\u2013\u2014:-]\s*(.*?))?\s*$')


def build_credits(problems):
    """web/credits.json from CONTRIBUTORS.md: one group per "## Heading", one person per "- [name](link) - a few words" line."""
    path, where = 'CONTRIBUTORS.md', 'CONTRIBUTORS.md'
    groups = []
    if not os.path.isfile(path):
        return dict(groups=groups)
    cur = None
    for ln in open(path, encoding='utf-8').read().splitlines():
        m = re.match(r'^##\s+(.+?)\s*$', ln)
        if m:
            cur = dict(title=m.group(1), people=[])
            groups.append(cur)
            continue
        if cur is None or not re.match(r'^[-*]\s', ln):
            continue
        if re.search(r'[\w.+-]+@[\w-]+\.[\w.]+|mailto:', ln, flags=re.I):
            problems.append(('error', where, 'an email address is not allowed in the contributors list: "%s"' % ln.strip()[:60]))
            continue
        m = PERSON.match(ln)
        if not m or not re.match(r'^https?://', m.group(2)):
            problems.append(('warn', where, 'this line was not read as a person (write "- [username](https://link) - a few words"): "%s"' % ln.strip()[:60]))
            continue
        cur['people'].append(dict(name=m.group(1).strip(), url=m.group(2), role=(m.group(3) or '').strip()))
    return dict(groups=[g for g in groups if g['people']])


def main():
    check = '--check' in sys.argv
    if not os.path.isdir(ROOT):
        print('no %s folder' % ROOT); return 1
    sections = [('guide', ROOT, '')]
    if os.path.isdir(SITE):
        sections.append(('site', SITE, 'site/'))
    pages, problems, by_area = [], [], {}
    for area, root, prefix in sections:
        ps, pr = scan(root, area)
        by_area[area] = ps
        pages += ps; problems += pr
    # a title or name may be used once across both guides, because [[Title]] finds a page in either
    seen = {}
    for p in pages:
        for key in (p['title'].lower(), p['slug'].lower()):
            if key in seen and seen[key][0] != (p['area'], p['slug']):
                problems.append(('error', p['_where'], 'the title or name clashes with "%s"' % seen[key][1]))
        seen[p['title'].lower()] = ((p['area'], p['slug']), p['_where'])
        seen.setdefault(p['slug'].lower(), ((p['area'], p['slug']), p['_where']))
    for area, root, prefix in sections:
        check_images(by_area[area], problems, root, prefix)
    check_code_languages(pages, problems)
    check_alerts(pages, problems)
    check_infoboxes(pages, problems)
    topics = topic_names()
    for p in pages:
        for target in LINK.findall(strip_code(p['_body'])):
            t = target.strip().rstrip('\\').strip().lower()   # a table cell writes the alias bar as \|
            if t not in seen and t not in topics and t not in p['_expected'] and not t.startswith(('patch:', 'topic:')):
                problems.append(('warn', p['_where'], 'link [[%s]] matches no guide page or topic yet' % target.strip()))
    for area, root, prefix in sections:
        cats = {}
        for p in by_area[area]:
            cats.setdefault(re.sub(r'\s+', ' ', p['category']).strip().lower(), set()).add(p['category'])
        for key, spellings in cats.items():
            if len(spellings) > 1:
                problems.append(('warn', prefix + 'categories', 'the category is spelled more than one way: %s (use one spelling)' % ', '.join('"%s"' % x for x in sorted(spellings))))
    versions = patch_versions()
    for p in pages:
        for name in p['_related']:
            m = re.match(r'^(guide|topic|patch)\s*:\s*(.*)$', name, flags=re.I)
            kind, rest = (m.group(1).lower(), m.group(2).strip()) if m else ('', name.strip())
            key = rest.lower()
            ok = (rest in versions) if kind == 'patch' else (key in seen) if kind == 'guide' else (key in topics) if kind == 'topic' else (key in seen or key in topics)
            if not ok:
                problems.append(('warn', p['_where'], 'related: "%s" matches no %s' % (name, {'patch': 'patch', 'guide': 'guide page', 'topic': 'topic'}.get(kind, 'guide page or topic'))))
    for area, root, prefix in sections:
        ps = by_area[area]
        ps.sort(key=lambda p: (p['category'].lower(), p['title'].lower()))
        out = [{k: v for k, v in p.items() if not k.startswith('_') and k != 'area' and not (k == 'unlisted' and not v)} for p in ps]
        with open(os.path.join(root, 'index.json'), 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        print('%s: %d page(s) indexed' % (area, len(out)))
    credits = build_credits(problems)
    with open(os.path.join('web', 'credits.json'), 'w', encoding='utf-8') as f:
        json.dump(credits, f, ensure_ascii=False, separators=(',', ':'))
    print('credits: %d name(s)' % sum(len(g['people']) for g in credits['groups']))
    errors = [x for x in problems if x[0] == 'error']
    if check or errors:
        for level, where, msg in problems:
            print('  %s  %s: %s' % ('ERROR' if level == 'error' else 'note ', where, msg))
    return 1 if (check and errors) else 0


if __name__ == '__main__':
    sys.exit(main())
