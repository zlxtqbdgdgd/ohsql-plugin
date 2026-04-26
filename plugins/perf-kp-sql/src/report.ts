/**
 * report — impact-ranked 报告结构构建器(v0.3 Gold Standard schema)。
 *
 * 职责:不做 markdown 渲染(由 LLM 按 templates/report.md 完成),而是:
 *   1. 为每个 CheckResult 计算 impact_score
 *   2. 按 impact DESC 排序,切分 Top Issues / Full Findings / Evidence Trail
 *   3. 构造 ReportInput(LLM 消费的结构化对象)
 *
 * impact_score = severity_weight × impact.confidence × (1 / primary fix_cost)
 *
 * 详见 spec § 3.3 / § 3.6
 */

import type {
  CheckResult,
  Confidence,
  FixCost,
  Recommendation,
  Severity,
} from "./models.js";
import {
  type Module,
  MODULE_ORDER,
  type WaitClass,
  WAIT_CLASS_ORDER,
  moduleOf,
  waitClassOf,
} from "./shared/utils.js";

// ---------------------------------------------------------------------------
// Scoring constants
// ---------------------------------------------------------------------------

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 10,
  warning: 5,
  info: 1,
  ok: 0,
};

const CONFIDENCE_WEIGHT: Record<Confidence, number> = {
  high: 1.0,
  medium: 0.7,
  low: 0.4,
};

const FIX_COST_WEIGHT: Record<FixCost, number> = {
  trivial: 1,
  restart_engine: 3,
  schema_migration: 10,
};

// ---------------------------------------------------------------------------
// Report input structure (LLM consumes this)
// ---------------------------------------------------------------------------

export interface ReportMetadata {
  engine: string;
  host: string;
  port?: number;
  db_version?: string;
  arch?: string;
  vendor?: string;
  os?: string;
  scanned_rules: number;
  scanned_kb_docs: number;
  generated_at: string; // ISO
  report_path?: string;
  artifacts_dir?: string;
  ascii_fallback?: boolean;
}

export interface RankedResult extends CheckResult {
  impact_score: number;
  priority: "P1" | "P2" | "P3" | "P4";
  /** v0.3.8 · 该 rule 的 citations 在全报告 evidence_trail 里对应的 footnote 编号数组(按 citations 顺序) · LLM 直接用不用自己 map · 省 token + 防错 */
  footnote_refs?: number[];
}

/**
 * 权威等级 · 按 citation URL 前缀映射 · 报告渲染时加中文前缀 tag
 *
 * tier 分 4 档(v0.3.5 新增 · 对齐业界审计报告分级):
 *   vendor-primary · 硬件厂商原厂(鲲鹏 / AWS Graviton / Ampere)
 *   official       · 上游软件官方(MongoDB / MySQL / Redis 官方)
 *   vendor-blog    · 厂商博客(非原厂级 · 如 Percona blog / MongoDB Engineering Blog)
 *   community      · 社区(Stack Overflow / GitHub / blog)
 */
export type AuthorityTier = "vendor-primary" | "official" | "vendor-blog" | "community";

export interface EvidenceRef {
  url: string;              // citation url
  title: string;            // citation title
  anchor?: string;
  used_by_rules: string[];  // rule ids
  tier: AuthorityTier;      // v0.3.5 · 由 URL 前缀推断 · 给 LLM 渲染"参考资料汇总"表用
  label: string;            // v0.3.5 · 中文权威标签前缀(如 `[鲲鹏 BoostKit]` / `[MongoDB 官方]`)
  footnote_n: number;       // v0.3.8 · 全报告唯一的脚注编号 · 对齐 [参考N] 角标 · 在排序后按 1-based 分配
}

/**
 * 按 citation URL 推断权威 tier + 中文 label
 *
 * 业界对应:审计报告 "Basis of Conclusion" 的来源分级范式(PCAOB / SOC2)
 * 给 LLM 渲染时可直接用 label · 不必再从 URL 解析。
 */
