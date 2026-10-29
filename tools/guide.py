"""Game Guide and Site Guide tooling. Python 3 standard library only. Run from the project root.

    python tools/guide.py           rebuild web/guide/index.json and web/site/index.json (the site's lists of pages)
    python tools/guide.py --check   also report problems; exit code 1 if there are errors

Game Guide pages are Markdown files under web/guide/ (see CONTRIBUTING.md); Site Guide pages (help for contributors
and reviewers) are Markdown files under web/site/. Files and folders whose name starts with "_" or "." are ignored.
index.json, history.json (each page's commits, newest first) and credits.json (the names on the Credits page, from CONTRIBUTORS.md) are generated, git-ignored, and rebuilt by the deploy workflow, so contributors never have to run this."""
import json, os, re, subprocess, sys

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
            authors = meta.get('authors', '').strip()   # who wrote the page; the commit history may not name them
            if 'authors' not in meta:
                problems.append(('warn', where, 'no authors: line in the front matter: add one with the names of the people who wrote the page (comma separated)'))
            elif not authors:
                problems.append(('warn', where, 'the "authors:" line is empty: add the names of the people who wrote the page (comma separated)'))
            unlisted = meta.get('unlisted', '').strip().lower() in ('yes', 'true', '1', 'on')
            pages.append(dict(slug=slug, area=area, _where=where, title=title, category=category, summary=meta.get('summary', ''), unlisted=unlisted, **({'authors': authors} if authors else {}),
                              text=plain(body)[:6000], _body=body,
                              _related=[x.strip() for x in meta.get('related', '').split(',') if x.strip()],
                              _expected={x.strip().lower() for x in meta.get('expected-missing', '').split(',') if x.strip()}))
    return pages, problems


HISTORY_SHOWN = 50   # the History tab lists this many of a page's newest commits; it links to GitHub for the rest


def git_history(path):
    """The commits that touched one file, newest first, as [short hash, date, author name, subject, description, lines added, lines removed]; [] when git or the history is not there."""
    try:
        r = subprocess.run(['git', 'log', '--follow', '--numstat', '--format=%x1e%h%x1f%aI%x1f%an%x1f%s%x1f%b%x1f', '--', path], capture_output=True, text=True, encoding='utf-8')
    except OSError:
        return []
    if r.returncode != 0:
        return []
    out = []
    for rec in r.stdout.split('\x1e'):
        f = rec.split('\x1f')
        if len(f) == 6:
            body = '\n'.join(l for l in f[4].strip().splitlines() if not re.match(r'(Co-Authored-By|Signed-off-by):', l, re.I)).strip()   # the trailers say who, which the Author column already does
            nums = [re.match(r'(\d+)\t(\d+)\t', l) for l in f[5].splitlines()]
            nums = [m for m in nums if m]   # a picture or other binary file shows "-" and is left out
            out.append([f[0], f[1][:10], f[2], f[3], body, sum(int(m.group(1)) for m in nums), sum(int(m.group(2)) for m in nums)])
    return out


def topic_names():
    try:
        raw = open(os.path.join('web', 'data.js'), encoding='utf-8').read()
        d = json.loads(raw[raw.index('{'):raw.rindex('}') + 1])
        return {t.lower() for t in d['tstat']} | {t.lower() for t in d.get('alias', {})}
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
            if f.startswith(('_', '.')) or f.lower().endswith('.md') or f in ('index.json', 'images.json'):
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


PIC_IN_LINK = re.compile(r'\[!\[[^\]]*\]\([^()\s]*(?:\s+"[^"]*")?\)(?:\{[^}]*\})?[^\]]*\]\([^()\s]*\)')


def check_picture_links(pages, problems):
    """A picture inside a link, [![alt](pic)](url), is not supported: the site shows it as plain text."""
    for p in pages:
        for m in PIC_IN_LINK.finditer(strip_code(p['_body'])):
            problems.append(('error', p['_where'], 'a picture cannot be inside a link, so "%s" is shown as plain text (put the picture and the link on separate lines)' % m.group(0)))


def check_headings(pages, problems):
    """A heading needs a space after its hashes: "##Title" is shown as plain text, not as a heading."""
    for p in pages:
        bad = re.findall(r'^#{1,6}[^#\s].*$', strip_code(p['_body'], spans=False), flags=re.M)
        if bad:
            one = len(bad) == 1
            problems.append(('warn', p['_where'], '%d line%s begin%s with # but %s no space after the hashes, so %s shown as plain text instead of a heading (first: "%s"). Add a space after the hashes' % (len(bad), '' if one else 's', 's' if one else '', 'has' if one else 'have', 'it is' if one else 'they are', bad[0].strip()[:60])))


