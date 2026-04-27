#!/usr/bin/env node
/**
 * kb-validate — KB / 报告质量校验工具集合(3 工具合并到一个文件)
 *
 * 合并自:
 *   - audit-grounding.ts          → grounding (反向审计 LLM 报告每条 claim 是否锚在 KB)
 *   - simulate-user-queries.ts    → simulate (拟人验证 · 20+ DBA 追问看 KB 能否回答)
 *   - validate-rules.mjs          → schema (CI 校验 cli-diagnose 输出 results[] 的 schema)
 *
 * 用法:
 *   node kb-validate.ts --op <subcommand> [options]
 *
 * Subcommands:
 *   --op grounding  · 审计 LLM 报告 .md 每条 claim 是否锚在 KB
 *                     必填: --report <path.md>
 *                     可选: --db / --corpus / --rrf-threshold / --partial-threshold
 *                          / --strong-threshold / --min-len / --top-k / --out / --fail-under
 *
 *   --op simulate   · 拟人 DBA 追问 · 看 KB 是否能稳定回答
 *                     可选: --db / --threshold / --out / --verbose
 *
 *   --op schema     · cli-diagnose JSON results[] schema CI 校验
 *                     必填:--file <path.json> 或 stdin
 *                     退出码:0 通过 / 1 有违规
 *
 * 各 section 互不依赖 · 顶部 import / helpers 已合并 · 维护时保持 section 边界清晰。
 */

// ============================================================================
// SHARED IMPORTS
// ============================================================================

import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { parseArgs } from "node:util";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { queryKb, embed } from "../src/cli-kb.js";

// ============================================================================
// SHARED HELPERS · skill 目录定位
// ============================================================================

const __dirname_kb_validate = dirname(fileURLToPath(import.meta.url));
function skillDir(): string {
  return join(__dirname_kb_validate, "..");
}

// ============================================================================
// ============================================================================
// SECTION 1: grounding (反向审计)
// ============================================================================
// 合并自 tools/audit-grounding.ts (405 行)
// ============================================================================
// ============================================================================

export interface Claim {
  text: string;
  section: string;
  line: number;
  kind: "why" | "action" | "summary" | "bullet" | "body";
}

const CLAIM_PREFIXES: { re: RegExp; kind: Claim["kind"] }[] = [
  { re: /^\s*[-*]?\s*Why[::]\s*/, kind: "why" },
  { re: /^\s*[-*]?\s*机制[::]\s*/, kind: "why" },
  { re: /^\s*[-*]?\s*代价[::]\s*/, kind: "why" },
  { re: /^\s*[-*]?\s*例外[::]\s*/, kind: "why" },
];

const CLAIM_BLOCKLIST = [
  /p\d+\s*(延迟|latency|响应|时延)\s*[+\-]\s*\d+%/i,
  /置信度\s*[高中低]/,
  /规则适配\s*(全|所有)/,
  /^(sysctl|echo|cat|systemctl|sudo)\s/,
  /^\s*\d+\s*(MB|GB|ms|s|条|个|次|%)\s*$/,
];