export function inferAuthority(url: string): { tier: AuthorityTier; label: string } {
  const u = url.toLowerCase();
  // 鲲鹏原厂 · 按官方文档树分子 label
  if (u.includes("hikunpeng.com")) {
    if (u.includes("/kunpengdbs/"))             return { tier: "vendor-primary", label: "[鲲鹏 BoostKit]" };
    if (u.includes("/perftuning/"))             return { tier: "vendor-primary", label: "[鲲鹏性能优化十板斧]" };
    if (u.includes("/kunpengdevps/"))           return { tier: "vendor-primary", label: "[鲲鹏 DevKit]" };
    if (u.includes("/kunpengtroubleshooting/")) return { tier: "vendor-primary", label: "[鲲鹏故障处理手册]" };
    if (u.includes("/kunpengdevtoolkit/"))      return { tier: "vendor-primary", label: "[鲲鹏代码移植指南]" };
    return { tier: "vendor-primary", label: "[鲲鹏原厂]" };
  }
  // 其他硬件厂商原厂
  if (u.includes("aws.amazon.com") && u.includes("graviton")) return { tier: "vendor-primary", label: "[AWS Graviton]" };
  if (u.includes("amperecomputing.com"))                      return { tier: "vendor-primary", label: "[Ampere]" };
  // 上游 DB 官方
  if (u.includes("mongodb.com/docs"))        return { tier: "official", label: "[MongoDB 官方]" };
  if (u.includes("dev.mysql.com/doc"))       return { tier: "official", label: "[MySQL 官方]" };
  if (u.includes("redis.io/docs"))           return { tier: "official", label: "[Redis 官方]" };
  // 厂商博客
  if (u.includes("percona.com/blog") || u.includes("mongodb.com/blog") || u.includes("huaweicloud.com"))
                                             return { tier: "vendor-blog", label: "[厂商博客]" };
  // 兜底
  return { tier: "community", label: "[社区]" };
}

