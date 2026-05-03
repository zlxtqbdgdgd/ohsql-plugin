#!/usr/bin/env node
// analyze-nlm-distribution.mjs
//
// 读 data/notebooklm-urls.json · 输出 markdown 报告 ·
// 写到 data/quality-reports/nlm-url-distribution-report.md
//
// 报告内容:
//  - 表 1:每个 notebook 维度统计(notebook_id · domain · 语言 · URL 数)
//  - 表 2:跨 notebook 的域名分布(域名 · 总 URL 数 · 出现的 notebook 列表)
//  - 表 3:重复 URL 检测(同一 URL 出现 ≥ 2 次)
//  - 表 4:跨 notebook 重叠(notebook 之间共享 URL 数)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "..");
const DATA_DIR = resolve(PLUGIN_ROOT, "data");
const NLM_URLS_PATH = resolve(DATA_DIR, "notebooklm-urls.json");
const REPORT_DIR = resolve(DATA_DIR, "quality-reports");
const REPORT_PATH = resolve(REPORT_DIR, "nlm-url-distribution-report.md");

const raw = JSON.parse(readFileSync(NLM_URLS_PATH, "utf8"));
const notebooks = raw.domains || [];

function getDomain(u) {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return "(invalid-url)";
  }
}

// ---- 整理 ----
// per-notebook url list
const nbUrls = new Map(); // notebook_id → Set<url>
const urlOccurs = new Map(); // url → [{ notebook_id, title }]
const domainCount = new Map(); // domain → { count, notebooks: Set }
let totalUrls = 0;
for (const nb of notebooks) {
  const id = nb.notebook_name;
  const set = new Set();
  for (const u of nb.urls || []) {
    totalUrls++;
    set.add(u.url);
    if (!urlOccurs.has(u.url)) urlOccurs.set(u.url, []);
    urlOccurs.get(u.url).push({ notebook_id: id, title: u.title });
    const d = getDomain(u.url);
    if (!domainCount.has(d)) domainCount.set(d, { count: 0, notebooks: new Set() });
    domainCount.get(d).count++;
    domainCount.get(d).notebooks.add(id);
  }
  nbUrls.set(id, set);
}

// ---- 表 1 ----
const t1 = [
  "| notebook_id | domain | language | URL 总数 | 唯一 URL 数 |",
  "|---|---|---|---|---|",
];
for (const nb of notebooks) {
  const id = nb.notebook_name;
  const urls = nb.urls || [];
  const uniq = new Set(urls.map((u) => u.url)).size;
  t1.push(`| ${id} | ${nb.domain} | ${nb.language || "-"} | ${urls.length} | ${uniq} |`);
}
t1.push(`| **TOTAL** | - | - | **${totalUrls}** | **${urlOccurs.size}** |`);

// ---- 表 2 ----
const t2 = [
  "| 域名 | 总 URL 数 | 出现的 notebook |",
  "|---|---|---|",
];
const domainsSorted = [...domainCount.entries()].sort((a, b) => b[1].count - a[1].count);
for (const [d, info] of domainsSorted) {
  t2.push(`| ${d} | ${info.count} | ${[...info.notebooks].join(", ")} |`);
}

// ---- 表 3 重复 URL ----
const dupes = [...urlOccurs.entries()].filter(([, list]) => list.length >= 2);
const t3 = [
  "| URL | 出现次数 | 出现的 notebook | title 列表 |",
  "|---|---|---|---|",
];
for (const [url, list] of dupes.sort((a, b) => b[1].length - a[1].length)) {
  const nbs = [...new Set(list.map((x) => x.notebook_id))].join(", ");
  const titles = [...new Set(list.map((x) => x.title))].join(" / ");
  t3.push(`| ${url} | ${list.length} | ${nbs} | ${titles} |`);
}
if (dupes.length === 0) t3.push("| (无重复 URL) | - | - | - |");

// ---- 表 4 跨 notebook 重叠 ----
const ids = [...nbUrls.keys()];
const t4 = [
  "| notebook A | notebook B | 共享 URL 数 | 共享 URL 列表 |",
  "|---|---|---|---|",
];
let anyOverlap = false;
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j];
    const sa = nbUrls.get(a), sb = nbUrls.get(b);
    const shared = [...sa].filter((u) => sb.has(u));
    if (shared.length === 0) continue;
    anyOverlap = true;
    const list = shared.length <= 3 ? shared.join(", ") : `${shared.slice(0, 3).join(", ")} ...`;
    t4.push(`| ${a} | ${b} | ${shared.length} | ${list} |`);
  }
}
if (!anyOverlap) t4.push("| (notebook 间无 URL 重叠) | - | - | - |");

// ---- summary ----
const md = `# NotebookLM URL 分布与去重报告

- 生成时间: ${new Date().toISOString()}
- 数据源: \`data/notebooklm-urls.json\`
- notebook 数: ${notebooks.length}
- URL 引用总数(含重复): ${totalUrls}
- 唯一 URL 数: ${urlOccurs.size}
- 跨 notebook 出现的 URL 数: ${[...urlOccurs.values()].filter((l) => new Set(l.map((x) => x.notebook_id)).size >= 2).length}
- 域名数: ${domainCount.size}

## 表 1 · notebook 维度统计

${t1.join("\n")}

## 表 2 · 跨 notebook 域名分布(按 URL 数降序)

${t2.join("\n")}

## 表 3 · 重复 URL(同一 URL 出现 ≥ 2 次)

${t3.join("\n")}

## 表 4 · 跨 notebook 重叠(notebook 之间共享 URL)

${t4.join("\n")}
`;

if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(REPORT_PATH, md, "utf8");
console.error(`[analyze-nlm-distribution] notebooks=${notebooks.length} · 唯一 URL=${urlOccurs.size} · 重复 URL=${dupes.length}`);
console.error(`[analyze-nlm-distribution] report → ${REPORT_PATH}`);
