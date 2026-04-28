// Phase 1 · M4 · cli-diagnose 共享类型

import type { Bucket, EntryKind } from "../shared/scope-to-bucket.js";

export interface Snapshot {
  host: string;
  platform: string;
  mongo_version?: string;
  hardware?: {
    cpu_model?: string;
    ram_gb?: number;
    numa_node_count?: number;
    [k: string]: unknown;
  };
  metrics: Record<string, number | string | boolean>;
  config_dump: Record<string, Record<string, unknown> | unknown>;
  flamegraph_stacks?: Array<{ stack: string; samples: number }>;
}

export type DiagnosePath = "A" | "B" | "C" | "D";

export interface CheckResult {
  path: DiagnosePath;
  case_id: string;
  title: string;
  entry_kind: EntryKind;
  bucket: Bucket;
  scope: string | null;
  database: string | null;
  source_url: string;
  source_authority: string;
  severity?: "warning" | "critical";
  current_value?: string | number | boolean | null;
  recommended_value?: string | null;
  reason_zh: string;
  data: unknown; // 原始 best_practice_data / diagnostic_flow_data / flame_signature_data
}

export interface DiagnoseArgs {
  dbPath: string;
  snapshot: Snapshot;
  query?: string;
}

export interface DiagnoseResult {
  matched: CheckResult[];
  rag_context?: CheckResult[];
}

// 把嵌套 config_dump 拍平成 (param_name, value) 列表
// 输入: { kernel_sysctl: { "vm.swappiness": 60 }, kernel_thp: { "transparent_hugepage_enabled": "always" } }
// 输出: [["vm.swappiness", 60], ["transparent_hugepage_enabled", "always"]]
export function flattenConfigDump(cd: Snapshot["config_dump"]): Array<[string, unknown]> {
  const out: Array<[string, unknown]> = [];
  for (const sec of Object.values(cd)) {
    if (sec && typeof sec === "object") {
      for (const [k, v] of Object.entries(sec as Record<string, unknown>)) {
        out.push([k, v]);
      }
    }
  }
  return out;
}

export interface CaseRow {
  case_id: string;
  entry_kind: EntryKind;
  bucket: Bucket;
  scope: string | null;
  database: string | null;
  title: string;
  source_url: string;
  source_authority: string;
  best_practice_data: string | null;
  diagnostic_flow_data: string | null;
  flame_signature_data: string | null;
}
