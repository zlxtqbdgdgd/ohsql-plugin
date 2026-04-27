#!/usr/bin/env node
// render-report.mjs
// Mechanically render a .md diagnosis report from diagnose.mjs output JSON.
// LLM no longer writes md — this script assembles everything, guaranteeing:
//   - All Top Issues have Why/机制/代价/例外 with [参考N] markers
//   - Full findings list all rules (no "详见 markdown" truncation)
//   - 参考资料汇总 table is complete (all evidence_trail rows)
//   - ## 脚注(Footnotes) section auto-rendered
// After md is written, md-to-html.mjs produces the HTML counterpart.
//
// Usage:
//   cat report_input.json | node render-report.mjs <md-path>
//   OR
//   node render-report.mjs <md-path> --from-diagnose <diagnose-stdout-json>

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
const mdPath = args[0];
if (!mdPath) {
  console.error("usage: render-report.mjs <md-path>  (pipe diagnose.mjs JSON on stdin · or use --from-diagnose <file>)");
  process.exit(1);
}

let diagnoseJson;
const fromIdx = args.indexOf("--from-diagnose");
if (fromIdx >= 0 && args[fromIdx + 1]) {
  diagnoseJson = readFileSync(args[fromIdx + 1], "utf8");
} else {
  diagnoseJson = readFileSync(0, "utf8");  // stdin
}

// 如果直接 CLI 跑 · 落盘 md · 否则 export renderReport / renderReportFromDiagnoseJson 给其他脚本用
import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";
const _isMain = import.meta.url === (() => { try { return pathToFileURL(realpathSync(process.argv[1])).href; } catch { return ""; } })();

// v0.4.3 · _isMain 执行块移到文件底部 · 避免 const HEALTHY_WHITELIST 等 TDZ
// (见文件末尾 "Entry point" 段)

/** Lib API · 从 diagnose.mjs JSON 字符串渲染 md · in-memory · 不落盘 */
export function renderReportFromDiagnoseJson(jsonString, opts = {}) {
  const data = JSON.parse(jsonString);
  const input = data.report_input ?? data;
  return renderReport(input, data, opts.mdPath ?? "");
}

// ============================================================================
// Renderers
// ============================================================================

export function renderReport(input, data, _mdPath = "") {
  const lines = [];
  lines.push(renderMetadata(input.metadata, input.summary));
  lines.push("");

  // v0.4.4 · 全报告共享一个 FootnoteRegistry · 双表推荐 cell + 末尾参考段共号
  const registry = new FootnoteRegistry(input.evidence_trail ?? []);

  // v0.4.3 · 报告开头先出双表(需要调优 + 已通过)· 按 wait_class 分组合并 · 给读者一眼摸底
  lines.push("## 需要调优");
  lines.push("");
  lines.push(renderActionableTable(input.top_issues ?? [], input.evidence_trail ?? [], data.check_catalog, registry));
  lines.push("");
  lines.push("## 关键指标");
  lines.push("");
  // v0.5.6 · 用户反馈 · 关键指标固定 10 项白名单 · 不论 severity · 全量列出
  // 入参从 ok_findings 改为 [full_findings, ok_findings] 合并 · 让 critical/warning/info 都能命中白名单
  lines.push(renderHealthyTable([...(input.full_findings ?? []), ...(input.ok_findings ?? [])], input.evidence_trail ?? [], data.check_catalog, registry));
  lines.push("");

  lines.push("## Top Issues");
  lines.push("");
  for (let i = 0; i < (input.top_issues ?? []).length; i++) {
    lines.push(renderTopIssue(input.top_issues[i], i + 1));
    lines.push("");
  }
  lines.push("## Full findings");
  lines.push("");
  lines.push(renderFullFindings(input.full_findings ?? [], input.ok_findings ?? []));
  lines.push("");
  lines.push("## 验证命令(待 --with-verify)");
  lines.push("");
  lines.push(renderVerifyCommands(input.top_issues ?? []));
  lines.push("");
  lines.push("## Artifacts");
  lines.push("");
  lines.push(renderArtifacts(data, _mdPath));
  lines.push("");
  lines.push("## 参考");
  lines.push("");
  // v0.4.4 · 切换为统一的 registry.render() 以包含双表(需要调优/关键指标)动态插入的所有脚注
  lines.push(registry.render());
  lines.push("");
  lines.push("## Report Changelog");
  lines.push("");
  lines.push("- v0.3.8 · 2026-04-23 · LLM 不再 Write md/html · 全脚本渲染 · 零幻觉硬约束(每条 Why/机制/代价/例外 带 [参考N] · 参考段自动生成)");
  lines.push("");
  // v0.5.10 · 2026-04-25 · 用户反馈 · 报告里 [参考N] 序号经常跳号(1, 3, 4, 6, 10, 12)
  // —— 因为 evidence_trail 预分配了全局编号,但只有部分被实际引用,留空号。
  // 这里在最后做一次重编号:按 body 中首次出现顺序重排为 1..K,并重写 ## 参考 段。
  return renumberFootnotesContiguous(lines.join("\n"));
}

