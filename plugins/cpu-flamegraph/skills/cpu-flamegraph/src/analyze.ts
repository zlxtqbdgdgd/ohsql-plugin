/**
 * hotspot/analyze — 从 perf script samples 做 Top-N 聚合（Self/Inclusive）
 *
 * **架构变更**（vs 旧版）：之前输入是 stackcollapse-perf.pl 生成的 folded
 * 文本（`func1;func2;func3 N`），模块要用函数名硬编码正则回推，容易错。
 * 现在输入是 per-frame 带 DSO 的 PerfSample 列表，**模块直接从 DSO 取**，
 * 无硬编码。业界（perf report / Speedscope / go pprof）都是这样。
 *
 * 为了向后兼容已有 SVG 流水线（flamegraph.pl 读的是 folded 文本），
 * 我们提供 `samplesToFolded()` 双轨输出。
 *
 * **本 skill 版的剪裁**（vs ohsql 原版）：去掉了 sourceLookup（universal-ctags
 * 源码定位）依赖。原版 `HotFunction.source` 字段从未被 `analyze()` 填入，
 * 只是占位；这里直接删掉以保持 cartridge 自包含。
 */

import type { PerfSample } from "./parsePerfScript.js";
import { IDLE_FUNCTIONS, moduleFromDso } from "./parsePerfScript.js";
import { loadKbSeeds, lookupHotFunction, type KbHit } from "./kb-lookup.js";

export interface HotFunction {
  name: string;
  module: string;
  /** 样本权重（task-clock 下是纳秒累加，cpu-clock 下是样本数）*/
  samples: number;
  percent: number;
  /** 与基线 diff 的百分比变化，无 baseline 时 null */
  delta_percent: number | null;
  /** KB 命中（kb-lookup 写入；未命中时是 []，render 走"模板 B"路径）*/
  rag_hits: KbHit[];
  /** 该函数出现过的栈片段（最多 3 条），调用链分析用 */
  top_stacks: string[][];
}

/**
 * 调用树节点（从根到叶子的 prefix tree）。
 * 业界对齐：perf report --call-graph / go pprof --tree / py-spy dump。
 */
export interface CallTreeNode {
  name: string;
  module: string;
  /** 该节点及其所有后代在样本里累加的 period（inclusive，perf report "Children" 列）*/
  count: number;
  /** 该节点**作为叶子**时的累加 period（exclusive，perf report "Self" 列）*/
  selfCount: number;
  /** inclusive 占总样本比 */
  percent: number;
  /** self 占总样本比（= 该函数自己真正在跑 CPU 的占比）*/
  selfPercent: number;
  children: CallTreeNode[];
}

export interface HotspotReport {
  meta: Record<string, unknown>;
  /** Self time top-N（仅函数自身）—— 占比合计必然 = 100% */
  hot_functions: HotFunction[];
  /** Inclusive top（callers 也算）—— 每行占比独立，不做求和 */
  hot_paths: HotFunction[];
  /** 调用树（根到热点的 prefix tree，按 inclusive% 排序，已按阈值剪枝）*/
  call_tree: CallTreeNode | null;
  diff_highlights: HotFunction[] | null;
  flamegraph_svg_path: string | null;
  raw_folded_path: string;
}

const DEFAULT_TOP_N = 10;

/**
 * 主入口：PerfSample 列表聚合为 HotspotReport。
 * baselineSamples 可选；提供则计算 diff_highlights。
 *
 * KB 解读集成（v0.3.0）：当 `engine` + `kbDataDir` 都给齐时，对 self ≥ 5% 的
 * hot_functions 调 kb-lookup 填 `rag_hits`。任一缺失或 seed 文件不存在 →
 * 静默退化为纯采集（rag_hits 全空，render 不渲染 KB 段）。
 */
