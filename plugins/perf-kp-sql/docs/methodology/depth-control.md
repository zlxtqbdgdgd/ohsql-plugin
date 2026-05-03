# perf-kp-sql · 控制大模型分析深度

> 对应领导反馈第 2.5 项 · "分析深度怎么控?prompt 设计?分阶段?校验回路?"
>
> 这份文档回答一件事:**perf-kp-sql 怎么控制 LLM 在每个 phase 的分析深度** — 让最终诊断既不浅(只罗列 case 不深挖)· 又不滥(凭空发挥)。
>
> 配套阅读:`docs/methodology/llm-boundaries.md`(2.4 项姊妹文档 · 14+ LLM 介入点 + P1-P4 兜底原则) · `skills/perf-kp-sql/SKILL.md`(主流程) · `scripts/format-chat.mjs`(5 标签 lint 实现) · `~/Documents/蒸馏工程/蒸馏工程综述.md`(理论母本)

---

## 1 · 引言:为什么"深度"是 perf-kp-sql 的护城河

### 1.1 领导原话

> "当前唯一的护城河是分析深度。深度怎么控?prompt 设计?分阶段?校验回路?—— 文章里要写明白。"

### 1.2 浅 vs 深 · 对照例子

LLM 通用能力(GPT/Claude/Gemini)+ 蒸馏库(202 case)是同行都拿得到的两件公共物。真正区分一个诊断 skill 好坏的是 · **能不能把"WT cache used=94.7%"这一条数从命中阈值 → 延展到机制 → 代价 → 例外条件 → 修复后的验证命令**。

下面同样输入(`cache_used=94.7%` · `dirty=18%`)· 浅版本和深版本的对照:

**浅版本**(只描述现场):

```
| 确认的根因 | 判定依据 | 建议措施 | 风险等级 | 置信度 | 参考来源 |
| WT eviction 配置不匹配 | cache used=94.7% · dirty=18% 偏高 | 调小 dirty target | high | 高 | (无案例引用) |
```

问题:① 没说**为什么** 95% 是阈值(机制) ② 没说调小到多少 / 怎么命令(代价 + 命令) ③ 没说"如果是 mongod 8.0+ 反过来推荐另一套"(版本例外) ④ "(无案例引用)" 已被 SKILL.md L1271-1306 红线禁止 — 主表必须有可点开的 [参考N]。

**深版本**(把同样的现场打透):

```
| 确认的根因 | 判定依据 | 建议措施 | 风险等级 | 置信度 | 参考来源 |
| WT eviction [CASE]<br>dirty_target [CASE]<br>与负载不匹配 [LLM] | cache used=94.7% [OBS]<br>接近阈值 95% [CASE]<br>dirty ratio=18% [OBS]<br>远超 target 5% [CASE] | 调低 target=3% [LLM]:<br>`db.adminCommand({setParameter:1, wiredTigerEngineRuntimeConfig:"eviction_dirty_target=3"})` [CASE]<br>验证:`db.serverStatus().wiredTiger.cache["tracked dirty bytes in cache"]` 应 ≤ 3% [CASE] | high [LLM] | 高 [LLM] | [参考1] |
```

差别:每个原子事实(实测值 / 阈值 / 比较结论 / 命令 / 验证)单独成行 · 各挂 1 个 5 标签 · 5 标签里 `[CASE]` 来自团队蒸馏字段 verbatim · `[NLM]` 来自 Google 检索 references · `[OBS]` 来自现场 SSH stdout · `[LLM]` 是模型推断必须明示 — **模型只在自由推断时才挂 `[LLM]` · 别的地方都得有外部背书**。这是"深"的工程化定义。

### 1.3 跟蒸馏工程综述的对接

综述 §6 验证段落给出"三角验证 + PRISMA-Lite + 反偏倚清单 + 何时停下" 4 件事。**深度控制本质就是 §6 验证回路的工程化**:

- §6.1 数据三角(≥3 独立来源) → 我们用 案例 + NLM 双源 + 现场 OBS · 三方对照
- §6.2 PRISMA-Lite(剔除原因分类) → 见 §5 风险 #3 的 PRISMA-Lite 推荐
- §6.3 反偏倚清单(模型一致 ≠ 真理) → 红线明文不许 LLM 评 LLM(见 llm-boundaries.md P3 原则)
- §6.5 何时停下并接受未达标 → SKILL.md L894 "案例 偏离 + NLM 否认 → 不进主表" 是"承认未达标"的工程化

下文先给 4 大控深度杠杆(L1-L4)· 再给 4 个深度 metric · 最后讨论失败模式 + 跟 2.4 文档的互补关系。

