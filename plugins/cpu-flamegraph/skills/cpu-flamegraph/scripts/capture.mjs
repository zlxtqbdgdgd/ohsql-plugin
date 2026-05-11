#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath as __fileURLToPath } from "url";
import { dirname as __pathDirname } from "path";
const require = createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __pathDirname(__filename);

// skills/cpu-flamegraph/src/cli-capture.ts
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { dirname as dirname2, resolve } from "node:path";

// skills/cpu-flamegraph/src/captureFlamegraph.ts
import { fileURLToPath } from "node:url";
import { dirname, join as join3 } from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

// skills/cpu-flamegraph/src/captureRunner.ts
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
var DEFAULT_TIMEOUT_MS = 3e4;
var DEFAULT_PORT = 22;
var CONNECT_TIMEOUT_SEC = 10;
function makeAskpassScript(password) {
  const dir = mkdtempSync(join(tmpdir(), `cpu-fg-askpass-${randomBytes(4).toString("hex")}-`));
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
function openRemoteSession(conn) {
  const target = `${conn.user}@${conn.host}`;
  const port = conn.port ?? DEFAULT_PORT;
  const usePassword = !!conn.password && !conn.privateKeyPath;
  // ControlMaster · 一次 TCP+auth 多 channel 复用 · 服务端只看到 1 个连接
  const controlPath = `/tmp/cpu-flame-cm-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.sock`;
  const cmOptions = () => [
    "-o",
    "ControlMaster=auto",
    "-o",
    `ControlPath=${controlPath}`,
    "-o",
    "ControlPersist=30"
  ];
  const baseSshArgs = () => {
    const args = [
      "-p",
      String(port),
      "-o",
      `ConnectTimeout=${CONNECT_TIMEOUT_SEC}`,
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      "ServerAliveInterval=15",
      ...cmOptions()
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
  const baseScpArgs = () => {
    const args = [
      "-P",
      String(port),
      "-o",
      `ConnectTimeout=${CONNECT_TIMEOUT_SEC}`,
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-q",
      ...cmOptions()
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
  const wrap = (sshArgs) => {
    if (!usePassword) {
      return { cmd: "ssh", args: sshArgs, env: process.env, detached: false };
    }
    const { scriptPath, cleanup } = makeAskpassScript(conn.password);
    return {
      cmd: "ssh",
      args: sshArgs,
      env: {
        ...process.env,
        SSH_ASKPASS: scriptPath,
        // OpenSSH ≥ 8.4: force askpass 即使有 tty 也走脚本
        SSH_ASKPASS_REQUIRE: "force",
        // 老版本回退路径需要 DISPLAY 非空
        DISPLAY: process.env["DISPLAY"] || ":0"
      },
      // POSIX setsid → ssh 没有 controlling tty → 必走 askpass
      detached: true,
      cleanup
    };
  };
  return {
    async exec(cmd, opts = {}) {
      const wrapped = wrap([...baseSshArgs(), target, cmd]);
      return await runProcess(wrapped, {
        timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
      });
    },
    async uploadFile(remotePath, content, opts = {}) {
      const wrapped = wrap([
        ...baseSshArgs(),
        target,
        `cat > ${shellEscape(remotePath)}`
      ]);
      const buf = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
      const result = await runProcess(wrapped, {
        timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        stdin: buf
      });
      if (result.err) throw new Error(`uploadFile: ${result.err}`);
      if (result.exitCode !== 0) {
        throw new Error(
          `uploadFile to ${remotePath} failed (exit ${result.exitCode}): ${result.stderr.trim()}`
        );
      }
    },
    close() {
      try {
        const cleanup = spawn(
          "ssh",
          ["-O", "exit", "-S", controlPath, "-p", String(port), target],
          { stdio: "ignore" }
        );
        cleanup.unref();
      } catch {
      }
    }
  };
  void baseScpArgs;
}
async function runProcess(plan, opts) {
  const { cmd, args, env, detached, cleanup } = plan;
  return await new Promise((resolve2) => {
    let proc;
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
      resolve2({
        stdout: "",
        stderr: "",
        exitCode: -1,
        err: `spawn ${cmd} failed: ${e instanceof Error ? e.message : String(e)}`
      });
      return;
    }
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    proc.stdout?.on("data", (c) => stdout += c.toString("utf-8"));
    proc.stderr?.on("data", (c) => stderr += c.toString("utf-8"));
    proc.stdin?.on("error", () => {
    });
    if (opts.stdin) proc.stdin?.end(opts.stdin);
    else proc.stdin?.end();
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill("SIGTERM");
      } catch {
      }
    }, opts.timeoutMs);
    proc.on("error", (e) => {
      clearTimeout(timer);
      doCleanup();
      resolve2({
        stdout,
        stderr,
        exitCode: -1,
        err: `${cmd} not available locally: ${e.message}`
      });
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      doCleanup();
      if (timedOut) {
        resolve2({
          stdout,
          stderr,
          exitCode: code ?? -1,
          err: `${cmd} timed out after ${opts.timeoutMs}ms`
        });
        return;
      }
      const exitCode = code ?? -1;
      if (cmd === "ssh" && exitCode === 255) {
        const stderrHint = stderr.trim();
        const stdoutHint = stdout.trim();
        const source = stderrHint || stdoutHint;
        const hint = source ? source.split("\n").slice(-3).join(" | ") : "(no output)";
        resolve2({
          stdout,
          stderr,
          exitCode,
          err: `SSH connection failed (255): ${hint}`
        });
        return;
      }
      resolve2({ stdout, stderr, exitCode });
    });
  });
}
function shellEscape(s) {
  if (/^[\w@%+=:,./-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, "'\\''")}'`;
}

// skills/cpu-flamegraph/src/parsePerfScript.ts
var HEADER_RE = /^(\S.+?)\s+(\d+)(?:\/(\d+))?\s+(?:\[\d+\]\s+)?(\d+\.\d+):\s+(?:(\d+)\s+)?(\S+):\s*$/;
var FRAME_RE = /^\s*([0-9a-f]+)\s+(.+)\s+\((\S*)\)\s*$/;
function stripOffset(sym) {
  return sym.replace(/\+0x[\da-f]+$/i, "").trim();
}
function parseOne(block) {
  if (block.length === 0) return null;
  const lines = block.filter((l) => !l.startsWith("#"));
  if (lines.length === 0) return null;
  const header = lines[0];
  const m = HEADER_RE.exec(header);
  if (!m) return null;
  const comm = m[1];
  const pid = parseInt(m[2], 10);
  const tid = m[3] !== void 0 ? parseInt(m[3], 10) : pid;
  const time = parseFloat(m[4]);
  const period = m[5] !== void 0 ? parseInt(m[5], 10) : 1;
  const eventName = m[6];
  const frames = [];
  for (let i = 1; i < lines.length; i++) {
    const fm = FRAME_RE.exec(lines[i]);
    if (!fm) continue;
    const symRaw = fm[2];
    const dso = fm[3] || "[unknown]";
    const fn = stripOffset(symRaw);
    if (!fn) continue;
    frames.push({ fn, dso });
  }
  frames.reverse();
  return { comm, pid, tid, time, eventName, period, stack: frames };
}
function parsePerfScript(text) {
  const out = [];
  let buf = [];
  for (const line of text.split(/\r?\n/)) {
    if (line === "") {
      if (buf.length > 0) {
        const s = parseOne(buf);
        if (s) out.push(s);
        buf = [];
      }
    } else {
      buf.push(line);
    }
  }
  if (buf.length > 0) {
    const s = parseOne(buf);
    if (s) out.push(s);
  }
  return out;
}
function moduleFromDso(dso) {
  if (!dso || dso === "[unknown]") return "[unknown]";
  if (dso.startsWith("[") && dso.endsWith("]")) return dso;
  if (dso.includes("vmlinux")) return "[kernel.kallsyms]";
  const base = dso.split("/").pop() ?? dso;
  return base;
}
var IDLE_FUNCTIONS = /* @__PURE__ */ new Set([
  "arch_cpu_idle",
  "arch_cpu_idle_enter",
  "arch_cpu_idle_exit",
  "cpuidle_enter",
  "cpuidle_enter_state",
  "cpuidle_idle_call",
  "cpu_startup_entry",
  "default_idle",
  "default_idle_call",
  "do_idle",
  "intel_idle",
  "mwait_idle",
  "acpi_idle_do_entry",
  "poll_idle",
  "native_safe_halt",
  "secondary_start_kernel",
  "start_kernel",
  "swapper"
]);

// skills/cpu-flamegraph/src/kb-lookup.ts
import { readFileSync } from "node:fs";
import { join as join2 } from "node:path";
function loadKbSeeds(engine, dataDir) {
  const path = join2(dataDir, `${engine}-flame.json`);
  let raw;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw new Error(`kb-lookup: failed to read ${path}: ${e.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`kb-lookup: invalid JSON in ${path}: ${e.message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`kb-lookup: expected array in ${path}, got ${typeof parsed}`);
  }
  return parsed.map((f, i) => validateAndCompile(f, path, i));
}
function validateAndCompile(raw, path, idx) {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`kb-lookup: ${path}[${idx}] not an object`);
  }
  const f = raw;
  const need = ["id", "scope", "regex", "semantic_group", "snippet", "source_url", "source_authority"];
  for (const k of need) {
    if (typeof f[k] !== "string") {
      throw new Error(`kb-lookup: ${path}[${idx}].${k} missing or not string`);
    }
  }
  const scope = f["scope"];
  if (scope !== "function" && scope !== "module") {
    throw new Error(`kb-lookup: ${path}[${idx}].scope must be "function" or "module" (got: ${String(scope)})`);
  }
  const auth = f["source_authority"];
  if (auth !== "official" && auth !== "community") {
    throw new Error(`kb-lookup: ${path}[${idx}].source_authority must be "official" or "community" (got: ${String(auth)})`);
  }
  let compiled;
  try {
    compiled = new RegExp(f["regex"]);
  } catch (e) {
    throw new Error(`kb-lookup: ${path}[${idx}].regex invalid: ${e.message}`);
  }
  return {
    id: f["id"],
    scope,
    regex: f["regex"],
    semantic_group: f["semantic_group"],
    snippet: f["snippet"],
    source_url: f["source_url"],
    source_authority: auth,
    compiled
  };
}
function lookupHotFunction(fn, module, facts) {
  for (const f of facts) {
    if (f.scope === "function" && f.compiled.test(fn)) {
      return [
        {
          semantic_group: f.semantic_group,
          snippet: f.snippet,
          source_url: f.source_url,
          source_authority: f.source_authority,
          match_type: "function"
        }
      ];
    }
  }
  for (const f of facts) {
    if (f.scope === "module" && f.compiled.test(module)) {
      return [
        {
          semantic_group: f.semantic_group,
          snippet: f.snippet,
          source_url: f.source_url,
          source_authority: f.source_authority,
          match_type: "module"
        }
      ];
    }
  }
  return [];
}

