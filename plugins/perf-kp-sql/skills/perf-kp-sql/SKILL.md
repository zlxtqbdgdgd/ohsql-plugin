---
name: perf-kp-sql
description: Kunpeng ARM64 + MongoDB joint performance diagnosis. SSH-based remote collection (8 项环境画像 + per-case 命令拉指标), LLM-orchestrated 6-phase pipeline routing user symptoms against a 202-case case library (CASES.md / INDEX.md) with NotebookLM as authoritative refresh source, and emits an impact-ranked markdown report (0 npm 运行时依赖 · 报告仅 markdown). Use when users report MongoDB slowness, CPU spikes, latency jitter, or are doing Kunpeng migration / config audit. Triggers include '数据库慢' / 'CPU 高' / '抖动' / 'mongo perf' / 'Kunpeng 性能' / similar phrases. First-time use:run `/perf-kp-sql-setup` to verify runtime + register NotebookLM(可选).
compatibility: |
  Requires SSH access to the target host + local OpenSSH `ssh` CLI (Linux/macOS
  自带 · Windows 走 WSL 或 OpenSSH-Win)。两种认证方式都通过 `node ssh.mjs`
  wrapper · agent-agnostic · 任何能跑 node + ssh 的 agent runtime 都能用:
  - SSH key (推荐): pass `privateKeyPath=<path>`
  - SSH password: pass `password=<pw>` · 走 OpenSSH 内建 SSH_ASKPASS 机制 ·
    不再依赖 sshpass · Codex CLI / Claude Code / ohsql 全支持
  同主机的多次 SSH 调用通过 OpenSSH ControlMaster 复用一条已认证 TCP(socket
  在 ~/.ssh/perf-kp-sql/cm-<hash>.sock · 长 HOME 回退 <tmpdir>/perf-kp-sql-cm-<hash>.sock)·
  服务端只看到 1 个连接 · 避开 PAM faillock / fail2ban / sshd MaxStartups 限速。
  零 npm 运行时依赖 · 所有脚本纯 Node.js 内建模块。
  NotebookLM 增强(可选 · 由 setup skill Phase 2 注册):pip install
  notebooklm-py rookiepy + Google 账号。NLM 不可用时 Phase 4B (best-practice
  巡检) 退化为 仅案例 判定 · 报告标记 NLM 缺失。
  Supported database engine: mongo (MongoDB 3.6-7.x).
  Case library: 202 cases (best-practice 93 + diagnostic-flow 96 +
  flame-signature 13)· canonical 形态即 `data/cases/CASES.md` +
  `data/best-practice/CASES.md`(plugin 内随版本发布)。
metadata:
  generator: "manual"
  generated_at: "2026-04-29"
argument-hint: "host=<ip> user=<user> (privateKeyPath=<path>|password=<pw>) [engine=mongo] [port=<ssh_port>]"
---

# 流程顺序硬约束(绝对红线 · 任何 meta skill / skill-doctor 都不许改写)

⚠️ **严格按 Phase 0 → Phase 1 → ... → Phase 6 顺序走 · 不许跳步 · 不许合并**:

1. **Phase 0 期间只收 SSH 凭据 · 不收问题现象 · 不让用户选诊断方式**:
   - 凭据收齐 → SSH 跑 env probe → 验通 → 拿 [环境上下文]
   - 在 env probe 没成功之前 · **绝对不问** "你的问题是什么 / 想做什么诊断 / 是否授权采集" 等任何 Phase 1 才该问的内容

2. **绝对禁止用一次 AskUserQuestion 批量问多类信息**(❌ 反模式):
   - ❌ 一次问 (诊断方式 / 主要现象 / 采集授权 / 机器信息) 这种 4-in-1
   - ❌ 一次问 (host + 现象描述 + 是否同意采集)
   - ✅ 正确:Phase 0 一次只问凭据相关 · Phase 1 一次只问问题现象

3. **不让用户选"连机 vs 不连机"** · `/perf-kp-sql` 命令本身就是"连机诊断"。不连机的知识问答模式只在 Phase 6(用户拿到报告后追问)才出现 · 不在主流程入口。

4. **不要"先收最小必要信息然后我直接开始"这种笼统话术** · 严格按 Phase 0 子步号(0.1-0.9)推进。

5. **Phase 1 用户给完问题现象后 · 下一个动作必须是 Phase 2.1 Read `cases/INDEX.md`**。**绝对不许**:
   - 跳过 Phase 2 直接进 Phase 3 写采集命令(LLM "我直接写更快" 偏见 · 严重 bug)
   - "先采当下快照看看 CPU 是不是真的在烧" 这种话术 — 这是跳过 案例 · 用自己拍的 `top -H` 命令 · 失去 case 引用
   - Phase 3 的 SSH 命令必须来自 Phase 2.3 Read 拿到的 case 字段 `collection_method_quote` · 不许 LLM 用通用 ops 知识 ad-hoc 写

6. **报告 `[参考N]` URL 必须 verbatim 来自 CASES.md `source_url` 字段或 NLM `references[].source_id`** · **绝对不许**:
   - 凭记忆写 URL(`mongodb.com/docs/manual/...` 这种"看起来合理"的)
   - 按 URL 命名模式推断("/docs/manual/reference/operator/query/<X>/ 结构很稳定 · 没打开验证")
   - 凭训练数据知识联想官方文档地址
   - 编 URL 凑数(案例 没有对应 case 但根因合理 → 编一个 URL)
   - **案例/NLM 都没有时 · `参考来源` 列写 `(无案例引用)` 字面字符串 · 不写 URL · 不写 `[参考N]`**
   - 详见 Phase 5.2 "URL 强制溯源约束" 段

