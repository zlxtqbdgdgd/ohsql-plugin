# perf-kp-sql · 火焰图深入分析专题立项书

> 对应领导反馈第 2.6 项 · backlog 立项 · **不在节后两周窗口实施**
>
> 领导原话:"后面可以列一个专题 · 对火焰图进一步的分析"
>
> 本文档只回答两件事:① 火焰图深入分析这个专题 · 当前 gap 在哪里 ② 5 个候选方向 + 优先级 + 资源估算 — **只立项 · 不实施**。
>
> 配套阅读:`docs/methodology/depth-control.md`(2.5 控深度) · `docs/methodology/llm-boundaries.md`(2.4 LLM 边界) · `~/Documents/蒸馏工程/蒸馏工程综述.md`(§8 案例 A · §3 方法三角)

---

## 1 · 引言

### 1.1 火焰图在 perf-kp-sql 里的定位

一句话:**从"指标维度"(CPU 95% / lock_acquire_waits 高)落到"代码维度"(到底是哪个函数在烧 CPU / 在等谁)** — 是性能诊断的"最后一公里"。case 库的 diagnostic-flow case 命中阈值后能告诉用户"WT cache 满了" · 但**只有火焰图能说清"满在 evict_pages 还是 reconcile_row"**。

### 1.2 当前已具备的能力(0.46.0 · 节前状态)

| 能力 | 实现位置 | 备注 |
|---|---|---|
| 远程采集 | 姐妹 plugin `cpu-flamegraph@^0.4.0` · `scripts/capture.mjs` | SSH `perf record` · 默认 3s · 复用 ControlMaster |
| 入口 wrapper | `plugins/perf-kp-sql/scripts/capture-flamegraph.mjs` | 跨 harness 自定位 · duration clamp 防 LLM 拉到 30s |
| 渲染 | 远端跑 `flamegraph.pl` 出 SVG | 0.44.0 起 `--local-svg-out=` scp 拉到 `runs/<TS>/flame.svg` |
| 解读 | Top-N 函数 + flame-signature 13 case 模式匹配(`pattern_regex` 正则) | `entry_kind=flame-signature` · 见 `data/cases/CASES.md` L5262 起 |
| 接 case 库 | Phase 3.A.3 触发条件:命中的 case 含 `signature_type` 字段 | regex 命中 → Phase 5 报告"## 火焰图分析"段引用 |

### 1.3 gap 一句话

**目前是"采到 + 用 13 条规则匹配"**;**还没做到"读懂 + 反查 + 历史对比 + 报告级标注"**。下面 §2-§3 把 gap 拆开说。

---

## 2 · 当前能力 vs 期望能力

| 维度 | 当前(0.46.0) | 期望(本专题落地后) |
|---|---|---|
| 采集 | 仅 on-CPU · 默认 3s | + off-CPU(等待 IO / 锁的栈)· + 内存 / IO 火焰图按需 |
| 解读 | Top-N 函数 + 13 条 `pattern_regex` 规则匹配 | + 函数语义聚类(同模块合并:WiredTiger / mongod / libc / kernel 各 Top-N)· + 性能反模式自动识别 |
| 跟 case 联动 | 规则单向触发(stack → case_id) | + LLM 语义反查(漏检高的规则之外补一条 LLM 路径)· + cases/INDEX.md 双向关联(case 反查典型火焰图样例) |
| 报告呈现 | SVG 文件 + Top-N 表(纯文本) | + SVG 上叠加 case_id 高亮标签 · + LLM 中文摘要"这部分代价是 X 机制的开销" |
| 历史对比 | 单次诊断 · 跑完即归档到 `runs/<TS>/` | + 同一主机修复前 vs 修复后火焰图叠合 diff · + 长期趋势(每天采一次 · 看演化) |

---

## 3 · 候选方向(5 条)

### 3.1 on-CPU vs off-CPU 对照采集

- **现状**:`cpu-flamegraph` skill 已支持 `--type=oncpu/offcpu` · 但 perf-kp-sql Phase 3.A.3 只调 oncpu · 缺 IO / 锁等待诊断盲点。flame-signature 13 case 里已有 1 条 Off-Wake 案例(`offcpu` 链 vfs_read · CASES.md L5407)未被利用。
- **目标**:Phase 3.A.3 在 stack-pattern case 命中时 · 多采一份 off-CPU 火焰图;case 库扩 off-cpu 专属 signature(锁等待 / 网络 IO 等待 / 磁盘 IO 等待 三类各 ≥ 3 条)。
- **资源**:1-2 周 · 1 人。SKILL.md 加 phase 子项 + wrapper 加 `--type` 透传 + 案例库扩 ~10 条。

