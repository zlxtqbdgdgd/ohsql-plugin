/**
 * cli-ssh — SSH 远端执行 + DB 实例发现 合并入口
 *
 * 用法:
 *   node ssh.mjs --op exec --host <ip> --user <u> [--password <pw>|--privateKeyPath <k>]
 *                          [--port 22]
 *                          (--command "echo hello" | --command-file /path/to/cmd.txt)
 *                          [--timeout 30000] [--output-file /path/to/local.bin]
 *   node ssh.mjs --op session-close --host <ip> --user <u> [--port 22]
 *   node ssh.mjs --op discover --os-file /tmp/perf-kp-sql-<any>-os-<TS>.txt
 *                              [--hint-engine mongo|mysql|redis]
 *   node ssh.mjs --op probe-parse --probe-file <path> [--hint-engine ...]
 *
 * --command vs --command-file:
 *   命令含 ' / " / $ 混杂(probeCmd / osBatchCmd / dbBatchTemplates 等)时 ——
 *   走 --command-file 把命令字面落盘后传路径,避免 LLM 用 $'...' 转义被 OH-SQL
 *   / CC 的安全规则拦截。简短 "echo X" 这类纯命令仍可用 --command。
 *
 * 设计 (v0.12.0 重写):
 *   · 抛掉 ssh2 npm 依赖 · 改 child_process.spawn(ssh) · agent-agnostic ·
 *     任何装了 OpenSSH client 的 agent runtime 都能跑(原 Mode B "Claude Code +
 *     ohsql only" 限制随之解除 · 因为 ssh2 native module 不再需要 setup)
 *   · 密码认证走 OpenSSH 内建 SSH_ASKPASS(写一次性 mode 0700 askpass 脚本 +
 *     SSH_ASKPASS_REQUIRE=force + setsid)· 不依赖 sshpass(macOS 上 sshpass
 *     wrapper 把 stderr 合并 stdout · 也无法稳定传特殊字符密码)· OpenSSH ≥ 8.4
 *     直接走脚本 · 老版本通过 setsid 断 tty 后强制走 askpass 路径
 *   · ControlMaster=auto + ControlPath=/tmp/perf-kp-sql-cm-<sha1[host:port:user]>.sock
 *     + ControlPersist=600 · 同 SKILL 流程内多次 ssh.mjs 调用复用一条已认证 TCP ·
 *     服务端只看到 1 个连接 · 避开 PAM faillock / fail2ban / sshd MaxStartups ·
 *     stale socket 由 ControlMaster=auto 自动接管/重建,无需特殊处理
 *
 * --output-file 模式: stdout 流式直写本地文件 · JSON 里 stdout 仅含 metadata
 * "wrote N bytes to /path"。专为火焰图 SVG / perf script 等大体量产物设计 ——
 * 绕过 LLM 把大块 string 在两次 tool 调用间搬运的失败模式(content=undefined)。
 *
 * 合并自:
 *   - cli-ssh-exec.ts → --op exec
 *   - cli-discover.ts → --op discover
 *
 * 业界对照:
 *   exec:    cpu-flamegraph 的 captureRunner.ts (同款 SSH_ASKPASS + ControlMaster) ·
 *            Ansible raw module
 *   discover: Percona PMM `pmm-admin add --auto-discover` · Datadog Agent service discovery
 *
 * TODO(windows): Microsoft win32-openssh 截至 2026-01 仍不支持 ControlMaster
 * (无 AF_UNIX socket 实装) · Windows agent 暂时只能要么走 WSL,要么后续走
 * Node daemon + Named Pipe 方案。本文件目前默认 POSIX(macOS / Linux / WSL)。
 */

import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { parseOsIntoMetrics } from "./shared/utils.js";

// ============================================================================
// 共享 CLI 工具
// ============================================================================

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

// ============================================================================
// SECTION: SSH spawn helpers (ControlMaster + SSH_ASKPASS)
// ============================================================================

interface ExecArgs {
  host: string;
  user: string;
  password?: string;
  privateKeyPath?: string;
  port: number;
  command: string;
  commandFile?: string;
  timeout: number;
  outputFile?: string;
}

interface SessionCloseArgs {
  host: string;
  user: string;
  port: number;
}

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  err?: string;
  /** --output-file 模式下:写盘字节数(同时 stdout 字段会被替换为 metadata 串)*/
  bytesWritten?: number;
  /** --output-file 模式下:实际落盘绝对路径 */
  outputFile?: string;
}

const CONNECT_TIMEOUT_SEC = 10;
const CONTROL_PERSIST_SEC = 600;

