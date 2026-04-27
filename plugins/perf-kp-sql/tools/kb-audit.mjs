#!/usr/bin/env node
// kb-audit.mjs · 知识库审计 + 修复 一站式工具
//
// 5 个模式 (替代原 4 个独立脚本):
//   --mode reverse-check  · 给 OpenAI 判 (title, quote, url) 是否切题 → pass/fail/uncertain (军规 4)
//   --mode rewrite-quotes · 用 reverse-check 报告驱动 · LLM 选/拒 · 双闸门防 title-错配误判
//   --mode fix-titles     · LLM 给 rule_id + sample quote 派生短中文 title · 落 sqlite + rules.json
//   --mode shrink         · 本地三闸门 (id+quote+title token) · 替换非 verbatim quote
//   --mode topic-audit    · 本地扫 token 命中=0 的可疑话题错配 (rewrite-quotes 的 input)
//
// 共享设计:
//   - canonical / loadRaw / topicTokensFromId / quoteTokens / splitSentences / loadRuleTitleMap 全部一份
//   - --apply 默认 false (dry-run); 加才落库
//   - --filter <regex> 限定 rule_id; --limit N 限定条数; --concurrency N 限并发
//   - OpenAI key: env OPENAI_API_KEY 或 ~/.ohsql/secrets/openai.key
//
// 用法示例:
//   node tools/kb-audit.mjs --mode reverse-check --all --concurrency 10
//   node tools/kb-audit.mjs --mode rewrite-quotes --report /tmp/audit.json --apply
//   node tools/kb-audit.mjs --mode fix-titles --residue /tmp/auto-rewrite-residue.json --apply
//   node tools/kb-audit.mjs --mode shrink --apply
//   node tools/kb-audit.mjs --mode topic-audit --filter '^mongo\.runtime\.'

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
    mode: { type: "string", default: "reverse-check" },
    cache: { type: "string", default: "/tmp/audit-cache" },
    apply: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    filter: { type: "string", default: "" },
    limit: { type: "string", default: "" },
    all: { type: "boolean", default: false },
    concurrency: { type: "string", default: "5" },
    out: { type: "string", default: "" },
    residue: { type: "string", default: "" },
    report: { type: "string", default: "" },
    "in-plan": { type: "string", default: "" },
    model: { type: "string", default: "gpt-4o-mini" },
    "max-candidates": { type: "string", default: "12" },
  },
  strict: true,
}).values;

const VALID_MODES = ["reverse-check", "rewrite-quotes", "fix-titles", "shrink", "topic-audit"];
if (!VALID_MODES.includes(args.mode)) {
  console.error(`✗ unknown --mode=${args.mode}. allowed: ${VALID_MODES.join(" | ")}`);
  process.exit(2);
}

const APPLY = args.apply && !args["dry-run"];
const FILTER = args.filter ? new RegExp(args.filter) : null;
const LIMIT = args.all ? Infinity : (args.limit ? parseInt(args.limit, 10) : (args.mode === "reverse-check" ? 10 : Infinity));
const CONCURRENCY = Math.max(1, Math.min(16, parseInt(args.concurrency, 10)));
const MODEL = args.model;
const MAX_CANDS = parseInt(args["max-candidates"], 10);

// ---------------------------------------------------------------------------
// 共享 helpers
// ---------------------------------------------------------------------------

const Database = require(`${PLUGIN_ROOT}/../../node_modules/better-sqlite3/lib/index.js`);

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
    const p = join(args.cache, `${urlHash(cand)}.txt`);
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
  // 内核 docs 用 "==========" / "----------" 作章节分隔, 当软句号
  const normalized = raw
    .replace(/\s*={5,}\s*/g, ". ")
    .replace(/\s*-{5,}\s*/g, ". ");
  return normalized
    .split(/(?<=[.!?。!?])\s+(?=[A-Za-z\d\u4e00-\u9fa5])/)
    .map(s => s.trim())
    .filter(s => s.length >= 30 && s.length <= 500);
}

function loadRuleTitleMap(db) {
  const m = new Map();
  function walkSrc(dir) {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walkSrc(p);
      else if (f.endsWith(".ts")) {
        const src = readFileSync(p, "utf8");
        const re = /const\s+id\s*=\s*["']([^"']+)["'][\s\S]{0,200}?const\s+title\s*=\s*["']([^"']+)["']/g;
        for (const match of src.matchAll(re)) if (!m.has(match[1])) m.set(match[1], match[2]);
      }
    }
  }
  walkSrc(`${PLUGIN_ROOT}/src/engines`);
  if (db) {
    for (const r of db.prepare("SELECT rule_id, title FROM rules WHERE title IS NOT NULL").all()) {
      if (!m.has(r.rule_id)) m.set(r.rule_id, r.title);
    }
  }
  function walkJson(dir) {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walkJson(p);
      else if (f.endsWith("rules.json")) {
        const list = JSON.parse(readFileSync(p, "utf8"));
        for (const x of list) if (x.id && x.source?.title && !m.has(x.id)) m.set(x.id, x.source.title);
      }
    }
  }
  walkJson(`${PLUGIN_ROOT}/data`);
  return m;
}

