// format-chat.mjs
// 零依赖 · 直接读 .md 报告 · 提取诊断表/火焰图/参考 · box-drawing 渲染 · 代码块输出
// 不再依赖 md-to-html.mjs 或 -chat.md 中间文件
//
// Usage: node scripts/format-chat.mjs --report <report.md> [--cols N]

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const isCli = !!(process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]);

// CLI 共享变量(test import 时 reportPath 保持 null,主流程不进入)
let reportPath = null;
let cols = process.stdout.columns || 100;
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

export function parseCells(line) {
  return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
}

// ── Lint(5 标签来源标记验证) ──────────────────────────────
// 参见 docs/superpowers/specs/2026-05-01-md-report-source-tags-design.md
// CLI 不再调用(box-drawing 主流程),但保留 export 供测试 / 外部脚本使用

const TAG_AT_END_RE = /\[(IDX|CASE|NLM|OBS|LLM)\]\s*(\[参考\d+\])?\s*[:,。;?!]?\s*$/;

function splitNarrativeAtoms(line) {
  const codeSpans = [];
  const protectedLine = line.replace(/`[^`]+`/g, (m) => {
    codeSpans.push(m);
    return `\x00${codeSpans.length - 1}\x00`;
  });
  const atoms = [];
  for (const chunk of protectedLine.split(" · ")) {
    for (const sub of chunk.split(/[。?!]/)) {
      atoms.push(sub.replace(/\x00(\d+)\x00/g, (_, n) => codeSpans[+n]));
    }
  }
  return atoms;
}

export function lintReport(mdText) {
  const lines = mdText.split("\n");
  const total_missing = { total: 0, missing: [] };

  let inMetadata = true;
  let inLegend = false;
  let inRef = false;
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (/^```/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    if (/^##\s/.test(trimmed) && !/^###/.test(trimmed)) {
      inMetadata = false;
      inLegend = trimmed === "## 来源标记 (debug)";
      inRef = trimmed === "## 参考";
      continue;
    }

    if (inMetadata || inLegend || inRef) continue;
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith(">")) continue;

    if (/^\|[-| ]+\|$/.test(trimmed)) continue;
    if (trimmed.startsWith("|") && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (/^\|[-| ]+\|$/.test(next)) continue;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = parseCells(raw);
      for (const cell of cells) {
        const sublines = cell.split("<br>");
        for (const sub of sublines) {
          const subTrim = sub.trim();
          if (!subTrim) continue;
          if (/^\[参考\d+\]$/.test(subTrim)) continue;

          if (subTrim.includes(" · ")) {
            const atoms = subTrim.split(" · ");
            for (const atom of atoms) {
              const a = atom.trim();
              if (!a) continue;
              total_missing.total++;
              if (!TAG_AT_END_RE.test(a)) {
                total_missing.missing.push({ line: i + 1, text: a });
              }
            }
          } else {
            total_missing.total++;
            if (!TAG_AT_END_RE.test(subTrim)) {
              total_missing.missing.push({ line: i + 1, text: subTrim });
            }
          }
        }
      }
    } else {
      const sentences = splitNarrativeAtoms(trimmed);
      for (const sentence of sentences) {
        const s = sentence.trim();
        if (s.length < 4) continue;
        total_missing.total++;
        if (!TAG_AT_END_RE.test(s)) {
          total_missing.missing.push({ line: i + 1, text: s });
        }
      }
    }
  }

  const missRate = total_missing.total === 0
    ? 0
    : total_missing.missing.length / total_missing.total;

  return { ...total_missing, missRate };
}

// ── Strip(chat 输出剥标签 · .md 文件不动) ──────────────

