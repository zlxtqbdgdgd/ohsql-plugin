# Phase 6 · 深入对话(可选 · 用户追问触发)

> 本文档由主 SKILL.md 在 Phase 6 入口处通过 router 指令加载。LLM 进入 Phase 6 时必须 Read 本文件 · 然后按 6.1/6.2/6.3 流程操作。

skill 加载后,任何非 `/` 命令的自然语言输入(典型:用户针对报告某行追问)。两条路径合并回答:

## 6.1 · 案例 路径

报告里每个根因带 `case_id` 引用(从 INDEX line 反查 case_id)。

```
Read(file_path="<PLUGIN_ROOT>/data/cases/CASES.md", offset=<line>, limit=80)
```

抽更多字段:
- DF: `diagnostic_steps[].abnormal_pattern_quote` / `likely_causes[].reasoning_quote`
- Flame: `mechanism_quote` 全量 / `workload_implication_quote`
- 通用: `source_url`(转 [参考N])

## 6.2 · NLM 路径

构造单条追问:

```
Bash(command="node <PLUGIN_ROOT>/scripts/notebooklm.mjs --op query \
       --domain auto \
       --query \"<原话>\" \
       --json", timeout=360000)
```

`--domain auto` 时脚本内部按关键词路由:
- `vm.swappiness` / `dirty_ratio` / `hugepage` / `THP` / `sysctl` / `cgroup` → `os`
- `wiredTiger` / `mongod` / `oplog` / `sharding` / `连接池` / `journal` → `mongo`
- `鲲鹏` / `Kunpeng` / `ARM` / `NUMA` → `kunpeng`
- 关键词未命中 → 查询所有已注册 notebook · 合并回答

## 6.3 · 合并策略

案例 给规则细节 + NLM 给最新推荐 → 各取其长 · 合并回答 · 注引用。

NLM 不可用时只走 案例 · 回答末尾附:
```
💡 如需更精准的最新推荐,请运行 /perf-kp-sql-setup 配置 NotebookLM 增强。
```
