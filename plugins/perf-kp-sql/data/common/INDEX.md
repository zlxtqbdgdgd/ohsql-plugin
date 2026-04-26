# data/common · 鲲鹏 / openEuler / 通用 KB 索引

> **v1 角色(spec v0.3.2)**:本目录是**规则编写时的蒸馏源** +
> **rule citation 指向的深度资料**。**不是运行时 RAG 数据源**。详见
> `docs/kb-usage.md`。

## 文件清单

| 文件 | 来源类型 | 主要用途(蒸馏给哪些规则)|
|---|---|---|
| [kunpeng_arm64.md](./kunpeng_arm64.md) | 综合整理 | ARM64 指令集 / NUMA / LSE atomics 规则(shared/arm64-checks.ts) |
| [kunpeng_boostkit_mongodb_tuning_guide.md](./kunpeng_boostkit_mongodb_tuning_guide.md) | Huawei BoostKit | 鲲鹏 vendor-scoped 规则 + Mongo-on-Kunpeng 建议值(shared/kunpeng-checks.ts)|
| [kunpeng_code_porting_reference.md](./kunpeng_code_porting_reference.md) | Huawei | LSE atomics 二进制检查 · outline-atomics 编译建议 |
| [kunpeng_general_fault_cases.md](./kunpeng_general_fault_cases.md) | Huawei | 历史 case 参考(非规则触发点 · 供 DBA 查阅)|
| [kunpeng_troubleshooting_manual.md](./kunpeng_troubleshooting_manual.md) | Huawei | 通用排障 · 供 DBA 查阅 |
| [mongo-on-kunpeng-tuning.md](./mongo-on-kunpeng-tuning.md) | 业界首份合成 | **亮点 1 承载**:Mongo-on-Kunpeng 调优合成(Ampere + MongoDB Prod Notes + Kunpeng NUMA)|
| [official/](./official/) | 官方文档 mirror | rule citations 里本地化的权威节选 |

## 维护规则

- 新增一条鲲鹏/ARM64 规则前,先看本目录是否有对应来源 · 有则蒸馏 · 无则先补来源再写规则
- 来源文件每季度可按需刷新 · 刷新后需重新蒸馏对应规则的 `rationale.mechanism`
  和 `citations[]`(版本 anchor 要更新)
- 华为版权文档(BoostKit / 排障手册等)**只保留公开可获取的小节** · 不贴非公开
  内容 · anchor 必须回到原始可访问 URL
