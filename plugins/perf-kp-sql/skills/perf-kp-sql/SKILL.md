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
  在 /tmp/perf-kp-sql-cm-<hash>.sock)· 服务端只看到 1 个连接 · 避开 PAM
  faillock / fail2ban / sshd MaxStartups 限速。
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

**输出位置**:chat 通道 · Phase 0 启动后**立刻打屏**(在历史复用 / 收凭据 / banner 之前 · 是 skill 触发后用户看到的第一段 LLM 输出)。

**为什么必须打**:用户进 skill 第一时间得知道接下来要经历什么 5 步流程 · 中途会被问哪些信息,降低使用焦虑。md 报告**不写**这段(报告读者已经在看结果,不需要再被告知流程)。

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

**Phase 0 / 3 / 4 启动后 · 必须把 task content 字段拆子项更新进度**(task tool 不一定支持嵌套子 task · 走 content 字段表达 · 不创建子 task)。子项用 `✔` / `◼` / `◻` / `⏳` markers · 用 `<br>` / `\n` / 空格缩进表达层级(以 task tool 支持的换行格式为准)。

**Phase 0 (环境信息采集) 子项**:

```
1. 环境信息采集
    ✔ SSH 连通性 + 环境画像
    ⏳ NotebookLM 知识库连通性
```

**Phase 3 (诊断指标采集) 子项**:

```
3. 诊断指标采集
    ✔ 操作系统层:CPU / 内存 / 磁盘 / 网络
    ⏳ MongoDB 层:连接池 / 慢查询 / 锁竞争 / 存储引擎
    ◻ mongod CPU 火焰图 perf 3s
```

**Phase 4 (多源综合诊断) 子项**:

```
4. 多源综合诊断
    ✔ 案例库阈值直判
    ⏳ NotebookLM 知识库查询 (2/3)
    ◻ 综合判定
```

`(M/N)` 表示并行 NLM query 完成数 / 总数 · 每完成一条 update 一次 task content。

完整渲染样例(纯文本 fallback 模式时也照这个版式):

```
✔ 1. 环境信息采集
    ✔ SSH 连通性 + 环境画像
    ✔ NotebookLM 知识库连通性
✔ 2. 诊断案例匹配
◼ 3. 诊断指标采集
    ✔ 操作系统层:CPU / 内存 / 磁盘 / 网络
    ⏳ MongoDB 层:连接池 / 慢查询 / 锁竞争 / 存储引擎
    ◻ mongod CPU 火焰图 perf 3s
◻ 4. 多源综合诊断
◻ 5. 报告生成
```

**子项硬约束**(只在 task list 用 · 不写进 md 报告):
- Phase 0 子项 = `SSH 连通性 + 环境画像` / `NotebookLM 知识库连通性`
- Phase 3 子项 = `操作系统层:CPU / 内存 / 磁盘 / 网络` / `MongoDB 层:连接池 / 慢查询 / 锁竞争 / 存储引擎` / `mongod CPU 火焰图 perf 3s`
- Phase 4 子项 = `案例库阈值直判` / `NotebookLM 知识库查询 (M/N)` / `综合判定`
- **md 报告不写采集维度清单**(用户看不懂细节 · 报告只列根因 + 措施)
- 子项进度切换 = update task content 字段 · 不创建子 task
- **绝对不许**在 chat 通道打 "OS 层完成 / MongoDB 层完成 / NLM 查询 N 完成 / 还有 X 条等通知 / NLM 增强已就绪 / 凭据状态匹配跳过保存" 等子项状态描述文字 · 这些进度全靠 task tool UI 表达 · chat 通道保持静默

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

**这是流程第一步 · 也是关键 gate**:
1. 收齐 SSH 凭据 + 渲染 banner
2. SSH 一次跑 8 条命令拉环境画像(同时验证连通性)
3. 拿到 `[环境上下文]` 后才进 Phase 1 跟用户聊问题现象

**banner 必须在任何远端 SSH 命令之前渲染。** 本地参数采集(history load · prompts to user)不受限。

**连通性硬约束**:0.7 SSH env probe 失败 → 阻断流程 · 给用户 troubleshooting · 等用户修凭据 / 网络后重发命令 · **不进 Phase 1 对话引导**。聊半天问题现象但凭据是错的 = 白聊。

### 0.1 · 历史选单(每次 skill 启动都展示 · 不论是否传了 slash args)

**触发**:skill 一被触发就跑 · 不论 slash args 给没给 host。**这是用户看到的第一个交互入口**(开场白之后)· 让用户从最近用过的连接里挑 · 或选"新连接"走参数抽取。

```
Bash(command="node <PLUGIN_ROOT>/scripts/history.mjs --op load --max 5")
```

`--op load` 返回 hosts 列表(已按 last_used 倒序 · 最多 5 条 · LRU 淘汰已由 history.mjs 内部处理)· 每条含:
- 基础:`host` / `user` / `port` / `engine` / `last_used` / `use_count`
- 可选凭据:`password` / `privateKeyPath` / `mongo_user` / `mongo_password` / `auth_db`(用户上次显式同意保存才有)
- 可选环境:`env`(os_distro / arch / cpu_model / mongod_version / deploy_form 等)+ `env_captured_at`

**展示选单**(无论 hosts 是否为空都展示 · 让用户每次明确选择):

hosts **非空** 时,prose 模板:

```
请选择最近使用过的连接 · 或新建:

  1. 192.168.1.10 · admin · port=22 · MongoDB 7.0.31 · Kunpeng-920 ARM · 单机 · 上次 2 小时前
  2. 10.20.30.40 · ec2-user · port=22 · MongoDB 6.0.13 · x86_64 · 副本集 · 上次 3 天前
  N. 新连接 · 手动输入参数
```

每条把 `env` 摘要(`MongoDB <version> · <cpu_model> <arch> · <deploy_form>`)接在 host/user/port 后面 · 帮用户识别多台机器。`env` 字段缺失(老 hosts.json 没缓存过)→ 跳过这一段 · 只显示 host/user/port。

hosts **空** 时,prose 模板:

```
暂无历史连接。

  1. 新连接 · 手动输入参数
```

Stop here and wait for the user's selection in the next turn。

**用户选历史 N**(1-5):
- 把那条记录的 host / user / port / engine 解码进参数集
- 凭据(password / mongo_user / mongo_password / auth_db)存了就一起解码 · 没存就空着 · 0.6 反向问
- env 字段记进 `[history-cached-env]`(供 0.8 后期对照用)· 但**不直接当 [环境上下文]**(还要 0.7 实测一遍验证连通性 + 拿最新 env)

**用户选"新连接"**(N 号):
- 跳过历史复用 · 直接进 0.2 参数抽取询问

**No stopping after selection**: same turn → render banner(0.4)→ declare 5-step task list → 继续 Phase 0 后续步骤(0.4 banner → 0.6 DB 凭据 → 0.7 SSH env probe → 0.9 解析 → 0.9.5 持久化询问 → 0.10 NLM 探测)。Phase 0 全部子步完成后才 mark task 1 (环境信息采集) completed → mark task 2 (诊断案例匹配) in_progress → 进 Phase 1 对话引导。

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
3. 全传齐仍空 → 走紧凑二次采集

### 0.6 · DB 凭据预询问(凭据缺时前置)

**触发**:DB 凭据缺(0.9.2 起只支持 mongo,无 engine 分支):
- mongo 缺 `mongo_user` 或 `mongo_password` → 触发本步

如果用户 slash args 已经把对应凭据传齐 → 跳过本步,直接进 0.7。

**为什么前置**:不问就跑后续采集会浪费 60-100s · 等到 Phase 3 DB 命令报 auth fail 才反向问 — 用户体验差。这里给用户一个**主动选择**的入口。

ask the user(topic = `数据库连接信息`):

```
━ 数据库连接信息 ━
当前未提供数据库凭据。请选:
  1. 我现在补全凭据(engine + db_user + db_password [+ auth_db for mongo])
     → 现在收齐后进入采集,采集时凭据直接生效
  2. 跳过,先做环境画像
     → 继续跑环境探测,后续 DB 命令报 auth fail 时再反向问凭据
请回复 1 / 2 或直接给参数。
```

Stop and wait for the next turn。

**用户选 1(补全)**:engine 默认 mongo · 收 mongo 凭据(`mongo_user` / `mongo_password` / `auth_db`)· 全收齐 → 进 0.7。

**用户选 2(跳过)**:直接进 0.7 · 凭据由 Phase 3 命令失败时反向问。

**用户直接给参数**(不答 1/2 而是直接补字段):并入参数集 · 等价于"选 1"路径。

### 0.7 · SSH 连通性探测 + 环境画像(关键 gate · 不通不进 Phase 1)

凭据收齐 + banner 渲染后 · **立即跑一次 SSH** 拿环境画像 — 同时验证连通性。**这一步成功前不跟用户继续聊问题现象**。

固定 8 条命令(不依赖 case):

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt", content="""\
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
       --command-file /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt \
       --output-file /Users/<yourlogin>/.perf-kp-sql/runs/<TS>/env.txt", timeout=60000)
Read(file_path="/Users/<yourlogin>/.perf-kp-sql/runs/<TS>/env.txt")
```

> **路径说明**:
> - 命令文件落 `~/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt`(用完即弃 · 不属于 run 产物)
> - env probe 输出落 `~/.perf-kp-sql/runs/<TS>/env.txt`(归档进 run 目录)

### 0.8 · 连通性判定(关键 gate)

| ssh.mjs 返回 | 判定 |
|---|---|
| `exitCode=0 + stdout 非空 + 含 ###UNAME### 等标记` | ✅ 连通 · 进 0.9 解析 |
| `err: SSH connection failed (255)` | ❌ 协议层失败(认证 / 路由)· 给用户 troubleshooting · stop wait 用户改凭据 · **不进 Phase 1** |
| `stdout=stderr=""` | ❌ 走 Gate 4 自检(参见 0.5) · 失败重试不通 → stop wait 用户 · **不进 Phase 1** |

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

**历史 cached env 对照**(仅当 0.1 用户选了历史 N 时跑):

把刚拿到的 `[环境上下文]` 跟 `[history-cached-env]` 逐字段比对 · 任一字段变化(典型例:mongod_version 升级 · deploy_form 由 standalone 变 replica-set · arch 从 x86_64 变 aarch64)→ 在公告活动行追加一行变化提示:

```
  · 环境变化 · MongoDB 7.0.31 → 8.0.5 · 已更新缓存
  · 环境变化 · 单机 → 副本集 · 已更新缓存
```

完全一致 → 不打提示行(默静)· cached env 仍会在 0.9.5 持久化询问时跟新值一起 save 刷新 `env_captured_at` 时间戳。

### 0.9.5 · 持久化询问(探活成功后 always 跑)

