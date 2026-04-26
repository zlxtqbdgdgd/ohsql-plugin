/**
 * perf-kp-sql/models — Gold Standard CheckResult schema (v0.3).
 *
 * 对齐业界 8 家(pganalyze / Datadog Watchdog / AWS DevOps Guru /
 * Oracle ADDM / Percona PMM / MongoDB Atlas / D-Bot / Google SRE)
 * finding payload 字段共现矩阵,详见 spec § 3.6。
 *
 * 破坏性变更:不保留 v0.2 的 `current: string` / `refs: string[]` /
 * `fix: string` / `layer: "kunpeng"|"os"|"db"`。所有规则一次迁移。
 */

// ---------------------------------------------------------------------------
// Enums & primitives
// ---------------------------------------------------------------------------

/** Severity 序数 · 小写对齐 Linear / Atlas 风 · 对比 v0.2 大写 */
export type Severity = "info" | "warning" | "critical" | "ok";

export type Bucket = 1 | 2 | 3 | 4 | 5;
// 1 Resources · 2 Config · 3 Design · 4 Query · 5 Runtime

export type Confidence = "high" | "medium" | "low";

export type FixCost = "trivial" | "restart_engine" | "schema_migration";

export type SourceTier = "official" | "vendor-blog" | "community";

export type Arch = "arm64" | "x86_64";

export type Vendor = "kunpeng" | "graviton" | "ampere" | "intel" | "amd";

export type EngineName = "mongo";

/**
 * Google SRE postmortem action type(5 种) · 强制每条建议声明生命周期角色。
 * 出处:https://sre.google/workbook/postmortem-culture/  (postmortem template · action items)
 */
export type RecType = "prevent" | "mitigate" | "detect" | "repair" | "investigate";

/**
 * Impact metric 北极星枚举 · 禁止自由字符串 · 保证跨规则可横向排序
 * 业界参考:Oracle ADDM `Impact % of DB time` / Atlas `wasted_bytes`。
 */
export type ImpactMetric =
  | "latency_p95_ms"
  | "throughput_qps"
  | "cache_miss_rate"
  | "db_time_pct"
  | "wasted_bytes"
  | "connection_util_pct";

export const IMPACT_METRICS: readonly ImpactMetric[] = [
  "latency_p95_ms",
  "throughput_qps",
  "cache_miss_rate",
  "db_time_pct",
  "wasted_bytes",
  "connection_util_pct",
];

// ---------------------------------------------------------------------------
// Composite field shapes (spec § 3.6)
// ---------------------------------------------------------------------------

export interface Scope {
  engine: EngineName;
  instance: string;
  arch?: Arch;
  vendor?: Vendor;
  os?: string;
  engine_version?: string;
  time_window?: { start: string; end: string };
}

export interface Evidence {
  kind: "metric" | "query" | "plan" | "log" | "config" | "chunk";
  value: string | number;
  source_url?: string;
  measured_at?: string;
}

export interface Impact {
  metric: ImpactMetric;
  value: number;
  unit: string;
  confidence: Confidence;
}

export interface Citation {
  title: string;
  url: string;
  anchor?: string;
}

export interface Recommendation {
  action: string;
  rationale: string;
  type: RecType;
  benefit?: { metric: ImpactMetric; value: number };
  fix_cost: FixCost;
  /** Wave 3: MVL 闭环验证是否适用(spec § 3.7)*/
  verifiable?: boolean;
  /** v0.4.4 · 该 recommendation 的官方文档 URL · 用于 footnote 优先级 1
   *  推荐列 footnote 取 URL 顺序:fix_url > citations[0].url > evidence_trail.footnote_refs[0] */
  fix_url?: string;
  /** v0.4.4 · 与 fix_url 配合 · 校验命令(可选) */
  verify?: string;
  /** v0.4.4 · 与 verify 配合 · 期望结果(可选) */
  expected?: string;
}

