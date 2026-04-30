# format-chat.mjs — 终端宽度自适应表格折行

## 背景

perf-kp-sql 诊断报告的 `## 诊断结果` 是一个 6 列 markdown pipe table。Claude Code / Codex CLI / ohsql 等终端渲染器在表总显示宽度超过终端列数时，会将表降级为"字段: 值"竖排卡片——丢失表结构，可读性差。

用户放大终端字体（终端列数减少）是常见场景，需要适配。

## 目标

新建独立脚本 `scripts/format-chat.mjs`，在 chat 输出前对诊断结果表按终端宽度重新折行（调整 cell 内 `<br>` 位置），使 6 列 pipe table 在不同终端宽度下始终能被渲染为表格。

## 设计约束

- **只作用于 chat 输出**：落盘的 `.md` 报告和 `-chat.md` 文件保持宽版不变（存档用途）
- **表结构不变**：始终 6 列 pipe table，不砍列、不换卡片
- **火焰图段不处理**：`## 火焰图分析` 内的 ASCII 表格（code block）原样透传
- **最小宽度 80 列**：cols < 80 时钳位到 80（每列最少约 12 个显示字符）
- **不与用户交互**：静默处理，无提示
- **跨 CLI 兼容**：Claude Code / Codex CLI / ohsql 均可用

## 接口

```
node scripts/format-chat.mjs --chat <chat.md 路径> [--cols N]
```

| 参数 | 说明 |
|---|---|
| `--chat` | 必填。`-chat.md` 文件路径（由 `md-to-html.mjs` Phase 5 生成） |
| `--cols` | 可选。终端列数。缺省按以下优先级取值：(1) `process.stdout.columns` (2) 默认 100 |

输出：折行后的完整 chat 文本，写到 stdout。

退出码：0 成功，1 参数错误 / 文件不存在，2 未找到诊断结果表。

## 核心算法

### 1. 定位 pipe table

读入 chat.md 全文，按行扫描：
- 找到 `## 诊断结果` 标题行
- 向下找到第一个 `|---|` 分隔行 → 确认表头和分隔行
- 从分隔行下一行开始，连续以 `|` 开头的行为数据行
- 遇到空行或非 `|` 开头行 → 表结束

### 2. 计算每列显示宽度预算

```
budget = floor((cols - 7) / 6)
budget = max(budget, 8)
```

- `7` = 7 个 `|` 字符（6 列 = 首尾各 1 + 列间 5）
- 每列最少 8 个显示字符（低于此无可读性）

### 3. 对每个 cell 重新折行

对每个数据行的每个 cell：

1. **去掉现有 `<br>`**：替换为空格，得到纯文本
2. **按 budget 重新断行**：
   - 逐字符累加显示宽度（CJK 字符 2 宽，ASCII 1 宽）
   - 累加宽度达到 budget 时，在最近的断词点插入 `<br>`
   - 断词点优先级：`·` > 空格 > `→` > `+` > `/` > `(` > 强制断
3. **重组 cell 内容**

### 4. 重组输出

- 表头行：原样保留（表头通常较短，不做折行）
- 分隔行：原样保留
- 数据行：用重新折行后的 cell 内容重组
- 其他所有内容（标题、火焰图、头尾文字）：原样透传

### 宽度计算示例

| 终端宽度 | 每列预算 | 说明 |
|---|---|---|
| 200 | 32 字符 | 宽屏，几乎不需要额外折行 |
| 120 | 18 字符 | 接近当前 SKILL.md 的 ≤20 规则 |
| 100 | 15 字符 | 默认值（无 TTY 时） |
| 80 | 12 字符 | 最小支持宽度，cell 内换行较多但表结构保持 |

## CJK 宽度计算

使用 Unicode East Asian Width 属性判断：
- Fullwidth (F) / Wide (W)：2 个显示列
- 其他（ASCII、半角标点等）：1 个显示列

实现方式：内联一个轻量的 `displayWidth(char)` 函数，基于 Unicode 码点范围判断。不引入外部依赖（如 `string-width`），保持零依赖。

## Phase 5.4 调用流程变化

```
# 现有流程不变
Write(report.md)
Bash(node md-to-html.mjs report.md report.html)
  → 生成 report.html + report-chat.md（宽版）

# 新增：按终端宽度折行
Bash(COLS=$(tput cols 2>/dev/null || echo ""); node format-chat.mjs --chat report-chat.md ${COLS:+--cols $COLS})
  → stdout = 折行后的 chat 文本

# LLM 从 stdout 拿折行后的文本 → 字面复制到 chat
```

注意：`format-chat.mjs` 输出到 stdout（不落盘），LLM 从 Bash 结果直接拿。`-chat.md` 文件保持宽版存档不变。

## SKILL.md 变更

Phase 5.4 的调用模板需要更新：
- 原：`Read(report-chat.md)` → 字面复制
- 新：`Bash(node format-chat.mjs --chat report-chat.md --cols $(tput cols))` → 从 stdout 字面复制

self-check 4 条硬规则不变（`|---|` 必含 / `|` ≥ 30 次 / 不许独占行 `────` / 不许 ≥ 3 个"字段: 值"行）。

## 文件清单

| 文件 | 动作 |
|---|---|
| `scripts/format-chat.mjs` | 新建 |
| `skills/perf-kp-sql/SKILL.md` | 修改 Phase 5.4 调用模板 |

## 不在范围内

- HTML 报告适配（不处理）
- 火焰图 ASCII 表适配（不处理）
- 列数减少 / 卡片格式（不做）
- `.md` 报告文件的宽度适配（不做）
