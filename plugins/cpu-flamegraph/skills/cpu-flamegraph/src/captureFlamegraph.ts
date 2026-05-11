/**
 * captureFlamegraph — 远程 perf 采集 + 本地解析 + 服务端 SVG 生成
 *
 * 端到端流水线：
 *   1. SSH → 一次性 probe：USER/PERF/SUDO/PARANOID/ARCH/PID
 *   2. SSH → `perf record ... -- sleep N`（target=-p PID；0 样本时降级 -a）
 *   3. SSH → `perf script -F comm,pid,tid,time,event,ip,sym,dso,period`
 *   4. 本地 `parsePerfScript()` → PerfSample[]
 *   5. `samplesToFolded()` → folded 文本
 *   6. SSH 上传 folded.txt + 仓库自带 vendor/flamegraph.pl 到远端 /tmp/，
 *      远端 perl 渲 SVG（多数 Linux 都有 perl）
 *   7. 重产物**留在远端** /tmp/cpu-flamegraph_<ts>/，本地不落盘
 *
 * Originally ported from an upstream Kunpeng FlameGraph capture tool (which used
 * the ssh2 npm package); v0.6.0 standardized as agent-agnostic by switching
 * `openSshSession` → `openRemoteSession` (local ssh CLI). Core capture logic unchanged.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  openRemoteSession,
  shellEscape,
  type SshConn,
  type RemoteSession,
} from "./captureRunner.js";
import { parsePerfScript, IDLE_FUNCTIONS, type PerfSample } from "./parsePerfScript.js";
import { samplesToFolded } from "./analyze.js";

export interface CaptureOptions {
  conn: SshConn;
  /** 目标进程名，默认 mongod */
  process?: string;
  /** 采样时长（秒），默认 0.3 */
  duration?: number;
  /** 频率 Hz，默认 99（仅 oncpu 有效） */
  freqHz?: number;
  /** 采集类型：oncpu（默认）= CPU 执行热点，offcpu = 等待时间热点 */
  type?: "oncpu" | "offcpu";
}

export interface CaptureResult {
  samples: PerfSample[];
  folded: string;
  serverArtifactDir?: string;
  serverSvgPath?: string;
  serverPerfScriptPath?: string;
  meta: {
    pid: number | null;
    comm: string;
    duration_sec: number;
    freq_hz: number;
    total_samples: number;
    /** "pid" = 聚焦目标进程；"global" = -p PID 0 样本后降级到 -a */
    scope: "pid" | "global";
  };
}

const DEFAULT_DURATION = 3;
const DEFAULT_FREQ = 99;

