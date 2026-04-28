# Phase 1 文件审核清单

> 路径全部相对于仓库根 `/Volumes/WD_BLACK/myagent/new_ohsql/ohsql-plugin/`。
> 在每行前面的 `[ ]` 打 `[x]` = 同意 · `[?]` = 需要讨论 · 划掉 = 不删/不改。

**汇总**: DELETE 75 项 (~6500+ LOC + ~5MB 数据) · MODIFY 7 项 (~3300 行 · 触点 ~500 行) · 新增 2 文件 (cases-to-flat-md.mjs + scope-to-bucket.ts) · KEEP 28 项

---

## A. DELETE — 直接删除

### A1. src/ 老引擎 (3 文件 / 3865 LOC)

```
[ ] plugins/perf-kp-sql/src/shared/legacy-checks.ts            (2115 LOC) 字面 legacy · 5 个 deprecated 模块合并体
[ ] plugins/perf-kp-sql/src/rule-engine.ts                     ( 505 LOC) v1 引擎 · 从 rules 表读 · 被 v2 取代
[ ] plugins/perf-kp-sql/src/engines/mongo/checks.ts            (1245 LOC) 自标 @deprecated Phase 3 · 已被 rules 表替代
```

### A2. tools/ 老 KB 工具链 (13 文件 / ~4796 LOC + 1 baseline)

```
[ ] plugins/perf-kp-sql/tools/kb-build.ts                      (1795 LOC) 老 KB 构建器 · 完全被新 cli-kb 替代
[ ] plugins/perf-kp-sql/tools/kb-validate.ts                   ( 813 LOC) 老 schema 校验
[ ] plugins/perf-kp-sql/tools/kb-audit.mjs                     ( 783 LOC) 老 KB 审计
[ ] plugins/perf-kp-sql/tools/audit-citations.ts               ( 631 LOC) 老 KB 引用审计
[ ] plugins/perf-kp-sql/tools/clean-rules-v5.ts                ( 329 LOC) 一次性清洗 (v5 时期)
[ ] plugins/perf-kp-sql/tools/lint-kb-quotes.mjs               ( 309 LOC) 老 quote linter
[ ] plugins/perf-kp-sql/tools/lint-kb-quotes.baseline.json     (   — ) 上面 linter 的基线
[ ] plugins/perf-kp-sql/tools/triple-gate.ts                   ( 134 LOC) 老三重校验
[ ] plugins/perf-kp-sql/tools/refresh-url-cache.mjs            ( 151 LOC) URL 缓存刷新
[ ] plugins/perf-kp-sql/tools/audit-report-grounding.mjs       ( 165 LOC) 老报告引用审计
[ ] plugins/perf-kp-sql/tools/extract-field-whitelist.mjs      (  57 LOC) 老字段白名单提取
[ ] plugins/perf-kp-sql/tools/deterministic-validator.ts       ( 228 LOC) 老 deterministic 校验
[ ] plugins/perf-kp-sql/tools/verify-real-env.ts               ( 212 LOC) 老真实环境校验 · 待重写
```

### A3. scripts/ 历史一次性脚本 (11 文件 / ~1324 LOC)

```
[ ] plugins/perf-kp-sql/scripts/apply-phase1.mjs
[ ] plugins/perf-kp-sql/scripts/apply-round2.mjs
[ ] plugins/perf-kp-sql/scripts/apply-round3.mjs
[ ] plugins/perf-kp-sql/scripts/apply-round4-cleanup.mjs
[ ] plugins/perf-kp-sql/scripts/apply-round5-aws-ec2.mjs
[ ] plugins/perf-kp-sql/scripts/apply-audit.mjs
[ ] plugins/perf-kp-sql/scripts/apply-cleaned-rules.mjs
[ ] plugins/perf-kp-sql/scripts/migrate-knowledge.mjs
[ ] plugins/perf-kp-sql/scripts/migrate-rules.mjs
[ ] plugins/perf-kp-sql/scripts/poc-llm-judge.mjs
[ ] plugins/perf-kp-sql/scripts/slim-rules-json.mjs
```

