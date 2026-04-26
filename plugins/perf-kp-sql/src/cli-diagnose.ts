/**
 * cli-diagnose — perf-kp-sql skill 本地分析入口(第一期 mongo only)。
 *
 * 用法:
 *   node diagnose.mjs \
 *     --engine mongo \
 *     --os-file <path>           # SSH osBatchCmd stdout 落盘
 *     --db-file <path>           # SSH dbBatchTemplate stdout 落盘
 *     [--db-stderr-file <path>]
 *     [--db-exit-code <n>]
 *     [--ascii]                  # 报告 ASCII fallback
 *     [--summary-only]           # G4 · stdout 只返 summary/check_catalog/discovered
 *                                # (不含 results[] / report_input · 瘦身 LLM 上下文)
 *                                # 完整 JSON 仍可配合 --out-json 落盘供 render 消费
 *
 * 输出(stdout 一行 JSON):
 *   {
 *     ok: true,
 *     engine: string,
 *     baseline: DiagContext,
 *     discovered: {...},
 *     summary: {total, critical, warning, info, ok, skipped},
 *     results: CheckResult[],
 *     report_input: ReportInput   // impact-ranked + top_issues + evidence_trail
 *   }
 */

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sharedChecks } from "./shared/index.js";
import { parseOsIntoMetrics, countByWaitClass } from "./shared/utils.js";
import {
  buildMongoContext,
  mongoChecks,
  engineChecks,
} from "./engines/index.js";
import { buildReportInput } from "./report.js";
import type { CheckResult, DiagContext, CheckFn, EngineName, ImpactMetric } from "./models.js";
import { infoResult, deriveScope } from "./models.js";
import { templateFixExperiment, type FixExperiment } from "./models.js";
import {
  type RuleRow,
  type V2RuleRow,
  parseRuleRow,
  parseV2RuleRow,
  evaluateRulesAsCheckResults,
  evaluateV2RulesAsCheckResults,
} from "./rule-engine.js";
import { enrichResultsFromKb } from "./kb-enrich.js";
import { tryLoadBaseline, saveBaseline, snapshotFromServerStatus } from "./baseline-store.js";

interface Inputs {
  engine: string;
  osStdout: string;
  dbStdout: string;
  dbStderr: string;
  dbExitCode: number;
  ascii: boolean;
  withVerify: boolean;
  outJson?: string;  // v0.3.8 · 替代 shell 重定向 · 避免 kernel Bash `>` 拦截
  summaryOnly: boolean;  // G4 · stdout 只输出 summary+check_catalog+discovered · 瘦身 LLM 上下文
  saveBaseline: boolean; // Phase 2 step 2 · 跑完把 serverStatus 数值字段存为 baseline 快照
}

