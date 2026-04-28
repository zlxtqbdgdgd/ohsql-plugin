# Phase 1 · sqlite KB schema + perf-kp-sql 使用方法

> 输入: `/Volumes/WD_BLACK/myagent/new_ohsql/docs/data/distill-v2/cases/{_common,mongodb}/<entry_kind>/*.md` (202 条 case · 108 文件)
> 目标: 把所有 md 字段无损存入 `data/knowledge.sqlite`,运行时**不读 md**,只查 sqlite。
> 方案: 单一 `cases` 表(公共列 + 3 个 entry_kind 专属 JSON 列) + 4 张子表(扁平化高频检索字段) + FTS5 + sqlite-vec embedding。

---

## 1. md 字段全景 (确保零信息丢失)

### 1.1 公共字段 (yaml frontmatter · 所有 entry_kind 都有)

```
case_id           ← 来自 ## case_id `xxx` 标题行(全局唯一)
entry_kind        ← yaml: best-practice / diagnostic-flow / flame-signature
database          ← yaml: mongodb / null (跨 DB 的 OS 信号)
platform          ← yaml: bare / linux-arm64-kunpeng / linux-x86_64-generic
source_url        ← yaml: 原始文档 URL
source_url_lang   ← yaml: en / zh
source_authority  ← yaml: official / community-canonical / community-blog / vendor-doc / code-comment
extracted_at      ← yaml: ISO timestamp
extractor_model   ← yaml: 蒸馏所用模型 (审计用)
inferred_fields   ← yaml: 哪些字段是模型推断(非逐字)的列表
notes             ← yaml: 蒸馏者备注 (审计用 · 长文本)

(下面每个 case ## 标题下的表行)
title             ← | title | xxx |
scope             ← | scope | xxx |
case_pattern      ← | case_pattern | xxx | (BP 一般 parameter-best-practice; DF 是 fault-management/parameter-audit/core-perf-diagnosis)
database_version_min  ← | database_version_min | xxx |
database_version_max  ← | database_version_max | xxx |
source_heading    ← | source_heading | xxx | (DF 多用 · 标记从原文哪一节蒸的)
```

### 1.2 best-practice 专属

```
scenario:
  description_quote          ← #### scenario_description_quote 块
  description_zh             ← #### scenario_description (中文转述) 块 (zh)
  triggers_quote             ← | triggers_quote | xxx |
  keywords[]                 ← | scenario_keywords | `["a","b"]` |

recommendation:
  value                      ← | recommendation_value | xxx |
  layer                      ← | recommendation_layer | xxx |
  quote                      ← #### recommendation_quote 块

detection_step (optional · 整块可 NULL):
  layer                      ← | detection_layer | xxx |
  method_quote               ← | detection_method_quote | xxx |
  violation_pattern_quote    ← | violation_pattern_quote | xxx |

rationale:
  quote                      ← #### rationale_quote 块 (可 NULL)
  quote_lang                 ← | rationale_quote_lang | xxx |
  zh                         ← #### rationale (中文转述) 块

risk_if_violated:
  severity                   ← | risk_severity | warning/critical |
  quote                      ← #### risk_quote 块
  zh                         ← #### risk (中文转述) 块

related_param_names[]        ← ### related_param_names 下 `["a","b"]`
cross_reference[]            ← ### cross_reference 下 `["..."]` (可 NULL)
```

### 1.3 diagnostic-flow 专属

```
engine                       ← | engine | mongodb/linux-os/kunpeng-platform/mixed |
symptom_category             ← | symptom_category | latency-jitter/cpu-high/... |

symptom:
  description_quote          ← #### description (逐字) 块
  keywords[]                 ← #### keywords 下 `[...]`

diagnostic_steps[] (有序):
  step_no                    ← #### step_no N 标题
  title                      ← #### step_no N · <title>
  metric_name                ← | metric_name | xxx |
  collection_layer           ← | collection_layer | xxx | (os/mongo-shell/mongo-runtime-cmd/log-grep/bios-readout)
  collection_method_quote    ← | collection_method_quote | xxx |
  abnormal_pattern_quote     ← | abnormal_pattern_quote | xxx |
  abnormal_pattern_threshold ← | abnormal_pattern_threshold | xxx | (可结构化 JSON 或纯文本)
  metric_unit                ← | metric_unit | pct/count/seconds/enum/bool/version |
  prerequisite_steps[]       ← | prerequisite_steps | [] |

likely_causes:
  parameter_causes[]:
    cause_no                 ← ##### cause N
    title                    ← ##### cause N · <title>
    param_name               ← | param_name | xxx |
    abnormal_value_pattern   ← | abnormal_value_pattern | xxx |
    reasoning_quote          ← | reasoning_quote | xxx |
    linked_diagnostic_step_no ← | linked_diagnostic_step_no | N |
  non_parameter_causes[]:
    cause_no / title         同上
    cause_type               ← | cause_type | os-version-bug/application-design/... |
    description_quote        ← | description_quote | xxx |
    linked_diagnostic_step_no
    mitigation_quote         ← | mitigation_quote | xxx | (可 NULL)

mitigation_quote             ← ### mitigation 块下 (case 级 · 独立于 cause)
```

