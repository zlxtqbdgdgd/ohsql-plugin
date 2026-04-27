#!/usr/bin/env node
/**
 * apply-phase1 · 三关全过的规则结构化为 _v2 写到 rules.json
 *
 * 输入:
 *   reports/cleanup/round2/gate3-result.json (subagent gate 3 verdict)
 *   reports/cleanup/round2/cleaned-v3.json (cleaner v3 输出)
 *
 * 处置:
 *   gate3 pass 的 → 写入 _v2.{when,checks,structuring_confidence,notes}
 *                  + 更新 audit.last_audited
 *   未通过的保留 _runtime_excluded(不入库)
 *
 * 入库信号(给 migrate-rules 用): `_v2.checks` 非空 + `audit.pass=true`
 * 不写 phaseX_* 阶段化字段 · 数据语言 ≠ 流程语言
 */

import { readFileSync, writeFileSync } from "node:fs";

const TODAY = "2026-04-26";

// 收集 5 条 gate3 pass
const gate3 = JSON.parse(readFileSync("reports/cleanup/round2/gate3-result.json", "utf8"));
const gate3Results = Array.isArray(gate3) ? gate3 : gate3.results || gate3;
const passedIds = new Set(gate3Results.filter((r) => r.verdict === "pass").map((r) => r.rule_id));
console.log(`Phase 1 gate3 pass: ${passedIds.size}`);

const cleaned = JSON.parse(readFileSync("reports/cleanup/round2/cleaned-v3.json", "utf8"));
const cleanedById = new Map(cleaned.map((r) => [r.rule_id, r]));

function processFile(path) {
  const rules = JSON.parse(readFileSync(path, "utf8"));
  let upgraded = 0;
  for (const rule of rules) {
    if (passedIds.has(rule.id)) {
      const v3 = cleanedById.get(rule.id);
      if (!v3) continue;
      rule._v2 = {
        when: v3.when || [],
        checks: v3.checks || [],
        structuring_confidence: v3.structuring_confidence,
        notes: v3.notes,
      };
      rule.audit = {
        ...(rule.audit || {}),
        pass: true,
        last_audited: TODAY,
      };
      delete rule._runtime_excluded;
      upgraded++;
    }
  }
  writeFileSync(path, JSON.stringify(rules, null, 2) + "\n");
  console.log(`[apply-phase1] ${path}: upgraded=${upgraded}`);
}

processFile("skills/perf-kp-sql/data/mongo/rules.json");
processFile("skills/perf-kp-sql/data/common/kunpeng-rules.json");

// 终态汇总
const all = [
  ...JSON.parse(readFileSync("skills/perf-kp-sql/data/mongo/rules.json", "utf8")),
  ...JSON.parse(readFileSync("skills/perf-kp-sql/data/common/kunpeng-rules.json", "utf8")),
];
const v2Loaded = all.filter((r) => r._v2?.checks?.length > 0 && r.audit?.pass).length;
const auditPass = all.filter((r) => r.audit?.pass).length;
const excluded = all.filter((r) => r._runtime_excluded).length;
console.log();
console.log("[apply-phase1] 终态:");
console.log(`  total: ${all.length}`);
console.log(`  audit.pass=true (URL/quote 验过): ${auditPass}`);
console.log(`  _v2.checks 非空 + audit.pass=true (运行时入库): ${v2Loaded}`);
console.log(`  _runtime_excluded: ${excluded}`);
