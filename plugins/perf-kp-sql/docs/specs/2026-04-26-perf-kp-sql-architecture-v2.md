# perf-kp-sql · 架构 Spec (V2 整理版)

**日期**：2026-04-26
**Skill**：`skills/perf-kp-sql`（Kunpeng ARM64 + MongoDB 性能诊断 · 第一期）
**核心定位**：**结果可溯源（每条结论挂 KB 引用）→ 零幻觉**

> ⚠️ **第一期范围**：mongo only。mysql / redis 代码 + 规则 + KB 数据已全部清理，等 mongo 闭环跑实再扩展。
> *注：本文档基于 2026-04-25 cc 的原始 Spec 整理，统一了数据口径，去除了敏感密码，并理顺了各阶段进展，完整保留了所有底层架构设计、踩坑经验与后续 Agent 的接力 SOP。*

---

## 0 · 设计目标 · 唯一亮点

> 性能诊断工具不缺。我们的差异点只有一个：**任何一条结论都能反查到一段官方原文，KB 没收的就直说没收**。

| 目标 | 实现手段 | 第一期完成度 |
|---|---|---|
| **零幻觉** | KB-grounded findings + footnote 串号 + out-of-scope 显式拒答 | ✅ mongo 全链路 |
| **可溯源** | rules.json 每条带 `source.{tier,url,quote}` + `knowledge.sqlite` 双索引（FTS5 + vec0） | ✅ mongo |
| **定位准** | 三层数据分离（采集/解析/评估）+ legacy CheckFn + 声明式规则 | dual-path 混跑 |
| **可维护** | 规则数据化 → JSON 改动 + rebuild KB 即生效 | ✅ mongo 跑通端到端 |

**反向定义** —— 我们**不**比下面工具强：
- 实时监控（Prometheus/Grafana）—— 这是 one-shot 诊断
- 自动修复（Ansible/Chef）—— 我们只读不写
- 通用 SRE Copilot（无 KB）—— 没有引用 = 不算结论

---

## 1 · 整体形状

```
┌──────────────────────────────────────────────────────────────────────┐
│  USER input (自然语言 host=... user=...)                              │
└──────────────────────────────────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
   ┌─────────────────┐      ┌──────────────────┐
   │ Step 1: 参数门  │      │ history.json     │  ← ~/.ohsql/perf-kp-sql/
   │ (kv→NL→校验)    │◀─────│ (5 条最近连接)   │
   └────────┬────────┘      └──────────────────┘
            │ banner + 5 个 task
            ▼
   ┌────────────────────────────────────────────────────────┐
   │ Step 2: SshExec 远端只读采集 (一次 OS, 一次 DB)         │
   │   - collect-cmds.json: per-engine batch 命令             │
   │   - stdout → Write 到 ~/.ohsql/tmp/perf-kp-sql-*.txt   │
   │   - ssh.mjs --op discover 反推 mongod 实例              │
   └────────┬───────────────────────────────────────────────┘
            │ os-file + db-file (本地路径 · 不再走远端)
            ▼
   ┌────────────────────────────────────────────────────────┐
   │ Step 3: 本地 diagnose.mjs (零网络 · 纯 parse + 评估)    │
   │                                                         │
   │   raw stdout → parseOsIntoMetrics / parseMongoStdout    │
   │                  → DiagContext                          │
   │                                                         │
   │   ┌─────────────────────────┐ ┌─────────────────────┐  │
   │   │ legacy CheckFn (~50 条)  │ │ rule-engine (5+25 条)│ │
   │   │ shared/mongo            │ │ rules.json 声明式   │  │
   │   │     · 主路径             │ │   · 增量补充        │  │
   │   └────────────┬─────────────┘ └──────────┬──────────┘  │
   │                └───────── 合并去重 ────────┘            │
   │                          ▼                              │
   │              CheckResult[] (with Citation)              │
   │                          ▼                              │
   │                buildReportInput()                       │
   │                  - impact_score 排序                    │
   │                  - footnote_refs 串号                   │
   │                          ▼                              │
   │              diag-json (out-json)                       │
   └────────┬───────────────────────────────────────────────┘
            │
            ▼  (并行可选)
   ┌──────────────────────┐    ┌────────────────────────────┐
   │ cpu-flamegraph        │    │ kb.mjs --op query          │
   │ (subskill · 远端 perf)│    │  knowledge.sqlite          │
   │  - on/off-CPU folded  │    │  ┌──────────────────────┐  │
   │  - flame_pattern_regex│    │  │ knowledge_fts (FTS5) │  │
   │    匹配 KB facts      │───▶│  │ knowledge_vec (vec0) │  │
   │  - 拉 SVG 到本地      │    │  │ + RRF 融合           │  │
   └──────────────────────┘    │  └──────────────────────┘  │
                                └────────────┬───────────────┘
                                             │
                                             ▼
                            ┌─────────────────────────────────┐
                            │ Step 4: 渲染                     │
                            │  render-html-report.mjs (HTML)  │
                            │  render-screen-footer.mjs (CLI) │
                            │  → ~/.ohsql/reports/*.html      │
                            └─────────────────────────────────┘
```