async function main(): Promise<void> {
  const inputs = await readInputs();

  let ctx: DiagContext;
  let discovered: Record<string, unknown> = {};
  let results: CheckResult[] = [];

  if (inputs.engine === "mongo") {
    const built = buildMongoContext(
      inputs.osStdout,
      inputs.dbStdout,
      inputs.dbStderr,
      inputs.dbExitCode,
    );
    ctx = built.context;
    discovered = built.discovered as unknown as Record<string, unknown>;
    // shared (OS + Kunpeng) + mongo specific
    results = [...runAll(sharedChecks, ctx), ...runAll(mongoChecks, ctx)];
  } else {
    writeError(`unknown --engine ${inputs.engine} (must be mongo)`);
  }

  // Phase 2 step 2 · baseline 注入(rule-engine 的 baseline() 函数从 db_metrics.baseline 读)
  // hostname 取 hostInfo.system.hostname · 缺失则跳过(无 baseline 模式)
  const hostname = pickHostname(ctx!);
  if (hostname) {
    const bl = tryLoadBaseline(hostname);
    if (bl) {
      (ctx!.db_metrics as Record<string, unknown>).baseline = bl;
    }
  }

  // Phase 3 · rule-engine 并行路径: 加载 rules 表 → 评估 → 去重合并
  try {
    const scope = deriveScope(ctx!, inputs.engine as EngineName);
    const ruleEngineResults = runRuleEngine(ctx!, inputs.engine, scope);
    if (ruleEngineResults.length > 0) {
      // 去重: 旧 CheckFn 的 id 优先（保留已有的精细化 evidence/rationale）
      const existingIds = new Set(results.map((r) => r.id));
      for (const r of ruleEngineResults) {
        if (!existingIds.has(r.id)) {
          results.push(r);
          existingIds.add(r.id);
        }
      }
    }
  } catch (e) {
    // rule-engine 加载失败不影响主流程 · 降级到旧 CheckFn
    results.push(
      infoResult({
        id: "internal.rule_engine.load_error",
        title: "rule-engine fallback",
        bucket: 5,
        scope: deriveScope(ctx!, inputs.engine as EngineName),
        summary: `rule-engine: ${e instanceof Error ? e.message : String(e)}`,
        reason: "rule-engine 加载失败，已使用旧 CheckFn 路径",
      }),
    );
  }

  // 红线收紧 · 用 KB verified facts enrich rationale + recommendations(失败降级)
  try {
    results = enrichResultsFromKb(results);
  } catch (e) {
    results.push(
      infoResult({
        id: "internal.kb_enrich.error",
        title: "kb-enrich fallback",
        bucket: 5,
        scope: deriveScope(ctx!, inputs.engine as EngineName),
        summary: `kb-enrich: ${e instanceof Error ? e.message : String(e)}`,
        reason: "KB enrich 失败，结果未注入 rationale/recommendations",
      }),
    );
  }

  const checkCatalog = countByWaitClass(results.map((r) => r.id));
  const summary = summarize(results, checkCatalog.total);
  // rule-engine 并行路径可能增加 result 数量，skipped 机制调整
  if (results.length + summary.skipped !== checkCatalog.total) {
    // 容忍 rule-engine 带来的增量（旧 invariant 不再硬 break）
    // writeError(...) 改为静默处理
  }
  const reportInput = buildReportInput({
    results,
    metadata: {
      engine: inputs.engine,
      host: String(discovered.bind ?? "?"),
      port: numOrUndef(discovered.port),
      db_version: pickDbVersion(ctx, inputs.engine),
      arch: String((ctx.os_metrics as Record<string, unknown>).arch ?? "?"),
      scanned_kb_docs: 0,
      generated_at: new Date().toISOString(),
      ascii_fallback: inputs.ascii,
    },
  });

  // Wave 3 · 为每条 trivial recommendation 生成 FixExperiment 模板(未执行)
  const fixExperiments = synthesizeFixExperiments(results);

  const payload = JSON.stringify({
    ok: true,
    engine: inputs.engine,
    baseline: ctx,
    discovered,
    summary,
    check_catalog: checkCatalog,
    results,
    report_input: reportInput,
    fix_experiments: fixExperiments,
    with_verify_mode: inputs.withVerify,
  });

  // G4 · summary-only payload · 不含 results / report_input / fix_experiments / baseline
  // 完整 JSON 仍写到 --out-json 供 render-html-report.mjs 消费 · stdout 只给 LLM 看关键信号
  const summaryPayload = JSON.stringify({
    ok: true,
    engine: inputs.engine,
    discovered,
    summary,
    check_catalog: checkCatalog,
  });

  // Phase 2 step 2 · 显式保存 baseline 快照
  if (inputs.saveBaseline && hostname) {
    const ss = (ctx!.db_metrics as Record<string, unknown>).serverStatus
            ?? (ctx!.db_metrics as Record<string, unknown>).t1_serverStatus;
    if (ss) {
      const snap = snapshotFromServerStatus(ss);
      const path = saveBaseline(hostname, snap);
      process.stderr.write(`[baseline] saved ${Object.keys(snap).length} numeric leaves to ${path}\n`);
    } else {
      process.stderr.write(`[baseline] serverStatus 缺失 · 跳过保存\n`);
    }
  }

  // v0.3.8: 支持 --out-json <path> 避免 shell 重定向(被 kernel 拦截)
  if (inputs.outJson) {
    const { writeFileSync: wfs } = await import("node:fs");
    wfs(inputs.outJson, payload);
    if (inputs.summaryOnly) {
      // G4 · out-json 写完整 · stdout 只返 summary-only(带 wrote/bytes 提示)
      const stdoutObj = {
        ok: true,
        engine: inputs.engine,
        discovered,
        summary,
        check_catalog: checkCatalog,
        wrote: inputs.outJson,
        bytes: payload.length,
      };
      process.stdout.write(JSON.stringify(stdoutObj));
    } else {
      process.stdout.write(JSON.stringify({ ok: true, wrote: inputs.outJson, bytes: payload.length }));
    }
  } else if (inputs.summaryOnly) {
    process.stdout.write(summaryPayload);
  } else {
    process.stdout.write(payload);
  }
}

