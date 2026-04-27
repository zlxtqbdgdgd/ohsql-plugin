# 诊断报告模板(v0.3.2 · 兑现三亮点 · 业界对齐)

本文件是 SKILL.md Step 4.2 写入 `~/.perf-kp-sql/reports/perf-kp-sql-<engine>-<TS>.md` 时
**必须参照的结构**。LLM 以 `report_input` JSON 为输入,按下列顺序渲染 markdown。

业界对照:
- Oracle ADDM 按 `X% impact / 秒数` 排序 Top Findings + 独立 Informational 区
- MongoDB Atlas Performance Advisor 给 Index + Schema + 样本查询,按 Impact 排序
- Percona PMM Advisor 按 Configuration/Performance/Query/Security 分 4 类

我们对这三家的取交集再扩展:**metadata → Top → Full → 验证命令 → 引用 → Artifacts**。

---

## 报告结构(7 段)

### 1. Metadata card

圆角(`╭─ ─╮` / `╰─ ─╯`)· 终端可能 CJK 宽度不稳,若视觉错位用 ASCII `+---+`。

```
╭─ perf-kp-sql metadata ───────────────────────────────╮
│ Engine: mongo                                        │
│ Target: 127.0.0.1:2222                               │
│ DB endpoint: 127.0.0.1:27017                         │
│ DB version: 7.0.31                                   │
│ Arch: aarch64                                        │
│ Vendor: kunpeng (若识别到 · 否则省略此行)            │
│ OS: openeuler 22.03 (若识别到)                       │
│ Generated: 2026-04-21T15:51:07Z                      │
│ Summary: critical 1 · warning 4 · info 16 · ok 12    │
╰──────────────────────────────────────────────────────╯
```

### 2. Top Issues(前 5 条 · impact-ranked · 必须体现三亮点)

每条 **7 行** 渲染。**亮点 ①**(ARM64/Kunpeng)靠 `scope` 标记 · **亮点 ②**(证据硬
约束)靠 `rationale.mechanism/trade_offs/when_to_deviate` 展开 · **亮点 ③**(诊断-
验证闭环)靠 `surfaceable_only` 标记 + 后面的验证命令段协同。

```markdown
## Top Issues

1. **[critical][P1][10.0] THP 透明大页** — aarch64 · MongoDB 7.0
   - 影响: p95 延迟 +25% · 置信度 高
   - Action: `echo never > /sys/kernel/mm/transparent_hugepage/enabled`
   - Why: 当前 THP=always,不符合 MongoDB 7.0 期望,会放大 khugepaged 延迟抖动 [参考1][参考2]
   - 机制: khugepaged 周期性扫描 4K 页合并 2M 大页时短暂持 mm->page_table_lock,
     mongod WT page fault 必须等待;CPU sys% 飙 15-30%,p99 跳到百毫秒级 [参考3]
   - 代价: 关 THP 对 Mongo 本身无损(WT 不依赖大页);有其他 big-memory workload
     (如 JVM)时那些 workload TLB miss 略升,但对 Mongo 是纯收益 [参考1]
   - 例外: madvise 模式在 Mongo 7.0 官方也接受(mongod 不 madvise · 实用等价 never) [参考2]
   - 版本适配: 规则适配 MongoDB 5.0-8.0 · 当前 7.0.5 ✓
   - 参考:
     https://www.mongodb.com/docs/manual/administration/production-notes/
     https://www.hikunpeng.com/document/detail/zh/kunpengdbs/.../
     https://www.hikunpeng.com/document/.../

2. **[warning][P2][5.0] DB 二进制 LSE 指令** — aarch64 · [BIOS/固件建议 若 surfaceable_only=true]
   - 影响: 吞吐 QPS -25% · 置信度 高
   - Action: 换装带 LSE 的 mongod 构建(Percona ARM64 RPM / 自编译 -moutline-atomics)
   - Why: mongod 二进制未发现 LSE opcode,ARM64 高竞争场景吞吐可能受限 25-40% [参考4]
   - 机制: objdump -d 中 cas/ldadd/swp 系列 opcode 计数 0 说明编译器没带
     -march=armv8.1-a · 即使 CPU 支持 LSE 也退化成 ldxr/stxr 循环 [参考4][参考5]
   - 代价: 换带 LSE 的构建需 rolling restart (分钟级) · 换来 25-40% 吞吐增益 [参考4]
   - 例外: 受限环境只能装发行版 repo 二进制 · LD_PRELOAD glibc atomics 补丁是弱替代 [参考5]
   - 版本适配: 规则适配 全 MongoDB 版本 · 本机 7.0.5 ✓
   - 参考:
     https://www.hikunpeng.com/document/detail/zh/kunpengdevtoolkit/porting/.../
     https://github.com/aws/aws-graviton-getting-started/blob/main/c-c%2B%2B.md
```

