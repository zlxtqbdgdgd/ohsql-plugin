#!/usr/bin/env node
// render-html-report.mjs
// One-shot: diagnose.mjs JSON → final .html report (no intermediate .md for user).
// LLM only invokes this script; no Write tool calls for report files.
//
// Internally:
//   1. Calls render-report.mjs logic → md (in-memory)
//   2. Calls md-to-html.mjs logic → final .html
//   3. No .md written to user-visible paths (optional --keep-md <path> for debug)
//
// Usage:
//   node render-html-report.mjs <html-path> --from-diagnose <diagnose-json> [--from-flame-json <flame-json>]
//   cat diagnose.json | node render-html-report.mjs <html-path>

import { readFileSync, writeFileSync } from "node:fs";
import { marked } from "marked";
import { renderReportFromDiagnoseJson } from "./render-report.mjs";

const args = process.argv.slice(2);
const htmlPath = args[0];
if (!htmlPath) {
  console.error("usage: render-html-report.mjs <html-path> --from-diagnose <json-path> [--from-flame-json <flame-json-path>] [--ssh-user u --ssh-host h --ssh-port p] [--os-collect-path <path> --db-collect-path <path>]");
  process.exit(1);
}

const fromIdx = args.indexOf("--from-diagnose");
const diagnoseJson = fromIdx >= 0 && args[fromIdx + 1]
  ? readFileSync(args[fromIdx + 1], "utf8")
  : readFileSync(0, "utf8");

// v0.23.0 · 2026-04-26 · 用户反馈 · SSH user/host/port 通过 CLI flag 注入
// 远端 mongod bind=127.0.0.1 是远端进程视角的本地监听 IP · 用户视角下毫无意义。
// LLM 调本脚本时应把"自己 SSH 实际连的 user@host:port"传进来。
function pickArg(name) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : undefined;
}
const flameArgPath = pickArg("--from-flame-json");
const metaOverrides = {
  ssh_user: pickArg("--ssh-user"),
  ssh_host: pickArg("--ssh-host"),
  ssh_port: pickArg("--ssh-port"),
  report_path: htmlPath,
  flame_path: flameArgPath,
  // v0.23.1 · MAJOR review 反馈 · 实际采集落盘路径必须从 SKILL.md 4.2 透传 ·
  // 不让 renderArtifacts 按 ts 猜路径(猜出来的前缀和顺序与实际命名不一致)
  os_collect_path: pickArg("--os-collect-path"),
  db_collect_path: pickArg("--db-collect-path"),
};

// metadata 注入:在 renderReport 之前 patch report_input.metadata
// 让 render-report.mjs::renderMetadata / renderArtifacts 直接取
const diagObj = JSON.parse(diagnoseJson);
if (diagObj.report_input?.metadata) {
  for (const [k, v] of Object.entries(metaOverrides)) {
    if (v !== undefined && v !== null && v !== "") {
      diagObj.report_input.metadata[k] = v;
    }
  }
}
const patchedJson = JSON.stringify(diagObj);

let md = renderReportFromDiagnoseJson(patchedJson);

// Include Flamegraph Data if present
const flameIdx = args.indexOf("--from-flame-json");
if (flameIdx >= 0 && args[flameIdx + 1]) {
  try {
    const flameData = JSON.parse(readFileSync(args[flameIdx + 1], "utf8"));
    if (flameData.ok && flameData.terminalReport) {
      const flameMd = `\n## 火焰图分析\n\n\`\`\`text\n${flameData.terminalReport}\n\`\`\`\n`;
      // Insert before "## 参考" if it exists
      const lines = md.split("\n");
      const refIdx = lines.findIndex(l => l.startsWith("## 参考"));
      if (refIdx >= 0) {
        lines.splice(refIdx, 0, ...flameMd.split("\n"));
        md = lines.join("\n");
      } else {
        md += flameMd;
      }
    }
  } catch (e) {
    
  }
}

// 1b. 从 md 原文抽 `## 参考` 段的 `[参考N]` 键值对
function extractFootnoteRefsFromMd(mdText) {
  const startIdx = mdText.indexOf("## 参考");
  if (startIdx < 0) return [];
  const tail = mdText.slice(startIdx);
  const endIdx = tail.indexOf("\n## ", 1);
  const section = endIdx >= 0 ? tail.slice(0, endIdx) : tail;
  const refs = [];
  for (const m of section.matchAll(/^\[参考(\d+)\]\s+(\S+)/gm)) {
    refs.push({ n: Number(m[1]), url: m[2] });
  }
  return refs;
}
const footnoteRefs = extractFootnoteRefsFromMd(md);
const refUrlByN = new Map(footnoteRefs.map(({ n, url }) => [n, url]));

