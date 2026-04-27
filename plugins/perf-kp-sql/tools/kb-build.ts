#!/usr/bin/env node
/**
 * kb-build — KB 构建 / 维护工具集合(5 工具合并到一个文件)
 *
 * 合并自:
 *   - knowledge-ledger.ts  → init/extract/augment/build/stats (KB 主构建器)
 *   - mine-rules.ts         → mine (从 markdown 蒸出 rule 候选)
 *   - merge-candidates.ts   → merge (候选 → 主 rules.json)
 *   - enrich-kb.ts          → enrich (seeds 加 keyword/topic facts)
 *   - export-engine-rules.ts → export-checks (CheckFn → rules-candidates JSON)
 *
 * 用法:
 *   node kb-build.ts --op <subcommand> [options]
 *
 * Subcommands:
 *   --op init           · sqlite schema 初始化(可选 --force 清空)
 *   --op extract        · rules.json → 4 种 auto fact (summary/threshold/remediation/citation)
 *   --op augment        · OpenAI 扩展 mechanism/trade_off/when_deviate (需 OPENAI_API_KEY)
 *   --op build          · init + extract + 合并 extended seeds + MiniLM embed + 写 sqlite
 *   --op stats          · sqlite 统计(by engine / wait_class / fact_type)
 *   --op mine           · OpenAI 蒸馏 markdown → rule 候选(需 OPENAI_API_KEY)
 *   --op merge          · 候选 *.json → 主 rules.json + common/kunpeng-rules.json
 *   --op enrich         · 添加 keyword + topic_answer facts 到 seeds/mongo-extended.json
 *   --op export-checks  · 把 CheckFn 反向导出成 rules-candidates JSON (Phase 4 迁移辅助)
 *
 * 各 section 互不依赖 · 顶部 import / helpers 已合并 · 维护时保持 section 边界清晰。
 */

// ============================================================================
// SHARED IMPORTS
// ============================================================================

import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import OpenAI from "openai";
import { parseArgs } from "node:util";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

import {
  SCHEMA_SQL,
  openKb,
  initSchema,
  embed,
  type FactType,
  type WaitClass,
  parseVersion,
} from "../src/cli-kb.js";

// ============================================================================
// SHARED HELPERS · skill 目录定位
// ============================================================================

const __dirname_kb_build = dirname(fileURLToPath(import.meta.url));
function skillDir(): string {
  return join(__dirname_kb_build, "..");
}

function repoRoot(): string {
  return resolve(__dirname_kb_build, "..", "..", "..");
}

// ============================================================================
// ============================================================================
// SECTION 1: knowledge-ledger (init / extract / augment / build / stats)
// ============================================================================
// 合并自 tools/knowledge-ledger.ts (654 行) · KB 主构建器
// ============================================================================
// ============================================================================

interface OriginalSource {
  tier: "official" | "vendor-primary" | "vendor-blog" | "community";
  url: string;
  title?: string;
  quote?: string;
  accessed?: string;
}

interface OriginalRule {
  id: string;
  bucket: 1 | 2 | 3 | 4 | 5;
  severity: "CRITICAL" | "WARNING" | "INFO";
  metric_expr: string;
  threshold: string;
  reason: string;
  recommend: string;
  fix: string;
  fix_cost: "trivial" | "restart_engine" | "schema_migration";
  source: OriginalSource;
  engine: "mongo" | "any";
  confidence: "high" | "medium" | "low";
  refs: string[];
  needs_human_review?: boolean;
  engine_version_min?: string;
  engine_version_max?: string;
  arch?: string;
  vendor?: string;
  os?: string;
  scope?: { arch?: string | null; vendor?: string | null; os?: string | null };
}

/** 5 wait class 关键词模式 · 顺序重要(优先匹配更具体的 I/O · 最后兜底 CPU) */
const WAIT_CLASS_PATTERNS: Array<{ cls: WaitClass; re: RegExp }> = [
  { cls: "I/O",  re: /\b(disk|i\/o|io[-_ ]|flush|write[-_ ]?ahead|write[-_ ]?concern|checkpoint|fsync|journal|syslog|scheduler|iops|page[-_ ]?fault|read[-_ ]?ahead|logrotate|log[-_ ]?verbosity|log[-_ ]?volume|quiet|storage|document[-_ ]?size|large[-_ ]?array|unbounded[-_ ]?array|chunks?|tablespace|rdb|aof|persistence|append[-_ ]?only)\b/i },
  { cls: "内存", re: /\b(memory|cache|buffer[-_ ]?pool|swap|rss|thp|huge[-_ ]?pages?|oom|eviction|working[-_ ]?set|cold[-_ ]?start|page[-_ ]?reclaim|zone[-_ ]?reclaim|innodb[-_ ]?old|lru|maxmemory)\b/i },
  { cls: "并发", re: /\b(connection|pool|lock|concurrent|thread|deadlock|mutex|contention|transaction|replica|voting|arbiter|shard|election|quorum|commit[-_ ]?quorum|semaphore|congestion|wait[-_ ]?time|backlog|master|slave)\b/i },
  { cls: "网络", re: /\b(tcp|network|socket|keepalive|somaxconn|retransmit|bandwidth|rtt|ssl|tls|hostname|dns|net[-_ ]?latency|packet|bind|interface[-_ ]?expose|protected[-_ ]?mode)\b/i },
  { cls: "CPU",  re: /\b(cpu|instruction|numa|lse|arm64|x86|frequency|scaling|governor|crc32|compress|cipher|tcmalloc|jemalloc|branch|regex|lookup|predicate|plan[-_ ]?cache|query|scan|index|sort|aggregat|hash[-_ ]?join|nested[-_ ]?loop|fork[-_ ]?latency|fork[(]?2[)]?)\b/i },
];

function inferWaitClass(rule: OriginalRule): WaitClass | null {
  return inferWaitClassFromHay(`${rule.id} ${rule.metric_expr} ${rule.reason}`);
}

/** v5 extractive 路径用 · 红线收紧后 metric_expr/reason 不再存在 · 用 rule_id + quote 推断 */
function inferWaitClassFromHay(hay: string): WaitClass | null {
  for (const { cls, re } of WAIT_CLASS_PATTERNS) {
    if (re.test(hay)) return cls;
  }
  return null;
}

interface Fact {
  rule_id: string;
  fact_type: FactType;
  wait_class: WaitClass | null;
  engine: string;
  engine_version_min_packed: number | null;
  engine_version_max_packed: number | null;
  engine_version_min_display: string | null;
  engine_version_max_display: string | null;
  arch: string | null;
  vendor: string | null;
  os: string | null;
  content_zh: string | null;
  content_en: string | null;
  language: string;
  source_url: string;
  source_authority: string;
  quote: string | null;
  confidence: number;
  scraped_at: string;
  content_hash: string;
  semantic_group?: string | null;
  flame_pattern_regex?: string | null;
  grade?: number | null;
}

const CONFIDENCE_MAP: Record<string, number> = { high: 1.0, medium: 0.7, low: 0.4 };

function hashContent(parts: (string | null)[]): string {
  const joined = parts.filter(Boolean).join("|");
  return createHash("sha256").update(joined).digest("hex").slice(0, 16);
}

function versionPacked(v?: string): number | null {
  if (!v) return null;
  try { return parseVersion(v); } catch { return null; }
}

function buildFact(
  rule: OriginalRule,
  fact_type: FactType,
  content_zh: string,
  quote: string | null,
): Fact {
  return {
    rule_id: rule.id,
    fact_type,
    wait_class: inferWaitClass(rule),
    engine: rule.engine,
    engine_version_min_packed: versionPacked(rule.engine_version_min),
    engine_version_max_packed: versionPacked(rule.engine_version_max),
    engine_version_min_display: rule.engine_version_min ?? null,
    engine_version_max_display: rule.engine_version_max ?? null,
    arch:   rule.arch   ?? rule.scope?.arch   ?? null,
    vendor: rule.vendor ?? rule.scope?.vendor ?? null,
    os:     rule.os     ?? rule.scope?.os     ?? null,
    content_zh,
    content_en: null,
    language: "zh",
    source_url: rule.source.url,
    source_authority: rule.source.tier,
    quote,
    confidence: CONFIDENCE_MAP[rule.confidence] ?? 0.7,
    scraped_at: rule.source.accessed ?? new Date().toISOString().slice(0, 10),
    content_hash: hashContent([rule.id, fact_type, content_zh]),
    semantic_group: null,
    flame_pattern_regex: null,
    grade: null,
  };
}

/** v1 自动抽 4 种 fact type · 不依赖 LLM */
function extractAutoFacts(rule: OriginalRule): Fact[] {
  const out: Fact[] = [];

  if (rule.reason?.trim()) {
    out.push(buildFact(rule, "summary", rule.reason.trim(), rule.source.quote ?? null));
  }

  if (rule.threshold?.trim()) {
    const content = [
      `阈值: ${rule.threshold}`,
      `指标: ${rule.metric_expr}`,
      `Severity: ${rule.severity}`,
    ].join("\n");
    out.push(buildFact(rule, "threshold", content, null));
  }

  if (rule.recommend?.trim() || rule.fix?.trim()) {
    const content = [
      rule.recommend?.trim() ? `建议: ${rule.recommend.trim()}` : null,
      rule.fix?.trim() ? `操作示例:\n\`\`\`\n${rule.fix.trim()}\n\`\`\`` : null,
      `fix_cost: ${rule.fix_cost}`,
    ].filter(Boolean).join("\n\n");
    out.push(buildFact(rule, "remediation", content, null));
  }

  if (rule.source.quote?.trim()) {
    const content = `原文: ${rule.source.quote.trim()}\n\n来源: ${rule.source.title ?? rule.source.url}`;
    out.push(buildFact(rule, "citation", content, rule.source.quote.trim()));
  }

  return out;
}

