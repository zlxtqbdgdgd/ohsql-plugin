#!/usr/bin/env node
// audit-openai-reverse-check.mjs · 军规 4 二次校验
//
// 给 OpenAI 一个 (rule_title, source_url, quote) 三元组,让它独立判
// "这段引文是否支持这条规则的判定" → pass / fail / uncertain。
// 与 lint-kb-quotes.mjs 互补: lint 只查字面命中, 这里查语义切题。
//
// 用法:
//   export OPENAI_API_KEY=...                      # 或写到 ~/.ohsql/secrets/openai.key
//   node plugins/perf-kp-sql/tools/audit-openai-reverse-check.mjs --limit 10
//   node plugins/perf-kp-sql/tools/audit-openai-reverse-check.mjs --filter '^mongo\.runtime\.' --limit 50
//   node plugins/perf-kp-sql/tools/audit-openai-reverse-check.mjs --all --concurrency 5
//   node plugins/perf-kp-sql/tools/audit-openai-reverse-check.mjs --in-plan /tmp/topic-audit-plan.json
//
// 成本: 1828 facts × ~600 token in + 80 token out @ gpt-4o-mini ≈ $0.20

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, "..");
const SQLITE = `${PLUGIN_ROOT}/data/knowledge.sqlite`;
const KEY_FILE = `${process.env.HOME}/.ohsql/secrets/openai.key`;

const args = parseArgs({
  options: {
    limit: { type: "string", default: "10" },
    filter: { type: "string", default: "" },
    all: { type: "boolean", default: false },
    concurrency: { type: "string", default: "5" },
    out: { type: "string", default: "/tmp/openai-reverse-check-report.json" },
    model: { type: "string", default: "gpt-4o-mini" },
    "in-plan": { type: "string", default: "" },
    "dry-run": { type: "boolean", default: false },
  },
  strict: true,
}).values;

const LIMIT = args.all ? Infinity : parseInt(args.limit, 10);
const FILTER = args.filter ? new RegExp(args.filter) : null;
const CONCURRENCY = Math.max(1, Math.min(16, parseInt(args.concurrency, 10)));
const OUT = args.out;
const MODEL = args.model;
const IN_PLAN = args["in-plan"];
const DRY = args["dry-run"];

// API key
let apiKey = process.env.OPENAI_API_KEY;
if (!apiKey && existsSync(KEY_FILE)) apiKey = readFileSync(KEY_FILE, "utf8").trim();
if (!apiKey && !DRY) {
  console.error(`✗ OPENAI_API_KEY 未设 (env 或 ${KEY_FILE} 都没找到)`);
  process.exit(2);
}

// Title map: rule_id → title (从 src/engines/**/*.ts 抽 const id="..."; const title="...")
function loadRuleTitleMap() {
  const m = new Map();
  const root = `${PLUGIN_ROOT}/src/engines`;
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith(".ts")) {
        const src = readFileSync(p, "utf8");
        const re = /const\s+id\s*=\s*["']([^"']+)["'][\s\S]{0,200}?const\s+title\s*=\s*["']([^"']+)["']/g;
        for (const match of src.matchAll(re)) {
          if (!m.has(match[1])) m.set(match[1], match[2]);
        }
      }
    }
  }
  walk(root);
  return m;
}
const TITLE_MAP = loadRuleTitleMap();

// 同时从 rules 表抽 title 兜底 (kebab-case 老规则用)
function augmentTitleFromRulesTable(db) {
  const rows = db.prepare("SELECT rule_id, title FROM rules WHERE title IS NOT NULL").all();
  for (const r of rows) if (!TITLE_MAP.has(r.rule_id)) TITLE_MAP.set(r.rule_id, r.title);
}

// 从 rules.json 抽 source.title 作为最后兜底 (鲲鹏 / Mongo 通用 rules)
function augmentTitleFromJson() {
  const dataDir = `${PLUGIN_ROOT}/data`;
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith("rules.json")) {
        const list = JSON.parse(readFileSync(p, "utf8"));
        for (const r of list) {
          if (r.id && r.source?.title && !TITLE_MAP.has(r.id)) TITLE_MAP.set(r.id, r.source.title);
        }
      }
    }
  }
  walk(dataDir);
}

const Database = require(`${PLUGIN_ROOT}/../../node_modules/better-sqlite3/lib/index.js`);
const db = new Database(SQLITE, { readonly: true });
augmentTitleFromRulesTable(db);
augmentTitleFromJson();