/**
 * 把 md 中所有 [参考N] 按"在 body 中首次出现的顺序"重新映射成连续编号 1..K,
 * 同时重写 ## 参考 段,只保留真正被引用的 url(去掉空编号留下的"洞")。
 *
 * - 引用顺序: 严格 body(## 参考 之前)出现顺序的去重序列
 * - 未被引用的 evidence_trail 条目: 不写入 ## 参考(它们在 body 没有 [参考N] 标记)
 * - 同一 url 多次引用: 共享同一新编号(去重靠 ## 参考 段原本的 url 列表)
 *
 * 失败兜底: 找不到 ## 参考 段就返原文 · 不破坏调用方
 */
export function renumberFootnotesContiguous(md) {
  const refsHeaderRe = /^## 参考\s*$/m;
  const refsMatch = refsHeaderRe.exec(md);
  if (!refsMatch) return md;

  const refsHeaderIdx = refsMatch.index;
  const beforeRefs = md.slice(0, refsHeaderIdx);
  const refsHeaderEnd = refsHeaderIdx + refsMatch[0].length;
  const afterHeader = md.slice(refsHeaderEnd);
  // ## 参考 段截止于下一个 "## " 或 EOF
  const nextHeadingRel = afterHeader.search(/^## /m);
  const refsSectionRaw =
    nextHeadingRel >= 0 ? afterHeader.slice(0, nextHeadingRel) : afterHeader;
  const tailFromNextHeading =
    nextHeadingRel >= 0 ? afterHeader.slice(nextHeadingRel) : "";

  // 1. body 中 [参考N] 的首次出现顺序
  const order = [];
  const seenOld = new Set();
  for (const m of beforeRefs.matchAll(/\[参考(\d+)\]/g)) {
    const n = Number(m[1]);
    if (!seenOld.has(n)) {
      seenOld.add(n);
      order.push(n);
    }
  }
  if (order.length === 0) {
    // 完全没引用 -> 干掉 ## 参考 段,保留后续段落
    return beforeRefs.replace(/\n+$/, "\n") + tailFromNextHeading.replace(/^\n+/, "");
  }

  // 2. oldN -> newN
  const mapping = new Map();
  order.forEach((oldN, i) => mapping.set(oldN, i + 1));

  // 3. 解析旧 ## 参考 段 · 拿 oldN -> url
  const urlByOldN = new Map();
  for (const m of refsSectionRaw.matchAll(/^\[参考(\d+)\]\s+(\S+)/gm)) {
    urlByOldN.set(Number(m[1]), m[2]);
  }

  // 4. 单遍替换 body 里的 [参考N](.replace 在原串上 single-pass · 不会双重替换)
  const newBody = beforeRefs.replace(/\[参考(\d+)\]/g, (full, n) => {
    const newN = mapping.get(Number(n));
    return newN ? `[参考${newN}]` : full;
  });

  // 5. 重建 ## 参考 段 · 按 newN 升序输出
  const newRefLines = ["## 参考", ""];
  for (let newN = 1; newN <= order.length; newN++) {
    const oldN = order[newN - 1];
    const url = urlByOldN.get(oldN);
    if (url) newRefLines.push(`[参考${newN}] ${url}`);
  }
  const newRefsSection = newRefLines.join("\n") + "\n";

  return (
    newBody +
    newRefsSection +
    (tailFromNextHeading
      ? "\n" + tailFromNextHeading.replace(/^\n+/, "")
      : "")
  );
}

function renderMetadata(meta = {}, summary = {}) {
  // v0.5.10 · 2026-04-25 · 用户反馈 · 撤 ASCII box-drawing(`╭─` `│` `╰─`)
  // 在 HTML(非等宽字体)下完全错位 · 改 markdown 2 列 KV 表 · 终端/HTML 都对齐
  const s = summary;
  const target = `${meta.user ?? "root"}@${meta.host ?? "-"}:${meta.ssh_port ?? 22}`;
  const dbEndpoint = `${meta.db_bind ?? meta.host ?? "-"}:${meta.db_port ?? "-"}`;
  const summaryStr = `严重 ${s.critical ?? 0} · 告警 ${s.warning ?? 0} · 跳过 ${s.info ?? 0} · 已通过 ${s.ok ?? 0}`;
  const rows = [
    ["Engine", meta.engine ?? "-"],
    ["Target", target],
    ["DB endpoint", dbEndpoint],
    ["DB version", meta.detected_version ?? "-"],
    ["Arch", meta.arch ?? "-"],
  ];
  if (meta.os_id) rows.push(["OS", `${meta.os_id} ${meta.os_version ?? ""}`.trim()]);
  rows.push(["Generated", new Date().toISOString()]);
  rows.push(["Summary", summaryStr]);
  const lines = [
    "## 报告信息",
    "",
    "| 字段 | 值 |",
    "|------|------|",
    ...rows.map(([k, v]) => `| ${k} | ${v} |`),
  ];
  return lines.join("\n");
}

function impactLine(r) {
  const i = r.impact ?? {};
  const METRIC_CN = {
    latency_p95_ms: ["p95 延迟", "+"],
    throughput_qps: ["吞吐 QPS", "-"],
    cache_miss_rate: ["缓存未命中率", "+"],
    db_time_pct: ["DB 时间占比", "+"],
    wasted_bytes: ["浪费字节", "+"],
    connection_util_pct: ["连接池利用率", "+"],
  };
  const CONF_CN = { high: "高", medium: "中", low: "低" };
  const [name, sign] = METRIC_CN[i.metric] ?? [i.metric ?? "影响", "+"];
  const unit = i.unit === "percent" ? "%" : (i.unit ?? "");
  return `${name} ${sign}${i.value ?? 0}${unit} · 置信度 ${CONF_CN[i.confidence ?? "medium"] ?? "中"}`;
}

function fnRef(r) {
  // v0.3.9 · 每条 rule 只取权重最高的一条(footnote_refs 已按 tier 排序 · 取首元素)
  // v0.5.3 · 用户反馈 · 角标 [N] → [参考N] · "参考" 二字让用户立即知道是文末引用
  const refs = r.footnote_refs ?? [];
  return refs.length > 0 ? `[参考${refs[0]}]` : "";
}

function renderTopIssue(r, idx) {
  const scopeTag = (r.scope?.arch === "arm64" || r.scope?.vendor)
    ? ` — ${r.scope.arch}${r.scope.vendor ? " · " + r.scope.vendor : ""}`
    : "";
  const bios = r.surfaceable_only ? " [BIOS/固件建议]" : "";
  const prio = r.priority ?? "P2";
  const score = (r.impact_score ?? 0).toFixed(1);
  const sev = r.severity ?? "info";
  const lines = [
    `${idx}. **[${sev}][${prio}][${score}] ${r.title}**${scopeTag}${bios}`,
    `   - 影响: ${impactLine(r)}`,
    `   - Action: \`${r.recommendations?.[0]?.action ?? "-"}\``,
  ];
  const ref = fnRef(r);
  const why = r.recommendations?.[0]?.rationale ?? r.reason ?? r.summary ?? "-";
  lines.push(`   - Why: ${why}${ref}`);
  if (r.rationale) {
    if (r.rationale.mechanism) lines.push(`   - 机制: ${r.rationale.mechanism}${ref}`);
    if (r.rationale.trade_offs) lines.push(`   - 代价: ${r.rationale.trade_offs}${ref}`);
    if (r.rationale.when_to_deviate) lines.push(`   - 例外: ${r.rationale.when_to_deviate}${ref}`);
  }
  // 版本适配
  const vmin = r.engine_version_min_display;
  const vmax = r.engine_version_max_display;
  const detected = r.scope?.engine_version;
  if (vmin || vmax) {
    lines.push(`   - 版本适配: 规则适配 ${r.scope?.engine ?? "mongo"} ${vmin ?? "*"}-${vmax ?? "*"}${detected ? ` · 当前 ${detected} ✓` : ""}`);
  } else {
    lines.push(`   - 版本适配: 规则适配 全 ${r.scope?.engine ?? "mongo"} 版本${detected ? ` · 当前 ${detected} ✓` : ""}`);
  }
  // v0.3.9 · 不再 inline "参考:" 段(冗余 · 都在文末参考段 + [参考N] 角标了)
  return lines.join("\n");
}

// ============================================================================
// v0.4.4 · 主题合并器(mergeThemes · UI 输出前加工 · 不改 report_input 原始数据)
// 录音 2 问 6 · 同主题多 knob collapse 成一行 · 5 组(WT Cache 拆配置/运行态)
// 逻辑与 src/report.ts::mergeThemes 保持一致(覆盖同单元测试)
// ============================================================================
const THEME_DEFS = [
  { key: "大页内存策略",       wait_class: "内存", patterns: ["thp", "transparent_hugepage", "hugepages", "zone_reclaim"] },
  { key: "写回与 IO 调度",      wait_class: "I/O",  patterns: ["os.vm.dirty", "vm.dirty_ratio", "vm.dirty_bg", "vm.dirty_background", "vm.dirty_expire", "iosched", "io_scheduler", "device_scheduler"] },
  { key: "TCP 连接韧性",       wait_class: "网络", patterns: ["tcp_keepalive", "tcp_max_syn", "tcp_retrans"] },
  { key: "WT Cache · 配置",    wait_class: "内存", patterns: ["wt_cache_vs", "wt_cache_pct"] },
  { key: "WT Cache · 运行态",  wait_class: "内存", patterns: ["wt_cache_hit", "wt_cache_dirty"] },
  { key: "NUMA 启动策略",      wait_class: "内存", patterns: ["numa_balancing", "numa.topology", "numa.distance", "numa_interleave", "numa.balancing", "numa.interleave"] },
];
const SEV_RANK = { critical: 0, warning: 1, info: 2, ok: 3 };
function matchesThemeId(ruleId, theme) {
  if (!ruleId) return false;
  const lower = ruleId.toLowerCase();
  return theme.patterns.some((p) => lower.includes(p.toLowerCase()));
}
function dedupBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out;
}
/** 同 src/report.ts::mergeThemes · 同主题 >=2 条 collapse · 否则原样保留 */
function mergeThemes(ranked) {
  if (!ranked || ranked.length === 0) return ranked;
  const themeBuckets = new Map();
  const ruleTheme = new Map();
  for (const r of ranked) {
    let matched = null;
    for (const t of THEME_DEFS) {
      if (matchesThemeId(r.id, t)) { matched = t; break; }
    }
    if (!matched) continue;
    ruleTheme.set(r.id, matched.key);
    if (!themeBuckets.has(matched.key)) themeBuckets.set(matched.key, []);
    themeBuckets.get(matched.key).push(r);
  }
  const themeCondensed = new Map();
  for (const theme of THEME_DEFS) {
    const bucket = themeBuckets.get(theme.key);
    if (!bucket || bucket.length < 2) continue;
    const sorted = [...bucket].sort((a, b) => {
      const s = (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9);
      if (s !== 0) return s;
      return (b.impact_score ?? 0) - (a.impact_score ?? 0);
    });
    const primary = sorted[0];
    // v1.0 红线收紧:current 取 evidence(CheckFn 真机当前值) · 不取 summary(KB 文档字面)
    // recommend 优先 threshold_display(KB threshold fact) · 兜底 recommendations[0].action(KB remediation)
    // 注意 nullish 保护:threshold_display 可能是 null/undefined · 不能让它进字符串拼接
    const currentParts = sorted
      .map((r) => r.evidence?.[0]?.value || r.summary || "")
      .filter((s) => s && s.trim());
    const recommendParts = sorted
      .map((r) => (r.threshold_display && r.threshold_display.trim()) || r.recommendations?.[0]?.action || "")
      .filter((s) => s && s.trim());
    const citationsMerged = dedupBy(sorted.flatMap((r) => r.citations ?? []), (c) => c.url);
    const recommendationsMerged = dedupBy(sorted.flatMap((r) => r.recommendations ?? []), (rec) => rec.action);
    themeCondensed.set(theme.key, {
      ...primary,
      id: `merged:${theme.key}`,
      title: theme.key,
      summary: currentParts.join(" · "),
      description: currentParts.join(" · "),
      reason: sorted.map((r) => r.reason).filter(Boolean).join(" · "),
      citations: citationsMerged,
      recommendations: recommendationsMerged,
      merged: {
        theme_key: theme.key,
        wait_class: theme.wait_class,
        current: currentParts.join(" · "),
        recommend: recommendParts.join(" · "),
        source_rule_ids: sorted.map((r) => r.id),
      },
    });
  }
  const emitted = new Set();
  const out = [];
  for (const r of ranked) {
    const tk = ruleTheme.get(r.id);
    if (tk && themeCondensed.has(tk)) {
      if (!emitted.has(tk)) { emitted.add(tk); out.push(themeCondensed.get(tk)); }
      continue;
    }
    out.push(r);
  }
  return out;
}

