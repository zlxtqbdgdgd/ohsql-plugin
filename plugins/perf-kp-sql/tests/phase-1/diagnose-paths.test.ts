// Phase 1 · M4 · cli-diagnose 4 查询路径测试
//
// 路径 A · 配置审计 (BP) — config_dump param 偏离推荐 → 命中 BP case
// 路径 B · 指标诊断 (DF) — config_dump/metrics 触发 DF parameter_causes → 命中 DF case
// 路径 C · 火焰图栈帧匹配 (Flame) — stack regex match flame pattern_regex
// 路径 D · 本地兜底检索 (FTS) — query string → cases_fts top-K
//
// 红用例 · M4 实装 src/cli-diagnose/* 让其转绿。

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildKb } from "../../src/cli-kb.js";
import { diagnose, type Snapshot, type CheckResult } from "../../src/cli-diagnose.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DISTILL_V2_CASES = resolve(HERE, "../../../../../docs/data/distill-v2/cases");

let workDir: string;
let dbPath: string;

before(async () => {
  workDir = mkdtempSync(join(tmpdir(), "diagnose-test-"));
  dbPath = join(workDir, "knowledge.sqlite");
  await buildKb({ casesRoot: DISTILL_V2_CASES, out: dbPath });
});

after(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function snapshot(partial: Partial<Snapshot>): Snapshot {
  return {
    host: "test",
    platform: "linux-x86_64-generic",
    metrics: {},
    config_dump: {},
    ...partial,
  };
}

describe("路径 A · 配置审计 (BP)", () => {
  it("vm.swappiness=60 现场 → 命中 BP swappiness case", () => {
    const result = diagnose({
      dbPath,
      snapshot: snapshot({
        config_dump: { kernel_sysctl: { "vm.swappiness": 60 } },
      }),
    });
    const hits = result.matched.filter((r) => r.path === "A");
    assert.ok(
      hits.some((r) => r.case_id.includes("swappiness")),
      `应命中 swappiness BP · 实际命中 ${hits.length} 条 (${hits.map((h) => h.case_id).join(", ")})`,
    );
  });

  it("vm.swappiness=1 现场 → 不命中(已是推荐值)", () => {
    const result = diagnose({
      dbPath,
      snapshot: snapshot({
        config_dump: { kernel_sysctl: { "vm.swappiness": 1 } },
      }),
    });
    const swappinessHits = result.matched.filter(
      (r) => r.path === "A" && r.case_id.includes("swappiness"),
    );
    assert.equal(swappinessHits.length, 0, "swappiness=1 已合规 · 不应命中");
  });

  it("命中 case 含 current_value + recommended_value + reason_zh", () => {
    const result = diagnose({
      dbPath,
      snapshot: snapshot({
        config_dump: { kernel_sysctl: { "vm.swappiness": 60 } },
      }),
    });
    const hit = result.matched.find((r) => r.path === "A" && r.case_id.includes("swappiness"));
    assert.ok(hit);
    assert.equal(String(hit!.current_value), "vm.swappiness=60");
    assert.ok(hit!.recommended_value);
    assert.ok(hit!.reason_zh && hit!.reason_zh.length > 0);
  });
});

describe("路径 C · 火焰图栈帧匹配 (Flame)", () => {
  it("stack 含 __wt_cache_eviction_* → 命中 flame case", () => {
    const result = diagnose({
      dbPath,
      snapshot: snapshot({
        flamegraph_stacks: [
          {
            stack:
              "__wt_cache_eviction_check;__wt_cache_eviction_worker;__wt_evict_lru_walk;...",
            samples: 1500,
          },
          { stack: "do_other_work;...", samples: 100 },
        ],
      }),
    });
    const flameHits = result.matched.filter((r) => r.path === "C");
    assert.ok(
      flameHits.some((r) => r.case_id.includes("evict")),
      `应命中 wt eviction flame · 实际命中 ${flameHits.length} 条`,
    );
  });

  it("无 flamegraph_stacks → 路径 C 不产 hit", () => {
    const result = diagnose({
      dbPath,
      snapshot: snapshot({}),
    });
    const flameHits = result.matched.filter((r) => r.path === "C");
    assert.equal(flameHits.length, 0);
  });
});

describe("路径 D · 本地 fallback FTS 检索", () => {
  it("query='swappiness' → top-K 含 swappiness 相关 case", () => {
    const result = diagnose({
      dbPath,
      snapshot: snapshot({}),
      query: "swappiness",
    });
    assert.ok(result.rag_context && result.rag_context.length > 0);
    const ragHits = result.rag_context!;
    assert.ok(
      ragHits.some((r) => r.case_id.includes("swappiness")),
      `RAG 应至少含 1 条 swappiness · 实际 ${ragHits.length} 条`,
    );
  });
});

describe("CheckResult 公共字段", () => {
  it("命中 case 都带 bucket(1-5)和 entry_kind", () => {
    const result = diagnose({
      dbPath,
      snapshot: snapshot({
        config_dump: {
          kernel_sysctl: { "vm.swappiness": 60, "net.ipv4.tcp_keepalive_time": 7200 },
        },
      }),
    });
    for (const r of result.matched) {
      assert.ok(r.bucket >= 1 && r.bucket <= 5, `bucket ${r.bucket} 越界`);
      assert.ok(["best-practice", "diagnostic-flow", "flame-signature"].includes(r.entry_kind));
      assert.ok(r.title.length > 0);
      assert.ok(r.source_url.length > 0);
    }
  });
});
