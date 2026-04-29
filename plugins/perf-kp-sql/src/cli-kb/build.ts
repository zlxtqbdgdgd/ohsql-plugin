// Phase 1 · M3 · buildKb 主流程
//
// 扫 distill-v2/cases/{_common,mongodb}/<entry_kind>/*.md → 解析 → 入 sqlite。
// 详见 PHASE-1-SCHEMA-AND-USAGE.md §4。

import Database from "better-sqlite3";
import { readdirSync, readFileSync, statSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";

import {
  parseFrontmatter,
  splitCases,
  parseCaseFields,
  assembleBestPracticeData,
  assembleDiagnosticFlowData,
  assembleFlameSignatureData,
  type Frontmatter,
  type CaseBlock,
} from "./parser.js";
import { scopeToBucket, type Bucket, type EntryKind } from "../shared/scope-to-bucket.js";
import { SCHEMA_SQL, FTS_SCHEMA_SQL, SCHEMA_VERSION } from "./schema.js";

export interface BuildKbArgs {
  casesRoot: string;
  out: string;
}

export type BuildKbErrorKind =
  | "duplicate_case_id"
  | "path_guard"
  | "scope_database_mismatch"
  | "json_column_mismatch"
  | "missing_required_field";

export interface BuildKbError {
  kind: BuildKbErrorKind;
  case_id?: string;
  detail?: string;
}

export interface BuildKbResult {
  totals: {
    cases: number;
    byEntryKind: Record<EntryKind, number>;
    byBucket: Record<1 | 2 | 3 | 4 | 5, number>;
    caseParamNames: number;
    caseKeywords: number;
    caseInferredFields: number;
    caseLinks: number;
    casesFts: number;
  };
  errors: BuildKbError[];
}

const ENTRY_KINDS: EntryKind[] = ["best-practice", "diagnostic-flow", "flame-signature"];
const DB_DIRS = ["_common", "mongodb"] as const;
type DbDir = (typeof DB_DIRS)[number];
const SKIP_FILES = new Set(["CATALOGUE.md", "CATALOGUE-best-practice.md", "FLAME-CATALOGUE.md"]);

interface PreparedCase {
  caseId: string;
  entryKind: EntryKind;
  database: string | null;
  platform: string;
  scope: string | null;
  case_pattern: string | null;
  title: string;
  source_url: string;
  source_url_lang: string | null;
  source_authority: string;
  source_heading: string | null;
  database_version_min: string | null;
  database_version_max: string | null;
  extracted_at: string | null;
  extractor_model: string | null;
  notes: string | null;
  bucket: Bucket;
  bp_data: string | null;
  df_data: string | null;
  flame_data: string | null;
  param_names: Array<{ name: string; role: "recommendation" | "cause" | "tuning-direction" | "detection" }>;
  keywords: string[];
  inferred_fields: string[];
  links: Array<{ to: string; type: "cross_reference" | "linked_case" }>;
}

function listMdFiles(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md") && !SKIP_FILES.has(f))
      .map((f) => resolve(dir, f));
  } catch {
    return [];
  }
}

function nullable(v: string | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string" && /^\(NULL[\s)·]/.test(v)) return null;
  return v;
}

