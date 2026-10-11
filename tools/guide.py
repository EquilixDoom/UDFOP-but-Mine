"""Game Guide tooling. Python 3 standard library only. Run from the project root.

    python tools/guide.py           rebuild web/guide/index.json (the site's list of guide pages)
    python tools/guide.py --check   also report problems; exit code 1 if there are errors

Guide pages are Markdown files under web/guide/ (see CONTRIBUTING.md). Files and folders whose name
starts with "_" or "." are ignored. index.json is generated, git-ignored, and rebuilt by the deploy workflow,
so contributors never have to run this."""
import json, os, re, sys

ROOT = os.path.join('web', 'guide')
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


def plain(md):
    """Rough plain text of a Markdown body, for the site search."""
    t = re.sub(r'```.*?```', ' ', md, flags=re.S)
    t = re.sub(r'!\[[^\]]*\]\([^)]*\)(\{[^}]*\})?', ' ', t)
    t = re.sub(r'\[\[([^\]\|]+)(?:\|([^\]]*))?\]\]', lambda m: m.group(2) or m.group(1), t)
    t = re.sub(r'\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]', ' ', t, flags=re.I)
    t = re.sub(r'\{\{(?:pad\s*:\s*)?([^{}]+)\}\}', r'\1', t)
    t = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', t)
    t = re.sub(r'>!|!<', ' ', t)
    t = re.sub(r'[#>*_`|~-]+', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


def humanize(name):
    s = re.sub(r'[-_]+', ' ', name).strip()
    return s[:1].upper() + s[1:]


def scan():
    pages, problems = [], []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = sorted(d for d in dirs if not d.startswith(('_', '.')))
        for f in sorted(files):
            if not f.lower().endswith('.md') or f.startswith(('_', '.')):
                continue
            path = os.path.join(base, f)
            rel = os.path.relpath(path, ROOT).replace(os.sep, '/')
            slug = rel[:-3]
            raw = open(path, encoding='utf-8').read()
            meta, body, err = split_front(raw)
            if err:
                problems.append(('error', rel, err))
            title = meta.get('title')
            if not title:
                m = re.search(r'^#\s+(.+?)\s*#*\s*$', body, flags=re.M)
                title = m.group(1) if m else humanize(os.path.basename(slug))
                problems.append(('warn', rel, 'no title in the front matter; using "%s"' % title))
            folder = os.path.dirname(slug)
            if folder.split('/')[0].lower() == 'category':
                problems.append(('error', rel, 'a top-level folder named "category" cannot be used: the site reserves that word in addresses (#/guide/category/...), so every page in it would be unreachable. Rename the folder'))
            category = meta.get('category') or (humanize(folder.split('/')[0]) if folder else 'General')
            if re.search(r'<\s*/?\s*(script|iframe|object|embed|style|img|a)\b|javascript:|\bon[a-z]+\s*=|[\x00-\x08\x0b\x0c\x0e-\x1f]', body, flags=re.I):
                problems.append(('warn', rel, 'contains HTML tags, script-like text or control characters: the site shows these as plain text, but a reviewer should look'))
            if not body.strip():
                problems.append(('error', rel, 'the page is empty'))
            if re.search(r'[^A-Za-z0-9._/ -]', slug):
                problems.append(('warn', rel, 'file names are easier to link with only letters, numbers, spaces and hyphens'))
            unlisted = meta.get('unlisted', '').strip().lower() in ('yes', 'true', '1', 'on')
            pages.append(dict(slug=slug, title=title, category=category, summary=meta.get('summary', ''), unlisted=unlisted,
                              text=plain(body)[:6000], _body=body,
                              _related=[x.strip() for x in meta.get('related', '').split(',') if x.strip()],
                              _expected={x.strip().lower() for x in meta.get('expected-missing', '').split(',') if x.strip()}))
    return pages, problems


def topic_names():
    try:
        raw = open(os.path.join('web', 'data.js'), encoding='utf-8').read()
        d = json.loads(raw[raw.index('{'):raw.rindex('}') + 1])
        return {r['e'].lower() for r in d['rows']}
    except Exception:
        return set()


def check_images(pages, problems):
    """Pictures live under web/guide/ (the convention is web/guide/images/). Report broken, unused, oversized and odd files."""
    used = set()
    for p in pages:
        body = re.sub(r'```.*?```|`[^`\n]*`', ' ', p['_body'], flags=re.S)
        folder = os.path.dirname(p['slug'])
        for ref in IMAGE.findall(body):
            if re.match(r'^([a-z][a-z0-9+.-]*:|//|/)', ref, flags=re.I):
                continue
            rel = os.path.normpath(os.path.join(folder, ref.lstrip('./') if ref.startswith('./') else ref)).replace(os.sep, '/')
            used.add(rel.lower())
            if not os.path.isfile(os.path.join(ROOT, rel)):
                problems.append(('error', p['slug'] + '.md', 'the picture "%s" does not exist (put it in an images folder, such as web/guide/images/ or one beside the page, and use the path from the page folder)' % ref))
    for p in pages:
        body = re.sub(r'```.*?```', ' ', p['_body'], flags=re.S)
        for m in FIGURE.finditer(body):
            for tok in [x for x in re.split(r'[\s,]+', m.group(2).strip().lower()) if x]:
                if tok in ('left', 'right', 'center'):
                    continue
                if re.fullmatch(r'\d+(px)?', tok):
                    if not 40 <= int(tok.rstrip('px')) <= 1200:
                        problems.append(('warn', p['slug'] + '.md', 'picture width %s is outside 40 to 1200 pixels' % tok))
                    continue
                problems.append(('warn', p['slug'] + '.md', 'unknown picture option "%s" in braces (use left, right, center and a width in pixels)' % tok))
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = sorted(d for d in dirs if not d.startswith(('_', '.')))
        for f in sorted(files):
            if f.startswith(('_', '.')) or f.lower().endswith('.md') or f == 'index.json':
                continue
            path = os.path.join(base, f)
            rel = os.path.relpath(path, ROOT).replace(os.sep, '/')
            if not f.lower().endswith(IMG_EXT):
                problems.append(('warn', rel, 'not a page or a picture the site can show (use PNG, JPG, WebP or GIF)'))
                continue
            if os.path.getsize(path) > MAX_IMG:
                problems.append(('warn', rel, 'is %d KB; please shrink it below %d KB so pages load quickly' % (os.path.getsize(path) // 1024, MAX_IMG // 1024)))
            if rel.lower() not in used:
                problems.append(('warn', rel, 'is not used by any page'))
            if os.path.basename(os.path.dirname(rel)) != 'images':
                problems.append(('warn', rel, 'pictures are easier to find in an images folder (web/guide/images/, or an images folder inside the page folder)'))


def code_languages():
    """The language names the site colours: the keys of ALIASES in web/highlight.js, plus the plain ones."""
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
        for lang in re.findall(r'^```[ 	]*([A-Za-z0-9+#.-]{1,20})[ 	]*$', p['_body'], flags=re.M):
            if lang.lower() not in names:
                problems.append(('warn', p['slug'] + '.md', 'the code box language "%s" is not one the site colours, so it will be shown plain (see "Code blocks" in the how-to page for the names)' % lang))


ALERTS = ('note', 'tip', 'important', 'warning', 'caution')


def check_alerts(pages, problems):
    """A quote that starts [!SOMETHING] is a notice box only for the five known names; any other name stays a plain quote, so say so."""
    for p in pages:
        body = re.sub(r'```.*?```', ' ', p['_body'], flags=re.S)
        for name in re.findall(r'^>[ \t]*\[!([A-Za-z]+)\][ \t]*$', body, flags=re.M):
            if name.lower() not in ALERTS:
                problems.append(('warn', p['slug'] + '.md', 'the notice box type "[!%s]" is not one the site knows, so it will show as an ordinary quote (use NOTE, TIP, IMPORTANT, WARNING or CAUTION)' % name))


def patch_versions():
    try:
        raw = open(os.path.join('web', 'data.js'), encoding='utf-8').read()
        return {r['v'] for r in json.loads(raw[raw.index('{'):raw.rindex('}') + 1])['rows']}
    except Exception:
        return set()


def main():
    check = '--check' in sys.argv
    if not os.path.isdir(ROOT):
        print('no %s folder' % ROOT); return 1
    pages, problems = scan()
    seen = {}
    for p in pages:
        for key in (p['title'].lower(), p['slug'].lower()):
            if key in seen and seen[key] != p['slug']:
                problems.append(('error', p['slug'] + '.md', 'the title or name clashes with "%s.md"' % seen[key]))
        seen[p['title'].lower()] = p['slug']
        seen.setdefault(p['slug'].lower(), p['slug'])
    check_images(pages, problems)
    check_code_languages(pages, problems)
    check_alerts(pages, problems)
    topics = topic_names()
    for p in pages:
        for target in LINK.findall(re.sub(r'```.*?```|`[^`\n]*`', ' ', p['_body'], flags=re.S)):
            t = target.strip().rstrip('\\').strip().lower()   # a table cell writes the alias bar as \|
            if t not in seen and t not in topics and t not in p['_expected'] and not t.startswith(('patch:', 'topic:')):
                problems.append(('warn', p['slug'] + '.md', 'link [[%s]] matches no guide page or topic yet' % target.strip()))
    cats = {}
    for p in pages:
        cats.setdefault(re.sub(r'\s+', ' ', p['category']).strip().lower(), set()).add(p['category'])
    for key, spellings in cats.items():
        if len(spellings) > 1:
            problems.append(('warn', 'categories', 'the category is spelled more than one way: %s (use one spelling)' % ', '.join('"%s"' % x for x in sorted(spellings))))
    versions = patch_versions()
    for p in pages:
        for name in p['_related']:
            m = re.match(r'^(guide|topic|patch)\s*:\s*(.*)$', name, flags=re.I)
            kind, rest = (m.group(1).lower(), m.group(2).strip()) if m else ('', name.strip())
            key = rest.lower()
            ok = (rest in versions) if kind == 'patch' else (key in seen) if kind == 'guide' else (key in topics) if kind == 'topic' else (key in seen or key in topics)
            if not ok:
                problems.append(('warn', p['slug'] + '.md', 'related: "%s" matches no %s' % (name, {'patch': 'patch', 'guide': 'guide page', 'topic': 'topic'}.get(kind, 'guide page or topic'))))
    pages.sort(key=lambda p: (p['category'].lower(), p['title'].lower()))
    out = [{k: v for k, v in p.items() if not k.startswith('_') and not (k == 'unlisted' and not v)} for p in pages]
    with open(os.path.join(ROOT, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print('guide: %d page(s) indexed' % len(out))
    errors = [x for x in problems if x[0] == 'error']
    if check or errors:
        for level, where, msg in problems:
            print('  %s  %s: %s' % ('ERROR' if level == 'error' else 'note ', where, msg))
    return 1 if (check and errors) else 0


if __name__ == '__main__':
    sys.exit(main())