---

## 2 · 4 大控深度杠杆(L1-L4)

### L1 · 分阶段 · 7 phase 切台阶

**一句话**:把"诊断"切成 Phase 0-6 共 7 个台阶 · 每个台阶输入 / 输出 / 边界明确 · LLM 不允许跨台阶塞私货。

**当前实现**:`Architecture` 段(SKILL.md L116-128)定义 7 phase 线性流水线 · `# 流程顺序硬约束`段(SKILL.md L28-71)给 7 条不可改写的红线。

| Phase | 干啥 | 输入 → 输出 | 该 phase 控深度的关键 |
|---|---|---|---|
| 0 · 环境信息采集 | SSH 凭据 + 8 段 env probe | slash args → `[环境上下文]` | env 画字面切段(`###UNAME###`)· 不让 LLM "估计" |
| 1 · 对话引导 | NLP 抽用户现象 / 紧急程度 | `[环境上下文]` + 对话 → 现象描述 | 描述模糊 → Phase 3.B 巡检模式 · 不让 LLM 凭一句话编根因 |
| 2 · 案例匹配 | LLM 语义匹配 INDEX → top-K case_id | 现象 → 内部 case 列表(≤5) | 收敛规则 · 6+ 命中追问 ≤5 轮 · 不许无限收敛(L692-700) |
| 3 · 指标采集 | SSH 跑 case 的 `collection_method_quote` | case → collect-os.txt + collect-mongo.txt | 命令必须 verbatim 来自 case · 不许 LLM 凭印象写 `top -H`(L762-767) |
| 4 · 多源诊断 | 阈值直判 + NLM 二次确认 + 综合判定 | 采集 + case + NLM → 确认根因 | 案例 + NLM 双源默认 · 阶段 3 综合判定表硬卡矛盾(L1018-1027) |
| 5 · 报告生成 | LLM 写 markdown 6 列表 + 5 标签 + URL 溯源 | 根因 → report.md | format-chat lint exit 2 · self-check 4 规则(L1378-1385) |
| 6 · 深入对话 | 案例 Read + NLM query 合并答 | 追问 → 答案 | 不允许"我训练数据里见过"直接回(L1457-1494) |

**为什么有效**:

每 phase 的边界 = "从浅到深"的台阶。LLM 看到 case 命中 · 不能直接生成根因 — 必须先经 Phase 3 现场指标采集(把假设落到具体数字)· 再经 Phase 4 NLM 二次确认(把案例库的旧推荐升级到当前文档)· 再经 Phase 5 报告生成(把每个原子事实挂 5 标签)。**每 phase 都是一次"再深一层"的强制动作**。

**反例**(不分阶段会发生啥 · 来自 SKILL.md L46-48 列的真实 bug):

```
LLM "我直接写命令更快 · 何必查 案例"
→ 跳过 Phase 2 直接进 Phase 3 写 `top -H`
→ Phase 4 没有 case 阈值对照 / 没有 NLM 二次确认
→ Phase 5 报告 [参考N] 没有可点开的 URL
→ 用户拿报告 = 一份没引用的 LLM 自由发挥
```

这是"分阶段"防住的最关键漏洞 · 也是 SKILL.md L28-71 7 条红线钉死的原因。

**跟综述 §3 / §4 的对应**:

| 综述步骤 | perf-kp-sql 对应 | 深度作用 |
|---|---|---|
| §3 检索 | Phase 2 (案例 路由) + Phase 4.A 阶段 2 (NLM query) | 拿原始素材 |
| §4 筛选 | Phase 4.A 阶段 3 (综合判定表) | 剔除 案例 偏离 + NLM 否认的伪根因 |
| §5 综合 | Phase 5.2 (markdown 6 列表 + 5 标签) | 把多源拆原子 · 每个原子可溯回 |
| §6 验证 | Phase 5.4 (format-chat lint + self-check 4) | 工程化验证回路 |

### L2 · 数据验证 · 多重兜底

**一句话**:每个原子事实必须落地到具体来源 + 数字 · LLM 没法"我感觉是这样"糊弄过去。

**当前实现**:

| 兜底机制 | 位置 | 作用 |
|---|---|---|
| 阈值直判 | SKILL.md L965-975 阶段 1 | 案例 `abnormal_pattern_threshold` 跟 `[采集值]` 直接比 · 偏离 → 候选 · 正常 → 排除 · 不让 LLM "解释一下也算偏离" |
| NLM 二次确认 | SKILL.md L977-1016 阶段 2 | 案例 命中后强制再发 NLM query · 确认 + 求最新建议 · 防案例库快照过时 |
| 综合判定表 | SKILL.md L1018-1027 阶段 3 | 6 行硬规则:案例 偏离 + NLM 否认 → **不进主表** · 不许"反正命中就强行写进去" |
| 5 标签来源标记 | SKILL.md L1124-1170 | 每个原子事实必须挂 [IDX]/[CASE]/[NLM]/[OBS]/[LLM] 之一 · 不允许联合标签 / 漏挂 |
| URL 强制溯源 | SKILL.md L1258-1306 | `[参考N]` URL 必须 verbatim 来自 case `source_url` 或 NLM `references[].source_id` · 凭印象写 / 按命名模式推断 / 训练数据联想 全部禁止 |
| format-chat lint | scripts/format-chat.mjs L45-138 `lintReport()` | 漏挂率 > 5% exit 2 强制重写 |
| self-check 4 规则 | SKILL.md L1378-1385 | chat 输出 `\|---\|` 必含 + `\|` ≥ 30 + 不许 `────` 独占行 + 不许 ≥3 个"字段:值"行 |

**为什么有效**:

把 LLM 的"自由发挥"从可能的 100% 区间 · 压缩到"`[LLM]` 标签内"。`[LLM]` 标签明文意思是"无 案例/NLM/IDX/OBS 兜底时**必挂**" — 也就是说 · LLM 自由发挥的部分**自己声明出来** · 用户能一眼分辨"哪些是有背书的 / 哪些是 LLM 推断的"。

举例:报告里一行 `调低 target=3% [LLM]:<br>db.adminCommand(…) [CASE]` — `target=3%` 这个数是 LLM 综合 案例 + NLM 后给出的(命名挂 `[LLM]` 表明这是推断 · 不是字面引用)· 而 `db.adminCommand(…)` 这条命令是 case 字段 verbatim(挂 `[CASE]`)。**用户能区分** "数字是 LLM 算的可能差几个百分点 · 命令是字面拷贝可信"。

**跟综述 §6.1 的对应**:

| 三角类型 | perf-kp-sql 怎么覆盖 |
|---|---|
| 数据三角 | 案例(团队蒸馏 source_url 真实链接)+ NLM(Google 检索 references 真实链接)+ 现场 OBS(SSH stdout)= 3 类独立来源 |
| 方法三角 | 阈值规则判 + LLM 语义判 + 现场指标实测 = 3 种判定方法叠加 |
| 理论三角 | ❌ 未覆盖(改进路线见 §5) |
| 研究者三角 | ❌ 未覆盖(LLM 评 LLM 不算 · 见 llm-boundaries.md P3) |

数据 + 方法两条三角已工程化 · 是 L2 的护城河。理论 + 研究者三角是 §5 改进路线。

### L3 · 多源对照 · 双源 → N 源

**一句话**:1 源永远不够 · 默认双源(案例 + NLM)· 节后规划加第 3 源(火焰图 stack pattern)。

**为什么不止 1 源**(SKILL.md L898 已经写过):

- **案例(CASES.md)**:团队蒸馏快照(每月 / 每季度更新) · 可能落后 MongoDB / kernel / kunpeng 官方文档最新指导 — 典型例:THP 在 8.0+ 反过来推荐 always(跟旧 case 写的"禁用 THP"完全相反)
- **NLM**:Google 检索 + Gemini 生成 · 拿当前最新文档 references — 但 cookie 可能过期 · NLM 服务可能 5xx · 单源会断
- **现场 OBS**:SSH stdout 是真值但只是"现状" · 没法判断"现状是不是异常"(没有阈值或文档对照)

**双源默认 · 单源是降级**(SKILL.md L887-895 综合判定表):

| 场景 | 进主表? | 置信度 | 来源列 |
|---|---|---|---|
| 案例 偏离 + NLM 确认 | ✅ | 高 | 案例 + NLM 双 [参考N] |
| 案例 threshold=NULL + NLM 给答 | ✅ | 中 | 仅 NLM [参考N] |
| 案例 偏离 + NLM 不可用 | ✅(降级) | 中 | 仅 案例 [参考N] · 头标 "⚠️ NLM 不可用" |
| 案例 偏离 + NLM **否认** | ❌ 不进主表 · 移现场观测段 | — | — |
| 案例 没覆盖 + NLM 答得出 | ✅ | 中 | 仅 NLM [参考N] |
| 案例 没覆盖 + NLM 也答不出 | ❌ 移现场观测段 | — | — |

