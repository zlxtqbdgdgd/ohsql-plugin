#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath as __fileURLToPath } from "url";
import { dirname as __pathDirname } from "path";
const require = createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __pathDirname(__filename);

// skills/cpu-flamegraph/src/cli-analyze.ts
import { readFileSync } from "node:fs";

// skills/cpu-flamegraph/src/parseSvg.ts
function parseFlamegraphSvg(svgContent, topN = 10) {
  if (!svgContent || !svgContent.includes("<svg")) {
    return { functions: [], totalSamples: 0, error: "\u8F93\u5165\u4E0D\u662F\u6709\u6548\u7684 SVG \u5185\u5BB9" };
  }
  const titleRegex = /<title>([^<]+)<\/title>/g;
  const selfTimeMap = /* @__PURE__ */ new Map();
  let totalSamples = 0;
  let matchCount = 0;
  let match;
  while ((match = titleRegex.exec(svgContent)) !== null) {
    const titleText = match[1].trim();
    if (titleText === "all" || titleText === "root") continue;
    const parsed = /^(.+?)\s+\((\d+)\s+samples?,\s*([\d.]+)%\)$/.exec(titleText);
    if (!parsed) continue;
    matchCount++;
    const stackStr = decodeHtmlEntities(parsed[1]);
    const samples = parseInt(parsed[2], 10);
    const frames = stackStr.split(";");
    const leafFunc = frames[frames.length - 1].trim();
    const existing = selfTimeMap.get(leafFunc) ?? 0;
    selfTimeMap.set(leafFunc, existing + samples);
  }
  if (matchCount === 0) {
    return {
      functions: [],
      totalSamples: 0,
      error: "\u672A\u627E\u5230 flamegraph.pl \u683C\u5F0F\u7684\u51FD\u6570\u5E27\uFF08<title> \u6807\u7B7E\uFF09\u3002\u53EF\u80FD\u4E0D\u662F flamegraph.pl \u751F\u6210\u7684 SVG\u3002"
    };
  }
  let selfTotal = 0;
  for (const samples of selfTimeMap.values()) {
    selfTotal += samples;
  }
  const sorted = Array.from(selfTimeMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, topN);
  const functions = sorted.map(([name, samples]) => ({
    name,
    module: "[svg]",
    // SVG 中无 DSO 信息，标记为 [svg]
    samples,
    percent: selfTotal > 0 ? samples / selfTotal * 100 : 0
  }));
  return { functions, totalSamples: selfTotal };
}
function decodeHtmlEntities(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// skills/cpu-flamegraph/src/interpretHotspot.ts
function interpretHotspot(name, module, isOffcpu) {
  if (!name) {
    return isOffcpu ? "\u672A\u8BC6\u522B\u5230\u660E\u786E\u7684\u7B49\u5F85\u70ED\u70B9\uFF0C\u9700\u7ED3\u5408\u4E1A\u52A1\u9AD8\u5CF0\u671F\u518D\u6B21\u91C7\u6837" : "\u672A\u8BC6\u522B\u5230\u660E\u786E\u7684 CPU \u70ED\u70B9\uFF0C\u9700\u7ED3\u5408\u4E1A\u52A1\u9AD8\u5CF0\u671F\u518D\u6B21\u91C7\u6837";
  }
  const lowerName = name.toLowerCase();
  const lowerModule = (module ?? "").toLowerCase();
  if (isOffcpu) {
    if (lowerName.includes("futex") || lowerName.includes("mutex") || lowerName.includes("cond")) {
      return "\u70ED\u70B9\u66F4\u50CF\u9501\u7B49\u5F85\u6216\u7EBF\u7A0B\u540C\u6B65\u7B49\u5F85\uFF0C\u4F18\u5148\u6392\u67E5\u5E76\u53D1\u4E89\u7528\u800C\u4E0D\u662F CPU \u7B97\u529B\u4E0D\u8DB3";
    }
    if (lowerName.includes("epoll") || lowerName.includes("poll") || lowerName.includes("io") || lowerModule.includes("io")) {
      return "\u70ED\u70B9\u66F4\u50CF IO/\u4E8B\u4EF6\u7B49\u5F85\uFF0C\u4F18\u5148\u6392\u67E5\u78C1\u76D8\u3001\u7F51\u7EDC\u6216\u4E0A\u6E38\u8C03\u7528\u94FE\u8DEF";
    }
    return "\u70ED\u70B9\u4E3B\u8981\u4F53\u73B0\u7B49\u5F85\u65F6\u95F4\u6D88\u8017\uFF0C\u9700\u7ED3\u5408\u8C03\u7528\u94FE\u5224\u65AD\u662F\u9501\u3001IO \u8FD8\u662F\u7F51\u7EDC\u7B49\u5F85";
  }
  if (lowerModule.includes("mongosh") || lowerName.includes("async") || lowerName.includes("await")) {
    return "\u70ED\u70B9\u66F4\u50CF\u91C7\u96C6\u4FA7\u6216\u5BA2\u6237\u7AEF\u5F02\u6B65\u5F00\u9500\uFF0C\u672C\u6B21\u672A\u89C1 mongod \u6838\u5FC3\u6267\u884C\u8DEF\u5F84\u6210\u4E3A\u4E3B\u8981 CPU \u74F6\u9888";
  }
  if (lowerModule.includes("mongod") || lowerModule.includes("wiredtiger")) {
    return "\u70ED\u70B9\u5DF2\u8FDB\u5165\u6570\u636E\u5E93\u5F15\u64CE\u4FA7\uFF0C\u5EFA\u8BAE\u7ED3\u5408\u6162\u67E5\u8BE2\u3001\u9501\u4E0E\u7F13\u5B58\u6307\u6807\u7EE7\u7EED\u6DF1\u6316";
  }
  if (lowerName.includes("sched") || lowerName.includes("idle")) {
    return "\u6837\u672C\u66F4\u591A\u53CD\u6620\u8C03\u5EA6\u6216\u7A7A\u95F2\u884C\u4E3A\uFF0C\u4E0D\u50CF\u7A33\u5B9A\u7684\u4E1A\u52A1\u70ED\u70B9\uFF0C\u5EFA\u8BAE\u5728\u8D1F\u8F7D\u66F4\u9AD8\u65F6\u590D\u67E5";
  }
  return "\u70ED\u70B9\u5DF2\u5B9A\u4F4D\u5230\u5177\u4F53\u51FD\u6570\uFF0C\u53EF\u7ED3\u5408\u62A5\u544A\u4E2D\u7684\u8C03\u7528\u94FE\u548C\u53EF\u89C6\u5316\u4EA7\u7269\u7EE7\u7EED\u5224\u65AD\u4E1A\u52A1\u542B\u4E49";
}

// skills/cpu-flamegraph/src/cli-analyze.ts
function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) return { error: `unknown arg: ${a} (expect --key=value)` };
    out[m[1]] = m[2];
  }
  if (!out["svg"]) return { error: "missing required arg: --svg=<path>" };
  const type = out["type"];
  if (type && type !== "oncpu" && type !== "offcpu") {
    return { error: `--type must be oncpu or offcpu (got: ${type})` };
  }
  const args = { svg: out["svg"] };
  if (type) args.type = type;
  return args;
}
function main() {
  const parsed = parseArgs(process.argv);
  if ("error" in parsed) {
    process.stderr.write(`error: ${parsed.error}
`);
    return 1;
  }
  const isOffcpu = parsed.type === "offcpu";
  const timeLabel = isOffcpu ? "\u7B49\u5F85\u65F6\u95F4" : "CPU \u65F6\u95F4";
  let svgContent;
  try {
    svgContent = readFileSync(parsed.svg, "utf-8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`\u65E0\u6CD5\u8BFB\u53D6 SVG \u6587\u4EF6\uFF1A${msg}
`);
    return 1;
  }
  const result = parseFlamegraphSvg(svgContent, 10);
  if (result.error) {
    process.stderr.write(result.error + "\n");
    return 1;
  }
  if (result.functions.length === 0) {
    process.stderr.write("SVG \u4E2D\u672A\u63D0\u53D6\u5230\u70ED\u70B9\u51FD\u6570\n");
    return 1;
  }
  const top1 = result.functions[0];
  const interpretation = interpretHotspot(top1.name, null, isOffcpu);
  const summary = `Top \u70ED\u70B9\u4E3A ${top1.name} ${top1.percent.toFixed(1)}%`;
  const out = {
    ok: true,
    mode: isOffcpu ? "offcpu" : "oncpu",
    timeLabel,
    summary,
    top1: { name: top1.name, percent: parseFloat(top1.percent.toFixed(1)) },
    interpretation,
    hot_functions_top5: result.functions.slice(0, 5).map((fn) => ({
      name: fn.name,
      percent: parseFloat(fn.percent.toFixed(1))
    }))
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  return 0;
}
process.exit(main());
