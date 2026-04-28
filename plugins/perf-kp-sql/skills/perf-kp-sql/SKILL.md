---
name: perf-kp-sql
description: Kunpeng ARM64 + MongoDB joint performance diagnosis. Runs SSH-based remote collection (50 OS metrics + 18 mongo runtime), evaluates 44 audited baseline rules from a sqlite knowledge base (FTS5 trigram + sqlite-vec 384-dim semantic search · 全部规则点开 [参考N] 字面命中权威文档), and emits an impact-ranked HTML report. Use when users report MongoDB slowness, CPU spikes, latency jitter, or are doing Kunpeng migration / config audit. Triggers include '数据库慢' / 'CPU 高' / '抖动' / 'mongo perf' / 'Kunpeng 性能' / similar phrases. First-time use:run `/perf-kp-sql-setup` to install native deps.
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
  Native deps installed via `/perf-kp-sql-setup`: better-sqlite3, sqlite-vec,
  ssh2, @xenova/transformers (~30MB total + 25MB MiniLM model).
  Supported database engine: mongo (MongoDB 3.6-7.x).
  Knowledge base: 44 audited baseline rules + 54 distinct authoritative
  documents (MongoDB official + WiredTiger + Ampere + Kunpeng + ...).
metadata:
  generator: "manual"
  generated_at: "2026-04-26"
argument-hint: "host=<ip> user=<user> (privateKeyPath=<path>|password=<pw>) [engine=mongo] [port=<ssh_port>]"
---

# Pre-flight

> **首次安装后**:跑 `/perf-kp-sql-setup` 完成 native 依赖检查与安装(better-sqlite3 / sqlite-vec / @xenova/transformers + knowledge.sqlite 完整性)。setup skill 会在缺依赖时给出 `npm install` 命令并自动执行。

每次本 skill 触发,直接进入 Step 1 — `/perf-kp-sql-setup` 已经把 build 产物和 native 依赖都校验过了。运行时若仍出现 `Cannot find module 'better-sqlite3'` 或 `NODE_MODULE_VERSION X != Y`,提示用户重跑 `/perf-kp-sql-setup`。

---

# Architecture

- **Collect** — local shell + `node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/ssh.mjs --op exec` (内部 spawn 本地 OpenSSH `ssh` · ControlMaster 多路复用 · 密码走 SSH_ASKPASS · key 走 -i)运行 per-engine batch commands on the remote host
- **Persist** — write stdout to `~/.perf-kp-sql/tmp/perf-kp-sql-<engine>-{os,db}-<ts>.txt`
  - 不用 `/tmp/`(sandboxes vary)
  - 不用 `~/.ohsql/tmp/`(在 OH-SQL 0.36.x 上**实测观察到** Write tool 报 success 但紧接的 Bash 子进程 read 同路径立即 ENOENT 的失配现象;OH-SQL 0.51.0 源码读了 `FileWriteTool` 是直 `writeFileSync` · **真因未确认** · 可能与 agent 实际传入的 path 与 Write 报告值字面差异 / 未做的 mkdir 先决条件 / 截断显示掩盖的 typo 有关。无论根因为何,挪出 `~/.ohsql/` 命名空间是防御性正确的)
  - 用 plugin-自有 namespace `~/.perf-kp-sql/`(没有任何 harness 声明拥有这个目录,跨 Claude Code / Codex CLI / OH-SQL 三家都不会被劫持)
- **Analyze** — local shell: `node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/diagnose.mjs --os-file ... --db-file ... --engine <name>`
- **Knowledge base** — read / grep over `${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/data/<engine>/` + `data/common/`
- **Flamegraph** — local shell: `node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/capture-flamegraph.mjs ...` (内部自定位 cpu-flamegraph 插件,跨 harness 兼容)
- **Report** — local shell: `node .../scripts/render-html-report.mjs` + `render-screen-footer.mjs`

## Path placeholders · 双变量并写 · 由 harness 自动替换

下文所有 `${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}` 都是**双变量占位符**,设计成两边 harness 各自识别自家:

- **ohsql** 加载 SKILL.md 时(loader-time)把 `${OHSQL_PLUGIN_ROOT}` 替换为 ohsql cache 绝对路径,`${CLAUDE_PLUGIN_ROOT}` 留字面 → shell 扩展未设 env 为空 → 最终拼出 ohsql 路径
- **Claude Code** 把 `${CLAUDE_PLUGIN_ROOT}` 替换为 CC cache 绝对路径,`${OHSQL_PLUGIN_ROOT}` 留字面 → shell 扩展为空 → 最终拼出 CC 路径
- agent 不需要手动解析路径 · 直接用占位符发命令 · harness 已经替换好了
- 注意 `${VAR-}` / `${VAR:-X}` 等 Bash parameter expansion 形态 harness regex **不识别** · 必须严格用 `${VAR}` 形态

**故障识别(若命令报错)**

| 报错样式 | 含义 | 对策 |
|---|---|---|
| `bash: OHSQL_PLUGIN_ROOT: unbound variable` 或 `CLAUDE_PLUGIN_ROOT: unbound variable` | harness 未替换占位符 + shell 开了 `set -u`(nounset) | 走 `perf-kp-sql-setup` Step 1 的 fallback 扫位拿绝对路径,后续命令手动展开占位符 |
| `node: <path>/scripts/foo.mjs: No such file or directory`(路径前缀少了 plugin 根) | harness 未替换占位符,shell 也未扩展(env 都没设) | 同上,走 fallback 扫位 |
| `node: /a/b/0.24.0/x/y/z/scripts/foo.mjs: No such file`(路径双写,中间有意外的 home/cache 段) | 用户自己 `export` 了对方变量(比如 ohsql 用户在 .zshrc export 了 `CLAUDE_PLUGIN_ROOT`) | `unset` 那个变量;两个变量都不应由用户手动 export |

万一 harness 不替换(Codex CLI / 旧版 ohsql · 第一次跑命令 ENOENT 报错才会暴露),走 `perf-kp-sql-setup` Step 1 的 fallback:`for d in ~/.ohsql/plugins/cache/perf-kp-sql@* ...; do test -d "$d"; done | sort -V -r | head -1`。

同理:`/Users/<yourlogin>/...` 必须替换为真实 home 绝对路径(可用 `echo $HOME` 一次拿到);`<TS>` 必须替换为本轮统一的 `YYYYMMDD-HHMMSS`;`<ip>` / `<user>` / `<engine>` 必须替换为参数集里的真值。

> ⚠️ Some agent shell sandboxes reject heredoc / `>` / `<` / `|` / `$'...'` / `` ` `` / 3+ consecutive quotes. Strictly use **write-file → shell (no redirection) → write-file** for the collection chain.(注意:`${VAR}` 这种规范形态 harness 已替换,sandbox 不再拦)

## SSH execution pattern

This skill SSHs to the target host multiple times — **统一走** `node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/ssh.mjs --op exec`,key auth 与 password auth 共用同一 wrapper · 输出同一 JSON 结构。

### 调用模板(命令字面短且不含 `'` / `"` / `$`)