env probe 跑通 + [环境上下文] 解析完后 · 把本次连接 + 环境信息写回 history。**主连接信息(host/user/port/engine + env)无须问 · 直接 save**(用户后续要在选单看到这台机器); **凭据(password / mongo_password)opt-in 每次问**:

#### 第 1 步 · 自动 save 主连接 + env(无须问 · 静默执行)

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-env-<TS>.json", content="<JSON of [环境上下文] · 字段名跟 EnvContext 一致>")
Bash(command="node <PLUGIN_ROOT>/scripts/history.mjs --op save \
       --host <ip> --user <user> --port <n> --engine mongo \
       --env \"$(cat /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-env-<TS>.json)\"")
```

> `--env` 接受 JSON string · 字段子集即可(脚本内部按 EnvContext schema 持久化)。

#### 第 2 步 · 凭据 opt-in 询问(仅在凭据状态变化时问)

⚠️ **触发条件**(任一为真即问 · 否则**静默跳过**):

| 场景 | 触发? | 提示语 |
|---|---|---|
| 0.1 选了"新连接" · 当前会话首次提供凭据 | ✅ 问 | "是否保存密码?"(模板 A) |
| 0.1 选了历史 N · 但该 record `password` 字段为空 | ✅ 问 | "是否保存密码?"(模板 A) |
| 0.1 选了历史 N · `password` 已存 · 但**本会话凭据被更新过**(history record 中的 password / mongo_password 与本会话实际使用值不一致 · 典型场景:历史密码失效 → env probe 失败 → 用户在 0.6/反向问中输入了新密码 → 探活成功)| ✅ 问 | "密码已变更 · 是否覆盖保存?"(模板 B) |
| 0.1 选了历史 N · `password` 已存 · 本会话直接复用历史凭据 · env probe 一次成功 | ❌ **完全静默跳过** · 既不弹问询 · **也不打 announce 跳过这件事的 chat 文字**(典型违规:"凭据状态匹配历史 + 探活一次成功 → 跳过保存凭据询问"——这话本身就是噪音 · 不许打)· 直接进 0.10 |

**跳过的判据**:
- LLM 内部比较"本会话实际使用的凭据" vs "history record 里的凭据字段值"
- 若**完全一致**(password / mongo_user / mongo_password / auth_db 字段均相同 / 都未填)且 env probe 一次成功 → 跳过
- 任一字段不一致或 env probe 经历过重试(说明凭据有更新)→ 触发问询

**为什么这么设计**:用户主动选了历史 N · 已经隐式同意复用其中包括凭据的所有字段。再次问"保存吗?"等于让用户回答自己刚做过的决定 · 是噪音(实测 UX 问题)。只有当**凭据真的变化**(首次输入 / 失效后更新)时 · 才有"是否保存"这个有意义的决策点。

**模板 A · 首次保存**(场景 1+2):

```
━ 保存凭据 ━
本次连接已存进历史(host / user / port / 环境画像)。

是否把密码也一起保存到 ~/.ohsql/perf-kp-sql/hosts.json?
(文件 chmod 600 · 仅本用户可读 · 下次选这条历史可免输密码)
请回复:
  1. 保存(SSH 密码 + MongoDB 密码都存)
  2. 不保存(只本会话用 · 下次重输)
```

**模板 B · 凭据更新覆盖**(场景 3):

```
━ 凭据已更新 ━
本会话使用的密码与 history 中保存的不一致(可能是密码改过)。
是否用本次的密码覆盖 history 中的旧值?
请回复:
  1. 覆盖保存(用新密码替换 history 中的旧值)
  2. 不动 history(本会话照旧用新密码 · history 保留旧值)
```

stop and wait for next turn。

**用户选 1(保存 / 覆盖)**:再调一次 `--op save` 带凭据 flag 覆盖上去:

```
Bash(command="node <PLUGIN_ROOT>/scripts/history.mjs --op save \
       --host <ip> --user <user> --port <n> --engine mongo \
       --password '<pw>' [--mongo-user <u> --mongo-password '<p>' --auth-db <d>]")
```

**用户选 2(不保存 / 不动 history)**:跳过 · 第 1 步已经把主连接 + env 存好 · 凭据本会话内存里有 · 下次重输或继续用 history 旧值。

**用户回答模糊或问"什么风险"**:简短答 "明文存 chmod 600 文件 · 仅本用户可读 · 跟 known_hosts / Recent Connections 同级风险" · 不重发问题(不当 LLM 教育课堂)· 答完再 wait。

### 0.10 · NLM 连通性探测(可选 · 软告警 · 不阻断)

NLM 是 Phase 4 多源综合诊断的可信兜底(案例 没覆盖现象时拿真实文档 references)· 提前探一下 · 失败时给用户机会现在重新登录 · 比 Phase 4 才发现失败重新打断流程好。

⚠️ **NLM 可用性判定的唯一硬证据**:

```
Bash(command="node <PLUGIN_ROOT>/scripts/notebooklm.mjs --op check --json", timeout=30000)
```

返回 stdout JSON 包含 `"installed": true` 且 `"authenticated": true` 且 `notebooks` 非空 = NLM 可用。**绝对不许** 凭其他间接信号判定 NLM 不可用:
- ❌ 看到 rookiepy 提 cookie 失败 · 推断"NLM 整体不可用"(可能只是浏览器没登录 Google · refresh-auth 会引导用户登录)
- ❌ 凭"我记得这个机器没装 notebooklm" 判断
- ❌ Phase 4 想调 NLM 前没先做 --op check · 直接跳 NLM 走 仅案例
- ❌ `notebooklm` 某个子命令偶发失败 · 推断整体不可用
- ✅ 唯一判定:`notebooklm.mjs --op check --json` stdout 含 `installed:true + authenticated:true + notebooks 非空`

**返回判定表**:

| `--op check` stdout JSON | 处理 |
|---|---|
| `{"installed": true, "authenticated": true, "notebooks": {<非空>}}` | ✅ **静默** · 把 task 1 子项 `NotebookLM 知识库连通性` 标 `✔`(update task content)· **不打 chat 文字**("NLM 增强已就绪 / N 篇文档" 一律不许) · 进 Phase 1 |
| `{"installed": false, ...}` (`notebooklm --version` 不通) | 🟡 软告警:"NLM 未安装 · 主诊断流程不影响 · 但 案例 未覆盖现象将无法用 NLM 兜底。可跑 `/perf-kp-sql-setup` 安装 · 或现在跳过。" 进 Phase 1 (skip-NLM 模式) |
| `{"installed": true, "authenticated": false, ...}` (cookie 过期) | 🔴 触发"NLM 重登录流程"(详见下方 #NLM-relogin) · 等用户登录后重 check · 再进 Phase 1 |
| `{"installed": true, "authenticated": true, "notebooks": {}}` (notebook 没注册) | 🟡 软告警:"NLM CLI 已装但未注册 notebook · 跑 `/perf-kp-sql-setup` 创建。" 进 Phase 1 (skip-NLM 模式) |
| Bash spawn 失败 / 超时 / stdout 不是合法 JSON | 🟡 软告警 + skip-NLM 模式 + 进 Phase 1 |

#### NLM-relogin · 鉴权失败恢复流程(可被 Phase 0.10 / Phase 4.* / Phase 6 调用)

cookie 过期时的恢复路径 · 全程走 rookiepy + 系统浏览器：

```
Bash(command="node <PLUGIN_ROOT>/scripts/notebooklm.mjs --op refresh-auth --json", timeout=30000)
```

**两类鉴权失败信号(触发本流程)**:

| 信号 | 含义 |
|---|---|
| `--op check` 返回 `authenticated: false` | 本地 cookie 文件缺 / 格式坏 / cookie 全部过期 |
| `--op query` / `--op query-batch` 返回错误含 `Authentication expired or invalid` / `redirected to accounts.google.com` | Google 侧 session 过期 |

**返回判定**:

| `refresh-auth` 返回 | 处理 |
|---|---|
| `{"ok": true, "method": "rookiepy_auto"}` | ✅ 静默恢复成功 · 用户无感 · 继续流程 |
| `{"ok": false, "need_browser_login": true, "browser_opened": true}` | 已打开浏览器 · 提示用户登录 · stop wait |
| `{"ok": false, "need_browser_login": true, "browser_opened": false}` | 浏览器没打开 · 给 URL 让用户手动打开 · stop wait |

**提示用户的话术**(need_browser_login 时):

```
我已经打开了浏览器 · 请在浏览器里登录你的 Google 账号。
登录完成后告诉我 · 或回复"跳过"走 仅案例 模式。