**关键设计**:**第 4 行"案例 偏离 + NLM 否认 → 不进主表"** 是综述 §6.5 "何时停下并接受未达标"的工程化 — 承认这条根因没有可信背书 · 移到独立段标"请独立验证" · **不强行调和** · 不让用户拿到一条"看起来有但其实站不住脚"的根因。

**边际收益评估**(估):

| 源数 | recall | precision | 单次成本(分钟)|
|---|---|---|---|
| 1 (仅案例) | 60% | 70% | 0.5 |
| 2 (案例 + NLM) | 80% | 90% | 2-5 |
| 3 (+ 火焰图 stack pattern · 节后) | 85% | 95% | 6-10 |
| 4 (+ 测试机复现 · 综述 §8 推荐) | 87% | 97% | 30+ |

边际收益 1 → 2 显著 · 2 → 3 中等 · 3 → 4 工程量爆炸(需测试集群)— **节后规划加第 3 源**(火焰图 stack pattern · 已有 cpu-flamegraph plugin 现成 · `data/cases/INDEX.md` 已含 13 条 flame-signature case)· 第 4 源不做。

**跟综述 §6.1 对应**:综述明确"≥3 独立来源最稳" — 节后加第 3 源后 perf-kp-sql 才达到综述推荐的"数据三角最低门槛"。

### L4 · prompt 设计 · 硬约束 + 红线

**一句话**:在 SKILL.md 里把"反模式"具体化成红线 · LLM 看到红线触发自我修正 · 不进自由发挥。

**当前实现**:

| 红线段 | 位置 | 防什么 |
|---|---|---|
| 流程顺序硬约束 7 条 | SKILL.md L28-71 | 跳 phase / 凭印象写 URL / 案例 命中跳 NLM 等 |
| `# 红线`段 | SKILL.md L1498-1527 | 27 条具体红线 · 含 SSH 模式 / 报告骨架 / NLM 鉴权失败处理 |
| 用户可见消息禁用元词清单 | SKILL.md L1530-1572 | 不让 LLM 把"phase 2"等内部坐标暴露给用户 |
| Phase 5.2 URL 强制溯源 | SKILL.md L1258-1306 | 凭训练数据知识联想 URL |
| Phase 5.4 self-check 4 规则 | SKILL.md L1378-1385 | chat 输出被 LLM "美化"成 emoji bullet / 字段竖排 |
| Phase 4 双阶段强制 | SKILL.md L961-963 | 仅案例 单源不许进主表 |

**为什么有效**:

LLM 看到红线时会进入"自我修正"状态。具体机制:

1. **明文反例**(SKILL.md 大量段落用 `❌ 反例` + `✅ 正解` 双对照)— LLM 在 context 里看到反例 + 警告 · 倾向避开
2. **错误信号清单**(self-check 4 规则把"违规长啥样"列出来)— LLM 写完检查时能自查
3. **lint 工具兜底**(format-chat.mjs 漏挂率 > 5% exit 2)— LLM 自查没抓到的 · 工具会抓

**关键约束实例**:

```
6. 报告 [参考N] URL 必须 verbatim 来自 CASES.md `source_url` 或 NLM `references[].source_id`,
   绝对不许:
   - 凭记忆写 URL(`mongodb.com/docs/manual/...` 这种"看起来合理"的)
   - 按 URL 命名模式推断("/docs/manual/reference/operator/query/<X>/ 结构很稳定 · 没打开验证")
   - 凭训练数据知识联想官方文档地址
   - 编 URL 凑数(案例 没有对应 case 但根因合理 → 编一个 URL)
```

— SKILL.md L50-55 的红线 6。它精确地点名了 LLM **会编 URL 的 4 种方式** · 每种都给反例描述。这种"穷举反模式"的 prompt 工程比抽象的"不要编 URL"有效得多。

**跟综述 §3.4 / §5.5 的对应**:

综述 §1 关键预测:`第①、③步现在最容易被 LLM 加速;第②、④步反而被 LLM 压力放大`。perf-kp-sql 的 4 杠杆主要在 ② 筛选 + ④ 验证 上发力 — L1 分阶段把 ② ④ 单独切出来不让混进 ① ③ · L2 数据验证就是 ④ 的工程化 · L3 多源对照就是 ② 的工程化 · L4 prompt 红线把 ② ④ 已知失败模式预先列出。

---

## 3 · 衡量深度的 4 个 metric

要让"深度"可量化 · 提议 4 个 metric(节后实装)· 全部从报告 markdown 文本扫出来。