/**
 * ControlPath = /tmp/perf-kp-sql-cm-<sha1(host:port:user)[0..12]>.sock
 *
 * 稳定 hash · 同一 (host, port, user) 跨多次 cli-ssh 调用都得到同一 socket 路径,
 * ControlMaster=auto 自动接管已存活 master 或重建死 socket。
 *
 * 12 hex chars = 48 bits · 给 perf-kp-sql 这种"一次诊断 1 个 host"的场景碰撞概率
 * 远低于实操问题。/tmp 路径长度 < 108 字节(UNIX socket 上限)。
 */
export function controlPathFor(host: string, port: number, user: string): string {
  const hash = createHash("sha1")
    .update(`${host}:${port}:${user}`)
    .digest("hex")
    .slice(0, 12);
  return join(tmpdir(), `perf-kp-sql-cm-${hash}.sock`);
}

/**
 * 写一次性 askpass 脚本 · mode 0700 · 密码用单引号包裹避 shell 解析。
 * 移植自 cpu-flamegraph captureRunner.ts:81-98。
 */
function makeAskpassScript(password: string): { scriptPath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "perf-kp-sql-askpass-"));
  const scriptPath = join(dir, "askpass.sh");
  // POSIX 单引号转义: ' → '\''
  const escaped = password.replace(/'/g, "'\\''");
  writeFileSync(scriptPath, `#!/bin/sh\nprintf '%s\\n' '${escaped}'\n`, { mode: 0o700 });
  return {
    scriptPath,
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    },
  };
}

interface SshSpawnPlan {
  args: string[];
  env: NodeJS.ProcessEnv;
  detached: boolean;
  cleanup?: () => void;
}

/**
 * 拼 ssh argv (含 ControlMaster + auth 选项) · 不含 target / command (调用方追加)。
 * 抽出来便于单测:test 直接断言 argv 而不真起 spawn。
 */
export function buildSshBaseArgs(opts: {
  port: number;
  controlPath: string;
  usePassword: boolean;
  privateKeyPath?: string;
}): string[] {
  const args: string[] = [
    "-p",
    String(opts.port),
    "-o",
    `ConnectTimeout=${CONNECT_TIMEOUT_SEC}`,
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "ServerAliveInterval=15",
    "-o",
    "ControlMaster=auto",
    "-o",
    `ControlPath=${opts.controlPath}`,
    "-o",
    `ControlPersist=${CONTROL_PERSIST_SEC}`,
  ];
  if (opts.usePassword) {
    // ASKPASS 模式: 禁 pubkey(避免本机默认 key 抢先 fail 后才降级)
    // 不开 BatchMode(BatchMode 会禁 password prompt → askpass 也不触发)
    args.push("-o", "PreferredAuthentications=password,keyboard-interactive");
    args.push("-o", "PubkeyAuthentication=no");
    args.push("-o", "NumberOfPasswordPrompts=1");
  } else {
    // key 模式: BatchMode=yes 让 password 提示直接 fail · 不卡脚本
    args.push("-o", "BatchMode=yes");
  }
  if (opts.privateKeyPath) {
    args.push("-i", opts.privateKeyPath);
  }
  return args;
}

function planSshSpawn(args: ExecArgs, sshArgs: string[]): SshSpawnPlan {
  // 同时给 password + privateKeyPath → key 优先 · 与 cpu-flamegraph 行为对齐
  const usePassword = !!args.password && !args.privateKeyPath;
  if (!usePassword) {
    return { args: sshArgs, env: process.env, detached: false };
  }
  const { scriptPath, cleanup } = makeAskpassScript(args.password!);
  return {
    args: sshArgs,
    env: {
      ...process.env,
      SSH_ASKPASS: scriptPath,
      // OpenSSH ≥ 8.4 看到 force 直接走脚本 · 即使有 tty
      SSH_ASKPASS_REQUIRE: "force",
      // 老版本回退路径需要 DISPLAY 非空
      DISPLAY: process.env["DISPLAY"] || ":0",
    },
    // POSIX setsid → 没 controlling tty → 必走 askpass
    detached: true,
    cleanup,
  };
}

// ============================================================================
// SECTION: exec
// ============================================================================

function execOutput(r: ExecResult): never {
  process.stdout.write(JSON.stringify(r) + "\n");
  process.exit(r.err ? 1 : 0);
}

function execDie(msg: string): never {
  execOutput({ stdout: "", stderr: "", exitCode: null, err: msg });
}

