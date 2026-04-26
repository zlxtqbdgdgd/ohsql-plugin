---
authority: project_case
authority_level: ⭐⭐ 项目实战案例
last_verified: 2026-04-10
---

# MongoDB 调优知识库 — 透明大页 (THP)

## 透明大页对 MongoDB 的影响

### 问题描述
在 Linux 系统中，Transparent Huge Pages (THP) 默认为 `always` 模式。此模式会导致 MongoDB 的 WiredTiger 存储引擎出现严重的内存延迟抖动。

### 根因
THP=always 会强制将所有内存分配合并为 2MB 大页。当操作系统后台的 khugepaged 守护进程进行内存碎片整理时，会造成：
- CPU 硬中断导致 System 耗时飙升（通常体现为 CPU sys% 突然从 5% 跳到 40%+）
- WiredTiger 的 cache 分配因内核锁竞争出现数百毫秒级的 stall
- 写入重型工作负载下尤其明显

### 官方建议
MongoDB 官方文档明确要求在部署前关闭 THP：

```bash
# 修改命令
echo never > /sys/kernel/mm/transparent_hugepage/enabled
echo never > /sys/kernel/mm/transparent_hugepage/defrag

# 验证命令
cat /sys/kernel/mm/transparent_hugepage/enabled
# 期望输出：always madvise [never]

# 持久化（写入 /etc/rc.local 或 systemd unit）
```

### 参考来源
- MongoDB Production Notes: https://www.mongodb.com/docs/manual/administration/production-notes/
- Linux Kernel Documentation: Transparent Hugepage Support
