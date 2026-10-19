/* Write a guide page: the Edit menu's commands. P.ops holds the text operations as plain functions (so they can be tested without a page); P.editCommands applies them to the text box.
   Every change goes through the browser's own text insertion, so one Ctrl+Z undoes a whole command. */
(function () {
  "use strict";
  var P = window.udfopEditor = window.udfopEditor || {};
  var INDENT = "  ";   /* one level: two spaces, the width of a tab in the editor */
  var WORD = /[\p{L}\p{N}_'’]/u;

  /* ---- operations on a list of lines ---- */
  function dedupe(lines) { var seen = Object.create(null); return lines.filter(function (l) { if (seen[l]) return false; seen[l] = true; return true; }); }
  function dedupeConsecutive(lines) { return lines.filter(function (l, i) { return i === 0 || l !== lines[i - 1]; }); }
  function leadingInt(l) { var m = /^\s*([-+]?\d+)/.exec(l); return m ? parseInt(m[1], 10) : NaN; }
  function leadingDec(l) { var m = /^\s*([-+]?(?:\d+[.,]?\d*|[.,]\d+))/.exec(l); return m ? parseFloat(m[1].replace(",", ".")) : NaN; }
  /* kind: "lex" (by character code), "lexi" (ignoring case), "int", "dec" (the number at the start of the line) or "len" (length). A line with no number counts as lower than any number. Ties keep their order. */
  function sortLines(lines, kind, desc) {
    var key = {
      lex: function (l) { return l; }, lexi: function (l) { return l.toLowerCase(); },
      int: function (l) { var n = leadingInt(l); return isNaN(n) ? -Infinity : n; }, dec: function (l) { var n = leadingDec(l); return isNaN(n) ? -Infinity : n; },
      len: function (l) { return l.length; }
    }[kind];
    return lines.map(function (l, i) { return { l: l, k: key(l), i: i }; }).sort(function (a, b) {
      var c = a.k < b.k ? -1 : a.k > b.k ? 1 : 0;
      return (desc ? -c : c) || a.i - b.i;
    }).map(function (x) { return x.l; });
  }
  /* moves lines a..b (inclusive, 0-based) up (-1) or down (1); returns { lines, a, b } or null at the edge */
  function moveLines(lines, a, b, dir) {
    if (dir < 0 ? a === 0 : b === lines.length - 1) return null;
    var out = lines.slice(), block = out.splice(a, b - a + 1);
    var at = a + dir; out.splice.apply(out, [at, 0].concat(block));
    return { lines: out, a: a + dir, b: b + dir };
  }
  var lineOps = {
    dedupe: dedupe, dedupeConsecutive: dedupeConsecutive,
    removeEmpty: function (lines) { return lines.filter(function (l) { return l !== ""; }); },
    removeBlank: function (lines) { return lines.filter(function (l) { return /\S/.test(l); }); },
    reverse: function (lines) { return lines.slice().reverse(); },
    trimTrailing: function (lines) { return lines.map(function (l) { return l.replace(/[ \t]+$/, ""); }); },
    trimLeading: function (lines) { return lines.map(function (l) { return l.replace(/^[ \t]+/, ""); }); },
    trimBoth: function (lines) { return lines.map(function (l) { return l.replace(/^[ \t]+|[ \t]+$/g, ""); }); },
    indent: function (lines) { return lines.map(function (l) { return l === "" ? l : INDENT + l; }); },
    outdent: function (lines) { return lines.map(function (l) { return l.replace(/^(\t| {1,2})/, ""); }); }
  };
  /* ---- operations on a piece of text ---- */
  var caseOps = {
    upper: function (s) { return s.toUpperCase(); },
    lower: function (s) { return s.toLowerCase(); },
    /* the first letter of each word, skipping anything in front of it that is not a letter (a bracket, a star, a digit: "2nd" becomes "2Nd") */
    proper: function (s) { return s.toLowerCase().replace(/[\p{L}\p{N}'’]+/gu, function (w) { return w.replace(/\p{L}/u, function (c) { return c.toUpperCase(); }); }); },
    /* the first letter of the text, of each line and of each sentence, skipping what comes before it on the way ("## ", "- ", "1. ", "**") */
    sentence: function (s) { return s.toLowerCase().replace(/(^|[.!?]\s+|\n)([^\p{L}\n]*)(\p{L})/gu, function (m, p, skip, c) { return p + skip + c.toUpperCase(); }); }
  };
  P.ops = { lines: lineOps, sort: sortLines, move: moveLines, text: caseOps, INDENT: INDENT };

  /* ---- where a line starts and ends, and what Home and Tab mean at a position (pure, so the multi-selection code can ask too) ---- */
  function bounds(v, pos) { var nl = v.indexOf("\n", pos); return { ls: pos === 0 ? 0 : v.lastIndexOf("\n", pos - 1) + 1, le: nl < 0 ? v.length : nl }; }
  /* Home from the end of the line's leading spaces goes to the start of the line; from anywhere else it goes to the end of the leading spaces */
  function homeTarget(v, pos) { var b = bounds(v, pos), text = b.ls + /^[ \t]*/.exec(v.slice(b.ls, b.le))[0].length; return pos === text ? b.ls : text; }
  /* What Tab (or, with back, Shift+Tab) is about: "selection" (several lines, or a whole line, are selected: the lines ls..le), "leading" (only spaces to the left of the caret: that line),
     or "inline" (anywhere else in a line). A selection inside one line counts as a caret at its end (Tab) or its start (Shift+Tab). */
  function tabPlan(v, s, e, back) {
    if (e > s) {
      var a = bounds(v, s), z = bounds(v, v.charAt(e - 1) === "\n" ? e - 1 : e);
      if (z.ls > a.ls || (s <= a.ls && e >= a.le)) return { kind: "selection", ls: a.ls, le: z.le, caret: s };
      s = back ? s : e;
    }
    var b = bounds(v, s);
    return { kind: /^[ \t]*$/.test(v.slice(b.ls, s)) ? "leading" : "inline", caret: s, ls: b.ls, le: b.le };
  }
  P.bounds = bounds; P.homeTarget = homeTarget; P.tabPlan = tabPlan;

  /* ---- the commands, applied to the text box ---- */
  P.editCommands = function (ctx) {
    var ta = ctx.ta;
    function put(start, end, text) {   /* replaces start..end the way typing would, so it is one undo step */
      if (ctx.put) { ctx.put(start, end, text); return; }   /* a stand-in text box (the multi-selection code runs the commands on a copy) */
      ta.focus(); ta.setSelectionRange(start, end);
      var before = ta.value, expected = before.slice(0, start) + text + before.slice(end);
      try { if (text === "") document.execCommand("delete"); else document.execCommand("insertText", false, text); } catch (e) {}
      if (ta.value !== expected) { ta.value = expected; ta.dispatchEvent(new Event("input")); }   /* the browser would not do it: no undo for this one */
    }
    /* the whole lines the selection touches (a selection that ends at the start of a line leaves that line out); with nothing selected, the line the caret is on, or with wholeIfNone the whole text */
    function span(wholeIfNone) {
      var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, has = e > s;
      if (!has && wholeIfNone) { var end = v.charAt(v.length - 1) === "\n" ? v.length - 1 : v.length; return { start: 0, end: Math.max(0, end), has: false, whole: true, caret: s }; }
      var start = s === 0 ? 0 : v.lastIndexOf("\n", s - 1) + 1, last = has && v.charAt(e - 1) === "\n" ? e - 1 : e, nl = v.indexOf("\n", last);
      return { start: start, end: nl < 0 ? v.length : nl, has: has, whole: false, caret: s };
    }
    function lines(fn, wholeIfNone, what) {
      var sp = span(wholeIfNone), old = ta.value.slice(sp.start, sp.end), out = fn(old.split("\n"));
      var text = out.join("\n");
      if (text === old) { ctx.say("Nothing to change"); ta.focus(); return; }
      put(sp.start, sp.end, text);
      if (sp.has) ta.setSelectionRange(sp.start, sp.start + text.length);
      else { var c = Math.max(sp.start, Math.min(sp.start + text.length, sp.caret + text.length - old.length)); ta.setSelectionRange(c, c); }
      ctx.say(what);
    }
    function moveBy(dir) {
      var v = ta.value, sp = span(false);
      if (dir < 0 ? sp.start === 0 : sp.end >= v.length) { ctx.say("Nothing to move"); ta.focus(); return; }
      var s0 = ta.selectionStart, e0 = ta.selectionEnd, block = v.slice(sp.start, sp.end), from, to, text, shift;
      if (dir < 0) { from = v.lastIndexOf("\n", sp.start - 2) + 1; var prev = v.slice(from, sp.start - 1); to = sp.end; text = block + "\n" + prev; shift = -(prev.length + 1); }
      else { from = sp.start; var nl = v.indexOf("\n", sp.end + 1), next = v.slice(sp.end + 1, nl < 0 ? v.length : nl); to = nl < 0 ? v.length : nl; text = next + "\n" + block; shift = next.length + 1; }
      put(from, to, text); ta.setSelectionRange(s0 + shift, e0 + shift);
    }
    function blank(above) {
      var sp = span(false), s0 = ta.selectionStart, e0 = ta.selectionEnd;
      put(above ? sp.start : sp.end, above ? sp.start : sp.end, "\n");
      if (above) ta.setSelectionRange(s0 + 1, e0 + 1); else ta.setSelectionRange(s0, e0);
    }
    function caseTo(fn, scope) {   /* the selection; with nothing selected, the word at the caret (or, for scope "line", the line) */
      var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, had = e > s;
      if (!had) {
        if (scope === "line") { var sp = span(false); s = sp.start; e = sp.end; }
        else { while (s > 0 && WORD.test(v.charAt(s - 1))) s--; while (e < v.length && WORD.test(v.charAt(e))) e++; }
        if (e === s) { ctx.say("Select some text first"); ta.focus(); return; }
      }
      var old = v.slice(s, e), text = fn(old), c = ta.selectionStart;
      if (text === old) { ctx.say("Nothing to change"); ta.focus(); return; }
      put(s, e, text);
      if (had) ta.setSelectionRange(s, s + text.length); else ta.setSelectionRange(c, c);
    }
    var CLIP_HINT = "Press Ctrl+V to paste";
    function insertAtSelection(text) {
      var s = ta.selectionStart, e = ta.selectionEnd;
      put(s, e, text); ta.setSelectionRange(s + text.length, s + text.length);
    }
    function pasteText() {   /* browsers ask before a page may read the clipboard, and some refuse: then the keyboard does it */
      if (!navigator.clipboard || !navigator.clipboard.readText) { ctx.say(CLIP_HINT); ta.focus(); return; }
      navigator.clipboard.readText().then(function (t) {
        t = t.replace(/\r\n?/g, "\n");
        if (!t) ctx.say("The clipboard is empty"); else insertAtSelection(t);
      }, function () { ctx.say(CLIP_HINT); ta.focus(); });
    }
    function pasteHtml() {
      if (!navigator.clipboard || !navigator.clipboard.read || !P.htmlToMarkdown) { ctx.say("This browser cannot read HTML from the clipboard: use Paste"); ta.focus(); return; }
      navigator.clipboard.read().then(function (items) {
        var item = items.filter(function (it) { return it.types.indexOf("text/html") >= 0; })[0];
        if (!item) { ctx.say("The clipboard has no formatted text: use Paste"); ta.focus(); return; }
        return item.getType("text/html").then(function (b) { return b.text(); }).then(function (html) {
          var md = P.htmlToMarkdown(html);
          if (!md) ctx.say("Nothing to paste from the clipboard"); else { insertAtSelection(md); ctx.say("Pasted as Markdown"); }
        });
      }).catch(function () { ctx.say("Could not read the clipboard: allow it in the browser, or press Ctrl+V for plain text"); ta.focus(); });
    }
    function lineBounds(pos) { return bounds(ta.value, pos); }
    /* The Tab and Shift+Tab keys. They indent the line (or the selected lines) when that is plainly what is meant: several lines selected, a whole line selected, or nothing but
       spaces to the left of the caret. Anywhere else in a line Tab types spaces up to the next tab stop and Shift+Tab walks the caret back one tab stop (every two columns), until
       only spaces are left of it; then it decreases the line's indentation. When Tab indents a line from inside its leading spaces the caret ends up at the end of them. A selection inside one line acts as a caret at its end (Tab) or its start (Shift+Tab). */
    function tabKey(back) {
      var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, plan = tabPlan(v, s, e, back);
      if (plan.kind === "selection") { lines(back ? lineOps.outdent : lineOps.indent, false, back ? "Outdented" : "Indented"); return; }
      s = plan.caret; if (e > ta.selectionStart) ta.setSelectionRange(s, s);
      var b = { ls: plan.ls, le: plan.le }, col = s - b.ls;
      if (plan.kind === "leading") {   /* only spaces to the left: the line's own indentation */
        if (back) lines(lineOps.outdent, false, "Outdented");
        else if (b.le === b.ls) { put(s, s, INDENT); ta.setSelectionRange(s + INDENT.length, s + INDENT.length); }
        else {   /* the line gets one more level, and the caret goes to the end of its spaces wherever in them it was */
          lines(lineOps.indent, false, "Indented");
          var end = b.ls + /^[ \t]*/.exec(ta.value.slice(b.ls, lineBounds(b.ls).le))[0].length;
          ta.setSelectionRange(end, end);
        }
        return;
      }
      if (back) { var to = b.ls + Math.max(0, col - (col % 2 === 0 ? 2 : 1)); ta.setSelectionRange(to, to); }
      else { var n = INDENT.length - (col % INDENT.length), at = s + n; put(s, s, new Array(n + 1).join(" ")); ta.setSelectionRange(at, at); }
    }
    /* Home: from anywhere but the end of the line's leading spaces it goes there; from there it goes to the start of the line. With Shift the selection grows over everything
       the caret passes (the end that does not move stays put). It works on lines as written, not on the wrapped rows of a long line. */
    function homeKey(extend) {
      var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, back = ta.selectionDirection === "backward";
      var moving = e > s ? (back ? s : e) : s, anchor = e > s ? (back ? e : s) : s;
      var to = homeTarget(v, moving);
      if (!extend) ta.setSelectionRange(to, to);
      else ta.setSelectionRange(Math.min(anchor, to), Math.max(anchor, to), to < anchor ? "backward" : "forward");
    }
    var SORTS = { lex: "lex", lexi: "lexi", int: "int", dec: "dec", len: "len" };
    return function (cmd) {
      var p = cmd.split(".");   /* edit.<group>[.<what>[.<direction>]] */
      if (p[1] === "undo") { ta.focus(); document.execCommand("undo"); }
      else if (p[1] === "redo") { ta.focus(); document.execCommand("redo"); }
      else if (p[1] === "cut" || p[1] === "copy") { ta.focus(); if (ta.selectionEnd === ta.selectionStart) ctx.say("Select some text first"); else document.execCommand(p[1]); }
      else if (p[1] === "delete") { ta.focus(); document.execCommand(ta.selectionEnd > ta.selectionStart ? "delete" : "forwardDelete"); }
      else if (p[1] === "selectall") { ta.focus(); ta.select(); }
      else if (p[1] === "paste") pasteText();
      else if (p[1] === "pastehtml") pasteHtml();
      else if (p[1] === "home") homeKey(false);
      else if (p[1] === "homeextend") homeKey(true);
      else if (p[1] === "tab") tabKey(false);
      else if (p[1] === "shifttab") tabKey(true);
      else if (p[1] === "indent") lines(p[2] === "inc" ? lineOps.indent : lineOps.outdent, false, p[2] === "inc" ? "Indented" : "Outdented");
      else if (p[1] === "case") caseTo(caseOps[p[2]], p[2] === "sentence" ? "line" : "word");
      else if (p[1] === "blank") lines(lineOps[p[2]], true, "Done");
      else if (p[1] === "lines") {
        var w = p[2];
        if (w === "moveup") moveBy(-1); else if (w === "movedown") moveBy(1);
        else if (w === "blankabove") blank(true); else if (w === "blankbelow") blank(false);
        else if (w === "sort") lines(function (l) { return sortLines(l, SORTS[p[3]], p[4] === "desc"); }, true, "Sorted");
        else if (lineOps[w]) lines(lineOps[w], true, "Done");
      }
    };
  };
})();