// ---------------------------------------------------------------------------
// Wave 3 · Fix verification loop 模板生成
// ---------------------------------------------------------------------------

/** `expected_signal` 方向推断:cache_miss_rate / latency / wasted_bytes 都是越低越好 */
function expectedDirection(metric: ImpactMetric): "up" | "down" {
  switch (metric) {
    case "throughput_qps":
      return "up";
    default:
      return "down";
  }
}

/** 从 CheckResult 里挑每条 fix_cost=trivial 的 recommendation,吐一个 FixExperiment */
function synthesizeFixExperiments(results: CheckResult[]): FixExperiment[] {
  const out: FixExperiment[] = [];
  for (const r of results) {
    if (r.severity !== "warning" && r.severity !== "critical") continue;
    for (const rec of r.recommendations) {
      if (rec.fix_cost !== "trivial") continue;
      if (rec.verifiable === false) continue; // 明确声明不可验证的,跳过
      out.push(
        templateFixExperiment({
          findingId: r.id,
          ruleTitle: r.title,
          action: rec.action,
          // reverse 启发式:若 action 是 sysctl -w X=Y,暂无"原 Y"的采集能力 ·
          // 模板留占位,Phase 2 runner 实装时再填
          reverse: "(Phase 2 runner 填入原值)",
          expectedMetric: r.impact.metric,
          expectedDirection: expectedDirection(r.impact.metric),
          expectedMinEffect: 15,
        }),
      );
    }
  }
  return out;
}

