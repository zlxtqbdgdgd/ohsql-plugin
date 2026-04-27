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
// v0.22.0 · 双输出格式:
//   - markdown(默认 · CC / OH-SQL): MD pipe table + flame 包 fenced code block
//   - box(Codex CLI 等不渲染 MD 的 harness): 全部 box-drawing(╭─┬─╮ / │ / ─)
//   harness 探测优先级:
//     1. --format markdown|box 显式指定
//     2. PERF_KP_SQL_FORMAT 环境变量
//     3. 探测 $CODEX_PLUGIN_ROOT(set → box)
//     4. fallback markdown
//
// Usage:
//   node render-screen-footer.mjs --from-diagnose <diagnose-json> \
//                                  --report-path <html-path> \
//                                  [--from-flame-json <flame-json-path>] \
//                                  [--first-step <text>] \
//                                  [--format markdown|box|auto]
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
const formatFlag = getFlag("--format") ?? "auto";

function detectFormat() {
  if (formatFlag === "markdown" || formatFlag === "box") return formatFlag;
  const envOverride = process.env.PERF_KP_SQL_FORMAT;
  if (envOverride === "markdown" || envOverride === "box") return envOverride;
  // Codex CLI 不渲染 markdown · 给 box-drawing 视觉对齐效果更好
  if (process.env.CODEX_PLUGIN_ROOT) return "box";
  // CC / OH-SQL 都渲染 markdown · 默认 markdown
  return "markdown";
}
const format = detectFormat();

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