function getApiKey() {
  let k = process.env.OPENAI_API_KEY;
  if (!k && existsSync(KEY_FILE)) k = readFileSync(KEY_FILE, "utf8").trim();
  return k;
}

async function getOpenAIClient() {
  const k = getApiKey();
  if (!k) { console.error(`✗ OPENAI_API_KEY 未设 (env 或 ${KEY_FILE} 都没找到)`); process.exit(2); }
  const OpenAI = (await import(`${PLUGIN_ROOT}/../../node_modules/openai/index.mjs`)).default;
  return new OpenAI({ apiKey: k });
}

async function runWithConcurrency(items, worker) {
  const queue = [...items];
  let done = 0; const startMs = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const it = queue.shift(); if (!it) break;
      await worker(it);
      done++;
      if (done % 20 === 0 || done === items.length) {
        const sec = (Date.now() - startMs) / 1000;
        const rate = done / sec; const eta = (items.length - done) / Math.max(rate, 0.1);
        process.stderr.write(`  ${done}/${items.length} · ${rate.toFixed(1)}/s · ETA ${eta.toFixed(0)}s\n`);
      }
    }
  }));
}

// ---------------------------------------------------------------------------
// MODE 1: reverse-check (军规 4 LLM 反向校验)
// ---------------------------------------------------------------------------

