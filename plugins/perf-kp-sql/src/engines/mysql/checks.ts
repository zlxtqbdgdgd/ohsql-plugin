/**
 * @deprecated Phase 3 · 该文件已被 rule-engine.ts + rules 表替代。
 * 保留仅为向后兼容，请在回归测试通过后删除。
 */
/**
 * mysql-checks — MySQL 核心诊断规则(v0.3 Gold Standard schema · 7 条)。
 *
 * 每条规则对应 data/mysql/rules.json 的 source / refs;但 check() 是手写 TS,
 * 确保 deterministic。完整覆盖靠 LLM 参考 rules.json 做补充判断。
 */

import {
  type CheckFn,
  type DiagContext,
  deriveScope,
  finding,
  infoResult,
  okResult,
  dbVal,
  osVal,
} from "../../models.js";
import { toFloat as toNum } from "../../shared/utils.js";
import type { MysqlMetrics } from "./collector.js";

function msScope(ctx: DiagContext) {
  return deriveScope(ctx, "mysql");
}

function skipIfFailed(ctx: DiagContext, id: string, title: string, bucket: 1 | 2 | 3 | 4 | 5) {
  const m = ctx.db_metrics as MysqlMetrics;
  if (m._db_collection_failed) {
    return infoResult({
      id,
      title,
      bucket,
      scope: msScope(ctx),
      summary: "MySQL 采集失败",
      reason: m._db_collection_error || "collection failed",
    });
  }
  return null;
}

// ---------------------------------------------------------------------------
// D-MYSQL-INNODB-BP
// ---------------------------------------------------------------------------

