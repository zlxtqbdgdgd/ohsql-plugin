#!/usr/bin/env node
// render-screen-footer.mjs
//
// 一次性生成 perf-kp-sql Step 4.3 屏幕 footer 文本 · 让 LLM echo · **不让 LLM
// 自己重画表**。专治"[参考N] 角标在屏幕表里反复掉" 的故障类(2026-04-25 用户反馈)
// —— 第一次跑 LLM 加了 [参考N] · 第二次跑就忘 · prompt 怎么写都治不住模型行为偏方差。
//
// 解决:由本脚本读 diagnose.json + 重用 render-report.mjs 的 md 渲染逻辑 ·
// 抽取 "需要调优" / "关键指标" / "参考" 三段(已带 [参考N] 角标)· 拼成屏幕版
// footer · stdout 直接输出 · LLM 只需要 echo 就好 · 不再有 N 次复述误差。
//
// Usage:
//   node render-screen-footer.mjs --from-diagnose <diagnose-json> \
//                                  --report-path <html-path> \
//                                  [--flame <flame-svg-path>] \
//                                  [--first-step <text>]
//   cat diagnose.json | node render-screen-footer.mjs --report-path <path>

import { readFileSync } from "node:fs";
import { renderReportFromDiagnoseJson } from "./render-report.mjs";

const args = process.argv.slice(2);

function getFlag(name) {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}

const diagnoseFile = getFlag("--from-diagnose");
const reportPath = getFlag("--report-path") ?? "<report-path>";
const flameJsonPath = getFlag("--from-flame-json");
const firstStepOverride = getFlag("--first-step");

const diagnoseJson = diagnoseFile
  ? readFileSync(diagnoseFile, "utf8")
  : readFileSync(0, "utf8");

const md = renderReportFromDiagnoseJson(diagnoseJson);

// ---------------------------------------------------------------------------
// 抽取 md 里的关键段 · 都是渲好的 markdown 块 · [参考N] 已经在里面了
// ---------------------------------------------------------------------------

function extractSection(mdText, headingMatcher) {
  // 切成 "## " 开头的块 · 找首行(= 标题)匹配 headingMatcher 的那块
  const blocks = mdText.split(/^## /m).slice(1);
  for (const block of blocks) {
    const nl = block.indexOf("\n");
    const firstLine = (nl >= 0 ? block.slice(0, nl) : block).trim();
    if (headingMatcher(firstLine)) {
      return nl >= 0 ? block.slice(nl + 1).trim() : "";
    }
  }
  return "";
}

const sectionTopIssues = extractSection(md, (h) => h === "需要调优");
const sectionHealthy = extractSection(md, (h) => h === "关键指标" || h === "已通过" || h === "健康指标");
let sectionRefs = extractSection(md, (h) => h === "参考" || h.startsWith("参考资料"));

// diagnose.mjs 的 stdout 是 summary 摘要 · 完整数据在文件里;file 顶层有 report_input
// 字段 · 包含 top_issues / by_module / evidence_trail。这里 parse 一次拿到 ri 复用。
function reportInputOf(diagJson) {
  try {
    const j = JSON.parse(diagJson);
    return j.report_input ?? {};
  } catch {
    return {};
  }
}
const ri = reportInputOf(diagnoseJson);

// 从 md 抽 "建议第一步" —— 取首条 top issue 的 recommendations[0].action + [参考N]
function firstStepLine() {
  const top = (ri.top_issues ?? [])[0];
  if (!top) return "—";
  const action = top.recommendations?.[0]?.action ?? top.summary ?? top.title ?? "—";
  const fn = (top.footnote_refs ?? [])[0];
  return fn ? `${action}[参考${fn}]` : action;
}
const firstStep = firstStepOverride ?? firstStepLine();

// 诊断结果矩阵 · 用 report_input.by_module + summary
function diagnoseMatrix() {
  const s = ri.summary ?? {};
  const byMod = ri.by_module ?? {};
  const rows = [];
  rows.push("| 模块  | 严重 | 告警 | 通过 | 总数 |");
  rows.push("|-------|------|------|------|------|");
  const order = ["os", "硬件", "mongo", "mysql", "redis", "其他"];
  for (const k of order) {
    const m = byMod[k];
    if (!m) continue;
    const c = m.critical ?? 0, w = m.warning ?? 0, ok = m.ok ?? 0;
    const all = c + w + ok;
    if (all === 0) continue;
    const padK = k + " ".repeat(Math.max(0, 5 - [...k].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x7f ? 2 : 1), 0)));
    rows.push(`| ${padK} | ${c} | ${w} | ${ok} | ${all} |`);
  }
  const total = s.total ?? 0;
  const crit = s.critical ?? 0;
  const warn = s.warning ?? 0;
  const ok = (s.info ?? 0) + (s.ok ?? 0);
  rows.push(`| 总计  | ${crit} | ${warn} | ${ok} | ${total} |`);
  return rows.join("\n");
}
const matrix = diagnoseMatrix();

// ---------------------------------------------------------------------------
// 提取火焰图 terminalReport 和参考文献，进行合并重排编号
// ---------------------------------------------------------------------------

let flameText = "";
if (flameJsonPath) {
  try {
    const flameJsonRaw = readFileSync(flameJsonPath, "utf8");
    const flameJson = JSON.parse(flameJsonRaw);
    if (flameJson.terminalReport) {
      flameText = flameJson.terminalReport;
      
      // 提取火焰图内的参考来源
      const refHeader = "\n  ─ 参考来源 ─\n";
      const refIdx = flameText.indexOf(refHeader);
      if (refIdx >= 0) {
        const refsPart = flameText.slice(refIdx + refHeader.length);
        flameText = flameText.slice(0, refIdx).trimRight();
        
        const flameRefs = [];
        for (const line of refsPart.split("\n")) {
          const m = line.match(/^\s*\[参考(\d+)\]\s+(.+)$/);
          if (m) flameRefs.push({ oldIdx: m[1], url: m[2].trim() });
        }
        
        // 找出 sectionRefs 中当前最大的参考编号
        let maxRef = 0;
        const refMatchRe = /\[参考(\d+)\]/g;
        let match;
        while ((match = refMatchRe.exec(sectionRefs)) !== null) {
          maxRef = Math.max(maxRef, parseInt(match[1], 10));
        }
        
        // 追加火焰图参考并替换原有标记 [F<n>] 为 [参考<n>]
        for (const ref of flameRefs) {
          maxRef++;
          sectionRefs += `\n[参考${maxRef}] ${ref.url}`;
          flameText = flameText.replace(new RegExp(`\\\[F${ref.oldIdx}\\\]`, "g"), `[参考${maxRef}]`);
        }
      }
    }
  } catch(e) {}
}

// ---------------------------------------------------------------------------
// 拼屏幕 footer · markdown pipe 表(终端肉眼读)+ 行式 KV
// ---------------------------------------------------------------------------

const out = [];
out.push("## 诊断结果\n");
out.push(matrix);
out.push("");

if (sectionTopIssues) {
  out.push("## 需要调优\n");
  out.push(sectionTopIssues);
  out.push("");
}

if (sectionHealthy) {
  out.push("## 关键指标\n");
  out.push(sectionHealthy);
  out.push("");
}
if (flameText) {
  out.push(flameText);
  out.push("");
}

out.push(`建议第一步  ${firstStep}`);
out.push(`报告        ${reportPath}`);
out.push("");

if (sectionRefs) {
  out.push("## 参考\n");
  out.push(sectionRefs);
  out.push("");
}

process.stdout.write(out.join("\n"));
