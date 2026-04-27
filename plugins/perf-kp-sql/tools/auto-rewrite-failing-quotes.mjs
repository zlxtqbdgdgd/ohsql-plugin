#!/usr/bin/env node
// auto-rewrite-failing-quotes.mjs
// 用 D 反向校验报告 (/tmp/openai-reverse-check-full.json) 驱动的批量 quote 重写。
//
// 流程:
//   1. 读 D 报告, 取所有 verdict==fail 的 fact (rule_id, fact_type, source_url, current_quote)
//   2. 对每条 fail fact:
//      a) 装载 cached source_url 的全文
//      b) 用 3-gate scoring 抽 8-15 条候选 verbatim 句子 (id-token + title-token)
//      c) 给 OpenAI 选最佳 (返回 index 或 -1=没有 on-topic 句子)
//      d) 若选中: 更新 sqlite + knowledge_fts (新 quote 一定 verbatim, 由候选构造保证)
//      e) 若 -1 / 无候选: 记入 residue 报告 (留给人手或换 URL)
//   3. 全跑完 lint baseline 复测 + 报告 fixed/residue
//
// 用法:
//   node plugins/perf-kp-sql/tools/auto-rewrite-failing-quotes.mjs --dry-run --limit 10
//   node plugins/perf-kp-sql/tools/auto-rewrite-failing-quotes.mjs --apply --concurrency 8
//   node plugins/perf-kp-sql/tools/auto-rewrite-failing-quotes.mjs --apply --filter '^os\.'
//
// 成本: 837 fail facts × ~1.5K token (候选 + 提示) + 50 token out @ gpt-4o-mini ≈ $0.20

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
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
    cache: { type: "string", default: "/tmp/audit-cache" },
    report: { type: "string", default: "/tmp/openai-reverse-check-full.json" },
    apply: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    filter: { type: "string", default: "" },
    limit: { type: "string", default: "" },
    concurrency: { type: "string", default: "5" },
    out: { type: "string", default: "/tmp/auto-rewrite-report.json" },
    residue: { type: "string", default: "/tmp/auto-rewrite-residue.json" },
    model: { type: "string", default: "gpt-4o-mini" },
    "max-candidates": { type: "string", default: "12" },
  },
  strict: true,
}).values;

const CACHE = args.cache;
const APPLY = args.apply && !args["dry-run"];
const FILTER = args.filter ? new RegExp(args.filter) : null;
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity;
const CONCURRENCY = Math.max(1, Math.min(16, parseInt(args.concurrency, 10)));
const OUT = args.out;
const RESIDUE = args.residue;
const MODEL = args.model;
const MAX_CANDS = parseInt(args["max-candidates"], 10);

let apiKey = process.env.OPENAI_API_KEY;
if (!apiKey && existsSync(KEY_FILE)) apiKey = readFileSync(KEY_FILE, "utf8").trim();
if (!apiKey) { console.error(`✗ OPENAI_API_KEY 未设 (env 或 ${KEY_FILE} 都没找到)`); process.exit(2); }

