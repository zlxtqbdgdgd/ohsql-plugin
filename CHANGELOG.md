# Changelog

All notable changes to the ohsql-plugin marketplace.

## [1.1.0] — 2026-04-26

Agent-agnostic refactor. All skills now follow the [Anthropic Agent Skills open
standard](https://github.com/anthropics/skills) and run natively on Claude Code,
OpenAI Codex CLI, and ohsql.

### Added

- **OpenAI Codex CLI install support** — `.codex-plugin/marketplace.json` +
  per-plugin `.codex-plugin/plugin.json` mirrors with `interface` rich UI metadata
  (displayName, longDescription, category, defaultPrompt). Install via:
  `codex plugin marketplace add zlxtqbdgdgd/ohsql-plugin`
- **Anthropic Agent Skills compliance validator** at `tools/build/validate.mjs`:
  - New `--strict` mode checks SKILL.md frontmatter (rejects `allowed-tools`,
    `when-to-use`, `disable-model-invocation`) and body (rejects `SshExec(`,
    `TaskCreate(`, `TaskUpdate(`, `TaskList(`, `ToolSearchTool(`,
    `AskUserQuestion(` — all agent-specific tool calls)
  - Verifies `.codex-plugin/plugin.json` mirrors `.claude-plugin/plugin.json`
    name/version/description
  - 16 unit tests in `tools/build/validate.test.mjs` (node --test, no deps)
  - npm scripts: `validate` (manifest-only, default) / `validate:strict`
    (full standard) / `test` (run unit tests)
- **`## Invocation` body section** in all 3 SKILL.md files — duplicates
  `argument-hint` parameters as prose so non-CC agents (which don't render
  argument-hint as UI) can quote them to the user

### Changed

- **`perf-kp-sql` 0.5.1 → 0.6.1** — *minor bump (0.5→0.6) per repo versioning
  policy (behavior change), then 0.6.0 → 0.6.1 patch for PAM auth fix*:
  - **0.6.1 PAM auth fix**: `scripts/ssh.mjs` (and src/cli-ssh.ts source)
    now enables `tryKeyboard: true` + adds a `keyboard-interactive` event
    handler. Previously, password auth was hard-coded to the SSH `password`
    method (RFC 4252 §8) only — but most modern Linux distributions
    (including Huawei Cloud EulerOS, RHEL/CentOS with PAM, Ubuntu with
    pam_unix) actually drive password auth through the `keyboard-interactive`
    method (PAM challenge/response). Symptom: `{"err":"All configured
    authentication methods failed"}` against any PAM-enabled sshd, even
    with correct credentials. Fix supports BOTH methods; ssh2 falls through
    automatically without burning extra MaxAuthTries slots.
  - **0.6.0 changes (original v0.6.0 scope)**:
  - SKILL.md frontmatter standardized: dropped `allowed-tools` (was binding
    to ohsql kernel tools `SshExec`/`TaskCreate`/`TaskUpdate`/`TaskList`/
    `ToolSearchTool`), dropped `when-to-use` (merged into description),
    added `compatibility` declaring dual SSH auth + native deps + supported
    engines, added `metadata.generated_at`
  - SKILL.md body refactored: 29 agent-specific tool calls → 0
    - 3 `SshExec(` → "## SSH execution pattern" section + bash code fences
      with dual auth modes (Mode A key auth recommended; Mode B password via
      `sshpass`, CC + ohsql only — Codex CLI sandbox blocks `sshpass`)
    - 5 `TaskCreate(` + 11 `TaskUpdate(` + 1 `TaskList(` → "## Task tracking
      pattern" section + "Mark phase X as in_progress/completed" prose
    - 3 `ToolSearchTool(` → deleted (not needed in standard)
    - 6 `AskUserQuestion(` → conversational "Ask the user: ... Stop and wait
      for the next turn" prose (Codex-friendly)
  - SSH auth: dual mode preserved (key + password) — password auth still
    works on Claude Code + ohsql, but Codex CLI users must use key auth
    (run `ssh-copy-id` once, then `privateKeyPath=` instead of `password=`)
  - `plugin.json` x-fields renamed for plugin-system neutrality:
    `x-ohsql-min` → dropped (no longer ohsql-only)
    `x-ohsql-dependencies` → `x-plugin-dependencies`
    `x-ohsql-setup-skill` → `x-setup-skill`
    `x-ohsql-needs-npm-install` → `x-needs-npm-install`
  - tier in README/marketplace: `ohsql-only` → `harness-agnostic`
- **`cpu-flamegraph` 0.2.0 → 0.2.1** — *patch bump per repo versioning policy
  (text-only change)*:
  - Frontmatter standardized: dropped `allowed-tools` `when-to-use`,
    added `compatibility` `metadata`
  - Body cleanup: reframed "# 能力边界" intro as "follows Anthropic Agent
    Skills open standard" instead of CC-specific tool list
  - Added `## Invocation` body section
- **`perf-kp-sql-setup`** — same pattern as cpu-flamegraph:
  - Dropped `disable-model-invocation` (replaced with explicit "Use ONLY
    when invoked via /perf-kp-sql-setup" in description)
  - Body Step 1 now detects both `CLAUDE_PLUGIN_ROOT` and `OHSQL_PLUGIN_ROOT`
    (was rejecting non-ohsql environments outright)
  - Body Q&A wording generalized from "Use AskUserQuestion" to "Ask the
    user (using the agent's native Q&A facility)"
  - Added `## Invocation` body section

### Marketplace

- **marketplace 1.0.0 → 1.1.0** (minor: new feature = Codex CLI install support)
- All plugin descriptions in `marketplace.json` updated to mention multi-agent
  compatibility

### Compatibility

| Plugin | Claude Code | OpenAI Codex CLI | ohsql |
|---|---|---|---|
| cpu-flamegraph 0.2.1 | ✅ | ✅ | ✅ |
| perf-kp-sql 0.6.0 | ✅ key + password auth | ✅ key auth only (Codex sandbox blocks `sshpass`) | ✅ key + password auth |

### Migration notes for existing users

- **Claude Code users**: no action needed — `/plugin upgrade` picks up 0.6.0
- **ohsql users**: same — no breaking changes; `password=` auth still works
- **New OpenAI Codex CLI users**: install via `codex plugin marketplace add ...`;
  use SSH key auth (run `ssh-copy-id` once) instead of password

## [1.0.0] — 2026-04-26

Initial release. Migrated from `ohsql-skillhub` to CC-compatible plugin format.

### Added

- **CC-compatible plugin marketplace** at `.claude-plugin/marketplace.json`
- **`cpu-flamegraph` plugin** (0.2.0) — harness-agnostic, works in both ohsql and stock Claude Code
  - Migrated SKILL.md, src/, vendor/flamegraph.pl, data/kb-seeds, tests
  - Compiled scripts (capture.mjs, analyze.mjs) committed under `linguist-generated`
  - SKILL.md script paths use the portable `${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}` form
- **`perf-kp-sql` plugin** (0.5.0) — ohsql-only (≥ 0.38.0)
  - Full migration: SKILL.md, src/, data/, templates/, scripts/, docs/, tests/
  - `data/knowledge.sqlite` (~10MB) committed (`linguist-generated` to keep diffs clean)
  - SKILL.md path hardcodes (`~/.ohsql/skills/perf-kp-sql/...`) replaced with `$OHSQL_PLUGIN_ROOT/...`
  - Cross-plugin references to `cpu-flamegraph/scripts/...` use the new
    `$OHSQL_DEP_CPU_FLAMEGRAPH_ROOT` placeholder (loader resolves to dependency cacheDir)
  - Pre-flight `test -f` check replaced with a pointer to `/perf-kp-sql-setup`
  - Declares `x-ohsql-min: ">=0.38.0"`, `x-ohsql-dependencies: { cpu-flamegraph: ^0.2.0 }`,
    `x-ohsql-setup-skill: perf-kp-sql-setup`, `x-ohsql-needs-npm-install: true`
- **`perf-kp-sql:setup` skill** —照 EveryInc/ce-setup 范式
  - `SKILL.md` runs `scripts/check-health` → AskUserQuestion-driven install/rebuild flow
  - `scripts/check-health` (bash, 246 lines) probes:
    Node.js >= 18, better-sqlite3 (require + ABI), sqlite-vec (extension load + vec_version),
    ssh2, @xenova/transformers (dynamic import), data/knowledge.sqlite (file + readable + schema),
    ~/.cache/huggingface MiniLM cache (informational)
  - `npm install --prefix "$OHSQL_PLUGIN_ROOT"` → per-plugin node_modules (spike-validated 2026-04-26)
  - Optional model warmup to avoid first-run KB query stall
- **`tools/build/validate.mjs`** — manifest schema check for CI
- **`.gitattributes`** — sqlite + scripts/*.mjs marked binary/linguist-generated for clean diffs
- **`.github/workflows/validate.yml`** — runs on every PR

### Notes

- `oops-bench` plugin not included in this release (skill not present in source ohsql-skillhub)
- Built artifacts (`scripts/*.mjs`) sourced from `ohsql-skillhub` build (esbuild bundle, native deps external)
- See [`OpenHarness-SQL/docs/plans/`](https://github.com/zlxtqbdgdgd/OpenHarness-SQL/tree/main/docs/plans) for the design
