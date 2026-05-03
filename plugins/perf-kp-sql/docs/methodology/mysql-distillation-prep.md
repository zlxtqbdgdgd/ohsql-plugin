# MySQL 案例蒸馏前置准备

> 节后第 1 周(5/6 ~ 5/9)启动 MySQL 案例库蒸馏的工作前置文档 ·
> 仅做"选源 / 改 prompt / 评测复用"3 件事 · 节后真跑。
>
> 上游材料:
> - 当前 MongoDB 案例库 · `plugins/perf-kp-sql/data/cases/CASES.md`(109 case · DF + BP + Flame 三库 schema 已稳)
> - 爬虫调研 · `plugins/perf-kp-sql/docs/methodology/crawler-research.md`(top 8 源 · 工具链 fetch+readability+turndown)
> - 蒸馏 prompt 改进清单 · `plugins/perf-kp-sql/docs/methodology/distillation-prompt-improvements.md`(A-F 6 大改造点)
> - 配置基线 · `plugins/perf-kp-sql/config/crawler-research-sources.json`(10 候选源 + probe 数据)
> - 评测工具链 · `data/quality-reports/`(a1 字段完整度 / a2 URL 可达 / a3 引用对照 / a4 阈值合理 / a6 质量评分卡 / 正交性粗精筛)

---

## 1 · 引言

### 1.1 为什么要做 MySQL 蒸馏

当前 109 case 全部围绕 MongoDB / 鲲鹏 / 通用 Linux · MySQL 维度 0 case。
节后 MySQL 蒸馏的核心目的不是"把 case 数堆到 200" · 而是 **验证蒸馏方
法论是否跨 engine 通用** —— 同一爬虫工具链 + 同一蒸馏 prompt 模板 +
同一评测体系 · 跑 MongoDB 出 109 · 跑 MySQL 出 N · 看产出差距能否用
"engine-specific 字段"解释 · 不能解释的差距才是方法论缺陷。

### 1.2 跟 MongoDB 蒸馏的对照

| 维度 | MongoDB(已跑) | MySQL(节后跑) |
|---|---|---|
| 工具链 | fetch + readability + jsdom + turndown(crawler-research §6) | **同** |
| 蒸馏 prompt 模板 | distillation-prompt-improvements §A-F 改进版 | **同模板 · MySQL 特性微调(见 §3)** |
| 评测体系 | a1 / a2 / a3 / a4 / a6 + orthogonality(粗 + 精) | **同 · 主词从 mongodb 改 mysql** |
| 案例库容量 | 109 case | 期望 50-100 case(首轮 30-50 起步) |
| 主语言 | 中英双语 · 中文优先 | **同** |

期望结论(节后 Day 4 横向对比时验证):

- 通用部分(prompt + 评测工具)直接复用 ≥ 70%
- engine-specific 部分(schema 字段 + 关键词)拆 ≤ 30%
- 蒸馏方法论可以宣告 v1 跨 engine 通用 · 写进对外的方法论综述

### 1.3 跟"领导反馈 2.2"的对应

(领导反馈 2.2 指"案例库要扩到 MySQL · 验证方法论通用性") · 本文档
是节后落地这条反馈的工作单 · 4 天内可见交付。

---

## 2 · MySQL 性能调优源调研(候选 11 个)

筛选维度:**信任等级**(vendor-primary > official > vendor-blog >
community-canonical > community-blog) + **可达性**(robots.txt /
sitemap / 反爬) + **跟 MongoDB 共用情况**(共用源可一次抓两 engine 用)。

### 2.1 候选源对照表

