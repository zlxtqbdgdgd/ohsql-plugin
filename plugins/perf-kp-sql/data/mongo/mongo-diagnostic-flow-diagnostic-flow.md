# mongo-diagnostic-flow-diagnostic-flow

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 71 条 case。

---

## 多线程内存分配场景未启用 jemalloc，glibc 默认分配器锁竞争激烈

**case_id**: `app-malloc-jemalloc-multithread-audit-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0051.html](https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0051.html) (unknown)
**平台**: linux-arm64-kunpeng
**case_pattern**: parameter-audit
**source_heading**: 使用jemalloc优化内存分配

**engine**: mixed
**symptom_category**: cpu-high

### 症状 (原文)
> 在内存分配过程中，锁会造成线程等待，对性能影响巨大。jemalloc采用如下措施避免线程竞争锁的发生：使用线程变量，每个线程有自己的内存管理器，分配在这个线程内完成，就不需要和其它线程竞争锁。

**症状关键词**: jemalloc / glibc / malloc-lib / tcmalloc / 线程变量 / 锁竞争

### 诊断步骤
#### Step 1: 检查应用当前链接的内存分配库
- metric: `application linked memory allocator library`
- 采集层: os
- 异常模式: > "推荐业务应用代码使用jemalloc进行内存分配。"
- 阈值: 当前 allocator ∈ {glibc-malloc, tcmalloc} ∧ 业务为多线程高分配率

### possible 根因 (参数类)
#### Cause 1: 应用未通过编译选项链接 jemalloc
- param: `linker flags · -ljemalloc + -L`jemalloc-config --libdir``
- 异常值模式: 链接默认 glibc malloc（编译选项中无 -ljemalloc）
- 原文: > "修改应用软件的链接库的方式，在编译选项中添加如下编译选项"

#### Cause 2: MySQL 等通过配置文件指定的 allocator 仍为默认值
- param: `malloc-lib (my.cnf) 或类似配置`
- 异常值模式: malloc-lib 未设置 / 设置为非 jemalloc
- 原文: > "部分开源软件可以修改配置参数来指定内存分配库，如MySQL可以配置my.cnf文件：malloc-lib=/usr/local/lib/libjemalloc.so"

---

## 应用线程并发数过高导致上下文切换/锁竞争开销加大

**case_id**: `app-thread-concurrency-mismatch-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0013.html](https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0013.html) (unknown)
**平台**: linux-arm64-kunpeng
**case_pattern**: parameter-audit
**source_heading**: 调整线程并发数

**engine**: mixed
**symptom_category**: cpu-high

### 症状 (原文)
> 但是系统的性能并不会随着线程数的增长而线性提升，因为随着线程数量的增加，线程之间的调度、上下文切换、关键资源和锁的竞争也会带来很大开销。当资源的争抢比较严重时，甚至会导致性能明显下降。

**症状关键词**: 线程并发数 / 上下文切换 / 锁竞争 / TPS / innodb_thread_concurrency / worker_processes

### 诊断步骤
#### Step 1: 读取应用当前并发线程数配置 + 业务 TPS
- metric: `application thread concurrency setting + business TPS`
- 采集层: mongo-shell
- 异常模式: > "当资源的争抢比较严重时，甚至会导致性能明显下降。"
- 阈值: (定性) thread_count > optimal_concurrency_for_workload ∧ TPS 单调下降

### possible 根因 (参数类)
#### Cause 1: 应用工作线程并发数高于业务最佳值
- param: `innodb_thread_concurrency (MySQL) / worker_processes (Nginx) / 应用自有并发参数`
- 异常值模式: 高于"针对不同业务模型多组测试找出的最佳并发数"
- 原文: > "MySQL可以通过innodb_thread_concurrency设置工作线程的最大并发数。"

#### Cause 2: Nginx worker_processes 配置过高
- param: `worker_processes`
- 异常值模式: 超过 CPU core 数或业务最佳并发值
- 原文: > "Nginx可以通过worker_processes参数设置并发的进程个数。"

---

## MongoDB 8.0 升级后未拿到预期性能提升 · TCMalloc 实际未启用 per-CPU caches

