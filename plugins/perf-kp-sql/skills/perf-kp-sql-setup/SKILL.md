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

## Phase 2: NotebookLM 增强（可选 · 用户决定）

Phase 1 完成后,**问用户是否启用 NotebookLM**(可选 · 不是强制)。

### Step 4: 询问启用 / 跳过

ask the user(topic = `NotebookLM 增强`):

```
━ NotebookLM 增强(可选)━

NotebookLM 是 Google 的 AI 知识库,Phase 4 多源诊断会用它做二次确认。

启用:
- 安装依赖 jacob-bd/notebooklm-mcp-cli
- 客户系统已装 Chromium 系任一即可(Chrome / Edge / Brave / Arc / Vivaldi / Opera / Chromium)
- ⚠️ 当前环境需要支持访问 https://notebooklm.google.com/

跳过(诊断结果全部来自案例,无官方文档校验):
- 诊断仍能跑 · 报告基于本地 202 案例库
- 后续随时可重跑 /perf-kp-sql-setup 切换为启用

请回复:
  1. 启用 (Recommended)
  2. 跳过
```

stop wait 用户回复。

**用户选 1(启用)**→ 跑 NotebookLM 完整安装(下面 Step 5):

### Step 5: 启用路径 — 调上游 jacob-bd/notebooklm-mcp-cli(业界 4.2K star CDP 标准)

前置:用户必须先装 `uv`(notebooklm-mcp-cli 走 uv tool install 装到 PATH)。setup 检测到 uv 不在会输出明确 next_steps 让用户装。

**setup 前提示用户**(LLM 字面输出 · 隔离 Chrome 启动前必须先关日常 Chrome 实例 · 这是 Chromium 单进程模型限制 · jacob-bd README L33-41 要求):

```
⚠️ setup 前请先 Cmd+Q 关闭所有 Chrome 实例(只这一次 · setup 完照常用)
```

stop wait 5 秒让用户关 Chrome · 然后:

```
Bash(command="node <PLUGIN_ROOT>/scripts/notebooklm.mjs --op setup --json")
```

`notebooklm.mjs --op setup` 内部(adapter · 不造轮子 · 全部 spawn 上游 nlm CLI):

1. **检测 uv** · 没装则 next_steps 引导(`curl -LsSf https://astral.sh/uv/install.sh | sh`)
2. **检测 Chromium 系浏览器**(macOS:Chrome.app / Edge.app / Brave Browser.app · Linux:`which google-chrome chromium chromium-browser brave-browser microsoft-edge` · Windows 等价检查) · 全无则提示用户装 Chrome / Edge / Brave 任一(免费 · 不影响日常用 Firefox / Safari)
3. `uv tool install notebooklm-mcp-cli` 装 nlm 到 `~/.local/bin/nlm`
4. 跑 `nlm login --check` 验证现有凭据(exit 0=有效 · 跳过登录直接进 Step 7;exit 2=失效 / 首次)
5. **失效或首次** → spawn `nlm login`(隔离 Chrome 自动弹出 · CDP 轮询 URL 离开 accounts.google.com 自动 detect 完成 · **无 Terminal ENTER** · 上游 jacob-bd cdp.py L860-874)
6. nlm login 成功 → cookie 落 `~/.notebooklm-mcp-cli/profiles/default/auth.json` → 进 Step 7

### Step 5 失败处理(setup 自动重试 + 用户兜底)

`nlm login` 失败的真实场景(基于上游 22+ 已修 issue · 当前主线稳定):

| 失败 | 处置 |
|---|---|
| 客户机器无 Chromium 系浏览器 | setup Step 2 提前检测 → 提示装 Chrome / Edge / Brave 任一 · 或选 disable 走仅案例 |
| Chrome 单进程冲突(没关日常 Chrome) | nlm 报错 → setup 提示用户 Cmd+Q 关 Chrome 重跑 |
| 企业管控 / 公司 EDR 拦截 CDP | nlm hang / timeout → 用户终止 · 选 disable 走仅案例 |
| 网络访问 google.com 受限 | nlm timeout → 同上 |
| Google 账号 2FA / Passkey 慢 | setup 给用户 5 分钟登录窗口(`nlm login --timeout 300`) · 超时重试 |