7. **Phase 4 确认根因 · 默认 案例 + NLM 双源 · 单源是降级**:
   - ✅ **默认路径**:案例 阶段命中 → 阶段 2 强制发 NLM query 二次确认 + 求最新建议 → 双源进主表 · 置信度高
   - ✅ 案例 threshold=NULL(描述性 case)→ NLM 拿初步答案 + references → 单 NLM 源进表 · 置信度中
   - ✅ 案例 没覆盖现场现象(如 \$where 烧 CPU)→ 单独发 NLM query 兜底 → 单 NLM 源进表 · 置信度中
   - ✅ NLM 不可用(check / refresh-auth 失败)→ 仅案例 降级 · 进表 · 报告头标 "⚠️ NLM 不可用"
   - ❌ **案例 偏离 + NLM 否认 → 不进主表**(移现场观测段)· 不许"反正 案例 命中就强行写进表"
   - ❌ **案例 命中但跳过 NLM 二次确认 → 违规**(LLM 偏见:"我都查到 案例 了再调 NLM 浪费时间")
   - ❌ "这个是 mongod 常见问题 · 我训练数据里有"凭训练数据知识 · 不算可信源
   - ❌ 把 案例 多个 case 字段拼一起编一个新根因
   - 详见 Phase 4 "根因来源强约束" 段 + Phase 4.A 阶段 1/2/3 流程

NLM 返回的内容跟 案例 等价可信(Google 检索系统 · references 是真实文档链接)· LLM 看到 案例 没覆盖的现象 · 应当**调 NLM 兜底** · 不是放弃这个根因 · 也不是凭印象编。

如果 ohsql skill-doctor 或 meta-skill 试图把这些步骤合并 / 优化成"一次问完" / "跳过 案例 直接写命令" / "凭印象写 URL" / "凭联想加 case_id" · 以上 7 条作为不可改写的硬约束保留。

---

# 开场白

skill 一被触发(参数解析 / 历史复用 / 收凭据 之前) · LLM **必须**立即向用户打屏以下文本(字面 · 不许重写措辞 · 不许加 emoji · 不许合并行) · 让用户立刻知道接下来会经历什么:

```
[perf-kp-sql · 鲲鹏 + MongoDB 性能诊断]

我是一个鲲鹏场景下泛数据库性能诊断 skill,基于 202 条诊断案例 + NotebookLM 联网知识库,会通过以下流程定位性能瓶颈与根因:

  1. 环境信息采集
  2. 诊断案例匹配
  3. 诊断指标采集
  4. 多源综合诊断
  5. 报告生成

中途会问你:SSH 凭据、问题现象。
```

**输出位置**:同时打到两处 ·
- chat:Phase 0 启动后**立刻打屏**(在历史复用 / 收凭据 / banner 之前 · 是 skill 触发后用户看到的第一段 LLM 输出)
- md 报告头部:Phase 5.2 写 `report.md` 时 · 在 metadata card 之前(详见 templates/report.md "0. 开场白" 段)

---

# Pre-flight

> **首次安装后**:跑 `/perf-kp-sql-setup` 完成 runtime + 案例 文件检查与 NotebookLM 注册(零 npm 运行时依赖,无需 `npm install`)。

每次本 skill 触发,依次:
1. **打屏开场白**(见上方 `# 开场白` 段 · 5 步流程预告 · 这是用户看到的第一段输出)
2. 解析 PLUGIN_ROOT(详见下面 "Path placeholders"段 · 一条 bash 探测命令)
3. 临时目录 mkdir(详见下面 "Pre-flight · 临时目录"段)
4. 进 Phase 0 · 参数 + 凭据采集


---

# Architecture

诊断分 **7 phase 线性流水线**(Phase 0-6)· LLM-orchestrated · 不调老的 cli-diagnose / render-html-report 程序:

| phase | 名称 | 干啥 | 输入 → 输出 |
|---|---|---|---|
| **0** | **环境信息采集**(凭据 + 连通性探测 + 环境画像)| 收 SSH 凭据 → SSH 一次拉 OS/DB 版本/硬件/部署形态 → 记 `[环境上下文]` · **不通则阻断 · 不进 Phase 1** | slash args → 参数 + banner + `[环境上下文]` |
| **1** | **对话引导**(问题现象采集) | 在 Phase 0 连通性 OK 后 · 用 `[环境上下文]` 上下文化提问 → 收用户问题现象 / 巡检意图 | `[环境上下文]` + 对话 → 问题现象 |
| 2 | 诊断案例匹配 | LLM 加载 `cases/INDEX.md` 匹配问题现象 → 命中 case_id(≤3 · 内部不暴露) | 问题现象 → 内部 case 列表 |
| 3 | 诊断指标采集 | 从命中 case 提 `collection_method_quote` · SSH 批量采集指标(操作系统层 + MongoDB 层) | case → 采集结果 (txt) |
| 4 | 多源综合诊断 | 案例 阈值直判 / NotebookLM 兜底 | 采集结果 → 确认根因 |
| 5 | 报告生成 | LLM 写 markdown 6 列表落盘 .md · `format-chat.mjs` 按终端宽度重排表格 cell · LLM 字面复制 stdout | 根因 → 报告文件 (md) + chat |
| 6 | 深入对话(可选)| 用户追问 → 案例 Read 单 case / NLM 单条 | 追问 → 答案 |