**"影响" 行渲染对照表**(LLM 查表生成)· 对齐 Oracle ADDM `Impact % of DB time`:

| impact.metric | 中文名 | 常见 unit | 正值意味 |
|---|---|---|---|
| `latency_p95_ms` | p95 延迟 | percent(%) 或 ms | + 表示变差 |
| `throughput_qps` | 吞吐 QPS | percent 或 qps | - 表示变差(故渲染 `-25%` 而非 `+25%`)|
| `cache_miss_rate` | 缓存未命中率 | percent | + 表示变差 |
| `db_time_pct` | DB 时间占比 | percent | + 表示占用 DB time 比例 |
| `wasted_bytes` | 浪费字节 | bytes(KB/MB/GB)| 值直接表达磁盘浪费 |
| `connection_util_pct` | 连接池利用率 | percent | + 表示接近饱和 |

**confidence 中文映射**:`high=高` · `medium=中` · `low=低`

**硬约束**:
- `scope` 有 `arch=arm64` 或 `vendor` 非空时 · 标题行必须追加 ` — <arch> · <vendor>` 让 ARM64 亮点可见
- 若 rule 有 `rationale` 结构化字段 · 必须展开 3 行(机制 / 代价 / 例外) · 不展开就浪费了亮点 ②
- 若 rule 有 `surfaceable_only: true` · 标题行附 ` [BIOS/固件建议]` · 让 DBA 知道这条不能 shell 执行(亮点 ③ 闭环边界)
- `rationale.summary` 已融入 `Why:` 行或 `description` · 不单独再打,避免重复
- Top Issues 只展示 `report_input.top_issues`(前 5 条 · 已过滤 info/ok)
- **版本适配行(v0.3.5 新增)**:若 rule 有 `engine_version_min/max` 字段 · 渲染 `版本适配: 规则适配 <engine> <min>-<max> · 当前 <detected_version> ✓`;无版本字段则 `规则适配 全 <engine> 版本 · 本机 <detected_version> ✓`;无当前版本(discover 未跑)则只展 `规则适配 <engine> <min>-<max>`
- **多 citation 展开(v0.3.5 · v0.4.2 简化)**:`参考:` 行下展开**所有** `citations[]` · **只打 URL**(v0.4.2 去掉 `[鲲鹏原厂]` / `[MongoDB 官方]` / `[社区]` 等中文 tier label · URL 本身即可识别来源 · label 冗余) · 按 tier 排序(vendor-primary > official > community)
- **角标强制(v0.3.8 零幻觉硬约束)**:`Why / 机制 / 代价 / 例外` 四行必须在句末追加 `[参考N]` · N 来源于本规则 `citations[]` 中某条 URL · 全报告 URL 去重(`Map<url, N>` · 按 Top Issue 1→5 顺序分配 · 同 URL 复用同编号)· N 的定义统一写在文末 `## 参考` 段 · 若某句找不到对应 citation URL 支撑 · 该句**必须改写或删除** · 禁止保留无源陈述

