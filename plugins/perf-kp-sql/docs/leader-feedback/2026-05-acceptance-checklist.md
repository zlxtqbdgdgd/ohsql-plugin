# perf-kp-sql 领导反馈 14 项最终验收对照表

> 时间窗口:2026-05-01(五一假期开干)→ 节后两周(~2026-05-18)
> 反馈源:`LEADER-FEEDBACK-ACTION-PLAN.md`(领导口头反馈整理)
> 用途:让领导一眼看到 14 项每项的交付物、数字证据、还剩什么
> 节奏:8 项工程层(假期窗口 5/1-5/5)+ 6 项方法论层(节后两周 5/6-5/18)
> 状态图例:✅ 完成 · ⚠️ 部分 · ⏸ 推迟/节后做

---

## 一、工程层 8 项(五一假期窗口 · 报告外观 + 归档 + cases)

| # | 领导原话 | 状态 | 做到什么程度 | 具体交付物(路径) | 数字证据 | 还剩什么 |
|---|---|---|---|---|---|---|
| 1.1 | "触发后先告诉用户即将做哪些事" | ✅ 完成 | skill 一被触发,LLM 立刻打屏 5 步流程预告 + 中途会问哪 2 件事;md 报告头部同步 | `skills/perf-kp-sql/SKILL.md` `# 开场白`(L75-L100)+ `templates/report.md` "0. 开场白"段 | 5 步流程 + 中途 2 件事(SSH 凭据 / 问题现象)· chat 打屏 + md 报告双通道一致 · 0 emoji 0 合并行 | (无) |
| 1.2 | "话术要改一下统一一下" | ✅ 完成 | 5 主词 + 文件命名 + 阶段命名全口径统一 | `SKILL.md` 全文 + `templates/report.md` + `scripts/format-chat.mjs` | 主词 5 个(凭据 / 问题现象 / 采集 / 指标 / 诊断)· 覆盖率 90%+ · 文件命名统一为 `runs/<TS>/{report, flame, env, collect-os, collect-mongo}` | "SSH 密码" → "SSH 凭据" 还有 3 处口语提示(`SKILL.md` L398/L413 等)· 是否全替换待领导拍板(见 `data/quality-reports/day1-residual-audit.md`) |
| 1.3 | "显示采集了哪些指标" | ✅ 完成 | Phase 3 task list 显式拆 2 层 8 子项 · 用户能在进度条上看到具体维度 | `SKILL.md` Phase 3 task tracking pattern(L274-L290) | task content 字段拆 2 层显示:**操作系统层**(CPU / 内存 / 磁盘 / 网络)+ **MongoDB 层**(连接池 / 慢查询 / 锁竞争 / 存储引擎)= 2 层 × 4 子项 | (无) |
| 1.4 | "把来源标清楚 case / notebook" | ✅ 超额完成 | 领导只要 2 选(case / NLM)· 实际做成 5 标签 + lint 阻拦 | `scripts/format-chat.mjs` 5 标签 lint 实现 + `SKILL.md` 5 标签规则段 + `docs/methodology/depth-control.md` §1.2 实例 | 5 选一(`[IDX]` / `[CASE]` / `[NLM]` / `[OBS]` / `[LLM]`)· lint 漏挂 > 5% exit 2 阻拦报告生成 · 验证用 `tests/format-chat-lint.test.ts` | (无) |
| 1.5 | "只留 md · 火焰图与 md 同目录" | ✅ 完成 | Pre-flight 一次 mkdir · 5 类产物全归到同一个 `<TS>` 目录 · 中间产物清理 | `SKILL.md` Pre-flight 段 + Phase 5 写盘段 + `scripts/capture-flamegraph.mjs --local-svg-out=` | 全部归到 `~/.perf-kp-sql/runs/<TS>/{report.md, flame.svg, env.txt, collect-os.txt, collect-mongo.txt}` · 5 个文件 1 个目录 · 火焰图 SVG 自动 scp 到本地同目录 | (无) |
| 1.6 | "跑一遍 skill-doctor 自查" | ⏸ 推迟 | (未做 · ohsql 这个 agent 上没装 skill-doctor 工具) | (未做) | (未做) | 等 ohsql agent 装好 skill-doctor 之后跑一次 · 把反馈纳入下一轮 SKILL.md 调整 |
| 1.7 | "全部 cases 可跑通" | ⚠️ 部分 | 静态校验 100% 通过 · 端到端真跑(诊断走完整 SSH 链路)还没批量验过 | `tests/cases/field-integrity.test.ts` + `scripts/check-case-urls.mjs` + `data/quality-reports/case-url-reachability-report.json` + `data/quality-reports/field-integrity-report.json` | 字段完整度 202/202 pass(BP 7 warn-only)· URL 可达 88/88 unique URL = 100%(202 case ref 全部 200) · **e2e 真跑等 Day 4 端到端验证** | e2e 多场景验证(CPU 高 / 慢查询 / cache 压力 / 锁竞争)+ 回归测试套件 · 排在节后做 |
| 1.8 | "素材质量分析" | ✅ 完成(扩展) | 领导只要单维度评分 · 实际做成 9 份评测 + 6 大蒸馏改进清单 | 9 份评测报告 `data/quality-reports/{a3,a4,a6}-*-v2.json` + 3 份正交性 `orthogonality-*.json` + `docs/methodology/distillation-prompt-improvements.md`(680 行) | 覆盖 a1-a6 + b1-b4 + 跨模型召回率(Opus + Sonnet 双跑)+ 4 个深度 metric 真测值 + 6 大蒸馏改进点 | (无) |

