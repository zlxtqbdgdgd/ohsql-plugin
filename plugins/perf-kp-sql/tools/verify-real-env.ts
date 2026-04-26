#!/usr/bin/env node
/**
 * verify-real-env · 真环境验证规则的字段路径是否存在
 *
 * 用法:
 *   # 模式 A · SSH 真连
 *   node tools/verify-real-env.ts \
 *        --rules <cleaned.json> \
 *        --host <ip> --user <u> --password <pw> \
 *        --mongo-user <u> --mongo-password <pw> \
 *        --output <verified.json>
 *
 *   # 模式 B · 用预存 fixture(开发/调试)
 *   node tools/verify-real-env.ts \
 *        --rules <cleaned.json> \
 *        --fixture <serverStatus.json> \
 *        --output <verified.json>
 *
 * 验证内容:
 *   1. 每条 rule 的 metric/compute 引用的字段路径在真 mongo 数据里能找到吗
 *   2. compute 表达式能算出有限值吗(rule-engine v2 evaluator)
 *   3. when 条件求值不报错吗
 *
 * 输出:
 *   {
 *     summary: { total, fields_resolved, compute_evaluable, ready_to_ship },
 *     verdicts: [{ rule_id, verdict: "pass" | "field_missing" | "compute_error" | "type_mismatch", details }]
 *   }
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";
import {
  resolveField,
  evalCompute,
  evaluateRule,
  type RuleV2,
} from "../skills/perf-kp-sql/src/rule-engine-v2.js";

interface VerificationVerdict {
  rule_id: string;
  verdict: "pass" | "field_missing" | "compute_error" | "type_mismatch" | "skipped";
  fields_checked: string[];
  fields_missing: string[];
  details?: string;
}

function collectFieldPaths(rule: any): string[] {
  const paths = new Set<string>();
  const allChecks = [...(rule.when ?? []), ...(rule.checks ?? [])];
  for (const c of allChecks) {
    if (c.metric) paths.add(c.metric);
    if (c.compute) {
      // 提取 compute 里的字段路径(简单 regex · 不 100% 但够用)
      const matches = c.compute.matchAll(/[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*|\['[^']+'\]|\["[^"]+"\])*/g);
      for (const m of matches) {
        const tok = m[0];
        // 跳过函数名
        if (["max", "min", "safe_divide", "abs"].includes(tok)) continue;
        // 跳过纯数字(不可能但防万一)
        if (/^\d/.test(tok)) continue;
        paths.add(tok);
      }
    }
  }
  return [...paths];
}

