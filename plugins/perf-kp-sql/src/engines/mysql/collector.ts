/**
 * mysql-collector — 解析 MySQL dbBatchTemplate 输出。
 * 输出格式由 data/collect-cmds.json 的 mysql template 规定:
 *   ###VERSION###       ← SELECT VERSION() 结果,1 行
 *   ###VARIABLES###     ← SHOW GLOBAL VARIABLES 结果,多行 name\tvalue
 *   ###STATUS###        ← SHOW GLOBAL STATUS 结果,多行 name\tvalue
 *   ###PROCESSLIST###   ← information_schema.PROCESSLIST,多行 tab-separated
 *   ###SCHEMA_STATS###  ← schema 大小聚合,多行
 *
 * 产物是一个 db_metrics Record,供 mysql-checks 使用。
 */

export interface MysqlMetrics extends Record<string, unknown> {
  version?: string;
  variables?: Record<string, string>;
  status?: Record<string, string>;
  processlist?: Array<{
    id: string;
    user: string;
    host: string;
    db: string;
    command: string;
    time: number;
    state: string;
    info: string;
  }>;
  schema_stats?: Array<{ schema: string; tables: number; total_mb: number }>;
  _db_collection_failed?: boolean;
  _db_collection_error?: string;
}

export function parseMysqlStdout(stdout: string): MysqlMetrics {
  const out: MysqlMetrics = {};
  if (!stdout || stdout.trim().length === 0) {
    out._db_collection_failed = true;
    out._db_collection_error = "mysql 返回空输出";
    return out;
  }
  const sections = splitSections(stdout);
  out.version = (sections.VERSION || [])[0]?.trim();
  out.variables = parseKV(sections.VARIABLES || []);
  out.status = parseKV(sections.STATUS || []);
  out.processlist = parseProcesslist(sections.PROCESSLIST || []);
  out.schema_stats = parseSchemaStats(sections.SCHEMA_STATS || []);
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
    if (current && line.trim()) sections[current].push(line);
  }
  return sections;
}

function parseKV(lines: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length >= 2) {
      out[parts[0].trim()] = parts.slice(1).join("\t").trim();
    }
  }
  return out;
}

function parseProcesslist(lines: string[]): MysqlMetrics["processlist"] {
  return lines.map((line) => {
    const parts = line.split("\t");
    return {
      id: parts[0] || "",
      user: parts[1] || "",
      host: parts[2] || "",
      db: parts[3] || "",
      command: parts[4] || "",
      time: Number.parseInt(parts[5] || "0", 10) || 0,
      state: parts[6] || "",
      info: parts[7] || "",
    };
  });
}

function parseSchemaStats(lines: string[]): MysqlMetrics["schema_stats"] {
  return lines.map((line) => {
    const parts = line.split("\t");
    return {
      schema: parts[0] || "",
      tables: Number.parseInt(parts[1] || "0", 10) || 0,
      total_mb: Number.parseFloat(parts[2] || "0") || 0,
    };
  });
}
