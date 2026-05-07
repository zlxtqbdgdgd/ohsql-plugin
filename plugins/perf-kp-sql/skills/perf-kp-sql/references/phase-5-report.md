# Phase 5 · 报告生成

> 本文档由主 SKILL.md 在 Phase 5 入口处通过 router 指令加载。LLM 进入 Phase 5 时必须 Read 本文件 · 然后按 5.1/5.2/5.3/5.4 流程操作。
>
> **关键约束(Phase 5.4 self-check 4 条规则)在主 SKILL `# 红线` 段也复制了一份 · 防止 reference 失效**。

---

### 5.1 · 汇总根因 + 排序

按风险等级(`risk_severity`):high → warning → info。

### 5.2 · 写 markdown 报告

#### 步骤 0 · Read phase4-trace.md(防止 thinking 间字段丢失)

Phase 5.2 第一动作 Read 刚 Phase 4.C 落盘的 trace 文件(同 turn · 字段全在 in-memory · Read 是字面回拉防止 thinking 间 LLM 重组失真):

```
Read(file_path="/Users/<yourlogin>/.perf-kp-sql/runs/<TS>/phase4-trace.md")
```

后续 5.2 写报告的所有字段(case_id / `[参考N]` URL / `判定依据` / `建议措施`)**必须从 trace 字面抽取** · 不许凭记忆重组。

设计书 §6.1 单层 6 列表 · 报告骨架:

#### 表格单元格 `<br>` 换行规范(终端渲染必需)

Claude Code / ohsql 终端宽度通常 80-120 列。6 列 pipe table 如果单行超过终端宽度 · 渲染器会降级成"字段: 值"竖排卡片 · 表结构丢失。

**强制规则**:每个单元格内容**必须用 `<br>` 拆成多个短行** · 每行显示宽度 ≤ 20 个字符(CJK 算 2 宽)。具体:

- **确认的根因**:≤ 20 字符/行 · 用 `<br>` 断
- **判定依据**:每个证据点一行 · `<br>` 分隔 · 每行 ≤ 20 字符
- **建议措施**:止损 / 长期各一行 · 命令单独一行 · 命令可适当长(终端会自动折行)但前缀文字要短
- **风险等级 / 置信度 / 参考来源**:本身短 · 不需要 `<br>`

**示例**(正确):
```
| 确认的根因 | 判定依据 | 建议措施 | 风险等级 | 置信度 | 参考来源 |
|---|---|---|---|---|---|
| WT eviction<br>dirty_target<br>与负载不匹配 | cache used=94.7%<br>接近阈值 95%<br>dirty ratio=18%<br>远超 target 5% | 调低 target=3%:<br>`db.adminCommand(…)` | high | 高 | [参考1] |
| vm.swappiness<br>过高 | 当前值=60<br>案例 推荐=1<br>NLM 确认=1 | `sysctl -w`<br>`vm.swappiness=1`<br>写入 sysctl.conf | warning | 中 | [参考2] |
```

**反例**(错误 · 会触发竖排降级):
```
| eviction_dirty_target 与业务负载不匹配 | cache used=94.7% 接近阈值95% + dirty ratio=18% 远超 target 5% | 调低 eviction_dirty_target=3%:`db.adminCommand({setParameter:1, wiredTigerEngineRuntimeConfig:"eviction_dirty_target=3"})` | high | 高 | [参考1] |
```
(单行 549 显示字符 · 远超 80 列终端 · 必然降级)

#### 5 标签来源标记(强制)

每份报告**必须**带一段 `## 来源标记 (debug)` legend(放在报告元数据后、`## 诊断结果` 前 · 见骨架),并在正文每个**原子事实**末尾挂 1 个 5 选 1 标签:

| 标签 | 触发(严格) |
|---|---|
| `[IDX]` | case_id 命中、现象→case 归类、tier 标签 |
| `[CASE]`  | likely_causes / mechanism_quote / abnormal_pattern_threshold / source_url / 诊断命令本身 — 来自 cases/CASES.md 或 best-practice/CASES.md 字段 verbatim |
| `[NLM]` | NotebookLM stdout JSON 的 references[].source_id 或答复正文 |
| `[OBS]` | Phase 3 SSH 命令 stdout 提取的实测值(cache used=94.7% / vm.swappiness=60 之类) |
| `[LLM]` | 模型自由推断 · 连接性叙述 · 排序与汇总 — 上面 4 类均无兜底时**必挂** |