/**
 * StructuredRationale · v0.3.2 新增 · 规则级知识承载点。
 *
 * 目的:把产品文档的决策内容沉淀到规则点上,替代传统 RAG。
 *
 *   summary         · 一句话:该现象为何是问题
 *   mechanism       · 机制展开:根因如何产生(khugepaged 扫描 / LSE 原子指令缺失...)
 *   trade_offs      · 修 vs 不修的代价 / 两个方向的成本权衡
 *   when_to_deviate · 边界场景:规则不适用的环境 / 可容忍的条件
 *
 * 填写准则(spec § 12 v1 scope):
 * - 每字段 100-300 字 · 合计 400-1000 字 · 足以承载 60-75% 文档决策内容
 * - 引用来源走 `CheckResult.citations[]`,正文不重复链接
 * - 若某字段在该规则场景下不适用,填 "n/a" 而非空串,显式说明
 */
export interface StructuredRationale {
  summary: string;
  mechanism: string;
  trade_offs: string;
  when_to_deviate: string;
}

// ---------------------------------------------------------------------------
// CheckResult (Gold Standard · 8/8 家共识字段全覆盖)
// ---------------------------------------------------------------------------

export interface CheckResult {
  id: string;                        // canonical id(pganalyze 风),如 "mongo.thp.kernel_always"
  title: string;                     // 人读短名
  severity: Severity;

  scope: Scope;

  summary: string;                   // 一句话(Datadog 摘要 / DevOps Guru 二分之一)
  description: string;               // 完整描述
  reason: string;                    // 为什么告警(AWS DevOps Guru)

  evidence: Evidence[];              // warning+ ⇒ length ≥ 1(CI 校验)
  impact: Impact;                    // 量化到北极星指标
  citations: Citation[];             // PMM 风 · warning+ ⇒ length ≥ 1

  recommendations: Recommendation[]; // 有序 · ADDM Actions 风

  bucket: Bucket;
  workload_tag?: "oltp" | "olap" | "mixed";
  needs_human_review: boolean;

  /** 推荐值展示字符串(用于报告"关键指标·已健康"和"需要调优"表的"推荐值"列) ·
   *  check 函数设置 · 禁止 LLM 自编 · 如 "≥ 128000" / "never" / "≤ 1" */
  threshold_display?: string;

  /**
   * v0.3.2 新增 · 规则级结构化知识(见 StructuredRationale 注释)。
   * 填充是**增量的** · 未填的规则不影响运行。
   * 最终状态:所有 critical + 关键 warning 规则填满。
   */
  rationale?: StructuredRationale;

  /**
   * v0.3.2 新增 · BIOS / 固件 类规则标记。
   * true = 该规则只能通过 BIOS 面板修改,不能 shell 执行。
   * CI 约束(validate-rules.mjs):
   *   surfaceable_only=true ⇒ severity ≤ warning && recommendations[].type = "detect"
   * 这保证 BIOS 建议只出现在报告"提示"区,不会被 MVL runner 误执行。
   */
  surfaceable_only?: boolean;

  /**
   * v0.5 · 跳过原因标记 · 仅当 severity=info 因 gating 失败而返回时填。
   *
   * - `arch_mismatch`        · 当前 arch ≠ 规则要求(如 ARM64 规则在 x86 跑)
   * - `vendor_mismatch`      · 当前 vendor ≠ 规则要求(如 kunpeng 规则在 Intel 跑)
   * - `os_mismatch`          · 当前 OS ≠ 规则要求(如 openEuler 规则在 Ubuntu 跑)
   * - `runtime_data_missing` · runtime 采集数据缺失(如 standalone mongo 无 oplog)
   *
   * 报告 phase3 矩阵下方分两段渲染:
   *   - 前三类 → "环境不匹配"段(诊断完整)
   *   - 最后一类 → "⚠ 数据缺失"段(诊断不完整 · 建议补采)
   */
  skip_reason?: "arch_mismatch" | "vendor_mismatch" | "os_mismatch" | "runtime_data_missing";
}

