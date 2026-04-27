#!/usr/bin/env node
// refresh-url-cache · 重建 lint-kb-quotes 用的 URL 文本缓存
//
// 流程:
//   1. 收集 data/**/rules.json + sqlite knowledge 里所有 distinct source URL
//   2. curl 抓 HTML · sed 去 <script>/<style>/<nav> 等 → .txt
//   3. 文本字数 < 8000 时,认为是 SPA(只有壳没有正文),用 Playwright(puppeteer-core +
//      系统 Chrome)走 innerText 重抓
//   4. 写到 tools/url-cache/<sha1[:12]>.txt
//
// 依赖(运行时按需引入):
//   - puppeteer-core (npm)
//   - 系统 Chrome / Chromium 浏览器
//
// 在 CI 用:
//   - GitHub Actions ubuntu-latest 自带 chromium-browser · 见 .github/workflows/lint-kb-quotes.yml

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, "..");
const CACHE = resolve(__dirname, "url-cache");
const SQLITE = join(PLUGIN_ROOT, "data", "knowledge.sqlite");
const SPA_THRESHOLD = 8000;

mkdirSync(CACHE, { recursive: true });

function urlHash(u) { return createHash("sha1").update(u).digest("hex").slice(0, 12); }

function findRulesJsonFiles() {
  const out = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith("rules.json")) out.push(p);
    }
  }
  walk(join(PLUGIN_ROOT, "data"));
  return out;
}

async function collectUrls() {
  const urls = new Set();
  for (const path of findRulesJsonFiles()) {
    const list = JSON.parse(readFileSync(path, "utf8"));
    for (const r of list) {
      const u = r.source?.url;
      if (u) urls.add(u.split("#")[0]);
    }
  }
  // sqlite
  try {
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(SQLITE, { readonly: true });
    const rows = db.prepare("SELECT DISTINCT source_url FROM knowledge WHERE source_url IS NOT NULL").all();
    db.close();
    for (const r of rows) urls.add(r.source_url.split("#")[0]);
  } catch (e) {
    console.warn("sqlite 未读 (可能缺 better-sqlite3):", e.message);
  }
  return [...urls];
}

function cleanHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"").replace(/&#39;/gi, "'")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[\u00A0\t\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function fetchStatic(url) {
  try {
    const html = execSync(`curl -sL --max-time 25 -A "Mozilla/5.0" ${JSON.stringify(url)}`, { maxBuffer: 50 * 1024 * 1024 }).toString();
    return cleanHtml(html);
  } catch (e) { return ""; }
}

async function fetchSpa(url) {
  let puppeteer;
  try { puppeteer = (await import("puppeteer-core")).default; }
  catch { console.warn("  ⚠ puppeteer-core 未装,SPA 跳过"); return ""; }

  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  const exe = candidates.find(p => existsSync(p));
  if (!exe) { console.warn("  ⚠ 找不到 Chrome/Chromium · SPA 跳过"); return ""; }

  const browser = await puppeteer.launch({ executablePath: exe, headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (perf-kp-sql lint)");
    await page.goto(url, { waitUntil: "networkidle0", timeout: 45000 });
    await new Promise(r => setTimeout(r, 2000));
    return await page.evaluate(() => document.body?.innerText || "");
  } finally {
    await browser.close();
  }
}

const urls = await collectUrls();
console.log(`唯一 URL: ${urls.length} · 缓存目录: ${CACHE}`);
let cached = 0, fetched = 0, spa = 0, failed = 0;

for (const url of urls) {
  const hash = urlHash(url);
  const path = join(CACHE, `${hash}.txt`);
  if (existsSync(path) && process.argv.includes("--force") === false) { cached++; continue; }

  const text = fetchStatic(url);
  let final = text;
  let mode = "static";
  if (text.length < SPA_THRESHOLD) {
    const spaText = await fetchSpa(url);
    if (spaText.length > text.length) { final = spaText; mode = "spa"; spa++; }
  }
  if (final.length > 0) {
    writeFileSync(path, final + (mode === "spa" ? `\n\n=== STATIC STRIP ===\n\n${text}` : ""));
    fetched++;
    console.log(`  ✓ [${mode}] ${hash}  ${final.length} chars  ${url}`);
  } else {
    console.log(`  ✗ [fail]  ${hash}  ${url}`);
    failed++;
  }
}

console.log(`\n复用 ${cached} · 新抓 ${fetched} (其中 SPA ${spa}) · 失败 ${failed}`);
process.exit(failed > 0 ? 1 : 0);
