/* Write a guide page (#/editor): a text box and a live preview. Loaded on first visit by lazyView() in app.js; talks to the site only through window.udfopHost. */
(function () {
  "use strict";
  var H = window.udfopHost, P = window.udfopEditor, REPO = H.REPO, enc = H.enc, esc = H.esc, slugId = H.slugId, frontMatter = H.frontMatter;
  var KEY = "udfop.editor", PAGE_KEY = "udfop.editor.page", URL_MAX = 6000;   /* longest new-file link (whole address, after encoding) offered as "Submit on GitHub"; GitHub's sign-in redirect fails above about 6,500 */
  function fileName(title) { return slugId(title).replace(/^s-|-$/g, "").replace(/^-+|-+$/g, "") + ".md"; }   /* slugId gives "s-the-title"; guide files are named the-title.md */
  function starter() { return H.guideTemplates[""] || H.FALLBACK_TPL; }
  H.views.editor = function () {
    var h = '<div class="edw"><div class="edw-bar"><div id="ed-menus" class="edw-menus"></div><span class="edw-grow"></span>' +
      '<a id="ed-gh" class="edw-primary" href="' + REPO + '/new/main/web/guide" target="_blank" rel="noopener">Submit on GitHub</a></div>' +
      '<div class="edw-main"><section class="edw-pane" aria-label="Editor"><div class="edw-pbar"><strong>Editor</strong><small id="ed-mode"></small><span class="edw-grow"></span><button type="button" id="ed-chip" class="edw-chip" aria-expanded="false" aria-controls="ed-prob"></button></div>' +
      '<div id="ed-find" class="edw-find" role="search" hidden><div class="edw-pbar"><input id="ed-fq" type="text" aria-label="Find" class="edw-fin" placeholder="Find" spellcheck="false" autocomplete="off">' +
      '<button type="button" id="ed-fprev" aria-label="Previous match" title="Previous match (Shift+Enter)">&lt;</button><button type="button" id="ed-fnext" aria-label="Next match" title="Next match (Enter)">&gt;</button>' +
      '<button type="button" id="ed-fcase" class="edw-tg" aria-pressed="false">Match case</button><button type="button" id="ed-fword" class="edw-tg" data-for="find" aria-pressed="false">Whole word</button><button type="button" id="ed-fre" class="edw-tg" data-for="find" aria-pressed="false">Regex</button>' +
      '<button type="button" id="ed-fall" class="edw-tg" aria-pressed="true">Highlight all</button>' +
      '<small id="ed-fcount" aria-live="polite"></small><span class="edw-grow"></span><button type="button" id="ed-fclose" aria-label="Close the search bar" title="Close (Esc)">Close</button></div>' +
      '<div id="ed-frep" class="edw-pbar" hidden><input id="ed-fr" type="text" aria-label="Replace with" class="edw-fin" placeholder="Replace with" spellcheck="false" autocomplete="off"><button type="button" id="ed-frone">Replace</button><button type="button" id="ed-frall">Replace All</button></div></div>' +
      '<div class="edw-stack"><div class="edw-hl edw-code" aria-hidden="true"><div id="ed-hl"></div></div><textarea id="ed-text" class="edw-code" spellcheck="true" aria-label="Page source (Markdown)"></textarea></div><div id="ed-prob" class="edw-prob" hidden><div id="ed-ph" class="edw-ph" role="separator" aria-orientation="horizontal" aria-label="Resize the Problems panel" tabindex="0"></div>' +
      '<div class="edw-pbar"><strong>Problems</strong><small id="ed-pn"></small><span class="edw-grow"></span><button type="button" id="ed-pclose" aria-label="Close the Problems panel">Close</button></div><div id="ed-plist" class="edw-plist"></div></div>' +
      '<div class="edw-sbar"><span id="ed-pos"></span><span id="ed-words"></span><span class="edw-grow"></span><small id="ed-note"></small></div></section>' +
      '<section class="edw-pane" aria-label="Preview"><div class="edw-pbar"><strong>Preview</strong><span class="edw-grow"></span><small id="ed-file"></small></div>' +
      '<div class="edw-pv" tabindex="0"><article id="ed-prev"></article></div><div class="edw-sbar"><span id="ed-size"></span></div></section></div></div>';
    return { title: "Write a guide page", html: h, toc: false, after: function () {
      var ta = document.getElementById("ed-text"), prev = document.getElementById("ed-prev"), gh = document.getElementById("ed-gh"), note = document.getElementById("ed-note"), chip = document.getElementById("ed-chip"), fileEl = document.getElementById("ed-file"), sizeEl = document.getElementById("ed-size"), prob = document.getElementById("ed-prob"), problems = [], errors = [], plist = document.getElementById("ed-plist"), timer = null, long = false;
      var saved = "", editing = null, modeEl = document.getElementById("ed-mode");   /* editing: the slug of the existing guide page the text is a copy of, or null for a new page */
      try { saved = localStorage.getItem(KEY) || ""; if (saved) editing = localStorage.getItem(PAGE_KEY) || null; } catch (e) {}
      ta.value = saved || starter();
      function setEditing(slug) {
        editing = slug || null;
        try { if (editing) localStorage.setItem(PAGE_KEY, editing); else localStorage.removeItem(PAGE_KEY); } catch (e) {}
        modeEl.textContent = editing ? "editing guide/" + editing + ".md" : "";
      }
      setEditing(editing);
      var hl = document.getElementById("ed-hl"), hlBox = hl.parentNode, paintQueued = false;
      var shown = [];   /* the rows now in the colored copy */
      var find = null;   /* the Find / Replace bar (search.js) */
      var view = null;   /* the View menu's settings and margin (viewopts.js) */
      var multi = null;   /* the extra selections (multi.js); the colored copy also draws the selection while the text box is not focused, because the browser stops drawing it then */
      ta.addEventListener("blur", function () { paintSoon(); });
      ta.addEventListener("focus", function () { paintSoon(); });
      function reveal(pos) {   /* scrolls the text box so that the line holding pos is on screen */
        var row = hl.children[P.multi.lineOfPos(P.multi.lineIndex(ta.value), pos)];
        if (!row) return;
        var r = row.getBoundingClientRect(), t = ta.getBoundingClientRect();
        if (r.top < t.top + 8) ta.scrollTop -= t.top + 8 - r.top; else if (r.bottom > t.bottom - 8) ta.scrollTop += r.bottom - (t.bottom - 8);
      }
      function paint() {   /* the colored copy of the text behind the (transparent) text box; only the rows that changed are replaced, so a long page stays quick to type in */
        paintQueued = false;
        var drawn = multi ? multi.draw(document.activeElement !== ta) : null, found = find ? find.draw() : null;
        if (found) drawn = { ranges: drawn ? drawn.ranges : [], carets: drawn ? drawn.carets : [], finds: found };
        var rows = view ? view.rows(ta.value, drawn) : P.highlightRows(ta.value, drawn), n = rows.length, m = shown.length, a = 0, b = 0;
        while (a < n && a < m && rows[a] === shown[a]) a++;
        while (b < n - a && b < m - a && rows[n - 1 - b] === shown[m - 1 - b]) b++;
        if (!m) hl.innerHTML = rows.join("");
        else {
          for (var k = m - a - b; k > 0; k--) hl.removeChild(hl.children[a]);
          var html = rows.slice(a, n - b).join("");
          if (html) { if (hl.children[a]) hl.children[a].insertAdjacentHTML("beforebegin", html); else hl.insertAdjacentHTML("beforeend", html); }
        }
        shown = rows;
        hlBox.style.setProperty("--sb", (ta.offsetWidth - ta.clientWidth) + "px");   /* the text box's scroll bar takes room the copy does not have */
        hl.style.transform = "translate(" + -ta.scrollLeft + "px," + -ta.scrollTop + "px)";
        if (view) view.after();
      }
      function paintSoon() { if (!paintQueued) { paintQueued = true; requestAnimationFrame(paint); } }
      ta.addEventListener("scroll", function () { hl.style.transform = "translate(" + -ta.scrollLeft + "px," + -ta.scrollTop + "px)"; });
      ta.addEventListener("input", paintSoon);
      if (window.ResizeObserver) { var ro = new ResizeObserver(paintSoon); ro.observe(ta); }
      function lineStart(n) { var p = 0; while (--n > 0) p = ta.value.indexOf("\n", p) + 1; return p; }
      function showProblems() {
        problems = P.lint(ta.value, editing ? { slug: editing } : null);
        problems = problems.filter(function (p) { return p.level === "error"; }).concat(problems.filter(function (p) { return p.level !== "error"; }));   /* errors first */
        errors = problems.filter(function (p) { return p.level === "error"; });
        var w = problems.length - errors.length, sum = (errors.length ? errors.length + (errors.length === 1 ? " error" : " errors") : "") + (errors.length && w ? ", " : "") + (w ? w + (w === 1 ? " warning" : " warnings") : "");
        chip.textContent = problems.length ? "Problems " + problems.length : "✓ No problems";
        chip.setAttribute("data-n", errors.length); chip.setAttribute("data-w", w);
        chip.title = sum;
        gh.setAttribute("data-n", errors.length);
        gh.title = errors.length ? "This page has " + errors.length + (errors.length === 1 ? " error" : " errors") + ": see the Problems panel" : "";
        document.getElementById("ed-pn").textContent = sum || "none";
        plist.innerHTML = problems.length ? problems.map(function (p, i) { return '<button type="button" data-i="' + i + '"><b>Line ' + p.line + '</b><span class="edw-lv" data-level="' + p.level + '">' + (p.level === "error" ? "Error" : "Warning") + "</span>" + esc(p.msg) + "</button>"; }).join("") : "<p>No problems found.</p>";
      }
      var ph = document.getElementById("ed-ph"), PKEY = "udfop.editor.prob", pbox = 0;
      try { pbox = +localStorage.getItem(PKEY) || 0; } catch (e) {}
      function setBox(px, keep) {   /* the panel's height, kept between 4rem and what leaves the text box 8rem */
        var pane = prob.parentNode.getBoundingClientRect().height, lo = 64, hi = Math.max(lo, pane - 128 - 30);
        pbox = Math.max(lo, Math.min(hi, px)); prob.style.height = pbox + "px";
        ph.setAttribute("aria-valuenow", Math.round(pbox));
        if (keep) try { localStorage.setItem(PKEY, String(pbox)); } catch (e) {}
      }
      function toggleProblems(open) {
        prob.hidden = !open; chip.setAttribute("aria-expanded", String(open));
        if (open) setBox(pbox || 160, false);
      }
      chip.addEventListener("click", function () { toggleProblems(prob.hidden); });
      document.getElementById("ed-pclose").addEventListener("click", function () { toggleProblems(false); chip.focus(); });
      ph.addEventListener("pointerdown", function (e) {
        e.preventDefault(); ph.setPointerCapture(e.pointerId);
        var y0 = e.clientY, h0 = prob.getBoundingClientRect().height;   /* move by the distance dragged, so the panel does not jump to the pointer */
        function move(ev) { setBox(h0 + y0 - ev.clientY, false); }
        function up() { ph.removeEventListener("pointermove", move); ph.removeEventListener("pointerup", up); ph.removeEventListener("pointercancel", up); setBox(pbox, true); }
        ph.addEventListener("pointermove", move); ph.addEventListener("pointerup", up); ph.addEventListener("pointercancel", up);
      });
      ph.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowUp" ? 24 : e.key === "ArrowDown" ? -24 : 0;
        if (d) { e.preventDefault(); setBox(pbox + d, true); }
      });
      function selectProblem(p) {   /* selects the text a problem is about and scrolls to it */
        var a = lineStart(p.line) + p.col, row = hl.children[p.line - 1];
        ta.focus(); ta.setSelectionRange(a, a + (p.len || 0));
        if (row) ta.scrollTop = Math.max(0, row.offsetTop - ta.clientHeight / 3);
      }
      plist.addEventListener("click", function (e) {
        var b = e.target.closest("button"), p = b && problems[+b.getAttribute("data-i")];
        if (p) selectProblem(p);
      });
      function status() {
        var v = ta.value, at = ta.selectionStart, line = v.slice(0, at).split("\n").length, col = Math.max(1, at - v.lastIndexOf("\n", at - 1));
        document.getElementById("ed-pos").textContent = "Line " + line + ", column " + col;
        document.getElementById("ed-words").textContent = (v.match(/\S+/g) || []).length.toLocaleString() + " words";
      }
      ["keyup", "click", "input", "focus"].forEach(function (ev) { ta.addEventListener(ev, status); });
      function render() {
        if (!ta.isConnected) { if (ro) ro.disconnect(); return; }
        paint();
        showProblems();
        var fm = frontMatter(ta.value), t = fm.meta.title || "Untitled page", html;
        try { html = H.renderDoc(fm.body, t, editing ? { area: "guide", key: "guide|" + editing, base: editing.indexOf("/") >= 0 ? editing.replace(/[^/]*$/, "") : "" } : { area: "guide", key: "guide|\u0000editor" }); } catch (e) { html = '<div class="mbox">The preview could not draw this text.</div>'; }
        /* the title and the breadcrumb a reader sees above the page (no breadcrumb for an unlisted page); the category link is the one the page will have in the lists */
        var unlisted = /^(yes|true|1|on)$/i.test((fm.meta.unlisted || "").trim()), cat = (fm.meta.category || "").replace(/\s+/g, " ").trim() || "General";
        prev.innerHTML = '<h1 class="title">' + esc(t) + "</h1>" + (unlisted ? "" : '<div class="hat breadcrumbs">' + H.GUIDE_HAT + ' › <a href="#/guide/category/' + enc(cat) + '">' + esc(cat) + "</a></div>") + '<div id="gp">' + html + "</div>";
        if (view) view.resync();
        if (editing) {   /* an existing page: GitHub's edit page cannot be given new text in the address, so the page is copied and pasted over the old text there */
          long = true;
          fileEl.textContent = "guide/" + editing + ".md";
          sizeEl.textContent = "Submit copies the page, then opens it on GitHub to paste over the old text";
          gh.href = REPO + "/edit/main/web/guide/" + editing.split("/").map(enc).join("/") + ".md";
          gh.textContent = "Copy and open on GitHub";
          status();
          return;
        }
        var name = fm.meta.title ? "filename=" + enc(fileName(fm.meta.title)) : "", url = REPO + "/new/main/web/guide?" + (name ? name + "&" : "") + "value=" + enc(ta.value);
        fileEl.textContent = fm.meta.title ? fileName(fm.meta.title) : "no title yet";
        long = url.length > URL_MAX;
        sizeEl.textContent = "Submit link " + url.length.toLocaleString() + " of " + URL_MAX.toLocaleString() + " characters" + (long ? ": copy and paste instead" : "");
        status();
        gh.href = long ? REPO + "/new/main/web/guide" + (name ? "?" + name : "") : url;
        gh.textContent = long ? "Copy and paste on GitHub" : "Submit on GitHub";
      }
      var holdUntil = 0;   /* a message from a command stays for a few seconds before "Draft saved" takes the place again */
      function say(m) { note.textContent = m; holdUntil = Date.now() + 5000; }
      var quiet = false;   /* after Discard draft the starter text is not saved again until the writer types */
      function persist() {
        try { localStorage.setItem(KEY, ta.value); if (Date.now() >= holdUntil) note.textContent = "Draft saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
        catch (e) { note.textContent = "Draft not saved: this browser blocks storage"; }
      }
      ta.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(function () { if (quiet) quiet = false; else persist(); render(); }, 200);
      });
      function setText(t) {   /* replaces the whole text the way typing would, so Ctrl+Z brings the old text back */
        ta.focus(); ta.select();
        var ok = false; try { ok = document.execCommand("insertText", false, t); } catch (e) {}
        if (!ok || ta.value !== t) { ta.value = t; ta.dispatchEvent(new Event("input")); }
        ta.setSelectionRange(0, 0); ta.scrollTop = 0;
        if (view) view.resetChanges();   /* a new text starts with no change marks */
      }
      function copyForGitHub() {
        var done = function () { say(editing ? "Copied: on GitHub select all the old text (Ctrl+A) and paste (Ctrl+V)" : "Copied: paste it into the GitHub page (Ctrl+V)"); };
        var fail = function () { say("Could not copy: select the text in the editor, copy it, and paste it on GitHub"); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, fail); else fail();
      }
      var dlg = P.dialog(ta.closest(".edw"));
      function askSubmit() {
        var n = errors.length, shown = errors.slice(0, 5).map(function (p, i) { return '<li><button type="button" class="edw-golink" data-v="goto:' + i + '"><b>Line ' + p.line + "</b> " + esc(p.msg) + "</button></li>"; }).join("");
        dlg.ask({ title: "This page has " + n + (n === 1 ? " error" : " errors"), html: "<ul>" + shown + "</ul>" + (n > 5 ? "<p>and " + (n - 5) + " more.</p>" : ""),
          ok: long ? (editing ? "Copy and open anyway" : "Copy and paste anyway") : "Submit anyway", cancel: "Cancel", danger: true }).then(function (go) {
          if (typeof go === "string") { toggleProblems(true); selectProblem(errors[+go.slice(5)]); return; }   /* a line in the list: go to it */
          if (!go) { toggleProblems(true); return; }
          if (long) copyForGitHub();
          window.open(gh.href, "_blank", "noopener");
        });
      }
      var fileCmd = P.fileCommands({
        ta: ta, dlg: dlg, setText: setText, starter: starter, setEditing: setEditing, save: function () { clearTimeout(timer); persist(); render(); },
        say: say,
        clearDraft: function () { quiet = true; setEditing(null); try { localStorage.removeItem(KEY); } catch (e) {} },
        fileName: function () { if (editing) return editing.split("/").pop() + ".md"; var t = frontMatter(ta.value).meta.title; return t ? fileName(t) : "new-page.md"; }
      });
      var editCmd = P.editCommands({ ta: ta, say: say });
      multi = P.multiSelect({ ta: ta, hl: hl, repaint: paintSoon, say: say, reveal: reveal });
      find = P.findBar({ ta: ta, say: say, repaint: paintSoon, reveal: reveal, clear: function () { multi.clear(); }, selectAll: function (r, i) { multi.selectRanges(r, i); } });
      view = P.viewControls({ ta: ta, hl: hl, hlBox: hlBox, pv: prev.parentNode, prev: prev, repaint: paintSoon, say: say });
      var complete = P.completion({ ta: ta, hl: hl, multi: multi, H: H, say: say });   /* before the keys below, so that its Enter, Tab and Backspace come first */
      function runFile(cmd) { fileCmd(cmd); if (cmd === "file.save") view.markSaved(); }
      function runEdit(cmd) { if (!multi.run(cmd)) editCmd(cmd); }   /* with several selections the command is run for each of them */
      var help = P.helpWindow({ host: document.querySelector(".edw-main"), H: H, back: function (toMenu) { return toMenu ? document.querySelector('#ed-menus [data-cmd="help.open"]') : ta; } });
      function columnModeHelp() {
        dlg.ask({ title: "Column mode", ok: "OK", html: "<p>Column mode puts a cursor on several lines at once, one under the other, so that you can type, delete or paste on all of them together.</p>" +
          "<ul><li><b>Alt + Shift + Down</b> adds a cursor on the next line down, in the same column. <b>Alt + Shift + Up</b> adds one above. Pressing the opposite key takes the last one away.</li>" +
          "<li><b>Alt + drag</b> with the mouse selects a rectangle: every line it crosses is selected over the same columns. A line that is shorter is selected only as far as it goes.</li>" +
          "<li>Then type, press Backspace or Delete, paste (one line at each cursor if the clipboard has as many lines), or use the arrow keys, Home and End, which move every cursor.</li>" +
          "<li><b>Escape</b> or a click puts you back to one cursor. One Ctrl+Z undoes the change at all of them.</li></ul>" +
          "<p>Some Linux desktops keep Alt + drag for moving windows; use Alt + Shift + Up and Down there. Ctrl + click adds a cursor anywhere, and Edit > Multi-Select All selects every match of the text you have selected.</p>" });
      }
      var SEARCH = { "search.find": "find", "search.replace": "replace", "search.inc": "inc", "search.findall": "findall" };
      P.menubar(document.getElementById("ed-menus"), function (cmd) { if (SEARCH[cmd]) find.open(SEARCH[cmd]); else if (cmd === "help.open") help.toggle(); else if (cmd === "edit.columnmode") columnModeHelp(); else if (cmd.indexOf("edit.") === 0 || cmd.indexOf("format.") === 0) runEdit(cmd); else if (cmd.indexOf("view.") === 0) view.run(cmd); else runFile(cmd); }, view.checked, function (cmd) { return cmd !== "format.snip.front" || !P.fmt.hasFrontMatter(ta.value); });
      function keys(e) {   /* Ctrl+S saves the draft now and Ctrl+O opens a file, anywhere in the editor */
        if (!ta.isConnected) { document.removeEventListener("keydown", keys); return; }
        if (e.key === "F1" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) { e.preventDefault(); help.toggle(); return; }   /* F1: Help, from anywhere in the editor */
        if (!(e.ctrlKey || e.metaKey)) return;
        if (view.zoomKey(e)) return;   /* Ctrl + plus, minus, 0 in a pane; elsewhere the browser zooms the page */
        if (e.shiftKey) return;
        if (e.altKey) {   /* Ctrl+Alt+I: incremental search (not on a keyboard where Ctrl+Alt is AltGr) */
          if (e.code === "KeyI" && !(e.getModifierState && e.getModifierState("AltGraph"))) { e.preventDefault(); find.open("inc"); }
          return;
        }
        var k = e.key.toLowerCase();
        if (k === "s") { e.preventDefault(); runFile("file.save"); } else if (k === "o") { e.preventDefault(); runFile("file.open"); }
        else if (k === "f") { e.preventDefault(); find.open("find"); } else if (k === "h") { e.preventDefault(); find.open("replace"); }
      }
      document.addEventListener("keydown", keys);
      /* the text box's own keys. Tab indents, so Esc then Tab is how the keyboard leaves the box. */
      var leaveNext = false, FORMAT_KEYS = { b: "format.bold", i: "format.italic", e: "format.code", k: "format.wiki", 2: "format.h.2", 3: "format.h.3", 4: "format.h.4", 5: "format.h.5", 6: "format.h.6" };
      ta.addEventListener("keydown", function (e) {
        var ctrl = e.ctrlKey || e.metaKey, alt = e.altKey, shift = e.shiftKey, k = e.key;
        if (k === "Escape" && !ctrl && !alt && !shift) { leaveNext = true; return; }
        if (k === "Tab" && !ctrl && !alt) {
          if (leaveNext) { leaveNext = false; return; }
          e.preventDefault(); runEdit(shift ? "edit.shifttab" : "edit.tab"); return;
        }
        leaveNext = false;
        if (k === "Home" && !ctrl && !alt) { e.preventDefault(); runEdit(shift ? "edit.homeextend" : "edit.home"); return; }
        if (e.getModifierState && e.getModifierState("AltGraph")) return;   /* AltGr is Ctrl+Alt on some keyboards and types a letter */
        var cmd = "";
        if (e.code === "KeyU") {
          if (ctrl && shift && !alt) cmd = "edit.case.upper"; else if (ctrl && !shift && !alt) cmd = "edit.case.lower";
          else if (alt && !ctrl && !shift) cmd = "edit.case.proper"; else if (ctrl && alt && !shift) cmd = "edit.case.sentence";
        } else if (ctrl && !shift && !alt && FORMAT_KEYS[k.toLowerCase()]) cmd = FORMAT_KEYS[k.toLowerCase()];
        else if (ctrl && shift && !alt && k === "ArrowUp") cmd = "edit.lines.moveup";
        else if (ctrl && shift && !alt && k === "ArrowDown") cmd = "edit.lines.movedown";
        if (cmd) { e.preventDefault(); runEdit(cmd); }
      });
      gh.addEventListener("click", function (e) {
        if (errors.length) { e.preventDefault(); askSubmit(); return; }
        if (long) copyForGitHub();
      });
      H.onLintData(function () { if (ta.isConnected) { showProblems(); complete.refresh(); } });
      render();
      var want = H.query().page;   /* #/editor?page=slug: open that guide page (the address is cleaned so a reload does not ask again) */
      if (want) { try { history.replaceState(null, "", "#/editor"); } catch (e) {} fileCmd.loadPage(want); }
      if (!saved && !H.guideTemplates[""]) {   /* the template is still arriving: swap it in unless the reader has started typing */
        var tries = 0, wait = setInterval(function () {
          if (++tries > 20 || !ta.isConnected || ta.value !== H.FALLBACK_TPL) { clearInterval(wait); return; }
          if (H.guideTemplates[""]) { clearInterval(wait); ta.value = starter(); render(); }
        }, 100);
      }
      var lw = 0, ready = setInterval(function () {   /* the page lists load in the background; links to existing pages then stop looking missing */
        if (!ta.isConnected || ++lw > 50) { clearInterval(ready); return; }
        if (H.guideReady()) { clearInterval(ready); render(); }
      }, 200);
    } };
  };
})();