export async function captureFlamegraph(opts: CaptureOptions): Promise<CaptureResult> {
  const procName = opts.process ?? "mongod";
  const duration = opts.duration ?? DEFAULT_DURATION;
  const freq = opts.freqHz ?? DEFAULT_FREQ;
  const captureType = opts.type ?? "oncpu";

  const session: RemoteSession = openRemoteSession(opts.conn);

  try {
    // 1. 预检
    const probe = await session.exec(
      [
        "echo USER=$(id -u)",
        "echo PERF=$(command -v perf 2>/dev/null || echo missing)",
        "echo SUDO=$(sudo -n true 2>/dev/null && echo ok || echo no)",
        "echo PARANOID=$(cat /proc/sys/kernel/perf_event_paranoid 2>/dev/null || echo unknown)",
        "echo ARCH=$(uname -m)",
        `echo PID=$(pgrep -o ${shellEscape(procName)} 2>/dev/null || echo none)`,
      ].join("; "),
    );
    if (probe.err) throw new Error(`SSH 预检失败: ${probe.err}`);
    const env = parseProbe(probe.stdout);

    if (env["PID"] === "none" || !/^\d+$/.test(env["PID"] ?? "")) {
      throw new Error(`远程未找到 ${procName} 进程`);
    }
    const pid = parseInt(env["PID"]!, 10);

    if (env["PERF"] === "missing") {
      throw new Error(
        "远程未安装 perf 工具。安装方法：" +
          "CentOS/RHEL/openEuler → `sudo yum install -y perf`；" +
          "Ubuntu/Debian → `sudo apt-get install -y linux-tools-$(uname -r) || linux-tools-common`",
      );
    }

    const isRoot = env["USER"] === "0";
    const hasPasswordlessSudo = env["SUDO"] === "ok";
    if (!isRoot && !hasPasswordlessSudo) {
      throw new Error(
        `远程账户 \`${opts.conn.user}\` 非 root 且无免密 sudo（perf 需要 root）。` +
          "请二选一：(1) 用 root 账户登录；或 (2) 远端 `sudo visudo` 加一行 " +
          `\`${opts.conn.user} ALL=(ALL) NOPASSWD: /usr/bin/perf, /bin/rm\``,
      );
    }
    const sudo = isRoot ? "" : "sudo -n ";

    const paranoidNum = parseInt(env["PARANOID"] ?? "", 10);
    const paranoidWarn =
      Number.isFinite(paranoidNum) && paranoidNum >= 3
        ? ` (提示：perf_event_paranoid=${paranoidNum}，可能需要 \`sudo sysctl -w kernel.perf_event_paranoid=1\`)`
        : "";

    const isArm64 = env["ARCH"] === "aarch64" || env["ARCH"] === "arm64";
    const cgFlag = isArm64 ? "--call-graph fp" : "-g";

    if (captureType === "offcpu") {
      const tpCheck = await session.exec(
        `${sudo}perf list tracepoint 2>/dev/null | grep -c sched:sched_switch || echo 0`,
      );
      const tpCount = parseInt(tpCheck.stdout.trim(), 10);
      if (!tpCount || tpCount === 0) {
        throw new Error(
          "远程内核不支持 sched:sched_switch tracepoint（off-cpu 采集必需）。" +
            "可能原因：内核裁剪了 CONFIG_SCHED_TRACER，或缺少 debugfs 挂载。" +
            "检查：`ls /sys/kernel/debug/tracing/`，如不存在则 `mount -t debugfs none /sys/kernel/debug`。",
        );
      }
    }

    const buildRecordCmd = (mode: "pid" | "global") => {
      const target = mode === "pid" ? `-p ${pid}` : "-a";
      if (captureType === "offcpu") {
        return `timeout --signal=INT ${duration + 5} ${sudo}perf record -e sched:sched_switch ${target} ${cgFlag} -o /tmp/_perf.data -- sleep ${duration}`;
      }
      return `timeout --signal=INT ${duration + 5} ${sudo}perf record -F ${freq} -e task-clock ${target} ${cgFlag} -o /tmp/_perf.data -- sleep ${duration}`;
    };
    const scriptCmd = `${sudo}perf script -F comm,pid,tid,time,event,ip,sym,dso,period -i /tmp/_perf.data`;
    const cleanupCmd = `${sudo}rm -f /tmp/_perf.data`;
    const perfTimeoutMs = Math.max(30_000, (duration + 30) * 1000);

    type PerfAttempt = { mode: "pid" | "global"; recordCmd: string; stdout: string; exitCode: number; stderr: string };
    const tryRecord = async (mode: "pid" | "global"): Promise<PerfAttempt> => {
      const recordCmd = buildRecordCmd(mode);
      const fullCmd = `${recordCmd} && ${scriptCmd}; __RC=$?; ${cleanupCmd}; exit $__RC`;
      const res = await session.exec(fullCmd, { timeoutMs: perfTimeoutMs });
      return { mode, recordCmd, stdout: res.stdout, stderr: res.stderr, exitCode: res.exitCode };
    };

    /**
     * 快速判定 perf script 输出里是否有"非 idle"的有效样本。
     * v0.5.9 修复：之前只判 stdout 是否为空字符串，但 idle 栈
     * （arch_cpu_idle / swapper 等）也会产生 stdout 输出，导致
     * 降级条件永远不触发。改为解析后过滤 idle 样本，看有效样本数。
     */
    const hasNonIdleSamples = (scriptOutput: string): boolean => {
      if (!scriptOutput.trim()) return false;
      const parsed = parsePerfScript(scriptOutput);
      const nonIdle = parsed.filter((s) => {
        for (let i = s.stack.length - 1; i >= 0; i--) {
          const fn = s.stack[i]!.fn;
          if (!fn || fn === "[unknown]") continue;
          return !IDLE_FUNCTIONS.has(fn);
        }
        return false;
      });
      return nonIdle.length > 0;
    };

    // -p PID first; 如果全是 idle 函数（有效样本 0）则降级到 -a 全局
    let attempt = await tryRecord("pid");
    let fallback = false;
    const pidHasError = attempt.stderr.match(/error|failed/i);
    const pidHasData = hasNonIdleSamples(attempt.stdout);
    if (!pidHasError && !pidHasData && attempt.exitCode === 0) {
      fallback = true;
      attempt = await tryRecord("global");
    }

    if (!attempt.stdout.trim() && attempt.exitCode !== 0) {
      const versionProbe = await session.exec("perf --version 2>&1 || true", { timeoutMs: 5000 });
      const version = versionProbe.stdout.trim() || "unknown";
      const stderrHint = attempt.stderr.trim().split("\n").slice(0, 3).join(" | ");
      const hint = stderrHint || "未知错误";
      throw new Error(
        `远程 perf 退出码 ${attempt.exitCode}: ${hint}${paranoidWarn}\n` +
          `  perf 版本: ${version}\n` +
          `  失败命令: ${attempt.recordCmd}`,
      );
    }
    if (!attempt.stdout.trim()) {
      throw new Error(
        `perf 采样未得到任何样本（-p PID 和 -a 全局都 0）。` +
          `整机 ${duration}s 内 CPU 使用率近零；卡顿若真实存在，不在 CPU 执行路径上` +
          `（可能是 IO 等待 / 锁 / 网络）。${paranoidWarn}`,
      );
    }
    const perfScriptText = attempt.stdout;

    const samples = parsePerfScript(perfScriptText);
    const totalSamples = samples.reduce((s, x) => s + x.period, 0);
    const folded = samplesToFolded(samples);

    // 服务端落盘 + SVG 生成
    let serverArtifactDir: string | undefined;
    let serverSvgPath: string | undefined;
    let serverPerfScriptPath: string | undefined;
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      serverArtifactDir = `/tmp/cpu-flamegraph_${ts}`;

      await session.exec(`mkdir -p ${serverArtifactDir} && chmod 755 ${serverArtifactDir}`);
      const psName = `perf-script.txt`;
      await session.uploadFile(`${serverArtifactDir}/${psName}`, perfScriptText, { timeoutMs: 30_000 });
      serverPerfScriptPath = `${serverArtifactDir}/${psName}`;

      const fgPl = await readFile(join(vendorRoot(), "flamegraph.pl"));
      await session.uploadFile(`${serverArtifactDir}/flamegraph.pl`, fgPl, { timeoutMs: 30_000 });
      await session.uploadFile(`${serverArtifactDir}/folded.txt`, folded, { timeoutMs: 30_000 });
      const svgName = `flamegraph.svg`;
      const svgCmd =
        `cd ${serverArtifactDir} && ` +
        `perl flamegraph.pl --title 'cpu-flamegraph ${procName} ${captureType === "offcpu" ? "off-CPU" : "on-CPU"}'${captureType === "offcpu" ? " --color=io" : ""} folded.txt > ${svgName} 2>/dev/null && ` +
        `ls -la ${svgName}`;
      const svgRes = await session.exec(svgCmd, { timeoutMs: 30_000 });
      if (svgRes.exitCode === 0 && svgRes.stdout.includes(svgName)) {
        serverSvgPath = `${serverArtifactDir}/${svgName}`;
      }
    } catch {
      /* SVG 生成失败不阻塞主流程；分析数据已拿到 */
    }

    return {
      samples,
      folded,
      serverArtifactDir,
      serverSvgPath,
      serverPerfScriptPath,
      meta: {
        scope: fallback ? "global" : "pid",
        pid,
        comm: procName,
        duration_sec: duration,
        freq_hz: freq,
        total_samples: totalSamples,
      },
    };
  } finally {
    session.close();
  }
}

/**
 * vendor/flamegraph.pl 路径解析。esbuild 把 cli-capture.ts 编到
 * `scripts/capture.mjs`，flamegraph.pl 在兄弟 `vendor/` 下。
 *
 * dev 时 cli-capture.ts 在 `src/`，flamegraph.pl 在兄弟 `vendor/`，
 * 路径同样 `../vendor/flamegraph.pl`。
 */
export function vendorRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidate = join(here, "..", "vendor");
  if (existsSync(join(candidate, "flamegraph.pl"))) return candidate;
  throw new Error(
    `vendor/flamegraph.pl 找不到（searched: ${candidate}）。` +
      `请确认 cartridge 完整：skills/cpu-flamegraph/vendor/flamegraph.pl 应存在。`,
  );
}

function parseProbe(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of s.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.trim();
  }
  return out;
}