### 3.2 多层栈追踪 + 函数语义聚类

- **现状**:Top-N 是函数级别 · 不分层。一个 mongod 火焰图里 WiredTiger / mongod / libc / kernel 函数混在一张表 · LLM 看不到"分层比例"这个信号。
- **目标**:Top-N 表加 `module` 列(从 mangling / 路径前缀推断:`__wt_*` → WiredTiger · `mongo::*` → mongod 业务层 · `__GI_*` → glibc · `sys_*` → kernel) · 每层各 Top-3 + 整体占比柱状。
- **资源**:1-2 周 · 1 人。改 `cpu-flamegraph/scripts/capture.mjs` 的解析阶段 + perf-kp-sql 报告渲染加分层段。

### 3.3 火焰图 → case_id 自动反查(LLM 语义判)

- **现状**:flame-signature 13 case 是规则匹配(`pattern_regex` 字面正则)· 漏检率高(写法略改一字就不命中)· 且只能命中已收录模式。
- **目标**:在规则匹配之外加一条 LLM 路径 — LLM 看 Top-N 文本 + 现场指标(WT cache % / opcounters / 锁队列等) · 综合判匹配哪些 case_id;两条路径的命中并集 + 标注来源(`[CASE-regex]` / `[CASE-llm]`) · 漏检兜底但不掩盖规则的可解释性。
- **资源**:2-3 周 · 1 人。需新增"火焰图语义判"prompt · 接 5 标签体系(`[LLM]` 推断必须明示 · 跟 depth-control.md §1.2 对齐) · 评测集(13 case 现有正样本 + 至少 30 条手工伪样本)。

### 3.4 SVG 标注 + LLM 文字解读

- **现状**:SVG 自包含 · 无任何 case_id 高亮 · 用户拿到 SVG 还得对着 Top-N 表自己找。
- **目标**:Phase 5 渲报告时在 SVG 上叠加(注入 `<g>` 标注)命中 case 的高亮框 + 旁注 case_id;再让 LLM 读 SVG + Top-N 写一段 ≤ 200 字的中文摘要(挂 `[LLM]` + 引 `[参考N]`) · 接 perf-kp-sql 现有的"## 火焰图分析"段。
- **资源**:1 周 · 1 人。SVG 注入是纯文本拼接(无须 D3) · 难点在文字解读跟 5 标签体系对齐(每条结论必须挂 `[OBS]` / `[CASE]` / `[NLM]` / `[LLM]` 之一)。
- **附加价值**:本方向产出可直接复用到 cpu-flamegraph 独立 plugin · 提升其单独使用价值。

### 3.5 历史对比 + 趋势

- **现状**:单次诊断 · 跑完归档到 `runs/<TS>/` · 跨 run 不联动。
- **目标**:同一 `<host>:<process>` 的 N 次火焰图栈数据合并(`folded` 中间产物已足够) · 出"修复前 vs 修复后"diff 视图(增减栈高亮);可选 cron 每天采一次 · 长期趋势监控(回归告警)。
- **资源**:2-3 周 · 1 人。需要持久化 backend(SQLite / 纯文件目录)· UI/格式选型(text diff vs SVG diff vs FlameGraph 官方 differential.pl 复用) · 目前案例库 0 条 cross-run 类 case · 价值待 §3.1-§3.4 跑通后才看得清。

---

## 4 · 优先级 + 推荐路径

排序判据:**投入/产出比 + 阻塞性 + 跟现有 5 标签 / case 库体系的耦合度**。

| 序 | 方向 | 周数 | 投入 | 产出 | 阻塞 | 备注 |
|---|---|---|---|---|---|---|
| 1 | **3.4 SVG 标注 + 文字解读** | 1 | 小 | 大(报告体感直接拉满) | 无 | 优先做 · 复用到 cpu-flamegraph |
| 2 | **3.3 LLM 语义反查 case_id** | 2-3 | 中 | 大(漏检兜底) | 接 3.4 文字解读 prompt 框架 | 接 3.4 后做 |
| 3 | **3.1 off-CPU 对照** | 1-2 | 中 | 中(IO/锁等待盲点) | 跟 3.3 解耦 · 可并行 | 推荐跟 3.3 并行 |
| 4 | **3.2 多层栈追踪** | 1-2 | 中 | 中(深度细化) | 待 3.3 框架就绪后做 | 第 4 顺位 |
| 5 | **3.5 历史对比** | 2-3 | 大 | 远期再说 | 需 storage backend · 需要前 4 项稳定 | 远期 backlog |