### A4. tests/ 老测试 (2 文件 · 重写后回归)

```
[ ] plugins/perf-kp-sql/tests/perf-kp-sql.test.ts              (  45 LOC) 老 KB 集成测试
[ ] plugins/perf-kp-sql/tests/render-report.test.ts            ( 188 LOC) 老报告渲染测试
```

### A5. docs/ 老 spec + 老目录 (6 文件)

```
[ ] plugins/perf-kp-sql/docs/checks-catalog.md                 老 CheckFn 目录
[ ] plugins/perf-kp-sql/docs/patterns.md                       老规则 pattern · 与新 case_pattern 不同
[ ] plugins/perf-kp-sql/docs/hotspot-workflow.md               与火焰图新 SKILL 重叠
[ ] plugins/perf-kp-sql/docs/commands-whitelist.md             老命令白名单 · 已并入 collect-cmds.json
[ ] plugins/perf-kp-sql/docs/specs/2026-04-25-perf-kp-sql-architecture.md      v1 已废
[ ] plugins/perf-kp-sql/docs/specs/2026-04-26-perf-kp-sql-architecture-v2.md   v2 中间
```

### A6. data/ 老资料 (删老文件 · 保留目录 · NotebookLM 用的新 flat md 由 cases-to-flat-md.mjs 投影生成)

```
[ ] plugins/perf-kp-sql/data/common/*.md                            老 hand-curated md(已 staged-delete 8 文件) · 删
[ ] plugins/perf-kp-sql/data/common/                                目录保留 · 新内容由 §B 新增脚本投影出
[ ] plugins/perf-kp-sql/data/mongo/*.md                             老 md (大部分 staged-delete) · 删
[ ] plugins/perf-kp-sql/data/mongo/mongo_numa_binding.json          零引用 · 删
[ ] plugins/perf-kp-sql/data/mongo/mongo_swap_and_oom.txt           零引用 · 删
[ ] plugins/perf-kp-sql/data/mongo/                                 目录保留 · 新内容同上
[ ] plugins/perf-kp-sql/data/knowledge.sqlite                       已 staged-delete · 切换后由 cli-kb 重建
[ ] plugins/perf-kp-sql/data/knowledge.sqlite-shm                   重建
[ ] plugins/perf-kp-sql/data/knowledge.sqlite-wal                   重建
```

> **决策**: data/{common,mongo}/ 目录被 NotebookLM 集成方案 (`docs/linear-wishing-trinket.md` §1) 用作 source upload 路径。
> 老的 hand-curated md 删除 · 改用 distill-v2 cases 投影出来的 flat md 放回(详见 PHASE-1-SCHEMA-AND-USAGE.md §9)。

### A7. CI 老 KB 校验 (2 文件)

```
[ ] .github/workflows/kb-reverse-check.yml                     老 KB 反向一致性 · 老 schema 没了即失效
[ ] .github/workflows/lint-kb-quotes.yml                       老 quote linter
```

### A8. 仓库根 (1 文件)

```
[ ] rules.md                                                   13775 字节 · 老规则总文档
```

### A9. 尾随清理 (Phase 1 末统一处理 · 不需要单独打勾)

```
- src/shared/index.ts 中 legacy-checks 的 re-export 行     (随 A1.shared/legacy-checks.ts 一并清)
- scripts/diagnose.mjs / scripts/kb.mjs 中对 legacy-checks 路径的字符串引用  (esbuild 重 bundle 后自然消失)
- 各 scripts/*.mjs (esbuild 产物 · 删 src 后跟随重新 bundle)
- package.json test 命令 (老 test 删后改命令)
```

---

## B. MODIFY — 不删但要改

### B1. src/ 核心模块 (6 文件 / 3300 行 · 触点 ~500 行)

