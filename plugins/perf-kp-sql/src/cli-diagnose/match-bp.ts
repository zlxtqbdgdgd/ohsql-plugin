// Phase 1 · M4 · 路径 A · 配置审计 (BP)
//
// 输入: snapshot.config_dump (拍平后的 (param_name, value) 列表)
// 算法: 对每个 (param, current) · 查 case_param_names 中 role='recommendation' + entry_kind='best-practice' 的 case
//       如果 current 字面值 与 case.recommendation_value 字面值不一致 → 命中
// 输出: CheckResult[] (path='A')

import type Database from "better-sqlite3";
import { flattenConfigDump, type CaseRow, type CheckResult, type Snapshot } from "./types.js";

interface BpData {
  recommendation?: { value?: string | null; layer?: string | null; quote?: string | null };
  rationale?: { zh?: string | null; quote?: string | null };
  risk?: { severity?: string | null; zh?: string | null; quote?: string | null };
}

// 简单字面值等价判定: current 是否在 recommendation 里出现
// 返回 'skip' 表示 recommendation 是公式/占位符/NULL · 无法自动判断违反 · 不应命中(降 false positive)
function valueMatches(current: unknown, recommendation: string | null | undefined): boolean | "skip" {
  if (!recommendation) return "skip";
  const rec = String(recommendation).trim();
  // 公式 / 范围 / 占位符 / NULL → 跳过
  if (/\(NULL|RAM|GB\)|max\(|min\(|TBD|N\/A|\.\.\./i.test(rec)) return "skip";
  if (rec.length === 0) return "skip";

  const cur = String(current).trim();
  if (rec === cur) return true;
  // 数字直接相等
  if (/^\d+(\.\d+)?$/.test(cur) && /^\d+(\.\d+)?$/.test(rec)) {
    return Number(cur) === Number(rec);
  }
  // recommendation 含 current 字面 (如 'vm.swappiness=1' 含 '1')
  if (rec.includes(cur)) return true;
  return false;
}

export function matchBpRecommendations(db: Database.Database, snapshot: Snapshot): CheckResult[] {
  const out: CheckResult[] = [];
  const params = flattenConfigDump(snapshot.config_dump);
  if (params.length === 0) return out;

  const stmt = db.prepare(`
    SELECT c.case_id, c.entry_kind, c.bucket, c.scope, c.database,
           c.title, c.source_url, c.source_authority, c.best_practice_data
    FROM cases c
    INNER JOIN case_param_names cp ON cp.case_id = c.case_id
    WHERE cp.param_name = ?
      AND cp.param_role = 'recommendation'
      AND c.entry_kind = 'best-practice'
  `);

  const seen = new Set<string>();
  for (const [paramName, currentValue] of params) {
    const rows = stmt.all(paramName) as CaseRow[];
    for (const row of rows) {
      const key = `${paramName}::${row.case_id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const data = JSON.parse(row.best_practice_data ?? "{}") as BpData;
      const recValue = data.recommendation?.value ?? null;
      const m = valueMatches(currentValue, recValue);
      if (m === true) continue; // 已合规 · 跳过
      if (m === "skip") continue; // recommendation 是公式/NULL · 无法自动判断 · 跳过

      const severity = (data.risk?.severity as "warning" | "critical" | undefined) ?? "warning";
      const reason =
        data.rationale?.zh ??
        data.risk?.zh ??
        `现场 ${paramName}=${currentValue} 偏离 BP 推荐 ${recValue ?? "(NULL)"}`;

      out.push({
        path: "A",
        case_id: row.case_id,
        title: row.title,
        entry_kind: "best-practice",
        bucket: row.bucket,
        scope: row.scope,
        database: row.database,
        source_url: row.source_url,
        source_authority: row.source_authority,
        severity,
        current_value: currentValue == null ? null : `${paramName}=${currentValue}`,
        recommended_value: recValue,
        reason_zh: reason,
        data,
      });
    }
  }
  return out;
}
