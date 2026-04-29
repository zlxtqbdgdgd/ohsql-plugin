# perf-kp-sql

> **harness-agnostic** (since v0.6.0) — runs on Claude Code, OpenAI Codex CLI, and OpenHarness-SQL ≥ 0.38.0. Follows the [Anthropic Agent Skills open standard](https://github.com/anthropics/skills).

Kunpeng + MongoDB/MySQL/Redis joint performance diagnosis. SSH-based collection (50 OS metrics + per-engine runtime) + 411 baseline rules + sqlite RAG knowledge base (FTS5 trigram) + flamegraph integration.

## Install · Claude Code

```bash
/plugin marketplace add zlxtqbdgdgd/ohsql-plugin
/plugin install perf-kp-sql
# → automatically installs cpu-flamegraph (dependency)
# → echoes:  "请运行 /perf-kp-sql-setup 完成 native 依赖安装"

/perf-kp-sql-setup
# → installs better-sqlite3
# → verifies knowledge.sqlite schema
```

## Install · OpenAI Codex CLI

```bash
codex plugin marketplace add zlxtqbdgdgd/ohsql-plugin
# Then in a Codex session:
/perf-kp-sql-setup
```

**SSH auth**: 自 v0.12.0 起 `password=` / `privateKeyPath=` 都通过 `node ssh.mjs` wrapper 走本地 OpenSSH `ssh` CLI · 密码模式用 OpenSSH 内建 SSH_ASKPASS,**不再依赖 sshpass**,所以 Codex / Claude Code / ohsql 三家都支持密码与 key 两种方式。

## Install · ohsql (≥ 0.38.0)

Same syntax as Claude Code.

## Use

```
# SSH key auth (推荐):
/perf-kp-sql host=10.0.0.1 user=root privateKeyPath=~/.ssh/id_ed25519 engine=mongo

# SSH password auth:
/perf-kp-sql host=10.0.0.1 user=root password=xxx engine=mongo
```

See `skills/perf-kp-sql/SKILL.md` for the full diagnosis flow + the `## Invocation` section for full parameter list.

## Dependencies

Native deps (installed by `/perf-kp-sql-setup`):

| Package | Why |
|---|---|
| `better-sqlite3@^11.7` | knowledge.sqlite + skills.db reads |

SSH 走本地 OpenSSH `ssh` CLI(v0.12.0 起 ssh2 native module 已下线)· 通过 `node scripts/ssh.mjs` wrapper 统一进入,带 ControlMaster 多路复用与 SSH_ASKPASS 密码注入。

## Knowledge base

`data/knowledge.sqlite` (~10MB, committed): 2257 fact rows × 7 fact types across 371 MongoDB topics, 411 baseline rules (mongo / any / mysql / redis), 9 flame-pattern regexes. FTS5 trigram retrieval with zero-hallucination guard.

The plugin **does not run** without the sqlite file — `/perf-kp-sql-setup` checks for it.
