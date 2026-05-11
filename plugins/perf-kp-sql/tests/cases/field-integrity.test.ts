// 案例字段完整度 lint
//
// 跑遍 cases/CASES.md (109) + best-practice/CASES.md (93) = 202 条 case
// 按 entry_kind 检查必填字段(- **field**: value 与 ### section)非空。
//
// 字段分两档:
//   hard required: 100% 出现 · 缺失 → 测试 fail
//   warn only: 部分 case N/A(定性建议无 numeric value · 配置型源无 narrative quote)
//              · 缺失 → 报告标记但不 fail
//
// 报告落到 data/quality-reports/field-integrity-report.json · 给后续素材体检用。

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "../..");
const DATA_DIR = resolve(PLUGIN_ROOT, "data");
const REPORT_DIR = resolve(DATA_DIR, "quality-reports");
const REPORT_PATH = resolve(REPORT_DIR, "field-integrity-report.json");

interface ParsedCase {
  case_id: string;
  line_no: number;
  fields: Record<string, string>; // - **field**: value
  sections: Set<string>; // ### section
  section_bodies: Record<string, string>;
}

// ---- 必填字段 schema(按 entry_kind) ----
//
// hard:100% 出现率 · 缺失 → fail
// warn:部分 case N/A(定性建议无 numeric value · 配置型源无 narrative quote)
//       · 缺失 → 报告但不 fail

interface RequiredSchema {
  hard_fields: string[];
  hard_sections: string[];
  warn_fields: string[];
  warn_sections: string[];
}

const REQUIRED: Record<string, RequiredSchema> = {
  "diagnostic-flow": {
    hard_fields: [
      "entry_kind",
      "db",
      "platform",
      "engine",
      "symptom_category",
      "case_pattern",
      "title",
      "source_heading",
      "diagnostic_steps_count",
      "likely_causes_count",
      "source_url",
      "source_url_lang",
    ],
    hard_sections: ["symptom_description", "diagnostic_steps", "likely_causes"],
    warn_fields: [],
    warn_sections: [],
  },
  "flame-signature": {
    hard_fields: [
      "entry_kind",
      "db",
      "platform",
      "scope",
      "signature_type",
      "match_layer",
      "title",
      "pattern_regex",
      "source_url",
      "source_authority",
      "source_url_lang",
    ],
    hard_sections: ["pattern_quote", "mechanism_quote", "workload_implication_quote"],
    warn_fields: [],
    warn_sections: [],
  },
  "best-practice": {
    hard_fields: [
      "entry_kind",
      "db",
      "platform",
      "scope",
      "case_pattern",
      "title",
      "recommendation_layer",
      "risk_severity",
      "source_url",
      "source_authority",
      "source_url_lang",
    ],
    hard_sections: [],
    // recommendation_value:定性建议(如"应配合 maxTimeMS")无 numeric value · 是 N/A
    // scenario_description_quote / recommendation_quote:配置型源(参数清单)无 narrative · 是 N/A
    warn_fields: ["recommendation_value"],
    warn_sections: ["scenario_description_quote", "recommendation_quote"],
  },
};

// ---- 解析器 ----

