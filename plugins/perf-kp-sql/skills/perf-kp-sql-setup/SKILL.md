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

### Step 1: Plugin root 占位符 · 由 harness 自动替换

下文所有命令里的 `${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}` 都是**双变量占位符**,设计成**两边 harness 都能识别自家**:

- **ohsql** 在加载 SKILL.md 时(loader-time)把 `${OHSQL_PLUGIN_ROOT}` 替换为 `~/.ohsql/plugins/cache/perf-kp-sql@<ver>` 绝对路径,`${CLAUDE_PLUGIN_ROOT}` 留字面,shell 扩展未设 env 为空 → 拼出 ohsql cache 路径
- **Claude Code** 在加载 SKILL.md 时把 `${CLAUDE_PLUGIN_ROOT}` 替换为 `~/.claude-max/plugins/cache/.../perf-kp-sql/<ver>` 绝对路径,`${OHSQL_PLUGIN_ROOT}` 留字面,shell 扩展为空 → 拼出 CC cache 路径
- **Codex CLI** 当前两个变量都不替换 — 走 fallback(见下)

agent **绝大多数情况下不需要手动解析** — 直接用占位符发命令,harness 已经替换好了。**唯三例外**:

1. **harness 不替换占位符**(Codex CLI / 旧版 ohsql): 第一次跑命令拿到 `bash /skills/perf-kp-sql-setup/scripts/check-health: No such file` 类错误 → 说明替换没发生 → 走 fallback
2. **shell 启用了 `set -u`(nounset)**: 报错 `bash: OHSQL_PLUGIN_ROOT: unbound variable` 或 `CLAUDE_PLUGIN_ROOT: unbound variable` → 同样走 fallback(占位符必须严格 `${VAR}` 形态 · 没法用 `${VAR-}` 兜底因为 harness regex 不识别)
3. **agent 需要在 SKILL.md 文档之外构造路径**(罕见): 同样走 fallback

#### Fallback · 扫已知安装位

```
Bash(command="for d in ~/.ohsql/plugins/cache/perf-kp-sql@* ~/.claude/plugins/cache/*/perf-kp-sql/* ~/.claude-max/plugins/cache/*/perf-kp-sql/* ~/.codex/plugins/cache/*/perf-kp-sql/*; do test -d \"$d\" && echo \"$d\"; done | sort -V -r | head -1")
```

按 SemVer 倒序选最新版本(`sort -V -r | head -1`),避免命中其他 harness 的旧 cache。stdout 即字面 PLUGIN_ROOT,后续命令把占位符替换为这个值。

#### Fallback · 问用户

扫描全空 → 走 AskUserQuestion / 对话式 stop-and-wait:

```
Question: 无法自动解析 perf-kp-sql 插件目录。请贴一下绝对路径(`ls` 一下应该能看到 scripts/ 与 skills/ 子目录)?

  Option 1: ~/.claude-max/plugins/cache/.../perf-kp-sql/<version>
  Option 2: ~/.ohsql/plugins/cache/perf-kp-sql@<version>
  Option 3: ~/.codex/plugins/cache/.../perf-kp-sql/<version>
  Option 4: 其他 — 我手动输入
```

全部 fallback 都失败,才退化报错:

```
perf-kp-sql-setup 无法解析 PLUGIN_ROOT。可以:
  · 确认插件已通过 /plugin install / marketplace install 正确安装到所在 harness 的 cache 目录
  · 或重启 harness 触发 SKILL.md loader-time 占位符替换(${OHSQL_PLUGIN_ROOT} / ${CLAUDE_PLUGIN_ROOT})
  · 不要手动 export CLAUDE_PLUGIN_ROOT / OHSQL_PLUGIN_ROOT · 这两个变量由 harness 内部用 ·
    手动 export 会导致 ohsql 已替换的部分跟用户 export 的对方变量拼起来路径双写
```

### Step 2: Run the health-check script

Display: `perf-kp-sql · checking native dependencies...`

```
Bash(command="bash ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/skills/perf-kp-sql-setup/scripts/check-health")
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
Bash(command="bash ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/skills/perf-kp-sql-setup/scripts/check-health --list-missing")
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
Bash(command="cd '${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}' && npm install --no-audit --no-fund --loglevel=error <pkg1> <pkg2> ...")
```

Display stdout/stderr to the user.

### Step 5: Handle ABI mismatches

If `better-sqlite3` is installed but the health check reports `NODE_MODULE_VERSION X != Y`, the user upgraded Node since last install. Run:

```
Bash(command="cd '${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}' && npm rebuild better-sqlite3 sqlite-vec")
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
Bash(command="node '${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/kb.mjs' --op query --q warmup --engine mongo --top-k 1", timeout=120000)
```

(`--op query --q <text>` 内部会触发 `embed()` 加载 MiniLM-L6-v2 → 触发首次模型下载并缓存。`--engine mongo --top-k 1` 是为了让查询有效但极轻量。返回 JSON 里包含 `qVector` 384 维即说明模型已就位。脚本里没有 `--op embed` / `--text` 参数,旧文档残留勿用。)

### Step 7: Re-run health check + finish

```
Bash(command="bash ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/skills/perf-kp-sql-setup/scripts/check-health")
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
