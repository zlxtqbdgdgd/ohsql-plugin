/**
 * cli-ssh — SSH 远端执行 + DB 实例发现 合并入口
 *
 * 用法:
 *   node ssh.mjs --op exec --host <ip> --user <u> --password <pw> [--port 22]
 *                          --command "echo hello" [--timeout 30000]
 *                          [--output-file /path/to/local.bin]
 *   node ssh.mjs --op discover --os-file /tmp/perf-kp-sql-<any>-os-<TS>.txt
 *                              [--hint-engine mongo|mysql|redis]
 *
 * 合并自:
 *   - cli-ssh-exec.ts → --op exec · 通过 ssh2 在远端跑命令 · agent-agnostic SSH wrapper
 *   - cli-discover.ts → --op discover · 解析 osBatchCmd ###DISCOVERY### 段输出实例列表
 *
 * 业界对照:
 *   exec:  tufantunc/ssh-mcp · mscdex/ssh2 · Ansible raw module
 *   discover: Percona PMM `pmm-admin add --auto-discover` · Datadog Agent service discovery
 */

import { Client } from "ssh2";
import { createWriteStream, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
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
// SECTION: exec (合并自 cli-ssh-exec.ts)
// ============================================================================
//
// 设计目标:
//   · agent-agnostic SSH 实现 · 让 skill 在任意 agent 上只靠本地 ssh CLI / shell tool 就能跑 SSH
//   · 密码认证走 ssh2 编程接口 · 不需要系统 sshpass / expect
//   · esbuild bundle 成单文件 · 零 node_modules 运行时依赖
//
// --output-file 模式:stdout 流式直写本地文件,JSON 里 stdout 仅含 metadata
// "wrote N bytes to /path"。专为火焰图 SVG / perf script 等大体量产物设计 ——
// 绕过 LLM 把大块 string 在两次 tool 调用间搬运的失败模式(content=undefined)。

interface ExecArgs {
  host: string;
  user: string;
  password?: string;
  privateKeyPath?: string;
  port: number;
  command: string;
  timeout: number;
  outputFile?: string;
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

  const portRaw = typeof argv.port === "string" ? argv.port : "22";
  const timeoutRaw = typeof argv.timeout === "string" ? argv.timeout : "120000";
  const password = typeof argv.password === "string" ? argv.password : undefined;
  const privateKeyPath =
    (typeof argv.privateKeyPath === "string" && argv.privateKeyPath) ||
    (typeof argv["private-key-path"] === "string" ? (argv["private-key-path"] as string) : undefined) ||
    undefined;
  const command = typeof argv.command === "string" ? argv.command : "";
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
    timeout: parseInt(timeoutRaw, 10) || 120_000,
    outputFile,
  };
}

const READY_TIMEOUT_MS = 60_000;
const RETRY_BACKOFFS = [0, 3000, 6000];

const TRANSIENT_PATTERNS = [
  /timed out while waiting for handshake/i,
  /all configured authentication methods failed/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /EPIPE/i,
];

function isTransient(msg: string): boolean {
  return TRANSIENT_PATTERNS.some((p) => p.test(msg));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadPrivateKey(path: string): Promise<Buffer> {
  const fs = await import("node:fs/promises");
  return fs.readFile(path);
}

async function connectOnce(args: ExecArgs): Promise<Client> {
  const client = new Client();
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { client.end(); } catch { /* ignore */ }
      reject(new Error("SSH 握手超时"));
    }, READY_TIMEOUT_MS + 2000);

    client.on("ready", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.removeListener("error", onError);
      resolve();
    });

    function onError(e: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { client.end(); } catch { /* ignore */ }
      client.on("error", () => { /* 吸收后续 error */ });
      reject(e);
    }
    client.on("error", onError);

    const cfg: Record<string, unknown> = {
      host: args.host,
      port: args.port,
      username: args.user,
      readyTimeout: READY_TIMEOUT_MS,
      keepaliveInterval: 10_000,
      keepaliveCountMax: 3,
    };

    // 认证:只开一种 · 避免 MaxAuthTries
    if (args.privateKeyPath) {
      loadPrivateKey(args.privateKeyPath).then((key) => {
        cfg.privateKey = key;
        cfg.authHandler = ["publickey"];
        client.connect(cfg as Parameters<Client["connect"]>[0]);
      }).catch((e) => {
        if (!settled) { settled = true; clearTimeout(timer); reject(e); }
      });
    } else if (args.password) {
      cfg.password = args.password;
      // v0.6.1 · 同时支持 "password"(裸 SSH password 方法 · RFC 4252) +
      //          "keyboard-interactive"(PAM 驱动 · 大多数 Linux 发行版默认 · prompt 是
      //          "user@host's password:" 而不是裸 "Password:")· 让 ssh2 在 password
      //          方法被拒后自动 fall through 到 keyboard-interactive · 实际只算 1 次
      //          认证尝试 · 不触发 MaxAuthTries
      cfg.authHandler = ["password", "keyboard-interactive"];
      cfg.tryKeyboard = true;
      // PAM keyboard-interactive challenge handler · 用 password 回每个 prompt
      client.on("keyboard-interactive", (_name, _instructions, _lang, _prompts, finish) => {
        finish([args.password as string]);
      });
      client.connect(cfg as Parameters<Client["connect"]>[0]);
    } else {
      clearTimeout(timer);
      reject(new Error("必须提供 --password 或 --privateKeyPath"));
    }
  });
  return client;
}

