/**
 * rule-engine — 声明式规则引擎
 *
 * 从 rules 表读取规则定义, 按 JSON 里的 metrics/checks/recommendations
 * 对采集到的指标做评估, 输出 CheckResult.
 *
 * 替代手写的 os-checks.ts / kunpeng-checks.ts / mongo/checks.ts 等 65 个 CheckFn.
 */

import type {
  CheckResult, Bucket, Severity, EngineName,
  Scope, Evidence, Impact, Citation, Recommendation,
  FixCost, ImpactMetric,
} from "./models.js";
import { okResult, infoResult, finding } from "./models.js";
import { evaluateRule as evalRuleV2, type RuleV2, type CheckV2 } from "./rule-engine-v2.js";

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface MetricDef {
  key: string;
  cmd: string | null;
  parse?: string;
}

export interface WhenClause {
  key: string;
  op: string;
  value: string;
}

export interface CheckDef {
  metric: string;
  op: string;
  value: string;
  when?: WhenClause | null;
}

export interface RecommendationDef {
  action: string;
  rationale: string;
  cost: string;
}

export interface RuleRow {
  rule_id: string;
  engine: string;
  bucket: number;
  severity: string;
  title: string;
  description: string | null;
  metrics: MetricDef[];
  checks: CheckDef[];
  recommendations: RecommendationDef[];
  source_url: string | null;
  source_title: string | null;
  engine_version_min: string | null;
  engine_version_max: string | null;
  arch: string | null;
  vendor: string | null;
  enabled: number;
}

export interface RuleCheckResult {
  rule_id: string;
  engine: string;
  bucket: number;
  severity: string;
  title: string;
  status: "finding" | "ok" | "info" | "skipped";
  summary: string;
  description: string | null;
  recommendations: RecommendationDef[];
  source_url: string | null;
  /** 触发的 check 详情（仅 finding 时有） */
  triggered_check?: { metric: string; actual: string; op: string; expected: string };
}

// ---------------------------------------------------------------------------
// 核心: 评估单条规则
// ---------------------------------------------------------------------------

/**
 * 对单条规则执行评估.
 *
 * @param rule      - 从 rules 表解析出的规则行
 * @param collected - SSH 批量采集后解析出的 Map<metric_key, value>
 * @returns         - 评估结果
 */
export function evaluateRule(
  rule: RuleRow,
  collected: Map<string, string>,
): RuleCheckResult {
  const base = {
    rule_id: rule.rule_id,
    engine: rule.engine,
    bucket: rule.bucket,
    severity: rule.severity,
    title: rule.title,
    description: rule.description,
    recommendations: rule.recommendations,
    source_url: rule.source_url,
  };

  // 没有 checks → info 类规则 (只采集不判断)
  if (!rule.checks || rule.checks.length === 0) {
    return { ...base, status: "info", summary: `${rule.title}（信息采集）` };
  }

  // 逐条 check
  for (const check of rule.checks) {
    // when 前置条件
    if (check.when) {
      const condVal = collected.get(check.when.key);
      if (condVal === undefined) continue; // 前置条件指标未采集 → 跳过此 check
      if (!evalOp(check.when.op, condVal, check.when.value)) continue;
    }

    const actual = collected.get(check.metric);
    if (actual === undefined) continue; // 指标未采集 → 跳过

    // op=custom 表示从 rules.json 导入的未实装规则（metric_expr 是表达式, 非简单比较）
    if (check.op === "custom") continue;

    if (evalOp(check.op, actual, check.value)) {
      return {
        ...base,
        status: "finding",
        summary: `${check.metric}=${actual} · 期望 ${check.op} ${check.value}`,
        triggered_check: {
          metric: check.metric,
          actual,
          op: check.op,
          expected: check.value,
        },
      };
    }
  }

  // 所有 check 都通过（或未触发）→ ok
  return { ...base, status: "ok", summary: `${rule.title}（正常）` };
}