// ---------------------------------------------------------------------------
// DiagContext · 采集到的指标上下文
// ---------------------------------------------------------------------------

export interface DiagContext {
  os_metrics: Record<string, unknown>;
  db_metrics: Record<string, unknown>;
  db_type: string;                   // "mongo"
}

export function osVal<T = unknown>(ctx: DiagContext, key: string, def?: T): T {
  const v = ctx.os_metrics[key];
  return (v === undefined ? def : v) as T;
}

export function dbVal<T = unknown>(ctx: DiagContext, key: string, def?: T): T {
  const v = ctx.db_metrics[key];
  return (v === undefined ? def : v) as T;
}

/**
 * 从采集到的指标推断 scope(arch / vendor / os / engine_version)。
 * Rule 可直接用 `deriveScope(ctx, "mongo")` 获得默认 scope,再按需 override。
 */
export function deriveScope(ctx: DiagContext, engine: EngineName, instance = "default"): Scope {
  const os = ctx.os_metrics as Record<string, unknown>;
  const db = ctx.db_metrics as Record<string, unknown>;

  const archRaw = String(os.arch ?? "").toLowerCase();
  const arch: Arch | undefined = archRaw.includes("aarch64") || archRaw.includes("arm")
    ? "arm64"
    : archRaw.includes("x86") || archRaw.includes("amd64")
      ? "x86_64"
      : undefined;

  const cpuVendor = String(os.cpu_vendor ?? os.cpu_model ?? "").toLowerCase();
  const vendor: Vendor | undefined = cpuVendor.includes("hisilicon") || cpuVendor.includes("kunpeng") || cpuVendor.includes("taishan")
    ? "kunpeng"
    : cpuVendor.includes("graviton") || cpuVendor.includes("aws")
      ? "graviton"
      : cpuVendor.includes("ampere") || cpuVendor.includes("altra")
        ? "ampere"
        : cpuVendor.includes("amd")
          ? "amd"
          : cpuVendor.includes("intel") || cpuVendor.includes("genuine")
            ? "intel"
            : undefined;

  const osName = String(os.os_id ?? os.os_name ?? "").toLowerCase();
  const osTag = osName.includes("openeuler")
    ? "openeuler"
    : osName.includes("almalinux") || osName.includes("alma")
      ? "almalinux"
      : osName.includes("ubuntu")
        ? "ubuntu"
        : osName.includes("centos")
          ? "centos"
          : osName.includes("rhel") || osName.includes("redhat")
            ? "rhel"
            : undefined;

  const engine_version = db.version as string | undefined;

  return {
    engine,
    instance,
    arch,
    vendor,
    os: osTag,
    engine_version,
  };
}

// ---------------------------------------------------------------------------
// CheckFn signature
// ---------------------------------------------------------------------------

export type CheckFn = (ctx: DiagContext) => CheckResult;

// ---------------------------------------------------------------------------
// Factory helpers · 减少 rule 文件样板
// ---------------------------------------------------------------------------

export interface OkArgs {
  id: string;
  title: string;
  bucket: Bucket;
  scope: Scope;
  summary: string;
  reason: string;
  description?: string;
  evidence?: Evidence[];
  impactMetric?: ImpactMetric;
  threshold_display?: string;
  citations?: Citation[];  // v0.3.9 · 让健康指标也能挂 footnote · 表"推荐值"引自何处
}

/** 构造 `severity="ok"` 结果 · v0.3.9 · 可选挂 citations 让"已健康"表显示来源 [参考N] */
export function okResult(args: OkArgs): CheckResult {
  return {
    id: args.id,
    title: args.title,
    severity: "ok",
    scope: args.scope,
    summary: args.summary,
    description: args.description ?? args.summary,
    reason: args.reason,
    evidence: args.evidence ?? [],
    impact: { metric: args.impactMetric ?? "db_time_pct", value: 0, unit: "percent", confidence: "high" },
    citations: args.citations ?? [],
    recommendations: [],
    bucket: args.bucket,
    needs_human_review: false,
    threshold_display: args.threshold_display,
  };
}