// v1.0 红线收紧:取首条有 KB recommendations 的 top issue · 跳过 KB 缺 fact 的规则
// 报告里宁可"未抽到字面"也不展示无角注的 action(避免 [参考N] 跟 action 不对应)
//
// 角注编号必须用 footer 自己渲染的 [参考N] 编号空间(不是 buildReportInput 的 evidence_trail
// 全局编号)· 解析 sectionRefs 里的 url → footer 编号映射后用 fix_url 反查。
function buildFooterRefMap() {
  const map = new Map();
  for (const line of (sectionRefs || "").split("\n")) {
    const m = line.match(/^\s*\[参考(\d+)\]\s+(\S+)/);
    if (m) map.set(m[2].trim(), Number(m[1]));
  }
  return map;
}
// v0.24.0 · 军规 3+4 守门: 对齐 render-report.mjs 的 quoteSupportsText
// 分级 hard token: ≥3 位数字 / 下划线参数名 / 长 ASCII 词 ≥7 字 · 都 miss → 拒贴
function quoteHasText(text, url, top) {
  if (!text || !url) return false;
  const lower = String(text).toLowerCase();
  const numHard = (lower.match(/\b\d{3,}\b/g) || []);
  const paramHard = (lower.match(/[a-z][a-z0-9]*_[a-z0-9_]+/g) || []);
  const longHard = (lower.match(/[a-z]{7,}/g) || []);
  const hard = [...new Set([...numHard, ...paramHard, ...longHard])];
  if (hard.length === 0) return true;
  const cite = (top?.citations ?? []).filter(c => c.url === url);
  const ev = (ri?.evidence_trail ?? []).filter(e => e.url === url);
  const corpus = [...cite.map(c => c.anchor || c.title || ""), ...ev.map(e => e.quote || e.anchor || "")].join(" ").toLowerCase();
  return hard.some(t => corpus.includes(t));
}
function firstStepLine() {
  const refMap = buildFooterRefMap();
  for (const top of (ri.top_issues ?? [])) {
    const rec = top.recommendations?.[0];
    if (!rec || !rec.action) continue;
    const action = rec.action;
    const url = rec.fix_url ?? top.citations?.[0]?.url;
    const fn = url ? refMap.get(url) : null;
    if (fn && !quoteHasText(action, url, top)) return action;  // URL 不支持该 action · 不挂角标
    return fn ? `${action}[参考${fn}]` : action;
  }
  return "—";
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
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// box-drawing 表格转换工具(用于 box mode)
//
// 把 sectionXxx 文本里出现的 "| col | col |\n|---|---|\n| v | v |" 形式的
// markdown table 解析后用 ╭─┬─╮ / │ / ╰─┴─╯ 重新画 · 单元格按视觉宽度 padding
// (CJK 字符宽度 = 2 · ASCII = 1)。表格之外的散文/引用保留。
// ---------------------------------------------------------------------------

function visualWidth(s) {
  // 只把 East Asian Width = W/F 的字符算 2 宽。简单 codepoint > 0x7f 判定会
  // 把数学符号(≥ ≤ ≠)/箭头(→)/box-drawing(╭ │)/shade(░ █)等都误判 2 宽 ·
  // 列对齐就崩。这里用 CJK 主要范围 + emoji 做白名单。
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (
      (cp >= 0x1100 && cp <= 0x115F) || // Hangul Jamo
      (cp >= 0x2E80 && cp <= 0x303E) || // CJK Radicals / Kangxi
      (cp >= 0x3041 && cp <= 0x33FF) || // Hiragana / Katakana / CJK Symbols
      (cp >= 0x3400 && cp <= 0x4DBF) || // CJK Ext A
      (cp >= 0x4E00 && cp <= 0x9FFF) || // CJK Unified Ideographs
      (cp >= 0xA000 && cp <= 0xA4CF) || // Yi
      (cp >= 0xAC00 && cp <= 0xD7A3) || // Hangul Syllables
      (cp >= 0xF900 && cp <= 0xFAFF) || // CJK Compatibility
      (cp >= 0xFE30 && cp <= 0xFE4F) || // CJK Compat Forms
      (cp >= 0xFF00 && cp <= 0xFF60) || // Fullwidth Forms (含 CJK 标点)
      (cp >= 0xFFE0 && cp <= 0xFFE6) || // Fullwidth Signs
      (cp >= 0x20000 && cp <= 0x2FFFD) || // CJK Ext B-F
      (cp >= 0x1F300 && cp <= 0x1F6FF) || // Emoji 主区
      (cp >= 0x1F900 && cp <= 0x1F9FF) // Emoji 补充
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

function padToWidth(s, w) {
  return s + " ".repeat(Math.max(0, w - visualWidth(s)));
}

function parseMarkdownTable(lines) {
  // lines 是 "| col | col |" 形式的连续行 · 第二行必须是分隔符 |---|---|
  if (lines.length < 2) return null;
  const parseRow = (line) =>
    line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const header = parseRow(lines[0]);
  if (!/^\s*\|[\s\-:|]+\|\s*$/.test(lines[1])) return null;
  const rows = lines.slice(2).map(parseRow);
  return { header, rows };
}

function renderBoxTable(header, rows) {
  const colCount = header.length;
  const widths = [];
  for (let i = 0; i < colCount; i++) {
    let w = visualWidth(header[i] ?? "");
    for (const r of rows) {
      w = Math.max(w, visualWidth(r[i] ?? ""));
    }
    widths.push(w);
  }
  const top = "╭" + widths.map((w) => "─".repeat(w + 2)).join("┬") + "╮";
  const sep = "├" + widths.map((w) => "─".repeat(w + 2)).join("┼") + "┤";
  const bot = "╰" + widths.map((w) => "─".repeat(w + 2)).join("┴") + "╯";
  const renderRow = (cells) =>
    "│ " + cells.map((c, i) => padToWidth(c ?? "", widths[i])).join(" │ ") + " │";
  return [top, renderRow(header), sep, ...rows.map(renderRow), bot].join("\n");
}

function convertMdTablesInText(text) {
  // 在 text 中找出所有连续的 "| ... |" 行块 · 每块尝试 parse 为 markdown table ·
  // 成功就替换成 box-drawing · 失败保留原样。块外内容不动。
  const lines = text.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (/^\s*\|.*\|\s*$/.test(lines[i])) {
      // 找连续表格行
      let j = i;
      while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) j++;
      const tableLines = lines.slice(i, j);
      const parsed = parseMarkdownTable(tableLines);
      if (parsed) {
        out.push(renderBoxTable(parsed.header, parsed.rows));
      } else {
        out.push(...tableLines);
      }
      i = j;
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// 拼屏幕 footer · markdown / box 双 mode
// ---------------------------------------------------------------------------

const out = [];

function pushSection(title, body) {
  if (!body) return;
  if (format === "markdown") {
    out.push(`## ${title}\n`);
    out.push(body);
  } else {
    out.push(`═══ ${title} ═══\n`);
    out.push(convertMdTablesInText(body));
  }
  out.push("");
}

pushSection("诊断结果", matrix);
pushSection("需要调优", sectionTopIssues);
pushSection("关键指标", sectionHealthy);

if (flameText) {
  if (format === "markdown") {
    // flame 是 box-drawing 预渲染 ASCII art · 在 markdown 渲染器下必须包
    // fenced code block 才能保持等宽对齐(否则 ╭─┬─╮ 跟 prose 一起折行)。
    // 这是 SKILL v0.15.0 footer 红线的"脚本内部例外"——红线禁的是 LLM
    // 把整个 footer 包代码块 · 不禁脚本对子段做必要的代码块包裹。
    out.push("```");
    out.push(flameText);
    out.push("```");
  } else {
    out.push(flameText);
  }
  out.push("");
}

out.push(`建议第一步  ${firstStep}`);
out.push(`报告        ${reportPath}`);
out.push("");

if (sectionRefs) {
  if (format === "markdown") {
    out.push("## 参考\n");
    out.push(sectionRefs);
  } else {
    out.push("═══ 参考 ═══\n");
    out.push(sectionRefs);
  }
  out.push("");
}

process.stdout.write(out.join("\n"));