| 指标 | 定义 | 当前值(估) | 目标值 | 自动量化方法 |
|---|---|---|---|---|
| **citation_density** | 每个原子事实带 `[参考N]` 角标的比例 | 60% | ≥ 95% | format-chat.mjs 已有 lintReport · 复用 atom 切分 · 加 `[参考N]` 检测分支 |
| **mechanism_depth** | 主表"判定依据"列每行能否切出"现场值 / 阈值 / 比较结论"3 个原子 | 50% | ≥ 90% | 扫 cell 内 `<br>` 行数 · ≥ 3 个 `<br>` + 至少 1 个 `[OBS]` + 至少 1 个 `[CASE]/[NLM]` |
| **multi_source_rate** | 主表行有 案例 + NLM 双 `[参考N]` 的比例 | 30% | ≥ 70% | 扫"参考来源"列 · 数 `[参考N]` 出现次数 · ≥ 2 算双源 |
| **action_verifiability** | "建议措施"列含验证命令的比例(后置一句"验证:" + 具体命令)| 40% | ≥ 80% | 正则匹配 cell 内 `验证:` / `verify:` 关键字 + 后跟 backtick code |

**怎么落地**:

1. 在 `scripts/format-chat.mjs` 加 `--metrics` 选项 · 跑完 lint 后输出 4 个数字到 stderr
2. CI 在 `validate.yml` 里跑 sample 报告 · 4 个数字打 baseline
3. 报告 head metadata 加一行 `depth_metrics: citation=95% mechanism=90% multi_source=70% action_verify=80%` · 用户能直接看深度评级

**为什么这 4 个**:

- citation_density:综述 §6.1 数据三角的字段化(每条事实可点开)
- mechanism_depth:把"浅描述"(只一行结论)挡在外面 · 强制至少 3 行展开
- multi_source_rate:综述 §6.1 反偏倚清单第 5 条"引用近亲繁殖" 的工程化 · 单源占比高 = 容易 A 引 B 引 A
- action_verifiability:综述 §6 验证段的"实证"维度 · 用户能立刻 copy-paste 跑一遍验证命令 · 不只是"建议"

4 个指标都可以 0 工程量从已有报告 markdown 扫出 · 不需新数据。

---

## 4 · 失败模式 + 自动识别

LLM 深度不够的 4 个典型表现 · 跟 format-chat.mjs 已有 lint 的覆盖关系:

### 现象 1 · 浅描述

**长啥样**:Top Issue 的"判定依据"列只有 1 行 · 没切原子。

```
| 确认的根因 | 判定依据 | ... |
| WT eviction | cache used 偏高 | ... |
```

**问题**:① 没数 ② 没阈值 ③ 没比较结论 — 综述 §5.2 "原子化"的反模式

**lint 检测**:format-chat.mjs `lintReport()` 已经按 `<br>` 切 sub-line · 加深度 metric `mechanism_depth` 可识别(< 3 个 `<br>` 行 + < 2 个不同 5 标签 → 浅描述告警)

**当前 lint 覆盖**:🟡 部分 — 5 标签漏挂会被抓 · 但"只 1 行"本身不会被抓(单行带 `[CASE]` 也合法)

### 现象 2 · 缺机制

**长啥样**:Top Issue 的"建议措施"列直接是 case 的 mitigation 字面 · 没解释"为什么这么改"。

```
| ... | ... | sysctl -w vm.swappiness=1 [CASE] | ... |
```

**问题**:用户问"为什么要改成 1 而不是 0?" 报告答不上 — 没机制段

**lint 检测**:暂无 · 节后 metric `mechanism_depth` 可加规则:cell 内有命令 + 没有 `[LLM]` 推断段 + 没有"机制:" / "原因:" 短语 → 告警

**当前 lint 覆盖**:❌ 无 — 这是节后改进点

### 现象 3 · 跳级

**长啥样**:Phase 4 报告里写"凭借经验判断" / "通常是这个原因" / "应该是这个" 等元词。

**问题**:这是"我训练数据里见过"的别名 · SKILL.md L919 已禁止

**lint 检测**:加正则黑名单 — `凭(经验|印象)` / `通常(是|认为)` / `应该是` / `一般来说` → 告警

**当前 lint 覆盖**:❌ 无 — 节后加 `--lint-meta-words` 选项

### 现象 4 · 拼凑

**长啥样**:同一 Top Issue 行的判定依据列把多个 case 的字段字母混杂。

```
| WT eviction + nohz | cache=94.7% [CASE]<br>nohz=off [CASE]<br>cpu_irq=high [CASE] | ... |
```

**问题**:WT eviction(case A)跟 nohz(case B)是两个互不相干的根因 · 不能合并成一行 — SKILL.md L66 / L904 已禁止

