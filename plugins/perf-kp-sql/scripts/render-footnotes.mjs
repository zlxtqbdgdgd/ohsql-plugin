#!/usr/bin/env node
// render-footnotes.mjs
// Post-process .md and .html report: scan [参考N] markers in Top Issues + parse
// 参考资料汇总 table, inject:
//   .md:  "## 参考" section with [参考N] <url> lines
//   .html: <ol class="footnotes"> section + wrap inline [参考N] as <sup>
//
// Makes zero-hallucination footnote resilient to LLM output token truncation.
//
// Usage:
//   node scripts/render-footnotes.mjs <path> [<path>...]

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: render-footnotes.mjs <md-or-html-path> [...]");
  process.exit(1);
}

/** 从 markdown 或 HTML 文本里抽出参考资料汇总表的 5 列行(数组 of {tier, title, used_by, url}) */
function parseEvidenceRows(content, isHtml) {
  if (isHtml) {
    // <tr><td>鲲鹏原厂</td><td>...</td><td>...</td><td><a href="...">url</a></td></tr>
    const rows = [];
    const re = /<tr>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>(?:<a[^>]*>)?([^<]*)(?:<\/a>)?<\/td>\s*<\/tr>/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      rows.push({ tier: m[1].trim(), title: m[2].trim(), used_by: m[3].trim(), url: m[4].trim() });
    }
    return rows;
  }
  // markdown: 行以 | 开头 · 4 列(权威等级|来源|被引规则|URL)
  const tableMatch = content.match(/## 参考资料汇总[\s\S]*?\n((?:\|.*\|\n)+)/);
  if (!tableMatch) return [];
  return tableMatch[1].split("\n")
    .filter(l => l.trim().startsWith("|") && !l.includes("---") && !/\|\s*权威等级\s*\|/.test(l))
    .map(l => {
      const cells = l.split("|").map(c => c.trim()).filter(Boolean);
      return { tier: cells[0] ?? "", title: cells[1] ?? "", used_by: cells[2] ?? "", url: (cells[3] ?? "").replace(/^\[|\]\(.*?\)$/g, "") };
    })
    .filter(r => r.url);
}

/** 收集文本中所有 [参考N] 角标,返回 Set of N */
function collectUsed(content) {
  const used = new Set();
  for (const m of content.matchAll(/\[参考(\d+)\]/g)) {
    used.add(Number(m[1]));
  }
  return used;
}

/** 处理 .md 文件:追加 ## 参考 段 */
function processMd(path) {
  const content = readFileSync(path, "utf8");
  if (/\n## 参考\s*\n/.test(content)) {
    console.log(`skip (md already has 参考 section): ${path}`);
    return;
  }
  const used = collectUsed(content);
  if (used.size === 0) { console.log(`skip (md no [参考N] markers): ${path}`); return; }
  const rows = parseEvidenceRows(content, false);
  if (rows.length === 0) { console.log(`skip (md no evidence table): ${path}`); return; }

  const lines = [];
  for (let i = 0; i < rows.length; i++) {
    const n = i + 1;
    if (!used.has(n)) continue;
    const r = rows[i];
    // v0.4.2 · 只保留 [参考N] URL · 去掉 [tier] 标签 + title
    lines.push(`[参考${n}] ${r.url}`);
  }
  if (lines.length === 0) {
    console.log(`skip (md used markers ${[...used].join(",")} dont overlap 1-${rows.length}): ${path}`);
    return;
  }

  const section = ["", "## 参考", "", ...lines, ""].join("\n");
  const changelogIdx = content.indexOf("## Report Changelog");
  const newContent = changelogIdx >= 0
    ? content.slice(0, changelogIdx) + section + "\n" + content.slice(changelogIdx)
    : content.trimEnd() + "\n" + section;
  writeFileSync(path, newContent);
  console.log(`✓ md · injected ${lines.length} footnote(s): ${path}`);
}

/** 处理 .html 文件:
 *  1. 把 inline [参考N] 换成 <sup class="fn-ref"><a href="#fn-N">N</a></sup>
 *  2. 填充 {{footnotes_list_html}} 占位(或 <ol class="footnotes"> 空段)
 */
function processHtml(path) {
  let content = readFileSync(path, "utf8");
  const used = collectUsed(content);
  if (used.size === 0) { console.log(`skip (html no [参考N] markers): ${path}`); return; }
  const rows = parseEvidenceRows(content, true);
  if (rows.length === 0) { console.log(`skip (html no evidence table): ${path}`); return; }

  // 1. [参考N] → <sup class="fn-ref"><a href="#fn-N">N</a></sup>
  content = content.replace(/\[参考(\d+)\]/g, (_, n) => `<sup class="fn-ref"><a href="#fn-${n}">${n}</a></sup>`);

  // 2. 构建脚注 <li>
  const footLis = [];
  for (let i = 0; i < rows.length; i++) {
    const n = i + 1;
    if (!used.has(n)) continue;
    const r = rows[i];
    // v0.4.2 · 只保留 [参考N] URL · 去 tier label + title
    footLis.push(`  <li id="fn-${n}"><a href="${r.url}" target="_blank">${r.url}</a></li>`);
  }
  const footList = footLis.join("\n");

  // 3. 填充 {{footnotes_list_html}} 或插入 </body> 之前
  if (content.includes("{{footnotes_list_html}}")) {
    content = content.replace("{{footnotes_list_html}}", footList);
  } else if (content.includes("<ol class=\"footnotes\">")) {
    // 已有空 <ol>  · 填内容
    content = content.replace(/<ol class="footnotes">[\s\S]*?<\/ol>/, `<ol class="footnotes">\n${footList}\n</ol>`);
  } else {
    // 无锚点 · 在 </body> 前追加整段
    const section = `\n<h2>参考</h2>\n<ol class="footnotes">\n${footList}\n</ol>\n`;
    content = content.replace("</body>", `${section}</body>`);
  }

  writeFileSync(path, content);
  console.log(`✓ html · injected ${footLis.length} footnote(s) + wrapped inline refs: ${path}`);
}

for (const path of args) {
  if (!existsSync(path)) { console.error(`skip (not found): ${path}`); continue; }
  if (path.endsWith(".html") || path.endsWith(".htm")) {
    processHtml(path);
  } else {
    processMd(path);
  }
}