// v0.3.9 · 关键指标 · 已健康表(ok findings 里业界常驻指标)
// v0.4.3 · 按 wait_class 排序 · 相同组内首行显 wait_class · 续行留空(rowspan 视觉合并)
// v0.5 · 加 module 字段 · 用 inferModule(id) 派生 · 双层 rowspan 模块 + wait_class
const HEALTHY_WHITELIST = [
  { id: "mongo.config.wt_block_compressor",  wait_class: "CPU",   title: "压缩算法" },
  { id: "os.iosched.device_scheduler",       wait_class: "I/O",   title: "IO scheduler" },
  { id: "mongo.config.wt_cache_size_advisory", wait_class: "内存", title: "WT cache 大小配置" },
  { id: "os.io.disk_await_ms",               wait_class: "I/O",   title: "磁盘 await" },
  { id: "os.io.disk_usage_pct",              wait_class: "I/O",   title: "磁盘使用" },
  { id: "mongo.config.wt_cache_vs_memory",   wait_class: "内存",  title: "WT cache 用量" },
  { id: "os.vm.max_map_count",               wait_class: "内存",  title: "max_map_count" },
  { id: "mongo.runtime.connection_pool",     wait_class: "并发",  title: "连接数" },
  { id: "os.net.somaxconn",                  wait_class: "网络",  title: "somaxconn" },
];

