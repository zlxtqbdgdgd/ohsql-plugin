#!/usr/bin/env node
/**
 * slim-rules-json — 瘦身 rules.json (红线收紧)
 *
 * 删字段(LLM paraphrase 时代产物):
 *   - reason / recommend / fix / fix_cost / threshold / metric_expr
 *   - refs / confidence / needs_human_review / audit_note
 *   - _v2.notes / _v2.structuring_confidence
 *
 * 保留字段(运行时 / 结构 / 出处):
 *   - id, engine, bucket, severity
 *   - arch, vendor, os, engine_version_min/max
 *   - source { tier, url, title, quote, accessed }
 *   - _v2 { when, checks }
 *   - audit { status, pass, last_audited }
 *   - _runtime_excluded
 *
 * 处理两个文件:
 *   - skills/perf-kp-sql/data/mongo/rules.json
 *   - skills/perf-kp-sql/data/common/kunpeng-rules.json
 *
 * 备份 .bak-pre-slim · 不入 git (gitignore 已盖)
 *
 * 用法:
 *   node scripts/slim-rules-json.mjs           # 实际执行
 *   node scripts/slim-rules-json.mjs --dry-run # 仅预览
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const FILES = [
  "skills/perf-kp-sql/data/mongo/rules.json",
  "skills/perf-kp-sql/data/common/kunpeng-rules.json",
];

const KEEP_TOP = new Set([
  "id", "engine", "bucket", "severity",
  "arch", "vendor", "os", "engine_version_min", "engine_version_max",
  "source", "_v2", "audit", "_runtime_excluded",
]);
const KEEP_V2 = new Set(["when", "checks"]);
const KEEP_AUDIT = new Set(["status", "pass", "last_audited"]);
const KEEP_SOURCE = new Set(["tier", "url", "title", "quote", "accessed"]);

const dryRun = process.argv.includes("--dry-run");

function pickFields(obj, allow) {
  const out = {};
  for (const k of Object.keys(obj)) if (allow.has(k)) out[k] = obj[k];
  return out;
}

function slimRule(r) {
  const out = {};
  for (const k of Object.keys(r)) {
    if (!KEEP_TOP.has(k)) continue;
    if (k === "_v2" && r._v2) {
      out._v2 = pickFields(r._v2, KEEP_V2);
    } else if (k === "audit" && r.audit) {
      out.audit = pickFields(r.audit, KEEP_AUDIT);
    } else if (k === "source" && r.source) {
      out.source = pickFields(r.source, KEEP_SOURCE);
    } else {
      out[k] = r[k];
    }
  }
  return out;
}

let totalDropped = 0;
let totalKept = 0;

for (const rel of FILES) {
  const path = resolve(rel);
  if (!existsSync(path)) {
    console.log(`[slim] skip (not found): ${rel}`);
    continue;
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const slimmed = raw.map(slimRule);

  const beforeKeys = new Set();
  for (const r of raw) for (const k of Object.keys(r)) beforeKeys.add(k);
  const afterKeys = new Set();
  for (const r of slimmed) for (const k of Object.keys(r)) afterKeys.add(k);
  const dropped = [...beforeKeys].filter((k) => !afterKeys.has(k));

  console.log(`[slim] ${rel}`);
  console.log(`  rules: ${raw.length}`);
  console.log(`  fields kept: ${[...afterKeys].sort().join(", ")}`);
  console.log(`  fields dropped: ${dropped.sort().join(", ")}`);

  // size diff
  const beforeSize = JSON.stringify(raw).length;
  const afterSize = JSON.stringify(slimmed).length;
  console.log(`  size: ${(beforeSize/1024).toFixed(1)} KB → ${(afterSize/1024).toFixed(1)} KB · ${(((1 - afterSize/beforeSize) * 100)).toFixed(0)}% 瘦`);

  totalDropped += dropped.length;
  totalKept += [...afterKeys].length;

  if (!dryRun) {
    const bakPath = path + ".bak-pre-slim";
    if (!existsSync(bakPath)) {
      copyFileSync(path, bakPath);
      console.log(`  → ${bakPath} (backup)`);
    }
    writeFileSync(path, JSON.stringify(slimmed, null, 2));
    console.log(`  → ${path} (slim) ✅`);
  } else {
    console.log(`  (dry-run · 未写盘)`);
  }
  console.log();
}

console.log(`[slim] done · ${totalKept} kept-fields · ${totalDropped} dropped-fields total`);