### 1.4 flame-signature 专属

```
signature_type               ← | signature_type | function-prefix/module-name/stack-pattern |
pattern_regex                ← | pattern_regex | `^__wt_evict_.*` |
match_layer                  ← | match_layer | stack-frame-pattern/module-prefix/function-name |
pattern_quote_anchor         ← | pattern_quote_anchor | <小节标识> |

pattern_quote                ← #### pattern_quote 块

mechanism:
  quote                      ← #### mechanism_quote 块
  quote_lang                 ← | mechanism_quote_lang | en/zh |
  zh                         ← #### mechanism (中文转述) 块

workload_implication:
  quote                      ← #### workload_implication_quote 块
  zh                         ← #### workload_implication (中文转述) 块
  hotness_threshold          ← | hotness_threshold | xxx | (常 NULL)

tuning_directions[]:
  direction_no               ← #### direction N
  direction_quote            ← | direction_quote | xxx |
  related_param_name         ← | related_param_name | xxx | (可 NULL)
  confidence                 ← | confidence | high/medium/low |

cross_reference[]            ← ### cross_reference 下 (可 NULL)
linked_case_ids[]            ← ### linked_case_ids 下 (可 NULL)
```

### 1.5 NOT 入库 (留 distill-v2 仓本地审计用)

```
snapshot_html / snapshot_txt          (源文档快照 · 几百 MB)
inferred-references-*.md              (NULL 字段的推断说明 · 逐条文档)
反幻觉自检 + 路径护栏表格               (蒸馏期校验 · 入库无意义)
fetch_status / http_status / sections_scanned 等元数据 (蒸馏期统计)
```

---

## 2. sqlite Schema (DDL)

### 2.1 主表 cases

```sql
CREATE TABLE cases (
  -- 主键 + 路由
  case_id              TEXT PRIMARY KEY,
  entry_kind           TEXT NOT NULL CHECK(entry_kind IN ('best-practice','diagnostic-flow','flame-signature')),

  -- 路由维度 (高频过滤 · 都做索引)
  database             TEXT,                               -- 'mongodb' | NULL (跨 DB 的 OS-only)
  platform             TEXT NOT NULL,                       -- 'bare' | 'linux-arm64-kunpeng' | 'linux-x86_64-generic'
  scope                TEXT,                               -- 'linux-mm' | 'wt-cache' | 'storage-engine-wt' | ...
  case_pattern         TEXT,

  -- 基本元数据
  title                TEXT NOT NULL,
  source_url           TEXT NOT NULL,
  source_url_lang      TEXT,
  source_authority     TEXT NOT NULL,
  source_heading       TEXT,
  database_version_min TEXT,
  database_version_max TEXT,
  extracted_at         TEXT,
  extractor_model      TEXT,
  notes                TEXT,                               -- 蒸馏期备注 · 审计用

  -- entry_kind 专属嵌套数据 (按 entry_kind 二选一填充 · 其余 NULL)
  best_practice_data   TEXT,                               -- JSON · 见 §3.1
  diagnostic_flow_data TEXT,                               -- JSON · 见 §3.2
  flame_signature_data TEXT,                               -- JSON · 见 §3.3

  -- bucket 路由字段 (NotebookLM 集成依赖 · 由 scope 推导 · cli-kb build 时填充)
  bucket               INTEGER NOT NULL CHECK(bucket IN (1,2,3,4,5)),
                                                           -- 1=硬件 (arm64-*/kunpeng-*/bios-firmware)
                                                           -- 2=OS (linux-*/mem-allocator-*/tls-crypto)
                                                           -- 3=引擎配置 (wt-config/mongo-config-*)
                                                           -- 4=运行时 (wt-cache/wt-eviction/wt-checkpoint/mongo-runtime)
                                                           -- 5=业务 (mongo-query-*/mongo-index-*)

  -- 检索辅助 (build 期填充)
  fts_text             TEXT GENERATED ALWAYS AS (
    title || ' ' || COALESCE(scope,'') || ' ' || COALESCE(notes,'') || ' ' ||
    COALESCE(best_practice_data,'') || COALESCE(diagnostic_flow_data,'') || COALESCE(flame_signature_data,'')
  ) VIRTUAL,
  embedding            BLOB,                               -- sqlite-vec 384 维 · 来自 all-MiniLM-L6-v2

  -- 完整性约束: 三选一 JSON 必填一个
  CHECK (
    (entry_kind = 'best-practice'    AND best_practice_data    IS NOT NULL) OR
    (entry_kind = 'diagnostic-flow'  AND diagnostic_flow_data  IS NOT NULL) OR
    (entry_kind = 'flame-signature'  AND flame_signature_data  IS NOT NULL)
  )
);

-- 路由索引
CREATE INDEX idx_cases_entry_kind        ON cases(entry_kind);
CREATE INDEX idx_cases_database_kind     ON cases(database, entry_kind);
CREATE INDEX idx_cases_platform          ON cases(platform);
CREATE INDEX idx_cases_scope             ON cases(scope);
CREATE INDEX idx_cases_database_scope    ON cases(database, scope);
CREATE INDEX idx_cases_authority         ON cases(source_authority);
CREATE INDEX idx_cases_pattern           ON cases(case_pattern);
CREATE INDEX idx_cases_bucket            ON cases(bucket);
```