export interface InfoArgs extends OkArgs {
  /** v0.5 · gating 失败 / 数据缺失时的跳过原因 · 见 CheckResult.skip_reason */
  skip_reason?: CheckResult["skip_reason"];
}

/** 构造 `severity="info"` 结果 · 通常表达"未采集/未适用/环境信息" */
export function infoResult(args: InfoArgs): CheckResult {
  const base = { ...okResult(args), severity: "info" as const };
  if (args.skip_reason) {
    return { ...base, skip_reason: args.skip_reason };
  }
  return base;
}

export interface FindingArgs {
  id: string;
  title: string;
  /** info 表示"规则源标 info 级 · 触发后保留 info 严重度"(如 capacity 警示类) */
  severity: "info" | "warning" | "critical";
  bucket: Bucket;
  scope: Scope;
  summary: string;
  description: string;
  reason: string;
  evidence: Evidence[];              // ≥ 1 (warning+ CI 校验 · info 不强制)
  impact: Impact;
  citations: Citation[];             // ≥ 1 (warning+ CI 校验 · info 不强制)
  recommendations: Recommendation[];
  workload_tag?: "oltp" | "olap" | "mixed";
  needs_human_review?: boolean;
  /** v0.3.2 · 结构化 rationale(可选 · 增量填充)*/
  rationale?: StructuredRationale;
  /** v0.3.2 · BIOS/固件类规则标记(见 CheckResult.surfaceable_only 注释)*/
  surfaceable_only?: boolean;
  /** 推荐值展示字符串 · 同 CheckResult.threshold_display */
  threshold_display?: string;
}

/** 构造 warning/critical/info finding · schema-level 硬约束的入口 */
export function finding(args: FindingArgs): CheckResult {
  return {
    id: args.id,
    title: args.title,
    severity: args.severity,
    scope: args.scope,
    summary: args.summary,
    description: args.description,
    reason: args.reason,
    evidence: args.evidence,
    impact: args.impact,
    citations: args.citations,
    recommendations: args.recommendations,
    bucket: args.bucket,
    workload_tag: args.workload_tag,
    needs_human_review: args.needs_human_review ?? false,
    rationale: args.rationale,
    surfaceable_only: args.surfaceable_only,
    threshold_display: args.threshold_display,
  };
}

// ===========================================================================
// Verify section · FixExperiment 契约(spec § 3.7)
// ===========================================================================
//
// Wave 3 交付边界:本节 **只定义 schema**。runner 的真正实装排 Phase 2。
// 即便不跑 runner,diagnose.mjs 也会为每条 `fix_cost=trivial` 的 recommendation
// 生成一个 `FixExperiment` 模板(classification 设 "pending"),写到
// `artifacts/experiments/*.json`,让"闭环验证"在 spec / 契约 / 交付物里可见可查。
//
// 业界参考:Oracle SQL Tuning Advisor 6 维度 side-by-side + 9 次 warmup /
//           iBTune Paxos follower swap + SSAD / Chaos Mesh StatusCheck
//           abortWithStatusCheck / λ-Tune 时间预算 bound + pt-query-digest
//           fingerprint-normalized diff · AWR workload-drift 闸门。

export type FixClassification =
  | "pending"        // 未执行 · Wave 3 模板默认态
  | "improved"
  | "no_effect"
  | "regressed"
  | "inconclusive"   // workload drift 过大
  | "aborted";       // guardrail 触发早停

