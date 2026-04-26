#!/usr/bin/env node
/**
 * triple-gate · 跑 3 道关 · 输出每条规则的综合 verdict
 *
 * Gate 1 静态: deterministic-validator 检 8 类 bug
 * Gate 2 真环境: 字段路径在真 mongo 存在 + compute 跑得通
 * Gate 3 跨模型 QA: subagent (留给后续脚本)
 *
 * 输入:
 *   --rules <cleaned.json>   (rule_id + when + checks ...)
 *   --raw <rules.json>       (原 metric_expr/threshold/reason 用于 gate 1)
 *   --fixture <real-env.json>
 *
 * 输出 <triple-gate.json>:
 *   {
 *     summary: { gate1_pass, gate2_pass, both_pass, gated_out },
 *     verdicts: [{rule_id, gate1, gate2, both_pass, issues}]
 *   }
 */

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { validate } from "../skills/perf-kp-sql/tools/deterministic-validator.js";
import {
  resolveField,
  evaluateRule,
  type RuleV2,
} from "../skills/perf-kp-sql/src/rule-engine-v2.js";

interface Verdict {
  rule_id: string;
  gate1_static: { pass: boolean; issues: string[] };
  gate2_real_env: { pass: boolean; fields_missing: string[]; details?: string };
  both_pass: boolean;
}

function collectFields(rule: any): string[] {
  const out = new Set<string>();
  const FIELD_RE = /[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*|\['[^']+'\]|\["[^"]+"\]|\[\d+\])*/g;
  for (const c of [...(rule.when ?? []), ...(rule.checks ?? [])]) {
    if (c.metric) out.add(c.metric);
    if (c.compute) {
      for (const m of c.compute.matchAll(FIELD_RE)) {
        const tok = m[0];
        if (["max", "min", "safe_divide", "abs"].includes(tok)) continue;
        if (/^\d/.test(tok)) continue;
        out.add(tok);
      }
    }
  }
  return [...out];
}

const { values } = parseArgs({
  options: {
    rules: { type: "string" },
    raw: { type: "string" },
    fixture: { type: "string" },
    output: { type: "string" },
  },
});

const cleaned = JSON.parse(readFileSync(values.rules!, "utf8"));
const raw = JSON.parse(readFileSync(values.raw!, "utf8"));
const fixture = JSON.parse(readFileSync(values.fixture!, "utf8"));
const rawById = new Map<string, any>(raw.map((r: any) => [r.id, r]));

const verdicts: Verdict[] = [];

for (const rule of cleaned) {
  const rawRule = rawById.get(rule.rule_id);
  if (!rawRule) continue;

  // Gate 1 · 静态
  const issues = validate(rule, rawRule);
  const gate1Pass = issues.length === 0;

  // 跳过空规则(structuring_confidence=0)
  const isEmpty = (!rule.checks || rule.checks.length === 0);
  if (isEmpty) {
    verdicts.push({
      rule_id: rule.rule_id,
      gate1_static: { pass: false, issues: ["empty checks (structuring_confidence=0)"] },
      gate2_real_env: { pass: false, fields_missing: [], details: "empty rule" },
      both_pass: false,
    });
    continue;
  }

  // Gate 2 · 真环境
  const fields = collectFields(rule);
  const missing = fields.filter(p => resolveField(fixture, p) === undefined);
  let gate2Pass = false;
  let gate2Details: string | undefined;
  if (missing.length === 0) {
    try {
      const r = evaluateRule(rule as RuleV2, fixture);
      if (r.status === "error") {
        gate2Details = `compute_error: ${r.error}`;
      } else {
        gate2Pass = true;
        gate2Details = `runtime OK · status=${r.status}`;
      }
    } catch (e: any) {
      gate2Details = `eval_throw: ${e?.message ?? String(e)}`;
    }
  } else {
    gate2Details = `${missing.length}/${fields.length} fields missing`;
  }

  verdicts.push({
    rule_id: rule.rule_id,
    gate1_static: { pass: gate1Pass, issues: issues.map(i => `${i.category}:${i.msg}`) },
    gate2_real_env: { pass: gate2Pass, fields_missing: missing, details: gate2Details },
    both_pass: gate1Pass && gate2Pass,
  });
}

const summary = {
  total: verdicts.length,
  gate1_pass: verdicts.filter(v => v.gate1_static.pass).length,
  gate2_pass: verdicts.filter(v => v.gate2_real_env.pass).length,
  both_pass: verdicts.filter(v => v.both_pass).length,
};

writeFileSync(values.output!, JSON.stringify({ summary, verdicts }, null, 2));

console.log("=== Triple-gate 结果 ===");
console.log(`total:        ${summary.total}`);
console.log(`gate1 静态:   ${summary.gate1_pass}`);
console.log(`gate2 真环境: ${summary.gate2_pass}`);
console.log(`both pass:    ${summary.both_pass} ← 进 gate3 subagent QA`);
console.log();
console.log(`output: ${values.output}`);
