# Phase 1 重构执行 Plan

> 一刀切 · 不双系统并存 · 不渐进改造。
> 输入: PHASE-1-PLAN.md (策略) + PHASE-1-AUDIT-CHECKLIST.md (清单) + PHASE-1-SCHEMA-AND-USAGE.md (设计)
> 输出: 7 个 milestone · 5.5-8 工作日 · 每个 milestone 出口必须 typecheck 通过 + 测试通过(若已有)

---

## 路线图 (依赖)

```
M0 准备 (0.5d)
  ↓                                 (M1 / M2 并行 · 不互相依赖)
  ├──→ M1 清洗 distill-v2 (0.5d) ───────────────┐
  └──→ M2 死代码批删 (0.5d)                      │
            ↓                                    │
       M3 新 KB schema + 入库 (1.5-2d) ←─────────┘
            ↓
       M4 cli-diagnose 查询路径 (1-1.5d)
            ↓
       M5 kb-enrich + models + report (1d)
            ↓
       M6 NotebookLM 集成 + flat md 投影 (1d)
            ↓
       M7 测试 + CI + 收尾 (0.5-1d)
```

---

## M0 · 准备 (0.5 天)

**入口**: 用户拍板 PHASE-1-AUDIT-CHECKLIST.md (打勾 / 标 ?)

**动作**:
1. 创建 git branch: `feat/phase-1-kb-rebuild`
2. 备份关键状态:
   - `cp -R plugins/perf-kp-sql/data data.backup-pre-phase1-<ts>` (如果还有有用东西)
   - 当前 commit hash 记录到 plan 末尾
3. 细化 `scopeToBucket()` 映射表(确认所有 cases.scope 值都能归到 1-5):
   - 跑 `grep -hoE '^\| scope \| [^|]+\|' distill-v2/cases/.../*.md | sort -u` 列所有 scope 实际值
   - 对每个 scope 显式分配 bucket 1-5 · 写到 src/shared/scope-to-bucket.ts 的常量里
4. 把 NotebookLM 同事拉个对齐会(15 分钟):确认 `notebooklm.mjs` 接口契约稳定 + 我们这边只调 `--op query-batch` 和 `--op query`

**出口**:
- branch 已建
- scope→bucket 映射表 fully enumerated
- 与 NotebookLM 同事对齐 confirmed

---

## M1 · 清洗 distill-v2 (0.5 天) · 与 M2 并行

**入口**: M0 出口

**动作**:
1. **改 distill-v2 PROMPT-*.md v5** (3 份):
   - `docs/data/distill-v2/PROMPT-cases.md`
   - `docs/data/distill-v2/PROMPT-best-practice.md`
   - `docs/data/distill-v2/PROMPT-flame-distillation.md`
   - 删 "NULL 字段必须给 ref 锚点 + 写到 reference/" 一套规则
   - 改成 "NULL 字段写一句简短 reason 即可"
