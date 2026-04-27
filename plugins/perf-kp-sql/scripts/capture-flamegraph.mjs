#!/usr/bin/env node
// capture-flamegraph.mjs
// 自定位 + 跨 harness 解析 cpu-flamegraph 插件 root，再透传给 capture.mjs。
// 用意：把"找 cpu-flamegraph 邻居插件"这件事从 SKILL.md 抽出来，
// 加新 agent 时 SKILL.md 不动；最坏情况只在 candidates 里加一行。

import { existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { homedir } from "node:os";

const DEP_NAME = "cpu-flamegraph";
const REL_CAPTURE = join("skills", DEP_NAME, "scripts", "capture.mjs");

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

const captureScript = join(flameRoot, REL_CAPTURE);
const child = spawn(process.execPath, [captureScript, ...process.argv.slice(2)], { stdio: "inherit" });
child.on("error", (e) => {
  process.stderr.write(JSON.stringify({ ok: false, err: `spawn failed: ${e.message}`, captureScript }) + "\n");
  process.exit(2);
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