// ---- helpers (复用 auto-shrink-quotes.mjs 的 canonical / loadRawAndCanon / topicTokens / quoteTokens / splitSentences) ----
function urlHash(u) { return createHash("sha1").update(u).digest("hex").slice(0, 12); }
function canonical(s) {
  return String(s ?? "")
    .replace(/&#x27;|&#39;|&apos;/gi, "'").replace(/&quot;|&#34;/gi, '"')
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ").replace(/&hellip;/gi, "...")
    .replace(/[\u2018\u2019\u201A\u201B`]/g, "'").replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-").replace(/\u00A0/g, " ")
    .replace(/[“”‘’]/g, "'").replace(/[（]/g, "(").replace(/[）]/g, ")")
    .replace(/[，]/g, ",").replace(/[。]/g, ".").replace(/[；]/g, ";")
    .replace(/\s+/g, " ").trim().toLowerCase();
}
function loadRaw(url) {
  for (const cand of [url, url.split("#")[0]]) {
    const p = join(CACHE, `${urlHash(cand)}.txt`);
    if (existsSync(p)) return readFileSync(p, "utf8").replace(/\s+/g, " ").trim();
  }
  return null;
}
const ID_STOPWORDS = new Set(["mongo","mysql","redis","kunpeng","arm64","openeuler","config","runtime","storage","platform","size","value","default","check","total","count","limit","status","strict","linux","kernel","data","main","bytes","ratio","percent","threshold","level","mode","type","name"]);
function topicTokensFromId(id) {
  const out = new Set();
  String(id).split(/[.\-]/).forEach(seg => {
    seg = seg.toLowerCase();
    if (seg.length >= 4 && !ID_STOPWORDS.has(seg)) {
      out.add(seg);
      seg.split("_").forEach(sub => { if (sub.length >= 4 && !ID_STOPWORDS.has(sub)) out.add(sub); });
    }
  });
  return [...out];
}
const EN_STOP = new Set(["this","that","with","from","into","when","where","what","which","while","there","their","they","have","been","will","would","should","could","also","such","than","then","these","those","your","more","most","some","other","another","because","through","without","between","above","below","the","and","for","you","not","all","any","may","can","its","but","one","two","configuration","setting","value","default","number","status","system","performance"]);
const CN_STOP = new Set(["可以","或者","以及","推荐","建议","通过","使用","设置","场景","部分","时候","可能","执行","包含"]);
function quoteTokens(text) {
  const tokens = new Set();
  const c = canonical(text);
  for (const m of c.matchAll(/[a-z][a-z0-9_-]{3,}/g)) {
    const w = m[0].replace(/^[-_]+|[-_]+$/g, "");
    if (w.length >= 4 && !EN_STOP.has(w)) tokens.add(w);
  }
  const cn = (text || "").replace(/[^\u4e00-\u9fa5]/g, " ").trim();
  for (const seg of cn.split(/\s+/)) {
    if (!seg) continue;
    for (let i = 0; i + 2 <= seg.length; i++) {
      const g = seg.slice(i, i + 2);
      if (!CN_STOP.has(g)) tokens.add(g);
    }
  }
  return [...tokens];
}
function splitSentences(raw) {
  // 内核 docs 用 "==========" / "----------" 作章节分隔, 把它们当成软句号
  const normalized = raw
    .replace(/\s*={5,}\s*/g, ". ")
    .replace(/\s*-{5,}\s*/g, ". ");
  return normalized
    .split(/(?<=[.!?。!?])\s+(?=[A-Za-z\d\u4e00-\u9fa5])/)
    .map(s => s.trim())
    .filter(s => s.length >= 30 && s.length <= 500);
}

// title 抽 (CheckFn / rules table / rules.json / 兜底)
function loadRuleTitleMap() {
  const m = new Map();
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith(".ts")) {
        const src = readFileSync(p, "utf8");
        const re = /const\s+id\s*=\s*["']([^"']+)["'][\s\S]{0,200}?const\s+title\s*=\s*["']([^"']+)["']/g;
        for (const match of src.matchAll(re)) if (!m.has(match[1])) m.set(match[1], match[2]);
      }
    }
  }
  walk(`${PLUGIN_ROOT}/src/engines`);
  return m;
}
const TITLE_MAP = loadRuleTitleMap();

const Database = require(`${PLUGIN_ROOT}/../../node_modules/better-sqlite3/lib/index.js`);
const db = new Database(SQLITE);
{
  // 加 rules 表 + rules.json 的 title 兜底
  for (const r of db.prepare("SELECT rule_id, title FROM rules WHERE title IS NOT NULL").all()) {
    if (!TITLE_MAP.has(r.rule_id)) TITLE_MAP.set(r.rule_id, r.title);
  }
  function walkJson(dir) {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walkJson(p);
      else if (f.endsWith("rules.json")) {
        const list = JSON.parse(readFileSync(p, "utf8"));
        for (const x of list) if (x.id && x.source?.title && !TITLE_MAP.has(x.id)) TITLE_MAP.set(x.id, x.source.title);
      }
    }
  }
  walkJson(`${PLUGIN_ROOT}/data`);
}

// 拿 D 报告里的 fail facts, join 出 sqlite knowledge.id
const reportData = JSON.parse(readFileSync(args.report, "utf8"));
let fails = reportData.results.filter(x => x.verdict === "fail");
if (FILTER) fails = fails.filter(f => FILTER.test(f.rule_id));
if (fails.length > LIMIT) fails = fails.slice(0, LIMIT);
console.log(`待修 fail facts: ${fails.length}  model=${MODEL}  concurrency=${CONCURRENCY}  apply=${APPLY}`);

// ---- pre-extract candidates ----
function buildCandidates(rawText, ruleId, title, currentQuote, factType) {
  const idTokens = topicTokensFromId(ruleId);
  const titleTokens = title ? quoteTokens(title) : [];
  const sents = splitSentences(rawText);
  const cQuote = canonical(currentQuote);
  // 候选 = 至少 1 个 id-token 或 1 个 title-token 命中, 且不是当前已知错的句子
  // ★ id-token 权重远高于 title-token (title 可能本身就错的)
  // ★ 军规 3: fact_type=threshold 必须有 Arabic digit, 否则候选作废
  const isThreshold = factType === "threshold";
  const ranked = sents
    .filter(s => canonical(s) !== cQuote)
    .filter(s => !isThreshold || /[0-9]/.test(s))
    .map(s => {
      const lo = canonical(s);
      let id = 0; for (const t of idTokens) if (lo.includes(t)) id++;
      let tt = 0; for (const t of titleTokens) if (lo.includes(t)) tt++;
      return { sent: s, id_hits: id, t_hits: tt, score: id * 5 + tt * 1 };
    })
    .filter(x => x.id_hits + x.t_hits >= 1)
    .sort((a, b) => b.score - a.score || a.sent.length - b.sent.length);
  // dedup canonical-identical sentences (cached pages 常重复同一句)
  const seen = new Set(); const uniq = [];
  for (const r of ranked) {
    const k = canonical(r.sent);
    if (seen.has(k)) continue;
    seen.add(k); uniq.push(r);
    if (uniq.length >= MAX_CANDS) break;
  }
  return uniq;
}

const SYSTEM = `You audit and (if needed) fix a perf-tuning knowledge-base quote.

★ THE RULE'S TOPIC IS DETERMINED BY rule_id ★
rule_title is just a label and is OFTEN WRONG. NEVER use rule_title to determine the rule's topic. Always derive topic from rule_id.

Examples of decoding rule_id into the actual topic:
  • mongo-resources-av-edr-scan-exclusions → "Excluding MongoDB data/log paths from antivirus / EDR scanners"
  • mongo-resources-thp-disabled-on-8x → "Transparent Huge Pages disabled on RHEL/CentOS 8.x for MongoDB"
  • os.vm.swappiness → "Linux sysctl vm.swappiness"
  • mongo.runtime.global_lock_queue → "MongoDB serverStatus.globalLock queue length runtime metric"
  • openeuler.cmdline.nohz → "openEuler kernel cmdline nohz / nohz_full parameter"
  • os.io.disk_await_ms → "Linux disk I/O average wait time (await) per ms"

Three-step decision:

Step 1 — decode rule_id into a topic in plain English (≤15 words). Internalize this.

Step 2 — judge prior_wrong_quote AGAINST that topic (NOT against rule_title):
  • If prior_wrong_quote is genuinely on-topic for the rule_id's topic → output {"old_quote_actually_correct": true, "chosen_index": -1, "reason": "title_wrong, quote_was_already_right"}.

Step 3 — only if step 2 was false: pick the candidate index that best matches rule_id's topic + fact_type:
  • prefer candidates with concrete commands / numbers / parameter names (esp. fact_type=threshold or remediation)
  • If NO candidate is on-topic for rule_id's topic, output {"old_quote_actually_correct": false, "chosen_index": -1, "reason": "no_on_topic_candidate_in_source"}.

Output strict JSON only (no prose, no markdown fences):
{ "old_quote_actually_correct": <bool>, "chosen_index": <int 0-based, or -1>, "reason": "<≤140 chars · explain WHICH topic, WHY chosen>" }`;

function buildUserMsg(fact, candidates, title) {
  const lines = candidates.map((c, i) => `[${i}] ${c.sent}`).join("\n");
  return `rule_title: ${title}\nrule_id: ${fact.rule_id}\nfact_type: ${fact.fact_type}\nprior wrong-quote (do NOT reselect): ${fact.quote_first_120 ?? ""}\n\ncandidates:\n${lines}\n\nWhich index best supports the rule? Output strict JSON.`;
}

const OpenAI = (await import(`${PLUGIN_ROOT}/../../node_modules/openai/index.mjs`)).default;
const client = new OpenAI({ apiKey });

const fixed = [];
const residue = [];
let done = 0;
const startMs = Date.now();
let totalIn = 0, totalCachedIn = 0, totalOut = 0;

async function processOne(fact) {
  const title = TITLE_MAP.get(fact.rule_id) ?? fact.rule_id;
  const raw = loadRaw(fact.source_url);
  if (!raw) {
    residue.push({ ...fact, residue_reason: "no_cache_for_url" });
    return;
  }
  // 拿 sqlite knowledge.id (D 报告里有 id 字段)
  const sqliteId = fact.id;
  if (!sqliteId) {
    residue.push({ ...fact, residue_reason: "no_sqlite_id_in_report" });
    return;
  }
  // GUARD · 检查"题目错配 vs 引文错配":
  // 若 current quote 自身已经命中 ≥ 2 个 rule_id token, 则这条多半是 title-错配 (rule_id 对 / 引文对 / 题目错)
  // 此时改 quote 反而把对的搞错. 标 residue 让人去改 title.
  const idTokens = topicTokensFromId(fact.rule_id);
  const cQuote = canonical(fact.quote_first_120 ?? "");
  let curIdHits = 0;
  for (const t of idTokens) if (cQuote.includes(t)) curIdHits++;
  if (curIdHits >= 2) {
    residue.push({
      ...fact,
      residue_reason: "current_quote_likely_right_for_rule_id (id_hits≥2) · title 可能写错了 · 改 title 不要改 quote",
      cur_id_hits: curIdHits, id_tokens_count: idTokens.length, derived_title_hint: title,
    });
    return;
  }
  const candidates = buildCandidates(raw, fact.rule_id, title, fact.quote_first_120, fact.fact_type);
  if (candidates.length === 0) {
    residue.push({ ...fact, residue_reason: "no_candidates_after_token_filter" });
    return;
  }

  let resp;
  try {
    resp = await client.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      prompt_cache_key: "kb-rewrite-v1",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildUserMsg(fact, candidates, title) },
      ],
    });
  } catch (e) {
    residue.push({ ...fact, residue_reason: `openai_error: ${e.message?.slice(0,120)}` });
    return;
  }
  const usage = resp.usage ?? {};
  totalIn += usage.prompt_tokens ?? 0;
  totalCachedIn += usage.prompt_tokens_details?.cached_tokens ?? 0;
  totalOut += usage.completion_tokens ?? 0;

  let parsed;
  try { parsed = JSON.parse(resp.choices?.[0]?.message?.content ?? "{}"); }
  catch { residue.push({ ...fact, residue_reason: "openai_unparseable" }); return; }

  if (parsed.old_quote_actually_correct === true) {
    residue.push({
      ...fact,
      residue_reason: `title_likely_wrong · openai 判 prior quote 对题目错: ${parsed.reason ?? ""}`,
      candidates_count: candidates.length,
    });
    return;
  }
  const idx = parsed.chosen_index;
  if (typeof idx !== "number" || idx < 0 || idx >= candidates.length) {
    residue.push({ ...fact, residue_reason: `openai_says_none: ${parsed.reason ?? ""}`, candidates_count: candidates.length });
    return;
  }

  const newQuote = candidates[idx].sent;
  // sanity check: verbatim
  if (!canonical(raw).includes(canonical(newQuote))) {
    residue.push({ ...fact, residue_reason: "candidate_not_verbatim_paranoia_check_failed" });
    return;
  }
  fixed.push({
    sqlite_id: sqliteId, rule_id: fact.rule_id, fact_type: fact.fact_type, source_url: fact.source_url,
    title, old_quote: fact.quote_first_120, new_quote: newQuote, openai_reason: parsed.reason ?? "",
    score: { id_hits: candidates[idx].id_hits, t_hits: candidates[idx].t_hits },
  });
}

async function runAll() {
  const queue = [...fails];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const f = queue.shift(); if (!f) break;
      await processOne(f);
      done++;
      if (done % 20 === 0 || done === fails.length) {
        const sec = (Date.now() - startMs) / 1000;
        const rate = done / sec;
        const eta = (fails.length - done) / Math.max(rate, 0.1);
        process.stderr.write(`  ${done}/${fails.length} · ${rate.toFixed(1)}/s · ETA ${eta.toFixed(0)}s · fixed=${fixed.length} residue=${residue.length}\n`);
      }
    }
  });
  await Promise.all(workers);
}

await runAll();

// ---- apply ----
let appliedCount = 0;
if (APPLY && fixed.length > 0) {
  const upd = db.prepare("UPDATE knowledge SET quote=? WHERE id=?");
  const updFts = db.prepare("UPDATE knowledge_fts SET quote=? WHERE rowid=(SELECT rowid FROM knowledge WHERE id=?)");
  const tx = db.transaction(() => {
    for (const f of fixed) {
      const r = upd.run(f.new_quote, f.sqlite_id);
      if (r.changes > 0) {
        try { updFts.run(f.new_quote, f.sqlite_id); } catch {}
        appliedCount++;
      }
    }
  });
  tx();
}
db.close();

const cost = (totalIn - totalCachedIn) * 0.15e-6 + totalCachedIn * 0.075e-6 + totalOut * 0.6e-6;
const summary = {
  scanned: fails.length, fixed_count: fixed.length, residue_count: residue.length, applied_count: appliedCount,
  tokens: { in: totalIn, cached_in: totalCachedIn, out: totalOut }, cost_usd: +cost.toFixed(4),
};
writeFileSync(OUT, JSON.stringify({ summary, fixed }, null, 2));
writeFileSync(RESIDUE, JSON.stringify({ summary, residue }, null, 2));
console.log("\n=== 自动重写报告 ===");
console.log(JSON.stringify(summary, null, 2));
console.log(`fixed proposals → ${OUT}`);
console.log(`residue (人手收尾) → ${RESIDUE}`);
if (!APPLY) console.log("\n⚠ DRY RUN: 没落库. 加 --apply 才更新 sqlite + knowledge_fts.");
