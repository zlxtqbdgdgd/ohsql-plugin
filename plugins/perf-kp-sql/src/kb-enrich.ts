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
 * 合并 KB facts 进 CheckResult · KB 强覆盖 · 没 fact 留空
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

  const out: CheckResult = { ...r };

  // ── rationale (4 字段) ── KB 强覆盖 · 没 fact 留 n/a
  out.rationale = {
    summary: pick("summary")?.quote ?? "n/a",
    mechanism: pick("mechanism")?.quote ?? "n/a",
    trade_offs: pick("trade_off")?.quote ?? "n/a",
    when_to_deviate: pick("when_deviate")?.quote ?? "n/a",
  };

  // ── summary / description / reason ── KB 强覆盖
  // summary: 诊断主句 · 用 KB summary fact 的字面;没 → citation 兜底;再没 → 留空
  out.summary = pick("summary")?.quote ?? pick("citation")?.quote ?? "";

  // description: summary + mechanism 拼接
  const summaryPart = pick("summary")?.quote;
  const mechanismPart = pick("mechanism")?.quote;
  out.description = [summaryPart, mechanismPart].filter(Boolean).join("\n\n") || "";

  // reason: 用 KB mechanism;没就用 summary;再没留空
  out.reason = pick("mechanism")?.quote ?? pick("summary")?.quote ?? "";

  // ── threshold_display ── KB threshold fact 字面 · 没就留 undefined(报告渲染显示"未抽到")
  const thr = pick("threshold");
  out.threshold_display = thr?.quote;

  // ── recommendations ── 每条 KB remediation fact 一条 · action=quote · fix_url=source_url
  // 没 KB remediation → recommendations 留空数组(报告渲染显示"未抽到字面建议")
  const remediations = all("remediation");
  if (remediations.length > 0) {
    out.recommendations = remediations.map<Recommendation>((f) => ({
      action: f.quote,
      rationale: pick("summary")?.quote ?? "",
      type: "mitigate",
      fix_cost: "restart_engine",  // 保守默认(KB 不评 fix_cost)
      verifiable: false,
      fix_url: f.source_url ?? undefined,  // 角注绑该 quote 的 source_url(footer 渲染用)
    }));
  } else {
    out.recommendations = [];
  }

  // ── citations ── KB 各 fact distinct source_url 各一条 · quote 当 anchor
  const citationMap = new Map<string, Citation>();
  for (const row of rows) {
    if (!row.source_url) continue;
    if (citationMap.has(row.source_url)) continue;
    citationMap.set(row.source_url, {
      url: row.source_url,
      title: r.title || r.id,
      anchor: row.quote.slice(0, 80),
    });
  }
  out.citations = [...citationMap.values()];

  // ── needs_human_review ── KB 完全没 fact 时标 true(让 LLM 知道这条规则要人工补)
  if (rows.length === 0) {
    out.needs_human_review = true;
  }

  return out;
}
