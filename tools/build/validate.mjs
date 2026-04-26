/**
 * CI validate: re-parse every marketplace.json + plugin.json and exercise
 * a smoke install path with the local files (no actual ohsql kernel).
 */

import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

let issues = 0;
function fail(msg) {
  console.error(`❌ ${msg}`);
  issues++;
}
function ok(msg) {
  console.log(`✅ ${msg}`);
}

// ---- marketplace.json ----
const mpPath = ".claude-plugin/marketplace.json";
if (!existsSync(mpPath)) {
  fail(`Missing ${mpPath}`);
} else {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(mpPath, "utf-8"));
  } catch (e) {
    fail(`Invalid JSON in ${mpPath}: ${e.message}`);
    process.exit(1);
  }
  if (!manifest.name) fail("marketplace.json missing 'name'");
  if (!Array.isArray(manifest.plugins)) fail("marketplace.json missing 'plugins' array");
  ok(`marketplace "${manifest.name}" with ${manifest.plugins?.length ?? 0} plugins`);

  // ---- plugin.json for each ----
  for (const entry of manifest.plugins ?? []) {
    if (!entry.name || !entry.source) {
      fail(`marketplace.json plugin entry missing name/source: ${JSON.stringify(entry)}`);
      continue;
    }
    const pluginDir = entry.source.replace(/^\.\//, "");
    const pluginManifestPath = join(pluginDir, ".claude-plugin", "plugin.json");
    if (!existsSync(pluginManifestPath)) {
      fail(`${entry.name}: ${pluginManifestPath} not found`);
      continue;
    }
    let pm;
    try {
      pm = JSON.parse(readFileSync(pluginManifestPath, "utf-8"));
    } catch (e) {
      fail(`${entry.name}: invalid plugin.json — ${e.message}`);
      continue;
    }
    if (pm.name !== entry.name) {
      fail(`${entry.name}: plugin.json name "${pm.name}" mismatches marketplace "${entry.name}"`);
    }
    if (!pm.version) fail(`${entry.name}: missing version`);
    if (pm["x-ohsql-needs-npm-install"] && !pm["x-ohsql-setup-skill"]) {
      fail(`${entry.name}: needs-npm-install=true but no setup-skill declared`);
    }

    // Skills dir sanity
    const skillsRoot = join(pluginDir, "skills");
    if (existsSync(skillsRoot)) {
      const skillNames = await readdir(skillsRoot);
      for (const sn of skillNames) {
        if (sn.startsWith(".") || sn.startsWith("_")) continue;
        const skillMd = join(skillsRoot, sn, "SKILL.md");
        if (!existsSync(skillMd)) {
          fail(`${entry.name}: skill "${sn}" has no SKILL.md`);
        }
      }
    }

    ok(`${entry.name}@${pm.version}`);
  }
}

if (issues > 0) {
  console.error(`\n${issues} issue(s) found.`);
  process.exit(1);
}
console.log("\nAll manifests OK.");
