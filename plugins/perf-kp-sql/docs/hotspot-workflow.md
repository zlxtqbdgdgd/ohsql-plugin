# 火焰图分析工作流

## 采样授权
使用 perf / eBPF 前必须告知用户预计开销（如"约 3% CPU"）。

授权判定：
- 用户说"授权/快查/同意/去查/抓一下/分析一下" → 视为授权，执行前用一行说明开销后立即执行
- 用户只描述症状但未明确要求 → 主动征求授权

## 采集输出字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `step2_brief` | string | **Step 2 输出专用**，1 行简报（CPU 时间 + scope + Top1），直接在 Step 2 代码块原样输出，不再贴表 |
| `step4_hotspot_detail` | string | **Step 4 综合报告专用**，完整 Self/Inclusive 表 + scope 提示；填入 REPORT_TEMPLATE 的 "── 热点分析 ──" 小节 |
| `top_functions` | array | Top-N 热点函数结构化数据（供知识库检索/后续分析，不直接输出给用户）|
| `svg_path` | string \\| null | On-CPU 火焰图 SVG 本地路径 |
| `rag_analysis` | array | 针对 Top 热点函数自动 RAG 检索的结果 |

## 三段式分析输出

### 第一段：热点概览
- 表格列出 `top_functions` Top-5：排名 / 函数 / 占比 / 分类 / 组件
- 如有 `svg_path`，附下载命令：`scp root@<HOST>:/tmp/flamegraph_oncpu.svg . && open flamegraph_oncpu.svg`

### 第二段：调用链与根因
- 取 Top-1 热点函数，展示 callers / callees 树形缩进
- 结合占比、锁等待（futex/mutex）、调用链分布，给出根因判断
- 如有 `source` 字段，补充源码定位

### 第三段：结论与建议
- 根因分类：① 调参可解 / ② 改代码 / ③ 升级版本
- 给出具体建议 + 风险等级（低/中/高）
- 如有 `rag_analysis`，用 `[N]` 标注知识库引用；没有则说明"知识库未覆盖此函数"

## 规则约束
- 总计不超过 25 行。如需详细展开，追问"需要看完整分析吗？"
- 深度分析完成后，无论结果如何都必须附上 SVG 下载命令（信息量远超文本摘要）
- 用户授权后采集完成只通知完毕，详细结果留到 Step 4 统一报告
