/**
 * captureRunner — 用本地 OpenSSH `ssh`/`scp` CLI 提供 RemoteSession 接口
 *
 * Originally ported from a Kunpeng SSH service (based on the ssh2 npm package).
 * v0.6.0 standardized as an agent-agnostic local-`ssh`-CLI wrapper. Zero npm
 * 依赖，只走 child_process.spawn —— 这是 cartridge 跨 harness 可移植的关键：
 * 任何装有 OpenSSH client 的机器都能跑（Linux/macOS 自带，Windows 通过 WSL
 * 或 OpenSSH-Win 也可）。
 *
 * **认证**：
 *   - 默认（无 password）：仅 SSH key（依赖用户 ssh-agent / `~/.ssh/config`
 *     / known_hosts）。`BatchMode=yes` 强制非交互——遇到密码提示直接 fail。
 *   - 密码模式（password 字段非空 + 无 privateKeyPath）：使用 OpenSSH 内建
 *     `SSH_ASKPASS` 机制 —— 写一个临时 askpass 脚本（mode 0700）打印密码,
 *     spawn ssh 时把 `SSH_ASKPASS=<脚本>` + `SSH_ASKPASS_REQUIRE=force`
 *     +`DISPLAY=:0` 通过 env 注入,并用 `detached:true`(POSIX setsid)断开
 *     controlling tty。OpenSSH ≥ 8.4 看到 `SSH_ASKPASS_REQUIRE=force` 直接走
 *     askpass; 老版本因 setsid 后无 tty 也会回退到 askpass + DISPLAY 路径。
 *     同时给 password 和 privateKeyPath 时 key 优先, password 忽略。
 *     **不再依赖 `sshpass`** —— 历史上发现 macOS 上的非官方 sshpass wrapper
 *     (基于 expect, `log_user 1`) 会把 ssh 的 stderr 合并到 pty stdout, 调
 *     用方拿不到真正的失败原因, 也无法稳定传递特殊字符密码。
 *
 * **连接模型**：每个 `exec`/`uploadFile` 调用 spawn 一个新的 ssh/scp 进程。
 * 不开 ControlMaster 多路复用（v1 简单优先；典型 capture 6-8 次 exec，
 * 每次 ~500ms TCP 握手开销可接受）。
 */

import { spawn as defaultSpawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

/**
 * Module-level spawn reference. Production code uses node:child_process.spawn;
 * tests override via {@link _setSpawnImpl} to inject a mock and avoid a real
 * ssh child process. Module-level variable (not DI per-call) keeps the public
 * `openRemoteSession(conn)` signature unchanged so plugin runtime callers
 * don't need to know about the test seam.
 */
let spawn: typeof defaultSpawn = defaultSpawn;

/**
 * **Test-only.** Override spawn implementation for unit tests; pass `undefined`
 * to reset to the real `node:child_process.spawn`. Underscore prefix marks
 * it as internal — production code must not call this.
 */
export function _setSpawnImpl(fn?: typeof defaultSpawn): void {
  spawn = fn ?? defaultSpawn;
}
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /**
   * SSH 通道层错误（连接失败 / ssh CLI 缺失 / 超时）。远程命令返回非零退出码
   * 不算 err —— 那是业务失败，调用方根据 exitCode + stderr 自己判。
   */
  err?: string;
}

export interface RemoteSession {
  exec(cmd: string, opts?: { timeoutMs?: number }): Promise<ExecResult>;
  uploadFile(
    remotePath: string,
    content: Buffer | string,
    opts?: { timeoutMs?: number },
  ): Promise<void>;
  close(): void;
}

