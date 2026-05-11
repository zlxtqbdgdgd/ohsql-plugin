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

## Workflow

两个 plugin 的执行模型不同：`cpu-flamegraph` 是 single-shot 程序化采集 + 解读；`perf-kp-sql` 是 LLM 编排的 7 阶段流水线。下面是各自一次完整 run 在终端里大致看到的样子（数据为示意）。

### `cpu-flamegraph`

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

### `perf-kp-sql`

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
  匹配 5 条 → 收敛到 3 条候选 :
    • Flame-007 $where JavaScript 解释执行
    • DF-042    WT cache eviction 压力
    • DF-001    慢查询时间分布异常

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

`## 诊断结果` 主表后还会跟 `## 综合描述` / `## 辅助信息 · 现场观测` / `## 参考链接` 三段，篇幅原因不在样例展示。表里的 `[参考N]` 链接在 `## 参考链接` 段展开为具体 URL，全部来自案例库 `source_url` 字段或 NotebookLM 返回的 `references`——不允许凭模型自身知识编造。Phase 6（用户追问）在拿到报告后才出现，纯基于 Phase 3 已采数据 + 案例库内容回答，不再连机也不再查 NotebookLM。

---

## Output artifacts

**cpu-flamegraph**(standalone)

- 远端 `/tmp/cpu-flamegraph_<YYYYMMDD-HHMMSS>/flamegraph.svg` — SVG 火焰图，不自动拉回，skill 会打印 `scp` 命令让你自己取
- 同目录下还有一份 `perf script` 原始文本，文件名是被采集进程的进程名
- Top-N 热点函数表直接渲染在聊天里，不落盘

**perf-kp-sql**(本地单目录归档 `~/.perf-kp-sql/runs/<YYYYMMDD-HHMMSS>/`)

| 文件 | 内容 |
|---|---|
| `report.md` | 主报告(impact 排序的诊断表 + 措施) |
| `env.txt` | Phase 0 环境画像原始输出 |
| `collect-os.txt` | OS 层采集(vmstat / iostat / 等) |
| `collect-mongo.txt` | MongoDB 层采集(serverStatus / 等) |
| `flame.svg` | 火焰图(本轮采了才有) |

跨 run 复用的配置另外两个文件：`~/.perf-kp-sql/notebooklm.json`(NLM 配置)、`~/.perf-kp-sql/hosts.json`(SSH/DB 历史，mode 0600，凭据用户 opt-in 才存)。

---

## Update & uninstall

```text
/plugin update cpu-flamegraph
/plugin update perf-kp-sql

/plugin uninstall perf-kp-sql
/plugin uninstall cpu-flamegraph
```

`perf-kp-sql` 依赖 `cpu-flamegraph`，请先卸 `perf-kp-sql` 再卸 `cpu-flamegraph`。卸载只动 plugin cache，不删 `~/.perf-kp-sql/runs/` 下的历史报告——想清就手动 `rm -rf`。

---

## Credentials & privacy

- **SSH 密码**：默认只本会话内存里用一次，通过 OpenSSH 的 `SSH_ASKPASS` 临时脚本传给 `ssh`，不出现在进程列表、不写日志、不落盘。
- **SSH 私钥**：`privateKeyPath=` 只引用本机已有文件，不复制不上传。
- **凭据落盘需 opt-in**：`perf-kp-sql` 第一次连上之后会问你"要不要把密码存进 `~/.perf-kp-sql/hosts.json`(chmod 600)"，选"不保存"就只在本会话用，下次重输。
- **采集数据 / 报告全本地**：环境画像、采集原始输出、报告都只在你本机 `~/.perf-kp-sql/runs/<TS>/` 下，不上传任何远端。
- **NotebookLM 是可选增强**：开了它之后，会经 Google NotebookLM 走云的只是**查询文本**(配置项名 / 案例追问语句)；采集数据、密码、主机名都不走。不想用就在 `/perf-kp-sql-setup` 那一步跳过，案例阈值判定纯本地不受影响。

---

## Troubleshooting