### 2.2 子表 (扁平化高频检索字段)

```sql
-- 参数名扁平化 (从 BP.related_param_names + DF.parameter_causes[].param_name + Flame.tuning_directions[].related_param_name 抽取)
-- 用于 "现场参数 vm.swappiness=60 → 哪些 case 关心这个参数" 的精确匹配
CREATE TABLE case_param_names (
  case_id      TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  param_name   TEXT NOT NULL,
  param_role   TEXT NOT NULL CHECK(param_role IN ('recommendation','cause','tuning-direction','detection')),
  PRIMARY KEY (case_id, param_name, param_role)
);
CREATE INDEX idx_param_name ON case_param_names(param_name);

-- 关键词扁平化 (从 scenario.keywords / symptom.keywords 抽取)
-- 用于关键词扩展检索 (混合查询时与 FTS5 联用)
CREATE TABLE case_keywords (
  case_id   TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  keyword   TEXT NOT NULL,
  PRIMARY KEY (case_id, keyword)
);
CREATE INDEX idx_keyword ON case_keywords(keyword);

-- inferred 字段清单 (yaml.inferred_fields 扁平化)
-- 用于审计 + 报告中的 "这条建议是模型推断的,confidence=medium" 标识
CREATE TABLE case_inferred_fields (
  case_id   TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  field     TEXT NOT NULL,                                  -- 'rationale_zh' | 'recommendation_value' | ...
  PRIMARY KEY (case_id, field)
);

-- case 间引用关系 (cross_reference + linked_case_ids 扁平化)
CREATE TABLE case_links (
  case_id_from   TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  case_id_to     TEXT NOT NULL,                             -- 不带 FK · 允许指向尚未蒸出的 case
  link_type      TEXT NOT NULL CHECK(link_type IN ('cross_reference','linked_case')),
  PRIMARY KEY (case_id_from, case_id_to, link_type)
);
CREATE INDEX idx_links_to ON case_links(case_id_to);
```

### 2.3 FTS5 全文检索 (trigram · 中英文混合)

```sql
CREATE VIRTUAL TABLE cases_fts USING fts5(
  case_id UNINDEXED,
  fts_text,
  tokenize = 'trigram'
);

-- build 期把 fts_text 同步到 fts 表
INSERT INTO cases_fts (case_id, fts_text)
  SELECT case_id, fts_text FROM cases;

-- (在 cli-kb 入库逻辑中维护 trigger 或显式同步)
```

### 2.4 sqlite-vec embedding (语义检索)

```sql
-- sqlite-vec 已载入 · 走 vec0 虚表
CREATE VIRTUAL TABLE cases_vec USING vec0(
  case_id TEXT PRIMARY KEY,
  embedding FLOAT[384]
);

-- build 期填充
-- INSERT INTO cases_vec (case_id, embedding) VALUES (?, ?)
```

### 2.5 KB 元信息表

```sql
CREATE TABLE kb_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
-- 例: ('schema_version','1'), ('built_at','2026-04-28T...'), ('cases_count','202'), ('source_distill_commit','abc123...')
```

---

## 3. JSON 列子结构 (字段全保留)

### 3.1 best_practice_data

```json
{
  "scenario": {
    "description_quote": "If the TCP keepalive value is greater than ...",
    "description_zh": "云数据库部署中 · LB 在 idle timeout ...",
    "keywords": ["TCP keepalive","cloud","load balancer","idle timeout"],
    "triggers_quote": "your cloud provider's load balancer"
  },
  "recommendation": {
    "value": "net.ipv4.tcp_keepalive_time = 120",
    "layer": "os-sysctl",
    "quote": "To reduce this risk, set tcp_keepalive_time to 120."
  },
  "detection_step": {
    "layer": "os",
    "method_quote": "sysctl net.ipv4.tcp_keepalive_time",
    "violation_pattern_quote": "the TCP keepalive value is greater than ..."
  },
  "rationale": {
    "quote": null,
    "quote_lang": null,
    "zh": "LB 在 idle timeout 到期后悄悄回收 TCP 连接 ..."
  },
  "risk": {
    "severity": "warning",
    "quote": "there is a risk that the system might silently drop connections.",
    "zh": "不调整时 · 云 LB 静默丢连接 ..."
  },
  "cross_reference": ["AWS EC2 段也提到 'Set tcp_keepalive_time to 120'"]
}
```

