#!/usr/bin/env node
/**
 * cleaner v5 · extractive only · 守红线
 *
 * 与 v3/v4 的根本区别:
 *   v3: 把 raw rule 结构化成 _v2.checks(LLM 蒸馏 = 改写)
 *   v5: 从 source.url 拿 HTML · 让 LLM 字面截取 8 类 fact 子串(extractive)
 *       · 每条 fact 都是 HTML 的 substring
 *       · LLM 不许添词/翻译/通顺化
 *       · 抽不出某类 fact 就返 null · 严禁编
 *
 * 输入: rules[] · 每条至少要有 source.url + source.quote
 * 输出: extracted[] · 每条 { rule_id, source.url, facts: { type, quote, note }[] }
 *
 * 字面验交给 verify-extractive.ts (Task #3)
 *
 * 用法:
 *   npx tsx tools/clean-rules-v5.ts \
 *     --input  reports/cleanup/round3/sample-input.json \
 *     --output reports/cleanup/round3/sample-extracted.json \
 *     --html-cache reports/cleanup/round3/html-cache \
 *     [--concurrency 4] [--model gpt-4o]
 */

import OpenAI from "openai";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";

if (!process.env.OPENAI_API_KEY) {
  try {
    const env = readFileSync(".env.local", "utf8");
    const m = env.match(/OPENAI_API_KEY=(.+)/);
    if (m) process.env.OPENAI_API_KEY = m[1].trim();
  } catch {}
}

const FACT_TYPES = [
  "summary",      // 一句话概括为什么这条规则重要
  "mechanism",    // 根因机制(I/O / 锁 / 缓存等)
  "threshold",    // 阈值或边界(原文里给的具体数)
  "trade_off",    // 修 vs 不修代价(原文给的对比)
  "when_deviate", // 例外/边界条件(原文里说的"除非...")
  "remediation",  // 修复动作(命令/参数/配置)
  "citation",     // 标准引用句 · 通常等于 source.quote 或更短
] as const;
type FactType = typeof FACT_TYPES[number];

interface InRule {
  rule_id?: string;
  id?: string;
  source?: { url?: string; quote?: string; title?: string; tier?: string };
  // 其它字段忽略
}

interface ExtractedFact {
  type: FactType;
  quote: string | null;       // null = 抽不出 · 严禁编
  note?: string;              // LLM 简短解释(为什么选这段) · 不入库 · 仅给 reviewer 看
}

interface ExtractedRule {
  rule_id: string;
  source_url: string;
  source_quote_seed: string | null;
  html_chars: number;
  facts: ExtractedFact[];
  llm_error?: string;
}

// ---------- HTML helpers (复用 audit-citations.ts 的 normalize 思路) ----------

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
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

