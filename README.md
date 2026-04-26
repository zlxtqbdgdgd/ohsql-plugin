# ohsql-plugin

[![validate](https://github.com/zlxtqbdgdgd/ohsql-plugin/actions/workflows/validate.yml/badge.svg)](https://github.com/zlxtqbdgdgd/ohsql-plugin/actions/workflows/validate.yml)

Official plugin marketplace for [OpenHarness-SQL](https://github.com/zlxtqbdgdgd/OpenHarness-SQL) — performance diagnosis, CPU flamegraphs, and database tooling.

Plugins follow the Claude Code plugin protocol (`.claude-plugin/marketplace.json` + `.claude-plugin/plugin.json`), so harness-agnostic ones run in stock Claude Code too.

## Plugins

| Plugin | Version | Hosts | What it does |
|---|---|---|---|
| [`cpu-flamegraph`](./plugins/cpu-flamegraph/) | 0.2.0 | ohsql + stock CC | Remote `perf` over SSH → on-CPU / off-CPU flamegraph SVG → top-N hotspot extraction. Pure local `ssh` + Perl `flamegraph.pl`, zero kernel-tool dependency. |
| [`perf-kp-sql`](./plugins/perf-kp-sql/) | 0.5.0 | ohsql ≥ 0.38.0 | Kunpeng ARM64 + MongoDB / MySQL / Redis joint perf diagnosis. SshExec collect → 411 baseline rules → sqlite RAG knowledge base (FTS5 + vec0 384-dim) → impact-ranked report. |

---

## Install

### OpenHarness-SQL (ohsql ≥ 0.38.0)

```text
/plugin marketplace add zlxtqbdgdgd/ohsql-plugin
/plugin install cpu-flamegraph                  # ready immediately
/plugin install perf-kp-sql                     # auto-installs cpu-flamegraph dep
/perf-kp-sql-setup                              # install native deps once (better-sqlite3 + sqlite-vec + ssh2 + transformers)
```

After `perf-kp-sql-setup` completes:

```text
/perf-kp-sql host=10.0.0.1 user=root password=xxx engine=mongo
```

ohsql is the only host with full `perf-kp-sql` support (it depends on the `SshExec` kernel tool and the native deps installed via `perf-kp-sql-setup`).

### Claude Code

Only `cpu-flamegraph` works in stock Claude Code (no native deps, uses your local `ssh` / `scp` CLI):

```text
/plugin marketplace add zlxtqbdgdgd/ohsql-plugin
/plugin install cpu-flamegraph
```

`perf-kp-sql` will _install_ in stock CC but won't run — its skills call the `SshExec` tool which only OpenHarness-SQL provides.

### Cursor

```text
/add-plugin cpu-flamegraph
```

Or search for `cpu-flamegraph` in Cursor's plugin marketplace UI.

### Codex / Copilot CLI / Droid / Qwen

These hosts accept Claude Code-format plugins. The exact command varies by host:

```bash
# Codex
codex plugin marketplace add zlxtqbdgdgd/ohsql-plugin
codex plugin install cpu-flamegraph@ohsql-plugin

# Copilot CLI
copilot plugin marketplace add zlxtqbdgdgd/ohsql-plugin
copilot plugin install cpu-flamegraph@ohsql-plugin

# Droid
droid plugin marketplace add https://github.com/zlxtqbdgdgd/ohsql-plugin
droid plugin install cpu-flamegraph@ohsql-plugin

# Qwen Code
qwen extensions install zlxtqbdgdgd/ohsql-plugin:cpu-flamegraph
```

These integrations are inherited from CC's plugin protocol — we don't ship a custom Codex/Copilot installer.

---

## Quick example

Capture and analyze a CPU flamegraph standalone:

```text
/cpu-flamegraph host=test.host user=root process=mongod duration=10 type=oncpu
```

The skill renders a top-N hotspot table inline, leaves the SVG on the remote at `/tmp/cpu-flamegraph_<ts>/`, and prints the `scp` command to pull it.

End-to-end diagnosis with perf-kp-sql (ohsql only):

```text
/perf-kp-sql host=10.0.0.1 user=root password=*** engine=mongo
```

The skill collects 30+ OS / DB metrics over SSH, runs them against 411 baseline rules + queries the sqlite RAG knowledge base, optionally invokes `cpu-flamegraph` for hotspot data, and produces an impact-ranked HTML + screen report.

---

## How it works

| Variable | Stock CC | ohsql |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | injected by CC at runtime | unset → falls through to `$OHSQL_PLUGIN_ROOT` |
| `$OHSQL_PLUGIN_ROOT` | unset | substituted at SKILL.md load time → absolute cache path |
| `$OHSQL_DEP_<NAME>_ROOT` | unset | substituted to a dependency plugin's cache path |

SKILL.md files in this repo use the portable form `${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}` so the same source runs in both hosts unchanged.

`perf-kp-sql` uses `x-ohsql-*` extension fields (CC ignores unknown keys) for kernel-version requirements, declared dependencies, and the post-install setup-skill pointer.

---

## License

MIT
