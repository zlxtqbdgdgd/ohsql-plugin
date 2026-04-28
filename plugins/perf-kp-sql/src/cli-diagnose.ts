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
import { renderReport } from "./report.js";

async function runCli(): Promise<void> {
  const { values } = parseArgs({
    options: {
      snapshot: { type: "string" },
      kb: { type: "string" },
      query: { type: "string" },
      out: { type: "string" },
      html: { type: "string" },
    },
  });

  if (!values.snapshot || !values.kb) {
    console.error(
      'Usage: diagnose.mjs --snapshot <snapshot.json> --kb <knowledge.sqlite> [--query "..."] [--out <out.json>] [--html <out.html>]',
    );
    process.exit(2);
  }

  const snapshot = JSON.parse(readFileSync(resolve(values.snapshot), "utf8")) as Snapshot;
  const result = runDiagnose({
    dbPath: resolve(values.kb),
    snapshot,
    query: values.query,
  });

  if (values.out) {
    mkdirSync(dirname(resolve(values.out)), { recursive: true });
    writeFileSync(resolve(values.out), JSON.stringify(result, null, 2));
  }
  if (values.html) {
    mkdirSync(dirname(resolve(values.html)), { recursive: true });
    writeFileSync(resolve(values.html), renderReport({ snapshot, matched: result.matched, rag_context: result.rag_context }));
  }
  if (!values.out && !values.html) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const bp = result.matched.filter((r) => r.path === "A").length;
  const df = result.matched.filter((r) => r.path === "B").length;
  const flame = result.matched.filter((r) => r.path === "C").length;
  console.log(
    `命中 ${result.matched.length} 条 · BP ${bp} / DF ${df} / Flame ${flame} · rag_context ${result.rag_context?.length ?? 0} 条` +
      (values.out ? ` · JSON 写入 ${values.out}` : "") +
      (values.html ? ` · HTML 写入 ${values.html}` : ""),
  );
}

if (
  import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href &&
  process.argv[1]?.endsWith("/cli-diagnose.ts")
) {
  void runCli();
}
