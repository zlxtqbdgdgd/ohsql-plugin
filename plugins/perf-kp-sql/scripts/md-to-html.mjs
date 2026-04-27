#!/usr/bin/env node
// md-to-html.mjs
// Render a perf-kp-sql diagnosis .md report into a full standalone .html using
// the same stylesheet as templates/report.html. LLM only writes the .md; HTML
// is mechanically generated to guarantee content parity + [参考N] markers.
//
// Usage:
//   node scripts/md-to-html.mjs <md-path> <html-path>

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { marked } from "marked";

const [mdPath, htmlPath] = process.argv.slice(2);
if (!mdPath || !htmlPath) {
  console.error("usage: md-to-html.mjs <md-path> <html-path>");
  process.exit(1);
}
if (!existsSync(mdPath)) { console.error(`md not found: ${mdPath}`); process.exit(1); }

const md = readFileSync(mdPath, "utf8");

// Post-process [参考N] → <sup class="fn-ref"><a href="#fn-N">N</a></sup> after marked renders
marked.setOptions({ gfm: true, breaks: false });

// 1. Render md → html body (marked handles tables / details / headings / links)
let body = marked.parse(md);

// 2. Replace [参考N] inline markers with <sup>
body = body.replace(/\[参考(\d+)\]/g, (_, n) => `<sup class="fn-ref"><a href="#fn-${n}">${n}</a></sup>`);

// 3. Convert "## 参考" section's `[参考N] <url>` lines to <ol class="footnotes"><li id="fn-N">
// marked renders each line as <p>[参考N] url</p> · 步骤 2 已把行首 [参考N] 替成 <sup>
// 这里把 <sup>...</sup> URL 重新结构化为带 #fn-N 锚点的 <li>
body = body.replace(
  /<h2[^>]*>参考[^<]*<\/h2>\s*([\s\S]*?)(?=<h2|<div class="footer|<\/body>|$)/,
  (_match, inner) => {
    const lis = [];
    for (const pm of inner.matchAll(/<sup class="fn-ref"><a href="#fn-(\d+)">\d+<\/a><\/sup>\s+(.+?)(?=\n|<\/p>|$)/g)) {
      const n = pm[1];
      const rest = pm[2].replace(/<\/p>\s*$/, "").trim();
      // 解析裸 URL · 兼容老 "[tier] title — url" 格式
      const tierMatch = rest.match(/^\[([^\]]+)\]\s+(.+?)\s+—\s+(https?:\/\/\S+)/);
      const urlMatch = rest.match(/(https?:\/\/\S+)/);
      if (tierMatch) {
        lis.push(`  <li id="fn-${n}"><span class="tier-label">[${tierMatch[1]}]</span> ${tierMatch[2]} — <a href="${tierMatch[3]}" target="_blank">${tierMatch[3]}</a></li>`);
      } else if (urlMatch) {
        lis.push(`  <li id="fn-${n}"><a href="${urlMatch[1]}" target="_blank">${urlMatch[1]}</a></li>`);
      } else {
        lis.push(`  <li id="fn-${n}">${rest}</li>`);
      }
    }
    return `<h2>参考</h2>\n<ol class="footnotes">\n${lis.join("\n")}\n</ol>\n`;
  }
);

// 4. Wrap in full HTML document with inline CSS(对齐 Oracle AWR + Nessus 样式)
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>perf-kp-sql · 性能诊断报告</title>
<style>
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 1200px; margin: 0 auto; padding: 24px; background: #f8f9fa; }
h1 { font-size: 22px; border-bottom: 2px solid #003d7a; padding-bottom: 8px; color: #003d7a; }
h2 { font-size: 17px; color: #003d7a; margin-top: 28px; border-left: 4px solid #003d7a; padding-left: 10px; }
h3 { font-size: 15px; color: #444; margin-top: 16px; }
code, pre { font-family: "SF Mono", Consolas, "Menlo", monospace; background: #f1f3f5; padding: 1px 4px; border-radius: 2px; font-size: 12.5px; }
pre { padding: 10px; overflow-x: auto; }
table { border-collapse: collapse; width: 100%; margin: 12px 0; background: #fff; font-size: 13px; }
th, td { border: 1px solid #dee2e6; padding: 6px 10px; text-align: left; vertical-align: top; }
th { background: #e9ecef; font-weight: 600; }
tr:nth-child(even) td { background: #fafbfc; }
a { color: #003d7a; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { border-left: 4px solid #dee2e6; margin: 12px 0; padding: 4px 14px; color: #555; background: #f8f9fa; }
details { background: #fff; border: 1px solid #dee2e6; border-radius: 3px; margin: 10px 0; padding: 8px 14px; }
details summary { cursor: pointer; font-weight: 600; color: #003d7a; }
details[open] summary { margin-bottom: 8px; }

/* 脚注角标 · NotebookLM 风灰色圆角 */
sup.fn-ref { display: inline-block; background: #e8e8e8; color: #333; font-size: 10.5px; padding: 1px 6px; border-radius: 10px; margin: 0 1px; text-decoration: none; vertical-align: super; line-height: 1; }
sup.fn-ref a { color: inherit; text-decoration: none; }
sup.fn-ref:hover { background: #003d7a; color: #fff; }

/* 脚注段 */
ol.footnotes { font-size: 12.5px; line-height: 1.8; padding-left: 30px; color: #333; }
ol.footnotes li { margin-bottom: 4px; scroll-margin-top: 20px; }
ol.footnotes li::marker { color: #003d7a; font-weight: 600; }
ol.footnotes a { color: #003d7a; }
ol.footnotes .tier-label { font-size: 11.5px; background: #e9ecef; color: #495057; padding: 1px 6px; border-radius: 3px; margin-right: 6px; }

.footer { margin-top: 40px; padding: 14px 0; border-top: 1px solid #dee2e6; font-size: 11.5px; color: #6c757d; text-align: center; }
</style>
</head>
<body>
${body}
<div class="footer">
  perf-kp-sql skill · kunpeng 全栈数据库性能诊断 · 规则依据:鲲鹏原厂规范 + MongoDB 官方文档<br>
  HTML 由 md-to-html.mjs 自动渲染 · 内容与 markdown 完全一致
</div>
</body>
</html>
`;

writeFileSync(htmlPath, html);
console.log(`✓ rendered ${mdPath} → ${htmlPath} · ${html.length} bytes`);