export interface ReportInput {
  metadata: ReportMetadata;
  top_issues: RankedResult[];
  full_findings: RankedResult[]; // warning + critical + info(按 score 排序)
  ok_findings: RankedResult[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    ok: number;
  };
  /**
   * v0.5 · 模块 × wait_class × severity 三维聚合 · phase3 矩阵渲染源。
   *
   * - 第一维 module · 来自 moduleOf(rule_id):os / 硬件 / mongo / mysql / redis / 其他
   * - 第二维 wait_class · 来自 waitClassOf(rule_id):CPU / I/O / 内存 / 并发 / 网络 / 其他
   * - 第三维 severity · 仅 critical / warning / ok 三档(info 不入矩阵)
   *
   * 渲染时遍历 MODULE_ORDER × WAIT_CLASS_ORDER · 跳过全 0 的 cell。
   */
  /**
   * v0.5.4 · 改名 · 从 by_module_wait_class 简化为 by_module · 拆掉 wait_class 维度
   * (用户反馈"咱们不需要 wait class 呀"· 时间去向 ADDM 范式撤掉)
   */
  by_module: Record<Module, ModuleCellCounts>;
  /**
   * v0.5 · 跳过原因列表 · phase3 矩阵下方"环境不匹配" + "⚠ 数据缺失" 段渲染源。
   *
   * - 来源 · `results.filter(r => r.skip_reason)` · skip_reason 见 CheckResult.skip_reason
   * - 渲染分两段(`renderer` 自行按 reason 分组):
   *   - 环境不匹配 · {arch,vendor,os}_mismatch · 三类合段
   *   - ⚠ 数据缺失 · runtime_data_missing · 醒目段
   */
  unfired_rules: UnfiredRule[];
  evidence_trail: EvidenceRef[];
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/** 取第一条 recommendation 的 fix_cost,作为整条规则的主要修复成本 */
function primaryFixCost(r: CheckResult): FixCost {
  return r.recommendations[0]?.fix_cost ?? "trivial";
}

/** Compute impact_score · 高 = 更紧迫 */
export function computeImpactScore(r: CheckResult): number {
  const sev = SEVERITY_WEIGHT[r.severity] ?? 0;
  const conf = CONFIDENCE_WEIGHT[r.impact?.confidence ?? "high"] ?? 1.0;
  const cost = FIX_COST_WEIGHT[primaryFixCost(r)] ?? 1;
  const costSafe = cost <= 0 ? 1 : cost;
  return +(sev * conf * (1 / costSafe)).toFixed(3);
}

/** Severity + impact.confidence → display priority (P1..P4) */
export function priorityFor(r: CheckResult): RankedResult["priority"] {
  switch (r.severity) {
    case "critical":
      return "P1";
    case "warning":
      return r.impact?.confidence === "low" ? "P3" : "P2";
    case "info":
      return "P3";
    default:
      return "P4";
  }
}

/**
 * v0.5.6 · 按 module × severity 二维聚合 · phase3 矩阵数据源。
 *
 * 用户反馈(2026-04-25 二轮):
 *   - "如果识别不到的项或者不支持的项就算到通过里面"
 *   - 总计要等于 check_catalog.total(本机实装的全部规则数 · mongo=54 · mysql=34 · redis=33)
 *
 * 过滤规则:**不再过滤** · 所有 result 都计:
 *   - critical / warning 各自计数
 *   - 其余(ok / info / runtime_data_missing / arch_mismatch / vendor_mismatch / os_mismatch)
 *     全计入 ok 桶 · 用户视角 = "未爆出 critical/warning · 算通过"
 *
 * isApplicableForMachine 仍导出 · 但**不**用于矩阵聚合 · 仅 deriveUnfiredRules 等其它段使用
 *
 * 字段含义:critical / warning / ok 三档 · sum = 本机实装规则总数(check_catalog.total)
 */
export interface ModuleCellCounts {
  critical: number;
  warning: number;
  ok: number;
}

export function isApplicableForMachine(r: CheckResult): boolean {
  if (
    r.skip_reason === "arch_mismatch" ||
    r.skip_reason === "vendor_mismatch" ||
    r.skip_reason === "os_mismatch"
  ) {
    return false;
  }
  return true;
}

/**
 * v0.5.6 · 按 module 一维聚合(wait_class 已撤)· phase3 矩阵数据源。
 *
 * 输出形如:
 *   { os:    { critical: 1, warning: 2, ok: 9 },     ← 严重+告警+通过 = 该模块本机实装规则数
 *     硬件:  { critical: 0, warning: 3, ok: 5 },
 *     mongo: { critical: 0, warning: 1, ok: 6 } }
 *
 * 三档之和 = check_catalog.total(本机实装规则数 · 与"识别不到/不支持/已通过"全归 ok)
 */
export function aggregateByModule(
  results: CheckResult[],
): Record<Module, ModuleCellCounts> {
  const out = {} as Record<Module, ModuleCellCounts>;
  for (const m of MODULE_ORDER) {
    out[m] = { critical: 0, warning: 0, ok: 0 };
  }
  for (const r of results) {
    const m = moduleOf(r.id);
    if (r.severity === "critical") out[m].critical += 1;
    else if (r.severity === "warning") out[m].warning += 1;
    else out[m].ok += 1;  // ok / info / runtime_data_missing / arch/vendor/os_mismatch 全归 ok
  }
  return out;
}

/**
 * v0.5 · 派生 unfired_rules 列表 · 仅取 skip_reason 非空的 CheckResult。
 *
 * v0.5.1 · 用户反馈"如何补?" → 每条 unfired 附 `remedy_hint` 中文补采指引(rule_id 查表)。
 * 表内未登记的 rule 走 skip_reason 默认文案("远端开放该字段读权限"/"切换 arch / vendor / OS")。
 *
 * 注意 · skip_reason 仅由:
 *   - shared/{arm64,kunpeng,openeuler}-checks.ts 的 require helper(arch/vendor/os_mismatch)
 *   - engines/<e>/checks.ts 中数据缺失分支 / 平台不适用分支(runtime_data_missing / arch_mismatch)
 * 填入。其它 info 分支(如老版本字段不暴露)不带 skip_reason · 不入此列。
 */
export interface UnfiredRule {
  id: string;
  title: string;
  skip_reason: NonNullable<CheckResult["skip_reason"]>;
  remedy_hint: string;
}

const REMEDY_BY_RULE_ID: Readonly<Record<string, string>> = {
  // mongo runtime data missing · 配复制集 / sharded cluster / 升权限
  "mongo.config.oplog_window_hours":
    "配 mongod 副本集后才有 oplog · /etc/mongod.conf 加 replication.replSetName=rs0 · 重启 · 进 mongosh 跑 rs.initiate()",
  "mongo.runtime.sharded_index_consistency":
    "需 sharded cluster 才有此字段 · standalone / 副本集没有 · 不需补",
  "mongo.runtime.wt_ticket_read":
    "serverStatus.wiredTiger.concurrentTransactions 字段读不到 · 检查 mongo 用户角色至少 clusterMonitor · 或升 mongod 7.0+",
  "mongo.runtime.wt_ticket_write": "同 wt_ticket_read · 同样靠角色或版本",
  "mongo.platform.arm64_microarch":
    "本机非 arm64(可能是 x86_64)· 鲲鹏 arm64 物理机才适用 · 不需补",
  "mongo.config.wt_cache_vs_memory":
    "wiredTiger.cache 字段读不到 · mongo 用户角色升到 clusterMonitor · 或加 --eval 'db.serverStatus({wiredTiger:1})' 显式开启",
  "mongo.storage.journaling_enabled":
    "storageEngine.persistent 字段不暴露 · 通常 mongo 4.0 起默认 true · 升 mongo 用户角色到 clusterMonitor 可读",
};

const REMEDY_BY_SKIP_REASON: Readonly<Record<NonNullable<CheckResult["skip_reason"]>, string>> = {
  arch_mismatch: "切到 arm64 物理机(鲲鹏 / Graviton / Ampere)再跑",
  vendor_mismatch: "切到 Kunpeng 鲲鹏物理机再跑",
  os_mismatch: "切到 openEuler 系统再跑",
  runtime_data_missing: "升 mongo 用户角色 / 检查权限 / 启用相关 mongod 配置",
};

export function deriveUnfiredRules(results: CheckResult[]): UnfiredRule[] {
  // v0.5.2 · 仅返 runtime_data_missing(用户能补采)· 过滤 arch/vendor/os mismatch
  // (用户反馈 · 环境不匹配的没必要显示)
  return results
    .filter((r) => r.skip_reason === "runtime_data_missing")
    .map((r) => ({
      id: r.id,
      title: r.title,
      skip_reason: r.skip_reason!,
      remedy_hint: REMEDY_BY_RULE_ID[r.id] ?? REMEDY_BY_SKIP_REASON[r.skip_reason!],
    }));
}

/** Augment every CheckResult with impact_score + priority */
export function rankResults(results: CheckResult[]): RankedResult[] {
  return results.map((r) => ({
    ...r,
    impact_score: computeImpactScore(r),
    priority: priorityFor(r),
  }));
}

// ---------------------------------------------------------------------------
// Build ReportInput
// ---------------------------------------------------------------------------

export interface BuildReportInputOpts {
  results: CheckResult[];
  metadata: Omit<ReportMetadata, "scanned_rules">;
  topN?: number;
}

export function buildReportInput(opts: BuildReportInputOpts): ReportInput {
  const { results, metadata } = opts;
  const topN = opts.topN ?? 5;

  const ranked = rankResults(results).sort((a, b) => b.impact_score - a.impact_score);
  const actionable = ranked.filter((r) => r.severity === "critical" || r.severity === "warning");
  const info = ranked.filter((r) => r.severity === "info");
  const ok = ranked.filter((r) => r.severity === "ok");

  const top_issues = actionable.slice(0, topN);
  const full_findings = [...actionable, ...info];
  const ok_findings = ok;

  const summary = {
    total: ranked.length,
    critical: actionable.filter((r) => r.severity === "critical").length,
    warning: actionable.filter((r) => r.severity === "warning").length,
    info: info.length,
    ok: ok.length,
  };

  const evidence_trail = collectEvidenceTrail(ranked);

  // v0.3.8: 给每条 ranked rule 预埋 footnote_refs 数组 · LLM 打屏 + 报告渲染直接用
  const urlToN = new Map(evidence_trail.map(e => [e.url, e.footnote_n]));
  const attachFootnotes = (arr: RankedResult[]) =>
    arr.map(r => ({ ...r, footnote_refs: r.citations.map(c => urlToN.get(c.url) ?? 0).filter(n => n > 0) }));

  const by_module = aggregateByModule(results);
  const unfired_rules = deriveUnfiredRules(results);

  return {
    metadata: { ...metadata, scanned_rules: ranked.length },
    top_issues: attachFootnotes(top_issues),
    full_findings: attachFootnotes(full_findings),
    ok_findings: attachFootnotes(ok_findings),
    summary,
    by_module,
    unfired_rules,
    evidence_trail,
  };
}

/** Aggregate all unique citations → which rule ids used each
 *
 * v0.3.5:每条 ref 附带 tier + label(中文权威前缀)· LLM 渲染时直接用 ·
 * 排序改为按 tier 分组(vendor-primary > official > vendor-blog > community)
 * · 组内再按引用次数 desc · 对齐审计报告 Basis of Conclusion 分级范式。
 */
function collectEvidenceTrail(ranked: RankedResult[]): EvidenceRef[] {
  const byUrl = new Map<string, EvidenceRef>();
  for (const r of ranked) {
    for (const c of r.citations) {
      const existing = byUrl.get(c.url);
      if (existing) {
        if (!existing.used_by_rules.includes(r.id)) existing.used_by_rules.push(r.id);
      } else {
        const { tier, label } = inferAuthority(c.url);
        byUrl.set(c.url, {
          url: c.url,
          title: c.title,
          anchor: c.anchor,
          used_by_rules: [r.id],
          tier,
          label,
          footnote_n: 0,  // 占位 · sort 后再分配
        });
      }
    }
  }
  const tierOrder: Record<AuthorityTier, number> = {
    "vendor-primary": 0,
    "official":       1,
    "vendor-blog":    2,
    "community":      3,
  };
  const sorted = [...byUrl.values()].sort((a, b) => {
    const t = tierOrder[a.tier] - tierOrder[b.tier];
    if (t !== 0) return t;
    return b.used_by_rules.length - a.used_by_rules.length;
  });
  // v0.3.8: 按排序后顺序给每条 evidence 分配全报告唯一 footnote 编号(1-based)·
  // LLM 渲染时直接用 rule.citations[].url → evidence_trail 查 footnote_n · 无需自建 map
  sorted.forEach((e, i) => { e.footnote_n = i + 1; });
  return sorted;
}

/** v0.3.8 辅助:给 rule · 返其 citations 对应的 footnote 编号数组(按 citation 顺序)
 * 用于 LLM 渲染打屏 summary 和 report.md 时快速查 [参考N] 编号 · 无需 map 构建
 */
export function citationFootnotes(rule: { citations: Array<{ url: string }> }, trail: EvidenceRef[]): number[] {
  const byUrl = new Map(trail.map(e => [e.url, e.footnote_n]));
  return rule.citations.map(c => byUrl.get(c.url) ?? 0).filter(n => n > 0);
}

// ---------------------------------------------------------------------------
// v0.4.4 · Theme merger — UI 输出前的主题聚合器
// ---------------------------------------------------------------------------

/** 主题 · 与一组 rule_id pattern 绑定 · 同主题多 knob 在 UI 表格合并成一行
 *
 * 设计原则:
 *   1. 只在 UI 输出前加工(renderActionableTable / renderHealthyTable 调用)·
 *      不改 results[] / report_input 的原始数据(HTML 报告仍按原粒度展示)
 *   2. 某主题只命中 1 条 rule → 不合并 · 保持单行
 *   3. severity 取最高(critical > warning > info > ok) · citations / recommendations
 *      合并去重(按 url / action)· wait_class 取主题声明值
 */
export interface Theme {
  /** 主题名 · UI 表格 "项" 列展示 */
  key: string;
  /** wait_class · 主题声明的归类(覆盖子 rule 的 wait_class) */
  wait_class: "CPU" | "I/O" | "内存" | "并发" | "网络";
  /** rule_id 匹配 pattern · 用 `rule_id.includes(pattern)` 判定(业界 Oracle ADDM `waits LIKE '%hugepage%'` 范式) */
  patterns: string[];
}

/** 合并条附带的展示辅助字段(UI 渲染双栏用) */
export interface ThemeMergedInfo {
  theme_key: string;
  wait_class: Theme["wait_class"];
  current: string;
  recommend: string;
  source_rule_ids: string[];
}

/** 5 组主题定义 · 录音 2 问 6 指定 · 不可轻改(改前先和 spec 对齐) */
export const THEME_DEFS: readonly Theme[] = [
  {
    key: "大页内存策略",
    wait_class: "内存",
    patterns: ["thp", "transparent_hugepage", "hugepages", "zone_reclaim"],
  },
  {
    key: "写回与 IO 调度",
    wait_class: "I/O",
    // patterns 以 os.vm.dirty / vm.dirty_ 限定 · 避免错匹 mongo.runtime.wt_cache_dirty_pct
    patterns: ["os.vm.dirty", "vm.dirty_ratio", "vm.dirty_bg", "vm.dirty_background", "vm.dirty_expire", "iosched", "io_scheduler", "device_scheduler"],
  },
  {
    key: "TCP 连接韧性",
    wait_class: "网络",
    patterns: ["tcp_keepalive", "tcp_max_syn", "tcp_retrans"],
  },
  // WT Cache 族分两行 · 配置 / 运行态
  {
    key: "WT Cache · 配置",
    wait_class: "内存",
    patterns: ["wt_cache_vs", "wt_cache_pct"],
  },
  {
    key: "WT Cache · 运行态",
    wait_class: "内存",
    patterns: ["wt_cache_hit", "wt_cache_dirty"],
  },
  {
    key: "NUMA 启动策略",
    wait_class: "内存",
    patterns: ["numa_balancing", "numa.topology", "numa.distance", "numa_interleave", "numa.balancing", "numa.interleave"],
  },
];

function matchesTheme(ruleId: string, theme: Theme): boolean {
  const lower = ruleId.toLowerCase();
  return theme.patterns.some((p) => lower.includes(p.toLowerCase()));
}

const SEV_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2, ok: 3 };

