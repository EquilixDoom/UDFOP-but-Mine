/* The guide editor: the colored Markdown source behind the text box. */
(function () {
  "use strict";
  var H = window.udfopHost, P = window.udfopEditor = window.udfopEditor || {};
  var esc = H.esc, FENCE = P.FENCE;
  /* The counts in braces, and leaving lines over P.MAX_LINE characters uncolored, keep a line of unclosed brackets from being rescanned from every opening one (it would take seconds). */
  /* colors the Markdown source; only colors (never weight or size), so the text lines up with the textarea above it */
  function inline(s) {
    if (s.length > P.MAX_LINE) return esc(s);
    var re = /(`[^`]+`)|(\[\[[^\]]{0,200}\]\])|(\{\{[^}]{0,200}\}\})|(!?\[[^\]]{0,200}\]\([^)]{0,300}\))|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(>![^!]*!<)|(\[\^[^\]\s]{1,100}\])/g, out = "", at = 0, m;
    while ((m = re.exec(s))) {
      out += esc(s.slice(at, m.index)); at = m.index + m[0].length;
      var cls = m[1] ? "c" : m[2] ? (P.linkOk(m[0].slice(2, -2)) ? "w" : "x") : m[3] ? "q" : m[4] ? "u" : m[5] || m[6] ? "b" : m[8] ? "q" : "m";
      out += '<span class="t-' + cls + '">' + esc(m[0]) + "</span>";
    }
    return out + esc(s.slice(at));
  }
  function span(c, s) { return '<span class="t-' + c + '">' + esc(s) + "</span>"; }
  var CARET = '<span class="mc"></span>';
  /* Draws selections and carets into a row's html. ranges: [[start, end]] and carets: [position], both sorted, in characters of the row's text (not counting its tags; an entity counts as one).
     Each selected stretch becomes one <mark class="sel"> (closed and reopened around tags so that the nesting stays valid); a caret is a zero-width <span class="mc">. */
  function decorate(html, ranges, carets, finds) {   /* finds: found stretches of a search, drawn as <mark class="find"> (or "sel find" where they are also selected) */
    var out = "", pos = 0, ri = 0, ci = 0, fi = 0, open = "", re = /<[^>]*>|[^<]+/g, m;
    finds = finds || [];
    function caretsAt(p) { while (ci < carets.length && carets[ci] <= p) { if (carets[ci] === p) out += CARET; ci++; } }
    function inRange(p) { while (ri < ranges.length && ranges[ri][1] <= p) ri++; return ri < ranges.length && ranges[ri][0] <= p; }
    function inFind(p) { while (fi < finds.length && finds[fi][1] <= p) fi++; return fi < finds.length && finds[fi][0] <= p; }
    while ((m = re.exec(html))) {
      var t = m[0];
      if (t.charAt(0) === "<") { if (open) { out += "</mark>"; open = ""; } out += t; continue; }
      var units = t.match(/&[#a-zA-Z0-9]+;|[\s\S]/g);
      for (var k = 0; k < units.length; k++) {
        caretsAt(pos);
        var want = (inRange(pos) ? "sel" : "") + (inFind(pos) ? (inRange(pos) ? " find" : "find") : "");
        if (open !== want) { if (open) out += "</mark>"; if (want) out += '<mark class="' + want + '">'; open = want; }
        out += units[k]; pos++;
      }
    }
    if (open) out += "</mark>";
    caretsAt(pos);
    return out;
  }
  /* Marks the characters that cannot be seen in a row's html (View > Show Symbol) without changing what the row says or how wide it is: each is wrapped in a span whose symbol the style sheet draws,
     and the line break is an empty span after the row. o: { ws, np, cc, guide }. Tabs are 2 columns wide, as in the text box. */
  var NP = /[\u00A0\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/, CC = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u2028\u2029]/;
  var NAMES = { 0: "NUL", 1: "SOH", 2: "STX", 3: "ETX", 4: "EOT", 5: "ENQ", 6: "ACK", 7: "BEL", 8: "BS", 11: "VT", 12: "FF", 13: "CR", 14: "SO", 15: "SI", 16: "DLE", 17: "DC1", 18: "DC2", 19: "DC3", 20: "DC4", 21: "NAK", 22: "SYN", 23: "ETB", 24: "CAN", 25: "EM", 26: "SUB", 27: "ESC", 28: "FS", 29: "GS", 30: "RS", 31: "US", 127: "DEL",
    0x85: "NEL", 0xAD: "SHY", 0x200B: "ZWSP", 0x200C: "ZWNJ", 0x200D: "ZWJ", 0x200E: "LRM", 0x200F: "RLM", 0x202A: "LRE", 0x202B: "RLE", 0x202C: "PDF", 0x202D: "LRO", 0x202E: "RLO", 0x2028: "LS", 0x2029: "PS", 0x2060: "WJ", 0x2066: "LRI", 0x2067: "RLI", 0x2068: "FSI", 0x2069: "PDI", 0xFEFF: "BOM" };
  function nameOf(c) { var n = c.charCodeAt(0); return NAMES[n] || "U+" + ("0000" + n.toString(16).toUpperCase()).slice(-4); }
  function symbolize(html, o) {
    if (!(o.ws || o.np || o.cc || o.guide)) return html;
    var re = /<[^>]*>|&[#a-zA-Z0-9]+;|[\s\S]/g, out = "", col = 0, lead = true, m, t, cls, g;
    while ((m = re.exec(html))) {
      t = m[0];
      if (t.charAt(0) === "<") { out += t; continue; }
      cls = ""; g = "";
      if (t === " " || t === "\t") {
        if (lead && o.guide && col % 2 === 0) cls = "ig";
        if (o.ws) cls += (cls ? " " : "") + (t === " " ? "sw" : "st");
      } else {
        lead = false;
        if (t.length === 1) {
          if (o.np && NP.test(t)) { cls = t === "\u00A0" ? "sn" : "sg"; g = t === "\u00A0" ? "" : nameOf(t); }
          else if (o.cc && CC.test(t)) { cls = "sg"; g = nameOf(t); }
        }
      }
      col += t === "\t" ? 2 - col % 2 : 1;
      out += cls ? '<span class="' + cls + '"' + (g ? ' data-g="' + g + '"' : "") + ">" + t + "</span>" : t;
    }
    return out;
  }
  /* the old form [start, end], or { ranges, carets } with offsets in the whole text */
  function selOf(sel) {
    if (!sel) return null;
    if (Array.isArray(sel)) return { ranges: sel[1] > sel[0] ? [[sel[0], sel[1]]] : [], carets: [], finds: [] };
    return { ranges: (sel.ranges || []).slice().sort(function (x, y) { return x[0] - y[0]; }), carets: (sel.carets || []).slice().sort(function (x, y) { return x - y; }), finds: sel.finds || [] };
  }
  /* one <div class="l"> per line of the text, as a list of strings (an empty line holds a zero-width space so it keeps its height).
     sel, [start, end] in the text, is drawn as a selection: the text box shows its own only while it has the focus.
     opts (the editor's View menu): { sym: { ws, eol, np, cc, guide }, cls: function (row) -> extra classes for the row } */
  function highlightRows(text, sel, opts) {
    var st = { fm: 0, fence: null }, out = [], at = 0, S = selOf(sel), ri = 0, ci = 0, fi = 0, sym = opts && opts.sym, lines = text.split("\n"), last = lines.length - 1;
    lines.forEach(function (l, i) {
      var m, h, ls = at; at += l.length + 1;
      if (i === 0 && /^---\s*$/.test(l)) { st.fm = 1; h = span("m", l); }
      else if (st.fm === 1) {
        if (/^---\s*$/.test(l)) { st.fm = 2; h = span("m", l); }
        else h = (m = /^([A-Za-z-]+)(:)(.*)$/.exec(l)) ? span("k", m[1]) + span("m", ":") + span("s", m[3]) : esc(l);
      }
      else if (st.fence) {
        m = /^(`{3,}|~{3,})\s*$/.exec(l);
        if (m && m[1].charAt(0) === st.fence.charAt(0) && m[1].length >= st.fence.length) { st.fence = null; h = span("m", l); } else h = span("s", l);
      }
      else if ((m = FENCE.exec(l))) { st.fence = m[1]; h = span("m", m[1]) + (m[2] ? span("k", l.slice(m[1].length)) : ""); }
      else if (/^#{1,6}\s/.test(l)) h = span("h", l);
      else if ((m = /^(\[\^[^\]\s]{1,100}\]:)(.*)$/.exec(l))) h = span("q", m[1]) + inline(m[2]);   /* a footnote's note line */
      else if ((m = /^(>\s?)(.*)$/.exec(l))) h = span("m", m[1]) + (/^\[!\w+\]/.test(m[2]) ? span("a", m[2]) : inline(m[2]));
      else if ((m = /^(\s*)([-*+]|\d+\.)(\s+)(.*)$/.exec(l))) h = esc(m[1]) + span("m", m[2]) + esc(m[3]) + inline(m[4]);
      else if (/^\s*\|/.test(l)) h = /^[\s|:-]+$/.test(l) ? span("m", l) : l.split("|").map(inline).join(span("m", "|"));
      else if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(l)) h = span("m", l);
      else h = inline(l);
      if (sym) h = symbolize(h || "", sym);
      if (S) {
        var lr = [], lc = [], lf = [], j;
        while (fi < S.finds.length && S.finds[fi][1] <= ls) fi++;
        for (j = fi; j < S.finds.length && S.finds[j][0] < ls + l.length; j++) { var f0 = Math.max(S.finds[j][0], ls) - ls, f1 = Math.min(S.finds[j][1], ls + l.length) - ls; if (f1 > f0) lf.push([f0, f1]); }
        while (ri < S.ranges.length && S.ranges[ri][1] <= ls) ri++;
        for (j = ri; j < S.ranges.length && S.ranges[j][0] < ls + l.length; j++) { var s0 = Math.max(S.ranges[j][0], ls) - ls, e0 = Math.min(S.ranges[j][1], ls + l.length) - ls; if (e0 > s0) lr.push([s0, e0]); }
        while (ci < S.carets.length && S.carets[ci] < ls) ci++;
        for (j = ci; j < S.carets.length && S.carets[j] <= ls + l.length; j++) lc.push(S.carets[j] - ls);
        if (lr.length || lc.length || lf.length) { h = decorate(h || "", lr, lc, lf); if (!l.length) h += "\u200B"; }
      }
      if (sym && sym.eol && i < last) h = (h || "\u200B") + '<span class="se"></span>';
      var xc = opts && opts.cls ? opts.cls(i) : "";
      out.push('<div class="l' + (xc ? " " + xc : "") + '">' + (h || "\u200B") + "</div>");
    });
    return out;
  }
  P.highlightRows = highlightRows; P.symbolize = symbolize; P.highlight = function (text, sel) { return highlightRows(text, sel).join(""); };
})();
