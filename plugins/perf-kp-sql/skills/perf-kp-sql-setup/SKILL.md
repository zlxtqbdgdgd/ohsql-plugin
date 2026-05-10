---
name: perf-kp-sql-setup
description: Diagnose perf-kp-sql runtime environment (Node.js + 案例库 markdown bundles). Use ONLY when invoked explicitly via `/perf-kp-sql-setup`, after first install of perf-kp-sql, or when perf-kp-sql diagnosis fails with 'module not found' errors. Do NOT auto-invoke based on general user requests.
compatibility: |
  Requires Node.js >= 18 + 本地 OpenSSH `ssh` CLI（Linux/macOS 自带 · Windows
  走 WSL/OpenSSH-Win）。零 npm 运行时依赖 · 所有脚本纯 Node.js 内建模块。
  Works on Claude Code, OpenAI Codex CLI, and ohsql.
metadata:
  generator: "manual"
  generated_at: "2026-04-26"
---

# perf-kp-sql Setup

Verify perf-kp-sql 本地运行时(Node.js + 案例库 markdown 文件)是否就绪。Modeled after EveryInc's `ce-setup` — 单 bash health-check 脚本,纯诊断 · 不装任何依赖。

## Step 1: 解析 PLUGIN_ROOT(字面绝对路径)

下文所有命令里的 `<PLUGIN_ROOT>` 都是**纯文本占位符**(字面尖括号 · 非 shell 变量)· agent 在每次发 `Bash(command=...)` 前做**字符串替换**,把 `<PLUGIN_ROOT>` 替换为本步解出的字面绝对路径。

> ⚠️ **绝对不要在 Bash command 里写带大括号的 shell 参数替换形态**(形如 `$ {VAR}` · 此处加空格仅为文档显示 · 实际是 dollar+left-brace+name+right-brace)—— ohsql Bash 工具有静态屏蔽,任何含 dollar-brace 的命令一律 reject(`Command contains ${} parameter substitution`)· 即便 harness 已经替换了其中一个变量 · 另一个残留仍触发屏蔽。无 brace 的 `$HOME` / `$d` 形态不受影响。

### 从 skill base directory 推导(首选 · harness-agnostic)

Harness 加载 skill 时一定会提供 base directory（Claude Code 显示 `Base directory for this skill: <path>` · Codex CLI / ohsql 等同理）。目录结构固定为 `<PLUGIN_ROOT>/skills/<skill-name>/` · **base directory 往上 2 级**就是 PLUGIN_ROOT。

解析步骤:
1. 从 harness 的 skill 加载上下文里读取 base directory（字面绝对路径）
2. 去掉末尾的 `/skills/perf-kp-sql-setup` 得到 PLUGIN_ROOT 候选值
3. 验证:

```
Bash(command="ls <候选路径>/scripts/ssh.mjs <候选路径>/data/cases/INDEX.md >/dev/null 2>&1 && echo '<候选路径>'")
```

stdout 非空 = 验证通过 · 记为 `PLUGIN_ROOT`。

### Fallback（极少数 harness 不提供 base directory）

```
Bash(command="bash -c '[ -n \"$CLAUDE_PLUGIN_ROOT\" ] && [ -d \"$CLAUDE_PLUGIN_ROOT\" ] && { echo \"$CLAUDE_PLUGIN_ROOT\"; exit 0; }; [ -n \"$OHSQL_PLUGIN_ROOT\" ] && [ -d \"$OHSQL_PLUGIN_ROOT\" ] && { echo \"$OHSQL_PLUGIN_ROOT\"; exit 0; }; echo \"\"'")
```

stdout 仍空 → 问用户:

```
Question: 无法自动解析 perf-kp-sql 插件目录。请贴一下绝对路径（`ls` 一下应该能看到 scripts/ 与 skills/ 子目录）?
```

用户回答即字面绝对路径 · 同样用作 `<PLUGIN_ROOT>` 替换值。

## Step 2: Run the health-check script

Display: `perf-kp-sql checking dependencies...`

```
Bash(command="bash <PLUGIN_ROOT>/skills/perf-kp-sql-setup/scripts/check-health")
```

The script outputs a colored report covering:

- Node.js version
- `data/cases/{CASES.md,INDEX.md}` 与 `data/best-practice/{CASES.md,INDEX.md}` 存在性

Display the script's output verbatim.

## Step 3: Evaluate

Parse the script output. If every item is 🟢, display the success banner and stop:

```
✅ perf-kp-sql setup complete

   node <version>                          🟢
   data/cases/ + data/best-practice/       🟢

随时可重跑 /perf-kp-sql-setup 重新校验。
```

If `data/cases/` / `data/best-practice/` 文件缺失,recommend `/plugin reinstall perf-kp-sql`(案例文件随 plugin install 发布)。

# Invocation

This skill takes no arguments. Invoke explicitly via:

```
/perf-kp-sql-setup
```

Do NOT auto-invoke based on general user requests. Only fire when:
- The user explicitly types `/perf-kp-sql-setup`
- A perf-kp-sql diagnosis fails with 'module not found' 等运行时错误
- Right after first install of perf-kp-sql (one-time setup)
