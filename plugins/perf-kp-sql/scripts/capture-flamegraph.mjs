#!/usr/bin/env node
// capture-flamegraph.mjs
// 自定位 + 跨 harness 解析 cpu-flamegraph 插件 root，再透传给 capture.mjs。
// 用意 1：把"找 cpu-flamegraph 邻居插件"这件事从 SKILL.md 抽出来，
//   加新 agent 时 SKILL.md 不动；最坏情况只在 candidates 里加一行。
// 用意 2：duration 强制 clamp · 防 LLM 自由发挥拉到 30s/60s。
//   诊断场景默认 3s 已足够命中 stack-pattern；超 10s 必须显式 --allow-long-duration
//   opt-in（需要用户明确要求长窗口 / off-cpu 长尾分析）。
// 用意 3（0.44.0）：单目录归档 — 支持 `--local-svg-out=<path>` 参数，
//   capture.mjs 跑完后把远端 SVG scp 到本地指定位置（典型用法：
//   `--local-svg-out=~/.perf-kp-sql/runs/<TS>/flame.svg`）。
//   本参数本地处理 · 不透传给 capture.mjs。

import { existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { createHash } from "node:crypto";

const DEP_NAME = "cpu-flamegraph";
const REL_CAPTURE = join("skills", DEP_NAME, "scripts", "capture.mjs");
const DEFAULT_DURATION = 3;
const MAX_DURATION_NO_OVERRIDE = 10;

const myRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const isDir = (p) => { try { return !!p && statSync(p).isDirectory(); } catch { return false; } };
const hasCapture = (root) => existsSync(join(root, REL_CAPTURE));

const cacheDirs = [
  join(homedir(), ".ohsql", "plugins", "cache"),
  join(homedir(), ".claude", "plugins"),
  join(homedir(), ".codex", "plugins"),
].filter(isDir);

const cacheCandidates = cacheDirs.flatMap((h) => {
  let entries = [];
  try { entries = readdirSync(h); } catch { return []; }
  return entries
    .filter((n) => n === DEP_NAME || n.startsWith(`${DEP_NAME}@`))
    .sort()
    .reverse()
    .map((n) => join(h, n));
});

const candidates = [
  process.env.OHSQL_DEP_CPU_FLAMEGRAPH_ROOT,
  process.env.CLAUDE_PLUGIN_DEP_CPU_FLAMEGRAPH_ROOT,
  process.env.CODEX_PLUGIN_DEP_CPU_FLAMEGRAPH_ROOT,
  join(dirname(myRoot), DEP_NAME),
  ...cacheCandidates,
].filter(Boolean);

const flameRoot = candidates.find(hasCapture);

if (!flameRoot) {
  process.stderr.write(JSON.stringify({
    ok: false,
    err: `cpu-flamegraph plugin not found (looked for ${REL_CAPTURE})`,
    tried: candidates,
  }) + "\n");
  process.exit(2);
}

// duration clamp · 默认注入 3s · >10s 必须 --allow-long-duration opt-in
const rawArgs = process.argv.slice(2);
let durIdx = -1;
let durationVal = null;
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === "--duration") {
    durIdx = i;
    durationVal = parseFloat(rawArgs[i + 1]);
    break;
  }
  if (rawArgs[i].startsWith("--duration=")) {
    durIdx = i;
    durationVal = parseFloat(rawArgs[i].slice("--duration=".length));
    break;
  }
}
const allowLong = rawArgs.includes("--allow-long-duration");

// --local-svg-out=<path> 本地参数 · 不透传给 capture.mjs · 抽出来后续 scp 用
let localSvgOut = null;
const filteredArgs = [];
for (const a of rawArgs) {
  if (a === "--allow-long-duration") continue;
  if (a.startsWith("--local-svg-out=")) {
    localSvgOut = a.slice("--local-svg-out=".length);
    continue;
  }
  filteredArgs.push(a);
}
// expand leading ~ for local path
if (localSvgOut && localSvgOut.startsWith("~/")) {
  localSvgOut = join(homedir(), localSvgOut.slice(2));
}
const cleanedArgs = filteredArgs;

if (durIdx < 0 || Number.isNaN(durationVal)) {
  cleanedArgs.push(`--duration=${DEFAULT_DURATION}`);
  process.stderr.write(
    `[capture-flamegraph] 未指定 --duration · 注入诊断默认值 ${DEFAULT_DURATION}s\n`
  );
} else if (durationVal <= 0) {
  process.stderr.write(JSON.stringify({
    ok: false,
    err: `duration=${durationVal} 无效 · 必须 > 0`,
  }) + "\n");
  process.exit(2);
} else if (durationVal > MAX_DURATION_NO_OVERRIDE && !allowLong) {
  process.stderr.write(JSON.stringify({
    ok: false,
    err: `duration=${durationVal}s 超过诊断默认上限 ${MAX_DURATION_NO_OVERRIDE}s · 30s/60s 这种长窗口会显著扰动生产 mongod 且数据量随时长线性增长。诊断场景默认 3s 已足够命中 stack-pattern。如确需长窗口(用户明确要求 / off-cpu 长尾分析) · 加 --allow-long-duration 显式 opt-in · 并在报告里说明理由。`,
    duration: durationVal,
    limit: MAX_DURATION_NO_OVERRIDE,
  }) + "\n");
  process.exit(2);
}

const captureScript = join(flameRoot, REL_CAPTURE);