function normalizeForLLM(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

async function fetchHtml(url: string, timeoutMs = 20000): Promise<string> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      redirect: "follow",
      signal: ac.signal,
      headers: {
        "User-Agent": "perf-kp-sql-clean-v5/0.1",
        Accept: "text/html,*/*;q=0.8",
        "Accept-Language": "en;q=0.9",
      },
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`http ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

function urlHash(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 16);
}

async function fetchHtmlCached(url: string, cacheDir: string): Promise<string> {
  const cachePath = join(cacheDir, `${urlHash(url)}.html`);
  if (existsSync(cachePath)) return readFileSync(cachePath, "utf8");
  const html = await fetchHtml(url);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cachePath, html);
  return html;
}

// ---------- LLM extractive prompt ----------

const SYSTEM_PROMPT = `你是技术文档的 extractive 抽取器。任务: 从给定的清洗后正文里, 为一条 MongoDB/性能调优规则抽 8 类 fact 子串。

【绝对红线】
1. 输出的每个 quote 字段值, **必须**是输入正文 (text_corpus) 的连续子字符串。
2. 不许改写 / 添词 / 翻译 / 通顺化 / 合并跨段落。
3. 抽不出某类 fact, quote 必须设 null。**严禁**编。
4. quote 长度建议 30-280 字符 (1-3 句话)。过短信号弱, 过长重点散。

【fact_type 语义】
- summary:      一句话说明 "为什么这条规则重要 / 不遵守会怎样"
- mechanism:    根因机制 (I/O 路径 / 锁竞争 / 缓存命中 / 调度等)
- threshold:    具体阈值或边界数字 (原文里给的)
- trade_off:    修 vs 不修代价 / 副作用 (原文给的对比)
- when_deviate: 例外或边界条件 (原文里 "除非 / 仅当 / 不适用于" 之类)
- remediation:  修复动作 (命令 / 参数 / 配置项原文)
- citation:     最具代表性的一句官方原话 (通常 = source.quote 或更短)

【输入】
- rule_id:        规则 ID (仅供你定位 · 不参与抽取)
- seed_quote:     原 rules.json 已存的 source.quote (你可以以它为锚点找上下文)
- text_corpus:    清洗后的网页正文 (已去 HTML 标签)

【输出】严格 JSON · 不带 markdown 代码块
{
  "facts": [
    { "type": "summary",      "quote": "...或 null", "note": "短中文解释 · 一句话" },
    { "type": "mechanism",    "quote": "...或 null", "note": "..." },
    { "type": "threshold",    "quote": "...或 null", "note": "..." },
    { "type": "trade_off",    "quote": "...或 null", "note": "..." },
    { "type": "when_deviate", "quote": "...或 null", "note": "..." },
    { "type": "remediation",  "quote": "...或 null", "note": "..." },
    { "type": "citation",     "quote": "...或 null", "note": "..." }
  ]
}

【自检】写完每个 quote 后, 在脑里 Ctrl+F 在 text_corpus 里搜一次。搜不到说明你改了, 改回来。
`;

async function extractOne(
  client: OpenAI,
  rule: InRule,
  textCorpus: string,
  model: string,
): Promise<ExtractedFact[]> {
  // text_corpus 太长会超 token · 截断到 ~16k chars (~4k tokens)
  // 因 seed_quote 已锚定 · 取 seed 上下文 ±8000 chars 足够
  let corpus = textCorpus;
  const seed = rule.source?.quote;
  const MAX = 16000;
  if (corpus.length > MAX && seed) {
    const idx = corpus.indexOf(seed);
    if (idx >= 0) {
      const half = MAX / 2;
      const start = Math.max(0, idx - half);
      const end = Math.min(corpus.length, idx + seed.length + half);
      corpus = corpus.slice(start, end);
    } else {
      corpus = corpus.slice(0, MAX);
    }
  } else if (corpus.length > MAX) {
    corpus = corpus.slice(0, MAX);
  }

  const userMsg = JSON.stringify({
    rule_id: rule.rule_id ?? rule.id ?? "?",
    seed_quote: rule.source?.quote ?? null,
    text_corpus: corpus,
  });

  const resp = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ],
  });
  const json = JSON.parse(resp.choices[0]!.message.content!);
  const facts = (json.facts ?? []) as ExtractedFact[];
  // 强制补齐 7 类(LLM 漏报某类时填 null · 后续验证统一)
  const out: ExtractedFact[] = [];
  for (const t of FACT_TYPES) {
    const found = facts.find((f) => f.type === t);
    out.push(found ?? { type: t, quote: null, note: "(LLM 漏报)" });
  }
  return out;
}

// ---------- 并发限制 ----------
async function pmap<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0, done = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        out[i] = await fn(items[i]!, i);
      } catch (e: any) {
        out[i] = { error: e?.message ?? String(e) } as any;
      }
      done++;
      process.stdout.write(`[clean-v5] ${done}/${items.length}\r`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

// ---------- main ----------

async function main() {
  const { values } = parseArgs({
    options: {
      input:       { type: "string" },
      output:      { type: "string" },
      "html-cache":{ type: "string", default: "reports/cleanup/round3/html-cache" },
      concurrency: { type: "string", default: "4" },
      model:       { type: "string", default: "gpt-4o" },
      help:        { type: "boolean", short: "h" },
    },
  });
  if (values.help || !values.input || !values.output) {
    console.log("usage: clean-rules-v5 --input <rules.json> --output <extracted.json> [--html-cache dir] [--concurrency 4] [--model gpt-4o]");
    process.exit(values.help ? 0 : 2);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not set (.env.local 也没找到)");
    process.exit(2);
  }

  const rules = JSON.parse(readFileSync(values.input!, "utf8")) as InRule[];
  const cacheDir = resolve(values["html-cache"]!);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log(`[clean-v5] processing ${rules.length} rules · model=${values.model} · cache=${cacheDir}`);

  const results = await pmap(rules, parseInt(values.concurrency!, 10), async (rule, i) => {
    const url = rule.source?.url;
    const ruleId = rule.rule_id ?? rule.id ?? `rule-${i}`;
    if (!url) {
      return {
        rule_id: ruleId,
        source_url: "",
        source_quote_seed: rule.source?.quote ?? null,
        html_chars: 0,
        facts: FACT_TYPES.map((t) => ({ type: t, quote: null, note: "(no source.url)" })),
      } as ExtractedRule;
    }
    let textCorpus = "";
    try {
      const html = await fetchHtmlCached(url, cacheDir);
      textCorpus = normalizeForLLM(stripHtml(html));
    } catch (e: any) {
      return {
        rule_id: ruleId,
        source_url: url,
        source_quote_seed: rule.source?.quote ?? null,
        html_chars: 0,
        facts: FACT_TYPES.map((t) => ({ type: t, quote: null, note: "(fetch failed)" })),
        llm_error: `fetch: ${e?.message ?? String(e)}`,
      } as ExtractedRule;
    }
    try {
      const facts = await extractOne(client, rule, textCorpus, values.model!);
      return {
        rule_id: ruleId,
        source_url: url,
        source_quote_seed: rule.source?.quote ?? null,
        html_chars: textCorpus.length,
        facts,
      } as ExtractedRule;
    } catch (e: any) {
      return {
        rule_id: ruleId,
        source_url: url,
        source_quote_seed: rule.source?.quote ?? null,
        html_chars: textCorpus.length,
        facts: FACT_TYPES.map((t) => ({ type: t, quote: null, note: "(llm failed)" })),
        llm_error: `llm: ${e?.message ?? String(e)}`,
      } as ExtractedRule;
    }
  });

  console.log();
  writeFileSync(values.output!, JSON.stringify(results, null, 2));

  // 速览统计 (注意: 此时仅是 LLM 自报 · 字面验在下一步)
  const total = results.length;
  const errs = results.filter((r) => r.llm_error).length;
  const factCount = results.reduce((acc, r) => acc + r.facts.filter((f) => f.quote).length, 0);
  console.log(`[clean-v5] written: ${values.output}`);
  console.log(`[clean-v5] total rules: ${total} · errors: ${errs}`);
  console.log(`[clean-v5] LLM 自报 fact 数(未字面验): ${factCount} / 期望最多 ${total * FACT_TYPES.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
