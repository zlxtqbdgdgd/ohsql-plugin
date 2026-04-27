#!/usr/bin/env node
/**
 * sync-source-json-from-kb — 从 data/knowledge.sqlite 反向写回 source JSON 的
 * source.url / source.title,关掉 URL drift。
 *
 * 扫描 data/**\/*.json(顶层数组的 JSON),对每个含 `id` 字段的对象,
 * 在 KB 里查同 rule_id,如果有 source_url / source_title 就写回 obj.source.{url,title}。
 *
 * 用法:
 *   node tools/sync-source-json-from-kb.mjs --dry-run   # 仅打印将改的文件 / 行数
 *   node tools/sync-source-json-from-kb.mjs             # 实际写入
 */
import Database from "better-sqlite3";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dir, "..", "data");
const DB = join(DATA, "knowledge.sqlite");

const dryRun = process.argv.includes("--dry-run");

const db = new Database(DB, { readonly: true });
const all = db.prepare("SELECT rule_id, source_url, source_title FROM rules").all();
const map = new Map(all.map((r) => [r.rule_id, { url: r.source_url, title: r.source_title }]));
db.close();

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (e.endsWith(".json")) out.push(p);
  }
  return out;
}

let totalUrl = 0, totalTitle = 0, totalFiles = 0;
for (const file of walk(DATA)) {
  let txt;
  try { txt = readFileSync(file, "utf8"); } catch { continue; }
  let arr;
  try { arr = JSON.parse(txt); } catch { continue; }
  if (!Array.isArray(arr)) continue;

  let changedUrl = 0, changedTitle = 0;
  for (const obj of arr) {
    if (!obj || typeof obj !== "object" || !obj.id) continue;
    const want = map.get(obj.id);
    if (!want) continue;
    obj.source ??= {};
    if (want.url != null && obj.source.url !== want.url) {
      obj.source.url = want.url; changedUrl++;
    }
    if (want.title != null && obj.source.title !== want.title) {
      obj.source.title = want.title; changedTitle++;
    }
  }
  if (changedUrl || changedTitle) {
    if (!dryRun) writeFileSync(file, JSON.stringify(arr, null, 2) + "\n");
    console.log(`${file}: url=${changedUrl} title=${changedTitle}`);
    totalUrl += changedUrl; totalTitle += changedTitle; totalFiles++;
  }
}
console.log(`\n${dryRun ? "[dry-run] " : ""}total: url=${totalUrl} title=${totalTitle} files=${totalFiles}`);
