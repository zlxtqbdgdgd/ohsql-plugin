#!/usr/bin/env node
// format-chat.mjs
// 按终端宽度对 .md 报告中诊断结果 pipe table 的 cell 内容重新折行。
// 表结构（6 列）不变，只调整 <br> 位置使总宽 ≤ 终端列数。
// 火焰图段、头尾文字原样透传。
//
// 导出函数（供测试 / 外部调用）:
//   rewrapTable(content, cols) → 重排后的全文
//   parseCells(line)           → cell 数组
//   buildRow(cells)            → 表行字符串
//   displayWidth(str)          → 显示宽度
//
// CLI 用法:
//   node scripts/format-chat.mjs --chat <chat.md> [--cols N]

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ── Lint(5 标签来源标记验证) ──────────────────────────────
// 参见 docs/superpowers/specs/2026-05-01-md-report-source-tags-design.md

// 允许标签后跟 1 个可选标点(如 `[LLM]:` 风格)
const TAG_AT_END_RE = /\[(IDX|KB|NLM|OBS|LLM)\]\s*(\[参考\d+\])?\s*[:,。;?!]?\s*$/;

// 把 backtick code span(`...`)替换成占位符 · 切分后再换回 ·
// 防止句末标点切分进入代码内部
function splitNarrativeAtoms(line) {
  const codeSpans = [];
  // 占位符用 \x00 包裹索引 · 这俩控制符在正文里不会出现
  const protectedLine = line.replace(/`[^`]+`/g, (m) => {
    codeSpans.push(m);
    return `\x00${codeSpans.length - 1}\x00`;
  });
  // 先按 ` · ` 切 atom · 再按 [。?!] 切句末
  // 不切 `:` / `;`(常见于"建议措施:"标签 / 代码内)
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

  let inMetadata = true;     // start: 在 # title 之后 · 第一个 ## 之前
  let inLegend = false;
  let inRef = false;
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // code fence toggle
    if (/^```/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    // section transitions(只在 ## 级别 · ### 不切)
    if (/^##\s/.test(trimmed) && !/^###/.test(trimmed)) {
      inMetadata = false;
      inLegend = trimmed === "## 来源标记 (debug)";
      inRef = trimmed === "## 参考";
      continue; // heading 行本身豁免
    }

    if (inMetadata || inLegend || inRef) continue;
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith(">")) continue;

    // table separator + table header row 豁免
    if (/^\|[-| ]+\|$/.test(trimmed)) continue;
    if (trimmed.startsWith("|") && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (/^\|[-| ]+\|$/.test(next)) continue; // header 行
    }

    // 处理 table data row vs narrative
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      // table data row
      const cells = parseCells(raw);
      for (const cell of cells) {
        const sublines = cell.split("<br>");
        for (const sub of sublines) {
          const subTrim = sub.trim();
          if (!subTrim) continue;
          // 单纯的 [参考N] cell(不属 5 标签事实 cell)豁免
          if (/^\[参考\d+\]$/.test(subTrim)) continue;

          if (subTrim.includes(" · ")) {
            // sub-atom 切分
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
      // narrative line / list item
      // 切分顺序: ` · ` (atom separator) > [。?!] (sentence terminator)
      // 不切 `:` / `;` (常见于"建议措施:"标签 / 代码内)
      // 不切 backtick code 内的标点(`...`)
      const sentences = splitNarrativeAtoms(trimmed);
      for (const sentence of sentences) {
        const s = sentence.trim();
        if (s.length < 4) continue; // 短碎片豁免
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

// ── CJK 显示宽度 ─────────────────────────────────────────
export function charWidth(cp) {
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

export function displayWidth(str) {
  let w = 0;
  for (const ch of str) {
    w += charWidth(ch.codePointAt(0));
  }
  return w;
}

// ── 断词优先级 ────────────────────────────────────────────
const BREAK_CHARS = new Set(["·", " ", "→", "+", "/", "(", "；", "，", "、", "：", ";", ",", ".", "_", "-", "="]);

export function rewrapCell(text, budget) {
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
export function parseCells(line) {
  // | cell1 | cell2 | ... | → ["cell1", "cell2", ...]
  const stripped = line.replace(/^\|/, "").replace(/\|$/, "");
  return stripped.split("|").map(c => c.trim());
}

export function buildRow(cells) {
  return "| " + cells.join(" | ") + " |";
}

// ── 表格重排 ─────────────────────────────────────────────
export function rewrapTable(content, cols) {
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
    return { content, found: false };
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

  return { content: output.join("\n"), found: true };
}

// ── CLI ──────────────────────────────────────────────────
const isCli = process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isCli) {
  // Exit codes:
  //   0 = 成功
  //   1 = CLI 参数错误 / 文件不存在
  //   2 = lint 失败(漏挂率 > 5%)
  //   3 = 未找到 ## 诊断结果 pipe table
  const args = process.argv.slice(2);
  let chatPath = null;
  let cols = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--chat") chatPath = args[++i];
    else if (args[i] === "--cols") cols = parseInt(args[++i], 10);
  }

  if (!chatPath) {
    console.error("usage: format-chat.mjs --chat <chat.md> [--cols N]");
    process.exit(1);
  }
  if (!existsSync(chatPath)) {
    console.error(`文件不存在: ${chatPath}`);
    process.exit(1);
  }

  cols = cols || process.stdout.columns || 100;
  cols = Math.max(cols, 80);

  const content = readFileSync(chatPath, "utf8");

  // ─ Step 0: lint(漏挂率 > 5% → exit 2)
  const lint = lintReport(content);
  if (lint.missRate > 0.05) {
    console.error(`✗ 来源标签 lint 失败 · 漏挂率 ${(lint.missRate * 100).toFixed(1)}% (${lint.missing.length}/${lint.total})`);
    console.error(`  Spec: docs/superpowers/specs/2026-05-01-md-report-source-tags-design.md`);
    console.error(`  前 10 个漏挂位置:`);
    for (const m of lint.missing.slice(0, 10)) {
      console.error(`    L${m.line}: ${m.text.slice(0, 80)}`);
    }
    console.error(`  → 必须回 SKILL.md Phase 5.2 重写报告 · 每个原子事实挂 1 个 [IDX]/[KB]/[NLM]/[OBS]/[LLM] 标签 · 然后重跑 format-chat.mjs。`);
    process.exit(2);
  }

  // ─ Step 1: rewrap 表格
  const { content: rewrapped, found } = rewrapTable(content, cols);
  if (!found) {
    console.error("⚠ 未找到 ## 诊断结果 pipe table");
    process.stdout.write(content);
    process.exit(3);  // ← 3 (lint-fail 占用 2)
  }

  process.stdout.write(rewrapped);
}
