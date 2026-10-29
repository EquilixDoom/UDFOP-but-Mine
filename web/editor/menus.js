/* The guide editor: the menu bar. Menus open, close and work from the keyboard; an item with a command name (data-cmd) runs it through onCommand. An item with a fourth entry of 1 is a switch: it shows a check mark while state(command) is true. */
(function () {
  "use strict";
  var H = window.udfopHost, P = window.udfopEditor = window.udfopEditor || {};
  var esc = H.esc, SEP = "-";
  /* the languages a code box can be colored as (the names highlight.js knows), as [shown, written after the three backticks] */
  var CODE_LANGS = [["Bash", "bash"], ["Batch", "bat"], ["C#", "cs"], ["Config", "conf"], ["Console", "console"], ["HTML", "html"], ["INI", "ini"], ["JavaScript", "js"], ["JSON", "json"], ["Lua", "lua"], ["Markdown", "markdown"], ["PowerShell", "powershell"],
    ["Properties", "properties"], ["Python", "python"], ["Shell", "sh"], ["SVG", "svg"], ["TOML", "toml"], ["TypeScript", "ts"], ["XAML", "xaml"], ["XML", "xml"], ["YAML", "yaml"], ["Zsh", "zsh"]];
  /* [label, shortcut or submenu, command, 1 for a switch]; "-" is a divider */
  var MENUS = [
    ["File", [
      ["New from template…", null, "file.tpl"], ["Open a guide page…", null, "file.page"], ["Open from this computer…", "Ctrl+O", "file.open"], SEP,
      ["Save draft", "Ctrl+S", "file.save"], ["Download .md", null, "file.download"], SEP, ["Discard draft", null, "file.discard"]]],
    ["Edit", [
      ["Undo", "Ctrl+Z", "edit.undo"], ["Redo", "Ctrl+Y", "edit.redo"], SEP,
      ["Cut", "Ctrl+X", "edit.cut"], ["Copy", "Ctrl+C", "edit.copy"], ["Paste", "Ctrl+V", "edit.paste"], ["Delete", "Del", "edit.delete"], ["Select All", "Ctrl+A", "edit.selectall"], SEP,
      ["Indent", [["Increase", "Tab", "edit.indent.inc"], ["Decrease", "Shift+Tab", "edit.indent.dec"]]],
      ["Change Case To", [["UPPER", "Ctrl+Shift+U", "edit.case.upper"], ["lower", "Ctrl+U", "edit.case.lower"], ["Proper", "Alt+U", "edit.case.proper"], ["Sentence", "Ctrl+Alt+U", "edit.case.sentence"]]],
      ["Line Operations", [
        ["Remove Duplicates", null, "edit.lines.dedupe"], ["Remove Consecutive Duplicates", null, "edit.lines.dedupeConsecutive"],
        ["Move Up Current Line", "Ctrl+Shift+Up", "edit.lines.moveup"], ["Move Down Current Line", "Ctrl+Shift+Down", "edit.lines.movedown"],
        ["Remove Empty Lines", null, "edit.lines.removeEmpty"], ["Remove Empty Line (Blank Characters)", null, "edit.lines.removeBlank"],
        ["Insert Blank Line Above", null, "edit.lines.blankabove"], ["Insert Blank Line Below", null, "edit.lines.blankbelow"], ["Reverse Line Order", null, "edit.lines.reverse"], SEP,
        ["Sort Lines Lex. Ascending", null, "edit.lines.sort.lex.asc"], ["Sort Lines Lex. Ascending (Ignore Case)", null, "edit.lines.sort.lexi.asc"],
        ["Sort Lines Int. Ascending", null, "edit.lines.sort.int.asc"], ["Sort Lines Dec. Ascending", null, "edit.lines.sort.dec.asc"], ["Sort Lines Ascending (Length)", null, "edit.lines.sort.len.asc"], SEP,
        ["Sort Line Lex. Descending", null, "edit.lines.sort.lex.desc"], ["Sort Line Lex. Descending (Ignore Case)", null, "edit.lines.sort.lexi.desc"],
        ["Sort Lines Int. Descending", null, "edit.lines.sort.int.desc"], ["Sort Lines Dec. Descending", null, "edit.lines.sort.dec.desc"], ["Sort Line Descending (Length)", null, "edit.lines.sort.len.desc"]]],
      ["Blank Operations", [["Trim Trailing Space", null, "edit.blank.trimTrailing"], ["Trim Leading Space", null, "edit.blank.trimLeading"], ["Trim Trailing and Leading Space", null, "edit.blank.trimBoth"]]],
      ["Paste Special", [["Paste HTML Content", null, "edit.pastehtml"]]], SEP,
      ["Multi-Select All", [["Ignore Case & Whole Word", null, "edit.multi.ignore"], ["Match Case Only", null, "edit.multi.case"], ["Match Whole Word Only", null, "edit.multi.word"], ["Match Case & Whole Word", null, "edit.multi.caseword"]]], SEP,
      ["Column Mode", null, "edit.columnmode"]]],
    ["Search", [["Find…", "Ctrl+F", "search.find"], ["Replace…", "Ctrl+H", "search.replace"], ["Incremental Search", "Ctrl+Alt+I", "search.inc"], ["Find and Select All", null, "search.findall"]]],
    ["View", [
      ["Show Symbol", [
        ["Show Space and Tab", null, "view.ws", 1], ["Show End of Line", null, "view.eol", 1], ["Show Non-Printing Characters", null, "view.np", 1], ["Show Control Characters & Unicode EOL", null, "view.cc", 1], ["Show All Characters", null, "view.all", 1], SEP,
        ["Show Indent Guide", null, "view.guide", 1], ["Show Wrap Symbol", null, "view.wsym", 1]]],
      ["Zoom", [["Zoom In", "Ctrl++", "view.zoomin"], ["Zoom Out", "Ctrl+-", "view.zoomout"], ["Restore Default Zoom", "Ctrl+0", "view.zoom0"]]],
      ["Synchronized Scroll", null, "view.sync", 1], ["Edit in Preview", null, "view.edit", 1], ["Word Wrap", null, "view.wrap", 1], SEP,
      ["Margin", [["Line Number", null, "view.num", 1], ["Change History", null, "view.change", 1]]], SEP,
      ["Current Line Indicator", null, "view.line", 1]]],
    ["Format", [
      ["Bold", "Ctrl+B", "format.bold"], ["Italic", "Ctrl+I", "format.italic"], ["Bold Italic", null, "format.bolditalic"], ["Inline Code", "Ctrl+E", "format.code"], ["Spoiler", null, "format.spoiler"], SEP,
      ["Wiki Link", "Ctrl+K", "format.wiki"], ["Link", null, "format.link"], ["Key", null, "format.key"], SEP,
      ["Heading", [["Heading 2", "Ctrl+2", "format.h.2"], ["Heading 3", "Ctrl+3", "format.h.3"], ["Heading 4", "Ctrl+4", "format.h.4"], ["Heading 5", "Ctrl+5", "format.h.5"], ["Heading 6", "Ctrl+6", "format.h.6"], SEP, ["Paragraph", null, "format.p"]]],
      ["Bullet List", null, "format.ul"], ["Numbered List", null, "format.ol"], ["Quote", null, "format.quote"],
      ["Callout", [["Note", null, "format.callout.note"], ["Tip", null, "format.callout.tip"], ["Important", null, "format.callout.important"], ["Warning", null, "format.callout.warning"], ["Caution", null, "format.callout.caution"], SEP, ["Remove Callout", null, "format.callout.remove"]]], SEP,
      ["Code Block", [["Plain Text", null, "format.codeblock"], SEP].concat(CODE_LANGS.map(function (l) { return [l[0], null, "format.codeblock." + l[1]]; }))], ["Horizontal Rule", null, "format.hr"], ["Align Table", null, "format.table.align"],
      ["Table Column", [["Sort as Number", null, "format.table.col.num"], ["Sort as Percent", null, "format.table.col.pct"], ["Sort as Duration", null, "format.table.col.dur"], ["Sort as Date", null, "format.table.col.date"], ["Sort as Yes/No", null, "format.table.col.bool"], ["Sort as Text", null, "format.table.col.text"], ["Sort Automatically", null, "format.table.col.auto"], SEP, ["Row Labels", null, "format.table.col.label"]]], ["Clear Formatting", null, "format.clear"], SEP,
      ["Snippets", [["Table 2×2", null, "format.snip.table2"], ["Table 3×3", null, "format.snip.table3"], ["Key/Value Table", null, "format.snip.keyvalue"], ["Image", null, "format.snip.image"], ["Spoiler Block", null, "format.snip.spoiler"], ["Infobox", null, "format.snip.infobox"], ["Footnote", null, "format.snip.footnote"],["Front Matter", null, "format.snip.front"]]]]],
    ["?", "help.open"]
  ];
  var uid = 0;
  function list(items, depth) {
    return '<ul class="edw-dd' + (depth ? " edw-sub" : "") + (items.some(function (it) { return it !== SEP && it[3]; }) ? " edw-chk" : "") + '" role="menu" hidden>' + items.map(function (it) {
      if (it === SEP) return '<li role="separator"></li>';
      if (Array.isArray(it[1])) return '<li role="none" class="has-sub"><button type="button" role="menuitem" class="edw-mi" aria-haspopup="menu" aria-expanded="false">' + esc(it[0]) + '<span class="mi-k" aria-hidden="true">▸</span></button>' + list(it[1], depth + 1) + "</li>";
      return '<li role="none"><button type="button" role="' + (it[3] ? 'menuitemcheckbox" aria-checked="false' : 'menuitem') + '" class="edw-mi"' + (it[2] ? ' data-cmd="' + esc(it[2]) + '"' : "") + '>' + esc(it[0]) + (it[1] ? '<span class="mi-k">' + esc(it[1]) + "</span>" : "") + "</button></li>";
    }).join("") + "</ul>";
  }
  function html() {
    return '<div class="edw-menubar" role="menubar" aria-label="Editor menus">' + MENUS.map(function (m) {
      var id = "ed-m" + (++uid);
      if (typeof m[1] === "string") return '<div class="edw-mn"><button type="button" class="edw-mb" role="menuitem" id="' + id + '" data-cmd="' + esc(m[1]) + '" aria-label="Editor help" title="Editor help (F1)">' + esc(m[0]) + "</button></div>";
      return '<div class="edw-mn"><button type="button" class="edw-mb" role="menuitem" id="' + id + '" aria-haspopup="menu" aria-expanded="false">' + esc(m[0]) + "</button>" + list(m[1], 0) + "</div>";
    }).join("") + "</div>";
  }
  P.menubar = function (root, onCommand, state, enabled) {   /* onCommand(name) is called for an item that has a command; state(name) says whether a switch is on; enabled(name) === false greys an item out */
    root.innerHTML = html();
    var tops = Array.prototype.slice.call(root.querySelectorAll(".edw-mb"));
    function menuOf(b) { return b.parentNode.querySelector(":scope > .edw-dd"); }
    function itemsOf(ul) { return Array.prototype.slice.call(ul.children).filter(function (li) { return li.getAttribute("role") === "none"; }).map(function (li) { return li.querySelector(":scope > button"); }); }
    function setOpen(btn, open) {   /* a top-level button or a submenu item */
      if (btn.classList.contains("edw-mb") && !menuOf(btn)) return;
      var ul = btn.classList.contains("edw-mb") ? menuOf(btn) : btn.parentNode.querySelector(":scope > .edw-dd");
      if (!ul) return;
      if (!open) { Array.prototype.forEach.call(ul.querySelectorAll(".edw-dd"), function (u) { u.hidden = true; if (u.previousElementSibling) u.previousElementSibling.setAttribute("aria-expanded", "false"); }); }
      ul.hidden = !open; btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open && state) Array.prototype.forEach.call(ul.querySelectorAll("[aria-checked]"), function (c) { c.setAttribute("aria-checked", state(c.getAttribute("data-cmd")) ? "true" : "false"); });
      if (open && enabled) Array.prototype.forEach.call(ul.querySelectorAll("[data-cmd]"), function (c) { if (enabled(c.getAttribute("data-cmd")) === false) c.setAttribute("aria-disabled", "true"); else c.removeAttribute("aria-disabled"); });
      if (open) {   /* keep the menu inside the window: a menu near the right edge opens leftwards */
        ul.style.left = ""; ul.style.right = ""; ul.classList.remove("flip");
        var r = ul.getBoundingClientRect();
        if (r.right > document.documentElement.clientWidth - 4) ul.classList.add("flip");
        if (ul.classList.contains("edw-sub")) {   /* a long submenu moves up so that it ends inside the window (and scrolls if it is still too tall) */
          ul.style.top = "";
          var q = ul.getBoundingClientRect(), over = Math.min(q.bottom - (window.innerHeight - 8), q.top - 8);
          if (over > 0) ul.style.top = (-5 - over) + "px";
        }
      }
    }
    function closeAll() { tops.forEach(function (b) { setOpen(b, false); }); }
    function openTop(b, focusFirst) {
      closeAll(); setOpen(b, true);
      if (focusFirst && menuOf(b)) { var f = itemsOf(menuOf(b))[0]; if (f) f.focus(); }
    }
    function openTopOf(btn) { var mn = btn.closest(".edw-mn"); return mn && mn.querySelector(".edw-mb"); }
    function anyOpen() { return tops.some(function (b) { return b.getAttribute("aria-expanded") === "true"; }); }
    root.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.classList.contains("edw-mb") && !menuOf(b)) { closeAll(); if (onCommand) onCommand(b.getAttribute("data-cmd")); return; }
      if (b.classList.contains("edw-mb")) { var was = b.getAttribute("aria-expanded") === "true"; closeAll(); if (!was) setOpen(b, true); return; }
      if (b.getAttribute("aria-haspopup")) {   /* a submenu item opens its list */
        var ul = b.parentNode.querySelector(":scope > .edw-dd"), open = ul.hidden;
        Array.prototype.forEach.call(b.parentNode.parentNode.querySelectorAll(":scope > li > button[aria-haspopup]"), function (o) { if (o !== b) setOpen(o, false); });
        setOpen(b, open); return;
      }
      if (b.getAttribute("aria-disabled") === "true") return;   /* greyed out: the menu stays open */
      var top = openTopOf(b), cmd = b.getAttribute("data-cmd"); closeAll(); if (top) top.focus();
      if (cmd && onCommand) onCommand(cmd);   /* items without a command do not do anything yet */
    });
    root.addEventListener("mouseover", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.classList.contains("edw-mb")) { if (anyOpen() && b.getAttribute("aria-expanded") !== "true") openTop(b, false); return; }
      var sib = b.parentNode.parentNode.querySelectorAll(":scope > li > button[aria-haspopup]");
      Array.prototype.forEach.call(sib, function (o) { if (o !== b) setOpen(o, false); });
      if (b.getAttribute("aria-haspopup") && b.getAttribute("aria-expanded") !== "true") setOpen(b, true);
    });
    root.addEventListener("keydown", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var isTop = b.classList.contains("edw-mb"), k = e.key, ul = isTop ? null : b.closest(".edw-dd"), items = ul ? itemsOf(ul) : [], i = items.indexOf(b), ti = tops.indexOf(openTopOf(b));
      function go(n) { e.preventDefault(); if (n) n.focus(); }
      if (k === "Escape") { if (anyOpen()) { e.preventDefault(); var t = openTopOf(b); if (!isTop && ul.classList.contains("edw-sub")) { var par = ul.previousElementSibling; setOpen(par, false); par.focus(); } else { closeAll(); t.focus(); } } return; }
      if (k === "Tab") { closeAll(); return; }
      if (isTop) {
        if (k === "ArrowRight" || k === "ArrowLeft") { var nt = tops[(ti + (k === "ArrowRight" ? 1 : tops.length - 1)) % tops.length]; go(nt); if (anyOpen()) openTop(nt, false); }
        else if (!menuOf(b)) { if (k === "Enter" || k === " ") { e.preventDefault(); closeAll(); if (onCommand) onCommand(b.getAttribute("data-cmd")); } }
        else if (k === "ArrowDown" || k === "Enter" || k === " ") { e.preventDefault(); openTop(b, true); }
        else if (k === "ArrowUp") { e.preventDefault(); openTop(b, false); var l = itemsOf(menuOf(b)); l[l.length - 1].focus(); }
        else if (k === "Home") go(tops[0]); else if (k === "End") go(tops[tops.length - 1]);
        return;
      }
      if (k === "ArrowDown") go(items[(i + 1) % items.length]);
      else if (k === "ArrowUp") go(items[(i + items.length - 1) % items.length]);
      else if (k === "Home") go(items[0]); else if (k === "End") go(items[items.length - 1]);
      else if (k === "ArrowRight") {
        if (b.getAttribute("aria-haspopup")) { e.preventDefault(); setOpen(b, true); var f = itemsOf(b.parentNode.querySelector(":scope > .edw-dd"))[0]; if (f) f.focus(); }
        else { var nx = tops[(ti + 1) % tops.length]; go(nx); openTop(nx, true); }
      } else if (k === "ArrowLeft") {
        if (ul.classList.contains("edw-sub")) { var p = ul.previousElementSibling; setOpen(p, false); go(p); }
        else { var pv = tops[(ti + tops.length - 1) % tops.length]; go(pv); openTop(pv, true); }
      }
    });
    function leave() { document.removeEventListener("pointerdown", away); window.removeEventListener("blur", closeAll); }
    function away(e) { if (!root.isConnected) { leave(); return; } if (!root.contains(e.target)) closeAll(); }   /* the page was left: stop listening */
    document.addEventListener("pointerdown", away);
    window.addEventListener("blur", closeAll);
  };
})();
