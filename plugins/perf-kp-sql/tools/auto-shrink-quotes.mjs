#!/usr/bin/env node
// auto-shrink-quotes.mjs · v3
// 在 cached URL 文本里给现有 quote 找一个更紧凑、字面命中、且话题正确的替换。
//
// 与 v2 的区别 (修 topic 错配 false-positive):
//   1. 候选句子必须同时满足三闸门:
//        a) 至少 1 个 rule.id 拆出的 topic token 命中
//        b) 至少 2 个原 quote 实词 token 命中 (双语,长度 ≥ 4)
//        c) 至少 1 个 rule.title 实词 token 命中 (从 src/engines/**/*.ts 抽)
//      避免 "disk" 单 token 命中 AV scanner 段那种宽匹配。
//   2. id stoplist 扩到一通用 perf 词,避免 "size" / "value" / "default" 充数。
//   3. --dry-run 默认开启 · 只报告 + 写 /tmp/auto-shrink-v3-plan.json · 不改 KB
//      跑 --apply 才落到 JSON 和 sqlite。
//   4. --filter <regex> 限定 rule_id (例 --filter '^mongo\.runtime\.')。
//
// 用法:
//   node plugins/perf-kp-sql/tools/auto-shrink-quotes.mjs --cache /tmp/audit-cache
//   node plugins/perf-kp-sql/tools/auto-shrink-quotes.mjs --cache /tmp/audit-cache --apply
//   node plugins/perf-kp-sql/tools/auto-shrink-quotes.mjs --cache /tmp/audit-cache --filter '^mongo\.'

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

const args = parseArgs({
  options: {
    cache: { type: "string", default: "/tmp/audit-cache" },
    apply: { type: "boolean", default: false },
    filter: { type: "string", default: "" },
    mode: { type: "string", default: "shrink" },   // shrink | topic-audit
  },
  strict: true,
}).values;
const CACHE = args.cache;
const APPLY = args.apply;
const FILTER = args.filter ? new RegExp(args.filter) : null;
const MODE = args.mode;
if (!["shrink", "topic-audit"].includes(MODE)) {
  console.error(`unknown --mode=${MODE} (允许: shrink | topic-audit)`);
  process.exit(2);
}

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

function loadRawAndCanon(url) {
  for (const cand of [url, url.split("#")[0]]) {
    const p = join(CACHE, `${urlHash(cand)}.txt`);
    if (existsSync(p)) {
      const raw = readFileSync(p, "utf8").replace(/\s+/g, " ").trim();
      return { raw, canon: canonical(raw) };
    }
  }
  return null;
}

// id 拆 topic token: skip 通用前缀 / 域名 + 通用 perf 名词
const ID_STOPWORDS = new Set([
  "mongo","mysql","redis","kunpeng","arm64","openeuler","config","runtime","storage","platform",
  "size","value","default","check","total","count","limit","status","strict","mongo","linux","kernel",
  "data","main","bytes","ratio","percent","threshold","level","mode","type","name",
]);
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

// 原 quote 拆实词 token: 双语 · 长度 ≥ 4 (CN 可 ≥ 2) · 排除常见 stop word
const EN_STOPWORDS = new Set([
  "this","that","with","from","into","when","where","what","which","while","there","their","they",
  "have","been","will","would","should","could","also","such","than","then","then","these","those",
  "your","more","most","some","other","another","because","through","without","between","above","below",
  "the","and","for","you","not","all","any","may","can","its","but","one","two",
  "configuration","setting","value","default","number","status","system","performance",
]);
const CN_STOPWORDS = new Set([
  "可以","或者","以及","推荐","建议","通过","使用","设置","场景","部分","时候","可能","执行","包含",
]);
function quoteTokens(rawQuote) {
  const tokens = new Set();
  const c = canonical(rawQuote);
  // 英文 / 拉丁词 (含数字)
  for (const m of c.matchAll(/[a-z][a-z0-9_-]{3,}/g)) {
    const w = m[0].replace(/^[-_]+|[-_]+$/g, "");
    if (w.length >= 4 && !EN_STOPWORDS.has(w)) tokens.add(w);
  }
  // CN 实词: 2-4 字 (粗略 · 不分词只切窗) — 取 2-gram 避免噪音
  const cn = rawQuote.replace(/[^\u4e00-\u9fa5]/g, " ").trim();
  for (const seg of cn.split(/\s+/)) {
    if (!seg) continue;
    for (let i = 0; i + 2 <= seg.length; i++) {
      const g = seg.slice(i, i + 2);
      if (!CN_STOPWORDS.has(g)) tokens.add(g);
    }
  }
  return [...tokens];
}

