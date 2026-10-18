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
console.log(slow ? `${slow} case(s) need attention` : "all within the limit");
process.exit(slow ? 1 : 0);