function dedupByKey<T>(arr: T[], keyFn: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

/** Merge 同主题多条 rule → 一条合并 RankedResult · severity 取最严重 · citations/recommendations 合并去重
 *
 * 输入:ranked[] (top_issues 或 ok_findings)
 * 输出:同结构 · 同主题命中 >= 2 条的 collapse · 未命中的原样保留 · 顺序保持稳定
 */
export function mergeThemes(ranked: RankedResult[]): RankedResult[] {
  if (!ranked || ranked.length === 0) return ranked;

  // 1. 按主题分桶(一条 rule 只算入第一个命中的主题 · 避免跨主题重复)
  const themeBuckets = new Map<string, RankedResult[]>();
  const unthemed: RankedResult[] = [];
  const ruleTheme = new Map<string, string>(); // rule.id → theme.key

  for (const r of ranked) {
    let matched: Theme | null = null;
    for (const t of THEME_DEFS) {
      if (matchesTheme(r.id, t)) { matched = t; break; }
    }
    if (!matched) {
      unthemed.push(r);
      continue;
    }
    ruleTheme.set(r.id, matched.key);
    if (!themeBuckets.has(matched.key)) themeBuckets.set(matched.key, []);
    themeBuckets.get(matched.key)!.push(r);
  }

  // 2. 为每主题生成合并条(若只 1 条命中 · 直接保留原条不合并)
  const merged: RankedResult[] = [];
  for (const theme of THEME_DEFS) {
    const bucket = themeBuckets.get(theme.key);
    if (!bucket || bucket.length === 0) continue;
    if (bucket.length === 1) {
      merged.push(bucket[0]!);
      continue;
    }

    // 排 severity → critical first · impact_score 降序次之(保序业界稳定排序)
    const sorted = [...bucket].sort((a, b) => {
      const s = SEV_RANK[a.severity] - SEV_RANK[b.severity];
      if (s !== 0) return s;
      return b.impact_score - a.impact_score;
    });
    const primary = sorted[0]!;

    // current / recommend 拼接 · ` · ` 分隔 · 取每条的 summary / recommendations[0].action
    const currentParts = sorted.map((r) => r.summary).filter((s): s is string => !!s);
    const recommendParts = sorted
      .map((r) => r.recommendations?.[0]?.action)
      .filter((a): a is string => !!a);

    const citationsMerged = dedupByKey(
      sorted.flatMap((r) => r.citations ?? []),
      (c) => c.url,
    );
    const recommendationsMerged = dedupByKey(
      sorted.flatMap((r) => r.recommendations ?? []),
      (rec) => rec.action,
    );

    const mergedResult = {
      ...primary,
      id: `merged:${theme.key}`,
      title: theme.key,
      summary: currentParts.join(" · "),
      description: currentParts.join(" · "),
      reason: sorted.map((r) => r.reason).filter(Boolean).join(" · "),
      citations: citationsMerged,
      recommendations: recommendationsMerged,
      // merged flag · UI 展示双栏时可用于 "current" / "recommend" 多行拼 · wait_class 覆盖子 rule 的默认归类
      merged: {
        theme_key: theme.key,
        wait_class: theme.wait_class,
        current: currentParts.join(" · "),
        recommend: recommendParts.join(" · "),
        source_rule_ids: sorted.map((r) => r.id),
      },
    } as RankedResult & { merged: ThemeMergedInfo };

    merged.push(mergedResult);
  }

  // 3. 输出:按原 ranked 顺序 · 同主题的第一条位置 = 合并条位置 · 后续条过滤
  const themeEmitted = new Set<string>();
  const themeCondensed = new Map<string, RankedResult>();
  for (const m of merged) {
    const tk = (m as RankedResult & { merged?: ThemeMergedInfo }).merged?.theme_key;
    if (tk) themeCondensed.set(tk, m);
  }

  const out: RankedResult[] = [];
  for (const r of ranked) {
    const tk = ruleTheme.get(r.id);
    if (tk && (themeBuckets.get(tk)?.length ?? 0) > 1) {
      if (!themeEmitted.has(tk)) {
        themeEmitted.add(tk);
        const condensed = themeCondensed.get(tk);
        if (condensed) out.push(condensed);
        else out.push(r); // fallback · 理论不到
      }
      continue;
    }
    out.push(r);
  }
  return out;
}

// ---------------------------------------------------------------------------
// v0.4.4 · FootnoteRegistry — 推荐 cell URL → footnote 编号映射器
// ---------------------------------------------------------------------------

/**
 * FootnoteRegistry · 全报告共享一个实例 · 双表"推荐 / 推荐值"列 + 末尾"参考"段共号 ·
 * 撤 v0.4.3 OSC 8 字面输出(LLM 老实复刻 \e]8;; 终端看乱码)· 改 footnote + 末尾参考
 *
 * 使用方:
 *   const reg = new FootnoteRegistry(report_input.evidence_trail);
 *   const cell = `${threshold}${reg.register(url) ? `[参考${reg.register(url)}]` : ""}`;
 *   const footnoteSection = reg.render();
 *
 * 设计:
 *   - 初始化时塞入 evidence_trail · 保留已有 footnote_n(LLM .md 报告 ## 参考 段共用同一编号空间)
 *   - register(url) 返 1-based 编号 · 同 url 共号 · 新 url 自动分配下一号
 *   - register("") / register(undefined) 返 0(调用方据此决定不打 [参考N])
 *   - render() 输出全部参考段 · 一行一个 `[参考N] <url>`
 *   - render(usedNs) 仅输出 usedNs 中编号(过滤未引用的 url)
 */
export class FootnoteRegistry {
  private byUrl = new Map<string, number>();
  private urls: string[] = [];
  private next = 1;

  constructor(evidenceTrail: EvidenceRef[] = []) {
    let maxN = 0;
    for (const e of evidenceTrail) {
      if (!e || !e.url) continue;
      const n = e.footnote_n ?? 0;
      if (n > 0) {
        this.byUrl.set(e.url, n);
        this.urls[n - 1] = e.url;
        if (n > maxN) maxN = n;
      }
    }
    this.next = maxN + 1;
  }

  register(url: string | undefined | null): number {
    if (!url) return 0;
    const existing = this.byUrl.get(url);
    if (existing) return existing;
    const n = this.next++;
    this.byUrl.set(url, n);
    this.urls[n - 1] = url;
    return n;
  }

  lookup(url: string | undefined | null): number {
    if (!url) return 0;
    return this.byUrl.get(url) ?? 0;
  }

  render(usedNs: Set<number> | null = null): string {
    const lines: string[] = [];
    for (let i = 0; i < this.urls.length; i++) {
      const url = this.urls[i];
      if (!url) continue;
      const n = i + 1;
      if (usedNs && !usedNs.has(n)) continue;
      lines.push(`[参考${n}] ${url}`);
    }
    return lines.join("\n");
  }
}

/**
 * v0.4.4 · 取 rule 推荐 URL · 优先级
 *   1. recommendations[0].fix_url
 *   2. citations[0].url
 *   3. evidence_trail[footnote_refs[0]].url(兜底)
 */
export function pickRuleUrl(
  rule: { recommendations?: Recommendation[]; citations?: Array<{ url: string }>; footnote_refs?: number[] },
  evidenceTrail: EvidenceRef[] = [],
): string | null {
  const fixUrl = rule.recommendations?.[0]?.fix_url;
  if (fixUrl) return fixUrl;
  const citeUrl = rule.citations?.[0]?.url;
  if (citeUrl) return citeUrl;
  const n = (rule.footnote_refs ?? [])[0];
  if (!n) return null;
  const entry = evidenceTrail.find((e) => e.footnote_n === n);
  return entry?.url ?? null;
}

// ---------------------------------------------------------------------------
// Markdown preview(deterministic · 为单测/fallback 用)
// ---------------------------------------------------------------------------

export function renderMarkdownPreview(input: ReportInput): string {
  const { metadata, top_issues, full_findings, ok_findings, summary, evidence_trail } = input;
  const ascii = metadata.ascii_fallback ?? false;
  const box = ascii ? asciiBox : roundedBox;

  const lines: string[] = [];

  // Metadata card
  const rows = [
    `目标  ${metadata.host}${metadata.port ? `:${metadata.port}` : ""}${metadata.db_version ? ` (${metadata.engine} ${metadata.db_version})` : ""}${metadata.arch ? ` · ${metadata.arch}` : ""}${metadata.vendor ? `/${metadata.vendor}` : ""}`,
    `扫描  ${metadata.scanned_rules} rules · ${metadata.scanned_kb_docs} KB docs · engine=${metadata.engine}`,
    metadata.report_path ? `产出  ${metadata.report_path}` : "",
  ].filter(Boolean);
  lines.push(box.top(`perf-kp-sql · 诊断报告 · ${metadata.generated_at}`));
  for (const row of rows) lines.push(box.mid(row));
  lines.push(box.bot());
  lines.push("");

  // Summary bar
  lines.push(
    `Top Issues${" ".repeat(48)}${summary.critical} CRIT · ${summary.warning} WARN · ${summary.info} INFO · ${summary.ok} OK`,
  );
  lines.push("");

  // Top issues block
  for (const r of top_issues) {
    lines.push(formatTopIssue(r));
    lines.push("");
  }

  // Folded pointers
  lines.push(`Full findings           ${full_findings.length} rules           [+] expand`);
  lines.push(`Evidence trail          ${evidence_trail.length} docs cited      [+] expand`);
  lines.push(`OK (already tuned)      ${ok_findings.length} rules            [+] expand`);
  lines.push("");

  if (metadata.report_path) lines.push(`Report: ${metadata.report_path}`);
  if (metadata.artifacts_dir) lines.push(`Artifacts: ${metadata.artifacts_dir}`);

  return lines.join("\n");
}

function formatTopIssue(r: RankedResult): string {
  const impact = `impact ${r.impact_score}`;
  const label = r.title;
  const headline = ` [${r.priority}] ${padSeverity(r.severity)}  ${label}   ${" ".repeat(Math.max(0, 40 - label.length))}${impact}`;
  const primaryRec = r.recommendations[0];
  const primaryCite = r.citations[0];
  const bucketTag = `bucket=${bucketName(r.bucket)}`;
  const scopeTag = r.scope.arch || r.scope.vendor
    ? ` · ${[r.scope.arch, r.scope.vendor].filter(Boolean).join("/")}`
    : "";
  const lines = [
    headline,
    `             → ${bucketTag}${scopeTag}`,
    primaryRec ? `             fix:  ${primaryRec.action}` : "",
    primaryCite ? `             ref:  ${primaryCite.title}${r.citations.length > 1 ? ` (+${r.citations.length - 1})` : ""}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

function padSeverity(s: Severity): string {
  const map: Record<Severity, string> = {
    critical: "HIGH ",
    warning: "MED  ",
    info: "INFO ",
    ok: "OK   ",
  };
  return map[s];
}

function bucketName(b: 1 | 2 | 3 | 4 | 5): string {
  const map = { 1: "Resources", 2: "Config", 3: "Design", 4: "Query", 5: "Runtime" };
  return map[b];
}

// ---------------------------------------------------------------------------
// Box drawing helpers
// ---------------------------------------------------------------------------

interface Box {
  top(header: string): string;
  mid(content: string): string;
  bot(): string;
}

const WIDTH = 78;

const roundedBox: Box = {
  top(h) {
    const content = ` ${h} `;
    const remain = Math.max(4, WIDTH - 2 - content.length);
    return `╭─${content}${"─".repeat(remain)}╮`;
  },
  mid(c) {
    const pad = Math.max(0, WIDTH - 3 - c.length);
    return `│ ${c}${" ".repeat(pad)}│`;
  },
  bot() {
    return `╰${"─".repeat(WIDTH - 2)}╯`;
  },
};

const asciiBox: Box = {
  top(h) {
    const content = ` ${h} `;
    const remain = Math.max(4, WIDTH - 2 - content.length);
    return `+-${content}${"-".repeat(remain)}+`;
  },
  mid(c) {
    const pad = Math.max(0, WIDTH - 3 - c.length);
    return `| ${c}${" ".repeat(pad)}|`;
  },
  bot() {
    return `+${"-".repeat(WIDTH - 2)}+`;
  },
};
