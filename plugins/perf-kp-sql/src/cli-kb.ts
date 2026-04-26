/**
 * cli-kb — KB 操作合并入口 (query 混合检索 + stats 统计)
 *
 * 用法:
 *   node kb.mjs --op query --q "..." [--engine ...] [--top-k 5] [其他过滤]
 *   node kb.mjs --op stats --engine <mongo|mysql|redis>
 *
 * 双用途单文件 (合并自 cli-query-kb.ts + cli-kb-stats.ts):
 *   - 作为 lib: 被 tests / tools (knowledge-ledger / audit-grounding /
 *     simulate-user-queries) 导入 — schema · queryKb · embed · rrfFuse · ...
 *   - 作为 CLI: esbuild 产出 scripts/kb.mjs · SKILL.md Step 5 追问触发调用
 *
 * 架构参考 spec § 13 · v0.3.5 · 对齐 NotebookLM "Source Grounding" 范式。
 */

import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

// ============================================================================
// Schema types
// ============================================================================

/** 7 种 fact type · 覆盖一条规则的完整知识承载 (spec § 13.2) */
export type FactType =
  | "summary"      // 一句话概要
  | "mechanism"    // 根因机制
  | "trade_off"    // 修 vs 不修代价
  | "when_deviate" // 边界 / 例外
  | "threshold"    // 阈值 + 来源依据
  | "remediation"  // 修复动作 (含 fix_cost)
  | "citation";    // 原文引用 (quote + url)

/** 5 wait class · Oracle ADDM 对齐 · 性能 scope 唯一维度 (spec § 3.2a) */
export type WaitClass = "CPU" | "I/O" | "内存" | "并发" | "网络";

export interface Fact {
  id: number;
  rule_id: string;
  fact_type: FactType;
  wait_class: WaitClass | null;
  category: string | null;
  severity_modifier: string | null;
  engine: string;                          // "mongo" | "mysql" | "redis" | "any"
  engine_version_min_packed: number | null;
  engine_version_max_packed: number | null;
  engine_version_min_display: string | null;
  engine_version_max_display: string | null;
  arch: string | null;                     // "arm64" | "x86_64"
  vendor: string | null;                   // "kunpeng" | "graviton" | ...
  os: string | null;                       // "openeuler" | "ubuntu" | ...
  content_zh: string | null;
  content_en: string | null;
  language: string;                        // "zh" | "en"
  source_url: string;
  source_authority: string | null;         // "mongodb.com" | "kunpeng" | "oracle-addm" | ...
  quote: string | null;                    // 原文摘引 · 附 anchor
  confidence: number;                      // 0..1
  scraped_at: string;                      // ISO-8601
  deprecated_at: string | null;
  content_hash: string;
  // v0.4.0 · flame graph 两层字典扩展
  semantic_group: string | null;           // 语义组归属(如 wt-eviction · wt-cache)
  flame_pattern_regex: string | null;      // 正则:匹配函数名归到本 group(如 ^__wt_evict_.*)
  grade: number | null;                    // 证据等级 · 1=官方直接 · 2=源码结构推理 · 3=禁用
}

export interface QueryOptions {
  ruleId?: string;
  waitClass?: WaitClass;
  engine?: string;
  engineVersion?: string;  // "7.0.31"
  arch?: string;
  vendor?: string;
  q?: string;              // 自然语言查询 · 用 FTS5
  qVector?: number[];      // 384 维向量 · 用 vec0 · 由调用方或 CLI 内部用 embed() 生成
  topK?: number;           // 默认 5
  rrfK?: number;           // RRF 融合常数 · 默认 60
  // v0.4.0 · 火焰图 pattern match + fallback
  flameFunction?: string;          // 热点函数名 · 先走 flame_pattern_regex 精确归组
  contextAncestors?: string[];     // 调用栈祖先(含 leaf)· leaf miss 时逐个查
  moduleName?: string;             // module 归属(mongod/libz/kernel/libc 等)· 返 module-level 建议
}

export interface QueryResult {
  fact: Fact;
  fts_rank: number | null;
  vec_rank: number | null;
  rrf_score: number;
}

// ============================================================================
// Version packing · 修 '10.0.0' < '7.0.31' 字典序 bug
// ============================================================================