/** v1.0 红线收紧:"当前值"取 evidence(CheckFn 写的真机值) · 不取 summary(KB 文档字面) */
function extractCurrent(r) {
  return (r.evidence?.[0]?.value ?? "").replace(/^[^=]*=/, "");
}

/** v0.4.4 · FootnoteRegistry · 推荐 cell URL → footnote 编号映射器
 *  - 初始化时塞入 evidence_trail · 保留已有 footnote_n(LLM 报告 ## 参考 段共用同一编号空间)
 *  - register(url) 返回 1-based 编号 · 同 url 共号 · 新 url 自动分配下一号
 *  - render() 输出 `参考` 段(不含 ## 头) · 一行一个 `[参考N] <url>`
 */
export class FootnoteRegistry {
  constructor(evidenceTrail = []) {
    this.byUrl = new Map();
    this.urls = []; // 保留出现顺序
    let maxN = 0;
    for (const e of evidenceTrail) {
      if (!e || !e.url) continue;
      const n = e.footnote_n ?? 0;
      if (n > 0) {
        this.byUrl.set(e.url, n);
        this.urls[n - 1] = e.url;
        if (n > maxN) maxN = n;
      }
    }
    this.next = maxN + 1;
  }
  register(url) {
    if (!url) return 0;
    const existing = this.byUrl.get(url);
    if (existing) return existing;
    const n = this.next++;
    this.byUrl.set(url, n);
    this.urls[n - 1] = url;
    return n;
  }
  /** 取已注册的编号 · 没注册返 0 */
  lookup(url) {
    if (!url) return 0;
    return this.byUrl.get(url) ?? 0;
  }
  /** 收集出现过的所有 [参考N] · 返 `参考` 段 · 跳过未注册的 N · 仅在传入 usedNs 时过滤 */
  render(usedNs = null) {
    const lines = [];
    for (let i = 0; i < this.urls.length; i++) {
      const url = this.urls[i];
      if (!url) continue;
      const n = i + 1;
      if (usedNs && !usedNs.has(n)) continue;
      lines.push(`[参考${n}] ${url}`);  // v0.5.3 · [N] → [参考N]
    }
    return lines.join("\n");
  }
}

