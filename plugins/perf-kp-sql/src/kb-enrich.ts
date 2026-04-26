/**
 * kb-enrich — 红线收紧后 · 用 KB verified facts 给 CheckResult 注入 rationale + recommendations。
 *
 * 设计:
 *   红线收紧后 rules.json 不再带 reason / recommend / fix paraphrase ·
 *   sqlite rules 表的 description / recommendations 也清空。
 *   报告渲染需要的"建议块"全部来自 sqlite knowledge 表(extractive · 字面验过)。
 *
 *   每条 fire 后的 CheckResult 按 rule_id 去 knowledge 表 join 出 7 类 fact:
 *
 *     summary       → CheckResult.rationale.summary       (一句话为何成问题)
 *     mechanism     → CheckResult.rationale.mechanism     (根因)
 *     trade_off     → CheckResult.rationale.trade_offs    (修 vs 不修代价)
 *     when_deviate  → CheckResult.rationale.when_to_deviate (例外)
 *     remediation   → CheckResult.recommendations[]       (修复动作 · 多条变多个 rec)
 *     threshold     → CheckResult.summary 兜底(如果原 summary 空)
 *     citation      → CheckResult.citations[] 已经有了 · 跳过(避免重复)
 *
 * 失败处理: KB open 失败 / 表不存在 / 单条查询异常 → 静默降级 · 不破坏诊断流程。
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CheckResult, Recommendation, StructuredRationale } from "./models.js";

interface KbFactRow {
  fact_type: string;
  quote: string;
  source_url: string | null;
}

/** 用 require 动态加载 better-sqlite3,避免 build 期硬依赖 */
function loadSqlite(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Database: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Database = require("better-sqlite3");
  } catch {
    return null;
  }
  return Database;
}

/** 默认 KB 路径 · 跟 rule-engine 保持一致 */
function defaultKbPath(): string {
  const __dirname_local = typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));
  return join(__dirname_local, "..", "data", "knowledge.sqlite");
}

/**
 * 用 KB facts enrich CheckResult[]
 *
 * - finding / info / ok 都 enrich(让 ok 状态也能展示 rationale,鼓励留下学习素材)
 * - 现有非空字段不覆盖(留 CheckFn 自己的精细化内容)
 *
 * 失败降级返 results 不变。
 */
export function enrichResultsFromKb(
  results: CheckResult[],
  dbPath?: string,
): CheckResult[] {
  const Database = loadSqlite() as { new (path: string, opts: { readonly: boolean }): unknown } | null;
  if (!Database) return results;

  let db: { prepare: (sql: string) => { all: (...args: unknown[]) => unknown[]; get: (...args: unknown[]) => unknown }; close: () => void };
  try {
    db = new Database(dbPath ?? defaultKbPath(), { readonly: true }) as typeof db;
  } catch {
    return results;
  }

  try {
    // 表不在(比如老 KB)→ 降级
    const has = db.prepare(
      "SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='knowledge'",
    ).get() as { cnt: number } | undefined;
    if (!has || has.cnt === 0) return results;

    const stmt = db.prepare(
      "SELECT fact_type, quote, source_url FROM knowledge WHERE rule_id = ? AND quote IS NOT NULL AND quote != ''",
    );

    return results.map((r) => {
      try {
        const rows = stmt.all(r.id) as KbFactRow[];
        if (rows.length === 0) return r;
        return mergeFactsIntoResult(r, rows);
      } catch {
        return r;
      }
    });
  } finally {
    db.close();
  }
}

/** 把 KB facts 合并进单个 CheckResult */
function mergeFactsIntoResult(r: CheckResult, rows: KbFactRow[]): CheckResult {
  const factsByType = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.quote) continue;
    if (!factsByType.has(row.fact_type)) factsByType.set(row.fact_type, []);
    factsByType.get(row.fact_type)!.push(row.quote);
  }

  const out: CheckResult = { ...r };

  // rationale: 4 字段从 KB 拼装 · KB 优先(覆盖 CheckFn 自带的 paraphrase) ·
  // 红线: 用户看到的 rationale 必须字面来自源文档 · CheckFn 硬码字符串不可信
  // 仅在 KB 完全没相关 fact 时保留 CheckFn 自带 rationale 作 fallback
  const kbRat = buildRationale(factsByType);
  const hasAnyKbContent = ["summary", "mechanism", "trade_off", "when_deviate"].some((t) => factsByType.has(t));
  if (hasAnyKbContent) {
    out.rationale = kbRat;
  } else if (!out.rationale) {
    out.rationale = kbRat; // 仍设(全 n/a) · 模板能处理
  }

  // summary 兜底: 现有为空 / 默认占位 → 用 KB summary 顶上
  if (!out.summary || out.summary.trim() === "" || out.summary === out.title) {
    const s = factsByType.get("summary")?.[0] ?? factsByType.get("citation")?.[0] ?? null;
    if (s) out.summary = s;
  }

  // description 兜底: 现有为空 → 拼 summary + mechanism
  if (!out.description || out.description.trim() === "") {
    const desc = [
      factsByType.get("summary")?.[0],
      factsByType.get("mechanism")?.[0],
    ].filter(Boolean).join("\n\n");
    if (desc) out.description = desc;
  }

  // reason 兜底: 现有为空 / 只是 metric=value 默认串 → 用 mechanism 替代
  // (rule-engine v2 桥接默认填 "metric=actual(期望 op expected)" · 这里保留,因为它是判定证据)
  if ((!out.reason || out.reason.trim() === "") && factsByType.has("mechanism")) {
    out.reason = factsByType.get("mechanism")![0];
  }

  // recommendations: KB 优先(同 rationale 红线) · KB 有 remediation fact 就覆盖 CheckFn 自带 paraphrase ·
  // KB 没 remediation 才保留 CheckFn 自带(避免没建议块)
  const rems = factsByType.get("remediation") ?? [];
  if (rems.length > 0) {
    out.recommendations = rems.map((quote) => ({
      action: quote,
      rationale: factsByType.get("summary")?.[0] ?? "见原文",
      type: "mitigate",
      fix_cost: "restart_engine",  // 保守默认(红线收紧后 fix_cost 不再 LLM 评 · 真值 trivial 让用户在 fix experiment 时显式标)
      verifiable: false,
    }));
  }

  // 若 result 没 needs_human_review 标记 · 但 recommendations 仍空 → 标 true
  if (!out.recommendations || out.recommendations.length === 0) {
    out.needs_human_review = true;
  }

  return out;
}

function buildRationale(factsByType: Map<string, string[]>): StructuredRationale {
  return {
    summary: factsByType.get("summary")?.[0] ?? "n/a",
    mechanism: factsByType.get("mechanism")?.[0] ?? "n/a",
    trade_offs: factsByType.get("trade_off")?.[0] ?? "n/a",
    when_to_deviate: factsByType.get("when_deviate")?.[0] ?? "n/a",
  };
}
