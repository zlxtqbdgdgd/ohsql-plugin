# ohsql-plugin

[![validate](https://github.com/zlxtqbdgdgd/ohsql-plugin/actions/workflows/validate.yml/badge.svg)](https://github.com/zlxtqbdgdgd/ohsql-plugin/actions/workflows/validate.yml)

> 中文 · [English](README.md)

[OpenHarness-SQL](https://github.com/zlxtqbdgdgd/OpenHarness-SQL) 官方插件 marketplace——性能诊断、CPU 火焰图、数据库工具集。

所有 skill 遵循 [Anthropic Agent Skills 开放标准](https://github.com/anthropics/skills)，同一份 skill 源码可在 Claude Code、OpenAI Codex CLI、ohsql ≥ 0.38.0 上原生运行，无需为不同 agent 做工具映射或构建期转换。

## 插件列表

| 插件 | 版本 | 支持的 agent | 功能 |
|---|---|---|---|
| [`cpu-flamegraph`](./plugins/cpu-flamegraph/) | 0.4.0 | Claude Code · Codex CLI · ohsql · 任何提供 shell + read/write 能力的 agent | 通过 SSH 远程执行 `perf` → 生成 on-CPU / off-CPU 火焰图 SVG → 提取 Top-N 热点函数。纯本地 `ssh` + Perl `flamegraph.pl` 实现，零内核工具依赖。 |
| [`perf-kp-sql`](./plugins/perf-kp-sql/) | 0.54.0 | Claude Code · Codex CLI · ohsql · 任何符合开放标准的 agent | 鲲鹏 ARM64 + MongoDB 联合性能诊断。基于 SSH 的远程数据采集 → LLM 编排的 7 阶段流水线 → 匹配 202 案例的 markdown 案例库 → NotebookLM 在线知识库补充 → 生成按 impact 排序的 markdown 报告。 |

---

## 安装

### OpenHarness-SQL (ohsql ≥ 0.38.0)

```text
/plugin marketplace add zlxtqbdgdgd/ohsql-plugin
/plugin install cpu-flamegraph                  # 安装即可用
/plugin install perf-kp-sql                     # 自动安装依赖 cpu-flamegraph
/perf-kp-sql-setup                              # 校验运行时环境 + 注册 NotebookLM
```

`perf-kp-sql-setup` 完成后：

```text
/perf-kp-sql host=10.0.0.1 user=root password=xxx engine=mongo
```

### Claude Code

```text
/plugin marketplace add zlxtqbdgdgd/ohsql-plugin
/plugin install cpu-flamegraph
/plugin install perf-kp-sql
/perf-kp-sql-setup                              # 校验运行时环境 + 注册 NotebookLM
```

### OpenAI Codex CLI

```text
codex plugin marketplace add zlxtqbdgdgd/ohsql-plugin
# Codex 自动从 plugin 的 skills/ 目录发现 skill
# 对于 perf-kp-sql，还需运行: /perf-kp-sql-setup (校验运行时 + 注册 NotebookLM)
```

---

## 用法

两个 plugin 的执行模型不同——`cpu-flamegraph` 是 single-shot 程序化采集与解读，`perf-kp-sql` 是 LLM 编排的 7 阶段流水线。每个子节包含调用方式、行为说明、终端输出示例（数据为示意）。

### `cpu-flamegraph`

支持三种调用方式：

```text
# slash + 完整参数
/cpu-flamegraph host=test.host user=root process=mongod duration=10 type=oncpu

# slash 不带参数 — skill 交互式询问缺失参数
/cpu-flamegraph

# 自然语言 — agent 命中 "CPU 高 / 卡顿 / 火焰图 / perf record" 等关键词后自动加载 skill
> 帮我看下 test.host 上 mongod 的 CPU 热点在哪
```

Single-shot 采集与解读流程：

- SSH 连接远端执行 `perf record`，采样时长 `<duration>` 秒
- `perf script` 提取调用栈 → 本地折叠 → `flamegraph.pl` 生成 SVG
- 解析 Top-N 热点函数；命中 KB seed 时附加函数级解读
- 终端渲染 Top-N 表格，并输出远端 SVG 的 `scp` 拉取命令

SVG 保留在远端 `/tmp/cpu-flamegraph_<ts>/`，需手动 `scp` 拉取。

终端输出示例：

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

首次安装 `perf-kp-sql` 后跑一次，做两件事：

- **运行时校验**——检查 Node.js ≥ 18，以及 plugin 自带的案例库文件（`data/cases/` + `data/best-practice/`）是否齐备；案例文件缺失时建议 `/plugin reinstall perf-kp-sql`
- **NotebookLM 增强（可选）**——交互式询问是否启用 NotebookLM 在线知识库。启用前需本机已装 Chromium 系浏览器（Chrome / Edge / Brave 任一）；选择启用后会自动安装 `uv` + `notebooklm-mcp-cli`，启动一个独立 Chrome 实例（`--user-data-dir=…`，不干扰日常浏览器）登录 Google 账号，并创建三个领域 notebooks（mongo / kunpeng / os）

需要重跑的场景：将 NotebookLM 从"跳过"切换到"启用"、Google 凭据失效需要重登录、或重装后想重新校验案例库。跳过 NotebookLM 不影响 `perf-kp-sql` 的基本功能——Phase 4 会自动降级为仅本地案例阈值判定，报告标注 "NLM unavailable"。

终端输出示例：

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

支持三种调用方式：

```text
# slash + 完整参数
/perf-kp-sql host=10.0.0.1 user=root privateKeyPath=~/.ssh/id_ed25519 engine=mongo

# slash 不带参数 — 进入 Phase 0 历史选单 + 交互式收集凭据
/perf-kp-sql

# 自然语言 — agent 命中 "数据库慢 / CPU 高 / 抖动 / mongo perf / Kunpeng 性能" 等关键词后自动加载 skill
> 鲲鹏机器上 MongoDB 凌晨 2 点起 CPU 100%，帮诊断一下
```

LLM 编排的 7 阶段流水线：

- 环境画像（Phase 0）— 单次 SSH 采集 OS / DB / 硬件 / 部署形态
- 对话引导（Phase 1）— 采集用户描述的问题现象
- 现象路由（Phase 2）— LLM 匹配 `cases/INDEX.md`，收敛到候选案例集
- 批量采集（Phase 3）— 按 case 的 `collection_method_quote` 执行指标采集
- 多源诊断（Phase 4）— 案例阈值直判 + NotebookLM 在线知识库补充查询
- 报告生成（Phase 5）— 8 列诊断表 + 建议措施，落盘至本地
- 深入对话（Phase 6，可选）— 基于已采数据回答用户的进一步提问

需要火焰图时自动调用 `cpu-flamegraph`。

终端输出示例：

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

`## 诊断结果` 主表之后还有 `## 综合描述` / `## 辅助信息 · 现场观测` / `## 参考链接` 三段，受篇幅所限不在示例中展示。表中 `[参考N]` 链接在 `## 参考链接` 段展开为具体 URL，全部来自案例库 `source_url` 字段或 NotebookLM 返回的 `references`，不基于模型自身知识推断生成。

---

## 输出产物

**`cpu-flamegraph`**（独立运行）

- 远端 `/tmp/cpu-flamegraph_<YYYYMMDD-HHMMSS>/flamegraph.svg` — SVG 火焰图，不自动下载；skill 输出 `scp` 命令供手动拉取
- 同目录下保留 `perf script` 原始输出，文件名为被采集进程名
- Top-N 热点函数表渲染至对话通道，不落盘

**`perf-kp-sql`**（本地单目录归档 `~/.perf-kp-sql/runs/<YYYYMMDD-HHMMSS>/`）

| 文件 | 内容 |
|---|---|
| `report.md` | 主报告（按 impact 排序的诊断表 + 建议措施） |
| `env.txt` | Phase 0 环境画像原始输出 |
| `collect-os.txt` | OS 层采集（vmstat / iostat 等） |
| `collect-mongo.txt` | MongoDB 层采集（serverStatus 等） |
| `flame.svg` | 火焰图（本轮采集时生成） |

另有两个跨 run 复用的配置文件：`~/.perf-kp-sql/notebooklm.json`（NLM 配置）、`~/.perf-kp-sql/hosts.json`（SSH/DB 连接历史，mode 0600，凭据仅在用户 opt-in 后写入）。

---

## 目录结构

仓库由 `marketplace.json` 索引文件与两个自包含 plugin 构成。布局：

```text
ohsql-plugin/
├── marketplace.json                       # 可安装 plugin 列表
└── plugins/
    ├── cpu-flamegraph/
    │   ├── .claude-plugin/plugin.json     # 版本 / 元数据
    │   ├── skills/cpu-flamegraph/
    │   │   ├── SKILL.md                   # 自然语言意图描述，指挥 LLM
    │   │   └── scripts/capture.mjs        # SSH + perf + flamegraph.pl 生成 SVG
    │   └── data/kb-seeds/                 # 函数级热点解读字典
    └── perf-kp-sql/
        ├── .claude-plugin/plugin.json     # 版本 + 依赖 cpu-flamegraph ^0.4.0
        ├── skills/
        │   ├── perf-kp-sql/SKILL.md       # 主诊断流水线 (7 阶段)
        │   └── perf-kp-sql-setup/SKILL.md # 首次安装运行时校验 + NLM 注册
        ├── scripts/
        │   ├── ssh.mjs                    # SSH_ASKPASS 封装 + ControlMaster 长连接
        │   ├── notebooklm.mjs             # 通过 nlm CLI 调用 Google NotebookLM
        │   ├── capture-flamegraph.mjs     # 调用 cpu-flamegraph 子 skill
        │   ├── format-chat.mjs            # 终端 box-drawing 报告渲染
        │   └── history.mjs                # ~/.perf-kp-sql/hosts.json 读写
        └── data/
            ├── cases/{INDEX,CASES}.md     # 109 条诊断案例 (诊断流 96 + 火焰图 13)
            └── best-practice/{INDEX,CASES}.md  # 93 条最佳实践巡检
```

---

## 许可证

MIT
