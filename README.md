# ohsql-plugin

[![validate](https://github.com/zlxtqbdgdgd/ohsql-plugin/actions/workflows/validate.yml/badge.svg)](https://github.com/zlxtqbdgdgd/ohsql-plugin/actions/workflows/validate.yml)

Official plugin marketplace for [OpenHarness-SQL](https://github.com/zlxtqbdgdgd/OpenHarness-SQL) — performance diagnosis, CPU flamegraphs, and database tooling.

All skills follow the [Anthropic Agent Skills open standard](https://github.com/anthropics/skills), so the same skill source runs natively on Claude Code, OpenAI Codex CLI, and ohsql ≥ 0.38.0 — no per-platform tool mapping or build-time conversion required.

## Plugins

| Plugin | Version | Hosts | What it does |
|---|---|---|---|
| [`cpu-flamegraph`](./plugins/cpu-flamegraph/) | 0.4.0 | Claude Code · Codex CLI · ohsql · any agent with shell + read/write | Remote `perf` over SSH → on-CPU / off-CPU flamegraph SVG → top-N hotspot extraction. Pure local `ssh` + Perl `flamegraph.pl`, zero kernel-tool dependency. |
| [`perf-kp-sql`](./plugins/perf-kp-sql/) | 0.54.0 | Claude Code · Codex CLI · ohsql · any standard-compliant agent | Kunpeng ARM64 + MongoDB joint perf diagnosis. SSH-based collection → 7-phase LLM-orchestrated pipeline against 202-case markdown case library → NotebookLM authoritative refresh → impact-ranked markdown report. |

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

Both password (`password=<pw>`) and key (`privateKeyPath=<path>`) auth work on all hosts — `scripts/ssh.mjs` uses OpenSSH's built-in `SSH_ASKPASS` mechanism, no `sshpass` dependency.

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

The skill runs a 7-phase LLM-orchestrated pipeline: 环境画像(Phase 0)→ 对话引导(Phase 1)→ 现象路由(Phase 2 · LLM 匹配 cases/INDEX.md)→ 批量采集(Phase 3 · per-case collection_method_quote)→ 推断(Phase 4 · 案例阈值直判 + NotebookLM 兜底刷新)→ markdown 报告(Phase 5)→ 深入对话(Phase 6 · 用户追问可选)。Optionally invokes `cpu-flamegraph` for hotspot stack analysis.

---

## How it works

All SKILL.md files follow the Anthropic Agent Skills open standard. Frontmatter is minimal (`name` + `description` + optional `compatibility` + `metadata` + CC-friendly `argument-hint`); skill body uses prose intent + plain shell commands (no agent-specific tool call syntax).

Path resolution: every SKILL.md uses literal `<PLUGIN_ROOT>` placeholder (plain text, not a shell variable). The agent reads the skill's base directory from the harness's skill-load context (Claude Code prints `Base directory for this skill: <path>`; Codex CLI / ohsql provide the same), derives `PLUGIN_ROOT` by going up two levels, then substitutes `<PLUGIN_ROOT>` to an absolute path before issuing each `Bash(command=...)`. The same SKILL.md source runs on all hosts unchanged.

`perf-kp-sql` uses `x-*` extension fields (`x-setup-skill`, `x-plugin-dependencies`) for declarative metadata. Unrecognized hosts ignore them.

---

## License

MIT
