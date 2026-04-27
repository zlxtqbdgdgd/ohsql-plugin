#!/usr/bin/env node
// 修复 LLM Write 时把 \n / \" 当字面串写入的 bug。
// 用法:node scripts/unescape-reports.mjs <file> [<file>...]
// 检测标准:整个文件真换行 < 5 · 字面 \n >= 20 · 判定为"被转义"· 执行还原。

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: unescape-reports.mjs <file> [<file>...]");
  process.exit(1);
}

let fixed = 0;
for (const f of files) {
  if (!existsSync(f)) { console.error(`skip (not found): ${f}`); continue; }
  const before = readFileSync(f, "utf8");
  const realNL = (before.match(/\n/g) ?? []).length;
  const escNL = (before.match(/\\n/g) ?? []).length;
  // 真换行 >= 5 判定已正常;否则只要文件里有 \n 字面就还原(HTML 可能内联 CSS · \n 少)
  if (realNL >= 5) {
    console.log(`ok · ${f} · real=${realNL} esc=${escNL}`);
    continue;
  }
  if (escNL === 0) {
    console.log(`skip (no escapes) · ${f}`);
    continue;
  }
  const after = before
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\`/g, "`")
    .replace(/\\\\/g, "\\");
  writeFileSync(f, after);
  console.log(`fixed · ${f} · ${escNL} \\n 还原为真换行`);
  fixed++;
}
console.log(`\ndone · ${fixed}/${files.length} fixed`);
