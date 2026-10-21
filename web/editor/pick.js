/* The guide editor: the source lines of the preview's blocks. Each block carries data-ln="first-last" (set by the renderer when the editor passes `lines`). */
(function () {
  "use strict";
  var P = window.udfopEditor = window.udfopEditor || {};

  /* ---- pure parts ---- */
  function lineRange(text, from, to) {   /* the text of lines from..to (1-based, inclusive) as [start, end), without the last line break */
    var start = 0, n = from, end;
    while (--n > 0) { start = text.indexOf("\n", start) + 1; if (!start) return [text.length, text.length]; }
    end = start;
    for (n = from; n <= to; n++) { var nl = text.indexOf("\n", end); if (nl < 0) return [start, text.length]; if (n === to) return [start, nl]; end = nl + 1; }
    return [start, end];
  }
  function parseLn(s) {   /* "3-5" -> [3, 5], or null */
    var m = /^(\d+)-(\d+)$/.exec(s || "");
    return m ? [+m[1], +m[2]] : null;
  }
  /* where an inline element's words are in the source lines of its block: [start, end) in text, or null (the source may spell them differently: then the block is selected) */
  function within(text, from, to, needle) {
    needle = String(needle || "").replace(/\s+/g, " ").trim();
    if (!needle) return null;
    var r = lineRange(text, from, to), at = text.slice(r[0], r[1]).indexOf(needle);
    return at < 0 ? null : [r[0] + at, r[0] + at + needle.length];
  }
  P.pick = { lineRange: lineRange, parseLn: parseLn, within: within };

})();
