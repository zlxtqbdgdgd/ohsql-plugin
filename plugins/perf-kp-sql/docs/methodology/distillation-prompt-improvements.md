# perf-kp-sql · 蒸馏 prompt 改进建议清单

> 给下一轮蒸馏者(LLM 操作员或团队同事)的"该怎么改 prompt"清单 ·
> 基于 Day 1+2 自动体检发现的 6 类系统性问题。
>
> 体检材料路径:`plugins/perf-kp-sql/data/quality-reports/`
>
> 配套阅读:`docs/methodology/llm-boundaries.md`(LLM 分工边界) ·
> `docs/methodology/depth-control.md`(深度控制) ·
> `~/Documents/蒸馏工程/蒸馏工程综述.md`(理论母本 §5 总结去重 + §6 验证)。

---

## 1 · 引言:为什么需要这份清单

### 1.1 当前案例库怎么来的

`scripts/_build-cases-from-xlsx.mjs` 把蒸馏者(LLM)产出的 xlsx 转成 markdown ·
落到 `data/diagnostic-flow/CASES.md` / `data/best-practice/CASES.md` /
`data/flame-signature/CASES.md` 三个库 · 共 202 case(96 DF + 93 BP + 13 Flame)。

**蒸馏 prompt 是上游**;xlsx schema 是中游;markdown 案例库是下游。下游问题
绝大多数源于 prompt 不够紧 — 改下游字段是补丁式 fix · 改 prompt 才是
整段对齐。

### 1.2 Day 1+2 体检发现的 6 类系统性问题

| 问题 | 证据 | 出处 |
|---|---|---|
| **A · 阈值定性化** | rigor 6.33 最弱(4 维度最低) · 大量"持续较高 / 显著上升" | `a4-threshold-rationality.json` summary.by_dimension |
| **B · BP 配置型源缺 quote** | 5 个 5 分 BP wt-* case 全是 dev.to · 4 个缺 scenario_description_quote / recommendation_quote | `a6-quality-scorecard.json` score_distribution + `field-integrity-report.json` warn_only_cases |
| **C · adaptability 维度偏低** | adaptability 6.03 偏低 · 5 个 < 5 分 case 中 4 个 adaptability ≤ 4 · 单一推荐值不分机型 / workload | `a4` known_limitations[3] + summary.low_score_cases_count |
| **D · clarity 中英文混杂 + 长括号** | clarity 6.83 维度最低 · 16 对 clarify_distinction 主题接近但描述不清 | `a6` by_dimension_avg.clarity + `orthogonality-fine-judgment.json` by_action.clarify_distinction |
| **E · 真重复 + DF/BP 镜像未标注** | 2 对 duplicate(merge_into_one) · 47 对 df_bp_mirror 隐式存在但无字段 | `orthogonality-fine-judgment.json` by_relation.duplicate / df_bp_mirror |
| **F · 跨语言 quote 比对粗糙** | a3 LLM-as-Judge 75% 集中满分(评分尺度太粗) · 中文 case 引英文 source 时缺 quote_language 标识 | `a3-citation-alignment.json` drift_distribution.none=173/191 |

下文 §2 给 6 大改进项 · 每项含体检证据 + 改进描述 + prompt 修订示例 +
验收标准。§3 给优先级。§4 对接综述方法论。

---

## 2 · 6 大改进项

### A · 数值化阈值约束(对应 a4 rigor 6.33 短板)

#### A.1 体检证据

- `a4-threshold-rationality.json` summary.by_dimension.rigor = **6.33** · 4 维度
  最低
- low_score_cases 5 个全部 rigor ≤ 6 · rationale 出现"减幅未明示" /
  "缺具体阈值百分比" / "数值具体但单位省略"
- `field-integrity-report.json` warn_only:3 个 BP case `recommendation_value`
  字段缺失(`mongo-txn-long-running-wt-cache-pressure` / `mongo-read-concern-linearizable-maxtimems`/
  `linux-block-journal-separate-volume-mongodb-01`)

#### A.2 改进描述

蒸馏 prompt 必须强制 `abnormal_pattern_threshold` 字段格式:

```
<metric_name> <比较符> <数值> <单位>
```

- 比较符:`>=` / `<=` / `>` / `<` / `==` / `between A and B`
- 单位:必填(`%` / `ms` / `μs` / `ops/s` / `MB/s` / `count` 等)
- **禁用定性表达**:`持续较高` / `显著上升` / `频繁` / `偶发`

