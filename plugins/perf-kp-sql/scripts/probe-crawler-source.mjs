#!/usr/bin/env node
// 爬虫源探测器
//
// 读 config/crawler-research-sources.json · 对每个源的每个 probe URL 做 fetch
// + AbortController(5s timeout) · 收集状态码 / 关键 headers / body 头部 ·
// 写报告到 data/quality-reports/crawler-source-probe.json。
//
// 设计:
// - process-level timeout(AbortController + 5s) · 真严格 · 不会 hang
// - 串行(避免触发 reverse-flood)
// - 单 URL fail 不影响其他 URL · 单源 fail 不影响其他源
// - 关键 headers 摘要(server / cf-ray / content-type / set-cookie 名)
// - body 前 800 字节(detect Cloudflare challenge / 真实内容 / sitemap 计数)
//
// 用法:
//   node plugins/perf-kp-sql/scripts/probe-crawler-source.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "..");
const CONFIG_PATH = resolve(PLUGIN_ROOT, "config/crawler-research-sources.json");
const REPORT_DIR = resolve(PLUGIN_ROOT, "data/quality-reports");
const REPORT_PATH = resolve(REPORT_DIR, "crawler-source-probe.json");

const TIMEOUT_MS = 5_000;
const USER_AGENT = "Mozilla/5.0 (compatible; perf-kp-sql-research/0.44.0)";

const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));

if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true });

// ---- fetch with timeout(process-level · 严格)----

async function probeUrl(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, "Accept": "*/*" },
      signal: ctrl.signal,
      redirect: "manual", // 手动处理重定向 · 看清楚 cf challenge / login wall
    });
    clearTimeout(timer);
    const status = res.status;
    const headers = Object.fromEntries(res.headers.entries());
    // 拿 body 前 800 字节
    let bodyHead = "";
    try {
      const reader = res.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        if (value) bodyHead = new TextDecoder("utf-8", { fatal: false }).decode(value).slice(0, 800);
        try { await reader.cancel(); } catch {}
      }
    } catch { /* body 读不到也 OK */ }

    // detect Cloudflare / WAF
    const isCfChallenge =
      bodyHead.includes("cloudflare") &&
      (bodyHead.includes("challenge") || bodyHead.includes("Just a moment") || bodyHead.includes("__cf"));
    const cfRay = headers["cf-ray"] || null;
    const contentType = headers["content-type"] || null;

    return {
      url,
      status,
      ok: res.ok,
      latency_ms: Date.now() - t0,
      headers_summary: {
        server: headers.server || null,
        "content-type": contentType,
        "cf-ray": cfRay,
        "x-cache": headers["x-cache"] || null,
        location: headers.location || null,
        "set-cookie-names": headers["set-cookie"]
          ? headers["set-cookie"].split(/, [a-zA-Z0-9_-]+=/).map((s, i) => i === 0 ? s.split("=")[0] : s.split("=")[0]).slice(0, 5)
          : null,
      },
      cloudflare: !!cfRay || isCfChallenge,
      is_cf_challenge: isCfChallenge,
      body_head: bodyHead,
      body_head_truncated: true,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      url,
      status: null,
      ok: false,
      latency_ms: Date.now() - t0,
      error: err.name === "AbortError" ? "timeout(5s)" : (err.message || String(err)),
    };
  }
}

// ---- 跑所有源 ----

const startedAt = new Date().toISOString();
const results = [];

for (const source of config.sources) {
  console.log(`[probe] ${source.id}(${source.domain})...`);
  const probeResults = [];
  for (const url of source.probe_urls) {
    const r = await probeUrl(url);
    probeResults.push(r);
    const tag = r.ok ? "✓" : (r.error || `HTTP ${r.status}`);
    console.log(`  · ${url} → ${tag}(${r.latency_ms}ms)`);
  }

  // 简单元结论
  const reachable = probeResults.filter((r) => r.ok || (r.status && r.status < 500)).length;
  const cfHit = probeResults.some((r) => r.cloudflare);
  const allTimeout = probeResults.every((r) => r.error === "timeout(5s)");

  results.push({
    id: source.id,
    domain: source.domain,
    lang: source.lang,
    trust_tier: source.trust_tier,
    topics: source.topics,
    note: source.note || null,
    probes: probeResults,
    summary: {
      reachable_count: reachable,
      total_probes: probeResults.length,
      cloudflare_detected: cfHit,
      all_timeout: allTimeout,
    },
  });
}

const finishedAt = new Date().toISOString();

const report = {
  generated_at: finishedAt,
  started_at: startedAt,
  duration_ms: Date.parse(finishedAt) - Date.parse(startedAt),
  config_path: "config/crawler-research-sources.json",
  fetch_timeout_ms: TIMEOUT_MS,
  user_agent: USER_AGENT,
  sources_total: config.sources.length,
  results,
  global_summary: {
    sources_total: config.sources.length,
    sources_fully_reachable: results.filter((r) => r.summary.reachable_count === r.summary.total_probes).length,
    sources_partial: results.filter((r) => r.summary.reachable_count > 0 && r.summary.reachable_count < r.summary.total_probes).length,
    sources_dead: results.filter((r) => r.summary.reachable_count === 0).length,
    sources_cloudflare: results.filter((r) => r.summary.cloudflare_detected).length,
    sources_all_timeout: results.filter((r) => r.summary.all_timeout).length,
  },
};

writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(`\n[report] ${REPORT_PATH}`);
console.log(`[summary] reachable=${report.global_summary.sources_fully_reachable}/${config.sources.length} · cloudflare=${report.global_summary.sources_cloudflare} · all-timeout=${report.global_summary.sources_all_timeout}`);
