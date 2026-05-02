# 报告 5 标签来源标记系统 实施 Plan

> ⚠️ **归档说明 (archived · 2026-05-01)** — 本 plan 文档冻结在 0.31.0 实施时点的术语。
> 0.42.0(2026-05-02)起术语改名:`KB` → `CASE` · `cases/KB.md` → `cases/CASES.md` · `知识库`→`案例库`。
> 本文中的旧命名(`[KB]` / `cases/KB.md` 等)保留作历史快照 · **不要据此修改 live source**。
> 当前生效 spec:[`docs/superpowers/specs/2026-05-01-md-report-source-tags-design.md`](../specs/2026-05-01-md-report-source-tags-design.md) · 已使用新术语。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 perf-kp-sql 诊断报告 `.md` 的每个原子事实都带 `[IDX]` / `[KB]` / `[NLM]` / `[OBS]` / `[LLM]` 五选一来源标签;由 SKILL.md 硬规则 + `format-chat.mjs` lint 双保险防漏挂;chat 输出剥掉标签保留干净体验。

**Architecture:**
1. 把 `scripts/format-chat.mjs` 重构成可 import 的模块,导出纯函数 `lintReport`、`stripChatTags`、`rewrapTable`,CLI 部分用 `import.meta.url` guard 包起来。
2. 加 `lintReport(mdText)` 函数:扫 `.md` 文本,统计漏挂率,> 5% → exit 2 + stderr 列出前 10 个漏挂位置。
3. 加 `stripChatTags(text)` 函数:输出 chat 流前正则去掉 5 标签 + 删除 legend 段(`.md` 文件本身不动)。
4. SKILL.md Phase 5.2 加 5 标签硬规则 + 正反例 + 改报告骨架 · Phase 5.4 加 lint exit 2 处置 · `## 参考` 格式规范 `(KB)/(NLM)` → `[KB]/[NLM]`。

**Tech Stack:** Node.js (≥18) native ESM, `node:test` 单元测试, tsx loader (TypeScript test files), 0 第三方 npm 依赖。

**Spec reference:** `plugins/perf-kp-sql/docs/superpowers/specs/2026-05-01-md-report-source-tags-design.md`

---

## File Structure

| 文件 | 操作 | 职责 |
|---|---|---|
| `plugins/perf-kp-sql/scripts/format-chat.mjs` | 改 | 重构为可 import 模块 + 加 `lintReport` / `stripChatTags` + CLI 整合 |
| `plugins/perf-kp-sql/tests/format-chat-lint.test.ts` | 建 | `lintReport` 单元测试 |
| `plugins/perf-kp-sql/tests/format-chat-strip.test.ts` | 建 | `stripChatTags` 单元测试 |
| `plugins/perf-kp-sql/skills/perf-kp-sql/SKILL.md` | 改 | Phase 5.2(5 标签硬规则 + 报告骨架更新)· Phase 5.4(lint exit 2 处置)· `## 参考` 格式 `(KB)/(NLM)` → `[KB]/[NLM]` |
| `package.json`(repo root) | 改 | `test:perf-kp-sql` 脚本加新测试文件 |
| `plugins/perf-kp-sql/.claude-plugin/plugin.json` | 改 | per-commit version bump |
| `plugins/perf-kp-sql/.codex-plugin/plugin.json` | 改 | per-commit version bump |

---

## Task 1: 重构 format-chat.mjs 为可 import 模块

**目的:** 不改任何用户可见行为,仅把 CLI 顶层代码包进 `import.meta.url` guard,并把核心 rewrap 逻辑抽成 `rewrapTable(content, cols)` 函数 + 把 `parseCells` / `buildRow` 等已有函数用 `export` 暴露,为 Task 2/3 加单元测试做准备。

**Files:**
- Modify: `plugins/perf-kp-sql/scripts/format-chat.mjs`
- Modify: `plugins/perf-kp-sql/.claude-plugin/plugin.json`(版本 bump 0.37.2 → 0.37.3)
- Modify: `plugins/perf-kp-sql/.codex-plugin/plugin.json`(同上)

- [ ] **Step 1: 跑现有测试,记基线**

```bash
npm run test:perf-kp-sql
```

预期:全部 PASS。把通过数记下来,后面 refactor 完要复跑确认无回归。

- [ ] **Step 2: 重构 format-chat.mjs**

把现在的 200 行命令式 CLI 改成"导出函数 + import.meta.url guard"形式。完整改后的 `scripts/format-chat.mjs`:

```js
#!/usr/bin/env node
// format-chat.mjs
// 按终端宽度对 .md 报告中诊断结果 pipe table 的 cell 内容重新折行。
// 表结构(6 列)不变,只调整 <br> 位置使总宽 ≤ 终端列数。
// 火焰图段、头尾文字原样透传。
//
// 导出函数(供测试 / 外部调用):
//   rewrapTable(content, cols) → 重排后的全文
//   parseCells(line)           → cell 数组
//   buildRow(cells)            → 表行字符串
//   displayWidth(str)          → 显示宽度
//
// CLI 用法:
//   node scripts/format-chat.mjs --chat <chat.md> [--cols N]

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ── CJK 显示宽度 ─────────────────────────────────────────
export function charWidth(cp) {
  // [现有 charWidth 函数完整复制 · 不改一字]
  // 现在 format-chat.mjs L39-L63 的内容
  if (cp >= 0x1100 && (
    cp <= 0x115f ||
    cp === 0x2329 || cp === 0x232a ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x20000 && cp <= 0x2fffd) ||
    (cp >= 0x30000 && cp <= 0x3fffd)
  )) return 2;
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
  // [现有 rewrapCell 函数完整复制 · 不改一字]
  const noBr = text.replace(/<br>/g, " ");
  const chars = [...noBr];
  const out = [];
  let line = "";
  let lineWidth = 0;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const cw = charWidth(c.codePointAt(0));
    if (lineWidth + cw > budget && line.length > 0) {
      let breakAt = -1;
      for (let j = line.length - 1; j >= Math.max(0, line.length - budget); j--) {
        if (BREAK_CHARS.has(line[j])) { breakAt = j; break; }
      }
      if (breakAt >= 0) {
        out.push(line.slice(0, breakAt + 1).trimEnd());
        line = line.slice(breakAt + 1) + c;
        lineWidth = displayWidth(line);
      } else {
        out.push(line);
        line = c;
        lineWidth = cw;
      }
    } else {
      line += c;
      lineWidth += cw;
    }
  }
  if (line) out.push(line);
  return out.join("<br>");
}

// ── 解析 pipe table ──────────────────────────────────────
export function parseCells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
  return trimmed.slice(1, -1).split("|").map(c => c.trim());
}

export function buildRow(cells) {
  return "| " + cells.join(" | ") + " |";
}

// ── 表格重排 ─────────────────────────────────────────────
export function rewrapTable(content, cols) {
  const lines = content.split("\n");
  const budget = Math.max(Math.floor((cols - 7) / 6), 8);

  let tableStart = -1, sepLine = -1, tableEnd = -1;

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

  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (i >= sepLine + 1 && i < tableEnd) {
      const cells = parseCells(lines[i]);
      const rewrapped = cells.map(c => rewrapCell(c, budget));
      out.push(buildRow(rewrapped));
    } else {
      out.push(lines[i]);
    }
  }
  return { content: out.join("\n"), found: true };
}

// ── CLI ──────────────────────────────────────────────────
const isCli = process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isCli) {
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
  const { content: rewrapped, found } = rewrapTable(content, cols);
  if (!found) {
    console.error("⚠ 未找到 ## 诊断结果 pipe table");
    process.stdout.write(content);
    process.exit(2);
  }

  process.stdout.write(rewrapped);
}
```

**关键变化清点(避免误读)**:
- 所有函数加 `export`
- `rewrapCell`、`parseCells`、`buildRow`、`displayWidth` 函数体不变(就是搬位置)
- 主逻辑包成 `rewrapTable(content, cols) → { content, found }` 函数
- CLI 部分(`const args = process.argv.slice(2)` 起)整体包进 `if (isCli)` block
- `isCli` 用 `fileURLToPath(import.meta.url) === process.argv[1]` 判定(跨平台稳)

- [ ] **Step 3: 跑现有测试,确认无回归**

```bash
npm run test:perf-kp-sql
```

预期:Step 1 记的全部 PASS · 未 PASS 项 = 0。

- [ ] **Step 4: 手动 smoke test CLI**

构造一个 tmp .md 文件,跑 format-chat.mjs 看输出是否和 refactor 前一致。

```bash
cat > /tmp/smoke.md <<'EOF'
# perf-kp-sql · 性能诊断报告

## 诊断结果

| 确认的根因 | 判定依据 | 建议措施 | 风险等级 | 置信度 | 参考来源 |
|---|---|---|---|---|---|
| WT eviction<br>dirty_target<br>与负载不匹配 | cache used=94.7%<br>接近阈值 95% | 调低 target=3% | high | 高 | [参考1] |
EOF
node plugins/perf-kp-sql/scripts/format-chat.mjs --chat /tmp/smoke.md --cols 100
```

预期:exit code 0 · stdout 是重排后的报告 · 表格结构保持。

- [ ] **Step 5: bump 版本**

```bash
sed -i.bak 's/"version": "0.37.2"/"version": "0.37.3"/' plugins/perf-kp-sql/.claude-plugin/plugin.json plugins/perf-kp-sql/.codex-plugin/plugin.json
rm plugins/perf-kp-sql/.claude-plugin/plugin.json.bak plugins/perf-kp-sql/.codex-plugin/plugin.json.bak
```

- [ ] **Step 6: commit**

```bash
git add plugins/perf-kp-sql/scripts/format-chat.mjs plugins/perf-kp-sql/.claude-plugin/plugin.json plugins/perf-kp-sql/.codex-plugin/plugin.json
git commit -m "$(cat <<'EOF'
refactor(perf-kp-sql): format-chat.mjs 拆出 export 函数 + CLI guard · 0.37.2 → 0.37.3

把命令式 CLI 包进 import.meta.url guard · 主逻辑抽成 rewrapTable(content, cols)
函数 · parseCells/buildRow/rewrapCell/displayWidth/charWidth 全 export · 为后续
加 lintReport / stripChatTags 单元测试做准备。

无用户可见行为变化(CLI smoke test 通过 · 现有 test:perf-kp-sql 全 PASS) ·
patch bump。
EOF
)"
```

---

## Task 2: TDD 加 lintReport()

**目的:** 实现 spec §"验证机制 1"中的 `format-chat.mjs` lint pass。扫 `.md` 报告,统计漏挂率,> 5% → exit 2 + stderr 列出前 10 个漏挂位置。

**Files:**
- Modify: `plugins/perf-kp-sql/scripts/format-chat.mjs`(加 `lintReport` 函数 + CLI 整合)
- Create: `plugins/perf-kp-sql/tests/format-chat-lint.test.ts`
- Modify: `package.json`(repo root)— `test:perf-kp-sql` 脚本加 lint 测试文件
- Modify: `plugins/perf-kp-sql/.claude-plugin/plugin.json`(0.37.3 → 0.38.0)
- Modify: `plugins/perf-kp-sql/.codex-plugin/plugin.json`(同上)

- [ ] **Step 1: 写 lint 测试 fixture(失败用)**

新建 `plugins/perf-kp-sql/tests/format-chat-lint.test.ts`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lintReport } from "../scripts/format-chat.mjs";

const FULL_REPORT_OK = `# perf-kp-sql · 性能诊断报告

- 诊断时间:2026-05-01 10:00
- 目标主机:10.0.0.1 · root · port=22 · engine=mongo

## 来源标记 (debug)

| 标记 | 含义 |
|---|---|
| \`[IDX]\` | cases/INDEX.md |
| \`[KB]\`  | cases/KB.md |

## 诊断结果

| 确认的根因 | 判定依据 | 建议措施 | 风险等级 | 置信度 | 参考来源 |
|---|---|---|---|---|---|
| WT eviction [KB] | cache=94.7% [OBS] | 调 target=3% [LLM] | high [LLM] | 高 [LLM] | [参考1] |

## 参考

[参考1] WiredTiger Tuning — source.wiredtiger.com [KB]
        https://source.wiredtiger.com/mongodb-6.0/tune_cache.html
`;

