---
name: perf-kp-sql
description: Kunpeng ARM64 + multi-database (MongoDB / MySQL / Redis) joint performance diagnosis. Runs SSH-based remote collection (50 OS metrics + per-engine runtime), evaluates 59-39 enabled rules from a sqlite knowledge base (FTS5 trigram + sqlite-vec 384-dim semantic search), and emits an impact-ranked HTML report with authoritative citations. Use when users report database slowness, CPU spikes, latency jitter, query timeouts, or are doing Kunpeng migration / config audit. Triggers include '数据库慢' / 'CPU 高' / '抖动' / 'mongo perf' / 'mysql 慢查询' / 'redis 延迟' / 'Kunpeng 性能' / similar phrases. First-time use:run `/perf-kp-sql-setup` to install native deps.
compatibility: |
  Requires SSH access to the target host. Two auth modes:
  - SSH key (recommended, all agents): pass `privateKeyPath=<path>`. Works on
    Claude Code, OpenAI Codex CLI, ohsql, and any agent with shell access.
  - SSH password (Claude Code + ohsql only): pass `password=<pw>`. Requires
    `sshpass` locally; OpenAI Codex CLI sandbox blocks `sshpass` — Codex users
    must run `ssh-copy-id` once and switch to key auth.
  Native deps installed via `/perf-kp-sql-setup`: better-sqlite3, sqlite-vec,
  ssh2, @xenova/transformers (~30MB total + 25MB MiniLM model).
  Supported database engines: mongo (MongoDB 3.6-7.x), mysql (5.7-8.x),
  redis (6.x-7.x). Knowledge base: 411 baseline rules + 54 distinct authoritative
  documents (Anthropic + Kunpeng + WiredTiger + MongoDB official + ...).
metadata:
  generator: "manual"
  generated_at: "2026-04-26"
argument-hint: "host=<ip> user=<user> (privateKeyPath=<path>|password=<pw>) [engine=mongo|mysql|redis] [port=<ssh_port>]"
---

# Pre-flight

> **首次安装后**:跑 `/perf-kp-sql-setup` 完成 native 依赖检查与安装(better-sqlite3 / sqlite-vec / ssh2 / @xenova/transformers + knowledge.sqlite 完整性)。setup skill 会在缺依赖时给出 `npm install` 命令并自动执行。

每次本 skill 触发,直接进入 Step 1 — `/perf-kp-sql-setup` 已经把 build 产物和 native 依赖都校验过了。运行时若仍出现 `Cannot find module 'better-sqlite3'` 或 `NODE_MODULE_VERSION X != Y`,提示用户重跑 `/perf-kp-sql-setup`。

---

# Architecture

- **Collect** — local shell + `ssh` CLI (key auth recommended; password auth via `sshpass` on supported agents) runs per-engine batch commands on the remote host
- **Persist** — write stdout to `~/.ohsql/tmp/perf-kp-sql-<engine>-{os,db}-<ts>.txt` (NOT `/tmp` — sandboxes vary)
- **Analyze** — local shell: `node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/diagnose.mjs --os-file ... --db-file ... --engine <name>`
- **Knowledge base** — read / grep over `${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/data/<engine>/` + `data/common/`
- **Flamegraph** — local shell: `node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_DEP_CPU_FLAMEGRAPH_ROOT}/scripts/capture.mjs ...` (cpu-flamegraph plugin)
- **Report** — local shell: `node .../scripts/render-html-report.mjs` + `render-screen-footer.mjs`

> ⚠️ Some agent shell sandboxes reject heredoc / `>` / `<` / `|` / 3+ consecutive quotes. Strictly use **write-file → shell (no redirection) → write-file** for the collection chain.

## SSH execution pattern

This skill SSHs to the target host multiple times. **Use the agent's shell tool to invoke local `ssh` / `scp` CLI** (no SshExec / FlameGraph / Sql* — those bind to one specific kernel). Both auth modes are supported:

**Mode A · SSH key auth (recommended, all agents)** — when `privateKeyPath=<path>` was provided:

```bash
ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
    -i <privateKeyPath> -p <port> <user>@<host> '<command>'
```

**Mode B · SSH password auth (Claude Code + ohsql only)** — when `password=<pw>` was provided:

```bash
sshpass -p '<password>' ssh -o StrictHostKeyChecking=accept-new \
    -p <port> <user>@<host> '<command>'
```

**On OpenAI Codex CLI (sandbox blocks `sshpass`)** — when only `password=<pw>` is given, **stop the workflow and ask the user**:

> Codex CLI's sandbox blocks `sshpass` so SSH password auth is unavailable here.
> Please run once on your local machine:
>   `ssh-copy-id -i ~/.ssh/id_ed25519.pub <user>@<host>`
> Then re-invoke this skill with `privateKeyPath=~/.ssh/id_ed25519` instead of `password=...`.

**stdout-non-empty = success** rule: if shell returns non-empty stdout, treat as success regardless of exitCode / red-rendering / stderr WARN/deprecated noise. Only when **both stdout and stderr are empty** does SSH actually fail (no auth / no route).

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

# Workflow

## Step 1 · PLAN

**banner 必须在任何远端 SSH 命令(or remote `scp` / `node ...flamegraph capture` invocation)之前渲染。** 本地参数收集(history load · prompts to user)不受限。

### 1.0bis · 历史复用

触发:slash args 缺 host 时。

```
Bash(command="node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/history.mjs --op load --max 5")
```

hosts 非空 → ask the user to pick one (even if there's only 1 entry — explicit confirmation):

```
请选择最近使用过的连接 · 或新建:

  1. 124.70.180.36 · root · mongo · 上次 2 小时前 (port=22 · 累计 8 次)
  2. 10.20.30.40 · ec2-user · mysql · 上次 3 天前 (port=22 · 累计 3 次)
  3. 新连接 · 手动输入参数
```

Stop here and wait for the user's selection in the next turn. Once selected, fully decode the JSON (`host / user / port / engine / password / privateKeyPath / mongo_user / mongo_password / auth_db`) into the parameter set.

**No stopping after selection**: same turn → render banner → run env probe (Step 1.3 · 无条件) → declare 5-phase task list → mark phase 1 in_progress → run SSH OS collection.

### 1.1 · 参数抽取

从用户任意措辞抽取:
- 必填:`host`(IP/FQDN)、`user`、`password`(或 `privateKeyPath`)
- 可选:`port`(默认 22)、`engine`(mongo/mysql/redis)
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

**Class 2 格式非法** — host 非合法 IP/FQDN、port 非 1-65535、engine 不在支持集合:

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
  · host=124.70.180.36 · user=root · port=22 · engine=mongo
  · password=YAN***216
  · mongo_password=YAN***216 · auth_db=admin
```

password 前 3 + `***` + 后 3 脱敏。后续 SSH 命令的 host/user/port/password/privateKeyPath 参数必须与 banner 字段一一对应。

### SSH 参数门

**Gate 2** — SSH 命令的 host/user/port/password/privateKeyPath 必须与 banner 字面一致。

**Gate 3** — history 里 password 非空 → 必传;privateKeyPath 非空 → 必传;两者都空 → 先问凭据。

**Gate 4** — SSH 命令返 stdout=stderr="" 时:
1. 打自检行(实发参数 vs history 比对)
2. 发现漏传 → 同 turn 重试
3. 全传齐仍空 → 走紧凑二次收集

### 1.3 · 环境探测(无条件 · 一次 SSH 全做完)

**触发**:无条件跑(不管 `engine=auto` / 显式 / 缺省)。本步是采集阶段唯一前置 — 拿到 engine + 实例(pid/bind/port)+ 火焰图工具能力(perf / offcputime-bpfcc)三类信号,锁住后 Step 2 采集阶段绝对禁止任何探测性 SSH。

**为什么前置**:
- Step 1.4 task list 的「运行时采集 (<N> 项)」「规则诊断 (<R> 条)」依赖 engine 才能填实数
- Step 2.5 火焰图采集需要 pid + 提前知道 perf/offcpu 是否在场,不能等到 OS 50 项采集完(~60s)再回填
- 显式 engine 用户也需要拿 pid/bind/port — 这些是主机环境事实,跟用户偏好无关

**禁止**:Step 2 整段不许出现 `command -v perf` / `pgrep` / `ss -lntp` 等探测性 SSH,所有探测在本步完成。

打 1 行活动行(banner 之后,task list 之前):
```
  · 环境探测 · 引擎进程 / 实例 bind+port / 火焰图工具
```

读 probe 命令并 SSH:
```
Read(file_path="${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/data/collect-cmds.json")
```

run via the SSH execution pattern (see Architecture section), substituting `<command>` with the literal `probeCmd` string from `collect-cmds.json`. Set timeout ≈ 15s。

probe stdout Write 落盘:
```
Write(
  file_path="/Users/<yourlogin>/.ohsql/tmp/perf-kp-sql-probe-<TS>.txt",
  content="<此处填入 SSH probe 命令刚拿到的全部 stdout 文本>"
)
```

调 probe-parse 解析:
```
Bash(command="node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/ssh.mjs --op probe-parse --probe-file /Users/<yourlogin>/.ohsql/tmp/perf-kp-sql-probe-<TS>.txt --hint-engine <engine|skipped>")
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

**0 实例** + `engine=auto`/缺省 → 远端三引擎进程都没起。打:
> ━ 远端未发现数据库进程 ━
> 已扫:mongod / mysqld / redis-server,均无 pgrep 命中。
> 请确认目标主机数据库是否已启动,或显式传 `engine=mongo|mysql|redis`(将以默认端口推断方式继续)。

Stop and wait for the next turn。

**0 实例** + 显式 `engine=mongo|mysql|redis` → **信用户**,走兜底:bind=127.0.0.1,port=默认(27017/3306/6379),pid 留空(火焰图自动跳过 oncpu),打:
```
  · 警告 · 远端未发现数据库进程 · 按用户配置 engine=<X> 继续 · bind=127.0.0.1:<默认端口>
  · 数据库实例 · <engine> @ 127.0.0.1:<默认端口>(默认端口推断 · 火焰图采集将跳过)
```

**1 实例** + 无 hint / hint 一致 → 直接锁定。

**1 实例** + 显式 hint 不一致(用户 mongo,远端只有 mysqld) → **信用户**,打 warning:
```
  · 警告 · 用户传入 engine=<X>,远端发现 <Y>;按用户配置继续,如连不上将反向确认
  · 数据库实例 · <X> @ 127.0.0.1:<X 默认端口>(默认端口推断)
```

**多实例** + `engine=auto` → ask the user (topic = `选择诊断目标`):
```
检测到多个数据库实例:
  1. mongo @ <bind>:<port> (pid=<pid>)
  2. mysql @ <bind>:<port> (pid=<pid>)
请选择诊断目标。
```
Stop and wait for the next turn。用户选定后继续。

**多实例** + 显式 hint → 取 instances 里 engine 字段匹配 hint 的那一条;无匹配 → 走 0 实例 + 显式 hint 的兜底(信用户,默认端口推断)。

#### 锁定的状态

`engine` + `bind` + `port` + `pid` + `flame_capable` 在内存里保留。**Step 2 全部子步骤共享这套状态,绝不重新探测**。火焰图能力公告 + 硬件/OS/实例 识别行**统一推迟到 task 1 收尾(Step 2.6)**,避免 PLAN 阶段抢 task UI 风头。

### 1.4 · 声明 task 清单

Declare a 5-phase task list using the agent's task-tracking facility (see "Task tracking pattern" in the Architecture section above). On Claude Code use `TodoWrite`; on OpenAI Codex CLI use `update_plan`; otherwise render as plain text.

If a previous task list exists from an earlier run in the same session, replace it (idempotent — both `TodoWrite` and `update_plan` overwrite the whole list). Do NOT append.

The 5 phases (English subject for portability, with Chinese display titles):

| # | Display title (subject) | Spinner verb (activeForm) | Count placeholder |
|---|-------------------------|---------------------------|-------------------|
| 1 | OS/硬件采集 (50 项)     | 采集 OS/硬件              | 50 (fixed) |
| 2 | 运行时采集 (<N> 项)     | 采集运行时                | <N>:mongo=18; mysql/redis omit `(N 项)` |
| 3 | 规则诊断 (<R> 条)       | 诊断规则                  | <R>:mongo=59; mysql=38; redis=39 |
| 4 | 知识库检索 (54 篇)      | 检索知识库                | 54 (fixed) |
| 5 | 报告渲染                | 渲染报告                  | (no count) |

**Exactly 5 phases. Do NOT create extras (no "cleanup" or "init" phases).** Do NOT assume sequential IDs (1-5) — use whatever IDs the agent's task tool returns.

**v0.5.1 命名规则**:subject 名词在前 + 动词在后(`X采集` / `X诊断` / `X检索` / `X渲染`)· ≤ 5 字 · activeForm 动词在前(spinner verb 自然中文)· 不挂 engine 前缀。

**数字硬编表**(数据来源 = 实测 · 不要编):

| engine | task 1 (`OS/硬件采集`) | task 2 (`运行时采集`) | task 3 (`规则诊断`) | task 4 (`知识库检索`) |
|--------|----------------------|---------------------|--------------------|---------------------|
| mongo  | 50 项                 | 18 项                | 59 条               | 54 篇                |
| mysql  | 50 项                 | (不挂)               | 38 条               | 54 篇                |
| redis  | 50 项                 | (不挂)               | 39 条               | 54 篇                |

- task 1 = `src/shared/os-collector.ts` 中 `out["..."] = ...` 的去重 key 数(50)
- task 2 = `src/engines/<engine>/collector.ts` 中 `out["..."] = ...` 的去重 key 数(mongo=18 · mysql/redis 用结构体返回不平摊 · 不挂)
- task 3 = `sqlite3 data/knowledge.sqlite "SELECT count(*) FROM rules WHERE enabled=1 AND (engine='<engine>' OR engine='any')"`
- task 4 = `sqlite3 data/knowledge.sqlite "SELECT count(DISTINCT doc_id) FROM knowledge"`

mysql/redis 的 task 2 项数无法平摊 · 整段 `(<N> 项)` 删掉 · 不要瞎编。

---

## Step 2 · 采集

> ⚠️ **Step 2 全程禁止任何探测性 SSH**(`command -v` / `pgrep` / `ss -lntp`)。所有探测在 Step 1.3 已经一次完成。Step 2 只做"采"(SSH 跑 osBatchCmd / dbBatchTemplates / capture.mjs)和"展"(打识别行)。

### 2.0 · 进入 task 1

Mark phase 1 (`OS/硬件采集 (50 项)`) as in_progress。Do not print a literal header — task-list UI 自带 spinner。

### 2.1 · 读采集模板(若 Step 1.3 已 Read 过则跳过)

```
Read(file_path="${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/data/collect-cmds.json")
```

### 2.2 · 临时文件路径

强制 `~/.ohsql/tmp/`(绝对),不用 `/tmp`。TS = `YYYYMMDD-HHMMSS`,全程一致。Write 自动创建父目录。

### 2.3 · OS 指标采集

> osBatchCmd 单字符串包含 OS + 硬件两类指标 · 一次 SSH 跑完 · Step 2.3 / 2.4 共用同一次 SSH(只是活动行分组)。

打 OS 指标分组活动行:
```
  · 内存 · THP / 大页 / swappiness / dirty_ratio
  · 网络 · somaxconn / keepalive / tcp_max_syn_backlog
  · 磁盘 · iostat / 调度器 / 利用率
```

Run via the SSH execution pattern (see Architecture section), `<command>` = literal `osBatchCmd` from `collect-cmds.json` (do NOT improvise):

```bash
# Mode A · key auth:
ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
    -i <privateKeyPath> -p <port> <user>@<host> '<osBatchCmd>'

# Mode B · password auth (CC + ohsql):
sshpass -p '<password>' ssh -o StrictHostKeyChecking=accept-new \
    -p <port> <user>@<host> '<osBatchCmd>'

# Codex CLI with password-only: stop and ask user to use ssh-copy-id.
```

Set timeout ≈ 60 seconds。

**stdout-non-empty = success**;只有 stdout=stderr 都空才走 Gate 4 自检。失败兜底:第一次问凭据,第二次扩展 troubleshooting checklist。

osStdout Write 落盘:
```
Write(
  file_path="/Users/<yourlogin>/.ohsql/tmp/perf-kp-sql-os-<TS>.txt",
  content="<此处填入 SSH osBatchCmd 刚拿到的全部 stdout 文本>"
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

调 capture.mjs(凭据用真实未脱敏密码,单引号包裹):
```
Bash(command="node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_DEP_CPU_FLAMEGRAPH_ROOT}/scripts/capture.mjs \
       --host=<ip> --user=<user> --password='<真实pw>' [--port=<n>] \
       --process=<engine 进程名> --type=oncpu --duration=3 --engine=<engine>")
```

`flame_capable=oncpu+offcpu` → 再调一次 `--type=offcpu`。

拿到 JSON 后**立即 Write 落盘**:
```
Write(file_path="/Users/<yourlogin>/.ohsql/tmp/flame-json-<TS>.json", content="<capture.mjs 返回的完整 JSON>")
```

记录 `artifacts.serverSvgPath`,拉 SVG:
```
Bash(command="node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/ssh.mjs --op exec \
       --host <ip> --user <user> --password <pw> [--port <n>] \
       --command 'cat <artifacts.serverSvgPath>' \
       --output-file /Users/<yourlogin>/.ohsql/flame/<TS>-oncpu.svg")
```

双采各拉一次。LLM 不接触 SVG 内容。

**任一环节失败 → 静默降级**(双采失败 oncpu→ 仅 oncpu;oncpu 失败 → flame_capable=none),活动行加 `· 火焰图降级 · <reason>`,**不阻塞主流程**。

### 2.6 · 三部分数据解析(统一识别行)

> 这是 phase 1 的收尾——把 OS / 硬件 / 火焰图 三部分数据统一打成识别行给用户看。

#### 2.6.1 · 解析 OS 文件拿硬件元数据

```
Bash(command="node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/ssh.mjs --op discover --os-file /Users/<yourlogin>/.ohsql/tmp/perf-kp-sql-os-<TS>.txt --hint-engine <engine>")
```

> ⚠️ 此处调 `--op discover` **只为拿 os hw 字段**(cpu_model / kernel_version / os_id / total_mem_mb / virt / ...)。返回的 `instances` 字段**忽略不读** — 实例信息 Step 1.3 已经锁定,不重新读。`osBatchCmd` 已经移除 `###DISCOVERY###`,所以 instances 字段会是空数组或 fallback 默认推断,不可信。

#### 2.6.2 · 打统一识别行

```
  · 硬件 · <cpu_model> · <arch> · <cpu_cores> core · <GB>
  · 操作系统 · <os_id> <os_version> · Linux <kernel_version> · <virt>
  · 数据库实例 · <engine> @ <bind>:<port> (pid=<pid>) [· 默认端口推断]
  · 火焰图采样 · oncpu <N> 帧 · offcpu <M> 帧             # 仅采到时
  · 火焰图采样 · 跳过(flame_capable=none)                # 跳过时
```

填值规则:
- `total_mem_mb` 除 1024 得 GB(1 位小数)
- `numa_nodes ≥ 2` 才显示 NUMA 节点数
- `cpu_model` 空 → `"CPU 未识别"`
- `数据库实例` 行字段全部从 Step 1.3 锁定状态拿(bind/port/pid/engine);若 pid 为空(默认端口推断兜底)→ 加 `· 默认端口推断` 后缀
- 火焰图采样帧数从 flame-json 的 `summary.frames.oncpu` / `summary.frames.offcpu` 读

打完识别行后 mark phase 1 as completed and phase 2 (`运行时采集`) as in_progress (single re-send)。

### 2.7 · DB 批量采集

打分组活动行(按 engine):
```
# engine=mongo · 3 行
  · WiredTiger · cache / 并发 ticket / ...
  · 连接池 · 当前 / 可用上限 / ...
  · 锁与断言 · global lock / asserts / ...

# engine=mysql · 2 行
  · 引擎状态 · variables / status / processlist / ...
  · 连接 · max_connections / threads_connected / ...

# engine=redis · 2 行
  · INFO 指标 · memory / stats / clients / ...
  · slowlog / 大 key / ...
```

Run via the SSH execution pattern, `<command>` = `dbBatchTemplates[engine]` string after placeholder substitution。占位符:`__BIND__` / `__DB_PORT__` / `__USER__` / `__PWD__`(MongoDB 专属:`__MONGO_USER__` / `__MONGO_PWD__` / `__AUTH_DB__` / `__AUTH_ARGS__`)。

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

**MySQL stderr `Can't connect to MySQL server` / `Access denied` / Redis stderr `Connection refused` / `NOAUTH` 或 stdout 空** → 反向确认配置:
> ━ <engine> 连接失败 ━
> 已尝试:`<bind>:<port>` 用户=`<user>`(来自 Step 1.3 探测 / 用户显式传入)
> 可能原因:engine 类型给错 / bind / port / 密码 / 防火墙
> 请确认配置,或改 `engine=mongo|mysql|redis` 重新触发本 skill。

Stop and wait for the next turn。

**连续 2 轮失败** → 整段跳过,在报告里标注"DB runtime 数据缺失",phase 2 仍标 completed。

dbStdout Write 落盘:
```
Write(file_path="/Users/<yourlogin>/.ohsql/tmp/perf-kp-sql-<engine>-db-<TS>.txt", content="<dbBatchCmd 拿到的全部 stdout 文本>")
```

mark phase 2 as completed。

### 2.8 · 写入 history

SSH + DB 都成功后静默调:
```
Bash(command="node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/history.mjs --op save --host <host> --user <user> --port <ssh_port> --engine <engine>")
```

失败静默忽略,不打屏。

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

数字硬编(实测 · 不要编):

| engine | 总规则 R | critical C | warning W | info I |
|--------|--------|----------|-----------|--------|
| mongo  | 59     | 5        | 35        | 19     |
| mysql  | 38     | 3        | 20        | 15     |
| redis  | 39     | 4        | 21        | 14     |

来源 `sqlite3 data/knowledge.sqlite "SELECT severity, count(*) FROM rules WHERE enabled=1 AND (engine='<engine>' OR engine='any') GROUP BY severity"`。代表项从 diagnose.mjs 输出 top issues 抽 · 优先 critical · 不要瞎编。

### 3.1 · Bash 调 diagnose.mjs

```
Bash(command="node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/diagnose.mjs --engine <engine> --summary-only --os-file <os-path> --db-file <db-path> --out-json <diag-json-path>")
```

`--summary-only` 避免 LLM 上下文爆炸。返回 summary JSON < 2KB。完整 JSON 写到 `--out-json` 供后续脚本消费。

矩阵不在此处渲染,推迟到 Step 4.3。

### 3.2 · RAG 查知识库

Mark phase 3 as completed and phase 4 (`知识库检索 (54 篇)`) as in_progress.

首选 read 目录 + INDEX.md:
```
Read(file_path="${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/data/<engine>/INDEX.md")
Read(file_path="${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/data/<engine>/<file>.md")
```

可选 Grep(报 rg 未安装则回退 Read)。

> ⚠️ **Step 3 严禁任何 SSH**。火焰图采集已在 Step 2.5 完成,perf 探测已在 Step 1.3 完成。

---

## Step 4 · REPORT

### 4.0 · kb-stats

```
Bash(command="node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/kb.mjs --op stats --engine <engine>")
```

返回 `subtitle` 字段存入报告 metadata。

### 4.1 · 跳过(render-html-report.mjs 包办)

### 4.2 · 一条 Bash 直出 HTML

Mark phase 4 as completed and phase 5 (`报告渲染`) as in_progress.

```
node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/render-html-report.mjs \
     /Users/<yourlogin>/.ohsql/reports/perf-kp-sql-<engine>-<TS>.html \
     --from-diagnose <diag-json-path> \
     --from-flame-json /Users/<yourlogin>/.ohsql/tmp/flame-json-<TS>.json
```

After the shell returns ok, mark phase 5 as completed (final state: all 5 ✔).

### 4.2bis · KB 扩展资料

对每条 critical/warning rule:
```
Bash(node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/kb.mjs --op query --rule-id <rule_id> --engine <engine> --top-k 3)
```

query-kb 失败 → 跳过,不影响主体。

### 4.3 · 屏幕 footer

```
Bash(command="node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/render-screen-footer.mjs \
       --from-diagnose <diag-json-path> \
       --report-path <html-报告绝对路径> \
       [--from-flame-json <flame-json-path>]")
```

**LLM 必须用 Bash 工具执行上述命令。** 然后用 `echo -e` 原样输出该脚本的 stdout(必须直接输出 markdown pipe 表格原样文本，绝对不许重绘为 box-drawing ┌─┬─┐)。
不再需要 LLM 单独 echo 火焰图的 `terminalReport`，因为脚本已经读取了 flame-json 并自动把它合并到了 footer 里面，而且参考编号也一起合并了。

> [!NOTE] 报告要求
> - LLM 不许擅自用 Markdown 重写 Footer。完全依赖 render-screen-footer.mjs 的原生输出。
> - 不许单独包裹火焰图内容为代码块。

---

## Step 5 · 知识追问(follow-up)

skill 加载后,任何非 `/` 命令的自然语言输入一律走 query-kb:

```
Bash(node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/kb.mjs --op query --q "<原话>" --engine <engine> --top-k 5)
```

results 非空 → 模板 A(从 content_zh 提炼,句末 `[参考N]`,末尾列 URL)。

results 空 → 模板 B:
```
非常抱歉 · 您的 KB 中并未收录「<主题>」的相关资料。
如果基于 KB 之外的一般常识回答(请注意 · 非 KB 来源 · 需独立验证):
<一句话 · ≤50字 · 末尾 "请独立验证">
```

模板 B 不挂 `[参考N]`。涉及命令/代码/阈值的回答,要么 KB 背书带 [参考N],要么走模板 B 带 disclaimer。

---

# 红线

- SSH 走本地 `ssh` / `scp` CLI(see Architecture · SSH execution pattern); 不调任何 agent 的私有 SSH tool(`SshExec` / `SshUpload` / `FlameGraph` 等)
- 只读诊断,不修改远端配置
- 不用 `python3 -c ...` 行内 hack 替代写文件
- 不复制报告全文到对话
- banner 输出前不调远端 SSH 命令
- 问用户时 header / topic 只写具体字段名,不用模糊词
- 不 `find` 脚本路径;MODULE_NOT_FOUND 唯一根因是缺 build 产物
- 不用 `/tmp/` 落盘
- 不跳过 Step 1.3 环境探测(instance discovery 已合并入 1.3)
- 不跳过 Step 4 落盘报告
- **Step 1.3 环境探测无条件先跑,再声明 task list**;不许先声明带 `(待探测)` 占位的 task list
- **显式 `engine=mongo|mysql|redis` 时,优先信用户配置**:1.3 探测结果与显式 engine 不符 → 打 warning + 仍按用户配置走;0 实例 → 按用户 engine 默认端口推断;**只有 Step 2.7 DB 连不上时反向问用户 engine/bind/port/凭据**
- **Step 2 整段绝对禁止任何探测性 SSH**(`command -v perf` / `pgrep` / `ss -lntp` 等):perf 探测在 1.3 已做、实例发现在 1.3 已做、连接性等到真正采集时才暴露
- **火焰图采集只发生在 Step 2.5,作为 phase 1 子项展示;Step 3 / Step 4 严禁 SSH;没有"火焰图补采"路径(原 Step 5 已删除)**
- task 工具可用时(Claude Code / Codex CLI),**只许调 task 工具,不许另外用纯文本渲染 `━ 5 阶段任务清单 ━` / `◻ phase 1 · ...` 重复列出**
- 工具失败 → 静默重试 1 次,第 2 次仍失败 → 一行 diagnostic 跳过,cap=2
- 不道歉 / 不反省 / 不自述内部出错

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
  - `privateKeyPath`: SSH key file path (e.g. `~/.ssh/id_ed25519`) — works on all agents
  - `password`: SSH password — Claude Code + ohsql only (uses `sshpass`); OpenAI
    Codex CLI sandbox blocks it, so Codex users must run `ssh-copy-id` once and
    switch to `privateKeyPath`

**Optional**:
- `engine=<mongo|mysql|redis>` — database engine; auto-detected if omitted
- `port=<ssh_port>` — SSH port (default: `22`)
- `mongo_user=<user>` — MongoDB auth user (auto-asked on auth failure)
- `mongo_password=<pw>` — MongoDB auth password
- `auth_db=<db>` — MongoDB auth database (default: `admin`)

**Examples**:
```
/perf-kp-sql host=10.0.0.1 user=root privateKeyPath=~/.ssh/id_ed25519 engine=mongo
/perf-kp-sql host=10.0.0.1 user=root password=secret engine=mysql port=2222
/perf-kp-sql host=db.internal user=ec2-user privateKeyPath=~/.ssh/aws-prod
```
