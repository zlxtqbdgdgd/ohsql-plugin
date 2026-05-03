#!/usr/bin/env node
// check-nlm-urls.mjs
//
// 读 data/notebooklm-urls.json · 检查每个 NotebookLM 源 URL 是否可达 ·
// 5 并发 HEAD(失败兜底 GET)· 30s timeout ·
// 写报告到 data/quality-reports/nlm-url-reachability-report.json

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "..");
const DATA_DIR = resolve(PLUGIN_ROOT, "data");
const NLM_URLS_PATH = resolve(DATA_DIR, "notebooklm-urls.json");
const REPORT_DIR = resolve(DATA_DIR, "quality-reports");
const REPORT_PATH = resolve(REPORT_DIR, "nlm-url-reachability-report.json");

const CONCURRENCY = 5;
const TIMEOUT_MS = 30_000;
const UA = "Mozilla/5.0 (compatible; perf-kp-sql-quality-check/1.0)";

const raw = JSON.parse(readFileSync(NLM_URLS_PATH, "utf8"));
const entries = [];
for (const nb of raw.domains || []) {
  for (const u of nb.urls || []) {
    entries.push({
      notebook_domain: nb.domain,
      notebook_id: nb.notebook_name,
      language: nb.language,
      url: u.url,
      title: u.title,
    });
  }
}
console.error(`[check-nlm-urls] 共 ${entries.length} URL(${raw.domains?.length || 0} notebook)· 并发 ${CONCURRENCY} · 超时 ${TIMEOUT_MS}ms`);

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
        // ignore · 用 HEAD 结果
      }
    }
    clearTimeout(timer);
    return { status: res.status, final_url: res.url && res.url !== url ? res.url : null, error: null };
  } catch (e) {
    clearTimeout(timer);
    const isAbort = e?.name === "AbortError" || /timeout/i.test(String(e?.message || e));
    return { status: null, final_url: null, error: isAbort ? "timeout" : String(e?.message || e) };
  }
}

async function runPool(items, fn, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  const total = items.length;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
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

const probed = await runPool(entries, async (e) => {
  const r = await probe(e.url);
  return { ...e, ...r };
}, CONCURRENCY);

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
  details.push({
    notebook_domain: r.notebook_domain,
    notebook_id: r.notebook_id,
    url: r.url,
    title: r.title,
    status: r.status,
    bucket,
    redirect: r.final_url,
    error: r.error,
  });
}

const report = {
  generated_at: new Date().toISOString(),
  config: { concurrency: CONCURRENCY, timeout_ms: TIMEOUT_MS, user_agent: UA },
  summary: {
    total: entries.length,
    "200": s200,
    "3xx": s3xx,
    "404": s404,
    timeout: sTimeout,
    other: sOther,
  },
  details,
};

if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
console.error(`[check-nlm-urls] done · 200=${s200} 3xx=${s3xx} 404=${s404} timeout=${sTimeout} other=${sOther}`);
console.error(`[check-nlm-urls] report → ${REPORT_PATH}`);
