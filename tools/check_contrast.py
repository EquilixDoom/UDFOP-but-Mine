#!/usr/bin/env python3
"""Check WCAG AA contrast (4.5:1) of the text colors in web/style.css for every
skin in light and dark, and check that each dark block and its prefers-color-scheme
copy match. Exits 1 on any failure.   Usage: python tools/check_contrast.py"""
import re, sys
from pathlib import Path

CSS = Path(__file__).resolve().parent.parent / "web" / "style.css"
TEXT = ["fg", "muted", "link", "visited", "red", "accent",
        "buff", "nerf", "new", "rework", "fix", "other", "perf", "econ", "ui", "qol"]
BACKGROUNDS = ["paper", "page", "soft"]
SKINS = ["crier", "iliac", "oblivion", "phosphor", "cassette"]
MIN = 4.5
MIN_TINT = 3.0   # editor token colors on the text selection: brief, and the plain text stays at MIN
EDITOR_TOKENS = ["rework", "buff", "muted", "accent", "new", "fix", "link", "perf", "econ", "red"]   # .t-* in web/editor/editor.css
DARK_ONLY = {"phosphor"}   # themes with one palette, always dark


def lum(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    ch = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    ch = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in ch]
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]


def ratio(a, b):
    hi, lo = sorted([lum(a), lum(b)], reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def mix(a, b, pct):
    """color-mix(in srgb, a pct%, b) as a hex string"""
    def rgb(h):
        h = h.lstrip("#")
        h = "".join(c * 2 for c in h) if len(h) == 3 else h
        return [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return "#" + "".join(f"{round(x * pct / 100 + y * (100 - pct) / 100):02x}" for x, y in zip(rgb(a), rgb(b)))


def editor(v, label):
    """The guide editor (web/editor/editor.css): token colors on its background (the paper) and on its selection tint, and the filled button."""
    bad = 0
    bg = v["paper"]
    sel = mix(v["link"], bg, 16)
    checks = [(f"{t} on editor", v[t], bg, MIN) for t in EDITOR_TOKENS + ["fg"]]
    checks.append(("primary button: paper on accent", v["paper"], v["accent"], MIN))   # Submit, and the main button of a dialog
    hit = mix(v["al-warning"], bg, 24)   # the matches of a search
    checks += [("fg on search match", v["fg"], hit, MIN)] + [(f"{t} on search match", v[t], hit, MIN_TINT) for t in EDITOR_TOKENS]
    line = mix(v["accent"], bg, 8)   # the current line
    checks += [("fg on current line", v["fg"], line, MIN)] + [(f"{t} on current line", v[t], line, MIN) for t in EDITOR_TOKENS]
    checks += [("muted on margin", v["muted"], v["soft"], MIN), ("fg on margin", v["fg"], v["soft"], MIN), ("paper on symbol label", v["paper"], v["accent"], MIN)]   # line numbers, and the names shown for hidden characters
    checks += [("fg on selection", v["fg"], sel, MIN)] + [(f"{t} on selection", v[t], sel, MIN_TINT) for t in EDITOR_TOKENS]
    for what, fg, back, need in checks:
        r = ratio(fg, back)
        if r < need:
            bad += 1
            print(f"FAIL {label}: editor {what} {fg} on {back} = {r:.2f} (need {need})")
    return bad


def colors(body):
    return dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\b", body))


def blocks(css):
    """(skin, mode, via_media) -> colors, from every simple 'selector { body }' rule."""
    out = {}
    for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
        sel = sel.strip()
        m = re.search(r'data-skin="(\w+)"', sel)
        v = re.search(r'data-phosphor="(\w+)"', sel)
        if v:
            out.setdefault(("phosphor-" + v.group(1), "light", False), {}).update(colors(body))
            continue
        skin = m.group(1) if m else "default"
        ac = re.search(r'data-palette="(\w+)"', sel)
        if ac:
            skin = "palette-" + ac.group(1)
        if ':not([data-theme="light"])' in sel:
            key = (skin, "dark", True)
        elif 'data-theme="dark"' in sel:
            key = (skin, "dark", False)
        elif sel in (":root", f'html[data-skin="{skin}"]', f'html[data-skin="{skin}"]:root') or skin.startswith("palette-"):
            key = (skin, "light", False)
        else:
            continue
        out.setdefault(key, {}).update(colors(body))
    return out


def main():
    b = blocks(re.sub(r"/\*.*?\*/", "", CSS.read_text(encoding="utf8"), flags=re.S))
    base = b[("default", "light", False)]
    dark = b[("default", "dark", False)]
    failures = 0

    for skin in ["default"] + SKINS:
        # a skin's dark mode layers: base, default dark, skin light, skin dark
        if skin in DARK_ONLY:
            night = {**base, **dark, **b[(skin, "light", False)]}
            light = night
        elif skin == "default":
            light, night = dict(base), {**base, **dark}
        else:
            light = {**base, **b[(skin, "light", False)]}
            night = {**base, **dark, **b[(skin, "light", False)], **b[(skin, "dark", False)]}
        for mode, v in (("light", light), ("dark", night)):
            failures += editor(v, f"{skin}/{mode}")
            for t in TEXT:
                for bg in BACKGROUNDS:
                    r = ratio(v[t], v[bg])
                    if r < MIN:
                        failures += 1
                        print(f"FAIL {skin}/{mode}: {t} {v[t]} on {bg} {v[bg]} = {r:.2f}")
        # the media-query copy of the dark block must match the data-theme copy
        for key in [(skin, "dark", False)]:
            if key in b and (skin, "dark", True) in b and b[key] != b[(skin, "dark", True)]:
                failures += 1
                diff = {k for k in set(b[key]) | set(b[(skin, "dark", True)])
                        if b[key].get(k) != b[(skin, "dark", True)].get(k)}
                print(f"DRIFT {skin}: dark blocks differ in {', '.join(sorted(diff))}")

    for v in ("parchment", "slate", "moss", "dusk", "terracotta", "graphite"):   # Default colors: whole palettes on the base
        key = "palette-" + v
        for mode, pal in (("light", {**base, **b[(key, "light", False)]}), ("dark", {**base, **dark, **b[(key, "dark", False)]})):
            failures += editor(pal, f"default-{v}/{mode}")
            for t_ in TEXT:
                for bg in BACKGROUNDS:
                    r = ratio(pal[t_], pal[bg])
                    if r < MIN:
                        failures += 1
                        print(f"FAIL default-{v}/{mode}: {t_} {pal[t_]} on {bg} {pal[bg]} = {r:.2f}")
        if b[(key, "dark", False)] != b.get((key, "dark", True)):
            failures += 1
            print(f"DRIFT default-{v}: dark blocks differ")

    for v in ("amber", "blue", "white"):   # Phosphor colors: the green base with a palette swapped in
        pal = {**base, **dark, **b[("phosphor", "light", False)], **b[("phosphor-" + v, "light", False)]}
        failures += editor(pal, f"phosphor-{v}")
        for t_ in TEXT:
            for bg in BACKGROUNDS:
                r = ratio(pal[t_], pal[bg])
                if r < MIN:
                    failures += 1
                    print(f"FAIL phosphor-{v}: {t_} {pal[t_]} on {bg} {pal[bg]} = {r:.2f}")

    print("contrast OK" if not failures else f"{failures} problem(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
