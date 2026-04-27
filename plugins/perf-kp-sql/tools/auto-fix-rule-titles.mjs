#!/usr/bin/env node
// auto-fix-rule-titles.mjs
// 用 auto-rewrite 残留 (title-issue 类) 驱动的批量 title 修复。
// 对每个 rule_id, 让 OpenAI 从 rule_id + 一条 sample quote 派生一个简短中文 title (4-12 字)。
// 落到:
//   - rules 表 (kebab-case rule_id 主要在这)
//   - data/**/rules.json 的 source.title (兜底, 大多数 kebab rule 在 json 里)
//
// 用法:
//   node plugins/perf-kp-sql/tools/auto-fix-rule-titles.mjs --dry-run
//   node plugins/perf-kp-sql/tools/auto-fix-rule-titles.mjs --apply
//
// 成本: ~109 rules × 200 in + 50 out @ gpt-4o-mini ≈ $0.005

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
    residue: { type: "string", default: "/tmp/auto-rewrite-residue.json" },
    apply: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    out: { type: "string", default: "/tmp/auto-fix-titles-report.json" },
    model: { type: "string", default: "gpt-4o-mini" },
    concurrency: { type: "string", default: "5" },
  },
  strict: true,
}).values;
const APPLY = args.apply && !args["dry-run"];
const CONCURRENCY = Math.max(1, Math.min(16, parseInt(args.concurrency, 10)));

let apiKey = process.env.OPENAI_API_KEY;
if (!apiKey && existsSync(KEY_FILE)) apiKey = readFileSync(KEY_FILE, "utf8").trim();
if (!apiKey) { console.error(`✗ OPENAI_API_KEY 未设`); process.exit(2); }

const Database = require(`${PLUGIN_ROOT}/../../node_modules/better-sqlite3/lib/index.js`);

// 收集 title-issue rule_id → 一条样本 quote (取最长那条最有信息量)
const residue = JSON.parse(readFileSync(args.residue, "utf8")).residue;
const titleIssues = residue.filter(x => /title|id_hits/.test(x.residue_reason));
const byRule = new Map();
for (const x of titleIssues) {
  const cur = byRule.get(x.rule_id);
  if (!cur || (x.quote_first_120?.length ?? 0) > (cur.sample.length ?? 0)) {
    byRule.set(x.rule_id, { current_title: x.title, sample: x.quote_first_120 ?? "" });
  }
}
const rules = [...byRule.entries()];
console.log(`title-issue rules: ${rules.length}  apply=${APPLY}`);

const SYSTEM = `You generate a precise short title for a perf-tuning knowledge-base rule.

Input:
- rule_id (kebab-case or dot-case · ground truth for topic)
- current_title_wrong (existing title that an audit flagged as wrong)
- sample_quote (a verbatim sentence from the rule's source URL · helps disambiguate)

Output strict JSON (no prose, no markdown):
{ "new_title_zh": "<≤14 个汉字 / 28 个 ASCII, 简洁, 含核心参数名 / 行为词>", "reason": "<≤80 chars why>" }

Title rules:
- 必须把 rule_id 拆出的核心 token (e.g. swappiness / tcmalloc / disk_await / wt_cache_dirty) 直接用 ASCII 写进去
- 不要用过宽的词 (Memory Use / Index Metrics / Transaction Concurrency 这种页面节段名)
- 不要重复 rule_id 整段 (变成机器风的占位)
- 中文优先 · 但参数名 / 命令名保留原文 (e.g. "WT cache 大小配置", "vm.swappiness 检查", "iostat await 阈值")`;

const OpenAI = (await import(`${PLUGIN_ROOT}/../../node_modules/openai/index.mjs`)).default;
const client = new OpenAI({ apiKey });

const proposals = [];
let done = 0;
let totalIn = 0, totalOut = 0;

async function genTitle(rule_id, info) {
  try {
    const resp = await client.chat.completions.create({
      model: args.model, temperature: 0,
      response_format: { type: "json_object" },
      prompt_cache_key: "kb-title-fix-v1",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `rule_id: ${rule_id}\ncurrent_title_wrong: ${info.current_title}\nsample_quote: ${info.sample.slice(0, 200)}` },
      ],
    });
    totalIn += resp.usage?.prompt_tokens ?? 0;
    totalOut += resp.usage?.completion_tokens ?? 0;
    const parsed = JSON.parse(resp.choices?.[0]?.message?.content ?? "{}");
    proposals.push({ rule_id, current_title: info.current_title, new_title: parsed.new_title_zh ?? "(empty)", reason: parsed.reason ?? "" });
  } catch (e) {
    proposals.push({ rule_id, current_title: info.current_title, new_title: null, error: e.message?.slice(0, 120) });
  }
  done++;
  if (done % 20 === 0 || done === rules.length) process.stderr.write(`  ${done}/${rules.length}\n`);
}

async function runAll() {
  const queue = [...rules];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const r = queue.shift(); if (!r) break;
      await genTitle(r[0], r[1]);
    }
  }));
}
await runAll();

// ---- apply ----
let appliedRules = 0, appliedJson = 0;
if (APPLY) {
  const db = new Database(SQLITE);
  const updRules = db.prepare("UPDATE rules SET title=? WHERE rule_id=?");
  for (const p of proposals) {
    if (!p.new_title) continue;
    const r = updRules.run(p.new_title, p.rule_id);
    if (r.changes > 0) appliedRules++;
  }
  db.close();

  // rules.json: source.title
  function walkJson(dir, fn) {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walkJson(p, fn);
      else if (f.endsWith("rules.json")) fn(p);
    }
  }
  walkJson(`${PLUGIN_ROOT}/data`, (path) => {
    const list = JSON.parse(readFileSync(path, "utf8"));
    let changed = false;
    for (const r of list) {
      const p = proposals.find(pp => pp.rule_id === r.id && pp.new_title);
      if (p && r.source && r.source.title !== p.new_title) {
        r.source.title = p.new_title;
        changed = true; appliedJson++;
      }
    }
    if (changed) writeFileSync(path, JSON.stringify(list, null, 2) + "\n");
  });
}

const cost = totalIn * 0.15e-6 + totalOut * 0.6e-6;
const summary = { rules_processed: proposals.length, applied_rules_table: appliedRules, applied_rules_json: appliedJson, tokens: { in: totalIn, out: totalOut }, cost_usd: +cost.toFixed(4) };
writeFileSync(args.out, JSON.stringify({ summary, proposals }, null, 2));
console.log("\n=== title-fix 报告 ===");
console.log(JSON.stringify(summary, null, 2));
console.log("\n样本 8 条:");
for (const p of proposals.slice(0, 8)) {
  console.log(`  ${p.rule_id}\n     旧: ${p.current_title}\n     新: ${p.new_title}`);
}
console.log(`\n报告 → ${args.out}`);
if (!APPLY) console.log("⚠ DRY RUN: --apply 才落库");
