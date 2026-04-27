# perf-kp-sql · plugin 与 skillhub `rules` 表 gap · 2026-04-26

> 同步源:skillhub commit `5235484fcb3e09be3b25dc4da2ec1ecc8a355794`
> 同步对象:`plugins/perf-kp-sql/data/knowledge.sqlite`

## 结构层

非 `rules` 表(`knowledge`、`flame_patterns`、`knowledge_fts*`、`knowledge_vec*`、`sqlite_sequence`)字节级一致(已用 sha1 hash 验证),本次同步只触动 `rules` 表。

| 表 | skillhub 行数 | plugin 行数 | 内容 hash 一致 |
|---|---|---|---|
| knowledge | 2257 | 2257 | ✓ |
| flame_patterns | 9 | 9 | ✓ |
| knowledge_fts | 2257 | 2257 | ✓ |
| knowledge_fts_config | 1 | 1 | ✓ |
| knowledge_vec_chunks | 3 | 3 | ✓ |
| knowledge_vec_info | 4 | 4 | ✓ |
| sqlite_sequence | 4 | 4 | ✓ |

## `rules` 表字段差异(411 行 rule_id 完全相同,无新增/删除规则)

| 字段 | 差异行数 | 性质 |
|---|---|---|
| `source_url` | 318 | 28 backfill (plugin NULL → skillhub 有) + 290 refine (skillhub 更精确) |
| `source_title` | 32 | 跟随 source_url |
| `metrics` | 28 | skillhub 加 `parse:"db:serverStatus.xxx"` 路径(配 collector 拉数) |
| `checks` | 7 | skillhub 用具体 metric key + op + value 替换自由文本 shell 片段 |
| `recommendations` | 6 | plugin `[]` → skillhub `[{action,rationale,...}]` |
| `enabled` | 9 | 全部 plugin 关、skillhub 开 |
| 倒退方向 | **0** | — |

## 9 条本次新启用的规则

```
mongo-runtime-ticket-queue-overload
mongo-config-index-build-memory-limit-spill
mongo-3-nfs-options
mongo-performance-ulimit-settings
mongo-performance-readahead-setting
mongo-net-maxincomingconnections-recommendation
kunpeng.bios.smmu_enabled
kunpeng.bios.cpu_prefetch_enabled
mongo-kunpeng-numa-binding
```

这 9 条同时也在 `metrics` / `checks` 差异列表里 — 因为 skillhub 把它们的 collector / check 写实在了才打开。

## URL diff 细分

```
backfill (plugin NULL → skillhub 有)  : 28
refine   (两边有 URL · skillhub 更精确): 290
regress  (plugin 有 · skillhub 无)    : 0
```

`refine` 290 条主要来源于 skillhub 这几次 commit:
- `a6e4600 fix(perf-kp-sql): 全量 citation URL 精确化 · 103 处 broad URL → anchored 精确链接`
- `5ce0b40 data(perf-kp-sql): refresh KB rules.source_url to current official docs (URL audit)`
- `5235484 data(perf-kp-sql): replace 34 disabled-rule hikunpeng URLs (phase-f)`
- `6bb09ed data(perf-kp-sql): fix 3 mismatched URLs`
- `481f25e data: 补齐知识库 source_url + 修复 404 链接`
- `85fbdae fix: 修复全部坏链+格式错误的 source_url`

## 同步方式

整库 cp(用 better-sqlite3 `db.backup()` API 做原子拷贝,避开 WAL 不一致)。
非 `rules` 表 7 张已字节级一致,所以等价于只同步 `rules` 表。

## 同步后的 drift 警告

源 `data/common/kunpeng-rules.json` 与 `data/seeds/*.json` 仍持有旧 `source.url` / `source.title`。
下一个 commit (Phase B) 把 KB 的 URL/title 反向写回源 JSON,并加 `kb-validate` 守护防回退。