无可量化阈值的描述性 case(如"出现某关键字 in /proc/cmdline")· 显式标
`threshold_type: descriptive` + 给出布尔判定式(如
`/proc/cmdline contains "nohz=off"`) · **不留 NULL**。

#### A.3 prompt 修订示例

**改前 prompt 段(假设 · 仿照当前蒸馏话术)**:

```
请抽取该 case 的异常阈值,字段 abnormal_pattern_threshold。
描述要清晰、能让运维识别异常。
```

**改后 prompt 段**:

```
请抽取该 case 的异常阈值,字段 abnormal_pattern_threshold。
强制格式:<metric_name> <比较符> <数值> <单位>

✓ 合格示例:
  - cache_used >= 95%
  - latency_p95_ms > 100
  - dirty_target between 5% and 18%
  - dTLB_miss_rate > 1%

✗ 不合格示例(必须返工):
  - "cache 使用率持续较高"      → 没有具体百分比
  - "延迟偶发上升"                → 没有 metric / 阈值 / 单位
  - "TLB miss 频繁"               → 没有比较符 + 数值

如果 source 原文确实没给具体数值 · 你必须:
  1. 优先在原文里搜"%/ms/μs/ops/s/MB/s/次"附近的数字 · 引出来
  2. 搜不到时才设 threshold_type: descriptive · 并给布尔判定式
     例:"/proc/cmdline contains 'nohz=off'" · "mount options 不含 noatime"
  3. 绝不允许 abnormal_pattern_threshold = null · 也不允许定性表达

请输出 JSON 时显式带 threshold_type 字段(quantitative | descriptive)
让下游能区分两类 case。
```

#### A.4 验收标准

下一轮蒸馏后跑 a4 v2 · 应满足:

- `rigor` 维度均值 ≥ **7.5**(从 6.33 → 7.5)
- `applicable` case 中 `threshold_type` NULL 比例 = **0**
- low_score_cases(score_overall < 6) 数量从 5 → ≤ 2

---

### B · 多维度 quote 强制(对应 a6 BP wt-* 缺 quote)

#### B.1 体检证据

- `a6-quality-scorecard.json` score_distribution:5 个 5 分 case 全部是
  `wt-journal-commit-interval-high-throughput-01` / `wt-journal-disable-non-critical-max-write-01` /
  `wt-block-compressor-none-max-write-speed-01` / `wt-directory-per-db-separate-volumes-01` ·
  source 均为 `https://dev.to/devaaai/...`
- `field-integrity-report.json` warn_missing:4 个上述 case 缺
  `section:scenario_description_quote` + `section:recommendation_quote`
- 共性:dev.to 那篇博文是**参数清单风格**(只列"key = value")· 没有可抽
  的叙述句

#### B.2 改进描述

蒸馏 prompt 应**先识别 source 类型** · 再分发不同抽取策略:

| source 类型 | 识别特征 | 蒸馏动作 |
|---|---|---|
| **叙述型** | 有完整中英文段落 · 解释参数原理 / 故障机制 · 例:`docs.mongodb.com` / `cnblogs` / `huawei.com 博客` | **抽 quote**:`scenario_description_quote` / `recommendation_quote` 必须 verbatim |
| **配置型** | 参数清单 / gist / 表格 · 仅列 key=value 没有原理叙述 · 例:`dev.to` 配置清单 / GitHub gist | **生成中文 narrative**:不抽 quote · 由 LLM 基于参数语义 + 训练知识生成 1-2 句 `scenario_description_zh` + `recommendation_zh` · `inferred_fields` 字段显式标注 |

#### B.3 分发逻辑伪代码

```
// 蒸馏前置 · LLM 自评 source 类型
function classifySource(sourceUrl, sourceContent):
  // 配置型特征(任一命中 → narrative_only)
  if sourceContent matches /^\s*[\w.]+\s*=\s*\S+/m  // key=value 行 ≥ 5
     and avg_paragraph_length(sourceContent) < 80 chars:
    return "config-list"
  if sourceUrl 匹配 /dev\.to|github\.com\/.+\/gist|gist\.github\.com/:
    return "config-list"  // 默认按配置型处理 · LLM 仍需 sanity check
  return "narrative"

// 分发抽取
if classifySource() == "narrative":
  emit_field("scenario_description_quote", extract_verbatim_paragraph(...))
  emit_field("recommendation_quote", extract_verbatim_recommendation(...))
  emit_field("inferred_fields", [])    // 都来自原文 · 不算推断
else:  // config-list
  emit_field("scenario_description_zh", llm_generate_narrative(param_name, param_value, llm_training_knowledge))
  emit_field("recommendation_zh", llm_generate_recommendation(param_name, param_value))
  emit_field("inferred_fields", ["scenario_description_zh", "recommendation_zh"])
  // 注:这条规则下 quote 字段不存在 · field-integrity 检查应放过
```