### 3.2 diagnostic_flow_data

```json
{
  "engine": "linux-os",
  "symptom_category": "network-latency",
  "symptom": {
    "description_quote": "If the TCP keepalive value is greater than ...",
    "keywords": ["tcp_keepalive_time","load balancer","silent drop","cloud connection"]
  },
  "diagnostic_steps": [
    {
      "step_no": 1,
      "title": "看当前 tcp_keepalive_time",
      "metric_name": "net.ipv4.tcp_keepalive_time",
      "collection_layer": "os",
      "collection_method_quote": "sysctl net.ipv4.tcp_keepalive_time",
      "abnormal_pattern_quote": "If the TCP keepalive value is greater than ...",
      "abnormal_pattern_threshold": "当前值 > 云 LB 空闲超时(常见 60-120 秒)",
      "metric_unit": "seconds",
      "prerequisite_steps": []
    }
  ],
  "likely_causes": {
    "parameter_causes": [
      {
        "cause_no": 1,
        "title": "tcp_keepalive_time 默认值偏大",
        "param_name": "net.ipv4.tcp_keepalive_time",
        "abnormal_value_pattern": "默认 7200(2 小时) · 远大于云 LB 空闲超时",
        "reasoning_quote": "To reduce this risk, set tcp_keepalive_time to 120.",
        "linked_diagnostic_step_no": 1
      }
    ],
    "non_parameter_causes": []
  },
  "mitigation_quote": "You need to restart mongod and mongos processes for new system-wide keepalive settings to take effect."
}
```

### 3.3 flame_signature_data

```json
{
  "signature_type": "stack-pattern",
  "pattern_regex": "^(sys_newfstatat|sys_getdents|sys_openat|page_fault).*",
  "match_layer": "stack-frame-pattern",
  "pattern_quote_anchor": "5.2. File Systems",
  "pattern_quote": "Most of the kernel time is in sys_newfstatat() and sys_getdents() ...",
  "mechanism": {
    "quote": "Most of the kernel time is in sys_newfstatat() ...",
    "quote_lang": "en",
    "zh": "内核 CPU 时间主要消耗在文件系统元数据遍历 ..."
  },
  "workload_implication": {
    "quote": "As an example of a different workload, this shows the Linux kernel CPU time while an ext4 file system was being archived",
    "zh": "当火焰图中 sys_newfstatat/sys_getdents/page_fault 等函数显著占据内核 CPU 时间 ...",
    "hotness_threshold": null
  },
  "tuning_directions": [
    {
      "direction_no": 1,
      "direction_quote": "Had the archiver used the read() syscall instead, this flame graph would look very different ...",
      "related_param_name": null,
      "confidence": "medium"
    }
  ],
  "cross_reference": null,
  "linked_case_ids": null
}
```

---

## 4. KB Build 流程 (cli-kb 重写)

```
distill-v2/cases/<db>/<entry_kind>/*.md
    ↓
[Step 1] 扫目录 · 列所有 *.md
    ↓
[Step 2] 解析 yaml frontmatter (js-yaml)
    ↓
[Step 3] 切 ## case_id 区块 (与 export-kb-to-xlsx.mjs 同算法)
    ↓
[Step 4] 每个 case 区块:
    a. 抓 ## 标题里的 case_id
    b. 抓所有 | field | value | 表行 → fields 字典
    c. 抓 #### <label>(逐字 ...) ↓ block-quote → quotes 字典
    d. 按 entry_kind 装配 JSON (见 §3)
    e. 提取扁平字段 (param_names / keywords / inferred_fields / links)
    f. **scopeToBucket(scope) → bucket** (1-5 见 §2.1 cases.bucket 注释)
    g. 计算 sqlite-vec embedding (title + 关键 quote 拼接 → @xenova/transformers all-MiniLM-L6-v2)
    ↓
[Step 5] 事务批量 INSERT cases / case_param_names / case_keywords / case_inferred_fields / case_links / cases_fts / cases_vec
    ↓
[Step 6] 写 kb_meta · 收尾
```

cli-kb 命令:

```bash
# 全量重建 (开发期常用)
node scripts/kb.mjs build --from /path/to/distill-v2/cases --out data/knowledge.sqlite

# 增量更新 (后期蒸馏新 case 时)
node scripts/kb.mjs upsert --from /path/to/new-cases.md

# 查询 (调试用)
node scripts/kb.mjs query --kind diagnostic-flow --scope wt-cache --param eviction_dirty_trigger
node scripts/kb.mjs search "wt cache eviction 抖动" --top 10

# 统计
node scripts/kb.mjs stats
# → entries by entry_kind / database / source_authority / scope
```