// skills/cpu-flamegraph/src/analyze.ts
var DEFAULT_TOP_N = 10;
function analyze(args) {
  const { samples: rawSamples, baselineSamples, meta = {}, topN = DEFAULT_TOP_N, includeIdle = false, engine, kbDataDir } = args;
  const samples = includeIdle ? rawSamples : filterIdleSamples(rawSamples);
  const filteredOut = rawSamples.length - samples.length;
  const totalSamples = samples.reduce((s, x) => s + x.period, 0);
  const { hotFuncs, hotPaths } = aggregate(samples, totalSamples, topN);
  if (engine && kbDataDir) {
    try {
      const facts = loadKbSeeds(engine, kbDataDir);
      if (facts.length > 0) {
        for (const hf of hotFuncs) {
          if (hf.percent < 3) continue;
          hf.rag_hits = lookupHotFunction(hf.name, hf.module, facts);
        }
      }
    } catch {
    }
  }
  let diffHighlights = null;
  if (baselineSamples && baselineSamples.length > 0) {
    const baseRaw = includeIdle ? baselineSamples : filterIdleSamples(baselineSamples);
    const baseTotal = baseRaw.reduce((s, x) => s + x.period, 0);
    const { hotFuncs: baseHot } = aggregate(baseRaw, baseTotal, topN * 5);
    const baseMap = new Map(baseHot.map((h) => [h.name, h.percent]));
    for (const hf of hotFuncs) {
      const oldPct = baseMap.get(hf.name);
      hf.delta_percent = oldPct === void 0 ? hf.percent : hf.percent - oldPct;
    }
    diffHighlights = hotFuncs.filter(
      (h) => h.delta_percent !== null && Math.abs(h.delta_percent) >= 1
    );
  }
  const callTree = samples.length > 0 ? buildCallTree(samples, totalSamples, 0.5, 15) : null;
  return {
    meta: {
      ...meta,
      total_samples: totalSamples,
      idle_filtered_samples: filteredOut,
      idle_filter_applied: !includeIdle
    },
    hot_functions: hotFuncs,
    hot_paths: hotPaths,
    call_tree: callTree,
    diff_highlights: diffHighlights,
    flamegraph_svg_path: null,
    raw_folded_path: ""
  };
}
function filterIdleSamples(samples) {
  return samples.filter((s) => {
    for (let i = s.stack.length - 1; i >= 0; i--) {
      const fn = s.stack[i].fn;
      if (!fn || fn === "[unknown]") continue;
      return !IDLE_FUNCTIONS.has(fn);
    }
    return false;
  });
}
function buildCallTree(samples, total, minPct, maxDepth) {
  if (total === 0) return null;
  const root = { name: "<root>", module: "", count: 0, selfCount: 0, children: /* @__PURE__ */ new Map() };
  for (const s of samples) {
    let cur = root;
    cur.count += s.period;
    const lim = Math.min(s.stack.length, maxDepth);
    let last = null;
    for (let i = 0; i < lim; i++) {
      const frame = s.stack[i];
      if (!frame.fn) continue;
      let child = cur.children.get(frame.fn);
      if (!child) {
        child = {
          name: frame.fn,
          module: moduleFromDso(frame.dso),
          count: 0,
          selfCount: 0,
          children: /* @__PURE__ */ new Map()
        };
        cur.children.set(frame.fn, child);
      }
      child.count += s.period;
      cur = child;
      last = child;
    }
    if (last) last.selfCount += s.period;
  }
  const minCount = minPct * total / 100;
  const convert = (n) => {
    const kids = Array.from(n.children.values()).filter((c) => c.count >= minCount).sort((a, b) => b.count - a.count).map(convert);
    return {
      name: n.name,
      module: n.module,
      count: n.count,
      selfCount: n.selfCount,
      percent: n.count * 100 / total,
      selfPercent: n.selfCount * 100 / total,
      children: kids
    };
  };
  const tree = convert(root);
  if (tree.children.length === 0) return null;
  return tree;
}
function aggregate(samples, totalSamples, topN) {
  if (totalSamples === 0) {
    return { hotFuncs: [], hotPaths: [] };
  }
  const selfCount = /* @__PURE__ */ new Map();
  const selfModule = /* @__PURE__ */ new Map();
  const inclusiveCount = /* @__PURE__ */ new Map();
  const inclusiveModule = /* @__PURE__ */ new Map();
  const stackTrace = /* @__PURE__ */ new Map();
  for (const s of samples) {
    let leafIdx = s.stack.length - 1;
    while (leafIdx >= 0 && (!s.stack[leafIdx].fn || s.stack[leafIdx].fn === "[unknown]")) {
      leafIdx--;
    }
    if (leafIdx < 0) continue;
    const leafFrame = s.stack[leafIdx];
    selfCount.set(leafFrame.fn, (selfCount.get(leafFrame.fn) ?? 0) + s.period);
    if (!selfModule.has(leafFrame.fn)) {
      selfModule.set(leafFrame.fn, moduleFromDso(leafFrame.dso));
    }
    const stackFns = s.stack.map((f) => f.fn);
    const seen = /* @__PURE__ */ new Set();
    for (const frame of s.stack) {
      if (!frame.fn || frame.fn === "[unknown]") continue;
      if (seen.has(frame.fn)) continue;
      seen.add(frame.fn);
      inclusiveCount.set(frame.fn, (inclusiveCount.get(frame.fn) ?? 0) + s.period);
      if (!inclusiveModule.has(frame.fn)) {
        inclusiveModule.set(frame.fn, moduleFromDso(frame.dso));
      }
      const tr = stackTrace.get(frame.fn) ?? [];
      if (tr.length < 3) {
        tr.push(stackFns);
        stackTrace.set(frame.fn, tr);
      }
    }
  }
  const hotFuncs = Array.from(selfCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([name, count]) => ({
    name,
    module: selfModule.get(name) ?? "unknown",
    samples: count,
    percent: count * 100 / totalSamples,
    delta_percent: null,
    rag_hits: [],
    top_stacks: stackTrace.get(name) ?? []
  }));
  const hotPaths = Array.from(inclusiveCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([name, count]) => ({
    name,
    module: inclusiveModule.get(name) ?? "unknown",
    samples: count,
    percent: count * 100 / totalSamples,
    delta_percent: null,
    rag_hits: [],
    top_stacks: stackTrace.get(name) ?? []
  }));
  return { hotFuncs, hotPaths };
}
function samplesToFolded(samples) {
  const acc = /* @__PURE__ */ new Map();
  for (const s of samples) {
    if (s.stack.length === 0) continue;
    const key = s.stack.map((f) => f.fn || "[unknown]").join(";");
    acc.set(key, (acc.get(key) ?? 0) + s.period);
  }
  return Array.from(acc.entries()).map(([stack, count]) => `${stack} ${count}`).join("\n");
}

