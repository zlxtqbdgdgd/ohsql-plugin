# perf-kp-sql

> **harness-agnostic** (since v0.6.0) — runs on Claude Code, OpenAI Codex CLI, and OpenHarness-SQL ≥ 0.38.0. Follows the [Anthropic Agent Skills open standard](https://github.com/anthropics/skills).

Kunpeng + MongoDB joint performance diagnosis. SSH-based collection (8-cmd 环境画像 + per-case 命令拉指标) + 6-phase LLM-orchestrated pipeline against 202-case markdown case library (cases/INDEX.md + best-practice/INDEX.md routing) + NotebookLM authoritative refresh + flamegraph integration. 0 native dep at runtime.

## Install · Claude Code

```bash
/plugin marketplace add zlxtqbdgdgd/ohsql-plugin
/plugin install perf-kp-sql
# → automatically installs cpu-flamegraph (dependency)
# → echoes:  "请运行 /perf-kp-sql-setup 完成 native 依赖安装"

/perf-kp-sql-setup
# → verifies runtime + data/cases/ + data/best-practice/ markdown files (零 npm 运行时依赖)
# → optionally registers NotebookLM (Google account · pip install notebooklm-py + rookiepy)
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

零 npm 运行时依赖(v0.36.0 起 marked 下线 · HTML 报告生成移除 · 报告仅保留 markdown)。

SSH 走本地 OpenSSH `ssh` CLI(v0.12.0 起 ssh2 native module 已下线)· 通过 `node scripts/ssh.mjs` wrapper 统一进入,带 ControlMaster 多路复用与 SSH_ASKPASS 密码注入。

NotebookLM(可选)走 Python 包 `notebooklm-py` + `rookiepy` · 由 `/perf-kp-sql-setup` 安装。

## Case library

`data/cases/` + `data/best-practice/` (~800KB, committed): 202 distilled cases — 93 best-practice + 96 diagnostic-flow + 13 flame-signature。两组 `CASES.md` (完整字段) + `INDEX.md` (路由表) · LLM 加载 INDEX 路由匹配 + Read offset+limit 拿单 case 完整字段 · NotebookLM 兜底刷新最新推荐。

The plugin **does not run** without these files — `/perf-kp-sql-setup` checks for them.