**lint 检测**:加规则:同一 row 里同一 cell 内出现 ≥2 个不同 case_id 的 source_url(从内部记录关联)→ 告警

**当前 lint 覆盖**:❌ 无 — 节后加 `--lint-row-coherence` · 需要在 Phase 5.2 落 case_id 反查表

### 总结 · 4 个现象的 lint 覆盖矩阵

| 现象 | 当前 self-check | 当前 format-chat lint | 节后改进 |
|---|---|---|---|
| 1 浅描述 | 部分(规则 2 `\|` ≥ 30 间接抓"表被压扁")| 5 标签漏挂能抓 | metric `mechanism_depth` |
| 2 缺机制 | ❌ | ❌ | metric `mechanism_depth` 扩 |
| 3 跳级 | ❌ | ❌ | `--lint-meta-words` 黑名单 |
| 4 拼凑 | ❌ | ❌ | `--lint-row-coherence` |

**判断**:当前 self-check 4 规则 + format-chat lint 重点防"表降级 / 标签漏挂"(L1)· 还没专门防"分析浅" — 节后第一批改进就是把 4 现象的 lint 加上。

---

## 5 · 现存 4 个深度风险 + 改进路线

跟 llm-boundaries.md §4 的 3 个黑盒风险点对应 + 1 个新增。每点给"控深度"角度的改进路线 · 跟 2.4 文档互补 · 不重复。

### 5.1 主要问题摘要的深度

**风险**:llm-boundaries.md §4.1 已列 — 一句话摘要可能跟正文矛盾。**控深度角度**:摘要可能浅化 · 把 "WT eviction 与负载不匹配 · dirty 18% vs target 5%" 简化成 "内存压力大" — 把机制层信息丢掉。

**改进路线**:

| 方案 | 控深度作用 |
|---|---|
| 模板填空(2.4 推荐 A)+ 强制带 mechanism keyword | 模板格式:`Top Issue: <根因短名> · <机制 keyword> · <数字证据> · 风险 <等级>` · keyword 来自 case `mechanism_quote` 字段(Flame case 有专门字段 · DF case 用 `likely_causes[].reasoning_quote` 抽 5 字短语) |

工程量:2.4 估 0.5 天 + 控深度强化 0.5 天 = **1 天**。

### 5.2 用户追问的深度

**风险**:llm-boundaries.md §4.2 已列 — 答非所问 / 调和矛盾源。**控深度角度**:Phase 6 用户追问没强制走"机制 + 代价 + 例外"三段式 · 容易答得很浅。

**改进路线**:

| 方案 | 控深度作用 |
|---|---|
| Phase 6 答复模板硬约束 | 每条追问回答必须含 3 段 · 缺任何一段返回 "I don't know" 比假装答更负责:① 机制(为啥)② 代价(改了影响啥)③ 例外(版本 / 部署形态条件) |
| 节后 lint Phase 6 输出格式 | 类似 format-chat 的 self-check · 但针对追问回答(检 3 段标题 + 各段长度 ≥ 30 字符) |

工程量:**1.5-2 天**(模板设计 + lint 实现)。

### 5.3 根因选择推理链

**风险**:llm-boundaries.md §4.3 已列 — Phase 4 没暴露"为什么选这条 case 排除那几条"。**控深度角度**:推理链不暴露 = 用户没法判断"是不是看错了"· 也是 §6.2 PRISMA-Lite 的核心。

**改进路线**:

| 方案 | 控深度作用 |
|---|---|
| PRISMA-Lite 决策日志(2.4 推荐 B 升级版)| 综述 §6.2 直接对应 · 给 Phase 2 命中的 N 个 case 每个标"进表 / 不进 + 排除原因分类":重复 / 时效 / 不相关 / 不可信 / 信息不足 — 5 类来自综述 §6.2 |

工程量:**3 天**(2.4 估 + 排除原因分类 schema)。

### 5.4 Top Issues 行渲染深度(新增)

**风险**:Phase 5.1 / 5.2 当前主表是"一行 Top Issue 横着 6 列"格式 · 不是"7 行模板纵向展开" · LLM 容易省略某些维度(机制 / 例外 / 验证)。

**当前实现**:SKILL.md L1095-1170 的 6 列表 · 行可以很短(每 cell 1-3 个 `<br>` 即可通过 lint)。这种结构对"深度"不够友好 — 想让用户看到机制 + 代价 + 例外 + 验证 4 个维度 · 6 列横排不够。

**候选改进方案**:

| 方案 | 控深度作用 | 工程量 |
|---|---|---|
| A · 7 行纵向模板(每个 Top Issue 7 行 row · 1 行根因短名 + 1 行机制 + 1 行现场证据 + 1 行版本例外 + 1 行止损命令 + 1 行长期建议 + 1 行验证命令)| 强制 LLM 把 7 个维度都填出来 · 不许省 | 1 天(模板 + lint 检 7 行) |
| B · 在现有 6 列里加"机制" + "例外"两列变 8 列 | 6 → 8 列 · 同 row 横排会更挤 · 终端 80 列渲染会爆 | 2 天(format-chat 重排逻辑改) |
| C · 主表 6 列保留 + 加附录段"每个 Top Issue 的机制 + 例外详写" | 主表保持当前 UX · 附录强制 7 行 | 0.5 天 |

**推荐**:C(主表 + 附录详写)· 工程量小 · 既不破坏现有 UX 又增加深度。

实施细节:

```markdown
## 诊断结果(摘要)
| 6 列表保持当前 |

## 根因详写(每个 Top Issue 7 行展开)

### 根因 1 · WT eviction dirty_target 与负载不匹配
- **机制**:dirty pages 累积超 5% target → eviction worker 跟不上 → cache used → 95% 触发 application thread 直接 evict → 业务线程被阻塞 [CASE]
- **现场证据**:cache used=94.7% [OBS] · dirty=18% [OBS] · application threads evicting=42 [OBS]
- **版本例外**:MongoDB 8.0+ 默认 target=2% · 该参数命令在 8.0+ 已 deprecated · 改用 `wiredTigerEngineRuntimeConfigCompatible` [NLM]
- **止损命令**:`db.adminCommand({setParameter:1, wiredTigerEngineRuntimeConfig:"eviction_dirty_target=3"})` [CASE]
- **长期建议**:配 cron 每 5min 监控 dirty ratio + alert 阈值 10% [LLM]
- **验证命令**:`db.serverStatus().wiredTiger.cache["tracked dirty bytes in cache"]` 应 ≤ 3% [CASE]
- **风险等级**:high · 置信度:高 [LLM]
```

— 7 行强制把"机制 / 例外 / 验证"3 个深度维度从可选变必填。lint 检 7 行 row 的 7 个 bullet keyword(机制 / 现场证据 / 版本例外 / 止损命令 / 长期建议 / 验证命令 / 风险等级) · 缺任意 1 个 exit 2。

**对应综述**:§5.1 三层笔记法的"永久笔记"层 = 这 7 行就是一个"永久笔记"格式 · 把 case 字段 + NLM 答复 + 现场观测组合成原子化、可重读的诊断单元。

---

## 6 · 跟综述的最终对接

### 6.1 §1 "①③ 加速 / ②④ 放大" 对应

| 综述步骤 | 4 杠杆主要在哪个 |
|---|---|
| ① 检索(LLM 加速) | L1(Phase 0/1/2)只做"切台阶" · 不 over-engineer |
| ② 筛选(LLM 放大) | **L2 数据验证 + L3 多源对照 + L4 prompt 红线 主战场** |
| ③ 综合(LLM 加速) | L1(Phase 5.2)+ L4(报告骨架红线) |
| ④ 验证(LLM 放大) | **L2 + L4 主战场**(format-chat lint + self-check 4 规则) |

**结论**:4 杠杆 L1-L4 的工程化重心 · 跟综述预测一致 · 主要落在 ② 筛选 + ④ 验证 上。具体表现是 L2 / L3 / L4 在这两步都有专门约束 · 而 L1 主要是给 ② ④ 切出独立 phase 让深度控制有"地方放"。

### 6.2 §6.5 "何时停下并接受未达标" 对应

综述 §6.5:`如果你的样本里:所有源都不独立 / 没有任何反方 / 没有任何实证 / 时效全部超期,那么诚实的输出是 "这个问题在现有可获取信息下没有可靠结论",而不是硬挤一份。`

perf-kp-sql 的工程化:

| 综述 §6.5 维度 | perf-kp-sql 实现 |
|---|---|
| 没独立来源 | "案例 偏离 + NLM 否认 → 不进主表"(SKILL.md L894 阶段 3 综合判定表)|
| 没实证 | 现场 OBS 必须经 SSH stdout · 没采集到的 metric 不能在判定依据列引用 |
| 时效超期 | NLM 二次确认强制(SKILL.md L977-1016)· 案例 节选与 NLM 推荐不同时 · 报告标"案例 节选可能已过时,以 NLM 引用为准"(L1023)|
| 诚实输出"未达标" | `## 现场观测(无权威来源 · 仅供参考)` 独立段(SKILL.md L1226-1232)· 标"请独立验证后再采取行动" |