#### B.4 prompt 修订示例

**改前 prompt 段**:

```
对每个 BP case · 抽取 scenario_description_quote 和 recommendation_quote。
quote 必须是原文 verbatim。
```

**改后 prompt 段**:

```
对每个 BP case · 先判断 source 类型:

(1) 配置型(key=value 清单 / gist / dev.to 那种参数表)
    → 不要抽 quote
    → 由你基于参数语义 + 训练知识 · 生成中文 narrative:
      - scenario_description_zh: 1 句话说"什么场景下需要这个参数"
      - recommendation_zh: 1 句话说"具体怎么改 + 风险"
    → inferred_fields 列出生成出来的字段名

(2) 叙述型(完整段落解释原理 · docs.mongodb.com / cnblogs / hikunpeng)
    → 抽 quote(verbatim)
    → scenario_description_quote: 1 段原文(背景 / 适用场景)
    → recommendation_quote: 1 段原文(具体配置 + 推荐值)
    → inferred_fields 留空

输出 JSON 必须显式带 source_type 字段(config-list | narrative)。

# field-integrity 适配:
# config-list 类型的 BP case 不应被判定为缺 quote;
# warn_missing 检查需放过 source_type=config-list 的 case。
```

#### B.5 验收标准

下一轮蒸馏后:

- 5 个 5 分 dev.to 系列 case 重蒸馏 · `source_type=config-list` ·
  a6 score_overall 应 ≥ **7.0**(从 5.2-5.3 升)
- `field-integrity-report.json` warn_missing 数从 11 → ≤ **3**(只剩
  recommendation_value 缺失类 · 不再有 quote 类)
- a6 by_entry_kind.best-practice.completeness 从 6.18 → **≥ 7.0**

---

### C · adaptability 字段补充(对应 a4 adaptability 6.03)

#### C.1 体检证据

- `a4-threshold-rationality.json` summary.by_dimension.adaptability = **6.03** ·
  4 维度第二低
- `known_limitations[3]`:5 个 < 5 分 case 中 4 个 adaptability ≤ 4 · 反映
  "单一推荐值 · 缺机型 / workload 维度调整说明"
- 例:`linux-block-read-ahead-kb-sequential-io-4096-01`(BP A 大顺序读 4096KB)
  vs `linux-block-readahead-8-to-32-wt-12`(BP B WT 引擎 8-32 sectors)·
  同参数 read_ahead_kb 取值矛盾 — 两个 case 没有任何 workload 字段标
  注差异

#### C.2 改进描述

每条 case 加可选字段 `adaptability_notes`(JSON 对象):

```json
{
  "applicable_arch": ["arm64", "x86_64"],
  "applicable_workload": ["read-heavy", "write-heavy", "mixed", "oltp", "olap"],
  "applicable_deployment": ["bare", "container", "kvm", "atlas"],
  "version_range": "5.0-7.x",
  "exclusions": "NVMe SSD 例外 · 取值改为 noop"
}
```

字段全可选 · 但**至少要给一个维度**。完全通用的 case 显式标
`adaptability_notes: { "type": "universal" }` · 不留 NULL。

#### C.3 prompt 修订示例

**改前 prompt 段**:

```
对每个 case · 抽取 recommendation_value。
推荐值要清晰、有依据。
```

**改后 prompt 段**:

