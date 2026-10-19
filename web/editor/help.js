/* Write a guide page: help as a window that floats over the editor. It takes no room from the two panes, can be dragged by its title bar and resized from its corner, and stays where it was put.
   Four Site Guide pages are in it. Each is cut into reading pages at its ## and ### headings, and a Contents list lists the four pages, with the one being read opened out into its own pages. */
(function () {
  "use strict";
  var P = window.udfopEditor = window.udfopEditor || {};
  var KEY = "udfop.editor.help", DOCS = [["using-the-editor", "How to use the editor"], ["how-to-write-a-page", "How to write a guide page"], ["formatting-reference", "Formatting reference"], ["troubleshooting", "Troubleshooting and FAQ"]];
  function plain(s) { return s.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\{\{|\}\}/g, "").replace(/[*_`]/g, "").trim(); }
  /* cut a page at its ## and ### headings (not inside a code box); a page with nothing on it is left out and its heading points at the next one */
  function split(md) {
    var chunks = [{ title: "Overview", group: "", lines: [] }], fence = null, ids = {}, group = "";
    md.split("\n").forEach(function (l) {
      var f = /^(`{3,}|~{3,})/.exec(l);
      if (f) { if (!fence) fence = f[1]; else if (f[1].charAt(0) === fence.charAt(0) && f[1].length >= fence.length && /^(`{3,}|~{3,})\s*$/.test(l)) fence = null; }
      else if (!fence) {
        var m2 = /^##\s+(.*?)\s*#*\s*$/.exec(l), m3 = /^###\s+(.*?)\s*#*\s*$/.exec(l);
        if (m2) { group = plain(m2[1]); chunks.push({ title: group, group: group, section: true, lines: [] }); ids[group] = chunks.length - 1; return; }
        if (m3) { var t3 = plain(m3[1]); chunks.push({ title: t3, group: group, lines: [] }); ids[t3] = chunks.length - 1; return; }
        if (/^#{4,6}\s/.test(l)) l = l.slice(2);   /* a smaller heading inside a page */
      }
      chunks[chunks.length - 1].lines.push(l);
    });
    var keep = [], remap = {};
    chunks.forEach(function (c, i) { if (c.lines.join("").trim()) { remap[i] = keep.length; keep.push(c); } });
    function next(i) { while (i < chunks.length && remap[i] === undefined) i++; return remap[i] === undefined ? keep.length - 1 : remap[i]; }
    var idMap = {}; Object.keys(ids).forEach(function (k) { idMap[k] = next(ids[k]); });
    var count = {}; keep.forEach(function (c) { count[c.group] = (count[c.group] || 0) + 1; });
    keep.forEach(function (c) { c.label = c.section && count[c.group] > 1 ? "Introduction" : c.title; });
    return { chunks: keep, idMap: idMap, count: count };
  }
  /* ctx: { host (the .edw-main the window floats over), H (udfopHost), back(toMenu) (returns the element to focus when the window closes) } */
  P.helpWindow = function (ctx) {
    var H = ctx.H, host = ctx.host, esc = H.esc, el = null, bodyEl, listEl, pageEl, grip, cache = {}, doc = null, idx = 0, openGroups = {};
    var box = { x: null, y: null, w: 780, h: 640, out: true, slug: DOCS[0][0], i: 0 };
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || "{}");
      ["x", "y", "w", "h", "i"].forEach(function (k) { if (typeof s[k] === "number" && isFinite(s[k])) box[k] = s[k]; });
      if (typeof s.out === "boolean") box.out = s.out;
      if (DOCS.some(function (d) { return d[0] === s.slug; })) box.slug = s.slug;
    } catch (e) {}
    function save() { try { localStorage.setItem(KEY, JSON.stringify(box)); } catch (e) {} }
    function phone() { return window.matchMedia("(max-width: 720px)").matches; }
    function apply() {   /* keep the window inside the workspace */
      if (!el) return;
      if (phone()) { el.style.left = el.style.top = el.style.width = el.style.height = ""; el.removeAttribute("data-wide"); return; }
      var mw = host.clientWidth, mh = host.clientHeight;
      var w = Math.min(Math.max(box.w, 320), Math.max(mw, 0)), h = Math.min(Math.max(box.h, 280), Math.max(mh, 0));
      var x = typeof box.x === "number" ? box.x : mw - w - 16, y = typeof box.y === "number" ? box.y : 16;
      x = Math.max(0, Math.min(x, mw - w)); y = Math.max(0, Math.min(y, mh - h));
      box.x = Math.round(x); box.y = Math.round(y); box.w = Math.round(w); box.h = Math.round(h);
      el.style.left = box.x + "px"; el.style.top = box.y + "px"; el.style.width = box.w + "px"; el.style.height = box.h + "px";
      el.toggleAttribute("data-wide", box.w > 620);   /* a wide window shows the list beside the page; a narrow one lays it over the page */
    }
    function drag(handle, move) {
      handle.addEventListener("pointerdown", function (e) {
        if (phone() || e.button > 0 || (handle !== grip && e.target.closest("button, a"))) return;
        e.preventDefault(); handle.setPointerCapture(e.pointerId);
        var sx = e.clientX, sy = e.clientY, b0 = { x: box.x, y: box.y, w: box.w, h: box.h };
        function mv(ev) { move(b0, ev.clientX - sx, ev.clientY - sy); apply(); }
        function up() { handle.removeEventListener("pointermove", mv); handle.removeEventListener("pointerup", up); handle.removeEventListener("pointercancel", up); save(); }
        handle.addEventListener("pointermove", mv); handle.addEventListener("pointerup", up); handle.addEventListener("pointercancel", up);
      });
    }
    function $(sel) { return el.querySelector(sel); }
    function build() {
      el = document.createElement("div"); el.className = "edw-help"; el.id = "ed-help"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "false"); el.setAttribute("aria-label", "Help"); el.tabIndex = -1; el.hidden = true;
      el.innerHTML = '<div class="edw-pbar edw-help-bar"><strong id="ed-help-title">Help</strong><span class="edw-grow"></span><a id="ed-help-open" href="#/site/' + DOCS[0][0] + '" target="_blank" rel="noopener">Open on the site</a><button type="button" class="edw-help-x" title="Close Help (Esc)">Close</button></div>' +
        '<div class="edw-help-nav"><button type="button" id="ed-help-toc" aria-pressed="true" title="Show or hide the list of pages">Contents</button><span class="edw-grow"></span><button type="button" id="ed-help-prev" aria-label="Previous page" title="Previous page (Left arrow)">&lt;</button><button type="button" id="ed-help-next" aria-label="Next page" title="Next page (Right arrow)">&gt;</button></div>' +
        '<div class="edw-help-body"><nav class="edw-help-ol" id="ed-help-ol" aria-label="Pages"></nav><div class="edw-help-page" id="ed-help-page" tabindex="0"></div></div><span class="edw-help-grip" aria-hidden="true"></span>';
      bodyEl = $(".edw-help-body"); listEl = $("#ed-help-ol"); pageEl = $("#ed-help-page"); grip = $(".edw-help-grip");
      host.appendChild(el);
      $(".edw-help-x").addEventListener("click", function () { close(false); });
      $("#ed-help-toc").addEventListener("click", function () { setList(!box.out); });
      $("#ed-help-prev").addEventListener("click", function () { go(idx - 1); });
      $("#ed-help-next").addEventListener("click", function () { go(idx + 1); });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); }
        else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) { e.preventDefault(); go(idx + (e.key === "ArrowRight" ? 1 : -1)); }   /* Left and Right turn the page */
      });
      listEl.addEventListener("click", function (e) {
        var d = e.target.closest("[data-doc]"), g = e.target.closest("[data-g]"), p = e.target.closest("[data-i]");
        if (d) { if (d.getAttribute("data-doc") !== doc.slug) show(d.getAttribute("data-doc"), 0); }
        else if (g) { var key = doc.slug + "|" + g.getAttribute("data-g"), open = g.getAttribute("aria-expanded") !== "true"; openGroups[key] = open; g.setAttribute("aria-expanded", open ? "true" : "false"); g.nextElementSibling.hidden = !open; }
        else if (p) { go(+p.getAttribute("data-i")); if (!el.hasAttribute("data-wide")) setList(false); }   /* a list laid over the page closes when a page is picked */
      });
      pageEl.addEventListener("click", function (e) {
        var a = e.target.closest("a"); if (!a) return;
        var href = a.getAttribute("href") || "", m;
        if ((m = /^#\/site\/([^#]*)(?:#(.*))?$/.exec(href)) && DOCS.some(function (d) { return d[0] === m[1]; })) { e.preventDefault(); show(m[1], -1, m[2] ? decodeURIComponent(m[2]) : ""); return; }
        if (href.charAt(0) === "#" && href.indexOf("#/") !== 0) { e.preventDefault(); toSection(decodeURIComponent(href.slice(1))); return; }
        if (!a.target) { a.target = "_blank"; a.rel = "noopener"; }   /* any other page opens in a new tab, so the draft stays where it is */
      });
      drag($(".edw-help-bar"), function (b, dx, dy) { box.x = b.x + dx; box.y = b.y + dy; });
      drag(grip, function (b, dx, dy) { box.w = b.w + dx; box.h = b.h + dy; });
      window.addEventListener("resize", apply);
      if (window.ResizeObserver) new ResizeObserver(apply).observe(host);
    }
    function setList(on) {
      box.out = on; el.setAttribute("data-out", on ? "on" : "off"); $("#ed-help-toc").setAttribute("aria-pressed", on ? "true" : "false"); save();
      if (!on && (listEl.contains(document.activeElement) || document.activeElement === document.body)) $("#ed-help-toc").focus();
    }
    function toSection(id) {   /* a heading of this page: its reading page, or the heading inside the page being shown */
      var t = doc && document.getElementById(id);
      if (t && pageEl.contains(t)) { t.scrollIntoView(); return; }
      var key = Object.keys(doc.idMap).filter(function (k) { return H.slugId(k) === id || k === id; })[0];
      if (key !== undefined) go(doc.idMap[key]);
    }
    function buildList() {
      var html = "<ul>", openG = null, cur = doc.chunks[idx];
      DOCS.forEach(function (d) {
        if (d[0] !== doc.slug) { html += '<li><button type="button" class="dh" data-doc="' + d[0] + '" aria-expanded="false">' + esc(d[1]) + "</button></li>"; return; }
        html += '<li class="doc"><button type="button" class="dh" data-doc="' + d[0] + '" aria-expanded="true" aria-current="true">' + esc(d[1]) + "</button><ul>";
        doc.chunks.forEach(function (ch, k) {
          var many = ch.group && doc.count[ch.group] > 1;
          if (many) {
            if (openG !== ch.group) {
              if (openG) html += "</ul></li>";
              var open = ch.group === cur.group || openGroups[doc.slug + "|" + ch.group];
              html += '<li class="grp"><button type="button" class="gh" data-g="' + esc(ch.group) + '" aria-expanded="' + (open ? "true" : "false") + '">' + esc(ch.group) + "</button><ul" + (open ? "" : " hidden") + ">"; openG = ch.group;
            }
          } else if (openG) { html += "</ul></li>"; openG = null; }
          html += '<li><button type="button" data-i="' + k + '"' + (k === idx ? ' aria-current="page"' : "") + ">" + esc(ch.label) + "</button></li>";
        });
        if (openG) { html += "</ul></li>"; openG = null; }
        html += "</ul></li>";
      });
      listEl.innerHTML = html + "</ul>";
      var c = listEl.querySelector('[aria-current="page"]'); if (c) c.scrollIntoView({ block: "nearest" });
    }
    function render(refocus) {
      var c = doc.chunks[idx], html;
      box.slug = doc.slug; box.i = idx; save();
      try { html = H.renderDoc(c.lines.join("\n"), c.title, { area: "site", key: "site|" + doc.slug }); } catch (e) { html = '<div class="mbox">This help page could not be drawn.</div>'; }
      pageEl.innerHTML = '<h1 class="title">' + esc(idx === 0 ? doc.title : c.title) + "</h1>" + (idx === 0 ? "" : '<div class="hat">' + esc(doc.title) + (!c.section && c.group ? " › " + esc(c.group) : "") + "</div>") + '<div id="gp">' + html + "</div>";
      pageEl.scrollTop = 0;
      $("#ed-help-title").textContent = doc.title + (doc.chunks.length > 1 ? " · " + (idx + 1) + " of " + doc.chunks.length : "");
      $("#ed-help-open").href = "#/site/" + doc.slug;
      $("#ed-help-prev").disabled = idx === 0; $("#ed-help-next").disabled = idx >= doc.chunks.length - 1;
      var had = refocus && listEl.contains(document.activeElement);
      buildList();
      if (had) { var b = listEl.querySelector('[aria-current="page"]'); if (b) b.focus(); }   /* the list is rebuilt: focus stays on the current page's button */
    }
    function go(i) { if (!doc || i < 0 || i >= doc.chunks.length) return; idx = i; render(true); }
    function show(slug, i, section) {
      function ready(d) {
        doc = d; idx = Math.max(0, Math.min(typeof i === "number" && i >= 0 ? i : 0, d.chunks.length - 1));
        if (section && d.idMap[section] !== undefined) idx = d.idMap[section];
        else if (section) { var k = Object.keys(d.idMap).filter(function (q) { return H.slugId(q) === section; })[0]; if (k !== undefined) idx = d.idMap[k]; }
        render(true);
      }
      if (cache[slug]) { ready(cache[slug]); return; }
      pageEl.innerHTML = "<p>Loading…</p>";
      fetch("site/" + slug + ".md").then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (raw) {
        var fm = H.frontMatter(raw.replace(/\r\n?/g, "\n")), d = split(fm.body);
        d.slug = slug; d.title = fm.meta.title || DOCS.filter(function (q) { return q[0] === slug; })[0][1]; cache[slug] = d; ready(d);
      }, function () { pageEl.innerHTML = '<p>The help page could not be loaded. <a href="#/site/' + slug + '" target="_blank" rel="noopener">Open it on the site</a>.</p>'; });
    }
    function open() {
      if (!el) build();
      el.hidden = false; el.setAttribute("data-out", box.out ? "on" : "off"); $("#ed-help-toc").setAttribute("aria-pressed", box.out ? "true" : "false"); apply();
      if (!doc) { show(box.slug, box.i); if (!el.hasAttribute("data-wide") && box.out) { el.setAttribute("data-out", "off"); $("#ed-help-toc").setAttribute("aria-pressed", "false"); } }   /* a window too narrow for the list beside the page starts with the page showing */
      el.focus();
    }
    function close(toMenu) {   /* Esc returns to the ? button; the close button returns to the text */
      if (!el || el.hidden) return;
      el.hidden = true;
      var back = ctx.back && ctx.back(toMenu); if (back) back.focus();
    }
    return { open: open, close: close, toggle: function () { if (el && !el.hidden) el.focus(); else open(); }, isOpen: function () { return !!el && !el.hidden; } };
  };
})();
