---
authority: kunpeng_tuning
authority_level: ⭐⭐⭐ 华为官方调优指南
last_verified: 2026-04-10
---

# MongoDB 调优知识库 — 鲲鹏 ARM64 专项优化

## 鲲鹏处理器特性对 MongoDB 的影响

### 1. 128 字节缓存行
鲲鹏 920 使用 128B 缓存行（x86 为 64B）。这会导致：
- 伪共享（False Sharing）问题更严重
- 需确保 MongoDB 编译时使用 `-mcache-line-size=128`

### 2. LSE 原子指令
鲲鹏 920 支持 ARMv8.1-A 的 LSE（Large System Extensions）原子指令。
使用 LSE 编译的 MongoDB 在高并发场景下性能提升 15-30%。

**检测方法**：
```bash
# 检查 mongod 是否使用了 LSE 指令
objdump -d /usr/bin/mongod | grep -c "cas\|ldadd\|stadd\|swp"
# 如果结果为 0，说明未启用 LSE
```

### 3. NUMA 拓扑
鲲鹏 920 通常有 4 个 NUMA 节点（每个 24 核）。跨 NUMA 访问延迟约为本地访问的 1.5-2 倍。

**最佳实践**：
- mongod 进程绑定到单个 NUMA 节点
- 关闭 numa_balancing
- 如需利用全部算力，使用多实例（每个 NUMA 一个）

### 参考来源
- 鲲鹏 BoostKit: https://www.hikunpeng.com/developer/boostkit
- ARM Architecture Reference Manual
