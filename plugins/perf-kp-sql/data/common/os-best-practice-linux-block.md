# os-best-practice-linux-block

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 9 条 case。

---

## 副本集成员不要全放同一 SAN · 避免单点故障

**case_id**: `linux-block-avoid-replica-set-members-same-san-checklist-05`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-checklist-operations/](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/) (official)
**平台**: bare
**scope**: linux-block
**case_pattern**: parameter-best-practice

### 场景 (原文)
> Avoid placing all replica set members on the same SAN, as the SAN can be a single point of failure.

### 场景 (中文转述)
副本集(replica set)成员的存储拓扑选型场景。生产部署常会用集中式 SAN(Storage Area Network)挂载块设备给多个 mongod 节点,SAN 提供共享存储 / 快照 / 集中备份等便利。但本条建议明确反对"全部副本集成员都挂同一个 SAN"。

### 推荐
- 值: ``replica set members spread across ≥2 SANs (or mix SAN + local disk)``
- 层: other
- 原文:
  > Avoid placing all replica set members on the same SAN, as the SAN can be a single point of failure.

### 机制 / 原因
副本集的可用性模型假设节点之间是**独立故障域**。当所有成员的数据盘都挂在同一 SAN 上时,SAN controller 故障 / SAN 网络分区 / SAN 固件升级窗口都会同时影响 ≥majority 个节点,副本集失去多数派 → 自动 failover 失败 / 写入阻塞 / 整集群不可用——共享 SAN 把"独立节点失败"事件耦合成了"集群级失败"事件。把成员分散在 ≥2 个 SAN(或 SAN + 本地盘混合)上才能保留独立故障域。

### 违反时的风险 (critical)
> Avoid placing all replica set members on the same SAN, as the SAN can be a single point of failure.
副本集成员全在同一 SAN · SAN 故障时整集群不可用 · 失去高可用性意义 · 严重程度为 critical(对应原文 "single point of failure")。

---

## MongoDB Journal 和系统日志应使用独立物理卷，避免日志 IO 竞争数据盘带宽

