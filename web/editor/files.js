/* Write a guide page: the File menu's commands (templates, open, open a guide page, save, download, discard). Run by view.js with the editor's pieces in ctx;
   returns a function that takes a command name, with loadPage(slug) on it for the ?page= address. */
(function () {
  "use strict";
  var H = window.udfopHost, P = window.udfopEditor = window.udfopEditor || {};
  var MAX_BYTES = 2 * 1024 * 1024, TEXT_FILE = /\.(md|markdown|mdown|txt)$/i;
  P.fileCommands = function (ctx) {
    var ta = ctx.ta, dlg = ctx.dlg;
    function selectPlaceholder() {   /* on a new page the first bracketed line is selected, so typing replaces it */
      var r = P.firstPlaceholder(ta.value);
      ta.focus(); ta.setSelectionRange(r ? r[0] : 0, r ? r[1] : 0); ta.scrollTop = 0;
    }
    function trivial() {   /* nothing the writer would miss: empty, or still exactly a template */
      var v = ta.value.trim();
      return !v || v === H.FALLBACK_TPL.trim() || Object.keys(H.guideTemplates).some(function (k) { return H.guideTemplates[k] && H.guideTemplates[k].trim() === v; });
    }
    function download() {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([ta.value], { type: "text/markdown" }));
      a.download = ctx.fileName(); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      ctx.say("Downloaded " + a.download);
    }
    /* puts new text in the editor; when that would lose the writer's text, asks first and offers to download it. o: { pre (before the text changes), post (after) } */
    function replaceWith(text, what, o) {
      function put() { if (o.pre) o.pre(); ctx.setText(text); if (o.post) o.post(); }
      if (trivial()) { put(); return; }
      dlg.ask({ title: "Replace the text with " + what + "?", text: "The text now in the editor is replaced. Undo (Ctrl+Z) brings it back, or you can save a copy to this device first.", ok: "Replace text", extra: "Download, then replace", cancel: "Cancel" }).then(function (r) {
        if (r === "extra") { download(); put(); } else if (r) put();
      });
    }
    function newPage(then) { return { pre: function () { ctx.setEditing(null); }, post: then }; }
    function template(key) {
      var t = H.guideTemplates[key];
      if (key && !t) { dlg.notice("The template has not loaded", "Check your connection and try again."); return; }
      replaceWith(t || H.FALLBACK_TPL, "this template", newPage(function () { selectPlaceholder(); ctx.say("New page from the template"); }));
    }
    var input = document.createElement("input");
    input.type = "file"; input.accept = ".md,.markdown,.mdown,.txt,text/markdown,text/plain"; input.hidden = true;
    ta.closest(".edw").appendChild(input);
    input.addEventListener("change", function () {
      var f = input.files && input.files[0]; input.value = "";
      if (!f) return;
      if (!TEXT_FILE.test(f.name) && !/^text\//.test(f.type)) { dlg.notice("Cannot open " + f.name, "Choose a Markdown or text file (.md, .markdown, .mdown or .txt)."); return; }
      if (f.size > MAX_BYTES) { dlg.notice("Cannot open " + f.name, "The file is over 2 MB. A guide page is much smaller than that."); return; }
      f.text().then(function (raw) {
        if (raw.indexOf("\u0000") >= 0) { dlg.notice("Cannot open " + f.name, "The file is not text."); return; }
        replaceWith(raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n"), "the file " + f.name, newPage(function () { ta.focus(); ta.setSelectionRange(0, 0); ctx.say("Opened " + f.name); }));
      }, function () { dlg.notice("Cannot open " + f.name, "The browser could not read the file."); });
    });
    /* an existing Game Guide page: its source is fetched from the site and the editor goes into editing mode for that file */
    function loadPage(slug) {
      var entry = H.guideReady() ? H.pageList(false).filter(function (p) { return p.slug.toLowerCase() === slug.toLowerCase() || p.title.toLowerCase() === slug.toLowerCase(); })[0] : null;
      if (entry) slug = entry.slug;
      fetch("guide/" + slug.split("/").map(encodeURIComponent).join("/") + ".md").then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (raw) {
        replaceWith(raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n"), "the page " + (entry ? entry.title : slug), {
          pre: function () { ctx.setEditing(slug); },
          post: function () { ta.focus(); ta.setSelectionRange(0, 0); ctx.say("Editing guide/" + slug + ".md"); }
        });
      }, function () { dlg.notice("Cannot open the page", "The page \"" + slug + "\" could not be loaded. Check your connection and try again."); });
    }
    function openPage() {
      if (!H.guideReady()) { dlg.notice("The page list is still loading", "Try again in a moment."); return; }
      var pages = H.pageList(false).slice().sort(function (a, b) { return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1; });
      dlg.pick({ title: "Open a guide page", placeholder: "Type to filter by title or category", items: pages.map(function (p) { return { label: p.title, detail: p.category + (p.slug.indexOf("/") >= 0 ? " · " + p.slug : ""), value: p.slug }; }) })
        .then(function (slug) { if (slug) loadPage(slug); });
    }
    function discard() {
      dlg.ask({ title: "Discard this draft?", text: "The saved draft is deleted and a new page starts from the template. You can save a copy to this device first.", ok: "Discard draft", extra: "Download, then discard", cancel: "Cancel", danger: true }).then(function (r) {
        if (!r) return;
        if (r === "extra") download();
        ctx.clearDraft(); ctx.setText(ctx.starter()); selectPlaceholder(); ctx.say("Draft discarded");
      });
    }
    function run(cmd) {
      if (cmd.indexOf("file.tpl:") === 0) template(cmd.slice(9));
      else if (cmd === "file.open") input.click();
      else if (cmd === "file.page") openPage();
      else if (cmd === "file.save") ctx.save();
      else if (cmd === "file.download") download();
      else if (cmd === "file.discard") discard();
    }
    run.loadPage = loadPage;
    return run;
  };
})();
