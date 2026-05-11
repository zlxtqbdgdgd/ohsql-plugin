/**
 * CI validate: re-parse every marketplace.json + plugin.json and exercise
 * a smoke install path with the local files (no actual ohsql kernel).
 *
 * Usage:
 *   node tools/build/validate.mjs          # manifest checks only (default)
 *   node tools/build/validate.mjs --strict # + Anthropic Agent Skills standard compliance
 *
 * The --strict mode is opt-in during the v0.6.0 refactor. Phase 11 will
 * promote it to the default after all SKILL.md files are compliant.
 */

import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const STRICT = process.argv.includes("--strict");

let issues = 0;
function fail(msg) {
  console.error(`❌ ${msg}`);
  issues++;
}
function ok(msg) {
  console.log(`✅ ${msg}`);
}
function warn(msg) {
  console.warn(`⚠️  ${msg}`);
}

// ---------------------------------------------------------------------------
// Anthropic Agent Skills standard compliance (Phase 2 of v0.6.0 refactor)
// ---------------------------------------------------------------------------

const FORBIDDEN_FRONTMATTER_FIELDS = [
  "allowed-tools",
  "when-to-use",
  "disable-model-invocation",
];

const FORBIDDEN_BODY_TOOL_NAMES = [
  "SshExec",
  "TaskCreate",
  "TaskUpdate",
  "TaskList",
  "ToolSearchTool",
  "AskUserQuestion",
];

/**
 * Validate a SKILL.md file's content for Anthropic Agent Skills standard
 * compliance. Returns { ok, errors[], warnings[] }.
 *
 * Tested via tools/build/validate.test.mjs (node --test).
 */
export function validateSkillContent(md, path = "<inline>") {
  const errors = [];
  const warnings = [];

  const fmMatch = md.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n/);
  if (!fmMatch) {
    errors.push(`${path}: missing YAML frontmatter (must start with --- ... ---)`);
    return { ok: false, errors, warnings };
  }
  const fm = fmMatch[1];
  const body = md.slice(fmMatch[0].length);

  if (!/^name\s*:/m.test(fm)) {
    errors.push(`${path}: frontmatter missing required field 'name'`);
  }
  if (!/^description\s*:/m.test(fm)) {
    errors.push(`${path}: frontmatter missing required field 'description'`);
  }

  for (const field of FORBIDDEN_FRONTMATTER_FIELDS) {
    const re = new RegExp(`^${field.replace(/[-]/g, "[-]")}\\s*:`, "m");
    if (re.test(fm)) {
      errors.push(
        `${path}: non-standard frontmatter field '${field}' — drop it (use compatibility/description/narrow trigger phrasing instead)`
      );
    }
  }

  for (const toolName of FORBIDDEN_BODY_TOOL_NAMES) {
    const re = new RegExp(`\\b${toolName}\\s*\\(`, "g");
    const matches = body.match(re);
    if (matches && matches.length > 0) {
      errors.push(
        `${path}: ${matches.length} occurrence(s) of agent-specific tool '${toolName}(' in body — convert to prose intent + shell command`
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Verify that a plugin's .codex-plugin/plugin.json (if present) mirrors the
 * core fields of .claude-plugin/plugin.json. Returns { ok, errors[], warnings[] }.
 */
export function validateCodexMirror(pluginDir) {
  const errors = [];
  const warnings = [];
  const ccPath = join(pluginDir, ".claude-plugin", "plugin.json");
  const codexPath = join(pluginDir, ".codex-plugin", "plugin.json");
  if (!existsSync(codexPath)) {
    warnings.push(`${pluginDir}: no .codex-plugin/ mirror (Codex CLI install unsupported)`);
    return { ok: true, errors, warnings };
  }
  const cc = JSON.parse(readFileSync(ccPath, "utf-8"));
  const codex = JSON.parse(readFileSync(codexPath, "utf-8"));
  for (const field of ["name", "version", "description"]) {
    if (cc[field] !== codex[field]) {
      errors.push(
        `${pluginDir}: .codex-plugin/${field} ('${codex[field]}') mismatches .claude-plugin/${field} ('${cc[field]}')`
      );
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Existing manifest validation (preserved verbatim)
// ---------------------------------------------------------------------------

const mpPath = ".claude-plugin/marketplace.json";
const skillFilesToCheck = [];
const pluginDirsToCheck = [];

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

  for (const entry of manifest.plugins ?? []) {
    if (!entry.name || !entry.source) {
      fail(`marketplace.json plugin entry missing name/source: ${JSON.stringify(entry)}`);
      continue;
    }
    const pluginDir = entry.source.replace(/^\.\//, "");
    pluginDirsToCheck.push(pluginDir);
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
    // Both legacy x-ohsql-* and new x-* field names supported
    const needsInstall = pm["x-needs-npm-install"] ?? pm["x-ohsql-needs-npm-install"];
    const setupSkill = pm["x-setup-skill"] ?? pm["x-ohsql-setup-skill"];
    if (needsInstall && !setupSkill) {
      fail(`${entry.name}: needs-npm-install=true but no setup-skill declared (use x-setup-skill, or legacy x-ohsql-setup-skill)`);
    }

    const skillsRoot = join(pluginDir, "skills");
    if (existsSync(skillsRoot)) {
      const skillNames = await readdir(skillsRoot);
      for (const sn of skillNames) {
        if (sn.startsWith(".") || sn.startsWith("_")) continue;
        const skillMd = join(skillsRoot, sn, "SKILL.md");
        if (!existsSync(skillMd)) {
          fail(`${entry.name}: skill "${sn}" has no SKILL.md`);
        } else {
          skillFilesToCheck.push(skillMd);
        }
      }
    }

    ok(`${entry.name}@${pm.version}`);
  }
}

// ---------------------------------------------------------------------------
// Strict mode: Anthropic Agent Skills standard compliance + Codex mirror
// ---------------------------------------------------------------------------

if (STRICT) {
  console.log("\n--- strict mode: Anthropic Agent Skills compliance ---");
  for (const skillMd of skillFilesToCheck) {
    const md = readFileSync(skillMd, "utf-8");
    const result = validateSkillContent(md, skillMd);
    if (result.ok) {
      ok(`${skillMd}: standard compliant`);
    } else {
      for (const err of result.errors) fail(err);
    }
  }

  console.log("\n--- strict mode: .codex-plugin/ mirror ---");
  for (const pluginDir of pluginDirsToCheck) {
    const result = validateCodexMirror(pluginDir);
    if (result.ok) {
      ok(`${pluginDir}: codex mirror OK`);
    } else {
      for (const err of result.errors) fail(err);
    }
    for (const w of result.warnings) warn(w);
  }
}

if (issues > 0) {
  console.error(`\n${issues} issue(s) found.`);
  process.exit(1);
}
console.log(STRICT ? "\nAll manifests + standards OK." : "\nAll manifests OK.");
