/**
 * report — Phase 1 · M5 · DiagnoseResult → HTML 报告
 *
 * 老 v0.3 Gold Standard schema(Bucket/Rule/Evidence/Citation/Recommendation 等)整套
 * 在 M2 阶段已经被 distill-v2 case 体系替代 · 本文件 M5 阶段重写为新 CheckResult 渲染。
 *
 * 输入: { snapshot, matched: CheckResult[], rag_context?, notebooklm_expansions? }
 * 输出: HTML 字符串 · 含
 *   header (host/platform/mongo_version + 命中数)
 *   Section 1 配置违反 (path=A · BP)         按 severity 排
 *   Section 2 诊断流程 (path=B · DF)         按 cause 数排
 *   Section 3 火焰图签名 (path=C · Flame)
 *   (footer NotebookLM 深入分析 · M6 由 cli-diagnose 异步注入)
 */

import type { CheckResult, Snapshot } from "./cli-diagnose/types.js";

export interface RenderReportArgs {
  snapshot: Snapshot;
  matched: CheckResult[];
  rag_context?: CheckResult[];
  notebooklm_expansions?: Map<string, { answer: string; references?: Array<{ cited_text: string }> }>;
}

const AUTHORITY_ICON: Record<string, string> = {
  official: "★",
  "community-canonical": "◆",
  "vendor-doc": "■",
  "community-blog": "○",
  "code-comment": "▲",
  unknown: "·",
};