2. **写清洗脚本** `docs/data/distill-v2/scripts/strip-reference-trail.mjs`:
   - regex: `/(\| \w+ \| .*?NULL.*?) · 见 reference\/inferred-references-[^)]+\)/g`
   - 替换:`$1)` (去掉 ` · 见 reference/...` 整段尾巴)
   - 跑 distill-v2/cases/{_common,mongodb}/<entry_kind>/*.md 全量清洗
3. **归档 reference/**:
   - `mv reference/inferred-references*.md reference/_archived-pre-notebooklm/`
   - reference/_pending/ 不动(还有用)
4. **重跑** `node scripts/export-kb-to-xlsx.mjs && node scripts/export-kb-to-jsonl.mjs`:
   - xlsx 行数应当不变(93/96/13 = 202)
   - 内容更干净

**出口**:
- 108 个 cases md 不再出现 `· 见 reference/...` 引用
- reference/ 目录已归档
- xlsx/jsonl 时间戳更新但行数 = 202

---

## M2 · 死代码批删 (0.5 天) · 与 M1 并行

**入口**: M0 出口

**动作**: 按 PHASE-1-AUDIT-CHECKLIST.md A 区清单逐项 `git rm`:

| 清单 | 文件数 | 说明 |
|---|---:|---|
| A1 src/ 老引擎 | 3 | shared/legacy-checks.ts + rule-engine.ts + engines/mongo/checks.ts |
| A2 tools/ 老 KB 工具链 | 13 | kb-build / kb-validate / kb-audit 等 |
| A3 scripts/ 一次性脚本 | 11 | apply-* / migrate-* / poc-llm-judge / slim-rules-json |
| A4 tests/ 老测试 | 2 | perf-kp-sql.test.ts + render-report.test.ts (M7 重写) |
| A5 docs/ 老 spec | 6 | v1/v2 architecture + checks-catalog/patterns/hotspot-workflow/commands-whitelist |
| A6 data/{common,mongo}/*.md + knowledge.sqlite-* | ~30 | 保留目录 · M6 重新填 |
| A7 CI 老 KB yml | 2 | kb-reverse-check + lint-kb-quotes |
| A8 仓库根 rules.md | 1 | |

修破坏性 import:
- `src/shared/index.ts` 删 legacy-checks re-export 行
- `src/cli-diagnose.ts:49` 删 `import "./rule-engine.js"`
- `src/cli-diagnose.ts:117-121` 删 rule-engine fallback 路径(整段 catch block)
- `src/cli-kb.ts:606-607` 删 legacy-checks / engines/mongo/checks 路径硬编码
- `package.json` test 命令暂时改成 `echo "tests skipped during phase 1"` (M7 恢复)

**出口**:
- `npx tsc --noEmit` 通过 (无 import error)
- git diff --stat: ~6500 LOC 删除
- `node scripts/diagnose.mjs --help` 至少不 crash (虽然内部还跑不通)

---

## M3 · 新 KB schema + 入库 (1.5-2 天)

**入口**: M1 + M2 都完成

**动作**:
1. **写** `src/shared/scope-to-bucket.ts`(M0 表落地)
2. **重写** `src/cli-kb.ts`:
   - 替换 SCHEMA_SQL → 单 cases 表 + 4 张子表 + cases_fts (FTS5 trigram) + cases_vec (sqlite-vec)
   - 重写 importKnowledgeFromMd():
     - 扫 distill-v2/cases/{_common,mongodb}/<entry_kind>/*.md
     - 解析 yaml frontmatter (js-yaml)
     - 切 ## case_id 区块
     - 抓 `| field | value |` + `#### quote` 块
     - 装配 entry_kind JSON (best_practice_data / diagnostic_flow_data / flame_signature_data)
     - 提取扁平字段 (param_names / keywords / inferred_fields / links)
     - 推 bucket via scopeToBucket
     - 算 sqlite-vec embedding (transformers all-MiniLM-L6-v2)
     - 一个事务批量 INSERT
   - 加 lint: PRIMARY KEY 唯一 + JSON schema 校验 + path-guard (database ↔ 物理路径) + scope ↔ database 配对
3. **跑** `node scripts/kb.mjs build --from /Volumes/WD_BLACK/.../distill-v2/cases --out data/knowledge.sqlite`
4. **抽样验证**:
   ```sql
   SELECT entry_kind, COUNT(*) FROM cases GROUP BY entry_kind;
   -- 期望: best-practice=93, diagnostic-flow=96, flame-signature=13

   SELECT bucket, COUNT(*) FROM cases GROUP BY bucket;
   -- 期望: 1+2+3+4+5 = 202

   SELECT COUNT(*) FROM case_param_names;
   -- 期望: 350-500

   SELECT COUNT(*) FROM cases_fts;
   -- 期望: 202

   SELECT COUNT(*) FROM cases_vec;
   -- 期望: 202
   ```

**出口**:
- knowledge.sqlite 8-12MB · cases 表 202 行 · 5 个 bucket 全有 case
- FTS5 trigram + sqlite-vec embedding 都填充完
- abstract sample query (cases JOIN case_param_names) 跑通

---

## M4 · cli-diagnose 查询路径 (1-1.5 天)

**入口**: M3 出口

**动作**:
1. **改** `src/cli-diagnose.ts`:
   - 删原 348 行 `SELECT * FROM rules ...` · 改成查 cases 表
   - 删 v2_checks / rules 表存在检查
   - 实现 4 条查询路径(对应 PHASE-1-SCHEMA-AND-USAGE §5.2-§5.5):
     - **路径 A · 配置审计**: 现场 config_dump → join case_param_names (param_role='recommendation')
     - **路径 B · 指标诊断**: 现场 metrics → join case_param_names (param_role='cause') + symptom_category 路由
     - **路径 C · 火焰图栈帧**: 加载 13 条 flame-signature pattern_regex 内存测试栈帧
     - **路径 D · 本地兜底检索**: cases_fts 中文全文 + cases_vec 余弦相似 (NotebookLM 不可用时)
2. **生成 CheckResult**: 每条命中 case → CheckResult { case_id, title, bucket (从 cases.bucket 取), scope, severity, current_value, recommendation, ... }
3. **诊断结果落盘**: `diagnose-output.json` (供 NotebookLM 同事的 `--op query-batch` 读)
4. **小型 mongo snapshot 跑通**:
   - 一份手造 snapshot.json (含 vm.swappiness=60, wiredTigerCacheSizeGB=0.25 等明显异常)
   - cli-diagnose 跑出 CheckResult[] 含正确 case 命中

**出口**:
- 4 路径都返回 result · 至少一条手造 snapshot 跑通
- 诊断 JSON 落盘 · 字段对齐同事 query-batch 输入要求

---

## M5 · kb-enrich + models + report (1 天)

**入口**: M4 出口

**动作**:
1. **改** `src/models.ts`:
   - `Bucket` 类型变 `EntryKind` (best-practice / diagnostic-flow / flame-signature) + 数字 `Bucket` 1-5
   - `Rule` 类型 → `Case`
   - 新增 `CheckResult.bucket` 字段
2. **改** `src/kb-enrich.ts`:
   - 删 `SELECT FROM knowledge WHERE rule_id = ?`
   - 改成从 cases.{best_practice,diagnostic_flow,flame_signature}_data JSON 列取 fact
   - 7 种 fact_type 适配新结构
3. **改** `src/report.ts`:
   - 渲染按 entry_kind 分 section (BP / DF / Flame)
   - impact 排序按 risk.severity / likely_causes 数 / pattern hotness
   - 字段名对齐新 Case 结构
4. **改** `src/rule-engine-v2.ts`:
   - 看 deterministic 表达式是否还能用(原本从 rules 表读 input · 现在改从 cases JSON 读)
   - 估计小改 input 接口
5. **端到端跑通** mongo snapshot:
   - cli-diagnose → CheckResult[] → kb-enrich → 注入 fact → report → HTML
   - 浏览器打开 HTML · 检查格式 · 引用链接 · 权威性图标

**出口**:
- 端到端 mongo snapshot → HTML 报告生成成功
- 报告含 BP/DF/Flame 三 section · 至少各 1 条命中

---

## M6 · NotebookLM 集成 + flat md 投影 (1 天)

**入口**: M5 出口 · NotebookLM 同事的 `notebooklm.mjs` 已可用

**动作**:
1. **写** `scripts/cases-to-flat-md.mjs`:
   - 输入: distill-v2/cases/{_common,mongodb}/<entry_kind>/*.md
   - 输出: plugins/perf-kp-sql/data/{common,mongo}/*.md
   - 路由: scope → bucket → 子目录(同 M0 表)
   - 聚合: 按 scope 二级分组 · 控 ≤30 .md/notebook
   - 格式: NotebookLM 友好 flat md (去 yaml + 拍平 ## 区块)
   - 增量幂等: 输出 hash 给 notebooklm-py 用
2. **跑** `node scripts/cases-to-flat-md.mjs` · 验证 data/{common,mongo}/ 出现 flat md
3. **改** `src/cli-diagnose.ts` 加 NotebookLM 集成:
   - 诊断完输出 diagnose-output.json
   - 自动 spawn `node scripts/notebooklm.mjs --op query-batch --from-diagnose <path> --hw-arch <X>`
   - 解析返回的 results[] · 拼到 HTML footer 之后的"深入分析"段
   - 失败 → footer 后单行降级提示(同事文档 §3 三档行为)
4. **改** skill `skills/perf-kp-sql/SKILL.md`:
   - Step 4.3 后加自动深入分析
   - Step 5 追问改走 `notebooklm.mjs --op query --domain auto --query <Q>`

**出口**:
- data/{common,mongo}/ 含投影出来的 flat md · 数量 ≤30/目录
- 端到端跑诊断 → 主报告 + 深入分析段都正常出
- NotebookLM 不可用时降级提示出现 · 主报告不阻塞

---

## M7 · 测试 + CI + 收尾 (0.5-1 天)

**入口**: M6 出口

**动作**:
1. **重写** `tests/perf-kp-sql.test.ts`(45 行 → ~80 行):
   - 测 cli-kb build → cases 表 202 行
   - 测 4 路径查询返回正确 case
   - 测 scope→bucket 映射函数
2. **重写** `tests/render-report.test.ts`(188 行 → ~150 行):
   - 测 BP/DF/Flame 三 section 渲染
   - 测 NotebookLM 注入路径(mock notebooklm.mjs)
3. **修** `package.json` test 命令(M2 时被临时禁用 · 现在恢复)
4. **删** CI:
   - `.github/workflows/kb-reverse-check.yml`
   - `.github/workflows/lint-kb-quotes.yml`
5. **esbuild 全量 rebundle** scripts/(esbuild 把 src/*.ts 重新打包到 scripts/*.mjs)
6. **bump 版本**:
   - `plugins/perf-kp-sql/.claude-plugin/plugin.json` 0.24.0 → 0.25.0 (minor · 结构性变更)
   - 加 CHANGELOG entry: "0.25.0 KB 重构 · 老规则系统 → 蒸馏 case 体系 + NotebookLM 集成"
7. **commit** + 准备 PR · PR 描述抄 PHASE-1-PLAN.md 摘要

**出口**:
- `npm test` 全绿
- CI validate.yml 通过
- esbuild 重新生成的 scripts/*.mjs 跟新 src/*.ts 一致
- plugin.json 0.25.0 · CHANGELOG 已更新
- branch ready to PR

---

## 总工期

| Milestone | 天 |
|---|---:|
| M0 准备 | 0.5 |
| M1 清洗 distill-v2 ║ M2 死代码批删 (并行) | 0.5 (max) |
| M3 新 KB schema | 1.5-2 |
| M4 查询路径 | 1-1.5 |
| M5 kb-enrich + models + report | 1 |
| M6 NotebookLM + flat md | 1 |
| M7 测试 + CI + 收尾 | 0.5-1 |
| **总计** | **5.5 - 8 天** |

(M6 可能受 NotebookLM 同事进度影响 · 若 notebooklm.mjs 还没好可先做 M7 跑核心诊断流程 · M6 后续补)

---

## 风险 + 应对

| 风险 | 缓解 |
|---|---|
| scope 实际值未列举完 · scopeToBucket 漏 case | M0 跑 grep 全量列举 · M3 入库时 lint 报错 |
| rule-engine-v2.ts 与新 cases 结构不兼容 · 要重写而非小改 | 备选 rule-engine v3 · 直接走 JSON path 评估器 (~150 行) · M5 内消化 |
| esbuild rebundle 后 scripts/*.mjs 体积/兼容回归 | M7 跑端到端 + 装一次 plugin 验 · 若回归用之前的 mjs 一一对照 diff |
| NotebookLM 同事进度滞后 | M6 内做 flat md 投影 + cli-diagnose 占位 · 同事完工后单独联调 0.5d |
| 真 mongo snapshot 数据缺(开发期没现场) | 用 `data/collect-cmds.json` 跑出真 SSH 现场 · 或手造 snapshot.json fixture(M4/M5/M6 都用) |

---

## 验证 checkpoint

每个 Milestone 出口必跑(不通过不进下一个):

```bash
# typecheck
cd plugins/perf-kp-sql && npx tsc --noEmit

# build (M3 之后)
node scripts/kb.mjs build --from <distill-v2/cases> --out data/knowledge.sqlite
node scripts/kb.mjs stats   # 看条目数

# 端到端 (M5 之后)
node scripts/diagnose.mjs --snapshot fixtures/sample-mongo-snapshot.json --out /tmp/report.html
open /tmp/report.html

# 测试 (M7 之后)
npm test

# 装 plugin 真跑一次 (M7 末)
# (在另一台 mongo 实例上跑完整流程)
```

---

## commit 节奏

每个 Milestone 一个 commit · 信息模板(中文):

```
phase-1: M3 新 KB schema + 入库

- 重写 cli-kb.ts SCHEMA_SQL · cases 表 + 4 子表 + FTS5 + sqlite-vec
- 入库 distill-v2/cases · 202 case · 5 个 bucket 分布: ...
- 加 lint: PRIMARY KEY 唯一 + JSON schema + path-guard

Refs: PHASE-1-PLAN.md, PHASE-1-AUDIT-CHECKLIST.md M3
```

---

## 起点

`feat/phase-1-kb-rebuild` · base = main · 当前 commit `f22f72d` (Merge PR #16)
