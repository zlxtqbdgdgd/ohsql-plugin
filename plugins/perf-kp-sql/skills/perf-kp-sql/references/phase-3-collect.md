# Phase 3 · 诊断指标采集

> 本文档由主 SKILL.md 在 Phase 3 入口处通过 router 指令加载。LLM 进入 Phase 3 时必须 Read 本文件 · 然后按 3.A / 3.B 流程操作。
>
> **关键约束(Phase 2-3 之间禁止任何探测性 SSH / 命令必须来自 case `collection_method_quote` / 不许 LLM 自己拍命令)在主 SKILL 流程顺序硬约束 + 红线段已经定义**。

---

**目标**: 从命中 case 提采集命令 · SSH 批量采集指标 → 落盘 collect 文件。

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

**操作系统层采集**(`collection_layer=os` 的 metric · CPU / 内存 / 磁盘 / 网络):

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt", content="<OS 层合并命令字面>")
Bash(command="node <PLUGIN_ROOT>/scripts/ssh.mjs --op exec \
       --host <ip> --user <user> [--privateKeyPath <path> | --password '<pw>'] [--port <n>] \
       --command-file /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt \
       --output-file /Users/<yourlogin>/.perf-kp-sql/runs/<TS>/collect-os.txt", timeout=120000)
```

OS 层完成 → task 3 子项 `操作系统层` 标 `✔` · 子项 `MongoDB 层` 切 `⏳` (update task content)。

**MongoDB 层采集**(`collection_layer=mongo-shell` / `mongo-runtime-cmd` / `log-grep` 的 metric · 连接池 / 慢查询 / 锁竞争 / 存储引擎):

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt", content="<MongoDB 层合并命令字面>")
Bash(command="node <PLUGIN_ROOT>/scripts/ssh.mjs --op exec \
       --host <ip> --user <user> [--privateKeyPath <path> | --password '<pw>'] [--port <n>] \
       --command-file /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-cmd-<TS>.txt \
       --output-file /Users/<yourlogin>/.perf-kp-sql/runs/<TS>/collect-mongo.txt", timeout=120000)
```

MongoDB 层完成 → task 3 子项 `MongoDB 层` 标 `✔`。

> **每条 cmd 文件用完后**:同一 `cmd-<TS>.txt` 路径直接覆写复用即可 · 它是临时文件 · 不进 run 目录归档。

3.A.5 · 解析 metric → value 映射(in-memory):

**collect-os.txt(典型 5-15K · 一次 Read 即可)**:

```
Read(file_path="/Users/<yourlogin>/.perf-kp-sql/runs/<TS>/collect-os.txt")
```

**collect-mongo.txt(典型 30-80K · 超 Read 工具 25K 上限 · 必须 Bash awk 按 section 抽)**:

步骤 1 · 拿 section 索引(stdout < 1K):

```
Bash(command="grep -n '^###' /Users/<yourlogin>/.perf-kp-sql/runs/<TS>/collect-mongo.txt", timeout=5000)
```

步骤 2 · 按 phase 2 选定 case 的 `metric_quote` 字段 · awk 抽对应 section(同 message 多 Bash 并行):

```
Bash(command="awk '/^###MONGO_CURRENTOP_ACTIVE###/{f=1;print;next} /^###[A-Z_]+###/{f=0} f' /Users/<yourlogin>/.perf-kp-sql/runs/<TS>/collect-mongo.txt", timeout=5000)
Bash(command="awk '/^###MONGO_TOP_NS###/{f=1;print;next} /^###[A-Z_]+###/{f=0} f' /Users/<yourlogin>/.perf-kp-sql/runs/<TS>/collect-mongo.txt", timeout=5000)
```

awk flag 模式:遇 SECTION_START 行 `f=1+print+next` · 遇下一个 `###` 标题 `f=0` · 中间 `f` 为真时打印。换 SECTION 名 · 模式不变。

**section ↔ metric 映射**(LLM 按 case `metric_quote` 决定抽哪些):

| Section | 包含 metric |
|---|---|
| `MONGO_SERVERSTATUS_PICK` | connections / network / opLatencies / locks / wiredTiger / globalLock / metrics |
| `MONGO_OPCOUNTERS_DELTA_5S` | insert/update/query/delete 计数差值 |
| `MONGO_CURRENTOP_ACTIVE` | active op 列表 / planSummary / runtime |
| `MONGO_HOSTINFO` | hostname / os / kernel(Phase 0 env.txt 已采 · 通常不需要重复抽) |
| `MONGO_CMDLINE_OPTS` | mongod 启动参数 |
| `MONGO_GETPARAM_SUBSET` | runtime 参数 |
| `MONGO_PROFILE_STATUS` | profiler 状态 |
| `MONGO_LOG_TAIL_GLOBAL` | mongod 日志最近 100 行 |
| `MONGO_TOP_NS` | namespace 操作热度 |

**硬约束**:
- 同一 section · awk **只抽一次** · 抽完字面值进 in-memory · 后续 phase 3.A.6 / 4.A / 5.2 引用 metric 时**直接用 in-memory 解析结果** · **不许回头再 awk / 再 Read 同一 collect 文件**
- 如果 grep 索引里某 section 不存在 · 记入 missing 列表 · 往下走 · **不要重新跑 awk 找**
- collect-os.txt **只 Read 一次** · 不许多次 Read

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