**推荐路径**:`3.4 → (3.3 并行 3.1) → 3.2 → 3.5`。前四项总计 5-8 周(单人) · 第五项独立 backlog。

---

## 5 · 跟综述的对接

- 综述 §3 三角验证(数据三角 / 方法三角 / 时间三角)中 · **方法三角**对应"不同方法证同一结论"。
- 综述 §8 案例 A "MongoDB ARM64 性能"已用火焰图作为方法三角的关键证据(自己在测试机复现 · 跟报告说法对照)。
- 本专题强化"方法三角":**从 stack pattern 单源(规则匹配)→ stack + 现场指标 + LLM 综合多源**(3.3 LLM 语义反查) · 以及**单次 → 跨时间对比**(3.5 历史趋势 · 时间三角)。
- 5 标签体系(`[OBS]` / `[CASE]` / `[NLM]` / `[LLM]`)在火焰图 LLM 解读段(3.4 / 3.3)继续适用 · 不引入新标签体系。

---

## 6 · 启动条件 + 预期时间

### 6.1 前置依赖(必须先满足)

| 前置 | 来源 | 为什么是前置 |
|---|---|---|
| 自蒸馏闭环跑通 | 节后两周 2.1 | 看 case 库自迭代机制 · 火焰图深入分析要往 case 库写新 entry · 闭环没跑通会污染库 |
| MySQL 案例蒸馏跑通 | 节后两周 2.2 | 看蒸馏方法是否通用 · 跨引擎跑通后才确认火焰图 case schema 不需要再大改 |

这两个跑通前 · **不开火焰图深入分析专题** — 避免方法论混在一起 · 也避免在不稳定的 case schema 上叠功能。

### 6.2 预期启动

**节后第 3 周(2026-05-19 起)**。前 2 周节后窗口(2.1 / 2.2 / 2.3 / 2.4 / 2.5 五项)收尾后启动;先做 §4 推荐路径中的 3.4 + 3.3 + 3.1。

### 6.3 退出判据

任一条件未达 · **不进 §4 第二阶段**:

1. 3.4 落地后 · 至少 1 个真实诊断报告(`runs/<TS>/report.md`)的"## 火焰图分析"段含 SVG 高亮 + LLM 摘要 · 双盲评审通过(reviewer 模型异于作者);
2. flame-signature case 库扩到 ≥ 20 条(off-cpu / 多模块栈各 ≥ 3 条);
3. 漏检率(LLM 语义判 vs 规则匹配)实测下降 ≥ 30%(基于 §6.1 跑通后的真实 case 集合)。

---

## 7 · 不做什么(范围划线)

立项即划线 · 这些不在本专题范围:

- **不做 GUI / web 前端**:仍然是 Phase 5 markdown 报告 + SVG 文件 · 不引入 webapp。
- **不替换 `cpu-flamegraph` 独立 plugin**:本专题在 perf-kp-sql 这一侧加增强 · cpu-flamegraph 作为 SSH 采集 + SVG 渲染的底座保持稳定;增强大多落在 perf-kp-sql 的 wrapper / 报告阶段 · 必要时 PR 反哺 cpu-flamegraph。
- **不做 eBPF 自研采集**:仍走 `perf record` · eBPF 类采集另开专题。
- **不做实时火焰图**:`perf record` 默认 3s 一次性采集语义不变 · 实时流式不在范围。

---

## 8 · 跟踪表

| 方向 | 状态 | 启动周 | 责任人 | 评审者(异模型) | 实际工时 |
|---|---|---|---|---|---|
| 3.4 SVG 标注 + 文字解读 | backlog | W3(5/19) | TBD | TBD | — |
| 3.3 LLM 语义反查 case_id | backlog | W4 | TBD | TBD | — |
| 3.1 off-CPU 对照 | backlog | W4(并行 3.3) | TBD | TBD | — |
| 3.2 多层栈追踪 | backlog | W6 | TBD | TBD | — |
| 3.5 历史对比 | backlog | 远期 | TBD | TBD | — |

> 启动后此表由专题 owner 维护 · 评审走"团队"模式(语义/架构 + 安全/边界 双路 · 见全局开发偏好)。
