#!/usr/bin/env node
// lint-kb-quotes · 军规 2 + 3 强制执行 · 0 幻觉的最后一道闸
//
// 校验范围:
//   1. 所有 data/**/rules.json 里 source.url + source.quote 必须 verbatim 命中
//   2. data/knowledge.sqlite 所有 fact 的 quote 必须 verbatim 命中其 source_url
//   3. quote 必须 ≥ 30 字(军规 2 第二条)
//
// 使用:
//   node tools/lint-kb-quotes.mjs                    # 用 ./tools/url-cache 缓存
//   node tools/lint-kb-quotes.mjs --cache <dir>      # 自定义缓存目录
//   node tools/lint-kb-quotes.mjs --strict           # 缓存缺失也算失败
//   node tools/lint-kb-quotes.mjs --json out.json    # 输出 JSON 报告
//
// 缓存格式: 每个 URL 的 sha1[:12] 命名的 .txt 文件,内容为去标签 + Playwright innerText 文本.
// 用 `node tools/refresh-url-cache.mjs` 重建缓存.
//
// CI 用法 (退码):
//   - 0   : 全部命中
//   - 1   : 有 QUOTE_FALSE / SHORT_QUOTE
//   - 2   : 有缓存缺失(--strict 时)

import { readFileSync, existsSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, "..");
const DEFAULT_CACHE = resolve(__dirname, "url-cache");
const SQLITE = join(PLUGIN_ROOT, "data", "knowledge.sqlite");
const MIN_QUOTE_LEN = 30;

const args = parseArgs({
  options: {
    cache: { type: "string", default: DEFAULT_CACHE },
    strict: { type: "boolean", default: false },
    json: { type: "string" },
    baseline: { type: "string" },             // 已知遗留违规 JSON (key 列表)
    "update-baseline": { type: "boolean", default: false },  // 把当前结果写成 baseline
  },
}).values;
const CACHE = args.cache;
const BASELINE_PATH = args.baseline;
function violationKey(it) {
  // 唯一 key: 来源 + id + (fact_type) + quote 前 60 字
  const where = it.file ?? it.where ?? "?";
  const ft = it.fact_type ? `:${it.fact_type}` : "";
  const q = (it.quote ?? "").slice(0, 60);
  return `${where}|${it.id}${ft}|${q}`;
}
let baselineKeys = new Set();
if (BASELINE_PATH && existsSync(BASELINE_PATH)) {
  const b = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  for (const k of (b.keys || [])) baselineKeys.add(k);
  console.log(`baseline 已知遗留 ${baselineKeys.size} 条`);
}

function urlHash(u) { return createHash("sha1").update(u).digest("hex").slice(0, 12); }