const FULL_REPORT_MISSING = `# perf-kp-sql · 性能诊断报告

## 诊断结果

| 确认的根因 | 判定依据 | 建议措施 | 风险等级 | 置信度 | 参考来源 |
|---|---|---|---|---|---|
| WT eviction | cache=94.7% | 调 target=3% | high | 高 | [参考1] |
`;

describe("lintReport", () => {
  it("空文档 → 0 atoms / 0 missing / missRate=0", () => {
    const r = lintReport("");
    assert.equal(r.total, 0);
    assert.equal(r.missing.length, 0);
    assert.equal(r.missRate, 0);
  });

  it("全 5 标签报告 → missRate=0", () => {
    const r = lintReport(FULL_REPORT_OK);
    assert.equal(r.missRate, 0);
  });

  it("整张表全漏 → 每个 cell 都被记为 missing", () => {
    const r = lintReport(FULL_REPORT_MISSING);
    assert.ok(r.total >= 5, `expected ≥ 5 atoms, got ${r.total}`);
    assert.ok(r.missing.length >= 5, `expected ≥ 5 missing, got ${r.missing.length}`);
    assert.ok(r.missRate > 0.5);
  });

  it("legend 段 lint 豁免", () => {
    const md = `# title

## 来源标记 (debug)

| 标记 | 含义 |
|---|---|
| \`[IDX]\` | cases/INDEX.md |
| \`[KB]\`  | cases/KB.md(无标签 不该报错) |

## 诊断结果

| a | b | c | d | e | f |
|---|---|---|---|---|---|
| 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | [参考1] |
`;
    const r = lintReport(md);
    assert.equal(r.missRate, 0);
  });

  it("参考段 lint 豁免", () => {
    const md = `# title

## 诊断结果

| a | b | c | d | e | f |
|---|---|---|---|---|---|
| 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | [参考1] |

## 参考

[参考1] 标题 — domain (这里没标签 不该报错)
        https://example.com
`;
    const r = lintReport(md);
    assert.equal(r.missRate, 0);
  });

  it("code fence 内容 lint 豁免", () => {
    const md = `# title

## 诊断结果

| a | b | c | d | e | f |
|---|---|---|---|---|---|
| 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | [参考1] |

## 火焰图分析

\`\`\`
random text without tags
more lines without tags
\`\`\`
`;
    const r = lintReport(md);
    assert.equal(r.missRate, 0);
  });

  it("blockquote 行豁免", () => {
    const md = `# title

## 现场观测

> 以下根因未经权威背书 · 仅供参考:

- 事实 1 [OBS]
`;
    const r = lintReport(md);
    assert.equal(r.missRate, 0);
  });

  it("表格 cell 中 ` · ` 分隔的 sub-atom 各自检查", () => {
    const md = `# title

## 诊断结果

| a | b | c | d | e | f |
|---|---|---|---|---|---|
| cache=94% [OBS] · 阈=95% [KB] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | [参考1] |
`;
    const r = lintReport(md);
    assert.equal(r.missRate, 0);
  });

  it("表格 cell 中 ` · ` 分隔的某个 sub-atom 漏标 → 计入 missing", () => {
    const md = `# title

## 诊断结果

| a | b | c | d | e | f |
|---|---|---|---|---|---|
| cache=94% · 阈=95% [KB] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | [参考1] |
`;
    const r = lintReport(md);
    assert.ok(r.missing.length >= 1);
    assert.ok(r.missing[0].text.includes("cache=94%"));
  });

  it("missing 列表给出 line 号 + 文本片段", () => {
    const r = lintReport(FULL_REPORT_MISSING);
    assert.ok(r.missing[0].line > 0);
    assert.ok(typeof r.missing[0].text === "string");
    assert.ok(r.missing[0].text.length > 0);
  });

  it("[OBS][参考3] 紧挨写法被识别为已挂标签", () => {
    const md = `# title

## 诊断结果

| a | b | c | d | e | f |
|---|---|---|---|---|---|
| cache=94% [OBS][参考3] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | [参考1] |
`;
    const r = lintReport(md);
    assert.equal(r.missRate, 0);
  });

  it("[OBS] [参考3] 中间空格写法被识别为已挂标签", () => {
    const md = `# title

## 诊断结果

| a | b | c | d | e | f |
|---|---|---|---|---|---|
| cache=94% [OBS] [参考3] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | [参考1] |
`;
    const r = lintReport(md);
    assert.equal(r.missRate, 0);
  });
});
```

- [ ] **Step 2: 跑测试,确认全部 FAIL("lintReport is not a function")**

```bash
node --import tsx --test plugins/perf-kp-sql/tests/format-chat-lint.test.ts
```

预期:全部测试 FAIL · 错误信息含 `lintReport is not a function` 或类似。

- [ ] **Step 3: 实现 lintReport**

在 `scripts/format-chat.mjs` 顶部 import 之后、`charWidth` 之前插入:

```js
// ── Lint(5 标签来源标记验证) ──────────────────────────
// 参见 docs/superpowers/specs/2026-05-01-md-report-source-tags-design.md

