# perf-kp-sql

> **harness-agnostic** (since v0.6.0) — runs on Claude Code, OpenAI Codex CLI, and OpenHarness-SQL ≥ 0.38.0. Follows the [Anthropic Agent Skills open standard](https://github.com/anthropics/skills).

Kunpeng + MongoDB/MySQL/Redis joint performance diagnosis. SSH-based collection (50 OS metrics + per-engine runtime) + 411 baseline rules + sqlite RAG knowledge base (FTS5 trigram + vec0 384-dim semantic search with RRF fusion) + flamegraph integration.

## Install · Claude Code

```bash
/plugin marketplace add zlxtqbdgdgd/ohsql-plugin
/plugin install perf-kp-sql
# → automatically installs cpu-flamegraph (dependency)
# → echoes:  "请运行 /perf-kp-sql-setup 完成 native 依赖安装"

/perf-kp-sql-setup
# → installs better-sqlite3, sqlite-vec, ssh2, @xenova/transformers
# → triggers MiniLM-L6-v2 model warmup (~25MB download)
# → verifies knowledge.sqlite schema
```

## Install · OpenAI Codex CLI

```bash
codex plugin marketplace add zlxtqbdgdgd/ohsql-plugin
# Then in a Codex session:
/perf-kp-sql-setup
```

**SSH auth on Codex**: only key auth is supported (Codex sandbox blocks `sshpass`). Run once on your local machine before invoking the skill:

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub <user>@<host>
```

Then invoke with `privateKeyPath=~/.ssh/id_ed25519` (NOT `password=`).

## Install · ohsql (≥ 0.38.0)

Same syntax as Claude Code. Both `password=` and `privateKeyPath=` auth work.

## Use

```
# SSH key auth (recommended, all agents):
/perf-kp-sql host=10.0.0.1 user=root privateKeyPath=~/.ssh/id_ed25519 engine=mongo

# SSH password auth (Claude Code + ohsql only):
/perf-kp-sql host=10.0.0.1 user=root password=xxx engine=mongo
```

See `skills/perf-kp-sql/SKILL.md` for the full diagnosis flow + the `## Invocation` section for full parameter list.

## Dependencies

Native deps (installed by `/perf-kp-sql-setup`):

| Package | Why |
|---|---|
| `better-sqlite3@^11.7` | knowledge.sqlite + skills.db reads |
| `sqlite-vec@^0.1` | 384-dim vector ANN over MongoDB facts |
| `ssh2@^1.17` | SSH fallback library (legacy; the v0.6.0 skill prefers local `ssh` CLI) |
| `@xenova/transformers@^2.17` | MiniLM-L6-v2 sentence embeddings |

## Knowledge base

`data/knowledge.sqlite` (~10MB, committed): 2257 fact rows × 7 fact types across 371 MongoDB topics, 411 baseline rules (mongo / any / mysql / redis), 9 flame-pattern regexes. FTS5 trigram + vec0 RRF-fused retrieval with zero-hallucination guard.

The plugin **does not run** without the sqlite file — `/perf-kp-sql-setup` checks for it.
