#!/usr/bin/env node
// 从 docs/refactor/kb-snapshot_v4.xlsx 生成 KB 数据(2 组 KB.md + INDEX.md)
//
// 用法(蒸馏者更新 xlsx 后跑):
//   node plugins/perf-kp-sql/scripts/_build-kb-from-xlsx.mjs [<xlsx-path>] [<out-dir>]
//
// 默认输入: docs/refactor/kb-snapshot_v4.xlsx
// 默认输出: plugins/perf-kp-sql/data/kb/{cases,best-practice}/{KB.md,INDEX.md}
//
// 设计:
//   cases/KB.md       109 case 完整内容(DF 96 + Flame 13)· 每 case 一个 ## case_id section
//   cases/INDEX.md    案例索引 · 三段(DF 表 + Flame 表)· 列字段对齐设计书 §7+§2.3
//   best-practice/KB.md   93 case 完整内容
//   best-practice/INDEX.md  BP 索引 · 单表
//
// 数据源 xlsx 是 canonical · 不再依赖 distill-v2 cases md。

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(PLUGIN_ROOT, "../..");
const DEFAULT_XLSX = resolve(REPO_ROOT, "../docs/refactor/kb-snapshot_v4.xlsx");
const DEFAULT_OUT = resolve(PLUGIN_ROOT, "data/kb");

const xlsxPath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_XLSX;
const outDir = process.argv[3] ? resolve(process.argv[3]) : DEFAULT_OUT;

if (!existsSync(xlsxPath)) {
  console.error(`xlsx not found: ${xlsxPath}`);
  process.exit(2);
}

console.log(`reading: ${xlsxPath}`);
const wb = xlsx.readFile(xlsxPath);

function sheetRows(sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`sheet not found: ${sheetName}`);
  return xlsx.utils.sheet_to_json(ws, { defval: null, raw: false });
}

const bpRows = sheetRows("best-practice");
const dfRows = sheetRows("diagnostic-flow");
const flameRows = sheetRows("flame-signature");

console.log(`  best-practice: ${bpRows.length} rows`);
console.log(`  diagnostic-flow: ${dfRows.length} rows`);
console.log(`  flame-signature: ${flameRows.length} rows`);

if (bpRows.length !== 93 || dfRows.length !== 96 || flameRows.length !== 13) {
  console.warn(`期望 BP 93 / DF 96 / Flame 13 · 实际 ${bpRows.length}/${dfRows.length}/${flameRows.length}`);
}

// ---------------------------------------------------------------------------
// 渲染 helpers
// ---------------------------------------------------------------------------

const NULL_RE = /^\(NULL[\s)·]/;

function isNull(v) {
  if (v == null) return true;
  if (typeof v !== "string") return false;
  if (v === "" || v === "NULL") return true;
  if (NULL_RE.test(v)) return true;
  return false;
}

function nv(v) {
  // 把 NULL/空 normalize 成 null;否则返回原 string 去前后 whitespace
  if (isNull(v)) return null;
  return String(v).trim();
}

function quoteBlock(text) {
  // 把多行文本变 markdown blockquote(每行前缀 "> ")
  if (text == null) return "";
  return text.split(/\r?\n/).map((l) => `> ${l}`).join("\n");
}

function metaLine(key, value) {
  const v = nv(value);
  if (v == null) return null;
  return `- **${key}**: ${v}`;
}

function quoteSection(heading, value) {
  const v = nv(value);
  if (v == null) return null;
  return `### ${heading}\n\n${quoteBlock(v)}`;
}

// ---------------------------------------------------------------------------
// 渲染单 case
// ---------------------------------------------------------------------------

function renderBpCase(row) {
  const lines = [];
  lines.push(`## case_id: ${row.case_id}`);
  lines.push("");

  // frontmatter-ish meta
  const metas = [
    metaLine("entry_kind", "best-practice"),
    metaLine("db", row.db),
    metaLine("platform", row.platform),
    metaLine("scope", row.scope),
    metaLine("case_pattern", row.case_pattern),
    metaLine("title", row.title),
    metaLine("recommendation_value", row.recommendation_value),
    metaLine("recommendation_layer", row.recommendation_layer),
    metaLine("detection_layer", row.detection_layer),
    metaLine("related_param_names", row.related_param_names),
    metaLine("risk_severity", row.risk_severity),
    metaLine("source_url", row.source_url),
    metaLine("source_authority", row.source_authority),
    metaLine("source_url_lang", row.source_url_lang),
    metaLine("database_version_min", row.database_version_min),
    metaLine("database_version_max", row.database_version_max),
    metaLine("inferred_fields", row.inferred_fields),
  ].filter(Boolean);
  lines.push(...metas);
  lines.push("");

  // quote sections
  const quotes = [
    quoteSection("scenario_description_quote", row.scenario_description_quote),
    quoteSection("recommendation_quote", row.recommendation_quote),
    quoteSection("rationale_quote", row.rationale_quote),
    quoteSection("risk_quote", row.risk_quote),
  ].filter(Boolean);
  for (const q of quotes) {
    lines.push(q);
    lines.push("");
  }
  return lines.join("\n");
}