const TAG_AT_END_RE = /\[(IDX|KB|NLM|OBS|LLM)\]\s*(\[参考\d+\])?\s*$/;

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
      // 句末标点切分
      const sentences = trimmed.split(/[。;?!:]/);
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
```

- [ ] **Step 4: 跑测试,确认全部 PASS**

```bash
node --import tsx --test plugins/perf-kp-sql/tests/format-chat-lint.test.ts
```

预期:所有测试 PASS。如果有 FAIL · 看哪条 expectation 没满足 · 修 lintReport 而不是改测试。

- [ ] **Step 5: 把 lint 整合进 CLI**

在 `format-chat.mjs` 的 `if (isCli) { ... }` block 内,改原 CLI 主体为:

```js
if (isCli) {
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
    process.exit(2);
  }

  process.stdout.write(rewrapped);
}
```

- [ ] **Step 6: 把新测试文件加进 npm test 脚本**

`package.json`(repo root)的 `test:perf-kp-sql` 脚本末尾加入新测试文件:

修改前:
```json
"test:perf-kp-sql": "node --import tsx --test plugins/perf-kp-sql/tests/cli-ssh.test.ts plugins/perf-kp-sql/tests/kb/index-integrity.test.ts plugins/perf-kp-sql/tests/kb/golden-validity.test.ts",
```

修改后:
```json
"test:perf-kp-sql": "node --import tsx --test plugins/perf-kp-sql/tests/cli-ssh.test.ts plugins/perf-kp-sql/tests/kb/index-integrity.test.ts plugins/perf-kp-sql/tests/kb/golden-validity.test.ts plugins/perf-kp-sql/tests/format-chat-lint.test.ts",
```

- [ ] **Step 7: 跑 full test suite,确认无回归**

```bash
npm run test:perf-kp-sql
```

预期:全部 PASS · 包括新增的 lint 测试。

- [ ] **Step 8: CLI smoke test - lint 触发场景**

```bash
cat > /tmp/smoke-fail.md <<'EOF'
# perf-kp-sql · 性能诊断报告

## 诊断结果

| 确认的根因 | 判定依据 | 建议措施 | 风险等级 | 置信度 | 参考来源 |
|---|---|---|---|---|---|
| WT eviction | cache=94.7% | 调 target=3% | high | 高 | [参考1] |
EOF
node plugins/perf-kp-sql/scripts/format-chat.mjs --chat /tmp/smoke-fail.md --cols 100
echo "exit code: $?"
```

预期:
- exit code 2
- stderr 含 `✗ 来源标签 lint 失败 · 漏挂率`
- stderr 列出前 10 个漏挂位置(每行 `L<n>: <text>`)

```bash
cat > /tmp/smoke-pass.md <<'EOF'
# perf-kp-sql · 性能诊断报告

## 诊断结果

| 确认的根因 | 判定依据 | 建议措施 | 风险等级 | 置信度 | 参考来源 |
|---|---|---|---|---|---|
| WT eviction [KB] | cache=94.7% [OBS] | 调 target=3% [LLM] | high [LLM] | 高 [LLM] | [参考1] |
EOF
node plugins/perf-kp-sql/scripts/format-chat.mjs --chat /tmp/smoke-pass.md --cols 100
echo "exit code: $?"
```

预期:exit code 0,stdout 为 rewrap 后的全文。

- [ ] **Step 9: bump 版本(minor:加新功能)**

```bash
sed -i.bak 's/"version": "0.37.3"/"version": "0.38.0"/' plugins/perf-kp-sql/.claude-plugin/plugin.json plugins/perf-kp-sql/.codex-plugin/plugin.json
rm plugins/perf-kp-sql/.claude-plugin/plugin.json.bak plugins/perf-kp-sql/.codex-plugin/plugin.json.bak
```

- [ ] **Step 10: commit**

```bash
git add plugins/perf-kp-sql/scripts/format-chat.mjs plugins/perf-kp-sql/tests/format-chat-lint.test.ts package.json plugins/perf-kp-sql/.claude-plugin/plugin.json plugins/perf-kp-sql/.codex-plugin/plugin.json
git commit -m "$(cat <<'EOF'
feat(perf-kp-sql): format-chat.mjs 加 lintReport · 漏挂 > 5% exit 2 · 0.37.3 → 0.38.0

按 spec(2026-05-01-md-report-source-tags-design)实现 §"验证机制 1":

- 新增 lintReport(mdText) 纯函数 · 扫报告所有原子位置 · 检测是否挂
  [IDX]/[KB]/[NLM]/[OBS]/[LLM] 五选一标签
- 豁免:legend 段 / 参考段 / code fence / blockquote / 元数据块 /
  表头行 / 短碎片(< 4 字符)
- 表格 cell 内按 <br> 切 sub-line · 内含 ` · ` 时再切 sub-atom · 各自检查
- 漏挂率 > 5% → exit 2 + stderr 列出前 10 个漏挂位置(行号 + 文本片段)
- 12 个 unit test 覆盖各 fixture 路径

新功能 · minor bump。
EOF
)"
```

---

## Task 3: TDD 加 stripChatTags()

**目的:** 实现 spec §"验证机制 2 · Step 1":输出 chat 文本前正则剥掉 5 标签 + 删除 legend 段(`.md` 文件本身不动)。

**Files:**
- Modify: `plugins/perf-kp-sql/scripts/format-chat.mjs`(加 `stripChatTags` 函数 + CLI 整合)
- Create: `plugins/perf-kp-sql/tests/format-chat-strip.test.ts`
- Modify: `package.json`(repo root)— `test:perf-kp-sql` 加 strip 测试文件
- Modify: `plugins/perf-kp-sql/.claude-plugin/plugin.json`(0.38.0 → 0.39.0)
- Modify: `plugins/perf-kp-sql/.codex-plugin/plugin.json`(同上)

- [ ] **Step 1: 写 strip 测试**

新建 `plugins/perf-kp-sql/tests/format-chat-strip.test.ts`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stripChatTags } from "../scripts/format-chat.mjs";

describe("stripChatTags", () => {
  it("移除单个 inline tag", () => {
    assert.equal(stripChatTags("事实 [OBS]"), "事实");
  });

  it("移除多种 tag", () => {
    const input = "WT eviction [KB]<br>cache=94% [OBS]";
    assert.equal(stripChatTags(input), "WT eviction<br>cache=94%");
  });

  it("[OBS][参考3] 紧挨 → 只剥 [OBS]", () => {
    assert.equal(stripChatTags("事实 [OBS][参考3]"), "事实 [参考3]");
  });

  it("[OBS] [参考3] 中间空格 → 只剥 [OBS]", () => {
    assert.equal(stripChatTags("事实 [OBS] [参考3]"), "事实 [参考3]");
  });

  it("[KB] [参考1] 也剥 [KB]", () => {
    assert.equal(stripChatTags("[参考1] 标题 — domain [KB]"), "[参考1] 标题 — domain");
  });

  it("移除整段 ## 来源标记 (debug) section", () => {
    const input = `# title

