# Phase 0 · 环境信息采集(凭据 + 连通性探测 + 环境画像)

> 本文档由主 SKILL.md 在 Phase 0 入口处通过 router 指令加载。LLM 进入 Phase 0 时必须 Read 本文件 · 然后按 0.1-0.10 流程操作。
>
> **关键约束(Phase 0 期间只收凭据不问现象 / banner 输出前不调远端 SSH / 历史选单 + 持久化询问硬约束 / NLM-relogin 流程)在主 SKILL 流程顺序硬约束 + 红线段也定义**。

---

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
  · password=***
  · mongo_password=*** · auth_db=admin
```

password / mongo_password 一律输出 `***`(全脱敏)· 不输出前 3 / 后 3 / 任何位数。半脱敏会让密码
片段进入 LLM transcript 与报告 · 长会话里能被前后文拼接还原。后续 SSH 命令的 host/user/port/auth_db
参数必须与 banner 字段一一对应(密码字段不参与对齐 · banner 不再持有真值)。

### 0.5 · SSH 参数门(Gates · 兜底自检规则,正常路径不触发)

正常路径(Phase 0.1 历史选单已选齐凭据 / 0.3 参数校验通过):**直接跳过本节进 0.6 / 0.7**,不触发任何自检 thinking。

仅在 0.7 SSH 命令失败时回头查下面规则:

**Gate 2** — SSH 命令的 host/user/port/password/privateKeyPath 必须与 banner 字面一致。

**Gate 3** — history 里 password 非空 → 必传;privateKeyPath 非空 → 必传;两者都空 → 先问凭据。

**Gate 4** — SSH 命令返 stdout=stderr="" 时:
1. 打自检行(实发参数 vs history 比对)
2. 发现漏传 → 同 turn 重试
3. 全传齐仍空 → 走紧凑二次采集

### 0.6 · DB 凭据预询问(凭据缺时前置)

**触发条件**:`mongo_user` 或 `mongo_password` 任一字段为空 / 未提供。

**已齐路径(从历史选单或 slash args 拿到 mongo_user + mongo_password)**:跳过本节,**0.4 banner 渲染完直接进 0.7**,不思考、不询问、不 stop wait。

**触发本节的判定**:仅当确实缺字段才进入下面 ask 流程。

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

凭据收齐 + banner 渲染后,**banner 输出与本步执行放进同一个 assistant message** 连续动作,不在中间另起 thinking 或 stop wait:0.4 输出 banner → 同 message 立刻 Write cmd 文件 + Bash ssh.mjs --op exec + Bash notebooklm.mjs --op check 三个工具 block 一起发。

**这一步成功前不跟用户继续聊问题现象**。

固定 8 条命令(不依赖 case · 不依赖 collect-cmds.json):

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

> **路径说明**(单目录归档):
> - 命令文件落 `~/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt`(用完即弃 · 不属于 run 产物)
> - env probe 输出落 `~/.perf-kp-sql/runs/<TS>/env.txt`(归档进 run 目录)

本步 SSH probe 与 0.10 `notebooklm.mjs --op check` 同 message 并行触发(两个 Bash content block,无数据依赖,各自 stdout 单独消化)。

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

#### 第 2 步 · 凭据 opt-in 询问(用户每次都问 · 不批量记忆)

ask the user(topic = `保存凭据`):

```
━ 保存凭据 ━
本次连接已存进历史(host / user / port / 环境画像)。

是否把密码也一起保存到 ~/.ohsql/perf-kp-sql/hosts.json?
(文件 chmod 600 · 仅本用户可读 · 下次选这条历史可免输密码)
请回复:
  1. 保存(SSH 密码 + MongoDB 密码都存)
  2. 不保存(只本会话用 · 下次重输)
```

stop and wait for next turn。

**用户选 1(保存)**:再调一次 `--op save` 带凭据 flag 覆盖上去:

```
Bash(command="node <PLUGIN_ROOT>/scripts/history.mjs --op save \
       --host <ip> --user <user> --port <n> --engine mongo \
       --password '<pw>' [--mongo-user <u> --mongo-password '<p>' --auth-db <d>]")
```

**用户选 2(不保存)**:跳过 · 第 1 步已经把主连接存好 · 凭据本会话内存里有 · 下次还是要重输。

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
| `{"installed": true, "authenticated": true, "notebooks": {<非空>}}` | ✅ 公告"NLM 增强已就绪" · 进 Phase 1 |
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
| `--op query` / `--op query-batch` 返回错误含 `401` / `403` / `Authentication failed` / `认证未通过` / `auth_expired` / `cookie_invalid` / `cookie expired` | Google 侧 session 过期(关键字与 notebooklm.mjs `isAuthFailure` 正则对齐 · 不要按其它字面词扫) |

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
