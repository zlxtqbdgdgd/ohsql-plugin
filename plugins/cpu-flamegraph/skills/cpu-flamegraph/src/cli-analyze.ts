/**
 * cli-analyze — 本地 SVG 解析 CLI 入口
 *
 * Usage:
 *   node scripts/analyze.mjs --svg=<path-to-svg> [--type=oncpu|offcpu]
 *
 * 输出：单段 JSON 到 stdout（结构化）；失败时 exitCode=1 + stderr。
 */

import { readFileSync } from "node:fs";
import { parseFlamegraphSvg } from "./parseSvg.js";
import { interpretHotspot } from "./interpretHotspot.js";

interface Args {
  svg: string;
  type?: "oncpu" | "offcpu";
}

function parseArgs(argv: string[]): Args | { error: string } {
  const out: Record<string, string> = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) return { error: `unknown arg: ${a} (expect --key=value)` };
    out[m[1]!] = m[2]!;
  }
  if (!out["svg"]) return { error: "missing required arg: --svg=<path>" };
  const type = out["type"];
  if (type && type !== "oncpu" && type !== "offcpu") {
    return { error: `--type must be oncpu or offcpu (got: ${type})` };
  }
  const args: Args = { svg: out["svg"]! };
  if (type) args.type = type as "oncpu" | "offcpu";
  return args;
}

function main(): number {
  const parsed = parseArgs(process.argv);
  if ("error" in parsed) {
    process.stderr.write(`error: ${parsed.error}\n`);
    return 1;
  }
  const isOffcpu = parsed.type === "offcpu";
  const timeLabel = isOffcpu ? "等待时间" : "CPU 时间";

  let svgContent: string;
  try {
    svgContent = readFileSync(parsed.svg, "utf-8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`无法读取 SVG 文件：${msg}\n`);
    return 1;
  }

  const result = parseFlamegraphSvg(svgContent, 10);
  if (result.error) {
    process.stderr.write(result.error + "\n");
    return 1;
  }
  if (result.functions.length === 0) {
    process.stderr.write("SVG 中未提取到热点函数\n");
    return 1;
  }

  const top1 = result.functions[0]!;
  const interpretation = interpretHotspot(top1.name, null, isOffcpu);
  const summary = `Top 热点为 ${top1.name} ${top1.percent.toFixed(1)}%`;

  const out = {
    ok: true,
    mode: isOffcpu ? "offcpu" : "oncpu",
    timeLabel,
    summary,
    top1: { name: top1.name, percent: parseFloat(top1.percent.toFixed(1)) },
    interpretation,
    hot_functions_top5: result.functions.slice(0, 5).map((fn) => ({
      name: fn.name,
      percent: parseFloat(fn.percent.toFixed(1)),
    })),
  };

  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  return 0;
}

process.exit(main());
