#!/usr/bin/env node
// 真测 4 个深度 metric · 扫历史 perf-kp-sql 报告 · 替代 depth-control.md 里的 LLM 估值
//
// 4 metric:
// 1. citation_density: 每个原子事实(主表 cell 内 <br> 切的 sub-line)带 [参考N] 角标的比例
// 2. mechanism_depth: 主表"判定依据"列每行能否切出"现场值/阈值/比较结论"3 原子(≥ 3 <br> + ≥ 1 [OBS] + ≥ 1 [CASE]/[KB]/[NLM])
// 3. multi_source_rate: 主表行有 案例 + NLM 双 [参考N] 的比例(≥ 2 [参考N])
// 4. action_verifiability: "建议措施"列含验证命令的比例(含 `验证:` / `verify:` 关键字 + 后跟 backtick code)

import { readdirSync, readFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { homedir } from "node:os";

const REPORTS_DIR = resolve(homedir(), ".perf-kp-sql/reports");

// ---- 找历史报告 ----
const allFiles = readdirSync(REPORTS_DIR).filter((f) => f.endsWith(".md") && !f.endsWith("-chat.md"));
console.log(`[scan] 找到 ${allFiles.length} 份 .md 报告\n`);

// ---- 4 个 metric 的提取器 ----

function extractTopIssuesTable(md) {
  // 找 "## 诊断结果" 段下的 markdown 表
  const m = md.match(/## 诊断结果[\s\S]*?\n\| ([^\n]+) \|\n\|[-: |]+\|\n([\s\S]*?)(?=\n##|\n---|$)/);
  if (!m) return { headers: [], rows: [] };
  const headers = m[1].split("|").map((s) => s.trim());
  const rowsRaw = m[2].trim().split("\n").filter((l) => l.startsWith("|"));
  const rows = rowsRaw.map((l) => l.split("|").slice(1, -1).map((s) => s.trim()));
  return { headers, rows };
}

function metricCitationDensity(rows) {
  // 每个原子事实(<br> 切的 sub-line)是否带 [参考N]
  let totalAtoms = 0;
  let cited = 0;
  for (const row of rows) {
    for (const cell of row) {
      const subLines = cell.split(/<br\s*\/?\s*>/i).map((s) => s.trim()).filter(Boolean);
      for (const sub of subLines) {
        if (!sub) continue;
        // 带 [IDX]/[CASE]/[KB]/[NLM]/[OBS]/[LLM] 5 标签的算"原子事实"
        if (/\[(IDX|CASE|KB|NLM|OBS|LLM)\]/.test(sub)) {
          totalAtoms++;
          if (/\[参考\d+\]/.test(sub)) cited++;
        }
      }
    }
  }
  return totalAtoms > 0 ? cited / totalAtoms : 0;
}

function metricMechanismDepth(rows, headers) {
  // 主表"判定依据"列每行能否切出 ≥ 3 <br> + ≥ 1 [OBS] + ≥ 1 [CASE]/[KB]/[NLM]
  const ruleColIdx = headers.findIndex((h) => /判定依据|证据/.test(h));
  if (ruleColIdx < 0) return null;
  let total = 0;
  let pass = 0;
  for (const row of rows) {
    const cell = row[ruleColIdx] || "";
    if (!cell.trim()) continue;
    total++;
    const subLines = cell.split(/<br\s*\/?\s*>/i).map((s) => s.trim()).filter(Boolean);
    const hasOBS = subLines.some((s) => /\[OBS\]/.test(s));
    const hasKBOrNLM = subLines.some((s) => /\[(CASE|KB|NLM)\]/.test(s));
    if (subLines.length >= 3 && hasOBS && hasKBOrNLM) pass++;
  }
  return total > 0 ? pass / total : 0;
}

function metricMultiSourceRate(rows, headers) {
  // 主表行的 "参考来源" 列里有 ≥ 2 [参考N]
  const refColIdx = headers.findIndex((h) => /参考|来源/.test(h));
  if (refColIdx < 0) {
    // 如果没单独"参考来源"列 · 看每行所有 cell 总共有多少个 [参考N]
    let total = 0;
    let pass = 0;
    for (const row of rows) {
      total++;
      const allText = row.join(" ");
      const refs = (allText.match(/\[参考\d+\]/g) || []);
      const uniqRefs = new Set(refs);
      if (uniqRefs.size >= 2) pass++;
    }
    return total > 0 ? pass / total : 0;
  }
  let total = 0;
  let pass = 0;
  for (const row of rows) {
    total++;
    const cell = row[refColIdx] || "";
    const refs = cell.match(/\[参考\d+\]/g) || [];
    const uniqRefs = new Set(refs);
    if (uniqRefs.size >= 2) pass++;
  }
  return total > 0 ? pass / total : 0;
}

function metricActionVerifiability(rows, headers) {
  // "建议措施"列含 验证命令(`验证:`/`verify:` + 后跟 backtick code)
  const actionColIdx = headers.findIndex((h) => /建议|措施|action/i.test(h));
  if (actionColIdx < 0) return null;
  let total = 0;
  let pass = 0;
  for (const row of rows) {
    const cell = row[actionColIdx] || "";
    if (!cell.trim()) continue;
    total++;
    if (/(验证|verify)[: :]\s*`[^`]+`/i.test(cell)) pass++;
  }
  return total > 0 ? pass / total : 0;
}

// ---- 跑全部报告 ----

const results = [];
for (const f of allFiles) {
  const md = readFileSync(resolve(REPORTS_DIR, f), "utf8");
  const { headers, rows } = extractTopIssuesTable(md);
  if (rows.length === 0) {
    console.log(`[skip] ${f} · 没找到诊断结果表`);
    continue;
  }
  const r = {
    file: f,
    rows: rows.length,
    citation_density: metricCitationDensity(rows),
    mechanism_depth: metricMechanismDepth(rows, headers),
    multi_source_rate: metricMultiSourceRate(rows, headers),
    action_verifiability: metricActionVerifiability(rows, headers),
  };
  results.push(r);
  console.log(`[ok] ${f} · ${rows.length} 行 · CD=${(r.citation_density * 100).toFixed(1)}% MD=${r.mechanism_depth != null ? (r.mechanism_depth * 100).toFixed(1) + "%" : "n/a"} MS=${(r.multi_source_rate * 100).toFixed(1)}% AV=${r.action_verifiability != null ? (r.action_verifiability * 100).toFixed(1) + "%" : "n/a"}`);
}

console.log(`\n[summary] ${results.length} 份报告`);

// ---- 算平均 ----

function avg(arr) {
  const valid = arr.filter((v) => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

const avgCD = avg(results.map((r) => r.citation_density));
const avgMD = avg(results.map((r) => r.mechanism_depth));
const avgMS = avg(results.map((r) => r.multi_source_rate));
const avgAV = avg(results.map((r) => r.action_verifiability));

console.log(`\n=== 4 metric 平均值(基于 ${results.length} 份历史报告) ===`);
console.log(`citation_density:     ${(avgCD * 100).toFixed(1)}% · 目标 ≥ 95%`);
console.log(`mechanism_depth:      ${avgMD != null ? (avgMD * 100).toFixed(1) + "%" : "n/a"} · 目标 ≥ 90%`);
console.log(`multi_source_rate:    ${(avgMS * 100).toFixed(1)}% · 目标 ≥ 70%`);
console.log(`action_verifiability: ${avgAV != null ? (avgAV * 100).toFixed(1) + "%" : "n/a"} · 目标 ≥ 80%`);

// ---- 写报告 ----

const reportPath = resolve(import.meta.dirname || ".", "../data/quality-reports/depth-metrics-measured.json");
const report = {
  generated_at: new Date().toISOString(),
  scanned_reports: results.length,
  reports_dir: "~/.perf-kp-sql/reports",
  metrics: {
    citation_density: { measured: avgCD, target: 0.95, llm_estimate_v1: 0.60 },
    mechanism_depth: { measured: avgMD, target: 0.90, llm_estimate_v1: 0.50 },
    multi_source_rate: { measured: avgMS, target: 0.70, llm_estimate_v1: 0.30 },
    action_verifiability: { measured: avgAV, target: 0.80, llm_estimate_v1: 0.40 },
  },
  per_report: results,
};

import("node:fs").then((fs) => {
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`\n[report] ${reportPath}`);
});
