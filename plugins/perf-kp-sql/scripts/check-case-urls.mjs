#!/usr/bin/env node
// check-case-urls.mjs
//
// 抽 cases/CASES.md + best-practice/CASES.md 的 source_url 字段 ·
// 5 并发 HEAD(失败兜底 GET)· 30s timeout · 静态体检 ·
// 写报告到 data/quality-reports/case-url-reachability-report.json

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "..");
const DATA_DIR = resolve(PLUGIN_ROOT, "data");
const REPORT_DIR = resolve(DATA_DIR, "quality-reports");
const REPORT_PATH = resolve(REPORT_DIR, "case-url-reachability-report.json");

const CASE_FILES = [
  "data/cases/CASES.md",
  "data/best-practice/CASES.md",
];

const CONCURRENCY = 5;
const TIMEOUT_MS = 30_000;
const UA = "Mozilla/5.0 (compatible; perf-kp-sql-quality-check/1.0)";

// ---- 解析 case_id + source_url ----

function parseCaseUrls(absPath, relPath) {
  const lines = readFileSync(absPath, "utf8").split("\n");
  const out = [];
  let curId = null;
  for (const line of lines) {
    const h = line.match(/^## case_id:\s*(\S+)\s*$/);
    if (h) { curId = h[1]; continue; }
    if (!curId) continue;
    const f = line.match(/^- \*\*source_url\*\*:\s*(\S.*?)\s*$/);
    if (f) {
      // 去掉 markdown 反引号包裹
      let url = f[1].replace(/^`|`$/g, "").trim();
      out.push({ case_id: curId, url, source_file: relPath });
    }
  }
  return out;
}

const allEntries = [];
for (const rel of CASE_FILES) {
  allEntries.push(...parseCaseUrls(resolve(PLUGIN_ROOT, rel), rel));
}

// 去重(URL 维度) · 同一 URL 多个 case 引用时合并
const urlMap = new Map();
for (const e of allEntries) {
  if (!urlMap.has(e.url)) urlMap.set(e.url, { url: e.url, case_ids: [] });
  urlMap.get(e.url).case_ids.push(e.case_id);
}
const uniqueUrls = [...urlMap.values()];

console.error(`[check-case-urls] 共 ${allEntries.length} case · ${uniqueUrls.length} 唯一 URL · 并发 ${CONCURRENCY} · 超时 ${TIMEOUT_MS}ms`);

// ---- 单条 fetch ----

async function probe(url) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort("timeout"), TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": UA, Accept: "*/*" },
      redirect: "follow",
      signal: ac.signal,
    });
    // 部分服务器对 HEAD 返回 4xx/5xx 但实际 GET 可达 · 兜底再试 GET
    if (res.status === 405 || res.status === 403 || res.status === 400 || res.status >= 500) {
      try {
        const fallback = await fetch(url, {
          method: "GET",
          headers: { "User-Agent": UA, Accept: "*/*" },
          redirect: "follow",
          signal: ac.signal,
        });
        res = fallback;
      } catch (e) {
        // GET 也失败 · 用 HEAD 的结果
      }
    }
    clearTimeout(timer);
    return {
      status: res.status,
      final_url: res.url && res.url !== url ? res.url : null,
      error: null,
    };
  } catch (e) {
    clearTimeout(timer);
    const isAbort = e?.name === "AbortError" || /timeout/i.test(String(e?.message || e));
    return {
      status: null,
      final_url: null,
      error: isAbort ? "timeout" : String(e?.message || e),
    };
  }
}

// ---- 并发 worker ----

async function runPool(items, fn, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  const total = items.length;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      const r = await fn(items[i], i);
      results[i] = r;
      done++;
      if (done % 5 === 0 || done === total) {
        console.error(`  progress ${done}/${total}`);
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

const probed = await runPool(uniqueUrls, async (e) => {
  const r = await probe(e.url);
  return { ...e, ...r };
}, CONCURRENCY);

// ---- 汇总 ----

let s200 = 0, s3xx = 0, s404 = 0, sTimeout = 0, sOther = 0;
const details = [];
for (const r of probed) {
  let bucket = "other";
  if (r.error === "timeout") { sTimeout++; bucket = "timeout"; }
  else if (r.status === null) { sOther++; bucket = "error"; }
  else if (r.status === 200) { s200++; bucket = "200"; }
  else if (r.status >= 300 && r.status < 400) { s3xx++; bucket = "3xx"; }
  else if (r.status === 404) { s404++; bucket = "404"; }
  else { sOther++; bucket = `status-${r.status}`; }
  for (const cid of r.case_ids) {
    details.push({
      case_id: cid,
      url: r.url,
      status: r.status,
      bucket,
      redirect: r.final_url,
      error: r.error,
    });
  }
}

const report = {
  generated_at: new Date().toISOString(),
  config: { concurrency: CONCURRENCY, timeout_ms: TIMEOUT_MS, user_agent: UA },
  summary: {
    total_unique_urls: uniqueUrls.length,
    total_case_url_refs: allEntries.length,
    "200": s200,
    "3xx": s3xx,
    "404": s404,
    timeout: sTimeout,
    other: sOther,
  },
  details: details.sort((a, b) => a.case_id.localeCompare(b.case_id)),
};

if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");

console.error(`[check-case-urls] done · 200=${s200} 3xx=${s3xx} 404=${s404} timeout=${sTimeout} other=${sOther}`);
console.error(`[check-case-urls] report → ${REPORT_PATH}`);
