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

## Step 4 · ≤ 3 强制收口 → 取前 3

排序依据 = 现场可验证程度 + 与 [环境上下文] 相关性:

| case_id | 选/砍 | 排序依据 |
|---|---|---|
| ... | **选 (1/3)** | ... |
| ... | **选 (2/3)** | ... |
| ... | **选 (3/3)** | ... |
| ... | 砍 | ... |

## 输出 · 进入 Phase 3 的 case_id

- <case_id_1> (CASES.md line X)
- <case_id_2> (CASES.md line Y)
- <case_id_3> (CASES.md line Z)

## 备注

- (任何特别规则:多 case 并行 / 现场观测项预备塞主表 / 等)