/** Apply + reverse 必须成对 · 没有 reverse 的 fix 永远不自动验证 */
export interface ApplyAction {
  /** 要执行的 shell / SQL / mongosh 命令 */
  action: string;
  /** 回滚命令(Chaos Mesh 风 safety-abort) */
  reverse: string;
}

/** 预声明期望信号(Oracle STA 风) · 禁止事后 cherry-pick */
export interface ExpectedSignal {
  metric: ImpactMetric;
  direction: "up" | "down";
  /** 最小效应 · 例如 ↓ 15% 的 p95 latency 才算 improved */
  min_effect: number;
  unit: string;
}

/** 业务健康信号(iBTune SSAD 风) · 任一超阈值触发 reverse */
export interface Guardrail {
  metric: string;
  threshold: number;
  direction: "lt" | "gt";  // "slow_query_count gt 10" 等
  unit?: string;
}

export interface MetricSnapshot {
  metrics: Record<string, number>;
  /** query / command fingerprint 分布 · pt-query-digest 风 */
  fingerprint_hist: Record<string, number>;
  taken_at?: string;
}

export interface FixExperiment {
  id: string;                          // "exp-<uuid>"
  finding_id: string;                  // CheckResult.id
  rule_title: string;                  // 冗余,方便 artifact 独立阅读
  apply: ApplyAction;

  expected_signal: ExpectedSignal;
  guardrails: Guardrail[];

  /** 窗口时长 · λ-Tune 风时间预算 bound · 默认 300s */
  window_sec: number;
  /** warm-up 时长 · Oracle STA 风冷缓存规避 · 默认 60s */
  warm_sec: number;

  before: MetricSnapshot | null;
  after: MetricSnapshot | null;

  classification: FixClassification;
  /** workload drift 指标 · AWR "%Diff > 20%" 风阈值 */
  drift_kl: number | null;
  rolled_back: boolean;

  /** Oracle STA 风 6 列 before/after 对比表 · Markdown */
  evidence_table: string | null;

  /** 生成模板时的时间(非执行时间) */
  templated_at: string;
}

// ---------------------------------------------------------------------------
// Template factory · diagnose.mjs 每次生成这个,不执行
// ---------------------------------------------------------------------------

export interface TemplateArgs {
  findingId: string;
  ruleTitle: string;
  action: string;
  reverse?: string;                    // 不提供则 apply 无法验证
  expectedMetric: ImpactMetric;
  expectedDirection: "up" | "down";
  expectedMinEffect?: number;          // 默认 15%
  guardrails?: Guardrail[];
  windowSec?: number;
  warmSec?: number;
}

/** 默认业务 guardrail 集合(iBTune SSAD 风 · 不看单一指标) */
export const DEFAULT_GUARDRAILS: Guardrail[] = [
  { metric: "error_rate", threshold: 0.01, direction: "gt", unit: "fraction" },
  { metric: "slow_query_delta", threshold: 5, direction: "gt", unit: "count_per_min" },
  { metric: "connection_reset_rate", threshold: 0.005, direction: "gt", unit: "fraction" },
];

export function templateFixExperiment(args: TemplateArgs): FixExperiment {
  const id = `exp-${args.findingId}-${Date.now().toString(36)}`;
  return {
    id,
    finding_id: args.findingId,
    rule_title: args.ruleTitle,
    apply: {
      action: args.action,
      reverse: args.reverse ?? "(未声明 reverse · 不支持自动验证)",
    },
    expected_signal: {
      metric: args.expectedMetric,
      direction: args.expectedDirection,
      min_effect: args.expectedMinEffect ?? 15,
      unit: "percent",
    },
    guardrails: args.guardrails ?? DEFAULT_GUARDRAILS,
    window_sec: args.windowSec ?? 300,
    warm_sec: args.warmSec ?? 60,
    before: null,
    after: null,
    classification: "pending",
    drift_kl: null,
    rolled_back: false,
    evidence_table: null,
    templated_at: new Date().toISOString(),
  };
}
