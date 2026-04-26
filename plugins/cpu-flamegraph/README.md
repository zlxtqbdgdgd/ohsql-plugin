# cpu-flamegraph

跨 harness 的 CPU / Off-CPU 火焰图采集与解读 skill。SSH 到远端跑 `perf record`，本地解析 perf script，远端跑 `flamegraph.pl` 渲 SVG，最后给 Top-N 热点函数 + 一句业务侧解读。

## 与 ohsql 内置 `FlameGraph` Tool 的区别

ohsql 旧版本（≤ 0.36.x）内置 `FlameGraph` Tool，走 `ssh2` npm 包做 SSH。这个 cartridge 是它的便携重写版：**不依赖 ohsql kernel**，只用 `Bash`/`Read`/`Write` 三个 stock 工具，因此能直接装到 stock Claude Code 的 `~/.claude/skills/` 里使用。

| 维度 | ohsql 旧 Tool | 本 skill |
|---|---|---|
| 适用 harness | 仅 ohsql | 任何 harness（stock Claude Code、ohsql、…） |
| SSH 实现 | `ssh2` npm 包 | 本地 OpenSSH `ssh` CLI + `child_process.spawn` |
| 认证 | 密码 / 私钥任选 | 私钥 + 密码任选（密码需本机装 `sshpass`） |
| KB 解读 | 无 | 内置 mongo 种子（`data/kb-seeds/mongo-flame.json`），命中 self ≥ 5% 热点函数则在 `terminalReport` 末尾追加权威解读段 |
| 调用方式 | 模型直接调 `FlameGraph(...)` Tool | 模型用 `Bash` 调 `node scripts/capture.mjs --...` |

## 安装

### Stock Claude Code

```bash
git clone https://github.com/zlxtqbdgdgd/ohsql-skillhub /tmp/skillhub
cd /tmp/skillhub && npm install && npm run build
mkdir -p ~/.claude/skills && cp -R skills/cpu-flamegraph ~/.claude/skills/
```

`build` 把 `src/cli-*.ts` 编到 `scripts/*.mjs`（`packages: bundled`，运行时不需要 `node_modules`）。`vendor/flamegraph.pl` 跟着 cartridge 走。

### ohsql

```bash
cp -R skills/cpu-flamegraph ~/.ohsql/skills/
```

## 用法

### capture（远程采集）

```
node scripts/capture.mjs --host=1.2.3.4 --user=root \
                         [--port=22] [--key=~/.ssh/id_rsa | --password=<pw>] \
                         [--process=mongod] [--duration=0.3] \
                         [--type=oncpu|offcpu] \
                         [--engine=mongo|mysql|redis]
```

stdout 是结构化 JSON（top1 / Top-10 / interpretation / 远端产物路径 / scp 命令 / 已渲染的 box-drawing 终端报表，含 KB 解读段）。失败 exitCode=1 + stderr 写人类可读诊断。

`--engine=mongo` 时，对 self ≥ 5% 的热点函数走两层 fallback 查 KB（`flame_pattern_regex` 正则匹配 → module 直查），命中则在 `terminalReport` 末尾追加"KB 解读"段。`--engine` 为未知值或 seed 文件缺失 → 静默退化为纯采集（不报错）。

### analyze（本地 SVG）

```
node scripts/analyze.mjs --svg=<path> [--type=oncpu|offcpu]
```

输出 Top-N 热点函数 + 一句业务侧解读。

## 远端要求

- 已装 `perf`（CentOS/RHEL/openEuler：`yum install perf`；Ubuntu/Debian：`apt install linux-tools-$(uname -r)`）
- 已装 `perl`（多数 Linux 发行版自带，用于跑 flamegraph.pl）
- root 或对 `perf`/`rm` 配了免密 sudo（`sudo visudo` 加 `<user> ALL=(ALL) NOPASSWD: /usr/bin/perf, /bin/rm`）
- off-cpu 模式额外要求内核启用 `CONFIG_SCHED_TRACER` + 挂了 debugfs

## 本地要求

- `ssh` / `scp` CLI（OpenSSH 客户端，Linux/macOS 自带）
- 仅密码模式额外需要：`sshpass`
  - Linux：`apt install sshpass` / `yum install sshpass`
  - macOS：`brew install hudochenkov/sshpass/sshpass`

## 许可证

本 cartridge 代码：与 ohsql-skillhub 主仓相同。

`vendor/flamegraph.pl`：CDDL-1.0，来自 [brendangregg/FlameGraph](https://github.com/brendangregg/FlameGraph)，详见 `vendor/LICENSE`。
