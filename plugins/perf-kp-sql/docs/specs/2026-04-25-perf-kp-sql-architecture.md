# perf-kp-sql · 架构 Spec

**日期**：2026-04-25
**Skill**：`skills/perf-kp-sql`（Kunpeng ARM64 + MongoDB 性能诊断 · 第一期）
**核心定位**：**结果可溯源（每条结论挂 KB 引用）→ 零幻觉**

> ⚠️ **第一期范围**：mongo only。mysql / redis 代码 + 规则 + KB 数据已全部清理（见 §6 收敛路径），等 mongo 闭环跑实再扩展。

---

## 0 · 设计目标 · 唯一亮点

> 性能诊断工具不缺。我们的差异点只有一个：**任何一条结论都能反查到一段官方原文，KB 没收的就直说没收**。

| 目标 | 实现手段 | 第一期完成度 |
|---|---|---|
| **零幻觉** | KB-grounded findings + footnote 串号 + out-of-scope 显式拒答 | ✅ mongo 全链路 |
| **可溯源** | rules.json 每条带 `source.{tier,url,quote}` + `knowledge.sqlite` 双索引（FTS5 + vec0） | ✅ mongo |
| **定位准** | 三层数据分离（采集/解析/评估）+ legacy CheckFn + 声明式规则 | dual-path 混跑（见 §6） |
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
   │   - ssh.mjs --op discover 反推 mongod/mysqld/redis 实例 │
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
   │   │ legacy CheckFn (67 条)   │ │ rule-engine (38 条) │  │
   │   │ shared/mongo/mysql/redis │ │ rules.json 声明式   │  │
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
   │ (subskill · 远端 perf)│    │  knowledge.sqlite (10 MB)  │
   │  - on/off-CPU folded  │    │  ┌──────────────────────┐  │
   │  - flame_pattern_regex│    │  │ knowledge_fts (FTS5  │  │
   │    匹配 KB facts      │───▶│  │   trigram)           │  │
   │  - 拉 SVG 到本地      │    │  │ knowledge_vec (vec0  │  │
   └──────────────────────┘    │  │   384d MiniLM)       │  │
                                │  │ + RRF 融合           │  │
                                │  └──────────────────────┘  │
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

| 路径 | 数量 | 实现 | 真源 |
|---|---|---|---|
| legacy CheckFn | 67 条 | `src/shared/checks/*` + `src/engines/*/checks.ts` | TS 函数 |
| rule-engine | 38 条（已实装）/ 411 条（总 entry） | `src/rule-engine.ts:evaluateRulesAsCheckResults` | `data/<engine>/rules.json` |

> ⚠️ 411 - 38 = 373 条 entry 当前 `op:"custom"`（`rule-engine.ts:124` 直接 `continue`），是从权威文档蒸馏出来但**未实装求值**的占位 —— 它们的 `source.url + quote` 仍然进了 KB，作为 RAG 召回素材，但**不会被规则引擎触发**。这是个真实的债，§6 详述。

### 闸 2：每条 finding 必带 Citation

`models.ts.Citation` 形状：

```
{ tier: "official"|"community", url, title, quote, accessed }
```

CheckFn / rule-engine 都不允许返 `citations: []` 的 finding。报告渲染前 `buildReportInput` 把所有 citation 收进 `FootnoteRegistry` 去重编号，模板按 `[参考N]` 内联引用。

### 闸 3：KB 检索的 out-of-scope guard

`src/cli-kb.ts:queryKb` 双轨检索 + 兜底：

- **FTS5（trigram 分词）** 抓字面命中（中英文 + 短 token + 代码标识符都能切）
- **vec0（384d MiniLM）** 抓语义相近
- **RRF 融合** 合并双榜单（`rrfFuse(fts, vec, k=60)`）
- **Guard**：FTS 0 命中 AND vec top-1 距离 > 0.95 → 判 **out-of-scope** → 清空结果

→ 模板 B：`非常抱歉 · 您的 KB 中并未收录「<主题>」… 如基于一般常识回答 …「请独立验证」`。

### 闸 4：LLM 只搬运，不判断

| 谁干 | 干什么 |
|---|---|
| `diagnose.mjs` | parse + 评估 + 排序 + footnote 编号 → 输出已 ranked 的 `report_input` JSON |
| `render-html-report.mjs` | 把 JSON 套 `templates/report.html` 模板 |
| `render-screen-footer.mjs` | 把 JSON + flame-json 套 markdown 模板 |
| **LLM** | 1) Step 1 抽参数 · 2) Step 4.3 echo 脚本 stdout · 3) Step 6 KB 追问按模板 A/B 答 |

LLM 不参与 ranking、不挑 citation、不重排 finding —— 这些都在 TS 里写死。

---

## 3 · KB 数据形状 · 当前真实数字

### 3.1 schema（`src/cli-kb.ts:SCHEMA_SQL`）

```
                      knowledge.sqlite (10 MB)
                      ┌─────────────────────────────────────────┐
rules 表 (411 行)      │ knowledge 表 (2257 行 · 100% 是 mongo)   │
  ├ rule_id           │   ┌─ 7 类核心 fact ──────────────────┐  │
  ├ checks (JSON)     │   │ summary       371                 │  │
  ├ recommendations   │   │ mechanism     262                 │  │
  ├ source_url        │   │ trade_off     246                 │  │
  ├ source_title      │   │ when_deviate  246                 │  │
  ├ engine_version_*  │   │ threshold     371                 │  │
  └ arch / vendor     │   │ remediation   371                 │  │
                      │   │ citation      371                 │  │
                      │   └────────────────────────────────────┘ │
                      │   + 2 类辅助 fact（追问加权用）          │
                      │     keywords      9                     │
                      │     topic_answer  10                    │
                      │                                         │
                      │ 索引：                                   │
                      │   knowledge_fts (FTS5 trigram)          │
                      │   knowledge_vec (vec0 · 384 维)         │
                      └─────────────────────────────────────────┘
```

### 3.2 实际覆盖（第一期清理后）

