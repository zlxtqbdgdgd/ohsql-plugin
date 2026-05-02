# 可验证网页知识库设计（Claim-First）

> ⚠️ **归档说明 (archived · 2026-04-27)** — 本 spec 是早期 SQLite 网页知识库方案的设计稿 · 与当前 perf-kp-sql 案例库(markdown CASES.md)体系不在同一架构上。
> 题目里的"知识库"指 SQLite-backed 可验证网页声明库 · 与 perf-kp-sql 0.42.0 起的"案例库 (case library)"是两件事 · 故未参与 KB→CASE rename。
> 文件名保留 `kb-design.md` 是因为本设计的"可验证网页知识库"是其名词主题 · 不是 perf-kp-sql 案例库的旧称。

**日期**：2026-04-27  
**范围**：性能诊断知识库离线构建  
**适用背景**：官方来源为主，允许少量高质量社区经验；允许摘要，但每句摘要必须可回指证据并通过校验  
**核心目标**：从网页构建一个本地 SQLite 知识库，并给出一条可重建的信任链，避免把“模型写得像真”误当成“知识可靠”

---

## 1. 设计动机

当前问题不在于“怎么做出一个能搜的向量库”，而在于“怎么定义一条知识有资格进入库”。  
如果没有明确的准入制度，知识库即使能检索、能回答、能引用 URL，也仍然可能混入：

- 模型对原文的过度总结
- 证据不足但语气过强的建议
- URL 已变更但知识仍假装是当前有效
- 社区经验与官方事实混层
- 原文支持不足的阈值、命令、默认值

因此本设计不假设当前 `ohsql-plugin` 的知识已经可靠，而是定义一套从零重建可信知识库的离线方案。

---

## 2. 目标与非目标

### 2.1 目标

- 从网页离线构建本地知识库，落地到 SQLite + 向量检索
- 来源分层：`official` 为主，`community` 为辅
- 允许摘要，但摘要的每一句都必须绑定证据
- 每条正式知识都必须通过规则校验 + 独立语义校验
- 查询时优先命中“已验证 claim”，而不是临时从原文生成自由回答
- 支持 URL 变更、内容漂移、历史版本回溯

### 2.2 非目标

- 不追求实时联网回答
- 不接受“仅凭模型训练知识”入库
- 不把 URL 作为知识主键
- 不把社区经验与官方事实混成同一可信度
- 不把“有链接”当成“已验证”

---

## 3. 方案概述

本设计采用 **Claim-First** 方案：

- 原始网页先保存为快照
- 从快照中切出可引用的 `Evidence Span`
- 模型只基于指定证据生成单句 `Claim`
- 每条 claim 都必须绑定 1..N 个证据片段
- 只有通过校验的 claim 才能进入正式知识层

这意味着系统的正式知识单元不是“整页摘要”，而是：

> 一句可独立成立的摘要句 + 支撑它的证据片段 + 版本信息 + 校验结论

这样做的原因是：  
向量检索库真正需要可审计的不是“网页”，而是“被系统承认的结论”。

---

## 4. 信任模型

知识库分为 4 层，只有前两层是数据基础，第三层中的 `verified` claim 才能直接参与正式回答。

### 4.1 Source Snapshot

保存网页抓取快照，不做知识判断。

字段建议：

- `source_id`
- `source_tier`: `official` / `community`
- `publisher`
- `site_name`
- `original_url`
- `canonical_url`
- `fetched_at`
- `http_status`
- `etag`
- `last_modified`
- `content_sha256`
- `simhash`
- `snapshot_html_path`
- `snapshot_text_path`
- `license_note`

### 4.2 Evidence Span

从快照中切出的可引用证据片段，是 claim 的唯一合法依据。

字段建议：

- `evidence_id`
- `source_id`
- `version_id`
- `section_title`
- `chunk_index`
- `char_start`
- `char_end`
- `text`
- `text_sha256`
- `token_count`
- `embedding`

### 4.3 Verified Claim