**case_id**: `linux-block-journal-separate-volume-mongodb-01`
**来源**: [https://mongoing.com/archives/3895](https://mongoing.com/archives/3895) (community-canonical)
**平台**: bare
**scope**: linux-block
**case_pattern**: parameter-best-practice

### 场景 (原文)
> MongoDB很多的性能瓶颈和IO相关。建议为日志盘（Journal和系统日志）单独设定一个物理卷，减少对数据盘IO的资源占用。

### 场景 (中文转述)
MongoDB 的性能瓶颈大多与 IO 相关。Journal 日志和系统日志产生持续的顺序写 IO，若与数据盘共用同一物理设备，日志写入会与数据读写竞争 IO 带宽，加剧性能瓶颈。

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> MongoDB很多的性能瓶颈和IO相关。建议为日志盘（Journal和系统日志）单独设定一个物理卷，减少对数据盘IO的资源占用。
Journal 日志产生高频顺序写 IO，与数据盘的随机读写 IO 模式不同。若共用同一物理磁盘，IO 调度器需同时处理两种截然不同的 IO 模式，队列竞争严重，磁头寻道次数增加，数据读写延迟升高。独立物理卷使日志 IO 与数据 IO 互不干扰。

### 违反时的风险 (warning)
Journal 与数据共用物理卷时，日志的持续顺序写与数据的随机读写互相竞争 IO 带宽，导致数据 IO 延迟升高，在写入高峰期尤为明显，可能引发写操作堆积和整体吞吐下降。

---

## WiredTiger 高脏页率 + 高 modified evictions 场景应换用 NVMe 替代机械盘

**case_id**: `linux-block-nvme-wt-dirty-eviction-01`
**来源**: [https://oneuptime.com/blog/post/2026-03-31-mongodb-wiredtiger-storage-engine/view](https://oneuptime.com/blog/post/2026-03-31-mongodb-wiredtiger-storage-engine/view) (community-canonical)
**平台**: bare
**scope**: linux-block
**case_pattern**: parameter-best-practice

### 场景 (原文)
> High dirty % combined with high modified page evictions indicates that WiredTiger is struggling to flush dirty pages fast enough.

### 场景 (中文转述)
WiredTiger 缓存中脏页比例持续偏高（dirty % > 20%），同时 modified page evictions 数量也高（表示内存压力）。这说明 WiredTiger 的 checkpoint/eviction 写盘速度跟不上脏页产生速度，存储 I/O 是瓶颈。此场景下，升级到 NVMe 固态盘可显著降低写盘延迟，缓解 eviction 压力。

### 推荐
- 值: ``NVMe instead of spinning disk``
- 层: other
- 原文:
  > Use faster storage (NVMe instead of spinning disk).

### 检测方法
> `db.serverStatus().wiredTiger.concurrentTransactions`
违规模式: NULL

### 机制 / 原因
WiredTiger checkpoint 每 60 秒将所有脏页写盘，eviction 在缓存接近上限时也持续写脏页。机械硬盘（HDD）顺序写尚可，但随机写 IOPS 远低于 NVMe SSD。当脏页产生速度超过 HDD 写盘能力时，eviction 线程阻塞，写入操作堆积，导致整体写性能下降。NVMe SSD 的高 IOPS 和低延迟能显著提升 checkpoint/eviction 吞吐，消除存储 I/O 瓶颈。

### 违反时的风险 (warning)
继续使用机械盘（HDD）作为 WiredTiger 数据目录存储，在高脏页率场景下 checkpoint 和 eviction 写盘速度跟不上脏页产生速度，导致 WiredTiger eviction 线程长时间阻塞、写性能持续下降、应用延迟升高，最终可能触发写入积压和客户端超时。

---

## 存储层用 RAID-10 · 不要用 RAID-5 / RAID-6

**case_id**: `linux-block-raid-10-not-5-or-6-02`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (official)
**平台**: bare
**scope**: linux-block
**case_pattern**: parameter-best-practice

### 场景 (原文)
> For optimal performance in terms of the storage layer, use disks backed by RAID-10.

### 场景 (中文转述)
为 mongod 数据盘配 RAID 阵列以获取冗余 + IOPS 的部署场景。这是 production-notes 里"建议而非诊断"类信号——给目标 + 给反对方案,但不展开机制。

### 推荐
- 值: ``RAID-10`(并明确反对 RAID-5 / RAID-6)`
- 层: other
- 原文:
  > For optimal performance in terms of the storage layer, use disks backed by RAID-10.

### 机制 / 原因
RAID-5 / RAID-6 写入需要计算并落盘奇偶校验位,小写场景下产生写惩罚(write penalty 4-6x)和长 RMW(read-modify-write)路径,配合 MongoDB 高频小文档写入会成 IOPS 瓶颈;RAID-10 是镜像 + 条带,写惩罚只有 2x,顺序 / 随机 IOPS 都更接近物理盘上限,因此被推荐为"足够的性能基线"。

### 违反时的风险 (warning)
> RAID-5 and RAID-6 do not typically provide sufficient performance to support a MongoDB deployment.
用 RAID-5/6 撑 MongoDB 写工作负载,写吞吐通常达不到 production 要求,会出现长尾写延迟 / 阵列重建期间业务不可用。

---

## 磁盘顺序读场景下将 read_ahead_kb 从默认 128KB 调大至 4096KB 以充分利用预取性能提升

**case_id**: `linux-block-read-ahead-kb-sequential-io-4096-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0039.html](https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0039.html) (official)
**平台**: bare
**scope**: linux-block
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 如果预读的数据是后续会使用的数据，那么系统性能会提升，如果后续不使用，就浪费了磁盘带宽。在磁盘顺序读的场景下，调大预取值效果会尤其明显。

### 场景 (中文转述)
在磁盘顺序读为主的业务场景（如大文件扫描、数据库全表扫描、批量 ETL 等）中，Linux 块设备文件预读参数 `read_ahead_kb` 默认仅 128KB，预取量不足以充分掩盖磁盘延迟；在顺序读负载下，调大该值可显著提升 I/O 吞吐和系统性能。

### 推荐
- 值: ``read_ahead_kb = 4096``
- 层: other
- 原文:
  > 此参数的默认值128KB，可使用echo来调整，仍以CentOS为例，将预取值调整为4096KB：1# echo 4096 > /sys/block/$DEVICE-NAME/queue/read_ahead_kb

### 检测方法
> "# find / -name read_ahead_kb"
违规模式: "此参数的默认值128KB"

### 机制 / 原因
> 文件预取的原理，就是根据局部性原理，在读取数据时，会多读一定量的相邻数据缓存到内存。如果预读的数据是后续会使用的数据，那么系统性能会提升
文件预读基于局部性原理：顺序访问时，下一批数据大概率紧邻当前数据，内核提前将更多相邻块读入 page cache，应用层在真正访问时无需等待磁盘寻道，从而降低实际 I/O 延迟并提升吞吐。默认 128KB 在大块顺序访问时预取粒度太小，增大到 4096KB 可让预取效果覆盖更多连续数据，使性能提升更明显。

### 违反时的风险 (warning)
在磁盘顺序读业务下 read_ahead_kb 保持默认 128KB，每次 I/O 预取量不足，顺序访问邻近数据块时需额外多次磁盘 I/O，磁盘带宽利用率低，整体 I/O 吞吐显著低于可达上限；反之若在随机 I/O 业务下盲目调高至 4096KB，预读无效数据会浪费磁盘带宽并占用内存 page cache，可能反而降低随机 I/O 性能。

---

## WiredTiger 引擎 · readahead 设 8~32 (sectors) · 不要更高

**case_id**: `linux-block-readahead-8-to-32-wt-12`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (official)
**平台**: bare
**scope**: linux-block
**case_pattern**: parameter-best-practice

### 场景 (原文)
> Set the readahead setting between 8 and 32 regardless of storage media type (spinning disk, SSD, etc.).

### 场景 (中文转述)
WiredTiger 引擎下 mongod 的存储调优场景。无论底层是转盘还是 SSD,readahead 都建议落在 8~32 (单位 sectors / 512 字节) 这个窄窗内。

### 推荐
- 值: ``blockdev --getra <dev> 结果 ∈ [8, 32]``
- 层: os-sysctl
- 原文:
  > Set the readahead setting between 8 and 32 regardless of storage media type (spinning disk, SSD, etc.).

### 检测方法

### 机制 / 原因
> Higher readahead commonly benefits sequential I/O operations. Since MongoDB disk access patterns are generally random, using higher readahead settings provides limited benefit or potential performance degradation.
readahead 是内核「猜你下一个会读相邻块」的预读机制,顺序大文件友好。MongoDB 访问模式以随机为主,大 readahead 等于「白读 / 浪费 IO 带宽 + 污染 page cache」,反而拖慢。8~32 是给随机偏顺序的折衷区间。

### 违反时的风险 (info)
> using higher readahead settings provides limited benefit or potential performance degradation.
readahead 设得过大(典型默认 256 sectors)在 MongoDB 这种随机读场景下浪费 IO 带宽 + 拉低 cache 命中率。

---

## I/O 吞吐瓶颈时 · 优先用 SSD(SATA SSD 性价比好)而非堆贵转盘

**case_id**: `linux-block-use-ssd-for-random-io-04`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (official)
**平台**: bare
**scope**: linux-block
**case_pattern**: parameter-best-practice

### 场景 (原文)
> MongoDB has good results and a good price-performance ratio with SATA SSD (Solid State Disk).

### 场景 (中文转述)
为 mongod 数据盘选型的部署决策场景。MongoDB 工作负载以随机 I/O 为主,SATA SSD 在性价比上很适合;贵转盘对随机 I/O 提升有限(2x 量级)。

### 推荐
- 值: ``Use SSD if available and economical``
- 层: other
- 原文:
  > Use SSD if available and economical.

### 机制 / 原因
> the random I/O performance increase with more expensive spinning drives is not that dramatic (only on the order of 2x). Using SSDs or increasing RAM may be more effective in increasing I/O throughput.
MongoDB 访问模式以随机为主(B-tree 索引查找 + 文档零散写),贵转盘相比商品转盘最多 2x 提升,而 SSD 比转盘随机 I/O 提升通常 100x 以上。在同等预算下用 SSD 比用更贵的转盘对吞吐更有效;增加 RAM 是另一条同等有效的路线(让更多工作集留在 cache)。

### 违反时的风险 (info)
> the random I/O performance increase with more expensive spinning drives is not that dramatic
继续堆贵转盘而不上 SSD,边际收益很低;预算花在错误位置,真正的 I/O 瓶颈不解决。属于"非紧迫但是浪费成本"的次优配置。

---

## 数据库高并发写入场景下 · 块设备 nr_requests 调到 2048 提升磁盘吞吐

**case_id**: `os-blockdev-nr-requests-too-low-disk-throughput-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0018.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0018.html) (official)
**平台**: bare
**scope**: linux-block
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 对于不同的IO设备，通过在OS层面调整一些IO相关参数配置，可以有效提升服务器性能。

### 场景 (中文转述)
部署数据库(MySQL / MongoDB / PostgreSQL 等使用块设备持久化的 DB)在鲲鹏 ARM64 服务器上 · 后端块设备承担高并发并行 IO 请求(批量写入 / checkpoint 刷脏 / 全表扫描 / index build 等场景),默认 nr_requests(多数发行版为 128 / 256)对 IO 请求队列槽位限制偏紧 · 限制磁盘的并发吞吐能力上限。

### 推荐
- 值: ``/sys/block/${device}/queue/nr_requests = 2048``
- 层: os-sysctl
- 原文:
  > echo 2048 > /sys/block/${device}/queue/nr_requests

### 检测方法

### 机制 / 原因
`nr_requests` 是块设备 request_queue 的最大请求槽位数 · 上层 IO submit 时若槽位耗尽 · 提交线程在 generic_make_request → blk_queue_bio 路径上等待空闲槽位 · 形成软件层排队尾延迟。数据库高并发写场景(checkpoint flush · WAL fsync · 批量 insert)同时有大量并行 IO 请求 · 默认 128 / 256 槽位很快被打满 · 排队限制了 disk 实际能并行处理的请求数。调到 2048 给底层设备(尤其支持 high-queue-depth 的 SSD / NVMe over SCSI / RAID 控制器)更多排队空间 · 充分利用其 NCQ / 命令队列深度 · 把吞吐提到设备能力上限。

### 违反时的风险 (warning)
`nr_requests` 偏小(默认 128 / 256)时 · 高并发批量写入或并行扫描场景下软件层 IO 排队槽位被打满 · 提交线程同步等待 · 实际带宽远低于物理磁盘 NCQ / 队列深度上限;表现为「磁盘 util 已 ~100% 但 await 偏高、iostat avgqu-sz 平台化」· 数据库批量 ETL / checkpoint 刷脏耗时增长 · 业务延迟尖刺。

---

## 数据库场景下 · 块设备 IO 调度器配置为 deadline(NVMe 除外)

**case_id**: `os-blockdev-scheduler-not-deadline-mysql-db-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0018.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0018.html) (official)
**平台**: bare
**scope**: linux-block
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 对于不同的IO设备，通过在OS层面调整一些IO相关参数配置，可以有效提升服务器性能。

### 场景 (中文转述)
部署关系型数据库(典型如 MySQL · 也可推广到 MongoDB / PostgreSQL 等使用块设备持久化的 DB)在鲲鹏 ARM64 服务器上 · 后端使用非 NVMe 块设备(SAS / SATA SSD / HDD / RAID 卷)· 默认调度器(多数发行版为 cfq / bfq / mq-deadline 中的某一)未必匹配数据库小块随机 IO 模式 · 需在 OS 层面调整 `/sys/block/${device}/queue/scheduler` 与 `/sys/block/${device}/queue/nr_requests`。

### 推荐
- 值: ``/sys/block/${device}/queue/scheduler = deadline``
- 层: os-sysctl
- 原文:
  > echo deadline > /sys/block/${device}/queue/scheduler

### 检测方法

### 机制 / 原因
MySQL 等关系型数据库的 IO 模式以小块随机读写为主(单页 16 KB · 主键索引 + 数据页随机访问)· deadline 调度器为每个 IO 设置截止时间 · 优先保障 IO 等待时间上限(防饥饿)· 更贴合数据库对低尾延迟稳定的需求;noop 直通调度器把请求按 FIFO 提交给设备 · 由 SSD FTL 或 RAID 控制器层硬件队列接管合并 · 同样比 cfq / bfq 那种试图按进程公平分时排队的策略更省 CPU 与排队延迟。NVMe 多硬件队列设备已不走 single-queue legacy 调度框架(走 mq-deadline / kyber / none 多队列调度器)· 故文档明确「NVMe盘不支持此操作」,这条 best-practice 仅适用于非 NVMe 块设备。

### 违反时的风险 (warning)
非 NVMe 块设备使用 cfq / bfq 等通用调度器时,数据库随机 IO 排队等待时间不可预测,峰值延迟尖刺(P99 抖动)· 在数据库高并发短事务场景下表现为「连接池积压、慢查询比例上升、SLA 违约」· 收益面:同样硬件 deadline / noop 通常带来 5%~20% 的吞吐与延迟改善(具体幅度视设备类型与负载特征而定)。

---