**核心规则**:每个原子事实(一个不可再分的断言:实测值 / 阈值 / 比较结论 / 一条命令 / 一个判定)**有且只有 1 个**标签 · 5 选 1 · 不允许联合标签(`[OBS+案例]` 禁止) · 不允许漏挂(凡是模型自由发挥都挂 `[LLM]`)。

**多源拆句**:如果一句话/一行混了两类来源(例 "cache=94.7%(OBS)接近阈值 95%(案例)"),**必须拆成两个原子**,各挂各的标签:
```
cache used=94.7% [OBS]<br>接近阈值 95% [CASE]
```

**`[参考N]` 角标共存**:`[参考N]` 是脚注引用 · 不算来源标签 · 可与 5 标签共存:
```
cache used=94.7% [OBS][参考3]
```

**正例**(诊断依据 cell · 4 个 `<br>` 行 · 每行一个原子 · 各挂标签):
```
cache used=94.7% [OBS]<br>接近阈值 95% [CASE]<br>dirty ratio=18% [OBS]<br>远超 target 5% [CASE]
```

**反例**(漏挂):
```
cache used=94.7%<br>接近阈值 95%<br>dirty ratio=18%<br>远超 target 5%
```
↑ 必须每个 `<br>` 子句末尾各挂 1 个 5 标签。CLI 不 lint 5 标签,合规靠 Phase 5.4 self-check 4 条规则兜底。

**风险等级 / 置信度** 列内容本身就一个词(`high` / `高`),cell 末尾挂 `[LLM]`(主观判定):
```
| ... | ... | ... | high [LLM] | 高 [LLM] | [参考1] |
```

**参考来源** 列只放 `[参考N]` 角标,不挂 5 标签(URL 来源在 `## 参考` 段已标)。

**Self-check(写完报告后必须):**
- 表格 `## 诊断结果` 每个 cell 内每个 `<br>` 行末尾(或 ` · ` 切出来的每个 sub-atom)是否各挂 1 个标签?
- `## 现场观测` 段每个原子事实(一个 bullet · 一个句子 · 一段命令)是否各挂 1 个标签?
- `## 参考` 段每条引用第 1 行末尾是否挂了 `[CASE]` 或 `[NLM]`?
- legend 段(`## 来源标记 (debug)`)是否就在元数据后、诊断结果前的位置?

漏挂的拦截在 Phase 5.4 self-check(4 条规则,本节末尾) · 不依赖 CLI lint。设计参考:`docs/superpowers/specs/2026-05-01-md-report-source-tags-design.md`(标记规范仍生效)。

#### 报告骨架

> **开场白段强制**:报告**最顶部**(标题 `# perf-kp-sql · 性能诊断报告` 之前)**必须**字面复制 chat 通道的开场白文本(详见文档顶部 `# 开场白` 段) · 用 `~~~` 围栏包裹避免跟外层 markdown 内容冲突。该段在 ## 标题之前 · box-drawing CLI 渲染时只透传不解析 · 但**不许省略**。