async function connectWithRetry(args: ExecArgs): Promise<Client> {
  let lastErr: Error | null = null;
  for (const delay of RETRY_BACKOFFS) {
    if (delay > 0) await sleep(delay);
    try {
      return await connectOnce(args);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!isTransient(msg)) throw e;
      lastErr = e instanceof Error ? e : new Error(msg);
    }
  }
  throw lastErr ?? new Error("SSH 连接失败");
}

function execCommand(
  client: Client,
  command: string,
  timeoutMs: number,
  outputFile?: string,
): Promise<ExecResult> {
  return new Promise<ExecResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let bytesWritten = 0;
    let settled = false;
    const finish = (r: ExecResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };

    // --output-file 模式:流式直写本地文件,绕过 LLM 跨工具搬运 26KB+ 内容
    let writeStream: ReturnType<typeof createWriteStream> | null = null;
    let writeStreamErr: Error | null = null;
    if (outputFile) {
      try {
        mkdirSync(dirname(outputFile), { recursive: true });
      } catch (e) {
        finish({
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

    const timer = setTimeout(() => {
      try {
        if (writeStream) writeStream.destroy();
      } catch {
        /* ignore */
      }
      finish({ stdout, stderr, exitCode: null, err: "命令超时" });
      try { client.end(); } catch { /* ignore */ }
    }, timeoutMs);

    client.exec(command, (e, stream) => {
      if (e) {
        clearTimeout(timer);
        try { if (writeStream) writeStream.destroy(); } catch { /* ignore */ }
        finish({ stdout: "", stderr: "", exitCode: null, err: e.message });
        return;
      }
      // 立即关闭 stdin · 防 sudo 等待密码输入挂起
      try { stream.end(); } catch { /* ignore */ }

      stream
        .on("close", (code: number) => {
          clearTimeout(timer);
          const exitCode = typeof code === "number" ? code : null;
          if (writeStream) {
            writeStream.end(() => {
              if (writeStreamErr) {
                finish({
                  stdout: "",
                  stderr,
                  exitCode,
                  err: `写盘失败 ${outputFile}: ${writeStreamErr.message}`,
                });
                return;
              }
              finish({
                stdout: `<wrote ${bytesWritten} bytes to ${outputFile}>`,
                stderr,
                exitCode,
                bytesWritten,
                outputFile,
              });
            });
          } else {
            finish({ stdout, stderr, exitCode });
          }
        })
        .on("data", (c: Buffer) => {
          if (writeStream) {
            writeStream.write(c);
            bytesWritten += c.length;
          } else {
            stdout += c.toString("utf-8");
          }
        })
        .stderr.on("data", (c: Buffer) => { stderr += c.toString("utf-8"); });
    });
  });
}

async function runExec(argv: Record<string, string | boolean>): Promise<void> {
  const args = parseExecArgs(argv);
  if (!args.command) {
    execDie("必须提供 --command");
  }

  let client: Client;
  try {
    client = await connectWithRetry(args);
  } catch (e) {
    execDie(e instanceof Error ? e.message : String(e));
  }

  try {
    const result = await execCommand(client, args.command, args.timeout, args.outputFile);
    execOutput(result);
  } finally {
    try { client.end(); } catch { /* ignore */ }
  }
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

export function parseInstances(stdout: string, hintEngine: HintEngine = null): Instance[] {
  const lines = stdout.split("\n");
  let inDiscovery = false;
  const out: Instance[] = [];
  // 是否进入过 ###DISCOVERY### 段 · 用于区分"段缺失"与"段在但 PID 全空"两种均触发 G1+ 兜底
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "###DISCOVERY###") {
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
// CLI dispatcher
// ============================================================================

async function main(): Promise<void> {
  const argv = parseArgs(process.argv.slice(2));
  const op = typeof argv.op === "string" ? argv.op : "";
  if (op === "exec") return runExec(argv);
  if (op === "discover") return runDiscover(argv);
  process.stdout.write(JSON.stringify({
    ok: false,
    err: `unknown --op: ${op || "(missing)"} · expect: exec | discover`,
  }) + "\n");
  process.exit(2);
}

const isCli = (() => {
  try {
    const entry = process.argv[1] ?? "";
    return /(^|[\\/])ssh\.(mjs|js|ts)$/.test(entry) || /cli-ssh(\.|$)/.test(entry);
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
