(function () {
  "use strict";
  var D = window.DATA, rows = [], app = document.getElementById("app");
  var SITE = "Unofficial DFO Online Pages", SHORT = "UDOP";
  var TYPES = ["Buff", "Nerf", "Removal", "New", "Rework", "Fix", "Performance", "Economy", "QoL", "UI", "Other"];
  var TYPE_LABEL = { Buff: "Buffs", Nerf: "Nerfs", Removal: "Removals", New: "Additions", Rework: "Reworks", Fix: "Fixes",
    Performance: "Performance", Economy: "Economy", QoL: "Quality of life", UI: "Interface", Other: "Other changes" };
  var TYPE_COLOR = { Buff: "var(--buff)", Nerf: "var(--nerf)", Removal: "var(--nerf)", New: "var(--new)", Rework: "var(--rework)", Fix: "var(--fix)",
    Performance: "var(--perf)", Economy: "var(--econ)", UI: "var(--ui)", QoL: "var(--qol)" };

  /* ---------- display settings (saved in this browser only) ---------- */
  var SETTINGS_KEY = "udfop.settings";
  var SETTING_OPTIONS = { skin: ["default", "oblivion", "iliac", "crier", "phosphor", "cassette"], phosphor: ["green", "amber", "blue", "white"], palette: ["gold", "parchment", "slate", "moss", "dusk", "terracotta", "graphite"], size: ["small", "medium", "large"], width: ["standard", "wide"], navbar: ["stay", "scroll"], theme: ["auto", "light", "dark"], previews: ["on", "off"], menu: ["sidebar", "popover"], panel: ["popover", "sidebar"], contents: ["popover", "sidebar"] };
  var SETTING_DEFAULTS = { skin: "default", phosphor: "green", palette: "gold", size: "medium", width: "standard", navbar: "stay", theme: "auto", previews: "on", menu: "popover", panel: "sidebar", contents: "sidebar" };
  function loadSettings() {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {}; } catch (e) {}
    var out = {};
    Object.keys(SETTING_DEFAULTS).forEach(function (k) { out[k] = SETTING_OPTIONS[k].indexOf(saved[k]) >= 0 ? saved[k] : SETTING_DEFAULTS[k]; });
    return out;
  }
  function saveSettings(st) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(st)); return true; } catch (e) { return false; }
  }
  var editorOn = false;   /* the guide editor is open: it always runs in Wide mode with the main menu and Settings as pop-ups, whatever is saved */
  function applySettings(st) {
    var d = document.documentElement;
    if (editorOn) { var o = {}; Object.keys(st).forEach(function (k) { o[k] = st[k]; }); o.width = "wide"; o.menu = "popover"; o.panel = "popover"; o.contents = "popover"; st = o; }
    [["skin", "default"], ["phosphor", "green"], ["palette", "gold"], ["size", "medium"], ["width", "standard"], ["navbar", "stay"], ["theme", "auto"], ["previews", "on"], ["menu", "sidebar"], ["panel", "popover"], ["contents", "popover"]].forEach(function (p) {
      if (st[p[0]] === p[1]) d.removeAttribute("data-" + p[0]); else d.setAttribute("data-" + p[0], st[p[0]]);
    });
    if (st.skin === "phosphor") d.setAttribute("data-theme", "dark");   /* Phosphor has no light version; the saved Mode choice is kept for the other themes */
    syncDocks(st);
    syncAnchors();
    syncTocBtn();   /* docking or undocking a panel moves where the Contents button belongs */
    fitTocRoom();
  }
  /* the dock buttons: "hide" while a panel is docked in a sidebar, "move to sidebar" while it is a pop-up */
  function syncDocks(st) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-dock]"), function (b) {
      b.textContent = st[b.getAttribute("data-dock")] === "sidebar" ? "hide" : "move to sidebar";
    });
  }
  /* --head-h is how much of the top bar is on screen (all of it while it stays visible, less as it scrolls away); --head-full is its whole height */
  function headOcc() {
    var h = document.getElementById("head");
    if (!h) return 0;
    return document.documentElement.getAttribute("data-navbar") === "scroll" ? Math.max(0, Math.round(h.getBoundingClientRect().bottom)) : h.offsetHeight;
  }
  function syncHeadOcc() { document.documentElement.style.setProperty("--head-h", headOcc() + "px"); }
  function syncHeadH() {
    var h = document.getElementById("head");
    if (h) document.documentElement.style.setProperty("--head-full", h.offsetHeight + "px");
    syncHeadOcc();
    syncAnchors();
  }
  var headScrollQueued = false;
  window.addEventListener("scroll", function () {
    if (headScrollQueued || document.documentElement.getAttribute("data-navbar") !== "scroll") return;
    headScrollQueued = true; requestAnimationFrame(function () { headScrollQueued = false; syncHeadOcc(); });
  }, { passive: true });
  /* the main menu and Settings pop-ups hang from their buttons: the menu from the left edge of the ☰, Settings from the right edge of the gear */
  function syncAnchors() {
    var d = document.documentElement, m = document.getElementById("menu"), g = document.getElementById("gear");
    if (m && m.offsetWidth) d.style.setProperty("--menu-left", Math.max(8, Math.round(m.getBoundingClientRect().left)) + "px");
    if (g && g.offsetWidth) d.style.setProperty("--gear-right", Math.max(8, Math.round(d.clientWidth - g.getBoundingClientRect().right)) + "px");
  }
  window.addEventListener("resize", syncHeadH);
  if (window.ResizeObserver) new ResizeObserver(syncHeadH).observe(document.getElementById("head"));
  applySettings(loadSettings());
  syncHeadH();

  /* ---------- helpers ---------- */
  function vcmp(a, b) {
    var x = a.split(".").map(Number), y = b.split(".").map(Number);
    for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
    return 0;
  }
  function newest(a, b) { return vcmp(b.v, a.v) || (a.id < b.id ? 1 : -1); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function enc(s) { return encodeURIComponent(s); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : /(s|x|ch|sh)$/.test(w) ? "es" : "s"); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function group(list, key) { var m = {}; list.forEach(function (r) { (m[r[key]] = m[r[key]] || []).push(r); }); return m; }
  function uniq(list) { var m = {}; list.forEach(function (k) { m[k] = 1; }); return Object.keys(m); }
  function vers(list) { return uniq(list.map(function (r) { return r.v; })).sort(vcmp); }
  function slugId(s) { return "s-" + s.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

  /* The change rows come in shards, one file per period (see tools/update_data.py). The core file (data.js) already holds every release, the
     descriptions and a count and last patch for each topic, so lists of topics, categories and patches need no rows; a page that does need them
     loads the shards first (shardsNeeded). Whatever is built from the rows is rebuilt each time a shard arrives. */
  var loadedShards = {}, shardLoads = {};
  var byTopic = {}, byVersion = {}, tagIndex = {};
  var topics = Object.keys(D.tstat).sort(function (a, b) { return a.localeCompare(b); });
  var versions = Object.keys(D.releases).filter(function (v) { return D.releases[v].c; }).sort(vcmp).reverse();   /* releases with recorded changes */
  var allVersions = Object.keys(D.releases).sort(vcmp).reverse();   /* every release, including those with no recorded changes */
  var hubs = {}, hubsLegacy = {};   /* legacy topics (removed content, listed in data/legacy.csv) stay out of the default lists and categories */
  var liveTopics = topics.filter(function (t) { return !D.legacy[t]; });
  topics.forEach(function (t) { var h = D.hubs[t] || "Uncategorised"; var set = D.legacy[t] ? hubsLegacy : hubs; (set[h] = set[h] || []).push(t); });
  var hubNames = Object.keys(hubs).sort(function (a, b) {
    if (a === "Uncategorised") return 1; if (b === "Uncategorised") return -1; return a.localeCompare(b);
  });
  function dateOf(v) { var r = D.releases[v]; return r ? r.date : ""; }
  function reindex() {
    byTopic = group(rows, "e"); byVersion = group(rows, "v"); tagIndex = {};
    topics.forEach(function (t) {
      var m = {}; (byTopic[t] || []).forEach(function (r) { (r.g || []).forEach(function (g) { m[g] = (m[g] || 0) + 1; }); });
      tagIndex[t] = m;
    });
  }
  window.UDFOP_SHARD = function (key, rs) {   /* each shard file calls this with its rows */
    if (loadedShards[key]) return;
    loadedShards[key] = true;
    rs.forEach(function (r) { rows.push(r); });
  };
  function loadShard(key) {
    if (loadedShards[key]) return Promise.resolve();
    if (!shardLoads[key]) shardLoads[key] = new Promise(function (ok, fail) {
      var el = document.createElement("script");
      el.src = "shards/" + key + ".js?v=" + D.shards[key].h;   /* the hash changes with the content, so a changed shard is never served from an old cache */
      el.onload = function () { el.remove(); ok(); };
      el.onerror = function () { el.remove(); delete shardLoads[key]; fail(new Error("shard " + key)); };
      document.head.appendChild(el);
    });
    return shardLoads[key];
  }
  function loadShards(keys) { return Promise.all(keys.map(loadShard)).then(reindex); }
  /* which shards a page needs: one patch needs its own; pages that read every change (a topic's history, search, a category) need all of them;
     lists of topics, categories and patches, the home page, About and the guides need none */
  function shardsNeeded(name, arg) {
    if (name === "patch") { var k = D.shardOf[arg]; return k ? [k] : []; }
    var all = Object.keys(D.shards);
    if (["topic", "hub", "search"].indexOf(name) >= 0) {   /* these take a date range: only the shards whose dates touch it */
      var rg = getRange();
      return !rg.active ? all : all.filter(function (k) { var d = D.shards[k].d; return (!rg.to || d[0] <= rg.to) && (!rg.from || d[1] >= rg.from); });
    }
    if (["patchnotes", "recent"].indexOf(name) >= 0) return all;
    return [];
  }

  /* ---------- date range ---------- */
  /* A date range is written in the address as ?from=2026-10-01&to=2026-10-12 (either end may be left out). It narrows the changes shown on topic, category,
     system and search pages, and only the shards whose dates touch it are loaded. A bad date is ignored; a From after the To is swapped. */
  function realDate(s) { var d = new Date(s + "T00:00:00Z"); return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(d) && d.toISOString().slice(0, 10) === s; }
  function getRange() {
    var f = routeQuery.from || "", t = routeQuery.to || "", note = "";
    if (f && !realDate(f)) { f = ""; note = "A date that is not written as year-month-day was ignored."; }
    if (t && !realDate(t)) { t = ""; note = "A date that is not written as year-month-day was ignored."; }
    if (f && t && f > t) { var x = f; f = t; t = x; note = "The From date was after the To date, so they were swapped."; }
    return { from: f, to: t, active: !!(f || t), note: note };
  }
  function inRange(r) { var rg = getRange(); return (!rg.from || r.d >= rg.from) && (!rg.to || r.d <= rg.to); }
  function rangeText(rg) { return rg.from && rg.to ? "from " + rg.from + " to " + rg.to : rg.from ? "since " + rg.from : "up to " + rg.to; }
  function shiftDay(iso, n) { var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  /* the form above a list of changes; base is the page's address without a query. Presets count back from the newest recorded release, not from today's date. */
  function rangeBox(base, rg) {
    var newestDay = dateOf(versions[0]), oldestDay = dateOf(versions[versions.length - 1]);
    function link(label, from) { return '<a href="' + base + (from ? "?from=" + from : "") + '">' + label + "</a>"; }
    var presets = link("Last 7 days", shiftDay(newestDay, -6)) + " · " + link("Last 30 days", shiftDay(newestDay, -29)) + (rg.active ? " · " + link("All dates") : "");
    var note = rg.active ? "Showing changes " + esc(rangeText(rg)) + ". " + esc(rg.note) : esc(rg.note);
    return '<form class="rangebar" id="range-form" aria-label="Date range"><div class="rh"><span class="rl">Date range</span></div>' +
      '<div class="rr"><label>From <input type="date" name="from" value="' + esc(rg.from) + '" min="' + oldestDay + '" max="' + newestDay + '"></label>' +
      '<label>To <input type="date" name="to" value="' + esc(rg.to) + '" min="' + oldestDay + '" max="' + newestDay + '"></label>' +
      '<button type="submit" class="dock">Apply</button></div>' +
      '<div class="rr sub"><span>' + presets + "</span>" + (note ? '<span class="rangenote" role="status">' + note + "</span>" : "") + "</div></form>";
  }
  function wireRange(base) {
    var f = document.getElementById("range-form"); if (!f) return;
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = [];
      if (f.from.value) q.push("from=" + f.from.value);
      if (f.to.value) q.push("to=" + f.to.value);
      location.hash = base + (q.length ? "?" + q.join("&") : "");
    });
  }
  /* what a page says when its range holds no changes; what is the thing asked about ("Market", "the Combat system") and total how many it has in all */
  function noneInRange(what, rg, total, tail) {
    return '<div class="mbox">No changes to ' + what + " " + esc(rangeText(rg)) + ". " + (total ? "It has " + plural(total, "recorded change") + " in all" + (tail || "") + ". " : "") +
      '<a href="' + esc(location.hash.split("?")[0]) + '">Show all dates</a>.</div>';
  }

  /* ---------- fragments ---------- */
  function tlink(t) { return '<a href="#/topic/' + enc(t) + '">' + esc(t) + "</a>"; }
  function vlink(v) { return '<a href="#/patch/' + enc(v) + '">' + esc(v) + "</a>"; }
  function hlink(h) { return '<a href="#/hub/' + enc(h) + '">' + esc(h) + "</a>"; }
  /* "Other" means the change has not been sorted into a more specific type, so say so where a reader meets it */
  function typeTag(r) { return '<span class="tp" data-type="' + esc(r.t) + '"' + (r.t === "Other" ? ' title="Not sorted into a more specific type"' : "") + ">" + esc(r.t) + "</span>"; }
  /* r.b: a table the developers put under the bullet, the first row its header; r.a: the text that follows the table */
  function subTable(b) {
    return '<div class="wrap"><table class="wikitable sub"><thead><tr>' + b[0].map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      b.slice(1).map(function (row) { return "<tr>" + row.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
  }
  function text(r) { return esc(r.x) + (r.b ? subTable(r.b) + (r.a ? "<p>" + esc(r.a) + "</p>" : "") : "") + (r.n ? '<span class="dev">Developer note: ' + esc(r.n) + "</span>" : ""); }

  var HOME_HAT = '<a href="#/">Main Page</a>';   /* every breadcrumb starts at the Main Page */
  var PN_HAT = HOME_HAT + ' › <a href="#/patchnotes">Patch Notes</a> › ';   /* every patch-notes page starts its breadcrumb here */
  function page(title, body, opts) {
    opts = opts || {};
    /* the extra class names (banner, breadcrumbs, footer, sidebar, popup) tell reader view this is page furniture, not article text */
    return '<h1 class="title">' + title + '</h1><div class="tagline banner">From ' + SITE + "</div>" +
      (opts.hat ? '<div class="hat breadcrumbs">' + opts.hat + "</div>" : "") + body;
  }
  function sec(id, title, lvl) { return "<h" + lvl + ' class="sec" id="' + slugId(id) + '" data-toc="' + esc(title) + '">' + esc(title) + "</h" + lvl + ">"; }

  var RELEASES_URL = "https://github.com/Lattymoy/daggerfall-js-source/releases";   /* each release is the tag app-v plus its version */
  var moreSeq = 0;   /* numbers the hidden parts behind Show-the-other buttons */
  function table(list, cols, limit) {
    list = list.slice().sort(newest);
    var rest = limit && list.length > limit ? list.slice(limit) : [], id = "more-" + (++moreSeq);
    if (rest.length) list = list.slice(0, limit);
    var h = '<div class="wrap"><table class="wikitable stack"><thead><tr>' + cols.map(function (c) { return "<th>" + c + "</th>"; }).join("") + "</tr></thead><tbody>";
    function row(r) {
      return "<tr>" + cols.map(function (c) {
        switch (c) {
          case "Patch": return '<td class="nowrap">' + vlink(r.v) + "</td>";
          case "Date": return '<td class="nowrap">' + esc(r.d) + "</td>";
          case "Source": return '<td class="nowrap"><a href="' + RELEASES_URL + "/tag/app-v" + enc(r.v) + '" rel="noopener" title="The developers&rsquo; original release notes for patch ' + esc(r.v) + ', on GitHub">Dev notes ↗</a></td>';
          case "Topic": return "<td>" + tlink(r.e) + "</td>";
          case "Type": return "<td>" + typeTag(r) + "</td>";
          default: return "<td>" + text(r) + "</td>";
        }
      }).join("") + "</tr>";
    }
    h += list.map(row).join("") + "</tbody>" + (rest.length ? '<tbody id="' + id + '" hidden>' + rest.map(row).join("") + "</tbody>" : "") + "</table></div>";
    return h + (rest.length ? '<p><button type="button" class="more" data-more="' + id + '">Show the other ' + plural(rest.length, "change") + "</button></p>" : "");
  }

  /* Changes are shown by kind first (what is new, what is fixed, what is reworked), then by topic. Small kinds that belong together share a heading. */
  var TYPE_GROUPS = [
    { key: "additions", label: "Additions", types: ["New"] },
    { key: "reworks", label: "Reworks", types: ["Rework"] },
    { key: "fixes", label: "Fixes", types: ["Fix"] },
    { key: "performance", label: "Performance", types: ["Performance"] },
    { key: "economy", label: "Economy", types: ["Economy"] },
    { key: "interface", label: "Interface and quality of life", types: ["UI", "QoL"] },
    { key: "balance", label: "Balance (buffs and nerfs)", types: ["Buff", "Nerf"] },
    { key: "removals", label: "Removals", types: ["Removal"] },
    { key: "other", label: "Other changes", types: ["Other"] }
  ];
  /* a list of changes, by topic, each line starting with the topic; the kind is spelled out only where a heading covers more than one */
  var PAGE_ROWS = 200, LIST_SHOWN = 50, TOPICS_ON_PAGE = 40;   /* a page with more changes than PAGE_ROWS shows LIST_SHOWN of each list (TOPICS_ON_PAGE topics) and a button for the rest */
  function typeBullets(list, showType) {
    return '<ul class="bul">' + list.slice().sort(function (a, b) { return a.e.localeCompare(b.e, undefined, { sensitivity: "base" }) || (a.id < b.id ? -1 : 1); }).map(function (r) {
      return "<li><b>" + tlink(r.e) + "</b> – " + (showType ? typeTag(r) + ": " : "") + text(r) + "</li>";
    }).join("") + "</ul>";
  }
  /* headings for each kind of change (with its count), each followed by that kind's changes; ids makes them linkable and lists them in Contents */
  function changesByType(list, lvl, ids) {
    var known = [];
    TYPE_GROUPS.forEach(function (g) { known = known.concat(g.types); });
    var h = "";
    TYPE_GROUPS.forEach(function (g) {
      var l = list.filter(function (r) { return g.types.indexOf(r.t) >= 0 || (g.key === "other" && known.indexOf(r.t) < 0); });
      if (!l.length) return;
      var title = g.label + " (" + l.length + ")";
      var many = list.length > PAGE_ROWS && l.length > LIST_SHOWN, showType = g.types.length > 1;
      if (many) l = l.slice().sort(function (a, b) { return a.e.localeCompare(b.e, undefined, { sensitivity: "base" }) || (a.id < b.id ? -1 : 1); });
      h += (ids ? sec("type-" + g.key, title, lvl) : "<h" + lvl + ' class="sec">' + esc(title) + "</h" + lvl + ">") +
        (many ? shownThenMore(l, LIST_SHOWN, function (x) { return typeBullets(x, showType); }, "changes", "pt-" + g.key + "-" + (++moreSeq)) : typeBullets(l, showType));
    });
    return h;
  }
  /* how many headings a list of changes gets when it is grouped by kind */
  function typeGroupCount(list) {
    var known = [];
    TYPE_GROUPS.forEach(function (g) { known = known.concat(g.types); });
    return TYPE_GROUPS.filter(function (g) { return list.some(function (r) { return g.types.indexOf(r.t) >= 0 || (g.key === "other" && known.indexOf(r.t) < 0); }); }).length;
  }
  /* the By type / By topic tabs above a list of changes; mode is "type" or "topic", base is the page's address, hint (optional) says what each choice gives */
  function groupSwitch(base, mode, hint) {
    function tab(key, label) {
      var small = hint && hint[key] ? "<small>" + esc(hint[key]) + "</small>" : "";
      return mode === key ? '<span class="on" aria-current="page">' + label + small + "</span>"
        : '<a href="' + base + (key === "topic" ? "?group=topic" : "") + '">' + label + small + "</a>";
    }
    return '<nav class="gtabs" aria-label="Group the changes">' + tab("type", "By type") + tab("topic", "By topic") + "</nav>";
  }

  function bullets(list, withTopic) {
    return '<ul class="bul">' + list.slice().sort(newest).map(function (r) {
      return "<li>" + (withTopic ? "<b>" + tlink(r.e) + "</b> – " : "") + typeTag(r) + ": " + text(r) + "</li>";
    }).join("") + "</ul>";
  }

  function topicList(list, cols) {
    return '<ul class="cols">' + list.map(function (t) {
      return "<li>" + tlink(t) + (cols === false ? "" : " <small>(" + D.tstat[t][0] + ")</small>") + (D.legacy[t] ? ' <small class="muted">(legacy)</small>' : "") + "</li>";
    }).join("") + "</ul>";
  }

  function cats(items) {
    items = items.filter(Boolean);
    return '<div class="cats"><b>Categories:</b> ' + items.join(" ") + "</div>";
  }

  function filterBox(ph) { return '<input class="filter" id="f" type="search" placeholder="' + ph + '" aria-label="' + ph + '">'; }

  function relatedTopics(t) {
    var mine = tagIndex[t], hub = D.hubs[t], score = {};
    topics.forEach(function (o) {
      if (o === t || D.legacy[o]) return;
      var s = 0, om = tagIndex[o];
      Object.keys(mine).forEach(function (g) { if (om[g]) s += 2; });
      if (hub && D.hubs[o] === hub) s += 1;
      if (s > 0) score[o] = s;
    });
    return Object.keys(score).sort(function (a, b) { return score[b] - score[a] || a.localeCompare(b); }).slice(0, 12);
  }

  /* ---------- views ---------- */
  var views = {};

  /* "Recent changes by type": a portal with a tab for each kind of change; a tab's table lists the newest patches that made changes of that kind (how many, in how many topics, and which topics, the most-changed first) */
  var RECENT_PATCHES = 5, RECENT_TOPICS = 8;
  var TAB_LABEL = { additions: "Additions", reworks: "Reworks", fixes: "Fixes", performance: "Performance", economy: "Economy", interface: "Interface", balance: "Balance", removals: "Removals", other: "Other" };
  function recentByType() {
    var known = [];
    TYPE_GROUPS.forEach(function (g) { known = known.concat(g.types); });
    var tabs = "", panels = "", first = true;
    TYPE_GROUPS.forEach(function (g) {
      var list = [];
      for (var i = 0; i < versions.length && list.length < RECENT_PATCHES; i++) {
        var v = versions[i], hit = byVersion[v].filter(function (r) { return g.types.indexOf(r.t) >= 0 || (g.key === "other" && known.indexOf(r.t) < 0); });
        if (hit.length) list.push({ v: v, hit: hit });
      }
      if (!list.length) return;
      tabs += '<button type="button" role="tab" id="rt-' + g.key + '" aria-controls="rp-' + g.key + '" aria-selected="' + first + '" tabindex="' + (first ? 0 : -1) + '">' + TAB_LABEL[g.key] + "</button>";
      panels += '<div role="tabpanel" id="rp-' + g.key + '" aria-labelledby="rt-' + g.key + '"' + (first ? "" : " hidden") + '><div class="wrap"><table class="wikitable"><thead><tr><th>Patch</th><th class="dt">Date</th><th>' + esc(g.label.replace(/ \(.*$/, "")) + '</th><th>Topics</th></tr></thead><tbody>';
      list.forEach(function (it) {
        var per = group(it.hit, "e"), names = Object.keys(per).sort(function (x, y) { return per[y].length - per[x].length || x.localeCompare(y); });
        var to = "#/patch/" + enc(it.v) + "#" + slugId("type-" + g.key);
        panels += '<tr><td class="nowrap">' + vlink(it.v) + '</td><td class="nowrap dt">' + esc(dateOf(it.v)) + '</td><td class="nowrap"><a href="' + to + '">' + it.hit.length + "</a></td><td>" +
          names.slice(0, RECENT_TOPICS).map(tlink).join(", ") + (names.length > RECENT_TOPICS ? ' and <a href="' + to + '">' + (names.length - RECENT_TOPICS) + " more</a>" : "") + "</td></tr>";
      });
      panels += "</tbody></table></div></div>";
      first = false;
    });
    if (!tabs) return "";
    return '<div class="portal wide"><h3>Recent changes by type</h3><div><div class="gtabs" role="tablist" aria-label="Kind of change">' + tabs + "</div>" + panels +
      '<p class="muted">Each row is a patch that made changes of that kind. The number opens that patch\'s section for them.</p></div></div>';
  }
  /* switching tabs on the front page (no new address: the tabs only show or hide tables) */
  function wireRecentTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll("#app [role=tab]"));
    function pick(t) {
      t.scrollIntoView({ block: "nearest", inline: "nearest" });   /* a tab that is half off the edge of the scrolling row comes fully into view */
      tabs.forEach(function (x) {
        var on = x === t;
        x.setAttribute("aria-selected", on ? "true" : "false"); x.tabIndex = on ? 0 : -1;
        document.getElementById(x.getAttribute("aria-controls")).hidden = !on;
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { pick(t); });
      t.addEventListener("keydown", function (e) {
        var j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
        if (j < 0) return;
        e.preventDefault(); j = (j + tabs.length) % tabs.length; pick(tabs[j]); tabs[j].focus();
      });
    });
  }
  views.patchnotes = function () {
    var latest = versions[0], lrows = byVersion[latest];
    var recent = uniq(rows.slice().sort(newest).slice(0, 80).map(function (r) { return r.e; })).filter(function (t) { return !D.legacy[t]; }).slice(0, 12);
    var big = liveTopics.slice().sort(function (a, b) { return byTopic[b].length - byTopic[a].length; }).slice(0, 12);
    var h = '<p>The patch notes record what has changed in DFO Online, patch by patch and topic by topic. They cover <b>' +
      rows.length.toLocaleString() + "</b> recorded changes to <b>" + topics.length + '</b> topics across <b>' + allVersions.length + "</b> patches, from version " +
      esc(versions[versions.length - 1]) + " (" + esc(dateOf(versions[versions.length - 1])) + ") to " + esc(latest) + " (" + esc(dateOf(latest)) + ").</p>";
    h += '<p class="browse"><b>Browse:</b> <a href="#/recent">Recent changes</a> · <a href="#/topics">All topics</a> · <a href="#/hubs">Areas</a> · <a href="#/patches">Patch index</a> · <a href="#/random">Random topic</a></p>';
    h += '<div class="portals">' + recentByType();
    h += '<div class="portal"><h3>Latest patch</h3><div><p><b>' + vlink(latest) + "</b> – " + esc(dateOf(latest)) + "<br>" + plural(lrows.length, "change") + " to " +
      plural(uniq(lrows.map(function (r) { return r.e; })).length, "topic") + ".</p><ul>" +
      uniq(lrows.map(function (r) { return r.e; })).slice(0, 8).map(function (t) { return "<li>" + tlink(t) + "</li>"; }).join("") +
      '</ul><p><a href="#/recent">All recent changes →</a></p></div></div>';
    h += '<div class="portal"><h3>Recently changed topics</h3><div><ul>' + recent.map(function (t) { return "<li>" + tlink(t) + "</li>"; }).join("") + "</ul></div></div>";
    h += '<div class="portal"><h3>Most documented topics</h3><div><ul>' + big.map(function (t) { return "<li>" + tlink(t) + " <small class='muted'>(" + byTopic[t].length + ")</small></li>"; }).join("") + "</ul></div></div>";
    h += "</div>";
    return { title: "Patch Notes", html: page("Patch Notes", h, { hat: HOME_HAT + " › Patch Notes" }), after: wireRecentTabs };
  };

  views.recent = function () {
    var shown = 8, mode = routeQuery.group === "topic" ? "topic" : "type";
    var html = page("Recent changes", '<p>The newest patches first. Each entry is one change recorded in the official release notes.</p>' + groupSwitch("#/recent", mode) + '<div id="rc"></div><p><button class="more" id="more">Show older patches</button></p>', { hat: PN_HAT + "Recent changes" });
    return { title: "Recent changes", html: html, after: function () {
      var box = document.getElementById("rc"), btn = document.getElementById("more"), n = 0;
      function more() {
        var end = Math.min(versions.length, n + shown), h = "";
        for (; n < end; n++) {
          var v = versions[n], g = group(byVersion[v], "e");
          h += '<h2 class="sec">' + vlink(v) + ' <small class="muted">– ' + esc(dateOf(v)) + "</small></h2>";
          if (mode === "topic") Object.keys(g).sort().forEach(function (t) { h += "<h3 class='sec'>" + tlink(t) + "</h3>" + bullets(g[t], false); });
          else h += changesByType(byVersion[v], 3, false);
        }
        box.insertAdjacentHTML("beforeend", h);
        if (n >= versions.length) btn.parentNode.hidden = true;
      }
      btn.addEventListener("click", more); more();
    } };
  };

  views.topics = function () {
    var letters = {}, h = "";
    liveTopics.forEach(function (t) { var c = /^[A-Za-z]/.test(t) ? t.charAt(0).toUpperCase() : "#"; (letters[c] = letters[c] || []).push(t); });
    var legacyAll = topics.filter(function (t) { return D.legacy[t]; });
    var all = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");
    h += "<p>" + plural(liveTopics.length, "topic") + ", listed alphabetically. The number in brackets is how many changes are recorded.</p>" + filterBox("Filter topics…");
    h += '<div class="alpha">' + all.map(function (c) { return letters[c] ? '<a href="#/topics" data-scroll="' + slugId("L" + c) + '">' + c + "</a>" : "<span>" + c + "</span>"; }).join(" ") + "</div>";
    all.forEach(function (c) { if (letters[c]) h += '<div class="letter"><h2 class="sec" id="' + slugId("L" + c) + '">' + c + "</h2>" + topicList(letters[c]) + "</div>"; });
    if (legacyAll.length) h += '<details class="legacy"><summary>Legacy topics (' + legacyAll.length + ")</summary><p>Removed content, kept as a record.</p>" + topicList(legacyAll) + "</details>";
    return { title: "All topics", html: page("All topics", h, { hat: PN_HAT + "All topics" }), after: function () { wireFilter(".letter li", ".letter"); } };
  };

  views.hubs = function () {
    var h = "<p>An area is where a topic is filed: each topic is in exactly one.</p>" + '<ul class="cols">' + hubNames.map(function (n) {
      return "<li>" + hlink(n) + " <small>(" + plural(hubs[n].length, "topic") + ")</small></li>"; }).join("") + "</ul>";
    return { title: "Areas", html: page("Areas", h, { hat: PN_HAT + "Areas" }) };
  };

  views.hub = function (n) {
    if (!hubs[n]) return notFound(n);
    var rg = getRange(), base = "#/hub/" + enc(n), all = [], total = 0;
    hubs[n].forEach(function (t) { total += D.tstat[t][0]; all = all.concat(byTopic[t] || []); });
    var legacyHere = hubsLegacy[n] || [];
    if (rg.active) all = all.filter(inRange);
    var hatH = '<a href="#/hubs">Areas</a> › ' + esc(n);
    if (!all.length) return { title: "Area: " + n, html: page("Area: " + esc(n), rangeBox(base, rg) + noneInRange("the " + esc(n) + " area", rg, total), { hat: PN_HAT + hatH }), toc: false, after: function () { wireRange(base); } };
    var h = "<p><b>" + esc(n) + "</b> contains " + plural(hubs[n].length, "topic") + " with " + plural(all.length, "recorded change") + (rg.active ? " " + esc(rangeText(rg)) + " (" + total + " in all)" : "") + ".</p>" + rangeBox(base, rg) +
      sec("Topics", "Topics", 2) + topicList(hubs[n]) + (legacyHere.length ? '<details class="legacy"><summary>Legacy topics in this area (' + legacyHere.length + ")</summary>" + topicList(legacyHere) + "</details>" : "") +
      sec("Latest changes", "Latest changes", 2) + table(all, ["Patch", "Date", "Topic", "Type", "Change"], 25) +
      cats([ '<a href="#/hubs">All areas</a>' ]);
    return { title: "Area: " + n, html: page("Area: " + esc(n), h, { hat: PN_HAT + hatH }), after: function () { wireRange(base); } };
  };

  function legacyBox(t) {
    var lg = D.legacy[t];
    return lg ? '<div class="mbox"><b>Legacy.</b> This was removed' + (lg.v ? " in patch " + vlink(lg.v) + " (" + esc(dateOf(lg.v)) + ")" : "") + "." + (lg.n ? " " + esc(lg.n) : "") +
      " The page is kept as a record, and legacy topics are left out of the topic lists and areas.</div>" : "";
  }
  views.topic = function (t) {
    var ts = D.tstat[t];
    if (!ts) return notFound(t);
    var rg = getRange(), every = byTopic[t] || [], l = rg.active ? every.filter(inRange) : every, base = "#/topic/" + enc(t), hub = D.hubs[t];
    var hat = PN_HAT + (hub ? '<a href="#/hubs">Areas</a> › ' + hlink(hub) : '<a href="#/topics">All topics</a>') + " › " + esc(t);
    var aiNote = D.desc && D.desc[t] ? '<p class="srcnote"><small class="muted">AI-assisted summary; it may be wrong or out of date. The History table below is the record to trust. <a href="#/about">About UDOP</a></small></p>' : "";
    if (!l.length) {
      var h0 = legacyBox(t) + (D.desc && D.desc[t] ? "<p>" + esc(D.desc[t]).replace(esc(t), "<b>" + esc(t) + "</b>") + "</p>" : "") + aiNote + rangeBox(base, rg) +
        noneInRange(esc(t), rg, ts[0], ", the latest in patch " + vlink(ts[1]) + " (" + esc(dateOf(ts[1])) + ")");
      return { title: t, html: page(esc(t), h0, { hat: hat }), toc: false, after: function () { wireRange(base); } };
    }
    var g = group(l, "t"), vs = vers(l);
    var order = TYPES.filter(function (x) { return g[x]; }).concat(Object.keys(g).filter(function (x) { return TYPES.indexOf(x) < 0; }));
    var top = order.slice().sort(function (a, b) { return g[b].length - g[a].length; })[0];

    var ib = '<table class="infobox"><caption class="ibt">' + esc(t) + "</caption><tbody>" +
      "<tr><th>Area</th><td>" + (hub ? hlink(hub) : "Uncategorised") + "</td></tr>" +
      (D.legacy[t] ? "<tr><th>Status</th><td>Legacy</td></tr>" : "") +
      (D.aka[t] ? "<tr><th>Formerly recorded as</th><td>" + D.aka[t].map(esc).join(", ") + "</td></tr>" : "") +
      "<tr><th>First recorded</th><td>" + vlink(ts[2]) + "<br><small class='muted'>" + esc(dateOf(ts[2])) + "</small></td></tr>" +
      "<tr><th>Latest change</th><td>" + vlink(ts[1]) + "<br><small class='muted'>" + esc(dateOf(ts[1])) + "</small></td></tr>" +
      "<tr><th>Changes</th><td>" + (rg.active ? l.length + " in " + plural(vs.length, "patch") + " in this range<br><small class='muted'>" + ts[0] + " in all</small>" : l.length + " in " + plural(vs.length, "patch")) + "</td></tr>" +
      '<tr><td colspan="2" class="sub">Change types' + (rg.active ? " in this range" : "") + '</td></tr><tr><td colspan="2"><div class="bar" role="img" aria-label="Change types: ' + order.map(function (x) { return esc(x) + " " + g[x].length; }).join(", ") + '">' +
      order.map(function (x) { return '<i title="' + esc(x) + ": " + g[x].length + '" style="width:' + (100 * g[x].length / l.length) + "%;background:" + (TYPE_COLOR[x] || "var(--other)") + '"></i>'; }).join("") +
      "</div></td></tr>" +
      order.map(function (x) { return "<tr><th>" + esc(x) + "</th><td>" + g[x].length + "</td></tr>"; }).join("") +
      "</tbody></table>";

    var lead = D.desc && D.desc[t] ? "<p>" + esc(D.desc[t]).replace(esc(t), "<b>" + esc(t) + "</b>") + "</p>" :
      "<p><b>" + esc(t) + "</b> is a topic" + (hub ? " in the " + hlink(hub) + " area" : "") + ". It has " + plural(ts[0], "recorded change") +
      ", from patch " + vlink(ts[2]) +
      (ts[2] !== ts[1] ? " to " + vlink(ts[1]) : "") + ". " +
      (!rg.active && order.length > 1 ? "Most of them are " + esc(TYPE_LABEL[top] ? TYPE_LABEL[top].toLowerCase() : top.toLowerCase()) + " (" + g[top].length + ")." : "") + "</p>";

    var h = ib + legacyBox(t) + lead + aiNote + rangeBox(base, rg);
    h += sec("Latest changes", "Latest changes", 2) + bullets(l.slice().sort(newest).slice(0, Math.min(5, l.length)), false);
    h += sec("History", "History", 2) + table(l, ["Patch", "Source", "Date", "Type", "Change"], PAGE_ROWS);   /* Change stays last: the stylesheet gives the last column its width */
    if (order.length > 1) {
      h += sec("By type", "Changes by type", 2);
      order.forEach(function (x) { h += sec("type-" + x, TYPE_LABEL[x] || x, 3) + bullets(g[x], false).replace(/<span class="tp"[^>]*>[^<]*<\/span>: /g, ""); });
    }
    /* "See also" and the tag links are worked out from every change, so they appear only when all the shards are loaded */
    if (every.length === ts[0]) {
      var rel = relatedTopics(t);
      if (rel.length) h += sec("See also", "See also", 2) + '<ul class="cols">' + rel.map(function (o) { return "<li>" + tlink(o) + "</li>"; }).join("") + "</ul>";
      h += cats((hub ? [hlink(hub)] : []).concat(
        Object.keys(tagIndex[t]).sort(function (a, b) { return tagIndex[t][b] - tagIndex[t][a]; }).slice(0, 4).map(function (g2) {
          return '<a href="#/search/' + enc(g2) + '">' + esc(g2) + "</a>"; })));
    }
    return { title: t, html: page(esc(t), h, { hat: hat }), toc: true, after: function () { wireRange(base); } };
  };

  /* a release's tags: its Update name, then a hint when its title says "fix" and a mark on the one bulk import */
  function relTags(v) {
    var rel = D.releases[v] || {}, h = "";
    if (rel.u) h += '<span class="upd" title="The developers&rsquo; name for this patch">Update ' + esc(rel.u) + "</span>";
    if (rel.k === "likely-hotfix") h += '<span class="tag" title="The title mentions a fix. This is a guess from the title, not a record.">Likely hotfix</span>';
    if (rel.k === "bulk-import") h += '<span class="tag" title="A catch-up patch that lists hundreds of earlier changes at once">Bulk import</span>';
    return h;
  }
  views.patches = function () {
    var byDay = {}, days = [];
    allVersions.forEach(function (v) { var d = dateOf(v); if (!byDay[d]) { byDay[d] = []; days.push(d); } byDay[d].push(v); });
    days.sort().reverse();
    var h = "<p>" + plural(allVersions.length, "patch") + " on " + plural(days.length, "day") + ", newest first. Each patch is listed with its title and Update name when the developers gave one; a patch with no recorded changes says so.</p>" +
      filterBox("Filter by version, title or date…");
    days.forEach(function (d, k) {
      var vs = byDay[d], n = 0;
      vs.forEach(function (v) { n += D.releases[v].c; });
      h += '<details class="day"' + (k === 0 ? " open" : "") + '><summary><b>' + esc(d) + "</b><span>" + plural(vs.length, "patch") + " · " + plural(n, "change") + "</span></summary><ul class=\"rels\">" +
        vs.map(function (v) {
          var rel = D.releases[v], c = rel.c;
          return '<li class="rel"><span class="rb">' + vlink(v) + '</span><span class="rt">' + (rel.t ? esc(rel.t) : '<span class="muted">No title</span>') + relTags(v) + '</span><span class="rn">' +
            (c ? plural(c, "change") : "no recorded changes") + "</span></li>";
        }).join("") + "</ul></details>";
    });
    return { title: "Patch index", html: page("Patch index", h, { hat: PN_HAT + "Patch index" }), toc: false, after: function () {
      var box = document.getElementById("f"); if (!box) return;
      box.addEventListener("input", function () {
        var q = box.value.trim().toLowerCase();
        Array.prototype.forEach.call(app.querySelectorAll("details.day"), function (dt, i) {
          var any = false;
          Array.prototype.forEach.call(dt.querySelectorAll("li.rel"), function (li) {
            var hit = !q || (dt.querySelector("summary b").textContent + " " + li.textContent).toLowerCase().indexOf(q) >= 0;
            li.hidden = !hit; if (hit) any = true;
          });
          dt.hidden = !any;
          if (q) dt.open = any; else dt.open = i === 0;
        });
      });
    } };
  };

  views.patch = function (v) {
    var l = byVersion[v] || [];
    if (!byVersion[v] && !D.releases[v]) return notFound("Patch " + v);
    var i = allVersions.indexOf(v), rel = D.releases[v], g = group(l, "e"), names = Object.keys(g).sort();
    var h = '<div class="pager">' + (i < allVersions.length - 1 ? '<a href="#/patch/' + enc(allVersions[i + 1]) + '">← Older: ' + esc(allVersions[i + 1]) + "</a>" : "") +
      (i > 0 ? '<a href="#/patch/' + enc(allVersions[i - 1]) + '">Newer: ' + esc(allVersions[i - 1]) + " →</a>" : "") + "</div>";
    h += "<p><b>Patch " + esc(v) + "</b>" + (rel && rel.t ? " (" + esc(rel.t) + ")" : "") + " was released on " + esc(dateOf(v)) + ". " + (l.length ? "It records " + plural(l.length, "change") + " to " + plural(names.length, "topic") + "." : "It has no recorded changes in this wiki.") + relTags(v) + "</p>";
    h += '<p class="srcnote">Each change shows the developers&rsquo; own wording. <a href="' + RELEASES_URL + "/tag/app-v" + enc(v) + '" rel="noopener">Read the original release notes for patch ' + esc(v) + " on GitHub ↗</a></p>";   /* every release's tag is app-v plus its version */
    var mode = routeQuery.group === "topic" ? "topic" : "type";
    if (l.length) h += groupSwitch("#/patch/" + enc(v), mode, { type: plural(typeGroupCount(l), "group"), topic: plural(names.length, "topic") });
    if (!l.length) h += "<p>No change is recorded for this patch here. The developers&rsquo; original notes, linked above, may say more.</p>";
    else if (mode === "topic") {
      var topicSections = function (ns) { return ns.map(function (t) { return sec("p-" + t, t, 2).replace(">" + esc(t) + "</h2>", ">" + tlink(t) + "</h2>") + bullets(g[t], false); }).join(""); };
      h += l.length > PAGE_ROWS && names.length > TOPICS_ON_PAGE ? shownThenMore(names, TOPICS_ON_PAGE, topicSections, "topics", "pt-topics-" + (++moreSeq)) : topicSections(names);
    }
    else h += changesByType(l, 2, true);
    if (rel && rel.prs.length) h += sec("Pull requests", "Source pull requests", 2) + shownThenMore(rel.prs, LIST_SHOWN, function (ps) {
      return '<ul class="bul">' + ps.map(function (p) { return '<li><a href="' + esc(p.u) + '" rel="noopener">#' + p.n + "</a> " + esc(p.t) + "</li>"; }).join("") + "</ul>"; }, "pull requests", "pt-prs-" + (++moreSeq));
    return { title: "Patch " + v, html: page("Patch " + esc(v), h, { hat: PN_HAT + '<a href="#/patches">Patch index</a> › ' + esc(v) }) };
  };

  views.search = function (q) {
    q = decodeURIComponent(q || "");
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    var tm = topics.filter(function (t) { var names = (t + " " + (D.aka[t] || []).join(" ")).toLowerCase(); return words.every(function (w) { return names.indexOf(w) >= 0; }); });
    var renamed = topicByLower[q.trim().toLowerCase()];
    var rg = getRange(), base = "#/search/" + enc(q);
    var hit = rows.filter(function (r) {
      var s = (r.e + " " + r.x + " " + (r.b ? r.b.join(" ").replace(/,/g, " ") + " " : "") + (r.n || "") + " " + (r.g || []).join(" ")).toLowerCase();
      if (!words.every(function (w) { return s.indexOf(w) >= 0; })) return false;
      return !rg.active || inRange(r);
    });
    var gp = (guide || []).map(function (p) {
      var all = (p.title + " " + p.summary + " " + p.category + " " + p.text).toLowerCase();
      if (!words.every(function (w) { return all.indexOf(w) >= 0; })) return null;
      var ti = p.title.toLowerCase(), head = (p.title + " " + p.summary + " " + p.category).toLowerCase();
      /* 0: every word is in the title; 1: in the title, summary or category; 2: only in the page text */
      return { p: p, rank: words.every(function (w) { return ti.indexOf(w) >= 0; }) ? 0 : words.every(function (w) { return head.indexOf(w) >= 0; }) ? 1 : 2 };
    }).filter(Boolean).sort(function (a, b) { return a.rank - b.rank || a.p.title.localeCompare(b.p.title); }).map(function (x) { return x.p; });
    var sp = siteGuide.filter(function (p) {
      var all = (p.title + " " + p.summary + " " + p.category + " " + p.text).toLowerCase();
      return words.every(function (w) { return all.indexOf(w) >= 0; });
    });
    var h = "";
    if (!words.length) h = "<p>Type something in the search box.</p>";
    else {
      h = '<p>Results for <b>' + esc(q) + "</b>: " + plural(gp.length, "guide page") + ", " + plural(sp.length, "Site Guide page") + ", " + plural(tm.length, "matching topic") + " and " + plural(hit.length, "matching change") + (rg.active ? " " + esc(rangeText(rg)) : "") + ".</p>";
      if (gp.length) {
        h += sec("Game Guide", "Game Guide", 2) + shownThenMore(gp, SEARCH_SHOWN, guideList, "guide pages", "gp-rest");
      }
      if (sp.length) h += sec("Site Guide", "Site Guide", 2) + guideList(sp);
      if (renamed && renamed.toLowerCase() !== q.trim().toLowerCase()) h = '<div class="mbox">&ldquo;' + esc(q.trim()) + "&rdquo; is now recorded under " + tlink(renamed) + ".</div>" + h;
      else if (tm.length === 1 && tm[0].toLowerCase() === q.toLowerCase()) h = '<div class="mbox">There is a topic named “' + tlink(tm[0]) + "”.</div>" + h;
      if (tm.length) h += sec("Topics", "Topics", 2) + shownThenMore(tm, TOPICS_SHOWN, topicList, "topics", "tm-rest");
      if (hit.length || rg.active) h += sec("Changes", "Changes", 2) + rangeBox(base, rg) + (hit.length ? table(hit, ["Patch", "Topic", "Type", "Change"], 100) :
        '<div class="mbox">No matching changes ' + esc(rangeText(rg)) + '. <a href="' + base + '">Show all dates</a>.</div>');
      if (!tm.length && !hit.length && !gp.length && !sp.length && !rg.active) h += "<p>No results. Try fewer or different words.</p>";
    }
    return { title: "Search: " + q, html: page("Search", h), after: function () { revealMore(); wireRange(base); } };
  };

  /* About & Credits: what the site is and isn't, where its information comes from, the people (names from CONTRIBUTORS.md through web/credits.json), the licences and privacy.
     #/credits was a page of its own and now sends readers here. */
  views.credits = function () { location.replace("#/about"); return null; };
  function peopleBox() {
    if (credits === null) return "<p>Loading…</p>";
    var h = "", groups = (credits.groups || []).filter(function (g) { return g.people && g.people.length; });
    if (groups.length) {
      h += '<div class="portals">' + groups.map(function (g) {
        return '<div class="portal wide"><h3>' + esc(g.title) + '</h3><div class="ppl">' + g.people.map(function (p) {
          var ch = (p.name.match(/[A-Za-z0-9]/) || ["?"])[0].toUpperCase();
          return '<div class="who"><span class="av" aria-hidden="true">' + esc(ch) + '</span><div><a href="' + esc(/^https?:\/\//.test(p.url) ? p.url : "#") + '" rel="noopener">' + esc(p.name) + "</a>" +
            (p.role ? '<small class="muted">' + esc(p.role) + "</small>" : "") + "</div></div>";
        }).join("") + "</div></div>";
      }).join("") + "</div>";
    }
    return h + '<p class="muted">Guide pages are credited together to &ldquo;UDOP contributors&rdquo; under CC BY 4.0. A name is listed only with the person&rsquo;s agreement, as a username.</p>';
  }
  views.about = function () {
    var h = "<p><b>UDOP</b>, the <b>Unofficial DFO Online Pages</b>, is a fan-made reference for <b>DFO Online</b>: a community-written Game Guide, and a record of what has changed in every patch. It is not made, approved or endorsed by the game&rsquo;s developers, by Bethesda Softworks or by ZeniMax. <i>The Elder Scrolls</i>, <i>Daggerfall</i> and related names are trademarks of their respective owners.</p>";
    h += sec("Where the information comes from", "Where the information comes from", 2) +
      sec("Game Guide", "Game Guide", 3) +
      '<p>The <a href="#/guide">Game Guide</a> is written by the community, and anyone can add or correct a page. Guide pages are the work of their contributors and have not been checked by the game&rsquo;s developers. They may be wrong or out of date, and carry no warranty.</p>' +
      sec("Site framework", "Site framework", 3) +
      '<p>The site&rsquo;s framework was built with an AI assistant (Claude, through Claude Code): the page code and the build scripts were written with its help, and directed and reviewed by the maintainer. Bugs in any of it can be reported on <a href="#/feedback">Feedback &amp; Bugs</a>.</p>' +
      sec("Patch Notes", "Patch Notes", 3) +
      '<p>Every change in the Patch Notes comes from the <a href="' + RELEASES_URL + '" rel="noopener">public release notes</a> of the developers&rsquo; GitHub repository, which remain the authoritative record. A script compiles them for each release. Each change shows the developers&rsquo; own wording, one bullet per change, filed under a topic and a type, and linked back to the pull requests it came from.</p>' +
      "<p>The opening paragraph of each topic was written with the help of an AI assistant (Claude) from that topic&rsquo;s change history. These paragraphs can be wrong or out of date, so the <b>History</b> table on each page is the thing to trust. Corrections are welcome.</p>" +
      sec("Site Guide and editor", "Site Guide and editor", 3) +
      '<p>The <a href="#/site">Site Guide</a> and the in-browser <a href="#/editor">guide editor</a> were also written with the help of the same AI assistant, and directed and reviewed by the maintainer.</p>';
    h += sec("People", "People", 2) + "<p>UDOP is made by the people below, and it exists because of the game&rsquo;s developers and the open tools and typefaces it uses. Thank you to everyone who has written, fixed or reviewed something.</p>" + peopleBox() +
      '<p>Wrote or fixed a guide page? Ask in your pull request or in an issue to be listed, and say in a few words what you worked on. See <a href="' + HOWTO + '">how to write a guide page</a>.</p>';
    h += sec("Licences", "Licences", 2) + '<ul class="bul">' +
      '<li><b>Code</b> (the site, the tools, the workflow): <a href="' + REPO + '/blob/main/LICENSE" rel="noopener">MIT</a>.</li>' +
      '<li><b>Original text</b> (Game Guide pages, topic descriptions, this page, the README): <a href="' + REPO + '/blob/main/LICENSE-CONTENT.md" rel="noopener">CC BY 4.0</a>. Credit &ldquo;UDOP (Unofficial DFO Online Pages), by tau&rdquo;, or &ldquo;UDOP contributors&rdquo; for guide pages.</li>' +
      '<li><b>Pictures</b> that contributors upload are released under the same CC BY 4.0, but only the contributor&rsquo;s own part: their photographs, diagrams and drawings and, in a screenshot of the game, the selection, framing, cropping, annotation and captions. The game&rsquo;s artwork in a screenshot stays with its owners (Bethesda/ZeniMax for <i>Daggerfall</i>, the developers for DFO Online), and this licence does not cover it. Contributors may upload only pictures they made themselves.</li>' +
      '<li><b>The change data</b> is derived from the developers&rsquo; release notes, which are published under the developers&rsquo; own MIT licence (<a href="' + REPO + '/blob/main/THIRD-PARTY-NOTICES.md" rel="noopener">their notice</a>). It is not covered by CC BY 4.0: if you reuse it, keep that notice and credit the developers.</li>' +
      "<li><b>Typefaces</b>: Kingthings Petrock by Kevin King sets the headings of the Oblivion theme; Share Tech Mono by Carrois Type Design sets the text of the Phosphor theme (SIL Open Font License). Their notices are in <a href=\"" + REPO + "/blob/main/THIRD-PARTY-NOTICES.md\" rel=\"noopener\">THIRD-PARTY-NOTICES.md</a>.</li>" +
      "<li>The game and its names belong to their owners.</li></ul>";
    h += sec("Privacy", "Privacy", 2) + "<p>UDOP has no analytics, no cookies and no accounts, and nothing you do on it is sent anywhere. Your display choices (theme, text size and so on) are saved in your own browser only. The site is hosted on GitHub Pages, which keeps its own server logs. A report made on GitHub is public.</p>";
    h += sec("More", "More", 2) + '<ul class="bul">' +
      '<li><a href="#/feedback">Feedback &amp; Bugs</a>: problems with this site. Bugs in the game itself go in the bug-reports channel of the <a href="' + GAME_BUGS + '" rel="noopener">DFO Online Discord</a>.</li>' +
      '<li><a href="#/site/using-the-site">Using the site</a> and the <a href="#/site">Site Guide</a>: how to find things, change the look, and write or review a page.</li></ul>';
    return { title: "About & Credits", html: page("About &amp; Credits", h, { hat: HOME_HAT + " › About &amp; Credits" }) };
  };

  /* Community Tools: outside projects (calculators, planners) made by players. The list is web/tools.json, edited by hand (it is committed, not generated) */
  var toolList = null;
  /* a tool's description is a list of paragraphs, or one string where a blank line starts a new paragraph */
  function paras(d) { return Array.isArray(d) ? d : String(d || "").split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean); }
  views.tools = function () {
    var h = "<p>These tools are made by members of the DFO Online community for anyone to use. Each one is its creator&rsquo;s own project, hosted and maintained by them.</p>";
    if (toolList === null) h += "<p>Loading…</p>";
    else if (!toolList.length) h += "<p>No tools are listed yet.</p>";
    else h += toolList.map(function (t) {
      var by = /^https?:\/\//.test(t.creatorUrl || "") ? '<a href="' + esc(t.creatorUrl) + '" rel="noopener">' + esc(t.creator) + "</a>" : esc(t.creator);
      return '<div class="portal tool"><h3><a href="' + esc(t.url) + '" rel="noopener">' + esc(t.name) + "</a><small class=\"muted\">by " + by + "</small>" + (t.tags || []).map(function (g) { return '<span class="tag">' + esc(g) + "</span>"; }).join("") + "</h3><div>" +
        '<p class="lede">' + esc(t.summary) + "</p>" +
        paras(t.description).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") +
                ((t.features || []).length ? '<details class="legacy"><summary>Features (' + t.features.length + ')</summary><ul class="bul">' + t.features.map(function (f) { return "<li>" + (f.name ? "<b>" + esc(f.name) + ":</b> " + esc(f.text) : esc(f)) + "</li>"; }).join("") + "</ul></details>" : "") +
        "</div></div>";
    }).join("");
    h += sec("Add your tool", "Add your tool", 2) + '<p>Made a tool for the game? <a href="' + REPO + '/issues/new" rel="noopener">Open an issue</a> with its address, your name, a one-line summary and a list of features, or add an entry to <code>web/tools.json</code> in a pull request. Tools featured here are only listed with their creator&rsquo;s agreement.</p>';
    return { title: "Community Tools", html: page("Community Tools", h, { hat: HOME_HAT + " › Community Tools" }) };
  };

  /* ---------- Game Guide: Markdown pages in web/guide/, listed by guide/index.json ---------- */
  var REPO = "https://github.com/tau-samsara/udfop";
  /* the contributor instructions: the one place their address is written (the menu in index.html has it too). A moved page can keep its old address working by adding it to MOVED */
  var HOWTO = "#/site/how-to-write-a-page";
  /* Game Guide addresses that moved (lower case) -> where the page lives now. The Site Guide used to be inside the Game Guide */
  var MOVED = {
    "how-to-write-a-page": "#/site/how-to-write-a-page", "how-to/how-to-write-a-page": "#/site/how-to-write-a-page",
    "how-to/formatting-reference": "#/site/formatting-reference", "how-to/troubleshooting": "#/site/fixing-a-page",
    "how-to/reviewing-a-pull-request": "#/site/reviewing-a-pull-request", "how-to/site-guide": "#/site"
  };
  var guide = null, guideFailed = false, guideBySlug = {}, guideByTitle = {};
  var credits = null;   /* web/credits.json, built from CONTRIBUTORS.md: the names on the Credits page */
  var siteGuide = [], siteBySlug = {}, siteByTitle = {};   /* the Site Guide: pages in web/site/, listed by site/index.json */
  var topicByLower = {};
  topics.forEach(function (t) { topicByLower[t.toLowerCase()] = t; });
  Object.keys(D.alias).forEach(function (o) { if (!topicByLower[o.toLowerCase()]) topicByLower[o.toLowerCase()] = D.alias[o]; });

  function guideLoaded(list) {
    guide = list || []; guideBySlug = {}; guideByTitle = {};
    guide.forEach(function (p) { p.area = "guide"; guideBySlug[p.slug.toLowerCase()] = p; guideByTitle[p.title.toLowerCase()] = p; });
  }
  function siteLoaded(list) {
    siteGuide = list || []; siteBySlug = {}; siteByTitle = {};
    siteGuide.forEach(function (p) { p.area = "site"; siteBySlug[p.slug.toLowerCase()] = p; siteByTitle[p.title.toLowerCase()] = p; });
  }
  /* a page of either guide, by title or by address; [[Title]] links find a page in both */
  function findPage(low) { return guideByTitle[low] || guideBySlug[low] || siteByTitle[low] || siteBySlug[low]; }
  /* the address of a page: the Site Guide's front page is #/site itself */
  function purl(p) { return p.area === "site" ? (p.slug === "index" ? "#/site" : "#/site/" + p.slug.split("/").map(enc).join("/")) : "#/guide/" + p.slug.split("/").map(enc).join("/"); }
  /* pages with "unlisted: yes" in their front matter are left out of the Game Guide page, the category pages and the counts. They can still be opened by address, by a link and by search */
  function listedGuide() { return (guide || []).filter(function (p) { return !p.unlisted; }); }
  function guideCategories() {
    var m = {};
    listedGuide().forEach(function (p) { (m[p.category] = m[p.category] || []).push(p); });
    return m;
  }
  function glink(p) { return '<a href="' + purl(p) + '">' + esc(p.title) + "</a>"; }
  /* a category page: titles only, bulleted in columns, grouped by first letter once there are enough of them */
  function categoryList(list) {
    var sorted = list.slice().sort(function (a, b) { return a.title.localeCompare(b.title, undefined, { sensitivity: "base" }); });
    function li(p) { return "<li>" + glink(p).replace("<a ", p.summary ? '<a title="' + esc(p.summary) + '" ' : "<a ") + "</li>"; }
    var h = "<p>The following " + plural(sorted.length, "page") + (sorted.length === 1 ? " is" : " are") + " in this category.</p>";
    if (sorted.length < 8) return h + '<ul class="cols">' + sorted.map(li).join("") + "</ul>";
    var letters = {}, order = [];
    sorted.forEach(function (p) {
      var ch = p.title.charAt(0).toUpperCase(); if (!/[A-Z]/.test(ch)) ch = /[0-9]/.test(ch) ? "0–9" : "#";
      if (!letters[ch]) { letters[ch] = []; order.push(ch); }
      letters[ch].push(p);
    });
    return h + '<div class="catlist">' + order.map(function (ch) {
      return "<section><h3>" + esc(ch) + "</h3><ul>" + letters[ch].map(li).join("") + "</ul></section>";
    }).join("") + "</div>";
  }
  var INDEX_SHOWN = 12, SEARCH_SHOWN = 40, TOPICS_SHOWN = 80;   /* guide pages listed per category on the index; first screen of guide results and of topic results in a search */
  /* titles only, in columns; hovering a link shows the page's summary (the same list the category pages use) */
  function guideList(list) {
    return '<ul class="cols">' + list.map(function (p) {
      return "<li>" + glink(p).replace("<a ", p.summary ? '<a title="' + esc(p.summary) + '" ' : "<a ") + "</li>";
    }).join("") + "</ul>";
  }
  /* the first part of a long list, with a button that reveals the rest (wired up by revealMore) */
  function shownThenMore(list, shown, render, noun, id) {
    if (list.length <= shown) return render(list);
    return render(list.slice(0, shown)) + '<div id="' + id + '" hidden>' + render(list.slice(shown)) + '</div><p><button type="button" class="more" data-more="' + id + '">Show the other ' + (list.length - shown) + " " + noun + "</button></p>";
  }
  function revealMore() {
    Array.prototype.forEach.call(document.querySelectorAll("button[data-more]"), function (b) {
      if (b.getAttribute("data-wired")) return;
      b.setAttribute("data-wired", "1");
      b.addEventListener("click", function () { document.getElementById(b.getAttribute("data-more")).hidden = false; b.parentNode.remove(); });
    });
  }
  /* The editor's starter text is a template in web/guide/: _template.md for a page about how something works, and one for each other kind of page; this is only a fallback if they cannot be fetched. */
  var FALLBACK_TPL = "---\ntitle: Page title\ncategory: \nsummary: \nauthors: \n---\n\nWrite your page here.\n";
  var TEMPLATES = [["", "How it works", "_template.md"], ["item", "Item", "_template-item.md"], ["place", "Place", "_template-place.md"], ["creature", "Creature or boss", "_template-creature.md"]];
  var guideTemplates = {};   /* kind -> text; "" is the default */
  function newPageUrl(title, kind) {
    var tpl = guideTemplates[kind || ""] || guideTemplates[""] || FALLBACK_TPL;
    if (title) tpl = tpl.replace(/^title:.*$/m, function () { return "title: " + title; });
    var name = title ? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : "";
    return REPO + "/new/main/web/guide?" + (name ? "filename=" + enc(name + ".md") + "&" : "") + "value=" + enc(tpl);
  }
  function newAttr(title, kind) { return ' data-new="' + esc(title) + '"' + (kind ? ' data-tpl="' + kind + '"' : ""); }
  /* "or start it from another kind of template": one link for each kind of page */
  function templateChoices(title) {
    return '<p>Not a page about how something works? Start it from another kind of template: ' + TEMPLATES.filter(function (t) { return t[0]; }).map(function (t) {
      return '<a href="' + newPageUrl(title, t[0]) + '"' + newAttr(title, t[0]) + ' rel="noopener">' + esc(t[1]) + "</a>"; }).join(" · ") + ".</p>";
  }
  function refreshNewLinks() {
    Array.prototype.forEach.call(document.querySelectorAll("a[data-new]"), function (a) { a.href = newPageUrl(a.getAttribute("data-new"), a.getAttribute("data-tpl") || ""); });
  }
  TEMPLATES.forEach(function (t) {
    fetch("guide/" + t[2]).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (txt) { guideTemplates[t[0]] = txt.replace(/^\ufeff/, "").replace(/\r\n/g, "\n"); refreshNewLinks(); })
      .catch(function () {});
  });
  function contribBox() {
    return '<div class="mbox"><b>Anyone can add or fix a page.</b> You need a free GitHub account and your own copy (a <b>fork</b>) of the project, which you make on the project\'s GitHub page first. ' +
      '<a href="' + HOWTO + '">Step-by-step: how to write a guide page</a>.</div>';
  }

  /* Markdown: headings, paragraphs, **bold**, *italic*, `code`, links, images, lists, tables, quotes, code blocks, [[wiki links]].
     All text is escaped first, so a page cannot inject HTML or scripts. */
  function safeUrl(u) {
    u = u.trim();
    if (/[\u0000-\u001f\u007f-\u009f]/.test(u)) return "";
    if (/^(https?:|mailto:|#)/i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.indexOf("//") === 0) return "";
    return u;
  }
  /* small superscripts say where a link goes; links to other guide pages are the default and carry none */
  var MARK_GP = '<sup class="lt" title="Game Guide page" aria-label="(Game Guide)">GP</sup>';
  var MARK_SG = '<sup class="lt" title="Site Guide page" aria-label="(Site Guide)">SG</sup>';
  var MARK_PN = '<sup class="lt" title="Patch Notes page" aria-label="(Patch Notes)">PN</sup>';
  var MARK_EXT = '<sup class="lt" title="Opens another website" aria-label="(external site)">\u2197</sup>';
  /* every link a page makes is noted here, and listed in a References section at the bottom */
  var refs = null;
  function pageKey(p) { return (p.area + "|" + p.slug).toLowerCase(); }   /* a page's identity across both guides */
  function newRefs(selfKey) { return { self: (selfKey || "").toLowerCase(), seen: {}, guide: [], topic: [], patch: [], ext: [] }; }
  function noteRef(kind, key, item) {
    if (!refs) return;
    var id = kind + "|" + String(key).toLowerCase();
    if (refs.seen[id]) return; refs.seen[id] = 1;
    refs[kind].push(item);
  }
  function refs_self() { return refs ? refs.self : ""; }
  /* A link can name a section: [[Page#Section]], [[site:Page#Section]], or [[#Section]] for this page. The part after the # is the words of a heading (the same
     words and the same id the page's own heading has, down to ###), so capitals and punctuation do not matter. */
  function splitSection(s) { var i = s.indexOf("#"); return i < 0 ? [s.trim(), ""] : [s.slice(0, i).trim(), s.slice(i + 1).trim()]; }
  function withSection(url, section) { return section ? url + "#" + encodeURIComponent(slugId(section)) : url; }
  function sectionLabel(title, section) { return section ? title + " \u203A " + section : title; }
  function wikiLink(target, label) {
    var raw = target.trim(), low = raw.toLowerCase(), t, parts, k;
    if (low.indexOf("topic:") === 0) { t = topicByLower[low.slice(6).trim()]; if (t) noteRef("topic", t, t); return t ? tlink(t).replace(">" + esc(t) + "<", ">" + esc(label || t) + "<") + MARK_PN : esc(label || raw.slice(6)); }
    if (low.indexOf("patch:") === 0) { var v = raw.slice(6).trim(); if (D.releases[v]) noteRef("patch", v, v); return D.releases[v] ? '<a href="#/patch/' + enc(v) + '">' + esc(label || v) + "</a>" + MARK_PN : esc(label || v); }
    if (low.indexOf("site:") === 0) {
      parts = splitSection(raw.slice(5)); k = parts[0].toLowerCase();
      var sp = siteByTitle[k] || siteBySlug[k];
      if (sp && pageKey(sp) !== refs_self()) noteRef("guide", pageKey(sp), sp);
      return sp ? '<a href="' + withSection(purl(sp), parts[1]) + '">' + esc(label || sectionLabel(sp.title, parts[1])) + "</a>" + MARK_SG : esc(label || sectionLabel(parts[0], parts[1]));
    }
    /* a plain [[Title]] means a Game Guide page and nothing else: the Site Guide, the Patch Notes topics and the patches are linked on purpose, as
       [[site:Title]], [[topic:Name]] and [[patch:0.1.2]]. [[guide:Title]] spells a Game Guide page out and is the same as the plain name */
    if (low.indexOf("guide:") === 0) raw = raw.slice(6).trim();
    parts = splitSection(raw); k = parts[0].toLowerCase();
    if (!parts[0]) return parts[1] ? '<a href="' + withSection(pagePath(), parts[1]) + '">' + esc(label || parts[1]) + "</a>" : esc(label || raw);   /* [[#Section]]: this page */
    var g = guideByTitle[k] || guideBySlug[k];
    if (g && pageKey(g) !== refs_self()) noteRef("guide", pageKey(g), g);
    if (g) return '<a href="' + withSection(purl(g), parts[1]) + '">' + esc(label || sectionLabel(g.title, parts[1])) + "</a>" + MARK_GP;
    return '<a class="missing" href="' + newPageUrl(parts[0]) + '"' + newAttr(parts[0]) + ' rel="noopener" title="No page called this yet. Click to create it.">' + esc(label || sectionLabel(parts[0], parts[1])) + "</a>";
  }
  /* Pictures: ![alt](path "Caption"){right 240}. A picture alone on its line with a caption or braces becomes a figure that
     floats (default: a right-hand thumbnail); inline pictures and bare ones behave as before. */
  var IMG_URL = "([^()\\s]*(?:\\([^()\\s]*\\)[^()\\s]*)*)";
  var IMG_RE = new RegExp('!\\[([^\\]]*)\\]\\(' + IMG_URL + '(?:\\s+"([^"]*)")?\\)(?:\\{([^}]*)\\})?', "g");
  var FIG_LINE = new RegExp('^!\\[([^\\]]*)\\]\\(' + IMG_URL + '(?:\\s+"([^"]*)")?\\)(?:\\{([^}]*)\\})?$');
  function imgSrc(src) {
    src = safeUrl(src); if (!src) return "";
    if (!/^(https?:|\/)/i.test(src)) src = mdRoot + mdBase + src.replace(/^\.?\//, "");
    return src;
  }
  function figureOpts(braces) {
    var o = { side: null, width: null };
    String(braces || "").split(/[\s,]+/).forEach(function (t) {
      t = t.toLowerCase();
      if (t === "left" || t === "right" || t === "center") o.side = t;
      else if (/^\d+(px)?$/.test(t)) o.width = Math.max(40, Math.min(1200, parseInt(t, 10)));
    });
    return o;
  }
  function figure(m) {
    var src = imgSrc(m[2]); if (!src) return "";
    var o = figureOpts(m[4]), side = o.side || "right", cap = m[3] || "";
    var width = o.width || (side === "center" ? 420 : 240);
    return '<figure class="fig fig-' + side + '" style="width:' + width + 'px"><img src="' + esc(src) + '" alt="' + esc(m[1]) + '" loading="lazy">' +
      (cap ? "<figcaption>" + inline(cap) + "</figcaption>" : "") + "</figure>";
  }

  /* An infobox: a quote that starts [!INFO] and an optional title, then lines of "Key: value", an optional "image: path", and "## Group" headings.
     It becomes a small fact panel that floats on the right of the page, like a captioned picture. A line with no colon carries on the row above. */
  function infobox(titleText, lines) {
    var rows = [], img = "";
    lines.forEach(function (ln) {
      var t = ln.trim(), m;
      if (!t) return;
      if ((m = /^##\s+(.+?)\s*$/.exec(t))) { rows.push({ group: m[1] }); return; }
      if ((m = /^image\s*:\s*(\S+)\s*$/i.exec(t))) { img = m[1]; return; }
      if ((m = /^([^:|]{1,40}?)\s*:\s*(.*)$/.exec(t))) { rows.push({ k: m[1], v: m[2] }); return; }
      if (rows.length && rows[rows.length - 1].k !== undefined) rows[rows.length - 1].v += " " + t;
    });
    var src = img ? imgSrc(img) : "";
    var h = '<aside class="factbox" aria-label="Facts: ' + esc(plainText(titleText)) + '"><div class="ib-title">' + inline(titleText) + "</div>";
    if (src) h += '<img class="ib-img" src="' + esc(src) + '" alt="' + esc(plainText(titleText)) + '" loading="lazy">';
    h += rows.map(function (r) {
      return r.group !== undefined ? '<div class="ib-sec">' + inline(r.group) + "</div>" : '<div class="ib-row"><div class="ib-k">' + inline(r.k) + '</div><div class="ib-v">' + inline(r.v) + "</div></div>";
    }).join("");
    return h + "</aside>";
  }

  /* Keys and buttons: {{W}}, {{Shift+Right click}}, {{Mouse 4}}, {{pad:RT}} become keycaps */
  /* the four arrow keys are written as words and shown as arrows */
  var ARROW_KEYS = { up: ["↑", "Up"], down: ["↓", "Down"], left: ["←", "Left"], right: ["→", "Right"] };
  var MOUSE_KEY = /^(mouse\s*\d|(left|right|middle)\s*click|click|scroll(\s*(up|down|wheel))?|wheel)$/i;
  function keycaps(text) {
    /* a "+" joins keys only when a key follows it directly, so "Shift+F10" is two caps while "Numpad +" and "{{+}}" are one */
    var all = /^pad\s*:/i.test(text), parts = text.trim().split(/\+(?=\S)/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (!parts.length) return esc(text);
    var caps = parts.map(function (k) {
      var own = /^pad\s*:/i.test(k); k = k.replace(/^pad\s*:\s*/i, "");
      var pad = all || own, arrow = !pad && ARROW_KEYS[k.toLowerCase()];
      var cls = pad ? "k k-pad" : MOUSE_KEY.test(k) ? "k k-mouse" : "k";
      if (arrow) return '<kbd class="' + cls + '" aria-label="' + arrow[1] + ' arrow key" title="' + arrow[1] + ' arrow key">' + arrow[0] + "</kbd>";
      return '<kbd class="' + cls + '">' + esc(k) + "</kbd>";
    });
    return caps.length === 1 ? caps[0] : '<span class="keys">' + caps.join('<span class="kplus">+</span>') + "</span>";
  }
  /* Inline code: a run of backticks opens it and the next run of the same length closes it, so `` ` `` can hold a backtick.
     One space is dropped from each end when both ends have one, and nothing inside is read as markup. A run with no match stays plain text. */
  function codeSpans(s, keep) {
    var out = "", i = 0, n = s.length;
    while (i < n) {
      if (s.charAt(i) !== "`") { var j = s.indexOf("`", i); if (j < 0) { out += s.slice(i); break; } out += s.slice(i, j); i = j; continue; }
      var run = i; while (i < n && s.charAt(i) === "`") i++;
      var len = i - run, k = i, close = -1;
      while (k < n) {
        var b = s.indexOf("`", k); if (b < 0) break;
        var e = b; while (e < n && s.charAt(e) === "`") e++;
        if (e - b === len) { close = b; break; }
        k = e;
      }
      if (close < 0) { out += s.slice(run, i); continue; }
      var c = s.slice(i, close);
      if (c.length > 2 && c.charAt(0) === " " && c.charAt(c.length - 1) === " " && c.trim()) c = c.slice(1, -1);
      out += keep("<code>" + esc(c) + "</code>"); i = close + len;
    }
    return out;
  }
  var tagSrc = false;   /* set while drawing for the editor's Edit in Preview: links, pictures, keys and wiki links then carry their source text (data-md, data-href) so that an edited line can be written back */
  function atom(h, src) { return tagSrc ? '<span class="vis-atom" data-md="' + esc(src) + '" contenteditable="false">' + h + "</span>" : h; }
  function inline(s) {
    var stash = [];
    function keep(h) { stash.push(h); return "\u0000" + (stash.length - 1) + "\u0000"; }
    s = codeSpans(s, keep);
    s = s.replace(/\[\^([^\]\s]+)\]/g, function (m, id) { var h = fnRef(id); return h ? keep(atom(h, m)) : m; });   /* a footnote reference; one with no definition stays as written */
    s = s.replace(/\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g, function (m, t, l) { return keep(atom(wikiLink(t, l), m)); });
    s = s.replace(/\{\{([^{}]+)\}\}/g, function (m, t) { return keep(atom(keycaps(t), m)); });
    /* a picture inside a link, [![alt](pic)](url), is not supported: it is shown as plain text (the editor's Problems and tools/guide.py report it) */
    s = s.replace(/\[!\[[^\]]*\]\([^()\s]*(?:\s+"[^"]*")?\)(?:\{[^}]*\})?[^\]]*\]\([^()\s]*\)/g, function (m) { return keep(atom(esc(m), m)); });
    s = s.replace(IMG_RE, function (m, alt, src) {
      src = imgSrc(src); if (!src) return "";
      return keep(atom('<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy">', m));
    });
    s = s.replace(/\[([^\]]+)\]\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)\)/g, function (m, text, url) {
      var rawUrl = url; url = safeUrl(url); if (!url) return text;
      var ext = /^https?:/i.test(url);
      if (ext) noteRef("ext", url, { url: url, text: plainText(text) });
      return keep('<a href="' + esc(url) + '"' + (tagSrc ? ' data-href="' + esc(rawUrl) + '"' : "") + (ext ? ' rel="noopener"' : "") + ">" + inlineBasic(text) + "</a>" + (ext ? MARK_EXT : ""));
    });
    /* a spoiler: >!hidden text!< is masked until clicked (or Enter or Space pressed on it) */
    s = s.replace(/>!(.+?)!</g, function (m, t) { return keep('<span class="spoiler" role="button" tabindex="0" aria-expanded="false" title="Spoiler: click to show">') + t + keep("</span>"); });
    s = inlineBasic(s);
    return s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return stash[+i]; });
  }
  function inlineBasic(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
      .replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,;:!?]|$)/g, "$1<i>$2</i>");
  }
  function plainText(s) { return s.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, function (m, t, l) { return l || t; }).replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/>!(.+?)!</g, "$1").replace(/[*_`]/g, ""); }
  function splitRow(l) {
    var cells = [], cur = "", t = l.trim().replace(/^\|/, "").replace(/([^\\])\|$/, "$1");
    for (var k = 0; k < t.length; k++) {
      if (t[k] === "\\" && t[k + 1] === "|") { cur += "|"; k++; }
      else if (t[k] === "|") { cells.push(cur.trim()); cur = ""; }
      else cur += t[k];
    }
    cells.push(cur.trim());
    return cells;
  }

  function buildReferences(r, related) {
    (related || []).forEach(function (name) {
      /* "guide:Name", "site:Name", "topic:Name" and "patch:0.1.2" say which kind; with no prefix it is a Game Guide page, as in the text */
      var pm = /^(guide|site|topic|patch)\s*:\s*(.*)$/i.exec(name), mode = pm ? pm[1].toLowerCase() : "", rest = (pm ? pm[2] : name).trim();
      if (mode === "patch") { if (D.releases[rest]) noteRef("patch", rest, rest); return; }
      var low = rest.toLowerCase(), g = mode === "topic" ? null : mode === "site" ? (siteByTitle[low] || siteBySlug[low]) : (guideByTitle[low] || guideBySlug[low]), t = mode === "topic" ? topicByLower[low] : null;
      if (g && pageKey(g) !== r.self) noteRef("guide", pageKey(g), g); else if (!g && t) noteRef("topic", t, t);
    });
    var h = "";
    if (r.guide.length || r.topic.length || r.patch.length) {   /* r.guide holds pages of both guides */
      h += sec("References", "References", 2);
      [["guide", "Game Guide"], ["site", "Site Guide"]].forEach(function (a) {
        var list = r.guide.filter(function (g) { return g.area === a[0]; });
        if (list.length) h += sec(a[1], a[1], 3) + '<ol class="refs">' + list.map(function (g) {
          return "<li>" + glink(g) + (g.summary ? " – " + esc(g.summary) : "") + "</li>"; }).join("") + "</ol>";
      });
      if (r.topic.length || r.patch.length) h += sec("Patch Notes", "Patch Notes", 3) + '<ol class="refs">' +
        r.topic.map(function (t) { var v = D.tstat[t][1]; return "<li>" + tlink(t) + " – last patched " + vlink(v) + " (" + esc(dateOf(v)) + ")</li>"; }).join("") +
        r.patch.map(function (v) { return "<li>Patch " + vlink(v) + " – released " + esc(dateOf(v)) + "</li>"; }).join("") + "</ol>";
    }
    if (r.ext.length) h += sec("External Links", "External Links", 2) + '<ol class="refs">' + r.ext.map(function (e) {
      var host = e.url.replace(/^https?:\/\//i, "").split("/")[0];
      return '<li><a href="' + esc(e.url) + '" rel="noopener">' + esc(e.text || host) + "</a>" + MARK_EXT + ' <small class="muted">(' + esc(host) + ")</small></li>"; }).join("") + "</ol>";
    return h;
  }
  /* a fenced code block: a bar with the language name and a Copy button over the coloured code (colours come from highlight.js, which escapes everything) */
  function codeBox(lang, raw) {
    var hl = window.udfopHighlight ? window.udfopHighlight.run(raw, lang) : { html: esc(raw), label: lang };
    return '<div class="codebox"><div class="codebar"><span class="codelang">' + esc(hl.label || "") + '</span><button type="button" class="codecopy" aria-label="Copy this code">Copy</button></div><pre><code' +
      (lang ? ' class="lang-' + esc(lang) + '"' : "") + ">" + hl.html + "</code></pre></div>";
  }
  var TABLE_TYPES = ["num", "pct", "dur", "date", "bool", "text"];   /* the column types a table's divider row may name; web/tables.js sorts by them */
  var mdRoot = "guide/";   /* "guide/" or "site/": which section's folder the page being rendered is in */
  var mdBase = "";   /* folder of the page being rendered, so pictures resolve next to it */
  /* ln0: with a number, every block gets data-ln="first-last", its lines in the source (1-based; ln0 lines come before src). The editor reads it. Left out, nothing is added. */
  /* Footnotes: text[^id] is a numbered superscript link, and a line [^id]: text anywhere in the page (outside a code box) is its note. The notes are listed
     under a Footnotes heading at the end, numbered by first use; a note used twice keeps its number and gets a way back from each use. */
  var fnState = null;   /* while a page is drawn: { defs: id -> note text, uses: id -> { n, count }, order: ids by first use, inDef } (keys start with $) */
  function fnId(id) { return id.replace(/[^A-Za-z0-9_-]/g, function (c) { return "_" + c.charCodeAt(0).toString(16); }); }
  function fnRef(id) {
    var f = fnState, k = "$" + id; if (!f || f.inDef || !(k in f.defs)) return "";
    var u = f.uses[k] || (f.uses[k] = { n: f.order.push(id), count: 0 }), base = fnId(id);
    u.count++;
    return '<sup class="fnref"><a href="' + pagePath() + "#fn-" + base + '" role="doc-noteref" id="fnref-' + base + (u.count > 1 ? "-" + u.count : "") + '" aria-label="Footnote ' + u.n + '">[' + u.n + "]</a></sup>";
  }
  /* takes the note lines out of the page (their lines go blank, so line numbers stay) and keeps their text */
  function fnScan(lines) {
    var fence = null, cur = "", m, c;
    lines.forEach(function (l, k) {
      if (fence) { c = /^(`{3,}|~{3,})\s*$/.exec(l); if (c && c[1].charAt(0) === fence.charAt(0) && c[1].length >= fence.length) fence = null; return; }
      if ((m = /^(`{3,}|~{3,})\s*([A-Za-z0-9+#.-]{1,20})?\s*$/.exec(l))) { fence = m[1]; cur = ""; return; }
      if ((m = /^\[\^([^\]\s]+)\]:[ \t]*(.*)$/.exec(l))) { cur = "$" + m[1]; if (!(cur in fnState.defs)) fnState.defs[cur] = m[2].trim(); else cur = ""; lines[k] = ""; return; }
      if (cur && /^\s{2,}\S/.test(l)) { fnState.defs[cur] += " " + l.trim(); lines[k] = ""; return; }
      cur = "";
    });
  }
  function fnList() {
    var f = fnState; if (!f.order.length) return "";
    var h = sec("Footnotes", "Footnotes", 2) + '<div role="doc-endnotes"><ol class="footnotes">';
    f.order.forEach(function (id) {
      var base = fnId(id), u = f.uses["$" + id], text = f.defs["$" + id], back = "";
      if (/^https?:\/\/[^\s()\[\]]+$/i.test(text)) text = "[" + text.replace(/^https?:\/\//i, "").replace(/\/$/, "") + "](" + text + ")";   /* a note that is only an address shows it as a link */
      f.inDef = true; text = inline(text); f.inDef = false;
      for (var j = 1; j <= u.count; j++) back += ' <a class="fnback" role="doc-backlink" href="' + pagePath() + "#fnref-" + base + (j > 1 ? "-" + j : "") + '" aria-label="Back to reference ' + u.n + (u.count > 1 ? " (use " + j + " of " + u.count + ")" : "") + '">↩' + (u.count > 1 ? "<sup>" + j + "</sup>" : "") + "</a>";
      h += '<li id="fn-' + base + '" role="doc-endnote">' + text + back + "</li>";
    });
    return h + "</ol></div>";
  }
  function markdown(src, title, ln0) {
    if (fnState) return markdownBody(src, title, ln0);   /* a quote or box inside the page shares the page's notes */
    fnState = { defs: {}, uses: {}, order: [], inDef: false };
    try { var h = markdownBody(src, title, ln0, true), f = fnList(); return f ? h + "\n" + f : h; } finally { fnState = null; }
  }
  function markdownBody(src, title, ln0, top) {
    var lines = src.replace(/\r\n?/g, "\n").split("\n"), out = [], i = 0, first = true, figSince = false, at0 = 0;
    if (top) fnScan(lines);
    function emit(h, from, to, bk) { out.push(ln0 === undefined ? h : lnTag(h, ln0 + from + 1, ln0 + to + 1, bk)); }
    function nested(skip) { return ln0 === undefined ? undefined : ln0 + at0 + skip; }
    function para(buf, from) { if (buf.length) emit("<p>" + inline(buf.join(" ")) + "</p>", from, from + buf.length - 1, "p"); }
    while (i < lines.length) {
      var l = lines[i], m;
      at0 = i;
      if (!l.trim()) { i++; continue; }
      if ((m = /^(`{3,}|~{3,})\s*([A-Za-z0-9+#.-]{1,20})?\s*$/.exec(l))) {   /* a code box: three or more backticks or tildes; only a bare fence at least as long closes it */
        var code = [], lang = (m[2] || "").toLowerCase(), fence = m[1], fm; i++;
        while (i < lines.length && !((fm = /^(`{3,}|~{3,})\s*$/.exec(lines[i])) && fm[1].charAt(0) === fence.charAt(0) && fm[1].length >= fence.length)) code.push(lines[i++]);
        i++; emit(codeBox(lang, code.join("\n")), at0, Math.min(i, lines.length) - 1, "code"); continue;
      }
      if ((m = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(l))) {
        var text = plainText(m[2]);
        if (first && m[1].length === 1 && text.toLowerCase() === (title || "").toLowerCase()) { i++; first = false; continue; }
        var lvl = Math.min(6, Math.max(2, m[1].length));
        var hd = lvl <= 3 ? sec(text, text, lvl) : "<h" + lvl + ">" + inline(m[2]) + "</h" + lvl + ">";
        if (figSince && lvl <= 3) hd = hd.replace('class="sec"', 'class="sec cl"');
        figSince = false; emit(hd, at0, at0, "h"); i++; first = false; continue;
      }
      first = false;
      if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(l)) { emit("<hr>", at0, at0, "hr"); i++; continue; }
      if (/^>(?!!.*!<)/.test(l)) {   /* a line that opens with a >!spoiler!< is a paragraph, not a quote */
        var q = [];
        while (i < lines.length && /^>(?!!.*!<)/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
        /* a quote whose first line is [!NOTE], [!TIP], [!IMPORTANT], [!WARNING] or [!CAUTION] is a notice box (GitHub's alert syntax); any other quote stays a quote */
        var inf = /^\[!INFO\](?:[ \t]+(.*?))?\s*$/i.exec(q[0]);
        if (inf) { emit(infobox(inf[1] || title || "", q.slice(1)), at0, i - 1, "info"); continue; }   /* a fact panel: floats right like a captioned picture */
        var al = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(q[0]);
        if (al) {
          var kind = al[1].toLowerCase();
          emit('<div class="alert alert-' + kind + '" role="note"><span class="alert-label">' + kind.charAt(0).toUpperCase() + kind.slice(1) + "</span>" + markdown(q.slice(1).join("\n"), undefined, nested(1)) + "</div>", at0, i - 1, "alert"); continue;
        }
        emit("<blockquote>" + markdown(q.join("\n"), undefined, nested(0)) + "</blockquote>", at0, i - 1, "quote"); continue;
      }
      if (l.indexOf("|") >= 0 && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?(\{[a-z ,]*\})?\s*(\|\s*:?-{2,}:?(\{[a-z ,]*\})?\s*)*\|?\s*$/.test(lines[i + 1])) {
        /* a divider cell is dashes with optional colons for alignment, then optional {tags}: a type (num, pct, dur, date, bool, text) for sorting, and label for the row-label column */
        var head = splitRow(l), body = [], divs = splitRow(lines[i + 1]).map(function (c) {
          var tm = /^(.*?)(?:\{([a-z ,]*)\})?$/.exec(c), core = tm[1], tags = (tm[2] || "").split(/[\s,]+/).filter(Boolean);
          return { align: /^:-+:$/.test(core) ? "center" : /^-+:$/.test(core) ? "right" : /^:-+$/.test(core) ? "left" : "", label: tags.indexOf("label") >= 0, type: tags.filter(function (t) { return TABLE_TYPES.indexOf(t) >= 0; })[0] || "" };
        });
        function al(k) { return divs[k] && divs[k].align ? ' style="text-align:' + divs[k].align + '"' : ""; }
        i += 2;
        while (i < lines.length && lines[i].trim() && lines[i].indexOf("|") >= 0) body.push(splitRow(lines[i++]));
        function tr(cells, at) { var h = "<tr>" + cells + "</tr>"; return ln0 === undefined ? h : lnTag(h, ln0 + at + 1, ln0 + at + 1, "tr"); }
        var kv = divs[0].label && head.every(function (c) { return !c; });   /* a label column under an empty heading row is a key/value table: no heading row, nothing to sort or filter */
        if (kv) {
          emit('<div class="wrap"><table class="wikitable kv"><tbody>' + body.map(function (r, n) {
            return tr(head.map(function (_, k) { return (k ? "<td" : '<th scope="row"') + al(k) + ">" + inline(r[k] || "") + (k ? "</td>" : "</th>"); }).join(""), at0 + 2 + n); }).join("") + "</tbody></table></div>", at0, i - 1, "table");
          continue;
        }
        var live = ln0 === undefined, lc = divs[0].label, types = head.map(function (_, k) { return divs[k] ? divs[k].type : ""; });   /* the sort and filter controls are for readers: the editor's preview leaves them out */
        var th = '<table class="wikitable gt' + (lc ? " lc" : "") + '"' + (live && types.join("") ? ' data-types="' + types.join(",") + '"' : "") + "><thead>" +
          tr(head.map(function (c, k) { return "<th" + al(k) + ">" + (live ? '<button type="button" class="sortbtn"><span class="sortlbl">' + inline(c) + '</span><span class="sortmark" aria-hidden="true"></span></button>' : inline(c)) + "</th>"; }).join(""), at0) +
          "</thead><tbody>" + body.map(function (r, n) {
            return tr(head.map(function (_, k) { return (k === 0 && lc ? '<th scope="row"' : "<td") + al(k) + ">" + inline(r[k] || "") + (k === 0 && lc ? "</th>" : "</td>"); }).join(""), at0 + 2 + n); }).join("") + "</tbody></table>";
        emit(live ? '<div class="gtable"><div class="tbar"><span class="tfw"><input type="search" class="filter tfind" placeholder="Filter rows" aria-label="Filter this table\'s rows" autocomplete="off"><button type="button" class="tclear" aria-label="Clear the filter" hidden>&times;</button></span><button type="button" class="treset" hidden>Reset sort</button><span class="tcopy"><button type="button" class="tbtn" data-copy="md" title="Copy the rows shown as a Markdown table in a code block, for Discord">Copy MD</button><button type="button" class="tbtn" data-copy="html" title="Copy the rows shown as an HTML table, which pastes into Excel or Google Sheets as cells">Copy HTML</button></span></div>' +
          '<div class="gscroll"><div class="wrap">' + th + '</div></div><div class="tcount" aria-hidden="true"></div><div class="tstat" role="status" aria-live="polite"></div></div>' : '<div class="wrap">' + th + "</div>", at0, i - 1, "table");
        continue;
      }
      if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
        var items = [];
        while (i < lines.length && lines[i].trim() && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) items.push(lines[i++]);
        emit(list(items, ln0 === undefined ? undefined : ln0 + at0), at0, i - 1, "list"); continue;
      }
      if ((m = FIG_LINE.exec(l.trim())) && (m[3] || m[4] !== undefined)) { emit(figure(m), at0, at0, "fig"); figSince = true; i++; continue; }
      var buf = [];
      while (i < lines.length && lines[i].trim() && !/^((`{3,}|~{3,})\s*([A-Za-z0-9+#.-]{1,20})?\s*$|#{1,6}\s|>(?!!.*!<))/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) &&
             !((m = FIG_LINE.exec(lines[i].trim())) && (m[3] || m[4] !== undefined))) buf.push(lines[i++].trim());
      para(buf, at0);
    }
    return out.join("\n");
  }
  /* adds data-ln to the first tag of an html string (an empty string stays empty) */
  function lnTag(h, from, to, bk) { return h.replace(/^<[a-z0-9]+/i, function (t) { return t + ' data-ln="' + from + "-" + to + '"' + (bk ? ' data-bk="' + bk + '"' : ""); }); }
  /* lnBase: the source line before the first item, or undefined for no data-ln; only the items of the outer list are tagged */
  function list(items, lnBase) {
    function indentOf(l) { return l.match(/^\s*/)[0].replace(/\t/g, "  ").length; }
    function build(from, to, base) {
      var m0 = /^\s*(\d+[.)])/.exec(items[from]), tag = m0 ? "ol" : "ul", h = "<" + tag + ">", k = from;
      while (k < to) {
        var m = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(items[k]), text = m ? m[1] : items[k].trim(), j = k + 1;
        while (j < to && (indentOf(items[j]) > base || !/^\s*([-*+]|\d+[.)])\s+/.test(items[j]))) j++;
        var kids = "";
        if (j > k + 1) {
          var sub = items.slice(k + 1, j).filter(function (x) { return /^\s*([-*+]|\d+[.)])\s+/.test(x); });
          if (sub.length) kids = list(sub); else text += " " + items.slice(k + 1, j).map(function (x) { return x.trim(); }).join(" ");
        }
        h += "<li" + (lnBase === undefined ? "" : ' data-ln="' + (lnBase + k + 1) + "-" + (lnBase + j) + '" data-bk="li"') + ">" + inline(text) + kids + "</li>"; k = j;
      }
      return h + "</" + tag + ">";
    }
    return build(0, items.length, indentOf(items[0]));
  }
  function frontMatter(raw) {
    raw = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n");
    var meta = {}, body = raw;
    if (raw.indexOf("---\n") === 0) {
      var end = raw.indexOf("\n---", 4);
      if (end > 0) {
        raw.slice(4, end).split("\n").forEach(function (ln) { var c = ln.indexOf(":"); if (c > 0) meta[ln.slice(0, c).trim().toLowerCase()] = ln.slice(c + 1).trim().replace(/^["']|["']$/g, ""); });
        body = raw.slice(end + 4).replace(/^\n+/, "");
      }
    }
    return { meta: meta, body: body };
  }

  var GUIDE_HAT = HOME_HAT + ' › <a href="#/guide">Game Guide</a>';
  function guideUnavailable() {
    return '<div class="mbox">The Game Guide could not be loaded. If you opened <code>index.html</code> straight from a folder, the browser blocks it: serve the <code>web</code> folder instead (for example <code>python -m http.server --directory web</code>) or use the published site. If you just added pages, run <code>python tools/guide.py</code> to refresh the list.</div>';
  }

  views.guide = function (arg) {
    if (arg && arg.indexOf("category/") === 0) return views.guidecat(arg.slice(9));
    if (arg) return views.guidepage(arg);
    var h = "<p>The Game Guide is the community-written part of UDOP: how things in DFO Online work, written by players. Unlike the patch notes it is edited by hand, so anyone can improve it.</p>" + '<p class="browse"><b>Browse:</b> <a href="#/glossary">Glossary</a></p>' + contribBox();
    if (guide === null) h += "<p>Loading…</p>";
    else if (guideFailed) h += guideUnavailable();
    else if (!listedGuide().length) h += "<p>There are no guide pages yet. Be the first to write one.</p>";
    else {
      var cats = guideCategories();
      Object.keys(cats).forEach(function (c) {
        var all = cats[c];
        h += sec(c, c, 2).replace(">" + esc(c) + "</h2>", '><a href="#/guide/category/' + enc(c) + '">' + esc(c) + "</a></h2>") + guideList(all.slice(0, INDEX_SHOWN));   /* the section name opens that category's page */
        if (all.length > INDEX_SHOWN) h += '<p class="allpages"><a href="#/guide/category/' + enc(c) + '">All ' + all.length + " pages in " + esc(c) + " →</a></p>";
      });
    }
    return { title: "Game Guide", html: page("Game Guide", h, { hat: HOME_HAT + " › Game Guide" }) };
  };
  views.guidecat = function (c) {
    var list = listedGuide().filter(function (p) { return p.category === c; });
    var h = guide === null ? "<p>Loading…</p>" : list.length ? categoryList(list) : "<p>No pages in this category.</p>";
    return { title: c, html: page(esc(c), h, { hat: GUIDE_HAT + " › " + esc(c) }), toc: false };
  };
  views.guidepage = function (slug) {
    if (slug.toLowerCase() === "glossary") {   /* the glossary has its own address; a link to one of its terms (#s-term) opens that entry */
      var q = location.hash.indexOf("?"), f = location.hash.indexOf("#", 1);
      location.replace("#/glossary" + (q >= 0 ? location.hash.slice(q, f > q ? f : undefined) : "") + (f > 0 ? location.hash.slice(f).replace(/^#s-/, "#gl-") : "")); return null;
    }
    if (MOVED[slug.toLowerCase()]) { location.replace(MOVED[slug.toLowerCase()]); return null; }
    return pageView("guide", slug);
  };
  var SITE_HAT = HOME_HAT + ' › <a href="#/site">Site Guide</a>';
  /* the Site Guide: help for contributors and reviewers, in web/site/. #/site is its front page (web/site/index.md) */
  /* Site Guide pages that were renamed (lower case old address or title -> new address) */
  var SITE_MOVED = { "troubleshooting": "#/site/fixing-a-page", "troubleshooting and faq": "#/site/fixing-a-page" };
  views.site = function (arg) {
    if (arg && SITE_MOVED[arg.toLowerCase()]) { location.replace(SITE_MOVED[arg.toLowerCase()]); return null; }
    return pageView("site", arg || "index");
  };
  /* "Written by ..." from the authors: front matter line: names separated by commas, a name written [name](link) is linked */
  function authorsLine(list) {
    return "Written by " + list.split(",").map(function (a) {
      var m = a.trim().match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      return m ? '<a href="' + esc(m[2]) + '" rel="noopener">' + esc(m[1]) + "</a>" : esc(a.trim());
    }).filter(Boolean).join(", ");
  }
  /* The Glossary (#/glossary) is built from the Game Guide page web/guide/glossary.md, which anyone can edit. Each term is a ### heading; under it come an optional "Also called:" line,
     the definition, and an optional "See also:" line. Other headings (a letter, say) and the text before the first term are ignored. The terms are sorted and grouped by first letter;
     each entry can be linked as #/glossary#gl-term. */
  function glossaryId(term) { return "gl-" + term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function glossaryRows(raw) {
    var rows = [], cur = null, fence = false;
    frontMatter(raw).body.split("\n").forEach(function (l) {
      var h, m;
      if (/^(`{3,}|~{3,})/.test(l)) { fence = !fence; return; }
      if (fence) return;
      if ((h = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(l))) { cur = h[1].length === 3 ? { term: plainText(h[2]), also: "", cat: "", def: [], see: "" } : null; if (cur) rows.push(cur); return; }
      if (!cur || !l.trim()) return;
      if ((m = /^[*_]*(Also called|See also|Category)[*_]*\s*:\s*[*_]*\s*(.*)$/i.exec(l.trim()))) { var v = m[2].replace(/[*_]+$/, ""); if (/^also/i.test(m[1])) cur.also = v; else if (/^cat/i.test(m[1])) cur.cat = plainText(v); else cur.see = m[2]; }
      else cur.def.push(l.trim());
    });
    return rows.filter(function (r) { return r.term && r.def.length; }).map(function (r) { r.def = r.def.join(" "); return r; })
      .sort(function (a, b) { return a.term.toLowerCase() < b.term.toLowerCase() ? -1 : a.term.toLowerCase() > b.term.toLowerCase() ? 1 : 0; });
  }
  /* draws the glossary into box from the Markdown body of web/guide/glossary.md (the page it is read from keeps that page's View Source and History tabs) */
  function drawGlossary(box, body) {
    var rows = glossaryRows(body), intro = '<p>Short shared definitions for the terms the Game Guide uses. Each entry links to the page that explains it in full.</p>';
    if (!rows.length) { box.innerHTML = intro + '<div class="mbox">The glossary has no entries yet. Add a term to this page with the Edit link below.</div>'; return; }
    refs = newRefs("guide|glossary");
    var az = routeQuery.group === "az", html = "", last = "", have = {}, groups = [], bar = "";
    /* grouped by category (the default; a term with none goes under Other, last) or A to Z */
    function groupOf(r) { return az ? (/^[a-z]/i.test(r.term) ? r.term.charAt(0).toUpperCase() : "#") : (r.cat || "Other"); }
    rows.slice().sort(function (x, y) {
      var gx = groupOf(x), gy = groupOf(y);
      if (!az && gx !== gy) return gx === "Other" ? 1 : gy === "Other" ? -1 : gx.toLowerCase() < gy.toLowerCase() ? -1 : 1;
      return 0;
    }).forEach(function (r) {
      var g = groupOf(r), gid = az ? "gl-letter-" + (g === "#" ? "other" : g) : "gl-cat-" + g.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (g !== last) { html += '<h2 class="gl-ltr" id="' + gid + '">' + esc(g) + "</h2>"; last = g; have[g] = gid; groups.push(g); }
      var meta = (az && r.cat ? esc(r.cat) : "") + (az && r.cat && r.also ? " · " : "") + (r.also ? "Also called: " + esc(r.also) : "");
      html += '<div class="gl-e" id="' + glossaryId(r.term) + '" data-find="' + esc((r.term + " " + r.also + " " + r.cat + " " + plainText(r.def)).toLowerCase()) + '"><p class="gl-t">' + wikiLink(r.term) + "</p>" +   /* the term opens the guide page of that name; with none it is a red link that starts one */
        (meta ? '<p class="gl-al muted">' + meta + "</p>" : "") + '<p class="gl-d">' + inline(r.def) + "</p>" +
        (r.see ? '<p class="gl-s muted">See also: ' + inline(r.see) + "</p>" : "") + "</div>";
    });
    refs = null;
    if (az) bar = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("").map(function (c) { return have[c] ? '<a href="' + pagePath() + "#" + have[c] + '">' + c + "</a>" : '<span aria-hidden="true">' + c + "</span>"; }).join("");
    else bar = groups.map(function (g) { return '<a href="' + pagePath() + "#" + have[g] + '">' + esc(g) + "</a>"; }).join("");
    var tabs = '<nav class="gtabs" aria-label="Group the glossary">' + (az ? '<a href="#/glossary">By category</a><span class="on" aria-current="page">A to Z</span>' : '<span class="on" aria-current="page">By category</span><a href="#/glossary?group=az">A to Z</a>') + "</nav>";
    box.innerHTML = intro + tabs + '<div class="gl-bar"><input type="search" class="filter" placeholder="Filter terms" aria-label="Filter the glossary" autocomplete="off"><span class="gl-n muted" role="status" aria-live="polite"></span></div>' +
      '<nav class="gl-letters' + (az ? "" : " cats") + '" aria-label="' + (az ? "Jump to a letter" : "Jump to a category") + '">' + bar + '</nav><div class="gl-list">' + html + '</div><p class="gl-none muted" hidden>No term matches.</p>';
    var input = box.querySelector("input"), count = box.querySelector(".gl-n"), entries = box.querySelectorAll(".gl-e"), letters = box.querySelectorAll(".gl-ltr");
    function filter() {
      var w = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean), shown = 0;
      Array.prototype.forEach.call(entries, function (e) {
        var ok = w.every(function (x) { return e.getAttribute("data-find").indexOf(x) >= 0; });
        e.hidden = !ok; if (ok) shown++;
      });
      /* a heading stays while any entry after it, up to the next heading, is shown */
      Array.prototype.forEach.call(letters, function (l) { var n = l.nextElementSibling, any = false; while (n && !n.classList.contains("gl-ltr")) { if (!n.hidden) any = true; n = n.nextElementSibling; } l.hidden = !any; });
      count.textContent = w.length ? shown + " of " + entries.length + " terms" : entries.length + " terms";
      box.querySelector(".gl-none").hidden = shown > 0;
      /* the words typed are painted in the entries shown (the CSS Custom Highlight API, as in guide tables; a browser without it shows none) */
      if (window.CSS && CSS.highlights && typeof Highlight !== "undefined") {
        var found = [];
        if (w.length) Array.prototype.forEach.call(entries, function (e) {
          if (e.hidden) return;
          var tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), n;
          while ((n = tw.nextNode())) {
            var low = n.nodeValue.toLowerCase();
            w.forEach(function (x) { for (var at = low.indexOf(x); at >= 0; at = low.indexOf(x, at + x.length)) { var rg = document.createRange(); rg.setStart(n, at); rg.setEnd(n, at + x.length); found.push(rg); } });
          }
        });
        if (found.length) CSS.highlights.set("tfind", new Highlight(...found)); else CSS.highlights.delete("tfind");
      }
    }
    input.addEventListener("input", filter); filter();
  }
  /* #/glossary is the guide page glossary (unlisted) drawn as the glossary, with that page's own Read, View Source and History tabs */
  views.glossary = function () { return pageView("guide", "glossary", true); };
  /* one Markdown page of the Game Guide (web/guide/) or the Site Guide (web/site/); both are rendered the same way */
  function pageView(area, slug, glossary) {   /* glossary: the Glossary page, which is the guide page glossary drawn as the glossary */
    var site = area === "site", bySlug = site ? siteBySlug : guideBySlug, byTitle = site ? siteByTitle : guideByTitle, dir = site ? "site/" : "guide/";
    var entry = bySlug[slug.toLowerCase()] || byTitle[slug.toLowerCase()], front = site && (entry ? entry.slug : slug) === "index";
    var title = entry ? entry.title : slug.split("/").pop();
    var real = entry ? entry.slug : slug, slugPath = real.split("/").map(enc).join("/");
    return { title: title, html: page(esc(title), '<div id="gp"><p>Loading…</p></div>', { hat: front ? HOME_HAT + " › Site Guide" : site ? SITE_HAT : GUIDE_HAT }), after: function () {
      var box = document.getElementById("gp");
      if (glossary && guide === null) return;   /* the page list is still loading and the terms are checked against it: the page is drawn again when it arrives */
      /* the View Source tab: the page's Markdown file in a read-only copy of the editor's panes, with a notice on how to change it. The editor's colors are fetched the first time. */
      function showSource(raw) {
        var text = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"), file = dir + real + ".md", gh = REPO + "/edit/main/web/" + dir + slugPath + ".md";
        loadFiles(["editor/editor.css", "editor/lint.js", "editor/highlight.js"]).then(function () {
          var words = (text.match(/\S+/g) || []).length;
          box.innerHTML = '<div class="mbox srcnote"><b>This is the source of this page</b>: the Markdown file it is written in. You can select and copy it here, but not change it. To change the page, ' +
            (site ? "" : '<a href="#/editor?page=' + enc(real) + '">open it in the Editor</a> or ') + '<a href="' + gh + '" rel="noopener">edit it on GitHub</a>. Either way, <a href="' + REPO + '/fork" rel="noopener">fork the project</a> first. New to this? <a href="' + HOWTO + '">Learn how</a>.</div>' +
            '<div class="srcv"><div class="edw-pbar"><strong>' + esc(file) + '</strong><span class="edw-grow"></span><small>read-only</small><button type="button" class="srcv-wrap" aria-pressed="true" title="Wrap long lines or scroll sideways">Word wrap</button><button type="button" class="srcv-copy" title="Copy the whole source">Copy</button></div>' +
            '<div class="srcv-code edw-code" tabindex="0" aria-label="Source of this page, read only">' + window.udfopEditor.highlight(text) + "</div>" +
            '<div class="edw-sbar"><span>' + text.split("\n").length.toLocaleString() + " lines</span><span>" + words.toLocaleString() + " words</span></div></div>";
          var panel = box.querySelector(".srcv"), code = box.querySelector(".srcv-code"), wrapBtn = box.querySelector(".srcv-wrap"), VIEW_KEY = "udfop.editor.view";
          /* word wrap: the same setting as the editor's View menu, kept between visits */
          function wrapIs() { try { var v = JSON.parse(localStorage.getItem(VIEW_KEY) || "null"); return !(v && v.wrap === false); } catch (e) { return true; } }
          function setWrap(on, save) {
            code.classList.toggle("nowrap", !on); wrapBtn.setAttribute("aria-pressed", on ? "true" : "false");
            if (!save) return;
            try { var v = JSON.parse(localStorage.getItem(VIEW_KEY) || "null") || {}; v.wrap = on; localStorage.setItem(VIEW_KEY, JSON.stringify(v)); } catch (e) {}
          }
          setWrap(wrapIs(), false);
          var copyBtn = box.querySelector(".srcv-copy");
          copyBtn.addEventListener("click", function () {
            copyText(text, function (ok) {
              copyBtn.textContent = ok ? "Copied" : "Could not copy"; clearTimeout(copyBtn.__t);
              copyBtn.__t = setTimeout(function () { copyBtn.textContent = "Copy"; }, 1600);
            });
          });
          wrapBtn.addEventListener("click", function () { setWrap(wrapBtn.getAttribute("aria-pressed") !== "true", true); });
          function fit() {   /* the panel and the site footer under it fill the window together; the source scrolls inside the panel */
            if (!panel.isConnected) { window.removeEventListener("resize", fit); return; }
            var foot = document.getElementById("foot"), num = function (el, prop) { return el ? parseFloat(getComputedStyle(el)[prop]) || 0 : 0; };
            /* what the page has under the panel: the panel's own margin, the space the footer leaves above it, and the footer */
            var below = num(panel, "marginBottom") + num(panel.parentNode, "paddingBottom") + (foot ? foot.offsetHeight + num(foot, "marginTop") : 0);
            var top = Math.max(panel.getBoundingClientRect().top, document.getElementById("head") ? document.getElementById("head").offsetHeight : 0);
            panel.style.height = Math.max(224, window.innerHeight - top - below) + "px";
            if (foot) {   /* the footer sits at the bottom of a short page: take up whatever space is left between it and the panel */
              var extra = Math.floor(foot.getBoundingClientRect().top - (panel.getBoundingClientRect().bottom + num(panel, "marginBottom") + num(foot, "marginTop")));
              if (extra > 0) panel.style.height = (panel.offsetHeight + extra) + "px";
            }
          }
          fit(); window.addEventListener("resize", fit);
          code.addEventListener("keydown", function (e) {   /* Ctrl+A selects the source, not the whole page */
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") { e.preventDefault(); var r = document.createRange(); r.selectNodeContents(code); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
          });
        }, function () { box.innerHTML = '<div class="mbox">The source view could not load. Check your connection, then <a href="' + location.hash + '">try again</a>.</div>'; });
      }
      /* the History tab: the page's commits, newest first, each linking to the change on GitHub (web/<area>/history.json, built by tools/guide.py) */
      function showHistory() {
        var all = REPO + "/commits/main/web/" + dir + slugPath + ".md";
        fetch(dir + "history.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (data) {
          var hs = data[real];
          if (!hs) { box.innerHTML = '<div class="mbox">No history is recorded for this page yet. <a href="' + all + '" rel="noopener">See it on GitHub</a>.</div>'; return; }
          box.innerHTML = "<p>Every change to this page, newest first. Each date opens that change on GitHub.</p>" +
            '<div class="wrap"><table class="wikitable stack" style="--aw:' + (1.5 + Math.max.apply(null, hs.c.map(function (c) { return String(c[5]).length; }))) + "ch;--dw:" + (1.5 + Math.max.apply(null, hs.c.map(function (c) { return String(c[6]).length; }))) + 'ch"><thead><tr><th>Date</th><th>Author</th><th>Lines</th><th>Change</th></tr></thead><tbody>' + hs.c.map(function (c) {
              return '<tr><td class="nowrap"><a href="' + REPO + "/commit/" + enc(c[0]) + '" rel="noopener">' + esc(c[1]) + '</a></td><td class="nowrap">' + esc(c[2]) + '</td><td class="nowrap lines"><span class="add">+' + c[5] + '</span> <span class="del">−' + c[6] + "</span></td><td><b>" + esc(c[3]) + "</b>" + (c[4] ? '<span class="cbody">' + esc(c[4]) + "</span>" : "") + "</td></tr>";
            }).join("") + "</tbody></table></div>" +
            '<p><a href="' + all + '" rel="noopener">' + (hs.n > hs.c.length ? "All " + hs.n + " changes" : "This page&rsquo;s history") + " on GitHub ↗</a></p>";
          fitEndPad();
        }).catch(function () { box.innerHTML = '<div class="mbox">The history could not load. It is built when the site is published, so a local copy has it only after <code>python tools/guide.py</code>. <a href="' + all + '" rel="noopener">See it on GitHub</a>.</div>'; });
      }
      fetch(dir + slugPath + ".md").then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (raw) {
        var fm = frontMatter(raw), t = fm.meta.title || title, cat = fm.meta.category || (entry && entry.category) || "General";
        document.title = t + " – " + SHORT;
        setNav(["page:" + (site ? "site/" : "") + real.toLowerCase(), area]);   /* the page's real slug, not the title or odd capitals someone typed */
        document.querySelector("h1.title").textContent = t;
        var base = glossary ? "#/glossary" : entry ? purl(entry) : (site ? "#/site/" : "#/guide/") + slugPath, source = routeQuery.view === "source", hist = routeQuery.view === "history";
        /* the same tabs as the By type / By topic switch: the chosen one is not a link */
        function vtab(on, label, href, right) { return on ? '<span class="on' + (right ? " ptab-r" : "") + '" aria-current="page">' + label + "</span>" : '<a' + (right ? ' class="ptab-r"' : "") + ' href="' + href + '">' + label + "</a>"; }
        document.querySelector("h1.title").insertAdjacentHTML("afterend", '<nav class="gtabs ptabs banner" aria-label="Views of this page"><span class="on">Article</span>' +
          vtab(!source && !hist, "Read", base, true) + vtab(source, "View Source", base + "?view=source", false) + vtab(hist, "History", base + "?view=history", false) + "</nav>");
        var hat = document.querySelector(".hat");
        if (hat && glossary) hat.innerHTML = GUIDE_HAT + " › Glossary";
        else if (hat && !site) { if (entry && entry.unlisted) hat.remove(); else hat.innerHTML = GUIDE_HAT + ' › <a href="#/guide/category/' + enc(cat) + '">' + esc(cat) + "</a>"; }
        if (entry && (entry.created || entry.authors)) {   /* who wrote the page (front matter authors:), when it was made and last changed, and by whom (from its commits) */
          var anchor = document.querySelector(".hat") || document.querySelector(".tagline"), bits = [];
          if (entry.authors) bits.push(authorsLine(entry.authors));
          if (entry.created) {
            bits.push("Created " + esc(entry.created) + " by " + esc(entry.cby));
            if (entry.updated !== entry.created || entry.by !== entry.cby) bits.push("Last updated " + esc(entry.updated) + " by " + esc(entry.by));
          }
          if (anchor) anchor.insertAdjacentHTML("afterend", '<p class="pagemeta banner"><small class="muted">' + bits.join("<br>") + "</small></p>");
        }
        if (source) { showSource(raw); return; }
        if (hist) { showHistory(); return; }
        if (glossary) {
          drawGlossary(box, fm.body);
          box.insertAdjacentHTML("beforeend", '<p class="editline footer-note">Want to contribute? <a href="' + HOWTO + '">Learn how</a><br><a href="' + REPO + '/fork" rel="noopener">Fork project</a> | <a href="' + REPO + "/edit/main/web/" + dir + slugPath + '.md" rel="noopener">Edit this page on github</a><br><a href="#/editor?page=' + enc(real) + '">Open this page in the Editor</a></p>');
          fitEndPad(); jumpPending(); return;
        }
        mdRoot = dir;
        mdBase = real.indexOf("/") >= 0 ? real.replace(/[^/]*$/, "") : "";
        refs = newRefs(area + "|" + real);
        var rendered = markdown(fm.body, t); mdBase = ""; mdRoot = "guide/";
        rendered += buildReferences(refs, (fm.meta.related || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean)); refs = null;
        box.innerHTML = rendered +
          '<p class="editline footer-note">Want to contribute? <a href="' + HOWTO + '">Learn how</a><br>' +
          '<a href="' + REPO + '/fork" rel="noopener">Fork project</a> | <a href="' + REPO + "/edit/main/web/" + dir + slugPath + '.md" rel="noopener">Edit this page on github</a>' +
          (site ? "" : '<br><a href="#/editor?page=' + enc(real) + '">Open this page in the Editor</a>') + "</p>";
        buildToc(); fitTocRoom(); addHeadingLinks(); fitEndPad(); jumpPending();
      }).catch(function () {
        if (guideFailed) { box.innerHTML = guideUnavailable(); return; }
        /* the same page as any other missing address (a Game Guide page also gets a way to write it) */
        document.title = "Not found – " + SHORT;
        document.querySelector("h1.title").textContent = "Page not found";
        var hat = document.querySelector(".hat"); if (hat) hat.remove();
        box.innerHTML = notFoundBody(title, site ? "" : '<p><a href="' + newPageUrl(title) + '"' + newAttr(title) + ' rel="noopener">Create this page</a> (you need your own fork first: see <a href="' + HOWTO + '">how to contribute</a>).</p>' + templateChoices(title), site ? "" : slug);
        wireNotFound();
      });
    }, toc: false };
  }

  views.home = function () {
    var n = listedGuide().length;
    var h = '<p>Welcome to <b>UDOP</b>, the <b>Unofficial DFO Online Pages</b>: a fan-made, community-edited reference for DFO Online. It has two parts, plus a Site Guide that explains how to contribute. The <b>☰</b> button at the top left opens the main menu.</p>';
    h += '<div class="portals three">';
    h += '<div class="portal"><h3>Game Guide</h3><div><p>How things work, written by players. ' + (n ? "<b>" + plural(n, "page") + "</b> so far." : "Be the first to add a page.") + '</p><p><a href="#/guide">Browse the Game Guide →</a><br><a href="' + HOWTO + '">How to write a page</a></p></div></div>';
    h += '<div class="portal"><h3>Patch Notes</h3><div><p>Every recorded change, patch by patch: <b>' + D.totals.rows.toLocaleString() + "</b> changes to <b>" + topics.length + "</b> topics. Latest: <b>" + vlink(versions[0]) + "</b> (" + esc(dateOf(versions[0])) + ').</p><p><a href="#/patchnotes">Browse the Patch Notes →</a><br><a href="#/recent">Recent changes</a></p></div></div>';
    var sg = siteBySlug["index"];   /* the Site Guide's front page supplies the card's text */
    h += '<div class="portal"><h3>Site Guide</h3><div><p>' + esc(sg ? sg.summary : "Help for writing, fixing and reviewing Game Guide pages, and for getting around the site.") + '</p><p><a href="#/site">Open the Site Guide →</a><br><a href="#/site/using-the-site">Using the site</a></p></div></div>';
    h += '<div class="portal"><h3>Official Links</h3><div><ul>' + officialLinks(true) + "</ul><p><small class='muted'>Run by the DFO Online developers/community, not by this site.</small></p></div></div>";
    h += '<div class="portal wide"><h3>Made by the community</h3><div><p>UDOP is written and kept up by volunteers. <a href="#/about">Meet the people behind it →</a></p></div></div>';
    h += "</div>";
    h += "<p>Patch notes are compiled from the developers' public release notes by a script, so they are updated for each release. Guide pages are written and corrected by the community, and the Site Guide explains how. <a href=\"#/about\">About &amp; Credits</a></p>";
    return { title: "Main Page", html: page("Main Page", h), toc: false };
  };

  /* ---------- feedback: GitHub issue forms, pre-filled with the page the reader came from ---------- */
  function issueUrl(template, prefix) {
    return REPO + "/issues/new?template=" + template + "&title=" + enc(prefix) + "&page=" + enc(feedbackPage);
  }
  var feedbackPage = location.href;
  /* the developers' own pages, listed in the main menu and on the Main Page; they are not run by this site */
  var OFFICIAL = [
    { name: "Game website", url: "https://daggerfalljs.dev/", note: "Play the game in browser or download it" },
    { name: "Discord", url: "https://discord.com/channels/1345035007164678226", note: "The DFO Online community server" },
    { name: "GitHub", url: "https://github.com/Lattymoy/daggerfall-js-source", note: "Game source code" },
    { name: "YouTube", url: "https://www.youtube.com/@DFOOnline", note: "The Official (unofficial) channel for DFO Online" },
    { name: "Reddit", url: "https://www.reddit.com/r/DaggerfallOnline/", note: "A community for players of DFO Online" }
  ];
  function officialLinks(withNote) {
    return OFFICIAL.map(function (o) {
      return '<li><a href="' + o.url + '" rel="noopener" title="' + esc(o.note) + '">' + esc(o.name) + " ↗</a>" + (withNote ? " – " + esc(o.note) : "") + "</li>";
    }).join("");
  }
  (function () {
    var last = document.querySelector('#side nav:last-of-type');
    if (!last) return;
    var nav = document.createElement("nav");
    nav.setAttribute("aria-label", "Official links");
    nav.innerHTML = "<h3>Official Links</h3><ul>" + officialLinks(false) + "</ul>";
    last.parentNode.insertBefore(nav, last.nextSibling);
  })();
  var GAME_BUGS = "https://discord.com/channels/1345035007164678226/1552054193441869907";   /* where bugs in the game itself are reported (the bug-reports channel of the DFO Online Discord) */
  views.feedback = function () {
    var h = '<div class="mbox"><b>Found a bug in the game itself?</b> This page is only for this website. Report bugs in DFO Online in the <b>bug-reports</b> channel of the DFO Online Discord: <a href="' + GAME_BUGS + '" rel="noopener">open bug-reports</a>.</div>';
    h += "<p>Found something broken, wrong or confusing on this site? Tell us. Reports are made on GitHub, so they are public and need a free GitHub account. The site itself collects nothing about you.</p>";
    h += '<div class="portals">' +
      '<div class="portal"><h3>Report a site bug</h3><div><p>The site is broken, looks wrong, or does not work on your device.</p><p><a class="btn" data-issue="bug.yml" data-prefix="[Bug] " href="' + issueUrl("bug.yml", "[Bug] ") + '" rel="noopener">Report a site bug</a></p></div></div>' +
      '<div class="portal"><h3>Wrong or missing information</h3><div><p>A guide page or patch note is wrong, out of date or incomplete.</p><p><a class="btn" data-issue="content.yml" data-prefix="[Content] " href="' + issueUrl("content.yml", "[Content] ") + '" rel="noopener">Report an error</a></p></div></div>' +
      '<div class="portal"><h3>Suggestion or feedback</h3><div><p>An idea, a request, or what you think of the site.</p><p><a class="btn" data-issue="feedback.yml" data-prefix="[Feedback] " href="' + issueUrl("feedback.yml", "[Feedback] ") + '" rel="noopener">Give feedback</a></p></div></div>' +
      "</div>";
    h += sec("Rather fix it yourself?", "Rather fix it yourself?", 2) +
      '<p>Anyone can correct or add a Game Guide page: <a href="' + HOWTO + '">how to write a guide page</a>. Please do not put personal details in a report, since it is public.</p>';
    return { title: "Feedback & Bugs", html: page("Feedback &amp; Bugs", h, { hat: HOME_HAT + " › Feedback &amp; Bugs" }), toc: false };
  };

  views.random = function () {
    location.replace("#/topic/" + enc(liveTopics[Math.floor(Math.random() * liveTopics.length)]));
    return null;
  };

  /* the words of a missing address or name, without the view words, for the search box and for finding pages with a similar name */
  function missingWords(name) {
    var raw = String(name || "").replace(/^#\/?/, "");
    try { raw = decodeURIComponent(raw); } catch (e) {}
    return raw.split(/[^A-Za-z0-9]+/).filter(function (w) { return w && !/^(topic|hub|system|patch|guide|category|search)$/i.test(w); });
  }
  /* strict matching: a title that contains every word; failing that, the longest word (at least 3 letters). At most 3 pages, guide pages first */
  function similarPages(words) {
    var long = words.slice().sort(function (a, b) { return b.length - a.length; })[0];
    function pick(items, title) {
      var all = items.filter(function (x) { var t = title(x).toLowerCase(); return words.length && words.every(function (w) { return t.indexOf(w.toLowerCase()) >= 0; }); });
      if (!all.length && long && long.length >= 3) all = items.filter(function (x) { return title(x).toLowerCase().indexOf(long.toLowerCase()) >= 0; });
      return all;
    }
    var g = pick(listedGuide(), function (p) { return p.title; }).map(function (p) { return glink(p) + ' <span class="muted">(Game Guide)</span>'; });
    var sgl = pick(siteGuide, function (p) { return p.title; }).map(function (p) { return glink(p) + ' <span class="muted">(Site Guide)</span>'; });
    var t = pick(topics, function (x) { return x; }).map(function (x) { return tlink(x) + ' <span class="muted">(Patch Notes topic)</span>'; });
    return g.concat(sgl, t).slice(0, 3);
  }
  /* a missing address inside a real category (#/guide/combat/x when "Combat" exists) offers that category */
  function categoryOffer(slug) {
    var parts = String(slug || "").replace(/^#?\/?(guide\/)?/i, "").split("/");
    if (parts.length < 2) return "";
    var first = parts[0].toLowerCase().replace(/[-_\s]+/g, " "), found = null;
    Object.keys(guideCategories()).forEach(function (c) { if (c.toLowerCase().replace(/[-_\s]+/g, " ") === first) found = c; });
    return found ? '<p>This address is inside the <a href="#/guide/category/' + enc(found) + '">' + esc(found) + "</a> category. You can browse the pages there.</p>" : "";
  }
  function notFoundLinks() {
    var n = listedGuide().length;
    return '<p class="muted">Or start from one of these</p><div class="nfboxes">' +
      '<a href="#/"><b>Main Page</b><span>Start here</span></a>' +
      '<a href="#/guide"><b>Game Guide</b><span>' + (guide ? plural(n, "page") : "Community-written pages") + "</span></a>" +
      '<a href="#/patchnotes"><b>Patch Notes</b><span>All topics and patches</span></a></div>';
  }
  function notFoundSearch(q) {
    return '<form class="nfsearch" id="nf-search" role="search"><input type="search" id="nf-q" value="' + esc(q) + '" aria-label="Search the wiki"><button type="submit" class="more">Search</button></form>';
  }
  function wireNotFound() {
    var f = document.getElementById("nf-search");
    if (f) f.addEventListener("submit", function (e) { e.preventDefault(); var q = document.getElementById("nf-q").value.trim(); if (q) location.hash = "#/search/" + encodeURIComponent(q); });
  }
  /* the body shared by every not-found page: what was asked for, the search box, similar names, the category offer and the link boxes. "extra" is added after the opening sentence */
  function notFoundBody(name, extra, offerFrom) {
    var isAddr = String(name || "").charAt(0) === "#", words = missingWords(name), sim = similarPages(words);
    var h = "<p>" + (isAddr ? "There is no page at <code>" + esc(name) + "</code>." : "There is no page called “" + esc(name || "") + "”.") + " It may have moved, or the link may be mistyped.</p>" + (extra || "");
    h += notFoundSearch(words.join(" "));
    if (sim.length) h += '<p class="muted">Pages with a similar name</p><ul>' + sim.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>";
    return h + categoryOffer(offerFrom || name) + notFoundLinks();
  }
  function notFound(name) {
    return { title: "Not found", html: page("Page not found", notFoundBody(name)), toc: false, after: wireNotFound };
  }

  /* ---------- behaviours ---------- */
  function wireFilter(itemSel, hideSel) {
    var box = document.getElementById("f"); if (!box) return;
    box.addEventListener("input", function () {
      var q = box.value.trim().toLowerCase();
      Array.prototype.forEach.call(app.querySelectorAll(itemSel), function (el) { el.hidden = !!q && el.textContent.toLowerCase().indexOf(q) < 0; });
      if (hideSel === ".letter") Array.prototype.forEach.call(app.querySelectorAll(".letter"), function (s) { s.hidden = !s.querySelector("li:not([hidden])"); });
    });
  }

  function updateSetting(key, value) {
    var st = loadSettings(); st[key] = value; saveSettings(st); applySettings(st);
  }
  /* Contents: a list-button beside the page title opens it as a pop-up, or it can be docked in the left column under the main menu */
  var tocSpy = [], tocTop = null;   /* [{el: heading, a: link in the list, li: its item, top: true for a main section}] */
  function buildToc() {
    buildFolds();
    var side = document.getElementById("side-toc"), list = document.getElementById("side-toc-list");
    tocSpy = []; tocTop = null; side.hidden = true; list.innerHTML = ""; setToc(false);
    document.documentElement.classList.remove("has-toc");
    var hs = app.querySelectorAll("h2.sec[data-toc], h3.sec[data-toc]");
    if (!hs.length) return;
    /* sections, each with its subsections folded behind an expander that the reader opens (it is never opened for them) */
    var items = [], meta = [];
    Array.prototype.forEach.call(hs, function (el) {
      var text = el.getAttribute("data-toc"), link = '<a href="' + pagePath() + '" data-scroll="' + el.id + '" title="' + esc(text) + '">' + esc(text) + "</a>";
      if (el.tagName === "H3" && items.length) { items[items.length - 1].subs.push(link); meta.push(false); }
      else { items.push({ text: text, link: link, subs: [] }); meta.push(true); }
    });
    var h = '<ol><li><a href="' + pagePath() + '" data-scroll="top">(Top)</a></li>' + items.map(function (it) {
      return it.subs.length ? '<li class="has-sub"><button type="button" class="exp" aria-expanded="false" aria-label="Show the subsections of ' + esc(it.text) + '"></button>' + it.link +
        "<ol>" + it.subs.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ol></li>" : "<li>" + it.link + "</li>";
    }).join("") + "</ol>";
    list.innerHTML = h; side.hidden = false; document.documentElement.classList.add("has-toc");
    if (!app.querySelector(".toc-btn")) {   /* the button sits in the article's left margin and follows the scroll, so Contents is always one click away */
      var anchor = document.createElement("div"), btn = document.createElement("button");
      anchor.className = "toc-anchor popup";
      btn.type = "button"; btn.className = "toc-btn"; btn.title = "Contents"; btn.setAttribute("aria-label", "Contents");
      btn.setAttribute("aria-controls", "side-toc"); btn.setAttribute("aria-expanded", "false"); btn.textContent = "☰";
      anchor.appendChild(btn); app.insertBefore(anchor, app.firstChild);
      var h1 = app.querySelector("h1.title"); if (h1) h1.classList.add("has-toc-btn");   /* leaves room for the button beside the title */
      syncTocBtn();
    }
    var links = list.querySelectorAll("a");
    Array.prototype.forEach.call(hs, function (el, k) { tocSpy.push({ el: el, a: links[k + 1], li: links[k + 1].parentNode, top: meta[k] }); });
    tocTop = links[0];
    spyToc();
  }
  /* Narrow screens: Contents is replaced by folding sections. Tapping a section heading opens its text, and its subsections fold inside it.
     Everything starts closed. On a wide screen the same markup is simply ignored. */
  var COMPACT_Q = "(max-width: 860px), (max-height: 500px) and (max-width: 1100px)";
  function isCompact() { return !!(window.matchMedia && window.matchMedia(COMPACT_Q).matches); }
  var folds = [];   /* [{h: heading, members: [elements it hides while closed], closed: true}] */
  function buildFolds() {
    folds = [];
    var hs = app.querySelectorAll("h2.sec[data-toc], h3.sec[data-toc]"), parents = [];
    Array.prototype.forEach.call(hs, function (h) { if (parents.indexOf(h.parentNode) < 0) parents.push(h.parentNode); });
    parents.forEach(function (par) {
      var cur2 = null, cur3 = null;
      Array.prototype.forEach.call(par.children, function (el) {
        if (el.matches("h2.sec[data-toc]")) { cur2 = { h: el, members: [], closed: true }; cur3 = null; folds.push(cur2); }
        else if (el.matches("h3.sec[data-toc]")) { cur3 = { h: el, members: [], closed: true }; folds.push(cur3); if (cur2) cur2.members.push(el); }
        else if (el.classList.contains("editline") || el.classList.contains("cats")) { cur2 = cur3 = null; }   /* the page's footer stays visible */
        else { if (cur3) cur3.members.push(el); if (cur2) cur2.members.push(el); }
      });
    });
    folds.forEach(function (f) {
      f.h.classList.add("foldable");
      f.members.forEach(function (el) { el.__fh = (el.__fh || 0) + 1; el.classList.add("fold-hide"); });
    });
    syncFoldMode();
  }
  function toggleFold(f, open) {
    if (open === undefined) open = f.closed;
    if (open !== f.closed) return;
    f.closed = !open;
    f.members.forEach(function (el) { el.__fh = (el.__fh || 0) + (open ? -1 : 1); el.classList.toggle("fold-hide", el.__fh > 0); });
    f.h.setAttribute("aria-expanded", open ? "true" : "false");
  }
  /* headings only behave like buttons while the screen is narrow */
  function syncFoldMode() {
    var on = isCompact();
    folds.forEach(function (f) {
      if (on) { f.h.setAttribute("role", "button"); f.h.tabIndex = 0; f.h.setAttribute("aria-expanded", f.closed ? "false" : "true"); }
      else { f.h.removeAttribute("role"); f.h.removeAttribute("tabindex"); f.h.removeAttribute("aria-expanded"); }
    });
  }
  if (window.matchMedia) { var fmq = window.matchMedia(COMPACT_Q); if (fmq.addEventListener) fmq.addEventListener("change", syncFoldMode); else if (fmq.addListener) fmq.addListener(syncFoldMode); }
  function foldFor(h) { for (var k = 0; k < folds.length; k++) if (folds[k].h === h) return folds[k]; return null; }
  /* open whatever is hiding an element, so a link into the page can show it */
  function revealFolds(el) { folds.forEach(function (f) { if (f.closed && (f.members.indexOf(el) >= 0)) toggleFold(f, true); }); }
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target : e.target.parentNode, h = t.closest("h2.foldable, h3.foldable");
    if (h && isCompact() && !t.closest("a")) { var f = foldFor(h); if (f) toggleFold(f); }
  });
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && isCompact() && e.target.classList && e.target.classList.contains("foldable")) { e.preventDefault(); var f = foldFor(e.target); if (f) toggleFold(f); }
  });
  /* highlight the section being read, and open its sub-list */
  function spyToc() {
    if (!tocSpy.length) return;
    var line = headOcc() + 24, cur = -1;
    tocSpy.forEach(function (t, k) { if (t.el.getBoundingClientRect().top <= line) cur = k; });
    var parent = null;
    if (cur >= 0) for (var k = cur; k >= 0; k--) if (tocSpy[k].top) { parent = tocSpy[k]; break; }
    if (tocTop) tocTop.classList.toggle("on", cur < 0);
    tocSpy.forEach(function (t, k) { t.a.classList.toggle("on", k === cur || (t === parent && tocSpy[cur] !== t && !t.li.classList.contains("open"))); });
  }
  /* A Contents list docked under the main menu is a box that sticks under the header once the menu has scrolled away. At the top of the page it starts below the menu, so it is
     only as tall as the room left in the window: otherwise its lower end is off the screen and its last entries could not be reached until the page was scrolled. */
  function fitTocRoom() {
    var box = document.getElementById("side-toc");
    if (!box) return;
    if (getComputedStyle(box).position !== "sticky" || box.hidden) {
      if (box.__roomSet) { box.style.maxHeight = ""; box.__roomSet = false; }
      return;
    }
    var room = window.innerHeight - Math.max(box.getBoundingClientRect().top, headOcc());
    box.style.maxHeight = Math.max(120, Math.floor(room)) + "px"; box.__roomSet = true;
  }
  window.addEventListener("resize", fitTocRoom);
  var spyBusy = false;
  window.addEventListener("scroll", function () { if (!spyBusy) { spyBusy = true; requestAnimationFrame(function () { spyBusy = false; spyToc(); fitTocRoom(); }); } }, { passive: true });
  /* the button sits beside the title; once the page scrolls past that spot it floats at the top left. The pop-up stays anchored under it */
  function syncTocBtn() {
    var a = document.querySelector(".toc-anchor"), b = document.querySelector(".toc-btn");
    if (!a || !b) return;
    if (getComputedStyle(a).display === "none") { b.classList.remove("floating"); b.style.left = ""; return; }   /* hidden (docked or narrow): nothing to measure */
    var fl = a.getBoundingClientRect().top <= headOcc() + 11;
    b.classList.toggle("floating", fl);
    b.style.left = fl ? (document.getElementById("rail").getBoundingClientRect().width + 8) + "px" : "";   /* clear of a docked main menu */
  }
  function placeToc() {
    var panel = document.getElementById("side-toc"), btn = document.querySelector(".toc-btn");
    var r = btn ? btn.getBoundingClientRect() : { left: 8, bottom: 0 }, top = Math.max(r.bottom + 6, headOcc() + 6);
    panel.style.top = top + "px"; panel.style.left = Math.max(8, r.left) + "px"; panel.style.maxHeight = "min(50vh, calc(100vh - " + (top + 12) + "px))";   /* at most half the window, so most of the article stays in view; a longer list scrolls inside */
  }
  function followToc() { syncTocBtn(); if (document.body.classList.contains("toc-open")) placeToc(); }
  window.addEventListener("scroll", followToc, { passive: true });
  window.addEventListener("resize", followToc);
  /* the pop-up version: opens under the button, and closes like the menu and Settings do */
  function setToc(on) {
    var panel = document.getElementById("side-toc"), btn = document.querySelector(".toc-btn");
    if (on) { setMenu(false); if (typeof settingsPanel !== "undefined" && settingsPanel) settingsPanel.close(false); placeToc(); }
    else { panel.style.top = panel.style.left = panel.style.maxHeight = ""; }
    document.body.classList.toggle("toc-open", on);
    if (btn) btn.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) scrollTocToCurrent();
  }
  /* The pop-up Contents opens already scrolled to the entry the reader is on (a third of the way down its box), then leaves the list alone. A list that fits needs no scrolling. */
  function scrollTocToCurrent() {
    var box = document.getElementById("side-toc"), cur = box.querySelector("a.on");
    if (!cur || box.scrollHeight <= box.clientHeight) return;
    spyToc();
    cur = box.querySelector("a.on") || cur;
    var y = cur.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    box.scrollTop = Math.max(0, Math.round(y - box.clientHeight / 3));
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target : e.target.parentNode;
    var x = t.closest(".exp");
    if (x) { var open = !x.parentNode.classList.contains("open"); x.parentNode.classList.toggle("open", open); x.setAttribute("aria-expanded", open ? "true" : "false"); spyToc(); return; }
    if (t.closest(".toc-btn")) setToc(!document.body.classList.contains("toc-open"));
    else if (document.body.classList.contains("toc-open") && !t.closest("#side-toc")) setToc(false);
    var d = t.closest("[data-dock]");
    if (d && !editorOn) {
      var k = d.getAttribute("data-dock");
      updateSetting(k, loadSettings()[k] === "sidebar" ? "popover" : "sidebar"); setMenu(false); setToc(false); settingsPanel.close(false);
    }
  });

  /* spoilers: show or hide the masked text */
  function toggleSpoiler(el) { var on = !el.classList.contains("shown"); el.classList.toggle("shown", on); el.setAttribute("aria-expanded", on ? "true" : "false"); el.title = on ? "Click to hide again" : "Spoiler: click to show"; }
  document.addEventListener("click", function (e) {
    var sp = e.target.closest && e.target.closest(".spoiler");
    if (!sp) return;
    if (!sp.classList.contains("shown")) e.preventDefault();   /* the first click only reveals; it does not follow a link inside */
    toggleSpoiler(sp);
  });
  document.addEventListener("keydown", function (e) {
    var sp = e.target.classList && e.target.classList.contains("spoiler") ? e.target : null;
    if (sp && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggleSpoiler(sp); }
  });

  /* Pictures in a page: a click opens the picture on top of the page, fitted to the window, as one of a carousel of every picture on the page.
     Next and previous buttons, the arrow keys or a swipe move through them; a click on the picture zooms in and another zooms out.
     A click on the dark area, the close button or {{Esc}} closes it. A picture can also be reached with {{Tab}} and opened with {{Enter}} or {{Space}}. */
  var lightbox = (function () {
    var box = null, fig, shot, cap, count, prevBtn, nextBtn, closeBtn, from = null, list = [], at = 0, zoomed = false;
    function build() {
      box = document.createElement("div");
      box.id = "lightbox"; box.hidden = true; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Pictures on this page");
      box.innerHTML = '<button type="button" class="lb-close" aria-label="Close picture">×</button>' +
        '<span class="lb-count" aria-live="polite"></span>' +
        '<button type="button" class="lb-nav lb-prev" aria-label="Previous picture">‹</button><button type="button" class="lb-nav lb-next" aria-label="Next picture">›</button>' +
        '<figure><img alt="" tabindex="0" role="button"><figcaption></figcaption></figure>';
      fig = box.querySelector("figure"); shot = box.querySelector("img"); cap = box.querySelector("figcaption"); count = box.querySelector(".lb-count");
      closeBtn = box.querySelector(".lb-close"); prevBtn = box.querySelector(".lb-prev"); nextBtn = box.querySelector(".lb-next");
      box.addEventListener("click", function (e) { if (e.target === shot) setZoom(!zoomed, e); else if (!e.target.closest(".lb-nav, .lb-close")) close(); });
      closeBtn.addEventListener("click", close);
      prevBtn.addEventListener("click", function () { go(-1); });
      nextBtn.addEventListener("click", function () { go(1); });
      /* a swipe moves to the next or previous picture while the picture is not zoomed */
      var sx = null, sy = null;
      box.addEventListener("touchstart", function (e) { sx = zoomed || e.touches.length !== 1 ? null : e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      box.addEventListener("touchend", function (e) {
        if (sx === null) return;
        var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
      }, { passive: true });
      document.body.appendChild(box);
    }
    function label() { shot.setAttribute("aria-label", (zoomed ? "Zoom out" : "Zoom in") + ": " + (shot.alt || "picture")); }
    /* zoom in to the picture's own size, or to nearly twice the fitted size if that is larger, keeping the point that was clicked under the pointer */
    function setZoom(on, e) {
      if (on === zoomed) return;
      var r = shot.getBoundingClientRect(),
          px = e && e.clientX !== undefined ? (e.clientX - r.left) / r.width : .5, py = e && e.clientX !== undefined ? (e.clientY - r.top) / r.height : .5,
          cx = e && e.clientX !== undefined ? e.clientX : window.innerWidth / 2, cy = e && e.clientX !== undefined ? e.clientY : window.innerHeight / 2;
      if (on) {
        var w = Math.min(Math.max(shot.naturalWidth, r.width * 1.8), 6000);
        fig.style.setProperty("--lb-w", w + "px"); box.classList.add("lb-zoomed");
        var n = shot.getBoundingClientRect();
        box.scrollLeft += (n.left + px * n.width) - cx; box.scrollTop += (n.top + py * n.height) - cy;
      } else {
        box.classList.remove("lb-zoomed"); fig.style.removeProperty("--lb-w"); box.scrollLeft = 0; box.scrollTop = 0;
      }
      zoomed = on; label();
    }
    /* show picture number i of the page */
    function show(i) {
      var img = list[i], f = img.closest("figure"), text = f && f.querySelector("figcaption") ? f.querySelector("figcaption").textContent : img.alt;
      at = i; zoomed = false; box.classList.remove("lb-zoomed"); fig.style.removeProperty("--lb-w"); box.scrollLeft = 0; box.scrollTop = 0;
      shot.src = img.currentSrc || img.src; shot.alt = img.alt; label();
      cap.textContent = text || ""; cap.hidden = !text;
      count.textContent = list.length > 1 ? (i + 1) + " of " + list.length : "";
      prevBtn.hidden = nextBtn.hidden = list.length < 2;
      from = img;
    }
    function go(step) { if (list.length > 1) show((at + step + list.length) % list.length); }
    function open(img) {
      if (!box) build();
      if (img.complete && !img.naturalWidth) return;   /* broken: nothing to enlarge */
      list = Array.prototype.filter.call(app.querySelectorAll("img[data-lb]"), function (x) { return !(x.complete && !x.naturalWidth); });
      var i = list.indexOf(img); if (i < 0) return;
      show(i); box.hidden = false; document.body.classList.add("lb-open"); closeBtn.focus();
    }
    function close() {
      if (!box || box.hidden) return;
      box.hidden = true; document.body.classList.remove("lb-open"); shot.removeAttribute("src"); zoomed = false;
      if (from && document.body.contains(from)) from.focus();
      from = null; list = [];
    }
    function isOpen() { return !!box && !box.hidden; }
    /* make the pictures of the page reachable from the keyboard */
    function enhance() {
      Array.prototype.forEach.call(app.querySelectorAll("img"), function (img) {
        if (img.closest("a") || img.getAttribute("data-lb") || img.getAttribute("data-missing")) return;   /* a picture that is a link keeps doing that; a placeholder has nothing to enlarge */
        img.setAttribute("data-lb", "1"); img.tabIndex = 0; img.setAttribute("role", "button");
        img.setAttribute("aria-label", "Show picture full size: " + (img.alt || "no description"));
      });
    }
    document.addEventListener("click", function (e) {
      var img = e.target.closest && e.target.closest("#app img[data-lb]");
      if (img) { e.preventDefault(); open(img); }
    });
    document.addEventListener("keydown", function (e) {
      if (isOpen()) {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
        else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
        else if (e.key === "Tab") {   /* focus stays inside the viewer */
          e.preventDefault();
          var order = [closeBtn, prevBtn, nextBtn, shot].filter(function (b) { return !b.hidden; }), k = order.indexOf(document.activeElement);
          order[(k + (e.shiftKey ? -1 : 1) + order.length) % order.length].focus();
        }
        else if ((e.key === "Enter" || e.key === " ") && document.activeElement === shot) { e.preventDefault(); setZoom(!zoomed); }
        return;
      }
      if ((e.key === "Enter" || e.key === " ") && e.target.getAttribute && e.target.getAttribute("data-lb")) { e.preventDefault(); open(e.target); }
    }, true);
    new MutationObserver(enhance).observe(app, { childList: true, subtree: true });
    return { close: close, isOpen: isOpen };
  })();
  window.addEventListener("hashchange", function () { lightbox.close(); });

  /* A picture whose file is missing shows "No picture yet" instead of the browser's broken-picture icon. The page check still reports the missing file as an error,
     so this is only the last guard (a renamed file, a typo). On a writer's own computer (localhost) the placeholder is outlined and names the path that failed. */
  var PLACEHOLDER = "placeholder.svg", DEV_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === "file:";
  document.addEventListener("error", function (e) {
    var img = e.target;
    if (!img || img.tagName !== "IMG" || !app.contains(img) || img.getAttribute("data-missing")) return;
    var path = img.getAttribute("src") || "";
    img.setAttribute("data-missing", path);
    img.removeAttribute("data-lb"); img.removeAttribute("role"); img.removeAttribute("aria-label"); img.removeAttribute("tabindex");
    img.removeAttribute("srcset");
    img.src = PLACEHOLDER;
    var inl = !img.closest("figure") && !img.classList.contains("ib-img") && img.parentNode.textContent.trim() !== "";   /* a small picture in the middle of a sentence */
    if (inl) img.classList.add("img-missing-inline");
    img.title = "No picture yet";
    if (DEV_HOST && img.parentNode) {   /* a hint for the writer, never shown on the published site */
      var wrap = document.createElement("span"), shown = "Missing: " + path.replace(/^(guide|site)\//, "");
      wrap.className = "img-dev" + (inl ? " inline" : "");
      img.parentNode.insertBefore(wrap, img); wrap.appendChild(img);
      if (inl) img.title = shown;
      else { var note = document.createElement("small"); note.textContent = shown; wrap.appendChild(note); }
    }
  }, true);

  /* the Copy button on code blocks */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".codecopy");
    if (!b) return;
    var text = b.closest(".codebox").querySelector("pre").textContent;
    function done(ok) { b.textContent = ok ? "Copied" : "Copy failed"; clearTimeout(b.__t); b.__t = setTimeout(function () { b.textContent = "Copy"; }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    else {
      var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (err) {} ta.remove(); done(ok);
    }
  });

  /* A section's address is the page's address plus a second hash and the heading's id, for example #/guide/controls#s-mouse (the first hash belongs to the router).
     Choosing a Contents entry or a heading link puts it in the address bar without adding a history entry, so the address can be copied; opening such an address scrolls to the section. */
  function pagePath() { var h = location.hash, i = h.indexOf("#", 1); return i > 0 ? h.slice(0, i) : h; }
  function sectionOf() {
    var h = location.hash, i = h.indexOf("#", 1); if (i < 0) return "";
    try { return decodeURIComponent(h.slice(i + 1)); } catch (e) { return h.slice(i + 1); }
  }
  function markSection(id) {
    try { history.replaceState(history.state, "", location.pathname + location.search + pagePath() + (id && id !== "top" ? "#" + encodeURIComponent(id) : "")); } catch (e) {}
  }
  function copyText(text, done) {
    function legacy() {
      var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (err) {} ta.remove(); done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, legacy);
    else legacy();
  }
  /* jump: arriving at a section address, so no smooth scroll and the address stays as it is */
  function scrollTo(id, jump) {
    if (id === "top") { if (!jump) markSection(""); window.scrollTo({ top: 0, behavior: jump ? "auto" : "smooth" }); return true; }
    var el = document.getElementById(id);
    if (el && isCompact()) { revealFolds(el); var fo = foldFor(el); if (fo) toggleFold(fo, true); }
    var old = document.querySelector(".fnhit"); if (old) old.classList.remove("fnhit");   /* a footnote or the reference it belongs to stays shaded until the next jump (CSS :target cannot be used: the address's # names the page) */
    if (el && /^fn(ref)?-/.test(id)) (el.closest("sup") || el).classList.add("fnhit");
    if (el) { if (!jump) markSection(id); el.scrollIntoView({ behavior: jump ? "auto" : "smooth", block: "start" }); }
    return !!el;
  }
  /* Scrolling past the end: on a wide screen the page gets just enough empty space after the article that, scrolled to the very end, its last heading sits at the top of the window
     (where a heading link lands), with the footer right under the article and the space below the footer. That lets the Contents list reach and highlight the last short sections. No space on a narrow screen, on a page with no headings, on a page
     that fits the window, or when the last section is already taller than the window. */
  var endpad = document.getElementById("endpad"), endpadQueued = false;
  function fitEndPad() {
    var last = null, hs = app.querySelectorAll(".sec[id]");
    if (hs.length) last = hs[hs.length - 1];
    var foot = document.getElementById("foot"), now = endpad.offsetHeight, need = 0;
    document.documentElement.style.setProperty("--foot-h", foot.offsetHeight + "px");   /* the footer's own height: it sticks where its top is a footer's height above the window's bottom */
    if (last && !isCompact() && document.documentElement.scrollHeight - now > window.innerHeight) {
      var tail = foot.getBoundingClientRect().bottom - last.getBoundingClientRect().top;   /* the space comes after the footer, so the footer is seen as soon as the article ends */
      var line = window.innerHeight - (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0);   /* the same offset a heading link scrolls to */
      need = Math.max(0, Math.ceil(line - tail));
    }
    if (need !== now) endpad.style.height = need + "px";
  }
  function queueEndPad() { if (endpadQueued) return; endpadQueued = true; requestAnimationFrame(function () { endpadQueued = false; fitEndPad(); }); }
  window.addEventListener("resize", queueEndPad);
  if (window.ResizeObserver) new ResizeObserver(queueEndPad).observe(app);   /* pictures loading, a changed text size, a guide page drawing */
  var pendingSection = "";   /* a section named by the address, waiting for the page (a guide page draws after its text arrives) */
  function jumpPending() { if (pendingSection && scrollTo(pendingSection, true)) pendingSection = ""; }
  /* a small link in the left margin of each section heading that copies the address of that section. It is a drawn icon, not an emoji, so its color can change
     (an emoji keeps its own colors on many devices). The shape follows the RuneScape Wiki's link icon. */
  var LINK_ICON = '<svg viewBox="0 0 150 150" fill="currentColor" aria-hidden="true"><path d="M95.3,54.7c3.7,3.7,6.5,7.9,8.3,12.4L90.9,79.9c-0.5-5.1-2.7-10-6.7-14c-9.4-9.4-24.2-8.8-33.9,0.4L23.2,93.3c-9.6,9.6-10.4,24.7-0.8,34.3s24.7,8.8,34.3-0.8l11.2-11.2c6.4,1.6,13.5,2.4,20.7,1.6l-20.7,20.7c-15.9,15.9-41.4,15.9-56.6,0.8c-15.1-15.1-15.1-40.6,0.8-56.6c0,0,26.2-26.1,27.1-27.1C54.5,39.8,80.6,39.9,95.3,54.7z"/><path d="M54.7,95.3c-3.7-3.7-6.5-7.9-8.3-12.4l12.7-12.7c0.5,5.1,2.7,10,6.7,14c9.4,9.4,24.2,8.8,33.9-0.4l27.1-27.1c9.6-9.6,10.4-24.7,0.8-34.3s-24.7-8.8-34.3,0.8L82.2,34.4c-6.4-1.6-13.5-2.4-20.7-1.6l20.7-20.7c15.9-15.9,41.4-15.9,56.6-0.8c15.1,15.1,15.1,40.6-0.8,56.6c0,0-26.2,26.1-27.1,27.1C95.5,110.2,69.4,110.1,54.7,95.3z"/></svg>';
  function addHeadingLinks() {
    Array.prototype.forEach.call(app.querySelectorAll("h2.sec[id], h3.sec[id]"), function (h) {
      if (h.querySelector(".hlink")) return;
      var a = document.createElement("a");
      a.className = "hlink popup"; a.href = pagePath() + "#" + encodeURIComponent(h.id); a.textContent = "#";
      a.setAttribute("aria-label", "Copy the link to this section"); a.title = "Copy the link to this section";
      h.insertBefore(a, h.firstChild);
    });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".hlink");
    if (!a) return;
    e.preventDefault();
    var id = a.parentNode.id; markSection(id);
    copyText(location.origin + location.pathname + location.search + pagePath() + "#" + encodeURIComponent(id), function (ok) {
      a.title = ok ? "Link copied" : "Could not copy; the link is in the address bar"; a.classList.remove("on", "bad"); a.classList.add(ok ? "on" : "bad"); clearTimeout(a.__t);
      a.__t = setTimeout(function () { a.classList.remove("on", "bad"); a.title = "Copy the link to this section"; }, 1600);
    });
  });
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-scroll]");
    if (a) { e.preventDefault(); scrollTo(a.getAttribute("data-scroll")); if (a.closest("#side")) setMenu(false); }
    if (document.body.classList.contains("menu-open") && !e.target.closest("#side") && !e.target.closest("#menu")) setMenu(false);
  });

  function setMenu(on) {
    if (on && typeof settingsPanel !== "undefined" && settingsPanel) settingsPanel.close(false);
    if (on) { setToc(false); syncAnchors(); }
    document.body.classList.toggle("menu-open", on); document.getElementById("menu").setAttribute("aria-expanded", on ? "true" : "false"); }
  document.getElementById("menu").addEventListener("click", function () { setMenu(!document.body.classList.contains("menu-open")); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.body.classList.contains("menu-open")) { setMenu(false); document.getElementById("menu").focus(); }
    if (e.key === "Escape" && document.body.classList.contains("toc-open")) { var tb = document.querySelector(".toc-btn"); setToc(false); if (tb) tb.focus(); }
  });

    fetch("guide/index.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(guideLoaded)
    .catch(function () { guideFailed = true; guideLoaded([]); })
    .then(function () {
      return fetch("site/index.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(siteLoaded).catch(function () { siteLoaded([]); });
    })
    .then(function () {
      return fetch("credits.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) { credits = j; }).catch(function () { credits = { groups: [] }; });
    })
    .then(function () {
      return fetch("tools.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) { toolList = j; }).catch(function () { toolList = []; });
    })
    .then(function () { if (/^#\/(guide|site|search|about|tools|glossary)?(\/|$)/.test(location.hash) || location.hash === "" || location.hash === "#") route(); });
  document.getElementById("foot-stats").textContent = D.totals.rows.toLocaleString() + " changes · " + topics.length + " topics · " + allVersions.length + " patches · latest " + versions[0] + " (" + dateOf(versions[0]) + ")";

  /* search box with suggestions */
  var q = document.getElementById("q"), sug = document.getElementById("suggest"), cur = -1;
  function suggestions() {
    var v = q.value.trim().toLowerCase();
    if (!v) { sug.hidden = true; return; }
    var pre = [], mid = [];
    topics.forEach(function (t) { var i = t.toLowerCase().indexOf(v); if (i === 0) pre.push(t); else if (i > 0) mid.push(t); });
    var list = pre.concat(mid).slice(0, 8);
    function titled(p) { return p.title.toLowerCase().indexOf(v) >= 0; }
    var gl = (guide || []).filter(titled).slice(0, 4).concat(siteGuide.filter(titled).slice(0, 2));
    sug.innerHTML = gl.map(function (p) { return '<li><a href="' + purl(p) + '">' + esc(p.title) + "<small>" + (p.area === "site" ? "site guide" : "guide") + "</small></a></li>"; }).join("") + list.map(function (t) { return '<li><a href="#/topic/' + enc(t) + '">' + esc(t) + "<small>" + plural(byTopic[t].length, "change") + "</small></a></li>"; }).join("") +
      '<li><a href="#/search/' + enc(q.value.trim()) + '">Search for “' + esc(q.value.trim()) + "”<small>full text</small></a></li>";
    sug.hidden = false; cur = -1;
  }
  q.addEventListener("input", suggestions);
  q.addEventListener("keydown", function (e) {
    var items = sug.querySelectorAll("a");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); if (!items.length) return;
      if (cur >= 0) items[cur].classList.remove("cur");
      cur = (cur + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items[cur].classList.add("cur");
    } else if (e.key === "Escape") { sug.hidden = true; }
  });
  document.getElementById("search").addEventListener("submit", function (e) {
    e.preventDefault();
    var items = sug.querySelectorAll("a"), v = q.value.trim();
    if (cur >= 0 && items[cur]) location.hash = items[cur].getAttribute("href");
    else if (v) { var exact = topics.filter(function (t) { return t.toLowerCase() === v.toLowerCase(); })[0]; location.hash = exact ? "#/topic/" + enc(exact) : "#/search/" + enc(v); }
    sug.hidden = true; q.blur();
  });
  document.addEventListener("click", function (e) { if (!e.target.closest("#search")) sug.hidden = true; });

  /* ---------- settings panel (slides in from the right) ---------- */
  var settingsPanel = (function () {
    var panel = document.getElementById("settings-panel"), body = document.getElementById("settings-body"),
        gear = document.getElementById("gear"), st = loadSettings(), warned = false;
    var GROUPS = [
      { key: "skin", legend: "Theme", grid: true,
        labels: ["Default", "Oblivion", "Iliac Bay", "Town Crier", "Phosphor", "Cassette"], swatches: [["#ffffff", "#1b1f24", "#8a5a1a"], ["#f0e3c2", "#1a1415", "#d4452a"], ["#f4f7f4", "#0e2530", "#d6a43a"], ["#efe9da", "#171717", "#8a1c1c"], ["#1a2a1e", "#0a0f0b", "#3cff6a"], ["#efeadb", "#1d1f21", "#ff6a1f"]] },   /* [light page, dark page, logo color, optional ring]: the left half of each dot is the theme in light, the right half in dark, and the center is its logo */
      { key: "phosphor", legend: "Color", grid: true,
        labels: ["Capital Wastes", "Mojave", "Anchorage", "White"], swatches: [["#1a2a1e", "#0a0f0b", "#3cff6a"], ["#2a1d0a", "#0c0802", "#ffb000"], ["#0f2036", "#04080f", "#4da6ff"], ["#2a2a2a", "#0a0a0a", "#ffffff"]] },
      { key: "palette", legend: "Color", grid: true,
        labels: ["Gold", "Parchment", "Slate", "Moss", "Dusk", "Terracotta", "Graphite"], swatches: [["#ffffff", "#1b1f24", "#8a5a1a"], ["#f8f1de", "#211a12", "#8a2f0c"], ["#f7f9fb", "#151d27", "#2f5d8a"], ["#f6f8f2", "#161e17", "#3a6b3f"], ["#f8f6fb", "#1b1724", "#6a3f8f"], ["#fbf7f3", "#201713", "#a8472a"], ["#ffffff", "#161616", "#3a3a3a"]] },
      { key: "theme", legend: "Mode", labels: ["Auto", "Light", "Dark"] },
      { key: "size", legend: "Text size", help: "Scales all text and spacing.", labels: ["Small", "Medium", "Large"] },
      { key: "width", legend: "Page width", help: "Standard keeps lines comfortable to read; Wide uses the whole window.", labels: ["Standard", "Wide"] },
      { key: "navbar", legend: "Top bar", help: "Stays visible keeps the top bar on screen while you scroll. Scrolls away lets it move off the screen, so the page has more room.", labels: ["Stays visible", "Scrolls away"] },
      { key: "previews", legend: "Link previews", help: "A short preview appears when you point at a link to a page or topic. Not shown on touch screens.", labels: ["On", "Off"] }
    ];
    body.innerHTML = GROUPS.map(function (g) {
      return '<fieldset class="setting"><legend>' + g.legend + "</legend>" + (g.help ? "<p class='muted'>" + g.help + "</p>" : "") + '<div class="seg' + (g.grid ? " grid" : "") + '">' +
        SETTING_OPTIONS[g.key].map(function (v, i) { return '<label><input type="radio" name="' + g.key + '" value="' + v + '"><span>' + (g.swatches && (g.key === "phosphor" || v === "phosphor") ? '<i class="dot crt" style="--c:' + g.swatches[i][2] + '"></i>' : g.swatches && v === "cassette" ? '<i class="dot cassette" style="--c:' + g.swatches[i][2] + '"></i>' : g.swatches && v === "crier" ? '<i class="dot news"></i>' : g.swatches ? '<i class="dot" style="background:radial-gradient(circle,' + g.swatches[i][2] + " 0 30%," + (g.swatches[i][3] ? g.swatches[i][3] + " 34% 46%," : "") + 'transparent ' + (g.swatches[i][3] ? "50%" : "34%") + '),linear-gradient(135deg,' + g.swatches[i][0] + " 50%," + g.swatches[i][1] + ' 50%)"></i>' : "") + g.labels[i] + "</span></label>"; }).join("") +
        "</div></fieldset>";
    }).join("") + '<p><button class="more" id="reset-settings" type="button">Reset to defaults</button></p>' +
      '<p class="muted" id="settings-note">Saved in this browser only, so your choices do not follow you to another browser or device, and clearing your browser’s site data resets them. Nothing is sent anywhere.</p>';
    var inputs = body.querySelectorAll("input");
    var paletteSet = body.querySelector('input[name="palette"]').closest("fieldset"), phosphorSet = body.querySelector('input[name="phosphor"]').closest("fieldset"), modeSet = body.querySelector('input[name="theme"]').closest("fieldset"), modeNote = document.createElement("p");
    modeNote.className = "muted"; modeNote.textContent = "Phosphor is always dark."; modeNote.hidden = true;   /* the Mode group has no description, only this note while Phosphor locks it */
    modeSet.insertBefore(modeNote, modeSet.querySelector(".seg"));
    function sync() {
      var dark = st.skin === "phosphor";   /* Phosphor is always dark, so the Mode choice is locked while it is picked */
      Array.prototype.forEach.call(inputs, function (i) { i.checked = st[i.name] === i.value; if (i.name === "theme") i.disabled = dark; });
      modeNote.hidden = !dark;
      paletteSet.hidden = st.skin !== "default";   /* the palettes are for the Default theme only */
      phosphorSet.hidden = !dark;   /* the screen colors only matter for Phosphor */
    }
    function change(next) {
      st = next; applySettings(st); syncHeadH(); sync();
      if (!saveSettings(st) && !warned) {
        warned = true;
        var note = document.getElementById("settings-note");
        note.innerHTML = "<b>Your browser is blocking storage</b>, so these choices will reset when you leave this page. " + note.innerHTML;
      }
    }
    Array.prototype.forEach.call(inputs, function (i) {
      i.addEventListener("change", function () { var n = loadSettings(); n[i.name] = i.value; change(n); });   /* start from what is saved: docking and the dock buttons change settings outside this panel */
    });
    document.getElementById("reset-settings").addEventListener("click", function () { change(JSON.parse(JSON.stringify(SETTING_DEFAULTS))); });
    function isOpen() { return document.body.classList.contains("settings-open"); }
    function open() {
      st = loadSettings(); sync(); syncAnchors();
      document.body.classList.remove("menu-open"); setToc(false);
      document.body.classList.add("settings-open");
      gear.setAttribute("aria-expanded", "true"); panel.setAttribute("aria-hidden", "false");
      var first = body.querySelector("input:checked"); if (first) first.focus();
    }
    function close(returnFocus) {
      document.body.classList.remove("settings-open");
      gear.setAttribute("aria-expanded", "false"); panel.setAttribute("aria-hidden", "true");
      if (returnFocus) gear.focus();
    }
    function docked() { return document.documentElement.getAttribute("data-panel") === "sidebar" && window.matchMedia("(min-width: 1101px)").matches; }
    gear.addEventListener("click", function () { if (isOpen()) close(true); else open(); });
    document.addEventListener("click", function (e) {
      if (isOpen() && !docked() && !e.target.closest("#settings-panel") && !e.target.closest("#gear")) close(false);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen()) close(true); });
    sync();
    return { open: open, close: close };
  })();

  /* ---------- link previews: point at (or tab to) an internal link in the article for a short summary ---------- */
  var previews = (function () {
    var box = document.createElement("div"), timer = null, shownFor = null;
    box.id = "preview"; box.setAttribute("role", "tooltip"); box.hidden = true;
    document.body.appendChild(box);
    var canHover = window.matchMedia ? window.matchMedia("(hover: hover) and (pointer: fine)") : { matches: true };
    function enabled() { return document.documentElement.getAttribute("data-previews") !== "off" && canHover.matches; }
    function clip(text, n) {
      text = String(text || "").replace(/\s+/g, " ").trim();
      if (text.length <= n) return text;
      var cut = text.slice(0, n), dot = cut.lastIndexOf(". ");
      return dot > n * 0.5 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, "") + "…";
    }
    function content(href) {
      var m = /^#\/(topic|guide|site|patch|hub)\/(.+)$/.exec(href), arg;
      if (!m) return null;
      try { arg = decodeURIComponent(m[2]); } catch (e) { arg = m[2]; }
      if (m[1] === "topic") {
        var ts = D.tstat[arg]; if (!ts) return null;
        return { kind: "Patch Notes topic", title: arg,
          text: D.desc && D.desc[arg] ? clip(D.desc[arg], 280) : "A topic with " + plural(ts[0], "recorded change") + ".",
          meta: plural(ts[0], "change") + " · last patched " + ts[1] + " (" + dateOf(ts[1]) + ")" };
      }
      if (m[1] === "patch") {
        var rel = D.releases[arg]; if (!rel) return null;
        var pl = byVersion[arg];
        if (!pl) return { kind: "Patch", title: "Patch " + arg, text: (rel.t ? rel.t + ". " : "") + plural(rel.c, "change") + " recorded.",
          meta: "Released " + dateOf(arg) + (rel.prs.length ? " · " + plural(rel.prs.length, "pull request") : "") };   /* its shard is not loaded yet */
        var per = group(pl, "e"), names = Object.keys(per).sort(function (a, b) { return per[b].length - per[a].length || a.localeCompare(b); });
        return { kind: "Patch", title: "Patch " + arg, text: plural(pl.length, "change") + " to " + plural(names.length, "topic") + ":",
          items: names.slice(0, 10).map(function (t) { return [t, per[t].length]; }), more: Math.max(0, names.length - 10),
          meta: "Released " + dateOf(arg) + (rel && rel.prs.length ? " · " + plural(rel.prs.length, "pull request") : "") };
      }
      if (m[1] === "hub") {
        var ht = hubs[arg]; if (!ht) return null;
        return { kind: "Patch Notes area", title: arg, text: clip(ht.slice(0, 8).join(", ") + (ht.length > 8 ? ", …" : ""), 200), meta: plural(ht.length, "topic") };
      }
      if (m[1] === "site") {
        var sg = siteBySlug[arg.toLowerCase()] || siteByTitle[arg.toLowerCase()];
        return sg ? { kind: "Site Guide", title: sg.title, text: sg.summary || clip(sg.text, 200), meta: "" } : null;
      }
      if (arg.indexOf("category/") === 0) {
        var cat = arg.slice(9), n = listedGuide().filter(function (g) { return g.category === cat; }).length;
        return n ? { kind: "Game Guide category", title: cat, text: "", meta: plural(n, "page") } : null;
      }
      var g = guideBySlug[arg.toLowerCase()] || guideByTitle[arg.toLowerCase()];
      return g ? { kind: "Game Guide · " + g.category, title: g.title, text: g.summary || clip(g.text, 200), meta: "" } : null;
    }
    function hide() {
      clearTimeout(timer); box.hidden = true;
      if (shownFor) { shownFor.removeAttribute("aria-describedby"); shownFor = null; }
    }
    function show(a, ev) {
      var c = content(a.getAttribute("href"));
      if (!c || !enabled()) return;
      box.innerHTML = '<div class="pk">' + esc(c.kind) + '</div><div class="pt">' + esc(c.title) + "</div>" +
        (c.text ? "<div>" + esc(c.text) + "</div>" : "") +
        (c.items ? '<ul class="pl">' + c.items.map(function (i) { return "<li><span>" + esc(i[0]) + '</span><b>' + i[1] + "</b></li>"; }).join("") + "</ul>" +
          (c.more ? '<div class="pm">and ' + plural(c.more, "more topic") + "</div>" : "") : "") + (c.meta ? '<div class="pm">' + esc(c.meta) + "</div>" : "");
      box.hidden = false; a.setAttribute("aria-describedby", "preview"); shownFor = a;
      var rects = a.getClientRects(), r = rects[0];
      if (ev && ev.clientY != null) Array.prototype.forEach.call(rects, function (x) { if (ev.clientY >= x.top && ev.clientY <= x.bottom) r = x; });
      var bw = box.offsetWidth, bh = box.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
      var left = Math.max(8, Math.min(r.left, vw - bw - 8));
      var top = r.bottom + 6; if (top + bh > vh - 8 && r.top - bh - 6 > 8) top = r.top - bh - 6;
      box.style.left = left + "px"; box.style.top = Math.max(8, top) + "px";
    }
    function target(e) {
      var a = e.target.closest && e.target.closest("#app a[href^='#/']");
      if (!a || a.classList.contains("missing") || a.hasAttribute("data-scroll") || a.getAttribute("href") === pagePath()) return null;
      return a;
    }
    document.addEventListener("mouseover", function (e) {
      var a = target(e); if (!a || a === shownFor) return;
      hide(); timer = setTimeout(function () { show(a, e); }, 350);
    });
    document.addEventListener("mouseout", function (e) { if (target(e)) hide(); });
    document.addEventListener("focusin", function (e) { var a = target(e); if (a) { hide(); show(a); } });
    document.addEventListener("focusout", function (e) { if (target(e)) hide(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
    document.addEventListener("click", hide);
    window.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("hashchange", hide);
    return { hide: hide };
  })();

  /* highlight the first of these sidebar entries that exists (the exact page, then its breadcrumb parent) */
  function setNav(keys) {
    var links = document.querySelectorAll("[data-nav]"), pick = null;
    keys.some(function (k) { return Array.prototype.some.call(links, function (a) { if (a.getAttribute("data-nav") === k) { pick = k; return true; } return false; }); });
    Array.prototype.forEach.call(links, function (a) { a.classList.toggle("on", a.getAttribute("data-nav") === pick); });
    /* while a Patch Notes page is open, its lists are shown under the Patch Notes link; the one being read is marked */
    var sub = document.getElementById("pn-sub");
    if (sub) {
      sub.hidden = pick !== "patchnotes";
      var path = location.hash.split("?")[0], map = { "#/hub": "#/hubs", "#/patch": "#/patches" };
      Array.prototype.forEach.call(sub.querySelectorAll("a"), function (a) {
        var h = a.getAttribute("href"), hit = path === h || Object.keys(map).some(function (k) { return map[k] === h && (path === k || path.indexOf(k + "/") === 0); });
        a.classList.toggle("on", hit);
      });
    }
  }

  /* router */
  /* Scroll position is remembered for each history entry, so Back, Forward and reload return to where you were, and a new link starts at the top.
     Every entry gets an id in its history state (a new link has none yet); positions are kept in sessionStorage under that id. A page that is still
     drawing (a guide page waits for its text) is scrolled again for a moment until it is tall enough, unless the reader scrolls first. */
  var scrollMem = (function () {
    var KEY = "udfop.scroll", pos = {}, id = null, saving = false, saveTimer = null, stopRestore = null;
    try { history.scrollRestoration = "manual"; } catch (e) {}
    try { pos = JSON.parse(sessionStorage.getItem(KEY) || "{}") || {}; } catch (e) { pos = {}; }
    function persist() {
      clearTimeout(saveTimer);
      try {
        var ids = Object.keys(pos); ids.slice(0, Math.max(0, ids.length - 80)).forEach(function (k) { delete pos[k]; });   /* keep the newest 80 entries */
        sessionStorage.setItem(KEY, JSON.stringify(pos));
      } catch (e) {}
    }
    window.addEventListener("scroll", function () {
      if (!saving || !id) return;
      pos[id] = Math.round(window.pageYOffset);
      clearTimeout(saveTimer); saveTimer = setTimeout(persist, 300);
    }, { passive: true });
    function snap() { if (saving && id) pos[id] = Math.round(window.pageYOffset); persist(); }   /* the position as the page is closed, reloaded or hidden */
    window.addEventListener("pagehide", snap);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") snap(); });
    function restoreTo(y) {
      if (stopRestore) stopRestore();
      var tries = 0, events = ["wheel", "touchstart", "keydown", "mousedown"], tick;
      function stop() { clearInterval(tick); events.forEach(function (n) { window.removeEventListener(n, stop, true); }); stopRestore = null; saving = true; }
      function step() {
        tries++;
        var max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, Math.min(y, Math.max(0, max)));
        if ((max >= y && Math.abs(window.pageYOffset - y) < 2 && tries > 3) || tries > 25) stop();   /* about 2.5 seconds at most */
      }
      events.forEach(function (n) { window.addEventListener(n, stop, true); });
      stopRestore = stop; tick = setInterval(step, 100); step();
    }
    return {
      leave: function () {   /* the page about to be replaced keeps the position it has now */
        if (saving && id) pos[id] = Math.round(window.pageYOffset);
        if (stopRestore) stopRestore();
        saving = false; persist();
      },
      arrive: function () {
        var st = history.state && history.state.udfop, want = 0;
        if (st && st.id) { id = st.id; want = pos[id] || 0; }
        else {
          id = "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          try { history.replaceState({ udfop: { id: id } }, ""); } catch (e) {}
        }
        if (want > 0) { restoreTo(want); return true; }
        window.scrollTo(0, 0); pos[id] = 0; saving = true; return false;
      }
    };
  })();

  /* a page that needs rows shows a short message while its shards load, then draws as usual; if the address changed meanwhile, that change draws its own page */
  function loadThenRoute(need) {
    var target = location.hash;
    document.title = "Loading – " + SHORT;
    app.innerHTML = '<h1 class="title">Loading</h1><p role="status">Loading the change data…</p>';
    document.getElementById("side-toc").hidden = true;
    loadShards(need).then(function () { if (location.hash === target) route(); }, function () {
      if (location.hash !== target) return;
      document.title = "Could not load – " + SHORT;
      app.innerHTML = '<h1 class="title">Could not load the change data</h1><div class="mbox">A data file did not load. Check your connection, then <a href="' + esc(target) + '" id="retry">try again</a>. If you opened <code>index.html</code> straight from a folder, serve the <code>web</code> folder instead.</div>';
      document.getElementById("retry").addEventListener("click", function (e) { e.preventDefault(); loadThenRoute(need); });
    });
  }
  /* ---------- features loaded on first use ---------- */
  /* The guide editor (the files in web/editor/) is large and few readers open it, so it is fetched the first time #/editor is visited.
     It reaches this file only through window.udfopHost: what it may use, and nothing else. */
  /* things the editor's checks need that are not loaded with the page lists: another page's source (for its headings) and whether a picture file exists.
     Each is null the first time it is asked for, while it is fetched; lintCb then tells the editor to check again. */
  var lintCache = {}, lintCb = null;
  function lintFetch(url, head) {
    if (url in lintCache) return lintCache[url];
    lintCache[url] = null;
    fetch(url, head ? { method: "HEAD" } : undefined).then(function (r) { if (!r.ok) throw new Error(r.status); return head ? true : r.text(); })
      .then(function (v) { lintCache[url] = v; }, function () { lintCache[url] = head ? false : ""; })
      .then(function () { if (lintCb) lintCb(); });
    return null;
  }
  window.udfopHost = {
    views: views, app: app, authorsLine: authorsLine, REPO: REPO, HOWTO: HOWTO, GUIDE_HAT: GUIDE_HAT, LINK_ICON: LINK_ICON, TEMPLATES: TEMPLATES, FALLBACK_TPL: FALLBACK_TPL, guideTemplates: guideTemplates,
    esc: esc, enc: enc, slugId: slugId, splitSection: splitSection, plainText: plainText, frontMatter: frontMatter, page: page,
    query: function () { return routeQuery; },
    guideReady: function () { return guide !== null; },
    /* does a Game Guide (or, with site true, Site Guide) page with this title or address exist? key is lower case */
    pageList: function (site) { return (site ? siteGuide : guide) || []; },
    topicExists: function (low) { return !!topicByLower[low]; },
    topicNames: function () { return topics; },   /* every Patch Notes topic, in order (the editor offers them after [[) */
    patchExists: function (v) { return !!D.releases[v]; },
    pageSource: function (key, site) {
      var p = site ? (siteByTitle[key] || siteBySlug[key]) : (guideByTitle[key] || guideBySlug[key]);
      return p ? lintFetch(encodeURI((site ? "site/" : "guide/") + p.slug + ".md")) : "";
    },
    fileExists: function (path) { return lintFetch(encodeURI("guide/" + path), true); },
    onLintData: function (fn) { lintCb = fn; },
    pageExists: function (key, site) { return !!(site ? (siteByTitle[key] || siteBySlug[key]) : (guideByTitle[key] || guideBySlug[key])); },
    /* draws Markdown as a page of the given area ("guide" or "site"); the renderer's per-page state is set for the call and put back after it. o: { area, base, key, related } */
    renderDoc: function (body, title, o) {   /* o.lines: the number of source lines before body; with it each block carries its source lines (data-ln) */
      var sRoot = mdRoot, sBase = mdBase, sRefs = refs, sTag = tagSrc; tagSrc = typeof o.lines === "number";
      mdRoot = o.area === "site" ? "site/" : "guide/"; mdBase = o.base || ""; refs = newRefs(o.key || "");
      try { var html = markdown(body, title, typeof o.lines === "number" ? o.lines : undefined); return o.related ? html + buildReferences(refs, o.related) : html; }
      finally { mdRoot = sRoot; mdBase = sBase; refs = sRefs; tagSrc = sTag; }
    }
  };
  /* Files fetched on first use: a style sheet is added as a link, a script is added so that scripts run in the order they were asked for. Each file is fetched once. */
  var fileLoads = {};
  function loadFile(f) {
    if (fileLoads[f]) return fileLoads[f];
    return fileLoads[f] = new Promise(function (resolve, reject) {
      var el;
      if (/\.css$/.test(f)) { el = document.createElement("link"); el.rel = "stylesheet"; el.href = f; }
      else { el = document.createElement("script"); el.src = f; el.async = false; }
      el.onload = resolve; el.onerror = function () { delete fileLoads[f]; el.remove(); reject(new Error(f)); };
      document.head.appendChild(el);
    });
  }
  function loadFiles(files) { return Promise.all(files.map(loadFile)); }
  var lazyState = {};
  function lazyView(name, files) {
    views[name] = function () {
      var target = location.hash;
      if (lazyState[name] === "failed") return { title: "Could not load", html: '<h1 class="title">Could not load this page</h1><div class="mbox">A file did not load. Check your connection, then <a href="' + esc(target) + '" id="retry">try again</a>.</div>', toc: false, after: function () {
        document.getElementById("retry").addEventListener("click", function (e) { e.preventDefault(); lazyState[name] = ""; route(); }); } };
      if (!lazyState[name]) {
        lazyState[name] = "loading";
        loadFiles(files).then(function () { lazyState[name] = "ready"; if (location.hash === target) route(); },
          function () { lazyState[name] = "failed"; if (location.hash === target) route(); });
      }
      return { title: "Loading", html: '<h1 class="title">Loading</h1><p role="status">Loading the editor…</p>', toc: false };
    };
  }
  lazyView("editor", ["editor/editor.css", "editor/lint.js", "editor/highlight.js", "editor/menus.js", "editor/dialog.js", "editor/files.js", "editor/html2md.js", "editor/multi.js", "editor/format.js", "editor/complete.js", "editor/edits.js", "editor/help.js", "editor/search.js", "editor/viewopts.js", "editor/suggest.js", "editor/pick.js", "editor/visual.js", "editor/view.js"]);   /* view.js replaces this stub with the real view */
  var routeQuery = {};   /* choices written after a ? in the address, for example group=topic */
  function route() {
    scrollMem.leave(); pendingSection = "";
    var path = pagePath(), qi = path.indexOf("?"), qs = qi >= 0 ? path.slice(qi) : "";
    routeQuery = {};
    if (qi >= 0) { path.slice(qi + 1).split("&").forEach(function (kv) { var e = kv.indexOf("="); if (kv) routeQuery[decodeURIComponent(kv.slice(0, e < 0 ? kv.length : e))] = e < 0 ? "" : decodeURIComponent(kv.slice(e + 1)); }); path = path.slice(0, qi); }
    var parts = path.replace(/^#\/?/, "").split("/"), name = parts[0] || "home", arg = parts.slice(1).join("/");
    if (name !== "search") { try { arg = decodeURIComponent(arg); } catch (e) {} }
    if (name === "systems" || name === "system") { location.replace("#/hubs"); return; }   /* game systems were folded into areas */
    if (name === "settings") { location.replace("#/"); settingsPanel.open(); return; }
    if (name === "topic" && !D.tstat[arg] && D.alias[arg]) { location.replace("#/topic/" + enc(D.alias[arg]) + qs); return; }   /* a merged topic's old name leads to the topic it became */
    var need = shardsNeeded(name, arg).filter(function (k) { return !loadedShards[k]; });
    if (need.length) { loadThenRoute(need); return; }
    if (editorOn !== (name === "editor")) {
      editorOn = name === "editor";
      if (editorOn) document.documentElement.setAttribute("data-editor", ""); else document.documentElement.removeAttribute("data-editor");
      setMenu(false); settingsPanel.close(false); applySettings(loadSettings());
    }
    var view = views[name], res = view ? view(arg) : notFound(path);
    if (!res) return;
    app.innerHTML = res.html;
    revealMore();
    document.title = (name === "home" ? SITE : res.title.indexOf(SHORT) >= 0 ? res.title : res.title + " – " + SHORT);
    if (name !== "feedback") feedbackPage = location.href;
    var fr = document.getElementById("foot-report");
    if (fr) { fr.href = "#/feedback"; }
    var nav = { home: "home", feedback: "feedback", guide: "guide", patchnotes: "patchnotes", recent: "patchnotes", topics: "patchnotes", topic: "patchnotes", hubs: "patchnotes", hub: "patchnotes", patches: "patchnotes", patch: "patchnotes", glossary: "guide", site: "site", tools: "tools", about: "about", credits: "credits", editor: "editor" }[name];
    var keys = [nav];
    if (name === "guide") {
      if (arg.indexOf("category/") === 0) keys = ["guide"];
      else if (arg) { var ge = guideBySlug[arg.toLowerCase()] || guideByTitle[arg.toLowerCase()]; keys = ge ? ["page:" + ge.slug.toLowerCase(), "guide"] : ["page:" + arg.toLowerCase(), "guide"]; }
    } else if (name === "site") {
      var se = arg ? (siteBySlug[arg.toLowerCase()] || siteByTitle[arg.toLowerCase()]) : null;
      keys = se ? ["page:site/" + se.slug.toLowerCase(), "site"] : ["site"];
    } else if (name === "hub") keys = ["hub:" + arg, nav];
    else if (name === "topic" && D.hubs[arg]) keys = ["hub:" + D.hubs[arg], nav];
    setNav(keys);
    syncAnchors();   /* a page with or without a scrollbar moves the header buttons a little */
    Array.prototype.forEach.call(app.querySelectorAll("a[data-issue]"), function (a) { a.href = issueUrl(a.getAttribute("data-issue"), a.getAttribute("data-prefix")); });
    document.getElementById("side-toc").hidden = true; tocSpy = []; document.documentElement.classList.remove("has-toc"); setToc(false);
    if (res.toc !== false) buildToc();
    fitTocRoom();
    if (res.after) res.after();
    setMenu(false); sug.hidden = true;
    fitEndPad();
    var restored = scrollMem.arrive();
    addHeadingLinks();
    if (!restored) { pendingSection = sectionOf(); jumpPending(); }
  }
  /* Firefox decides whether to offer reader view when the address changes, which is before this page has drawn its text. Once the text is there,
     a replaceState that changes nothing makes it look again. */
  var readerNudge;
  new MutationObserver(function () {
    clearTimeout(readerNudge);
    readerNudge = setTimeout(function () { try { history.replaceState(history.state, "", location.href); } catch (e) {} }, 400);
  }).observe(app, { childList: true, subtree: true });

  window.addEventListener("hashchange", route);
  route();
})();
