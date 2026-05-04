# ohsql-plugin

[![validate](https://github.com/zlxtqbdgdgd/ohsql-plugin/actions/workflows/validate.yml/badge.svg)](https://github.com/zlxtqbdgdgd/ohsql-plugin/actions/workflows/validate.yml)

Official plugin marketplace for [OpenHarness-SQL](https://github.com/zlxtqbdgdgd/OpenHarness-SQL) — performance diagnosis, CPU flamegraphs, and database tooling.

All skills follow the [Anthropic Agent Skills open standard](https://github.com/anthropics/skills), so the same skill source runs natively on Claude Code, OpenAI Codex CLI, and ohsql ≥ 0.38.0 — no per-platform tool mapping or build-time conversion required.

## Plugins

| Plugin | Version | Hosts | What it does |
|---|---|---|---|
| [`cpu-flamegraph`](./plugins/cpu-flamegraph/) | 0.2.1 | Claude Code · Codex CLI · ohsql · any agent with shell + read/write | Remote `perf` over SSH → on-CPU / off-CPU flamegraph SVG → top-N hotspot extraction. Pure local `ssh` + Perl `flamegraph.pl`, zero kernel-tool dependency. |
| [`perf-kp-sql`](./plugins/perf-kp-sql/) | 0.48.1 | Claude Code · Codex CLI · ohsql · any standard-compliant agent | Kunpeng ARM64 + MongoDB joint perf diagnosis. SSH-based collection → 6-phase LLM-orchestrated pipeline against 202-case markdown case library → NotebookLM authoritative refresh → impact-ranked markdown report. |

---

## Install

### OpenHarness-SQL (ohsql ≥ 0.38.0)

```text
/plugin marketplace add zlxtqbdgdgd/ohsql-plugin
/plugin install cpu-flamegraph                  # ready immediately
/plugin install perf-kp-sql                     # auto-installs cpu-flamegraph dep
/perf-kp-sql-setup                              # verify runtime + register NotebookLM
```

After `perf-kp-sql-setup` completes:

```text
/perf-kp-sql host=10.0.0.1 user=root password=xxx engine=mongo
```

### Claude Code

Both plugins work in stock Claude Code (since v0.6.1, `perf-kp-sql` is harness-agnostic — no longer needs the `SshExec` kernel tool):

```text
/plugin marketplace add zlxtqbdgdgd/ohsql-plugin
/plugin install cpu-flamegraph
/plugin install perf-kp-sql
/perf-kp-sql-setup                              # verify runtime + register NotebookLM
```

### OpenAI Codex CLI

```text
codex plugin marketplace add zlxtqbdgdgd/ohsql-plugin
# Codex auto-discovers skills from the plugin's skills/ directory
# For perf-kp-sql, also run: /perf-kp-sql-setup (verifies runtime + registers NotebookLM)
```

**SSH auth on Codex**: only key auth supported (Codex sandbox blocks `sshpass` for password mode). Run once on your local machine before invoking the skill:

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub <user>@<host>
```

Then invoke with `privateKeyPath=~/.ssh/id_ed25519` (NOT `password=...`).

### Cursor

```text
/add-plugin cpu-flamegraph
```

Or search for `cpu-flamegraph` in Cursor's plugin marketplace UI.

### Copilot CLI / Droid / Qwen

These hosts accept Claude Code-format plugins. The exact command varies by host:

```bash
# Copilot CLI
copilot plugin marketplace add zlxtqbdgdgd/ohsql-plugin
copilot plugin install cpu-flamegraph@ohsql-plugin

# Droid
droid plugin marketplace add https://github.com/zlxtqbdgdgd/ohsql-plugin
droid plugin install cpu-flamegraph@ohsql-plugin

# Qwen Code
qwen extensions install zlxtqbdgdgd/ohsql-plugin:cpu-flamegraph
```

These integrations are inherited from the Anthropic Agent Skills format — no custom installer needed per host.

---

## Quick example

Capture and analyze a CPU flamegraph standalone:

```text
/cpu-flamegraph host=test.host user=root process=mongod duration=10 type=oncpu
```

The skill renders a top-N hotspot table inline, leaves the SVG on the remote at `/tmp/cpu-flamegraph_<ts>/`, and prints the `scp` command to pull it.

End-to-end diagnosis with `perf-kp-sql`:

```text
/perf-kp-sql host=10.0.0.1 user=root privateKeyPath=~/.ssh/id_ed25519 engine=mongo
```

The skill runs a 6-phase LLM-orchestrated pipeline: SSH 环境画像 → 现象路由(LLM 匹配 cases/INDEX.md)→ 批量采集(per-case collection_method_quote)→ 推断(案例阈值直判 + NotebookLM 兜底刷新)→ markdown 报告。Optionally invokes `cpu-flamegraph` for hotspot stack analysis.

---

## How it works

All SKILL.md files follow the Anthropic Agent Skills open standard. Frontmatter is minimal (`name` + `description` + optional `compatibility` + `metadata` + CC-friendly `argument-hint`); skill body uses prose intent + plain shell commands (no agent-specific tool call syntax).

Path resolution across hosts:

| Variable | Claude Code | OpenAI Codex CLI | ohsql |
|---|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | injected by CC at runtime | unset | unset |
| `$OHSQL_PLUGIN_ROOT` | unset | unset | substituted at SKILL.md load time → absolute cache path |
| `$OHSQL_DEP_<NAME>_ROOT` | unset | unset | substituted to a dependency plugin's cache path |

SKILL.md files in this repo use the portable form `${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}` so the same source runs on all hosts unchanged. Codex CLI's plugin install path (`~/.codex/plugins/cache/<marketplace>/<plugin>/<sha>/`) is resolved by Codex's skill discovery natively.

`perf-kp-sql` uses `x-*` extension fields (`x-needs-npm-install`, `x-setup-skill`, `x-plugin-dependencies`) for declarative metadata. Unrecognized hosts ignore them. Versions ≤ 0.5.x used the `x-ohsql-*` prefix; both forms are accepted by the validator for backward compatibility.

---

## License

MIT