---

## 5. perf-kp-sql Runtime 使用方法 (4 类查询路径)

### 5.1 现场快照 → KB 匹配的整体流程

```
[采集] cli-ssh 远程跑 collect-cmds.json
  ↓ produces snapshot.json:
  {
    "host": "...",
    "metrics": {
      "os.vm.swappiness": 60,                   # 现场参数
      "os.cpu.iowait_pct": 12.3,
      "mongo.wt.cache.usage_pct": 87,
      "mongo.wt.eviction.dirty_pct": 14,
      ...
    },
    "flamegraph_stacks": [                       # 可选 · 火焰图栈帧采样
      {"stack": "sys_brk;__brk_handler;...", "samples": 234},
      ...
    ],
    "config_dump": { ... }                       # mongod 配置全量 dump
  }
  ↓
[匹配] cli-diagnose 走 4 条查询路径
  ↓
[整合] report.ts 按 entry_kind 分组 + impact 排序 + render HTML
```

### 5.2 路径 A · 配置审计 (BP 主用)

**输入**: `snapshot.config_dump.{vm.swappiness, net.ipv4.tcp_keepalive_time, wiredTigerCacheSizeGB, ...}`

**算法**:
1. 对每个现场参数 P=v0:
   - 查 `case_param_names` where `param_name = P AND param_role = 'recommendation'` (BP 表)
   - 拿到候选 case_id list
   - 从 cases 表读出每个 case 的 `recommendation.value` (推荐值 v_rec)
   - 对比 v0 vs v_rec → 若不符 → 命中
2. 输出: 每条命中带上 `recommendation.quote` + `rationale.quote/zh` + `risk.quote/zh` + `severity`

**SQL**:
```sql
SELECT c.case_id, c.title, c.source_url, c.source_authority,
       json_extract(c.best_practice_data, '$.recommendation.value') AS rec_value,
       json_extract(c.best_practice_data, '$.recommendation.quote') AS rec_quote,
       json_extract(c.best_practice_data, '$.rationale.zh')         AS rationale_zh,
       json_extract(c.best_practice_data, '$.risk.severity')        AS severity
FROM cases c
INNER JOIN case_param_names cp ON cp.case_id = c.case_id
WHERE cp.param_name  = ?
  AND cp.param_role  = 'recommendation'
  AND c.entry_kind   = 'best-practice'
  AND (c.database IS NULL OR c.database = ?)              -- 'mongodb' or NULL
  AND (c.platform = 'bare' OR c.platform = ?);            -- 平台筛选
```

### 5.3 路径 B · 指标异常诊断 (DF 主用)

**输入**: `snapshot.metrics.<metric_name> = v0` 且超出阈值

**算法**:
1. 对每个 metric M:
   - 查 `case_param_names` where `param_name = M AND param_role = 'cause'` (DF 表的 parameter_causes)
   - 候选 case 拉出 `diagnostic_flow_data.likely_causes.parameter_causes[]`
   - 用 cause 的 `abnormal_value_pattern` 验证现场 v0 是否真的命中(简单是字符串/数字阈值匹配 · 复杂的 fall back 到正则)
   - 命中 → 整个 DF case 进候选,带上 `diagnostic_steps[]` 给报告(让用户/skill 跑 step 验证)
2. 同时:对未结构化的 symptom 信号(如 "cpu-high" / "latency-jitter"):
   - 用现场 metric 推断 symptom_category (规则: cpu_pct > 80 → cpu-high)
   - 查 `cases WHERE entry_kind = 'diagnostic-flow' AND json_extract(diagnostic_flow_data, '$.symptom_category') = ?`

**SQL**:
```sql
-- 参数因子触发的 DF
SELECT c.case_id, c.title, c.source_url,
       json_extract(c.diagnostic_flow_data, '$.symptom.description_quote') AS symptom,
       c.diagnostic_flow_data
FROM cases c
INNER JOIN case_param_names cp ON cp.case_id = c.case_id
WHERE cp.param_name  = ?
  AND cp.param_role  = 'cause'
  AND c.entry_kind   = 'diagnostic-flow'
  AND (c.database IS NULL OR c.database = ?);

-- symptom 类目触发的 DF
SELECT c.case_id, c.title, c.source_url, c.diagnostic_flow_data
FROM cases c
WHERE c.entry_kind   = 'diagnostic-flow'
  AND json_extract(c.diagnostic_flow_data, '$.symptom_category') = ?
  AND (c.database IS NULL OR c.database = ?);
```

### 5.4 路径 C · 火焰图栈帧匹配 (Flame 主用)

