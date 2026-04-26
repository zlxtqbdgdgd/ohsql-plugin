---
name: cpu-flamegraph
description: 通过 SSH 远程 perf 采样 + 本地解析，产出 CPU/Off-CPU 火焰图与 Top-N 热点函数；命中 KB 时输出函数级权威解读（无 LLM 推测）。仅需本地 ssh CLI，不依赖 ohsql kernel 任何 Tool，stock Claude Code 也可直接使用。
when-to-use: 用户排查远端进程 CPU 高 / 卡顿 / 响应慢；需要把火焰图作为诊断附件；或拿到一份 perf 火焰图 SVG 想取 Top-N 热点函数
allowed-tools: [Bash, Read, Write]
argument-hint: "host=<ip> user=<user> (key=<path>|password=<pw>) [process=<name>] [type=oncpu|offcpu] [duration=<sec>] [port=<n>] [engine=mongo|mysql|redis]"
---

# Role

CPU/Off-CPU 火焰图采集与解读助手。输出**简洁直接**：先给热点结论，再给采样范围、热点业务含义、可视化产物的 scp 命令。**不**复述工具调用，**不**输出宽 markdown 表格——`scripts/capture.mjs` 自带的 terminalReport 字段已经渲染好了 box-drawing 表格，放到代码块就行。

# 能力边界（必读）

本 skill **harness-agnostic**：只用 `Bash`/`Read`/`Write` 三个 stock 工具，不依赖 ohsql kernel 的 `SshExec`/`SshUpload`/`FlameGraph`。这是它能跑在 stock Claude Code 上的前提。

- 远程通信：调用本地 `ssh`/`scp` CLI（OpenSSH 或兼容实现）
- 认证方式：**SSH key 或密码任选**
  - **key**（推荐）：依赖用户 `ssh-agent` / `~/.ssh/config` / `known_hosts`。`BatchMode=yes` 强制非交互，密码提示直接 fail
  - **password**：传 `password=<pw>` 参数；本机需装 `sshpass`（Linux: `apt install sshpass` / `yum install sshpass`；macOS: `brew install hudochenkov/sshpass/sshpass`）。**警告**：密码会以命令行参数传给 sshpass，在多用户共享主机上 `ps -ef` 可见，敏感场景请改用 key
  - 同时给 `key=` 和 `password=` → key 优先，password 忽略
- 远端要求：root 或免密 sudo + 已安装 `perf` + （off-cpu 模式额外要求 `sched:sched_switch` tracepoint）+ `perl`（多数 Linux 发行版自带，用于在远端跑 flamegraph.pl 渲 SVG）
- 重产物：**留在远端** `/tmp/cpu-flamegraph_<ts>/`，不自动拉回本地——交给用户用 `scp` 自己挑落点
- KB 解读：传 `engine=mongo` 时，`terminalReport` 末尾追加"KB 解读"段，对 self ≥ 5% 的热点函数给出函数级权威解读（基于本 cartridge 自带 `data/kb-seeds/*-flame.json`，正则匹配，无 LLM 推测）。`engine` 未识别 / seed 缺失静默退化为纯采集

# 工作流

## 模式 1：远程采集（capture）

参数：
- `host=<ip>` ★必填——远端 IP 或域名
- `user=<user>` ★必填——SSH 登录用户名
- `process=<name>` ⏬目标进程名，默认 `mongod`
- `type=oncpu|offcpu` ⏬采集类型，默认 `oncpu`
  - `oncpu`：CPU 执行时间热点（`perf -e task-clock`）
  - `offcpu`：等待时间热点（`perf -e sched:sched_switch`，看锁/IO/网络等待）
- `duration=<sec>` ⏬采样时长（秒），默认 `0.3`
- `port=<n>` ⏬SSH 端口，默认 `22`
- `key=<path>` ⏬私钥路径；不传则用 ssh-agent / `~/.ssh/config` 默认 IdentityFile
- `password=<pw>` ⏬登陆密码（与 `key` 二选一，需本机 `sshpass`）
- `engine=<name>` ⏬KB 种子选择，默认 `mongo`；未识别则跳过 KB 解读段（纯采集）

调一行 Bash：

```
!`node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/skills/cpu-flamegraph/scripts/capture.mjs --host=<ip> --user=<user> [--key=<path>|--password=<pw>] [--process=<name>] [--type=oncpu|offcpu] [--duration=<sec>] [--engine=mongo]`
```

stdout 是结构化 JSON：

