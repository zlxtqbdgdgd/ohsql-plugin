# NotebookLM URL 分布与去重报告

- 生成时间: 2026-05-02T20:35:38.389Z
- 数据源: `data/notebooklm-urls.json`
- notebook 数: 3
- URL 引用总数(含重复): 44
- 唯一 URL 数: 44
- 跨 notebook 出现的 URL 数: 0
- 域名数: 3

## 表 1 · notebook 维度统计

| notebook_id | domain | language | URL 总数 | 唯一 URL 数 |
|---|---|---|---|---|
| ohsql-mongo-kb | mongo | en | 33 | 33 |
| ohsql-kunpeng-kb | kunpeng | zh | 4 | 4 |
| ohsql-os-kb | os | en | 7 | 7 |
| **TOTAL** | - | - | **44** | **44** |

## 表 2 · 跨 notebook 域名分布(按 URL 数降序)

| 域名 | 总 URL 数 | 出现的 notebook |
|---|---|---|
| www.mongodb.com | 33 | ohsql-mongo-kb |
| www.kernel.org | 7 | ohsql-os-kb |
| www.hikunpeng.com | 4 | ohsql-kunpeng-kb |

## 表 3 · 重复 URL(同一 URL 出现 ≥ 2 次)

| URL | 出现次数 | 出现的 notebook | title 列表 |
|---|---|---|---|
| (无重复 URL) | - | - | - |

## 表 4 · 跨 notebook 重叠(notebook 之间共享 URL)

| notebook A | notebook B | 共享 URL 数 | 共享 URL 列表 |
|---|---|---|---|
| (notebook 间无 URL 重叠) | - | - | - |