export const check_mysql_innodb_buffer_pool_size: CheckFn = (ctx) => {
  const id = "mysql.config.innodb_buffer_pool_size";
  const title = "InnoDB Buffer Pool 大小";
  const skip = skipIfFailed(ctx, id, title, 2);
  if (skip) return skip;
  const scope = msScope(ctx);

  const m = ctx.db_metrics as MysqlMetrics;
  const bp = toNum(m.variables?.innodb_buffer_pool_size);
  const mem_mb = toNum((ctx.os_metrics as Record<string, unknown>).total_mem_mb);
  const mem = mem_mb * 1024 * 1024;
  const pctOfMem = mem > 0 ? (bp / mem) * 100 : 0;

  if (bp === 0) {
    return infoResult({ id, title, bucket: 2, scope, summary: "未采集到", reason: "innodb_buffer_pool_size 读取失败" });
  }
  if (pctOfMem >= 25 && pctOfMem <= 80) {
    return okResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: `BP=${(bp / 1024 / 1024).toFixed(0)}MB (~${pctOfMem.toFixed(1)}% of RAM)`,
      reason: "BP 占比合理(25% ~ 80%)",
    });
  }

  const sev = pctOfMem < 25 ? "warning" : "warning";
  const reason = pctOfMem < 25
    ? `BP ${(bp / 1024 / 1024).toFixed(0)}MB 仅占物理内存 ${pctOfMem.toFixed(1)}% · 生产建议 50-75%`
    : `BP ${pctOfMem.toFixed(1)}% 过大 · 可能挤压 OS cache / 其他进程`;

  return finding({
    id,
    title,
    severity: sev,
    bucket: 2,
    scope,
    summary: `${(bp / 1024 / 1024).toFixed(0)} MB (~${pctOfMem.toFixed(1)}%) · 偏离 50-75%`,
    description: "InnoDB Buffer Pool 大小直接决定命中率;过小增加磁盘 IO,过大挤压 OS cache。",
    reason,
    evidence: [
      { kind: "config", value: `innodb_buffer_pool_size=${bp}` },
      { kind: "metric", value: `total_mem_mb=${mem_mb}` },
    ],
    impact: { metric: "cache_miss_rate", value: pctOfMem < 25 ? 30 : 10, unit: "percent", confidence: "medium" },
    citations: [
      { title: "MySQL · InnoDB Buffer Pool Size", url: "https://dev.mysql.com/doc/refman/8.0/en/innodb-buffer-pool.html" },
    ],
    recommendations: [
      {
        action: "SET GLOBAL innodb_buffer_pool_size = <bytes>;  # 或改 my.cnf 重启",
        rationale: "OLTP 生产 50-75% 物理内存",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// D-MYSQL-FLUSH-LOG
// ---------------------------------------------------------------------------

export const check_mysql_innodb_flush_log: CheckFn = (ctx) => {
  const id = "mysql.config.innodb_flush_log_at_trx_commit";
  const title = "InnoDB flush_log_at_trx_commit";
  const skip = skipIfFailed(ctx, id, title, 2);
  if (skip) return skip;
  const scope = msScope(ctx);

  const m = ctx.db_metrics as MysqlMetrics;
  const v = m.variables?.innodb_flush_log_at_trx_commit;
  if (!v) {
    return infoResult({ id, title, bucket: 2, scope, summary: "未采集到变量", reason: "show variables 未返回" });
  }
  if (v === "1") {
    return okResult({ id, title, bucket: 2, scope, summary: "=1(ACID 严格)", reason: "金融/订单场景正确设置" });
  }
  if (v === "2") {
    return infoResult({ id, title, bucket: 2, scope, summary: "=2(每事务写 log,每秒 flush)", reason: "弱耐久但高吞吐" });
  }
  // =0
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 2,
    scope,
    summary: "=0 仅适合批量导入",
    description: "进程崩溃可能丢失最近 1 秒事务",
    reason: "innodb_flush_log_at_trx_commit=0 · 批处理 / TPC-H 可用,OLTP 危险",
    evidence: [{ kind: "config", value: `innodb_flush_log_at_trx_commit=${v}` }],
    impact: { metric: "db_time_pct", value: 20, unit: "percent", confidence: "medium" },
    citations: [
      { title: "MySQL · InnoDB Performance Tuning", url: "https://dev.mysql.com/doc/refman/8.0/en/innodb-performance.html" },
    ],
    recommendations: [
      {
        action: "SET GLOBAL innodb_flush_log_at_trx_commit = 1;",
        rationale: "OLTP 恢复 ACID 严格",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// D-MYSQL-SYNC-BINLOG
// ---------------------------------------------------------------------------

export const check_mysql_sync_binlog: CheckFn = (ctx) => {
  const id = "mysql.config.sync_binlog";
  const title = "sync_binlog";
  const skip = skipIfFailed(ctx, id, title, 2);
  if (skip) return skip;
  const scope = msScope(ctx);

  const m = ctx.db_metrics as MysqlMetrics;
  const v = m.variables?.sync_binlog;
  if (!v) {
    return infoResult({ id, title, bucket: 2, scope, summary: "未采集", reason: "show variables 未返回" });
  }
  if (v === "1") {
    return okResult({ id, title, bucket: 2, scope, summary: "sync_binlog=1", reason: "严格耐久 · 主从一致性最稳" });
  }
  if (v === "0") {
    return finding({
      id,
      title,
      severity: "warning",
      bucket: 2,
      scope,
      summary: "sync_binlog=0",
      description: "crash 可能丢失 binlog,主从不一致风险",
      reason: "sync_binlog=0 · 不落盘",
      evidence: [{ kind: "config", value: `sync_binlog=0` }],
      impact: { metric: "db_time_pct", value: 15, unit: "percent", confidence: "medium" },
      citations: [
        { title: "MySQL · Replication Configuration (sync_binlog)", url: "https://dev.mysql.com/doc/refman/8.0/en/replication-configuration.html" },
      ],
      recommendations: [
        {
          action: "SET GLOBAL sync_binlog = 1;",
          rationale: "恢复主从一致性保障",
          type: "repair",
          fix_cost: "trivial",
          verifiable: true,
        },
      ],
    });
  }
  return infoResult({ id, title, bucket: 2, scope, summary: `sync_binlog=${v}`, reason: "每 N 次事务落盘 · 批处理常见" });
};

// ---------------------------------------------------------------------------
// D-MYSQL-SLOW-LOG
// ---------------------------------------------------------------------------

export const check_mysql_slow_query_log: CheckFn = (ctx) => {
  const id = "mysql.config.slow_query_log";
  const title = "Slow Query Log";
  const skip = skipIfFailed(ctx, id, title, 2);
  if (skip) return skip;
  const scope = msScope(ctx);

  const m = ctx.db_metrics as MysqlMetrics;
  const on = m.variables?.slow_query_log;
  const lqt = toNum(m.variables?.long_query_time);

  if (on === undefined) {
    return infoResult({ id, title, bucket: 2, scope, summary: "未采集", reason: "show variables 未返回" });
  }
  if (on === "OFF" || on === "0") {
    return finding({
      id,
      title,
      severity: "warning",
      bucket: 2,
      scope,
      summary: "slow_query_log OFF",
      description: "未启用慢查询日志,慢 SQL 无法捕获",
      reason: "slow_query_log OFF · 生产必开",
      evidence: [{ kind: "config", value: `slow_query_log=${on}` }],
      impact: { metric: "db_time_pct", value: 5, unit: "percent", confidence: "high" },
      citations: [
        { title: "MySQL · Slow Query Log", url: "https://dev.mysql.com/doc/refman/8.0/en/slow-query-log.html" },
      ],
      recommendations: [
        {
          action: "SET GLOBAL slow_query_log = 'ON'; SET GLOBAL long_query_time = 1;",
          rationale: "开启慢查询日志并把阈值降到 1s",
          type: "detect",
          fix_cost: "trivial",
          verifiable: true,
        },
      ],
    });
  }
  if (lqt > 2) {
    return finding({
      id,
      title,
      severity: "warning",
      bucket: 2,
      scope,
      summary: `long_query_time=${lqt}s 偏高`,
      description: "阈值过高,< 2s 的慢请求捕获不到",
      reason: `long_query_time=${lqt}s · 推荐 ≤ 1`,
      evidence: [{ kind: "config", value: `long_query_time=${lqt}` }],
      impact: { metric: "db_time_pct", value: 3, unit: "percent", confidence: "medium" },
      citations: [
        { title: "MySQL · Slow Query Log", url: "https://dev.mysql.com/doc/refman/8.0/en/slow-query-log.html" },
      ],
      recommendations: [
        {
          action: "SET GLOBAL long_query_time = 1;",
          rationale: "把阈值降到 1s 以充分覆盖慢 SQL",
          type: "detect",
          fix_cost: "trivial",
          verifiable: true,
        },
      ],
    });
  }
  return okResult({ id, title, bucket: 2, scope, summary: `enabled · long_query_time=${lqt}`, reason: "慢查询日志配置合理" });
};

// ---------------------------------------------------------------------------
// D-MYSQL-BP-HIT
// ---------------------------------------------------------------------------

export const check_mysql_buffer_pool_hit_rate: CheckFn = (ctx) => {
  const id = "mysql.runtime.buffer_pool_hit_rate";
  const title = "InnoDB Buffer Pool 命中率";
  const skip = skipIfFailed(ctx, id, title, 5);
  if (skip) return skip;
  const scope = msScope(ctx);

  const m = ctx.db_metrics as MysqlMetrics;
  const reads = toNum(m.status?.Innodb_buffer_pool_reads);
  const req = toNum(m.status?.Innodb_buffer_pool_read_requests);
  if (req === 0) {
    return infoResult({ id, title, bucket: 5, scope, summary: "无请求", reason: "实例未接入流量" });
  }
  const hit = (1 - reads / req) * 100;
  if (hit >= 99) {
    return okResult({ id, title, bucket: 5, scope, summary: `hit=${hit.toFixed(2)}%`, reason: "命中率正常" });
  }
  const severity = hit < 95 ? "warning" : "info";
  if (severity === "info") {
    return infoResult({ id, title, bucket: 5, scope, summary: `hit=${hit.toFixed(2)}%`, reason: "OLTP 生产期望 > 99.5%" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 5,
    scope,
    summary: `hit=${hit.toFixed(2)}% < 95%`,
    description: "Buffer Pool 命中率偏低,可能是 BP 太小或冷启动",
    reason: `Innodb_buffer_pool_reads=${reads} / read_requests=${req}`,
    evidence: [
      { kind: "metric", value: `innodb_bp_reads=${reads}` },
      { kind: "metric", value: `innodb_bp_read_requests=${req}` },
    ],
    impact: { metric: "cache_miss_rate", value: +(100 - hit).toFixed(1), unit: "percent", confidence: "high" },
    citations: [
      { title: "MySQL · InnoDB Buffer Pool", url: "https://dev.mysql.com/doc/refman/8.0/en/innodb-buffer-pool.html" },
    ],
    recommendations: [
      {
        action: "增大 innodb_buffer_pool_size 至物理内存 50-75% · 或对冷启动做 warmup",
        rationale: "提升命中率直接降低磁盘 IO",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// D-MYSQL-CONNECTIONS
// ---------------------------------------------------------------------------

export const check_mysql_connections: CheckFn = (ctx) => {
  const id = "mysql.runtime.connection_util";
  const title = "MySQL 连接使用率";
  const skip = skipIfFailed(ctx, id, title, 5);
  if (skip) return skip;
  const scope = msScope(ctx);

  const m = ctx.db_metrics as MysqlMetrics;
  const conn = toNum(m.status?.Threads_connected);
  const max = toNum(m.variables?.max_connections);
  const pct = max > 0 ? (conn / max) * 100 : 0;
  if (pct <= 80) {
    return okResult({ id, title, bucket: 5, scope, summary: `${conn}/${max} (${pct.toFixed(1)}%)`, reason: "连接使用率正常" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 5,
    scope,
    summary: `${conn}/${max} (${pct.toFixed(1)}%) 偏高`,
    description: "连接使用率 > 80% 接近 max_connections 上限,新连接可能被拒",
    reason: `Threads_connected=${conn} / max_connections=${max}`,
    evidence: [
      { kind: "metric", value: `Threads_connected=${conn}` },
      { kind: "config", value: `max_connections=${max}` },
    ],
    impact: { metric: "connection_util_pct", value: +pct.toFixed(1), unit: "percent", confidence: "high" },
    citations: [
      { title: "MySQL · Server System Variables (max_connections)", url: "https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html" },
    ],
    recommendations: [
      {
        action: "SET GLOBAL max_connections = <N>;  # 或评估应用侧连接池",
        rationale: "兜底扩容 · 根因常在应用连接池配置",
        type: "mitigate",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// D-MYSQL-SCHEMA(INFO 级画像)
// ---------------------------------------------------------------------------

export const check_mysql_schema_growth: CheckFn = (ctx) => {
  const id = "mysql.design.schema_sizes";
  const title = "Schema 规模画像";
  const skip = skipIfFailed(ctx, id, title, 3);
  if (skip) return skip;
  const scope = msScope(ctx);

  const m = ctx.db_metrics as MysqlMetrics;
  const stats = m.schema_stats || [];
  if (stats.length === 0) {
    return infoResult({ id, title, bucket: 3, scope, summary: "无用户 schema", reason: "实例暂无业务库" });
  }
  const total = stats.reduce((s, x) => s + x.total_mb, 0);
  const top = [...stats].sort((a, b) => b.total_mb - a.total_mb).slice(0, 3);
  return infoResult({
    id,
    title,
    bucket: 3,
    scope,
    summary: `${stats.length} schema · total=${total.toFixed(0)}MB`,
    reason: `top3: ${top.map((t) => `${t.schema}=${t.total_mb.toFixed(0)}MB`).join(" · ")}`,
  });
};

export const mysqlChecks: CheckFn[] = [
  check_mysql_innodb_buffer_pool_size,
  check_mysql_innodb_flush_log,
  check_mysql_sync_binlog,
  check_mysql_slow_query_log,
  check_mysql_buffer_pool_hit_rate,
  check_mysql_connections,
  check_mysql_schema_growth,
];