## 来源标记 (debug)

| 标记 | 含义 |
|---|---|
| \`[IDX]\` | cases/INDEX.md |
| \`[KB]\`  | cases/KB.md |

## 诊断结果

| a |
|---|
| 事实 [OBS] |
`;
    const out = stripChatTags(input);
    assert.ok(!out.includes("## 来源标记"));
    assert.ok(!out.includes("cases/INDEX.md"));
    assert.ok(out.includes("## 诊断结果"));
    assert.ok(out.includes("事实"));
    assert.ok(!out.includes("[OBS]"));
  });

  it("legend 在文件末尾(无后续 ## )也能正确移除", () => {
    const input = `# title

## 诊断结果

table

## 来源标记 (debug)

| 标记 | 含义 |
|---|---|
| \`[KB]\` | cases/KB.md |
`;
    const out = stripChatTags(input);
    assert.ok(!out.includes("## 来源标记"));
    assert.ok(out.includes("## 诊断结果"));
  });

  it("无 tag 文本不被改动", () => {
    const input = "纯文本 没有标签 应该原样\n第二行";
    assert.equal(stripChatTags(input), input);
  });

  it("不该把 [参考N] 误剥", () => {
    const input = "事实 [参考3]";
    assert.equal(stripChatTags(input), "事实 [参考3]");
  });

  it("剥后留下的双空格被压成单空格", () => {
    const input = "事实 [OBS] · 阈=95% [KB]";
    assert.equal(stripChatTags(input), "事实 · 阈=95%");
  });
});
```

- [ ] **Step 2: 跑测试,确认全部 FAIL("stripChatTags is not a function")**

```bash
node --import tsx --test plugins/perf-kp-sql/tests/format-chat-strip.test.ts
```

预期:全部 FAIL。

- [ ] **Step 3: 实现 stripChatTags**

在 `scripts/format-chat.mjs` 的 `lintReport` 之后插入:

```js
// ── Strip(chat 输出剥标签 · .md 文件不动) ──────────────
// 参见 docs/superpowers/specs/2026-05-01-md-report-source-tags-design.md §"验证机制 2 Step 1"

export function stripChatTags(text) {
  let out = text;

  // 1. 删除 ## 来源标记 (debug) 段(从该标题起 · 到下一个 ## 前 · 或文件末尾)
  out = out.replace(
    /(?:^|\n)## 来源标记 \(debug\)[\s\S]*?(?=\n## |$)/,
    ""
  );

  // 2. 移除所有 5 标签字面 + 前导空白(避免留下双空格)
  out = out.replace(/[ \t]*\[(IDX|KB|NLM|OBS|LLM)\]/g, "");

  // 3. 清理 ` · ` 前后空一边(类似 "事实  · 阈=95%" → "事实 · 阈=95%")
  out = out.replace(/  +/g, " ");

  return out;
}
```

- [ ] **Step 4: 跑测试,确认全部 PASS**

```bash
node --import tsx --test plugins/perf-kp-sql/tests/format-chat-strip.test.ts
```

预期:所有测试 PASS。如果某条 FAIL · 看 expectation 与实际差在哪 · 调 stripChatTags 实现。

- [ ] **Step 5: 把 strip 整合进 CLI**

把 CLI 主体的最后写 stdout 那段改成:

修改前:
```js
process.stdout.write(rewrapped);
```

修改后:
```js
const stripped = stripChatTags(rewrapped);
process.stdout.write(stripped);
```

- [ ] **Step 6: 把新测试文件加进 npm test 脚本**

`package.json`(repo root)的 `test:perf-kp-sql` 脚本末尾再加:

修改前(Task 2 之后):
```json
"test:perf-kp-sql": "node --import tsx --test plugins/perf-kp-sql/tests/cli-ssh.test.ts plugins/perf-kp-sql/tests/kb/index-integrity.test.ts plugins/perf-kp-sql/tests/kb/golden-validity.test.ts plugins/perf-kp-sql/tests/format-chat-lint.test.ts",
```

修改后:
```json
"test:perf-kp-sql": "node --import tsx --test plugins/perf-kp-sql/tests/cli-ssh.test.ts plugins/perf-kp-sql/tests/kb/index-integrity.test.ts plugins/perf-kp-sql/tests/kb/golden-validity.test.ts plugins/perf-kp-sql/tests/format-chat-lint.test.ts plugins/perf-kp-sql/tests/format-chat-strip.test.ts",
```

- [ ] **Step 7: 跑 full test suite,确认无回归**

```bash
npm run test:perf-kp-sql
```

预期:全部 PASS。

- [ ] **Step 8: CLI smoke test — chat 输出无标签**

用 Task 2 Step 8 的 smoke-pass.md(已挂全标签):

```bash
node plugins/perf-kp-sql/scripts/format-chat.mjs --chat /tmp/smoke-pass.md --cols 100 | grep -E "\[(OBS|KB|NLM|IDX|LLM)\]"
echo "grep exit code: $?"
```

预期:
- grep exit code 1(没找到 = chat 输出已剥光 5 标签)
- 如果 grep exit code 0 = 仍有标签残留 = bug

```bash
node plugins/perf-kp-sql/scripts/format-chat.mjs --chat /tmp/smoke-pass.md --cols 100 | grep "## 来源标记"
echo "grep exit code: $?"
```

预期:grep exit code 1(没找到 = legend 段已删)。

- [ ] **Step 9: bump 版本(minor)**

```bash
sed -i.bak 's/"version": "0.38.0"/"version": "0.39.0"/' plugins/perf-kp-sql/.claude-plugin/plugin.json plugins/perf-kp-sql/.codex-plugin/plugin.json
rm plugins/perf-kp-sql/.claude-plugin/plugin.json.bak plugins/perf-kp-sql/.codex-plugin/plugin.json.bak
```

- [ ] **Step 10: commit**

```bash
git add plugins/perf-kp-sql/scripts/format-chat.mjs plugins/perf-kp-sql/tests/format-chat-strip.test.ts package.json plugins/perf-kp-sql/.claude-plugin/plugin.json plugins/perf-kp-sql/.codex-plugin/plugin.json
git commit -m "$(cat <<'EOF'
feat(perf-kp-sql): format-chat.mjs 加 stripChatTags · chat 输出剥 5 标签 · 0.38.0 → 0.39.0