/** 把 (major, minor, patch) 压成可比较的 INTEGER · 对齐 spec § 13.11 */
export function packVersion(major: number, minor: number, patch: number): number {
  return major * 1_000_000 + minor * 1_000 + patch;
}

/** "7.0.31" → 7_000_031 · 非法输入抛错 */
export function parseVersion(display: string): number {
  const m = display.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) throw new Error(`invalid version string: ${display}`);
  return packVersion(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** 7_000_031 → "7.0.31" · 调试用 */
export function unpackVersion(packed: number): string {
  const major = Math.floor(packed / 1_000_000);
  const minor = Math.floor((packed % 1_000_000) / 1_000);
  const patch = packed % 1_000;
  return `${major}.${minor}.${patch}`;
}

// ============================================================================
// Canonical DDL · 单一来源 · tools/knowledge-ledger build 和 tests 共用
// ============================================================================

export const SCHEMA_SQL = `
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
  -- v0.4.0 · flame graph 两层字典扩展
  semantic_group TEXT,
  flame_pattern_regex TEXT,
  grade INTEGER,
  UNIQUE(content_hash)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_rule ON knowledge(rule_id, fact_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_wait ON knowledge(wait_class, engine);
CREATE INDEX IF NOT EXISTS idx_knowledge_ver  ON knowledge(engine, engine_version_min_packed, engine_version_max_packed);
CREATE INDEX IF NOT EXISTS idx_knowledge_sem  ON knowledge(semantic_group) WHERE semantic_group IS NOT NULL;

-- trigram 分词: 对中文/代码/short-token 混合内容 · 召回稳健 (sqlite 3.34+)
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  rule_id UNINDEXED, engine UNINDEXED, wait_class UNINDEXED,
  content_zh, content_en, quote,
  tokenize = 'trigram'
);

-- vec0 · 384 维向量 ANN · id 和 knowledge.id 一一对应
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vec USING vec0(
  id INTEGER PRIMARY KEY,
  embedding FLOAT[384]
);
`;

// ============================================================================
// KB open · 加载 vec0 扩展 · 设 WAL
// ============================================================================

export function openKb(dbPath: string, opts: { readonly?: boolean } = {}): Database.Database {
  const readonly = opts.readonly ?? false;
  const db = new Database(dbPath, { readonly, fileMustExist: readonly });
  sqliteVec.load(db);
  if (!readonly) db.pragma("journal_mode = WAL");
  return db;
}

export function initSchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
}

// ============================================================================
// FTS5 查询分支
// ============================================================================

interface RankedId { id: number; rank: number }

function ftsSearch(db: Database.Database, opts: QueryOptions, limit: number): RankedId[] {
  if (!opts.q || !opts.q.trim()) return [];
  const where: string[] = [`knowledge_fts MATCH ?`];
  const params: unknown[] = [escapeFtsQuery(opts.q)];
  if (opts.ruleId)    { where.push(`rule_id = ?`);    params.push(opts.ruleId); }
  if (opts.engine)    { where.push(`(engine = ? OR engine = 'any')`); params.push(opts.engine); }
  if (opts.waitClass) { where.push(`wait_class = ?`); params.push(opts.waitClass); }
  const sql = `
    SELECT rowid AS id, rank
    FROM knowledge_fts
    WHERE ${where.join(" AND ")}
    ORDER BY rank
    LIMIT ?`;
  params.push(limit);
  const rows = db.prepare(sql).all(...params) as Array<{ id: number; rank: number }>;
  return rows.map((r, i) => ({ id: r.id, rank: i + 1 }));
}

/**
 * FTS5 query escape · trigram 分词下 · 按空白切词 · 每词 double-quote 当字面量 · OR 连接。
 *
 * 设计取舍:
 * - 整句 phrase("foo bar baz"): 必须连续 trigram · 召回极低
 * - 词间 AND ("foo" "bar" "baz"): 所有词都得命中 · 长中文单词串(无空格)作为整体 trigram 匹配几乎必然失败 · 导致整个 AND 返 0
 * - **词间 OR**: 任一命中就返 · 再按 rank 排序 · 噪声由 hybrid 的 vec + RRF 过滤 · 召回 + 精度最优
 *
 * CJK 混英:每个空白切词再拆:
 * - 英文/数字:保留整词
 * - CJK 连续串 > 4 字:按 2-gram 切(match trigram 需 3 字 · 2-gram 覆盖更广)
 */
