---
name: perf-kp-sql
description: Kunpeng ARM64 + MongoDB joint performance diagnosis. SSH-based remote collection (8 项环境画像 + per-case 命令拉指标), LLM-orchestrated 6-phase pipeline routing user symptoms against a 202-case knowledge base (KB.md / INDEX.md) with NotebookLM as authoritative refresh source, and emits an impact-ranked markdown report (auto-converted to HTML for sharing). Use when users report MongoDB slowness, CPU spikes, latency jitter, or are doing Kunpeng migration / config audit. Triggers include '数据库慢' / 'CPU 高' / '抖动' / 'mongo perf' / 'Kunpeng 性能' / similar phrases. First-time use:run `/perf-kp-sql-setup` to install native deps + register NotebookLM.
compatibility: |
  Requires SSH access to the target host + local OpenSSH `ssh` CLI (Linux/macOS
  自带 · Windows 走 WSL 或 OpenSSH-Win)。两种认证方式都通过 `node ssh.mjs`
  wrapper · agent-agnostic · 任何能跑 node + ssh 的 agent runtime 都能用:
  - SSH key (推荐): pass `privateKeyPath=<path>`
  - SSH password: pass `password=<pw>` · 走 OpenSSH 内建 SSH_ASKPASS 机制 ·
    不再依赖 sshpass · Codex CLI / Claude Code / ohsql 全支持
  同主机的多次 SSH 调用通过 OpenSSH ControlMaster 复用一条已认证 TCP(socket
  在 /tmp/perf-kp-sql-cm-<hash>.sock)· 服务端只看到 1 个连接 · 避开 PAM
  faillock / fail2ban / sshd MaxStartups 限速。
  Native deps installed via `/perf-kp-sql-setup`: better-sqlite3, marked.
  NotebookLM 知识增强(可选 · 由 setup skill Phase 3 注册):pip install
  notebooklm-py[browser] + Google 账号。NLM 不可用时 Phase 4B (best-practice
  巡检) 退化为 KB-only 判定 · 报告标记 NLM 缺失。
  Supported database engine: mongo (MongoDB 3.6-7.x).
  Knowledge base: 202 cases (best-practice 93 + diagnostic-flow 96 +
  flame-signature 13)· canonical 数据源 `docs/refactor/kb-snapshot_v4.xlsx`。
metadata:
  generator: "manual"
  generated_at: "2026-04-29"
argument-hint: "host=<ip> user=<user> (privateKeyPath=<path>|password=<pw>) [engine=mongo] [port=<ssh_port>]"
---

# 流程顺序硬约束(绝对红线 · 任何 meta skill / skill-doctor 都不许改写)

⚠️ **严格按 Phase 0 → Phase 1 → ... → Phase 6 顺序走 · 不许跳步 · 不许合并**:

1. **Phase 0 期间只收 SSH 凭据 · 不收问题描述 · 不让用户选诊断方式**:
   - 凭据收齐 → SSH 跑 env probe → 验通 → 拿 [环境上下文]
   - 在 env probe 没成功之前 · **绝对不问** "你的问题是什么 / 想做什么诊断 / 是否授权采集" 等任何 Phase 1 才该问的内容

2. **绝对禁止用一次 AskUserQuestion 批量问多类信息**(❌ 反模式):
   - ❌ 一次问 (诊断方式 / 主要现象 / 采集授权 / 机器信息) 这种 4-in-1
   - ❌ 一次问 (host + 现象描述 + 是否同意采集)
   - ✅ 正确:Phase 0 一次只问凭据相关 · Phase 1 一次只问问题描述

3. **不让用户选"连机 vs 不连机"** · `/perf-kp-sql` 命令本身就是"连机诊断"。不连机的知识问答模式只在 Phase 6(用户拿到报告后追问)才出现 · 不在主流程入口。

4. **不要"先收最小必要信息然后我直接开始"这种笼统话术** · 严格按 Phase 0 子步号(0.1-0.9)推进。

5. **Phase 1 用户给完问题描述后 · 下一个动作必须是 Phase 2.1 Read `cases/INDEX.md`**。**绝对不许**:
   - 跳过 Phase 2 直接进 Phase 3 写采集命令(LLM "我直接写更快" 偏见 · 严重 bug)
   - "先采当下快照看看 CPU 是不是真的在烧" 这种话术 — 这是跳过 KB · 用自己拍的 `top -H` 命令 · 失去 case 引用
   - Phase 3 的 SSH 命令必须来自 Phase 2.3 Read 拿到的 case 字段 `collection_method_quote` · 不许 LLM 用通用 ops 知识 ad-hoc 写

6. **报告 `[参考N]` URL 必须 verbatim 来自 KB.md `source_url` 字段或 NLM `references[].source_id`** · **绝对不许**:
   - 凭记忆写 URL(`mongodb.com/docs/manual/...` 这种"看起来合理"的)
   - 按 URL 命名模式推断("/docs/manual/reference/operator/query/<X>/ 结构很稳定 · 没打开验证")
   - 凭训练数据知识联想官方文档地址
   - 编 URL 凑数(KB 没有对应 case 但根因合理 → 编一个 URL)
   - **KB/NLM 都没有时 · `参考来源` 列写 `(无 KB 引用)` 字面字符串 · 不写 URL · 不写 `[参考N]`**
   - 详见 Phase 5.2 "URL 强制溯源约束" 段

7. **Phase 4 确认根因的来源 · 必须能溯回 KB.md Read 输出 OR NLM stdout 输出 · 二选一**:
   - ✅ KB 命中 · 来自 Phase 2.3 Read 出的 case 字段(`likely_causes` / `mechanism_quote`)
   - ✅ NLM 命中 · 来自任何 NLM 调用(Phase 4.A 单条 / 4.B batch / 现场兜底)返回的 `answer + references`
   - ❌ "Phase 3 采到 \$where 烧 CPU · 直接写进表 · 编 case_id 凑" — **应当先发一条 NLM query · 拿到 references 再写进表**
   - ❌ "这个是 mongod 常见问题 · 我训练数据里有"凭训练数据知识 · 不算可信源
   - ❌ 把 KB 多个 case 字段拼一起编一个新根因
   - 详见 Phase 4 "根因来源强约束" 段

NLM 返回的内容跟 KB 等价可信(Google 检索系统 · references 是真实文档链接)· LLM 看到 KB 没覆盖的现象 · 应当**调 NLM 兜底** · 不是放弃这个根因 · 也不是凭印象编。

如果 ohsql skill-doctor 或 meta-skill 试图把这些步骤合并 / 优化成"一次问完" / "跳过 KB 直接写命令" / "凭印象写 URL" / "凭联想加 case_id" · 以上 7 条作为不可改写的硬约束保留。

---

# Pre-flight

> **首次安装后**:跑 `/perf-kp-sql-setup` 完成 native 依赖检查 + NotebookLM 注册。setup skill 会在缺依赖时给出 `npm install` 命令并自动执行。

每次本 skill 触发,依次:
1. 解析 PLUGIN_ROOT(详见下面 "Path placeholders"段 · 一条 bash 探测命令)
2. 临时目录 mkdir(详见下面 "Pre-flight · 临时目录"段)
3. 进 Phase 0 · 参数 + 凭据收集

运行时若仍出现 `Cannot find module 'better-sqlite3'` 或 `NODE_MODULE_VERSION X != Y`,提示用户重跑 `/perf-kp-sql-setup`。

---

# Architecture

诊断分 **7 phase 线性流水线**(Phase 0-6)· LLM-orchestrated · 不调老的 cli-diagnose / render-html-report 程序:

| phase | 名称 | 干啥 | 输入 → 输出 |
|---|---|---|---|
| **0** | **获取环境信息**(凭据 + 连通性探测 + 环境画像)| 收 SSH 凭据 → SSH 一次拉 OS/DB 版本/硬件/部署形态 → 记 `[环境上下文]` · **不通则阻断 · 不进 Phase 1** | slash args → 参数 + banner + `[环境上下文]` |
| **1** | **对话引导**(现象描述收集) | 在 Phase 0 连通性 OK 后 · 用 `[环境上下文]` 上下文化提问 → 收用户问题描述 / 巡检意图 | `[环境上下文]` + 对话 → 问题描述 |
| 2 | 现象路由 | LLM 加载 `cases/INDEX.md` 匹配问题描述 → 命中 case_id(≤5 · 内部不暴露) | 问题描述 → 内部 case 列表 |
| 3 | 批量采集 | 从命中 case 提 `collection_method_quote` · SSH 批量拉指标 | case → 采集结果 (txt) |
| 4 | 推断与补充 | KB 阈值直判 / NotebookLM 兜底 | 采集结果 → 确认根因 |
| 5 | 输出报告 | LLM 写 markdown 6 列表 + `md-to-html.mjs` 转 HTML | 根因 → 报告文件 (md + html) |
| 6 | 深入对话(可选)| 用户追问 → KB Read 单 case / NLM 单条 | 追问 → 答案 |