```markdown
~~~
[perf-kp-sql · 鲲鹏 + MongoDB 性能诊断]

我是一个鲲鹏场景下泛数据库性能诊断 skill,基于 202 条诊断案例 + NotebookLM 联网知识库,会通过以下流程定位性能瓶颈与根因:

  1. 环境信息采集
  2. 诊断案例匹配
  3. 诊断指标采集
  4. 多源综合诊断
  5. 报告生成

中途会问你:SSH 凭据、问题现象。
~~~

# perf-kp-sql · 性能诊断报告

- 诊断时间:<本地时间>
- 目标主机:<ip> · <user> · port=<port> · engine=<engine>
- 环境:<os_distro> <kernel> · <arch> · <cpu_model> · <mongod_version> · <deploy_form>

## 来源标记 (debug)

| 标记 | 含义 |
|---|---|
| `[IDX]` | cases/INDEX.md(路由命中) |
| `[CASE]`  | cases/CASES.md / best-practice/CASES.md(字段 verbatim) |
| `[NLM]` | NotebookLM 答复(query / query-batch references) |
| `[OBS]` | 现场 SSH 采集(Phase 3 命令 stdout 提取) |
| `[LLM]` | 模型自由推断 / 连接性叙述(无 案例/NLM/IDX/OBS 兜底) |

## 诊断结果

| 确认的根因 | 判定依据 | 建议措施 | 风险等级 | 置信度 | 参考来源 |
|---|---|---|---|---|---|
| WT eviction [CASE]<br>dirty_target [CASE]<br>与负载不匹配 [LLM] | cache used=94.7% [OBS]<br>接近阈值 95% [CASE]<br>dirty ratio=18% [OBS]<br>远超 target 5% [CASE] | 调低 target=3% [LLM]:<br>`db.adminCommand(…)` [CASE] | high [LLM] | 高 [LLM] | [参考1] |
| vm.swappiness [CASE]<br>过高 [LLM] | 当前值=60 [OBS]<br>案例 推荐=1 [CASE]<br>NLM 确认=1 [NLM] | `sysctl -w` [CASE]<br>`vm.swappiness=1` [CASE]<br>写入 sysctl.conf [LLM] | warning [LLM] | 中 [LLM] | [参考2] |

## 火焰图分析(若 Phase 3.A.3 采到)

(此处插入 capture-flamegraph.mjs 输出的 Top-N 文本块 [LLM] · 用 markdown 缩进代码块或 ~~~ 围栏避免跟外层 \`\`\`markdown 围栏冲突 [LLM])

## 现场观测(无权威来源 · 仅供参考 · 可选段 · 仅 案例 和 NLM 都无背书的根因才进这里)

> 以下根因基于现场指标观测 · 但 案例 和 NotebookLM 均无对应权威文档背书 · 请独立验证后再采取行动:

- **stress_test.cpu_burn 集合上 4 个并发 \$where JS 跑三角函数烧 CPU** [OBS]:db.currentOp 抓到 4 个 active query [OBS] · planSummary=COLLSCAN [OBS] · runtime 52-500s [OBS] · 客户端 127.0.0.1 [OBS]
  - 建议措施:`db.currentOp({active:true,ns:"stress_test.cpu_burn"}).inprog.forEach(op => db.adminCommand({killOp:1, op:op.opid}))` 立即止损 [LLM] · 排查发起方 [LLM] · 改写为可索引查询(凭经验·非权威) [LLM]
  - 现场证据:`<贴 currentOp 输出片段>` [OBS]

## 参考

[参考1] WiredTiger Tuning — source.wiredtiger.com [CASE]
        https://source.wiredtiger.com/mongodb-6.0/tune_cache.html
[参考2] vm.swappiness 内核参数 — kernel.org [NLM]
        https://www.kernel.org/doc/Documentation/sysctl/vm.txt
```

**`## 参考` 段格式规范**:

每条引用两行:
- 第 1 行:`[参考N] <标题> — <domain> [<来源标签>]`
- 第 2 行:`        <完整 URL>`(8 空格缩进)

**来源标签**(与正文 5 标签系统对齐 · 一律方括号):
- `[CASE]` — 来自 CASES.md case 的 `source_url` 字段
- `[NLM]` — 来自 NotebookLM 返回的 `references[].source_id`

**标题提取**:
- 案例 来源:用 case 的 `source_heading` 字段 · 没有时用 `title` 字段
- NLM 来源:用 NLM 返回的 `references[].title` 字段 · 没有时从 URL 路径推断短标题

**domain 提取**:从 URL 取 hostname · 去 `www.` 前缀(例 `mongodb.com` · `kernel.org` · `cnblogs.com/huaweicloud`)

### `[参考N]` URL 强制溯源约束(绝对红线)

**[参考N]** 的 URL **必须**来自以下两类来源之一 · **没有第三类**:

1. **Phase 2.3 Read 出来的 case `source_url` 字段字面值**(CASES.md 里 `## case_id: <id>` 段下的 `- **source_url**: <url>` 那一行)
2. **NLM 返回的 `references[].source_id` 字面值**(notebooklm.mjs query / query-batch 的 stdout JSON)

**绝对禁止**:
- ❌ 凭记忆 / 训练数据 / URL 命名模式推断写 URL("看起来合理"也不行)
- ❌ 案例 没有对应 case 但根因合理 → 编一个 URL 凑数

**案例 / NLM 都没有 source_url 时 · 强制处理**:

⚠️ **该根因不进诊断表**(诊断表是有权威背书的清单 · 不是观察日志)。两种正确处理:

**首选 · 先尝试 NLM 兜底**:
- 给该现象单独发一条 NLM query(详见 Phase 4 "根因来源强约束")· 拿到 NLM answer + references → 可以进表
- 如果 NLM 返回鉴权失败 → 必须走 NLM-relogin 流程(详见 Phase 0.10)· 不许直接放弃
- 如果 NLM 答不出来 / 没 references → 走下面"次选"

**次选 · 移到 `## 现场观测(无权威来源)` 段**:
- 该根因从主诊断表里**删掉**
- 加到报告末尾的独立段:
  ```markdown
  ## 现场观测(无权威来源 · 仅供参考)

  > 以下根因基于现场指标观测 · 但 案例 和 NotebookLM 均无对应权威文档背书 · 请独立验证后再采取行动:

  - **<根因描述>**:<判定依据>
    - 建议措施:<可选 · LLM 凭经验给 · 标"凭经验 · 非权威">
    - 现场证据:<具体的 SSH/Bash 命令输出片段>
  ```
- **绝对禁止**:把这种根因混进 `## 诊断结果` 主表 · 即使标 `(无案例引用)` · 也不许进主表

**自检规则**(写 5.2 markdown 表前 LLM 必须自检):
- 主诊断表 `## 诊断结果` 表里每一行的 "参考来源" 列 · `[参考N]` 必须能逐条溯回:
  - Phase 2.3 Read 拿到的某个 case 的 source_url 字段(给出 case_id 在内部记录)· 或
  - NLM batch / single query 返回的某条 reference
- 不能溯源的 → **从主表删除** · **移到 `## 现场观测` 段**(不是改写"参考来源"为"无 案例 引用" 留在主表)
- 报告末尾 `## 参考` 段的 URL list 里 · **每个 URL 都必须出现在上面 案例 Read 或 NLM 返回的输出里** · 不许新增

### 5.3 · 落盘(单目录归档)

```
Write(file_path="/Users/<yourlogin>/.perf-kp-sql/runs/<TS>/report.md", content="<markdown 字面>")
```

火焰图 SVG 由 Phase 3.A.3 的 `capture-flamegraph.mjs --local-svg-out=...` 直接落到 run 目录 · 这一步无需额外动作。如果 wrapper 报告 scp 失败(stderr 打了 `scp 失败 ... 远端 SVG 路径: <path>`) · LLM 可以手动 `scp` / `mv` 兜底:

```
Bash(command="scp -o ControlPath=$HOME/.ssh/perf-kp-sql/cm-<hash>.sock -- <user>@<ip>:<远端SVG路径> /Users/<yourlogin>/.perf-kp-sql/runs/<TS>/flame.svg")
```

(`<hash>` = sha1(`<host>:<port>:<user>`)[:12] · 跟 ssh.mjs 内部一致。ControlPath 走 `~/.ssh/perf-kp-sql/`(0700)· 长 HOME 回退 `<tmpdir>/perf-kp-sql-cm-<hash>.sock`。ControlMaster 还存活时 scp 不重新 auth)。

Phase 5.4 的 `format-chat.mjs` 直接读这个 `runs/<TS>/report.md` 文件。

### 5.4 · session-close + chat 输出格式化报告

#### 强制操作步骤(不许跳 · 不许重新组织语言)

LLM 这一步**必须严格按操作步骤来 · 不许自由发挥**:

**步骤 1 · 同 message 并行触发 session-close + format-chat**:两个 Bash 独立(session-close 是 fire-and-forget 收 master,stdout 仅 `{ok:true}` 不进 chat;format-chat 的 stdout 才是步骤 2 字面复制源),同一个 assistant message 内发两个 Bash content block:

```
Bash(command="node <PLUGIN_ROOT>/scripts/ssh.mjs --op session-close \
       --host <ip> --user <user> [--port <n>]")
Bash(command="node <PLUGIN_ROOT>/scripts/format-chat.mjs --chat /Users/<yourlogin>/.perf-kp-sql/runs/<TS>/report.md --cols 140")
```

> ⚠️ **`--cols 140` 硬编码 · 不许动态探测**:
> - 不许用 `tput cols` 探测 · 它在 Claude Code / Codex / ohsql 的 Bash 工具里没 TTY · 永远返回 80 · 让表渲染成超窄列(右边大片留白)
> - 现代终端默认宽度 ≥120(笔记本 ~180 / 外接显示器 ~250)· 固定 140 对 99% 用户合适
> - 用户真用 80 列窄终端 · format-chat.mjs 内部最小钳位会兜底 · 不会出错

> `format-chat.mjs` 读 .md 报告 · 找 `## 诊断结果` pipe table · 按列宽重排每个 cell 内的 `<br>` 位置 · 表结构 6 列不变 · 其余内容(火焰图段等)原样透传。

**lint 现状(box-drawing 路径):**

`format-chat.mjs` CLI **不再** 调 `lintReport()` —— 5 标签合规靠 Phase 5.2 self-check 兜底(本节
末尾步骤 3 的 4 条规则)。`lintReport / stripChatTags / rewrapTable` 三函数仍 export,供单测 +
外部脚本调用,但 `--chat` CLI 主流程只做 box-drawing 渲染,不会 exit 2。

因此 stderr 不会再出现 `✗ 来源标签 lint 失败` 字样,LLM 不需要监听该错误。

**exit code 含义:**

| exit | 含义 | LLM 处置 |
|---|---|---|
| 0 | 成功渲染 | 字面复制 stdout 到 chat |
| 1 | 参数错 / 文件不存在 | 检查 --report 路径 |
| 2 | 未找到 `## 诊断结果` 表 | 回 Phase 5.2 补全表后再调 |

**步骤 2 · 字面复制**:把 Bash stdout 返回的整段文本**一字不改**地复制到 chat 输出。**字面就是字面**:不重排表为 bullet · 不删 `|` 列分隔 · 不加 emoji · 不加叙述前言 · 不加总结收尾 · 不"挑重点 / 改竖排" / 不"翻译成更友好的话"。

> 步骤 2 是机械复制 · 不是"基于 stdout 内容自己写一份"。stdout 输入 == chat 输出 · 完全相等。

**步骤 3 · self-check(关键 · 复制完之后 LLM 必须在内部跑一次自检 · 失败 = Phase 5.4 未完成 · 必须重做步骤 2)**:

逐条比对 chat 输出文本是否符合下表 4 条规则。**任何一条不满足 → 立即丢弃当前 chat 输出 · 回到步骤 2 重新 Read + 字面复制**(典型病因:LLM 在步骤 2 又"自动美化"了一遍)。

| # | 规则 | 失败信号 |
|---|---|---|
| 1 | ✅ chat 输出**必须包含** `\|---\|` 字符串(markdown 表分隔行特征 · `## 诊断结果` 段第二行就是这个) | 没有 `\|---\|` → 表头/分隔行被吃掉了 → 已被改写 → 违规 |
| 2 | ✅ chat 输出 `\|` 字符出现次数**必须 ≥ 30** 次(6 列 × 5 row = 30 起步 · 包括表头 + 分隔行就更多) | `\|` 数 < 30 → 表已经被压扁成 bullet / 字段竖排 → 违规 |
| 3 | ❌ chat 输出**不许包含** `────`(U+2500 重复 ≥ 4 个)**作为整行 row 分隔线**(典型形态:`────────────────────────────` 独占一行 · 前后是"字段: 值"行)。火焰图段内 `╭────┬─` / `├────┼─` / `╰────┴─` 这种 ASCII 边框由脚本机械生成 · **不算违规**。判据:`────` 行不以 `╭` / `├` / `╰` 开头 → 违规。 | 出现独占一行的 `────` 分隔线 → 已被改成"字段: 值 + ──── 分隔线"竖排 → 违规 |
| 4 | ❌ chat 输出**不许同时连续出现** 以下"字段: 值"行模式 · ≥ 3 个就算违规:`确认的根因:` / `判定依据:` / `建议措施:` / `风险等级:` / `置信度:` / `参考来源:` | 出现 ≥ 3 个 → 已把 markdown 6 列表降级成竖排 → 违规 |