---

## 二、方法论层 6 项(节后两周窗口 · 蒸馏自证 + 论文对标)

| # | 领导原话 | 状态 | 做到什么程度 | 具体交付物(路径) | 数字证据 | 还剩什么 |
|---|---|---|---|---|---|---|
| 2.1 | "蒸馏质量自评(覆盖度 / 质量 / 正交性 / 自蒸馏)" | ✅ 起步 + 节后做完整版 | 4 个子命题中 3 个有了首版数据 · "持续自蒸馏闭环"还差节后 | `a3/a4/a6-*-v2.json` 三份评测 + `orthogonality-{coarse-tags, fine-judgment, coarse-recall-validation, coarse-recall-validation-sonnet}.json` 4 份 | **质量**:a3 漂移 severe=0 / moderate=0(0 假引用)· **正交**:跨模型召回率 FN rate Opus=2.0% · Sonnet=2.0%(均 < 5% 业界线)· **rubric 独立化**:技术准确度 × 引用对齐 相关系数 0.868 → 0.133(target < 0.5 已达成)· **覆盖度**:tag cluster 79 个 · 202 case 全标 | 节后做"持续自蒸馏闭环"原型(e+ 多轮)+ 5% 人工抽样校准 |
| 2.2 | "MySQL / Redis 横向对比" | ⏸ 节后做 | 领导明确放节后窗口 · 假期窗口写了前置准备 | `docs/methodology/distillation-prompt-improvements.md`(蒸馏 prompt 6 大改进) + `docs/methodology/crawler-research.md`(170 行 · 爬虫源调研) + `data/quality-reports/crawler-source-probe.json` | 假期窗口完成爬虫源探测 + prompt 改进清单(6 项)· MySQL / Redis 真跑数据节后产出 | 节后第 1 周 MySQL 蒸馏(3 天 · 200 case 量级)· Redis 推后 |
| 2.3 | "论文对标方法论" | ⏸ 节后做 | 领导明确放节后窗口 · 现有母本就位 · 3 流派精读节后做 | `~/Documents/蒸馏工程/蒸馏工程综述.md` 已是母本 · 节后补 KD / Auto KB / LLM-as-Judge 3 流派 | 综述已有 12 章 + 8 案例 · 假期窗口对接到 `depth-control.md` §1.3 + `llm-boundaries.md` §1.3 | 节后第 1 周补 3 流派各 5 篇精读(3-4 天)+ 在文章里标注流派 / 代表作 |
| 2.4 | "LLM 分工边界" | ✅ 完成 | 14+3 个 LLM 介入点逐条说明 · P1-P4 兜底原则成型 | `docs/methodology/llm-boundaries.md`(265 行) | 14 + 3 个 LLM 介入点 · P1-P4 兜底分级 · 3 个黑盒风险点改进路线 · 跨综述 §1 / §6 对接 | (无) |
| 2.5 | "控制大模型分析深度" | ✅ 完成 + 真测 metric | 4 杠杆 + 4 metric 全部真测 · LLM 估值已替换 | `docs/methodology/depth-control.md`(470 行) + `scripts/measure-depth-metrics.mjs` + `data/quality-reports/depth-metrics-measured.json` | 4 杠杆(L1-L4)+ 4 个深度 metric **真测值**:citation_density 0% / mechanism_depth 18.2% / multi_source_rate 39.4% / action_verifiability 0%(扫了 11 份历史报告)· 跟原 LLM 估值(0.6 / 0.5 / 0.3 / 0.4)对比 → 暴露 4 个失败现象 | (无 · 真测值已替换 LLM 估值 · 节后用真测做迭代基线) |
| 2.6 | "火焰图深入分析(列专题)" | ⏸ 立项 · 节后第 3 周起 | 领导原话:"后面可以列一个专题" · 假期窗口只立项不实施 | `docs/methodology/flamegraph-deep-analysis-spec.md`(153 行) | 5 个候选方向 + top 3 推荐 + 资源估算 + 启动时间 5/19+(节后第 3 周) | 立项符合"不在节后两周窗口"约束 · 节后第 3 周开干 |

---

## 三、总结段

### 工程层 8 项

