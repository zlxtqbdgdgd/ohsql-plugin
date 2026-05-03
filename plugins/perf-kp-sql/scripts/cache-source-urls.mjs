#!/usr/bin/env node
// 缓存 case source URL 内容到本地 · 给 LLM-as-Judge a3(引用对照)用
//
// 设计:
// - 读 case_id → source_url 映射(从 cases/CASES.md + best-practice/CASES.md)
// - 去重 URL · fetch + AbortController(30s timeout · source URL 通常较慢)
// - 用纯 Node 简单去标签(去 <script><style><noscript><svg> + 抽取标签内文本)
// - 存 data/source-cache/<sha1-of-url>.md
// - 同时存 data/source-cache/manifest.json(URL → sha1 + 哪些 case 用了它)
//
// 用法:
//   node plugins/perf-kp-sql/scripts/cache-source-urls.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "..");
const DATA_DIR = resolve(PLUGIN_ROOT, "data");
const CACHE_DIR = resolve(DATA_DIR, "source-cache");
const MANIFEST_PATH = resolve(CACHE_DIR, "manifest.json");

const TIMEOUT_MS = 30_000; // source URL 可能慢(国外 mongodb.com / cnblogs)
const USER_AGENT = "Mozilla/5.0 (compatible; perf-kp-sql-research/0.45.0)";
const CONCURRENCY = 5; // 限并发 · 防被反爬

if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

// ---- 读 cases · 抽 source_url ----

