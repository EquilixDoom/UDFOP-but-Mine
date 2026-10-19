/* The guide editor: the modal window used for questions, notices and the page picker. One <dialog> is reused; ask(), notice() and pick() return a promise.
   Esc, a click on the dim area outside the window, and Cancel all give the same answer: nothing changes. */
(function () {
  "use strict";
  var H = window.udfopHost, P = window.udfopEditor = window.udfopEditor || {};
  var esc = H.esc;
  P.dialog = function (parent) {
    var dlg = document.createElement("dialog");
    dlg.className = "edw-dlg"; dlg.setAttribute("aria-labelledby", "ed-dt");
    parent.appendChild(dlg);
    function show(html, onClick, onReady) {   /* resolves with whatever finish(v) is given; Esc, a click outside and a close give null */
      return new Promise(function (resolve) {
        var done = false, downOnBackdrop = false;
        function finish(v) { if (done) return; done = true; dlg.onclick = dlg.onpointerdown = dlg.onclose = null; if (dlg.open) dlg.close(); resolve(v); }
        dlg.innerHTML = html;
        /* the dim area is the <dialog> itself; only a click that starts and ends there counts, so dragging a selection out of a field does not close the window */
        dlg.onpointerdown = function (e) { downOnBackdrop = e.target === dlg; };
        dlg.onclick = function (e) { if (e.target === dlg && downOnBackdrop) { finish(null); return; } onClick(e, finish); };
        dlg.onclose = function () { finish(null); };
        dlg.showModal();
        if (onReady) onReady(finish);
      });
    }
    /* o: { title, text (plain) or html (already safe; a button with data-v="goto:..." answers with that string), ok, cancel (omit for a notice), extra (a middle button), danger }.
       Resolves true for the main button, "extra" for the middle one, false for Cancel, Esc or a click outside, or the goto string. Cancel has the focus, so Enter never confirms a change by accident. */
    function ask(o) {
      return show('<h2 id="ed-dt">' + esc(o.title) + "</h2>" + (o.html || (o.text ? "<p>" + esc(o.text) + "</p>" : "")) +
        '<div class="edw-dlg-btns">' + (o.cancel ? '<button type="button" data-v="0" autofocus>' + esc(o.cancel) + "</button>" : "") +
        (o.extra ? '<button type="button" data-v="2">' + esc(o.extra) + "</button>" : "") +
        '<button type="button" data-v="1"' + (o.cancel ? "" : " autofocus") + ' class="' + (o.danger ? "danger" : "primary") + '">' + esc(o.ok || "OK") + "</button></div>",
        function (e, finish) {
          var b = e.target.closest("button[data-v]"); if (!b) return;
          var v = b.getAttribute("data-v");
          finish(v === "1" ? true : v === "2" ? "extra" : v.indexOf("goto:") === 0 ? v : false);
        }).then(function (v) { return v === null ? false : v; });
    }
    /* a list to choose from, narrowed by typing. o: { title, items: [{ label, note, tag, group, value }], placeholder }. Items are shown under their group's heading, in the order given
       (a heading appears at the first item of a new group, so sort by group first). Resolves with the chosen value, or null. */
    function pick(o) {
      var shown = [], active = 0, list, input, count;
      function draw() {
        var q = input.value.trim().toLowerCase();
        shown = o.items.filter(function (it) { return !q || (it.label + " " + (it.group || "") + " " + (it.note || "")).toLowerCase().indexOf(q) >= 0; });
        if (active >= shown.length) active = Math.max(0, shown.length - 1);
        var group = null;
        list.innerHTML = shown.length ? shown.map(function (it, i) {
          var head = "";
          if (it.group && it.group !== group) { group = it.group; head = '<li role="presentation" class="edw-pick-g">' + esc(group) + "</li>"; }
          return head + '<li role="option" id="ed-po' + i + '" aria-selected="' + (i === active) + '" data-i="' + i + '"><span class="edw-pick-l"><b>' + esc(it.label) + (it.tag ? "<small>" + esc(it.tag) + "</small>" : "") + "</b>" + (it.note ? "<em>" + esc(it.note) + "</em>" : "") + "</span></li>";
        }).join("") : '<li class="none">Nothing matches.</li>';
        count.textContent = shown.length === o.items.length ? o.items.length + " " + (o.noun || "pages") : shown.length + " of " + o.items.length;
        if (shown.length) input.setAttribute("aria-activedescendant", "ed-po" + active); else input.removeAttribute("aria-activedescendant");
        var cur = list.querySelector('[aria-selected="true"]'); if (cur) cur.scrollIntoView({ block: "nearest" });   /* scroll-padding keeps it clear of the sticky group heading */
      }
      function mark(i, scroll) {   /* moves the highlight without redrawing the list */
        var opts = list.querySelectorAll('li[role="option"]');
        if (opts[active]) opts[active].setAttribute("aria-selected", "false");
        active = i;
        if (opts[active]) { opts[active].setAttribute("aria-selected", "true"); input.setAttribute("aria-activedescendant", opts[active].id); if (scroll) opts[active].scrollIntoView({ block: "nearest" }); }
      }
      return show('<h2 id="ed-dt">' + esc(o.title) + '</h2><input type="search" class="edw-pick-q" role="combobox" aria-expanded="true" aria-controls="ed-pl" aria-autocomplete="list" aria-label="' + esc(o.placeholder || "Filter") + '" placeholder="' + esc(o.placeholder || "") + '" autocomplete="off" spellcheck="false">' +
        '<ul id="ed-pl" class="edw-pick" role="listbox"></ul><div class="edw-dlg-btns"><small class="edw-pick-n" aria-live="polite"></small><span class="edw-grow"></span><button type="button" data-v="0">Cancel</button></div>',
        function (e, finish) {
          var li = e.target.closest("li[data-i]");
          if (li) finish(shown[+li.getAttribute("data-i")].value); else if (e.target.closest("button[data-v]")) finish(null);
        },
        function (finish) {
          input = dlg.querySelector(".edw-pick-q"); list = dlg.querySelector(".edw-pick"); count = dlg.querySelector(".edw-pick-n");
          input.addEventListener("input", function () { active = 0; draw(); });
          input.addEventListener("keydown", function (e) {
            if (e.key === "ArrowDown") { e.preventDefault(); mark(Math.min(shown.length - 1, active + 1), true); }
            else if (e.key === "ArrowUp") { e.preventDefault(); mark(Math.max(0, active - 1), true); }
            else if (e.key === "Enter" && shown[active]) { e.preventDefault(); finish(shown[active].value); }
          });
          var lx = -1, ly = -1;   /* the highlight follows the mouse, but only when it really moves (scrolling or a redraw under a resting mouse must not move it) */
          list.addEventListener("pointermove", function (e) {
            if (e.clientX === lx && e.clientY === ly) return;
            lx = e.clientX; ly = e.clientY;
            var li = e.target.closest('li[role="option"]');
            if (li && +li.getAttribute("data-i") !== active) mark(+li.getAttribute("data-i"), false);
          });
          draw(); input.focus();
        });
    }
    return { ask: ask, pick: pick, notice: function (title, text) { return ask({ title: title, text: text, ok: "OK" }); } };
  };
})();