**自检通过判据**:规则 1 ✅ + 规则 2 ✅ + 规则 3 ❌(不出现) + 规则 4 ❌(不出现) · 四条同时满足才算 Phase 5.4 完成。任意一条不满足 · 强制回到步骤 2 重做 · **不许"差不多了就这样"**。

**没有"我写一个简化版"或"竖排更好读"或"补一句总结更友好"的空间** · Read 字面复制是唯一路径。

#### 反例(LLM 经常犯的错 · 严格禁止)

下列都是**没透传 stdout 字面 · 自己重写**才会得到的产物 · 一旦你的 chat 输出长成这样 · 就是违规 · 必须回到步骤 2 重做。

**❌ 反例 · 表换 bullet / 字段竖排**:
```
确认的根因: stress_test.cpu_burn ...
判定依据: db.currentOp 抓到 ...
建议措施: ...
风险等级: high
置信度: 高
参考来源: [参考1] [参考2]
────────────────────────────
确认的根因: ...
```
原 stdout 是 `| 列1 | 列2 | ... |` 的 markdown 表 · 这里被改成 `字段: 值` 竖排 + `────` 分隔。**违规** — 把表降级成纯文本 · 终端不再渲染表格。其他典型违规:用自己的话叙述根因 / 改成 emoji bullet 列表 — 都会被 self-check 规则 1/2 拦截。

**❌ 反例 4 · 自由发挥结尾**:
```
... 这跟鲲鹏 ARM 平台调优无关 · 上次报告里讲的 nohz / THP 等仍是有效改进项,但解决不了这次 $where 烧 CPU 的具体问题。
```
LLM 加的"友好总结" · 不在 stdout 里。**违规** · chat 输出止于 stdout 末行的参考 URL 列表。

**❌ 反例 5 · 立即止损命令裸贴**:
```
立即止损命令(在 mongosh 跑):
db.currentOp(...)forEach(...)
```
止损命令已经在 markdown 表的"建议措施"列里 · 不该单独再起 code block。**违规** — stdout 里没有这段 · 不要"补"。

#### chat 输出格式硬约束

- ✅ 用 Bash 调 `format-chat.mjs`(Phase 5.4 步骤 1) · 把 stdout 字面复制到 chat 输出
- ✅ stdout 字面是报告全文(经终端宽度重排后的 .md 内容)
- ❌ 不要重排 markdown 表为 `字段: 值` 竖排 / bullet 列表
- ❌ 不要 emoji 段标(`⚠️` / `🔴` / `🟡` / `ℹ️`)
- ❌ 不要 `核心结论 / 单一根因 / 关键事实 / 配置层面 / 诊断局限 / 下次怎么做` 等任何叙述段
- ❌ 不要"重新组织语言"/ 自己写新文字 — stdout 字面是唯一正确版本
- ❌ 不要单独 code block 贴止损命令(命令已在表的 row 里)
- ❌ 不要在参考 URL 后面加任何额外文字
- ❌ 不要在表后写"这跟 X 无关 / 这是因为 Y" 这种总结收尾

**ohsql skill-doctor 或 LLM 觉得叙述总结更友好 · 都不许改**。用户给装 perf-kp-sql 就是为了看这个 markdown 表 · 不是 emoji 摘要 · 也不是字段竖排文本。

mark task 5 (报告生成) completed(全 5 步任务 ✔)。