if (!localSvgOut) {
  // 不需要本地落 SVG · 走老路径 · stdio inherit · 退出码透传
  const child = spawn(process.execPath, [captureScript, ...cleanedArgs], { stdio: "inherit" });
  child.on("error", (e) => {
    process.stderr.write(JSON.stringify({ ok: false, err: `spawn failed: ${e.message}`, captureScript }) + "\n");
    process.exit(2);
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
} else {
  // 需要本地落 SVG · 捕获 stdout 找 serverSvgPath · scp 拉本地
  // 注:capture.mjs 输出 JSON 到 stdout 末尾 · 我们 buffer + 透传 + 解析 · 不打断用户视觉
  let stdoutBuf = "";
  const child = spawn(process.execPath, [captureScript, ...cleanedArgs], {
    stdio: ["inherit", "pipe", "inherit"],
  });
  child.stdout.on("data", (chunk) => {
    stdoutBuf += chunk.toString("utf8");
    process.stdout.write(chunk);
  });
  child.on("error", (e) => {
    process.stderr.write(JSON.stringify({ ok: false, err: `spawn failed: ${e.message}`, captureScript }) + "\n");
    process.exit(2);
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    if (code !== 0) {
      process.exit(code ?? 1);
      return;
    }
    // 解析 stdout 找 JSON · capture.mjs 末尾 process.stdout.write(JSON.stringify(result, null, 2) + "\n")
    let parsed = null;
    try {
      // JSON 是末尾整段 · 找最后一个 `^{` 行起 parse
      const lastBrace = stdoutBuf.lastIndexOf("\n{");
      const jsonStr = lastBrace >= 0 ? stdoutBuf.slice(lastBrace + 1) : stdoutBuf;
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      process.stderr.write(`[capture-flamegraph] 无法解析 capture.mjs stdout JSON · 跳过 SVG 落本地: ${e.message}\n`);
      process.exit(0);
    }
    const serverSvgPath = parsed?.artifacts?.serverSvgPath;
    if (!serverSvgPath) {
      process.stderr.write(`[capture-flamegraph] capture.mjs 未返回 serverSvgPath · 跳过 SVG 落本地\n`);
      process.exit(0);
    }
    // 拼 scp 命令 · 复用用户给的 host/user/port/key/password
    // 解析 cleanedArgs 拿 host/user/port/key
    const argMap = {};
    for (const a of cleanedArgs) {
      const m = a.match(/^--([^=]+)=(.*)$/);
      if (m) argMap[m[1]] = m[2];
    }
    const host = argMap.host;
    const user = argMap.user;
    const port = argMap.port;
    const key = argMap.key;
    if (!host || !user) {
      process.stderr.write(`[capture-flamegraph] cleanedArgs 缺 host/user · 跳过 SVG 落本地\n`);
      process.exit(0);
    }
    if (host.startsWith("-") || user.startsWith("-") || (key && key.startsWith("-")) || (localSvgOut && localSvgOut.startsWith("-"))) {
      process.stderr.write(`[capture-flamegraph] host/user/key/local-svg-out 不得以 \`-\` 起首(防 scp 选项注入) · 跳过 SVG 落本地\n`);
      process.exit(0);
    }
    // mkdir -p 本地目录
    try {
      mkdirSync(dirname(localSvgOut), { recursive: true });
    } catch (e) {
      process.stderr.write(`[capture-flamegraph] 无法创建本地目录 ${dirname(localSvgOut)}: ${e.message}\n`);
      process.exit(0);
    }
    // 用 scp 拉 · 复用 ssh.mjs 已建的 ControlMaster socket(避免重新 auth)
    // ControlPath 与 cli-ssh.ts/controlPathFor 对齐:优先 ~/.ssh/perf-kp-sql/(0700)
    // 复用 perf-kp-sql 早先建立的 ControlMaster socket(同 hash)。长 HOME 回退 /tmp。
    const portNum = port ? parseInt(port, 10) : 22;
    const cpHash = createHash("sha1").update(`${host}:${portNum}:${user}`).digest("hex").slice(0, 12);
    const sshDir = join(homedir(), ".ssh", "perf-kp-sql");
    const sshPath = join(sshDir, `cm-${cpHash}.sock`);
    let controlPath;
    if (sshPath.length <= 100) {
      try {
        mkdirSync(sshDir, { recursive: true, mode: 0o700 });
        controlPath = sshPath;
      } catch {
        controlPath = join(tmpdir(), `perf-kp-sql-cm-${cpHash}.sock`);
      }
    } else {
      controlPath = join(tmpdir(), `perf-kp-sql-cm-${cpHash}.sock`);
    }
    const scpArgs = [
      "-o", `ControlPath=${controlPath}`,
      "-o", "StrictHostKeyChecking=accept-new",
    ];
    if (port) scpArgs.push("-P", port);
    if (key) scpArgs.push("-i", key);
    // `--` 终止 scp 选项解析,防 user/host/path 起首 `-` 触发 -oProxyCommand 注入
    scpArgs.push("--", `${user}@${host}:${serverSvgPath}`, localSvgOut);
    const scpRes = spawnSync("scp", scpArgs, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
    if (scpRes.status === 0) {
      process.stderr.write(`[capture-flamegraph] SVG 已落本地: ${localSvgOut}\n`);
    } else {
      // 复用 ControlMaster 失败时(过期 / cpu-flamegraph 用了不同 socket) · 给一行提示让 LLM 用 ssh.mjs 兜底
      process.stderr.write(`[capture-flamegraph] scp 失败 (exit=${scpRes.status}) · stderr: ${scpRes.stderr?.slice(0, 200)}\n`);
      process.stderr.write(`[capture-flamegraph] 可以让 LLM 在 SKILL.md 里手动跑 scp/mv 兜底 · 远端 SVG 路径: ${serverSvgPath}\n`);
    }
    process.exit(0);
  });
}
