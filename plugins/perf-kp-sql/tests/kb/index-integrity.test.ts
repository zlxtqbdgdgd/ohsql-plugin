// KB 数据完整性测试
//
// 验证:
//   1. cases/KB.md 含 109 个 ## case_id: 头(DF 96 + Flame 13)
//   2. cases/INDEX.md DF 表 96 行 + Flame 表 13 行
//   3. INDEX.md 里 KB line 行号每个都精确对应 KB.md 真实 ## case_id: 头
//   4. best-practice/KB.md 含 93 个 ## case_id:
//   5. best-practice/INDEX.md 93 行
//   6. 所有 case_id 全局 unique
//
// 这些是 SKILL.md Phase 2.3 / Phase 3.B Read offset+limit 的前置 invariant。
// M5 dry-run 跑 LLM 路由命中率前必须先确保数据本身完整。

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "../..");
const KB_DIR = resolve(PLUGIN_ROOT, "data/kb");

interface IndexRow {
  case_id: string;
  line: number;
}

function readLines(path: string): string[] {
  return readFileSync(path, "utf8").split("\n");
}

// 解析 INDEX.md 里 markdown 表格 · 抽 case_id + KB line 列
function parseIndexTable(indexPath: string, expectedSection?: string): IndexRow[] {
  const lines = readLines(indexPath);
  const rows: IndexRow[] = [];
  let inSection = !expectedSection;
  let inTable = false;

  for (const line of lines) {
    if (expectedSection && line.startsWith("## ")) {
      inSection = line.includes(expectedSection);
      inTable = false;
      continue;
    }
    if (!inSection) continue;
    if (line.startsWith("|---")) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!line.startsWith("|")) {
      inTable = false;
      continue;
    }
    // 解析 | col1 | col2 | ... | KB line(数字)|
    const cols = line.split("|").map((c) => c.trim()).filter((c) => c.length > 0);
    if (cols.length < 2) continue;
    const lineNum = Number(cols[cols.length - 1]);
    if (!Number.isInteger(lineNum)) continue;
    rows.push({ case_id: cols[0], line: lineNum });
  }
  return rows;
}

// 拿 KB.md 里所有 ## case_id 头部 · 返回 { case_id → line(1-based) }
function parseKbHeaders(kbPath: string): Map<string, number> {
  const lines = readLines(kbPath);
  const map = new Map<string, number>();
  const re = /^## case_id:\s*(\S+)\s*$/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (m) map.set(m[1], i + 1);
  }
  return map;
}

describe("KB 数据完整性 · cases/", () => {
  const kbPath = resolve(KB_DIR, "cases/KB.md");
  const indexPath = resolve(KB_DIR, "cases/INDEX.md");

  const headers = parseKbHeaders(kbPath);
  const dfRows = parseIndexTable(indexPath, "diagnostic-flow");
  const flameRows = parseIndexTable(indexPath, "flame-signature");

  it("cases/KB.md 含 109 个 ## case_id: 头(DF 96 + Flame 13)", () => {
    assert.equal(headers.size, 109, `KB.md ## case_id 头数 · 实际 ${headers.size}`);
  });

  it("cases/INDEX.md diagnostic-flow 表 96 行", () => {
    assert.equal(dfRows.length, 96, `DF 表行数 · 实际 ${dfRows.length}`);
  });

  it("cases/INDEX.md flame-signature 表 13 行", () => {
    assert.equal(flameRows.length, 13, `Flame 表行数 · 实际 ${flameRows.length}`);
  });

  it("INDEX.md 每个 case_id + KB line 都精确对应 KB.md 真实 ## case_id 头", () => {
    const allRows = [...dfRows, ...flameRows];
    for (const row of allRows) {
      const kbLine = headers.get(row.case_id);
      assert.ok(
        kbLine !== undefined,
        `case_id ${row.case_id} 在 KB.md 找不到对应 ## 头`
      );
      assert.equal(
        kbLine,
        row.line,
        `case_id ${row.case_id} INDEX line=${row.line} 但 KB.md 实际在 line=${kbLine}`
      );
    }
  });

  it("cases case_id 全局 unique", () => {
    const ids = [...dfRows, ...flameRows].map((r) => r.case_id);
    assert.equal(new Set(ids).size, ids.length, "case_id 有重复");
  });

  it("Read offset+limit=100 能覆盖最长 case", () => {
    const sortedLines = [...headers.values()].sort((a, b) => a - b);
    const totalLines = readLines(kbPath).length;
    let maxCaseLength = 0;
    for (let i = 0; i < sortedLines.length; i++) {
      const start = sortedLines[i];
      const end = i + 1 < sortedLines.length ? sortedLines[i + 1] : totalLines + 1;
      const len = end - start;
      if (len > maxCaseLength) maxCaseLength = len;
    }
    assert.ok(
      maxCaseLength <= 100,
      `最长 case 跨 ${maxCaseLength} 行 · 超过 SKILL.md Phase 2.3 的 limit=100 ` +
        `(若超 100 LLM 需要二次 Read · 但应保持单次能覆盖大多数 case)`
    );
  });
});

describe("KB 数据完整性 · best-practice/", () => {
  const kbPath = resolve(KB_DIR, "best-practice/KB.md");
  const indexPath = resolve(KB_DIR, "best-practice/INDEX.md");

  const headers = parseKbHeaders(kbPath);
  const bpRows = parseIndexTable(indexPath); // 单表 · 无 section header

  it("best-practice/KB.md 含 93 个 ## case_id: 头", () => {
    assert.equal(headers.size, 93, `KB.md ## case_id 头数 · 实际 ${headers.size}`);
  });

  it("best-practice/INDEX.md 表 93 行", () => {
    assert.equal(bpRows.length, 93, `BP 表行数 · 实际 ${bpRows.length}`);
  });

  it("INDEX.md 每个 case_id + KB line 都精确对应 KB.md 真实 ## case_id 头", () => {
    for (const row of bpRows) {
      const kbLine = headers.get(row.case_id);
      assert.ok(
        kbLine !== undefined,
        `case_id ${row.case_id} 在 KB.md 找不到对应 ## 头`
      );
      assert.equal(
        kbLine,
        row.line,
        `case_id ${row.case_id} INDEX line=${row.line} 但 KB.md 实际在 line=${kbLine}`
      );
    }
  });

  it("BP case_id 全局 unique", () => {
    const ids = bpRows.map((r) => r.case_id);
    assert.equal(new Set(ids).size, ids.length, "BP case_id 有重复");
  });
});

describe("KB 数据完整性 · 总数对齐设计书", () => {
  it("总 case 数 = 202(DF 96 + Flame 13 + BP 93)", () => {
    const casesHeaders = parseKbHeaders(resolve(KB_DIR, "cases/KB.md"));
    const bpHeaders = parseKbHeaders(resolve(KB_DIR, "best-practice/KB.md"));
    assert.equal(casesHeaders.size + bpHeaders.size, 202);
  });

  it("cases + best-practice 间 case_id 不交叉", () => {
    const casesIds = new Set(parseKbHeaders(resolve(KB_DIR, "cases/KB.md")).keys());
    const bpIds = new Set(parseKbHeaders(resolve(KB_DIR, "best-practice/KB.md")).keys());
    for (const id of casesIds) {
      assert.ok(!bpIds.has(id), `case_id ${id} 同时出现在 cases 和 best-practice`);
    }
  });
});