function runAll(checks: ReadonlyArray<CheckFn>, ctx: DiagContext): CheckResult[] {
  const out: CheckResult[] = [];
  const engine = (ctx.db_type || "mongo") as EngineName;
  for (const fn of checks) {
    try {
      out.push(fn(ctx));
    } catch (e) {
      out.push(
        infoResult({
          id: `internal.rule_exception.${out.length}`,
          title: "internal rule error",
          bucket: 5,
          scope: { engine, instance: "default" },
          summary: "rule execution threw",
          reason: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Phase 3 · rule-engine 并行路径
// ---------------------------------------------------------------------------

/**
 * 从 knowledge.sqlite 的 rules 表加载规则 → evaluateRulesAsCheckResults.
 * 失败时抛异常（由调用方 catch 降级）。
 */
function runRuleEngine(
  ctx: DiagContext,
  engineName: string,
  scope: import("./models.js").Scope,
): CheckResult[] {
  // 动态 require better-sqlite3 避免构建时报错
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Database: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Database = require("better-sqlite3");
  } catch {
    return []; // better-sqlite3 未安装 → 静默跳过
  }

  const __dirname_local = typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));
  const dbPath = join(__dirname_local, "..", "data", "knowledge.sqlite");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  try {
    db = new Database(dbPath, { readonly: true });
  } catch {
    return []; // DB 文件不存在 → 静默跳过
  }

  try {
    // 检查 rules 表是否存在
    const hasRules = db.prepare(
      `SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='rules'`,
    ).get() as { cnt: number };
    if (!hasRules || hasRules.cnt === 0) return [];

    // 检查是否升级到含 v2_checks 列的 schema
    const cols = db.prepare(`PRAGMA table_info(rules)`).all() as { name: string }[];
    const hasV2 = cols.some((c) => c.name === "v2_checks");

    // 加载匹配 engine 的规则 · 表里全是有效规则(无 enabled 列)
    const rows = db.prepare(
      `SELECT * FROM rules WHERE engine = ? OR engine = 'any'`,
    ).all(engineName) as Record<string, unknown>[];

    const allResults: CheckResult[] = [];

    if (hasV2) {
      // 拆分: v2 规则(v2_checks 非空) vs v1 规则
      const v2Rows: Record<string, unknown>[] = [];
      const v1Rows: Record<string, unknown>[] = [];
      for (const r of rows) {
        if (r.v2_checks && String(r.v2_checks).trim() && r.v2_checks !== "[]") {
          v2Rows.push(r);
        } else {
          v1Rows.push(r);
        }
      }

      // v1 路径
      if (v1Rows.length > 0) {
        const rules: RuleRow[] = v1Rows.map(parseRuleRow);
        const collected = buildCollectedMap(ctx);
        allResults.push(...evaluateRulesAsCheckResults(rules, collected, scope));
      }

      // v2 路径 · 走 nested raw metrics(serverStatus / hostInfo / getCmdLineOpts)
      if (v2Rows.length > 0) {
        const v2Rules: V2RuleRow[] = v2Rows.map(parseV2RuleRow);
        // db_metrics 已包含 serverStatus / hostInfo / getCmdLineOpts 嵌套对象
        const dbm = ctx.db_metrics as Record<string, unknown>;
        allResults.push(...evaluateV2RulesAsCheckResults(v2Rules, dbm, scope));
      }
    } else {
      // 老 schema · 全走 v1
      const rules: RuleRow[] = rows.map(parseRuleRow);
      const collected = buildCollectedMap(ctx);
      allResults.push(...evaluateRulesAsCheckResults(rules, collected, scope));
    }

    return allResults;
  } finally {
    db.close();
  }
}

function buildCollectedMap(ctx: DiagContext): Map<string, string> {
  const collected = new Map<string, string>();
  const osm = ctx.os_metrics as Record<string, unknown>;
  const dbm = ctx.db_metrics as Record<string, unknown>;
  for (const [k, v] of Object.entries(osm)) {
    if (v !== undefined && v !== null) collected.set(k, String(v));
  }
  for (const [k, v] of Object.entries(dbm)) {
    if (v !== undefined && v !== null) collected.set(k, String(v));
  }
  return collected;
}

function summarize(results: CheckResult[], catalogTotal: number) {
  const total = results.length;
  const critical = results.filter((r) => r.severity === "critical").length;
  const warning = results.filter((r) => r.severity === "warning").length;
  const info = results.filter((r) => r.severity === "info").length;
  const ok = results.filter((r) => r.severity === "ok").length;
  // skipped = 目录总量(运行时 CheckFn 规模)- 实际产出的 result 数 ·
  // 当前每个 CheckFn 必产出一条 result(无条件 return),故恒为 0 ·
  // 留该字段是防御性留口:未来若规则注册表与 CheckFn 解耦 / 某些规则在加载
  // 阶段被 scope 过滤掉不执行,这里会非 0。
  const skipped = Math.max(0, catalogTotal - total);
  return { total, critical, warning, info, ok, skipped };
}

function extractDiscovery(osStdout: string, processName: string): Record<string, unknown> {
  // ###DISCOVERY### block shape:
  //   engine=mongod PID=11 PORT=27017 BIND=127.0.0.1
  const lines = osStdout.split("\n");
  let inDiscovery = false;
  for (const line of lines) {
    if (line.trim() === "###DISCOVERY###") {
      inDiscovery = true;
      continue;
    }
    if (!inDiscovery) continue;
    if (line.startsWith("###")) break;
    if (line.includes(`engine=${processName}`)) {
      const m: Record<string, string> = {};
      for (const tok of line.split(/\s+/)) {
        const eq = tok.indexOf("=");
        if (eq > 0) m[tok.slice(0, eq)] = tok.slice(eq + 1);
      }
      return {
        engine: m.engine,
        pid: m.PID,
        port: m.PORT,
        bind: m.BIND,
      };
    }
  }
  return {};
}

function pickDbVersion(ctx: DiagContext, engine: string): string | undefined {
  const m = ctx.db_metrics as Record<string, unknown>;
  if (engine === "mongo") return (m.version as string) || undefined;
  return undefined;
}

function pickHostname(ctx: DiagContext): string | undefined {
  const m = ctx.db_metrics as Record<string, unknown>;
  const hi = m.hostInfo as Record<string, unknown> | undefined;
  const sys = hi?.system as Record<string, unknown> | undefined;
  const h = sys?.hostname;
  return typeof h === "string" && h.length > 0 ? h : undefined;
}

function numOrUndef(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function readInputs(): Promise<Inputs> {
  const argv = parseArgs(process.argv.slice(2));
  const engine = (argv.engine as string) || "mongo";

  if (argv["os-file"] || argv["db-file"]) {
    if (!argv["os-file"]) writeError("missing --os-file");
    if (!argv["db-file"]) writeError("missing --db-file");
    const osStdout = await readFileSafe(argv["os-file"] as string, "os-file");
    const dbStdout = await readFileSafe(argv["db-file"] as string, "db-file");
    const dbStderr = argv["db-stderr-file"]
      ? await readFileSafe(argv["db-stderr-file"] as string, "db-stderr-file")
      : "";
    const dbExitCode = argv["db-exit-code"]
      ? Number.parseInt(argv["db-exit-code"] as string, 10) || 0
      : 0;
    return {
      engine,
      osStdout,
      dbStdout,
      dbStderr,
      dbExitCode,
      ascii: !!argv.ascii,
      withVerify: !!argv["with-verify"],
      outJson: argv["out-json"] as string | undefined,
      summaryOnly: !!argv["summary-only"],
      saveBaseline: !!argv["save-baseline"],
    };
  }

  const raw = await readStdin();
  if (!raw) writeError("no input: pass --os-file/--db-file or JSON on stdin");
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    writeError(`invalid JSON on stdin: ${e instanceof Error ? e.message : String(e)}`);
  }
  const { osStdout, dbStdout, dbStderr, dbExitCode } = obj as {
    osStdout?: unknown;
    dbStdout?: unknown;
    dbStderr?: unknown;
    dbExitCode?: unknown;
  };
  if (typeof osStdout !== "string" || typeof dbStdout !== "string") {
    writeError("osStdout and dbStdout required as strings");
  }
  return {
    engine,
    osStdout,
    dbStdout,
    dbStderr: typeof dbStderr === "string" ? dbStderr : "",
    dbExitCode: typeof dbExitCode === "number" ? dbExitCode : 0,
    ascii: !!argv.ascii,
    withVerify: !!argv["with-verify"],
    outJson: argv["out-json"] as string | undefined,
    summaryOnly: !!argv["summary-only"],
    saveBaseline: !!argv["save-baseline"],
  };
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a || !a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

async function readFileSafe(path: string, label: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    // v0.4.4 · 防 Write→diagnose race(LLM 在 Write Tool 落盘和 Bash diagnose 调度
    // 之间无显式 ordering · 偶尔出 ENOENT)· 200ms 后重试一次 · 仍失败才报错
    await new Promise((resolve) => setTimeout(resolve, 200));
    try {
      return await readFile(path, "utf8");
    } catch (e2) {
      writeError(
        `failed to read ${label} (${path}): ${e2 instanceof Error ? e2.message : String(e2)}`,
      );
    }
  }
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

function writeError(message: string): never {
  process.stdout.write(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

main().catch((err) => {
  writeError(err instanceof Error ? err.message : String(err));
});
