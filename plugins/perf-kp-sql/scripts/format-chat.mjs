// format-chat.mjs
// 零依赖 · 直接读 .md 报告 · 提取综合描述 / 诊断表 / 辅助信息 · box-drawing 渲染 · 代码块输出
//
// Usage: node scripts/format-chat.mjs --report <report.md> [--cols N]
//
// 支持两种 .md 报告结构:
//   - 新版(8 列):综合描述 / 诊断结果(8 列表 + 表后 [参考N]) / 辅助信息(火焰图 + 现场观测)
//   - 旧版(6 列):来源标记 + 诊断结果(6 列表 → 4 列合并) + 火焰图 + 现场观测 + 参考

import { readFileSync, existsSync } from "node:fs";

// ── CLI args ──────────────────────────────────────────────
const args = process.argv.slice(2);
let reportPath = null;
let cols = null;

for (let i = 0; i < args.length; i++) {
  if ((args[i] === "--report" || args[i] === "--chat") && args[i + 1]) { reportPath = args[++i]; continue; }
  if (args[i] === "--cols" && args[i + 1]) { cols = parseInt(args[++i], 10); continue; }
}

if (!reportPath) { console.error("usage: format-chat.mjs --report <report.md> [--cols N]"); process.exit(1); }
if (!existsSync(reportPath)) { console.error(`file not found: ${reportPath}`); process.exit(1); }

if (!cols || isNaN(cols)) cols = process.stdout.columns || 100;
if (cols < 80) cols = 80;

// ── CJK 显示宽度 ─────────────────────────────────────────
function charW(cp) {
  if (cp >= 0x4E00 && cp <= 0x9FFF) return 2;
  if (cp >= 0x3400 && cp <= 0x4DBF) return 2;
  if (cp >= 0x20000 && cp <= 0x3134F) return 2;
  if (cp >= 0xF900 && cp <= 0xFAFF) return 2;
  if (cp >= 0xFF01 && cp <= 0xFF60) return 2;
  if (cp >= 0xFFE0 && cp <= 0xFFE6) return 2;
  if (cp >= 0x3000 && cp <= 0x303F) return 2;
  if (cp >= 0x3040 && cp <= 0x30FF) return 2;
  if (cp >= 0xAC00 && cp <= 0xD7AF) return 2;
  if (cp >= 0x3200 && cp <= 0x33FF) return 2;
  if (cp >= 0xFE30 && cp <= 0xFE4F) return 2;
  return 1;
}

function dw(str) {
  let w = 0;
  for (const ch of str) w += charW(ch.codePointAt(0));
  return w;
}

function padEnd(str, width) {
  const diff = width - dw(str);
  return diff > 0 ? str + " ".repeat(diff) : str;
}

function wrapText(text, width) {
  if (width <= 0) return [text];
  const result = [];
  let line = "", lineW = 0;
  for (const ch of text) {
    const cw = charW(ch.codePointAt(0));
    if (lineW + cw > width && line.length > 0) {
      result.push(line);
      line = ch; lineW = cw;
    } else {
      line += ch; lineW += cw;
    }
  }
  if (line) result.push(line);
  return result.length > 0 ? result : [""];
}

function cleanCell(text) {
  return text.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
}

function parseCells(line) {
  return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
}

// ── 通用 box-drawing 渲染 ────────────────────────────────
function renderBox(header, rows, colWidths) {
  function wrapRow(cells) {
    const wrapped = cells.map((c, i) => wrapText(c, colWidths[i]));
    const maxLines = Math.max(...wrapped.map(w => w.length));
    return Array.from({ length: maxLines }, (_, row) =>
      wrapped.map((lines, col) => padEnd(lines[row] || "", colWidths[col]))
    );
  }

  const hLine = (l, m, r) => l + colWidths.map(w => "─".repeat(w + 2)).join(m) + r;
  const topLine = hLine("┌", "┬", "┐");
  const midLine = hLine("├", "┼", "┤");
  const botLine = hLine("└", "┴", "┘");
  const drawRow = (lines) => lines.map(cells => "│ " + cells.join(" │ ") + " │").join("\n");

  const parts = [topLine, drawRow(wrapRow(header)), midLine];
  for (let i = 0; i < rows.length; i++) {
    parts.push(drawRow(wrapRow(rows[i])));
    if (i < rows.length - 1) parts.push(midLine);
  }
  parts.push(botLine);
  return parts.join("\n");
}

// ── 8 列(新版)渲染 ───────────────────────────────────────
function render8Cols(dataRows) {
  const header = ["根因", "风险", "判断依据", "命中案例", "建议措施", "NotebookLM", "置信", "参考"];
  const rows = dataRows.map(cells => cells.map(cleanCell));

  const avail = Math.max(cols - 18, 70);
  const colWidths = [
    Math.floor(avail * 0.16),
    Math.floor(avail * 0.06),
    Math.floor(avail * 0.14),
    Math.floor(avail * 0.14),
    Math.floor(avail * 0.18),
    Math.floor(avail * 0.18),
    Math.floor(avail * 0.06),
    Math.floor(avail * 0.08),
  ];

  return renderBox(header, rows, colWidths);
}

