/* The guide editor: the Format menu's text operations, as plain functions (so they can be tested without a page). P.fmt.command(name, text, start, end) says what a Format command does:
   { plan } replaces text[plan.start, plan.end) with plan.text and selects plan.a..plan.b of the result, or { lines, span } changes the whole lines the selection touches (or span, if given) with lines(list of lines) -> list of lines. */
(function () {
  "use strict";
  var P = window.udfopEditor = window.udfopEditor || {};
  var WORD = /[\p{L}\p{N}_'’]/u;
  function rep(s, n) { return new Array(n + 1).join(s); }

  /* ---- inline marks: bold, italic, code, spoiler, wiki link, key ---- */
  /* One stretch s..e (no blanks at its ends, inside one line) wrapped in, or freed of, a pair of marks. spec: { open, close } or { star: 1 | 2 | 3 } (the stars of italic, bold, bold italic,
     which add to each other: ***x*** is both). Returns { ed: { start, end, text, is, ie }, was } where was says whether the stretch was already marked (ed then takes the marks off) and is..ie is the stretch inside text. */
  function oneStars(v, s, e, k) {
    var L = 0, R = 0, n, inner;
    while (L < 3 && v.charAt(s - 1 - L) === "*") L++;
    while (R < 3 && v.charAt(e + R) === "*") R++;
    n = Math.min(L, R);
    if (!n) {   /* the stars may be inside the selection */
      var sel = v.slice(s, e), m1 = /^\*{1,3}/.exec(sel), m2 = /\*{1,3}$/.exec(sel);
      if (m1 && m2 && sel.length > m1[0].length + m2[0].length) { n = Math.min(m1[0].length, m2[0].length); s += n; e -= n; }
    }
    if (n && v.slice(s, e).indexOf("*") >= 0) n = 0;   /* "*a* and *b*" is two stretches, not one */
    var has = k === 1 ? n === 1 || n === 3 : k === 2 ? n >= 2 : n === 3, delta = has ? -k : k === 3 ? 3 - n : k, m = n + delta;
    inner = v.slice(s, e);
    return { ed: { start: s - n, end: e + n, text: rep("*", m) + inner + rep("*", m), is: m, ie: m + inner.length }, was: has };
  }
  function onePair(v, s, e, open, close) {
    var o = open.length, c = close.length, sel = v.slice(s, e);
    if (sel.length >= o + c && sel.slice(0, o) === open && sel.slice(sel.length - c) === close) { var t = sel.slice(o, sel.length - c); return { ed: { start: s, end: e, text: t, is: 0, ie: t.length }, was: true }; }
    if (s >= o && v.slice(s - o, s) === open && v.slice(e, e + c) === close) return { ed: { start: s - o, end: e + c, text: sel, is: 0, ie: sel.length }, was: true };
    if (open === "`") {   /* code that has backticks in it needs a longer fence, with a space inside so that they are not read as part of it */
      var run = 0; (sel.match(/`+/g) || []).forEach(function (r) { run = Math.max(run, r.length); });
      if (run) { var f = rep("`", run + 1); return { ed: { start: s, end: e, text: f + " " + sel + " " + f, is: f.length + 1, ie: f.length + 1 + sel.length }, was: false }; }
    }
    return { ed: { start: s, end: e, text: open + sel + close, is: o, ie: o + sel.length }, was: false };
  }
  function one(v, s, e, spec) { return spec.star ? oneStars(v, s, e, spec.star) : onePair(v, s, e, spec.open, spec.close); }
  function combine(v, eds) {   /* edits in order, none overlapping, as one replacement */
    var start = eds[0].start, end = eds[eds.length - 1].end, out = "", at = start, a = 0, b = 0;
    eds.forEach(function (d, i) {
      out += v.slice(at, d.start);
      if (i === 0) a = out.length + d.is;
      out += d.text;
      if (i === eds.length - 1) b = out.length - d.text.length + d.ie;
      at = d.end;
    });
    return { start: start, end: end, text: out, a: start + a, b: start + b };
  }
  function wordAround(v, s) {
    var a = s, b = s;
    while (a > 0 && WORD.test(v.charAt(a - 1))) a--;
    while (b < v.length && WORD.test(v.charAt(b))) b++;
    return [a, b];
  }
  /* The selection, line by line (blanks at the ends of each line left out), is wrapped; when every line is already wrapped, unwrapped. Nothing selected: the word at the caret, or an empty pair with the caret inside
     (or, with the caret inside an empty pair, the pair removed). */
  function inline(v, s, e, spec) {
    if (e === s) {
      var mark = spec.star ? rep("*", spec.star) : spec.open, mc = spec.star ? mark : spec.close, o = mark.length, c = mc.length;
      if (s >= o && v.slice(s - o, s) === mark && v.slice(s, s + c) === mc && !(spec.star && (v.charAt(s - o - 1) === "*" || v.charAt(s + c) === "*")))
        return { start: s - o, end: s + c, text: "", a: s - o, b: s - o };
      var w = wordAround(v, s);
      if (w[1] > w[0]) {
        var p = inline(v, w[0], w[1], spec), at = p.a + (s - w[0]);
        return { start: p.start, end: p.end, text: p.text, a: at, b: at };
      }
      return { start: s, end: s, text: mark + mc, a: s + o, b: s + o };
    }
    var segs = [], at2 = s, nl, end, a, b;
    for (;;) {
      nl = v.indexOf("\n", at2); end = nl < 0 || nl > e ? e : nl; a = at2; b = end;
      while (a < b && /[ \t]/.test(v.charAt(a))) a++;
      while (b > a && /[ \t]/.test(v.charAt(b - 1))) b--;
      if (b > a) segs.push([a, b]);
      if (end >= e) break;
      at2 = end + 1;
    }
    if (!segs.length) return null;
    var tries = segs.map(function (g) { return one(v, g[0], g[1], spec); }), all = tries.every(function (t) { return t.was; });
    var eds = (all ? tries : tries.filter(function (t) { return !t.was; })).map(function (t) { return t.ed; });
    return combine(v, eds);
  }
  var SPEC = {
    bold: { star: 2 }, italic: { star: 1 }, bolditalic: { star: 3 }, code: { open: "`", close: "`" }, spoiler: { open: ">!", close: "!<" },
    wiki: { open: "[[", close: "]]" }, key: { open: "{{", close: "}}" }
  };

  /* [text](url): the selection (or the word at the caret) is the text and the address is selected to be typed; a selected address becomes the address and the text is selected */
  function link(v, s, e) {
    if (e === s) { var w = wordAround(v, s); s = w[0]; e = w[1]; }
    var sel = v.slice(s, e);
    if (/^(https?:\/\/|www\.)\S+$/i.test(sel)) return { start: s, end: e, text: "[link text](" + sel + ")", a: s + 1, b: s + 10 };
    var t = sel || "link text", text = "[" + t + "](url)";
    if (!sel) return { start: s, end: e, text: text, a: s + 1, b: s + 1 + t.length };
    return { start: s, end: e, text: text, a: s + 3 + t.length, b: s + 6 + t.length };
  }
  /* takes the marks off the selection (or the line the caret is on): bold, italic, code, spoilers, keys, wiki links (keeping the shown text) and links and pictures (keeping the text) */
  function strip(t) {
    return t.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, function (m, x, l) { return l || x; }).replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\{\{([^}]+)\}\}/g, "$1")
      .replace(/>!(.+?)!</g, "$1").replace(/(`+) ?([^`]+?) ?\1/g, "$2").replace(/(\*{1,3})([^*\n]+)\1/g, "$2");
  }
  function lineBounds(v, pos) { var nl = v.indexOf("\n", pos); return [pos === 0 ? 0 : v.lastIndexOf("\n", pos - 1) + 1, nl < 0 ? v.length : nl]; }
  function clear(v, s, e) {
    if (e === s) { var b = lineBounds(v, s); s = b[0]; e = b[1]; }
    var old = v.slice(s, e), t = strip(old);
    if (t === old) return null;
    return { start: s, end: e, text: t, a: s, b: s + t.length };
  }
  /* the whole lines the selection touches (one that ends at the start of a line leaves that line out) */
  function wholeLines(v, s, e) {
    var last = e > s && v.charAt(e - 1) === "\n" ? e - 1 : e;
    return [lineBounds(v, s)[0], lineBounds(v, last)[1]];
  }

  /* ---- blocks: headings, lists, quotes, callouts ---- */
  /* a line as { q: the quote marks in front, ind: indentation, kind: blank, h, ul, ol or p, mark, level, body } */
  function parse(l) {
    var q = /^(?:\s*>[ \t]?)*/.exec(l)[0], rest = l.slice(q.length), ind = /^[ \t]*/.exec(rest)[0], body = rest.slice(ind.length), m;
    if (!/\S/.test(l.replace(/>/g, ""))) return { q: q, ind: "", kind: "blank", body: "" };
    if ((m = /^(#{1,6})[ \t]+(.*)$/.exec(body))) return { q: q, ind: ind, kind: "h", level: m[1].length, body: m[2] };
    if ((m = /^[-*+][ \t]+(.*)$/.exec(body))) return { q: q, ind: ind, kind: "ul", body: m[1] };
    if ((m = /^\d+[.)][ \t]+(.*)$/.exec(body))) return { q: q, ind: ind, kind: "ol", body: m[1] };
    return { q: q, ind: ind, kind: "p", body: body };
  }
  function mapLines(lines, fn, mark) {   /* fn(parsed line) for each line that has something on it; a single empty line gets just the mark */
    if (mark && lines.length === 1 && !/\S/.test(lines[0])) return [lines[0] + mark];
    var ps = lines.map(parse); return lines.map(function (l, i) { return ps[i].kind === "blank" ? l : fn(ps[i], i, ps); }); }
  function heading(n) {
    return function (lines) {
      var ps = lines.map(parse), off = ps.every(function (p) { return p.kind === "blank" || (p.kind === "h" && p.level === n); });
      return mapLines(lines, function (p) { return off ? p.q + p.body : p.q + rep("#", n) + " " + p.body; }, rep("#", n) + " ");
    };
  }
  function paragraph(lines) { return mapLines(lines, function (p) { return p.kind === "p" ? p.q + p.ind + p.body : p.q + p.body; }); }
  function bullet(lines) {
    var ps = lines.map(parse), off = ps.every(function (p) { return p.kind === "blank" || p.kind === "ul"; });
    return mapLines(lines, function (p) { return off ? p.q + p.ind + p.body : p.q + (p.kind === "h" ? "" : p.ind) + "- " + p.body; }, "- ");
  }
  function numbered(lines) {
    var ps = lines.map(parse), off = ps.every(function (p) { return p.kind === "blank" || p.kind === "ol"; }), n = 0;
    return mapLines(lines, function (p) { return off ? p.q + p.ind + p.body : p.q + (p.kind === "h" ? "" : p.ind) + (++n) + ". " + p.body; }, "1. ");
  }
  function unquote(l) { return l.replace(/^(\s*)>[ \t]?/, "$1"); }
  function quote(lines) {
    var off = lines.every(function (l) { return !/\S/.test(l) || /^\s*>/.test(l); }) && lines.some(function (l) { return /\S/.test(l); });
    return lines.map(function (l) { return off ? unquote(l) : /\S/.test(l) ? "> " + l : lines.length === 1 ? "> " : ">"; });
  }
  var HEAD = /^(\s*>[ \t]?)\[!([A-Za-z]+)\][ \t]*(.*)$/;
  /* a quote whose first line is [!TYPE]: same type again takes the box off, another type changes it, and lines that are not a box become one */
  function callout(type) {
    return function (lines) {
      var m = HEAD.exec(lines[0]);
      if (m) {
        if (m[2].toUpperCase() === type) return removeCallout(lines);
        var out = lines.slice(); out[0] = m[1] + "[!" + type + "]" + (m[3] ? " " + m[3] : ""); return out;
      }
      var quoted = lines.every(function (l) { return /^\s*>/.test(l) || !/\S/.test(l) && lines.length > 1; }) && lines.some(function (l) { return /\S/.test(l); });
      return ["> [!" + type + "]"].concat(lines.map(function (l) { return quoted || /^\s*>/.test(l) ? l : /\S/.test(l) ? "> " + l : lines.length === 1 ? "> " : ">"; }));
    };
  }
  function removeCallout(lines) {
    var m = HEAD.exec(lines[0]);
    if (!m) return lines.slice();
    var rest = lines.slice(1).map(unquote);
    if (m[3]) rest.unshift(unquote(m[1]) + m[3]);
    return rest.length ? rest : [""];
  }
  /* the lines of the whole quote (a box, or a plain quote that becomes one) when the selection is inside one; null when it is not */
  function calloutSpan(v, s, e) {
    var b = wholeLines(v, s, e), top = b[0], bottom = b[1], prev, next;
    if (!/^\s*>/.test(v.slice(top, lineBounds(v, top)[1]))) return null;
    while (top > 0) { prev = lineBounds(v, top - 1); if (/^\s*>/.test(v.slice(prev[0], prev[1]))) top = prev[0]; else break; }
    while (bottom < v.length) { next = lineBounds(v, bottom + 1); if (next[0] > bottom && /^\s*>/.test(v.slice(next[0], next[1]))) bottom = next[1]; else break; }
    return { start: top, end: bottom };
  }

  /* ---- code block, rule and snippets ---- */
  var FENCE = /^\s*(`{3,}|~{3,})/;
  /* lang: the language written after the opening fence ("" for none). Lines in a box of another language change its language (Plain Text removes it); lines in a box of the same language leave it. */
  function codeBlock(v, s, e, lang) {
    lang = lang || "";
    var b = wholeLines(v, s, e), body = v.slice(b[0], b[1]), ls = body.split("\n"), pv, nx, open = null, close = null;
    if (ls.length >= 2 && FENCE.test(ls[0]) && FENCE.test(ls[ls.length - 1])) open = [b[0], b[0] + ls[0].length];   /* the box itself is selected */
    else if (b[0] > 0 && b[1] < v.length) {   /* the lines sit between a pair of fence lines */
      pv = lineBounds(v, b[0] - 1); nx = lineBounds(v, b[1] + 1);
      if (FENCE.test(v.slice(pv[0], pv[1])) && FENCE.test(v.slice(nx[0], nx[1]))) { open = pv; close = nx; }
    }
    if (open) {
      var line = v.slice(open[0], open[1]), head = FENCE.exec(line)[0], cur = line.slice(head.length).trim().split(/\s+/)[0].toLowerCase();
      if (cur !== lang.toLowerCase()) {   /* another language (or none): only the opening line changes */
        var text = head + lang, delta = text.length - (open[1] - open[0]), mv = function (p) { return p >= open[1] ? p + delta : Math.min(p, open[0] + text.length); };
        return { start: open[0], end: open[1], text: text, a: mv(s), b: mv(e) };
      }
      if (!close) { var inner = ls.slice(1, -1).join("\n"); return { start: b[0], end: b[1], text: inner, a: b[0], b: b[0] + inner.length }; }
      return { start: open[0], end: close[1], text: body, a: open[0], b: open[0] + body.length };
    }
    var fence = "```"; while (body.indexOf(fence) >= 0) fence += "`";
    var top = fence + lang + "\n";
    if (!/\S/.test(body)) return { start: b[0], end: b[1], text: top + "\n" + fence, a: b[0] + top.length, b: b[0] + top.length };
    return { start: b[0], end: b[1], text: top + body + "\n" + fence, a: b[0] + top.length, b: b[0] + top.length + body.length };
  }
  /* a block of text on lines of its own, with a blank line before and after it; where an empty line (or one with only blanks) is selected or has the caret, it takes that line's place.
     sel is the stretch of the block to select (offsets in block) */
  function insertBlock(v, s, e, block, sel) {
    var ls = lineBounds(v, s)[0], le = lineBounds(v, e)[1], whole = !/\S/.test(v.slice(ls, s)) && !/\S/.test(v.slice(e, le));
    var start = whole ? ls : s, end = whole ? le : e, pre = v.slice(0, start), post = v.slice(end);
    var before = pre === "" || /\n\n$/.test(pre) ? "" : /\n$/.test(pre) ? "\n" : "\n\n", after = post === "" || /^\n\n/.test(post) ? "" : /^\n/.test(post) ? "\n" : "\n\n";
    var at = start + before.length;
    return { start: start, end: end, text: before + block + after, a: at + sel[0], b: at + sel[1] };
  }
  function hasFrontMatter(v) { return /^---[ \t]*(\n|$)/.test(v); }
  function table(cols, rows) {
    var head = [], bar = [], cell = [], i, out;
    for (i = 0; i < cols; i++) { head.push("Heading"); bar.push("---"); cell.push("Text"); }
    out = ["| " + head.join(" | ") + " |", "| " + bar.join(" | ") + " |"];
    for (i = 0; i < rows; i++) out.push("| " + cell.join(" | ") + " |");
    return out.join("\n");
  }
  function snippet(name, v, s, e) {
    var sel = v.slice(s, e);
    if (name === "table2") return insertBlock(v, e, e, table(2, 2), [2, 9]);
    if (name === "table3") return insertBlock(v, e, e, table(3, 3), [2, 9]);
    if (name === "keyvalue") return insertBlock(v, e, e, "|     |       |\n| ---{label} | ----- |\n| Key | Value |\n| Key | Value |", [34, 37]);
    if (name === "spoiler") return insertBlock(v, e, e, ">!Hidden text!<", [2, 13]);
    if (name === "infobox") return insertBlock(v, e, e, "> [!INFO] Title\n> image: images/name.png\n> ## Group\n> Key: Value\n> Key: Value", [10, 15]);
    if (name === "image") {
      var alt = sel.indexOf("\n") < 0 && sel ? sel : "alt text", text = "![" + alt + "](images/name.png)";
      return { start: s, end: e, text: text, a: s + 4 + alt.length, b: s + 4 + alt.length + 15 };
    }
    if (name === "footnote") {   /* a reference where the caret is and its note as the last line of the page, with the note text selected */
      var n = 1; while (v.indexOf("[^note" + n + "]") >= 0) n++;
      var id = "note" + n, tail = v.slice(e).replace(/\s+$/, ""), note = "[^" + id + "]: ", body = "[^" + id + "]" + tail + "\n\n" + note + "Note text", at = s + body.length - 9;
      return { start: s, end: v.length, text: body, a: at, b: at + 9 };
    }
    if (name === "front") return hasFrontMatter(v) ? null : { start: 0, end: 0, text: "---\ntitle: \ncategory: \nsummary: \nauthors: \n---\n\n", a: 11, b: 11 };
    return null;
  }

  /* ---- tables: a row is a line that starts with | ---- */
  var ROW = /^\s*\|/;
  /* the cells of a row: [{ from, to, text }] where from..to is the cell's own text in the line (an empty cell: the place a caret goes), and the places of the pipes */
  function cellSpans(line) {
    var bounds = [], i, spans = [], end = line.search(/\s*$/);
    for (i = 0; i < line.length; i++) if (line.charAt(i) === "|" && line.charAt(i - 1) !== "\\") bounds.push(i);
    var cuts = bounds.slice(); if (!bounds.length || bounds[bounds.length - 1] !== end - 1) cuts.push(end);
    for (i = 0; i + 1 < cuts.length; i++) {
      var a = cuts[i] + 1, b = cuts[i + 1], f = a, t = b;
      while (f < t && /\s/.test(line.charAt(f))) f++;
      while (t > f && /\s/.test(line.charAt(t - 1))) t--;
      if (t === f) f = t = Math.min(a + (b - a > 1 ? 1 : 0), b);
      spans.push({ a: a, b: b, from: f, to: t, text: line.slice(f, t) });
    }
    return spans;
  }
  var TAG = /\{[a-z ,]*\}$/;   /* a divider cell may end in {tags}: a column type (num, pct, dur, date, bool, text) and label (the row-label column) */
  function splitTag(t) { var m = TAG.exec(t); return m ? { core: t.slice(0, m.index), tag: m[0] } : { core: t, tag: "" }; }
  function isSeparator(cells) { return cells.length > 0 && cells.every(function (c) { return /^:?-+:?(\{[a-z ,]*\})?$/.test(c.text); }); }
  /* the rows around pos: { start, end (of the text), lines, row (index of pos's line) } or null when pos is not on a row */
  function tableAt(v, pos) {
    var b = lineBounds(v, pos), top = b[0], bottom = b[1];
    if (!ROW.test(v.slice(top, bottom))) return null;
    var p;
    while (top > 0) { p = lineBounds(v, top - 1); if (ROW.test(v.slice(p[0], p[1]))) top = p[0]; else break; }
    while (bottom < v.length) { p = lineBounds(v, bottom + 1); if (p[0] > bottom && ROW.test(v.slice(p[0], p[1]))) bottom = p[1]; else break; }
    var lines = v.slice(top, bottom).split("\n");
    return { start: top, end: bottom, lines: lines, row: v.slice(top, b[0]).split("\n").length - 1 };
  }
  /* the rows set out in columns of equal width; extra: rows (arrays of cell texts) to add after row index `after`. Returns { text, at: function (row, cell) -> [from, to] in text } */
  function setOut(lines, extra, after) {
    var rows = lines.map(function (l) { var sp = cellSpans(l); return { cells: sp.map(function (c) { return c.text; }), sep: isSeparator(sp), al: sp.map(function (c) { var t = splitTag(c.text).core; return t.charAt(0) === ":" ? (t.slice(-1) === ":" ? "c" : "l") : t.slice(-1) === ":" ? "r" : ""; }), tg: sp.map(function (c) { return splitTag(c.text).tag; }) }; });
    if (extra) rows.splice.apply(rows, [after + 1, 0].concat(extra.map(function (c) { return { cells: c, sep: isSeparator(c.map(function (x) { return { text: x }; })), al: [], tg: [] }; })));
    var n = 0, w = [], i, j;
    rows.forEach(function (r) { n = Math.max(n, r.cells.length); });
    for (j = 0; j < n; j++) w[j] = 3;
    var bar0 = rows.filter(function (r) { return r.sep; })[0] || { al: [], tg: [] }, al = bar0.al, tg = bar0.tg, offs = [];
    rows.forEach(function (r) { if (!r.sep) r.cells.forEach(function (c, k) { w[k] = Math.max(w[k], c.length); }); });
    for (j = 0; j < n; j++) w[j] = Math.max(w[j], 3 + (tg[j] || "").length);
    var out = rows.map(function (r) {
      var cells = [], at = 2, o = [];
      for (j = 0; j < n; j++) {
        var t = r.cells[j] || "", a = al[j] || "", g = tg[j] || "", d = w[j] - g.length;
        if (r.sep) t = (a === "c" ? ":" + rep("-", d - 2) + ":" : a === "l" ? ":" + rep("-", d - 1) : a === "r" ? rep("-", d - 1) + ":" : rep("-", d)) + g;
        o.push([at, at + t.length]); cells.push(t + rep(" ", w[j] - t.length)); at += w[j] + 3;
      }
      offs.push(o);
      return "| " + cells.join(" | ") + " |";
    });
    var starts = []; out.reduce(function (p, l) { starts.push(p); return p + l.length + 1; }, 0);
    return { text: out.join("\n"), rows: rows.length, cols: n, at: function (r, c) { var o = offs[r][c]; return [starts[r] + o[0], starts[r] + o[1]]; }, sep: rows.map(function (r) { return r.sep; }) };
  }
  /* which cell of the row has the caret (col is the column in the line) */
  function cellAt(line, col) {
    var sp = cellSpans(line), k;
    for (k = 0; k < sp.length; k++) if (col <= sp[k].b) return k;
    return Math.max(0, sp.length - 1);
  }
  function alignTable(v, s) {
    var t = tableAt(v, s); if (!t) return null;
    var line = t.lines[t.row], col = s - (t.start + t.lines.slice(0, t.row).join("\n").length + (t.row ? 1 : 0)), c = cellAt(line, col), sp = cellSpans(line)[c], so = setOut(t.lines);
    var off = sp ? Math.max(0, Math.min(col, sp.to) - sp.from) : 0, pos = so.at(t.row, Math.min(c, so.cols - 1)), at = Math.min(pos[0] + off, pos[1]);
    return { start: t.start, end: t.end, text: so.text, a: t.start + at, b: t.start + at };
  }
  /* the column under the caret gets (or loses) a tag in the divider row: kind is a type (num, pct, dur, date, bool, text), "auto" to clear the type, or "label" to toggle the row-label column (the first column only) */
  var COLUMN_TYPES = ["num", "pct", "dur", "date", "bool", "text"];
  function columnTag(v, s, kind) {
    var t = tableAt(v, s); if (!t) return null;
    var bar = -1, i, line = t.lines[t.row], col = s - (t.start + t.lines.slice(0, t.row).join("\n").length + (t.row ? 1 : 0)), c = cellAt(line, col);
    for (i = 0; i < t.lines.length; i++) if (isSeparator(cellSpans(t.lines[i]))) { bar = i; break; }
    if (bar < 0) return null;
    var sp = cellSpans(t.lines[bar])[c]; if (!sp) return null;
    if (kind === "label" && c !== 0) return null;
    var parts = splitTag(sp.text), words = parts.tag ? parts.tag.slice(1, -1).split(/[\s,]+/).filter(Boolean) : [];
    if (kind === "label") { var at = words.indexOf("label"); if (at >= 0) words.splice(at, 1); else words.unshift("label"); }
    else words = words.filter(function (x) { return COLUMN_TYPES.indexOf(x) < 0; }).concat(kind === "auto" ? [] : [kind]);
    var text = parts.core + (words.length ? "{" + words.join(",") + "}" : ""), lines = t.lines.slice();
    lines[bar] = t.lines[bar].slice(0, sp.from) + text + t.lines[bar].slice(sp.to);
    var so = setOut(lines), pos = so.at(t.row, Math.min(c, so.cols - 1));
    return { start: t.start, end: t.end, text: so.text, a: t.start + pos[0], b: t.start + pos[0] };
  }
  /* Tab (or, with back, Shift+Tab) in a table: the table is set out in columns and the next (previous) cell is selected; after the last cell a new row is added. Null where it is not a row, or before the first cell. */
  function tableTab(v, s, back) {
    var t = tableAt(v, s); if (!t) return null;
    var line = t.lines[t.row], col = s - (t.start + t.lines.slice(0, t.row).join("\n").length + (t.row ? 1 : 0)), c = cellAt(line, col), probe = setOut(t.lines), r = t.row, cols = probe.cols, extra = null;
    if (back) { c--; if (c < 0) { r--; while (r >= 0 && probe.sep[r]) r--; if (r < 0) return null; c = cols - 1; } }
    else {
      c++;
      if (c >= cols) { c = 0; r++; while (r < probe.rows && probe.sep[r]) r++; if (r >= probe.rows) { var blank = []; for (var j = 0; j < cols; j++) blank.push(""); extra = [blank]; r = probe.rows; } }
    }
    var so = extra ? setOut(t.lines, extra, t.lines.length - 1) : probe, pos = so.at(r, c);
    return { start: t.start, end: t.end, text: so.text, a: t.start + pos[0], b: t.start + pos[1] };
  }
  /* Enter in a table: a new row below the current one (below the divider when it is the heading row), and Enter in an empty last row ends the table */
  function tableEnter(v, s) {
    var t = tableAt(v, s); if (!t) return null;
    var so = setOut(t.lines), r = t.row, line = t.lines[r], sp = cellSpans(line), empty = sp.every(function (x) { return x.text === ""; });
    if (empty && r === t.lines.length - 1 && r > 0 && !so.sep[r]) {
      var keep = setOut(t.lines.slice(0, r)), text = keep.text + "\n\n";
      return { start: t.start, end: t.end, text: text, a: t.start + text.length, b: t.start + text.length };
    }
    var after = r, blank = [], bar = [], j;
    if (so.sep[r + 1] && r + 1 < so.rows) after = r + 1;
    for (j = 0; j < so.cols; j++) { blank.push(""); bar.push("---"); }
    var head = r === 0 && !so.sep[1] && !so.sep[0];   /* a first row with no divider under it is the heading row: the divider is added too */
    var out = setOut(t.lines, head ? [bar, blank] : [blank], after), pos = out.at(after + (head ? 2 : 1), 0);
    return { start: t.start, end: t.end, text: out.text, a: t.start + pos[0], b: t.start + pos[0] };
  }

  var TYPES = ["note", "tip", "important", "warning", "caution"];
  function command(name, v, s, e) {
    var q = name.split("."), k = q[0];
    if (SPEC[k]) return { plan: inline(v, s, e, SPEC[k]) };
    if (k === "link") return { plan: link(v, s, e) };
    if (k === "clear") return { plan: clear(v, s, e) };
    if (k === "h" && /^[1-6]$/.test(q[1])) return { lines: heading(+q[1]) };
    if (k === "p") return { lines: paragraph };
    if (k === "ul") return { lines: bullet };
    if (k === "ol") return { lines: numbered };
    if (k === "quote") return { lines: quote };
    if (k === "callout") {
      var span = calloutSpan(v, s, e);
      if (q[1] === "remove") return { lines: removeCallout, span: span };
      if (TYPES.indexOf(q[1]) >= 0) return { lines: callout(q[1].toUpperCase()), span: span };
      return null;
    }
    if (k === "table" && q[1] === "align") return { plan: alignTable(v, s) };
    if (k === "table" && q[1] === "col" && (q[2] === "label" || q[2] === "auto" || COLUMN_TYPES.indexOf(q[2]) >= 0)) return { plan: columnTag(v, s, q[2]) };
    if (k === "codeblock") return { plan: codeBlock(v, s, e, q[1]) };
    if (k === "hr") return { plan: insertBlock(v, e, e, "---", [3, 3]) };
    if (k === "snip") return { plan: snippet(q[1], v, s, e) };
    return null;
  }
  P.fmt = { command: command, inline: inline, SPEC: SPEC, link: link, strip: strip, clear: clear, heading: heading, paragraph: paragraph, bullet: bullet, numbered: numbered, quote: quote, callout: callout, removeCallout: removeCallout,
    calloutSpan: calloutSpan, codeBlock: codeBlock, alignTable: alignTable, columnTag: columnTag, tableTab: tableTab, tableEnter: tableEnter, tableAt: tableAt, cellSpans: cellSpans, lineBounds: lineBounds, FENCE: FENCE, parse: parse, insertBlock: insertBlock, snippet: snippet, hasFrontMatter: hasFrontMatter, TYPES: TYPES };
})();