// 2. md → html
marked.setOptions({ gfm: true, breaks: false });
let body = marked.parse(md);

body = body.replace(/\[参考(\d+)\]/g, (_, n) => {
  const url = refUrlByN.get(Number(n));
  return url
    ? `<sup class="fn-ref"><a href="${url}" target="_blank" rel="noopener">${n}</a></sup>`
    : `<sup class="fn-ref"><a href="#fn-${n}">${n}</a></sup>`;
});

body = body.replace(
  /<h2[^>]*>参考[^<]*<\/h2>\s*([\s\S]*?)(?=<h2|<div class="footer|<\/body>|$)/,
  (_m, _inner) => {
    const lis = [];
    for (const { n, url } of footnoteRefs.slice().sort((a, b) => a.n - b.n)) {
      lis.push(`  <li id="fn-${n}"><a href="${url}" target="_blank" rel="noopener">${url}</a></li>`);
    }
    return `<h2>参考</h2>\n<ol class="footnotes">\n${lis.join("\n")}\n</ol>\n`;
  }
);

// Table elements need to be wrapped to be styled correctly as cards if they aren't parsed with surrounding divs
body = body.replace(/<table>/g, '<div class="table-container"><table>');
body = body.replace(/<\/table>/g, '</table></div>');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>perf-kp-sql · 性能诊断报告</title>
<style>
:root {
  --primary: #0F172A;
  --accent: #2563EB;
  --bg: #F8FAFC;
  --card: #FFFFFF;
  --text: #334155;
  --text-muted: #64748B;
  --border: #E2E8F0;
}
* { box-sizing: border-box; }
body {
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.6;
  color: var(--text);
  max-width: 1100px;
  margin: 0 auto;
  padding: 40px 24px;
  background: var(--bg);
}
h1 {
  font-size: 32px;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 2px solid var(--border);
}
h2 {
  font-size: 22px;
  font-weight: 600;
  color: var(--primary);
  margin-top: 48px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
}
h2::before {
  content: "";
  display: inline-block;
  width: 4px;
  height: 22px;
  background: var(--accent);
  margin-right: 12px;
  border-radius: 2px;
}
h3 { font-size: 17px; font-weight: 600; color: var(--primary); margin-top: 28px; }

/* Cards for sections */
body > p, .table-container, body > pre, body > details, body > blockquote, body > ul, body > ol {
  background: var(--card);
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03);
  margin-bottom: 20px;
  border: 1px solid var(--border);
  overflow-x: auto;
}
/* Tables */
.table-container { padding: 0 !important; overflow: hidden; }
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  padding: 14px 20px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
th {
  background: #F8FAFC;
  font-weight: 600;
  font-size: 13px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: #F1F5F9; }

/* Terminal / Code */
pre {
  background: #1E293B !important;
  color: #F8FAFC;
  padding: 24px !important;
  overflow-x: auto;
  font-family: "JetBrains Mono", "SF Mono", Consolas, monospace;
  font-size: 13.5px;
  line-height: 1.6;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.2) !important;
  border: none !important;
}
code {
  font-family: "JetBrains Mono", "SF Mono", Consolas, monospace;
  background: #F1F5F9;
  padding: 3px 6px;
  border-radius: 6px;
  font-size: 0.9em;
  color: #EF4444;
}
pre code { background: transparent; padding: 0; color: inherit; }

/* Links */
a { color: var(--accent); text-decoration: none; font-weight: 500; }
a:hover { text-decoration: underline; }

/* Details */
details { padding: 16px 24px !important; transition: all 0.2s; }
details summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--primary);
  outline: none;
  user-select: none;
}
details[open] summary { margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }

/* Footnotes */
sup.fn-ref {
  display: inline-block;
  background: #DBEAFE;
  color: #1E40AF;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 12px;
  margin: 0 2px;
  vertical-align: super;
  line-height: 1;
}
sup.fn-ref a { color: inherit; text-decoration: none; }
sup.fn-ref:hover { background: var(--accent); color: white; }
ol.footnotes { padding: 24px 24px 24px 44px !important; font-size: 13.5px; color: var(--text-muted); }
ol.footnotes li { margin-bottom: 10px; scroll-margin-top: 40px; }
ol.footnotes li::marker { color: var(--accent); font-weight: 600; }

.footer {
  margin-top: 60px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}
</style>
</head>
<body>
<h1>perf-kp-sql · 性能诊断报告</h1>
${body}
<div class="footer">
  perf-kp-sql · kunpeng 全栈数据库性能诊断 · 规则依据:鲲鹏原厂规范 + MongoDB 官方文档
</div>
</body>
</html>
`;

writeFileSync(htmlPath, html);
console.log(`✓ ${html.length} bytes → ${htmlPath} (in-memory md · no disk intermediate)`);