FN_DEF = re.compile(r'^\[\^([^\]\s]+)\]:', re.M)
FN_DEF_LINES = re.compile(r'^\[\^[^\]\s]+\]:.*(?:\n[ \t]{2,}\S.*)*', re.M)
FN_REF = re.compile(r'\[\^([^\]\s]+)\]')


def check_footnotes(pages, problems):
    """A footnote reference [^id] needs a definition line [^id]: text, and a definition needs a reference. An undefined reference stays as written."""
    for p in pages:
        body = strip_code(p['_body'])
        defs = FN_DEF.findall(body)
        used = {m.group(1) for m in FN_REF.finditer(FN_DEF_LINES.sub('', body))}   # a reference inside a definition is only text
        for i in sorted(used - set(defs)):
            problems.append(('error', p['_where'], 'the footnote reference [^%s] has no definition, so it is shown as written (add a line "[^%s]: the note")' % (i, i)))
        for i in sorted({d for d in defs if defs.count(d) > 1}):
            problems.append(('error', p['_where'], 'the footnote [^%s] is defined more than once (only the first is used)' % i))
        for i in sorted(set(defs) - used):
            problems.append(('warn', p['_where'], 'the footnote [^%s] is defined but never referenced, so it is not shown' % i))


def patch_versions():
    try:
        raw = open(os.path.join('web', 'data.js'), encoding='utf-8').read()
        return set(json.loads(raw[raw.index('{'):raw.rindex('}') + 1])['releases'])
    except Exception:
        return set()


def heading_id(text):
    """The id a heading gets on the page: the words with markup removed, lower case, every run of other characters turned into a hyphen (the site's slugId)."""
    t = re.sub(r'\[\[([^\]|]+)(?:\|([^\]]*))?\]\]', lambda m: m.group(2) or m.group(1), text)
    t = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', t)
    t = re.sub(r'>!(.+?)!<', r'\1', t)
    t = re.sub(r'[*_`]', '', t)
    return 's-' + re.sub(r'[^a-z0-9]+', '-', t.strip().lower())


