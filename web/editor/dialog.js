/* Write a guide page: the modal window used for questions, notices and the page picker. One <dialog> is reused; ask(), notice() and pick() return a promise. */
(function () {
  "use strict";
  var H = window.udfopHost, P = window.udfopEditor = window.udfopEditor || {};
  var esc = H.esc;
  P.dialog = function (parent) {
    var dlg = document.createElement("dialog");
    dlg.className = "edw-dlg"; dlg.setAttribute("aria-labelledby", "ed-dt");
    parent.appendChild(dlg);
    function show(html, onClick, onReady) {   /* resolves with whatever finish(v) is given; Esc and a close give null */
      return new Promise(function (resolve) {
        var done = false;
        function finish(v) { if (done) return; done = true; dlg.onclick = dlg.onclose = null; if (dlg.open) dlg.close(); resolve(v); }
        dlg.innerHTML = html;
        dlg.onclick = function (e) { onClick(e, finish); };
        dlg.onclose = function () { finish(null); };
        dlg.showModal();
        if (onReady) onReady(finish);
      });
    }
    /* o: { title, text (plain) or html (already safe), ok, cancel (omit for a notice), extra (a middle button), danger }.
       Resolves true for the main button, "extra" for the middle one, false for Cancel, Esc or a click outside. */
    function ask(o) {
      return show('<h2 id="ed-dt">' + esc(o.title) + "</h2>" + (o.html || (o.text ? "<p>" + esc(o.text) + "</p>" : "")) +
        '<div class="edw-dlg-btns">' + (o.cancel ? '<button type="button" data-v="0" autofocus>' + esc(o.cancel) + "</button>" : "") +
        (o.extra ? '<button type="button" data-v="2">' + esc(o.extra) + "</button>" : "") +
        '<button type="button" data-v="1"' + (o.cancel ? "" : " autofocus") + (o.danger ? ' class="danger"' : "") + ">" + esc(o.ok || "OK") + "</button></div>",
        function (e, finish) { var b = e.target.closest("button[data-v]"); if (b) finish(b.getAttribute("data-v") === "1" ? true : b.getAttribute("data-v") === "2" ? "extra" : false); }).then(function (v) { return v === null ? false : v; });
    }
    /* a list to choose from, narrowed by typing. o: { title, items: [{ label, detail, value }], placeholder }. Resolves with the chosen value, or null. */
    function pick(o) {
      var shown = [], active = 0, list, input;
      function draw() {
        var q = input.value.trim().toLowerCase();
        shown = o.items.filter(function (it) { return !q || (it.label + " " + (it.detail || "")).toLowerCase().indexOf(q) >= 0; });
        if (active >= shown.length) active = Math.max(0, shown.length - 1);
        list.innerHTML = shown.length ? shown.map(function (it, i) {
          return '<li role="option" aria-selected="' + (i === active) + '" data-i="' + i + '"><b>' + esc(it.label) + "</b>" + (it.detail ? "<small>" + esc(it.detail) + "</small>" : "") + "</li>";
        }).join("") : '<li class="none">Nothing matches.</li>';
        var cur = list.querySelector('[aria-selected="true"]'); if (cur) cur.scrollIntoView({ block: "nearest" });
      }
      return show('<h2 id="ed-dt">' + esc(o.title) + '</h2><input type="search" class="edw-pick-q" aria-label="' + esc(o.placeholder || "Filter") + '" placeholder="' + esc(o.placeholder || "") + '" autocomplete="off" spellcheck="false">' +
        '<ul class="edw-pick" role="listbox"></ul><div class="edw-dlg-btns"><button type="button" data-v="0">Cancel</button></div>',
        function (e, finish) {
          var li = e.target.closest("li[data-i]");
          if (li) finish(shown[+li.getAttribute("data-i")].value); else if (e.target.closest("button[data-v]")) finish(null);
        },
        function (finish) {
          input = dlg.querySelector(".edw-pick-q"); list = dlg.querySelector(".edw-pick");
          input.addEventListener("input", function () { active = 0; draw(); });
          input.addEventListener("keydown", function (e) {
            if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(shown.length - 1, active + 1); draw(); }
            else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); draw(); }
            else if (e.key === "Enter" && shown[active]) { e.preventDefault(); finish(shown[active].value); }
          });
          draw(); input.focus();
        });
    }
    return { ask: ask, pick: pick, notice: function (title, text) { return ask({ title: title, text: text, ok: "OK" }); } };
  };
})();