按 spec(2026-05-01-md-report-source-tags-design)实现 §"验证机制 2 · Step 1":

- 新增 stripChatTags(text) 纯函数 · 用于 chat 输出剥离
  - 删除 ## 来源标记 (debug) 整段(legend)
  - 删除所有 [IDX]/[KB]/[NLM]/[OBS]/[LLM] 字面 + 前导空白
  - 压缩残留双空格
- CLI 流程:lintReport → rewrapTable → stripChatTags → 写 stdout
- .md 文件本身不被任何写入操作触碰 · 剥离只在输出流
- 10 个 unit test 覆盖单 tag / 多 tag / [参考N] 共存 / legend 段 / 边界情形

新功能 · minor bump。
EOF
)"
```

---

## Task 4: 更新 SKILL.md(Phase 5.2 + 5.4 + 参考 格式)

**目的:** 把 spec §"5 标签集" / §"标签放置规则" / §"Legend" / §"`## 参考` 段对齐" / §"验证机制 1" 落到 SKILL.md。Phase 5.2 加新 sub-section 与示例,Phase 5.4 加 lint exit 2 处置流程,参考段格式改方括号。

**Files:**
- Modify: `plugins/perf-kp-sql/skills/perf-kp-sql/SKILL.md`(L910-L990 区域,Phase 5.2 + Phase 5.4 + 参考格式规范)
- Modify: `plugins/perf-kp-sql/.claude-plugin/plugin.json`(0.39.0 → 0.40.0)
- Modify: `plugins/perf-kp-sql/.codex-plugin/plugin.json`(同上)

无新测试文件——SKILL.md 改动是自然语言 LLM doctrine。但 Step 5 跑 lint 校验"SKILL.md 里的报告骨架示例"自身合规作为冒烟测试。

- [ ] **Step 1: Phase 5.2 报告骨架更新**

打开 `plugins/perf-kp-sql/skills/perf-kp-sql/SKILL.md`,定位到 `### 5.2 · 写 markdown 报告` 下面的 `#### 报告骨架` 段(L939 附近)。

把现有报告骨架(L941-L973)整段替换成:

```markdown
\`\`\`markdown
# perf-kp-sql · 性能诊断报告

- 诊断时间:<本地时间>
- 目标主机:<ip> · <user> · port=<port> · engine=<engine>
- 环境:<os_distro> <kernel> · <arch> · <cpu_model> · <mongod_version> · <deploy_form>

## 来源标记 (debug)

| 标记 | 含义 |
|---|---|
| `[IDX]` | cases/INDEX.md(路由命中) |
| `[KB]`  | cases/KB.md / best-practice/KB.md(字段 verbatim) |
| `[NLM]` | NotebookLM 答复(query / query-batch references) |
| `[OBS]` | 现场 SSH 采集(Phase 3 命令 stdout 提取) |
| `[LLM]` | 模型自由推断 / 连接性叙述(无 KB/NLM/IDX/OBS 兜底) |

## 诊断结果

| 确认的根因 | 判定依据 | 建议措施 | 风险等级 | 置信度 | 参考来源 |
|---|---|---|---|---|---|
| WT eviction [KB]<br>dirty_target [KB]<br>与负载不匹配 [LLM] | cache used=94.7% [OBS]<br>接近阈值 95% [KB]<br>dirty ratio=18% [OBS]<br>远超 target 5% [KB] | 调低 target=3% [LLM]:<br>`db.adminCommand(…)` [KB] | high [LLM] | 高 [LLM] | [参考1] |
| vm.swappiness [KB]<br>过高 [LLM] | 当前值=60 [OBS]<br>KB 推荐=1 [KB]<br>NLM 确认=1 [NLM] | `sysctl -w` [KB]<br>`vm.swappiness=1` [KB]<br>写入 sysctl.conf [LLM] | warning [LLM] | 中 [LLM] | [参考2] |

## 火焰图分析(若 Phase 3.A.3 采到)

(此处插入 capture-flamegraph.mjs 输出的 Top-N 文本块 · 用 markdown 缩进代码块或 ~~~ 围栏避免跟外层 \`\`\`markdown 围栏冲突)

## 现场观测(无权威来源 · 仅供参考 · 可选段 · 仅 KB 和 NLM 都无背书的根因才进这里)

> 以下根因基于现场指标观测 · 但 KB 和 NotebookLM 均无对应权威文档背书 · 请独立验证后再采取行动:

- **stress_test.cpu_burn 集合上 4 个并发 \$where JS 跑三角函数烧 CPU** [OBS]:db.currentOp 抓到 4 个 active query [OBS] · planSummary=COLLSCAN [OBS] · runtime 52-500s [OBS] · 客户端 127.0.0.1 [OBS]
  - 建议措施:`db.currentOp({active:true,ns:"stress_test.cpu_burn"}).inprog.forEach(op => db.adminCommand({killOp:1, op:op.opid}))` 立即止损 [LLM] · 排查发起方 [LLM] · 改写为可索引查询(凭经验·非权威) [LLM]
  - 现场证据:`<贴 currentOp 输出片段>` [OBS]

## 参考

[参考1] WiredTiger Tuning — source.wiredtiger.com [KB]
        https://source.wiredtiger.com/mongodb-6.0/tune_cache.html
[参考2] vm.swappiness 内核参数 — kernel.org [NLM]
        https://www.kernel.org/doc/Documentation/sysctl/vm.txt
\`\`\`
```