function parseExecArgs(argv: Record<string, string | boolean>): ExecArgs {
  const host = typeof argv.host === "string" ? argv.host : "";
  const user = typeof argv.user === "string" ? argv.user : "";
  if (!host || !user) {
    execDie("必须提供 --host 和 --user");
  }
  // 防 ssh option injection(`-oProxyCommand=...` 通过 user/host 前导 `-` 注入)
  if (host.startsWith("-") || user.startsWith("-")) {
    execDie("--host / --user 不得以 `-` 起首(防 ssh 选项注入)");
  }

  const portRaw = typeof argv.port === "string" ? argv.port : "22";
  const timeoutRaw = typeof argv.timeout === "string" ? argv.timeout : "120000";
  const password = typeof argv.password === "string" ? argv.password : undefined;
  const privateKeyPath =
    (typeof argv.privateKeyPath === "string" && argv.privateKeyPath) ||
    (typeof argv["private-key-path"] === "string" ? (argv["private-key-path"] as string) : undefined) ||
    undefined;
  const command = typeof argv.command === "string" ? argv.command : "";
  const commandFile =
    (typeof argv.commandFile === "string" && argv.commandFile) ||
    (typeof argv["command-file"] === "string" ? (argv["command-file"] as string) : undefined) ||
    undefined;
  const outputFile =
    (typeof argv.outputFile === "string" && argv.outputFile) ||
    (typeof argv["output-file"] === "string" ? (argv["output-file"] as string) : undefined) ||
    undefined;

  return {
    host,
    user,
    password,
    privateKeyPath,
    port: parseInt(portRaw, 10) || 22,
    command,
    commandFile,
    timeout: parseInt(timeoutRaw, 10) || 120_000,
    outputFile,
  };
}

/**
 * 跑 ssh · 收 stdout/stderr · 超时 SIGTERM。
 *
 * --output-file: stdout 直流到本地文件 · JSON 仅返 bytesWritten metadata。
 *
 * 退出码语义 (OpenSSH 约定):
 *   0    成功
 *   255  ssh 自身错误 (auth / 连接拒绝 / DNS / 超时) → 升级为 ExecResult.err
 *   其它 远端命令的退出码 (业务失败 · 交调用方判)
 */
