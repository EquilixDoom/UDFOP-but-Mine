#!/usr/bin/env node
/* Tests for the guide editor's pure parts (web/editor/lint.js): the Problems checks and the first-placeholder finder.
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
host.pageList = (site) => (site ? [] : [{ title: "How things work", category: "Player Guide" }]);
host.topicExists = (low) => low === "combat";
host.patchExists = (v) => v === "0.1.2";
const sources = { "how things work": "---\ntitle: How things work\n---\n# Top\n## Real section\n```\n## In code\n```\n" };
host.pageSource = (key, site) => (site ? "" : key in sources ? sources[key] : "");
const files = { "images/ok.png": true, "images/none.png": false };
host.fileExists = (p) => (p in files ? files[p] : null);
const sandbox = { window: null, console };
sandbox.window = sandbox; sandbox.udfopHost = host;
vm.createContext(sandbox);
for (const f of ["highlight.js", "editor/lint.js"]) vm.runInContext(fs.readFileSync(path.join(web, f), "utf8"), sandbox, { filename: f });
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



console.log(failed ? `${failed} failed, ${passed} passed` : `editor tests OK (${passed})`);
process.exit(failed ? 1 : 0);