```
对每个 case · 抽取 recommendation_value 同时 · 必须给 adaptability_notes。

adaptability_notes 是 JSON 对象 · 至少给一个维度:

{
  "applicable_arch": ["arm64", "x86_64"],          // CPU 架构
  "applicable_workload": ["read-heavy", "write-heavy", "mixed"],  // 负载类型
  "applicable_deployment": ["bare", "container", "kvm"],          // 部署形态
  "version_range": "5.0-7.x",                                     // 软件版本
  "exclusions": "NVMe SSD 改用 noop"                              // 例外条件
}

# 来源证据
adaptability_notes 的每个条目都要有 source 依据(可来自:source 原文 /
官方兼容矩阵 / 同 source 上下文段落) · 不许凭训练数据补。

# 通用 case
如果 source 明确说"all workloads / all archs / 任何 MongoDB 版本" ·
设 adaptability_notes = { "type": "universal" } · 不留 NULL。

# 反例(必须返工)
- read_ahead_kb=4096 case 不写 workload → 与 read_ahead_kb=8-32 case
  矛盾时无法区分 · 这是当前案例库已有的真问题(case_a:linux-block-
  read-ahead-kb-sequential-io-4096-01 · case_b:linux-block-readahead-
  8-to-32-wt-12 · 见 orthogonality fine pair_index 34)
```

#### C.4 验收标准

下一轮蒸馏后:

- `adaptability` 维度均值从 6.03 → **≥ 7.5**
- `adaptability_notes` NULL 比例 = **0**(全部至少有 universal 标注或
  一个维度)
- 16 对 clarify_distinction 中至少 8 对(workload / arch / version 维度
  能区分的)消失

---

### D · clarity 改进(对应 a6 clarity 6.83 + 16 对 clarify)

#### D.1 体检证据

- `a6-quality-scorecard.json` summary.by_dimension_avg.clarity = **6.83** ·
  5 维度最低
- `orthogonality-fine-judgment.json` by_action.clarify_distinction = **16**
  对(主题接近但描述不清晰)
- 典型病灶:title 长 + 中英文混杂 + 长括号子句拉低分

#### D.2 改进描述

##### D.2.1 title 长度限制

| 语言 | 字数上限 | 不允许 |
|---|---|---|
| 中文 title | < 15 字 | 长括号子句(用主标题 + 副标题代替) |
| 英文 title | < 30 字符 | 嵌套括号 |
| 中英混杂 | 技术术语英文(`WiredTiger` / `TLB`) · 普通词中文 | "持续 / 显著 / 频繁" 等定性词 |

##### D.2.2 主题相近 case 加 `distinguishes_from` 字段

格式:

```json
{
  "case_id": "linux-vm-dirty-ratio-pause-on-large-memory-01",
  "diff_summary": "本 case 关注大内存机器(≥ 256GB)dirty_ratio 默认值过高;那个聚焦泛通用脏页突发,无内存大小限定"
}
```

##### D.2.3 16 对 clarify_distinction 的 distinguishes_from 字段建议