---

## 2 · 零幻觉是怎么达成的 —— 四道闸

### 闸 1：findings 来源受控
LLM **不**自己产生 finding。所有 finding 来自两条路径：
- **legacy CheckFn**：约 50 条 TS 函数
- **rule-engine**：5 条 Phase 1 刚打通的结构化 v2 规则 + 约 25 条早期简单 op 规则

### 闸 2：每条 finding 必带 Citation
CheckFn / rule-engine 都不允许返 `citations: []` 的 finding。模板最终将所有 Citation 转换为 `[参考N]` 内联引用。

### 闸 3：KB 检索的 out-of-scope guard
`cli-kb.ts` 使用 FTS5 + vec0 双轨检索并 RRF 融合。若 FTS 0 命中 AND vec top-1 距离 > 0.95 → 判 **out-of-scope** → 清空结果，回复未收录模板。

### 闸 4：LLM 只搬运，不判断
LLM 仅负责提取参数、echo 脚本以及根据既定模板回答。不参与 ranking、不挑 citation、不重排 finding。

---

## 3 · 现状盘点与唯一真实数据口径（截至 2026-04-26）

> 过去多次迭代遗留了不同口径的数字，以下是当前实际运行的**唯一 Truth**：

| 指标 | 真实数字 | 备注 |
|---|---|---|
| **JSON 规则总数** | **349 条** | mongo 规则与 kunpeng-rules 汇总 |
| **URL 与 Quote 验证率** | **100%** | 这 349 条规则全部通过了 `audit.pass=true` |
| **_v2 结构化并启用的规则** | **5 条** | Phase 1 三关筛的产物 |
| **运行时不生效的呆滞规则** | **约 270 条** | 带有 `op:"custom"` 的描述性规则，规则引擎会主动跳过 |
| **运行时实际 fire 总数** | **约 80 条** | 50 (legacy) + 25 (早期 op) + 5 (v2) |
| **knowledge 表总条数** | **2169 行** | 全是 mongo 的 facts |

---

## 4 · 准确性审计与红线偏移 (Critical)

> 零幻觉只承诺"我说的有出处"，不承诺"我说得对"。

### 4.1 URL 与 Quote 审计（已达标）
我们已经运行了全量的 WebFetch 审计，目前库中 349 条规则的 URL 都是活链，且 Quote 都能在网页 HTML 中**字面匹配**（verified_literal/verified_replaced）。
对外可以承诺：**"找出来的 finding 引用，Cmd+F 必能在官方文档里搜到原文。"**

### 4.2 LLM 自由润色导致的红线偏移（待解决）
**红线**：rules.json + sqlite 不存在 LLM 自由编造或改写的内容。

**现状（违红线）**：
- `rules.json` 中的 `reason`, `recommend`, `fix` 等字段，是当年大模型**润色（paraphrase）**出来的自然语言，而不是官方文档原话。
- 整个系统中有 **~3228 处** LLM 自由生成的内容仍在生产数据里。
- 用户在最终报告中看到的可能是大模型编造的文字，而非官方原文。

**决议（Phase 2 前必须执行）**：
执行**收紧路径**。编写 `cleaner v5`，让 LLM 从源 HTML 中**字面截取**子字符串来填充 reason/recommend/fix，严禁添词或翻译。之后由 verifier 拿每段 quote 在 source HTML 里进行强字面匹配，未命中不入库。

---

## 5 · 规则蒸馏方法论与 8 大 Bug 防御清单

> 核心思想：LLM 在 ship 前结构化 · runtime 纯 deterministic。不要让 LLM 担任最终的 Validator。

### 5.1 三道关卡
1. **Gate 1 · 结构化 (OpenAI)**：把自然语言转 JSON。
2. **Gate 2 · 静态验证 (0 LLM)**：`tools/deterministic-validator.ts`，拒逻辑矛盾、字段无法 tokenize。
3. **Gate 3a · 跨模型 QA (Claude)**：跨模型审核。
4. **Gate 3b · 真环境验证 (0 LLM)**：`tools/verify-real-env.ts`，真机器抓 status，字段不存在直接毙掉。

