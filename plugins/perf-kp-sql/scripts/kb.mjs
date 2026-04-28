#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath as __fileURLToPath } from "url";
import { dirname as __pathDirname } from "path";
const require = createRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// plugins/perf-kp-sql/src/cli-kb/parser.ts
import yaml from "js-yaml";
function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return { fm: {}, body: content };
  let fm = {};
  try {
    const loaded = yaml.load(m[1]);
    fm = loaded ?? {};
  } catch {
    fm = {};
  }
  return { fm, body: content.slice(m[0].length) };
}
function splitCases(body) {
  const headerRe = /^## case_id:\s*`?([^`\n]+?)`?\s*$/gm;
  const heads = [];
  let m;
  while ((m = headerRe.exec(body)) !== null) {
    heads.push({ caseId: m[1].trim(), start: m.index });
  }
  const out = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].start;
    const end = i + 1 < heads.length ? heads[i + 1].start : body.length;
    out.push({ caseId: heads[i].caseId, content: body.slice(start, end) });
  }
  return out;
}
function parseTableFields(content) {
  const fields = /* @__PURE__ */ new Map();
  const re = /^\|\s*([^|\n]+?)\s*\|\s*([^|\n]*?)\s*\|/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    const k = m[1].trim();
    const v = m[2].trim();
    if (!k || !v) continue;
    if (k === "\u5B57\u6BB5" && v === "\u503C") continue;
    if (/^[\s\-:|]+$/.test(k) || /^[\s\-:|]+$/.test(v)) continue;
    if (!fields.has(k)) fields.set(k, v);
  }
  return fields;
}
function parseQuotes(content) {
  const quotes = /* @__PURE__ */ new Map();
  const re = /^####\s+(\w+)[^\n]*\n+>\s*([^\n]+(?:\n>\s*[^\n]+)*)/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    const key = m[1];
    if (!quotes.has(key)) {
      quotes.set(key, m[2].replace(/\n>\s*/g, " ").trim());
    }
  }
  return quotes;
}
function parseZhBlocks(content) {
  const zh = /* @__PURE__ */ new Map();
  const re = /^####\s+(\w+)\s*\(中文转述[^)]*\)\s*\n+([^\n][\s\S]*?)(?=\n####\s+|\n###\s+|\n##\s+|\n---|\n\n\|)/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    const key = m[1] + "_zh";
    if (!zh.has(key)) {
      zh.set(key, m[2].trim());
    }
  }
  return zh;
}
function parseCaseFields(content) {
  return {
    fields: parseTableFields(content),
    quotes: parseQuotes(content),
    zh: parseZhBlocks(content)
  };
}
function parseJsonArray(s) {
  if (!s) return [];
  const cleaned = s.replace(/^`|`$/g, "").trim();
  if (!cleaned.startsWith("[")) return [];
  try {
    const arr = JSON.parse(cleaned);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}
function nullable(v) {
  if (!v) return null;
  if (/^\(NULL[\s)·]/.test(v)) return null;
  return v;
}
function assembleBestPracticeData(c, _fm) {
  const { fields, quotes, zh } = parseCaseFields(c.content);
  const detectionLayer = fields.get("detection_layer");
  const detection = detectionLayer ? {
    layer: detectionLayer,
    method_quote: nullable(fields.get("detection_method_quote")),
    violation_pattern_quote: nullable(fields.get("violation_pattern_quote"))
  } : null;
  return {
    scenario: {
      description_quote: quotes.get("scenario_description_quote") ?? null,
      description_zh: zh.get("scenario_description_zh") ?? null,
      keywords: parseJsonArray(fields.get("scenario_keywords")),
      triggers_quote: nullable(fields.get("triggers_quote"))
    },
    recommendation: {
      value: nullable(fields.get("recommendation_value")),
      layer: nullable(fields.get("recommendation_layer")),
      quote: quotes.get("recommendation_quote") ?? null
    },
    detection_step: detection,
    rationale: {
      quote: quotes.get("rationale_quote") ?? null,
      quote_lang: nullable(fields.get("rationale_quote_lang")),
      zh: zh.get("rationale_zh") ?? null
    },
    risk: {
      severity: nullable(fields.get("risk_severity")),
      quote: quotes.get("risk_quote") ?? null,
      zh: zh.get("risk_zh") ?? null
    },
    cross_reference: []
  };
}
function assembleDiagnosticFlowData(c, _fm) {
  const { fields, quotes } = parseCaseFields(c.content);
  const keywordsLine = c.content.match(/####\s+keywords\s*\n+\s*`(\[[^\]]+\])`/);
  const keywords = keywordsLine ? parseJsonArray(keywordsLine[1]) : [];
  const stepRe = /^####\s+step_no\s+(\d+)[^\n]*?(?:·\s*([^\n]+))?\n([\s\S]*?)(?=\n####\s+|\n###\s+|\n##\s+|$(?![\s\S]))/gm;
  const steps = [];
  let sm;
  while ((sm = stepRe.exec(c.content)) !== null) {
    const stepNo = parseInt(sm[1], 10);
    const title = (sm[2] ?? "").trim();
    const stepFields = parseTableFields(sm[3]);
    steps.push({
      step_no: stepNo,
      title,
      metric_name: nullable(stepFields.get("metric_name")),
      collection_layer: nullable(stepFields.get("collection_layer")),
      collection_method_quote: nullable(stepFields.get("collection_method_quote")),
      abnormal_pattern_quote: nullable(stepFields.get("abnormal_pattern_quote")),
      abnormal_pattern_threshold: nullable(stepFields.get("abnormal_pattern_threshold")),
      metric_unit: nullable(stepFields.get("metric_unit")),
      prerequisite_steps: parseJsonArray(stepFields.get("prerequisite_steps"))
    });
  }
  const parameterCauses = [];
  const nonParameterCauses = [];
  const lcMatch = c.content.match(/###\s+likely_causes\s*\n([\s\S]*?)(?=\n###\s+|\n---\s*$|$)/);
  if (lcMatch) {
    const sec = lcMatch[1];
    const subRe = /####\s+(parameter_causes|non_parameter_causes)\s*\n([\s\S]*?)(?=\n####\s+|\n###\s+|$)/g;
    let cm;
    while ((cm = subRe.exec(sec)) !== null) {
      const subName = cm[1];
      const subBody = cm[2];
      if (/^\s*\(无[^)]*\)/.test(subBody.trim())) continue;
      const causeRe = /#####\s+cause\s+(\d+)[^\n]*?(?:·\s*([^\n]+))?\n([\s\S]*?)(?=\n#####\s+|\n####\s+|\n###\s+|$)/g;
      let ccm;
      while ((ccm = causeRe.exec(subBody)) !== null) {
        const causeNo = parseInt(ccm[1], 10);
        const title = (ccm[2] ?? "").trim();
        const cf = parseTableFields(ccm[3]);
        if (subName === "parameter_causes") {
          const linkRaw = cf.get("linked_diagnostic_step_no");
          parameterCauses.push({
            cause_no: causeNo,
            title,
            param_name: nullable(cf.get("param_name")),
            abnormal_value_pattern: nullable(cf.get("abnormal_value_pattern")),
            reasoning_quote: nullable(cf.get("reasoning_quote")),
            linked_diagnostic_step_no: linkRaw ? parseInt(linkRaw, 10) : null
          });
        } else {
          const linkRaw = cf.get("linked_diagnostic_step_no");
          nonParameterCauses.push({
            cause_no: causeNo,
            title,
            cause_type: nullable(cf.get("cause_type")),
            description_quote: nullable(cf.get("description_quote")),
            linked_diagnostic_step_no: linkRaw ? parseInt(linkRaw, 10) : null,
            mitigation_quote: nullable(cf.get("mitigation_quote"))
          });
        }
      }
    }
  }
  return {
    engine: nullable(fields.get("engine")),
    symptom_category: nullable(fields.get("symptom_category")),
    symptom: {
      description_quote: quotes.get("description") ?? null,
      keywords
    },
    diagnostic_steps: steps,
    likely_causes: {
      parameter_causes: parameterCauses,
      non_parameter_causes: nonParameterCauses
    },
    mitigation_quote: quotes.get("mitigation") ?? null
  };
}
function assembleFlameSignatureData(c, _fm) {
  const { fields, quotes, zh } = parseCaseFields(c.content);
  const dirRe = /^####\s+direction\s+(\d+)[^\n]*\n([\s\S]*?)(?=\n####\s+|\n###\s+|\n##\s+|$(?![\s\S]))/gm;
  const directions = [];
  let dm;
  while ((dm = dirRe.exec(c.content)) !== null) {
    const directionNo = parseInt(dm[1], 10);
    const df = parseTableFields(dm[2]);
    directions.push({
      direction_no: directionNo,
      direction_quote: nullable(df.get("direction_quote")),
      related_param_name: nullable(df.get("related_param_name")),
      confidence: nullable(df.get("confidence"))
    });
  }
  return {
    signature_type: nullable(fields.get("signature_type")),
    pattern_regex: nullable(fields.get("pattern_regex")),
    match_layer: nullable(fields.get("match_layer")),
    pattern_quote_anchor: nullable(fields.get("pattern_quote_anchor")),
    pattern_quote: quotes.get("pattern_quote") ?? null,
    mechanism: {
      quote: quotes.get("mechanism_quote") ?? null,
      quote_lang: nullable(fields.get("mechanism_quote_lang")),
      zh: zh.get("mechanism_zh") ?? null
    },
    workload_implication: {
      quote: quotes.get("workload_implication_quote") ?? null,
      zh: zh.get("workload_implication_zh") ?? null,
      hotness_threshold: nullable(fields.get("hotness_threshold"))
    },
    tuning_directions: directions,
    cross_reference: [],
    linked_case_ids: []
  };
}
var init_parser = __esm({
  "plugins/perf-kp-sql/src/cli-kb/parser.ts"() {
    "use strict";
  }
});

// plugins/perf-kp-sql/src/shared/scope-to-bucket.ts
function scopeToBucket(args) {
  if (args.scope) {
    return SCOPE_BUCKETS[args.scope] ?? 5;
  }
  if (args.engine === "kunpeng-platform") return 1;
  if (args.engine === "linux-os") return 2;
  if (args.engine === "mongodb" || args.engine === "mixed") {
    if (args.symptomCategory) {
      return SYMPTOM_BUCKETS[args.symptomCategory] ?? 4;
    }
    return 4;
  }
  return 5;
}
var SCOPE_BUCKETS, SYMPTOM_BUCKETS;
var init_scope_to_bucket = __esm({
  "plugins/perf-kp-sql/src/shared/scope-to-bucket.ts"() {
    "use strict";
    SCOPE_BUCKETS = {
      // bucket 2 · OS / 中间层
      "linux-mm": 2,
      "linux-net": 2,
      "linux-fs": 2,
      "linux-sched": 2,
      "linux-block": 2,
      "mem-allocator-jemalloc": 2,
      "mem-allocator-glibc": 2,
      "tls-crypto": 2,
      // bucket 3 · 引擎静态配置
      "storage-engine-other": 3,
      // bucket 4 · 引擎运行时
      "storage-engine-wt": 4,
      // bucket 5 · 业务层
      "app-other": 5,
      "app-query-layer": 5,
      other: 5
    };
    SYMPTOM_BUCKETS = {
      "startup-failure": 3,
      // 启动配置类
      "cpu-high": 4,
      "memory-pressure": 4,
      "lock-contention": 4,
      "disk-io-saturation": 4,
      "disk-space-pressure": 4,
      "replica-lag": 4,
      "connection-storm": 4,
      "network-latency": 4,
      "query-slow": 5,
      // 业务慢查询
      other: 5
    };
  }
});

// plugins/perf-kp-sql/src/cli-kb/embed.ts
async function embed(text, modelDir) {
  if (!_extractor) {
    const transformers = await import("@xenova/transformers");
    if (modelDir) {
      transformers.env.localModelPath = modelDir;
      transformers.env.cacheDir = modelDir;
    }
    _extractor = await transformers.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  const extractor = _extractor;
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}
function embeddingToBlob(embedding) {
  const buf = Buffer.alloc(embedding.length * 4);
  for (let i = 0; i < embedding.length; i++) {
    buf.writeFloatLE(embedding[i], i * 4);
  }
  return buf;
}
var _extractor;
var init_embed = __esm({
  "plugins/perf-kp-sql/src/cli-kb/embed.ts"() {
    "use strict";
  }
});

// plugins/perf-kp-sql/src/cli-kb/schema.ts
var SCHEMA_VERSION, SCHEMA_SQL, FTS_SCHEMA_SQL, VEC_SCHEMA_SQL;
var init_schema = __esm({
  "plugins/perf-kp-sql/src/cli-kb/schema.ts"() {
    "use strict";
    SCHEMA_VERSION = "1";
    SCHEMA_SQL = `
-- \u4E3B\u8868 cases
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

-- \u5B50\u8868 1 \xB7 \u53C2\u6570\u540D\u6241\u5E73\u5316
CREATE TABLE IF NOT EXISTS case_param_names (
  case_id      TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  param_name   TEXT NOT NULL,
  param_role   TEXT NOT NULL CHECK(param_role IN ('recommendation','cause','tuning-direction','detection')),
  PRIMARY KEY (case_id, param_name, param_role)
);
CREATE INDEX IF NOT EXISTS idx_param_name ON case_param_names(param_name);

-- \u5B50\u8868 2 \xB7 \u5173\u952E\u8BCD\u6241\u5E73\u5316
CREATE TABLE IF NOT EXISTS case_keywords (
  case_id   TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  keyword   TEXT NOT NULL,
  PRIMARY KEY (case_id, keyword)
);
CREATE INDEX IF NOT EXISTS idx_keyword ON case_keywords(keyword);

-- \u5B50\u8868 3 \xB7 inferred \u5B57\u6BB5(\u84B8\u998F\u671F\u6807 NULL \u4F46 _zh \u515C\u5E95\u7684\u5B57\u6BB5\u6E05\u5355)
CREATE TABLE IF NOT EXISTS case_inferred_fields (
  case_id   TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  field     TEXT NOT NULL,
  PRIMARY KEY (case_id, field)
);

-- \u5B50\u8868 4 \xB7 case \u95F4\u5F15\u7528\u5173\u7CFB
CREATE TABLE IF NOT EXISTS case_links (
  case_id_from   TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  case_id_to     TEXT NOT NULL,
  link_type      TEXT NOT NULL CHECK(link_type IN ('cross_reference','linked_case')),
  PRIMARY KEY (case_id_from, case_id_to, link_type)
);
CREATE INDEX IF NOT EXISTS idx_links_to ON case_links(case_id_to);

-- \u5143\u4FE1\u606F
CREATE TABLE IF NOT EXISTS kb_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`;
    FTS_SCHEMA_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS cases_fts USING fts5(
  case_id UNINDEXED,
  fts_text,
  tokenize='trigram'
);
`;
    VEC_SCHEMA_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS cases_vec USING vec0(
  case_id TEXT PRIMARY KEY,
  embedding FLOAT[384]
);
`;
  }
});

// plugins/perf-kp-sql/src/cli-kb/build.ts
var build_exports = {};
__export(build_exports, {
  buildKb: () => buildKb
});
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
function listMdFiles(dir) {
  try {
    return readdirSync(dir).filter((f) => f.endsWith(".md") && !SKIP_FILES.has(f)).map((f) => resolve(dir, f));
  } catch {
    return [];
  }
}
function nullable2(v) {
  if (!v) return null;
  if (typeof v === "string" && /^\(NULL[\s)·]/.test(v)) return null;
  return v;
}
function buildEmbeddingText(prep) {
  const parts = [prep.title];
  if (prep.scope) parts.push(prep.scope);
  if (prep.bp_data) {
    try {
      const o = JSON.parse(prep.bp_data);
      if (o.scenario?.description_quote) parts.push(o.scenario.description_quote);
      if (o.recommendation?.value) parts.push(o.recommendation.value);
      if (o.recommendation?.quote) parts.push(o.recommendation.quote);
      if (o.rationale?.zh) parts.push(o.rationale.zh);
    } catch {
    }
  }
  if (prep.df_data) {
    try {
      const o = JSON.parse(prep.df_data);
      if (o.symptom?.description_quote) parts.push(o.symptom.description_quote);
      if (Array.isArray(o.diagnostic_steps) && o.diagnostic_steps[0]?.abnormal_pattern_quote) {
        parts.push(o.diagnostic_steps[0].abnormal_pattern_quote);
      }
    } catch {
    }
  }
  if (prep.flame_data) {
    try {
      const o = JSON.parse(prep.flame_data);
      if (o.pattern_quote) parts.push(o.pattern_quote);
      if (o.mechanism?.zh) parts.push(o.mechanism.zh);
    } catch {
    }
  }
  return parts.join(" \xB7 ").slice(0, 1e3);
}
function preparesOne(c, fm, entryKind, dbDir, errors) {
  const { fields } = parseCaseFields(c.content);
  const yamlDb = fm.database === null || fm.database === void 0 ? null : String(fm.database);
  const expected = dbDir === "_common" ? null : "mongodb";
  if (yamlDb !== expected) {
    errors.push({
      kind: "path_guard",
      case_id: c.caseId,
      detail: `\u7269\u7406\u76EE\u5F55 ${dbDir} \u671F\u671B database=${expected ?? "null"} \xB7 yaml \u5B9E\u9645 ${yamlDb ?? "null"}`
    });
  }
  const scope = nullable2(fields.get("scope") ?? null);
  const enginePerCase = nullable2(fields.get("engine") ?? null);
  const symptomCategory = nullable2(fields.get("symptom_category") ?? null);
  const bucket = scopeToBucket({
    scope: scope ?? void 0,
    engine: enginePerCase ?? void 0,
    symptomCategory: symptomCategory ?? void 0,
    entryKind
  });
  if (scope && (scope.startsWith("storage-engine-") || scope.startsWith("wt-"))) {
    if (yamlDb !== "mongodb") {
      errors.push({
        kind: "scope_database_mismatch",
        case_id: c.caseId,
        detail: `scope=${scope} \u5FC5\u987B database=mongodb \xB7 \u5B9E\u9645 ${yamlDb ?? "null"}`
      });
    }
  }
  let bp_data = null;
  let df_data = null;
  let flame_data = null;
  if (entryKind === "best-practice") {
    bp_data = JSON.stringify(assembleBestPracticeData(c, fm));
  } else if (entryKind === "diagnostic-flow") {
    df_data = JSON.stringify(assembleDiagnosticFlowData(c, fm));
  } else {
    flame_data = JSON.stringify(assembleFlameSignatureData(c, fm));
  }
  const title = nullable2(fields.get("title"));
  if (!title) {
    errors.push({ kind: "missing_required_field", case_id: c.caseId, detail: "title \u4E3A\u7A7A" });
    return null;
  }
  if (!fm.source_url) {
    errors.push({ kind: "missing_required_field", case_id: c.caseId, detail: "source_url \u4E3A\u7A7A" });
    return null;
  }
  const sourceAuthority = fm.source_authority ? String(fm.source_authority) : "unknown";
  const paramNames = [];
  if (entryKind === "best-practice" && bp_data) {
    const o = JSON.parse(bp_data);
    const arr = c.content.match(/^### related_param_names\s*\n+\s*`(\[[^\]]+\])`/m);
    if (arr) {
      try {
        const list = JSON.parse(arr[1].replace(/^`|`$/g, ""));
        for (const p of list) paramNames.push({ name: p, role: "recommendation" });
      } catch {
      }
    }
    if (o.detection_step) {
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
  const keywords = [];
  if (bp_data) {
    try {
      const o = JSON.parse(bp_data);
      for (const k of o.scenario?.keywords ?? []) keywords.push(String(k));
    } catch {
    }
  }
  if (df_data) {
    try {
      const o = JSON.parse(df_data);
      for (const k of o.symptom?.keywords ?? []) keywords.push(String(k));
    } catch {
    }
  }
  const inferredFields = Array.isArray(fm.inferred_fields) ? fm.inferred_fields.map((s) => String(s)) : [];
  const links = [];
  const platform = nullable2(fm.platform == null ? null : String(fm.platform)) ?? "bare";
  const prep = {
    caseId: c.caseId,
    entryKind,
    database: yamlDb,
    platform,
    scope,
    case_pattern: nullable2(fields.get("case_pattern") ?? null),
    title,
    source_url: String(fm.source_url),
    source_url_lang: fm.source_url_lang == null ? null : String(fm.source_url_lang),
    source_authority: sourceAuthority,
    source_heading: nullable2(fields.get("source_heading") ?? null),
    database_version_min: nullable2(fields.get("database_version_min") ?? null),
    database_version_max: nullable2(fields.get("database_version_max") ?? null),
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
    embedding_text: ""
  };
  prep.embedding_text = buildEmbeddingText(prep);
  return prep;
}
async function buildKb(args) {
  const errors = [];
  const prepared = [];
  const seen = /* @__PURE__ */ new Set();
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
            detail: `${basename(file)}: yaml entry_kind=${yamlEk} \u4E0E\u76EE\u5F55 ${ek} \u4E0D\u4E00\u81F4`
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
  for (const p of prepared) {
    const v = await embed(p.embedding_text, args.modelDir);
    p._embedding = embeddingToBlob(v);
  }
  mkdirSync(dirname(resolve(args.out)), { recursive: true });
  const db = new Database(args.out);
  sqliteVec.load(db);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  db.exec(FTS_SCHEMA_SQL);
  db.exec(VEC_SCHEMA_SQL);
  db.prepare(`INSERT OR REPLACE INTO kb_meta (key, value) VALUES (?, ?)`).run(
    "schema_version",
    SCHEMA_VERSION
  );
  db.prepare(`INSERT OR REPLACE INTO kb_meta (key, value) VALUES (?, ?)`).run(
    "built_at",
    (/* @__PURE__ */ new Date()).toISOString()
  );
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
    `INSERT OR IGNORE INTO case_param_names (case_id, param_name, param_role) VALUES (?, ?, ?)`
  );
  const insertKeyword = db.prepare(
    `INSERT OR IGNORE INTO case_keywords (case_id, keyword) VALUES (?, ?)`
  );
  const insertInferred = db.prepare(
    `INSERT OR IGNORE INTO case_inferred_fields (case_id, field) VALUES (?, ?)`
  );
  const insertLink = db.prepare(
    `INSERT OR IGNORE INTO case_links (case_id_from, case_id_to, link_type) VALUES (?, ?, ?)`
  );
  const insertFts = db.prepare(`INSERT INTO cases_fts (case_id, fts_text) VALUES (?, ?)`);
  const insertVec = db.prepare(`INSERT INTO cases_vec (case_id, embedding) VALUES (?, ?)`);
  const tx = db.transaction((all) => {
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
          bucket: p.bucket
        });
      } catch (e) {
        errors.push({
          kind: "json_column_mismatch",
          case_id: p.caseId,
          detail: e instanceof Error ? e.message : String(e)
        });
        continue;
      }
      for (const pn of p.param_names) insertParam.run(p.caseId, pn.name, pn.role);
      for (const kw of p.keywords) insertKeyword.run(p.caseId, kw);
      for (const f of p.inferred_fields) insertInferred.run(p.caseId, f);
      for (const l of p.links) insertLink.run(p.caseId, l.to, l.type);
      const ftsRow = db.prepare(`SELECT fts_text FROM cases WHERE case_id = ?`).get(p.caseId);
      insertFts.run(p.caseId, ftsRow?.fts_text ?? p.title);
      const blob = p._embedding;
      insertVec.run(p.caseId, blob);
    }
  });
  tx(prepared);
  const totals = {
    cases: db.prepare(`SELECT COUNT(*) AS n FROM cases`).get().n,
    byEntryKind: {
      "best-practice": 0,
      "diagnostic-flow": 0,
      "flame-signature": 0
    },
    byBucket: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    caseParamNames: db.prepare(`SELECT COUNT(*) AS n FROM case_param_names`).get().n,
    caseKeywords: db.prepare(`SELECT COUNT(*) AS n FROM case_keywords`).get().n,
    caseInferredFields: db.prepare(`SELECT COUNT(*) AS n FROM case_inferred_fields`).get().n,
    caseLinks: db.prepare(`SELECT COUNT(*) AS n FROM case_links`).get().n,
    casesFts: db.prepare(`SELECT COUNT(*) AS n FROM cases_fts`).get().n,
    casesVec: db.prepare(`SELECT COUNT(*) AS n FROM cases_vec`).get().n
  };
  for (const ek of ENTRY_KINDS) {
    const r = db.prepare(`SELECT COUNT(*) AS n FROM cases WHERE entry_kind = ?`).get(ek);
    totals.byEntryKind[ek] = r.n;
  }
  for (const b of [1, 2, 3, 4, 5]) {
    const r = db.prepare(`SELECT COUNT(*) AS n FROM cases WHERE bucket = ?`).get(b);
    totals.byBucket[b] = r.n;
  }
  db.close();
  return { totals, errors };
}
var ENTRY_KINDS, DB_DIRS, SKIP_FILES;
var init_build = __esm({
  "plugins/perf-kp-sql/src/cli-kb/build.ts"() {
    "use strict";
    init_parser();
    init_scope_to_bucket();
    init_embed();
    init_schema();
    ENTRY_KINDS = ["best-practice", "diagnostic-flow", "flame-signature"];
    DB_DIRS = ["_common", "mongodb"];
    SKIP_FILES = /* @__PURE__ */ new Set(["CATALOGUE.md", "CATALOGUE-best-practice.md", "FLAME-CATALOGUE.md"]);
  }
});

// plugins/perf-kp-sql/src/cli-kb.ts
init_build();
init_schema();
init_embed();
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { resolve as resolve2 } from "node:path";
async function runCli() {
  const { values, positionals } = parseArgs({
    options: {
      from: { type: "string" },
      out: { type: "string" },
      modelDir: { type: "string" }
    },
    allowPositionals: true
  });
  const op = positionals[0];
  if (op === "build") {
    const casesRoot = values.from ?? "";
    const out = values.out ?? "";
    if (!casesRoot || !out) {
      console.error("Usage: kb.mjs build --from <distill-v2/cases> --out <out.sqlite>");
      process.exit(2);
    }
    const { buildKb: buildKb2 } = await Promise.resolve().then(() => (init_build(), build_exports));
    const result = await buildKb2({
      casesRoot: resolve2(casesRoot),
      out: resolve2(out),
      modelDir: values.modelDir
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length > 0) process.exit(1);
    return;
  }
  console.error(`unknown op: ${op ?? "(none)"} \xB7 \u5F53\u524D\u53EA\u652F\u6301 'build'`);
  process.exit(2);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCli();
}
export {
  FTS_SCHEMA_SQL,
  SCHEMA_SQL,
  SCHEMA_VERSION,
  VEC_SCHEMA_SQL,
  buildKb,
  embed,
  embeddingToBlob
};