| pair | case_a | case_b | 建议 distinguishes_from(给 case_a) |
|---|---|---|---|
| 6 | `kunpeng-thread-concurrency-overload-05` | `app-thread-concurrency-mismatch-01` | "本 case 鲲鹏专用 · 那个通用应用层" |
| 9 | `linux-vm-dirty-flush-burst-io-wait-01` | `linux-vm-dirty-ratio-pause-on-large-memory-01` | "本 case 泛述脏页刷盘 · 那个限定大内存场景(≥ 256GB)" |
| 12 | `mongo-fs-mount-noatime-nobarrier-missing-01` | `linux-fs-mount-nobarrier-audit-01` | "本 case 同时检 noatime + nobarrier · 那个仅 nobarrier" |
| 20 | `os-blockdev-scheduler-not-deadline-mysql-db-01` | `linux-sched-mq-deadline-for-spinning-disk-10` | "本 BP 数据库通用(NVMe 除外) · 那个限定物理盘 + 转盘" |
| 28 | `kunpeng-numa-cross-node-memory-access-01` | `mongo-numa-cross-node-memory-degradation-04` | "本 case 鲲鹏通用应用 · 那个 MongoDB 特化" |
| 34 | `linux-block-read-ahead-kb-sequential-io-4096-01` | `linux-block-readahead-8-to-32-wt-12` | "本 BP 大顺序读 4096KB · 那个 WT 引擎随机读 8-32 sectors" |
| 56 | `linux-block-journal-separate-volume-mongodb-01` | `wt-journal-disable-non-critical-max-write-01` | "本 BP 卷分离 · 那个直接禁用 journal" |
| 92 | `mongo-replica-set-replication-lag-01` | `mongo-replica-lag-secondary-behind-primary-01` | "本 DF manual tutorial(2 步 6 类根因) · 那个 Ops Manager 告警(3 步 3 类根因)" |
| 93 | `mongo-replication-lag-multi-cause-02` | `mongo-replica-lag-secondary-behind-primary-01` | "本 DF multi-cause 4 类根因 · 那个 Ops Manager 3 类根因" |
| 94 | `mongo-replication-lag-multi-cause-02` | `mongo-replica-set-replication-lag-01` | "本 DF multi-cause 4 类总览 · 那个 manual tutorial 6 类细分" |
| 95 | `mongo-tuned-profile-default-rhel-perf-impact-05` | `mongo-8-0-tcmalloc-percpu-prerequisite-not-met-01` | "本 BP RHEL tuned profile 默认问题 · 那个 8.0 升级 percpu 未启" |
| 96 | `mongo-txn-long-running-wt-cache-pressure` | `mongo-transaction-lifetime-long-wt-cache-pressure-05` | "本 BP 通用建议 · 那个限定 lifetime > 60s 阈值" |
| 97 | `mongo-wt-checkpoint-period-tuning-disk-io-spike-02` | `mongo-wt-checkpoint-time-grows-bulk-load-stall-01` | "本 DF checkpoint 周期触发 IO spike · 那个 bulk load 期间 checkpoint 时间增长" |
| 98 | `os-mongod-maxincomingconnections-high-conn-01` | `mongo-config-mongos-maxconn-connection-leak-01` | "本 DF mongod maxIncomingConnections · 那个 mongos 端连接泄漏" |
| 99 | `mongo-os-tcp-stack-tuning-01` | `mongo-client-os-tcp-tuning-01` | "本 BP 服务端 TCP 参数 · 那个客户端机器 TCP 参数" |
| 100 | `wt-block-compressor-none-max-write-speed-01` | `mongo-wt-block-compressor-cold-data-zstd-06` | "本 BP 高吞吐写场景关压缩 · 那个冷数据归档场景用 zstd" |

#### D.3 prompt 修订示例

**改前 prompt 段**:

```
title 要清晰描述 case 主题 · 中英文都可以。
```

**改后 prompt 段**:

```
title 严格遵守:

(1) 长度
    - 中文 title < 15 字 · 英文 title < 30 字符
    - 不允许长括号子句 · 不允许嵌套括号

(2) 中英文混杂规则
    - 技术术语保留英文:WiredTiger / TLB / NUMA / IRQ / TCP / cache / tcmalloc
    - 普通词必须中文:不写"持续 high" 写"持续高位"; 不写"频繁 stall" 写"频繁停顿"
    - 但禁定性词:"持续较高" / "显著上升" / "频繁" 替换为具体数值
      ✗ "WT cache 持续较高"
      ✓ "WT cache used ≥ 95%"

(3) distinguishes_from(主题相近 case 必填)
    在生成 case 之前 · 你必须先扫已有案例库 · 检查"主题标签" overlap:
    - 如果发现已有 case 共享 ≥ 3 tag · 必须在新 case 加 distinguishes_from:
      {
        "case_id": "<已有 case 的 id>",
        "diff_summary": "本 case 与那个的差异(workload / arch / 阶段 / 版本)"
      }
    - 已有 case 也要回填 distinguishes_from(双向)

(4) 反例(必须返工 · 来自当前案例库)
    ✗ "WiredTiger commitIntervalMs: increase to 200-300ms for higher write throughput"
       (43 字符过长 + 长冒号子句)
    ✓ "WT commitIntervalMs 200ms · 高吞吐写"
    ✓ subtitle: "increase from default 100ms · trade-off durability"
```

#### D.4 验收标准

下一轮蒸馏后:

- `clarity` 维度均值从 6.83 → **≥ 7.8**
- 16 对 clarify_distinction → **≤ 5**(70% 通过 distinguishes_from 字段
  消除)
- title 平均长度(中文)从当前散布 → **≤ 15 字**

---

### E · 正交性强制(对应 2 对真重复 + 47 对 DF/BP 镜像)

#### E.1 体检证据

- `orthogonality-fine-judgment.json` by_relation:
  - `duplicate`: **2** · `merge_into_one` 推荐 · 即
    `mongo-globallock-current-queue-high-lock-contention-01` ↔ `mongo-locking-queue-buildup-01`
    (pair 129) · `mongo-tcmalloc-percpu-caches-not-enabled-01` ↔ `mongo-8-0-tcmalloc-percpu-prerequisite-not-met-01`
    (pair 140)
  - `df_bp_mirror`: **47** · 设计上的镜像但当前没字段标注 · 让 a4 / a6
    LLM 体检时误报"高重叠"
