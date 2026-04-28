// Phase 1 · M4 · 路径 B · 指标诊断 (DF)
//
// 输入: snapshot.config_dump 拍平 (param_name, current_value)
// 算法: 查 case_param_names role='cause' AND entry_kind='diagnostic-flow' · 命中 DF case
//       看 likely_causes.parameter_causes[].abnormal_value_pattern 是否描述了 current 的偏离
//       简化: 只要 param 命中 + current ≠ recommendation → 命中(M5 加 metrics→symptom 推断)
// 输出: CheckResult[] (path='B')

import type Database from "better-sqlite3";
import { flattenConfigDump, type CaseRow, type CheckResult, type Snapshot } from "./types.js";

interface DfData {
  engine?: string | null;
  symptom_category?: string | null;
  symptom?: { description_quote?: string | null; keywords?: string[] };
  diagnostic_steps?: Array<{
    step_no: number;
    title: string;
    metric_name?: string | null;
    abnormal_pattern_quote?: string | null;
    abnormal_pattern_threshold?: string | null;
  }>;
  likely_causes?: {
    parameter_causes?: Array<{
      cause_no: number;
      title: string;
      param_name?: string | null;
      abnormal_value_pattern?: string | null;
      reasoning_quote?: string | null;
    }>;
    non_parameter_causes?: Array<unknown>;
  };
  mitigation_quote?: string | null;
}

function findCauseByParam(data: DfData, paramName: string) {
  return data.likely_causes?.parameter_causes?.find((c) => c.param_name === paramName);
}

export function matchDfCauses(db: Database.Database, snapshot: Snapshot): CheckResult[] {
  const out: CheckResult[] = [];
  const params = flattenConfigDump(snapshot.config_dump);
  if (params.length === 0) return out;

  const stmt = db.prepare(`
    SELECT c.case_id, c.entry_kind, c.bucket, c.scope, c.database,
           c.title, c.source_url, c.source_authority, c.diagnostic_flow_data
    FROM cases c
    INNER JOIN case_param_names cp ON cp.case_id = c.case_id
    WHERE cp.param_name = ?
      AND cp.param_role = 'cause'
      AND c.entry_kind = 'diagnostic-flow'
  `);

  const seen = new Set<string>();
  for (const [paramName, currentValue] of params) {
    const rows = stmt.all(paramName) as (CaseRow & { diagnostic_flow_data: string })[];
    for (const row of rows) {
      const key = `${paramName}::${row.case_id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const data = JSON.parse(row.diagnostic_flow_data) as DfData;
      const cause = findCauseByParam(data, paramName);
      if (!cause) continue;

      const abnormalPattern = cause.abnormal_value_pattern ?? null;
      const reasoning = cause.reasoning_quote ?? null;

      out.push({
        path: "B",
        case_id: row.case_id,
        title: row.title,
        entry_kind: "diagnostic-flow",
        bucket: row.bucket,
        scope: row.scope,
        database: row.database,
        source_url: row.source_url,
        source_authority: row.source_authority,
        severity: "warning",
        current_value: currentValue == null ? null : (currentValue as string | number | boolean),
        recommended_value: null,
        reason_zh:
          reasoning ??
          abnormalPattern ??
          `现场 ${paramName}=${currentValue} 触发 DF likely_cause: ${cause.title}`,
        data,
      });
    }
  }
  return out;
}
