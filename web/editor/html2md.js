/* The guide editor: turns HTML (as copied from a web page or a word processor) into Markdown, for Edit > Paste Special > Paste HTML Content.
   It has its own small HTML reader, so it needs no page and can be tested on its own. P.htmlToMarkdown(html) returns the Markdown. */
(function () {
  "use strict";
  var P = window.udfopEditor = window.udfopEditor || {};
  var VOID = { br: 1, hr: 1, img: 1, meta: 1, link: 1, input: 1, area: 1, base: 1, col: 1, embed: 1, source: 1, track: 1, wbr: 1 };
  var SKIP = { style: 1, script: 1, head: 1, title: 1, template: 1, noscript: 1 };
  var INLINE = { a: 1, abbr: 1, b: 1, big: 1, cite: 1, code: 1, del: 1, dfn: 1, em: 1, font: 1, i: 1, img: 1, ins: 1, kbd: 1, label: 1, mark: 1, q: 1, s: 1, samp: 1, small: 1, span: 1, strike: 1, strong: 1, sub: 1, sup: 1, time: 1, tt: 1, u: 1, var: 1, br: 1, wbr: 1 };
  var MAX_DEPTH = 100;   /* real pages nest a dozen deep; anything much deeper would only overflow the stack */
  var NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bull: "•", middot: "·", copy: "©", reg: "®", trade: "™", times: "×", deg: "°", laquo: "«", raquo: "»" };
  function decode(s) {
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, function (m, e) {
      if (e.charAt(0) === "#") { var n = e.charAt(1) === "x" || e.charAt(1) === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return n === 160 ? " " : String.fromCodePoint(n); } catch (x) { return ""; } }
      return NAMED.hasOwnProperty(e) ? NAMED[e] : m;
    });
  }
  /* ---- reading the HTML into a tree of { tag, attrs, kids } and { text } ---- */
  function attrsOf(s) {
    var out = {}, re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g, m;
    while ((m = re.exec(s))) out[m[1].toLowerCase()] = decode(m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] || "");
    return out;
  }
  function parse(html) {
    var root = { tag: "#root", attrs: {}, kids: [] }, stack = [root], skip = 0;
    var re = /<!--[\s\S]*?-->|<![^>]*>|<\?[^>]*>|<(\/?)([a-zA-Z][a-zA-Z0-9:]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+)|</g, m;
    function top() { return stack[stack.length - 1]; }
    function closeIf(names) { while (stack.length > 1 && names[top().tag]) stack.pop(); }
    while ((m = re.exec(html))) {
      if (m[4] !== undefined) { if (!skip) top().kids.push({ text: decode(m[4]) }); continue; }
      if (!m[2]) continue;   /* a comment, a doctype or a stray < */
      var tag = m[2].toLowerCase();
      if (m[1]) {   /* a closing tag: close back to the matching open one, if there is one */
        var at = -1; for (var k = stack.length - 1; k > 0; k--) if (stack[k].tag === tag) { at = k; break; }
        if (at > 0) { while (stack.length > at) { var done = stack.pop(); if (SKIP[done.tag]) skip--; } }
        continue;
      }
      if (skip && !SKIP[tag]) continue;
      if (tag === "li") closeIf({ li: 1 }); else if (tag === "p") closeIf({ p: 1 });
      else if (tag === "td" || tag === "th") closeIf({ td: 1, th: 1 }); else if (tag === "tr") closeIf({ td: 1, th: 1, tr: 1 });
      else if (tag === "dt" || tag === "dd") closeIf({ dt: 1, dd: 1 });
      var node = { tag: tag, attrs: attrsOf(m[3]), kids: [] };
      top().kids.push(node);
      if (!VOID[tag] && !/\/\s*$/.test(m[3]) && stack.length < MAX_DEPTH) { stack.push(node); if (SKIP[tag]) skip++; }   /* past the depth limit a tag no longer holds what follows it, so the reader never nests deeper */
    }
    return root;
  }
  /* ---- writing the Markdown ---- */
  function squash(s) { return s.replace(/[ \t\r\n\f]+/g, " "); }
  function rawText(n) { return n.text !== undefined ? n.text : n.tag === "br" ? "\n" : n.kids.map(rawText).join(""); }
  function oneLine(s) { return s.replace(/\s*\n\s*/g, " ").trim(); }
  function wrap(mark, inner) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
    return m[2] ? m[1] + mark + m[2] + mark + m[3] : inner;
  }
  function safeUrl(u) { return u && !/^\s*(javascript|data|vbscript):/i.test(u) ? u.trim() : ""; }
  function inline(n) {
    if (n.text !== undefined) return squash(n.text);
    var inner = function () { return n.kids.map(inline).join(""); };
    switch (n.tag) {
      case "br": return "  \n";
      case "strong": case "b": return wrap("**", inner());
      case "em": case "i": case "cite": case "dfn": return wrap("*", inner());
      case "code": case "kbd": case "samp": case "tt": { var c = rawText(n).replace(/\s+/g, " ").trim(); return c ? "`" + c + "`" : ""; }
      case "a": { var href = safeUrl(n.attrs.href), t = inner(); return href && t.trim() && href.charAt(0) !== "#" ? "[" + t.trim().replace(/\]/g, "\\]") + "](" + href.replace(/ /g, "%20").replace(/\)/g, "%29") + ")" : t; }
      case "img": { var src = safeUrl(n.attrs.src), alt = (n.attrs.alt || "").replace(/[\[\]]/g, ""); return src ? "![" + alt + "](" + src.replace(/ /g, "%20") + ")" : alt; }
      default: return inner();
    }
  }
  /* trims each line, but keeps two spaces before a line break (that is how Markdown writes a break) */
  function tidy(s) { return s.replace(/([ \t]*)\n/g, function (m, sp) { return sp.length >= 2 ? "  \n" : "\n"; }).replace(/\n[ \t]+/g, "\n").replace(/ {2,}(?!\n)/g, " ").trim(); }
  function isInline(n) { return n.text !== undefined || INLINE[n.tag] || n.tag.indexOf(":") > 0; }   /* a tag with a colon (o:p, v:shape) comes from a word processor and is not a block */
  /* the blocks of a run of children: a string for each paragraph, list, table and so on */
  function blocks(kids) {
    var out = [], buf = "";
    function flush() { var t = tidy(buf); if (t) out.push(t); buf = ""; }
    kids.forEach(function (n) {
      if (isInline(n)) buf += inline(n);
      else { flush(); var b = block(n); if (b) out.push(b); }
    });
    flush();
    return out;
  }
  function cell(n) { return oneLine(blocks(n.kids).join(" ")).replace(/\|/g, "\\|"); }
  function table(n) {
    var rows = [];
    (function collect(x) { x.kids.forEach(function (k) { if (k.tag === "tr") rows.push(k.kids.filter(function (c) { return c.tag === "td" || c.tag === "th"; }).map(cell)); else if (k.tag) collect(k); }); })(n);
    var width = rows.reduce(function (w, r) { return Math.max(w, r.length); }, 0);
    if (!rows.length || !width) return "";
    rows = rows.map(function (r) { while (r.length < width) r.push(""); return r; });
    var line = function (r) { return "| " + r.join(" | ") + " |"; };
    return [line(rows[0]), line(rows[0].map(function () { return "---"; }))].concat(rows.slice(1).map(line)).join("\n");
  }
  function list(n, ordered) {
    var items = n.kids.filter(function (k) { return k.tag === "li"; }), start = parseInt(n.attrs.start, 10) || 1;
    return items.map(function (li, i) {
      var bullet = ordered ? (start + i) + ". " : "- ", parts = blocks(li.kids), pad = new Array(bullet.length + 1).join(" ");
      return bullet + (parts.join("\n") || "").split("\n").map(function (l, j) { return j ? pad + l : l; }).join("\n");
    }).join("\n");
  }
  function block(n) {
    var m = /^h([1-6])$/.exec(n.tag);
    if (m) { var t = oneLine(blocks(n.kids).join(" ")); return t ? new Array(+m[1] + 1).join("#") + " " + t : ""; }
    switch (n.tag) {
      case "hr": return "---";
      case "pre": { var raw = rawText(n).replace(/^\n+|\s+$/g, ""); return raw ? "```\n" + raw + "\n```" : ""; }
      case "blockquote": { var b = blocks(n.kids).join("\n\n"); return b ? b.split("\n").map(function (l) { return l ? "> " + l : ">"; }).join("\n") : ""; }
      case "ul": case "menu": return list(n, false);
      case "ol": return list(n, true);
      case "table": return table(n);
      case "dt": { var d = oneLine(blocks(n.kids).join(" ")); return d ? "**" + d + "**" : ""; }
      case "li": return list({ kids: [n], attrs: {} }, false);
      default: return blocks(n.kids).join("\n\n");
    }
  }
  P.htmlToMarkdown = function (html) {
    var md = blocks(parse(String(html)).kids).join("\n\n");
    return md.replace(/\n{3,}/g, "\n\n").trim();
  };
})();
