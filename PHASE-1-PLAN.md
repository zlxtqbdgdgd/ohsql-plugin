# Phase 1 一刀切重构方案

> 决策原则: 用户已明确 "之前的规则、知识库全不要" → 一次性切换 · 不搞双系统并存 · 不渐进。
>
> 输入: distill-v2 蒸馏 + 去重后的 202 条 case (93 BP + 96 DF + 13 Flame)
> 路径: `/Volumes/WD_BLACK/myagent/new_ohsql/docs/data/distill-v2/cases/{_common,mongodb}/<entry_kind>/`
>
> 设计参考: `plugins/perf-kp-sql/docs/specs/2026-04-27-verified-web-kb-design.md`

---

## 1. 直接删除 (死代码 + 老文档 + 老 CI)

> 全部已被新体系取代,无活引用,删后零回归风险。**总 ~6500+ LOC + ~5MB 数据**。

### 1.1 src/ 老引擎 (3865 行)

| 路径 | LOC | 死亡理由 |
|---|---:|---|
| `src/shared/legacy-checks.ts` | 2115 | 字面 "legacy",5 个 deprecated 模块合并体,无 KB 时是 fallback,新体系不需要 fallback |
| `src/rule-engine.ts` | 505 | v1 引擎 · 从 `rules` 表读 · `cli-diagnose.ts:49` 唯一 importer 一并改 |
| `src/engines/mongo/checks.ts` | 1245 | 自标 `@deprecated Phase 3 · 已被 rule-engine.ts + rules 表替代` |

**注**: `src/shared/index.ts` (27 行) re-export legacy 也要清理。`src/rule-engine-v2.ts` (433 行) 暂保留,用作 cases 表的 deterministic 评估器(看是否需小改)。

### 1.2 tools/ 老 KB 工具链 (4796 行)

| 路径 | LOC | 死亡理由 |
|---|---:|---|
| `tools/kb-build.ts` | 1795 | 老 KB 构建器 · 从 markdown rules 入 sqlite · 完全被新 cli-kb 替代 |
| `tools/kb-validate.ts` | 813 | 老 schema 校验 |
| `tools/kb-audit.mjs` | 783 | 老 KB 审计 · 检查 rule_id 一致性 |
| `tools/audit-citations.ts` | 631 | 老 KB 引用审计 |
| `tools/clean-rules-v5.ts` | 329 | 一次性清洗工具 (v5 时期) |
| `tools/lint-kb-quotes.mjs` | 309 | 老 KB quote linter (新体系用 distill-v2 的 verify-all-quotes.mjs) |
| `tools/triple-gate.ts` | 134 | 三重校验工具 · 老 schema |
| `tools/refresh-url-cache.mjs` | 151 | URL 缓存刷新 (KB 入库时已固化 source_url) |
| `tools/audit-report-grounding.mjs` | 165 | 老报告引用审计 |
| `tools/extract-field-whitelist.mjs` | 57 | 老 schema 字段白名单提取 |
| `tools/lint-kb-quotes.baseline.json` | — | 上面 linter 的基线文件 |
| `tools/deterministic-validator.ts` | 228 | 老 deterministic 校验 (rule-engine v2 自带,可不要这层) |
| `tools/verify-real-env.ts` | 212 | 真实环境验证 (Phase 1 末重写) |

### 1.3 scripts/ 历史一次性脚本 (1324 行 · 手写非 bundle)

```
apply-phase1.mjs / apply-round2.mjs / apply-round3.mjs
apply-round4-cleanup.mjs / apply-round5-aws-ec2.mjs
apply-audit.mjs / apply-cleaned-rules.mjs
migrate-knowledge.mjs / migrate-rules.mjs
poc-llm-judge.mjs / slim-rules-json.mjs
```

### 1.4 docs/ 老 spec + checks-catalog (6 份)

```
docs/specs/2026-04-25-perf-kp-sql-architecture.md           (v1)
docs/specs/2026-04-26-perf-kp-sql-architecture-v2.md         (v2 中间)
docs/checks-catalog.md      (老 CheckFn 目录)
docs/patterns.md            (老规则 pattern · 与新 case_pattern 不同)
docs/hotspot-workflow.md    (与火焰图新 SKILL 重叠)
docs/commands-whitelist.md  (老命令白名单 · 新版在 collect-cmds.json 中)
```

保留: `docs/specs/2026-04-27-verified-web-kb-design.md` (这就是新方案文档)。

### 1.5 data/ 老资料 (~5MB)

```
data/common/*.md             (旧 reference 文档 · 已并入 distill-v2 cases)
data/mongo/*.md              (同上)
data/mongo/*.json, *.txt     (旧检查参数 · 多数已 obsolete)
data/knowledge.sqlite-shm    (重建)
data/knowledge.sqlite-wal    (重建)
```

