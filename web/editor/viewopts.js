/* The guide editor: the View menu. The settings (kept between visits), the margin, zoom, the change marks, the wrap marks and the scrolling of the preview with the text. */
(function () {
  "use strict";
  var P = window.udfopEditor = window.udfopEditor || {};
  var KEY = "udfop.editor.view";
  var DEFAULTS = { wrap: true, num: true, change: false, line: true, sync: true, pick: false, ws: false, eol: false, np: false, cc: false, guide: false, wsym: false, ez: 14, pz: 1 };
  var EZ = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40];   /* editor font sizes in pixels; 14 is the default */
  var PZ = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];   /* preview sizes as a factor */
  var TOGGLES = { "view.ws": "ws", "view.eol": "eol", "view.np": "np", "view.cc": "cc", "view.guide": "guide", "view.wsym": "wsym", "view.sync": "sync", "view.pick": "pick", "view.wrap": "wrap", "view.num": "num", "view.change": "change", "view.line": "line" };
  var SYMBOLS = ["ws", "eol", "np", "cc"];   /* what Show All Characters switches */

  /* ---- pure parts ---- */
  function load(store) {
    var s = {}, k, raw = null;
    try { raw = JSON.parse(store.getItem(KEY) || "null"); } catch (e) {}
    for (k in DEFAULTS) s[k] = raw && typeof raw[k] === typeof DEFAULTS[k] ? raw[k] : DEFAULTS[k];
    if (EZ.indexOf(s.ez) < 0) s.ez = DEFAULTS.ez;
    if (PZ.indexOf(s.pz) < 0) s.pz = DEFAULTS.pz;
    return s;
  }
  function zoomStep(list, cur, dir) {   /* the next size up (1) or down (-1) in list, from the size nearest to cur */
    var at = 0, k;
    for (k = 1; k < list.length; k++) if (Math.abs(list[k] - cur) < Math.abs(list[at] - cur)) at = k;
    return list[Math.max(0, Math.min(list.length - 1, at + dir))];
  }
  /* the lines of the Markdown headings (# to ######) that the preview shows as headings: not in the front matter and not in a code fence */
  function headings(text) {
    var fm = 0, fence = null, out = [];
    text.split("\n").forEach(function (l, i) {
      var m;
      if (i === 0 && /^---\s*$/.test(l)) { fm = 1; return; }
      if (fm === 1) { if (/^---\s*$/.test(l)) fm = 2; return; }
      if (fence) { m = /^(`{3,}|~{3,})\s*$/.exec(l); if (m && m[1].charAt(0) === fence.charAt(0) && m[1].length >= fence.length) fence = null; return; }
      if ((m = P.FENCE.exec(l))) { fence = m[1]; return; }
      if (/^#{1,6}\s/.test(l)) out.push(i);
    });
    return out;
  }
  /* Where the other view should be scrolled to. from and to are the positions of the same headings in the two views (first 0, last the furthest scroll); y is a scroll position in the first view.
     Between two headings the position is carried over in proportion. */
  function mapScroll(from, to, y) {
    var k, n = from.length;
    if (n < 2) return 0;
    if (y <= from[0]) return to[0];
    for (k = 1; k < n; k++) {
      if (y < from[k] || k === n - 1) {
        var span = from[k] - from[k - 1];
        return span > 0 ? to[k - 1] + Math.max(0, Math.min(1, (y - from[k - 1]) / span)) * (to[k] - to[k - 1]) : to[k];
      }
    }
    return to[n - 1];
  }
  function monotone(a, max) {   /* anchors that never go back, and never past the furthest scroll */
    var out = [], k, prev = 0;
    for (k = 0; k < a.length; k++) { prev = Math.min(Math.max(a[k], prev), max); out.push(prev); }
    return out;
  }
  /* Change marks. states[i] is 0 (as it was when opened), 1 (changed since the last save) or 2 (changed, and saved). prev and next are the lines before and after an edit. */
  function track(states, prev, next) {
    var n = next.length, m = prev.length, a = 0, b = 0, out, k;
    while (a < n && a < m && prev[a] === next[a]) a++;
    while (b < n - a && b < m - a && prev[m - 1 - b] === next[n - 1 - b]) b++;
    out = states.slice(0, a);
    if (n === m) { for (k = a; k < n - b; k++) out.push(prev[k] === next[k] ? states[k] : 1); }
    else for (k = a; k < n - b; k++) out.push(1);
    out = out.concat(states.slice(m - b));
    if (n < m && n - a - b === 0 && n) out[Math.min(a, n - 1)] = 1;   /* lines were removed: the line where they were is marked */
    return out;
  }
  function saved(states) { return states.map(function (s) { return s === 1 ? 2 : s; }); }
  P.viewOpts = { DEFAULTS: DEFAULTS, EZ: EZ, PZ: PZ, load: load, zoomStep: zoomStep, headings: headings, mapScroll: mapScroll, monotone: monotone, track: track, saved: saved };

  /* ---- in the page ---- */
  /* ctx: { ta, hl (the rows), hlBox, pv (the preview's scroll box), prev (the preview's article), repaint(), say(text) } */
  P.viewControls = function (ctx) {
    var ta = ctx.ta, hl = ctx.hl, hlBox = ctx.hlBox, pv = ctx.pv, prev = ctx.prev, stack = hlBox.parentNode, S, store = null;
    try { store = window.localStorage; } catch (e) {}
    S = load(store || { getItem: function () { return null; } });
    var edPane = ta.closest(".edw-pane"), pvPane = pv.closest(".edw-pane"), lastPane = "editor";
    var wm = document.createElement("div"), wmQueued = false;
    wm.id = "ed-wm"; wm.setAttribute("aria-hidden", "true"); hlBox.appendChild(wm);
    var lines = null, states = [], resetNext = false, lastCur = -1;

    function save() { try { store.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
    function pct(v) { return Math.round(v * 100) + "%"; }
    function apply() {
      stack.classList.toggle("nowrap", !S.wrap);
      ta.setAttribute("wrap", S.wrap ? "soft" : "off");
      stack.style.setProperty("--ef", S.ez + "px");
      prev.style.zoom = S.pz === 1 ? "" : String(S.pz);
      hlBox.classList.toggle("ln", S.num); hlBox.classList.toggle("chg", S.change);
    }
    function layout(n) {   /* the room for the margin; the text box and the colored copy get the same left padding */
      var gn = S.num ? Math.max(2, String(n).length) + 1.5 : 0, gc = S.change ? 6 : 0;
      stack.style.setProperty("--gn", gn + "ch"); stack.style.setProperty("--gc", gc + "px");
      stack.style.setProperty("--gut", gn || gc ? "calc(" + gn + "ch + " + gc + "px)" : "0px");
    }
    function lineAt(text, pos) { return P.multi.lineOfPos(P.multi.lineIndex(text), pos); }
    function rows(text, drawn) {   /* the colored rows for the text, with what the View menu adds */
      var next = text.split("\n");
      if (!lines || resetNext) { states = next.map(function () { return 0; }); resetNext = false; }
      else if (lines.length !== next.length || lines.some(function (l, i) { return l !== next[i]; })) states = P.viewOpts.track(states, lines, next);
      lines = next;
      layout(next.length);
      var cur = {};
      lastCur = -1;
      if (S.line) {
        lastCur = lineAt(text, ta.selectionDirection === "backward" ? ta.selectionStart : ta.selectionEnd); cur[lastCur] = true;
        if (drawn) (drawn.carets || []).forEach(function (c) { cur[lineAt(text, c)] = true; });
      }
      var sym = S.ws || S.eol || S.np || S.cc || S.guide ? { ws: S.ws, eol: S.eol, np: S.np, cc: S.cc, guide: S.guide } : null;
      var pk = drawn && drawn.pick;   /* Pick mode: the rows of the block under the pointer in the preview */
      return P.highlightRows(text, drawn, { sym: sym, cls: function (i) {
        return (cur[i] ? "cur" : "") + (S.change && states[i] ? (cur[i] ? " " : "") + (states[i] === 1 ? "cm" : "cs") : "") + (pk && i >= pk[0] && i <= pk[1] ? " pk" : "");
      } });
    }
    /* ---- wrap marks: one at the end of every line of the text that continues on the next row ---- */
    function wrapMarks() {
      wmQueued = false;
      if (!S.wsym || !S.wrap) { if (wm.firstChild) wm.textContent = ""; return; }
      var rs = hl.children, top = ta.scrollTop, bottom = top + ta.clientHeight, lh = parseFloat(getComputedStyle(ta).lineHeight) || 21, lo = 0, hi = rs.length - 1, out = "", i, k, r, n;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (rs[mid].offsetTop + rs[mid].offsetHeight < top) lo = mid + 1; else hi = mid; }
      for (i = lo; i < rs.length && rs[i].offsetTop < bottom; i++) {
        r = rs[i]; n = Math.round(r.offsetHeight / lh);
        for (k = 0; k < n - 1; k++) out += '<i style="top:' + (r.offsetTop + k * lh) + 'px"></i>';
      }
      wm.innerHTML = out;
      wm.style.transform = "translateY(" + -top + "px)";
    }
    function marksSoon() { if (!wmQueued) { wmQueued = true; requestAnimationFrame(wrapMarks); } }
    /* ---- the preview follows the text, and the text follows the preview, heading to heading ---- */
    var headCache = { text: null, lines: [] }, setEd = NaN, setPv = NaN, fq = null;
    function anchors() {   /* the positions of the headings in the text box and in the preview, or null if they do not pair up */
      var text = ta.value;
      if (headCache.text !== text) headCache = { text: text, lines: P.viewOpts.headings(text) };
      var els = prev.querySelectorAll("#gp h1, #gp h2, #gp h3, #gp h4, #gp h5, #gp h6"), hs = headCache.lines, rs = hl.children, k;
      if (els.length !== hs.length) return null;
      var edMax = Math.max(0, ta.scrollHeight - ta.clientHeight), pvMax = Math.max(0, pv.scrollHeight - pv.clientHeight), base = pv.getBoundingClientRect().top - pv.scrollTop, A = [0], B = [0];
      for (k = 0; k < hs.length; k++) {
        if (!rs[hs[k]]) return null;
        A.push(rs[hs[k]].offsetTop); B.push(els[k].getBoundingClientRect().top - base);
      }
      A.push(edMax); B.push(pvMax);
      return { a: P.viewOpts.monotone(A, edMax), b: P.viewOpts.monotone(B, pvMax), edMax: edMax, pvMax: pvMax };
    }
    function follow(from) {   /* from: "ed" or "pv", the view that was scrolled */
      if (!S.sync) return;
      var an = anchors(), ed = from === "ed", y = ed ? ta.scrollTop : pv.scrollTop, to;
      if (an) to = P.viewOpts.mapScroll(ed ? an.a : an.b, ed ? an.b : an.a, y);
      else {   /* the headings do not pair up (they differ in number): in proportion to the whole length */
        var m1 = Math.max(0, ed ? ta.scrollHeight - ta.clientHeight : pv.scrollHeight - pv.clientHeight), m2 = Math.max(0, ed ? pv.scrollHeight - pv.clientHeight : ta.scrollHeight - ta.clientHeight);
        to = m1 ? y / m1 * m2 : 0;
      }
      if (ed) { if (Math.abs(pv.scrollTop - to) > 0.5) { pv.scrollTop = to; setPv = pv.scrollTop; } }
      else if (Math.abs(ta.scrollTop - to) > 0.5) { ta.scrollTop = to; setEd = ta.scrollTop; }
    }
    function followSoon(from) { if (fq) return; fq = requestAnimationFrame(function () { fq = null; follow(from); }); }
    ta.addEventListener("scroll", function () {
      hl.style.setProperty("--sl", ta.scrollLeft + "px");
      marksSoon();
      if (Math.abs(ta.scrollTop - setEd) < 1.5) { setEd = NaN; return; }
      followSoon("ed");
    });
    pv.addEventListener("scroll", function () {
      if (Math.abs(pv.scrollTop - setPv) < 1.5) { setPv = NaN; return; }
      followSoon("pv");
    });
    /* ---- zoom: the pane that has the focus (or the one under the pointer for Ctrl + wheel); anywhere else the browser zooms the whole page ---- */
    function paneOf(node) { return node && node.closest ? (edPane.contains(node) ? "editor" : pvPane.contains(node) ? "preview" : null) : null; }
    document.addEventListener("focusin", function (e) { var p = paneOf(e.target); if (p) lastPane = p; });
    function zoom(pane, dir) {   /* dir: 1, -1, or 0 for the default */
      if (pane === "editor") { S.ez = dir ? P.viewOpts.zoomStep(EZ, S.ez, dir) : DEFAULTS.ez; ctx.say("Editor zoom " + pct(S.ez / DEFAULTS.ez)); }
      else { S.pz = dir ? P.viewOpts.zoomStep(PZ, S.pz, dir) : 1; ctx.say("Preview zoom " + pct(S.pz)); }
      save(); apply(); ctx.repaint(); marksSoon();
    }
    var acc = 0;
    [edPane, pvPane].forEach(function (pane) {
      pane.addEventListener("wheel", function (e) {
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        if (acc * e.deltaY < 0) acc = 0;
        acc += e.deltaY;
        if (Math.abs(acc) >= 40) { zoom(pane === edPane ? "editor" : "preview", acc < 0 ? 1 : -1); acc = 0; }
      }, { passive: false });
    });
    function toggle(key, value) {
      S[key] = value === undefined ? !S[key] : value;
      save(); apply(); ctx.repaint(); marksSoon();
      if (key === "sync" || key === "wrap") follow("ed");
      if (key === "pick" && ctx.onPick) ctx.onPick(S.pick);
    }
    var ctl = {
      rows: rows,
      after: function () { hl.style.setProperty("--sl", ta.scrollLeft + "px"); marksSoon(); },
      resync: function () { follow("ed"); },
      picking: function () { return S.pick; },
      setPick: function (on) { if (S.pick !== on) toggle("pick", on); },
      resetChanges: function () { resetNext = true; },
      markSaved: function () { states = P.viewOpts.saved(states); ctx.repaint(); },
      checked: function (cmd) {
        if (TOGGLES[cmd]) return !!S[TOGGLES[cmd]];
        if (cmd === "view.all") return SYMBOLS.every(function (k) { return S[k]; });
        return undefined;
      },
      run: function (cmd) {
        if (TOGGLES[cmd]) { toggle(TOGGLES[cmd]); return true; }
        if (cmd === "view.all") { var on = !SYMBOLS.every(function (k) { return S[k]; }); SYMBOLS.forEach(function (k) { S[k] = on; }); save(); ctx.repaint(); return true; }
        if (cmd === "view.zoomin") { zoom(lastPane, 1); return true; }
        if (cmd === "view.zoomout") { zoom(lastPane, -1); return true; }
        if (cmd === "view.zoom0") { zoom(lastPane, 0); return true; }
        return false;
      },
      zoomKey: function (e) {   /* Ctrl + plus, minus and 0; false when the key is not for a pane, so that the browser zooms the page */
        var pane = paneOf(e.target), k = e.key;
        if (!pane || e.altKey) return false;
        var dir = k === "+" || k === "=" ? 1 : k === "-" || k === "_" ? -1 : k === "0" ? 0 : null;
        if (dir === null) return false;
        e.preventDefault(); zoom(pane, dir); return true;
      },
      /* the current line moves with the caret */
      selection: function () {
        if (!S.line || document.activeElement !== ta) return;
        var at = lineAt(ta.value, ta.selectionDirection === "backward" ? ta.selectionStart : ta.selectionEnd);
        if (at !== lastCur) ctx.repaint();
      }
    };
    function sel() { if (!ta.isConnected) { document.removeEventListener("selectionchange", sel); return; } ctl.selection(); }
    document.addEventListener("selectionchange", sel);
    apply();
    return ctl;
  };
})();
