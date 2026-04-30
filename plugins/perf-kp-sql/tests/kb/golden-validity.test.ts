// 黄金集 schema 验证(确定性 · 不调 LLM)
//
// 验证:
//   1. tests/golden/symptom-routing.json schema 合法
//   2. 每条 case 字段齐全(id / bucket / user_input / expected_case_ids / expected_count / notes)
//   3. expected_count 跟 expected_case_ids.length 对得上
//   4. 所有 expected_case_ids 真实存在于 cases/INDEX.md (除负例 / nothing-mode 期望 0 命中外)
//   5. bucket 分布跟 schema 头部 buckets 字段一致
//
// 真跑 LLM 路由命中率(命中 ≥ 85%)留 M5 dry-run · 不在 unit test。

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "../..");
const GOLDEN_PATH = resolve(PLUGIN_ROOT, "tests/golden/symptom-routing.json");
const CASES_INDEX = resolve(PLUGIN_ROOT, "data/kb/cases/INDEX.md");

interface GoldenCase {
  id: string;
  bucket: string;
  user_input: string;
  expected_case_ids: string[];
  expected_count: number;
  notes?: string;
}

interface GoldenSchema {
  schema_version: string;
  generated_at?: string;
  total: number;
  draft_status?: string;
  buckets: Record<string, number>;
  cases: GoldenCase[];
}

function loadGolden(): GoldenSchema {
  return JSON.parse(readFileSync(GOLDEN_PATH, "utf8"));
}

function loadIndexCaseIds(): Set<string> {
  const lines = readFileSync(CASES_INDEX, "utf8").split("\n");
  const ids = new Set<string>();
  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    const cols = line.split("|").map((c) => c.trim()).filter((c) => c.length > 0);
    if (cols.length < 2) continue;
    if (cols[0] === "case_id" || cols[0].startsWith("---")) continue;
    ids.add(cols[0]);
  }
  return ids;
}

describe("Golden set schema · symptom-routing.json", () => {
  const golden = loadGolden();

  it("schema 顶级字段齐全", () => {
    assert.ok(golden.schema_version, "缺 schema_version");
    assert.ok(typeof golden.total === "number", "缺 total");
    assert.ok(golden.buckets && typeof golden.buckets === "object", "缺 buckets");
    assert.ok(Array.isArray(golden.cases), "缺 cases 数组");
  });

  it("total 跟 cases.length 一致", () => {
    assert.equal(golden.total, golden.cases.length);
  });

  it("buckets 总和 = total", () => {
    const sum = Object.values(golden.buckets).reduce((a, b) => a + b, 0);
    assert.equal(sum, golden.total, `buckets 总和 ${sum} ≠ total ${golden.total}`);
  });

  it("每条 case 必填字段齐全", () => {
    for (const c of golden.cases) {
      assert.ok(c.id, `case 缺 id`);
      assert.ok(c.bucket, `${c.id} 缺 bucket`);
      assert.ok(c.user_input, `${c.id} 缺 user_input`);
      assert.ok(Array.isArray(c.expected_case_ids), `${c.id} expected_case_ids 不是数组`);
      assert.ok(typeof c.expected_count === "number", `${c.id} 缺 expected_count`);
    }
  });

  it("expected_count 跟 expected_case_ids.length 对得上", () => {
    for (const c of golden.cases) {
      assert.equal(
        c.expected_count,
        c.expected_case_ids.length,
        `${c.id} expected_count=${c.expected_count} 但 expected_case_ids 有 ${c.expected_case_ids.length} 个`
      );
    }
  });

  it("bucket 分布跟 schema 头部 buckets 一致", () => {
    const actual: Record<string, number> = {};
    for (const c of golden.cases) {
      actual[c.bucket] = (actual[c.bucket] || 0) + 1;
    }
    for (const [bucket, expected] of Object.entries(golden.buckets)) {
      assert.equal(
        actual[bucket] || 0,
        expected,
        `bucket ${bucket} 头声明 ${expected} · 实际 ${actual[bucket] || 0}`
      );
    }
  });

  it("id 全局 unique", () => {
    const ids = golden.cases.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, "case id 有重复");
  });
});

describe("Golden set 引用一致性 · expected_case_ids 对照 cases/INDEX.md", () => {
  const golden = loadGolden();
  const indexIds = loadIndexCaseIds();

  it("INDEX 加载 ≥ 100 case_id(sanity)", () => {
    assert.ok(indexIds.size >= 100, `INDEX 加载到 ${indexIds.size} case_id · 过少`);
  });

  it("所有 expected_case_ids 真实存在于 INDEX(除 nothing-mode/negative 0 命中)", () => {
    for (const c of golden.cases) {
      // nothing-mode 和 negative 期望 0 命中 · 跳过引用检查
      if (c.bucket === "nothing-mode" || c.bucket === "negative") {
        assert.equal(c.expected_count, 0, `${c.id} (${c.bucket}) 应当 expected_count=0`);
        continue;
      }
      for (const expId of c.expected_case_ids) {
        assert.ok(
          indexIds.has(expId),
          `${c.id} 引用 expected_case_id ${expId} 不存在于 cases/INDEX.md`
        );
      }
    }
  });

  it("nothing-mode 和 negative 的 expected_case_ids 必须为空", () => {
    for (const c of golden.cases) {
      if (c.bucket !== "nothing-mode" && c.bucket !== "negative") continue;
      assert.equal(
        c.expected_case_ids.length,
        0,
        `${c.id} (${c.bucket}) 应当 expected_case_ids=[] 但有 ${c.expected_case_ids.length} 个`
      );
    }
  });

  it("narrow-edge / cross-category 必须 expected_count ≥ 2(多命中收窄逻辑)", () => {
    for (const c of golden.cases) {
      if (c.bucket !== "narrow-edge" && c.bucket !== "cross-category") continue;
      assert.ok(
        c.expected_count >= 2,
        `${c.id} (${c.bucket}) 应当 expected_count ≥ 2 但实际 ${c.expected_count}`
      );
    }
  });
});