- **装完 `perf-kp-sql` 直接跑** → 报缺 `data/cases/{INDEX.md,CASES.md}`。先跑 `/perf-kp-sql-setup`，必要时 `/plugin reinstall perf-kp-sql`。
- **远端没装 `perf`** → `command not found: perf`。Debian/Ubuntu: `apt install linux-tools-$(uname -r)`；RHEL/CentOS: `yum install perf`。
- **没注册 NotebookLM** → Phase 4 的在线知识库查询自动跳过，报告标注 `NLM unavailable`；案例阈值判定不受影响，结果照样能用。
- **同时传 `password=` 和 `privateKeyPath=`** → key 优先，password 被忽略。想用密码就别传 key。
- **火焰图采样太少 / 看不出热点** → `duration=` 默认偏短，机器闲时加到 `duration=3` 或 `duration=5`。

---

## Architecture

仓库本体就是一个 `marketplace.json` 索引 + 两个自包含的 plugin。布局：

```text
ohsql-plugin/
├── marketplace.json                       # 列出可装的 plugins
└── plugins/
    ├── cpu-flamegraph/
    │   ├── .claude-plugin/plugin.json     # version / 元数据
    │   ├── skills/cpu-flamegraph/
    │   │   ├── SKILL.md                   # prose 指挥 LLM
    │   │   └── scripts/capture.mjs        # SSH + perf + flamegraph.pl 渲 SVG
    │   └── data/kb-seeds/                 # 函数级热点解读字典
    └── perf-kp-sql/
        ├── .claude-plugin/plugin.json     # version + 依赖 cpu-flamegraph ^0.4.0
        ├── skills/
        │   ├── perf-kp-sql/SKILL.md       # 主诊断流水线(7 phase)
        │   └── perf-kp-sql-setup/SKILL.md # 首次安装的 runtime 校验 + NLM 注册
        ├── scripts/
        │   ├── ssh.mjs                    # SSH_ASKPASS 包装 + ControlMaster 长连接
        │   ├── notebooklm.mjs             # 调 nlm CLI 走 Google NotebookLM
        │   ├── capture-flamegraph.mjs     # 调 cpu-flamegraph 子 skill
        │   ├── format-chat.mjs            # 终端 box-drawing 报告渲染
        │   └── history.mjs                # ~/.perf-kp-sql/hosts.json 读写
        └── data/
            ├── cases/{INDEX,CASES}.md     # 202 案例库
            └── best-practice/{INDEX,CASES}.md  # BP 巡检表
```

跑 `/perf-kp-sql ...` 时的数据流：

```text
harness (Claude Code / Codex CLI / ohsql)
   │  加载 SKILL.md
   ▼
perf-kp-sql skill (prose 指挥 LLM)
   ├── Bash ──▶ scripts/ssh.mjs              ──▶ SSH ──▶ 远端机器
   ├── Bash ──▶ scripts/notebooklm.mjs       ──▶ nlm CLI ──▶ Google NotebookLM
   ├── Bash ──▶ scripts/capture-flamegraph.mjs ──▶ cpu-flamegraph skill
   ├── Bash ──▶ scripts/format-chat.mjs      (终端表渲染)
   ├── Read   ──▶ data/cases/{INDEX,CASES}.md
   └── Write  ──▶ ~/.perf-kp-sql/runs/<TS>/{report.md, env.txt, collect-*.txt, flame.svg}
```

`cpu-flamegraph` 既能独立跑（`/cpu-flamegraph host=... user=...`），也被 `perf-kp-sql` 在 Phase 3 当依赖调起——所以两个 plugin 一起装能拿到完整诊断报告 + 火焰图栈分析。

**跨 harness 一致性**：所有 SKILL.md 遵循 [Anthropic Agent Skills 开放标准](https://github.com/anthropics/skills)。Frontmatter 极简（`name` + `description` + 可选 `compatibility` / `metadata` / `argument-hint`），body 用自然语言意图 + 普通 shell 命令，不绑特定 agent 的私有 tool（不依赖 ohsql kernel 的 `SshExec`，也不依赖 CC 的 `TodoWrite`）。路径用字面 `<PLUGIN_ROOT>` 占位符，agent 从 harness 给的 skill 加载上下文取根目录、运行时替换为绝对路径，同一份 SKILL.md 源在 Claude Code / Codex CLI / ohsql 上一字不差地跑。

---

## License

MIT