**v0.4.2 决定 · 不再使用中文 tier 标签**:

`inferAuthority()` 返回的 `tier` 字段(vendor-primary / official / community / vendor-blog)仍然
用于**内部排序**(Top Issue 里 citations 按 tier 优先级展开) · 但**不再作为中文前缀**渲染到
输出文字里。原因:

- URL 本身就能表明来源(`hikunpeng.com` 自证是鲲鹏原厂 · `mongodb.com/docs` 自证是 MongoDB 官方)
- 中文 label 视觉上太吵 · 还不如一行干净 URL
- 用户点开 URL 就能核 · 不需要 agent 二次贴标签

**旧版保留逻辑**(仅作代码内部 tier 分类用 · 不露给用户):

| source.tier | 匹配条件 | 用途 |
|---|---|---|
| `vendor-primary` | `hikunpeng.com` / `amperecomputing.com` / `aws.amazon.com/.../graviton` | 排序优先级 1 |
| `official` | `mongodb.com/docs` / `dev.mysql.com/doc` / `redis.io/docs` | 排序优先级 2 |
| `vendor-blog` | `percona.com/blog` / `mongodb.com/blog` / `huaweicloud.com` | 排序优先级 3 |
| `community` | 其他 | 排序优先级 4 |

### 3. Full findings(折叠 · 按 bucket 分组)

```markdown
## Full findings

<details>
<summary>Bucket 1 · OS / ARM64 / 平台 ({count} rules)</summary>

- [critical] os.thp.kernel_mode — THP=always 不符合 MongoDB 7.0 期望
- [warning] os.vm.swappiness — swappiness=60 偏高
- [warning] arm64.lse.db_binary_opcodes — mongod 未发现 LSE opcode
- [ok] arm64.lse.cpu_flag — atomics flag 已启用
- [info] kunpeng.cpu.governor — 规则仅适用 Kunpeng ARM64,已跳过
...

</details>

<details>
<summary>Bucket 2 · Mongo config / memory</summary>
...
</details>
```

buckets:1 Resources / 2 Config / 3 Design / 4 Query / 5 Runtime。
info 和 ok 都归入对应 bucket 折叠块内 · 不单独开 section · 避免过多 collapsible。

### 4. 参考资料汇总(引用聚合 · v0.3.5 改进)

```markdown
## 参考资料汇总

| 权威等级 | 来源 | 被引规则 | URL |
|---|---|---|---|
| 鲲鹏原厂 | BoostKit MongoDB 调优指南 §2.3 | os.thp.kernel_mode, mongo.wt.cache_hit | https://www.hikunpeng.com/.../ |
| 鲲鹏原厂 | ARM64 性能故障处理手册 §5.1 | os.thp.kernel_mode | https://www.hikunpeng.com/.../ |
| 上游官方 | MongoDB Production Notes · Disable THP | os.thp.kernel_mode | https://www.mongodb.com/docs/manual/administration/production-notes/ |
| 上游官方 | MongoDB WiredTiger Storage Engine | mongo.wt.cache_hit, mongo.wt.cache_vs_memory | https://www.mongodb.com/docs/manual/core/wiredtiger/ |
| 厂商文档 | AWS Graviton · C/C++ LSE | arm64.lse.db_binary_opcodes | https://github.com/aws/aws-graviton-getting-started/... |

合计 X 篇权威资料 · Y 条规则引用 · 全部 URL 可追溯到章节级
```

**排序规则**:
1. 按"权威等级"分组:`鲲鹏原厂 > 上游官方 > 厂商文档 > 社区博客`
2. 组内按 `used_by_rules.length` DESC(被多条规则引用的在前)
3. "权威等级"字段由 `source.tier` + `source.url` 映射(见 Top Issues § 权威标签映射表)

### 5. 验证命令(亮点 ③ · 诊断-验证闭环)

遍历 `top_issues[].recommendations[]` · 只渲染 `fix_cost="trivial"` 且 `verifiable !== false`:

```markdown
## 验证命令(待 --with-verify)

spec § 3.7 MVL 最小闭环 · 当前仅展示命令占位 · runner 实装排 Phase 2:

| # | 修复命令 | 验证命令 | 期望结果 |
|---|---|---|---|
| 1 | `echo never > /sys/kernel/mm/transparent_hugepage/enabled` | `cat /sys/kernel/mm/transparent_hugepage/enabled` | 首字段含 `[never]` |
| 2 | `sysctl -w vm.swappiness=1` | `cat /proc/sys/vm/swappiness` | `1` |
| 3 | `systemctl enable --now irqbalance` | `systemctl is-active irqbalance` | `active` |

若 `report_input.top_issues` 全是 `restart_engine` 或 `schema_migration`(非 trivial):
> 本次诊断未产生 trivial 级建议 · 无可自动验证的修复命令。
> restart_engine / schema_migration 类改动必须人工 change-window 执行,本 agent 不自动 verify。
```

### 6. Artifacts

```markdown
## Artifacts

- OS 采集: `~/.perf-kp-sql/tmp/perf-kp-sql-os-<TS>.txt`
- DB 采集: `~/.perf-kp-sql/tmp/perf-kp-sql-mongo-db-<TS>.txt`
- 诊断 JSON: diagnose.mjs stdout(已消费)
- FixExperiment 模板(若存在): `~/.perf-kp-sql/experiments/<TS>/*.json`
- 火焰图(若 Step 3.3 执行): `~/.perf-kp-sql/flame/<TS>.svg`
```

### 7. 参考(v0.3.8)

**LLM 不写此段** · 由 `scripts/render-report.mjs` 直接渲染(主路径) · 或 `scripts/render-footnotes.mjs` post-process 自动注入(兜底) · 扫 Top Issues 里的 `[参考N]` 角标 + 参考资料汇总表第 N 行 · 生成 `[参考N] <url>`。

**LLM 的责任**:只在 Top Issues 的 Why/机制/代价/例外 句末挂 `[参考N]` 即可 · N 对应"参考资料汇总"表里**行号**(1-based · tier 分组内顺序)。

### 8. Report Changelog

```markdown
## Report Changelog

- v0.3.8 · 2026-04-23 · 零幻觉硬约束:Top Issue 句末 [参考N] 角标 + 文末参考段
- v0.3.5 · 2026-04-22 · HTML 报告 + threshold_display 字段
- v0.3.2 · 2026-04-21 · rationale 结构化渲染 · scope 可见化 · 验证命令区块
- v0.3.1 · 2026-04-20 · Gold Standard schema 全量迁移
- v0.1 · initial
```

---

## 格式红线(跨段适用)

- **不要**把 Top Issues 复制到 Full findings 重复渲染 · Top 是 Full 的"置顶摘录"
- **不要**自己画表格分隔线(markdown `| --- |` 够了 · 不要 ASCII `─` 画)
- `impact_score` 用 1 位小数显示(如 `10.0` · 不要 `10`)避免被误当枚举
- `scope.arch=arm64` 是 ARM64 亮点的触发条件 · 非 arm64 的 rule 不加 scope 标签
- `rationale` 四字段 `summary/mechanism/trade_offs/when_to_deviate` 是硬约束,
  任一缺失已被 CI `validate-rules.mjs --file` 拦截 · 渲染时安全假设都存在
- 全 OK 场景(无 warning/critical):Top Issues 段改为 "未发现异常 · 实例运行健康",
  验证命令段改为 "本次无需修复"

## 报告持久化

完整报告由 LLM 通过 `Write(file_path, content)` 写到:
```
~/.perf-kp-sql/reports/perf-kp-sql-<engine>-<TS>.md
```
**不要**在控制台复制全文 · 只打 SKILL.md Step 4.3 的 `━━ 诊断完成 ━━` footer 4 行即可。