function upsertFact(db: Database.Database, fact: Fact): { inserted: boolean; id: number } {
  const existing = db.prepare(`SELECT id FROM knowledge WHERE content_hash = ?`).get(fact.content_hash) as { id: number } | undefined;
  if (existing) return { inserted: false, id: existing.id };

  const normalized = {
    ...fact,
    semantic_group: fact.semantic_group ?? null,
    flame_pattern_regex: fact.flame_pattern_regex ?? null,
    grade: fact.grade ?? null,
  };

  const info = db.prepare(`
    INSERT INTO knowledge (
      rule_id, fact_type, wait_class, engine,
      engine_version_min_packed, engine_version_max_packed,
      engine_version_min_display, engine_version_max_display,
      arch, vendor, os,
      content_zh, content_en, language,
      source_url, source_authority, quote,
      confidence, scraped_at, content_hash,
      semantic_group, flame_pattern_regex, grade
    ) VALUES (
      @rule_id, @fact_type, @wait_class, @engine,
      @engine_version_min_packed, @engine_version_max_packed,
      @engine_version_min_display, @engine_version_max_display,
      @arch, @vendor, @os,
      @content_zh, @content_en, @language,
      @source_url, @source_authority, @quote,
      @confidence, @scraped_at, @content_hash,
      @semantic_group, @flame_pattern_regex, @grade
    )
  `).run(normalized);
  return { inserted: true, id: Number(info.lastInsertRowid) };
}

function upsertFtsAndVec(db: Database.Database, id: number, fact: Fact, vector: number[]): void {
  db.prepare(`DELETE FROM knowledge_fts WHERE rowid = ?`).run(id);
  db.prepare(`
    INSERT INTO knowledge_fts (rowid, rule_id, engine, wait_class, content_zh, content_en, quote)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, fact.rule_id, fact.engine, fact.wait_class ?? "", fact.content_zh ?? "", fact.content_en ?? "", fact.quote ?? "");

  const vecId = BigInt(id);
  db.prepare(`DELETE FROM knowledge_vec WHERE id = ?`).run(vecId);
  db.prepare(`INSERT INTO knowledge_vec (id, embedding) VALUES (?, ?)`).run(
    vecId,
    Buffer.from(new Float32Array(vector).buffer),
  );
}

const DEFAULT_ENGINES = ["mongo"] as const;
const SUPPORTED_ENGINES = ["mongo"] as const;

function loadRules(engine: string): OriginalRule[] {
  const path = join(skillDir(), "data", engine, "rules.json");
  if (!existsSync(path)) {
    throw new Error(`rules.json not found: ${path}`);
  }
  const engineRules = JSON.parse(readFileSync(path, "utf8")) as OriginalRule[];

  const commonPath = join(skillDir(), "data", "common", "kunpeng-rules.json");
  if (!existsSync(commonPath)) return engineRules;
  const commonRules = JSON.parse(readFileSync(commonPath, "utf8")) as OriginalRule[];
  const applicable = commonRules.filter(r => r.engine === "any" || r.engine === engine);
  const rebound = applicable.map(r => ({ ...r, engine })) as OriginalRule[];
  return [...engineRules, ...rebound];
}

async function cmdInit(dbPath: string, force: boolean): Promise<void> {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (force && existsSync(dbPath)) {
    unlinkSync(dbPath);
    console.log(`removed existing ${dbPath}`);
  }
  const db = openKb(dbPath);
  initSchema(db);
  console.log(`initialized schema at ${dbPath}`);
  db.close();
}

async function cmdExtract(engines: string[]): Promise<Fact[]> {
  const all: Fact[] = [];
  const stats: Record<string, { rules: number; facts: number; unclassified: number }> = {};
  for (const engine of engines) {
    const rules = loadRules(engine);
    const facts = rules.flatMap(extractAutoFacts);
    all.push(...facts);
    stats[engine] = {
      rules: rules.length,
      facts: facts.length,
      unclassified: facts.filter(f => !f.wait_class).length,
    };
  }
  console.log(`\nextraction summary:`);
  for (const [engine, s] of Object.entries(stats)) {
    console.log(`  ${engine}: ${s.rules} rules → ${s.facts} facts (${s.unclassified} unclassified wait_class)`);
  }
  console.log(`  TOTAL: ${all.length} facts\n`);
  return all;
}

const EXTENDED_FACT_TYPES: FactType[] = ["mechanism", "trade_off", "when_deviate"];

const AUGMENT_SYSTEM = `你是数据库性能调优专家。基于给定 rule 定义 + 官方文档原文 · 产出 3 条结构化 fact。

严格要求:
- 每条 content 200-500 中文字符 · 技术性 · 具体 · 不空泛
- 只从提供的文档原文提炼 · 不编造 · 不凭记忆补充
- 文档不足以支撑时 · 该字段填 "INSUFFICIENT_CONTEXT" · 宁缺毋滥

输出严格 JSON (无任何前后说明文字):
{"mechanism": "...", "trade_off": "...", "when_deviate": "..."}`;

function buildAugmentUser(rule: OriginalRule, refExcerpts: string): string {
  return `Rule: ${rule.id}
Engine: ${rule.engine}
Severity: ${rule.severity}
Reason: ${rule.reason}
Recommend: ${rule.recommend}
Metric: ${rule.metric_expr}
Threshold: ${rule.threshold}

官方文档原文(refs · 已截取):
${refExcerpts}

请产出 3 条 fact:

1. mechanism(机制展开): 该现象**底层如何发生**。引擎原理 / 内核行为 / 数据结构 / 系统调用 · 点到具体组件名 / 函数 / 事件名 · 避免泛化。

2. trade_off(代价权衡): 修复**换来什么 · 付出什么**。不修复又会如何。两个方向的具体成本。

3. when_deviate(例外场景): 该规则**什么时候不适用**。哪类 workload / 环境 / 配置 · 即使触发也不该告警。

输出 JSON only · 无其他文字。`;
}

function loadRefExcerpts(engine: string, refs: string[]): string {
  const MAX_PER_REF = 4000;
  const MAX_REFS = 2;
  const parts: string[] = [];
  for (const ref of refs.slice(0, MAX_REFS)) {
    const path = join(skillDir(), "data", engine, ref);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8").slice(0, MAX_PER_REF);
    parts.push(`--- ${ref} ---\n${content}`);
  }
  return parts.join("\n\n");
}

interface AugmentOutput { mechanism: string; trade_off: string; when_deviate: string }

async function augmentOneRule(
  client: OpenAI,
  rule: OriginalRule,
  model: string,
): Promise<AugmentOutput | null> {
  const refs = loadRefExcerpts(rule.engine, rule.refs);
  if (!refs.trim()) return null;
  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: AUGMENT_SYSTEM },
      { role: "user",   content: buildAugmentUser(rule, refs) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });
  const text = resp.choices[0]?.message?.content;
  if (!text) return null;
  try {
    return JSON.parse(text) as AugmentOutput;
  } catch (e) {
    process.stderr.write(`  parse fail for ${rule.id}: ${(e as Error).message}\n`);
    return null;
  }
}

async function cmdAugment(
  engines: string[],
  opts: { model: string; ruleId?: string; outputDir: string; dryRun: boolean; limit: number },
): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY env var not set · 请 export OPENAI_API_KEY=sk-... 后重试");
  }
  const client = new OpenAI();

  for (const engine of engines) {
    const allRules = loadRules(engine);
    const needle = opts.ruleId;
    const rules = needle
      ? allRules.filter(r => r.id === needle || r.id.includes(needle))
      : allRules.slice(0, opts.limit);
    if (rules.length === 0) {
      console.log(`no rules match for engine=${engine} ruleId=${opts.ruleId ?? "*"}`);
      continue;
    }
    console.log(`augmenting ${rules.length} ${engine} rule(s) · model=${opts.model}`);

    const extendedFacts: Fact[] = [];
    let skipped = 0;
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      process.stdout.write(`[${i + 1}/${rules.length}] ${rule.id}\n`);
      const out = await augmentOneRule(client, rule, opts.model);
      if (!out) { skipped++; continue; }
      for (const ft of EXTENDED_FACT_TYPES) {
        const content = out[ft as keyof AugmentOutput];
        if (!content || content.includes("INSUFFICIENT_CONTEXT") || content.length < 50) continue;
        extendedFacts.push(buildFact(rule, ft, content.trim(), null));
      }
    }

    console.log(`\n${engine}: produced ${extendedFacts.length} extended facts · skipped ${skipped} rules (no refs or parse fail)`);

    if (opts.dryRun) {
      console.log(`\n--- dry-run · 前 2 条预览 ---\n${JSON.stringify(extendedFacts.slice(0, 2), null, 2)}`);
      continue;
    }

    if (!existsSync(opts.outputDir)) mkdirSync(opts.outputDir, { recursive: true });
    const outputPath = join(opts.outputDir, `${engine}-extended.json`);

    let prior: Fact[] = [];
    if (existsSync(outputPath)) {
      try { prior = JSON.parse(readFileSync(outputPath, "utf8")) as Fact[]; } catch { prior = []; }
    }
    const seen = new Set<string>();
    const merged: Fact[] = [];
    for (const f of [...extendedFacts, ...prior]) {
      const key = `${f.rule_id}|${f.fact_type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(f);
    }
    writeFileSync(outputPath, JSON.stringify(merged, null, 2));
    console.log(`→ ${outputPath} · merged ${extendedFacts.length} new + ${prior.length} prior = ${merged.length} (deduped)`);
  }
}

