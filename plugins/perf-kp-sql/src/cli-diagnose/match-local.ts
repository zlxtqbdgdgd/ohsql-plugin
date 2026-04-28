// Phase 1 · M4 · 路径 D · 本地兜底检索 (FTS5 trigram)
//
// 输入: query 字符串 (用户追问 / 自然语言)
// 算法: cases_fts MATCH ? · 取 top-K · 转 CheckResult
// 输出: CheckResult[] (path='D' · 用于 rag_context)
//
// M5/M7 阶段加 sqlite-vec 余弦相似 · 主路径走 NotebookLM (路径 E) · 此处仅离线 fallback。

import type Database from "better-sqlite3";
import type { CaseRow, CheckResult } from "./types.js";

const DEFAULT_TOP_K = 10;

// FTS5 query 字符串需要转义某些字符避免 SQL 错误
function escapeFts(q: string): string {
  // 把单引号替换 · 移除 FTS5 特殊字符 (保留中英数 + 空格 + 连字符)
  return q
    .replace(/[^A-Za-z0-9一-鿿\s_.\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchLocalFts(
  db: Database.Database,
  query: string,
  topK = DEFAULT_TOP_K,
): CheckResult[] {
  const cleaned = escapeFts(query);
  if (!cleaned) return [];

  // FTS5 token 用空格分 · 这里用 + 表 AND
  const ftsExpr = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t}"`)
    .join(" OR ");
  if (!ftsExpr) return [];

  let rows: Array<CaseRow & { rank: number }>;
  try {
    rows = db
      .prepare(
        `SELECT c.case_id, c.entry_kind, c.bucket, c.scope, c.database,
                c.title, c.source_url, c.source_authority,
                c.best_practice_data, c.diagnostic_flow_data, c.flame_signature_data,
                f.rank AS rank
         FROM cases_fts f
         INNER JOIN cases c ON c.case_id = f.case_id
         WHERE cases_fts MATCH ?
         ORDER BY f.rank
         LIMIT ?`,
      )
      .all(ftsExpr, topK) as Array<CaseRow & { rank: number }>;
  } catch {
    return [];
  }

  return rows.map((row) => {
    const data =
      row.entry_kind === "best-practice"
        ? JSON.parse(row.best_practice_data ?? "{}")
        : row.entry_kind === "diagnostic-flow"
          ? JSON.parse(row.diagnostic_flow_data ?? "{}")
          : JSON.parse(row.flame_signature_data ?? "{}");
    return {
      path: "D" as const,
      case_id: row.case_id,
      title: row.title,
      entry_kind: row.entry_kind,
      bucket: row.bucket,
      scope: row.scope,
      database: row.database,
      source_url: row.source_url,
      source_authority: row.source_authority,
      reason_zh: `自然语言查询 "${query}" 命中 (FTS5 rank ${row.rank.toFixed(2)})`,
      data,
    } satisfies CheckResult;
  });
}
