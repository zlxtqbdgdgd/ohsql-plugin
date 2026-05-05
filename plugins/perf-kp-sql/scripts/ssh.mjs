#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath as __fileURLToPath } from "url";
import { dirname as __pathDirname } from "path";
const require = createRequire(import.meta.url);

// plugins/perf-kp-sql/src/cli-ssh.ts
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

// plugins/perf-kp-sql/src/shared/utils.ts
function parseOsIntoMetrics(osStdout) {
  const out = {};
  parseOsBatch(osStdout, out);
  return out;
}
function parseOsBatch(stdout, out) {
  const sections = stdout.split("###");
  const thp = getSection(sections, "THP");
  if (thp) out["thp_status"] = thp;
  const numaNodes = getSection(sections, "NUMA_NODES");
  if (/^\d+$/.test(numaNodes)) out["numa_nodes"] = parseInt(numaNodes, 10);
  const numaBal = getSection(sections, "NUMA_BAL");
  if (numaBal) out["numa_balancing"] = numaBal;
  const huge = getSection(sections, "HUGEPAGES");
  if (/^\d+$/.test(huge)) out["nr_hugepages"] = parseInt(huge, 10);
  const mem = getSection(sections, "MEM");
  if (/^\d+$/.test(mem)) out["total_mem_mb"] = parseInt(mem, 10);
  const sched = getSection(sections, "IOSCHED");
  if (sched) out["io_scheduler"] = sched;
  const swap = getSection(sections, "SWAP");
  if (/^-?\d+$/.test(swap)) out["swappiness"] = parseInt(swap, 10);
  const arch = getSection(sections, "ARCH");
  if (arch) out["arch"] = arch;
  const kernel = getSection(sections, "KERNEL");
  if (kernel) out["kernel_version"] = kernel;
  const nproc = getSection(sections, "NPROC").trim();
  out["cpu_cores"] = parseIntOr(nproc, 0);
  const iostatRaw = getSection(sections, "IOSTAT");
  if (iostatRaw && iostatRaw !== "N/A") {
    let maxAwait = 0;
    for (const line of iostatRaw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("Device") || t.startsWith("Linux")) continue;
      const parts = t.split(/\s+/);
      if (parts.length >= 10) {
        const v = parseFloat(parts[9]);
        if (Number.isFinite(v) && v > maxAwait) maxAwait = v;
      }
    }
    out["disk_await_ms"] = maxAwait;
  }
  const usage = getSection(sections, "DISKUSAGE");
  if (/^\d+$/.test(usage.trim())) {
    out["disk_usage_pct"] = parseInt(usage.trim(), 10);
  }
  const tcpRetrans = getSection(sections, "TCPRETRANS").trim();
  out["tcp_retrans_pct"] = (() => {
    const v = parseFloat(tcpRetrans);
    return Number.isFinite(v) ? v : 0;
  })();
  const cpuGov = getSection(sections, "CPUGOV").trim();
  if (cpuGov) out["cpu_governor"] = cpuGov;
  out["net_somaxconn"] = parseIntOr(getSection(sections, "SOMAXCONN").trim(), 0);
  out["tcp_keepalive_time"] = parseIntOr(
    getSection(sections, "TCPKEEPALIVE").trim(),
    0
  );
  out["tcp_keepalive_intvl"] = parseIntOr(
    getSection(sections, "TCPKEEPALIVEINTVL").trim(),
    0
  );
  out["vm_dirty_ratio"] = parseIntOr(getSection(sections, "DIRTYRATIO").trim(), 0);
  out["vm_dirty_background_ratio"] = parseIntOr(
    getSection(sections, "DIRTYBGRATIO").trim(),
    0
  );
  out["smt_threads_per_core"] = parseIntOr(getSection(sections, "SMT").trim(), 0);
  out["irqbalance_active"] = getSection(sections, "IRQBALANCE").trim() || "unknown";
  out["env_virt_type"] = getSection(sections, "VIRT").trim() || "unknown";
  out["env_sys_vendor"] = getSection(sections, "SYSVENDOR").trim() || "unknown";
  out["env_product_name"] = getSection(sections, "PRODUCT").trim() || "unknown";
  const osRelease = getSection(sections, "OS_RELEASE");
  if (osRelease) {
    out["os_release_raw"] = osRelease;
    const idLine = osRelease.split("\n").find((l) => l.startsWith("ID="));
    if (idLine) out["os_id"] = idLine.replace(/^ID="?|"?$/g, "").trim();
  }
  const cpuModel = getSection(sections, "CPU_MODEL");
  if (cpuModel) {
    out["cpu_model_raw"] = cpuModel;
    const modelLine = cpuModel.split("\n").find((l) => /model name/i.test(l));
    if (modelLine) out["cpu_model"] = modelLine.split(":").slice(1).join(":").trim();
    const vendorLine = cpuModel.split("\n").find((l) => /vendor\s*id|cpu implementer/i.test(l));
    if (vendorLine) out["cpu_vendor"] = vendorLine.split(":").slice(1).join(":").trim();
  }
  const lseCpu = getSection(sections, "LSE_CPU");
  if (lseCpu) {
    out["lse_cpu_raw"] = lseCpu;
    out["lse_cpu_atomics"] = /\batomics\b/.test(lseCpu);
  }
  const lseDmesg = getSection(sections, "LSE_DMESG");
  if (lseDmesg) {
    out["lse_dmesg_has_lse"] = /LSE/i.test(lseDmesg);
  }
  const lseMongodFirst = getSection(sections, "LSE_MONGOD").trim().split("\n")[0]?.trim() ?? "";
  out["lse_mongod_count"] = lseMongodFirst === "na" ? null : parseIntOr(lseMongodFirst, 0);
  out["pagesize_bytes"] = parseIntOr(getSection(sections, "PAGESIZE").trim(), 0);
  const numaDist = getSection(sections, "NUMA_DIST");
  if (numaDist && numaDist !== "unknown") {
    out["numa_dist_raw"] = numaDist;
    const nums = [];
    for (const line of numaDist.split("\n")) {
      for (const tok of line.trim().split(/\s+/)) {
        const n = parseInt(tok, 10);
        if (Number.isFinite(n) && n > 0 && n < 255) nums.push(n);
      }
    }
    out["numa_dist_max"] = nums.length > 0 ? Math.max(...nums) : 0;
    out["numa_dist_min"] = nums.length > 0 ? Math.min(...nums) : 0;
  }
  const schedSteal = getSection(sections, "SCHED_STEAL").trim();
  out["sched_steal_node_limit"] = schedSteal === "none" ? null : schedSteal;
  const schedFeatures = getSection(sections, "SCHED_FEATURES");
  if (schedFeatures) {
    out["sched_features_raw"] = schedFeatures;
    out["sched_feature_steal_on"] = /\bSTEAL\b(?!_)/.test(schedFeatures) && !/NO_STEAL\b/.test(schedFeatures);
  }
  const nohz = getSection(sections, "NOHZ_CMDLINE").trim();
  out["nohz_cmdline"] = nohz === "none" ? null : nohz;
  out["vm_zone_reclaim_mode"] = parseIntOr(getSection(sections, "VM_ZONE_RECLAIM").trim(), -1);
  out["vm_max_map_count"] = parseIntOr(getSection(sections, "VM_MAX_MAP_COUNT").trim(), 0);
  out["vm_overcommit_memory"] = parseIntOr(getSection(sections, "VM_OVERCOMMIT").trim(), -1);
  out["tcp_max_syn_backlog"] = parseIntOr(getSection(sections, "TCP_MAX_SYN_BACKLOG").trim(), 0);
}
function getSection(sections, tag) {
  for (let i = 0; i < sections.length; i++) {
    if (sections[i]?.trim() === tag) {
      return (sections[i + 1] ?? "").trim();
    }
  }
  return "";
}
function parseIntOr(s, fallback) {
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  return fallback;
}

