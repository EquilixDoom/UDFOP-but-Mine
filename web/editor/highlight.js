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
  /* one <div class="l"> per line of the text, as a list of strings (an empty line holds a zero-width space so it keeps its height) */
  function highlightRows(text) {
    var st = { fm: 0, fence: null }, out = [];
    text.split("\n").forEach(function (l, i) {
      var m, h;
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
      out.push('<div class="l">' + (h || "​") + "</div>");
    });
    return out;
  }
  P.highlightRows = highlightRows; P.highlight = function (text) { return highlightRows(text).join(""); };
})();