```
[ ] plugins/perf-kp-sql/src/cli-kb.ts                          ( 770 LOC) **整体重写** SCHEMA_SQL + import 逻辑
                                                                          - 行 124-170: 老 SCHEMA_SQL → 新 cases 表 + JSON 列 + GENERATED FTS5
                                                                          - 行 194-210: 老 FTS5 查询
                                                                          - 行 606-607: 硬编码 legacy-checks.ts 和 engines/mongo/checks.ts 路径 · 删
                                                                          - 行 680+: importKnowledgeFromMd → 改成扫 distill-v2/cases/

[ ] plugins/perf-kp-sql/src/cli-diagnose.ts                    ( 582 LOC) 改 SQL 查询 + 删 v1 fallback
                                                                          - 行 49: import "./rule-engine.js" · 删(随 v1 一起)
                                                                          - 行 117-121: rule-engine fallback 路径 · 删
                                                                          - 行 337-340: rules 表存在检查 · 改 cases 表
                                                                          - 行 343-344: v2_checks 列检查 · 删
                                                                          - 行 348: SELECT * FROM rules · 改 SELECT cases WHERE entry_kind = ?

[ ] plugins/perf-kp-sql/src/kb-enrich.ts                       ( 175 LOC) 改 SQL · fact 注入逻辑
                                                                          - 行 71-72: SELECT FROM knowledge WHERE rule_id · 改成 cases JSON 列读取
                                                                          - 行 114-155: 7 种 fact_type 注入 · 适配新数据结构

[ ] plugins/perf-kp-sql/src/models.ts                          ( 510 LOC) Bucket→EntryKind · Rule→Case · 类型对齐

[ ] plugins/perf-kp-sql/src/report.ts                          ( 829 LOC) 适配 Case 类型 · impact-ranking 按 entry_kind

[ ] plugins/perf-kp-sql/src/rule-engine-v2.ts                  ( 433 LOC) 检查 deterministic 表达式仍可用 · 大概率小改 input 接口
```

### B2. shared/index.ts 清理 (1 文件)

```
[ ] plugins/perf-kp-sql/src/shared/index.ts                    (  27 LOC) 删 legacy-checks 的 re-export 行
```

### B3. 项目根配置 (1 文件)

```
[ ] package.json                                                test:perf-kp-sql 命令更新(老测试删了 · 改新测试)
```

### B5. 新增脚本 / 工具 (NotebookLM 集成 + flat md 投影)

```
[ ] plugins/perf-kp-sql/scripts/cases-to-flat-md.mjs            **新写** · distill-v2 cases → data/{common,mongo}/*.md 投影
                                                                  - 路由: scope → bucket → notebook 子目录
                                                                  - 聚合: 按 scope 二级分组 · 控制 ≤ 30 .md/notebook
                                                                  - 增量幂等 · 输出 hash 给 notebooklm-py 用
                                                                  - 详情 PHASE-1-SCHEMA-AND-USAGE.md §9
[ ] plugins/perf-kp-sql/src/shared/scope-to-bucket.ts           **新写** · scopeToBucket(scope: string): 1|2|3|4|5
                                                                  - cases 表 bucket 列入库 + cli-diagnose 输出 CheckResult.bucket 都用
[ ] plugins/perf-kp-sql/scripts/notebooklm.mjs                  由对接 NotebookLM 的同事写 · 我们这边只是 caller
                                                                  - 详情 docs/linear-wishing-trinket.md §8
```

### B4. 文档/模板字段名同步 (按需小改 · 不一定都改)

```
[?] plugins/perf-kp-sql/skills/perf-kp-sql/SKILL.md            描述里"44 条规则" → "202 条 case"
[?] plugins/perf-kp-sql/skills/perf-kp-sql-setup/SKILL.md      安装步骤指向新 cli-kb
[?] plugins/perf-kp-sql/templates/{diagnose-plan,fix,report}.md 字段名对齐 Case 数据 (按报告渲染逻辑确定)
[?] plugins/perf-kp-sql/templates/report.html                  同上
[?] plugins/perf-kp-sql/README.md                              简短更新一处 KB 描述
[?] CHANGELOG.md                                               加一笔 0.25.0 KB 重构
[?] plugins/perf-kp-sql/.claude-plugin/plugin.json              version 0.24.0 → 0.25.0
```

---

## C. KEEP — 明确不动

### C1. src/ 运行时模块