async function modeReverseCheck() {
  const db = new Database(SQLITE, { readonly: true });
  const TITLE = loadRuleTitleMap(db);
  let rows;
  if (args["in-plan"]) {
    const plan = JSON.parse(readFileSync(args["in-plan"], "utf8"));
    const seen = new Set(); rows = [];
    for (const p of plan.plan ?? plan) {
      const key = `${p.rule_id}::${p.source_url}`;
      if (seen.has(key)) continue; seen.add(key);
      const r = db.prepare("SELECT id, rule_id, fact_type, source_url, quote FROM knowledge WHERE rule_id=? AND source_url=? LIMIT 1").get(p.rule_id, p.source_url);
      if (r) rows.push(r);
    }
  } else {
    rows = db.prepare("SELECT id, rule_id, fact_type, source_url, quote FROM knowledge WHERE quote IS NOT NULL AND quote != ''").all();
  }
  db.close();
  if (FILTER) rows = rows.filter(r => FILTER.test(r.rule_id));
  if (rows.length > LIMIT) rows = rows.slice(0, LIMIT);

  console.log(`待审 facts: ${rows.length}  model=${MODEL}  concurrency=${CONCURRENCY}`);
  if (rows.length === 0) { console.error("没有匹配 fact"); process.exit(0); }

  const SYSTEM = `You are an independent technical reviewer for a database / OS performance-tuning knowledge base. Each entry consists of:
  • rule_title — the topic that an automated check claims to evaluate
  • source_url — the documentation URL the entry cites
  • quote — a verbatim sentence taken from that URL

Your job: judge whether the QUOTE actually supports / is on-topic for the RULE_TITLE. The URL is given for context only — do not browse. Judge purely from the title vs quote semantic alignment, assuming the quote was indeed taken verbatim from that URL.

Output strict JSON (no prose, no markdown fence):
  { "verdict": "pass" | "fail" | "uncertain", "reason": "<≤140 chars · why>" }

verdict guide:
  • pass — quote is clearly about the rule's topic. The quote should explain, define, or operationally support the rule's claim.
  • fail — quote is about an unrelated topic, even if it happens to mention some shared keywords incidentally.
  • uncertain — borderline; tangentially related but does not directly support the rule's claim.

Calibration examples (study these · do not echo them):

Example 1 — pass:
  rule_title:  vm.swappiness Linux sysctl
  quote:       This control is used to define how aggressive the kernel will swap memory pages.
  verdict:     pass · reason: directly defines what swappiness controls

Example 2 — pass:
  rule_title:  WT cache size advisory
  quote:       The default WiredTiger internal cache size is the larger of either: 50% of (RAM - 1GB), or 0.256 GB.
  verdict:     pass · reason: gives the exact default formula for WT cache size

Example 3 — fail (off-topic, despite same source URL):
  rule_title:  Linux disk I/O await time threshold
  quote:       If you use an antivirus (AV) scanner, configure your scanner to exclude the database storage path from the scan.
  verdict:     fail · reason: AV scanner exclusion is unrelated to disk await time

Example 4 — fail (incidental keyword overlap):
  rule_title:  MongoDB connection pool oversized check
  quote:       The connPoolStats command returns information regarding the number of open connections to the current database instance.
  verdict:     fail · reason: connPoolStats command description is not a sizing recommendation

Example 5 — uncertain:
  rule_title:  TCP keepalive time setting
  quote:       Keepalive values greater than 300 seconds, (5 minutes) will be overridden on mongod and mongos sockets and set to 300 seconds.
  verdict:     uncertain · reason: about override behavior, not the recommended value itself

Example 6 — pass (despite Chinese title and English quote):
  rule_title:  Global lock 队列
  quote:       currentQueue A document that provides information concerning the number of operations queued because of a lock.
  verdict:     pass · reason: directly defines the lock queue metric

Decision rule of thumb: if a developer reading the rule's check report would feel the quote LITERALLY supports what the rule is testing, it is pass. If the quote feels like a paragraph from the same page but on a different sub-topic, it is fail.`;

  const client = await getOpenAIClient();
  const results = [];
  let totalIn = 0, cachedIn = 0, totalOut = 0;
  await runWithConcurrency(rows, async (row) => {
    const title = TITLE.get(row.rule_id) ?? row.rule_id;
    try {
      const resp = await client.chat.completions.create({
        model: MODEL, temperature: 0,
        response_format: { type: "json_object" },
        prompt_cache_key: "kb-reverse-check-v1",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `rule_title: ${title}\nsource_url: ${row.source_url}\nquote: ${row.quote}\n\nVerdict?` },
        ],
      });
      totalIn += resp.usage?.prompt_tokens ?? 0;
      cachedIn += resp.usage?.prompt_tokens_details?.cached_tokens ?? 0;
      totalOut += resp.usage?.completion_tokens ?? 0;
      let parsed;
      try { parsed = JSON.parse(resp.choices?.[0]?.message?.content ?? "{}"); }
      catch { parsed = { verdict: "uncertain", reason: "unparseable" }; }
      results.push({
        id: row.id, rule_id: row.rule_id, fact_type: row.fact_type, source_url: row.source_url,
        title, quote_first_120: row.quote.slice(0, 120),
        verdict: parsed.verdict ?? "uncertain", reason: parsed.reason ?? "(no reason)",
        tokens: resp.usage,
      });
    } catch (e) {
      results.push({ id: row.id, rule_id: row.rule_id, fact_type: row.fact_type, source_url: row.source_url, title, quote_first_120: row.quote.slice(0,120), verdict: "error", reason: e.message?.slice(0,200) ?? String(e), tokens: null });
    }
  });

  const summary = { total: results.length, pass: 0, fail: 0, uncertain: 0, error: 0 };
  for (const r of results) summary[r.verdict] = (summary[r.verdict] ?? 0) + 1;
  const byRule = {};
  for (const r of results) (byRule[r.rule_id] ??= []).push({ fact_type: r.fact_type, verdict: r.verdict, reason: r.reason });
  const out = args.out || "/tmp/openai-reverse-check-report.json";
  writeFileSync(out, JSON.stringify({ summary, byRule, results, model: MODEL, totalTokensIn: totalIn, totalCachedIn: cachedIn, totalTokensOut: totalOut }, null, 2));
  console.log("\n=== reverse-check 报告 ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`tokens · in=${totalIn} (cached=${cachedIn}) · out=${totalOut}`);
  console.log(`报告 → ${out}`);
  const fails = results.filter(r => r.verdict === "fail");
  if (fails.length > 0) {
    console.log(`\n--- FAIL ${fails.length} 条 ---`);
    for (const f of fails.slice(0, 12)) console.log(`  [${f.fact_type}] ${f.rule_id}\n     quote: ${f.quote_first_120}\n     why:   ${f.reason}`);
    if (fails.length > 12) console.log(`  ... +${fails.length - 12} more`);
  }
}

// ---------------------------------------------------------------------------
// MODE 2: rewrite-quotes (用 reverse-check 报告驱动批量重写)
// ---------------------------------------------------------------------------

function buildCandidatesForRewrite(rawText, ruleId, title, currentQuote, factType) {
  const idTokens = topicTokensFromId(ruleId);
  const titleTokens = title ? quoteTokens(title) : [];
  const sents = splitSentences(rawText);
  const cQuote = canonical(currentQuote);
  const isThreshold = factType === "threshold";  // 军规 3
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
  const seen = new Set(); const uniq = [];
  for (const r of ranked) {
    const k = canonical(r.sent);
    if (seen.has(k)) continue; seen.add(k); uniq.push(r);
    if (uniq.length >= MAX_CANDS) break;
  }
  return uniq;
}

