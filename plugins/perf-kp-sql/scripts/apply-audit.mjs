#!/usr/bin/env node
/**
 * apply-audit · 把审计结果应用到 rules.json
 *
 * 输入:
 *   reports/audit-batches/all-results.json (subagent 验证结果)
 *   skills/perf-kp-sql/data/audit-citations-<TS>.json (原 audit 报告 · 拿 url_status / 原 literal)
 *   skills/perf-kp-sql/data/mongo/rules.json
 *   skills/perf-kp-sql/data/common/kunpeng-rules.json
 *
 * 输出 (in-place 改写):
 *   - 替换 source.quote (87 条 replacement_proposed)
 *   - 加字段 audit:
 *       {
 *         status: "verified_literal" | "verified_replaced" |
 *                 "unsupported" | "url_dead" |
 *                 "spa_unverifiable" | "page_truncated",
 *         pass: boolean,
 *         last_audited: "YYYY-MM-DD",
 *         notes?: string
 *       }
 *
 * 不删任何规则。
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const ROOT = process.cwd();
const TODAY = new Date().toISOString().slice(0, 10);

function loadJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

const subagentResults = loadJson(`${ROOT}/reports/audit-batches/all-results.json`);
const originalAuditPath = (() => {
  const dir = `${ROOT}/skills/perf-kp-sql/data`;
  const files = readdirSync(dir).filter(f => f.startsWith("audit-citations-") && f.endsWith(".json"));
  files.sort();
  return `${dir}/${files[files.length - 1]}`;
})();
const originalAudit = loadJson(originalAuditPath);

console.log(`[apply] subagent results: ${subagentResults.length}`);
console.log(`[apply] original audit: ${originalAudit.per_rule.length}`);

// 建立 rule_id → subagent result 索引
const subAgentByRule = new Map();
for (const r of subagentResults) subAgentByRule.set(r.rule_id, r);

// 建立 rule_id → original audit entry 索引
const origByRule = new Map();
for (const r of originalAudit.per_rule) origByRule.set(r.rule_id, r);

function classifySpaOrTruncated(url, notes) {
  if (url.includes("hikunpeng.com")) return "spa_unverifiable";
  if (url.includes("huaweicloud.com")) return "url_dead";
  if (notes && /truncat/i.test(notes)) return "page_truncated";
  if (url.includes("mongodb.com") && /configuration-options|reference\/parameters/.test(url)) return "page_truncated";
  return "page_truncated"; // safe default
}

function decideAudit(ruleId, ruleSource) {
  const sub = subAgentByRule.get(ruleId);
  if (sub) {
    if (sub.status === "literal_match") {
      return { status: "verified_literal", pass: true, notes: sub.notes };
    }
    if (sub.status === "replacement_proposed") {
      return { status: "verified_replaced", pass: true, new_quote: sub.new_quote, notes: sub.notes };
    }
    if (sub.status === "unsupported") {
      return { status: "unsupported", pass: false, notes: sub.notes ?? "page does not support this rule's claim" };
    }
    if (sub.status === "fetch_failed") {
      const cls = classifySpaOrTruncated(ruleSource.url ?? "", sub.notes ?? "");
      return { status: cls, pass: false, notes: sub.notes ?? "fetch failed; manual review needed" };
    }
  }
  // 不在 subagent batch · 说明是原审 literal_match 且未受 redirect 影响
  const orig = origByRule.get(ruleId);
  if (orig?.quote_match === "literal") {
    return { status: "verified_literal", pass: true };
  }
  if (orig?.quote_match === "url_dead") {
    return { status: "url_dead", pass: false, notes: "url returned 4xx/5xx during audit" };
  }
  return { status: "unknown", pass: false, notes: "missing from both subagent and original audit (bug)" };
}

function processRulesFile(path) {
  const rules = loadJson(path);
  if (!Array.isArray(rules)) {
    console.error(`[apply] expected array in ${path}, got object`);
    return { changed: 0 };
  }
  let changed = 0;
  let quoteReplaced = 0;
  for (const rule of rules) {
    const id = rule.id ?? rule.rule_id;
    if (!id) continue;
    const decision = decideAudit(id, rule.source ?? {});
    if (decision.new_quote && rule.source) {
      rule.source.quote = decision.new_quote;
      quoteReplaced++;
    }
    rule.audit = {
      status: decision.status,
      pass: decision.pass,
      last_audited: TODAY,
      ...(decision.notes ? { notes: decision.notes } : {}),
    };
    changed++;
  }
  writeFileSync(path, JSON.stringify(rules, null, 2) + "\n");
  console.log(`[apply] ${path}: changed=${changed} · quote_replaced=${quoteReplaced}`);
  return { changed, quoteReplaced };
}

const m = processRulesFile(`${ROOT}/skills/perf-kp-sql/data/mongo/rules.json`);
const k = processRulesFile(`${ROOT}/skills/perf-kp-sql/data/common/kunpeng-rules.json`);

// 汇总
console.log();
console.log(`[apply] total rules updated: ${m.changed + k.changed}`);
console.log(`[apply] total quotes replaced: ${m.quoteReplaced + k.quoteReplaced}`);

// status 分布
const allRules = [
  ...loadJson(`${ROOT}/skills/perf-kp-sql/data/mongo/rules.json`),
  ...loadJson(`${ROOT}/skills/perf-kp-sql/data/common/kunpeng-rules.json`),
];
const dist = {};
for (const r of allRules) {
  const s = r.audit?.status ?? "no_audit";
  dist[s] = (dist[s] || 0) + 1;
}
console.log();
console.log(`[apply] audit.status 分布:`);
for (const [s, n] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${s}: ${n}`);
}
const passCount = allRules.filter(r => r.audit?.pass).length;
console.log();
console.log(`[apply] audit.pass=true: ${passCount} / ${allRules.length} = ${(passCount / allRules.length * 100).toFixed(1)}%`);
