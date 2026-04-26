#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath as __fileURLToPath } from "url";
import { dirname as __pathDirname } from "path";
const require = createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __pathDirname(__filename);

// skills/perf-kp-sql/src/cli-query-kb.ts
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { realpathSync } from "node:fs";
function packVersion(major, minor, patch) {
  return major * 1e6 + minor * 1e3 + patch;
}
function parseVersion(display) {
  const m = display.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) throw new Error(`invalid version string: ${display}`);
  return packVersion(Number(m[1]), Number(m[2]), Number(m[3]));
}
function unpackVersion(packed) {
  const major = Math.floor(packed / 1e6);
  const minor = Math.floor(packed % 1e6 / 1e3);
  const patch = packed % 1e3;
  return `${major}.${minor}.${patch}`;
}
var SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id TEXT NOT NULL,
  fact_type TEXT NOT NULL,
  wait_class TEXT,
  category TEXT,
  severity_modifier TEXT,
  engine TEXT NOT NULL DEFAULT 'any',
  engine_version_min_packed INTEGER,
  engine_version_max_packed INTEGER,
  engine_version_min_display TEXT,
  engine_version_max_display TEXT,
  arch TEXT, vendor TEXT, os TEXT,
  content_zh TEXT, content_en TEXT,
  language TEXT NOT NULL DEFAULT 'zh',
  source_url TEXT NOT NULL,
  source_authority TEXT,
  quote TEXT,
  confidence REAL DEFAULT 1.0,
  scraped_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deprecated_at TEXT,
  content_hash TEXT NOT NULL,
  -- v0.4.0 \xB7 flame graph \u4E24\u5C42\u5B57\u5178\u6269\u5C55
  semantic_group TEXT,
  flame_pattern_regex TEXT,
  grade INTEGER,
  UNIQUE(content_hash)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_rule ON knowledge(rule_id, fact_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_wait ON knowledge(wait_class, engine);
CREATE INDEX IF NOT EXISTS idx_knowledge_ver  ON knowledge(engine, engine_version_min_packed, engine_version_max_packed);
CREATE INDEX IF NOT EXISTS idx_knowledge_sem  ON knowledge(semantic_group) WHERE semantic_group IS NOT NULL;

-- trigram \u5206\u8BCD: \u5BF9\u4E2D\u6587/\u4EE3\u7801/short-token \u6DF7\u5408\u5185\u5BB9 \xB7 \u53EC\u56DE\u7A33\u5065 (sqlite 3.34+)
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  rule_id UNINDEXED, engine UNINDEXED, wait_class UNINDEXED,
  content_zh, content_en, quote,
  tokenize = 'trigram'
);

