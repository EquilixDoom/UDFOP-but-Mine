#!/usr/bin/env node
/* Stress test for the editor's colored source (web/editor/highlight.js): how long it takes on large and hostile text, and that it keeps one row per line.
   Not part of CI (timings vary by machine).   Usage: node tools/editor_stress.js */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const web = path.join(__dirname, "..", "web");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const host = { esc, splitSection: (s) => [s, ""], frontMatter: (r) => ({ meta: {}, body: r }), pageExists: () => false };
const sb = { console }; sb.window = sb; sb.udfopHost = host; vm.createContext(sb);
for (const f of ["highlight.js", "editor/lint.js", "editor/highlight.js"]) vm.runInContext(fs.readFileSync(path.join(web, f), "utf8"), sb, { filename: f });
const P = sb.udfopEditor;
const rep = (s, n) => new Array(n + 1).join(s);
const LIMIT_MS = 250;   /* one paint on a keystroke should stay well under a frame budget of a few frames */
const cases = [
  ["10,000 plain lines", rep("A plain line of text with a [[link]] and **bold** and `code`.\n", 10000)],
  ["a real page x 200", rep(fs.readFileSync(path.join(web, "guide", "_template.md"), "utf8") + "\n", 200)],
  ["one 200,000-character line", rep("word ", 40000)],
  ["unclosed [[ x 50,000", rep("[[", 50000)],
  ["unclosed ` x 50,000", rep("`", 50000)],
  ["unclosed ** x 50,000", rep("**", 50000)],
  ["unclosed * x 50,000", rep("* ", 50000)],
  ["unclosed >! x 50,000", rep(">!", 50000)],
  ["unclosed { x 50,000", rep("{{", 50000)],
  ["![ ( x 50,000", rep("![](", 50000)],
  ["table of 20,000 pipes", rep("| a ", 20000)],
  ["5,000 fences", rep("```\n", 5000)],
  ["unclosed fence, 20,000 lines", "```lua\n" + rep("x = 1\n", 20000)],
  ["mixed markup soup x 2,000", rep("[[a|b]] `c` **d** *e* >!f!< {{g}} ![h](i) [j](k) | l\n", 2000)],
  ["hostile lines of 1,900 chars x 100: [[", rep(rep("[[", 950) + "\n", 100)],
  ["hostile lines of 1,900 chars x 100: ![](", rep(rep("![](", 475) + "\n", 100)],
  ["hostile lines of 1,900 chars x 100: >!", rep(rep(">!", 950) + "\n", 100)],
  ["hostile lines of 1,900 chars x 100: {{ ` *", rep(rep("{{`* ", 380) + "\n", 100)],
  ["hostile lines of 1,900 chars x 100: table", rep("|" + rep("[[a\\|b]] ", 190) + "\n", 100)],
  ["deep nesting of brackets", rep("[", 30000) + rep("]", 30000)],
  ["CR and tabs", rep("a\r\tb\r\n", 5000)],
  ["emoji and combining marks", rep("\u{1F600}e\u0301 \u200B\u202E", 20000)],
];
for (const f of ["html2md.js", "multi.js", "edits.js"]) vm.runInContext(fs.readFileSync(path.join(web, "editor", f), "utf8"), sb, { filename: "editor/" + f });
const htmlCases = [
  ["html: 20,000 table rows", "<table>" + rep("<tr><td>a</td><td>b</td></tr>", 20000) + "</table>"],
  ["html: 50,000 list items", "<ul>" + rep("<li>item <b>x</b></li>", 50000) + "</ul>"],
  ["html: 100,000 unclosed <b>", rep("<b>x", 100000)],
  ["html: 50,000 nested divs", rep("<div>", 50000) + "x"],
  ["html: 3,000 nested lists", rep("<ul><li>", 3000) + "x"],
  ["html: 100,000 stray <", rep("a < b ", 100000)],
  ["html: 5 MB of text", rep("word ", 1000000)]
];
const M = P.multi, R = (a, h) => ({ a, h: h === undefined ? a : h });
const page = rep("A line of text with some words in it, and a few more.\n", 4000);   /* 220 kB, 4,000 lines */
const everyLine = (n) => { const out = [], starts = M.lineIndex(page); for (let i = 0; i < n; i++) out.push(R(starts[i] + 5)); return out; };
const multiCases = [
  ["multi: type on 4,000 carets", () => M.typed(page, everyLine(4000), "x").text.length],
  ["multi: delete on 4,000 carets", () => M.deleted(page, everyLine(4000), -1).text.length],
  ["multi: move 4,000 carets down", () => M.moveAll(page, everyLine(4000), "down", false, null, P.homeTarget).ranges.length],
  ["multi: a box over 4,000 lines", () => M.boxRanges(page, { line: 0, col: 3 }, { line: 3999, col: 20 }).length],
  ["multi: normalize 20,000 ranges", () => M.normalize(Array.from({ length: 20000 }, (_, i) => R((i * 7919) % 200000, (i * 7919) % 200000 + 3))).length],
  ["multi: upper case on 300 selections", () => M.runCommand(page, everyLine(300).map((r) => R(r.a, r.a + 4)), "edit.case.upper", false).text.length],
  ["multi: indent 300 lines (blocks)", () => M.runCommand(page, everyLine(300).filter((r, i) => i % 2 === 0), "edit.indent.inc", true).text.length],
  ["multi: draw 4,000 carets and 4,000 ranges", () => P.highlight(page, { ranges: everyLine(4000).map((r) => [r.a, r.a + 3]), carets: everyLine(4000).map((r) => r.a + 10) }).length]
];
let slow = 0;
for (const [name, text] of cases) {
  const t0 = process.hrtime.bigint(); let h, err = "";
  try { h = P.highlight(text); } catch (e) { err = String(e).slice(0, 60); }
  const t1 = process.hrtime.bigint(); try { P.lint(text); } catch (e) { err = err || "lint: " + String(e).slice(0, 60); }
  const lintMs = Number(process.hrtime.bigint() - t1) / 1e6;
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const rows = h ? (h.match(/<div class="l">/g) || []).length : 0, want = text.split("\n").length;
  const bad = err || rows !== want || /<script|<img/.test(h);
  const flag = bad ? "FAIL" : ms > LIMIT_MS || lintMs > LIMIT_MS ? "SLOW" : "ok  ";
  if (flag !== "ok  ") slow++;
  console.log(`${flag} ${ms.toFixed(0).padStart(6)} ms colors ${lintMs.toFixed(0).padStart(6)} ms lint  ${(text.length / 1000).toFixed(0).padStart(6)} kB  ${name}${err ? "  " + err : rows !== want ? `  rows ${rows} of ${want}` : ""}`);
}
for (const [name, html] of htmlCases) {
  const t0 = process.hrtime.bigint(); let err = "", n = 0;
  try { n = P.htmlToMarkdown(html).length; } catch (e) { err = String(e).slice(0, 60); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6, flag = err ? "FAIL" : ms > LIMIT_MS ? "SLOW" : "ok  ";
  if (flag !== "ok  ") slow++;
  console.log(`${flag} ${ms.toFixed(0).padStart(6)} ms ${(html.length / 1000).toFixed(0).padStart(6)} kB  ${name}${err ? "  " + err : ""}`);
}
for (const [name, fn] of multiCases) {
  const t0 = process.hrtime.bigint(); let err = "", n = 0;
  try { n = fn(); } catch (e) { err = String(e).slice(0, 60); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6, flag = err ? "FAIL" : ms > LIMIT_MS ? "SLOW" : "ok  ";
  if (flag !== "ok  ") slow++;
  console.log(`${flag} ${ms.toFixed(0).padStart(6)} ms  ${name}${err ? "  " + err : ""}`);
}
console.log(slow ? `${slow} case(s) need attention` : "all within the limit");
process.exit(slow ? 1 : 0);