export interface SshConn {
  host: string;
  user: string;
  port?: number;
  /**
   * 私钥路径。不传则依赖 ssh-agent / `~/.ssh/config` 默认 IdentityFile
   * （和直接 `ssh user@host` 行为一致）。
   */
  privateKeyPath?: string;
  /**
   * 登陆密码。提供则走 SSH_ASKPASS 机制（详见文件头注释）。同时给
   * privateKeyPath 时本字段被忽略（key 优先）。
   */
  password?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_PORT = 22;
const CONNECT_TIMEOUT_SEC = 10;

/**
 * 写一个一次性的 askpass 脚本（POSIX shell + printf），返回脚本路径和清理钩子。
 * 模式 0700,只能 owner 读写执行,密码以单引号包裹避免 shell 解析。
 */
function makeAskpassScript(password: string): { scriptPath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), `cpu-fg-askpass-${randomBytes(4).toString("hex")}-`));
  const scriptPath = join(dir, "askpass.sh");
  // POSIX 单引号转义：' → '\''
  const escaped = password.replace(/'/g, "'\\''");
  // 不写换行后再 printf —— 用 printf 一行直出避免任何 shell 历史/扩展
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

/**
 * 打开一个 RemoteSession（其实是构造一个工厂对象，每次 exec 重新 spawn）。
 *
 * 不做实际连接握手（ssh CLI 没法在不发命令的情况下"只 connect"）。
 * 想验证连通性就 `await session.exec("true")`。
 */
export function openRemoteSession(conn: SshConn): RemoteSession {
  // 防 ssh option injection(`-oProxyCommand=...` 通过 user/host 前导 `-` 注入)
  if (conn.user.startsWith("-") || conn.host.startsWith("-")) {
    throw new Error("conn.user / conn.host 不得以 `-` 起首(防 ssh 选项注入)");
  }
  const target = `${conn.user}@${conn.host}`;
  const port = conn.port ?? DEFAULT_PORT;
  // 同时给 password + privateKeyPath → key 优先，password 静默忽略
  const usePassword = !!conn.password && !conn.privateKeyPath;

  // ControlMaster · 一次 TCP+auth 多 channel 复用,服务端只看到 1 个连接
  //
  // 不开 ControlMaster 时,一次 capture.mjs 会建 8-9 个独立 SSH 连接(预检 +
  // perf --version + tracepoint check + perf record + mkdir + 3 次上传 + svg
  // 生成),每个独立 TCP+auth。在装了 fail2ban / pam_faillock / sshd MaxStartups
  // 限速的主机上(华为云 EulerOS / RHEL+PAM 等),短时间内 8-9 个连接很容易撞
  // 阈值 → 中途某个被丢 → 全锁,burst 失败。
  //
  // 加上 ControlMaster=auto 后,第一个 ssh spawn 顺手开 master(socket 监听),
  // 后续所有 ssh spawn 看到 socket 存在 → 直接通过 socket 起新 channel(完全
  // 跳过 TCP 握手 + auth)。服务端视角只有 1 个连接,8-9 channel 是 SSH 协议
  // 内部多路复用,不计入连接频率限速器。
  //
  // ControlPath 用 PID + ms 时间戳 + 4 位随机,避免并行 capture.mjs 实例
  // socket 冲突。路径长度务必 < 108 字节(UNIX socket 上限)所以放 /tmp。
  // ControlPersist=30 让 master 在最后一个 channel 结束后再保持 30s,
  // 方便快速连续调用(本进程内多个 exec 之间)。
  const controlPath = `/tmp/cpu-flame-cm-${process.pid}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 6)}.sock`;

  const cmOptions = (): string[] => [
    "-o",
    "ControlMaster=auto",
    "-o",
    `ControlPath=${controlPath}`,
    "-o",
    "ControlPersist=30",
  ];

  const baseSshArgs = (): string[] => {
    const args: string[] = [
      "-p",
      String(port),
      "-o",
      `ConnectTimeout=${CONNECT_TIMEOUT_SEC}`,
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      "ServerAliveInterval=15",
      ...cmOptions(),
    ];
    if (usePassword) {
      // ASKPASS 模式：禁 pubkey（避免本机默认 key 抢先抢到 auth slot 失败再降级）
      // 不开 BatchMode（要让 ssh 走密码 auth 流程，BatchMode 会禁用密码提示导致 askpass 也不触发）
      args.push("-o", "PreferredAuthentications=password,keyboard-interactive");
      args.push("-o", "PubkeyAuthentication=no");
      args.push("-o", "NumberOfPasswordPrompts=1");
    } else {
      // key 模式：BatchMode=yes 让密码提示直接 fail，避免脚本卡住
      args.push("-o", "BatchMode=yes");
    }
    if (conn.privateKeyPath) args.push("-i", conn.privateKeyPath);
    return args;
  };
  const baseScpArgs = (): string[] => {
    const args: string[] = [
      "-P",
      String(port),
      "-o",
      `ConnectTimeout=${CONNECT_TIMEOUT_SEC}`,
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-q",
      ...cmOptions(),
    ];
    if (usePassword) {
      args.push("-o", "PreferredAuthentications=password,keyboard-interactive");
      args.push("-o", "PubkeyAuthentication=no");
      args.push("-o", "NumberOfPasswordPrompts=1");
    } else {
      args.push("-o", "BatchMode=yes");
    }
    if (conn.privateKeyPath) args.push("-i", conn.privateKeyPath);
    return args;
  };

  // 把 ssh argv + askpass env 包好。密码模式每次 spawn 写一次性脚本,
  // 由 runProcess 在进程结束后调用 cleanup 删掉临时目录。
  const wrap = (sshArgs: string[]): {
    cmd: string;
    args: string[];
    env: NodeJS.ProcessEnv;
    detached: boolean;
    cleanup?: () => void;
  } => {
    if (!usePassword) {
      return { cmd: "ssh", args: sshArgs, env: process.env, detached: false };
    }
    const { scriptPath, cleanup } = makeAskpassScript(conn.password!);
    return {
      cmd: "ssh",
      args: sshArgs,
      env: {
        ...process.env,
        SSH_ASKPASS: scriptPath,
        // OpenSSH ≥ 8.4: force askpass 即使有 tty 也走脚本
        SSH_ASKPASS_REQUIRE: "force",
        // 老版本回退路径需要 DISPLAY 非空
        DISPLAY: process.env["DISPLAY"] || ":0",
      },
      // POSIX setsid → ssh 没有 controlling tty → 必走 askpass
      detached: true,
      cleanup,
    };
  };

  return {
    async exec(cmd, opts = {}): Promise<ExecResult> {
      // `--` 终止 ssh 选项解析,防 user/host 起首 `-` 触发 -oProxyCommand 注入
      const wrapped = wrap([...baseSshArgs(), "--", target, cmd]);
      return await runProcess(wrapped, {
        timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      });
    },

    async uploadFile(remotePath, content, opts = {}): Promise<void> {
      // 走 ssh + stdin heredoc，免去本地临时文件。`cat > path` 在远端 sh 里安全：
      // remotePath 经 shellEscape 后单引号包裹，shell 不会再解析。
      const wrapped = wrap([
        ...baseSshArgs(),
        "--",
        target,
        `cat > ${shellEscape(remotePath)}`,
      ]);
      const buf = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
      const result = await runProcess(wrapped, {
        timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        stdin: buf,
      });
      if (result.err) throw new Error(`uploadFile: ${result.err}`);
      if (result.exitCode !== 0) {
        throw new Error(
          `uploadFile to ${remotePath} failed (exit ${result.exitCode}): ${result.stderr.trim()}`,
        );
      }
    },

    close(): void {
      // 显式让 ControlMaster master 退出 · 避免 ControlPersist=30 期间留 socket
      // ssh -O exit -S <socket> <target> 通知 master 立即退出
      // stdio:'ignore' + .unref() 让本进程不等待这个清理子进程
      try {
        const cleanup = spawn(
          "ssh",
          ["-O", "exit", "-S", controlPath, "-p", String(port), "--", target],
          { stdio: "ignore" },
        );
        cleanup.unref();
      } catch {
        // 清理失败无所谓 · ControlPersist 到期会自己退
      }
    },
  };

  // scp 路径暴露给将来如果想换实现（heredoc 在 binary 大文件可能效率不如 scp）
  void baseScpArgs;
}

interface RunOpts {
  timeoutMs: number;
  stdin?: Buffer;
}

interface SpawnPlan {
  cmd: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  detached: boolean;
  cleanup?: () => void;
}

/**
 * spawn + 收集 stdout/stderr + 超时杀进程 + 错误归一化。
 *
 * 退出码语义（OpenSSH 约定）：
 *   0    成功
 *   255  ssh 自身错误（connection refused / auth / DNS / 超时）
 *   其它 远端命令的退出码
 */
async function runProcess(
  plan: SpawnPlan,
  opts: RunOpts,
): Promise<ExecResult> {
  const { cmd, args, env, detached, cleanup } = plan;
  return await new Promise<ExecResult>((resolve) => {
    let proc: ChildProcess;
    let cleanupCalled = false;
    const doCleanup = () => {
      if (cleanupCalled) return;
      cleanupCalled = true;
      cleanup?.();
    };
    try {
      proc = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"], env, detached });
    } catch (e) {
      doCleanup();
      resolve({
        stdout: "",
        stderr: "",
        exitCode: -1,
        err: `spawn ${cmd} failed: ${e instanceof Error ? e.message : String(e)}`,
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    proc.stdout?.on("data", (c) => (stdout += c.toString("utf-8")));
    proc.stderr?.on("data", (c) => (stderr += c.toString("utf-8")));

    // v0.5.9: 防止 EPIPE 未捕获导致进程崩溃。SSH 连接中断时
    // stdin pipe 写入会触发 EPIPE，让 close 事件统一处理错误。
    proc.stdin?.on("error", () => { /* swallow EPIPE */ });

    if (opts.stdin) proc.stdin?.end(opts.stdin);
    else proc.stdin?.end();

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    }, opts.timeoutMs);

    proc.on("error", (e) => {
      clearTimeout(timer);
      doCleanup();
      resolve({
        stdout,
        stderr,
        exitCode: -1,
        err: `${cmd} not available locally: ${e.message}`,
      });
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      doCleanup();
      if (timedOut) {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1,
          err: `${cmd} timed out after ${opts.timeoutMs}ms`,
        });
        return;
      }
      const exitCode = code ?? -1;
      // ssh 退出码 255 = ssh 通道层错误（auth / 网络 / DNS）—— 升级为 err
      if (cmd === "ssh" && exitCode === 255) {
        // 注意：部分本地 ssh 包装（如自制 expect 版 sshpass，使用 `log_user 1`）
        // 会把 ssh 的 stderr 通过 pty 合并到 stdout 里。先看 stderr，没有就回退
        // 到 stdout —— 否则用户只会看到 "(no stderr)" 这种无信息量的提示。
        const stderrHint = stderr.trim();
        const stdoutHint = stdout.trim();
        const source = stderrHint || stdoutHint;
        const hint = source ? source.split("\n").slice(-3).join(" | ") : "(no output)";
        resolve({
          stdout,
          stderr,
          exitCode,
          err: `SSH connection failed (255): ${hint}`,
        });
        return;
      }
      resolve({ stdout, stderr, exitCode });
    });
  });
}

/** POSIX shell 单引号转义。`'` → `'\''`。 */
export function shellEscape(s: string): string {
  if (/^[\w@%+=:,./-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, "'\\''")}'`;
}
