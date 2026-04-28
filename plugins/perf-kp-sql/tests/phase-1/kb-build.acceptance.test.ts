// Phase 1 · M3 验收测试: distill-v2 cases md → sqlite knowledge.sqlite
//
// 红用例 · 当前应当全失败(因 cli-kb.ts 还没重写)。
// M3 实现完毕后逐个转绿。

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// 这些导入当前会失败 (M3 才会建出 cli-kb.ts 的新 build API)
import { buildKb, type BuildKbResult } from "../../src/cli-kb.js";

const DISTILL_V2_CASES = resolve(
  __dirname,
  "../../../../../docs/data/distill-v2/cases",
);

describe("M3 · cli-kb build 把 distill-v2 cases md 入 sqlite", () => {
  let workDir: string;
  let dbPath: string;
  let result: BuildKbResult;

  before(async () => {
    workDir = mkdtempSync(join(tmpdir(), "kb-build-test-"));
    dbPath = join(workDir, "knowledge.sqlite");
    result = await buildKb({
      casesRoot: DISTILL_V2_CASES,
      out: dbPath,
    });
  });

  after(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it("产出 sqlite 文件", () => {
    assert.ok(existsSync(dbPath), `sqlite 应当生成于 ${dbPath}`);
  });

  it("cases 表行数 = 202 (BP 93 + DF 96 + Flame 13)", () => {
    assert.equal(result.totals.cases, 202);
  });

  it("entry_kind 分布: best-practice 93", () => {
    assert.equal(result.totals.byEntryKind["best-practice"], 93);
  });

  it("entry_kind 分布: diagnostic-flow 96", () => {
    assert.equal(result.totals.byEntryKind["diagnostic-flow"], 96);
  });

  it("entry_kind 分布: flame-signature 13", () => {
    assert.equal(result.totals.byEntryKind["flame-signature"], 13);
  });

  it("5 个 bucket 全有 case (1=硬件 2=OS 3=配置 4=运行时 5=业务)", () => {
    for (const b of [1, 2, 3, 4, 5]) {
      assert.ok(
        (result.totals.byBucket[b] ?? 0) > 0,
        `bucket ${b} 应当至少有 1 条 case`,
      );
    }
  });

  it("子表 case_param_names 行数 ≥ 350", () => {
    assert.ok(
      result.totals.caseParamNames >= 350,
      `case_param_names 应有 350+ 行 · 实际 ${result.totals.caseParamNames}`,
    );
  });

  it("子表 case_keywords 行数 ≥ 600", () => {
    assert.ok(
      result.totals.caseKeywords >= 600,
      `case_keywords 应有 600+ 行 · 实际 ${result.totals.caseKeywords}`,
    );
  });

  it("FTS5 表 cases_fts 行数 = 202", () => {
    assert.equal(result.totals.casesFts, 202);
  });

  it("sqlite-vec 表 cases_vec 行数 = 202", () => {
    assert.equal(result.totals.casesVec, 202);
  });

  it("PRIMARY KEY case_id 全局唯一 · 入库不应有冲突", () => {
    assert.equal(result.errors.filter((e) => e.kind === "duplicate_case_id").length, 0);
  });

  it("path-guard 通过: cases 表 database 与物理路径一致", () => {
    // _common/ 下 case database 必须为 NULL · mongodb/ 下必须为 'mongodb'
    assert.equal(result.errors.filter((e) => e.kind === "path_guard").length, 0);
  });

  it("scope-database 配对通过: storage-engine-* 与 wt-* 必须 database='mongodb'", () => {
    assert.equal(result.errors.filter((e) => e.kind === "scope_database_mismatch").length, 0);
  });

  it("CHECK 约束: entry_kind 与对应 JSON 列填充一致", () => {
    assert.equal(result.errors.filter((e) => e.kind === "json_column_mismatch").length, 0);
  });
});
