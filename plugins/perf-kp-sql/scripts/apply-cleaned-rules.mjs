#!/usr/bin/env node
/**
 * apply-cleaned-rules · 把 orchestrator 输出的 structured 规则写回 rules.json
 *
 * 输入: reports/cleanup/full-291-v2.json
 *       {
 *         passed: [{rule_id, original, structured: {when, checks, ...}, qa}],
 *         exhausted: [{rule_id, original}]
 *       }
 *
 * 处置:
 *   - passed → rules.json 里那条规则的 checks/when 替换为结构化版本
 *             加 audit.structured_at + audit.qa_score
 *   - exhausted → 标 _runtime_excluded(暂时不加载 · 保留供 review)
 */

import { readFileSync, writeFileSync } from "node:fs";

const TODAY = "2026-04-26";

const cleanupResult = JSON.parse(readFileSync("reports/cleanup/full-291-v2.json", "utf8"));

const passedById = new Map();
for (const p of cleanupResult.passed) passedById.set(p.rule_id, p);

const exhaustedIds = new Set(cleanupResult.exhausted.map(e => e.rule_id));

function processFile(path) {
  const rules = JSON.parse(readFileSync(path, "utf8"));
  let updated = 0;
  let exhausted = 0;
  let untouched = 0;

  for (const rule of rules) {
    if (passedById.has(rule.id)) {
      const p = passedById.get(rule.id);
      const s = p.structured;

      // 把结构化结果写到 rule.checks 和 rule.when
      // 兼容旧 schema: 保留原 metric_expr / threshold 但加 _v2 字段
      rule._v2 = {
        when: s.when || [],
        checks: s.checks || [],
        structuring_confidence: s.structuring_confidence,
        notes: s.notes,
      };
      rule.audit = {
        ...(rule.audit || {}),
        v2_structured_at: TODAY,
        v2_qa_score: p.qa.score,
        v2_qa_round: p.qa.round,
      };
      // 不再 _runtime_excluded(如果之前是)
      delete rule._runtime_excluded;
      updated++;
    } else if (exhaustedIds.has(rule.id)) {
      rule.audit = {
        ...(rule.audit || {}),
        v2_structured_at: TODAY,
        v2_status: "exhausted_3rounds",
      };
      rule._runtime_excluded = true;
      exhausted++;
    } else {
      untouched++;
    }
  }

  writeFileSync(path, JSON.stringify(rules, null, 2) + "\n");
  console.log(`[apply-v2] ${path}: updated=${updated} exhausted=${exhausted} untouched=${untouched}`);
}

processFile("skills/perf-kp-sql/data/mongo/rules.json");
processFile("skills/perf-kp-sql/data/common/kunpeng-rules.json");

console.log();
console.log(`[apply-v2] total passed: ${cleanupResult.passed.length}`);
console.log(`[apply-v2] total exhausted: ${cleanupResult.exhausted.length}`);
