/**
 * cli-history — SSH 连接历史的读写入口(load + save 合并)
 *
 * 用法:
 *   node history.mjs --op load [--max <N>]
 *   node history.mjs --op save --host <ip> --user <name> --port <N> --engine <e>
 *                              [--password <p>] [--private-key-path <k>]
 *                              [--mongo-user <u>] [--mongo-password <p>] [--auth-db <d>]
 *
 * load 输出(stdout 一行 JSON):
 *   { ok: true, hosts: [ { host, user, port, engine, last_used, use_count, ... } ] }
 *
 * save 行为:
 *   - 读 hosts.json · 不存在则空表
 *   - (host, user, port) 三元组匹配则 use_count++ · last_used=now · 凭据非空才覆盖
 *   - 否则 push 新条目
 *   - 按 last_used 降序 · 截至前 5 条
 *   - 写回(parent dir 自动创建)· chmod 0600
 *   - stdout 一行 JSON {ok:true, total:N}
 *
 * 路径解析:
 *   1. $PERF_KP_SQL_HOME 设了 · 文件 = $PERF_KP_SQL_HOME/hosts.json
 *   2. 否则 · ~/.perf-kp-sql/hosts.json (默认 · harness-neutral · 跟 notebooklm.json 同根)
 *
 * 多 harness 约束:user runtime data 不接 ${CLAUDE_PLUGIN_DATA} / ${CODEX_PLUGIN_DATA}
 *   等 harness-specific env var · 否则同一用户在不同 harness 下 hosts.json 分裂。
 *
 * v0.5.1 · 用户授权存凭据(passwords / mongo auth) · hosts.json chmod 0600 ·
 *          load 输出包含全部凭据字段 · LLM 不再走 prose Q&A 单点问。
 *
 * 业界对照:openssh `~/.ssh/known_hosts` · MySQL Workbench Recent Connections ·
 * Termius / SecureCRT recent hosts。
 */

import { homedir } from "node:os";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * v0.49.0 · 环境画像缓存 · 跟连接信息一起持久化 · 复用时让用户能区分多台机器
 * 字段全可选 · 缺哪个写哪个 · 兼容旧 hosts.json(无此字段视为 undefined)。
 */
export interface EnvContext {
  os_kernel?: string;
  os_distro?: string;
  arch?: string;
  cpu_vendor?: string;
  cpu_model?: string;
  cpu_count?: number;
  numa_nodes?: number;
  mem_total?: string;
  mongod_version?: string;
  deploy_form?: string;
  is_container?: string;
}

export interface HostEntry {
  host: string;
  user: string;
  port: number;
  engine: string;
  last_used: string;
  use_count: number;
  password?: string;
  privateKeyPath?: string;
  mongo_user?: string;
  mongo_password?: string;
  auth_db?: string;
  // v0.49.0 · cached env from last successful Phase 0.7 probe
  env?: EnvContext;
  env_captured_at?: string;
}

export interface HistoryFile {
  hosts: HostEntry[];
}

export type CredentialFields = Pick<HostEntry, "password" | "privateKeyPath" | "mongo_user" | "mongo_password" | "auth_db">;

const MAX_ENTRIES = 5;

export function historyPath(): string {
  const home = process.env.PERF_KP_SQL_HOME;
  if (home) return join(home, "hosts.json");
  return join(homedir(), ".perf-kp-sql", "hosts.json");
}

export async function loadHistory(path: string): Promise<HistoryFile> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as HistoryFile;
    if (!parsed || !Array.isArray(parsed.hosts)) return { hosts: [] };
    return parsed;
  } catch {
    return { hosts: [] };
  }
}

/** Alias 保留 · 老 cli-save-history 调用方/测试用名 */
export const readHistory = loadHistory;

export function sortAndCap(hosts: HostEntry[], max: number): HostEntry[] {
  const copy = [...hosts];
  copy.sort((a, b) => {
    const ta = Date.parse(a.last_used) || 0;
    const tb = Date.parse(b.last_used) || 0;
    return tb - ta;
  });
  return copy.slice(0, Math.max(0, max));
}

/**
 * 纯函数 · 把新条目 merge 进 hosts · 按 last_used 降序裁到 MAX_ENTRIES。
 * 既存条目(host+user+port 三元组匹配)的 use_count++ · last_used=now ·
 * engine 跟新值同步(用户切引擎不要僵在旧值)。
 *
 * v0.5.1 · 凭据(password / privateKeyPath / mongo_*  / auth_db)仅当本次传入非空才
 *          覆盖既存值 · 避免 SSH 重新认证时擦掉 mongo_password。
 */
