#!/usr/bin/env node
/**
 * audit-citations — 全量审计 rules.json 中的 URL + quote
 *
 * 用法:
 *   node audit-citations.mjs \
 *     [--rules data/mongo/rules.json,data/common/kunpeng-rules.json] \
 *     [--out data/audit-citations-<TS>.json] \
 *     [--concurrency 8] \
 *     [--timeout-ms 15000] \
 *     [--user-agent "perf-kp-sql-audit/0.5"]
 *
 * 流程:
 *   1. 收集所有 distinct URL
 *   2. HTTP HEAD (followRedirect=true) → 标 live / redirect / dead
 *   3. 对 live + redirect 的 URL: GET 内容 → strip HTML → 在 body 里搜 quote 字面
 *   4. 输出 JSON 报告(per rule + summary)
 *
 * 不做的事(交人工):
 *   - 不自动改 rules.json
 *   - 不自动删规则
 *   - 不做"语义匹配"(字面 miss 就标 miss · LLM 介入留给后续 audit-fix)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RuleSource {
  tier?: string;
  url?: string;
  title?: string;
  quote?: string;
  accessed?: string;
}

interface Rule {
  id?: string;
  rule_id?: string;
  source?: RuleSource;
  // Other fields ignored
}

type UrlStatus = "live" | "redirect" | "dead" | "network_error" | "skipped";
type QuoteMatch = "literal" | "miss" | "no_quote" | "skipped" | "url_dead";

interface RuleAuditEntry {
  rule_id: string;
  source_file: string;
  url: string;
  url_status: UrlStatus;
  url_final?: string;
  http_status?: number;
  redirect_chain?: string[];
  quote_match: QuoteMatch;
  quote_excerpt?: string;
  quote_first_words?: string;
  notes?: string;
  audit_error?: string;
}

interface UrlMeta {
  url: string;
  status: UrlStatus;
  http_status?: number;
  url_final?: string;
  redirect_chain?: string[];
  body_text?: string;
  body_chars?: number;
  fetch_error?: string;
}

interface AuditReport {
  audited_at: string;
  source_files: string[];
  summary: {
    rules_total: number;
    rules_with_url: number;
    rules_with_quote: number;
    urls_distinct: number;
    url_live: number;
    url_redirect: number;
    url_dead: number;
    url_network_error: number;
    quote_literal_match: number;
    quote_miss: number;
    quote_no_quote: number;
    quote_url_dead: number;
  };
  per_url: Record<string, Omit<UrlMeta, "body_text">>;
  per_rule: RuleAuditEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowTs(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z]+;/gi, " ");
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function normalizeQuotes(s: string): string {
  // unify smart quotes / dashes that often differ between scrape and live page
  return s
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00A0/g, " ");
}

function canonical(s: string): string {
  return normalizeWhitespace(normalizeQuotes(s)).toLowerCase();
}

function firstWords(s: string, n = 12): string {
  return normalizeWhitespace(s).split(" ").slice(0, n).join(" ");
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function fetchWithFollow(
  url: string,
  opts: { method: "HEAD" | "GET"; timeoutMs: number; userAgent: string; maxHops?: number },
): Promise<{
  finalUrl: string;
  status: number;
  redirectChain: string[];
  body?: string;
  error?: string;
}> {
  const maxHops = opts.maxHops ?? 5;
  let current = url;
  const chain: string[] = [];

  for (let hop = 0; hop <= maxHops; hop++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), opts.timeoutMs);
    try {
      const resp = await fetch(current, {
        method: opts.method,
        redirect: "manual",
        signal: ac.signal,
        headers: {
          "User-Agent": opts.userAgent,
          Accept: opts.method === "GET" ? "text/html,*/*;q=0.8" : "*/*",
          "Accept-Language": "en;q=0.9",
        },
      });
      clearTimeout(timer);

      if ([301, 302, 303, 307, 308].includes(resp.status)) {
        const loc = resp.headers.get("location");
        if (!loc) {
          return { finalUrl: current, status: resp.status, redirectChain: chain };
        }
        const nextUrl = new URL(loc, current).toString();
        chain.push(nextUrl);
        current = nextUrl;
        continue;
      }

      let body: string | undefined;
      if (opts.method === "GET" && resp.ok) {
        try {
          body = await resp.text();
        } catch (e) {
          // body unread
        }
      }
      return { finalUrl: current, status: resp.status, redirectChain: chain, body };
    } catch (e: any) {
      clearTimeout(timer);
      const msg = e?.name === "AbortError" ? "timeout" : (e?.message ?? String(e));
      return { finalUrl: current, status: 0, redirectChain: chain, error: msg };
    }
  }
  return { finalUrl: current, status: 0, redirectChain: chain, error: "too_many_redirects" };
}

// ---------------------------------------------------------------------------
// Concurrency-limited map
// ---------------------------------------------------------------------------

async function pmap<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

// ---------------------------------------------------------------------------
// Load rules
// ---------------------------------------------------------------------------

function loadRules(path: string): { source_file: string; rules: Rule[] } {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw new Error(`rules file not found: ${abs}`);
  }
  const raw = JSON.parse(readFileSync(abs, "utf8"));
  const rules: Rule[] = Array.isArray(raw) ? raw : (raw.rules ?? []);
  return { source_file: abs, rules };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Extractive verify mode (合并自原 tools/verify-extractive.ts)
//
// 用途: cleaner v5 产出多 fact_type quote / rule · 用同款 canonical() 字面验
// 区别于"audit URL+quote"模式: 不重新 fetch · 用 cleaner v5 已落盘的 html-cache
// ---------------------------------------------------------------------------

interface ExtractedFact {
  type: string;
  quote: string | null;
  note?: string;
}
interface ExtractedRule {
  rule_id: string;
  source_url: string;
  source_quote_seed: string | null;
  facts: ExtractedFact[];
  llm_error?: string;
}
interface VerifiedFact extends ExtractedFact {
  verified: boolean;
  reject_reason?: string;
  hit_at?: number;
}
interface VerifiedRule extends Omit<ExtractedRule, "facts"> {
  facts: VerifiedFact[];
  html_loaded: boolean;
}

function urlHash(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 16);
}

function runExtractiveVerify(inputPath: string, cacheDir: string, outPath: string): void {
  const extracted = JSON.parse(readFileSync(inputPath, "utf8")) as ExtractedRule[];
  const verified: VerifiedRule[] = [];
  const stats = {
    rules: 0, rules_html_missing: 0,
    facts_total: 0, facts_null: 0,
    facts_verified: 0, facts_rejected: 0, facts_html_missing: 0,
  };

  for (const rule of extracted) {
    stats.rules++;
    const cachePath = rule.source_url ? join(cacheDir, `${urlHash(rule.source_url)}.html`) : "";
    const htmlOk = !!cachePath && existsSync(cachePath);
    let canonicalHtml = "";
    if (htmlOk) {
      canonicalHtml = canonical(stripHtml(readFileSync(cachePath, "utf8")));
    } else {
      stats.rules_html_missing++;
    }

    const vfacts: VerifiedFact[] = rule.facts.map((f) => {
      stats.facts_total++;
      if (!f.quote) {
        stats.facts_null++;
        return { ...f, verified: false, reject_reason: "null_or_empty" };
      }
      if (!htmlOk) {
        stats.facts_html_missing++;
        return { ...f, verified: false, reject_reason: "html_cache_missing" };
      }
      const cq = canonical(f.quote);
      if (!cq) {
        stats.facts_rejected++;
        return { ...f, verified: false, reject_reason: "quote_canonical_empty" };
      }
      const idx = canonicalHtml.indexOf(cq);
      if (idx >= 0) {
        stats.facts_verified++;
        return { ...f, verified: true, hit_at: idx };
      }
      stats.facts_rejected++;
      return { ...f, verified: false, reject_reason: "no_substring_match", hit_at: -1 };
    });
    verified.push({ ...rule, facts: vfacts, html_loaded: htmlOk });
  }

  const outDir = dirname(outPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, JSON.stringify(verified, null, 2));

  const denom = stats.facts_total - stats.facts_null - stats.facts_html_missing;
  const rate = denom > 0 ? (stats.facts_verified / denom) * 100 : 0;
  console.log(`[audit/extractive] written: ${outPath}`);
  console.log(`[audit/extractive] rules: ${stats.rules} (html-missing: ${stats.rules_html_missing})`);
  console.log(`[audit/extractive] facts: total=${stats.facts_total}`);
  console.log(`[audit/extractive]   null  (LLM 弃疗): ${stats.facts_null}`);
  console.log(`[audit/extractive]   no-html cache    : ${stats.facts_html_missing}`);
  console.log(`[audit/extractive]   verified         : ${stats.facts_verified}`);
  console.log(`[audit/extractive]   rejected (改写/编): ${stats.facts_rejected}`);
  console.log(`[audit/extractive] verify-rate: ${rate.toFixed(1)}%`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      rules: { type: "string", default: "" },
      out: { type: "string", default: "" },
      concurrency: { type: "string", default: "8" },
      "timeout-ms": { type: "string", default: "15000" },
      "user-agent": { type: "string", default: "perf-kp-sql-audit/0.5" },
      "extractive-input": { type: "string", default: "" },
      "html-cache": { type: "string", default: "" },
      help: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    process.stdout.write(
      `Usage: audit-citations [options]\n\n` +
      `Mode A · audit URL+quote of rules.json:\n` +
      `  --rules <paths>      comma-sep paths to rules.json files\n` +
      `                       默认: data/mongo/rules.json + data/common/kunpeng-rules.json\n` +
      `  --out <path>         output JSON report (默认: data/audit-citations-<TS>.json)\n` +
      `  --concurrency <N>    并发(默认 8)\n` +
      `  --timeout-ms <N>     单 URL 超时(默认 15000)\n` +
      `  --user-agent <s>     UA(默认 perf-kp-sql-audit/0.5)\n` +
      `\nMode B · extractive verify of cleaner v5 output:\n` +
      `  --extractive-input <path>  cleaner v5 产出的 *-extracted.json\n` +
      `  --html-cache <dir>         cleaner v5 的 html-cache 目录\n` +
      `  --out <path>               输出 *-verified.json\n`,
    );
    return;
  }

  // -- Mode B: extractive verify --
  if (values["extractive-input"]) {
    if (!values["html-cache"]) {
      process.stderr.write("--extractive-input 模式需要 --html-cache <dir>\n");
      process.exit(2);
    }
    if (!values.out) {
      process.stderr.write("--extractive-input 模式需要 --out <path>\n");
      process.exit(2);
    }
    runExtractiveVerify(
      resolve(values["extractive-input"]),
      resolve(values["html-cache"]),
      resolve(values.out),
    );
    return;
  }

  const __dirname_audit = dirname(fileURLToPath(import.meta.url));
  const skillRoot = resolve(__dirname_audit, "..");

  const rulesPaths = values.rules
    ? values.rules.split(",").map((s) => s.trim()).filter(Boolean)
    : [
        join(skillRoot, "data/mongo/rules.json"),
        join(skillRoot, "data/common/kunpeng-rules.json"),
      ].filter((p) => existsSync(p));

  const outPath = values.out ||
    join(skillRoot, "data", `audit-citations-${nowTs()}.json`);

  const concurrency = Math.max(1, parseInt(values.concurrency || "8", 10));
  const timeoutMs = Math.max(1000, parseInt(values["timeout-ms"] || "15000", 10));
  const userAgent = values["user-agent"] || "perf-kp-sql-audit/0.5";

  // -- Load rules --
  console.log(`[audit] loading rules from:`);
  const allRules: Array<Rule & { _source_file: string }> = [];
  for (const p of rulesPaths) {
    const { source_file, rules } = loadRules(p);
    console.log(`  ${source_file} → ${rules.length} rules`);
    for (const r of rules) {
      allRules.push({ ...r, _source_file: source_file });
    }
  }

  const rulesWithUrl = allRules.filter((r) => !!r.source?.url);
  const rulesWithQuote = rulesWithUrl.filter((r) => !!r.source?.quote);
  const distinctUrls = [...new Set(rulesWithUrl.map((r) => r.source!.url!))];

  console.log(`[audit] total rules: ${allRules.length}`);
  console.log(`[audit]   with url: ${rulesWithUrl.length}`);
  console.log(`[audit]   with quote: ${rulesWithQuote.length}`);
  console.log(`[audit]   distinct urls: ${distinctUrls.length}`);
  console.log(`[audit] concurrency=${concurrency} timeout=${timeoutMs}ms`);

  // -- Step 1+2: per-URL fetch (HEAD first, then GET if quote-bearing rule cites it) --
  const urlsThatNeedBody = new Set<string>();
  for (const r of rulesWithQuote) {
    urlsThatNeedBody.add(r.source!.url!);
  }

  const urlMetaMap = new Map<string, UrlMeta>();

  console.log(`[audit] step 1+2 · fetching ${distinctUrls.length} urls...`);
  let completed = 0;

  await pmap(distinctUrls, concurrency, async (url) => {
    const needBody = urlsThatNeedBody.has(url);
    const method = needBody ? "GET" : "HEAD";
    const r = await fetchWithFollow(url, { method, timeoutMs, userAgent });

    let status: UrlStatus;
    if (r.error) status = "network_error";
    else if (r.status >= 200 && r.status < 300) {
      status = r.redirectChain.length > 0 ? "redirect" : "live";
    } else if (r.status >= 300 && r.status < 400) status = "redirect";
    else status = "dead";

    let bodyText: string | undefined;
    let bodyChars = 0;
    if (r.body) {
      bodyText = canonical(stripHtml(r.body));
      bodyChars = bodyText.length;
    }

    urlMetaMap.set(url, {
      url,
      status,
      http_status: r.status,
      url_final: r.finalUrl !== url ? r.finalUrl : undefined,
      redirect_chain: r.redirectChain.length > 0 ? r.redirectChain : undefined,
      body_text: bodyText,
      body_chars: bodyChars,
      fetch_error: r.error,
    });

    completed++;
    if (completed % 20 === 0 || completed === distinctUrls.length) {
      console.log(`[audit]   progress ${completed}/${distinctUrls.length}`);
    }
  });

  // -- Build per-rule audit entries --
  const perRule: RuleAuditEntry[] = [];

  for (const rule of allRules) {
    const id = rule.id ?? rule.rule_id ?? "<no-id>";
    const url = rule.source?.url;
    const quote = rule.source?.quote;
    const sf = rule._source_file;

    if (!url) {
      perRule.push({
        rule_id: id,
        source_file: sf,
        url: "",
        url_status: "skipped",
        quote_match: "no_quote",
        notes: "no source.url",
      });
      continue;
    }

    const meta = urlMetaMap.get(url);
    if (!meta) {
      perRule.push({
        rule_id: id,
        source_file: sf,
        url,
        url_status: "skipped",
        quote_match: "skipped",
        notes: "url meta missing (bug)",
      });
      continue;
    }

    let quoteMatch: QuoteMatch;
    let quoteExcerpt: string | undefined;
    let firstWordsStr: string | undefined;

    if (!quote) {
      quoteMatch = "no_quote";
    } else if (meta.status === "dead" || meta.status === "network_error") {
      quoteMatch = "url_dead";
      firstWordsStr = firstWords(quote);
    } else if (!meta.body_text) {
      quoteMatch = "skipped";
      firstWordsStr = firstWords(quote);
    } else {
      const needle = canonical(quote);
      // 砍 quote 头尾(常带 OpenAI 加的 "..." 之类)
      const trimmed = needle.replace(/^[\s'"\.…\-]+|[\s'"\.…\-]+$/g, "");
      const found = trimmed.length > 20 && meta.body_text.includes(trimmed);
      if (found) {
        quoteMatch = "literal";
        quoteExcerpt = quote.slice(0, 120);
      } else {
        // 退一步:尝试前 60% 的字符
        const partial = trimmed.slice(0, Math.floor(trimmed.length * 0.6));
        const partialFound = partial.length > 30 && meta.body_text.includes(partial);
        quoteMatch = partialFound ? "literal" : "miss";
        if (!partialFound) {
          firstWordsStr = firstWords(quote);
        } else {
          quoteExcerpt = quote.slice(0, 120) + " (partial 60% match)";
        }
      }
    }

    perRule.push({
      rule_id: id,
      source_file: sf,
      url,
      url_status: meta.status,
      url_final: meta.url_final,
      http_status: meta.http_status,
      redirect_chain: meta.redirect_chain,
      quote_match: quoteMatch,
      quote_excerpt: quoteExcerpt,
      quote_first_words: firstWordsStr,
      audit_error: meta.fetch_error,
    });
  }

  // -- Aggregate --
  const summary = {
    rules_total: allRules.length,
    rules_with_url: rulesWithUrl.length,
    rules_with_quote: rulesWithQuote.length,
    urls_distinct: distinctUrls.length,
    url_live: 0,
    url_redirect: 0,
    url_dead: 0,
    url_network_error: 0,
    quote_literal_match: 0,
    quote_miss: 0,
    quote_no_quote: 0,
    quote_url_dead: 0,
  };
  for (const m of urlMetaMap.values()) {
    if (m.status === "live") summary.url_live++;
    else if (m.status === "redirect") summary.url_redirect++;
    else if (m.status === "dead") summary.url_dead++;
    else if (m.status === "network_error") summary.url_network_error++;
  }
  for (const r of perRule) {
    if (r.quote_match === "literal") summary.quote_literal_match++;
    else if (r.quote_match === "miss") summary.quote_miss++;
    else if (r.quote_match === "no_quote") summary.quote_no_quote++;
    else if (r.quote_match === "url_dead") summary.quote_url_dead++;
  }

  // -- Output (strip body_text from per_url to keep size sane) --
  const perUrl: Record<string, Omit<UrlMeta, "body_text">> = {};
  for (const [u, m] of urlMetaMap.entries()) {
    const { body_text: _bt, ...rest } = m;
    perUrl[u] = rest;
  }

  const report: AuditReport = {
    audited_at: isoDate(),
    source_files: rulesPaths,
    summary,
    per_url: perUrl,
    per_rule: perRule,
  };

  const outDir = dirname(outPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  // -- Print summary --
  console.log();
  console.log(`[audit] ===== SUMMARY =====`);
  console.log(`[audit] rules total          : ${summary.rules_total}`);
  console.log(`[audit] rules with url       : ${summary.rules_with_url}`);
  console.log(`[audit] rules with quote     : ${summary.rules_with_quote}`);
  console.log(`[audit] urls distinct        : ${summary.urls_distinct}`);
  console.log(`[audit]   live               : ${summary.url_live}`);
  console.log(`[audit]   redirect           : ${summary.url_redirect}`);
  console.log(`[audit]   dead (4xx/5xx)     : ${summary.url_dead}`);
  console.log(`[audit]   network error      : ${summary.url_network_error}`);
  console.log(`[audit] quote literal match  : ${summary.quote_literal_match}`);
  console.log(`[audit] quote miss           : ${summary.quote_miss}`);
  console.log(`[audit] quote no_quote       : ${summary.quote_no_quote}`);
  console.log(`[audit] quote url_dead       : ${summary.quote_url_dead}`);
  console.log();
  console.log(`[audit] report → ${outPath}`);
}

main().catch((e) => {
  console.error(`[audit] fatal: ${e?.message ?? e}`);
  process.exit(1);
});