def heading_ids(body):
    """The ids of a page's headings down to ### (deeper headings and headings in code boxes get none)."""
    ids = set()
    for line in strip_code(body, spans=False).split('\n'):
        m = re.match(r'^#{1,3}\s+(.*?)(?:\s+#+)?\s*$', line)
        if m:
            ids.add(heading_id(m.group(1)))
    return ids


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
    # a title or name may be used once across both guides, so a page is never ambiguous
    seen = {}
    for p in pages:
        for key in (p['title'].lower(), p['slug'].lower()):
            if key in seen and seen[key][0] != (p['area'], p['slug']):
                problems.append(('error', p['_where'], 'the title or name clashes with "%s"' % seen[key][1]))
        seen[p['title'].lower()] = ((p['area'], p['slug']), p['_where'])
        seen.setdefault(p['slug'].lower(), ((p['area'], p['slug']), p['_where']))
    # the names a link can use: a plain [[Name]] finds a Game Guide page, [[site:Name]] a Site Guide page; each name keeps the ids of that page's headings
    names = {a: {k: heading_ids(p['_body']) for p in by_area.get(a, []) for k in (p['title'].lower(), p['slug'].lower())} for a in ('guide', 'site')}
    for area, root, prefix in sections:
        check_images(by_area[area], problems, root, prefix)
    check_code_languages(pages, problems)
    check_alerts(pages, problems)
    check_picture_links(pages, problems)
    check_headings(pages, problems)
    check_footnotes(pages, problems)
    check_infoboxes(pages, problems)
    topics = topic_names()
    versions = patch_versions()
    for p in pages:
        own = heading_ids(p['_body'])
        for target in LINK.findall(strip_code(p['_body'])):
            shown = target.strip().rstrip('\\').strip()   # a table cell writes the alias bar as \|
            m = re.match(r'^(topic|patch|guide|site)\s*:\s*(.*)$', shown, flags=re.I)
            kind, rest = (m.group(1).lower(), m.group(2).strip()) if m else ('guide', shown)
            name, _, section = rest.partition('#')
            name, section = name.strip(), section.strip()
            if kind in ('topic', 'patch'):
                if section:
                    problems.append(('warn', p['_where'], 'link [[%s]]: a link to a topic or a patch cannot name a section, so it shows as plain text' % shown))
                elif kind == 'topic' and name.lower() not in topics:
                    problems.append(('warn', p['_where'], 'link [[%s]]: no Patch Notes topic is called "%s", so it shows as plain text' % (shown, name)))
                elif kind == 'patch' and name not in versions:
                    problems.append(('warn', p['_where'], 'link [[%s]]: there is no patch %s, so it shows as plain text' % (shown, name)))
                continue
            t = name.lower()
            if not name:   # [[#Section]]: a section of this page
                if not section or heading_id(section) not in own:
                    problems.append(('warn', p['_where'], 'link [[%s]]: this page has no section called "%s"' % (shown, section)))
                continue
            if kind == 'site':
                if t not in names['site']:
                    problems.append(('warn', p['_where'], 'link [[%s]]: no Site Guide page is called "%s", so it shows as plain text' % (shown, name)))
                elif section and heading_id(section) not in names['site'][t]:
                    problems.append(('warn', p['_where'], 'link [[%s]]: that Site Guide page has no section called "%s"' % (shown, section)))
                continue
            if t in names['guide']:
                if section and heading_id(section) not in names['guide'][t]:
                    problems.append(('warn', p['_where'], 'link [[%s]]: that page has no section called "%s"' % (shown, section)))
            elif t in p['_expected']:
                continue
            elif t in names['site']:
                problems.append(('warn', p['_where'], 'link [[%s]] is a Site Guide page, not a Game Guide page. A Site Guide page is linked on purpose: [[site:%s]]' % (shown, rest)))
            elif t in topics:
                problems.append(('warn', p['_where'], 'link [[%s]] is a Patch Notes topic, not a guide page. A topic is linked on purpose: [[topic:%s]]' % (shown, rest)))
            else:
                problems.append(('warn', p['_where'], 'link [[%s]] matches no guide page yet' % shown))
    for area, root, prefix in sections:
        cats = {}
        for p in by_area[area]:
            cats.setdefault(re.sub(r'\s+', ' ', p['category']).strip().lower(), set()).add(p['category'])
        for key, spellings in cats.items():
            if len(spellings) > 1:
                problems.append(('warn', prefix + 'categories', 'the category is spelled more than one way: %s (use one spelling)' % ', '.join('"%s"' % x for x in sorted(spellings))))
    for p in pages:
        for name in p['_related']:
            m = re.match(r'^(guide|site|topic|patch)\s*:\s*(.*)$', name, flags=re.I)
            kind, rest = (m.group(1).lower(), m.group(2).strip()) if m else ('', name.strip())
            key = rest.lower()
            ok = (rest in versions) if kind == 'patch' else (key in topics) if kind == 'topic' else (key in names['site']) if kind == 'site' else (key in names['guide'])   # no prefix, or guide:, is a Game Guide page
            if not ok:
                problems.append(('warn', p['_where'], 'related: "%s" matches no %s' % (name, {'patch': 'patch', 'topic': 'topic', 'site': 'Site Guide page'}.get(kind, 'Game Guide page'))))
    for area, root, prefix in sections:
        ps = by_area[area]
        ps.sort(key=lambda p: (p['category'].lower(), p['title'].lower()))
        hist = {}
        for p in ps:
            h = git_history(os.path.join(root, p['slug'] + '.md'))
            if h:
                hist[p['slug']] = {'n': len(h), 'c': h[:HISTORY_SHOWN]}
                p['created'], p['cby'], p['updated'], p['by'] = h[-1][1], h[-1][2], h[0][1], h[0][2]   # a page's first and latest commit
        out = [{k: v for k, v in p.items() if not k.startswith('_') and k != 'area' and not (k == 'unlisted' and not v)} for p in ps]
        with open(os.path.join(root, 'index.json'), 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        with open(os.path.join(root, 'history.json'), 'w', encoding='utf-8') as f:
            json.dump(hist, f, ensure_ascii=False, separators=(',', ':'))
        print('%s: %d page(s) indexed' % (area, len(out)))
    # the pictures the editor offers after ![](  (paths from the Game Guide folder)
    pics = sorted(os.path.relpath(os.path.join(d, f), ROOT).replace(os.sep, '/') for d, _, fs in os.walk(ROOT) for f in fs
                  if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg')) and not f.startswith(('_', '.')))
    with open(os.path.join(ROOT, 'images.json'), 'w', encoding='utf-8') as f:
        json.dump(pics, f, ensure_ascii=False, separators=(',', ':'))
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
