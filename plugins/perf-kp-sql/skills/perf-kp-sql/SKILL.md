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
- **Other agents**: if no task-list tool exists, render progress as plain text using `◻ ◼ ✔` markers

Each phase transition (in_progress → completed; pending → in_progress) re-sends the full updated task list. Detailed phase titles + counts are defined in Step 1.4.

---

# Workflow

## Step 1 · PLAN

**banner 必须在任何远端 tool call(SshExec / FlameGraph)之前渲染。** 本地 Bash / AskUserQuestion 参数收集不受限。

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

**No stopping after selection**: same turn → render banner → declare 5-phase task list → mark phase 1 in_progress → run SSH OS collection.

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

password 前 3 + `***` + 后 3 脱敏。后续 SshExec 参数必须与 banner 字段一一对应。

### SshExec 参数门

**Gate 2** — SshExec 的 host/user/port/password 必须与 banner 字面一致。

**Gate 3** — history 里 password 非空 → 必传;privateKeyPath 非空 → 必传;两者都空 → 先问凭据。

**Gate 4** — SshExec 返 stdout=stderr="" 时:
1. 打自检行(实发参数 vs history 比对)
2. 发现漏传 → 同 turn 重试
3. 全传齐仍空 → 走紧凑二次收集

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

### 2.0 · 进入 task 1

Mark phase 1 (`OS/硬件采集 (50 项)`) as in_progress in the task list. Re-send the full 5-element list with status updated.

Do not print a literal "phase 1 / step 2" header — let the task-list UI render the spinner.

### 2.1 · 读采集模板

```
Read(file_path="${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/data/collect-cmds.json")
```

### 2.2 · 临时文件路径

强制用 `~/.ohsql/tmp/`(绝对路径),不用 `/tmp`。TS = `YYYYMMDD-HHMMSS`,全程一致。Write 自动创建父目录。

### 2.3 · SSH 跑 OS 采集

SshExec 之前打 4 行分组活动行(v0.5.1 · 跟 task 1 detail 视觉对齐 · 替代旧单行 `· 采集 OS / 硬件 35 项指标 (...)`):

```
  · 内存 · THP / 大页 / swappiness / ...
  · 网络 · somaxconn / keepalive / ...
  · 磁盘 · await / 调度器 / ...
  · CPU · LSE / BIOS / NUMA / ...
```

Run via the SSH execution pattern (see Architecture section), substituting `<command>` with the literal `osBatchCmd` string read from `data/collect-cmds.json` (do NOT improvise the bash command):

```bash
# Mode A · key auth (recommended):
ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
    -i <privateKeyPath> -p <port> <user>@<host> '<osBatchCmd>'

# Mode B · password auth (CC + ohsql):
sshpass -p '<password>' ssh -o StrictHostKeyChecking=accept-new \
    -p <port> <user>@<host> '<osBatchCmd>'

# Codex CLI with password-only: stop and ask user to use ssh-copy-id (see Architecture).
```

Set timeout ≈ 60 seconds.

**stdout-non-empty = success**, proceed immediately. Ignore exitCode / red rendering / stderr WARN/deprecated noise.

Only **both stdout and stderr empty** → SSH not established; run Gate 4 self-check.

First failure · compact retry — ask the user:

> ━ SSH 未连通 · 已带全凭据仍空 ━
> 可能原因:port 错 / 密码错 / 私钥未授权 / 防火墙阻断
> 请确认 host/user/port/(密码或私钥) 是否正确,或在目标主机跑 `ss -lntp | grep ssh` 确认 sshd 端口。

Stop and wait for the next turn.

Second failure → expand the detailed troubleshooting checklist (port / firewall / sshd config).

拿到 osStdout 后 Write 落盘 (注意：必须提供 file_path 和 content 参数，绝对禁止空参数调用 Write()):

```
Write(
  file_path="/Users/<yourlogin>/.ohsql/tmp/perf-kp-sql-os-<TS>.txt",
  content="<此处必须填写你从 SshExec 刚拿到的全部 stdout 文本，别漏了>"
)
```

