# Cases Index

> 生成时间: 2026-04-29T15:49:30.907Z
> 数据源: docs/refactor/kb-snapshot_v4.xlsx
> 总计: 109 cases (DF 96 + Flame 13)
> 配套: cases/CASES.md

## diagnostic-flow (96)

| case_id | symptom_category | title | 行号 |
|---|---|---|---:|
| kunpeng-nohz-clock-tick-overhead-03 | cpu-high | 周期时钟中断浪费 CPU 资源(nohz 未启用) | 3 |
| kunpeng-tlb-miss-page-size-04 | cpu-high | 4K 页大小导致 TLB 命中率低 | 55 |
| kunpeng-thread-concurrency-overload-05 | cpu-high | 线程并发数超过最佳点导致性能下降 | 98 |
| mongo-fs-mount-noatime-nobarrier-missing-01 | disk-io-saturation | XFS mount 未加 noatime/nobarrier 导致文件系统冗余开销 | 141 |
| mongo-os-tcp-stack-tuning-01 | network-latency | OS 层 TCP 协议栈参数审计 (7 条 sysctl) | 190 |
| mongo-client-os-tcp-tuning-01 | network-latency | MongoDB 客户端侧 OS 层 TCP 参数审计 (8 条 sysctl) | 269 |
| kunpeng-bios-smmu-enabled-non-virt-01 | disk-io-saturation | 鲲鹏 BIOS 中 SMMU 在非虚拟化场景未关闭(影响数据库 IO 性能) | 354 |
| kunpeng-bios-cpu-prefetch-enabled-01 | cpu-high | 鲲鹏 BIOS 中硬件预取(CPU Prefetching)未关闭(影响数据库随机访问性能) | 397 |
| kunpeng-net-irq-not-bound-irqbalance-on-01 | network-latency | 鲲鹏服务器网卡中断未绑核(irqbalance 在线/中断分散到非本地 CPU) | 440 |
| linux-blockdev-nr-requests-too-low-01 | disk-io-saturation | 块设备 nr_requests 队列长度偏小(限制磁盘吞吐) | 498 |
| kvm-vcpupin-not-bound-numa-cross-01 | cpu-high | KVM 虚拟机 vCPU 未绑核(跨 NUMA / 跨 DIE 切换) | 541 |
| kvm-host-hugepages-not-allocated-tlb-miss-01 | memory-pressure | KVM Host 未分配大页(虚拟机 TLB Miss / 内存访问密集业务下降) | 584 |
| kunpeng-numa-cross-node-memory-access-01 | cpu-high | 跨 NUMA 节点访问内存导致应用性能下降 | 633 |
| kunpeng-network-irq-cross-numa-01 | network-latency | 网卡中断与网卡不在同一 NUMA 节点导致跨 NUMA 访问内存 | 676 |
| linux-nic-interrupt-coalescing-audit-01 | network-latency | 网卡中断聚合参数（ethtool -C）未按业务调优 | 725 |
| linux-rps-single-queue-nic-softirq-bottleneck-01 | network-latency | 单队列网卡软中断集中单 core 形成性能瓶颈（未启用 RPS） | 774 |
| linux-vm-dirty-flush-burst-io-wait-01 | disk-io-saturation | 脏页刷盘策略不当导致突发 I/O 等待与文件读写阻塞 | 829 |
| linux-block-scheduler-mismatch-01 | disk-io-saturation | I/O 调度器与磁盘类型/业务模式不匹配（HDD 数据库使用 CFQ；SSD 未用 NOOP） | 890 |
| linux-fs-mount-nobarrier-audit-01 | disk-io-saturation | 带电池 RAID 卡环境未使用 nobarrier 挂载选项 | 939 |
| linux-fs-xfs-blocksize-audit-01 | disk-io-saturation | 大文件场景未选用 XFS 文件系统或 blocksize 仍为默认 4KB | 982 |
| kunpeng-arm64-spinlock-cas-cpu-waste-01 | cpu-high | 自旋锁/CAS 失败循环导致 CPU 资源浪费（perf top 锁函数占比 ≥ 5%） | 1031 |
| kunpeng-cacheline-false-sharing-arm64-128b-01 | cpu-high | x86 上对齐良好的代码迁移到鲲鹏 920（CacheLine 128B）出现伪共享 | 1092 |
| linux-vm-dirty-ratio-pause-on-large-memory-01 | disk-io-saturation | dirty_ratio 默认 20-30% 在大内存机上累积巨量脏页,触发同步 flush 卡顿 | 1141 |
| linux-thp-mongodb-sparse-memory-access-02 | memory-pressure | Transparent HugePages 在 MongoDB 稀疏内存访问场景下产生开销 | 1190 |
| linux-readahead-default-128kb-wastes-fs-cache-04 | memory-pressure | 块设备 read-ahead 默认 128KB 浪费 MongoDB 文件系统缓存 | 1239 |
| mongo-cache-spike-replication-lag-cascade-01 | replica-lag | WiredTiger Cache 峰值与复制延迟级联失败 (MongoDB 3.0 → 3.4 升级修复) | 1288 |
| mongo-ulimit-low-defaults-mongod-issues-03 | startup-failure | 系统默认 ulimit 过低导致 mongod 运行异常 | 1367 |
| mongo-shard-chunk-migration-x-lock-timeout-balancer-stuck-01 | lock-contention | shard chunk migration 卡死 LockTimeout · balancer 一直 abort | 1410 |
| mongo-wt-large-page-eviction-fetch-pause-server-16479 | query-slow | WiredTiger 大页驱逐导致 fetch 期间多次显著停顿 | 1501 |
| mongo-wt-btree-sweep-eviction-collection-blocked-server-17907 | query-slow | sweep server 整 b-tree 驱逐期间集合访问被阻塞数分钟 | 1565 |
| mongo-tcmalloc-decommit-madvise-lock-stall-server-31417 | query-slow | tcmalloc 归还大量 pageheap free memory 时持内部锁数秒 · 全线程延迟尖峰 | 1629 |
| mongo-tcmalloc-heap-fragmentation-pageheap-free-server-33296 | memory-pressure | mongod 内存远超已分配数据 · pageheap_free_bytes 持续累积 | 1705 |
| mongo-wt-tcmalloc-fragmentation-durable-history-wt-6175 | memory-pressure | 4.4 引入 durable history 后 tcmalloc 碎片化加剧 · mongod VSZ 比 4.2.6 多约 9G | 1769 |
| mongo-globallock-current-queue-high-lock-contention-01 | lock-contention | globalLock.currentQueue.total 持续高 → 大量请求等锁 → 性能降级 | 1833 |
| mongo-pagination-skip-deep-page-rewrite-02 | query-slow | 大翻页 skip 性能塌陷: skip 100 页 12.8s → 改写 $gt 后稳定 10-20ms | 1894 |
| mongo-wt-checkpoint-period-tuning-disk-io-spike-02 | disk-io-saturation | WiredTiger checkpoint 周期偏长 → 磁盘 IO 短暂 100% 抖动 | 1943 |
| mongo-system-sessions-update-storm-primary-shard-degradation-03 | replica-lag | mongos 集中更新 system.sessions 拖垮主分片 → 集群瞬间数倍下降 | 1992 |
| mongo-slow-log-currentop-long-query-kill-02 | query-slow | 慢日志 grep + currentOp 定位长时执行操作并 kill | 2035 |
| wt-eviction-trigger-app-thread-throttle-01 | memory-pressure | cache 用量持续接近 eviction_trigger (默认 95%) → application threads 被拉去做 eviction | 2096 |
| mongo-snappy-hotspot-cpu-high-arm64-01 | cpu-high | MongoDB Snappy 压缩热点函数在鲲鹏 ARM64 上 CPU 占用偏高 | 2154 |
| app-thread-concurrency-mismatch-01 | cpu-high | 应用线程并发数过高导致上下文切换/锁竞争开销加大 | 2197 |
| app-malloc-jemalloc-multithread-audit-01 | cpu-high | 多线程内存分配场景未启用 jemalloc，glibc 默认分配器锁竞争激烈 | 2246 |
| mongo-aggregation-unbounded-pipeline-no-early-match-01 | query-slow | seller analytics 看板聚合 8.2s: $match 在 $lookup 之后 | 2295 |
| mongo-schema-too-many-lookups-should-embed-01 | query-slow | $lookup 用得过多 → 应改为 embed 单集合内 | 2338 |
| mongo-schema-unused-indexes-bloat-03 | disk-space-pressure | 集合上有未使用 index → 占盘 + 拖慢写性能 | 2381 |
| mongo-schema-document-too-large-04 | query-slow | 文档体积过大 → 频繁查询性能差 | 2424 |
| mongo-query-targeting-high-scan-ratio-01 | query-slow | Atlas Query Targeting alert: high scanned-to-returned document ratio | 2467 |
| mongo-slow-query-profiler-metric-01 | query-slow | Atlas Query Profiler: identify and interpret slow queries by multiple metrics | 2534 |
| mongo-locking-queue-buildup-01 | lock-contention | 锁等待队列堆积导致请求被阻塞 | 2619 |
| mongo-connection-storm-driver-error-02 | connection-storm | 连接数飙升 → 服务器吃不下请求 | 2686 |
| mongo-wt-tickets-exhausted-01 | lock-contention | WiredTiger 读写 ticket 持续 < 128 → 并发被限流 | 2750 |
| mongo-replication-lag-multi-cause-02 | replica-lag | 复制集 secondary 落后 primary(4 类互斥根因) | 2814 |
| mongo-open-cursor-rising-no-traffic-03 | other | open cursor 持续上升但流量未变 | 2875 |
| mongo-scan-and-order-high-04 | memory-pressure | Scan and Order 数高 → 服务端排序内存压力 | 2918 |
| mongo-unbound-array-rewrite-pressure-05 | query-slow | 文档中 array 无上限增长 → 每次更新触发整文档重写 | 2961 |
| mongo-driver-pool-size-too-small-vs-concurrent-requests-02 | connection-storm | driver 连接池大小 < 1.10×并发请求数 → 池排队 | 3004 |
| mongo-fs-nfs-dbpath-degraded-unstable-perf-01 | disk-io-saturation | dbPath 用 NFS 卷 → 性能下降且不稳定 | 3047 |
| mongo-fs-ext4-wiredtiger-perf-issue-should-use-xfs-02 | disk-io-saturation | WiredTiger + EXT4 → 已知性能问题 · 应改 XFS | 3090 |
| mongo-tuned-profile-default-rhel-perf-impact-05 | other | RHEL/CentOS tuned profile 用默认值 → 对 MongoDB 性能负向影响 | 3133 |
| mongo-startup-kernel-6-19-tcmalloc-incompat-01 | startup-failure | MongoDB 8.0+ 在 Linux Kernel 6.19 上启动 crash | 3176 |
| mongo-network-tcp-keepalive-too-long-cloud-lb-drops-02 | network-latency | tcp_keepalive_time 大于云 LB 空闲超时 → 连接被静默切断 | 3219 |
| mongo-numa-cross-node-memory-degradation-04 | cpu-high | MongoDB 在 NUMA 硬件上跨节点访问导致间歇性慢 | 3262 |
| mongo-os-vm-swappiness-default-60-aggressive-swap-05 | memory-pressure | vm.swappiness 默认 60 → MongoDB 频繁 swap 性能下降 | 3320 |
| mongo-aws-ec2-storage-network-tuning-06 | disk-io-saturation | AWS EC2 上 MongoDB 性能不可重现 / 不达上限 | 3363 |
| mongo-tcmalloc-percpu-caches-not-enabled-01 | memory-pressure | MongoDB 8.0 TCMalloc per-CPU caches 未启用 → 高负载下内存碎片与性能退化 | 3418 |
| mongo-inmemory-cache-full-overflow-01 | memory-pressure | In-memory storage engine 数据超出 inMemorySizeGB → WT_CACHE_FULL | 3491 |
| mongo-psa-majority-writeconcern-perf-degradation-01 | replica-lag | PSA 架构 + majority write concern · secondary 不可用/落后导致写性能下降与读 stale | 3543 |
| mongo-wt-cache-size-misconfigured-01 | memory-pressure | WiredTiger 内部 cache 大小被人工调高 → 与 filesystem cache 抢内存 | 3616 |
| mongo-explain-sort-stage-disk-spill-01 | memory-pressure | $sort 或 SORT 阶段 spill 到磁盘 → 排序内存压力 | 3665 |
| mongo-pool-connect-timeout-too-large-01 | network-latency | connectTimeoutMS 默认或过大 → 应用侧操作时间慢但 DB 侧未见 | 3723 |
| mongo-pool-socket-timeout-firewall-half-close-02 | connection-storm | 防火墙错关连接 driver 不感知 → 应通过 socketTimeoutMS 兜底 | 3766 |
| mongo-pool-minpoolsize-too-low-startup-creating-conns-03 | connection-storm | 启动期可用连接不足 → 应用频繁建新连接 → minPoolSize 太小 | 3815 |
| mongo-pool-maxpoolsize-too-low-underutilized-04 | query-slow | DB 负载低、活跃连接少、应用吞吐低于预期 → maxPoolSize 太小限流了 | 3858 |
| mongo-pool-maxpoolsize-too-high-cpu-pressure-05 | cpu-high | DB CPU 比预期高 + 连接尝试比预期多 → maxPoolSize 太大压垮服务端 | 3901 |
| mongo-slow-query-explain-multi-stage-01 | query-slow | 慢查询 explain() 五步排查链路 | 3944 |
| mongo-profiler-threshold-sampling-audit-01 | other | profiler 慢查询阈值 / 抽样率默认配置审计 | 4020 |
| mongo-8x-thp-disabled-tcmalloc-suboptimal-01 | memory-pressure | THP 未启用导致 MongoDB 8.0+ 新 TCMalloc 优化失效 | 4075 |
| mongo-replica-set-replication-lag-01 | replica-lag | 副本集复制延迟(replication lag) | 4124 |
| mongo-replica-set-member-connectivity-03 | network-latency | replica set 成员双向连通性失败 | 4206 |
| mongo-replica-set-reboot-multi-secondary-04 | startup-failure | 同时重启 ≥2 secondary 导致集群失去多数票 | 4261 |
| mongo-shard-mongos-unavailable-01 | startup-failure | mongos / 应用服务器不可用 | 4304 |
| mongo-shard-replica-member-down-02 | replica-lag | shard replica set 单成员不可用 | 4347 |
| mongo-shard-all-members-down-data-unavailable-03 | startup-failure | shard 全部成员不可用 → 该 shard 数据不可达 | 4390 |
| mongo-shard-config-server-no-primary-04 | startup-failure | config server replica set 失主导致集群元数据冻结 | 4433 |
| mongo-shard-cursor-stale-config-05 | query-slow | cursor 因 mongos 元数据陈旧失败 | 4476 |
| mongo-replica-lag-secondary-behind-primary-01 | replica-lag | Ops Manager replication lag alert: secondary behind primary | 4519 |
| mongo-slow-log-queue-wait-vs-working-time-mongodb8-01 | query-slow | MongoDB 8.0 慢日志: workingMillis 与 durationMillis 分离 → 区分真慢查询 vs queue 等待 | 4592 |
| mongo-plancache-bloat-sbe-7-0-oom-kills-01 | memory-pressure | MongoDB 7.0 SBE plan cache 膨胀: 单 query shape 5 万+ plan → OOM kill | 4656 |
| mongo-sharding-jumbo-chunk-uneven-write-load-01 | disk-io-saturation | jumbo chunks 无法被 balancer 迁移导致单 shard 写热点 | 4747 |
| mongo-sharding-equal-chunks-skewed-data-getshard-distribution-02 | disk-io-saturation | chunk 计数均衡但数据/查询全压在一个 shard(getShardDistribution 100%/0%) | 4820 |
| mongo-k8s-container-wt-cache-fallback-256mb-01 | memory-pressure | 容器中 WiredTiger 无法识别容器内存限制,回退 256MB 最小 cache | 4869 |
| mongo-k8s-operator-cachesize-bug-cpu-limit-required-02 | memory-pressure | PSMDB operator v1.9 / v1.10 已知 bug · cacheSizeRatio 改了但 mongod 仍按默认 cache 启动 | 4927 |
| mongo-8-0-tcmalloc-percpu-prerequisite-not-met-01 | memory-pressure | MongoDB 8.0 升级后未拿到预期性能提升 · TCMalloc 实际未启用 per-CPU caches | 4979 |
| mongo-query-ixscan-poor-selectivity-extra-sort-02 | query-slow | 索引存在但 totalDocsExamined ≫ nReturned + 出现独立 SORT stage | 5061 |
| mongo-write-regression-default-writeconcern-majority-journal-01 | query-slow | MongoDB 5.0+ 默认 writeConcern=majority 致 JournalFlusher 写盘成为热点 | 5119 |
| mongo-wt-checkpoint-time-grows-bulk-load-stall-01 | disk-io-saturation | bulk-load 期间 WiredTiger checkpoint 时间从几秒增至数分钟,期间业务停滞 | 5192 |