export function stripChatTags(text) {
  let out = text.replace(/\r\n/g, "\n");

  out = out.replace(
    /(?:^|\n)## 来源标记 \(debug\)[\s\S]*?(?=\n## |$)/g,
    ""
  );

  out = out.replace(/\[(IDX|CASE|NLM|OBS|LLM)\]([ \t]*)(?=\[参考)/g, "");
  out = out.replace(/[ \t]*\[(IDX|CASE|NLM|OBS|LLM)\]/g, "");

  out = out.replace(/(?<=\S)  +/g, " ");

  return out;
}

// ── CJK 显示宽度(供 rewrapCell / rewrapTable 使用) ─────
// 与上方 charW/dw 同语义;不同名,允许两路并存。
function charWidth(cp) {
  if (cp >= 0x4E00 && cp <= 0x9FFF) return 2;
  if (cp >= 0x3400 && cp <= 0x4DBF) return 2;
  if (cp >= 0x20000 && cp <= 0x2A6DF) return 2;
  if (cp >= 0x2A700 && cp <= 0x2CEAF) return 2;
  if (cp >= 0x2CEB0 && cp <= 0x2EBEF) return 2;
  if (cp >= 0x30000 && cp <= 0x3134F) return 2;
  if (cp >= 0xF900 && cp <= 0xFAFF) return 2;
  if (cp >= 0xFF01 && cp <= 0xFF60) return 2;
  if (cp >= 0xFFE0 && cp <= 0xFFE6) return 2;
  if (cp >= 0x3000 && cp <= 0x303F) return 2;
  if (cp >= 0x3040 && cp <= 0x309F) return 2;
  if (cp >= 0x30A0 && cp <= 0x30FF) return 2;
  if (cp >= 0xAC00 && cp <= 0xD7AF) return 2;
  if (cp >= 0x3200 && cp <= 0x32FF) return 2;
  if (cp >= 0x3300 && cp <= 0x33FF) return 2;
  if (cp >= 0xFE30 && cp <= 0xFE4F) return 2;
  return 1;
}

function displayWidth(str) {
  let w = 0;
  for (const ch of str) {
    w += charWidth(ch.codePointAt(0));
  }
  return w;
}

const BREAK_CHARS = new Set(["·", " ", "→", "+", "/", "(", "；", ",", "、", ":", ";", ",", ".", "_", "-", "="]);

function rewrapCell(text, budget) {
  const plain = text.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
  if (!plain) return "";

  if (displayWidth(plain) <= budget) return plain;

  const result = [];
  let line = "";
  let lineW = 0;
  let lastBreakIdx = -1;
  let charIdx = 0;

  for (const ch of plain) {
    const cw = charWidth(ch.codePointAt(0));

    if (BREAK_CHARS.has(ch)) {
      lastBreakIdx = charIdx;
    }

    if (lineW + cw > budget && line.length > 0) {
      if (lastBreakIdx >= 0) {
        const chars = [...line];
        const keep = chars.slice(0, lastBreakIdx + 1).join("");
        const rest = chars.slice(lastBreakIdx + 1).join("");
        result.push(keep);
        line = rest + ch;
        lineW = displayWidth(line);
      } else {
        result.push(line);
        line = ch;
        lineW = cw;
      }
      lastBreakIdx = -1;
      charIdx = [...line].length - 1;
    } else {
      line += ch;
      lineW += cw;
    }
    charIdx++;
  }
  if (line) result.push(line);

  return result.join("<br>");
}

function buildRow(cells) {
  return "| " + cells.join(" | ") + " |";
}

// ── 表格重排(独立于 box-drawing 主流程,仅供测试 / 外部调用) ──
export function rewrapTable(content, cols) {
  const lines = content.split("\n");
  const budget = Math.max(Math.floor((cols - 7) / 6), 8);

  let tableStart = -1;
  let sepLine = -1;
  let tableEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "## 诊断结果") {
      for (let j = i + 1; j < lines.length; j++) {
        const trimmed = lines[j].trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("|") && tableStart < 0) {
          tableStart = j;
          continue;
        }
        if (tableStart >= 0 && /^\|[-| ]+\|$/.test(trimmed)) {
          sepLine = j;
          break;
        }
      }
      break;
    }
  }

  if (tableStart < 0 || sepLine < 0) {
    return { content, found: false };
  }

  tableEnd = sepLine + 1;
  while (tableEnd < lines.length) {
    const trimmed = lines[tableEnd].trim();
    if (!trimmed.startsWith("|")) break;
    tableEnd++;
  }

  const output = [];
  for (let i = 0; i < lines.length; i++) {
    if (i >= sepLine + 1 && i < tableEnd) {
      const cells = parseCells(lines[i]);
      const rewrapped = cells.map(c => rewrapCell(c, budget));
      output.push(buildRow(rewrapped));
    } else {
      output.push(lines[i]);
    }
  }

  return { content: output.join("\n"), found: true };
}

