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
  P.visual = { replaceLines: replaceLines, parseCode: parseCode, buildCode: buildCode, parseFig: parseFig, buildFig: buildFig, parseQuote: parseQuote, buildQuote: buildQuote, moveBlockTo: moveBlockTo, headPrefix: headPrefix, rewrite: rewrite, oneLine: oneLine, cellSpans: cellSpans, convertLine: convertLine, sourceWords: sourceWords, serialize: serialize,
    diffEdit: diffEdit, deleteBlock: deleteBlock, insertAfter: insertAfter, duplicateBlock: duplicateBlock, swapBlocks: swapBlocks, SNIPPETS: SNIPPETS, tableSnippet: tableSnippet,
    tableAddRow: tableAddRow, tableDelRow: tableDelRow, tableAddCol: tableAddCol, tableDelCol: tableDelCol };

  /* ---- in the page ---- */
  /* ctx: { ta, prev (the preview's article), btn (the Edit button), H (the renderer), say(text), toggle(), off(), render(), opts() (the options the preview is drawn with), dlg (the dialog) }.
     render() draws the preview again after a change. */
  P.visualEditor = function (ctx) {
    var ta = ctx.ta, prev = ctx.prev, btn = ctx.btn, on = false, hotEl = null, cur = null, bar = null;
    /* cur: { el (what is editable), lines (the source lines it covers), kind (p, h, li or cell), idx (the cell), before (innerHTML), src, cancelled } */

    function blockOf(node) {
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
    function setHot(el) {
      if (el === hotEl) return;
      if (hotEl) hotEl.classList.remove("vis-hot");
      hotEl = el;
      if (el) el.classList.add("vis-hot");
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
      if (!handle) {
        handle = document.createElement("div");
        handle.className = "edw-vbar edw-handle"; handle.setAttribute("role", "toolbar"); handle.setAttribute("aria-label", "Change this block");
        handle.innerHTML = '<button type="button" data-s="drag" class="edw-grip" title="Drag to move this block" aria-label="Drag to move this block">&#8942;&#8942;</button><button type="button" data-s="up" title="Move up" aria-label="Move up">&uarr;</button><button type="button" data-s="down" title="Move down" aria-label="Move down">&darr;</button>' +
          '<button type="button" data-s="props" title="Change the type, picture details or code of this block">Edit&hellip;</button><button type="button" data-s="dup" title="Duplicate this block">Duplicate</button><button type="button" data-s="del" title="Delete this block">Delete</button><button type="button" data-s="add" title="Add a block after this one" aria-haspopup="true">+ Add</button>';
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
      var r = el.getBoundingClientRect(), root = ta.closest(".edw").getBoundingClientRect(), pv = prev.parentNode.getBoundingClientRect(), w = handle.offsetWidth, h = handle.offsetHeight;
      var top = r.top - h - 2 < pv.top ? Math.min(r.top + 2, pv.bottom - h - 2) : r.top - h - 2;
      handle.style.top = Math.round(top) + "px"; handle.style.left = Math.round(Math.max(root.left + 4, Math.min(r.right - w, root.right - w - 4))) + "px";
    }
    function later() { clearTimeout(hideT); hideT = setTimeout(function () { if (!drag && (!menu || menu.hidden)) hideHandle(); }, 350); }
    function hideHandle() { clearTimeout(hideT); if (handle) handle.hidden = true; hEl = null; hideMenu(); }
    function hideMenu() { if (menu) menu.hidden = true; }
    function structure(act, btn) {
      var r = rangeOf(hEl), list = tops(), i = list.indexOf(hEl), text = ta.value, next;
      if (act === "del") { hideHandle(); applyText(deleteBlock(text, r[0], r[1]), "Deleted lines " + r[0] + " to " + r[1]); return; }
      if (act === "dup") { var d = duplicateBlock(text, r[0], r[1]); hideHandle(); applyText(d.text, "Duplicated"); return; }
      if (act === "up" || act === "down") {
        var other = list[i + (act === "up" ? -1 : 1)];
        if (!other) return;
        var o = rangeOf(other);
        next = act === "up" ? swapBlocks(text, o, r) : swapBlocks(text, r, o);
        hideHandle();
        if (next === null) ctx.say("Not moved: there is something between the two blocks");
        else applyText(next, "Moved the block " + act);
        return;
      }
      if (act === "props") { var pe = hEl; hideHandle(); openProps(pe); return; }
      if (act === "add") openMenu(btn);
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
      menu.style.top = Math.round(top) + "px"; menu.style.left = Math.round(Math.max(root.left + 4, Math.min(r.right - w, root.right - w - 4))) + "px";
    }
    function insert(name) {
      var r = rangeOf(hEl);
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
      var r = rangeOf(el), kind = el.getAttribute("data-bk"), lines = srcLines(r), esc = ctx.H.esc, html, title, build, o;
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
        if (!ok) return;
        var out = build();
        if (!out) { ctx.say("Not changed: a picture needs a file or address"); return; }
        if (srcLines(r).join("\n") === out.join("\n")) return;
        applyText(replaceLines(ta.value, r[0], r[1], out.join("\n")).text, "Changed lines " + r[0] + " to " + r[1]);
      });
    }
    /* dragging the grip on the handle moves the block among the others; a line shows where it would land */
    var drag = null, drop = null;
    function dropAt(y) {   /* the index in front of which a block dropped at height y would go (tops().length: at the end) */
      var list = tops(), k;
      for (k = 0; k < list.length; k++) { var b = list[k].getBoundingClientRect(); if (y < b.top + b.height / 2) return k; }
      return list.length;
    }
    function dragMove(e) {
      if (!drag) return;
      var list = tops(), k = dropAt(e.clientY), at = k < list.length ? list[k].getBoundingClientRect().top - 3 : list[list.length - 1].getBoundingClientRect().bottom + 3, pv = prev.getBoundingClientRect();
      drag.k = k;
      if (!drop) { drop = document.createElement("div"); drop.className = "edw-drop"; ta.closest(".edw").appendChild(drop); }
      drop.hidden = false; drop.style.top = Math.round(at) + "px"; drop.style.left = Math.round(pv.left) + "px"; drop.style.width = Math.round(pv.width) + "px";
    }
    function dragEnd(e) {
      if (!drag) return;
      var d = drag; drag = null;
      document.removeEventListener("pointermove", dragMove); document.removeEventListener("pointerup", dragEnd); document.removeEventListener("pointercancel", dragEnd);
      if (drop) drop.hidden = true;
      var to = d.k > d.from ? d.k - 1 : d.k;
      if (e.type === "pointercancel" || d.k < 0 || to === d.from) return;
      var next = moveBlockTo(ta.value, d.ranges, d.from, to);
      hideHandle();
      if (next === null) ctx.say("Not moved: there is something between the blocks"); else applyText(next, "Moved the block");
    }
    document.addEventListener("pointerdown", function (e) {
      var g = e.target.closest && e.target.closest('.edw-handle [data-s="drag"]');
      if (!g || !hEl || e.button) return;
      e.preventDefault();
      var list = tops();
      drag = { from: list.indexOf(hEl), k: -1, ranges: list.map(rangeOf) };
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

    prev.addEventListener("mouseover", function (e) { if (on && !cur) { setHot(targetOf(e.target)); var t = topOf(e.target); if (t) showHandle(t); else later(); } });
    prev.addEventListener("mouseleave", function () { if (on) { setHot(null); later(); } });
    prev.addEventListener("click", function (e) {
      if (!on) return;
      var target = targetOf(e.target);
      if (cur && (target === cur.el || cur.el.contains(e.target))) return;   /* a click inside the block being edited moves the caret */
      e.preventDefault(); e.stopPropagation();   /* before the handler that keeps links in the preview inert */
      if (cur) {   /* ending the edit draws the preview again: the clicked place is then found by its number among the cells and blocks */
        var old = cur.el, all = prev.querySelectorAll("[data-ln], td, th"), nth = target ? Array.prototype.indexOf.call(all, target) : -1;
        end(); old.blur();
        if (nth >= 0) target = prev.querySelectorAll("[data-ln], td, th")[nth];
      }
      if (target && target.isConnected && prev.contains(target)) begin(target);
      else if (!target) {
        var b = blockOf(e.target), ln = b && P.pick.parseLn(b.getAttribute("data-ln"));
        if (ln && !EDITABLE[b.getAttribute("data-bk")] && !PROPS[b.getAttribute("data-bk")]) pickLines(ln, "This kind of block cannot be edited here yet");
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
    window.addEventListener("resize", placeBar);
    prev.parentNode.addEventListener("scroll", function () { placeBar(); hideHandle(); });
    document.addEventListener("click", function (e) { if (menu && !menu.hidden && !menu.contains(e.target) && !(handle && handle.contains(e.target))) { hideMenu(); hideHandle(); } });
    prev.addEventListener("paste", function (e) {   /* only the words: the pasted formatting would not survive the trip to Markdown */
      if (!cur || e.target !== cur.el) return;
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData("text") || "";
      document.execCommand("insertText", false, t.replace(/\s*\n\s*/g, " "));
    });
    prev.addEventListener("dragstart", function (e) { if (cur) e.preventDefault(); });
    btn.addEventListener("click", function () { ctx.toggle(); });
    function keys(e) {   /* Esc turns the mode off */
      if (!ta.isConnected) { document.removeEventListener("keydown", keys); return; }
      if (on && !cur && e.key === "Escape" && !e.defaultPrevented) ctx.off();
    }
    document.addEventListener("keydown", keys);
    return {
      sync: function (value) {   /* the mode was switched (button, View menu, Esc, or the saved setting) */
        if (cur && !value) end();
        on = !!value;
        btn.setAttribute("aria-pressed", String(on));
        prev.classList.toggle("vedit", on);
        setHot(null); if (!on) hideHandle();
      },
      clear: function () { hotEl = null; cur = null; hideBar(); hideHandle(); }   /* the preview was redrawn: the old element is gone */
    };
  };
})();