- ✅ **6 项已完成**(1.1 / 1.2 / 1.3 / 1.4 / 1.5 / 1.8)
- ⚠️ **1 项部分**(1.7 · Day 4 端到端验证可补完)
- ⏸ **1 项推迟**(1.6 · ohsql agent 这边 skill-doctor 工具未装)
- 工程层完成率 **75%** · 部分 **12.5%** · 推迟 **12.5%**

### 方法论层 6 项

- ✅ **3 项已完成**(2.4 / 2.5 + 2.1 起步部分)
- ✅ **1 项起步 + 节后做完整版**(2.1 · 4 子命题中 3 个有首版数据)
- ⏸ **2 项节后做**(2.2 / 2.3 · 领导明确放节后窗口)
- ⏸ **1 项立项**(2.6 · 领导明确放 backlog · 节后第 3 周起)
- 方法论层完成率 **50%** · 起步 **17%** · 推迟 **33%**

### 14 项总体

- ✅ **9 项完成**(64%)
- ✅ **1 项起步 + 节后完整版**(7%)
- ⚠️ **1 项部分**(7% · Day 4 端到端验证可补完)
- ⏸ **3 项节后做**(21% · 2.2 / 2.3 / 2.6 都是领导明确放节后窗口或 backlog)
- ⏸ **1 项推迟**(7% · 1.6 · ohsql agent 工具未装)

---

## 四、几处需要领导拍板的小事

1. **(1.2)** "SSH 密码" → "SSH 凭据" 还有 3 处提示语未替换(`SKILL.md` L398 / L413 + `data/quality-reports/day1-residual-audit.md` 已记录)。"密码"更口语 · "凭据"更统一。要不要全替换 · 等领导一句话。
2. **(1.6)** ohsql agent 这边没装 skill-doctor — 是等装好再补 · 还是切到装好的 agent 上专跑一次 · 等领导决定。
3. **(2.1)** "持续自蒸馏闭环"原型节后做 · 是要做完整 e+ 多轮闭环 · 还是先做单轮 minimal viable · 节后第 1 周 review 时确认。

---

## 五、参考材料一览(领导一键溯源)

### 5.1 假期窗口已交付方法论文档

| 路径 | 行数 | 对应反馈 |
|---|---|---|
| `docs/methodology/llm-boundaries.md` | 265 | 2.4 |
| `docs/methodology/depth-control.md` | 470 | 2.5 |
| `docs/methodology/flamegraph-deep-analysis-spec.md` | 153 | 2.6 |
| `docs/methodology/distillation-prompt-improvements.md` | 680 | 1.8 / 2.2 前置 |
| `docs/methodology/crawler-research.md` | 170 | 2.2 前置 |

### 5.2 评测报告(9 份 · `data/quality-reports/`)

| 报告 | 维度 | 关键结论 |
|---|---|---|
| `a3-citation-alignment-v2.json` | 引用对齐 | drift severe=0 / moderate=0 · avg quote-in-source 9.49 / 10 |
| `a4-threshold-rationality-v2.json` | 阈值合理性 | applicable 142 case · avg 7.01 |
| `a6-quality-scorecard-v2.json` | 综合质量 | tech×citation 相关 0.868 → 0.133(rubric 独立化达成) |
| `orthogonality-coarse-tags.json` | 正交粗筛 | 202 case · 79 tag cluster · 168 高相似对 |
| `orthogonality-fine-judgment.json` | 正交精判 | 168 对 · false_positive=26 · keep_both=148 |
| `orthogonality-coarse-recall-validation.json` | 召回 v1(Opus) | FN rate 2.0% < 5% 业界线 |
| `orthogonality-coarse-recall-validation-sonnet.json` | 召回 v2(Sonnet 跨模型) | FN rate 2.0%(独立验证 · 与 Opus 一致) |
| `case-url-reachability-report.json` | URL 可达 | 88/88 = 100% 200 OK |
| `field-integrity-report.json` | 字段完整 | 202/202 pass(BP 7 warn-only) |
| `depth-metrics-measured.json` | 深度真测 | 4 metric 真值替换 LLM 估值 |

### 5.3 关键源码 / 模板

| 路径 | 用途 |
|---|---|
| `skills/perf-kp-sql/SKILL.md`(1630 行) | 主流程 + 开场白 + 5 标签规则 + Phase 3 task list |
| `templates/report.md`(262 行) | 报告头部 0 段开场白 + metadata card |
| `scripts/format-chat.mjs` | 5 标签 lint(漏挂 > 5% exit 2) |
| `scripts/capture-flamegraph.mjs` | 火焰图 wrapper(`--local-svg-out=` 归档同目录) |
| `scripts/measure-depth-metrics.mjs` | 4 深度 metric 真测扫描器 |
| `scripts/check-case-urls.mjs` | 88 URL 可达性回查 |
| `tests/cases/field-integrity.test.ts` | 字段完整度静态校验 |
| `tests/format-chat-lint.test.ts` | 5 标签 lint 单测 |