正式知识层。每条 claim 是一句可独立成立的摘要句。

字段建议：

- `claim_id`
- `claim_text`
- `claim_type`: `fact` / `recommendation` / `constraint` / `warning`
- `source_policy`: `official_only` / `official_plus_community`
- `support_level`: `direct` / `synthesized`
- `status`: `candidate` / `verified` / `rejected` / `stale`
- `confidence`
- `created_at`
- `verifier_version`

### 4.4 Claim Evidence Link

claim 与证据的绑定表。

字段建议：

- `claim_id`
- `evidence_id`
- `relation`: `supports` / `contrasts` / `example_of`
- `coverage`: `full_sentence` / `partial`
- `verbatim_overlap_score`
- `nli_verdict`: `entails` / `neutral` / `contradicts`
- `review_state`

### 4.5 核心规则

- 没有 `Evidence Span` 的 claim，不能进入 `verified`
- `community` 来源不能单独支撑高风险结论
- 涉及阈值、命令、参数名、默认值的 claim，至少需要一条 `official` 证据直接支持
- claim 可以是摘要，但不能引入证据中不存在的新实体、新数字、新因果链

---

## 5. 准入规则

入库不是“模型生成完就写库”，而是 6 道闸门：

### 5.1 来源闸门

只允许白名单站点进入，例如：

- `mongodb.com`
- `source.wiredtiger.com`
- `hikunpeng.com`

社区站点必须单独白名单，并标记为 `community`。

### 5.2 快照闸门

抓取后必须保存：

- 原始 HTML
- 正文抽取文本
- 响应头
- 内容哈希

没有快照，不允许继续处理。

### 5.3 证据闸门

必须先切 `Evidence Span`，再做 claim 生成。  
不允许先写总结，再反向拼引用。

### 5.4 规则校验闸门

用确定性规则拦截高风险错误：

- claim 含数字，但证据中没有对应数字，拒收
- claim 含命令、参数名，但证据中没有对应 token，拒收
- claim 语气为强建议或默认结论，但证据只是弱描述，降级或拒收

### 5.5 语义校验闸门

用独立模型或轻量 NLI 做支持性判断：

- `entails`：允许进入 `verified`
- `neutral`：进入人工复核或保留为 `candidate`
- `contradicts`：直接拒收

### 5.6 版本一致性闸门

claim 绑定的是 `source version`，不是裸 URL。  
源站后续变更时，旧 claim 不删除，但可能转成 `stale`。

---

## 6. 为什么这套能防幻觉

本方案不把“模型是否谨慎”当作主防线，而是把“知识是否具备证据资格”变成系统约束。

系统对每条知识都能回答 4 个问题：

1. 这句话来自哪一版网页？
2. 这句话对应哪几个原文片段？
3. 这些片段是否足以支持这句话？
4. 这句话是否掺入了证据里没有的信息？

如果任一问题回答不了，这条知识就不算正式知识。

换句话说，系统不是问“模型觉得像不像真”，而是问“这句话有没有准入资格”。

---

## 7. SQLite 结构

建议分成“原始层”和“知识层”。