// 切句子 (英文为主 · 兼顾中文句号)
function splitSentences(raw) {
  return raw
    .split(/(?<=[.!?。!?])\s+(?=[A-Z\d\u4e00-\u9fa5])/)
    .map(s => s.trim())
    .filter(s => s.length >= 30 && s.length <= 350);
}

function score(sentence, idTokens, quoteTokens_, titleTokens) {
  const lower = canonical(sentence);
  let id_hits = 0;
  for (const t of idTokens) if (lower.includes(t)) id_hits++;
  let q_hits = 0;
  for (const t of quoteTokens_) if (lower.includes(t)) q_hits++;
  let t_hits = 0;
  for (const t of titleTokens) if (lower.includes(t)) t_hits++;
  return { id_hits, q_hits, t_hits, total: id_hits * 2 + q_hits + t_hits * 2 };
}

function findBestSentence(rawText, idTokens, quoteTokens_, titleTokens) {
  if (!rawText || idTokens.length === 0) return null;
  const sents = splitSentences(rawText);
  // 三闸门: id ≥ 1 AND quote ≥ 2 AND (title ≥ 1 OR titleTokens 为空回退)
  const titleGate = titleTokens.length > 0;
  const ranked = sents
    .map(s => ({ sent: s, ...score(s, idTokens, quoteTokens_, titleTokens) }))
    .filter(x => x.id_hits >= 1 && x.q_hits >= 2 && (!titleGate || x.t_hits >= 1))
    .sort((a, b) => b.total - a.total || a.sent.length - b.sent.length);
  return ranked[0] ?? null;
}

// 从 src/engines/**/*.ts 抽 rule_id → title 映射
// 配对模式: const id = "..."; const title = "..."; (相邻两行,允许中间一两行)
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
        // 容忍 const id = "X" 与 const title = "Y" 之间最多 3 行
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

const stats = {
  total: 0, alreadyOk: 0, autoFixable: 0, noCandidate: 0, noCache: 0, filtered: 0, applied: 0,
};
const plan = [];

function evaluate(currentQuote, sourceUrl, ruleId, where) {
  if (FILTER && !FILTER.test(ruleId)) { stats.filtered++; return null; }
  stats.total++;
  const cQuote = canonical(currentQuote);
  const t = loadRawAndCanon(sourceUrl);
  if (!t) { stats.noCache++; return null; }

  const idTokens = topicTokensFromId(ruleId);
  const ruleTitle = TITLE_MAP.get(ruleId) ?? "";
  const titleTokens = ruleTitle ? quoteTokens(ruleTitle) : [];

  if (MODE === "shrink") {
    if (t.canon.includes(cQuote)) { stats.alreadyOk++; return null; }
    const qTokens = quoteTokens(currentQuote);
    const best = findBestSentence(t.raw, idTokens, qTokens, titleTokens);
    if (!best) { stats.noCandidate++; return null; }
    stats.autoFixable++;
    const change = {
      where, rule_id: ruleId, source_url: sourceUrl,
      rule_title: ruleTitle || "(no title found in CheckFn)",
      original_quote_first_80: String(currentQuote).slice(0, 80),
      new_quote: best.sent,
      score: { id_hits: best.id_hits, q_hits: best.q_hits, t_hits: best.t_hits, total: best.total },
    };
    plan.push(change);
    return change;
  }

  // topic-audit: 算 CURRENT quote 自身的 token 命中. 0 命中 = 强嫌疑话题错配.
  // 注意: 不依赖 q_hits gate · 因为 q 本身可能是错的.
  const cur = canonical(currentQuote);
  let cur_id = 0;  for (const tk of idTokens) if (cur.includes(tk)) cur_id++;
  let cur_t  = 0;  for (const tk of titleTokens) if (cur.includes(tk)) cur_t++;
  const suspect = cur_id === 0 && (titleTokens.length === 0 || cur_t === 0);
  if (!suspect) { stats.alreadyOk++; return null; }
  stats.autoFixable++;  // 复用计数器 · 这里其实是 "topic-suspect"

  // 在 source 里找 id+title token 命中最高的句子 (放宽 q-gate)
  const sents = splitSentences(t.raw);
  const ranked = sents
    .map(s => {
      const lo = canonical(s);
      let id = 0; for (const tk of idTokens) if (lo.includes(tk)) id++;
      let tt = 0; for (const tk of titleTokens) if (lo.includes(tk)) tt++;
      return { sent: s, id_hits: id, t_hits: tt, total: id * 2 + tt * 2 };
    })
    .filter(x => x.id_hits >= 1 || x.t_hits >= 1)
    .sort((a, b) => b.total - a.total || a.sent.length - b.sent.length);
  const best = ranked[0];
  const change = {
    where, rule_id: ruleId, source_url: sourceUrl,
    rule_title: ruleTitle || "(no title found in CheckFn)",
    current_quote_token_hits: { id_hits: cur_id, t_hits: cur_t },
    current_quote_first_120: String(currentQuote).slice(0, 120),
    suggested_quote: best ? best.sent : "(NO CANDIDATE FOUND IN SOURCE — needs different URL)",
    suggested_score: best ? { id_hits: best.id_hits, t_hits: best.t_hits, total: best.total } : null,
  };
  plan.push(change);
  return change;
}