function fetchRealMetrics(opts: {
  host: string; user: string; password: string;
  mongoUser?: string; mongoPassword?: string;
  mongoPort?: number; sshPort?: number;
}): any {
  const sshArgs = `-o StrictHostKeyChecking=no -o BatchMode=no -p ${opts.sshPort ?? 22}`;
  const mongoAuth = opts.mongoUser && opts.mongoPassword
    ? `-u ${opts.mongoUser} -p ${opts.mongoPassword} --authenticationDatabase admin`
    : "";
  const eval_ = `JSON.stringify({serverStatus: db.serverStatus(), hostInfo: db.hostInfo(), getCmdLineOpts: db.adminCommand({getCmdLineOpts: 1}), buildInfo: db.serverBuildInfo ? db.serverBuildInfo() : null})`;
  const cmd = `sshpass -p '${opts.password}' ssh ${sshArgs} ${opts.user}@${opts.host} "mongosh --quiet --port ${opts.mongoPort ?? 27017} ${mongoAuth} --eval '${eval_}'"`;
  const stdout = execSync(cmd, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  // 取 JSON 部分(mongosh 输出可能含横幅)
  const jsonStart = stdout.indexOf("{");
  return JSON.parse(stdout.slice(jsonStart));
}

function verifyOne(rule: RuleV2, metrics: any): VerificationVerdict {
  const fields = collectFieldPaths(rule);
  const missing: string[] = [];
  for (const path of fields) {
    const v = resolveField(metrics, path);
    if (v === undefined) missing.push(path);
  }

  if (missing.length > 0) {
    return {
      rule_id: rule.rule_id,
      verdict: "field_missing",
      fields_checked: fields,
      fields_missing: missing,
      details: `${missing.length}/${fields.length} 字段在 serverStatus/hostInfo/getCmdLineOpts 中找不到`,
    };
  }

  // 真跑 evaluator(metrics 永不可能完全匹配 · 关心是否 error 而非 fire)
  try {
    const result = evaluateRule(rule, metrics);
    if (result.status === "error") {
      return {
        rule_id: rule.rule_id,
        verdict: "compute_error",
        fields_checked: fields,
        fields_missing: [],
        details: result.error,
      };
    }
    return {
      rule_id: rule.rule_id,
      verdict: "pass",
      fields_checked: fields,
      fields_missing: [],
      details: `runtime OK · status=${result.status}`,
    };
  } catch (e: any) {
    return {
      rule_id: rule.rule_id,
      verdict: "compute_error",
      fields_checked: fields,
      fields_missing: [],
      details: e?.message ?? String(e),
    };
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      rules: { type: "string" },
      output: { type: "string" },
      fixture: { type: "string", default: "" },
      host: { type: "string", default: "" },
      user: { type: "string", default: "" },
      password: { type: "string", default: "" },
      "mongo-user": { type: "string", default: "" },
      "mongo-password": { type: "string", default: "" },
      "mongo-port": { type: "string", default: "27017" },
      "ssh-port": { type: "string", default: "22" },
    },
  });

  if (!values.rules || !values.output) {
    console.error("usage: verify-real-env.ts --rules <cleaned.json> --output <verified.json>");
    console.error("       (--fixture <path> | --host <h> --user <u> --password <p>)");
    process.exit(1);
  }

  const rulesIn = JSON.parse(readFileSync(values.rules!, "utf8"));
  // 输入可能是 [{rule_id, structured}] 或直接结构化对象列表
  const rules: RuleV2[] = rulesIn.map((r: any) => {
    if (r.structured) return r.structured;
    return r;
  });

  // 拿真 metrics
  let metrics: any;
  if (values.fixture && existsSync(values.fixture)) {
    metrics = JSON.parse(readFileSync(values.fixture, "utf8"));
    console.log(`[verify] using fixture: ${values.fixture}`);
  } else if (values.host && values.user) {
    console.log(`[verify] connecting to ${values.user}@${values.host}...`);
    metrics = fetchRealMetrics({
      host: values.host!,
      user: values.user!,
      password: values.password!,
      mongoUser: values["mongo-user"] || undefined,
      mongoPassword: values["mongo-password"] || undefined,
      mongoPort: parseInt(values["mongo-port"] || "27017", 10),
      sshPort: parseInt(values["ssh-port"] || "22", 10),
    });
    console.log(`[verify] fetched serverStatus/hostInfo/getCmdLineOpts`);
  } else {
    console.error("either --fixture or --host/--user/--password required");
    process.exit(1);
  }

  // 跑验证
  const verdicts: VerificationVerdict[] = [];
  for (const rule of rules) {
    verdicts.push(verifyOne(rule, metrics));
  }

  const summary = {
    total: verdicts.length,
    pass: verdicts.filter(v => v.verdict === "pass").length,
    field_missing: verdicts.filter(v => v.verdict === "field_missing").length,
    compute_error: verdicts.filter(v => v.verdict === "compute_error").length,
    skipped: verdicts.filter(v => v.verdict === "skipped").length,
  };

  writeFileSync(values.output!, JSON.stringify({ summary, verdicts }, null, 2));
  console.log();
  console.log("=== 真环境验证报告 ===");
  console.log(`total:          ${summary.total}`);
  console.log(`✅ pass:         ${summary.pass}`);
  console.log(`❌ field_missing: ${summary.field_missing}`);
  console.log(`❌ compute_error: ${summary.compute_error}`);
  console.log(`⏸ skipped:      ${summary.skipped}`);
  console.log();
  console.log(`output: ${values.output}`);
}

main().catch(e => { console.error(e); process.exit(1); });