**case_id**: `mongo-8-0-tcmalloc-percpu-prerequisite-not-met-01`
**来源**: [https://www.percona.com/blog/memory-management-in-mongodb-8-0-testing-the-new-tcmalloc/](https://www.percona.com/blog/memory-management-in-mongodb-8-0-testing-the-new-tcmalloc/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Important change for Transparent Huge Pages (THP)

**engine**: mongodb
**symptom_category**: memory-pressure

### 症状 (原文)
> MongoDB has used TCMalloc as its default allocator, but version 8.0 includes a major upgrade to a newer implementation aligned with upstream Google TCMalloc changes that uses per-CPU caches, instead of per-thread caches. This brings improved multithreaded scalability, better memory release behavior to the OS, more predictable RSS (Resident Set Size) under heavy workloads.

**症状关键词**: TCMalloc / per-CPU caches / usingPerCpuCaches / cpu_free / rseq / THP / kernel 4.18

### 诊断步骤
#### Step 1: 检查 serverStatus.tcmalloc.usingPerCpuCaches
- metric: `serverStatus.tcmalloc.usingPerCpuCaches`
- 采集层: mongo-runtime-cmd
- 异常模式: > "tcmalloc.usingPerCpuCaches is true"
- 阈值: usingPerCpuCaches != true → 异常(说明回退到 legacy per-thread 实现)

#### Step 2: 检查 serverStatus.tcmalloc.tcmalloc.cpu_free
- metric: `serverStatus.tcmalloc.tcmalloc.cpu_free`
- 采集层: mongo-runtime-cmd
- 异常模式: > "tcmalloc.tcmalloc.cpu_free is greater than 0"
- 阈值: cpu_free 不大于 0 → 异常(per-CPU 缓存未真正建立)

#### Step 3: 检查内核版本
- metric: `uname -r kernel version`
- 采集层: os
- 异常模式: > "Kernel version 4.18 or later"
- 阈值: 内核版本 < 4.18

#### Step 4: 检查 THP 是否启用
- metric: `/sys/kernel/mm/transparent_hugepage/enabled`
- 采集层: os
- 异常模式: > "THP enabled"
- 阈值: (MongoDB 8.0 视角)THP 当前为 `never` → 异常(与 7.0 时代相反!)

### possible 根因 (参数类)
#### Cause 1: THP 被禁用(legacy 7.0 调优习惯延续到 8.0)
- param: `kernel.transparent_hugepage`
- 异常值模式: never · 但 mongod 是 8.0+
- 原文: > "If you are a long time user of MongoDB, you probably know that one of the more common best practices for OS tuning was to disable THP. Starting from MongoDB 8.0 the best practice is exactly the opposite: in order to benefit from the new TCMalloc, THP now must be enabled."

### possible 根因 (非参数类)
#### Cause 1: 内核 < 4.18 不支持 rseq
- type: os-version-bug
- 原文: > "Kernel version 4.18 or later"

#### Cause 2: glibc rseq 先注册占用了 rseq 槽位 → TCMalloc 无法使用
- type: os-version-bug
- 原文: > "glibc rseq disabled: if another application, such as the glibc library, registers an rseq structure before TCMalloc, TCMalloc can’t use rseq. Without rseq, TCMalloc uses per-thread caches, which are used by the legacy TCMalloc version."

---

## THP 未启用导致 MongoDB 8.0+ 新 TCMalloc 优化失效

**case_id**: `mongo-8x-thp-disabled-tcmalloc-suboptimal-01`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/](https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Enable Transparent Hugepages (THP)

**engine**: mongodb
**symptom_category**: memory-pressure

### 症状 (原文)
> Transparent Hugepages (THP) is a Linux memory management system that reduces the overhead of Translation Lookaside Buffer (TLB) lookups. THP achieves this by combining small pages and making them appear as larger memory pages to the application. In MongoDB 8.0 and later, ensure that THP is enabled before .

**症状关键词**: THP / transparent hugepages / TLB lookups / MongoDB 8.0 / TCMalloc

### 诊断步骤
#### Step 1: 读当前 THP / defrag / khugepaged 状态
- metric: `/sys/kernel/mm/transparent_hugepage/{enabled,defrag,khugepaged/defrag}`
- 采集层: os
- 异常模式: > (启用应为 `[always] madvise never`,即方括号在 always 上;若为 `[never]` 则 THP 未启用)
- 阈值: enabled 当前值不是 `always`

### possible 根因 (参数类)
#### Cause 1: /sys/kernel/mm/transparent_hugepage/enabled 未设 always
- param: `kernel transparent_hugepage/enabled(可通过 systemd / init.d / kernel boot param 启用)`
- 异常值模式: never 或 madvise(对 MongoDB 8.0+ 新 TCMalloc 不优化)
- 原文: > "In MongoDB 8.0 and later, ensure that THP is enabled before ."

### possible 根因 (非参数类)
#### Cause 1: 系统使用 tuned/ktune profile 反向覆盖
- type: application-design
- 原文: > "tuned and ktune are kernel tuning utilities that can affect the Transparent Hugepages setting on your system."
- 缓解: > "If you are using tuned or ktune on your RHEL or CentOS system while running mongod, you must create a custom tuned profile to ensure that THP stays enabled."

---

## seller analytics 看板聚合 8.2s: $match 在 $lookup 之后

**case_id**: `mongo-aggregation-unbounded-pipeline-no-early-match-01`
**来源**: [https://www.mafiree.com/blog/mongodb-query-optimization-ecommerce-case-study](https://www.mafiree.com/blog/mongodb-query-optimization-ecommerce-case-study) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Fix 2: Aggregation Pipeline Refactoring

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> The seller analytics dashboard used a complex aggregation pipeline that processed the entire orders collection before filtering. The fix was straightforward but impactful: move $match and $sort stages to the beginning of the pipeline so MongoDB can leverage indexes before processing downstream stages.

**症状关键词**: aggregation pipeline / $lookup / $match / $sort / 8.2s / 1.8s

### 诊断步骤
#### Step 1: 跑慢 pipeline 看 working set 规模
- metric: `aggregation_pipeline_duration`
- 采集层: mongo-shell
- 异常模式: > "Dashboard load time: 8.2s → 1.8s. Working set reduced from 80M to ~45K documents before $lookup runs."
- 阈值: {"before_seconds": 8.2, "before_doc_count": 80000000}

### possible 根因 (非参数类)
#### Cause 1: pipeline 顺序错: $match/$sort 应在 $lookup/$unwind 之前
- type: application-design
- 原文: > "Aggregation stages like $lookup and $unwind that run without an early $match stage force MongoDB to process the entire collection before filtering. This turns what should be a 5ms operation into a 5-second one."
- 缓解: > "// AFTER: Optimized pipeline (1.8s)\ndb.orders.aggregate([\n  { $match: { sellerId: ObjectId(\"...\"), status: \"completed\" } },\n  { $sort: { orderDate: -1 } },\n  { $lookup: { from: \"products\", ... } },\n  { $unwind: \"$items\" },\n  { $group: { _id: \"$items.category\", revenue: { $sum: \"$total\" } } }\n])"

---

## AWS EC2 上 MongoDB 性能不可重现 / 不达上限

**case_id**: `mongo-aws-ec2-storage-network-tuning-06`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: AWS EC2

**engine**: mongodb
**symptom_category**: disk-io-saturation

### 症状 (原文)
> There are two performance configurations to consider: Reproducible performance for performance testing or benchmarking, and Raw maximum performance

**症状关键词**: AWS EC2 / Enhanced Networking / provisioned IOPS / ephemeral SSD

### 诊断步骤
#### Step 1: 看 EC2 实例类型 + 网络与存储配置
- metric: `EC2 instance type / Enhanced Networking 状态 / EBS provisioned IOPS`
- 采集层: os
- 异常模式: > "Not all instance types support Enhanced Networking."
- 阈值: Enhanced Networking 未启用 / 用 ephemeral SSD 而非 provisioned IOPS

### possible 根因 (参数类)
#### Cause 1: tcp_keepalive_time 未设 120
- param: `net.ipv4.tcp_keepalive_time`
- 异常值模式: 默认 7200,EC2 ELB/NLB 切连接
- 原文: > "Set tcp_keepalive_time to 120."

### possible 根因 (非参数类)
#### Cause 1: 实例未启用 Enhanced Networking
- type: hardware-network
- 缓解: > (升级到支持 Enhanced Networking 的实例类型)

#### Cause 2: 用 ephemeral SSD 替代 provisioned IOPS
- type: hardware-disk
- 缓解: > (改用 provisioned IOPS EBS · journal/data 分独立卷)

---

## WiredTiger Cache 峰值与复制延迟级联失败 (MongoDB 3.0 → 3.4 升级修复)

**case_id**: `mongo-cache-spike-replication-lag-cascade-01`
**来源**: [https://alexbevi.com/blog/2018/05/28/troubleshooting-a-mongodb-performance-issue/](https://alexbevi.com/blog/2018/05/28/troubleshooting-a-mongodb-performance-issue/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Troubleshooting a MongoDB Performance Issue

**engine**: mongodb
**symptom_category**: replica-lag

### 症状 (原文)
> This chart (48 hours sampled from 1 week ago) shows Cache Usage spiking and Replication Lag spiking. The cache spikes occur as new writes trigger index activity, which invalidates (dirties) cached memory and causes cache eviction.

**症状关键词**: Cache Usage / Replication Lag / cache eviction / secondaries / primary / throttled

### 诊断步骤
#### Step 1: 观察 Cache Usage 是否在 spike
- metric: `wiredTiger.cache.bytes_currently_in_the_cache`
- 采集层: mongo-internal-counter
- 异常模式: > "Cache Usage spiking"
- 阈值: NULL

#### Step 2: 观察 Replication Lag 是否在 spike
- metric: `replication_lag`
- 采集层: mongo-shell
- 异常模式: > "Replication Lag spiking"
- 阈值: NULL

#### Step 3: 观察主节点是否需要重启来释放 cache
- metric: `mongod_process_state`
- 采集层: os
- 异常模式: > "cache usage hits a certain point on the primary (left) server after which we have to kill the instance"
- 阈值: NULL

### possible 根因 (非参数类)
#### Cause 1: 写入触发索引活动 → cache 脏化 → eviction → 复制变慢
- type: application-design
- 原文: > "The cache spikes occur as new writes trigger index activity, which invalidates (dirties) cached memory and causes cache eviction."
- 缓解: > NULL

#### Cause 2: Secondaries 拉取数据被慢化 → lag 上升
- type: application-design
- 原文: > "This slows down the speed at which the secondaries can request data from the primary, which spikes the lag."
- 缓解: > NULL

#### Cause 3: Secondaries 大量请求反过来锁定 primary,新写入被节流
- type: application-design
- 原文: > "When the secondaries request more data, it would lock up the primary, which in turn affected the primary server's ability to ingest new content and write it to disk. The read/write buffers back up and new write requests are throttled."
- 缓解: > "As of MongoDB 4.0, non-blocking secondary reads have been added to address these types of latency issues."

#### Cause 4: MongoDB 3.0 老版本的 cache management / checkpoint / WAL 优化未引入
- type: os-version-bug
- 原文: > "the improvements to cache management and checkpoint areas were more likely to have improved my situation"
- 缓解: > "We completed a significant upgrade on Tuesday that brings our cluster up to mongodb-server 3.4.15 (from 3.0.15)."

---

## 连接数飙升 → 服务器吃不下请求

**case_id**: `mongo-connection-storm-driver-error-02`
**来源**: [https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Number of Connections

**engine**: mongodb
**symptom_category**: connection-storm

### 症状 (原文)
> In some cases, the number of connections between the applications and the database can overwhelm the ability of the server to handle requests.

**症状关键词**: connections / connection pool / driver error / configuration error

### 诊断步骤
#### Step 1: 看 connections.current 与 connections.available
- metric: `connections.current / connections.available`
- 采集层: mongo-runtime-cmd
- 异常模式: > "If there are numerous concurrent application requests, the database may have trouble keeping up with demand."
- 阈值: connections.current 接近 maxIncomingConnections;available → 0

#### Step 2: 比对 connections.current 与实际 workload
- metric: `connections.current vs workload (opcounters)`
- 采集层: mongo-runtime-cmd
- 异常模式: > "An extremely high number of connections, particularly without corresponding workload, is often indicative of a driver or other configuration error."
- 阈值: connections.current 高 但 opcounters 平稳 → 驱动 / 配置异常

### possible 根因 (参数类)
#### Cause 1: maxIncomingConnections 偏小或 ulimit 卡住
- param: `maxIncomingConnections / ulimit -n`
- 异常值模式: maxIncomingConnections < 业务峰值;ulimit -n < maxIncomingConnections
- 原文: > "Unless constrained by system-wide limits, the maximum number of incoming connections supported by MongoDB is configured with the maxIncomingConnections setting."

### possible 根因 (非参数类)
#### Cause 1: 应用未用 connection pooling 或 driver 异常重连
- type: application-design
- 原文: > "Spikes in the number of connections can also be the result of application or driver errors. All of the officially supported MongoDB drivers implement connection pooling, which allows clients to use and reuse connections more efficiently."

#### Cause 2: 写密集型应用未做 sharding
- type: application-design
- 原文: > "For write-heavy applications, deploy sharding and add one or more shards to a sharded cluster to distribute load among mongod instances."
- 缓解: > "deploy sharding and add one or more shards to a sharded cluster to distribute load among mongod instances"

---

## driver 连接池大小 < 1.10×并发请求数 → 池排队

**case_id**: `mongo-driver-pool-size-too-small-vs-concurrent-requests-02`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-checklist-development/](https://www.mongodb.com/docs/manual/administration/production-checklist-development/) (unknown)
**平台**: bare
**case_pattern**: parameter-audit
**source_heading**: Drivers

**engine**: mongodb
**symptom_category**: connection-storm

### 症状 (原文)
> Adjust the connection pool size to suit your use case, beginning at 110-115% of the typical number of concurrent database requests.

**症状关键词**: connection pool size / maxPoolSize / 110-115% concurrent requests

### 诊断步骤
#### Step 1: 比对 driver maxPoolSize 与应用层典型并发请求数
- metric: `driver maxPoolSize · 应用层典型并发请求数`
- 采集层: mongo-runtime-cmd
- 异常模式: > "beginning at 110-115% of the typical number of concurrent database requests"
- 阈值: maxPoolSize < 1.10 × 应用层典型并发请求数

### possible 根因 (参数类)
#### Cause 1: driver maxPoolSize 未按"110-115% × 并发请求数"设置
- param: `maxPoolSize`
- 异常值模式: < 1.10 × 应用层典型并发请求数
- 原文: > "Adjust the connection pool size to suit your use case, beginning at 110-115% of the typical number of concurrent database requests."

---

## $sort 或 SORT 阶段 spill 到磁盘 → 排序内存压力

**case_id**: `mongo-explain-sort-stage-disk-spill-01`
**来源**: [https://www.mongodb.com/docs/manual/reference/explain-results/](https://www.mongodb.com/docs/manual/reference/explain-results/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Sort Stage · $sort and $group Stages

**engine**: mongodb
**symptom_category**: memory-pressure

### 症状 (原文)
> If MongoDB cannot use an index or indexes

**症状关键词**: SORT / $sort / in-memory sort / spill / usedDisk / spilledBytes

### 诊断步骤
#### Step 1: 看 explain output 中是否含显式 SORT stage
- metric: `explain.queryPlanner.winningPlan SORT stage 是否存在`
- 采集层: mongo-shell
- 异常模式: > "in-memory sort operation"
- 阈值: winningPlan 树中存在 stage='SORT' 节点(意味没用 index 排序)

#### Step 2: 在 executionStats / allPlansExecution mode 看 $sort/$group 的 usedDisk / spills 计数
- metric: `$sort.usedDisk / $sort.spills / $sort.spilledBytes / $sort.spilledRecords / $sort.spilledDataStorageSize`
- 采集层: mongo-shell
- 异常模式: > "The number of times the stage spilled to disk"
- 阈值: usedDisk == true · spills > 0 · spilledBytes > 0

### possible 根因 (非参数类)
#### Cause 1: 排序字段未建索引,数据量超过 sort buffer
- type: application-design
- 原文: > "If MongoDB cannot use an index or indexes"

#### Cause 2: $group 输入数据量大,internalQueryMaxBlockingSortMemoryUsageBytes 不够
- type: application-design
- 原文: > "An estimate of the number of bytes written to disk"

---

## WiredTiger + EXT4 → 已知性能问题 · 应改 XFS

**case_id**: `mongo-fs-ext4-wiredtiger-perf-issue-should-use-xfs-02`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-checklist-operations/](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/) (unknown)
**平台**: bare
**case_pattern**: parameter-audit
**source_heading**: Filesystem

**engine**: mongodb
**symptom_category**: disk-io-saturation

### 症状 (原文)
> to avoid performance issues found when using EXT4 with WiredTiger

**症状关键词**: WiredTiger / EXT4 / XFS / filesystem

### 诊断步骤
#### Step 1: 检查 dbPath 文件系统类型
- metric: `dbPath 挂载点文件系统类型`
- 采集层: os
- 异常模式: > "to avoid performance issues found when using EXT4 with WiredTiger"
- 阈值: 文件系统 = ext4 且 storage engine = wiredTiger

### possible 根因 (参数类)
#### Cause 1: dbPath 文件系统是 EXT4 与 WiredTiger 不匹配
- param: `(deployment) dbPath 挂载点文件系统`
- 异常值模式: ext4(配 storage.engine=wiredTiger)
- 原文: > "If possible, use XFS as it generally performs better with MongoDB."

---

## dbPath 用 NFS 卷 → 性能下降且不稳定

**case_id**: `mongo-fs-nfs-dbpath-degraded-unstable-perf-01`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-checklist-operations/](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/) (unknown)
**平台**: bare
**case_pattern**: parameter-audit
**source_heading**: Filesystem

**engine**: mongodb
**symptom_category**: disk-io-saturation

### 症状 (原文)
> Using NFS drives can result in degraded and unstable performance.

**症状关键词**: NFS / dbPath / degraded performance / unstable

### 诊断步骤
#### Step 1: 检查 dbPath 所在挂载点的文件系统类型是否为 NFS
- metric: `dbPath 挂载点文件系统类型`
- 采集层: os
- 异常模式: > "Using NFS drives can result in degraded and unstable performance."
- 阈值: 文件系统类型 ∈ {nfs, nfs4}

### possible 根因 (参数类)
#### Cause 1: dbPath 部署到 NFS,fsync/锁语义不一致
- param: `(deployment) dbPath 挂载点文件系统`
- 异常值模式: NFS / NFSv4
- 原文: > "Using NFS drives can result in degraded and unstable performance."

---

## globalLock.currentQueue.total 持续高 → 大量请求等锁 → 性能降级

**case_id**: `mongo-globallock-current-queue-high-lock-contention-01`
**来源**: [https://mongoing.com/archives/39593](https://mongoing.com/archives/39593) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: 锁性能

**engine**: mongodb
**symptom_category**: lock-contention

### 症状 (原文)
> MongoDB使用一套锁机制确保数据集的一致性。如果某个操作执行时间较长或是一个队列表单，下一操作请求由于要等待当前操作释放锁而出现性能降级。

**症状关键词**: globalLock / currentQueue / deadlockCount / timeAcquiringMicros / 等锁 / 性能降级

### 诊断步骤
#### Step 1: 用 serverStatus 查 globalLock.currentQueue.total 是否持续高
- metric: `globalLock.currentQueue.total`
- 采集层: mongo-shell
- 异常模式: > "如果 globalLock.currentQueue.total 值持续较高，有可能有大量的请求在等待锁释放。说明可能有影响性能的并发问题。"
- 阈值: NULL

#### Step 2: 比较 globalLock.totalTime 与 uptime 看死锁是否长期持续
- metric: `globalLock.totalTime_vs_uptime`
- 采集层: mongo-shell
- 异常模式: > "如果  globalLock.totalTime  相对于  uptime 较高，说明数据库的死锁已经维持一段时间了。"
- 阈值: NULL

#### Step 3: 计算 locks.timeAcquiringMicros / acquireWaitCount 平均等待时间
- metric: `locks.avg_acquire_wait_micros`
- 采集层: mongo-shell
- 异常模式: > "locks.timeAcquiringMicros除以locks.acquireWaitCount能计算出特定锁模式的平均等待时间。"
- 阈值: NULL

### possible 根因 (非参数类)
#### Cause 1: 索引无效 / 表设计差 / 查询结构差 / 内存不足触发磁盘读 → 慢查询长持锁
- type: application-design
- 原文: > "慢查询可能的原因：索引的无效使用；非最优表设计模式；糟糕的查询结构；系统架构问题；内存不足触发磁盘读取。"
- 缓解: > NULL

---

## In-memory storage engine 数据超出 inMemorySizeGB → WT_CACHE_FULL

**case_id**: `mongo-inmemory-cache-full-overflow-01`
**来源**: [https://www.mongodb.com/docs/manual/core/inmemory/](https://www.mongodb.com/docs/manual/core/inmemory/) (unknown)
**平台**: bare
**case_pattern**: fault-management
**source_heading**: Memory Use

**engine**: mongodb
**symptom_category**: memory-pressure

### 症状 (原文)
> If a write operation would cause the data to exceed the specified memory size, MongoDB returns with the error

**症状关键词**: inMemorySizeGB / WT_CACHE_FULL / in-memory engine / overflow

### 诊断步骤
#### Step 1: 看 mongod 日志中是否含 WT_CACHE_FULL 错误
- metric: `mongod log "WT_CACHE_FULL" 出现频次`
- 采集层: log-grep
- 异常模式: > "WT_CACHE_FULL: operation would overflow cache"
- 阈值: 任意一次出现该错误即异常

#### Step 2: 比对当前 in-memory 用量与 inMemorySizeGB 配置
- metric: `dbStats / collStats 总 size vs inMemorySizeGB`
- 采集层: mongo-runtime-cmd
- 异常模式: > "If a write operation would cause the data to exceed the specified memory size"
- 阈值: sum(dbStats.dataSize) + indexes + oplog 接近 inMemorySizeGB

### possible 根因 (参数类)
#### Cause 1: inMemorySizeGB 配置过小(默认 50% RAM-1GB,业务数据已经增长超出)
- param: `storage.inMemory.engineConfig.inMemorySizeGB / --inMemorySizeGB`
- 异常值模式: inMemorySizeGB < 当前业务总数据(含索引 + oplog)
- 原文: > "By default, the in-memory storage engine uses 50% of physical RAM minus 1 GB"

---

## 容器中 WiredTiger 无法识别容器内存限制,回退 256MB 最小 cache

**case_id**: `mongo-k8s-container-wt-cache-fallback-256mb-01`
**来源**: [https://www.percona.com/blog/configure-wiredtiger-cachesize-inside-percona-distribution-for-mongodb-kubernetes-operator/](https://www.percona.com/blog/configure-wiredtiger-cachesize-inside-percona-distribution-for-mongodb-kubernetes-operator/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Changing the cacheSizeRatio

**engine**: mongodb
**symptom_category**: memory-pressure

### 症状 (原文)
> Now login into the shard and check the default memory allocated to the container and to the mongod instance. In below, the memory size available is 15G, but the memory limit to use in this container is 476MB only:

**症状关键词**: wiredTiger cache / container / memLimitMB / memSizeMB / Kubernetes / operator / 256MB fallback

### 诊断步骤
#### Step 1: 用 db.hostInfo() 查容器 vs 主机内存差异
- metric: `hostInfo.system.memSizeMB / memLimitMB`
- 采集层: mongo-shell
- 异常模式: > "the memory size available is 15G, but the memory limit to use in this container is 476MB only"
- 阈值: memSizeMB ≫ memLimitMB(本例 15006 vs 476)

#### Step 2: 读 wiredTiger.cache.maximum bytes configured
- metric: `wiredTiger.cache."maximum bytes configured"`
- 采集层: mongo-runtime-cmd
- 异常模式: > "The cache size of 256MB is too low for the real environment."
- 阈值: maximum_bytes_configured = 256MB(回退到最小值)

### possible 根因 (参数类)
#### Cause 1: operator cacheSizeRatio 默认 0.5,容器 memLimitMB 又过小 → 256MB 兜底
- param: `replsets.storage.wiredTiger.engineConfig.cacheSizeRatio + container resources.limits.memory`
- 异常值模式: cacheSizeRatio=0.5 默认 + memlimit ≤ 1G → 触发 minWiredTigerCacheSizeGB(256MB) 回退
- 原文: > "Here, the memory calculation for WT is done roughly as follows (Memory limit should be more than 1G, else 256MB is allocated by default:(Memory limit – 1G) * cacheSizeRatio"

### possible 根因 (非参数类)
#### Cause 1: WiredTiger 在 Docker 容器中无法自检测到 cgroup 内存限制
- type: hypervisor-issue
- 原文: > "In normal situations WiredTiger does this default-sizing correctly but under Docker containers WiredTiger fails to detect the memory limit of the Docker container. We explicitly set the WiredTiger cache size to fix this."

---

## PSMDB operator v1.9 / v1.10 已知 bug · cacheSizeRatio 改了但 mongod 仍按默认 cache 启动

**case_id**: `mongo-k8s-operator-cachesize-bug-cpu-limit-required-02`
**来源**: [https://www.percona.com/blog/configure-wiredtiger-cachesize-inside-percona-distribution-for-mongodb-kubernetes-operator/](https://www.percona.com/blog/configure-wiredtiger-cachesize-inside-percona-distribution-for-mongodb-kubernetes-operator/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: (Conclusion 段附录 / K8SPSMDB-603)

**engine**: mongodb
**symptom_category**: memory-pressure

### 症状 (原文)
> Till PSMDB operator v1.10.0, the operator takes the change of cacheSizeRatio only if the resources.limit.cpu is also set. This is a bug and it got fixed in v1.11.0 – refer https://jira.percona.com/browse/K8SPSMDB-603 . So if you’re in an older version, don’t be surprised and you have to make sure the resources.limit.cpu is set as well.

**症状关键词**: PSMDB operator / cacheSizeRatio / K8SPSMDB-603 / resources.limits.cpu / v1.10 bug

### 诊断步骤
#### Step 1: 检查 operator 版本 + cr.yaml 中 cpu limit 是否存在
- metric: `operator version + replsets.resources.limits.cpu`
- 采集层: os
- 异常模式: > "Till PSMDB operator v1.10.0, the operator takes the change of cacheSizeRatio only if the resources.limit.cpu is also set."
- 阈值: operator ≤ v1.10 且 cr.yaml 中 cpu limit 缺失或为 0

#### Step 2: 进 mongod pod 验证 wt cache 实际值
- metric: `wiredTiger.cache.maximum bytes configured`
- 采集层: mongo-runtime-cmd
- 异常模式: > "Till PSMDB operator v1.10.0, the operator takes the change of cacheSizeRatio only if the resources.limit.cpu is also set."
- 阈值: yaml cacheSizeRatio 已改但 mongod 实际 cache 与 ratio*memlimit 公式不匹配

### possible 根因 (非参数类)
#### Cause 1: operator 源码仅在 ResourceCPU.limit 非零时才追加 --wiredTigerCacheSizeGB
- type: application-design
- 原文: > "if limit, ok := resources.Limits[corev1.ResourceCPU]; ok && !limit.IsZero() {<br>args = append(args, fmt.Sprintf(<br>\"--wiredTigerCacheSizeGB=%.2f\",<br>getWiredTigerCacheSizeGB(resources.Limits, replset.Storage.WiredTiger.EngineConfig.CacheSizeRatio, true),<br>))<br>}"
- 缓解: > "From v1.11.0:" + "if limit, ok := resources.Limits[corev1.ResourceMemory]; ok && !limit.IsZero() {<br>    args = append(args, fmt.Sprintf(<br>       \"--wiredTigerCacheSizeGB=%.2f\",<br>       getWiredTigerCacheSizeGB(resources.Limits, replset.Storage.WiredTiger.EngineConfig.CacheSizeRatio, true),<br>))<br>}"

---

## 锁等待队列堆积导致请求被阻塞

**case_id**: `mongo-locking-queue-buildup-01`
**来源**: [https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Locking Performance

**engine**: mongodb
**symptom_category**: lock-contention

### 症状 (原文)
> MongoDB uses a locking system to ensure data set consistency. If certain operations are long-running or a queue forms, performance will degrade as requests and operations wait for the lock.

**症状关键词**: locking / queue / globalLock / deadlock / long-running

### 诊断步骤
#### Step 1: 看 globalLock.currentQueue.total 是否持续高位
- metric: `globalLock.currentQueue.total`
- 采集层: mongo-runtime-cmd
- 异常模式: > "If globalLock.currentQueue.total is consistently high, then there is a chance that a large number of requests are waiting for a lock."
- 阈值: currentQueue.total 持续 > 0(即业务 RPS 远低于 globalLock 排队增量)

#### Step 2: 看 globalLock.totalTime 与 uptime 比
- metric: `globalLock.totalTime / uptime`
- 采集层: mongo-runtime-cmd
- 异常模式: > "If globalLock.totalTime is high relative to uptime, the database has existed in a lock state for a significant amount of time."
- 阈值: totalTime / uptime ≫ 等同业务持续在 lock 状态

#### Step 3: 看 deadlock 与等锁均值
- metric: `locks.<type>.deadlockCount + locks.<type>.timeAcquiringMicros / acquireWaitCount`
- 采集层: mongo-runtime-cmd
- 异常模式: > "locks.<type>.deadlockCount provide the number of times the lock acquisitions encountered deadlocks."
- 阈值: 平均等锁时间(微秒)偏离基线 ≫ 1× 或 deadlockCount > 0

### possible 根因 (非参数类)
#### Cause 1: 索引/schema 不当导致长事务持锁
- type: application-design
- 原文: > "Long queries can result from ineffective use of indexes; non-optimal schema design; poor query structure; system architecture issues; or insufficient RAM resulting in disk reads."

#### Cause 2: 内存不足触发磁盘读 → 锁持有时间拉长
- type: hardware-memory-physical
- 原文: > "insufficient RAM resulting in disk reads"

---

## tcp_keepalive_time 大于云 LB 空闲超时 → 连接被静默切断

**case_id**: `mongo-network-tcp-keepalive-too-long-cloud-lb-drops-02`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (unknown)
**平台**: bare
**case_pattern**: parameter-audit
**source_heading**: Adjust tcp_keepalive_time

**engine**: linux-os
**symptom_category**: network-latency

### 症状 (原文)
> If the TCP keepalive value is greater than the TCP idle timeout on your cloud provider's load balancer, there is a risk that the system might silently drop connections.

**症状关键词**: tcp_keepalive_time / load balancer / silent drop / cloud connection

### 诊断步骤
#### Step 1: 看当前 tcp_keepalive_time
- metric: `net.ipv4.tcp_keepalive_time`
- 采集层: os
- 异常模式: > "If the TCP keepalive value is greater than the TCP idle timeout on your cloud provider's load balancer"
- 阈值: 当前值 > 云 LB 空闲超时(常见 60-120 秒)

### possible 根因 (参数类)
#### Cause 1: tcp_keepalive_time 默认值偏大
- param: `net.ipv4.tcp_keepalive_time`
- 异常值模式: 默认 7200(2 小时),远大于云 LB 空闲超时
- 原文: > "To reduce this risk, set tcp_keepalive_time to 120."

---

## MongoDB 在 NUMA 硬件上跨节点访问导致间歇性慢

**case_id**: `mongo-numa-cross-node-memory-degradation-04`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: MongoDB and NUMA Hardware

**engine**: mongodb
**symptom_category**: cpu-high

### 症状 (原文)
> Running MongoDB on a system with Non-Uniform Memory Access (NUMA) can cause a number of operational problems, including slow performance for periods of time and high system process usage.

**症状关键词**: NUMA / slow performance periods / high system process usage / numa interleave

### 诊断步骤
#### Step 1: 看 mongod 启动日志中是否有 NUMA warning
- metric: `mongod startup log · NUMA warning 行`
- 采集层: log-grep
- 异常模式: > "If the NUMA configuration may degrade performance, MongoDB prints a warning."
- 阈值: mongod 启动日志含 "NUMA" warning

#### Step 2: 看 numad daemon 是否在跑
- metric: `numad 进程`
- 采集层: os
- 异常模式: > "The numad daemon process can also reduce mongod performance. You should ensure numad is not enabled on MongoDB servers."
- 阈值: numad 进程在跑

### possible 根因 (参数类)
#### Cause 1: 未配 memory interleave policy
- param: `numactl --interleave=all (启动 mongod 时)`
- 异常值模式: 直接 `mongod` 启动 · 未走 numactl interleave
- 原文: > "you should configure a memory interleave policy so that the host behaves in a non-NUMA fashion"

### possible 根因 (非参数类)
#### Cause 1: numad daemon 在跑
- type: application-design
- 原文: > "The numad daemon process can also reduce mongod performance."
- 缓解: > "You should ensure numad is not enabled on MongoDB servers."

---

## open cursor 持续上升但流量未变

**case_id**: `mongo-open-cursor-rising-no-traffic-03`
**来源**: [https://www.mongodb.com/docs/manual/administration/performance-tuning/](https://www.mongodb.com/docs/manual/administration/performance-tuning/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Open Cursors

**engine**: mongodb
**symptom_category**: other

### 症状 (原文)
> If the number of open cursors is rising without a corresponding growth of traffic, this might be the result of poorly indexed queries, or long-running queries due to large result sets.

**症状关键词**: open cursors / long-running queries / poorly indexed / metrics.cursor

### 诊断步骤
#### Step 1: 跟踪 metrics.cursor.open.total 趋势,与 opcounters 对比
- metric: `metrics.cursor.open.total / opcounters.{query,getmore}`
- 采集层: mongo-runtime-cmd
- 异常模式: > "the number of open cursors is rising without a corresponding growth of traffic"
- 阈值: metrics.cursor.open.total 增速 ≫ opcounters 增速

### possible 根因 (非参数类)
#### Cause 1: 查询缺索引导致单 cursor 长时间不归还
- type: application-design
- 原文: > "this might be the result of poorly indexed queries, or long-running queries due to large result sets"

---

## vm.swappiness 默认 60 → MongoDB 频繁 swap 性能下降

**case_id**: `mongo-os-vm-swappiness-default-60-aggressive-swap-05`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (unknown)
**平台**: bare
**case_pattern**: parameter-audit
**source_heading**: Set vm.swappiness to 1 or 0

**engine**: linux-os
**symptom_category**: memory-pressure

### 症状 (原文)
> "Swappiness" is a Linux kernel setting that influences the behavior of the Virtual Memory manager. The vm.swappiness setting ranges from 0 to 100: the higher the value, the more strongly it prefers swapping memory pages to disk over dropping pages from RAM.

**症状关键词**: vm.swappiness / swap / memory pressure / default 60

### 诊断步骤
#### Step 1: 看当前 vm.swappiness
- metric: `vm.swappiness`
- 采集层: os
- 异常模式: > "A setting of 60 tells the kernel to swap to disk often, and is the default value on many Linux distributions."
- 阈值: 当前值 > 1

### possible 根因 (参数类)
#### Cause 1: vm.swappiness 未调
- param: `vm.swappiness`
- 异常值模式: 默认 60
- 原文: > "MongoDB performs best where swapping can be avoided or kept to a minimum. As such you should set vm.swappiness to eithe"(原文截断,完整意为应设 0 或 1)

---

## 大翻页 skip 性能塌陷: skip 100 页 12.8s → 改写 $gt 后稳定 10-20ms

**case_id**: `mongo-pagination-skip-deep-page-rewrite-02`
**来源**: [https://mongoing.com/archives/74118](https://mongoing.com/archives/74118) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: 分页翻页案例以及执行效率

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> 分页翻页，尤其是结果集特别多越往后翻页越慢，常规写法

**症状关键词**: skip / 翻页 / executionTimeMillis / totalKeysExamined / $gt / limit

### 诊断步骤
#### Step 1: explain 翻不同页位置的 skip 查询,看时间随页号增长
- metric: `explain.executionTimeMillis_per_page`
- 采集层: mongo-shell
- 异常模式: > "翻第二页(每页50条)\n\n\"executionStats\" : {\n\"executionSuccess\" : true,\n\"nReturned\" : 50,\n\"executionTimeMillis\" : 29,\n\"totalKeysExamined\" : 876,\n\"totalDocsExamined\" : 100,"
- 阈值: {"page2_ms": 29, "page10_ms": 1001, "page100_ms": 12830}

### possible 根因 (非参数类)
#### Cause 1: skip 必须扫前面所有 keys → 越深越慢
- type: application-design
- 原文: > "索引:org:1,no:1,signT:1,翻页从第一页到100页，执行时间从29ms到12830ms。其实100页数据才5000条,但是totalKeysExamined检查是108725,此时返回5000条，相当于indexkey:doc=20:1,显然是低效索引的。"
- 缓解: > "取消skip方式,对排序列增加一个大于上一页最大值来快速获取分页，性能基本上在10-20ms之间。"

#### Cause 2: 改写为 no:{$gt:lastValue}.limit(50) 后 indexkey:doc=1:1 性能稳定
- type: application-design
- 原文: > "如果id是唯一或者想办法使用唯一列来排序，此时可以将翻页语句修改如下：\n\ndb.test.find({org:\"10000\",staDate:ISODate(\"2020-07-17T00:00:00.000+08:00\"),\nsignStatus:{$in:[0,1]},no{$gt:N}，}).sort({no:1}).limit(50);"
- 缓解: > "db.test.find({org:\"10000\", staDate: ISODate(\"2020-07-17T00:00:00.000+08:00\"), signStatus:{$in:[ 0, 1 ] } ,no:{$gt:latest.no}}).sort({no:1}).limit(50)"

---

## MongoDB 7.0 SBE plan cache 膨胀: 单 query shape 5 万+ plan → OOM kill

**case_id**: `mongo-plancache-bloat-sbe-7-0-oom-kills-01`
**来源**: [https://www.mydbops.com/blog/mongodb-plancache-memory-issue-sbe-fix](https://www.mydbops.com/blog/mongodb-plancache-memory-issue-sbe-fix) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: MongoDB 7.0 High Memory Usage: Environment and Initial Symptoms

**engine**: mongodb
**symptom_category**: memory-pressure

### 症状 (原文)
> We operate a 5-node MongoDB replica set where everything initially looked normal: CPU was low, cache behavior was healthy, and no slow-query spikes were visible. Over time, however, resident memory kept climbing until the Linux OOM killer started terminating mongod processes.

**症状关键词**: MongoDB 7.0 / OOM killer / mongod / resident memory / SBE / plan cache

### 诊断步骤
#### Step 1: 读 top 看 mongod 进程 RES 是否远超 cache + heap 配置
- metric: `mongod_resident_memory`
- 采集层: os
- 异常模式: > "704060 mongodb   20   0   73.6g  65.5g  36660 S 236.7  53.1   1746:34 mongod"
- 阈值: {"VIRT_GB": 73.6, "RES_GB": 65.5, "RAM_total_GiB": 123}

#### Step 2: 启用 heapProfilingEnabled 看内存分配 hot path
- metric: `heap_profile_alloc_hotspots`
- 采集层: mongo-runtime-cmd
- 异常模式: > "There was a high number of memory allocation logs for the query planner."
- 阈值: NULL

#### Step 3: 在慢日志中观察同一 query shape 的 queryHash / planCacheKey 是否变化
- metric: `queryHash_uniqueness_per_shape`
- 采集层: log-grep
- 异常模式: > "For the query below, the queryHash and planCacheKey values were changing with each query, even though the query itself remained the same."
- 阈值: NULL

#### Step 4: 用 getPlanCache().list() 看单集合 plan 缓存条目数
- metric: `planCache.entries_count`
- 采集层: mongo-shell
- 异常模式: > "A single collection had 52,891 query plans for one query shape, causing memory usage to rise with planCache growth."
- 阈值: {"plan_cache_entries": 52891}

#### Step 5: 跨版本对比(6.0 / 7.0 / 8.0) queryFramework + queryHash 行为
- metric: `queryFramework_per_version`
- 采集层: log-grep
- 异常模式: > "The issue occurred in MongoDB 7.0 but not in 6.0 or 8.0. It was identified as a bug in the SBE (Slot-Based Execution) engine introduced in 7.0. The issue is tracked in MongoDB JIRA SERVER-96924."
- 阈值: {"affected_versions": ["7.0"], "fixed_in": "8.0", "jira": "SERVER-96924"}

### possible 根因 (参数类)
#### Cause 1: internalQueryFrameworkControl 默认走 SBE,触发 7.0 bug
- param: `internalQueryFrameworkControl`
- 异常值模式: (默认 trySbeEngine,在 7.0 上触发 SBE plan cache 不稳定 hash bug)
- 原文: > "Forced the classic query engine:db.adminCommand({ setParameter: 1, internalQueryFrameworkControl: \"forceClassicEngine\" });This server parameter forces MongoDB to use the classic query engine instead of SBE, bypassing the bug entirely."

### possible 根因 (非参数类)
#### Cause 1: MongoDB 7.0 SBE 引擎 plan cache key hashing bug (SERVER-96924)
- type: os-version-bug
- 原文: > "What started as occasional OOM kills turned into a weeks-long investigation that eventually traced back to an unexpected interaction between MongoDB's SBE query engine and the plan cache. This post walks through the full investigation, step by step, and how we finally nailed down the root cause - a bug specific to MongoDB 7.0's SBE implementation."
- 缓解: > "Both solutions worked. Memory usage stabilized with forceClassicEngine, and the issue was fully resolved in MongoDB 8.0."

#### Cause 2: 流量与内存增长正相关
- type: application-design
- 原文: > "During Diwali week (low traffic), memory growth slowed significantly. When traffic resumed, memory spiked again—confirming the leak was tied to query execution volume."
- 缓解: > NULL

---

## connectTimeoutMS 默认或过大 → 应用侧操作时间慢但 DB 侧未见

**case_id**: `mongo-pool-connect-timeout-too-large-01`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/](https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/) (unknown)
**平台**: bare
**case_pattern**: parameter-audit
**source_heading**: Tuning Your Connection Pool Settings

**engine**: mongodb
**symptom_category**: network-latency

### 症状 (原文)
> Slow application-side operation times that are not reflected in

**症状关键词**: slow application-side / real time panel / connectTimeoutMS

### 诊断步骤
#### Step 1: 读 driver connectTimeoutMS 当前值,与到副本集成员的最长网络延迟对比
- metric: `driver connectTimeoutMS 当前值 vs 副本集成员最长网络延迟`
- 采集层: mongo-runtime-cmd
- 异常模式: > "Slow application-side operation times that are not reflected in"
- 阈值: connectTimeoutMS 小于到副本集任一成员的网络延迟

### possible 根因 (参数类)
#### Cause 1: connectTimeoutMS 太小 · driver 在握手阶段超时切换成员
- param: `connectTimeoutMS`
- 异常值模式: < (副本集任一成员到 client 的网络延迟)
- 原文: > "Set connectTimeoutMS to a value greater than the longest network latency you have to a member of the set."

---

## DB CPU 比预期高 + 连接尝试比预期多 → maxPoolSize 太大压垮服务端

**case_id**: `mongo-pool-maxpoolsize-too-high-cpu-pressure-05`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/](https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/) (unknown)
**平台**: bare
**case_pattern**: parameter-audit
**source_heading**: Tuning Your Connection Pool Settings

**engine**: mongodb
**symptom_category**: cpu-high

### 症状 (原文)
> Database CPU usage is higher than expected. The server logs or real time panel show more connection attempts than expected.

**症状关键词**: CPU high / connection attempts / maxPoolSize

### 诊断步骤
#### Step 1: 比较 driver maxPoolSize 与服务端 CPU / connection 接受速率
- metric: `driver maxPoolSize · 服务端 CPU% · connection accept rate`
- 采集层: mongo-runtime-cmd
- 异常模式: > "Database CPU usage is higher than expected. The server logs or real time panel show more connection attempts than expected."
- 阈值: 服务端 CPU 持续高位 + 连接尝试速率显著上升

### possible 根因 (参数类)
#### Cause 1: maxPoolSize 过大或应用线程池过大 → 服务端被并发压垮
- param: `maxPoolSize`
- 异常值模式: 远大于服务端可承载并发,或应用线程数远大于实际需要
- 原文: > "Decrease the maxPoolSize or reduce the number of threads in your application."

---

## DB 负载低、活跃连接少、应用吞吐低于预期 → maxPoolSize 太小限流了

**case_id**: `mongo-pool-maxpoolsize-too-low-underutilized-04`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/](https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/) (unknown)
**平台**: bare
**case_pattern**: parameter-audit
**source_heading**: Tuning Your Connection Pool Settings

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> The load on the database is low and there's a small number of active connections at any time.

**症状关键词**: maxPoolSize / low active connections / underutilized

### 诊断步骤
#### Step 1: 读 driver maxPoolSize 与应用层活跃线程数
- metric: `driver maxPoolSize · 应用活跃线程数 / 实际每秒操作数`
- 采集层: mongo-runtime-cmd
- 异常模式: > "The load on the database is low and there's a small number of active connections at any time."
- 阈值: maxPoolSize 接近活跃线程数;DB 资源未饱和但吞吐受限

### possible 根因 (参数类)
#### Cause 1: maxPoolSize 设置过小,把并发量从客户端限死
- param: `maxPoolSize`
- 异常值模式: 小于应用层活跃线程数 / 实际并发需求
- 原文: > "Increase maxPoolSize, or increase the number of active threads in your application or the framework you are using."

---

## 启动期可用连接不足 → 应用频繁建新连接 → minPoolSize 太小

**case_id**: `mongo-pool-minpoolsize-too-low-startup-creating-conns-03`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/](https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/) (unknown)
**平台**: bare
**case_pattern**: parameter-audit
**source_heading**: Tuning Your Connection Pool Settings

**engine**: mongodb
**symptom_category**: connection-storm

### 症状 (原文)
> the application spends too much time creating new connections

**症状关键词**: minPoolSize / creating new connections / startup

### 诊断步骤
#### Step 1: 比较 driver minPoolSize 当前值与"启动期希望可用连接数"
- metric: `driver minPoolSize · 服务器日志 / real time 面板 connection 创建速率`
- 采集层: log-grep
- 异常模式: > "the application spends too much time creating new connections"
- 阈值: minPoolSize 远小于启动期峰值并发(导致大量临时建连)

### possible 根因 (参数类)
#### Cause 1: minPoolSize 太小 · 池中预热连接不够,启动期被迫现建
- param: `minPoolSize`
- 异常值模式: 远小于启动期实际并发数
- 原文: > "Set minPoolSize to the number of connections you want to be available at startup."

---

## 防火墙错关连接 driver 不感知 → 应通过 socketTimeoutMS 兜底

**case_id**: `mongo-pool-socket-timeout-firewall-half-close-02`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/](https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/) (unknown)
**平台**: bare
**case_pattern**: parameter-audit
**source_heading**: Tuning Your Connection Pool Settings

**engine**: mongodb
**symptom_category**: connection-storm

### 症状 (原文)
> A misconfigured firewall closes a socket connection incorrectly and the driver cannot detect that the connection closed improperly.

**症状关键词**: firewall / socket close / socketTimeoutMS

### 诊断步骤
#### Step 1: 读 driver socketTimeoutMS 当前值,与最慢操作耗时对比
- metric: `driver socketTimeoutMS 当前值 vs 应用最慢合法操作耗时`
- 采集层: mongo-runtime-cmd
- 异常模式: > "A misconfigured firewall closes a socket connection incorrectly and the driver cannot detect that the connection closed improperly."
- 阈值: socketTimeoutMS 未设 / 设过大,导致 driver 持有半关连接长时间挂死

### possible 根因 (参数类)
#### Cause 1: socketTimeoutMS 未设 / 不合理 · driver 无超时机制兜底半关连接
- param: `socketTimeoutMS`
- 异常值模式: 未设 / 远大于业务最慢操作耗时
- 原文: > "Set socketTimeoutMS to two or three times the length of the slowest operation that the driver runs."

### possible 根因 (非参数类)
#### Cause 1: 网络中间件/防火墙错关连接
- type: network-physical-link
- 原文: > "A misconfigured firewall closes a socket connection incorrectly and the driver cannot detect that the connection closed improperly."

---

## profiler 慢查询阈值 / 抽样率默认配置审计

**case_id**: `mongo-profiler-threshold-sampling-audit-01`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/) (unknown)
**平台**: bare
**case_pattern**: parameter-audit
**source_heading**: Specify the Threshold for Slow Operations · Profile a Random Sample of Slow Operations

**engine**: mongodb
**symptom_category**: other

### 症状 (原文)
> By default, the slow operation threshold is 100 milliseconds

**症状关键词**: slowms / sampleRate / slowOpThresholdMs / profiling level / system.profile

### 诊断步骤
#### Step 1: 用 db.getProfilingStatus() 看当前 slowms 与 sampleRate
- metric: `profile.slowms / profile.sampleRate / profile.was`
- 采集层: mongo-shell
- 异常模式: > "By default, the slow operation threshold is 100 milliseconds"
- 阈值: slowms != 业务期望(默认 100ms);sampleRate < 1.0 但又依赖完整慢日志

### possible 根因 (参数类)
#### Cause 1: slowOpThresholdMs 默认 100ms 与业务 SLA 不匹配
- param: `operationProfiling.slowOpThresholdMs / db.setProfilingLevel slowms`
- 异常值模式: 默认 100ms · 业务期望更紧或更宽
- 原文: > "To change the slow operation threshold, use one of the following"

#### Cause 2: sampleRate 默认 1.0,profiler 在 level 1 高负载下成本不可忽视
- param: `operationProfiling.slowOpSampleRate / setProfilingLevel sampleRate`
- 异常值模式: sampleRate == 1.0 + profiling level 1 + 高 QPS → 写 system.profile 占比拉升
- 原文: > "By default, sampleRate is set to"

### possible 根因 (非参数类)
#### Cause 1: profiler 本身有开销,不是免费观察工具
- type: application-design
- 原文: > "When enabled, profiling affects database performance, especially at"

---

## PSA 架构 + majority write concern · secondary 不可用/落后导致写性能下降与读 stale

**case_id**: `mongo-psa-majority-writeconcern-perf-degradation-01`
**来源**: [https://www.mongodb.com/docs/manual/core/replica-set-arbiter/](https://www.mongodb.com/docs/manual/core/replica-set-arbiter/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Performance Issues with PSA replica sets

**engine**: mongodb
**symptom_category**: replica-lag

### 症状 (原文)
> performance issues if a secondary is unavailable or lagging

**症状关键词**: PSA / majority write concern / secondary lagging / stale data

### 诊断步骤
#### Step 1: 检查副本集拓扑是否为 PSA 三成员架构
- metric: `replSetGetStatus.members[] 的 stateStr 分布(PRIMARY/SECONDARY/ARBITER)`
- 采集层: mongo-runtime-cmd
- 异常模式: > "three-member primary-secondary-arbiter (PSA) architecture"
- 阈值: 拓扑 = 1 PRIMARY + 1 SECONDARY + 1 ARBITER(只有 1 个 data-bearing secondary)

#### Step 2: 检查 secondary 是否健康及 lag 情况
- metric: `secondary 的 health/state · optimeDate 与 primary 的差距`
- 采集层: mongo-runtime-cmd
- 异常模式: > "if a secondary is unavailable or lagging"
- 阈值: secondary state ≠ SECONDARY · 或 lag (primary.optimeDate − secondary.optimeDate) 显著 > 0

#### Step 3: 读取当前 default write concern / 关注业务侧使用的 write concern
- metric: `getDefaultRWConcern → defaultWriteConcern.w`
- 采集层: mongo-runtime-cmd
- 异常模式: > "and the write concern is less than the size of the majority, your queries may return stale (not fully replicated) data."
- 阈值: default write concern w < majority(== 2 in PSA) → 风险:stale read;w == majority → 风险:secondary 异常时写卡

### possible 根因 (参数类)
#### Cause 1: 默认 / 业务侧 write concern 与 PSA 拓扑搭配不当
- param: `defaultWriteConcern.w(及业务调用侧 write concern)`
- 异常值模式: `"majority"` 同时 secondary 不健康(写卡);或 < majority(读 stale)
- 原文: > "performance issues if a secondary is unavailable or lagging"

### possible 根因 (非参数类)
#### Cause 1: PSA 架构本身只有 1 个 data-bearing secondary,故障容忍度低
- type: application-design
- 原文: > "If you are using a three-member primary-secondary-arbiter (PSA) architecture, consider the following:"

#### Cause 2: secondary 物理 / 网络故障导致不可用或 lag
- type: hardware-disk
- 原文: > "if a secondary is unavailable or lagging"

---

## 索引存在但 totalDocsExamined ≫ nReturned + 出现独立 SORT stage

**case_id**: `mongo-query-ixscan-poor-selectivity-extra-sort-02`
**来源**: [https://www.percona.com/blog/mongodb-investigate-queries-with-explain-index-usage-part-2/](https://www.percona.com/blog/mongodb-investigate-queries-with-explain-index-usage-part-2/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Example 3

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> Let’s return now to the original query. We can also notice that the number of documents examined is still too high (2517) compared to the documents returned (493). That’s not optimal.

**症状关键词**: explain / IXSCAN / totalDocsExamined / nReturned / SORT stage / compound index / selectivity

### 诊断步骤
#### Step 1: 用 explain 比较 totalDocsExamined 与 nReturned 的比值
- metric: `executionStats.totalDocsExamined / executionStats.nReturned`
- 采集层: mongo-shell
- 异常模式: > "the number of documents examined is still too high (2517) compared to the documents returned (493). That’s not optimal."
- 阈值: totalDocsExamined / nReturned ≫ 1(原文示例 ≈ 5×)

#### Step 2: 检查 winningPlan 是否含独立 SORT stage
- metric: `explain.queryPlanner.winningPlan.stage(子节点是否含 SORT)`
- 采集层: mongo-shell
- 异常模式: > "In this case, we have fewer documents examined but since the cuisine_1 index cannot be used, a SORT stage is needed, and the index used to fetch the document is borough_1. While MongoDB has examined fewer documents, the execution time is worse because of the extra stage used to sort the documents."
- 阈值: winningPlan 包含独立 "stage": "SORT" 节点(非索引天然有序)

### possible 根因 (非参数类)
#### Cause 1: 单字段索引覆盖度不够,需要复合索引(字段顺序按选择性)
- type: application-design
- 原文: > "Let’s see if we can further improve the query by adding another compound index on (cuisine,borough,grades.grade)."
- 缓解: > "MongoDB > db.restaurants.createIndex({cuisine:1,borough:1,\"grades.grade\":1})"

#### Cause 2: 排序键不在索引前缀内导致额外 SORT stage
- type: application-design
- 原文: > "There is not a SORT stage because the documents are already extracted using the index, and so they are already sorted."

---

## Atlas Query Targeting alert: high scanned-to-returned document ratio

**case_id**: `mongo-query-targeting-high-scan-ratio-01`
**来源**: [https://www.mongodb.com/docs/atlas/reference/alert-resolutions/query-targeting/](https://www.mongodb.com/docs/atlas/reference/alert-resolutions/query-targeting/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Query Targeting

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> Ideally, the ratio of scanned documents to returned documents should be

**症状关键词**: query targeting / scanned documents / returned documents / ratio / COLLSCAN / inefficient query / slow query

### 诊断步骤
#### Step 1: 查看 Atlas Query Targeting metrics(Scanned/Returned 与 Scanned Objects/Returned)
- metric: `Atlas Query Targeting: Scanned/Returned & Scanned Objects/Returned`
- 采集层: atlas-advisor
- 异常模式: > "uses a 1000:1 threshold"
- 阈值: {"scanned_objects_to_returned": ">= 1000:1 (default)", "scanned_index_keys_to_returned": "user-defined"}

#### Step 2: 通过 mongod 慢查询日志确认 planSummary / docsExamined / nreturned
- metric: `mongod slow query log: planSummary / keysExamined / docsExamined / nreturned`
- 采集层: log-grep
- 异常模式: > "planSummary: COLLSCAN keysExamined:0docsExamined: 10000 cursorExhausted:1 numYields:234nreturned:4  protocol:op_query 358ms"
- 阈值: {"planSummary": "COLLSCAN", "keysExamined": 0, "docsExamined_to_nreturned_ratio_observed": 2500}

#### Step 3: 用 cursor.explain() 查看具体查询执行计划
- metric: `explain.executionStats`
- 采集层: mongo-shell
- 异常模式: > "This query scanned 10,000 documents and returned only 4 for a ratio\nof 2500, which is highly inefficient. No index keys were examined"
- 阈值: {"docsExamined": 10000, "nreturned": 4, "ratio": 2500}

### possible 根因 (非参数类)
#### Cause 1: 缺少支持查询的索引,导致全表扫描
- type: application-design
- 原文: > "The query targeting alert typically occurs when there is no index to\nsupport a query or queries or when an existing index only partially\nsupports a query or queries."
- 缓解: > "Add one or more indexes to better serve the inefficient queries."

#### Cause 2: MongoDB Search (mongot) change-stream cursor 拉高比值
- type: external-service
- 原文: > "The change streams cursors that the MongoDB Search\nprocess (mongot) uses to keep MongoDB Search indexes updated can\ncontribute to the query targeting ratio and trigger\nquery targeting alerts if the ratio\nis high."

---

## Ops Manager replication lag alert: secondary behind primary

**case_id**: `mongo-replica-lag-secondary-behind-primary-01`
**来源**: [https://www.mongodb.com/docs/ops-manager/current/reference/alerts/replication-lag/](https://www.mongodb.com/docs/ops-manager/current/reference/alerts/replication-lag/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Replication Lag

**engine**: mongodb
**symptom_category**: replica-lag

### 症状 (原文)
> secondary of replica set ABC was behind the most recent

**症状关键词**: replication lag / secondary / primary / replica set / oplog / behind

### 诊断步骤
#### Step 1: 查看 Replication Lag chart 确认延迟时长与持续时间
- metric: `Replication Lag (seconds)`
- 采集层: atlas-advisor
- 异常模式: > "Adjust the settings for this alert to only trigger if the replication\nlag persists for longer than 2 minutes."
- 阈值: {"replication_lag_persistent_seconds": ">= 120"}

#### Step 2: 查看 Replication Headroom 判断 secondary 是否会掉出 oplog 窗口
- metric: `Replication Headroom`
- 采集层: atlas-advisor

#### Step 3: 查看 Network metrics 判断带宽 / 网络问题
- metric: `Network metrics`
- 采集层: atlas-advisor

### possible 根因 (非参数类)
#### Cause 1: 副本集空闲(误报)· lag = 距上次写时间
- type: application-design
- 原文: > "An idle replica set. The reported replication lag is actually just the\ntime since the last write."

#### Cause 2: Secondary 配置不足,跟不上 primary
- type: hardware-cpu-physical
- 原文: > "The secondary is under-provisioned, which means it needs more\nallocated resources, and cannot keep up with the primary\n(common if using secondaries for read scaling)."
- 缓解: > "Move (or upgrade in place) the secondary to a machine that is\nidentically (or better) provisioned to the current primary."

#### Cause 3: primary↔secondary 网络带宽不足或网络问题
- type: hardware-network
- 原文: > "There is insufficient bandwidth, or some other networking problem,\nbetween the primary and secondary."
- 缓解: > "Resolve networking issues between the primary and secondary."

---

## replica set 成员双向连通性失败

**case_id**: `mongo-replica-set-member-connectivity-03`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/troubleshoot-replica-sets/](https://www.mongodb.com/docs/manual/tutorial/troubleshoot-replica-sets/) (unknown)
**平台**: bare
**case_pattern**: fault-management
**source_heading**: Test Connections Between all Members

**engine**: mongodb
**symptom_category**: network-latency

### 症状 (原文)
> All members of a replica set must be able to connect to every other member of the set to support replication. Always verify connections in both "directions." Networking topologies and firewall configurations can prevent normal and required connectivity, which can block replication.

**症状关键词**: replica set 成员连通 / bidirectional / firewall / bind_ip

### 诊断步骤
#### Step 1: 双向 mongosh 连接测试
- metric: `inter-member TCP reachability`
- 采集层: mongo-shell
- 异常模式: > "If any connection, in any direction fails, check your networking and firewall configuration and reconfigure your environment to allow these connections."
- 阈值: 任一方向连接失败

### possible 根因 (参数类)
#### Cause 1: bind_ip 仅绑 localhost
- param: `net.bindIp`
- 异常值模式: 仅含 localhost / 未含其他成员可达的 IP 或 hostname
- 原文: > "MongoDB binaries, mongod and mongos, bind to localhost by default."

### possible 根因 (非参数类)
#### Cause 1: 防火墙/网络拓扑阻断
- type: network-physical-link
- 原文: > "Networking topologies and firewall configurations can prevent normal and required connectivity, which can block replication."
- 缓解: > "If any connection, in any direction fails, check your networking and firewall configuration and reconfigure your environment to allow these connections."

#### Cause 2: split horizon DNS 仅 IP 配置(MongoDB 5.0+)
- type: os-version-bug
- 原文: > "Starting in MongDB 5.0, split horizon DNS nodes that are only configured with an IP address fail startup validation and report an error."
- 缓解: > "See disableSplitHorizonIPCheck."(原文紧接此句给出绕过参数 · 详见 source URL anchor)

---

## 同时重启 ≥2 secondary 导致集群失去多数票

**case_id**: `mongo-replica-set-reboot-multi-secondary-04`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/troubleshoot-replica-sets/](https://www.mongodb.com/docs/manual/tutorial/troubleshoot-replica-sets/) (unknown)
**平台**: bare
**case_pattern**: fault-management
**source_heading**: Socket Exceptions when Rebooting More than One Secondary

**engine**: mongodb
**symptom_category**: startup-failure

### 症状 (原文)
> When you reboot members of a replica set, ensure that the set is able to elect a primary during the maintenance. This means ensuring that a majority of the set's members[n].votes are available. When a set's active members can no longer form a majority, the set's primary steps down and becomes a secondary. The primary does not close client connections when it steps down. Clients cannot write to the replica set until the members elect a new primary.

**症状关键词**: socket exception / step down / reboot secondary / majority votes

### 诊断步骤
#### Step 1: 数有效投票成员
- metric: `rs.status() members[].votes (active count)`
- 采集层: mongo-shell
- 异常模式: > "Given a three-member replica set where every member has one vote, the set can elect a primary if at least two members can connect to each other. If you reboot the two secondaries at once, the primary steps down and becomes a secondary."
- 阈值: active votes < ceil((total_votes + 1) / 2)

### possible 根因 (非参数类)
#### Cause 1: 维护流程未保多数
- type: application-design
- 原文: > "When you reboot members of a replica set, ensure that the set is able to elect a primary during the maintenance. This means ensuring that a majority of the set's members[n].votes are available."
- 缓解: > (原文隐含建议:同时重启不超过总票数 - 多数所需的差。例 3 节点集合一次只重启 1 个)

---

## 副本集复制延迟(replication lag)

**case_id**: `mongo-replica-set-replication-lag-01`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/troubleshoot-replica-sets/](https://www.mongodb.com/docs/manual/tutorial/troubleshoot-replica-sets/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Check the Replication Lag

**engine**: mongodb
**symptom_category**: replica-lag

### 症状 (原文)
> Replication lag is a delay between an operation on the primary and the application of that operation from the oplog to the secondary. Replication lag can be a significant issue and can seriously affect MongoDB replica set deployments. Excessive replication lag makes "lagged" members ineligible to quickly become primary and increases the possibility that distributed read operations will be inconsistent.

**症状关键词**: replication lag / lagged member / secondary 落后 / syncedTo

### 诊断步骤
#### Step 1: 检查每个 secondary 的同步进度
- metric: `syncedTo time per secondary`
- 采集层: mongo-shell
- 异常模式: > `45 secs (0 hrs) behind the primary`(原文 Flow Control 段示例:某成员 syncedTo 落后 45 秒)
- 阈值: 落后秒数显著大于 0;持续增长更可疑

#### Step 2: 看是否触发 flow control
- metric: `flowControl.isLagged`
- 采集层: mongo-runtime-cmd
- 异常模式: > "If flow control has not engaged, investigate the secondary to determine the cause of the replication lag, such as limitations in the hardware, network, or application."
- 阈值: `flowControl.isLagged === true` 表示已触发流控,主在限速等待 secondary

### possible 根因 (参数类)
#### Cause 1: majority write concern 未启用
- param: `writeConcernMajorityJournalDefault / 应用层 writeConcern`
- 异常值模式: unacknowledged / w:1(未要求多数节点确认)
- 原文: > "For best results, configure write concern to require confirmation of replication to secondaries. This prevents write operations from returning if replication cannot keep up with the write load."

#### Cause 2: flowControlTargetLagSeconds 阈值
- param: `flowControlTargetLagSeconds`
- 异常值模式: 默认值偏宽 / 业务期望更紧的延迟容忍度
- 原文: > "With flow control enabled, as the lag grows close to the flowControlTargetLagSeconds, writes on the primary must obtain tickets before taking locks to apply writes. By limiting the number of tickets issued per second, the flow control mechanism attempts to keep the lag under the target."

### possible 根因 (非参数类)
#### Cause 1: 网络丢包/路由
- type: network-physical-link
- 原文: > "Check the network routes between the members of your set to ensure that there is no packet loss or network routing issue."
- 缓解: > "Use tools including ping to test latency between set members and traceroute to expose the routing of packets network endpoints."

#### Cause 2: secondary 磁盘 IO 跟不上
- type: hardware-disk
- 原文: > "If the file system and disk device on the secondary is unable to flush data to disk as quickly as the primary, then the secondary will have difficulty keeping state. Disk-related issues are incredibly prevalent on multi-tenant systems, including virtualized instances, and can be transient if the system accesses disk devices over an IP network (as is the case with Amazon's EBS system.)"
- 缓解: > "Use system-level tools to assess disk status, including iostat or vmstat."

#### Cause 3: primary 长事务/慢查询
- type: application-design
- 原文: > "In some cases, long-running operations on the primary can block replication on secondaries."
- 缓解: > "use the database profiler to see if there are slow queries or long-running operations that correspond to the incidences of lag."

#### Cause 4: 大批量写入 + unacknowledged
- type: application-design
- 原文: > "If you are performing a large data ingestion or bulk load operation that requires a large number of writes to the primary, particularly with unacknowledged write concern, the secondaries will not be able to read the oplog fast enough to keep up with changes."
- 缓解: > "request write acknowledgment write concern after every 100, 1,000, or another interval to provide an opportunity for secondaries to catch up with the primary."

---

## 复制集 secondary 落后 primary(4 类互斥根因)

**case_id**: `mongo-replication-lag-multi-cause-02`
**来源**: [https://www.mongodb.com/docs/manual/administration/performance-tuning/](https://www.mongodb.com/docs/manual/administration/performance-tuning/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Replication Lag

**engine**: mongodb
**symptom_category**: replica-lag

### 症状 (原文)
> Replication lag occurs when a secondary member of a replica set falls behind the primary.

**症状关键词**: replication lag / secondary / primary / oplog / replSetGetStatus

### 诊断步骤
#### Step 1: 看 oplog-related metrics 与 replSetGetStatus
- metric: `replSetGetStatus.members[].optimeDate / oplog window`
- 采集层: mongo-runtime-cmd
- 异常模式: > "the following problems are the most common causes of replication lag"
- 阈值: secondary optimeDate 落后 primary > SLA(原文未给具体阈值)

### possible 根因 (非参数类)
#### Cause 1: primary↔secondary 网络问题导致节点不可达
- type: network-physical-link
- 原文: > "A networking issue between the primary and secondary"

#### Cause 2: secondary 应用 oplog 速度比 primary 慢
- type: application-design
- 原文: > "A secondary node applying data slower than the primary node"

#### Cause 3: 写入容量不足
- type: application-design
- 原文: > "Insufficient write capacity, in which case you should add more shards"
- 缓解: > "you should add more shards"

#### Cause 4: primary 节点上有慢操作阻塞复制
- type: application-design
- 原文: > "Slow operations on the primary node, blocking replication"

---

## Scan and Order 数高 → 服务端排序内存压力

**case_id**: `mongo-scan-and-order-high-04`
**来源**: [https://www.mongodb.com/docs/manual/administration/performance-tuning/](https://www.mongodb.com/docs/manual/administration/performance-tuning/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Query Metrics

**engine**: mongodb
**symptom_category**: memory-pressure

### 症状 (原文)
> A high Scan and Order number, such as 20 or more, indicates that the server is having to sort results, increasing query result time and server memory load.

**症状关键词**: scanAndOrder / Scan and Order / sort / memory load / compound index

### 诊断步骤
#### Step 1: 读 metrics.operation.scanAndOrder
- metric: `metrics.operation.scanAndOrder`
- 采集层: mongo-runtime-cmd
- 异常模式: > "A high Scan and Order number, such as 20 or more"
- 阈值: scanAndOrder 计数(累计或每秒) >= 20

### possible 根因 (非参数类)
#### Cause 1: 索引顺序与查询 sort 不匹配 / 索引缺失
- type: application-design
- 原文: > "indicates that the server is having to sort results, increasing query result time and server memory load"
- 缓解: > "To fix a high Scan and Order number, sort your indexes according to query requirements, or add any missing indexes"

---

## 文档体积过大 → 频繁查询性能差

**case_id**: `mongo-schema-document-too-large-04`
**来源**: [https://www.mongodb.com/docs/atlas/performance-advisor/schema-suggestions/](https://www.mongodb.com/docs/atlas/performance-advisor/schema-suggestions/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Schema Suggestions

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> You have excessively large documents, which can degrade the performance of your most frequent queries.

**症状关键词**: large document / document size / frequent query slow

### 诊断步骤
#### Step 1: 看集合 avgObjSize 与最大文档大小
- metric: `collStats.avgObjSize / 文档大小 P99`
- 采集层: mongo-runtime-cmd
- 异常模式: > "You have excessively large documents, which can degrade the performance of your most frequent queries."
- 阈值: avgObjSize 显著大(原文未给数字 · 经验值 > 1MB 即应警惕)

### possible 根因 (非参数类)
#### Cause 1: 文档结构未拆分 / 嵌入了大型 array 或子文档
- type: application-design
- 缓解: > "Use The Outlier Pattern to handle a few large documents in an otherwise standard collection."

---

## $lookup 用得过多 → 应改为 embed 单集合内

**case_id**: `mongo-schema-too-many-lookups-should-embed-01`
**来源**: [https://www.mongodb.com/docs/atlas/performance-advisor/schema-suggestions/](https://www.mongodb.com/docs/atlas/performance-advisor/schema-suggestions/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Schema Suggestions

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> You are running too many $lookup operations on your data. Take advantage of MongoDB's rich schema model to embed related data in a single collection.

**症状关键词**: $lookup / embed vs reference / schema design

### 诊断步骤
#### Step 1: Atlas Advisor / 慢查询 profile 中统计 $lookup 频率
- metric: `慢查询中 $lookup pipeline stage 出现频率`
- 采集层: atlas-advisor / mongo-runtime-cmd
- 异常模式: > "You are running too many $lookup operations on your data."
- 阈值: (Atlas 内部启发式 · 自管理部署可统计 system.profile 中 $lookup 占比)

### possible 根因 (非参数类)
#### Cause 1: 数据被过度规范化(模仿关系数据库)
- type: application-design
- 原文: > "Take advantage of MongoDB's rich schema model to embed related data in a single collection."
- 缓解: > (使用 Extended Reference Pattern / 嵌入 frequently-read 字段)

---

## 集合上有未使用 index → 占盘 + 拖慢写性能

**case_id**: `mongo-schema-unused-indexes-bloat-03`
**来源**: [https://www.mongodb.com/docs/atlas/performance-advisor/schema-suggestions/](https://www.mongodb.com/docs/atlas/performance-advisor/schema-suggestions/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Schema Suggestions

**engine**: mongodb
**symptom_category**: disk-space-pressure

### 症状 (原文)
> You have unnecessary indexes in your collection, which can consume disk space and degrade write performance.

**症状关键词**: unused index / index bloat / write degradation

### 诊断步骤
#### Step 1: 看每索引的访问计数
- metric: `$indexStats accesses.ops · 每索引使用次数`
- 采集层: mongo-runtime-cmd
- 异常模式: > "You have unnecessary indexes in your collection, which can consume disk space and degrade write performance."
- 阈值: 索引 accesses.ops 长期为 0 / 极低

### possible 根因 (非参数类)
#### Cause 1: 历史遗留索引 / 测试时建的索引未清
- type: application-design
- 原文: > "You have unnecessary indexes in your collection, which can consume disk space and degrade write performance."
- 缓解: > (确认无业务依赖后 `db.coll.dropIndex(name)`)

---

## shard 全部成员不可用 → 该 shard 数据不可达

**case_id**: `mongo-shard-all-members-down-data-unavailable-03`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/troubleshoot-sharded-clusters/](https://www.mongodb.com/docs/manual/tutorial/troubleshoot-sharded-clusters/) (unknown)
**平台**: bare
**case_pattern**: fault-management
**source_heading**: All Members of a Shard Become Unavailable

**engine**: mongodb
**symptom_category**: startup-failure

### 症状 (原文)
> If all members of a replica set shard are unavailable, all data held in that shard is unavailable. However, the data on all other shards will remain available, and it is possible to read and write data to the other shards. However, your application must be able to deal with partial results, and you should investigate the cause of the interruption and attempt to recover the shard as soon as possible.

**症状关键词**: all shard members down / partial results / shard unrecoverable

### 诊断步骤
#### Step 1: 对每 shard 跑 rs.status()
- metric: `each shard's rs.status() · 至少有 1 个 PRIMARY/SECONDARY 节点`
- 采集层: mongo-shell
- 异常模式: > "If all members of a replica set shard are unavailable, all data held in that shard is unavailable."
- 阈值: 某 shard 全成员不可达

### possible 根因 (非参数类)
#### Cause 1: shard 整体故障(机房断电 / 网络分区)
- type: network-physical-link
- 原文: > "your application must be able to deal with partial results, and you should investigate the cause of the interruption"
- 缓解: > (从备份恢复或重新初始化 shard)

---

## shard chunk migration 卡死 LockTimeout · balancer 一直 abort

**case_id**: `mongo-shard-chunk-migration-x-lock-timeout-balancer-stuck-01`
**来源**: [https://finisky.github.io/en/mongodb-chunk-migration-failed/](https://finisky.github.io/en/mongodb-chunk-migration-failed/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: MongoDB Chunk Migration Failed Solution: Unable to acquire X lock

**engine**: mongodb
**symptom_category**: lock-contention

### 症状 (原文)
> balancer is not working. sh.status() displays many chunk migration errors

**症状关键词**: chunk migration / LockTimeout / MoveChunk / balancer / X lock / Unable to acquire

### 诊断步骤
#### Step 1: 用 sh.status() 看各 shard 的 chunk 分布与 24h migration 结果
- metric: `sharding.balancer.migration_24h_results · sharding.collection.chunks_per_shard`
- 采集层: mongo-shell
- 异常模式: > "7 : Failed with error 'aborted', from mongo-1 to mongo-3"
- 阈值: {"failed_migrations_24h": ">= 7000", "chunk_skew_max_min_ratio": ">= 1.5"}

#### Step 2: 在 config server 上 grep mongodb.log 的 SHARDING 模块 Migration failed log
- metric: `log.SHARDING.MigrationFailed.error`
- 采集层: log-grep
- 异常模式: > "LockTimeout: Unable to acquire X lock on '{13328793763114131834: Collection, 1799578717045662184, X.A}' within 500ms. opId: 669456657, op: MoveChunk, connId: 0."
- 阈值: {"error_class": "LockTimeout", "op": "MoveChunk", "lock_timeout_ms": 500}

#### Step 3: 手动 sh.moveChunk 验证错误重现
- metric: `sh.moveChunk.errmsg`
- 采集层: mongo-shell
- 异常模式: > "Unable to acquire X lock on '{13328793763114131834: Collection, 1799578717045662184, X.A}' within 500ms. opId: 719103624, op: MoveChunk, connId: 0."
- 阈值: {"errmsg_class": "LockTimeout", "code": 24, "codeName": "LockTimeout"}

#### Step 4: 排查 jumbo chunks 是否触发(经典误区)
- metric: `sharding.collection.jumbo_chunks`
- 采集层: mongo-shell
- 异常模式: > "jumbo chunks might lead to migration failure. So we checked the collection chunks by sh.status(true), NO jumbo chunks found."
- 阈值: {"jumbo_chunks_count": "> 0 → suspect; == 0 → 排除"}

#### Step 5: db.currentOp() 看正在持锁的 op
- metric: `currentOp.locks · currentOp.waitingForLock`
- 采集层: mongo-shell
- 异常模式: > "We also try to check the current operations and locks via db.currentOp() , but not have a clue."
- 阈值: {"hint": "线索缺失 · 进入下一步源端切主验证"}

### possible 根因 (非参数类)
#### Cause 1: 源 mongod 进程内部状态不一致 · X 锁释放卡死(本案根因)
- type: application-design
- 原文: > "the original mongod process has inconsistent states. Restart is just a simple way to force another member to become primary, which bypass the inconsistent states issue of the original mongod."
- 缓解: > "we restart the source mongod process through MongoDB Ops Manager to change the primary in the shard"

#### Cause 2: jumbo chunks 阻塞迁移(本案排除 · 但作为标准排查项保留)
- type: data-distribution
- 原文: > "jumbo chunks might lead to migration failure"

#### Cause 3: maxTransactionLockRequestTimeoutMillis 默认 500ms 过短(本案怀疑但未尝试)
- type: application-design
- 原文: > "Google a similar discussion here, which suggests to set maxTransactionLockRequestTimeoutMillis longer."

---

## config server replica set 失主导致集群元数据冻结

**case_id**: `mongo-shard-config-server-no-primary-04`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/troubleshoot-sharded-clusters/](https://www.mongodb.com/docs/manual/tutorial/troubleshoot-sharded-clusters/) (unknown)
**平台**: bare
**case_pattern**: fault-management
**source_heading**: A Config Server Replica Set Member Become Unavailable

**engine**: mongodb
**symptom_category**: startup-failure

### 症状 (原文)
> If the replica set config server loses its primary and cannot elect a primary, the cluster's metadata becomes read only. You can still read and write data from the shards, but no chunk migration or chunk splits will occur until a primary is available.

**症状关键词**: config server / metadata frozen / no chunk migration

### 诊断步骤
#### Step 1: 检查 config server replica set 状态
- metric: `config server replica set rs.status() · primary 是否存在`
- 采集层: mongo-shell
- 异常模式: > "If the replica set config server loses its primary and cannot elect a primary, the cluster's metadata becomes read only."
- 阈值: config server replica set 无 primary

### possible 根因 (非参数类)
#### Cause 1: config server 多数成员宕机/网络隔离
- type: network-physical-link
- 原文: > "All config servers must be running and available when you first initiate a sharded cluster."
- 缓解: > "For production deployments, we recommend deplying config server and shard replica sets on at least three data centers. This configuration provides high availability in case a single data center goes down."

---

## cursor 因 mongos 元数据陈旧失败

**case_id**: `mongo-shard-cursor-stale-config-05`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/troubleshoot-sharded-clusters/](https://www.mongodb.com/docs/manual/tutorial/troubleshoot-sharded-clusters/) (unknown)
**平台**: bare
**case_pattern**: fault-management
**source_heading**: Cursor Fails Because of Stale Config Data

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> A query returns the following warning when one or more of the mongos instances has not yet updated its cache of the cluster's metadata from the config database: > could not initialize cursor across all shards because : stale config detected

**症状关键词**: stale config / cursor / flushRouterConfig / mongos cache

### 诊断步骤
#### Step 1: 在 mongos 日志或客户端拿到的 warning 中匹配 "stale config detected"
- metric: `mongos warning log · "stale config detected" 出现频次`
- 采集层: log-grep
- 异常模式: > "This warning should not propagate back to your application. The warning will repeat until all the mongos instances refresh their caches."
- 阈值: warning 持续出现

### possible 根因 (非参数类)
#### Cause 1: mongos 元数据缓存与 config server 不同步
- type: application-design
- 原文: > "one or more of the mongos instances has not yet updated its cache of the cluster's metadata from the config database"
- 缓解: > "To force an instance to refresh its cache, run the flushRouterConfig command."

---

## mongos / 应用服务器不可用

**case_id**: `mongo-shard-mongos-unavailable-01`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/troubleshoot-sharded-clusters/](https://www.mongodb.com/docs/manual/tutorial/troubleshoot-sharded-clusters/) (unknown)
**平台**: bare
**case_pattern**: fault-management
**source_heading**: Application Servers or mongos Instances Become Unavailable

**engine**: mongodb
**symptom_category**: startup-failure

### 症状 (原文)
> If each application server has its own mongos instance, other application servers can continue to access the database. Furthermore, mongos instances do not maintain persistent state, and they can restart and become unavailable without losing any state or data. When a mongos instance starts, it retrieves a copy of the config database and can begin routing queries.

**症状关键词**: mongos unavailable / application server failover / router restart

### 诊断步骤
#### Step 1: 看 mongos 进程状态 + 监听端口
- metric: `mongos process aliveness`
- 采集层: os
- 异常模式: > "instances do not maintain persistent state, and they can restart and become unavailable without losing any state or data."(隐含异常 = mongos 进程不在)
- 阈值: mongos PID 不存在 / 端口未监听

### possible 根因 (非参数类)
#### Cause 1: mongos 进程崩溃
- type: application-design
- 原文: > "If each application server has its own mongos instance, other application servers can continue to access the database."
- 缓解: > (重启 mongos · 由于不持久化,重启后会从 config server 拉一份元数据继续路由)

---

## shard replica set 单成员不可用

**case_id**: `mongo-shard-replica-member-down-02`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/troubleshoot-sharded-clusters/](https://www.mongodb.com/docs/manual/tutorial/troubleshoot-sharded-clusters/) (unknown)
**平台**: bare
**case_pattern**: fault-management
**source_heading**: A Single Member Becomes Unavailable in a Shard Replica Set

**engine**: mongodb
**symptom_category**: replica-lag

### 症状 (原文)
> Always investigate availability interruptions and failures. If a system is unrecoverable, replace it and create a new member of the replica set as soon as possible to replace the lost redundancy.

**症状关键词**: shard member down / replica set failover / redundancy

### 诊断步骤
#### Step 1: rs.status() 看成员状态
- metric: `rs.status() members[].state`
- 采集层: mongo-shell
- 异常模式: > "If the unavailable mongod is a primary, then the replica set will elect a new primary."
- 阈值: 至少 1 个成员 state != PRIMARY/SECONDARY/ARBITER

### possible 根因 (非参数类)
#### Cause 1: 成员节点宕机或网络隔离
- type: network-physical-link
- 原文: > "If the unavailable mongod is a secondary, and it disconnects the primary and secondary will continue to hold all data. In a three member replica set, even if a single member of the set experiences catastrophic failure, two other members have full copies of the data."
- 缓解: > "If an unavailable secondary becomes available while it still has current oplog entries, it can catch up to the latest state of the set using the normal replication process"

---

## chunk 计数均衡但数据/查询全压在一个 shard(getShardDistribution 100%/0%)

**case_id**: `mongo-sharding-equal-chunks-skewed-data-getshard-distribution-02`
**来源**: [https://www.percona.com/blog/2018/04/09/mongodb-sharding-are-chunks-balanced-part-1/](https://www.percona.com/blog/2018/04/09/mongodb-sharding-are-chunks-balanced-part-1/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: I cannot see any jumbo chunks, and chunks are distributed evenly in each shard but of different sizes

**engine**: mongodb
**symptom_category**: disk-io-saturation

### 症状 (原文)
> A common misconception about the balancer is that it balances the chunks by data size. This isn’t true. It just balances the number of chunks when a particular shard reaches maximum thershold counts (that’s why you see chunks equally distributed). Hence a chunk with 0 documents in it counts just the same as one with 500k documents.

**症状关键词**: getShardDistribution / balancer misconception / range-based sharding / data skew / chunk count vs data

### 诊断步骤
#### Step 1: 用 db.col.getShardDistribution() 看每 shard 实际数据/文档数
- metric: `getShardDistribution: per-shard data / docs / chunks`
- 采集层: mongo-shell
- 异常模式: > "It says two chunks in each shard (shard0000 and shard0001), and shard0001 has no data while shard0000 has all the data, 129MB each chunk. Here the two chunks are on each shard because range-based sharding is being used."
- 阈值: 单 shard 占 100% 数据 / 100% docs;其他 shard 0%

### possible 根因 (非参数类)
#### Cause 1: range-based sharding 在初始 chunk 边界已固定
- type: application-design
- 原文: > "Here the two chunks are on each shard because range-based sharding is being used. MongoDB allocated two chunks for each shard initially, then documents are allocated to these chunks."
- 缓解: > "Hashed sharding is considered good for shard keys with fields that change monotonically. If you need the data to be exactly split among shards, then a hashed index must be used."

#### Cause 2: 单调递增/递减 shard key
- type: application-design
- 原文: > "A good shard key enables MongoDB to distribute documents evenly throughout shards. A key that has high cardinality for better horizontal scaling and low frequency to prevent uneven document distribution, and does not increase or decrease monotonically is considered a good shard key."

---

## jumbo chunks 无法被 balancer 迁移导致单 shard 写热点

**case_id**: `mongo-sharding-jumbo-chunk-uneven-write-load-01`
**来源**: [https://www.percona.com/blog/2018/04/09/mongodb-sharding-are-chunks-balanced-part-1/](https://www.percona.com/blog/2018/04/09/mongodb-sharding-are-chunks-balanced-part-1/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: What are jumbo chunks? + Ok, I have Jumbo chunks in my shard, but why should I bother

**engine**: mongodb
**symptom_category**: disk-io-saturation

### 症状 (原文)
> If jumbo chunks are created on the shard1, that means the chunks are more than 64MB of size. shard1 fills up faster compared to shard2, even though the number of chunks is balanced. More data to shard1 leads to more queries route to shard1 as compare to shard2. This causes one shard with a higher load compared to the other, and leads to performance issues.

**症状关键词**: jumbo chunks / balancer / shard imbalance / uneven distribution / write hotspot

### 诊断步骤
#### Step 1: 检查 balancer 状态
- metric: `sh.getBalancerState()`
- 采集层: mongo-shell
- 异常模式: > "Before we start, please check that the balancer is running:"
- 阈值: 返回 false 即异常(本 case 期望 true 才能继续)

#### Step 2: 用 sh.status(true) 看 chunk 标记
- metric: `sh.status verbose 输出中的 jumbo flag`
- 采集层: mongo-shell
- 异常模式: > "Please note, only one chunk is moved to the other shard, while the other is not. The balancer can’t move that, and it is flagged as “jumbo”. So sometimes when moving a chunk is triggered, the mongos will mark a large chunk as “jumbo”."
- 阈值: sh.status 输出中含 `jumbo` 标记的 chunk 行

#### Step 3: config.chunks 查询 jumbo 标记
- metric: `config.chunks { jumbo: true }`
- 采集层: mongo-shell
- 异常模式: > "Jumbo found! Now at this time, mongos is aware that it has a jumbo chunk."
- 阈值: 返回包含 `"jumbo" : true` 的文档

### possible 根因 (参数类)
#### Cause 1: 单 chunk 超过配置 chunk size(64MB)/ 25 万文档无法 split
- param: `sharding chunk size(默认 64MB)/ 25 万文档上限`
- 异常值模式: 单 chunk 实际大小或文档数超出此阈值
- 原文: > "MongoDB splits chunks when they increase beyond the configured chunk size (i.e., 64 MB) or exceeds 250000 documents. ... Sometimes chunks cannot be broken up and continue to grow beyond the configured size. The balancer cannot move it."

### possible 根因 (非参数类)
#### Cause 1: 多 mongos 或 mongos 频繁重启 · splitIfShould 计数器丢失
- type: application-design
- 原文: > "The main reason for jumbos is multiple mongos, or restarting mongos regularly. This causes the splitIfShould not to be called enough, and prevents chunks from splitting. The balancer won’t be able to move it."
- 缓解: > "Each mongos measures how much data it has seen inserted or updated for each chunk. With each write, a call to ShouldSplit is made by sending an internal command “splitVector” to the primary that owns the chunks. If mongos is restarted, it loses this memory."

#### Cause 2: 已存在 jumbo,需手动 split
- type: application-design
- 原文: > "Yes, these can be fixed by performing a manual split, using the “split” command. These chunks can be split into smaller pieces and easily moved by the balancer."
- 缓解: > "For more specific information on how to manually use the splitAt() and splitFind() commands, please refer this blog post written by Miguel Angel Nieto."

---

## 慢日志 grep + currentOp 定位长时执行操作并 kill

**case_id**: `mongo-slow-log-currentop-long-query-kill-02`
**来源**: [https://mongoing.com/archives/78150](https://mongoing.com/archives/78150) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: 【慢日志分析】

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> 慢日志只有当请求执行完毕才会，如果一个表很大，一个查询扫表，则整个执行过程可能需要数小时，可能还没记录慢日志，则可以通过如下命令获取当前执行时间超过5s的所有请求，查询请求，command请求

**症状关键词**: 慢日志 / currentOp / secs_running / killOp / COLLSCAN

### 诊断步骤
#### Step 1: grep mongod.log 找出 COLLSCAN 慢操作
- metric: `mongod.log.COLLSCAN_count`
- 采集层: log-grep
- 异常模式: > "找出文件末尾1000000行中存在扫表的操作，不包含oplog，getMore"
- 阈值: NULL

#### Step 2: grep 找出执行时间 1-10s 慢请求
- metric: `mongod.log.slow_query_1_10s`
- 采集层: log-grep
- 异常模式: > "找出文件末尾1000000行中执行时间1-10s的请求，不包含oplog，getMore"
- 阈值: {"window_ms_low": 1000, "window_ms_high": 10000}

#### Step 3: currentOp 取当前 > 5s 操作
- metric: `currentOp.secs_running`
- 采集层: mongo-shell
- 异常模式: > "可以通过如下命令获取当前执行时间超过5s的所有请求"
- 阈值: {"secs_running_gt_seconds": 5}

### possible 根因 (非参数类)
#### Cause 1: 大表无索引扫表查询长时间不结束,日志未落
- type: application-design
- 原文: > "如果一个表很大，一个查询扫表，则整个执行过程可能需要数小时，可能还没记录慢日志"
- 缓解: > "kill查询时间超过5s的所有请求：\ndb.currentOp().inprog.forEach(function(item){if(item.secs_running > 5 )db.killOp(item.opid)})"

---

## MongoDB 8.0 慢日志: workingMillis 与 durationMillis 分离 → 区分真慢查询 vs queue 等待

**case_id**: `mongo-slow-log-queue-wait-vs-working-time-mongodb8-01`
**来源**: [https://www.mydbops.com/blog/mongodb-8-slow-query-analysis-working-time-vs-duration-metrics](https://www.mydbops.com/blog/mongodb-8-slow-query-analysis-working-time-vs-duration-metrics) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Practical Diagnosis of Slow Queries

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> In previous versions of MongoDB, slow queries were flagged based on total duration, which included time spent waiting on locks and flow control. While this was helpful, it often meant that some queries appeared “slow” despite having minimal execution time.

**症状关键词**: workingMillis / durationMillis / totalTimeQueuedMicros / lock waits / flow control

### 诊断步骤
#### Step 1: 读取 mongod 慢日志,提取 workingMillis / durationMillis / queues.execution.totalTimeQueuedMicros
- metric: `mongod_slow_log.workingMillis`
- 采集层: log-grep
- 异常模式: > "workingMillis: 120,\n        \"durationMillis\": 300,\n        \"queues\": {\n            \"execution\": {\n                \"totalTimeQueuedMicros\": 180000\n            }\n        }"
- 阈值: {"example_workingMillis": 120, "example_durationMillis": 300, "example_totalTimeQueuedMicros": 180000}

#### Step 2: 比较 workingMillis 和 totalTimeQueuedMicros 走判断三分支
- metric: `workingMillis_vs_totalTimeQueuedMicros`
- 采集层: log-grep
- 异常模式: > "High workingMillis, Low totalTimeQueuedMicrosDiagnosis: The query is expensive in terms of actual execution time."
- 阈值: NULL

### possible 根因 (非参数类)
#### Cause 1: 真慢查询: workingMillis 高 + queue wait 低 → CPU/IO 紧张
- type: application-design
- 原文: > "High workingMillis, Low totalTimeQueuedMicrosDiagnosis: The query is expensive in terms of actual execution time.Action: Focus on optimizing the query itself by considering indexing improvements, refining query patterns, or reworking the schema."
- 缓解: > "Focus on optimizing the query itself by considering indexing improvements, refining query patterns, or reworking the schema."

#### Cause 2: queue 等待: workingMillis 低 + queue wait 高 → ticket / 锁瓶颈
- type: application-design
- 原文: > "Low workingMillis, High totalTimeQueuedMicrosDiagnosis: The query executes quickly but is delayed due to waiting for resources (e.g., lock or flow control).Action: Improve concurrency by tweaking settings like increasing ticket counts or considering horizontal scaling to better handle query load."
- 缓解: > "Improve concurrency by tweaking settings like increasing ticket counts or considering horizontal scaling to better handle query load."

#### Cause 3: 双重瓶颈: workingMillis 高 + queue wait 高 → 既慢又被排队
- type: application-design
- 原文: > "High workingMillis and High totalTimeQueuedMicrosDiagnosis: The query is both expensive and frequently delayed due to being stuck in the queue.Action: Prioritize query optimization. If the query remains queued, explore resource allocation and concurrency configurations to ensure smoother execution."
- 缓解: > "Prioritize query optimization. If the query remains queued, explore resource allocation and concurrency configurations to ensure smoother execution."

---

## 慢查询 explain() 五步排查链路

**case_id**: `mongo-slow-query-explain-multi-stage-01`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/explain-slow-queries/](https://www.mongodb.com/docs/manual/tutorial/explain-slow-queries/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Explain Slow Queries

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> If the execution time is above an acceptable period, further analysis is required to determine why the query takes so long to execute.

**症状关键词**: explain / executionStats / executionTimeMillis / COLLSCAN / IXSCAN / totalDocsExamined / nReturned

### 诊断步骤
#### Step 1: 看 executionTimeMillis 判定是否超 SLA
- metric: `explain.executionStats.executionTimeMillis`
- 采集层: mongo-shell
- 异常模式: > "If the execution time is above an acceptable period, further analysis is required to determine why the query takes so long to execute"
- 阈值: 单条 query executionTimeMillis > 业务 SLA 上限(原文未给数值)

#### Step 2: 看 executionStages.inputStage.stage 是否为 COLLSCAN
- metric: `explain.executionStats.executionStages.inputStage.stage`
- 采集层: mongo-shell
- 异常模式: > "Queries that perform filter or sort operations"
- 阈值: inputStage.stage == COLLSCAN(应是 IXSCAN)

#### Step 3: 看 keysExamined vs docsExamined 比
- metric: `executionStats.totalKeysExamined / executionStats.totalDocsExamined`
- 采集层: mongo-shell
- 异常模式: > "Queries on collections with indexes may not make effective use of the indexes"
- 阈值: totalKeysExamined ≪ totalDocsExamined → 索引未生效

#### Step 4: 看 totalDocsExamined / nReturned 比
- metric: `executionStats.totalDocsExamined / executionStats.nReturned`
- 采集层: mongo-shell
- 异常模式: > "indicates an ineffective index. That is, MongoDB had to scan the collection in order to filter the results"
- 阈值: totalDocsExamined / nReturned ≫ 1 → 过滤效率差

### possible 根因 (非参数类)
#### Cause 1: 索引未覆盖查询字段(应加索引覆盖)
- type: application-design
- 原文: > "If the query returns a small number of fields and the application is not write intensive on this collection, consider adding indexes to cover the query."
- 缓解: > "consider adding indexes to cover the query"

#### Cause 2: 现有索引前缀与查询条件不匹配
- type: application-design
- 原文: > "If the number of keys examined is much lower than the number of documents examined"

---

## Atlas Query Profiler: identify and interpret slow queries by multiple metrics

**case_id**: `mongo-slow-query-profiler-metric-01`
**来源**: [https://www.mongodb.com/docs/atlas/tutorial/query-profiler/](https://www.mongodb.com/docs/atlas/tutorial/query-profiler/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Find Slow Queries with the Query Profiler

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> monitoring can expose slow-running queries

**症状关键词**: slow queries / Query Profiler / Operation Execution Time / Docs Examined / Keys Examined / COLLSCAN / numYields / hasSort / Examined : Returned Ratio

### 诊断步骤
#### Step 1: 检查 Operation Execution Time + planSummary
- metric: `Operation Execution Time (ms) + planSummary`
- 采集层: atlas-advisor
- 异常模式: > "If you see \"planSummary\": \"COLLSCAN\": in the query log, the query performed a\ncollection scan and did not use an index. This is a strong signal to add an index\nor rewrite the query."
- 阈值: {"planSummary": "COLLSCAN", "operation_execution_time_ms": "consistently high"}

#### Step 2: 检查 Docs Examined / Keys Examined / Examined:Returned 比
- metric: `docsExamined / keysExamined / Docs Examined : Returned Ratio`
- 采集层: atlas-advisor
- 异常模式: > "If this metric is 0 for a query that includes filter conditions, it's highly likely\nthere is no index and MongoDB scanned the entire collection. This is a primary cause of slowness."
- 阈值: {"keysExamined_with_filter": 0, "docsExamined_to_docsReturned": ">> 1 (high)"}

#### Step 3: 检查 Num Yields / Has Index Coverage / hasSort
- metric: `numYields / usedIndex / hasSort`
- 采集层: atlas-advisor
- 异常模式: > "Num Yields (numYields): Frequent yields suggest resource contention\nor long-running operations that are pausing, potentially impacting overall throughput."
- 阈值: {"numYields": "frequent", "usedIndex": false, "hasSort_unindexed": true}

### possible 根因 (参数类)
#### Cause 1: slow query threshold 与 Profiler 阈值
- param: `slowOpThresholdMs (Atlas-managed dynamic / fixed 100ms)`
- 异常值模式: 阈值过高时漏报慢查询;过低时 Profiler 写入开销大
- 原文: > "This threshold can be changed using the\ndb.setProfilingLevel\nmongosh command."

### possible 根因 (非参数类)
#### Cause 1: 缺索引 / 索引选择性差导致全表扫描
- type: application-design
- 原文: > "If Docs Examined is very high and Keys Examined is 0 or\nvery low compared to Docs Examined, you're likely scanning the collection\nor a very unselective index."
- 缓解: > "Has Index Coverage (usedIndex): This boolean confirms whether a MongoDB\nindex was used. If set to false for a query that should be indexed, add an index."

#### Cause 2: 资源争用 / 长时间操作引发 yield
- type: application-design
- 原文: > "Num Yields (numYields): Frequent yields suggest resource contention\nor long-running operations that are pausing, potentially impacting overall throughput."

#### Cause 3: 未走索引的 sort 极耗资源
- type: application-design
- 原文: > "Unindexed sort() methods can be very resource intensive."
- 缓解: > "Check your search index configuration and confirm whether it supports the\nsort() method."

#### Cause 4: 返回过多字段(无 projection)放大网络/序列化开销
- type: application-design
- 原文: > "Response Length: Unusually large response lengths indicate that queries\nare returning more data than necessary. Consider using projections to limit the fields\nreturned."
- 缓解: > "Consider using projections to limit the fields\nreturned."

---

## MongoDB Snappy 压缩热点函数在鲲鹏 ARM64 上 CPU 占用偏高

**case_id**: `mongo-snappy-hotspot-cpu-high-arm64-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0030.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0030.html) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: 压缩算法调优

**engine**: mongodb
**symptom_category**: cpu-high

### 症状 (原文)
> 针对Snappy热点函数CPU占用较高的场景，通过升级Snappy压缩算法版本，可以有效提升服务器性能。

**症状关键词**: Snappy / 热点函数 / CPU占用 / 压缩算法 / snappy-1.1.7 / snappy-1.1.3

### 诊断步骤
#### Step 1: 在 mongod 进程上采 perf CPU 火焰图,看 Snappy 函数占比
- metric: `flamegraph.snappy.cpu_pct`
- 采集层: flamegraph
- 异常模式: > "针对Snappy热点函数CPU占用较高的场景，通过升级Snappy压缩算法版本，可以有效提升服务器性能。"
- 阈值: `snappy_*函数 CPU 占比 > 10% on flamegraph (qualitative)`

### possible 根因 (非参数类)
#### Cause 1: MongoDB 内置 Snappy-1.1.3 在 ARM64 上未优化
- type: application-design
- 原文: > "针对Snappy热点函数CPU占用较高的场景，通过升级Snappy压缩算法版本，可以有效提升服务器性能。"
- 缓解: > "下载最新版本的Snappy源码。解压下载的Snappy源码，并替换MongoDB源码中的老版本Snappy。"

---

## MongoDB 8.0+ 在 Linux Kernel 6.19 上启动 crash

**case_id**: `mongo-startup-kernel-6-19-tcmalloc-incompat-01`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (unknown)
**平台**: bare
**case_pattern**: fault-management
**source_heading**: MongoDB 8.0 Incompatible with Kernel 6.19

**engine**: mongodb
**symptom_category**: startup-failure

### 症状 (原文)
> Due to an incompatibility between a new kernel release and the currently vendored version of TCMalloc, running MongoDB 8.0 or newer with Linux kernel version 6.19 can cause MongoDB to crash on startup. This applies to all MongoDB packages, including those obtained from the MongoDB website, or obtained from package managers or Docker.

**症状关键词**: MongoDB 8.0 crash / kernel 6.19 / TCMalloc incompatibility / startup failure

### 诊断步骤
#### Step 1: 同时看 mongod 版本 + kernel 版本
- metric: `mongod --version + uname -r`
- 采集层: os
- 异常模式: > "running MongoDB 8.0 or newer with Linux kernel version 6.19 can cause MongoDB to crash on startup"
- 阈值: mongod major >= 8 AND kernel == 6.19.x

### possible 根因 (非参数类)
#### Cause 1: TCMalloc 版本与 6.19 内核的 ABI 冲突
- type: os-version-bug
- 原文: > "Due to an incompatibility between a new kernel release and the currently vendored version of TCMalloc"

---

## mongos 集中更新 system.sessions 拖垮主分片 → 集群瞬间数倍下降

**case_id**: `mongo-system-sessions-update-storm-primary-shard-degradation-03`
**来源**: [https://mongoing.com/archives/77972](https://mongoing.com/archives/77972) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: 优化策略4：sharding集群system.session优化

**engine**: mongodb
**symptom_category**: replica-lag

### 症状 (原文)
> 大流量大数据量集群客户端链接众多，大量更新sessions表，最终主分片性能下降引起整个集群性能瞬间数倍下降。

**症状关键词**: system.sessions / 主分片 / 瞬间数倍下降 / 慢日志 / mongos 代理

### 诊断步骤
#### Step 1: 看 mongostat / 慢日志 在 sessions 表更新时的瞬时尖峰
- metric: `mongostat.qrw_arw_or_slow_log_count`
- 采集层: mongo-runtime-cmd
- 异常模式: > "该优化后system.sessions表更新引起的瞬间性能数倍降低和大量慢日志问题得到了解决。"
- 阈值: NULL

### possible 根因 (非参数类)
#### Cause 1: system.sessions 未分片 + 集中时间点更新 → 主分片热点
- type: application-design
- 原文: > "之前代理集中式更新单个分片，优化为散列到不同时间点更新多个分片。"
- 缓解: > "config库的system.sessions表启用分片功能。\n\n\nmongos定期更新优化为散列到不同时间点进行更新。"

---

## tcmalloc 归还大量 pageheap free memory 时持内部锁数秒 · 全线程延迟尖峰

**case_id**: `mongo-tcmalloc-decommit-madvise-lock-stall-server-31417`
**来源**: [https://jira.mongodb.org/browse/SERVER-31417](https://jira.mongodb.org/browse/SERVER-31417) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Description (SERVER-31417)

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> tcmalloc may occasionally release large amounts of pageheap free memory to the kernel by calling madvise. This can take seconds when the amount of memory involved is many GB. A tcmalloc internal lock is held while this happens, so this can potentially stall many threads, causing widespread latency spikes.

**症状关键词**: tcmalloc / decommit / madvise / pageheap free / internal lock / latency spike / stall

### 诊断步骤
#### Step 1: 同一时刻 tcmalloc.pageheap_free_bytes 跌至接近 0
- metric: `serverStatus.tcmalloc.tcmalloc.pageheap_free_bytes`
- 采集层: mongo-runtime-cmd
- 异常模式: > "tcmalloc pageheap free memory decreases to near zero"
- 阈值: pageheap_free_bytes 在数秒内由数 GB 跌到接近 0

#### Step 2: 同时 tcmalloc unmapped 内存对应增加
- metric: `serverStatus.tcmalloc.tcmalloc.pageheap_unmapped_bytes`
- 采集层: mongo-runtime-cmd
- 异常模式: > "tcmalloc unmapped memory increases by a corresponding amount"
- 阈值: unmapped_bytes 同时段对称增加

#### Step 3: mongod 进程 RSS 同步下降
- metric: `mongod 进程 RSS`
- 采集层: os
- 异常模式: > "resident memory decreases by the same amount"
- 阈值: RSS 同时段下降相同量级

#### Step 4: 系统 free memory 同步上升
- metric: `/proc/meminfo MemFree`
- 采集层: os
- 异常模式: > "system free memory increases by that amount"
- 阈值: OS 层 MemFree 同时段对应上升

### possible 根因 (非参数类)
#### Cause 1: tcmalloc decommit 实现持全局锁,madvise 慢操作放大延迟尖峰
- type: application-design
- 原文: > "A tcmalloc internal lock is held while this happens, so this can potentially stall many threads, causing widespread latency spikes."

#### Cause 2: 直接指标缺失,SERVER-31380 才会补充
- type: application-design
- 原文: > "There is no direct metric that diagnoses this (SERVER-31380 would provide that), but it can be indirectly inferred to be a likely cause from the following:"

---

## mongod 内存远超已分配数据 · pageheap_free_bytes 持续累积

**case_id**: `mongo-tcmalloc-heap-fragmentation-pageheap-free-server-33296`
**来源**: [https://jira.mongodb.org/browse/SERVER-33296](https://jira.mongodb.org/browse/SERVER-33296) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Description (SERVER-33296)

**engine**: mongodb
**symptom_category**: memory-pressure

### 症状 (原文)
> Over time allocated memory never exceeds 8 GB but heap size and resident memory reach nearly 14 GB this is due to an accumulation of pageheap_free_bytes

**症状关键词**: tcmalloc / heap fragmentation / pageheap_free_bytes / RSS / TCMALLOC_AGGRESSIVE_DECOMMIT / initial sync

### 诊断步骤
#### Step 1: 比较 mongod allocated 与 RSS / 堆大小
- metric: `mongod tcmalloc.tcmalloc.generic.heap_size / current_allocated_bytes / pageheap_free_bytes`
- 采集层: mongo-runtime-cmd
- 异常模式: > "allocated memory never exceeds 8 GB but heap size and resident memory reach nearly 14 GB this is due to an accumulation of pageheap_free_bytes"
- 阈值: (heap_size - current_allocated_bytes) ≈ pageheap_free_bytes 且持续增长

#### Step 2: 读 mongod 进程 RSS
- metric: `mongod 进程 RSS`
- 采集层: os
- 异常模式: > "but heap size and resident memory reach nearly 14 GB"
- 阈值: RSS ≫ allocated_bytes(原文示例 ≈ 14GB vs 8GB)

### possible 根因 (参数类)
#### Cause 1: TCMALLOC_AGGRESSIVE_DECOMMIT 默认未启用
- param: `TCMALLOC_AGGRESSIVE_DECOMMIT(环境变量 / 启动参数)`
- 异常值模式: 未启用(默认),pageheap_free_bytes 不主动归还 OS
- 原文: > "Setting TCMALLOC_AGGRESSIVE_DECOMMIT can address this issue by causing tcmalloc to aggressively return the free pages to the o/s where they can then be re-used by tcmalloc to satisfy new memory requests. However can have an unacceptable negative performance impact."

### possible 根因 (非参数类)
#### Cause 1: 内存分配 size 分布在变化 · free pages 卡在某 size 类不可被新 size 复用
- type: application-design
- 原文: > "A common cause of this is a shifting distribution of allocated memory sizes, which leaves free pages dedicated to one size of buffer unable to be used for new memory requests because they are for a different size buffer."

#### Cause 2: MongoDB 3.6.2 的 WiredTiger 整体内存占用模型与 tcmalloc decommit 不友好
- type: os-version-bug
- 原文: > "The changes described in SERVER-20306 eliminated a common source of memory fragmentation, but it can still occur for other reasons."

---

## MongoDB 8.0 TCMalloc per-CPU caches 未启用 → 高负载下内存碎片与性能退化

**case_id**: `mongo-tcmalloc-percpu-caches-not-enabled-01`
**来源**: [https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/](https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/) (unknown)
**平台**: linux-arm64-kunpeng
**case_pattern**: core-perf-diagnosis
**source_heading**: TCMalloc Performance Optimization for a Self-Managed Deployment

**engine**: mixed
**symptom_category**: memory-pressure

### 症状 (原文)
> per-CPU caches, instead of per-thread caches, to reduce memory fragmentation and make your database more resilient to high-stress workloads.

**症状关键词**: TCMalloc / per-CPU caches / per-thread caches / memory fragmentation / rseq / glibc

### 诊断步骤
#### Step 1: 读 serverStatus 中 tcmalloc 字段判断 per-CPU caches 是否生效
- metric: `tcmalloc.usingPerCPUCaches / tcmalloc.tcmalloc.cpu_free`
- 采集层: mongo-runtime-cmd
- 异常模式: > "tcmalloc.usingPerCPUCaches is true"
- 阈值: usingPerCPUCaches != true 或 cpu_free <= 0

#### Step 2: 检查 glibc 是否抢先注册了 rseq
- metric: `glibc.pthread.rseq tunable / GLIBC_TUNABLES env`
- 采集层: os
- 异常模式: > "If another application, such as the glibc library, registers an rseq structure before TCMalloc, TCMalloc can't use rseq"
- 阈值: glibc rseq 已注册而 TCMalloc 启动时拿不到

#### Step 3: 检查内核版本是否 >= 4.18
- metric: `kernel version`
- 采集层: os
- 异常模式: > "If you disabled glibc rseq and per-CPU caches are still not enabled, ensure that you're using Linux kernel version 4.18 or later"
- 阈值: uname -r 主版本 < 4.18

### possible 根因 (参数类)
#### Cause 1: GLIBC_TUNABLES 未禁用 glibc.pthread.rseq
- param: `GLIBC_TUNABLES (env)`
- 异常值模式: 未设 glibc.pthread.rseq=0 → glibc 抢先注册 rseq
- 原文: > "To ensure that TCMalloc can use rseq to enable per-CPU caches, you can disable glibc"

### possible 根因 (非参数类)
#### Cause 1: 内核版本 < 4.18 → rseq 不可用
- type: os-version-bug
- 原文: > "You're using Linux kernel version 4.18 or later"

#### Cause 2: 操作系统在 legacy TCMalloc 名单上(RHEL/Oracle PPC64LE/s390x · Windows)
- type: os-version-bug
- 原文: > "These operating systems use the legacy TCMalloc version. If you use these operating systems, disable THP."
- 缓解: > "If you use these operating systems, disable THP."

---

## RHEL/CentOS tuned profile 用默认值 → 对 MongoDB 性能负向影响

**case_id**: `mongo-tuned-profile-default-rhel-perf-impact-05`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-checklist-operations/](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/) (unknown)
**平台**: bare
**case_pattern**: parameter-audit
**source_heading**: Linux

**engine**: linux-os
**symptom_category**: other

### 症状 (原文)
> RHEL / CentOS can negatively impact performance with their default

**症状关键词**: tuned / RHEL / CentOS / profile customization

### 诊断步骤
#### Step 1: 读当前 active tuned profile
- metric: `tuned-adm active 当前 profile 名`
- 采集层: os
- 异常模式: > "RHEL / CentOS can negatively impact performance with their default"
- 阈值: active profile ∈ 出厂默认 {throughput-performance, balanced, virtual-guest, ...} 且未做 MongoDB 适配

### possible 根因 (参数类)
#### Cause 1: active tuned profile 是出厂默认未定制
- param: `tuned profile`
- 异常值模式: 出厂默认未做 MongoDB 适配(THP / readahead / scheduler 等)
- 原文: > "RHEL / CentOS can negatively impact performance with their default"

---

## 系统默认 ulimit 过低导致 mongod 运行异常

**case_id**: `mongo-ulimit-low-defaults-mongod-issues-03`
**来源**: [https://amperecomputing.com/tuning-guides/mongoDB-tuning-guide](https://amperecomputing.com/tuning-guides/mongoDB-tuning-guide) (unknown)
**平台**: bare
**case_pattern**: fault-management
**source_heading**: ulimit(in "Tuning For Performance")

**engine**: linux-os
**symptom_category**: startup-failure

### 症状 (原文)
> Most UNIX-like operating systems, including Linux and macOS, provide ways to limit and control the usage of system resources such as threads, files, and network connections on a per-process and per-user basis. These "ulimits" prevent single users from using too many system resources. Sometimes, these limits have low default values that can cause a number of issues in the course of normal MongoDB operation.

**症状关键词**: ulimit / nofile / nproc / system resource limits

### 诊断步骤
#### Step 1: 看 mongod 进程的 ulimit
- metric: `mongod 进程 nofile / nproc / fsize / memlock 等 ulimit`
- 采集层: os
- 异常模式: > "these limits have low default values that can cause a number of issues"
- 阈值: nofile < 64000 / nproc < 64000(基于 mitigation 给定的推荐值)

### possible 根因 (参数类)
#### Cause 1: 系统级 limits.conf 未调
- param: `/etc/security/limits.conf 中各 ulimit 项`
- 异常值模式: 默认偏低(发行版自带)
- 原文: > "To configure ulimit value for these versions, create a file named /etc/security/limits.d/99-mongodb-nproc.conf with new values to increase the process limit."

---

## 文档中 array 无上限增长 → 每次更新触发整文档重写

**case_id**: `mongo-unbound-array-rewrite-pressure-05`
**来源**: [https://www.mongodb.com/docs/manual/administration/performance-tuning/](https://www.mongodb.com/docs/manual/administration/performance-tuning/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Document Structure Antipatterns

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> Unbound arrays: Arrays in a document that can grow without a size limit cause performance problems, because each time you update the array, MongoDB must rewrite the array into the document.

**症状关键词**: unbounded arrays / rewrite / document size / antipattern

### 诊断步骤
#### Step 1: 看慢查询日志中重复出现的 array-update 操作
- metric: `system.profile / slow query log + collStats.avgObjSize 趋势`
- 采集层: log-grep
- 异常模式: > "each time you update the array, MongoDB must rewrite the array into the document"
- 阈值: collStats.avgObjSize 单调增长 + 同一 array $push 慢查询反复出现

### possible 根因 (非参数类)
#### Cause 1: 应用层 schema 设计未对 array 设大小上限
- type: application-design
- 原文: > "Arrays in a document that can grow without a size limit cause performance problems"

---

## MongoDB 5.0+ 默认 writeConcern=majority 致 JournalFlusher 写盘成为热点

**case_id**: `mongo-write-regression-default-writeconcern-majority-journal-01`
**来源**: [https://www.percona.com/blog/mongodb-performance-regression-benchmarking-and-the-truth-behind-journaling/](https://www.percona.com/blog/mongodb-performance-regression-benchmarking-and-the-truth-behind-journaling/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Strange behavior + Digging for the truth

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> A customer had come with a problem in that the write performance dropped drastically after testing their writes between v4.4 and v7.0 as part of their upgrade. So I did tests around this by creating a write load with a million documents inserted into a collection on my system. I have chosen a single-member replicaSet just to keep the environment simple. In MongoDB v4.4, it took 6 minutes with the default settings, but the same set of tests took 127 minutes in v7.0 which was strange for me.

**症状关键词**: writeConcern / majority / writeConcernMajorityJournalDefault / JournalFlusher / j:true / regression / v4.4 to v7.0

### 诊断步骤
#### Step 1: 用 Flamegraph 定位 CPU 热点
- metric: `flamegraph CPU stack profile`
- 采集层: flamegraph
- 异常模式: > "Running with the default RW concern values and Flamegraph showed the culprit: the Journal Flusher was causing the long execution. Here is a screenshot of the Flamegraph where JournalFlusher is visible at the bottom left."
- 阈值: flamegraph 中 JournalFlusher 函数占据显著比例(对照态:disabled writeConcernMajorityJournalDefault 后 1.52%)

#### Step 2: 读取当前 default writeConcern
- metric: `getDefaultRWConcern.defaultWriteConcern`
- 采集层: mongo-shell
- 异常模式: > "I tested above with the default writeConcern: majority in v7.0 as I was using a single member only and didn’t consider setting writeConcern:1."
- 阈值: mongod 版本 ≥ 5.0 且 defaultWriteConcern.w = "majority" 且业务写延迟敏感

#### Step 3: 读 rs.conf().writeConcernMajorityJournalDefault
- metric: `rs.conf().writeConcernMajorityJournalDefault`
- 采集层: mongo-shell
- 异常模式: > "If journaling is enabled, w: “majority” may imply j: true. The writeConcernMajorityJournalDefault replica set configuration setting determines the behavior. See Acknowledgment Behavior for details."
- 阈值: writeConcernMajorityJournalDefault = true(默认) 且业务对写延迟敏感

### possible 根因 (参数类)
#### Cause 1: default writeConcern 升级后变为 majority
- param: `defaultWriteConcern.w`
- 异常值模式: 5.0+ 默认 "majority"(对比 4.4 默认 1)
- 原文: > "the default global write concern is changed from 1 to “majority” for the replicaset & sharded cluster environments. ... This changed how MongoDB behaves for every request to maintain the data integrity between the replicaSet members"

#### Cause 2: writeConcernMajorityJournalDefault=true 隐式 j:true
- param: `replicaSet.config.writeConcernMajorityJournalDefault`
- 异常值模式: true(默认)
- 原文: > "With j: true, MongoDB returns only after the requested number of members, including the primary, have written to the journal. Previously j: true write concern in a replica set only requires the primary to write to the journal, regardless of the w: <value> write concern."

### possible 根因 (非参数类)
#### Cause 1: MongoDB 5.0+ 服务端实现使 majority + journaling 形成同步写盘热路径
- type: application-design
- 原文: > "Usually, mongod acknowledges the writes when a majority of the members write into the on-disk journal file."
- 缓解: > "I did another test while keeping the majority RWConcern and writeConcernMajorityJournalDefault: false in rs.conf() to acknowledge the write operation with writing on memory only instead of waiting until the journal writing into the disk. Usually, mongod acknowledges the writes when a majority of the members write into the on-disk journal file. This time as expected after the change, a million documents were inserted within 10 minutes."

---

## sweep server 整 b-tree 驱逐期间集合访问被阻塞数分钟

**case_id**: `mongo-wt-btree-sweep-eviction-collection-blocked-server-17907`
**来源**: [https://jira.mongodb.org/browse/SERVER-17907](https://jira.mongodb.org/browse/SERVER-17907) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Description (SERVER-17907)

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> The sweep server under some conditions will evict entire b-trees, and for a large b-tree this can take an extended time (many minutes in some cases). While this is occurring any attempt to access the b-tree hangs.

**症状关键词**: WiredTiger / sweep server / b-tree eviction / collection blocked / cache 80%

### 诊断步骤
#### Step 1: 用 mongostat 观察 cache 利用率从 80% 跌到 0%
- metric: `wiredTiger cache used % (mongostat 输出列 used)`
- 采集层: mongo-runtime-cmd
- 异常模式: > "While this is running you should observe the cache utilization climb to its limit, 80%."
- 阈值: cache 利用率从 80% 在数分钟内跌到 0%

#### Step 2: 用 db.c.stats() 观察集合大小
- metric: `db.collection.stats(1024*1024).size + totalIndexSize`
- 采集层: mongo-shell
- 异常模式: > "Soon after this (within a minute) the sweep server will begin evicting the test.c collection and _id index b-trees; you will see cache utilization drop from 80% to 0% over the course of some time (a couple minutes, somewhat longer on Windows than Linux). During this time accesses to test.c block."
- 阈值: size + totalIndexSize 接近 cacheSize 上限 + 长时间未访问后被 sweep

### possible 根因 (参数类)
#### Cause 1: cacheSize 与单 b-tree 大小不匹配 · 8GB 数据 + 9GB cache 触发整树驱逐
- param: `storage.wiredTiger.engineConfig.cacheSizeGB`
- 异常值模式: cache 容纳了几乎一棵完整 b-tree;sweep 时整树一次性驱逐
- 原文: > "Example: start mongod with --storageEngine wiredTiger --wiredTigerCacheSizeGB 9. Then populate a collection with 8 GB of collection and index data"

### possible 根因 (非参数类)
#### Cause 1: MongoDB 3.0.1 WiredTiger sweep 实现 bug · 整 b-tree 同步驱逐
- type: os-version-bug
- 原文: > "The sweep server under some conditions will evict entire b-trees, and for a large b-tree this can take an extended time (many minutes in some cases). While this is occurring any attempt to access the b-tree hangs."

#### Cause 2: 小文档加剧驱逐 · 待释放 buffer 数极多
- type: application-design
- 原文: > "using small documents as below probably exacerbates the issue because it makes the eviction slower due to the number of buffers that must be freed during the eviction"

---

## WiredTiger 内部 cache 大小被人工调高 → 与 filesystem cache 抢内存

**case_id**: `mongo-wt-cache-size-misconfigured-01`
**来源**: [https://www.mongodb.com/docs/manual/core/wiredtiger/](https://www.mongodb.com/docs/manual/core/wiredtiger/) (unknown)
**平台**: bare
**case_pattern**: parameter-audit
**source_heading**: Cache Configuration Settings

**engine**: mongodb
**symptom_category**: memory-pressure

### 症状 (原文)
> Avoid increasing the WiredTiger internal cache size above its default value

**症状关键词**: wiredTigerCacheSizeGB / wiredTigerCacheSizePct / filesystem cache / default 50% RAM

### 诊断步骤
#### Step 1: 读 storage.wiredTiger.engineConfig.cacheSizeGB / cacheSizePct 当前值
- metric: `storage.wiredTiger.engineConfig.cacheSizeGB / cacheSizePct`
- 采集层: mongo-runtime-cmd
- 异常模式: > "Avoid increasing the WiredTiger internal cache size above its default value"
- 阈值: cacheSizeGB > 默认 50%(RAM - 1GB);或 cacheSizePct > 80%

### possible 根因 (参数类)
#### Cause 1: cacheSizeGB / cacheSizePct 被人工调高
- param: `storage.wiredTiger.engineConfig.cacheSizeGB / cacheSizePct`
- 异常值模式: 超过 "50% of (RAM - 1GB)" 默认基线 · 原文允许上限 80%
- 原文: > "The default WiredTiger internal cache size is the larger of either"

### possible 根因 (非参数类)
#### Cause 1: WT cache 不能区分读写,加大也不解决读热点
- type: application-design
- 原文: > "WiredTiger doesn't reserve a portion of the cache for reads and another for writes"

---

## WiredTiger checkpoint 周期偏长 → 磁盘 IO 短暂 100% 抖动

**case_id**: `mongo-wt-checkpoint-period-tuning-disk-io-spike-02`
**来源**: [https://mongoing.com/archives/77972](https://mongoing.com/archives/77972) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: 优化策略3：存储引擎checkpoint优化

**engine**: mongodb
**symptom_category**: disk-io-saturation

### 症状 (原文)
> 少部分实例存在如下现象：一会儿磁盘IO几乎空闲0%，一会儿磁盘IO短暂性100%。

**症状关键词**: checkpoint / 磁盘 IO 100% / 60s / 刷盘

### 诊断步骤
#### Step 1: 监控磁盘 IO 是否周期性 0% ↔ 100% 抖动
- metric: `disk_io_util`
- 采集层: os
- 异常模式: > "一会儿磁盘IO几乎空闲0%，一会儿磁盘IO短暂性100%"
- 阈值: {"disk_util_pct_low": 0, "disk_util_pct_high": 100}

### possible 根因 (参数类)
#### Cause 1: checkpoint 周期默认 60s + journal 2GB 阈值,脏数据积压后集中刷盘
- param: `wiredTigerEngineRuntimeConfig.checkpoint.wait / log_size`
- 异常值模式: "默认 wait=60s, log_size=2GB"
- 原文: > "该优化总体思路：缩短checkpoint周期，减少checkpoint期间积压的脏数据，缓解磁盘IO高问题。"

### possible 根因 (非参数类)
#### Cause 1: 优化后 checkpoint=(wait=30,log_size=1GB) 可缓解
- type: application-design
- 原文: > "进行如下优化后可以缓解该问题:\ncheckpoint=(wait=30,log_size=1GB)"
- 缓解: > "checkpoint=(wait=30,log_size=1GB)"

---

## bulk-load 期间 WiredTiger checkpoint 时间从几秒增至数分钟,期间业务停滞

**case_id**: `mongo-wt-checkpoint-time-grows-bulk-load-stall-01`
**来源**: [https://www.percona.com/blog/tuning-mongodb-for-bulk-loads/](https://www.percona.com/blog/tuning-mongodb-for-bulk-loads/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Tuning MongoDB for Bulk Loads(全文主线)

**engine**: mongodb
**symptom_category**: disk-io-saturation

### 症状 (原文)
> What we noticed is the load started at a decent rate, but after some time it started to slow down considerably. Doing some research by looking at metrics, we noticed WiredTiger checkpoint time was increasing more and more as time passed. We went from only a few seconds to checkpoints taking even a few minutes(!). During checkpoints, performance basically tanked:

**症状关键词**: WiredTiger checkpoint / checkpoint time / bulk load / dirty pages / stall

### 诊断步骤
#### Step 1: 监测 WiredTiger checkpoint 时间(PMM/趋势工具)
- metric: `wiredTiger checkpoint duration`
- 采集层: mongo-internal-counter
- 异常模式: > "WiredTiger checkpoint time was increasing more and more as time passed. We went from only a few seconds to checkpoints taking even a few minutes(!). During checkpoints, performance basically tanked:"
- 阈值: checkpoint 时长持续上升;原文期望 < 10s 视为合理

#### Step 2: 评估 cache 中脏页规模与 eviction 触发阈值
- metric: `wiredTiger.cache (eviction_dirty_trigger / eviction_dirty_target context)`
- 采集层: mongo-runtime-cmd
- 异常模式: > "Remember that in a sharp or full checkpoint, all dirty pages have to be flushed to disk. This will use all of your disk write capacity for as long as it takes. That explains the reason why these values have “low” defaults, as we want to limit the amount of work that the database has to do at each checkpoint."
- 阈值: dirty 页规模超出磁盘单次 checkpoint 可消化容量

### possible 根因 (参数类)
#### Cause 1: eviction_dirty_trigger=20 / eviction_dirty_target=5 默认值在大 cache 上仍是巨量
- param: `wiredTigerEngineRuntimeConfig.eviction_dirty_trigger / eviction_dirty_target`
- 异常值模式: dirty_trigger 默认 20% · dirty_target 默认 5% · 256GB cache 时 1% 即 2.56GB
- 原文: > "These parameters are again, expressed as a percentage of total WiredTiger cache usage. The lowest we can go is 1% (no floating-point values are allowed). 1% can still be quite a lot on a server with a high memory! A 256G cache is not uncommon these days, and 1% of that is 2.56 Gb. To be flushed all at once, one time per minute."

#### Cause 2: eviction 线程默认 4 个跟不上脏页生成速率
- param: `wiredTigerEngineRuntimeConfig.eviction.threads_min / threads_max`
- 异常值模式: 默认 threads_min=threads_max=4,bulk-load 下不足
- 原文: > "By default, MongoDB allocates four background threads to perform eviction. ... For this particular case, the default four threads weren’t enough to keep up with the rate of dirty page generation, as evidenced by Percona Monitoring and Management (PMM) graphics:"

### possible 根因 (非参数类)
#### Cause 1: sharp checkpoint 模型把脏页一次性刷盘,占满写带宽
- type: application-design
- 原文: > "As of MongoDB 4.2, the WiredTiger engine does a full checkpoint every 60 seconds (controlled by checkpoint=(wait=60)). This means that all dirty pages in the WiredTiger cache have to be flushed to disk every 60 seconds."
- 缓解: > "db.adminCommand( { \"setParameter\": 1, \"wiredTigerEngineRuntimeConfig\": \"eviction=(threads_min=20,threads_max=20),checkpoint=(wait=60),eviction_dirty_trigger=5,eviction_dirty_target=1,eviction_trigger=95,eviction_target=80\"})"

#### Cause 2: cache 满时应用线程被强制参与 eviction 致延迟飙升
- type: application-design
- 原文: > "If the pressure is too high, and cache usage increases to as high as 95 Gb (eviction_trigger), then application/client threads will be throttled. How? they will be asked to help the background threads perform eviction before being allowed to do their job, helping to relieve some of the pressure, at the expense of increasing latency to the clients. If even this is not enough, and the cache reaches 100% of the configured cache size, operations will stall."
- 缓解: > "After doing some experiments with the available hardware, we decided to increase the number of eviction threads to the maximum 20, reduce the dirty thresholds to the one to five-percent range, and also set a small WiredTiger cache of 1 Gb, which would limit the number of dirty pages to 10-50 Mb."

---

## WiredTiger 大页驱逐导致 fetch 期间多次显著停顿

**case_id**: `mongo-wt-large-page-eviction-fetch-pause-server-16479`
**来源**: [https://jira.mongodb.org/browse/SERVER-16479](https://jira.mongodb.org/browse/SERVER-16479) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Description (SERVER-16479)

**engine**: mongodb
**symptom_category**: query-slow

### 症状 (原文)
> Test consists of a single thread inserting about 800 MB worth of documents then fetching them back. Under rc1 significant pauses would be observed during the inserts; rc2 has eliminated the pauses during inserts, but at the expense of comparable pauses during the fetches.

**症状关键词**: WiredTiger / page eviction / large page / fetch pause / memory_page_max / pages written from cache

### 诊断步骤
#### Step 1: 监测 wiredTiger.cache.pages written from cache 与 read into cache 同步峰值
- metric: `wiredTiger.cache.pages written from cache / pages read into cache`
- 采集层: mongo-runtime-cmd
- 异常模式: > "First query experiences about half a dozen regularly spaced significant pauses (e.g. D and E), coinciding with page evictions due to the large in-memory pages created by the insertions, as indicated by the coincident peaks in pages written from cache."
- 阈值: fetch 期间 pages written from cache 与 pages read into cache 周期性同步出现尖峰

#### Step 2: gdb 抽样定位驱逐发生在 WiredTigerSession::releaseCursor
- metric: `mongod 进程栈采样函数命中分布`
- 采集层: flamegraph
- 异常模式: > "The gdb samples coinciding with this interval show that the eviction is occuring in __wt_btcur_reset called from WiredTigerSession::releaseCursor during the traversal of the collection."
- 阈值: gdb 采样栈中重复出现 `__wt_btcur_reset` / `WiredTigerSession::releaseCursor`

### possible 根因 (参数类)
#### Cause 1: memory_page_max 过大导致单页驱逐成本极高
- param: `wiredTiger.engineConfig.memory_page_max(诊断专用 · 实际生产不应调)`
- 异常值模式: 设到接近 1GB(诊断时为复现单次大停顿设的)
- 原文: > "Profile was obtained by increasing memory_page_max to 1GB to move all the pauses to a single long pause as the 1GB page is evicted"

### possible 根因 (非参数类)
#### Cause 1: MongoDB 2.8.0-rc2 的 WiredTiger 实现把 insert 阶段的卡顿迁移到了 fetch 阶段
- type: os-version-bug
- 原文: > "Under rc1 significant pauses would be observed during the inserts; rc2 has eliminated the pauses during inserts, but at the expense of comparable pauses during the fetches."

#### Cause 2: WiredTigerSession::releaseCursor 触发 page eviction 在游标释放路径上同步发生
- type: application-design
- 原文: > "the eviction is occuring in __wt_btcur_reset called from WiredTigerSession::releaseCursor during the traversal of the collection."

---

## 4.4 引入 durable history 后 tcmalloc 碎片化加剧 · mongod VSZ 比 4.2.6 多约 9G

**case_id**: `mongo-wt-tcmalloc-fragmentation-durable-history-wt-6175`
**来源**: [https://jira.mongodb.org/browse/WT-6175](https://jira.mongodb.org/browse/WT-6175) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Description (WT-6175)

**engine**: mongodb
**symptom_category**: memory-pressure

### 症状 (原文)
> The accumulation of many small data structures (typically associated with inserts and updates) in the WiredTiger cache can cause the system's memory allocator to use more space than is requested by WiredTiger.

**症状关键词**: tcmalloc / fragmentation / durable history / VSZ / eviction_dirty_trigger / eviction_updates_trigger / small objects

### 诊断步骤
#### Step 1: 比较 mongod 进程 VSZ 与配置 cacheSize 的差距
- metric: `mongod 进程 VSZ`
- 采集层: os
- 异常模式: > "For 4.4.0-rc4, VSZ for the mongod process is ~9G larger after create index compared to VSZ for 4.2.6 or 4.4 prior to the durable history merge."
- 阈值: mongod VSZ 比 cacheSizeGB + 合理开销大数 GB(原文示例 4.4-rc4 多 9G)

#### Step 2: 观察 cache dirty % 是否被新 eviction_updates_target 拖低
- metric: `wiredTiger cache dirty %`
- 采集层: mongo-runtime-cmd
- 异常模式: > "If this occurs you will notice that cache dirty % tends more toward the eviction_updates_target of 2.5% rather than the eviction_dirty_target of 5%."
- 阈值: cache dirty % 长期接近 2.5% 而非 5%(说明被新 updates trigger 主导)

### possible 根因 (参数类)
#### Cause 1: WT 4.4+ 新增的 eviction_updates_trigger=10% / target=2.5% 限制 small-object 累积
- param: `wiredTiger.cache.eviction_updates_trigger / eviction_updates_target`
- 异常值模式: 默认 trigger=10%(eviction_dirty_trigger/2),target=2.5%(eviction_dirty_target/2);若与 workload 不匹配会过早 eviction 或不够 eviction
- 原文: > "Adding a configurable trigger (eviction_updates_trigger) on the amount of small objects in the cache, to prompt eviction of that content. The default value is eviction_dirty_trigger / 2 (10%). Adding a configurable target (eviction_updates_target) to serve as a goal for the eviction process. The default value is eviction_dirty_target / 2 (2.5%)."

### possible 根因 (非参数类)
#### Cause 1: MongoDB 4.4 durable history 设计致小对象数量激增
- type: application-design
- 原文: > "With the introduction of durable history in MongoDB 4.4, it is more common that small memory allocations associated with these small objects are contributing more to fragmentation than in previous versions."

#### Cause 2: cache 中 small-object 重新驻留 + checkpoint 后被标 clean · 这部分不在脏页 trigger 控制范围
- type: application-design
- 原文: > "However, some WiredTiger cache pages with many associated small memory allocations can remain in cache after a checkpoint and be marked as clean pages. The clean/dirty distinction helps limit the amount of work done in checkpoints, but is in this way an estimate of memory allocator fragmentation."
- 缓解: > "Tracking insert and update data structures as a separate attribute of cache usage. Extending the cache eviction process to manage the proportion of cache associated with small allocations, similarly to how it manages clean and dirty content."

---

## WiredTiger 读写 ticket 持续 < 128 → 并发被限流

**case_id**: `mongo-wt-tickets-exhausted-01`
**来源**: [https://www.mongodb.com/docs/manual/administration/performance-tuning/](https://www.mongodb.com/docs/manual/administration/performance-tuning/) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Run Your Queries at Top Speed → WiredTiger Ticket Number metric

**engine**: mongodb
**symptom_category**: lock-contention

### 症状 (原文)
> The read and write tickets control the maximum number of concurrent transactions. The WiredTiger ticket number should always be at 128. Sustained values below 128 indicates a server delay and consequential potential issues.

**症状关键词**: WiredTiger / tickets / concurrent transactions / 128 / queues.execution

### 诊断步骤
#### Step 1: 用 serverStatus 看读写 ticket 当前数
- metric: `wiredTiger.concurrentTransactions.{read,write}.{available,out,totalTickets}`
- 采集层: mongo-runtime-cmd
- 异常模式: > "Sustained values below 128 indicates a server delay and consequential potential issues"
- 阈值: available 持续 < 128(7.0+ 动态阈值;6.x 默认 128)

#### Step 2: 看 queues.execution 段判负载与 ticket 可用性
- metric: `queues.execution.read / queues.execution.write`
- 采集层: mongo-internal-counter
- 异常模式: > "any new read or write requests will be queued until a new read or write ticket is available"
- 阈值: queues.execution.read 或 .write > 0 持续

### possible 根因 (参数类)
#### Cause 1: Dynamic Adjustment 未启用 / storageEngineConcurrent* 手调过紧
- param: `storageEngineConcurrentReadTransactions / storageEngineConcurrentWriteTransactions`
- 异常值模式: 7.0+ 已禁用动态调整 或 手动设到 < 业务并发需求
- 原文: > "If you need to manually adjust the maximum number of concurrent transactions, you can modify the storageEngineConcurrentReadTransactions and storageEngineConcurrentWriteTransactions parameters"

### possible 根因 (非参数类)
#### Cause 1: 集群 CPU/内存资源吃紧 → ticket 被持有时间拉长
- type: hardware-cpu-physical
- 原文: > "Ensure that your cluster has sufficient resources, such as CPU and memory, to handle the workload"
- 缓解: > "Ensure that your cluster has sufficient resources, such as CPU and memory, to handle the workload"

#### Cause 2: 索引 / schema 不当导致单事务持锁过久
- type: application-design
- 原文: > "Locking performance problems can indicate suboptimal indexes and poor schema design patterns, which can both lead to locks being held longer than necessary"

---

## cache 用量持续接近 eviction_trigger (默认 95%) → application threads 被拉去做 eviction

**case_id**: `wt-eviction-trigger-app-thread-throttle-01`
**来源**: [https://source.wiredtiger.com/mongodb-6.0/tune_cache.html](https://source.wiredtiger.com/mongodb-6.0/tune_cache.html) (unknown)
**平台**: bare
**case_pattern**: core-perf-diagnosis
**source_heading**: Eviction tuning

**engine**: mongodb
**symptom_category**: memory-pressure

### 症状 (原文)
> The eviction_trigger configuration value (default 95%) is the level at which application threads start to perform eviction. This will throttle application operations, increasing operation latency, usually resulting in the cache usage staying at this level when there is more cache pressure than eviction worker threads can handle in the background.

**症状关键词**: WiredTiger / eviction_trigger / cache pressure / application threads / eviction worker

### 诊断步骤
#### Step 1: 看 page eviction statistics 评估 cache size 效果
- metric: `wiredTiger.cache.bytes currently in the cache / wiredTiger.cache.maximum bytes configured`
- 采集层: mongo-internal-counter
- 异常模式: > "the cache usage staying at this level when there is more cache pressure than eviction worker threads can handle in the background"
- 阈值: bytes_in_cache / maximum_bytes 持续 ≈ 0.95

#### Step 2: 看 application threads 是否在做 eviction(latency spike)
- metric: `wiredTiger.cache.eviction worker thread evicting pages / application thread time evicting`
- 采集层: mongo-internal-counter
- 异常模式: > "application threads start to perform eviction"(对应 serverStatus.wiredTiger.cache 中 `Application thread time evicting` 计数 · 该字段名为内部启发式)
- 阈值: application thread evicting time per sec 显著 > 0

### possible 根因 (参数类)
#### Cause 1: eviction_trigger 默认 95% 与业务负载不匹配 → 余量太小
- param: `eviction_trigger`
- 异常值模式: 默认 95% · 业务峰值下 worker 来不及消化 → 应调低 trigger 给 worker 更多缓冲
- 原文: > "The eviction_trigger configuration value (default 95%) is the level at which application threads start to perform eviction"

### possible 根因 (非参数类)
#### Cause 1: cache size 配过小,工作集装不下
- type: application-design
- 原文: > "The size of the cache is the single most important tuning knob for a WiredTiger application. Ideally the cache should be configured to be large enough to hold an application's working set"
- 缓解: > "Ideally the cache should be configured to be large enough to hold an application's working set"

---