function parseCases(path: string): ParsedCase[] {
  const lines = readFileSync(path, "utf8").split("\n");
  const cases: ParsedCase[] = [];
  let cur: ParsedCase | null = null;
  let curSection: string | null = null;
  let sectionBuf: string[] = [];

  function flushSection() {
    if (cur && curSection) {
      cur.section_bodies[curSection] = sectionBuf.join("\n").trim();
    }
    curSection = null;
    sectionBuf = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const headerMatch = line.match(/^## case_id:\s*(\S+)\s*$/);
    if (headerMatch) {
      flushSection();
      if (cur) cases.push(cur);
      cur = {
        case_id: headerMatch[1],
        line_no: i + 1,
        fields: {},
        sections: new Set(),
        section_bodies: {},
      };
      continue;
    }
    if (!cur) continue;

    const fieldMatch = line.match(/^- \*\*([a-zA-Z0-9_]+)\*\*:\s*(.*)$/);
    if (fieldMatch) {
      flushSection();
      cur.fields[fieldMatch[1]] = fieldMatch[2].trim();
      continue;
    }

    const sectionMatch = line.match(/^### ([a-zA-Z0-9_]+)\s*$/);
    if (sectionMatch) {
      flushSection();
      cur.sections.add(sectionMatch[1]);
      curSection = sectionMatch[1];
      continue;
    }

    if (curSection) sectionBuf.push(line);
  }
  flushSection();
  if (cur) cases.push(cur);
  return cases;
}

// ---- check ----

interface CheckedCase {
  case_id: string;
  entry_kind: string;
  source_file: string;
  hard_missing: string[];
  warn_missing: string[];
}

function checkCase(c: ParsedCase, sourceFile: string): CheckedCase | null {
  const kind = c.fields.entry_kind || "";
  const schema = REQUIRED[kind];
  if (!schema) {
    return {
      case_id: c.case_id,
      entry_kind: kind || "(unknown)",
      source_file: sourceFile,
      hard_missing: [`entry_kind=${kind || "(missing)"} · 不在已知 schema (diagnostic-flow / flame-signature / best-practice)`],
      warn_missing: [],
    };
  }
  const hard_missing: string[] = [];
  const warn_missing: string[] = [];

  for (const f of schema.hard_fields) {
    const v = c.fields[f];
    if (v === undefined) hard_missing.push(`field:${f}`);
    else if (v.trim().length === 0) hard_missing.push(`field:${f}(empty)`);
  }
  for (const s of schema.hard_sections) {
    if (!c.sections.has(s)) hard_missing.push(`section:${s}`);
    else if ((c.section_bodies[s] || "").length === 0) hard_missing.push(`section:${s}(empty)`);
  }
  for (const f of schema.warn_fields) {
    const v = c.fields[f];
    if (v === undefined) warn_missing.push(`field:${f}`);
    else if (v.trim().length === 0) warn_missing.push(`field:${f}(empty)`);
  }
  for (const s of schema.warn_sections) {
    if (!c.sections.has(s)) warn_missing.push(`section:${s}`);
    else if ((c.section_bodies[s] || "").length === 0) warn_missing.push(`section:${s}(empty)`);
  }

  if (hard_missing.length === 0 && warn_missing.length === 0) return null;
  return {
    case_id: c.case_id,
    entry_kind: kind,
    source_file: sourceFile,
    hard_missing,
    warn_missing,
  };
}

// ---- 跑 + 写报告 ----

const casesAll = [
  ...parseCases(resolve(DATA_DIR, "cases/CASES.md")).map((c) => ({ c, src: "data/cases/CASES.md" })),
  ...parseCases(resolve(DATA_DIR, "best-practice/CASES.md")).map((c) => ({ c, src: "data/best-practice/CASES.md" })),
];

const all_checked: CheckedCase[] = [];
for (const { c, src } of casesAll) {
  const r = checkCase(c, src);
  if (r) all_checked.push(r);
}

const hardFailed = all_checked.filter((c) => c.hard_missing.length > 0);
const warnOnly = all_checked.filter((c) => c.hard_missing.length === 0 && c.warn_missing.length > 0);

const total = casesAll.length;
const hardFailCount = hardFailed.length;
const warnCount = warnOnly.length;
const passedCount = total - hardFailCount;
const hardMissingFieldsCount = hardFailed.reduce((a, f) => a + f.hard_missing.length, 0);
const warnMissingFieldsCount = all_checked.reduce((a, f) => a + f.warn_missing.length, 0);

const report = {
  generated_at: new Date().toISOString(),
  summary: {
    total,
    passed: passedCount,
    hard_failed: hardFailCount,
    warn_only: warnCount,
    hard_missing_fields_count: hardMissingFieldsCount,
    warn_missing_fields_count: warnMissingFieldsCount,
    by_entry_kind: (() => {
      const m: Record<string, { total: number; hard_failed: number; warn_only: number }> = {};
      for (const { c } of casesAll) {
        const k = c.fields.entry_kind || "(unknown)";
        if (!m[k]) m[k] = { total: 0, hard_failed: 0, warn_only: 0 };
        m[k].total++;
      }
      for (const f of hardFailed) {
        if (!m[f.entry_kind]) m[f.entry_kind] = { total: 0, hard_failed: 0, warn_only: 0 };
        m[f.entry_kind].hard_failed++;
      }
      for (const f of warnOnly) {
        if (!m[f.entry_kind]) m[f.entry_kind] = { total: 0, hard_failed: 0, warn_only: 0 };
        m[f.entry_kind].warn_only++;
      }
      return m;
    })(),
  },
  required_schema: REQUIRED,
  hard_failed_cases: hardFailed,
  warn_only_cases: warnOnly,
};

before(() => {
  if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
});

describe("案例字段完整度 lint", () => {
  it(`总数 = 202(96 DF + 13 Flame + 93 BP)`, () => {
    assert.equal(total, 202, `case 总数 · 实际 ${total}`);
  });

  it("每条 case entry_kind 必须是已知的 3 种之一", () => {
    const unknown = casesAll
      .filter(({ c }) => !REQUIRED[c.fields.entry_kind || ""])
      .map(({ c }) => c.case_id);
    assert.equal(unknown.length, 0, `未知 entry_kind: ${unknown.join(", ")}`);
  });

  it(`所有 case hard required 字段非空(报告: ${REPORT_PATH})`, () => {
    if (hardFailed.length === 0) return;
    const head = hardFailed.slice(0, 10);
    const summary = head
      .map((f) => `  - ${f.case_id}(${f.entry_kind}): 缺 ${f.hard_missing.join(", ")}`)
      .join("\n");
    const more = hardFailed.length > 10 ? `\n  ... 共 ${hardFailed.length} 条 · 详见 JSON 报告` : "";
    assert.fail(
      `${hardFailed.length}/${total} case 缺失 hard required 字段 ·\n${summary}${more}`
    );
  });

  it(`warn-only 字段缺失统计(不 fail · 报告标记 · ${REPORT_PATH})`, () => {
    // 不 throw · 只 console.log 让 CI 看见
    if (warnOnly.length > 0) {
      console.log(
        `[warn-only] ${warnOnly.length} case 缺 warn 字段(总 ${warnMissingFieldsCount} 个) · 不 fail · 详见 JSON 报告`
      );
    }
  });
});