function escape(s: string | number | boolean | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function authorityBadge(authority: string): string {
  const icon = AUTHORITY_ICON[authority] ?? "·";
  return `<span class="badge auth-${escape(authority)}">${icon} ${escape(authority)}</span>`;
}

function bucketLabel(bucket: number): string {
  return (
    {
      1: "硬件",
      2: "OS",
      3: "引擎配置",
      4: "运行时",
      5: "业务",
    } as Record<number, string>
  )[bucket] ?? `bucket-${bucket}`;
}

function severityBadge(severity?: string): string {
  if (!severity) return "";
  const cls = severity === "critical" ? "sev-critical" : "sev-warning";
  return `<span class="badge ${cls}">${escape(severity)}</span>`;
}

function expansionBlock(
  caseId: string,
  expansions?: RenderReportArgs["notebooklm_expansions"],
): string {
  const e = expansions?.get(caseId);
  if (!e) return "";
  const refs = (e.references ?? [])
    .map((r) => `<li class="ref">${escape(r.cited_text)}</li>`)
    .join("");
  return `
    <details class="nlm-expansion">
      <summary>ⓘ NotebookLM 深入分析</summary>
      <div class="nlm-answer">${escape(e.answer)}</div>
      ${refs ? `<ul class="nlm-refs">${refs}</ul>` : ""}
    </details>
  `;
}

function renderBpItem(r: CheckResult, expansions?: RenderReportArgs["notebooklm_expansions"]): string {
  const cur = r.current_value == null ? "—" : escape(r.current_value);
  const rec = r.recommended_value == null ? "—" : escape(r.recommended_value);
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
          <span class="k">现场:</span>
          <code class="v current">${cur}</code>
          <span class="arrow">→</span>
          <span class="k">推荐:</span>
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

interface DfDataLike {
  symptom?: { description_quote?: string | null };
  diagnostic_steps?: Array<{ step_no: number; title: string; metric_name?: string | null }>;
  likely_causes?: {
    parameter_causes?: Array<{ title: string; param_name?: string | null }>;
    non_parameter_causes?: Array<{ title: string }>;
  };
  mitigation_quote?: string | null;
}

function renderDfItem(r: CheckResult, expansions?: RenderReportArgs["notebooklm_expansions"]): string {
  const data = (r.data as DfDataLike) ?? {};
  const steps = (data.diagnostic_steps ?? []).slice(0, 3);
  const stepList = steps
    .map((s) => `<li>step ${s.step_no}: ${escape(s.title)}${s.metric_name ? ` <code>${escape(s.metric_name)}</code>` : ""}</li>`)
    .join("");
  const pCauses = data.likely_causes?.parameter_causes ?? [];
  const causeList = pCauses
    .map(
      (c) =>
        `<li><strong>${escape(c.title)}</strong>${c.param_name ? ` <code>${escape(c.param_name)}</code>` : ""}</li>`,
    )
    .join("");
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
        ${stepList ? `<details><summary>诊断步骤</summary><ol class="steps">${stepList}</ol></details>` : ""}
        ${causeList ? `<details><summary>possible 根因</summary><ul class="causes">${causeList}</ul></details>` : ""}
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

interface FlameDataLike {
  pattern_regex?: string | null;
  mechanism?: { zh?: string | null };
  workload_implication?: { zh?: string | null };
  tuning_directions?: Array<{ direction_quote?: string | null; related_param_name?: string | null }>;
}

function renderFlameItem(r: CheckResult, expansions?: RenderReportArgs["notebooklm_expansions"]): string {
  const data = (r.data as FlameDataLike) ?? {};
  const directions = (data.tuning_directions ?? [])
    .map(
      (d) =>
        `<li>${escape(d.direction_quote ?? "")}${d.related_param_name ? ` <code>${escape(d.related_param_name)}</code>` : ""}</li>`,
    )
    .join("");
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
        ${directions ? `<details><summary>调优方向</summary><ul class="directions">${directions}</ul></details>` : ""}
        <div class="meta">
          <a href="${escape(r.source_url)}" target="_blank" class="src">${escape(r.source_url)}</a>
          <code class="case-id">${escape(r.case_id)}</code>
        </div>
        ${expansionBlock(r.case_id, expansions)}
      </div>
    </div>
  `;
}

const STYLES = `
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

export function renderReport(args: RenderReportArgs): string {
  const { snapshot, matched, notebooklm_expansions } = args;
  const bp = matched.filter((r) => r.path === "A");
  const df = matched.filter((r) => r.path === "B");
  const flame = matched.filter((r) => r.path === "C");

  // 排序: severity critical 优先 · 然后 warning
  const sevWeight = (s?: string) => (s === "critical" ? 0 : s === "warning" ? 1 : 2);
  bp.sort((a, b) => sevWeight(a.severity) - sevWeight(b.severity));

  const total = matched.length;
  const summary = total === 0 ? "（未命中任何案例 · 0 条）" : `共 ${total} 条 · BP ${bp.length} / DF ${df.length} / Flame ${flame.length}`;

  const renderItems = <T,>(arr: T[], renderer: (x: T) => string): string =>
    arr.length === 0 ? `<div class="empty">无命中</div>` : arr.map(renderer).join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>perf-kp-sql 诊断报告 · ${escape(snapshot.host)}</title>
  ${STYLES}
</head>
<body>
  <h1>perf-kp-sql 诊断报告</h1>
  <div class="header-meta">
    主机: <code>${escape(snapshot.host)}</code> ·
    平台: <code>${escape(snapshot.platform)}</code>${snapshot.mongo_version ? ` · mongo: <code>${escape(snapshot.mongo_version)}</code>` : ""}
    <br/>${escape(summary)}
  </div>

  <h2 class="bp">Section 1 · 配置违反 (BP · ${bp.length} 条)</h2>
  ${renderItems(bp, (r) => renderBpItem(r, notebooklm_expansions))}

  <h2 class="df">Section 2 · 触发的诊断流程 (DF · ${df.length} 条)</h2>
  ${renderItems(df, (r) => renderDfItem(r, notebooklm_expansions))}

  <h2 class="flame">Section 3 · 火焰图签名 (Flame · ${flame.length} 条)</h2>
  ${renderItems(flame, (r) => renderFlameItem(r, notebooklm_expansions))}
</body>
</html>`;
}