/** v0.4.4 · URL 取数 · 优先级 fix_url > citations[0].url > evidence_trail[footnote_refs[0]].url */
function pickRuleUrl(r, evidenceTrail) {
  const fixUrl = r.recommendations?.[0]?.fix_url;
  if (fixUrl) return fixUrl;
  const citeUrl = r.citations?.[0]?.url;
  if (citeUrl) return citeUrl;
  const n = (r.footnote_refs ?? [])[0];
  if (!n) return null;
  const entry = evidenceTrail.find((e) => e.footnote_n === n);
  return entry?.url ?? null;
}

/** 从 finding + evidence_trail 推出"推荐值"单元格文本
 *  v0.4.4 · 角标化:`<text>[参考N]` · 同 url 共号 · 新 url 通过 registry 注册
 *  v0.4.4 之前:`[<text>](<url>)` markdown 链接(LLM 复刻终端字面会乱码 · 已撤)
 *  当 registry 缺省 · 兼容旧路径返裸文本(no [参考N])
 */
function extractThresholdCell(r, evidenceTrail, registry = null) {
  const threshold = r.threshold_display ?? "-";
  if (!registry) return threshold;
  const url = pickRuleUrl(r, evidenceTrail);
  if (!url) return threshold;
  const n = registry.register(url);
  return `${threshold}[参考${n}]`;  // v0.5.3 · [N] → [参考N]
}

