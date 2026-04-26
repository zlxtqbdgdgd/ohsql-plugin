# ohsql-plugin

Official plugin marketplace for [OpenHarness-SQL](https://github.com/zlxtqbdgdgd/OpenHarness-SQL). CC-protocol compatible — `cpu-flamegraph` works in stock Claude Code too.

## Plugins

| Plugin | Version | Hosts | Description |
|---|---|---|---|
| [`cpu-flamegraph`](./plugins/cpu-flamegraph/) | 0.2.0 | ohsql + stock CC | Capture & analyze CPU flamegraphs over SSH (pure local ssh + Perl flamegraph.pl) |
| [`perf-kp-sql`](./plugins/perf-kp-sql/) | 0.5.0 | ohsql ≥ 0.38.0 | Kunpeng + MongoDB/MySQL/Redis joint perf diagnosis (sqlite RAG KB + flamegraph) |

## Install (in OpenHarness-SQL ≥ 0.38.0)

```
/plugin marketplace add zlxtqbdgdgd/ohsql-plugin
/plugin install cpu-flamegraph              # ready immediately
/plugin install perf-kp-sql                  # auto-installs cpu-flamegraph
                                              # then run /perf-kp-sql-setup
```

## Install (in stock Claude Code)

Only `cpu-flamegraph` (no native deps) works in stock CC:

```
/plugin marketplace add zlxtqbdgdgd/ohsql-plugin
/plugin install cpu-flamegraph
```

`perf-kp-sql` requires the `SshExec` tool that only ohsql provides; it will install but won't run.

## Layout

```
ohsql-plugin/
├── .claude-plugin/marketplace.json     # CC catalog entry
├── plugins/
│   ├── cpu-flamegraph/                 # plugin 1
│   │   ├── .claude-plugin/plugin.json
│   │   ├── README.md
│   │   └── skills/cpu-flamegraph/
│   │       ├── SKILL.md
│   │       ├── scripts/                # CI bundle commit
│   │       └── vendor/flamegraph.pl
│   └── perf-kp-sql/                    # plugin 2
│       ├── .claude-plugin/plugin.json
│       ├── README.md
│       ├── data/knowledge.sqlite       # 10MB · binary linguist-generated
│       ├── scripts/                    # CI bundle commit
│       ├── templates/
│       └── skills/
│           ├── perf-kp-sql/SKILL.md    # main diagnosis skill
│           └── perf-kp-sql-setup/      # native-dep installer (照 ce-setup 范式)
│               ├── SKILL.md
│               └── scripts/check-health
├── tools/build/validate.mjs            # CI: manifest schema check
├── package.json                        # CI-only deps (esbuild + native libs)
└── .github/workflows/validate.yml
```

## SKILL.md path conventions

To stay portable across CC and ohsql, plugin SKILL.md files reference paths via:

| Variable | Stock CC | ohsql |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | injected by CC | unset → falls through to `$OHSQL_PLUGIN_ROOT` |
| `$OHSQL_PLUGIN_ROOT` | unset | substituted at SKILL.md load time → absolute cache path |
| `$OHSQL_DEP_<NAME>_ROOT` | unset | substituted to dependency plugin's cache path |

Recommended pattern:

```bash
node "${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/scripts/diagnose.mjs" --engine mongo
```

## License

MIT