**Phase 0 → Phase 1 硬约束**:Phase 0 的 SSH 连通性探测必须成功(env probe 命令拿到合理 stdout)· 才能进 Phase 1 跟用户聊问题描述。**SSH 不通 / 凭据错 / 主机不通**等情况 · 一律在 Phase 0 阻断 · 给用户报错让 ta 修 · **不进入对话引导环节**。理由:聊半天问题描述但凭据是错的 · 等于白聊。

**数据布局**:

| 文件 | 用途 | 加载时机 |
|---|---|---|
| `data/kb/cases/INDEX.md` | DF + Flame 路由表 (~6.4K tokens) | Phase 2 启动加载 |
| `data/kb/cases/KB.md` | DF + Flame 完整字段 | Phase 2.3 用 Read offset+limit 拿单 case · Phase 6 同 |
| `data/kb/best-practice/INDEX.md` | BP 巡检表 (~6.0K tokens) | Phase 3 nothing 模式才加载 |
| `data/kb/best-practice/KB.md` | BP 完整字段 | Phase 3 巡检 / Phase 6 同 |
| `data/collect-cmds.json` | (legacy · Phase 1 不依赖 · 内嵌固定 8 条命令 · 文件保留作历史参考)| — |

**工具**:

| 命令 | 用途 |
|---|---|
| `scripts/ssh.mjs --op exec` | SSH wrapper (ControlMaster + SSH_ASKPASS) · 一切 SSH 走它 |
| `scripts/ssh.mjs --op session-close` | 流程末尾收 master |
| `scripts/notebooklm.mjs --op query` | NLM 单条查询 |
| `scripts/notebooklm.mjs --op query-batch --from-bp-list <path>` | NLM 全量 BP 巡检 batch (M4 实装 · per-notebook merged ask) |
| `scripts/md-to-html.mjs <md> <html>` | 报告 markdown → HTML 转换 (含 [参考N] 脚注处理) |
| `scripts/history.mjs --op load|save` | 历史连接 |
| `scripts/capture-flamegraph.mjs` | 火焰图采集(走 cpu-flamegraph 子 plugin)|

## Path placeholders · 字面尖括号占位符 · agent 字符串替换

下文所有 `<PLUGIN_ROOT>` 都是**纯文本占位符**(字面尖括号 · 不是 shell 变量,也不依赖任何 harness loader-time 替换)· agent 在每次发 `Bash(command=...)` 前做字符串替换,把 `<PLUGIN_ROOT>` 替换为字面绝对路径。

> ⚠️ **绝对不要在 Bash command 里写带大括号的 shell 参数替换形态**(形如 `$ {VAR}` · 此处加空格仅为文档显示 · 实际是 dollar+left-brace+name+right-brace)—— ohsql Bash 工具有静态屏蔽 · 任何含 dollar-brace 的命令一律 reject(`Command contains ${} parameter substitution`)· 即便 harness 已经替换了其中一个变量 · 另一个残留仍会触发。无 brace 的 `$HOME` / `$d` 形态不受影响。

### 解析 PLUGIN_ROOT(本 skill 启动时一次)

```
Bash(command="bash -c 'for d in \"$HOME\"/.ohsql/plugins/cache/perf-kp-sql@* \"$HOME\"/.claude-max/plugins/cache/*/perf-kp-sql/* \"$HOME\"/.claude/plugins/cache/*/perf-kp-sql/* \"$HOME\"/.codex/plugins/cache/*/perf-kp-sql/*; do test -d \"$d\" && echo \"$d\"; done | sort -V -r | head -1'")
```

stdout 是字面绝对路径(形如 `/Users/<login>/.ohsql/plugins/cache/perf-kp-sql@0.25.7`)· 整个 skill 流程都用此值替换 `<PLUGIN_ROOT>`。stdout 空时跑 AskUserQuestion 让用户填(选项详见 `perf-kp-sql-setup/SKILL.md` Step 1 fallback)。

同理:`/Users/<yourlogin>/...` 替换为真实 home 绝对路径(`echo "$HOME"` 拿一次);`<TS>` 替换为本轮统一的 `YYYYMMDD-HHMMSS`;`<ip>` / `<user>` / `<engine>` 替换为参数集里的真值。

> ⚠️ Some agent shell sandboxes reject heredoc / `>` / `<` / `|` / `$'...'` / `` ` `` / 3+ consecutive quotes. Strictly use **write-file → shell (no redirection) → write-file** for the collection chain.

## SSH execution pattern

This skill SSHs to the target host multiple times — **统一走** `node <PLUGIN_ROOT>/scripts/ssh.mjs --op exec`,key auth 与 password auth 共用同一 wrapper · 输出同一 JSON 结构。

### 调用模板(命令字面短且不含 `'` / `"` / `$`)

```
Bash(command="node <PLUGIN_ROOT>/scripts/ssh.mjs --op exec \
       --host <ip> --user <user> [--privateKeyPath <path> | --password '<pw>'] [--port <n>] \
       --command '<command>'")
```

### 调用模板(命令含 `'` / `"` / `$` 混杂 → 必须走 `--command-file`)

典型场景:Phase 1 环境画像命令集 / Phase 3 case-driven 采集命令拼装。**不要**改用 `$'...'` ANSI-C 引号或 `"<cmd>"` 内联 —— 前者命中 OH-SQL BashTool 硬拒(CC 平台同款规则会弹权限提示),后者会让远端要展开的 `$VAR` 被本机 shell 提前吃掉。

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt", content="<command 字面>")
Bash(command="node <PLUGIN_ROOT>/scripts/ssh.mjs --op exec \
       --host <ip> --user <user> [--privateKeyPath <path> | --password '<pw>'] [--port <n>] \
       --command-file /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt")
```

`<TS>` 用本轮调用统一的时间戳后缀,用完不必删除 ——`/Users/<yourlogin>/.perf-kp-sql/tmp/` 是会话临时目录。

### 认证方式

- 用户传了 `privateKeyPath=<path>` → 加 `--privateKeyPath <path>` flag · 走 OpenSSH pubkey
- 用户传了 `password=<pw>` → 加 `--password '<pw>'` flag · ssh.mjs 内部走 SSH_ASKPASS · **不依赖 sshpass** · Codex CLI / Claude Code / ohsql 全支持
- 两个都给 → key 优先 · password 静默忽略

### ControlMaster 长连接

ssh.mjs 自带 `ControlMaster=auto` + 稳定 hash ControlPath + `ControlPersist=600`。**第一次** ssh.mjs 调用顺手开 master · 后续直接通过 socket 起新 channel(完全跳过 TCP 握手 + auth)· 服务端只看到 1 个连接 · 不计入 PAM faillock / fail2ban / sshd MaxStartups 限速器。

### 流程末尾 · session-close

Phase 5 收尾显式调一次 `--op session-close` 收掉 master:

```
Bash(command="node <PLUGIN_ROOT>/scripts/ssh.mjs --op session-close \
       --host <ip> --user <user> [--port <n>]")