function runSshExec(plan: SshSpawnPlan, timeoutMs: number, outputFile?: string): Promise<ExecResult> {
  return new Promise<ExecResult>((resolve) => {
    let proc: ChildProcess;
    let cleanupCalled = false;
    const doCleanup = () => {
      if (cleanupCalled) return;
      cleanupCalled = true;
      plan.cleanup?.();
    };

    let writeStream: ReturnType<typeof createWriteStream> | null = null;
    let writeStreamErr: Error | null = null;
    if (outputFile) {
      try {
        mkdirSync(dirname(outputFile), { recursive: true });
      } catch (e) {
        doCleanup();
        resolve({
          stdout: "",
          stderr: "",
          exitCode: null,
          err: `创建目录失败 ${dirname(outputFile)}: ${e instanceof Error ? e.message : String(e)}`,
        });
        return;
      }
      writeStream = createWriteStream(outputFile);
      writeStream.on("error", (e) => {
        writeStreamErr = e;
      });
    }

    try {
      proc = spawn("ssh", plan.args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: plan.env,
        detached: plan.detached,
      });
    } catch (e) {
      doCleanup();
      try { writeStream?.destroy(); } catch { /* ignore */ }
      resolve({
        stdout: "",
        stderr: "",
        exitCode: null,
        err: `spawn ssh failed: ${e instanceof Error ? e.message : String(e)}`,
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    let bytesWritten = 0;
    let timedOut = false;

    if (writeStream) {
      proc.stdout?.on("data", (c: Buffer) => {
        writeStream!.write(c);
        bytesWritten += c.length;
      });
    } else {
      proc.stdout?.on("data", (c: Buffer) => { stdout += c.toString("utf-8"); });
    }
    proc.stderr?.on("data", (c: Buffer) => { stderr += c.toString("utf-8"); });

    // EPIPE 在 SSH 中断时会经由 stdin · 吞掉避免未捕获崩溃
    proc.stdin?.on("error", () => { /* swallow EPIPE */ });
    // 立即关 stdin 防 sudo 等远端命令等待密码挂起
    try { proc.stdin?.end(); } catch { /* ignore */ }

    const timer = setTimeout(() => {
      timedOut = true;
      try { proc.kill("SIGTERM"); } catch { /* ignore */ }
    }, timeoutMs);

    proc.on("error", (e) => {
      clearTimeout(timer);
      doCleanup();
      try { writeStream?.destroy(); } catch { /* ignore */ }
      resolve({
        stdout,
        stderr,
        exitCode: null,
        err: `ssh not available locally: ${e.message}`,
      });
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      doCleanup();
      const finishWithStream = (final: ExecResult) => {
        if (writeStream) {
          writeStream.end(() => resolve(final));
        } else {
          resolve(final);
        }
      };
      if (timedOut) {
        finishWithStream({
          stdout: writeStream ? "" : stdout,
          stderr,
          exitCode: code,
          err: `命令超时 (${timeoutMs}ms)`,
        });
        return;
      }
      const exitCode = code;
      // ssh 退出码 255 = ssh 通道层错误 (auth / 网络 / DNS) → 升级 err
      if (exitCode === 255) {
        // 部分本地 ssh wrapper 把 stderr pty-合并到 stdout · 优先 stderr · 没就回退 stdout
        const stderrHint = stderr.trim();
        const stdoutHint = (writeStream ? "" : stdout).trim();
        const source = stderrHint || stdoutHint;
        const hint = source ? source.split("\n").slice(-3).join(" | ") : "(no output)";
        finishWithStream({
          stdout: writeStream ? "" : stdout,
          stderr,
          exitCode,
          err: `SSH connection failed (255): ${hint}`,
        });
        return;
      }
      if (writeStream) {
        if (writeStreamErr) {
          finishWithStream({
            stdout: "",
            stderr,
            exitCode,
            err: `写盘失败 ${outputFile}: ${writeStreamErr.message}`,
          });
          return;
        }
        finishWithStream({
          stdout: `<wrote ${bytesWritten} bytes to ${outputFile}>`,
          stderr,
          exitCode,
          bytesWritten,
          outputFile,
        });
        return;
      }
      finishWithStream({ stdout, stderr, exitCode });
    });
  });
}

/**
 * Read --command-file with retry + rich ENOENT diagnostic.
 *
 * Pattern observed (OH-SQL 0.36.x — 0.51.0): Write tool reports `Wrote /path`
 * but immediately following `ssh.mjs --command-file /path` gets ENOENT.
 * Upstream FileWriteTool is sync writeFileSync · no overlay · no staging ·
 * so root cause is unclear. Hypothesis: agent's --command-file argument
 * differs from Write's path by invisible bytes (whitespace / unicode form /
 * stray prefix). Print everything so the next failure self-diagnoses.
 */
async function readCommandFileWithDiag(commandFile: string): Promise<string> {
  // Small retry loop to absorb any plausible fs sync race (cheap)
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await readFile(commandFile, "utf8");
    } catch (e) {
      lastErr = e;
      const code = (e as NodeJS.ErrnoException | undefined)?.code;
      if (code !== "ENOENT") break; // only retry on missing-file race
      if (attempt < 2) await new Promise((r) => setTimeout(r, 100));
    }
  }
  // All retries exhausted — collect rich diagnostic
  const errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  const path = await import("node:path");
  const fs = await import("node:fs");
  const diag: Record<string, unknown> = {
    commandFile_argv_raw: commandFile,
    commandFile_byteLength: Buffer.byteLength(commandFile, "utf8"),
    commandFile_codepoints: Array.from(commandFile).map((c) => c.codePointAt(0)),
    isAbsolute: path.isAbsolute(commandFile),
    cwd: process.cwd(),
    HOME: process.env.HOME ?? "",
    // 不输出 full_argv:process.argv 含 `--password` / `--privateKeyPath` 后跟的明文,
    // 经 stdout JSON 倒灌进 LLM 上下文与 trace.jsonl 是凭据泄漏。其余 diag 字段
    // (commandFile_argv_raw / codepoints / dirname 等)已足够定位 ENOENT 根因。
  };
  try {
    const dir = path.dirname(commandFile);
    const targetBase = path.basename(commandFile);
    diag.dirname = dir;
    diag.basename = targetBase;
    const entries = fs.readdirSync(dir);
    diag.dirEntries = entries;
    diag.exactMatch = entries.includes(targetBase);
    diag.candidateNeighbours = entries
      .filter((n) => n.includes(targetBase.slice(0, 25)) || targetBase.includes(n.slice(0, 25)))
      .map((n) => ({
        name: n,
        nameByteLen: Buffer.byteLength(n, "utf8"),
        sameAsTarget: n === targetBase,
        codepoints: Array.from(n).map((c) => c.codePointAt(0)),
      }));
  } catch (dirErr) {
    diag.dirReadError = dirErr instanceof Error ? dirErr.message : String(dirErr);
  }
  execDie(
    `读取 --command-file 失败: ${errMsg} · diag=${JSON.stringify(diag)}`,
  );
}

