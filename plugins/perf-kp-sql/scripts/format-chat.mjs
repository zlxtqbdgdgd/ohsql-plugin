#!/usr/bin/env node
// format-chat.mjs
// 按终端宽度对 .md 报告中诊断结果 pipe table 的 cell 内容重新折行。
// 表结构（6 列）不变，只调整 <br> 位置使总宽 ≤ 终端列数。
// 火焰图段、头尾文字原样透传。
//
// 导出函数（供测试 / 外部调用）:
//   lintReport(mdText, {fix})  → lint 结果 · fix=true 时同步补 [LLM]
//   rewrapTable(content, cols) → 重排后的全文
//   parseCells(line)           → cell 数组
//   buildRow(cells)            → 表行字符串
//   displayWidth(str)          → 显示宽度
//   stripChatTags(text)        → 剥 5 标签 + legend
//
// CLI 用法:
//   node scripts/format-chat.mjs --chat <chat.md> [--cols N]

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ── Lint + Auto-fix（5 标签来源标记验证 · 可选自动补 [LLM]）────
// 参见 docs/superpowers/specs/2026-05-01-md-report-source-tags-design.md
//
// fix=false（默认）: 只统计漏挂 · 返回 { total, missing, missRate }
// fix=true:          同一次遍历里给漏挂原子补 [LLM] · 额外返回 { fixedContent, fixed }

// 允许标签后跟 1 个可选标点(如 `[LLM]:` 风格)
const TAG_AT_END_RE = /\[(IDX|CASE|NLM|OBS|LLM)\]\s*(\[参考\d+\])?\s*[:,。;?!]?\s*$/;

// 把 backtick code span(`...`)替换成占位符 · 切分后再换回 ·
// 防止句末标点切分进入代码内部
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

