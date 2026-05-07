# Phase 4 · 多源综合诊断

> 本文档由主 SKILL.md 在 Phase 4 入口处通过 router 指令加载。LLM 进入 Phase 4 时必须 Read 本文件 · 然后按 4.A / 4.B / 4.C 流程操作。
>
> **关键约束(NLM 双源 / case_id 不暴露 / URL 强制溯源)在主 SKILL 流程顺序硬约束 + 红线段也复制了一份兜底**。

---

**目标**: 把 Phase 3 采集结果跟 case 阈值 / NotebookLM 答案多源综合对照 → 输出"确认根因"列表。

⚠️ **根因来源强约束**(必须钉死):

进主诊断表的根因 · **默认要求 案例 + NLM 双源** — 案例 阶段命中给"是不是该 case"· NLM 阶段确认"现在是否仍如此 + 最新修复建议"。两个来源必须能逐条溯回 stdout / Read 输出:

1. **案例 来源**:case_id verbatim 来自 Phase 2.3 Read 出的 CASES.md 单 case 字段(DF `likely_causes[]` / Flame `mechanism_quote`)· `[参考N (案例)]` 用 case 的 `source_url` 字段
2. **NLM 来源**:NLM 调用(Phase 4.A 阶段 2 单条 query / Phase 4.B BP batch / Phase 6 追问)返回的 `answer` + `references` · `[参考N (NLM)]` 用 NLM 返回的 `references[].source_id`

**双源默认 · 单源是降级**(详见 Phase 4.A 阶段 3 综合判定表):

| 场景 | 主表 | 参考来源列 |
|---|---|---|
| 案例 偏离 + NLM 确认 | ✅ 进表 · 置信度高 | 案例 + NLM 双 [参考N] |
| 案例 threshold=NULL + NLM 给答案 | ✅ 进表 · 置信度中 | 仅 NLM [参考N] |
| 案例 偏离 + NLM 不可用(check / relogin 失败) | ✅ 进表 · 置信度中 · 报告头标 "⚠️ NLM 不可用" | 仅 案例 [参考N] |
| 案例 偏离 + NLM 否认 | ❌ 不进主表 · 移现场观测段 | — |
| 案例 没覆盖 + NLM 答得出来 | ✅ 进表 · 置信度中 | 仅 NLM [参考N] |
| 案例 没覆盖 + NLM 也答不出 | ❌ 不进主表 · 移现场观测段 | — |

**关键反例**:

- ❌ 凭训练数据知识写根因(没调 NLM 也没 案例 Read)
- ❌ Phase 3 现场采到现象(\$where 烧 CPU)· **直接写进表**不调 NLM · 凭印象描述 + 编 URL

✅ **正确做法 · 现场采到 案例 没覆盖的现象**:
- Phase 4 时给该现象**单独发一条 NLM query** · 例如:`"MongoDB \$where JS 查询的性能影响 + 推荐做法?"`
- 拿到 NLM answer + references · 现在这个根因有了可信源 · 可以进表
- `参考来源` 列写 `[参考N]` · URL = NLM 返回的 `references[].source_id`(verbatim · 不许编)
- 置信度: 中(NLM 兜底)

**自检规则**(写完根因列表 LLM 必须自检):
- 每个根因都能逐条说出来源:
  - "case_id=X · 案例 命中 · 来自 Phase 2.3 Read line=Y · likely_cause N" · 或
  - "case_id=Y · BP 命中 · 来自 Phase 4.B NLM batch result" · 或
  - "现场根因 X · NLM 命中 · 来自 Phase 4.A 单条 query 返回 / Phase 4.X 临时兜底 query 返回 · references[i].source_id=URL"