支持的浏览器: Chrome / Edge / Firefox / Safari / Brave / Arc / Vivaldi / Opera
```

stop and wait for next turn。

**用户确认登录后** · 再调一次 refresh-auth:

```
Bash(command="node <PLUGIN_ROOT>/scripts/notebooklm.mjs --op refresh-auth --json", timeout=30000)
```

- 成功 → 公告"NLM 已恢复" → 继续被中断的流程
- 仍失败 → 问用户"跳过 NLM 走 仅案例？" · 不阻断主流程

mark task 1 (环境信息采集) completed → mark task 2 (诊断案例匹配) in_progress → 进 Phase 1 对话引导。

---

## Phase 1 · 对话引导(问题现象采集)

**前置**:Phase 0 已收齐凭据 + 连通性 OK + 拿到 `[环境上下文]`。

**目标**:用环境上下文化的对话 · 采集用户的问题现象(或确认走巡检模式)· 不收齐不进 Phase 2。

### 1.1 · 看用户在 Phase 0 之前给了啥

| 用户首条消息 | 处理 |
|---|---|
| 已含问题现象(例:"我们鲲鹏 mongo cpu 一直 90%+") | 直接进 Phase 2 · 不重复问 |
| 只给凭据没给现象描述 | 走 1.2 双问 |
| `/perf-kp-sql` 无任何文本 | 走 1.2 双问 |

> **术语**:Phase 1 给用户的提示语里 · 用"现象描述"这种自然中文复合词没问题(比"问题现象描述"更顺) · 但内部坐标 / 总结性表述统一用主词"问题现象"。

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

### 1.3 · 现象描述收齐后

- 描述清晰 → 进 Phase 2 诊断案例匹配
- 描述模糊("我感觉慢" / "想做体检" / "新机上线想审")→ 进 Phase 3.B 巡检模式(BP 全量审计)· 跳过 Phase 2
- 用户描述仍含糊但隐含具体方向 → Phase 2 内部命中 · 用户视角无感

mark task 2 (诊断案例匹配) in_progress(或巡检模式时直接跳到 task 3 诊断指标采集 in_progress)。

---

## Phase 2 · 诊断案例匹配

**目标**: 把用户描述的现象 / 日志 / 火焰图 → 命中 cases/INDEX.md 里的 case_id 列表。

⚠️ **强制约束**:Phase 1 收完用户问题现象后 · LLM 的**下一个动作必须是 2.1 Read cases/INDEX.md**。**绝对不许**:
- 跳过 Phase 2 直接进 Phase 3 写采集命令(LLM "我直接写更快 · 何必查 案例" 偏见 · 严重 bug)
- 跳过 2.1 Read 索引 · 凭记忆猜 case_id
- 跳过 2.3 Read 单 case 完整字段 · 凭印象写 collection_method
- 卡在"先采当下快照"这种话头上不进任何动作 — 必须立即 Read INDEX

### 2.1 · 加载索引(Phase 1 完成后立即执行 · 不许跳)

```
Read(file_path="<PLUGIN_ROOT>/data/cases/INDEX.md")
```

(~6.4K tokens · 一次性进 LLM context)。**这是 Phase 1 → Phase 2 之间的强制动作 · 跳了就是 bug**。

INDEX 含两段:
- **diagnostic-flow (96)**: 列 case_id + symptom_category + title + 案例 line
- **flame-signature (13)**: 列 case_id + title + pattern_regex + 案例 line

### 2.2 · LLM 匹配

输入:用户描述的现象(中文 / 英文)+ 可选火焰图数据(perf script 文本 / SVG 路径)。

匹配策略:
- **DF 路径**:用 symptom_category 锚点(11 类:cpu-high / disk-io-saturation / memory-pressure / query-slow / lock-contention / replica-lag / connection-storm / network-latency / startup-failure / disk-space-pressure / other)做粗分 · 再用 title 语义比对收窄
- **Flame 路径**:用户提供 perf script → LLM 用 INDEX 里 `pattern_regex` 匹配热点函数 → 命中走 Flame case 确认 · 同时跑 DF 路由(双源 · 互不影响)

**LLM 内部**输出候选 case_id 列表(in-memory · 不暴露给用户)。**收敛规则**(团队定):

| 内部命中数 | 处理 |
|---|---|
| 1 | 直接 case 确认 → 进 2.3 |
| **2-3** | **直接停止收敛 · 全部确认 → 并行进 2.3 拿这 N 个 case 完整字段** · 不再追问用户区分(多 case 一起诊断完全可行 · Phase 3 采集 metric 合并去重 · Phase 4 分别推断) |
| 4+ | LLM 简短追问 1-2 个最有区分度的问题(例:"是单机还是副本集?" / "现象是持续性还是间歇尖峰?")· 收敛到 ≤ 3 个 → 进 2.3 |
| 4+ 收窄追问累计 ≥ 5 轮仍 > 3 个 | 强制收口 · 取 LLM 当前认为最可能的 3 个 → 进 2.3(不再纠缠) |
| 0 | nothing 模式 → 跳过 2.3 · 进 Phase 3.B(BP 巡检) |

**Phase 2 给用户呈现什么**(对外 UX):

LLM 在前期**只负责引导提问 · 范围收敛 · 不暴露内部数据**。具体:

| 用户视角 | LLM 内部 |
|---|---|
| 看到:"开始拉数据" | 内部已收敛 ≤ 3 个 case · 准备 Phase 3 metric |
| 看到:"先问一个问题:是单机还是副本集?" | 内部:这一问能砍掉 X 个 case 候选 |
| **看不到**:case_id 字面 / 案例 内部分类名 / 候选概率 / 准备拉哪些命令 | 内部:这些都是诊断引擎细节 · 用户只关心"问题是啥 · 怎么修" |

**绝对禁止**(违反就是 bug):
- 给用户列 `case_id` 字面值(`kunpeng-nohz-clock-tick-overhead-03` / `mongo-tcmalloc-percpu-caches-not-enabled-01` 等)
- 给用户列内部概率("45% / 35% / 20%" / "置信度高/中" 等)
- 给用户列"我准备拉这些指标"清单(`db.serverStatus().wiredTiger.cache` / `top -H` 等)— 用户给凭据后我自己 SSH 拉就行 · 用户不需要知道 metric 名
- 给用户展开 案例 内部 symptom_category 11 类清单 / case_pattern / scope 这些内部分类名
- 列"我能诊断的所有问题类型"清单 · 引诱用户认领 — 引导式追问应当从用户描述出发
- 罗列"我已经排除了 X / Y / Z"长 bullet — 用户不关心你内部排除了啥 · 直接给追问问题或开始 SSH

**收敛硬约束**:
- "≤ 3 个就停" — 不为"收敛到 1 个"无限追问。多 case 并行诊断是 Phase 3-5 标准能力。
- "追问 ≤ 5 轮" — 5 轮还收不到 3 个以下 · 强制带 3 个进 Phase 3。
- LLM 看似只问 1-2 个引导问题 · 然后说"开始拉数据" · 内部所有 case 收敛 / metric 准备都不暴露给用户。

### 2.3 · 加载单 case 完整字段

case 确认后,从 INDEX 拿到 `案例 line` 行号:

```
Read(file_path="<PLUGIN_ROOT>/data/cases/CASES.md", offset=<line>, limit=100)
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

mark task 2 (诊断案例匹配) completed → mark task 3 (诊断指标采集) in_progress。

> **进入 Phase 3 时**:必须把 task 3 content 字段更新成带 2 个层的子结构 ·
> ```
> 3. 诊断指标采集
>     ⏳ 操作系统层:CPU / 内存 / 磁盘 / 网络
>     ⏳ MongoDB 层:连接池 / 慢查询 / 锁竞争 / 存储引擎
> ```
> 详见上文 "Task tracking pattern" 段。子项进度切换 = update task content · 不创建子 task。

---

## Phase 3 · 诊断指标采集

**目标**: 从命中 case 提采集命令 · SSH 批量采集指标 → 落盘 collect 文件。

⚠️ **采集只采不诊断**(硬约束):Phase 3 全程**只做采集**。chat 通道**完全静默任何分析性陈述** —— 不许打 metric 数值、不许打案例匹配状态、不许打阈值对比、不许打因果推断、不许打"是否是根因 / 看起来正常 / 已排除"等判断词汇。**采集到的所有事实在 Phase 3 内部记忆中持有 · 一律留到 Phase 4 才开始判读**。允许的 chat 输出只有:`[3. 诊断指标采集 · ...]` narration 行 + task list 状态切换 + Bash 调用 + 必要的错误提示。如果 Read 完两份 collect 文件后想说"我看到 cache_used=94% 接近阈值" —— **立刻停**,这是 Phase 4 的事。

⚠️ **强制约束**:Phase 3 的 SSH 采集命令**必须来自 Phase 2.3 Read 拿到的单 case 完整字段里的 `collection_method_quote`** · 不允许 LLM 凭印象 / 经验 / 通用 ops 知识自己拍命令。具体:

- ❌ LLM 自己写 `top -b -n 1 -H -p $(pgrep mongod)` / `vmstat 1 5` / `mongostat --eval ...` 等通用命令 · 即使看起来"更快更全"
- ❌ "先采当下快照看看 CPU 是不是真的在烧" 这种自由发挥 · 跳过了 案例
- ✅ Read 命中 case 的 案例 段 → 抽 `collection_method_quote` 字面 → 适配 [环境上下文] 占位符 → 直接用
- ✅ 案例 命令是诊断案例资产的一部分 · 跟 case 的 `abnormal_pattern_threshold` / `likely_causes` 配套 · 自己拍命令 = Phase 4 诊断时找不到对应阈值 = 报告里没 [参考N] 引用 = 案例库价值清零

如果 Phase 2 命中的 case 在 案例 里没给具体 `collection_method_quote`(部分 case 是描述性的)· 才允许 LLM 基于 case `metric_name` 写最小命令 · 但**必须先读完 case 字段确认这一点 · 不是偷懒跳过**。

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
       --process=mongod --type=oncpu --duration=3 --engine=mongo \
       --local-svg-out=/Users/<yourlogin>/.perf-kp-sql/runs/<TS>/flame.svg")
```

**`--local-svg-out` 说明**:wrapper 在 capture.mjs 跑完后会自动从远端 scp 把 SVG 落到本地指定路径(复用 ssh.mjs 已建的 ControlMaster · 不重新 auth)。如果 scp 失败(socket 过期 / 路径异常 / password 模式 ControlMaster 复用不上) · stderr 会打远端 SVG 路径 · LLM 可以手动 `scp` / `mv` 兜底。

**`--duration` 硬约束**:诊断场景**固定 3s** · `99 Hz × 3s ≈ 297 个采样` 已足够命中 stack-pattern。**禁止擅自拉到 5/10/30/60s** — 30s/60s 这种长窗口会显著扰动生产 mongod · 数据量随时长线性增长 · 还可能顶到 ssh.mjs 的 timeout。

wrapper 已在脚本侧硬 clamp:
- 没传 `--duration` → 默认注入 `--duration=3` 并打印提示
- `--duration > 10` 且未加 `--allow-long-duration` → **直接 exit 2 拒绝** · 报错 JSON 含原值/上限/解释
- 真需要长窗口(用户**明确要求** / off-cpu 长尾分析) → 加 `--allow-long-duration` 显式 opt-in · 并在报告里说明理由

**❌ 反例 · LLM 自由发挥拉到 30s**:
```
... --process=mongod --type=oncpu --duration=30 --engine=mongo")
```
narration 写"开始拉指标 + 30s 火焰图(并行)"。**违规** — wrapper 会拒绝;就算让它过(凭 `--allow-long-duration`) · 也是给生产 mongod 加 10× 干扰、产 10× 数据量、用户白等 27s · 完全不必要。诊断默认 3s 已经够命中 stack-pattern。

(`capture-flamegraph.mjs` 是 wrapper · 内部自定位**姐妹 skill `cpu-flamegraph`** 后透传给 ta 的 `scripts/capture.mjs` 真正干活 · 跨 harness 兼容 · 依赖关系详见 Architecture 段「外部依赖」)

3.A.4 · **按层拼 cmd 文件 · 操作系统层 + MongoDB 层各一次 SSH** · 落到 run 目录:

> **为什么按层拆**:run 目录里要看到 `collect-os.txt` 和 `collect-mongo.txt` 两个文件 · 用户 / 后续诊断回看时一眼能区分。task list 子结构(操作系统层 / MongoDB 层)也跟这两个文件一一对应 · 子项进度 = 这一层的 SSH 调用是否完成。

**操作系统层采集**(`collection_layer=os` 的 metric · CPU / 内存 / 磁盘 / 网络):

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt", content="<OS 层合并命令字面>")
Bash(command="node <PLUGIN_ROOT>/scripts/ssh.mjs --op exec \
       --host <ip> --user <user> [--privateKeyPath <path> | --password '<pw>'] [--port <n>] \
       --command-file /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt \
       --output-file /Users/<yourlogin>/.perf-kp-sql/runs/<TS>/collect-os.txt", timeout=120000)
```

