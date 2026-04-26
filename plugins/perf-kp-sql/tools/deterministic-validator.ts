/**
 * deterministic-validator · 机器硬验证器 · 0 LLM
 *
 * subagent QA 揪出 8 类 bug · 这里全部翻译成 deterministic check
 * 没办法用 LLM 判的最后一道关 · 100% 确定
 *
 * 8 类 bug:
 *   1. 逻辑矛盾(when vs check 同 metric 反向)
 *   2. 逻辑死区(when 多条件互斥 · 不可能同时成立)
 *   3. 聚合函数丢失(原 rate/avg/baseline · 结构化没保留)
 *   4. 字段路径不可执行(compute 无法 tokenize)
 *   5. metric 写命令字符串(`sysctl xxx` / `iostat` / `cat /etc/...`)
 *   6. op 方向反向(threshold "> X" 转成 lt)
 *   7. "默认值即告警"反向(eq default · 告警)
 *   8. 单位不一致(bytes ÷ MB 没换算)
 */

import { tokenize } from "../src/rule-engine-v2.js";

interface RawRule {
  id: string;
  reason?: string;
  threshold?: string;
  metric_expr?: string;
  source?: { quote?: string };
}

interface Check {
  compute?: string;
  metric?: string;
  op: string;
  value: any;
  unit?: string;
}

interface StructuredRule {
  rule_id: string;
  when?: Check[];
  checks: Check[];
}

export interface ValidationIssue {
  category: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  msg: string;
}

const OPS_INVERSE: Record<string, string> = {
  gt: "le", lt: "ge", ge: "lt", le: "gt",
  eq: "ne", ne: "eq",
  contains: "not_contains", not_contains: "contains",
};

function opsContradict(opA: string, opB: string, valA: any, valB: any): boolean {
  // when X eq V · check X eq V (same direction · 一致 · 不矛盾)
  if (opA === opB && String(valA) === String(valB)) return false;
  // when X eq V · check X ne V (互斥 · 永远不成立)
  if (OPS_INVERSE[opA] === opB && String(valA) === String(valB)) return true;
  // when X gt V · check X lt V or le V
  if (opA === "gt" && (opB === "lt" || opB === "le") && Number(valA) >= Number(valB)) return true;
  if (opA === "lt" && (opB === "gt" || opB === "ge") && Number(valA) <= Number(valB)) return true;
  // when X eq 0 · check X gt 0 (互斥)
  if (opA === "eq" && opB === "gt" && Number(valB) >= Number(valA)) return true;
  if (opA === "eq" && opB === "lt" && Number(valB) <= Number(valA)) return true;
  return false;
}

const COMMAND_PREFIXES = [
  "sysctl ", "iostat", "ulimit", "cat /", "ls /", "ps ", "free", "uname",
  "lscpu", "lsblk", "mount", "df ", "ip ", "netstat", "ss ", "top",
  "systemctl ", "service ", "journalctl", "dmesg", "ethtool", "numactl",
  "/etc/", "/proc/", "/sys/", "/var/",
];

function looksLikeCommand(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.includes(" ") && !trimmed.includes(".") && !trimmed.includes("(")) {
    // 命令式 · 含空格 · 不含 . (字段路径) · 不是函数调用
    return true;
  }
  return COMMAND_PREFIXES.some(p => trimmed.startsWith(p));
}