// ---------------------------------------------------------------------------
// 批量评估
// ---------------------------------------------------------------------------

/**
 * 对一组规则批量评估.
 *
 * @param rules     - 从 rules 表加载的规则数组
 * @param collected - SSH 批量采集后解析出的 Map<metric_key, value>
 * @returns         - 所有规则的评估结果
 */
export function evaluateAll(
  rules: RuleRow[],
  collected: Map<string, string>,
): RuleCheckResult[] {
  return rules.map((r) => evaluateRule(r, collected));
}

// ---------------------------------------------------------------------------
// 从 SQLite 行解析 RuleRow
// ---------------------------------------------------------------------------

/**
 * 将 SQLite SELECT 返回的原始行转换为 RuleRow.
 * JSON 字段 (metrics/checks/recommendations) 从 TEXT 反序列化.
 */
export function parseRuleRow(row: Record<string, unknown>): RuleRow {
  return {
    rule_id: row.rule_id as string,
    engine: row.engine as string,
    bucket: row.bucket as number,
    severity: row.severity as string,
    title: row.title as string,
    description: (row.description as string) || null,
    metrics: safeParseJson(row.metrics as string, []),
    checks: safeParseJson(row.checks as string, []),
    recommendations: safeParseJson(row.recommendations as string, []),
    source_url: (row.source_url as string) || null,
    source_title: (row.source_title as string) || null,
    engine_version_min: (row.engine_version_min as string) || null,
    engine_version_max: (row.engine_version_max as string) || null,
    arch: (row.arch as string) || null,
    vendor: (row.vendor as string) || null,
    enabled: row.enabled as number,
  };
}

// ---------------------------------------------------------------------------
// 采集命令自动聚合
// ---------------------------------------------------------------------------

/**
 * 从一组规则中提取去重的 OS 层采集命令, 拼成批量 shell 命令.
 * 替代手写的 collect-cmds.json/osBatchCmd.
 */
