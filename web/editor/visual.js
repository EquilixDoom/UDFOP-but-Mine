/* The guide editor: Edit in Preview. Click a paragraph, heading, list item or table cell in the preview to change its text there; the change is written back to the text box as Markdown,
   over the block's source lines (the preview's blocks carry them in data-ln="first-last", and their kind in data-bk). The text box stays the one source of truth.
   A small bar above the block being edited has Bold, Italic, Code, Link and the block type. */
(function () {
  "use strict";
  var P = window.udfopEditor = window.udfopEditor || {};
  var EDITABLE = { p: 1, h: 1, li: 1, tr: 1 };   /* the block kinds (data-bk) that can be changed in the preview; a tr is changed one cell at a time */
  var LI = /^(\s*(?:[-*+]|\d+[.)])\s+)/;
  var BLOCK_START = /^(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|```|~~~|\|)/;   /* words that start like this would read as another kind of block */

  /* ---- pure parts ---- */
  /* the text with lines from..to (1-based, inclusive) replaced by repl: { start, end, text } where text is the whole new text */
  function replaceLines(text, from, to, repl) {
    var r = P.pick.lineRange(text, from, to);
    return { start: r[0], end: r[1], text: text.slice(0, r[0]) + repl + text.slice(r[1]) };
  }
  /* the part of a heading line before its words: "## " */
  function headPrefix(line) { var m = /^(#{1,6})\s+/.exec(line); return m ? m[0] : null; }
  function oneLine(md) { return String(md).replace(/\s*\n\s*/g, " ").replace(/\s+$/, "").replace(/^\s+/, ""); }
  function looksLikeBlock(md) { return BLOCK_START.test(md) || /^\s*([-*_])\s*(\1\s*){2,}$/.test(md); }
  /* where the words of each cell of a table row are in the line: [[start, end), ...], cut at the pipes that are not escaped (as the renderer cuts them) */
  function cellSpans(line) {
    var lead = /^\s*\|?/.exec(line)[0].length, end = line.replace(/\s+$/, "").length, out = [], a, i;
    if (end - 1 >= lead && line.charAt(end - 1) === "|" && line.charAt(end - 2) !== "\\") end--;
    function cut(from, to) {
      var s = from, e = to;
      while (s < e && /\s/.test(line.charAt(s))) s++;
      while (e > s && /\s/.test(line.charAt(e - 1))) e--;
      if (s === e) s = e = Math.min(from + 1, to);   /* an empty cell: the words go after the first space */
      out.push([s, e]);
    }
    for (a = i = lead; i < end; i++) {
      if (line.charAt(i) === "\\" && line.charAt(i + 1) === "|") { i++; continue; }
      if (line.charAt(i) === "|") { cut(a, i); a = i + 1; }
    }
    cut(a, end);
    return out;
  }
  /* what a block's source lines become when its words are md; null when that cannot be done safely. idx: the cell, for kind "cell" */
  function rewrite(kind, srcLines, md, idx) {
    md = oneLine(md);
    if (kind === "cell") {
      var sp = cellSpans(srcLines[0])[idx];
      return sp ? srcLines[0].slice(0, sp[0]) + md.replace(/\|/g, "\\|") + srcLines[0].slice(sp[1]) : null;
    }
    if (!md) return null;
    if (kind === "h") { var pre = headPrefix(srcLines[0]); return pre ? pre + md : null; }
    if (kind === "li") { var lm = LI.exec(srcLines[0]); return lm && !looksLikeBlock(md) ? lm[1] + md : null; }
    return looksLikeBlock(md) ? null : md;
  }
  /* the words of a block as the source spells them: rewriting a block from words that differ from these (the renderer left markup out, or spells it another way) would change more than was typed */
  function sourceWords(kind, srcLines, idx) {
    if (kind === "cell") { var sp = cellSpans(srcLines[0])[idx]; return sp ? srcLines[0].slice(sp[0], sp[1]).replace(/\\\|/g, "|") : null; }
    if (kind === "h") { var pre = headPrefix(srcLines[0]); return pre ? oneLine(srcLines[0].slice(pre.length).replace(/\s+#+\s*$/, "")) : null; }
    if (kind === "li") { var lm = LI.exec(srcLines[0]); return lm ? oneLine(srcLines.map(function (l, i) { return i ? l.trim() : l.slice(lm[1].length); }).join(" ")) : null; }
    return oneLine(srcLines.map(function (l) { return l.trim(); }).join(" "));
  }
  /* the line for a block turned into another kind: to is "p", "h2" to "h6", "li" or "quote" */
  function convertLine(to, md) {
    md = oneLine(md);
    if (!md || looksLikeBlock(md)) return null;
    var h = /^h([2-6])$/.exec(to);
    if (h) return new Array(+h[1] + 1).join("#") + " " + md;
    return to === "li" ? "- " + md : to === "quote" ? "> " + md : to === "p" ? md : null;
  }
  /* the Markdown for the words inside a node (anything shaped like a DOM node: nodeType, nodeValue, tagName, childNodes, getAttribute, className) */
  function serialize(node, skipLists) {
    var out = "";
    for (var i = 0; i < node.childNodes.length; i++) out += one(node.childNodes[i], skipLists);
    return out;
  }
  function one(n, skipLists) {
    if (n.nodeType === 3) return String(n.nodeValue).replace(/ /g, " ");
    if (n.nodeType !== 1) return "";
    var tag = String(n.tagName).toLowerCase(), md = n.getAttribute("data-md"), inner;
    if (md !== null && md !== undefined) return md;   /* a wiki link, key or picture: its source text */
    if (skipLists && (tag === "ul" || tag === "ol")) return "";
    if (tag === "br") return " ";
    if (tag === "sup" && /(^|\s)lt(\s|$)/.test(n.className || "")) return "";   /* the little marks after links */
    if (tag === "code") {
      var t = serialize(n), run = (t.match(/`+/g) || []).reduce(function (m, r) { return Math.max(m, r.length); }, 0), f = new Array(run + 2).join("`");
      return t ? f + (/^`|`$/.test(t) ? " " + t + " " : t) + f : "";
    }
    inner = serialize(n, skipLists);
    if (!inner.trim()) return inner;
    if (tag === "b" || tag === "strong") return "**" + inner + "**";
    if (tag === "i" || tag === "em") return "*" + inner + "*";
    if (tag === "a") { var href = n.getAttribute("data-href") || n.getAttribute("href"); return href ? "[" + inner + "](" + href + ")" : inner; }
    if (tag === "span" && /(^|\s)spoiler(\s|$)/.test(n.className || "")) return ">!" + inner + "!<";
    return inner;
  }
  /* ---- structure: whole blocks, as lines of the text (1-based, inclusive, as in data-ln) ---- */
  /* the smallest change from a to b: { start, end, repl } so that a.slice(0, start) + repl + a.slice(end) === b */
  function diffEdit(a, b) {
    var s = 0, n = Math.min(a.length, b.length), ea = a.length, eb = b.length;
    while (s < n && a.charCodeAt(s) === b.charCodeAt(s)) s++;
    while (ea > s && eb > s && a.charCodeAt(ea - 1) === b.charCodeAt(eb - 1)) { ea--; eb--; }
    return { start: s, end: ea, repl: b.slice(s, eb) };
  }
  /* the text without the block, and without one of the blank lines that set it apart */
  function deleteBlock(text, from, to) {
    var L = text.split("\n"), end = to;
    if (L[end] !== undefined && !L[end].trim()) end++;
    else if (from > 1 && !L[from - 2].trim()) from--;
    L.splice(from - 1, end - from + 1);
    return L.join("\n");
  }
  /* lines added as a block after line `after`, set apart by blank lines: { text, first (the line the new block starts on) } */
  function insertAfter(text, after, lines) {
    var L = text.split("\n"), nxt = L[after], add = [""].concat(lines);
    if (nxt !== undefined && nxt.trim()) add.push("");
    L.splice.apply(L, [after, 0].concat(add));
    return { text: L.join("\n"), first: after + 2 };
  }
  function duplicateBlock(text, from, to) { return insertAfter(text, to, text.split("\n").slice(from - 1, to)); }
  /* two blocks (r1 = [from, to] above r2) change places; what lies between them stays between them. null when that is not only blank lines */
  function swapBlocks(text, r1, r2) {
    var L = text.split("\n"), gap = L.slice(r1[1], r2[0] - 1);
    if (r1[1] >= r2[0] || gap.some(function (l) { return l.trim(); })) return null;
    return L.slice(0, r1[0] - 1).concat(L.slice(r2[0] - 1, r2[1]), gap, L.slice(r1[0] - 1, r1[1]), L.slice(r2[1])).join("\n");
  }
  var SNIPPETS = {
    p: ["New paragraph"], h: ["## New heading"], ul: ["- Item"], ol: ["1. Item"], code: ["```", "code", "```"], rule: ["---"],
    note: ["> [!NOTE]", "> Text"], tip: ["> [!TIP]", "> Text"], important: ["> [!IMPORTANT]", "> Text"], warning: ["> [!WARNING]", "> Text"], caution: ["> [!CAUTION]", "> Text"],
    info: ["> [!INFO] Title", "> Key: Value"], fig: ['![Alt text](images/name.png "Caption")'], spoiler: [">!Hidden text!<"], quote: ["> Quote"]
  };
  function tableSnippet(cols, rows) {
    var head = [], bar = [], cell = [], i, out;
    for (i = 0; i < cols; i++) { head.push("Heading"); bar.push("---"); cell.push("Text"); }
    out = ["| " + head.join(" | ") + " |", "| " + bar.join(" | ") + " |"];
    for (i = 0; i < rows; i++) out.push("| " + cell.join(" | ") + " |");
    return out;
  }
  /* table rows and columns on the lines of a table (header, separator, rows); each returns the new lines, or null when the change is not allowed */
  function rowCells(line) { return cellSpans(line).map(function (s) { return line.slice(s[0], s[1]); }); }
  function rowLine(cells) { return "| " + cells.join(" | ") + " |"; }
  function tableAddRow(lines, after) {   /* a blank row after line index `after` (the header and separator stay on top) */
    var n = rowCells(lines[0]).length, blank = [], out = lines.slice(), i;
    for (i = 0; i < n; i++) blank.push("");
    out.splice(Math.max(after, 1) + 1, 0, rowLine(blank));
    return out;
  }
  function tableDelRow(lines, at) { if (at < 2) return null; var out = lines.slice(); out.splice(at, 1); return out; }
  function tableAddCol(lines, col, after) {
    return lines.map(function (l, i) { var c = rowCells(l); c.splice(col + (after ? 1 : 0), 0, i === 0 ? "Heading" : i === 1 ? "---" : ""); return rowLine(c); });
  }
  function tableDelCol(lines, col) {
    if (rowCells(lines[0]).length < 2) return null;
    return lines.map(function (l) { var c = rowCells(l); c.splice(col, 1); return rowLine(c); });
  }
  /* ---- blocks with properties: code boxes, pictures, notices, infoboxes and quotes ---- */
  var PROPS = { code: 1, fig: 1, alert: 1, info: 1, quote: 1 };
  var KINDS = ["note", "tip", "important", "warning", "caution", "info", "quote"];
  /* a code box on its lines: { fence, lang, body, closed } or null */
  function parseCode(lines) {
    var m = /^(`{3,}|~{3,})\s*([A-Za-z0-9+#.-]{1,20})?\s*$/.exec(lines[0] || ""), last = lines[lines.length - 1], cl;
    if (!m) return null;
    cl = lines.length > 1 && /^(`{3,}|~{3,})\s*$/.test(last) && last.trim().charAt(0) === m[1].charAt(0) && last.trim().length >= m[1].length;
    return { fence: m[1], lang: m[2] || "", body: lines.slice(1, cl ? -1 : undefined).join("\n"), closed: cl };
  }
  function buildCode(o) {
    var f = o.fence, body = o.body === "" ? [] : o.body.split("\n");
    while (body.some(function (l) { return /^(`{3,}|~{3,})\s*$/.test(l) && l.trim().length >= f.length; })) f += f.charAt(0);
    return [f + o.lang].concat(body, [f]);
  }
  /* a picture alone on its line: ![alt](src "caption"){options} */
  function parseFig(line) {
    var m = /^!\[([^\]]*)\]\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)(?:\s+"([^"]*)")?\)(?:\{([^}]*)\})?$/.exec(String(line).trim());
    return m ? { alt: m[1], src: m[2], caption: m[3] || "", opts: m[4] || "" } : null;
  }
  function buildFig(o) {
    return "![" + o.alt.replace(/\]/g, ")") + "](" + o.src.replace(/\s+/g, "") + (o.caption ? ' "' + o.caption.replace(/"/g, "'") + '"' : "") + ")" + (o.opts ? "{" + o.opts.replace(/[{}]/g, "") + "}" : "");
  }
  /* the picture on line `at` (1-based) is given a side: left, center or right; its width and other options stay; null when the line is not a picture */
  function setFigSide(text, at, side) {
    var lines = text.split("\n"), o = parseFig(lines[at - 1] || "");
    if (!o) return null;
    o.opts = [side].concat(o.opts.split(/\s+/).filter(function (t) { return t && !/^(left|right|center)$/i.test(t); })).join(" ");
    lines[at - 1] = buildFig(o);
    return lines.join("\n");
  }
  /* the picture on line `at` is given a width in pixels (40 to 1200); its side and other options stay */
  function setFigWidth(text, at, w) {
    var lines = text.split("\n"), o = parseFig(lines[at - 1] || "");
    if (!o) return null;
    o.opts = o.opts.split(/[\s,]+/).filter(function (t) { return t && !/^\d+(px)?$/i.test(t); }).concat(String(Math.max(40, Math.min(1200, Math.round(w))))).join(" ");
    lines[at - 1] = buildFig(o);
    return lines.join("\n");
  }
  /* a block made of > lines: { kind (note, tip, important, warning, caution, info or quote), title (for info), body } */
  function parseQuote(lines) {
    var first = String(lines[0]).replace(/^>\s?/, ""), inf = /^\[!INFO\](?:[ \t]+(.*?))?\s*$/i.exec(first), al = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(first), at = inf || al ? 1 : 0;
    return { kind: inf ? "info" : al ? al[1].toLowerCase() : "quote", title: inf ? inf[1] || "" : "", body: lines.slice(at).map(function (l) { return l.replace(/^>\s?/, ""); }).join("\n") };
  }
  function buildQuote(o) {
    var head = o.kind === "info" ? ["> [!INFO]" + (o.title ? " " + o.title : "")] : o.kind === "quote" ? [] : ["> [!" + o.kind.toUpperCase() + "]"];
    return head.concat(o.body.split("\n").map(function (l) { return l ? "> " + l : ">"; }));
  }
  /* the block at index `from` of ranges (each [first, last], in order, in text) is moved to index `to` by changing places with its neighbors; null when a change is refused */
  function moveBlockTo(text, ranges, from, to) {
    var rs = ranges.map(function (r) { return [r[0], r[1]]; }), step = to > from ? 1 : -1, i = from;
    while (i !== to) {
      var j = i + step, u = Math.min(i, j), l = Math.max(i, j), a = rs[u], b = rs[l], next = swapBlocks(text, a, b);
      if (next === null) return null;
      var la = a[1] - a[0] + 1, lb = b[1] - b[0] + 1, gap = b[0] - a[1] - 1, nb = [a[0], a[0] + lb - 1];
      rs[u] = nb; rs[l] = [nb[1] + gap + 1, nb[1] + gap + la];
      text = next; i = j;
    }
    return text;
  }
  P.visual = { setFigWidth: setFigWidth, setFigSide: setFigSide, replaceLines: replaceLines, parseCode: parseCode, buildCode: buildCode, parseFig: parseFig, buildFig: buildFig, parseQuote: parseQuote, buildQuote: buildQuote, moveBlockTo: moveBlockTo, headPrefix: headPrefix, rewrite: rewrite, oneLine: oneLine, cellSpans: cellSpans, convertLine: convertLine, sourceWords: sourceWords, serialize: serialize,
    diffEdit: diffEdit, deleteBlock: deleteBlock, insertAfter: insertAfter, duplicateBlock: duplicateBlock, swapBlocks: swapBlocks, SNIPPETS: SNIPPETS, tableSnippet: tableSnippet,
    tableAddRow: tableAddRow, tableDelRow: tableDelRow, tableAddCol: tableAddCol, tableDelCol: tableDelCol };

  /* ---- in the page ---- */
  /* ctx: { ta, prev (the preview's article), btn (the Edit button), H (the renderer), say(text), toggle(), off(), render(), opts() (the options the preview is drawn with), dlg (the dialog) }.
     render() draws the preview again after a change. */
  P.visualEditor = function (ctx) {
    var ta = ctx.ta, prev = ctx.prev, btn = ctx.btn, on = false, hotEl = null, cur = null, bar = null, selEl = null;
    /* cur: { el (what is editable), lines (the source lines it covers), kind (p, h, li or cell), idx (the cell), before (innerHTML), src, cancelled } */

    /* a picture placed to the left or right has a strip above it, one line tall and as wide as the page: the picture's place in the text. It is drawn by decorate() and belongs to the picture that follows it. */
    function figBar(el) { var b = el && el.previousElementSibling; return b && b.classList && b.classList.contains("vis-figbar") ? b : null; }
    function uRect(el) {   /* the whole block: for a side picture the strip as well */
      var r = el.getBoundingClientRect(), b = figBar(el);
      if (!b) return r;
      var q = b.getBoundingClientRect(), l = Math.min(r.left, q.left), t = Math.min(r.top, q.top), rt = Math.max(r.right, q.right), bt = Math.max(r.bottom, q.bottom);
      return { left: l, top: t, right: rt, bottom: bt, width: rt - l, height: bt - t };
    }
    function flowRect(el) { return (figBar(el) || el).getBoundingClientRect(); }   /* where the block sits in the text: for a side picture, its strip */
    function decorate() {
      var g = gp(); if (!g) return;
      Array.prototype.slice.call(g.querySelectorAll(":scope > .vis-figbar")).forEach(function (b) { b.remove(); });
      if (!on) return;
      Array.prototype.slice.call(g.querySelectorAll(":scope > figure.fig-left, :scope > figure.fig-right")).forEach(function (f) {
        var b = document.createElement("div"); b.className = "vis-figbar"; b.setAttribute("aria-hidden", "true");
        b.textContent = "Picture, " + (f.classList.contains("fig-left") ? "left" : "right");
        f.parentNode.insertBefore(b, f);
      });
    }
    function blockOf(node) {
      var bar = node && node.closest ? node.closest(".vis-figbar") : null;
      if (bar && prev.contains(bar) && bar.nextElementSibling) return bar.nextElementSibling;
      var el = node && node.closest ? node.closest("[data-ln]") : null;
      return el && prev.contains(el) ? el : null;
    }
    /* what a click or hover at node would edit: the cell of a table row, else the block itself */
    function targetOf(node) {
      var block = blockOf(node);
      if (!block) return null;
      var kind = block.getAttribute("data-bk");
      if (kind === "tr") { var cell = node.closest("td, th"); return cell && block.contains(cell) ? cell : null; }
      return EDITABLE[kind] || PROPS[kind] ? block : null;
    }
    /* what is shaded and selected: a whole list or table is one block, its items and cells are edited one at a time */
    function unitOf(t) { return t && /^(LI|TD|TH)$/.test(t.tagName) ? topOf(t) || t : t; }
    /* the shaded area of a list or table (its padding, the space around the cells) belongs to the block too */
    function wholeOf(node) { var b = blockOf(node), k = b && b.getAttribute("data-bk"); return b && (k === "list" || k === "table") && topOf(b) === b ? b : null; }
    function setHot(el) {
      if (el === hotEl) return;
      if (hotEl) hotEl.classList.remove("vis-hot");
      hotEl = el;
      if (el) el.classList.add("vis-hot");
    }
    /* the first click selects a block (ring and handle); a second click on it, Enter or F2 begins editing */
    function setSel(el) {
      if (selEl) selEl.classList.remove("vis-sel");
      selEl = el;
      if (el) {
        el.classList.add("vis-sel");
        /* the block's lines are marked in the text box (without moving the keyboard there) and brought into view */
        var top = topOf(el) || el, ln = P.pick.parseLn(top.getAttribute("data-ln"));
        if (ln && !cur) {
          var rg = P.pick.lineRange(ta.value, ln[0], ln[1]);
          ta.setSelectionRange(rg[0], rg[1]);
          if (ctx.reveal) ctx.reveal(rg[0]);
          if (ctx.repaint) ctx.repaint();
        }
      }
      syncGrips(hEl);
    }
    function srcLines(lines) { var r = P.pick.lineRange(ta.value, lines[0], lines[1]); return ta.value.slice(r[0], r[1]).split("\n"); }
    function wordsOf(el, kind) { return oneLine(serialize(el, kind === "li")); }
    function renderOne(line) {
      var o = {}, k, opts = ctx.opts();
      for (k in opts) o[k] = opts[k];
      o.lines = 0;
      var box = document.createElement("div");
      try { box.innerHTML = ctx.H.renderDoc(line, undefined, o); } catch (e) { return null; }
      return box.firstElementChild && !box.firstElementChild.nextElementSibling ? box.firstElementChild : null;
    }
    function stripLists(el) { var c = el.cloneNode(true), l = c.querySelectorAll("ul, ol"); for (var i = 0; i < l.length; i++) l[i].remove(); return c.innerHTML; }
    /* the block drawn again from its words must match the block as it is now: otherwise writing the words back would change more than the writer typed */
    function lossless(c) {
      var md = wordsOf(c.el, c.kind), line, first;
      if (sourceWords(c.kind, c.src.split("\n"), c.idx) !== md) return false;
      if (c.kind === "cell") { first = renderOne(md); return !!first && first.tagName === "P" && first.innerHTML === c.el.innerHTML && rewrite("cell", c.src.split("\n"), md, c.idx) !== null; }
      line = rewrite(c.kind, c.src.split("\n"), md);
      if (line === null) return false;
      first = renderOne(c.kind === "li" ? line.replace(LI, "- ") : line);
      if (!first) return false;
      if (c.kind === "li") { var li = first.querySelector("li"); return !!li && li.innerHTML === stripLists(c.el); }
      return first.tagName === c.el.tagName && first.innerHTML === c.el.innerHTML;
    }
    function pickLines(lines, why) {   /* the fallback: select the block's lines in the text box */
      var r = P.pick.lineRange(ta.value, lines[0], lines[1]);
      ta.focus(); ta.setSelectionRange(r[0], r[1]);
      ctx.say(why + ": its lines are selected in the text");
    }
    function begin(el, all) {
      setSel(null);
      if (PROPS[el.getAttribute("data-bk")]) { openProps(el); return true; }
      if (el.closest("blockquote, .alert, .infobox")) { var top = topOf(el); if (top) { openProps(top); return true; } }
      var tr = el.closest("[data-ln]"), lines = P.pick.parseLn(tr.getAttribute("data-ln")), kind = tr.getAttribute("data-bk"), idx = -1;
      if (kind === "tr") { kind = "cell"; idx = el.cellIndex; }
      if (!lines) return false;
      if (kind === "li" && el.querySelector("ul, ol")) lines = [lines[0], lines[0]];   /* an item with a list inside: its own line is the first */
      var c = { el: el, lines: lines, kind: kind, idx: idx, before: el.innerHTML, src: srcLines(lines).join("\n"), cancelled: false };
      if (!lossless(c)) { pickLines(lines, "This block has formatting that cannot be edited here yet"); return true; }
      setHot(null); hideHandle();
      cur = c;
      el.setAttribute("contenteditable", "true"); el.setAttribute("spellcheck", "true");
      Array.prototype.forEach.call(el.querySelectorAll("ul, ol"), function (l) { l.setAttribute("contenteditable", "false"); });
      el.classList.add("vis-on");
      el.focus();
      var sel = window.getSelection(), rg = document.createRange();   /* the caret goes to the end of the words */
      rg.selectNodeContents(el);
      var inner = el.querySelector("ul, ol");
      if (inner) rg.setEndBefore(inner);
      if (!all) rg.collapse(false);   /* with all, the words are selected so that typing replaces them (a new block) */
      sel.removeAllRanges(); sel.addRange(rg);
      showBar(c);
      return true;
    }
    function release(c) {
      c.el.removeAttribute("contenteditable"); c.el.removeAttribute("spellcheck"); c.el.classList.remove("vis-on");
      Array.prototype.forEach.call(c.el.querySelectorAll("ul, ol"), function (l) { l.removeAttribute("contenteditable"); });
      hideBar();
    }
    function end() {
      var c = cur; if (!c) return;
      cur = null; release(c);
      if (c.cancelled) { c.el.innerHTML = c.before; return; }
      if (c.el.innerHTML === c.before) return;
      var line = rewrite(c.kind, c.src.split("\n"), wordsOf(c.el, c.kind), c.idx);
      if (line === null) { c.el.innerHTML = c.before; ctx.say("Not changed: that text would read as another kind of block"); return; }
      if (srcLines(c.lines).join("\n") !== c.src) { c.el.innerHTML = c.before; ctx.say("Not changed: the text moved while you were editing"); return; }
      write(c.lines, line);
    }
    /* replaces the lines the way typing would, so one Ctrl+Z brings the old lines back */
    function write(lines, line) {
      applyText(replaceLines(ta.value, lines[0], lines[1], line).text);
      ctx.say("Changed " + (lines[1] > lines[0] ? "lines " + lines[0] + " to " + lines[1] : "line " + lines[0]));
    }
    /* turns the block being edited into another kind (the bar's block menu); one change in the text */
    function convert(to) {
      var c = cur; if (!c || c.kind === "cell") return;
      var line = convertLine(to, wordsOf(c.el, c.kind));
      if (line === null) { ctx.say("Not changed: the block needs some words that do not start like another block"); return; }
      if (srcLines(c.lines).join("\n") !== c.src) return;
      var nth = Array.prototype.indexOf.call(prev.querySelectorAll("[data-ln]"), c.el), again = /^(p|h\d)$/.test(to) && c.kind !== "li";
      cur = null; release(c);
      write(c.lines, line);
      if (again && nth >= 0) { var el = prev.querySelectorAll("[data-ln]")[nth]; if (el) begin(el); }
    }

    /* ---- whole blocks: the handle that shows over a block under the pointer, and the insert menu ---- */
    var handle = null, menu = null, hEl = null, hideT = 0;
    function gp() { return prev.querySelector("#gp"); }
    function topOf(node) {   /* the block (a direct child of the page body) that holds node */
      var g = gp(), n = node && node.nodeType === 1 ? node : node && node.parentNode;
      if (!g) return null;
      while (n && n.parentNode !== g) n = n.parentNode;
      if (n && n.classList && n.classList.contains("vis-figbar")) n = n.nextElementSibling;
      return n && n.getAttribute && n.getAttribute("data-ln") ? n : null;
    }
    function tops() { var g = gp(); return g ? Array.prototype.filter.call(g.children, function (e) { return e.hasAttribute("data-ln"); }) : []; }
    function rangeOf(el) { return P.pick.parseLn(el.getAttribute("data-ln")); }
    /* puts new text in the text box as one change (one Ctrl+Z), touching only what differs, and draws the preview again */
    function applyText(next, note) {
      var d = diffEdit(ta.value, next), ok = false, keepTop = ta.scrollTop;
      if (!d.repl && d.start === d.end) return;
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(d.start, d.end);
      try { ok = d.repl ? document.execCommand("insertText", false, d.repl) : document.execCommand("delete"); } catch (e) {}
      if (!ok || ta.value !== next) { ta.value = next; ta.dispatchEvent(new Event("input")); }
      ta.scrollTop = keepTop;
      ta.setSelectionRange(d.start, d.start + d.repl.length);
      ctx.render();
      if (note) ctx.say(note);
    }
    function enterAt(first) {   /* the block that starts on line `first` goes into editing, its words selected; a block that cannot be edited here has its lines selected */
      var el = tops().filter(function (e) { return rangeOf(e)[0] === first; })[0];
      if (!el) return;
      var kind = el.getAttribute("data-bk"), t = kind === "list" ? el.querySelector("li") : kind === "table" ? el.querySelector("th") : kind === "p" || kind === "h" ? el : null;
      if (t) begin(t, true); else pickLines(rangeOf(el), "Added");
    }
    function showHandle(el) {
      clearTimeout(hideT);
      if (!el || cur) return;
      var chosen = selEl && selEl.isConnected ? topOf(selEl) : null;
      if (el !== chosen) {   /* the menu belongs to the selected block only; pointing at any other block shows just its highlight and grip */
        if (!chosen) { if (handle) handle.hidden = true; hideMenu(); hEl = null; }
        syncGrips(el); return;
      }   /* with a block selected, the menu stays with it: another block under the pointer only shows its grip */
      if (!handle) {
        handle = document.createElement("div");
        handle.className = "edw-vbar edw-handle"; handle.setAttribute("role", "toolbar"); handle.setAttribute("aria-label", "Change this block");
        handle.innerHTML = '<button type="button" data-s="up" title="Move up" aria-label="Move up">&uarr;</button><button type="button" data-s="down" title="Move down" aria-label="Move down">&darr;</button>' +
          '<button type="button" data-s="props" title="Change the type, picture details or code of this block">Edit&hellip;</button><button type="button" data-s="dup" title="Copy this block (a duplicate goes right after it)">Copy</button><button type="button" data-s="del" title="Delete this block">Delete</button><button type="button" data-s="add" title="Add a block after this one" aria-haspopup="true">Add</button>';
        handle.addEventListener("mousedown", function (e) { e.preventDefault(); });
        handle.addEventListener("mouseenter", function () { clearTimeout(hideT); });
        handle.addEventListener("mouseleave", function () { later(); });
        handle.addEventListener("click", function (e) { var b = e.target.closest("button[data-s]"); if (b && b.getAttribute("data-s") !== "drag" && hEl) structure(b.getAttribute("data-s"), b); });
        ta.closest(".edw").appendChild(handle);
      }
      hEl = el; hideMenu();
      handle.querySelector('[data-s="props"]').hidden = !PROPS[el.getAttribute("data-bk")];
      var i = tops().indexOf(el);
      handle.querySelector('[data-s="up"]').disabled = i <= 0; handle.querySelector('[data-s="down"]').disabled = i < 0 || i >= tops().length - 1;
      handle.hidden = false;
      syncGrips(el);
      var r = uRect(el), root = ta.closest(".edw").getBoundingClientRect(), pv = prev.parentNode.getBoundingClientRect(), w = handle.offsetWidth, h = handle.offsetHeight;
      /* the menu stays inside the preview: above the block when there is room, else over the block's top, kept in view while any of the block shows, and gone once the block has scrolled out */
      if (r.bottom < pv.top + h || r.top > pv.bottom - 8) { handle.hidden = true; hideMenu(); return; }
      var top = r.top - h - 2 < pv.top ? Math.max(pv.top + 2, Math.min(r.top + 2, pv.bottom - h - 2)) : r.top - h - 2;
      handle.style.top = Math.round(top) + "px"; handle.style.left = Math.round(Math.max(root.left + 4, Math.min(r.left, root.right - w - 4))) + "px";
    }
    /* the grip in the block's left extension, shown for the block under the pointer: drag to move the block, click to select it */
    var grips = {};
    function placeGrip(key, el) {
      var g = grips[key];
      if (!g) {
        g = grips[key] = document.createElement("span"); g.className = "edw-lgrip"; g.innerHTML = "&#8942;&#8942;";
        g.setAttribute("aria-hidden", "true"); g.tabIndex = -1;   /* only a sign that the block can be dragged */
        ta.closest(".edw").appendChild(g);
      }
      if (!el || !el.isConnected) { g.hidden = true; return; }
      var r = flowRect(el), pv = prev.parentNode.getBoundingClientRect();   /* a side picture's grip goes on its strip: down the picture's side it would sit beside the text blocks, which have their own grips */
      var top = Math.max(r.top, pv.top), bot = Math.min(r.bottom, pv.bottom);   /* centered in the extension: across its 24px, and along the part of the block that shows */
      g.hidden = bot - top < 8;
      g.style.top = Math.round((top + bot) / 2 - 12) + "px"; g.style.left = Math.round(r.left) + "px";
    }
    /* a floated picture sits beside the text, so where it is in the text is shown by a dashed line across the gap it is anchored in (the line the picture's own line of text sits on) */
    var anchor = null;
    function placeAnchor(el) {
      if (!anchor) { anchor = document.createElement("div"); anchor.className = "edw-anchor"; anchor.setAttribute("aria-hidden", "true"); anchor.setAttribute("data-label", "Picture starts here"); ta.closest(".edw").appendChild(anchor); }
      var list = tops(), i = el ? list.indexOf(el) : -1;
      if (i < 0 || !floated(el) || cur) { anchor.hidden = true; return; }
      var at = gapAt(list, i + 1, undefined, true), g = gapSpan(list, i + 1), pv = prev.parentNode.getBoundingClientRect();
      if (at === null || at < pv.top || at > pv.bottom) { anchor.hidden = true; return; }
      anchor.hidden = false; anchor.baseTop = at - 1; anchor.style.top = Math.round(at - 1) + "px"; anchor.style.left = Math.round(g.left) + "px"; anchor.style.width = Math.round(g.right - g.left) + "px";
      apart();
    }
    /* a selected picture has a handle on its lower outer corner: drag it to change the width (written as the picture's width option) */
    var rsz = null, sizing = null;
    function placeResize(el) {
      if (!rsz) {
        rsz = document.createElement("div"); rsz.className = "edw-resize"; rsz.setAttribute("aria-hidden", "true"); rsz.title = "Drag to change the picture's width";
        rsz.addEventListener("pointerdown", startSize);
        ta.closest(".edw").appendChild(rsz);
      }
      if (!el || cur || drag) { if (!sizing) rsz.hidden = true; return; }
      var r = el.getBoundingClientRect(), pv = prev.parentNode.getBoundingClientRect(), left = /fig-right/.test(el.className);
      rsz.hidden = r.bottom < pv.top + 12 || r.bottom > pv.bottom;
      rsz.setAttribute("data-edge", left ? "left" : "right");
      rsz.style.top = Math.round(r.bottom - 8) + "px"; rsz.style.left = Math.round(left ? r.left - 8 : r.right - 8) + "px";
    }
    function startSize(e) {
      var el = selEl && selEl.isConnected ? topOf(selEl) : null;
      if (!el || e.button) return;
      e.preventDefault(); e.stopPropagation();
      var g = gp().getBoundingClientRect();
      sizing = { el: el, at: tops().indexOf(el), x: e.clientX, w0: parseFloat(getComputedStyle(el).width), dir: /fig-right/.test(el.className) ? -1 : 1, max: Math.min(1200, Math.round(g.width - 60)), w: 0 };
      sizing.w = sizing.w0;
      document.addEventListener("pointermove", sizeMove); document.addEventListener("pointerup", sizeEnd); document.addEventListener("pointercancel", sizeEnd);
    }
    function sizeMove(e) {
      if (!sizing) return;
      var w = Math.max(40, Math.min(sizing.max, Math.round(sizing.w0 + sizing.dir * (e.clientX - sizing.x))));
      sizing.w = w; sizing.el.style.width = w + "px";
      rsz.setAttribute("data-label", w + " px");
      placeResize(sizing.el);
    }
    function sizeEnd(e) {
      if (!sizing) return;
      var z = sizing; sizing = null;
      document.removeEventListener("pointermove", sizeMove); document.removeEventListener("pointerup", sizeEnd); document.removeEventListener("pointercancel", sizeEnd);
      rsz.removeAttribute("data-label");
      var r = tops()[z.at] === z.el ? rangeOf(z.el) : null, next = r && e.type !== "pointercancel" && z.w !== Math.round(z.w0) ? setFigWidth(ta.value, r[0], z.w) : null;
      if (next === null) { z.el.style.width = ""; z.el.style.width = z.w0 + "px"; reselect(z.at); return; }
      applyText(next, "Picture width " + z.w + " px");
      reselect(z.at);
    }
    /* the gaps between blocks: pointing at one shows a button that adds a block there (also above the first block and below the last) */
    var gapBtn = null, gapAtIdx = -1, gapT = 0;
    function gapLines(k, list) {   /* the line the new block goes after when the gap is in front of block k (list.length: after the last) */
      if (k >= list.length) return rangeOf(list[list.length - 1])[1];
      if (k === 0) return Math.max(0, rangeOf(list[0])[0] - 2);
      return rangeOf(list[k - 1])[1];
    }
    var lastPtr = null, gapRaf = 0;
    function showGap(e) {
      if (e && e.clientX !== undefined) lastPtr = { clientX: e.clientX, clientY: e.clientY };
      if (!on || cur || drag || sizing || (menu && !menu.hidden)) return;
      var list = tops(); if (!list.length) return;
      var g = gp().getBoundingClientRect(), best = -1, bd = 14, k, at;
      {
        for (k = 0; k <= list.length; k++) {
          if (k < list.length && floated(list[k])) continue;
          if (k < list.length && selEl && selEl.isConnected && list[k] === topOf(selEl)) continue;   /* the selected block's menu sits in the gap above it */
          at = gapAt(list, k); if (at === null) continue;
          var sp = gapSpan(list, k); if (e.clientX < sp.left - 30 || e.clientX > sp.right) continue;
          if (Math.abs(e.clientY - at) < bd) { bd = Math.abs(e.clientY - at); best = k; }
        }
      }
      if (best < 0) { clearTimeout(gapT); gapT = setTimeout(hideGap, 180); return; }
      clearTimeout(gapT);
      if (!gapBtn) {
        gapBtn = document.createElement("button"); gapBtn.type = "button"; gapBtn.className = "edw-gap"; gapBtn.title = "Add a block here"; gapBtn.setAttribute("aria-label", "Add a block here"); gapBtn.setAttribute("aria-haspopup", "true");
        gapBtn.addEventListener("mousedown", function (ev) { ev.preventDefault(); });
        gapBtn.addEventListener("mouseenter", function () { clearTimeout(gapT); });
        gapBtn.addEventListener("mouseleave", function () { clearTimeout(gapT); gapT = setTimeout(hideGap, 180); });
        gapBtn.addEventListener("click", function () {
          var l = tops(); if (gapAtIdx < 0 || !l.length) return;
          var after = gapLines(gapAtIdx, l); insAt = [after, after];
          hEl = null; openMenu(gapBtn);
        });
        ta.closest(".edw").appendChild(gapBtn);
      }
      gapAtIdx = best; at = gapAt(list, best); gapBtn.baseTop = at - 10;
      gapBtn.hidden = false; gapBtn.style.top = Math.round(at - 10) + "px"; var sp2 = gapSpan(list, best); gapBtn.style.left = Math.round(sp2.left) + "px"; gapBtn.style.width = Math.round(sp2.right - sp2.left) + "px";
      apart();
    }
    /* the "Picture starts here" line and the add-block line can fall in the same gap: the add-block line is what the pointer is on, so it alone is shown there, and the other comes back when it goes */
    function apart() {
      if (!anchor || !gapBtn) return;
      var both = !anchor.hidden && !gapBtn.hidden && anchor.baseTop !== undefined && gapBtn.baseTop !== undefined && Math.abs(anchor.baseTop - (gapBtn.baseTop + 9)) < 12;
      anchor.classList.toggle("edw-anchor-off", both);
    }
    function hideGap() { if (gapBtn && !(menu && !menu.hidden)) gapBtn.hidden = true; gapAtIdx = -1; apart(); }
    prev.addEventListener("mousemove", showGap);
    prev.addEventListener("mouseleave", function () { clearTimeout(gapT); gapT = setTimeout(hideGap, 180); });
    /* one grip stays on the selected block, one follows the block under the pointer */
    function syncGrips(hover) {
      var chosen = selEl && selEl.isConnected && !cur ? topOf(selEl) : null;
      placeGrip("sel", chosen);
      placeGrip("hov", hover && hover !== chosen && !cur ? hover : null);
      var pic = [hover, chosen].filter(function (b) { return b && b.getAttribute("data-bk") === "fig"; })[0];
      placeResize(chosen && chosen.getAttribute("data-bk") === "fig" ? chosen : null);
    }
    function later() { clearTimeout(hideT); hideT = setTimeout(function () { if (!drag && (!menu || menu.hidden)) backToSel(); }, 350); }
    /* the menu stays with the selected block: when the pointer leaves, or the preview scrolls, it returns to that block (or goes, with no selection) */
    function backToSel() { var t = selEl && selEl.isConnected && !cur ? topOf(selEl) : null; if (t) showHandle(t); else hideHandle(); }
    function hideHandle() { clearTimeout(hideT); if (handle) handle.hidden = true; syncGrips(null); hEl = null; hideMenu(); }
    function hideMenu() { if (menu) menu.hidden = true; }
    /* the block stays selected after a change made from its menu: the preview was drawn again, so it is found by its place among the blocks */
    function reselect(idx) { var t = tops()[idx]; if (t) { setSel(t); showHandle(t); } }
    function structure(act, btn) {
      var r = rangeOf(hEl), list = tops(), i = list.indexOf(hEl), text = ta.value, next;
      if (act === "del") { hideHandle(); applyText(deleteBlock(text, r[0], r[1]), "Deleted lines " + r[0] + " to " + r[1]); return; }
      if (act === "dup") { var d = duplicateBlock(text, r[0], r[1]); hideHandle(); applyText(d.text, "Duplicated"); reselect(i); return; }
      if (act === "up" || act === "down") {
        var other = list[i + (act === "up" ? -1 : 1)];
        if (!other) return;
        var o = rangeOf(other);
        next = act === "up" ? swapBlocks(text, o, r) : swapBlocks(text, r, o);
        hideHandle();
        if (next === null) { ctx.say("Not moved: there is something between the two blocks"); reselect(i); }
        else { applyText(next, "Moved the block " + act); reselect(i + (act === "up" ? -1 : 1)); }
        return;
      }
      if (act === "props") { var pe = hEl; hideHandle(); openProps(pe); return; }
      if (act === "add") { insAt = null; openMenu(btn); }
    }
    function openMenu(anchor) {
      if (!menu) {
        menu = document.createElement("div");
        menu.className = "edw-vbar edw-vmenu"; menu.setAttribute("role", "menu");
        var items = [["p", "Paragraph"], ["h", "Heading"], ["ul", "Bullet list"], ["ol", "Numbered list"], ["table", "Table…"], ["code", "Code block"], ["note", "Note"], ["tip", "Tip"], ["important", "Important"], ["warning", "Warning"], ["caution", "Caution"], ["info", "Infobox"], ["fig", "Picture with caption"], ["quote", "Quote"], ["spoiler", "Spoiler"], ["rule", "Rule"]];
        menu.innerHTML = items.map(function (it) { return '<button type="button" role="menuitem" data-n="' + it[0] + '">' + it[1] + "</button>"; }).join("");
        menu.addEventListener("mousedown", function (e) { e.preventDefault(); });
        menu.addEventListener("mouseenter", function () { clearTimeout(hideT); });
        menu.addEventListener("click", function (e) { var b = e.target.closest("button[data-n]"); if (b) insert(b.getAttribute("data-n")); });
        ta.closest(".edw").appendChild(menu);
      }
      menu.hidden = false;
      var r = anchor.getBoundingClientRect(), w = menu.offsetWidth, h = menu.offsetHeight, root = ta.closest(".edw").getBoundingClientRect();
      var top = r.bottom + 2 + h > window.innerHeight ? Math.max(4, r.top - h - 2) : r.bottom + 2;
      menu.style.top = Math.round(top) + "px"; menu.style.left = Math.round(Math.max(root.left + 4, Math.min(r.left, root.right - w - 4))) + "px";
    }
    var insAt = null;   /* set when the menu was opened from the button in a gap: [line to add after, same] */
    function insert(name) {
      var r = insAt || rangeOf(hEl);
      insAt = null;
      hideMenu(); hideHandle();
      if (name === "table") {
        ctx.dlg.ask({ title: "Add a table", html: '<p><label>Columns <input id="ed-vcols" type="number" min="1" max="12" value="3" class="edw-fin" style="width:5em"></label> <label>Rows <input id="ed-vrows" type="number" min="1" max="50" value="2" class="edw-fin" style="width:5em"></label></p>', ok: "Add", cancel: "Cancel" }).then(function (ok) {
          var c = document.getElementById("ed-vcols"), w = document.getElementById("ed-vrows");
          if (!ok || !c || !w) return;
          put(tableSnippet(Math.max(1, Math.min(12, +c.value || 3)), Math.max(1, Math.min(50, +w.value || 2))), r);
        });
        return;
      }
      if (SNIPPETS[name]) put(SNIPPETS[name], r);
    }
    function put(lines, r) {
      var res = insertAfter(ta.value, r[1], lines);
      applyText(res.text, "Added a block after line " + r[1]);
      enterAt(res.first);
    }
    /* the dialog for a code box, picture, notice, infobox or quote: its parts as fields, written back over the block's lines */
    function openProps(el) {
      var at = tops().indexOf(el), r = rangeOf(el), kind = el.getAttribute("data-bk"), lines = srcLines(r), esc = ctx.H.esc, html, title, build, o;
      function field(label, id, v) { return '<p><label>' + label + '<br><input id="' + id + '" type="text" class="edw-fin" style="width:100%;box-sizing:border-box;max-width:none" spellcheck="false" autocomplete="off" value="' + esc(v) + '"></label></p>'; }
      function area(label, id, v, mono) { return '<p><label>' + label + '<br><textarea id="' + id + '" rows="8" class="edw-fin" style="width:100%;box-sizing:border-box;max-width:none;' + (mono ? "font:13px/1.4 ui-monospace,Consolas,monospace;white-space:pre;" : "") + '" spellcheck="' + (mono ? "false" : "true") + '">' + esc(v) + "</textarea></label></p>"; }
      function val(id) { var f = document.getElementById(id); return f ? f.value : ""; }
      hideHandle();
      if (kind === "code") {
        o = parseCode(lines); if (!o) return;
        title = "Code box"; html = field("Language (leave empty for plain text)", "ed-p-lang", o.lang) + area("Code", "ed-p-body", o.body, true);
        build = function () { o.lang = val("ed-p-lang").trim().replace(/[^A-Za-z0-9+#.-]/g, "").slice(0, 20); o.body = val("ed-p-body").replace(/\r\n?/g, "\n"); return buildCode(o); };
      } else if (kind === "fig") {
        o = parseFig(lines[0]); if (!o) return;
        title = "Picture"; html = field("Picture file or address", "ed-p-src", o.src) + field("Description (alt text, for screen readers)", "ed-p-alt", o.alt) + field("Caption (empty for none)", "ed-p-cap", o.caption) + field("Options (for example right 240 or left or center)", "ed-p-opt", o.opts);
        build = function () { o.src = val("ed-p-src").trim(); o.alt = val("ed-p-alt"); o.caption = val("ed-p-cap"); o.opts = val("ed-p-opt").trim(); return o.src ? [buildFig(o)] : null; };
      } else if (PROPS[kind]) {
        o = parseQuote(lines);
        title = "Notice, infobox or quote";
        html = '<p><label>Type<br><select id="ed-p-kind" class="edw-fin" style="max-width:none">' + KINDS.map(function (k) { return '<option value="' + k + '"' + (k === o.kind ? " selected" : "") + ">" + k.charAt(0).toUpperCase() + k.slice(1) + "</option>"; }).join("") + "</select></label></p>" +
          field("Title (infobox only)", "ed-p-title", o.title) + area("Text (the lines after the first; an infobox has Key: Value lines)", "ed-p-body", o.body, false);
        build = function () { o.kind = val("ed-p-kind") || o.kind; o.title = val("ed-p-title").trim(); o.body = val("ed-p-body").replace(/\r\n?/g, "\n").replace(/\s+$/, ""); return buildQuote(o); };
      } else return;
      ctx.dlg.ask({ title: title, html: html, ok: "OK", cancel: "Cancel" }).then(function (ok) {
        if (!ok) { reselect(at); return; }
        var out = build();
        if (!out) { ctx.say("Not changed: a picture needs a file or address"); return; }
        if (srcLines(r).join("\n") === out.join("\n")) { reselect(at); return; }
        applyText(replaceLines(ta.value, r[0], r[1], out.join("\n")).text, "Changed lines " + r[0] + " to " + r[1]);
        reselect(at);
      });
    }
    /* dragging the grip on the handle moves the block among the others; a line shows where it would land */
    var drag = null, drop = null, dropbox = null;
    function floated(el) { return !figBar(el) && getComputedStyle(el).cssFloat !== "none"; }   /* a side picture with its strip is a block of the text, like the others */
    /* where a block of the text flow sits among the blocks: the gap line between the flow block before index k and the one at k (a floated picture does not take part: it sits beside the text) */
    function gapAt(list, k, rects, top) {
      function rc(i) { return rects ? rects[i] : flowRect(list[i]); }
      var a = k - 1, b = k, above = null, below = null;
      while (a >= 0 && floated(list[a])) a--;
      while (b < list.length && floated(list[b])) b++;
      if (a >= 0) above = rc(a).bottom;
      if (b < list.length) below = rc(b).top;
      if (above === null && below === null) return null;
      if (above === null) return below - 8;
      if (below === null) return above + 8;
      if (below < above) return below - 8;
      if (below - above < 6) return above;  
      /* beside a picture the text blocks around it are far apart (the picture stands in the space): the line then goes in the ordinary gap at the end of that space, below the picture, or at its start for the picture's own anchor line */
      if (below - above > 48) {
        var fb = above, i;
        for (i = a + 1; i < b; i++) if (floated(list[i])) fb = Math.max(fb, rc(i).bottom);
        return top ? above + 12 : Math.min(below - 4, Math.max(below - 12, fb + 8));
      }
      return (above + below) / 2;
    }
    /* how far a line in the gap in front of block k reaches across: the width of the text blocks above and below it (the narrower one, when a picture floated to a side makes one of them narrower), so that the line never crosses a picture */
    function gapSpan(list, k, rects) {
      function rc(i) { return rects ? rects[i] : flowRect(list[i]); }
      var a = k - 1, b = k, g = gp().getBoundingClientRect(), left = g.left, right = g.right;
      while (a >= 0 && floated(list[a])) a--;
      while (b < list.length && floated(list[b])) b++;
      [a, b].forEach(function (i) { if (i >= 0 && i < list.length) { var r = rc(i); left = Math.max(left, r.left); right = Math.min(right, r.right); } });
      return { left: left, right: Math.max(right, left + 40) };
    }
    function dropAt(y, rects) {   /* the index in front of which a block dropped at height y would go (tops().length: at the end); pictures floated to a side are passed over, so the choice follows the text */
      var list = tops(), k;
      for (k = 0; k < list.length; k++) { if (floated(list[k])) continue; var b = rects ? rects[k] : flowRect(list[k]); if (y < b.top + b.height / 2) return k; }
      return list.length;
    }
    function dragMove(e) {
      if (!drag) return;
      var list = tops();
      if (!drag.moved) {
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 5) return;
        drag.moved = true; drag.rects = list.map(flowRect); drag.figRect = drag.el.getBoundingClientRect(); drag.top0 = drag.rects[drag.from].top;
        drag.pic = drag.el.getAttribute("data-bk") === "fig"; drag.side0 = drag.side = /fig-(left|right|center)/.exec(drag.el.className) ? RegExp.$1 : "";   /* the layout as it was when the block was picked up */
        drag.el.classList.add("vis-lift"); if (figBar(drag.el)) figBar(drag.el).classList.add("vis-lift");
      }
      var dy = e.clientY - drag.y;
      var tf = "translate(" + Math.round(e.clientX - drag.x) + "px, " + Math.round(dy) + "px)";   /* the block follows the pointer */
      drag.el.style.transform = tf; if (figBar(drag.el)) figBar(drag.el).style.transform = "translateY(" + Math.round(dy) + "px)";   /* the strip is as wide as the page: it only follows up and down */
      /* the place is chosen by where the block's top edge is, not by the pointer (which may be anywhere on a tall block or picture) */
      var k = dropAt(drag.top0 + dy, drag.rects), g = gp().getBoundingClientRect(), at = gapAt(list, k, drag.rects);
      /* the line sits in the middle of the gap between the two blocks of text it falls between (8px off the edge of the first or last block), and as wide as the shaded blocks */
      if (at === null) return;
      at -= 1.5;
      if (drag.pic) {   /* a picture also takes a side from where its middle is across the column: left, center or right (a small sideways move leaves it as it is) */
        var rc = drag.figRect, dx = e.clientX - drag.x, f = (rc.left + rc.width / 2 + dx - g.left) / g.width;
        drag.side = Math.abs(dx) < 24 ? drag.side0 : f < 1 / 3 ? "left" : f > 2 / 3 ? "right" : "center";
        if (figBar(drag.el)) figBar(drag.el).style.visibility = drag.side === "center" ? "hidden" : "";   /* a centered picture has no strip, so it goes while that place is chosen */
        /* all three places are drawn at the drop line: the one the picture will take is solid, the other two are faint ghosts */
        if (!dropbox) {
          dropbox = {};
          ["left", "center", "right"].forEach(function (sd) { var b = dropbox[sd] = document.createElement("div"); b.className = "edw-dropbox"; ta.closest(".edw").appendChild(b); });
        }
        var bw = rc.width;
        ["left", "center", "right"].forEach(function (sd) {
          var b = dropbox[sd], bl = sd === "left" ? g.left : sd === "center" ? g.left + (g.width - bw) / 2 : g.right - bw;
          b.hidden = false; b.classList.toggle("ghost", sd !== drag.side);
          b.style.width = Math.round(bw) + "px"; b.style.height = Math.round(rc.height) + "px"; b.style.left = Math.round(bl) + "px";
          b.style.top = Math.round(at + 9 + 16 + 24) + "px";   /* level with the dragged picture whichever place is chosen: a side picture hangs below its strip (16px) and the gap under it, and the centered ghost is lined up with them */
        });
      }
      drag.k = k;
      if (!drop) { drop = document.createElement("div"); drop.className = "edw-drop"; ta.closest(".edw").appendChild(drop); }
      drop.setAttribute("data-label", "");
      drop.hidden = false; drop.style.top = Math.round(at) + "px"; var sp3 = gapSpan(list, k, drag.rects); drop.style.left = Math.round(sp3.left) + "px"; drop.style.width = Math.round(sp3.right - sp3.left) + "px";
    }
    function dragEnd(e) {
      if (!drag) return;
      var d = drag; drag = null;
      document.removeEventListener("pointermove", dragMove); document.removeEventListener("pointerup", dragEnd); document.removeEventListener("pointercancel", dragEnd);
      if (drop) drop.hidden = true;
      if (dropbox) ["left", "center", "right"].forEach(function (sd) { dropbox[sd].hidden = true; });
      d.el.classList.remove("vis-lift"); d.el.style.transform = ""; if (figBar(d.el)) { figBar(d.el).classList.remove("vis-lift"); figBar(d.el).style.transform = ""; figBar(d.el).style.visibility = ""; }
      if (!d.moved) return;
      swallow = true; setTimeout(function () { swallow = false; }, 250);   /* the click that ends a drag is not a click on the block, whether or not the block moved */
      var to = d.k > d.from ? d.k - 1 : d.k, text = ta.value, sided = false;
      if (e.type === "pointercancel" || d.k < 0) return;
      if (d.pic && d.side && d.side !== d.side0) { var fs = setFigSide(text, d.ranges[d.from][0], d.side); if (fs !== null) { text = fs; sided = true; } }
      if (to === d.from && !sided) return;
      var next = to === d.from ? text : moveBlockTo(text, d.ranges, d.from, to);
      hideHandle();
      if (next === null) ctx.say("Not moved: there is something between the blocks"); else applyText(next, sided ? "Moved the picture to the " + d.side : "Moved the block");
    }
    /* a block moves when it is dragged: press on it (when it is not being edited) and move the pointer a few pixels; a plain click still selects or edits */
    var swallow = false;
    prev.addEventListener("pointerdown", function (e) {
      if (!on || cur || e.button || (e.pointerType !== "mouse" && e.pointerType !== "pen")) return;
      var el = topOf(e.target), list = tops(), from = el ? list.indexOf(el) : -1;
      if (from < 0) return;
      drag = { from: from, k: -1, ranges: list.map(rangeOf), el: el, x: e.clientX, y: e.clientY, moved: false };
      document.addEventListener("pointermove", dragMove); document.addEventListener("pointerup", dragEnd); document.addEventListener("pointercancel", dragEnd);
    });
    /* a table row or column added or removed from the cell being edited */
    function tableOp(op) {
      var c = cur; if (!c || c.kind !== "cell") return;
      var tbl = c.el.closest('[data-bk="table"]'), tl = tbl && rangeOf(tbl), tr = c.el.closest("tr"), at = tr && tl ? P.pick.parseLn(tr.getAttribute("data-ln"))[0] - tl[0] : -1, col = c.idx;
      if (!tl || at < 0) return;
      end();   /* the cell's own change is written first */
      var lines = srcLines(tl), out = null;
      if (op === "rowa") out = at < 1 ? null : tableAddRow(lines, at - 1);
      else if (op === "rowb") out = tableAddRow(lines, at);
      else if (op === "rowd") out = tableDelRow(lines, at);
      else if (op === "cola") out = tableAddCol(lines, col, false);
      else if (op === "colb") out = tableAddCol(lines, col, true);
      else if (op === "cold") out = tableDelCol(lines, col);
      if (!out) { ctx.say(op === "rowa" || op === "rowd" ? "Not changed: the header row stays first and cannot be removed" : "Not changed: a table keeps at least one column"); return; }
      applyText(replaceLines(ta.value, tl[0], tl[1], out.join("\n")).text, "Changed the table");
    }

    /* ---- the bar ---- */
    function marked() {   /* the formatting under the caret */
      var out = {};
      try { out.b = document.queryCommandState("bold"); out.i = document.queryCommandState("italic"); } catch (e) {}
      var n = window.getSelection().anchorNode;
      n = n && n.nodeType === 3 ? n.parentNode : n;
      out.c = !!(n && n.closest && n.closest("code") && cur && cur.el.contains(n));
      out.a = !!(n && n.closest && n.closest("a") && cur && cur.el.contains(n));
      return out;
    }
    function showBar(c) {
      if (!bar) {
        bar = document.createElement("div");
        bar.className = "edw-vbar"; bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Format the block being edited");
        bar.innerHTML = '<button type="button" data-a="b" title="Bold (Ctrl+B)"><b>B</b></button><button type="button" data-a="i" title="Italic (Ctrl+I)"><i>I</i></button>' +
          '<button type="button" data-a="c" title="Inline code">&lt;/&gt;</button><button type="button" data-a="a" title="Link (Ctrl+K)">Link</button>' +
          '<span class="edw-vtab"><button type="button" data-a="rowa" title="Add a row above">+Row&uarr;</button><button type="button" data-a="rowb" title="Add a row below">+Row&darr;</button><button type="button" data-a="rowd" title="Delete this row">&minus;Row</button>' +
          '<button type="button" data-a="cola" title="Add a column to the left">+Col&larr;</button><button type="button" data-a="colb" title="Add a column to the right">+Col&rarr;</button><button type="button" data-a="cold" title="Delete this column">&minus;Col</button></span>' +
          '<select data-a="block" aria-label="Block type"><option value="p">Paragraph</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="h4">Heading 4</option><option value="h5">Heading 5</option><option value="h6">Heading 6</option><option value="li">Bullet item</option><option value="quote">Quote</option></select>';
        bar.addEventListener("mousedown", function (e) { if (e.target.tagName !== "SELECT") e.preventDefault(); });   /* the caret and selection in the block stay */
        bar.addEventListener("click", function (e) { var b = e.target.closest("button[data-a]"); if (b) act(b.getAttribute("data-a")); });
        bar.addEventListener("change", function (e) { if (e.target.tagName === "SELECT") convert(e.target.value); });
        ta.closest(".edw").appendChild(bar);
      }
      var plain = c.kind === "h", sel = bar.querySelector("select");
      Array.prototype.forEach.call(bar.querySelectorAll("button"), function (b) { b.disabled = plain; });   /* a heading is plain words */
      bar.querySelector(".edw-vtab").hidden = c.kind !== "cell";
      sel.hidden = c.kind === "cell"; sel.disabled = c.kind === "li";
      sel.value = c.kind === "h" ? c.el.tagName.toLowerCase() : "p";
      if (!sel.value) sel.value = "p";
      bar.hidden = false;
      placeBar(); syncBar();
    }
    function hideBar() { if (bar) bar.hidden = true; }
    function placeBar() {
      if (!bar || bar.hidden || !cur) return;
      var r = cur.el.getBoundingClientRect(), root = ta.closest(".edw").getBoundingClientRect(), w = bar.offsetWidth, h = bar.offsetHeight;
      var top = r.top - h - 8 < root.top ? r.bottom + 8 : r.top - h - 8, left = Math.max(root.left + 4, Math.min(r.left, root.right - w - 4));
      bar.style.top = Math.round(top) + "px"; bar.style.left = Math.round(left) + "px";
    }
    function syncBar() {
      if (!bar || bar.hidden) return;
      var m = marked();
      ["b", "i", "c", "a"].forEach(function (k) { bar.querySelector('[data-a="' + k + '"]').setAttribute("aria-pressed", String(!!m[k])); });
    }
    function act(a) {
      if (!cur) return;
      var el = cur.el;
      if (a === "b") document.execCommand("bold");
      else if (a === "i") document.execCommand("italic");
      else if (a === "c") toggleCode();
      else if (a === "a") { link(); return; }
      else if (/^(row|col)[abd]$/.test(a)) { tableOp(a); return; }
      el.focus(); syncBar();
    }
    function toggleCode() {
      var sel = window.getSelection(); if (!sel.rangeCount) return;
      var n = sel.anchorNode, code = (n && n.nodeType === 3 ? n.parentNode : n).closest("code");
      if (code && cur.el.contains(code)) { code.replaceWith(document.createTextNode(code.textContent)); return; }
      var t = sel.toString();
      if (t) document.execCommand("insertHTML", false, "<code>" + t.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</code>");
    }
    function link() {
      var sel = window.getSelection(); if (!sel.rangeCount) return;
      var saved = sel.getRangeAt(0).cloneRange(), n = sel.anchorNode, a = (n && n.nodeType === 3 ? n.parentNode : n).closest("a"), host = cur.el;
      var was = a && host.contains(a) ? (a.getAttribute("data-href") || a.getAttribute("href") || "") : "";
      if (!was && saved.collapsed) { ctx.say("Select the words to link first"); return; }
      ctx.dlg.ask({ title: was ? "Change the link" : "Add a link", html: '<p><label>Address or page<br><input id="ed-vlink" type="text" class="edw-fin" style="width:100%;box-sizing:border-box;max-width:none" spellcheck="false" autocomplete="off"></label></p><p><small>For example https://example.com or #/guide/page-name. Leave it empty to remove the link.</small></p>', ok: "OK", cancel: "Cancel" }).then(function (ok) {
        var f = document.getElementById("ed-vlink"), v = f ? f.value.trim() : "";
        if (!ok || !cur || cur.el !== host) return;
        host.focus(); sel.removeAllRanges(); sel.addRange(saved);
        if (!v) document.execCommand("unlink");
        else if (a && host.contains(a)) { a.setAttribute("href", v); a.removeAttribute("data-href"); }
        else document.execCommand("createLink", false, v);
        syncBar();
      });
      setTimeout(function () { var f = document.getElementById("ed-vlink"); if (f) { f.value = was; f.focus(); f.select(); } }, 0);
    }

    prev.addEventListener("mouseover", function (e) { if (on && !cur) { setHot(unitOf(targetOf(e.target)) || wholeOf(e.target)); var t = topOf(e.target); if (t) showHandle(t); else later(); } });
    prev.addEventListener("mouseleave", function () { if (on) { setHot(kbdAt >= 0 ? tops()[kbdAt] || null : null); later(); } });
    prev.addEventListener("click", function (e) {
      if (!on) return;
      if (swallow) { swallow = false; e.preventDefault(); e.stopPropagation(); return; }   /* the click that ends a drag is not a click on the block */
      var target = targetOf(e.target), whole = !target && wholeOf(e.target);
      if (whole && !cur) { e.preventDefault(); e.stopPropagation(); setSel(whole); showHandle(whole); return; }   /* the shaded area of a list or table selects it */
      if (cur && (target === cur.el || cur.el.contains(e.target))) return;   /* a click inside the block being edited moves the caret */
      e.preventDefault(); e.stopPropagation();   /* before the handler that keeps links in the preview inert */
      if (cur) {   /* ending the edit draws the preview again: the clicked place is then found by its number among the cells and blocks */
        var old = cur.el, all = prev.querySelectorAll("[data-ln], td, th"), nth = target ? Array.prototype.indexOf.call(all, target) : -1;
        end(); old.blur();
        if (nth >= 0) target = prev.querySelectorAll("[data-ln], td, th")[nth];
      }
      if (target && target.isConnected && prev.contains(target)) {
        if (unitOf(target) === selEl) begin(target);
        else { setSel(unitOf(target)); var tp = topOf(target); if (tp) showHandle(tp); }
      }
      else if (!target) {
        var b = blockOf(e.target), ln = b && P.pick.parseLn(b.getAttribute("data-ln"));
        if (ln && !whole && !EDITABLE[b.getAttribute("data-bk")] && !PROPS[b.getAttribute("data-bk")]) pickLines(ln, "This kind of block cannot be edited here yet");
      }
    }, true);
    prev.addEventListener("focusout", function (e) { if (cur && e.target === cur.el && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(".edw-vbar"))) end(); });
    prev.addEventListener("keydown", function (e) {
      if (!cur || e.target !== cur.el) return;
      if (e.key === "Enter") { e.preventDefault(); if (!e.shiftKey) { var el = cur.el; end(); el.blur(); } }   /* a block here is one line of text */
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cur.cancelled = true; var el2 = cur.el; end(); el2.blur(); }
      else if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === "k" || e.key === "K") && cur.kind !== "h") { e.preventDefault(); act("a"); }
    });
    document.addEventListener("selectionchange", function () { if (ta.isConnected) syncBar(); });
    window.addEventListener("resize", function () { placeBar() });
    prev.parentNode.addEventListener("scroll", function () {
      placeBar(); backToSel(); syncGrips(hEl);
      /* the add-block line is fixed on the screen, so it goes while the page moves under it and is drawn again, in the right gap, once the scrolling pauses */
      if (gapBtn && !gapBtn.hidden && !(menu && !menu.hidden)) { gapBtn.hidden = true; apart(); }
      cancelAnimationFrame(gapRaf); clearTimeout(gapT);
      gapT = setTimeout(function () { if (lastPtr && document.querySelector(".edw-pv:hover")) showGap(lastPtr); }, 120);
    });
    document.addEventListener("click", function (e) { if (menu && !menu.hidden && !menu.contains(e.target) && !(handle && handle.contains(e.target)) && !(gapBtn && gapBtn.contains(e.target))) { hideMenu(); hideHandle(); } });
    prev.addEventListener("paste", function (e) {   /* only the words: the pasted formatting would not survive the trip to Markdown */
      if (!cur || e.target !== cur.el) return;
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData("text") || "";
      document.execCommand("insertText", false, t.replace(/\s*\n\s*/g, " "));
    });
    prev.addEventListener("dragstart", function (e) { if (cur || on) e.preventDefault(); });
    btn.addEventListener("click", function () { ctx.toggle(); });
    /* the keyboard's place among the blocks while none is selected: shown as the hover highlight, with the block's menu */
    var kbdAt = -1;
    function cursorTo(idx) {
      var t = tops()[idx]; if (!t) return;
      kbdAt = idx; setHot(t); showHandle(t);
      if (prev.parentNode.focus) prev.parentNode.focus({ preventScroll: true });
      t.scrollIntoView({ block: "nearest" });
    }
    function keys(e) {   /* Esc turns the mode off */
      if (!ta.isConnected) { document.removeEventListener("keydown", keys); return; }
      if (!on || cur || e.defaultPrevented) return;
      var tg = e.target && e.target.tagName;
      if ((e.key === "Enter" || e.key === "F2") && selEl && selEl.isConnected && !/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(tg || "")) { e.preventDefault(); begin(selEl); }
      else if (e.key === "Enter" && !(selEl && selEl.isConnected) && kbdAt >= 0 && tops()[kbdAt] && !/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(tg || "")) {   /* Enter selects the block the arrow keys are on */
        e.preventDefault(); var pickEl = tops()[kbdAt]; setSel(pickEl); showHandle(pickEl);
      }
      else if (e.key === "Escape") { if (selEl) { kbdAt = tops().indexOf(topOf(selEl)); setSel(null); hideHandle(); if (kbdAt >= 0) cursorTo(kbdAt); } else { kbdAt = -1; setHot(null); ctx.off(); } }
      else if (!(selEl && selEl.isConnected) && (e.key === "ArrowUp" || e.key === "ArrowDown") && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(tg || "") && !e.target.isContentEditable && (e.target === document.body || prev.parentNode.contains(e.target))) {
        /* nothing is selected: Up and Down move a highlight from block to block (it starts at the first or last block in view); Enter selects the highlighted block */
        var list = tops(), pv = prev.parentNode.getBoundingClientRect(), to = -1, k;
        if (kbdAt >= 0 && kbdAt < list.length) to = Math.max(0, Math.min(list.length - 1, kbdAt + (e.key === "ArrowDown" ? 1 : -1)));
        else for (k = 0; k < list.length; k++) {
          var rc = uRect(list[k]), shown = rc.top >= pv.top - 1 && rc.top < pv.bottom;
          if (shown && e.key === "ArrowDown") { to = k; break; }
          if (shown && rc.bottom <= pv.bottom + 1) to = k;
        }
        if (to >= 0) { e.preventDefault(); cursorTo(to); }
      }
      else if (selEl && selEl.isConnected && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(tg || "") && !(e.target.isContentEditable) && nudge(e)) e.preventDefault();
    }
    /* quick changes to the selected block from the keyboard: Up and Down move it; for a picture, Left and Right change its side and + and - change its width (Shift: bigger steps) */
    var SIDES = ["left", "center", "right"];
    function nudge(e) {
      var el = topOf(selEl), list = tops(), i = el ? list.indexOf(el) : -1, key = e.key;
      if (i < 0) return false;
      var pic = el.getAttribute("data-bk") === "fig", r = rangeOf(el), next = null, note = "";
      if (key === "ArrowUp" || key === "ArrowDown") { hEl = el; structure(key === "ArrowUp" ? "up" : "down"); after(i + (key === "ArrowUp" ? -1 : 1)); return true; }
      if (key === "Delete" || key === "Backspace") {   /* the block goes (Ctrl+Z brings it back); the keyboard highlight moves to the block that took its place */
        hEl = el; structure("del");
        cursorTo(Math.min(i, tops().length - 1));
        return true;
      }
      if (!pic) return false;
      if (key === "ArrowLeft" || key === "ArrowRight") {
        var cls = /fig-(left|right|center)/.exec(el.className), at = SIDES.indexOf(cls ? cls[1] : "right"), to = Math.max(0, Math.min(2, at + (key === "ArrowLeft" ? -1 : 1)));
        if (to === at) return true;
        next = setFigSide(ta.value, r[0], SIDES[to]); note = "Picture side: " + SIDES[to];
      } else if (/^[-+=_]$/.test(key)) {
        var w = parseFloat(getComputedStyle(el).width), step = e.shiftKey ? 50 : 10;
        next = setFigWidth(ta.value, r[0], w + (key === "-" || key === "_" ? -step : step)); note = "Picture width changed";
      } else return false;
      if (next !== null && next !== ta.value) { applyText(next, note); reselect(i); after(i); }
      return true;
    }
    function after(idx) {   /* the change put the caret in the text box: focus goes back to the preview so that the next key is read here too */
      var t = tops()[idx], pv = prev.parentNode;
      if (pv && pv.focus) pv.focus({ preventScroll: true });
      if (t && t.scrollIntoView) t.scrollIntoView({ block: "nearest" });
    }
    document.addEventListener("keydown", keys);
    return {
      sync: function (value) {   /* the mode was switched (button, View menu, Esc, or the saved setting) */
        if (cur && !value) end();
        on = !!value;
        btn.setAttribute("aria-pressed", String(on));
        prev.classList.toggle("vedit", on);
        setSel(null); setHot(null); if (!on) hideHandle();
        decorate();
      },
      clear: function () { decorate(); hotEl = null; selEl = null; kbdAt = -1; cur = null; hideBar(); hideHandle(); }   /* the preview was redrawn: the old element is gone */
    };
  };
})();