- `merge_into_one` action 共 **4** 对 · 真合并优先级最高

#### E.2 改进描述

##### E.2.1 蒸馏前主题扫描

蒸馏 prompt 必须**先做主题扫描** · 高重叠主题不蒸馏新 case · 而是合
并到已有 case:

```
// 蒸馏前置 · 主题去重
scan_existing_cases_by_tags(new_case.shared_tags)
if any existing_case has |shared_tags ∩ new_tags| >= 4
   and same scope/case_pattern:
  → 不蒸馏 · 改为更新现有 case 的 source_url 列表(多源汇)
elif overlap is intentional (DF/BP 镜像设计):
  → 必须显式标注 mirror_case_id(见 E.2.2)
else:
  → 正常蒸馏 · 但加 distinguishes_from 字段(见 D.2.2)
```

##### E.2.2 DF/BP 镜像标注规范

DF/BP 镜像必须显式配对(`mirror_case_id` 字段)· 让下游 LLM 体检知
道这是设计上的故意 · 而非真重复:

```json
// DF case
{
  "case_id": "kunpeng-bios-cpu-prefetch-enabled-01",
  "entry_kind": "diagnostic-flow",
  "mirror_case_id": "kunpeng-bios-cpu-prefetch-disable-db-01",
  "mirror_relation": "df_bp_mirror"
}

// 对应 BP case
{
  "case_id": "kunpeng-bios-cpu-prefetch-disable-db-01",
  "entry_kind": "best-practice",
  "mirror_case_id": "kunpeng-bios-cpu-prefetch-enabled-01",
  "mirror_relation": "df_bp_mirror"
}
```

##### E.2.3 真重复合并

当前 4 对 `merge_into_one`(见 fine-judgment.json):

| pair | case_a | case_b | 合并方向 |
|---|---|---|---|
| 45 | `mongo-8x-thp-disabled-tcmalloc-suboptimal-01` | `mongo-8-0-tcmalloc-percpu-prerequisite-not-met-01` | 合并 b → a · 因 a 主题更准(THP 是 percpu 前置条件) |
| 73 | (见 fine-judgment.json pair 73) | (见同上) | 详见 fine-judgment.json line 1456 |
| 129 | `mongo-globallock-current-queue-high-lock-contention-01` | `mongo-locking-queue-buildup-01` | 保留 a · 把 b 的 mongo manual 链接合并为 a 的 source_url 列表 |
| 140 | `mongo-tcmalloc-percpu-caches-not-enabled-01` | `mongo-8-0-tcmalloc-percpu-prerequisite-not-met-01` | 保留 a · b 是同问题不同来源 |

#### E.3 prompt 修订示例

**改前 prompt 段**:

```
请蒸馏新 case · 输出 case_id / title / source_url 等字段。
```

**改后 prompt 段**:

```
蒸馏新 case 之前 · 必须先做正交性检查:

(1) 主题扫描
    扫描已有案例库 · 看 shared_tags overlap:
    - if 已有 case 共享 ≥ 4 tag + 同 scope + 同 case_pattern
      → 不蒸馏新 case · 把当前 source 加到已有 case 的 source_url_list
        (多源汇 · 不增 case 总数)
    - 否则继续

(2) DF/BP 镜像识别
    新 case 是否与已有 case 形成 DF/BP 镜像(同参数 · 一个检测一个推荐)?
    - 是 → 加 mirror_case_id 字段(双向) + mirror_relation: "df_bp_mirror"
      已有 case 也要回填 mirror_case_id
    - 否 → 进 (3)

(3) distinguishes_from 标注
    见 §D.2.2

(4) 输出
    case_id / mirror_case_id / mirror_relation / distinguishes_from 必须
    显式 · 不允许省略
```

#### E.4 验收标准

下一轮蒸馏后:

- `duplicate` 数从 2 → **0**(已合并)
- `df_bp_mirror` 47 对全部带 `mirror_case_id` 字段(可程序化校验)
- 案例库总数从 202 → 198(合并 4 对去 4 个 case · 但加 mirror 标注的
  case 不去除)

---

### F · 跨语言 quote 标注(对应 a3 评分尺度粗糙)

#### F.1 体检证据

