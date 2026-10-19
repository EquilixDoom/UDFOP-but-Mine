/* Write a guide page: the colored Markdown source behind the text box. */
(function () {
  "use strict";
  var H = window.udfopHost, P = window.udfopEditor = window.udfopEditor || {};
  var esc = H.esc, FENCE = P.FENCE;
  /* The counts in braces, and leaving lines over P.MAX_LINE characters uncolored, keep a line of unclosed brackets from being rescanned from every opening one (it would take seconds). */
  /* colors the Markdown source; only colors (never weight or size), so the text lines up with the textarea above it */
  function inline(s) {
    if (s.length > P.MAX_LINE) return esc(s);
    var re = /(`[^`]+`)|(\[\[[^\]]{0,200}\]\])|(\{\{[^}]{0,200}\}\})|(!?\[[^\]]{0,200}\]\([^)]{0,300}\))|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(>![^!]*!<)/g, out = "", at = 0, m;
    while ((m = re.exec(s))) {
      out += esc(s.slice(at, m.index)); at = m.index + m[0].length;
      var cls = m[1] ? "c" : m[2] ? (P.linkOk(m[0].slice(2, -2)) ? "w" : "x") : m[3] ? "q" : m[4] ? "u" : m[5] || m[6] ? "b" : "m";
      out += '<span class="t-' + cls + '">' + esc(m[0]) + "</span>";
    }
    return out + esc(s.slice(at));
  }
  function span(c, s) { return '<span class="t-' + c + '">' + esc(s) + "</span>"; }
  var CARET = '<span class="mc"></span>';
  /* Draws selections and carets into a row's html. ranges: [[start, end]] and carets: [position], both sorted, in characters of the row's text (not counting its tags; an entity counts as one).
     Each selected stretch becomes one <mark class="sel"> (closed and reopened around tags so that the nesting stays valid); a caret is a zero-width <span class="mc">. */
  function decorate(html, ranges, carets) {
    var out = "", pos = 0, ri = 0, ci = 0, open = false, re = /<[^>]*>|[^<]+/g, m;
    function caretsAt(p) { while (ci < carets.length && carets[ci] <= p) { if (carets[ci] === p) out += CARET; ci++; } }
    function inRange(p) { while (ri < ranges.length && ranges[ri][1] <= p) ri++; return ri < ranges.length && ranges[ri][0] <= p; }
    while ((m = re.exec(html))) {
      var t = m[0];
      if (t.charAt(0) === "<") { if (open) { out += "</mark>"; open = false; } out += t; continue; }
      var units = t.match(/&[#a-zA-Z0-9]+;|[\s\S]/g);
      for (var k = 0; k < units.length; k++) {
        caretsAt(pos);
        var want = inRange(pos);
        if (open && !want) { out += "</mark>"; open = false; } else if (!open && want) { out += '<mark class="sel">'; open = true; }
        out += units[k]; pos++;
      }
    }
    if (open) out += "</mark>";
    caretsAt(pos);
    return out;
  }
  /* the old form [start, end], or { ranges, carets } with offsets in the whole text */
  function selOf(sel) {
    if (!sel) return null;
    if (Array.isArray(sel)) return { ranges: sel[1] > sel[0] ? [[sel[0], sel[1]]] : [], carets: [] };
    return { ranges: (sel.ranges || []).slice().sort(function (x, y) { return x[0] - y[0]; }), carets: (sel.carets || []).slice().sort(function (x, y) { return x - y; }) };
  }
  /* one <div class="l"> per line of the text, as a list of strings (an empty line holds a zero-width space so it keeps its height).
     sel, [start, end] in the text, is drawn as a selection: the text box shows its own only while it has the focus */
  function highlightRows(text, sel) {
    var st = { fm: 0, fence: null }, out = [], at = 0, S = selOf(sel), ri = 0, ci = 0;
    text.split("\n").forEach(function (l, i) {
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
      else if ((m = /^(>\s?)(.*)$/.exec(l))) h = span("m", m[1]) + (/^\[!\w+\]/.test(m[2]) ? span("a", m[2]) : inline(m[2]));
      else if ((m = /^(\s*)([-*+]|\d+\.)(\s+)(.*)$/.exec(l))) h = esc(m[1]) + span("m", m[2]) + esc(m[3]) + inline(m[4]);
      else if (/^\s*\|/.test(l)) h = /^[\s|:-]+$/.test(l) ? span("m", l) : l.split("|").map(inline).join(span("m", "|"));
      else if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(l)) h = span("m", l);
      else h = inline(l);
      if (S) {
        var lr = [], lc = [], j;
        while (ri < S.ranges.length && S.ranges[ri][1] <= ls) ri++;
        for (j = ri; j < S.ranges.length && S.ranges[j][0] < ls + l.length; j++) { var s0 = Math.max(S.ranges[j][0], ls) - ls, e0 = Math.min(S.ranges[j][1], ls + l.length) - ls; if (e0 > s0) lr.push([s0, e0]); }
        while (ci < S.carets.length && S.carets[ci] < ls) ci++;
        for (j = ci; j < S.carets.length && S.carets[j] <= ls + l.length; j++) lc.push(S.carets[j] - ls);
        if (lr.length || lc.length) { h = decorate(h || "", lr, lc); if (!l.length) h += "\u200B"; }
      }
      out.push('<div class="l">' + (h || "​") + "</div>");
    });
    return out;
  }
  P.highlightRows = highlightRows; P.highlight = function (text, sel) { return highlightRows(text, sel).join(""); };
})();