```
[ ] plugins/perf-kp-sql/src/cli-ssh.ts                         ( 898 LOC) SSH 采集 · 与 KB 无关
[ ] plugins/perf-kp-sql/src/cli-history.ts                     ( 248 LOC) 诊断历史
[ ] plugins/perf-kp-sql/src/baseline-store.ts                  (  97 LOC) 健康基线 · v2 引擎用
[ ] plugins/perf-kp-sql/src/engines/mongo/collector.ts         ( 366 LOC) runtime 采集
[ ] plugins/perf-kp-sql/src/shared/utils.ts                    ( 477 LOC) 通用工具
```

### C2. scripts/ esbuild bundle 产物 (16 文件 · src 改后随构建重生成)

```
[ ] plugins/perf-kp-sql/scripts/capture-flamegraph.mjs
[ ] plugins/perf-kp-sql/scripts/diagnose.mjs                   (4105 LOC bundle from src/cli-diagnose.ts)
[ ] plugins/perf-kp-sql/scripts/discover.mjs
[ ] plugins/perf-kp-sql/scripts/history.mjs
[ ] plugins/perf-kp-sql/scripts/kb.mjs                         (bundle from src/cli-kb.ts · 跟随重写)
[ ] plugins/perf-kp-sql/scripts/kb-stats.mjs
[ ] plugins/perf-kp-sql/scripts/load-history.mjs
[ ] plugins/perf-kp-sql/scripts/md-to-html.mjs
[ ] plugins/perf-kp-sql/scripts/query-kb.mjs
[ ] plugins/perf-kp-sql/scripts/render-html-report.mjs
[ ] plugins/perf-kp-sql/scripts/render-report.mjs
[ ] plugins/perf-kp-sql/scripts/render-screen-footer.mjs
[ ] plugins/perf-kp-sql/scripts/save-history.mjs
[ ] plugins/perf-kp-sql/scripts/ssh.mjs
[ ] plugins/perf-kp-sql/scripts/ssh-exec.mjs
[ ] plugins/perf-kp-sql/scripts/unescape-reports.mjs
```

### C3. tests/

```
[ ] plugins/perf-kp-sql/tests/cli-ssh.test.ts                  (  93 LOC) SSH 测试 · 与 KB 无关
```

### C4. docs/ 新设计文档

```
[ ] plugins/perf-kp-sql/docs/specs/2026-04-27-verified-web-kb-design.md     新方案文档 · 保留
```

### C5. data/ 必需资料

```
[ ] plugins/perf-kp-sql/data/collect-cmds.json                 (1MB) SSH 远程采集命令清单
[ ] plugins/perf-kp-sql/data/models/Xenova/all-MiniLM-L6-v2/   (30MB) sqlite-vec embedding 模型
```

### C6. 仓库根 / CI / 其他

```
[ ] tools/build/validate.mjs                                   marketplace validator
[ ] tools/build/validate.test.mjs                              上面的测试
[ ] .github/workflows/validate.yml                             marketplace 校验 · 与 KB 无关
[ ] README.md                                                  仓库 README
[ ] package.json / package-lock.json
[ ] .gitignore / .gitattributes
[ ] plugins/perf-kp-sql/.claude-plugin/                        plugin manifest
[ ] plugins/perf-kp-sql/.codex-plugin/                         codex manifest
[ ] plugins/cpu-flamegraph/                                    另一个 plugin · 与本次改动无关
[ ] node_modules/                                              依赖
```

---

## 拍板问题(从 PHASE-1-PLAN.md 复制 · 一并审核)

```
[ ] 工期 5.5-8 工作日接受?
[ ] data/{common,mongo}/*.md 老资料相信已被 distill-v2 cases 完整继承(无需单独存档)?
[ ] docs/specs/2026-04-27-verified-web-kb-design.md 是否要先按本方案做最后修订(把 schema 和字段名固化下来)再开工?
[ ] CHANGELOG 一句"0.25.0: KB 重构 · 老规则系统替换为蒸馏 case 体系" · plugin.json bump 0.24.0 → 0.25.0?
```