export function lintReport(mdText, { fix = false } = {}) {
  const lines = mdText.split("\n");
  let total = 0;
  const missing = [];
  let fixed = 0;

  let inMetadata = true;
  let inLegend = false;
  let inRef = false;
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (/^```|^~~~/.test(trimmed)) {
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
      // ── table data row ──
      const cells = parseCells(raw);
      let rowDirty = false;
      const fixedCells = cells.map(cell => {
        const subs = cell.split("<br>");
        const fixedSubs = subs.map(sub => {
          const subTrim = sub.trim();
          if (!subTrim) return sub;
          if (/^(\[参考\d+\]\s*(\[(CASE|NLM)\])?\s*)+$/.test(subTrim)) return sub;

          if (subTrim.includes(" · ")) {
            const atoms = subTrim.split(" · ");
            for (const atom of atoms) {
              const a = atom.trim();
              if (!a) continue;
              total++;
              if (!TAG_AT_END_RE.test(a)) {
                missing.push({ line: i + 1, text: a });
              }
            }
            if (fix && !TAG_AT_END_RE.test(subTrim)) {
              fixed++;
              rowDirty = true;
              return sub.replace(/\s*$/, "") + " [LLM]";
            }
          } else {
            total++;
            if (!TAG_AT_END_RE.test(subTrim)) {
              missing.push({ line: i + 1, text: subTrim });
              if (fix) {
                fixed++;
                rowDirty = true;
                return sub.replace(/\s*$/, "") + " [LLM]";
              }
            }
          }
          return sub;
        });
        return fixedSubs.join("<br>");
      });
      if (fix && rowDirty) {
        lines[i] = buildRow(fixedCells);
      }
    } else {
      // ── narrative line / list item ──
      const sentences = splitNarrativeAtoms(trimmed);
      let result = fix ? raw : null;
      for (const sentence of sentences) {
        const s = sentence.trim();
        if (s.length < 4) continue;
        total++;
        if (!TAG_AT_END_RE.test(s)) {
          missing.push({ line: i + 1, text: s });
          if (fix && result) {
            const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const re = new RegExp(escaped.replace(/\s+/g, "\\s+") + "(?!\\s*\\[)");
            if (re.test(result)) {
              result = result.replace(re, (m) => m + " [LLM]");
              fixed++;
            }
          }
        }
      }
      if (fix && result && result !== raw) {
        lines[i] = result;
      }
    }
  }

  const missRate = total === 0 ? 0 : missing.length / total;
  const out = { total, missing, missRate };
  if (fix) {
    out.fixedContent = lines.join("\n");
    out.fixed = fixed;
  }
  return out;
}

// ── Strip（chat 输出剥标签 · .md 文件不动）──────────────
// 参见 docs/superpowers/specs/2026-05-01-md-report-source-tags-design.md

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

// ── CJK 显示宽度 ─────────────────────────────────────────
export function charWidth(cp) {
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

export function displayWidth(str) {
  let w = 0;
  for (const ch of str) {
    w += charWidth(ch.codePointAt(0));
  }
  return w;
}

// ── 断词优先级 ────────────────────────────────────────────
const BREAK_CHARS = new Set(["·", " ", "→", "+", "/", "(", "；", "，", "、", "：", ";", ",", ".", "_", "-", "="]);

// 把单个段(已无 <br>)按 budget 二次断 · 内部辅助 · 仅在段宽超 budget 时调用
function wrapOneSegment(text, budget) {
  // 把 backtick 代码段替换成不含空格的占位符 · 防止被拆断
  const codeSpans = [];
  const protected_ = text.replace(/`[^`]+`/g, (m) => {
    codeSpans.push(m);
    return `\x01${codeSpans.length - 1}\x01`;
  });

  const result = [];
  let line = "";
  let lineW = 0;
  let lastBreakIdx = -1;
  let charIdx = 0;

  for (const ch of protected_) {
    const cw = charWidth(ch.codePointAt(0));
    if (BREAK_CHARS.has(ch)) {
      lastBreakIdx = charIdx;
    }
    if (lineW + cw > budget && line.length > 0) {
      if (lastBreakIdx >= 0) {
        const chars = [...line];
        result.push(chars.slice(0, lastBreakIdx + 1).join(""));
        line = chars.slice(lastBreakIdx + 1).join("") + ch;
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

  // 还原占位符 · 代码段完整保留在同一行
  return result.map(l => l.replace(/\x01(\d+)\x01/g, (_, n) => codeSpans[+n]));
}

// 重排 cell · 严格保留 LLM 在源 .md 里挂的 <br> 语义断点
//
// 算法(0.49 起 · 修 0.40.1 commit 50c6eb5 引入的"strip→rewrap 全推平"回归):
//   1. 按 <br> 切 segment(不再拍成空格)
//   2. 每段独立判宽
//      - 段宽 ≤ budget → 原样保留(尊重 LLM 5 标签 spec 的"1 atom = 1 行"契约)
//      - 段宽 > budget → 该段内按 BREAK_CHARS 二次断
//   3. 各段间始终用 <br> 重连
//
// 设计冲突解决:
//   spec/2026-04-30-format-chat-adaptive-table-design.md(去 <br> 重断)
//   vs spec/2026-05-01-md-report-source-tags-design.md(每 <br> = 1 atom)
//   → 后者优先 · 前者降级为"只动过宽段"。
export function rewrapCell(text, budget) {
  if (!text || !text.trim()) return "";

  const segments = text
    .split(/<br\s*\/?>/i)
    .map(s => s.replace(/\s+/g, " ").trim())
    .filter(s => s.length > 0);

  if (segments.length === 0) return "";

  const out = [];
  for (const seg of segments) {
    if (displayWidth(seg) <= budget) {
      out.push(seg);
    } else {
      out.push(...wrapOneSegment(seg, budget));
    }
  }
  return out.join("<br>");
}

// ── 解析 pipe table ──────────────────────────────────────
export function parseCells(line) {
  const stripped = line.replace(/^\|/, "").replace(/\|$/, "");
  return stripped.split("|").map(c => c.trim());
}

export function buildRow(cells) {
  return "| " + cells.join(" | ") + " |";
}

// ── 表格重排 ─────────────────────────────────────────────
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

// ── CLI ──────────────────────────────────────────────────
const isCli = process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isCli) {
  // Exit codes:
  //   0 = 成功（含自动补标签后成功）
  //   1 = CLI 参数错误 / 文件不存在
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

  // fallback 200 而非 100:Bash sub-shell 没 TTY 时 process.stdout.columns 是 undefined,
  // 历史 fallback 100 算出 budget=15、CJK 折半 = 7 字 / cell · 触发 Claude Code 竖排降级
  // (regression of f2007f4 "诊断表单元格强制 <br> 换行 · 防终端 80 列竖排降级")。
  // 现代终端基本 ≥ 150,200 是更安全的"不假阳"默认。
  cols = cols || process.stdout.columns || 200;
  cols = Math.max(cols, 80);

  const content = readFileSync(chatPath, "utf8");

  // ─ Step 0: lint + auto-fix（漏挂时自动补 [LLM] · 不阻断）
  let workingContent = content;
  const lint = lintReport(workingContent, { fix: false });
  if (lint.missRate > 0.05) {
    const fixResult = lintReport(workingContent, { fix: true });
    console.error(`⚠ 来源标签自动修复 · 补挂 ${fixResult.fixed} 个 [LLM] (原漏挂率 ${(lint.missRate * 100).toFixed(1)}% ${lint.missing.length}/${lint.total})`);
    workingContent = fixResult.fixedContent;
  }

  // ─ Step 1: strip 5 标签 + legend
  const stripped = stripChatTags(workingContent);

  // ─ Step 2: rewrap 诊断结果表格
  const { content: rewrapped, found } = rewrapTable(stripped, cols);
  if (!found) {
    console.error("⚠ 未找到 ## 诊断结果 pipe table");
    process.stdout.write(stripped);
    process.exit(3);
  }

  process.stdout.write(rewrapped);
}