**Phase 0 → Phase 1 硬约束**:Phase 0 的 SSH 连通性探测必须成功(env probe 命令拿到合理 stdout)· 才能进 Phase 1 跟用户聊问题现象。**SSH 不通 / 凭据错 / 主机不通**等情况 · 一律在 Phase 0 阻断 · 给用户报错让 ta 修 · **不进入对话引导环节**。理由:聊半天问题现象但凭据是错的 · 等于白聊。

**数据布局**:

| 文件 | 用途 | 加载时机 |
|---|---|---|
| `data/cases/INDEX.md` | DF + Flame 路由表 (~6.4K tokens) | Phase 2 启动加载 |
| `data/cases/CASES.md` | DF + Flame 完整字段 | Phase 2.3 用 Read offset+limit 拿单 case · Phase 6 同 |
| `data/best-practice/INDEX.md` | BP 巡检表 (~6.0K tokens) | Phase 3 nothing 模式才加载 |
| `data/best-practice/CASES.md` | BP 完整字段 | Phase 3 巡检 / Phase 6 同 |
| `data/collect-cmds.json` | (legacy · Phase 0 不依赖 · 内嵌固定 8 条命令 · 文件保留作历史参考)| — |

**工具**:

| 命令 | 用途 |
|---|---|
| `scripts/ssh.mjs --op exec` | SSH wrapper (ControlMaster + SSH_ASKPASS) · 一切 SSH 走它 |
| `scripts/ssh.mjs --op session-close` | 流程末尾收 master |
| `scripts/notebooklm.mjs --op query` | NLM 单条查询 |
| `scripts/notebooklm.mjs --op query-batch --from-bp-list <path>` | NLM 全量 BP 巡检 batch (M4 实装 · per-notebook merged ask) |
| `scripts/format-chat.mjs --chat <report.md> [--cols N]` | 读 .md 报告 · 找 `## 诊断结果` pipe table · 按终端列宽重排 cell 内 `<br>` 位置 · 其余内容原样透传 |
| `scripts/history.mjs --op load|save` | 历史连接 |
| `scripts/capture-flamegraph.mjs` | 火焰图采集 wrapper(透传到姐妹 skill `cpu-flamegraph` · 详见下方"外部依赖"段)|

**外部依赖**:

**火焰图采集走姐妹 skill `cpu-flamegraph` · 不是 perf-kp-sql 自己实现的**。`cpu-flamegraph` 来自同 marketplace 的独立 plugin · 由 perf-kp-sql 的 `.claude-plugin/plugin.json` 在 `x-plugin-dependencies` 字段硬声明(`^0.4.0`)· marketplace 装 perf-kp-sql 时会一起拉。

| 项目 | 值 |
|---|---|
| 依赖 plugin | `cpu-flamegraph` (同 marketplace · 独立 plugin) |
| 提供的 skill | `cpu-flamegraph/skills/cpu-flamegraph/`(同名 skill) |
| 版本约束 | `^0.4.0`(在 perf-kp-sql 的 plugin.json `x-plugin-dependencies` 里硬声明) |
| 入口 wrapper | perf-kp-sql 的 `scripts/capture-flamegraph.mjs` |
| 实际执行 | cpu-flamegraph 的 `scripts/capture.mjs`(SSH `perf record` + 本地 `flamegraph.pl` 渲染 + Top-N 提取) |

wrapper 内部按 `cpu-flamegraph` 名字在 `~/.ohsql/plugins/cache/` · `~/.claude/plugins/` · `~/.codex/plugins/` 等候选目录里自定位 · 跨 harness 兼容。**找不到时立即报错** · 提示用户用对应 harness 的 marketplace 重装 perf-kp-sql(会自动把 cpu-flamegraph 一起拉回来)· **不要凭印象用 `perf record` / `flamegraph.pl` 自己拼一套**。

> Phase 3.A.3 火焰图采集步骤的 `Bash(node <PLUGIN_ROOT>/scripts/capture-flamegraph.mjs ...)` 调用 · 本质是把参数透传给 cpu-flamegraph skill 的 capture 程序。

## Path placeholders · 字面尖括号占位符 · agent 字符串替换

下文所有 `<PLUGIN_ROOT>` 都是**纯文本占位符**(字面尖括号 · 不是 shell 变量,也不依赖任何 harness loader-time 替换)· agent 在每次发 `Bash(command=...)` 前做字符串替换,把 `<PLUGIN_ROOT>` 替换为字面绝对路径。

> ⚠️ **绝对不要在 Bash command 里写带大括号的 shell 参数替换形态**(形如 `$ {VAR}` · 此处加空格仅为文档显示 · 实际是 dollar+left-brace+name+right-brace)—— ohsql Bash 工具有静态屏蔽 · 任何含 dollar-brace 的命令一律 reject(`Command contains ${} parameter substitution`)· 即便 harness 已经替换了其中一个变量 · 另一个残留仍会触发。无 brace 的 `$HOME` / `$d` 形态不受影响。

### 解析 PLUGIN_ROOT(本 skill 启动时一次)

**从 skill base directory 推导** — harness 加载 skill 时一定会提供 base directory（Claude Code 显示 `Base directory for this skill: <path>` · Codex CLI / ohsql 等同理）。目录结构固定为 `<PLUGIN_ROOT>/skills/<skill-name>/` · 所以 **base directory 往上 2 级** 就是 PLUGIN_ROOT。

