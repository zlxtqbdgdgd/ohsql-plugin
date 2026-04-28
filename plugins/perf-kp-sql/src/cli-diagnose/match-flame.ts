// Phase 1 · M4 · 路径 C · 火焰图栈帧匹配 (Flame)
//
// 输入: snapshot.flamegraph_stacks[]
// 算法: 加载所有 flame-signature 的 pattern_regex 到内存 · 对每个 stack 字符串 RegExp.test
//       命中 + 该 signature 总采样占比 ≥ HOTNESS_THRESHOLD → 命中 CheckResult
// 输出: CheckResult[] (path='C')

import type Database from "better-sqlite3";
import type { CaseRow, CheckResult, Snapshot } from "./types.js";

interface FlameData {
  signature_type?: string | null;
  pattern_regex?: string | null;
  match_layer?: string | null;
  pattern_quote?: string | null;
  mechanism?: { quote?: string | null; zh?: string | null };
  workload_implication?: { quote?: string | null; zh?: string | null; hotness_threshold?: string | null };
  tuning_directions?: Array<{
    direction_no: number;
    direction_quote?: string | null;
    related_param_name?: string | null;
    confidence?: string | null;
  }>;
}

const DEFAULT_HOTNESS_THRESHOLD_PCT = 5;

export function matchFlameSignatures(db: Database.Database, snapshot: Snapshot): CheckResult[] {
  const out: CheckResult[] = [];
  const stacks = snapshot.flamegraph_stacks ?? [];
  if (stacks.length === 0) return out;

  const totalSamples = stacks.reduce((a, s) => a + s.samples, 0);
  if (totalSamples === 0) return out;

  const rows = db
    .prepare(
      `SELECT case_id, entry_kind, bucket, scope, database, title, source_url, source_authority, flame_signature_data
       FROM cases WHERE entry_kind = 'flame-signature'`,
    )
    .all() as (CaseRow & { flame_signature_data: string })[];

  for (const row of rows) {
    const data = JSON.parse(row.flame_signature_data) as FlameData;
    if (!data.pattern_regex) continue;
    // 蒸馏 md 中 pattern_regex 用 markdown backtick 包裹 (`^xxx.*`) · 入库时 backtick 一并存了
    // 这里 strip 外层 backtick 后再 compile RegExp
    const regexSrc = data.pattern_regex.replace(/^`+|`+$/g, "").trim();
    if (!regexSrc) continue;
    let regex: RegExp;
    try {
      regex = new RegExp(regexSrc);
    } catch {
      continue;
    }
    let matchedSamples = 0;
    for (const s of stacks) {
      if (regex.test(s.stack)) matchedSamples += s.samples;
    }
    const pct = (matchedSamples / totalSamples) * 100;
    if (pct < DEFAULT_HOTNESS_THRESHOLD_PCT) continue;

    out.push({
      path: "C",
      case_id: row.case_id,
      title: row.title,
      entry_kind: "flame-signature",
      bucket: row.bucket,
      scope: row.scope,
      database: row.database,
      source_url: row.source_url,
      source_authority: row.source_authority,
      severity: "warning",
      current_value: `${pct.toFixed(1)}%`,
      recommended_value: null,
      reason_zh: `flamegraph stack 命中 pattern_regex \`${data.pattern_regex}\` · 占总采样 ${pct.toFixed(1)}% (≥ ${DEFAULT_HOTNESS_THRESHOLD_PCT}%) · 提示 ${data.workload_implication?.zh ?? data.mechanism?.zh ?? row.title}`,
      data,
    });
  }
  return out;
}