const AGG_FN_RE = /\b(rate|avg|sum|max|min|window|baseline_[a-z_]+|p\d+|percentile)\s*\(/i;

function hasAggFn(s: string | undefined | null): boolean {
  return !!s && AGG_FN_RE.test(s);
}

function checkExpr(c: Check): string {
  return c.compute ?? c.metric ?? "";
}

export function validate(rule: StructuredRule, raw: RawRule): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. 逻辑矛盾(when vs check 同 metric 反向)
  for (const w of rule.when ?? []) {
    for (const c of rule.checks) {
      const wKey = w.compute ?? w.metric;
      const cKey = c.compute ?? c.metric;
      if (wKey && cKey && wKey === cKey) {
        if (opsContradict(w.op, c.op, w.value, c.value)) {
          issues.push({
            category: 1,
            msg: `when ${wKey} ${w.op} ${w.value} 与 check ${cKey} ${c.op} ${c.value} 互斥 · 永不触发`,
          });
        }
      }
    }
  }

  // 2. 逻辑死区(when 多条件 · 同 metric 不同 contains 值)
  if (rule.when && rule.when.length >= 2) {
    const containsByMetric = new Map<string, string[]>();
    for (const w of rule.when) {
      if (w.op === "contains" && (w.compute ?? w.metric)) {
        const key = w.compute ?? w.metric!;
        if (!containsByMetric.has(key)) containsByMetric.set(key, []);
        containsByMetric.get(key)!.push(String(w.value));
      }
    }
    for (const [key, values] of containsByMetric.entries()) {
      if (values.length >= 2) {
        // 同字符串字段同时含两个不同子串可能成立(不绝对) · 但若全互斥单词 · 标 warn
        // 简单 heuristic: 若都是单词且长度 ≥ 3
        const wordLike = values.every(v => /^[a-zA-Z]+$/.test(v) && v.length >= 3);
        if (wordLike) {
          issues.push({
            category: 2,
            msg: `when 多条件: ${key} 同时 contains [${values.join(", ")}] · 可疑死区(同字段难同时含多互斥子串)`,
          });
        }
      }
    }
  }

  // 3. 聚合函数丢失(原 metric_expr 含 rate/avg/baseline · 结构化没保留)
  if (hasAggFn(raw.metric_expr) || hasAggFn(raw.threshold)) {
    const allExprs = [
      ...(rule.when ?? []).map(checkExpr),
      ...rule.checks.map(checkExpr),
    ].join(" ");
    if (!hasAggFn(allExprs)) {
      const m = raw.metric_expr?.match(AGG_FN_RE) ?? raw.threshold?.match(AGG_FN_RE);
      issues.push({
        category: 3,
        msg: `原表达式含聚合函数 ${m?.[1] ?? "?"} (...) · 结构化中丢失 · 语义不等价`,
      });
    }
  }

  // 4. 字段路径不可执行(compute 无法 tokenize)
  for (const c of rule.checks) {
    if (c.compute) {
      try {
        tokenize(c.compute);
      } catch (e: any) {
        issues.push({
          category: 4,
          msg: `compute "${c.compute.slice(0, 60)}" 无法解析: ${e?.message ?? "syntax error"}`,
        });
      }
    }
  }
  for (const w of rule.when ?? []) {
    if (w.compute) {
      try {
        tokenize(w.compute);
      } catch (e: any) {
        issues.push({
          category: 4,
          msg: `when compute "${w.compute.slice(0, 60)}" 无法解析: ${e?.message ?? "syntax error"}`,
        });
      }
    }
  }

  // 5. metric 写命令字符串
  for (const c of rule.checks) {
    const expr = c.metric ?? c.compute ?? "";
    if (looksLikeCommand(expr)) {
      issues.push({
        category: 5,
        msg: `check metric "${expr.slice(0, 60)}" 看起来是 shell 命令 · 不是字段路径`,
      });
    }
  }
  for (const w of rule.when ?? []) {
    const expr = w.metric ?? w.compute ?? "";
    if (looksLikeCommand(expr)) {
      issues.push({
        category: 5,
        msg: `when metric "${expr.slice(0, 60)}" 看起来是 shell 命令`,
      });
    }
  }

  // 6. op 方向反向(threshold "> X" 转成 lt 等)
  if (raw.threshold) {
    const t = raw.threshold;
    const expectedOp = t.match(/>=/) ? "ge"
      : t.match(/<=/) ? "le"
      : t.match(/>/) ? "gt"
      : t.match(/</) ? "lt"
      : t.match(/!=/) ? "ne"
      : t.match(/==/) ? "eq"
      : null;
    if (expectedOp) {
      const firstCheckOp = rule.checks[0]?.op;
      if (firstCheckOp && firstCheckOp !== expectedOp && OPS_INVERSE[firstCheckOp] === expectedOp) {
        issues.push({
          category: 6,
          msg: `原 threshold "${t}" 期望 op=${expectedOp} · 结构化用 ${firstCheckOp} (反向)`,
        });
      }
    }
  }

  // 7. (TODO · 难自动判) "默认值即告警"反向: 需要知道默认值是什么 · 暂跳过
  // 8. (TODO · 难自动判) 单位不一致: 单纯字段名很难推断 · 暂跳过

  return issues;
}

export function passes(rule: StructuredRule, raw: RawRule): { pass: boolean; issues: ValidationIssue[] } {
  const issues = validate(rule, raw);
  return { pass: issues.length === 0, issues };
}