### 5.2 必须防范的 8 大已知 Bug
1. **方向反向**：thp 推荐 always，写成 `op=eq 'always'`（把推荐当告警）。应为 `ne`。
2. **字段虚构**：LLM 编造 `cpu.instruction_set`，必须只用真能查到的字段。
3. **shell 命令当字段**：把 `sysctl vm.swappiness` 当变量。
4. **聚合函数丢失**：把 `rate(X)` 简化为 `X`，累计值永远告警。
5. **AND 死区**：`when [os contains Linux AND os contains BSD]`。
6. **semver 字符串比较**："4.9" >= "4.18" 会判断错误。
7. **区间反向**：`ge 8 AND le 32` 把在区间内当告警。
8. **单位混用**：bytes 和 MB 不换算直接运算。

---

## 6 · Phase 1 实施完成状态与复现命令

### 6.1 Phase 1 做了什么
Phase 1 试图将 258 条由于结构太复杂而废弃的旧规则，通过三关筛转为可用规则。
**通过率瀑布**：258 → 静态通过 155 → 真环境通过 24（因为 91% 字段是虚构的）→ 跨模型通过 5。
**结论**：最终入库 5 条。管线没坏，是当年 LLM 蒸馏的字段定义太烂。

### 6.2 完整复现命令 (供下个 Agent 调试)
```bash
# 0. 抽白名单(从 fixture)
node tools/extract-field-whitelist.mjs

# 1. cleaner v3 重洗(258 → cleaned-v3.json)
nohup npx tsx tools/clean-rules-v3.ts \
  --input reports/cleanup/round2/rework-input.json \
  --output reports/cleanup/round2/cleaned-v3.json \
  --whitelist reports/cleanup/round2/field-whitelist.json \
  --concurrency 8 --model gpt-4o > clean-v3.log 2>&1 &

# 2. 三关静态+真环境
npx tsx tools/triple-gate.ts \
  --rules reports/cleanup/round2/cleaned-v3.json \
  --raw reports/cleanup/round2/rework-input.json \
  --fixture reports/cleanup/round2/real-env-fixture.json \
  --output reports/cleanup/round2/triple-gate-v3.json

# 3. 双关通过的派 subagent (Agent tool 跨模型审)

# 4. 应用入库
node scripts/apply-phase1.mjs

# 5. 重建 sqlite
npx tsx skills/perf-kp-sql/tools/kb-build.ts --op build --force
node skills/perf-kp-sql/scripts/migrate-rules.mjs
node skills/perf-kp-sql/scripts/migrate-knowledge.mjs

# 6. 验证
npm run check && npx vitest run --reporter=basic && npm run build
```

---

## 7 · Phase 2 入口与接力指南 (下一步工作)

**目标**: 让涉及 `rate`/`baseline`/`window` 的规则也能 fire，将实际触发数从 80 推到 130 以上。同时解决上述的红线偏移问题。

### 任务清单：
1. **红线收紧**：编写 Extractive 截取脚本，替换现有的 paraphrase 文本。
2. **rule-engine v3 加 rate / window**：
   - Collector 双采样已经就绪（`t0_serverStatus`, `t1_serverStatus`）。
   - 在 v2 evalCompute 中添加 `rate(metric, interval)` 函数。
   - 添加 `baseline_*` 支持。
3. **重洗 D 类规则**：
   - 过滤出 raw 中包含 rate/avg/window 的约 50 条规则。
   - 用 rate-aware 的 system prompt 重新通过三关筛。
4. **整合入库**：写入 `_v2.checks`，重建 sqlite，不加相位的多余字段。

### Phase 1 遗留的工程债：
1. **字段白名单缺类型**：`field-whitelist` 只有路径没类型，需补齐以供静态验证。
2. **重复规则未去重**：后续需要基于 TF-IDF 进行聚类去重。
3. **info+fire 语义升级**：目前 `finding()` 工厂强制转换为 warning，需在 `models.ts` 层面放开 `info` 级别。

### ⚠️ 防坑守则：
- **密码读取**：测试机环境的所有账号密码必须通过读取 `.env.local` 获得，**绝对禁止**将明文写在文档和脚本代码中。
- **不合格就退场**：`_runtime_excluded: true` 标记即可，不要因为要凑数就让大模型瞎编字段绕过验证。
- **真环境联调优先**：不要跑完完整的 cleanup 才去验真环境，先抽 5-10 条跑全管线探路。