- [ ] **Step 2: Phase 5.2 加"5 标签来源标记(强制)"sub-section**

在 `#### 报告骨架` 段**之前**(也就是 L939 `#### 报告骨架` 那行之前)插入:

```markdown
#### 5 标签来源标记(强制)

每份报告**必须**带一段 `## 来源标记 (debug)` legend(放在报告元数据后、`## 诊断结果` 前 · 见骨架),并在正文每个**原子事实**末尾挂 1 个 5 选 1 标签:

| 标签 | 触发(严格) |
|---|---|
| `[IDX]` | case_id 命中、现象→case 归类、tier 标签 |
| `[KB]`  | likely_causes / mechanism_quote / abnormal_pattern_threshold / source_url / 诊断命令本身 — 来自 cases/KB.md 或 best-practice/KB.md 字段 verbatim |
| `[NLM]` | NotebookLM stdout JSON 的 references[].source_id 或答复正文 |
| `[OBS]` | Phase 3 SSH 命令 stdout 提取的实测值(cache used=94.7% / vm.swappiness=60 之类) |
| `[LLM]` | 模型自由推断 · 连接性叙述 · 排序与汇总 — 上面 4 类均无兜底时**必挂** |

**核心规则**:每个原子事实(一个不可再分的断言:实测值 / 阈值 / 比较结论 / 一条命令 / 一个判定)**有且只有 1 个**标签 · 5 选 1 · 不允许联合标签(`[OBS+KB]` 禁止) · 不允许漏挂(凡是模型自由发挥都挂 `[LLM]`)。

**多源拆句**:如果一句话/一行混了两类来源(例 "cache=94.7%(OBS)接近阈值 95%(KB)"),**必须拆成两个原子**,各挂各的标签:
```
cache used=94.7% [OBS]<br>接近阈值 95% [KB]
```

**`[参考N]` 角标共存**:`[参考N]` 是脚注引用 · 不算来源标签 · 可与 5 标签共存:
```
cache used=94.7% [OBS][参考3]
```

**正例**(诊断依据 cell · 4 个 `<br>` 行 · 每行一个原子 · 各挂标签):
```
cache used=94.7% [OBS]<br>接近阈值 95% [KB]<br>dirty ratio=18% [OBS]<br>远超 target 5% [KB]
```

**反例 1**(漏挂):
```
cache used=94.7%<br>接近阈值 95%<br>dirty ratio=18%<br>远超 target 5%
```
↑ 全没挂 · `format-chat.mjs` 会把整 cell 4 行都计为 missing · 漏挂率 100% · exit 2 强制重写。

**反例 2**(联合标签):
```
cache used=94.7%<br>接近阈值 95% [OBS+KB]
```
↑ `[OBS+KB]` 不存在 · 必须拆成两行各挂各的。

**风险等级 / 置信度** 列内容本身就一个词(`high` / `高`),cell 末尾挂 `[LLM]`(主观判定):
```
| ... | ... | ... | high [LLM] | 高 [LLM] | [参考1] |
```

**参考来源** 列只放 `[参考N]` 角标,不挂 5 标签(URL 来源在 `## 参考` 段已标)。

**Self-check(写完报告后必须):**
- 表格 `## 诊断结果` 每个 cell 内每个 `<br>` 行末尾(或 ` · ` 切出来的每个 sub-atom)是否各挂 1 个标签?
- `## 现场观测` 段每个原子事实(一个 bullet · 一个句子 · 一段命令)是否各挂 1 个标签?
- `## 参考` 段每条引用第 1 行末尾是否挂了 `[KB]` 或 `[NLM]`?
- legend 段(`## 来源标记 (debug)`)是否就在元数据后、诊断结果前的位置?

漏挂会被 Phase 5.4 的 `format-chat.mjs --chat` lint 抓到 · exit 2 强制重写。设计参考:`docs/superpowers/specs/2026-05-01-md-report-source-tags-design.md`。
```

- [ ] **Step 3: 改"`## 参考` 段格式规范"小节(L975-L989 附近)**

定位 `**`## 参考` 段格式规范**` 那段。把:

```markdown
**来源标签**:
- `(KB)` — 来自 KB.md case 的 `source_url` 字段
- `(NLM)` — 来自 NotebookLM 返回的 `references[].source_id`
```

改成:

```markdown
**来源标签**(与正文 5 标签系统对齐 · 一律方括号):
- `[KB]` — 来自 KB.md case 的 `source_url` 字段
- `[NLM]` — 来自 NotebookLM 返回的 `references[].source_id`
```

且把同小节里 `[参考N] <标题> — <domain> (<来源标签>)` 字面例子改成:

```markdown
- 第 1 行:`[参考N] <标题> — <domain> [<来源标签>]`
```

- [ ] **Step 4: Phase 5.4 加 lint exit 2 处置**

定位 Phase 5.4(L1049 附近,`### 5.4 · session-close + chat 输出格式化报告`),找到调用 `format-chat.mjs` 的"步骤 1"那块(L1060-L1075 附近)。

在 Bash 调用块**之后**加一段:

```markdown
**format-chat.mjs lint 失败处置(exit code = 2):**

`format-chat.mjs` 调用前会先跑 5 标签来源标记 lint。如果 stderr 出现:
```
✗ 来源标签 lint 失败 · 漏挂率 X.X% (M/N)
  Spec: docs/superpowers/specs/2026-05-01-md-report-source-tags-design.md
  前 10 个漏挂位置:
    L<n>: <文本片段>
    ...
```
且 exit code = 2 → **必须**回 Phase 5.2 把每个被列出的漏挂位置补挂标签 · 重写 `.md` 报告 · 然后再调一次 `format-chat.mjs --chat`。**不许**忽略告警继续往 chat 输出 · **不许**手动剥 stderr 自己拼 chat。

5 标签规范见 Phase 5.2 "5 标签来源标记(强制)" sub-section。
```

