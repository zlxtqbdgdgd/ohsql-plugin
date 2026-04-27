#!/usr/bin/env node
/**
 * migrate-knowledge.mjs — 架构整改 Phase 2
 *
 * 1. 创建 flame_patterns 表，从 knowledge 表迁移火焰图模式数据
 * 2. 改造 knowledge 表：解耦 rule_id，改为 doc_id + chunk_index
 *
 * 用法:
 *   node scripts/migrate-knowledge.mjs [--dry-run]
 */

import Database from "better-sqlite3";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(__dirname, "..");
const DB_PATH = join(SKILL_DIR, "data", "knowledge.sqlite");

const { values } = parseArgs({
  options: { "dry-run": { type: "boolean", default: false } },
});
const DRY_RUN = values["dry-run"];

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const FLAME_PATTERNS_SCHEMA = `
CREATE TABLE IF NOT EXISTS flame_patterns (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_regex       TEXT NOT NULL,
  semantic_group      TEXT NOT NULL,
  engine              TEXT NOT NULL DEFAULT 'mongo',
  diagnosis_hint      TEXT NOT NULL,
  engine_version_min  TEXT,
  engine_version_max  TEXT,
  module_name         TEXT,
  grade               INTEGER DEFAULT 0,
  created_at          TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

// ---------------------------------------------------------------------------
// 主函数
// ---------------------------------------------------------------------------

function main() {
  console.log(`[migrate-knowledge] DB: ${DB_PATH}`);
  console.log(`[migrate-knowledge] DRY_RUN: ${DRY_RUN}`);

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // -----------------------------------------------------------------------
  // Step 1: 创建 flame_patterns 表
  // -----------------------------------------------------------------------
  db.exec(FLAME_PATTERNS_SCHEMA);
  console.log("[migrate-knowledge] flame_patterns 表已创建/已存在");

  // -----------------------------------------------------------------------
  // Step 2: 从 knowledge 表迁移火焰图模式到 flame_patterns
  // -----------------------------------------------------------------------
  const flameRows = db.prepare(`
    SELECT id, rule_id, engine, content_zh, content_en,
           semantic_group, flame_pattern_regex, grade,
           engine_version_min_display, engine_version_max_display
    FROM knowledge
    WHERE flame_pattern_regex IS NOT NULL AND flame_pattern_regex != ''
  `).all();

  console.log(`[migrate-knowledge] 找到 ${flameRows.length} 条火焰图模式数据`);

  if (!DRY_RUN && flameRows.length > 0) {
    const insertFlame = db.prepare(`
      INSERT OR IGNORE INTO flame_patterns (
        pattern_regex, semantic_group, engine, diagnosis_hint,
        engine_version_min, engine_version_max, module_name, grade
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const migrate = db.transaction(() => {
      let count = 0;
      for (const row of flameRows) {
        // 从 rule_id 提取 module_name（如 "mongo-flame-module-mongod" → "mongod"）
        let moduleName = null;
        const moduleMatch = row.rule_id?.match(/flame-module-(.+)/);
        if (moduleMatch) moduleName = moduleMatch[1];

        // diagnosis_hint 用 content_zh 或 content_en
        const hint = row.content_zh || row.content_en || row.rule_id;

        insertFlame.run(
          row.flame_pattern_regex,
          row.semantic_group || "unknown",
          row.engine || "mongo",
          hint,
          row.engine_version_min_display || null,
          row.engine_version_max_display || null,
          moduleName,
          row.grade || 0,
        );
        count++;
      }
      return count;
    });

    const flameCount = migrate();
    console.log(`[migrate-knowledge] 火焰图模式迁移: ${flameCount} 条`);
  }

  // -----------------------------------------------------------------------
  // Step 3: 给 knowledge 表添加 doc_id + chunk_index 列（如果不存在）
  // -----------------------------------------------------------------------

  // 检查是否已有 doc_id 列
  const columns = db.prepare("PRAGMA table_info(knowledge)").all();
  const hasDocId = columns.some((c) => c.name === "doc_id");

  if (!hasDocId) {
    if (!DRY_RUN) {
      db.exec(`ALTER TABLE knowledge ADD COLUMN doc_id TEXT`);
      db.exec(`ALTER TABLE knowledge ADD COLUMN chunk_index INTEGER DEFAULT 0`);
      console.log("[migrate-knowledge] 已添加 doc_id + chunk_index 列");
    } else {
      console.log("[migrate-knowledge] [dry-run] 将添加 doc_id + chunk_index 列");
    }
  } else {
    console.log("[migrate-knowledge] doc_id 列已存在，跳过 ALTER");
  }

  // -----------------------------------------------------------------------
  // Step 4: 按 source_url 归组，生成 doc_id
  // -----------------------------------------------------------------------

  if (!DRY_RUN) {
    // 按 source_url 分组，为每组生成一个 doc_id
    const sources = db.prepare(`
      SELECT DISTINCT source_url FROM knowledge WHERE source_url IS NOT NULL AND source_url != ''
    `).all();

    console.log(`[migrate-knowledge] ${sources.length} 个独立 source_url`);

    const updateDocId = db.prepare(`
      UPDATE knowledge SET doc_id = ?, chunk_index = ? WHERE id = ?
    `);

    const assignDocIds = db.transaction(() => {
      let updated = 0;
      for (const src of sources) {
        const url = src.source_url;
        // 从 URL 生成简短 doc_id
        const docId = urlToDocId(url);

        // 该 source_url 下的所有行按 id 排序
        const rows = db.prepare(`
          SELECT id FROM knowledge WHERE source_url = ? ORDER BY id
        `).all(url);

        for (let i = 0; i < rows.length; i++) {
          updateDocId.run(docId, i, rows[i].id);
          updated++;
        }
      }

      // 处理没有 source_url 的行
      const noUrl = db.prepare(`
        SELECT id, rule_id FROM knowledge WHERE source_url IS NULL OR source_url = ''
      `).all();
      for (let i = 0; i < noUrl.length; i++) {
        const docId = noUrl[i].rule_id ? `rule_${noUrl[i].rule_id}` : "unknown";
        updateDocId.run(docId, i, noUrl[i].id);
        updated++;
      }

      return updated;
    });

    const updatedCount = assignDocIds();
    console.log(`[migrate-knowledge] doc_id 赋值: ${updatedCount} 行`);
  }

  // -----------------------------------------------------------------------
  // Step 5: 统计
  // -----------------------------------------------------------------------
  if (!DRY_RUN) {
    const totalKnowledge = db.prepare("SELECT count(*) as cnt FROM knowledge").get();
    const withDocId = db.prepare("SELECT count(*) as cnt FROM knowledge WHERE doc_id IS NOT NULL").get();
    const flamePatterns = db.prepare("SELECT count(*) as cnt FROM flame_patterns").get();
    const uniqueDocs = db.prepare("SELECT count(DISTINCT doc_id) as cnt FROM knowledge WHERE doc_id IS NOT NULL").get();

    console.log("\n[migrate-knowledge] 最终统计:");
    console.log(`  knowledge 总行数: ${totalKnowledge.cnt}`);
    console.log(`  已赋 doc_id: ${withDocId.cnt}`);
    console.log(`  独立文档数: ${uniqueDocs.cnt}`);
    console.log(`  flame_patterns: ${flamePatterns.cnt} 条`);
  }

  db.close();
  console.log("[migrate-knowledge] 完成");
}

// ---------------------------------------------------------------------------
// 辅助: URL → doc_id
// ---------------------------------------------------------------------------

function urlToDocId(url) {
  try {
    const u = new URL(url);
    // "https://www.mongodb.com/docs/manual/administration/production-notes/"
    // → "mongodb_docs_administration_production-notes"
    const host = u.hostname.replace(/^www\./, "").split(".")[0]; // "mongodb"
    const path = u.pathname
      .replace(/^\/|\/$/g, "")     // 去首尾 /
      .replace(/\//g, "_")         // / → _
      .replace(/[^a-zA-Z0-9_-]/g, "") // 移除特殊字符
      .slice(0, 60);               // 截断
    return `${host}_${path}` || "unknown";
  } catch {
    // 非标准 URL，直接 hash
    return `doc_${url.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}`;
  }
}

main();