```sql
CREATE TABLE source_document (
  doc_id TEXT PRIMARY KEY,
  source_tier TEXT NOT NULL CHECK (source_tier IN ('official','community')),
  publisher TEXT NOT NULL,
  site_name TEXT,
  original_url TEXT NOT NULL,
  canonical_url TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','redirected','gone','blocked'))
);

CREATE TABLE source_version (
  version_id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES source_document(doc_id),
  fetched_url TEXT NOT NULL,
  final_url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  etag TEXT,
  last_modified TEXT,
  content_sha256 TEXT NOT NULL,
  simhash TEXT,
  title TEXT,
  snapshot_html_path TEXT NOT NULL,
  snapshot_text_path TEXT NOT NULL,
  extractor_version TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE url_alias (
  alias_url TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES source_document(doc_id),
  version_id TEXT REFERENCES source_version(version_id),
  alias_type TEXT NOT NULL CHECK (alias_type IN ('redirect','canonical','historical','manual')),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE evidence_span (
  evidence_id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES source_version(version_id),
  section_title TEXT,
  chunk_index INTEGER NOT NULL,
  char_start INTEGER NOT NULL,
  char_end INTEGER NOT NULL,
  text TEXT NOT NULL,
  text_sha256 TEXT NOT NULL,
  token_count INTEGER,
  embedding BLOB
);

CREATE VIRTUAL TABLE evidence_span_vec USING vec0(
  evidence_id TEXT PRIMARY KEY,
  embedding FLOAT[384]
);

CREATE VIRTUAL TABLE evidence_span_fts USING fts5(
  evidence_id UNINDEXED,
  text,
  section_title,
  tokenize='trigram'
);

CREATE TABLE claim (
  claim_id TEXT PRIMARY KEY,
  claim_text TEXT NOT NULL,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('fact','recommendation','constraint','warning')),
  support_level TEXT NOT NULL CHECK (support_level IN ('direct','synthesized')),
  source_policy TEXT NOT NULL CHECK (source_policy IN ('official_only','official_plus_community')),
  status TEXT NOT NULL CHECK (status IN ('candidate','verified','rejected','stale')),
  confidence REAL NOT NULL,
  created_at TEXT NOT NULL,
  verifier_version TEXT,
  notes TEXT
);

CREATE TABLE claim_evidence (
  claim_id TEXT NOT NULL REFERENCES claim(claim_id),
  evidence_id TEXT NOT NULL REFERENCES evidence_span(evidence_id),
  relation TEXT NOT NULL CHECK (relation IN ('supports','contrasts','example_of')),
  coverage TEXT NOT NULL CHECK (coverage IN ('full_sentence','partial')),
  verbatim_overlap_score REAL,
  nli_verdict TEXT CHECK (nli_verdict IN ('entails','neutral','contradicts')),
  reviewer_decision TEXT CHECK (reviewer_decision IN ('accept','reject','needs_review')),
  PRIMARY KEY (claim_id, evidence_id)
);

CREATE TABLE ingestion_run (
  run_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  config_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','succeeded','failed'))
);
```

### 7.1 结构解释

- `doc_id` 表示“文档身份”
- `version_id` 表示“某次抓到的具体版本”
- `claim` 不直接存 URL，而是通过 `claim_evidence -> evidence_span -> source_version` 回溯
- 查询命中 claim 后，可以天然拿到证据、版本、URL 与抓取时间

---

## 8. 离线构建流水线

建议按 8 步运行：

### 8.1 discover

输入：

- 种子 URL
- 站点白名单
- 抓取规则

输出：`source_document` 候选。

### 8.2 fetch

抓取页面并记录：

- 原始 URL
- 最终 URL
- 响应头
- HTML
- 正文抽取文本
- `etag` / `last-modified`
- `content_sha256` / `simhash`

### 8.3 normalize

正文清洗：

- 去导航、页脚、cookie banner
- 保留标题、章节层次、代码块、表格文本
- 生成稳定 chunk

### 8.4 dedupe

两层去重：

- 严格重复：`content_sha256`
- 近重复：`simhash`

### 8.5 extract evidence

把正文切成可引用证据片段，写入 `evidence_span`。

### 8.6 generate claims

让模型只基于指定 evidence 生成单句 claim。

生成约束：

- 一句一条
- 不得引入证据外的新实体、新数字
- 输出结构化 JSON

### 8.7 verify claims

先规则校验，再 NLI 或独立模型校验，再决定：

- `verified`
- `candidate`
- `rejected`

### 8.8 index

只给 `verified` claim 和全部 evidence 建索引。  
查询主路由优先 claim，回溯证据。

---

## 9. URL 与内容漂移维护

不维护“claim -> url”，而维护：

- `claim -> evidence`
- `evidence -> version`
- `version -> doc_id`
- `doc_id <-> current canonical url`

