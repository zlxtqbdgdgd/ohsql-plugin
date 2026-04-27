#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath as __fileURLToPath } from "url";
import { dirname as __pathDirname } from "path";
const require = createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __pathDirname(__filename);

// skills/perf-kp-sql/src/cli-save-history.ts
import { homedir } from "node:os";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
var MAX_ENTRIES = 5;
function historyPath() {
  return process.env.OHSQL_PERF_KP_SQL_HISTORY ?? join(homedir(), ".ohsql", "perf-kp-sql", "hosts.json");
}
async function readHistory(path) {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.hosts)) return { hosts: [] };
    return parsed;
  } catch {
    return { hosts: [] };
  }
}
function mergeHistory(current, entry, now, max = MAX_ENTRIES) {
  const list = [...current.hosts];
  const idx = list.findIndex(
    (h) => h.host === entry.host && h.user === entry.user && h.port === entry.port
  );
  const credPatch = {};
  if (entry.password !== void 0 && entry.password !== "") credPatch.password = entry.password;
  if (entry.privateKeyPath !== void 0 && entry.privateKeyPath !== "") credPatch.privateKeyPath = entry.privateKeyPath;
  if (entry.mongo_user !== void 0 && entry.mongo_user !== "") credPatch.mongo_user = entry.mongo_user;
  if (entry.mongo_password !== void 0 && entry.mongo_password !== "") credPatch.mongo_password = entry.mongo_password;
  if (entry.auth_db !== void 0 && entry.auth_db !== "") credPatch.auth_db = entry.auth_db;
  if (idx >= 0) {
    const existing = list[idx];
    list[idx] = {
      ...existing,
      engine: entry.engine,
      last_used: now,
      use_count: (existing.use_count ?? 0) + 1,
      ...credPatch
    };
  } else {
    list.push({
      host: entry.host,
      user: entry.user,
      port: entry.port,
      engine: entry.engine,
      last_used: now,
      use_count: 1,
      ...credPatch
    });
  }
  list.sort((a, b) => {
    const ta = Date.parse(a.last_used) || 0;
    const tb = Date.parse(b.last_used) || 0;
    return tb - ta;
  });
  return { hosts: list.slice(0, Math.max(1, max)) };
}
async function writeHistory(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
  try {
    await chmod(path, 384);
  } catch {
  }
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
  const host = typeof argv.host === "string" ? argv.host.trim() : "";
  const user = typeof argv.user === "string" ? argv.user.trim() : "";
  const portRaw = typeof argv.port === "string" ? argv.port.trim() : "";
  const engine = typeof argv.engine === "string" ? argv.engine.trim() : "";
  const password = typeof argv.password === "string" ? argv.password : void 0;
  const privateKeyPath = typeof argv["private-key-path"] === "string" ? argv["private-key-path"] : void 0;
  const mongo_user = typeof argv["mongo-user"] === "string" ? argv["mongo-user"] : void 0;
  const mongo_password = typeof argv["mongo-password"] === "string" ? argv["mongo-password"] : void 0;
  const auth_db = typeof argv["auth-db"] === "string" ? argv["auth-db"] : void 0;
  if (!host) writeError("missing --host");
  if (!user) writeError("missing --user");
  if (!portRaw) writeError("missing --port");
  if (!engine) writeError("missing --engine");
  const port = parseInt(portRaw, 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    writeError(`invalid --port: ${portRaw}`);
  }
  const path = historyPath();
  const current = await readHistory(path);
  const merged = mergeHistory(
    current,
    { host, user, port, engine, password, privateKeyPath, mongo_user, mongo_password, auth_db },
    (/* @__PURE__ */ new Date()).toISOString()
  );
  await writeHistory(path, merged);
  process.stdout.write(JSON.stringify({ ok: true, total: merged.hosts.length }));
}
var isCli = (() => {
  try {
    const entry = process.argv[1] ?? "";
    return /(^|[\\/])save-history\.(mjs|js|ts)$/.test(entry) || /cli-save-history/.test(entry);
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
  mergeHistory,
  readHistory,
  writeHistory
};
