/**
 * parseSvg — 从 FlameGraph SVG 文件中提取 Top-N 热点函数
 *
 * flamegraph.pl 生成的 SVG 中，每个函数帧是一个 <rect> + <title> 元素。
 * title 格式：funcA;funcB;funcC (N samples, X.XX%)
 * 用正则提取 title 内容，按 self-time（叶子帧出现次数）聚合排序。
 */

export interface SvgHotFunction {
  name: string;
  /** 从完整栈路径推断的模块（最后一个 `;` 前的部分，或 "[unknown]"） */
  module: string;
  samples: number;
  percent: number;
}

export interface ParseSvgResult {
  functions: SvgHotFunction[];
  totalSamples: number;
  error?: string;
}

/**
 * 解析 flamegraph.pl 生成的 SVG，提取 Top-N 热点函数。
 *
 * 支持的 title 格式：
 * - `funcA;funcB;funcC (123 samples, 45.67%)`
 * - `funcA;funcB;funcC (123 samples, 45.67%)` (带空格变体)
 * - `all` (根节点，跳过)
 */
export function parseFlamegraphSvg(
  svgContent: string,
  topN: number = 10,
): ParseSvgResult {
  if (!svgContent || !svgContent.includes("<svg")) {
    return { functions: [], totalSamples: 0, error: "输入不是有效的 SVG 内容" };
  }

  // 提取所有 <title>...</title> 内容
  const titleRegex = /<title>([^<]+)<\/title>/g;
  const selfTimeMap = new Map<string, number>();
  let totalSamples = 0;
  let matchCount = 0;

  let match: RegExpExecArray | null;
  while ((match = titleRegex.exec(svgContent)) !== null) {
    const titleText = match[1]!.trim();

    // 跳过根节点和非栈 title
    if (titleText === "all" || titleText === "root") continue;

    // 解析格式：funcA;funcB;funcC (N samples, X.XX%)
    const parsed = /^(.+?)\s+\((\d+)\s+samples?,\s*([\d.]+)%\)$/.exec(titleText);
    if (!parsed) continue;

    matchCount++;
    // HTML entity 解码（flamegraph.pl 会把 C++ 模板的 <> 编码为 &lt;&gt;）
    const stackStr = decodeHtmlEntities(parsed[1]!);
    const samples = parseInt(parsed[2]!, 10);

    // 叶子函数 = 栈的最后一个函数
    const frames = stackStr.split(";");
    const leafFunc = frames[frames.length - 1]!.trim();

    // 累加 self-time
    const existing = selfTimeMap.get(leafFunc) ?? 0;
    selfTimeMap.set(leafFunc, existing + samples);
  }

  if (matchCount === 0) {
    return {
      functions: [],
      totalSamples: 0,
      error: "未找到 flamegraph.pl 格式的函数帧（<title> 标签）。可能不是 flamegraph.pl 生成的 SVG。",
    };
  }

  // 计算 total：所有叶子帧的 self-time 之和
  let selfTotal = 0;
  for (const samples of selfTimeMap.values()) {
    selfTotal += samples;
  }

  // 排序 + Top-N
  const sorted = Array.from(selfTimeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);

  const functions: SvgHotFunction[] = sorted.map(([name, samples]) => ({
    name,
    module: "[svg]", // SVG 中无 DSO 信息，标记为 [svg]
    samples,
    percent: selfTotal > 0 ? (samples / selfTotal) * 100 : 0,
  }));

  return { functions, totalSamples: selfTotal };
}

/** 解码 flamegraph.pl SVG 中的 HTML 实体（C++ 模板名含 &lt; &gt;） */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
