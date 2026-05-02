---
name: perf-kp-sql-setup
description: Diagnose perf-kp-sql runtime environment and verify NotebookLM CLI registration. Use ONLY when invoked explicitly via `/perf-kp-sql-setup`, after first install of perf-kp-sql, or when perf-kp-sql diagnosis fails with 'module not found' errors. Do NOT auto-invoke based on general user requests.
compatibility: |
  Requires Node.js >= 18 + 本地 OpenSSH `ssh` CLI（Linux/macOS 自带 · Windows
  走 WSL/OpenSSH-Win）。零 npm 运行时依赖 · 所有脚本纯 Node.js 内建模块。
  Works on Claude Code, OpenAI Codex CLI, and ohsql.
metadata:
  generator: "manual"
  generated_at: "2026-04-26"
---

# perf-kp-sql Setup

Bootstrap the runtime dependencies that `perf-kp-sql` relies on. Modeled after EveryInc's `ce-setup` — uses a single bash health-check script + interactive prose Q&A flow (the agent's native question/answer mechanism — `AskUserQuestion` on Claude Code, conversational stop-and-wait on Codex CLI / others).

## Phase 1: Diagnose

### Step 1: 解析 PLUGIN_ROOT(字面绝对路径)

下文所有命令里的 `<PLUGIN_ROOT>` 都是**纯文本占位符**(字面尖括号 · 非 shell 变量)· agent 在每次发 `Bash(command=...)` 前做**字符串替换**,把 `<PLUGIN_ROOT>` 替换为本步解出的字面绝对路径。

> ⚠️ **绝对不要在 Bash command 里写带大括号的 shell 参数替换形态**(形如 `$ {VAR}` · 此处加空格仅为文档显示 · 实际是 dollar+left-brace+name+right-brace)—— ohsql Bash 工具有静态屏蔽,任何含 dollar-brace 的命令一律 reject(`Command contains ${} parameter substitution`)· 即便 harness 已经替换了其中一个变量 · 另一个残留仍触发屏蔽。无 brace 的 `$HOME` / `$d` 形态不受影响。

#### 从 skill base directory 推导(首选 · harness-agnostic)

Harness 加载 skill 时一定会提供 base directory（Claude Code 显示 `Base directory for this skill: <path>` · Codex CLI / ohsql 等同理）。目录结构固定为 `<PLUGIN_ROOT>/skills/<skill-name>/` · **base directory 往上 2 级**就是 PLUGIN_ROOT。

解析步骤:
1. 从 harness 的 skill 加载上下文里读取 base directory（字面绝对路径）
2. 去掉末尾的 `/skills/perf-kp-sql-setup` 得到 PLUGIN_ROOT 候选值
3. 验证:

```
Bash(command="ls <候选路径>/scripts/ssh.mjs <候选路径>/data/cases/INDEX.md >/dev/null 2>&1 && echo '<候选路径>'")
```

stdout 非空 = 验证通过 · 记为 `PLUGIN_ROOT`。

#### Fallback（极少数 harness 不提供 base directory）

```
Bash(command="bash -c '[ -n \"$CLAUDE_PLUGIN_ROOT\" ] && [ -d \"$CLAUDE_PLUGIN_ROOT\" ] && { echo \"$CLAUDE_PLUGIN_ROOT\"; exit 0; }; [ -n \"$OHSQL_PLUGIN_ROOT\" ] && [ -d \"$OHSQL_PLUGIN_ROOT\" ] && { echo \"$OHSQL_PLUGIN_ROOT\"; exit 0; }; echo \"\"'")
```

stdout 仍空 → 问用户:

```
Question: 无法自动解析 perf-kp-sql 插件目录。请贴一下绝对路径（`ls` 一下应该能看到 scripts/ 与 skills/ 子目录）?
```

用户回答即字面绝对路径 · 同样用作 `<PLUGIN_ROOT>` 替换值。

### Step 2: Run the health-check script

Display: `perf-kp-sql · checking dependencies...`

```
Bash(command="bash <PLUGIN_ROOT>/skills/perf-kp-sql-setup/scripts/check-health")
```

