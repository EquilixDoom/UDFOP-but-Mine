/* The guide editor: the Problems checks and the first-placeholder finder.
   A problem is { level: "error" | "warn", line, col, len, msg }. Errors would break the page or clash with another (they block Submit); warnings are worth a look.
   The checks follow tools/guide.py and the site's renderer. Data that has to be fetched (another page's headings, whether a picture exists) comes from the host as null until it arrives; the host then calls back and the view checks again. */
(function () {
  "use strict";
  var H = window.udfopHost, P = window.udfopEditor = window.udfopEditor || {};
  var splitSection = H.splitSection, frontMatter = H.frontMatter;
  var MAX_LINE = 2000;   /* a longer line is not read for links, pictures and spoilers (the patterns would rescan it from every opening bracket) */
  var FENCE = /^(`{3,}|~{3,})\s*([A-Za-z0-9+#.-]{1,20})?\s*$/, FENCE_END = /^(`{3,}|~{3,})\s*$/;
  var NOTICES = /^(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO)$/i, INFO_START = /^>\s*\[!INFO\]/i;
  var IMAGE = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)(?:\{[^}]*\})?/g, FIGURE = /^!\[[^\]]*\]\([^)\s]+(?:\s+"[^"]*")?\)\{([^}]*)\}\s*$/;
  var PIC_LINK = /\[!\[[^\]]*\]\([^()\s]*(?:\s+"[^"]*")?\)(?:\{[^}]*\})?[^\]]*\]\([^()\s]*\)/g;
  var HTMLISH = /<\s*\/?\s*(script|iframe|object|embed|style|img|a)\b|javascript:|\bon[a-z]+\s*=|[\x00-\x08\x0b\x0c\x0e-\x1f]/i;
  var FN_DEF = /^\[\^([^\]\s]+)\]:/, FN_REF = /\[\^([^\]\s]+)\]/g;
  function pad(n) { return new Array(n + 1).join(" "); }
  /* inline code is blanked the way the renderer reads it: a run of backticks closed by a run of the same length */
  function blankSpans(s) {
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
      var end = close + len; out += pad(end - run); i = end;
    }
    return out;
  }
  /* the id a heading gets: the words without markup, lower case, runs of other characters as hyphens (the site's slugId) */
  function headingId(t) {
    t = t.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, function (m, a, b) { return b || a; }).replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/>!(.+?)!</g, "$1").replace(/[*_`]/g, "");
    return "s-" + t.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }
  /* the ids of a body's headings down to ### (headings inside code boxes get none) */
  function headingIds(body) {
    var ids = {}, fence = null;
    body.split("\n").forEach(function (l) {
      if (fence) { var c = FENCE_END.exec(l); if (c && c[1].charAt(0) === fence.charAt(0) && c[1].length >= fence.length) fence = null; return; }
      var f = FENCE.exec(l); if (f) { fence = f[1]; return; }
      var m = /^#{1,3}\s+(.*?)(?:\s+#+)?\s*$/.exec(l); if (m) ids[headingId(m[1])] = 1;
    });
    return ids;
  }
  function sectionIn(source, section) { return source == null ? true : !!headingIds(frontMatter(source).body)[headingId(section)]; }   /* not fetched yet: nothing to report */
  /* a picture's path from the guide folder: beside the page being edited, or in the guide folder itself for a new page. null when it climbs out with ../ (not checked). */
  function pictureAt(ref, opts) {
    var folder = opts && opts.slug && opts.slug.indexOf("/") >= 0 ? opts.slug.replace(/[^/]*$/, "") : "", out = [], parts = (folder + ref).split("/");
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === "..") { if (!out.length) return null; out.pop(); } else if (parts[i] !== "." && parts[i] !== "") out.push(parts[i]);
    }
    return out.join("/");
  }
  function listOf(s) { return (s || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
  /* does a [[target]] lead somewhere? (used by the guide-page checks that only need a yes or no) */
  function edLinkOk(inner) {
    var raw = inner.split("|")[0].trim(), low = raw.toLowerCase();
    if (!raw || /^(topic|patch):/.test(low) || raw.charAt(0) === "#") return true;
    var site = low.indexOf("site:") === 0, k = splitSection(low.replace(/^(site|guide):\s*/, ""))[0];
    return H.pageExists(k, site);
  }
  /* problems, each with the line it is on */
  /* opts.slug: the guide page being edited (its own title and file name are not a clash, and its pictures are found beside it) */
  function edLint(text, opts) {
    var out = [], lines = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").split("\n"), meta = frontMatter(text).meta;
    function add(level, i, col, len, msg) { out.push({ level: level, line: i + 1, col: col, len: len, msg: msg }); }
    var top = function (level, msg) { add(level, 0, 0, lines[0].length, msg); };
    var start = 0;
    if (lines[0] === "---") {
      var end = -1; for (var k = 2; k < lines.length; k++) if (lines[k].indexOf("---") === 0) { end = k; break; }
      if (end < 0) top("error", "The front matter at the top has no closing --- line."); else start = end + 1;
    }
    var body = lines.slice(start).join("\n");
    if (!meta.title) top("error", "No title: add a title: line to the front matter.");
    if (!meta.summary) top("warn", "No summary: it is the text shown in hover previews and lists.");
    if (!("authors" in meta)) top("warn", "No authors: line: add one with the names of the people who wrote the page (comma separated).");
    else if (!meta.authors.trim()) {
      var ai = 0; for (var q = 0; q < lines.length; q++) if (/^authors:/i.test(lines[q])) { ai = q; break; }
      add("warn", ai, 0, lines[ai].length, "The authors: line is empty: add the names of the people who wrote the page (comma separated).");
    }
    if (!body.trim()) top("error", "The page is empty.");
    if (meta.title && H.pageExists) {
      var low = meta.title.trim().toLowerCase(), slug = low.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), self = opts && opts.slug ? opts.slug.toLowerCase() : null, clash;
      if (H.pageList) clash = H.pageList(false).filter(function (p) { return (p.slug || "").toLowerCase() !== self; }).concat(H.pageList(true)).some(function (p) {
        var t = p.title.toLowerCase(), n = (p.slug || "").toLowerCase();
        return t === low || n === low || (slug && (t === slug || n === slug));
      });
      else clash = !self && (H.pageExists(low, false) || H.pageExists(low, true) || (slug && (H.pageExists(slug, false) || H.pageExists(slug, true))));
      if (clash) top("error", "A page called \"" + meta.title + "\" already exists (titles and file names must be unique across both guides). Choose another title.");
    }
    if (meta.category && H.pageList) {
      var cat = meta.category.replace(/\s+/g, " ").trim(), seen = {};
      H.pageList(false).concat(H.pageList(true)).forEach(function (p) { var c = (p.category || "").replace(/\s+/g, " ").trim(); if (c && c !== cat && c.toLowerCase() === cat.toLowerCase()) seen[c] = 1; });
      Object.keys(seen).forEach(function (c) { top("warn", "The category is spelled \"" + cat + "\" here but \"" + c + "\" on existing pages. Use one spelling."); });
    }
    listOf(meta.related).forEach(function (name) {
      var m = /^(guide|site|topic|patch)\s*:\s*(.*)$/i.exec(name), kind = m ? m[1].toLowerCase() : "", rest = (m ? m[2] : name).trim(), ok = true;
      if (kind === "topic") ok = !H.topicExists || H.topicExists(rest.toLowerCase());
      else if (kind === "patch") ok = !H.patchExists || H.patchExists(rest);
      else if (H.pageExists) ok = H.pageExists(rest.toLowerCase(), kind === "site");
      if (!ok) top("warn", "related: \"" + name + "\" matches no " + (kind === "patch" ? "patch" : kind === "topic" ? "topic" : kind === "site" ? "Site Guide page" : "Game Guide page") + ".");
    });
    var m0 = HTMLISH.exec(body);
    if (m0) { var at = body.slice(0, m0.index).split("\n").length - 1 + start; add("warn", at, 0, lines[at].length, "Contains HTML tags, script-like text or control characters: the site shows these as plain text, but a reviewer will look."); }
    var langs = (window.udfopHighlight && window.udfopHighlight.names) || null, own = headingIds(body), expected = {};
    listOf(meta["expected-missing"]).forEach(function (n) { expected[n.toLowerCase()] = 1; });
    var fence = null, fenceAt = 0, boxes = 0, firstLine = -1, inInfo = false, fnDefs = {}, fnRefs = {}, fnIn = false;
    for (var i = start; i < lines.length; i++) {
      var l = lines[i], m, a;
      if (firstLine < 0 && l.trim()) firstLine = i;
      if (fence) { var c = FENCE_END.exec(l); if (c && c[1].charAt(0) === fence.charAt(0) && c[1].length >= fence.length) fence = null; continue; }
      m = FENCE.exec(l);
      if (m) {
        fence = m[1]; fenceAt = i;
        if (m[2] && langs && langs.indexOf(m[2].toLowerCase()) < 0) add("warn", i, l.indexOf(m[2], m[1].length), m[2].length, "Unknown code language: " + m[2] + " (the box shows uncolored).");
        continue;
      }
      if (/^(`{3,}|~{3,})[^`]*\S/.test(l) && !/^(`{3,})[^`]*`/.test(l)) add("warn", i, 0, l.length, "This line looks like the start of a code box, but only a language name may follow the backticks. The site shows it as plain text.");
      if (l.length > MAX_LINE) { add("warn", i, 0, 0, "This line is " + l.length.toLocaleString() + " characters long: it is not checked for links, pictures or spoilers. Break it into shorter lines."); continue; }
      if ((a = /^(#{1,6})[^#\s]/.exec(l))) add("warn", i, 0, a[1].length, "This looks like a heading, but there is no space after the " + a[1] + ". Add one, or the line is shown as plain text.");
      var scan = blankSpans(l);   /* what is written inside `code` is only text */
      var fd = FN_DEF.exec(l);   /* footnotes: a note line [^id]: text (and its indented lines), and references [^id] elsewhere */
      if (fd) { fnIn = true; if (fnDefs[fd[1]]) add("error", i, 0, fd[0].length, "The footnote [^" + fd[1] + "] is already defined on line " + (fnDefs[fd[1]].line + 1) + "; only the first is used."); else fnDefs[fd[1]] = { line: i, len: fd[0].length }; }
      else if (!(fnIn && /^\s{2,}\S/.test(l))) {
        fnIn = false; var fr; FN_REF.lastIndex = 0;
        while ((fr = FN_REF.exec(scan))) (fnRefs[fr[1]] = fnRefs[fr[1]] || []).push({ line: i, col: fr.index, len: fr[0].length });
      }
      if ((a = /^>\s*\[!([A-Za-z]+)\]/.exec(l)) && !NOTICES.test(a[1])) add("warn", i, a[0].indexOf("[!"), a[0].length - a[0].indexOf("[!"), "Unknown box type: [!" + a[1] + "].");
      if (INFO_START.test(l)) {
        boxes++; inInfo = true;
        if (i !== firstLine) add("warn", i, 0, l.length, "The infobox is not the first thing on the page; move it to the top, right after the front matter.");
        if (boxes === 2) add("warn", i, 0, l.length, "The page has more than one infobox; one is enough, and a table can hold the rest.");
      } else if (inInfo && l.charAt(0) === ">") {
        var row = l.replace(/^>\s?/, "").trim(), r = /^([^:|]{1,40}?)\s*:\s*(.*)$/.exec(row);
        if (r && !r[2].trim()) add("warn", i, 0, l.length, /^image$/i.test(r[1]) ? "The infobox has an \"image:\" line with no picture path." : "The infobox row \"" + r[1].trim() + "\" has no value.");
      } else inInfo = false;
      if (scan.replace(/>!(.+?)!</g, pad(0)).indexOf(">!") >= 0) add("warn", i, scan.indexOf(">!"), 2, "This spoiler is never closed: write !< after the hidden text, on the same line.");
      var pl; PIC_LINK.lastIndex = 0;
      while ((pl = PIC_LINK.exec(scan))) add("error", i, pl.index, pl[0].length, "A picture cannot be inside a link, so this is shown as plain text. Put the picture and the link on separate lines.");
      var im; IMAGE.lastIndex = 0;
      while ((im = IMAGE.exec(scan))) {
        var ref = im[1];
        if (/^([a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(ref) || !H.fileExists) continue;
        var pic = pictureAt(ref, opts);
        if (pic && H.fileExists(pic) === false) add("error", i, im.index, im[0].length, "The picture \"" + ref + "\" does not exist. A picture cannot be added from this editor: add it in the pull request, in an images folder.");
      }
      var fg = FIGURE.exec(scan);
      if (fg) fg[1].trim().toLowerCase().split(/[\s,]+/).filter(Boolean).forEach(function (tok) {
        if (tok === "left" || tok === "right" || tok === "center") return;
        if (/^\d+(px)?$/.test(tok)) { var w = parseInt(tok, 10); if (w < 40 || w > 1200) add("warn", i, 0, l.length, "Picture width " + tok + " is outside 40 to 1200 pixels."); return; }
        add("warn", i, 0, l.length, "Unknown picture option \"" + tok + "\" in braces (use left, right, center and a width in pixels).");
      });
      if (/^\s*\|[\s|:\-{}a-z,]*$/.test(l) && /-{2,}\{/.test(l)) l.replace(/\{([^}]*)\}/g, function (m, words, at) {   /* a table's divider row: {tags} name a column type, or label */
        words.trim().toLowerCase().split(/[\s,]+/).filter(Boolean).forEach(function (tok) {
          if (["num", "pct", "dur", "date", "bool", "text", "label"].indexOf(tok) < 0) add("warn", i, at, m.length, "Unknown column tag \"" + tok + "\" in braces (use num, pct, dur, date, bool, text, or label for the first column).");
        });
        return m;
      });
      if (/^\s*\|/.test(l)) scan = scan.replace(/\\\|/g, " |");   /* in a table row \| is a pipe inside a cell: [[Page\|label]] */
      var w, re = /\[\[([^\]|]+)/g;
      while ((w = re.exec(scan))) {
        var shown = w[1].trim(), len = w[0].length + (l.substr(w.index + w[0].length, 2) === "]]" ? 2 : 0), lk = /^(topic|patch|guide|site)\s*:\s*(.*)$/i.exec(shown);
        var kind = lk ? lk[1].toLowerCase() : "guide", rest = lk ? lk[2].trim() : shown, parts = splitSection(rest), name = parts[0], section = parts[1], t = name.toLowerCase();
        function link(level, msg) { add(level, i, w.index, len, msg); }
        if (kind === "topic" || kind === "patch") {
          if (section) link("warn", "[[" + shown + "]]: a link to a topic or a patch cannot name a section, so it shows as plain text.");
          else if (kind === "topic" && H.topicExists && !H.topicExists(t)) link("warn", "No Patch Notes topic is called \"" + name + "\" ([[" + shown + "]] shows as plain text).");
          else if (kind === "patch" && H.patchExists && !H.patchExists(name)) link("warn", "There is no patch " + name + " ([[" + shown + "]] shows as plain text).");
        } else if (!name) {
          if (!section || !own[headingId(section)]) link("warn", "[[" + shown + "]]: this page has no section called \"" + section + "\".");
        } else if (kind === "site") {
          if (!H.pageExists(t, true)) link("warn", "No Site Guide page is called \"" + name + "\" ([[" + shown + "]] shows as plain text).");
          else if (section && !sectionIn(H.pageSource && H.pageSource(t, true), section)) link("warn", "[[" + shown + "]]: that Site Guide page has no section called \"" + section + "\".");
        } else if (H.pageExists(t, false)) {
          if (section && !sectionIn(H.pageSource && H.pageSource(t, false), section)) link("warn", "[[" + shown + "]]: that page has no section called \"" + section + "\".");
        } else if (!expected[t]) {
          if (H.pageExists(t, true)) link("warn", "[[" + shown + "]] is a Site Guide page, not a Game Guide page. A Site Guide page is linked on purpose: [[site:" + rest + "]].");
          else if (H.topicExists && H.topicExists(t)) link("warn", "[[" + shown + "]] is a Patch Notes topic, not a guide page. A topic is linked on purpose: [[topic:" + rest + "]].");
          else link("warn", "No page yet for [[" + shown + "]] (it shows as a red link).");
        }
      }
    }
    Object.keys(fnRefs).forEach(function (id) {
      if (!fnDefs[id]) fnRefs[id].forEach(function (r) { add("error", r.line, r.col, r.len, "The footnote [^" + id + "] has no note, so it is shown as written. Add a line \"[^" + id + "]: the note\"."); });
    });
    Object.keys(fnDefs).forEach(function (id) {
      if (!fnRefs[id]) add("warn", fnDefs[id].line, 0, fnDefs[id].len, "The footnote [^" + id + "] is never used, so it is not shown. Add [^" + id + "] where it belongs in the text.");
    });
    if (fence) add("error", fenceAt, 0, lines[fenceAt].length, "This code box is never closed, so the rest of the page is shown as code. Close it with a line of " + fence + ".");
    return out;
  }
  /* the first *[bracketed line]* of a template that is not inside its opening Tip box: where a new writer starts typing */
  function edFirstPlaceholder(text) {
    var pos = 0, tip = false, found = null;
    text.split("\n").some(function (l) {
      if (/^>\s*\[!TIP\]/i.test(l)) tip = true; else if (!/^>/.test(l)) tip = false;
      var m = !tip && /\*\[[^\]\n]+\]\*/.exec(l);
      if (m) { found = [pos + m.index, pos + m.index + m[0].length]; return true; }
      pos += l.length + 1; return false;
    });
    return found;
  }
  P.FENCE = FENCE; P.MAX_LINE = MAX_LINE; P.linkOk = edLinkOk; P.lint = edLint; P.firstPlaceholder = edFirstPlaceholder; P.headingIds = headingIds; P.headingId = headingId;
})();