function renderDfCase(row) {
  const lines = [];
  lines.push(`## case_id: ${row.case_id}`);
  lines.push("");
  const metas = [
    metaLine("entry_kind", "diagnostic-flow"),
    metaLine("db", row.db),
    metaLine("platform", row.platform),
    metaLine("engine", row.engine),
    metaLine("symptom_category", row.symptom_category),
    metaLine("case_pattern", row.case_pattern),
    metaLine("title", row.title),
    metaLine("source_heading", row.source_heading),
    metaLine("diagnostic_steps_count", row.diagnostic_steps_count),
    metaLine("likely_causes_count", row.likely_causes_count),
    metaLine("source_url", row.source_url),
    metaLine("source_authority", row.source_authority),
    metaLine("source_url_lang", row.source_url_lang),
    metaLine("database_version_min", row.database_version_min),
    metaLine("database_version_max", row.database_version_max),
    metaLine("inferred_fields", row.inferred_fields),
  ].filter(Boolean);
  lines.push(...metas);
  lines.push("");

  const symptom = quoteSection("symptom_description", row.symptom_description);
  if (symptom) {
    lines.push(symptom);
    lines.push("");
  }

  // diagnostic_steps / likely_causes 在 xlsx 已是预处理可读 string · 直接整段贴入
  const stepsRaw = nv(row.diagnostic_steps);
  if (stepsRaw) {
    lines.push(`### diagnostic_steps`);
    lines.push("");
    lines.push("```");
    lines.push(stepsRaw);
    lines.push("```");
    lines.push("");
  }

  const causesRaw = nv(row.likely_causes);
  if (causesRaw) {
    lines.push(`### likely_causes`);
    lines.push("");
    lines.push("```");
    lines.push(causesRaw);
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

function renderFlameCase(row) {
  const lines = [];
  lines.push(`## case_id: ${row.case_id}`);
  lines.push("");
  const metas = [
    metaLine("entry_kind", "flame-signature"),
    metaLine("db", row.db),
    metaLine("platform", row.platform),
    metaLine("scope", row.scope),
    metaLine("signature_type", row.signature_type),
    metaLine("match_layer", row.match_layer),
    metaLine("title", row.title),
    metaLine("pattern_regex", row.pattern_regex),
    metaLine("hotness_threshold", row.hotness_threshold),
    metaLine("source_url", row.source_url),
    metaLine("source_authority", row.source_authority),
    metaLine("source_url_lang", row.source_url_lang),
    metaLine("database_version_min", row.database_version_min),
    metaLine("database_version_max", row.database_version_max),
    metaLine("inferred_fields", row.inferred_fields),
  ].filter(Boolean);
  lines.push(...metas);
  lines.push("");

  const quotes = [
    quoteSection("pattern_quote", row.pattern_quote),
    quoteSection("mechanism_quote", row.mechanism_quote),
    quoteSection("workload_implication_quote", row.workload_implication_quote),
  ].filter(Boolean);
  for (const q of quotes) {
    lines.push(q);
    lines.push("");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 拼 KB.md(单文件)+ 同时记录每个 case 的 line 位置
// ---------------------------------------------------------------------------

function buildKb(sections) {
  // sections = [{ heading, cases: [{ caseId, body }] }]
  const out = [];
  for (const sec of sections) {
    out.push(`<!-- ============ ${sec.heading} (${sec.cases.length} cases) ============ -->`);
    out.push("");
    for (const c of sec.cases) {
      out.push(c.body);
      out.push("");
    }
  }
  const md = out.join("\n");
  // post-scan: 行号(1-based)即 `## case_id: <id>` 头出现的行
  const lineMap = new Map();
  const allLines = md.split("\n");
  const re = /^## case_id:\s*(\S+)\s*$/;
  for (let i = 0; i < allLines.length; i++) {
    const m = allLines[i].match(re);
    if (m) lineMap.set(m[1], i + 1);
  }
  return { md, lineMap };
}

// ---------------------------------------------------------------------------
// 索引渲染
// ---------------------------------------------------------------------------

function escapePipe(s) {
  if (s == null) return "";
  return String(s).replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function renderCasesIndex(dfRows, flameRows, lineMap, builtAt) {
  const out = [];
  out.push(`# Cases Index`);
  out.push("");
  out.push(`> 生成时间: ${builtAt}`);
  out.push(`> 数据源: docs/refactor/kb-snapshot_v4.xlsx`);
  out.push(`> 总计: ${dfRows.length + flameRows.length} cases (DF ${dfRows.length} + Flame ${flameRows.length})`);
  out.push(`> 配套: cases/KB.md`);
  out.push("");

  out.push(`## diagnostic-flow (${dfRows.length})`);
  out.push("");
  out.push(`| case_id | symptom_category | title | KB line |`);
  out.push(`|---|---|---|---:|`);
  for (const row of dfRows) {
    const line = lineMap.get(row.case_id);
    out.push(`| ${escapePipe(row.case_id)} | ${escapePipe(row.symptom_category)} | ${escapePipe(row.title)} | ${line ?? "?"} |`);
  }
  out.push("");

  out.push(`## flame-signature (${flameRows.length})`);
  out.push("");
  out.push(`| case_id | title | pattern_regex | KB line |`);
  out.push(`|---|---|---|---:|`);
  for (const row of flameRows) {
    const line = lineMap.get(row.case_id);
    out.push(`| ${escapePipe(row.case_id)} | ${escapePipe(row.title)} | ${escapePipe(row.pattern_regex)} | ${line ?? "?"} |`);
  }
  out.push("");

  return out.join("\n");
}

function renderBpIndex(bpRows, lineMap, builtAt) {
  const out = [];
  out.push(`# Best-Practice Index`);
  out.push("");
  out.push(`> 生成时间: ${builtAt}`);
  out.push(`> 数据源: docs/refactor/kb-snapshot_v4.xlsx`);
  out.push(`> 总计: ${bpRows.length} cases`);
  out.push(`> 配套: best-practice/KB.md`);
  out.push("");

  out.push(`| case_id | scope | title | KB line |`);
  out.push(`|---|---|---|---:|`);
  for (const row of bpRows) {
    const line = lineMap.get(row.case_id);
    out.push(`| ${escapePipe(row.case_id)} | ${escapePipe(row.scope)} | ${escapePipe(row.title)} | ${line ?? "?"} |`);
  }
  out.push("");

  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const builtAt = new Date().toISOString();

// 清旧产物(若存在)
if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}

const casesDir = join(outDir, "cases");
const bpDir = join(outDir, "best-practice");
mkdirSync(casesDir, { recursive: true });
mkdirSync(bpDir, { recursive: true });

// --- cases (DF + Flame) ---
const casesData = buildKb([
  { heading: "Diagnostic-Flow", cases: dfRows.map((r) => ({ caseId: r.case_id, body: renderDfCase(r) })) },
  { heading: "Flame-Signature", cases: flameRows.map((r) => ({ caseId: r.case_id, body: renderFlameCase(r) })) },
]);
writeFileSync(join(casesDir, "KB.md"), casesData.md);
writeFileSync(join(casesDir, "INDEX.md"), renderCasesIndex(dfRows, flameRows, casesData.lineMap, builtAt));

// --- best-practice ---
const bpData = buildKb([
  { heading: "Best-Practice", cases: bpRows.map((r) => ({ caseId: r.case_id, body: renderBpCase(r) })) },
]);
writeFileSync(join(bpDir, "KB.md"), bpData.md);
writeFileSync(join(bpDir, "INDEX.md"), renderBpIndex(bpRows, bpData.lineMap, builtAt));

// --- summary ---
function fileSize(p) {
  return readFileSync(p).length;
}
function approxTokens(p) {
  // 粗估 · 中文字符 / 1.5 + 英文 / 4 大致接近 · 简化用字符数 / 2.5 当 token 估
  return Math.round(fileSize(p) / 2.5);
}

const out = [
  ["", "size", "approx tokens"],
  ["cases/KB.md", fileSize(join(casesDir, "KB.md")), "—"],
  ["cases/INDEX.md", fileSize(join(casesDir, "INDEX.md")), approxTokens(join(casesDir, "INDEX.md"))],
  ["best-practice/KB.md", fileSize(join(bpDir, "KB.md")), "—"],
  ["best-practice/INDEX.md", fileSize(join(bpDir, "INDEX.md")), approxTokens(join(bpDir, "INDEX.md"))],
];
console.log(`\n=== build summary (${builtAt}) ===`);
for (const r of out) console.log(`  ${r[0].padEnd(28)} ${String(r[1]).padStart(10)} bytes  ${r[2]} tokens`);
