// Phase 1 · M3 Layer 1: scope/engine → bucket (1-5) 映射
//
// bucket 1=硬件 / 2=OS / 3=引擎配置 / 4=运行时 / 5=业务
// 路由依据见 docs/linear-wishing-trinket.md §8 + PHASE-1-SCHEMA-AND-USAGE.md §2.1
//
// 红用例 · M3 起手就实现 scope-to-bucket.ts 让其转绿。

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { scopeToBucket } from "../../src/shared/scope-to-bucket.js";

describe("scopeToBucket(scope, engine, entryKind)", () => {
  describe("BP / Flame · 用 scope 直接映射", () => {
    it("scope=storage-engine-wt → 4 (运行时)", () => {
      assert.equal(scopeToBucket({ scope: "storage-engine-wt", entryKind: "best-practice" }), 4);
    });

    it("scope=storage-engine-other → 3 (引擎配置)", () => {
      assert.equal(scopeToBucket({ scope: "storage-engine-other", entryKind: "best-practice" }), 3);
    });

    it("scope=linux-mm → 2 (OS)", () => {
      assert.equal(scopeToBucket({ scope: "linux-mm", entryKind: "best-practice" }), 2);
    });

    it("scope=linux-net → 2 (OS)", () => {
      assert.equal(scopeToBucket({ scope: "linux-net", entryKind: "best-practice" }), 2);
    });

    it("scope=linux-fs → 2 (OS)", () => {
      assert.equal(scopeToBucket({ scope: "linux-fs", entryKind: "flame-signature" }), 2);
    });

    it("scope=linux-sched → 2 (OS)", () => {
      assert.equal(scopeToBucket({ scope: "linux-sched", entryKind: "best-practice" }), 2);
    });

    it("scope=linux-block → 2 (OS)", () => {
      assert.equal(scopeToBucket({ scope: "linux-block", entryKind: "best-practice" }), 2);
    });

    it("scope=mem-allocator-jemalloc → 2 (OS)", () => {
      assert.equal(scopeToBucket({ scope: "mem-allocator-jemalloc", entryKind: "flame-signature" }), 2);
    });

    it("scope=mem-allocator-glibc → 2 (OS)", () => {
      assert.equal(scopeToBucket({ scope: "mem-allocator-glibc", entryKind: "flame-signature" }), 2);
    });

    it("scope=tls-crypto → 2 (OS · TLS 库属于 OS 中间层)", () => {
      assert.equal(scopeToBucket({ scope: "tls-crypto", entryKind: "best-practice" }), 2);
    });

    it("scope=app-other → 5 (业务层)", () => {
      assert.equal(scopeToBucket({ scope: "app-other", entryKind: "best-practice" }), 5);
    });

    it("scope=app-query-layer → 5 (业务 · 慢查询/索引)", () => {
      assert.equal(scopeToBucket({ scope: "app-query-layer", entryKind: "best-practice" }), 5);
    });

    it("scope=other → 5 (兜底归业务)", () => {
      assert.equal(scopeToBucket({ scope: "other", entryKind: "best-practice" }), 5);
    });
  });

  describe("DF · 无 scope · 用 engine + symptom_category 推", () => {
    it("engine=kunpeng-platform → 1 (硬件)", () => {
      assert.equal(scopeToBucket({ engine: "kunpeng-platform", entryKind: "diagnostic-flow" }), 1);
    });

    it("engine=linux-os → 2 (OS)", () => {
      assert.equal(scopeToBucket({ engine: "linux-os", entryKind: "diagnostic-flow" }), 2);
    });

    it("engine=mongodb · symptom=startup-failure → 3 (引擎启动配置)", () => {
      assert.equal(
        scopeToBucket({
          engine: "mongodb",
          symptomCategory: "startup-failure",
          entryKind: "diagnostic-flow",
        }),
        3,
      );
    });

    it("engine=mongodb · symptom=cpu-high → 4 (运行时)", () => {
      assert.equal(
        scopeToBucket({
          engine: "mongodb",
          symptomCategory: "cpu-high",
          entryKind: "diagnostic-flow",
        }),
        4,
      );
    });

    it("engine=mongodb · symptom=memory-pressure → 4 (运行时)", () => {
      assert.equal(
        scopeToBucket({
          engine: "mongodb",
          symptomCategory: "memory-pressure",
          entryKind: "diagnostic-flow",
        }),
        4,
      );
    });

    it("engine=mongodb · symptom=lock-contention → 4 (运行时)", () => {
      assert.equal(
        scopeToBucket({
          engine: "mongodb",
          symptomCategory: "lock-contention",
          entryKind: "diagnostic-flow",
        }),
        4,
      );
    });

    it("engine=mongodb · symptom=disk-io-saturation → 4 (运行时)", () => {
      assert.equal(
        scopeToBucket({
          engine: "mongodb",
          symptomCategory: "disk-io-saturation",
          entryKind: "diagnostic-flow",
        }),
        4,
      );
    });

    it("engine=mongodb · symptom=replica-lag → 4 (复制运行时)", () => {
      assert.equal(
        scopeToBucket({
          engine: "mongodb",
          symptomCategory: "replica-lag",
          entryKind: "diagnostic-flow",
        }),
        4,
      );
    });

    it("engine=mongodb · symptom=connection-storm → 4 (连接池运行时)", () => {
      assert.equal(
        scopeToBucket({
          engine: "mongodb",
          symptomCategory: "connection-storm",
          entryKind: "diagnostic-flow",
        }),
        4,
      );
    });

    it("engine=mongodb · symptom=query-slow → 5 (业务慢查询)", () => {
      assert.equal(
        scopeToBucket({
          engine: "mongodb",
          symptomCategory: "query-slow",
          entryKind: "diagnostic-flow",
        }),
        5,
      );
    });

    it("engine=mixed (mongo on kunpeng) · symptom=cpu-high → 4 (运行时)", () => {
      assert.equal(
        scopeToBucket({
          engine: "mixed",
          symptomCategory: "cpu-high",
          entryKind: "diagnostic-flow",
        }),
        4,
      );
    });
  });

  describe("边界 + 兜底", () => {
    it("scope/engine 都缺 → 5 (兜底归业务)", () => {
      assert.equal(scopeToBucket({ entryKind: "best-practice" }), 5);
    });

    it("未知 scope → 5 (兜底)", () => {
      assert.equal(scopeToBucket({ scope: "exotic-future-scope", entryKind: "best-practice" }), 5);
    });

    it("scope 优先级高于 engine: 同时给 scope=linux-mm + engine=mongodb · 仍归 2", () => {
      assert.equal(
        scopeToBucket({
          scope: "linux-mm",
          engine: "mongodb",
          entryKind: "diagnostic-flow",
        }),
        2,
      );
    });
  });
});
