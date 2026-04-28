// Phase 1 · M5 · report.ts HTML 渲染
//
// 输入: DiagnoseResult (cli-diagnose 输出 · CheckResult[] 按 path A/B/C/D)
// 输出: HTML 字符串 · 按 entry_kind 分 3 section + header

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { renderReport } from "../../src/report.js";
import type { CheckResult, Snapshot } from "../../src/cli-diagnose.js";

const sampleSnapshot: Snapshot = {
  host: "test-host",
  platform: "linux-x86_64-generic",
  mongo_version: "7.0.5",
  metrics: { "os.cpu.iowait_pct": 22.3 },
  config_dump: { kernel_sysctl: { "vm.swappiness": 60 } },
};

const sampleHits: CheckResult[] = [
  {
    path: "A",
    case_id: "linux-mm-vm-swappiness-1-or-0-mongo-host-05",
    title: "vm.swappiness 设 0 或 1",
    entry_kind: "best-practice",
    bucket: 2,
    scope: "linux-mm",
    database: null,
    source_url: "https://www.mongodb.com/docs/manual/administration/production-notes/",
    source_authority: "official",
    severity: "warning",
    current_value: 60,
    recommended_value: "vm.swappiness=1",
    reason_zh: "现场 swappiness=60 偏离 BP 推荐 1",
    data: {},
  },
  {
    path: "B",
    case_id: "mongo-os-vm-swappiness-default-60-aggressive-swap-05",
    title: "vm.swappiness 默认 60 → 频繁 swap",
    entry_kind: "diagnostic-flow",
    bucket: 4,
    scope: null,
    database: "mongodb",
    source_url: "https://example.com/df",
    source_authority: "community-canonical",
    severity: "warning",
    current_value: 60,
    recommended_value: null,
    reason_zh: "swappiness=60 触发 mongod 内存压力 swap",
    data: {},
  },
  {
    path: "C",
    case_id: "wt-app-thread-evict-assist-pressure-01",
    title: "WT cache 满 · app thread 被拉去 eviction",
    entry_kind: "flame-signature",
    bucket: 4,
    scope: "storage-engine-wt",
    database: "mongodb",
    source_url: "https://example.com/flame",
    source_authority: "code-comment",
    severity: "warning",
    current_value: "96.0%",
    recommended_value: null,
    reason_zh: "flamegraph stack 命中 __wt_cache_eviction_*",
    data: {},
  },
];

describe("renderReport", () => {
  it("生成的 HTML 含 host / platform / mongo_version (header)", () => {
    const html = renderReport({ snapshot: sampleSnapshot, matched: sampleHits });
    assert.match(html, /test-host/);
    assert.match(html, /linux-x86_64-generic/);
    assert.match(html, /7\.0\.5/);
  });

  it("按 entry_kind 分 3 section: 配置违反 / 诊断流程 / 火焰图签名", () => {
    const html = renderReport({ snapshot: sampleSnapshot, matched: sampleHits });
    assert.match(html, /配置违反/);
    assert.match(html, /诊断流程/);
    assert.match(html, /火焰图/);
  });

  it("每条命中含 case_id / title / source_url / reason_zh", () => {
    const html = renderReport({ snapshot: sampleSnapshot, matched: sampleHits });
    assert.match(html, /linux-mm-vm-swappiness-1-or-0-mongo-host-05/);
    assert.match(html, /vm\.swappiness 设 0 或 1/);
    assert.match(html, /production-notes/);
    assert.match(html, /偏离 BP 推荐 1/);
  });

  it("权威性图标(official=★ / community-canonical=◆ / code-comment=▲)", () => {
    const html = renderReport({ snapshot: sampleSnapshot, matched: sampleHits });
    assert.match(html, /★/);
    assert.match(html, /◆/);
    assert.match(html, /▲/);
  });

  it("BP 命中显示 current vs recommended 对比", () => {
    const html = renderReport({ snapshot: sampleSnapshot, matched: sampleHits });
    assert.match(html, /60.*vm\.swappiness=1|vm\.swappiness=1.*60/s);
  });

  it("空命中数组 → HTML 仍能生成 + 含 '未命中' 提示", () => {
    const html = renderReport({ snapshot: sampleSnapshot, matched: [] });
    assert.match(html, /未命中|无命中|0 条/);
  });

  it("HTML 头部含 <!DOCTYPE html> + UTF-8 + 标题", () => {
    const html = renderReport({ snapshot: sampleSnapshot, matched: sampleHits });
    assert.match(html, /<!DOCTYPE html>/i);
    assert.match(html, /<meta charset="utf-8">/i);
    assert.match(html, /<title>/i);
  });
});
