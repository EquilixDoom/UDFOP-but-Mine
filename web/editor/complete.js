/* The guide editor: what the editor finishes for the writer, as plain functions (so they can be tested without a page): closing brackets and marks as they are typed, what Enter and Tab do inside lists,
   quotes, tables and code boxes, and the lists of names offered after [[, {{, ](, > [! and in the front matter. A change is a plan { start, end, text, a, b }: replace text[start, end) with text and select a..b
   (format.js has the same form). A function that has nothing to do returns null, and the key then does what it always did. */
(function () {
  "use strict";
  var P = window.udfopEditor = window.udfopEditor || {};
  var WORD = /[\p{L}\p{N}_'’]/u, FENCE_LINE = /^\s*(`{3,}|~{3,})/;
  function isWord(c) { return !!c && WORD.test(c); }
  function lineStart(v, pos) { return pos === 0 ? 0 : v.lastIndexOf("\n", pos - 1) + 1; }
  function lineEnd(v, pos) { var n = v.indexOf("\n", pos); return n < 0 ? v.length : n; }
  function move(s, n) { return { start: s, end: s, text: "", a: s + n, b: s + n }; }

  /* the code fence that is open at the start of the line that begins at ls: { ch, len }, or null */
  function openFence(v, ls) {
    var open = null, at = 0, nl, m;
    while (at < ls) {
      nl = v.indexOf("\n", at);
      m = FENCE_LINE.exec(v.slice(at, nl < 0 || nl > ls ? ls : nl));
      if (m) {
        if (!open) open = { ch: m[1].charAt(0), len: m[1].length };
        else if (m[1].charAt(0) === open.ch && m[1].length >= open.len && !/\S/.test(v.slice(at, nl < 0 ? ls : nl).replace(FENCE_LINE, ""))) open = null;
      }
      if (nl < 0) break;
      at = nl + 1;
    }
    return open;
  }
  /* is the line that begins at ls inside the front matter (between the two --- lines at the top)? */
  function inFront(v, ls) {
    if (ls === 0 || !/^---[ \t]*(\n|$)/.test(v)) return false;
    var at = v.indexOf("\n") + 1, nl;
    while (at < ls) { nl = v.indexOf("\n", at); if (/^---\s*$/.test(v.slice(at, nl < 0 ? v.length : nl))) return false; if (nl < 0) break; at = nl + 1; }
    return true;
  }

  /* ---- typing ---- */
  var WRAP = { "*": "*", "`": "`", "[": "]", "(": ")", "{": "}" };
  /* ch was typed at the selection s..e. With text selected, * ` [ ( { put marks around it (so [ twice makes a wiki link, * twice bold). With a caret, an opener adds its closer, and typing a closer that is already there steps over it. */
  function typed(v, s, e, ch) {
    var ls = lineStart(v, s);
    if (openFence(v, ls) || FENCE_LINE.test(v.slice(ls, lineEnd(v, s)))) return null;
    if (e > s) return WRAP.hasOwnProperty(ch) ? { start: s, end: e, text: ch + v.slice(s, e) + WRAP[ch], a: s + 1, b: e + 1 } : null;
    var prev = v.charAt(s - 1), next = v.charAt(s), before = v.slice(ls, s), blankPrev = !prev || /\s/.test(prev);
    function pair(open, close) { return { start: s, end: s, text: open + close, a: s + open.length, b: s + open.length }; }
    if (ch === ")" || ch === "]" || ch === "}") return next === ch ? move(s, 1) : null;
    if (ch === "`") {
      if (next === "`" && prev !== "`") return move(s, 1);
      return prev === "`" || isWord(prev) || isWord(next) || next === "`" ? null : pair("`", "`");
    }
    if (ch === "*") {
      if (next === "*" && !blankPrev) return move(s, 1);
      if (!/\S/.test(before) || isWord(next) || next === "*" || prev === "*") return null;   /* a bullet at the start of a line, or the middle of a word */
      return blankPrev || /[(\[{>"']/.test(prev) ? pair("*", "*") : null;
    }
    if (ch === "(" || ch === "[" || ch === "{") return isWord(next) ? null : pair(ch, ch === "(" ? ")" : ch === "[" ? "]" : "}");
    if (ch === "!") {
      if (v.slice(s, s + 2) === "!<") return move(s, 2);
      if (prev === ">" && (s - 1 === ls || /\s/.test(v.charAt(s - 2))) && !isWord(next)) return { start: s, end: s, text: "!!<", a: s + 1, b: s + 1 };   /* >! opens a spoiler */
    }
    return null;
  }
  var PAIRS = { "(": ")", "[": "]", "{": "}", "`": "`", "*": "*" };
  /* Backspace between the two halves of an empty pair removes both */
  function backspace(v, s, e) {
    if (e !== s || s === 0 || openFence(v, lineStart(v, s))) return null;
    if (v.slice(s - 2, s) === ">!" && v.slice(s, s + 2) === "!<") return { start: s - 2, end: s + 2, text: "", a: s - 2, b: s - 2 };
    var prev = v.charAt(s - 1);
    return PAIRS.hasOwnProperty(prev) && v.charAt(s) === PAIRS[prev] ? { start: s - 1, end: s + 1, text: "", a: s - 1, b: s - 1 } : null;
  }

  /* ---- Enter and Tab ---- */
  var LIST = /^((?:\s*>[ \t]?)*)([ \t]*)(?:([-*+])|(\d+)([.)]))([ \t]+)/, QUOTE = /^((?:\s*>[ \t]?)+)/;
  function enter(v, s, e) {
    if (e !== s) return null;
    var ls = lineStart(v, s), le = lineEnd(v, s), line = v.slice(ls, le), after = v.slice(s, le), fence = openFence(v, ls), m, indent, text;
    if (fence) {   /* in a code box a new line keeps the indentation */
      if (FENCE_LINE.test(line)) return null;
      indent = /^[ \t]*/.exec(line)[0].slice(0, s - ls);
      return indent ? { start: s, end: s, text: "\n" + indent, a: s + 1 + indent.length, b: s + 1 + indent.length } : null;
    }
    if ((m = FENCE_LINE.exec(line))) {   /* an opening fence: add the closing one, unless a fence further down already closes it */
      if (/\S/.test(after)) return null;
      var n = 0, at = le + 1, nl;
      while (at <= v.length && at > 0) { nl = v.indexOf("\n", at); if (FENCE_LINE.test(v.slice(at, nl < 0 ? v.length : nl))) n++; if (nl < 0) break; at = nl + 1; }
      if (n % 2 === 1) return null;
      indent = /^[ \t]*/.exec(line)[0];
      text = "\n" + indent + "\n" + indent + m[1];
      return { start: s, end: le, text: text, a: s + 1 + indent.length, b: s + 1 + indent.length };
    }
    if (inFront(v, ls)) return null;
    if (/^\s*\|/.test(line) && s > ls) return P.fmt.tableEnter(v, s);
    if ((m = LIST.exec(line)) && s - ls >= m[0].length) {
      if (!/\S/.test(line.slice(m[0].length))) {   /* an empty item ends the list (and keeps a quote it is in) */
        return { start: ls, end: le, text: m[1], a: ls + m[1].length, b: ls + m[1].length };
      }
      var mark = m[3] || (parseInt(m[4], 10) + 1) + m[5];
      text = "\n" + m[1] + m[2] + mark + m[6];
      return { start: s, end: s, text: text, a: s + text.length, b: s + text.length };
    }
    if ((m = QUOTE.exec(line)) && s - ls >= m[0].length) {
      if (!/\S/.test(line.slice(m[0].length))) return { start: ls, end: le, text: "", a: ls, b: ls };   /* an empty quote line ends the quote */
      text = "\n" + m[1].replace(/[ \t]*$/, " ");
      return { start: s, end: s, text: text, a: s + text.length, b: s + text.length };
    }
    return null;
  }
  /* Tab (back: Shift+Tab) in a table row goes to the next (previous) cell, setting the table out in columns; after the last cell it adds a row */
  function tab(v, s, e, back) {
    if (e > s && v.slice(s, e).indexOf("\n") >= 0) return null;
    if (openFence(v, lineStart(v, s))) return null;
    return P.fmt.tableTab(v, s, back);
  }

  /* ---- what is offered ---- */
  var KEYS = ["Enter", "Esc", "Tab", "Space", "Backspace", "Delete", "Insert", "Home", "End", "PgUp", "PgDn", "Up", "Down", "Left", "Right", "Shift", "Left Shift", "Right Shift", "Ctrl", "Left Ctrl", "Right Ctrl", "Alt", "Caps Lock",
    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Left click", "Right click", "Middle click", "Scroll up", "Scroll down", "Mouse 4", "Mouse 5",
    "Pad:A", "Pad:B", "Pad:X", "Pad:Y", "Pad:LB", "Pad:RB", "Pad:LT", "Pad:RT", "Pad:L1", "Pad:R1", "Pad:L2", "Pad:R2", "Pad:L3", "Pad:R3", "Pad:LSB", "Pad:RSB", "Pad:Start", "Pad:Select"];
  var CALLOUTS = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION", "INFO"];
  var FIELDS = [["title", "the page title"], ["category", "the group it is listed under"], ["summary", "one sentence for previews and lists"], ["related", "pages and topics to link at the end"], ["unlisted", "true keeps it out of the lists"], ["authors", "people to credit who are not in the page history"]];
  /* what the writer is typing at caret s: { kind, from, query } (the text from..s is replaced when an item is chosen), or null */
  function context(v, s) {
    var ls = lineStart(v, s), le = lineEnd(v, s), line = v.slice(ls, le), before = line.slice(0, s - ls), m;
    if (openFence(v, ls) || FENCE_LINE.test(line)) return null;
    if (inFront(v, ls)) {
      if ((m = /^category:[ \t]*(.*)$/i.exec(before))) return { kind: "category", from: s - m[1].length, query: m[1] };
      if ((m = /^related:[ \t]*(.*)$/i.exec(before))) { var seg = /[^,]*$/.exec(m[1])[0].replace(/^\s+/, ""); return { kind: "related", from: s - seg.length, query: seg }; }
      if ((m = /^([A-Za-z]+)$/.exec(before)) && s === le) return { kind: "field", from: s - m[1].length, query: m[1] };
      return null;
    }
    if ((m = /\[\[([^\[\]|#\n]+)#([^\[\]|\n]*)$/.exec(before))) return { kind: "heading", page: m[1], from: s - m[2].length, query: m[2] };
    if ((m = /\[\[([^\[\]|#\n]*)$/.exec(before))) return { kind: "page", from: s - m[1].length, query: m[1] };
    if ((m = /\[\^([^\[\]\s]*)$/.exec(before))) {   /* [^ : the footnotes defined on the page */
      var ids = [], fr = /^\[\^([^\]\s]+)\]:/gm, fm;
      while ((fm = fr.exec(v)) && !openFence(v, fm.index)) if (ids.indexOf(fm[1]) < 0) ids.push(fm[1]);
      return { kind: "footnote", from: s - m[1].length, query: m[1], ids: ids };
    }
    if ((m = /\{\{([^{}\n]*)$/.exec(before))) { var q = m[1].slice(m[1].lastIndexOf("+") + 1).replace(/^\s+/, ""); return { kind: "key", from: s - q.length, query: q }; }
    if ((m = /^\s*>[ \t]*\[!([A-Za-z]*)$/.exec(before))) return { kind: "callout", from: s - m[1].length, query: m[1] };
    if ((m = /!\[[^\]\n]*\]\(([^)\s]*)$/.exec(before))) return { kind: "image", from: s - m[1].length, query: m[1], paren: true };
    if ((m = /^\s*>?\s*image:[ \t]*(\S*)$/i.exec(before))) return { kind: "image", from: s - m[1].length, query: m[1] };
    return null;
  }
  /* 0 the label starts with the query, 1 a word in it does, 2 it is somewhere inside, -1 not at all */
  function rank(label, q) {
    var l = label.toLowerCase(), i = l.indexOf(q);
    return i < 0 ? -1 : i === 0 ? 0 : /[\s:\-_\/]/.test(l.charAt(i - 1)) ? 1 : 2;
  }
  function pick(list, q, limit) {
    q = q.toLowerCase();
    var scored = [];
    list.forEach(function (it, n) { var r = q ? rank(it.label, q) : 0; if (r >= 0) scored.push([r, n, it]); });
    scored.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    return scored.slice(0, limit).map(function (x) { return x[2]; });
  }
  /* data: { pages, site (lists of { title, category, summary }), topics (names), categories, images (paths), headings(page) -> list of heading texts, or null while it is being fetched }
     Returns [{ label, detail, insert }], at most `limit`. */
  function items(ctx, data, limit) {
    limit = limit || 10;
    var list = [], k = ctx.kind, pages = data.pages || [], site = data.site || [];
    function titles(prefix, from, detail) { from.forEach(function (p) { list.push({ label: prefix + p.title, detail: detail === true ? p.category || "" : detail, insert: prefix + p.title }); }); }
    if (k === "page" || k === "related") {
      titles(k === "related" ? "guide:" : "", pages, "page");
      (data.topics || []).forEach(function (t) { list.push({ label: "topic:" + t, detail: "topic", insert: "topic:" + t }); });
      titles("site:", site, "site guide");
    }
    else if (k === "heading") (data.headings ? data.headings(ctx.page) || [] : []).forEach(function (h) { list.push({ label: h, detail: "heading", insert: h }); });
    else if (k === "category") (data.categories || []).forEach(function (c) { list.push({ label: c, detail: "category", insert: c }); });
    else if (k === "field") FIELDS.forEach(function (f) { list.push({ label: f[0], detail: f[1], insert: f[0] + ": " }); });
    else if (k === "footnote") (ctx.ids || []).forEach(function (id) { list.push({ label: id, detail: "footnote", insert: id }); });
    else if (k === "callout") CALLOUTS.forEach(function (c) { list.push({ label: c, detail: c === "INFO" ? "fact panel" : "box", insert: c }); });
    else if (k === "key") KEYS.forEach(function (c) { list.push({ label: c, detail: "", insert: c }); });
    else if (k === "image") (data.images || []).forEach(function (c) { list.push({ label: c, detail: "picture", insert: c }); });
    var out = pick(list, ctx.query, limit);
    return out.length === 1 && out[0].label.toLowerCase() === ctx.query.toLowerCase() && k !== "field" ? [] : out;   /* what is typed is already complete */
  }
  /* choosing an item: the typed part is replaced and the closing marks are added (or, where an auto-closed pair is already there, stepped over) */
  function accept(v, s, ctx, item) {
    var close = { page: "]]", heading: "]]", key: "}}", callout: "]", footnote: "]" }[ctx.kind] || (ctx.kind === "image" && ctx.paren ? ")" : ""), text = item.insert, end = ctx.kind === "category" ? lineEnd(v, s) : s;
    if (close) { if (v.slice(s, s + close.length) === close) end = s + close.length; text += close; }
    return { start: ctx.from, end: end, text: text, a: ctx.from + text.length, b: ctx.from + text.length };
  }
  /* the headings of a page's source, as written (for [[Page#): not those in front matter or code boxes */
  function headingsOf(source) {
    var out = [], fence = null, front = /^---[ \t]*(\n|$)/.test(source), m;
    source.split("\n").forEach(function (l, i) {
      if (front) { if (i > 0 && /^---\s*$/.test(l)) front = false; return; }
      if ((m = FENCE_LINE.exec(l))) { if (!fence) fence = m[1].charAt(0); else if (m[1].charAt(0) === fence && !/\S/.test(l.replace(FENCE_LINE, ""))) fence = null; return; }
      if (!fence && (m = /^#{1,6}[ \t]+(.+?)[ \t#]*$/.exec(l))) out.push(m[1]);
    });
    return out;
  }
  P.complete = { typed: typed, backspace: backspace, enter: enter, tab: tab, context: context, items: items, accept: accept, headingsOf: headingsOf, openFence: openFence, inFront: inFront, KEYS: KEYS, CALLOUTS: CALLOUTS };
})();
