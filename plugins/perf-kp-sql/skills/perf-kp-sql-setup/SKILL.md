---
name: perf-kp-sql-setup
description: Diagnose and install perf-kp-sql native dependencies (better-sqlite3, sqlite-vec, ssh2, @xenova/transformers) and verify knowledge.sqlite schema. Use ONLY when invoked explicitly via `/perf-kp-sql-setup`, after first install of perf-kp-sql, or when perf-kp-sql diagnosis fails with native-addon / ABI / 'module not found' / 'NODE_MODULE_VERSION mismatch' errors. Do NOT auto-invoke based on general user requests.
compatibility: |
  Requires Node.js >= 18 and `npm` on the local machine. Installs native modules
  (better-sqlite3, sqlite-vec, ssh2, @xenova/transformers) into the plugin's
  per-plugin `node_modules` directory via `npm install --prefix`. Optionally
  warms up the HuggingFace MiniLM-L6-v2 model (~25MB download) for KB semantic
  search readiness. Works on Claude Code, OpenAI Codex CLI, and ohsql.
metadata:
  generator: "manual"
  generated_at: "2026-04-26"
---

# perf-kp-sql Setup

Bootstrap the native dependencies that `perf-kp-sql` relies on. Modeled after EveryInc's `ce-setup` — uses a single bash health-check script + interactive `AskUserQuestion` flow.

## Phase 1: Diagnose

### Step 1: Resolve plugin cache directory

```
Bash(command="echo \"PLUGIN_ROOT=${OHSQL_PLUGIN_ROOT:-unset}\"")
```

If `OHSQL_PLUGIN_ROOT` is `unset`, this skill is running outside ohsql ≥ 0.38.0. Tell the user:

```
perf-kp-sql is ohsql-only. Please install OpenHarness-SQL ≥ 0.38.0 and run `/plugin install perf-kp-sql`.
```

Stop here.

### Step 2: Run the health-check script

Display: `perf-kp-sql · checking native dependencies...`

```
Bash(command="bash ${OHSQL_PLUGIN_ROOT}/skills/perf-kp-sql-setup/scripts/check-health")
```

The script outputs a colored report covering:

- Node.js version
- `better-sqlite3` (require + ABI)
- `sqlite-vec` (require + extension load + `vec_version()`)
- `ssh2` (require)
- `@xenova/transformers` (import)
- `data/knowledge.sqlite` (file exists + readable + schema)

Display the script's output verbatim.

### Step 3: Evaluate

Parse the script output. If every item is 🟢, display the success banner and stop:

```
✅ perf-kp-sql setup complete

   better-sqlite3   🟢
   sqlite-vec       🟢
   ssh2             🟢
   transformers     🟢
   knowledge.sqlite 🟢

   Run /perf-kp-sql-setup anytime to re-check.
```

Otherwise proceed to Phase 2.

## Phase 2: Fix

### Step 4: Confirm install

Use `AskUserQuestion` to ask whether to proceed with fixing the missing/broken deps. The proposed install command is the same regardless of which subset is missing — `npm install` is idempotent for already-present packages.

```
Question: 是否安装 / 修复 perf-kp-sql 的 native 依赖？

  Option 1 [recommended]: 是,跑 npm install
    cd "${OHSQL_PLUGIN_ROOT}"
    npm install --no-audit --no-fund --loglevel=error \
      better-sqlite3@^11.7 sqlite-vec@^0.1 ssh2@^1.17 @xenova/transformers@^2.17

  Option 2: 跳过 — 我自己装
```

If user chose Option 1, run:

```
Bash(command="cd '${OHSQL_PLUGIN_ROOT}' && npm install --no-audit --no-fund --loglevel=error better-sqlite3@^11.7 sqlite-vec@^0.1 ssh2@^1.17 @xenova/transformers@^2.17")
```

Display stdout/stderr to the user.

### Step 5: Handle ABI mismatches

If `better-sqlite3` is installed but the health check reports `NODE_MODULE_VERSION X != Y`, the user upgraded Node since last install. Run:

```
Bash(command="cd '${OHSQL_PLUGIN_ROOT}' && npm rebuild better-sqlite3 sqlite-vec")
```

### Step 6: Warm the model cache (optional)

`@xenova/transformers` lazily downloads the MiniLM-L6-v2 model (~25 MB) the first time `kb.mjs` runs an embedding query. Pre-download it now to avoid blocking the first diagnosis:

```
Question: 提前下载 MiniLM-L6-v2 模型 (~25MB) 缓存到 ~/.cache/huggingface？

  Option 1 [recommended]: 是,触发一次 warmup
  Option 2: 跳过,首次诊断时再下
```

If accepted:

```
Bash(command="node '${OHSQL_PLUGIN_ROOT}/scripts/kb.mjs' --op embed --text warmup", timeout=120000)
```

### Step 7: Re-run health check + finish

```
Bash(command="bash ${OHSQL_PLUGIN_ROOT}/skills/perf-kp-sql-setup/scripts/check-health")
```

If everything is now 🟢, display the success banner from Step 3.

If knowledge.sqlite is still missing or corrupt, recommend `/plugin reinstall perf-kp-sql` (the file is committed in the plugin repo and ships with the install).
