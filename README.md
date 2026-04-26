# ohsql-plugin

Official plugin marketplace for [OpenHarness-SQL](https://github.com/zlxtqbdgdgd/OpenHarness-SQL). All skills follow the **Anthropic Agent Skills open standard** — they run natively on Claude Code, OpenAI Codex CLI, and ohsql, with no per-platform tool mapping or build-time conversion required.

## Plugins

| Plugin | Version | Compatible agents | Description |
|---|---|---|---|
| [`cpu-flamegraph`](./plugins/cpu-flamegraph/) | 0.2.1 | Claude Code · Codex CLI · ohsql · any agent with shell + read/write | Capture & analyze CPU flamegraphs over SSH (pure local ssh + Perl flamegraph.pl) |
| [`perf-kp-sql`](./plugins/perf-kp-sql/) | 0.6.0 | Claude Code · Codex CLI · ohsql · any standard-compliant agent with shell + read/write | Kunpeng + MongoDB/MySQL/Redis joint perf diagnosis (sqlite RAG KB + flamegraph integration) |

## Install · Claude Code

```
/plugin marketplace add zlxtqbdgdgd/ohsql-plugin
/plugin install cpu-flamegraph              # ready immediately
/plugin install perf-kp-sql                 # auto-installs cpu-flamegraph
                                             # then run /perf-kp-sql-setup
```

## Install · OpenAI Codex CLI

```
codex plugin marketplace add zlxtqbdgdgd/ohsql-plugin
# Codex auto-discovers skills from the plugin's skills/ directory.
# For perf-kp-sql, also run: /perf-kp-sql-setup (installs native deps)
```

## Install · ohsql (≥ 0.38.0)

Same `/plugin marketplace add` + `/plugin install` syntax as Claude Code.

## SSH auth note

Both plugins SSH to remote hosts. **SSH key auth is recommended** (works on all agents). SSH password auth (via `sshpass`) works on Claude Code + ohsql but is **blocked on OpenAI Codex CLI's sandbox** — Codex users should run `ssh-copy-id` once and use `privateKeyPath=` instead of `password=`.

## Layout

```
ohsql-plugin/
├── .claude-plugin/marketplace.json     # Claude Code catalog entry
├── .codex-plugin/marketplace.json      # OpenAI Codex CLI catalog entry (mirror)
├── plugins/
│   ├── cpu-flamegraph/                 # plugin 1
│   │   ├── .claude-plugin/plugin.json
│   │   ├── .codex-plugin/plugin.json   # Codex-flavored manifest with `interface` UI metadata
│   │   ├── README.md
│   │   └── skills/cpu-flamegraph/
│   │       ├── SKILL.md
│   │       ├── scripts/                # CI bundle commit
│   │       └── vendor/flamegraph.pl
│   └── perf-kp-sql/                    # plugin 2
│       ├── .claude-plugin/plugin.json
│       ├── .codex-plugin/plugin.json
│       ├── README.md
│       ├── data/knowledge.sqlite       # 10MB · binary linguist-generated
│       ├── scripts/                    # CI bundle commit
│       ├── templates/
│       └── skills/
│           ├── perf-kp-sql/SKILL.md    # main diagnosis skill
│           └── perf-kp-sql-setup/      # native-dep installer (照 ce-setup 范式)
│               ├── SKILL.md
│               └── scripts/check-health
├── tools/build/validate.mjs            # CI: manifest schema + skill standard compliance
├── tools/build/validate.test.mjs       # node --test unit tests for the validator
├── package.json                        # CI-only deps (esbuild + native libs)
└── .github/workflows/validate.yml
```

## SKILL.md path conventions

All SKILL.md files follow the Anthropic Agent Skills open standard. Frontmatter is minimal (`name` + `description` + optional `compatibility` + `metadata` + CC-friendly `argument-hint`); skill body uses prose intent + plain shell commands (no agent-specific tool call syntax). For path resolution across agents:

| Variable | Claude Code | OpenAI Codex CLI | ohsql |
|---|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | injected by CC | unset | unset |
| `$OHSQL_PLUGIN_ROOT` | unset | unset | substituted at SKILL.md load time |
| `$OHSQL_DEP_<NAME>_ROOT` | unset | unset | substituted to dependency plugin's cache path |

Recommended pattern:

```bash
node "${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/diagnose.mjs" --engine mongo
```

(Codex CLI users: the plugin install path is `~/.codex/plugins/cache/<marketplace>/<plugin>/<sha>/` — Codex's skill discovery handles path resolution natively.)

## CI

```bash
npm run validate          # manifest + plugin.json schema (always passes)
npm run validate:strict   # + Anthropic Agent Skills compliance (frontmatter / body / codex mirror)
npm test                  # node --test for the validator
```

## License

MIT