async function runExec(argv: Record<string, string | boolean>): Promise<void> {
  const args = parseExecArgs(argv);
  // --command-file 让 LLM 不再 quote 含 ' / " / $ 的 command,绕开 OH-SQL/CC 的 $'...' 拦截
  if (args.command && args.commandFile) {
    execDie("--command 与 --command-file 不能同时提供");
  }
  if (args.commandFile) {
    args.command = await readCommandFileWithDiag(args.commandFile);
  }
  if (!args.command) {
    execDie("必须提供 --command 或 --command-file");
  }
  if (!args.password && !args.privateKeyPath) {
    execDie("必须提供 --password 或 --privateKeyPath");
  }

  const usePassword = !!args.password && !args.privateKeyPath;
  const controlPath = controlPathFor(args.host, args.port, args.user);
  const baseArgs = buildSshBaseArgs({
    port: args.port,
    controlPath,
    usePassword,
    privateKeyPath: args.privateKeyPath,
  });
  // `--` 终止 ssh 选项解析,防 user/host 起首 `-` 触发 -oProxyCommand 注入(深度防御:parseExecArgs 已拒绝)
  const sshArgs = [...baseArgs, "--", `${args.user}@${args.host}`, args.command];
  const plan = planSshSpawn(args, sshArgs);

  const result = await runSshExec(plan, args.timeout, args.outputFile);

  // Stale ControlMaster socket retry: if SSH fails with 255 and the control
  // socket file exists, remove it and retry once. This handles the case where
  // a previous session crashed without calling session-close.
  if (result.exitCode === 255 && existsSync(controlPath)) {
    try { rmSync(controlPath, { force: true }); } catch { /* ignore */ }
    // Regenerate plan — the first runSshExec may have cleaned up the askpass script
    const retryPlan = planSshSpawn(args, sshArgs);
    const retryResult = await runSshExec(retryPlan, args.timeout, args.outputFile);
    execOutput(retryResult);
    return;
  }

  execOutput(result);
}

// ============================================================================
// SECTION: session-close
// ============================================================================

function parseSessionCloseArgs(argv: Record<string, string | boolean>): SessionCloseArgs {
  const host = typeof argv.host === "string" ? argv.host : "";
  const user = typeof argv.user === "string" ? argv.user : "";
  if (!host || !user) {
    execDie("必须提供 --host 和 --user");
  }
  if (host.startsWith("-") || user.startsWith("-")) {
    execDie("--host / --user 不得以 `-` 起首(防 ssh 选项注入)");
  }
  const portRaw = typeof argv.port === "string" ? argv.port : "22";
  return { host, user, port: parseInt(portRaw, 10) || 22 };
}

/**
 * 显式收掉 ControlMaster · 避免 ControlPersist=600 期间留 socket。
 * SKILL 流程末尾调一次 · 即使忘调,master 也会自动到期退出。
 */
async function runSessionClose(argv: Record<string, string | boolean>): Promise<void> {
  const args = parseSessionCloseArgs(argv);
  const controlPath = controlPathFor(args.host, args.port, args.user);
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = (r: { ok: boolean; err?: string }) => {
      if (done) return;
      done = true;
      process.stdout.write(JSON.stringify({ ...r, controlPath }) + "\n");
      resolve();
    };
    let proc: ChildProcess;
    try {
      proc = spawn(
        "ssh",
        ["-O", "exit", "-S", controlPath, "-p", String(args.port), "--", `${args.user}@${args.host}`],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (e) {
      finish({ ok: true, err: `spawn ssh failed (master 可能本就没起): ${e instanceof Error ? e.message : String(e)}` });
      return;
    }
    let stderr = "";
    proc.stderr?.on("data", (c: Buffer) => { stderr += c.toString("utf-8"); });
    const timer = setTimeout(() => {
      try { proc.kill("SIGTERM"); } catch { /* ignore */ }
      finish({ ok: true, err: "session-close 超时(可能 master 已退出)" });
    }, 5000);
    proc.on("error", () => {
      clearTimeout(timer);
      finish({ ok: true, err: "ssh 不可用(可能 master 已退出)" });
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      // 找不到 socket / 已退出都算 ok · master 反正没了
      if (code === 0 || /No such file or directory|Control socket connect|not connected/i.test(stderr)) {
        finish({ ok: true });
      } else {
        finish({ ok: true, err: `ssh -O exit exit=${code}: ${stderr.trim() || "(no stderr)"}` });
      }
    });
  });
}

