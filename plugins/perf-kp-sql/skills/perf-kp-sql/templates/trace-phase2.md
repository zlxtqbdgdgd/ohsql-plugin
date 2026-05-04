# Phase 2 收敛追踪 (phase2-trace) · 模板

> LLM 在 Phase 2.3 选完 case 后 Read 本模板 · 按以下骨架填充实际数据 · Write 到 `~/.perf-kp-sql/runs/<TS>/phase2-trace.md`。
> 用途:把 case 候选 → ≤3 收敛的决策推理落盘 · 不打屏 · 进 jsonl 可被 claude-code-log 解析。

## 输入

- 用户问题描述 verbatim: <填用户原话 + 任意追问轮的回答>
- 时间戳 TS: <YYYYMMDD-HHMMSS>
- 目标主机: <ip> · <user> · port=<port> · engine=<engine>

## [环境上下文] dump (Phase 0 已采)

| 字段 | 值 |
|---|---|
| os_distro | ... |
| os_kernel | ... |
| arch | ... |
| cpu_vendor | ... |
| cpu_model | ... |
| cpu_count | ... |
| numa_nodes | ... |
| mem_total | ... |
| mongod_version | ... |
| deploy_form | ... |
| is_container | ... |
| 备注(KVM guest / BIOS Vendor / 等) | ... |

## Step 1 · 类目路由 (cases/INDEX.md symptom_category=<X>)

候选 case_id 全列表(N 条 · 含 INDEX 行号):

| INDEX 行 | case_id | title |
|---:|---|---|
| ... | ... | ... |

候选数: **N**

## Step 2 · 环境硬筛 → 砍 X 条 → 剩 Y 条

| case_id | 砍/留 | 砍的环境字段依据 |
|---|---|---|
| ... | ... | ... |

剩 Y 条候选。

## Step 3 · 1 轮二元区分追问(如有)→ 用户答 "..."

LLM 问: "..."
用户答: ...

砍刀效果: ...

剩 Z 条。

## Step 4 · 收口分支(按用户答情况选一条 · 不许并行执行)

**分支 A · 用户给了有效区分**(明确选 1/2/3 / 给了具体描述) · 候选 > 3 → 取前 3

排序依据 = P(case|现场命中可能性) + 与 [环境上下文] 相关性(不是"采集命令简单度"):

| case_id | 选/砍 | 排序依据 |
|---|---|---|
| ... | **选 (1/3)** | ... |
| ... | **选 (2/3)** | ... |
| ... | **选 (3/3)** | ... |
| ... | 砍 | ... |

**分支 B · 用户答"不确定 / 不知道 / 都试试"**(0 信息回答)→ **不剪枝** · 候选全部带进 Phase 3

理由: SSH batch 多带几个 case 命令文本拼一拼成本几乎不变;让现场实测指标决定优先级 · LLM 凭"哪个命令简单"砍真因是反模式。

| case_id | 选 | 备注 |
|---|---|---|
| ... | 全选 | 候选数 N · 全部带进 Phase 3 |

## 输出 · 进入 Phase 3 的 case_id

- 分支 A: 取前 3 个 case_id(CASES.md line X / Y / Z)
- 分支 B: 全部 N 个 case_id(line 列表)

## 备注

- (任何特别规则:多 case 并行 / 现场观测项预备塞主表 / 等)