// skills/cpu-flamegraph/src/captureFlamegraph.ts
var DEFAULT_DURATION = 3;
var DEFAULT_FREQ = 99;
async function captureFlamegraph(opts) {
  const procName = opts.process ?? "mongod";
  const duration = opts.duration ?? DEFAULT_DURATION;
  const freq = opts.freqHz ?? DEFAULT_FREQ;
  const captureType = opts.type ?? "oncpu";
  const session = openRemoteSession(opts.conn);
  try {
    const probe = await session.exec(
      [
        "echo USER=$(id -u)",
        "echo PERF=$(command -v perf 2>/dev/null || echo missing)",
        "echo SUDO=$(sudo -n true 2>/dev/null && echo ok || echo no)",
        "echo PARANOID=$(cat /proc/sys/kernel/perf_event_paranoid 2>/dev/null || echo unknown)",
        "echo ARCH=$(uname -m)",
        `echo PID=$(pgrep -o ${shellEscape(procName)} 2>/dev/null || echo none)`
      ].join("; ")
    );
    if (probe.err) throw new Error(`SSH \u9884\u68C0\u5931\u8D25: ${probe.err}`);
    const env = parseProbe(probe.stdout);
    if (env["PID"] === "none" || !/^\d+$/.test(env["PID"] ?? "")) {
      throw new Error(`\u8FDC\u7A0B\u672A\u627E\u5230 ${procName} \u8FDB\u7A0B`);
    }
    const pid = parseInt(env["PID"], 10);
    if (env["PERF"] === "missing") {
      throw new Error(
        "\u8FDC\u7A0B\u672A\u5B89\u88C5 perf \u5DE5\u5177\u3002\u5B89\u88C5\u65B9\u6CD5\uFF1ACentOS/RHEL/openEuler \u2192 `sudo yum install -y perf`\uFF1BUbuntu/Debian \u2192 `sudo apt-get install -y linux-tools-$(uname -r) || linux-tools-common`"
      );
    }
    const isRoot = env["USER"] === "0";
    const hasPasswordlessSudo = env["SUDO"] === "ok";
    if (!isRoot && !hasPasswordlessSudo) {
      throw new Error(
        `\u8FDC\u7A0B\u8D26\u6237 \`${opts.conn.user}\` \u975E root \u4E14\u65E0\u514D\u5BC6 sudo\uFF08perf \u9700\u8981 root\uFF09\u3002\u8BF7\u4E8C\u9009\u4E00\uFF1A(1) \u7528 root \u8D26\u6237\u767B\u5F55\uFF1B\u6216 (2) \u8FDC\u7AEF \`sudo visudo\` \u52A0\u4E00\u884C \`${opts.conn.user} ALL=(ALL) NOPASSWD: /usr/bin/perf, /bin/rm\``
      );
    }
    const sudo = isRoot ? "" : "sudo -n ";
    const paranoidNum = parseInt(env["PARANOID"] ?? "", 10);
    const paranoidWarn = Number.isFinite(paranoidNum) && paranoidNum >= 3 ? ` (\u63D0\u793A\uFF1Aperf_event_paranoid=${paranoidNum}\uFF0C\u53EF\u80FD\u9700\u8981 \`sudo sysctl -w kernel.perf_event_paranoid=1\`)` : "";
    const isArm64 = env["ARCH"] === "aarch64" || env["ARCH"] === "arm64";
    const cgFlag = isArm64 ? "--call-graph fp" : "-g";
    if (captureType === "offcpu") {
      const tpCheck = await session.exec(
        `${sudo}perf list tracepoint 2>/dev/null | grep -c sched:sched_switch || echo 0`
      );
      const tpCount = parseInt(tpCheck.stdout.trim(), 10);
      if (!tpCount || tpCount === 0) {
        throw new Error(
          "\u8FDC\u7A0B\u5185\u6838\u4E0D\u652F\u6301 sched:sched_switch tracepoint\uFF08off-cpu \u91C7\u96C6\u5FC5\u9700\uFF09\u3002\u53EF\u80FD\u539F\u56E0\uFF1A\u5185\u6838\u88C1\u526A\u4E86 CONFIG_SCHED_TRACER\uFF0C\u6216\u7F3A\u5C11 debugfs \u6302\u8F7D\u3002\u68C0\u67E5\uFF1A`ls /sys/kernel/debug/tracing/`\uFF0C\u5982\u4E0D\u5B58\u5728\u5219 `mount -t debugfs none /sys/kernel/debug`\u3002"
        );
      }
    }
    const buildRecordCmd = (mode) => {
      const target = mode === "pid" ? `-p ${pid}` : "-a";
      if (captureType === "offcpu") {
        return `timeout --signal=INT ${duration + 5} ${sudo}perf record -e sched:sched_switch ${target} ${cgFlag} -o /tmp/_perf.data -- sleep ${duration}`;
      }
      return `timeout --signal=INT ${duration + 5} ${sudo}perf record -F ${freq} -e task-clock ${target} ${cgFlag} -o /tmp/_perf.data -- sleep ${duration}`;
    };
    const scriptCmd = `${sudo}perf script -F comm,pid,tid,time,event,ip,sym,dso,period -i /tmp/_perf.data`;
    const cleanupCmd = `${sudo}rm -f /tmp/_perf.data`;
    const perfTimeoutMs = Math.max(3e4, (duration + 30) * 1e3);
    const tryRecord = async (mode) => {
      const recordCmd = buildRecordCmd(mode);
      const fullCmd = `${recordCmd} && ${scriptCmd}; __RC=$?; ${cleanupCmd}; exit $__RC`;
      const res = await session.exec(fullCmd, { timeoutMs: perfTimeoutMs });
      return { mode, recordCmd, stdout: res.stdout, stderr: res.stderr, exitCode: res.exitCode };
    };
    const hasNonIdleSamples = (scriptOutput) => {
      if (!scriptOutput.trim()) return false;
      const parsed = parsePerfScript(scriptOutput);
      const nonIdle = parsed.filter((s) => {
        for (let i = s.stack.length - 1; i >= 0; i--) {
          const fn = s.stack[i].fn;
          if (!fn || fn === "[unknown]") continue;
          return !IDLE_FUNCTIONS.has(fn);
        }
        return false;
      });
      return nonIdle.length > 0;
    };
    let attempt = await tryRecord("pid");
    let fallback = false;
    const pidHasError = attempt.stderr.match(/error|failed/i);
    const pidHasData = hasNonIdleSamples(attempt.stdout);
    if (!pidHasError && !pidHasData && attempt.exitCode === 0) {
      fallback = true;
      attempt = await tryRecord("global");
    }
    if (!attempt.stdout.trim() && attempt.exitCode !== 0) {
      const versionProbe = await session.exec("perf --version 2>&1 || true", { timeoutMs: 5e3 });
      const version = versionProbe.stdout.trim() || "unknown";
      const stderrHint = attempt.stderr.trim().split("\n").slice(0, 3).join(" | ");
      const hint = stderrHint || "\u672A\u77E5\u9519\u8BEF";
      throw new Error(
        `\u8FDC\u7A0B perf \u9000\u51FA\u7801 ${attempt.exitCode}: ${hint}${paranoidWarn}
  perf \u7248\u672C: ${version}
  \u5931\u8D25\u547D\u4EE4: ${attempt.recordCmd}`
      );
    }
    if (!attempt.stdout.trim()) {
      throw new Error(
        `perf \u91C7\u6837\u672A\u5F97\u5230\u4EFB\u4F55\u6837\u672C\uFF08-p PID \u548C -a \u5168\u5C40\u90FD 0\uFF09\u3002\u6574\u673A ${duration}s \u5185 CPU \u4F7F\u7528\u7387\u8FD1\u96F6\uFF1B\u5361\u987F\u82E5\u771F\u5B9E\u5B58\u5728\uFF0C\u4E0D\u5728 CPU \u6267\u884C\u8DEF\u5F84\u4E0A\uFF08\u53EF\u80FD\u662F IO \u7B49\u5F85 / \u9501 / \u7F51\u7EDC\uFF09\u3002${paranoidWarn}`
      );
    }
    const perfScriptText = attempt.stdout;
    const samples = parsePerfScript(perfScriptText);
    const totalSamples = samples.reduce((s, x) => s + x.period, 0);
    const folded = samplesToFolded(samples);
    let serverArtifactDir;
    let serverSvgPath;
    let serverPerfScriptPath;
    try {
      const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
      serverArtifactDir = `/tmp/cpu-flamegraph_${ts}`;
      await session.exec(`mkdir -p ${serverArtifactDir} && chmod 755 ${serverArtifactDir}`);
      const psName = `perf-script.txt`;
      await session.uploadFile(`${serverArtifactDir}/${psName}`, perfScriptText, { timeoutMs: 3e4 });
      serverPerfScriptPath = `${serverArtifactDir}/${psName}`;
      const fgPl = await readFile(join3(vendorRoot(), "flamegraph.pl"));
      await session.uploadFile(`${serverArtifactDir}/flamegraph.pl`, fgPl, { timeoutMs: 3e4 });
      await session.uploadFile(`${serverArtifactDir}/folded.txt`, folded, { timeoutMs: 3e4 });
      const svgName = `flamegraph.svg`;
      const svgCmd = `cd ${serverArtifactDir} && perl flamegraph.pl --title 'cpu-flamegraph ${procName} ${captureType === "offcpu" ? "off-CPU" : "on-CPU"}'${captureType === "offcpu" ? " --color=io" : ""} folded.txt > ${svgName} 2>/dev/null && ls -la ${svgName}`;
      const svgRes = await session.exec(svgCmd, { timeoutMs: 3e4 });
      if (svgRes.exitCode === 0 && svgRes.stdout.includes(svgName)) {
        serverSvgPath = `${serverArtifactDir}/${svgName}`;
      }
    } catch {
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
        total_samples: totalSamples
      }
    };
  } finally {
    session.close();
  }
}
function vendorRoot() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidate = join3(here, "..", "vendor");
  if (existsSync(join3(candidate, "flamegraph.pl"))) return candidate;
  throw new Error(
    `vendor/flamegraph.pl \u627E\u4E0D\u5230\uFF08searched: ${candidate}\uFF09\u3002\u8BF7\u786E\u8BA4 cartridge \u5B8C\u6574\uFF1Askills/cpu-flamegraph/vendor/flamegraph.pl \u5E94\u5B58\u5728\u3002`
  );
}
function parseProbe(s) {
  const out = {};
  for (const line of s.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

// skills/cpu-flamegraph/src/render.ts
function dw(s) {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c >= 19968 && c <= 40959 || c >= 12288 && c <= 12351 || c >= 65280 && c <= 65519 || c >= 13312 && c <= 19903)
      w += 2;
    else w += 1;
  }
  return w;
}
function pad(s, width, align = "left") {
  const diff = width - dw(s);
  if (diff <= 0) return s;
  if (align === "right") return " ".repeat(diff) + s;
  if (align === "center") {
    const l = Math.floor(diff / 2);
    return " ".repeat(l) + s + " ".repeat(diff - l);
  }
  return s + " ".repeat(diff);
}
var EIGHTH_BLOCKS = ["", "\u258F", "\u258E", "\u258D", "\u258C", "\u258B", "\u258A", "\u2589"];
function mdBar(percent, width = 20) {
  const clamped = Math.max(0, Math.min(100, percent));
  const totalEighths = Math.round(clamped * width * 8 / 100);
  const fullCells = Math.floor(totalEighths / 8);
  const remain = totalEighths - fullCells * 8;
  const partial = remain > 0 ? EIGHTH_BLOCKS[remain] : "";
  const emptyCells = width - fullCells - (remain > 0 ? 1 : 0);
  return "\u2588".repeat(Math.max(0, fullCells)) + partial + "\u2591".repeat(Math.max(0, emptyCells));
}
function deltaCell(d) {
  if (d === null) return "-";
  if (d > 0) return `\u25B2 +${d.toFixed(1)}`;
  if (d < 0) return `\u25BC ${d.toFixed(1)}`;
  return "0.0";
}
function truncateFunc(name, max) {
  if (name.length <= max) return name;
  const ltIdx = name.indexOf("<");
  if (ltIdx > 0 && ltIdx < max - 10) {
    let depth = 0;
    let gtIdx = -1;
    for (let i = ltIdx; i < name.length; i++) {
      if (name[i] === "<") depth++;
      else if (name[i] === ">") {
        depth--;
        if (depth === 0) {
          gtIdx = i;
          break;
        }
      }
    }
    if (gtIdx > ltIdx) {
      const prefix = name.slice(0, ltIdx);
      const suffix = name.slice(gtIdx + 1);
      const short = `${prefix}<\u2026>${suffix}`;
      if (short.length <= max) return short;
      if (prefix.length + 4 < max) {
        return `${prefix}<\u2026>${suffix.slice(0, max - prefix.length - 4)}\u2026`;
      }
    }
  }
  const headLen = Math.max(10, Math.floor((max - 1) * 0.6));
  const tailLen = max - 1 - headLen;
  return name.slice(0, headLen) + "\u2026" + name.slice(name.length - tailLen);
}
function renderBoxTable(headers, rows) {
  const cols = headers.length;
  const widths = headers.map((h) => dw(h.title));
  for (const row of rows) {
    for (let i = 0; i < cols; i++) {
      widths[i] = Math.max(widths[i], dw(row[i] ?? ""));
    }
  }
  const padded = widths.map((w) => w + 2);
  const mkLine = (left, mid, right, fill) => left + padded.map((w) => fill.repeat(w)).join(mid) + right;
  const top = mkLine("\u256D", "\u252C", "\u256E", "\u2500");
  const sep = mkLine("\u251C", "\u253C", "\u2524", "\u2500");
  const bot = mkLine("\u2570", "\u2534", "\u256F", "\u2500");
  const headerCells = headers.map((h, i) => " " + pad(h.title, padded[i] - 2, h.align) + " ").join("\u2502");
  const headerLine = "\u2502" + headerCells + "\u2502";
  const rowLines = rows.map(
    (row) => "\u2502" + headers.map((h, i) => " " + pad(row[i] ?? "", padded[i] - 2, h.align) + " ").join("\u2502") + "\u2502"
  );
  return [top, headerLine, sep, ...rowLines, bot].join("\n");
}
function nsToMs(ns) {
  return (ns / 1e6).toFixed(2);
}
function renderTerminal(report, opts = {}) {
  const topN = opts.topN ?? 10;
  const maxFuncLen = opts.maxFuncLen ?? 60;
  const meta = report.meta;
  const lines = [];
  const total = meta["total_samples"] ?? 0;
  const top10Pct = report.hot_functions.slice(0, 10).reduce((s, h) => s + h.percent, 0);
  const ragHits = report.hot_functions.filter((h) => h.rag_hits.length > 0).length;
  lines.push("\u2550\u2550\u2550 \u91C7\u6837\u5143\u4FE1\u606F \u2550\u2550\u2550");
  lines.push(
    `PID ${meta["pid"] ?? "?"} (${meta["comm"] ?? ""})  ${meta["duration_sec"] ?? "?"}s  ${meta["freq_hz"] ?? "?"}Hz  ${meta["mode"] ?? "on-cpu"}  scope=${meta["scope"] ?? "pid"}`
  );
  lines.push(
    `CPU \u65F6\u95F4\u5408\u8BA1 ${nsToMs(total)}ms  Top${Math.min(10, report.hot_functions.length)} \u5360\u6BD4 ${top10Pct.toFixed(1)}%  RAG \u547D\u4E2D ${ragHits}/${report.hot_functions.length}`
  );
  const dur = meta["duration_sec"];
  if (dur && total > dur * 1e9) {
    lines.push(
      `\u6CE8\uFF1ACPU \u65F6\u95F4 > \u91C7\u6837\u7A97\u53E3 ${dur}s \u5C5E\u6B63\u5E38 \u2014\u2014 \u591A\u6838 task-clock \u7D2F\u52A0\uFF0C\u6240\u6709 CPU \u6838\u5404\u5FD9 N \u79D2\u5408\u8BA1\u4F1A\u8D85\u8FC7 wall-time\u3002`
    );
  }
  lines.push("");
  if (report.hot_functions.length > 0) {
    lines.push(`\u2550\u2550\u2550 \u70ED\u70B9\u51FD\u6570 Top ${Math.min(topN, report.hot_functions.length)} \u2550\u2550\u2550`);
    const hasDelta = report.hot_functions.slice(0, topN).some((h) => h.delta_percent !== null);
    const headers = hasDelta ? [
      { title: "#", align: "right" },
      { title: "\u51FD\u6570", align: "left" },
      { title: "\u6A21\u5757", align: "left" },
      { title: "\u5360\u6BD4", align: "right" },
      { title: "\u0394", align: "right" },
      { title: "\u5206\u5E03", align: "left" }
    ] : [
      { title: "#", align: "right" },
      { title: "\u51FD\u6570", align: "left" },
      { title: "\u6A21\u5757", align: "left" },
      { title: "\u5360\u6BD4", align: "right" },
      { title: "\u5206\u5E03", align: "left" }
    ];
    const rows = report.hot_functions.slice(0, topN).map((hf, i) => {
      const marker = hf.rag_hits.length > 0 ? "\u24D8 " : "";
      const fn = marker + truncateFunc(hf.name, maxFuncLen);
      return hasDelta ? [
        String(i + 1),
        fn,
        hf.module,
        `${hf.percent.toFixed(1)}%`,
        deltaCell(hf.delta_percent),
        mdBar(hf.percent)
      ] : [String(i + 1), fn, hf.module, `${hf.percent.toFixed(1)}%`, mdBar(hf.percent)];
    });
    lines.push(renderBoxTable(headers, rows));
    if (hasDelta) {
      lines.push("\u24D8 = \u6709 RAG \u8C03\u4F18\u5EFA\u8BAE\uFF08\u77E5\u8BC6\u5E93\u6B63\u5219\u547D\u4E2D \xB7 \u975E LLM \u63A8\u6D4B\uFF09   \u25B2 \u5DEE\u5206\u66B4\u6DA8   \u25BC \u5DEE\u5206\u964D\u4F4E");
    } else if (ragHits > 0) {
      lines.push("\u24D8 = \u6709 RAG \u8C03\u4F18\u5EFA\u8BAE\uFF08\u77E5\u8BC6\u5E93\u6B63\u5219\u547D\u4E2D \xB7 \u975E LLM \u63A8\u6D4B\uFF09");
    }
    lines.push("");
  }
  if (report.call_tree && report.call_tree.children.length > 0) {
    const hottestLeafName = report.hot_functions[0]?.name;
    const idleFiltered = report.meta["idle_filter_applied"] !== false;
    const filteredOut = report.meta["idle_filtered_samples"] ?? 0;
    lines.push("\u2550\u2550\u2550 \u8C03\u7528\u6811\uFF08perf report --children \u540C\u6B3E\uFF1AChildren=inclusive, Self=exclusive\uFF09\u2550\u2550\u2550");
    lines.push("  \u5217\u542B\u4E49\uFF1AChildren% = \u542B\u8C03\u7528\u94FE\u7D2F\u8BA1\u5360\u6BD4    Self% = \u51FD\u6570\u81EA\u8EAB\u5360\u6BD4");
    lines.push("  \u9608\u503C\uFF1AChildren% \u2265 0.5%\uFF08\u540C perf/pprof \u9ED8\u8BA4\uFF09\uFF1B\u25CF \u6807\u8BB0 Self Top-1");
    if (idleFiltered && filteredOut > 0) {
      lines.push(`  \u5DF2\u8FC7\u6EE4 ${filteredOut} \u6761 CPU \u7A7A\u95F2\u91C7\u6837\uFF08arch_cpu_idle/swapper \u7B49\uFF0Cpy-spy \u540C\u7EA6\u5B9A\uFF09`);
    }
    lines.push("");
    renderCallTree(lines, report.call_tree, hottestLeafName, maxFuncLen);
    lines.push("");
  }
  renderKbSection(lines, report);
  if (report.diff_highlights && report.diff_highlights.length > 0) {
    lines.push(`\u2550\u2550\u2550 \u5DEE\u5206\u53D8\u5316\uFF08${report.diff_highlights.length} \u9879\uFF09 \u2550\u2550\u2550`);
    for (const hf of report.diff_highlights.slice(0, 10)) {
      const tag = hf.delta_percent !== null && hf.percent - hf.delta_percent < 0.01 ? "\u65B0\u589E" : "\u53D8\u5316";
      lines.push(
        `  ${tag}  ${truncateFunc(hf.name, maxFuncLen)}  \u6A21\u5757=${hf.module}  ${hf.percent.toFixed(1)}%  \u0394 ${deltaCell(hf.delta_percent)}`
      );
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
var MIN_PCT_DISPLAY = 0.5;
var MAX_CHILDREN_DISPLAY = 8;
var MAX_DEPTH_DISPLAY = 12;
var LINEAR_CHAIN_EPS = 0.1;
function collapseLinearChain(start, minCount) {
  const inlineNames = [start.name];
  let cur = start;
  while (true) {
    const kids = cur.children.filter((c) => c.percent >= MIN_PCT_DISPLAY && c.count >= minCount);
    if (kids.length !== 1) break;
    const only = kids[0];
    if (Math.abs(only.percent - cur.percent) > LINEAR_CHAIN_EPS) break;
    if (cur.selfPercent > LINEAR_CHAIN_EPS) break;
    cur = only;
    inlineNames.push(cur.name);
  }
  return { end: cur, inlineNames };
}
function renderCallTree(lines, root, hottestLeafName, maxFuncLen) {
  const rows = [];
  const walk = (n, prefix, isLast, isRoot, depth) => {
    const { end, inlineNames } = collapseLinearChain(n, 0);
    const inlineCount = inlineNames.length;
    const connector = isRoot ? "" : isLast ? "\u2514\u2500 " : "\u251C\u2500 ";
    const nodePrefix = prefix + connector;
    const displayFn = inlineCount === 1 ? truncateFunc(end.name, maxFuncLen) : truncateFunc(
      inlineNames.length > 2 ? `${inlineNames[0]} \u2192 \u2026 \u2192 ${inlineNames[inlineNames.length - 1]}` : inlineNames.join(" \u2192 "),
      maxFuncLen
    );
    rows.push({
      prefix: nodePrefix,
      fn: displayFn,
      module: end.module,
      percent: end.percent,
      selfPercent: end.selfPercent,
      inlineCount
    });
    if (depth >= MAX_DEPTH_DISPLAY) {
      if (end.children.length > 0) {
        const nextPrefix2 = isRoot ? "" : prefix + (isLast ? "   " : "\u2502  ");
        rows.push({
          prefix: nextPrefix2 + "\u2514\u2500 ",
          fn: `\u2026 \u7701\u7565\u66F4\u6DF1\u8C03\u7528\uFF08${end.children.length} \u5206\u652F\uFF09`,
          module: "",
          percent: 0,
          selfPercent: 0,
          inlineCount: 1,
          isOmissionNote: true
        });
      }
      return;
    }
    const nextPrefix = isRoot ? "" : prefix + (isLast ? "   " : "\u2502  ");
    const visibleKids = end.children.filter((c) => c.percent >= MIN_PCT_DISPLAY).slice(0, MAX_CHILDREN_DISPLAY);
    const hiddenCount = end.children.length - visibleKids.length;
    for (let i = 0; i < visibleKids.length; i++) {
      walk(visibleKids[i], nextPrefix, i === visibleKids.length - 1 && hiddenCount === 0, false, depth + 1);
    }
    if (hiddenCount > 0) {
      rows.push({
        prefix: nextPrefix + "\u2514\u2500 ",
        fn: `\u2026 \u7701\u7565 ${hiddenCount} \u6761\u5206\u652F\uFF08\u5747 < ${MIN_PCT_DISPLAY}%\uFF1B\u5B8C\u6574\u8BE6\u60C5\u89C1\u670D\u52A1\u5668 perf-script.txt\uFF09`,
        module: "",
        percent: 0,
        selfPercent: 0,
        inlineCount: 1,
        isOmissionNote: true
      });
    }
  };
  const visibleRoots = root.children.filter((c) => c.percent >= MIN_PCT_DISPLAY).slice(0, MAX_CHILDREN_DISPLAY);
  const hiddenRoots = root.children.length - visibleRoots.length;
  for (let i = 0; i < visibleRoots.length; i++) {
    walk(visibleRoots[i], "", i === visibleRoots.length - 1 && hiddenRoots === 0, true, 1);
  }
  if (hiddenRoots > 0) {
    rows.push({
      prefix: "",
      fn: `\u2026 \u7701\u7565 ${hiddenRoots} \u6761\u6839\u5206\u652F\uFF08\u5747 < ${MIN_PCT_DISPLAY}%\uFF09`,
      module: "",
      percent: 0,
      selfPercent: 0,
      inlineCount: 1,
      isOmissionNote: true
    });
  }
  if (rows.length === 0) {
    lines.push("  \uFF08\u65E0 Children% \u2265 0.5% \u7684\u8C03\u7528\u8DEF\u5F84\uFF09");
    return;
  }
  const markerFor = (r) => {
    if (!hottestLeafName) return "";
    if (r.inlineCount === 1 && r.fn === hottestLeafName) return " \u25CF";
    return "";
  };
  const fnColWidth = Math.max(...rows.map((r) => dw(r.prefix + r.fn + markerFor(r))));
  const moduleColWidth = Math.max(...rows.map((r) => dw(r.module ? `[${r.module}]` : "")));
  for (const r of rows) {
    if (r.isOmissionNote) {
      lines.push(`  ${pad(r.prefix + r.fn, fnColWidth)}`);
      continue;
    }
    const marker = markerFor(r);
    const left = pad(r.prefix + r.fn + marker, fnColWidth);
    const mod = pad(r.module ? `[${r.module}]` : "", moduleColWidth);
    const childrenPct = `${r.percent.toFixed(1).padStart(5)}%`;
    const selfPct = `${r.selfPercent.toFixed(1).padStart(5)}%`;
    const bar = mdBar(r.percent);
    const collapsed = r.inlineCount > 1 ? `  (${r.inlineCount} frames inline)` : "";
    lines.push(`  ${left}  ${mod}  ${childrenPct}  ${selfPct}  ${bar}${collapsed}`);
  }
}
var KB_MIN_PCT = 5;
function renderKbSection(lines, report) {
  const qualified = report.hot_functions.filter((h) => h.percent >= KB_MIN_PCT);
  if (qualified.length === 0) return;
  const anyHit = qualified.some((h) => h.rag_hits.length > 0);
  if (!anyHit) return;
  lines.push("\u2550\u2550\u2550 \u77E5\u8BC6\u5E93\u89E3\u8BFB\uFF08\u57FA\u4E8E\u77E5\u8BC6\u5E93 \xB7 \u975E LLM \u63A8\u6D4B\uFF09\u2550\u2550\u2550");
  lines.push("");
  const refs = /* @__PURE__ */ new Map();
  let nextRefIdx = 1;
  for (let i = 0; i < qualified.length; i++) {
    const hf = qualified[i];
    const fIdx = i + 1;
    lines.push(`  \`${hf.name}\` \u5360 ${hf.percent.toFixed(1)}% [F${fIdx}]`);
    if (hf.rag_hits.length > 0) {
      const hit = hf.rag_hits[0];
      let refN = refs.get(hit.source_url);
      if (refN === void 0) {
        refN = nextRefIdx++;
        refs.set(hit.source_url, refN);
      }
      lines.push(`  \u2713 \u77E5\u8BC6\u5E93\u547D\u4E2D \xB7 semantic_group=${hit.semantic_group}`);
      lines.push(`  ${hit.snippet} [\u53C2\u8003${refN}]`);
    } else {
      lines.push(`  \u77E5\u8BC6\u5E93\u672A\u8986\u76D6 \xB7 module=${hf.module}`);
      lines.push(`  \u2192 \u6A21\u677F B\uFF1A\u8BF7\u7ED3\u5408\u8C03\u7528\u6808\u4E0A\u4E0B\u6587\u548C SVG \u72EC\u7ACB\u5224\u65AD`);
    }
    lines.push("");
  }
  if (refs.size > 0) {
    lines.push("  \u2500 \u53C2\u8003\u6765\u6E90 \u2500");
    for (const [url, idx] of refs) {
      lines.push(`  [\u53C2\u8003${idx}] ${url}`);
    }
    lines.push("");
  }
}

// skills/cpu-flamegraph/src/interpretHotspot.ts
function interpretHotspot(name, module, isOffcpu) {
  if (!name) {
    return isOffcpu ? "\u672A\u8BC6\u522B\u5230\u660E\u786E\u7684\u7B49\u5F85\u70ED\u70B9\uFF0C\u9700\u7ED3\u5408\u4E1A\u52A1\u9AD8\u5CF0\u671F\u518D\u6B21\u91C7\u6837" : "\u672A\u8BC6\u522B\u5230\u660E\u786E\u7684 CPU \u70ED\u70B9\uFF0C\u9700\u7ED3\u5408\u4E1A\u52A1\u9AD8\u5CF0\u671F\u518D\u6B21\u91C7\u6837";
  }
  const lowerName = name.toLowerCase();
  const lowerModule = (module ?? "").toLowerCase();
  if (isOffcpu) {
    if (lowerName.includes("futex") || lowerName.includes("mutex") || lowerName.includes("cond")) {
      return "\u70ED\u70B9\u66F4\u50CF\u9501\u7B49\u5F85\u6216\u7EBF\u7A0B\u540C\u6B65\u7B49\u5F85\uFF0C\u4F18\u5148\u6392\u67E5\u5E76\u53D1\u4E89\u7528\u800C\u4E0D\u662F CPU \u7B97\u529B\u4E0D\u8DB3";
    }
    if (lowerName.includes("epoll") || lowerName.includes("poll") || lowerName.includes("io") || lowerModule.includes("io")) {
      return "\u70ED\u70B9\u66F4\u50CF IO/\u4E8B\u4EF6\u7B49\u5F85\uFF0C\u4F18\u5148\u6392\u67E5\u78C1\u76D8\u3001\u7F51\u7EDC\u6216\u4E0A\u6E38\u8C03\u7528\u94FE\u8DEF";
    }
    return "\u70ED\u70B9\u4E3B\u8981\u4F53\u73B0\u7B49\u5F85\u65F6\u95F4\u6D88\u8017\uFF0C\u9700\u7ED3\u5408\u8C03\u7528\u94FE\u5224\u65AD\u662F\u9501\u3001IO \u8FD8\u662F\u7F51\u7EDC\u7B49\u5F85";
  }
  if (lowerModule.includes("mongosh") || lowerName.includes("async") || lowerName.includes("await")) {
    return "\u70ED\u70B9\u66F4\u50CF\u91C7\u96C6\u4FA7\u6216\u5BA2\u6237\u7AEF\u5F02\u6B65\u5F00\u9500\uFF0C\u672C\u6B21\u672A\u89C1 mongod \u6838\u5FC3\u6267\u884C\u8DEF\u5F84\u6210\u4E3A\u4E3B\u8981 CPU \u74F6\u9888";
  }
  if (lowerModule.includes("mongod") || lowerModule.includes("wiredtiger")) {
    return "\u70ED\u70B9\u5DF2\u8FDB\u5165\u6570\u636E\u5E93\u5F15\u64CE\u4FA7\uFF0C\u5EFA\u8BAE\u7ED3\u5408\u6162\u67E5\u8BE2\u3001\u9501\u4E0E\u7F13\u5B58\u6307\u6807\u7EE7\u7EED\u6DF1\u6316";
  }
  if (lowerName.includes("sched") || lowerName.includes("idle")) {
    return "\u6837\u672C\u66F4\u591A\u53CD\u6620\u8C03\u5EA6\u6216\u7A7A\u95F2\u884C\u4E3A\uFF0C\u4E0D\u50CF\u7A33\u5B9A\u7684\u4E1A\u52A1\u70ED\u70B9\uFF0C\u5EFA\u8BAE\u5728\u8D1F\u8F7D\u66F4\u9AD8\u65F6\u590D\u67E5";
  }
  return "\u70ED\u70B9\u5DF2\u5B9A\u4F4D\u5230\u5177\u4F53\u51FD\u6570\uFF0C\u53EF\u7ED3\u5408\u62A5\u544A\u4E2D\u7684\u8C03\u7528\u94FE\u548C\u53EF\u89C6\u5316\u4EA7\u7269\u7EE7\u7EED\u5224\u65AD\u4E1A\u52A1\u542B\u4E49";
}

// skills/cpu-flamegraph/src/cli-capture.ts
function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) return { error: `unknown arg: ${a} (expect --key=value)` };
    out[m[1]] = m[2];
  }
  if (!out["host"] || !out["user"]) {
    return { error: "missing required args: --host=<ip> --user=<user>" };
  }
  const type = out["type"];
  if (type && type !== "oncpu" && type !== "offcpu") {
    return { error: `--type must be oncpu or offcpu (got: ${type})` };
  }
  const args = {
    host: out["host"],
    user: out["user"]
  };
  if (out["port"]) args.port = parseInt(out["port"], 10);
  if (out["key"]) args.key = out["key"];
  if (out["password"]) args.password = out["password"];
  if (out["process"]) args.process = out["process"];
  if (out["duration"]) args.duration = parseFloat(out["duration"]);
  if (type) args.type = type;
  if (out["engine"]) args.engine = out["engine"];
  return args;
}
async function main() {
  const parsed = parseArgs(process.argv);
  if ("error" in parsed) {
    process.stderr.write(`error: ${parsed.error}
`);
    return 1;
  }
  const isOffcpu = parsed.type === "offcpu";
  const timeLabel = isOffcpu ? "\u7B49\u5F85\u65F6\u95F4" : "CPU \u65F6\u95F4";
  let capture;
  try {
    capture = await captureFlamegraph({
      conn: {
        host: parsed.host,
        user: parsed.user,
        ...parsed.port !== void 0 ? { port: parsed.port } : {},
        ...parsed.key ? { privateKeyPath: parsed.key } : {},
        ...parsed.password && !parsed.key ? { password: parsed.password } : {}
      },
      ...parsed.process ? { process: parsed.process } : {},
      ...parsed.duration !== void 0 ? { duration: parsed.duration } : {},
      ...parsed.type ? { type: parsed.type } : {}
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`\u706B\u7130\u56FE\u91C7\u96C6\u5931\u8D25\uFF1A${msg}
`);
    return 1;
  }
  const scriptDir = dirname2(fileURLToPath2(import.meta.url));
  const dataDir = resolve(scriptDir, "..", "data", "kb-seeds");
  const report = analyze({
    samples: capture.samples,
    meta: {
      pid: capture.meta.pid,
      comm: capture.meta.comm,
      duration_sec: capture.meta.duration_sec,
      freq_hz: capture.meta.freq_hz,
      mode: isOffcpu ? "off-cpu" : "on-cpu",
      scope: capture.meta.scope
    },
    topN: 10,
    engine: parsed.engine ?? "mongo",
    kbDataDir: dataDir
  });
  let termView = renderTerminal(report);
  const totalMs = (capture.meta.total_samples / 1e6).toFixed(1);
  const top1 = report.hot_functions[0];
  const scopeLabel = capture.meta.scope === "global" ? `\u5168\u7CFB\u7EDF\uFF08-a\uFF0C\u56E0\u76EE\u6807\u8FDB\u7A0B\u95F2\uFF09` : `\u76EE\u6807\u8FDB\u7A0B ${capture.meta.comm}(pid=${capture.meta.pid})`;
  const sshTarget = `${parsed.user}@${parsed.host}`;
  const summary = top1 ? `${timeLabel} ${totalMs}ms\uFF1B\u91C7\u6837\u8303\u56F4\uFF1A${scopeLabel}\uFF1BTop: ${top1.name} ${top1.percent.toFixed(1)}%\uFF08\u6A21\u5757 ${top1.module}\uFF09` : `${timeLabel} ${totalMs}ms\uFF0C\u91C7\u6837\u8303\u56F4\uFF1A${scopeLabel}\uFF0C0 \u70ED\u70B9\uFF08\u5168\u7A7A\u95F2\uFF09`;
  const interpretation = interpretHotspot(top1?.name ?? null, top1?.module ?? null, isOffcpu);
  const result = {
    ok: true,
    mode: isOffcpu ? "offcpu" : "oncpu",
    timeLabel,
    totalMs: parseFloat(totalMs),
    scopeLabel,
    summary,
    top1: top1 ? {
      name: top1.name,
      module: top1.module,
      percent: parseFloat(top1.percent.toFixed(1))
    } : null,
    interpretation,
    artifacts: {
      sshTarget,
      serverSvgPath: capture.serverSvgPath ?? null,
      serverPerfScriptPath: capture.serverPerfScriptPath ?? null,
      scpSvg: capture.serverSvgPath ? `scp ${sshTarget}:${capture.serverSvgPath} .` : null,
      scpPerfScript: capture.serverPerfScriptPath ? `scp ${sshTarget}:${capture.serverPerfScriptPath} .` : null
    },
    hot_functions_top10: report.hot_functions.slice(0, 10).map((h) => ({
      name: h.name,
      module: h.module,
      percent: parseFloat(h.percent.toFixed(2))
    })),
    terminalReport: termView
  };
  if (!top1) {
    result.terminalReport += "\n\n\u2550\u2550\u2550 \u70ED\u70B9\u51FD\u6570 \u2550\u2550\u2550\n  \uFF08\u672A\u8BC6\u522B\u5230\u771F\u5B9E CPU \u70ED\u70B9\u3002\u6240\u6709\u91C7\u6837\u53EF\u80FD\u5747\u88AB\u8FC7\u6EE4\u4E3A CPU \u7A7A\u95F2\u51FD\u6570\uFF0C\u5982 arch_cpu_idle \u7B49\u3002\u5982\u9700\u8BCA\u65AD\uFF0C\u8BF7\u5728\u91C7\u6837\u671F\u95F4\u7ED9\u76EE\u6807\u8FDB\u7A0B\u65BD\u52A0\u4E1A\u52A1\u8D1F\u8F7D\uFF09";
  }
  if (capture.serverSvgPath || capture.serverPerfScriptPath) {
    result.terminalReport += "\n\n\u2550\u2550\u2550 \u8FDC\u7AEF\u4EA7\u7269\u4F4D\u7F6E \u2550\u2550\u2550";
    if (capture.serverSvgPath) result.terminalReport += `
  SVG \u6587\u4EF6: ${capture.serverSvgPath}`;
    if (capture.serverPerfScriptPath) result.terminalReport += `
  Speedscope: scp ${sshTarget}:${capture.serverPerfScriptPath} .`;
  }
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  return 0;
}
main().then(
  (rc) => process.exit(rc),
  (e) => {
    process.stderr.write(`unexpected error: ${e instanceof Error ? e.stack || e.message : String(e)}
`);
    process.exit(1);
  }
);