**Write 顺序硬约束**:SshExec → Write → Bash(discover),三步缺一不可。

### 2.4 · 实例发现

```
Bash(command="node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/ssh.mjs --op discover --os-file <path> --hint-engine <engine|skipped>")
```

- 0 实例 → 报错给用户
- 1 实例 → 自动选中
- 多实例 → ask the user (with `选择诊断实例` as topic): list each candidate as `<engine> @ <bind>:<port> (pid=<pid>)` and stop for selection.

单实例活动行根据 `_notes` 决定:
- `port-inferred-from-default` 且 pid 空/0 → `✓ 数据库实例 · <engine> @ <bind>:<port>(默认端口推断)`
- 否则 → `✓ 数据库实例 · <engine> @ <bind>:<port> (pid=<pid>)`

### 2.5 · DB 批量采集

SshExec 前打分组活动行(v0.5.1 · 跟 task 2 detail 对齐 · 替代旧单行 `· 采集 MongoDB 19 项指标 (...)`):

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

然后 run via the SSH execution pattern with `<command>` = the substituted `dbBatchTemplates[engine]` string from `collect-cmds.json`:

```bash
# Same SSH pattern as Step 2.3 (Mode A key auth or Mode B password+sshpass).
# Substitute the engine's batch template after placeholder replacement.
```

Placeholder substitution:`__BIND__`、`__DB_PORT__`、`__USER__`、`__PWD__`.
MongoDB-specific:`__MONGO_USER__`、`__MONGO_PWD__`、`__AUTH_DB__`、`__AUTH_ARGS__`(if both `mongo_user` and `mongo_password` provided, fill auth args; else leave empty).

Set timeout ≈ 60 seconds.

**MongoDB authentication failure auto-collect**: if stderr contains `requires authentication` / `Authentication failed`, print a translated Chinese activity line and ask the user for credentials:

> ━ MongoDB 账号 · 密码 · 认证库 ━
> 请提供:
>   - mongo_user(默认空 = 匿名)
>   - mongo_password
>   - auth_db(默认 admin)
>
> 提供后将自动重试,最多 3 轮。

Stop and wait for the next turn.

**Engine discovery succeeded → MUST read the engine's `dbBatchCmd` template from `collect-cmds.json`, substitute placeholders, and run as the SSH command. Do NOT improvise mongosh / mysql client / redis-cli invocations.**

最多 3 轮。拿到 dbStdout → Write 落盘 (同样必须提供 file_path 和 content 参数):

```
Write(file_path="/Users/<yourlogin>/.ohsql/tmp/perf-kp-sql-<engine>-db-<TS>.txt", content="<此处填入 SshExec 采集到的全部数据库状态 stdout 文本>")
```

### 2.6 · phase1 收尾

In the task list, mark phase 1 as completed and phase 2 as in_progress (single update, both transitions in one re-send of the full list).

打硬件/OS 识别行:
```
  · 硬件 · <cpu_model> · <arch> · <cpu_cores> core · <GB>
  · 操作系统 · <os_id> <os_version> · Linux <kernel_version> · <virt>
```

填值:total_mem_mb 除 1024 得 GB(1位小数);numa_nodes ≥ 2 才显示;cpu_model 空写"CPU 未识别"。

After printing the data lines, mark phase 2 as completed.

### 2.6bis · 写入 history

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

### 3.3 · 火焰图采集

**执行位置**:Step 4.0 kb-stats 之后、Step 4.2 render-html-report 之前。一次诊断只调一次。

#### 3.3.1 · 检查远端依赖

Print activity line:
```
  · 检查远端 perf / offcputime-bpfcc 依赖
```

Run via the SSH execution pattern (Architecture section) with `<command>`:
```bash
echo "perf=$(command -v perf 2>/dev/null || echo MISSING)"; \
echo "offcpu=$(command -v offcputime-bpfcc 2>/dev/null || echo MISSING)"
```

- perf + offcpu 齐 → 双采
- perf 齐 offcpu 缺 → 仅 on-CPU
- perf 缺 → 整段跳过

