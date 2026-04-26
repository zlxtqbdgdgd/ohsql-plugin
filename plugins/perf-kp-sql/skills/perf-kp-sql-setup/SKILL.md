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

Bootstrap the native dependencies that `perf-kp-sql` relies on. Modeled after EveryInc's `ce-setup` — uses a single bash health-check script + interactive prose Q&A flow (the agent's native question/answer mechanism — `AskUserQuestion` on Claude Code, conversational stop-and-wait on Codex CLI / others).

## Phase 1: Diagnose

### Step 1: Resolve plugin cache directory

```
Bash(command="echo \"PLUGIN_ROOT=${OHSQL_PLUGIN_ROOT:-unset}\"")
```

Resolve the plugin root by trying both `${CLAUDE_PLUGIN_ROOT}` (Claude Code) and `${OHSQL_PLUGIN_ROOT}` (ohsql) — whichever is set. The fallback expression `${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}` is used in all subsequent shell commands. If neither is set, the skill is running outside any supported agent's plugin runtime; tell the user:

```
perf-kp-sql-setup needs to run inside Claude Code, OpenAI Codex CLI, or
OpenHarness-SQL — one of $CLAUDE_PLUGIN_ROOT / $OHSQL_PLUGIN_ROOT must
be set so the script can find the plugin's node_modules directory.
Please install perf-kp-sql via `/plugin install perf-kp-sql` first.
```

Stop here.

### Step 2: Run the health-check script

Display: `perf-kp-sql · checking native dependencies...`

```
Bash(command="bash ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/skills/perf-kp-sql-setup/scripts/check-health")
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

Ask the user whether to proceed with fixing the missing/broken deps (the proposed install command is the same regardless of which subset is missing — `npm install` is idempotent for already-present packages). Use the agent's native Q&A facility: structured options on Claude Code, plain stop-and-wait conversational ask on Codex CLI / others.

```
Question: 是否安装 / 修复 perf-kp-sql 的 native 依赖？

  Option 1 [recommended]: 是,跑 npm install
    cd "${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}"
    npm install --no-audit --no-fund --loglevel=error \
      better-sqlite3@^11.7 sqlite-vec@^0.1 ssh2@^1.17 @xenova/transformers@^2.17

  Option 2: 跳过 — 我自己装
```

If user chose Option 1, run:

```
Bash(command="cd '${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}' && npm install --no-audit --no-fund --loglevel=error better-sqlite3@^11.7 sqlite-vec@^0.1 ssh2@^1.17 @xenova/transformers@^2.17")
```

Display stdout/stderr to the user.

### Step 5: Handle ABI mismatches

If `better-sqlite3` is installed but the health check reports `NODE_MODULE_VERSION X != Y`, the user upgraded Node since last install. Run:

```
Bash(command="cd '${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}' && npm rebuild better-sqlite3 sqlite-vec")
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
Bash(command="node '${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/kb.mjs' --op embed --text warmup", timeout=120000)
```

### Step 7: Re-run health check + finish

```
Bash(command="bash ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/skills/perf-kp-sql-setup/scripts/check-health")
```

If everything is now 🟢, display the success banner from Step 3.

If knowledge.sqlite is still missing or corrupt, recommend `/plugin reinstall perf-kp-sql` (the file is committed in the plugin repo and ships with the install).

# Invocation

This skill takes no arguments. Invoke explicitly via:

```
/perf-kp-sql-setup
```

Do NOT auto-invoke based on general user requests. Only fire when:
- The user explicitly types `/perf-kp-sql-setup`
- A perf-kp-sql diagnosis fails with `Cannot find module 'better-sqlite3'`,
  `NODE_MODULE_VERSION X != Y`, or similar native-addon / ABI errors
- Right after first install of perf-kp-sql (one-time setup)