function loadExtendedFacts(seedsDir: string, engines: string[]): Fact[] {
  const out: Fact[] = [];
  if (!existsSync(seedsDir)) return out;
  const allFiles = readdirSync(seedsDir).filter(f => f.endsWith(".json"));
  for (const engine of engines) {
    const matches = allFiles.filter(f => f.startsWith(`${engine}-`));
    for (const fileName of matches) {
      const path = join(seedsDir, fileName);
      try {
        const rows = JSON.parse(readFileSync(path, "utf8")) as Fact[];
        out.push(...rows);
        console.log(`  loaded ${rows.length} extended facts from ${fileName}`);
      } catch (e) {
        console.warn(`  skip ${fileName}: ${(e as Error).message}`);
      }
    }
  }
  return out;
}

async function cmdBuild(dbPath: string, engines: string[], modelDir: string, force: boolean, seedsDir: string): Promise<void> {
  await cmdInit(dbPath, force);
  const db = openKb(dbPath);

  const autoFacts = await cmdExtract(engines);
  const extendedFacts = loadExtendedFacts(seedsDir, engines);
  const facts = [...autoFacts, ...extendedFacts];
  console.log(`total ${facts.length} facts (${autoFacts.length} auto + ${extendedFacts.length} extended)`);

  console.log(`embedding with MiniLM (model dir: ${modelDir})...`);
  let embedded = 0;
  let skipped = 0;
  const tx = db.transaction((batch: Array<{ fact: Fact; vector: number[] }>) => {
    for (const { fact, vector } of batch) {
      const { inserted, id } = upsertFact(db, fact);
      if (!inserted) { skipped++; continue; }
      upsertFtsAndVec(db, id, fact, vector);
      embedded++;
    }
  });

  const BATCH = 50;
  for (let i = 0; i < facts.length; i += BATCH) {
    const slice = facts.slice(i, i + BATCH);
    const vectors = await Promise.all(
      slice.map(f => embed((f.content_zh ?? "").slice(0, 512), modelDir)),
    );
    tx(slice.map((fact, idx) => ({ fact, vector: vectors[idx] })));
    process.stdout.write(`  embedded ${Math.min(i + BATCH, facts.length)}/${facts.length}\r`);
  }
  process.stdout.write(`\n`);

  console.log(`build done: ${embedded} inserted, ${skipped} duplicates (by content_hash)`);
  db.close();
}

// audit-citations 同款 normalize · 给 seed_quote 字面验用(避免污染 KB)
function stripHtmlForAudit(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&[a-z]+;/gi, " ");
}
function canonicalForAudit(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ").trim().toLowerCase();
}

// ----------------------------------------------------------------------------
// cmdRebuildFromVerified · 用 cleaner v5 extractive + 字面验过的 facts 重建 KB
//
// 输入: cleaner v5 verified.json + cleaner v5 input.json (拿原始 rule metadata)
// 流程:
//   1. 收集 verified facts (verified=true 的 fact)
//   2. 兜底注入 source.quote (seed):
//      a. citation 缺失 → seed 当 citation 入库
//      b. 整规则 0 verified → seed 当 summary 入库 (保证每条规则至少 1 fact)
//   3. cmdInit(force=true) 清空 sqlite
//   4. 复用 cmdBuild 的 batch embed + upsertFact + upsertFtsAndVec
// ----------------------------------------------------------------------------

interface ExtractedFactV5 { type: string; quote: string | null; verified?: boolean; reject_reason?: string }
interface ExtractedRuleV5 { rule_id: string; source_url: string; source_quote_seed: string | null; facts: ExtractedFactV5[] }
interface InputRuleV5 {
  rule_id?: string; id?: string; engine?: string;
  source?: { url?: string; quote?: string; title?: string; tier?: string; accessed?: string };
  arch?: string; vendor?: string; os?: string;
  engine_version_min?: string; engine_version_max?: string;
}

async function cmdRebuildFromVerified(
  dbPath: string,
  modelDir: string,
  verifiedPath: string,
  rulesPath: string,
  htmlCacheDir?: string,
): Promise<void> {
  const verified = JSON.parse(readFileSync(verifiedPath, "utf8")) as ExtractedRuleV5[];
  const inputRules = JSON.parse(readFileSync(rulesPath, "utf8")) as InputRuleV5[];

  const ruleMeta = new Map<string, InputRuleV5>();
  for (const r of inputRules) {
    const id = r.rule_id ?? r.id;
    if (id) ruleMeta.set(id, r);
  }

  // seed 字面验 · htmlCacheDir 提供时启用 · seed 必须在源 HTML substring 命中才入库
  // 不命中 → 跳过(规则可能 0 fact · 报告 fallback 不污染 KB)
  const seedAuditCache = new Map<string, string | null>();
  function seedFitsHtml(seed: string, sourceUrl: string): boolean {
    if (!htmlCacheDir) return true; // 无 cache · 退回不验(老行为 · 默认)
    if (!sourceUrl) return false;
    let canonHtml = seedAuditCache.get(sourceUrl);
    if (canonHtml === undefined) {
      const hash = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 16);
      const p = join(htmlCacheDir, `${hash}.html`);
      if (!existsSync(p)) { seedAuditCache.set(sourceUrl, null); canonHtml = null; }
      else {
        const html = readFileSync(p, "utf8");
        canonHtml = canonicalForAudit(stripHtmlForAudit(html));
        seedAuditCache.set(sourceUrl, canonHtml);
      }
    }
    if (!canonHtml) return false;
    return canonHtml.indexOf(canonicalForAudit(seed)) >= 0;
  }

  // 1. 收集 + 兜底
  const facts: Fact[] = [];
  let seedFallbackCitation = 0, seedFallbackSummary = 0, seedFallbackRejected = 0;
  const today = new Date().toISOString().slice(0, 10);

  function makeFact(ruleId: string, factType: FactType, quote: string, meta: InputRuleV5 | undefined): Fact {
    const engine = (meta?.engine === "any" ? "mongo" : meta?.engine) ?? "mongo";
    return {
      rule_id: ruleId,
      fact_type: factType,
      wait_class: inferWaitClassFromHay(`${ruleId} ${quote}`),
      engine,
      engine_version_min_packed: versionPacked(meta?.engine_version_min),
      engine_version_max_packed: versionPacked(meta?.engine_version_max),
      engine_version_min_display: meta?.engine_version_min ?? null,
      engine_version_max_display: meta?.engine_version_max ?? null,
      arch: meta?.arch ?? null,
      vendor: meta?.vendor ?? null,
      os: meta?.os ?? null,
      content_zh: quote,
      content_en: quote,
      language: "zh",
      source_url: meta?.source?.url ?? "",
      source_authority: meta?.source?.tier ?? "official",
      quote,
      confidence: 1.0,
      scraped_at: meta?.source?.accessed ?? today,
      content_hash: hashContent([ruleId, factType, quote]),
      semantic_group: null,
      flame_pattern_regex: null,
      grade: null,
    };
  }

  for (const r of verified) {
    const meta = ruleMeta.get(r.rule_id);
    const seed = (r.source_quote_seed ?? meta?.source?.quote ?? "").trim();
    const verifiedFacts = r.facts.filter((f) => f.verified && f.quote);
    let hasCitation = false;
    for (const f of verifiedFacts) {
      if (f.type === "citation") hasCitation = true;
      facts.push(makeFact(r.rule_id, f.type as FactType, f.quote!, meta));
    }
    if (!hasCitation && seed) {
      if (seedFitsHtml(seed, r.source_url)) {
        facts.push(makeFact(r.rule_id, "citation", seed, meta));
        seedFallbackCitation++;
      } else {
        seedFallbackRejected++;
      }
    }
    if (verifiedFacts.length === 0 && seed) {
      if (seedFitsHtml(seed, r.source_url)) {
        facts.push(makeFact(r.rule_id, "summary", seed, meta));
        seedFallbackSummary++;
      } else {
        seedFallbackRejected++;
      }
    }
  }

  console.log(`[rebuild] facts collected: ${facts.length}`);
  console.log(`[rebuild]   verified extracted: ${facts.length - seedFallbackCitation - seedFallbackSummary}`);
  console.log(`[rebuild]   citation seed fallback: ${seedFallbackCitation}`);
  console.log(`[rebuild]   summary seed fallback (0-verified rules): ${seedFallbackSummary}`);
  if (htmlCacheDir) {
    console.log(`[rebuild]   seed rejected (字面 miss · 守红线): ${seedFallbackRejected}`);
  }

  // 2. init + force
  await cmdInit(dbPath, true);
  const db = openKb(dbPath);

  // 3. embed + upsert (复用 cmdBuild 同款 batch 模式)
  console.log(`[rebuild] embedding with MiniLM (model dir: ${modelDir})...`);
  let inserted = 0, dup = 0;
  const tx = db.transaction((batch: Array<{ fact: Fact; vector: number[] }>) => {
    for (const { fact, vector } of batch) {
      const r = upsertFact(db, fact);
      if (!r.inserted) { dup++; continue; }
      upsertFtsAndVec(db, r.id, fact, vector);
      inserted++;
    }
  });

  const BATCH = 50;
  for (let i = 0; i < facts.length; i += BATCH) {
    const slice = facts.slice(i, i + BATCH);
    const vectors = await Promise.all(
      slice.map((f) => embed((f.content_zh ?? "").slice(0, 512), modelDir)),
    );
    tx(slice.map((fact, idx) => ({ fact, vector: vectors[idx] })));
    process.stdout.write(`  embedded ${Math.min(i + BATCH, facts.length)}/${facts.length}\r`);
  }
  process.stdout.write(`\n`);

  console.log(`[rebuild] done: ${inserted} inserted, ${dup} duplicates (by content_hash)`);
  console.log(`[rebuild] db: ${dbPath}`);
  db.close();
}