- `a3-citation-alignment.json` drift_distribution:`none` 173 / `minor` 13 ·
  即 75%(173/191)集中满分 · 评分尺度太粗
- 中文 case quote 来源是英文 source 的情形(如鲲鹏 case 引华为博客中文
  · MongoDB case 引 docs.mongodb.com 英文)目前没字段区分 · LLM-as-Judge
  做"原文 substring 匹配"时偏宽松

#### F.2 改进描述

每个 quote 字段加 `quote_language` 标记:

| 字段 | 取值 | 含义 |
|---|---|---|
| `quote_language` | `en` / `zh` | quote 字符串本身的语言 |
| `source_url_lang`(已有) | `en` / `zh` | source 整体的主语言 |

跨语言 quote(`quote_language ≠ source_url_lang`)必须额外提供:

- `quote_original`:source 原文 verbatim(原语言)
- `quote_translation`:LLM 翻译(目标语言) · 显式标 `inferred_translation`

让 a3 LLM-as-Judge 能精确比对(`quote_original` 字面回查 source · 不
比对译文 · 译文仅供报告渲染)。

#### F.3 prompt 修订示例

**改前 prompt 段**:

```
quote 字段必须 verbatim 抽自 source。
```

**改后 prompt 段**:

```
quote 字段抽取规则:

(1) 同语言抽取(默认)
    case 输出语言 == source 主语言时 · 直接 verbatim 抽:
    - quote: <原文>
    - quote_language: <en|zh>
    - 不需要 quote_original / quote_translation

(2) 跨语言抽取
    case 输出语言 != source 主语言时(中文 case 引英文 source · 反之):
    - quote_original: <source 原文 verbatim · 原语言>
    - quote_translation: <LLM 翻译 · 目标语言>
    - quote_language: <quote_translation 的语言>
    - inferred_fields 加入 "quote_translation"(显式标"由 LLM 翻译")

(3) a3 LLM-as-Judge 比对约定(下游)
    Judge 只字面回查 quote_original 是否在 source 中出现 · 不比对
    quote_translation。下游 a3 重跑后 · 期待 drift_distribution
    分散度上升(不再 75% 集中满分)。

(4) 反例
    ✗ 中文 case 直接给中文 quote · 但 source 是 docs.mongodb.com 英文
       → judge 字面回查必然 miss · 但当前规则下被宽松判 "minor drift"
    ✓ 中文 case 给 quote_original = "Cache eviction is throttled when
       the cache is too full"(英文原文) · quote_translation = "缓存
       过满时 eviction 被节流"(中文 · LLM 翻译)
```

#### F.4 验收标准

下一轮蒸馏后跑 a3 v2:

- `quote_language` 字段 NULL 比例 = **0**
- 跨语言 quote case 至少有 `quote_original` + `quote_translation` 双字段
- `drift_distribution` 期望分散度 ≥ 当前 +20%(不再 75% 满分集中) ·
  评分粒度细化后能看出真问题

---

## 3 · 改进路径(优先级)

### P0 · 直接消除最大缺陷(预计 1.5-2 周)

| 项 | 工程量 | 收益 |
|---|---|---|
| **A · 数值化阈值** | 0.5 周 prompt 改 + 1 周重蒸馏 96 个 DF case | rigor 6.33 → 7.5+ · 直接打透最弱维度 |
| **B · BP 配置型源分发** | 0.5 周 prompt 改 + 0.5 周重蒸馏 5 个 dev.to 系列 + 后续配置型 BP | clarity / completeness 双升 · 解决 5 个 5 分 case 的根因 |

### P1 · 中等收益(预计 1 周)

| 项 | 工程量 | 收益 |
|---|---|---|
| **C · adaptability 字段** | 0.3 周 prompt 改 + 0.5 周抽样补 adaptability_notes | adaptability 6.03 → 7.5+ · 16 对 clarify 中 ≥ 8 对消除 |
| **D · clarity 字段** | 0.3 周 prompt 改 + 0.3 周回填 distinguishes_from 16 对 | clarity 6.83 → 7.8+ · 16 对 clarify → ≤ 5 |

### P2 · 系统性加固(预计 1 周)