这样 URL 变了，claim 仍然有效。

### 9.1 巡检策略

1. 先发条件请求  
   优先 `If-None-Match`，其次 `If-Modified-Since`

2. 若 `304`  
   不新建版本，只更新巡检时间

3. 若 `200`  
   重新计算 `sha256` 和 `simhash`

### 9.2 版本判定

- `sha256` 相同：同版本
- `simhash` 很接近：新版本，但同文档
- `301/302` 且正文高度相似：记录到 `url_alias`
- 完全不同：新文档或人工复核

### 9.3 claim 失效判定

当新版本出现后：

- 原 evidence 文本仍存在且语义一致：claim 保持 `verified`
- 原 evidence 缺失或语义不再支持：claim 变 `stale`
- 新版本明确反驳旧 claim：旧 claim 变 `rejected` 或 `stale`

---

## 10. 查询设计

查询时不要直接以网页切片作为最终答案，建议两阶段：

### 10.1 检索 `verified claim`

返回：

- `claim_text`
- `confidence`
- `source_tier`
- `supporting_evidence[]`

### 10.2 证据展开

每条 evidence 返回：

- `final_url`
- `fetched_at`
- `section_title`
- `evidence_text`
- `version_id`

最终回答格式建议强制带证据脚注：

```json
{
  "answer": "...",
  "claims": [
    {
      "claim_id": "c_123",
      "claim_text": "...",
      "support": [
        {
          "url": "...",
          "fetched_at": "2026-04-27",
          "section_title": "...",
          "evidence_text": "..."
        }
      ]
    }
  ]
}
```

若命中的只有 `community`，回答中必须显式标注“社区经验，非官方结论”。

---

## 11. 最小可行校验集

第一版不必把系统做全，但下面 5 条必须落地：

1. 所有 claim 必须绑定至少 1 条 evidence
2. 含数字的 claim，evidence 中必须出现相同数字
3. 含参数名或命令的 claim，evidence 中必须出现相同 token
4. 独立 NLI 判定必须是 `entails`
5. 查询输出必须携带 URL + `fetched_at` + evidence 文本

只要这 5 条落地，系统就已经明显强于“普通向量库 + 摘要生成”。

---

## 12. 对现有 `ohsql-plugin` 的意义

这套设计的价值不在于证明“当前库已经可靠”，而在于给出一条可重建的信任链：

- 旧知识可以继续存在，但只应视为“待审材料”
- 新知识按本设计重建
- 任意一条知识都能继续追问：
  - 来自哪一版网页
  - 原文是哪一段
  - 为什么这段足以支持这句话
  - 如果网址改了，现在对应的是哪个文档身份

这才是“可验证知识库”的工程定义。

---

## 13. 推荐实施顺序

建议分 3 个阶段推进：

### Phase 1 · 信任底座

- 建 `source_document` / `source_version` / `evidence_span`
- 实现快照保存、正文抽取、hash 与 simhash
- 建立来源白名单与来源分级

### Phase 2 · Claim 准入

- 实现 claim 生成器
- 实现数字、命令、token 的规则校验
- 接入 NLI 或独立模型判定 `entails`
- 只允许 `verified` claim 进入正式层

### Phase 3 · 漂移维护与查询

- 实现条件请求巡检
- 实现版本迁移与 `stale` 判定
- 实现 claim-first 查询接口
- 在回答中强制输出证据与时间戳

---

## 14. 结论

本设计的核心不是“把网页塞进向量库”，而是：

> 把“知识是否有资格入库”定义成一套可执行、可回溯、可复验的规则。

只要系统坚持下面三点，就能从流程上抑制幻觉：

- 正式知识单元是 `claim + evidence`，不是自由摘要
- 文档身份依赖 `doc_id + version_id`，不是裸 URL
- 没有证据资格的句子，不允许进入正式知识层

对于一个以性能诊断为目标的知识库，这比单纯提升召回率更重要，因为误导性的“看起来很专业”的错误结论，代价通常高于“不知道”。
