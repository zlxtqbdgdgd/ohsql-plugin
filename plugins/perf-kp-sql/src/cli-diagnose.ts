/**
 * cli-diagnose — perf-kp-sql skill 本地分析入口 (Phase 1 · M4)
 *
 * 用法 (CLI):
 *   node scripts/diagnose.mjs --snapshot <snapshot.json> --kb <knowledge.sqlite> [--query "..."] [--out <out.json>]
 *
 * 4 条匹配路径:
 *   A 配置审计 (BP)        match-bp.ts        config_dump 偏离 BP recommendation 时命中
 *   B 指标诊断 (DF)        match-df.ts        config_dump/metrics 触发 DF parameter_causes
 *   C 火焰图栈帧 (Flame)    match-flame.ts     stack 命中 flame_signature.pattern_regex
 *   D 本地兜底 (FTS)       match-local.ts     query 命中 cases_fts (主自然语言走 NotebookLM 路径 E · 由同事的 notebooklm.mjs 处理)
 */

export { diagnose } from "./cli-diagnose/index.js";
export type {
  Snapshot,
  CheckResult,
  DiagnosePath,
  DiagnoseArgs,
  DiagnoseResult,
} from "./cli-diagnose/types.js";

// CLI 入口
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { diagnose as runDiagnose } from "./cli-diagnose/index.js";
import type { Snapshot } from "./cli-diagnose/types.js";

async function runCli(): Promise<void> {
  const { values } = parseArgs({
    options: {
      snapshot: { type: "string" },
      kb: { type: "string" },
      query: { type: "string" },
      out: { type: "string" },
    },
  });

  if (!values.snapshot || !values.kb) {
    console.error(
      "Usage: diagnose.mjs --snapshot <snapshot.json> --kb <knowledge.sqlite> [--query \"...\"] [--out <out.json>]",
    );
    process.exit(2);
  }

  const snapshot = JSON.parse(readFileSync(resolve(values.snapshot), "utf8")) as Snapshot;
  const result = runDiagnose({
    dbPath: resolve(values.kb),
    snapshot,
    query: values.query,
  });

  const outJson = JSON.stringify(result, null, 2);
  if (values.out) {
    mkdirSync(dirname(resolve(values.out)), { recursive: true });
    writeFileSync(resolve(values.out), outJson);
    console.log(`命中 ${result.matched.length} 条 (A/B/C 路径) · rag_context ${result.rag_context?.length ?? 0} 条 · 写入 ${values.out}`);
  } else {
    console.log(outJson);
  }
}

if (
  import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href &&
  process.argv[1]?.endsWith("/cli-diagnose.ts")
) {
  void runCli();
}
