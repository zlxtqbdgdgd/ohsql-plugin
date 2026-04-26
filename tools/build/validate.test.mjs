/**
 * Tests for tools/build/validate.mjs (Anthropic Agent Skills compliance).
 *
 * Run: node --test tools/build/validate.test.mjs
 *
 * Uses node's built-in test runner (Node >= 18) — no extra deps.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { validateSkillContent } from "./validate.mjs";

// ---------------------------------------------------------------------------
// Negative cases (should fail)
// ---------------------------------------------------------------------------

test("rejects missing frontmatter", () => {
  const r = validateSkillContent("# Just a heading\n", "x.md");
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /missing YAML frontmatter/);
});

test("rejects missing required 'name' field", () => {
  const md = `---
description: ok
---
body`;
  const r = validateSkillContent(md, "x.md");
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /missing required field 'name'/.test(e)));
});

test("rejects missing required 'description' field", () => {
  const md = `---
name: x
---
body`;
  const r = validateSkillContent(md, "x.md");
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /missing required field 'description'/.test(e)));
});

test("rejects allowed-tools field", () => {
  const md = `---
name: x
description: y
allowed-tools: [Bash, Read]
---
body`;
  const r = validateSkillContent(md, "x.md");
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /allowed-tools/.test(e)));
});

test("rejects when-to-use field", () => {
  const md = `---
name: x
description: y
when-to-use: trigger phrase
---
body`;
  const r = validateSkillContent(md, "x.md");
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /when-to-use/.test(e)));
});

test("rejects disable-model-invocation field", () => {
  const md = `---
name: x
description: y
disable-model-invocation: true
---
body`;
  const r = validateSkillContent(md, "x.md");
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /disable-model-invocation/.test(e)));
});

test("rejects SshExec( in body", () => {
  const md = `---
name: x
description: y
---
SshExec(host=..., command=...)`;
  const r = validateSkillContent(md, "x.md");
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /SshExec/.test(e)));
});

test("rejects TaskCreate( / TaskUpdate( / TaskList(", () => {
  const md = `---
name: x
description: y
---
TaskCreate(subject="A")
TaskUpdate(id=1)
TaskList()`;
  const r = validateSkillContent(md, "x.md");
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /TaskCreate/.test(e)));
  assert.ok(r.errors.some((e) => /TaskUpdate/.test(e)));
  assert.ok(r.errors.some((e) => /TaskList/.test(e)));
});

test("rejects ToolSearchTool( in body", () => {
  const md = `---
name: x
description: y
---
ToolSearchTool(query="X")`;
  const r = validateSkillContent(md, "x.md");
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /ToolSearchTool/.test(e)));
});

test("rejects AskUserQuestion( in body", () => {
  const md = `---
name: x
description: y
---
AskUserQuestion(header="X")`;
  const r = validateSkillContent(md, "x.md");
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /AskUserQuestion/.test(e)));
});

test("counts multiple violations of the same tool", () => {
  const md = `---
name: x
description: y
---
SshExec(host=1)
SshExec(host=2)
SshExec(host=3)`;
  const r = validateSkillContent(md, "x.md");
  assert.equal(r.ok, false);
  const sshErr = r.errors.find((e) => /SshExec/.test(e));
  assert.match(sshErr, /3 occurrence/);
});

// ---------------------------------------------------------------------------
// Positive cases (should pass)
// ---------------------------------------------------------------------------

test("accepts minimal compliant SKILL.md (Anthropic docx style)", () => {
  const md = `---
name: docx
description: Use this skill when the user wants to create or edit Word docs.
---
# DOCX
Run \`pandoc\` to convert.`;
  const r = validateSkillContent(md, "docx.md");
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test("accepts SKILL.md with optional compatibility + metadata fields", () => {
  const md = `---
name: my-skill
description: Use when X happens.
compatibility: |
  Requires Y.
metadata:
  generator: "manual"
  generated_at: "2026-04-26"
argument-hint: "host=<ip>"
---
# Body
Run a shell command:
  ssh user@host '...'`;
  const r = validateSkillContent(md, "my-skill.md");
  assert.equal(r.ok, true);
});

test("does NOT flag tool names in prose / code fences (only call syntax)", () => {
  const md = `---
name: x
description: y
---
The skill historically used SshExec but now uses prose. The word SshExec
without parentheses is OK in documentation. Same with TaskCreate or
ToolSearchTool when discussing them in markdown text.`;
  // Note: our current implementation flags any \bNAME\s*\( pattern. The string
  // "SshExec but" doesn't have a paren, so no false-positive here.
  const r = validateSkillContent(md, "x.md");
  assert.equal(r.ok, true);
});

test("flags tool calls even inside code fences (intentional)", () => {
  const md = `---
name: x
description: y
---
\`\`\`
SshExec(host=...)
\`\`\``;
  const r = validateSkillContent(md, "x.md");
  // Code fences are still skill content; LLM may execute it. Flag.
  assert.equal(r.ok, false);
});

test("argument-hint is allowed (CC extension, ignored by others)", () => {
  const md = `---
name: x
description: y
argument-hint: "host=<ip>"
---
Body`;
  const r = validateSkillContent(md, "x.md");
  assert.equal(r.ok, true);
});
