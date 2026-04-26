# perf-kp-sql

> **ohsql-only** — requires OpenHarness-SQL ≥ 0.38.0. Will not function in stock Claude Code (depends on the `SshExec` tool).

Kunpeng + MongoDB/MySQL/Redis joint performance diagnosis. SshExec collect + 411 baseline rules + sqlite RAG knowledge base (FTS5 trigram + vec0 384-dim semantic search with RRF fusion) + flamegraph integration.

## Install

```bash
# in ohsql REPL
/plugin marketplace add zlxtqbdgdgd/ohsql-plugin
/plugin install perf-kp-sql
# → automatically installs cpu-flamegraph (dependency)
# → echoes:  "请运行 /perf-kp-sql-setup 完成 native 依赖安装"

/perf-kp-sql-setup
# → installs better-sqlite3, sqlite-vec, ssh2, @xenova/transformers
# → triggers MiniLM-L6-v2 model warmup (~25MB download)
# → verifies knowledge.sqlite schema
```

## Use

```
/perf-kp-sql host=10.0.0.1 user=root password=xxx engine=mongo
```

See `skills/perf-kp-sql/SKILL.md` for the full diagnosis flow.

## Dependencies

Native deps (installed by `/perf-kp-sql-setup`):

| Package | Why |
|---|---|
| `better-sqlite3@^11.7` | knowledge.sqlite + skills.db reads |
| `sqlite-vec@^0.1` | 384-dim vector ANN over MongoDB facts |
| `ssh2@^1.17` | SSH fallback when ohsql kernel `SshExec` is unavailable |
| `@xenova/transformers@^2.17` | MiniLM-L6-v2 sentence embeddings |

## Knowledge base

`data/knowledge.sqlite` (~10MB, committed): 2257 fact rows × 7 fact types across 371 MongoDB topics, 411 baseline rules (mongo / any / mysql / redis), 9 flame-pattern regexes. FTS5 trigram + vec0 RRF-fused retrieval with zero-hallucination guard.

The plugin **does not run** without the sqlite file — `/perf-kp-sql-setup` checks for it.
