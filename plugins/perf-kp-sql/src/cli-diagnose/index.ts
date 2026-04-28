// Phase 1 · M4 · cli-diagnose 入口 · 组合 4 路径

import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

import type { DiagnoseArgs, DiagnoseResult } from "./types.js";
export type {
  Snapshot,
  CheckResult,
  DiagnosePath,
  DiagnoseArgs,
  DiagnoseResult,
} from "./types.js";

import { matchBpRecommendations } from "./match-bp.js";
import { matchDfCauses } from "./match-df.js";
import { matchFlameSignatures } from "./match-flame.js";
import { matchLocalFts } from "./match-local.js";

export function diagnose(args: DiagnoseArgs): DiagnoseResult {
  const db = new Database(args.dbPath, { readonly: true, fileMustExist: true });
  try {
    sqliteVec.load(db);
  } catch {
    // sqlite-vec 加载失败时 · path D vec 检索退化为只有 FTS · 不影响 A/B/C
  }

  const matched = [
    ...matchBpRecommendations(db, args.snapshot),
    ...matchDfCauses(db, args.snapshot),
    ...matchFlameSignatures(db, args.snapshot),
  ];

  let rag_context: DiagnoseResult["rag_context"] = undefined;
  if (args.query && args.query.trim()) {
    rag_context = matchLocalFts(db, args.query);
  }

  db.close();

  return { matched, rag_context };
}