function cmdStats(dbPath: string): void {
  if (!existsSync(dbPath)) {
    console.log(`no database at ${dbPath}`);
    process.exit(1);
  }
  const db = openKb(dbPath, { readonly: true });
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM knowledge`).get() as { c: number }).c;
  console.log(`\n== knowledge.sqlite stats ==\npath: ${dbPath}\ntotal facts: ${total}\n`);

  console.log(`by engine:`);
  const byEngine = db.prepare(`SELECT engine, COUNT(*) AS c FROM knowledge GROUP BY engine ORDER BY c DESC`).all() as Array<{ engine: string; c: number }>;
  for (const r of byEngine) console.log(`  ${r.engine.padEnd(8)} ${r.c}`);

  console.log(`\nby wait_class:`);
  const byWc = db.prepare(`SELECT COALESCE(wait_class, '<none>') AS wc, COUNT(*) AS c FROM knowledge GROUP BY wc ORDER BY c DESC`).all() as Array<{ wc: string; c: number }>;
  for (const r of byWc) console.log(`  ${r.wc.padEnd(10)} ${r.c}`);

  console.log(`\nby fact_type:`);
  const byFt = db.prepare(`SELECT fact_type, COUNT(*) AS c FROM knowledge GROUP BY fact_type ORDER BY c DESC`).all() as Array<{ fact_type: string; c: number }>;
  for (const r of byFt) console.log(`  ${r.fact_type.padEnd(12)} ${r.c}`);

  console.log(`\nvec0 rows: ${(db.prepare(`SELECT COUNT(*) AS c FROM knowledge_vec`).get() as { c: number }).c}`);
  console.log(`fts5 rows: ${(db.prepare(`SELECT COUNT(*) AS c FROM knowledge_fts`).get() as { c: number }).c}\n`);
  db.close();
}

// ============================================================================
// ============================================================================
// SECTION 2: mine-rules (从 markdown 蒸馏 rule 候选)
// ============================================================================
// 合并自 tools/mine-rules.ts (316 行)
// ============================================================================
// ============================================================================

interface MineSection {
  heading: string;
  path: string[];
  body: string;
  startLine: number;
}

function splitByHeadings(md: string): MineSection[] {
  const lines = md.split("\n");
  const out: MineSection[] = [];
  const stack: string[] = [];
  let cur: MineSection | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(#{2,4})\s+(.+?)\s*$/);
    if (m) {
      if (cur && cur.body.trim()) out.push(cur);
      const level = m[1].length;
      const heading = m[2];
      while (stack.length >= level - 1) stack.pop();
      stack.push(heading);
      cur = {
        heading,
        path: [...stack],
        body: "",
        startLine: i + 1,
      };
      continue;
    }
    if (cur) cur.body += line + "\n";
  }
  if (cur && cur.body.trim()) out.push(cur);
  return out;
}

function splitByLength(md: string, target = 3000, overlap = 200): MineSection[] {
  const clean = md.replace(/^---[\s\S]*?---\n/, "");
  const out: MineSection[] = [];
  for (let i = 0, n = 0; i < clean.length; i += target - overlap, n++) {
    const body = clean.slice(i, i + target);
    if (body.trim().length < 200) continue;
    out.push({
      heading: `chunk-${n}`,
      path: [`chunk-${n}`],
      body,
      startLine: 1,
    });
  }
  return out;
}

function smartSplit(md: string): MineSection[] {
  const headingBased = splitByHeadings(md);
  if (headingBased.length >= 3) return headingBased;
  return splitByLength(md);
}

const MINE_SYSTEM = `你是数据库性能调优领域专家 · 从官方文档原文提取**调优建议 / 配置项 / 最佳实践**作为 rule 候选。

**积极提取 · 不惜手下多**:只要原文描述了
- 某个配置参数推荐值(如 swappiness=1 · THP=never · maxConns=65536)
- 某个系统 / 内核 / 引擎设置(如 ulimit · systemd 服务文件 · sysctl)
- 某个最佳实践(如"禁用 NUMA interleave"· "启用 rseq"· "用 xfs 而非 ext4")
- 某个版本行为差异(如 "MongoDB 8.0 起使用 per-CPU TCMalloc 缓存")
- 某个常见坑(如 "glibc rseq 注册会禁用 TCMalloc per-CPU")
→ **都作为一条候选 rule** · 哪怕 metric_expr 是近似/概念性的

原则:
- 只从原文提取 · 不编造阈值 / URL / 机制
- **不要**返回空数组 [] 除非这段真的只是标题和空白
- 对概念性陈述 · 用 severity=INFO + confidence=low · 不要跳过
- metric_expr 允许近似(如 "sysctl vm.swappiness" · "systemctl status enable-transparent-huge-pages")
- 若原文有明确版本限定(如 "MongoDB 7.0 以下")· 填 engine_version_max

候选 rule 字段(schema):
{
  "id": "<engine>-<bucket>-<kebab-desc>",   // 全局唯一 · 如 mongo-resources-tcmalloc-percpu-require-rseq
  "bucket": 1-5,                             // 1=CPU 2=内存 3=I/O 4=并发 5=网络
  "severity": "CRITICAL" | "WARNING" | "INFO",
  "metric_expr": "<可执行或概念性>",          // 如 "sysctl vm.swappiness" 或 "mongod has rseq env"
  "threshold": "<具体或描述性阈值>",           // 如 "== 1" · "is 'never'" · "has per-CPU caches"
  "reason": "<为什么重要 · 20-150 字>",
  "recommend": "<建议怎么调 · 10-100 字>",
  "fix": "<具体命令或配置片段>",
  "fix_cost": "trivial" | "restart_engine" | "schema_migration",
  "source": {
    "tier": "official" | "vendor-primary" | "vendor-blog",
    "url": "<从 frontmatter 或本节提取 · 否则填 TBD>",
    "title": "<文档或节标题>",
    "quote": "<支撑原句 · 1-3 句 · 200-300 字内>",
    "accessed": "2026-04-22"
  },
  "engine": "mongo" | "any",
  "confidence": "high" | "medium" | "low",
  "refs": ["<source-basename>"],
  "engine_version_min": "<可选>",
  "engine_version_max": "<可选>"
}

输出严格 JSON:
{"rules": [ {...}, {...}, ... ]}

目标:本节只要有实质配置/实践内容 · 至少产 **1-3 条**候选。本节确实啥也没讲(纯标题/废话)再输出空数组。`;

function buildMineUserPrompt(section: MineSection, sourceBasename: string, engine: string): string {
  const path = section.path.join(" > ");
  return `来源文件: ${sourceBasename}
来源引擎: ${engine}
本节路径: ${path}
行号起点: ${section.startLine}

=== 本节原文 ===
${section.body.trim().slice(0, 5000)}
=== 原文结束 ===

任务:从本节蒸出**可检测的 rule 候选** · 严格遵守系统消息的 schema · 输出 JSON 数组(无可蒸则空数组)。`;
}

interface MineOpts {
  source: string;
  engine: string;
  model: string;
  limit: number | null;
  minChars: number;
  dryRun: boolean;
  verbose: boolean;
}

async function mineOne(client: OpenAI, model: string, section: MineSection, sourceBasename: string, engine: string, verbose: boolean): Promise<any[]> {
  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: MINE_SYSTEM },
      { role: "user", content: buildMineUserPrompt(section, sourceBasename, engine) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.15,
  });
  const text = resp.choices[0]?.message?.content;
  if (verbose) process.stderr.write(`    raw resp: ${(text ?? "<empty>").slice(0, 300)}\n`);
  if (!text) return [];
  try {
    const obj = JSON.parse(text);
    const rules = Array.isArray(obj?.rules) ? obj.rules : [];
    for (const r of rules) r._mined_from = { section_path: section.path, line: section.startLine };
    return rules;
  } catch (e) {
    process.stderr.write(`  parse fail for section "${section.heading}": ${(e as Error).message}\n`);
    return [];
  }
}

async function runMine(opts: MineOpts): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY env var not set");
  }
  const client = new OpenAI();

  const sourcePath = opts.source.startsWith("/") ? opts.source : join(skillDir(), opts.source);
  if (!existsSync(sourcePath)) {
    throw new Error(`source not found: ${sourcePath}`);
  }
  const sourceBasename = basename(sourcePath);
  const md = readFileSync(sourcePath, "utf8");

  const allSections = smartSplit(md);
  const sections = allSections.filter(s => s.body.trim().length >= opts.minChars);
  const process_sections = opts.limit ? sections.slice(0, opts.limit) : sections;

  console.log(`source: ${sourceBasename}`);
  console.log(`total sections: ${allSections.length} · long enough (>=${opts.minChars}): ${sections.length} · processing: ${process_sections.length}`);
  console.log(`engine: ${opts.engine} · model: ${opts.model}\n`);

  const candidates: any[] = [];
  const t0 = Date.now();
  for (let i = 0; i < process_sections.length; i++) {
    const s = process_sections[i];
    const pathStr = s.path.join(" > ");
    process.stdout.write(`[${i + 1}/${process_sections.length}] (${s.body.length}ch) ${pathStr.slice(0, 70)}\n`);
    try {
      const rules = await mineOne(client, opts.model, s, sourceBasename, opts.engine, opts.verbose);
      for (const r of rules) candidates.push(r);
      if (rules.length > 0) process.stdout.write(`    → ${rules.length} candidate(s)\n`);
    } catch (e) {
      process.stderr.write(`    error: ${(e as Error).message}\n`);
    }
  }
  const dt = Date.now() - t0;

  console.log(`\n=== done ===`);
  console.log(`sections processed: ${process_sections.length}`);
  console.log(`candidates produced: ${candidates.length}`);
  console.log(`elapsed: ${(dt / 1000).toFixed(1)}s`);

  if (opts.dryRun) {
    console.log(`\n--- dry-run preview (first 3) ---`);
    console.log(JSON.stringify(candidates.slice(0, 3), null, 2));
    return;
  }

  const outDir = join(skillDir(), "data", opts.engine);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `rules-candidates-${sourceBasename.replace(/\.(md|txt)$/, "")}.json`);
  writeFileSync(outPath, JSON.stringify(candidates, null, 2));
  console.log(`\n→ ${outPath}`);
  console.log(`  ${candidates.length} candidates · please review before merging into main rules.json`);
}

// ============================================================================
// ============================================================================
// SECTION 3: merge-candidates (候选 → 主 rules.json + common/kunpeng-rules.json)
// ============================================================================
// 合并自 tools/merge-candidates.ts (323 行)
// ============================================================================
// ============================================================================

interface MergeSource {
  tier?: string;
  url?: string;
  title?: string;
  quote?: string;
  accessed?: string;
}

interface CandidateRule {
  id?: string;
  bucket?: number;
  severity?: string;
  metric_expr?: string;
  threshold?: string;
  reason?: string;
  recommend?: string;
  fix?: string;
  fix_cost?: string;
  source?: MergeSource;
  engine?: string;
  confidence?: string;
  refs?: string[];
  engine_version_min?: string | null;
  engine_version_max?: string | null;
  scope?: { arch?: string | null; vendor?: string | null; os?: string | null };
  _mined_from?: any;
}

function readFrontmatter(mdPath: string): { url?: string; tier?: string; title?: string } {
  if (!existsSync(mdPath)) return {};
  const content = readFileSync(mdPath, "utf8").slice(0, 2000);
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const raw: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*['"]?(.+?)['"]?\s*$/);
    if (kv) raw[kv[1].toLowerCase()] = kv[2];
  }
  const url = raw.source_url || raw.source || raw.url;
  const title = raw.title;
  let tier: string | undefined;
  if (raw.source_tier) tier = raw.source_tier;
  else if (raw.authority) {
    const a = raw.authority.toLowerCase();
    if (a.includes("kunpeng") || a.includes("huawei")) tier = "vendor-primary";
    else if (a.includes("official") || a.includes("mongodb")) tier = "official";
    else if (a.includes("blog") || a.includes("community")) tier = "community";
  }
  return { url, tier, title };
}

const SYNTHESIS_FALLBACK: Record<string, { url: string; tier: string; title: string }> = {
  "mongo-on-kunpeng-tuning.md": {
    url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html",
    tier: "vendor-primary",
    title: "鲲鹏 BoostKit · MongoDB 调优指南",
  },
  "kunpeng_arm64.md": {
    url: "https://www.hikunpeng.com/document/detail/zh/kunpengdevps/compiler/opg-bisheng/kunpengbisheng_30_0001.html",
    tier: "vendor-primary",
    title: "鲲鹏代码移植指南 · ARM64",
  },
};

function fillSourceFromFrontmatter(r: CandidateRule, candidateFile: string, engine: string): void {
  const parts = candidateFile.split("/");
  const fname = parts[parts.length - 1];
  const base = fname.replace(/^rules-candidates-/, "").replace(/\.json$/, "");
  for (const subdir of [engine, "common", "mongo"]) {
    for (const ext of [".md", ".txt"]) {
      const mdPath = join(skillDir(), "data", subdir, base + ext);
      if (!existsSync(mdPath)) continue;
      const fm = readFrontmatter(mdPath);
      const fb = SYNTHESIS_FALLBACK[base + ext];
      if (!r.source) r.source = {};
      if ((!r.source.url || r.source.url === "TBD") && (fm.url || fb?.url)) r.source.url = fm.url || fb!.url;
      if (!r.source.tier && (fm.tier || fb?.tier)) r.source.tier = fm.tier || fb!.tier;
      if (!r.source.title && (fm.title || fb?.title)) r.source.title = fm.title || fb!.title;
      if (!r.refs || r.refs.length === 0) r.refs = [base + ext];
      return;
    }
  }
}

function loadCandidates(engine: string): { file: string; rules: CandidateRule[] }[] {
  const dir = join(skillDir(), "data", engine);
  if (!existsSync(dir)) return [];
  const out: { file: string; rules: CandidateRule[] }[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.startsWith("rules-candidates-") || !f.endsWith(".json")) continue;
    const path = join(dir, f);
    try {
      const rules = JSON.parse(readFileSync(path, "utf8")) as CandidateRule[];
      out.push({ file: f, rules });
    } catch (e) {
      process.stderr.write(`skip ${f} · parse fail: ${(e as Error).message}\n`);
    }
  }
  const commonDir = join(skillDir(), "data", "common");
  if (existsSync(commonDir) && engine !== "common") {
    for (const f of readdirSync(commonDir)) {
      if (!f.startsWith("rules-candidates-") || !f.endsWith(".json")) continue;
      const path = join(commonDir, f);
      try {
        const rules = JSON.parse(readFileSync(path, "utf8")) as CandidateRule[];
        out.push({ file: `common/${f}`, rules });
      } catch (e) {
        process.stderr.write(`skip common/${f} · parse fail: ${(e as Error).message}\n`);
      }
    }
  }
  return out;
}

interface ValidationIssue { kind: string; msg: string }

function validateCandidate(r: CandidateRule, minQuoteLen: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const req = ["id", "bucket", "severity", "metric_expr", "reason", "recommend", "source"] as const;
  for (const k of req) {
    if (!(r as any)[k] || (typeof (r as any)[k] === "string" && !(r as any)[k].trim())) {
      issues.push({ kind: "missing", msg: `缺 ${k}` });
    }
  }
  if (r.bucket !== undefined && (r.bucket < 1 || r.bucket > 5)) {
    issues.push({ kind: "bucket_range", msg: `bucket=${r.bucket} 超 1-5` });
  }
  if (r.severity && !["CRITICAL", "WARNING", "INFO"].includes(r.severity)) {
    issues.push({ kind: "severity", msg: `severity=${r.severity} 非法` });
  }
  if (r.source) {
    if (!r.source.url || r.source.url.trim() === "TBD") {
      issues.push({ kind: "url_tbd", msg: `source.url 未填/TBD` });
    }
    if (!r.source.quote || r.source.quote.length < minQuoteLen) {
      issues.push({ kind: "quote_short", msg: `source.quote 长度 ${r.source.quote?.length ?? 0} < ${minQuoteLen}` });
    }
  }
  if (r.metric_expr && r.metric_expr.length < 5) {
    issues.push({ kind: "metric_short", msg: `metric_expr 过短` });
  }
  return issues;
}

function isKunpengScope(r: CandidateRule): boolean {
  if (r.engine === "any") return true;
  if (r.scope?.arch === "arm64") return true;
  if (r.scope?.vendor === "kunpeng") return true;
  if (r.id?.match(/^(kunpeng|arm64|openeuler)\./)) return true;
  const url = r.source?.url?.toLowerCase() ?? "";
  if (url.includes("hikunpeng.com") || url.includes("huaweicloud.com")) return true;
  return false;
}

function normalizeCandidate(r: CandidateRule, targetEngine: string): CandidateRule {
  const clone = { ...r } as CandidateRule;
  delete clone._mined_from;
  delete (clone as any)._source_file;
  if (!clone.refs || clone.refs.length === 0) {
    clone.refs = [basename((r as any)._source_file ?? "unknown")];
  }
  if (!clone.fix_cost) clone.fix_cost = "trivial";
  if (!clone.confidence) clone.confidence = "medium";
  if (isKunpengScope(r)) {
    clone.engine = "any";
    if (!clone.scope) clone.scope = {};
    if (!clone.scope.arch) clone.scope.arch = "arm64";
    if (!clone.scope.vendor) clone.scope.vendor = "kunpeng";
    if (clone.source) clone.source.tier = "vendor-primary";
  } else if (!clone.engine) {
    clone.engine = targetEngine;
  }
  return clone;
}

interface MergeOpts {
  engine: string;
  apply: boolean;
  dedupBy: string;
  minQuoteLen: number;
}

function runMerge(opts: MergeOpts): void {
  const targetEngine = opts.engine;
  const candidates = loadCandidates(targetEngine);
  const existingRules = JSON.parse(readFileSync(join(skillDir(), "data", targetEngine, "rules.json"), "utf8"));
  const existingIds = new Set<string>(existingRules.map((r: any) => r.id));
  const existingKunpengRules = existsSync(join(skillDir(), "data", "common", "kunpeng-rules.json"))
    ? JSON.parse(readFileSync(join(skillDir(), "data", "common", "kunpeng-rules.json"), "utf8"))
    : [];
  const existingKunpengIds = new Set<string>(existingKunpengRules.map((r: any) => r.id));

  console.log(`\n=== merge-candidates · engine=${targetEngine} ===\n`);
  console.log(`候选文件: ${candidates.length}`);
  console.log(`现有主库: ${existingRules.length} rules (${existingIds.size} ids)`);
  console.log(`现有鲲鹏: ${existingKunpengRules.length} rules (${existingKunpengIds.size} ids)\n`);

  let totalIn = 0, accepted = 0, rejected = 0, dupSkipped = 0;
  const toEngine: CandidateRule[] = [];
  const toKunpeng: CandidateRule[] = [];
  const rejects: { rule: CandidateRule; issues: ValidationIssue[] }[] = [];
  const seenIds = new Set<string>();

  for (const { file, rules } of candidates) {
    console.log(`--- ${file} · ${rules.length} 条候选 ---`);
    let fileAccepted = 0, fileRejected = 0;
    for (const r of rules) {
      totalIn++;
      (r as any)._source_file = file;
      fillSourceFromFrontmatter(r, file, targetEngine);
      const issues = validateCandidate(r, opts.minQuoteLen);
      if (issues.length > 0) {
        rejects.push({ rule: r, issues });
        rejected++; fileRejected++;
        continue;
      }
      const id = r.id!;
      if (existingIds.has(id) || existingKunpengIds.has(id) || seenIds.has(id)) {
        dupSkipped++;
        continue;
      }
      seenIds.add(id);
      const normalized = normalizeCandidate(r, targetEngine);
      if (isKunpengScope(r)) toKunpeng.push(normalized);
      else toEngine.push(normalized);
      accepted++; fileAccepted++;
    }
    console.log(`  接受 ${fileAccepted} · 拒绝 ${fileRejected}`);
  }

  console.log(`\n=== 汇总 ===`);
  console.log(`候选总数: ${totalIn}`);
  console.log(`接受(通过校验 · 非重复):${accepted}`);
  console.log(`  - 入主 ${targetEngine}/rules.json:${toEngine.length}`);
  console.log(`  - 入 common/kunpeng-rules.json:${toKunpeng.length}`);
  console.log(`重复 id(跳过):${dupSkipped}`);
  console.log(`拒绝(校验不过):${rejected}`);

  if (rejects.length > 0) {
    const byKind: Record<string, number> = {};
    for (const r of rejects) for (const i of r.issues) byKind[i.kind] = (byKind[i.kind] ?? 0) + 1;
    console.log(`\n拒绝原因分布:`);
    for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(18)} ${v}`);
    }
    console.log(`\n拒绝样例(前 3):`);
    for (const { rule, issues } of rejects.slice(0, 3)) {
      console.log(`  [${rule.id ?? "NO_ID"}] ${issues.map(i => i.msg).join(" · ")}`);
    }
  }

  if (!opts.apply) {
    console.log(`\n(预览模式 · 未写盘 · 加 --apply 实际 merge)`);
    return;
  }

  if (toEngine.length > 0) {
    const merged = [...existingRules, ...toEngine];
    const outPath = join(skillDir(), "data", targetEngine, "rules.json");
    writeFileSync(outPath, JSON.stringify(merged, null, 2));
    console.log(`\n→ ${outPath} · 新总数 ${merged.length}`);
  }
  if (toKunpeng.length > 0) {
    const merged = [...existingKunpengRules, ...toKunpeng];
    const outPath = join(skillDir(), "data", "common", "kunpeng-rules.json");
    writeFileSync(outPath, JSON.stringify(merged, null, 2));
    console.log(`→ ${outPath} · 新总数 ${merged.length}`);
  }
}