| # | 源 | 类型 | 信任等级 | 主语言 | 跟 MongoDB 共用? | 抓取策略 | 推荐? |
|---|---|---|---|---|---|---|---|
| 1 | dev.mysql.com/doc | MySQL 官方文档 | vendor-primary | en | 否 · MySQL 专属 | sitemap.xml + 主页起爬 · 限速 1 req/2s | **强烈推荐** |
| 2 | percona.com/blog | Percona 博客(MySQL 调优实战) | vendor-blog | en | **是** · MongoDB 蒸馏已用 | 真 Chrome UA + 1 req/5s · Cloudflare 注意 | **强烈推荐** |
| 3 | mariadb.com/kb · mariadb.org | MariaDB Knowledge Base | vendor-primary | en/zh | 否 | sitemap · 1 req/2s | **推荐** |
| 4 | oracle.com/mysql · blogs.oracle.com/mysql | Oracle MySQL 官方博客 | vendor-primary | en | 否 | 看 robots.txt · 主页起爬 | **推荐** |
| 5 | mysql.taobao.org | 阿里 MySQL 内核月报 | community-canonical | zh | 否 | sitemap 不全 · 月报目录页直枚举 · 限速 1 req/3s | **强烈推荐** |
| 6 | bugs.mysql.com | MySQL Bug Tracker | official | en | 否 | 列表页分页参数 · 无登录可读 · 1 req/2s | 推荐(限范围) |
| 7 | github.com/mysql/mysql-server | 源码 + issues + release notes | vendor-primary | en | 否 | GitHub API + GITHUB_TOKEN · 5 req/s | 推荐(看 release notes) |
| 8 | help.aliyun.com / support.huaweicloud.com(RDS for MySQL · GaussDB(for MySQL)) | 云厂商 MySQL 调优文档 | vendor-blog | zh | 部分 | 各家 sitemap · 1 req/3s | 推荐 |
| 9 | pingcap.com/zh/blog · docs.pingcap.com | TiDB(MySQL 协议兼容)技术博客 | vendor-blog | zh/en | 否(协议兼容 · 内核不同) | sitemap OK · 1 req/2s | **备用**(仅取 protocol/SQL 优化部分 · 不取 storage 部分) |
| 10 | tech.meituan.com / tech.ctripcorp.com / 微信"高可用架构"等 | 中文工程博客 | community-blog | zh | 部分 | 微信文章难抓(WAF + JS) · 优先 meituan/ctrip 直站 · 1 req/5s | 备用 |
| 11 | stackoverflow.com(mysql tag) + dba.stackexchange.com | Q&A 高赞答案 | community-canonical | en | 否 | Stack Exchange API + key · 30 req/s | 备用(只取 ≥ 50 票答案) |

### 2.2 source-by-source 评注

