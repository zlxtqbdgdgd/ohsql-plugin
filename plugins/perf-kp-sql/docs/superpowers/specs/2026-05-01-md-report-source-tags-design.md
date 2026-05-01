# 诊断报告 5 标签来源标记系统设计

## 背景

perf-kp-sql 诊断报告 (`.md`) 的每条事实可能来自 5 个完全不同的来源:

1. **`cases/INDEX.md`** — Phase 2 路由命中的 case_id
2. **`cases/KB.md` / `best-practice/KB.md`** — Phase 2.3 / Phase 3 Read 出来的 case 字段(likely_causes / mechanism_quote / abnormal_pattern_threshold / source_url / 诊断命令本身)
3. **NotebookLM** — Phase 4 query / query-batch 返回的答复正文与 references
4. **现场 SSH 采集** — Phase 3 命令 stdout 提取的实测指标(cache used=94.7% 之类)
5. **LLM 推断** — 模型自由发挥(主观判断、连接性叙述、排序与汇总判断、文字润色)

实际报告里这 5 类事实**混在同一段、同一个表格 cell、甚至同一个 `<br>` 行**里,无法逆推哪条来自哪里。这给了 LLM "假装看了 stdout · 自己编个数" 的空间——已观察到的失败模式之一。

## 目标

给报告 `.md` 加一套 5 类来源标签,把每个原子事实的来源标到字面上,方便 audit 时一眼分清。

定位是 **debug 标记**,不是给最终用户看的样式——所以:

- 标签**全量进 `.md` 文件**(audit 入口)
- 标签**从 chat 输出剥掉**(日常体验不打折)

## 非目标

- 不迁移历史报告(`~/.perf-kp-sql/reports/` 下旧 `.md` 不动)
- 不重写 SKILL.md 的 Phase 0-4(那些阶段不产报告)
- 不引入 npm / 第三方包(plugin 目前零 npm 运行时依赖,要保留)

## 5 标签集

| 标签 | 含义 | 触发条件(严格) |
|---|---|---|
| `[IDX]` | cases/INDEX.md(路由命中) | case_id 命中、现象→case 的归类、tier 标签 |
| `[KB]`  | cases/KB.md / best-practice/KB.md(字段 verbatim) | likely_causes、mechanism_quote、abnormal_pattern_threshold、source_url、诊断命令本身 |
| `[NLM]` | NotebookLM 答复(query / query-batch) | NLM stdout JSON 的 `references[].source_id` 或答复正文 |
| `[OBS]` | 现场 SSH 采集(Phase 3 命令 stdout 提取) | cache used=94.7% / dirty ratio=18% / vm.swappiness=60 之类的实测值 |
| `[LLM]` | 模型自由推断 / 连接性叙述 | 主观判断("接近"/"远超"等修饰)、排序与汇总、措辞润色——上面 4 类都不挂时必挂这个 |

**核心规则**:每个原子事实**有且只有 1 个**标签——5 选 1。

**原子事实定义**:一个不可再分的断言。例如:
- 一个实测值(`cache used=94.7%`)
- 一个阈值(`KB 推荐 vm.swappiness=1`)
- 一个比较结论(`接近阈值 95%`)
- 一条建议命令(`sysctl -w vm.swappiness=1`)
- 一个判定(`风险等级 high`)

如果一句话里塞了两类来源的事实 → **拆成两个原子,各自挂标签**。不允许多标签 / 联合标签(`[OBS+KB]` 禁止)。

`[参考N]` 角标是脚注引用,不算来源标签,可以和 5 类标签共存(典型组合:`cache used=94.7% [OBS][参考3]`)。

## 标签放置规则

### 表格 cell 内部

现有 `<br>` 20-字符硬规则**继续生效**(终端渲染需要)。

- **常见情形(95%)**:每个 `<br>` 行恰好装一个原子 → 行末挂标签
  ```
  cache used=94.7% [OBS]<br>接近阈值 95% [KB]<br>dirty ratio=18% [OBS]<br>远超 target 5% [KB]
  ```
- **罕见情形**:一个 `<br>` 行挤得下两个短原子 → 用 ` · ` 分开,各自挂标签
  ```
  cache=94.7% [OBS] · 阈=95% [KB]<br>dirty=18% [OBS] · target=5% [KB]
  ```
- **超长原子**:单原子 >20 字符独占一个 `<br>` 行 → 行末挂标签

### 非表格段落(`## 现场观测` 等)

