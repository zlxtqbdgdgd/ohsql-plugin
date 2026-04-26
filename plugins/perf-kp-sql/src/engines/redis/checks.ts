/**
 * @deprecated Phase 3 · 该文件已被 rule-engine.ts + rules 表替代。
 * 保留仅为向后兼容，请在回归测试通过后删除。
 */
/**
 * redis-checks — Redis 核心诊断规则(v0.3 Gold Standard schema · 6 条)。
 */

import {
  type CheckFn,
  type DiagContext,
  deriveScope,
  finding,
  infoResult,
  okResult,
} from "../../models.js";
import { toFloat as toNum } from "../../shared/utils.js";
import type { RedisMetrics } from "./collector.js";

function rdScope(ctx: DiagContext) {
  return deriveScope(ctx, "redis");
}

function skipIfFailed(ctx: DiagContext, id: string, title: string, bucket: 1 | 2 | 3 | 4 | 5) {
  const m = ctx.db_metrics as RedisMetrics;
  if (m._db_collection_failed) {
    return infoResult({
      id,
      title,
      bucket,
      scope: rdScope(ctx),
      summary: "Redis 采集失败",
      reason: m._db_collection_error || "collection failed",
    });
  }
  return null;
}

// ---------------------------------------------------------------------------
// D-REDIS-MAXMEMORY
// ---------------------------------------------------------------------------

export const check_redis_maxmemory: CheckFn = (ctx) => {
  const id = "redis.config.maxmemory";
  const title = "maxmemory";
  const skip = skipIfFailed(ctx, id, title, 2);
  if (skip) return skip;
  const scope = rdScope(ctx);

  const m = ctx.db_metrics as RedisMetrics;
  const mm = toNum(m.config?.maxmemory);
  const used = toNum(m.info?.used_memory);

  if (mm === 0) {
    return finding({
      id,
      title,
      severity: "critical",
      bucket: 2,
      scope,
      summary: "maxmemory=0 unlimited",
      description: "maxmemory=0 意味着无限制,OOM 时 Redis 被内核杀掉,生产必须设置",
      reason: "maxmemory=0 · 无限制 · 生产风险高",
      evidence: [{ kind: "config", value: "maxmemory=0" }],
      impact: { metric: "db_time_pct", value: 40, unit: "percent", confidence: "high" },
      citations: [
        { title: "Redis · Memory Optimization", url: "https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/memory-optimization/" },
      ],
      recommendations: [
        {
          action: "redis-cli CONFIG SET maxmemory 4gb && redis-cli CONFIG REWRITE",
          rationale: "生产设为物理内存 50-70%",
          type: "repair",
          fix_cost: "trivial",
          verifiable: true,
        },
      ],
    });
  }
  const ratio = used > 0 ? used / mm : 0;
  if (ratio > 0.9) {
    return finding({
      id,
      title,
      severity: "warning",
      bucket: 2,
      scope,
      summary: `used/max=${(ratio * 100).toFixed(1)}% > 90%`,
      description: "已用内存接近 maxmemory,即将触发淘汰",
      reason: `used=${(used / 1024 / 1024).toFixed(0)}MB / max=${(mm / 1024 / 1024).toFixed(0)}MB`,
      evidence: [
        { kind: "metric", value: `used_memory=${used}` },
        { kind: "config", value: `maxmemory=${mm}` },
      ],
      impact: { metric: "cache_miss_rate", value: +(ratio * 100).toFixed(1), unit: "percent", confidence: "high" },
      citations: [
        { title: "Redis · Eviction policies", url: "https://redis.io/docs/latest/develop/reference/eviction/" },
      ],
      recommendations: [
        {
          action: "扩容 maxmemory 或排查大 key",
          rationale: "避免过高的淘汰率和潜在的 OOM",
          type: "mitigate",
          fix_cost: "trivial",
          verifiable: true,
        },
      ],
    });
  }
  return okResult({
    id,
    title,
    bucket: 2,
    scope,
    summary: `max=${(mm / 1024 / 1024).toFixed(0)}MB · used=${(used / 1024 / 1024).toFixed(0)}MB`,
    reason: "maxmemory 合理且未接近上限",
  });
};

// ---------------------------------------------------------------------------
// D-REDIS-EVICTION-POLICY
// ---------------------------------------------------------------------------

