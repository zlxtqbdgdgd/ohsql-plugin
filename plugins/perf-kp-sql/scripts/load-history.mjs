#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath as __fileURLToPath } from "url";
import { dirname as __pathDirname } from "path";
const require = createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __pathDirname(__filename);

// skills/perf-kp-sql/src/cli-load-history.ts
import { homedir } from "node:os";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
function historyPath() {
  return process.env.OHSQL_PERF_KP_SQL_HISTORY ?? join(homedir(), ".ohsql", "perf-kp-sql", "hosts.json");
}
async function loadHistory(path) {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.hosts)) return { hosts: [] };
    return parsed;
  } catch {
    return { hosts: [] };
  }
}
function sortAndCap(hosts, max) {
  const copy = [...hosts];
  copy.sort((a, b) => {
    const ta = Date.parse(a.last_used) || 0;
    const tb = Date.parse(b.last_used) || 0;
    return tb - ta;
  });
  return copy.slice(0, Math.max(0, max));
}
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
function writeError(msg) {
  process.stdout.write(JSON.stringify({ ok: false, error: msg }));
  process.exit(1);
}
async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const maxRaw = argv.max;
  const max = typeof maxRaw === "string" ? parseInt(maxRaw, 10) || 5 : 5;
  const path = historyPath();
  const hist = await loadHistory(path);
  const hosts = sortAndCap(hist.hosts, max);
  process.stdout.write(JSON.stringify({ ok: true, hosts }));
}
var isCli = (() => {
  try {
    const entry = process.argv[1] ?? "";
    return /(^|[\\/])load-history\.(mjs|js|ts)$/.test(entry) || /cli-load-history/.test(entry);
  } catch {
    return false;
  }
})();
if (isCli) {
  main().catch((err) => {
    writeError(err instanceof Error ? err.message : String(err));
  });
}
export {
  historyPath,
  loadHistory,
  sortAndCap
};