function canonical(s) {
  return String(s ?? "")
    .replace(/[\u2018\u2019\u201A\u201B`]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[“”‘’]/g, "'")
    .replace(/[（]/g, "(").replace(/[）]/g, ")")
    .replace(/[，]/g, ",").replace(/[。]/g, ".").replace(/[；]/g, ";")
    .replace(/\s+/g, " ").trim().toLowerCase();
}

function loadUrlText(url) {
  if (!url) return null;
  for (const cand of [url, url.split("#")[0]]) {
    const p = join(CACHE, `${urlHash(cand)}.txt`);
    if (existsSync(p)) return canonical(readFileSync(p, "utf8"));
  }
  return null;
}

function findRulesJsonFiles() {
  const out = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (f.endsWith("rules.json")) out.push(p);
    }
  }
  walk(join(PLUGIN_ROOT, "data"));
  return out;
}

async function loadSqliteFacts() {
  let Database;
  try {
    Database = (await import("better-sqlite3")).default;
  } catch (e) {
    return { available: false, facts: [] };
  }
  const db = new Database(SQLITE, { readonly: true });
  const facts = db.prepare(
    "SELECT rule_id, fact_type, source_url, quote FROM knowledge WHERE quote IS NOT NULL AND quote != ''"
  ).all();
  db.close();
  return { available: true, facts };
}

const issues = {
  QUOTE_FALSE: [],
  SHORT_QUOTE: [],
  CACHE_MISS: [],
  EMPTY_URL: [],
  BAD_PROVENANCE: [],         // 军规 1 · provenance 必须 ∈ {verified|inferred|model-generated}
  MISSING_FETCHED_AT: [],     // 军规 1.3 / 2.1 · verified 必须有 source.fetched_at
  MISSING_DERIVED_FROM: [],   // 军规 1.4 · inferred 必须 derived_from
  NUMERIC_THRESHOLD_GAP: [],  // 军规 3 · 阈值数字必须能在 quote 字面读到
};
const VALID_PROVENANCE = new Set(["verified", "inferred", "model-generated"]);

// 抽 quote / threshold 字段里的数字 (整数 / 小数 / 含单位前缀的)
function extractNumbers(s) {
  if (!s) return [];
  // 抓连续数字串(可含小数点) 长度≥2 (避免 "1" "2" 这种短数误报)
  return [...String(s).matchAll(/\d+(?:\.\d+)?/g)].map(m => m[0]).filter(n => n.length >= 2);
}
let total = 0, passed = 0;

// ---------- rules.json files ----------
const jsonFiles = findRulesJsonFiles();
for (const path of jsonFiles) {
  const list = JSON.parse(readFileSync(path, "utf8"));
  for (const rule of list) {
    total++;
    const id = rule.id ?? rule.rule_id ?? "(no-id)";
    const url = rule.source?.url;
    const quote = rule.source?.quote;
    const file = path.replace(PLUGIN_ROOT + "/", "");

    // 军规 1 · provenance 必须合法 (rules.json 层)
    const prov = rule.provenance;
    if (prov && !VALID_PROVENANCE.has(prov)) {
      issues.BAD_PROVENANCE.push({ file, id, provenance: prov });
    }
    // 'model-generated' 不许带 quote (因为 quote 字段意味着引文校验)
    if (prov === "model-generated" && rule.source?.quote) {
      issues.BAD_PROVENANCE.push({ file, id, reason: "model-generated 不许有 source.quote (quote=有出处)" });
    }
    // 军规 1.4 · inferred 必须 derived_from
    if (prov === "inferred" && !rule.derived_from) {
      issues.MISSING_DERIVED_FROM.push({ file, id, reason: "inferred 必须挂 derived_from" });
    }
    // 军规 1.3 / 2.1 · verified 必须 source.fetched_at
    if ((prov === "verified" || prov == null) && rule.source?.url && !rule.source?.fetched_at) {
      issues.MISSING_FETCHED_AT.push({ file, id });
    }
    // 军规 3 · 阈值数字 (rule.threshold 或 metric_expr) 必须在 quote 字面读到
    if (rule.source?.quote && (rule.threshold || rule.metric_expr)) {
      const thresholdNums = extractNumbers((rule.threshold ?? "") + " " + (rule.metric_expr ?? ""));
      const cQuote = canonical(rule.source.quote);
      const missing = thresholdNums.filter(n => !cQuote.includes(n));
      if (missing.length > 0) {
        issues.NUMERIC_THRESHOLD_GAP.push({ file, id, missing_numbers: missing, threshold: rule.threshold ?? rule.metric_expr });
      }
    }
    if (!url) { issues.EMPTY_URL.push({ file, id, where: "rules.json" }); continue; }
    if (!quote) { continue; }  // 没 quote 不强制
    if (canonical(quote).length < MIN_QUOTE_LEN) {
      issues.SHORT_QUOTE.push({ file, id, quote: quote.slice(0, 60), len: canonical(quote).length });
    }
    const txt = loadUrlText(url);
    if (txt === null) { issues.CACHE_MISS.push({ file, id, url }); continue; }
    if (!txt.includes(canonical(quote))) {
      issues.QUOTE_FALSE.push({ file, id, url: url.slice(0, 80), quote: quote.slice(0, 80) });
    } else {
      passed++;
    }
  }
}

// ---------- sqlite facts (async due to dynamic import) ----------
const { available, facts } = await loadSqliteFacts();
if (available) {
  for (const f of facts) {
    total++;
    const url = f.source_url, quote = f.quote;
    if (!url) { issues.EMPTY_URL.push({ where: "sqlite", id: f.rule_id, fact_type: f.fact_type }); continue; }
    if (canonical(quote).length < MIN_QUOTE_LEN) {
      issues.SHORT_QUOTE.push({ where: "sqlite", id: f.rule_id, fact_type: f.fact_type, quote: quote.slice(0, 60), len: canonical(quote).length });
    }
    const txt = loadUrlText(url);
    if (txt === null) { issues.CACHE_MISS.push({ where: "sqlite", id: f.rule_id, fact_type: f.fact_type, url }); continue; }
    if (!txt.includes(canonical(quote))) {
      issues.QUOTE_FALSE.push({ where: "sqlite", id: f.rule_id, fact_type: f.fact_type, url: url.slice(0, 80), quote: quote.slice(0, 80) });
    } else {
      passed++;
    }
  }
}

// ---------- 报告 ----------
console.log(`\n=== lint-kb-quotes · 总扫 ${total} 项 ===`);
console.log(`✓ 命中字面: ${passed}`);
console.log(`✗ QUOTE_FALSE (quote 不在 URL 字面 → 幻觉): ${issues.QUOTE_FALSE.length}`);
console.log(`⚠ SHORT_QUOTE (quote < ${MIN_QUOTE_LEN} 字,军规 2 违反): ${issues.SHORT_QUOTE.length}`);
console.log(`⊘ CACHE_MISS (URL 缓存缺失,无法校验): ${issues.CACHE_MISS.length}`);
console.log(`⚠ EMPTY_URL  (有 quote 但无 source.url): ${issues.EMPTY_URL.length}`);
console.log(`✗ BAD_PROVENANCE (军规 1 · provenance 非法 / model-generated 带 quote): ${issues.BAD_PROVENANCE.length}`);
console.log(`✗ MISSING_DERIVED_FROM (军规 1.4 · inferred 缺 derived_from): ${issues.MISSING_DERIVED_FROM.length}`);
console.log(`✗ NUMERIC_THRESHOLD_GAP (军规 3 · 阈值数字不在 quote 字面): ${issues.NUMERIC_THRESHOLD_GAP.length}`);
console.log(`⚠ MISSING_FETCHED_AT (军规 1.3/2.1 · verified 缺 source.fetched_at · warn-only): ${issues.MISSING_FETCHED_AT.length}`);

for (const [k, list] of Object.entries(issues)) {
  if (list.length === 0) continue;
  console.log(`\n--- ${k} (${list.length}) ---`);
  for (const it of list.slice(0, 25)) {
    console.log("  " + JSON.stringify(it));
  }
  if (list.length > 25) console.log(`  ... +${list.length - 25} more`);
}

if (args.json) {
  writeFileSync(args.json, JSON.stringify({ total, passed, issues }, null, 2));
  console.log(`\nJSON report → ${args.json}`);
}

// ---------- baseline 处理 ----------
const fatalCategories = ["QUOTE_FALSE", "SHORT_QUOTE", "EMPTY_URL", "BAD_PROVENANCE", "MISSING_DERIVED_FROM", "NUMERIC_THRESHOLD_GAP"];
// MISSING_FETCHED_AT 暂为 warn-only (现存大量,需逐步补)
const allFatal = fatalCategories.flatMap(k => issues[k].map(it => ({ ...it, _cat: k, _key: violationKey(it) })));

if (args["update-baseline"]) {
  const out = BASELINE_PATH ?? join(__dirname, "lint-kb-quotes.baseline.json");
  writeFileSync(out, JSON.stringify({
    note: "已知遗留违规 (军规 2 / 3) · 跑 lint 时这些 key 不计为 fail · 修复后从此处删除该 key",
    generated_at: new Date().toISOString(),
    count: allFatal.length,
    keys: allFatal.map(it => it._key),
  }, null, 2));
  console.log(`\n✓ 已写 baseline → ${out} (${allFatal.length} 条)`);
  process.exit(0);
}

const newFatal = allFatal.filter(it => !baselineKeys.has(it._key));
const fixedInBaseline = [...baselineKeys].filter(k => !allFatal.some(it => it._key === k));

if (BASELINE_PATH) {
  console.log(`\n基线对账: 总违规 ${allFatal.length} · 新增 ${newFatal.length} · 已知遗留 ${allFatal.length - newFatal.length} · 已被修复 ${fixedInBaseline.length}`);
}
if (newFatal.length > 0) {
  console.log(`\n❌ FAIL: ${newFatal.length} 条新增违规 (不在 baseline 内)`);
  for (const it of newFatal.slice(0, 30)) console.log(`  [${it._cat}] ${it._key}`);
  process.exit(1);
}
if (BASELINE_PATH && fixedInBaseline.length > 0) {
  console.log(`\n⚠ baseline 里有 ${fixedInBaseline.length} 条违规已被修复 · 请删除对应 key (跑 --update-baseline 重生成):`);
  for (const k of fixedInBaseline.slice(0, 10)) console.log(`  ${k}`);
}
const hasCacheMiss = issues.CACHE_MISS.length > 0;
if (allFatal.length > 0) {
  console.log("\n⚠ 仍有 baseline 内的遗留违规 · 待逐条清理 (本次未新增 · CI 通过)");
}
if (args.strict && hasCacheMiss) {
  console.log(`\n❌ FAIL (--strict): 有 ${issues.CACHE_MISS.length} 条 URL 未缓存 · 跑 \`node tools/refresh-url-cache.mjs\` 补缓存后重跑`);
  process.exit(2);
}
console.log("\n✓ PASS");
process.exit(0);
