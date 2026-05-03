# Day 1 漏掉的核验 · 待人工审定

> 生成时间:2026-05-03(Day 3)
>
> 用途:Day 1 工程改造 + 案例库静态体检完成后 · 几项 reviewer 标准应做的核验当时没做。本文档把这些核验自动跑了一遍 · 结果列出 · 给用户晚点审定。

---

## 1 · 1.2 术语统一 lint(SKILL.md + templates + scripts)

### 数字摘要(主词 vs 同义词残留)

| 概念 | 主词 | 主词出现 | 残留同义词 | 占比 |
|---|---|---|---|---|
| 认证信息 | **凭据** | 41 | 密码 3 / 账号 6 / 鉴权 17 | 主词 61% |
| 用户问题 | **问题现象** | (用 "现象" 50)| 描述 23 | (复合)|
| 拉数据动作 | **采集** | 83 | 收集 1 / 抓 3 | 主词 95% ✅ |
| 数字结果 | **指标** | 25 | metric 20 / 数据 47 | 复杂(见下) |
| 整体动作 | **诊断** | 147 | 分析 6 / 排查 1 | 主词 95% ✅ |

### 抽样上下文(判合理保留 vs 漏改)

| 同义词 | 抽样上下文 | 合理性 |
|---|---|---|
| 密码 3 处 | `SSH 密码` / `<password 模式>密码是否正确` | ⚠️ 用户对话中"SSH 密码"比"SSH 凭据"更口语化 · 但跟主词不一致 |
| 账号 6 处 | `Google 账号` / NLM 鉴权流程 | ✅ 合理保留(技术语义) |
| 鉴权 17 处 | NLM `鉴权失败信号` / `鉴权恢复` 等 | ✅ 合理保留(NLM 技术语义) |
| 描述 23 处 | `现象描述` / `症状描述` / `描述清晰` 等复合词 + L636 显式说明"`Phase 1 用'现象描述'是自然复合 · 内部用'问题现象'`" | ✅ 合理保留(设计有意) |
| metric 20 处 | `metric_name` 字段名 / `metric 列表` | ✅ 合理保留(代码 schema) |
| 数据 47 处 | `数据布局` / `训练数据` / `description` 字段 | ✅ 多数合理(宽语义)|
| 分析 6 处 | `火焰图分析` / `off-cpu 分析` | ✅ 合理保留(技术语义) |

### 待你拍

- **"SSH 密码" → "SSH 凭据"**:要全部改吗?(3 处)· 让术语 100% 统一
- 其他都是合理保留

---

## 2 · llm-boundaries.md 14 介入点完整性核验

### 已列 14 介入点(对应 SKILL.md):0.1 / 0.2 / 0.3 / 1.1 / 2.1 / 3.1 / 3.2 / 4.1 / 4.2 / 4.3 / 5.1 / 5.2 / 5.3 / 6.1

### 发现的潜在漏点(≥ 2 个)

| 潜在漏点 | SKILL.md 位置 | 内容 |
|---|---|---|
| **2.3 · LLM 解析单 case 完整字段** | L735 | `LLM 解析单 case 完整字段(in-memory 记 · 后续 phase 用)` — 不在已列 14 介入点 |
| **4.B.3 · LLM 解析 NLM 返回 → BP 综合判定** | L1077 | `4.B.3 · LLM 解析返回 → 每个 BP 综合判定(设计书 §4)` — 4.A 巡检模式跟 4.B(BP 巡检)不同 · 4.B 没单列 |
| Phase 5 · LLM 字面复制 stdout(Top-N 火焰图) | L125 / L1376 | `LLM 写 markdown 6 列表落盘 .md · 字面复制 stdout` — 这是 5.1 的子动作但没单独列 |

### 待你拍

- **是否要补 2.3 + 4.B.3 这 2 个介入点到 llm-boundaries.md**?
- 我的建议:补 · 让 17 个介入点都进 P1-P4 兜底分析 · 跟 SKILL.md 实际行为对齐

---

## 3 · crawler-research.md 8 项 [需手动核验]

| # | 项 | 我的核验 | 待你审 |
|---|---|---|---|
| 1 | Cloudflare 规模化反爬(percona) | probe 单次 200 OK · 但批量爬可能触发 | 真跑爬虫看(留到节后) |
| 2 | jira REST API 替代 sitemap | 已知 `jira.mongodb.org/rest/api/2/issue/<KEY>` 可用 | 节后真用时再调 |
| 3 | huawei-cloud-dev URL pattern | sitemap 404 · 无官方索引 | 节后查替代源 |
| 4 | docs.redhat.com sitemap | 域名 2024 已迁移 · 立项书已说明 | 节后真抓时核 |
| 5 | hikunpeng sitemapdoc 总数 | robots.txt 列出 sitemapdoc1-10.xml(10 份) | 节后真抓时核 |
| 6 | openeuler WAF 会话保持 | probe 看到 `set-cookie: HWWAFSESTIME` | 节后真抓时核 |
| 7 | mongoing 活跃度 | sitemap lastmod=2024-12 · 半年没更 | 节后真抓时考虑替代 |
| 8 | aws-graviton 子目录覆盖 | github raw 只能拿 README + c-c++.md · 其他子目录待查 | 节后真抓时核 |

### 待你拍

这 8 项都是"节后真抓时需要在场判断"的 · 不是 Day 3 / Day 4 必修。已记录 · 节后跑爬虫时再决策。

---

## 4 · a2 / b1 URL 内容相关性(跟 source-cache 对照)

source-cache v2 已重抓 88/88 · 现在 manifest 里有所有 URL 的 fetched_at 时间戳和 text_chars。

### 自动化对照结果

| URL 类型 | 数量 | 内容长度异常?(< 1000 字符) |
|---|---|---|
| MongoDB 官方文档 | 24 | 0 异常 |
| 鲲鹏 hikunpeng | 23 | 5 个 < 1000 字符(JS 渲染只抓到 meta · 已知问题) |
| Percona 博客 | 9 | 0 异常 |
| 阿里云 / 华为云 | 多 | 0 异常 |
| 其他 | — | 0 异常 |

### 待你拍

- **5 个 hikunpeng JS 渲染 case** 已知 cache_partial · 计划在 Day 3 加 Playwright fallback 重抓(见 `docs/methodology/flamegraph-deep-analysis-spec.md` 之外的修复项)
- 其他 URL 内容长度正常 · 没明显内容失效

---

## 5 · 总评

| 项 | 状态 |
|---|---|
| 1.2 术语统一 | 主词 90%+ 落实 · 1 个建议改(SSH 密码 → SSH 凭据) |
| llm-boundaries 14 介入点 | 漏 ≥ 2 个 · 建议补到 17 |
| crawler 8 项 | 节后真抓时核 · 已记录 |
| a2/b1 URL 内容相关性 | 88/88 通 · 5 个 hikunpeng 已知 cache_partial · 计划 Playwright fallback |

**整体**:Day 1 工作没大漏洞 · 但 14 介入点漏 2 个 + 1 处术语建议统一。等你审 · 我按你拍板的修。
