# Phase 4 多源综合判定追踪 (phase4-trace) · 模板

> LLM 在 Phase 4 综合判定结束后 Read 本模板 · 按以下骨架填充实际数据 · Write 到 `~/.perf-kp-sql/runs/<TS>/phase4-trace.md`。
> 用途:把每个候选根因的 案例 阶段判定 + NLM 答复 + 双源综合结论落盘 · 不打屏 · 进 jsonl 可被 claude-code-log 解析。

## 综合判定一览

| # | 候选根因 | 案例 命中 | NLM 答复 | 双源结论 | 进表 / 段 | 置信度 |
|---|---|---|---|---|---|---|
| 1 | ... | <case_id> (line X) — 偏离/正常 | 确认/否认/给出最新建议 | 案例+NLM 一致/案例 单源/NLM 单源 | 主表/现场观测段 | 高/中/低 |
| 2 | ... | ... | ... | ... | ... | ... |

## 候选 1 · <根因简述>

### 案例 阶段判定

- case_id: `<case_id>`
- INDEX 行号: 行 X → CASES.md line Y
- abnormal_pattern_threshold: ...
- 现场实测对照:
  - <metric_1> = <现场值> ✓/✗ 偏离/正常
  - ...
- 案例 阶段结论: **偏离命中 / 正常排除 / 阈值无法量化**

### NLM 阶段答复(摘要)

> "<NLM answer 关键摘录 · 包括根因确认/否认 + 最新修复建议>"

NLM 给出的样例命令(若有):

```
<verbatim from NLM answer>
```

NLM 引用 references unique URLs:
- <url_1>
- <url_2>

### 双源综合结论

- 案例 + NLM 一致/不一致/NLM 否认 ...
- 进主表 row 标 `high/warning/info` · 置信度 `高/中/低`
- 备注列: ...

## 候选 2 · ...

(同上骨架)

## NLM 调用 metadata

| 调用 | jsonl tool_result 文件 | references 数 | unique URLs |
|---|---|---|---|
| Q1 ... | `tool-results/<id>.txt` | N | M |
| Q2 ... | ... | ... | ... |

## 备注

- 如某根因 案例 + NLM 都无 source_url · 该根因不进主表 · 进现场观测段(详见 SKILL Phase 5.2 URL 强制溯源约束)
- 完整 references 进 jsonl 已落 · 此 trace 仅 dump unique source_url 节省体积
