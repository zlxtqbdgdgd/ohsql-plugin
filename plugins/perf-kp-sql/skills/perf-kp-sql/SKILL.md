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

# 架构

- **采集** — `SshExec` 在远端跑 per-engine 命令
- **落盘** — `Write` 把 stdout 存 `~/.ohsql/tmp/perf-kp-sql-<engine>-{os,db}-<ts>.txt`(不用 /tmp)
- **分析** — `Bash` 单行跑 `node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/diagnose.mjs --os-file ... --db-file ... --engine <name>`
- **知识库** — `Read` / `Grep` over `${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/data/<engine>/` + `data/common/`
- **火焰图** — `Bash` 调 `cpu-flamegraph/scripts/capture.mjs`
- **报告** — `Bash` 调 `render-html-report.mjs` + `render-screen-footer.mjs`

> ⚠️ kernel Bash 安全过滤拒 heredoc / `>` / `<` / `|` / 3+ 连续引号。严格走 **Write → Bash(无重定向) → Write** 工具链。

## SshExec 自适应

`SshExec` 是 kernel 自带工具。若当前 agent 无此工具,用脚本替代:

```
Bash(command="node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/ssh.mjs --op exec --host <host> --user <user> --password <password> [--port <port>] --command '<command>' [--timeout <ms>]")
```

返回 `{"stdout":"...","stderr":"...","exitCode":0}`。有 SshExec 就用 SshExec,没有就自动换 Bash 写法,不问用户。

## 工具加载(Task 系列)

`TaskCreate` / `TaskUpdate` / `TaskList` 首次使用前需要通过 ToolSearchTool 加载 schema。
**必须且只能分三次独立调用，禁止合并或使用 select 语法**:

```
ToolSearchTool(query="TaskCreate")
ToolSearchTool(query="TaskUpdate")
ToolSearchTool(query="TaskList")
```

加载时机: Step 1.4 声明 task 清单之前。加载成功后不再重复调用。

> **警告：绝对禁止使用 ToolSearchTool 搜索 `Write`、`Grep`、`Bash` 或 `SshExec`！这些是原生内置工具，不需要 schema 即可直接调用。**

---

# Workflow

## Step 1 · PLAN

**banner 必须在任何远端 tool call(SshExec / FlameGraph)之前渲染。** 本地 Bash / AskUserQuestion 参数收集不受限。

### 1.0bis · 历史复用

触发:slash args 缺 host 时。

```
Bash(command="node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/history.mjs --op load --max 5")
```

hosts 非空 → 用 `AskUserQuestion` 让用户挑(即使只有 1 条也弹):

```
AskUserQuestion(
  questions=[{
    question: "选择最近使用过的连接 · 或新建连接",
    header: "选择历史连接",
    multiSelect: false,
    options: [
      ...hosts.map(h => ({
        label: `${h.host} · ${h.user} · ${h.engine} · 上次 ${humanRelative(h.last_used)}`,
        description: `port=${h.port} · 累计 ${h.use_count} 次`
      })),
      { label: "新连接 · 手动输入", description: "走自然语言或 kv 抽参" }
    ]
  }]
)
```

用户挑选后 → 完整解出 JSON 里所有字段(`host / user / port / engine / password / privateKeyPath / mongo_user / mongo_password / auth_db`)回填参数集。

**选完不许停**:同 turn 立即打 banner → TaskCreate × 5 → TaskUpdate → SshExec 采集。

### 1.1 · 参数抽取

从用户任意措辞抽取:
- 必填:`host`(IP/FQDN)、`user`、`password`(或 `privateKeyPath`)
- 可选:`port`(默认 22)、`engine`(mongo/mysql/redis)
- MongoDB 可选:`mongo_user`、`mongo_password`、`auth_db`(默认 admin)

抽取策略:严格 kv → 半结构化 → 自然语言 → 混合。抽取失败只问缺的字段,不重来整表。

### 1.2 · 参数校验

两类 check,任一命中阻塞 banner:

**Class 1 缺字段** — host / user / (password 或 privateKeyPath) 任一缺:

```
AskUserQuestion(header: "<缺字段名>", question: "━ kunpeng · 参数待补全 ━ ...")
```

**Class 2 格式非法** — host 非合法 IP/FQDN、port 非 1-65535、engine 不在支持集合:

```
AskUserQuestion(header: "<字段名> 格式", question: "━ kunpeng · 参数格式异常 ━ ...")
```

`header` 只写具体字段名(`SSH 密码` / `主机格式 · 端口格式`),不用模糊词。

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

```
TaskList()
```

count > 0 → 对每个 task 调 `TaskUpdate(taskId="<id>", status="deleted")`。然后:

```
TaskCreate(subject="OS/硬件采集 (50 项)",          activeForm="采集 OS/硬件")
TaskCreate(subject="运行时采集 (<N> 项)",           activeForm="采集运行时")
TaskCreate(subject="规则诊断 (<R> 条)",            activeForm="诊断规则")
TaskCreate(subject="知识库检索 (54 篇)",           activeForm="检索知识库")
TaskCreate(subject="报告渲染",                     activeForm="渲染报告")
```

