# Best-Practice Index

> 生成时间: 2026-05-02T17:27:43.494Z
> 数据源: 蒸馏者 xlsx 快照(经 _build-cases-from-xlsx.mjs 蒸馏)
> 总计: 93 cases
> 配套: best-practice/CASES.md

| case_id | scope | title | 行号 |
|---|---|---|---:|
| arm64-lse-march-armv82a-compile-flag-graviton-01 | other | ARM64 Graviton2+ 编译时用 -march=armv8.2-a 启用 LSE 原子指令 | 3 |
| arm64-lse-outline-atomics-runtime-detect-graviton-02 | other | ARM64 多代兼容部署时用 -moutline-atomics 运行期检测 LSE 支持 | 37 |
| arm64-lse-dmesg-lscpu-deploy-verify-percona-02 | other | Graviton2 部署后用 dmesg/lscpu 验证 LSE 原子指令已被内核检测启用 | 66 |
| bp-linux-fs-mount-noatime-xfs-rdb-server-01 | linux-fs | XFS 数据盘 mount 加 noatime · 避免读取时更新 access time 浪费资源 | 101 |
| bp-linux-fs-mount-nobarrier-xfs-battery-backed-storage-02 | linux-fs | 底层存储具备掉电保护(RAID/Flash)时 · XFS 数据盘 mount 加 nobarrier · 避免 write barrier 性能损失 | 131 |
| os-net-tcp-tw-reuse-enable-mongo-client-02 | linux-net | MongoDB 客户端启用 tcp_tw_reuse 让 TIME-WAIT socket 可复用以新建连接 | 161 |
| os-net-somaxconn-mongo-client-65535-03 | linux-net | MongoDB 客户端 listen() backlog 上限 somaxconn 调至 65535 防 accept 队列溢出 | 187 |
| os-net-netdev-max-backlog-mongo-client-8096-04 | linux-net | MongoDB 客户端调大 netdev_max_backlog 至 8096 避免高入流量丢包 | 213 |
| os-net-tcp-max-syn-backlog-mongo-client-8192-05 | linux-net | MongoDB 客户端调大 tcp_max_syn_backlog 至 8192 防 SYN 队列溢出 | 239 |
| os-net-tcp-fin-timeout-mongo-client-30s-07 | linux-net | MongoDB 客户端调小 tcp_fin_timeout 至 30 秒缩短 FIN-WAIT-2 占用 | 265 |
| os-net-tcp-max-tw-buckets-mongo-client-3000-08 | linux-net | MongoDB 客户端调小 tcp_max_tw_buckets 至 3000 加快 TIME-WAIT 强制回收 | 291 |
| linux-mm-vm-dirty-ratio-5-kunpeng-dbs-os-cache-tuning-02 | linux-mm | 鲲鹏 BoostKit 数据库场景 vm.dirty_ratio 设为 5 限制脏页堆积 | 317 |
| kvm-vcpu-placement-static-cpuset-numa-affinity-01 | linux-sched | KVM 虚拟机部署 mongod 时 · vcpu placement=static + cpuset 限定 worker 线程范围 · 防跨 NUMA 跨 DIE | 343 |
| os-kvm-vm-hugepages-allocate-tlb-miss-01 | linux-mm | KVM 虚拟化场景为 mongod 虚机分配 512MB 大页(Host kernel cmdline + VM xml memoryBacking) | 373 |
| linux-block-read-ahead-kb-sequential-io-4096-01 | linux-block | 磁盘顺序读场景下将 read_ahead_kb 从默认 128KB 调大至 4096KB 以充分利用预取性能提升 | 400 |
| linux-fs-xfs-blocksize-large-file-01 | linux-fs | 大文件操作场景使用 XFS 文件系统并将 blocksize 设为 8192B 以提升 I/O 吞吐 | 431 |
| app-malloc-jemalloc-multithread-01 | mem-allocator-jemalloc | 多线程高并发场景下应用链接 jemalloc 替代 glibc 默认分配器以减少锁竞争 | 457 |
| mongo-txn-long-running-wt-cache-pressure | app-other | 长事务导致 WiredTiger 缓存压力：拆分事务并确保索引覆盖 | 486 |
| mongo-txn-modify-1000-docs-max-batch | app-other | 单次事务修改文档上限 1000 条：超出须拆批处理 | 519 |
| mongo-read-concern-linearizable-maxtimems | app-query-layer | linearizable 读关注配合 maxTimeMS 防止操作无限挂起 | 553 |
| linux-block-journal-separate-volume-mongodb-01 | linux-block | MongoDB Journal 和系统日志应使用独立物理卷，避免日志 IO 竞争数据盘带宽 | 586 |
| app-other-write-concern-majority-mongodb-failover-01 | app-other | 重要数据写入应使用 w:majority，防止主节点故障转移时写操作被回滚 | 614 |
| linux-block-nvme-wt-dirty-eviction-01 | linux-block | WiredTiger 高脏页率 + 高 modified evictions 场景应换用 NVMe 替代机械盘 | 647 |
| kunpeng-bios-smmu-disable-non-virt-db-01 | other | 鲲鹏平台非虚拟化场景下 · 在 BIOS 中关闭 SMMU 以避免数据库 IO 开销 | 674 |
| kunpeng-bios-cpu-prefetch-disable-db-01 | other | 鲲鹏平台数据库场景 · 在 BIOS 中关闭 CPU 硬件预取以避免无效缓存流量 | 708 |
| kunpeng-net-irq-affinity-bind-all-queues-to-local-numa-01 | linux-net | 鲲鹏服务器手动绑定网卡中断到本地 NUMA · 关闭 irqbalance · 32 队列绑满获最佳网络性能 | 734 |
| linux-thp-disabled-db-mem-fragmentation-bp-01 | linux-mm | 数据库场景下关闭透明大页(THP)以减少内存碎片与利用率下降 | 761 |
| os-blockdev-scheduler-not-deadline-mysql-db-01 | linux-block | 数据库场景下 · 块设备 IO 调度器配置为 deadline(NVMe 除外) | 792 |
| os-blockdev-nr-requests-too-low-disk-throughput-01 | linux-block | 数据库高并发写入场景下 · 块设备 nr_requests 调到 2048 提升磁盘吞吐 | 819 |
| bp-linux-net-nic-interrupt-coalescing-static-kunpeng-01 | linux-net | 鲲鹏网卡性能调优：禁用自适应中断聚合（adaptive-rx/tx off），使用静态 ethtool -C 参数 | 846 |
| os-mongod-maxincomingconnections-high-conn-01 | app-other | MongoDB maxIncomingConnections: raise above default 64k for high-connection deployments | 875 |
| os-ulimit-nofile-high-conn-01 | linux-net | Linux ulimit nofile: raise open-file descriptor limit for high-connection MongoDB servers | 901 |
| os-ulimit-nproc-high-conn-02 | linux-sched | Linux ulimit nproc: raise thread count limit for high-connection MongoDB deployments | 931 |
| os-ulimit-stack-high-conn-03 | linux-mm | Linux ulimit stack: raise per-thread stack size limit for high-connection MongoDB deployments | 961 |
| os-vm-max-map-count-thread-mmap-01 | linux-mm | vm.max_map_count: raise kernel mmap limit when running many threads (MongoDB high-connection) | 991 |
| os-net-ip-local-port-range-client-01 | linux-net | net.ipv4.ip_local_port_range: expand ephemeral port range on benchmark/client hosts | 1021 |
| mongo-replica-set-data-durability-three-voting-majority-01 | app-other | 副本集部署需 ≥3 个数据承载 voting 成员 + 写操作走 w:majority · 否则数据耐久性无法满足 | 1047 |
| mongo-replica-set-odd-voting-members-elections-02 | app-other | 副本集投票成员需为奇数(最多 7 个)· 偶数时用 arbiter 凑奇数 · 否则选举平票卡死 | 1074 |
| mongo-driver-connection-pool-size-110-115pct-concurrent-03 | app-query-layer | driver 连接池大小起点应为应用层"典型并发请求数 × 110-115%" · 池太小将请求排队 | 1101 |
| linux-fs-avoid-nfs-for-dbpath-checklist-01 | linux-fs | dbPath 不要用 NFS · 用本地 / VMware 虚拟盘 | 1128 |
| linux-fs-xfs-strongly-recommended-for-wt-checklist-02 | linux-fs | WiredTiger 数据盘强烈建议用 XFS · 不用 EXT4 | 1158 |
| linux-sched-customize-tuned-profile-rhel-centos-checklist-04 | linux-sched | RHEL / CentOS 上用 tuned 时必须自定义 tuned profile | 1188 |
| linux-block-avoid-replica-set-members-same-san-checklist-05 | linux-block | 副本集成员不要全放同一 SAN · 避免单点故障 | 1222 |
| os-net-tcp-keepalive-time-cloud-lb-120s-01 | linux-net | 云 LB 后部署 mongod 时 · tcp_keepalive_time 设为 120 秒以避免静默断连 | 1252 |
| linux-block-raid-10-not-5-or-6-02 | linux-block | 存储层用 RAID-10 · 不要用 RAID-5 / RAID-6 | 1283 |
| linux-fs-nfs-mount-options-bg-hard-nolock-noatime-nointr-03 | linux-fs | 必须用 NFS 时 · /etc/fstab 加 bg / hard / nolock / noatime / nointr 选项 | 1312 |
| linux-block-use-ssd-for-random-io-04 | linux-block | I/O 吞吐瓶颈时 · 优先用 SSD(SATA SSD 性价比好)而非堆贵转盘 | 1343 |
| linux-mm-vm-swappiness-1-or-0-mongo-host-05 | linux-mm | mongod 主机 vm.swappiness 设为 1 或 0(默认 60 太激进) | 1376 |
| linux-mm-numactl-interleave-all-mongod-startup-07 | linux-mm | NUMA 主机上 mongod 必须经 numactl --interleave=all 启动 | 1411 |
| linux-mm-vm-zone-reclaim-mode-disable-08 | linux-mm | NUMA 主机上 vm.zone_reclaim_mode 必须设为 0 · 与 numactl 配套 | 1447 |
| linux-sched-none-for-vm-cloud-09 | linux-sched | VM / 云主机 + hypervisor 块设备 · I/O scheduler 用 none | 1478 |
| linux-sched-mq-deadline-for-spinning-disk-10 | linux-sched | 物理服务器 + 转盘 · I/O scheduler 用 mq-deadline | 1512 |
| linux-sched-kyber-for-multi-workload-11 | linux-sched | 同 VM / 自建机房多负载混跑 · I/O scheduler 用 kyber(kernel 4.12+) | 1542 |
| linux-block-readahead-8-to-32-wt-12 | linux-block | WiredTiger 引擎 · readahead 设 8~32 (sectors) · 不要更高 | 1568 |
| tls-crypto-ssl-symbol-version-mismatch-warn-13 | tls-crypto | mongod 启动时 libssl/libcrypto 符号版本警告 · 通常不影响 · 可用 objdump 核对 | 1603 |
| linux-mm-kvm-reserve-full-vm-memory-15 | linux-mm | KVM 上跑 mongod · 为虚机预留全部内存 · 不禁用 balloon driver | 1637 |
| bp-mongo-pool-connecttimeoutms-network-latency-01 | app-query-layer | 应用侧操作慢但 DB 侧未见对应 · 设 connectTimeoutMS 防止驱动连接阶段无限等待 | 1671 |
| bp-mongo-pool-sockettimeoutms-firewall-half-close-02 | app-query-layer | 防火墙半关闭 socket · 设 socketTimeoutMS 为最慢 op 时长的 2~3 倍以确保 socket 总能释放 | 1701 |
| bp-mongo-pool-minpoolsize-startup-warmup-03 | app-query-layer | 应用启动时连接创建占用过多时间 · 设 minPoolSize 预热池子 | 1731 |
| bp-mongo-pool-sockettimeoutms-not-for-server-cancel-use-maxtimems-06 | app-query-layer | 想取消服务端长 op 时不要用 socketTimeoutMS · 改用 maxTimeMS() 让服务端真正取消 | 1761 |
| mongo-net-compressor-enable-bandwidth-reduction-03 | other | Enable MongoDB network compression to reduce client-server bandwidth | 1787 |
| os-tuned-percona-mongodb-profile-rhel-centos-automated-01 | other | RHEL/CentOS 7+ 运行 MongoDB · 使用 tuned-percona-mongodb profile 一键自动化应用所有 Linux 调参 | 1817 |
| os-cm-deploy-tuning-via-tuned-profile-not-direct-02 | other | 使用配置管理工具（Puppet/Chef/Ansible）时 · 必须通过 tuned profile 部署调参而非直接修改系统文件 | 1848 |
| mongo-service-executor-adaptive-high-concurrency-01 | storage-engine-wt | 高并发场景启用 serviceExecutor adaptive 实现网络 IO 复用 | 1878 |
| mongo-wt-eviction-dirty-target-3pct-high-write-01 | storage-engine-wt | 高写入负载下调低 eviction_dirty_target/trigger 让后台线程尽早淘汰脏页 | 1913 |
| mongo-wt-checkpoint-wait-25s-io-smoothing-01 | storage-engine-wt | 高写入负载下缩短 checkpoint wait 周期至 25s 均摊 IO | 1947 |
| mongo-ttl-expiry-offpeak-window-high-write-01 | app-other | 高写入集群将 TTL 过期删除窗口移至夜间低峰期规避白天 delete 高峰 | 1981 |
| mongo-atlas-rolling-index-build-non-tolerant-workloads-01 | storage-engine-other | 对不能容忍 index build 期间性能下降的 workload 启用滚动方式构建索引 | 2011 |
| wt-journal-commit-interval-high-throughput-01 | storage-engine-wt | WiredTiger commitIntervalMs: increase to 200-300ms for higher write throughput | 2041 |
| wt-journal-disable-non-critical-max-write-01 | storage-engine-wt | WiredTiger journal.enabled: disable for temporary/non-critical data to maximize write speed | 2059 |
| wt-block-compressor-none-max-write-speed-01 | storage-engine-wt | WiredTiger blockCompressor: set to none for maximum write speed (no compression overhead) | 2077 |
| wt-directory-per-db-separate-volumes-01 | storage-engine-other | storage.directoryPerDB: enable when using separate storage volumes for each database | 2095 |
| mongo-oplog-size-high-write-update-workload-03 | app-other | oplogSizeMB 在高更新频率工作负载下调大——避免 oplog 空洞和从节点延迟 | 2113 |
| mongo-cursor-timeout-idle-resource-overhead-04 | app-other | cursorTimeoutMillis 调小降低空闲游标资源开销 | 2144 |
| mongo-transaction-lifetime-long-wt-cache-pressure-05 | storage-engine-wt | transactionLifetimeLimitSeconds 调小防长事务压垮 WiredTiger 缓存 | 2175 |
| mongo-wt-block-compressor-cold-data-zstd-06 | storage-engine-wt | 冷数据存储场景将 blockCompressor 改为 zstd 提升压缩比 | 2206 |
| mongo-tcmalloc-aggressive-decommit-oom-fragment-07 | app-other | tcmallocAggressiveMemoryDecommit 在内存 OOM/碎片场景启用加速内存回收 | 2237 |
| mongo-snapshot-history-window-no-atclustertime-08 | storage-engine-wt | 不使用历史快照读时将 minSnapshotHistoryWindowInSeconds 调小到 0 释放 WT 缓存压力 | 2264 |
| wt-concurrent-tickets-low-increase-01 | storage-engine-wt | WiredTiger 并发读写 tickets 持续低于 10 时应用 setParameter 增加上限 | 2295 |
| wt-cache-size-default-half-ram-minus-1g-01 | storage-engine-wt | WiredTiger 内部缓存默认值 = max(50% × (RAM - 1GB), 0.256GB) · 不应擅自调高 | 2331 |
| wt-compression-snappy-default-block-collections-03 | storage-engine-wt | WiredTiger 集合默认采用 Snappy 块压缩 · 索引默认前缀压缩 | 2367 |
| wt-encrypted-storage-aes-ni-cpu-required-04 | storage-engine-wt | 使用 Encrypted Storage Engine 时 · 选支持 AES-NI 指令集的 CPU | 2403 |
| wt-cache-size-container-cgroup-explicit-01 | storage-engine-wt | 容器(lxc / cgroups / Docker)部署 mongod 时必须显式设 wiredTigerCacheSizeGB 或 wiredTigerCacheSizePct | 2434 |
| wt-cache-size-multi-instance-decrease-01 | storage-engine-wt | 单机多 mongod 实例时须按实例数缩减每个实例的 WiredTiger 缓存配置 | 2469 |
| mongo-config-syncperiodsecs-production-default-01 | storage-engine-wt | 生产环境禁止将 storage.syncPeriodSecs 设为 0 · 保持默认值 60 | 2503 |
| mongo-config-quiet-mode-disable-production-01 | storage-engine-other | 生产环境禁用 systemLog.quiet 模式 · 保留完整日志输出 | 2529 |
| mongo-config-syslog-destination-file-production-01 | storage-engine-other | 生产环境 systemLog.destination 应设为 file 而非 syslog · 避免时间戳误导 | 2555 |
| mongo-config-logrotate-reopen-logrotated-01 | storage-engine-other | 使用 Linux logrotate 工具时须将 systemLog.logRotate 设为 reopen 以避免日志丢失 | 2589 |
| mongo-config-auditlog-bson-format-perf-01 | storage-engine-other | 审计日志落文件时使用 BSON 格式而非 JSON · 降低性能开销 | 2619 |
| mongo-config-audit-kmip-not-local-key-01 | storage-engine-other | 审计日志加密密钥生产环境必须使用外部 KMIP 服务 · 禁止使用 localAuditKeyFile | 2653 |
| mongo-config-mongos-maxconn-connection-leak-01 | storage-engine-other | mongos 部署中客户端连接泄漏时须显式设置 maxIncomingConnections 防止分片连接风暴 | 2684 |
| mongo-profiler-slowms-highest-useful-value-01 | storage-engine-other | profiler / diagnostic log slowms 阈值应设为业务可接受的最高值 · 避免性能退化 | 2714 |
| mongo-profiler-prefer-atlas-alternatives-before-enabling-02 | storage-engine-other | 启用 database profiler 前优先考虑 Atlas Query Profiler / Performance Advisor / $queryStats 等替代方案 · profiler 可能 degrade 性能 | 2745 |