```

即使忘调,ControlPersist=600(10 min)到期也会自动退,不会留孤儿。

### 输出结构

`ssh.mjs --op exec` 的 stdout 是结构化 JSON:`{"stdout":"...","stderr":"...","exitCode":0}`(`--output-file` 模式下 `stdout` 字段被替换为 `<wrote N bytes to /path>` metadata)。LLM 拿到后:
- 解析 JSON,取 `stdout` 字段当作"远端命令的标准输出"
- `exitCode === 0` 且 `stdout` 非空 → 成功;`stdout` 空且 `stderr` 空 → 走 Phase 0 · Gate 4 自检
- `err` 字段非空 → SSH 协议层失败(`SSH connection failed (255)` 等),按场景兜底

`ssh.mjs --op session-close` 的 stdout 是 `{"ok":true,"controlPath":"..."}`(socket 不存在或 master 已退也算 ok)。

## Task tracking pattern

This skill runs 6 phases (Phase 0 + 1-5 · Phase 6 是用户追问触发 · 不进主任务清单)。Track them with the agent's task-list facility:
- **Claude Code**: use `TodoWrite` (6-element array, status field per item)
- **OpenAI Codex CLI**: use `update_plan` (6 steps, status field per step)
- **ohsql**: 内嵌 task tool
- **其他 agents 只在没 task tool 时**: render progress as plain text using `◻ ◼ ✔` markers

**Single-source rule** — do NOT print the task list as plain text in chat when the task tool is available。Each phase transition (in_progress → completed; pending → in_progress) 通过 task tool 重发完整 task list,不另写 plain text。

---

# Pre-flight · 临时目录就绪

skill 加载后、Phase 0 之前,无条件先跑一次 mkdir 兜底(目录已存在 = 静默 noop):

```
Bash(command="mkdir -p ~/.perf-kp-sql/tmp ~/.perf-kp-sql/reports ~/.perf-kp-sql/flame")
```

这一行命令不含 `${}` / heredoc / 重定向 / 引号嵌套,跨三家 harness 都能过。失败极罕见(磁盘满 / 权限禁),失败时给用户一行 `请确认 $HOME 可写后重试` 即可。

---

# Workflow

> **流程顺序**:Phase 0 凭据 + 连通性 + 环境画像 → Phase 1 对话引导(用环境上下文聊问题描述)→ Phase 2 现象路由 → Phase 3-6。**Phase 0 连通性探测成功前 · 不进 Phase 1 跟用户聊问题**。

## Phase 0 · 获取环境信息(凭据 + 连通性探测 + 环境画像)

**这是流程第一步 · 也是关键 gate**:
1. 收齐 SSH 凭据 + 渲染 banner
2. SSH 一次跑 8 条命令拉环境画像(同时验证连通性)
3. 拿到 `[环境上下文]` 后才进 Phase 1 跟用户聊问题描述

**banner 必须在任何远端 SSH 命令之前渲染。** 本地参数收集(history load · prompts to user)不受限。

**连通性硬约束**:0.7 SSH env probe 失败 → 阻断流程 · 给用户 troubleshooting · 等用户修凭据 / 网络后重发命令 · **不进 Phase 1 对话引导**。聊半天问题描述但凭据是错的 = 白聊。

### 0.1 · 历史复用

触发:slash args 缺 host 时。

```
Bash(command="node <PLUGIN_ROOT>/scripts/history.mjs --op load --max 5")
```

hosts 非空 → ask the user to pick one (even if there's only 1 entry — explicit confirmation):

```
请选择最近使用过的连接 · 或新建:

  1. 192.168.1.10 · admin · mongo · 上次 2 小时前 (port=22 · 累计 8 次)
  2. 10.20.30.40 · ec2-user · mongo · 上次 3 天前 (port=22 · 累计 3 次)
  3. 新连接 · 手动输入参数
```

Stop here and wait for the user's selection in the next turn. Once selected, fully decode the JSON (`host / user / port / engine / password / privateKeyPath / mongo_user / mongo_password / auth_db`) into the parameter set。

**No stopping after selection**: same turn → render banner → declare 6-phase task list → mark phase 0 completed (params 收齐) → mark phase 1 in_progress → 进 Phase 1 SSH。

### 0.2 · 参数抽取

从用户任意措辞抽取:
- 必填:`host`(IP/FQDN)、`user`、`password`(或 `privateKeyPath`)
- 可选:`port`(默认 22)、`engine`(目前只支持 `mongo`,默认即 mongo)
- MongoDB 可选:`mongo_user`、`mongo_password`、`auth_db`(默认 admin)

抽取策略:严格 kv → 半结构化 → 自然语言 → 混合。抽取失败只问缺的字段,不重来整表。

### 0.3 · 参数校验

两类 check,任一命中阻塞 banner:

**Class 1 缺字段** — host / user / (password OR privateKeyPath) 任一缺:

> Ask the user (with the missing field name as the topic):
> ```
> ━ kunpeng · 参数待补全 ━
> 还缺:<缺字段名>(例:SSH 密码 / SSH 私钥路径)
> 请补充。
> ```
> Stop and wait for the next turn。

**Class 2 格式非法** — host 非合法 IP/FQDN、port 非 1-65535、engine 不在支持集合(当前 `engine` 仅接受 `mongo`):

> Ask the user (with the bad field name as the topic):
> ```
> ━ kunpeng · 参数格式异常 ━
> <字段名> 格式不对:<原值> → <期望格式 / 合法集合>
> 请重新提供。
> ```
> Stop and wait for the next turn。

`<字段名>` 只写具体名(`SSH 密码` / `主机格式` / `端口格式`),不用模糊词。

### 0.4 · `[连接信息]` banner

参数齐备后打:

```
[连接信息]
  · host=192.168.1.10 · user=admin · port=22 · engine=mongo
  · password=ABC***XYZ
  · mongo_password=ABC***XYZ · auth_db=admin
```

password 前 3 + `***` + 后 3 脱敏。后续 SSH 命令的 host/user/port/password/privateKeyPath 参数必须与 banner 字段一一对应。

### 0.5 · SSH 参数门(Gates)

**Gate 2** — SSH 命令的 host/user/port/password/privateKeyPath 必须与 banner 字面一致。

**Gate 3** — history 里 password 非空 → 必传;privateKeyPath 非空 → 必传;两者都空 → 先问凭据。

**Gate 4** — SSH 命令返 stdout=stderr="" 时:
1. 打自检行(实发参数 vs history 比对)
2. 发现漏传 → 同 turn 重试
3. 全传齐仍空 → 走紧凑二次收集

### 0.6 · DB 凭据预询问(凭据缺时前置)

**触发**:DB 凭据缺(0.9.2 起只支持 mongo,无 engine 分支):
- mongo 缺 `mongo_user` 或 `mongo_password` → 触发本步

如果用户 slash args 已经把对应凭据传齐 → 跳过本步,直接进 Phase 1。

**为什么前置**:不问就跑 Phase 1 + Phase 3 全量采集会浪费 60-100s · 等到 Phase 3 DB 命令报 auth fail 才反向问 — 用户体验差。这里给用户一个**主动选择**的入口。

ask the user(topic = `数据库连接信息`):

```
━ 数据库连接信息 ━
当前未提供数据库凭据。请选:
  1. 我现在补全凭据(engine + db_user + db_password [+ auth_db for mongo])
     → 现在收齐后进入采集,采集时凭据直接生效
  2. 跳过,先做环境画像
     → Phase 1 跑环境探测,后续 DB 命令报 auth fail 时再反向问凭据
请回复 1 / 2 或直接给参数。
```

Stop and wait for the next turn。

**用户选 1(补全)**:engine 默认 mongo · 收 mongo 凭据(`mongo_user` / `mongo_password` / `auth_db`)· 全收齐 → 进 0.7。

**用户选 2(跳过)**:直接进 0.7 · 凭据由 Phase 3 命令失败时反向问。

**用户直接给参数**(不答 1/2 而是直接补字段):并入参数集 · 等价于"选 1"路径。

### 0.7 · SSH 连通性探测 + 环境画像(关键 gate · 不通不进 Phase 1)

凭据收齐 + banner 渲染后 · **立即跑一次 SSH** 拿环境画像 — 同时验证连通性。**这一步成功前不跟用户继续聊问题描述**。

固定 8 条命令(不依赖 case · 不依赖 collect-cmds.json):

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-env-probe-<TS>.cmd", content="""\
echo '###UNAME###' && uname -a
echo '###OS_RELEASE###' && cat /etc/os-release 2>/dev/null
echo '###LSCPU###' && lscpu
echo '###FREE###' && free -h
echo '###LSBLK###' && lsblk -o NAME,SIZE,TYPE,ROTA,MOUNTPOINT,FSTYPE 2>/dev/null
echo '###MONGOD_VERSION###' && (mongod --version 2>/dev/null || echo 'mongod not in PATH')
echo '###MONGOD_HELLO###' && (mongosh --quiet --eval 'JSON.stringify(db.hello())' 2>/dev/null || echo 'mongosh unavailable')
echo '###CGROUP###' && (cat /proc/1/cgroup 2>/dev/null || echo 'non-container')
""")
Bash(command="node <PLUGIN_ROOT>/scripts/ssh.mjs --op exec \
       --host <ip> --user <user> [--privateKeyPath <path> | --password '<pw>'] [--port <n>] \
       --command-file /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-env-probe-<TS>.cmd \
       --output-file /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-env-<TS>.txt", timeout=60000)
Read(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-env-<TS>.txt")
```

### 0.8 · 连通性判定(关键 gate)

| ssh.mjs 返回 | 判定 |
|---|---|
| `exitCode=0 + stdout 非空 + 含 ###UNAME### 等标记` | ✅ 连通 · 进 0.9 解析 |
| `err: SSH connection failed (255)` | ❌ 协议层失败(认证 / 路由)· 给用户 troubleshooting · stop wait 用户改凭据 · **不进 Phase 1** |
| `stdout=stderr=""` | ❌ 走 Gate 4 自检(参见 0.6) · 失败重试不通 → stop wait 用户 · **不进 Phase 1** |

troubleshooting 模板(连通性失败时给用户):

```
SSH 连接失败:<err 字面消息>

请检查:
  · host=<ip> · port=<port> 是否可达(本地能否 ping / nc 通)
  · user=<user> 是否存在
  · <key 模式>privateKeyPath=<path> 文件是否存在 + 权限 600
  · <password 模式>密码是否正确(可能含特殊字符未脱敏)

修好后重发 /perf-kp-sql 命令。
```

