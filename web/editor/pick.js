/* The guide editor: Pick mode. Hover a block in the preview to mark its lines in the text; click to select them there. The preview's blocks carry their source lines in data-ln="first-last"
   (set by the renderer when the editor passes `lines`). */
(function () {
  "use strict";
  var P = window.udfopEditor = window.udfopEditor || {};
  var INLINE = "a, code, b, strong, i, em, img";   /* inline things a click can select on their own */

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

  /* ---- in the page ---- */
  /* ctx: { ta, prev (the preview's article), btn (the Pick button), repaint(), reveal(pos), say(text), toggle(), off() } */
  P.pickElement = function (ctx) {
    var ta = ctx.ta, prev = ctx.prev, btn = ctx.btn, on = false, hot = null, hotEl = null;
    function blockOf(node) {
      var el = node && node.closest ? node.closest("[data-ln]") : null;
      return el && prev.contains(el) ? el : null;
    }
    function setHot(el) {
      if (el === hotEl) return;
      if (hotEl) hotEl.classList.remove("pick-hot");
      hotEl = el; hot = el ? parseLn(el.getAttribute("data-ln")) : null;
      if (el) el.classList.add("pick-hot");
      ctx.repaint();
    }
    prev.addEventListener("mouseover", function (e) { if (on) setHot(blockOf(e.target)); });
    prev.addEventListener("mouseleave", function () { if (on) setHot(null); });
    prev.addEventListener("click", function (e) {
      if (!on) return;
      e.preventDefault(); e.stopPropagation();   /* before the handler that keeps links in the preview inert */
      var block = blockOf(e.target), range, lines;
      if (!block) return;
      lines = parseLn(block.getAttribute("data-ln"));
      if (!lines) return;
      var inl = e.target.closest ? e.target.closest(INLINE) : null;
      if (inl && inl !== block && block.contains(inl) && !inl.closest(".codebox")) range = within(ta.value, lines[0], lines[1], inl.tagName === "IMG" ? inl.getAttribute("alt") : inl.textContent);
      if (!range) range = lineRange(ta.value, lines[0], lines[1]);
      setHot(null);
      ta.focus(); ta.setSelectionRange(range[0], range[1]); ctx.reveal(range[0]);
      ctx.say("Picked " + (lines[1] > lines[0] ? "lines " + lines[0] + " to " + lines[1] : "line " + lines[0]));
    }, true);
    btn.addEventListener("click", function () { ctx.toggle(); });
    function keys(e) {   /* Esc turns the mode off */
      if (!ta.isConnected) { document.removeEventListener("keydown", keys); return; }
      if (on && e.key === "Escape" && !e.defaultPrevented) ctx.off();
    }
    document.addEventListener("keydown", keys);
    return {
      sync: function (value) {   /* the mode was switched (button, View menu, Esc, or the saved setting) */
        on = !!value;
        btn.setAttribute("aria-pressed", String(on));
        prev.classList.toggle("picking", on);
        setHot(null);
      },
      clear: function () { hotEl = null; hot = null; ctx.repaint(); },   /* the preview was redrawn: the old element is gone */
      draw: function () { return hot ? [hot[0] - 1, hot[1] - 1] : null; }   /* the rows to mark in the text (0-based, inclusive) */
    };
  };
})();