> `data/collect-cmds.json` (1MB) 保留 — 是 SSH 远程采集命令清单。
> `data/models/Xenova/all-MiniLM-L6-v2/` (30MB) 保留 — sqlite-vec embedding 模型。

### 1.6 tests/ 老测试 (2 份 · 重写后会回来)

```
tests/perf-kp-sql.test.ts    (45 行 · 旧 KB 集成测试)
tests/render-report.test.ts  (188 行 · 旧报告渲染测试)
```

保留: `tests/cli-ssh.test.ts` (93 行 · 与 KB 无关)。

### 1.7 CI 老 KB 校验 (2 份)

```
.github/workflows/kb-reverse-check.yml   (老 KB 反向一致性检查)
.github/workflows/lint-kb-quotes.yml     (老 KB quote linter)
```

保留: `.github/workflows/validate.yml` (marketplace 校验 · 与 KB 无关)。

### 1.8 仓库根

```
rules.md   (13775 字节 · 老规则总文档)
```

### 1.9 Build 产物连带删除

`scripts/*.mjs` 是 esbuild 产物。删 `src/X.ts` 时同步删 `scripts/X.mjs`(若有对应)。具体清理在 Phase 1 末用 build 工具一次重生成解决。

---

## 2. 部分重写 (架构核心 · 不删但大改)

| 路径 | LOC | 改动范围 |
|---|---:|---|
| `src/cli-kb.ts` | 770 | **整体重写** SCHEMA_SQL + import 逻辑 → 单 cases 表 + 3 JSON 列 + GENERATED VIRTUAL FTS5 + sqlite-vec embedding · 入库源换为 distill-v2/cases/ 目录扫描 |
| `src/cli-diagnose.ts` | 582 | 改 SQL 查询: `FROM rules` → `FROM cases WHERE entry_kind = ?` · 删 fallback 到 legacy-checks 的代码 (line 117-121) · 删 rule-engine.ts import |
| `src/kb-enrich.ts` | 175 | 改 SQL: `FROM knowledge WHERE rule_id = ?` → 从 `cases.diagnostic_flow_data` / `best_practice_data` JSON 列取 fact |
| `src/models.ts` | 510 | `Bucket` → `EntryKind` · `Rule` → `Case` · 数据类型对齐新 schema |
| `src/report.ts` | 829 | 适配 `Case` 类型 · 调整渲染字段 · impact-ranking 按 entry_kind |
| `src/rule-engine-v2.ts` | 433 | 检查 deterministic 表达式仍能用 · 大概率小改即可 (该引擎本身与 schema 解耦) |

---

## 3. 保留 (不动)

| 路径 | LOC | 备注 |
|---|---:|---|
| `src/cli-ssh.ts` | 898 | SSH 采集 · 与 KB 无关 |
| `src/cli-history.ts` | 248 | 诊断历史 |
| `src/baseline-store.ts` | 97 | 健康基线 (rule-engine-v2 用) |
| `src/engines/mongo/collector.ts` | 366 | runtime 采集器 |
| `src/shared/utils.ts` | 477 | 通用工具 |
| `src/shared/index.ts` | 27 | re-export · 但要清理 legacy export |
| `tools/build/validate.mjs` | — | marketplace validator (顶层 tools/) |
| `scripts/{capture-flamegraph,ssh,ssh-exec,history,save-history,load-history,discover,md-to-html,unescape-reports,render-*}.mjs` | — | runtime mjs · 多数是 esbuild 产物 · 跟随 src 重新 build |
| `templates/{diagnose-plan,fix,report}.md, report.html` | — | 报告模板 · 字段名要对齐新数据 |
| `skills/perf-kp-sql/SKILL.md` | — | 入口 skill · 文案需小改 (不再提"44 条规则") |
| `skills/perf-kp-sql-setup/SKILL.md` | — | 安装 skill · 改入库步骤(指向新 cli-kb) |
| `data/collect-cmds.json` | — | 采集命令清单 |
| `data/models/Xenova/...` | — | sqlite-vec embedding 模型 |

---

## 4. KB 数据替换流程

```
distill-v2/cases/_common/{best-practice,diagnostic-flow,flame-signature}/*.md
distill-v2/cases/mongodb/{best-practice,diagnostic-flow,flame-signature}/*.md
                                  │
                                  ▼
                  src/cli-kb.ts (新 import 逻辑)
                                  │
                ├─ 解析 yaml frontmatter (database/platform/entry_kind/source_url 等)
                ├─ 切 ## case_id 区块 → 每个 case 独立行
                ├─ 解析 | field | value | 表行 + #### quote 块
                ├─ 按 entry_kind 选 JSON 列 (diagnostic_flow_data/best_practice_data/flame_signature_data) 序列化
                ├─ 计算 sqlite-vec embedding (title + 关键 quote 拼接)
                └─ 写 cases 表 + 触发 FTS5 GENERATED 列
                                  │
                                  ▼
                    plugins/perf-kp-sql/data/knowledge.sqlite
                            (202 行 cases 表)
```

