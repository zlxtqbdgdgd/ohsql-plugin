#!/usr/bin/env node
/**
 * audit-report-grounding · v1.0 红线最终闸 · 验证报告里所有展示给用户的字面
 * 都能在它的 [参考N] URL 字面命中。
 *
 * 输入: cli-diagnose.mjs --out-json 产物
 * 输出: 每条 fire 规则的 footer 字面 vs URL 对账报告
 * 失败条件: 任意一条 fire 规则的字面没在 URL substring 命中 → exit 1
 *
 * 用法:
 *   node tools/audit-report-grounding.mjs <diag.json> [--html-cache <dir>]
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CACHE = join(__dirname, "..", "reports", "cleanup", "round3", "html-cache");

function urlHash(u) { return createHash("sha1").update(u).digest("hex").slice(0, 16); }

function stripHtml(h) {
  return h.replace(/<script[\s\S]*?<\/script>/gi, " ")
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
function canonical(s) {
  return s.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-").replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ").trim().toLowerCase();
}

const diagPath = process.argv[2];
if (!diagPath) {
  console.error("usage: audit-report-grounding <diag.json> [--html-cache <dir>]");
  process.exit(2);
}
const cacheIdx = process.argv.indexOf("--html-cache");
const cacheDir = cacheIdx > 0 ? process.argv[cacheIdx + 1] : DEFAULT_CACHE;

const diag = JSON.parse(readFileSync(diagPath, "utf8"));
const fired = diag.results.filter(r => r.severity === "critical" || r.severity === "warning");

console.log(`# audit-report-grounding · ${fired.length} fire 规则字面验`);
console.log(`# 红线: 每条字面必须能在它的 source URL 字面命中`);
console.log("");

const cacheCanonByUrl = new Map();
function getCanon(url) {
  if (!url) return null;
  if (cacheCanonByUrl.has(url)) return cacheCanonByUrl.get(url);
  const path = join(cacheDir, urlHash(url) + ".html");
  if (!existsSync(path)) { cacheCanonByUrl.set(url, null); return null; }
  const c = canonical(stripHtml(readFileSync(path, "utf8")));
  cacheCanonByUrl.set(url, c);
  return c;
}

let total = 0, passed = 0, failed = 0, noCache = 0, noQuote = 0;
const failures = [];

/** 在 citations 全部 url 里找首个字面命中的 · 返 hit url 或 null */
function checkAgainstAllUrls(value, citations) {
  if (!value || !value.trim()) return { skip: true };
  const v = canonical(value);
  if (!citations || citations.length === 0) return { hit: null, miss: true };
  for (const c of citations) {
    const canon = getCanon(c.url);
    if (canon && canon.indexOf(v) >= 0) return { hit: c.url };
  }
  // 没命中任何 citations · 单独看是不是 cache 问题
  const allNoCache = citations.every(c => !getCanon(c.url));
  if (allNoCache) return { noCache: true };
  return { miss: true };
}

for (const r of fired) {
  console.log(`[${r.severity}] ${r.id}`);

  // summary
  {
    const ret = checkAgainstAllUrls(r.summary, r.citations);
    if (ret.skip) { noQuote++; console.log(`     summary  · (空)`); }
    else if (ret.hit) { total++; passed++; console.log(`     summary  · ✅ 命中 ${ret.hit.slice(0,50)}`); }
    else if (ret.noCache) { total++; noCache++; console.log(`     summary  · ⚠️  no cache`); }
    else { total++; failed++; failures.push({rule: r.id, field: "summary"}); console.log(`     summary  · ❌ MISS`); }
  }

  // recommendations · 每条 action 优先用 fix_url 验,没 fix_url 时全 citations 试
  for (let i = 0; i < (r.recommendations || []).length; i++) {
    const rec = r.recommendations[i];
    total++;
    const v = canonical(rec.action || "");
    let hit = null, miss = false;
    if (rec.fix_url) {
      const c = getCanon(rec.fix_url);
      if (c && c.indexOf(v) >= 0) hit = rec.fix_url;
    }
    if (!hit) {
      for (const c of (r.citations || [])) {
        const canon = getCanon(c.url);
        if (canon && canon.indexOf(v) >= 0) { hit = c.url; break; }
      }
    }
    if (hit) { passed++; console.log(`     rec[${i}]  · ✅ 命中 ${hit.slice(0,50)}`); }
    else {
      failed++; failures.push({rule: r.id, field: `rec[${i}].action`, action: rec.action.slice(0,60)});
      console.log(`     rec[${i}]  · ❌ MISS · ${(rec.action||'').slice(0,60)}`);
    }
  }

  // threshold_display
  {
    const ret = checkAgainstAllUrls(r.threshold_display, r.citations);
    if (!ret.skip) {
      total++;
      if (ret.hit) { passed++; console.log(`     threshold · ✅`); }
      else if (ret.noCache) { noCache++; }
      else { failed++; failures.push({rule: r.id, field: "threshold_display"}); console.log(`     threshold · ❌ MISS`); }
    }
  }

  // rationale 4 字段
  if (r.rationale) {
    for (const k of ["summary", "mechanism", "trade_offs", "when_to_deviate"]) {
      const v = r.rationale[k];
      if (!v || v === "n/a") continue;
      total++;
      const ret = checkAgainstAllUrls(v, r.citations);
      if (ret.hit) passed++;
      else if (ret.noCache) noCache++;
      else { failed++; failures.push({rule: r.id, field: `rationale.${k}`}); }
    }
  }
  console.log("");
}

console.log("=== 总览 ===");
console.log(`  total checks: ${total}`);
console.log(`  ✅ 字面命中:   ${passed}`);
console.log(`  ❌ MISS:      ${failed}`);
console.log(`  ⚠️  no cache: ${noCache}`);
console.log(`  pass rate (排 no-cache): ${total - noCache > 0 ? ((passed / (total - noCache)) * 100).toFixed(1) : 0}%`);

if (failures.length > 0) {
  console.log("");
  console.log("=== MISS 详情 ===");
  for (const f of failures.slice(0, 20)) {
    console.log(`  [${f.rule}] ${f.field}`);
    console.log(`    url: ${f.url ?? "(空)"}`);
    if (f.action) console.log(`    action: ${f.action}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
