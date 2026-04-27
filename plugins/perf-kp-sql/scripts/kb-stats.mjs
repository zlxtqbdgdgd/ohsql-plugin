#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath as __fileURLToPath } from "url";
import { dirname as __pathDirname } from "path";
const require = createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __pathDirname(__filename);

// skills/perf-kp-sql/src/cli-kb-stats.ts
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
var ALLOWED_ENGINES = /* @__PURE__ */ new Set(["mongo", "mysql", "redis"]);
function parseArgs(argv) {
  let engineRaw = "";
  let dbPath = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--engine") {
      engineRaw = argv[++i] ?? "";
    } else if (a === "--db") {
      dbPath = argv[++i] ?? "";
    }
  }
  if (!engineRaw) {
    console.error("usage: kb-stats.mjs --engine <mongo|mysql|redis> [--db <path>]");
    process.exit(2);
  }
  if (!ALLOWED_ENGINES.has(engineRaw)) {
    console.error(`invalid engine: '${engineRaw}' \xB7 \u4EC5\u652F\u6301 ${[...ALLOWED_ENGINES].join("/")}`);
    process.exit(2);
  }
  const engine = engineRaw;
  if (!dbPath) {
    dbPath = join(__dirname, "..", "data", "knowledge.sqlite");
  }
  return { engine, dbPath };
}
function querySqlite(dbPath, sql) {
  return execFileSync("sqlite3", [dbPath, sql], { encoding: "utf8" }).trim();
}
function main() {
  const { engine, dbPath } = parseArgs(process.argv.slice(2));
  if (!existsSync(dbPath)) {
    console.log(JSON.stringify({
      ok: false,
      reason: "knowledge.sqlite \u4E0D\u5B58\u5728",
      path: dbPath,
      engine,
      subtitle: "(\u77E5\u8BC6\u5E93\u672A\u88C5\u8F7D \xB7 \u526F\u6807\u7701\u7565)"
    }));
    return;
  }
  let rulesCount = 0;
  let rulesDocs = 0;
  let factsCount = 0;
  let factsUrls = 0;
  try {
    const rulesRow = querySqlite(
      dbPath,
      `SELECT COUNT(DISTINCT source_url), COUNT(*) FROM rules WHERE engine IN ('${engine}', 'any');`
    );
    const [d, c] = rulesRow.split("|");
    rulesDocs = Number(d ?? 0);
    rulesCount = Number(c ?? 0);
  } catch (err) {
    console.log(JSON.stringify({
      ok: false,
      reason: `rules \u67E5\u8BE2\u5931\u8D25 \xB7 ${err.message}`,
      engine,
      subtitle: "(\u77E5\u8BC6\u5E93\u67E5\u8BE2\u5931\u8D25 \xB7 \u526F\u6807\u7701\u7565)"
    }));
    return;
  }
  try {
    const factsRow = querySqlite(
      dbPath,
      `SELECT COUNT(*), COUNT(DISTINCT source_url) FROM knowledge WHERE engine = '${engine}';`
    );
    const [c, u] = factsRow.split("|");
    factsCount = Number(c ?? 0);
    factsUrls = Number(u ?? 0);
  } catch {
  }
  let subtitle;
  if (factsCount > 0) {
    subtitle = `\u84B8\u998F\u81EA ${rulesDocs} \u4EFD\u6743\u5A01\u6587\u6863 \xB7 ${rulesCount} \u6761\u89C4\u5219 \xB7 \u77E5\u8BC6\u5E93 ${factsCount} \u6761\u7528\u4E8E\u8FFD\u95EE\u68C0\u7D22`;
  } else {
    subtitle = `\u84B8\u998F\u81EA ${rulesDocs} \u4EFD\u6743\u5A01\u6587\u6863 \xB7 ${rulesCount} \u6761\u89C4\u5219 \xB7 \u77E5\u8BC6\u5E93\u6682\u672A\u88C5\u8F7D \xB7 \u8FFD\u95EE\u8D70 CheckFn citation`;
  }
  console.log(JSON.stringify({
    ok: true,
    engine,
    rules: { count: rulesCount, docs: rulesDocs },
    knowledge: { facts: factsCount, urls: factsUrls },
    subtitle
  }));
}
main();