**恰好 5 个 task,不许多创建,不许创建"占位清理"等辅助 task。**

**记录每次返回的 task id**(不假设 1-5,用真实返回值)。

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

```
TaskUpdate(taskId=<task1 id>, status="in_progress")
```

不打字面 phase 步骤头,用 TaskUpdate 驱动 checklist UI。

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

```
SshExec(
  host=<host>, user=<user>, port=<ssh_port>,
  password=<password>,
  command="<此处必须填写你从 2.1 步骤读取的 JSON 文件中解析出来的 osBatchCmd 原始字符串，绝对禁止自己编造 bash 命令>",
  timeoutMs=60000
)
```

**stdout 非空 = 成功**,立即进下一步。忽略 exitCode、红色渲染、stderr 里的 WARN/deprecated。

仅 stdout 和 stderr 都空 → SSH 未建立,走 Gate 4 自检。

第一次失败 · 紧凑二次收集:

```
AskUserQuestion(header: "SSH 连接失败 · 改端口或密码", question: "━ SSH 未连通 · 已带全凭据仍空 ... ━")
```

第二次仍失败 → 展开详细排查清单(端口/防火墙/sshd 配置)。

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
- 多实例 → `AskUserQuestion(header: "选择诊断实例", ...)`

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

然后:

```
SshExec(host=..., command=<填充后 dbBatchTemplates[engine]>, timeoutMs=60000)
```

占位符替换:`__BIND__`、`__DB_PORT__`、`__USER__`、`__PWD__`。
MongoDB:`__MONGO_USER__`、`__MONGO_PWD__`、`__AUTH_DB__`、`__AUTH_ARGS__`(有 mongo_user+mongo_password 则填认证参数,否则置空)。

**MongoDB 认证失败自动补收**:stderr 含 `requires authentication` / `Authentication failed` → 翻译成中文活动行 → AskUserQuestion 问 mongo_user/mongo_password/auth_db:

```
AskUserQuestion(header: "MongoDB 账号 · 密码 · 认证库", question: "━ MongoDB 账号 · 密码 · 认证库 ━ ...")
```

**引擎自发现成功后，必须读取 JSON 中对应引擎的 dbBatchCmd 模板，替换模板中的 __BIND__ 等变量，作为 SshExec 的 command 执行。**

最多 3 轮。拿到 dbStdout → Write 落盘 (同样必须提供 file_path 和 content 参数):

```
Write(file_path="/Users/<yourlogin>/.ohsql/tmp/perf-kp-sql-<engine>-db-<TS>.txt", content="<此处填入 SshExec 采集到的全部数据库状态 stdout 文本>")
```

### 2.6 · phase1 收尾

```
TaskUpdate(taskId=<task1 id>, status="completed")
TaskUpdate(taskId=<task2 id>, status="in_progress")
```

打硬件/OS 识别行:
```
  · 硬件 · <cpu_model> · <arch> · <cpu_cores> core · <GB>
  · 操作系统 · <os_id> <os_version> · Linux <kernel_version> · <virt>
```

填值:total_mem_mb 除 1024 得 GB(1位小数);numa_nodes ≥ 2 才显示;cpu_model 空写"CPU 未识别"。

```
TaskUpdate(taskId=<task2 id>, status="completed")
```

### 2.6bis · 写入 history

SSH + DB 都成功后静默调:
```
Bash(command="node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/history.mjs --op save --host <host> --user <user> --port <ssh_port> --engine <engine>")
```

失败静默忽略,不打屏。

---

## Step 3 · 本地分析

### 3.0 · 进入 task 3

```
TaskUpdate(taskId=<task3 id>, status="in_progress")
```

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

```
TaskUpdate(taskId=<task3 id>, status="completed")
TaskUpdate(taskId=<task4 id>, status="in_progress")
```

首选 Read 目录 + INDEX.md:
```
Read(file_path="${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/data/<engine>/INDEX.md")
Read(file_path="${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/data/<engine>/<file>.md")
```

可选 Grep(报 rg 未安装则回退 Read)。

### 3.3 · 火焰图采集

**执行位置**:Step 4.0 kb-stats 之后、Step 4.2 render-html-report 之前。一次诊断只调一次。

#### 3.3.1 · 检查远端依赖

```
  · 检查远端 perf / offcputime-bpfcc 依赖
SshExec(command="echo \"perf=$(command -v perf 2>/dev/null || echo MISSING)\"; echo \"offcpu=$(command -v offcputime-bpfcc 2>/dev/null || echo MISSING)\"")
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

```
TaskUpdate(taskId=<task4 id>, status="completed")
TaskUpdate(taskId=<task5 id>, status="in_progress")
```

```
Bash(command="node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/render-html-report.mjs /Users/<yourlogin>/.ohsql/reports/perf-kp-sql-<engine>-<TS>.html --from-diagnose <diag-json-path> --from-flame-json /Users/<yourlogin>/.ohsql/tmp/flame-json-<TS>.json")
```

```
TaskUpdate(taskId=<task5 id>, status="completed")
```

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