解析步骤:
1. 从 harness 的 skill 加载上下文里读取 base directory（字面绝对路径）
2. 去掉末尾的 `/skills/<skill-name>` 得到 PLUGIN_ROOT 候选值
3. 验证:

```
Bash(command="ls <候选路径>/scripts/ssh.mjs <候选路径>/data/cases/INDEX.md >/dev/null 2>&1 && echo '<候选路径>'")
```

stdout 非空 = 验证通过 · 记为 `PLUGIN_ROOT`。

**Fallback**（极少数 harness 不提供 base directory）:

```
Bash(command="bash -c '[ -n \"$CLAUDE_PLUGIN_ROOT\" ] && [ -d \"$CLAUDE_PLUGIN_ROOT\" ] && { echo \"$CLAUDE_PLUGIN_ROOT\"; exit 0; }; [ -n \"$OHSQL_PLUGIN_ROOT\" ] && [ -d \"$OHSQL_PLUGIN_ROOT\" ] && { echo \"$OHSQL_PLUGIN_ROOT\"; exit 0; }; echo \"\"'")
```

stdout 仍空 → AskUserQuestion 让用户填（选项详见 `perf-kp-sql-setup/SKILL.md` Step 1 fallback）。

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

典型场景:Phase 0 环境画像命令集 / Phase 3 case-driven 采集命令拼装。**不要**改用 `$'...'` ANSI-C 引号或 `"<cmd>"` 内联 —— 前者命中 OH-SQL BashTool 硬拒(CC 平台同款规则会弹权限提示),后者会让远端要展开的 `$VAR` 被本机 shell 提前吃掉。

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

This skill 对外呈现 **5 步主任务**(对应内部 Phase 0-5 · Phase 6 是用户追问触发 · 不进主任务清单)。Track them with the agent's task-list facility:
- **Claude Code**: use `TodoWrite` (5-element array, status field per item)
- **OpenAI Codex CLI**: use `update_plan` (5 steps, status field per step)
- **ohsql**: 内嵌 task tool
- **其他 agents 只在没 task tool 时**: render progress as plain text using `◻ ◼ ✔` markers

**5 步主结构**(content 字段就照这个写 · 不改顺序 · 不并行):

```
1. 环境信息采集
2. 诊断案例匹配
3. 诊断指标采集
4. 多源综合诊断
5. 报告生成
```

**Phase 3 (诊断指标采集) 启动后 · 必须把 task content 字段拆出 2 个层(操作系统层 + MongoDB 层)更新进度**(task tool 不一定支持嵌套子 task · 所以走 content 字段表达 · 不创建子 task)。具体格式:

进入 Phase 3 时 · 把 task 3 的 content 改成下方多行字符串 · 用 `<br>` / `\n` / 空格缩进表达层级(以 task tool 支持的换行格式为准)· 子项用 `✔` / `◼` / `◻` / `⏳` markers 表示子步状态:

```
3. 诊断指标采集
    ✔ 操作系统层:CPU / 内存 / 磁盘 / 网络
    ⏳ MongoDB 层:连接池 / 慢查询 / 锁竞争 / 存储引擎
```

完整渲染样例(纯文本 fallback 模式时也照这个版式):

```
✔ 1. 环境信息采集
✔ 2. 诊断案例匹配
◼ 3. 诊断指标采集
    ✔ 操作系统层:CPU / 内存 / 磁盘 / 网络
    ⏳ MongoDB 层:连接池 / 慢查询 / 锁竞争 / 存储引擎
◻ 4. 多源综合诊断
◻ 5. 报告生成
```

**子项硬约束**(只在 task list 用 · 不写进 md 报告):
- 操作系统层 = `CPU / 内存 / 磁盘 / 网络`
- MongoDB 层 = `连接池 / 慢查询 / 锁竞争 / 存储引擎`
- **md 报告不写采集维度清单**(用户看不懂细节 · 报告只列根因 + 措施)
- 子项进度切换 = update task content 字段 · 不创建子 task

**Single-source rule** — do NOT print the task list as plain text in chat when the task tool is available。Each phase transition (in_progress → completed; pending → in_progress) 通过 task tool 重发完整 task list · 不另写 plain text。

---

# 长操作 narration 强制(每条长 Bash 前必须打一行状态)

⚠️ **背景**:Phase 3 SSH 采集 / Phase 4 NLM query / Phase 5 format-chat 这些 Bash 调用单次 60-300s · 期间 chat 屏幕空白 · 用户不知道在干啥(activeForm spinner 太静态 · 看不出当前具体在哪步)。

⚠️ **硬规则**:**长 Bash 调用(预计 ≥ 30s)发起前 · LLM 必须在 chat 打 1 行 narration**(与 Bash 调用在同一 assistant message 里 · narration 在前 · Bash 在后)。

**格式**:`[阶段 · 动作]`(中文 · ≤ 30 字 · **不写预期耗时**)

⚠️ **字段规则**(严格 · 不许自由发挥):

1. **阶段** = task list 5 步主任务字面之一 · verbatim:
   - `1. 环境信息采集`
   - `2. 诊断案例匹配`(本步无长 Bash · 不用 narration)
   - `3. 诊断指标采集`
   - `4. 多源综合诊断`
   - `5. 报告生成`
   - **不许**写 "环境画像" / "采集" / "NLM" / "报告" / "诊断" 等内部行话或自创短词
