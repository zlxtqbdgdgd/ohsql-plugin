/**
 * render-report.mjs 单测 · 覆盖 v0.23 系列改动的 4 个关键纯函数:
 *   - fmtLocalTime      · ISO Z → 本地 yyyy-mm-dd HH:MM:SS
 *   - cleanSummary      · 剥 "不符合 X 期望" / "偏离推荐值" 冗余尾巴
 *   - extractCurrent    · 拼:去 prefix= + cleanSummary
 *   - renderMetadata    · ssh-host 注入后输出不含 127.0.0.1;cpu_model 优先于 arch
 *
 * 11 项可读性修复 + Sonnet review 反馈各项的回归基线。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  fmtLocalTime,
  cleanSummary,
  extractCurrent,
  renderMetadata,
  renderArtifacts,
  // @ts-expect-error · render-report.mjs 是手写 .mjs · 没 .d.ts
} from "../scripts/render-report.mjs";

describe("fmtLocalTime", () => {
  it("yyyy-mm-dd HH:MM:SS 格式 · 不带时区符号", () => {
    // 用一个固定本地时间 · 这台机器上 2026-01-15 03:04:05 = 一个具体 Date
    const d = new Date(2026, 0, 15, 3, 4, 5); // month 0-indexed
    assert.equal(fmtLocalTime(d), "2026-01-15 03:04:05");
  });

  it("个位数字段全部补 0", () => {
    const d = new Date(2026, 8, 9, 0, 0, 0); // 2026-09-09 00:00:00
    assert.equal(fmtLocalTime(d), "2026-09-09 00:00:00");
  });
});

describe("cleanSummary", () => {
  it("剥 ' 不符合 X 期望' 后缀", () => {
    assert.equal(
      cleanSummary("THP=always 不符合 mongo 7.0.31 期望"),
      "THP=always",
    );
  });

  it("剥 ' 偏离推荐值 X' 后缀", () => {
    assert.equal(
      cleanSummary("tcp_keepalive_time=7200s 偏离推荐值 120s"),
      "tcp_keepalive_time=7200s",
    );
  });

  it("不跨越 ` · ` 分隔符吞 merge 后多段 summary 的中间字段", () => {
    // 主题合并后的 summary 形如 "A=1 偏离推荐值 X · B=2 < Y · C=3 过高"
    // [^·] 限定保证只清理最末端那段,不会把 " · B=2 < Y · C=3 过高" 也一锅端
    const merged = "tcp_keepalive_time=7200s · tcp_max_syn_backlog=1024 < 8192 · keepalive_time=7200s 过高";
    assert.equal(cleanSummary(merged), merged);
  });

  it("无尾巴 summary 原样返回(只 trim)", () => {
    assert.equal(cleanSummary("  somaxconn=4096 < 65535  "), "somaxconn=4096 < 65535");
  });

  it("空值容忍", () => {
    assert.equal(cleanSummary(undefined), "");
    assert.equal(cleanSummary(null), "");
    assert.equal(cleanSummary(""), "");
  });
});

describe("extractCurrent", () => {
  it("剥 prefix= 后再调 cleanSummary · 兜旧 JSON 的冗长 summary", () => {
    // 旧 diagnose 写入的 summary · 新 renderer 应清成 "always"
    assert.equal(
      extractCurrent({ summary: "THP=always 不符合 mongo 7.0.31 期望" }),
      "always",
    );
  });

  it("无 prefix= 的 summary 走 cleanSummary 路径", () => {
    assert.equal(extractCurrent({ summary: "4096 < 65535" }), "4096 < 65535");
  });

  it("空 finding 容忍", () => {
    assert.equal(extractCurrent({}), "");
    assert.equal(extractCurrent(null), "");
  });
});

describe("renderMetadata", () => {
  const baseSummary = { critical: 1, warning: 2, info: 3, ok: 4 };

  it("注入 SSH 实参后 · 目标主机 / 数据库地址 不含远端 bind=127.0.0.1", () => {
    const meta = {
      engine: "mongo",
      host: "127.0.0.1", // 远端 bind · 应被 ssh_host 覆盖
      ssh_host: "10.0.0.1",
      ssh_user: "root",
      ssh_port: "2222", // 字符串 · 测 Number 化
      db_bind: "127.0.0.1",
      db_port: 27017,
      db_version: "7.0.31",
      cpu_model: "Kunpeng-920",
      total_mem_mb: 3649,
      generated_at: new Date(2026, 3, 27, 13, 30, 0).toISOString(),
    };
    const out = renderMetadata(meta, baseSummary);
    // 不应该出现 "127.0.0.1"
    assert.ok(!out.includes("127.0.0.1"), `输出含 127.0.0.1 · 实际:\n${out}`);
    // 应该出现注入的 host
    assert.ok(out.includes("10.0.0.1"), `输出未含 ssh_host 10.0.0.1 · 实际:\n${out}`);
    // 应该出现 ssh_user@host:port 格式
    assert.ok(out.includes("`root@10.0.0.1:2222`"), `target 行格式不对 · 实际:\n${out}`);
  });

  it("cpu_model 优先于 arch · 撤 Arch aarch64 工程腔", () => {
    const meta = { engine: "mongo", arch: "aarch64", cpu_model: "Kunpeng-920" };
    const out = renderMetadata(meta, baseSummary);
    assert.ok(out.includes("Kunpeng-920"));
    assert.ok(!out.includes("aarch64"));
  });

  it("无 cpu_model 时回退到 arch · 兜没采到 lscpu 的旧机器", () => {
    const meta = { engine: "mongo", arch: "x86_64" };
    const out = renderMetadata(meta, baseSummary);
    assert.ok(out.includes("x86_64"));
  });

  it("内存行从 total_mem_mb 算 GB · 1 位小数", () => {
    const meta = { engine: "mongo", total_mem_mb: 3649 };
    const out = renderMetadata(meta, baseSummary);
    assert.ok(out.includes("3.6 GB"), `内存行格式不对 · 实际:\n${out}`);
  });

  it("生成时间用 generated_at(采集时间) · 不用 render-time 现在", () => {
    const meta = {
      engine: "mongo",
      generated_at: new Date(2026, 3, 27, 13, 30, 5).toISOString(),
    };
    const out = renderMetadata(meta, baseSummary);
    assert.ok(out.includes("2026-04-27 13:30:05"), `生成时间未取 generated_at · 实际:\n${out}`);
  });

  it("诊断结果计数 · severity 用中文", () => {
    const out = renderMetadata({ engine: "mongo" }, { critical: 1, warning: 6, info: 25, ok: 22 });
    assert.ok(out.includes("严重 1"));
    assert.ok(out.includes("告警 6"));
    assert.ok(out.includes("信息 25"));
    assert.ok(out.includes("已通过 22"));
  });
});

describe("renderArtifacts", () => {
  it("metadata 里全部路径注入 · 4 行各显真实路径 · backtick 包裹防 marked 误解析", () => {
    const data = {
      report_input: {
        metadata: {
          os_collect_path: "/Users/foo/.perf-kp-sql/tmp/perf-kp-sql-os-20260427-130000.txt",
          db_collect_path: "/Users/foo/.perf-kp-sql/tmp/perf-kp-sql-mongo-db-20260427-130000.txt",
          flame_path: "/Users/foo/.perf-kp-sql/tmp/flame-json-20260427-130000.json",
          report_path: "/Users/foo/.perf-kp-sql/reports/perf-kp-sql-mongo-20260427-130000.html",
        },
      },
    };
    const out = renderArtifacts(data, "");
    assert.ok(out.includes("`/Users/foo/.perf-kp-sql/tmp/perf-kp-sql-os-20260427-130000.txt`"));
    assert.ok(out.includes("`/Users/foo/.perf-kp-sql/tmp/perf-kp-sql-mongo-db-20260427-130000.txt`"));
    assert.ok(out.includes("`/Users/foo/.perf-kp-sql/tmp/flame-json-20260427-130000.json`"));
    assert.ok(out.includes("`/Users/foo/.perf-kp-sql/reports/perf-kp-sql-mongo-20260427-130000.html`"));
    // 不应出现按 ts 猜的旧 fallback 路径(prefix cmd-os / cmd-db)
    assert.ok(!out.includes("perf-kp-sql-cmd-os-"), "不应再有 cmd-os- fallback 路径");
    assert.ok(!out.includes("perf-kp-sql-cmd-db-"), "不应再有 cmd-db- fallback 路径");
  });

  it("metadata 里没传路径 · 4 行全部显示 '(未传入)' 占位 · 不猜路径", () => {
    const data = { report_input: { metadata: {} } };
    const out = renderArtifacts(data, "");
    // 4 行各应有一次占位符
    const placeholderCount = (out.match(/\(未传入/g) ?? []).length;
    assert.equal(placeholderCount, 4, `应 4 行全是占位符 · 实际 ${placeholderCount} 次:\n${out}`);
    // 不能猜路径
    assert.ok(!out.includes(".perf-kp-sql/tmp/"), "未传入时不应硬编进任何 ~/.perf-kp-sql/tmp/ 默认路径");
  });

  it("report_path 缺失 · 用 _mdPath 兜底", () => {
    const data = { report_input: { metadata: { os_collect_path: "/x.txt" } } };
    const out = renderArtifacts(data, "/Users/foo/report.md");
    assert.ok(out.includes("`/Users/foo/report.md`"), `_mdPath 兜底失败 · 实际:\n${out}`);
  });
});
