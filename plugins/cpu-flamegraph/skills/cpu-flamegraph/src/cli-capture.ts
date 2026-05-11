/**
 * cli-capture — 火焰图远程采集 CLI 入口
 *
 * Usage:
 *   node scripts/capture.mjs --host=1.2.3.4 --user=root \
 *                            [--port=22] [--key=~/.ssh/id_rsa] [--password=<pw>] \
 *                            [--process=mongod] [--duration=0.3] \
 *                            [--type=oncpu|offcpu] [--engine=mongo|mysql|redis]
 *
 * 输出：单段 JSON 到 stdout（结构化，模型解析后摘要给用户）；失败时 exitCode=1
 * + stderr 写人类可读诊断。
 *
 * 认证：--key 与 --password 二选一。同时给 → key 优先、password 忽略。--password
 * 使用 OpenSSH 内建 SSH_ASKPASS 机制(零外部依赖, 不再需要 sshpass)。
 *
 * --engine 指定 KB 种子（data/kb-seeds/<engine>-flame.json），命中则在
 * terminalReport 末尾追加"KB 解读"段。未识别 / seed 缺失静默退化为纯采集。
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { captureFlamegraph } from "./captureFlamegraph.js";
import { analyze } from "./analyze.js";
import { renderTerminal } from "./render.js";
import { interpretHotspot } from "./interpretHotspot.js";

interface Args {
  host: string;
  user: string;
  port?: number;
  key?: string;
  password?: string;
  process?: string;
  duration?: number;
  type?: "oncpu" | "offcpu";
  engine?: string;
}

function parseArgs(argv: string[]): Args | { error: string } {
  const out: Record<string, string> = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) return { error: `unknown arg: ${a} (expect --key=value)` };
    out[m[1]!] = m[2]!;
  }
  if (!out["host"] || !out["user"]) {
    return { error: "missing required args: --host=<ip> --user=<user>" };
  }
  const type = out["type"];
  if (type && type !== "oncpu" && type !== "offcpu") {
    return { error: `--type must be oncpu or offcpu (got: ${type})` };
  }
  const args: Args = {
    host: out["host"],
    user: out["user"],
  };
  if (out["port"]) args.port = parseInt(out["port"]!, 10);
  if (out["key"]) args.key = out["key"];
  if (out["password"]) args.password = out["password"];
  if (out["process"]) args.process = out["process"];
  if (out["duration"]) args.duration = parseFloat(out["duration"]!);
  if (type) args.type = type as "oncpu" | "offcpu";
  if (out["engine"]) args.engine = out["engine"];
  return args;
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv);
  if ("error" in parsed) {
    process.stderr.write(`error: ${parsed.error}\n`);
    return 1;
  }
  const isOffcpu = parsed.type === "offcpu";
  const timeLabel = isOffcpu ? "等待时间" : "CPU 时间";

  let capture;
  try {
    capture = await captureFlamegraph({
      conn: {
        host: parsed.host,
        user: parsed.user,
        ...(parsed.port !== undefined ? { port: parsed.port } : {}),
        ...(parsed.key ? { privateKeyPath: parsed.key } : {}),
        ...(parsed.password && !parsed.key ? { password: parsed.password } : {}),
      },
      ...(parsed.process ? { process: parsed.process } : {}),
      ...(parsed.duration !== undefined ? { duration: parsed.duration } : {}),
      ...(parsed.type ? { type: parsed.type } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`火焰图采集失败：${msg}\n`);
    return 1;
  }

  // KB 数据目录：cli-capture.ts 编出来是 scripts/capture.mjs，data/ 在其同级
  // (skills/cpu-flamegraph/data/kb-seeds/*.json)
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const dataDir = resolve(scriptDir, "..", "data", "kb-seeds");

  const report = analyze({
    samples: capture.samples,
    meta: {
      pid: capture.meta.pid,
      comm: capture.meta.comm,
      duration_sec: capture.meta.duration_sec,
      freq_hz: capture.meta.freq_hz,
      mode: isOffcpu ? "off-cpu" : "on-cpu",
      scope: capture.meta.scope,
    },
    topN: 10,
    engine: parsed.engine ?? "mongo",
    kbDataDir: dataDir,
  });
  let termView = renderTerminal(report);

  const totalMs = (capture.meta.total_samples / 1_000_000).toFixed(1);
  const top1 = report.hot_functions[0];
  const scopeLabel =
    capture.meta.scope === "global"
      ? `全系统（-a，因目标进程闲）`
      : `目标进程 ${capture.meta.comm}(pid=${capture.meta.pid})`;
  const sshTarget = `${parsed.user}@${parsed.host}`;

  const summary = top1
    ? `${timeLabel} ${totalMs}ms；采样范围：${scopeLabel}；Top: ${top1.name} ${top1.percent.toFixed(1)}%（模块 ${top1.module}）`
    : `${timeLabel} ${totalMs}ms，采样范围：${scopeLabel}，0 热点（全空闲）`;

  const interpretation = interpretHotspot(top1?.name ?? null, top1?.module ?? null, isOffcpu);

  const result = {
    ok: true,
    mode: isOffcpu ? "offcpu" : "oncpu",
    timeLabel,
    totalMs: parseFloat(totalMs),
    scopeLabel,
    summary,
    top1: top1
      ? {
          name: top1.name,
          module: top1.module,
          percent: parseFloat(top1.percent.toFixed(1)),
        }
      : null,
    interpretation,
    artifacts: {
      sshTarget,
      serverSvgPath: capture.serverSvgPath ?? null,
      serverPerfScriptPath: capture.serverPerfScriptPath ?? null,
      scpSvg: capture.serverSvgPath ? `scp ${sshTarget}:${capture.serverSvgPath} .` : null,
      scpPerfScript: capture.serverPerfScriptPath
        ? `scp ${sshTarget}:${capture.serverPerfScriptPath} .`
        : null,
    },
    hot_functions_top10: report.hot_functions.slice(0, 10).map((h) => ({
      name: h.name,
      module: h.module,
      percent: parseFloat(h.percent.toFixed(2)),
    })),
    terminalReport: termView,
  };

  if (!top1) {
    result.terminalReport += "\n\n═══ 热点函数 ═══\n  （未识别到真实 CPU 热点。所有采样可能均被过滤为 CPU 空闲函数，如 arch_cpu_idle 等。如需诊断，请在采样期间给目标进程施加业务负载）";
  }

  if (capture.serverSvgPath || capture.serverPerfScriptPath) {
    result.terminalReport += "\n\n═══ 远端产物位置 ═══";
    if (capture.serverSvgPath) result.terminalReport += `\n  SVG 文件: ${capture.serverSvgPath}`;
    if (capture.serverPerfScriptPath) result.terminalReport += `\n  Speedscope: scp ${sshTarget}:${capture.serverPerfScriptPath} .`;
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  return 0;
}

main().then(
  (rc) => process.exit(rc),
  (e) => {
    process.stderr.write(`unexpected error: ${e instanceof Error ? e.stack || e.message : String(e)}\n`);
    process.exit(1);
  },
);