**输入**: `snapshot.flamegraph_stacks[]` (栈帧 + 采样数)

**算法**:
1. 把所有 flame-signature 的 `pattern_regex` 加载到内存(13 条 · 量小)
2. 对每个栈帧:测试每个 regex
3. 命中 + 该函数累计采样占比 ≥ 5% → 触发该 signature
4. 命中 case 的 `mechanism.zh` + `workload_implication.zh` + `tuning_directions[]` 进报告

**SQL**:
```sql
-- 加载所有候选 (按 db / platform 过滤)
SELECT c.case_id, c.title, c.scope,
       json_extract(c.flame_signature_data, '$.pattern_regex')           AS pattern_regex,
       json_extract(c.flame_signature_data, '$.mechanism.zh')            AS mechanism_zh,
       json_extract(c.flame_signature_data, '$.workload_implication.zh') AS implication_zh,
       json_extract(c.flame_signature_data, '$.tuning_directions')       AS tuning_directions
FROM cases c
WHERE c.entry_kind = 'flame-signature'
  AND (c.database IS NULL OR c.database = ?)
  AND (c.platform = 'bare' OR c.platform = ?);
-- 后续在应用层用 RegExp.test 逐个栈帧测试
```

### 5.5 路径 D · 本地关键词检索 (兜底 · 离线场景)

**输入**: 用户自然语言 query 或参数名

**用途**: 仅作离线/弱网/NotebookLM API 不可达时的本地兜底 · 主自然语言查询走路径 E (NotebookLM)。

**算法**:
1. FTS5 trigram 命中 (cases_fts 中英文混合)
2. sqlite-vec 余弦相似 (cases_vec 语义模糊匹配)
3. 合并去重 → top-K case 摘要

```sql
-- 本地 fallback 检索 (仅在路径 E 失败时调用)
SELECT c.case_id, c.title, c.entry_kind, c.source_url, c.source_authority, rank
FROM cases_fts f
INNER JOIN cases c ON c.case_id = f.case_id
WHERE cases_fts MATCH ?
ORDER BY rank LIMIT 10;
```

### 5.6 路径 E · NotebookLM 扩展查询 (主自然语言路径)

> **不直接调 NotebookLM API** · 走本仓 `scripts/notebooklm.mjs` 的 `--op` CLI 接口
> (具体 op 契约见 `docs/linear-wishing-trinket.md` §8 · 由对接 NotebookLM 的同事维护)

**触发场景** (2 类):

#### 场景 1 · 报告生成时自动批查 ("深入分析"段)

cli-diagnose 跑完路径 A/B/C 拿到 matched_cases[] · 输出 diagnose-output.json 后:

```bash
node scripts/notebooklm.mjs --op query-batch \
  --from-diagnose <diagnose-output.json> \
  --hw-arch ${kunpeng|x86_64} \
  --json
```

`notebooklm.mjs` 内部:
1. 读 diagnose-output.json 中每条 critical/warning CheckResult
2. 按 CheckResult.bucket + scope + tags 路由到对应 notebook (kunpeng-kb / os-kb / mongo-kb)
3. 用同事文档 §4.2 的标准 prompt 模板拼 query:
   ```
   "{参数名} 当前值为 {当前值}, {简要诊断结论}。
   请从以下角度分析:1. 作用机制 2. 默认与推荐值 3. 风险 4. 调优建议"
   ```
4. 并发 ≤ 3 · 单条 timeout 30s · 返回:
   ```json
   {
     "ok": true,
     "results": [
       {
         "case_id": "...",
         "answer": "WiredTiger 缓存默认公式是 ... [1] [2]",
         "references": [{"citation_number": 1, "cited_text": "..."}],
         "domain": "mongo",
         "notebook_id": "..."
       }
     ]
   }
   ```

cli-diagnose 收到后注入 HTML footer 之后的"深入分析"段 (同事文档 §3.1):

```
━ wiredTigerCacheSizeGB · 深入分析 ━
WiredTiger 缓存默认公式是 max(256MB, (totalRAM - 1GB) / 2) ...

引用:
[1] "The WiredTiger internal cache size defaults to ..."
[2] "For dedicated database servers, set to 50-60% ..."
```

#### 场景 2 · 用户追问 (skill Step 5)

skill 收到自然语言问题 → 调:

```bash
node scripts/notebooklm.mjs --op query \
  --domain ${auto|mongo|os|kunpeng} \
  --query "<用户原话>" \
  --json
```

`--domain auto` 时 notebooklm.mjs 用关键词路由命中合适的 notebook (vm.swappiness → os, wiredTiger → mongo, 鲲鹏 → kunpeng);未命中所有 notebook 都查再合并。

#### 降级 (3 档)