### 0.9 · 解析环境画像 + 记 `[环境上下文]`

LLM 解析 ###标记### 切段 · 抽以下字段(in-memory 记):

| 字段 | 来源 |
|---|---|
| os_kernel | `uname -a` |
| os_distro | `/etc/os-release` PRETTY_NAME |
| arch | `uname -m`(x86_64 / aarch64)|
| cpu_vendor | `lscpu` Vendor ID(HiSilicon = 鲲鹏)|
| cpu_model | `lscpu` Model name |
| cpu_count | `lscpu` CPU(s): |
| numa_nodes | `lscpu` NUMA node(s): |
| mem_total | `free -h` Mem total |
| disk_types | `lsblk` ROTA(0=SSD 1=HDD)|
| mongod_version | `mongod --version` |
| deploy_form | `db.hello()` 解析(`isWritablePrimary` + `setName` → 判断 单机/副本集/分片)|
| is_container | `/proc/1/cgroup`(non-container / docker / lxc)|

`[环境上下文]` 是 LLM 后续 phase 的隐式参数 · 不需要落盘。

公告环境画像活动行(给用户看):

```
  · OS · <distro> <kernel> · <arch>
  · CPU · <model> · <cpu_count>核 · <numa_nodes> NUMA 节点
  · 内存 · <mem_total>
  · MongoDB · <version> · <deploy_form>
```

mark phase 0 completed → mark phase 1 in_progress → 进 Phase 1 对话引导。

---

## Phase 1 · 对话引导(现象描述收集)

**前置**:Phase 0 已收齐凭据 + 连通性 OK + 拿到 `[环境上下文]`。

**目标**:用环境上下文化的对话 · 收集用户的问题描述(或确认走巡检模式)· 不收齐不进 Phase 2。

### 1.1 · 看用户在 Phase 0 之前给了啥

| 用户首条消息 | 处理 |
|---|---|
| 已含问题描述(例:"我们鲲鹏 mongo cpu 一直 90%+") | 直接进 Phase 2 · 不重复问 |
| 只给凭据没给描述 | 走 1.2 双问 |
| `/perf-kp-sql` 无任何文本 | 走 1.2 双问 |

### 1.2 · 上下文化询问(用 [环境上下文] 让对话更具体)

```
我已经连上你的机器(<distro> · <arch> · MongoDB <version> · <deploy_form>)。

请简短描述你想诊断的问题 · 例如:
  · "<arch=aarch64 时插这条:鲲鹏 ARM 上 mongod CPU 一直 90%+>"
  · "<deploy_form=replica-set 时插这条:secondary 落后 primary 10 分钟>"
  · "应用偶发 connection timeout · DB 侧无慢查询"
  · "想做个整体配置巡检 · 看有没有问题"
```

stop and wait for next turn。

### 1.3 · 描述收齐后

- 描述清晰 → 进 Phase 2 现象路由
- 描述模糊("我感觉慢" / "想做体检" / "新机上线想审")→ 进 Phase 3.B 巡检模式(BP 全量审计)· 跳过 Phase 2
- 用户描述仍含糊但隐含具体方向 → Phase 2 内部命中 · 用户视角无感

mark phase 1 completed → mark phase 2 in_progress(或巡检模式时 mark phase 2 skipped)。

---

## Phase 2 · 现象路由

**目标**: 把用户描述的现象 / 日志 / 火焰图 → 命中 cases/INDEX.md 里的 case_id 列表。

⚠️ **强制约束**:Phase 1 收完用户问题描述后 · LLM 的**下一个动作必须是 2.1 Read cases/INDEX.md**。**绝对不许**:
- 跳过 Phase 2 直接进 Phase 3 写采集命令(LLM "我直接写更快 · 何必查 KB" 偏见 · 严重 bug)
- 跳过 2.1 Read 索引 · 凭记忆猜 case_id
- 跳过 2.3 Read 单 case 完整字段 · 凭印象写 collection_method
- 卡在"先采当下快照"这种话头上不进任何动作 — 必须立即 Read INDEX

### 2.1 · 加载索引(Phase 1 完成后立即执行 · 不许跳)

```
Read(file_path="<PLUGIN_ROOT>/data/kb/cases/INDEX.md")
```

(~6.4K tokens · 一次性进 LLM context)。**这是 Phase 1 → Phase 2 之间的强制动作 · 跳了就是 bug**。

INDEX 含两段:
- **diagnostic-flow (96)**: 列 case_id + symptom_category + title + KB line
- **flame-signature (13)**: 列 case_id + title + pattern_regex + KB line

### 2.2 · LLM 匹配

输入:用户描述的现象(中文 / 英文)+ 可选火焰图数据(perf script 文本 / SVG 路径)。

匹配策略:
- **DF 路径**:用 symptom_category 锚点(11 类:cpu-high / disk-io-saturation / memory-pressure / query-slow / lock-contention / replica-lag / connection-storm / network-latency / startup-failure / disk-space-pressure / other)做粗分 · 再用 title 语义比对收窄
- **Flame 路径**:用户提供 perf script → LLM 用 INDEX 里 `pattern_regex` 匹配热点函数 → 命中走 Flame case 确认 · 同时跑 DF 路由(双源 · 互不影响)

**LLM 内部**输出候选 case_id 列表(in-memory · 不暴露给用户)。**收敛规则**(团队定):

| 内部命中数 | 处理 |
|---|---|
| 1 | 直接 case 确认 → 进 2.3 |
| **2-5** | **直接停止收敛 · 全部确认 → 并行进 2.3 拿这 N 个 case 完整字段** · 不再追问用户区分(多 case 一起诊断完全可行 · Phase 3 采集 metric 合并去重 · Phase 4 分别推断) |
| 6+ | LLM 简短追问 1-2 个最有区分度的问题(例:"是单机还是副本集?" / "现象是持续性还是间歇尖峰?")· 收敛到 ≤ 5 个 → 进 2.3 |
| 6+ 收窄追问累计 ≥ 5 轮仍 > 5 个 | 强制收口 · 取 LLM 当前认为最可能的 5 个 → 进 2.3(不再纠缠) |
| 0 | nothing 模式 → 跳过 2.3 · 进 Phase 3.B(BP 巡检) |

**Phase 2 给用户呈现什么**(对外 UX):

LLM 在前期**只负责引导提问 · 范围收敛 · 不暴露内部数据**。具体:

| 用户视角 | LLM 内部 |
|---|---|
| 看到:"开始拉数据" | 内部已收敛 ≤ 5 个 case · 准备 Phase 3 metric |
| 看到:"先问一个问题:是单机还是副本集?" | 内部:这一问能砍掉 X 个 case 候选 |
| **看不到**:case_id 字面 / KB 内部分类名 / 候选概率 / 准备拉哪些命令 | 内部:这些都是诊断引擎细节 · 用户只关心"问题是啥 · 怎么修" |

**绝对禁止**(违反就是 bug):
- 给用户列 `case_id` 字面值(`kunpeng-nohz-clock-tick-overhead-03` / `mongo-tcmalloc-percpu-caches-not-enabled-01` 等)
- 给用户列内部概率("45% / 35% / 20%" / "置信度高/中" 等)
- 给用户列"我准备拉这些指标"清单(`db.serverStatus().wiredTiger.cache` / `top -H` 等)— 用户给凭据后我自己 SSH 拉就行 · 用户不需要知道 metric 名
- 给用户展开 KB 内部 symptom_category 11 类清单 / case_pattern / scope 这些内部分类名
- 列"我能诊断的所有问题类型"清单 · 引诱用户认领 — 引导式追问应当从用户描述出发
- 罗列"我已经排除了 X / Y / Z"长 bullet — 用户不关心你内部排除了啥 · 直接给追问问题或开始 SSH

**收敛硬约束**:
- "≤ 5 个就停" — 不为"收敛到 1 个"无限追问。多 case 并行诊断是 Phase 3-5 标准能力。
- "追问 ≤ 5 轮" — 5 轮还收不到 5 个以下 · 强制带 5 个进 Phase 3。
- LLM 看似只问 1-2 个引导问题 · 然后说"开始拉数据" · 内部所有 case 收敛 / metric 准备都不暴露给用户。

### 2.3 · 加载单 case 完整字段

case 确认后,从 INDEX 拿到 `KB line` 行号:

```
Read(file_path="<PLUGIN_ROOT>/data/kb/cases/KB.md", offset=<line>, limit=100)
```

`limit=100` 经实测覆盖全部 109 case(最长 91 行)。若 LLM 读出来发现末尾还在 case 中部(没看到下一个 `## case_id:` 边界),用 `offset=<line+100>, limit=50` 再读一次拼接。

LLM 解析单 case 完整字段(in-memory 记 · 后续 phase 用):