function renderHealthyTable(allFindings, evidenceTrail = [], checkCatalog = null, registry = null) {
  // v0.5.6 · 用户反馈 · 关键指标 = 业界常驻指标 = 固定 10 项白名单 · 不论 severity 全量列出
  // 入参 allFindings = [...full_findings, ...ok_findings](critical / warning / info / ok 都包)
  // 同 rule_id 重复出现取第一个(full_findings 优先 · 因为 critical/warning 比 ok 信息密度高)
  const byId = new Map();
  for (const r of allFindings) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  const rows = [];
  for (const w of HEALTHY_WHITELIST) {
    const r = byId.get(w.id);
    if (r) {
      rows.push({
        module: inferModule(w.id),
        wait_class: w.wait_class,
        title: w.title,
        current: extractCurrent(r),
        threshold: extractThresholdCell(r, evidenceTrail, registry),
      });
    } else {
      // 该规则没出 finding(scope 不匹配 / 数据缺失)· 仍占一行 · 让用户看到这一项被评估了 · 只是采不到
      rows.push({
        module: inferModule(w.id),
        wait_class: w.wait_class,
        title: w.title,
        current: "未采到",
        threshold: "-",
      });
    }
  }
  if (rows.length === 0) return "(白名单为空 · 检查 HEALTHY_WHITELIST 配置)";

  // v0.5 · 排序:模块优先 → wait_class 次之 · 让相同模块行连续渲染 rowspan 视觉合并
  const MODULE_ORDER = ["os", "硬件", "mongo", "mysql", "redis", "其他"];
  const WC_ORDER = ["CPU", "I/O", "内存", "并发", "网络", "其他"];
  rows.sort((a, b) => {
    const ma = MODULE_ORDER.indexOf(a.module);
    const mb = MODULE_ORDER.indexOf(b.module);
    if (ma !== mb) return ma - mb;
    const wa = WC_ORDER.indexOf(a.wait_class);
    const wb = WC_ORDER.indexOf(b.wait_class);
    return wa - wb;
  });

  // v0.5.6 · 关键指标固定 10 项白名单(rows.length === HEALTHY_WHITELIST.length)
  const lines = [
    `**关键指标 · 业界常驻 ${rows.length} 项 · 不论 severity 全量列出**`,
    "",
    "| 模块 | 诊断项 | 当前值 | 推荐值 |",
    "|---|---|---|---|",
  ];
  // v0.5.6 · 用户反馈 · 同模块续行留空(双层 rowspan 视觉合并 · 撤 v0.5.3 重复打)
  let prevModule = null;
  for (const row of rows) {
    const moduleCell = row.module === prevModule ? " " : row.module;
    prevModule = row.module;
    lines.push(`| ${moduleCell} | ${row.title} | ${row.current} | ${row.threshold} |`);
  }
  return lines.join("\n");
}

/**
 * v0.4.3 新增 · 需要调优表 · 按 wait_class 分组合并单元格
 * 从 report_input.top_issues(impact-ranked critical + warning)渲染 ·
 * 头部附 X/Y 总数(X = 触发条数 · Y = 总规则数)
 */
