# Phase 1+2 · 对话引导 + 诊断案例匹配

> 本文档由主 SKILL.md 在 Phase 1 入口处通过 router 指令加载。LLM 进入 Phase 1 时必须 Read 本文件 · 然后按 1.1/1.2/1.3 → 2.1/2.2/2.3/2.4 流程操作。
>
> **关键约束(收敛规则 ≤ 3 个 case 就停 / 用户答不确定不剪枝 / Phase 2 内部数据不暴露)在主 SKILL 流程顺序硬约束 + 红线段也定义**。

---

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
| 4+ | LLM 简短追问 1-2 个最有区分度的问题(例:"是单机还是副本集?" / "现象是持续性还是间歇尖峰?")· **用户有效区分(明确选 A / B)** → 收敛到 ≤ 3 个 → 进 2.3 |
| 4+ · 用户答"不确定 / 不知道 / 都试试" | **不剪枝** · 候选全部带进 Phase 3 · SSH 一次 batch 命令文本拼一拼成本几乎不变 · 让现场指标决定优先级 · 不让 LLM 凭"哪个 case 命令简单"提前砍真因 |
| 4+ 收窄追问累计 ≥ 5 轮仍 > 3 个 · 且用户每轮都给了有效区分 | 强制收口 · 取 LLM 当前认为最可能的 3 个 → 进 2.3(不再纠缠) |
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
- **用户答不确定 → 不剪枝** · 候选全带进 Phase 3 · 让现场指标决定优先级。理由:LLM"凭哪个命令简单"砍 case 是按搜钥匙的"路灯下方便找"逻辑 · 不是按"钥匙真在哪"逻辑;SSH batch 多带几个 case 成本几乎不变 · 砍掉的可能正是真因。
- LLM 看似只问 1-2 个引导问题 · 然后说"开始拉数据" · 内部所有 case 收敛 / metric 准备都不暴露给用户。

### 2.3 · 加载单 case 完整字段

case 确认后,**用 Bash awk 按 case_id 抽 case 字面**(不用 Read offset+limit · 避免 LLM 猜行号 / 反复分段读):

```
Bash(command="awk -v cid='<case_id>' 'BEGIN{p=\"^## case_id: \"cid\"$\"} $0~p{f=1;print;next} /^## case_id:/{f=0} f' <PLUGIN_ROOT>/data/cases/CASES.md", timeout=5000)
```

awk flag 模式:遇 `## case_id: <cid>` 起头行 `f=1+print+next` · 遇下一个 `## case_id:` `f=0` · 中间 `f` 为真时打印。一次拿完整 case(所有 metadata + sections · 含 diagnostic_steps / likely_causes / source_url)· 不需要猜 offset / limit。

收敛到 N(≤3)个 case 时,N 个 Bash awk 放在同一个 assistant message 的 N 个 tool_use block 内一次性发出(并行)。

**硬约束**:
- 同 case_id 在 phase 2.3 内**只抽一次** · 后续 phase(3.A.4 拼 collection cmd / 3.A.6 阈值判定 / 4.A NLM query / 5.2 写报告)引用 case 字段时**直接用 in-memory 解析结果** · **不许**回头再 awk / Read 同 case
- 抽出来的 stdout 字面值是 case 完整内容 · LLM 解析后字段全在 in-memory · 后续 turn 字段不丢就不需要再 awk

LLM 解析单 case 完整字段(in-memory 记 · 后续 phase 用):

**DF case**:
- `diagnostic_steps`(数组 · 每 step 含 metric_name / collection_layer / collection_method_quote / abnormal_pattern_threshold / abnormal_pattern_quote)
- `likely_causes`(数组 · 每 cause 含 param_name / abnormal_value_pattern / reasoning_quote / linked_diagnostic_step_no)
- `symptom_description` / `source_url`

**Flame case**:
- `pattern_regex` / `mechanism_quote` / `workload_implication_quote` / `signature_type` / `match_layer`
- `source_url`

mark task 2 (诊断案例匹配) completed → mark task 3 (诊断指标采集) in_progress。

### 2.4 · 写 phase2-trace.md(强制 · 落盘 · 不打屏)

Phase 2.3 完成后 LLM **必须** Write 一份收敛决策追踪到 `~/.perf-kp-sql/runs/<TS>/phase2-trace.md` · 模板 Read `<PLUGIN_ROOT>/skills/perf-kp-sql/templates/trace-phase2.md` 按字段填充。不打屏 · UX 不变 · jsonl 里 Write tool_use 即"过程日志"· 可被 claude-code-log 解析。

> **进入 Phase 3 时**:必须把 task 3 content 字段更新成带 2 个层的子结构 ·
> ```
> 3. 诊断指标采集
>     ⏳ 操作系统层:CPU / 内存 / 磁盘 / 网络
>     ⏳ MongoDB 层:连接池 / 慢查询 / 锁竞争 / 存储引擎
> ```
> 详见上文 "Task tracking pattern" 段。子项进度切换 = update task content · 不创建子 task。

---
