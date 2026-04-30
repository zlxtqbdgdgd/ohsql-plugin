#!/usr/bin/env node
// capture-flamegraph.mjs
// 自定位 + 跨 harness 解析 cpu-flamegraph 插件 root，再透传给 capture.mjs。
// 用意 1：把"找 cpu-flamegraph 邻居插件"这件事从 SKILL.md 抽出来，
//   加新 agent 时 SKILL.md 不动；最坏情况只在 candidates 里加一行。
// 用意 2：duration 强制 clamp · 防 LLM 自由发挥拉到 30s/60s。
//   诊断场景默认 3s 已足够命中 stack-pattern；超 10s 必须显式 --allow-long-duration
//   opt-in（需要用户明确要求长窗口 / off-cpu 长尾分析）。

import { existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { homedir } from "node:os";

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
const cleanedArgs = rawArgs.filter((a) => a !== "--allow-long-duration");

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
const child = spawn(process.execPath, [captureScript, ...cleanedArgs], { stdio: "inherit" });
child.on("error", (e) => {
  process.stderr.write(JSON.stringify({ ok: false, err: `spawn failed: ${e.message}`, captureScript }) + "\n");
  process.exit(2);
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
