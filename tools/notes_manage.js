/* Manage tab of the notes tool: search and bulk edits over every stored row, topics, tags, the change list with revert, duplicates,
   and the commit helper. Loaded after the main script in notes_gui.html, so it shares its globals (api, esc, $, render, S, ST, mode, rows ...). */
var MG = { sub: "search", q: { text: "", topic: "", type: "", tag: "", flag: "", status: "", vfrom: "", vto: "" }, res: null, sel: {}, topics: null, tfilter: "", tdet: null, tags: null, journal: null, dups: null, msg: "", loading: {} };
var GIT = null;
(function () {
  var st = document.createElement("style");
  st.textContent = ".mgf{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:0 0 10px}.mgr{display:flex;gap:8px;align-items:baseline;padding:6px 8px;border-bottom:1px solid var(--line)}" +
    ".mgr:hover{background:var(--bg)}.mgr .x{flex:1;min-width:0}.mgr .x .t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.mgr input[type=checkbox]{width:auto;margin:3px 0 0}" +
    ".mgl{border:1px solid var(--line);border-radius:6px;background:var(--card);margin:0 0 12px}.mgb{position:sticky;top:56px;z-index:4;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:8px;margin:0 0 8px}" +
    ".mgb .grp{display:inline-flex;gap:4px;margin:2px 10px 2px 0;align-items:center}.mgb input,.mgb select{padding:2px 6px}.fl{font-size:11px;border-radius:8px;padding:0 6px;border:1px solid var(--flagline);background:var(--flag);margin-left:4px;white-space:nowrap}" +
    ".mgt{cursor:pointer}.mgt.on{background:var(--flag)}.two{display:grid;grid-template-columns:minmax(220px,360px) 1fr;gap:16px;align-items:start}@media(max-width:760px){.two{grid-template-columns:1fr}}";
  document.head.appendChild(st);
})();
function mgOpts(list, cur, blank) { return (blank != null ? '<option value="">' + esc(blank) + "</option>" : "") + list.map(function (o) { return '<option' + (o === cur ? " selected" : "") + ">" + esc(o) + "</option>"; }).join(""); }
function mgNote(m) { MG.msg = m; }
/* the first change of a session takes a snapshot of data/ and web/, which can take a few seconds */
function working() { MG.msg = "Working… (the first change of a session takes a snapshot first)"; render(); }
function refreshTopics() {
  return api("/api/manage/topics").then(function (x) { MG.topics = x; S.topics = x.topics.map(function (t) { return { name: t.topic, hub: t.hub, n: t.n }; }); });
}
function refreshTags() {
  return api("/api/manage/tags").then(function (x) { MG.tags = x; S.tax.tags = x.tags.filter(function (t) { return t.listed; }).map(function (t) { return t.tag; }); S.tag_counts = {}; x.tags.forEach(function (t) { S.tag_counts[t.tag] = t.n; }); });
}
function refreshIndex() { return api("/api/stored").then(function (x) { ST = x; }); }
function manageLoad() {
  var m = MG, sub = m.sub, need = { topics: !m.topics, tags: !m.tags, changes: !m.journal, dups: !m.dups }[sub];
  if (!need || m.loading[sub]) return;
  m.loading[sub] = true;
  var p = sub === "topics" ? refreshTopics() : sub === "tags" ? refreshTags() : sub === "changes" ? api("/api/manage/journal").then(function (x) { m.journal = x; }) : api("/api/manage/dups").then(function (x) { m.dups = x; });
  p.then(function () { m.loading[sub] = false; if (tab === "manage") render(); });
}
function manageView() {
  if (!S) return '<div class="card">Loading…</div>';
  var subs = [["search", "Search &amp; bulk edit"], ["topics", "Topics"], ["tags", "Tags"], ["changes", "Changes" + (MG.journal ? " (" + MG.journal.n + ")" : "")], ["dups", "Duplicates"]];
  var h = '<div class="seg" style="margin:0 0 12px">' + subs.map(function (x) { return '<button class="b' + (MG.sub === x[0] ? " on" : "") + '" data-mg="sub" data-v="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div>";
  h += '<datalist id="topics">' + S.topics.map(function (t) { return "<option value=\"" + esc(t.name) + '">' + esc(t.hub + " · " + t.n); }).join("") + "</datalist>";
  if (MG.msg) h += '<div class="warn soft">' + esc(MG.msg) + "</div>";
  return h + ({ search: mgSearch, topics: mgTopics, tags: mgTags, changes: mgChanges, dups: mgDups }[MG.sub])();
}
/* ---------- search and bulk ---------- */
function mgSearch() {
  var q = MG.q, ty = S.tax.change_types, h = '<div class="card"><div class="mgf">' +
    '<label>Words in the bullet, topic or tags<input id="mq-text" value="' + esc(q.text) + '" placeholder="e.g. windmill"></label>' +
    '<label>Topic<input id="mq-topic" list="topics" value="' + esc(q.topic) + '"></label>' +
    '<label>Type<select id="mq-type">' + mgOpts(ty, q.type, "Any") + "</select></label>" +
    '<label>Tag<select id="mq-tag">' + mgOpts(S.tax.tags, q.tag, "Any") + "</select></label>" +
    '<label>Needs a look<select id="mq-flag">' + ['<option value=""' + (q.flag === "" ? " selected" : "") + ">Any row</option>", '<option value="any"' + (q.flag === "any" ? " selected" : "") + ">Any flag</option>"].concat(["type Other", "no tags", "topic?", "long bullet"].map(function (f) { return '<option value="' + f + '"' + (q.flag === f ? " selected" : "") + ">" + f + "</option>"; })).join("") + "</select></label>" +
    '<label>Status<select id="mq-status"><option value="">Any</option><option value="unconfirmed"' + (q.status === "unconfirmed" ? " selected" : "") + '>Not confirmed</option><option value="confirmed"' + (q.status === "confirmed" ? " selected" : "") + ">Confirmed</option></select></label>" +
    '<label>From patch<input id="mq-vfrom" value="' + esc(q.vfrom) + '" placeholder="0.1.8000"></label><label>To patch<input id="mq-vto" value="' + esc(q.vto) + '" placeholder="0.1.9000"></label></div>' +
    '<div class="bar" style="margin:0"><button class="b pri" data-mg="search">Search</button><button class="b" data-mg="look" title="Rows with any flag that nobody has confirmed yet">Needs a look</button><button class="b" data-mg="clear">Clear</button>' +
    '<span class="mut">Flags: type Other, no tags, a long bullet, or the text names a different topic than the row is filed under.</span></div></div>';
  var r = MG.res;
  if (!r) return h + '<div class="card mut">Search for rows, or press Needs a look. Results can be edited in bulk or reviewed one after another.</div>';
  var ids = r.rows.map(function (x) { return x.id; }), n = ids.filter(function (i) { return MG.sel[i]; }).length;
  h += '<div class="mgb"><b>' + r.total + " row" + (r.total === 1 ? "" : "s") + "</b>" + (r.total > r.rows.length ? " (first " + r.rows.length + " shown)" : "") + ' · <span id="mgn">' + n + " selected</span> " +
    '<button class="b" data-mg="selall">Select all shown</button><button class="b" data-mg="selnone">None</button><br>' +
    '<span class="grp"><select id="mb-type">' + mgOpts(S.tax.change_types, "", "Type…") + '</select><button class="b" data-mg="b-type">Set type</button></span>' +
    '<span class="grp"><input id="mb-topic" list="topics" placeholder="Topic…"><button class="b" data-mg="b-topic">Set topic</button></span>' +
    '<span class="grp"><select id="mb-add">' + mgOpts(S.tax.tags, "", "Tag…") + '</select><button class="b" data-mg="b-add">Add tag</button><button class="b" data-mg="b-rem">Remove tag</button></span>' +
    '<span class="grp"><button class="b" data-mg="b-conf">Confirm</button><button class="b" data-mg="b-unconf">Unconfirm</button></span>' +
    '<span class="grp"><button class="b pri" data-mg="review">Review ' + (n ? "the " + n + " selected" : "these") + " in order</button></span></div>";
  h += '<div class="mgl">' + r.rows.map(function (x) {
    return '<div class="mgr"><input type="checkbox" data-mg="sel" data-id="' + esc(x.id) + '"' + (MG.sel[x.id] ? " checked" : "") + '><span class="mut" style="width:92px">' + esc(x.version) + '</span><span class="x"><b>' + esc(x.entity) + '</b> <span class="mut">' + esc(x.change_type) + (x.tags.length ? " · " + esc(x.tags.join(", ")) : "") + "</span>" +
      (x._confirmed ? ' <span class="tag" style="background:var(--ok);border-color:var(--okline)">confirmed</span>' : "") + x.flags.map(function (f) { return '<span class="fl">' + esc(f) + "</span>"; }).join("") +
      '<div class="t">' + esc(x.source) + '</div></span><button class="b" data-mg="open" data-id="' + esc(x.id) + '">Open</button></div>';
  }).join("") + "</div>";
  return h;
}
function runSearch() {
  MG.msg = "Searching…"; render();
  return api("/api/stored/search", { q: MG.q }).then(function (x) { MG.res = x; MG.sel = {}; MG.msg = ""; render(); });
}
function chosenIds() {
  var all = MG.res ? MG.res.rows.map(function (x) { return x.id; }) : [], sel = all.filter(function (i) { return MG.sel[i]; });
  return sel.length ? sel : all;
}
function bulkApply(body, what) {
  var ids = chosenIds(); if (!ids.length) return;
  if (!confirm(what + " on " + ids.length + " row" + (ids.length === 1 ? "" : "s") + "?")) return;
  body.ids = ids; working();
  return api("/api/stored/bulk", body).then(function (x) {
    MG.msg = x.ok ? what + ": " + x.changed + " row(s) changed" + (x.changed ? ". Run Build to update the site; Revert is under Changes." : ".") : x.out;
    if (x.ok && x.changed) buildDue = true; MG.journal = null;
    return Promise.all([refreshIndex(), refreshTopics(), refreshTags()]).then(runSearch);
  });
}
/* ---------- topics ---------- */
function mgTopics() {
  if (!MG.topics) return '<div class="card">Loading…</div>';
  var f = MG.tfilter.trim().toLowerCase(), list = MG.topics.topics.filter(function (t) { return !f || t.topic.toLowerCase().indexOf(f) >= 0 || t.hub.toLowerCase().indexOf(f) >= 0; });
  var left = '<div><input id="mt-filter" placeholder="Filter ' + MG.topics.topics.length + ' topics or hubs" value="' + esc(MG.tfilter) + '" style="width:100%;margin:0 0 6px"><div class="mgl" style="max-height:70vh;overflow:auto">' +
    list.slice(0, 250).map(function (t) { return '<div class="mgr mgt' + (MG.tdet && MG.tdet.topic === t.topic ? " on" : "") + '" data-mg="topic" data-t="' + esc(t.topic) + '"><span class="x"><b>' + esc(t.topic) + '</b> <span class="mut">' + esc(t.hub) + " · " + t.n + " · " + (t.desc ? (t.reviewed ? "✓" : "draft") : "no description") + "</span></span></div>"; }).join("") +
    (list.length > 250 ? '<div class="mut2" style="padding:6px 8px">' + (list.length - 250) + " more. Type to narrow the list.</div>" : "") + "</div></div>";
  var d = MG.tdet, right = '<div class="card mut">Choose a topic to see its rows, move its hub, rename or merge it, and edit its description.</div>';
  if (d) {
    right = '<div class="card"><h2 class="ph">' + esc(d.topic) + '</h2><div class="mut">' + d.n + " rows · last change in " + esc(d.last) + "</div>" +
      '<div class="mgf" style="margin-top:10px"><label>Hub<select id="mt-hub">' + mgOpts(MG.topics.hubs, d.hub) + "</select></label>" +
      '<label>Rename, or merge into an existing topic<input id="mt-name" list="topics" value="' + esc(d.topic) + '"></label></div>' +
      '<div class="bar"><button class="b" data-mg="t-rename">Rename / merge</button><button class="b" data-mg="t-review">Review its rows in order</button></div>' +
      '<label>Description <span class="mut2">(' + (d.reviewed ? "reviewed" : "not reviewed") + ")</span><textarea id=\"mt-desc\" rows=\"4\">" + esc(d.desc || "") + "</textarea></label>" +
      '<div class="bar" style="margin-top:6px"><button class="b pri" data-mg="t-desc">Save description</button><span class="mut">Saving marks it reviewed.</span></div>' +
      '<h3 class="gh">Changes</h3>' + (d.rows ? d.rows.map(function (x) { return '<div class="mgr"><span class="mut" style="width:92px">' + esc(x.version) + '</span><span class="x"><span class="mut">' + esc(x.change_type) + '</span><div class="t">' + esc(x.source) + '</div></span><button class="b" data-mg="open" data-id="' + esc(x.id) + '">Open</button></div>'; }).join("") + (d.more ? '<div class="mut2">' + d.more + " more not shown. Use Review its rows.</div>" : "") : "Loading…") + "</div>";
  }
  return '<div class="two">' + left + "<div>" + right + "</div></div>";
}
function openTopic(t) {
  var row = MG.topics.topics.filter(function (x) { return x.topic === t; })[0]; if (!row) return;
  MG.tdet = { topic: t, hub: row.hub, n: row.n, last: row.last, reviewed: row.reviewed, desc: null, rows: null };
  render();
  Promise.all([api("/api/topic", { topic: t }), api("/api/stored/search", { q: { topic_exact: t }, limit: 60 })]).then(function (a) {
    if (!MG.tdet || MG.tdet.topic !== t) return;
    MG.tdet.desc = a[0].desc || ""; MG.tdet.rows = a[1].rows; MG.tdet.more = Math.max(0, a[1].total - a[1].rows.length); render();
  });
}
function topicIds(t) { return api("/api/stored/search", { q: { topic_exact: t }, limit: 5000 }).then(function (x) { return x.rows.map(function (r) { return r.id; }); }); }
/* ---------- tags ---------- */
function mgTags() {
  if (!MG.tags) return '<div class="card">Loading…</div>';
  var h = '<div class="card"><div class="bar" style="margin:0"><input id="mtg-new" placeholder="New tag, such as fast-travel" maxlength="30"><button class="b" data-mg="tag-add">Add tag</button><span class="mut">Rename merges: renaming a tag to an existing one joins them on every row.</span></div></div>' +
    '<div class="mgl">' + MG.tags.tags.map(function (t) {
      return '<div class="mgr"><span class="x"><b>' + esc(t.tag) + '</b> <span class="mut">' + t.n + " row" + (t.n === 1 ? "" : "s") + (t.listed ? "" : " · not in the taxonomy list") + '</span></span>' +
        '<button class="b" data-mg="tag-rows" data-tag="' + esc(t.tag) + '"' + (t.n ? "" : " disabled") + '>Review rows</button><button class="b" data-mg="tag-ren" data-tag="' + esc(t.tag) + '">Rename</button><button class="b" data-mg="tag-del" data-tag="' + esc(t.tag) + '">Remove</button></div>';
    }).join("") + "</div>";
  return h;
}
/* ---------- changes since the last Build ---------- */
var FLAB = [["entity", "topic"], ["change_type", "type"], ["tags", "tags"], ["platforms", "platforms"], ["dev_note", "developer note"]];
function diffText(n) {
  if (n.kind === "split") return "new row, a copy of " + esc(n.of);
  return FLAB.filter(function (f) { return JSON.stringify(n.before[f[0]]) !== JSON.stringify(n.after[f[0]]); }).map(function (f) {
    var b = n.before[f[0]], a = n.after[f[0]], s = function (v) { return Array.isArray(v) ? v.join(", ") || "none" : v == null ? "none" : String(v); };
    return "<b>" + f[1] + "</b> " + esc(s(b)) + " → " + esc(s(a));
  }).join(" · ");
}
function mgChanges() {
  if (!MG.journal) return '<div class="card">Loading…</div>';
  var c = MG.journal.changes;
  if (!c.length) return '<div class="card">No stored rows have been changed since the last Build.</div>';
  return '<div class="bar"><b>' + c.length + " row" + (c.length === 1 ? "" : "s") + " changed since the last Build</b><button class=\"b\" data-mg=\"rv-all\">Revert all</button><button class=\"b pri\" data-mg=\"goto-build\">Go to Build →</button></div>" +
    '<p class="mut">Revert puts a row back as it was before its first change. It restores rows only: a renamed topic keeps its new hub and description lines, and tag list changes in taxonomy.json stay (undo those with git).</p><div class="mgl">' +
    c.map(function (n) { return '<div class="mgr"><span class="mut" style="width:92px">' + esc(n.id.split("-")[0]) + '</span><span class="x"><b>' + esc(n.id) + "</b> " + diffText(n) + '</span><button class="b" data-mg="open" data-id="' + esc(n.id) + '">Open</button><button class="b" data-mg="rv" data-id="' + esc(n.id) + '">Revert</button></div>'; }).join("") + "</div>";
}
/* ---------- duplicates ---------- */
function mgDups() {
  if (!MG.dups) return '<div class="card">Loading…</div>';
  var d = MG.dups;
  if (!d.groups.length) return '<div class="card">No bullet appears twice.</div>';
  return '<p class="mut">' + d.total + " bullets appear on more than one row" + (d.total > d.groups.length ? " (the " + d.groups.length + " most repeated are shown)" : "") + ". Rows made by Split show up here too.</p>" + d.groups.map(function (g) {
    return '<div class="card"><div class="bar" style="margin:0"><b>' + g.rows.length + " rows</b>" + (g.same_version ? '<span class="tag">same patch</span>' : "") + '<button class="b" data-mg="dup-review" data-ids="' + esc(g.rows.map(function (r) { return r.id; }).join(",")) + '">Review these</button></div>' +
      '<div class="src" style="margin:6px 0">' + esc(g.text) + "</div>" + g.rows.map(function (r) { return '<span class="pill">' + esc(r.id) + " · " + esc(r.entity) + " · " + esc(r.type) + "</span> "; }).join("") + "</div>";
  }).join("");
}
/* ---------- the result-list banner of the review screen ---------- */
function scopeBar() {
  return '<div class="bar"><button class="b" data-a="backtopatches">← Back to patches</button><b>' + esc(scopeLabel) + "</b><span class=\"mut\">" + rows.length + " rows, in patch order</span></div>" +
    '<div class="warn soft">These rows are already in the wiki. Changes are written to data/normalized/all.jsonl as you make them (a snapshot goes to _backups first); run Build afterwards. Revert is under Manage, Changes.</div>';
}
/* ---------- commit helper on the Build tab ---------- */
function loadGit() { api("/api/manage/git").then(function (x) { GIT = x; GIT.msg = x.message; if (tab === "fin") render(); }); }
function commitCard() {
  if (!GIT) return "";
  return '<div class="card"><b>Commit</b> <span class="mut">(the push stays yours)</span>' +
    (GIT.edited ? '<div class="warn soft">' + GIT.edited + " stored row(s) changed since the last Build. Build first, then commit, so the site data matches.</div>" : "") +
    '<div class="log" style="margin:8px 0;max-height:160px">' + esc(GIT.status || "Nothing changed in data/ or web/.") + "</div>" +
    '<textarea id="gc-msg" rows="2">' + esc(GIT.msg || "") + '</textarea><div class="bar" style="margin:6px 0 0"><button class="b pri" data-mg="commit"' + (GIT.status ? "" : " disabled") + '>Commit data and web</button><button class="b" data-mg="git-refresh">Refresh</button><span class="mut" id="gc-out">' + esc(GIT.out || "") + "</span></div></div>";
}
/* ---------- events ---------- */
document.addEventListener("input", function (e) {
  var t = e.target, id = t.id || "";
  if (id.indexOf("mq-") === 0) MG.q[id.slice(3)] = t.value;
  else if (id === "mt-filter") { MG.tfilter = t.value; var p = t.selectionStart; render(); var n = $("#mt-filter"); if (n) { n.focus(); n.setSelectionRange(p, p); } }
  else if (id === "gc-msg" && GIT) GIT.msg = t.value;
});
document.addEventListener("change", function (e) {
  var t = e.target;
  if (t.id && t.id.indexOf("mq-") === 0) MG.q[t.id.slice(3)] = t.value;
  if (t.id === "mt-hub" && MG.tdet) {
    api("/api/manage/topic/hub", { topic: MG.tdet.topic, hub: t.value }).then(function (x) { mgNote(x.out); MG.tdet.hub = t.value; return refreshTopics(); }).then(render);
  }
});
document.addEventListener("keydown", function (e) {
  if (tab === "manage" && e.key === "Enter" && e.target.id && e.target.id.indexOf("mq-") === 0) { e.preventDefault(); runSearch(); }
  if (tab === "manage" && e.key === "Enter" && e.target.id === "mtg-new") { e.preventDefault(); document.querySelector('[data-mg="tag-add"]').click(); }
});
document.addEventListener("click", function (e) {
  var t = e.target.closest("[data-mg]"); if (!t) return;
  var a = t.dataset.mg, id = t.dataset.id;
  if (a === "sub") { MG.sub = t.dataset.v; MG.msg = ""; if (MG.sub === "changes") MG.journal = null; return render(); }
  if (a === "search") return runSearch();
  if (a === "look") { MG.q = { text: "", topic: "", type: "", tag: "", flag: "any", status: "unconfirmed", vfrom: "", vto: "" }; return runSearch(); }
  if (a === "clear") { MG.q = { text: "", topic: "", type: "", tag: "", flag: "", status: "", vfrom: "", vto: "" }; MG.res = null; MG.sel = {}; return render(); }
  if (a === "sel") { if (t.checked) MG.sel[id] = true; else delete MG.sel[id]; var c = $("#mgn"); if (c) c.textContent = chosenCount() + " selected"; return; }
  if (a === "selall") { MG.res.rows.forEach(function (x) { MG.sel[x.id] = true; }); return render(); }
  if (a === "selnone") { MG.sel = {}; return render(); }
  if (a === "b-type") { var ty = $("#mb-type").value; return ty ? bulkApply({ set: { change_type: ty } }, "Set type to " + ty) : undefined; }
  if (a === "b-topic") { var tp = $("#mb-topic").value.trim(); return tp ? bulkApply({ set: { entity: tp } }, "Move to topic " + tp) : undefined; }
  if (a === "b-add") { var ta = $("#mb-add").value; return ta ? bulkApply({ add_tags: [ta] }, "Add tag " + ta) : undefined; }
  if (a === "b-rem") { var tr = $("#mb-add").value; return tr ? bulkApply({ remove_tags: [tr] }, "Remove tag " + tr) : undefined; }
  if (a === "b-conf") return bulkApply({ confirm: true }, "Confirm");
  if (a === "b-unconf") return bulkApply({ confirm: false }, "Unconfirm");
  if (a === "review") { var ids = chosenIds(); return ids.length ? openScope(ids, "Search results", ids[0]) : undefined; }
  if (a === "open") {
    var from = MG.sub === "search" && MG.res ? MG.res.rows.map(function (x) { return x.id; }) : MG.sub === "topics" && MG.tdet && MG.tdet.rows ? MG.tdet.rows.map(function (x) { return x.id; }) : MG.sub === "changes" && MG.journal ? MG.journal.changes.map(function (n) { return n.id; }) : [id];
    return openScope(from.indexOf(id) >= 0 ? from : [id], MG.sub === "topics" ? "Topic " + MG.tdet.topic : MG.sub === "changes" ? "Changed since the last Build" : "Search results", id);
  }
  if (a === "topic") return openTopic(t.dataset.t);
  if (a === "t-review") return topicIds(MG.tdet.topic).then(function (ids) { return openScope(ids, "Topic " + MG.tdet.topic, ids[0]); });
  if (a === "t-rename") {
    var to = $("#mt-name").value.trim(), from2 = MG.tdet.topic;
    if (!to || to === from2) return;
    var exists = MG.topics.topics.some(function (x) { return x.topic === to; });
    if (!confirm(exists ? "Merge " + from2 + " into the existing topic " + to + "? Its rows, description and hub line move over." : "Rename " + from2 + " to " + to + " on all its rows?")) return;
    working();
    return api("/api/manage/topic/rename", { from: from2, to: to }).then(function (x) {
      mgNote(x.out); if (x.ok) { buildDue = true; MG.journal = null; MG.tdet = null; }
      return Promise.all([refreshTopics(), refreshIndex(), refreshTags()]);
    }).then(function () { if (MG.topics.topics.some(function (x) { return x.topic === to; })) openTopic(to); else render(); });
  }
  if (a === "t-desc") return api("/api/describe/save", { topic: MG.tdet.topic, text: $("#mt-desc").value }).then(function (x) { mgNote(x.ok ? "Description saved and marked reviewed." : x.out); return refreshTopics(); }).then(function () { MG.tdet.reviewed = true; render(); });
  if (a === "tag-add") {
    return api("/api/tag", { tag: $("#mtg-new").value }).then(function (x) { mgNote(x.out); return refreshTags(); }).then(render);
  }
  if (a === "tag-rows") return api("/api/stored/search", { q: { tag: t.dataset.tag }, limit: 5000 }).then(function (x) { var ids = x.rows.map(function (r) { return r.id; }); return openScope(ids, "Tag " + t.dataset.tag, ids[0]); });
  if (a === "tag-ren") {
    var nt = prompt("Rename the tag " + t.dataset.tag + " to (an existing tag merges them):", t.dataset.tag); if (!nt || nt === t.dataset.tag) return;
    working();
    return api("/api/manage/tag/rename", { from: t.dataset.tag, to: nt }).then(function (x) { mgNote(x.out); if (x.ok) { buildDue = true; MG.journal = null; } return refreshTags(); }).then(render);
  }
  if (a === "tag-del") {
    var cn = (S.tag_counts || {})[t.dataset.tag] || 0;
    if (!confirm("Remove the tag " + t.dataset.tag + " from the list" + (cn ? " and from " + cn + " row(s)" : "") + "?")) return;
    working();
    return api("/api/manage/tag/remove", { tag: t.dataset.tag }).then(function (x) { mgNote(x.out); if (x.ok) { buildDue = true; MG.journal = null; } return refreshTags(); }).then(render);
  }
  if (a === "rv" || a === "rv-all") {
    var rids = a === "rv" ? [id] : MG.journal.changes.map(function (n) { return n.id; });
    if (a === "rv-all" && !confirm("Revert all " + rids.length + " changed rows?")) return;
    working();
    return api("/api/manage/revert", { ids: rids }).then(function (x) {
      mgNote(x.ok ? "Reverted " + x.reverted + " row(s)" + (x.skipped ? "; " + x.skipped + " skipped because they changed again" : "") + "." : x.out);
      MG.journal = null; return Promise.all([refreshIndex(), refreshTopics(), refreshTags()]);
    }).then(function () { manageLoad(); render(); });
  }
  if (a === "goto-build") { tab = "fin"; return render(); }
  if (a === "dup-review") { var di = t.dataset.ids.split(","); return openScope(di, "Rows sharing a bullet", di[0]); }
  if (a === "git-refresh") { GIT = null; return loadGit(); }
  if (a === "commit") {
    var msg = ($("#gc-msg") || {}).value || "";
    if (!confirm("Commit data/ and web/ with this message?\n\n" + msg)) return;
    return api("/api/manage/commit", { message: msg }).then(function (x) { GIT = null; loadGit(); logTxt = x.out; alert(x.out); });
  }
});
function chosenCount() { return MG.res ? MG.res.rows.filter(function (x) { return MG.sel[x.id]; }).length : 0; }
