/* Write a guide page: several carets and selections at once.
   The text box keeps one selection, the primary, and is still what the browser types into. The others are held here, drawn in the colored copy behind the text box, and every edit,
   movement and command is applied to all of them. P.multi is the pure part (ranges, edits, boxes, runs of a command on copies); P.multiSelect(ctx) is the part that listens to the page.
   A range is { a: anchor, h: head, p: true on the primary }; "lo" and "hi" are its start and end. */
(function () {
  "use strict";
  var P = window.udfopEditor = window.udfopEditor || {};
  var MAX_SPAN = 400000;   /* a multi-selection edit that rewrites more text than this between the first and last change is refused */

  /* ---------- ranges ---------- */
  function lo(r) { return r.a < r.h ? r.a : r.h; }
  function hi(r) { return r.a < r.h ? r.h : r.a; }
  function copy(r) { var c = { a: r.a, h: r.h }; if (r.p) c.p = true; return c; }
  /* sorted, with overlapping ranges (and carets touching a range) merged; exactly one range is the primary (the last one if none was marked) */
  function normalize(rs) {
    var list = rs.map(copy).sort(function (x, y) { return lo(x) - lo(y) || hi(x) - hi(y); }), out = [];
    list.forEach(function (r) {
      var last = out[out.length - 1];
      if (last && (lo(r) < hi(last) || (lo(r) === hi(last) && (lo(r) === hi(r) || lo(last) === hi(last))))) {
        var s = Math.min(lo(last), lo(r)), e = Math.max(hi(last), hi(r)), forward = last.a <= last.h;
        last.a = forward ? s : e; last.h = forward ? e : s; if (r.p) last.p = true;
      } else out.push(r);
    });
    var at = -1; out.forEach(function (r, i) { if (r.p) { if (at >= 0) delete out[at].p; at = i; } });
    if (at < 0 && out.length) out[out.length - 1].p = true;
    return out;
  }
  function primaryIndex(rs) { for (var i = 0; i < rs.length; i++) if (rs[i].p) return i; return rs.length - 1; }
  /* Ctrl+click: a caret where there was none, or off with the range that holds it (never the last one) */
  function toggleCaret(rs, pos) {
    var keep = rs.filter(function (r) { return !(lo(r) <= pos && pos <= hi(r)); });
    if (keep.length === rs.length) return normalize(rs.map(function (r) { var c = copy(r); delete c.p; return c; }).concat([{ a: pos, h: pos, p: true }]));
    if (!keep.length) return normalize(rs);
    var out = keep.map(copy); if (!out.some(function (r) { return r.p; })) out[out.length - 1].p = true;
    return normalize(out);
  }
  /* adds a range (a word or a line); anything it overlaps is merged into it */
  function addRange(rs, s, e) { return normalize(rs.map(function (r) { var c = copy(r); delete c.p; return c; }).concat([{ a: s, h: e, p: true }])); }

  /* ---------- lines and characters ---------- */
  function lineIndex(text) { var starts = [0], i = -1; while ((i = text.indexOf("\n", i + 1)) >= 0) starts.push(i + 1); return starts; }
  function lineOfPos(starts, pos) { var l = 0, h = starts.length - 1; while (l < h) { var m = (l + h + 1) >> 1; if (starts[m] <= pos) l = m; else h = m - 1; } return l; }
  function lineEnd(text, starts, line) { return line + 1 < starts.length ? starts[line + 1] - 1 : text.length; }
  function lineColOf(text, starts, pos) { var l = lineOfPos(starts, pos); return { line: l, col: pos - starts[l] }; }
  function offsetOf(text, starts, line, col) {
    line = Math.max(0, Math.min(starts.length - 1, line));
    return starts[line] + Math.max(0, Math.min(col, lineEnd(text, starts, line) - starts[line]));
  }
  function prevPos(text, pos) { if (pos <= 0) return 0; var c = text.charCodeAt(pos - 1); return c >= 0xDC00 && c <= 0xDFFF && pos >= 2 && text.charCodeAt(pos - 2) >= 0xD800 && text.charCodeAt(pos - 2) <= 0xDBFF ? pos - 2 : pos - 1; }
  function nextPos(text, pos) { if (pos >= text.length) return text.length; var c = text.charCodeAt(pos); return c >= 0xD800 && c <= 0xDBFF && pos + 1 < text.length ? pos + 2 : pos + 1; }
  var WORDCH = /[\p{L}\p{N}_'’]/u;
  function cls(ch) { return ch === "\n" ? 3 : /[ \t]/.test(ch) ? 0 : WORDCH.test(ch) ? 1 : 2; }   /* 0 spaces, 1 word, 2 anything else, 3 line break */
  /* the word, or the run of spaces or of punctuation, around pos (as a double click selects it) */
  function wordAt(text, pos) {
    var at = pos < text.length && cls(text.charAt(pos)) !== 3 ? pos : pos > 0 && cls(text.charAt(pos - 1)) !== 3 ? pos - 1 : -1;
    if (at < 0) return { s: pos, e: pos };
    var k = cls(text.charAt(at)), s = at, e = at + 1;
    while (s > 0 && cls(text.charAt(s - 1)) === k) s--;
    while (e < text.length && cls(text.charAt(e)) === k) e++;
    return { s: s, e: e };
  }
  /* the line around pos, with its line break (the last line has none) */
  function lineAt(text, pos) {
    var starts = lineIndex(text), l = lineOfPos(starts, pos), s = starts[l], e = lineEnd(text, starts, l);
    return { s: s, e: e < text.length ? e + 1 : e };
  }
  /* where Ctrl+Left and Ctrl+Right go: over any spaces, then over the word (or the run of punctuation) */
  function wordStep(text, pos, dir) {
    var i = pos;
    if (dir < 0) {
      while (i > 0 && cls(text.charAt(i - 1)) === 0) i--;
      if (i > 0 && cls(text.charAt(i - 1)) === 3) return i - 1;
      var k = i > 0 ? cls(text.charAt(i - 1)) : -1;
      while (i > 0 && cls(text.charAt(i - 1)) === k) i--;
      return i;
    }
    while (i < text.length && cls(text.charAt(i)) === 0) i++;
    if (i < text.length && cls(text.charAt(i)) === 3) return i + 1;
    var k2 = i < text.length ? cls(text.charAt(i)) : -1;
    while (i < text.length && cls(text.charAt(i)) === k2) i++;
    return i;
  }

  /* ---------- every match of a piece of text (Edit > Multi-Select All) ---------- */
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  /* All the non-overlapping places where needle occurs, as ranges. matchCase: capitals must agree. wholeWord: the match may not touch a letter, digit or underscore on a side where the needle itself starts or ends with one. */
  function findAll(text, needle, matchCase, wholeWord, limit) {
    var out = [], max = limit || 20000;
    if (!needle) return out;
    var re; try { re = new RegExp(escapeRe(needle), "gu" + (matchCase ? "" : "i")); } catch (e) { re = new RegExp(escapeRe(needle), "g" + (matchCase ? "" : "i")); }
    var needStart = WORDCH.test(needle.charAt(0)), needEnd = WORDCH.test(needle.charAt(needle.length - 1)), m;
    while (out.length < max && (m = re.exec(text))) {
      var s = m.index, e = s + m[0].length;
      if (wholeWord && ((needStart && s > 0 && WORDCH.test(text.charAt(s - 1))) || (needEnd && e < text.length && WORDCH.test(text.charAt(e))))) { re.lastIndex = s + 1; continue; }
      out.push({ a: s, h: e });
      if (!m[0].length) re.lastIndex++;
    }
    return out;
  }

  /* ---------- boxes: column mode and box selection ---------- */
  /* one range per line from the anchor's line to the active point's line, over the same columns; a short line is clamped to its end. The range on the active line is the primary. */
  function boxRanges(text, anchor, active) {
    var starts = lineIndex(text), c1 = Math.min(anchor.col, active.col), c2 = Math.max(anchor.col, active.col), forward = anchor.col <= active.col;
    var l1 = Math.max(0, Math.min(anchor.line, active.line)), l2 = Math.min(starts.length - 1, Math.max(anchor.line, active.line)), out = [];
    for (var l = l1; l <= l2; l++) {
      var len = lineEnd(text, starts, l) - starts[l], s = starts[l] + Math.min(c1, len), e = starts[l] + Math.min(c2, len);
      var r = { a: forward ? s : e, h: forward ? e : s };
      if (l === Math.max(0, Math.min(starts.length - 1, active.line))) r.p = true;
      out.push(r);
    }
    return out;
  }
  /* the box moves its active end one line (Alt+Shift+Up and Down): away from the anchor it adds a line, towards it it takes one off */
  function boxStep(text, box, dir) {
    var n = lineIndex(text).length;
    return { anchor: box.anchor, active: { line: Math.max(0, Math.min(n - 1, box.active.line + dir)), col: box.active.col } };
  }

  /* ---------- edits on every range ---------- */
  /* edits: [{ s, e, text, p }] sorted; edits that overlap are joined. Returns the new text and a caret after each edit. */
  function applyEdits(text, edits) {
    var joined = [];
    edits.forEach(function (ed) {
      var last = joined[joined.length - 1];
      if (last && ed.s < last.e) { last.e = Math.max(last.e, ed.e); last.text += ed.text; if (ed.p) last.p = true; } else joined.push({ s: ed.s, e: ed.e, text: ed.text, p: ed.p });
    });
    var out = "", at = 0, delta = 0, ranges = [];
    joined.forEach(function (ed) {
      out += text.slice(at, ed.s) + ed.text; at = ed.e;
      var pos = ed.s + delta + ed.text.length; ranges.push({ a: pos, h: pos, p: ed.p });
      delta += ed.text.length - (ed.e - ed.s);
    });
    return { text: out + text.slice(at), ranges: normalize(ranges) };
  }
  function typed(text, rs, str) { return applyEdits(text, rs.map(function (r) { return { s: lo(r), e: hi(r), text: str, p: r.p }; })); }
  /* parts: one piece of text for each range (a paste of as many lines as there are ranges) */
  function typedEach(text, rs, parts) { return applyEdits(text, rs.map(function (r, i) { return { s: lo(r), e: hi(r), text: parts[i], p: r.p }; })); }
  function deleted(text, rs, dir) {   /* Backspace (dir -1) or Delete (dir 1): the selection, or the character before or after a caret */
    return applyEdits(text, rs.map(function (r) {
      var s = lo(r), e = hi(r);
      if (s === e) { if (dir < 0) s = prevPos(text, s); else e = nextPos(text, e); }
      return { s: s, e: e, text: "", p: r.p };
    }));
  }
  function cut(text, rs) { return applyEdits(text, rs.map(function (r) { return { s: lo(r), e: hi(r), text: "", p: r.p }; })); }   /* the selected text goes, carets stay */
  function deletedWord(text, rs, dir) {   /* Ctrl+Backspace and Ctrl+Delete */
    return applyEdits(text, rs.map(function (r) {
      var s = lo(r), e = hi(r);
      if (s === e) { if (dir < 0) s = wordStep(text, s, -1); else e = wordStep(text, e, 1); }
      return { s: s, e: e, text: "", p: r.p };
    }));
  }

  /* ---------- moving every range ---------- */
  /* kind: left, right, up, down, home, end, wordleft, wordright. Without extend a selection collapses (left and right go to its start and end); with extend the head moves and the anchor stays.
     goal is the column to keep for up and down; returns the new range and the goal to remember (null after any other move). */
  function moveRange(text, starts, r, kind, extend, goal, homeTarget) {
    var h = r.h, a = r.a, selected = lo(r) !== hi(r), to, keepGoal = null;
    if (!extend && selected && (kind === "left" || kind === "right")) { to = kind === "left" ? lo(r) : hi(r); return { r: { a: to, h: to, p: r.p }, goal: null }; }
    if (kind === "left") to = prevPos(text, h);
    else if (kind === "right") to = nextPos(text, h);
    else if (kind === "wordleft") to = wordStep(text, h, -1);
    else if (kind === "wordright") to = wordStep(text, h, 1);
    else if (kind === "home") to = homeTarget(text, h);
    else if (kind === "end") to = lineEnd(text, starts, lineOfPos(starts, h));
    else {
      var lc = lineColOf(text, starts, h), col = goal != null ? goal : lc.col, line = lc.line + (kind === "up" ? -1 : 1);
      if (line < 0) to = 0; else if (line >= starts.length) to = text.length; else to = offsetOf(text, starts, line, col);
      keepGoal = col;
    }
    var out = extend ? { a: a, h: to } : { a: to, h: to };
    if (r.p) out.p = true;
    return { r: out, goal: keepGoal };
  }
  function moveAll(text, rs, kind, extend, goal, homeTarget) {
    var starts = lineIndex(text), g = null;
    var out = rs.map(function (r) { var m = moveRange(text, starts, r, kind, extend, goal, homeTarget); g = m.goal; return m.r; });
    return { ranges: normalize(out), goal: g };
  }

  /* ---------- running a command on every range ---------- */
  function scratchBox(text) {   /* a stand-in text box in memory: the commands in edits.js run on it as they would on the real one */
    var b = {
      value: text, selectionStart: 0, selectionEnd: 0, selectionDirection: "forward",
      focus: function () {}, dispatchEvent: function () {}, select: function () { b.selectionStart = 0; b.selectionEnd = b.value.length; },
      setSelectionRange: function (s, e, d) { b.selectionStart = s; b.selectionEnd = e; b.selectionDirection = d || "none"; },
      put: function (s, e, t) { b.value = b.value.slice(0, s) + t + b.value.slice(e); b.selectionStart = b.selectionEnd = s + t.length; }
    };
    return b;
  }
  function seedRange(box, r) { box.setSelectionRange(lo(r), hi(r), r.a > r.h ? "backward" : "forward"); }
  function resultRange(box, p) { var back = box.selectionDirection === "backward"; return { a: back ? box.selectionEnd : box.selectionStart, h: back ? box.selectionStart : box.selectionEnd, p: p }; }
  /* the lines each range touches, joined into blocks (runs of lines that touch or overlap): [{ ls, le, items: [indexes] }] */
  function blocks(text, rs) {
    var starts = lineIndex(text), spans = rs.map(function (r, i) {
      var s = lo(r), e = hi(r), last = e > s && text.charAt(e - 1) === "\n" ? e - 1 : e, l1 = lineOfPos(starts, s), l2 = lineOfPos(starts, last);
      return { l1: l1, l2: l2, i: i };
    }), out = [];
    spans.forEach(function (sp) {
      var b = out[out.length - 1];
      if (b && sp.l1 <= b.l2 + 1) { b.l2 = Math.max(b.l2, sp.l2); b.items.push(sp.i); }
      else out.push({ l1: sp.l1, l2: sp.l2, items: [sp.i] });
    });
    out.forEach(function (b) { b.ls = starts[b.l1]; b.le = lineEnd(text, starts, b.l2); });
    return out;
  }
  /* Runs an Edit-menu command (the name edits.js takes) for every range, from the last to the first so that the edits do not disturb the ones still to do, on a copy of the text.
     perBlock: a command that works on whole lines (indent, line operations, blank operations, move line) runs once for each block of touched lines instead of once for each range.
     Returns { text, ranges } or null when the command does nothing. */
  function runCommand(text, rs, cmd, perBlock) {
    var box = scratchBox(text), run = P.editCommands({ ta: box, say: function () {}, put: box.put });
    var items = [], done = [], i, k;
    if (perBlock) {
      var bl = blocks(text, rs), keepsCaret = /^edit\.(indent\.|lines\.(moveup|movedown|blankabove|blankbelow))/.test(cmd);
      bl.forEach(function (b) {
        var one = b.items.length === 1 ? rs[b.items[0]] : null, p = b.items.some(function (j) { return rs[j].p; });
        items.push({ seed: keepsCaret && one ? one : { a: b.ls, h: b.le }, p: p, skip: b.ls === b.le && !keepsCaret });
      });
    } else {
      var back = cmd === "edit.shifttab", isTab = cmd === "edit.tab" || back, claimed = [];
      rs.forEach(function (r) { items.push({ seed: r, p: r.p }); });
      if (isTab) items.forEach(function (it) {
        var plan = P.tabPlan(text, lo(it.seed), hi(it.seed), back);
        if (plan.kind === "selection" || plan.kind === "leading") it.lines = [plan.ls, plan.le];
      });
      for (i = items.length - 1; i >= 0; i--) {   /* two ranges that would indent the same line indent it once */
        var it = items[i];
        if (!it.lines) continue;
        for (k = 0; k < claimed.length; k++) if (it.lines[0] <= claimed[k].lines[1] && claimed[k].lines[0] <= it.lines[1]) { it.sameAs = claimed[k]; break; }
        if (!it.sameAs) claimed.push(it);
      }
    }
    for (i = items.length - 1; i >= 0; i--) {
      var item = items[i], before = box.value.length;
      if (!item.skip && !item.sameAs) {
        seedRange(box, item.seed);
        run(cmd);
        item.result = resultRange(box, item.p);
      } else if (item.sameAs) item.result = null;
      var delta = box.value.length - before;
      if (delta) done.forEach(function (d) { d.result = { a: d.result.a + delta, h: d.result.h + delta, p: d.result.p }; });
      if (item.skip) item.result = { a: lo(item.seed), h: hi(item.seed), p: item.p };
      if (item.result) done.push(item);
    }
    items.forEach(function (it) { if (it.sameAs) { it.result = { a: it.sameAs.result.a, h: it.sameAs.result.h, p: it.p }; } });
    if (box.value === text) {   /* nothing changed in the text: the ranges may still have moved (Home, Shift+Tab walking back) */
      var same = items.every(function (it, j) { var r = it.result, o = perBlock ? it.seed : rs[j]; return r.a === o.a && r.h === o.h; });
      if (same) return null;
    }
    return { text: box.value, ranges: normalize(items.map(function (it) { return it.result; })) };
  }

  P.multi = {
    lo: lo, hi: hi, normalize: normalize, primaryIndex: primaryIndex, toggleCaret: toggleCaret, addRange: addRange,
    lineIndex: lineIndex, lineOfPos: lineOfPos, lineEnd: lineEnd, lineColOf: lineColOf, offsetOf: offsetOf, prevPos: prevPos, nextPos: nextPos,
    findAll: findAll, wordAt: wordAt, lineAt: lineAt, wordStep: wordStep, boxRanges: boxRanges, boxStep: boxStep,
    applyEdits: applyEdits, cut: cut, typed: typed, typedEach: typedEach, deleted: deleted, deletedWord: deletedWord,
    moveRange: moveRange, moveAll: moveAll, blocks: blocks, runCommand: runCommand, MAX_SPAN: MAX_SPAN
  };

  /* ---------- the part that listens to the page ---------- */
  P.multiSelect = function (ctx) {
    var ta = ctx.ta, hl = ctx.hl, hlBox = hl.parentNode, M = P.multi;
    var sels = null, expected = null, goal = null, box = null, applying = false;
    var mac = /Mac|iPhone|iPad/.test(navigator.platform || "");
    function ctrlOf(e) { return mac ? e.metaKey : e.ctrlKey; }
    function current() {   /* every selection, the text box's own included */
      if (sels) return sels;
      var s = ta.selectionStart, e = ta.selectionEnd, back = ta.selectionDirection === "backward";
      return [{ a: back ? e : s, h: back ? s : e, p: true }];
    }
    function showPrimary() {
      var r = sels[M.primaryIndex(sels)], s = lo(r), e = hi(r);
      ta.setSelectionRange(s, e, r.a > r.h ? "backward" : "forward"); expected = [s, e]; ctx.reveal(r.h);
    }
    function set(rs) {   /* make these the selections (one range is just the text box's own) */
      rs = M.normalize(rs);
      if (rs.length < 2) {
        sels = null; box = null;
        if (rs.length) { var r = rs[0]; ta.setSelectionRange(lo(r), hi(r), r.a > r.h ? "backward" : "forward"); ctx.reveal(r.h); }
        expected = null;
      } else { sels = rs; showPrimary(); }
      ctx.repaint();
    }
    function clear() { if (!sels && !box) return; sels = null; box = null; goal = null; expected = null; ctx.repaint(); }
    /* what to draw for paint(): the other selections, and all of them while the text box has lost the focus */
    function draw(blurred) {
      var rs = [], carets = [];
      if (sels) sels.forEach(function (r) {
        if (r.p && !blurred) return;
        if (lo(r) === hi(r)) carets.push(lo(r)); else rs.push([lo(r), hi(r)]);
      });
      else if (blurred && ta.selectionEnd > ta.selectionStart) rs.push([ta.selectionStart, ta.selectionEnd]);
      return rs.length || carets.length ? { ranges: rs, carets: carets } : null;
    }
    /* ---- text edits: the changed stretch goes in as one insertion, so one Ctrl+Z undoes it ---- */
    function commit(result, say) {
      box = null;
      var old = ta.value, text2 = result.text, p = 0, n = Math.min(old.length, text2.length);
      while (p < n && old.charCodeAt(p) === text2.charCodeAt(p)) p++;
      var so = old.length, sn = text2.length;
      while (so > p && sn > p && old.charCodeAt(so - 1) === text2.charCodeAt(sn - 1)) { so--; sn--; }
      if (so - p > MAX_SPAN) { ctx.say("Too much text between the first and last selection to change them together"); return; }
      if (text2 !== old) {
        applying = true;
        try {
          ta.focus(); ta.setSelectionRange(p, so);
          var ins = text2.slice(p, sn);
          try { if (ins === "") document.execCommand("delete"); else document.execCommand("insertText", false, ins); } catch (e) {}
          if (ta.value !== text2) { ta.value = text2; ta.dispatchEvent(new Event("input")); }
        } finally { applying = false; }
      }
      set(result.ranges);
      if (say) ctx.say(say);
    }
    function texts() { var v = ta.value; return sels ? sels.filter(function (r) { return lo(r) !== hi(r); }).map(function (r) { return v.slice(lo(r), hi(r)); }) : []; }
    function insertText(str) {
      var rs = current(), parts = str.split("\n");
      commit(parts.length === rs.length && rs.length > 1 ? M.typedEach(ta.value, rs, parts) : M.typed(ta.value, rs, str));
    }
    /* ---- where the pointer is, in the text ---- */
    function offsetAt(x, y) {
      var tp = ta.style.pointerEvents, hp = hlBox.style.pointerEvents, node = null, off = 0;
      ta.style.pointerEvents = "none"; hlBox.style.pointerEvents = "auto";   /* the colored copy is real text, so the browser can say which character is under the pointer */
      try {
        if (document.caretPositionFromPoint) { var cp = document.caretPositionFromPoint(x, y); if (cp) { node = cp.offsetNode; off = cp.offset; } }
        else if (document.caretRangeFromPoint) { var rg = document.caretRangeFromPoint(x, y); if (rg) { node = rg.startContainer; off = rg.startOffset; } }
      } finally { ta.style.pointerEvents = tp; hlBox.style.pointerEvents = hp; }
      var v = ta.value, row = node;
      while (row && row.parentNode !== hl) row = row.parentNode;
      if (!row) { var r0 = hl.getBoundingClientRect(); return y < r0.top + 12 ? 0 : y > r0.bottom - 12 ? v.length : null; }
      var idx = 0, sib = row; while ((sib = sib.previousElementSibling)) idx++;
      var rg2 = document.createRange(); rg2.setStart(row, 0); rg2.setEnd(node, off);
      var starts = M.lineIndex(v), line = Math.min(idx, starts.length - 1);
      return starts[line] + Math.min(rg2.toString().length, M.lineEnd(v, starts, line) - starts[line]);
    }
    /* ---- the mouse ---- */
    function onMouseDown(e) {
      if (e.button !== 0) return;
      var ctrl = ctrlOf(e);
      if (ctrl && !e.altKey) { addByClick(e); return; }
      if (e.altKey && !ctrl) { startBox(e); return; }
      if (sels || box) clear();   /* a plain click: the browser places the caret */
    }
    function addByClick(e) {
      e.preventDefault(); ta.focus({ preventScroll: true });
      var pos = offsetAt(e.clientX, e.clientY);
      if (pos == null) return;
      var v = ta.value, rs = current(), n = e.detail || 1;
      box = null;
      if (n === 1) set(M.toggleCaret(rs, pos));
      else { var w = n === 2 ? M.wordAt(v, pos) : M.lineAt(v, pos); set(M.addRange(rs, w.s, w.e)); }
    }
    function startBox(e) {
      e.preventDefault(); ta.focus({ preventScroll: true });
      var pos = offsetAt(e.clientX, e.clientY);
      if (pos == null) return;
      var v = ta.value, lc = M.lineColOf(v, M.lineIndex(v), pos);
      box = { anchor: lc, active: lc }; showBox();
      function move(ev) {
        var p2 = offsetAt(ev.clientX, ev.clientY), r = ta.getBoundingClientRect();
        if (ev.clientY < r.top) ta.scrollTop -= Math.min(40, r.top - ev.clientY); else if (ev.clientY > r.bottom) ta.scrollTop += Math.min(40, ev.clientY - r.bottom);
        if (p2 == null) return;
        var text = ta.value; box.active = M.lineColOf(text, M.lineIndex(text), p2); showBox();
      }
      function up() { document.removeEventListener("mousemove", move, true); document.removeEventListener("mouseup", up, true); ctx.repaint(); }
      document.addEventListener("mousemove", move, true); document.addEventListener("mouseup", up, true);
    }
    function showBox() { var b = box, text = ta.value; set(M.boxRanges(text, b.anchor, b.active)); box = b; }
    function boxStepKey(dir) {
      var v = ta.value;
      if (!box) {   /* start from the text box's own selection */
        var s = ta.selectionStart, e = ta.selectionEnd, starts = M.lineIndex(v), back = ta.selectionDirection === "backward";
        box = { anchor: M.lineColOf(v, starts, back ? e : s), active: M.lineColOf(v, starts, back ? s : e) };
        if (box.anchor.line !== box.active.line) box.active = { line: box.anchor.line, col: box.active.col };
      }
      var b = M.boxStep(v, box, dir); box = b; showBox();
    }
    /* ---- the keyboard ---- */
    var MOVES = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", Home: "home", End: "end" };
    function onKeyDown(e) {
      var k = e.key, ctrl = ctrlOf(e), alt = e.altKey, shift = e.shiftKey;
      function took() { e.preventDefault(); e.stopImmediatePropagation(); }
      if (k === "Escape" && !ctrl && !alt && !shift) { if (sels || box) { took(); clear(); } return; }
      if (alt && shift && !ctrl && (k === "ArrowUp" || k === "ArrowDown")) { took(); boxStepKey(k === "ArrowDown" ? 1 : -1); return; }
      if (!sels || alt || e.isComposing) return;
      var kind = MOVES[k];
      if (kind && !(ctrl && (k === "Home" || k === "End" || k === "ArrowUp" || k === "ArrowDown"))) {
        if (ctrl && k === "ArrowLeft") kind = "wordleft"; else if (ctrl && k === "ArrowRight") kind = "wordright"; else if (ctrl) return;
        took(); box = null;
        var m = M.moveAll(ta.value, sels, kind, shift, kind === "up" || kind === "down" ? goal : null, P.homeTarget);
        goal = m.goal; set(m.ranges); return;
      }
    }
    function onBeforeInput(e) {
      if (!sels) return;
      var t = e.inputType, v = ta.value;
      if (t === "insertText" && e.data != null) { e.preventDefault(); insertText(e.data); }
      else if (t === "insertLineBreak" || t === "insertParagraph") { e.preventDefault(); insertText("\n"); }
      else if (t === "deleteContentBackward") { e.preventDefault(); commit(M.deleted(v, sels, -1)); }
      else if (t === "deleteContentForward") { e.preventDefault(); commit(M.deleted(v, sels, 1)); }
      else if (t === "deleteWordBackward") { e.preventDefault(); commit(M.deletedWord(v, sels, -1)); }
      else if (t === "deleteWordForward") { e.preventDefault(); commit(M.deletedWord(v, sels, 1)); }
      else if (t === "historyUndo" || t === "historyRedo") { /* the browser does it; the text then no longer matches the selections */ }
      else if (t !== "insertFromPaste" && t !== "deleteByCut") clear();
    }
    function onPaste(e) {
      if (!sels) return;
      var str = (e.clipboardData && e.clipboardData.getData("text/plain") || "").replace(/\r\n?/g, "\n");
      e.preventDefault(); if (str) insertText(str);
    }
    function onCopy(e, cut) {
      if (!sels) return;
      var parts = texts();
      e.preventDefault();
      if (!parts.length) { ctx.say("Select some text first"); return; }
      e.clipboardData.setData("text/plain", parts.join("\n"));
      if (cut) commit(M.cut(ta.value, sels));
    }
    /* any change that was not ours (a File command, undo, a drop) leaves the selections pointing at the wrong text; so does the text box's own selection moving */
    function verify() {
      if (!sels) return;
      if (!expected || ta.selectionStart !== expected[0] || ta.selectionEnd !== expected[1]) clear();
    }
    ta.addEventListener("mousedown", onMouseDown, true);
    ta.addEventListener("keydown", onKeyDown, true);
    ta.addEventListener("beforeinput", onBeforeInput);
    ta.addEventListener("paste", onPaste);
    ta.addEventListener("copy", function (e) { onCopy(e, false); });
    ta.addEventListener("cut", function (e) { onCopy(e, true); });
    ta.addEventListener("input", function () { if (!applying) clear(); });
    ta.addEventListener("compositionstart", clear);
    ta.addEventListener("keyup", verify); ta.addEventListener("mouseup", verify); ta.addEventListener("select", verify);
    document.addEventListener("selectionchange", function () { if (!ta.isConnected) return; if (document.activeElement === ta) verify(); });
    /* ---- Edit-menu commands and shortcuts, for every selection; returns false when there is only one selection ---- */
    /* Multi-Select All: every place in the page where the selected text (or, with nothing selected, the word at the caret) occurs. opt: ignore (neither capitals nor whole words matter),
       case (capitals matter), word (whole words only), caseword (both matter). The match you started from stays the text box's own. */
    function selectMatches(opt) {
      var v = ta.value, cur = current(), pr = cur[M.primaryIndex(cur)], s = lo(pr), e = hi(pr);
      if (e === s) {
        var w = M.wordAt(v, s);
        if (!/[\p{L}\p{N}]/u.test(v.slice(w.s, w.e))) { ctx.say("Put the cursor in a word, or select some text, first"); ta.focus(); return; }
        s = w.s; e = w.e;
      }
      var needle = v.slice(s, e), found = M.findAll(v, needle, opt === "case" || opt === "caseword", opt === "word" || opt === "caseword"), at = -1;
      found.forEach(function (r, i) { if (r.a === s && r.h === e) at = i; });
      if (at < 0) { found.push({ a: s, h: e }); found = M.normalize(found); found.forEach(function (r, i) { if (r.a === s && r.h === e) at = i; }); }
      found[at].p = true;
      ta.focus(); set(found);
      var shown = needle.length > 24 ? needle.slice(0, 24) + "\u2026" : needle.replace(/\n/g, " ");
      ctx.say(found.length + (found.length === 1 ? " match of " : " matches of ") + "\u201C" + shown + "\u201D" + (found.length >= 20000 ? " (the most it will select)" : ""));
    }
    var PER_RANGE = /^edit\.(tab|shifttab|case\.)/, PER_BLOCK = /^edit\.(indent\.|lines\.|blank\.)/;
    function run(cmd) {
      if (cmd.indexOf("edit.multi.") === 0) { selectMatches(cmd.slice(11)); return true; }
      if (!sels) return false;
      if (cmd === "edit.undo" || cmd === "edit.redo") { ta.focus(); document.execCommand(cmd === "edit.undo" ? "undo" : "redo"); clear(); return true; }
      if (cmd === "edit.cut" || cmd === "edit.copy") { ta.focus(); document.execCommand(cmd.slice(5)); return true; }
      if (cmd === "edit.selectall") { clear(); ta.focus(); ta.select(); return true; }
      if (cmd === "edit.delete") { commit(M.deleted(ta.value, sels, 1)); return true; }
      if (cmd === "edit.paste") {
        if (!navigator.clipboard || !navigator.clipboard.readText) { ctx.say("Press Ctrl+V to paste"); ta.focus(); return true; }
        navigator.clipboard.readText().then(function (t) { t = t.replace(/\r\n?/g, "\n"); if (!t) ctx.say("The clipboard is empty"); else if (sels) insertText(t); }, function () { ctx.say("Press Ctrl+V to paste"); ta.focus(); });
        return true;
      }
      if (cmd === "edit.home" || cmd === "edit.homeextend") { var m = M.moveAll(ta.value, sels, "home", cmd === "edit.homeextend", null, P.homeTarget); set(m.ranges); return true; }
      var each = PER_RANGE.test(cmd), blockwise = PER_BLOCK.test(cmd);
      if (!each && !blockwise) { clear(); return false; }   /* a command with no multi-selection form: it acts on the text box's own selection */
      var out = M.runCommand(ta.value, sels, cmd, blockwise);
      if (!out) { ctx.say("Nothing to change"); ta.focus(); return true; }
      commit(out); return true;
    }
    return { active: function () { return !!sels; }, draw: draw, clear: clear, run: run };
  };
})();
