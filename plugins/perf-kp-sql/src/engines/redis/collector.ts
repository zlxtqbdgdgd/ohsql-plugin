/**
 * redis-collector — 解析 Redis dbBatchTemplate 输出。
 * 输出格式:
 *   ###INFO###       ← redis-cli INFO all 的 key:value 段
 *   ###CONFIG###     ← redis-cli CONFIG GET '*' 的 key\nvalue 交替
 *   ###SLOWLOG###    ← redis-cli SLOWLOG GET 10 的嵌套数组输出
 *   ###CLIENT###     ← CLIENT LIST 输出
 *   ###MEMORY###     ← MEMORY STATS
 *   ###BIGKEYS_SAMPLE### ← redis-cli --bigkeys tail 30
 */

export interface RedisMetrics extends Record<string, unknown> {
  info?: Record<string, string>;
  config?: Record<string, string>;
  slowlog?: Array<{ id: string; ts: number; duration_us: number; cmd: string }>;
  client_count?: number;
  memory?: Record<string, string>;
  bigkeys_summary?: string;
  _db_collection_failed?: boolean;
  _db_collection_error?: string;
}

export function parseRedisStdout(stdout: string): RedisMetrics {
  const out: RedisMetrics = {};
  if (!stdout || stdout.trim().length === 0) {
    out._db_collection_failed = true;
    out._db_collection_error = "redis-cli 返回空输出";
    return out;
  }
  const sections = splitSections(stdout);
  out.info = parseInfo(sections.INFO || []);
  out.config = parseConfigGet(sections.CONFIG || []);
  out.slowlog = parseSlowlog(sections.SLOWLOG || []);
  out.client_count = (sections.CLIENT || []).length;
  out.memory = parseInfo(sections.MEMORY || []); // MEMORY STATS output 近似 INFO 格式
  out.bigkeys_summary = (sections.BIGKEYS_SAMPLE || []).join("\n");
  return out;
}

function splitSections(stdout: string): Record<string, string[]> {
  const lines = stdout.split("\n");
  const sections: Record<string, string[]> = {};
  let current: string | null = null;
  for (const line of lines) {
    const m = /^###([A-Z_]+)###\s*$/.exec(line.trim());
    if (m) {
      current = m[1];
      sections[current] = [];
      continue;
    }
    if (current) sections[current].push(line);
  }
  return sections;
}

function parseInfo(lines: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx > 0) out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

/** CONFIG GET '*' → 成对输出:k 值 k 值 … */
function parseConfigGet(lines: string[]): Record<string, string> {
  const cleaned = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  const out: Record<string, string> = {};
  for (let i = 0; i < cleaned.length - 1; i += 2) {
    out[cleaned[i]] = cleaned[i + 1];
  }
  return out;
}

/**
 * SLOWLOG GET 10 的 redis-cli --no-raw 输出形如:
 *   1) 1) (integer) 42
 *      2) (integer) 1713456789
 *      3) (integer) 123456
 *      4) 1) "KEYS"
 *         2) "*"
 * 简化解析:按 " N) (integer)" 前缀抓取。
 */
function parseSlowlog(lines: string[]): Array<{ id: string; ts: number; duration_us: number; cmd: string }> {
  const entries: Array<{ id: string; ts: number; duration_us: number; cmd: string }> = [];
  let cur: { id: string; ts: number; duration_us: number; cmd: string } | null = null;
  let intCounter = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^\d+\)/.test(line) && !/\(integer\)/.test(line)) {
      // Entry start
      if (cur) entries.push(cur);
      cur = { id: "", ts: 0, duration_us: 0, cmd: "" };
      intCounter = 0;
      continue;
    }
    const intMatch = /\(integer\)\s+(\d+)/.exec(line);
    if (intMatch && cur) {
      const n = Number.parseInt(intMatch[1], 10);
      if (intCounter === 0) cur.id = String(n);
      if (intCounter === 1) cur.ts = n;
      if (intCounter === 2) cur.duration_us = n;
      intCounter++;
      continue;
    }
    // Command strings (quoted)
    const strMatch = /^\d+\)\s+"(.+)"\s*$/.exec(line);
    if (strMatch && cur) {
      cur.cmd = cur.cmd ? `${cur.cmd} ${strMatch[1]}` : strMatch[1];
    }
  }
  if (cur) entries.push(cur);
  return entries;
}
