#!/usr/bin/env node
/* Tests for the guide editor's pure parts (web/editor/lint.js, highlight.js): the colored source, the Problems checks and the first-placeholder finder.
   No packages: loads the real files with a stand-in for window.udfopHost (esc, splitSection and frontMatter are copied from web/app.js).   Usage: node tools/editor_test.js */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
const web = path.join(__dirname, "..", "web");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8").replace(/\r\n/g, "\n");
function grab(re) { const m = re.exec(app); assert(m, "not found in app.js: " + re); return m[0]; }
const host = new Function(
  grab(/  function esc\(s\)[^\n]*/) + "\n" + grab(/  function splitSection\(s\)[^\n]*/) + "\n" + grab(/  function frontMatter\(raw\) \{[\s\S]*?\n  \}\n/) +
  "\nreturn { esc: esc, splitSection: splitSection, frontMatter: frontMatter };")();
const pages = new Set(["how things work", "site:formatting reference"]);
host.pageExists = (key, site) => pages.has((site ? "site:" : "") + key);
host.pageList = (site) => (site ? [] : [{ title: "How things work", slug: "how-things-work", category: "Player Guide" }]);
host.topicExists = (low) => low === "combat";
host.patchExists = (v) => v === "0.1.2";
const sources = { "how things work": "---\ntitle: How things work\n---\n# Top\n## Real section\n```\n## In code\n```\n" };
host.pageSource = (key, site) => (site ? "" : key in sources ? sources[key] : "");
const files = { "images/ok.png": true, "images/none.png": false };
host.fileExists = (p) => (p in files ? files[p] : null);
const sandbox = { window: null, console };
sandbox.window = sandbox; sandbox.udfopHost = host;
vm.createContext(sandbox);
for (const f of ["highlight.js", "editor/lint.js", "editor/highlight.js", "editor/html2md.js", "editor/multi.js", "editor/format.js", "editor/complete.js", "editor/edits.js", "editor/search.js", "editor/viewopts.js", "editor/pick.js", "editor/visual.js"]) vm.runInContext(fs.readFileSync(path.join(web, f), "utf8"), sandbox, { filename: f });
const P = sandbox.udfopEditor;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; } catch (e) { failed++; console.log("FAIL " + name + "\n  " + (e.message || e).split("\n")[0]); } }
const msgs = (text) => P.lint(text).map((p) => p.msg);
const has = (text, re) => msgs(text).some((m) => re.test(m));
const GOOD = "---\ntitle: T\ncategory: C\nsummary: S\nauthors: A\n---\n\nBody\n";