// 取要审的 facts
let rows;
if (IN_PLAN) {
  // 从 v3 topic-audit plan 里拿 (rule_id, source_url) 重判
  const plan = JSON.parse(readFileSync(IN_PLAN, "utf8"));
  const seen = new Set();
  rows = [];
  for (const p of plan.plan ?? plan) {
    const key = `${p.rule_id}::${p.source_url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // 取一条该 rule 的 fact 当代表
    const r = db.prepare("SELECT id, rule_id, fact_type, source_url, quote FROM knowledge WHERE rule_id=? AND source_url=? LIMIT 1").get(p.rule_id, p.source_url);
    if (r) rows.push(r);
  }
} else {
  rows = db.prepare("SELECT id, rule_id, fact_type, source_url, quote FROM knowledge WHERE quote IS NOT NULL AND quote != ''").all();
}
db.close();

if (FILTER) rows = rows.filter(r => FILTER.test(r.rule_id));
if (rows.length > LIMIT) rows = rows.slice(0, LIMIT);

console.log(`待审 facts: ${rows.length}  model=${MODEL}  concurrency=${CONCURRENCY}  dry-run=${DRY}`);
if (rows.length === 0) { console.error("没有匹配 fact"); process.exit(0); }

// ---- prompt ----
const SYSTEM = `You are an independent technical reviewer for a database / OS performance-tuning knowledge base. Each entry consists of:
  • rule_title — the topic that an automated check claims to evaluate
  • source_url — the documentation URL the entry cites
  • quote — a verbatim sentence taken from that URL

Your job: judge whether the QUOTE actually supports / is on-topic for the RULE_TITLE. The URL is given for context only — do not browse. Judge purely from the title vs quote semantic alignment, assuming the quote was indeed taken verbatim from that URL.

Output strict JSON (no prose, no markdown fence):
  { "verdict": "pass" | "fail" | "uncertain", "reason": "<≤140 chars · why>" }

verdict guide:
  • pass — quote is clearly about the rule's topic (e.g. rule about "WT cache size" + quote talks about WiredTiger cache size config)
  • fail — quote is about an unrelated topic (e.g. rule about "swappiness" + quote about TLS / replication / write concern)
  • uncertain — borderline; quote is tangentially related but doesn't directly support the rule's claim`;

if (DRY) {
  console.log("=== DRY RUN · system prompt + 1 sample user message ===");
  console.log("--- SYSTEM ---");
  console.log(SYSTEM);
  console.log("\n--- USER (sample) ---");
  const r = rows[0];
  const t = TITLE_MAP.get(r.rule_id) ?? r.rule_id;
  console.log(`rule_title: ${t}\nsource_url: ${r.source_url}\nquote: ${r.quote}\n\nVerdict?`);
  process.exit(0);
}

// ---- run ----
const OpenAI = (await import(`${PLUGIN_ROOT}/../../node_modules/openai/index.mjs`)).default;
const client = new OpenAI({ apiKey });

const results = [];
let done = 0;
const startMs = Date.now();

async function judge(row) {
  const title = TITLE_MAP.get(row.rule_id) ?? row.rule_id;
  const userMsg = `rule_title: ${title}\nsource_url: ${row.source_url}\nquote: ${row.quote}\n\nVerdict?`;
  try {
    const resp = await client.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      // OpenAI auto-caches ≥1024-token system prompts. prompt_cache_key 提高命中稳定性
      // (SDK v4.72+ 支持; 不支持时只是少 cache 命中, 不报错)
      ...(typeof client.chat.completions.create === "function" ? { prompt_cache_key: "kb-reverse-check-v1" } : {}),
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMsg },
      ],
    });
    const txt = resp.choices?.[0]?.message?.content ?? "";
    let parsed;
    try { parsed = JSON.parse(txt); } catch { parsed = { verdict: "uncertain", reason: `unparseable: ${txt.slice(0,80)}` }; }
    return {
      id: row.id, rule_id: row.rule_id, fact_type: row.fact_type, source_url: row.source_url,
      title, quote_first_120: row.quote.slice(0, 120),
      verdict: parsed.verdict ?? "uncertain", reason: parsed.reason ?? "(no reason)",
      tokens: resp.usage,
    };
  } catch (e) {
    return {
      id: row.id, rule_id: row.rule_id, fact_type: row.fact_type, source_url: row.source_url,
      title, quote_first_120: row.quote.slice(0, 120),
      verdict: "error", reason: e.message?.slice(0, 200) ?? String(e),
      tokens: null,
    };
  } finally {
    done++;
    if (done % 5 === 0 || done === rows.length) {
      const elapsedSec = (Date.now() - startMs) / 1000;
      const rate = done / elapsedSec;
      const remaining = (rows.length - done) / rate;
      process.stderr.write(`  ${done}/${rows.length} · ${rate.toFixed(1)}/s · ETA ${remaining.toFixed(0)}s\n`);
    }
  }
}

// 简单并发控制
async function runWithConcurrency() {
  const queue = [...rows];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const r = queue.shift();
      if (!r) break;
      const out = await judge(r);
      results.push(out);
    }
  });
  await Promise.all(workers);
}

await runWithConcurrency();

// 汇总
const summary = { total: results.length, pass: 0, fail: 0, uncertain: 0, error: 0 };
for (const r of results) summary[r.verdict] = (summary[r.verdict] ?? 0) + 1;

// 按 rule_id 聚合 (一条规则可能多 fact 多 URL)
const byRule = {};
for (const r of results) {
  (byRule[r.rule_id] ??= []).push({ fact_type: r.fact_type, verdict: r.verdict, reason: r.reason });
}

const totalTokensIn  = results.reduce((s, r) => s + (r.tokens?.prompt_tokens ?? 0), 0);
const totalTokensOut = results.reduce((s, r) => s + (r.tokens?.completion_tokens ?? 0), 0);
const totalCachedIn  = results.reduce((s, r) => s + (r.tokens?.prompt_tokens_details?.cached_tokens ?? 0), 0);

writeFileSync(OUT, JSON.stringify({ summary, byRule, results, model: MODEL, totalTokensIn, totalTokensOut, totalCachedIn }, null, 2));
console.log("\n=== reverse-check 报告 ===");
console.log(JSON.stringify(summary, null, 2));
console.log(`tokens · in=${totalTokensIn} (cached=${totalCachedIn}) · out=${totalTokensOut}`);
console.log(`报告 → ${OUT}`);

const fails = results.filter(r => r.verdict === "fail");
if (fails.length > 0) {
  console.log(`\n--- FAIL ${fails.length} 条 ---`);
  for (const f of fails.slice(0, 20)) {
    console.log(`  [${f.fact_type}] ${f.rule_id}\n     title: ${f.title}\n     quote: ${f.quote_first_120}\n     why:   ${f.reason}`);
  }
  if (fails.length > 20) console.log(`  ... +${fails.length - 20} more`);
}
