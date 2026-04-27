/**
 * kb-enrich · v1.0 红线收紧:报告里所有用户可见文字 + 角注 URL 必须来自 KB verified facts ·
 * 每段 quote 都 substring 命中其 source_url 的 HTML(由 audit-citations 字面验保证)。
 *
 * 注入字段 vs CheckFn 自家保留字段:
 *   - 注入(KB 强覆盖):
 *     · summary / description / reason       ← KB summary / mechanism
 *     · rationale (4 字段)                  ← KB summary / mechanism / trade_off / when_deviate
 *     · recommendations[] · 每条 action     ← KB remediation 字面 · fix_url 绑该 fact 的 source_url
 *     · citations[]                         ← KB 各 fact 的 distinct source_url + quote 当 anchor
 *     · threshold_display                   ← KB threshold fact 字面
 *   - 保留 CheckFn 自家(诊断结果 · 不属 paraphrase):
 *     · id / severity / bucket / scope
 *     · evidence[]                          ← CheckFn 写入 · 含真机当前值
 *     · impact                              ← CheckFn 量化
 *
 * KB 没相应 fact 时 · 字段留空(报告渲染会显示"未抽到字面建议") · 严禁 fallback 到 CheckFn 字符串
 * (避免破红线 · 保证用户看到的所有字面都能在 [参考N] URL 字面命中)。
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CheckResult, Citation, Recommendation, StructuredRationale } from "./models.js";

interface KbFactRow {
  fact_type: string;
  quote: string;
  source_url: string | null;
  provenance?: string | null;
}

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

function defaultKbPath(): string {
  const __dirname_local = typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));
  return join(__dirname_local, "..", "data", "knowledge.sqlite");
}

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
    const has = db.prepare(
      "SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='knowledge'",
    ).get() as { cnt: number } | undefined;
    if (!has || has.cnt === 0) return results;

    const stmt = db.prepare(
      "SELECT fact_type, quote, source_url, provenance FROM knowledge WHERE rule_id = ? AND quote IS NOT NULL AND quote != ''",
    );

    return results.map((r) => {
      try {
        const rows = stmt.all(r.id) as KbFactRow[];
        return mergeFactsIntoResult(r, rows);
      } catch {
        return r;
      }
    });
  } finally {
    db.close();
  }
}

interface FactByType {
  quote: string;
  source_url: string | null;
  provenance: string;
}

// 军规 1.5 · model-generated 不许进"执行命令"和"具体阈值"字段
const FORBID_MODEL_GEN_FOR = new Set(["threshold", "remediation"]);

/**
 * 合并 KB facts 进 CheckResult.
 *
 * 规则 (修 2026-04-27 报告里 [参考N] 指错文档的 bug):
 *   - check 自己写了字段 → 保留 check 的 (它是被人审过的 ground truth · KB 蒸馏可能带噪)
 *   - check 没写 → 才用 KB fact 兜底
 *   - rationale / citations 是"附加"语义 · KB 始终注入 (作为补充 · 不覆盖 check 的同名字段)
 *
 * 旧实现 KB 强覆盖会把 check 写好的 "对慢查询加索引" 推荐给替成 KB 蒸馏出的
 * "API 文档示例" · 直接误导用户. 现在 check + KB 是并集 (check 优先).
 */
function mergeFactsIntoResult(r: CheckResult, rows: KbFactRow[]): CheckResult {
  const factsByType = new Map<string, FactByType[]>();
  for (const row of rows) {
    if (!row.quote) continue;
    const prov = row.provenance ?? "verified";
    // 军规 1.5 守门: model-generated 不进 threshold / remediation
    if (FORBID_MODEL_GEN_FOR.has(row.fact_type) && prov === "model-generated") continue;
    if (!factsByType.has(row.fact_type)) factsByType.set(row.fact_type, []);
    factsByType.get(row.fact_type)!.push({ quote: row.quote, source_url: row.source_url, provenance: prov });
  }

  const pick = (type: string): FactByType | undefined => factsByType.get(type)?.[0];
  const all = (type: string): FactByType[] => factsByType.get(type) ?? [];
  const nonEmpty = (s: unknown): boolean => typeof s === "string" && s.trim().length > 0;

  const out: CheckResult = { ...r };

  // ── rationale ── 用 check 自带的 4 字段;字段空才回退 KB · "n/a" 代表两边都没有
  const cr = r.rationale ?? {};
  out.rationale = {
    summary: nonEmpty(cr.summary) ? cr.summary! : (pick("summary")?.quote ?? "n/a"),
    mechanism: nonEmpty(cr.mechanism) ? cr.mechanism! : (pick("mechanism")?.quote ?? "n/a"),
    trade_offs: nonEmpty(cr.trade_offs) ? cr.trade_offs! : (pick("trade_off")?.quote ?? "n/a"),
    when_to_deviate: nonEmpty(cr.when_to_deviate) ? cr.when_to_deviate! : (pick("when_deviate")?.quote ?? "n/a"),
  };

  // ── summary / description / reason ── check 优先 · 空才回退 KB
  out.summary = nonEmpty(r.summary) ? r.summary! : (pick("summary")?.quote ?? pick("citation")?.quote ?? "");

  if (nonEmpty(r.description)) {
    out.description = r.description!;
  } else {
    const parts = [pick("summary")?.quote, pick("mechanism")?.quote].filter(Boolean);
    out.description = parts.join("\n\n") || "";
  }

  out.reason = nonEmpty(r.reason) ? r.reason! : (pick("mechanism")?.quote ?? pick("summary")?.quote ?? "");

  // ── threshold_display ── check 优先 · 空才回退 KB
  if (!nonEmpty(r.threshold_display)) {
    out.threshold_display = pick("threshold")?.quote;
  }

  // ── recommendations ── check 写了就保留;空才用 KB remediation 兜底
  const checkRecs = Array.isArray(r.recommendations) ? r.recommendations.filter(x => nonEmpty(x?.action)) : [];
  if (checkRecs.length > 0) {
    out.recommendations = checkRecs;
  } else {
    const remediations = all("remediation");
    out.recommendations = remediations.map<Recommendation>((f) => ({
      action: f.quote,
      rationale: pick("summary")?.quote ?? "",
      type: "mitigate",
      fix_cost: "restart_engine",
      verifiable: false,
      fix_url: f.source_url ?? undefined,
    }));
  }

  // ── citations ── check 写的 + KB 派生的并集 (按 url dedup) · KB 提供文档脚注追溯
  const citationMap = new Map<string, Citation>();
  for (const c of (r.citations ?? [])) {
    if (c?.url && !citationMap.has(c.url)) citationMap.set(c.url, c);
  }
  for (const row of rows) {
    if (!row.source_url || citationMap.has(row.source_url)) continue;
    citationMap.set(row.source_url, {
      url: row.source_url,
      title: r.title || r.id,
      anchor: row.quote.slice(0, 80),
    });
  }
  out.citations = [...citationMap.values()];

  if (rows.length === 0 && checkRecs.length === 0) {
    out.needs_human_review = true;
  }

  return out;
}
