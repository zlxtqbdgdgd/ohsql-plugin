// Phase 1 · M3 · sqlite KB schema
//
// 单 cases 表 + 4 张扁平子表 + cases_fts (FTS5 trigram)。
// 详见 PHASE-1-SCHEMA-AND-USAGE.md §2。

export const SCHEMA_VERSION = "1";

export const SCHEMA_SQL = `
-- 主表 cases
CREATE TABLE IF NOT EXISTS cases (
  case_id              TEXT PRIMARY KEY,
  entry_kind           TEXT NOT NULL CHECK(entry_kind IN ('best-practice','diagnostic-flow','flame-signature')),

  database             TEXT,
  platform             TEXT NOT NULL,
  scope                TEXT,
  case_pattern         TEXT,

  title                TEXT NOT NULL,
  source_url           TEXT NOT NULL,
  source_url_lang      TEXT,
  source_authority     TEXT NOT NULL,
  source_heading       TEXT,
  database_version_min TEXT,
  database_version_max TEXT,
  extracted_at         TEXT,
  extractor_model      TEXT,
  notes                TEXT,

  best_practice_data   TEXT,
  diagnostic_flow_data TEXT,
  flame_signature_data TEXT,

  bucket               INTEGER NOT NULL CHECK(bucket IN (1,2,3,4,5)),

  fts_text             TEXT GENERATED ALWAYS AS (
    title || ' ' || COALESCE(scope,'') || ' ' || COALESCE(notes,'') || ' ' ||
    COALESCE(best_practice_data,'') || COALESCE(diagnostic_flow_data,'') || COALESCE(flame_signature_data,'')
  ) VIRTUAL,

  CHECK (
    (entry_kind = 'best-practice'    AND best_practice_data    IS NOT NULL) OR
    (entry_kind = 'diagnostic-flow'  AND diagnostic_flow_data  IS NOT NULL) OR
    (entry_kind = 'flame-signature'  AND flame_signature_data  IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_cases_entry_kind        ON cases(entry_kind);
CREATE INDEX IF NOT EXISTS idx_cases_database_kind     ON cases(database, entry_kind);
CREATE INDEX IF NOT EXISTS idx_cases_platform          ON cases(platform);
CREATE INDEX IF NOT EXISTS idx_cases_scope             ON cases(scope);
CREATE INDEX IF NOT EXISTS idx_cases_database_scope    ON cases(database, scope);
CREATE INDEX IF NOT EXISTS idx_cases_authority         ON cases(source_authority);
CREATE INDEX IF NOT EXISTS idx_cases_pattern           ON cases(case_pattern);
CREATE INDEX IF NOT EXISTS idx_cases_bucket            ON cases(bucket);

-- 子表 1 · 参数名扁平化
CREATE TABLE IF NOT EXISTS case_param_names (
  case_id      TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  param_name   TEXT NOT NULL,
  param_role   TEXT NOT NULL CHECK(param_role IN ('recommendation','cause','tuning-direction','detection')),
  PRIMARY KEY (case_id, param_name, param_role)
);
CREATE INDEX IF NOT EXISTS idx_param_name ON case_param_names(param_name);

-- 子表 2 · 关键词扁平化
CREATE TABLE IF NOT EXISTS case_keywords (
  case_id   TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  keyword   TEXT NOT NULL,
  PRIMARY KEY (case_id, keyword)
);
CREATE INDEX IF NOT EXISTS idx_keyword ON case_keywords(keyword);

-- 子表 3 · inferred 字段(蒸馏期标 NULL 但 _zh 兜底的字段清单)
CREATE TABLE IF NOT EXISTS case_inferred_fields (
  case_id   TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  field     TEXT NOT NULL,
  PRIMARY KEY (case_id, field)
);

-- 子表 4 · case 间引用关系
CREATE TABLE IF NOT EXISTS case_links (
  case_id_from   TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  case_id_to     TEXT NOT NULL,
  link_type      TEXT NOT NULL CHECK(link_type IN ('cross_reference','linked_case')),
  PRIMARY KEY (case_id_from, case_id_to, link_type)
);
CREATE INDEX IF NOT EXISTS idx_links_to ON case_links(case_id_to);

-- 元信息
CREATE TABLE IF NOT EXISTS kb_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`;

export const FTS_SCHEMA_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS cases_fts USING fts5(
  case_id UNINDEXED,
  fts_text,
  tokenize='trigram'
);
`;