OS 层完成 → task 3 子项 `操作系统层` 标 `✔` · 子项 `MongoDB 层` 切 `⏳` (update task content)。**不许打 chat 文字** "OS 层完成" / "等其它层" 等子项状态描述 · task tool UI 已经显示 ✔/⏳ 进度。

**MongoDB 层采集**(`collection_layer=mongo-shell` / `mongo-runtime-cmd` / `log-grep` 的 metric · 连接池 / 慢查询 / 锁竞争 / 存储引擎):

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt", content="<MongoDB 层合并命令字面>")
Bash(command="node <PLUGIN_ROOT>/scripts/ssh.mjs --op exec \
       --host <ip> --user <user> [--privateKeyPath <path> | --password '<pw>'] [--port <n>] \
       --command-file /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt \
       --output-file /Users/<yourlogin>/.perf-kp-sql/runs/<TS>/collect-mongo.txt", timeout=120000)
```

MongoDB 层完成 → task 3 子项 `MongoDB 层` 标 `✔`。**不许打 chat 文字** "MongoDB 层完成" / "Mongo / Os / 火焰图三段都完了 / 等其它通知" 等。

> **每条 cmd 文件用完后**:同一 `cmd-<TS>.txt` 路径直接覆写复用即可 · 它是临时文件 · 不进 run 目录归档。

3.A.5 · LLM Read 两个采集文件 → 解析 metric → value 映射 (in-memory · 静默):

```
Read(file_path="/Users/<yourlogin>/.perf-kp-sql/runs/<TS>/collect-os.txt")
Read(file_path="/Users/<yourlogin>/.perf-kp-sql/runs/<TS>/collect-mongo.txt")
```

⚠️ **Read 完后立即进 Phase 4 · 不许在 chat 出任何分析**:Phase 3 头部"采集只采不诊断"约束在 3.A.5 同样生效。Read 拿到 metric 文本只是**预读**,所有 metric→value 解析、案例阈值对比、根因初判**全部留到 Phase 4 阶段 1 案例直判**。3.A.5 之后下一个 chat 文本应该是 Phase 4 的 narration `[4. 多源综合诊断 · 案例库 + NotebookLM 联网知识库]` · 不是任何观察 / 描述 / 推断陈述。

### 3.B · nothing 模式(Phase 2 命中 0 · 用户现象描述模糊)

3.B.1 · 加载 BP 索引:

```
Read(file_path="<PLUGIN_ROOT>/data/best-practice/INDEX.md")
```

(~6.0K tokens · 含 case_id + scope + title + 案例 line)。

3.B.2 · 按 scope 分组采集对应参数(每条 BP 的 `related_param_names` + `detection_layer`)· **同样按操作系统层 / MongoDB 层拆两次 SSH** · 输出文件落 `~/.perf-kp-sql/runs/<TS>/collect-os.txt` / `collect-mongo.txt`(同 3.A.4 模板):

scope 分布(典型):
- linux-mm (12) · vm.swappiness / dirty_ratio / THP / hugepages
- linux-net (X) · sysctl net.* / 连接 backlog
- linux-block (X) · scheduler / nr_requests / read_ahead_kb
- storage-engine-wt (X) · WT cache size / eviction triggers
- mongodb-config (X) · journal / oplog / replSetConfig
- ...(详见 INDEX 完整列表)

3.B.3 · 拼合并 cmd → 按层 SSH 各一次 → Read 解析(同 3.A.4 / 3.A.5 模板)。

mark task 3 (诊断指标采集) completed(全部子项 ✔)→ mark task 4 (多源综合诊断) in_progress。

---

## Phase 4 · 多源综合诊断

**目标**: 把 Phase 3 采集结果跟 case 阈值 / NotebookLM 答案多源综合对照 → 输出"确认根因"列表。

⚠️ **根因来源强约束**(LLM 历史多次发散 · 必须钉死):

进主诊断表的根因 · **默认要求 案例 + NLM 双源** — 案例 阶段命中给"是不是该 case"· NLM 阶段确认"现在是否仍如此 + 最新修复建议"。两个来源必须能逐条溯回 stdout / Read 输出:

1. **案例 来源**:case_id verbatim 来自 Phase 2.3 Read 出的 CASES.md 单 case 字段(DF `likely_causes[]` / Flame `mechanism_quote`)· `[参考N (案例)]` 用 case 的 `source_url` 字段
2. **NLM 来源**:NLM 调用(Phase 4.A 阶段 2 单条 query / Phase 4.B BP batch / Phase 6 追问)返回的 `answer` + `references` · `[参考N (NLM)]` 用 NLM 返回的 `references[].source_id`

**双源默认 · 单源是降级**(详见 Phase 4.A 阶段 3 综合判定表):

| 场景 | 主表 | 参考来源列 |
|---|---|---|
| 案例 偏离 + NLM 确认 | ✅ 进表 · 置信度高 | 案例 + NLM 双 [参考N] |
| 案例 threshold=NULL + NLM 给答案 | ✅ 进表 · 置信度中 | 仅 NLM [参考N] |
| 案例 偏离 + NLM 不可用(check / relogin 失败) | ✅ 进表 · 置信度中 · 报告头标 "⚠️ NLM 不可用" | 仅 案例 [参考N] |
| 案例 偏离 + NLM 否认 | ❌ 不进主表 · 移现场观测段 | — |
| 案例 没覆盖 + NLM 答得出来 | ✅ 进表 · 置信度中 | 仅 NLM [参考N] |
| 案例 没覆盖 + NLM 也答不出 | ❌ 不进主表 · 移现场观测段 | — |

为什么不"案例 命中就够"· 还要加 NLM 二次确认:CASES.md 是团队蒸馏快照(每月 / 每季度更新)· 可能落后官方文档最新指导(典型例:THP 在 MongoDB 8.0+ 反过来推荐 always)· 即使 threshold 命中 · 具体修复手段可能已变。NLM 是 Google 检索系统 · 拉的是当前最新文档 references 是真实链接 — 案例 + NLM 双源 = 团队判断 + 官方现状交叉验证。

**关键反例**(LLM 历史犯的错):

- ❌ 凭训练数据知识写根因(`mongod tcmalloc 碎片是常见问题` · 没调 NLM 也没 案例 Read)
- ❌ 编一个 case_id(`bp-mongo-where-cpu-01` 这种 案例 没有 / NLM 没返回的)
- ❌ 把 案例 多个 case 的字段拼一起编一个新根因
- ❌ Phase 3 现场采到现象(\$where 烧 CPU)· **直接写进表**不调 NLM · 凭印象描述 + 编 URL

✅ **正确做法 · 现场采到 案例 没覆盖的现象**:
- Phase 4 时给该现象**单独发一条 NLM query** · 例如:`"MongoDB \$where JS 查询的性能影响 + 推荐做法?"`
- 拿到 NLM answer + references · 现在这个根因有了可信源 · 可以进表
- `参考来源` 列写 `[参考N]` · URL = NLM 返回的 `references[].source_id`(verbatim · 不许编)
- 置信度: 中(NLM 兜底)

**自检规则**(写完根因列表 LLM 必须自检):
- 每个根因都能逐条说出来源:
  - "case_id=X · 案例 命中 · 来自 Phase 2.3 Read line=Y · likely_cause N" · 或
  - "case_id=Y · BP 命中 · 来自 Phase 4.B NLM batch result" · 或
  - "现场根因 X · NLM 命中 · 来自 Phase 4.A 单条 query 返回 / Phase 4.X 临时兜底 query 返回 · references[i].source_id=URL"
- 不能溯源的根因 → **不进主诊断表** · 移到 Phase 5.2 报告的 `## 现场观测(无权威来源)` 独立段 · 标"请独立验证"
- 不许 "我训练数据里见过这个问题" 当来源 — 不算
- **特别强调**:Phase 3 现场采到的根因(\$where 烧 CPU / 异常 query 等)· 如果 NLM 不可用 · **必须先走 NLM-relogin 流程**(详见 Phase 0.10 #NLM-relogin) · 不许直接放弃 NLM 兜底然后把根因塞主表。NLM 真的连不上(用户拒绝重登录 / 重登录后仍失败)· 才允许走"现场观测"独立段。

**为什么 案例 和 NLM 都算可信 · 但 LLM 自己写不算**:
- CASES.md 是团队蒸馏的 cases · 来自权威文档 · 有 source_url 链接验证
- NLM 是 Google 检索 + Gemini 生成 · 答案绑定 references[].source_id 真实文档
- LLM 训练数据里的"常识" · 用户没法点开链接验证 · 也可能过时(MongoDB / kernel 持续更新)
- 报告"确认根因"是用户决策依据 · 必须有可点开的权威背书 → 案例 / NLM 都满足 · LLM 自由发挥不满足

分两条路径(对应 Phase 3.A / 3.B):

### NLM 调用统一错误处理(Phase 4.* / Phase 6 都遵守)

任何 `notebooklm.mjs` 调用(query / query-batch)返回鉴权失败信号时 · LLM 必须:

1. **触发 NLM-relogin 流程**(详见 Phase 0.10 #NLM-relogin 段)· 调 `--op refresh-auth` 自动恢复(rookiepy 重提 + 系统浏览器兜底) · stop wait
2. 用户登录确认后 · 重新跑被中断的 NLM 调用
3. 重试仍失败 → 问用户"再试 / 跳 NLM 走 仅案例 / 中止"

**鉴权失败信号识别**:
- stdout JSON 含 `"error": "auth_expired"` / `"error": "unauthorized"` / `"error": "cookie_invalid"` 等
- stderr 含 `401` / `403` / `Authentication failed` / `cookie expired` 等
- spawn 返回 exitCode != 0 且 error message 跟鉴权相关

**非鉴权失败**(网络超时 / API 限流 / NLM 服务侧 5xx)→ skip 当前 NLM call · 继续主流程 · 在报告里标"NLM 当前不可用 · 部分根因走 仅案例"。

**❌ 反例 · LLM 自助 retry**:
```
⏺ NLM chat 超时(不是鉴权)。重试一次。

  Bash(node /.../notebooklm.mjs --op query --domain mongo --query "..." )
```
LLM 自己写"超时 · 重试一次"narration · 然后再发同 query。**违规** · 几条理由叠加:
1. SKILL.md 明文 "非鉴权失败 → skip + 仅案例" · 没有"先重试一次再 skip"这一档 · LLM 在加 spec 里不存在的逻辑
2. NLM 单次 query timeout 已经 60s · retry 一次再耗 60s · 用户白等 2 分钟 · 而 timeout 通常说明上游正在退化 · retry 命中概率不高
3. 跟 30s 火焰图 / chat 输出字段竖排是同一类 LLM 偏见——"加点工程感"(retry / 长采样 / 友好叙述) · 但每一个都是在 spec 之外自由发挥
4. 真要 retry 这件事是政策决定 · 该写进 SKILL.md 由 spec 表达 · 不该 LLM 在运行时自己决定

**正解**:非鉴权超时 → 直接 skip 当前 NLM call · narration 用一句"NLM 当前不可用(非鉴权类失败) · 该根因走 仅案例" · 不再发同 query。

**为什么"重试看上去合理"也不许 LLM 自决**:retry / 长采样 / 友好叙述这些都看上去是好工程,但**SKILL.md 没写 = 不该做**。如果实证发现"NLM 短暂超时占多数 · retry 命中率高"· 该走的路径是改 SKILL.md(把 retry 加进 spec) · 而不是 LLM 在每个 session 里自己决定加。"政策决定写在 spec · LLM 只执行" 是这套 skill 的硬边界。

### 4.A · DF / Flame 路径(逐 step / 逐 case 处理)

⚠️ **双阶段强制**:每个候选根因必须先经 案例 阶段判定为"偏离"· 再经 NLM 阶段二次确认 + 求建议。**仅案例 单源不许进主诊断表**(NLM 不可用降级路径除外 · 详见末尾)。

#### 阶段 1 · 案例 直判(拿候选)

对每个命中 case 的每个 diagnostic_step:

**有 `abnormal_pattern_threshold` (精确)**:
- LLM 直接对比 [采集值] vs [threshold]
- 偏离 → 该 likely_cause 入"候选根因"列表(通过 `linked_diagnostic_step_no` 关联)
- 正常 → 排除该 cause · **不进阶段 2**(明确正常的没必要 NLM 二次确认 · 避免无谓延迟)

**无 threshold (NULL · 描述性文字)**:
- 案例 阶段无判定能力 → 直接进阶段 2 · 由 NLM 给初步答案 + 现场指标对照判定

#### 阶段 2 · NLM 二次确认 + 求建议(对每个候选根因强制 · 即使 案例 threshold 已命中)

⚠️ **多个候选根因的 NLM query 必须同 message 并行 Bash**:把 N 个 `notebooklm.mjs --op query` 调用放进**同一个** assistant message 的 N 个 Bash content block · 不许"发一条 → 等返回 → 再发下一条"的串行模式。串行 N 条 ≈ N × 单 query RTT(60-120s)· 并行 ≈ 1 × 单 query RTT。实测对比:2 query 串行 ~240s · 并行 ~120s · 省 50%。

⚠️ **进度通过 task content 子项表达 · chat 通道完全静默**:发起 N 条 NLM query 时 · 把 task 4 (多源综合诊断) content 子项 `NotebookLM 知识库查询` 标 `⏳ (0/N)`。每条 query 后台返回(harness task-notification)→ update task content 把计数推进到 `(M/N)`。N 条全完成 → 子项标 `✔`。

**绝对不许打 chat 文字**(典型违规):
- ❌ "3 条 NLM query 后台并行跑(每条 ~30-90s)。等通知"
- ❌ "Query 1 完成。等其它两条。"
- ❌ "Query 2 完成。等 query 3。"

进度全靠 task tool UI 表达 · 用户在 spinner 旁边能看到 `NotebookLM 知识库查询 (M/N)` · 不需要 chat 再重复一遍。

⚠️ **为什么强制**:
- CASES.md 是团队蒸馏快照(每月 / 每季度更新)· 可能落后 MongoDB / kernel / kunpeng 官方文档最新指导
- 即使 threshold 命中 · 修复手段(参数值 / 命令 / 配置语法)可能已变(典型例:THP 在 8.0+ 反过来推荐 always)
- NLM references 是真实文档链接 · 跟 案例 source_url 互为交叉证据 → 报告"参考来源"列同时挂 案例 + NLM 两个 [参考N] · 用户能双源验证

构造 NLM 查询(LLM 拼 · 模板 A:案例 阶段已命中 → 求确认 + 最新建议):

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-nlm-q-<TS>.txt", content="<查询字面>")
```

> [环境:OS=<distro>, CPU=<model>, MongoDB=<version>, deploy=<form>]
> 现场观测:[step.metric_name] = [采集值] (案例 阈值 [threshold] 判定为偏离)。
> 案例 case [case_id] 描述:[case.symptom_description / abnormal_pattern_quote 节选]。
> 案例 给的 mitigation:[likely_cause.reasoning_quote / mitigation_quote 节选]。
>
> 请回答两点:
> 1. 这是否仍是该现象的根因?(是 / 否 / 部分 — 给理由)
> 2. 当前最新的修复建议是什么?(具体命令 / 配置 / 文档链接 · 优先于 案例 节选)

模板 B(案例 阶段无 threshold · NLM 拿初步答案):

> [环境:OS=<distro>, CPU=<model>, MongoDB=<version>]
> 现场观测:[step.metric_name] = [采集值]。
> 上下文:[case.symptom_description]。
>
> 请回答两点:
> 1. 该指标的正常范围 / 异常判定标准是什么? 当前值是否异常?
> 2. 如异常 · 当前最新的修复建议是什么?(具体命令 / 配置 / 文档链接)

调:

```
Bash(command="node <PLUGIN_ROOT>/scripts/notebooklm.mjs --op query \
       --domain auto \
       --query \"<查询字面>\" \
       --json", timeout=300000)
```

#### 阶段 3 · 综合判定

| 案例 阶段 | NLM 阶段 | 结论 | 置信度 | 报告"参考来源"列 |
|---|---|---|---|---|
| 偏离 | 确认 + 推荐与 案例 一致 | 确认根因 | 高 | 案例 [参考N] + NLM [参考M] |
| 偏离 | 确认 + 推荐与 案例 不同(更新版本) | 确认根因 · 用 NLM 推荐 + 报告标注 "案例 节选可能已过时,以 NLM 引用为准" | 高 | 案例 [参考N] + NLM [参考M] |
| 偏离 | 否认(不像该 case) | 移到 `## 现场观测(无权威来源)` 段 · **不进主表** | 低 | 不进主表 |
| 偏离 | NLM 不可用(check / refresh-auth 失败) | 进主表 · 但报告头加一行 `⚠️ NLM 不可用 · 本次无 NLM 二次确认 · 请独立验证修复建议` | 中(案例 单源降级)| 仅 案例 [参考N] |
| NULL | NLM 给答案 + references | 进主表 | 中(NLM 单源)| 仅 NLM [参考M] |
| NULL | NLM 不可用 | 不进主表 · 移到现场观测段 | — | 不进主表 |

报告 `建议措施` cell 5 标签使用:
- 案例 推荐 → `[CASE]`
- NLM 同意的部分 → `[NLM]`
- 案例 与 NLM 不同时 · 写"NLM 推荐(以此为准): xxx [NLM]"<br>"案例 节选(可能过时): yyy [CASE]"

Flame case 同 DF · 用 `mechanism_quote` 替代 `likely_causes` 描述。

**性能预期**:阶段 2 每个候选根因发 1 条 NLM query · 单 query timeout 60s · 平均 RTT 30-60s。**多个 query 必须同 message 并行**(见阶段 2 标题下硬约束)· 并行后 Phase 4 累计 NLM 时长 ≈ 单 query 最坏耗时 60-120s · 不随候选根因数量线性增长。比 4.B 巡检模式(7 min / 93 BP)短得多 · 是合理代价。

### 4.B · best-practice 巡检(全量经 NLM)

**设计书强制**: 对每个 BP 一律喂 NLM 刷新最新推荐(决策 2 d')。NLM 不可用时退化为 仅案例(报告标记 NLM 缺失)。

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
    "case_recommendation": "1",
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
| 案例 值 + NLM 一致 + 采集值偏离 | 确认问题 | 高 |
| 案例 ≠ NLM | 以 NLM 为准(警告 案例 过时)| 中 |
| 采集值符合两者推荐 | 正常 · skip 不进报告 | — |

mark task 4 (多源综合诊断) completed → mark task 5 (报告生成) in_progress。

---

## Phase 5 · 报告生成

### 5.1 · 汇总根因 + 排序

按风险等级(`risk_severity`):high → warning → info。

### 5.2 · 写 markdown 报告

设计书 §6.1 单层 6 列表 · 报告骨架:

#### 表格单元格 `<br>` 换行规范(终端渲染必需)

Claude Code / ohsql 终端宽度通常 80-120 列。6 列 pipe table 如果单行超过终端宽度 · 渲染器会降级成"字段: 值"竖排卡片 · 表结构丢失。

**强制规则**:每个单元格内容**必须用 `<br>` 拆成多个短行** · 每行显示宽度 ≤ 20 个字符(CJK 算 2 宽)。具体:

- **确认的根因**:≤ 20 字符/行 · 用 `<br>` 断
- **判定依据**:每个证据点一行 · `<br>` 分隔 · 每行 ≤ 20 字符
- **建议措施**:止损 / 长期各一行 · 命令单独一行 · 命令可适当长(终端会自动折行)但前缀文字要短
- **风险等级 / 置信度 / 参考来源**:本身短 · 不需要 `<br>`

**示例**(正确):
```
| 确认的根因 | 判定依据 | 建议措施 | 风险等级 | 置信度 | 参考来源 |
|---|---|---|---|---|---|
| WT eviction<br>dirty_target<br>与负载不匹配 | cache used=94.7%<br>接近阈值 95%<br>dirty ratio=18%<br>远超 target 5% | 调低 target=3%:<br>`db.adminCommand(…)` | high | 高 | [参考1] |
| vm.swappiness<br>过高 | 当前值=60<br>案例 推荐=1<br>NLM 确认=1 | `sysctl -w`<br>`vm.swappiness=1`<br>写入 sysctl.conf | warning | 中 | [参考2] |
```

**反例**(错误 · 会触发竖排降级):
```
| eviction_dirty_target 与业务负载不匹配 | cache used=94.7% 接近阈值95% + dirty ratio=18% 远超 target 5% | 调低 eviction_dirty_target=3%:`db.adminCommand({setParameter:1, wiredTigerEngineRuntimeConfig:"eviction_dirty_target=3"})` | high | 高 | [参考1] |
```
(单行 549 显示字符 · 远超 80 列终端 · 必然降级)

#### 5 标签来源标记(强制)

每份报告**必须**带一段 `## 来源标记 (debug)` legend(放在报告元数据后、`## 诊断结果` 前 · 见骨架),并在正文每个**原子事实**末尾挂 1 个 5 选 1 标签:

| 标签 | 触发(严格) |
|---|---|
| `[IDX]` | case_id 命中、现象→case 归类、tier 标签 |
| `[CASE]`  | likely_causes / mechanism_quote / abnormal_pattern_threshold / source_url / 诊断命令本身 — 来自 cases/CASES.md 或 best-practice/CASES.md 字段 verbatim |
| `[NLM]` | NotebookLM stdout JSON 的 references[].source_id 或答复正文 |
| `[OBS]` | Phase 3 SSH 命令 stdout 提取的实测值(cache used=94.7% / vm.swappiness=60 之类) |
| `[LLM]` | 模型自由推断 · 连接性叙述 · 排序与汇总 — 上面 4 类均无兜底时**必挂** |

**核心规则**:每个原子事实(一个不可再分的断言:实测值 / 阈值 / 比较结论 / 一条命令 / 一个判定)**有且只有 1 个**标签 · 5 选 1 · 不允许联合标签(`[OBS+案例]` 禁止) · 不允许漏挂(凡是模型自由发挥都挂 `[LLM]`)。

**多源拆句**:如果一句话/一行混了两类来源(例 "cache=94.7%(OBS)接近阈值 95%(案例)"),**必须拆成两个原子**,各挂各的标签:
```
cache used=94.7% [OBS]<br>接近阈值 95% [CASE]
```

**`[参考N]` 角标共存**:`[参考N]` 是脚注引用 · 不算来源标签 · 可与 5 标签共存:
```
cache used=94.7% [OBS][参考3]
```

**正例**(诊断依据 cell · 4 个 `<br>` 行 · 每行一个原子 · 各挂标签):
```
cache used=94.7% [OBS]<br>接近阈值 95% [CASE]<br>dirty ratio=18% [OBS]<br>远超 target 5% [CASE]
```

**反例 1**(漏挂):
```
cache used=94.7%<br>接近阈值 95%<br>dirty ratio=18%<br>远超 target 5%
```
↑ 全没挂 · `format-chat.mjs` 会把整 cell 4 行都计为 missing · 漏挂率 100% · exit 2 强制重写。

**反例 2**(联合标签):
```
cache used=94.7%<br>接近阈值 95% [OBS+案例]
```
↑ `[OBS+案例]` 不存在 · 必须拆成两行各挂各的。

**风险等级 / 置信度** 列内容本身就一个词(`high` / `高`),cell 末尾挂 `[LLM]`(主观判定):
```
| ... | ... | ... | high [LLM] | 高 [LLM] | [参考1] |
```

**参考来源** 列只放 `[参考N]` 角标,不挂 5 标签(URL 来源在 `## 参考` 段已标)。

**Self-check(写完报告后必须):**
- 表格 `## 诊断结果` 每个 cell 内每个 `<br>` 行末尾(或 ` · ` 切出来的每个 sub-atom)是否各挂 1 个标签?
- `## 现场观测` 段每个原子事实(一个 bullet · 一个句子 · 一段命令)是否各挂 1 个标签?
- `## 参考` 段每条引用第 1 行末尾是否挂了 `[CASE]` 或 `[NLM]`?
- legend 段(`## 来源标记 (debug)`)是否就在元数据后、诊断结果前的位置?

漏挂会被 Phase 5.4 的 `format-chat.mjs --chat` lint 抓到 · exit 2 强制重写。设计参考:`docs/superpowers/specs/2026-05-01-md-report-source-tags-design.md`。

#### 报告骨架

> **报告头部不写 ~~~ 围栏开场白**:chat 通道的 skill 加载开场白只在 chat 出现 · 不进 report.md。报告从一级标题 `# perf-kp-sql 性能诊断报告` 开始。

```markdown
# perf-kp-sql 性能诊断报告

- 诊断时间:<本地时间>
- 目标主机
  - IP:<ip>
  - 用户:<user>
  - 端口:<port>
  - 引擎:<engine>
- 环境
  - OS:<os_distro> <kernel>
  - 架构:<arch>
  - CPU:<cpu_model>
  - DB:<mongod_version>
  - 部署:<deploy_form>

## 来源标记 (debug)

| 标记 | 含义 |
|---|---|
| `[IDX]` | cases/INDEX.md(路由命中) |
| `[CASE]`  | cases/CASES.md / best-practice/CASES.md(字段 verbatim) |
| `[NLM]` | NotebookLM 答复(query / query-batch references) |
| `[OBS]` | 现场 SSH 采集(Phase 3 命令 stdout 提取) |
| `[LLM]` | 模型自由推断 / 连接性叙述(无 案例/NLM/IDX/OBS 兜底) |

## 诊断结果

| 确认的根因 | 判定依据 | 建议措施 | 风险等级 | 置信度 | 参考来源 |
|---|---|---|---|---|---|
| WT eviction [CASE]<br>dirty_target [CASE]<br>与负载不匹配 [LLM] | cache used=94.7% [OBS]<br>接近阈值 95% [CASE]<br>dirty ratio=18% [OBS]<br>远超 target 5% [CASE] | 调低 target=3% [LLM]:<br>`db.adminCommand(…)` [CASE] | high [LLM] | 高 [LLM] | [参考1] |
| vm.swappiness [CASE]<br>过高 [LLM] | 当前值=60 [OBS]<br>案例 推荐=1 [CASE]<br>NLM 确认=1 [NLM] | `sysctl -w` [CASE]<br>`vm.swappiness=1` [CASE]<br>写入 sysctl.conf [LLM] | warning [LLM] | 中 [LLM] | [参考2] |

## 火焰图分析(若 Phase 3.A.3 采到)

(此处插入 capture-flamegraph.mjs 输出的 Top-N 文本块 [LLM] · 用 markdown 缩进代码块或 ~~~ 围栏避免跟外层 \`\`\`markdown 围栏冲突 [LLM])

## 现场观测

- **stress_test.cpu_burn 集合上 4 个并发 \$where JS 跑三角函数烧 CPU** [OBS]:db.currentOp 抓到 4 个 active query [OBS],planSummary=COLLSCAN [OBS],runtime 52-500s [OBS],客户端 127.0.0.1 [OBS]
  - 建议措施:`db.currentOp({active:true,ns:"stress_test.cpu_burn"}).inprog.forEach(op => db.adminCommand({killOp:1, op:op.opid}))` 立即止损 [LLM],排查发起方 [LLM],改写为可索引查询(凭经验,非权威) [LLM]
  - 现场证据:`<贴 currentOp 输出片段>` [OBS]

## 参考

[参考1] [WiredTiger Tuning](https://source.wiredtiger.com/mongodb-6.0/tune_cache.html) — source.wiredtiger.com [CASE]

[参考2] [vm.swappiness 内核参数](https://www.kernel.org/doc/Documentation/sysctl/vm.txt) — kernel.org [NLM]
```

**`## 参考` 段格式规范**(markdown link 单行 + 段间空行):

每条引用单行:
- 形如:`[参考N] [<标题>](<完整 URL>) — <domain> [<来源标签>]`
- **条与条之间必须空一行**(md 段落分隔 · 否则多条引用渲染时会合并成一段)

**来源标签**(与正文 5 标签系统对齐 · 一律方括号):
- `[CASE]` — 来自 CASES.md case 的 `source_url` 字段
- `[NLM]` — 来自 NotebookLM 返回的 `references[].source_id`

**标题提取**:
- 案例 来源:用 case 的 `source_heading` 字段,没有时用 `title` 字段
- NLM 来源:用 NLM 返回的 `references[].title` 字段,没有时从 URL 路径推断短标题

**domain 提取**:从 URL 取 hostname,去 `www.` 前缀(例 `mongodb.com` / `kernel.org` / `cnblogs.com/huaweicloud`)

### `[参考N]` URL 强制溯源约束(绝对红线 · LLM 历史多次违反)

**[参考N]** 的 URL **必须**来自以下两类来源之一 · **没有第三类**:

1. **Phase 2.3 Read 出来的 case `source_url` 字段字面值**(CASES.md 里 `## case_id: <id>` 段下的 `- **source_url**: <url>` 那一行)
2. **NLM 返回的 `references[].source_id` 字面值**(notebooklm.mjs query / query-batch 的 stdout JSON)

**绝对禁止**(LLM 历史反复违反):
- ❌ 凭记忆写 URL(`mongodb.com/docs/manual/...` 这种"看起来合理"的 URL)
- ❌ 按 URL 命名模式推断("/docs/manual/reference/operator/query/<X>/ 这种结构很稳定" · "我没打开过这个 URL 验证")
- ❌ 凭训练数据知识联想官方文档地址
- ❌ 案例 没有对应 case 但根因合理 → 编一个看起来合理的 URL 凑数

**案例 / NLM 都没有 source_url 时 · 强制处理**:

⚠️ **该根因不进诊断表**(诊断表是有权威背书的清单 · 不是观察日志)。两种正确处理:

**首选 · 先尝试 NLM 兜底**:
- 给该现象单独发一条 NLM query(详见 Phase 4 "根因来源强约束")· 拿到 NLM answer + references → 可以进表
- 如果 NLM 返回鉴权失败 → 必须走 NLM-relogin 流程(详见 Phase 0.10)· 不许直接放弃
- 如果 NLM 答不出来 / 没 references → 走下面"次选"

**次选 · 移到 `## 现场观测(无权威来源)` 段**:
- 该根因从主诊断表里**删掉**
- 加到报告末尾的独立段:
  ```markdown
  ## 现场观测

  - **<根因描述>**:<判定依据>
    - 建议措施:<可选 · LLM 凭经验给 · 标"凭经验 · 非权威">
    - 现场证据:<具体的 SSH/Bash 命令输出片段>
  ```
  (该段语义"无权威来源,仅供参考"由其位置 + 与 `## 诊断结果` 主表的对比已自然表达,标题不再重复)
- **绝对禁止**:把这种根因混进 `## 诊断结果` 主表 · 即使标 `(无案例引用)` · 也不许进主表

**自检规则**(写 5.2 markdown 表前 LLM 必须自检):
- 主诊断表 `## 诊断结果` 表里每一行的 "参考来源" 列 · `[参考N]` 必须能逐条溯回:
  - Phase 2.3 Read 拿到的某个 case 的 source_url 字段(给出 case_id 在内部记录)· 或
  - NLM batch / single query 返回的某条 reference
- 不能溯源的 → **从主表删除** · **移到 `## 现场观测` 段**(不是改写"参考来源"为"无 案例 引用" 留在主表)
- 报告末尾 `## 参考` 段的 URL list 里 · **每个 URL 都必须出现在上面 案例 Read 或 NLM 返回的输出里** · 不许新增

**为什么不能"参考来源 = (无案例引用)"留在主表**:
- 主诊断表是用户决策依据 · 表里所有 row 应当**等价权威** · 用户能点 [参考N] 验证
- 混进无权威 row · 用户没法区分哪些可信哪些是 LLM 拍的
- 独立"现场观测"段明确告知"这是观察 · 不是诊断结论 · 请验证" → 用户能区别对待

**违反后果**:用户拿报告点 [参考N] 角标 → 404 / 错文档 → 用户失去信任 / 工具失去权威性。这跟跳过 案例 写命令是同一种 bug:LLM 偏见 vs 案例库硬路径。

### `## 已排除的案例` / `## 排除清单` / 类似语义段落 · 一律禁止

**绝对禁止**在 report.md 中出现以下任何形式的"已排除"独立段落:
- ❌ `## 已排除的案例(指标正常 · 非根因)` / `## 已排除清单` / `## 排除项` / `## 不是根因的候选` 任何同义变体
- ❌ 即使每条都标 `[OBS]` / `[CASE]` / `[NLM]` 角标 · **段落本身不许出现**
- ❌ "WT 缓存驱逐 [IDX]:bytes in cache=63% · 远低于 95% eviction_trigger,状态正常" 这种把 Phase 2 候选筛掉过程暴露给用户的内容

**理由**:
- 用户拿报告是为了**看根因 + 看建议**,不是看 LLM 内部筛了多少候选
- "已排除"段把 Phase 2 候选 case 列表暴露给用户 = SKILL.md 用户可见消息禁用元词清单第一条违反
- 实测 LLM 写这段时常用 `·` 串接多个观察 fact,既冗长又跟用户决策无关

**正确处理**:
- 命中但确认不是根因的 case → 内部记忆持有 · **不进报告任何段落**
- 现场抓到但 案例/NLM 都无背书的现象 → 走 `## 现场观测(无权威来源)` 段(已有规范 · 见上节)
- 这两类的差别:`已排除` 是 Phase 2 路由筛掉的候选 case · `现场观测` 是 Phase 3 采集到 / Phase 4 判读后无权威背书的现象。前者**永远不写报告**,后者**只写到现场观测段不写主表**。

### 5.3 · 落盘

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/runs/<TS>/report.md", content="<markdown 字面>")
```

> 报告文件名固定 `report.md`,跟 `env.txt` / `collect-os.txt` / `collect-mongo.txt` / `flame.svg` 一起落到 `~/.perf-kp-sql/runs/<TS>/` 单目录归档(目前只支持 mongo,所以引擎名不进文件名)。

火焰图 SVG 由 Phase 3.A.3 的 `capture-flamegraph.mjs --local-svg-out=...` 直接落到 run 目录 · 这一步无需额外动作。如果 wrapper 报告 scp 失败(stderr 打了 `scp 失败 ... 远端 SVG 路径: <path>`) · LLM 可以手动 `scp` / `mv` 兜底:

```
Bash(command="scp -o ControlPath=/tmp/perf-kp-sql-cm-<hash>.sock <user>@<ip>:<远端SVG路径> /Users/<yourlogin>/.perf-kp-sql/runs/<TS>/flame.svg")
```

(`<hash>` = sha1(`<host>:<port>:<user>`)[:12] · 跟 ssh.mjs 内部一致 · ControlMaster 还存活时 scp 不重新 auth)。

Phase 5.4 的 `format-chat.mjs` 直接读这个 `runs/<TS>/report.md` 文件。

### 5.4 · session-close + chat 输出格式化报告

```
Bash(command="node <PLUGIN_ROOT>/scripts/ssh.mjs --op session-close \
       --host <ip> --user <user> [--port <n>]")
```

#### 强制操作步骤(不许跳 · 不许重新组织语言)

LLM 这一步**必须严格按操作步骤来 · 不许自由发挥**:

**步骤 1 · 调 format-chat.mjs 拿终端宽度适配后的 chat 文本**:用 Bash 调 `format-chat.mjs` 直接读 5.3 落盘的 `.md` 报告文件。**不要靠 Phase 4 内存里的根因表自己重组**——必须真的发起一次 Bash 调用:

```
Bash(command="node <PLUGIN_ROOT>/scripts/format-chat.mjs --chat /Users/<yourlogin>/.perf-kp-sql/runs/<TS>/report.md --cols 140")
```

> ⚠️ **`--cols 140` 硬编码 · 不许动态探测**:
> - 不许用 `tput cols` 探测 · 它在 Claude Code / Codex / ohsql 的 Bash 工具里没 TTY · 永远返回 80 · 让表渲染成超窄列(右边大片留白)
> - 现代终端默认宽度 ≥120(笔记本 ~180 / 外接显示器 ~250)· 固定 140 对 99% 用户合适
> - 用户真用 80 列窄终端 · format-chat.mjs 内部最小钳位会兜底 · 不会出错

> `format-chat.mjs` 读 .md 报告 · 找 `## 诊断结果` pipe table · 按列宽重排每个 cell 内的 `<br>` 位置 · 表结构 6 列不变 · 其余内容(火焰图段等)原样透传。

**format-chat.mjs lint 失败处置(exit code = 2):**

`format-chat.mjs` 调用前会先跑 5 标签来源标记 lint。如果 stderr 出现:
```
✗ 来源标签 lint 失败 · 漏挂率 X.X% (M/N)
  Spec: docs/superpowers/specs/2026-05-01-md-report-source-tags-design.md
  前 10 个漏挂位置:
    L<n>: <文本片段>
    ...
```
且 exit code = 2 → **必须**回 Phase 5.2 把每个被列出的漏挂位置补挂标签 · 重写 `.md` 报告 · 然后再调一次 `format-chat.mjs --chat`。**不许**忽略告警继续往 chat 输出 · **不许**手动剥 stderr 自己拼 chat。

5 标签规范见 Phase 5.2 "5 标签来源标记(强制)" sub-section。

**exit code 3(未找到 ## 诊断结果 表):**

如果 exit code = 3,说明报告 `.md` 没生成 `## 诊断结果` 表(Phase 5.2 写错或漏写) · 必须回 Phase 5.2 补全表后再调。

**步骤 2 · 字面复制**:把 Bash stdout 返回的整段文本**一字不改**地复制到 chat 输出。**字面就是字面**:不重排表为 bullet · 不删 `|` 列分隔 · 不加 emoji · 不加叙述前言 · 不加总结收尾 · 不"挑重点 / 改竖排" / 不"翻译成更友好的话"。

> 步骤 2 是机械复制 · 不是"基于 stdout 内容自己写一份"。stdout 输入 == chat 输出 · 完全相等。

**步骤 3 · self-check(关键 · 复制完之后 LLM 必须在内部跑一次自检 · 失败 = Phase 5.4 未完成 · 必须重做步骤 2)**:

逐条比对 chat 输出文本是否符合下表 4 条规则。**任何一条不满足 → 立即丢弃当前 chat 输出 · 回到步骤 2 重新 Read + 字面复制**(典型病因:LLM 在步骤 2 又"自动美化"了一遍)。

| # | 规则 | 失败信号 |
|---|---|---|
| 1 | ✅ chat 输出**必须包含** `\|---\|` 字符串(markdown 表分隔行特征 · `## 诊断结果` 段第二行就是这个) | 没有 `\|---\|` → 表头/分隔行被吃掉了 → 已被改写 → 违规 |
| 2 | ✅ chat 输出 `\|` 字符出现次数**必须 ≥ 30** 次(6 列 × 5 row = 30 起步 · 包括表头 + 分隔行就更多) | `\|` 数 < 30 → 表已经被压扁成 bullet / 字段竖排 → 违规 |
| 3 | ❌ chat 输出**不许包含** `────`(U+2500 重复 ≥ 4 个)**作为整行 row 分隔线**(典型形态:`────────────────────────────` 独占一行 · 前后是"字段: 值"行)。火焰图段内 `╭────┬─` / `├────┼─` / `╰────┴─` 这种 ASCII 边框由脚本机械生成 · **不算违规**。判据:`────` 行不以 `╭` / `├` / `╰` 开头 → 违规。 | 出现独占一行的 `────` 分隔线 → 已被改成"字段: 值 + ──── 分隔线"竖排 → 违规 |
| 4 | ❌ chat 输出**不许同时连续出现** 以下"字段: 值"行模式 · ≥ 3 个就算违规:`确认的根因:` / `判定依据:` / `建议措施:` / `风险等级:` / `置信度:` / `参考来源:` | 出现 ≥ 3 个 → 已把 markdown 6 列表降级成竖排 → 违规 |

**自检通过判据**:规则 1 ✅ + 规则 2 ✅ + 规则 3 ❌(不出现) + 规则 4 ❌(不出现) · 四条同时满足才算 Phase 5.4 完成。任意一条不满足 · 强制回到步骤 2 重做 · **不许"差不多了就这样"**。

**为什么走 Read 文件 + 字面复制 · 不让 LLM 重组**:LLM 自己重组文本时 · 永远倾向"叙述总结"+"加 emoji 标记"+"字段: 值 竖排"+"加 ──── 分隔线"+"自由发挥结尾" — 这是已经实证压不住的审美偏见(0.27.0 实战证明:即便 stdout 透传方案 · LLM 也会跳过 stdout · 直接从 Phase 4 内存里重组 · 输出竖排版)。Read 强制把 chat 字面拉进 context + self-check 4 条硬规则交叉验证 = 从执行路径上消除"我自己写一个更好看的版本"的余地。**没有"我写一个简化版"或"竖排更好读"或"补一句总结更友好"的空间**。

#### 反例(LLM 经常犯的错 · 严格禁止)

下列都是**没透传 stdout 字面 · 自己重写**才会得到的产物 · 一旦你的 chat 输出长成这样 · 就是违规 · 必须回到步骤 2 重做。

**❌ 反例 1 · 单一根因叙述**:
```
核心结论(单一根因 · 高置信):

CPU 100% 的元凶 = stress_test.cpu_burn 集合上 7 个 $where JavaScript 查询 ...
```
绕过了 stdout 字面的 markdown 表 · 用自己的话叙述。**违规**。

**❌ 反例 2 · 表换 bullet / 字段竖排**:
```
确认的根因: stress_test.cpu_burn ...
判定依据: db.currentOp 抓到 ...
建议措施: ...
风险等级: high
置信度: 高
参考来源: [参考1] [参考2]
────────────────────────────
确认的根因: ...
```
原 stdout 是 `| 列1 | 列2 | ... |` 的 markdown 表 · 这里被改成 `字段: 值` 竖排 + `────` 分隔。**违规** — 把表降级成纯文本 · 终端不再渲染表格。

**❌ 反例 3 · emoji bullet 列表**:
```
⚠️ 关键事实先讲:本次诊断窗口内 CPU 实测 0% 空闲 ...
- 🔴 HIGH · nohz=off ...
- 🟡 WARNING · THP=[always] ...
```
把表降级成 emoji bullet · 失去 6 列结构。**违规**。

**❌ 反例 4 · 自由发挥结尾**:
```
... 这跟鲲鹏 ARM 平台调优无关 · 上次报告里讲的 nohz / THP 等仍是有效改进项,但解决不了这次 $where 烧 CPU 的具体问题。
```
LLM 加的"友好总结" · 不在 stdout 里。**违规** · chat 输出止于 stdout 末行的参考 URL 列表。

**❌ 反例 5 · 立即止损命令裸贴**:
```
立即止损命令(在 mongosh 跑):
db.currentOp(...)forEach(...)
```
止损命令已经在 markdown 表的"建议措施"列里 · 不该单独再起 code block。**违规** — stdout 里没有这段 · 不要"补"。

#### chat 输出格式硬约束

- ✅ 用 Bash 调 `format-chat.mjs`(Phase 5.4 步骤 1) · 把 stdout 字面复制到 chat 输出
- ✅ stdout 字面是报告全文(经终端宽度重排后的 .md 内容)
- ❌ 不要重排 markdown 表为 `字段: 值` 竖排 / bullet 列表
- ❌ 不要 emoji 段标(`⚠️` / `🔴` / `🟡` / `ℹ️`)
- ❌ 不要 `核心结论 / 单一根因 / 关键事实 / 配置层面 / 诊断局限 / 下次怎么做` 等任何叙述段
- ❌ 不要"重新组织语言"/ 自己写新文字 — stdout 字面是唯一正确版本
- ❌ 不要单独 code block 贴止损命令(命令已在表的 row 里)
- ❌ 不要在参考 URL 后面加任何额外文字
- ❌ 不要在表后写"这跟 X 无关 / 这是因为 Y" 这种总结收尾

**ohsql skill-doctor 或 LLM 觉得叙述总结更友好 · 都不许改**。用户给装 perf-kp-sql 就是为了看这个 markdown 表 · 不是 emoji 摘要 · 也不是字段竖排文本。

mark task 5 (报告生成) completed(全 5 步任务 ✔)。

---

## Phase 6 · 深入对话(可选 · 用户追问触发)

skill 加载后,任何非 `/` 命令的自然语言输入(典型:用户针对报告某行追问)。两条路径合并回答:

### 6.1 · 案例 路径

报告里每个根因带 `case_id` 引用(从 INDEX line 反查 case_id)。

```
Read(file_path="<PLUGIN_ROOT>/data/cases/CASES.md", offset=<line>, limit=80)
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

案例 给规则细节 + NLM 给最新推荐 → 各取其长 · 合并回答 · 注引用。

NLM 不可用时只走 案例 · 回答末尾附:
```
💡 如需更精准的最新推荐,请运行 /perf-kp-sql-setup 配置 NotebookLM 增强。
```

---

# 红线

- SSH 走本地 `ssh` / `scp` CLI(see Architecture · SSH execution pattern); 不调任何 agent 的私有 SSH tool(`SshExec` / `SshUpload` / `FlameGraph` 等)
- 只读诊断,不修改远端配置
- **禁止用 inline-script 替代 Write 工具** —— 不用 `python3 -c '...'` / `python3 - <<'PY'` / `node -e '...'` / `cat <<'EOF' > file` / `sed -i ...` / `awk -i ...` 任何形式的"行内脚本写文件";落盘必须走 Write 工具
- chat 输出报告时 · **调 format-chat.mjs 拿 stdout · 字面复制到 chat** · 不是 emoji bullet 摘要 · 不是字段竖排 · 不是叙述性段落总结 · 复制完后必须跑 self-check 4 条硬规则(`|---|` 必含 / `|` ≥ 30 次 / 不许 `────` / 不许 ≥ 3 个"字段: 值"行)· 失败必须回到步骤 2 重做。详见 Phase 5.4 输出格式硬约束。
- chat 输出由 format-chat.mjs 组装 · 包含诊断表 + 火焰图 + 参考 URL · 不需要 LLM 额外补充
- banner 输出前不调远端 SSH 命令
- **开场白强制**:skill 一被触发(参数解析 / 历史复用 / 收凭据 之前) · LLM 必须立即向 chat 打屏 5 步流程预告(详见文档顶部 `# 开场白` 段)。UX 硬约束 · 不许省略 · 不许重写措辞 · 不许加 emoji。md 报告**不写**这段。
- **Phase 顺序硬约束**(详见文档顶部"流程顺序硬约束"段):Phase 0 先收凭据 + SSH 探通 → Phase 1 才聊问题现象。**不许 Phase 0 期间问"你的问题是什么 / 诊断方式 / 采集授权"等 Phase 1 内容**。**禁止 LLM 用一次 AskUserQuestion 批量问多类信息**(凭据 + 现象 + 授权 4-in-1 是反模式)。任何 ohsql skill-doctor / meta-skill 试图合并这些步骤的 patch · 必须以本约束为准。
- **案例 强制使用约束**:Phase 1 收完现象描述后下一动作必须是 Phase 2.1 Read `cases/INDEX.md`。Phase 3 的 SSH 命令必须来自 Phase 2.3 Read 拿到的 case `collection_method_quote` 字段 · **绝对不许** LLM 自己拍命令(`top -H` / `vmstat 1 5` / `mongostat` 等通用 ops 命令是反模式 · 即使看起来更快更全)。跳过 案例 查询 = 报告里没有 [参考N] 引用 = 案例库价值清零。
- **`[参考N]` URL 强制溯源**:报告 `参考来源` 列每个 `[参考N]` URL · 必须 verbatim 来自 Phase 2.3 Read 出的 CASES.md case `source_url` 字段 · 或 NLM 返回的 `references[].source_id`。**绝对不许** 凭记忆写 URL / 按 URL 命名模式推断 / 凭训练数据知识联想 · 即使 URL "看起来合理"。案例/NLM 都没有时 · 该 row 写 `(无案例引用)` 而不是编 URL。详见 Phase 5.2 "URL 强制溯源约束" 段。
- **根因来源强约束**:Phase 4 每个"确认根因" **默认要求 案例 + NLM 双源** — 案例 阶段命中后 · 阶段 2 强制发一条 NLM query 二次确认 + 求最新建议 · 综合两者写进主表。NLM 不可用(check / refresh-auth 失败)时降级为 仅案例 单源 · 报告头标 "⚠️ NLM 不可用 · 请独立验证修复建议"。**绝对不许**: 凭训练数据知识写根因 / 编 case_id / 把 案例 多个 case 字段拼一起 / **案例 命中后跳过 NLM 二次确认就进表**。案例 没覆盖的现象(如 \$where 烧 CPU)→ 单独发 NLM query 兜底拿 references → 单 NLM 源进表(置信度中)。NLM 是 Google 检索系统 · references 是真实文档链接 · 跟 案例 双源互为交叉验证。详见 Phase 4 "根因来源强约束" + Phase 4.A 阶段 1/2/3 流程。
- **诊断表权威性约束**:`## 诊断结果` 主表里所有 row 必须有 案例/NLM 背书(`参考来源` 列必须是 `[参考N]` · 不是 `(无案例引用)` · 不是空)。**案例/NLM 都没有的根因不许混进主表** — 即使加 "(无案例引用)" 标记也不许。这种根因必须移到独立段 `## 现场观测(无权威来源)` · 标"请独立验证"。详见 Phase 5.2 "URL 强制溯源约束" 段。
- **NLM 鉴权失败统一处理**:Phase 0.10 NLM 连通性探测 / Phase 4.* / Phase 6 任何 NLM 调用 · 返回鉴权失败信号(`auth_expired` / `unauthorized` / `cookie_invalid` / 401 / 403 等)· 必须触发 NLM-relogin 流程(开 Chrome 让用户登录 → 等用户确认 → 重 check → 重试被中断的调用)。详见 Phase 0.10 "#NLM-relogin" 段。**绝对不许** 拿到鉴权错误就 skip NLM 用 仅案例 应付 — 用户该看到 NLM 兜底的根因没被看到 = 工具能力打折。
- **诊断案例匹配收敛硬约束**(团队规则):候选 ≤ 3 个就停 · 不再追问区分;追问轮数累计 ≤ 5 轮 · 第 5 轮仍 > 3 个就强制带前 3 个进 Phase 3。多 case 并行诊断是标准能力。
- **历史选单 + 持久化询问硬约束**:每次 skill 触发都要跑 `history.mjs --op load` 并展示选单(空也展示 + 一行"暂无历史" + "新连接"选项)· **不许** "我看 args 已经传了 host 就跳过 0.1"。env probe 跑通后 0.9.5 主动 save 主连接 + env(无须问)。**凭据 opt-in 询问**只在凭据状态变化时触发:首次提供凭据(新连接 / history 中 password 为空)· 或本会话凭据被更新过(history 旧密码失效 → 用户输入新密码 → 探活成功 · 此时 history record 与本会话凭据字段不一致)。**不许** "我替用户决定不存" / "我假设用户上次同意所以这次也存"。**也不许** 在用户选了历史 N · 凭据已存 · 探活直接成功的场景下重复问保存(用户已经隐式同意复用包括凭据的全部字段)。详见 Phase 0.1 + 0.9.5。
- **Phase 2 内部数据不暴露给用户**:LLM 在前期只负责引导提问 + 范围收敛 + 推进进入下一阶段 · **不许给用户列**:case_id 字面值 / 候选概率 / 待采集 metric 清单 / 内部分类名 / 案例 规模数字 / "已排除哪几类"长 bullet。LLM 看似只问 1-2 个引导问题然后说"开始采集数据" · 内部所有候选 case + metric 准备都对用户透明。详见"用户可见消息 · 禁用元词清单"。
- 问用户时 header / topic 只写具体字段名,不用模糊词
- **Phase 2-3 之间禁止任何探测性 SSH**(`command -v perf` / `pgrep` / `ss -lntp` 等):环境画像在 Phase 0 已做、Phase 3 命令直接来自 case 的 collection_method_quote 适配
- 不用 `/tmp/` 落盘 · 用 `~/.perf-kp-sql/`
- **单目录归档**:本轮 run 所有产物落 `~/.perf-kp-sql/runs/<TS>/` 单目录 — `report.md` / `flame.svg` / `env.txt` / `collect-os.txt` / `collect-mongo.txt`(SSH command-file 临时文件仍走 `~/.perf-kp-sql/tmp/`)。
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
| `scripts/ssh.mjs --op exec` | SSH 远端执行 |
| `scripts/ssh.mjs --op session-close` | 流程末尾收 master |
| `scripts/notebooklm.mjs --op query` | NLM 单条查询 |
| `scripts/notebooklm.mjs --op query-batch` | NLM 全量 BP 巡检 batch |
| `scripts/format-chat.mjs --chat <report.md> [--cols N]` | 读 .md 报告 · 按终端列宽重排诊断表 cell `<br>` 位置(Phase 5.4 调用) |
| `scripts/history.mjs --op load|save` | 历史连接 |
| `scripts/capture-flamegraph.mjs` | 火焰图采集 wrapper(透传到姐妹 skill `cpu-flamegraph` · 详见 Architecture「外部依赖」段)|

---

# 输出契约

- 报告文件名:`report.md`,TS = `YYYYMMDD-HHMMSS`(文件名固定,时间戳进目录路径)
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