test("a good page has no problems", () => assert.strictEqual(P.lint(GOOD).length, 0));
test("missing front matter reports title and summary", () => { assert(has("Just text", /No title/)); assert(has("Just text", /No summary/)); });
test("unclosed front matter", () => assert(has("---\ntitle: T\n\nBody", /front matter/i)));
test("unknown code language", () => assert(has(GOOD + "\n```zzzz\nx\n```\n", /zzzz/)));
test("a heading with no space after the hashes is flagged", () => {
  assert(has(GOOD + "\n#Title\n", /no space after the #/));
  assert(has(GOOD + "\n###Title\n", /no space after the ###/));
  assert(!has(GOOD + "\n## Title\n", /no space/));
  assert(!has(GOOD + "\n#######x\n", /no space/));
  assert(!has(GOOD + "\n```\n#x\n```\n", /no space/));
  assert.strictEqual(P.lint(GOOD + "\n#Title\n")[0].col, 0);
});
test("known code language is accepted", () => assert(!has(GOOD + "\n```lua\nx\n```\n", /lua/)));
test("unknown notice type", () => assert(has(GOOD + "\n> [!BOGUS]\n> text\n", /BOGUS/i)));
test("link to a missing page", () => assert(has(GOOD + "\n[[Nope]]\n", /Nope/)));
test("link to an existing page", () => assert(!has(GOOD + "\n[[How things work]]\n", /No page yet/)));
test("Site Guide link to an existing page", () => assert(!has(GOOD + "\n[[site:Formatting reference]]\n", /No page yet/)));
const level = (text, re) => { const p = P.lint(text).find((x) => re.test(x.msg)); return p && p.level; };
test("known topic and patch links are accepted", () => assert.strictEqual(P.lint(GOOD + "\n[[topic:Combat]] [[patch:0.1.2]]\n").length, 0));
test("unknown topic and patch", () => { assert(has(GOOD + "\n[[topic:Nope]]\n", /No Patch Notes topic/)); assert(has(GOOD + "\n[[patch:9.9.9]]\n", /no patch 9\.9\.9/)); });
test("a topic or patch link cannot name a section", () => assert(has(GOOD + "\n[[topic:Combat#Part]]\n", /cannot name a section/)));
test("same-page section links", () => { assert(!has(GOOD + "\n## Mine\n\n[[#Mine]]\n", /no section/)); assert(has(GOOD + "\n[[#Nowhere]]\n", /no section called "Nowhere"/)); });
test("section of another page", () => { assert(!has(GOOD + "\n[[How things work#Real section]]\n", /no section/)); assert(has(GOOD + "\n[[How things work#Zzz]]\n", /no section called "Zzz"/)); assert(has(GOOD + "\n[[How things work#In code]]\n", /no section/)); });
test("every occurrence of a missing link is reported", () => assert.strictEqual(P.lint(GOOD + "\n[[Nope]]\n[[Nope]]\n").length, 2));
test("a Site Guide page linked without site:", () => assert(has(GOOD + "\n[[Formatting reference]]\n", /Site Guide page, not a Game Guide page/)));
test("expected-missing silences a link", () => assert(!has(GOOD.replace("summary: S", "summary: S\nexpected-missing: Nope") + "\n[[Nope]]\n", /Nope/)));
test("missing links are warnings", () => assert.strictEqual(level(GOOD + "\n[[Nope]]\n", /No page yet/), "warn"));
test("an unclosed code box is an error", () => { assert.strictEqual(level(GOOD + "\n```lua\nx\n", /never closed/), "error"); assert(!has(GOOD + "\n```lua\nx\n```\n", /never closed/)); });
test("a fence line with extra words is flagged", () => assert(has(GOOD + "\n```lua title=x\nx\n```\n", /only a language name/)));
test("double-backtick code is ignored", () => assert(!has(GOOD + "\n`` [[Nope]] `` and ``` [[Nope]] ```\n", /Nope/)));
test("an unclosed spoiler", () => { assert(has(GOOD + "\n>! secret\n", /spoiler is never closed/)); assert(!has(GOOD + "\n>! secret !< ok\n", /spoiler/)); });
test("html is a warning", () => assert.strictEqual(level(GOOD + "\n<script>x</script>\n", /HTML/), "warn"));
test("an empty page is an error", () => assert.strictEqual(level("---\ntitle: T\nsummary: S\n---\n\n", /empty/), "error"));
test("a title that matches an existing page is an error", () => { const t = GOOD.replace("title: T", "title: How things work"); assert.strictEqual(level(t, /already exists/), "error"); });
test("editing a page: its own title and file name are not a clash, another page's are", () => {
  const own = GOOD.replace("title: T", "title: How things work"), sl = (slug) => P.lint(own, { slug }).some((p) => /already exists/.test(p.msg));
  assert(!sl("how-things-work")); assert(sl("something-else"));
});
test("editing a page in a folder: pictures are found beside it", () => {
  const seen = []; host.fileExists = (p) => { seen.push(p); return true; };
  P.lint(GOOD + "\n![x](images/a.png) ![y](./b.png) ![z](../c.png) ![w](../../d.png)\n", { slug: "sim/deep/page" });
  P.lint(GOOD + "\n![x](images/a.png)\n");
  host.fileExists = (p) => (p in files ? files[p] : null);
  assert.deepStrictEqual(seen, ["sim/deep/images/a.png", "sim/deep/b.png", "sim/c.png", "d.png", "images/a.png"]);
});
test("a differently spelled category", () => assert(has(GOOD.replace("category: C", "category: player guide"), /spelled/)));
test("related that matches nothing", () => { const g = (r) => GOOD.replace("category: C", "category: C\nrelated: " + r); assert(has(g("guide:Nope"), /related/)); assert(!has(g("guide:How things work, topic:Combat, patch:0.1.2"), /related/)); assert(has(g("topic:Zzz"), /no topic/)); });
test("a missing picture is an error; a known or pending one is not", () => {
  assert.strictEqual(level(GOOD + "\n![x](images/none.png)\n", /does not exist/), "error");
  assert(!has(GOOD + "\n![x](images/ok.png \"cap\"){center 400}\n", /picture/i));
  assert(!has(GOOD + "\n![x](images/unknown.png)\n", /does not exist/));
  assert(!has(GOOD + "\n![x](https://example.com/a.png) ![y](/abs.png)\n", /does not exist/));
});
test("picture options", () => { assert(has(GOOD + "\n![x](images/ok.png){bogus}\n", /Unknown picture option/)); assert(has(GOOD + "\n![x](images/ok.png){2000}\n", /outside 40 to 1200/)); assert(!has(GOOD + "\n![x](images/ok.png){left 300}\n", /picture/i)); });
test("infobox rows, count and position", () => {
  assert(has(GOOD.replace("Body\n", "> [!INFO]\n> Role:\n> Cost: 5\n"), /row "Role" has no value/));
  assert(has(GOOD + "\n> [!INFO]\n> A: 1\n", /not the first thing/));
  assert(has(GOOD.replace("Body\n", "> [!INFO]\n> A: 1\n\n> [!INFO]\n> B: 2\n"), /more than one infobox/));
  assert(!has(GOOD.replace("Body\n", "> [!INFO]\n> A: 1\n"), /infobox/i));
});
test("an escaped pipe in a table row is a label separator", () => {
  assert(!has(GOOD + "\n| A | B |\n| --- | --- |\n| [[How things work\\|the label]] | x |\n", /No page yet/));
  assert(has(GOOD + "\n| A | B |\n| --- | --- |\n| [[Nope\\|the label]] | x |\n", /\[\[Nope\]\]/));
});
test("a link written in backticks is ignored", () => assert(!has(GOOD + "\nUse `[[Nope]]`\n", /Nope/)));
test("a problem points at its line", () => assert.strictEqual(P.lint(GOOD + "\n[[Nope]]\n")[0].line, 10));
test("CRLF and BOM are tolerated", () => assert.strictEqual(P.lint("\ufeff" + GOOD.replace(/\n/g, "\r\n")).length, 0));

test("first placeholder skips the opening Tip box", () => {
  const t = "---\ntitle: T\n---\n\n> [!TIP]\n> Replace each *[bracketed line]* here.\n\n*[Real one]*\n";
  const r = P.firstPlaceholder(t); assert.strictEqual(t.slice(r[0], r[1]), "*[Real one]*");
});
test("no placeholder gives null", () => assert.strictEqual(P.firstPlaceholder("plain\n"), null));



const O = () => P.ops, L = (a) => a.split("\n"), J = (a) => a.join("\n");
test("edit: remove duplicates keeps the first of each line", () => assert.strictEqual(J(O().lines.dedupe(L("a\nb\na\nc\nb\n\n"))), "a\nb\nc\n"));
test("edit: remove consecutive duplicates only collapses runs", () => assert.strictEqual(J(O().lines.dedupeConsecutive(L("a\na\nb\na\na\na"))), "a\nb\na"));
test("edit: remove empty lines and blank lines", () => {
  assert.strictEqual(J(O().lines.removeEmpty(L("a\n\n  \nb"))), "a\n  \nb");
  assert.strictEqual(J(O().lines.removeBlank(L("a\n\n  \n\t\nb"))), "a\nb");
});
test("edit: reverse line order", () => assert.strictEqual(J(O().lines.reverse(L("1\n2\n3"))), "3\n2\n1"));
test("edit: trim trailing, leading and both", () => {
  assert.strictEqual(J(O().lines.trimTrailing(L("  a  \n\tb\t"))), "  a\n\tb");
  assert.strictEqual(J(O().lines.trimLeading(L("  a  \n\tb\t"))), "a  \nb\t");
  assert.strictEqual(J(O().lines.trimBoth(L("  a  \n\tb\t"))), "a\nb");
});
test("edit: indent skips empty lines; outdent removes a tab or up to two spaces", () => {
  assert.strictEqual(J(O().lines.indent(L("a\n\n- b"))), "  a\n\n  - b");
  assert.strictEqual(J(O().lines.outdent(L("    a\n  b\n c\n\td\ne"))), "  a\nb\nc\nd\ne");
});
test("edit: lexical sorts, with and without case", () => {
  const t = L("b\nA\na\nB");
  assert.strictEqual(J(O().sort(t, "lex", false)), "A\nB\na\nb");
  assert.strictEqual(J(O().sort(t, "lex", true)), "b\na\nB\nA");
  assert.strictEqual(J(O().sort(t, "lexi", false)), "A\na\nb\nB");   /* ties keep their order */
  assert.strictEqual(J(O().sort(t, "lexi", true)), "b\nB\nA\na");
});
test("edit: integer and decimal sorts use the number at the start; no number counts as lowest", () => {
  const t = L("10 ten\n2 two\nnone\n-5 neg\n2 again");
  assert.strictEqual(J(O().sort(t, "int", false)), "none\n-5 neg\n2 two\n2 again\n10 ten");
  assert.strictEqual(J(O().sort(t, "int", true)), "10 ten\n2 two\n2 again\n-5 neg\nnone");
  const d = L("1,5\n1.25\nx\n10\n.5");
  assert.strictEqual(J(O().sort(d, "dec", false)), "x\n.5\n1.25\n1,5\n10");
});
test("edit: sort by length", () => {
  const t = L("ccc\na\nbb\ndd");
  assert.strictEqual(J(O().sort(t, "len", false)), "a\nbb\ndd\nccc");
  assert.strictEqual(J(O().sort(t, "len", true)), "ccc\nbb\ndd\na");
});
test("edit: move lines up and down", () => {
  const t = L("a\nb\nc\nd");
  const up = O().move(t, 1, 2, -1); assert.strictEqual(J(up.lines), "b\nc\na\nd"); assert.deepStrictEqual([up.a, up.b], [0, 1]);
  const down = O().move(t, 1, 2, 1); assert.strictEqual(J(down.lines), "a\nd\nb\nc"); assert.deepStrictEqual([down.a, down.b], [2, 3]);
  assert.strictEqual(O().move(t, 0, 1, -1), null); assert.strictEqual(O().move(t, 2, 3, 1), null);
});
test("edit: change case", () => {
  assert.strictEqual(O().text.upper("Hello wörld"), "HELLO WÖRLD");
  assert.strictEqual(O().text.lower("Hello WÖRLD"), "hello wörld");
  assert.strictEqual(O().text.proper("the QUICK brown-fox don't stop"), "The Quick Brown-Fox Don't Stop");
  assert.strictEqual(O().text.sentence("hELLO there. how are you? FINE!\nnew line"), "Hello there. How are you? Fine!\nNew line");
});
const H2M = (h) => P.htmlToMarkdown(h);
test("paste html: headings, paragraphs, inline marks and links", () => {
  assert.strictEqual(H2M('<html><body><!--StartFragment--><h2>Title <span>here</span></h2><p>Some <strong>bold</strong> and <em>italic</em> with <code>code</code> and a <a href="https://example.com/a b">link</a>.</p><!--EndFragment--></body></html>'),
    "## Title here\n\nSome **bold** and *italic* with `code` and a [link](https://example.com/a%20b).");
});
test("paste html: lists, nested lists and ordered lists", () => {
  assert.strictEqual(H2M("<ul><li>One</li><li>Two<ul><li>Nested</li></ul></li></ul><ol start=3><li>A</li><li>B</li></ol>"), "- One\n- Two\n  - Nested\n\n3. A\n4. B");
  assert.strictEqual(H2M("<ul><li>No close<li>Second"), "- No close\n- Second");
});
test("paste html: tables, code blocks, quotes and rules", () => {
  assert.strictEqual(H2M("<table><thead><tr><th>Name</th><th>Cost</th></tr></thead><tbody><tr><td>Sword</td><td>5 | 6</td></tr><tr><td>Axe</td></tr></tbody></table>"), "| Name | Cost |\n| --- | --- |\n| Sword | 5 \\| 6 |\n| Axe |  |");
  assert.strictEqual(H2M("<pre>code  line\n  two</pre><blockquote><p>Quote</p><p>Two</p></blockquote><hr>"), "```\ncode  line\n  two\n```\n\n> Quote\n>\n> Two\n\n---");
});
test("paste html: entities, whitespace and line breaks", () => {
  assert.strictEqual(H2M("<p>Fish &amp; chips &lt;3&nbsp;&#8212; &#x41;&bogus;</p><p>a\n   b<br>c</p>"), "Fish & chips <3 — A&bogus;\n\na b  \nc");
});
test("paste html: scripts, styles, comments and unsafe links are dropped", () => {
  assert.strictEqual(H2M('<head><title>T</title><style>p{}</style></head><script>alert(1)</script><!--[if gte mso 9]><xml>x</xml><![endif]--><p class=MsoNormal>Hi<o:p></o:p> <a href="javascript:alert(1)">bad</a> <img src="data:image/png;base64,AAA" alt="pic"> <img src="https://x.test/a.png" alt="ok"></p>'),
    "Hi bad pic ![ok](https://x.test/a.png)");
  assert.strictEqual(H2M(""), ""); assert.strictEqual(H2M("plain text"), "plain text");
});
test("edit: proper and sentence case skip what is in front of the first letter", () => {
  assert.strictEqual(O().text.proper("2nd (hello) **bold** 3rd don’t the-quick"), "2Nd (Hello) **Bold** 3Rd Don’t The-Quick");
  assert.strictEqual(O().text.sentence("## my heading\n- item one. 1. next\n**bold** start. (aside) more"), "## My heading\n- Item one. 1. Next\n**Bold** start. (Aside) more");
});
/* the Tab keys, on a stand-in for the text box: the text is written with | for the caret, or [ ] around a selection */
function tabbed(src, cmd) {
  const m = /\[([^\]]*)\]/.exec(src);
  let value, s, e;
  if (m) { value = src.replace(m[0], m[1]); s = m.index; e = s + m[1].length; } else { s = e = src.indexOf("|"); value = src.replace("|", ""); }
  const ta = { value, selectionStart: s, selectionEnd: e, focus() {}, dispatchEvent() {}, select() { this.selectionStart = 0; this.selectionEnd = this.value.length; },
    setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b; },
    setRangeText(t, a, b) { this.value = this.value.slice(0, a) + t + this.value.slice(b); this.selectionStart = this.selectionEnd = a + t.length; } };
  sandbox.document = { execCommand(c, u, t) { if (c === "insertText") { ta.setRangeText(t, ta.selectionStart, ta.selectionEnd); return true; } if (c === "delete") { ta.setRangeText("", ta.selectionStart === ta.selectionEnd ? ta.selectionStart - 1 : ta.selectionStart, ta.selectionEnd); return true; } return false; } };
  P.editCommands({ ta, say() {} })(cmd);
  const out = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
  return a === b ? out.slice(0, a) + "|" + out.slice(a) : out.slice(0, a) + "[" + out.slice(a, b) + "]" + out.slice(b);
}
test("tab: indents the line when only spaces are left of the caret", () => {
  assert.strictEqual(tabbed("|item", "edit.tab"), "  |item");
  assert.strictEqual(tabbed("  |- a", "edit.tab"), "    |- a");
  assert.strictEqual(tabbed(" |- a", "edit.tab"), "   |- a");
  assert.strictEqual(tabbed("x\n|\ny", "edit.tab"), "x\n  |\ny");
  assert.strictEqual(tabbed("    |", "edit.tab"), "      |");
});
test("tab: from inside the leading spaces the caret goes to the end of them", () => {
  assert.strictEqual(tabbed("  | - a", "edit.tab"), "     |- a");
  assert.strictEqual(tabbed("|    - a", "edit.tab"), "      |- a");
  assert.strictEqual(tabbed("  |  - a", "edit.tab"), "      |- a");
  assert.strictEqual(tabbed("  |  ", "edit.tab"), "      |");
  assert.strictEqual(tabbed("\t|\tx", "edit.tab"), "  \t\t|x");
});
test("tab: in the middle of a line it types spaces up to the next tab stop", () => {
  assert.strictEqual(tabbed("ab|cd", "edit.tab"), "ab  |cd");
  assert.strictEqual(tabbed("abc|d", "edit.tab"), "abc |d");
  assert.strictEqual(tabbed("  - item|", "edit.tab"), "  - item  |");
});
test("tab: several lines or a whole line selected are indented; a part of a line is not", () => {
  assert.strictEqual(tabbed("[a\nb]\nc", "edit.tab"), "[  a\n  b]\nc");
  assert.strictEqual(tabbed("[item]\nx", "edit.tab"), "[  item]\nx");
  assert.strictEqual(tabbed("ab[cd]ef", "edit.tab"), "abcd  |ef");
});
test("shift+tab: walks back by tab stops through the text, then decreases the indentation", () => {
  let t = "    - item text|";   /* the caret is at column 15 */
  const steps = [];
  for (let i = 0; i < 9; i++) { t = tabbed(t, "edit.shifttab"); steps.push(t); }
  assert.deepStrictEqual(steps, [   /* the caret goes to columns 14, 12, 10, 8, 6 and 4 (only spaces left of it), then the indentation shrinks */
    "    - item tex|t", "    - item t|ext", "    - item| text", "    - it|em text", "    - |item text", "    |- item text",
    "  |- item text", "|- item text", "|- item text"]);
});
test("shift+tab: an odd column goes back to the stop below it", () => {
  assert.strictEqual(tabbed("   abc|", "edit.shifttab"), "   a|bc");
  assert.strictEqual(tabbed("ab c|d", "edit.shifttab"), "ab| cd");
});
test("shift+tab: once only spaces are left of the caret the line loses two spaces", () => {
  assert.strictEqual(tabbed("    |- a", "edit.shifttab"), "  |- a");
  assert.strictEqual(tabbed("  |- a", "edit.shifttab"), "|- a");
  assert.strictEqual(tabbed(" |- a", "edit.shifttab"), "|- a");
  assert.strictEqual(tabbed("|- a", "edit.shifttab"), "|- a");
  assert.strictEqual(tabbed("\t|x", "edit.shifttab"), "|x");
});
test("shift+tab: several lines or a whole line selected lose their indentation; a part of a line moves the caret", () => {
  assert.strictEqual(tabbed("[    a\n  b]\nc", "edit.shifttab"), "[  a\nb]\nc");
  assert.strictEqual(tabbed("[    item]\nx", "edit.shifttab"), "[  item]\nx");
  assert.strictEqual(tabbed("abcd[ef]gh", "edit.shifttab"), "ab|cdefgh");
});
/* Home on the stand-in text box: [ ] is the selection, and dir says which end of it the caret is on */
function homed(src, extend, dir) {
  const m = /\[([^\]]*)\]/.exec(src);
  let value, s, e;
  if (m) { value = src.replace(m[0], m[1]); s = m.index; e = s + m[1].length; } else { s = e = src.indexOf("|"); value = src.replace("|", ""); }
  const ta = { value, selectionStart: s, selectionEnd: e, selectionDirection: dir || "forward", focus() {}, setSelectionRange(a, b, d) { this.selectionStart = a; this.selectionEnd = b; this.selectionDirection = d || "none"; } };
  P.editCommands({ ta, say() {} })(extend ? "edit.homeextend" : "edit.home");
  const out = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
  return (a === b ? out.slice(0, a) + "|" + out.slice(a) : out.slice(0, a) + "[" + out.slice(a, b) + "]" + out.slice(b)) + (a === b ? "" : ta.selectionDirection === "backward" ? "<" : ">");
}
test("home: from the middle of a line it goes to the end of the leading spaces, from there to the start", () => {
  assert.strictEqual(homed("    - ite|m", false), "    |- item");
  assert.strictEqual(homed("    |- item", false), "|    - item");
  assert.strictEqual(homed("|    - item", false), "    |- item");   /* from the start it goes round to the end of the spaces again */
  assert.strictEqual(homed("  |  - item", false), "    |- item");
  assert.strictEqual(homed("a\n   b|c\nd", false), "a\n   |bc\nd");
});
test("home: a line without leading spaces, a blank line and a tab-indented line", () => {
  assert.strictEqual(homed("ab|cd", false), "|abcd");
  assert.strictEqual(homed("|abcd", false), "|abcd");
  assert.strictEqual(homed("x\n|\ny", false), "x\n|\ny");
  assert.strictEqual(homed("    |", false), "|    ");
  assert.strictEqual(homed("\tab|c", false), "\t|abc");
});
test("home: with Shift the selection grows over every character the caret passes", () => {
  assert.strictEqual(homed("    - ite|m", true), "    [- ite]m<");   /* to the end of the spaces ... */
  assert.strictEqual(homed("    [- ite]m", true, "backward"), "[    - ite]m<");   /* ... then to the start of the line */
  assert.strictEqual(homed("|abc", true), "|abc");
  assert.strictEqual(homed("a[bc]  d", true, "forward"), "[a]bc  d<");   /* the end that does not move stays where it was */
  assert.strictEqual(homed("   x[yz]", true, "forward"), "   [x]yz<");
});
test("home: without Shift a selection is replaced by the caret", () => {
  assert.strictEqual(homed("ab[cd]ef", false), "|abcdef");
  assert.strictEqual(homed("ab[cd]ef", false, "backward"), "|abcdef");
});
const MS = () => P.multi, R = (a, h, p) => (p ? { a, h: h === undefined ? a : h, p: true } : { a, h: h === undefined ? a : h });
const pos = (rs) => rs.map((r) => (r.a === r.h ? r.a : r.a + ">" + r.h)).join(","), prim = (rs) => rs.findIndex((r) => r.p), spans = (rs) => rs.map((r) => MS().lo(r) + "-" + MS().hi(r)).join(",");
test("multi: ranges are sorted and merged, with one primary", () => {
  const n = MS().normalize([R(9), R(2, 5), R(4, 7, true), R(5), R(1)]);
  assert.strictEqual(spans(n), "1-1,2-7,9-9"); assert.strictEqual(prim(n), 1); assert.strictEqual(n.filter((r) => r.p).length, 1);
  assert.strictEqual(MS().normalize([R(3), R(3)]).length, 1);
  assert.strictEqual(MS().normalize([R(1, 3), R(3, 5)]).length, 2);   /* two selections that only touch stay two */
  assert.strictEqual(MS().normalize([R(1), R(2)]).filter((r) => r.p).length, 1);
});
test("multi: Ctrl+click adds a caret, or removes the range that holds it, but never the last", () => {
  assert.strictEqual(pos(MS().toggleCaret([R(2, 2, true)], 5)), "2,5");
  assert.strictEqual(MS().toggleCaret([R(2, 2, true)], 5).find((r) => r.p).a, 5);
  assert.strictEqual(pos(MS().toggleCaret([R(2), R(5, 8, true)], 6)), "2");
  assert.strictEqual(pos(MS().toggleCaret([R(2, 2, true)], 2)), "2");
  assert.strictEqual(pos(MS().addRange([R(2), R(6)], 5, 9)), "2,5>9");   /* a word or line swallows the caret inside it */
});
test("multi: word, boundary and line under a position", () => {
  const w = (t, p) => { const r = MS().wordAt(t, p); return t.slice(r.s, r.e); };
  assert.strictEqual(w("foo bar", 1), "foo"); assert.strictEqual(w("foo bar", 3), " "); assert.strictEqual(w("foo   bar", 4), "   ");
  assert.strictEqual(w("a, b", 1), ","); assert.strictEqual(w("x ** y", 3), "**"); assert.strictEqual(w("end", 3), "end"); assert.strictEqual(w("don't go", 2), "don't");
  const l = (t, p) => { const r = MS().lineAt(t, p); return t.slice(r.s, r.e); };
  assert.strictEqual(l("one\ntwo\nthree", 5), "two\n"); assert.strictEqual(l("one\ntwo\nthree", 10), "three"); assert.strictEqual(l("one\n\nx", 4), "\n"); assert.strictEqual(l("a\n", 2), "");
});
test("multi: a box is one range per line over the same columns, clamped on short lines", () => {
  const t = "abcd\nef\nghijk";
  assert.strictEqual(pos(MS().boxRanges(t, { line: 0, col: 1 }, { line: 2, col: 3 })), "1>3,6>7,9>11");
  assert.strictEqual(pos(MS().boxRanges(t, { line: 0, col: 3 }, { line: 2, col: 3 })), "3,7,11");
  assert.strictEqual(pos(MS().boxRanges(t, { line: 2, col: 1 }, { line: 0, col: 1 })), "1,6,9");
  assert.strictEqual(prim(MS().boxRanges(t, { line: 0, col: 1 }, { line: 2, col: 3 })), 2);   /* the active line is the primary */
  const box = { anchor: { line: 1, col: 2 }, active: { line: 1, col: 2 } }, step = (b, d) => MS().boxStep(t, b, d);
  const down2 = step(step(box, 1), 1), back = step(down2, -1);
  assert.strictEqual(down2.active.line, 2); assert.strictEqual(back.active.line, 1);
  assert.strictEqual(step(step(box, -1), -1).active.line, 0); assert.strictEqual(step(step(step(box, 1), 1), 1).active.line, 2);
});
test("multi: typing, deleting and cutting act on every range", () => {
  const t = "ab\ncd";
  let r = MS().typed(t, [R(1), R(4, 4, true)], "X"); assert.strictEqual(r.text, "aXb\ncXd"); assert.strictEqual(pos(r.ranges), "2,6"); assert(r.ranges[1].p);
  r = MS().typed(t, [R(0, 2), R(3, 5)], "-"); assert.strictEqual(r.text, "-\n-"); assert.strictEqual(pos(r.ranges), "1,3");
  r = MS().deleted(t, [R(1), R(4)], -1); assert.strictEqual(r.text, "b\nd"); assert.strictEqual(pos(r.ranges), "0,2");
  r = MS().deleted(t, [R(1), R(4)], 1); assert.strictEqual(r.text, "a\nc");
  r = MS().deleted("abc", [R(1), R(2)], -1); assert.strictEqual(r.text, "c"); assert.strictEqual(r.ranges.length, 1);   /* carets that meet become one */
  r = MS().deleted("\u{1F600}a", [R(2)], -1); assert.strictEqual(r.text, "a");
  r = MS().cut("one two three", [R(0, 3), R(4), R(8, 13)]); assert.strictEqual(r.text, " two "); assert.strictEqual(pos(r.ranges), "0,1,5");
  r = MS().typedEach("ab", [R(0), R(1), R(2)], ["1", "2", "3"]); assert.strictEqual(r.text, "1a2b3");
  r = MS().deletedWord("foo bar baz", [R(7), R(11)], -1); assert.strictEqual(r.text, "foo  ");
});
test("multi: every range moves, and Shift extends it", () => {
  const t = "abc\n  de\nf", home = P.homeTarget, mv = (rs, kind, ext, goal) => MS().moveAll(t, rs, kind, ext, goal, home);
  assert.strictEqual(pos(mv([R(1), R(6)], "right", false).ranges), "2,7");
  assert.strictEqual(pos(mv([R(1, 3), R(6, 8)], "left", false).ranges), "1,6");   /* a selection collapses to its start */
  assert.strictEqual(pos(mv([R(1, 3), R(6, 8)], "right", false).ranges), "3,8");
  assert.strictEqual(pos(mv([R(1), R(6)], "right", true).ranges), "1>2,6>7");
  assert.strictEqual(pos(mv([R(3), R(8)], "down", false).ranges), "7,10");   /* column 3 of "  de" is offset 7; column 4 of a one-letter line is its end */
  assert.strictEqual(pos(mv([R(7)], "home", false).ranges), "6");
  assert.strictEqual(pos(mv([R(6)], "home", false).ranges), "4");
  assert.strictEqual(pos(mv([R(1), R(7)], "end", false).ranges), "3,8");
  assert.strictEqual(pos(mv([R(7)], "home", true).ranges), "7>6");
  assert.strictEqual(pos(mv([R(0), R(4)], "wordright", false).ranges), "3,8");
  const down = mv([R(3), R(8)], "down", false), up = mv(down.ranges, "up", false, down.goal);
  assert.strictEqual(up.goal, 4);   /* the column to aim for is the larger one, kept for the next Up or Down */
});
test("multi: every match of a piece of text, with the four Multi-Select All options", () => {
  const t = "The cat the CAT thecat cat.", found = (needle, mc, ww) => MS().findAll(t, needle, mc, ww).map((r) => t.slice(r.a, r.h) + "@" + r.a).join(" ");
  assert.strictEqual(found("cat", false, false), "cat@4 CAT@12 cat@19 cat@23");   /* ignore case and whole word: neither matters */
  assert.strictEqual(found("cat", true, false), "cat@4 cat@19 cat@23");   /* match case only */
  assert.strictEqual(found("cat", false, true), "cat@4 CAT@12 cat@23");   /* match whole word only */
  assert.strictEqual(found("cat", true, true), "cat@4 cat@23");   /* both */
  assert.strictEqual(MS().findAll("a.b axb a.b", "a.b", true, false).length, 2);   /* the text is searched for literally */
  assert.strictEqual(MS().findAll("ÉCOLE école", "école", false, false).length, 2);
  assert.strictEqual(MS().findAll("f(x) g(x)x", "(x)", true, true).length, 2);   /* a needle that starts or ends with a symbol needs no word boundary there */
  assert.strictEqual(MS().findAll("aaaa", "aa", true, false).length, 2);   /* matches do not overlap */
  assert.strictEqual(MS().findAll("a a a a", "a", true, false, 3).length, 3);
  assert.strictEqual(MS().findAll("abc", "", true, false).length, 0);
});
test("multi: a command runs on every selection from the last to the first", () => {
  const run = (t, rs, cmd, blockwise) => { const r = MS().runCommand(t, rs, cmd, blockwise); return r && { text: r.text, at: pos(r.ranges) }; };
  assert.deepStrictEqual(run("foo bar\nbaz qux", [R(0, 3), R(8, 11)], "edit.case.upper"), { text: "FOO bar\nBAZ qux", at: "0>3,8>11" });
  assert.strictEqual(run("foo bar\nbaz qux", [R(1), R(9)], "edit.case.upper").text, "FOO bar\nBAZ qux");
  assert.deepStrictEqual(run("  a\n  b", [R(0), R(4)], "edit.tab"), { text: "    a\n    b", at: "4,10" });
  assert.deepStrictEqual(run("  x", [R(0), R(1)], "edit.tab"), { text: "    x", at: "4" });   /* one line is indented once */
  assert.deepStrictEqual(run("ab\ncd", [R(1), R(4)], "edit.tab"), { text: "a b\nc d", at: "2,6" });
  assert.deepStrictEqual(run("abcd\nwxyz", [R(3), R(8)], "edit.shifttab"), { text: "abcd\nwxyz", at: "2,7" });   /* the text stays, the carets walk back */
  assert.strictEqual(run("b\na\nx\nd\nc", [R(0, 1), R(6, 7)], "edit.lines.sort.lex.asc", true), null);   /* one line each: nothing to sort */
  assert.strictEqual(run("b\na\nx\nd\nc", [R(0, 3), R(6, 9)], "edit.lines.sort.lex.asc", true).text, "a\nb\nx\nc\nd");
});
test("multi: move line and indent work on blocks of lines", () => {
  const run = (t, rs, cmd) => { const r = MS().runCommand(t, rs, cmd, true); return r && { text: r.text, at: pos(r.ranges) }; }, t = "a\nb\nc\nd\ne";
  assert.deepStrictEqual(run(t, [R(2), R(6)], "edit.lines.movedown"), { text: "a\nc\nb\ne\nd", at: "4,8" });
  assert.strictEqual(run(t, [R(2), R(6)], "edit.lines.moveup").text, "b\na\nd\nc\ne");
  assert.strictEqual(run(t, [R(0), R(6)], "edit.lines.moveup").text, "a\nb\nd\nc\ne");   /* the block at the top stays, the other moves */
  assert.strictEqual(run(t, [R(0), R(4), R(8)], "edit.indent.inc").text, "  a\nb\n  c\nd\n  e");
  assert.strictEqual(run(t, [R(0), R(2), R(4)], "edit.indent.inc").text, "  a\n  b\n  c\nd\ne");   /* lines that touch are one block */
  assert.strictEqual(run("a\nb\nc", [R(0), R(4)], "edit.lines.blankbelow").text, "a\n\nb\nc\n");
  assert.strictEqual(run("a", [R(0)], "edit.lines.moveup"), null);
});

test("highlight: one row per line", () => { for (const t of ["", "a", "a\n", "a\n\nb", GOOD, "```\ncode\n```\n> [!NOTE]\n> x"]) assert.strictEqual((P.highlight(t).match(/<div class="l">/g) || []).length, t.split("\n").length, JSON.stringify(t)); });
test("highlight: a selection is drawn as marks over exactly the selected characters", () => {
  const text = "## Head & <b>\nsome **bold** and [[Nope]] x\n\nlast", marked = (a, b) => {
    const h = P.highlight(text, [a, b]);
    assert.strictEqual((h.match(/<div class="l">/g) || []).length, text.split("\n").length);
    return [...h.matchAll(/<mark class="sel">([\s\S]*?)<\/mark>/g)].map((m) => m[1].replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")).join("");
  };
  for (const [a, b] of [[3, 8], [8, 13], [0, text.length], [20, 31], [13, 15], [14, 14], [40, 48]]) assert.strictEqual(marked(a, b), text.slice(a, b).replace(/\n/g, ""), a + "-" + b);   /* line breaks are not drawn */
  assert.strictEqual(P.highlight(text).includes("<mark"), false);
});
test("highlight: several selections and carets are drawn as marks and zero-width carets", () => {
  const rows = (text, sel) => P.highlight(text, sel).split('</div>').filter(Boolean).map((r) => r.replace('<div class="l">', ""));
  const seen = (row) => row.replace(/<span class="mc"><\/span>/g, "|").replace(/<mark class="sel">/g, "[").replace(/<\/mark>/g, "]").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  assert.deepStrictEqual(rows("ab\ncd", { ranges: [], carets: [1, 4] }).map(seen), ["a|b", "c|d"]);
  assert.deepStrictEqual(rows("ab\ncd", { ranges: [], carets: [0, 2, 5] }).map(seen), ["|ab|", "cd|"]);   /* a caret at the end of a line belongs to that line */
  assert.strictEqual(rows("a\n\nb", { ranges: [], carets: [2] })[1], '<span class="mc"></span>​');   /* an empty line keeps its height */
  assert.deepStrictEqual(rows("hello world", { ranges: [[0, 2], [6, 8]], carets: [4] }).map(seen), ["[he]ll|o [wo]rld"]);
  assert.deepStrictEqual(rows("one\ntwo\nthree", { ranges: [[1, 9]], carets: [] }).map(seen), ["o[ne]", "[two]", "[t]hree"]);
  const bold = rows("a **bold** & <b>", { ranges: [[0, 12]], carets: [3] })[0];
  assert.strictEqual(seen(bold), "[a ][*|*bold**][ &] <b>");   /* a mark closes before a tag and opens again after it */
  assert.strictEqual((bold.match(/<mark/g) || []).length, (bold.match(/<\/mark>/g) || []).length);   /* marks never cross a tag */
  assert.strictEqual(rows("x\ny\nz", { ranges: [[0, 5]], carets: [0, 1, 2, 3, 4, 5] }).length, 3);
});
test("highlight: text is escaped", () => { const h = P.highlight("<img src=x onerror=alert(1)> & \"q\" [[<b>]] `<i>`"); assert(!/<img|<b>|<i>/.test(h), h); });
test("highlight: a missing link is flagged, an existing one is not", () => { assert(/t-x/.test(P.highlight("[[Nope]]"))); assert(/t-w/.test(P.highlight("[[How things work]]"))); });
test("highlight: front matter, headings, fences and notices", () => {
  const h = P.highlight("---\ntitle: T\n---\n# H\n```lua\nx\n```\n> [!NOTE]\n");
  assert(/t-k">title/.test(h)); assert(/t-h">#/.test(h)); assert(/t-s">x/.test(h)); assert(/t-a">\[!NOTE\]/.test(h));
});
test("highlight: fuzz: random documents never throw and keep their line count", () => {
  const pool = ["---", "title: x", "```", "```lua", "~~~", "> [!NOTE]", "> [!TIP]", "[[", "]]", "[[A|b]]", "`", "**", "*", "{{", "}}", ">!", "!<", "|", "# H", "## H", "- i", "<script>", "&", "\"", "\\", "\r", "\t", "\u0000", "é", "😀", "", " "];
  let seed = 12345; const rnd = (n) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
  for (let i = 0; i < 3000; i++) {
    let t = ""; for (let k = rnd(40); k >= 0; k--) t += pool[rnd(pool.length)] + (rnd(3) ? "\n" : " ");
    const h = P.highlight(t); P.lint(t); P.firstPlaceholder(t);
    assert.strictEqual((h.match(/<div class="l">/g) || []).length, t.split("\n").length, JSON.stringify(t));
    assert(!/<script/.test(h), JSON.stringify(t));
  }
});


/* ---- Search menu ---- */
const SR = P.search;
const found = (t, q, o) => SR.all(t, SR.build(q, o).re);
test("search: plain text ignores case by default and escapes symbols", () => { assert.strictEqual(found("Ab ab a.b", "ab").length, 2); assert.strictEqual(found("a.b axb", "a.b").length, 1); });
test("search: match case and whole word", () => { assert.strictEqual(found("Ab ab", "ab", { matchCase: true }).length, 1); assert.strictEqual(found("cat concat cat_x cat", "cat", { word: true }).length, 2); });
test("search: regular expression, and a bad one reports an error", () => { assert.strictEqual(found("a1 b22 c", String.raw`\d+`,{ regex: true }).length, 2); assert(SR.build("(", { regex: true }).error); });
test("search: empty matches are skipped and the list is capped", () => { assert.strictEqual(found("abc", "x*", { regex: true }).length, 0); assert.strictEqual(found("a".repeat(SR.MAX + 50), "a").length, SR.MAX); });
test("search: pick next and previous, wrapping", () => { const l = [[2, 3], [6, 7], [9, 10]]; assert.strictEqual(SR.pick(l, 3, 1), 1); assert.strictEqual(SR.pick(l, 10, 1), 0); assert.strictEqual(SR.pick(l, 6, -1), 0); assert.strictEqual(SR.pick(l, 0, -1), 2); assert(SR.wraps(l, 0, 10, 1)); });
test("search: replace all, plain text keeps $ literally", () => { const r = SR.replaceAll("a a a", SR.build("a").re, "$&", {}); assert.strictEqual(r.text, "$& $& $&"); assert.strictEqual(r.count, 3); });
test("search: regex replacement groups and escapes", () => { const o = { regex: true }; assert.strictEqual(SR.replaceAll("ab-cd", SR.build(String.raw`(\w+)-(\w+)`, o).re, String.raw`$2\n$1 $$ $&`, o).text, "cd\nab $ ab-cd"); });
test("search: replaceAt only at the given start", () => { const re = SR.build("b").re; assert.strictEqual(SR.replaceAt("abab", re, 1, "X", {}).text, "X"); assert.strictEqual(SR.replaceAt("abab", re, 0, "X", {}), null); });
test("search: matches are drawn as marks, over a selection too", () => {
  assert.strictEqual(P.highlightRows("a bb a", { ranges: [], carets: [], finds: [[2, 4]] })[0], '<div class="l">a <mark class="find">bb</mark> a</div>');
  assert(P.highlightRows("a bb a", { ranges: [[3, 5]], carets: [], finds: [[2, 4]] })[0].indexOf('<mark class="sel find">b</mark>') > 0);
});

/* ---- View menu ---- */
const VO = P.viewOpts, NB = String.fromCharCode(0xA0), ZW = String.fromCharCode(0x200B), SOH = String.fromCharCode(1);
const plain = (h) => h.replace(/<[^>]*>/g, "");
test("view: symbols wrap blanks and keep the text as it was", () => {
  const h = P.symbolize("a b\t" + NB + "c", { ws: true, np: true });
  assert.strictEqual(h, 'a<span class="sw"> </span>b<span class="st">\t</span><span class="sn">' + NB + "</span>c");
  assert.strictEqual(plain(h), "a b\t" + NB + "c");
});
test("view: symbols leave everything alone when off, and never touch tags or entities", () => {
  assert.strictEqual(P.symbolize("a b", {}), "a b");
  assert.strictEqual(P.symbolize('<span class="t-m">a &amp; b</span>', { ws: true }), '<span class="t-m">a<span class="sw"> </span>&amp;<span class="sw"> </span>b</span>');
});
test("view: non-printing and control characters get a name", () => {
  assert.strictEqual(P.symbolize("a" + ZW + "b", { np: true }), 'a<span class="sg" data-g="ZWSP">' + ZW + "</span>b");
  assert.strictEqual(P.symbolize(SOH, { cc: true }), '<span class="sg" data-g="SOH">' + SOH + "</span>");
  assert.strictEqual(P.symbolize(ZW + SOH, { ws: true }), ZW + SOH);
});
test("view: indent guides sit at every second column of the leading blanks only", () => {
  const h = P.symbolize("    a  b", { guide: true });
  assert.strictEqual((h.match(/class="ig"/g) || []).length, 2);
  assert.strictEqual(P.symbolize("\t\tx", { guide: true }), '<span class="ig">\t</span><span class="ig">\t</span>x');
  assert.strictEqual(P.symbolize("a  b", { guide: true }), "a  b");
});
test("view: rows get the line break mark except the last, and the classes asked for", () => {
  const r = P.highlightRows("a\n\nb", null, { sym: { eol: true }, cls: (i) => (i === 1 ? "cur" : "") });
  assert.strictEqual(r[0], '<div class="l">a<span class="se"></span></div>');
  assert.strictEqual(r[1], '<div class="l cur">' + ZW + '<span class="se"></span></div>');
  assert.strictEqual(r[2], '<div class="l">b</div>');
});
test("view: rows without options are as before, and a caret in an empty row keeps its height", () => {
  assert.strictEqual(P.highlightRows("a", null)[0], '<div class="l">a</div>');
  assert.strictEqual(P.highlightRows("\n", { ranges: [], carets: [0] }, { sym: { ws: true } })[0], '<div class="l"><span class="mc"></span>' + ZW + "</div>");
});
test("view: headings skip the front matter and code", () => {
  assert.strictEqual(JSON.stringify(VO.headings("---\ntitle: x\n# no\n---\n# A\ntext\n```\n# no\n```\n## B\n#no\n####### no\n### C")), "[4,9,12]");
  assert.strictEqual(JSON.stringify(VO.headings("# A\n~~~\n# no\n~~~\n# B")), "[0,4]");
});
test("view: scrolling carries over in proportion between headings", () => {
  const a = [0, 100, 300, 500], b = [0, 40, 440, 600];
  assert.strictEqual(VO.mapScroll(a, b, 0), 0);
  assert.strictEqual(VO.mapScroll(a, b, 100), 40);
  assert.strictEqual(VO.mapScroll(a, b, 200), 240);
  assert.strictEqual(VO.mapScroll(a, b, 500), 600);
  assert.strictEqual(VO.mapScroll(b, a, 240), 200);
  assert.strictEqual(VO.mapScroll([0, 0, 0], [0, 0, 0], 5), 0);
});
test("view: anchors never go back or past the end", () => { assert.strictEqual(JSON.stringify(VO.monotone([0, 50, 30, 900], 400)), "[0,50,50,400]"); });
test("view: change marks follow the lines", () => {
  const was = ["a", "b", "c"], st = [0, 0, 0];
  assert.deepStrictEqual(VO.track(st, was, ["a", "B", "c"]), [0, 1, 0]);
  assert.deepStrictEqual(VO.track(st, was, ["a", "x", "y", "b", "c"]), [0, 1, 1, 0, 0]);
  assert.deepStrictEqual(VO.track([0, 2, 0], was, ["a", "c"]), [0, 1]);
  assert.deepStrictEqual(VO.track([0, 1, 2], was, ["a", "b", "c", "d"]), [0, 1, 2, 1]);
  assert.deepStrictEqual(VO.saved([0, 1, 2]), [0, 2, 2]);
});
test("view: zoom steps move through the sizes and stop at the ends", () => {
  assert.strictEqual(VO.zoomStep(VO.EZ, 14, 1), 16); assert.strictEqual(VO.zoomStep(VO.EZ, 14, -1), 13);
  assert.strictEqual(VO.zoomStep(VO.EZ, 40, 1), 40); assert.strictEqual(VO.zoomStep(VO.EZ, 8, -1), 8);
  assert.strictEqual(VO.zoomStep(VO.PZ, 1, 1), 1.1); assert.strictEqual(VO.zoomStep(VO.PZ, 0.5, -1), 0.5);
});
test("view: settings load with defaults, and bad stored values are ignored", () => {
  const store = (v) => ({ getItem: () => v });
  assert.deepStrictEqual(VO.load(store(null)), VO.DEFAULTS);
  assert.strictEqual(VO.load(store("{\"wrap\":false,\"ez\":16,\"pz\":9,\"num\":\"x\"}")).wrap, false);
  const s = VO.load(store("{\"wrap\":false,\"ez\":16,\"pz\":9,\"num\":\"x\"}"));
  assert.strictEqual(s.ez, 16); assert.strictEqual(s.pz, 1); assert.strictEqual(s.num, true);
  assert.deepStrictEqual(VO.load(store("not json")), VO.DEFAULTS);
});
test("view: fuzz: symbols keep the text of any row", () => {
  const pool = ["a", " ", "\t", NB, ZW, SOH, "&", "<", "`", "*", "[[", "]]", "- ", "# "];
  let seed = 99; const rnd = (n) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
  for (let i = 0; i < 2000; i++) {
    let t = ""; for (let k = rnd(30); k >= 0; k--) t += pool[rnd(pool.length)] + (rnd(5) ? "" : "\n");
    const o = { sym: { ws: true, eol: true, np: true, cc: true, guide: true } }, plainRows = P.highlightRows(t, null), rows = P.highlightRows(t, null, o);
    assert.strictEqual(rows.length, plainRows.length);
    rows.forEach((r, j) => assert.strictEqual(plain(r).replace(/<[^>]*>/g, ""), plain(plainRows[j]).replace(/<[^>]*>/g, ""), JSON.stringify(t)));
  }
});

/* ---- Format menu ---- */
const FM = P.fmt, S1 = String.fromCharCode(1), S2 = String.fromCharCode(2);
/* text with the selection between \u0001 and \u0002 (a caret is one \u0001): the text after the command, with the new selection marked the same way (the lines commands leave it out) */
function fx(name, marked) {
  const s = marked.indexOf(S1), e = marked.indexOf(S2) < 0 ? s : marked.indexOf(S2) - 1, v = marked.replace(S1, "").replace(S2, "");
  const r = FM.command(name, v, s, e);
  if (!r) return null;
  if (r.lines) {
    let a, b;
    if (r.span) { a = r.span.start; b = r.span.end; } else { const last = e > s && v.charAt(e - 1) === "\n" ? e - 1 : e; a = s === 0 ? 0 : v.lastIndexOf("\n", s - 1) + 1; const nl = v.indexOf("\n", last); b = nl < 0 ? v.length : nl; }
    return v.slice(0, a) + r.lines(v.slice(a, b).split("\n")).join("\n") + v.slice(b);
  }
  const p = r.plan; if (!p) return null;
  const t = v.slice(0, p.start) + p.text + v.slice(p.end);
  return p.a === p.b ? t.slice(0, p.a) + S1 + t.slice(p.a) : t.slice(0, p.a) + S1 + t.slice(p.a, p.b) + S2 + t.slice(p.b);
}
const m1 = (t) => t.replace(/\u0001/g, "[").replace(/\u0002/g, "]");
test("format: bold wraps the selection and selects what is inside; again takes it off", () => {
  assert.strictEqual(fx("bold", "a " + S1 + "word" + S2 + " b"), "a **" + S1 + "word" + S2 + "** b");
  assert.strictEqual(fx("bold", "a **" + S1 + "word" + S2 + "** b"), "a " + S1 + "word" + S2 + " b");
  assert.strictEqual(fx("bold", "a " + S1 + "**word**" + S2 + " b"), "a " + S1 + "word" + S2 + " b");
});
test("format: blanks at the ends of the selection stay outside the marks", () => {
  assert.strictEqual(fx("bold", "a" + S1 + "  word " + S2 + "b"), "a  **" + S1 + "word" + S2 + "** b");
  assert.strictEqual(fx("bold", S1 + "   " + S2), null);
});
test("format: with nothing selected the word at the caret is marked, or an empty pair is made, or an empty pair is removed", () => {
  assert.strictEqual(fx("italic", "a wo" + S1 + "rd b"), "a *wo" + S1 + "rd* b");
  assert.strictEqual(fx("italic", "a *wo" + S1 + "rd* b"), "a wo" + S1 + "rd b");
  assert.strictEqual(fx("bold", "a " + S1 + " b"), "a **" + S1 + "** b");
  assert.strictEqual(fx("bold", "a **" + S1 + "** b"), "a " + S1 + " b");
  assert.strictEqual(fx("code", "x" + S1), "`x" + S1 + "`");
});
test("format: bold and italic add to each other", () => {
  assert.strictEqual(fx("italic", "**" + S1 + "x" + S2 + "**"), "***" + S1 + "x" + S2 + "***");
  assert.strictEqual(fx("bold", "***" + S1 + "x" + S2 + "***"), "*" + S1 + "x" + S2 + "*");
  assert.strictEqual(fx("italic", "***" + S1 + "x" + S2 + "***"), "**" + S1 + "x" + S2 + "**");
  assert.strictEqual(fx("bold", "*" + S1 + "x" + S2 + "*"), "***" + S1 + "x" + S2 + "***");
  assert.strictEqual(fx("bolditalic", S1 + "x" + S2), "***" + S1 + "x" + S2 + "***");
  assert.strictEqual(fx("bolditalic", "***" + S1 + "x" + S2 + "***"), S1 + "x" + S2);
  assert.strictEqual(fx("bolditalic", "**" + S1 + "x" + S2 + "**"), "***" + S1 + "x" + S2 + "***");
  assert.strictEqual(fx("italic", "*a* and " + S1 + "b" + S2), "*a* and *" + S1 + "b" + S2 + "*");
});
test("format: a selection over several lines is marked line by line, and unmarked when every line is", () => {
  assert.strictEqual(fx("bold", S1 + " a b\n\nc  " + S2), " **" + S1 + "a b**\n\n**c" + S2 + "**  ");
  assert.strictEqual(fx("bold", S1 + "**a b**\n\n**c**" + S2), S1 + "a b\n\nc" + S2);
  assert.strictEqual(fx("bold", S1 + "**a b**\n\nc" + S2).replace(/[\u0001\u0002]/g, ""), "**a b**\n\n**c**");
});
test("format: code, spoiler, wiki link and key", () => {
  assert.strictEqual(fx("code", S1 + "x" + S2), "`" + S1 + "x" + S2 + "`");
  assert.strictEqual(fx("code", S1 + "a`b" + S2), "`` " + S1 + "a`b" + S2 + " ``");
  assert.strictEqual(fx("spoiler", S1 + "boss" + S2), ">!" + S1 + "boss" + S2 + "!<");
  assert.strictEqual(fx("spoiler", ">!" + S1 + "boss" + S2 + "!<"), S1 + "boss" + S2);
  assert.strictEqual(fx("wiki", "see Dagger" + S1 + "fall"), "see [[Dagger" + S1 + "fall]]");
  assert.strictEqual(fx("wiki", S1 + "Iliac Bay" + S2), "[[" + S1 + "Iliac Bay" + S2 + "]]");
  assert.strictEqual(fx("wiki", "[[" + S1 + "Iliac Bay" + S2 + "]]"), S1 + "Iliac Bay" + S2);
  assert.strictEqual(fx("key", "press " + S1 + "W" + S2), "press {{" + S1 + "W" + S2 + "}}");
});
test("format: a link takes the selection as its text, or an address as its address", () => {
  assert.strictEqual(fx("link", "a " + S1 + "guide" + S2), "a [guide](" + S1 + "url" + S2 + ")");
  assert.strictEqual(fx("link", S1 + "https://x.org/a" + S2), "[" + S1 + "link text" + S2 + "](https://x.org/a)");
  assert.strictEqual(fx("link", "a wo" + S1 + "rd"), "a [word](" + S1 + "url" + S2 + ")");
  assert.strictEqual(fx("link", "a " + S1), "a [" + S1 + "link text" + S2 + "](url)");
});
test("format: clear formatting takes the marks off the selection or the line", () => {
  assert.strictEqual(FM.strip("**a** *b* `c` >!d!< {{W}} [[Page]] [[Page|shown]] [t](u) ![alt](p.png)"), "a b c d W Page shown t alt");
  assert.strictEqual(fx("clear", "x " + S1 + "**a** `b`" + S2 + " **c**"), "x " + S1 + "a b" + S2 + " **c**");
  assert.strictEqual(fx("clear", "## **a** b" + S1), S1 + "## a b" + S2);
  assert.strictEqual(fx("clear", "plain" + S1), null);
});
test("format: headings replace what is there, and the same one again makes a paragraph", () => {
  assert.strictEqual(fx("h.2", "text" + S1), "## text");
  assert.strictEqual(fx("h.3", "## text" + S1), "### text");
  assert.strictEqual(fx("h.2", "## text" + S1), "text");
  assert.strictEqual(fx("h.2", "- item" + S1), "## item");
  assert.strictEqual(fx("h.2", "a\n\n" + S1 + "b\nc" + S2), "a\n\n## b\n## c");
  assert.strictEqual(fx("p", "### text" + S1), "text");
  assert.strictEqual(fx("p", "> ## text" + S1), "> text");
  assert.strictEqual(fx("h.4", "> text" + S1), "> #### text");
});
test("format: bullet and numbered lists switch, number and toggle", () => {
  assert.strictEqual(fx("ul", S1 + "a\n\nb" + S2), "- a\n\n- b");
  assert.strictEqual(fx("ul", S1 + "- a\n- b" + S2), "a\nb");
  assert.strictEqual(fx("ul", S1 + "1. a\n- b" + S2), "- a\n- b");
  assert.strictEqual(fx("ol", S1 + "a\nb\n\nc" + S2), "1. a\n2. b\n\n3. c");
  assert.strictEqual(fx("ol", S1 + "1. a\n2. b" + S2), "a\nb");
  assert.strictEqual(fx("ol", S1 + "- a\n- b" + S2), "1. a\n2. b");
  assert.strictEqual(fx("ul", "  a" + S1), "  - a");
  assert.strictEqual(fx("ul", "> a" + S1), "> - a");
  assert.strictEqual(fx("ul", "## a" + S1), "- a");
  assert.strictEqual(fx("ul", S1), "- ");
});
test("format: quote adds and takes off one level", () => {
  assert.strictEqual(fx("quote", S1 + "a\n\nb" + S2), "> a\n>\n> b");
  assert.strictEqual(fx("quote", S1 + "> a\n>\n> b" + S2), "a\n\nb");
  assert.strictEqual(fx("quote", S1 + "> > a" + S2), "> a");
  assert.strictEqual(fx("quote", S1), "> ");
  assert.strictEqual(fx("quote", "> a\nb" + S1), "> a\n> b");
});
test("format: a callout is a quote that opens with its type; the same type again, or Remove, takes it off", () => {
  assert.strictEqual(fx("callout.note", "text" + S1), "> [!NOTE]\n> text");
  assert.strictEqual(fx("callout.tip", S1 + "a\n\nb" + S2), "> [!TIP]\n> a\n>\n> b");
  assert.strictEqual(fx("callout.warning", "> [!NOTE]\n> text" + S1), "> [!WARNING]\n> text");
  assert.strictEqual(fx("callout.note", "> [!NOTE]\n> text\n>\n> more" + S1), "text\n\nmore");
  assert.strictEqual(fx("callout.remove", "x\n\n> [!TIP]\n> a\n> b" + S1 + "\n\ny\n> z"), "x\n\na\nb\n\ny\n> z");
  assert.strictEqual(fx("callout.note", S1), "> [!NOTE]\n> ");
  assert.strictEqual(fx("callout.remove", "> [!TIP] inline\n> a" + S1), "inline\na");
  assert.strictEqual(fx("callout.caution", "> plain\n> quote" + S1), "> [!CAUTION]\n> plain\n> quote");
  assert.strictEqual(fx("callout.remove", "text" + S1), "text");
  assert.strictEqual(fx("callout.nonsense", "text" + S1), null);
});
test("format: the lines of a whole callout are used when the selection is inside one", () => {
  const v = "a\n> [!NOTE]\n> x\n> y\n\nb";
  assert.deepStrictEqual(JSON.parse(JSON.stringify(FM.calloutSpan(v, v.indexOf("y"), v.indexOf("y")))), { start: 2, end: 19 });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(FM.calloutSpan("> plain\n> quote", 9, 9))), { start: 0, end: 15 });
  assert.strictEqual(FM.calloutSpan("text", 1, 1), null);
});
test("format: a code block wraps the lines, unwraps a box, and uses a longer fence around fences", () => {
  assert.strictEqual(m1(fx("codeblock", "a\n" + S1 + "b\nc" + S2 + "\nd")), "a\n```\n[b\nc]\n```\nd");
  assert.strictEqual(m1(fx("codeblock", "a\nb" + S1 + "\nc")), "a\n```\n[b]\n```\nc");
  assert.strictEqual(fx("codeblock", "a\n" + S1 + "```\nb\n```" + S2 + "\nc"), "a\n" + S1 + "b" + S2 + "\nc");
  assert.strictEqual(fx("codeblock", "```\nb" + S1 + "\n```").replace(/[\u0001\u0002]/g, ""), "b");
  assert.strictEqual(fx("codeblock", "a\n" + S1 + "\nb"), "a\n```\n" + S1 + "\n```\nb");
  assert.strictEqual(fx("codeblock.js", S1 + "```js\nx\n```" + S2).replace(/[\u0001\u0002]/g, ""), "x");
  assert.strictEqual(fx("codeblock", S1 + "a ``` b" + S2).replace(/[\u0001\u0002]/g, ""), "````\na ``` b\n````");
});
test("format: a rule and the snippets stand on lines of their own with a blank line around them", () => {
  const clean = (t) => t.replace(/[\u0001\u0002]/g, "");
  assert.strictEqual(clean(fx("hr", "a" + S1 + "\nb")), "a\n\n---\n\nb");
  assert.strictEqual(clean(fx("hr", "a\n\n" + S1 + "\n\nb")), "a\n\n---\n\nb");
  assert.strictEqual(clean(fx("hr", S1)), "---");
  assert.strictEqual(clean(fx("hr", "a\n" + S1)), "a\n\n---");
  assert.strictEqual(fx("snip.spoiler", S1), ">!" + S1 + "Hidden text" + S2 + "!<");
  assert.strictEqual(clean(fx("snip.table2", "a\n" + S1)), "a\n\n| Heading | Heading |\n| --- | --- |\n| Text | Text |\n| Text | Text |");
  assert.strictEqual(clean(fx("snip.table3", S1)).split("\n").length, 5);
  assert.strictEqual(fx("snip.table2", S1), "| " + S1 + "Heading" + S2 + " | Heading |\n| --- | --- |\n| Text | Text |\n| Text | Text |");
  assert.strictEqual(fx("snip.infobox", S1), "> [!INFO] " + S1 + "Title" + S2 + "\n> image: images/name.png\n> ## Group\n> Key: Value\n> Key: Value");
  assert.strictEqual(fx("snip.image", "a " + S1), "a ![alt text](" + S1 + "images/name.png" + S2 + ")");
  assert.strictEqual(fx("snip.image", "a " + S1 + "photo" + S2), "a ![photo](" + S1 + "images/name.png" + S2 + ")");
});
test("format: front matter is added only to a page that has none", () => {
  assert.strictEqual(fx("snip.front", "Body" + S1), "---\ntitle: " + S1 + "\ncategory: \nsummary: \nauthors: \n---\n\nBody");
  assert.strictEqual(fx("snip.front", "---\ntitle: T\n---\n" + S1), null);
  assert.strictEqual(FM.hasFrontMatter("---\na: b\n---"), true);
  assert.strictEqual(FM.hasFrontMatter("--- x\n"), false);
  assert.strictEqual(FM.hasFrontMatter(""), false);
});
test("format: marks added and taken off again give back the text (fuzz)", () => {
  const pool = ["a", "b", " ", "  ", "\n", "x y", ".", "-", "#", ">"];
  let seed = 7; const rnd = (n) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
  for (const name of ["bold", "italic", "code", "spoiler", "wiki", "key", "bolditalic"]) for (let i = 0; i < 300; i++) {
    let t = ""; for (let k = rnd(12); k >= 0; k--) t += pool[rnd(pool.length)];
    const a = rnd(t.length + 1), b = rnd(t.length + 1), s = Math.min(a, b), e = Math.max(a, b), r = FM.command(name, t, s, e);
    if (!r.plan) continue;
    const p = r.plan, t2 = t.slice(0, p.start) + p.text + t.slice(p.end), sel = t2.slice(p.a, p.b);
    if (e > s && t.slice(s, e).indexOf("\n") < 0) {
      assert.strictEqual(sel, t.slice(s, e).replace(/^[ \t]+|[ \t]+$/g, ""), name + " " + JSON.stringify([t, s, e]));
      const back = FM.command(name, t2, p.a, p.b).plan;
      assert(back, name + " cannot take its marks off " + JSON.stringify([t, s, e]));
      assert.strictEqual(t2.slice(0, back.start) + back.text + t2.slice(back.end), t, name + " round trip " + JSON.stringify([t, s, e]));
    }
  }
});
test("format: the multi-selection code runs a command on every selection", () => {
  const M = P.multi, out = M.runCommand("ab cd ef", [{ a: 1, h: 1 }, { a: 7, h: 7 }], "format.bold", false);
  assert.strictEqual(out.text, "**ab** cd **ef**");
  const out2 = M.runCommand("ab\ncd\n\nef", [{ a: 1, h: 1 }, { a: 8, h: 8 }], "format.ul", true);
  assert.strictEqual(out2.text, "- ab\ncd\n\n- ef");
  const out3 = M.runCommand("ab\ncd", [{ a: 1, h: 1 }, { a: 4, h: 4 }], "format.h.2", true);
  assert.strictEqual(out3.text, "## ab\n## cd");
  assert.strictEqual(M.runCommand("**ab**", [{ a: 3, h: 3 }], "format.bold", false).text, "ab");
});

/* ---- completion, code languages and tables ---- */
const CP = P.complete;
/* a plan applied to the text with the selection marked by \u0001 (and \u0002): the result marked the same way; null when the plan is null */
function ap(marked, fn, ...args) {
  const s = marked.indexOf(S1), e = marked.indexOf(S2) < 0 ? s : marked.indexOf(S2) - 1, v = marked.replace(S1, "").replace(S2, "");
  const p = fn(v, s, e, ...args);
  if (!p) return null;
  const t = v.slice(0, p.start) + p.text + v.slice(p.end);
  return p.a === p.b ? t.slice(0, p.a) + S1 + t.slice(p.a) : t.slice(0, p.a) + S1 + t.slice(p.a, p.b) + S2 + t.slice(p.b);
}
const ty = (m, ch) => ap(m, CP.typed, ch);
test("complete: openers bring their closers, and typing a closer steps over it", () => {
  assert.strictEqual(ty("a " + S1, "("), "a (" + S1 + ")");
  assert.strictEqual(ty("a " + S1, "["), "a [" + S1 + "]");
  assert.strictEqual(ty("[" + S1 + "]", "["), "[[" + S1 + "]]");
  assert.strictEqual(ty("{" + S1 + "}", "{"), "{{" + S1 + "}}");
  assert.strictEqual(ty("(" + S1 + ")", ")"), "()" + S1);
  assert.strictEqual(ty("[[a" + S1 + "]]", "]"), "[[a]" + S1 + "]");
  assert.strictEqual(ty("a " + S1, "`"), "a `" + S1 + "`");
  assert.strictEqual(ty("`x" + S1 + "`", "`"), "`x`" + S1);
  assert.strictEqual(ty("a" + S1, "`"), null);
  assert.strictEqual(ty("``" + S1, "`"), null);
  assert.strictEqual(ty("a" + S1 + "b", "("), null);
  assert.strictEqual(ty("a " + S1, "x"), null);
});
test("complete: a star pairs only where an emphasis can begin", () => {
  assert.strictEqual(ty("a " + S1, "*"), "a *" + S1 + "*");
  assert.strictEqual(ty("(" + S1, "*"), "(*" + S1 + "*");
  assert.strictEqual(ty(S1, "*"), null);
  assert.strictEqual(ty("  " + S1, "*"), null);
  assert.strictEqual(ty("word" + S1, "*"), null);
  assert.strictEqual(ty("*word" + S1 + "*", "*"), "*word*" + S1);
  assert.strictEqual(ty("**word*" + S1 + "*", "*"), "**word**" + S1);
  assert.strictEqual(ty("a *" + S1, "*"), null);
});
test("complete: a spoiler opener brings !< and typing ! steps over it", () => {
  assert.strictEqual(ty(">" + S1, "!"), ">!" + S1 + "!<");
  assert.strictEqual(ty("a >" + S1, "!"), "a >!" + S1 + "!<");
  assert.strictEqual(ty("a>" + S1, "!"), null);
  assert.strictEqual(ty(">!" + S1 + "!<", "!"), ">!!<" + S1);
});
test("complete: with text selected an opener wraps it and keeps it selected", () => {
  assert.strictEqual(ty(S1 + "abc" + S2, "["), "[" + S1 + "abc" + S2 + "]");
  assert.strictEqual(ty("[" + S1 + "abc" + S2 + "]", "["), "[[" + S1 + "abc" + S2 + "]]");
  assert.strictEqual(ty(S1 + "abc" + S2, "*"), "*" + S1 + "abc" + S2 + "*");
  assert.strictEqual(ty("*" + S1 + "abc" + S2 + "*", "*"), "**" + S1 + "abc" + S2 + "**");
  assert.strictEqual(ty(S1 + "abc" + S2, "`"), "`" + S1 + "abc" + S2 + "`");
  assert.strictEqual(ty(S1 + "abc" + S2, "("), "(" + S1 + "abc" + S2 + ")");
  assert.strictEqual(ty(S1 + "abc" + S2, "x"), null);
});
test("complete: nothing is paired inside a code box or on a fence line", () => {
  assert.strictEqual(ty("```\na " + S1 + "\n```", "("), null);
  assert.strictEqual(ty("```js" + S1, "("), null);
  assert.strictEqual(ty("```\nx\n```\na " + S1, "("), "```\nx\n```\na (" + S1 + ")");
});
test("complete: Backspace between the halves of an empty pair removes both", () => {
  const bs = (m) => ap(m, CP.backspace);
  assert.strictEqual(bs("a(" + S1 + ")"), "a" + S1);
  assert.strictEqual(bs("[[" + S1 + "]]"), "[" + S1 + "]");
  assert.strictEqual(bs("`" + S1 + "`"), S1);
  assert.strictEqual(bs("**" + S1 + "**"), "*" + S1 + "*");
  assert.strictEqual(bs(">!" + S1 + "!<"), S1);
  assert.strictEqual(bs("(a" + S1 + ")"), null);
  assert.strictEqual(bs("(" + S1 + "a)"), null);
  assert.strictEqual(bs("```\n(" + S1 + ")\n```"), null);
  assert.strictEqual(ap(S1 + "(" + S2 + ")", CP.backspace), null);
});
test("complete: Enter continues lists, quotes and boxes, and ends them when the line is empty", () => {
  const en = (m) => ap(m, CP.enter);
  assert.strictEqual(en("- a" + S1), "- a\n- " + S1);
  assert.strictEqual(en("* a" + S1), "* a\n* " + S1);
  assert.strictEqual(en("  - a" + S1), "  - a\n  - " + S1);
  assert.strictEqual(en("1. a" + S1), "1. a\n2. " + S1);
  assert.strictEqual(en("9) a" + S1), "9) a\n10) " + S1);
  assert.strictEqual(en("- x" + S1 + "yz"), "- x\n- " + S1 + "yz");
  assert.strictEqual(en("- a\n- " + S1), "- a\n" + S1);
  assert.strictEqual(en("> - a" + S1), "> - a\n> - " + S1);
  assert.strictEqual(en("> - " + S1), "> " + S1);
  assert.strictEqual(en("> a" + S1), "> a\n> " + S1);
  assert.strictEqual(en(">a" + S1), ">a\n> " + S1);
  assert.strictEqual(en("> " + S1), S1);
  assert.strictEqual(en("> [!NOTE]" + S1), "> [!NOTE]\n> " + S1);
  assert.strictEqual(en("plain" + S1), null);
  assert.strictEqual(en(S1 + "- a"), null);
  assert.strictEqual(en("- " + S1 + "a"), "- \n- " + S1 + "a");
  assert.strictEqual(en(S1 + "a" + S2), null);
});
test("complete: Enter after an opening fence adds the closing one; inside a box it keeps the indentation", () => {
  const en = (m) => ap(m, CP.enter);
  assert.strictEqual(en("```js" + S1), "```js\n" + S1 + "\n```");
  assert.strictEqual(en("```" + S1), "```\n" + S1 + "\n```");
  assert.strictEqual(en("~~~" + S1), "~~~\n" + S1 + "\n~~~");
  assert.strictEqual(en("  ```" + S1), "  ```\n  " + S1 + "\n  ```");
  assert.strictEqual(en("```js" + S1 + "\ncode\n```"), null);
  assert.strictEqual(en("```\n  code" + S1 + "\n```"), "```\n  code\n  " + S1 + "\n```");
  assert.strictEqual(en("```\ncode" + S1 + "\n```"), null);
  assert.strictEqual(en("```\ncode\n```" + S1), null);
  assert.strictEqual(en("---\ntitle: T\n---\n- a" + S1), "---\ntitle: T\n---\n- a\n- " + S1);
});
test("complete: Enter and Tab in a table add rows and move between cells", () => {
  const en = (m) => ap(m, CP.enter), tb = (m, back) => ap(m, CP.tab, back);
  const T = "| a | b |\n| - | - |\n| c | d |";
  assert.strictEqual(en("| a | b |\n| - | - |\n| c | d |" + S1), "| a   | b   |\n| --- | --- |\n| c   | d   |\n| " + S1 + "    |     |");
  assert.strictEqual(en("| a | b |" + S1 + "\n| - | - |\n| c | d |"), "| a   | b   |\n| --- | --- |\n| " + S1 + "    |     |\n| c   | d   |");
  assert.strictEqual(en("| a |\n| - |\n| |" + S1), "| a   |\n| --- |\n\n" + S1);
  assert.strictEqual(en("| A | B |" + S1), "| A   | B   |\n| --- | --- |\n| " + S1 + "    |     |");
  assert.strictEqual(en("| A |" + S1 + "\n| b |"), "| A   |\n| --- |\n| " + S1 + "    |\n| b   |");
  assert.strictEqual(tb("| a" + S1 + " | b |\n| - | - |\n| c | d |"), "| a   | " + S1 + "b" + S2 + "   |\n| --- | --- |\n| c   | d   |");
  assert.strictEqual(tb("| a | b" + S1 + " |\n| - | - |\n| c | d |"), "| a   | b   |\n| --- | --- |\n| " + S1 + "c" + S2 + "   | d   |");
  assert.strictEqual(tb(T.slice(0, T.length - 1) + S1 + "|"), "| a   | b   |\n| --- | --- |\n| c   | d   |\n| " + S1 + "    |     |");
  assert.strictEqual(tb("| a | b |\n| - | - |\n| c" + S1 + " | d |", true), "| a   | " + S1 + "b" + S2 + "   |\n| --- | --- |\n| c   | d   |");
  assert.strictEqual(tb("| a" + S1 + " | b |", true), null);
  assert.strictEqual(tb("text" + S1), null);
  assert.strictEqual(tb("```\n| a" + S1 + " |\n```"), null);
  assert.strictEqual(tb("| a |\n| - |\n| b |\n" + S1 + "x"), null);
});
test("format: a table is set out in equal columns and keeps its alignment marks", () => {
  assert.strictEqual(fx("table.align", "|a|bb|\n|-|:-:|\n|ccc|d|" + S1), "| a   | bb  |\n| --- | :-: |\n| ccc | d" + S1 + "   |");
  assert.strictEqual(fx("table.align", "| long heading | x |" + S1), "| long heading | x" + S1 + "   |");
  assert.strictEqual(fx("table.align", "text" + S1), null);
  assert.strictEqual(fx("table.align", "| a |\n| --- |" + S1).replace(S1, ""), "| a   |\n| --- |");
  assert.strictEqual(fx("table.align", "|a|b|\n|--:|:--|" + S1).replace(S1, ""), "| a   | b   |\n| --: | :-- |");
});
const ctxOf = (m) => { const s = m.indexOf(S1); const c = CP.context(m.replace(S1, ""), s); return c && [c.kind, c.query, s - c.from, c.page].filter((x) => x !== undefined).join("|"); };
test("complete: what is being typed decides which names are offered", () => {
  assert.strictEqual(ctxOf("see [[Ili" + S1), "page|Ili|3");
  assert.strictEqual(ctxOf("see [[" + S1 + "]]"), "page||0");
  assert.strictEqual(ctxOf("[[topic:Ren" + S1), "page|topic:Ren|9");
  assert.strictEqual(ctxOf("[[Controls#Se" + S1), "heading|Se|2|Controls");
  assert.strictEqual(ctxOf("[[a|sh" + S1), null);
  assert.strictEqual(ctxOf("{{Shift+Rig" + S1), "key|Rig|3");
  assert.strictEqual(ctxOf("{{" + S1 + "}}"), "key||0");
  assert.strictEqual(ctxOf("> [!NO" + S1), "callout|NO|2");
  assert.strictEqual(ctxOf("x\n> [!" + S1), "callout||0");
  assert.strictEqual(ctxOf("![alt](ima" + S1 + ")"), "image|ima|3");
  assert.strictEqual(ctxOf("> image: ima" + S1), "image|ima|3");
  assert.strictEqual(ctxOf("[a](ima" + S1), null);
  assert.strictEqual(ctxOf("---\ncategory: It" + S1), "category|It|2");
  assert.strictEqual(ctxOf("---\nrelated: topic:A, gui" + S1), "related|gui|3");
  assert.strictEqual(ctxOf("---\nsu" + S1), "field|su|2");
  assert.strictEqual(ctxOf("---\nsu" + S1 + "m: x"), null);
  assert.strictEqual(ctxOf("---\ntitle: T\n---\nsu" + S1), null);
  assert.strictEqual(ctxOf("su" + S1), null);
  assert.strictEqual(ctxOf("```\n[[a" + S1 + "\n```"), null);
});
test("footnotes: a reference with no note is an error, a note never used is a warning, a name defined twice is an error", () => {
  assert(!has(GOOD + "\nText[^a]\n\n[^a]: Note\n", /footnote|\[\^/i));
  assert.strictEqual(level(GOOD + "\nText[^a]\n", /no note/), "error");
  assert.strictEqual(level(GOOD + "\nText\n\n[^a]: Note\n", /never used/), "warn");
  assert.strictEqual(level(GOOD + "\nText[^a]\n\n[^a]: One\n[^a]: Two\n", /already defined/), "error");
});
test("footnotes: code, a note's own lines and a reference inside a note are not references", () => {
  assert(!has(GOOD + "\n`[^a]` and\n```\n[^b]\n[^c]: x\n```\n", /footnote|\[\^/i));
  assert(!has(GOOD + "\nText[^a]\n\n[^a]: Note [^b]\n", /no note/));
  assert(!has(GOOD + "\nText[^a]\n\n[^a]: Note\n    continued [^zz]\n", /no note/));
});
test("footnotes: the editor offers the names defined on the page", () => {
  const t = "a\n[^w]: x\n[^ab]: y\ntext [^", c = CP.context(t, t.length);
  assert.strictEqual(c.kind, "footnote");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(CP.items(c, {}).map((i) => i.label))), ["w", "ab"]);
  assert.strictEqual(CP.context("```\n[^", 6), null);
});
test("footnotes: the Footnote snippet adds a reference and a note at the end, numbering past used names", () => {
  assert.strictEqual(fx("snip.footnote", "Text" + S1 + " more\n"), "Text[^note1] more\n\n[^note1]: " + S1 + "Note text" + S2);
  assert.strictEqual(fx("snip.footnote", "Text[^note1]" + S1 + "\n\n[^note1]: A"), "Text[^note1][^note2]\n\n[^note1]: A\n\n[^note2]: " + S1 + "Note text" + S2);
});
test("footnotes: the source view colors the reference and the note line", () => {
  const h = P.highlight("Text[^a]\n[^a]: Note\n");
  assert((h.match(/t-q">\[\^a\]</g) || []).length === 1 && /t-q">\[\^a\]:</.test(h));
});
const DATA = { pages: [{ title: "Controls", category: "Basics" }, { title: "Iliac Hand", category: "Guides" }], site: [{ title: "Using the editor" }], topics: ["Iliac Bay", "Renown"], categories: ["Basics", "Guides"], images: ["images/a.png", "images/b.png"], headings: (p) => (p === "Controls" ? ["Intro", "Setup"] : null) };
const labels = (kind, query, page) => JSON.parse(JSON.stringify(CP.items({ kind, query, page }, DATA).map((i) => i.label)));
test("complete: names are offered best match first", () => {
  assert.deepStrictEqual(labels("page", "ili"), ["Iliac Hand", "topic:Iliac Bay"]);
  assert.deepStrictEqual(labels("page", ""), ["Controls", "Iliac Hand", "topic:Iliac Bay", "topic:Renown", "site:Using the editor"]);
  assert.deepStrictEqual(labels("page", "edit"), ["site:Using the editor"]);
  assert.deepStrictEqual(labels("page", "site:"), ["site:Using the editor"]);
  assert.deepStrictEqual(labels("page", "Controls"), []);
  assert.deepStrictEqual(labels("related", "gui"), ["guide:Controls", "guide:Iliac Hand"]);
  assert.deepStrictEqual(labels("heading", "set", "Controls"), ["Setup"]);
  assert.deepStrictEqual(labels("heading", "", "Missing"), []);
  assert.deepStrictEqual(labels("key", "pad:r").slice(0, 2), ["Pad:RB", "Pad:RT"]);
  assert.deepStrictEqual(labels("callout", "w"), ["WARNING"]);
  assert.deepStrictEqual(labels("field", "su"), ["summary"]);
  assert.deepStrictEqual(labels("category", "ba"), ["Basics"]);
  assert.deepStrictEqual(labels("image", "b"), ["images/b.png"]);
  assert.strictEqual(CP.items({ kind: "page", query: "" }, { pages: Array.from({ length: 30 }, (_, i) => ({ title: "P" + i })), site: [], topics: [] }).length, 10);
});
test("complete: choosing a name replaces what was typed and closes the mark", () => {
  const acc = (m, kind, label, extra) => { const s = m.indexOf(S1), v = m.replace(S1, ""), c = Object.assign({ kind, query: "" }, extra); c.from = c.from === undefined ? s - (c.n || 0) : c.from; const p = CP.accept(v, s, c, { insert: label }); const t = v.slice(0, p.start) + p.text + v.slice(p.end); return t.slice(0, p.a) + S1 + t.slice(p.a); };
  assert.strictEqual(acc("see [[Ili" + S1, "page", "Iliac Hand", { n: 3 }), "see [[Iliac Hand]]" + S1);
  assert.strictEqual(acc("see [[Ili" + S1 + "]]", "page", "Iliac Hand", { n: 3 }), "see [[Iliac Hand]]" + S1);
  assert.strictEqual(acc("{{Shift+Ri" + S1 + "}}", "key", "Right", { n: 2 }), "{{Shift+Right}}" + S1);
  assert.strictEqual(acc("> [!W" + S1, "callout", "WARNING", { n: 1 }), "> [!WARNING]" + S1);
  assert.strictEqual(acc("![a](im" + S1 + ")", "image", "images/a.png", { n: 2, paren: true }), "![a](images/a.png)" + S1);
  assert.strictEqual(acc("> image: im" + S1, "image", "images/a.png", { n: 2 }), "> image: images/a.png" + S1);
  assert.strictEqual(acc("---\nsu" + S1, "field", "summary: ", { n: 2 }), "---\nsummary: " + S1);
  assert.strictEqual(acc("---\ncategory: Ba" + S1 + "ics", "category", "Basics", { n: 2 }), "---\ncategory: Basics" + S1);
});
test("complete: the headings of a page are read from its source, not from code or the front matter", () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(CP.headingsOf("---\ntitle: T\n# not\n---\n# One\n```\n# nope\n```\n## Two ##\ntext"))), ["One", "Two"]);
});
test("format: the Code Block menu lists only languages the site colors", () => {
  const src = fs.readFileSync(path.join(web, "editor", "menus.js"), "utf8"), names = sandbox.udfopHighlight.names;
  const used = [...src.matchAll(/\["[^"]+", "([a-z#]+)"\]/g)].map((m) => m[1]);
  assert(used.length >= 20);
  used.forEach((n) => assert(names.indexOf(n) >= 0, n + " is not a language the site colors"));
});
test("format: a language goes after the opening fence, changes in a box of another language, and a box of the same one is unwrapped", () => {
  assert.strictEqual(m1(fx("codeblock.js", "a\nb" + S1 + "\nc")), "a\n```js\n[b]\n```\nc");
  assert.strictEqual(fx("codeblock.json", "```js\nx" + S1 + "\n```"), "```json\nx" + S1 + "\n```");
  assert.strictEqual(fx("codeblock.js", "```js\nx" + S1 + "\n```").replace(/[\u0001\u0002]/g, ""), "x");
  assert.strictEqual(fx("codeblock", "```js\nx" + S1 + "\n```"), "```\nx" + S1 + "\n```");
  assert.strictEqual(fx("codeblock.py", S1 + "```js\nx\n```" + S2), S1 + "```py\nx\n```" + S2);
  assert.strictEqual(fx("codeblock.js", S1 + "```js\nx\n```" + S2).replace(/[\u0001\u0002]/g, ""), "x");
  assert.strictEqual(fx("codeblock.lua", "a\n" + S1 + "\nb"), "a\n```lua\n" + S1 + "\n```\nb");
});

test("pick: lineRange gives the text of the lines without the last line break", () => {
  const t = "one\ntwo\nthree\nfour";
  assert.strictEqual(JSON.stringify(P.pick.lineRange(t, 1, 1)), "[0,3]");
  assert.strictEqual(JSON.stringify(P.pick.lineRange(t, 2, 3)), "[4,13]");
  assert.strictEqual(JSON.stringify(P.pick.lineRange(t, 4, 4)), "[14,18]");
  assert.strictEqual(t.slice(...P.pick.lineRange(t, 2, 3)), "two\nthree");
});
test("pick: parseLn and within", () => {
  assert.strictEqual(JSON.stringify(P.pick.parseLn("3-5")), "[3,5]");
  assert.strictEqual(P.pick.parseLn("x"), null);
  const t = "a\nSee [the **big** page](x) now\nz";
  const r = P.pick.within(t, 2, 2, "big");
  assert.strictEqual(t.slice(...r), "big");
  assert.strictEqual(P.pick.within(t, 2, 2, "missing"), null);
  assert.strictEqual(P.pick.within(t, 1, 1, "big"), null);
  assert.strictEqual(P.pick.within(t, 2, 2, "  "), null);
});

test("edit: off by default and a View toggle", () => assert.strictEqual(P.viewOpts.DEFAULTS.edit, false));
test("visual: replaceLines swaps only the block's lines", () => {
  const r = P.visual.replaceLines("a\nb\nc\n\nd", 2, 3, "X");
  assert.strictEqual(r.text, "a\nX\n\nd");
  assert.strictEqual(P.visual.replaceLines("a\nb", 2, 2, "Z").text, "a\nZ");
});
test("visual: rewrite keeps the heading hashes and refuses text that would become another block", () => {
  assert.strictEqual(P.visual.rewrite("h", ["### Old"], "New"), "### New");
  assert.strictEqual(P.visual.rewrite("h", ["Old"], "New"), null);
  assert.strictEqual(P.visual.rewrite("p", ["x"], " two\nlines "), "two lines");
  assert.strictEqual(P.visual.rewrite("p", ["x"], "# not a heading"), null);
  assert.strictEqual(P.visual.rewrite("p", ["x"], "- not a list"), null);
  assert.strictEqual(P.visual.rewrite("p", ["x"], ""), null);
});

const T = (v) => ({ nodeType: 3, nodeValue: v });
const E = (tag, attrs, ...kids) => ({ nodeType: 1, tagName: tag.toUpperCase(), childNodes: kids, className: (attrs && attrs.class) || "", getAttribute: (k) => (attrs && k in attrs ? attrs[k] : null) });
const ser = (...kids) => P.visual.serialize({ childNodes: kids });
test("visual: serialize writes marks, links, code, atoms and spoilers back as Markdown", () => {
  assert.strictEqual(ser(T("a "), E("b", null, T("big")), T(" and "), E("i", null, T("it"))), "a **big** and *it*");
  assert.strictEqual(ser(E("a", { href: "x", "data-href": "[[y]]".slice(0, 0) + "#/guide/p" }, T("go")), E("sup", { class: "lt" }, T("↗"))), "[go](#/guide/p)");
  assert.strictEqual(ser(E("code", null, T("a`b"))), "``a`b``");
  assert.strictEqual(ser(E("span", { class: "vis-atom", "data-md": "[[Page]]" }, E("a", { href: "#/g" }, T("Page")))), "[[Page]]");
  assert.strictEqual(ser(E("span", { class: "spoiler" }, T("boo"))), ">!boo!<");
  assert.strictEqual(ser(T("x y"), E("br")), "x y ");
  assert.strictEqual(P.visual.serialize({ childNodes: [T("one"), E("ul", null, E("li", null, T("sub")))] }, true), "one");
});
test("visual: cellSpans finds each cell's words, with and without edge pipes", () => {
  const w = (l) => Array.from(P.visual.cellSpans(l)).map((s) => l.slice(s[0], s[1]));
  assert.deepStrictEqual(w("| a | b c | d |"), ["a", "b c", "d"]);
  assert.deepStrictEqual(w("a | b"), ["a", "b"]);
  assert.deepStrictEqual(w("| a \\| b | c |"), ["a \\| b", "c"]);
  assert.deepStrictEqual(w("| a |  | c |"), ["a", "", "c"]);
});
test("visual: rewrite replaces one cell or one list item's words and keeps the rest", () => {
  assert.strictEqual(P.visual.rewrite("cell", ["| a | b | c |"], "X|Y", 1), "| a | X\\|Y | c |");
  assert.strictEqual(P.visual.rewrite("cell", ["| a |  | c |"], "mid", 1), "| a | mid | c |");
  assert.strictEqual(P.visual.rewrite("li", ["  2. old"], "new"), "  2. new");
  assert.strictEqual(P.visual.rewrite("li", ["- old"], "- nested"), null);
});
test("visual: convertLine builds the line for another block kind", () => {
  assert.strictEqual(P.visual.convertLine("h3", "Words"), "### Words");
  assert.strictEqual(P.visual.convertLine("li", "Words"), "- Words");
  assert.strictEqual(P.visual.convertLine("quote", "Words"), "> Words");
  assert.strictEqual(P.visual.convertLine("p", "# Words"), null);
});
test("visual: sourceWords gives the words the way the source spells them", () => {
  assert.strictEqual(P.visual.sourceWords("p", ["  one ", "two"]), "one two");
  assert.strictEqual(P.visual.sourceWords("h", ["## Title ##"]), "Title");
  assert.strictEqual(P.visual.sourceWords("li", ["1. item"]), "item");
  assert.strictEqual(P.visual.sourceWords("cell", ["| a | b |"], 1), "b");
});
test("visual: diffEdit gives the smallest replacement", () => {
  const d = P.visual.diffEdit("one two three", "one 2 three");
  assert.strictEqual("one two three".slice(0, d.start) + d.repl + "one two three".slice(d.end), "one 2 three");
  assert.strictEqual(d.repl, "2");
});
const NL = String.fromCharCode(10), JL = (...l) => l.join(NL);
test("visual: deleteBlock removes the block and one blank line", () => {
  assert.strictEqual(P.visual.deleteBlock(JL("a", "", "b", "", "c"), 3, 3), JL("a", "", "c"));
  assert.strictEqual(P.visual.deleteBlock(JL("a", "", "b", ""), 3, 3), JL("a", ""));
  assert.strictEqual(P.visual.deleteBlock(JL("a", "", "b"), 3, 3), "a");
});
test("visual: insertAfter and duplicateBlock set the new block apart with blank lines", () => {
  const r = P.visual.insertAfter(JL("a", "", "b"), 1, ["X", "Y"]);
  assert.strictEqual(r.text, JL("a", "", "X", "Y", "", "b")); assert.strictEqual(r.first, 3);
  assert.strictEqual(P.visual.insertAfter(JL("a", "b"), 1, ["X"]).text, JL("a", "", "X", "", "b"));
  assert.strictEqual(P.visual.duplicateBlock(JL("a", "b", "", "c"), 1, 2).text, JL("a", "b", "", "a", "b", "", "c"));
});
test("visual: swapBlocks keeps what lies between the blocks", () => {
  assert.strictEqual(P.visual.swapBlocks(JL("a", "a2", "", "b", "", "c"), [1, 2], [4, 4]), JL("b", "", "a", "a2", "", "c"));
  assert.strictEqual(P.visual.swapBlocks(JL("a", "x", "b"), [1, 1], [3, 3]), null);
});
test("visual: table rows and columns", () => {
  const t = ["| H1 | H2 |", "|---|---|", "| a | b |"];
  assert.deepStrictEqual(Array.from(P.visual.tableAddRow(t, 2)), [...t, "|  |  |"]);
  assert.deepStrictEqual(Array.from(P.visual.tableAddRow(t, 0)), [t[0], t[1], "|  |  |", t[2]]);
  assert.strictEqual(P.visual.tableDelRow(t, 1), null);
  assert.deepStrictEqual(Array.from(P.visual.tableDelRow(t, 2)), [t[0], t[1]]);
  assert.deepStrictEqual(Array.from(P.visual.tableAddCol(t, 0, true)), ["| H1 | Heading | H2 |", "| --- | --- | --- |", "| a |  | b |"]);
  assert.deepStrictEqual(Array.from(P.visual.tableDelCol(t, 0)), ["| H2 |", "| --- |", "| b |"]);
  assert.strictEqual(P.visual.tableDelCol(["| H |", "|---|"], 0), null);
  assert.deepStrictEqual(Array.from(P.visual.tableSnippet(2, 1)), ["| Heading | Heading |", "| --- | --- |", "| Text | Text |"]);
});
test("visual: a table's column types, row label and key/value setup", () => {
  const V = P.visual, t = ["| Item | Level | Cost |", "|:---{label}|---:{num}|---|", "| Sword | 5 | 100 |"];
  const o = V.parseTable(t);
  assert.strictEqual(o.kv, false);
  assert.deepStrictEqual(Array.from(o.cols, (c) => [c.type, c.label]), [["", true], ["num", false], ["", false]]);
  // a type is changed and the row label dropped; alignment and the rows stay
  assert.deepStrictEqual(Array.from(V.buildTable(t, { kv: false, label: false, types: ["", "pct", "num"] })), ["| Item | Level | Cost |", "| :--- | ---:{pct} | ---{num} |", "| Sword | 5 | 100 |"]);
  // key/value: the heading row is emptied and the first column becomes the label
  const kv = V.buildTable(["| A | B |", "|---|---|", "| k | v |"], { kv: true, label: false, types: ["", ""] });
  assert.deepStrictEqual(Array.from(kv), ["|  |  |", "| ---{label} | --- |", "| k | v |"]);
  assert.strictEqual(V.parseTable(kv).kv, true);
  // and back: the headings are filled in again, the label stays
  assert.deepStrictEqual(Array.from(V.buildTable(kv, { kv: false, label: true, types: ["", ""] })), ["| Heading | Heading |", "| ---{label} | --- |", "| k | v |"]);
  assert.strictEqual(V.parseTable(["| a |", "not a divider"]), null);
  // a column added to a key/value table keeps its heading row empty
  assert.deepStrictEqual(Array.from(V.tableAddCol(kv, 1, true)), ["|  |  |  |", "| ---{label} | --- | --- |", "| k | v |  |"]);
});
test("visual: code boxes, pictures and quotes are taken apart and put back", () => {
  const c = P.visual.parseCode(["```js", "a", "b", "```"]);
  assert.strictEqual(c.lang, "js"); assert.strictEqual(c.body, "a" + NL + "b"); assert.strictEqual(c.closed, true);
  c.lang = ""; c.body = "x" + NL + "```";
  assert.deepStrictEqual(Array.from(P.visual.buildCode(c)), ["````", "x", "```", "````"]);
  const f = P.visual.parseFig('![Alt](images/a.png "Cap"){right 240}');
  assert.strictEqual(f.alt, "Alt"); assert.strictEqual(f.src, "images/a.png"); assert.strictEqual(f.caption, "Cap"); assert.strictEqual(f.opts, "right 240");
  assert.strictEqual(P.visual.buildFig(f), '![Alt](images/a.png "Cap"){right 240}');
  assert.strictEqual(P.visual.parseFig("not a picture"), null);
  const q = P.visual.parseQuote(["> [!INFO] Title", "> Key: Value", ">", "> More"]);
  assert.strictEqual(q.kind, "info"); assert.strictEqual(q.title, "Title"); assert.strictEqual(q.body, "Key: Value" + NL + NL + "More");
  assert.deepStrictEqual(Array.from(P.visual.buildQuote(q)), ["> [!INFO] Title", "> Key: Value", ">", "> More"]);
  q.kind = "warning"; assert.strictEqual(P.visual.buildQuote(q)[0], "> [!WARNING]");
  assert.strictEqual(P.visual.parseQuote(["> plain"]).kind, "quote");
});
test("visual: moveBlockTo moves a block across several others", () => {
  const t = JL("a", "", "b", "", "c", "", "d");
  const r = [[1, 1], [3, 3], [5, 5], [7, 7]];
  assert.strictEqual(P.visual.moveBlockTo(t, r, 0, 3), JL("b", "", "c", "", "d", "", "a"));
  assert.strictEqual(P.visual.moveBlockTo(t, r, 3, 1), JL("a", "", "d", "", "b", "", "c"));
  assert.strictEqual(P.visual.moveBlockTo(JL("a", "b", "", "c"), [[1, 2], [4, 4]], 1, 0), JL("c", "", "a", "b"));
});

test("a picture is given a side, keeping its width and caption", () => {
  const V = P.visual;
  assert.strictEqual(V.setFigSide("a\n![x](p.png \"Cap\")\nb", 2, "left"), "a\n![x](p.png \"Cap\"){left}\nb");
  assert.strictEqual(V.setFigSide("![x](p.png){right 240}", 1, "center"), "![x](p.png){center 240}");
  assert.strictEqual(V.setFigSide("not a picture", 1, "left"), null);
});
test("a picture is given a width, keeping its side", () => {
  const V = P.visual;
  assert.strictEqual(V.setFigWidth("![x](p.png \"C\")", 1, 300), "![x](p.png \"C\"){300}");
  assert.strictEqual(V.setFigWidth("![x](p.png){left 240}", 1, 100), "![x](p.png){left 100}");
  assert.strictEqual(V.setFigWidth("![x](p.png){right 240px}", 1, 5000), "![x](p.png){right 1200}");
});
test("a table's divider row keeps its {tags} when the table is set out", () => {
  const F = P.fmt, v = "| Item | Level |\n|:---{label}|---:{num}|\n| Sword | 5 |\n";
  const plan = F.alignTable(v, 2);
  assert.strictEqual(plan.text, ["| Item       | Level    |", "| :--{label} | --:{num} |", "| Sword      | 5        |"].join("\n"));
});
test("a column's type is set, changed and cleared in the divider row", () => {
  const F = P.fmt, v = "| Item | Level |\n| --- | --- |\n| Sword | 5 |";
  const pos = v.indexOf("5");
  let plan = F.columnTag(v, pos, "num");
  assert(/---\{num\}/.test(plan.text), plan.text);
  plan = F.columnTag(plan.text, plan.text.indexOf("5"), "pct");
  assert(/\{pct\}/.test(plan.text) && !/num/.test(plan.text), plan.text);
  plan = F.columnTag(plan.text, plan.text.indexOf("5"), "auto");
  assert(!/\{/.test(plan.text), plan.text);
  assert.strictEqual(F.columnTag(v, pos, "label"), null);   // only the first column is the label column
  const lab = F.columnTag(v, v.indexOf("Sword"), "label");
  assert(/\{label\}/.test(lab.text), lab.text);
});
test("an unknown divider tag is a problem; known ones are not", () => {
  assert(has("| A | B |\n| --- | ---{nmu} |\n| 1 | 2 |", /Unknown column tag "nmu"/));
  assert(!has("| A | B |\n| ---{label} | ---:{num} |\n| 1 | 2 |", /Unknown column tag/));
});
console.log(failed ? `${failed} failed, ${passed} passed` : `editor tests OK (${passed})`);
process.exit(failed ? 1 : 0);
