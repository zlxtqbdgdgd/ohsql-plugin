#!/usr/bin/env node
/**
 * PoC · LLM-as-judge 准确率验证
 *
 * 8 条代表性规则 · 每条 2 fixture(正例+负例) · 共 16 测试
 * 用 gpt-4o-mini · 看 LLM 判得准不准 · 准确率 > 80% 才算 PoC 过
 *
 * 用法:
 *   source .env.local && node scripts/poc-llm-judge.mjs
 */

import OpenAI from "openai";
import { readFileSync } from "node:fs";

if (!process.env.OPENAI_API_KEY) {
  // 兜底从 .env.local 读
  try {
    const env = readFileSync(".env.local", "utf8");
    const m = env.match(/OPENAI_API_KEY=(.+)/);
    if (m) process.env.OPENAI_API_KEY = m[1].trim();
  } catch (_e) {}
}
if (!process.env.OPENAI_API_KEY) {
  console.error("missing OPENAI_API_KEY · put in .env.local or export it");
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = "gpt-4o-mini";

// ============================================================================
// 8 条代表性规则 + ground-truth fixtures
// ============================================================================

const TESTS = [
  // 类别 A · 真简单(单字段对比常量)
  {
    rule: {
      id: "mongo-config-tcmalloc-percpu-caches-disabled",
      reason: "If per-CPU caches are not enabled, TCMalloc falls back to per-thread caches",
      threshold: "!= true",
      metric_expr: "serverStatus.tcmalloc.usingPerCPUCaches",
    },
    cases: [
      { name: "POS · perCPU off", metrics: { "serverStatus.tcmalloc.usingPerCPUCaches": false }, expected: true },
      { name: "NEG · perCPU on", metrics: { "serverStatus.tcmalloc.usingPerCPUCaches": true }, expected: false },
    ],
  },
  {
    rule: {
      id: "mongo-runtime-tcmalloc-cpu-free-zero",
      reason: "A non-positive cpu_free indicates per-CPU cache is not active",
      threshold: "<= 0",
      metric_expr: "serverStatus.tcmalloc.tcmalloc.cpu_free",
    },
    cases: [
      { name: "POS · cpu_free=0", metrics: { "serverStatus.tcmalloc.tcmalloc.cpu_free": 0 }, expected: true },
      { name: "NEG · cpu_free=12345", metrics: { "serverStatus.tcmalloc.tcmalloc.cpu_free": 12345 }, expected: false },
    ],
  },

  // 类别 B · 比值/除法
  {
    rule: {
      id: "mongo-runtime-connection-pool-oversized",
      reason: "Oversized connection pools overload mongod connection resources",
      threshold: "> 1.15 (pool 大于当前连接数 15%)",
      metric_expr: "client_pool_size / max(serverStatus.connections.current, 1)",
    },
    cases: [
      { name: "POS · pool 5x", metrics: { client_pool_size: 500, "serverStatus.connections.current": 100 }, expected: true },
      { name: "NEG · pool 0.5x", metrics: { client_pool_size: 50, "serverStatus.connections.current": 100 }, expected: false },
    ],
  },
  {
    rule: {
      id: "mongo-config-wt-cache-oversize",
      reason: "Oversizing WT cache starves filesystem cache",
      threshold: "> 0.5 (WT cache 占总内存超 50%)",
      metric_expr: "serverStatus.wiredTiger.cache['maximum bytes configured'] / hostInfo.system.memSizeMB",
    },
    cases: [
      // 注意:cache 单位是 bytes · memSizeMB 是 MB · 比值结果不是百分比 · LLM 应能理解
      { name: "POS · 32GB cache / 32GB RAM", metrics: { "serverStatus.wiredTiger.cache['maximum bytes configured']": 34359738368, "hostInfo.system.memSizeMB": 32768 }, expected: true, note: "cache 32GB · RAM 32GB · 占 100% · 远超 50%" },
      { name: "NEG · 4GB cache / 32GB RAM", metrics: { "serverStatus.wiredTiger.cache['maximum bytes configured']": 4294967296, "hostInfo.system.memSizeMB": 32768 }, expected: false, note: "cache 4GB · RAM 32GB · 占 12.5%" },
    ],
  },

  // 类别 C · 条件触发(when X then check Y)
  {
    rule: {
      id: "mongo-config-auth-failed-delay-high",
      reason: "authFailedDelayMs > 0 与高连接利用率叠加,会放大 brute-force 攻击下的 DoS 风险",
      threshold: "> 80 when authFailedDelayMs > 0 (连接利用率超 80% 且开了延迟)",
      metric_expr: "(serverStatus.connections.current / (serverStatus.connections.available + serverStatus.connections.current)) * 100",
    },
    cases: [
      { name: "POS · 86% util + delay=500", metrics: { "serverStatus.connections.current": 245, "serverStatus.connections.available": 38, authFailedDelayMs: 500 }, expected: true },
      { name: "NEG · 86% util but delay=0", metrics: { "serverStatus.connections.current": 245, "serverStatus.connections.available": 38, authFailedDelayMs: 0 }, expected: false, note: "条件不满足:authFailedDelayMs=0 → 不应 fire" },
    ],
  },
  {
    rule: {
      id: "mongo-config-ldap-multithread-disabled",
      reason: "LDAP 启用连接池但未开多线程模式 · 高连接场景会序列化 LDAP 调用",
      threshold: "> 0 when ldapUseConnectionPool=true and ldapForceMultiThreadMode=false",
      metric_expr: "serverStatus.connections.current",
    },
    cases: [
      { name: "POS · LDAP+pool · multithread=off · 200 conn", metrics: { "serverStatus.connections.current": 200, ldapUseConnectionPool: true, ldapForceMultiThreadMode: false }, expected: true },
      { name: "NEG · LDAP+pool · multithread=on", metrics: { "serverStatus.connections.current": 200, ldapUseConnectionPool: true, ldapForceMultiThreadMode: true }, expected: false, note: "multithread=on → 条件不满足" },
    ],
  },

  // 类别 D · 容器/环境感知
  {
    rule: {
      id: "mongo-resources-wt-cache-container-limit",
      reason: "容器内 WT cache 超 cgroup 限制 · 触发 OOM kill",
      threshold: ">= 1 (cache 等于或超过容器内存限制)",
      metric_expr: "serverStatus.wiredTiger.cache['maximum bytes configured'] / hostInfo.system.memLimitMB",
    },
    cases: [
      { name: "POS · 16GB cache · 容器限 16GB", metrics: { "serverStatus.wiredTiger.cache['maximum bytes configured']": 17179869184, "hostInfo.system.memLimitMB": 16384 }, expected: true },
      { name: "NEG · 8GB cache · 容器限 16GB", metrics: { "serverStatus.wiredTiger.cache['maximum bytes configured']": 8589934592, "hostInfo.system.memLimitMB": 16384 }, expected: false },
    ],
  },

  // 类别 E · 复合条件
  {
    rule: {
      id: "mongo-runtime-ldap-retrycount-zero",
      reason: "LDAP 重试次数为 0 · LDAP 服务抖动时直接报错 · 影响可用性",
      threshold: "> 0 when ldapRetryCount = 0 and LDAP authorization is enabled",
      metric_expr: "serverStatus.connections.current",
    },
    cases: [
      { name: "POS · LDAP enabled + retry=0 + 100 conn", metrics: { "serverStatus.connections.current": 100, ldapAuthEnabled: true, ldapRetryCount: 0 }, expected: true },
      { name: "NEG · LDAP enabled + retry=3", metrics: { "serverStatus.connections.current": 100, ldapAuthEnabled: true, ldapRetryCount: 3 }, expected: false, note: "retry=3 ≠ 0 → 条件不满足" },
    ],
  },
];

// ============================================================================
// LLM judge prompt
// ============================================================================

const SYSTEM = `你是 MongoDB 性能诊断 rule judge · 判断**当前指标快照下这条规则的关切是否成立**。

【关键: 不要死板套字段 · 看规则的实质意图】

每条规则给你 reason + threshold + metric_expr · 这三个字段是从历史蒸馏来的 · 可能不规范:
- metric_expr 字段可能只是"辅助指标" · 不是判断的全部
- threshold 字段可能把"主阈值"+ "前置条件 when X" 混在一句里
- 字段单位可能不一致(bytes vs MB) · 你做计算时必须自己单位换算

判断方法:
1. 读 reason · 理解规则**真正在防什么问题**
2. 读 threshold + metric_expr · 提取触发条件(包括 when 前置)
3. 在指标快照里找匹配字段 · 必要时单位换算(1 MB=1048576 bytes · 1 GB=1073741824 bytes)
4. 综合判断: **如果客户当前真的处在这条规则要预防的危险状态 · 就 fire**

防错点:
- threshold "> X" 表示 metric > X 才 fire · metric=0.5 vs threshold=1.15 → 0.5 不 > 1.15 → NOT fire
- "when retry=0" 是前置条件 · 不是要 metric > 0 · 是要 retry=0 + 该规则的危险条件成立才 fire
- 单位不一致就换算 · 4GB cache 占 32GB RAM 是 12.5% 不是 131
- triggered 字段必须跟 evidence 的结论方向一致 · 内部矛盾就降 confidence 到 0.3

输出 JSON · 字段务必一致:
{
  "triggered": true|false,
  "evidence": "实际值: X · 阈值: Y · 单位换算: Z · 结论: 触发/不触发 · 因为 ...",
  "confidence": 0..1
}`;

function buildUserPrompt(rule, metrics) {
  return `规则:
  id:          ${rule.id}
  reason:      ${rule.reason}
  threshold:   ${rule.threshold}
  metric_expr: ${rule.metric_expr}

当前指标(JSON · 字段名跟 metric_expr 对应):
${JSON.stringify(metrics, null, 2)}

判断: 这条规则现在 fire 吗?`;
}

async function judge(rule, metrics) {
  const resp = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: buildUserPrompt(rule, metrics) },
    ],
    temperature: 0,
  });
  const txt = resp.choices[0].message.content;
  try {
    return { ...JSON.parse(txt), _raw: txt, _usage: resp.usage };
  } catch (e) {
    return { triggered: null, evidence: "PARSE_FAIL: " + txt, confidence: 0, _raw: txt };
  }
}