**关键**:不强行调和。综述 §5.5 反例 `LLM 会自信地"调和"实际上互相矛盾的来源 · 把矛盾抹平` · perf-kp-sql 的工程化反过来 — **承认矛盾 · 让用户看到"这条没有可靠结论"** · 这是深度的最高层级:**敢说"我不知道"**。

### 6.3 §10 反模式黑名单工程化对应

综述 §10 列了 4 阶段反模式黑名单(共 19 条)。perf-kp-sql 的 SKILL.md `# 红线`段(L1498-1527)+ 流程顺序硬约束(L28-71)是这份黑名单的工程化:

| 综述 §10 阶段 | 对应红线条目数 |
|---|---|
| 检索 5 条(只搜中文 / 看第一页就停 / 没记 query / 没反向求证 / 把 ChatGPT 摘要当一手) | SKILL.md 红线对应:Phase 2 加载 INDEX 强制 + Phase 4 NLM 二次确认强制 = 防 "看第一页就停" + "ChatGPT 摘要当一手" |
| 筛选 5 条(看域名 / 高赞 / 不查作者 / 时效 / 没记排除原因) | SKILL.md L1110-1158 URL 强制溯源 = "查作者" 工程化(必须能点开) + "时效" 工程化(NLM 二次确认) |
| 总结 5 条(copy-paste / 按来源组织 / 调和矛盾 / 闪念笔记积压 / 笔记没原子化) | SKILL.md L1124-1170 5 标签 + 多源拆原子 = "原子化" + "不调和矛盾" |
| 验证 4 条(跳过验证 / 三角同源 / LLM 验 LLM / 没记偏倚清单) | SKILL.md L1378-1385 self-check 4 规则 + L1352-1364 lint exit 2 = "不跳过验证" 工程化 |

19 / 19 条全部有对应红线或 lint 兜底(虽然部分仍是节后改进路线 · 不是 100% 已实装)。这是控深度最重要的"清单工程化"。

---

## 7 · 总结 · perf-kp-sql 控深度一句话

> **L1 分阶段** + **L2 数据验证** + **L3 多源对照** + **L4 prompt 红线** 4 杠杆 · 把 LLM 自由发挥的空间从 100% 区间压缩到"`[LLM]` 标签内"· 让用户能区分**有背书的 / 是 LLM 推断的**。
>
> 深度的工程化定义 = **citation_density ≥ 95% + mechanism_depth ≥ 90% + multi_source_rate ≥ 70% + action_verifiability ≥ 80%** · 4 个 metric 全部可从报告 markdown 扫出来。
>
> 跟 llm-boundaries.md(2.4 项)互补:**2.4 答 "哪些 LLM 该做 / 不该做"** · **2.5 答 "LLM 该做的部分 · 怎么把分析做深"**。两份文档共同回答领导反馈"护城河 = 分析深度"。
>
> 节后第一批工程改进:① 4 个深度 metric 落地 ② 4 个失败现象的 lint 实装 ③ 主表 + 7 行附录详写 ④ Phase 6 追问 3 段式模板。预估 5-7 天工程量。

---

## 8 · 修订历史

| 日期 | 改动 | 作者 |
|---|---|---|
| 2026-05-02 | 初版:4 杠杆 L1-L4 + 4 个深度 metric + 4 现象 lint + 4 风险点改进路线 + 跟 llm-boundaries.md / 综述 §1 / §6 的对接 | perf-kp-sql 方法论 agent |

---

## 附 · 参考

- `docs/methodology/llm-boundaries.md` — 姊妹文档(2.4 项)· 14+ LLM 介入点 · P1-P4 兜底原则
- `skills/perf-kp-sql/SKILL.md` — 流程顺序硬约束(L28-71)· Phase 4 阶段 1/2/3(L965-1027)· 5 标签来源标记(L1124-1170)· URL 强制溯源(L1258-1306)· format-chat self-check 4 规则(L1378-1385)· 红线段(L1498-1527)
- `scripts/format-chat.mjs` — `lintReport()` L45-138 · `stripChatTags()` L143-173 · `rewrapTable()` L278-335 · CLI exit codes 0/1/2/3 L342-346
- `~/Documents/蒸馏工程/蒸馏工程综述.md` — §1 理论地图 · §3 检索 · §4 筛选 · §5 综合 · §5.5 LLM 用法 · §6 验证回路 · §6.1 三角验证 · §6.2 PRISMA-Lite · §6.3 反偏倚清单 · §6.5 何时停下接受未达标 · §10 反模式黑名单
- `docs/superpowers/specs/2026-05-01-md-report-source-tags-design.md` — 5 标签设计书