-- vec0 \xB7 384 \u7EF4\u5411\u91CF ANN \xB7 id \u548C knowledge.id \u4E00\u4E00\u5BF9\u5E94
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vec USING vec0(
  id INTEGER PRIMARY KEY,
  embedding FLOAT[384]
);
`;
function openKb(dbPath, opts = {}) {
  const readonly = opts.readonly ?? false;
  const db = new Database(dbPath, { readonly, fileMustExist: readonly });
  sqliteVec.load(db);
  if (!readonly) db.pragma("journal_mode = WAL");
  return db;
}
function initSchema(db) {
  db.exec(SCHEMA_SQL);
}
function ftsSearch(db, opts, limit) {
  if (!opts.q || !opts.q.trim()) return [];
  const where = [`knowledge_fts MATCH ?`];
  const params = [escapeFtsQuery(opts.q)];
  if (opts.ruleId) {
    where.push(`rule_id = ?`);
    params.push(opts.ruleId);
  }
  if (opts.engine) {
    where.push(`(engine = ? OR engine = 'any')`);
    params.push(opts.engine);
  }
  if (opts.waitClass) {
    where.push(`wait_class = ?`);
    params.push(opts.waitClass);
  }
  const sql = `
    SELECT rowid AS id, rank
    FROM knowledge_fts
    WHERE ${where.join(" AND ")}
    ORDER BY rank
    LIMIT ?`;
  params.push(limit);
  const rows = db.prepare(sql).all(...params);
  return rows.map((r, i) => ({ id: r.id, rank: i + 1 }));
}
function escapeFtsQuery(q) {
  const cleaned = q.replace(/[()*+\-^\\]/g, " ");
  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return "";
  const tokens = [];
  for (const w of rawTokens) {
    if (/^[A-Za-z0-9_][\w.]*$/.test(w)) {
      tokens.push(w);
      continue;
    }
    let buf = "";
    for (let i = 0; i < w.length; i++) {
      const c = w[i];
      const isCJK = /[\u4e00-\u9fa5]/.test(c);
      if (!isCJK) {
        buf += c;
        continue;
      }
      if (buf) {
        tokens.push(buf);
        buf = "";
      }
      if (i + 2 < w.length && /[\u4e00-\u9fa5]/.test(w[i + 1]) && /[\u4e00-\u9fa5]/.test(w[i + 2])) {
        tokens.push(w.slice(i, i + 3));
      } else if (i + 1 < w.length && /[\u4e00-\u9fa5]/.test(w[i + 1])) {
        tokens.push(w.slice(i, i + 2));
      } else {
        tokens.push(c);
      }
    }
    if (buf) tokens.push(buf);
  }
  const uniq = Array.from(new Set(tokens)).slice(0, 20);
  return uniq.map((t) => `"${t.replace(/"/g, '""')}"`).join(" OR ");
}
var VEC_MAX_DISTANCE = 1.15;
var VEC_OUT_OF_SCOPE_DISTANCE = 1;
function vecSearch(db, opts, limit) {
  if (!opts.qVector || opts.qVector.length !== 384) return { ranks: [], topDistance: null };
  const blob = Buffer.from(new Float32Array(opts.qVector).buffer);
  const rows = db.prepare(`
    SELECT id, distance
    FROM knowledge_vec
    WHERE embedding MATCH ? AND k = ?
    ORDER BY distance
  `).all(blob, limit);
  if (rows.length === 0) return { ranks: [], topDistance: null };
  const topDistance = rows[0].distance;
  if (opts.q && topDistance > VEC_MAX_DISTANCE) return { ranks: [], topDistance };
  const normalized = rows.map((r) => ({ id: Number(r.id), distance: r.distance }));
  const ids = normalized.map((r) => r.id);
  const extra = [];
  const extraParams = [];
  if (opts.ruleId) {
    extra.push(`rule_id = ?`);
    extraParams.push(opts.ruleId);
  }
  if (opts.engine) {
    extra.push(`(engine = ? OR engine = 'any')`);
    extraParams.push(opts.engine);
  }
  if (opts.waitClass) {
    extra.push(`wait_class = ?`);
    extraParams.push(opts.waitClass);
  }
  if (opts.engineVersion) {
    const v = parseVersion(opts.engineVersion);
    extra.push(`(engine_version_min_packed IS NULL OR engine_version_min_packed <= ?)`);
    extra.push(`(engine_version_max_packed IS NULL OR engine_version_max_packed >= ?)`);
    extraParams.push(v, v);
  }
  if (extra.length === 0) {
    return { ranks: normalized.map((r, i) => ({ id: r.id, rank: i + 1 })), topDistance };
  }
  const placeholders = ids.map(() => "?").join(",");
  const filteredRows = db.prepare(
    `SELECT id FROM knowledge WHERE id IN (${placeholders}) AND ${extra.join(" AND ")}`
  ).all(...ids, ...extraParams);
  const allowed = new Set(filteredRows.map((r) => r.id));
  return { ranks: normalized.filter((r) => allowed.has(r.id)).map((r, i) => ({ id: r.id, rank: i + 1 })), topDistance };
}
var FTS_RANK1_BOOST = 2.5;
function rrfFuse(fts, vec, k = 60) {
  const out = /* @__PURE__ */ new Map();
  for (const r of fts) {
    const prev = out.get(r.id) ?? { id: r.id, score: 0, fts_rank: null, vec_rank: null };
    prev.fts_rank = r.rank;
    const w = r.rank === 1 ? FTS_RANK1_BOOST : 1;
    prev.score += w / (k + r.rank);
    out.set(r.id, prev);
  }
  for (const r of vec) {
    const prev = out.get(r.id) ?? { id: r.id, score: 0, fts_rank: null, vec_rank: null };
    prev.vec_rank = r.rank;
    prev.score += 1 / (k + r.rank);
    out.set(r.id, prev);
  }
  return out;
}
function flameMatch(db, fnName, opts = {}) {
  const where = [`flame_pattern_regex IS NOT NULL`];
  const params = [];
  if (opts.engine) {
    where.push(`(engine = ? OR engine = 'any')`);
    params.push(opts.engine);
  }
  if (opts.engineVersion) {
    const v = parseVersion(opts.engineVersion);
    where.push(`(engine_version_min_packed IS NULL OR engine_version_min_packed <= ?)`);
    where.push(`(engine_version_max_packed IS NULL OR engine_version_max_packed >= ?)`);
    params.push(v, v);
  }
  const candidates = db.prepare(`SELECT * FROM knowledge WHERE ${where.join(" AND ")}`).all(...params);
  const hits = [];
  for (const c of candidates) {
    if (!c.flame_pattern_regex) continue;
    try {
      const re = new RegExp(c.flame_pattern_regex);
      if (re.test(fnName)) hits.push(c);
    } catch {
    }
  }
  return hits;
}
function moduleMatch(db, moduleName, opts = {}) {
  const engine = opts.engine ?? "mongo";
  let rows = db.prepare(`SELECT * FROM knowledge WHERE rule_id = ?`).all(`${engine}-flame-module-${moduleName}`);
  if (rows.length > 0) return rows;
  const prefix = moduleName.replace(/[-._].*$/, "");
  if (prefix && prefix !== moduleName) {
    const likePattern = `${engine}-flame-module-${prefix}%`;
    rows = db.prepare(`SELECT * FROM knowledge WHERE rule_id LIKE ?`).all(likePattern);
  }
  return rows;
}
function queryKb(db, opts) {
  const topK = opts.topK ?? 5;
  if (opts.flameFunction || opts.moduleName) {
    const results = [];
    if (opts.flameFunction) {
      const hits = flameMatch(db, opts.flameFunction, { engine: opts.engine, engineVersion: opts.engineVersion });
      for (const fact of hits) {
        results.push({ fact, fts_rank: null, vec_rank: null, rrf_score: 1 });
      }
    }
    if (results.length === 0 && opts.contextAncestors && opts.contextAncestors.length > 0) {
      for (const ancestor of opts.contextAncestors) {
        const hits = flameMatch(db, ancestor, { engine: opts.engine, engineVersion: opts.engineVersion });
        for (const fact of hits) {
          results.push({ fact, fts_rank: null, vec_rank: null, rrf_score: 0.7 });
        }
        if (results.length > 0) break;
      }
    }
    if (results.length === 0 && opts.moduleName) {
      const hits = moduleMatch(db, opts.moduleName, { engine: opts.engine });
      for (const fact of hits) {
        results.push({ fact, fts_rank: null, vec_rank: null, rrf_score: 0.5 });
      }
    }
    if (results.length > 0) {
      return results.slice(0, topK);
    }
  }
  const pool = Math.max(20, topK * 4);
  const fts = ftsSearch(db, opts, pool);
  const { ranks: vec, topDistance: vecTopDistance } = vecSearch(db, opts, pool);
  if (opts.q && fts.length === 0 && vecTopDistance !== null && vecTopDistance > VEC_OUT_OF_SCOPE_DISTANCE) {
    return [];
  }
  const fused = rrfFuse(fts, vec, opts.rrfK ?? 60);
  const ranked = [...fused.values()].sort((a, b) => b.score - a.score).slice(0, topK);
  if (ranked.length === 0 && !opts.q && !opts.qVector) {
    const where = [];
    const params = [];
    if (opts.ruleId) {
      where.push(`rule_id = ?`);
      params.push(opts.ruleId);
    }
    if (opts.engine) {
      where.push(`(engine = ? OR engine = 'any')`);
      params.push(opts.engine);
    }
    if (opts.waitClass) {
      where.push(`wait_class = ?`);
      params.push(opts.waitClass);
    }
    if (opts.engineVersion) {
      const v = parseVersion(opts.engineVersion);
      where.push(`(engine_version_min_packed IS NULL OR engine_version_min_packed <= ?)`);
      where.push(`(engine_version_max_packed IS NULL OR engine_version_max_packed >= ?)`);
      params.push(v, v);
    }
    const sql = `SELECT * FROM knowledge ${where.length ? "WHERE " + where.join(" AND ") : ""} LIMIT ?`;
    params.push(topK);
    const facts2 = db.prepare(sql).all(...params);
    return facts2.map((fact) => ({ fact, fts_rank: null, vec_rank: null, rrf_score: 0 }));
  }
  if (ranked.length === 0) return [];
  const ids = ranked.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const facts = db.prepare(`SELECT * FROM knowledge WHERE id IN (${placeholders})`).all(...ids);
  const factMap = new Map(facts.map((f) => [f.id, f]));
  return ranked.map((r) => {
    const fact = factMap.get(r.id);
    return fact ? { fact, fts_rank: r.fts_rank, vec_rank: r.vec_rank, rrf_score: r.score } : null;
  }).filter((x) => x !== null);
}
var _extractor = null;
async function embed(text, modelDir) {
  if (!_extractor) {
    const transformers = await import("@xenova/transformers");
    if (modelDir) {
      transformers.env.localModelPath = modelDir;
      transformers.env.cacheDir = modelDir;
    }
    _extractor = await transformers.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  const extractor = _extractor;
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}
async function main() {
  const { values } = parseArgs({
    options: {
      "db": { type: "string" },
      "model": { type: "string" },
      "rule-id": { type: "string" },
      "wait-class": { type: "string" },
      "engine": { type: "string" },
      "engine-version": { type: "string" },
      "q": { type: "string" },
      "top-k": { type: "string" },
      // v0.4.0 · flame graph routing
      "flame-function": { type: "string" },
      "context-ancestors": { type: "string" },
      "module": { type: "string" },
      "help": { type: "boolean", short: "h" }
    }
  });
  if (values.help) {
    process.stdout.write(
      `Usage: query-kb [options]

  --db <path>                 knowledge.sqlite path (default: <skill>/data/knowledge.sqlite)
  --model <dir>               MiniLM model cache dir (default: <skill>/data/models)
  --rule-id <id>              filter by canonical rule id
  --wait-class <class>        filter by wait class: CPU | I/O | \u5185\u5B58 | \u5E76\u53D1 | \u7F51\u7EDC
  --engine <name>             mongo | mysql | redis
  --engine-version X.Y.Z      filter by version range
  --q <text>                  natural language query (FTS5 + vec hybrid)
  --top-k <N>                 default 5

v0.4.0 flame graph routing (bypasses FTS \xB7 avoids underscore tokenization issues):
  --flame-function <name>     hot function name \xB7 matches flame_pattern_regex
  --context-ancestors a,b,c   comma-sep ancestors \xB7 used when --flame-function miss
  --module <name>             module-level fallback (mongod/libz/kernel/libc/...)

Output: JSON {query, results: [{fact, fts_rank, vec_rank, rrf_score}]}
`
    );
    return;
  }
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const skillDir = process.env.CLAUDE_SKILL_DIR ?? resolve(scriptDir, "..");
  const dbPath = values.db ?? join(skillDir, "data", "knowledge.sqlite");
  const modelDir = values.model ?? join(skillDir, "data", "models");
  const opts = {
    ruleId: values["rule-id"],
    waitClass: values["wait-class"],
    engine: values.engine,
    engineVersion: values["engine-version"],
    q: values.q,
    topK: values["top-k"] ? Number(values["top-k"]) : 5,
    flameFunction: values["flame-function"],
    contextAncestors: values["context-ancestors"]?.split(",").map((s) => s.trim()).filter(Boolean),
    moduleName: values.module
  };
  if (opts.q) {
    opts.qVector = await embed(opts.q, modelDir);
  }
  const db = openKb(dbPath, { readonly: true });
  try {
    const results = queryKb(db, opts);
    process.stdout.write(JSON.stringify({ query: opts, results }, null, 2) + "\n");
  } finally {
    db.close();
  }
}
function _getRealPathHref(p) {
  if (!p) return "";
  try {
    return pathToFileURL(realpathSync(p)).href;
  } catch {
    return pathToFileURL(p).href;
  }
}
var isMain = import.meta.url === _getRealPathHref(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    process.stderr.write(`query-kb error: ${err instanceof Error ? err.message : String(err)}
`);
    process.exit(1);
  });
}
export {
  SCHEMA_SQL,
  VEC_MAX_DISTANCE,
  VEC_OUT_OF_SCOPE_DISTANCE,
  embed,
  escapeFtsQuery,
  flameMatch,
  initSchema,
  moduleMatch,
  openKb,
  packVersion,
  parseVersion,
  queryKb,
  rrfFuse,
  unpackVersion
};