function findRulesJson() {
  const out = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith("rules.json")) out.push(p);
    }
  }
  walk(`${PLUGIN_ROOT}/data`);
  return out;
}

// JSON pass
const jsonChanges = new Map(); // path → list of changes
for (const path of findRulesJson()) {
  const list = JSON.parse(readFileSync(path, "utf8"));
  for (const rule of list) {
    const url = rule.source?.url, quote = rule.source?.quote;
    if (!url || !quote) continue;
    const c = evaluate(quote, url, rule.id, path.split("/").slice(-2).join("/"));
    if (c && APPLY) {
      rule.source.quote = c.new_quote;
      const arr = jsonChanges.get(path) ?? [];
      arr.push(c); jsonChanges.set(path, arr);
    }
  }
  if (APPLY && jsonChanges.has(path)) {
    writeFileSync(path, JSON.stringify(list, null, 2) + "\n");
    stats.applied += jsonChanges.get(path).length;
  }
}

// sqlite pass
const db = new Database(SQLITE);
const rows = db.prepare("SELECT id, rule_id, fact_type, source_url, quote FROM knowledge WHERE quote IS NOT NULL AND quote != ''").all();
const upd = db.prepare("UPDATE knowledge SET quote=? WHERE id=?");
const updFts = db.prepare("UPDATE knowledge_fts SET quote=? WHERE rowid=(SELECT rowid FROM knowledge WHERE id=?)");
const tx = db.transaction(() => {
  for (const r of rows) {
    const c = evaluate(r.quote, r.source_url, r.rule_id, "sqlite");
    if (c && APPLY && MODE === "shrink") {
      upd.run(c.new_quote, r.id);
      try { updFts.run(c.new_quote, r.id); } catch {}
      stats.applied++;
    }
  }
});
tx();
db.close();
if (APPLY && MODE === "topic-audit") {
  console.warn("⚠ topic-audit 模式不支持 --apply (人审挑后再批改 · 太敏感不能 auto)");
}

console.log(`=== v3 ${MODE} (apply=${APPLY}) ===`);
console.log(`总扫: ${stats.total}  filtered: ${stats.filtered}`);
console.log(`已合规 (${MODE === "shrink" ? "verbatim ok" : "topic ok"}): ${stats.alreadyOk}`);
console.log(`URL 无缓存 (cache miss): ${stats.noCache}`);
console.log(`✓ ${MODE === "shrink" ? "自动修建议" : "topic-suspect"}: ${stats.autoFixable}`);
if (MODE === "shrink") {
  console.log(`✗ 无候选 (no_candidate · 三闸门未过): ${stats.noCandidate}`);
}
if (APPLY && MODE === "shrink") console.log(`✦ 落库: ${stats.applied}`);
const planFile = MODE === "shrink" ? "/tmp/auto-shrink-v3-plan.json" : "/tmp/topic-audit-plan.json";
writeFileSync(planFile, JSON.stringify({ stats, plan }, null, 2));
console.log(`\nplan → ${planFile}  (${plan.length} 条)`);
if (plan.length > 0 && MODE === "shrink") {
  console.log("\n样本:");
  for (const p of plan.slice(0, 8)) {
    console.log(`  [${p.where}] ${p.rule_id}  id=${p.score.id_hits} q=${p.score.q_hits} t=${p.score.t_hits}`);
    console.log(`     原:  ${p.original_quote_first_80}`);
    console.log(`     新:  ${p.new_quote.slice(0,120)}`);
  }
} else if (plan.length > 0) {
  console.log("\n样本 (topic-suspect):");
  for (const p of plan.slice(0, 12)) {
    console.log(`  [${p.where}] ${p.rule_id}  cur(id=${p.current_quote_token_hits.id_hits}, t=${p.current_quote_token_hits.t_hits})`);
    console.log(`     title:    ${p.rule_title}`);
    console.log(`     现 quote: ${p.current_quote_first_120}`);
    console.log(`     建议:     ${(p.suggested_quote || '').slice(0,140)}`);
  }
}