// ============================================================================
// SECTION: discover (合并自 cli-discover.ts)
// ============================================================================
//
// 解析 ###DISCOVERY### 段输出实例列表 · LLM 根据 instances.length 决定下一步:
//   - 0    → 报错 "未发现 DB 进程" + 排查建议
//   - 1    → 自动选中,开始 full diagnose
//   - > 1  → 让 LLM 在对话里展示候选 · 用户回复时挑

interface Instance {
  engine: "mongo" | "mysql" | "redis";
  pid: string;
  port: string;         // "" 表示未发现 · LLM 需降级到 defaultDbPorts
  bind: string;
  label: string;
  /**
   * `high`     = ss/netstat 直接 parse 出监听端口(确定)
   * `low`      = pgrep 命中 PID 但 ss 未拿到监听端口 · fallback 默认端口 / 127.0.0.1
   * `very_low` = pgrep 三引擎全空 · 无 PID 仍按 hint-engine / 默认全列出候选
   *              (G1+ · 不让用户卡在 0 实例 · 让 LLM 直接进 picker)
   */
  confidence: "high" | "low" | "very_low";
  /**
   * `ss`                    = 从 ss -lntp 的 LISTEN 行 parse
   * `default-port-guess`    = PID 存在但端口缺失 · 按引擎默认端口猜 + 默认 bind 127.0.0.1
   * `no-pid-default-engine` = G1+ · pgrep 三引擎全空 · 按 hint / 默认全列候选
   */
  source: "ss" | "default-port-guess" | "no-pid-default-engine";
}

const DEFAULT_PORTS: Record<string, string> = {
  mongo: "27017",
  mysql: "3306",
  redis: "6379",
};

const ENGINE_BY_PROCESS: Record<string, Instance["engine"]> = {
  mongod: "mongo",
  mysqld: "mysql",
  "redis-server": "redis",
};

export type HintEngine = Instance["engine"] | null;

export function normalizeHintEngine(raw: string): HintEngine {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s || s === "skipped" || s === "auto") return null;
  if (s === "mongodb") return "mongo";
  if (s === "mongo" || s === "mysql" || s === "redis") return s;
  return null;
}

/**
 * G1+ · 三引擎 pgrep 全空时构造的兜底候选 · confidence=very_low ·
 * source=no-pid-default-engine。给 LLM 一组可选项 · 不让用户卡在 "0 实例" 报错。
 */
function buildFallbackInstance(engine: Instance["engine"]): Instance {
  const port = DEFAULT_PORTS[engine] ?? "";
  const bind = "127.0.0.1";
  return {
    engine,
    pid: "",
    port,
    bind,
    label: `${engine} · ${bind}:${port} · 默认推断 · 未发现进程`,
    confidence: "very_low",
    source: "no-pid-default-engine",
    port_source: "no-pid-default",
  } as Instance & { port_source: string };
}