The script outputs a colored report covering:

- Node.js version
- `data/cases/{CASES.md,INDEX.md}` 与 `data/best-practice/{CASES.md,INDEX.md}` 存在性

Display the script's output verbatim.

### Step 3: Evaluate

Parse the script output. If every item is 🟢, display the success banner and stop:

```
✅ perf-kp-sql setup complete

   data/cases/      🟢

   Run /perf-kp-sql-setup anytime to re-check.
```

If `data/cases/` / `data/best-practice/` 文件缺失，recommend `/plugin reinstall perf-kp-sql`（案例文件随 plugin install 发布）。

Otherwise proceed to Phase 2 (NotebookLM).

## Phase 2: NotebookLM 知识增强（可选）

Phase 1 完成后，检查 health-check 输出中的 NotebookLM 状态。如果用户希望启用 NotebookLM 知识增强，继续以下步骤。如果用户跳过或 NotebookLM 相关项目全部 🟢，直接跳到成功 banner。

### Step 4: 检测 notebooklm CLI

Health-check 已在输出中包含 NotebookLM CLI 检测结果。如果显示 🟡 `notebooklm CLI not installed`,询问用户是否安装:

```
Question: 是否启用 NotebookLM 知识增强？诊断后可获取更详细的参数解释和优化建议（需要 Google 账号）。

  Option 1 [recommended]: 是,安装并配置
  Option 2: 跳过,不使用 NotebookLM
```

如果用户选择跳过,显示成功 banner 并结束。

### Step 5: 自动安装

```
Bash(command="node <PLUGIN_ROOT>/scripts/notebooklm.mjs --op setup --json")
```

`notebooklm.mjs --op setup` 内部自动完成:
1. `pip install notebooklm-py rookiepy`（如缺失）
2. rookiepy 从本机浏览器 cookie 数据库提取 Google 认证信息（自动探测 Chrome/Edge/Firefox/Safari 等 11 种浏览器）

安装失败不阻塞 — NotebookLM 是可选增强。

### Step 6: 认证检查

setup 脚本内部已执行认证验证（rookiepy 提 cookie + 真打 API 验证 Google 侧 session）。

如果认证失败,提示用户:

```
⚠️ NotebookLM 认证未通过。请先在你的浏览器中:
1. 打开 https://notebooklm.google.com/
2. 确认已登录 Google 账号
3. 重跑 /perf-kp-sql-setup

支持的浏览器: Chrome / Edge / Firefox / Safari / Brave / Arc / Vivaldi / Opera
```

认证失败不阻塞后续步骤 — 诊断核心流程不受影响。

### Step 7: 创建 Notebooks + 添加 URL

setup 脚本内部自动完成:
- 按领域创建 notebooks（ohsql-mongo-kb / ohsql-kunpeng-kb / ohsql-os-kb）
- 从 `data/notebooklm-urls.json` 读取各领域 URL 并添加为 notebook source
- 增量同步:已存在的 URL 跳过,新增的添加,已删除的移除
- 写入 `~/.perf-kp-sql/notebooklm.json` 持久化配置

### Step 8: 等待就绪 + 验证

setup 脚本内部等待所有 source 处理完成（每个 source timeout 120 秒）。

完成后检查 setup 输出的 JSON:
- `ok: true` → 显示成功 banner:

```
✅ NotebookLM 知识增强已就绪

   ohsql-mongo-kb    🟢  N 篇文档
   ohsql-kunpeng-kb  🟢  N 篇文档
   ohsql-os-kb       🟢  N 篇文档
```

- `ok: false` → 显示部分成功的领域,提示失败原因,不阻塞

# Invocation

This skill takes no arguments. Invoke explicitly via:

```
/perf-kp-sql-setup
```

Do NOT auto-invoke based on general user requests. Only fire when:
- The user explicitly types `/perf-kp-sql-setup`
- A perf-kp-sql diagnosis fails with 'module not found' 等运行时错误
- Right after first install of perf-kp-sql (one-time setup)