function renderActionableTable(topIssues, evidenceTrail = [], checkCatalog = null, registry = null) {
  if (!topIssues || topIssues.length === 0) return "**需要调优 · 无异常**";

  // v0.4.4 · 合并主题(UI 层) · 输入 top_issues 原始粒度不动 · 输出用合并后视图
  const mergedIssues = mergeThemes(topIssues);

  const WC_ORDER = ["CPU", "I/O", "内存", "并发", "网络", "其他"];
  const MODULE_ORDER = ["os", "硬件", "mongo", "mysql", "redis", "其他"];
  const wcOf = (r) => r.merged?.wait_class ?? r.scope?.wait_class ?? inferWaitClass(r.id);
  const moduleOfRow = (r) => r.merged?.module ?? inferModule(r.id);
  const titleOf = (r) => r.title ?? r.id;
  const currentOf = (r) => r.merged?.current ?? extractCurrent(r);

  const rows = mergedIssues
    .map((r) => ({
      module: moduleOfRow(r),
      wait_class: wcOf(r),
      title: titleOf(r),
      current: currentOf(r),
      threshold: extractThresholdCell(r, evidenceTrail, registry),
      severity: r.severity === "critical" ? "严重" : (r.severity === "warning" ? "告警" : r.severity),
      sev_rank: r.severity === "critical" ? 0 : 1,
    }))
    .sort((a, b) => {
      const ma = MODULE_ORDER.indexOf(a.module);
      const mb = MODULE_ORDER.indexOf(b.module);
      if (ma !== mb) return ma - mb;
      const wa = WC_ORDER.indexOf(a.wait_class);
      const wb = WC_ORDER.indexOf(b.wait_class);
      if (wa !== wb) return wa - wb;
      return a.sev_rank - b.sev_rank;
    });

  // v0.4.3 · 分母 = 评估指标池(运行时实装 CheckFn 总数) · 不用采集总数(后者含环境情境)
  // v0.4.4 · 分子 = 合并后主题数(mergedIssues.length) · 注记原始 knob 数 · 对齐领导要求
  const evalTotal = checkCatalog?.total ?? 54;
  const crit = mergedIssues.filter((r) => r.severity === "critical").length;
  const warn = mergedIssues.filter((r) => r.severity === "warning").length;

  const originalCount = topIssues.length;
  const mergedCount = mergedIssues.length;
  const mergedNote = originalCount > mergedCount ? ` · 已合并 ${originalCount} 条 → ${mergedCount} 组` : "";
  const lines = [
    `**需要调优 · ${rows.length}/${evalTotal} 项偏离推荐值 · 严重 ${crit} · 告警 ${warn}${mergedNote}**`,
    "",
    "| 模块 | 诊断项 | 当前值 | 推荐值 | 严重度 |",
    "|---|---|---|---|---|",
  ];
  // v0.5.6 · 用户反馈 · 同模块续行留空(双层 rowspan 视觉合并 · 撤 v0.5.3 重复打)
  let prevModule = null;
  for (const row of rows) {
    const moduleCell = row.module === prevModule ? " " : row.module;
    prevModule = row.module;
    lines.push(`| ${moduleCell} | ${row.title} | ${row.current} | ${row.threshold} | ${row.severity} |`);
  }
  return lines.join("\n");
}

/**
 * v0.5 · rule_id 前缀推模块 · 与 src/shared/wait-class.ts 的 moduleOf 同步。
 *
 * 口径:规则**来源归属** · 不是技术领域。例:`kunpeng.vm.swappiness_strict` 算"硬件"
 * (来源是鲲鹏调优手册 · 即使底层是 vm sysctl)。
 */
function inferModule(ruleId) {
  if (!ruleId) return "其他";
  const prefix = ruleId.split(".", 1)[0];
  switch (prefix) {
    case "os":
    case "openeuler":
      return "os";
    case "arm64":
    case "kunpeng":
      return "硬件";
    case "mongo":
      return "mongo";
    case "mysql":
      return "mysql";
    case "redis":
      return "redis";
    default:
      return "其他";
  }
}

/** rule_id 前缀推 wait_class · 与 src/shared/wait-class.ts 保持同步 */
function inferWaitClass(ruleId) {
  if (!ruleId) return "其他";
  if (/^arm64\.|^kunpeng\.cpu\.|^kunpeng\.smt\.|^kunpeng\.irqbalance\.|^openeuler\.|mongo\.config\.wt_block_compressor|redis\.runtime\.slowlog/.test(ruleId)) return "CPU";
  if (/^os\.iosched\.|^os\.vm\.dirty|^os\.io\.|mysql\.config\.innodb_flush_log|mysql\.config\.sync_binlog|redis\.config\.persistence/.test(ruleId)) return "I/O";
  if (/^os\.thp\.|^os\.hugepages\.|^os\.vm\.(swappiness|zone_reclaim|max_map_count|overcommit)|^kunpeng\.numa\.|mongo\.config\.wt_cache_vs_memory|mongo\.runtime\.wt_cache_hit|mongo\.config\.db_cache|mysql\.config\.innodb_buffer_pool_size|mysql\.runtime\.buffer_pool_hit|mysql\.design\.schema|redis\.config\.maxmemory|redis\.runtime\.mem_fragmentation/.test(ruleId)) return "内存";
  if (/mongo\.runtime\.connection_pool|mongo\.config\.oplog_window|mysql\.config\.slow_query_log|mysql\.runtime\.connection_util|redis\.runtime\.connected_clients/.test(ruleId)) return "并发";
  if (/^os\.net\./.test(ruleId)) return "网络";
  return "其他";
}