| 状态 | 行为 (与同事文档 §3 一致) |
|---|---|
| 已配置 + 认证有效 | 自动批查 + 深入分析自动附在报告后 |
| 已配置 + 认证过期 | 主报告正常 + footer 之后一行 "⚠️ NotebookLM 认证已过期 · 运行 `notebooklm login`" |
| 未配置 | 主报告正常 + footer 之后每次提示 "💡 运行 `/perf-kp-sql-setup` 启用知识增强" |

**所有失败都不阻塞主报告** · path E 是诊断后的增强层 · 路径 A/B/C 已是诊断主体。

#### 接口契约 (我们这侧只调 2 个 op)

| op | 何时用 | 输入 | 输出 |
|---|---|---|---|
| `--op query-batch` | 报告生成时 | `--from-diagnose <diagnose.json>` | 聚合的 results[] |
| `--op query` | 用户追问 | `--domain <X> --query <Q>` | 单条 answer + references |

(其他 op `check` / `setup` / `add-domain` 由 perf-kp-sql-setup SKILL 调 · 见同事文档 §8)

### 5.7 报告整合 (与同事文档 §3.1 / §4.4 对齐)

```
report.ts 输入:
  matched_best_practice    : Case[]    // 路径 A
  matched_diagnostic_flow  : Case[]    // 路径 B
  matched_flame_signature  : Case[]    // 路径 C
  (path E 走外部 CLI · 不在 report.ts 同步流中)

主报告 (cli-diagnose 出 HTML · 路径 A/B/C 同步):
  Section 1 · 配置违反 (BP)         [按 risk.severity 排]
  Section 2 · 触发的诊断流程 (DF)    [按 likely_causes 数排]
  Section 3 · 火焰图签名 (Flame)
  footer (Step 4.3 · 同事文档约定的 footer 渲染点)

诊断后增强 (cli-diagnose 把 diagnose-output.json 落盘后):
  ↓
  node scripts/notebooklm.mjs --op query-batch --from-diagnose <path>
  ↓
  返回每条 critical/warning 的 answer + references[]
  ↓
  把这些追加到 footer 之后作"深入分析"段 (HTML 拼接)
  ↓
  失败 → footer 后单行降级提示 (不阻塞)

权威性图标分类:
  本地 KB:    official=★  community-canonical=◆  community-blog=○  code-comment=▲
  NotebookLM: 引用片段直接显示 cited_text · 不带外链 (同事文档 §4.4 约定)
```

---

## 6. 增量更新策略 (后续蒸新 case 入库)

### 6.1 距离 distill-v2 的接口

distill-v2 是数据生产端 · perf-kp-sql 是消费端。两者通过文件系统约定耦合:

```
distill-v2/cases/<db>/<entry_kind>/*.md     ← 生产
perf-kp-sql/data/knowledge.sqlite           ← 消费
```

### 6.2 增量入库

```bash
# 单文件追加 (蒸出新 md 后)
cli-kb upsert <path-to-new-md>
  → 解析新 md
  → 对每个 case_id:
     INSERT INTO cases ON CONFLICT(case_id) DO UPDATE SET ... (覆盖式)
     DELETE + INSERT 子表
     重算 embedding · 更新 cases_vec
     UPDATE cases_fts (DELETE 旧 row + INSERT 新 row)
  → 写 kb_meta.last_upsert_at

# 删除某条 case
cli-kb delete <case_id>
  → ON DELETE CASCADE 触发子表清理 · 同时清 cases_fts/cases_vec

# 全量重建 (schema 变更 / distill-v2 大改时)
cli-kb rebuild
```

### 6.3 schema 演进

`kb_meta.schema_version` 记当前版本。cli-kb 启动时:
- 若现有 sqlite 的 schema_version < cli-kb 期望版本 → 提示用户跑 `kb migrate` 或 `kb rebuild`
- migrate 跑成功后 bump kb_meta.schema_version

---

## 7. KB 完整性校验 (替换老 lint-kb-quotes)

新版的校验在 cli-kb 入库时同步做(不需要独立 lint 工具):

1. **PRIMARY KEY 唯一性**: case_id 全局唯一
2. **JSON schema 校验**: best_practice_data / diagnostic_flow_data / flame_signature_data 子结构必填字段非空 (用 sqlite json_valid + 应用层 ajv schema)
3. **CHECK 约束**: entry_kind 与 JSON 列对应一致
4. **路径护栏**: `database` 与文件物理路径一致 (`_common` ↔ NULL · `mongodb` ↔ 'mongodb')
5. **case_links 半合法性**: case_id_to 可指向尚未入库的 case (allow forward reference) · 但报告告警

---

## 8. 数字预估