```
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/ssh.mjs --op exec \
       --host <ip> --user <user> [--privateKeyPath <path> | --password '<pw>'] [--port <n>] \
       --command '<command>'")
```

### 调用模板(命令含 `'` / `"` / `$` 混杂 → 必须走 `--command-file`)

典型场景:probeCmd / osBatchCmd / dbBatchTemplates 替换后。**不要**改用 `$'...'` ANSI-C 引号或 `"<cmd>"` 内联 —— 前者命中 OH-SQL BashTool 硬拒(CC 平台同款规则会弹权限提示),后者会让远端要展开的 `$VAR` 被本机 shell 提前吃掉。

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt", content="<command 字面>")
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/ssh.mjs --op exec \
       --host <ip> --user <user> [--privateKeyPath <path> | --password '<pw>'] [--port <n>] \
       --command-file /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt")
```

`<TS>` 用本轮调用统一的时间戳后缀(同 probe / os / db 输出文件命名),用完不必删除——`/Users/<yourlogin>/.perf-kp-sql/tmp/` 是会话临时目录。

### 认证方式

- 用户传了 `privateKeyPath=<path>` → 加 `--privateKeyPath <path>` flag · 走 OpenSSH pubkey
- 用户传了 `password=<pw>` → 加 `--password '<pw>'` flag · ssh.mjs 内部走 SSH_ASKPASS(写一次性 mode 0700 askpass 脚本 + setsid 断 tty)· **不依赖 sshpass** · Codex CLI / Claude Code / ohsql 全支持
- 两个都给 → key 优先 · password 静默忽略

PAM 主机(华为云 EulerOS / RHEL+PAM / Ubuntu+pam_unix 等)上 password+keyboard-interactive 多回合 challenge 由 OpenSSH 自身处理,跟之前 ssh2 + tryKeyboard 路径同等稳定。

### ControlMaster 长连接(本 skill 多次 SSH 复用一条 TCP)

ssh.mjs 自带 `ControlMaster=auto` + 稳定 hash ControlPath(`/tmp/perf-kp-sql-cm-<sha1[host:port:user][:12]>.sock`)+ `ControlPersist=600`。**第一次** ssh.mjs 调用顺手开 master(socket 监听),**后续**所有 ssh.mjs 调用看到 socket 存在 → 直接通过 socket 起新 channel(完全跳过 TCP 握手 + auth)。

效果:服务端只看到 1 个连接,N 个 channel 是 SSH 协议内部多路复用,**不计入 PAM faillock / fail2ban / sshd MaxStartups 等连接级限速器**。

### 流程末尾 · session-close

Step 2 收尾(2.9)显式调一次 `--op session-close` 收掉 master:

```
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/ssh.mjs --op session-close \
       --host <ip> --user <user> [--port <n>]")
```

即使忘调,ControlPersist=600(10 min)到期也会自动退,不会留孤儿。

### 输出结构

`ssh.mjs --op exec` 的 stdout 是结构化 JSON:`{"stdout":"...","stderr":"...","exitCode":0}`(--output-file 模式下 `stdout` 字段被替换为 `<wrote N bytes to /path>` metadata)。LLM 拿到后:
- 解析 JSON,取 `stdout` 字段当作"远端命令的标准输出"
- `exitCode === 0` 且 `stdout` 非空 → 成功;`stdout` 空且 `stderr` 空 → 走 Gate 4 自检
- `err` 字段非空 → SSH 协议层失败(`SSH connection failed (255)` 等),按场景兜底

`ssh.mjs --op session-close` 的 stdout 是 `{"ok":true,"controlPath":"..."}`(socket 不存在或 master 已退也算 ok)。

## Task tracking pattern

This skill runs 5 phases. Track them with the agent's task-list facility:
- **Claude Code**: use `TodoWrite` (5-element array, status field per item)
- **OpenAI Codex CLI**: use `update_plan` (5 steps, status field per step)
- **Other agents only when no task-list tool exists**: render progress as plain text using `◻ ◼ ✔` markers

**Single-source rule** — do NOT print the task list as plain text in chat when the task tool is available. The task tool already renders the spinner UI; an extra `━ 5 阶段任务清单 ━` (or any equivalent textual bullet list) is a duplicate and is forbidden. Specifically:
- No `━ 5 阶段任务清单 ━` header.
- No `◻ phase 1 · ...` bullet list before, alongside, or after `TodoWrite`/`update_plan`.
- Phase activity lines (`· 内存 · THP / ...`, `· 硬件 · ...`) are NOT the task list — those are scoped detail under the active phase and remain allowed.

Each phase transition (in_progress → completed; pending → in_progress) re-sends the full updated task list via the task tool only. Detailed phase titles + counts are defined in Step 1.4.

---

# Pre-flight · 临时目录就绪

skill 加载后、Step 1 之前,无条件先跑一次 mkdir 兜底(目录已存在 = 静默 noop):

```
Bash(command="mkdir -p ~/.perf-kp-sql/tmp ~/.perf-kp-sql/reports ~/.perf-kp-sql/flame")
```

这一行命令不含 `${}` / heredoc / 重定向 / 引号嵌套,跨三家 harness 都能过。失败极罕见(磁盘满 / 权限禁),失败时给用户一行 `请确认 $HOME 可写后重试` 即可。

---

# Workflow

## Step 1 · PLAN

**banner 必须在任何远端 SSH 命令(or remote `scp` / `node ...flamegraph capture` invocation)之前渲染。** 本地参数收集(history load · prompts to user)不受限。

### 1.0bis · 历史复用

触发:slash args 缺 host 时。

```
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/history.mjs --op load --max 5")
```

hosts 非空 → ask the user to pick one (even if there's only 1 entry — explicit confirmation):

```
请选择最近使用过的连接 · 或新建:

  1. 192.168.1.10 · admin · mongo · 上次 2 小时前 (port=22 · 累计 8 次)
  2. 10.20.30.40 · ec2-user · mongo · 上次 3 天前 (port=22 · 累计 3 次)
  3. 新连接 · 手动输入参数