async function modeRewriteQuotes() {
  if (!args.report) { console.error("✗ --report <path> 必填"); process.exit(2); }
  const db = new Database(SQLITE);
  const TITLE = loadRuleTitleMap(db);
  const reportData = JSON.parse(readFileSync(args.report, "utf8"));
  let fails = reportData.results.filter(x => x.verdict === "fail");
  if (FILTER) fails = fails.filter(f => FILTER.test(f.rule_id));
  if (fails.length > LIMIT) fails = fails.slice(0, LIMIT);
  console.log(`待修 fail facts: ${fails.length}  model=${MODEL}  concurrency=${CONCURRENCY}  apply=${APPLY}`);

  const SYSTEM = `You audit and (if needed) fix a perf-tuning knowledge-base quote.

★ THE RULE'S TOPIC IS DETERMINED BY rule_id ★
rule_title is just a label and is OFTEN WRONG. NEVER use rule_title to determine the rule's topic. Always derive topic from rule_id.

Three-step decision:
1. Decode rule_id into a topic in plain English (≤15 words).
2. Judge prior_wrong_quote AGAINST that topic (NOT rule_title): if genuinely on-topic for rule_id's topic → output {"old_quote_actually_correct": true, "chosen_index": -1, "reason": "title_likely_wrong"}.
3. Otherwise pick the candidate index that best matches rule_id's topic + fact_type. Prefer concrete commands/numbers/parameter names (esp. fact_type=threshold). If NO candidate is on-topic for rule_id's topic, output {"old_quote_actually_correct": false, "chosen_index": -1, "reason": "no_on_topic_candidate"}.

Output strict JSON: { "old_quote_actually_correct": <bool>, "chosen_index": <int 0-based or -1>, "reason": "<≤140 chars>" }

Reference rule_id decoding patterns:
  mongo-resources-av-edr-scan-exclusions       → "Excluding MongoDB data/log paths from antivirus / EDR scanners"
  mongo-resources-thp-disabled-on-8x           → "Transparent Huge Pages disabled on RHEL/CentOS 8.x for MongoDB"
  os.vm.swappiness                              → "Linux sysctl vm.swappiness · how aggressive kernel swaps memory pages"
  os.vm.zone_reclaim_mode                       → "Linux sysctl vm.zone_reclaim_mode · NUMA reclaim behavior"
  os.io.disk_await_ms                           → "Disk I/O average wait time per request in ms (iostat await column)"
  mongo.runtime.global_lock_queue               → "MongoDB serverStatus.globalLock queue length runtime metric"
  mongo.runtime.connections_available           → "MongoDB connections.available · headroom from net.maxIncomingConnections"
  mongo.config.wt_cache_size_advisory           → "WT cache size vs official default 50% × (RAM - 1GB)"
  openeuler.cmdline.nohz                        → "openEuler kernel cmdline nohz / nohz_full parameter"
  arm64.lse.cpu_flag                            → "ARMv8.1-A LSE atomic instructions CPU flag · ID_AA64ISAR0_EL1.Atomic"
  mongo-network-tcp-keepalive                   → "TCP keepalive_time setting for MongoDB connections (recommended 120s)"
  mongo-storage-tcmalloc-glibc-rseq-disable     → "Disabling glibc Restartable Sequences when using TCMalloc"

Worked example A — title is wrong:
  rule_id:        mongo-resources-av-edr-scan-exclusions
  rule_title:     MongoDB dbPath  (← title is wrong, not the rule's topic)
  fact_type:      summary
  prior_quote:    If you use an antivirus (AV) scanner, configure your scanner to exclude the database storage path from the scan.
  candidates:     [0] MongoDB dbPath The files in dbPath ...
                  [1] If you use an antivirus (AV) scanner ...  (== prior · filtered out before sending to you)
                  [2] The I/O and CPU costs to scan these files ...
  decision:       prior_quote IS on-topic for "AV/EDR scan exclusions" (the rule_id) — title "MongoDB dbPath" is wrong
  output:         {"old_quote_actually_correct": true, "chosen_index": -1, "reason": "title_likely_wrong · prior quote already on-topic for rule_id"}

Worked example B — title is right, quote is wrong:
  rule_id:        os.vm.swappiness
  rule_title:     vm.swappiness 检查
  fact_type:      summary
  prior_quote:    The fork operation (running in the main thread) can induce latency by itself.
  candidates:     [0] swappiness This control is used to define how aggressive the kernel will swap memory pages.
                  [1] The default value is 60.
                  [2] Higher values will increase aggressiveness, lower values decrease the amount of swap.
  decision:       prior_quote is about fork(), unrelated to swappiness. Candidate 0 is the canonical definition.
  output:         {"old_quote_actually_correct": false, "chosen_index": 0, "reason": "candidate 0 directly defines swappiness control"}

Worked example C — no good candidate:
  rule_id:        mongo.runtime.wt_pages_read_volume
  rule_title:     WT 累计 page-read 量
  fact_type:      threshold
  prior_quote:    Avoid increasing the WiredTiger internal cache size above its default value.
  candidates:     [0] Block compression can provide significant on-disk storage savings.
                  [1] If a single machine contains multiple MongoDB instances, decrease the setting.
                  [2] With the filesystem cache, MongoDB automatically uses all free memory.
  decision:       all candidates are about cache SIZE config, not pages_read VOLUME runtime metric. None on-topic.
  output:         {"old_quote_actually_correct": false, "chosen_index": -1, "reason": "no_on_topic_candidate · source URL lacks pages_read narrative"}`;

  const client = await getOpenAIClient();
  const fixed = []; const residue = [];
  let totalIn = 0, cachedIn = 0, totalOut = 0;

  await runWithConcurrency(fails, async (fact) => {
    const title = TITLE.get(fact.rule_id) ?? fact.rule_id;
    const raw = loadRaw(fact.source_url);
    if (!raw) { residue.push({ ...fact, residue_reason: "no_cache_for_url" }); return; }
    if (!fact.id) { residue.push({ ...fact, residue_reason: "no_sqlite_id_in_report" }); return; }

    // GUARD: id-token≥2 命中 prior quote → likely title issue, skip rewrite
    const idTokens = topicTokensFromId(fact.rule_id);
    const cQuote = canonical(fact.quote_first_120 ?? "");
    let curIdHits = 0;
    for (const t of idTokens) if (cQuote.includes(t)) curIdHits++;
    if (curIdHits >= 2) {
      residue.push({ ...fact, residue_reason: "current_quote_likely_right_for_rule_id (id_hits≥2) · title 可能写错了 · 改 title 不要改 quote", cur_id_hits: curIdHits, derived_title_hint: title });
      return;
    }

    const candidates = buildCandidatesForRewrite(raw, fact.rule_id, title, fact.quote_first_120, fact.fact_type);
    if (candidates.length === 0) { residue.push({ ...fact, residue_reason: "no_candidates_after_token_filter" }); return; }

    let resp;
    try {
      const lines = candidates.map((c, i) => `[${i}] ${c.sent}`).join("\n");
      const userMsg = `rule_title: ${title}\nrule_id: ${fact.rule_id}\nfact_type: ${fact.fact_type}\nprior wrong-quote: ${fact.quote_first_120 ?? ""}\n\ncandidates:\n${lines}\n\nWhich index? Output strict JSON.`;
      resp = await client.chat.completions.create({
        model: MODEL, temperature: 0,
        response_format: { type: "json_object" },
        prompt_cache_key: "kb-rewrite-v1",
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userMsg }],
      });
    } catch (e) {
      residue.push({ ...fact, residue_reason: `openai_error: ${e.message?.slice(0,120)}` });
      return;
    }
    totalIn += resp.usage?.prompt_tokens ?? 0;
    cachedIn += resp.usage?.prompt_tokens_details?.cached_tokens ?? 0;
    totalOut += resp.usage?.completion_tokens ?? 0;
    let parsed;
    try { parsed = JSON.parse(resp.choices?.[0]?.message?.content ?? "{}"); }
    catch { residue.push({ ...fact, residue_reason: "openai_unparseable" }); return; }
    if (parsed.old_quote_actually_correct === true) {
      residue.push({ ...fact, residue_reason: `title_likely_wrong · openai 判 prior quote 对题目错: ${parsed.reason ?? ""}` });
      return;
    }
    const idx = parsed.chosen_index;
    if (typeof idx !== "number" || idx < 0 || idx >= candidates.length) {
      residue.push({ ...fact, residue_reason: `openai_says_none: ${parsed.reason ?? ""}` });
      return;
    }
    const newQuote = candidates[idx].sent;
    if (!canonical(raw).includes(canonical(newQuote))) {
      residue.push({ ...fact, residue_reason: "candidate_not_verbatim_paranoia" });
      return;
    }
    fixed.push({ sqlite_id: fact.id, rule_id: fact.rule_id, fact_type: fact.fact_type, source_url: fact.source_url, title, old_quote: fact.quote_first_120, new_quote: newQuote, openai_reason: parsed.reason ?? "", score: { id_hits: candidates[idx].id_hits, t_hits: candidates[idx].t_hits } });
  });

  let appliedCount = 0;
  if (APPLY && fixed.length > 0) {
    const upd = db.prepare("UPDATE knowledge SET quote=? WHERE id=?");
    const updFts = db.prepare("UPDATE knowledge_fts SET quote=? WHERE rowid=(SELECT rowid FROM knowledge WHERE id=?)");
    const tx = db.transaction(() => {
      for (const f of fixed) {
        const r = upd.run(f.new_quote, f.sqlite_id);
        if (r.changes > 0) { try { updFts.run(f.new_quote, f.sqlite_id); } catch {} appliedCount++; }
      }
    });
    tx();
  }
  db.close();

  const cost = (totalIn - cachedIn) * 0.15e-6 + cachedIn * 0.075e-6 + totalOut * 0.6e-6;
  const summary = { scanned: fails.length, fixed_count: fixed.length, residue_count: residue.length, applied_count: appliedCount, tokens: { in: totalIn, cached_in: cachedIn, out: totalOut }, cost_usd: +cost.toFixed(4) };
  const out = args.out || "/tmp/auto-rewrite-report.json";
  const res = args.residue || "/tmp/auto-rewrite-residue.json";
  writeFileSync(out, JSON.stringify({ summary, fixed }, null, 2));
  writeFileSync(res, JSON.stringify({ summary, residue }, null, 2));
  console.log("\n=== rewrite-quotes 报告 ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`fixed → ${out}\nresidue → ${res}`);
  if (!APPLY) console.log("\n⚠ DRY RUN: 加 --apply 才落库");
}

