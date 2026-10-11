(function () {
  "use strict";
  var D = window.DATA, rows = D.rows, app = document.getElementById("app");
  var SITE = "Unofficial Daggerfall Online Pages", SHORT = "UDFOP";
  var TYPES = ["Buff", "Nerf", "Removal", "New", "Rework", "Fix", "Performance", "Economy", "QoL", "UI", "Other"];
  var TYPE_LABEL = { Buff: "Buffs", Nerf: "Nerfs", Removal: "Removals", New: "Additions", Rework: "Reworks", Fix: "Fixes",
    Performance: "Performance", Economy: "Economy", QoL: "Quality of life", UI: "Interface", Other: "Other changes" };
  var TYPE_COLOR = { Buff: "var(--buff)", Nerf: "var(--nerf)", Removal: "var(--nerf)", New: "var(--new)", Rework: "var(--rework)", Fix: "var(--fix)" };

  /* ---------- display settings (saved in this browser only) ---------- */
  var SETTINGS_KEY = "udfop.settings";
  var SETTING_OPTIONS = { skin: ["default", "parchment", "iliac", "oblivion"], size: ["small", "medium", "large"], width: ["standard", "wide"], theme: ["auto", "light", "dark"], previews: ["on", "off"], menu: ["sidebar", "popover"], panel: ["popover", "sidebar"], contents: ["popover", "sidebar"] };
  var SETTING_DEFAULTS = { skin: "default", size: "medium", width: "standard", theme: "auto", previews: "on", menu: "popover", panel: "sidebar", contents: "sidebar" };
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
  function applySettings(st) {
    var d = document.documentElement;
    [["skin", "default"], ["size", "medium"], ["width", "standard"], ["theme", "auto"], ["previews", "on"], ["menu", "sidebar"], ["panel", "popover"], ["contents", "popover"]].forEach(function (p) {
      if (st[p[0]] === p[1]) d.removeAttribute("data-" + p[0]); else d.setAttribute("data-" + p[0], st[p[0]]);
    });
    syncDocks(st);
    syncAnchors();
    syncTocBtn();   /* docking or undocking a panel moves where the Contents button belongs */
  }
  /* the dock buttons: "hide" while a panel is docked in a sidebar, "move to sidebar" while it is a pop-up */
  function syncDocks(st) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-dock]"), function (b) {
      b.textContent = st[b.getAttribute("data-dock")] === "sidebar" ? "hide" : "move to sidebar";
    });
  }
  function syncHeadH() {
    var h = document.getElementById("head");
    if (h) document.documentElement.style.setProperty("--head-h", h.offsetHeight + "px");
    syncAnchors();
  }
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
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function group(list, key) { var m = {}; list.forEach(function (r) { (m[r[key]] = m[r[key]] || []).push(r); }); return m; }
  function uniq(list) { var m = {}; list.forEach(function (k) { m[k] = 1; }); return Object.keys(m); }
  function vers(list) { return uniq(list.map(function (r) { return r.v; })).sort(vcmp); }
  function slugId(s) { return "s-" + s.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

  var byTopic = group(rows, "e"), bySystem = group(rows, "s"), byVersion = group(rows, "v");
  var topics = Object.keys(byTopic).sort(function (a, b) { return a.localeCompare(b); });
  var versions = Object.keys(byVersion).sort(vcmp).reverse();
  var systems = Object.keys(bySystem).sort();
  var hubs = {};
  topics.forEach(function (t) { var h = D.hubs[t] || "Uncategorised"; (hubs[h] = hubs[h] || []).push(t); });
  var hubNames = Object.keys(hubs).sort(function (a, b) {
    if (a === "Uncategorised") return 1; if (b === "Uncategorised") return -1; return a.localeCompare(b);
  });
  function dateOf(v) { var r = D.releases[v]; return r ? r.date : byVersion[v][0].d; }
  function lastVer(list) { return vers(list).pop(); }
  var tagIndex = {};
  topics.forEach(function (t) {
    var m = {}; byTopic[t].forEach(function (r) { (r.g || []).forEach(function (g) { m[g] = (m[g] || 0) + 1; }); });
    tagIndex[t] = m;
  });

  /* ---------- fragments ---------- */
  function tlink(t) { return '<a href="#/topic/' + enc(t) + '">' + esc(t) + "</a>"; }
  function vlink(v) { return '<a href="#/patch/' + enc(v) + '">' + esc(v) + "</a>"; }
  function slink(s) { return '<a href="#/system/' + enc(s) + '">' + esc(s) + "</a>"; }
  function hlink(h) { return '<a href="#/hub/' + enc(h) + '">' + esc(h) + "</a>"; }
  function typeTag(r) { return '<span class="tp" data-type="' + esc(r.t) + '">' + esc(r.t) + "</span>"; }
  function dir(r) { return r.r === "+" ? " (increase)" : r.r === "−" ? " (decrease)" : ""; }
  function text(r) { return esc(cap(r.x)) + (r.n ? '<span class="dev">Developer note: ' + esc(r.n) + "</span>" : ""); }

  var PN_HAT = '<a href="#/patchnotes">Patch Notes</a> › ';   /* every patch-notes page starts its breadcrumb here */
  function page(title, body, opts) {
    opts = opts || {};
    return '<h1 class="title">' + title + '</h1><div class="tagline">From ' + SITE + "</div>" +
      (opts.hat ? '<div class="hat">' + opts.hat + "</div>" : "") + body;
  }
  function sec(id, title, lvl) { return "<h" + lvl + ' class="sec" id="' + slugId(id) + '" data-toc="' + esc(title) + '">' + esc(title) + "</h" + lvl + ">"; }

  function table(list, cols, limit) {
    list = list.slice().sort(newest);
    var more = limit && list.length > limit ? list.length - limit : 0;
    if (more) list = list.slice(0, limit);
    var h = '<div class="wrap"><table class="wikitable"><thead><tr>' + cols.map(function (c) { return "<th>" + c + "</th>"; }).join("") + "</tr></thead><tbody>";
    list.forEach(function (r) {
      h += "<tr>" + cols.map(function (c) {
        switch (c) {
          case "Patch": return '<td class="nowrap">' + vlink(r.v) + "</td>";
          case "Date": return '<td class="nowrap">' + esc(r.d) + "</td>";
          case "Topic": return "<td>" + tlink(r.e) + "</td>";
          case "System": return "<td>" + slink(r.s) + "</td>";
          case "Type": return "<td>" + typeTag(r) + "</td>";
          case "Direction": return '<td data-dir="' + esc(r.r) + '">' + (r.r === "n/a" ? "" : esc(r.r)) + "</td>";
          default: return "<td>" + text(r) + "</td>";
        }
      }).join("") + "</tr>";
    });
    return h + "</tbody></table></div>" + (more ? '<p class="muted">' + plural(more, "older change") + " not shown.</p>" : "");
  }

  function bullets(list, withTopic) {
    return '<ul class="bul">' + list.slice().sort(newest).map(function (r) {
      return "<li>" + (withTopic ? "<b>" + tlink(r.e) + "</b> – " : "") + typeTag(r) + ": " + text(r) + "</li>";
    }).join("") + "</ul>";
  }

  function topicList(list, cols) {
    return '<ul class="cols">' + list.map(function (t) {
      var l = byTopic[t];
      return "<li>" + tlink(t) + (cols === false ? "" : " <small>(" + l.length + ")</small>") + "</li>";
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
      if (o === t) return;
      var s = 0, om = tagIndex[o];
      Object.keys(mine).forEach(function (g) { if (om[g]) s += 2; });
      if (hub && D.hubs[o] === hub) s += 1;
      if (s > 0) score[o] = s;
    });
    return Object.keys(score).sort(function (a, b) { return score[b] - score[a] || a.localeCompare(b); }).slice(0, 12);
  }

  /* ---------- views ---------- */
  var views = {};

  views.patchnotes = function () {
    var latest = versions[0], lrows = byVersion[latest];
    var recent = uniq(rows.slice().sort(newest).slice(0, 80).map(function (r) { return r.e; })).slice(0, 12);
    var big = topics.slice().sort(function (a, b) { return byTopic[b].length - byTopic[a].length; }).slice(0, 12);
    var h = '<p>The patch notes record what has changed in Daggerfall Online, patch by patch and topic by topic. They cover <b>' +
      rows.length.toLocaleString() + "</b> recorded changes to <b>" + topics.length + '</b> topics across <b>' + versions.length + "</b> patches, from version " +
      esc(versions[versions.length - 1]) + " (" + esc(dateOf(versions[versions.length - 1])) + ") to " + esc(latest) + " (" + esc(dateOf(latest)) + ").</p>";
    h += '<p class="browse"><b>Browse:</b> <a href="#/recent">Recent changes</a> · <a href="#/topics">All topics</a> · <a href="#/hubs">Categories</a> · <a href="#/systems">Game systems</a> · <a href="#/patches">Patch index</a> · <a href="#/random">Random topic</a></p>';
    h += '<div class="portals">';
    h += '<div class="portal"><h3>Latest patch</h3><div><p><b>' + vlink(latest) + "</b> – " + esc(dateOf(latest)) + "<br>" + plural(lrows.length, "change") + " to " +
      plural(uniq(lrows.map(function (r) { return r.e; })).length, "topic") + ".</p><ul>" +
      uniq(lrows.map(function (r) { return r.e; })).slice(0, 8).map(function (t) { return "<li>" + tlink(t) + "</li>"; }).join("") +
      '</ul><p><a href="#/recent">All recent changes →</a></p></div></div>';
    h += '<div class="portal"><h3>Recently changed topics</h3><div><ul>' + recent.map(function (t) { return "<li>" + tlink(t) + "</li>"; }).join("") + "</ul></div></div>";
    h += '<div class="portal"><h3>Most documented topics</h3><div><ul>' + big.map(function (t) { return "<li>" + tlink(t) + " <small class='muted'>(" + byTopic[t].length + ")</small></li>"; }).join("") + "</ul></div></div>";
    h += "</div>";
    h += sec("Browse by category", "Browse by category", 2) + '<ul class="cols">' + hubNames.map(function (n) {
      return "<li>" + hlink(n) + " <small>(" + hubs[n].length + ")</small></li>"; }).join("") + "</ul>";
    h += sec("Browse by game system", "Browse by game system", 2) + '<ul class="cols">' + systems.map(function (s) {
      return "<li>" + slink(s) + " <small>(" + bySystem[s].length + ")</small></li>"; }).join("") + "</ul>";
    return { title: "Patch Notes", html: page("Patch Notes", h) };
  };

  views.recent = function () {
    var shown = 8;
    var html = page("Recent changes", '<p>The newest patches first. Each entry is one change recorded in the official release notes.</p><div id="rc"></div><p><button class="more" id="more">Show older patches</button></p>', { hat: PN_HAT + "Recent changes" });
    return { title: "Recent changes", html: html, after: function () {
      var box = document.getElementById("rc"), btn = document.getElementById("more"), n = 0;
      function more() {
        var end = Math.min(versions.length, n + shown), h = "";
        for (; n < end; n++) {
          var v = versions[n], g = group(byVersion[v], "e");
          h += '<h2 class="sec">' + vlink(v) + ' <small class="muted">– ' + esc(dateOf(v)) + "</small></h2>";
          Object.keys(g).sort().forEach(function (t) { h += "<h3 class='sec'>" + tlink(t) + "</h3>" + bullets(g[t], false); });
        }
        box.insertAdjacentHTML("beforeend", h);
        if (n >= versions.length) btn.parentNode.hidden = true;
      }
      btn.addEventListener("click", more); more();
    } };
  };

  views.topics = function () {
    var letters = {}, h = "";
    topics.forEach(function (t) { var c = /^[A-Za-z]/.test(t) ? t.charAt(0).toUpperCase() : "#"; (letters[c] = letters[c] || []).push(t); });
    var all = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");
    h += "<p>" + plural(topics.length, "topic") + ", listed alphabetically. The number in brackets is how many changes are recorded.</p>" + filterBox("Filter topics…");
    h += '<div class="alpha">' + all.map(function (c) { return letters[c] ? '<a href="#/topics" data-scroll="' + slugId("L" + c) + '">' + c + "</a>" : "<span>" + c + "</span>"; }).join(" ") + "</div>";
    all.forEach(function (c) { if (letters[c]) h += '<div class="letter"><h2 class="sec" id="' + slugId("L" + c) + '">' + c + "</h2>" + topicList(letters[c]) + "</div>"; });
    return { title: "All topics", html: page("All topics", h, { hat: PN_HAT + "All topics" }), after: function () { wireFilter(".letter li", ".letter"); } };
  };

  views.hubs = function () {
    var h = "<p>Topics are grouped into categories by subject.</p>" + '<ul class="cols">' + hubNames.map(function (n) {
      return "<li>" + hlink(n) + " <small>(" + plural(hubs[n].length, "topic") + ")</small></li>"; }).join("") + "</ul>";
    return { title: "Categories", html: page("Categories", h, { hat: PN_HAT + "Categories" }) };
  };

  views.hub = function (n) {
    if (!hubs[n]) return notFound(n);
    var all = []; hubs[n].forEach(function (t) { all = all.concat(byTopic[t]); });
    var h = "<p><b>" + esc(n) + "</b> contains " + plural(hubs[n].length, "topic") + " with " + plural(all.length, "recorded change") + ".</p>" +
      sec("Topics", "Topics", 2) + topicList(hubs[n]) + sec("Latest changes", "Latest changes", 2) + table(all, ["Patch", "Date", "Topic", "Type", "Change"], 25) +
      cats([ '<a href="#/hubs">All categories</a>' ]);
    return { title: "Category: " + n, html: page("Category: " + esc(n), h, { hat: PN_HAT + '<a href="#/hubs">Categories</a> › ' + esc(n) }) };
  };

  views.topic = function (t) {
    var l = byTopic[t];
    if (!l) return notFound(t);
    var sys = uniq(l.map(function (r) { return r.s; })).sort(), g = group(l, "t"), hub = D.hubs[t], vs = vers(l);
    var order = TYPES.filter(function (x) { return g[x]; }).concat(Object.keys(g).filter(function (x) { return TYPES.indexOf(x) < 0; }));
    var top = order.slice().sort(function (a, b) { return g[b].length - g[a].length; })[0];

    var ib = '<table class="infobox"><caption class="ibt">' + esc(t) + "</caption><tbody>" +
      "<tr><th>Category</th><td>" + (hub ? hlink(hub) : "Uncategorised") + "</td></tr>" +
      "<tr><th>Systems</th><td>" + sys.map(slink).join(", ") + "</td></tr>" +
      "<tr><th>First recorded</th><td>" + vlink(vs[0]) + "<br><small class='muted'>" + esc(dateOf(vs[0])) + "</small></td></tr>" +
      "<tr><th>Latest change</th><td>" + vlink(vs[vs.length - 1]) + "<br><small class='muted'>" + esc(dateOf(vs[vs.length - 1])) + "</small></td></tr>" +
      "<tr><th>Changes</th><td>" + l.length + " in " + plural(vs.length, "patch") + "</td></tr>" +
      '<tr><td colspan="2" class="sub">Change types</td></tr><tr><td colspan="2"><div class="bar">' +
      order.map(function (x) { return '<i title="' + esc(x) + ": " + g[x].length + '" style="width:' + (100 * g[x].length / l.length) + "%;background:" + (TYPE_COLOR[x] || "var(--other)") + '"></i>'; }).join("") +
      "</div></td></tr>" +
      order.map(function (x) { return "<tr><th>" + esc(x) + "</th><td>" + g[x].length + "</td></tr>"; }).join("") +
      "</tbody></table>";

    var lead = D.desc && D.desc[t] ? "<p>" + esc(D.desc[t]).replace(esc(t), "<b>" + esc(t) + "</b>") + "</p>" :
      "<p><b>" + esc(t) + "</b> is a topic" + (hub ? " in the " + hlink(hub) + " category" : "") + ". It has " + plural(l.length, "recorded change") +
      " across " + (sys.length > 1 ? "the " + sys.map(slink).join(", ") + " systems" : "the " + slink(sys[0]) + " system") + ", from patch " + vlink(vs[0]) +
      (vs.length > 1 ? " to " + vlink(vs[vs.length - 1]) : "") + ". " +
      (order.length > 1 ? "Most of them are " + esc(TYPE_LABEL[top] ? TYPE_LABEL[top].toLowerCase() : top.toLowerCase()) + " (" + g[top].length + ")." : "") + "</p>";

    var h = ib + lead;
    h += sec("Latest changes", "Latest changes", 2) + bullets(l.slice().sort(newest).slice(0, Math.min(5, l.length)), false);
    h += sec("History", "History", 2) + table(l, ["Patch", "Date", "System", "Type", "Direction", "Change"]);
    if (order.length > 1) {
      h += sec("By type", "Changes by type", 2);
      order.forEach(function (x) { h += sec("type-" + x, TYPE_LABEL[x] || x, 3) + bullets(g[x], false).replace(/<span class="tp"[^>]*>[^<]*<\/span>: /g, ""); });
    }
    var rel = relatedTopics(t);
    if (rel.length) h += sec("See also", "See also", 2) + '<ul class="cols">' + rel.map(function (o) { return "<li>" + tlink(o) + "</li>"; }).join("") + "</ul>";
    h += cats((hub ? [hlink(hub)] : []).concat(sys.map(function (s) { return slink(s) + " system"; })).concat(
      Object.keys(tagIndex[t]).sort(function (a, b) { return tagIndex[t][b] - tagIndex[t][a]; }).slice(0, 4).map(function (g2) {
        return '<a href="#/search/' + enc(g2) + '">' + esc(g2) + "</a>"; })));
    return { title: t, html: page(esc(t), h, { hat: PN_HAT + (hub ? '<a href="#/hubs">Categories</a> › ' + hlink(hub) : '<a href="#/topics">All topics</a>') + " › " + esc(t) }), toc: true };
  };

  views.systems = function () {
    var h = "<p>Each recorded change belongs to one of " + systems.length + " game systems.</p>" + '<ul class="cols">' + systems.map(function (s) {
      return "<li>" + slink(s) + " <small>(" + plural(uniq(bySystem[s].map(function (r) { return r.e; })).length, "topic") + ", " + plural(bySystem[s].length, "change") + ")</small></li>"; }).join("") + "</ul>";
    return { title: "Game systems", html: page("Game systems", h, { hat: PN_HAT + "Game systems" }) };
  };

  views.system = function (s) {
    var l = bySystem[s];
    if (!l) return notFound(s);
    var tp = uniq(l.map(function (r) { return r.e; })).sort();
    var h = "<p><b>" + esc(s) + "</b> has " + plural(l.length, "recorded change") + " across " + plural(tp.length, "topic") + ".</p>" +
      sec("Topics", "Topics", 2) + topicList(tp) + sec("Latest changes", "Latest changes", 2) + table(l, ["Patch", "Date", "Topic", "Type", "Direction", "Change"], 30);
    return { title: s + " system", html: page(esc(s) + " system", h, { hat: PN_HAT + '<a href="#/systems">Game systems</a> › ' + esc(s) }) };
  };

  views.patches = function () {
    var h = "<p>" + plural(versions.length, "patch") + ", newest first.</p>" + filterBox("Filter by version or date…") +
      '<table class="wikitable"><thead><tr><th>Patch</th><th>Date</th><th>Changes</th><th>Topics</th></tr></thead><tbody>' +
      versions.map(function (v) {
        return "<tr><td>" + vlink(v) + "</td><td>" + esc(dateOf(v)) + "</td><td>" + byVersion[v].length + "</td><td>" +
          uniq(byVersion[v].map(function (r) { return r.e; })).length + "</td></tr>";
      }).join("") + "</tbody></table>";
    return { title: "Patch index", html: page("Patch index", h, { hat: PN_HAT + "Patch index" }), after: function () { wireFilter("tbody tr", "tbody tr"); } };
  };

  views.patch = function (v) {
    var l = byVersion[v];
    if (!l) return notFound("Patch " + v);
    var i = versions.indexOf(v), rel = D.releases[v], g = group(l, "e"), names = Object.keys(g).sort();
    var h = '<div class="pager">' + (i < versions.length - 1 ? '<a href="#/patch/' + enc(versions[i + 1]) + '">← Older: ' + esc(versions[i + 1]) + "</a>" : "") +
      (i > 0 ? '<a href="#/patch/' + enc(versions[i - 1]) + '">Newer: ' + esc(versions[i - 1]) + " →</a>" : "") + "</div>";
    h += "<p><b>Patch " + esc(v) + "</b> was released on " + esc(dateOf(v)) + ". It records " + plural(l.length, "change") + " to " + plural(names.length, "topic") + ".</p>";
    names.forEach(function (t) { h += sec("p-" + t, t, 2).replace(">" + esc(t) + "</h2>", ">" + tlink(t) + "</h2>") + bullets(g[t], false); });
    if (rel && rel.prs.length) h += sec("Pull requests", "Source pull requests", 2) + '<ul class="bul">' + rel.prs.map(function (p) {
      return '<li><a href="' + esc(p.u) + '" rel="noopener">#' + p.n + "</a> " + esc(p.t) + "</li>"; }).join("") + "</ul>";
    return { title: "Patch " + v, html: page("Patch " + esc(v), h, { hat: PN_HAT + '<a href="#/patches">Patch index</a> › ' + esc(v) }) };
  };

  views.search = function (q) {
    q = decodeURIComponent(q || "");
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    var tm = topics.filter(function (t) { return words.every(function (w) { return t.toLowerCase().indexOf(w) >= 0; }); });
    var hit = rows.filter(function (r) {
      var s = (r.e + " " + r.x + " " + (r.n || "") + " " + (r.g || []).join(" ")).toLowerCase();
      return words.every(function (w) { return s.indexOf(w) >= 0; });
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
      h = '<p>Results for <b>' + esc(q) + "</b>: " + plural(gp.length, "guide page") + ", " + plural(sp.length, "Site Guide page") + ", " + plural(tm.length, "matching topic") + " and " + plural(hit.length, "matching change") + ".</p>";
      if (gp.length) {
        h += sec("Game Guide", "Game Guide", 2) + shownThenMore(gp, SEARCH_SHOWN, guideList, "guide pages", "gp-rest");
      }
      if (sp.length) h += sec("Site Guide", "Site Guide", 2) + guideList(sp);
      if (tm.length === 1 && tm[0].toLowerCase() === q.toLowerCase()) h = '<div class="mbox">There is a topic named “' + tlink(tm[0]) + "”.</div>" + h;
      if (tm.length) h += sec("Topics", "Topics", 2) + shownThenMore(tm, TOPICS_SHOWN, topicList, "topics", "tm-rest");
      if (hit.length) h += sec("Changes", "Changes", 2) + table(hit, ["Patch", "Topic", "Type", "Change"], 100);
      if (!tm.length && !hit.length && !gp.length && !sp.length) h += "<p>No results. Try fewer or different words.</p>";
    }
    return { title: "Search: " + q, html: page("Search", h), after: revealMore };
  };

  views.about = function () {
    var latest = versions[0];
    var h = "<p><b>UDFOP</b>, the <b>Unofficial Daggerfall Online Pages</b>, is a fan-made patch notes wiki that records what has changed in <b>Daggerfall Online</b>, patch by patch and topic by topic. It is not affiliated with or endorsed by the game's developers, by Bethesda Softworks or by ZeniMax. <i>The Elder Scrolls</i>, <i>Daggerfall</i> and related names are trademarks of their respective owners.</p>";
    h += sec("Where the information comes from", "Where the information comes from", 2) +
      "<p>Every change in the Patch Notes comes from the <a href=\"https://github.com/Lattymoy/daggerfall-js-source/releases\" rel=\"noopener\">public release notes</a> of the project's GitHub repository. Each change has been rewritten in short plain sentences and filed under a topic, a game system and a type. Patch pages link to the pull requests the changes came from, and the release notes themselves remain the authoritative record.</p>";
    h += sec("The Game Guide", "The Game Guide", 2) +
      '<p>The <a href="#/guide">Game Guide</a> is written by the community in plain Markdown files, and anyone can add or correct a page through GitHub. See <a href="' + REPO + '/blob/main/CONTRIBUTING.md" rel="noopener">how to contribute</a>. Guide pages are the work of their contributors and have not been checked by the game developers.</p>';
    h += sec("How the Patch Notes pages are written", "How the Patch Notes pages are written", 2) +
      "<p>The change tables are compiled from the release notes with a small script. The opening paragraph of each topic was written with the help of an AI assistant (Claude) from that topic's change history, and describes how the topic works as of its latest change. These paragraphs can be wrong or out of date, so the <b>History</b> table on each page is the thing to trust. Corrections are welcome.</p>";
    h += sec("Credits and licence", "Credits and licence", 2) +
      "<p>Started and maintained by <b>tau</b>, with Game Guide pages written by their contributors. The site code is released under the MIT licence and the topic descriptions and other original text are licensed CC BY 4.0. The change data is derived from the developer's release notes, and the game and its names belong to their owners.</p>";
    h += sec("Feedback", "Feedback", 2) + '<p>Found a mistake or a bug? See <a href="#/feedback">Feedback &amp; Bugs</a>. Pages are written by their contributors, may be wrong or out of date, and carry no warranty.</p>';
    h += sec("Coverage", "Coverage", 2) + "<p>" + rows.length.toLocaleString() + " changes in " + topics.length + " topics across " + versions.length + " patches, from " + esc(versions[versions.length - 1]) + " (" + esc(dateOf(versions[versions.length - 1])) + ") to " + esc(latest) + " (" + esc(dateOf(latest)) + ").</p>";
    return { title: "About UDFOP", html: page("About UDFOP", h) };
  };

  /* ---------- Game Guide: Markdown pages in web/guide/, listed by guide/index.json ---------- */
  var REPO = "https://github.com/tau-samsara/udfop";
  /* the contributor instructions: the one place their address is written (the menu in index.html has it too). A moved page can keep its old address working by adding it to MOVED */
  var HOWTO = "#/site/how-to-write-a-page";
  /* Game Guide addresses that moved (lower case) -> where the page lives now. The Site Guide used to be inside the Game Guide */
  var MOVED = {
    "how-to-write-a-page": "#/site/how-to-write-a-page", "how-to/how-to-write-a-page": "#/site/how-to-write-a-page",
    "how-to/formatting-reference": "#/site/formatting-reference", "how-to/troubleshooting": "#/site/troubleshooting",
    "how-to/reviewing-a-pull-request": "#/site/reviewing-a-pull-request", "how-to/site-guide": "#/site"
  };
  var guide = null, guideFailed = false, guideBySlug = {}, guideByTitle = {};
  var siteGuide = [], siteBySlug = {}, siteByTitle = {};   /* the Site Guide: pages in web/site/, listed by site/index.json */
  var topicByLower = {};
  topics.forEach(function (t) { topicByLower[t.toLowerCase()] = t; });

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
      b.addEventListener("click", function () { document.getElementById(b.getAttribute("data-more")).hidden = false; b.parentNode.remove(); });
    });
  }
  /* The editor's starter text is web/guide/_template.md (the one template); this is only a fallback if it cannot be fetched. */
  var FALLBACK_TPL = "---\ntitle: Page title\ncategory: \nsummary: \n---\n\nWrite your page here.\n";
  var guideTemplate = null;
  function newPageUrl(title) {
    var tpl = guideTemplate || FALLBACK_TPL;
    if (title) tpl = tpl.replace(/^title:.*$/m, function () { return "title: " + title; });
    var name = title ? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : "";
    return REPO + "/new/main/web/guide?" + (name ? "filename=" + enc(name + ".md") + "&" : "") + "value=" + enc(tpl);
  }
  function newAttr(title) { return ' data-new="' + esc(title) + '"'; }
  function refreshNewLinks() {
    Array.prototype.forEach.call(document.querySelectorAll("a[data-new]"), function (a) { a.href = newPageUrl(a.getAttribute("data-new")); });
  }
  fetch("guide/_template.md").then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (t) { guideTemplate = t.replace(/^\ufeff/, "").replace(/\r\n/g, "\n"); refreshNewLinks(); })
    .catch(function () {});
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
  function wikiLink(target, label) {
    var raw = target.trim(), low = raw.toLowerCase(), t;
    if (low.indexOf("topic:") === 0) { t = topicByLower[low.slice(6).trim()]; if (t) noteRef("topic", t, t); return t ? tlink(t).replace(">" + esc(t) + "<", ">" + esc(label || t) + "<") + MARK_PN : esc(label || raw.slice(6)); }
    if (low.indexOf("patch:") === 0) { var v = raw.slice(6).trim(); if (byVersion[v]) noteRef("patch", v, v); return byVersion[v] ? '<a href="#/patch/' + enc(v) + '">' + esc(label || v) + "</a>" + MARK_PN : esc(label || v); }
    var g = findPage(low);
    if (g) { if (pageKey(g) !== refs_self()) noteRef("guide", pageKey(g), g); }
    if (g) return '<a href="' + purl(g) + '">' + esc(label || g.title) + "</a>" + (g.area === "site" ? MARK_SG : MARK_GP);
    t = topicByLower[low];
    if (t) { noteRef("topic", t, t); return tlink(t).replace(">" + esc(t) + "<", ">" + esc(label || t) + "<") + MARK_PN; }
    return '<a class="missing" href="' + newPageUrl(raw) + '"' + newAttr(raw) + ' rel="noopener" title="No page called this yet. Click to create it.">' + esc(label || raw) + "</a>";
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
  function inline(s) {
    var stash = [];
    function keep(h) { stash.push(h); return "\u0000" + (stash.length - 1) + "\u0000"; }
    s = codeSpans(s, keep);
    s = s.replace(/\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g, function (m, t, l) { return keep(wikiLink(t, l)); });
    s = s.replace(/\{\{([^{}]+)\}\}/g, function (m, t) { return keep(keycaps(t)); });
    s = s.replace(IMG_RE, function (m, alt, src) {
      src = imgSrc(src); if (!src) return "";
      return keep('<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy">');
    });
    s = s.replace(/\[([^\]]+)\]\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)\)/g, function (m, text, url) {
      url = safeUrl(url); if (!url) return text;
      var ext = /^https?:/i.test(url);
      if (ext) noteRef("ext", url, { url: url, text: plainText(text) });
      return keep('<a href="' + esc(url) + '"' + (ext ? ' rel="noopener"' : "") + ">" + inlineBasic(text) + "</a>" + (ext ? MARK_EXT : ""));
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
      /* "guide:Name", "topic:Name" and "patch:0.1.2" say which kind; with no prefix a guide page wins over a topic of the same name */
      var pm = /^(guide|topic|patch)\s*:\s*(.*)$/i.exec(name), mode = pm ? pm[1].toLowerCase() : "", rest = (pm ? pm[2] : name).trim();
      if (mode === "patch") { if (byVersion[rest]) noteRef("patch", rest, rest); return; }
      var low = rest.toLowerCase(), g = mode === "topic" ? null : findPage(low), t = mode === "guide" ? null : topicByLower[low];
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
        r.topic.map(function (t) { var v = lastVer(byTopic[t]); return "<li>" + tlink(t) + " – last patched " + vlink(v) + " (" + esc(dateOf(v)) + ")</li>"; }).join("") +
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
  var mdRoot = "guide/";   /* "guide/" or "site/": which section's folder the page being rendered is in */
  var mdBase = "";   /* folder of the page being rendered, so pictures resolve next to it */
  function markdown(src, title) {
    var lines = src.replace(/\r\n?/g, "\n").split("\n"), out = [], i = 0, first = true, figSince = false;
    function para(buf) { if (buf.length) out.push("<p>" + inline(buf.join(" ")) + "</p>"); }
    while (i < lines.length) {
      var l = lines[i], m;
      if (!l.trim()) { i++; continue; }
      if ((m = /^(`{3,}|~{3,})\s*([A-Za-z0-9+#.-]{1,20})?\s*$/.exec(l))) {   /* a code box: three or more backticks or tildes; only a bare fence at least as long closes it */
        var code = [], lang = (m[2] || "").toLowerCase(), fence = m[1], fm; i++;
        while (i < lines.length && !((fm = /^(`{3,}|~{3,})\s*$/.exec(lines[i])) && fm[1].charAt(0) === fence.charAt(0) && fm[1].length >= fence.length)) code.push(lines[i++]);
        i++; out.push(codeBox(lang, code.join("\n"))); continue;
      }
      if ((m = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(l))) {
        var text = plainText(m[2]);
        if (first && m[1].length === 1 && text.toLowerCase() === (title || "").toLowerCase()) { i++; first = false; continue; }
        var lvl = Math.min(6, Math.max(2, m[1].length));
        var hd = lvl <= 3 ? sec(text, text, lvl) : "<h" + lvl + ">" + inline(m[2]) + "</h" + lvl + ">";
        if (figSince && lvl <= 3) hd = hd.replace('class="sec"', 'class="sec cl"');
        figSince = false; out.push(hd); i++; first = false; continue;
      }
      first = false;
      if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(l)) { out.push("<hr>"); i++; continue; }
      if (/^>(?!!.*!<)/.test(l)) {   /* a line that opens with a >!spoiler!< is a paragraph, not a quote */
        var q = [];
        while (i < lines.length && /^>(?!!.*!<)/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
        /* a quote whose first line is [!NOTE], [!TIP], [!IMPORTANT], [!WARNING] or [!CAUTION] is a notice box (GitHub's alert syntax); any other quote stays a quote */
        var al = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(q[0]);
        if (al) {
          var kind = al[1].toLowerCase();
          out.push('<div class="alert alert-' + kind + '" role="note"><span class="alert-label">' + kind.charAt(0).toUpperCase() + kind.slice(1) + "</span>" + markdown(q.slice(1).join("\n")) + "</div>"); continue;
        }
        out.push("<blockquote>" + markdown(q.join("\n")) + "</blockquote>"); continue;
      }
      if (l.indexOf("|") >= 0 && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        var head = splitRow(l), body = [], aligns = splitRow(lines[i + 1]).map(function (c) { return /^:-+:$/.test(c) ? "center" : /^-+:$/.test(c) ? "right" : /^:-+$/.test(c) ? "left" : ""; });
        function al(k) { return aligns[k] ? ' style="text-align:' + aligns[k] + '"' : ""; }
        i += 2;
        while (i < lines.length && lines[i].trim() && lines[i].indexOf("|") >= 0) body.push(splitRow(lines[i++]));
        out.push('<div class="wrap"><table class="wikitable"><thead><tr>' + head.map(function (c, k) { return "<th" + al(k) + ">" + inline(c) + "</th>"; }).join("") +
          "</tr></thead><tbody>" + body.map(function (r) { return "<tr>" + head.map(function (_, k) { return "<td" + al(k) + ">" + inline(r[k] || "") + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>");
        continue;
      }
      if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
        var items = [];
        while (i < lines.length && lines[i].trim() && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) items.push(lines[i++]);
        out.push(list(items)); continue;
      }
      if ((m = FIG_LINE.exec(l.trim())) && (m[3] || m[4] !== undefined)) { out.push(figure(m)); figSince = true; i++; continue; }
      var buf = [];
      while (i < lines.length && lines[i].trim() && !/^(```|~~~|#{1,6}\s|>)/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) &&
             !((m = FIG_LINE.exec(lines[i].trim())) && (m[3] || m[4] !== undefined))) buf.push(lines[i++].trim());
      para(buf);
    }
    return out.join("\n");
  }
  function list(items) {
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
        h += "<li>" + inline(text) + kids + "</li>"; k = j;
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

  var GUIDE_HAT = '<a href="#/guide">Game Guide</a>';
  function guideUnavailable() {
    return '<div class="mbox">The Game Guide could not be loaded. If you opened <code>index.html</code> straight from a folder, the browser blocks it: serve the <code>web</code> folder instead (for example <code>python -m http.server --directory web</code>) or use the published site. If you just added pages, run <code>python tools/guide.py</code> to refresh the list.</div>';
  }

  views.guide = function (arg) {
    if (arg && arg.indexOf("category/") === 0) return views.guidecat(arg.slice(9));
    if (arg) return views.guidepage(arg);
    var h = "<p>The Game Guide is the community-written part of UDFOP: how things in Daggerfall Online work, written by players. Unlike the patch notes it is edited by hand, so anyone can improve it.</p>" + contribBox();
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
    return { title: "Game Guide", html: page("Game Guide", h) };
  };
  views.guidecat = function (c) {
    var list = listedGuide().filter(function (p) { return p.category === c; });
    var h = guide === null ? "<p>Loading…</p>" : list.length ? categoryList(list) : "<p>No pages in this category.</p>";
    return { title: c, html: page(esc(c), h, { hat: GUIDE_HAT + " › " + esc(c) }), toc: false };
  };
  views.guidepage = function (slug) {
    if (MOVED[slug.toLowerCase()]) { location.replace(MOVED[slug.toLowerCase()]); return null; }
    return pageView("guide", slug);
  };
  var SITE_HAT = '<a href="#/site">Site Guide</a>';
  /* the Site Guide: help for contributors and reviewers, in web/site/. #/site is its front page (web/site/index.md) */
  views.site = function (arg) { return pageView("site", arg || "index"); };
  /* one Markdown page of the Game Guide (web/guide/) or the Site Guide (web/site/); both are rendered the same way */
  function pageView(area, slug) {
    var site = area === "site", bySlug = site ? siteBySlug : guideBySlug, byTitle = site ? siteByTitle : guideByTitle, dir = site ? "site/" : "guide/";
    var entry = bySlug[slug.toLowerCase()] || byTitle[slug.toLowerCase()], front = site && (entry ? entry.slug : slug) === "index";
    var title = entry ? entry.title : slug.split("/").pop();
    var real = entry ? entry.slug : slug, slugPath = real.split("/").map(enc).join("/");
    return { title: title, html: page(esc(title), '<div id="gp"><p>Loading…</p></div>', { hat: front ? "" : site ? SITE_HAT : GUIDE_HAT }), after: function () {
      var box = document.getElementById("gp");
      fetch(dir + slugPath + ".md").then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (raw) {
        var fm = frontMatter(raw), t = fm.meta.title || title, cat = fm.meta.category || (entry && entry.category) || "General";
        document.title = t + " – " + SHORT;
        setNav(["page:" + (site ? "site/" : "") + real.toLowerCase(), area]);   /* the page's real slug, not the title or odd capitals someone typed */
        document.querySelector("h1.title").textContent = t;
        var hat = document.querySelector(".hat");
        if (hat && !site) { if (entry && entry.unlisted) hat.remove(); else hat.innerHTML = GUIDE_HAT + ' › <a href="#/guide/category/' + enc(cat) + '">' + esc(cat) + "</a>"; }
        mdRoot = dir;
        mdBase = real.indexOf("/") >= 0 ? real.replace(/[^/]*$/, "") : "";
        refs = newRefs(area + "|" + real);
        var rendered = markdown(fm.body, t); mdBase = ""; mdRoot = "guide/";
        rendered += buildReferences(refs, (fm.meta.related || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean)); refs = null;
        box.innerHTML = rendered +
          '<p class="editline"><a href="' + REPO + "/edit/main/web/" + dir + slugPath + '.md" rel="noopener">Edit this page</a> (fork the project first) · <a href="' + HOWTO + '">How to contribute</a></p>';
        buildToc();
      }).catch(function () {
        if (guideFailed) { box.innerHTML = guideUnavailable(); return; }
        /* the same page as any other missing address (a Game Guide page also gets a way to write it) */
        document.title = "Not found – " + SHORT;
        document.querySelector("h1.title").textContent = "Page not found";
        var hat = document.querySelector(".hat"); if (hat) hat.remove();
        box.innerHTML = notFoundBody(title, site ? "" : '<p><a href="' + newPageUrl(title) + '"' + newAttr(title) + ' rel="noopener">Create this page</a> (you need your own fork first: see <a href="' + HOWTO + '">how to contribute</a>).</p>', site ? "" : slug);
        wireNotFound();
      });
    }, toc: false };
  }

  views.home = function () {
    var n = listedGuide().length;
    var h = '<p>Welcome to <b>UDFOP</b>, the <b>Unofficial Daggerfall Online Pages</b>: a fan-made, community-edited reference for Daggerfall Online. It has two parts.</p>';
    h += '<div class="portals two">';
    h += '<div class="portal"><h3>Game Guide</h3><div><p>How things work, written by players. ' + (n ? "<b>" + plural(n, "page") + "</b> so far." : "Be the first to add a page.") + '</p><p><a href="#/guide">Browse the Game Guide →</a><br><a href="' + HOWTO + '">How to write a page</a></p></div></div>';
    h += '<div class="portal"><h3>Patch Notes</h3><div><p>Every recorded change, patch by patch: <b>' + rows.length.toLocaleString() + "</b> changes to <b>" + topics.length + "</b> topics. Latest: <b>" + vlink(versions[0]) + "</b> (" + esc(dateOf(versions[0])) + ').</p><p><a href="#/patchnotes">Browse the Patch Notes →</a><br><a href="#/recent">Recent changes</a></p></div></div>';
    h += "</div>";
    h += "<p>Patch notes are compiled from the developers' public release notes by a script, so they are updated for each release. Guide pages are written and corrected by the community. <a href=\"#/about\">About UDFOP</a></p>";
    return { title: "Main Page", html: page("Main Page", h), toc: false };
  };

  /* ---------- feedback: GitHub issue forms, pre-filled with the page the reader came from ---------- */
  function issueUrl(template, prefix) {
    return REPO + "/issues/new?template=" + template + "&title=" + enc(prefix) + "&page=" + enc(feedbackPage);
  }
  var feedbackPage = location.href;
  views.feedback = function () {
    var h = "<p>Found something broken, wrong or confusing? Tell us. Reports are made on GitHub, so they are public and need a free GitHub account. The site itself collects nothing about you.</p>";
    h += '<div class="portals">' +
      '<div class="portal"><h3>Report a bug</h3><div><p>The site is broken, looks wrong, or does not work on your device.</p><p><a class="btn" data-issue="bug.yml" data-prefix="[Bug] " href="' + issueUrl("bug.yml", "[Bug] ") + '" rel="noopener">Report a bug</a></p></div></div>' +
      '<div class="portal"><h3>Wrong or missing information</h3><div><p>A guide page or patch note is wrong, out of date or incomplete.</p><p><a class="btn" data-issue="content.yml" data-prefix="[Content] " href="' + issueUrl("content.yml", "[Content] ") + '" rel="noopener">Report an error</a></p></div></div>' +
      '<div class="portal"><h3>Suggestion or feedback</h3><div><p>An idea, a request, or what you think of the site.</p><p><a class="btn" data-issue="feedback.yml" data-prefix="[Feedback] " href="' + issueUrl("feedback.yml", "[Feedback] ") + '" rel="noopener">Give feedback</a></p></div></div>' +
      "</div>";
    h += sec("Rather fix it yourself?", "Rather fix it yourself?", 2) +
      '<p>Anyone can correct or add a Game Guide page: <a href="' + HOWTO + '">how to write a guide page</a>. Please do not put personal details in a report, since it is public.</p>';
    return { title: "Feedback & Bugs", html: page("Feedback &amp; Bugs", h), toc: false };
  };

  views.random = function () {
    location.replace("#/topic/" + enc(topics[Math.floor(Math.random() * topics.length)]));
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
      var text = el.getAttribute("data-toc"), link = '<a href="' + location.hash + '" data-scroll="' + el.id + '">' + esc(text) + "</a>";
      if (el.tagName === "H3" && items.length) { items[items.length - 1].subs.push(link); meta.push(false); }
      else { items.push({ text: text, link: link, subs: [] }); meta.push(true); }
    });
    var h = '<ol><li><a href="' + location.hash + '" data-scroll="top">(Top)</a></li>' + items.map(function (it) {
      return it.subs.length ? '<li class="has-sub"><button type="button" class="exp" aria-expanded="false" aria-label="Show the subsections of ' + esc(it.text) + '"></button>' + it.link +
        "<ol>" + it.subs.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ol></li>" : "<li>" + it.link + "</li>";
    }).join("") + "</ol>";
    list.innerHTML = h; side.hidden = false; document.documentElement.classList.add("has-toc");
    if (!app.querySelector(".toc-btn")) {   /* the button sits in the article's left margin and follows the scroll, so Contents is always one click away */
      var anchor = document.createElement("div"), btn = document.createElement("button");
      anchor.className = "toc-anchor";
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
    var line = (document.getElementById("head").offsetHeight || 60) + 24, cur = -1;
    tocSpy.forEach(function (t, k) { if (t.el.getBoundingClientRect().top <= line) cur = k; });
    var parent = null;
    if (cur >= 0) for (var k = cur; k >= 0; k--) if (tocSpy[k].top) { parent = tocSpy[k]; break; }
    if (tocTop) tocTop.classList.toggle("on", cur < 0);
    tocSpy.forEach(function (t, k) { t.a.classList.toggle("on", k === cur || (t === parent && tocSpy[cur] !== t && !t.li.classList.contains("open"))); });
  }
  var spyBusy = false;
  window.addEventListener("scroll", function () { if (!spyBusy) { spyBusy = true; requestAnimationFrame(function () { spyBusy = false; spyToc(); }); } }, { passive: true });
  /* the button sits beside the title; once the page scrolls past that spot it floats at the top left. The pop-up stays anchored under it */
  function syncTocBtn() {
    var a = document.querySelector(".toc-anchor"), b = document.querySelector(".toc-btn");
    if (!a || !b) return;
    if (getComputedStyle(a).display === "none") { b.classList.remove("floating"); b.style.left = ""; return; }   /* hidden (docked or narrow): nothing to measure */
    var fl = a.getBoundingClientRect().top <= (document.getElementById("head").offsetHeight || 60) + 11;
    b.classList.toggle("floating", fl);
    b.style.left = fl ? (document.getElementById("rail").getBoundingClientRect().width + 8) + "px" : "";   /* clear of a docked main menu */
  }
  function placeToc() {
    var panel = document.getElementById("side-toc"), btn = document.querySelector(".toc-btn");
    var r = btn ? btn.getBoundingClientRect() : { left: 8, bottom: 0 }, top = Math.max(r.bottom + 6, (document.getElementById("head").offsetHeight || 60) + 6);
    panel.style.top = top + "px"; panel.style.left = Math.max(8, r.left) + "px"; panel.style.maxHeight = "calc(100vh - " + (top + 12) + "px)";
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
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target : e.target.parentNode;
    var x = t.closest(".exp");
    if (x) { var open = !x.parentNode.classList.contains("open"); x.parentNode.classList.toggle("open", open); x.setAttribute("aria-expanded", open ? "true" : "false"); spyToc(); return; }
    if (t.closest(".toc-btn")) setToc(!document.body.classList.contains("toc-open"));
    else if (document.body.classList.contains("toc-open") && !t.closest("#side-toc")) setToc(false);
    var d = t.closest("[data-dock]");
    if (d) {
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

  function scrollTo(id) {
    if (id === "top") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    var el = document.getElementById(id); if (el && isCompact()) { revealFolds(el); var fo = foldFor(el); if (fo) toggleFold(fo, true); } if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }
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
    .then(function () { if (/^#\/(guide|site|search)?(\/|$)/.test(location.hash) || location.hash === "" || location.hash === "#") route(); });
  document.getElementById("foot-stats").textContent = rows.length.toLocaleString() + " changes · " + topics.length + " topics · " + versions.length + " patches · latest " + versions[0] + " (" + dateOf(versions[0]) + ")";

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
      { key: "skin", legend: "Theme", help: "The overall look. Each theme has a light and a dark version.", grid: true,
        labels: ["Default", "Parchment", "Iliac Bay", "Oblivion"], swatches: [["#ffffff", "#8a5a1a"], ["#f8f1de", "#8a2f0c"], ["#fafdfe", "#0f766e"], ["#171213", "#e4583f"]] },
      { key: "theme", legend: "Color", help: "Auto follows your device's light or dark setting.", labels: ["Auto", "Light", "Dark"] },
      { key: "size", legend: "Text size", help: "Scales all text and spacing.", labels: ["Small", "Medium", "Large"] },
      { key: "width", legend: "Page width", help: "Standard keeps lines comfortable to read; Wide uses the whole window.", labels: ["Standard", "Wide"] },
      { key: "previews", legend: "Link previews", help: "A short preview appears when you point at a link to a page or topic. Not shown on touch screens.", labels: ["On", "Off"] }
    ];
    body.innerHTML = GROUPS.map(function (g) {
      return '<fieldset class="setting"><legend>' + g.legend + "</legend><p class='muted'>" + g.help + '</p><div class="seg' + (g.grid ? " grid" : "") + '">' +
        SETTING_OPTIONS[g.key].map(function (v, i) { return '<label><input type="radio" name="' + g.key + '" value="' + v + '"><span>' + (g.swatches ? '<i class="dot" style="background:linear-gradient(135deg,' + g.swatches[i][0] + " 50%," + g.swatches[i][1] + ' 50%)"></i>' : "") + g.labels[i] + "</span></label>"; }).join("") +
        "</div></fieldset>";
    }).join("") + '<p><button class="more" id="reset-settings" type="button">Reset to defaults</button></p>' +
      '<p class="muted" id="settings-note">Saved in this browser only, so your choices do not follow you to another browser or device, and clearing your browser’s site data resets them. Nothing is sent anywhere.</p>';
    var inputs = body.querySelectorAll("input");
    function sync() { Array.prototype.forEach.call(inputs, function (i) { i.checked = st[i.name] === i.value; }); }
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
      var m = /^#\/(topic|guide|site|patch|hub|system)\/(.+)$/.exec(href), arg;
      if (!m) return null;
      try { arg = decodeURIComponent(m[2]); } catch (e) { arg = m[2]; }
      if (m[1] === "topic") {
        var l = byTopic[arg]; if (!l) return null;
        var vs = vers(l), last = vs[vs.length - 1];
        return { kind: "Patch Notes topic", title: arg,
          text: D.desc && D.desc[arg] ? clip(D.desc[arg], 280) : "A topic with " + plural(l.length, "recorded change") + ".",
          meta: plural(l.length, "change") + " · last patched " + last + " (" + dateOf(last) + ")" };
      }
      if (m[1] === "patch") {
        var pl = byVersion[arg]; if (!pl) return null;
        var rel = D.releases[arg], per = group(pl, "e"), names = Object.keys(per).sort(function (a, b) { return per[b].length - per[a].length || a.localeCompare(b); });
        return { kind: "Patch", title: "Patch " + arg, text: plural(pl.length, "change") + " to " + plural(names.length, "topic") + ":",
          items: names.slice(0, 10).map(function (t) { return [t, per[t].length]; }), more: Math.max(0, names.length - 10),
          meta: "Released " + dateOf(arg) + (rel && rel.prs.length ? " · " + plural(rel.prs.length, "pull request") : "") };
      }
      if (m[1] === "hub") {
        var ht = hubs[arg]; if (!ht) return null;
        return { kind: "Patch Notes category", title: arg, text: clip(ht.slice(0, 8).join(", ") + (ht.length > 8 ? ", …" : ""), 200), meta: plural(ht.length, "topic") };
      }
      if (m[1] === "system") {
        var sl = bySystem[arg]; if (!sl) return null;
        return { kind: "Game system", title: arg, text: "Changes to the " + arg + " system.", meta: plural(sl.length, "change") };
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
      if (!a || a.classList.contains("missing") || a.hasAttribute("data-scroll") || a.getAttribute("href") === location.hash) return null;
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
  }

  /* router */
  function route() {
    var parts = location.hash.replace(/^#\/?/, "").split("/"), name = parts[0] || "home", arg = parts.slice(1).join("/");
    if (name !== "search") { try { arg = decodeURIComponent(arg); } catch (e) {} }
    if (name === "settings") { location.replace("#/"); settingsPanel.open(); return; }
    var view = views[name], res = view ? view(arg) : notFound(location.hash);
    if (!res) return;
    app.innerHTML = res.html;
    document.title = (name === "home" ? SITE : res.title.indexOf(SHORT) >= 0 ? res.title : res.title + " – " + SHORT);
    if (name !== "feedback") feedbackPage = location.href;
    var fr = document.getElementById("foot-report");
    if (fr) { fr.href = "#/feedback"; }
    var nav = { home: "home", feedback: "feedback", guide: "guide", patchnotes: "patchnotes", recent: "patchnotes", topics: "patchnotes", topic: "patchnotes", hubs: "patchnotes", hub: "patchnotes", systems: "patchnotes", system: "patchnotes", patches: "patchnotes", patch: "patchnotes", site: "site", about: "about" }[name];
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
    if (res.after) res.after();
    setMenu(false); sug.hidden = true;
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();