```

Stop here and wait for the user's selection in the next turn. Once selected, fully decode the JSON (`host / user / port / engine / password / privateKeyPath / mongo_user / mongo_password / auth_db`) into the parameter set.

**No stopping after selection**: same turn → render banner → run env probe (Step 1.3 · 无条件) → declare 5-phase task list → mark phase 1 in_progress → run SSH OS collection.

### 1.1 · 参数抽取

从用户任意措辞抽取:
- 必填:`host`(IP/FQDN)、`user`、`password`(或 `privateKeyPath`)
- 可选:`port`(默认 22)、`engine`(目前只支持 `mongo`,默认即 mongo)
- MongoDB 可选:`mongo_user`、`mongo_password`、`auth_db`(默认 admin)

抽取策略:严格 kv → 半结构化 → 自然语言 → 混合。抽取失败只问缺的字段,不重来整表。

### 1.2 · 参数校验

两类 check,任一命中阻塞 banner:

**Class 1 缺字段** — host / user / (password OR privateKeyPath) 任一缺:

> Ask the user (with the missing field name as the topic):
> ```
> ━ kunpeng · 参数待补全 ━
> 还缺:<缺字段名>(例:SSH 密码 / SSH 私钥路径)
> 请补充。
> ```
> Stop and wait for the next turn.

**Class 2 格式非法** — host 非合法 IP/FQDN、port 非 1-65535、engine 不在支持集合(当前 `engine` 仅接受 `mongo`):

> Ask the user (with the bad field name as the topic):
> ```
> ━ kunpeng · 参数格式异常 ━
> <字段名> 格式不对:<原值> → <期望格式 / 合法集合>
> 请重新提供。
> ```
> Stop and wait for the next turn.

`<字段名>` 只写具体名(`SSH 密码` / `主机格式` / `端口格式`),不用模糊词。

### [连接信息] banner

参数齐备后打:

```
[连接信息]
  · host=192.168.1.10 · user=admin · port=22 · engine=mongo
  · password=ABC***XYZ
  · mongo_password=ABC***XYZ · auth_db=admin
```

password 前 3 + `***` + 后 3 脱敏。后续 SSH 命令的 host/user/port/password/privateKeyPath 参数必须与 banner 字段一一对应。

### SSH 参数门

**Gate 2** — SSH 命令的 host/user/port/password/privateKeyPath 必须与 banner 字面一致。

**Gate 3** — history 里 password 非空 → 必传;privateKeyPath 非空 → 必传;两者都空 → 先问凭据。

**Gate 4** — SSH 命令返 stdout=stderr="" 时:
1. 打自检行(实发参数 vs history 比对)
2. 发现漏传 → 同 turn 重试
3. 全传齐仍空 → 走紧凑二次收集

### 1.2bis · DB 凭据预询问(凭据缺时前置)

**触发**:DB 凭据缺(0.9.2 起只支持 mongo,无 engine 分支):
- mongo 缺 `mongo_user` 或 `mongo_password` → 触发本步

任何一种命中本步触发。如果用户 slash args 已经把对应凭据传齐 → 跳过本步,直接进 1.3。

**为什么前置**:不问就跑 1.3 探测 + 全量采集会浪费 ~105s,等到 Step 2.7 DB 连不上才反向问 — 用户体验差。这里给用户一个**主动选择**的入口。

ask the user(topic = `数据库连接信息`):

```
━ 数据库连接信息 ━
当前未提供数据库凭据。请选:
  1. 我现在补全凭据(engine + db_user + db_password [+ auth_db for mongo])
     → 现在收齐后进入采集,采集时凭据直接生效
  2. 跳过,先做自动探测
     → 1.3 探测远端进程,命中后展示实例并向你确认凭据,再进采集
请回复 1 / 2 或直接给参数。
```

Stop and wait for the next turn。

**用户选 1(补全)**:
- engine 默认为 mongo
- 收 mongo 凭据:`mongo_user` / `mongo_password` / `auth_db`(默认 admin)
- 全收齐 → 进 1.3。1.3 探测仍跑,只是后续不再问凭据

**用户选 2(自动探测)**:直接进 1.3,凭据由 1.3bis 在探测命中后再问

**用户直接给参数(不答 1/2 而是直接补字段)**:把字段并入参数集,等价于"选 1"路径

### 1.3 · 环境探测(无条件 · 一次 SSH 全做完)

**触发**:无条件跑(不管 `engine=auto` / 显式 / 缺省)。本步是采集阶段唯一前置 — 拿到 engine + 实例(pid/bind/port)+ 火焰图工具能力(perf / offcputime-bpfcc)三类信号,锁住后 Step 2 采集阶段绝对禁止任何探测性 SSH。

**为什么前置**:
- Step 1.4 task list 的「运行时采集 (<N> 项)」「规则诊断 (<R> 条)」依赖 engine 才能填实数
- Step 2.5 火焰图采集需要 pid + 提前知道 perf/offcpu 是否在场,不能等到 OS 50 项采集完(~60s)再回填
- 显式 engine 用户也需要拿 pid/bind/port — 这些是主机环境事实,跟用户偏好无关

**禁止**:Step 2 整段不许出现 `command -v perf` / `pgrep` / `ss -lntp` 等探测性 SSH,所有探测在本步完成。

读 probe 命令:
```
Read(file_path="${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/data/collect-cmds.json")
```

按 SSH execution pattern 跑(见 Architecture · 统一走 `ssh.mjs --op exec`);timeout ≈ 15s。`<command>` = literal `probeCmd` string。

probeCmd 含 `'` / `"` / `$` 混杂 → **必须**走 `--command-file`(见 Architecture):

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-probe-<TS>.txt", content="<probeCmd 字面 · 即 collect-cmds.json 里 probeCmd 字段的字符串值>")
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/ssh.mjs --op exec --host <ip> --user <user> [--privateKeyPath <path> | --password '<pw>'] --port <n> --command-file /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-probe-<TS>.txt --timeout 15000")
```

`ssh.mjs --op exec` 返回的 JSON 里取 `stdout` 字段(probe 文本),Write 落盘:
```
Write(
  file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-probe-<TS>.txt",
  content="<此处填入 ssh.mjs 返回 JSON 的 stdout 字段内容,即 ###PROBE_BEGIN### ... ###PROBE_END### 全段>"
)
```

调 probe-parse 解析:
```
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/ssh.mjs --op probe-parse --probe-file /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-probe-<TS>.txt --hint-engine <engine|skipped>")
```

返回 JSON:
```json
{
  "ok": true,
  "instances": [{"engine":"mongo","pid":"...","bind":"...","port":"..."}, ...],
  "flame_capable": "oncpu+offcpu" | "oncpu" | "none",
  "perf_path": "...",
  "offcpu_path": "..."
}
```

#### 实例选择

**0 实例** → 远端 mongod 没起。打:
> ━ 远端未发现 mongod 进程 ━
> 已扫:mongod 无 pgrep 命中。
> 请确认目标主机 MongoDB 是否已启动,或继续以默认端口 27017 推断方式跑。

Stop and wait for the next turn。

**0 实例** + 用户继续 → **信用户**,走兜底:bind=127.0.0.1, port=27017, pid 留空(火焰图自动跳过 oncpu),打:
```
  · 警告 · 远端未发现 mongod 进程 · 按默认配置继续 · bind=127.0.0.1:27017
  · 数据库实例 · mongo @ 127.0.0.1:27017(默认端口推断 · 火焰图采集将跳过)
```

**1 实例** → 直接锁定。

**多实例** (多个 mongod) → ask the user (topic = `选择诊断目标`):
```
检测到多个 mongod 实例:
  1. mongo @ <bind>:<port> (pid=<pid>)
  2. mongo @ <bind>:<port> (pid=<pid>)