export function escapeFtsQuery(q: string): string {
  const cleaned = q.replace(/[()*+\-^\\]/g, " ");
  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return "";

  const tokens: string[] = [];
  for (const w of rawTokens) {
    // latin 词或含数字 · 直接保留
    if (/^[A-Za-z0-9_][\w.]*$/.test(w)) { tokens.push(w); continue; }
    // CJK 混杂 · 拆成 2-gram 和纯 latin 子串
    let buf = "";
    for (let i = 0; i < w.length; i++) {
      const c = w[i];
      const isCJK = /[\u4e00-\u9fa5]/.test(c);
      if (!isCJK) { buf += c; continue; }
      if (buf) { tokens.push(buf); buf = ""; }
      // CJK **3-gram**(FTS5 tokenize='trigram' 最小匹配单元是 3 字符 · 2-gram 根本匹不上)
      // 滑窗 3-gram:"磁盘使用率" → "磁盘使" "盘使用" "使用率"
      if (i + 2 < w.length &&
          /[\u4e00-\u9fa5]/.test(w[i + 1]) &&
          /[\u4e00-\u9fa5]/.test(w[i + 2])) {
        tokens.push(w.slice(i, i + 3));
      } else if (i + 1 < w.length && /[\u4e00-\u9fa5]/.test(w[i + 1])) {
        // 末尾 2 字 · 直接存 2-char 由 FTS phrase 搜
        tokens.push(w.slice(i, i + 2));
      } else {
        tokens.push(c);
      }
    }
    if (buf) tokens.push(buf);
  }
  // dedup · 限 20 个 · 用 OR 连接
  const uniq = Array.from(new Set(tokens)).slice(0, 20);
  return uniq.map(t => `"${t.replace(/"/g, '""')}"`).join(" OR ");
}

// ============================================================================
// vec0 查询分支
// ============================================================================

/**
 * vec 距离门 + FTS 兜底:grounded 判定的双门
 *
 * 背景:MiniLM L6-v2 多语言 384 维 · 对域外查询仍返"最近邻"· 距离通常 0.95-1.10
 *   in-scope("max_map_count"):top-1 distance 0.8 左右 · FTS 多命中
 *   边缘 in-scope("THP 怎么关"):top-1 distance ~1.02 · FTS 多命中
 *   out-of-scope("红薯好吃吗"):top-1 distance ~1.01 · FTS 通常 0 命中
 *
 * 决策:
 *   - vec 硬门 1.15:top-1 > 1.15 → vec 全丢(明显正交)
 *   - 上层 queryKb 再判:**FTS 0 命中 AND vec top-1 > 0.95 → 判 out-of-scope · 清空结果**
 *     组合双门比单门更稳(FTS 命中对 in-scope 起兜底)
 */
export const VEC_MAX_DISTANCE = 1.15;
// OOS 判定 · 调至 1.00 以兼容短 CJK query("缓存" top-1 distance 0.990 · in-scope 但 MiniLM 嵌入弱)
// 实测:"红薯"/"周杰伦" top-1 = 1.006 · 刚超 1.00 · 正确判 OOS
export const VEC_OUT_OF_SCOPE_DISTANCE = 1.00;

function vecSearch(db: Database.Database, opts: QueryOptions, limit: number): { ranks: RankedId[]; topDistance: number | null } {
  if (!opts.qVector || opts.qVector.length !== 384) return { ranks: [], topDistance: null };
  const blob = Buffer.from(new Float32Array(opts.qVector).buffer);
  const rows = db.prepare(`
    SELECT id, distance
    FROM knowledge_vec
    WHERE embedding MATCH ? AND k = ?
    ORDER BY distance
  `).all(blob, limit) as Array<{ id: number | bigint; distance: number }>;
  if (rows.length === 0) return { ranks: [], topDistance: null };
  const topDistance = rows[0]!.distance;
  // 绝对硬门 · 仅在 NL 自然语言查询(opts.q)场景触发 · 避免干扰 qVector-only 编程调用(单测场景)
  if (opts.q && topDistance > VEC_MAX_DISTANCE) return { ranks: [], topDistance };
  // vec0 返回的 id 可能是 BigInt · 归一成 number 方便后续 SQL IN 子句
  const normalized = rows.map(r => ({ id: Number(r.id), distance: r.distance }));

  // 二次过滤 · metadata (rule_id / engine / wait_class / version)
  const ids = normalized.map(r => r.id);
  const extra: string[] = [];
  const extraParams: unknown[] = [];
  if (opts.ruleId)    { extra.push(`rule_id = ?`); extraParams.push(opts.ruleId); }
  if (opts.engine)    { extra.push(`(engine = ? OR engine = 'any')`); extraParams.push(opts.engine); }
  if (opts.waitClass) { extra.push(`wait_class = ?`); extraParams.push(opts.waitClass); }
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
  ).all(...ids, ...extraParams) as Array<{ id: number }>;
  const allowed = new Set(filteredRows.map(r => r.id));
  return { ranks: normalized.filter(r => allowed.has(r.id)).map((r, i) => ({ id: r.id, rank: i + 1 })), topDistance };
}