export function mergeHistory(
  current: HistoryFile,
  entry: { host: string; user: string; port: number; engine: string } & Partial<CredentialFields> & {
    env?: EnvContext;
  },
  now: string,
  max: number = MAX_ENTRIES,
): HistoryFile {
  const list = [...current.hosts];
  const idx = list.findIndex(
    (h) => h.host === entry.host && h.user === entry.user && h.port === entry.port,
  );

  const credPatch: Partial<CredentialFields> = {};
  if (entry.password !== undefined && entry.password !== "") credPatch.password = entry.password;
  if (entry.privateKeyPath !== undefined && entry.privateKeyPath !== "") credPatch.privateKeyPath = entry.privateKeyPath;
  if (entry.mongo_user !== undefined && entry.mongo_user !== "") credPatch.mongo_user = entry.mongo_user;
  if (entry.mongo_password !== undefined && entry.mongo_password !== "") credPatch.mongo_password = entry.mongo_password;
  if (entry.auth_db !== undefined && entry.auth_db !== "") credPatch.auth_db = entry.auth_db;

  // v0.49.0 · env 字段 · 仅当本次传入非空 object 才覆盖 · env_captured_at 同步刷新
  const envPatch: { env?: EnvContext; env_captured_at?: string } = {};
  if (entry.env !== undefined && Object.keys(entry.env).length > 0) {
    envPatch.env = entry.env;
    envPatch.env_captured_at = now;
  }

  if (idx >= 0) {
    const existing = list[idx]!;
    list[idx] = {
      ...existing,
      engine: entry.engine,
      last_used: now,
      use_count: (existing.use_count ?? 0) + 1,
      ...credPatch,
      ...envPatch,
    };
  } else {
    list.push({
      host: entry.host,
      user: entry.user,
      port: entry.port,
      engine: entry.engine,
      last_used: now,
      use_count: 1,
      ...credPatch,
      ...envPatch,
    });
  }

  list.sort((a, b) => {
    const ta = Date.parse(a.last_used) || 0;
    const tb = Date.parse(b.last_used) || 0;
    return tb - ta;
  });

  return { hosts: list.slice(0, Math.max(1, max)) };
}

export async function writeHistory(path: string, data: HistoryFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
  // v0.5.1 · 凭据落盘 · 强制 0600 · 仅本用户可读写
  try {
    await chmod(path, 0o600);
  } catch {
    // 部分文件系统(SMB / FAT)不支持 chmod · 忽略不阻塞主流程
  }
}

// ---------------------------------------------------------------------------
// CLI plumbing
// ---------------------------------------------------------------------------

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

function writeError(msg: string): never {
  process.stdout.write(JSON.stringify({ ok: false, error: msg }));
  process.exit(1);
}

async function runLoad(argv: Record<string, string | boolean>): Promise<void> {
  const maxRaw = argv.max;
  const max = typeof maxRaw === "string" ? parseInt(maxRaw, 10) || 5 : 5;
  const path = historyPath();
  const hist = await loadHistory(path);
  const hosts = sortAndCap(hist.hosts, max);
  process.stdout.write(JSON.stringify({ ok: true, hosts }));
}

async function runSave(argv: Record<string, string | boolean>): Promise<void> {
  const host = typeof argv.host === "string" ? argv.host.trim() : "";
  const user = typeof argv.user === "string" ? argv.user.trim() : "";
  const portRaw = typeof argv.port === "string" ? argv.port.trim() : "";
  const engine = typeof argv.engine === "string" ? argv.engine.trim() : "";

  // v0.5.1 · 可选凭据(用户授权后存)· 不传则不覆盖既存
  const password = typeof argv.password === "string" ? argv.password : undefined;
  const privateKeyPath = typeof argv["private-key-path"] === "string" ? argv["private-key-path"] : undefined;
  const mongo_user = typeof argv["mongo-user"] === "string" ? argv["mongo-user"] : undefined;
  const mongo_password = typeof argv["mongo-password"] === "string" ? argv["mongo-password"] : undefined;
  const auth_db = typeof argv["auth-db"] === "string" ? argv["auth-db"] : undefined;

  // v0.49.0 · 可选 env 缓存(JSON string · 来自 Phase 0.7 probe 解析后的 [环境上下文])
  let env: EnvContext | undefined;
  if (typeof argv.env === "string") {
    try {
      const parsed = JSON.parse(argv.env);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        env = parsed as EnvContext;
      } else {
        writeError(`invalid --env: not a JSON object`);
      }
    } catch (e) {
      writeError(`invalid --env: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (!host) writeError("missing --host");
  if (!user) writeError("missing --user");
  if (!portRaw) writeError("missing --port");
  if (!engine) writeError("missing --engine");

  const port = parseInt(portRaw, 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    writeError(`invalid --port: ${portRaw}`);
  }

  const path = historyPath();
  const current = await loadHistory(path);
  const merged = mergeHistory(
    current,
    { host, user, port, engine, password, privateKeyPath, mongo_user, mongo_password, auth_db, env },
    new Date().toISOString(),
  );
  await writeHistory(path, merged);

  process.stdout.write(JSON.stringify({ ok: true, total: merged.hosts.length }));
}

async function main(): Promise<void> {
  const argv = parseArgs(process.argv.slice(2));
  const op = typeof argv.op === "string" ? argv.op : "";
  if (op === "load") return runLoad(argv);
  if (op === "save") return runSave(argv);
  writeError(`unknown --op: ${op || "(missing)"} · expect: load | save`);
}

const isCli = (() => {
  try {
    const entry = process.argv[1] ?? "";
    // v0.49.0 · 排除 *.test.ts / *.spec.ts 等测试文件 · 避免被 import 时副作用执行 main()
    if (/\.(test|spec)\.(mjs|js|ts)$/.test(entry)) return false;
    return /(^|[\\/])history\.(mjs|js|ts)$/.test(entry) || /cli-history/.test(entry);
  } catch {
    return false;
  }
})();

if (isCli) {
  main().catch((err) => {
    writeError(err instanceof Error ? err.message : String(err));
  });
}