请选择诊断目标。
```
Stop and wait for the next turn。用户选定后继续。

#### 锁定的状态

`engine` + `bind` + `port` + `pid` + `flame_capable` 在内存里保留。**Step 2 全部子步骤共享这套状态,绝不重新探测**。火焰图能力公告 + 硬件/OS 识别行**统一推迟到 task 1 收尾(Step 2.6)**;**实例识别行**则在下一步 1.3bis 立即出(用户需要在采集前看到探测结果)。

### 1.3bis · 探测结果展示 + 凭据确认

**目标**:
- 让用户**采集前**就看到 1.3 探测到了什么(实例 + 火焰图能力)
- 如果对应 engine 的 DB 凭据仍缺,**当场问**(避免 Step 2.7 才反向问)

#### 1.3bis.1 · 展示探测结果

打 2 行(无论凭据是否齐都打):
```
  · 数据库实例 · <engine> @ <bind>:<port> (pid=<pid>) [· 默认端口推断]
  · 火焰图能力 · <on-CPU + off-CPU 双采 | 仅 on-CPU(offcputime-bpfcc 未装) | 不可用 · perf 未装>
```

#### 1.3bis.2 · 凭据确认(如缺则问)

按 engine 检查必需凭据是否已齐:

必需凭据:`mongo_user` + `mongo_password`(`auth_db` 默认 admin 可省)。

**齐** → 跳过本子步,直接进 1.4。

**缺** → ask the user(topic = `MongoDB 凭据`):

```
━ MongoDB 凭据(已探测命中) ━
远端检测到 mongod 实例 @ <bind>:<port> (pid=<pid>)。
连接需要凭据,请提供:
  - mongo_user(必填,匿名连接绝大多数 mongo 部署会被拒)
  - mongo_password(必填)
  - auth_db(默认 admin · 可省)
直接回 "跳过" = 仍按匿名试一次(失败会在采集阶段反向问)。
```

Stop and wait for the next turn。

**用户回 "跳过" / 空 / 拒绝** → 标记 `db_creds_skip=true`,进 1.4(Step 2.7 失败仍走"连不上反向问")。

**用户给凭据** → 收齐进 1.4。

> 注意:1.2bis 用户已选 "1. 补全凭据" 时,1.3bis.2 自然跳过(凭据已齐);只 1.3bis.1 的展示行还会打,告诉用户探测命中了什么。

### 1.4 · 声明 task 清单

Declare a 5-phase task list using the agent's task-tracking facility (see "Task tracking pattern" in the Architecture section above). On Claude Code use `TodoWrite`; on OpenAI Codex CLI use `update_plan`; otherwise render as plain text.

If a previous task list exists from an earlier run in the same session, replace it (idempotent — both `TodoWrite` and `update_plan` overwrite the whole list). Do NOT append.

The 5 phases (English subject for portability, with Chinese display titles):

| # | Display title (subject) | Spinner verb (activeForm) | Count placeholder |
|---|-------------------------|---------------------------|-------------------|
| 1 | OS/硬件采集 (50 项)     | 采集 OS/硬件              | 50 (fixed) |
| 2 | MongoDB 运行时采集 (18 项) | 采集运行时           | 18 (fixed) |
| 3 | 规则诊断 (44 条)        | 诊断规则                  | 44 (audited baseline) |
| 4 | 知识库检索 (54 篇)      | 检索知识库                | 54 (fixed) |
| 5 | 报告渲染                | 渲染报告                  | (no count) |

**Exactly 5 phases. Do NOT create extras (no "cleanup" or "init" phases).** Do NOT assume sequential IDs (1-5) — use whatever IDs the agent's task tool returns.

**命名规则**:
- subject 名词在前 + 动词在后(`X采集` / `X诊断` / `X检索` / `X渲染`)
- activeForm 动词在前(spinner verb 自然中文)
- 0.9.2 起只支持 mongo · task 2 固定 `MongoDB 运行时采集 (18 项)` · 不再有多 engine 切换
- task 1 / 3 / 4 / 5 名称统一(OS、规则诊断流程、KB 检索、报告渲染)

**phase 项数对照表**(数值来自实测,不要编):

| task | 项数 | 来源 |
|---|---|---|
| task 1 OS/硬件采集 | 50 项 | `src/shared/os-collector.ts` 中 `out["..."] = ...` 的去重 key 数 |
| task 2 MongoDB 运行时采集 | 18 项 | `src/engines/mongo/collector.ts` 中 `out["..."] = ...` 的去重 key 数 |
| task 3 规则诊断 | 44 条 | `sqlite3 data/knowledge.sqlite "SELECT count(*) FROM rules WHERE enabled=1 AND engine IN ('mongo','any')"` |
| task 4 知识库检索 | 54 篇 | `sqlite3 data/knowledge.sqlite "SELECT count(DISTINCT doc_id) FROM knowledge"` |

---

## Step 2 · 采集

> ⚠️ **Step 2 全程禁止任何探测性 SSH**(`command -v` / `pgrep` / `ss -lntp`)。所有探测在 Step 1.3 已经一次完成。Step 2 只做"采"(SSH 跑 osBatchCmd / dbBatchTemplates / capture.mjs)和"展"(打识别行)。

### 2.0 · 进入 task 1

Mark phase 1 (`OS/硬件采集 (50 项)`) as in_progress。Do not print a literal header — task-list UI 自带 spinner。

### 2.1 · 读采集模板(若 Step 1.3 已 Read 过则跳过)

```
Read(file_path="${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/data/collect-cmds.json")
```

### 2.2 · 临时文件路径

强制 `~/.perf-kp-sql/tmp/`(绝对),不用 `/tmp`。TS = `YYYYMMDD-HHMMSS`,全程一致。Write 自动创建父目录。

### 2.3 · OS 指标采集

> osBatchCmd 单字符串包含 OS + 硬件两类指标 · 一次 SSH 跑完 · Step 2.3 / 2.4 共用同一次 SSH(只是活动行分组)。

打 OS 指标分组活动行:
```
  · 内存 · THP / 大页 / swappiness / dirty_ratio
  · 网络 · somaxconn / keepalive / tcp_max_syn_backlog
  · 磁盘 · iostat / 调度器 / 利用率
```

按 SSH execution pattern 跑(见 Architecture · 统一走 `ssh.mjs --op exec`),`<command>` = literal `osBatchCmd` from `collect-cmds.json` (do NOT improvise)。

osBatchCmd 含 `'` / `"` / `$` 混杂 → 走 `--command-file`(见 Architecture):
```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-os-<TS>.txt", content="<osBatchCmd 字面>")
Bash("node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/ssh.mjs --op exec --host <ip> --user <user> [--privateKeyPath <path> | --password '<pw>'] --port <n> --command-file /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-os-<TS>.txt")
```

Set timeout ≈ 60 seconds。

