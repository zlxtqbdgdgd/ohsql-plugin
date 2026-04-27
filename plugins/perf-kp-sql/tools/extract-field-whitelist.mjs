#!/usr/bin/env node
/**
 * extract-field-whitelist · 从 real-env-fixture.json 展平所有字段路径
 *
 * 输入: reports/cleanup/round2/real-env-fixture.json (mongo serverStatus + hostInfo + getCmdLineOpts)
 * 输出: reports/cleanup/round2/field-whitelist.json (所有真存在的字段路径)
 *
 * 路径格式: dotted with [bracket] for special keys
 * 例: serverStatus.connections.current
 *     serverStatus.wiredTiger.cache['maximum bytes configured']
 */

import { readFileSync, writeFileSync } from "node:fs";

const fixture = JSON.parse(readFileSync("reports/cleanup/round2/real-env-fixture.json", "utf8"));

const paths = new Set();

function flatten(obj, prefix) {
  if (obj === null || obj === undefined) return;
  if (typeof obj !== "object") {
    paths.add(prefix);
    return;
  }
  if (Array.isArray(obj)) {
    paths.add(prefix);
    if (obj.length > 0) flatten(obj[0], prefix + "[0]");
    return;
  }
  paths.add(prefix);
  for (const k of Object.keys(obj)) {
    const segment = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)
      ? `.${k}`
      : `['${k.replace(/'/g, "\\'")}']`;
    flatten(obj[k], prefix + segment);
  }
}

for (const top of Object.keys(fixture)) {
  flatten(fixture[top], top);
}

const sorted = [...paths].sort();
writeFileSync(
  "reports/cleanup/round2/field-whitelist.json",
  JSON.stringify(sorted, null, 2),
);
console.log(`field paths total: ${sorted.length}`);
console.log("samples:");
console.log("  serverStatus level:");
sorted.filter(p => p.startsWith("serverStatus.") && p.split(".").length === 2).slice(0, 10).forEach(p => console.log("   ", p));
console.log("  hostInfo level:");
sorted.filter(p => p.startsWith("hostInfo.")).slice(0, 10).forEach(p => console.log("   ", p));
console.log("  getCmdLineOpts.parsed:");
sorted.filter(p => p.startsWith("getCmdLineOpts.parsed.")).slice(0, 10).forEach(p => console.log("   ", p));
console.log("  含 [bracket] 的:");
sorted.filter(p => p.includes("[")).slice(0, 5).forEach(p => console.log("   ", p));