// ============================================================================
// ============================================================================
// SECTION 4: enrich-kb (seeds 加 keyword + topic_answer facts)
// ============================================================================
// 合并自 tools/enrich-kb.ts (259 行) · 已是合并产物 (keywords + targeted)
// ============================================================================
// ============================================================================

interface KeywordEnrichment { rule_id: string; synonyms: string }

const KEYWORDS: KeywordEnrichment[] = [
  { rule_id: "mongo-resources-thp-disabled-on-8x",        synonyms: "THP · 透明大页 · transparent huge pages · always · madvise · never · 三种模式 · 启用 · 禁用 · disable · enable · khugepaged · kernel thread · 扫描 4K 页 · 合并 2M 大页 · mm->page_table_lock · mongod 阻塞 · WT page fault" },
  { rule_id: "mongo-config-wt-cache-oversize",            synonyms: "WT cache 超过 50% · WiredTiger cache oversize · cache 过大 · 缓存过大 · 超过物理内存 · starve filesystem cache · 挤压 OS page cache · RAM 过度承诺 · 50 百分比 · 保守基线" },
  { rule_id: "kunpeng.irqbalance.active",                 synonyms: "irqbalance · IRQ balance · 中断均衡 · 关闭 irqbalance · stop irqbalance · disable irqbalance · 网卡中断 · NIC IRQ · smp_affinity · 绑核 · 绑定 IRQ · 鲲鹏 96 核" },
  { rule_id: "mongo-runtime-connection-pool-oversized",   synonyms: "连接池 · connection pool · 连接池大小 · pool size · 连接数 · 并发连接 · maxPoolSize · minPoolSize · mongo driver 连接池 · overload connections" },
  { rule_id: "mongo-runtime-ticket-queue-overload",       synonyms: "ticket queue · 票据队列 · queued read · queued write · storage engine transaction · tickets 打满 · queue overload · 并发事务 · storageEngineConcurrentReadTransactions · 阻塞排查" },
  { rule_id: "mongo-design-too-many-indexes-write-cost",  synonyms: "索引过多 · too many indexes · unnecessary indexes · 索引写放大 · write overhead · 写入代价 · write amplification · 索引维护成本 · 每次写操作更新所有索引 · B 树索引" },
  { rule_id: "arm64.lse.cpu_flag",                        synonyms: "LSE · Large System Extensions · atomics · ARMv8.1 原子指令 · 怎么检查 · 怎么查 · 验证 · lscpu 命令 · cpuinfo · BIOS 开关 · 鲲鹏 920 LSE · ldxr stxr 循环" },
  { rule_id: "kunpeng.smt.threads_per_core",              synonyms: "SMT · 超线程 · hyperthreading · 关超线程 · 多线程核心 · threads per core · 同步多线程 · 鲲鹏 920 SMT · Kunpeng HT · lscpu Thread 字段" },
  { rule_id: "os.io.disk_await_ms",                       synonyms: "磁盘 await · disk await · I/O 延迟 · iostat · r_await · w_await · 读延迟 · 写延迟 · 慢磁盘 · 响应时间 · 磁盘响应慢" },
  { rule_id: "os.io.disk_usage_pct",                      synonyms: "磁盘使用率 · disk usage · iostat %util · 设备繁忙 · 磁盘打满 · 85% 90% · 磁盘瓶颈 · IO bound · 磁盘饱和" },
  { rule_id: "mongo-config-oplog-window",                 synonyms: "oplog 窗口 · oplog window · replication lag · 副本同步窗口 · oplog size · 保留时间 · replication oplog 保留" },
  { rule_id: "mongo-config-index-build-memory-limit-spill", synonyms: "索引构建 spill · index build spill · 溢出到 _tmp · maxIndexBuildMemoryUsageMegabytes · 临时文件 · 内存不够 · 索引构建磁盘" },
];