#### 3.3.2 · 调 capture.mjs

```
Bash(command="node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_DEP_CPU_FLAMEGRAPH_ROOT}/scripts/capture.mjs \
       --host=<ip> --user=<user> --password='<真实pw>' [--port=<n>] \
       --process=mongod --type=oncpu --duration=3 --engine=mongo")
```

凭据用**真实未脱敏密码**,单引号包裹。offcpu 齐则再调一次 `--type=offcpu`。

拿到 JSON 后**暂存 `flame-json` 路径**,不立即 echo `terminalReport`。等 Step 4.3 时传给 render-screen-footer.mjs 处理。同时记录 `artifacts.serverSvgPath` 用于拉 SVG。

**必须立即使用 Write 工具将该完整的 JSON 落盘至 `/Users/<yourlogin>/.ohsql/tmp/flame-json-<TS>.json`。**

#### 3.3.3 · 拉 SVG 到本地

```
Bash(command="node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/ssh.mjs --op exec \
       --host <ip> --user <user> --password <pw> [--port <n>] \
       --command 'cat <artifacts.serverSvgPath>' \
       --output-file /Users/<yourlogin>/.ohsql/flame/<TS>-oncpu.svg")
```

LLM 不接触 SVG 内容。双采各拉一次。

#### 3.3.4 · 失败兜底

任一环节失败 → 整段跳过,静默进 Step 4。

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

## Step 5 · 火焰图补采(follow-up)

用户下一轮触发,非主流程。

### 5.1 · 触发识别

关键词:`采` / `火焰图` / `profile` / `on-cpu` / `off-cpu` 等。

### 5.2 · 默认参数

type=both,duration=3,凭据从上轮拿。

### 5.3 · 执行流

与 Step 3.3.2 完全一致,调 capture.mjs。决策树同 3.3.1。

拿到后 echo `terminalReport`,拉 SVG 到本地(同 3.3.3)。

### 5.4 · 追加到原报告

Read 原报告 → 追加火焰图节 → Write 回写。

### 5.5 · 输出补采完成 banner

### 5.6 · LLM 解读规则

对 self ≥ 5% 的热点:函数名+库 → 推断 → 关联本次 findings → 建议。

每行必带 `[F<rank>]`(采样证据),每条解读必带 `[参考N]`(KB 背书)。

查 KB 流程:
```
Bash(node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/kb.mjs --op query --flame-function <func> --module <mod> --engine mongo --top-k 3)
```

三层 fallback:flame_pattern_regex → context-ancestors → module → 模板 B(无 [参考N])。

建议只能落在:配置/参数、架构、硬件、OS/内核。

---

## Step 6 · 知识追问(follow-up)

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

- SSH 走 kernel `SshExec`,不自己 `Bash("ssh ...")`
- 只读诊断,不修改远端配置
- 不用 `Bash("python3 -c ...")` 替代 `Write`
- 不复制报告全文到对话
- banner 输出前不调远端 tool
- AskUserQuestion header 只写具体字段名,不用模糊词
- 不 `find` 脚本路径;MODULE_NOT_FOUND 唯一根因是缺 build 产物
- 不用 `/tmp/` 落盘
- 不跳过 instance discovery
- 不跳过 Step 4 落盘报告
- 工具失败 → 静默重试 1 次,第 2 次仍失败 → 一行 diagnostic 跳过,cap=2
- 不道歉 / 不反省 / 不自述内部出错

# 参考文件

| 文件 | 用途 |
|---|---|
| `data/collect-cmds.json` | 3 engine SSH 采集命令 |
| `data/common/` | Kunpeng + OS 通用知识库 |
| `data/<engine>/INDEX.md` | per-engine KB 目录 |
| `data/<engine>/rules.json` | per-engine 规则 JSON |
| `data/<engine>/*.md` | per-engine 文档 |
| `scripts/ssh.mjs --op exec` | SSH 远端执行 |
| `scripts/ssh.mjs --op discover` | 实例发现 |
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
