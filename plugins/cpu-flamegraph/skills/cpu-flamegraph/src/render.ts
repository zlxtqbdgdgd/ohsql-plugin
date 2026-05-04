/**
 * hotspot/render — 终端渲染
 *
 * **严格对齐**我们之前 Python 版 `hotspot_render.py::render_terminal` 的视觉风格：
 *   - `═══ 标题 ═══` 分段标题
 *   - 每张表**内嵌 "分布" 列（20 格 `█░` bar）**，不单列火焰图段
 *   - `═══ Top-5 代表调用链 ═══` 段：每个 top 函数后跟它最长的调用栈（`→` 分隔）
 *   - `═══ Top 按包含时间 ═══` 仅在与 self 视角不同时显示
 *
 * **本 TS 版的增量**（Python 版没有，但必要）：
 *   - 长 C++ 模板符号 `Foo<bar<baz<...>>>` 智能截断为 `Foo<…>` —— 实测 mongod 栈
 *     必需，否则表格被撑破
 *   - 模块标签来自 **perf script DSO 字段**，而非函数名正则猜（Python 硬编码版本
 *     遇到不在规则表里的函数就标 "unknown"，我们走 DSO 准确率 100%）
 */

import type { HotspotReport, HotFunction, CallTreeNode } from "./analyze.js";

// ---------------------------------------------------------------------------
// CJK 宽度 + 对齐（对齐 Python _dw / _pad 同语义）
// ---------------------------------------------------------------------------

function dw(s: string): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (
      (c >= 0x4e00 && c <= 0x9fff) ||
      (c >= 0x3000 && c <= 0x303f) ||
      (c >= 0xff00 && c <= 0xffef) ||
      (c >= 0x3400 && c <= 0x4dbf)
    )
      w += 2;
    else w += 1;
  }
  return w;
}

function pad(s: string, width: number, align: "left" | "right" | "center" = "left"): string {
  const diff = width - dw(s);
  if (diff <= 0) return s;
  if (align === "right") return " ".repeat(diff) + s;
  if (align === "center") {
    const l = Math.floor(diff / 2);
    return " ".repeat(l) + s + " ".repeat(diff - l);
  }
  return s + " ".repeat(diff);
}

// ---------------------------------------------------------------------------
// 20 格可视化 bar —— 8/8 子格精度 + 尾部点状消解（取代 Python 的粗糙 █░）
//
// 设计（参考 rich/tqdm 渐变 + brendangregg SVG 的"密度消解"）：
//   - 实部：`█` 全块
//   - 边界：按 1/8 粒度切 `▏▎▍▌▋▊▉`（8 个部分宽度，终端 smooth gradient）
//   - 空部：`·`（middle dot）做点状淡出，比 `░` 层次更清晰
//   - 整体精度 = (width × 8) 段，20 格 = 160 段
//
// 示例（width=20）：
//   100%  ████████████████████
//    66%  █████████████▎······
//    33%  ██████▋·············
//     5%  █···················
//     0%  ····················
// ---------------------------------------------------------------------------

const EIGHTH_BLOCKS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"]; // 1/8 ... 7/8

function mdBar(percent: number, width = 20): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const totalEighths = Math.round((clamped * width * 8) / 100);
  const fullCells = Math.floor(totalEighths / 8);
  const remain = totalEighths - fullCells * 8; // 0..7
  const partial = remain > 0 ? EIGHTH_BLOCKS[remain]! : "";
  const emptyCells = width - fullCells - (remain > 0 ? 1 : 0);
  // 空部用 ░（light shade）—— 比 `·` 中点更醒目，和 Python 老版同款，终端任何字体都显著
  return "█".repeat(Math.max(0, fullCells)) + partial + "░".repeat(Math.max(0, emptyCells));
}

function deltaCell(d: number | null): string {
  if (d === null) return "-";
  if (d > 0) return `▲ +${d.toFixed(1)}`;
  if (d < 0) return `▼ ${d.toFixed(1)}`;
  return "0.0";
}

// ---------------------------------------------------------------------------
// 长函数名智能截断（Python 版没做；对 C++ 模板是必需的）
// ---------------------------------------------------------------------------

