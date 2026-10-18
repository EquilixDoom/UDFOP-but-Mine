/* Write a guide page: the menu bar. Menus open, close and work from the keyboard; an item with a command name (data-cmd) runs it through onCommand. */
(function () {
  "use strict";
  var H = window.udfopHost, P = window.udfopEditor = window.udfopEditor || {};
  var esc = H.esc, SEP = "-";
  /* [label, shortcut or submenu]; "-" is a divider */
  var MENUS = [
    ["File", [
      ["New from template", H.TEMPLATES.map(function (t) { return [t[1], null, "file.tpl:" + t[0]]; })], ["Open a guide page…", null, "file.page"], ["Open from this computer…", "Ctrl+O", "file.open"], SEP,
      ["Save draft", "Ctrl+S", "file.save"], ["Download .md", null, "file.download"], SEP, ["Discard draft", null, "file.discard"]]],
  ];
  var uid = 0;
  function list(items, depth) {
    return '<ul class="edw-dd' + (depth ? " edw-sub" : "") + '" role="menu" hidden>' + items.map(function (it) {
      if (it === SEP) return '<li role="separator"></li>';
      if (Array.isArray(it[1])) return '<li role="none" class="has-sub"><button type="button" role="menuitem" class="edw-mi" aria-haspopup="menu" aria-expanded="false">' + esc(it[0]) + '<span class="mi-k" aria-hidden="true">▸</span></button>' + list(it[1], depth + 1) + "</li>";
      return '<li role="none"><button type="button" role="menuitem" class="edw-mi"' + (it[2] ? ' data-cmd="' + esc(it[2]) + '"' : "") + '>' + esc(it[0]) + (it[1] ? '<span class="mi-k">' + esc(it[1]) + "</span>" : "") + "</button></li>";
    }).join("") + "</ul>";
  }
  function html() {
    return '<div class="edw-menubar" role="menubar" aria-label="Editor menus">' + MENUS.map(function (m) {
      var id = "ed-m" + (++uid);
      return '<div class="edw-mn"><button type="button" class="edw-mb" role="menuitem" id="' + id + '" aria-haspopup="menu" aria-expanded="false">' + esc(m[0]) + "</button>" + list(m[1], 0) + "</div>";
    }).join("") + "</div>";
  }
  P.menubar = function (root, onCommand) {   /* onCommand(name) is called for an item that has a command */
    root.innerHTML = html();
    var tops = Array.prototype.slice.call(root.querySelectorAll(".edw-mb"));
    function menuOf(b) { return b.parentNode.querySelector(":scope > .edw-dd"); }
    function itemsOf(ul) { return Array.prototype.slice.call(ul.children).filter(function (li) { return li.getAttribute("role") === "none"; }).map(function (li) { return li.querySelector(":scope > button"); }); }
    function setOpen(btn, open) {   /* a top-level button or a submenu item */
      var ul = btn.classList.contains("edw-mb") ? menuOf(btn) : btn.parentNode.querySelector(":scope > .edw-dd");
      if (!ul) return;
      if (!open) { Array.prototype.forEach.call(ul.querySelectorAll(".edw-dd"), function (u) { u.hidden = true; if (u.previousElementSibling) u.previousElementSibling.setAttribute("aria-expanded", "false"); }); }
      ul.hidden = !open; btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {   /* keep the menu inside the window: a menu near the right edge opens leftwards */
        ul.style.left = ""; ul.style.right = ""; ul.classList.remove("flip");
        var r = ul.getBoundingClientRect();
        if (r.right > document.documentElement.clientWidth - 4) ul.classList.add("flip");
      }
    }
    function closeAll() { tops.forEach(function (b) { setOpen(b, false); }); }
    function openTop(b, focusFirst) {
      closeAll(); setOpen(b, true);
      if (focusFirst) { var f = itemsOf(menuOf(b))[0]; if (f) f.focus(); }
    }
    function openTopOf(btn) { var mn = btn.closest(".edw-mn"); return mn && mn.querySelector(".edw-mb"); }
    function anyOpen() { return tops.some(function (b) { return b.getAttribute("aria-expanded") === "true"; }); }
    root.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.classList.contains("edw-mb")) { var was = b.getAttribute("aria-expanded") === "true"; closeAll(); if (!was) setOpen(b, true); return; }
      if (b.getAttribute("aria-haspopup")) {   /* a submenu item opens its list */
        var ul = b.parentNode.querySelector(":scope > .edw-dd"), open = ul.hidden;
        Array.prototype.forEach.call(b.parentNode.parentNode.querySelectorAll(":scope > li > button[aria-haspopup]"), function (o) { if (o !== b) setOpen(o, false); });
        setOpen(b, open); return;
      }
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
