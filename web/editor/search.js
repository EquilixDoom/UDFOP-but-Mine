/* Write a guide page: searching the text. P.search is pure (it works on strings); P.findBar(ctx) is the Find / Replace / Incremental Search bar above the text box. */
(function () {
  "use strict";
  var P = window.udfopEditor = window.udfopEditor || {};
  var MAX = 10000, W = "A-Za-z0-9_";
  var S = P.search = {
    MAX: MAX,
    /* o: { matchCase, word, regex }. Returns { re } (a global RegExp) or { error }. An empty query has no pattern. */
    build: function (q, o) {
      o = o || {};
      if (!q) return { re: null };
      var src = o.regex ? q : q.replace(/[.*+?^${}()|[\]\\\/-]/g, "\\$&");
      if (o.word) src = "(?<![" + W + "])(?:" + src + ")(?![" + W + "])";
      try { return { re: new RegExp(src, "g" + (o.regex ? "m" : "") + (o.matchCase ? "" : "i")) }; }
      catch (e) { return { error: String(e.message || e).replace(/^Invalid regular expression: /, "") }; }
    },
    /* every non-empty match as [start, end], at most MAX of them */
    all: function (text, re) {
      var out = [], m;
      if (!re) return out;
      re.lastIndex = 0;
      while (out.length < MAX && (m = re.exec(text))) {
        if (!m[0].length) { re.lastIndex++; continue; }
        out.push([m.index, m.index + m[0].length]);
      }
      return out;
    },
    /* index of the first match that starts at or after pos (dir 1), or the last one that starts before pos (dir -1); wraps round. -1 when there are none. */
    pick: function (list, pos, dir) {
      var i;
      if (!list.length) return -1;
      if (dir >= 0) { for (i = 0; i < list.length; i++) if (list[i][0] >= pos) return i; return 0; }
      for (i = list.length - 1; i >= 0; i--) if (list[i][0] < pos) return i;
      return list.length - 1;
    },
    wraps: function (list, i, pos, dir) { return dir >= 0 ? list[i][0] < pos : list[i][0] >= pos; },
    /* the replacement for one match m (an exec result). In a regular expression $1, $&, $$, \n, \t and \\ are understood; otherwise the text is used as it is. */
    expand: function (repl, m, o) {
      if (!o || !o.regex) return repl;
      return repl.replace(/\$(\$|&|\d{1,2})|\\([nt\\])/g, function (all, d, c) {
        if (c) return c === "n" ? "\n" : c === "t" ? "\t" : "\\";
        if (d === "$") return "$"; if (d === "&") return m[0];
        return m[+d] === undefined ? "" : m[+d];
      });
    },
    /* the text with every match replaced: { text, count } */
    replaceAll: function (text, re, repl, o) {
      var out = "", at = 0, n = 0, m;
      if (!re) return { text: text, count: 0 };
      re.lastIndex = 0;
      while (n < MAX && (m = re.exec(text))) {
        if (!m[0].length) { re.lastIndex++; continue; }
        out += text.slice(at, m.index) + S.expand(repl, m, o); at = m.index + m[0].length; n++;
      }
      return { text: n ? out + text.slice(at) : text, count: n };
    },
    /* the replacement for the match that starts at start, or null if there is none there */
    replaceAt: function (text, re, start, repl, o) {
      if (!re) return null;
      re.lastIndex = start;
      var m = re.exec(text);
      return m && m.index === start && m[0].length ? { len: m[0].length, text: S.expand(repl, m, o) } : null;
    }
  };

  P.findBar = function (ctx) {
    var ta = ctx.ta, bar = document.getElementById("ed-find"), q = document.getElementById("ed-fq"), r = document.getElementById("ed-fr"), repRow = document.getElementById("ed-frep"),
      count = document.getElementById("ed-fcount"), bar2 = bar.querySelectorAll("[data-for=find]"), tg = { matchCase: document.getElementById("ed-fcase"), word: document.getElementById("ed-fword"), regex: document.getElementById("ed-fre") }, all = document.getElementById("ed-fall");
    var pendingAll = false, mode = null, list = [], cur = -1, err = "", anchor = 0, saved = null;

    function on(b) { return b.getAttribute("aria-pressed") === "true"; }
    function opts() { return { matchCase: on(tg.matchCase), word: mode !== "inc" && on(tg.word), regex: mode !== "inc" && on(tg.regex) }; }   /* an incremental search is plain text */
    function compute() {   /* the matches of the query in the text now */
      var b = S.build(q.value, opts());
      err = b.error || ""; list = err ? [] : S.all(ta.value, b.re);
      return b.re;
    }
    function indexOfSel() {
      for (var i = 0; i < list.length; i++) if (list[i][0] === ta.selectionStart && list[i][1] === ta.selectionEnd) return i;
      return -1;
    }
    function label() {
      count.removeAttribute("data-state");
      if (err) { count.textContent = "Invalid pattern"; count.title = err; count.setAttribute("data-state", "bad"); return; }
      count.title = "";
      if (!q.value) { count.textContent = ""; return; }
      if (!list.length) { count.textContent = "No results"; count.setAttribute("data-state", "bad"); return; }
      cur = indexOfSel();
      count.textContent = (cur >= 0 ? cur + 1 : "?") + "/" + list.length + (list.length >= S.MAX ? "+" : "");
    }
    function refresh() { compute(); label(); ctx.repaint(); }
    function show(i) {   /* selects match i in the text box (without taking the focus from the bar) */
      ctx.clear();
      ta.setSelectionRange(list[i][0], list[i][1]);
      ctx.reveal(list[i][0]); label(); ctx.repaint();
    }
    function go(pos, dir, quiet) {   /* moves to the match from pos; wraps round at either end */
      if (!list.length) { label(); ctx.repaint(); return; }
      var i = S.pick(list, pos, dir);
      if (!quiet && S.wraps(list, i, pos, dir)) ctx.say(dir >= 0 ? "Search wrapped to the top" : "Search wrapped to the bottom");
      anchor = list[i][0]; show(i);
    }
    function step(dir) {
      if (!q.value) { q.focus(); return; }
      go(dir >= 0 ? ta.selectionEnd : ta.selectionStart, dir);
    }
    function edit(s, e, str) {   /* a change that Ctrl+Z can undo: it goes in as typing would */
      var back = document.activeElement;
      ctx.clear(); ta.focus(); ta.setSelectionRange(s, e);
      var old = ta.value, ok = false;
      try { ok = str ? document.execCommand("insertText", false, str) : document.execCommand("delete"); } catch (x) {}
      if (!ok || ta.value === old) { ta.value = old.slice(0, s) + str + old.slice(e); ta.dispatchEvent(new Event("input")); }
      ta.setSelectionRange(s + str.length, s + str.length);
      if (back && back !== ta && back.focus) back.focus();
    }
    function replaceOne() {
      var re = mode === "replace" ? S.build(q.value, opts()).re : null;   /* only the Replace bar changes text */
      if (!re) return;
      if (indexOfSel() >= 0 || (compute(), indexOfSel() >= 0)) {
        var s = ta.selectionStart, one = S.replaceAt(ta.value, re, s, r.value, opts());
        if (one) { edit(s, s + one.len, one.text); anchor = s + one.text.length; compute(); go(anchor, 1, true); return; }
      }
      step(1);
    }
    function replaceAll() {
      var b = mode === "replace" ? S.build(q.value, opts()) : {};
      if (!b.re) return;
      var old = ta.value, res = S.replaceAll(old, b.re, r.value, opts());
      if (!res.count) { ctx.say("No matches to replace"); return; }
      var n = res.text, a = 0, z = 0;   /* only the stretch that changed is replaced, so one Ctrl+Z puts it all back */
      while (a < old.length && a < n.length && old.charCodeAt(a) === n.charCodeAt(a)) a++;
      while (z < old.length - a && z < n.length - a && old.charCodeAt(old.length - 1 - z) === n.charCodeAt(n.length - 1 - z)) z++;
      edit(a, old.length - z, n.slice(a, n.length - z));
      ctx.say("Replaced " + res.count + (res.count === 1 ? " match" : " matches")); refresh();
    }
    function selectAll() {   /* every match becomes a selection (several cursors), and the bar closes */
      compute();
      if (!list.length) { ctx.say(err ? "Invalid pattern" : "No matches"); q.focus(); return; }
      var found = list, pi = S.pick(found, ta.selectionStart, 1);
      close(false);
      ctx.selectAll(found, pi);
      ctx.say(found.length + (found.length === 1 ? " match selected" : " matches selected") + (found.length >= S.MAX ? " (the most it will select)" : ""));
    }
    function open(m) {
      var all = m === "findall";
      if (all) m = mode === "replace" ? "replace" : "find";
      pendingAll = all;
      var sel =ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (mode === "inc" && m === "inc") { step(1); return; }
      if (m === "inc") saved = [ta.selectionStart, ta.selectionEnd, ta.scrollTop];
      mode = m; bar.hidden = false;
      Array.prototype.forEach.call(bar2, function (el) { el.hidden = m === "inc"; });   /* whole word and regular expression are for Find and Replace */
      repRow.hidden = m !== "replace";
      if (m === "inc") q.value = "";
      else if (sel && sel.length <= 200 && sel.indexOf("\n") < 0) q.value = sel;
      anchor = ta.selectionStart;
      q.placeholder = all ? "Find, then press Enter to select all" : "Find";
      q.focus(); q.select(); refresh();
      if (q.value) go(anchor, 1, true);
      if (all && q.value) selectAll();
    }
    function close(cancel) {
      if (!mode) return;
      if (mode === "inc" && cancel && saved) { ctx.clear(); ta.setSelectionRange(saved[0], saved[1]); ta.scrollTop = saved[2]; }
      pendingAll = false; mode = null; bar.hidden = true; list = []; saved = null;
      ta.focus(); ctx.repaint();
    }
    function typed() {
      var re = compute(); label();
      if (re && list.length) go(anchor, 1, true); else ctx.repaint();
    }
    function queryKeys(e) {
      var k = e.key;
      if (k === "Escape") { e.preventDefault(); close(true); }
      else if (k === "Enter") {
        e.preventDefault();
        if (mode === "inc") close(false); else if (pendingAll) selectAll(); else step(e.shiftKey ? -1 : 1);
      } else if (mode === "inc" && (k === "ArrowDown" || k === "ArrowUp")) { e.preventDefault(); step(k === "ArrowDown" ? 1 : -1); }
      else if (k === "F3") { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
    }
    q.addEventListener("input", typed); q.addEventListener("keydown", queryKeys);
    Object.keys(tg).concat(["all"]).forEach(function (k) {
      (k === "all" ? all : tg[k]).addEventListener("click", function () { var b = this; b.setAttribute("aria-pressed", String(!on(b))); typed(); q.focus(); });
    });
    r.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); close(true); }
      else if (e.key === "Enter") { e.preventDefault(); replaceOne(); }
    });
    document.getElementById("ed-fnext").addEventListener("click", function () { step(1); });
    document.getElementById("ed-fprev").addEventListener("click", function () { step(-1); });
    document.getElementById("ed-fclose").addEventListener("click", function () { close(true); });
    document.getElementById("ed-frone").addEventListener("click", replaceOne);
    document.getElementById("ed-frall").addEventListener("click", replaceAll);
    ta.addEventListener("input", function () { if (mode) { compute(); label(); ctx.repaint(); } });
    ta.addEventListener("keyup", function (e) { if (mode && /^Arrow|Home|End|Page/.test(e.key)) label(); });
    ta.addEventListener("click", function () { if (mode) label(); });
    return {
      open: open, close: close, active: function () { return !!mode; },
      draw: function () { return mode && list.length && on(all) ? list : null; }   /* the matches to paint */
    };
  };
})();