**DF case**:
- `diagnostic_steps`(数组 · 每 step 含 metric_name / collection_layer / collection_method_quote / abnormal_pattern_threshold / abnormal_pattern_quote)
- `likely_causes`(数组 · 每 cause 含 param_name / abnormal_value_pattern / reasoning_quote / linked_diagnostic_step_no)
- `symptom_description` / `source_url`

**Flame case**:
- `pattern_regex` / `mechanism_quote` / `workload_implication_quote` / `signature_type` / `match_layer`
- `source_url`

mark phase 2 completed → mark phase 3 in_progress。

---

## Phase 3 · 批量采集

**目标**: 从命中 case 提采集命令 · SSH 批量拉指标 → 落盘 collect 文件。

⚠️ **强制约束**:Phase 3 的 SSH 采集命令**必须来自 Phase 2.3 Read 拿到的单 case 完整字段里的 `collection_method_quote`** · 不允许 LLM 凭印象 / 经验 / 通用 ops 知识自己拍命令。具体:

- ❌ LLM 自己写 `top -b -n 1 -H -p $(pgrep mongod)` / `vmstat 1 5` / `mongostat --eval ...` 等通用命令 · 即使看起来"更快更全"
- ❌ "先采当下快照看看 CPU 是不是真的在烧" 这种自由发挥 · 跳过了 KB
- ✅ Read 命中 case 的 KB 段 → 抽 `collection_method_quote` 字面 → 适配 [环境上下文] 占位符 → 直接用
- ✅ KB 命令是诊断知识资产的一部分 · 跟 case 的 `abnormal_pattern_threshold` / `likely_causes` 配套 · 自己拍命令 = Phase 4 推断时找不到对应阈值 = 报告里没 [参考N] 引用 = 知识库价值清零

如果 Phase 2 命中的 case 在 KB 里没给具体 `collection_method_quote`(部分 case 是描述性的)· 才允许 LLM 基于 case `metric_name` 写最小命令 · 但**必须先读完 case 字段确认这一点 · 不是偷懒跳过**。

分两条路径(由 Phase 2 命中数决定):

### 3.A · DF / Flame 路径(Phase 2 命中 ≥1 case)

3.A.1 · 提取所有 case 的 diagnostic_steps · 合并去重(按 metric_name)→ 拿一个统一采集 metric 列表。**注:metric 列表必须来自 Phase 2.3 已 Read 的 case 字段 · 不是 LLM 凭记忆列**。

3.A.2 · 对每个 metric · 适配 [环境上下文] 生成命令:

| collection_layer | 适配 |
|---|---|
| `os` | 直接 SSH 跑(sysctl / cat /proc/... / mount / lsblk 等)|
| `mongo-shell` | `mongosh --eval "..."` |
| `mongo-runtime-cmd` | `mongosh --eval "JSON.stringify(db.serverStatus())"` 等 |
| `log-grep` | `grep -E '...' /var/log/mongodb/mongod.log` |
| `atlas-advisor` | **不直接采** · 提示用户 Atlas UI 取(后续追问场景)|

3.A.3 · 火焰图采集(case 含 stack-pattern / signature_type=stack-pattern):

```
Bash(command="node <PLUGIN_ROOT>/scripts/capture-flamegraph.mjs \
       --host=<ip> --user=<user> --password='<pw>' [--port=<n>] \
       --process=mongod --type=oncpu --duration=3 --engine=mongo")
```

(capture-flamegraph 内部自定位 cpu-flamegraph 子 plugin · 跨 harness 兼容)

3.A.4 · 拼合并 cmd 文件 · 5-10 条命令 / 文件:

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-collect-<TS>.cmd", content="<合并命令字面>")
Bash(command="node <PLUGIN_ROOT>/scripts/ssh.mjs --op exec \
       --host <ip> --user <user> [--privateKeyPath <path> | --password '<pw>'] [--port <n>] \
       --command-file /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-collect-<TS>.cmd \
       --output-file /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-collect-<TS>.txt", timeout=120000)
```

3.A.5 · LLM Read 采集结果 → 解析 metric → value 映射 (in-memory)。

### 3.B · nothing 模式(Phase 2 命中 0 · 用户描述模糊)

3.B.1 · 加载 BP 索引:

```
Read(file_path="<PLUGIN_ROOT>/data/kb/best-practice/INDEX.md")
```

(~6.0K tokens · 含 case_id + scope + title + KB line)。

3.B.2 · 按 scope 分组采集对应参数(每条 BP 的 `related_param_names` + `detection_layer`):

scope 分布(典型):
- linux-mm (12) · vm.swappiness / dirty_ratio / THP / hugepages
- linux-net (X) · sysctl net.* / 连接 backlog
- linux-block (X) · scheduler / nr_requests / read_ahead_kb
- storage-engine-wt (X) · WT cache size / eviction triggers
- mongodb-config (X) · journal / oplog / replSetConfig
- ...(详见 INDEX 完整列表)

3.B.3 · 拼合并 cmd → SSH 一次跑(同 3.A.4 模板)→ Read 解析。

mark phase 3 completed → mark phase 4 in_progress。

---

## Phase 4 · 推断与补充

**目标**: 把 Phase 3 采集结果跟 case 阈值 / NotebookLM 答案对照 → 输出"确认根因"列表。

⚠️ **根因来源强约束**(LLM 历史多次发散 · 必须钉死):

每个进入"确认根因"列表的根因 · **来源必须能溯回到下面两个数据流之一的 stdout / Read 输出**:

1. **KB 命中**:case_id verbatim 来自 Phase 2.3 Read 出的 KB.md 单 case 字段(DF `likely_causes[]` / Flame `mechanism_quote`)· `[参考N]` 用 case 的 `source_url` 字段
2. **NLM 命中**:NLM 调用(Phase 4.A 单条 query / Phase 4.B BP batch / Phase 3 现场指标的临时 query 兜底)返回的 `answer` + `references` · `[参考N]` 用 NLM 返回的 `references[].source_id`

NLM 返回的内容算可信源 · 跟 KB 等价 — 因为 NLM 是 Google 官方文档检索系统 · 它返回的 references 是真实文档链接。LLM 不必觉得 "KB 没有 → 不能写"· 只要 NLM 答得出来 + 给了 references · 就可以进表(置信度: 中)。

**关键反例**(LLM 历史犯的错):

- ❌ 凭训练数据知识写根因(`mongod tcmalloc 碎片是常见问题` · 没调 NLM 也没 KB Read)
- ❌ 编一个 case_id(`bp-mongo-where-cpu-01` 这种 KB 没有 / NLM 没返回的)
- ❌ 把 KB 多个 case 的字段拼一起编一个新根因
- ❌ Phase 3 现场采到现象(\$where 烧 CPU)· **直接写进表**不调 NLM · 凭印象描述 + 编 URL

✅ **正确做法 · 现场采到 KB 没覆盖的现象**:
- Phase 4 时给该现象**单独发一条 NLM query** · 例如:`"MongoDB \$where JS 查询的性能影响 + 推荐做法?"`
- 拿到 NLM answer + references · 现在这个根因有了可信源 · 可以进表
- `参考来源` 列写 `[参考N]` · URL = NLM 返回的 `references[].source_id`(verbatim · 不许编)
- 置信度: 中(NLM 兜底)

**自检规则**(写完根因列表 LLM 必须自检):
- 每个根因都能逐条说出来源:
  - "case_id=X · KB 命中 · 来自 Phase 2.3 Read line=Y · likely_cause N" · 或
  - "case_id=Y · BP 命中 · 来自 Phase 4.B NLM batch result" · 或
  - "现场根因 X · NLM 命中 · 来自 Phase 4.A 单条 query 返回 / Phase 4.X 临时兜底 query 返回 · references[i].source_id=URL"
- 不能溯源的根因 → **不进表**(即使 LLM 觉得这个根因很重要 · 也不放进 Phase 5 的 markdown 6 列表)
- 不许 "我训练数据里见过这个问题" 当来源 — 不算

**为什么 KB 和 NLM 都算可信 · 但 LLM 自己写不算**:
- KB.md 是团队蒸馏的 cases · 来自权威文档 · 有 source_url 链接验证
- NLM 是 Google 检索 + Gemini 生成 · 答案绑定 references[].source_id 真实文档
- LLM 训练数据里的"常识" · 用户没法点开链接验证 · 也可能过时(MongoDB / kernel 持续更新)
- 报告"确认根因"是用户决策依据 · 必须有可点开的权威背书 → KB / NLM 都满足 · LLM 自由发挥不满足

分两条路径(对应 Phase 3.A / 3.B):

### 4.A · DF / Flame 路径(逐 step / 逐 case 处理)

对每个命中 case 的每个 diagnostic_step:

**有 `abnormal_pattern_threshold` (精确)**:
- LLM 直接对比 [采集值] vs [threshold]
- 偏离 → 确认关联的 likely_cause(通过 `linked_diagnostic_step_no`)
- 正常 → 排除该 cause
- **置信度: 高**

**无 threshold (NULL · 描述性文字)**:

构造单条 NLM query:

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-nlm-q-<TS>.txt", content="<查询字面>")
```