export function buildOsBatchCmd(rules: RuleRow[]): string {
  const cmds = new Map<string, string>();
  for (const rule of rules) {
    for (const m of rule.metrics) {
      if (!m.cmd || cmds.has(m.key)) continue;
      // DB 层指标 (cmd=null 或 parse 以 db: 开头) 不走 OS batch
      if (m.parse?.startsWith("db:")) continue;
      cmds.set(m.key, `echo '###${m.key.toUpperCase()}###' && (${m.cmd} 2>/dev/null || echo unknown)`);
    }
  }
  if (cmds.size === 0) return "echo done";
  return "echo '###OS_BATCH_BEGIN###' ; " + [...cmds.values()].join(" && ");
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/** 通用比较运算 */
function evalOp(op: string, actual: string | undefined, expected: string): boolean {
  if (actual === undefined || actual === null) return false;
  const a = actual.trim();
  const e = expected.trim();

  switch (op) {
    case "eq":
      return a === e;
    case "ne":
      return a !== e;
    case "gt": {
      const na = parseFloat(a), ne = parseFloat(e);
      return Number.isFinite(na) && Number.isFinite(ne) && na > ne;
    }
    case "gte": {
      const na = parseFloat(a), ne = parseFloat(e);
      return Number.isFinite(na) && Number.isFinite(ne) && na >= ne;
    }
    case "lt": {
      const na = parseFloat(a), ne = parseFloat(e);
      return Number.isFinite(na) && Number.isFinite(ne) && na < ne;
    }
    case "lte": {
      const na = parseFloat(a), ne = parseFloat(e);
      return Number.isFinite(na) && Number.isFinite(ne) && na <= ne;
    }
    case "regex":
      try { return new RegExp(e).test(a); } catch { return false; }
    case "contains":
      return a.toLowerCase().includes(e.toLowerCase());
    default:
      return false;
  }
}

function safeParseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

// ---------------------------------------------------------------------------
// 桥接: RuleCheckResult → CheckResult (cli-diagnose 消费)
// ---------------------------------------------------------------------------

/** cost 字符串映射到枚举 */
function toFixCost(cost: string): FixCost {
  if (cost === "trivial") return "trivial";
  if (cost === "restart_engine" || cost === "需重启服务") return "restart_engine";
  return "schema_migration";
}

/** bucket 数字安全转换 */
function toBucket(n: number): Bucket {
  if (n >= 1 && n <= 5) return n as Bucket;
  return 1;
}

/**
 * 将 rule-engine 的简化输出 RuleCheckResult 转为
 * cli-diagnose 期望的完整 CheckResult 格式.
 */
export function toCheckResult(
  r: RuleCheckResult,
  scope: Scope,
): CheckResult {
  const bucket = toBucket(r.bucket);

  // 构建 recommendations 数组
  const recommendations: Recommendation[] = (r.recommendations || []).map((rec) => ({
    action: rec.action,
    rationale: rec.rationale,
    type: "mitigate" as const,
    fix_cost: toFixCost(rec.cost),
    verifiable: rec.cost === "trivial",
  }));

  // 构建 citations
  const citations: Citation[] = r.source_url
    ? [{ title: r.title, url: r.source_url }]
    : [];

  if (r.status === "finding") {
    const t = r.triggered_check!;
    return finding({
      id: r.rule_id,
      title: r.title,
      severity: r.severity as "warning" | "critical",
      bucket,
      scope,
      summary: r.summary,
      description: r.description || r.summary,
      reason: `${t.metric}=${t.actual}（期望 ${t.op} ${t.expected}）`,
      evidence: [{
        kind: "metric",
        value: `${t.metric}=${t.actual}`,
        measured_at: new Date().toISOString(),
      }],
      impact: {
        metric: "db_time_pct" as ImpactMetric,
        value: r.severity === "critical" ? 30 : 10,
        unit: "percent",
        confidence: "medium",
      },
      citations,
      recommendations,
      needs_human_review: recommendations.length === 0,
    });
  }

  if (r.status === "info") {
    return infoResult({
      id: r.rule_id,
      title: r.title,
      bucket,
      scope,
      summary: r.summary,
      reason: r.description || "信息采集",
    });
  }

  // ok
  return okResult({
    id: r.rule_id,
    title: r.title,
    bucket,
    scope,
    summary: r.summary,
    reason: r.description || "检查通过",
    citations,
  });
}

/**
 * 一站式: 加载规则 → 评估 → 转 CheckResult[].
 * 直接返回 cli-diagnose 可消费的数组.
 */
export function evaluateRulesAsCheckResults(
  rules: RuleRow[],
  collected: Map<string, string>,
  scope: Scope,
): CheckResult[] {
  return evaluateAll(rules, collected).map((r) => toCheckResult(r, scope));
}

// ---------------------------------------------------------------------------
// v2 桥接: 从 sqlite 行 + nested raw metrics → CheckResult
// ---------------------------------------------------------------------------

export interface V2RuleRow extends RuleRow {
  v2_when: string | null;
  v2_checks: string | null;
  fix: string | null;
  fix_cost: string | null;
  source_quote: string | null;
}

/** SQLite row → V2RuleRow · 在 parseRuleRow 基础上补 v2 字段 */
export function parseV2RuleRow(row: Record<string, unknown>): V2RuleRow {
  return {
    ...parseRuleRow(row),
    v2_when: (row.v2_when as string) || null,
    v2_checks: (row.v2_checks as string) || null,
    fix: (row.fix as string) || null,
    fix_cost: (row.fix_cost as string) || null,
    source_quote: (row.source_quote as string) || null,
  };
}

/**
 * 评估 v2 规则 · metrics 走 nested 形态(serverStatus.x.y / hostInfo.x.y).
 * 返回 CheckResult[] · skipped 状态返 info(skip_reason=runtime_data_missing).
 */
export function evaluateV2RulesAsCheckResults(
  rows: V2RuleRow[],
  metrics: Record<string, unknown>,
  scope: Scope,
): CheckResult[] {
  const out: CheckResult[] = [];
  for (const row of rows) {
    let when: CheckV2[] = [];
    let checks: CheckV2[] = [];
    try {
      when = row.v2_when ? JSON.parse(row.v2_when) : [];
      checks = row.v2_checks ? JSON.parse(row.v2_checks) : [];
    } catch {
      out.push(infoResult({
        id: row.rule_id,
        title: row.title,
        bucket: toBucket(row.bucket),
        scope,
        summary: `${row.title}（v2 规则解析失败）`,
        reason: "v2_when/v2_checks 不是合法 JSON",
      }));
      continue;
    }
    if (checks.length === 0) continue;

    const rule: RuleV2 = { rule_id: row.rule_id, when, checks };
    const r = evalRuleV2(rule, metrics);

    if (r.status === "finding") {
      const t = r.triggered_check!;
      const expr = t.compute ?? t.metric ?? "";
      const recs: Recommendation[] = row.fix ? [{
        action: row.fix,
        rationale: row.description || row.title,
        type: "mitigate",
        fix_cost: toFixCost(row.fix_cost || ""),
        verifiable: row.fix_cost === "trivial",
      }] : [];
      const citations: Citation[] = row.source_url
        ? [{ title: row.source_title || row.title, url: row.source_url }]
        : [];
      // 保留规则源 severity(info/warning/critical) · finding() 已扩展支持 info
      const sev = (row.severity || "warning").toLowerCase();
      const severity: "info" | "warning" | "critical" =
        sev === "critical" ? "critical" : sev === "info" ? "info" : "warning";
      const impactValue = severity === "critical" ? 30 : severity === "warning" ? 10 : 3;
      out.push(finding({
        id: row.rule_id,
        title: row.title,
        severity,
        bucket: toBucket(row.bucket),
        scope,
        summary: `${expr}=${formatActual(t.actual)} · 期望 ${t.op} ${t.value}`,
        description: row.description || row.title,
        reason: `${expr} → ${formatActual(t.actual)}（期望 ${t.op} ${t.value}${t.unit ? " " + t.unit : ""}）`,
        evidence: [{
          kind: "metric",
          value: `${expr}=${formatActual(t.actual)}`,
          measured_at: new Date().toISOString(),
          source_url: row.source_url || undefined,
        }],
        impact: {
          metric: "db_time_pct",
          value: impactValue,
          unit: "percent",
          confidence: "medium",
        },
        citations,
        recommendations: recs,
        needs_human_review: recs.length === 0,
      }));
    } else if (r.status === "ok") {
      out.push(okResult({
        id: row.rule_id,
        title: row.title,
        bucket: toBucket(row.bucket),
        scope,
        summary: `${row.title}（正常）`,
        reason: row.description || "v2 检查通过",
        citations: row.source_url ? [{ title: row.source_title || row.title, url: row.source_url }] : [],
      }));
    } else if (r.status === "skipped") {
      out.push(infoResult({
        id: row.rule_id,
        title: row.title,
        bucket: toBucket(row.bucket),
        scope,
        summary: `${row.title}（条件不满足 · 已跳过）`,
        reason: r.skipped_reason || "when 不满足",
        skip_reason: "runtime_data_missing",
      }));
    } else {
      out.push(infoResult({
        id: row.rule_id,
        title: row.title,
        bucket: toBucket(row.bucket),
        scope,
        summary: `${row.title}（评估错误）`,
        reason: r.error || "unknown error",
        skip_reason: "runtime_data_missing",
      }));
    }
  }
  return out;
}

function formatActual(v: unknown): string {
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(4);
  }
  return String(v);
}

