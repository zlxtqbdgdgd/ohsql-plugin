// Phase 1 · M3 Layer 1: distill-v2 cases md 解析器
//
// cli-kb.ts 入库前必须解析:
//   1. parseFrontmatter(content) → { fm: yaml object, body: string }
//   2. splitCases(body) → [{ caseId, content }] (按 ## case_id 切块)
//   3. parseCaseFields(content) → fields/quotes (从 | k | v | + #### quote 块)
//   4. assembleBpData / assembleDfData / assembleFlameData → entry_kind 专属 JSON
//
// 红用例 · M3 实现 src/cli-kb/parser.ts 让其转绿。

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  parseFrontmatter,
  splitCases,
  parseCaseFields,
  assembleBestPracticeData,
  assembleDiagnosticFlowData,
  assembleFlameSignatureData,
} from "../../src/cli-kb/parser.js";

const FIXTURE_BP = resolve(
  __dirname,
  "../../../../../docs/data/distill-v2/cases/_common/best-practice/www.mongodb.com__docs__manual__administration__production-notes.md",
);
const FIXTURE_DF = resolve(
  __dirname,
  "../../../../../docs/data/distill-v2/cases/mongodb/diagnostic-flow/www.mongodb.com__docs__manual__administration__production-notes.md",
);
const FIXTURE_FLAME = resolve(
  __dirname,
  "../../../../../docs/data/distill-v2/cases/_common/flame-signature/www.brendangregg.com__FlameGraphs__cpuflamegraphs.md",
);

describe("parseFrontmatter", () => {
  it("提取 yaml frontmatter · 留 body", () => {
    const content = readFileSync(FIXTURE_BP, "utf8");
    const { fm, body } = parseFrontmatter(content);
    assert.equal(fm.entry_kind, "best-practice");
    assert.equal(fm.database, null);
    assert.equal(fm.platform, "bare");
    assert.equal(fm.source_url, "https://www.mongodb.com/docs/manual/administration/production-notes/");
    assert.equal(fm.source_authority, "official");
    assert.ok(Array.isArray(fm.inferred_fields));
    assert.ok(body.startsWith("\n#") || body.startsWith("#"), "body 应该以 markdown # 开头");
  });
});

describe("splitCases", () => {
  it("按 ## case_id 切多个 case (production-notes BP 应有 15 条)", () => {
    const content = readFileSync(FIXTURE_BP, "utf8");
    const { body } = parseFrontmatter(content);
    const cases = splitCases(body);
    assert.equal(cases.length, 15);
    for (const c of cases) {
      assert.ok(c.caseId.length > 0);
      assert.ok(c.content.includes("## case_id:"));
    }
  });

  it("DF production-notes 应有 6 个 case", () => {
    const content = readFileSync(FIXTURE_DF, "utf8");
    const { body } = parseFrontmatter(content);
    const cases = splitCases(body);
    assert.equal(cases.length, 6);
  });

  it("Flame brendangregg cpu 只有 1 case", () => {
    const content = readFileSync(FIXTURE_FLAME, "utf8");
    const { body } = parseFrontmatter(content);
    const cases = splitCases(body);
    assert.equal(cases.length, 1);
  });
});

describe("parseCaseFields", () => {
  it("抓 | field | value | 表行 + #### quote 块", () => {
    const content = readFileSync(FIXTURE_BP, "utf8");
    const { body } = parseFrontmatter(content);
    const cases = splitCases(body);
    const tcpKa = cases.find((c) => c.caseId.includes("tcp-keepalive-time"));
    assert.ok(tcpKa, "应当含 tcp_keepalive_time case");
    const { fields, quotes } = parseCaseFields(tcpKa.content);
    assert.equal(fields.get("scope"), "linux-net");
    assert.equal(fields.get("recommendation_value"), "`net.ipv4.tcp_keepalive_time = 120`");
    assert.equal(fields.get("recommendation_layer"), "os-sysctl");
    assert.match(quotes.get("recommendation_quote") || "", /tcp_keepalive_time/);
  });
});

describe("assembleBestPracticeData", () => {
  it("装配出含 scenario/recommendation/rationale/risk 的完整 JSON", () => {
    const content = readFileSync(FIXTURE_BP, "utf8");
    const { fm, body } = parseFrontmatter(content);
    const cases = splitCases(body);
    const tcpKa = cases.find((c) => c.caseId.includes("tcp-keepalive-time"));
    const data = assembleBestPracticeData(tcpKa, fm);

    assert.ok(data.scenario);
    assert.ok(data.scenario.description_quote);
    assert.match(data.scenario.description_quote, /TCP keepalive value is greater/);

    assert.ok(data.recommendation);
    assert.equal(data.recommendation.layer, "os-sysctl");
    assert.match(data.recommendation.value, /tcp_keepalive_time/);

    assert.ok(data.risk);
    assert.equal(data.risk.severity, "warning");

    // rationale_quote 是 NULL · rationale_zh 兜底
    assert.equal(data.rationale.quote, null);
    assert.ok(data.rationale.zh && data.rationale.zh.length > 0);
  });
});

describe("assembleDiagnosticFlowData", () => {
  it("装配出 symptom + diagnostic_steps[] + likely_causes 的完整 JSON", () => {
    const content = readFileSync(FIXTURE_DF, "utf8");
    const { fm, body } = parseFrontmatter(content);
    const cases = splitCases(body);
    const k619 = cases.find((c) => c.caseId.includes("kernel-6-19"));
    assert.ok(k619, "应当含 kernel 6.19 case");
    const data = assembleDiagnosticFlowData(k619, fm);

    assert.equal(data.engine, "mongodb");
    assert.equal(data.symptom_category, "startup-failure");

    assert.ok(data.symptom.description_quote);
    assert.ok(Array.isArray(data.symptom.keywords));

    assert.ok(Array.isArray(data.diagnostic_steps));
    assert.ok(data.diagnostic_steps.length >= 1);
    assert.equal(data.diagnostic_steps[0].step_no, 1);
    assert.ok(data.diagnostic_steps[0].metric_name);

    assert.ok(data.likely_causes);
    assert.ok(Array.isArray(data.likely_causes.parameter_causes));
    assert.ok(Array.isArray(data.likely_causes.non_parameter_causes));
  });
});

describe("assembleFlameSignatureData", () => {
  it("装配出 pattern_regex + mechanism + workload_implication + tuning_directions[] 的完整 JSON", () => {
    const content = readFileSync(FIXTURE_FLAME, "utf8");
    const { fm, body } = parseFrontmatter(content);
    const cases = splitCases(body);
    const c = cases[0];
    const data = assembleFlameSignatureData(c, fm);

    assert.equal(data.signature_type, "stack-pattern");
    assert.match(data.pattern_regex, /sys_newfstatat|sys_getdents/);
    assert.equal(data.match_layer, "stack-frame-pattern");

    assert.ok(data.pattern_quote);
    assert.ok(data.mechanism.quote);
    assert.ok(data.mechanism.zh);
    assert.equal(data.mechanism.quote_lang, "en");

    assert.ok(data.workload_implication.quote);

    assert.ok(Array.isArray(data.tuning_directions));
    assert.ok(data.tuning_directions.length >= 1);
    assert.equal(data.tuning_directions[0].direction_no, 1);
  });
});