export function analyze(args: {
  samples: PerfSample[];
  baselineSamples?: PerfSample[] | null;
  meta?: Record<string, unknown>;
  topN?: number;
  /**
   * 是否保留 CPU 空闲栈（`arch_cpu_idle` / `swapper` 等）。默认 `false` —— 与
   * py-spy `--idle` 反向开关同款约定、Gregg "elide cpu_idle" 惯例一致。
   * 不过滤会让 100% idle 的机器显示成 "50% arch_cpu_idle / 50% swapper"，
   * 对诊断毫无价值。需要看空闲占比时用 `includeIdle: true`。
   */
  includeIdle?: boolean;
  /** KB 解读用的 engine 标识（mongo / mysql / redis）。未识别 → 不查 KB */
  engine?: string;
  /** KB seeds 目录，通常是 `<skill>/data/kb-seeds`。缺失 → 不查 KB */
  kbDataDir?: string;
}): HotspotReport {
  const { samples: rawSamples, baselineSamples, meta = {}, topN = DEFAULT_TOP_N, includeIdle = false, engine, kbDataDir } = args;

  const samples = includeIdle ? rawSamples : filterIdleSamples(rawSamples);
  const filteredOut = rawSamples.length - samples.length;
  const totalSamples = samples.reduce((s, x) => s + x.period, 0);
  const { hotFuncs, hotPaths } = aggregate(samples, totalSamples, topN);

  // KB 解读填充：仅对 self ≥ 3% 的函数查 KB（v0.5.9 从 5% 下调至 3% ·
  // 多热点分散场景下 5% 太严 · 会导致 deflate_slow 4.7% 等有价值热点被跳过）
  if (engine && kbDataDir) {
    try {
      const facts = loadKbSeeds(engine, kbDataDir);
      if (facts.length > 0) {
        for (const hf of hotFuncs) {
          if (hf.percent < 3.0) continue;
          hf.rag_hits = lookupHotFunction(hf.name, hf.module, facts);
        }
      }
    } catch {
      // seeds 损坏 / 读盘错误 → 静默退化为纯采集，不阻塞主流程
    }
  }

  // diff
  let diffHighlights: HotFunction[] | null = null;
  if (baselineSamples && baselineSamples.length > 0) {
    const baseRaw = includeIdle ? baselineSamples : filterIdleSamples(baselineSamples);
    const baseTotal = baseRaw.reduce((s, x) => s + x.period, 0);
    const { hotFuncs: baseHot } = aggregate(baseRaw, baseTotal, topN * 5);
    const baseMap = new Map(baseHot.map((h) => [h.name, h.percent]));
    for (const hf of hotFuncs) {
      const oldPct = baseMap.get(hf.name);
      hf.delta_percent = oldPct === undefined ? hf.percent : hf.percent - oldPct;
    }
    diffHighlights = hotFuncs.filter(
      (h) => h.delta_percent !== null && Math.abs(h.delta_percent) >= 1.0,
    );
  }

  // 调用树（inclusive tree）—— 剪枝阈值 0.5%（perf/pprof 默认值），深度 15
  const callTree = samples.length > 0 ? buildCallTree(samples, totalSamples, 0.5, 15) : null;

  return {
    meta: {
      ...meta,
      total_samples: totalSamples,
      idle_filtered_samples: filteredOut,
      idle_filter_applied: !includeIdle,
    },
    hot_functions: hotFuncs,
    hot_paths: hotPaths,
    call_tree: callTree,
    diff_highlights: diffHighlights,
    flamegraph_svg_path: null,
    raw_folded_path: "",
  };
}

/**
 * 把 **叶子在 IDLE_FUNCTIONS 集合中** 的采样整条去掉。
 *
 * 为什么只看叶子：调用链上半段像 `start_kernel / cpu_startup_entry` 在 Linux
 * 里也可能是真任务的祖先（极少，但存在）。只判叶子更精准——这是 py-spy 的
 * `--idle` 识别逻辑（见 py-spy `src/python_spy.rs` 里 `is_idle`）。
 */
function filterIdleSamples(samples: PerfSample[]): PerfSample[] {
  return samples.filter((s) => {
    for (let i = s.stack.length - 1; i >= 0; i--) {
      const fn = s.stack[i]!.fn;
      if (!fn || fn === "[unknown]") continue;
      return !IDLE_FUNCTIONS.has(fn);
    }
    return false; // 栈全空 / 全 unknown 也丢
  });
}

// ---------------------------------------------------------------------------
// 调用树构建（inclusive · 业界对齐 perf report --call-graph / pprof --tree）
// ---------------------------------------------------------------------------

/** 内部节点（构建期使用 Map；输出 CallTreeNode 用 Array）*/
interface MutableTreeNode {
  name: string;
  module: string;
  count: number;
  selfCount: number;
  children: Map<string, MutableTreeNode>;
}

/**
 * 构建 inclusive call tree。
 * @param samples  原始 PerfSample 列表
 * @param total    总 period，用于算 %
 * @param minPct   节点 inclusive% 阈值（低于此值的节点直接不入树，避免长尾噪音）
 * @param maxDepth 最大深度（防栈过深爆炸）
 */