2. **动作** = 名词短语 + 具体维度 · 像运维体检单:
   - **不许动词**:`拉` / `查` / `查询` / `查证` / `检索` / `采样` / `重排` / `比对` / `判断` 等一律去掉
   - **不许 LLM 味形容**:`并行` / `批量` / `查询中` / `进行中` / `秒级` 等去掉
   - **可以保留**:具体维度(CPU/内存/磁盘/网络 / 连接池/慢查询/锁/WiredTiger)· 工具名(perf / NotebookLM)· 时长数字(3s)
3. **不写预期耗时**:不许挂 `· ~10s` / `· ~120s` / `· ~7min` 这种估算尾巴。Bash 的 `timeout` 是上限不是均值 · 估出来不准 · 反而显得离谱。
4. **Phase 4 多源专属**:动作字段固定写"案例库 + NotebookLM 联网知识库" · 把"多源"具体是哪几个源亮出来 · 不挂 `<topic>` / `查证` / `巡检` 等动作。Phase 4 三种 NLM 调用场景共用一个模板。

**模板**(6 行 · 严格按上面 4 条规则填):

| 场景 | narration 模板 |
|---|---|
| Phase 0.7 env probe | `[1. 环境信息采集 · 系统/数据库版本/硬件信息]` |
| Phase 3.A.4 OS 层采集 | `[3. 诊断指标采集 · 操作系统层 CPU/内存/磁盘/网络指标]` |
| Phase 3.A.4 Mongo 层采集 | `[3. 诊断指标采集 · MongoDB 连接池/慢查询/锁/WiredTiger 指标]` |
| Phase 3.A.3 火焰图 | `[3. 诊断指标采集 · mongod CPU 火焰图 perf 3s]` |
| Phase 4.* 任意 NLM 调用(单/并行/batch) | `[4. 多源综合诊断 · 案例库 + NotebookLM 联网知识库]` |
| Phase 5.4 format-chat | `[5. 报告生成]` |

**短 Bash(< 30s · 例如 mkdir / history.mjs / notebooklm check / session-close)**:不用 narration · 静默执行避免噪音。

**判断标准**:看 SKILL.md 里该 Bash 上方注的 `timeout=` 字段 · ≥ 30000 = 长 Bash · 必须 narration。

**❌ 反例 · 自由发挥措辞**:
```
[NLM · mongo 查询中 (~60-120s)]
[环境画像 · SSH 采集 8 项 (~10s)]
[采集 · 操作系统层 SSH (~20s)]
[4. 多源综合诊断 · NotebookLM 2 项联网检索 · ~120s]
```
违规理由:阶段写"NLM/环境画像/采集"自创短词 · 不在 5 步主任务字面里;动作含"查询中/SSH/联网检索"动词或实现细节;挂 `~10s` / `~120s` 估算耗时;Phase 4 没把"多源"两个源都列出来(只写 NotebookLM 不够)。

**✅ 正例**:
```
[4. 多源综合诊断 · 案例库 + NotebookLM 联网知识库]

⏺ Bash(node /.../notebooklm.mjs --op query --domain mongo --query "..." )
```
阶段字面跟 task list 一致 · 动作把"案例库 + NotebookLM 联网知识库"两个源都亮出来 · 不挂耗时 · narration 在 Bash 同 message。

---

# Pre-flight · 临时目录就绪

skill 加载后、Phase 0 之前,无条件先跑一次 mkdir 兜底(目录已存在 = 静默 noop):

```
Bash(command="mkdir -p ~/.perf-kp-sql/tmp ~/.perf-kp-sql/runs/<TS>")
```

`<TS>` 是本轮诊断的统一时间戳 `YYYYMMDD-HHMMSS` · Phase 0 解析参数那一刻就钉死 · 后续所有写盘动作(env probe / 采集 / 报告 / 火焰图)全落到 `~/.perf-kp-sql/runs/<TS>/` 这一个目录里。

> **目录用途**:
> - `~/.perf-kp-sql/tmp/` — SSH command-file 临时文件(`perf-kp-sql-cmd-<TS>.txt`)· 用完即弃 · 不属于 run 产物
> - `~/.perf-kp-sql/runs/<TS>/` — 单次诊断的所有 run 产物归档(报告 / 采集 / 火焰图)· 见下方 "归档目录布局"
> - `~/.perf-kp-sql/notebooklm.json` — NLM 配置(持久化 · 跨 run 复用)
>
> **旧目录 `reports/` / `flame/` 不再使用**(单目录归档 · 历史 run 产物原地保留 · 不迁移)。

这一行命令不含 `${}` / heredoc / 重定向 / 引号嵌套,跨三家 harness 都能过。失败极罕见(磁盘满 / 权限禁),失败时给用户一行 `请确认 $HOME 可写后重试` 即可。

## 归档目录布局

```
~/.perf-kp-sql/runs/<TS>/
  ├── report.md          ← 诊断报告(Phase 5.3 写)
  ├── flame.svg          ← 火焰图(Phase 3.A.3 采到时才有)
  ├── env.txt            ← Phase 0.7 SSH env probe 输出
  ├── collect-os.txt     ← Phase 3.A 操作系统层采集
  └── collect-mongo.txt  ← Phase 3.A MongoDB 层采集
```