按句末标点(`。` / `;` / `?` / `!` / `:`)切分,每个句子末尾挂 1 个标签:
```
- **stress_test.cpu_burn 集合上 4 个并发 $where JS** [OBS]:db.currentOp 抓到 4 个 active query [OBS] · planSummary=COLLSCAN [OBS] · runtime 52-500s [OBS]
  - 建议措施:`db.currentOp(...).inprog.forEach(op => db.adminCommand({killOp:1, op:op.opid}))` 立即止损 [LLM] · 排查发起方 [LLM] · 改写为可索引查询(凭经验·非权威) [LLM]
```

### 风险等级 / 置信度列

cell 内容本身就一个词(high / 高),cell 末尾挂 `[LLM]`(这俩本质是模型主观判定):
```
| ... | ... | ... | high [LLM] | 高 [LLM] | [参考1] |
```

### 参考来源列

`[参考N]` 角标即可,不再挂 5 类标签(URL 来源在 `## 参考` 段已标)。

## Legend(报告顶部)

每份 `.md` 报告**必须**在标题与元数据后、`## 诊断结果` 前插入一段 5 标签 legend:

```markdown
# perf-kp-sql · 性能诊断报告

- 诊断时间:<本地时间>
- 目标主机:<ip> · <user> · port=<port> · engine=<engine>
- 环境:<os_distro> <kernel> · <arch> · <cpu_model> · <mongod_version> · <deploy_form>

## 来源标记 (debug)

| 标记 | 含义 |
|---|---|
| `[IDX]` | cases/INDEX.md(路由命中) |
| `[KB]`  | cases/KB.md / best-practice/KB.md(字段 verbatim) |
| `[NLM]` | NotebookLM 答复(query / query-batch references) |
| `[OBS]` | 现场 SSH 采集(Phase 3 命令 stdout 提取) |
| `[LLM]` | 模型自由推断 / 连接性叙述(无 KB/NLM/IDX/OBS 兜底) |

## 诊断结果
...
```

## `## 参考` 段:`(KB)` / `(NLM)` → `[KB]` / `[NLM]`

现有报告骨架的 `## 参考` 段每条引用末尾用圆括号 `(KB)` / `(NLM)`:
```
[参考1] WiredTiger Tuning — source.wiredtiger.com (KB)
        https://source.wiredtiger.com/mongodb-6.0/tune_cache.html
```

改成方括号,与 5 标签系统对齐:
```
[参考1] WiredTiger Tuning — source.wiredtiger.com [KB]
        https://source.wiredtiger.com/mongodb-6.0/tune_cache.html
```

整个报告里只存在一套 `[KB]` / `[NLM]` 字面,不与正文标签混淆。

## 验证机制(双保险)

### 1. SKILL.md Phase 5.2 硬规则

新增 sub-section "**5 标签来源标记(强制)**":

- 列出 5 个标签的严格触发条件
- 给正例(每行/每句末尾挂 1 个标签)
- 给反例(裸事实 / 多标签 / 联合标签)
- 写明"输出前必须 self-check:每个原子事实是否挂了恰好 1 个 5 选 1 标签"

### 2. `format-chat.mjs` 加 lint pass

`format-chat.mjs` 当前职责:读 `.md` 报告 → 按终端宽度重排 cell → 输出 chat 文本到 stdout。

新增两步,执行顺序:

**Step 0(新增 · 报告读入后立刻):lint**

扫描 `.md` 文件,对每个**潜在原子位置**检查是否挂了 5 标签之一:

- **表格 cell**:每个 `<br>` 分隔的子串,以及每个 ` · ` 分隔的子原子(如果 cell 内用了 ` · `)
- **非表格段落**:每个句末标点(`。` / `;` / `?` / `!` / `:`)前的子句
- **legend 段(`## 来源标记 (debug)`)与参考段(`## 参考`)豁免**——不参与 lint
- **空 cell / 表头行 / 分隔行 / 引言文字 / 标题行豁免**

**判定**:漏挂率 = 漏挂位置数 / 总潜在原子位置数。**> 5%** → exit code 2,stderr 列出**前 10 个**漏挂行的位置(行号 + 文本片段)。

**豁免规则(不参与 lint)**:

- 标题行(`#` 开头)
- 空行
- table 分隔行(`|---|`)
- table 表头行(`|---|` 上面那行)
- blockquote 行(`>` 开头)
- code fence 内的所有行(\`\`\` 围栏之间)
- 报告元数据块(从 `# perf-kp-sql · 性能诊断报告` 起,到第一个 `## ` 之前的所有行——这部分是 header 不是诊断事实)
- legend 段(`## 来源标记 (debug)` 起,到下一个 `## ` 之前)
- 参考段(`## 参考` 起,到文件末尾或下一个 `## ` 之前)

**Step 1(新增 · lint 通过后):chat 标签剥离**

输出 chat 文本前,正则替换掉:

- 5 个标签字面:`\s*\[(IDX|KB|NLM|OBS|LLM)\]` → 删除
- legend 整段:从 `## 来源标记 (debug)` 起到下一个 `## ` 前的所有行 → 删除
- `## 参考` 段的 `[KB]` / `[NLM]` 也剥(保持 chat 一致性)

`.md` 文件本身不被任何写入操作触碰——剥离只发生在 stdout 输出流。

### Lint 实现细节

**原子位置识别(粗略 · 不做语义解析)**:

```
for each line in md:
  if line matches any 豁免规则: skip

  if line is table data row (starts with `|` and not separator/header):
    split by `|` → cells
    for each cell:
      split by `<br>` → sublines
      for each subline (trim whitespace, skip empty):
        if subline contains ` · `:
          split by ` · ` → sub-atoms
          for each sub-atom: count it as 1 potential atom
        else:
          count subline as 1 potential atom
        check if it ends with one of [IDX|KB|NLM|OBS|LLM]

  else (narrative paragraph / list item · 不在 table · 不在 code block):
    split by [。;?!:] → sentences
    for each sentence with ≥ 4 non-whitespace chars:
      count as 1 potential atom
      check if it ends with one of [IDX|KB|NLM|OBS|LLM]
```

**接受偶发假阳**:lint 不识别"原子事实"的真实语义边界,会把"目标主机:10.0.0.1"这种纯元数据当成需要标签的位置。设计上**容忍 5% 漏挂**作为假阳缓冲。如果实际跑下来假阳常见(>10%),再降阈值或加豁免规则。

### Lint 输出与 SKILL.md 协作

- lint 失败 (exit 2) 时 stderr 必含**前 10 个**漏挂位置(行号 + 文本片段),让 LLM 知道改哪里
- SKILL.md Phase 5.4 的 Step 1(调 format-chat.mjs)新增"如果 exit code = 2 → 报告漏标 → 必须回 5.2 重写报告"
- 与现有的 4 条 chat self-check 硬规则平级——共同构成"格式纠察"层

## 改动清单

| 文件 | 改动类型 | 内容 |
|---|---|---|
| `scripts/format-chat.mjs` | 改 | 加 Step 0 lint + Step 1 标签剥离 |
| `skills/perf-kp-sql/SKILL.md` Phase 5.2 | 改 | 新增"5 标签来源标记(强制)"sub-section + 正反例 + self-check 条款 |
| `skills/perf-kp-sql/SKILL.md` Phase 5.2 报告骨架 | 改 | 加 legend 段 · 表格示例每个 cell 加标签 · `## 参考` 段 `(KB)/(NLM)` → `[KB]/[NLM]` |
| `skills/perf-kp-sql/SKILL.md` Phase 5.4 | 改 | format-chat.mjs lint 失败的处置流程("exit 2 → 必须回 5.2 重写") |
| `skills/perf-kp-sql/SKILL.md` `## 参考` 段格式规范小节 | 改 | `(KB)` / `(NLM)` 写法改成 `[KB]` / `[NLM]` |

per-commit 的版本号 bump 由实现 plan 处理(本文件是 design,不规定 commit 粒度)。

不改:`docs/superpowers/specs/2026-04-30-format-chat-adaptive-table-design.md` 是历史档案,留着不动(指 spec 文档,不是 format-chat.mjs 实现)。

## 风险与权衡

**风险 1**:lint 假阳率不可预知。第一版按"句末/行末挂 5 选 1 标签"粗略实现,真实场景可能假阳偏高(把"目标主机:10.0.0.1"当成需要标签的事实)。

**缓冲**:5% 容忍阈值 + 豁免规则(legend / 参考 / 表头 / 元数据行)可以兜大部分假阳。如果实跑下来仍偏高,降阈值或加豁免。

**风险 2**:LLM 第一次写新格式会大概率不达标,触发重写。

**缓冲**:SKILL.md 的正反例必须写得足够具体,把 LLM 的"自由发挥空间"压到最小。`[LLM]` 标签是兜底——既然 LLM 自由推断也要挂标签,就不存在"忘了挂"的合理借口。

**权衡**:legend 段固定占 7-8 行 markdown。每份报告多 ~80 字节。值得——一次诊断流程产 ~3KB 报告,legend 占比 < 3%,且 audit 必需。