```
202 行 cases (93 BP + 96 DF + 13 Flame)
  → cases 表 202 行 · 平均 JSON 列 ~3KB · 主表大约 ~600KB
  → case_param_names 估 350-500 行 (有些 case 多个 param)
  → case_keywords 估 800-1000 行 (每 case 4-5 个关键词)
  → case_inferred_fields 估 250-400 行
  → case_links 估 30-50 行 (cross_reference 不多)
  → cases_fts 202 行 (含 trigram · ~5MB)
  → cases_vec 202 行 (384 dim float · ~300KB)

总 sqlite size 预估: 8-12MB (含 FTS5 trigram 索引 · 主体小)
```

不算上 Xenova 的 30MB embedding 模型,plugin runtime 数据本体足够轻量。

---

## 9. distill-v2 cases → NotebookLM source 投影 (供 ohsql-{kunpeng,os,mongo}-kb 上传)

NotebookLM 集成方案 (`docs/linear-wishing-trinket.md` §1) 约定 source 来源:
- `ohsql-kunpeng-kb` ← `data/common/kunpeng-*.md`
- `ohsql-os-kb` ← `data/common/os-*.md`
- `ohsql-mongo-kb` ← `data/mongo/*.md`

我们**不再用老的 hand-curated** `data/{common,mongo}/*.md`(已规划删 · 见 PHASE-1-AUDIT-CHECKLIST.md A6) · 改为**从 distill-v2 cases 投影出 flat .md** 放回这两个目录。

### 9.1 投影脚本 (新写)

`scripts/cases-to-flat-md.mjs`:

```
输入: distill-v2/cases/{_common,mongodb}/<entry_kind>/*.md (108 文件 / 202 case)
输出: plugins/perf-kp-sql/data/{common,mongo}/*.md (NotebookLM-friendly flat md)
路由 (按 cases 表 scope 分桶 · 等同 §2.1 bucket 推导):
  scope ∈ {arm64-*, kunpeng-*, bios-firmware}                   → data/common/kunpeng-*.md
  scope ∈ {linux-*, mem-allocator-*, tls-crypto}                → data/common/os-*.md
  scope ∈ {wt-*, mongo-config-*, mongo-runtime, mongo-query-*,  → data/mongo/*.md
           mongo-index-*, replication, sharding, ...}
```

格式 (NotebookLM 友好的简化 .md · 去 yaml + 去 case_id 表 · 保留 quote/zh + source_url):

```markdown
# {title}

**来源**: {source_url} ({source_authority})
**适用版本**: {database_version_min} - {database_version_max}

## 场景 / 症状
{scenario.description_quote 或 symptom.description_quote}
{scenario.description_zh 或 symptom.description_zh}

## 推荐 / 诊断
{recommendation.value} ← BP
或
{diagnostic_steps[].abnormal_pattern_quote / likely_causes[]} ← DF
或
{pattern_regex} + {mechanism_quote/zh} ← Flame

## 原文引用
> {recommendation.quote / mechanism_quote / ...}

## 中文转述
{rationale.zh / mechanism.zh}

## 风险
{risk.quote / risk.zh}
```

### 9.2 source 上限处理 (NotebookLM 单 notebook ≤ 50 sources)

当前 case 分布:
- common/kunpeng-*: 估 ~15 文件
- common/os-*:     估 ~40-50 文件 ← 接近上限
- mongo:           71 case · **超 50 上限**

**聚合策略**: 一个 case 一个 .md 太散且超限 · 改为**按 scope 二级聚合**:

| 输出 .md (data/mongo/) | 包含的 cases |
|---|---|
| `mongo-config.md` | scope ∈ {mongo-config-*} |
| `wt-cache.md` | scope ∈ {wt-cache, wt-eviction, wt-checkpoint} |
| `mongo-runtime-conn-pool.md` | scope ∈ {mongo-runtime · 含 connection-pool} |
| `mongo-query.md` | scope ∈ {mongo-query-*, mongo-index-*} |
| `mongo-replication.md` | scope ∈ {replication, sharding} |
| ... | |

(具体聚合粒度根据 NotebookLM 实际效果回调 · 目标:≤ 30 个 .md/notebook 留余量)

### 9.3 增量同步

cases-to-flat-md.mjs 应当幂等 + 输出文件 hash:
- distill-v2 cases 改了 → 重跑脚本 → 改动的 flat md 写出 → notebooklm-py 的 diff hash 逻辑(同事方案 Step 11)检测到变更 → 自动 source delete-by-title + 新 source add

### 9.4 触发时机

| 时机 | 动作 |
|---|---|
| plugin install 时 | `/perf-kp-sql-setup` 跑 cases-to-flat-md.mjs (若 data/{common,mongo}/ 为空) |
| distill-v2 蒸出新 case · plugin 发新版本时 | 脚本作为 build step · CI 跑一次 → commit · 客户更新 plugin 后 setup 同步 |
| 客户手动跑 `/perf-kp-sql-setup` 时 | notebooklm.mjs 内置 diff hash · 自动检测 flat md 变化 · 同步到 NotebookLM |