function parseCaseSourceUrls(path) {
  const lines = readFileSync(path, "utf8").split("\n");
  const result = []; // {case_id, source_url}
  let cur_id = null;
  for (const line of lines) {
    const m = line.match(/^## case_id:\s*(\S+)/);
    if (m) { cur_id = m[1]; continue; }
    if (cur_id) {
      const u = line.match(/^- \*\*source_url\*\*:\s*(\S+)/);
      if (u) {
        result.push({ case_id: cur_id, source_url: u[1] });
        cur_id = null;
      }
    }
  }
  return result;
}

const allCases = [
  ...parseCaseSourceUrls(resolve(DATA_DIR, "cases/CASES.md")),
  ...parseCaseSourceUrls(resolve(DATA_DIR, "best-practice/CASES.md")),
];

// 去重 URL
const urlToCases = new Map(); // url → [case_id, ...]
for (const { case_id, source_url } of allCases) {
  if (!urlToCases.has(source_url)) urlToCases.set(source_url, []);
  urlToCases.get(source_url).push(case_id);
}

const uniqueUrls = [...urlToCases.keys()];
console.log(`[cache] cases=${allCases.length} · unique URLs=${uniqueUrls.length}`);

// ---- HTML → 干净文本(纯 Node · 不依赖外部包) ----

function htmlToText(html) {
  let s = html;
  // 移除 script / style / noscript / svg / template / iframe 整段
  s = s.replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ");
  // 移除 HTML 注释
  s = s.replace(/<!--[\s\S]*?-->/g, " ");

  // <pre> / <code> 块特殊处理:保留内部换行 + 文本(命令行 / 配置示例的可读性关键)
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, body) => {
    const inner = body.replace(/<[^>]+>/g, ""); // 去掉内嵌标签
    return "\n```\n" + inner.trim() + "\n```\n";
  });
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, body) => {
    const inner = body.replace(/<[^>]+>/g, "");
    return "`" + inner.trim() + "`";
  });

  // <table> 行处理:每个 <tr> 换行 · 每个 <td>/<th> 用 ` | ` 分隔(保表结构感)
  s = s.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, row) => {
    const cells = [];
    row.replace(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi, (_, cell) => {
      cells.push(cell.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      return "";
    });
    return "\n" + cells.join(" | ") + "\n";
  });

  // 把块级标签替换为换行(保留段落感)
  s = s.replace(/<\/(p|div|h[1-6]|li|br|hr|article|section|main)\s*>/gi, "\n");
  s = s.replace(/<(br|hr)\s*\/?\s*>/gi, "\n");
  // 移除其余所有标签
  s = s.replace(/<[^>]+>/g, " ");
  // HTML 实体解码(常见的)
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([\da-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
  // 多空格 / 多空行压一下
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n[ \t]+/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// ---- fetch with timeout ----

async function fetchUrl(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, "Accept": "text/html,*/*" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}`, latency_ms: Date.now() - t0 };
    }
    const html = await res.text();
    const text = htmlToText(html);
    return {
      ok: true,
      status: res.status,
      url_final: res.url,
      content_type: res.headers.get("content-type") || null,
      html_bytes: html.length,
      text_chars: text.length,
      text,
      latency_ms: Date.now() - t0,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false,
      error: err.name === "AbortError" ? `timeout(${TIMEOUT_MS}ms)` : (err.message || String(err)),
      latency_ms: Date.now() - t0,
    };
  }
}

// ---- 并发限速跑 ----

function urlSha1(url) {
  return createHash("sha1").update(url).digest("hex").slice(0, 16);
}

const manifest = []; // {url, sha1, file, status, error?, html_bytes, text_chars, latency_ms, used_by_cases}

async function processOne(url, i, total) {
  const sha = urlSha1(url);
  const file = `${sha}.md`;
  const filePath = resolve(CACHE_DIR, file);
  const used_by = urlToCases.get(url);

  const tag = `[${i + 1}/${total}]`;
  const r = await fetchUrl(url);
  if (r.ok) {
    const header = [
      `<!-- source URL cache · perf-kp-sql LLM-as-Judge (a3) input -->`,
      `<!-- url: ${url} -->`,
      `<!-- url_final: ${r.url_final} -->`,
      `<!-- fetched_at: ${new Date().toISOString()} -->`,
      `<!-- html_bytes: ${r.html_bytes} · text_chars: ${r.text_chars} -->`,
      `<!-- used_by_cases: ${used_by.length} -->`,
      ``,
    ].join("\n");
    writeFileSync(filePath, header + r.text + "\n", "utf8");
    console.log(`${tag} ✓ ${url} · ${r.text_chars}c · ${r.latency_ms}ms`);
    manifest.push({
      url,
      sha1: sha,
      file,
      status: r.status,
      url_final: r.url_final,
      html_bytes: r.html_bytes,
      text_chars: r.text_chars,
      latency_ms: r.latency_ms,
      used_by_cases: used_by,
    });
  } else {
    console.log(`${tag} ✗ ${url} · ${r.error}`);
    manifest.push({
      url,
      sha1: sha,
      file: null,
      status: r.status || null,
      error: r.error,
      latency_ms: r.latency_ms,
      used_by_cases: used_by,
    });
  }
}

async function runAll() {
  const total = uniqueUrls.length;
  let i = 0;
  const workers = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push((async () => {
      while (i < total) {
        const idx = i++;
        await processOne(uniqueUrls[idx], idx, total);
      }
    })());
  }
  await Promise.all(workers);
}

const startedAt = new Date().toISOString();
await runAll();
const finishedAt = new Date().toISOString();

const summary = {
  generated_at: finishedAt,
  started_at: startedAt,
  duration_ms: Date.parse(finishedAt) - Date.parse(startedAt),
  cases_total: allCases.length,
  unique_urls: uniqueUrls.length,
  cached_ok: manifest.filter((m) => m.file).length,
  cached_fail: manifest.filter((m) => !m.file).length,
  cache_dir: "data/source-cache/",
  fetch_timeout_ms: TIMEOUT_MS,
  concurrency: CONCURRENCY,
  user_agent: USER_AGENT,
  entries: manifest,
};

writeFileSync(MANIFEST_PATH, JSON.stringify(summary, null, 2) + "\n", "utf8");
console.log(`\n[manifest] ${MANIFEST_PATH}`);
console.log(`[summary] cached=${summary.cached_ok}/${summary.unique_urls} · failed=${summary.cached_fail}`);
