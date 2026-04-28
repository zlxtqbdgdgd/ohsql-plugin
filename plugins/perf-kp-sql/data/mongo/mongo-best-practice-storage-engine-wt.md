# mongo-best-practice-storage-engine-wt

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 16 条 case。

---

## 生产环境禁止将 storage.syncPeriodSecs 设为 0 · 保持默认值 60

**case_id**: `mongo-config-syncperiodsecs-production-default-01`
**来源**: [https://www.mongodb.com/docs/manual/reference/configuration-options/](https://www.mongodb.com/docs/manual/reference/configuration-options/) (official)
**平台**: bare
**scope**: storage-engine-wt
**case_pattern**: parameter-best-practice

### 场景 (原文)
> The amount of time that can pass before MongoDB flushes data to the data files. Do not set this value on production systems. In almost every situation, you should use the default setting.

### 场景 (中文转述)
在生产系统中，`storage.syncPeriodSecs` 控制 MongoDB 将数据懒写到数据文件前允许的最长等待时间，默认值 60 秒。几乎所有场景下不应修改此值，尤其禁止设为 0。

### 推荐
- 值: ``storage.syncPeriodSecs != 0``
- 层: mongodb-config
- 原文:
  > storage.syncPeriodSecs has no effect on Journaling , but if storage.syncPeriodSecs is set to 0 the journal eventually consumes all available disk space.

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
mongod 对数据文件的写入是"懒写"（lazy flush），真正的持久化由 journal 保障。syncPeriodSecs 设为 0 会关闭定期 sync，导致 journal 无限增长直到耗尽磁盘空间；mongod 对 journal 的写入速度远超 sync 频率，故不能禁用 sync。

### 违反时的风险 (critical)
将 `syncPeriodSecs` 设为 0 会导致 journal 持续增长，最终耗尽所有磁盘空间，使 mongod 无法写入任何数据并崩溃。

---

## 高并发场景启用 serviceExecutor adaptive 实现网络 IO 复用

**case_id**: `mongo-service-executor-adaptive-high-concurrency-01`
**来源**: [https://cloud.tencent.com/developer/news/710321](https://cloud.tencent.com/developer/news/710321) (community-canonical)
**平台**: bare
**scope**: storage-engine-wt
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 由于集群tps高，同时整点有大量推送，因此整点并发会更高，mongodb默认的一个请求一个线程这种模式将会严重影响系统负载，该默认配置不适合高并发的读写应用场景。

### 场景 (中文转述)
在峰值 TPS 超过百万级、整点有大量推送引起并发瞬间飙升的 MongoDB 集群中，默认"一连接一线程"模型会瞬间创建大量线程，导致系统负载飙高，不适合高并发读写场景。

### 推荐
- 值: ``serviceExecutor: adaptive``
- 层: mongodb-config
- 原文:
  > mongodb-3.6开始引入serviceExecutor: adaptive配置，该配置根据请求数动态调整网络线程数，并尽量做到网络IO复用来降低线程创建消耗引起的系统高负载问题。

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> 加上serviceExecutor: adaptive配置后，借助boost:asio网络模块实现网络IO复用，同时实现网络IO和磁盘IO分离。这样高并发情况下，通过网络链接IO复用和mongodb的锁操作来控制磁盘IO访问线程数，最终降低了大量线程创建和消耗带来的高系统负载
`serviceExecutor: adaptive` 借助 boost::asio 实现网络 IO 复用，并将网络 IO 与磁盘 IO 解耦。高并发时通过 IO 复用控制磁盘 IO 线程数，避免线程爆炸式创建/销毁引起的系统负载飙升，从而降低平均时延和慢日志数量。

### 违反时的风险 (warning)
> 这样进一步加剧了系统负载，同时进一步增加了数据库的抖动，特别是在PHP这种短链接业务中更加明显，频繁的创建线程销毁线程造成系统高负债。
不启用 `serviceExecutor: adaptive` 时，高并发下 MongoDB 默认"一连接一线程"会瞬间创建上万线程，系统 load 飙高；流量低峰期频繁销毁线程进一步造成系统高负载和数据库抖动，在 PHP 等短连接业务中尤为明显，最终导致慢日志数量暴增、平均时延数倍升高。

---

## 不使用历史快照读时将 minSnapshotHistoryWindowInSeconds 调小到 0 释放 WT 缓存压力

**case_id**: `mongo-snapshot-history-window-no-atclustertime-08`
**来源**: [https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations](https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations) (official)
**平台**: bare
**scope**: storage-engine-wt
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 如果业务侧确定不会使用读历史快照（read atClusterTime）的功能，可以将此参数调小到0，以获得一定的性能提升

### 场景 (中文转述)
业务明确不使用 `read atClusterTime`（历史快照读）功能时，WT 引擎保留快照历史窗口（默认 300 秒）会带来不必要的缓存压力，尤其在相同文档频繁更新的场景下。

### 推荐
- 值: ``setParameter.minSnapshotHistoryWindowInSeconds = 0``
- 层: mongodb-setparam
- 原文:
  > 如果业务侧确定不会使用读历史快照（read atClusterTime）的功能，可以将此参数调小到0，以获得一定的性能提升

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> 此参数会带来一定的WT缓存（WT cache）压力，尤其是相同文档频繁更新的场景
快照历史窗口越大，WiredTiger 需要在缓存中保留越多的历史版本数据（MVCC），在频繁更新相同文档的场景下尤为明显。调小到 0 后引擎无需维护历史快照，可释放缓存压力并提升性能。

### 违反时的风险 (warning)
> (NULL · 原文仅有「此参数会带来一定的WT缓存压力」（无推论词）和「如果该参数值较小...则会收到SnapshotTooOld错误」（描述调小过度的正常行为，非违反调0推荐的风险），两者均不含 may cause / 导致 / 风险 / 否则 等推论词，依 §4.5 risk_quote 须含推论词规则置 NULL)
保留较大快照历史窗口（默认 300 秒）会给 WT 缓存持续带来压力；在高频更新相同文档的场景下可能导致 WT cache 满，触发激进 eviction，引发性能抖动。若业务不需要历史快照读，保留默认值属于浪费缓存资源，影响整体读写性能。

---

## transactionLifetimeLimitSeconds 调小防长事务压垮 WiredTiger 缓存

**case_id**: `mongo-transaction-lifetime-long-wt-cache-pressure-05`
**来源**: [https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations](https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations) (official)
**平台**: bare
**scope**: storage-engine-wt
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 如果事务的整体执行时间超过了此限制，会被标记为过期并被后台的周期性清理线程主动处理并abort掉

### 场景 (中文转述)
在使用多文档事务的 MongoDB 实例中，若允许事务长时间运行（默认 60 秒），未提交的长事务会持续占用 WiredTiger 存储引擎缓存，在高并发写入场景下可能导致缓存压力过大，引发数据库性能骤降。

### 推荐
- 值: ``setParameter.transactionLifetimeLimitSeconds = 30``
- 层: mongodb-setparam
- 原文:
  > 可以适当调小（比如到30），不建议调大

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> (NULL · 原文最接近机制句「未提交的长事务可能会给WiredTiger存储引擎的缓存带来很大压力...」含「使用」命中 RE_ACTION_VERB_BP 而无机制连接词，依 §4.4 NULL 优先原则置 NULL)
WiredTiger 存储引擎依赖缓存（cache）来管理未提交事务的数据快照。长事务会持续占用缓存中的版本历史，阻碍脏页回收，一旦缓存压力超过阈值，引擎会触发激进 eviction，导致数据库卡顿和请求延迟大幅上升，CPU 使用率打满。

### 违反时的风险 (critical)
> 未提交的长事务可能会给WiredTiger存储引擎的缓存带来很大压力，一旦缓存压力超载通常会带来更多问题，包括数据库卡顿、请求延迟大幅增加、CPU使用率满等，导致业务受损
transactionLifetimeLimitSeconds 过大（或使用默认值 60）允许长事务长时间持有缓存，造成 WT 缓存压力超载，导致数据库卡顿、请求延迟大幅增加、CPU 使用率打满，严重影响业务。

---

## 冷数据存储场景将 blockCompressor 改为 zstd 提升压缩比

**case_id**: `mongo-wt-block-compressor-cold-data-zstd-06`
**来源**: [https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations](https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations) (official)
**平台**: bare
**scope**: storage-engine-wt
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 如果实例主要用来存储冷数据，那么为了获得更高的压缩比，可以考虑将此参数修改为zstd

### 场景 (中文转述)
实例主要存储访问频率低的冷数据时，压缩比优先于 CPU 开销，选用压缩率更高的 zstd 算法可以显著降低存储空间占用。

### 推荐
- 值: ``storage.wiredTiger.collectionConfig.blockCompressor = zstd``
- 层: mongodb-config
- 原文:
  > 可以考虑将此参数修改为zstd

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> 不同的压缩算法有着不同的表现，有的压缩率更高但压缩和解压时的CPU开销更大
zstd 压缩算法相比默认的 snappy 拥有更高的压缩比，但压缩和解压时 CPU 开销更大。冷数据访问频率低，读取时解压的 CPU 开销不敏感，而更高压缩比带来的存储空间节省价值更大。

### 违反时的风险 (info)
> (NULL · 原文描述「不同的压缩算法有着不同的表现，有的压缩率更高但压缩和解压时的CPU开销更大。实际压缩算法之间的对比，应以您实际测试的结果为准」为中性对比说明，不含 may cause / 导致 / 风险 / 否则 等推论词，依 §4.5 risk_quote 须含推论词规则置 NULL)
在冷数据场景仍使用默认的 snappy 算法，压缩比不及 zstd，造成存储空间浪费，存储成本偏高；若在热数据场景误用 zstd，则解压 CPU 开销上升，可能影响读写性能。

---

## 高写入负载下缩短 checkpoint wait 周期至 25s 均摊 IO

**case_id**: `mongo-wt-checkpoint-wait-25s-io-smoothing-01`
**来源**: [https://cloud.tencent.com/developer/news/710321](https://cloud.tencent.com/developer/news/710321) (community-canonical)
**平台**: bare
**scope**: storage-engine-wt
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 如果在两次checkpoint的时间间隔类evict淘汰线程淘汰的dirty page越少，那么积压的脏数据就会越多，也就是checkpoint的时候脏数据就会越多，造成checkpoint的时候大量的IO写盘操作。

### 场景 (中文转述)
在高写入速率场景中，WiredTiger 默认 60 秒 checkpoint 周期导致两次 checkpoint 之间积压大量脏数据，每次 checkpoint 触发时需要一次性写入大量数据，造成 IO 瞬间打满、util 持续 100%，业务时延随之飙升。

### 推荐
- 值: ``checkpoint=(wait=25,log_size=1GB)``
- 层: mongodb-config
- 原文:
  > checkpoint调整后的值如下: checkpoint=(wait=25,log_size=1GB)

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> 如果我们把checkpoint的周期缩短，那么两个checkpoint期间的脏数据相应的也就会减少，磁盘IO 100%持续的时间也就会缩短。
缩短 checkpoint 间隔(60s → 25s)使每次 checkpoint 时积压的脏数据量减少，单次 IO 写入量降低，磁盘 IO util 持续 100% 的时间缩短，IO 负载从"周期性脉冲"趋于平滑均摊，与 eviction 调优配合可进一步降低时延抖动。

### 违反时的风险 (warning)
> 造成checkpoint的时候大量的IO写盘操作。
保持默认 60 秒 checkpoint 周期时，高写入场景下每次 checkpoint 都会触发大量脏数据集中写盘，造成 IO util 瞬间 100%，业务 TPS 和时延出现周期性脉冲式抖动。

---

## 高写入负载下调低 eviction_dirty_target/trigger 让后台线程尽早淘汰脏页

**case_id**: `mongo-wt-eviction-dirty-target-3pct-high-write-01`
**来源**: [https://cloud.tencent.com/developer/news/710321](https://cloud.tencent.com/developer/news/710321) (community-canonical)
**平台**: bare
**scope**: storage-engine-wt
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 调整cacheSize从120G到50G后，如果脏数据比例达到5%，则极端情况下如果淘汰速度跟不上客户端写入速度，这样还是容易引起I/O瓶颈，最终造成阻塞。

### 场景 (中文转述)
在调小 cacheSize 后，若仍保持默认 5% 脏数据开始淘汰的阈值，极端高写入场景下后台 eviction 线程的淘汰速度仍可能跟不上客户端写入速度，导致用户线程被迫参与 page 淘汰，造成请求阻塞。

### 推荐
- 值: ``eviction_dirty_target=3%,eviction_dirty_trigger=25%``
- 层: mongodb-config
- 原文:
  > 优化调整存储引起配置如下: eviction_target: 75% eviction_trigger：97% eviction_dirty_target: %3 eviction_dirty_trigger：25% evict.threads_min：8 evict.threads_min：12

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> 总体思想是让后台evict尽量早点淘汰脏页page到磁盘，同时调整evict淘汰线程数来加快脏数据淘汰，调整后mongostat及客户端超时现象进一步缓解。
将 `eviction_dirty_target` 从默认 5% 调低至 3%，让后台 eviction 线程在脏数据比例更低时就开始主动淘汰，避免脏数据积压到触发用户线程参与淘汰(那是危险的阻塞路径)。同时提高 `eviction_dirty_trigger` 到 25%，扩大后台淘汰与用户线程介入之间的缓冲区间；增加 eviction 线程数加快实际淘汰吞吐。

### 违反时的风险 (critical)
> 如果脏数据及内存占用比例进一步增加，那么用户线程就会开始做page淘汰，这是个非常危险的阻塞过程，造成用户请求验证阻塞
不调整 eviction 脏数据阈值时，脏数据比例超过 trigger 后用户线程被迫介入 page 淘汰，直接阻塞正常请求，导致客户端出现 1 秒级甚至更长时间的超时抖动。

---

## WiredTiger blockCompressor: set to none for maximum write speed (no compression overhead)

**case_id**: `wt-block-compressor-none-max-write-speed-01`
**来源**: [https://dev.to/devaaai/complete-configuration-guide-for-maximum-read-and-write-performance-2bm6](https://dev.to/devaaai/complete-configuration-guide-for-maximum-read-and-write-performance-2bm6) (community-canonical)
**平台**: bare
**scope**: storage-engine-wt
**case_pattern**: parameter-best-practice

### 场景 (中文转述)
在对写入速度要求极高、磁盘空间充裕且不需要压缩节省存储的场景（如高速写入流水线、时序日志），禁用块压缩可消除 CPU 压缩开销。

### 推荐
- 值: ``storage.wiredTiger.collectionConfig.blockCompressor = none``
- 层: mongodb-config

### 机制 / 原因
blockCompressor=none 完全跳过压缩/解压 CPU 运算，写入路径中不产生任何压缩 overhead，从而获得最高写入吞吐量；代价是数据不压缩存储，磁盘空间占用更大。

### 违反时的风险 (info)
若在极速写场景中仍保留压缩（如 zstd），压缩 CPU 开销可能抵消硬件 I/O 能力，导致写吞吐量无法达到理论上限；存储成本也将显著增加（相比不压缩，snappy/zstd 可节省 30-70% 磁盘）。

---

## 容器(lxc / cgroups / Docker)部署 mongod 时必须显式设 wiredTigerCacheSizeGB 或 wiredTigerCacheSizePct

**case_id**: `wt-cache-size-container-cgroup-explicit-01`
**来源**: [https://www.mongodb.com/docs/manual/core/wiredtiger/](https://www.mongodb.com/docs/manual/core/wiredtiger/) (official)
**平台**: bare
**scope**: storage-engine-wt
**case_pattern**: parameter-best-practice

### 场景 (原文)
> If you run mongod in a container (for example, lxc, cgroups, Docker, etc.) that does not have access to all of the RAM available in a system

### 场景 (中文转述)
mongod 跑在容器里(lxc / cgroups / Docker / Kubernetes Pod / 类似 cgroup 限制环境),容器分配的 RAM 小于宿主机总 RAM 时。典型场景:Kubernetes 中给 mongod Pod 设 memory limit、Docker `--memory` 启动、ECS / Cloud Run 等托管容器、cgroups v1/v2 内存子系统下的 mongod 实例。

### 推荐
- 值: ``--wiredTigerCacheSizeGB or --wiredTigerCacheSizePct < amount of RAM available in the container``
- 层: mongodb-cli-flag
- 原文:
  > you must set --wiredTigerCacheSizeGB or --wiredTigerCacheSizePct to a value less than the amount of RAM available in the container

### 机制 / 原因
> as WiredTiger may not account for the memory limits of the specific container in certain cases
WiredTiger 在某些情况下无法自动感知容器(cgroup)内存上限——它默认按"宿主机 RAM"计算 cacheSizeGB(50% × (RAM - 1GB)),但容器实际可用 RAM 远小于宿主机。如果不显式设 cacheSizeGB / cacheSizePct,WT 内部缓存可能配置成超过容器内存上限的值,导致 mongod 进程被 cgroup OOM-killer 终止或启动后内存压力剧增。

### 违反时的风险 (warning)
> WiredTiger may not account for the memory limits of the specific container in certain cases
容器化部署如果不显式设置 wiredTigerCacheSizeGB / wiredTigerCacheSizePct,WT 在某些情况下不会自动感知容器内存上限,可能按宿主机 RAM 推算 cacheSize → 实际使用超过容器 limit → 触发 cgroup OOM-killer 杀掉 mongod 进程 / 启动失败 / 频繁 swap 导致严重性能下降。在 Kubernetes 等编排平台,Pod 反复 OOMKilled 还会触发重调度、副本集成员被踢出投票等次生故障。

---

## WiredTiger 内部缓存默认值 = max(50% × (RAM - 1GB), 0.256GB) · 不应擅自调高

**case_id**: `wt-cache-size-default-half-ram-minus-1g-01`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (official)
**平台**: bare
**scope**: storage-engine-wt
**case_pattern**: parameter-best-practice

### 场景 (原文)
> With WiredTiger, MongoDB utilizes both the WiredTiger internal cache and the filesystem cache.

### 场景 (中文转述)
WiredTiger 引擎下,MongoDB 同时使用 WT 内部缓存和操作系统文件系统缓存两层缓存。该建议适用于所有运行 WiredTiger 的 mongod 部署(单机或副本集 / 分片成员均适用)。

### 推荐
- 值: ``wiredTigerCacheSizeGB = max(0.5 × (RAM - 1GB), 0.256GB)``
- 层: mongodb-config
- 原文:
  > The default WiredTiger internal cache size is the larger of either:

### 检测方法
> "storage.wiredTiger.engineConfig.cacheSizeGB"
违规模式: "Avoid increasing the WiredTiger internal cache size above its default value"

### 机制 / 原因
> The storage.wiredTiger.engineConfig.cacheSizeGB limits the size of the WiredTiger internal cache. The operating system uses the available free memory for filesystem cache, which allows the compressed MongoDB data files to stay in memory.
`cacheSizeGB` 直接限制 WT 内部缓存大小;OS 用剩下的空闲内存做文件系统缓存,让压缩态的 MongoDB 数据文件留在内存中。如果把 WT 内部缓存调得过大,会挤占 OS filesystem cache 的可用 RAM,反而拖低数据访问速度——这是默认值已经是经过权衡的最佳起点的根因。

### 违反时的风险 (warning)
> To accommodate the additional consumers of RAM, you may have to decrease WiredTiger internal cache size.
如果把 WT cacheSizeGB 调高超过默认值,filesystem cache 可用 RAM 减少,压缩数据文件被换出内存,反而需要从磁盘频繁读取,性能可能下降;在容器 / 多 mongod 单机 / 同机其他进程占内存的部署场景,可能必须把 cacheSizeGB 调低以避免 OOM 与 swap。

---

## 单机多 mongod 实例时须按实例数缩减每个实例的 WiredTiger 缓存配置

**case_id**: `wt-cache-size-multi-instance-decrease-01`
**来源**: [https://www.mongodb.com/docs/manual/reference/configuration-options/](https://www.mongodb.com/docs/manual/reference/configuration-options/) (official)
**平台**: bare
**scope**: storage-engine-wt
**case_pattern**: parameter-best-practice

### 场景 (原文)
> The default WiredTiger internal cache size value assumes that there is a single mongod instance per machine. If a single machine contains multiple MongoDB instances, decrease the setting to accommodate the other mongod instances.

### 场景 (中文转述)
在同一物理机或虚拟机上运行多个 mongod 实例时（如分片集群的多个 shard 进程同机部署），默认 WiredTiger 缓存假设独占全部内存，各实例若均使用默认值会导致内存总消耗超限。

### 推荐
- 值: ``storage.wiredTiger.engineConfig.cacheSizeGB decrease to accommodate``
- 层: mongodb-config
- 原文:
  > If a single machine contains multiple MongoDB instances, decrease the setting to accommodate the other mongod instances.

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> The default WiredTiger internal cache size value assumes that there is a single mongod instance per machine.
WiredTiger 默认缓存（50% of RAM-1GB）基于单实例独占机器内存的假设计算，多实例场景下若各实例均使用默认值，各实例缓存总和将超出可用物理内存，导致相互竞争并可能触发 OOM。

### 违反时的风险 (critical)
> To accommodate the additional consumers of RAM, you may have to decrease WiredTiger internal cache size.
多实例各自占用默认缓存，总内存消耗超出物理 RAM，导致系统 OOM 杀进程或各实例性能严重退化（大量换页）。

---

## WiredTiger 集合默认采用 Snappy 块压缩 · 索引默认前缀压缩

**case_id**: `wt-compression-snappy-default-block-collections-03`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (official)
**平台**: bare
**scope**: storage-engine-wt
**case_pattern**: parameter-best-practice

### 场景 (原文)
> WiredTiger can compress collection data using one of the following compression library:

### 场景 (中文转述)
部署 WiredTiger 引擎且对存储成本与 CPU 代价权衡敏感的场景(eg. 普通 OLTP / 写密集 / 数据量大占盘)。MongoDB 提供三种块压缩算法可选,默认压缩比 vs CPU 代价的折衷点是 Snappy。

### 推荐
- 值: ``storage.wiredTiger.collectionConfig.blockCompressor = snappy``
- 层: mongodb-config
- 原文:
  > By default, WiredTiger uses snappy compression library.

### 检测方法
> "storage.wiredTiger.collectionConfig.blockCompressor"
违规模式: "To change the compression setting, see storage.wiredTiger.collectionConfig.blockCompressor"

### 机制 / 原因
> Provides a lower compression rate than zlib or zstd but has a lower CPU cost than either.
Snappy 之所以是默认,是因为它在三种算法中给出 CPU 代价最低的压缩——压缩率虽然不及 zlib/zstd,但对绝大多数 OLTP 工作负载来说不会成为 CPU 瓶颈。zlib 比 snappy / zstd 都贵在 CPU,zstd 介于两者之间但提供最高压缩率。默认选择是"成本敏感场景的合理起点"。

### 违反时的风险 (info)
> Block compression can provide significant on-disk storage savings, but data must be uncompressed to be manipulated by the server.
如果换更激进压缩(zlib)而 CPU 不富裕,server 解压代价会拖慢请求;反之若禁用压缩,会牺牲磁盘节省,且与 MongoDB 对压缩态数据驻留 filesystem cache 的设计初衷相悖。

---

## WiredTiger 并发读写 tickets 持续低于 10 时应用 setParameter 增加上限

**case_id**: `wt-concurrent-tickets-low-increase-01`
**来源**: [https://oneuptime.com/blog/post/2026-03-31-mongodb-wiredtiger-storage-engine/view](https://oneuptime.com/blog/post/2026-03-31-mongodb-wiredtiger-storage-engine/view) (community-canonical)
**平台**: bare
**scope**: storage-engine-wt
**case_pattern**: parameter-best-practice

### 场景 (原文)
> WiredTiger uses a ticket system to limit concurrent operations. By default, 128 read tickets and 128 write tickets are available.

### 场景 (中文转述)
MongoDB WiredTiger 用 ticket 系统控制并发读写操作数量。默认每类（读/写）各 128 个 ticket；当可用 ticket 数持续（regularly）降至 10 以下时，说明当前并发上限已成为吞吐量瓶颈，需要运行时调高上限。

### 推荐
- 值: ``wiredTigerConcurrentReadTransactions = 256``
- 层: mongodb-setparam
- 原文:
  > db.adminCommand({ setParameter: 1, wiredTigerConcurrentReadTransactions: 256 })

### 检测方法
> `db.serverStatus().wiredTiger.concurrentTransactions`
违规模式: `If available regularly drops below 10, increase the ticket count`

### 机制 / 原因
> WiredTiger uses a ticket system to limit concurrent operations. By default, 128 read tickets and 128 write tickets are available.
WiredTiger 用 ticket 系统限制并发操作数——每个正在执行的读或写各消耗一个 ticket，用完时新请求排队等待。默认 128 上限在低并发场景足够，但高并发工作负载下 ticket 耗尽会导致请求堆积、延迟上升，吞吐量无法继续扩展。通过 setParameter 动态增加上限（无需重启）可解除这一约束。

### 违反时的风险 (warning)
> Monitor wiredTiger.concurrentTransactions and increase tickets if throughput is limited.
若 ticket 可用数持续低于 10 而不调整上限，新并发请求将持续排队等待 ticket 释放，导致操作延迟上升、吞吐量受限（throughput is limited）。高并发写入场景下，写 ticket 耗尽会造成写入堆积，进而触发客户端超时和应用层错误。

---

## 使用 Encrypted Storage Engine 时 · 选支持 AES-NI 指令集的 CPU

**case_id**: `wt-encrypted-storage-aes-ni-cpu-required-04`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (official)
**平台**: bare
**scope**: storage-engine-wt
**case_pattern**: parameter-best-practice

### 场景 (原文)
> When using encryption, CPUs equipped with AES-NI instruction-set extensions show significant performance advantages.

### 场景 (中文转述)
部署 MongoDB Enterprise 并启用 Encrypted Storage Engine(透明数据加密)的场景,CPU 是否支持 AES-NI 直接影响加解密吞吐。典型部署:合规要求(HIPAA / GDPR / 金融行业)下的 mongod 实例。

### 推荐
- 值: ``CPU 支持 AES-NI 指令集扩展``
- 层: bios-firmware
- 原文:
  > If you are using MongoDB Enterprise with the Encrypted Storage Engine, choose a CPU that supports AES-NI for better performance.

### 检测方法

### 机制 / 原因
> CPUs equipped with AES-NI instruction-set extensions show significant performance advantages.
AES-NI 是 Intel/AMD 提供的 AES 加解密硬件加速指令(自 Westmere / Bulldozer 起广泛可用)。带 AES-NI 的 CPU 做 AES-CBC/GCM 加解密的吞吐通常是软件实现的 3-10 倍。Encrypted Storage Engine 每次读写数据页都会触发加解密,CPU 不支持 AES-NI 会让加密成为热点。

### 违反时的风险 (warning)
不支持 AES-NI 的 CPU 跑 Encrypted Storage Engine 时,加解密走纯软件实现,会显著降低吞吐(通常下降数倍),在写密集 / 高 IOPS 工作负载下尤其明显。

---

## WiredTiger commitIntervalMs: increase to 200-300ms for higher write throughput

**case_id**: `wt-journal-commit-interval-high-throughput-01`
**来源**: [https://dev.to/devaaai/complete-configuration-guide-for-maximum-read-and-write-performance-2bm6](https://dev.to/devaaai/complete-configuration-guide-for-maximum-read-and-write-performance-2bm6) (community-canonical)
**平台**: bare
**scope**: storage-engine-wt
**case_pattern**: parameter-best-practice

### 场景 (中文转述)
在写入吞吐量要求较高的生产环境中，journaling 默认每 100ms 提交一次。适度提高 commitIntervalMs 可以批量化 journal 写入，提升写吞吐量。

### 推荐
- 值: ``storage.journal.commitIntervalMs = 200``
- 层: mongodb-config

### 机制 / 原因
commitIntervalMs 控制 journal 写入磁盘的批量间隔。适度增大间隔（100ms→200-300ms）能减少 fsync 次数，提升写入吞吐；代价是在最坏情况下，崩溃时丢失该间隔内尚未持久化到 journal 的数据（约 200-300ms 窗口）。

### 违反时的风险 (warning)
若不调高 commitIntervalMs（保持默认 100ms），高写入负载下 journal 频繁 fsync 成为 I/O 瓶颈，写吞吐量受限；若调得过大（如 500ms+），崩溃时数据丢失窗口随之扩大。

---

## WiredTiger journal.enabled: disable for temporary/non-critical data to maximize write speed

**case_id**: `wt-journal-disable-non-critical-max-write-01`
**来源**: [https://dev.to/devaaai/complete-configuration-guide-for-maximum-read-and-write-performance-2bm6](https://dev.to/devaaai/complete-configuration-guide-for-maximum-read-and-write-performance-2bm6) (community-canonical)
**平台**: bare
**scope**: storage-engine-wt
**case_pattern**: parameter-best-practice

### 场景 (中文转述)
对于临时数据、可重新生成的数据或不要求持久化保障的非关键数据存储场景，可以禁用 journaling 以消除 WAL I/O 开销，达到最大写入速度。

### 推荐
- 值: ``storage.journal.enabled = false``
- 层: mongodb-config

### 机制 / 原因
Journaling 通过 write-ahead logging 实现崩溃恢复保障，但每次写入都需额外的 fsync。对于不需要崩溃恢复的临时数据，禁用 journaling 可以去掉这部分 I/O 开销，显著提升写入吞吐。

### 违反时的风险 (critical)
在生产关键数据场景中禁用 journaling：mongod 崩溃时 WiredTiger 无法回滚未完成的写事务，可能导致数据文件损坏或数据丢失，无法通过 journal 重放恢复。

---
