/* The guide editor: the text box finishes what the writer is typing (complete.js says how). It closes brackets and marks, carries lists, quotes, tables and code boxes on at Enter and Tab,
   and shows a list of names under the caret after [[, {{, ](, > [! and in the front matter. */
(function () {
  "use strict";
  var P = window.udfopEditor = window.udfopEditor || {};
  /* ctx: { ta, hl (the colored copy, for the caret's place), multi (the multi-selection part), H (udfopHost), say } */
  P.completion = function (ctx) {
    var ta = ctx.ta, hl = ctx.hl, multi = ctx.multi, H = ctx.H, C = P.complete, M = P.multi;
    var root = ta.closest(".edw"), list = document.createElement("ul"), shown = [], at = 0, current = null, dismissed = "", applying = false, escaped = false, cache = {}, images = null;
    list.className = "edw-dd edw-sg"; list.id = "ed-sg"; list.setAttribute("role", "listbox"); list.setAttribute("aria-label", "Suggestions"); list.hidden = true;
    root.appendChild(list);
    ta.setAttribute("aria-autocomplete", "list"); ta.setAttribute("aria-controls", "ed-sg"); ta.setAttribute("aria-expanded", "false");

    /* ---- applying a change as typing would, so that one Ctrl+Z takes it back ---- */
    function apply(p) {
      var v = ta.value, expected = v.slice(0, p.start) + p.text + v.slice(p.end);
      applying = true;
      try {
        if (p.text !== v.slice(p.start, p.end)) {
          ta.focus(); ta.setSelectionRange(p.start, p.end);
          try { if (p.text === "") document.execCommand("delete"); else document.execCommand("insertText", false, p.text); } catch (e) {}
          if (ta.value !== expected) { ta.value = expected; ta.dispatchEvent(new Event("input")); }
        }
        ta.setSelectionRange(p.a, p.b);
      } finally { applying = false; }
    }

    /* ---- what can be offered ---- */
    function sorted(src, key) {
      var c = cache[key];
      if (!c || c.src !== src || c.n !== src.length) c = cache[key] = { src: src, n: src.length, out: src.slice().sort(function (a, b) { return a.title.localeCompare(b.title); }) };
      return c.out;
    }
    function fetchImages() {
      if (images !== null) return;
      images = [];
      fetch("guide/images.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (l) { images = Array.isArray(l) ? l : []; refresh(); }, function () {});
    }
    function data(kind) {
      if (kind === "image") fetchImages();
      var pages = H.pageList(false), site = H.pageList(true), cats = {};
      (kind === "category" ? pages : []).forEach(function (p) { if (p.category) cats[p.category] = 1; });
      return {
        pages: sorted(pages, "p"), site: sorted(site, "s"), topics: H.topicNames ? H.topicNames() : [], categories: Object.keys(cats).sort(), images: images || [],
        headings: function (name) {
          var site = /^site:/i.test(name), key = name.replace(/^(site|guide):\s*/i, "").trim().toLowerCase();
          if (/^(topic|patch):/i.test(name) || !key) return [];
          var src = H.pageSource(key, site);
          return typeof src === "string" ? C.headingsOf(src.replace(/\r\n?/g, "\n")) : null;
        }
      };
    }

    /* ---- the list ---- */
    function caretRect(pos) {
      var starts = M.lineIndex(ta.value), line = M.lineOfPos(starts, pos), col = pos - starts[line], row = hl.children[line];
      if (!row) return null;
      var w = document.createTreeWalker(row, NodeFilter.SHOW_TEXT), node, n = 0, r = document.createRange(), rects, last = null;
      while ((node = w.nextNode())) {
        var len = node.nodeValue.length;
        if (col <= n + len) {
          var off = col - n;
          r.setStart(node, off); r.setEnd(node, off); rects = r.getClientRects();
          if (rects.length) return rects[0];
          if (off > 0) { r.setStart(node, off - 1); rects = r.getClientRects(); if (rects.length) { var q = rects[rects.length - 1]; return { left: q.right, top: q.top, bottom: q.bottom }; } }
          break;
        }
        n += len; last = node;
      }
      var b = row.getBoundingClientRect();
      return { left: b.left, top: b.top, bottom: b.bottom };
    }
    function place(tries) {
      var rect = caretRect(ta.selectionStart);
      if (!rect) {   /* the colored copy has not been repainted for a new line yet */
        if ((tries || 0) < 3) setTimeout(function () { if (!list.hidden) place((tries || 0) + 1); }, 30); else hide();
        return;
      }
      list.style.left = "0px"; list.style.top = "0px";
      var w = list.offsetWidth, h = list.offsetHeight, x = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8)), y = rect.bottom + 2;
      if (y + h > window.innerHeight - 8 && rect.top - h - 2 > 8) y = rect.top - h - 2;
      list.style.left = x + "px"; list.style.top = y + "px";
    }
    function draw() {
      list.innerHTML = shown.map(function (it, i) {
        return '<li role="none"><div class="edw-mi" role="option" id="ed-sg' + i + '" data-i="' + i + '" aria-selected="' + (i === at) + '"><span class="sg-l"></span><span class="mi-k"></span></div></li>';
      }).join("");
      Array.prototype.forEach.call(list.querySelectorAll(".edw-mi"), function (el, i) { el.firstChild.textContent = shown[i].label; el.lastChild.textContent = shown[i].detail || ""; });
      ta.setAttribute("aria-activedescendant", "ed-sg" + at);
    }
    function select(i) {
      at = (i + shown.length) % shown.length;
      Array.prototype.forEach.call(list.children, function (li, k) { li.firstChild.setAttribute("aria-selected", k === at ? "true" : "false"); });
      ta.setAttribute("aria-activedescendant", "ed-sg" + at);
      var el = list.children[at]; if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
    }
    function hide() {
      if (list.hidden) return;
      list.hidden = true; shown = []; current = null; ta.setAttribute("aria-expanded", "false"); ta.removeAttribute("aria-activedescendant");
    }
    function refresh() {
      if (applying || !ta.isConnected) return;
      if (document.activeElement !== ta || (multi && multi.active()) || ta.selectionStart !== ta.selectionEnd) { hide(); return; }
      var v = ta.value, s = ta.selectionStart, c = C.context(v, s);
      if (!c) { hide(); return; }
      var key = c.kind + ":" + c.from;
      if (key === dismissed) { hide(); return; }
      var its = C.items(c, data(c.kind), 10);
      if (!its.length) { hide(); return; }
      var same = !list.hidden && current && current.kind === c.kind && shown.length === its.length && shown.every(function (x, i) { return x.label === its[i].label; });
      current = c; shown = its;
      if (!same) { at = 0; draw(); }
      list.hidden = false; ta.setAttribute("aria-expanded", "true");
      place();
      requestAnimationFrame(function () { if (!list.hidden) place(); });   /* the colored copy is repainted a frame after the text changes */
    }
    function choose(i) {
      var c = current, it = shown[i]; if (!c || !it) return;
      hide();
      apply(C.accept(ta.value, ta.selectionStart, c, it));
      ta.focus();
      refresh();
    }
    list.addEventListener("mousedown", function (e) { e.preventDefault(); });   /* the text box keeps the focus */
    list.addEventListener("click", function (e) { var el = e.target.closest("[data-i]"); if (el) choose(+el.getAttribute("data-i")); });
    list.addEventListener("mouseover", function (e) { var el = e.target.closest("[data-i]"); if (el && +el.getAttribute("data-i") !== at) select(+el.getAttribute("data-i")); });

    /* ---- the keys ---- */
    ta.addEventListener("beforeinput", function (e) {
      if (applying || e.defaultPrevented || e.isComposing || e.inputType !== "insertText" || !e.data || e.data.length !== 1 || (multi && multi.active())) return;
      if ("*`[({)]}!".indexOf(e.data) < 0) return;
      var p = C.typed(ta.value, ta.selectionStart, ta.selectionEnd, e.data);
      if (p) { e.preventDefault(); apply(p); }
    });
    ta.addEventListener("keydown", function (e) {
      if (e.isComposing || e.keyCode === 229 || applying) return;
      var k = e.key, plain = !e.ctrlKey && !e.metaKey && !e.altKey;
      if (k === "Escape") { escaped = true; if (!list.hidden) { dismissed = current.kind + ":" + current.from; hide(); e.preventDefault(); e.stopImmediatePropagation(); } return; }
      var wasEscaped = escaped; escaped = false;
      if (!plain) return;
      if (!list.hidden) {
        if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); e.stopImmediatePropagation(); select(at + (k === "ArrowDown" ? 1 : -1)); return; }
        if ((k === "Enter" || k === "Tab") && !e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); choose(at); return; }
      }
      if (multi && multi.active()) return;
      var v = ta.value, s = ta.selectionStart, en = ta.selectionEnd, p = null;
      if (k === "Enter" && !e.shiftKey) p = C.enter(v, s, en);
      else if (k === "Backspace" && !e.shiftKey) p = C.backspace(v, s, en);
      else if (k === "Tab" && !wasEscaped) p = C.tab(v, s, en, e.shiftKey);
      if (p) { e.preventDefault(); e.stopImmediatePropagation(); apply(p); refresh(); }
    });
    ta.addEventListener("input", function () { refresh(); });
    ta.addEventListener("scroll", function () { if (!list.hidden) place(); });
    ta.addEventListener("blur", function () { hide(); });
    document.addEventListener("selectionchange", function () { if (!ta.isConnected) return; if (document.activeElement === ta) refresh(); });
    window.addEventListener("resize", function () { if (!list.hidden) place(); });
    return { refresh: refresh, hide: hide, active: function () { return !list.hidden; } };
  };
})();