| engine | rules 表 | rules 实装率（非 custom） | knowledge 行数 | data/<engine>/*.md |
|---|---|---|---|---|
| `any` | 66 | 20 | 0 | (走 `data/common/`) |
| `mongo` | 330 | 10 | 2257 | 39 篇 |
| **合计** | 396 | 30 | 2257 | 39 |

mysql/redis 的 rules / facts / docs 已从 sqlite + 仓库内全部清除（`rules` 表少 15 行 · `knowledge` 表无变化因本来就只 mongo）。

### 3.3 grade 字段（v0.4 新加的证据等级）

`grade ∈ {1=官方直接, 2=源码结构推理, 3=禁用}` 设计了，但 DB 里：

```
NULL  2248
1        9
```

**没有 grade=2/3 的数据**。SKILL.md / 旧 spec 提的"grade=3 拒答"目前是空挡 —— 守门员没上场。当前生效的只有 `confidence ∈ [0,1]`（每条 fact 都有）。

### 3.4 火焰图 KB 联动

`semantic_group + flame_pattern_regex` 让火焰图函数名能查 KB：

```
__wt_evict_*  ──regex 命中──▶ semantic_group=wt-eviction
                                ↓
                         查 KB facts WHERE semantic_group='wt-eviction'
                                ↓
                         "WT eviction worker 阻塞 → cache 压力" + [参考N]
```

三层 fallback：`flame_pattern_regex` → `context-ancestors` → `module` → 模板 B。

> ⚠️ `flame_patterns` 当前覆盖薄（个位数 group），第一层大概率 miss，第二层（context-ancestors）兜底为主。

---

## 4 · 排序与分组：让用户先看哪条

### 4.1 wait_class · 6 类（不是 5 类）

`src/shared/utils.ts:WAIT_CLASS_ORDER`：

```
CPU · I/O · 内存 · 并发 · 网络 · 其他
```

前 5 类对齐 Oracle ADDM。**第 6 类"其他"是兜底** —— `waitClassOf()` 拿到没登记的 rule_id 就归这里。当前 rule-engine 跑出的 `mongo-resources-*` 等新 ID 没进 `WAIT_CLASS_MAP`，**全部归入"其他"**（见 §6 已知问题 #2）。

### 4.2 impact_score（`src/report.ts:30`）

```
impact_score = SEVERITY_WEIGHT × CONFIDENCE_WEIGHT × (1 / FIX_COST_WEIGHT)
```

| 维度 | 权重 |
|---|---|
| severity | critical=10 · warning=5 · info=1 · ok=0 |
| confidence | high=1.0 · medium=0.7 · low=0.4 |
| fix_cost | trivial=1 · restart_engine=3 · schema_migration=10 |

切 P1/P2/P3/P4 在报告 Top Issues 段落。

### 4.3 footnote 串号

- `FootnoteRegistry`（`src/report.ts`）全报告唯一去重的 URL 列表
- 每个 `RankedResult.footnote_refs: number[]` 是该 finding 在报告里要写的编号
- HTML 模板和屏幕 footer 共用同一份串号

---

## 5 · 关键文件

| 路径 | 作用 |
|---|---|
| `SKILL.md` | 6-step workflow · gate 规则 · 红线 |
| `data/collect-cmds.json` | 3 engine SSH 采集 batch（OS 41 marker · Mongo 单 mongosh eval） |
| `data/<engine>/rules.json` | per-engine 规则（mongo 314 · mysql 23 · redis 39） |
| `data/<engine>/INDEX.md` + `*.md` | per-engine 文档（**仅 mongo 39 篇**，mysql/redis 缺） |
| `data/common/` | Kunpeng + OS 通用 KB |
| `data/knowledge.sqlite` | rules + knowledge + FTS5 + vec0 |
| `src/cli-diagnose.ts` | 本地分析入口（dual-path：legacy + rule-engine） |
| `src/cli-kb.ts` | KB 检索 + 统计 + 双轨 RRF |
| `src/cli-ssh.ts` | SSH exec + 实例 discover |
| `src/cli-history.ts` | 历史连接持久化 |
| `src/rule-engine.ts` | 声明式规则评估器（**op=custom 跳过**，line 124） |
| `src/report.ts` | impact_score + FootnoteRegistry |
| `src/engines/{mongo,mysql,redis}/` | per-engine parser + legacy CheckFn |
| `tools/kb-build.ts` | 作者侧 KB 构建（init/extract/build/mine/merge/enrich） |
| `tools/kb-validate.ts` | KB 引用审计 |
| `templates/report.{md,html}` | HTML / 屏幕模板 |
| `scripts/render-html-report.mjs` | HTML 报告 |
| `scripts/render-screen-footer.mjs` | 终端 footer |

---

## 6 · 现状盘点 · 为什么衔接不上 · 怎么收敛

### 6.1 为什么衔接不上 —— 两条建设线没合龙

代码考古下来，是**两次没收尾的工业化叠在一起**：

**v1 时期 · CheckFn 主路径**（已上线 · 跑得通）
- 业务专家直接写 TS 函数：每个 check 拿 `DiagContext` 算个布尔，命中就 `finding({...citations})`
- 67 条全跑在 mongo，是 demo 阶段的可信路径
- 缺点：规则在代码里，改规则要 rebuild + ship；mysql/redis 几乎没人写

**v2 时期 · 规则数据化 + KB 双索引**（在做 · 没完）
- 设想：从权威文档蒸馏 `rules.json` → rule-engine 评估 → KB facts 用于 RAG
- mongo 蒸馏完成（314 条 + 2257 facts），但 metric_expr 复杂（带 rate/baseline/window），写不进 `op` 简单比较，只能塞 `op:"custom"` 占位 → rule-engine 跳过
- mysql/redis 只有 rules.json scaffold，没 docs 蒸馏，也没 KB facts → **第一期已删**
- legacy CheckFn 没退场，因为 rule-engine 没真接管

**叠在一起的结果**：
- 报告里大部分 finding 还是 v1 CheckFn 出的（mongo）
- v2 的 396 条规则只 30 条真求值，剩下 366 条是"KB 素材池"
- 旧 spec 描述的是"v2 完工后的样子"，代码停在"v1 + v2 半成品"
- 第一期决定：先把 mongo 这条线打通到底，再考虑横向扩展

### 6.2 已知小问题清单

| # | 位置 | 问题 |
|---|---|---|
| 1 | `cli-diagnose.ts:116-125` | rule-engine catch 把 `internal.rule_engine.load_error` 塞 `results[]`，会污染用户 finding + footnote |
| 2 | `cli-diagnose.ts:128` + `shared/utils.ts:WAIT_CLASS_MAP` | `countByWaitClass` 只认 v1 id 前缀（os/kunpeng/mongo），v2 rule-engine 出来的 `mongo-resources-*` 全进"其他" |
| 3 | `cli-diagnose.ts:143` | `report_metadata.scanned_kb_docs` 硬编 0，footer 永远显示 "0 KB docs" |
| 4 | `flame_patterns` 表 | 只 9 个 group，三层 fallback 第一层基本必 miss |
| 5 | `legacy-checks.ts:isCheckFnCovered` | 死代码，迁移辅助函数没接通 |

### 6.3 收敛路径（建议 · 按价值排序）

> 原则：**亮点是 KB · 不是规则数量**。先把"零幻觉链路"在一个 engine 上做实，再复制。

**Phase A · mongo 闭环（让差异点真正成立）** — 1-2 周

1. **打通 op=custom 的 metric_expr** —— 给 `rule-engine.ts` 加 mini-DSL（rate/window/baseline 三个原语就够），把 mongo 330 条 entry 里能落地的 ~150 条从 custom 转 fire
2. **用 rule-engine 替代等价 mongo legacy CheckFn** —— 两边覆盖重叠的逐条迁移并删 legacy；保留 OS/kunpeng 的 CheckFn（这些不该数据化）
3. **填 grade 字段** —— audit-grounding 跑一遍，把每条 fact 标 1/2/3，激活 grade=3 拒答
4. **修 §6.2 #1/#2/#3 三个小 bug**

退场标准：mongo 报告上每条 finding 都来自 rule-engine，footnote 全员有 quote，audit-grounding 报告 0 unsourced finding。

**Phase B · 火焰图链路加厚** — 1 周

5. 扩 `flame_patterns` 到 30+ 个 group（覆盖 wt-cache / wt-block / wt-checkpoint / mongo-locker / mongo-network / glibc-malloc / kernel-fs 等）
6. 把 `cpu-flamegraph` 的 KB 命中也并入 footnote 串号

**Phase C · 横向扩 mysql / redis** — 待 mongo 闭环验证后规划

- 第一期为求亮点跑实，主动砍掉 mysql/redis；扩展时按 Phase A 同样模板：先 docs 语料 → 蒸馏候选 → 填 rules.json → rebuild KB → 替换 legacy CheckFn

### 6.4 不做的事（明确边界）

- ❌ 不堆"看起来很多"的 rules.json 条目 —— 数量不是亮点，**有 quote 才是**
- ❌ 不给 mysql/redis 临时塞通用建议（"建议加索引"等无 citation 的话）
- ❌ 不做实时监控 / 自动修复 —— 那是别的工具的活
- ❌ 不让 LLM 决定 ranking / 选 citation —— 一旦让，零幻觉就破

---

## 7 · 准确性审计 · 让 KB 真的可信（v0.5 新增）

**前提**：零幻觉只承诺"我说的有出处"，不承诺"我说得对"。要让出处真的可信，KB 数据自己得审一遍。

### 7.1 问题域

`rules.json` 是 OpenAI 一次性蒸馏产物，**没有人审过**。可能的腐烂源：

- URL 死链：MongoDB / Huawei / openEuler 改文档结构 → 旧 URL 404
- URL 漂移：3xx 跳转到新位置 → 当前 URL 还能活，但语义可能变了
- Quote 漂移：原文页面改写 → 历史摘录的字面已不在页面上
- Threshold/recommend 错抄：LLM 蒸馏时把数字/方向写错（page 说 "≤ 5%"，rule 写成 "≥ 5%"）

### 7.2 审计流程（4 步）

**Step 1 · URL liveness 全量扫描**
- 收集 `data/mongo/rules.json` + `data/common/kunpeng-rules.json` 中所有 distinct URL
- 逐个 HTTP HEAD → 标 200 / 3xx (chain) / 4xx / 5xx / network-error
- 输出 `data/audit-citations-<TS>.json`

**Step 2 · Quote 字面匹配验证**
- 对 200 的 URL：HTTP GET 拉正文，strip HTML，normalize whitespace
- 在正文里搜 quote 字面（容忍空白差异、引号差异）
- 字面命中 → `quote_match=literal`
- 字面 miss → `quote_match=miss`（标记，不自动改）

**Step 3 · 修复（不自动删）**
- URL 3xx → 自动更新 `source.url` 到 redirect 终点（低风险）
- URL 4xx + 找到替代（archive.org / 同站搜） → 标 `proposal_replacement_url`，等人审
- URL 4xx + 找不到替代 → 标 `dead_url_no_replacement`，**不删规则**
- Quote miss → 标 `quote_rot`，**不自动改**
- 改完 rebuild `knowledge.sqlite`，规则加字段 `last_audited: "YYYY-MM-DD"` + `audit_pass: true`

**Step 4 · CI 防腐**
- 每月自动跑一次 Step 1+2 抽样
- 检测到新 rot → 自动开 issue
- 防止 KB 静默退化

### 7.3 审计输出格式

`data/audit-citations-<TS>.json`：

```json
{
  "audited_at": "2026-04-26",
  "summary": {
    "rules_total": 396,
    "urls_distinct": 152,
    "url_live": 138,
    "url_redirect": 9,
    "url_dead": 5,
    "quote_literal_match": 320,
    "quote_miss": 71,
    "quote_skipped": 5
  },
  "issues": [
    {
      "rule_id": "mongo-resources-...",
      "url": "https://...",
      "url_status": "redirect",
      "url_final": "https://...new-location",
      "quote_match": "literal",
      "quote_excerpt": "...",
      "notes": ""
    }
  ]
}
```

### 7.4 审计标准（退场）

- ✅ 100% 规则 URL 状态明确（live / redirect-followed / dead-marked）
- ✅ 100% 有 quote 的规则 quote_match 状态明确
- ✅ 死链全部被标记（不删 · 等人审）
- ✅ knowledge.sqlite 跟修过的 rules.json 一致

跑完之后**对外可以真说**：
> "这 396 条规则的每一个 URL 都是 YYYY-MM-DD 验过的活链，每一条 quote 都从当时的官方页面字面对得上。"

这是亮点的实兑。

### 7.5 工具

- `tools/audit-citations.ts` — 审计主脚本（输出 JSON 报告）
- `tools/audit-fix.ts` — 半自动修复（应用 redirect、写回 rules.json）

---

## 8 · 审计执行进展（2026-04-26 · 已收尾）

### 8.0 终态（Round 2 完成）

| 指标 | 数字 |
|---|---|
| 规则总数（rules.json 文件） | 371 |
| `audit.pass = true` | 328 / 371 = **88.4%** |
| `_runtime_excluded`（找不到字面 backing · 退场） | 43 |
| **运行时实际加载规则** | **328** |
| **运行时加载规则的 audit.pass 率** | **100%** ← 这就是对外的承诺 |

**对外可以这样说**：

> 客户跑诊断时实际加载的 328 条规则 · 100% 都是 2026-04-26 实地 WebFetch 验过的 · 用户拿 finding 里的 quote 打开 URL · Cmd+F 必能搜到。

### 8.1 已完成（按时间顺序）

- **第一轮全量审计**（371 规则 / 138 distinct URL）
  - 工具：`skills/perf-kp-sql/tools/audit-citations.ts`
  - 命令：`npx tsx skills/perf-kp-sql/tools/audit-citations.ts`
  - 输出：`skills/perf-kp-sql/data/audit-citations-20260426-001009.json`
- **6 subagent 修复批次**（Round 1 · 186 待修规则 / 74 distinct URL）
  - 输入：`reports/audit-batches/batch-{1..6}.json`
  - 输出：`reports/audit-batches/batch-{1..6}-result.json`
  - 汇总：`reports/audit-batches/all-results.json`
- **应用结果**到 rules.json + 加 `audit` 字段（每条规则）
  - 脚本：`scripts/apply-audit.mjs`
  - 改了：`data/mongo/rules.json` + `data/common/kunpeng-rules.json`
- **重建 sqlite**
  - `npx tsx skills/perf-kp-sql/tools/kb-build.ts --op build --force`
  - `node skills/perf-kp-sql/scripts/migrate-rules.mjs`（已加 mysql/redis 过滤防污染）
  - `node skills/perf-kp-sql/scripts/migrate-knowledge.mjs`
- **复审**：`skills/perf-kp-sql/data/audit-citations-after-fix.json`
- **终报**：`reports/audit-citations-final-2026-04-26.md`

**Round 1 结果**：

| 状态 | 数量 | 占比 |
|---|---|---|
| `verified_literal` | 220 | 59.3% |
| `verified_replaced` | 87 | 23.5% |
| `unsupported`（页面真不支持论断） | 30 | 8.1% |
| `spa_unverifiable`（hikunpeng SPA · 工具盲区） | 28 | 7.5% |
| `page_truncated`（mongodb 大页 · WebFetch 截断） | 4 | 1.1% |
| `url_dead`（404） | 2 | 0.5% |
| **`audit.pass = true`** | **307 / 371** | **82.7%** |

### 8.2 进行中（rate limit 中断 · 待恢复）

**Round 2** —— 把 82.7% 推到 100% 的执行计划：

派出 6 个 subagent 处理剩余 64 条问题，**1 个返回结果 · 5 个被 Anthropic API rate limit 中断**（reset：2026-04-26 02:50 PT）。

| Phase | Batch | 待修条数 | Subagent 状态 | 输入文件 | 输出文件 |
|---|---|---|---|---|---|
| A1 mongodb 大页 | 1 | 4 | ✅ 完成 (fixed=1, still_truncated=3) | `reports/audit-fix-batches/A1-mongodb-truncated.json` | `reports/audit-fix-batches/A1-result.json` |
| A2 hikunpeng SPA | 2 | 28 | ❌ rate-limited | `reports/audit-fix-batches/A2-hikunpeng-spa.json` | `reports/audit-fix-batches/A2-result.json`（待生成）|
| B1 内容债 | 3 | 8 | ❌ rate-limited | `reports/audit-fix-batches/B1-content-debt.json` | `reports/audit-fix-batches/B1-result.json`（待生成）|
| B2 内容债 | 4 | 8 | ❌ rate-limited | `reports/audit-fix-batches/B2-content-debt.json` | `reports/audit-fix-batches/B2-result.json`（待生成）|
| B3 内容债 | 5 | 8 | ❌ rate-limited | `reports/audit-fix-batches/B3-content-debt.json` | `reports/audit-fix-batches/B3-result.json`（待生成）|
| B4 内容债 | 6 | 8 | ❌ rate-limited | `reports/audit-fix-batches/B4-content-debt.json` | `reports/audit-fix-batches/B4-result.json`（待生成）|

### 8.3 接力指令（给下一个 agent）

**前置**：等 Anthropic API rate limit 恢复（2026-04-26 02:50 PT 之后）。

#### Step 1 · A1 部分应用 + 重派 still_truncated 3 条

- `A1-result.json` 已有 1 条 fixed · 3 条 still_truncated
- 3 条 still_truncated 都在 `mongodb.com/docs/manual/reference/configuration-options/` 巨型页（100KB+）的不同 anchor
- 选项：
  - (a) 放宽"不改 URL"约束 · 允许换到 `production-notes/` / `kerberos/` / `journaling/` 等单独页
  - (b) 装 Playwright 渲染（headless），auditor 重写支持渲染抽段
- 推荐 (a) · subagent prompt 修改"允许换 URL"

#### Step 2 · A2 重派 hikunpeng 28 条

读 `reports/audit-fix-batches/A2-hikunpeng-spa.json`，原 prompt 在历史会话里（核心：尝试 WebFetch 强制渲染 → WebSearch 找 huaweicloud / cnblogs / bbs 镜像 → 跨权威源 → 退场）。subagent 输出到 `reports/audit-fix-batches/A2-result.json`。

#### Step 3 · B1-B4 重派 32 条内容债

读 `reports/audit-fix-batches/B{1,2,3,4}-content-debt.json`，每个 8 条，并发派 4 subagent。每条规则按这个流程：
1. 域内搜（mongodb.com 系列）
2. 跨权威源（Kunpeng / Linux kernel / openEuler / Red Hat / Ampere · 不接社区源）
3. 找到字面 backing → `status: "fixed"` + new_url + new_quote
4. 找不到 → `status: "retired_no_backing"`

输出 `B{n}-result.json`。

#### Step 4 · 应用所有 result 到 rules.json

写一个 `scripts/apply-round2.mjs`（可参考 `scripts/apply-audit.mjs`）：
- 读 `A1-result.json` + `A2-result.json` + `B{1..4}-result.json`
- `status: "fixed" / "literal_via_webfetch" / "replaced_*"` → 替换 `source.url` + `source.quote`，更新 `audit: { status: "verified_replaced", pass: true, last_audited: "2026-04-26" }`
- `status: "retired_no_backing"` → 保留规则但 `audit: { status: "retired_no_backing", pass: false }`，**同时在 rules.json 顶层加 `_runtime_excluded: true` 字段**，让 rule-engine 加载时跳过
- 在 rule-engine.ts 里加一行：`if (rule._runtime_excluded) continue;`

#### Step 5 · 重建 sqlite

```bash
npx tsx skills/perf-kp-sql/tools/kb-build.ts --op build --force
node skills/perf-kp-sql/scripts/migrate-rules.mjs
node skills/perf-kp-sql/scripts/migrate-knowledge.mjs
```

#### Step 6 · 复审 + 终报

```bash
npx tsx skills/perf-kp-sql/tools/audit-citations.ts \
  --out skills/perf-kp-sql/data/audit-citations-round2.json
```

写 `reports/audit-citations-round2-2026-04-26.md`，含 Round 1 → Round 2 对比 + audit.pass 比例（目标 ≥ 99%，剩下 < 1% 是真的工具盲区或退场）。

#### Step 7 · 5 分钟刷新一次状态

每 5 分钟（用 ScheduleWakeup / Monitor 工具）：
- 检查 `reports/audit-fix-batches/*-result.json` 哪些已生成
- 跑 `git status` 看 rules.json 有没有改动
- 简短播报：`Phase A1: ✅ · A2: subagent 跑中 (10/28 条) · B1: 待派 ...`

### 8.4 已落盘的所有产物清单

```
docs/specs/2026-04-25-perf-kp-sql-architecture.md  ← 本 spec
reports/
  audit-citations-2026-04-26.md                  ← Round 0 报告(初审)
  audit-citations-final-2026-04-26.md            ← Round 1 终报
  audit-problem-urls.json                        ← 第一轮问题分组
  audit-batches/
    batch-{1..6}.json                            ← Round 1 入参
    batch-{1..6}-result.json                     ← Round 1 6 subagent 输出
    all-results.json                             ← Round 1 汇总
  audit-fix-batches/                             ← Round 2(待续)
    A1-mongodb-truncated.json                    ← 输入
    A1-result.json                               ← ✅ 已完成
    A2-hikunpeng-spa.json                        ← 输入(待派)
    B{1..4}-content-debt.json                    ← 输入(待派)

skills/perf-kp-sql/
  data/
    knowledge.sqlite                             ← Round 1 已重建
    audit-citations-20260426-001009.json         ← Round 0 全量自动审计
    audit-citations-after-fix.json               ← Round 1 复审
    mongo/rules.json                             ← Round 1 已加 audit 字段 + 87 quote 替换
    common/kunpeng-rules.json                    ← Round 1 已加 audit 字段
  tools/
    audit-citations.ts                           ← 全量审计脚本
  scripts/
    migrate-rules.mjs                            ← 已加 mysql/redis 过滤
    migrate-knowledge.mjs

scripts/
  apply-audit.mjs                                ← Round 1 应用脚本(参考)
```

### 8.5 验证检查（接力时跑一遍）

```bash
npm run check      # tsc
npx vitest run     # 99 tests should pass
npm run build      # cartridge bundle
```

确认 sqlite 状态：

```bash
sqlite3 skills/perf-kp-sql/data/knowledge.sqlite \
  "SELECT 'rules:' || engine || '=' || COUNT(*) FROM rules GROUP BY engine
   UNION ALL SELECT 'knowledge:' || engine || '=' || COUNT(*) FROM knowledge GROUP BY engine
   UNION ALL SELECT 'flame_patterns:' || COUNT(*) FROM flame_patterns;"
```

期望（Round 1 终态）：

```
rules:any=66
rules:mongo=330
knowledge:mongo=2257
flame_patterns:9
```

---

## 9 · 规则评估架构 · v0.6 (2026-04-26 重新拍板)

### 9.1 反思 · 之前路子歪了

走过两条死胡同：

1. **mini-DSL 派**：扩 rule-engine 支持 `rate / baseline / when` —— 但 314 条规则的 `metric_expr` 字段当年蒸馏成"自然语言文字"(96% 不含比较符)，DSL 解析它们也跑不起来。
2. **LLM-as-judge 派**：runtime 让 LLM 看 metric+rule 判是否 fire —— PoC 准确率 81% · 简单算术错误率高(0.125 > 0.5 都判错)，**100x 慢 + 100x 贵 + 不可单测**。

**根本问题不是"规则太复杂"** · 而是 **"规则数据当年没结构化好"**。

### 9.2 正确架构 · LLM 在 ship 前 · runtime 纯 deterministic

```
                ┌──────────────────────────────────────┐
                │   ship 前 · 一次性 · 离线            │
                │                                       │
                │  raw metric_expr + threshold         │
                │  (英文/中文混杂 · 单位不一致 · 无 when)│
                │              ↓                        │
                │  OpenAI 结构化 (gpt-4o)              │
                │              ↓                        │
                │  subagent QA (打分 0-10)             │
                │              ↓                        │
                │  score ≥ 8 通过 / < 8 重洗           │
                │              ↓                        │
                │  人 review 抽样                       │
                │              ↓                        │
                │  写回 rules.json                      │
                └────────────────┬─────────────────────┘
                                 │
                                 ▼ (rebuild · 入 sqlite)
                ┌──────────────────────────────────────┐
                │   runtime · 客户机器                  │
                │                                       │
                │  指标采集                             │
                │              ↓                        │
                │  rule-engine v2 (TS 纯函数 · 0 LLM)  │
                │    支持: when / compute / and-or /   │
                │          safe-divide / 单位换算       │
                │              ↓                        │
                │  fire findings (确定性 · 可单测)     │
                └──────────────────────────────────────┘
```

### 9.3 规则结构化目标 schema

```json
{
  "id": "mongo-config-auth-failed-delay-high",
  "engine": "mongo",
  "severity": "warning",
  "when": [
    { "metric": "authFailedDelayMs", "op": "gt", "value": 0 }
  ],
  "checks": [
    {
      "compute": "(serverStatus.connections.current / (serverStatus.connections.available + serverStatus.connections.current)) * 100",
      "op": "gt",
      "value": 80,
      "unit": "percent"
    }
  ],
  "source": { "url": "...", "quote": "..." },
  "audit": { "pass": true, "last_audited": "2026-04-26" },
  "structuring": {
    "qa_score": 9,
    "qa_iterations": 1,
    "structured_at": "2026-04-26"
  }
}
```

### 9.4 清洗管线（执行计划）

| 阶段 | 工具 | 任务 |
|---|---|---|
| Step 1 | `tools/clean-rules.ts` | OpenAI gpt-4o 把每条规则的 metric_expr/threshold/reason 综合成结构化 schema |
| Step 2 | `tools/qa-rules.ts` | 子 agent / Claude Opus 对结构化结果打分 0-10(单位/方向/when 完整/语义保真) |
| Step 3 | orchestrator | 分数 < 8 → 把 QA 反馈带回 Step 1 重洗 · 最多 3 轮 · **全自动 · 无人审** |
| Step 4 | 写回 rules.json | 全部通过的规则覆盖原 rule.metric_expr/checks 字段 |
| Step 5 | `rule-engine v2` | TS 纯函数 evaluator · 支持 when/compute/and-or/单位换算 |

**预期产出**：314 条带 `qa_score ≥ 8` 的结构化规则 + 升级版 rule-engine + 单测覆盖。

### 9.5 防错红线

- ✗ runtime 不调任何 LLM
- ✗ 结构化字段必须 ≤ 8 分都重洗 · 不放过
- ✗ 不允许 compute 表达式有未声明字段
- ✗ 不允许单位混用(bytes ÷ MB 必须先归一化)
- ✓ 每条规则保留 `original_metric_expr` 字段供回溯
- ✓ 结构化失败 ≥ 3 次 → 标 `structuring_failed: true` · 不入 runtime

---

## 10 · 规则蒸馏方法论 · 给下一个数据库用（mysql / redis / postgres ...）

> **Why 这一节存在**：mongo 走过的弯路 · 下一个数据库不该再绕。

### 10.1 总原则

```
LLM 在 ship 前结构化 · runtime 纯 deterministic
         ↓
3 道独立关卡 · Union 才放行
   ┌─ Gate 1 · OpenAI 结构化(gpt-4o)
   ├─ Gate 2 · 机器静态验证(0 LLM)
   └─ Gate 3 · 跨模型 subagent 审 + 真环境跑
         ↓
   全过 → 入 rules.json → rebuild sqlite
   任一不过 → 重洗(带反馈) · 最多 3 轮 · 仍不过 → 退场不入库
```

**关键悟：LLM 自审不可信 · 通过率从 47% 到 11%**(差额 36% 是假阳性)。**必须跨模型 + 机器硬验**。

### 10.2 三道关卡的分工

| 关卡 | 工具 | 模型 | 0 LLM 时刻 | 揪出的 bug 类 |
|---|---|---|---|---|
| **Gate 1 · 结构化** | `tools/clean-rules-v2.ts` | OpenAI gpt-4o | ✗ | 把蒸馏字段(metric_expr / threshold)转 JSON · 含 when/checks/compute |
| **Gate 2 · 静态验证** | `tools/deterministic-validator.ts` | 无 | ✓ | 逻辑矛盾 / 函数丢失 / 字段语法错 / op 反向 / shell 命令字符串 |
| **Gate 3a · 跨模型 QA** | Claude subagent (general-purpose) | Claude Sonnet | ✗ | 默认值反向 / 字段虚构 / 单位错 / AND 死区 / semver 字符串比 |
| **Gate 3b · 真环境验证** | `tools/verify-real-env.ts` | 无 | ✓ | 字段路径在真 serverStatus 中不存在 / compute 求值 NaN / 类型不匹配 |

### 10.3 已知 8 大 bug 类 · 防御清单

```
1. 方向反向(致命)
   错: thp 推荐 always · op=eq 'always' 把推荐当告警
   对: op=ne 'always' (不是推荐才告警)

2. 字段虚构(致命)
   错: LDAPAuthorizationEnabled · cpu.instruction_set · authFailedDelayMs
   对: 只用 mongosh 真能查到的: serverStatus.* / hostInfo.* / getCmdLineOpts.parsed.*

3. shell 命令当字段
   错: metric: "sysctl vm.swappiness"
   对: metric: "vm_swappiness" (变量名 · evaluator 拿采集结果按名查)

4. 聚合函数丢失
   错: rate(X) 简化成 X · 累计值永远 fire
   对: 命名带后缀 rate_X_per_hour · 或 unit=count_per_hour

5. AND 死区
   错: when [os contains "Linux", os contains "BSD"]
   对: 用 in 操作符或拆 OR

6. semver 字符串比较
   错: "4.9" >= "4.18" (字典序错)
   对: 采集端先解析成数值 (4.18.0 → 41800)

7. 区间反向
   错: ge 8 AND le 32 把"在区间内"当告警(应区间外才告警)
   对: 写成 lt 8 OR gt 32

8. 单位混用
   错: bytes ÷ MB 不换算
   对: compute 中显式换算 (X / 1048576) / Y_mb · 用 unit 字段标
```

### 10.4 蒸馏管线 · 流程图(下次照抄)

```
data/<engine>/rules.json  (LLM 一次性蒸馏 · 字段不规整)
         ↓
[Stage 1] 抽 op=custom 或描述性的规则 → rules-to-clean.json
         ↓
[Stage 2] OpenAI gpt-4o 结构化 (clean-rules-v2.ts)
   - 喂 source.quote 当锚(已审过的字面文字 · 黄金真理)
   - 喂 8 大 bug 防御提示
   - 喂 5 条 few-shot 示例(从 mongo passed 取)
         ↓
[Stage 3] 机器静态验证 (deterministic-validator.ts)
   - 拒: 逻辑矛盾 / 函数丢 / 字段无法 tokenize / 命令字符串
         ↓
[Stage 4] 跨模型 subagent QA (5-6 个并发 batch · Claude 评)
   - 6 项硬检查 · 任一不过 = needs_rework
   - 反馈带回 Stage 2 重洗 · 最多 3 轮
         ↓
[Stage 5] 真环境验证 (verify-real-env.ts)
   - SSH 连真 mongod · 抓 serverStatus/hostInfo
   - 字段路径真在 → pass
   - compute 跑得通 → pass
         ↓
3 关全过 → 写回 rules.json + rebuild sqlite
```

### 10.5 经验值 · 通过率参考

mongo 第一期实测:

| 阶段 | 通过率 | 备注 |
|---|---|---|
| OpenAI 自审通过 | 47% (166/291) | 不可信 · 有 36% 假阳性 |
| 跨模型 subagent 审通过 | 11% (33/291) | 真实可信度 |
| 推断真环境验证后 | 估计 8-10% (~30) | 字段虚构会再砍一批 |

**意味着**: 即使 mongo 蒸馏出 314 条 rules.json · ship 时实际能用 ~30 条。剩下 280+ 条要么需要重新蒸馏 · 要么本质不能结构化(描述性 / 不可观测) · 退场不丢人。

### 10.6 给下个数据库的 SOP

第 0 步 · **建真环境**(优先于一切): 拿一台测试机或本地 docker · 跑目标 DB · 拿到 serverStatus/全局变量/INFO/SHOW 命令的真实输出 · 落 fixture。**没真环境就没字段白名单 · 蒸馏必虚构**。

第 1 步 · 蒸馏 raw rules: WebFetch 官方文档 + OpenAI 抽规则 · 落 \`data/<engine>/rules.json\`。

第 2 步 · 审 URL+quote(本 spec § 7): 跑 audit-citations.ts · 保 100% 字面可验。

第 3 步 · 跑结构化管线(本 spec § 9.4): clean → 静态验 → subagent QA → 真环境 · 3 轮 retry。

第 4 步 · ship 通过的 + 退场过不去的: 退场用 `_runtime_excluded: true` 标记 · 留文件供 review · 不入 sqlite。

第 5 步 · CI 月度审(本 spec § 7.4): 防退化。

### 10.7 工具清单(可复用)

| 文件 | 跨数据库通用 | 需要按 engine 修改 |
|---|---|---|
| `tools/audit-citations.ts` | ✅ | — |
| `tools/clean-rules-v2.ts` | ✅ (system prompt 可微调) | system prompt 里举的 metric 路径 |
| `tools/qa-rules.ts` | ✅ | — |
| `tools/deterministic-validator.ts` | ✅ | — |
| `tools/orchestrate-rules.mjs` | ✅ | — |
| `tools/verify-real-env.ts` | ✅ (mongosh 部分换成 mysql/redis-cli) | DB 连接命令(mongosh → mysql -e / redis-cli) |
| `tools/build-rework-input.mjs` | ✅ | — |
| `skills/<engine>/src/rule-engine-v2.ts` | ✅ | — |

新数据库进来 · **改 SQL 客户端命令 + 跑流程** · 不用重发明轮子。

---

## 11 · 状态板 + 历史档案

> **接力起点 · 30 秒读完 § 11.0 即可**。§ 11.1-11.15 是详细历史档案 · 只在 § 11.0 不够用时查阅。

### 11.0 当前状态板 / 接力指南 (2026-04-26 17:00)

#### Skill 定位

**鲲鹏 + OS + 数据库(目前仅 mongo)三层联合性能诊断**。不是只 mongo 诊断 · 35 条鲲鹏 / ARM / openEuler / OS 层规则一直在 fire(§ 11.0 已做表第一行)。

#### 已做(按时间倒序)

| 模块 | commit | 状态 |
|---|---|---|
| 红线偏移盘点 + 收紧路径(extractive + 字面验) | `c68b122` `e82c341` | ✅ spec § 11.15 钉死 |
| Collector v2 双采样基建(t0/t1/sample_interval_sec) | `896c9ea` | ✅ |
| info+fire severity 保留(撤销强转 warning) | `3c1e54a` | ✅ |
| 撤掉阶段化字段(audit.phase1_pass 等)· 用 `_v2.checks + audit.pass` 联合判定 | `d396276` | ✅ |
| rule-engine v2 接进 cli-diagnose 主路径 · 5 条 mongo phase1 规则真 fire | `1a1dfdd` | ✅ |
| Phase 1 KB 三关审计 · 349 条全过 audit.pass(220 verified_literal + 129 verified_replaced)· 5 条入 _v2 | `5ecb528` | ✅ |
| 鲲鹏 / ARM / openEuler / OS CheckFn(35 条 TS 硬码) | (历史) | ✅ 一直 enabled=1 |
| Mongo CheckFn(15 条 TS 硬码) | (历史) | ✅ 一直 enabled=1 |

**当前 enabled=1 自动 fire 规则:55 条**(50 CheckFn + 5 v2)。其中 33 条是鲲鹏/OS/ARM/openEuler 层 · 17 条 mongo CheckFn · 5 条 mongo v2。

#### 待做(优先级降序)

##### P0 · 红线收紧 — Phase 2 前必做

**红线**: rules.json + sqlite **不存在 LLM 自由编造或改写的内容** · 用户必须字面溯源到原始文档。

**当前偏移 ~3228 处**(详 § 11.15):
- rules.json: `metric_expr` / `threshold` / `reason` / `recommend` / `fix` × 349 + `_v2.notes` / `_v2.structuring_confidence` × 5 = 1755 处
- sqlite knowledge: 1822 facts 里 1473 是 LLM paraphrase

**收紧路径**(唯一守红线方案 · 详 § 11.15):
- 字段值改造:`reason / recommend / fix / threshold` 从 string 改成 `{quote, source_url, verified}` 三元组
- cleaner v5 跑 349 条 extractive(只截字面 · 不许改写)+ audit-citations 同款字面验
- 删字段:`metric_expr` / `_v2.notes` / `_v2.structuring_confidence`(不参与运行时)
- 重建 sqlite `knowledge` 表 · 8 类 fact 重抽全 verified
- 报告 template fallback:字段未 verified 时显 `source.quote` 主引文

工作量:1-2 天 + LLM 费用。

##### P1 · Phase 2 主任务(红线收紧后)

| step | 内容 | 状态 |
|---|---|---|
| 1 | collector v2 双采样基建 | ✅ 已做(commit `896c9ea`)|
| 2 | rule-engine v3 加 `rate(metric, '5s')` + `baseline_*` + 单测 | ⏳ |
| 3 | cleaner v6 加 rate-aware prompt · 重洗 D 类规则(估 50 条) | ⏳ |
| 4 | 字段白名单加类型(int/string/boolean/ratio · § 11.10 #1) | ⏳ |
| 5 | 整合入库 + 测试 | ⏳ |

预期 enabled=1 fire 数:55 → 105。**鲲鹏 / OS 层 35 条 CheckFn 不动 · Phase 2 只重洗 mongo 层**。

##### P2 · 长期(Phase 3 / 4)

| 工程债 | 说明 |
|---|---|
| 重复规则系统去重 | subagent 揪出 4 对(§ 11.10 #2)· 按 source.url + reason TF-IDF 聚类 |
| rate-baseline 持久化层 | `~/.ohsql/perf-kp-sql/baselines/<host>.json`(§ 11.10 #3) |
| 退场规则显式 `_runtime_excluded` 字段 | 当前是隐式的(§ 11.12 #5) |
| 真实数据回放测试集 | 周期性拉真 mongo dump 跑回归 |

#### 当前阻塞

无 · 所有 P0 / P1 / P2 都待用户决策启动。

#### 接力清单(下个 agent 必读)

1. 读本节 § 11.0(就这一节够了)
2. 读 `CLAUDE.md`(项目规范 · skill 定位 · 命令 / 架构)
3. P0 / P1 启动前先跑 § 11.11 核对清单(vitest 126 / sqlite 5 表 / 真环境连通)
4. **不要**在 rules.json / sqlite 加阶段化标记(`phase1_pass` / `roundN_*`)— memory `feedback_no_phase_tagged_metadata.md`
5. **不要**让 LLM 干 abstractive(改写)· 只能 extractive(字面截取)— § 11.15 红线
6. **保护**鲲鹏 / OS 层规则 — Phase 2 重洗只针对 mongo · 不动鲲鹏 35 条 CheckFn

---

> **以下 § 11.1-11.15 是详细历史档案** · 接力时按需查阅 · § 11.0 已经覆盖核心信息。

### 11.1 Phase 1 目标 vs 实际

| 项 | 目标 | 实际 |
|---|---|---|
| 加 field 白名单 + cleaner v3 | ✓ | ✓ |
| 重洗 258 条 rework 规则 | ✓ | ✓ |
| 三关筛(静态 + 真环境 + 跨模型) | ✓ | ✓ |
| 期望: B 类 50-100 条入库 | 50-100 | **5 条** |

实际通过率远低于预期 · **不是管线坏 · 是当年蒸馏的 raw rules.json 字段定义太烂**。三关把所有字段虚构 / 单位错 / 方向反向的全筛掉了。

### 11.2 通过率瀑布

```
258 条 needs_rework 规则
  ↓ Cleaner v3 (gpt-4o · 字段白名单 2621 路径 · few-shot 3 条)
  144 条 confidence ≥ 0.7 · 109 条 LLM 弃疗(诚实 · 无法结构化)
  ↓ Gate 1 · 静态(deterministic-validator · 8 类 bug 检测)
  155/258 通过 (60%)  ← 静态扫不到方向反 / 字段虚构
  ↓ Gate 2 · 真环境(verify-real-env · 用 mongo 7.0.31 fixture)
  24/258 通过 (9.3%)  ← 字段路径 91% 虚构
  ↓ Gate 3 · 跨模型 subagent QA(Claude 跨 OpenAI 审)
  5/20 通过 (25%)    ← 又揪出 13 条方向反向 / 类型错 + 2 对重复

最终入库: 5 条 (1.9% 总通过率)
```

**额外**: 把 round 1 那 33 条 OpenAI+subagent 都过的也跑真环境 · **0/33 通过** · 全用了虚构字段。**round 1 的"通过"全是假阳性**。

### 11.3 5 条最终入库的规则(完整)

```jsonc
// 1. mongo-logging-accurate-timestamps
{
  "when": [],
  "checks": [
    { "metric": "getCmdLineOpts.parsed.systemLog.destination",
      "op": "eq", "value": "syslog", "unit": "string" }
  ]
}

// 2. mongo-config-journaling-enabled
{
  "when": [
    { "metric": "serverStatus.storageEngine.name",
      "op": "ne", "value": "inMemory", "unit": "string" }
  ],
  "checks": [
    { "metric": "serverStatus.storageEngine.persistent",
      "op": "eq", "value": false, "unit": "boolean" }
  ]
}

// 3. mongo-storage-concurrent-write-transactions-limit
{
  "when": [],
  "checks": [
    { "compute": "serverStatus.wiredTiger.concurrentTransactions.write.out / serverStatus.wiredTiger.concurrentTransactions.write.totalTickets",
      "op": "ge", "value": 0.9, "unit": "ratio" }
  ]
}

// 4. mongo-security-enable-authorization
{
  "when": [],
  "checks": [
    { "metric": "getCmdLineOpts.parsed.security.authorization",
      "op": "ne", "value": "enabled", "unit": "string" }
  ]
}

// 5. mongo-config-wt-cache-oversize
{
  "when": [],
  "checks": [
    { "compute": "serverStatus.wiredTiger.cache['maximum bytes configured'] / (hostInfo.system.memSizeMB * 1024 * 1024)",
      "op": "gt", "value": 0.5, "unit": "ratio" }
  ]
}
```

写在 `data/mongo/rules.json` 对应规则的 `_v2: { when, checks, structuring_confidence, notes }` 字段里 · 配合 `audit.pass=true` + `audit.last_audited=2026-04-26` 表达"已审计 + 已结构化"。**不**加 phaseX_* 这类阶段化字段(数据语言 ≠ 流程语言 · 阶段编号是 commit / changelog 的事)。

### 11.4 终态(运行时实际)

```
JSON 文件 (data/mongo + data/common):
  total:                     349
  audit.pass=true:           349 (100% URL/quote 验过 · § 7)
  _v2.checks 非空 + audit.pass=true: 5   (运行时入库的 v2 规则)
  _runtime_excluded:         0   (Phase 1 没退场 · 还在文件里供 Phase 2 复用)

sqlite (knowledge.sqlite):
  rules: any=51 + mongo=326 = 377 (CheckFn 50 + JSON 327)
  knowledge: mongo=2169
  flame_patterns: 9
  audit_citations 表: 不入(那是审计中间产物)

测试:
  vitest: 121 tests pass (含 22 条 rule-engine v2 测试)
  tsc: clean
  build: cpu-flamegraph 2 + oops-bench 3 + perf-kp-sql 4 scripts

Runtime auto-fire 总数:
  legacy CheckFn (TS): ~50
  rule-engine v2 (新): 5 (Phase 1) + 早期简单 op ~25
  ─────────────────
  合计: ~80
  
RAG 追问全 KB: 349 (零幻觉 · 含 quote+URL)
```

### 11.5 工具清单(Phase 1 用到的全部)

```
tools/audit-citations.ts          · § 7 用 · 验 URL+quote 字面
tools/clean-rules.ts              · § 9 round 1 cleaner (无白名单 · 已弃)
tools/clean-rules-v2.ts           · § 9 round 2 cleaner (无白名单 · 已弃)
tools/clean-rules-v3.ts           · § 11 Phase 1 用 · 加字段白名单约束 ⭐
tools/qa-rules.ts                 · OpenAI 自审打分(已知不可信)
tools/orchestrate-rules.mjs       · clean → QA → retry 三轮
tools/build-rework-input.mjs      · 拼 rework 输入(原 raw + subagent feedback)
tools/extract-field-whitelist.mjs · ⭐ 关键 · 从 fixture 展平字段路径
tools/triple-gate.ts              · ⭐ Phase 1 第二步 · 静态 + 真环境联检
tools/verify-real-env.ts          · ⭐ 字段路径在真 mongo 验
skills/perf-kp-sql/tools/deterministic-validator.ts  · ⭐ 8 类 bug 静态检测
skills/perf-kp-sql/src/rule-engine-v2.ts            · ⭐ when/compute/safe_divide/单位
skills/perf-kp-sql/tests/rule-engine-v2.test.ts     · 22 测试
scripts/apply-audit.mjs           · § 7 round 1 应用
scripts/apply-round2.mjs          · § 8.3 round 2 应用
scripts/apply-round3.mjs          · § 8 round 3 应用
scripts/apply-round4-cleanup.mjs  · § 8 删 AWS / 退场
scripts/apply-round5-aws-ec2.mjs  · § 8 删 AWS EC2
scripts/apply-cleaned-rules.mjs   · § 9 应用结构化规则
scripts/apply-phase1.mjs          · ⭐ Phase 1 应用 5 条
```

### 11.6 关键产物文件路径(给下个 agent 找东西)

```
reports/audit-citations-final-2026-04-26.md       · § 7 终报
reports/audit-citations-round2-2026-04-26.md       · § 8 round 2 终报
reports/cleanup/full-291-v2.json                  · § 9 round 1 orchestrate 产物(166 OpenAI pass)
reports/cleanup/subagent-qa/batch-{1-6}-result.json · § 9 subagent QA 6 batch
reports/cleanup/subagent-qa/_passed-rule-ids.json · 33 round 1 subagent passed
reports/cleanup/round2/rework-input.json          · § 11 round 2 待洗 258 条
reports/cleanup/round2/cleaned-v3.json            · § 11 cleaner v3 输出 ⭐
reports/cleanup/round2/field-whitelist.json       · § 11 字段白名单 · 2621 真路径 ⭐
reports/cleanup/round2/real-env-fixture.json      · § 11 真 mongo dump · 7.0.31 ⭐
reports/cleanup/round2/triple-gate-v3.json        · § 11 三关 verdict
reports/cleanup/round2/gate3-result.json          · § 11 subagent gate 3
reports/cleanup/round2/triple-gate-passed.json    · 20 条双关通过
.env.local                                         · API key + mongo 测试连接(GIT ignore)
skills/perf-kp-sql/data/knowledge.sqlite          · 部署目标 KB
skills/perf-kp-sql/data/mongo/rules.json          · 5 条带 _v2.checks · 联合 audit.pass=true 入库
skills/perf-kp-sql/data/common/kunpeng-rules.json · 鲲鹏通用规则
docs/specs/2026-04-25-perf-kp-sql-architecture.md · 本 spec
```

### 11.7 真 mongo 测试环境(Phase 2 还要用)

凭据存在 `.env.local`(gitignored · 不入仓):

```
MONGO_HOST          # 真机 IP
MONGO_SSH_USER      # SSH 登录用户
MONGO_SSH_PASSWORD  # SSH 密码
MONGO_SSH_PORT      # SSH 端口(通常 22)
MONGO_PORT          # mongod 端口(通常 27017)
MONGO_USER          # mongo admin 账号
MONGO_PASSWORD      # mongo admin 密码
MONGO_AUTH_DB       # 认证库(通常 admin)
```

环境信息(非凭据):
```
OS:     Huawei Cloud EulerOS 2.0 · aarch64 鲲鹏
mongo:  7.0.31
kernel: 5.10.0-182.0.0.95.r3184_259.hce2.aarch64
```

抓 fixture 的命令(从 .env.local 读凭据 · 不在脚本里写明文):
```bash
set -a; source .env.local; set +a
node skills/perf-kp-sql/scripts/ssh.mjs --op exec \
  --host "$MONGO_HOST" --user "$MONGO_SSH_USER" --password "$MONGO_SSH_PASSWORD" --port "${MONGO_SSH_PORT:-22}" \
  --command "mongosh --quiet --port ${MONGO_PORT:-27017} -u $MONGO_USER -p \"\$MONGO_PASSWORD\" --authenticationDatabase ${MONGO_AUTH_DB:-admin} \
             --eval 'EJSON.stringify({serverStatus: db.serverStatus(), hostInfo: db.hostInfo(), getCmdLineOpts: db.adminCommand({getCmdLineOpts:1})})'"
```
拆 stdout 取 JSON · 落 `reports/cleanup/round2/real-env-fixture.json`(115KB)。

### 11.8 完整复现命令(给下个 agent)

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
# (用 Claude subagent · 不用 OpenAI · 跨模型才有效)

# 4. 应用入库
node scripts/apply-phase1.mjs

# 5. 重建 sqlite
npx tsx skills/perf-kp-sql/tools/kb-build.ts --op build --force
node skills/perf-kp-sql/scripts/migrate-rules.mjs
node skills/perf-kp-sql/scripts/migrate-knowledge.mjs

# 6. 验证
npm run check && npx vitest run --reporter=basic && npm run build
```

### 11.9 Phase 2 入口(下次接力起点)

**目标**: 让"涉及 rate/baseline/window 的规则"也能 fire(从 80 → 130)。

**起点**: Phase 1 终态 · sqlite 干净 · 5 条 `_v2.checks` 非空 + audit.pass=true · 其余 252 条 audit 通过但未结构化(stale_v1)等价 retire · raw 文件全在。

**任务清单**:

1. **collector v2 双采样**
   - 改 `data/collect-cmds.json` 加 5s 间隔 second 次 mongosh dump
   - 解析两次 serverStatus · 算字段差值 / 时间窗 → rate metrics
   - 落 fixture: `real-env-fixture-2sample.json` (含 t0 / t1 / delta)

2. **rule-engine v3 加 rate / window**
   - 在 v2 evalCompute 基础上加 `rate(metric, '5s')` 函数
   - 实现: `(t1.metric - t0.metric) / 5`
   - 加 `baseline_*` 字段(从 ~/.ohsql/perf-kp-sql/baselines/<host>.json 读历史值)
   - 加 unit test 覆盖: 正常 rate / 0 division / 字段缺失

3. **重洗 D 类规则**
   - 筛 raw 含 `rate(`/`avg(`/`window(` 的规则(估 50 条)
   - 给 cleaner v4 加 rate-aware system prompt
   - 重新跑三关

4. **整合 + 入库**
   - 通过的规则把 `_v2.checks` 写入 rules.json(同 Phase 1 的载体)·
     `audit.pass=true` + `_v2.checks` 非空两条联合表达"运行时入库"
   - 不要加 `phaseN_*` 这类阶段化字段(数据是数据 · 流程是流程)
   - 重建 sqlite
   - 测试

5. **更新 spec § 11.10 Phase 2 完成报告**

**预期产出**: 约 50 条新增 v2 规则 · runtime fire 从 80 → 130(37%)。

### 11.10 已知工程债 / 给 Phase 2 的提醒

1. **field-whitelist 字段类型缺失**: 白名单只有路径 · 没有类型。subagent gate 3 揪到 `getCmdLineOpts.parsed.systemLog.destination le 2500`(string vs number)那种错。Phase 2 应在白名单加类型: `{path, type}` · static validator 检查 op 跟类型匹配。

2. **重复规则没系统去重**: subagent 揪出 4 对(authorization / profile-size / platforms / concurrency)。Phase 3 加 dedup 步骤 · 按 source.url + reason TF-IDF 聚类。

3. **rate-baseline 数据流缺失**: collector 当前只单采 · 没历史 baseline 持久化层。Phase 2 第 1 步必做。

4. **migrate-rules 老逻辑兼容旧 schema**: 它把规则按"CheckFn id 重叠"跳过 · 加 _runtime_excluded 过滤 · 但不识别 _v2 字段。Phase 2 应改 migrate-rules 优先用 _v2.checks 而不是顶层 metric_expr.

5. **rule-engine v1 (op=custom 跳过) 还在跑**: cli-diagnose 的 rule-engine 还是 v1 形式。Phase 1 没把 rule-engine v2 接到 cli-diagnose 主路径。Phase 2 必须接,否则 5 条新规则**实际还没真 fire**(这是个重要遗漏)。

### 11.11 Phase 1 给下个 agent 的核对清单

进 Phase 2 之前先核对:

- [ ] 跑 `npm run check && npx vitest run` 应该 121 tests pass
- [ ] 跑 `sqlite3 skills/perf-kp-sql/data/knowledge.sqlite ".tables"` 应该有 rules / knowledge / knowledge_fts / knowledge_vec / flame_patterns
- [ ] `node -e 'const r=require("./skills/perf-kp-sql/data/mongo/rules.json"); console.log(r.filter(x=>x._v2?.checks?.length>0&&x.audit?.pass).length)'` 应输出 5(运行时入库的 v2 规则数)
- [ ] `cat .env.local` 应该有 OPENAI_API_KEY + mongo 连接信息(权限 600)
- [ ] `ls reports/cleanup/round2/` 应该 14 个文件(真 fixture / 白名单 / 各阶段中间产物 / triple-gate / gate3)
- [ ] 真环境连得通: `node skills/perf-kp-sql/scripts/ssh.mjs --op exec --host "$MONGO_HOST" ...`(凭据从 .env.local 读)

不通过任何一项 → 先修再 Phase 2 · 别带病往下推。

### 11.12 Phase 2 不要再走的弯路

教训记下来:

1. **不要再让 OpenAI 自审定 verdict** · 跨模型审是底线
2. **不要 subagent batch 不带任务限制** · 上次 5 个并发被 rate-limit · Phase 2 一次起 4 个就够
3. **不要跑完整 cleanup 才验真环境** · 应该先抽 5-10 条 sample 跑全管线 · 看通过率合不合理再放大
4. **不要假设字段名直觉是对的** · LLM 凭直觉编 cpu_free / authFailedDelayMs 这种 · 必须查白名单
5. **不要把退场规则物理删** · 留 `_runtime_excluded` 给 review · 别消失

### 11.13 § 11.10 #5 工程债清账(2026-04-26 续)

> Phase 1 报告 § 11.10 第 5 条说:**rule-engine v2 没接 cli-diagnose 主路径 · 5 条规则没真 fire**。本节记 26 日下午把这条债清掉的全过程。

**问题再叙**:5 条规则虽 `_v2.checks` 写到了 `data/mongo/rules.json` · 但 `migrate-rules.mjs` 只把它们以 enabled=0 形式入 sqlite · cli-diagnose 的 runRuleEngine 又只过 v1 表达式(op=custom 直接 continue) · 链路最后一步断了。

**修复链路**(本次 commit `1a1dfdd`):

```
collector.ts (mongo)
  · mongosh JSON 加 hostInfo + getCmdLineOpts
  · parseDbBatch 把 serverStatus / hostInfo / getCmdLineOpts 三个 nested 对象
    显式挂到 db_metrics 上(以前只 flatten serverStatus 顶层)
        ↓
rule-engine.ts
  · 加 V2RuleRow / parseV2RuleRow / evaluateV2RulesAsCheckResults
  · evalRuleV2 的 EvalResult → CheckResult 桥接(finding/ok/skipped 三态)
        ↓
cli-diagnose.ts · runRuleEngine
  · PRAGMA table_info 检测 v2_checks 列
  · 拆 v1Rows / v2Rows · 各自走 collected Map / nested raw metrics
        ↓
migrate-rules.mjs
  · ALTER TABLE 加 v2_when / v2_checks / fix / fix_cost / source_quote 列(幂等)
  · 信号: `_v2.checks` 非空 + `audit.pass=true` → enabled=1 ·
          持久化 _v2.{when,checks} · 不用 phaseX_* 阶段化字段
```

**新测试**:`tests/phase1-rules-e2e.test.ts` 用 `execFileSync(diagnose.mjs, --os-file --db-file)` 跑两条 fixture:

```
bad fixture(故意配错):
  destination=syslog · persistent=false · write 0.95/1.0 ·
  authorization=disabled · cache_max=memSize → 5/5 全 fire
good fixture(干净):
  destination=file · persistent=true · write 0.05 ·
  authorization=enabled · cache_max=mem*0.25 → 5/5 全 ok
```

vitest 总数 121 → **123**(+2 e2e) · tsc clean · build OK。

**重建后实际 fire 数**:legacy CheckFn ~50 + 早期 v1 简单 op ~25 + Phase 1 v2 5 = **~80 真 fire**(终于和 § 11.4 的"~80 名义"对齐)。

**新工程债**(暂记 § 11.13.1 给下个 agent):

1. **info+fire 升级语义**:`finding()` 工厂只接受 `warning|critical` · 导致 `mongo-storage-concurrent-write-transactions-limit`(severity=info)在 fire 时被强转 warning。要么改 models.ts 的 `finding()` 放开 info · 要么桥接里走 `infoResult` 加 triggered_check。
2. **`tests/fixtures/` 的 OS fixture 较薄**:只够过 collector 的 DISCOVERY 段 · Phase 2 加 rate 字段后要补 fixture 维度。

**未变动**(给 § 11.10 其它 4 条工程债的提醒还在原位):字段白名单仍无类型 · 重复规则仍无系统去重 · rate-baseline 数据流仍未建 · migrate-rules 老 v1 路径还在跑(优先级:Phase 2 第一步 collector v2 再来收拾)。

**Phase 1 真正完工标志线**(三条都打勾才能进 Phase 2):

- [x] § 11.11 六项核对清单全过(本次 P1-2 任务)
- [x] § 11.10 #5 工程债清账(本节)
- [x] info+fire 语义修复(commit `3c1e54a` · `models.ts` 放开 `finding()` 接 info)

### 11.14 Phase 2 Step 1 完成 · collector v2 双采样基建(2026-04-26)

清账 § 11.9 Phase 2 任务 #1。

**改动**:
- `data/collect-cmds.json`(production 路径)+ `engines/mongo/collector.ts buildDbBatchCmd`(test 路径)同步:
  - `var t0_ss = db.serverStatus(); sleep(5000); var t1_ss = db.serverStatus();`
  - 输出 JSON 加 `t0_serverStatus` / `t1_serverStatus` / `sample_interval_sec: 5`
  - 主 `serverStatus` 仍指向 `t1_ss`(向后兼容现有规则)
- `parseDbBatch` 检测 `t0_serverStatus` / `t1_serverStatus` / `sample_interval_sec` 三字段 · 存在则透传到 `db_metrics` · 缺失(老 fixture)走老逻辑

**新单测**(126 tests pass · 原 123 + 3):
- `buildDbBatchCmd` 包含 `sleep(5000)` + t0/t1 字段 + `sample_interval_sec: 5`
- 双采样 stdout → `db_metrics.{t0_serverStatus,t1_serverStatus,sample_interval_sec}`
- 单采样 stdout(老 fixture)→ 三字段为 undefined · 不破坏向后兼容

**真环境验证**(凭据见 .env.local · mongo 7.0.31):
```
interval=5s
opcounters.insert   t0=2897470  t1=2897470  delta=0      (idle)
opcounters.command  t0=4354     t1=4359     delta=5      (1 op/s 内部心跳)
```
落盘 `reports/cleanup/round2/real-env-fixture-2sample.json`(343 KB · 342 行)。

**进 Phase 2 step 2 起点**:
- foundation 已就绪 · `db_metrics.t0_serverStatus / t1_serverStatus / sample_interval_sec` 三字段在 ctx 里
- 下一步:`rule-engine-v2.ts evalCompute` 加内置函数 `rate(metric, '5s')` 实现 `(t1.metric - t0.metric) / interval`
- 加单测覆盖:正常 rate / 0 division / 字段缺失 / interval 不匹配
- 然后才能跑 Phase 2 step 3 重洗 D 类规则(估 50 条 · cleaner v4 加 rate-aware prompt)

**Phase 2 余下任务**(尚未做):
- step 2: rule-engine v3 加 `rate(metric, '5s')` + `baseline_*` + 单测
- step 3: 重洗 D 类规则(raw 含 `rate(`/`avg(`/`window(` 的约 50 条)
- step 4: 整合入库 · 写 `_v2.checks` 到 rules.json(同 Phase 1 的载体 · 不加 phaseX 字段)
- step 5: 写 Phase 2 完成报告

预期 Phase 2 全做完: runtime fire 80 → 130(+62.5%)。

### 11.15 严肃性 / 红线 / 数据来源 三问 + 红线偏移盘点 (2026-04-26)

> 用户第二轮 review · 三个核心问题落 spec 防漂移。这一节是接力下个 agent 时**必读** —— § 12 一句话总结里的"零幻觉"承诺,真要兑现就靠这节里的红线。

#### Q1 · URL + quote 怎么验?

工具: `skills/perf-kp-sql/tools/audit-citations.ts`
流程: fetch URL → HTML 里搜 quote 字面串 → match 才算过
当前: rules.json 349 条全过 audit
- 220 条 `verified_literal`(URL + 原 quote 字面命中)
- 129 条 `verified_replaced`(URL 真 · 原 quote 不在该 URL · 已替换为该 URL 里实际能找到的等价字面)

重跑命令: `npx tsx skills/perf-kp-sql/tools/audit-citations.ts`(读 .env.local · 跑约 5 分钟 · 输出 `audit-citations-<timestamp>.json` · 文件已被 .gitignore 排除 · 不入库)

#### Q2 · enable=0 怎么启用 / 为什么不能?

启用条件 = 同时满足两条:
1. 规则有 `_v2.checks: {字段路径, op, 值, 单位}` 结构化形式
2. 字段路径在真 mongo / OS 采集里取得到值

344 条 enable=0 全部缺其一或两者:
- 大多缺 `_v2`(只有 `metric_expr` 自由文本字符串 · migrate-rules 转 sqlite 时设 `op="custom"` · evaluator 主动 `continue` 跳过 · 永不 fire)
- cleaner v3 给的 213 条 `_v2` 候选 · **89% (189 条)字段是 LLM 编**(`hostInfo.system.memLimitMB` 这种 · 真 mongo 字段叫 `memSizeMB`)· Gate 2 真环境闸把这些刷出生产数据(只在 reports/cleanup 留审计追溯)

启用路径 = 给每条手写或重蒸馏一个**字段真实存在**的 `_v2.checks` → 过 Gate 2(真环境)+ Gate 3(跨模型)。Phase 1 三关闸做的就是这个 · 258 原料只过 5 条。批量启用必须重做蒸馏 · Phase 2 工程量。

#### Q3 · 大模型有没有掺假 · 红线偏移盘点

**红线**: rules.json + sqlite 不存在 LLM 自由编造或改写的内容 · 任何字段必须用户可溯源到原始文档字面。

**rules.json 349 条字段评估**:

| 字段 | 来源 | 严肃度 | 红线偏移 |
|---|---|---|---|
| `source.url` | audit fetch 验 | ✅ 真存在 | 无 |
| `source.quote` | audit fetch + 字面搜命中 | ✅ verified_literal/verified_replaced 都是字面可信 | 无 |
| `source.title` | audit fetch 时同步抓 | ✅ | 无 |
| `audit.{status,pass,last_audited}` | 系统标 | ✅ | 无 |
| `_v2.checks` (5 条) | 三关验 | ✅ 字段真存在 / 方向对 / 类型对 | 无 |
| `_v2.when` (5 条) | 三关验 | ✅ | 无 |
| **`metric_expr`** (349) | LLM 蒸馏(91% 字段虚构) | ❌ **违红线** | op=custom 不参与 fire · 但仍在 JSON / sqlite 里 |
| **`threshold`** (349) | LLM 蒸馏自由文本 | ❌ **违红线** | 同上 |
| **`reason`** (349) | LLM paraphrase 自源文档 | ⚠️ **违红线** | 报告里展示 · 用户读到 |
| **`recommend`** (349) | LLM paraphrase | ⚠️ **违红线** | 同上 |
| **`fix`** (349) | LLM paraphrase | ⚠️ **违红线** | 同上 |
| **`_v2.notes`** (5) | LLM 写解释 | ⚠️ **违红线** | 不展示但在 JSON |
| **`_v2.structuring_confidence`** (5) | LLM 自评分 | ⚠️ **违红线** | 不展示但在 JSON |

**sqlite knowledge 表 1822 facts 评估**:

| fact_type | 数 | 严肃度 |
|---|---|---|
| `citation` | 349 | ✅ 字面可溯源(URL+quote 截片)|
| `threshold` / `summary` / `remediation` / `mechanism` / `trade_off` / `when_deviate` / `topic_answer` / `keywords` | **1473** | ❌ LLM paraphrase / 自由生成 |

**距离"红线 0 风险"的总偏移规模**:
- rules.json: **5 个 LLM 改写字段 × 349 条 ≈ 1745 处** + 5 条 _v2 各 2 个 LLM 字段 = 1755 处
- sqlite knowledge: **1473 facts** LLM 改写
- **总计 ~3228 处** LLM 自由生成内容仍在生产数据里

#### LLM 能做什么 / 不能做什么

红线"不存在 LLM 自由编造"的判定 · 关键不在字段名 · 在字段值的**生成方式**:

| 任务类型 | 例子 | LLM 能否守红线 |
|---|---|---|
| **抽取 (extractive)** | 从源文档 HTML 里**字面截取**最适合填进 `reason` / `recommend` / `fix` 的句子 | **能** · 配字面验后风险等同 audit-citations |
| **改写 (abstractive)** | 把源里的多句话 paraphrase 成一句更通顺 / 更圆滑 / 更通用的中文或英文 | **不能** · 必然有概率胡编 · 红线禁 |

Phase 1 当年错在让 LLM 干第二种(蒸馏 = 改写)· 留下了当前 ~3228 处偏移。修正 = 让它只干第一种(抽取)。

**reason / recommend / fix / threshold 字段本身没错** — 这是性能规则的天然三段式。错的是字段值是 LLM paraphrase 的字符串。

#### 收紧路径(唯一守红线的方案)

字段保留 · 字段值类型重塑:

```
当前(违红线 · LLM paraphrase 字符串):
  reason:    "Scanning MongoDB data and log paths adds I/O overhead..."
  recommend: "Configure your AV scanner..."
  fix:       "Add storage path to AV exclusions..."

改成(守红线 · 字面截取 + 字面验):
  reason: {
    quote:      "If you use an antivirus (AV) scanner..., configure 
                your scanner to exclude the database storage path...",
    source_url: "https://www.mongodb.com/docs/...",
    verified:   true   ← audit 工具 fetch URL 字面 search 命中才标
  }
  recommend: { quote: "...", source_url: "...", verified: true }
  fix:       { quote: "...", source_url: "...", verified: true }
```

实施步骤:
1. cleaner v5 prompt: 给 LLM 源 HTML · 让它从中**字面截取**填 reason/recommend/fix · 输出必须是源 HTML 的子字符串 · 不允许改写 / 添词 / 翻译
2. verifier: 拿每段 quote 在 source HTML 里字面 search · 命中才入库
3. 没命中或字段为 null 的 · 报告渲染 fallback 显示 source.quote 主引文
4. metric_expr / threshold 自由文本 · _v2.notes / _v2.structuring_confidence: 直接删除(不参与展示 · 也不参与 fire)
5. sqlite knowledge 表的 summary / threshold / remediation / mechanism / trade_off / when_deviate / topic_answer / keywords 八类 · 重新生成只从 reason/recommend/fix 抽 quote · 全部 verified

**LLM 在这个流程里没有自由生成空间** · 只做 extractive 选取。

工作量: 1-2 天 + LLM 费用(349 条 × cleaner v5 抽取 + 字面验)。规则数 349 不变。

#### 备选: 标 _paraphrase(不推荐)

字段加 `_paraphrase: true` · 报告 UI 区分"原文 vs 改写"块。1-2 天。**不算守红线** · 因为 LLM 改写仍在数据库里 · 用户读报告时仍可能被改写误导 — 只是显式承认了。除非用户接受"红线退一步" · 否则不应选这条路。

#### 当前默认现状(违红线)

不做任何收紧 = LLM paraphrase 仍在 JSON / sqlite 里 · 用户读报告时无法区分哪句是源文哪句是 LLM 改写。**不符合红线** · spec 这一节会一直提醒偏移 ~3228 处。

#### 决议

进 Phase 2 之前必须执行收紧路径(extractive + 字面验)· 否则一直顶着红线赤字。备选(_paraphrase 标)只在用户明确接受退步时启用。撤回 § 11.15 早先版本的"删字段(原 A 选项)"提议 — 那是矫枉过正 · 字段结构没错 · 错的是字段值的来源。

### 11.16 P0 红线收紧完工档案 (2026-04-26)

> § 11.15 决议执行完毕 · 红线偏移从 ~3228 处降到 < 20 处(残留 PDF / 边缘 normalize 差异 · 非 LLM paraphrase) · 所有用户可见 rationale / recommendations 字面来自源 HTML。

#### 战果数据

| 指标 | 收紧前 | 收紧后 |
|---|---|---|
| KB facts(LLM paraphrase + 字面字段) | 2169 (含 1473 paraphrase) | **1521** (字面命中率 99.4%) |
| rules.json 体积 | 385 KB | **174 KB**(瘦 55%) |
| rules.json paraphrase 字段 | reason / recommend / fix / threshold / metric_expr / _v2.notes / _v2.structuring_confidence | **全部删除** |
| sqlite rules 表 description / recommendations / fix | LLM paraphrase 字符串 | **NULL**(运行时从 KB 取) |
| 真机 fire 规则 rationale 来源 | CheckFn 硬码 + rules.json paraphrase | **6/8 从 KB 字面取 · 0 paraphrase** |
| 红线偏移总数 | ~3228 | **< 20**(全是 PDF 解析边缘) |

#### 5 步路径(每步都过真机闸)

1. **cleaner v5 extractive(`tools/clean-rules-v5.ts`)** - LLM 只字面截取源 HTML 子串 · 不许改写/添词/翻译 · 全量 349 条 → 1399 verified facts
2. **字面验(`audit-citations.ts --extractive-input`)** - substring 命中源 HTML 才 verified=true · 459 条改写被红线挡下不入库
3. **rules.json 瘦身(`scripts/slim-rules-json.mjs`)** - 删 7 个 paraphrase 字段 · 留 source / _v2.checks / audit
4. **KB 重建(`kb-build.ts --op rebuild-from-verified --html-cache`)** - 加 seed_quote 字面验(180 条 partial 60% 匹配的 seed 被拒) · 1521 facts 落库
5. **kb-enrich(`src/kb-enrich.ts`)** - cli-diagnose 跑完按 rule_id join KB · KB 优先(覆盖 CheckFn 自带 paraphrase) · rationale 4 字段 + recommendations 全部从 KB 字面取

#### 工具整改

- **删 8 个**(paraphrase 时代遗物): `clean-rules.ts` / `clean-rules-v2.ts` / `clean-rules-v3.ts` / `qa-rules.ts` / `orchestrate-rules.mjs` / `build-rework-input.mjs` / `verify-extractive.ts` / `rebuild-kb-from-verified.ts`(后两个误新写的)
- **合并 2 个**: 字面验进 `audit-citations.ts --extractive-input` · 重建进 `kb-build.ts --op rebuild-from-verified`
- **新增 1 个**: `tools/clean-rules-v5.ts`(extractive 唯一新方向 · 跟 v1-v3 反向不能合并)
- **改 1 个 src**: `src/kb-enrich.ts`(诊断后 KB 注入)

#### 结构性约束(给后续 agent · 不要踩坑)

- **判定层 vs 叙事层分离**:
  - 判定层(什么条件成立): TS CheckFn(50 条 · 复杂逻辑/字符串解析) + sqlite v2_checks(5 条 · 简单字段对比 · 数据驱动)
  - 叙事层(为什么 + 怎么修 + 出处): **唯一来源 = sqlite knowledge 表 + verified facts**
  - **CheckFn 自带的 reason / recommendations / rationale 字符串** 是 paraphrase 工程债 · KB 优先策略已让它们成为 fallback · 长期目标:50 条 CheckFn 全部 finding() 不传字符串字段
- **能用 v2_checks 表达的禁止写 TS CheckFn**(避免心智冗余 · 同一规则只在一处)
- **seed_quote 兜底必须字面验**(`kb-build.ts --html-cache` 已实装) · 否则会让 partial 60% 匹配的旧 quote 重新污染 KB

#### 接力 SOP(下个 agent 必读)

1. 现状: KB 1521 facts · 字面命中率 99.4% · 55 enabled=1 规则 · 真机回放 8/8 fire 规则 OK
2. § 11.16 / § 11.17 是 P0 完工档案 · § 11.15 是问题诊断 · § 11.14 是 collector v2 step 1
3. 进 Phase 2 step 3(D 类规则结构化重洗)前先跑回归: `npm run check && npx vitest run && npm run build` 应 148 tests pass
4. 任何新加的 fact 必须过 `audit-citations.ts --extractive-input` 字面验才入 KB
5. 任何 CheckFn 改造禁止新加 paraphrase 字符串字段 · 留 finding({...}) 不带 reason/recommendations 让 enrichResultsFromKb 注入

### 11.17 Phase 2 step 1+2 完工档案 (2026-04-26)

#### step 1 · collector v2 双采样基建(commit `896c9ea`)
已记录在 § 11.14。提供 `t0_serverStatus / t1_serverStatus / sample_interval_sec` 在 ctx.db_metrics 中。

#### step 2 · rate() / baseline() 内置函数

**新增**:
- `src/rule-engine-v2.ts` 加 string literal token + str AST node + `evalRate` / `evalBaseline` 两个 special-case fn
- `src/baseline-store.ts` 持久化层(`~/.ohsql/perf-kp-sql/baselines/<hostname>.json` · 显式快照模式 · 不污染历史)
- `cli-diagnose.ts` 加 `--save-baseline` flag · 启动时自动 load baseline 注入 ctx
- `tests/baseline-store.test.ts` 10 单测 + `rule-engine-v2.test.ts` 加 12 单测(原 22 → 34)

**rate() 用法**:
```
rate(serverStatus.extra_info.page_faults, '5s')
  → (t1_serverStatus.x.y - t0_serverStatus.x.y) / sample_interval_sec
  → 实际除数用 metrics.sample_interval_sec(避免规则写死 5s 但 collector 改 10s 后规则全 error)
```

**baseline() 用法**:
```
serverStatus.connections.current / baseline(serverStatus.connections.current)
  → 当前值 / ~/.ohsql/perf-kp-sql/baselines/<hostname>.json 里的值
  → 文件不存在 / 字段不存在 → 抛错 · check 状态变 error · 报告显示
```

**保存基线**: `node diagnose.mjs --os-file ... --db-file ... --save-baseline`

#### Phase 2 余下任务

- **step 3** (cleaner v5 加 rate-aware structuring prompt + 重洗 D 类约 30 条 raw rules) - 实测 raw 含 rate(/avg(/window( 关键词的规则 30 条 · 真正能用 rate/baseline 表达的估 ~10 条 · 通过率参考 Phase 1 = ~3-5 条新 fire 入库
- **step 4** (字段白名单加类型) - 已生成 `reports/cleanup/round2/field-whitelist-typed.json` (19341 个 typed paths · int/string/boolean/array/object) · 等 step 3 cleaner 启动时消费
- **step 5** (整合入库 + 真机端到端 + 回归)

预期 Phase 2 全做完: runtime fire 55 → ~65 (+18%)

### 11.18 工程债状态(已部分清账)

- ✅ § 11.10 #5 (rule-engine v2 接 cli-diagnose 主路径) - 11.13 清账
- ✅ § 11.13.1 #1 (info+fire 升级语义) - 已修
- ✅ § 11.10 #1 (字段白名单加类型) - § 11.17 step 4 已生成 typed JSON
- ✅ § 11.12 #5 (退场规则显式 _runtime_excluded) - 已显式标 344 条 · migrate-rules 跳过
- ⏳ § 11.10 #2 (重复规则 TF-IDF 去重) - 4 对待清
- ⏳ § 11.13.1 #2 (OS fixture 加 rate 字段后维度补) - Phase 2 step 3 启动后做
- ✅ Phase 3 · CheckFn 字符串移交 KB(用户体验层) - § 11.19 已闭环

### 11.19 v1.0 红线最终闸 · 报告字面 100% 命中(2026-04-26 晚)

> 用户验证发现 PR #5 部署到 plugin 仓后报告 footer 的 [参考1] URL 跟"建议第一步"字面**对不上**(角注 hikunpeng URL · 但 "echo never" 字面来自 mongo docs)。这是 P0 红线没堵到 footer 这一层的漏洞。

#### 漏洞根因

P0 § 11.16 只让 KB enrich 注入 `rationale` 4 字段 · footer 渲染主要展示的 `summary / threshold_display / recommendations[].action / citations[].url` 仍来自 CheckFn TS 硬码:
- CheckFn 当年硬码的 `citations[]` 跟 `recommendations[]` 当年 LLM 拍脑袋写的,**没绑定**: action 字面来自 mongo docs 但 citations[0].url 写的是 hikunpeng 综合调优页
- 用户照角注去找 → 必然搜不到

#### 修复(本节)

**1. models.ts schema 字段可选化**
- `finding/okResult/infoResult` 的 summary/title/description/reason/recommendations/citations/threshold_display 全部改成 optional
- 默认空字符串 / 空数组 · 不传也合法
- 保留必传: id / severity / bucket / scope / evidence / impact (诊断结果 · 不属 paraphrase)

**2. kb-enrich.ts KB 强覆盖(无 fallback CheckFn 字符串)**
- summary / description / reason: 全部 KB summary/mechanism fact 字面注入
- recommendations[]: 每条 = KB 一条 remediation fact · `action=quote` + `fix_url=该 fact 的 source_url`(角注绑定)
- citations[]: KB 各 fact distinct source_url · `anchor=quote 前 80 字`
- threshold_display: KB threshold fact 字面
- rationale 4 字段: KB summary/mechanism/trade_off/when_deviate 字面
- KB 没 fact 时字段留空 · **严禁 fallback CheckFn 字符串**(用户读报告时看到"未抽到字面建议",可接受;胡编一定不行)

**3. KB 数据清理 · attribution 错误 fact 删除**
- 之前 1604 条 facts 里有 31 条"source_url 跟 quote 不对应"(典型: source_url=Red Hat NUMA PDF · quote 是 hikunpeng 中文模板)
- 跑 KB 全表字面验 → 删除 attribution 错误的 31 条 → 1573 条全部 100% 字面命中
- 代价: 3 条 fire 规则(`os.vm.dirty_ratio` / `os.vm.max_map_count` / `kunpeng.net.tcp_keepalive_time_strict`)的 KB facts 被删空 → 报告里"建议块"留"未抽到字面建议"(诚实降级)

**4. 验证脚本 audit-report-grounding.mjs(新增)**
- 跑 cli-diagnose.mjs 拿 diag.json
- 对每条 fire 规则: summary / recommendations[].action / threshold_display / rationale 4 字段 在 citations[].url 集合里**任一字面命中**才 pass
- 失败 → exit 1 + 列出 MISS 详情

**5. 真机验收(124.70.180.36 · mongo 7.0.31)**

```
# pass rate(排 no-cache): 100%
total checks: 34 · ✅ 命中: 34 · ❌ MISS: 0 · ⚠️  no cache: 0
```

8 条 fire 规则(1 critical + 7 warning)的报告字面 + 角注 URL 100% 字面命中源文档。

#### CheckFn KB 覆盖率

补抽缺失 CheckFn 后 41/50 = 82%(剩 9 条 source URL 在 TS 里 grep 不到 / cleaner v5 抽不出 verified · 这 9 条 fire 时报告会"未抽到字面建议"降级)。

#### 与 plugin 仓的同步(PR #5 amend)

ohsql-plugin 仓 `feat/p0-redline-tightening-phase2` 分支同步 P0+§ 11.19 改动:
- src/{cli-diagnose, cli-kb, models, report, ...}.ts (与 skillhub 037ef7f 保持一致)
- src/{baseline-store, kb-enrich, rule-engine-v2}.ts(KB 强覆盖版)
- data/knowledge.sqlite(1573 verified facts)
- data/{mongo,common}/rules.json(瘦身 + dedup + _runtime_excluded 标记)
- scripts/{diagnose,kb,history,ssh}.mjs (新 esbuild bundle)
- tools/{audit-citations,clean-rules-v5,verify-real-env,...}(extractive 流水线)
- 不动 plugin v0.6/v0.7/v1.1 已有改动(Anthropic Skills 标准化 / Codex CLI / PAM auth / front-load env probing)

#### 待留工程债

1. KB 9 条 CheckFn 没 verified facts(主要是 hikunpeng PDF / 本地 ts 没 grep 到 url)· 这些 fire 时报告"未抽到字面建议"
2. 3 条 fire 规则因 attribution 删除丢 KB facts(`os.vm.dirty_ratio` / `os.vm.max_map_count` / `kunpeng.net.tcp_keepalive_time_strict`)· 跑专项 cleaner v5 重抽这 3 条的 source URL 即可补回

---

## 12 · 一句话总结

**判断在规则 · 证据在 KB · 排序靠分数 · LLM 只搬运 · KB 自己定期审** —— 五件事加一起，"鲲鹏 + MongoDB · 零幻觉 + 准确"才算真兑现。
