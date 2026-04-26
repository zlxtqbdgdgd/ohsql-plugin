# Changelog

All notable changes to the ohsql-plugin marketplace.

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