- 不能溯源的根因 → **不进主诊断表** · 移到 Phase 5.2 报告的 `## 现场观测(无权威来源)` 独立段 · 标"请独立验证"
- 不许 "我训练数据里见过这个问题" 当来源 — 不算
- **特别强调**:Phase 3 现场采到的根因(\$where 烧 CPU / 异常 query 等)· 如果 NLM 不可用 · **必须先走 NLM-relogin 流程**(详见 Phase 0.10 #NLM-relogin) · 不许直接放弃 NLM 兜底然后把根因塞主表。NLM 真的连不上(用户拒绝重登录 / 重登录后仍失败)· 才允许走"现场观测"独立段。

分两条路径(对应 Phase 3.A / 3.B):

### NLM 调用统一错误处理(Phase 4.* / Phase 6 都遵守)

任何 `notebooklm.mjs` 调用(query / query-batch)返回鉴权失败信号时 · LLM 必须:

1. **触发 NLM-relogin 流程**(详见 Phase 0.10 #NLM-relogin 段)· 调 `--op refresh-auth` 自动恢复(rookiepy 重提 + 系统浏览器兜底) · stop wait
2. 用户登录确认后 · 重新跑被中断的 NLM 调用
3. 重试仍失败 → 问用户"再试 / 跳 NLM 走 仅案例 / 中止"

**鉴权失败信号识别**:
- stdout JSON 含 `"error": "auth_expired"` / `"error": "unauthorized"` / `"error": "cookie_invalid"` 等
- stderr 含 `401` / `403` / `Authentication failed` / `cookie expired` 等
- spawn 返回 exitCode != 0 且 error message 跟鉴权相关

**非鉴权失败**(网络超时 / API 限流 / NLM 服务侧 5xx)→ skip 当前 NLM call · 继续主流程 · 在报告里标"NLM 当前不可用 · 部分根因走 仅案例"。

**❌ 反例 · LLM 自助 retry**:
```
⏺ NLM chat 超时(不是鉴权)。重试一次。

  Bash(node /.../notebooklm.mjs --op query --domain mongo --query "..." )
```
LLM 自己写"超时 · 重试一次"narration · 然后再发同 query。**违规** · 几条理由叠加:
1. SKILL.md 明文 "非鉴权失败 → skip + 仅案例" · 没有"先重试一次再 skip"这一档 · LLM 在加 spec 里不存在的逻辑
2. NLM 单次 query timeout 已经 60s · retry 一次再耗 60s · 用户白等 2 分钟 · 而 timeout 通常说明上游正在退化 · retry 命中概率不高
3. 跟 30s 火焰图 / chat 输出字段竖排是同一类 LLM 偏见——"加点工程感"(retry / 长采样 / 友好叙述) · 但每一个都是在 spec 之外自由发挥
4. 真要 retry 这件事是政策决定 · 该写进 SKILL.md 由 spec 表达 · 不该 LLM 在运行时自己决定

**正解**:非鉴权超时 → 直接 skip 当前 NLM call · narration 用一句"NLM 当前不可用(非鉴权类失败) · 该根因走 仅案例" · 不再发同 query。

**硬边界**:retry / 长采样 / 友好叙述 — SKILL.md 没写 = 不许 LLM 自决加。需要这些就改 SKILL.md。

### 4.A · DF / Flame 路径(逐 step / 逐 case 处理)

⚠️ **双阶段强制**:每个候选根因必须先经 案例 阶段判定为"偏离"· 再经 NLM 阶段二次确认 + 求建议。**仅案例 单源不许进主诊断表**(NLM 不可用降级路径除外 · 详见末尾)。

#### 阶段 1 · 案例 直判(拿候选)

对每个命中 case 的每个 diagnostic_step:

**有 `abnormal_pattern_threshold` (精确)**:
- LLM 直接对比 [采集值] vs [threshold]
- 偏离 → 该 likely_cause 入"候选根因"列表(通过 `linked_diagnostic_step_no` 关联)
- 正常 → 排除该 cause · **不进阶段 2**(明确正常的没必要 NLM 二次确认 · 避免无谓延迟)

**无 threshold (NULL · 描述性文字)**:
- 案例 阶段无判定能力 → 直接进阶段 2 · 由 NLM 给初步答案 + 现场指标对照判定

#### 阶段 2 · NLM 二次确认 + 求建议(对每个候选根因强制 · 即使 案例 threshold 已命中)

⚠️ **多个候选根因的 NLM query 必须同 message 并行 Bash · 但并发硬上限 2**:把候选根因的 `notebooklm.mjs --op query` 调用放进**同一个** assistant message 的 Bash content block · 不许"发一条 → 等返回 → 再发下一条"的串行模式。**并发硬上限 2**(超过分多轮 message 处理):2 并发同 IP 同账号已经接近 Google 反爬 burst 边界 · 5+ 并发会触发限流甚至账号风控。

**分轮表(候选数 → 轮次 · 每轮 ≤ 2 并发)**:

| 候选数 | 分轮 | 轮数 | 估算耗时(单 query RTT 60-120s + 轮间 5s) |
|---|---|---|---|
| 1 | 1 | 1 轮 | 60-120s |
| 2 | 2 | 1 轮 | 60-120s |
| 3 | 2+1 | 2 轮 | 125-245s ≈ 2-4 min |
| 4 | 2+2 | 2 轮 | 125-245s ≈ 2-4 min |
| 5 | 2+2+1 | 3 轮 | 190-370s ≈ 3-6 min |

**轮间硬约束**:第一轮所有 query 都返回后,sleep ≥ 5s 再发第二轮(防 burst);超过 3 轮(候选 6+)直接拒绝,提示用户先收敛 Phase 2.2 候选。

构造 NLM 查询(LLM 拼 · 模板 A:案例 阶段已命中 → 求确认 + 最新建议):

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-nlm-q-<TS>.txt", content="<查询字面>")
```

> [环境:OS=<distro>, CPU=<model>, MongoDB=<version>, deploy=<form>]
> 现场观测:[step.metric_name] = [采集值] (案例 阈值 [threshold] 判定为偏离)。
> 案例 case [case_id] 描述:[case.symptom_description / abnormal_pattern_quote 节选]。
> 案例 给的 mitigation:[likely_cause.reasoning_quote / mitigation_quote 节选]。
>
> 请回答两点:
> 1. 这是否仍是该现象的根因?(是 / 否 / 部分 — 给理由)
> 2. 当前最新的修复建议是什么?(具体命令 / 配置 / 文档链接 · 优先于 案例 节选)

模板 B(案例 阶段无 threshold · NLM 拿初步答案):

> [环境:OS=<distro>, CPU=<model>, MongoDB=<version>]
> 现场观测:[step.metric_name] = [采集值]。
> 上下文:[case.symptom_description]。
>
> 请回答两点:
> 1. 该指标的正常范围 / 异常判定标准是什么? 当前值是否异常?
> 2. 如异常 · 当前最新的修复建议是什么?(具体命令 / 配置 / 文档链接)

调:

```
Bash(command="node <PLUGIN_ROOT>/scripts/notebooklm.mjs --op query \
       --domain auto \
       --query \"<查询字面>\" \
       --json", timeout=360000)
```

#### 阶段 3 · 综合判定

| 案例 阶段 | NLM 阶段 | 结论 | 置信度 | 报告"参考来源"列 |
|---|---|---|---|---|
| 偏离 | 确认 + 推荐与 案例 一致 | 确认根因 | 高 | 案例 [参考N] + NLM [参考M] |
| 偏离 | 确认 + 推荐与 案例 不同(更新版本) | 确认根因 · 用 NLM 推荐 + 报告标注 "案例 节选可能已过时,以 NLM 引用为准" | 高 | 案例 [参考N] + NLM [参考M] |
| 偏离 | 否认(不像该 case) | 移到 `## 现场观测(无权威来源)` 段 · **不进主表** | 低 | 不进主表 |
| 偏离 | NLM 不可用(check / refresh-auth 失败) | 进主表 · 但报告头加一行 `⚠️ NLM 不可用 · 本次无 NLM 二次确认 · 请独立验证修复建议` | 中(案例 单源降级)| 仅 案例 [参考N] |
| NULL | NLM 给答案 + references | 进主表 | 中(NLM 单源)| 仅 NLM [参考M] |
| NULL | NLM 不可用 | 不进主表 · 移到现场观测段 | — | 不进主表 |

报告 `建议措施` cell 5 标签使用:
- 案例 推荐 → `[CASE]`
- NLM 同意的部分 → `[NLM]`
- 案例 与 NLM 不同时 · 写"NLM 推荐(以此为准): xxx [NLM]"<br>"案例 节选(可能过时): yyy [CASE]"

Flame case 同 DF · 用 `mechanism_quote` 替代 `likely_causes` 描述。

**并发硬上限**:阶段 2 每个候选根因发 1 条 NLM query · 单 query timeoutMs=150_000。**多个 query 必须同 message 并行**(见阶段 2 标题下分轮表)· 并发上限 2 · 第一轮所有 query 都返回后 sleep ≥ 5s 再发第二轮(防 burst)。

### 4.B · best-practice 巡检(全量经 NLM)

**设计书强制**: 对每个 BP 一律喂 NLM 刷新最新推荐(决策 2 d')。NLM 不可用时退化为 仅案例(报告标记 NLM 缺失)。

4.B.1 · 构造 BP 待查列表:

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-bp-list-<TS>.json", content="<JSON 数组>")
```

JSON 格式:
```json
[
  {
    "case_id": "bp-os-mm-vm-swappiness-1",
    "param_name": "vm.swappiness",
    "scope": "linux-mm",
    "current_value": "60",
    "case_recommendation": "1",
    "scenario_quote": "..."
  }
]
```

`scope` 用 BP 在 best-practice/INDEX.md 里的字段值 · notebooklm.mjs 按 scope 路由到对应 notebook(linux-* → os · storage-engine-/mongodb- → mongo · arch/bios-firmware → kunpeng if hwArch=kunpeng)。

4.B.2 · batch 调:

```
Bash(command="node <PLUGIN_ROOT>/scripts/notebooklm.mjs --op query-batch \
       --from-bp-list /Users/<yourlogin>/.perf-kp-sql/tmp/perf-kp-sql-bp-list-<TS>.json \
       --hw-arch <kunpeng|x86_64> \
       --json", timeout=600000)
```

内部按 BP scope 路由到 notebook(linux-* → os · storage-engine-/mongodb- → mongo · arch/bios → kunpeng)· chunk size 5 控制单 ask prompt 长度 · chunk 间 + notebook 间各 2s 节流。

实测 93 BP / 3 notebook ≈ 7 min。

4.B.3 · LLM 解析返回 → 每个 BP 综合判定(设计书 §4):

| 情况 | 结论 | 置信度 |
|---|---|---|
| 案例 值 + NLM 一致 + 采集值偏离 | 确认问题 | 高 |
| 案例 ≠ NLM | 以 NLM 为准(警告 案例 过时)| 中 |
| 采集值符合两者推荐 | 正常 · skip 不进报告 | — |

### 4.C · 写 phase4-trace.md(强制 · 落盘 · 不打屏)

Phase 4 综合判定结束后 LLM **必须** Write 一份多源判定明细到 `~/.perf-kp-sql/runs/<TS>/phase4-trace.md` · 模板 Read `<PLUGIN_ROOT>/skills/perf-kp-sql/templates/trace-phase4.md` 按字段填充。每根因独立一段(案例 阈值判定 / NLM 答复关键摘录 / 双源结论 / references unique URLs)。不打屏 · UX 不变 · jsonl 里 Write tool_use 即"双源判定日志"· 可被 claude-code-log 解析。

mark task 4 (多源综合诊断) completed → mark task 5 (报告生成) in_progress。

> **同 turn 顺序执行**:Phase 4.C 的 Write phase4-trace.md + TaskUpdate(task 4 → task 5)完成后 · **同一 turn 内立即继续进 Phase 5.2** · 不 stop wait 用户输入 · 不需要用户回 "继续" / "go" 之类触发字。Phase 5.2 第一动作是 Read 刚写的 phase4-trace.md(防 thinking 间字段丢失) · 然后按 Phase 5.2 步骤写 report.md。

---
