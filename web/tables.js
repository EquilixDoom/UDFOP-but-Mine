/* Guide-page tables: click a column heading to sort (Shift+click adds a column to the sort), a box above filters the rows, a long table scrolls in its own box under a fixed heading
   row, and a shadow shows which side a wide table still scrolls to. app.js writes the markup (div.gtable); this file only brings it to life, so a table that
   arrives later (the page changes, a tab opens) is picked up by a watcher. A column's type comes from the {num} {pct} {dur} {date} {bool} {text} tag on the divider row
   (data-types on the table); an untagged column is read as the first of those types that fits every cell, and as text when none does. */
(function () {
  var MAX_ROWS = 15;   /* the most rows a table shows before it scrolls inside its own box */
  var collator = window.Intl && Intl.Collator ? new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }) : null;
  var MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
  var EMPTY = /^(|[-–—?]|n\/a|none|tbd)$/i;
  var NUM = /([-+−]?)(\d[\d,]*(?:\.\d+)?|\.\d+)(?:\s*([kmb])(?![a-z]))?/i;  /* the first number in a cell: 1,200  -3.5  1.5k */
  var MULT = { k: 1e3, m: 1e6, b: 1e9 };
  var DUR = /(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|secs?|seconds?|min|mins|minutes?|m|h|hrs?|hours?|d|days?|w|weeks?)\b/gi;
  var UNIT = { ms: .001, s: 1, sec: 1, secs: 1, second: 1, seconds: 1, m: 60, min: 60, mins: 60, minute: 60, minutes: 60, h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600, d: 86400, day: 86400, days: 86400, w: 604800, week: 604800, weeks: 604800, millisecond: .001, milliseconds: .001 };

  function number(s) { var m = NUM.exec(s); if (!m) return null; var n = parseFloat(m[2].replace(/,/g, "")) * (m[3] ? MULT[m[3].toLowerCase()] : 1); return m[1] === "-" || m[1] === "−" ? -n : n; }
  /* each reader returns a number, or null when the cell is not of that type; strict: the whole cell must fit (used to guess a column's type) */
  var READ = {
    num: function (s, strict) { if (strict && !/^[-+−]?(\d[\d,]*(?:\.\d+)?|\.\d+)\s*[kmb]?$/i.test(s)) return null; return number(s); },
    pct: function (s, strict) { if (strict && !/^[-+−]?[\d.,]+\s*%$/.test(s)) return null; return /%/.test(s) || !strict ? number(s) : null; },
    dur: function (s, strict) {
      var c = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(s);
      if (c) return (c[1] ? +c[1] * 3600 : 0) + +c[2] * 60 + +c[3];   /* h:mm:ss or m:ss */
      var total = 0, hit = false, rest = s.replace(DUR, function (m, n, u) { hit = true; total += parseFloat(n) * (UNIT[u.toLowerCase()] || 0); return ""; });
      return hit && (!strict || !rest.replace(/[\s,]|and/gi, "")) ? total : null;
    },
    date: function (s) {
      var m = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(s);
      if (m) return Date.UTC(+m[1], +m[2] - 1, +(m[3] || 1));
      m = /^(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})$/i.exec(s) || /^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/i.exec(s);
      if (!m) return null;
      var alpha = /[a-z]/i.test(m[1]), mon = MONTHS.indexOf((alpha ? m[1] : m[2]).toLowerCase());
      return mon < 0 ? null : Date.UTC(+m[3], mon, +(alpha ? m[2] : m[1]));
    },
    bool: function (s) { return /^(yes|y|true|✓|✔|✅|on)$/i.test(s) ? 1 : /^(no|n|false|✗|✘|✕|❌|off)$/i.test(s) ? 0 : null; }
  };
  var GUESS = ["num", "pct", "dur", "date", "bool"];

  function cellText(row, k) { var c = row.cells[k]; return c ? c.textContent.replace(/\s+/g, " ").trim() : ""; }
  /* the type of each column: the tag when there is one, else the first type every non-empty cell fits */
  function typesOf(t) {
    if (t.__types) return t.__types;
    var tags = (t.getAttribute("data-types") || "").split(","), rows = t.tBodies.length ? Array.prototype.slice.call(t.tBodies[0].rows) : [], out = [];
    for (var k = 0; k < t.tHead.rows[0].cells.length; k++) {
      if (tags[k]) { out.push(tags[k]); continue; }
      var texts = rows.map(function (r) { return cellText(r, k); }).filter(function (x) { return !EMPTY.test(x); }), ty = "text";
      if (texts.length) for (var g = 0; g < GUESS.length; g++) if (texts.every(function (x) { return READ[GUESS[g]](x, true) !== null; })) { ty = GUESS[g]; break; }
      out.push(ty);
    }
    return (t.__types = out);
  }
  /* the value rows are ordered by in a column: null (the cell is empty or not of the column's type) sorts after everything, whichever way the column runs */
  function keyOf(text, type) {
    if (EMPTY.test(text)) return null;
    if (type === "text") return text;
    var v = READ[type](text, false);
    return v === null || isNaN(v) ? null : v;
  }
  function compare(a, b, type) {
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
    if (type === "text") return collator ? collator.compare(a, b) : a < b ? -1 : a > b ? 1 : 0;
    return a - b;
  }

  function sortRows(t) {
    var body = t.tBodies[0], rows = t.__rows, keys = t.__sort, types = typesOf(t);
    if (!rows) rows = t.__rows = Array.prototype.slice.call(body.rows);
    var prepared = rows.map(function (r, i) { return { r: r, i: i, k: keys.map(function (s) { return keyOf(cellText(r, s.col), types[s.col]); }) }; });
    prepared.sort(function (x, y) {
      for (var n = 0; n < keys.length; n++) {
        var a = x.k[n], b = y.k[n];
        if (a === null || b === null) { if (a !== b) return a === null ? 1 : -1; continue; }   /* empty cells stay last in both directions */
        var c = compare(a, b, types[keys[n].col]);
        if (c) return keys[n].dir === "desc" ? -c : c;
      }
      return x.i - y.i;
    });
    prepared.forEach(function (p) { body.appendChild(p.r); });
  }
  function names(t) { return Array.prototype.map.call(t.tHead.rows[0].cells, function (c) { var b = c.querySelector(".sortlbl"); return (b || c).textContent.trim(); }); }
  function paintSort(box, t) {
    var ths = t.tHead.rows[0].cells, keys = t.__sort || [], label = names(t);
    Array.prototype.forEach.call(ths, function (th, k) {
      var i = -1; keys.forEach(function (s, n) { if (s.col === k) i = n; });
      th.setAttribute("aria-sort", i === 0 ? (keys[0].dir === "desc" ? "descending" : "ascending") : "none");
      var mark = th.querySelector(".sortmark");
      if (mark) { mark.textContent = i < 0 ? "" : (keys[i].dir === "desc" ? "▼" : "▲") + (keys.length > 1 ? i + 1 : ""); }
      th.classList.toggle("sorted", i >= 0);
    });
    box.querySelector(".treset").hidden = !keys.length;
    box.querySelector(".tstat").textContent = keys.length ? "Sorted by " + keys.map(function (s) { return label[s.col] + (s.dir === "desc" ? " descending" : " ascending"); }).join(", then ") : "Sort cleared";
  }
  /* a click on a heading: alone it sorts by that column (ascending, descending, off); with Shift it adds the column to the sort, or steps it on */
  function pressHead(th, shift) {
    var box = th.closest(".gtable"), t = box.querySelector("table"), k = th.cellIndex, keys = t.__sort || [], at = -1;
    keys.forEach(function (s, n) { if (s.col === k) at = n; });
    if (shift) {
      if (at < 0) keys = keys.concat([{ col: k, dir: "asc" }]);
      else if (keys[at].dir === "asc") keys[at].dir = "desc";
      else keys.splice(at, 1);
    } else if (at >= 0 && keys.length === 1) keys = keys[0].dir === "asc" ? [{ col: k, dir: "desc" }] : [];
    else keys = [{ col: k, dir: "asc" }];
    t.__sort = keys; sortRows(t); paintSort(box, t); restripe(t);
  }

  function restripe(t) {
    if (!t.classList.contains("filtered")) return;
    var n = 0; Array.prototype.forEach.call(t.tBodies[0].rows, function (r) { r.classList.remove("alt"); if (!r.hidden) { if (n++ % 2) r.classList.add("alt"); } });
  }
  /* the words being searched are painted in the rows shown, with the CSS Custom Highlight API: nothing in the table is changed, so links, sorting and copying are untouched (a browser without it shows no highlight) */
  function paintFind(box, words) {
    if (!window.CSS || !CSS.highlights || typeof Highlight === "undefined") return;
    var ranges = [];
    if (words.length) Array.prototype.forEach.call(box.querySelector("table").tBodies[0].rows, function (r) {
      if (r.hidden) return;
      var tw = document.createTreeWalker(r, NodeFilter.SHOW_TEXT), n;
      while ((n = tw.nextNode())) {
        var low = n.nodeValue.toLowerCase();
        words.forEach(function (w) {
          for (var at = low.indexOf(w); at >= 0; at = low.indexOf(w, at + w.length)) { var rg = document.createRange(); rg.setStart(n, at); rg.setEnd(n, at + w.length); ranges.push(rg); }
        });
      }
    });
    box.__finds = ranges;
    var all = [];
    Array.prototype.forEach.call(document.querySelectorAll(".gtable"), function (b) { if (b.__finds) all = all.concat(b.__finds); });
    if (all.length) CSS.highlights.set("tfind", new Highlight(...all)); else CSS.highlights.delete("tfind");
  }
  function applyFilter(box) {
    var t = box.querySelector("table"), q = box.querySelector(".tfind").value.toLowerCase().split(/\s+/).filter(Boolean), rows = t.tBodies[0].rows, shown = 0;
    Array.prototype.forEach.call(rows, function (r) {
      if (!r.__text) r.__text = r.textContent.replace(/\s+/g, " ").toLowerCase();
      r.hidden = !q.every(function (w) { return r.__text.indexOf(w) >= 0; });
      if (!r.hidden) shown++;
    });
    t.classList.toggle("filtered", q.length > 0); restripe(t); fit(box);
    paintFind(box, q);
    box.querySelector(".tclear").hidden = !box.querySelector(".tfind").value;
    var c = box.querySelector(".tcount");
    c.textContent = q.length ? shown + " of " + rows.length + " records found" : "";
    box.querySelector(".tstat").textContent = q.length ? shown + " of " + rows.length + " records found" : "All records shown";
  }

  /* the box a table scrolls in: a table of more than MAX_ROWS shown rows is cut off at that many and scrolls inside it, the heading row fixed at the top of the box; the shadows mark a side a wide table still scrolls to */
  function fit(box) {
    var wrap = box.querySelector(".wrap"), sc = box.querySelector(".gscroll");
    wrap.classList.remove("tall"); wrap.style.maxHeight = "";
    var shown = Array.prototype.filter.call(box.querySelector("table").tBodies[0].rows, function (r) { return !r.hidden; });
    var tall = shown.length > MAX_ROWS;
    if (tall) { var last = shown[MAX_ROWS - 1]; wrap.classList.add("tall"); wrap.style.maxHeight = (last.offsetTop + last.offsetHeight + 1) + "px"; }
    var wide = wrap.scrollWidth > wrap.clientWidth + 1;
    sc.classList.toggle("sr", wide && wrap.scrollLeft + wrap.clientWidth < wrap.scrollWidth - 1);
    sc.classList.toggle("sl", wide && wrap.scrollLeft > 0);
  }
  function edges(box) {
    var wrap = box.querySelector(".wrap"), sc = box.querySelector(".gscroll");
    sc.classList.toggle("sl", wrap.scrollLeft > 0);
    sc.classList.toggle("sr", wrap.scrollLeft + wrap.clientWidth < wrap.scrollWidth - 1);
  }

  function ready(box) {
    box.setAttribute("data-ready", "");
    var wrap = box.querySelector(".wrap");
    wrap.addEventListener("scroll", function () { edges(box); }, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(function () { fit(box); }).observe(wrap); else fit(box);
    fit(box);
  }
  var queued = false;
  function scan() {
    queued = false;
    Array.prototype.forEach.call(document.querySelectorAll(".gtable:not([data-ready])"), ready);
  }
  function queue() { if (!queued) { queued = true; (window.requestAnimationFrame || setTimeout)(scan); } }
  if (window.MutationObserver) new MutationObserver(queue).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", function () { Array.prototype.forEach.call(document.querySelectorAll(".gtable[data-ready]"), fit); });
  queue();

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".sortbtn, .treset");
    if (!b || !b.closest(".gtable")) return;
    if (b.classList.contains("treset")) { var box = b.closest(".gtable"), t = box.querySelector("table"); t.__sort = []; sortRows(t); paintSort(box, t); restripe(t); box.querySelector(".sortbtn").focus(); return; }
    pressHead(b.parentNode, e.shiftKey);
  });
  document.addEventListener("input", function (e) { if (e.target.classList && e.target.classList.contains("tfind")) applyFilter(e.target.closest(".gtable")); });
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".tclear");
    if (!b) return;
    var box = b.closest(".gtable"), f = box.querySelector(".tfind"); f.value = ""; applyFilter(box); f.focus();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && e.target.classList && e.target.classList.contains("tfind") && e.target.value) { e.target.value = ""; applyFilter(e.target.closest(".gtable")); e.preventDefault(); }
  });
  /* Shift+click on a heading would otherwise select a stretch of text */
  document.addEventListener("mousedown", function (e) { if (e.shiftKey && e.target.closest && e.target.closest(".sortbtn")) e.preventDefault(); });

  /* ---- copying: the rows shown (in the order shown) as a Markdown table inside a code block, which Discord keeps aligned, or as CSV ---- */
  var DISCORD_LIMIT = 2000;
  function squash(s) { return s.replace(/\s+/g, " ").trim(); }
  function grid(t) {
    var head = Array.prototype.map.call(t.tHead.rows[0].cells, function (c) { var l = c.querySelector(".sortlbl"); return squash((l || c).textContent); });
    var align = Array.prototype.map.call(t.tHead.rows[0].cells, function (c) { return c.style.textAlign || ""; });
    var rows = Array.prototype.filter.call(t.tBodies[0].rows, function (r) { return !r.hidden; }).map(function (r) { return head.map(function (_, k) { return squash(cellText(r, k)); }); });
    return { head: head, align: align, rows: rows };
  }
  /* a spreadsheet takes a pasted HTML table as cells, and tab-separated text (the plain-text version, for a program that ignores the HTML) the same way; plain CSV text would land in one column */
  function toTsv(g) { return [g.head].concat(g.rows).map(function (r) { return r.join("\t"); }).join("\n") + "\n"; }
  function toHtml(g) {
    function e(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function row(r, tag) { return "<tr>" + r.map(function (s) { return "<" + tag + ">" + e(s) + "</" + tag + ">"; }).join("") + "</tr>"; }
    return "<table>" + row(g.head, "th") + g.rows.map(function (r) { return row(r, "td"); }).join("") + "</table>";
  }
  function toMarkdown(g) {
    var all = [g.head].concat(g.rows).map(function (r) { return r.map(function (s) { return s.replace(/\|/g, "\\|"); }); }), w = g.head.map(function (_, k) { return 3; });
    all.forEach(function (r) { r.forEach(function (s, k) { w[k] = Math.max(w[k], Array.from(s).length); }); });
    function pad(s, k) {
      var n = w[k] - Array.from(s).length, a = g.align[k];
      return a === "right" ? " ".repeat(n) + s : a === "center" ? " ".repeat(n >> 1) + s + " ".repeat(n - (n >> 1)) : s + " ".repeat(n);
    }
    var line = function (r) { return "| " + r.map(pad).join(" | ") + " |"; };
    var bar = "| " + g.head.map(function (_, k) { var a = g.align[k], d = "-".repeat(w[k] - (a === "center" ? 2 : a ? 1 : 0)); return a === "center" ? ":" + d + ":" : a === "right" ? d + ":" : a === "left" ? ":" + d : d; }).join(" | ") + " |";
    return "```\n" + [line(all[0]), bar].concat(all.slice(1).map(line)).join("\n") + "\n```";
  }
  /* html is optional: with it the clipboard holds both versions and the program pasting into picks the one it prefers */
  function writeClipboard(text, html) {
    if (html && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write)
      return navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([text], { type: "text/plain" }), "text/html": new Blob([html], { type: "text/html" }) })]);
    if (!html && navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, no) {
      var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      function put(ev) { ev.clipboardData.setData("text/plain", text); if (html) ev.clipboardData.setData("text/html", html); ev.preventDefault(); }
      document.addEventListener("copy", put);
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy") ? ok() : no(); } catch (e) { no(e); } finally { document.removeEventListener("copy", put); ta.remove(); }
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".tbtn[data-copy]");
    if (!b) return;
    var box = b.closest(".gtable"), g = grid(box.querySelector("table")), md = b.getAttribute("data-copy") === "md", text = md ? toMarkdown(g) : toTsv(g), was = b.getAttribute("data-label") || b.textContent;
    b.setAttribute("data-label", was); if (!b.hasAttribute("data-title")) b.setAttribute("data-title", b.title);
    writeClipboard(text, md ? "" : toHtml(g)).then(function () {
      var note = md && text.length > DISCORD_LIMIT ? "Copied, but Discord only takes " + DISCORD_LIMIT.toLocaleString() + " characters (" + text.length.toLocaleString() + " copied)" : "Copied";
      b.textContent = md && text.length > DISCORD_LIMIT ? "Too long" : "Copied"; b.title = note;
      box.querySelector(".tstat").textContent = note;
    }, function () { b.textContent = "Failed"; box.querySelector(".tstat").textContent = "Copy failed"; });
    clearTimeout(b.__t); b.__t = setTimeout(function () { b.textContent = was; b.title = b.getAttribute("data-title"); }, 2500);
  });

  window.udfopTables = { toTsv: toTsv, toHtml: toHtml, toMarkdown: toMarkdown, grid: grid, read: READ, keyOf: keyOf, compare: compare };
})();