- [ ] **Step 5: 跑 lint 校验报告骨架本身合规**

把 SKILL.md 报告骨架例子(Step 1 你刚改的那段 \`\`\`markdown ... \`\`\` 围栏内的内容)拷到 `/tmp/skill-skeleton.md`(去掉外层围栏 · 保留所有 `<br>` / `[KB]` / `[OBS]` 字面)。

然后跑:

```bash
node plugins/perf-kp-sql/scripts/format-chat.mjs --chat /tmp/skill-skeleton.md --cols 100
echo "exit code: $?"
```

预期:
- exit code 0(说明骨架例子本身已符合 5 标签规范 · lint 通过)
- stdout 是 rewrap + 剥过 5 标签 + 删了 legend 的 chat 文本

如果 exit code = 2(lint 失败) · 看 stderr 列出的漏挂位置 · 回 Step 1 把骨架例子里漏挂的标签补上 · 重跑。

> 注意:这里复用 CLI 等同于完整跑一遍 lint + rewrap + strip 三步 pipeline · 是最贴近真实使用的端到端冒烟测试。

- [ ] **Step 6: 跑 full test suite,确认无回归**

```bash
npm run test:perf-kp-sql
```

预期:全部 PASS。

- [ ] **Step 7: bump 版本(minor:LLM 行为契约变更)**

```bash
sed -i.bak 's/"version": "0.39.0"/"version": "0.40.0"/' plugins/perf-kp-sql/.claude-plugin/plugin.json plugins/perf-kp-sql/.codex-plugin/plugin.json
rm plugins/perf-kp-sql/.claude-plugin/plugin.json.bak plugins/perf-kp-sql/.codex-plugin/plugin.json.bak
```

- [ ] **Step 8: commit**

```bash
git add plugins/perf-kp-sql/skills/perf-kp-sql/SKILL.md plugins/perf-kp-sql/.claude-plugin/plugin.json plugins/perf-kp-sql/.codex-plugin/plugin.json
git commit -m "$(cat <<'EOF'
feat(perf-kp-sql): SKILL.md 加 5 标签来源标记硬规则 + lint 处置 · 0.39.0 → 0.40.0

按 spec(2026-05-01-md-report-source-tags-design)落 LLM doctrine:

- Phase 5.2 加 "5 标签来源标记(强制)" sub-section · 5 标签触发条件表 ·
  正反例 · self-check 4 条
- Phase 5.2 报告骨架例子加 ## 来源标记 (debug) legend · 表格每个 cell
  挂标签 · 现场观测段 bullet 每句挂标签 · 参考段从圆括号改方括号
- Phase 5.4 加 format-chat.mjs lint exit 2 处置("必须回 5.2 重写"硬规则)
- ## 参考 段格式规范小节:(KB)/(NLM) → [KB]/[NLM] · 全报告一套字面

LLM 行为契约变更 · minor bump。
EOF
)"
```

---

## Self-Review

**1. Spec coverage scan**(逐节验证):

- spec §"5 标签集" → Task 4 Step 2(SKILL.md 5 标签触发条件表) ✓
- spec §"标签放置规则 · 表格 cell" → Task 4 Step 2(正反例)+ Task 2 Step 3(lint 切 sub-line / sub-atom) ✓
- spec §"标签放置规则 · 非表格段落" → Task 4 Step 1(报告骨架例子)+ Task 2 Step 3(lint 切句) ✓
- spec §"标签放置规则 · 风险等级/置信度" → Task 4 Step 2 + Step 1 例子 ✓
- spec §"标签放置规则 · 参考来源列" → Task 4 Step 2(明确不挂)+ Task 2 Step 3(豁免规则) ✓
- spec §"Legend(报告顶部)" → Task 4 Step 1(骨架带 legend) + Task 2 Step 3(lint 豁免) + Task 3 Step 3(strip 删除) ✓
- spec §"`## 参考` 段对齐 [KB]/[NLM]" → Task 4 Step 1 + Step 3 ✓
- spec §"验证机制 1 · SKILL.md Phase 5.2 硬规则" → Task 4 Step 2 ✓
- spec §"验证机制 2 · format-chat.mjs lint pass" → Task 2 全部 ✓
- spec §"验证机制 2 · chat 标签剥离" → Task 3 全部 ✓
- spec §"豁免规则" → Task 2 Step 3 实现 + Step 1 测试覆盖 ✓
- spec §"原子位置识别(粗略)" → Task 2 Step 3 实现 + Step 1 测试覆盖 ✓
- spec §"Lint 输出与 SKILL.md 协作" → Task 2 Step 5(stderr 格式)+ Task 4 Step 4(SKILL.md 处置) ✓
- spec §"风险与权衡" → 设计层 · 实施 plan 不需对应 task ✓

无 spec 段缺 task。

**2. Placeholder scan**:

- 没有 "TBD" / "TODO" / "implement later"
- 每步都有完整代码或具体命令
- 测试代码完整 · 没有 "类似上面" 的省略

**3. Type 一致性**:

- `lintReport(mdText) → { total, missing, missRate }` — Task 2 测试 / 实现 / CLI 整合一致
- `stripChatTags(text) → string` — Task 3 测试 / 实现 / CLI 整合一致
- `rewrapTable(content, cols) → { content, found }` — Task 1 实现 / Task 2 CLI 整合一致
- `parseCells(line) → string[]`、`buildRow(cells) → string` — 沿用现有 · Task 1 加 export
- `[IDX|KB|NLM|OBS|LLM]` 5 标签字面在 spec / lint regex / strip regex / SKILL.md 全用一套 ✓

**4. 版本号链路**:

- 起点:0.37.2(plan 文档 commit 之后)
- Task 1 → 0.37.3 (patch · refactor)
- Task 2 → 0.38.0 (minor · 加 lint)
- Task 3 → 0.39.0 (minor · 加 strip)
- Task 4 → 0.40.0 (minor · LLM 契约)
- 终点:0.40.0,4 个 commit,链路连续。