function enrichKeywords(seeds: any[], db: Database.Database): { appended: number; skipped: number } {
  let appended = 0, skipped = 0;
  for (const e of KEYWORDS) {
    if (seeds.some(s => s.rule_id === e.rule_id && s.fact_type === "keywords")) {
      console.log(`skip (already in seeds): ${e.rule_id}`);
      skipped++;
      continue;
    }
    const sample = db.prepare(
      "SELECT engine, wait_class, arch, vendor, os, source_url, source_authority, engine_version_min_packed, engine_version_max_packed, engine_version_min_display, engine_version_max_display FROM knowledge WHERE rule_id=? LIMIT 1"
    ).get(e.rule_id) as any;
    if (!sample) { console.log(`skip (no rule in KB): ${e.rule_id}`); skipped++; continue; }

    const content = `查询关键词 / synonyms: ${e.synonyms}`;
    const hash = createHash("sha256").update(`${e.rule_id}|keywords|${content}`).digest("hex").slice(0, 16);

    seeds.push({
      rule_id: e.rule_id,
      fact_type: "keywords",
      wait_class: sample.wait_class,
      engine: sample.engine,
      engine_version_min_packed: sample.engine_version_min_packed,
      engine_version_max_packed: sample.engine_version_max_packed,
      engine_version_min_display: sample.engine_version_min_display,
      engine_version_max_display: sample.engine_version_max_display,
      arch: sample.arch,
      vendor: sample.vendor,
      os: sample.os,
      content_zh: content,
      content_en: null,
      language: "zh",
      source_url: sample.source_url,
      source_authority: sample.source_authority,
      quote: null,
      confidence: 1.0,
      scraped_at: new Date().toISOString().slice(0, 10),
      content_hash: hash,
    });
    appended++;
    console.log(`✓ keyword: ${e.rule_id}`);
  }
  return { appended, skipped };
}

interface TopicFact {
  rule_id: string;
  wait_class: string | null;
  arch: string | null;
  vendor: string | null;
  source_url: string;
  source_authority: string;
  content_zh: string;
}