## flame-signature (13)

| case_id | title | pattern_regex | 行号 |
|---|---|---|---:|
| linux-fs-mmap-metadata-archiver-01 | Linux FS metadata syscall hotspot in mmap-based archiver workload | `^(sys_newfstatat\ | 5264 |
| glibc-malloc-allocator-hot-stack-01 | glibc malloc allocator tracing hot stack — application allocation code path | `^(__GI___libc_malloc\ | 5291 |
| linux-mm-brk-heap-expansion-01 | brk() syscall hot frame — heap expansion code path | `^(sys_brk\ | 5318 |
| linux-mm-mmap-vm-growth-01 | mmap() syscall hot frame — VM mapping growth code path | `^(sys_mmap\ | 5345 |
| linux-mm-page-fault-physical-population-01 | page fault hot frame — physical memory population code path | `^(handle_mm_fault\ | 5372 |
| linux-block-offwake-disk-io-block-completion-01 | Off-Wake flame graph stack chain: disk I/O block completion interrupt waking blocked vfs_read() | `^(blkif_interrupt\ | 5399 |
| wt-evict-cold-page-compact-cure-01 | WiredTiger 冷数据 evict 后 checkpoint 不再处理 · compact 触发 reconciliation 强制回收 | `(compact\ | 5426 |
| wt-app-thread-evict-assist-pressure-01 | WiredTiger 应用线程被迫参与 eviction 助手(cache 使用率超阈值压力 signature) | `^__wt_cache_eviction_.*` | 5454 |
| wt-evict-reconcile-blocked-ebusy-01 | WiredTiger eviction reconcile 被多重 EBUSY 阻碍(__evict_review → __evict_reconcile 链路热点) | `^__evict_(review\ | 5482 |
| wt-capacity-throttle-cond-signal-crash-01 | WiredTiger io_capacity 配置语法错误后,后台 eviction 线程经 capacity_throttle 调用 __wt_cond_signal 解引用 NULL capacity_cond 触发 SIGSEGV | `(__wt_capacity_throttle\ | 5510 |
| wt-reconcile-row-tombstone-skip-01 | WiredTiger reconcile 在 row leaf 上跳过全局可见 stop_ts 的 key(磁盘清理读-判-跳路径 signature) | `^(__wt_row_leaf_value_cell\ | 5538 |
| wt-reconcile-write-wrapup-block-free-01 | WiredTiger reconcile 写入 wrapup 阶段释放旧页面磁盘块(block manager free-list 入队 signature) | `^(__rec_write_wrapup\ | 5566 |
| wt-reconcile-row-leaf-tombstone-not-globally-visible-01 | WiredTiger 行叶页 reconcile 路径下 tombstone 非全局可见 → 已删除数据被整页保留(oldest_timestamp 推进不足 signature) | `^(__wti_rec_row_leaf\ | 5594 |