// ============================================================================
// Reciprocal Rank Fusion · k=60 业界缺省
// ============================================================================

interface FusedEntry { id: number; score: number; fts_rank: number | null; vec_rank: number | null }

/**
 * RRF 融合 · 对 FTS rank-1 加权
 *
 * FTS rank-1 意味着查询里有精确 token 首条命中 · 信号极强 · 给 1.5× 权重
 * vec rank-1 是语义近邻 · 默认权重(1.0×)· 语义近邻竞争更常见 · 不加权
 * 其他 rank:按 RRF 原公式 1/(k+rank) 计算
 *
 * 实测收益(54 DBA queries):加 FTS rank-1 boost · top-3 命中 98.1 → 100 · 挽救"SMT 超线程"类单 token 精确查询
 */
const FTS_RANK1_BOOST = 2.5;

export function rrfFuse(fts: RankedId[], vec: RankedId[], k = 60): Map<number, FusedEntry> {
  const out = new Map<number, FusedEntry>();
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

// ============================================================================
// v0.4.0 · flame graph pattern match · 绕过 FTS5 · 直接用 regex 匹配函数名
// ============================================================================

/**
 * 根据函数名查 KB · 用 flame_pattern_regex 字段。用法:
 *   flameMatch(db, "__wt_evict_walk")
 *     → 匹配 Layer 2 fact with flame_pattern_regex="^__wt_evict_.*"(wt-eviction group)
 *
 * 返回 RRF=1.0 的高分 result · 绕过 FTS 对 underscore-heavy 英文符号分词差的问题。
 * engine / version filter 后过。
 */
export function flameMatch(db: Database.Database, fnName: string, opts: { engine?: string; engineVersion?: string } = {}): Fact[] {
  const where: string[] = [`flame_pattern_regex IS NOT NULL`];
  const params: unknown[] = [];
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
  const candidates = db.prepare(`SELECT * FROM knowledge WHERE ${where.join(" AND ")}`).all(...params) as Fact[];

  const hits: Fact[] = [];
  for (const c of candidates) {
    if (!c.flame_pattern_regex) continue;
    try {
      const re = new RegExp(c.flame_pattern_regex);
      if (re.test(fnName)) hits.push(c);
    } catch {
      // 正则格式错误 · 跳过
    }
  }
  return hits;
}

/** module fact 直查 · 支持模糊前缀匹配(如 `libpthread-2.28.so` → `libpthread-futex`)
 *  rule_id 约定 `<engine>-flame-module-<name>`
 */
export function moduleMatch(db: Database.Database, moduleName: string, opts: { engine?: string } = {}): Fact[] {
  const engine = opts.engine ?? "mongo";
  // 先试精确匹配
  let rows = db.prepare(`SELECT * FROM knowledge WHERE rule_id = ?`).all(`${engine}-flame-module-${moduleName}`) as Fact[];
  if (rows.length > 0) return rows;

  // 模糊匹配:传入 `libpthread-2.28.so` · 抽前缀 `libpthread` · 查 `<engine>-flame-module-libpthread%`
  const prefix = moduleName.replace(/[-._].*$/, "");
  if (prefix && prefix !== moduleName) {
    const likePattern = `${engine}-flame-module-${prefix}%`;
    rows = db.prepare(`SELECT * FROM knowledge WHERE rule_id LIKE ?`).all(likePattern) as Fact[];
  }
  return rows;
}

// ============================================================================
// Top-level query · 同时跑 FTS5 + vec0 · RRF 融合 · 不够时回落纯 metadata 过滤
// ============================================================================

export function queryKb(db: Database.Database, opts: QueryOptions): QueryResult[] {
  const topK = opts.topK ?? 5;

  // v0.4.0 · flame graph 路径优先 · 三层 fallback
  if (opts.flameFunction || opts.moduleName) {
    const results: QueryResult[] = [];

    if (opts.flameFunction) {
      const hits = flameMatch(db, opts.flameFunction, { engine: opts.engine, engineVersion: opts.engineVersion });
      for (const fact of hits) {
        results.push({ fact, fts_rank: null, vec_rank: null, rrf_score: 1.0 });  // pattern 直命中给满分
      }
    }

    if (results.length === 0 && opts.contextAncestors && opts.contextAncestors.length > 0) {
      for (const ancestor of opts.contextAncestors) {
        const hits = flameMatch(db, ancestor, { engine: opts.engine, engineVersion: opts.engineVersion });
        for (const fact of hits) {
          results.push({ fact, fts_rank: null, vec_rank: null, rrf_score: 0.7 });  // 祖先命中略低
        }
        if (results.length > 0) break;  // 第一个有命中就停
      }
    }

    if (results.length === 0 && opts.moduleName) {
      const hits = moduleMatch(db, opts.moduleName, { engine: opts.engine });
      for (const fact of hits) {
        results.push({ fact, fts_rank: null, vec_rank: null, rrf_score: 0.5 });  // module 粗粒度分更低
      }
    }

    if (results.length > 0) {
      return results.slice(0, topK);
    }
    // flame/module 三层都 miss · 继续走常规 FTS+vec · 让模板 B 判断
  }

  const pool = Math.max(20, topK * 4);
  const fts = ftsSearch(db, opts, pool);
  const { ranks: vec, topDistance: vecTopDistance } = vecSearch(db, opts, pool);

  // v0.3.8 零幻觉判据:FTS 0 命中 AND vec top-1 距离 > 0.95(近正交)→ 判 KB 未覆盖
  if (opts.q && fts.length === 0 && vecTopDistance !== null && vecTopDistance > VEC_OUT_OF_SCOPE_DISTANCE) {
    return [];  // 返空 · 上层(SKILL Step 6.5)走 NotebookLM 模板 B 兜底
  }

  const fused = rrfFuse(fts, vec, opts.rrfK ?? 60);
  const ranked = [...fused.values()].sort((a, b) => b.score - a.score).slice(0, topK);

  // Fallback: 用户只给 metadata · 没提供 q / qVector · 纯 SQL 过滤返回
  if (ranked.length === 0 && !opts.q && !opts.qVector) {
    const where: string[] = [];
    const params: unknown[] = [];
    if (opts.ruleId)    { where.push(`rule_id = ?`); params.push(opts.ruleId); }
    if (opts.engine)    { where.push(`(engine = ? OR engine = 'any')`); params.push(opts.engine); }
    if (opts.waitClass) { where.push(`wait_class = ?`); params.push(opts.waitClass); }
    if (opts.engineVersion) {
      const v = parseVersion(opts.engineVersion);
      where.push(`(engine_version_min_packed IS NULL OR engine_version_min_packed <= ?)`);
      where.push(`(engine_version_max_packed IS NULL OR engine_version_max_packed >= ?)`);
      params.push(v, v);
    }
    const sql = `SELECT * FROM knowledge ${where.length ? "WHERE " + where.join(" AND ") : ""} LIMIT ?`;
    params.push(topK);
    const facts = db.prepare(sql).all(...params) as Fact[];
    return facts.map(fact => ({ fact, fts_rank: null, vec_rank: null, rrf_score: 0 }));
  }

  if (ranked.length === 0) return [];
  const ids = ranked.map(r => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const facts = db.prepare(`SELECT * FROM knowledge WHERE id IN (${placeholders})`).all(...ids) as Fact[];
  const factMap = new Map<number, Fact>(facts.map(f => [f.id, f]));
  return ranked
    .map(r => {
      const fact = factMap.get(r.id);
      return fact ? { fact, fts_rank: r.fts_rank, vec_rank: r.vec_rank, rrf_score: r.score } : null;
    })
    .filter((x): x is QueryResult => x !== null);
}

// ============================================================================
// Embedding · MiniLM-L6-v2 · 384 维 · 懒加载
// ============================================================================

let _extractor: unknown = null;

/** 首次调用触发模型加载 (~25MB · 本地缓存) · 后续调用复用 */
export async function embed(text: string, modelDir?: string): Promise<number[]> {
  if (!_extractor) {
    const transformers: typeof import("@xenova/transformers") = await import("@xenova/transformers");
    if (modelDir) {
      transformers.env.localModelPath = modelDir;
      transformers.env.cacheDir = modelDir;
    }
    _extractor = await transformers.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  const extractor = _extractor as (t: string, o: Record<string, unknown>) => Promise<{ data: Float32Array }>;
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

// ============================================================================
// CLI subcommand: stats (合并自 cli-kb-stats.ts)
//
// 用 sqlite3 CLI subprocess(不依赖 better-sqlite3 native binding 兼容性)·
// 但模块 top-level 已 import better-sqlite3 用于 query 路径 · 实际 stats 路径仍走
// 子进程方案保留以最小改动 · 输出兼容 phase4 副标。
// ============================================================================

type StatsEngine = "mongo" | "mysql" | "redis";
const ALLOWED_STATS_ENGINES: ReadonlySet<StatsEngine> = new Set(["mongo", "mysql", "redis"]);

function querySqliteCli(dbPath: string, sql: string): string {
  return execFileSync("sqlite3", [dbPath, sql], { encoding: "utf8" }).trim();
}

function runStats(values: Record<string, string | boolean | undefined>): void {
  const engineRaw = typeof values.engine === "string" ? values.engine : "";
  if (!engineRaw) {
    console.error("usage: kb.mjs --op stats --engine <mongo|mysql|redis> [--db <path>]");
    process.exit(2);
  }
  // SQL 注入防护 · engine 字符串拼到 SQL · 必须白名单
  if (!ALLOWED_STATS_ENGINES.has(engineRaw as StatsEngine)) {
    console.error(`invalid engine: '${engineRaw}' · 仅支持 ${[...ALLOWED_STATS_ENGINES].join("/")}`);
    process.exit(2);
  }
  const engine = engineRaw as StatsEngine;

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const dbPath = (typeof values.db === "string" && values.db) ? values.db : join(scriptDir, "..", "data", "knowledge.sqlite");

  if (!existsSync(dbPath)) {
    console.log(JSON.stringify({
      ok: false,
      reason: "knowledge.sqlite 不存在",
      path: dbPath,
      engine,
      subtitle: "(知识库未装载 · 副标省略)",
    }));
    return;
  }

  let rulesCount = 0;
  let rulesDocs = 0;
  let factsCount = 0;
  let factsUrls = 0;

  try {
    // rules 表 · 取 engine + 'any' 跨引擎共享
    const rulesRow = querySqliteCli(
      dbPath,
      `SELECT COUNT(DISTINCT source_url), COUNT(*) FROM rules WHERE engine IN ('${engine}', 'any');`,
    );
    const [d, c] = rulesRow.split("|");
    rulesDocs = Number(d ?? 0);
    rulesCount = Number(c ?? 0);
  } catch (err) {
    console.log(JSON.stringify({
      ok: false,
      reason: `rules 查询失败 · ${(err as Error).message}`,
      engine,
      subtitle: "(知识库查询失败 · 副标省略)",
    }));
    return;
  }

  try {
    // knowledge 表 · 仅取该 engine(facts 不跨引擎共享)
    const factsRow = querySqliteCli(
      dbPath,
      `SELECT COUNT(*), COUNT(DISTINCT source_url) FROM knowledge WHERE engine = '${engine}';`,
    );
    const [c, u] = factsRow.split("|");
    factsCount = Number(c ?? 0);
    factsUrls = Number(u ?? 0);
  } catch {
    // knowledge 表查询失败不致命 · 继续
  }

  // 副标渲染 · 三挡(plan §5)
  let subtitle: string;
  if (factsCount > 0) {
    subtitle = `蒸馏自 ${rulesDocs} 份权威文档 · ${rulesCount} 条规则 · 知识库 ${factsCount} 条用于追问检索`;
  } else {
    subtitle = `蒸馏自 ${rulesDocs} 份权威文档 · ${rulesCount} 条规则 · 知识库暂未装载 · 追问走 CheckFn citation`;
  }

  console.log(JSON.stringify({
    ok: true,
    engine,
    rules: { count: rulesCount, docs: rulesDocs },
    knowledge: { facts: factsCount, urls: factsUrls },
    subtitle,
  }));
}

// ============================================================================
// CLI subcommand: query (合并自 cli-query-kb.ts main())
// ============================================================================

async function runQuery(values: Record<string, string | boolean | undefined>): Promise<void> {
  if (values.help) {
    process.stdout.write(
      `Usage: kb --op query [options]\n\n` +
      `  --db <path>                 knowledge.sqlite path (default: <skill>/data/knowledge.sqlite)\n` +
      `  --model <dir>               MiniLM model cache dir (default: <skill>/data/models)\n` +
      `  --rule-id <id>              filter by canonical rule id\n` +
      `  --wait-class <class>        filter by wait class: CPU | I/O | 内存 | 并发 | 网络\n` +
      `  --engine <name>             mongo | mysql | redis\n` +
      `  --engine-version X.Y.Z      filter by version range\n` +
      `  --q <text>                  natural language query (FTS5 + vec hybrid)\n` +
      `  --top-k <N>                 default 5\n` +
      `\nv0.4.0 flame graph routing (bypasses FTS · avoids underscore tokenization issues):\n` +
      `  --flame-function <name>     hot function name · matches flame_pattern_regex\n` +
      `  --context-ancestors a,b,c   comma-sep ancestors · used when --flame-function miss\n` +
      `  --module <name>             module-level fallback (mongod/libz/kernel/libc/...)\n` +
      `\nOutput: JSON {query, results: [{fact, fts_rank, vec_rank, rrf_score}]}\n`
    );
    return;
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const skillDir = process.env.CLAUDE_SKILL_DIR ?? resolve(scriptDir, "..");
  const dbPath = (typeof values.db === "string" && values.db) ? values.db : join(skillDir, "data", "knowledge.sqlite");
  const modelDir = (typeof values.model === "string" && values.model) ? values.model : join(skillDir, "data", "models");

  const opts: QueryOptions = {
    ruleId:           typeof values["rule-id"] === "string" ? values["rule-id"] : undefined,
    waitClass:        typeof values["wait-class"] === "string" ? (values["wait-class"] as WaitClass) : undefined,
    engine:           typeof values.engine === "string" ? values.engine : undefined,
    engineVersion:    typeof values["engine-version"] === "string" ? values["engine-version"] : undefined,
    q:                typeof values.q === "string" ? values.q : undefined,
    topK:             typeof values["top-k"] === "string" ? Number(values["top-k"]) : 5,
    flameFunction:    typeof values["flame-function"] === "string" ? values["flame-function"] : undefined,
    contextAncestors: typeof values["context-ancestors"] === "string" ? values["context-ancestors"].split(",").map(s => s.trim()).filter(Boolean) : undefined,
    moduleName:       typeof values.module === "string" ? values.module : undefined,
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

// ============================================================================
// CLI entry · esbuild bundle → scripts/kb.mjs
// ============================================================================

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "op":                { type: "string" },
      "db":                { type: "string" },
      "model":             { type: "string" },
      "rule-id":           { type: "string" },
      "wait-class":        { type: "string" },
      "engine":            { type: "string" },
      "engine-version":    { type: "string" },
      "q":                 { type: "string" },
      "top-k":             { type: "string" },
      "flame-function":    { type: "string" },
      "context-ancestors": { type: "string" },
      "module":            { type: "string" },
      "help":              { type: "boolean", short: "h" },
    },
  });

  // 默认 op=query (向后兼容 · 无 --op 时按 query 处理)
  const op = typeof values.op === "string" ? values.op : "query";
  if (op === "stats") return runStats(values as Record<string, string | boolean | undefined>);
  if (op === "query") return runQuery(values as Record<string, string | boolean | undefined>);
  process.stderr.write(`unknown --op: ${op} · expect: query | stats\n`);
  process.exit(2);
}

// main 检测 · ESM 标准式
// 比较 realpath(resolve symlink)· 修 ~/.ohsql/skills/ 下 symlink 场景
import { realpathSync } from "node:fs";
function _getRealPathHref(p: string | undefined): string {
  if (!p) return "";
  try { return pathToFileURL(realpathSync(p)).href; } catch { return pathToFileURL(p).href; }
}
const isMain = import.meta.url === _getRealPathHref(process.argv[1]);
if (isMain) {
  main().catch(err => {
    process.stderr.write(`kb error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