// ── 6 列(旧版)渲染 · 合并为 4 列 ─────────────────────────
const COL6 = { ROOT_CAUSE: 0, EVIDENCE: 1, ACTION: 2, RISK: 3, CONFIDENCE: 4, REF: 5 };

function mergeRow6To4(cells6) {
  const c = cells6.map(cleanCell);
  let risk = c[COL6.RISK];
  if (c[COL6.CONFIDENCE]) risk += `/${c[COL6.CONFIDENCE]}`;
  if (c[COL6.REF]) risk += ` ${c[COL6.REF]}`;
  return [c[COL6.ROOT_CAUSE], c[COL6.EVIDENCE], c[COL6.ACTION], risk];
}

function render6Cols(dataRows) {
  const header = ["确认的根因", "判定依据", "建议措施", "风险等级"];
  const rows = dataRows.map(cells => mergeRow6To4(cells));

  const avail = Math.max(cols - 15, 40);
  const colWidths = [
    Math.floor(avail * 0.28),
    Math.floor(avail * 0.28),
    Math.floor(avail * 0.28),
    Math.floor(avail * 0.16),
  ];

  return renderBox(header, rows, colWidths);
}

// ── 从 .md 提取各段 ─────────────────────────────────────
const content = readFileSync(reportPath, "utf8");
const lines = content.split("\n");

function findSectionStart(matcher) {
  return lines.findIndex(l => matcher(l.trim()));
}
function sliceSection(startIdx) {
  if (startIdx < 0) return null;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { endIdx = i; break; }
  }
  return { start: startIdx, end: endIdx, lines: lines.slice(startIdx, endIdx) };
}
function extractSection(heading) {
  return sliceSection(findSectionStart(t => t === heading));
}
function extractSectionByPrefix(prefix) {
  return sliceSection(findSectionStart(t => t.startsWith(prefix)));
}

const summarySection = extractSection("## 综合描述");
const diagSection = extractSection("## 诊断结果");
const auxSection = extractSection("## 辅助信息");
// 兼容旧版独立段
const flameSection = extractSection("## 火焰图分析");
const refSection = extractSection("## 参考");
const observeSection = extractSectionByPrefix("## 现场观测");

if (!diagSection) {
  console.error("⚠ 未找到 ## 诊断结果");
  process.stdout.write(content);
  process.exit(2);
}

// 解析诊断表 + 提取表后链接列表
let tableStart = -1, sepLine = -1;
for (let j = 0; j < diagSection.lines.length; j++) {
  const t = diagSection.lines[j].trim();
  if (!t) continue;
  if (t.startsWith("|") && tableStart < 0) { tableStart = j; continue; }
  if (tableStart >= 0 && /^\|[-| ]+\|$/.test(t)) { sepLine = j; break; }
}

let tableEnd = sepLine + 1;
while (tableEnd < diagSection.lines.length && diagSection.lines[tableEnd].trim().startsWith("|")) tableEnd++;

const headerCells = parseCells(diagSection.lines[tableStart]);
const dataRows = [];
for (let i = sepLine + 1; i < tableEnd; i++) dataRows.push(parseCells(diagSection.lines[i]));

const colCount = dataRows.length > 0 ? dataRows[0].length : headerCells.length;
const renderedTable = colCount === 8 ? render8Cols(dataRows) : render6Cols(dataRows);

// 表后链接列表(诊断结果段内 · 表 end 之后的非空行)
const refLinks = [];
for (let i = tableEnd; i < diagSection.lines.length; i++) {
  const l = diagSection.lines[i];
  if (l.trim() === "") continue;
  refLinks.push(l);
}

// ── 组装 chat 输出 ───────────────────────────────────────
const output = [];

output.push("✓ 报告已生成");
output.push("");
output.push(`📄 ${reportPath}`);
output.push("");

// 综合描述段(若有)透传
if (summarySection) {
  for (const l of summarySection.lines) output.push(l);
  output.push("");
}

output.push("## 诊断结果");
output.push("");
output.push("```");
output.push(renderedTable);
output.push("```");

// 表后 [参考N] 链接列表(新版)
if (refLinks.length > 0) {
  output.push("");
  for (const l of refLinks) output.push(l);
}

// 辅助信息段(新版)透传
if (auxSection) {
  output.push("");
  for (const l of auxSection.lines) output.push(l);
}

// 兼容旧版独立段
if (!auxSection && flameSection) {
  output.push("");
  for (const l of flameSection.lines) output.push(l);
}
if (!auxSection && observeSection) {
  output.push("");
  for (const l of observeSection.lines) output.push(l);
}
if (refSection) {
  output.push("");
  for (const l of refSection.lines) {
    if (l.trim() === "") continue;
    output.push(l);
  }
}

process.stdout.write(output.join("\n"));