**解析 JSON**:`ssh.mjs --op exec` 返回 `{"stdout":"...","stderr":"...","exitCode":N}`。
- `exitCode===0 && stdout` 非空 → 成功
- `stdout=="" && stderr==""` → SSH 不通,走 Gate 4 自检
- `err` 字段非空(典型:`SSH connection failed (255): ...`)→ 协议层失败(认证失败 / 路由不通),展开 troubleshooting checklist

osStdout Write 落盘(从 JSON 的 `stdout` 字段取):
```
Write(
  file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-os-<TS>.txt",
  content="<整段 osBatchCmd stdout 文本 · 不要 pipe 任何 tail/head/grep 过滤>"
)
```

**Write 顺序硬约束**:SSH → Write → 后续解析步骤,缺一不可。

### 2.4 · 硬件指标采集

> 与 Step 2.3 共用同一次 SSH · 此处只是**活动行分组**告知用户采的是什么 · 不再发新 SSH。

打硬件指标分组活动行:
```
  · CPU · LSE / 主频治理器 / NUMA / SMT / BIOS
  · 平台 · arch / kernel / virt / sys_vendor / product
  · 内存容量 · MemTotal / hugepages / pagesize
```

### 2.5 · 火焰图采集(phase 1 子项)

#### 2.5.1 · 公告火焰图能力

读 Step 1.3 已经锁定的 `flame_capable`,打活动行:
```
# flame_capable=oncpu+offcpu:
  · 火焰图工具 · 远端支持 on-CPU + off-CPU 双采

# flame_capable=oncpu:
  · 火焰图工具 · 远端仅装了 perf · 仅采 on-CPU(offcputime-bpfcc 未装)

# flame_capable=none:
  · 火焰图工具 · 远端未装 perf · 跳过本次火焰图采集
    (如需 on-CPU 火焰图: yum/apt install linux-tools / perf)
    (如需 off-CPU 火焰图: 安装 bcc-tools / bpfcc-tools)
```

> 公告内容来自 Step 1.3 内存状态;**不许**在此处再起一次 `command -v perf` SSH 探测。

#### 2.5.2 · 实际采集(仅 `flame_capable ≠ none`)

`flame_capable=none` 时跳过整个 2.5.2 子步骤,直接进 Step 2.6。

打活动行:
```
  · 火焰图 · perf record · oncpu 3s · pid=<pid> 进程=<engine 进程名>
  · 火焰图 · offcpu 3s · pid=<pid>             # 仅 oncpu+offcpu 时多打
```

调 capture-flamegraph.mjs(凭据用真实未脱敏密码,单引号包裹;wrapper 内部自定位 cpu-flamegraph 插件):
```
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/capture-flamegraph.mjs \
       --host=<ip> --user=<user> --password='<真实pw>' [--port=<n>] \
       --process=<engine 进程名> --type=oncpu --duration=3 --engine=<engine>")
```

> ⚠️ **capture-flamegraph.mjs 的 stdout 必须整段落盘 · 严禁 pipe 任何过滤命令**(wrapper 透传内部 capture.mjs 的 stdout):
> - 不要 `2>&1 | tail`、`| head`、`| grep`、`| jq -r`、`| awk` 等管道
> - 不要 `> /dev/null` 重定向
> - 一过滤就废 JSON · 后续 Read parse 必爆 `Unexpected token '}'`
> - 调试时若想看末尾,落盘后 `Read(..., offset=N, limit=K)` 看,**不要在 wrapper 调用处过滤**
> - run_in_background:true 模式特别注意:管道结果会落到 background output 文件,等于把 JSON 写残

`flame_capable=oncpu+offcpu` → 再调一次 `--type=offcpu`(同样**整段落盘**,不要过滤)。

拿到完整 JSON 后立即 Write 落盘:
```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/flame-json-<TS>.json", content="<capture.mjs 返回的完整 JSON · 一字不漏>")
```

记录 `artifacts.serverSvgPath`,拉 SVG:
```
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/ssh.mjs --op exec \
       --host <ip> --user <user> --password <pw> [--port <n>] \
       --command 'cat <artifacts.serverSvgPath>' \
       --output-file /Users/<yourlogin>/.perf-kp-sql/flame/<TS>-oncpu.svg")
```

双采各拉一次。LLM 不接触 SVG 内容。

**任一环节失败 → 静默降级**(双采失败 oncpu→ 仅 oncpu;oncpu 失败 → flame_capable=none),活动行加 `· 火焰图降级 · <reason>`,**不阻塞主流程**。

### 2.6 · 三部分数据解析(统一识别行)

> 这是 phase 1 的收尾——把 OS / 硬件 / 火焰图 三部分数据统一打成识别行给用户看。

#### 2.6.1 · 解析 OS 文件拿硬件元数据

```
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/ssh.mjs --op discover --os-file /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-os-<TS>.txt --hint-engine <engine>")
```

> ⚠️ 此处调 `--op discover` **只为拿 os hw 字段**(cpu_model / kernel_version / os_id / total_mem_mb / virt / ...)。返回的 `instances` 字段**忽略不读** — 实例信息 Step 1.3 已经锁定,不重新读。`osBatchCmd` 已经移除 `###DISCOVERY###`,所以 instances 字段会是空数组或 fallback 默认推断,不可信。

#### 2.6.2 · 打统一识别行

```
  · 硬件 · <cpu_model> · <arch> · <cpu_cores> core · <GB>
  · 操作系统 · <os_id> <os_version> · Linux <kernel_version> · <virt>
  · 火焰图采样 · oncpu <采样窗口> · top1=<func> <pct>%   # 仅采到时
  · 火焰图采样 · 跳过(perf 未装)                         # 跳过时
```

填值规则:
- `total_mem_mb` 除 1024 得 GB(1 位小数)
- `numa_nodes ≥ 2` 才显示 NUMA 节点数
- `cpu_model` 空 → `"CPU 未识别"`
- 火焰图采样:从 flame-json 拿 `totalMs` / `top1.name` / `top1.percent`(老版字段)或 `summary` 文本截取

> ⚠️ **不重复打"数据库实例"行** — Step 1.3bis 已经在 PLAN 阶段就把实例信息打过了,这里 phase 1 收尾只补 OS/硬件/火焰图三类,实例不重复。

打完识别行后 mark phase 1 as completed and phase 2 (`<engine> 运行时采集`) as in_progress (single re-send)。

### 2.7 · DB 批量采集

打分组活动行:
```
  · WiredTiger · cache / 并发 ticket / ...
  · 连接池 · 当前 / 可用上限 / ...
  · 锁与断言 · global lock / asserts / ...
```

按 SSH execution pattern 跑(见 Architecture · 统一走 `ssh.mjs --op exec`),`<command>` = `dbBatchTemplates.mongo` 占位符替换后的字符串。占位符:`__BIND__` / `__DB_PORT__` / `__MONGO_USER__` / `__MONGO_PWD__` / `__AUTH_DB__` / `__AUTH_ARGS__`。