function truncateFunc(name: string, max: number): string {
  if (name.length <= max) return name;
  const ltIdx = name.indexOf("<");
  if (ltIdx > 0 && ltIdx < max - 10) {
    let depth = 0;
    let gtIdx = -1;
    for (let i = ltIdx; i < name.length; i++) {
      if (name[i] === "<") depth++;
      else if (name[i] === ">") {
        depth--;
        if (depth === 0) {
          gtIdx = i;
          break;
        }
      }
    }
    if (gtIdx > ltIdx) {
      const prefix = name.slice(0, ltIdx);
      const suffix = name.slice(gtIdx + 1);
      const short = `${prefix}<…>${suffix}`;
      if (short.length <= max) return short;
      if (prefix.length + 4 < max) {
        return `${prefix}<…>${suffix.slice(0, max - prefix.length - 4)}…`;
      }
    }
  }
  const headLen = Math.max(10, Math.floor((max - 1) * 0.6));
  const tailLen = max - 1 - headLen;
  return name.slice(0, headLen) + "…" + name.slice(name.length - tailLen);
}

// ---------------------------------------------------------------------------
// box-drawing 表格（对齐 Python _render_box_table）
// ---------------------------------------------------------------------------

function renderBoxTable(
  headers: Array<{ title: string; align: "left" | "right" | "center" }>,
  rows: string[][],
): string {
  const cols = headers.length;
  const widths = headers.map((h) => dw(h.title));
  for (const row of rows) {
    for (let i = 0; i < cols; i++) {
      widths[i] = Math.max(widths[i]!, dw(row[i] ?? ""));
    }
  }
  // Python：左右各补 1 格
  const padded = widths.map((w) => w + 2);

  // 圆角 box（╭╮╰╯），比 ┌┐└┘ 视觉更柔和 —— gh/tmux 等现代 CLI 工具惯用
  const mkLine = (left: string, mid: string, right: string, fill: string) =>
    left + padded.map((w) => fill.repeat(w)).join(mid) + right;

  const top = mkLine("╭", "┬", "╮", "─");
  const sep = mkLine("├", "┼", "┤", "─");
  const bot = mkLine("╰", "┴", "╯", "─");

  const headerCells = headers
    .map((h, i) => " " + pad(h.title, padded[i]! - 2, h.align) + " ")
    .join("│");
  const headerLine = "│" + headerCells + "│";

  const rowLines = rows.map((row) =>
    "│" +
    headers
      .map((h, i) => " " + pad(row[i] ?? "", padded[i]! - 2, h.align) + " ")
      .join("│") +
    "│"
  );

  return [top, headerLine, sep, ...rowLines, bot].join("\n");
}

// ---------------------------------------------------------------------------
// ms 显示辅助
// ---------------------------------------------------------------------------

function nsToMs(ns: number): string {
  return (ns / 1_000_000).toFixed(2);
}

// ---------------------------------------------------------------------------
// 对外主入口
// ---------------------------------------------------------------------------

export interface RenderTerminalOptions {
  topN?: number;
  /** 函数名最大宽度（字符数），默认 60 */
  maxFuncLen?: number;
}

