#!/usr/bin/env node
/**
 * migrate-rules.mjs · 数据驱动规则的运行时派生层
 *
 * 设计:
 *   - 真源 = data/mongo/rules.json + data/common/kunpeng-rules.json
 *   - 表里只装"数据驱动规则"(_v2.checks 非空 + audit.pass=true) ·
 *     当前 5 条 · Phase 2 step 3 后会扩
 *   - CheckFn(50 条业务代码规则) 不进 sqlite · 由 src/shared/legacy-checks.ts +
 *     src/engines/mongo/checks.ts 注册表直接跑
 *   - 不要 enabled 列: 表里全是有效规则 · 没用的不进表(_runtime_excluded 已在 rules.json 显式标)
 *
 * 用法:
 *   node scripts/migrate-rules.mjs [--dry-run]
 */

import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(__dirname, "..");
const DB_PATH = join(SKILL_DIR, "data", "knowledge.sqlite");

const { values } = parseArgs({
  options: { "dry-run": { type: "boolean", default: false } },
});
const DRY_RUN = values["dry-run"];

const RULES_SCHEMA = `
CREATE TABLE IF NOT EXISTS rules (
  rule_id             TEXT PRIMARY KEY,
  engine              TEXT NOT NULL,
  bucket              INTEGER NOT NULL,
  severity            TEXT NOT NULL,
  title               TEXT NOT NULL,
  v2_when             TEXT NOT NULL DEFAULT '[]',
  v2_checks           TEXT NOT NULL,
  source_url          TEXT,
  source_title        TEXT,
  source_quote        TEXT,
  arch                TEXT,
  vendor              TEXT,
  os                  TEXT,
  engine_version_min  TEXT,
  engine_version_max  TEXT,
  created_at          TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

function main() {
  console.log(`[migrate-rules] DB: ${DB_PATH}`);
  console.log(`[migrate-rules] DRY_RUN: ${DRY_RUN}`);

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // 重建 rules 表(简化 schema · 无 enabled 列)
  if (!DRY_RUN) {
    db.exec("DROP TABLE IF EXISTS rules;");
    db.exec(RULES_SCHEMA);
  }

  const insertStmt = DRY_RUN ? null : db.prepare(`
    INSERT INTO rules (
      rule_id, engine, bucket, severity, title,
      v2_when, v2_checks,
      source_url, source_title, source_quote,
      arch, vendor, os, engine_version_min, engine_version_max
    ) VALUES (
      @rule_id, @engine, @bucket, @severity, @title,
      @v2_when, @v2_checks,
      @source_url, @source_title, @source_quote,
      @arch, @vendor, @os, @engine_version_min, @engine_version_max
    )
  `);

  const files = [
    { path: join(SKILL_DIR, "data/mongo/rules.json"), defaultEngine: "mongo" },
    { path: join(SKILL_DIR, "data/common/kunpeng-rules.json"), defaultEngine: "any" },
  ];

  let inserted = 0;
  let skipped = 0;
  for (const { path, defaultEngine } of files) {
    let entries;
    try {
      const raw = JSON.parse(readFileSync(path, "utf8"));
      entries = Array.isArray(raw) ? raw : (raw.rules || []);
    } catch (e) {
      console.warn(`[migrate-rules] 跳过 ${path}: ${e.message}`);
      continue;
    }

    let fileInserted = 0;
    for (const entry of entries) {
      // 仅入"数据驱动 + 审计通过"
      const valid = entry._v2?.checks?.length > 0 && entry.audit?.pass === true && entry._runtime_excluded !== true;
      if (!valid) { skipped++; continue; }

      const row = {
        rule_id: entry.id,
        engine: entry.engine || defaultEngine,
        bucket: entry.bucket || 1,
        severity: (entry.severity || "info").toLowerCase(),
        title: entry.source?.title || entry.id,
        v2_when: JSON.stringify(entry._v2.when || []),
        v2_checks: JSON.stringify(entry._v2.checks),
        source_url: entry.source?.url || null,
        source_title: entry.source?.title || null,
        source_quote: entry.source?.quote || null,
        arch: entry.arch || null,
        vendor: entry.vendor || null,
        os: entry.os || null,
        engine_version_min: entry.engine_version_min || null,
        engine_version_max: entry.engine_version_max || null,
      };

      if (DRY_RUN) {
        console.log(`  [dry-run] ${row.rule_id} (${row.engine}, ${row.severity})`);
      } else {
        insertStmt.run(row);
      }
      fileInserted++;
    }
    inserted += fileInserted;
    console.log(`[migrate-rules] ${path}: ${fileInserted} 条 v2 规则入库 (${skipped} 条跳过 · _runtime_excluded 或非 v2)`);
  }

  console.log(`\n[migrate-rules] sqlite rules 表 · 数据驱动规则: ${inserted} 条`);
  console.log(`[migrate-rules] CheckFn 业务规则不进 sqlite · 由 sharedChecks + mongoChecks 注册表直接跑`);
  db.close();
}

main();