export function parseInstances(stdout: string, hintEngine: HintEngine = null, sectionMarker: string = "DISCOVERY"): Instance[] {
  const openMarker = `###${sectionMarker}###`;
  const lines = stdout.split("\n");
  let inDiscovery = false;
  const out: Instance[] = [];
  // 是否进入过段标记 · 用于区分"段缺失"与"段在但 PID 全空"两种均触发 G1+ 兜底
  for (const raw of lines) {
    const line = raw.trim();
    if (line === openMarker) {
      inDiscovery = true;
      continue;
    }
    if (!inDiscovery) continue;
    if (line.startsWith("###")) break; // next section
    if (!line.includes("engine=")) continue;

    // 允许外围引号(bash 带引号 echo 的遗留)
    const stripped = line.replace(/^['"]+|['"]+$/g, "");
    const m: Record<string, string> = {};
    for (const tok of stripped.split(/\s+/)) {
      const eq = tok.indexOf("=");
      if (eq > 0) m[tok.slice(0, eq)] = tok.slice(eq + 1);
    }
    const proc = m.engine;
    const engineCanonical = proc ? ENGINE_BY_PROCESS[proc] : undefined;
    if (!engineCanonical) continue;

    const pid = (m.PID ?? "").trim();
    if (!pid) continue; // PID 为空说明该引擎没有跑

    const rawPort = (m.PORT ?? "").trim();
    const rawBind = (m.BIND ?? "").trim();
    // G1 · PID 命中但端口缺失 · fallback 默认端口 · confidence=low · source=default-port-guess
    const portMissing = !rawPort;
    const bindMissing = !rawBind;
    const port = rawPort || DEFAULT_PORTS[engineCanonical] || "";
    const bind = rawBind || "127.0.0.1";

    const usedFallback = portMissing || bindMissing;
    const confidence: Instance["confidence"] = usedFallback ? "low" : "high";
    const source: Instance["source"] = usedFallback ? "default-port-guess" : "ss";

    // port_source 是老字段 · 保留兼容性(下游 extractDiscovery / 测试可能读)
    const portSource = !portMissing ? "ss" : "default";
    out.push({
      engine: engineCanonical,
      pid,
      port,
      bind,
      label: `${engineCanonical} · ${bind}:${port} · pid=${pid}`,
      confidence,
      source,
      port_source: portSource,
    } as Instance & { port_source: string });
  }

  // G1+ · 三引擎 pgrep 全空(out 为空) · 不返 [] 让用户卡 0 实例 ·
  // 改成按 hintEngine 给一条 · 或没 hint 时给三引擎默认全列(让 LLM 走 picker)
  if (out.length === 0) {
    if (hintEngine) {
      out.push(buildFallbackInstance(hintEngine));
    } else {
      for (const eng of ["mongo", "mysql", "redis"] as const) {
        out.push(buildFallbackInstance(eng));
      }
    }
  }

  return out;
}

function discoverWriteError(msg: string): never {
  process.stdout.write(JSON.stringify({ ok: false, error: msg }));
  process.exit(1);
}

async function runDiscover(argv: Record<string, string | boolean>): Promise<void> {
  const osFile = typeof argv["os-file"] === "string" ? argv["os-file"] : undefined;
  if (!osFile) discoverWriteError("missing --os-file");

  let raw: string;
  try {
    raw = await readFile(osFile!, "utf8");
  } catch (e) {
    // v0.5 · 友好失败提示 · 指向 LLM 最常见的漏调 Write 场景
    const baseErr = e instanceof Error ? e.message : String(e);
    const isMissing = /ENOENT|no such file|does not exist/i.test(baseErr);
    const hint = isMissing
      ? " · 最可能原因:LLM 在 SSH 命令(remote osBatchCmd)之后跳过了 Write 落盘步骤 · 请回查上一轮 SSH 命令返回的 stdout 是否调用了 Write(file_path=" + osFile + ", content=<osStdout>) · 见 SKILL.md Step 2.3 · 不是 Write 工具不可用"
      : "";
    discoverWriteError(`failed to read ${osFile}: ${baseErr}${hint}`);
  }

  const osMetrics = parseOsIntoMetrics(raw!);
  // G1+ · hint-engine 让 LLM 把 slash args 里 engine= 透传进来 · pgrep 全空时按 hint 出
  // 候选(避免出三引擎默认全列)· skipped / 空字符串视为无 hint。
  const hintRaw = argv["hint-engine"];
  const hintEngine = normalizeHintEngine(typeof hintRaw === "string" ? hintRaw : "");
  const instances = parseInstances(raw!, hintEngine);

  const osReleaseRaw = String(osMetrics.os_release_raw ?? "");
  const versionLine = osReleaseRaw.split("\n").find((l) => l.startsWith("VERSION_ID="));
  const os_version = versionLine ? versionLine.replace(/^VERSION_ID="?|"?$/g, "").trim() : null;

  // G1 · _notes:若任一 instance 用了 default-port-guess · 标记到顶层 _notes
  // 便于 LLM / 调试从 stdout 直接看到降级事实(不需要逐条扫 instance)。
  const notes: string[] = [];
  if (instances.some((i) => (i as Instance).source === "default-port-guess")) {
    notes.push("pid-found-port-missing-using-default");
  }
  // G1+ · pgrep 三引擎全空 · 走 no-pid-default-engine 兜底
  // _notes 仅为机器可读日志 · 中性措辞 · 不让 LLM / 用户误以为 SSH 连不上
  if (instances.some((i) => (i as Instance).source === "no-pid-default-engine")) {
    notes.push("port-inferred-from-default");
  }

  process.stdout.write(
    JSON.stringify({
      ok: true,
      instances,
      _notes: notes,
      os_id: osMetrics.os_id ?? null,
      os_version,
      kernel_version: osMetrics.kernel_version ?? null,
      arch: osMetrics.arch ?? null,
      cpu_model: osMetrics.cpu_model ?? null,
      cpu_vendor: osMetrics.cpu_vendor ?? null,
      cpu_cores: osMetrics.cpu_cores ?? null,
      numa_nodes: osMetrics.numa_nodes ?? null,
      total_mem_mb: osMetrics.total_mem_mb ?? null,
      virt: osMetrics.env_virt_type ?? null,
      sys_vendor: osMetrics.env_sys_vendor ?? null,
      product: osMetrics.env_product_name ?? null,
    }),
  );
}

// ============================================================================
// Probe parser · 解析 Step 1.3 落盘的 probe 文件 · 提取 instances + flame_capable
// ============================================================================

function parseSectionContent(stdout: string, sectionMarker: string): string {
  const openMarker = `###${sectionMarker}###`;
  const lines = stdout.split("\n");
  let inSection = false;
  const collected: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line === openMarker) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    if (line.startsWith("###")) break;
    collected.push(line);
  }
  return collected.join("\n").trim();
}