export function renderTerminal(
  report: HotspotReport,
  opts: RenderTerminalOptions = {},
): string {
  const topN = opts.topN ?? 10; // 对齐 Python 默认 Top 10
  const maxFuncLen = opts.maxFuncLen ?? 60;
  const meta = report.meta;
  const lines: string[] = [];

  // ── 采样元信息（对齐 Python 段） ──
  const total = (meta["total_samples"] as number) ?? 0;
  const top10Pct = report.hot_functions.slice(0, 10).reduce((s, h) => s + h.percent, 0);
  const ragHits = report.hot_functions.filter((h) => h.rag_hits.length > 0).length;
  lines.push("═══ 采样元信息 ═══");
  lines.push(
    `PID ${meta["pid"] ?? "?"} (${meta["comm"] ?? ""})  ` +
      `${meta["duration_sec"] ?? "?"}s  ${meta["freq_hz"] ?? "?"}Hz  ` +
      `${meta["mode"] ?? "on-cpu"}  scope=${meta["scope"] ?? "pid"}`,
  );
  lines.push(
    `CPU 时间合计 ${nsToMs(total)}ms  Top${Math.min(10, report.hot_functions.length)} 占比 ${top10Pct.toFixed(1)}%  RAG 命中 ${ragHits}/${report.hot_functions.length}`,
  );
  // 多核 CPU-time 可能超 wall-time 的说明
  const dur = meta["duration_sec"] as number | undefined;
  if (dur && total > dur * 1_000_000_000) {
    lines.push(
      `注：CPU 时间 > 采样窗口 ${dur}s 属正常 —— 多核 task-clock 累加，所有 CPU 核各忙 N 秒合计会超过 wall-time。`,
    );
  }
  lines.push("");

  // ── 热点函数 Top-N（Self，合计 100%） ──
  if (report.hot_functions.length > 0) {
    lines.push(`═══ 热点函数 Top ${Math.min(topN, report.hot_functions.length)} ═══`);
    const hasDelta = report.hot_functions.slice(0, topN).some((h) => h.delta_percent !== null);
    const headers: Array<{ title: string; align: "left" | "right" | "center" }> = hasDelta
      ? [
          { title: "#", align: "right" },
          { title: "函数", align: "left" },
          { title: "模块", align: "left" },
          { title: "占比", align: "right" },
          { title: "Δ", align: "right" },
          { title: "分布", align: "left" },
        ]
      : [
          { title: "#", align: "right" },
          { title: "函数", align: "left" },
          { title: "模块", align: "left" },
          { title: "占比", align: "right" },
          { title: "分布", align: "left" },
        ];
    const rows: string[][] = report.hot_functions.slice(0, topN).map((hf, i) => {
      const marker = hf.rag_hits.length > 0 ? "ⓘ " : "";
      const fn = marker + truncateFunc(hf.name, maxFuncLen);
      return hasDelta
        ? [
            String(i + 1),
            fn,
            hf.module,
            `${hf.percent.toFixed(1)}%`,
            deltaCell(hf.delta_percent),
            mdBar(hf.percent),
          ]
        : [String(i + 1), fn, hf.module, `${hf.percent.toFixed(1)}%`, mdBar(hf.percent)];
    });
    lines.push(renderBoxTable(headers, rows));
    if (hasDelta) {
      lines.push("ⓘ = 有 RAG 调优建议（知识库正则命中 · 非 LLM 推测）   ▲ 差分暴涨   ▼ 差分降低");
    } else if (ragHits > 0) {
      lines.push("ⓘ = 有 RAG 调优建议（知识库正则命中 · 非 LLM 推测）");
    }
    lines.push("");

  }

  // ── 调用树（业界对齐 perf report --children 默认两列布局）──
  //   Children% = 该函数及所有被调函数累计 CPU 占比（inclusive，perf 术语 "Children"）
  //   Self%     = 该函数**自己真正在跑 CPU** 的占比（exclusive，perf 术语 "Self"）
  //   高 Children / 0 Self = 只是调用链传递帧；高 Self = 真热点叶子。
  if (report.call_tree && report.call_tree.children.length > 0) {
    const hottestLeafName = report.hot_functions[0]?.name;
    const idleFiltered = report.meta["idle_filter_applied"] !== false;
    const filteredOut = (report.meta["idle_filtered_samples"] as number) ?? 0;
    lines.push("═══ 调用树（perf report --children 同款：Children=inclusive, Self=exclusive）═══");
    lines.push("  列含义：Children% = 含调用链累计占比    Self% = 函数自身占比");
    lines.push("  阈值：Children% ≥ 0.5%（同 perf/pprof 默认）；● 标记 Self Top-1");
    if (idleFiltered && filteredOut > 0) {
      lines.push(`  已过滤 ${filteredOut} 条 CPU 空闲采样（arch_cpu_idle/swapper 等，py-spy 同约定）`);
    }
    lines.push("");
    renderCallTree(lines, report.call_tree, hottestLeafName, maxFuncLen);
    lines.push("");
  }

  // ── 知识库解读（v0.3.0 加；命中时 inline snippet + [参考N] 引用，未命中走模板 B）──
  //   只对 self ≥ 5% 的函数渲染 —— 同 analyze.ts 里 KB lookup 的阈值。
  //   refs 按 source_url 去重计号；同一 url 共享同一个 [参考N]。
  renderKbSection(lines, report);

  // ── 差分变化（仅当真有基线 diff 时） ──
  if (report.diff_highlights && report.diff_highlights.length > 0) {
    lines.push(`═══ 差分变化（${report.diff_highlights.length} 项） ═══`);
    for (const hf of report.diff_highlights.slice(0, 10)) {
      const tag =
        hf.delta_percent !== null && hf.percent - hf.delta_percent < 0.01 ? "新增" : "变化";
      lines.push(
        `  ${tag}  ${truncateFunc(hf.name, maxFuncLen)}  模块=${hf.module}  ` +
          `${hf.percent.toFixed(1)}%  Δ ${deltaCell(hf.delta_percent)}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

// ---------------------------------------------------------------------------
// 调用树渲染（对齐 `perf report --children` 默认格式：Children% + Self% 两列）
//
// 默认参数业界对齐：
//   - Children% 阈值 0.5%（perf `--percent-limit` 默认 0.5；pprof `-nodefraction=0.005`）
//   - 每节点 top-N 子分支截断（避免爆炸）
//   - **线性链折叠**：连续单子节点且 Children% 相等（epsilon 内）时合并成一行
//     标注 `(N frames inline)`。perf/pprof 不折叠；我们这里折是因为终端窄、
//     且线性链信息量 = 1（没有分叉）。
//
// 格式示例：
//   main                                  [mongod]    90.1%   0.0%  █████████████████▋░░
//   └─ doCommand → runCommandImpl  (3 inline)         88.3%   0.0%  █████████████████▎░░
//      ├─ ● WiredTigerRecordStore::_insertRecords  [mongod]    45.2%  42.1%  █████████░░░░░░░░░░░
//      └─ IndexCatalogImpl::_indexRecords          [mongod]    40.0%   1.2%  ████████░░░░░░░░░░░░
//
// 列：Children% = inclusive（perf 术语），Self% = 该函数自己跑的比例（exclusive）。
// ---------------------------------------------------------------------------

/** Children% 阈值 —— perf `--percent-limit` 默认 0.5 / pprof `-nodefraction=0.005` 同款 */
const MIN_PCT_DISPLAY = 0.5;
/** 每节点最大展示子分支数（避免宽树爆炸） */
const MAX_CHILDREN_DISPLAY = 8;
/** 展示最大深度（防递归/深栈爆炸） */
const MAX_DEPTH_DISPLAY = 12;
/** 线性链 Children% 视作"相等"的 epsilon（0.1 个百分点）*/
const LINEAR_CHAIN_EPS = 0.1;

type TreeRow = {
  prefix: string;
  fn: string;
  module: string;
  percent: number;      // inclusive (Children%)
  selfPercent: number;  // exclusive (Self%)
  /** 折叠了多少个中间帧（含 fn 本身；1 表示单帧不折叠）*/
  inlineCount: number;
  /** 这是"省略 N 条分支"提示行 */
  isOmissionNote?: boolean;
};

/**
 * 沿单子链往下收集，直到遇到"分叉点或 Self% 显著"节点。
 * 返回：折叠链上最后一个节点，以及被折叠的中间节点名字列表（含起点）。
 *
 * 折叠条件：当前节点只有 1 个满足阈值的子、且子 Children% 和父几乎相等
 * （diff < epsilon）、且父 Self% ≈ 0（真正的"传递帧"，没贡献 CPU）。
 */
function collapseLinearChain(
  start: CallTreeNode,
  minCount: number,
): { end: CallTreeNode; inlineNames: string[] } {
  const inlineNames: string[] = [start.name];
  let cur = start;
  while (true) {
    const kids = cur.children.filter((c) => c.percent >= MIN_PCT_DISPLAY && c.count >= minCount);
    if (kids.length !== 1) break;
    const only = kids[0]!;
    if (Math.abs(only.percent - cur.percent) > LINEAR_CHAIN_EPS) break;
    if (cur.selfPercent > LINEAR_CHAIN_EPS) break; // 当前帧自己有热度，不能折掉
    cur = only;
    inlineNames.push(cur.name);
  }
  return { end: cur, inlineNames };
}

function renderCallTree(
  lines: string[],
  root: CallTreeNode,
  hottestLeafName: string | undefined,
  maxFuncLen: number,
): void {
  const rows: TreeRow[] = [];

  const walk = (
    n: CallTreeNode,
    prefix: string,
    isLast: boolean,
    isRoot: boolean,
    depth: number,
  ) => {
    // 尝试从 n 开始折叠线性链
    const { end, inlineNames } = collapseLinearChain(n, 0);
    const inlineCount = inlineNames.length;
    const connector = isRoot ? "" : isLast ? "└─ " : "├─ ";
    const nodePrefix = prefix + connector;

    const displayFn =
      inlineCount === 1
        ? truncateFunc(end.name, maxFuncLen)
        : truncateFunc(
            inlineNames.length > 2
              ? `${inlineNames[0]} → … → ${inlineNames[inlineNames.length - 1]}`
              : inlineNames.join(" → "),
            maxFuncLen,
          );

    rows.push({
      prefix: nodePrefix,
      fn: displayFn,
      module: end.module,
      percent: end.percent,
      selfPercent: end.selfPercent,
      inlineCount,
    });

    if (depth >= MAX_DEPTH_DISPLAY) {
      if (end.children.length > 0) {
        const nextPrefix = isRoot ? "" : prefix + (isLast ? "   " : "│  ");
        rows.push({
          prefix: nextPrefix + "└─ ",
          fn: `… 省略更深调用（${end.children.length} 分支）`,
          module: "",
          percent: 0,
          selfPercent: 0,
          inlineCount: 1,
          isOmissionNote: true,
        });
      }
      return;
    }

    const nextPrefix = isRoot ? "" : prefix + (isLast ? "   " : "│  ");
    const visibleKids = end.children
      .filter((c) => c.percent >= MIN_PCT_DISPLAY)
      .slice(0, MAX_CHILDREN_DISPLAY);
    const hiddenCount = end.children.length - visibleKids.length;
    for (let i = 0; i < visibleKids.length; i++) {
      walk(visibleKids[i]!, nextPrefix, i === visibleKids.length - 1 && hiddenCount === 0, false, depth + 1);
    }
    if (hiddenCount > 0) {
      rows.push({
        prefix: nextPrefix + "└─ ",
        fn: `… 省略 ${hiddenCount} 条分支（均 < ${MIN_PCT_DISPLAY}%；完整详情见服务器 perf-script.txt）`,
        module: "",
        percent: 0,
        selfPercent: 0,
        inlineCount: 1,
        isOmissionNote: true,
      });
    }
  };

  const visibleRoots = root.children
    .filter((c) => c.percent >= MIN_PCT_DISPLAY)
    .slice(0, MAX_CHILDREN_DISPLAY);
  const hiddenRoots = root.children.length - visibleRoots.length;
  for (let i = 0; i < visibleRoots.length; i++) {
    walk(visibleRoots[i]!, "", i === visibleRoots.length - 1 && hiddenRoots === 0, true, 1);
  }
  if (hiddenRoots > 0) {
    rows.push({
      prefix: "",
      fn: `… 省略 ${hiddenRoots} 条根分支（均 < ${MIN_PCT_DISPLAY}%）`,
      module: "",
      percent: 0,
      selfPercent: 0,
      inlineCount: 1,
      isOmissionNote: true,
    });
  }

  if (rows.length === 0) {
    lines.push("  （无 Children% ≥ 0.5% 的调用路径）");
    return;
  }

  // 标 ● 逻辑：Self Top-1 热点 在 rows 中的**实际展示名**匹配时打标
  const markerFor = (r: TreeRow): string => {
    if (!hottestLeafName) return "";
    if (r.inlineCount === 1 && r.fn === hottestLeafName) return " ●";
    return "";
  };

  // 列宽对齐
  const fnColWidth = Math.max(...rows.map((r) => dw(r.prefix + r.fn + markerFor(r))));
  const moduleColWidth = Math.max(...rows.map((r) => dw(r.module ? `[${r.module}]` : "")));

  for (const r of rows) {
    if (r.isOmissionNote) {
      lines.push(`  ${pad(r.prefix + r.fn, fnColWidth)}`);
      continue;
    }
    const marker = markerFor(r);
    const left = pad(r.prefix + r.fn + marker, fnColWidth);
    const mod = pad(r.module ? `[${r.module}]` : "", moduleColWidth);
    const childrenPct = `${r.percent.toFixed(1).padStart(5)}%`;
    const selfPct = `${r.selfPercent.toFixed(1).padStart(5)}%`;
    const bar = mdBar(r.percent);
    const collapsed = r.inlineCount > 1 ? `  (${r.inlineCount} frames inline)` : "";
    lines.push(`  ${left}  ${mod}  ${childrenPct}  ${selfPct}  ${bar}${collapsed}`);
  }
}

// ---------------------------------------------------------------------------
// 知识库解读段（self ≥ 5% 的函数 · 命中走 ✓ snippet [参考N] · miss 走模板 B）
//
// 为什么 5%：
//   - 与 analyze.ts 的 KB lookup 阈值同款（小于 5% 的函数查了也是噪音）
//   - 与业界 perf-tools 火焰图诊断惯例一致（Brendan Gregg 推荐 self ≥ 5%
//     才值得展开调优分析）
//
// refs 计号策略：同一 source_url 共享同一 [参考N]（去重）。url 第一次出现时
// 分配下一个编号；后续命中相同 url 复用。
// ---------------------------------------------------------------------------

const KB_MIN_PCT = 5.0;

function renderKbSection(lines: string[], report: HotspotReport): void {
  const qualified = report.hot_functions.filter((h) => h.percent >= KB_MIN_PCT);
  if (qualified.length === 0) return;

  // 至少一个函数有 KB 命中才渲染整段（全 miss 不渲染避免噪音）
  const anyHit = qualified.some((h) => h.rag_hits.length > 0);
  if (!anyHit) return;

  lines.push("═══ 知识库解读（基于知识库 · 非 LLM 推测）═══");
  lines.push("");

  const refs = new Map<string, number>();
  let nextRefIdx = 1;

  for (let i = 0; i < qualified.length; i++) {
    const hf = qualified[i]!;
    const fIdx = i + 1; // [F1] / [F2] ... 与 hot_functions 里的 self 排名对齐

    lines.push(`  \`${hf.name}\` 占 ${hf.percent.toFixed(1)}% [F${fIdx}]`);

    if (hf.rag_hits.length > 0) {
      const hit = hf.rag_hits[0]!;
      let refN = refs.get(hit.source_url);
      if (refN === undefined) {
        refN = nextRefIdx++;
        refs.set(hit.source_url, refN);
      }
      lines.push(`  ✓ 知识库命中 · semantic_group=${hit.semantic_group}`);
      lines.push(`  ${hit.snippet} [参考${refN}]`);
    } else {
      lines.push(`  知识库未覆盖 · module=${hf.module}`);
      lines.push(`  → 模板 B：请结合调用栈上下文和 SVG 独立判断`);
    }
    lines.push("");
  }

  if (refs.size > 0) {
    lines.push("  ─ 参考来源 ─");
    // Map 的迭代顺序 = 插入顺序 = 编号顺序，直接遍历就行
    for (const [url, idx] of refs) {
      lines.push(`  [参考${idx}] ${url}`);
    }
    lines.push("");
  }
}

// ---------------------------------------------------------------------------
// HTML 渲染（保留，无重大变化）
// ---------------------------------------------------------------------------
export function renderHotspotHtml(report: HotspotReport): string {
  const totalNs = (report.meta["total_samples"] as number) ?? 0;
  const top = report.hot_functions.slice(0, 20);
  const rows = top
    .map(
      (h, i) =>
        `<tr><td>${i + 1}</td><td>${esc(h.name)}</td><td>${esc(h.module)}</td>` +
        `<td>${h.percent.toFixed(1)}%</td><td>${nsToMs(h.samples)}</td></tr>`,
    )
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Hotspot Report</title>
<style>body{font:14px/1.6 -apple-system,Segoe UI,sans-serif;max-width:980px;margin:24px auto;padding:0 24px;}
table{width:100%;border-collapse:collapse;margin:16px 0;}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #e2e8f0;}
th{background:#f8fafc;font-size:11px;text-transform:uppercase;color:#64748b;}
.meta{color:#64748b;font-size:13px;}</style></head>
<body><h1>Hotspot Analysis</h1>
<div class="meta">CPU 时间合计=${nsToMs(totalNs)}ms</div>
<h2>Self Top 20（占比合计 100%）</h2>
<table><thead><tr><th>#</th><th>函数</th><th>模块</th><th>占比</th><th>CPU 时间(ms)</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