const TOPICS: TopicFact[] = [
  {
    rule_id: "topic-thp-three-modes",
    wait_class: "内存", arch: null, vendor: null,
    source_url: "https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/",
    source_authority: "official",
    content_zh: "THP 三种模式区别 · always / madvise / never:\n" +
                "- always:对所有进程启用 THP · khugepaged 持续扫描合并 2M 大页 · MongoDB 7.0 及以下强烈不建议 · 造成 p99 抖动\n" +
                "- madvise:只对显式 madvise(MADV_HUGEPAGE) 的进程用大页 · mongod 默认不 madvise · 所以等价 never\n" +
                "- never:完全禁用 · MongoDB 7.0 官方推荐 · 写 echo never > /sys/kernel/mm/transparent_hugepage/enabled\n" +
                "- 8.0+:反而要求 always + defer+madvise defrag · 因为新 TCMalloc 利用大页",
  },
  {
    rule_id: "topic-khugepaged-blocks-mongod",
    wait_class: "内存", arch: null, vendor: null,
    source_url: "https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/",
    source_authority: "official",
    content_zh: "khugepaged 是 Linux 内核线程 · 周期扫描 4K 页尝试合并 2M 大页 · 扫描时短暂持有 mm->page_table_lock · mongod 的 WT page fault 必须等待 · 表现为 CPU sys% 15-30% · p99 延迟从毫秒跳到百毫秒级。是 mongo 7.0 必须关 THP 的直接原因。",
  },
  {
    rule_id: "topic-disk-await-threshold",
    wait_class: "I/O", arch: null, vendor: null,
    source_url: "https://www.redhat.com/sysadmin/linux-iostat",
    source_authority: "community",
    content_zh: "磁盘 await(iostat 的 r_await/w_await)多少算高 · 经验阈值:\n" +
                "- NVMe SSD:正常 < 1ms · 超过 5ms 警惕 · 超过 10ms 肯定瓶颈\n" +
                "- SATA SSD:正常 < 5ms · 超过 15ms 警惕\n" +
                "- HDD:正常 < 20ms · 超过 50ms 瓶颈\n" +
                "await 高常见原因:磁盘打满、queue 深度过浅、dirty_ratio 触发同步刷盘。用 iostat -x 1 观察 · 看 %util + await + svctm。",
  },
  {
    rule_id: "topic-disk-usage-85-risk",
    wait_class: "I/O", arch: null, vendor: null,
    source_url: "https://www.mongodb.com/docs/manual/administration/production-checklist-operations/",
    source_authority: "official",
    content_zh: "磁盘使用率(iostat %util)超 85% 风险 · 表示设备繁忙 · 吞吐接近上限 · 新 IO 请求必须排队。对 DB:\n" +
                "- WiredTiger checkpoint / journal fsync 延迟飙升\n" +
                "- mongod 写入 p99 从毫秒跳到秒级\n" +
                "- oplog 回放跟不上 · replica 同步滞后\n" +
                "应对:扩容 / 换更快磁盘 / 降 checkpoint 频率。别混 %util 和空间使用率:后者 <90% 通常可接受。",
  },
  {
    rule_id: "topic-how-to-check-lse",
    wait_class: "CPU", arch: "arm64", vendor: null,
    source_url: "https://www.hikunpeng.com/document/detail/zh/kunpengdevps/compiler/opg-bisheng/kunpengbisheng_30_0001.html",
    source_authority: "vendor-primary",
    content_zh: "怎么检查 CPU 是否支持 LSE(Large System Extensions · ARMv8.1 原子指令):\n" +
                "命令一(最直接):lscpu | grep -w atomics · 有 atomics flag 表示支持\n" +
                "命令二:cat /proc/cpuinfo | grep atomics\n" +
                "命令三(检查 mongod 二进制是否编译含 LSE opcode):objdump -d mongod | grep -c 'casa\\|casal\\|cas[bh]\\|ldadd' · 应 >=5000\n" +
                "若 CPU 硬件支持但 flag 无 · 检查 BIOS · 鲲鹏 920 机器默认开。",
  },
  {
    rule_id: "topic-kunpeng-smt-threads",
    wait_class: "CPU", arch: "arm64", vendor: "kunpeng",
    source_url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html",
    source_authority: "vendor-primary",
    content_zh: "Kunpeng 920 SMT 超线程(Hyperthreading 类)· threads per core 配置:\n" +
                "- 鲲鹏 920 原生支持 1 个 thread per core(无 SMT)· 不像 x86 Intel 有 2 threads/core\n" +
                "- lscpu 看 Thread(s) per core 字段 · 应为 1\n" +
                "- 所以鲲鹏不需要考虑关 SMT · 和 Intel DB 场景的'关 HT' 建议不适用\n" +
                "- 对 MongoDB:核心数按物理核算 · 不用额外除以 2",
  },
  {
    rule_id: "topic-oplog-window-size",
    wait_class: "并发", arch: null, vendor: null,
    source_url: "https://www.mongodb.com/docs/manual/core/replica-set-oplog/",
    source_authority: "official",
    content_zh: "oplog 窗口(oplog window)多长合适:\n" +
                "- oplog window = 现在 - oplog 最老记录时间 · 表示 secondary 可以落后多久\n" +
                "- 建议 ≥ 24 小时 · 给 secondary 维护窗口(重建索引 / 快照)\n" +
                "- < 1 小时 = 严重 · secondary 断开稍久就无法追上 · 必须全量重同步\n" +
                "- oplog size 默认 5% 可用磁盘 · 通常 50GB · 过小需 rs.resizeOplog() 扩\n" +
                "- 监控 replSetGetStatus 的 replicationInfo.timeDiffHours",
  },
  {
    rule_id: "topic-sharding-chunk-size",
    wait_class: "并发", arch: null, vendor: null,
    source_url: "https://www.mongodb.com/docs/manual/core/sharding-balancer-administration/",
    source_authority: "official",
    content_zh: "sharding chunk size 默认 128MB 够吗:\n" +
                "- MongoDB 6.0 起 chunk 概念替换为 range · 默认 128MB\n" +
                "- 小(< 64MB):balancer 迁移频繁 · 每次迁移 quiesce 目标 shard · 导致抖动\n" +
                "- 大(> 256MB):单 chunk 很难被 split · 热点集中在少数 chunk\n" +
                "- 推荐:OLTP 保 128MB · 大批量写工作负载 考虑 256MB · 配合 shard key 选择\n" +
                "- 调整 sh.configureCollectionBalancing · 不能低于 1MB 高于 1024MB",
  },
  {
    rule_id: "topic-ticket-queue-investigate",
    wait_class: "并发", arch: null, vendor: null,
    source_url: "https://www.mongodb.com/docs/manual/reference/parameters/",
    source_authority: "official",
    content_zh: "MongoDB ticket queue 打满怎么排查(storage engine 并发事务限流):\n" +
                "- 观察:db.serverStatus().wiredTiger.concurrentTransactions · 看 read/write 的 available 和 out\n" +
                "- available=0 · out=max 说明 tickets 全部占用 · 新请求排队\n" +
                "- 默认上限:WiredTiger 动态调整 · 7.0+ 起初始较低\n" +
                "- 诊断链:先看 currentOp · 看是哪类操作持锁 · collScan / 长事务 / 未索引查询是元凶\n" +
                "- 调参:storageEngineConcurrentReadTransactions / WriteTransactions · setParameter 生效 · 但先排查根因",
  },
  {
    rule_id: "topic-index-build-spill",
    wait_class: "I/O", arch: null, vendor: null,
    source_url: "https://www.mongodb.com/docs/manual/core/index-creation/",
    source_authority: "official",
    content_zh: "索引构建 spill 到 _tmp:\n" +
                "- 单次 createIndexes 命令共享 maxIndexBuildMemoryUsageMegabytes(默认 200MB)\n" +
                "- 超过后 mongod 在 --dbpath/_tmp 写临时文件 · 一般 .wt 格式\n" +
                "- 表现:索引构建慢 · 磁盘 I/O 飙 · 内存占用平稳\n" +
                "- 建议:调大 maxIndexBuildMemoryUsageMegabytes(如 1024MB) · 或降低并发 maxNumActiveUserIndexBuilds(默认 3)\n" +
                "- 高基数字段索引尤其吃内存 · 建议在业务低峰跑",
  },
];

function enrichTopics(seeds: any[]): { appended: number; skipped: number } {
  let appended = 0, skipped = 0;
  for (const t of TOPICS) {
    if (seeds.some(s => s.rule_id === t.rule_id)) { skipped++; continue; }
    const hash = createHash("sha256").update(`${t.rule_id}|topic_answer|${t.content_zh}`).digest("hex").slice(0, 16);
    seeds.push({
      rule_id: t.rule_id,
      fact_type: "topic_answer",
      wait_class: t.wait_class,
      engine: "mongo",
      engine_version_min_packed: null,
      engine_version_max_packed: null,
      engine_version_min_display: null,
      engine_version_max_display: null,
      arch: t.arch,
      vendor: t.vendor,
      os: null,
      content_zh: t.content_zh,
      content_en: null,
      language: "zh",
      source_url: t.source_url,
      source_authority: t.source_authority,
      quote: null,
      confidence: 0.9,
      scraped_at: new Date().toISOString().slice(0, 10),
      content_hash: hash,
    });
    appended++;
    console.log(`✓ topic: ${t.rule_id}`);
  }
  return { appended, skipped };
}

function runEnrich(): void {
  const seedsPath = join(skillDir(), "data", "seeds", "mongo-extended.json");
  const seeds = JSON.parse(readFileSync(seedsPath, "utf8")) as any[];
  const dbPath = join(skillDir(), "data", "knowledge.sqlite");
  const db = new Database(dbPath, { readonly: true });

  const k = enrichKeywords(seeds, db);
  const t = enrichTopics(seeds);

  writeFileSync(seedsPath, JSON.stringify(seeds, null, 2));
  console.log(`\ndone · keywords appended=${k.appended} skipped=${k.skipped}`);
  console.log(`done · topics   appended=${t.appended} skipped=${t.skipped}`);
  console.log(`seeds total=${seeds.length}`);
  db.close();
}

// ============================================================================
// ============================================================================
// SECTION 5: export-engine-rules (CheckFn → rules-candidates JSON)
// ============================================================================
// 合并自 tools/export-engine-rules.ts (164 行)
//
// 修复:原 hardcoded 路径已 broken (shared/{os,arm64,openeuler,kunpeng}-checks.ts
// 在 Phase 4 整合中合并到 shared/legacy-checks.ts)。本版引用新路径。
// ============================================================================
// ============================================================================

interface ExportCheckResult {
  id: string;
  title: string;
  severity: string;
  bucket?: number;
  scope?: any;
  summary?: string;
  description?: string;
  reason?: string;
  citations?: Array<{ title?: string; url: string }>;
  recommendations?: Array<{ action?: string; rationale?: string; fix_cost?: string }>;
  impact?: any;
}

const CHECK_MODULES = [
  "../src/shared/legacy-checks.js",      // 合并后包含 os/arm64/openeuler/kunpeng checks
  "../src/engines/mongo/checks.js",
];