**保留旧路径**(看 SKILL.md 用途):
- `~/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt` — SSH command-file 临时文件(用完即弃 · 不属于 run 产物)
- `~/.perf-kp-sql/notebooklm.json` — NLM 配置(持久化 · 跨 run 复用)
- `~/.perf-kp-sql/experiments/<TS>/` — 暂时保留(若 SKILL.md 后续段引用)

---

# Workflow

> **流程顺序**:Phase 0 凭据 + 连通性 + 环境画像 → Phase 1 对话引导(用环境上下文聊问题现象)→ Phase 2 诊断案例匹配 → Phase 3-6。**Phase 0 连通性探测成功前 · 不进 Phase 1 跟用户聊问题**。

## Phase 0 · 环境信息采集(凭据 + 连通性探测 + 环境画像)

**进入 Phase 0 第一动作必须**:

```
Read(file_path="<PLUGIN_ROOT>/skills/perf-kp-sql/references/phase-0-env.md")
```

reference 里规定 0.1 历史选单 → 0.2 参数抽取 → 0.3 参数校验 → 0.4 [连接信息] banner → 0.5 SSH 参数门(Gates 兜底)→ 0.6 DB 凭据预询问 → 0.7 SSH 连通性探测 + 环境画像 → 0.8 连通性判定(关键 gate · 不通不进 Phase 1)→ 0.9 解析环境画像 → 0.9.5 持久化询问 → 0.10 NLM 连通性探测(含 NLM-relogin 流程)。**跳过 Read = 红线违规** · LLM 凭训练数据走 Phase 0 是 bug。

> **关键约束**:
> - Phase 0 期间**只收 SSH 凭据 · 不收问题现象 · 不让用户选诊断方式**(开篇 7 条第 1+2)
> - **banner 输出前不调远端 SSH 命令**(红线段)
> - **历史选单 + 持久化询问硬约束**(红线段)
> - **NLM-relogin 鉴权失败统一处理**(红线段)
> 全部约束在主 SKILL 已经定义 · reference 是 phase 0 实现细节。

Phase 0 全部子步完成 · 拿到 [环境上下文] 后,mark task 1 (环境信息采集) completed → mark task 2 (诊断案例匹配) in_progress · 进 Phase 1。


## Phase 1+2 · 对话引导 + 诊断案例匹配

**进入 Phase 1 第一动作必须**:

```
Read(file_path="<PLUGIN_ROOT>/skills/perf-kp-sql/references/phase-1-2-case.md")
```

reference 里规定 Phase 1(1.1 看用户已给信息 / 1.2 上下文化询问 / 1.3 现象收齐)→ Phase 2(2.1 加载 INDEX 索引 / 2.2 LLM 匹配 + 收敛规则表 / 2.3 Bash awk 加载单 case 字段 / 2.4 写 phase2-trace)。**跳过 Read = 红线违规**。

> **收敛规则**(候选 ≤ 3 就停 / 用户答不确定不剪枝 / 追问 ≤ 5 轮)+ **Phase 2 内部数据不暴露**(case_id / 候选概率 / metric 清单不给用户) 详见 reference + 主 SKILL 文档顶部 7 条硬约束。

mark task 1 (环境信息采集) completed → mark task 2 (诊断案例匹配) in_progress · 然后 task 2 → task 3 transition 在 reference Phase 2.4 末尾。


## Phase 3 · 诊断指标采集

**进入 Phase 3 第一动作必须**:

```
Read(file_path="<PLUGIN_ROOT>/skills/perf-kp-sql/references/phase-3-collect.md")
```

reference 里规定 3.A · DF / Flame 路径(Phase 2 命中 ≥ 1 case · 按层拼 cmd / OS+MongoDB 串行 SSH / 实时刷 task 3 子项 / Bash awk 抽 collect-mongo section)/ 3.B · nothing 模式(Phase 2 命中 0 · BP 巡检全采集)。**跳过 Read = 红线违规** · LLM 凭训练数据走 Phase 3 是 bug。

> **task 3 子项实时刷新**(操作系统层 ✔ → MongoDB 层 ⏳ → MongoDB 层 ✔)是核心特色 · reference 末尾详细 · 主 SKILL "Task tracking pattern"段也已定义。

mark task 2 (诊断案例匹配) completed → mark task 3 (诊断指标采集) in_progress 在 reference 起始(详见上文 Phase 2)。


## Phase 4 · 多源综合诊断

**进入 Phase 4 第一动作必须**:

```
Read(file_path="<PLUGIN_ROOT>/skills/perf-kp-sql/references/phase-4-multisource.md")
```

reference 里规定 4.A · DF / Flame 路径(案例 + NLM 双阶段 · 候选根因并行 NLM query · 综合判定表) / 4.B · best-practice 巡检(全量经 NLM · query-batch / chunk size 5 / 节流) / 4.C · 写 phase4-trace.md(强制落盘)。**跳过 Read = 红线违规** · LLM 凭训练数据走 Phase 4 是 bug。

> **NLM 双源约束**(每个根因案例 + NLM 二次确认)+ **URL 强制溯源** + **case_id 不暴露给用户** 在文档顶部"流程顺序硬约束"7 条 + `# 红线` 段都有兜底定义 · 见上下文。

mark task 4 (多源综合诊断) completed → mark task 5 (报告生成) in_progress 在 reference 末尾。


## Phase 5 · 报告生成

**进入 Phase 5 第一动作必须**:

```
Read(file_path="<PLUGIN_ROOT>/skills/perf-kp-sql/references/phase-5-report.md")
```