export function buildCallTree(
  samples: PerfSample[],
  total: number,
  minPct: number,
  maxDepth: number,
): CallTreeNode | null {
  if (total === 0) return null;
  const root: MutableTreeNode = { name: "<root>", module: "", count: 0, selfCount: 0, children: new Map() };
  for (const s of samples) {
    let cur = root;
    cur.count += s.period;
    const lim = Math.min(s.stack.length, maxDepth);
    let last: MutableTreeNode | null = null;
    for (let i = 0; i < lim; i++) {
      const frame = s.stack[i]!;
      if (!frame.fn) continue;
      let child = cur.children.get(frame.fn);
      if (!child) {
        child = {
          name: frame.fn,
          module: moduleFromDso(frame.dso),
          count: 0,
          selfCount: 0,
          children: new Map(),
        };
        cur.children.set(frame.fn, child);
      }
      child.count += s.period;
      cur = child;
      last = child;
    }
    if (last) last.selfCount += s.period; // 栈尾节点 = 这次采样的 self 归属
  }
  const minCount = (minPct * total) / 100;
  const convert = (n: MutableTreeNode): CallTreeNode => {
    const kids = Array.from(n.children.values())
      .filter((c) => c.count >= minCount)
      .sort((a, b) => b.count - a.count)
      .map(convert);
    return {
      name: n.name,
      module: n.module,
      count: n.count,
      selfCount: n.selfCount,
      percent: (n.count * 100) / total,
      selfPercent: (n.selfCount * 100) / total,
      children: kids,
    };
  };
  const tree = convert(root);
  if (tree.children.length === 0) return null;
  return tree;
}

// ---------------------------------------------------------------------------
// 聚合
// ---------------------------------------------------------------------------

function aggregate(
  samples: PerfSample[],
  totalSamples: number,
  topN: number,
): { hotFuncs: HotFunction[]; hotPaths: HotFunction[] } {
  if (totalSamples === 0) {
    return { hotFuncs: [], hotPaths: [] };
  }

  // self = leaf；inclusive = 栈中任意位置
  const selfCount = new Map<string, number>();
  const selfModule = new Map<string, string>();
  const inclusiveCount = new Map<string, number>();
  const inclusiveModule = new Map<string, string>();
  const stackTrace = new Map<string, string[][]>();

  for (const s of samples) {
    // 跳过 [unknown] 叶子，找有效 leaf
    let leafIdx = s.stack.length - 1;
    while (leafIdx >= 0 && (!s.stack[leafIdx]!.fn || s.stack[leafIdx]!.fn === "[unknown]")) {
      leafIdx--;
    }
    if (leafIdx < 0) continue;
    const leafFrame = s.stack[leafIdx]!;
    selfCount.set(leafFrame.fn, (selfCount.get(leafFrame.fn) ?? 0) + s.period);
    if (!selfModule.has(leafFrame.fn)) {
      selfModule.set(leafFrame.fn, moduleFromDso(leafFrame.dso));
    }

    const stackFns = s.stack.map((f) => f.fn);
    const seen = new Set<string>();
    for (const frame of s.stack) {
      if (!frame.fn || frame.fn === "[unknown]") continue;
      if (seen.has(frame.fn)) continue;
      seen.add(frame.fn);
      inclusiveCount.set(frame.fn, (inclusiveCount.get(frame.fn) ?? 0) + s.period);
      if (!inclusiveModule.has(frame.fn)) {
        inclusiveModule.set(frame.fn, moduleFromDso(frame.dso));
      }
      const tr = stackTrace.get(frame.fn) ?? [];
      if (tr.length < 3) {
        tr.push(stackFns);
        stackTrace.set(frame.fn, tr);
      }
    }
  }

  const hotFuncs: HotFunction[] = Array.from(selfCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name, count]) => ({
      name,
      module: selfModule.get(name) ?? "unknown",
      samples: count,
      percent: (count * 100) / totalSamples,
      delta_percent: null,
      rag_hits: [],
      top_stacks: stackTrace.get(name) ?? [],
    }));

  const hotPaths: HotFunction[] = Array.from(inclusiveCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name, count]) => ({
      name,
      module: inclusiveModule.get(name) ?? "unknown",
      samples: count,
      percent: (count * 100) / totalSamples,
      delta_percent: null,
      rag_hits: [],
      top_stacks: stackTrace.get(name) ?? [],
    }));

  return { hotFuncs, hotPaths };
}

/**
 * 把 PerfSample 序列转成 FlameGraph folded 文本（`root;mid;leaf N` 行格式）。
 * 供 flamegraph.pl 生成 SVG 用 —— 保持现有 SVG 流水线不变。
 */
export function samplesToFolded(samples: PerfSample[]): string {
  const acc = new Map<string, number>();
  for (const s of samples) {
    if (s.stack.length === 0) continue;
    const key = s.stack.map((f) => f.fn || "[unknown]").join(";");
    acc.set(key, (acc.get(key) ?? 0) + s.period);
  }
  return Array.from(acc.entries())
    .map(([stack, count]) => `${stack} ${count}`)
    .join("\n");
}