```jsonc
{
  "ok": true,
  "mode": "oncpu",
  "timeLabel": "CPU 时间",
  "totalMs": 12.3,
  "scopeLabel": "目标进程 mongod(pid=911593)",
  "summary": "CPU 时间 12.3ms；采样范围：目标进程 mongod(pid=911593)；Top: WiredTigerRecordStore::_insertRecords 24.0%（模块 mongod）",
  "top1": { "name": "...", "module": "mongod", "percent": 24.0 },
  "interpretation": "热点已进入数据库引擎侧，建议结合慢查询、锁与缓存指标继续深挖",
  "artifacts": {
    "sshTarget": "root@1.2.3.4",
    "serverSvgPath": "/tmp/cpu-flamegraph_2026-04-25T08-15-23/flamegraph.svg",
    "serverPerfScriptPath": "/tmp/cpu-flamegraph_2026-04-25T08-15-23/perf-script.txt",
    "scpSvg": "scp root@1.2.3.4:/tmp/cpu-flamegraph_2026-04-25T08-15-23/flamegraph.svg .",
    "scpPerfScript": "scp root@1.2.3.4:/tmp/cpu-flamegraph_2026-04-25T08-15-23/perf-script.txt ."
  },
  "hot_functions_top10": [{ "name": "...", "module": "mongod", "percent": 24.0 }],
  "terminalReport": "═══ 采样元信息 ═══\n..."  // 已渲染好的 box-drawing 表格
}
```

## 模式 2：本地 SVG 解析（analyze）

参数：
- `svg=<path>` ★必填——本地 flamegraph.pl 生成的 SVG 文件路径
- `type=oncpu|offcpu` ⏬影响输出文案（"CPU 时间" vs "等待时间"），默认 `oncpu`

```
!`node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/skills/cpu-flamegraph/scripts/analyze.mjs --svg=<path> [--type=oncpu|offcpu]`
```

返回 Top-N 热点函数与一句业务侧解读。

# 输出范式（对模型）

拿到 capture/analyze 的 JSON 后，按这 5 行格式回话：

1. **热点结论**：Top 热点为 `<name>` `<percent>`%（模块 `<module>`）
2. **采样说明**：`<timeLabel>` `<totalMs>`ms；范围 `<scopeLabel>`
3. **热点含义**：`<interpretation>`
4. **可视化产物**（仅 capture 模式）：
   - SVG 下载：`<artifacts.scpSvg>`
   - Perf Script 下载：`<artifacts.scpPerfScript>`（拖到 https://speedscope.app 看交互式视图）
5. **完整 Top-N 表格**（可选）：把 `terminalReport` 字段贴到代码块里

不要复述每一步在干什么；不要重新画表（`terminalReport` 已经画好了）。

# 失败处理

- exitCode != 0：把 stderr 内容（一行就够）告诉用户，并提示常见原因：
  - `密码登陆需要 sshpass · 当前未安装`：本机装 sshpass（提示语自带 Linux/macOS 安装命令），或改用 `key=<path>`
  - `SSH 密码错误（sshpass exit 5）`：用户输错密码，让用户重输；不要重复尝试同一密码
  - `SSH connection failed (255)`：检查 `ssh-agent` 是否加载了 key、`~/.ssh/config` 主机别名、`StrictHostKeyChecking` 是否阻拦了首次握手；密码模式下也可能是远端 sshd 拒密码登陆（PermitPasswordAuthentication=no）
  - `远程未找到 <process> 进程`：检查 `process=` 参数；远端没跑这个进程可改成 `process=<actual-name>`，或先 `ssh user@host pgrep -af <process>` 确认
  - `远程未安装 perf 工具`：按 stderr 给的安装命令在远端装；`yum install perf` 或 `apt install linux-tools-$(uname -r)`
  - `远程账户非 root 且无免密 sudo`：用 root 登或在远端 `sudo visudo` 加白名单
  - `perf 采样未得到任何样本`：拉长 `duration=`（默认 0.3s 在闲机上常采空），或确认目标进程在采样窗口内有 CPU 活动

# 例子

用户："帮我看下 1.2.3.4 上 mongod 的 CPU 热点"

```
!`node ${CLAUDE_PLUGIN_ROOT:-$OHSQL_PLUGIN_ROOT}/skills/cpu-flamegraph/scripts/capture.mjs --host=1.2.3.4 --user=root --process=mongod --duration=3 --type=oncpu`
```

→ 解析返回 JSON，按"输出范式"给 5 行结论。
