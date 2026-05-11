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

Display: `perf-kp-sql checking dependencies...`

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

Phase 1 — 必装项
   node <version>                          🟢
   data/cases/ + data/best-practice/       🟢

Phase 2 — NotebookLM 增强：跳过

随时可重跑 /perf-kp-sql-setup 重新校验或切换为启用。
```

If `data/cases/` / `data/best-practice/` 文件缺失，recommend `/plugin reinstall perf-kp-sql`（案例文件随 plugin install 发布）。

Otherwise proceed to Phase 2 (NotebookLM).

## Phase 2: NotebookLM 增强（可选，用户决定）

Phase 1 完成后,**问用户是否启用 NotebookLM**(可选,不是强制)。

### Step 4: 询问启用 / 跳过

ask the user(topic = `NotebookLM 增强`):

```
━ NotebookLM 增强（可选）━

是否启用 NotebookLM 增强（多源诊断的二次确认源）？

1. 启用 (Recommended)
   需当前环境装有 Chromium 系任一浏览器（Chrome/Edge/Brave 等），且可访问 https://notebooklm.google.com。会自动安装 uv + notebooklm-mcp-cli，启动一个独立 Chrome 实例完成 Google 登录（跟日常 Chrome 互不影响），然后创建 3 个领域 notebooks（mongo / kunpeng / os）并同步 URL 源。
2. 跳过
   诊断功能正常，报告基于本地 202 案例库。0 依赖，不装任何组件。后续随时可重跑 /perf-kp-sql-setup 切换为启用。