| 项 | 工程量 | 收益 |
|---|---|---|
| **E · 正交性 + mirror 标注** | 0.3 周 prompt 改 + 0.3 周合并 4 对 + 0.3 周回填 47 对 mirror_case_id | duplicate 2 → 0 · 后续蒸馏不再产生隐式重复 |
| **F · 跨语言 quote** | 0.2 周 prompt 改 + 0.5 周回填 quote_language(可程序化半自动) | a3 评分粒度细化 · 后续假引用可被精确捕捉 |

### 总工程量

P0 + P1 + P2 ≈ **3.5-4 周** · 单 LLM 操作员 + 1 reviewer 并行。建议 P0
先单独发一轮 · 跑 a4 v2 / a6 v2 验证收益再做 P1 / P2 — 避免一次大重蒸
后体检不通过又难定位。

---

## 4 · 跟蒸馏综述的对接

### 4.1 综述的方法论母本

`~/Documents/蒸馏工程/蒸馏工程综述.md`:

- **§5 总结去重**:对应本清单 §E(正交性强制)+ §D(distinguishes_from)
- **§6 验证**:对应本清单 §A(数值化 = 阈值有具体值才能验证) +
  §F(跨语言 quote 才能精确回查)

### 4.2 改进建议落地综述 3 大原则

| 综述原则 | 本清单落地点 |
|---|---|
| **原子化**(每个原子事实可单独验证) | §A 数值化阈值 + §C adaptability_notes 维度化 — 每个维度都是可单独验证的原子 |
| **矛盾立项**(同参数取值矛盾时显式记录) | §C exclusions 字段 + §D distinguishes_from 字段 — 矛盾不藏 · 直接挂出来让下游处理 |
| **三角验证**(≥ 3 独立来源) | §B 多 source_url 列表 + §F 跨语言 quote_original — quote 真能回查 source 才算一角 · 配 NLM + OBS 三角才完整 |

### 4.3 跟 perf-kp-sql 现有方法论的呼应

- **`docs/methodology/llm-boundaries.md`** 给"LLM 哪步该做哪步不该做"的
  P1-P4 兜底原则 — 本清单 §B 的 source_type 分发就是 P1 原则的应用
  (有规则可写 → 写规则)
- **`docs/methodology/depth-control.md`** 给"4 大控深度杠杆 L1-L4" —
  本清单 §A / §C 直接服务 L4("校验回路":有具体阈值 + adaptability
  边界才能跑校验)

---

## 5 · 落地检查清单(给蒸馏者)

下一轮蒸馏开工前 · 蒸馏者(LLM 操作员)请逐条勾选:

- [ ] 已读完本清单 §A-§F 6 大改进项
- [ ] prompt 已加 §A 阈值格式约束(metric 比较符 数值 单位)
- [ ] prompt 已加 §B source_type 分发(config-list / narrative)
- [ ] prompt 已加 §C adaptability_notes 字段(至少一个维度)
- [ ] prompt 已加 §D title 长度限制 + distinguishes_from 字段
- [ ] prompt 已加 §E 主题扫描 + mirror_case_id 字段
- [ ] prompt 已加 §F quote_language + quote_original + quote_translation
- [ ] xlsx schema 已扩字段:`threshold_type` / `source_type` /
      `adaptability_notes` / `distinguishes_from` / `mirror_case_id` /
      `mirror_relation` / `quote_language` / `quote_original` /
      `quote_translation`
- [ ] `_build-cases-from-xlsx.mjs` 已适配新字段(下游构建脚本)
- [ ] field-integrity-report 已放过 `source_type=config-list` 的 quote
      缺失警告
- [ ] 重蒸馏后跑全套体检(a3 / a4 / a6 / orthogonality / field-integrity)·
      对照本清单各 §的"验收标准"逐条核对

---

## 6 · 反偏倚提醒

本清单作者(perf-kp-sql 方法论 agent)与体检执行 agent 都是 LLM ·
模型自评 LLM 产出有"同型偏盲点"风险:

- 本清单建议的"改进"可能仍漏 LLM 共性盲点(如:训练数据中常见参数
  权重偏高 · 长尾参数仍可能被低估)
- **强制要求**:本清单落地前 · 至少另一家模型(Sonnet / Codex / 其他)
  做一轮 review · 评审通过的判据见全局 CLAUDE.md 代码评审节
- 重蒸馏后 5% 抽样人工校准必跑 · 不能只信 LLM-as-Judge

---

> **文档结束** · 改进有效性以下一轮 a3 / a4 / a6 / orthogonality 重跑数字
> 为准 · 本清单数字将随之进入 v2。
