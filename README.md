# ohsql-plugin

[![validate](https://github.com/zlxtqbdgdgd/ohsql-plugin/actions/workflows/validate.yml/badge.svg)](https://github.com/zlxtqbdgdgd/ohsql-plugin/actions/workflows/validate.yml)

> English · [中文](README.zh-CN.md)

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

---

## Usage

The two plugins follow different execution models — `cpu-flamegraph` is a single-shot programmatic capture-and-interpret tool, while `perf-kp-sql` is an LLM-orchestrated 7-phase pipeline. Each subsection covers invocation, behavior, and a sample terminal session (illustrative data).

### `cpu-flamegraph`

Three invocation methods are supported:

```text
# slash + full arguments
/cpu-flamegraph host=test.host user=root process=mongod duration=10 type=oncpu

# slash without arguments — the skill interactively prompts for missing parameters
/cpu-flamegraph

# natural language — agent auto-loads the skill on keywords like "high CPU / latency spike / flamegraph / perf record"
> show me the CPU hotspots in mongod on test.host
```

Single-shot capture-and-interpret flow:

- SSH to the remote host and run `perf record` for `<duration>` seconds
- `perf script` extracts call stacks → fold locally → `flamegraph.pl` renders SVG
- Parse top-N hotspot functions; attach function-level interpretation when a KB seed matches
- Render the top-N table in the terminal and print the `scp` command for the remote SVG

The SVG stays on the remote at `/tmp/cpu-flamegraph_<ts>/`; pull it with `scp` manually.

Sample terminal output:

```text
> /cpu-flamegraph host=10.0.0.1 user=root process=mongod duration=3 type=oncpu

热点结论 : WiredTigerRecordStore::_insertRecords 24.0% （模块 mongod）
采样说明 : CPU 时间 12.3 ms ; 范围 mongod (pid=911593)
热点含义 : 热点已进入数据库引擎侧, 建议结合慢查询、锁与缓存指标继续深挖

═══ 采样元信息 ═══════════════════════════════════════════════════════
┌────┬──────────────────────────────────────────┬─────────┬─────────┐
│ #  │ Function                                 │ Module  │ Percent │
├────┼──────────────────────────────────────────┼─────────┼─────────┤
│ 1  │ WiredTigerRecordStore::_insertRecords    │ mongod  │ 24.0%   │
│ 2  │ __wt_btree_open                          │ mongod  │ 12.6%   │
│ 3  │ memcpy                                   │ libc    │  8.4%   │
│ 4  │ ...                                      │ ...     │  ...    │
└────┴──────────────────────────────────────────┴─────────┴─────────┘

可视化产物 （留在远端, 自取）:
  scp root@10.0.0.1:/tmp/cpu-flamegraph_20260510-143022/flamegraph.svg .
  scp root@10.0.0.1:/tmp/cpu-flamegraph_20260510-143022/mongod .
```

### `perf-kp-sql-setup`

```text
/perf-kp-sql-setup
```

Run once after installing `perf-kp-sql`. Two responsibilities:

- **Runtime check** — verifies Node.js ≥ 18 and that the bundled case-library files (`data/cases/` + `data/best-practice/`) are in place; missing files prompt `/plugin reinstall perf-kp-sql`
- **NotebookLM enablement (optional)** — interactively asks whether to enable the NotebookLM online KB. Enabling requires a Chromium-family browser (Chrome / Edge / Brave — any one) installed locally beforehand; the setup then installs `uv` + `notebooklm-mcp-cli`, opens an isolated Chrome instance (`--user-data-dir=…`, does not interfere with your daily browser) for Google sign-in, and provisions three domain notebooks (mongo / kunpeng / os)

Rerun when you want to switch NotebookLM from skipped to enabled, refresh expired Google credentials, or revalidate the case library after a reinstall. Skipping NotebookLM keeps `perf-kp-sql` fully functional — Phase 4 falls back to local-only threshold judgment and the report is flagged "NLM unavailable".

Sample terminal output:

```text
> /perf-kp-sql-setup

perf-kp-sql checking dependencies...

Phase 1 — 必装项
   node v22.4.0                            🟢
   data/cases/ + data/best-practice/       🟢

━ NotebookLM 增强（可选）━
是否启用 NotebookLM 增强（多源诊断的二次确认源）？
  1. 启用 (Recommended)
  2. 跳过

> 1

✓ uv 0.11.3 已就绪
✓ Google Chrome 已检测到
✓ nlm CLI 已安装到 ~/.local/bin/nlm
🌐 已打开独立 Chrome（不影响日常浏览器），请在弹出窗口完成 Google 登录…
✓ 登录完成，cookie 已落盘

开始创建各领域知识库
✓ mongodb 知识库创建完成 — 新加 12/12 篇
✓ kunpeng 知识库创建完成 — 新加 8/8 篇
✓ os 知识库创建完成 — 新加 15/15 篇

✅ perf-kp-sql setup complete

Phase 1 — 必装项
   node v22.4.0                            🟢
   data/cases/ + data/best-practice/       🟢

Phase 2 — NotebookLM 增强
已经基于 35 篇官方文档帮你创建 mongodb/kunpeng/os 三个领域 notebook 知识库用于后续诊断。

   ohsql-mongo-kb     🟢  12 篇文档
   ohsql-kunpeng-kb   🟢  8 篇文档
   ohsql-os-kb        🟢  15 篇文档

随时可重跑 /perf-kp-sql-setup 重新校验或切换 NLM 启用状态。
```

### `perf-kp-sql`

Three invocation methods are supported:

```text
# slash + full arguments
/perf-kp-sql host=10.0.0.1 user=root privateKeyPath=~/.ssh/id_ed25519 engine=mongo

# slash without arguments — enters Phase 0 history menu and interactively collects credentials
/perf-kp-sql

# natural language — agent auto-loads the skill on keywords like "slow database / high CPU / latency spike / mongo perf / Kunpeng performance"
> mongod on a Kunpeng box has been at 100% CPU since 2 AM, please diagnose
```

LLM-orchestrated 7-phase pipeline:

- Env probe (Phase 0) — one SSH session collects OS / DB / hardware / deployment topology
- Symptom intake (Phase 1) — gather the user's description of the issue
- Symptom routing (Phase 2) — LLM matches against `cases/INDEX.md` and narrows to a candidate set
- Metric collection (Phase 3) — issue per-case `collection_method_quote` commands to gather metrics
- Multi-source diagnosis (Phase 4) — threshold judgment from the case library + NotebookLM online KB lookup
- Report generation (Phase 5) — 8-column diagnosis table + remediation steps, written to disk
- Follow-up conversation (Phase 6, optional) — answer further questions grounded in the collected data

`cpu-flamegraph` is invoked automatically when a flamegraph is needed.

Sample terminal output:

```text
> /perf-kp-sql host=10.0.0.1 user=root engine=mongo

━ ohsql perf-kp-sql · 性能诊断 ━
本次按 5 步执行: 1.环境信息采集 / 2.诊断案例匹配 /
                3.诊断指标采集 / 4.多源综合诊断 / 5.报告生成

[1. 环境信息采集 : 系统/数据库版本/硬件信息]
[环境上下文]
  OS     : Linux 4.19 aarch64 (Kunpeng 920)
  Mongo  : 6.0.5 (replSet primary, 96C / 256G / NVMe)
  sysctl : vm.swappiness=10 / transparent_hugepage=[always]
  ulimit : nofile=65535

> 凌晨 2 点起 CPU 持续 100%, 集中在 mongod

[2. 诊断案例匹配 : 202 条案例库索引]

[3. 诊断指标采集]
  ✔ 操作系统层 : CPU / 内存 / 磁盘 / 网络
  ✔ MongoDB 层 : 连接池 / 慢查询 / 锁竞争 / WiredTiger
  ✔ mongod CPU 火焰图 (perf 3s)

[4. 多源综合诊断 : 案例库 + NotebookLM 在线知识库]
  ✔ 案例库阈值直判 (3 条触发)
  ✔ NotebookLM 知识库查询 (2/2)
  ✔ 综合判定

[5. 报告生成]

## 诊断结果
┌────┬───────────────────────┬──────┬─────────────────┬───────────┬─────────────────────┬────────┬─────────┐
│ #  │ 根因                  │ 等级 │ 判断依据        │ 命中案例  │ 建议措施            │ 置信度 │ 参考    │
├────┼───────────────────────┼──────┼─────────────────┼───────────┼─────────────────────┼────────┼─────────┤
│ 1  │ $where JS 烧 CPU      │ HIGH │ flame self 47%  │ Flame-007 │ 改用 $expr/$function│ 高     │ [参考1] │
│ 2  │ WT cache 压力         │ HIGH │ dirty 18% > 5%  │ DF-042    │ 调 eviction_*_target│ 中-高  │ [参考2] │
│ 3  │ 全表扫慢查询占比偏高  │ MED  │ COLLSCAN 23%    │ DF-001    │ 加索引 / 拆 batch   │ 中     │ [参考3] │
└────┴───────────────────────┴──────┴─────────────────┴───────────┴─────────────────────┴────────┴─────────┘

报告已落盘 : ~/.perf-kp-sql/runs/20260510-143022/report.md
```

The main `## 诊断结果` (Diagnosis) table is followed by `## 综合描述` (Summary) / `## 辅助信息 · 现场观测` (Auxiliary info · Field observations) / `## 参考链接` (References) sections (omitted from this sample for brevity). Each `[参考N]` (ref N) link in the table is expanded under `## 参考链接` to a concrete URL — every URL comes from a case library `source_url` field or a NotebookLM `references` payload, never inferred from the model's own knowledge.

---

## Output artifacts

**`cpu-flamegraph`** (standalone)

- Remote `/tmp/cpu-flamegraph_<YYYYMMDD-HHMMSS>/flamegraph.svg` — SVG flamegraph, not auto-downloaded; the skill prints the `scp` command for manual retrieval
- The same directory keeps the raw `perf script` output, named after the captured process
- The top-N hotspot table is rendered in the chat channel only, never written to disk

**`perf-kp-sql`** (single-directory archive at `~/.perf-kp-sql/runs/<YYYYMMDD-HHMMSS>/`)

| File | Contents |
|---|---|
| `report.md` | Main report (impact-ordered diagnosis table + remediation) |
| `env.txt` | Raw output of the Phase 0 environment probe |
| `collect-os.txt` | OS-layer collection (vmstat / iostat / etc.) |
| `collect-mongo.txt` | MongoDB-layer collection (serverStatus / etc.) |
| `flame.svg` | Flamegraph (present only when this run captured one) |

Two more configuration files are reused across runs: `~/.perf-kp-sql/notebooklm.json` (NLM configuration) and `~/.perf-kp-sql/hosts.json` (SSH/DB connection history, mode 0600 — credentials are written only when the user explicitly opts in).

---

## Architecture

The repository is a `marketplace.json` index plus two self-contained plugins. Directory layout:

```text
ohsql-plugin/
├── marketplace.json                       # installable plugin index
└── plugins/
    ├── cpu-flamegraph/
    │   ├── .claude-plugin/plugin.json     # version / metadata
    │   ├── skills/cpu-flamegraph/
    │   │   ├── SKILL.md                   # prose intent guiding the LLM
    │   │   └── scripts/capture.mjs        # SSH + perf + flamegraph.pl → SVG
    │   └── data/kb-seeds/                 # function-level hotspot interpretation dictionary
    └── perf-kp-sql/
        ├── .claude-plugin/plugin.json     # version + depends on cpu-flamegraph ^0.4.0
        ├── skills/
        │   ├── perf-kp-sql/SKILL.md       # main diagnosis pipeline (7 phases)
        │   └── perf-kp-sql-setup/SKILL.md # first-install runtime check + NLM registration
        ├── scripts/
        │   ├── ssh.mjs                    # SSH_ASKPASS wrapper + ControlMaster persistent connection
        │   ├── notebooklm.mjs             # calls the nlm CLI to query Google NotebookLM
        │   ├── capture-flamegraph.mjs     # invokes the cpu-flamegraph sub-skill
        │   ├── format-chat.mjs            # box-drawing terminal report renderer
        │   └── history.mjs                # read/write for ~/.perf-kp-sql/hosts.json
        └── data/
            ├── cases/{INDEX,CASES}.md     # 109 diagnostic cases (diagnostic-flow 96 + flame 13)
            └── best-practice/{INDEX,CASES}.md  # 93 best-practice audit cases
```

---

## License

MIT
