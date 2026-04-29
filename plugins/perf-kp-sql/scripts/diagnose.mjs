#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath as __fileURLToPath } from "url";
import { dirname as __pathDirname } from "path";
const require = createRequire(import.meta.url);

// plugins/perf-kp-sql/src/cli-diagnose/index.ts
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

// plugins/perf-kp-sql/src/cli-diagnose/types.ts
function flattenConfigDump(cd) {
  const out = [];
  for (const sec of Object.values(cd)) {
    if (sec && typeof sec === "object") {
      for (const [k, v] of Object.entries(sec)) {
        out.push([k, v]);
      }
    }
  }
  return out;
}

// plugins/perf-kp-sql/src/cli-diagnose/match-bp.ts
function valueMatches(current, recommendation) {
  if (!recommendation) return "skip";
  const rec = String(recommendation).trim();
  if (/\(NULL|RAM|GB\)|max\(|min\(|TBD|N\/A|\.\.\./i.test(rec)) return "skip";
  if (rec.length === 0) return "skip";
  const cur = String(current).trim();
  if (rec === cur) return true;
  if (/^\d+(\.\d+)?$/.test(cur) && /^\d+(\.\d+)?$/.test(rec)) {
    return Number(cur) === Number(rec);
  }
  if (rec.includes(cur)) return true;
  return false;
}
function matchBpRecommendations(db, snapshot) {
  const out = [];
  const params = flattenConfigDump(snapshot.config_dump);
  if (params.length === 0) return out;
  const stmt = db.prepare(`
    SELECT c.case_id, c.entry_kind, c.bucket, c.scope, c.database,
           c.title, c.source_url, c.source_authority, c.best_practice_data
    FROM cases c
    INNER JOIN case_param_names cp ON cp.case_id = c.case_id
    WHERE cp.param_name = ?
      AND cp.param_role = 'recommendation'
      AND c.entry_kind = 'best-practice'
  `);
  const seen = /* @__PURE__ */ new Set();
  for (const [paramName, currentValue] of params) {
    const rows = stmt.all(paramName);
    for (const row of rows) {
      const key = `${paramName}::${row.case_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const data = JSON.parse(row.best_practice_data ?? "{}");
      const recValue = data.recommendation?.value ?? null;
      const m = valueMatches(currentValue, recValue);
      if (m === true) continue;
      if (m === "skip") continue;
      const severity = data.risk?.severity ?? "warning";
      const reason = data.rationale?.zh ?? data.risk?.zh ?? `\u73B0\u573A ${paramName}=${currentValue} \u504F\u79BB BP \u63A8\u8350 ${recValue ?? "(NULL)"}`;
      out.push({
        path: "A",
        case_id: row.case_id,
        title: row.title,
        entry_kind: "best-practice",
        bucket: row.bucket,
        scope: row.scope,
        database: row.database,
        source_url: row.source_url,
        source_authority: row.source_authority,
        severity,
        current_value: currentValue == null ? null : currentValue,
        recommended_value: recValue,
        reason_zh: reason,
        data
      });
    }
  }
  return out;
}

// plugins/perf-kp-sql/src/cli-diagnose/match-df.ts
function findCauseByParam(data, paramName) {
  return data.likely_causes?.parameter_causes?.find((c) => c.param_name === paramName);
}
function matchDfCauses(db, snapshot) {
  const out = [];
  const params = flattenConfigDump(snapshot.config_dump);
  if (params.length === 0) return out;
  const stmt = db.prepare(`
    SELECT c.case_id, c.entry_kind, c.bucket, c.scope, c.database,
           c.title, c.source_url, c.source_authority, c.diagnostic_flow_data
    FROM cases c
    INNER JOIN case_param_names cp ON cp.case_id = c.case_id
    WHERE cp.param_name = ?
      AND cp.param_role = 'cause'
      AND c.entry_kind = 'diagnostic-flow'
  `);
  const seen = /* @__PURE__ */ new Set();
  for (const [paramName, currentValue] of params) {
    const rows = stmt.all(paramName);
    for (const row of rows) {
      const key = `${paramName}::${row.case_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const data = JSON.parse(row.diagnostic_flow_data);
      const cause = findCauseByParam(data, paramName);
      if (!cause) continue;
      const abnormalPattern = cause.abnormal_value_pattern ?? null;
      const reasoning = cause.reasoning_quote ?? null;
      out.push({
        path: "B",
        case_id: row.case_id,
        title: row.title,
        entry_kind: "diagnostic-flow",
        bucket: row.bucket,
        scope: row.scope,
        database: row.database,
        source_url: row.source_url,
        source_authority: row.source_authority,
        severity: "warning",
        current_value: currentValue == null ? null : currentValue,
        recommended_value: null,
        reason_zh: reasoning ?? abnormalPattern ?? `\u73B0\u573A ${paramName}=${currentValue} \u89E6\u53D1 DF likely_cause: ${cause.title}`,
        data
      });
    }
  }
  return out;
}

// plugins/perf-kp-sql/src/cli-diagnose/match-flame.ts
var DEFAULT_HOTNESS_THRESHOLD_PCT = 5;
function matchFlameSignatures(db, snapshot) {
  const out = [];
  const stacks = snapshot.flamegraph_stacks ?? [];
  if (stacks.length === 0) return out;
  const totalSamples = stacks.reduce((a, s) => a + s.samples, 0);
  if (totalSamples === 0) return out;
  const rows = db.prepare(
    `SELECT case_id, entry_kind, bucket, scope, database, title, source_url, source_authority, flame_signature_data
       FROM cases WHERE entry_kind = 'flame-signature'`
  ).all();
  for (const row of rows) {
    const data = JSON.parse(row.flame_signature_data);
    if (!data.pattern_regex) continue;
    const regexSrc = data.pattern_regex.replace(/^`+|`+$/g, "").trim();
    if (!regexSrc) continue;
    let regex;
    try {
      regex = new RegExp(regexSrc);
    } catch {
      continue;
    }
    let matchedSamples = 0;
    for (const s of stacks) {
      const frames = s.stack.split(";");
      if (frames.some((f) => regex.test(f))) matchedSamples += s.samples;
    }
    const pct = matchedSamples / totalSamples * 100;
    if (pct < DEFAULT_HOTNESS_THRESHOLD_PCT) continue;
    out.push({
      path: "C",
      case_id: row.case_id,
      title: row.title,
      entry_kind: "flame-signature",
      bucket: row.bucket,
      scope: row.scope,
      database: row.database,
      source_url: row.source_url,
      source_authority: row.source_authority,
      severity: "warning",
      current_value: `${pct.toFixed(1)}%`,
      recommended_value: null,
      reason_zh: `flamegraph stack \u547D\u4E2D pattern_regex \`${data.pattern_regex}\` \xB7 \u5360\u603B\u91C7\u6837 ${pct.toFixed(1)}% (\u2265 ${DEFAULT_HOTNESS_THRESHOLD_PCT}%) \xB7 \u63D0\u793A ${data.workload_implication?.zh ?? data.mechanism?.zh ?? row.title}`,
      data
    });
  }
  return out;
}

// plugins/perf-kp-sql/src/cli-diagnose/match-local.ts
var DEFAULT_TOP_K = 10;
function escapeFts(q) {
  return q.replace(/[^A-Za-z0-9一-鿿\s_.\-]/g, " ").replace(/\s+/g, " ").trim();
}
function matchLocalFts(db, query, topK = DEFAULT_TOP_K) {
  const cleaned = escapeFts(query);
  if (!cleaned) return [];
  const ftsExpr = cleaned.split(/\s+/).filter(Boolean).map((t) => `"${t}"`).join(" OR ");
  if (!ftsExpr) return [];
  let rows;
  try {
    rows = db.prepare(
      `SELECT c.case_id, c.entry_kind, c.bucket, c.scope, c.database,
                c.title, c.source_url, c.source_authority,
                c.best_practice_data, c.diagnostic_flow_data, c.flame_signature_data,
                f.rank AS rank
         FROM cases_fts f
         INNER JOIN cases c ON c.case_id = f.case_id
         WHERE cases_fts MATCH ?
         ORDER BY f.rank
         LIMIT ?`
    ).all(ftsExpr, topK);
  } catch {
    return [];
  }
  return rows.map((row) => {
    const data = row.entry_kind === "best-practice" ? JSON.parse(row.best_practice_data ?? "{}") : row.entry_kind === "diagnostic-flow" ? JSON.parse(row.diagnostic_flow_data ?? "{}") : JSON.parse(row.flame_signature_data ?? "{}");
    return {
      path: "D",
      case_id: row.case_id,
      title: row.title,
      entry_kind: row.entry_kind,
      bucket: row.bucket,
      scope: row.scope,
      database: row.database,
      source_url: row.source_url,
      source_authority: row.source_authority,
      reason_zh: `\u81EA\u7136\u8BED\u8A00\u67E5\u8BE2 "${query}" \u547D\u4E2D (FTS5 rank ${row.rank.toFixed(2)})`,
      data
    };
  });
}

// plugins/perf-kp-sql/src/cli-diagnose/index.ts
function diagnose(args) {
  const db = new Database(args.dbPath, { readonly: true, fileMustExist: true });
  try {
    sqliteVec.load(db);
  } catch {
  }
  const matched = [
    ...matchBpRecommendations(db, args.snapshot),
    ...matchDfCauses(db, args.snapshot),
    ...matchFlameSignatures(db, args.snapshot)
  ];
  let rag_context = void 0;
  if (args.query && args.query.trim()) {
    rag_context = matchLocalFts(db, args.query);
  }
  db.close();
  return { matched, rag_context };
}

// plugins/perf-kp-sql/src/cli-diagnose.ts
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync as writeFileSync2, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// plugins/perf-kp-sql/src/cli-diagnose/match-nlm.ts
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
function callNotebookLm(args) {
  const { scriptPath, diagnoseResult, hwArch, timeoutMs = 6e5 } = args;
  if (!existsSync(scriptPath)) {
    return { ok: false, expansions: /* @__PURE__ */ new Map(), reason: "notebooklm.mjs \u672A\u5B89\u88C5(\u7531\u5BF9\u63A5 NotebookLM \u7684\u540C\u4E8B\u7EF4\u62A4 \xB7 \u5F53\u524D\u9636\u6BB5\u53EF\u9009)" };
  }
  const targets = diagnoseResult.matched.filter((r) => r.path !== "D");
  if (targets.length === 0) {
    return { ok: true, expansions: /* @__PURE__ */ new Map(), reason: "\u65E0 critical/warning \u547D\u4E2D \xB7 \u8DF3\u8FC7 NotebookLM" };
  }
  const tmpDir = mkdtempSync(join(tmpdir(), "diagnose-nlm-"));
  const inputFile = join(tmpDir, "diagnose-output.json");
  writeFileSync(inputFile, JSON.stringify({ matched: targets }));
  const spawnArgs = ["--op", "query-batch", "--from-diagnose", inputFile, "--json"];
  if (hwArch) spawnArgs.push("--hw-arch", hwArch);
  let result;
  try {
    result = spawnSync("node", [scriptPath, ...spawnArgs], {
      encoding: "utf8",
      timeout: timeoutMs
    });
  } catch (e) {
    rmSync(tmpDir, { recursive: true, force: true });
    return { ok: false, expansions: /* @__PURE__ */ new Map(), reason: `spawn \u5931\u8D25: ${e instanceof Error ? e.message : String(e)}` };
  }
  rmSync(tmpDir, { recursive: true, force: true });
  if (result.status !== 0) {
    const signal = result.signal ? ` \xB7 signal: ${result.signal}` : "";
    return {
      ok: false,
      expansions: /* @__PURE__ */ new Map(),
      reason: `notebooklm.mjs \u9000\u51FA\u7801 ${result.status}${signal} \xB7 stderr: ${(result.stderr ?? "").slice(0, 300)}`
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (e) {
    return { ok: false, expansions: /* @__PURE__ */ new Map(), reason: `\u89E3\u6790 stdout JSON \u5931\u8D25: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!parsed.ok) {
    return { ok: false, expansions: /* @__PURE__ */ new Map(), reason: "notebooklm.mjs \u8FD4\u56DE ok=false" };
  }
  const expansions = /* @__PURE__ */ new Map();
  for (const r of parsed.results ?? []) {
    expansions.set(r.case_id, {
      answer: r.answer,
      references: r.references,
      domain: r.domain,
      notebook_id: r.notebook_id
    });
  }
  return { ok: true, expansions };
}

// plugins/perf-kp-sql/src/report.ts
var AUTHORITY_ICON = {
  official: "\u2605",
  "community-canonical": "\u25C6",
  "vendor-doc": "\u25A0",
  "community-blog": "\u25CB",
  "code-comment": "\u25B2",
  unknown: "\xB7"
};
function escape(s) {
  if (s === null || s === void 0) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function authorityBadge(authority) {
  const icon = AUTHORITY_ICON[authority] ?? "\xB7";
  return `<span class="badge auth-${escape(authority)}">${icon} ${escape(authority)}</span>`;
}
function bucketLabel(bucket) {
  return {
    1: "\u786C\u4EF6",
    2: "OS",
    3: "\u5F15\u64CE\u914D\u7F6E",
    4: "\u8FD0\u884C\u65F6",
    5: "\u4E1A\u52A1"
  }[bucket] ?? `bucket-${bucket}`;
}
function severityBadge(severity) {
  if (!severity) return "";
  const cls = severity === "critical" ? "sev-critical" : "sev-warning";
  return `<span class="badge ${cls}">${escape(severity)}</span>`;
}
function expansionBlock(caseId, expansions) {
  const e = expansions?.get(caseId);
  if (!e) return "";
  const refs = (e.references ?? []).map((r) => `<li class="ref">${escape(r.cited_text)}</li>`).join("");
  return `
    <details class="nlm-expansion">
      <summary>\u24D8 NotebookLM \u6DF1\u5165\u5206\u6790</summary>
      <div class="nlm-answer">${escape(e.answer)}</div>
      ${refs ? `<ul class="nlm-refs">${refs}</ul>` : ""}
    </details>
  `;
}
function renderBpItem(r, expansions) {
  const cur = r.current_value == null ? "\u2014" : escape(r.current_value);
  const rec = r.recommended_value == null ? "\u2014" : escape(r.recommended_value);
  return `
    <div class="case bp">
      <div class="case-head">
        <span class="case-title">${escape(r.title)}</span>
        ${severityBadge(r.severity)}
        ${authorityBadge(r.source_authority)}
        <span class="badge bucket-${r.bucket}">${bucketLabel(r.bucket)}</span>
      </div>
      <div class="case-body">
        <div class="kv">
          <span class="k">\u73B0\u573A:</span>
          <code class="v current">${cur}</code>
          <span class="arrow">\u2192</span>
          <span class="k">\u63A8\u8350:</span>
          <code class="v recommended">${rec}</code>
        </div>
        <p class="reason">${escape(r.reason_zh)}</p>
        <div class="meta">
          <a href="${escape(r.source_url)}" target="_blank" class="src">${escape(r.source_url)}</a>
          <code class="case-id">${escape(r.case_id)}</code>
        </div>
        ${expansionBlock(r.case_id, expansions)}
      </div>
    </div>
  `;
}
function renderDfItem(r, expansions) {
  const data = r.data ?? {};
  const steps = (data.diagnostic_steps ?? []).slice(0, 3);
  const stepList = steps.map((s) => `<li>step ${s.step_no}: ${escape(s.title)}${s.metric_name ? ` <code>${escape(s.metric_name)}</code>` : ""}</li>`).join("");
  const pCauses = data.likely_causes?.parameter_causes ?? [];
  const causeList = pCauses.map(
    (c) => `<li><strong>${escape(c.title)}</strong>${c.param_name ? ` <code>${escape(c.param_name)}</code>` : ""}</li>`
  ).join("");
  return `
    <div class="case df">
      <div class="case-head">
        <span class="case-title">${escape(r.title)}</span>
        ${severityBadge(r.severity)}
        ${authorityBadge(r.source_authority)}
        <span class="badge bucket-${r.bucket}">${bucketLabel(r.bucket)}</span>
      </div>
      <div class="case-body">
        <p class="reason">${escape(r.reason_zh)}</p>
        ${stepList ? `<details><summary>\u8BCA\u65AD\u6B65\u9AA4</summary><ol class="steps">${stepList}</ol></details>` : ""}
        ${causeList ? `<details><summary>possible \u6839\u56E0</summary><ul class="causes">${causeList}</ul></details>` : ""}
        ${data.mitigation_quote ? `<blockquote class="mitigation">${escape(data.mitigation_quote)}</blockquote>` : ""}
        <div class="meta">
          <a href="${escape(r.source_url)}" target="_blank" class="src">${escape(r.source_url)}</a>
          <code class="case-id">${escape(r.case_id)}</code>
        </div>
        ${expansionBlock(r.case_id, expansions)}
      </div>
    </div>
  `;
}
function renderFlameItem(r, expansions) {
  const data = r.data ?? {};
  const directions = (data.tuning_directions ?? []).map(
    (d) => `<li>${escape(d.direction_quote ?? "")}${d.related_param_name ? ` <code>${escape(d.related_param_name)}</code>` : ""}</li>`
  ).join("");
  return `
    <div class="case flame">
      <div class="case-head">
        <span class="case-title">${escape(r.title)}</span>
        ${severityBadge(r.severity)}
        ${authorityBadge(r.source_authority)}
        <span class="badge bucket-${r.bucket}">${bucketLabel(r.bucket)}</span>
        ${r.current_value != null ? `<span class="badge hotness">${escape(r.current_value)}</span>` : ""}
      </div>
      <div class="case-body">
        <div class="kv">
          <span class="k">pattern:</span>
          <code class="v regex">${escape(data.pattern_regex ?? "")}</code>
        </div>
        <p class="reason">${escape(r.reason_zh)}</p>
        ${data.mechanism?.zh ? `<p class="mechanism">${escape(data.mechanism.zh)}</p>` : ""}
        ${data.workload_implication?.zh ? `<p class="implication">${escape(data.workload_implication.zh)}</p>` : ""}
        ${directions ? `<details><summary>\u8C03\u4F18\u65B9\u5411</summary><ul class="directions">${directions}</ul></details>` : ""}
        <div class="meta">
          <a href="${escape(r.source_url)}" target="_blank" class="src">${escape(r.source_url)}</a>
          <code class="case-id">${escape(r.case_id)}</code>
        </div>
        ${expansionBlock(r.case_id, expansions)}
      </div>
    </div>
  `;
}
var STYLES = `
<style>
  body { font: 14px/1.6 -apple-system,'Segoe UI',sans-serif; max-width: 980px; margin: 24px auto; padding: 0 16px; color: #222; }
  h1 { font-size: 22px; border-bottom: 2px solid #444; padding-bottom: 8px; }
  h2 { font-size: 18px; margin-top: 32px; padding-left: 8px; border-left: 4px solid #4a8; }
  h2.bp { border-left-color: #d97706; }
  h2.df { border-left-color: #2563eb; }
  h2.flame { border-left-color: #dc2626; }
  .header-meta { color: #666; font-size: 13px; margin: -8px 0 16px; }
  .case { background: #fafafa; border: 1px solid #e5e5e5; border-radius: 6px; padding: 12px 14px; margin: 12px 0; }
  .case-head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
  .case-title { font-weight: 600; font-size: 15px; }
  .case-body { font-size: 13px; }
  .badge { display: inline-block; font-size: 11px; padding: 2px 6px; border-radius: 3px; background: #eee; color: #555; }
  .sev-warning { background: #fef3c7; color: #92400e; }
  .sev-critical { background: #fee2e2; color: #991b1b; }
  .badge.bucket-1 { background: #f3e8ff; color: #7e22ce; }
  .badge.bucket-2 { background: #dbeafe; color: #1e40af; }
  .badge.bucket-3 { background: #fef3c7; color: #854d0e; }
  .badge.bucket-4 { background: #fce7f3; color: #9d174d; }
  .badge.bucket-5 { background: #d1fae5; color: #065f46; }
  .badge.hotness { background: #fee2e2; color: #991b1b; font-family: monospace; }
  .kv { margin: 6px 0; }
  .kv .k { color: #888; }
  .kv .v { background: #f3f4f6; padding: 2px 5px; border-radius: 3px; font-family: 'SF Mono',monospace; }
  .kv .v.current { background: #fee2e2; color: #991b1b; }
  .kv .v.recommended { background: #d1fae5; color: #065f46; }
  .kv .arrow { color: #999; margin: 0 6px; }
  .reason { margin: 8px 0; color: #444; }
  .meta { display: flex; gap: 12px; font-size: 12px; margin-top: 8px; align-items: center; }
  .meta .src { color: #2563eb; text-decoration: none; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta .case-id { color: #888; font-size: 11px; }
  details { margin: 8px 0; }
  summary { cursor: pointer; color: #555; font-size: 12px; }
  ol.steps,ul.causes,ul.directions { margin: 6px 0 6px 20px; }
  blockquote.mitigation { background: #d1fae5; border-left: 3px solid #10b981; padding: 6px 10px; margin: 8px 0; font-size: 12px; color: #064e3b; }
  .mechanism, .implication { margin: 6px 0; color: #555; font-size: 12px; }
  .nlm-expansion { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 8px 10px; margin-top: 10px; }
  .empty { color: #888; text-align: center; padding: 32px; }
</style>
`;
function renderReport(args) {
  const { snapshot, matched, notebooklm_expansions } = args;
  const bp = matched.filter((r) => r.path === "A");
  const df = matched.filter((r) => r.path === "B");
  const flame = matched.filter((r) => r.path === "C");
  const sevWeight = (s) => s === "critical" ? 0 : s === "warning" ? 1 : 2;
  bp.sort((a, b) => sevWeight(a.severity) - sevWeight(b.severity));
  const total = matched.length;
  const summary = total === 0 ? "\uFF08\u672A\u547D\u4E2D\u4EFB\u4F55\u6848\u4F8B \xB7 0 \u6761\uFF09" : `\u5171 ${total} \u6761 \xB7 BP ${bp.length} / DF ${df.length} / Flame ${flame.length}`;
  const renderItems = (arr, renderer) => arr.length === 0 ? `<div class="empty">\u65E0\u547D\u4E2D</div>` : arr.map(renderer).join("");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>perf-kp-sql \u8BCA\u65AD\u62A5\u544A \xB7 ${escape(snapshot.host)}</title>
  ${STYLES}
</head>
<body>
  <h1>perf-kp-sql \u8BCA\u65AD\u62A5\u544A</h1>
  <div class="header-meta">
    \u4E3B\u673A: <code>${escape(snapshot.host)}</code> \xB7
    \u5E73\u53F0: <code>${escape(snapshot.platform)}</code>${snapshot.mongo_version ? ` \xB7 mongo: <code>${escape(snapshot.mongo_version)}</code>` : ""}
    <br/>${escape(summary)}
  </div>

  <h2 class="bp">Section 1 \xB7 \u914D\u7F6E\u8FDD\u53CD (BP \xB7 ${bp.length} \u6761)</h2>
  ${renderItems(bp, (r) => renderBpItem(r, notebooklm_expansions))}

  <h2 class="df">Section 2 \xB7 \u89E6\u53D1\u7684\u8BCA\u65AD\u6D41\u7A0B (DF \xB7 ${df.length} \u6761)</h2>
  ${renderItems(df, (r) => renderDfItem(r, notebooklm_expansions))}

  <h2 class="flame">Section 3 \xB7 \u706B\u7130\u56FE\u7B7E\u540D (Flame \xB7 ${flame.length} \u6761)</h2>
  ${renderItems(flame, (r) => renderFlameItem(r, notebooklm_expansions))}
</body>
</html>`;
}

// plugins/perf-kp-sql/src/cli-diagnose.ts
async function runCli() {
  const { values } = parseArgs({
    options: {
      snapshot: { type: "string" },
      kb: { type: "string" },
      query: { type: "string" },
      out: { type: "string" },
      html: { type: "string" },
      nlm: { type: "boolean", default: false },
      "nlm-script": { type: "string" }
      // notebooklm.mjs 路径(可选 · 默认 scripts/notebooklm.mjs)
    }
  });
  if (!values.snapshot || !values.kb) {
    console.error(
      'Usage: diagnose.mjs --snapshot <snapshot.json> --kb <knowledge.sqlite> [--query "..."] [--out <out.json>] [--html <out.html>] [--nlm]'
    );
    process.exit(2);
  }
  const snapshot = JSON.parse(readFileSync(resolve(values.snapshot), "utf8"));
  const result = diagnose({
    dbPath: resolve(values.kb),
    snapshot,
    query: values.query
  });
  let nlmReason;
  let nlmExpansions;
  if (values.nlm) {
    const nlmScript = values["nlm-script"] ?? resolve(fileURLToPath(import.meta.url), "../../scripts/notebooklm.mjs");
    const hwArch = (snapshot.platform || "").includes("kunpeng") ? "kunpeng" : "x86_64";
    const nlmResult = callNotebookLm({
      scriptPath: nlmScript,
      diagnoseResult: result,
      hwArch
    });
    if (nlmResult.ok) {
      nlmExpansions = nlmResult.expansions;
    } else {
      nlmReason = nlmResult.reason;
    }
  }
  if (values.out) {
    mkdirSync(dirname(resolve(values.out)), { recursive: true });
    writeFileSync2(resolve(values.out), JSON.stringify(result, null, 2));
  }
  if (values.html) {
    mkdirSync(dirname(resolve(values.html)), { recursive: true });
    writeFileSync2(
      resolve(values.html),
      renderReport({
        snapshot,
        matched: result.matched,
        rag_context: result.rag_context,
        notebooklm_expansions: nlmExpansions
      })
    );
  }
  if (!values.out && !values.html) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const bp = result.matched.filter((r) => r.path === "A").length;
  const df = result.matched.filter((r) => r.path === "B").length;
  const flame = result.matched.filter((r) => r.path === "C").length;
  const nlmStr = values.nlm ? nlmExpansions ? ` \xB7 NotebookLM \u6CE8\u5165 ${nlmExpansions.size} \u6761` : ` \xB7 NotebookLM \u8DF3\u8FC7 (${nlmReason ?? "unknown"})` : "";
  console.log(
    `\u547D\u4E2D ${result.matched.length} \u6761 \xB7 BP ${bp} / DF ${df} / Flame ${flame} \xB7 rag_context ${result.rag_context?.length ?? 0} \u6761` + (values.out ? ` \xB7 JSON \u5199\u5165 ${values.out}` : "") + (values.html ? ` \xB7 HTML \u5199\u5165 ${values.html}` : "") + nlmStr
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCli();
}
export {
  diagnose
};