// ── 6 列 → 4 列合并 ─────────────────────────────────────
const COL = { ROOT_CAUSE: 0, EVIDENCE: 1, ACTION: 2, RISK: 3, CONFIDENCE: 4, REF: 5 };

function mergeToRow(cells6) {
  const c = cells6.map(cleanCell);
  let risk = c[COL.RISK];
  if (c[COL.CONFIDENCE]) risk += `/${c[COL.CONFIDENCE]}`;
  if (c[COL.REF]) risk += ` ${c[COL.REF]}`;
  return [c[COL.ROOT_CAUSE], c[COL.EVIDENCE], c[COL.ACTION], risk];
}

// ── box-drawing 表格渲染 ─────────────────────────────────
function renderTable(headerCells, dataRows) {
  const header = ["确认的根因", "判定依据", "建议措施", "风险等级"];
  const rows = dataRows.map(cells =>
    cells.length === 6 ? mergeToRow(cells) : cells.map(cleanCell)
  );

  const avail = Math.max(cols - 15, 40);
  const colWidths = [
    Math.floor(avail * 0.28),
    Math.floor(avail * 0.28),
    Math.floor(avail * 0.28),
    Math.floor(avail * 0.16),
  ];

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

// ── CLI 主流程(仅 isCli 时执行) ─────────────────────────
if (isCli) {

// 解析 args(reportPath/cols 已在顶部声明)
{
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--report" || args[i] === "--chat") && args[i + 1]) { reportPath = args[++i]; continue; }
    if (args[i] === "--cols" && args[i + 1]) { const c = parseInt(args[++i], 10); if (!isNaN(c)) cols = c; continue; }
  }
}
if (!reportPath) { console.error("usage: format-chat.mjs --report <report.md> [--cols N]"); process.exit(1); }
if (!existsSync(reportPath)) { console.error(`file not found: ${reportPath}`); process.exit(1); }
if (cols < 80) cols = 80;

// ── 从 .md 提取各段 ─────────────────────────────────────
const content = readFileSync(reportPath, "utf8");
const lines = content.split("\n");

// 按 ## 标题切段
function extractSection(heading) {
  // 边界放宽:行 trim 后等于 heading,或以 `heading(` 起首(允许尾部括号注释如
  // "## 火焰图分析(若 Phase 3.A.3 采到)" / "## 现场观测(...)")。这样 SKILL 段标题
  // 加 / 改括号注释时无需同步改本文件。注意 `## 参考` 不会撞 `## 参考文件`,因为后者
  // 不是 + "(" 模式。
  const startIdx = lines.findIndex((l) => {
    const t = l.trim();
    return t === heading || t.startsWith(heading + "(");
  });
  if (startIdx < 0) return null;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { endIdx = i; break; }
  }
  return { start: startIdx, end: endIdx, lines: lines.slice(startIdx, endIdx) };
}

const diagSection = extractSection("## 诊断结果");
const flameSection = extractSection("## 火焰图分析");
const refSection = extractSection("## 参考");
const observeSection = extractSection("## 现场观测");

if (!diagSection) {
  console.error("⚠ 未找到 ## 诊断结果");
  process.stdout.write(content);
  process.exit(2);
}

// 解析诊断表
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

const renderedTable = renderTable(headerCells, dataRows);

// ── 组装 chat 输出 ───────────────────────────────────────
const output = [];

output.push("✓ 报告已生成");
output.push("");
output.push(`📄 ${reportPath}`);
output.push("");
output.push("## 诊断结果");
output.push("");
output.push("```");
output.push(renderedTable);
output.push("```");

// 火焰图段原样透传
if (flameSection) {
  output.push("");
  for (const l of flameSection.lines) output.push(l);
}

// 现场观测段原样透传（如果有）
if (observeSection) {
  output.push("");
  for (const l of observeSection.lines) output.push(l);
}

// 参考 URL 列表
if (refSection) {
  output.push("");
  for (const l of refSection.lines) output.push(l);
}

process.stdout.write(output.join("\n"));

} // end if (isCli)