// plugins/perf-kp-sql/src/cli-ssh.ts
function parseArgs(args) {
  const out = {};
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
var CONNECT_TIMEOUT_SEC = 10;
var CONTROL_PERSIST_SEC = 600;
function controlPathFor(host, port, user) {
  const hash = createHash("sha1").update(`${host}:${port}:${user}`).digest("hex").slice(0, 12);
  return join(tmpdir(), `perf-kp-sql-cm-${hash}.sock`);
}
function makeAskpassScript(password) {
  const dir = mkdtempSync(join(tmpdir(), "perf-kp-sql-askpass-"));
  const scriptPath = join(dir, "askpass.sh");
  const escaped = password.replace(/'/g, "'\\''");
  writeFileSync(scriptPath, `#!/bin/sh
printf '%s\\n' '${escaped}'
`, { mode: 448 });
  return {
    scriptPath,
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
      }
    }
  };
}
function buildSshBaseArgs(opts) {
  const args = [
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
    `ControlPersist=${CONTROL_PERSIST_SEC}`
  ];
  if (opts.usePassword) {
    args.push("-o", "PreferredAuthentications=password,keyboard-interactive");
    args.push("-o", "PubkeyAuthentication=no");
    args.push("-o", "NumberOfPasswordPrompts=1");
  } else {
    args.push("-o", "BatchMode=yes");
  }
  if (opts.privateKeyPath) {
    args.push("-i", opts.privateKeyPath);
  }
  return args;
}
function planSshSpawn(args, sshArgs) {
  const usePassword = !!args.password && !args.privateKeyPath;
  if (!usePassword) {
    return { args: sshArgs, env: process.env, detached: false };
  }
  const { scriptPath, cleanup } = makeAskpassScript(args.password);
  return {
    args: sshArgs,
    env: {
      ...process.env,
      SSH_ASKPASS: scriptPath,
      // OpenSSH ≥ 8.4 看到 force 直接走脚本 · 即使有 tty
      SSH_ASKPASS_REQUIRE: "force",
      // 老版本回退路径需要 DISPLAY 非空
      DISPLAY: process.env["DISPLAY"] || ":0"
    },
    // POSIX setsid → 没 controlling tty → 必走 askpass
    detached: true,
    cleanup
  };
}
function execOutput(r) {
  process.stdout.write(JSON.stringify(r) + "\n");
  process.exit(r.err ? 1 : 0);
}
function execDie(msg) {
  execOutput({ stdout: "", stderr: "", exitCode: null, err: msg });
}
function parseExecArgs(argv) {
  const host = typeof argv.host === "string" ? argv.host : "";
  const user = typeof argv.user === "string" ? argv.user : "";
  if (!host || !user) {
    execDie("\u5FC5\u987B\u63D0\u4F9B --host \u548C --user");
  }
  if (host.startsWith("-") || user.startsWith("-")) {
    execDie("--host / --user \u4E0D\u5F97\u4EE5 `-` \u8D77\u9996(\u9632 ssh \u9009\u9879\u6CE8\u5165)");
  }
  const portRaw = typeof argv.port === "string" ? argv.port : "22";
  const timeoutRaw = typeof argv.timeout === "string" ? argv.timeout : "120000";
  const password = typeof argv.password === "string" ? argv.password : void 0;
  const privateKeyPath = typeof argv.privateKeyPath === "string" && argv.privateKeyPath || (typeof argv["private-key-path"] === "string" ? argv["private-key-path"] : void 0) || void 0;
  const command = typeof argv.command === "string" ? argv.command : "";
  const commandFile = typeof argv.commandFile === "string" && argv.commandFile || (typeof argv["command-file"] === "string" ? argv["command-file"] : void 0) || void 0;
  const outputFile = typeof argv.outputFile === "string" && argv.outputFile || (typeof argv["output-file"] === "string" ? argv["output-file"] : void 0) || void 0;
  return {
    host,
    user,
    password,
    privateKeyPath,
    port: parseInt(portRaw, 10) || 22,
    command,
    commandFile,
    timeout: parseInt(timeoutRaw, 10) || 12e4,
    outputFile
  };
}
function runSshExec(plan, timeoutMs, outputFile) {
  return new Promise((resolve) => {
    let proc;
    let cleanupCalled = false;
    const doCleanup = () => {
      if (cleanupCalled) return;
      cleanupCalled = true;
      plan.cleanup?.();
    };
    let writeStream = null;
    let writeStreamErr = null;
    if (outputFile) {
      try {
        mkdirSync(dirname(outputFile), { recursive: true });
      } catch (e) {
        doCleanup();
        resolve({
          stdout: "",
          stderr: "",
          exitCode: null,
          err: `\u521B\u5EFA\u76EE\u5F55\u5931\u8D25 ${dirname(outputFile)}: ${e instanceof Error ? e.message : String(e)}`
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
        detached: plan.detached
      });
    } catch (e) {
      doCleanup();
      try {
        writeStream?.destroy();
      } catch {
      }
      resolve({
        stdout: "",
        stderr: "",
        exitCode: null,
        err: `spawn ssh failed: ${e instanceof Error ? e.message : String(e)}`
      });
      return;
    }
    let stdout = "";
    let stderr = "";
    let bytesWritten = 0;
    let timedOut = false;
    if (writeStream) {
      proc.stdout?.on("data", (c) => {
        writeStream.write(c);
        bytesWritten += c.length;
      });
    } else {
      proc.stdout?.on("data", (c) => {
        stdout += c.toString("utf-8");
      });
    }
    proc.stderr?.on("data", (c) => {
      stderr += c.toString("utf-8");
    });
    proc.stdin?.on("error", () => {
    });
    try {
      proc.stdin?.end();
    } catch {
    }
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill("SIGTERM");
      } catch {
      }
    }, timeoutMs);
    proc.on("error", (e) => {
      clearTimeout(timer);
      doCleanup();
      try {
        writeStream?.destroy();
      } catch {
      }
      resolve({
        stdout,
        stderr,
        exitCode: null,
        err: `ssh not available locally: ${e.message}`
      });
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      doCleanup();
      const finishWithStream = (final) => {
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
          err: `\u547D\u4EE4\u8D85\u65F6 (${timeoutMs}ms)`
        });
        return;
      }
      const exitCode = code;
      if (exitCode === 255) {
        const stderrHint = stderr.trim();
        const stdoutHint = (writeStream ? "" : stdout).trim();
        const source = stderrHint || stdoutHint;
        const hint = source ? source.split("\n").slice(-3).join(" | ") : "(no output)";
        finishWithStream({
          stdout: writeStream ? "" : stdout,
          stderr,
          exitCode,
          err: `SSH connection failed (255): ${hint}`
        });
        return;
      }
      if (writeStream) {
        if (writeStreamErr) {
          finishWithStream({
            stdout: "",
            stderr,
            exitCode,
            err: `\u5199\u76D8\u5931\u8D25 ${outputFile}: ${writeStreamErr.message}`
          });
          return;
        }
        finishWithStream({
          stdout: `<wrote ${bytesWritten} bytes to ${outputFile}>`,
          stderr,
          exitCode,
          bytesWritten,
          outputFile
        });
        return;
      }
      finishWithStream({ stdout, stderr, exitCode });
    });
  });
}
async function readCommandFileWithDiag(commandFile) {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await readFile(commandFile, "utf8");
    } catch (e) {
      lastErr = e;
      const code = e?.code;
      if (code !== "ENOENT") break;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 100));
    }
  }
  const errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  const path = await import("node:path");
  const fs = await import("node:fs");
  const diag = {
    commandFile_argv_raw: commandFile,
    commandFile_byteLength: Buffer.byteLength(commandFile, "utf8"),
    commandFile_codepoints: Array.from(commandFile).map((c) => c.codePointAt(0)),
    isAbsolute: path.isAbsolute(commandFile),
    cwd: process.cwd(),
    HOME: process.env.HOME ?? ""
    // full_argv 已删除 · process.argv 含 --password 明文,泄漏到 LLM 上下文 / trace
  };
  try {
    const dir = path.dirname(commandFile);
    const targetBase = path.basename(commandFile);
    diag.dirname = dir;
    diag.basename = targetBase;
    const entries = fs.readdirSync(dir);
    diag.dirEntries = entries;
    diag.exactMatch = entries.includes(targetBase);
    diag.candidateNeighbours = entries.filter((n) => n.includes(targetBase.slice(0, 25)) || targetBase.includes(n.slice(0, 25))).map((n) => ({
      name: n,
      nameByteLen: Buffer.byteLength(n, "utf8"),
      sameAsTarget: n === targetBase,
      codepoints: Array.from(n).map((c) => c.codePointAt(0))
    }));
  } catch (dirErr) {
    diag.dirReadError = dirErr instanceof Error ? dirErr.message : String(dirErr);
  }
  execDie(
    `\u8BFB\u53D6 --command-file \u5931\u8D25: ${errMsg} \xB7 diag=${JSON.stringify(diag)}`
  );
}
async function runExec(argv) {
  const args = parseExecArgs(argv);
  if (args.command && args.commandFile) {
    execDie("--command \u4E0E --command-file \u4E0D\u80FD\u540C\u65F6\u63D0\u4F9B");
  }
  if (args.commandFile) {
    args.command = await readCommandFileWithDiag(args.commandFile);
  }
  if (!args.command) {
    execDie("\u5FC5\u987B\u63D0\u4F9B --command \u6216 --command-file");
  }
  if (!args.password && !args.privateKeyPath) {
    execDie("\u5FC5\u987B\u63D0\u4F9B --password \u6216 --privateKeyPath");
  }
  const usePassword = !!args.password && !args.privateKeyPath;
  const controlPath = controlPathFor(args.host, args.port, args.user);
  const baseArgs = buildSshBaseArgs({
    port: args.port,
    controlPath,
    usePassword,
    privateKeyPath: args.privateKeyPath
  });
  const sshArgs = [...baseArgs, "--", `${args.user}@${args.host}`, args.command];
  const plan = planSshSpawn(args, sshArgs);
  const result = await runSshExec(plan, args.timeout, args.outputFile);
  if (result.exitCode === 255 && existsSync(controlPath)) {
    try {
      rmSync(controlPath, { force: true });
    } catch {
    }
    const retryPlan = planSshSpawn(args, sshArgs);
    const retryResult = await runSshExec(retryPlan, args.timeout, args.outputFile);
    execOutput(retryResult);
    return;
  }
  execOutput(result);
}
function parseSessionCloseArgs(argv) {
  const host = typeof argv.host === "string" ? argv.host : "";
  const user = typeof argv.user === "string" ? argv.user : "";
  if (!host || !user) {
    execDie("\u5FC5\u987B\u63D0\u4F9B --host \u548C --user");
  }
  if (host.startsWith("-") || user.startsWith("-")) {
    execDie("--host / --user \u4E0D\u5F97\u4EE5 `-` \u8D77\u9996(\u9632 ssh \u9009\u9879\u6CE8\u5165)");
  }
  const portRaw = typeof argv.port === "string" ? argv.port : "22";
  return { host, user, port: parseInt(portRaw, 10) || 22 };
}
async function runSessionClose(argv) {
  const args = parseSessionCloseArgs(argv);
  const controlPath = controlPathFor(args.host, args.port, args.user);
  await new Promise((resolve) => {
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      process.stdout.write(JSON.stringify({ ...r, controlPath }) + "\n");
      resolve();
    };
    let proc;
    try {
      proc = spawn(
        "ssh",
        ["-O", "exit", "-S", controlPath, "-p", String(args.port), "--", `${args.user}@${args.host}`],
        { stdio: ["ignore", "pipe", "pipe"] }
      );
    } catch (e) {
      finish({ ok: true, err: `spawn ssh failed (master \u53EF\u80FD\u672C\u5C31\u6CA1\u8D77): ${e instanceof Error ? e.message : String(e)}` });
      return;
    }
    let stderr = "";
    proc.stderr?.on("data", (c) => {
      stderr += c.toString("utf-8");
    });
    const timer = setTimeout(() => {
      try {
        proc.kill("SIGTERM");
      } catch {
      }
      finish({ ok: true, err: "session-close \u8D85\u65F6(\u53EF\u80FD master \u5DF2\u9000\u51FA)" });
    }, 5e3);
    proc.on("error", () => {
      clearTimeout(timer);
      finish({ ok: true, err: "ssh \u4E0D\u53EF\u7528(\u53EF\u80FD master \u5DF2\u9000\u51FA)" });
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 || /No such file or directory|Control socket connect|not connected/i.test(stderr)) {
        finish({ ok: true });
      } else {
        finish({ ok: true, err: `ssh -O exit exit=${code}: ${stderr.trim() || "(no stderr)"}` });
      }
    });
  });
}
var DEFAULT_PORTS = {
  mongo: "27017",
  mysql: "3306",
  redis: "6379"
};
var ENGINE_BY_PROCESS = {
  mongod: "mongo",
  mysqld: "mysql",
  "redis-server": "redis"
};
function normalizeHintEngine(raw) {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s || s === "skipped" || s === "auto") return null;
  if (s === "mongodb") return "mongo";
  if (s === "mongo" || s === "mysql" || s === "redis") return s;
  return null;
}
function buildFallbackInstance(engine) {
  const port = DEFAULT_PORTS[engine] ?? "";
  const bind = "127.0.0.1";
  return {
    engine,
    pid: "",
    port,
    bind,
    label: `${engine} \xB7 ${bind}:${port} \xB7 \u9ED8\u8BA4\u63A8\u65AD \xB7 \u672A\u53D1\u73B0\u8FDB\u7A0B`,
    confidence: "very_low",
    source: "no-pid-default-engine",
    port_source: "no-pid-default"
  };
}
function parseInstances(stdout, hintEngine = null, sectionMarker = "DISCOVERY") {
  const openMarker = `###${sectionMarker}###`;
  const lines = stdout.split("\n");
  let inDiscovery = false;
  const out = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line === openMarker) {
      inDiscovery = true;
      continue;
    }
    if (!inDiscovery) continue;
    if (line.startsWith("###")) break;
    if (!line.includes("engine=")) continue;
    const stripped = line.replace(/^['"]+|['"]+$/g, "");
    const m = {};
    for (const tok of stripped.split(/\s+/)) {
      const eq = tok.indexOf("=");
      if (eq > 0) m[tok.slice(0, eq)] = tok.slice(eq + 1);
    }
    const proc = m.engine;
    const engineCanonical = proc ? ENGINE_BY_PROCESS[proc] : void 0;
    if (!engineCanonical) continue;
    const pid = (m.PID ?? "").trim();
    if (!pid) continue;
    const rawPort = (m.PORT ?? "").trim();
    const rawBind = (m.BIND ?? "").trim();
    const portMissing = !rawPort;
    const bindMissing = !rawBind;
    const port = rawPort || DEFAULT_PORTS[engineCanonical] || "";
    const bind = rawBind || "127.0.0.1";
    const usedFallback = portMissing || bindMissing;
    const confidence = usedFallback ? "low" : "high";
    const source = usedFallback ? "default-port-guess" : "ss";
    const portSource = !portMissing ? "ss" : "default";
    out.push({
      engine: engineCanonical,
      pid,
      port,
      bind,
      label: `${engineCanonical} \xB7 ${bind}:${port} \xB7 pid=${pid}`,
      confidence,
      source,
      port_source: portSource
    });
  }
  if (out.length === 0) {
    if (hintEngine) {
      out.push(buildFallbackInstance(hintEngine));
    } else {
      for (const eng of ["mongo", "mysql", "redis"]) {
        out.push(buildFallbackInstance(eng));
      }
    }
  }
  return out;
}
function discoverWriteError(msg) {
  process.stdout.write(JSON.stringify({ ok: false, error: msg }));
  process.exit(1);
}
async function runDiscover(argv) {
  const osFile = typeof argv["os-file"] === "string" ? argv["os-file"] : void 0;
  if (!osFile) discoverWriteError("missing --os-file");
  let raw;
  try {
    raw = await readFile(osFile, "utf8");
  } catch (e) {
    const baseErr = e instanceof Error ? e.message : String(e);
    const isMissing = /ENOENT|no such file|does not exist/i.test(baseErr);
    const hint = isMissing ? " \xB7 \u6700\u53EF\u80FD\u539F\u56E0:LLM \u5728 SSH \u547D\u4EE4(remote osBatchCmd)\u4E4B\u540E\u8DF3\u8FC7\u4E86 Write \u843D\u76D8\u6B65\u9AA4 \xB7 \u8BF7\u56DE\u67E5\u4E0A\u4E00\u8F6E SSH \u547D\u4EE4\u8FD4\u56DE\u7684 stdout \u662F\u5426\u8C03\u7528\u4E86 Write(file_path=" + osFile + ", content=<osStdout>) \xB7 \u89C1 SKILL.md Step 2.3 \xB7 \u4E0D\u662F Write \u5DE5\u5177\u4E0D\u53EF\u7528" : "";
    discoverWriteError(`failed to read ${osFile}: ${baseErr}${hint}`);
  }
  const osMetrics = parseOsIntoMetrics(raw);
  const hintRaw = argv["hint-engine"];
  const hintEngine = normalizeHintEngine(typeof hintRaw === "string" ? hintRaw : "");
  const instances = parseInstances(raw, hintEngine);
  const osReleaseRaw = String(osMetrics.os_release_raw ?? "");
  const versionLine = osReleaseRaw.split("\n").find((l) => l.startsWith("VERSION_ID="));
  const os_version = versionLine ? versionLine.replace(/^VERSION_ID="?|"?$/g, "").trim() : null;
  const notes = [];
  if (instances.some((i) => i.source === "default-port-guess")) {
    notes.push("pid-found-port-missing-using-default");
  }
  if (instances.some((i) => i.source === "no-pid-default-engine")) {
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
      product: osMetrics.env_product_name ?? null
    })
  );
}
function parseSectionContent(stdout, sectionMarker) {
  const openMarker = `###${sectionMarker}###`;
  const lines = stdout.split("\n");
  let inSection = false;
  const collected = [];
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
async function runProbeParse(argv) {
  const probeFile = typeof argv["probe-file"] === "string" ? argv["probe-file"] : void 0;
  if (!probeFile) {
    process.stdout.write(JSON.stringify({ ok: false, error: "missing --probe-file" }));
    process.exit(1);
  }
  let raw;
  try {
    raw = await readFile(probeFile, "utf8");
  } catch (e) {
    const baseErr = e instanceof Error ? e.message : String(e);
    const isMissing = /ENOENT|no such file|does not exist/i.test(baseErr);
    const hint = isMissing ? " \xB7 LLM \u53EF\u80FD\u8DF3\u8FC7\u4E86 Write \u843D\u76D8\u6B65\u9AA4 \xB7 \u8BF7\u56DE\u67E5 ssh probe \u8FD4\u56DE\u7684 stdout \u662F\u5426\u8C03\u7528\u4E86 Write(file_path=" + probeFile + ", content=<probeStdout>) \xB7 \u89C1 SKILL.md Step 1.3" : "";
    process.stdout.write(JSON.stringify({ ok: false, error: `failed to read ${probeFile}: ${baseErr}${hint}` }));
    process.exit(1);
  }
  const hintRaw = argv["hint-engine"];
  const hintEngine = normalizeHintEngine(typeof hintRaw === "string" ? hintRaw : "");
  const allInstances = parseInstances(raw, null, "ENGINES");
  const realInstances = allInstances.filter((i) => i.source !== "no-pid-default-engine");
  const perfRaw = parseSectionContent(raw, "PERF");
  const offcpuRaw = parseSectionContent(raw, "OFFCPU");
  const perfAvailable = !!perfRaw && perfRaw !== "MISSING" && !/MISSING/.test(perfRaw);
  const offcpuAvailable = !!offcpuRaw && offcpuRaw !== "MISSING" && !/MISSING/.test(offcpuRaw);
  let flame_capable = "none";
  if (perfAvailable && offcpuAvailable) flame_capable = "oncpu+offcpu";
  else if (perfAvailable) flame_capable = "oncpu";
  process.stdout.write(
    JSON.stringify({
      ok: true,
      instances: realInstances,
      hint_engine: hintEngine,
      flame_capable,
      perf_path: perfAvailable ? perfRaw : null,
      offcpu_path: offcpuAvailable ? offcpuRaw : null
    })
  );
}
async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const op = typeof argv.op === "string" ? argv.op : "";
  if (op === "exec") return runExec(argv);
  if (op === "session-close") return runSessionClose(argv);
  if (op === "discover") return runDiscover(argv);
  if (op === "probe-parse") return runProbeParse(argv);
  process.stdout.write(JSON.stringify({
    ok: false,
    err: `unknown --op: ${op || "(missing)"} \xB7 expect: exec | session-close | discover | probe-parse`
  }) + "\n");
  process.exit(2);
}
var isCli = (() => {
  try {
    const entry = process.argv[1] ?? "";
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
export {
  buildSshBaseArgs,
  controlPathFor,
  normalizeHintEngine,
  parseInstances
};