function badCtx(): any {
  return {
    db_type: "mongo",
    os_metrics: {
      arch: "aarch64",
      cpu_vendor: "hisilicon",
      cpu_model: "Kunpeng-920",
      os_id: "openeuler",
      os_version: "22.03",
      kernel: "5.10.0",
      thp_status: "[always] madvise never",
      thp_defrag: "[always] defer defer+madvise madvise never",
      page_size: 4096,
      nr_hugepages: 1024,
      numa_nodes: 4,
      numa_distance: "0=10 20; 1=20 10",
      cpu_governor: "powersave",
      numa_balancing: "1",
      smt_threads_per_core: "1",
      irqbalance_active: "inactive",
      vm_swappiness: 60,
      vm_dirty_ratio: 20,
      vm_dirty_background_ratio: 10,
      vm_zone_reclaim_mode: "1",
      vm_max_map_count: 65536,
      vm_overcommit_memory: 0,
      tcp_keepalive_time: 7200,
      tcp_keepalive_intvl: 75,
      tcp_keepalive_probes: 9,
      somaxconn: 128,
      tcp_max_syn_backlog: 128,
      tcp_retrans_pct: 5.0,
      io_scheduler: "cfq",
      disk_await_ms: 50,
      disk_usage_pct: 90,
      cmdline: "nohz=off",
      sched_features: "NO_STEAL NO_STEAL_NODE_LIMIT",
      sched_steal_node_limit: 1,
      lse_cpu_atomics: false,
      lse_cpu_raw: "Flags: fp asimd",
      lse_kernel_dmesg: "",
      binary_lse_opcode_count: 0,
    },
    db_metrics: {
      version: "7.0.5",
      wt_cache_bytes: 16 * 1024 * 1024 * 1024,
      memory_total_mb: 16 * 1024,
      connections_current: 500,
      connections_available: 100,
      oplog_window_hours: 1,
      wt_block_compressor: "none",
    },
  };
}

async function runExportChecks(): Promise<void> {
  const out: any[] = [];
  for (const modPath of CHECK_MODULES) {
    let mod: Record<string, any>;
    try {
      mod = await import(modPath);
    } catch (e) {
      process.stderr.write(`skip ${modPath}: ${(e as Error).message}\n`);
      continue;
    }
    for (const [name, fn] of Object.entries(mod)) {
      if (!name.startsWith("check_")) continue;
      if (typeof fn !== "function") continue;
      let r: ExportCheckResult | undefined;
      try { r = (fn as any)(badCtx()) as ExportCheckResult; } catch (e) {
        process.stderr.write(`  ${name} throw: ${(e as Error).message}\n`);
        continue;
      }
      if (!r || !r.id) continue;
      const rec = r.recommendations?.[0];
      const firstCite = r.citations?.[0];
      if (!firstCite?.url) {
        process.stderr.write(`  ${name} (sev=${r.severity}) · no citation · skip\n`);
        continue;
      }

      const sev = r.severity === "critical" ? "CRITICAL" : r.severity === "warning" ? "WARNING" : "INFO";
      out.push({
        id: r.id,
        bucket: r.bucket ?? 1,
        severity: sev,
        metric_expr: `engine-check:${r.id}`,
        threshold: "engine-internal",
        reason: r.reason ?? r.summary ?? r.description ?? r.title,
        recommend: rec?.rationale ?? rec?.action ?? "参见 engine citation",
        fix: rec?.action ?? "",
        fix_cost: rec?.fix_cost ?? "trivial",
        source: {
          tier: firstCite.url.includes("hikunpeng") ? "vendor-primary"
              : firstCite.url.includes("mongodb.com") ? "official"
              : firstCite.url.includes("openeuler") ? "official"
              : "community",
          url: firstCite.url,
          title: firstCite.title ?? r.title,
          quote: `${r.title}:${r.description ?? r.reason ?? r.summary ?? ""}`.slice(0, 300),
          accessed: new Date().toISOString().slice(0, 10),
        },
        engine: r.id.startsWith("mongo.") ? "mongo"
              : r.id.match(/^(kunpeng|arm64|openeuler)\./) ? "any"
              : "any",
        confidence: "high",
        refs: [modPath.split("/").pop() ?? "engine"],
        scope: r.scope ?? null,
        _from_engine: true,
      });
    }
  }

  const outPath = join(skillDir(), "data", "mongo", "rules-candidates-engine-checks.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`exported ${out.length} rules from engine checks → ${outPath}`);
}

// ============================================================================
// ============================================================================
// TOP-LEVEL DISPATCHER
// ============================================================================
// ============================================================================

function printUsage(): void {
  process.stdout.write(
`Usage: kb-build --op <subcommand> [options]

Subcommands:
  --op init           sqlite schema 初始化 (--force 清空)
  --op extract        rules.json → 4 种 auto fact
  --op augment        OpenAI 扩展 mechanism/trade_off/when_deviate (需 OPENAI_API_KEY)
  --op build          init + extract + 合并 extended + embed → sqlite
  --op rebuild-from-verified  cleaner v5 字面验过的 facts → 重建 sqlite (红线收紧主路径)
  --op stats          sqlite 统计
  --op mine           OpenAI 蒸馏 markdown → rule 候选 (需 OPENAI_API_KEY · --source)
  --op merge          候选 → 主 rules.json (--engine · --apply)
  --op enrich         seeds 加 keyword + topic_answer facts
  --op export-checks  CheckFn → rules-candidates JSON

Options (按 subcommand 各自适用):
  --db <path>           sqlite 路径 (默认 data/knowledge.sqlite)
  --model <dir>         MiniLM 模型缓存目录
  --seeds-dir <dir>     seeds 目录 (augment/build)
  --engine <name>       mongo (默认 mongo)
  --rule-id <id>        augment 限定单 rule (支持 partial)
  --llm-model <name>    augment OpenAI model (默认 gpt-4o-mini)
  --source <path>       mine 源 .md 路径
  --limit <N>           处理上限
  --min-chars <N>       mine section 最短字符数 (默认 400)
  --min-quote-len <N>   merge quote 最短字符数 (默认 40)
  --dedup-by <id|quote> merge 去重策略 (默认 id)
  --apply               merge 实际写盘 (不加只预览)
  --dry-run             augment/mine 不写盘
  --force               build/init 清空旧 sqlite
  --verified-input <p>  rebuild-from-verified · cleaner v5 *-verified.json
  --rules-input <p>     rebuild-from-verified · cleaner v5 输入 rules JSON (拿 metadata)
  --verbose             mine 打印 raw OpenAI 响应
  --help, -h            打印本帮助

Examples:
  node kb-build.js --op build --engine mongo --force
  node kb-build.js --op stats
  OPENAI_API_KEY=sk-... node kb-build.js --op mine --source data/mongo/foo.md --engine mongo
  node kb-build.js --op merge --engine mongo --apply
`,
  );
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "op":            { type: "string" },
      "engine":        { type: "string" },
      "db":            { type: "string" },
      "model":         { type: "string" },
      "seeds-dir":     { type: "string" },
      "rule-id":       { type: "string" },
      "llm-model":     { type: "string" },
      "source":        { type: "string" },
      "limit":         { type: "string" },
      "min-chars":     { type: "string", default: "400" },
      "min-quote-len": { type: "string", default: "40" },
      "dedup-by":      { type: "string", default: "id" },
      "apply":         { type: "boolean", default: false },
      "dry-run":       { type: "boolean", default: false },
      "force":         { type: "boolean", default: false },
      "verbose":       { type: "boolean", default: false },
      "help":          { type: "boolean", short: "h", default: false },
      "verified-input":{ type: "string" },
      "rules-input":   { type: "string" },
      "html-cache":    { type: "string" },
    },
    allowPositionals: true,
  });

  if (values.help || !values.op) {
    printUsage();
    process.exit(values.help ? 0 : 1);
  }

  const op = values.op!;
  const dbPath = values.db ?? join(skillDir(), "data", "knowledge.sqlite");
  const modelDir = values.model ?? join(skillDir(), "data", "models");
  const seedsDir = values["seeds-dir"] ?? join(skillDir(), "data", "seeds");

  if (values.engine && !SUPPORTED_ENGINES.includes(values.engine as typeof SUPPORTED_ENGINES[number])) {
    process.stderr.write(`unsupported engine: ${values.engine} · supported: ${SUPPORTED_ENGINES.join(", ")}\n`);
    process.exit(1);
  }
  const engines = values.engine ? [values.engine] : [...DEFAULT_ENGINES];

  switch (op) {
    case "init":
      return cmdInit(dbPath, values.force ?? false);

    case "extract":
      await cmdExtract(engines);
      return;

    case "augment":
      return cmdAugment(engines, {
        model:     values["llm-model"] ?? "gpt-4o-mini",
        ruleId:    values["rule-id"],
        outputDir: seedsDir,
        dryRun:    values["dry-run"] ?? false,
        limit:     values.limit ? Number(values.limit) : 1000,
      });

    case "build":
      return cmdBuild(dbPath, engines, modelDir, values.force ?? false, seedsDir);

    case "rebuild-from-verified":
      if (!values["verified-input"] || !values["rules-input"]) {
        process.stderr.write("--op rebuild-from-verified 需要 --verified-input <path> + --rules-input <path>\n");
        process.exit(1);
      }
      return cmdRebuildFromVerified(dbPath, modelDir, values["verified-input"]!, values["rules-input"]!, values["html-cache"]);

    case "stats":
      cmdStats(dbPath);
      return;

    case "mine":
      if (!values.source) {
        process.stderr.write("--op mine requires --source <md path>\n");
        process.exit(1);
      }
      return runMine({
        source:   values.source!,
        engine:   values.engine ?? "mongo",
        model:    values["llm-model"] ?? "gpt-4o-mini",
        limit:    values.limit ? Number(values.limit) : null,
        minChars: Number(values["min-chars"]),
        dryRun:   values["dry-run"] ?? false,
        verbose:  values.verbose ?? false,
      });

    case "merge":
      runMerge({
        engine:      values.engine ?? "mongo",
        apply:       values.apply ?? false,
        dedupBy:     values["dedup-by"] ?? "id",
        minQuoteLen: Number(values["min-quote-len"]),
      });
      return;

    case "enrich":
      runEnrich();
      return;

    case "export-checks":
      return runExportChecks();

    default:
      process.stderr.write(`unknown --op: ${op}\n`);
      printUsage();
      process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch(err => {
    process.stderr.write(`kb-build error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  });
}