```

stop wait 用户回复。

**用户选 1(启用)**→ 跑 NotebookLM 完整安装(下面 Step 5):

### Step 5: 启用路径 — 装环境 + 登录(preflight)

前置:用户必须先装 `uv`(notebooklm-mcp-cli 走 uv tool install 装到 PATH)。preflight 检测到 uv 不在会自动装,失败则输出明确 next_steps 让用户手装。

preflight 启动隔离 Chrome 走 CDP 登录(独立 `--user-data-dir=~/.notebooklm-mcp-cli/chrome-profiles/default`,跟日常 Chrome profile 不冲突,不需要关闭):

```
Bash(command="node <PLUGIN_ROOT>/scripts/notebooklm.mjs --op setup-preflight --json", timeout=700000)
```

`notebooklm.mjs --op setup-preflight` 内部(adapter,不造轮子,全部 spawn 上游 nlm CLI):

1. **检测 uv**,没装则自动装(国内镜像优先 · 跨平台);仍失败 next_steps 引导
2. **检测 Chromium 系浏览器**(macOS:Chrome.app / Edge.app / Brave Browser.app;Linux:`which google-chrome chromium chromium-browser brave-browser microsoft-edge`;Windows 等价检查),全无则提示用户装 Chrome/Edge/Brave 等任一(免费,不影响日常用 Firefox/Safari)
3. `uv tool install notebooklm-mcp-cli --upgrade` 装 nlm 到 `~/.local/bin/nlm`
4. 跑 `nlm login --check` 验证现有凭据(exit 0=有效,直接 ok;exit 2=失效 / 首次)
5. **失效或首次** → spawn `nlm login`(隔离 Chrome 自动弹出,CDP 轮询 URL 离开 accounts.google.com 自动 detect 完成,**无 Terminal ENTER**)
6. nlm login 成功 → cookie 落 `~/.notebooklm-mcp-cli/profiles/default/auth.json`

**preflight 输出 JSON 契约**(成功 stdout):

```
{
  "ok": true,
  "uv_version": "uv X.Y.Z (...)",
  "browser": ["Google Chrome"],
  "logged_in": true,
  "just_logged_in": false,        // 本次是否走过 nlm login(true=刚登,false=复用 cookie)
  "was_disabled": false           // 上次是否处于 disable 状态
}
```

失败 stdout(`process.exit(1)`,Bash 工具会显示非零 exit):

```
{
  "ok": false,
  "error": "<具体原因>",
  "next_steps": ["<引导 1>", "<引导 2>", ...],
  // 按 case 还可能带:
  "need_chromium_browser": true,  // Chromium 系浏览器全无
  "suggestion": "<装哪个>",
  "need_user_login": true,        // 登录失败,提示用户重试
  "stdout": "<nlm 子进程 stdout 截 500B>",
  "stderr": "<nlm 子进程 stderr 截 500B>"
}
```

agent 看 `ok` 字段决定下一步。**ok=true 时必须在 chat 里给用户写一行进度**,例如:

```
✓ 环境就绪 — uv 0.11.3 · Google Chrome · nlm CLI · 凭据有效
```

或刚走完登录(`just_logged_in: true`):

```
✓ 环境就绪 — uv 0.11.3 · Google Chrome · nlm CLI · 登录完成,cookie 已落盘
```

然后进 Step 7 逐域同步。

> 备注:原 `--op setup` 一把梭(preflight + 三域同步)仍可用作兼容入口,但本 SKILL 不再走它,而是 preflight + 逐域 add-domain,以便每域结束都能给用户进度反馈。

### Step 5 失败处理(preflight 自动重试 + 用户兜底)

agent 判断失败的两个来源(任一即视为失败,优先按 Bash exit code):

- Bash 工具返回非零 exit code(`opSetupPreflight` 失败时 `process.exit(1)`)
- stdout JSON `ok: false`

`nlm login` 失败的真实场景:

| 失败 | 处置 |
|---|---|
| 客户机器无 Chromium 系浏览器 | preflight Step 2 提前检测 → 提示装 Chrome/Edge/Brave 等任一,或选 disable 走仅案例 |
| 企业管控 / 公司 EDR 拦截 CDP | nlm hang / timeout → 用户终止,选 disable 走仅案例 |
| 网络访问 google.com 受限 | nlm timeout → 同上 |
| Google 账号 2FA / Passkey 慢 | preflight 给用户 5 分钟登录窗口(`nlm login --timeout 300`),超时重试 |

如果重试 2 次仍失败,LLM 提示用户:
- 选项 A:跑 `notebooklm.mjs --op disable` 跳过 NLM,走仅案例(0 依赖,不影响诊断主流程)
- 选项 B:看上游 issue tracker 报新 issue

**核心约束**:perf-kp-sql 不造 NLM 登录轮子,完全 spawn 上游已 ship 命令。上游 bug 不在我们 scope。

### Step 5b: 跳过路径 — 用户选 2(不装 NotebookLM)

```
Bash(command="node <PLUGIN_ROOT>/scripts/notebooklm.mjs --op disable --reason '用户在 setup 时选择跳过' --json")
```

`--op disable` 内部:
1. 写 `~/.perf-kp-sql/notebooklm.json` `{"skipped": true, "skipped_at": "..."}`
2. **不装任何依赖**(notebooklm-mcp-cli 不装,0 MB)
3. 后续 `notebooklm.mjs --op check` 看到 skipped → 返回 `{"skipped": true}`
4. Phase 4 多源诊断看到 skipped → **自动走仅案例降级**,不再尝试调 NLM
5. 报告标"⚠️ NLM 未启用，诊断基于本地 202 案例库"

跳过后直接结束(完成 banner)· 不进 Step 5 / Step 7。

### Step 6: 运行时 NLM 失败 → 自动降级(已启用场景)

用户启用了 NLM,但运行时(/perf-kp-sql 诊断中)NLM 调用可能失败:

| 失败类型 | 处置 |
|---|---|
| 网络超时(NLM 服务侧 5xx / 连接断 / 用户网络抖) | 自动 skip 当前 NLM call,Phase 4 走仅案例,不阻塞 |
| 限流(超过访问次数 / quota exceeded) | 同上,skip + 仅案例,报告标 "⚠️ NLM 限流" |
| 鉴权失败(401/403/cookie 过期) | adapter 自动 spawn `nlm login --check` → 失效则 spawn `nlm login` 重登,失败再次降级 |
| nlm 子进程崩溃 / hang | timeout skip + 仅案例 |

**核心约束**(Phase 4):**任何 NLM 失败都不阻塞诊断**,直接走仅案例,报告头标 NLM 状态。详见 main SKILL Phase 4 "根因来源强约束"段。

**用户体验**:NLM 启用了但临时不可用,诊断照样能跑,只是报告少一些"NLM 二次确认 + 最新文档引用",案例库 202 条仍给出根因 + 修复建议。

### Step 7: 逐域创建领域知识库

为了让用户看到进度(三个领域累计 4-8 分钟,单次 setup 中间用户没反馈会以为卡住),agent **必须按下面 4 步拆开调用,每域之间在 chat 里给一行进度**。

第一次调用之前 agent 在 chat 里写一行(总预告):

```
开始创建各领域知识库
```

#### Step 7.1 / 7.2 / 7.3: 三次 `add-domain`,**严格串行**,每次拿到上一次结果再发下一次

**关键约束**:每次 Bash 调用必须等 stdout JSON 返回后再发下一次。**不许并发(parallel tool call)、不许多个 Bash 并起来** · 否则用户在 chat 里拿不到逐域进度行,且 nlm 服务侧并发可能踩限流。

> 注:NotebookLM 服务侧的并发限流是推测、未严格验证;但串行也是为了让每域结束都能给用户写一行 chat 进度,不并发是核心需求。

每域调用契约:

```
Bash(command="node <PLUGIN_ROOT>/scripts/notebooklm.mjs --op add-domain --domain <DOMAIN> --json", timeout=600000)
```

stdout JSON(成功):

```
{
  "ok": true,
  "domain": "<DOMAIN>",
  "notebook_id": "<uuid>",
  "total_count": <累计落地 URL 数 · 含远端已有 + 本次新加>,
  "added_count": <本次新加成功提交数 · = ready_count + pending_count>,
  "ready_count": <本次新加且后端确认就绪的数>,
  "pending_count": <本次新加但后端还在处理的数>,
  "failed_count": <本次新加失败数>,
  "source_count": <= total_count · 兼容字段>,
  "urls": [{"url": "...", "source_id": "...", "status": "READY|PENDING|FAILED"}, ...]
}
```

stdout JSON(失败 · 域级失败也走 ok:false 不退进程):

```
{
  "ok": false,
  "domain": "<DOMAIN>",
  "error": "<具体原因 · 如 'nlm 凭据失效，请重跑 /perf-kp-sql-setup 完成登录' / '创建 notebook ... 失败' 等>"
}
```

每域跑完 chat 写一行(`<DISPLAY>` 用面向用户的领域名:`mongo` → `mongodb`,`kunpeng` 和 `os` 不变):

- ok=true:
  - `added_count == 0` 且 `total_count > 0`:`✓ <DISPLAY> 知识库创建完成 — <total_count> 篇文档已存在,无需新增`
  - `pending_count == 0` 时:`✓ <DISPLAY> 知识库创建完成 — 新加 <added_count>/<total_count> 篇`(若 `failed_count > 0` 追加 `· <failed_count> 篇失败`)
  - `pending_count > 0` 时:`✓ <DISPLAY> 知识库创建完成 — 新加 <added_count>/<total_count> 篇(<ready_count> 就绪 + <pending_count> 处理中)`(若 `failed_count > 0` 追加 `· <failed_count> 篇失败`)
- ok=false:`✗ <DISPLAY> 知识库创建失败 — <error>`,**仍继续下一域**(SKILL 的"某域失败不阻塞其它域"约定)

##### Step 7.1: 创建 mongodb 知识库

调用前 chat 写:`开始创建 mongodb 知识库` · 然后执行 Bash · DOMAIN=mongo · 等结果 · 按上面的契约写一行进度。

##### Step 7.2: 创建 kunpeng 知识库

调用前 chat 写:`开始创建 kunpeng 知识库` · DOMAIN=kunpeng · 等 7.1 结果出来再发。

##### Step 7.3: 创建 os 知识库

调用前 chat 写:`开始创建 os 知识库` · DOMAIN=os · 等 7.2 结果出来再发。

#### Step 7.4: 渲染最终 banner

三次 `add-domain` 全部跑完后(成功或失败都算跑完)进 Step 8。

### Step 8: 完成 banner

agent 把 Step 7.1/7.2/7.3 收到的三次 `add-domain` 结果汇总,渲染:
- `<n_mongo>` / `<n_kunpeng>` / `<n_os>` 用各域 `total_count`
- `<total>` = 三个 total_count 累加
- `<version>` 用一次单独 Bash 直接拿,不依赖 LLM parse health-check 文本:
  ```
  Bash(command="node --version")
  ```
  stdout 形如 `v25.9.0` · 直接填入 `<version>` 占位符
- 失败的域 🟢 → 🟡 并附 `error` 摘要(字面尖括号 · 不要原样输出给用户):

```
✅ perf-kp-sql setup complete

Phase 1 — 必装项
   node <version>                          🟢
   data/cases/ + data/best-practice/       🟢

Phase 2 — NotebookLM 增强
已经基于 <total> 篇官方文档帮你创建 mongodb/kunpeng/os 三个领域 notebook 知识库用于后续诊断。

   ohsql-mongo-kb     🟢  <n_mongo> 篇文档
   ohsql-kunpeng-kb   🟢  <n_kunpeng> 篇文档
   ohsql-os-kb        🟢  <n_os> 篇文档

随时可重跑 /perf-kp-sql-setup 重新校验或切换 NLM 启用状态。
```

- 任一域 `ok: false` → 该行 🟢 改成 🟡 + 一句失败原因,banner 标题改成 "✅ perf-kp-sql setup complete(部分领域失败)",其它域不阻塞

# Invocation

This skill takes no arguments. Invoke explicitly via:

```
/perf-kp-sql-setup
```

Do NOT auto-invoke based on general user requests. Only fire when:
- The user explicitly types `/perf-kp-sql-setup`
- A perf-kp-sql diagnosis fails with 'module not found' 等运行时错误
- Right after first install of perf-kp-sql (one-time setup)