reference 里规定 5.1 汇总根因排序 / 5.2 写 markdown 报告(报告骨架 / 单元格 `<br>` 换行规范 / 5 标签来源标记 / URL 强制溯源约束) / 5.3 落盘(单目录归档) / 5.4 session-close + chat 输出格式化报告(强制操作步骤 / self-check 4 条 / 反例)。**跳过 Read = 红线违规** · LLM 凭训练数据走 Phase 5 是 bug。

> **self-check 4 条规则**(防 LLM 美化报告 / 输出竖排)在 `# 红线` 段也复制一份兜底 · 见下方红线段第 4 条。

---

## Phase 6 · 深入对话(可选 · 用户追问触发)

skill 加载后,任何非 `/` 命令的自然语言输入(典型:用户针对报告某行追问)触发 Phase 6。

**进入 Phase 6 第一动作必须**:

```
Read(file_path="<PLUGIN_ROOT>/skills/perf-kp-sql/references/phase-6-followup.md")
```

reference 里规定 6.1 案例 路径(Read CASES.md 拿 case 字段) / 6.2 NLM 路径(单条追问) / 6.3 合并策略。**跳过 Read = 红线违规** · LLM 凭训练数据走 Phase 6 是 bug。

---

# 红线

- SSH 走本地 `ssh` / `scp` CLI(see Architecture · SSH execution pattern); 不调任何 agent 的私有 SSH tool(`SshExec` / `SshUpload` / `FlameGraph` 等)
- 只读诊断,不修改远端配置
- **禁止用 inline-script 替代 Write 工具** —— 不用 `python3 -c '...'` / `python3 - <<'PY'` / `node -e '...'` / `cat <<'EOF' > file` / `sed -i ...` / `awk -i ...` 任何形式的"行内脚本写文件";落盘必须走 Write 工具
- chat 输出报告时 · **调 format-chat.mjs 拿 stdout · 字面复制到 chat** · 不是 emoji bullet 摘要 · 不是字段竖排 · 不是叙述性段落总结 · 复制完后必须跑 self-check 4 条硬规则(`|---|` 必含 / `|` ≥ 30 次 / 不许 `────` / 不许 ≥ 3 个"字段: 值"行)· 失败必须回到步骤 2 重做。详见 Phase 5.4 输出格式硬约束。
- chat 输出由 format-chat.mjs 组装 · 包含诊断表 + 火焰图 + 参考 URL · 不需要 LLM 额外补充
- banner 输出前不调远端 SSH 命令
- **开场白强制**:skill 触发时立即打屏 5 步流程预告(详见文档顶部 `# 开场白` 段) · md 报告头部也要字面带这一段。不许省略 · 不许重写措辞 · 不许加 emoji。
- **诊断表权威性**:`## 诊断结果` 主表所有 row 必须有 案例/NLM 背书 · 无背书根因移到 `## 现场观测(无权威来源)` 段标"请独立验证"。详见 Phase 5.2。