// ---------------------------------------------------------------------------
// MODE 3: fix-titles (LLM 派生 rule title)
// ---------------------------------------------------------------------------

async function modeFixTitles() {
  if (!args.residue) { console.error("✗ --residue <path> 必填 (auto-rewrite 残留 json)"); process.exit(2); }
  const db = new Database(SQLITE);
  const residue = JSON.parse(readFileSync(args.residue, "utf8")).residue ?? [];
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
  if (rules.length === 0) { console.log("没有 title-issue, 退出"); db.close(); return; }

  const SYSTEM = `You generate a precise short title for a perf-tuning knowledge-base rule.

Input:
- rule_id (kebab-case or dot-case · ground truth for topic)
- current_title_wrong (existing title flagged as wrong)
- sample_quote (verbatim sentence from rule's source URL)

Output strict JSON: { "new_title_zh": "<≤14 个汉字 / 28 个 ASCII, 简洁, 含核心参数名 / 行为词>", "reason": "<≤80 chars>" }

Rules:
- 必须把 rule_id 拆出的核心 token (e.g. swappiness / tcmalloc / disk_await) 直接用 ASCII 写进去
- 不要用过宽的词 (Memory Use / Index Metrics 这种页面节段名 · Schema Improvement / Common Reasons 这种文章节段)
- 不要重复 rule_id 整段 (变成机器风占位)
- 不要把 fact_type 的术语 (mechanism / threshold / when_deviate) 搬进 title
- 中文优先 · 但参数名 / 命令名 / 配置 key 保留原文 (e.g. \`vm.swappiness\` / \`maxIncomingConnections\`)
- 优先动词短语 (检查 / 优化 / 监控 / 阻塞) 表达"这条规则在做什么"

Calibration examples (study the patterns · do not echo):

  rule_id: mongo-runtime-connection-pool-oversized
  current: mongo-runtime-connection-pool-oversized   (机器风占位 · 不可读)
  sample:  Start at 110-115% of the typical number of current database requests
  → new_title_zh: "mongo 连接池过大检查"   (动词短语 · 含核心 token "连接池")

  rule_id: mongo-resources-wt-cache-multi-instance-host
  current: Memory Use   (页面节段名 · 太宽)
  sample:  If a single machine contains multiple MongoDB instances, decrease the setting
  → new_title_zh: "wt_cache 多实例配置"   (含 wt_cache + 多实例两个核心词)

  rule_id: mongo-runtime-ticket-queue-overload
  current: Transaction (Read and Write) Concurrency   (页面节段)
  sample:  A low value of available in queues.execution does not indicate ...
  → new_title_zh: "mongo 运行票据队列过载"

  rule_id: mongo-query-in-memory-sort-index
  current: Index Metrics   (太宽)
  sample:  In Memory Sort Current number of affected queries per hour
  → new_title_zh: "mongo-query 内存排序监控"

  rule_id: mongo-config-tcmalloc-percpu-caches-disabled
  current: Disable glibc rseq   (相关但偏)
  sample:  Starting in MongoDB 8.0, MongoDB uses an upgraded version of TCMalloc
  → new_title_zh: "MongoDB TCMalloc 关闭每核缓存"

  rule_id: mongo-runtime-ldap-retrycount-zero
  current: mongo-runtime-ldap-retrycount-zero   (机器风)
  sample:  mongod --ldapRetryCount=3 Or, if using the setParameter command
  → new_title_zh: "mongo 设定 ldapRetryCount"

  rule_id: mongo-design-unnecessary-indexes-write-overhead
  current: Schema Improvement   (太宽)
  → new_title_zh: "Mongo 不必要索引写入开销"

  rule_id: mongo-storage-tcmalloc-glibc-rseq-disable
  current: TCMalloc · glibc rseq   (基本对 · 但太短)
  → new_title_zh: "TCMalloc 关闭 glibc rseq 优化"`;

  const client = await getOpenAIClient();
  const proposals = [];
  let totalIn = 0, totalOut = 0;
  await runWithConcurrency(rules, async (item) => {
    const [rule_id, info] = item;
    try {
      const resp = await client.chat.completions.create({
        model: MODEL, temperature: 0,
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
  });

  let appliedRules = 0, appliedJson = 0;
  if (APPLY) {
    const updRules = db.prepare("UPDATE rules SET title=? WHERE rule_id=?");
    for (const p of proposals) {
      if (!p.new_title) continue;
      const r = updRules.run(p.new_title, p.rule_id);
      if (r.changes > 0) appliedRules++;
    }
    function walkJson(dir) {
      if (!existsSync(dir)) return;
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walkJson(p);
        else if (f.endsWith("rules.json")) {
          const list = JSON.parse(readFileSync(p, "utf8"));
          let changed = false;
          for (const r of list) {
            const m = proposals.find(pp => pp.rule_id === r.id && pp.new_title);
            if (m && r.source && r.source.title !== m.new_title) { r.source.title = m.new_title; changed = true; appliedJson++; }
          }
          if (changed) writeFileSync(p, JSON.stringify(list, null, 2) + "\n");
        }
      }
    }
    walkJson(`${PLUGIN_ROOT}/data`);
  }
  db.close();

  const cost = totalIn * 0.15e-6 + totalOut * 0.6e-6;
  const summary = { rules_processed: proposals.length, applied_rules_table: appliedRules, applied_rules_json: appliedJson, tokens: { in: totalIn, out: totalOut }, cost_usd: +cost.toFixed(4) };
  const out = args.out || "/tmp/auto-fix-titles-report.json";
  writeFileSync(out, JSON.stringify({ summary, proposals }, null, 2));
  console.log("\n=== fix-titles 报告 ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`报告 → ${out}`);
  if (!APPLY) console.log("⚠ DRY RUN: --apply 才落库");
}

// ---------------------------------------------------------------------------
// MODE 4 & 5: shrink + topic-audit (本地 · 不用 LLM)
// ---------------------------------------------------------------------------

function buildCandidatesForShrink(rawText, ruleId, title, currentQuote) {
  const idTokens = topicTokensFromId(ruleId);
  const titleTokens = title ? quoteTokens(title) : [];
  const qTokens = quoteTokens(currentQuote);
  const sents = splitSentences(rawText);
  const titleGate = titleTokens.length > 0;
  const ranked = sents
    .map(s => {
      const lo = canonical(s);
      let id = 0; for (const t of idTokens) if (lo.includes(t)) id++;
      let qh = 0; for (const t of qTokens) if (lo.includes(t)) qh++;
      let tt = 0; for (const t of titleTokens) if (lo.includes(t)) tt++;
      return { sent: s, id_hits: id, q_hits: qh, t_hits: tt, total: id * 2 + qh + tt * 2 };
    })
    .filter(x => x.id_hits >= 1 && x.q_hits >= 2 && (!titleGate || x.t_hits >= 1))
    .sort((a, b) => b.total - a.total || a.sent.length - b.sent.length);
  return ranked[0] ?? null;
}

function modeShrink() {
  const db = new Database(SQLITE);
  const TITLE = loadRuleTitleMap(db);
  const stats = { total: 0, alreadyOk: 0, autoFixable: 0, noCandidate: 0, noCache: 0, applied: 0 };
  const plan = [];

  function evaluate(currentQuote, sourceUrl, ruleId, where, sqliteId = null) {
    if (FILTER && !FILTER.test(ruleId)) return null;
    stats.total++;
    const cQuote = canonical(currentQuote);
    const t = loadRaw(sourceUrl);
    if (!t) { stats.noCache++; return null; }
    if (canonical(t).includes(cQuote)) { stats.alreadyOk++; return null; }
    const ruleTitle = TITLE.get(ruleId) ?? "";
    const best = buildCandidatesForShrink(t, ruleId, ruleTitle, currentQuote);
    if (!best) { stats.noCandidate++; return null; }
    stats.autoFixable++;
    const change = { where, sqlite_id: sqliteId, rule_id: ruleId, source_url: sourceUrl, rule_title: ruleTitle, original: String(currentQuote).slice(0, 80), new_quote: best.sent, score: best };
    plan.push(change);
    return change;
  }

  // JSON pass
  function findRulesJson(dir, out = []) {
    if (!existsSync(dir)) return out;
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) findRulesJson(p, out);
      else if (f.endsWith("rules.json")) out.push(p);
    }
    return out;
  }
  for (const path of findRulesJson(`${PLUGIN_ROOT}/data`)) {
    const list = JSON.parse(readFileSync(path, "utf8"));
    let changed = false;
    for (const rule of list) {
      const url = rule.source?.url, quote = rule.source?.quote;
      if (!url || !quote) continue;
      const c = evaluate(quote, url, rule.id, path.split("/").slice(-2).join("/"));
      if (c && APPLY) { rule.source.quote = c.new_quote; changed = true; stats.applied++; }
    }
    if (APPLY && changed) writeFileSync(path, JSON.stringify(list, null, 2) + "\n");
  }
  // sqlite pass
  const rows = db.prepare("SELECT id, rule_id, fact_type, source_url, quote FROM knowledge WHERE quote IS NOT NULL AND quote != ''").all();
  const upd = db.prepare("UPDATE knowledge SET quote=? WHERE id=?");
  const updFts = db.prepare("UPDATE knowledge_fts SET quote=? WHERE rowid=(SELECT rowid FROM knowledge WHERE id=?)");
  const tx = db.transaction(() => {
    for (const r of rows) {
      const c = evaluate(r.quote, r.source_url, r.rule_id, "sqlite", r.id);
      if (c && APPLY) { upd.run(c.new_quote, r.id); try { updFts.run(c.new_quote, r.id); } catch {} stats.applied++; }
    }
  });
  tx();
  db.close();

  const out = args.out || "/tmp/shrink-plan.json";
  writeFileSync(out, JSON.stringify({ stats, plan }, null, 2));
  console.log(`=== shrink (apply=${APPLY}) ===`);
  console.log(JSON.stringify(stats, null, 2));
  console.log(`plan → ${out}`);
}

function modeTopicAudit() {
  const db = new Database(SQLITE, { readonly: true });
  const TITLE = loadRuleTitleMap(db);
  const stats = { total: 0, alreadyOk: 0, suspect: 0, noCache: 0 };
  const plan = [];
  const rows = db.prepare("SELECT id, rule_id, fact_type, source_url, quote FROM knowledge WHERE quote IS NOT NULL AND quote != ''").all();
  for (const r of rows) {
    if (FILTER && !FILTER.test(r.rule_id)) continue;
    stats.total++;
    const t = loadRaw(r.source_url);
    if (!t) { stats.noCache++; continue; }
    const idTokens = topicTokensFromId(r.rule_id);
    const titleTokens = TITLE.get(r.rule_id) ? quoteTokens(TITLE.get(r.rule_id)) : [];
    const cur = canonical(r.quote);
    let curId = 0; for (const tk of idTokens) if (cur.includes(tk)) curId++;
    let curT  = 0; for (const tk of titleTokens) if (cur.includes(tk)) curT++;
    if (curId > 0 || (titleTokens.length > 0 && curT > 0)) { stats.alreadyOk++; continue; }
    stats.suspect++;
    plan.push({ id: r.id, rule_id: r.rule_id, fact_type: r.fact_type, source_url: r.source_url, title: TITLE.get(r.rule_id) ?? r.rule_id, current_quote_token_hits: { id_hits: curId, t_hits: curT }, current_quote_first_120: r.quote.slice(0, 120) });
  }
  db.close();
  const out = args.out || "/tmp/topic-audit-plan.json";
  writeFileSync(out, JSON.stringify({ stats, plan }, null, 2));
  console.log(`=== topic-audit (read-only) ===`);
  console.log(JSON.stringify(stats, null, 2));
  console.log(`plan → ${out}`);
}

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------

(async () => {
  switch (args.mode) {
    case "reverse-check": await modeReverseCheck(); break;
    case "rewrite-quotes": await modeRewriteQuotes(); break;
    case "fix-titles": await modeFixTitles(); break;
    case "shrink": modeShrink(); break;
    case "topic-audit": modeTopicAudit(); break;
  }
})();
