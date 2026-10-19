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
for (const f of ["highlight.js", "editor/lint.js", "editor/highlight.js", "editor/html2md.js", "editor/multi.js", "editor/edits.js", "editor/search.js"]) vm.runInContext(fs.readFileSync(path.join(web, f), "utf8"), sandbox, { filename: f });
const P = sandbox.udfopEditor;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; } catch (e) { failed++; console.log("FAIL " + name + "\n  " + (e.message || e).split("\n")[0]); } }
const msgs = (text) => P.lint(text).map((p) => p.msg);
const has = (text, re) => msgs(text).some((m) => re.test(m));
const GOOD = "---\ntitle: T\ncategory: C\nsummary: S\n---\n\nBody\n";

test("a good page has no problems", () => assert.strictEqual(P.lint(GOOD).length, 0));
test("missing front matter reports title and summary", () => { assert(has("Just text", /No title/)); assert(has("Just text", /No summary/)); });
test("unclosed front matter", () => assert(has("---\ntitle: T\n\nBody", /front matter/i)));
test("unknown code language", () => assert(has(GOOD + "\n```zzzz\nx\n```\n", /zzzz/)));
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
test("a problem points at its line", () => assert.strictEqual(P.lint(GOOD + "\n[[Nope]]\n")[0].line, 9));
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

console.log(failed ? `${failed} failed, ${passed} passed` : `editor tests OK (${passed})`);
process.exit(failed ? 1 : 0);
