/**
 * cli-history TDD test · 0.49.0 加 env 缓存字段 + LRU regression 防护
 *
 * 测试覆盖:
 *   1. loadHistory 兼容旧 hosts.json(无 env 字段) · 不崩
 *   2. mergeHistory 传入 env 写入 + env_captured_at 同步
 *   3. mergeHistory 没传 env · 既存 env 保留(不擦掉)
 *   4. mergeHistory 传入新 env · 覆盖既存 + 刷新 env_captured_at
 *   5. mergeHistory 同 (host, user, port) use_count++ regression
 *   6. mergeHistory LRU 5 条上限 regression
 *   7. writeHistory + loadHistory round-trip 含 env 字段
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, writeFile, rm } from "node:fs/promises";

import {
  loadHistory,
  mergeHistory,
  writeHistory,
  type HistoryFile,
} from "../src/cli-history.js";

describe("loadHistory · 文件不存在 / 旧 schema 兼容", () => {
  it("hosts.json 不存在时返回空 hosts", async () => {
    const r = await loadHistory("/nonexistent/path/hosts.json");
    assert.deepEqual(r, { hosts: [] });
  });

  it("兼容旧 hosts.json(无 env 字段) · 不崩 · env 保持 undefined", async () => {
    const dir = await mkdtemp(join(tmpdir(), "perf-kp-sql-test-"));
    const file = join(dir, "hosts.json");
    try {
      await writeFile(
        file,
        JSON.stringify({
          hosts: [
            {
              host: "1.1.1.1",
              user: "root",
              port: 22,
              engine: "mongo",
              last_used: "2026-01-01T00:00:00.000Z",
              use_count: 1,
            },
          ],
        }),
        "utf8",
      );
      const r = await loadHistory(file);
      assert.equal(r.hosts.length, 1);
      assert.equal(r.hosts[0]!.host, "1.1.1.1");
      assert.equal(r.hosts[0]!.env, undefined);
      assert.equal(r.hosts[0]!.env_captured_at, undefined);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

describe("mergeHistory · env 字段(0.49.0 新)", () => {
  const baseEntry = { host: "1.1.1.1", user: "root", port: 22, engine: "mongo" };

  it("传入 env 时一起写入 + env_captured_at = now", () => {
    const env = {
      os_distro: "Huawei Cloud EulerOS 2.0",
      arch: "aarch64",
      mongod_version: "7.0.31",
    };
    const r = mergeHistory(
      { hosts: [] },
      { ...baseEntry, env },
      "2026-05-04T00:00:00.000Z",
    );
    assert.equal(r.hosts.length, 1);
    assert.deepEqual(r.hosts[0]!.env, env);
    assert.equal(r.hosts[0]!.env_captured_at, "2026-05-04T00:00:00.000Z");
  });

  it("没传 env · 既存 env 保留(不擦掉) · env_captured_at 不刷新", () => {
    const env1 = { os_distro: "EulerOS", arch: "aarch64" };
    const r1 = mergeHistory(
      { hosts: [] },
      { ...baseEntry, env: env1 },
      "2026-05-04T00:00:00.000Z",
    );
    const r2 = mergeHistory(r1, baseEntry, "2026-05-04T01:00:00.000Z");
    assert.deepEqual(r2.hosts[0]!.env, env1);
    assert.equal(r2.hosts[0]!.env_captured_at, "2026-05-04T00:00:00.000Z");
  });

  it("传入新 env · 覆盖既存 + 刷新 env_captured_at", () => {
    const env1 = { mongod_version: "7.0.31" };
    const env2 = { mongod_version: "8.0.5" };
    const r1 = mergeHistory(
      { hosts: [] },
      { ...baseEntry, env: env1 },
      "2026-05-04T00:00:00.000Z",
    );
    const r2 = mergeHistory(
      r1,
      { ...baseEntry, env: env2 },
      "2026-05-04T02:00:00.000Z",
    );
    assert.equal(r2.hosts[0]!.env?.mongod_version, "8.0.5");
    assert.equal(r2.hosts[0]!.env_captured_at, "2026-05-04T02:00:00.000Z");
  });
});

describe("mergeHistory · 已有功能 regression", () => {
  it("同 (host, user, port) 命中时 use_count++ + last_used 刷新", () => {
    const r1 = mergeHistory(
      { hosts: [] },
      { host: "1.1.1.1", user: "root", port: 22, engine: "mongo" },
      "2026-05-04T00:00:00.000Z",
    );
    const r2 = mergeHistory(
      r1,
      { host: "1.1.1.1", user: "root", port: 22, engine: "mongo" },
      "2026-05-04T01:00:00.000Z",
    );
    assert.equal(r2.hosts.length, 1);
    assert.equal(r2.hosts[0]!.use_count, 2);
    assert.equal(r2.hosts[0]!.last_used, "2026-05-04T01:00:00.000Z");
  });

  it("LRU 5 条上限 · 第 6 条进 → 最早那条被砍", () => {
    let h: HistoryFile = { hosts: [] };
    for (let i = 1; i <= 6; i++) {
      const hour = String(i).padStart(2, "0");
      h = mergeHistory(
        h,
        { host: `host-${i}`, user: "root", port: 22, engine: "mongo" },
        `2026-05-04T${hour}:00:00.000Z`,
      );
    }
    assert.equal(h.hosts.length, 5);
    const hostnames = h.hosts.map((x) => x.host);
    assert.ok(!hostnames.includes("host-1"), "最早的 host-1 应被淘汰");
    assert.ok(hostnames.includes("host-6"), "最新的 host-6 应保留");
  });
});

describe("writeHistory + loadHistory round-trip 含 env", () => {
  it("写入含 env 的条目 · load 能读回完整字段", async () => {
    const dir = await mkdtemp(join(tmpdir(), "perf-kp-sql-test-"));
    const file = join(dir, "hosts.json");
    try {
      const env = {
        os_distro: "EulerOS",
        arch: "aarch64",
        cpu_model: "Kunpeng-920",
        cpu_count: 2,
        mongod_version: "7.0.31",
        deploy_form: "standalone",
      };
      const merged = mergeHistory(
        { hosts: [] },
        { host: "1.1.1.1", user: "root", port: 22, engine: "mongo", env },
        "2026-05-04T00:00:00.000Z",
      );
      await writeHistory(file, merged);
      const loaded = await loadHistory(file);
      assert.equal(loaded.hosts.length, 1);
      assert.deepEqual(loaded.hosts[0]!.env, env);
      assert.equal(loaded.hosts[0]!.env_captured_at, "2026-05-04T00:00:00.000Z");
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