模板(dbBatchCmd 含 ' / " / $ 混杂 → 走 --command-file):
```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-db-<engine>-<TS>.txt", content="<dbBatchCmd 替换占位符后>")
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/ssh.mjs --op exec \
       --host <ip> --user <user> [--privateKeyPath <path> | --password '<ssh_pw>'] --port <n> \
       --command-file /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-db-<engine>-<TS>.txt")
```

Set timeout ≈ 60 seconds。

#### 失败兜底("连不上反向问")

**MongoDB stderr `requires authentication` / `Authentication failed`** → 问凭据(最多 3 轮):
> ━ MongoDB 账号 · 密码 · 认证库 ━
> 请提供:
>   - mongo_user(默认空 = 匿名)
>   - mongo_password
>   - auth_db(默认 admin)
> 提供后将自动重试,最多 3 轮。

Stop and wait for the next turn。

**mongosh stderr `connect failed` / `Authentication failed` 或 stdout 空** → 反向确认配置:
> ━ MongoDB 连接失败 ━
> 已尝试:`<bind>:<port>` 用户=`<mongo_user>`(来自 Step 1.3 探测 / 用户显式传入)
> 可能原因:bind / port / 凭据 / auth_db / 防火墙
> 请确认配置后重新触发本 skill。

Stop and wait for the next turn。

**连续 2 轮失败** → 整段跳过,在报告里标注"DB runtime 数据缺失",phase 2 仍标 completed。

dbStdout Write 落盘:
```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-<engine>-db-<TS>.txt", content="<dbBatchCmd 拿到的全部 stdout 文本>")
```

mark phase 2 as completed。

### 2.8 · 写入 history

SSH + DB 都成功后静默调:
```
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/history.mjs --op save --host <host> --user <user> --port <ssh_port> --engine <engine>")
```

失败静默忽略,不打屏。

### 2.9 · 收 SSH 长连接(session-close)

Step 2 是本 skill 唯一的 SSH 阶段(Step 3-5 都是本地分析)。这里显式收 ControlMaster · 立即释放远端 socket · 不等 ControlPersist=600 自然到期:

```
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/ssh.mjs --op session-close --host <ip> --user <user> --port <n>")
```

返回 `{"ok":true,"controlPath":"..."}` 即正常收尾(socket 不存在或 master 已退出也算 ok)。**失败静默忽略**:即使没收成功,master 也会到期自动退,不影响诊断结果。

---

## Step 3 · 本地分析

### 3.0 · 进入 task 3

Mark phase 3 (`规则诊断 (<R> 条)`) as in_progress in the task list.

打 3 行严重度分组活动行(v0.5.1 · 跟 task 3 detail 对齐 · 替代旧单行 `· 加载 N 条规则(蒸馏自 X 篇 ...)`):

```
  · critical <C> · <代表项 1> / <代表项 2> / <代表项 3> / ...
  · warning <W>  · <代表项 1> / <代表项 2> / <代表项 3> / ...
  · info <I>     · <代表项 1> / <代表项 2> / <代表项 3> / ...
```

严重度计数(数值来自实测,不要编 · 0.9.2 起只 mongo):

| 总规则 R | critical C | warning W | info I |
|----------|------------|-----------|--------|
| 44       | 5          | 26        | 13     |

来源 `sqlite3 data/knowledge.sqlite "SELECT severity, count(*) FROM rules WHERE enabled=1 AND engine IN ('mongo','any') GROUP BY severity"`。代表项从 diagnose.mjs 输出 top issues 抽 · 优先 critical · 不要瞎编。

### 3.1 · Bash 调 diagnose.mjs

```
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/diagnose.mjs --engine <engine> --summary-only --os-file <os-path> --db-file <db-path> --out-json <diag-json-path>")
```

`--summary-only` 避免 LLM 上下文爆炸。返回 summary JSON < 2KB。完整 JSON 写到 `--out-json` 供后续脚本消费。

矩阵不在此处渲染,推迟到 Step 4.3。

### 3.2 · RAG 查知识库

Mark phase 3 as completed and phase 4 (`知识库检索 (54 篇)`) as in_progress.

首选 read 目录 + INDEX.md:
```
Read(file_path="${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/data/<engine>/INDEX.md")
Read(file_path="${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/data/<engine>/<file>.md")
```

可选 Grep(报 rg 未安装则回退 Read)。

> ⚠️ **Step 3 严禁任何 SSH**。火焰图采集已在 Step 2.5 完成,perf 探测已在 Step 1.3 完成。

---

## Step 4 · REPORT

### 4.0 · kb-stats

```
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/kb.mjs --op stats --engine <engine>")
```

返回 `subtitle` 字段存入报告 metadata。

### 4.1 · 跳过(render-html-report.mjs 包办)

### 4.2 · 一条 Bash 直出 HTML

Mark phase 4 as completed and phase 5 (`报告渲染`) as in_progress.

```
node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/render-html-report.mjs \
     /Users/<yourlogin>/.perf-kp-sql/reports/perf-kp-sql-<engine>-<TS>.html \
     --from-diagnose <diag-json-path> \
     --from-flame-json /Users/<yourlogin>/.perf-kp-sql/tmp/flame-json-<TS>.json \
     --ssh-user <你 Step 1 用的 SSH user> \
     --ssh-host <你 Step 1 用的 SSH host / IP> \
     --ssh-port <你 Step 1 用的 SSH 端口 · 默认 22> \
     --os-collect-path /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-os-<TS>.txt \
     --db-collect-path /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-<engine>-db-<TS>.txt
```

> ⚠️ **`--ssh-user / --ssh-host / --ssh-port` 必填。** 远端 mongod 监听的 bind=127.0.0.1 是远端进程视角的本地 IP · 用户视角下毫无意义。报告"目标主机 / 数据库地址"列必须用 LLM 在 Step 1 实际 SSH 连接的 user@host:port · 否则报告里全是 127.0.0.1 看不出在诊断哪台机器。
>
> ⚠️ **`--os-collect-path / --db-collect-path` 必填。** 路径直接复用 Step 2 osStdout / dbStdout Write 落盘的实际路径,给报告"采集与产物"段用。不传会导致用户看到的路径栏显示"(未传入)"占位符,且无法点开对应文件。

After the shell returns ok, mark phase 5 as completed (final state: all 5 ✔).

### 4.2bis · KB 扩展资料

对每条 critical/warning rule:
```
Bash(node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/kb.mjs --op query --rule-id <rule_id> --engine <engine> --top-k 3)
```

query-kb 失败 → 跳过,不影响主体。

### 4.3 · 屏幕 footer

```
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/render-screen-footer.mjs \
       --from-diagnose <diag-json-path> \
       --report-path <html-报告绝对路径> \
       [--from-flame-json <flame-json-path>] \
       [--format markdown|box|auto]")
```

**LLM 必须用 Bash 工具执行上述命令。** 然后把脚本 stdout **作为普通文本逐行原样输出**到对话——不重绘、不包裹、不重排。
不再需要 LLM 单独 echo 火焰图的 `terminalReport`，因为脚本已经读取了 flame-json 并自动把它合并到了 footer 里面，而且参考编号也一起合并了。

#### 4.3.1 · `--format` 自适应（v0.22.0+）

脚本根据当前 harness 自动选择渲染格式:

| 模式 | 用法场景 | 输出特点 |
|---|---|---|
| `markdown`(默认 · CC / OH-SQL) | harness 渲染 Markdown | `## 标题` H2 + `\| col \|` MD pipe table + flame 段包 ` ``` ` fenced code block 保等宽对齐 |
| `box`(Codex CLI) | harness 不渲染 Markdown | `═══ 标题 ═══` + 全 box-drawing 表格(`╭─┬─╮ │ ╰─┴─╯`)+ cell 按视觉宽度 padding(CJK=2、ASCII=1) |
| `auto`(默认) | 自动探测 | 看到 `$CODEX_PLUGIN_ROOT` env → box;否则 → markdown |

显式 override 优先级(从高到低):`--format <mode>` flag → `$PERF_KP_SQL_FORMAT` env → `auto` 探测。**99% 情况下 agent 不传 `--format` 即可**(auto 已经够用);仅在用户明确反馈"输出格式不对"时,agent 可加 `--format box` 或 `--format markdown` 重跑。

#### 4.3.2 红线 · footer 输出格式（违反即视为破规）

- ❌ **禁止 LLM 自己用 fenced code block 包裹整个 footer** —— `` ``` ``、`` ```markdown ``、`` ```text `` 一律不许由 LLM 在 footer 输出前后加包裹(脚本内部 markdown mode 下会自行给 flame 段包 ` ``` `,这是脚本设计 · LLM 不要再多包一层)
- ❌ **禁止用引用块包裹** —— 不许在 footer 行首加 `> `
- ❌ **禁止用缩进代码块** —— 不许在 footer 行首加 4 空格 / tab
- ❌ **禁止把脚本输出的表格重写改格式** —— markdown mode 拿到 `\| col \|`、box mode 拿到 `╭─┬─╮`,LLM 都按字面输出,不许互相转换
- ❌ **禁止把 Markdown pipe table 重排** —— 列宽对齐、表头加粗、添加分隔线全都不许做(脚本已对齐过)
- ✅ stdout 含 `|---|` 形式的表格分隔线时,**默认按 Markdown 正文输出**,渲染 Markdown 的聊天界面会自动渲染成原生表格
- ✅ stdout 含 `╭─┬─╮ / │ / ╰─┴─╯` 等 box-drawing 时,直接按字面输出,等宽终端会自动对齐成可视表格
- ✅ 允许在脚本 stdout **前后** 补 1-2 句简短说明(中文一两行),但**表格本体逐行原样保留**
- ✅ 仍然允许:执行 `render-screen-footer.mjs` 命令本身;不再单独 echo 火焰图 terminalReport;不复制整份 HTML 报告到对话

**错误示例**:

````
```text
## 诊断结果
| 模块 | 严重 | ... |
| --- | --- | --- |
| ... |
```
````

(LLM 把整段塞进 fenced block → 表格分隔线被当字面量,聊天界面只看到一坨字符)

**正确示例(markdown mode)**:

```
## 诊断结果

| 模块 | 严重 | ... |
| --- | --- | --- |
| ... |
```

**正确示例(box mode)**:

```
═══ 诊断结果 ═══

╭───────┬──────┬──────╮
│ 模块  │ 严重 │ ... │
├───────┼──────┼──────┤
│ os    │  1   │ ... │
╰───────┴──────┴──────╯
```

(直接输出 → 聊天界面按 Markdown 渲染成原生表格)

### 4.4 · NotebookLM 深入分析（诊断后增强）

footer 渲染完毕后,根据 NotebookLM 配置状态自动切换三档行为:

**检查状态**:

```
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/notebooklm.mjs --op check --json")
```

**三档行为**:

| 状态 | 行为 |
|---|---|
| `installed=true` + `authenticated=true` + notebooks 非空 | **自动查询**:对每条 critical/warning 执行 query-batch,结果作为"深入分析"段直接附在 footer 下方 |
| `installed=true` + `authenticated=false` | 一行提示: `⚠️ NotebookLM 认证已过期,深入分析暂不可用。运行 /perf-kp-sql-setup 重新配置。` |
| `installed=false` 或 notebooks 为空 | 一行提示: `💡 运行 /perf-kp-sql-setup 启用 NotebookLM 知识增强,获取更详细的参数解释和优化建议。` |

**自动查询路径**（仅状态一）:

```
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/notebooklm.mjs --op query-batch \
       --from-diagnose <diag-json-path> \
       --hw-arch <kunpeng|x86_64> \
       --json")
```

解析返回的 JSON,对每条有 answer 的 result,在 footer 下方按如下格式输出:

```
━ <参数名> · 深入分析 ━

<answer 内容>

引用:
[1] <cited_text>
[2] <cited_text>
```

查询超时或失败 → 静默跳过该条,不阻塞。

---

## Step 5 · 知识追问(follow-up)

skill 加载后,任何非 `/` 命令的自然语言输入优先走 NotebookLM,降级走本地 KB:

**有 NotebookLM**（check 返回 installed + authenticated + notebooks 非空）:

```
Bash(command="node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/notebooklm.mjs --op query \
       --domain auto \
       --query \"<原话>\" \
       --json")
```

`--domain auto` 时脚本内部按关键词路由:
- `vm.swappiness` / `dirty_ratio` / `hugepage` / `THP` / `sysctl` / `cgroup` → `os`
- `wiredTiger` / `mongod` / `oplog` / `sharding` / `连接池` / `journal` → `mongo`
- `鲲鹏` / `Kunpeng` / `ARM` / `NUMA` → `kunpeng`
- 关键词未命中 → 查询所有已注册 notebook,合并回答

多 notebook 命中时,分别查询后合并回答,标注来源领域 + 引用原文片段。

**无 NotebookLM**（降级走本地 KB）:

```
Bash(node ${OHSQL_PLUGIN_ROOT}${CLAUDE_PLUGIN_ROOT}/scripts/kb.mjs --op query --q "<原话>" --engine <engine> --top-k 5)
```

results 非空 → 模板 A(从 content_zh 提炼,句末 `[参考N]`,末尾列 URL)。

results 空 → 模板 B:
```
非常抱歉 · 您的 KB 中并未收录「<主题>」的相关资料。
如果基于 KB 之外的一般常识回答(请注意 · 非 KB 来源 · 需独立验证):
<一句话 · ≤50字 · 末尾 "请独立验证">
```

模板 B 不挂 `[参考N]`。涉及命令/代码/阈值的回答,要么 KB 背书带 [参考N],要么走模板 B 带 disclaimer。

无 NotebookLM 时每次追问后附一行提示:
```
💡 如需更精准的参数解释,请运行 /perf-kp-sql-setup 配置 NotebookLM 知识增强。
```

---

# 红线

- SSH 走本地 `ssh` / `scp` CLI(see Architecture · SSH execution pattern); 不调任何 agent 的私有 SSH tool(`SshExec` / `SshUpload` / `FlameGraph` 等)
- 只读诊断,不修改远端配置
- **禁止用 inline-script 替代 Write 工具** —— 不用 `python3 -c '...'` / `python3 - <<'PY'` / `node -e '...'` / `cat <<'EOF' > file` / `sed -i ...` / `awk -i ...` 任何形式的"行内脚本写文件";落盘必须走 Write 工具(实在写不进 `~/.perf-kp-sql/tmp/` 时报错给用户,不偷偷换路径、不绕路改写法)
- 不用 fenced code block / 引用块 / 缩进代码块包裹 `render-screen-footer.mjs` 的 stdout(详见 Step 4.3 的红线小节)
- 不复制报告全文到对话
- banner 输出前不调远端 SSH 命令
- 问用户时 header / topic 只写具体字段名,不用模糊词
- 不 `find` 脚本路径;MODULE_NOT_FOUND 唯一根因是缺 build 产物
- 不用 `/tmp/` 落盘
- 不跳过 Step 1.3 环境探测(instance discovery 已合并入 1.3)
- 不跳过 Step 4 落盘报告
- **Step 1.3 环境探测无条件先跑,再声明 task list**;不许先声明带 `(待探测)` 占位的 task list
- 0.9.2 起只支持 `engine=mongo` (默认即 mongo);0 实例 → 按 mongo 默认端口 27017 推断;**只有 Step 2.7 DB 连不上时反向问用户 bind/port/凭据**
- **Step 2 整段绝对禁止任何探测性 SSH**(`command -v perf` / `pgrep` / `ss -lntp` 等):perf 探测在 1.3 已做、实例发现在 1.3 已做、连接性等到真正采集时才暴露
- **火焰图采集只发生在 Step 2.5,作为 phase 1 子项展示;Step 3 / Step 4 严禁 SSH;没有"火焰图补采"路径(原 Step 5 已删除)**
- task 工具可用时(Claude Code / Codex CLI),**只许调 task 工具,不许另外用纯文本渲染 `━ 5 阶段任务清单 ━` / `◻ phase 1 · ...` 重复列出**
- **不向用户输出内部实现术语**(详见下方独立一节《用户可见消息 · 禁用元词清单》)
- 工具失败 → 静默重试 1 次,第 2 次仍失败 → 一行 diagnostic 跳过,cap=2
- 不道歉 / 不反省 / 不自述内部出错

# 用户可见消息 · 禁用元词清单

发给用户的中文消息(包括活动行 / 询问 / 总结)里**绝对不许出现**以下英文坐标词或内部实现术语。这些是 SKILL 给 LLM 看的内部坐标,用户屏幕上看到要先在脑里翻译成中文动作才能理解 — 直接违反"对用户讲人话"原则。

**禁用清单**:

| 禁用词 | 说明 |
|---|---|
| `phase 1` / `phase 2` / ... / `phase N` | SKILL 内部的阶段编号,用户不需要知道编号 |
| `task 1` / `task 2` / `task N` | task 工具的内部 id,用户看 spinner 就够了 |
| `task list` / `任务清单`(用作元词) | task 工具 UI 已经显示,不要在文字消息里再提 |
| `Step 1.0bis` / `Step 1.3` / `Step 2.5` / `Step X.Y` | SKILL 章节坐标 |
| `flame_capable` / `flame_capable=oncpu` | 内部状态字段名 |
| `db_creds_skip` / `_notes` / `hint_engine` 等程序字段 | 程序状态变量 |
| `数字硬编` / `数据硬编` / `phase 项数对照表` | SKILL 文档术语 |
| `1.2bis` / `1.3bis` 等小步编号 | 同 Step |
| `osBatchCmd` / `dbBatchTemplates` / `probeCmd` | 程序模板名 |
| `--op probe-parse` / `--op discover` 等命令行参数 | 程序参数 |

**判断规则**:看输出时把每个英文坐标词圈出来 — 如果用户得在脑里翻译成"哦,这是第几阶段哪一步",**就违规**。直接说做什么。

**错 / 对对照**:

| 错(我之前犯过) | 对 |
|---|---|
| `声明 task list(mongo,task 2 挂 engine 前缀)` | `采集计划已就绪。` 或不说 |
| `phase 1 → completed · phase 2 → in_progress` | `OS/硬件采集完成,进入 MongoDB 运行时采集。` |
| `Step 2.6 · 三部分数据解析(统一识别行)` | `汇总采集结果:` |
| `Step 2.5 火焰图采集(flame_capable=oncpu, 仅 on-CPU)` | `开始采火焰图(仅 on-CPU)。` |
| `flame_capable=none → 整段跳过 Step 2.5.2` | `远端无 perf,跳过火焰图采集。` |
| `1.2bis 触发了 → 用户选 2(自动探测)` | `按"自动探测"继续。` |
| `调 probe-parse 解析后 instances 字段为 1` | `远端检测到 1 个数据库实例。` |

**特例 — 调试 / 诊断给用户的错误信息可以含实现术语**:
- 当用户**显式提到**这些词时(例:"为什么 Step 1.3 报错"),可以在回话里复用,因为这是技术对话上下文
- 报错诊断行(给开发者读的,如 `Permission denied (publickey,...)`)可以原样显示,因为是系统层面的

**工程化提示**:写完一段用户可见消息,**回头扫一遍**,搜上面禁用清单里的词,有就改写。

# 参考文件

| 文件 | 用途 |
|---|---|
| `data/collect-cmds.json` | `probeCmd`(Step 1.3 探测) + `osBatchCmd` + 3 engine `dbBatchTemplates` |
| `data/common/` | Kunpeng + OS 通用知识库 |
| `data/<engine>/INDEX.md` | per-engine KB 目录 |
| `data/<engine>/rules.json` | per-engine 规则 JSON |
| `data/<engine>/*.md` | per-engine 文档 |
| `scripts/ssh.mjs --op exec` | SSH 远端执行 |
| `scripts/ssh.mjs --op probe-parse` | Step 1.3 解析 probe 文件 → JSON(instances + flame_capable) |
| `scripts/ssh.mjs --op discover` | Step 2.6 解析 OS 文件 → 取 hw 字段(instances 字段已废,因 osBatchCmd 不再产 ###DISCOVERY###) |
| `scripts/history.mjs --op load` | 读历史连接 |
| `scripts/history.mjs --op save` | 写历史连接 |
| `scripts/diagnose.mjs` | 本地分析脚本 |
| `scripts/kb.mjs --op query` | KB 混合检索 |
| `scripts/kb.mjs --op stats` | KB 统计 |
| `scripts/render-html-report.mjs` | HTML 报告生成 |
| `scripts/render-screen-footer.mjs` | 屏幕 footer 生成 |

# 输出契约

- 报告文件名:`perf-kp-sql-<engine>-<TS>.html`,TS = `YYYYMMDD-HHMMSS`
- 诊断完直接给结论,不追问"要不要补做 X"

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