- **dev.mysql.com/doc**(#1) — MySQL 8.0 / 5.7 / 8.4 三版本独立文档树 ·
  路径含版本号(`/doc/refman/8.0/`) · 蒸馏时 `version_range` 字段直接
  从 URL 提取 · 是最稳的"配置型 + 叙述型混合"源 · 必入。
- **percona.com/blog**(#2) — MongoDB 蒸馏已用过 · 同源同工具栈直接复
  用 Cloudflare 规避策略 · MySQL 关键词 `/blog/?s=mysql` · 调优类博文
  约 200+ 篇 · 蒸馏漏斗后预期保留 30-50 篇。
- **mariadb.com/kb**(#3) — MariaDB 是 MySQL 5.5 fork · 部分参数一致 ·
  部分(galera / aria storage)是 MariaDB-only · 蒸馏时必须区分 · 见
  §3.D 分支区分。
- **oracle.com/mysql**(#4) — Oracle 官方博客 · 内容偏 NDB Cluster /
  MySQL HeatWave / 企业版特性 · 跟开源 community edition 部分场景不
  适用 · 蒸馏时 `applicable_edition` 字段必填(`community` / `enterprise`)。
- **mysql.taobao.org**(#5) — 阿里 MySQL 内核月报 2014-至今 · 中文 · 深
  度极高(InnoDB / binlog / 复制内核分析) · 但目录页 layout 不规则 · 探针
  优先级最高的"待手动核验"项。
- **bugs.mysql.com**(#6) — 类似 jira.mongodb.org 的角色 · 但 bugs.mysql
  .com 匿名可读 · 蒸馏时取 status=Verified + Severity ≥ S2 的 perf 类
  bug · 当 root_cause 证据使用。
- **github.com/mysql/mysql-server**(#7) — 蒸馏只用 release notes
  (release tag description) + WL(Worklog)关联 issue 的 perf-impact 段
  落 · 不读源码本身。
- **云厂商 RDS / GaussDB**(#8) — 中文 · 跟阿里月报互证 · 但内容偏"产
  品文档" · 配置项跟原生 MySQL 有出入(被云厂商重命名) · 蒸馏时
  `parameter_origin` 字段标 `cloud-vendor-renamed` 以免误用。
- **pingcap**(#9) — TiDB 是 MySQL 协议兼容 · 不是 MySQL 内核 · 仅取
  "MySQL 协议侧 / SQL 优化器侧"内容 · TiKV/RocksDB 部分忽略 · 否则
  蒸馏出来的 case 会污染 MySQL 案例库。
- **中文工程博客**(#10) — 信噪比差(同 MongoDB 调研结论 dev.to) ·
  优先取 meituan / ctrip / 携程 · 微信文章本轮放弃。
- **Stack Exchange**(#11) — 节后第 1 周不取 · 留作 v2 扩展 · 因 Q&A
  类内容跟当前蒸馏 schema(scenario/diagnostic_steps/likely_causes)不
  对齐 · 需要二次格式转换。

### 2.3 推荐 top 8 MySQL 源(节后 5/6 上午用)

| 排名 | 源 | 一句话理由 |
|---|---|---|
| 1 | **dev.mysql.com/doc** | MySQL 一手文档 · sitemap + 版本路径稳 · 必抓 |
| 2 | **percona.com/blog** | 同 MongoDB 复用 · 调优实战最丰富 · 必抓 |
| 3 | **mysql.taobao.org** | 阿里内核月报 · 中文深度最高 · 必抓 |
| 4 | **mariadb.com/kb** | 内核 fork · 跟 MySQL 互证(同参数差异点)· 蒸馏综述 §6.1 数据三角 |
| 5 | **oracle.com/mysql + blogs.oracle.com/mysql** | 官方博客 · 补特性级(WL / GA notes)· 必抓 |
| 6 | **bugs.mysql.com** | 类比 mongodb-jira · 取 Verified perf bug 当 root_cause 证据 |
| 7 | **云厂商 RDS / GaussDB 文档**(阿里 / 华为) | 中文 + 云上调优实战 · 跟原生 MySQL 互证 |
| 8 | **github.com/mysql/mysql-server**(release notes only) | 版本 GA notes + perf-related WL · 0 反爬 |

不进 top 8 的:**pingcap**(协议兼容不等于内核 · 易污染) ·
**中文工程博客**(微信难抓 + 信噪比差) · **Stack Exchange**(schema
不对齐)— 节后第 1 周一律不抓。

---

## 3 · 蒸馏 prompt 改造点

基于 distillation-prompt-improvements §A-F 6 大通用改进 · 加上 MySQL 特
性的 4 项额外改造(A 复用通用版 · B-F 通用版可直接套):

### 3.A · 数值化阈值约束(同 MongoDB 通用版)

直接套 distillation-prompt-improvements §A · MySQL 特定阈值示例:

```
✓ innodb_buffer_pool_hit_rate < 99%
✓ replication_lag_seconds > 60
✓ slow_query_count_per_min > 100
✓ innodb_log_waits > 0
✓ Binlog_cache_disk_use > 0
✓ Threads_running >= cpu_cores
```

### 3.B · MySQL-specific schema 字段调整

新增 5 个 MySQL 专属字段(写进 xlsx schema · 写进
`_build-cases-from-xlsx.mjs` 的字段映射):

| 字段 | 取值范围 | 必填? | 用途 |
|---|---|---|---|
| `mysql_version_range` | `5.7` / `8.0` / `8.4` / `5.7-8.0` / `all` | 是 | 区分大版本(参数语义会变 · 如 8.0 default authentication plugin) |
| `mysql_branch` | `oracle-mysql` / `percona-server` / `mariadb` / `aws-aurora` / `cloud-vendor`(阿里 RDS / 华为 GaussDB) / `all` | 是 | 防止 MariaDB-only 参数被误归为 MySQL |
| `storage_engine` | `innodb` / `myisam` / `aria` / `tokudb` / `rocksdb` / `n/a` | 是 | 引擎隔离 · 大部分调优是 InnoDB-specific |
| `replication_topology` | `none` / `async` / `semi-sync` / `group-replication` / `mha` / `orchestrator` | 否 | 复制类 case 必填(对照 MongoDB replica-set 字段) |
| `applicable_edition` | `community` / `enterprise` / `cloud-managed` / `all` | 否 | 仅 vendor-blog #4(Oracle MySQL 官方博客)和云厂商源(#8)的 case 用 |

跟 MongoDB schema 大部分字段保持一致(symptom_category / case_pattern
/ entry_kind / scenario_description_quote / recommendation_value /
adaptability_notes 全复用) · 改动面 ≤ 8% · 可程序化校验。

### 3.C · MySQL 版本范围标注

每个 case 必须显式 `mysql_version_range` · 取值规则:

- 从 source URL 提取(如 `dev.mysql.com/doc/refman/8.0/...` → `8.0`)
- source 跨多版本时取并集(如 `5.7-8.0`)
- 完全通用(如 InnoDB 内存模型) · 设 `all`

无版本信息的 source(博客没标版本)· **强制 fallback 到 source 发布日
期推断**:

- 2017 之前 → 默认 `5.7-`
- 2018-2022 → 默认 `5.7+8.0`
- 2023+ → 默认 `8.0+8.4`
- inferred_fields 加入 `"mysql_version_range"`(显式标推断)

### 3.D · MySQL 分支区分(防混淆)

`mysql_branch` 字段的判定规则:

| source 域名 | 默认 branch |
|---|---|
| `dev.mysql.com` / `bugs.mysql.com` / `blogs.oracle.com/mysql` / `github.com/mysql/mysql-server` | `oracle-mysql` |
| `percona.com/blog` 涉及 Percona Server 特性(PFS+/audit_log_format=JSON)时 | `percona-server` |
| `percona.com/blog` 通用调优(buffer pool / slow log) | `oracle-mysql`(Percona Server 完全兼容时) |
| `mariadb.com` / `mariadb.org` 涉及 galera / aria / spider | `mariadb` |
| `mariadb.com` 通用调优 + MariaDB 5.5/10.x 早期分支 | `oracle-mysql`(完全兼容时) |
| 阿里云 RDS / 华为 GaussDB(for MySQL) | `cloud-vendor` |

prompt 必须强制 LLM 在抽取时识别 source 中的 **branch-specific 关键
词**:

```
✗ MariaDB-only 关键词被归为 oracle-mysql:
  - galera_cluster_*, aria_*, sequence engine, spider engine, columnstore
✗ Percona-only 关键词被归为 oracle-mysql:
  - percona_*, ps_setup_*, query_response_time_*, userstat
✗ AWS Aurora-only 关键词被归为 oracle-mysql:
  - aurora_*, db_cluster_parameter_group, writer_instance
```

LLM 自检规则:`mysql_branch=oracle-mysql` 但 case 涉及上述任一关键词 ·
**返工**(改为对应 branch 或拆 case)。

---

## 4 · 评测复用(基于 Day 2/3 工具链)

| 评测项 | 工具脚本 | MySQL 适配方式 | 复用率 |
|---|---|---|---|
| **a1 字段完整度** | `scripts/_build-cases-from-xlsx.mjs` 内置校验 + `field-integrity-report.json` | 扩 5 个 MySQL 字段(§3.B) · 其余 schema 通用 | 92% |
| **a2 source_url 可达** | `scripts/check-case-urls.mjs` | 0 改动 · URL 检查跟 engine 无关 | 100% |
| **a3 引用对照(LLM-as-Judge)** | `data/quality-reports/a3-citation-alignment*.json` 的 prompt | 同工具 · prompt 主词从 `MongoDB` 改 `MySQL` · F 改进项(quote_language)继续生效 | 95% |
| **a4 阈值合理性** | a4-threshold-rationality 工具 | 同工具 · MySQL 主词替换 · 经验阈值库扩 InnoDB / binlog 类 | 90% |
| **a6 整体质量评分卡** | a6-quality-scorecard 工具 | 同工具 · 评分卡 5 维度复用(rigor / clarity / adaptability / completeness / actionability) | 100% |
| **正交性粗筛** | `orthogonality-coarse-tags.json` 工具 | 改动:**跨 engine 粗筛** · 把 MongoDB 109 case 的 tag 跟 MySQL N case 的 tag 求交 · 看是否有"主题相同 engine 不同"的对(如 `buffer-pool-hit-rate` mongo 跟 mysql 都有) | 85% |
| **正交性精判** | `orthogonality-fine-judgment.json` 工具 | 改动:加 cross_engine_pair 关系类型(对照新关系) · 不删除 mirror_case_id / clarify_distinction | 80% |

### 4.1 跨 engine 正交性新增维度

`orthogonality-fine-judgment.json` 引入新 relation:

| relation | 含义 | 处理建议 |
|---|---|---|
| `cross_engine_pair` | 同 root cause + 同 abnormal pattern · 但 engine 不同(mongo vs mysql) | 不合并 · 加双向 `cross_engine_case_id` 字段 · 写报告时一起呈现 |
| `cross_engine_concept_only` | 概念相通但实现差异大(如 wt cache eviction vs innodb buffer pool LRU) | 不合并 · 仅在方法论文章引用时并列 |
| (沿用)`duplicate` / `df_bp_mirror` / `clarify_distinction` | 同 engine 内部 | 同已有规则 |

期望发现:

- `cross_engine_pair` ≥ 5 对 → 蒸馏方法论 + 评测体系 v1 跨 engine 通用 · 可以宣告
- `cross_engine_pair` < 2 对 → 要么 MySQL 案例库太小 · 要么 MongoDB 案例库主题偏窄 · 都不能立刻宣告通用

---

## 5 · 跟 MongoDB 案例库的横向对比(节后 Day 4 输出)

### 5.1 对照实验设计

```
两路并行(同 prompt v2 · 同评测工具):
路径 A(已跑) MongoDB 109 case → a1/a2/a3/a4/a6 + 正交性 → 报告 A(已有)
路径 B(节后) MySQL N case    → a1/a2/a3/a4/a6 + 正交性 → 报告 B
横向对比 = 报告 A vs 报告 B + 跨 engine 正交性
```

### 5.2 对比维度

| 对比项 | MongoDB 基线 | MySQL 期望 | 用途 |
|---|---|---|---|
| **case 总数** | 109 | 50-100(首轮 30-50 起步) | 蒸馏漏斗效率横向比对 |
| **DF/BP/Flame 分布** | 96 / 10 / 3(粗估) | 期望 6:3:1 | 看 entry_kind 占比是否 engine-invariant |
| **a4 rigor 维度** | 6.33(改进前) → 7.5+(改进后) | 期望 ≥ 7.5(直接用 v2 prompt) | 看 §3.A 阈值约束在 MySQL 是否同样有效 |
| **a6 clarity 维度** | 6.83 → ≥ 7.8(改进后) | 期望 ≥ 7.8 | 看 §D distinguishes_from 在 MySQL 是否同样有效 |
| **主题覆盖** | sharding / replication / WT cache 占大头 | innodb buffer pool / binlog / slow query / replication 占大头 | 看 engine-specific 主题分布差异 |
| **跨 engine 正交对** | n/a | ≥ 5 对 cross_engine_pair | 验证方法论通用性的硬指标 |

### 5.3 期望发现 + 不期望发现

**期望发现**(YES → 写进对外方法论文章):

1. 蒸馏方法论(prompt + 漏斗 + 评测)跨 engine 通用
2. §3.A / §B / §F 改进项跨 engine 同样有效(a4 rigor / a6 quality 双升)
3. 跨 engine 正交性能识出 ≥ 5 对"主题相通"的 case

**不期望发现**(NO → 暴露方法论缺陷 · 立刻进 v2 改进):

1. MySQL 蒸馏漏斗 N₃ 末端 case 数 < 30 → 漏斗参数(深度 / 关键词)对中
   英文混杂 + 配置型源不通用 · 必须拆 prompt
2. a4 rigor < 7.0 但 prompt 没改 → §3.A 数值化阈值在 MySQL 失败 ·
   要么 InnoDB 阈值文化跟 MongoDB 不同(更多定性) · 要么 prompt 没适配
3. cross_engine_pair < 2 对但 100 个 case 都跑了 → 案例库 engine 隔离
   过强 · 蒸馏综述 §5 总结去重在跨 engine 失败

---

## 6 · 节后 Day 1-3 执行 checklist(5/6 ~ 5/9)

### 5/6(周二) · 选源 + 改 prompt

- [ ] 上午 · 从 §2 候选 11 个里确认 top 8 · 跑 `scripts/probe-crawler-source.mjs` · 输出
      `data/quality-reports/mysql-source-probe.json` 基线
- [ ] 上午 · 在 `config/crawler-research-sources.json` 加 mysql 源 6-8
      个(注 trust_tier / topics / probe_urls)
- [ ] 下午 · 基于 distillation-prompt-improvements §A-F + 本文 §3.B-3.D
      产出 `prompts/mysql-distillation.md`(prompt 文件 · 不入仓库根 ·
      按 perf-kp-sql plugin 内部约定放 `plugins/perf-kp-sql/prompts/`)
- [ ] 下午 · 改 `scripts/_build-cases-from-xlsx.mjs` 加 5 个 MySQL 字段
      映射(§3.B) · 不破坏 MongoDB 已有字段

### 5/7(周三) · 跑爬虫 · 抓文档

- [ ] 全天 · 跑 fetch + readability + turndown 链路 · 抓 top 8 源
- [ ] 用 `scripts/cache-source-urls.mjs` 落地缓存(同 MongoDB 流程)
- [ ] 落库前 robots.txt 二次确认(percona-blog 大量抓必须留意 Cloudflare)
- [ ] 输出原始 markdown 到 `data/raw-mysql-sources/<source-id>/*.md`(本
      地路径 · 不入库 · 跟 `~/.<app>/` 同性质 · `.gitignore` 已加)

### 5/8(周四) · 跑蒸馏 + 体检

- [ ] 上午 · LLM 蒸馏 · 走 v2 prompt · 输出 30-50 个 MySQL case 到 xlsx
- [ ] 上午 · `scripts/_build-cases-from-xlsx.mjs` 转 markdown · 落到
      `data/cases/CASES.md` 末尾(标注 MYSQL 段)和 `INDEX.md`
- [ ] 下午 · 跑 a1(field-integrity) + a2(check-case-urls) · 出
      `data/quality-reports/a1-mysql.json` / `a2-mysql.json`
- [ ] 下午 · 跑 case 总数 / DF-BP-Flame 占比统计 · 跟 MongoDB 对照

### 5/9(周五) · 评分 + 横向对比

- [ ] 上午 · 跑 a3(citation-alignment) + a4(threshold-rationality) +
      a6(quality-scorecard) v2 评分 · 输出
      `data/quality-reports/a{3,4,6}-mysql.json`
- [ ] 上午 · 跑正交性粗筛 + 精判(含跨 engine pair · 见 §4.1)· 输出
      `orthogonality-cross-engine.json`
- [ ] 下午 · 写横向对比报告 ·
      路径 `docs/methodology/mysql-vs-mongo-distillation.md` ·
      跟本文 §5.2 表格对齐
- [ ] 下午 · 走完代码评审(全局 CLAUDE.md "代码评审"节:作者 ≠ 评审者
      模型) · review 通过才宣告 Day 4 完成

### 6.1 关键交付物清单(节后第 1 周末)

| 交付物 | 路径 | 验收标准 |
|---|---|---|
| MySQL 蒸馏 prompt v2 | `plugins/perf-kp-sql/prompts/mysql-distillation.md` | 包含 §A-F + §3.B-3.D 全部改造 |
| MySQL 案例库(MD 段) | `plugins/perf-kp-sql/data/cases/CASES.md`(MYSQL 段) | ≥ 30 个 case |
| MySQL 体检 v1 报告 | `data/quality-reports/a{1,2,3,4,6}-mysql.json` | a4 rigor ≥ 7.0 · a6 整体 ≥ 7.0 |
| 跨 engine 正交性报告 | `data/quality-reports/orthogonality-cross-engine.json` | cross_engine_pair ≥ 5 对 |
| 横向对比方法论文章 | `docs/methodology/mysql-vs-mongo-distillation.md` | 200-400 行 · 给出"通用率 %"结论 |

---

## 7 · 风险

| # | 风险 | 等级 | 应对 |
|---|---|---|---|
| 1 | **mysql.taobao.org 目录页 layout 不规则** · 可能要登录或被反爬 | 高 | 5/6 上午探针失败立刻降级:用 google `site:mysql.taobao.org` 列 URL 后单页直抓 · 不依赖目录页穷举 |
| 2 | **percona-blog 规模化抓 Cloudflare 升级 challenge** | 中 | 已有 Playwright 兜底(crawler-research §6) · 单日抓 ≤ 50 篇 · 触发 challenge 立即停 |
| 3 | **蒸馏 prompt 在 MySQL 上配置型源占比过高 · §B narrative 分发失败** | 中 | dev.mysql.com 大量是参数清单 · 但每个参数页通常带 description 段(narrative 段) · 蒸馏 LLM 显式按 sub-section 切片(不按 page 切片) · 失败 case ≥ 5 个时立即重写 §B 分发规则 |
| 4 | **mysql_branch 误判** · 把 MariaDB-only / Percona-only 参数归为 oracle-mysql | 中 | §3.D 给 LLM 自检关键词列表(galera_*/aria_*/percona_*/aurora_*) · 抽样人工核 5%(全局 CLAUDE.md 强制) |
| 5 | **a4 阈值经验库扩展不及时** · MongoDB 阈值知识在 InnoDB 不适用 | 中 | a4 工具的"经验阈值列表"加 InnoDB 段(buffer_pool_hit_rate / log_waits / row_lock_waits 等) · 5/8 下午跑 a4 前预先扩 |
| 6 | **跨 engine 正交性误判过多** · MongoDB WT cache vs MySQL InnoDB buffer pool 容易被精判 LLM 误判为 duplicate | 低 | 精判 prompt 加"跨 engine pair **不**视作 duplicate · 仅 cross_engine_pair / cross_engine_concept_only" · 见 §4.1 |
| 7 | **xlsx → markdown 构建脚本字段映射漏改** · 5 个 MySQL 字段没映射 · case 落库丢字段 | 低 | 5/6 下午改 `_build-cases-from-xlsx.mjs` 时同步加单测 · 先红再绿(全局 CLAUDE.md "改 bug 前先写失败测试")|

### 7.1 风险 top 3(优先关注)

1. **mysql.taobao.org 抓不到** —— 中文最高深度源 · 失则案例库丢质量
2. **percona-blog Cloudflare** —— MongoDB 蒸馏经验也踩过 · 但 MySQL 文章
   多 4-5 倍 · 触发概率更高
3. **配置型 vs 叙述型分发在 dev.mysql.com 失败** —— MySQL 参数文档比
   MongoDB 更"配置清单化" · §B 分发规则可能阈值不对 · 直接影响 a6 quote
   完整度

---

## 8 · 落地检查清单(给节后蒸馏者)

5/6 开工前 · 蒸馏者(LLM 操作员)请逐条勾选:

- [ ] 已读完本文 §1-§7
- [ ] 已读 distillation-prompt-improvements.md §A-F 6 大改进
- [ ] 已读 crawler-research.md §2 工具选型 + §5 抓取策略
- [ ] §2.3 top 8 源已 probe 过 · 出 `mysql-source-probe.json`
- [ ] config/crawler-research-sources.json 已加 mysql 6-8 源
- [ ] prompt v2 已加 §A-F 通用 + §3.B-3.D MySQL 专属
- [ ] xlsx schema + `_build-cases-from-xlsx.mjs` 已扩 5 个 MySQL 字段
- [ ] a3/a4 工具的关键词从 `MongoDB` 改 `MySQL`(主词替换 · 工具重跑过)
- [ ] orthogonality 精判 prompt 已加 cross_engine_pair 类型
- [ ] 抽样 5% 人工核(全局 CLAUDE.md 强制)已排好评审者(异家模型)

---

## 9 · 反偏倚提醒

本文档作者(perf-kp-sql 方法论 agent · Opus)与节后蒸馏执行 agent 同
为 LLM · 模型自评 LLM 产出有"同型偏盲点"风险:

- 本文 §3 改造点可能仍漏 LLM 共性盲点(MySQL 训练语料中 InnoDB
  权重高 · 但长尾 storage engine 如 RocksDB / TokuDB 可能被低估)
- **强制要求**:本文档落地前 · 至少另一家模型(Sonnet / Codex / 其他)
  做一轮 review · 评审通过判据见全局 CLAUDE.md 代码评审节
- 节后蒸馏完成后 5% 抽样人工校准必跑 · 不能只信 LLM-as-Judge

---

> **文档结束** · 节后 5/6 ~ 5/9 跑完 · 5/9 下午写
> `docs/methodology/mysql-vs-mongo-distillation.md` 横向对比报告 ·
> 本文 §5.2 / §5.3 期望与实测对齐后 · 才能宣告蒸馏方法论 v1 跨 engine 通用。
