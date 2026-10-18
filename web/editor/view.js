/* Write a guide page (#/editor): a text box and a live preview. Loaded on first visit by lazyView() in app.js; talks to the site only through window.udfopHost. */
(function () {
  "use strict";
  var H = window.udfopHost, P = window.udfopEditor, REPO = H.REPO, enc = H.enc, esc = H.esc, slugId = H.slugId, frontMatter = H.frontMatter;
  var KEY = "udfop.editor", URL_MAX = 6000;   /* longest new-file link (whole address, after encoding) offered as "Submit on GitHub"; GitHub's sign-in redirect fails above about 6,500 */
  function fileName(title) { return slugId(title).replace(/^s-|-$/g, "").replace(/^-+|-+$/g, "") + ".md"; }   /* slugId gives "s-the-title"; guide files are named the-title.md */
  function starter() { return H.guideTemplates[""] || H.FALLBACK_TPL; }
  H.views.editor = function () {
    var h = '<div class="edw"><div class="edw-bar"><strong>Write a guide page</strong><span class="edw-grow"></span>' +
      '<a id="ed-gh" class="edw-primary" href="' + REPO + '/new/main/web/guide" target="_blank" rel="noopener">Submit on GitHub</a></div>' +
      '<div class="edw-main"><section class="edw-pane" aria-label="Editor"><div class="edw-pbar"><strong>Editor</strong><span class="edw-grow"></span><button type="button" id="ed-chip" class="edw-chip" aria-expanded="false" aria-controls="ed-prob"></button></div>' +
      '<textarea id="ed-text" spellcheck="true" aria-label="Page source (Markdown)"></textarea><div id="ed-prob" class="edw-prob" hidden><div id="ed-ph" class="edw-ph" role="separator" aria-orientation="horizontal" aria-label="Resize the Problems panel" tabindex="0"></div>' +
      '<div class="edw-pbar"><strong>Problems</strong><small id="ed-pn"></small><span class="edw-grow"></span><button type="button" id="ed-pclose" aria-label="Close the Problems panel">Close</button></div><div id="ed-plist" class="edw-plist"></div></div>' +
      '<div class="edw-sbar"><span id="ed-pos"></span><span id="ed-words"></span><span class="edw-grow"></span><small id="ed-note"></small></div></section>' +
      '<section class="edw-pane" aria-label="Preview"><div class="edw-pbar"><strong>Preview</strong><span class="edw-grow"></span><small id="ed-file"></small></div>' +
      '<div class="edw-pv"><article id="ed-prev"></article></div><div class="edw-sbar"><span id="ed-size"></span></div></section></div></div>';
    return { title: "Write a guide page", html: h, toc: false, after: function () {
      var ta = document.getElementById("ed-text"), prev = document.getElementById("ed-prev"), gh = document.getElementById("ed-gh"), note = document.getElementById("ed-note"), chip = document.getElementById("ed-chip"), fileEl = document.getElementById("ed-file"), sizeEl = document.getElementById("ed-size"), prob = document.getElementById("ed-prob"), problems = [], errors = [], plist = document.getElementById("ed-plist"), timer = null, long = false;
      var saved = ""; try { saved = localStorage.getItem(KEY) || ""; } catch (e) {}
      ta.value = saved || starter();
      function lineStart(n) { var p = 0; while (--n > 0) p = ta.value.indexOf("\n", p) + 1; return p; }
      function showProblems() {
        problems = P.lint(ta.value);
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
      plist.addEventListener("click", function (e) {
        var b = e.target.closest("button"), p = b && problems[+b.getAttribute("data-i")];
        if (!p) return;
        var a = lineStart(p.line) + p.col; ta.focus(); ta.setSelectionRange(a, a + (p.len || 0));
      });
      function status() {
        var v = ta.value, at = ta.selectionStart, line = v.slice(0, at).split("\n").length, col = Math.max(1, at - v.lastIndexOf("\n", at - 1));
        document.getElementById("ed-pos").textContent = "Line " + line + ", column " + col;
        document.getElementById("ed-words").textContent = (v.match(/\S+/g) || []).length.toLocaleString() + " words";
      }
      ["keyup", "click", "input", "focus"].forEach(function (ev) { ta.addEventListener(ev, status); });
      function render() {
        if (!ta.isConnected) return;
        showProblems();
        var fm = frontMatter(ta.value), t = fm.meta.title || "Untitled page", html;
        try { html = H.renderDoc(fm.body, t, { area: "guide", key: "guide|\u0000editor" }); } catch (e) { html = '<div class="mbox">The preview could not draw this text.</div>'; }
        prev.innerHTML = '<h1 class="title">' + esc(t) + '</h1><div id="gp">' + html + "</div>";
        var name = fm.meta.title ? "filename=" + enc(fileName(fm.meta.title)) : "", url = REPO + "/new/main/web/guide?" + (name ? name + "&" : "") + "value=" + enc(ta.value);
        fileEl.textContent = fm.meta.title ? fileName(fm.meta.title) : "no title yet";
        long = url.length > URL_MAX;
        sizeEl.textContent = "Submit link " + url.length.toLocaleString() + " of " + URL_MAX.toLocaleString() + " characters" + (long ? ": copy and paste instead" : "");
        status();
        gh.href = long ? REPO + "/new/main/web/guide" + (name ? "?" + name : "") : url;
        gh.textContent = long ? "Copy and paste on GitHub" : "Submit on GitHub";
      }
      ta.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(function () { try { localStorage.setItem(KEY, ta.value); note.textContent = "Draft saved"; } catch (e) { note.textContent = "Draft not saved: this browser blocks storage"; } render(); }, 200);
      });
      function copyForGitHub() {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { note.textContent = "Copied: paste it into the GitHub page (Ctrl+V)"; });
      }
      var dlg = document.createElement("dialog");
      dlg.className = "edw-dlg"; dlg.setAttribute("aria-labelledby", "ed-dt");
      ta.closest(".edw").appendChild(dlg);
      function askSubmit() {
        var n = errors.length, shown = errors.slice(0, 5).map(function (p) { return "<li><b>Line " + p.line + "</b> " + esc(p.msg) + "</li>"; }).join("");
        dlg.innerHTML = '<h2 id="ed-dt">This page has ' + n + (n === 1 ? " error" : " errors") + "</h2><ul>" + shown + "</ul>" + (n > 5 ? "<p>and " + (n - 5) + " more.</p>" : "") +
          '<div class="edw-dlg-btns"><button type="button" id="ed-dcancel" autofocus>Cancel</button><button type="button" id="ed-dgo">' + (long ? "Copy and paste anyway" : "Submit anyway") + "</button></div>";
        document.getElementById("ed-dcancel").addEventListener("click", function () { dlg.close(); toggleProblems(true); });
        document.getElementById("ed-dgo").addEventListener("click", function () { dlg.close(); if (long) copyForGitHub(); window.open(gh.href, "_blank", "noopener"); });
        dlg.showModal();
      }
      gh.addEventListener("click", function (e) {
        if (errors.length) { e.preventDefault(); askSubmit(); return; }
        if (long) copyForGitHub();
      });
      H.onLintData(function () { if (ta.isConnected) showProblems(); });
      render();
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