function renderFullFindings(actionable, ok) {
  const all = [...actionable, ...ok];
  if (all.length === 0) return "(无)";
  const byBucket = new Map();
  for (const r of all) {
    const b = r.bucket ?? 1;
    if (!byBucket.has(b)) byBucket.set(b, []);
    byBucket.get(b).push(r);
  }
  const BUCKET_NAMES = { 1: "Resources / OS", 2: "Config / Memory", 3: "Design / Schema", 4: "Query / Index", 5: "Runtime / Concurrency" };
  const out = [];
  for (const [b, rs] of [...byBucket.entries()].sort((a, b) => a[0] - b[0])) {
    out.push(`<details>`);
    out.push(`<summary>Bucket ${b} · ${BUCKET_NAMES[b] ?? "Other"} (${rs.length} rules)</summary>`);
    out.push(``);
    for (const r of rs) {
      out.push(`- [${r.severity}] ${r.id} — ${r.summary ?? "-"}`);
    }
    out.push(``);
    out.push(`</details>`);
    out.push(``);
  }
  return out.join("\n");
}

function renderEvidenceTable(trail) {
  if (trail.length === 0) return "(无)";
  const tierCN = { "vendor-primary": "鲲鹏原厂", "official": "上游官方", "vendor-blog": "厂商博客", "community": "社区博客" };
  const lines = ["| 权威等级 | 来源 | 被引规则 | URL |", "|---|---|---|---|"];
  for (const e of trail) {
    const label = tierCN[e.tier] ?? e.tier;
    const rules = (e.used_by_rules ?? []).join(", ");
    lines.push(`| ${label} | ${e.title ?? "-"} | ${rules} | ${e.url} |`);
  }
  const totalRules = new Set(trail.flatMap(e => e.used_by_rules ?? [])).size;
  lines.push("");
  lines.push(`合计 ${trail.length} 份权威资料 · ${totalRules} 条规则引用 · 全部 URL 可追溯`);
  return lines.join("\n");
}

function renderVerifyCommands(topIssues) {
  const rows = [];
  for (const r of topIssues) {
    const rec = r.recommendations?.[0];
    if (!rec || rec.fix_cost !== "trivial" || rec.verifiable === false) continue;
    const action = rec.action ?? "";
    // 从 action 推断 verify cmd · 业界 heuristic
    let verify = rec.verify ?? null;
    let expected = rec.expected ?? null;
    if (!verify) {
      const sysctl = action.match(/sysctl -w ([\w.]+)=(\S+)/);
      if (sysctl) {
        verify = `cat /proc/sys/${sysctl[1].replace(/\./g, "/")}`;
        expected = sysctl[2];
      }
      const echoProc = action.match(/echo (\S+)\s+>\s+(\/\S+)/);
      if (!verify && echoProc) {
        verify = `cat ${echoProc[2]}`;
        expected = echoProc[1];
      }
    }
    if (!verify) continue;
    rows.push({ action, verify, expected });
  }
  if (rows.length === 0) return "本次诊断未产生 trivial 级建议 · 无可自动验证的修复命令。";
  const lines = ["| # | 修复命令 | 验证命令 | 期望结果 |", "|---|---|---|---|"];
  rows.forEach((r, i) => lines.push(`| ${i + 1} | \`${r.action}\` | \`${r.verify}\` | ${r.expected ?? "-"} |`));
  return lines.join("\n");
}

function renderArtifacts(data, _mdPath) {
  const m = data.report_input?.metadata ?? {};
  const ts = data.discovered?.ts ?? new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-000001";
  const lines = [
    `- OS 采集: \`~/.perf-kp-sql/tmp/perf-kp-sql-os-${ts}.txt\``,
    `- DB 采集: \`~/.perf-kp-sql/tmp/perf-kp-sql-${m.engine ?? "mongo"}-db-${ts}.txt\``,
    `- 报告: \`${_mdPath}\``,
  ];
  return lines.join("\n");
}

// 已废除 renderFootnotes，改为 registry.render()

// ============================================================================
// Entry point · 放文件最底部避免 top-level `if (_isMain)` 在 const 声明之前
// 访问 HEALTHY_WHITELIST 等造成 TDZ ReferenceError
// ============================================================================

if (_isMain) {
  const data = JSON.parse(diagnoseJson);
  const input = data.report_input ?? data;
  const md = renderReport(input, data, mdPath);
  writeFileSync(mdPath, md);
  console.log(`✓ ${md.length} chars → ${mdPath}`);
}