export const check_redis_maxmemory_policy: CheckFn = (ctx) => {
  const id = "redis.config.maxmemory_policy";
  const title = "eviction policy";
  const skip = skipIfFailed(ctx, id, title, 2);
  if (skip) return skip;
  const scope = rdScope(ctx);

  const m = ctx.db_metrics as RedisMetrics;
  const p = m.config?.["maxmemory-policy"] || "";
  if (!p) {
    return infoResult({ id, title, bucket: 2, scope, summary: "未采集 policy", reason: "CONFIG GET maxmemory-policy 返回空" });
  }
  if (p === "noeviction") {
    return finding({
      id,
      title,
      severity: "warning",
      bucket: 2,
      scope,
      summary: "policy=noeviction",
      description: "noeviction 下 maxmemory 满后所有写请求失败;缓存场景应用 allkeys-*",
      reason: "maxmemory-policy=noeviction · 缓存场景不适用",
      evidence: [{ kind: "config", value: `maxmemory-policy=${p}` }],
      impact: { metric: "cache_miss_rate", value: 15, unit: "percent", confidence: "medium" },
      citations: [
        { title: "Redis · Eviction policies", url: "https://redis.io/docs/latest/develop/reference/eviction/" },
      ],
      recommendations: [
        {
          action: "redis-cli CONFIG SET maxmemory-policy allkeys-lfu && redis-cli CONFIG REWRITE",
          rationale: "缓存场景用 allkeys-lfu;混用数据用 volatile-lru",
          type: "repair",
          fix_cost: "trivial",
          verifiable: true,
        },
      ],
    });
  }
  return okResult({ id, title, bucket: 2, scope, summary: `policy=${p}`, reason: "淘汰策略设置合理" });
};

// ---------------------------------------------------------------------------
// D-REDIS-PERSISTENCE
// ---------------------------------------------------------------------------

export const check_redis_persistence: CheckFn = (ctx) => {
  const id = "redis.config.persistence";
  const title = "Persistence";
  const skip = skipIfFailed(ctx, id, title, 2);
  if (skip) return skip;
  const scope = rdScope(ctx);

  const m = ctx.db_metrics as RedisMetrics;
  const aof = m.config?.appendonly || "no";
  const save = m.config?.save || "";
  if (aof === "no" && !save.trim()) {
    return finding({
      id,
      title,
      severity: "warning",
      bucket: 2,
      scope,
      summary: "AOF=off 且 save=空",
      description: "无任何持久化,Redis 内存数据丢失不可恢复",
      reason: `appendonly=${aof} · save='${save}'`,
      evidence: [
        { kind: "config", value: `appendonly=${aof}` },
        { kind: "config", value: `save='${save}'` },
      ],
      impact: { metric: "db_time_pct", value: 30, unit: "percent", confidence: "medium" },
      citations: [
        { title: "Redis · Persistence", url: "https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/" },
      ],
      recommendations: [
        {
          action: "redis-cli CONFIG SET appendonly yes && redis-cli CONFIG REWRITE",
          rationale: "生产开 AOF everysec 或 RDB+AOF 双保险",
          type: "prevent",
          fix_cost: "trivial",
          verifiable: true,
        },
      ],
    });
  }
  return okResult({
    id,
    title,
    bucket: 2,
    scope,
    summary: `AOF=${aof} · save='${save || "none"}'`,
    reason: "至少一种持久化已启用",
  });
};

// ---------------------------------------------------------------------------
// D-REDIS-MEM-FRAG
// ---------------------------------------------------------------------------