export function extractClaims(md: string, minLen: number): Claim[] {
  const lines = md.split("\n");
  const out: Claim[] = [];
  let curSection = "root";
  let inTopIssues = false;
  let inFull = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    const h = raw.match(/^#{1,6}\s+(.+?)\s*$/);
    if (h) {
      curSection = h[1].slice(0, 80);
      const low = curSection.toLowerCase();
      inTopIssues = low.includes("top issues") || /^\d+\.\s/.test(low) || /[\[\(][a-z]+[\]\)]/.test(low);
      inFull = low.includes("full findings") || low.includes("参考资料汇总") || low.includes("artifacts") || low.includes("changelog") || low.includes("验证命令");
      continue;
    }

    if (/^\d+\.\s+\*\*\[/.test(line)) inTopIssues = true;

    if (inFull) continue;
    if (!inTopIssues) continue;

    for (const { re, kind } of CLAIM_PREFIXES) {
      const m = line.match(re);
      if (!m) continue;
      let cleaned = line.slice(m[0].length)
        .replace(/^`([^`]+)`$/, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .trim();
      if (cleaned.length < minLen) break;
      if (CLAIM_BLOCKLIST.some(r => r.test(cleaned))) break;
      out.push({ text: cleaned, section: curSection, line: i + 1, kind });
      break;
    }
  }
  return out;
}

interface CorpusMatch { file: string; line: number; snippet: string }

function scanCorpus(corpusDir: string, keywords: string[]): Map<string, CorpusMatch[]> {
  const files: string[] = [];
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (f.endsWith(".md") || f.endsWith(".txt")) files.push(p);
    }
  };
  walk(corpusDir);

  const out = new Map<string, CorpusMatch[]>();
  for (const f of files) {
    const content = readFileSync(f, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const lo = lines[i].toLowerCase();
      const hits = keywords.filter(k => lo.includes(k.toLowerCase()));
      if (hits.length >= Math.min(2, keywords.length)) {
        const key = hits.sort().join("|");
        const list = out.get(key) ?? [];
        list.push({ file: relative(corpusDir, f), line: i + 1, snippet: lines[i].slice(0, 150) });
        out.set(key, list);
      }
    }
  }
  return out;
}

export function keywordsFromClaim(text: string): string[] {
  const stop = new Set([
    "的","了","是","在","和","及","或","等","会","到","将","就","也","都","可以","需要","一个","这种","这些","那些","因为","所以","如果","那么",
    "the","and","or","of","to","in","is","a","an","for","on","with","by","as","at","this","that","these","those","be","are","was","were",
  ]);
  const latin = (text.match(/[A-Za-z][A-Za-z0-9_\-\.]{2,}/g) ?? []).map(s => s.toLowerCase());
  const cjkSeg = text.match(/[\u4e00-\u9fa5]{2,}/g) ?? [];
  return [...new Set([...latin, ...cjkSeg])].filter(k => !stop.has(k)).slice(0, 6);
}

interface AuditEntry {
  claim: Claim;
  rrf_score: number;
  top_rule_id: string | null;
  top_fact_type: string | null;
  top_source_url: string | null;
  verdict: "strong-grounded" | "grounded" | "partial" | "ungrounded";
  gap_type: "none" | "distillation" | "corpus";
  corpus_hint: string | null;
}

interface GroundingOpts {
  reportPath: string;
  dbPath: string;
  corpusDir: string;
  rrfThreshold: number;
  partialThreshold: number;
  strongThreshold: number;
  minLen: number;
  outPath: string | null;
  topK: number;
  failUnder: number | null;
}

function renderGroundingMdReport(src: string, entries: AuditEntry[], stats: any): string {
  const lines: string[] = [];
  lines.push(`# Grounding 审计报告`);
  lines.push(``);
  lines.push(`- 源报告: \`${src}\``);
  lines.push(`- 审计时间: ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`## 总览`);
  lines.push(``);
  lines.push(`| 维度 | 值 |`);
  lines.push(`|---|---|`);
  lines.push(`| 总 claim | ${stats.total} |`);
  lines.push(`| strong-grounded(双索引命中) | ${stats.strongGrounded} (${(stats.strongGrounded / stats.total * 100).toFixed(1)}%) |`);
  lines.push(`| grounded(单索引 rank-1) | ${stats.grounded} (${(stats.grounded / stats.total * 100).toFixed(1)}%) |`);
  lines.push(`| partial(弱相关) | ${stats.partial} (${(stats.partial / stats.total * 100).toFixed(1)}%) |`);
  lines.push(`| ungrounded(无锚) | ${stats.ungrounded} (${(stats.ungrounded / stats.total * 100).toFixed(1)}%) |`);
  lines.push(`| 准确率(grounded+) | **${(stats.accuracy * 100).toFixed(1)}%** |`);
  lines.push(`| 含 partial 准确率 | ${(stats.partialAcc * 100).toFixed(1)}% |`);
  lines.push(`| 蒸馏 gap | ${stats.distilGaps} |`);
  lines.push(`| 语料 gap | ${stats.corpusGaps} |`);
  lines.push(``);

  const bad = entries.filter(e => e.verdict !== "grounded");
  if (bad.length > 0) {
    lines.push(`## Ungrounded / Partial claim 清单`);
    lines.push(``);
    for (const e of bad) {
      lines.push(`### [${e.verdict}] ${e.claim.section} (L${e.claim.line})`);
      lines.push(``);
      lines.push(`- Claim: ${e.claim.text.slice(0, 240)}`);
      lines.push(`- RRF: ${e.rrf_score.toFixed(4)} · top_rule=\`${e.top_rule_id ?? "-"}\``);
      lines.push(`- Gap 类型: **${e.gap_type}**`);
      if (e.corpus_hint) lines.push(`- 语料线索: \`${e.corpus_hint}\``);
      lines.push(``);
    }
  }
  return lines.join("\n");
}

async function runGrounding(opts: GroundingOpts): Promise<number> {
  if (!existsSync(opts.reportPath)) throw new Error(`report not found: ${opts.reportPath}`);
  if (!existsSync(opts.dbPath)) throw new Error(`KB not found: ${opts.dbPath}`);

  const db = new Database(opts.dbPath, { readonly: true });
  sqliteVec.load(db);

  let md = readFileSync(opts.reportPath, "utf8");
  const realNewlines = (md.match(/\n/g) ?? []).length;
  const literalEscapes = (md.match(/\\n/g) ?? []).length;
  if (realNewlines < 5 && literalEscapes > 20) {
    md = md.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\`/g, "`");
    console.log(`(预处理:检测到字面 \\n bug · 已还原 ${literalEscapes} 处为真换行)`);
  }
  const claims = extractClaims(md, opts.minLen);

  console.log(`report: ${opts.reportPath}`);
  console.log(`KB: ${opts.dbPath}`);
  console.log(`claims extracted: ${claims.length}`);
  console.log(`RRF grounded ≥ ${opts.rrfThreshold} · partial ≥ ${opts.partialThreshold}\n`);

  const entries: AuditEntry[] = [];
  for (let i = 0; i < claims.length; i++) {
    const c = claims[i];
    process.stdout.write(`[${i + 1}/${claims.length}] ${c.text.slice(0, 70)}\n`);
    let qVector: number[] | undefined;
    try { qVector = await embed(c.text); } catch { /* ignore */ }
    const results = queryKb(db, { q: c.text, qVector, engine: "mongo", topK: opts.topK });

    const top = results[0];
    const score = top?.rrf_score ?? 0;
    const verdict: AuditEntry["verdict"] =
      score >= opts.strongThreshold ? "strong-grounded" :
      score >= opts.rrfThreshold ? "grounded" :
      score >= opts.partialThreshold ? "partial" :
      "ungrounded";

    let gap_type: AuditEntry["gap_type"] = "none";
    let corpus_hint: string | null = null;
    if (verdict === "partial" || verdict === "ungrounded") {
      const kws = keywordsFromClaim(c.text);
      const hits = scanCorpus(opts.corpusDir, kws);
      if (hits.size > 0) {
        gap_type = "distillation";
        const first = hits.values().next().value as CorpusMatch[] | undefined;
        if (first && first[0]) corpus_hint = `${first[0].file}:${first[0].line}`;
      } else {
        gap_type = "corpus";
      }
    }

    entries.push({
      claim: c,
      rrf_score: score,
      top_rule_id: top?.fact.rule_id ?? null,
      top_fact_type: top?.fact.fact_type ?? null,
      top_source_url: top?.fact.source_url ?? null,
      verdict,
      gap_type,
      corpus_hint,
    });
  }

  const strongGrounded = entries.filter(e => e.verdict === "strong-grounded").length;
  const grounded = entries.filter(e => e.verdict === "grounded").length;
  const partial = entries.filter(e => e.verdict === "partial").length;
  const ungrounded = entries.filter(e => e.verdict === "ungrounded").length;
  const total = entries.length || 1;
  const groundedTotal = strongGrounded + grounded;
  const accuracy = groundedTotal / total;
  const partialAcc = (groundedTotal + partial) / total;

  const distilGaps = entries.filter(e => e.gap_type === "distillation");
  const corpusGaps = entries.filter(e => e.gap_type === "corpus");

  console.log(`\n=== 审计结果 ===`);
  console.log(`总 claim:        ${total}`);
  console.log(`strong-grounded: ${strongGrounded} (${(strongGrounded / total * 100).toFixed(1)}%) · 双索引命中`);
  console.log(`grounded:        ${grounded} (${(grounded / total * 100).toFixed(1)}%) · 单索引 rank-1`);
  console.log(`partial:         ${partial} (${(partial / total * 100).toFixed(1)}%) · 弱相关`);
  console.log(`ungrounded:      ${ungrounded} (${(ungrounded / total * 100).toFixed(1)}%) · 无锚`);
  console.log(`\n准确率(grounded+):       ${(accuracy * 100).toFixed(1)}%`);
  console.log(`含 partial 准确率:        ${(partialAcc * 100).toFixed(1)}%`);
  console.log(`\n=== gap 分类 ===`);
  console.log(`蒸馏 gap(语料里有 · 未蒸出):${distilGaps.length}`);
  console.log(`语料 gap(语料里也没):        ${corpusGaps.length}`);

  if (distilGaps.length > 0) {
    console.log(`\n--- 蒸馏 gap 样例(前 5) ---`);
    for (const e of distilGaps.slice(0, 5)) {
      console.log(`  · ${e.claim.text.slice(0, 80)}`);
      console.log(`    → 去 ${e.corpus_hint} 扒内容补 rule`);
    }
  }
  if (corpusGaps.length > 0) {
    console.log(`\n--- 语料 gap 样例(前 5) ---`);
    for (const e of corpusGaps.slice(0, 5)) {
      console.log(`  · ${e.claim.text.slice(0, 80)}`);
      console.log(`    → 语料库未收录 · 需 WebFetch 新源`);
    }
  }

  const mdReport = renderGroundingMdReport(opts.reportPath, entries, { strongGrounded, grounded, partial, ungrounded, total, accuracy, partialAcc, distilGaps: distilGaps.length, corpusGaps: corpusGaps.length });
  if (opts.outPath) {
    const fs = await import("node:fs");
    fs.writeFileSync(opts.outPath, mdReport);
    console.log(`\n→ ${opts.outPath}`);
  }

  db.close();
  return ungrounded;
}

// ============================================================================
// ============================================================================
// SECTION 2: simulate (拟人 DBA 追问验证)
// ============================================================================
// 合并自 tools/simulate-user-queries.ts (242 行)
// ============================================================================
// ============================================================================

interface TestCase {
  query: string;
  expect: string[];
  tag: string;
}

const TEST_CASES: TestCase[] = [
  // ==================== 内存 (12 条) ====================
  { query: "MongoDB 7.0 为什么要关闭 THP",                    expect: ["thp", "huge-page", "transparent"],  tag: "内存" },
  { query: "THP always madvise never 三种模式区别",           expect: ["thp", "madvise", "huge"],            tag: "内存" },
  { query: "khugepaged 扫描会阻塞 mongod 吗",                 expect: ["thp", "khugepaged", "kernel"],       tag: "内存" },
  { query: "swappiness 设置多少合适",                          expect: ["swap", "swappiness"],                tag: "内存" },
  { query: "纯 DB 主机 vm.swappiness 为啥设 1",               expect: ["swap", "swappiness"],                tag: "内存" },
  { query: "vm.zone_reclaim_mode 怎么配",                     expect: ["zone_reclaim", "numa"],              tag: "内存" },
  { query: "vm.overcommit_memory 该用哪种",                   expect: ["overcommit", "memory"],              tag: "内存" },
  { query: "vm.max_map_count 默认够吗",                       expect: ["max_map_count", "map"],              tag: "内存" },
  { query: "WiredTiger cache 多大合适",                        expect: ["wt-cache", "wiredtiger", "cache"],   tag: "内存" },
  { query: "WT cache 默认公式 256MB 50% RAM",                 expect: ["wt-cache", "wiredtiger", "cache", "default"],  tag: "内存" },
  { query: "WT cache 超过物理内存 50%什么后果",                 expect: ["oversize", "wt-cache", "wiredtiger"], tag: "内存" },
  { query: "容器里跑 mongod WT cache 要不要设",                expect: ["container", "wt-cache", "cache"],    tag: "内存" },

  // ==================== I/O (12 条) ====================
  { query: "dirty_ratio 调低有什么用",                         expect: ["dirty", "dirty_ratio"],              tag: "I/O" },
  { query: "dirty_background_ratio 和 dirty_ratio 区别",       expect: ["dirty", "background"],               tag: "I/O" },
  { query: "Linux I/O scheduler 选 mq-deadline 还是 none",    expect: ["scheduler", "iosched"],              tag: "I/O" },
  { query: "磁盘 await 多少算高延迟",                          expect: ["await", "disk"],                     tag: "I/O" },
  { query: "磁盘使用率超 85% 什么风险",                        expect: ["disk", "usage"],                     tag: "I/O" },
  { query: "MongoDB journal 必须开吗",                         expect: ["journal", "durability"],             tag: "I/O" },
  { query: "journal commit interval 默认 100ms 影响",          expect: ["journal", "commit"],                 tag: "I/O" },
  { query: "WiredTiger checkpoint 间隔调优",                   expect: ["checkpoint", "wiredtiger"],          tag: "I/O" },
  { query: "blockCompressor snappy zstd zlib 选哪个",         expect: ["compressor", "compression", "snappy", "zstd"], tag: "I/O" },
  { query: "WiredTiger eviction 阈值调优",                     expect: ["eviction", "wiredtiger", "cache"],   tag: "I/O" },
  { query: "索引构建时磁盘 spill 到 _tmp",                     expect: ["index-build", "spill", "tmp"],       tag: "I/O" },
  { query: "readahead 设置多大合适 NVMe",                      expect: ["readahead"],                         tag: "I/O" },

  // ==================== CPU / ARM64 / 鲲鹏 (12 条) ====================
  { query: "ARM64 LSE atomics 对 MongoDB 性能影响",            expect: ["lse", "arm64", "atomic"],            tag: "CPU" },
  { query: "怎么检查 CPU 是否支持 LSE",                        expect: ["lse", "cpu_flag", "atomic"],         tag: "CPU" },
  { query: "mongod 二进制有没有 LSE opcode",                   expect: ["lse", "binary", "opcode"],           tag: "CPU" },
  { query: "鲲鹏 CPU governor 怎么设",                         expect: ["governor", "cpu"],                   tag: "CPU" },
  { query: "NUMA interleave 有必要吗",                         expect: ["numa", "interleave", "balancing"],   tag: "CPU" },
  { query: "Kunpeng 920 SMT 超线程该关吗",                     expect: ["smt", "hyperthread"],                tag: "CPU" },
  { query: "TCMalloc per-CPU 缓存怎么启用",                    expect: ["tcmalloc", "percpu"],                tag: "CPU" },
  { query: "glibc rseq 要禁掉吗",                              expect: ["glibc", "rseq", "tcmalloc"],         tag: "CPU" },
  { query: "Kunpeng irqbalance 要关掉吗",                      expect: ["irqbalance", "irq"],                 tag: "CPU" },
  { query: "BIOS SMMU 要不要禁",                               expect: ["smmu", "bios"],                      tag: "CPU" },
  { query: "BIOS CPU prefetch 开启",                           expect: ["prefetch", "bios"],                  tag: "CPU" },
  { query: "openEuler nohz cmdline 怎么配",                    expect: ["nohz", "cmdline", "openeuler"],      tag: "CPU" },

  // ==================== 并发 / 复制 / 分片 (10 条) ====================
  { query: "MongoDB 连接池大小设多少",                         expect: ["connection", "pool"],                tag: "并发" },
  { query: "storageEngineConcurrentReadTransactions 调多少",   expect: ["concurrent", "transaction", "ticket"], tag: "并发" },
  { query: "ticket queue 打满怎么排查",                        expect: ["ticket", "queue", "overload"],       tag: "并发" },
  { query: "replica set 最少几个投票成员",                      expect: ["replica", "voting", "arbiter"],      tag: "并发" },
  { query: "write concern majority 和 1 的延迟差",              expect: ["write-concern", "concern"],          tag: "并发" },
  { query: "oplog 窗口多长合适",                               expect: ["oplog"],                             tag: "并发" },
  { query: "sharding key 怎么选才不热点",                       expect: ["shard", "sharding", "key"],          tag: "并发" },
  { query: "chunk size 默认 128MB 够吗",                       expect: ["chunk", "shard"],                    tag: "并发" },
  { query: "索引过多有什么代价",                               expect: ["too-many-indexes", "unnecessary-indexes", "write-cost", "overhead"], tag: "并发" },
  { query: "index build commit quorum 卡住排查",               expect: ["index-build", "commit", "quorum"],   tag: "并发" },

  // ==================== 网络 (8 条) ====================
  { query: "TCP keepalive time 推荐值",                        expect: ["keepalive", "tcp"],                  tag: "网络" },
  { query: "somaxconn 多大合适",                               expect: ["somaxconn", "backlog"],              tag: "网络" },
  { query: "tcp_max_syn_backlog 默认够吗",                     expect: ["syn_backlog", "backlog"],            tag: "网络" },
  { query: "tcp_retrans 超 1% 说明什么",                       expect: ["retrans", "retransmit"],             tag: "网络" },
  { query: "鲲鹏 NIC hi1822 Ring Buffer 调优",                 expect: ["ring", "nic", "hi1822"],             tag: "网络" },
  { query: "mongod bindIp 配 0.0.0.0 安全吗",                  expect: ["bind", "hostname"],                  tag: "网络" },
  { query: "Unix domain socket 比 TCP loopback 快吗",          expect: ["unix", "domainsocket"],              tag: "网络" },
  { query: "TLS mode requireTLS 开销",                         expect: ["tls"],                               tag: "网络" },
];

interface SimResult {
  query: string;
  tag: string;
  top_rule_id: string | null;
  top_rrf: number;
  top_fact_type: string | null;
  top_content_snippet: string | null;
  top3_rule_ids: string[];
  expect: string[];
  pass_rrf: boolean;
  pass_relevant_top1: boolean;
  pass_relevant_top3: boolean;
  pass: boolean;
  pass_loose: boolean;
}

function hayMatches(hay: string, expect: string[]): boolean {
  const low = hay.toLowerCase();
  return expect.some(kw => low.includes(kw.toLowerCase()));
}

async function runSimCase(db: Database.Database, tc: TestCase, threshold: number): Promise<SimResult> {
  let qVector: number[] | undefined;
  try { qVector = await embed(tc.query); } catch { /* ignore */ }
  const results = queryKb(db, { q: tc.query, qVector, engine: "mongo", topK: 3 });
  const top = results[0];
  const rrf = top?.rrf_score ?? 0;
  const topHay = `${top?.fact.rule_id ?? ""} ${top?.fact.content_zh ?? ""}`;
  const top3Hay = results.map(r => `${r.fact.rule_id} ${r.fact.content_zh ?? ""}`).join(" || ");
  const r: SimResult = {
    query: tc.query,
    tag: tc.tag,
    top_rule_id: top?.fact.rule_id ?? null,
    top_rrf: rrf,
    top_fact_type: top?.fact.fact_type ?? null,
    top_content_snippet: top?.fact.content_zh?.slice(0, 120) ?? null,
    top3_rule_ids: results.map(r => r.fact.rule_id),
    expect: tc.expect,
    pass_rrf: rrf >= threshold,
    pass_relevant_top1: hayMatches(topHay, tc.expect),
    pass_relevant_top3: hayMatches(top3Hay, tc.expect),
    pass: false,
    pass_loose: false,
  };
  r.pass = r.pass_rrf && r.pass_relevant_top1;
  r.pass_loose = r.pass_rrf && r.pass_relevant_top3;
  return r;
}

interface SimulateOpts {
  dbPath: string;
  threshold: number;
  outPath: string | null;
  verbose: boolean;
}

async function runSimulate(opts: SimulateOpts): Promise<number> {
  const db = new Database(opts.dbPath, { readonly: true });
  sqliteVec.load(db);

  console.log(`\n=== 拟人追问验证 · ${TEST_CASES.length} 条 · RRF 门 ${opts.threshold} ===\n`);

  const results: SimResult[] = [];
  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    const r = await runSimCase(db, tc, opts.threshold);
    results.push(r);
    const mark = r.pass ? "✓" : r.pass_rrf ? "△" : "✗";
    process.stdout.write(`  ${mark} [${r.tag}] ${tc.query.slice(0, 50).padEnd(52)} → ${(r.top_rule_id ?? "-").slice(0, 45).padEnd(47)} RRF=${r.top_rrf.toFixed(4)}\n`);
    if (opts.verbose && !r.pass) {
      process.stdout.write(`    expected: ${tc.expect.join(" | ")}\n`);
      process.stdout.write(`    snippet:  ${r.top_content_snippet ?? "-"}\n`);
    }
  }

  const pass = results.filter(r => r.pass).length;
  const passLoose = results.filter(r => r.pass_loose).length;
  const partial = results.filter(r => r.pass_rrf && !r.pass_relevant_top1).length;
  const fail = results.filter(r => !r.pass_rrf).length;
  const total = results.length;

  console.log(`\n=== 结果 ===`);
  console.log(`✓ PASS (top-1 切题):       ${pass}/${total}  (${(pass / total * 100).toFixed(1)}%)`);
  console.log(`✓ PASS-loose (top-3 切题): ${passLoose}/${total} (${(passLoose / total * 100).toFixed(1)}%) · 业界 RAG 常用指标`);
  console.log(`△ top-1 不切题 · top-3 有:   ${passLoose - pass}`);
  console.log(`✗ FAIL (KB 无相关):           ${fail}`);

  console.log(`\n按标签分布:`);
  const byTag: Record<string, { pass: number; total: number }> = {};
  for (const r of results) {
    byTag[r.tag] = byTag[r.tag] ?? { pass: 0, total: 0 };
    byTag[r.tag].total++;
    if (r.pass) byTag[r.tag].pass++;
  }
  for (const [tag, { pass, total }] of Object.entries(byTag)) {
    console.log(`  ${tag.padEnd(8)} ${pass}/${total}`);
  }

  if (fail > 0 || partial > 0) {
    console.log(`\n未 PASS 详情:`);
    for (const r of results.filter(r => !r.pass)) {
      const loose = r.pass_loose ? "(top-3 有)" : "(top-3 也没)";
      console.log(`  [${r.tag}] ${r.query}  ${loose}`);
      console.log(`    top-3: ${r.top3_rule_ids.join(" → ")}`);
      console.log(`    expect: ${r.expect.join(" | ")}`);
    }
  }

  if (opts.outPath) {
    const fs = await import("node:fs");
    fs.writeFileSync(opts.outPath, JSON.stringify({
      summary: { pass, partial, fail, total, rate: pass / total, by_tag: byTag },
      results,
    }, null, 2));
    console.log(`\n→ ${opts.outPath}`);
  }

  db.close();
  return pass === total ? 0 : 1;
}

// ============================================================================
// ============================================================================
// SECTION 3: schema (CI 校验 cli-diagnose JSON results[])
// ============================================================================
// 合并自 tools/validate-rules.mjs (173 行) · 由 .mjs 转 .ts
// ============================================================================
// ============================================================================

const NORTH_STAR_METRICS = new Set([
  "latency_p95_ms",
  "throughput_qps",
  "cache_miss_rate",
  "db_time_pct",
  "wasted_bytes",
  "connection_util_pct",
]);

const KUNPENG_RULE_ID_PREFIX = "kunpeng.";

interface SchemaViolation { rule_id: string; rule: string }

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  return Buffer.concat(chunks).toString("utf8").trim();
}

function fmtSchemaViolation(violation: SchemaViolation): string {
  return `  · [${violation.rule_id}] ${violation.rule}`;
}

interface SchemaOpts {
  filePath: string | null;
}

async function runSchema(opts: SchemaOpts): Promise<number> {
  let raw: string;
  if (opts.filePath) raw = await readFile(opts.filePath, "utf8");
  else raw = await readStdin();
  if (!raw) {
    console.error("validate schema: no input (pass --file or stdin JSON)");
    return 2;
  }
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch (e) {
    console.error("validate schema: invalid JSON:", (e as Error).message);
    return 2;
  }
  const results = Array.isArray(parsed.results) ? parsed.results : Array.isArray(parsed) ? parsed : [];
  if (results.length === 0) {
    console.error("validate schema: no results[] array found in JSON");
    return 2;
  }

  const violations: SchemaViolation[] = [];

  for (const r of results) {
    const ruleId = r.id || "(no id)";
    // Rule 1: warning/critical ⇒ citations ≥ 1 && evidence ≥ 1
    if (r.severity === "warning" || r.severity === "critical") {
      if (!Array.isArray(r.citations) || r.citations.length === 0) {
        violations.push({ rule_id: ruleId, rule: `severity=${r.severity} requires ≥ 1 citation (got 0)` });
      }
      if (!Array.isArray(r.evidence) || r.evidence.length === 0) {
        violations.push({ rule_id: ruleId, rule: `severity=${r.severity} requires ≥ 1 evidence (got 0)` });
      }
      if (Array.isArray(r.citations)) {
        for (const c of r.citations) {
          if (!c.url || typeof c.url !== "string") {
            violations.push({ rule_id: ruleId, rule: `citation missing url: ${JSON.stringify(c)}` });
          }
        }
      }
    }

    // Rule 2: Kunpeng-specific rule id ⇒ scope.arch=arm64 && scope.vendor=kunpeng
    if (ruleId.startsWith(KUNPENG_RULE_ID_PREFIX)) {
      const sc = r.scope || {};
      if (r.severity === "warning" || r.severity === "critical") {
        if (sc.arch !== "arm64") {
          violations.push({ rule_id: ruleId, rule: `kunpeng rule fired but scope.arch=${sc.arch} ≠ arm64` });
        }
        if (sc.vendor !== "kunpeng") {
          violations.push({ rule_id: ruleId, rule: `kunpeng rule fired but scope.vendor=${sc.vendor} ≠ kunpeng` });
        }
      }
    }

    // Rule 3: impact.metric ∈ enum
    if (r.impact && r.impact.metric && !NORTH_STAR_METRICS.has(r.impact.metric)) {
      violations.push({ rule_id: ruleId, rule: `impact.metric="${r.impact.metric}" not in north-star enum` });
    }

    // Structural sanity
    for (const req of ["id", "title", "severity", "scope", "summary", "description", "reason", "evidence", "impact", "citations", "recommendations", "bucket"]) {
      if (!(req in r)) {
        violations.push({ rule_id: ruleId, rule: `missing required field "${req}"` });
      }
    }

    if (Array.isArray(r.recommendations)) {
      for (const rec of r.recommendations) {
        if (!rec.type || !["prevent", "mitigate", "detect", "repair", "investigate"].includes(rec.type)) {
          violations.push({ rule_id: ruleId, rule: `recommendation.type="${rec.type}" not in Google SRE postmortem action type enum (5 types · https://sre.google/workbook/postmortem-culture/)` });
        }
      }
    }

    // Rule 4 (v0.3.2): surfaceable_only=true ⇒ severity ≤ warning && recommendations[].type 全是 "detect"
    if (r.surfaceable_only === true) {
      if (r.severity === "critical") {
        violations.push({ rule_id: ruleId, rule: `surfaceable_only=true requires severity ≤ warning (got critical)` });
      }
      if (Array.isArray(r.recommendations)) {
        for (const rec of r.recommendations) {
          if (rec.type !== "detect") {
            violations.push({ rule_id: ruleId, rule: `surfaceable_only=true requires recommendations[].type="detect" (got "${rec.type}") · BIOS/固件类只能提示不能执行` });
          }
        }
      }
    }

    // Rule 5 (v0.3.2): rationale 存在时必须含四键
    if (r.rationale !== undefined && r.rationale !== null) {
      const required4 = ["summary", "mechanism", "trade_offs", "when_to_deviate"];
      for (const k of required4) {
        const v = r.rationale[k];
        if (typeof v !== "string" || v.trim().length === 0) {
          violations.push({ rule_id: ruleId, rule: `rationale.${k} missing or empty (structured rationale requires all 4 keys · spec § 12 v1 scope)` });
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log(`validate schema: ✓ all ${results.length} rules pass schema constraints`);
    return 0;
  }

  console.error(`validate schema: ✗ ${violations.length} violation(s) across ${results.length} rules:`);
  for (const v of violations) console.error(fmtSchemaViolation(v));
  return 1;
}

// ============================================================================
// ============================================================================
// TOP-LEVEL DISPATCHER
// ============================================================================
// ============================================================================

function printValidateUsage(): void {
  process.stdout.write(
`Usage: kb-validate --op <subcommand> [options]

Subcommands:
  --op grounding   反向审计 LLM 报告 .md 每条 claim 是否锚在 KB
  --op simulate    拟人 DBA 追问验证 (60+ 条典型 query · KB 命中率)
  --op schema      cli-diagnose JSON results[] schema 校验

grounding 选项:
  --report <path>          .md 报告(LLM 输出)
  --db <path>              KB sqlite (默认 data/knowledge.sqlite)
  --corpus <dir>           原 .md 语料目录(默认 data/)
  --rrf-threshold <f>      grounded 门 (默认 0.015)
  --partial-threshold <f>  partial 门 (默认 0.005)
  --strong-threshold <f>   strong-grounded 门 (默认 0.030)
  --min-len <N>            claim 最短字符数 (默认 15)
  --top-k <N>              KB top-K (默认 3)
  --out <path>             写 .md 审计报告
  --fail-under             退出码:有 ungrounded 时返 1

simulate 选项:
  --db <path>              KB sqlite (默认 data/knowledge.sqlite)
  --threshold <f>          RRF 门 (默认 0.015)
  --out <path>             写 JSON 结果
  --verbose                打印 fail 详情

schema 选项:
  --file <path.json>       cli-diagnose 输出 JSON (或 stdin 管道)

Examples:
  node kb-validate.js --op grounding --report ~/.perf-kp-sql/reports/foo.md
  node kb-validate.js --op simulate
  node kb-validate.js --op schema --file /tmp/diag-output.json
  cli-diagnose --engine mongo | node kb-validate.js --op schema
`,
  );
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "op":                { type: "string" },
      // grounding
      "report":            { type: "string" },
      "db":                { type: "string" },
      "corpus":            { type: "string" },
      "rrf-threshold":     { type: "string", default: "0.015" },
      "partial-threshold": { type: "string", default: "0.005" },
      "strong-threshold":  { type: "string", default: "0.030" },
      "min-len":           { type: "string", default: "15" },
      "top-k":             { type: "string", default: "3" },
      "out":               { type: "string" },
      "fail-under":        { type: "string" },
      // simulate
      "threshold":         { type: "string", default: "0.015" },
      "verbose":           { type: "boolean", default: false },
      // schema
      "file":              { type: "string" },
      // common
      "help":              { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help || !values.op) {
    printValidateUsage();
    process.exit(values.help ? 0 : 1);
  }

  const op = values.op!;

  switch (op) {
    case "grounding": {
      if (!values.report) {
        process.stderr.write("--op grounding requires --report <path.md>\n");
        process.exit(1);
      }
      const dbPath = values.db ?? join(skillDir(), "data", "knowledge.sqlite");
      const corpusDir = values.corpus ?? join(skillDir(), "data");
      const ungrounded = await runGrounding({
        reportPath:       values.report!,
        dbPath,
        corpusDir,
        rrfThreshold:     Number(values["rrf-threshold"]),
        partialThreshold: Number(values["partial-threshold"]),
        strongThreshold:  Number(values["strong-threshold"]),
        minLen:           Number(values["min-len"]),
        topK:             Number(values["top-k"]),
        outPath:          values.out ?? null,
        failUnder:        values["fail-under"] ? Number(values["fail-under"]) : null,
      });
      if (values["fail-under"]) process.exit(ungrounded > 0 ? 1 : 0);
      return;
    }
    case "simulate": {
      const dbPath = values.db ?? join(skillDir(), "data", "knowledge.sqlite");
      const exitCode = await runSimulate({
        dbPath,
        threshold: Number(values.threshold),
        outPath:   values.out ?? null,
        verbose:   values.verbose ?? false,
      });
      process.exit(exitCode);
    }
    case "schema": {
      const exitCode = await runSchema({ filePath: values.file ?? null });
      process.exit(exitCode);
    }
    default:
      process.stderr.write(`unknown --op: ${op}\n`);
      printValidateUsage();
      process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch(err => {
    process.stderr.write(`kb-validate error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  });
}