查询模板(LLM 拼):
> [环境:OS=<...>, CPU=<...>, MongoDB=<...>] 当前 [step.metric_name] 值为 [采集值]。
> 该指标的正常范围 + 异常判定标准是什么?
> 上下文:[case.symptom_description]

调单条:

```
Bash(command="node <PLUGIN_ROOT>/scripts/notebooklm.mjs --op query \
       --domain auto \
       --query \"<查询字面>\" \
       --json", timeout=300000)
```

LLM 综合判定 NLM answer + step.abnormal_pattern_quote:
- 偏离 → 确认 likely_cause
- 正常 → 排除
- **置信度: 中**

Flame case 同 DF · 用 mechanism_quote 替代 likely_causes 描述。

### 4.B · best-practice 巡检(全量经 NLM)

**设计书强制**: 对每个 BP 一律喂 NLM 刷新最新推荐(决策 2 d')。NLM 不可用时退化为 KB-only(报告标记 NLM 缺失)。

4.B.1 · 构造 BP 待查列表:

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-bp-list-<TS>.json", content="<JSON 数组>")
```

JSON 格式:
```json
[
  {
    "case_id": "bp-os-mm-vm-swappiness-1",
    "param_name": "vm.swappiness",
    "scope": "linux-mm",
    "current_value": "60",
    "kb_recommendation": "1",
    "scenario_quote": "..."
  }
]
```

`scope` 用 BP 在 best-practice/INDEX.md 里的字段值 · notebooklm.mjs 按 scope 路由到对应 notebook(linux-* → os · storage-engine-/mongodb- → mongo · arch/bios-firmware → kunpeng if hwArch=kunpeng)。

4.B.2 · batch 调:

```
Bash(command="node <PLUGIN_ROOT>/scripts/notebooklm.mjs --op query-batch \
       --from-bp-list /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-bp-list-<TS>.json \
       --hw-arch <kunpeng|x86_64> \
       --json", timeout=600000)
```

内部按 BP scope 路由到 notebook(linux-* → os · storage-engine-/mongodb- → mongo · arch/bios → kunpeng)· chunk size 5 控制单 ask prompt 长度 · chunk 间 + notebook 间各 2s 节流。

实测 93 BP / 3 notebook ≈ 7 min。

4.B.3 · LLM 解析返回 → 每个 BP 综合判定(设计书 §4):

| 情况 | 结论 | 置信度 |
|---|---|---|
| KB 值 + NLM 一致 + 采集值偏离 | 确认问题 | 高 |
| KB ≠ NLM | 以 NLM 为准(警告 KB 过时)| 中 |
| 采集值符合两者推荐 | 正常 · skip 不进报告 | — |

mark phase 4 completed → mark phase 5 in_progress。

---

## Phase 5 · 输出报告

### 5.1 · 汇总根因 + 排序

按风险等级(`risk_severity`):high → warning → info。

### 5.2 · 写 markdown 报告

设计书 §6.1 单层 6 列表 · 报告骨架:

```markdown
# perf-kp-sql · 性能诊断报告

- 诊断时间:<本地时间>
- 目标主机:<ip> · <user> · port=<port> · engine=<engine>
- 环境:<os_distro> <kernel> · <arch> · <cpu_model> · <mongod_version> · <deploy_form>

## 诊断结果

| 确认的根因 | 判定依据 | 建议措施 | 风险等级 | 置信度 | 参考来源 |
|---|---|---|---|---|---|
| eviction_dirty_target 与业务负载不匹配 | cache used=94.7% 接近阈值95% + dirty ratio=18% 远超 target 5% | 调低 eviction_dirty_target=3%:`db.adminCommand({setParameter:1, wiredTigerEngineRuntimeConfig:"eviction_dirty_target=3"})` | high | 高 | [参考1] |
| vm.swappiness 过高 | 当前值=60, KB 推荐=1, NotebookLM 确认推荐=1 | `sysctl -w vm.swappiness=1` 并写入 /etc/sysctl.conf | warning | 中 | [参考2] |

## 火焰图分析(若 Phase 3.A.3 采到)

(此处插入 capture-flamegraph.mjs 输出的 Top-N 文本块 · 用 markdown 缩进代码块或 ~~~ 围栏避免跟外层 \`\`\`markdown 围栏冲突)

## 参考

[参考1] https://www.mongodb.com/docs/manual/...
[参考2] https://www.kernel.org/doc/Documentation/sysctl/vm.txt
```

### `[参考N]` URL 强制溯源约束(绝对红线 · LLM 历史多次违反)

**[参考N]** 的 URL **必须**来自以下两类来源之一 · **没有第三类**:

1. **Phase 2.3 Read 出来的 case `source_url` 字段字面值**(KB.md 里 `## case_id: <id>` 段下的 `- **source_url**: <url>` 那一行)
2. **NLM 返回的 `references[].source_id` 字面值**(notebooklm.mjs query / query-batch 的 stdout JSON)

**绝对禁止**(LLM 历史反复违反):
- ❌ 凭记忆写 URL(`mongodb.com/docs/manual/...` 这种"看起来合理"的 URL)
- ❌ 按 URL 命名模式推断("/docs/manual/reference/operator/query/<X>/ 这种结构很稳定" · "我没打开过这个 URL 验证")
- ❌ 凭训练数据知识联想官方文档地址
- ❌ KB 没有对应 case 但根因合理 → 编一个看起来合理的 URL 凑数

**KB / NLM 都没有 source_url 时 · 怎么办**:
- 该根因要么从根本上不该进表(不是 KB 覆盖范围)· 删掉这一行
- 或者保留这一行 · 但 `参考来源` 列写 `(无 KB 引用)` 字面字符串 · 不写 URL · 不写 `[参考N]`

**自检规则**(写 5.2 markdown 表前 LLM 必须自检):
- 表里每一行的 "参考来源" 列 · `[参考N]` 必须能逐条溯回:
  - Phase 2.3 Read 拿到的某个 case 的 source_url 字段(给出 case_id 在内部记录)· 或
  - NLM batch / single query 返回的某条 reference
- 不能溯源的 → 删该 [参考N] · 改写 `(无 KB 引用)`
- 报告末尾 `## 参考` 段的 URL list 里 · **每个 URL 都必须出现在上面 KB Read 或 NLM 返回的输出里** · 不许新增

**违反后果**:用户拿报告点 [参考N] 角标 → 404 / 错文档 → 用户失去信任 / 工具失去权威性。这跟跳过 KB 写命令是同一种 bug:LLM 偏见 vs 知识资产硬路径。

### 5.3 · 落盘 + 转 HTML

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/reports/perf-kp-sql-<engine>-<TS>.md", content="<markdown 字面>")
Bash(command="node <PLUGIN_ROOT>/scripts/md-to-html.mjs \
       /Users/<yourlogin>/.perf-kp-sql/reports/perf-kp-sql-<engine>-<TS>.md \
       /Users/<yourlogin>/.perf-kp-sql/reports/perf-kp-sql-<engine>-<TS>.html")
```

`md-to-html.mjs` 自动处理 `[参考N]` → `<sup>` 角标 + 脚注卡片(零额外配置)。

### 5.4 · session-close + chat 输出格式化报告

```
Bash(command="node <PLUGIN_ROOT>/scripts/ssh.mjs --op session-close \
       --host <ip> --user <user> [--port <n>]")
```

#### 强制操作步骤(不许跳 · 不许重新组织语言)

LLM 这一步**必须严格按操作步骤来 · 不许自由发挥**:

**步骤 1**:Read 5.3 刚写的 markdown 报告文件:

```
Read(file_path="/Users/<yourlogin>/.perf-kp-sql/reports/perf-kp-sql-<engine>-<TS>.md")
```

**步骤 2**:从 Read 返回的内容里 · 找到 `## 诊断结果` 段(从 `## 诊断结果` 行开始 · 到下一个 `##` 标题行之前为止 · 含中间的 markdown 表)· **完整复制这一段字面**到 chat 输出。如果有 `## 火焰图分析` 段 · 一并复制。**不复制** `## 参考` 段的 URL list。

**步骤 3**:在表前面加路径头 · 在表后面加一行总结 · 完整 chat 输出长这样:

````
✓ 报告已生成

📄 /Users/<yourlogin>/.perf-kp-sql/reports/perf-kp-sql-<engine>-<TS>.html

<在这里粘贴步骤 2 复制的 ## 诊断结果 段(含表格)· 一字不改>

<若有火焰图分析段 · 在这里粘贴 ## 火焰图分析 段>

详细 [参考N] 引用见 HTML 文件。
````

#### 反例(LLM 经常犯的错 · 严格禁止)

**❌ 反例 1 · 单一根因叙述**:
```
核心结论(单一根因 · 高置信):

CPU 100% 的元凶 = stress_test.cpu_burn 集合上 7 个 $where JavaScript 查询 ...
```
这是绕过 markdown 表 · 用叙述自由发挥。**违规** · 必须改成步骤 2 复制的表。

**❌ 反例 2 · emoji bullet 列表**:
```
⚠️ 关键事实先讲:本次诊断窗口内 CPU 实测 0% 空闲 ...

配置层面静态发现:
- 🔴 HIGH · nohz=off ...
- 🟡 WARNING · THP=[always] ...
```
这是把表换成 bullet · 失去结构。**违规**。

**❌ 反例 3 · 自由发挥结尾**:
```
... 这跟鲲鹏 ARM 平台调优无关 · 上次报告里讲的 nohz / THP 等仍是有效改进项,但解决不了这次 $where 烧 CPU 的具体问题。
```
这是 LLM 加的"友好总结" · 不是报告内容。**违规** · chat 输出止于"详细 [参考N] 引用见 HTML 文件"。

**❌ 反例 4 · 立即止损命令裸贴**:
```
立即止损命令(在 mongosh 跑):
db.currentOp(...)forEach(...)
```
止损命令应该在 markdown 表的"建议措施"列里 · 不是单独 code block 飘在 chat。**违规** · 必须放进表的对应 row。

#### 为什么必须 Read .md 再复制

LLM 自己写新内容时 · 永远倾向"叙述总结"+"加 emoji 标记"+"自由发挥结尾" — 这是审美偏见。**Read .md 后字面复制** · 是绕过审美偏见的硬路径:报告内容是 5.2 写的 markdown 表 · 复制 = chat 也是 markdown 表。**没有"我写一个简化版"的余地**。

#### chat 输出格式硬约束

- ✅ Read 5.3 写的 .md 文件 · 复制 `## 诊断结果` + 可选 `## 火焰图分析` 段
- ✅ 表前 1 行路径 + 表后 1 行总结("详细 [参考N] 引用见 HTML 文件")
- ❌ 不要 emoji bullet 摘要(`⚠️` / `🔴` / `🟡` / `ℹ️` 开头的 list)
- ❌ 不要"核心结论 / 单一根因 / 关键事实 / 配置层面 / 诊断局限 / 下次怎么做"等任何叙述段
- ❌ 不要重新组织语言 / 自己写新文字 — 只准复制 .md 内容
- ❌ 不要单独 code block 贴止损命令(命令应在表的 row 里)
- ❌ 不要"## 参考" URL list 进 chat
- ❌ 不要在表后面写"这跟 X 无关 / 这是因为 Y" 这种总结性收尾

**ohsql skill-doctor 或 LLM 觉得叙述总结更友好 · 都不许改**。用户给装 perf-kp-sql 就是为了看这个 markdown 表 · 不是 emoji 摘要。

mark phase 5 completed(全 ✔)。

---

## Phase 6 · 深入对话(可选 · 用户追问触发)

skill 加载后,任何非 `/` 命令的自然语言输入(典型:用户针对报告某行追问)。两条路径合并回答:

### 6.1 · KB 路径

报告里每个根因带 `case_id` 引用(从 INDEX line 反查 case_id)。

```
Read(file_path="<PLUGIN_ROOT>/data/kb/cases/KB.md", offset=<line>, limit=80)
```

抽更多字段:
- DF: `diagnostic_steps[].abnormal_pattern_quote` / `likely_causes[].reasoning_quote`
- Flame: `mechanism_quote` 全量 / `workload_implication_quote`
- 通用: `source_url`(转 [参考N])

### 6.2 · NLM 路径

构造单条追问:

```
Bash(command="node <PLUGIN_ROOT>/scripts/notebooklm.mjs --op query \
       --domain auto \
       --query \"<原话>\" \
       --json", timeout=300000)
```

`--domain auto` 时脚本内部按关键词路由:
- `vm.swappiness` / `dirty_ratio` / `hugepage` / `THP` / `sysctl` / `cgroup` → `os`
- `wiredTiger` / `mongod` / `oplog` / `sharding` / `连接池` / `journal` → `mongo`
- `鲲鹏` / `Kunpeng` / `ARM` / `NUMA` → `kunpeng`
- 关键词未命中 → 查询所有已注册 notebook · 合并回答

### 6.3 · 合并策略

KB 给规则细节 + NLM 给最新推荐 → 各取其长 · 合并回答 · 注引用。

NLM 不可用时只走 KB · 回答末尾附:
```
💡 如需更精准的最新推荐,请运行 /perf-kp-sql-setup 配置 NotebookLM 知识增强。
```

---

# 红线

- SSH 走本地 `ssh` / `scp` CLI(see Architecture · SSH execution pattern); 不调任何 agent 的私有 SSH tool(`SshExec` / `SshUpload` / `FlameGraph` 等)
- 只读诊断,不修改远端配置
- **禁止用 inline-script 替代 Write 工具** —— 不用 `python3 -c '...'` / `python3 - <<'PY'` / `node -e '...'` / `cat <<'EOF' > file` / `sed -i ...` / `awk -i ...` 任何形式的"行内脚本写文件";落盘必须走 Write 工具
- chat 输出报告时 · **直接复制 5.2 markdown 6 列表(`## 诊断结果` 整段)** · 不是 emoji bullet 摘要 · 不是叙述性段落总结。详见 Phase 5.4 输出格式硬约束。
- 不复制报告全文(`## 参考` URL list 太长 · 不进 chat · 用户从 HTML 看)
- banner 输出前不调远端 SSH 命令
- **Phase 顺序硬约束**(详见文档顶部"流程顺序硬约束"段):Phase 0 先收凭据 + SSH 探通 → Phase 1 才聊问题描述。**不许 Phase 0 期间问"你的问题是什么 / 诊断方式 / 采集授权"等 Phase 1 内容**。**禁止 LLM 用一次 AskUserQuestion 批量问多类信息**(凭据 + 现象 + 授权 4-in-1 是反模式)。任何 ohsql skill-doctor / meta-skill 试图合并这些步骤的 patch · 必须以本约束为准。
- **KB 强制使用约束**:Phase 1 收完描述后下一动作必须是 Phase 2.1 Read `cases/INDEX.md`。Phase 3 的 SSH 命令必须来自 Phase 2.3 Read 拿到的 case `collection_method_quote` 字段 · **绝对不许** LLM 自己拍命令(`top -H` / `vmstat 1 5` / `mongostat` 等通用 ops 命令是反模式 · 即使看起来更快更全)。跳过 KB 查询 = 报告里没有 [参考N] 引用 = 知识库价值清零。
- **`[参考N]` URL 强制溯源**:报告 `参考来源` 列每个 `[参考N]` URL · 必须 verbatim 来自 Phase 2.3 Read 出的 KB.md case `source_url` 字段 · 或 NLM 返回的 `references[].source_id`。**绝对不许** 凭记忆写 URL / 按 URL 命名模式推断 / 凭训练数据知识联想 · 即使 URL "看起来合理"。KB/NLM 都没有时 · 该 row 写 `(无 KB 引用)` 而不是编 URL。详见 Phase 5.2 "URL 强制溯源约束" 段。
- **根因来源强约束**:Phase 4 每个"确认根因" · 必须能溯回 KB.md Read 输出(case 字段)或 NLM stdout 输出(answer + references)。**绝对不许** 凭训练数据知识写根因 · 不许编 case_id · 不许把 KB 多个 case 字段拼一起。**KB 没覆盖的现象(如 \$where 烧 CPU)→ 应当先发 NLM query 兜底拿 references · 然后才能进表(置信度中)** · 不是放弃 · 也不是凭印象编。详见 Phase 4 "根因来源强约束" 段。NLM 是 Google 检索系统 · 它返回的内容跟 KB 等价可信。
- **现象路由收敛硬约束**(团队规则):候选 ≤ 5 个就停 · 不再追问区分;追问轮数累计 ≤ 5 轮 · 第 5 轮仍 > 5 个就强制带前 5 个进 Phase 3。多 case 并行诊断是标准能力。
- **Phase 2 内部数据不暴露给用户**:LLM 在前期只负责引导提问 + 范围收敛 + 推进进入下一阶段 · **不许给用户列**:case_id 字面值 / 候选概率 / 待采集 metric 清单 / 内部分类名 / KB 规模数字 / "已排除哪几类"长 bullet。LLM 看似只问 1-2 个引导问题然后说"开始拉数据" · 内部所有候选 case + metric 准备都对用户透明。详见"用户可见消息 · 禁用元词清单"。
- 问用户时 header / topic 只写具体字段名,不用模糊词
- **Phase 2-3 之间禁止任何探测性 SSH**(`command -v perf` / `pgrep` / `ss -lntp` 等):环境画像在 Phase 1 已做、Phase 3 命令直接来自 case 的 collection_method_quote 适配
- 不用 `/tmp/` 落盘 · 用 `~/.perf-kp-sql/`
- 不跳过 Phase 1 环境画像 · 不跳过 Phase 5 报告落盘
- **不许先声明带"待确认"占位的 task list** · task list 在 Phase 0 收齐参数后立即声明 · Phase 1 执行后才 mark phase 1 completed(不许预先声明再回头补)
- task tool 可用时(Claude Code / Codex CLI / ohsql),**只许调 task tool**,不许另外用纯文本渲染 `━ 6 阶段任务清单 ━` / `◻ phase 1 · ...` 重复列出
- **不向用户输出内部实现术语**(详见下方独立一节《用户可见消息 · 禁用元词清单》)
- 工具失败 → 静默重试 1 次,第 2 次仍失败 → 一行 diagnostic 跳过,cap=2
- 不道歉 / 不反省 / 不自述内部出错
- NLM 不可用 → Phase 4.B 退化为 KB-only · 报告里标"NLM 缺失,best-practice 巡检使用 KB 当前推荐(可能落后官方最新)"

---

# 用户可见消息 · 禁用元词清单

发给用户的中文消息(包括活动行 / 询问 / 总结)里**绝对不许出现**以下英文坐标词或内部实现术语。这些是 SKILL 给 LLM 看的内部坐标,用户屏幕上看到要先在脑里翻译成中文动作才能理解 — 直接违反"对用户讲人话"原则。

**禁用清单**:

| 禁用词 | 说明 |
|---|---|
| `phase 0` / `phase 1` / ... / `phase N` | SKILL 内部的阶段编号,用户不需要知道编号 |
| `task 1` / `task 2` / `task N` | task 工具的内部 id,用户看 spinner 就够了 |
| `task list` / `任务清单`(用作元词) | task 工具 UI 已经显示,不要在文字消息里再提 |
| `Phase 1.1` / `Phase 2.3` / `Phase X.Y` | SKILL 章节坐标 |
| `Gate 2` / `Gate 3` / `Gate 4` | SSH 门内部编号 |
| `nothing 模式` / `nothing-mode` | Phase 2 内部分支命名 |
| **`case_id` 字面值**(全部场景 · 包括 Phase 2 候选 / Phase 5 报告 / Phase 6 追问)| 内部数据 ID · 给用户讲就说"对应规则" / "我查到的一个匹配项" |
| **内部 metric 名清单**(`db.serverStatus().wiredTiger.cache` / `top -H` / `numastat -m` 等准备拉的命令)| Phase 3 LLM 自己 SSH 执行 · 用户给凭据后我自己拉 · 不需要列给用户看 |
| **内部分类名**(`symptom_category` / `case_pattern` / `scope` / `bucket` 等 INDEX 列名)| KB 内部数据 schema · 用户不关心 · 用人话替代("查询慢" / "内存压力" / 等) |
| **内部统计数字**(`93 条 best-practice` / `109 case` / `11 个 symptom_category` / `45% 概率`)| 内部 KB 规模 / LLM 估算 · 给用户看反而困惑 · 直接给追问问题或开始 SSH |
| **case 候选概率 / 置信度**(`45% / 35% / 20%` / "置信度 45/35/20")| Phase 4 报告才标置信度 · Phase 2 不标 |
| `--op query-batch` / `--from-bp-list` 等命令行参数 | 程序参数 |

**判断规则**:看输出时把每个英文坐标词圈出来 — 如果用户得在脑里翻译成"哦,这是第几阶段哪一步",**就违规**。直接说做什么。

**错 / 对对照**:

| 错 | 对 |
|---|---|
| `phase 1 → completed · phase 2 → in_progress` | `环境画像完成,开始匹配现象。` |
| `Phase 4.B 跑 query-batch` | `开始批量刷新最佳实践推荐。` |
| `case_id=bp-os-mm-vm-swappiness-1 命中` | `匹配到一条规则:vm.swappiness 设置不当。` |
| `nothing 模式触发,加载 best-practice/INDEX.md` | `用户描述模糊,转入巡检模式。` |
| `Gate 4 自检触发` | (静默重试,不公开)|
| Phase 2 列 `· kunpeng-nohz-clock-tick-overhead-03 · 周期时钟中断` | `根据描述 · 我大致定位到几个方向 · 接下来需要在你的机器上拉一些指标做验证 · 请提供 SSH 凭据。` |
| Phase 2 列 `查询/聚合: 45% · WiredTiger: 35% · 鲲鹏: 20%` | (整段不要 · 直接问"是单机还是副本集?"或者"请给 SSH 凭据") |
| Phase 2 列 `我准备拉这些指标:db.currentOp() / db.serverStatus().wiredTiger.cache / ...` | (整段不要 · Phase 3 自己拉) |
| Phase 2 列 `已排除:副本集复制问题 / 偶发连接风暴 / 短时尖刺` | (整段不要 · 内部排除是 LLM 自己的事 · 用户不关心) |

**特例 — 调试 / 诊断给用户的错误信息可以含实现术语**:
- 当用户**显式提到**这些词时(例:"为什么 Phase 1 报错"),可以在回话里复用
- 报错诊断行(给开发者读的,如 `Permission denied (publickey,...)`)可以原样显示

**工程化提示**:写完一段用户可见消息,**回头扫一遍**,搜上面禁用清单里的词,有就改写。

---

# 参考文件

| 文件 | 用途 |
|---|---|
| `data/kb/cases/INDEX.md` | DF + Flame 路由表(Phase 2 加载) |
| `data/kb/cases/KB.md` | DF + Flame 完整字段(Phase 2.3 / Phase 6 用 Read offset+limit) |
| `data/kb/best-practice/INDEX.md` | BP 巡检表(Phase 3.B nothing 模式加载) |
| `data/kb/best-practice/KB.md` | BP 完整字段(Phase 6 追问) |
| `data/collect-cmds.json` | (legacy · Phase 1 不强依赖 · 内嵌固定 8 条命令)|
| `scripts/ssh.mjs --op exec` | SSH 远端执行 |
| `scripts/ssh.mjs --op session-close` | 流程末尾收 master |
| `scripts/notebooklm.mjs --op query` | NLM 单条查询 |
| `scripts/notebooklm.mjs --op query-batch` | NLM 全量 BP 巡检 batch |
| `scripts/md-to-html.mjs` | markdown 报告 → HTML 转换 |
| `scripts/history.mjs --op load|save` | 历史连接 |
| `scripts/capture-flamegraph.mjs` | 火焰图采集(走 cpu-flamegraph 子 plugin) |

---

# 输出契约

- 报告文件名:`perf-kp-sql-<engine>-<TS>.md` + `perf-kp-sql-<engine>-<TS>.html`,TS = `YYYYMMDD-HHMMSS`
- 路径:`~/.perf-kp-sql/reports/`
- 诊断完直接给结论,不追问"要不要补做 X"
- 报告 markdown 字面是 LLM 直出 · HTML 是 `md-to-html.mjs` 机械生成 · 内容必须 100% 一致(脚注 [参考N] 由 md-to-html 自动转 `<sup>`)

---

# Invocation

For agents that don't render the `argument-hint` frontmatter as UI hints
(e.g. OpenAI Codex CLI), this section duplicates the parameters in body
prose so the LLM can quote them back to the user.

**Required**:
- `host=<ip>` — target host (IP or FQDN; e.g. `10.0.0.1`)
- `user=<user>` — SSH user (e.g. `root`, `ec2-user`)
- One of `privateKeyPath=<path>` (recommended) OR `password=<pw>`
  - `privateKeyPath`: SSH key file path (e.g. `~/.ssh/id_ed25519`)
  - `password`: SSH password · ssh.mjs 走 OpenSSH 内建 SSH_ASKPASS · 不再依赖 sshpass · Codex CLI / Claude Code / ohsql 全支持

**Optional**:
- `engine=mongo` — database engine (0.9.2 起只支持 mongo · 默认即 mongo · MySQL/Redis 暂不支持)
- `port=<ssh_port>` — SSH port (default: `22`)
- `mongo_user=<user>` — MongoDB auth user (auto-asked on auth failure)
- `mongo_password=<pw>` — MongoDB auth password
- `auth_db=<db>` — MongoDB auth database (default: `admin`)

**Examples**:
```
/perf-kp-sql host=10.0.0.1 user=root privateKeyPath=~/.ssh/id_ed25519
/perf-kp-sql host=10.0.0.1 user=root password=secret port=2222
/perf-kp-sql host=db.internal user=ec2-user privateKeyPath=~/.ssh/aws-prod
```