如果重试 2 次仍失败:LLM 提示用户:
- 选项 A:跑 `notebooklm.mjs --op disable` 跳过 NLM · 走仅案例(0 依赖 · 不影响诊断主流程)
- 选项 B:看上游 issue tracker(https://github.com/jacob-bd/notebooklm-mcp-cli/issues)报新 issue

**核心约束**:perf-kp-sql 不造 NLM 登录轮子 · 完全 spawn 上游 jacob-bd 4.2K star 已 ship 命令。上游 bug 不在我们 scope。

### Step 5b: 跳过路径 — 用户选 2(不装 NotebookLM)

```
Bash(command="node <PLUGIN_ROOT>/scripts/notebooklm.mjs --op disable --reason '用户在 setup 时选择跳过' --json")
```

`--op disable` 内部:
1. 写 `~/.perf-kp-sql/notebooklm.json` `{"skipped": true, "skipped_at": "..."}`
2. **不装任何依赖**(notebooklm-mcp-cli 不装 · 0 MB)
3. 后续 `notebooklm.mjs --op check` 看到 skipped → 返回 `{"skipped": true}`
4. Phase 4 多源诊断看到 skipped → **自动走仅案例降级** · 不再尝试调 NLM
5. 报告标"⚠️ NLM 未启用 · 诊断基于本地 202 案例库"

跳过后直接结束(完成 banner)· 不进 Step 5 / Step 7。

### Step 6: 运行时 NLM 失败 → 自动降级(已启用场景)

用户启用了 NLM · 但运行时(/perf-kp-sql 诊断中)NLM 调用可能失败:

| 失败类型 | 处置 |
|---|---|
| 网络超时(NLM 服务侧 5xx / 连接断 / 用户网络抖) | 自动 skip 当前 NLM call · Phase 4 走仅案例 · 不阻塞 |
| 限流(超过访问次数 / quota exceeded) | 同上 · skip + 仅案例 · 报告标 "⚠️ NLM 限流" |
| 鉴权失败(401/403/cookie 过期) | adapter 自动 spawn `nlm login --check` → 失效则 spawn `nlm login` 重登 · 失败再次降级 |
| nlm 子进程崩溃 / hang | timeout skip + 仅案例 |

**核心约束**(Phase 4):**任何 NLM 失败都不阻塞诊断** · 直接走仅案例 · 报告头标 NLM 状态。详见 main SKILL Phase 4 "根因来源强约束"段。

**用户体验**:NLM 启用了但临时不可用 · 诊断照样能跑 · 只是报告少一些"NLM 二次确认 + 最新文档引用" · 案例库 202 条仍给出根因 + 修复建议。

### Step 7: 创建 Notebooks + 添加 URL

setup 脚本内部自动完成(全部 spawn `nlm` 子命令 · adapter 不造轮子):
- 按领域创建 notebooks(ohsql-mongo-kb / ohsql-kunpeng-kb / ohsql-os-kb)· 用 `nlm notebook list --json` 查同名复用
- 从 `data/notebooklm-urls.json` 读各领域 URL · 用 `nlm source add <id> --url <u> --wait` 添加
- 增量同步:已存在的 URL 跳过 · 新增的添加 · 已删除的删
- 写入 `~/.perf-kp-sql/notebooklm.json` 持久化配置

### Step 8: 等待就绪 + 验证

`nlm source add --wait` 自带等 source 处理完成(默认 600s)· adapter 不再单独写等待轮询。

完成后检查 setup 输出的 JSON:
- `ok: true` → 显示成功 banner:

```
✅ NotebookLM 增强已就绪

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
