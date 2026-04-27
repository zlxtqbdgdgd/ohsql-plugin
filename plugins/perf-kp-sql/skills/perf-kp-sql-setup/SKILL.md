---
name: perf-kp-sql-setup
description: Diagnose and install perf-kp-sql runtime dependencies (better-sqlite3, sqlite-vec, @xenova/transformers, marked) and verify knowledge.sqlite schema. Use ONLY when invoked explicitly via `/perf-kp-sql-setup`, after first install of perf-kp-sql, or when perf-kp-sql diagnosis fails with native-addon / ABI / 'module not found' / 'NODE_MODULE_VERSION mismatch' errors. Do NOT auto-invoke based on general user requests.
compatibility: |
  Requires Node.js >= 18 and `npm` on the local machine + 本地 OpenSSH `ssh`
  CLI(Linux/macOS 自带 · Windows 走 WSL/OpenSSH-Win)。Installs native modules
  (better-sqlite3, sqlite-vec, @xenova/transformers) plus the markdown
  renderer (marked) into the plugin's per-plugin `node_modules` directory via
  `npm install --prefix`. Optionally warms up the HuggingFace MiniLM-L6-v2 model
  (~25MB download) for KB semantic search readiness. Works on Claude Code,
  OpenAI Codex CLI, and ohsql. v0.12.0 起 ssh2 native module 已下线 ·
  cli-ssh 改走 spawn(本地 ssh)+ SSH_ASKPASS。
metadata:
  generator: "manual"
  generated_at: "2026-04-26"
---

# perf-kp-sql Setup

Bootstrap the native dependencies that `perf-kp-sql` relies on. Modeled after EveryInc's `ce-setup` — uses a single bash health-check script + interactive prose Q&A flow (the agent's native question/answer mechanism — `AskUserQuestion` on Claude Code, conversational stop-and-wait on Codex CLI / others).

## Phase 1: Diagnose

### Step 1: Resolve plugin cache directory

按以下顺序解析 `PLUGIN_ROOT`(找到第一个有效值即用,**不要全部尝试**):

1. **env `$CLAUDE_PLUGIN_ROOT`** — Claude Code 注入
2. **env `$OHSQL_PLUGIN_ROOT`** — ohsql 注入(部分版本)
3. **env `$CODEX_PLUGIN_ROOT`** — 防御性占位(Codex CLI 当前不注入,留作未来兼容)
4. **从本 SKILL.md 的绝对加载路径反推** — 每家 harness 都会在 system context 里告诉 LLM 当前 SKILL.md 是从哪个绝对路径加载的。本 SKILL.md 位于 `<PLUGIN_ROOT>/skills/perf-kp-sql-setup/SKILL.md`,反推就是:`PLUGIN_ROOT = dirname(dirname(dirname(<本 SKILL.md 路径>)))`

四种策略全部失败,才退化报错:

```
perf-kp-sql-setup 无法解析 PLUGIN_ROOT。请确认本插件已通过 /plugin install
正确安装,或手动告诉我插件目录的绝对路径。
```

> 下文所有 `${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}` 都是**占位符**,**不是 shell 表达式** —— 部分 harness(如 OH-SQL)会以 `Command contains ${} parameter substitution` 拒掉。agent 必须在每条 Bash 命令发出前,把占位符替换为本会话刚解出的字面绝对路径。

可选验证(env 模式时):

```
Bash(command="echo \"PLUGIN_ROOT=$CLAUDE_PLUGIN_ROOT or $OHSQL_PLUGIN_ROOT\"")
```

(若 harness 不允许 `$VAR`,跳过此验证步,直接进入 Step 2 用解出的字面路径调用)

### Step 2: Run the health-check script

Display: `perf-kp-sql · checking native dependencies...`

```
Bash(command="bash ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/skills/perf-kp-sql-setup/scripts/check-health")
```

The script outputs a colored report covering:

- Node.js version
- `better-sqlite3` (require + ABI)
- `sqlite-vec` (require + extension load + `vec_version()`)
- `@xenova/transformers` (import)
- `data/knowledge.sqlite` (file exists + readable + schema)

Display the script's output verbatim.

### Step 3: Evaluate

Parse the script output. If every item is 🟢, display the success banner and stop:

```
✅ perf-kp-sql setup complete

   better-sqlite3   🟢
   sqlite-vec       🟢
   transformers     🟢
   knowledge.sqlite 🟢

   Run /perf-kp-sql-setup anytime to re-check.
```

Otherwise proceed to Phase 2.

## Phase 2: Fix

### Step 4: Compute missing deps & confirm install

Re-run the health-check in `--list-missing` mode to get the precise subset that needs `npm install`. Already-present packages are excluded — we don't reinstall what's already there (avoids network hits and version drift).

```
Bash(command="bash ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/skills/perf-kp-sql-setup/scripts/check-health --list-missing")
```

Stdout is one install spec per line, e.g. `marked@^18`. Empty stdout means nothing needs installing (all required runtime deps are already present in the plugin's `node_modules`).

If stdout is empty:

```
✅ 所有 runtime 依赖已就位,无需 npm install
```

Skip Step 4 install and proceed to Step 5 (ABI rebuild check) / Step 6 (model warmup).

If stdout is non-empty, ask the user whether to install **only** the listed subset. Use the agent's native Q&A facility: structured options on Claude Code, plain stop-and-wait conversational ask on Codex CLI / others.

```
Question: 是否安装下列缺失依赖?

  缺失: <pkg1> <pkg2> ...    # 上一步 --list-missing 输出, 已确认本地不存在

  Option 1 [recommended]: 是,只装上面这些
  Option 2: 跳过 — 我自己装
```

If user chose Option 1, install **only** the missing subset (substitute the spec list captured above into the command):

```
Bash(command="cd '${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}' && npm install --no-audit --no-fund --loglevel=error <pkg1> <pkg2> ...")
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
Bash(command="node '${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/kb.mjs' --op query --q warmup --engine mongo --top-k 1", timeout=120000)
```

(`--op query --q <text>` 内部会触发 `embed()` 加载 MiniLM-L6-v2 → 触发首次模型下载并缓存。`--engine mongo --top-k 1` 是为了让查询有效但极轻量。返回 JSON 里包含 `qVector` 384 维即说明模型已就位。脚本里没有 `--op embed` / `--text` 参数,旧文档残留勿用。)

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