// ============================================================================
// 跑 16 用例
// ============================================================================

async function main() {
  console.log(`[poc] model=${MODEL} · cases=${TESTS.flatMap(t => t.cases).length}`);
  console.log();

  const results = [];
  let totalTokens = 0;

  for (const test of TESTS) {
    for (const c of test.cases) {
      process.stdout.write(`[${test.rule.id}] ${c.name} ... `);
      const t0 = Date.now();
      const verdict = await judge(test.rule, c.metrics);
      const dt = Date.now() - t0;
      totalTokens += verdict._usage?.total_tokens || 0;
      const got = verdict.triggered;
      const ok = got === c.expected;
      const flag = ok ? "✅" : "❌";
      console.log(`${flag} got=${got} expect=${c.expected} (${dt}ms · conf=${verdict.confidence})`);
      results.push({ rule_id: test.rule.id, case: c.name, expected: c.expected, got, ok, evidence: verdict.evidence, confidence: verdict.confidence });
    }
  }

  console.log();
  console.log("=== 准确率报告 ===");
  const okCount = results.filter(r => r.ok).length;
  const acc = (okCount / results.length * 100).toFixed(1);
  console.log(`总用例: ${results.length}`);
  console.log(`通过: ${okCount}`);
  console.log(`准确率: ${acc}%`);
  console.log(`总 token: ${totalTokens}`);
  console.log(`成本估算 (gpt-4o-mini · $0.15/M in · $0.6/M out · 大约): $${(totalTokens / 1000000 * 0.4).toFixed(4)}`);
  console.log();

  console.log("=== 错误用例(误判) ===");
  for (const r of results.filter(r => !r.ok)) {
    console.log(`❌ ${r.rule_id} · ${r.case}`);
    console.log(`   expected=${r.expected} · got=${r.got} · conf=${r.confidence}`);
    console.log(`   LLM evidence: ${r.evidence}`);
  }

  // 按规则细分
  console.log();
  console.log("=== 按规则准确率 ===");
  const byRule = {};
  for (const r of results) {
    if (!byRule[r.rule_id]) byRule[r.rule_id] = { ok: 0, total: 0 };
    byRule[r.rule_id].total++;
    if (r.ok) byRule[r.rule_id].ok++;
  }
  for (const [id, s] of Object.entries(byRule)) {
    const flag = s.ok === s.total ? "✅" : "⚠️";
    console.log(`${flag} ${id} · ${s.ok}/${s.total}`);
  }
}

main().catch(e => {
  console.error("fatal:", e);
  process.exit(1);
});