export const check_redis_memory_frag: CheckFn = (ctx) => {
  const id = "redis.runtime.mem_fragmentation_ratio";
  const title = "内存碎片率";
  const skip = skipIfFailed(ctx, id, title, 5);
  if (skip) return skip;
  const scope = rdScope(ctx);

  const m = ctx.db_metrics as RedisMetrics;
  const frag = toNum(m.info?.mem_fragmentation_ratio);
  if (frag === 0) {
    return infoResult({ id, title, bucket: 5, scope, summary: "无 mem_fragmentation_ratio", reason: "INFO memory 未返回" });
  }
  if (frag >= 1.0 && frag <= 1.5) {
    return okResult({ id, title, bucket: 5, scope, summary: `frag=${frag.toFixed(2)}`, reason: "碎片率在 1.0-1.5 健康区" });
  }
  const severity = "warning";
  const description = frag > 1.5
    ? "碎片率过高,大量内存浪费,考虑 activedefrag 或 restart"
    : "碎片率 < 1,内存不足被 swap";
  return finding({
    id,
    title,
    severity,
    bucket: 5,
    scope,
    summary: `frag=${frag.toFixed(2)} 偏离健康区`,
    description,
    reason: `mem_fragmentation_ratio=${frag.toFixed(2)} · 健康区 1.0-1.5`,
    evidence: [{ kind: "metric", value: `mem_fragmentation_ratio=${frag.toFixed(2)}` }],
    impact: { metric: "wasted_bytes", value: frag > 1.5 ? +((frag - 1) * 100).toFixed(1) : 10, unit: "percent", confidence: "medium" },
    citations: [
      { title: "Redis · Memory Optimization", url: "https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/memory-optimization/" },
    ],
    recommendations: [
      {
        action: "redis-cli CONFIG SET activedefrag yes",
        rationale: "启用主动碎片整理;严重时考虑 restart",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// D-REDIS-SLOWLOG
// ---------------------------------------------------------------------------

export const check_redis_slowlog: CheckFn = (ctx) => {
  const id = "redis.runtime.slowlog";
  const title = "slowlog";
  const skip = skipIfFailed(ctx, id, title, 5);
  if (skip) return skip;
  const scope = rdScope(ctx);

  const m = ctx.db_metrics as RedisMetrics;
  const entries = m.slowlog || [];
  if (entries.length === 0) {
    return okResult({ id, title, bucket: 5, scope, summary: "0 条", reason: "slowlog 无记录" });
  }
  const maxUs = Math.max(...entries.map((e) => e.duration_us));
  if (maxUs <= 100_000) {
    return infoResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: `${entries.length} entries · max=${(maxUs / 1000).toFixed(1)}ms`,
      reason: "存在慢请求但未超 100ms",
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 5,
    scope,
    summary: `max=${(maxUs / 1000).toFixed(1)}ms > 100ms`,
    description: "单线程 Redis 慢命令会阻塞所有连接",
    reason: `最慢请求 ${(maxUs / 1000).toFixed(1)}ms 超 100ms 阈值`,
    evidence: [{ kind: "metric", value: `slowlog_max_us=${maxUs}` }],
    impact: { metric: "latency_p95_ms", value: +(maxUs / 1000).toFixed(1), unit: "ms", confidence: "high" },
    citations: [
      { title: "Redis · Latency Optimization", url: "https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/" },
    ],
    recommendations: [
      {
        action: "检查 SLOWLOG GET · 避免 KEYS/SORT 大集合 · 拆 HGET/HSET 小批量",
        rationale: "单命令阻塞影响所有客户端,必须优化或拆分",
        type: "repair",
        fix_cost: "trivial",
        verifiable: false,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// D-REDIS-CLIENTS
// ---------------------------------------------------------------------------

export const check_redis_clients: CheckFn = (ctx) => {
  const id = "redis.runtime.connected_clients";
  const title = "clients 连接数";
  const skip = skipIfFailed(ctx, id, title, 5);
  if (skip) return skip;
  const scope = rdScope(ctx);

  const m = ctx.db_metrics as RedisMetrics;
  const c = toNum(m.info?.connected_clients);
  const max = toNum(m.config?.maxclients);
  const pct = max > 0 ? (c / max) * 100 : 0;
  if (pct <= 80 || max === 0) {
    return okResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: `clients=${c}${max > 0 ? `/${max} (${pct.toFixed(1)}%)` : ""}`,
      reason: "连接使用率正常",
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 5,
    scope,
    summary: `${pct.toFixed(1)}% of maxclients`,
    description: "连接使用率 > 80%,接近 maxclients 上限",
    reason: `connected_clients=${c} / maxclients=${max}`,
    evidence: [
      { kind: "metric", value: `connected_clients=${c}` },
      { kind: "config", value: `maxclients=${max}` },
    ],
    impact: { metric: "connection_util_pct", value: +pct.toFixed(1), unit: "percent", confidence: "high" },
    citations: [
      { title: "Redis · Admin Guide (maxclients)", url: "https://redis.io/docs/latest/operate/oss_and_stack/management/admin/" },
    ],
    recommendations: [
      {
        action: "redis-cli CONFIG SET maxclients 10000",
        rationale: "扩容 maxclients 以支持当前并发",
        type: "mitigate",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
  });
};

export const redisChecks: CheckFn[] = [
  check_redis_maxmemory,
  check_redis_maxmemory_policy,
  check_redis_persistence,
  check_redis_memory_frag,
  check_redis_slowlog,
  check_redis_clients,
];
