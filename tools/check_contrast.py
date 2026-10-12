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
SKINS = ["parchment", "iliac", "oblivion"]
MIN = 4.5


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


def colors(body):
    return dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\b", body))


def blocks(css):
    """(skin, mode, via_media) -> colors, from every simple 'selector { body }' rule."""
    out = {}
    for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
        sel = sel.strip()
        m = re.search(r'data-skin="(\w+)"', sel)
        skin = m.group(1) if m else "default"
        if ':not([data-theme="light"])' in sel:
            key = (skin, "dark", True)
        elif 'data-theme="dark"' in sel:
            key = (skin, "dark", False)
        elif sel in (":root", f'html[data-skin="{skin}"]'):
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
        if skin == "default":
            light, night = dict(base), {**base, **dark}
        else:
            light = {**base, **b[(skin, "light", False)]}
            night = {**base, **dark, **b[(skin, "light", False)], **b[(skin, "dark", False)]}
        for mode, v in (("light", light), ("dark", night)):
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

    print("contrast OK" if not failures else f"{failures} problem(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