function preparesOne(
  c: CaseBlock,
  fm: Frontmatter,
  entryKind: EntryKind,
  dbDir: DbDir,
  errors: BuildKbError[],
): PreparedCase | null {
  const { fields } = parseCaseFields(c.content);

  // path-guard: _common ↔ database NULL · mongodb ↔ 'mongodb'
  const yamlDb = fm.database === null || fm.database === undefined ? null : String(fm.database);
  const expected = dbDir === "_common" ? null : "mongodb";
  if (yamlDb !== expected) {
    errors.push({
      kind: "path_guard",
      case_id: c.caseId,
      detail: `物理目录 ${dbDir} 期望 database=${expected ?? "null"} · yaml 实际 ${yamlDb ?? "null"}`,
    });
  }

  const scope = nullable(fields.get("scope") ?? null);
  const enginePerCase = nullable(fields.get("engine") ?? null);
  const symptomCategory = nullable(fields.get("symptom_category") ?? null);
  const bucket = scopeToBucket({
    scope: scope ?? undefined,
    engine: enginePerCase ?? undefined,
    symptomCategory: symptomCategory ?? undefined,
    entryKind,
  });

  // scope-database 配对 lint (BP/Flame · DF 不强制)
  if (scope && (scope.startsWith("storage-engine-") || scope.startsWith("wt-"))) {
    if (yamlDb !== "mongodb") {
      errors.push({
        kind: "scope_database_mismatch",
        case_id: c.caseId,
        detail: `scope=${scope} 必须 database=mongodb · 实际 ${yamlDb ?? "null"}`,
      });
    }
  }

  // 装配 entry_kind 专属 JSON
  let bp_data: string | null = null;
  let df_data: string | null = null;
  let flame_data: string | null = null;
  if (entryKind === "best-practice") {
    bp_data = JSON.stringify(assembleBestPracticeData(c, fm));
  } else if (entryKind === "diagnostic-flow") {
    df_data = JSON.stringify(assembleDiagnosticFlowData(c, fm));
  } else {
    flame_data = JSON.stringify(assembleFlameSignatureData(c, fm));
  }

  // 必备字段
  const title = nullable(fields.get("title"));
  if (!title) {
    errors.push({ kind: "missing_required_field", case_id: c.caseId, detail: "title 为空" });
    return null;
  }
  if (!fm.source_url) {
    errors.push({ kind: "missing_required_field", case_id: c.caseId, detail: "source_url 为空" });
    return null;
  }
  // source_authority 缺失时默认 'unknown' · 不阻断入库 (DF 部分 yaml 没写此字段 · 蒸馏者后续补)
  const sourceAuthority = fm.source_authority ? String(fm.source_authority) : "unknown";

  // 抽 param_names (从 BP/DF/Flame 各结构里提取并打 role)
  const paramNames: PreparedCase["param_names"] = [];
  if (entryKind === "best-practice" && bp_data) {
    const o = JSON.parse(bp_data);
    // related_param_names 数组(若 case 表里直接给) · 或从 recommendation_value 推
    const arr = c.content.match(/^### related_param_names\s*\n+\s*`(\[[^\]]+\])`/m);
    if (arr) {
      try {
        const list = JSON.parse(arr[1].replace(/^`|`$/g, "")) as string[];
        for (const p of list) paramNames.push({ name: p, role: "recommendation" });
      } catch {}
    }
    if (o.detection_step) {
      // detection 暂不提取参数 (大多与 recommendation 一致)
    }
  } else if (entryKind === "diagnostic-flow" && df_data) {
    const o = JSON.parse(df_data);
    for (const c2 of o.likely_causes?.parameter_causes ?? []) {
      if (c2.param_name) paramNames.push({ name: String(c2.param_name), role: "cause" });
    }
  } else if (entryKind === "flame-signature" && flame_data) {
    const o = JSON.parse(flame_data);
    for (const d of o.tuning_directions ?? []) {
      if (d.related_param_name) paramNames.push({ name: String(d.related_param_name), role: "tuning-direction" });
    }
  }

  // 关键词 (BP scenario.keywords 或 DF symptom.keywords)
  const keywords: string[] = [];
  if (bp_data) {
    try {
      const o = JSON.parse(bp_data);
      for (const k of o.scenario?.keywords ?? []) keywords.push(String(k));
    } catch {}
  }
  if (df_data) {
    try {
      const o = JSON.parse(df_data);
      for (const k of o.symptom?.keywords ?? []) keywords.push(String(k));
    } catch {}
  }

  // inferred_fields (yaml frontmatter)
  const inferredFields: string[] = Array.isArray(fm.inferred_fields)
    ? fm.inferred_fields.map((s) => String(s))
    : [];

  // links: 暂不提取(M3 lint 不依赖)
  const links: PreparedCase["links"] = [];

  const platform = nullable(fm.platform == null ? null : String(fm.platform)) ?? "bare";

  const prep: PreparedCase = {
    caseId: c.caseId,
    entryKind,
    database: yamlDb,
    platform,
    scope,
    case_pattern: nullable(fields.get("case_pattern") ?? null),
    title,
    source_url: String(fm.source_url),
    source_url_lang: fm.source_url_lang == null ? null : String(fm.source_url_lang),
    source_authority: sourceAuthority,
    source_heading: nullable(fields.get("source_heading") ?? null),
    database_version_min: nullable(fields.get("database_version_min") ?? null),
    database_version_max: nullable(fields.get("database_version_max") ?? null),
    extracted_at: fm.extracted_at == null ? null : String(fm.extracted_at),
    extractor_model: fm.extractor_model == null ? null : String(fm.extractor_model),
    notes: fm.notes == null ? null : String(fm.notes),
    bucket,
    bp_data,
    df_data,
    flame_data,
    param_names: paramNames,
    keywords: [...new Set(keywords)],
    inferred_fields: inferredFields,
    links,
  };
  return prep;
}

export async function buildKb(args: BuildKbArgs): Promise<BuildKbResult> {
  const errors: BuildKbError[] = [];

  // 1. 扫所有 cases md → preparedCases (只解析 + lint · 不入库)
  const prepared: PreparedCase[] = [];
  const seen = new Set<string>();

  for (const dbDir of DB_DIRS) {
    for (const ek of ENTRY_KINDS) {
      const dir = resolve(args.casesRoot, dbDir, ek);
      const files = listMdFiles(dir);
      for (const file of files) {
        const content = readFileSync(file, "utf8");
        const { fm, body } = parseFrontmatter(content);
        const yamlEk = fm.entry_kind == null ? null : String(fm.entry_kind);
        if (yamlEk !== null && yamlEk !== ek) {
          errors.push({
            kind: "json_column_mismatch",
            detail: `${basename(file)}: yaml entry_kind=${yamlEk} 与目录 ${ek} 不一致`,
          });
        }
        const cases = splitCases(body);
        for (const c of cases) {
          if (seen.has(c.caseId)) {
            errors.push({ kind: "duplicate_case_id", case_id: c.caseId });
            continue;
          }
          seen.add(c.caseId);
          const prep = preparesOne(c, fm, ek, dbDir, errors);
          if (prep) prepared.push(prep);
        }
      }
    }
  }

  // 2. 打开 sqlite + 建表
  mkdirSync(dirname(resolve(args.out)), { recursive: true });
  const db = new Database(args.out);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(SCHEMA_SQL);
  db.exec(FTS_SCHEMA_SQL);

  db.prepare(`INSERT OR REPLACE INTO kb_meta (key, value) VALUES (?, ?)`).run(
    "schema_version",
    SCHEMA_VERSION,
  );
  db.prepare(`INSERT OR REPLACE INTO kb_meta (key, value) VALUES (?, ?)`).run(
    "built_at",
    new Date().toISOString(),
  );

  // 3. 一个事务批量入库
  const insertCase = db.prepare(`
    INSERT INTO cases (
      case_id, entry_kind, database, platform, scope, case_pattern,
      title, source_url, source_url_lang, source_authority, source_heading,
      database_version_min, database_version_max,
      extracted_at, extractor_model, notes,
      best_practice_data, diagnostic_flow_data, flame_signature_data,
      bucket
    ) VALUES (
      @case_id, @entry_kind, @database, @platform, @scope, @case_pattern,
      @title, @source_url, @source_url_lang, @source_authority, @source_heading,
      @database_version_min, @database_version_max,
      @extracted_at, @extractor_model, @notes,
      @best_practice_data, @diagnostic_flow_data, @flame_signature_data,
      @bucket
    )
  `);
  const insertParam = db.prepare(
    `INSERT OR IGNORE INTO case_param_names (case_id, param_name, param_role) VALUES (?, ?, ?)`,
  );
  const insertKeyword = db.prepare(
    `INSERT OR IGNORE INTO case_keywords (case_id, keyword) VALUES (?, ?)`,
  );
  const insertInferred = db.prepare(
    `INSERT OR IGNORE INTO case_inferred_fields (case_id, field) VALUES (?, ?)`,
  );
  const insertLink = db.prepare(
    `INSERT OR IGNORE INTO case_links (case_id_from, case_id_to, link_type) VALUES (?, ?, ?)`,
  );
  const insertFts = db.prepare(`INSERT INTO cases_fts (case_id, fts_text) VALUES (?, ?)`);

  const tx = db.transaction((all: PreparedCase[]) => {
    for (const p of all) {
      try {
        insertCase.run({
          case_id: p.caseId,
          entry_kind: p.entryKind,
          database: p.database,
          platform: p.platform,
          scope: p.scope,
          case_pattern: p.case_pattern,
          title: p.title,
          source_url: p.source_url,
          source_url_lang: p.source_url_lang,
          source_authority: p.source_authority,
          source_heading: p.source_heading,
          database_version_min: p.database_version_min,
          database_version_max: p.database_version_max,
          extracted_at: p.extracted_at,
          extractor_model: p.extractor_model,
          notes: p.notes,
          best_practice_data: p.bp_data,
          diagnostic_flow_data: p.df_data,
          flame_signature_data: p.flame_data,
          bucket: p.bucket,
        });
      } catch (e) {
        errors.push({
          kind: "json_column_mismatch",
          case_id: p.caseId,
          detail: e instanceof Error ? e.message : String(e),
        });
        continue;
      }
      for (const pn of p.param_names) insertParam.run(p.caseId, pn.name, pn.role);
      for (const kw of p.keywords) insertKeyword.run(p.caseId, kw);
      for (const f of p.inferred_fields) insertInferred.run(p.caseId, f);
      for (const l of p.links) insertLink.run(p.caseId, l.to, l.type);

      // 用主表的 fts_text VIRTUAL 列读出来再写 fts (因为 trigger 没用 VIRTUAL 列自动同步)
      const ftsRow = db
        .prepare(`SELECT fts_text FROM cases WHERE case_id = ?`)
        .get(p.caseId) as { fts_text: string } | undefined;
      insertFts.run(p.caseId, ftsRow?.fts_text ?? p.title);
    }
  });
  tx(prepared);

  // 4. 统计
  const totals = {
    cases: (db.prepare(`SELECT COUNT(*) AS n FROM cases`).get() as { n: number }).n,
    byEntryKind: {
      "best-practice": 0,
      "diagnostic-flow": 0,
      "flame-signature": 0,
    } as Record<EntryKind, number>,
    byBucket: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>,
    caseParamNames: (db.prepare(`SELECT COUNT(*) AS n FROM case_param_names`).get() as { n: number }).n,
    caseKeywords: (db.prepare(`SELECT COUNT(*) AS n FROM case_keywords`).get() as { n: number }).n,
    caseInferredFields: (db.prepare(`SELECT COUNT(*) AS n FROM case_inferred_fields`).get() as { n: number }).n,
    caseLinks: (db.prepare(`SELECT COUNT(*) AS n FROM case_links`).get() as { n: number }).n,
    casesFts: (db.prepare(`SELECT COUNT(*) AS n FROM cases_fts`).get() as { n: number }).n,
  };
  for (const ek of ENTRY_KINDS) {
    const r = db
      .prepare(`SELECT COUNT(*) AS n FROM cases WHERE entry_kind = ?`)
      .get(ek) as { n: number };
    totals.byEntryKind[ek] = r.n;
  }
  for (const b of [1, 2, 3, 4, 5] as const) {
    const r = db
      .prepare(`SELECT COUNT(*) AS n FROM cases WHERE bucket = ?`)
      .get(b) as { n: number };
    totals.byBucket[b] = r.n;
  }

  db.close();

  return { totals, errors };
}