新 schema 草稿(详见 verified-web-kb-design.md):

```sql
CREATE TABLE cases (
  case_id              TEXT PRIMARY KEY,
  entry_kind           TEXT NOT NULL CHECK(entry_kind IN ('best-practice','diagnostic-flow','flame-signature')),
  database             TEXT,                      -- 'mongodb' | NULL
  platform             TEXT,                      -- 'bare' | 'linux-arm64-kunpeng' | ...
  scope                TEXT,                      -- 'linux-mm' | 'wt-cache' | ...
  title                TEXT NOT NULL,
  source_url           TEXT,
  source_authority     TEXT,                      -- official|community-canonical|...
  database_version_min TEXT,
  database_version_max TEXT,
  best_practice_data   TEXT,                      -- JSON · entry_kind=best-practice 时填
  diagnostic_flow_data TEXT,                      -- JSON · entry_kind=diagnostic-flow 时填
  flame_signature_data TEXT,                      -- JSON · entry_kind=flame-signature 时填
  fts_text             TEXT GENERATED ALWAYS AS (...) VIRTUAL,
  embedding            BLOB                       -- sqlite-vec 384 维
);

CREATE INDEX idx_bp ON cases(scope) WHERE entry_kind = 'best-practice';
CREATE INDEX idx_df ON cases(database, scope) WHERE entry_kind = 'diagnostic-flow';
CREATE INDEX idx_fl ON cases(scope) WHERE entry_kind = 'flame-signature';

-- FTS5 trigram 外挂表
CREATE VIRTUAL TABLE cases_fts USING fts5(case_id UNINDEXED, fts_text, tokenize='trigram');
```

---

## 5. 工期估算

| 步骤 | 工期 |
|---|---:|
| 死代码批删 (1.1-1.9) + 修复 importer | 0.5 天 |
| `cli-kb.ts` 重写 (新 SCHEMA + 入库 + embedding) | 1.5-2 天 |
| 灌 202 条 + 数据完整性核对 | 0.5 天 |
| `cli-diagnose.ts` 查询改写 + 删 fallback 路径 | 1 天 |
| `kb-enrich.ts` + `models.ts` 适配 | 0.5-1 天 |
| `report.ts` 适配新数据结构 | 0.5 天 |
| 重写 2 个测试 + 修 CI | 0.5-1 天 |
| 端到端 mongo 实例验证 | 0.5-1 天 |
| esbuild 全量重 bundle + 提交 | 0.5 天 |
| **总计** | **5.5 - 8 工作日** |

---

## 6. 风险 + 注意事项

1. **scripts/*.mjs build 产物管理**: 删 `src/X.ts` 后必须同步删 `scripts/X.mjs`,否则会有 stale runtime entry。建议 Phase 1 结束统一 esbuild 重 bundle 一次。
2. **knowledge.sqlite 不在 git** (.gitignore 内): 入库 `cli-kb.ts` 跑出的 sqlite 是 release artifact,要确保新 KB 在 plugin install 阶段能从 `data/cases-bundle/` 重建,或者把入好库的 sqlite 直接 commit。需确认现有发布流程。
3. **rule-engine-v2.ts 的兼容性**: 它是 v1 包了 v2 的 wrapper。删 v1 后 v2 是否能直接用 cases 数据?需要在 Phase 1 内验证(可能要小改 input 接口)。
4. **distill-v2 的 reference 文档**: NULL 字段说明在 `distill-v2/reference/inferred-references-*.md`,**不入 KB**,作为外部审计资料保留(给后续争议复核用)。
5. **snapshots/**(HTML/TXT 合计 ~200MB+)**绝不入 plugin 包**,留 distill-v2 仓本地。
6. **CHANGELOG.md** + **README.md** + **rules.md**: README 简单更新即可,rules.md 直接删,CHANGELOG 加一笔大版本(0.24.0 → 0.25.0 minor bump · 流程/结构变更)。

---

## 7. 拍板问题

1. 工期 5.5-8 天,**接受?** 是否要进一步缩减(放弃部分测试覆盖)?
2. **要不要单独存档 `data/{common,mongo}/*.md` 的内容**? 还是相信已经被 distill-v2 cases 完整继承了?
3. **`docs/specs/2026-04-27-verified-web-kb-design.md` 要不要先按本方案做最后修订**(把 schema/字段名固化下来)再开工?
4. **CHANGELOG 怎么写?** 一句"0.25.0: KB 重构 · 老规则系统替换为蒸馏 case 体系" 够不够?