> 流程顺序 / 案例强制使用 / `[参考N]` URL 溯源 / Phase 4 双源约束 — 详见文档顶部 "流程顺序硬约束" 7 条(L30-71)· 此处不重复。
- **NLM 鉴权失败统一处理**:Phase 0.10 NLM 连通性探测 / Phase 4.* / Phase 6 任何 NLM 调用 · 返回鉴权失败信号(`auth_expired` / `unauthorized` / `cookie_invalid` / 401 / 403 等)· 必须触发 NLM-relogin 流程(开 Chrome 让用户登录 → 等用户确认 → 重 check → 重试被中断的调用)。详见 Phase 0.10 "#NLM-relogin" 段。**绝对不许** 拿到鉴权错误就 skip NLM 用 仅案例 应付 — 用户该看到 NLM 兜底的根因没被看到 = 工具能力打折。
- **诊断案例匹配收敛硬约束**(团队规则):候选 ≤ 3 个就停 · 不再追问区分;追问轮数累计 ≤ 5 轮 · 第 5 轮仍 > 3 个就强制带前 3 个进 Phase 3。**用户答"不确定 / 不知道"等 0 信息回答 → 不剪枝 · 候选全部带进 Phase 3 由现场指标定夺**(详见 Phase 2.2 收敛规则表)。多 case 并行诊断是标准能力。
- **历史选单 + 持久化询问硬约束**:每次 skill 触发都要跑 `history.mjs --op load` 并展示选单(空也展示 + 一行"暂无历史" + "新连接"选项)· **不许** "我看 args 已经传了 host 就跳过 0.1"。env probe 跑通后 0.9.5 必须主动 save 主连接 + env(无须问)+ 单独问凭据 opt-in(每次问 · 不批量记忆)· **不许** "我替用户决定不存" / "我假设用户上次同意所以这次也存"。详见 Phase 0.1 + 0.9.5。
- **Phase 2 内部数据不暴露给用户**:LLM 在前期只负责引导提问 + 范围收敛 + 推进进入下一阶段 · **不许给用户列**:case_id 字面值 / 候选概率 / 待采集 metric 清单 / 内部分类名 / 案例 规模数字 / "已排除哪几类"长 bullet。LLM 看似只问 1-2 个引导问题然后说"开始采集数据" · 内部所有候选 case + metric 准备都对用户透明。详见"用户可见消息 · 禁用元词清单"。
- 问用户时 header / topic 只写具体字段名,不用模糊词
- **Phase 2-3 之间禁止任何探测性 SSH**(`command -v perf` / `pgrep` / `ss -lntp` 等):环境画像在 Phase 0 已做、Phase 3 命令直接来自 case 的 collection_method_quote 适配
- 不用 `/tmp/` 落盘 · 用 `~/.perf-kp-sql/`
- **单目录归档**:本轮 run 所有产物落 `~/.perf-kp-sql/runs/<TS>/` 单目录 — `report.md` / `flame.svg` / `env.txt` / `collect-os.txt` / `collect-mongo.txt`。旧目录 `~/.perf-kp-sql/{reports,flame}/` 已弃用 · 不再写入(SSH command-file 临时文件仍走 `~/.perf-kp-sql/tmp/`)。
- 不跳过 Phase 0 环境画像 · 不跳过 Phase 5 报告落盘
- **不许先声明带"待确认"占位的 task list** · task list 在 Phase 0 收齐参数后立即声明 · Phase 1 执行后才 mark task 2 (诊断案例匹配) in_progress(不许预先声明再回头补)
- **task list 5 步主结构 + Phase 3 子项**:5 步主任务 = 1.环境信息采集 / 2.诊断案例匹配 / 3.诊断指标采集 / 4.多源综合诊断 / 5.报告生成。Phase 3 启动后必须把 task content 拆出 2 个层(操作系统层 + MongoDB 层 · 详见 "Task tracking pattern" 段)。md 报告**不写**采集维度清单(用户看不懂细节)。
- task tool 可用时(Claude Code / Codex CLI / ohsql),**只许调 task tool**,不许另外用纯文本渲染 `━ 5 步任务清单 ━` / `◻ task 1 · ...` 重复列出
- **不向用户输出内部实现术语**(详见下方独立一节《用户可见消息 · 禁用元词清单》)
- 工具失败 → 静默重试 1 次,第 2 次仍失败 → 一行 diagnostic 跳过,cap=2
- 不道歉 / 不反省 / 不自述内部出错
- NLM 不可用 → Phase 4.B 退化为 仅案例 · 报告里标"NLM 缺失,best-practice 巡检使用 案例 当前推荐(可能落后官方最新)"

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
| **内部分类名**(`symptom_category` / `case_pattern` / `scope` / `bucket` 等 INDEX 列名)| 案例 内部数据 schema · 用户不关心 · 用人话替代("查询慢" / "内存压力" / 等) |
| **内部统计数字**(`93 条 best-practice` / `109 case` / `11 个 symptom_category` / `45% 概率`)| 内部 案例 规模 / LLM 估算 · 给用户看反而困惑 · 直接给追问问题或开始 SSH |
| **case 候选概率 / 置信度**(`45% / 35% / 20%` / "置信度 45/35/20")| Phase 4 报告才标置信度 · Phase 2 不标 |
| `--op query-batch` / `--from-bp-list` 等命令行参数 | 程序参数 |

**判断规则**:看输出时把每个英文坐标词圈出来 — 如果用户得在脑里翻译成"哦,这是第几阶段哪一步",**就违规**。直接说做什么。

**错 / 对对照**:

| 错 | 对 |
|---|---|
| `phase 1 → completed · phase 2 → in_progress` | `环境信息采集完成,开始匹配诊断案例。` |
| `task 1 ✔ · task 2 in_progress` | `环境信息采集完成,开始匹配诊断案例。` |
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
| `data/cases/INDEX.md` | DF + Flame 路由表(Phase 2 加载) |
| `data/cases/CASES.md` | DF + Flame 完整字段(Phase 2.3 / Phase 6 用 Read offset+limit) |
| `data/best-practice/INDEX.md` | BP 巡检表(Phase 3.B nothing 模式加载) |
| `data/best-practice/CASES.md` | BP 完整字段(Phase 6 追问) |
| `data/collect-cmds.json` | (legacy · Phase 0 不依赖 · 内嵌固定 8 条命令)|
| `scripts/ssh.mjs --op exec` | SSH 远端执行 |
| `scripts/ssh.mjs --op session-close` | 流程末尾收 master |
| `scripts/notebooklm.mjs --op query` | NLM 单条查询 |
| `scripts/notebooklm.mjs --op query-batch` | NLM 全量 BP 巡检 batch |
| `scripts/format-chat.mjs --chat <report.md> [--cols N]` | 读 .md 报告 · 按终端列宽重排诊断表 cell `<br>` 位置(Phase 5.4 调用) |
| `scripts/history.mjs --op load|save` | 历史连接 |
| `scripts/capture-flamegraph.mjs` | 火焰图采集 wrapper(透传到姐妹 skill `cpu-flamegraph` · 详见 Architecture「外部依赖」段)|

---

# 输出契约

- 报告文件名:`report.md`,TS = `YYYYMMDD-HHMMSS`(单目录归档 · 文件名固定 `report.md` · 时间戳进目录路径)
- 路径:`~/.perf-kp-sql/runs/<TS>/report.md`
- 同目录还会有(按需):`flame.svg` / `env.txt` / `collect-os.txt` / `collect-mongo.txt`
- 诊断完直接给结论,不追问"要不要补做 X"
- 报告 .md 是 LLM 直出 · chat 输出由 `format-chat.mjs --chat .md` 按终端宽度重排后 LLM 字面复制

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
- `engine=mongo` — database engine (只支持 mongo · 默认即 mongo · MySQL/Redis 暂不支持)
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