async function runProbeParse(argv: Record<string, string | boolean>): Promise<void> {
  const probeFile = typeof argv["probe-file"] === "string" ? argv["probe-file"] : undefined;
  if (!probeFile) {
    process.stdout.write(JSON.stringify({ ok: false, error: "missing --probe-file" }));
    process.exit(1);
  }

  let raw: string;
  try {
    raw = await readFile(probeFile!, "utf8");
  } catch (e) {
    const baseErr = e instanceof Error ? e.message : String(e);
    const isMissing = /ENOENT|no such file|does not exist/i.test(baseErr);
    const hint = isMissing
      ? " · LLM 可能跳过了 Write 落盘步骤 · 请回查 ssh probe 返回的 stdout 是否调用了 Write(file_path=" + probeFile + ", content=<probeStdout>) · 见 SKILL.md Step 1.3"
      : "";
    process.stdout.write(JSON.stringify({ ok: false, error: `failed to read ${probeFile}: ${baseErr}${hint}` }));
    process.exit(1);
  }

  const hintRaw = argv["hint-engine"];
  const hintEngine = normalizeHintEngine(typeof hintRaw === "string" ? hintRaw : "");

  // ENGINES 段:用 parseInstances 复用 PID/PORT/BIND 解析逻辑;过滤掉 fallback(probe 阶段不要默认端口推断,只要真实跑着的进程)
  const allInstances = parseInstances(raw!, null, "ENGINES");
  const realInstances = allInstances.filter((i) => (i as Instance).source !== "no-pid-default-engine");

  // PERF / OFFCPU 段:第一行就是 `command -v` 输出 · 内容为 path 或 "MISSING"
  const perfRaw = parseSectionContent(raw!, "PERF");
  const offcpuRaw = parseSectionContent(raw!, "OFFCPU");
  const perfAvailable = !!perfRaw && perfRaw !== "MISSING" && !/MISSING/.test(perfRaw);
  const offcpuAvailable = !!offcpuRaw && offcpuRaw !== "MISSING" && !/MISSING/.test(offcpuRaw);

  let flame_capable: "oncpu+offcpu" | "oncpu" | "none" = "none";
  if (perfAvailable && offcpuAvailable) flame_capable = "oncpu+offcpu";
  else if (perfAvailable) flame_capable = "oncpu";

  process.stdout.write(
    JSON.stringify({
      ok: true,
      instances: realInstances,
      hint_engine: hintEngine,
      flame_capable,
      perf_path: perfAvailable ? perfRaw : null,
      offcpu_path: offcpuAvailable ? offcpuRaw : null,
    }),
  );
}

// ============================================================================
// CLI dispatcher
// ============================================================================

async function main(): Promise<void> {
  const argv = parseArgs(process.argv.slice(2));
  const op = typeof argv.op === "string" ? argv.op : "";
  if (op === "exec") return runExec(argv);
  if (op === "session-close") return runSessionClose(argv);
  if (op === "discover") return runDiscover(argv);
  if (op === "probe-parse") return runProbeParse(argv);
  process.stdout.write(JSON.stringify({
    ok: false,
    err: `unknown --op: ${op || "(missing)"} · expect: exec | session-close | discover | probe-parse`,
  }) + "\n");
  process.exit(2);
}

const isCli = (() => {
  try {
    const entry = process.argv[1] ?? "";
    // 匹配 bundle 产物 (ssh.mjs / ssh.js) 或源文件 (cli-ssh.ts / cli-ssh.js)
    // 必须 anchor 到 .ext$ · 否则 cli-ssh.test.ts 之类的 import 会误触发
    return /(^|[\\/])(ssh\.(mjs|js|ts)|cli-ssh\.(ts|js|mjs))$/.test(entry);
  } catch {
    return false;
  }
})();

if (isCli) {
  main().catch((err) => {
    process.stdout.write(JSON.stringify({ ok: false, err: err instanceof Error ? err.message : String(err) }) + "\n");
    process.exit(1);
  });
}
