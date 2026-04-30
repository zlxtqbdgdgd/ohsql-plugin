#!/usr/bin/env node
// format-chat.mjs
// 按终端宽度对 -chat.md 中诊断结果 pipe table 的 cell 内容重新折行。
// 表结构（6 列）不变，只调整 <br> 位置使总宽 ≤ 终端列数。
// 火焰图段、头尾文字原样透传。
//
// Usage:
//   node scripts/format-chat.mjs --chat <chat.md> [--cols N]

import { readFileSync, existsSync } from "node:fs";

// ── CLI args ──────────────────────────────────────────────
const args = process.argv.slice(2);
let chatPath = null;
let cols = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--chat" && args[i + 1]) { chatPath = args[++i]; continue; }
  if (args[i] === "--cols" && args[i + 1]) { cols = parseInt(args[++i], 10); continue; }
}

if (!chatPath) {
  console.error("usage: format-chat.mjs --chat <chat.md> [--cols N]");
  process.exit(1);
}
if (!existsSync(chatPath)) {
  console.error(`chat file not found: ${chatPath}`);
  process.exit(1);
}

// 终端宽度：显式传入 > process.stdout.columns > 默认 100
if (!cols || isNaN(cols)) {
  cols = process.stdout.columns || 100;
}
// 钳位：最小 80
if (cols < 80) cols = 80;

// ── CJK 显示宽度 ─────────────────────────────────────────
function charWidth(cp) {
  // CJK Unified Ideographs + Extensions
  if (cp >= 0x4E00 && cp <= 0x9FFF) return 2;
  if (cp >= 0x3400 && cp <= 0x4DBF) return 2;
  if (cp >= 0x20000 && cp <= 0x2A6DF) return 2;
  if (cp >= 0x2A700 && cp <= 0x2CEAF) return 2;
  if (cp >= 0x2CEB0 && cp <= 0x2EBEF) return 2;
  if (cp >= 0x30000 && cp <= 0x3134F) return 2;
  // CJK Compatibility Ideographs
  if (cp >= 0xF900 && cp <= 0xFAFF) return 2;
  // Fullwidth Forms
  if (cp >= 0xFF01 && cp <= 0xFF60) return 2;
  if (cp >= 0xFFE0 && cp <= 0xFFE6) return 2;
  // CJK Symbols, Hiragana, Katakana, Hangul, etc.
  if (cp >= 0x3000 && cp <= 0x303F) return 2;
  if (cp >= 0x3040 && cp <= 0x309F) return 2;
  if (cp >= 0x30A0 && cp <= 0x30FF) return 2;
  if (cp >= 0xAC00 && cp <= 0xD7AF) return 2;
  // Enclosed CJK
  if (cp >= 0x3200 && cp <= 0x32FF) return 2;
  if (cp >= 0x3300 && cp <= 0x33FF) return 2;
  // CJK Compatibility
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

// ── 断词优先级 ────────────────────────────────────────────
const BREAK_CHARS = new Set(["·", " ", "→", "+", "/", "(", "；", "，", "、", "：", ";", ",", ".", "_", "-", "="]);

function rewrapCell(text, budget) {
  // 去掉现有 <br>，合并为纯文本
  const plain = text.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
  if (!plain) return "";

  // 如果已经 fit，直接返回
  if (displayWidth(plain) <= budget) return plain;

  const result = [];
  let line = "";
  let lineW = 0;
  let lastBreakIdx = -1; // index in line (char count) of last break opportunity
  let lastBreakW = 0;
  let charIdx = 0;

  for (const ch of plain) {
    const cw = charWidth(ch.codePointAt(0));

    if (BREAK_CHARS.has(ch)) {
      lastBreakIdx = charIdx;
      lastBreakW = lineW + cw;
    }

    if (lineW + cw > budget && line.length > 0) {
      // 需要断行
      if (lastBreakIdx >= 0) {
        // 在断词点处断
        const chars = [...line];
        const keep = chars.slice(0, lastBreakIdx + 1).join("");
        const rest = chars.slice(lastBreakIdx + 1).join("");
        result.push(keep);
        line = rest + ch;
        lineW = displayWidth(line);
      } else {
        // 无断词点，强制在当前位置断
        result.push(line);
        line = ch;
        lineW = cw;
      }
      lastBreakIdx = -1;
      lastBreakW = 0;
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

// ── 解析 pipe table ──────────────────────────────────────
function parseCells(line) {
  // | cell1 | cell2 | ... | → ["cell1", "cell2", ...]
  const stripped = line.replace(/^\|/, "").replace(/\|$/, "");
  return stripped.split("|").map(c => c.trim());
}

function buildRow(cells) {
  return "| " + cells.join(" | ") + " |";
}

// ── 主逻辑 ───────────────────────────────────────────────
const content = readFileSync(chatPath, "utf8");
const lines = content.split("\n");

// 每列显示宽度预算: (cols - 7个pipe) / 6, 最少 8
const budget = Math.max(Math.floor((cols - 7) / 6), 8);

// 找诊断结果表的位置
let tableStart = -1;  // 表头行 index
let sepLine = -1;     // |---| 分隔行 index
let tableEnd = -1;    // 表数据最后一行的下一行 index

for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "## 诊断结果") {
    // 向下找表头和分隔行
    for (let j = i + 1; j < lines.length; j++) {
      const trimmed = lines[j].trim();
      if (!trimmed) continue; // 跳过空行
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
  // 没找到表，原样输出
  console.error("⚠ 未找到 ## 诊断结果 pipe table");
  process.stdout.write(content);
  process.exit(2);
}

// 找数据行范围
tableEnd = sepLine + 1;
while (tableEnd < lines.length) {
  const trimmed = lines[tableEnd].trim();
  if (!trimmed.startsWith("|")) break;
  tableEnd++;
}

// 处理数据行
const output = [];
for (let i = 0; i < lines.length; i++) {
  if (i >= sepLine + 1 && i < tableEnd) {
    // 数据行：重新折行
    const cells = parseCells(lines[i]);
    const rewrapped = cells.map(c => rewrapCell(c, budget));
    output.push(buildRow(rewrapped));
  } else {
    // 其他行：原样保留
    output.push(lines[i]);
  }
}

process.stdout.write(output.join("\n"));
