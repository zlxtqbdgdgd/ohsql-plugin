# 21 项基线检查详细清单（历史 · v0.2 及更早 · 已被 54 项 CheckFn 目录取代）

> **DEPRECATED**:本文件是 v0.2 的 21 条基线清单,仅作历史参考保留。
> 当前运行时 CheckFn 目录(mongo 路径)总数 = **54 条**(OS 35 + MongoDB 19)·
> 以 `diagnose.mjs` 输出的 `check_catalog.total` 和 `src/shared/wait-class.ts`
> 的 `WAIT_CLASS_MAP` 为准。请勿从本文件推断当前检查规模。

按分层组织：**K**（鲲鹏平台层）/ **O**（OS 内核层）/ **D**（数据库层）。
**INFO** 级无修复命令（硬件属性/架构决策），WARN/CRITICAL 均配具体修复命令。

## K · 鲲鹏平台层（5 项）

### K1: CPU 调频策略
- 输入：os_metrics.cpu_governor
- 判定：含 powersave/ondemand → WARNING
- 建议：生产数据库 performance
- 修复：`cpupower frequency-set -g performance`

### K2: NUMA 自动平衡
- 输入：os_metrics.numa_nodes, os_metrics.numa_balancing
- 判定：numa_nodes > 1 且 numa_balancing != "0" → CRITICAL
- 建议：多 NUMA 时关闭自动平衡，改手动绑核
- 修复：`sysctl -w kernel.numa_balancing=0`

### K3: SMT 每核线程数（INFO · 硬件属性不可改）
- 输入：os_metrics.smt_threads_per_core
- 判定：总是 INFO，1 = 鲲鹏 920（无 SMT）；>1 = 其它 ARM/虚拟化
- 用途：影响线程池配置决策，鲲鹏按物理核数配，勿误乘 threads/core

### K4: NUMA 节点拓扑（INFO · 架构决策）
- 输入：os_metrics.numa_nodes
- 判定：总是 INFO，4+ = 2P 鲲鹏物理机；1-2 = 虚拟机/单路
- 用途：多节点建议每节点绑 1 mongod 分片（重部署级决策）

### K5: irqbalance 服务状态
- 输入：os_metrics.irqbalance_active
- 判定：inactive/failed → WARNING
- 建议：开启让内核自动分散中断到多核
- 修复：`systemctl enable --now irqbalance`

## O · OS 内核层（10 项，含网络层 & HugePages）

### O1: 透明大页(THP)
- 输入：os_metrics.thp_status
- 判定：`[always]` → CRITICAL
- 建议：madvise 或 never（WiredTiger 兼容）
- 修复：`echo never > /sys/kernel/mm/transparent_hugepage/enabled`

### O2: 静态大页(HugePages)
- 输入：os_metrics.nr_hugepages
- 判定：总是 OK/INFO，MongoDB WT 本身不使用静态大页
- 修复：非必需；有其他服务依赖时 `sysctl -w vm.nr_hugepages=N`

### O3: IO 调度器
- 输入：os_metrics.io_scheduler
- 判定：`[cfq]` → WARNING
- 建议：NVMe/SSD 用 mq-deadline 或 none
- 修复：`echo mq-deadline > /sys/block/<dev>/queue/scheduler`

### O4: Swap 倾向
- 输入：os_metrics.swappiness
- 判定：swappiness > 10 → WARNING
- 建议：生产 DB swappiness=1
- 修复：`sysctl -w vm.swappiness=1`

### O5: 脏页写回策略
- 输入：os_metrics.vm_dirty_ratio, vm_dirty_background_ratio
- 判定：dirty_ratio >= 10 → WARNING
- 修复：`sysctl -w vm.dirty_ratio=5 && sysctl -w vm.dirty_background_ratio=2`

### O6: 磁盘 I/O 延迟
- 输入：os_metrics.disk_await_ms
- 判定：await > 20ms → CRITICAL
- 排查：磁盘类型、调度器、竞争 IO 进程

### O7: 磁盘容量
- 输入：os_metrics.disk_usage_pct
- 判定：> 90% → CRITICAL，> 80% → WARNING
- 修复：清理日志或扩容

### O8: TCP 重传率
- 输入：os_metrics.tcp_retrans_pct
- 判定：> 1% → WARNING
- 排查：链路质量、网卡丢包、拥塞控制算法

### O9: net.core.somaxconn
- 输入：os_metrics.net_somaxconn
- 判定：< 1024 → WARNING
- 修复：`sysctl -w net.core.somaxconn=4096`

### O10: TCP Keepalive
- 输入：os_metrics.tcp_keepalive_time, tcp_keepalive_intvl
- 判定：tcp_keepalive_time > 300 → WARNING
- 修复：`sysctl -w net.ipv4.tcp_keepalive_time=120 && sysctl -w net.ipv4.tcp_keepalive_intvl=10`

## D · 数据库层（6 项，MongoDB 专属）

### D1: DB 缓存 vs 物理内存
- 输入：os_metrics.total_mem_mb, db_metrics.shared_buffers_mb
- 判定：shared_buffers > total_mem → CRITICAL（必爆 OOM）
- 修复：调低 wiredTigerCacheSizeGB 或 shared_buffers

### D2: WT Cache vs OS 内存（原 D2-MONGO WT Cache）
- 输入：total_mem_mb, wt_cache_maximum_bytes, connections.current
- 判定：
  - wt_cache == 0 但 MongoDB 正在运行 → INFO（数据未取到，非 0 值）
  - wt_cache > total_mem × 80% → CRITICAL
- 修复：`mongosh --eval 'db.adminCommand({setParameter: 1, wiredTigerEngineRuntimeConfig: "cache_size=XG"})'`

### D3: 连接池使用率（原 D2-MONGO 连接池）
- 输入：db_metrics.connections.current
- 判定：> 1000 → CRITICAL，> 500 → WARNING
- 建议：生产环境建议 < 1000

### D4: WT 缓存命中率（原 D3-MONGO）
- 输入：db_metrics._wt_cache_detail 的 pages read / pages requested
- 判定：命中率 < 90% → CRITICAL，< 95% → WARNING
- 建议：增大 cache

### D5: Oplog 窗口 / 副本集（原 D4-MONGO）
- 输入：db_metrics._oplog_window_hours
- 判定：< 24h → CRITICAL（节点维护可能触发全量同步）
- 建议：增大 oplogSizeMB

### D6: WT 压缩算法（原 D5-MONGO）
- 输入：db_metrics._wt_block_compressor
- 判定：zlib → WARNING（kunpeng ARM 上 CPU 消耗高）
- 建议：改为 snappy 或 zstd
- 修复：`storage.wiredTiger.collectionConfig.blockCompressor: snappy`
