# mongo-best-practice-storage-engine-other

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 10 条 case。

---

## 对不能容忍 index build 期间性能下降的 workload 启用滚动方式构建索引

**case_id**: `mongo-atlas-rolling-index-build-non-tolerant-workloads-01`
**来源**: [https://www.mongodb.com/docs/atlas/performance-advisor/](https://www.mongodb.com/docs/atlas/performance-advisor/) (official)
**平台**: bare
**scope**: storage-engine-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> For workloads which cannot tolerate performance decrease due to index builds, consider building indexes in a rolling fashion

### 场景 (中文转述)
对于无法容忍索引构建期间出现性能下降的 workload(典型如:在线交易、低延迟读写 SLA 严格的业务面),Atlas 建议改用 rolling 方式构建索引——逐个 secondary 节点轮换下线-构建-恢复,避开全集群同时构建对前台读写的冲击。该建议适用于已开启 Atlas Performance Advisor 索引建议、计划在生产副本集 / 分片集群上落地新索引的场景。

### 推荐
- 值: `index build mode = rolling`
- 层: other
- 原文:
  > Enable building indexes in a rolling fashion

### 机制 / 原因
Rolling 索引构建按「逐节点轮换」流程在副本集 / 分片集群中铺开:Atlas 一次只把一个节点(从 secondary 开始)摘出转入构建态,其余节点继续正常对外服务,因此前台读写 QPS / 延迟受到的影响远小于「全集群同时构建」的常规模式。这是分布式系统经典的「逐节点滚动」权衡——用更长的总耗时和构建期间临时少一个可用节点的代价,换前台 SLA 不抖动。原文未直接写明该机制,但从其 workloads-which-cannot-tolerate-performance-decrease 的场景定位以及随后描述的 removes-one-node-from-the-cluster-at-a-time 流程可推出。

### 违反时的风险 (warning)
> Building an index in a rolling fashion reduces the resiliency of your cluster and increases index build times
启用 rolling 索引构建会带来两类副作用:(1) 整个构建期间集群少一个可用节点(轮到的节点处于构建态),整体可用性下降——若同时还有其他成员故障,失去多数派的概率上升;(2) 索引构建总耗时显著增加(因为不能并行,只能逐节点串行)。所以该建议**只适用**于「前台 SLA 优先、可接受较长 build window」的 workload;对反向场景(批处理后台、可短暂全集群构建的离线集群)反而应用常规并行构建。该 risk 与场景的 trade-off 是 best-practice 的核心——不是「不启用 rolling 就出错」,而是「启用了要承担可用性 / 时长代价」。

---

## 审计日志加密密钥生产环境必须使用外部 KMIP 服务 · 禁止使用 localAuditKeyFile

**case_id**: `mongo-config-audit-kmip-not-local-key-01`
**来源**: [https://www.mongodb.com/docs/manual/reference/configuration-options/](https://www.mongodb.com/docs/manual/reference/configuration-options/) (official)
**平台**: bare
**scope**: storage-engine-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> Only use auditLog.localAuditKeyFile for testing because the key is not secured.

### 场景 (中文转述)
在 MongoDB Enterprise 环境中启用审计日志加密时，`auditLog.localAuditKeyFile` 将加密密钥存储在本地文件中，此方式仅适用于测试目的，绝对不能用于生产环境。

### 推荐
- 值: ``auditLog.auditEncryptionKeyIdentifier = <kmip-key-id>``
- 层: mongodb-config
- 原文:
  > To secure the key, use auditLog.auditEncryptionKeyIdentifier and an external Key Management Interoperability Protocol (KMIP) server.

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> Only use auditLog.localAuditKeyFile for testing because the key is not secured.
`localAuditKeyFile` 将加密密钥以明文文件形式存储在 mongod 所在主机上，若主机被入侵则审计日志加密形同虚设；KMIP 服务器将密钥管理与数据存储物理分离，满足合规要求的密钥生命周期管理。

### 违反时的风险 (critical)
本地密钥文件未受到外部密钥管理保护，主机被入侵后攻击者可同时获取加密密钥和密文，导致审计日志加密失去意义，违反 PCI-DSS、SOC2 等合规要求。

---

## 审计日志落文件时使用 BSON 格式而非 JSON · 降低性能开销

**case_id**: `mongo-config-auditlog-bson-format-perf-01`
**来源**: [https://www.mongodb.com/docs/manual/reference/configuration-options/](https://www.mongodb.com/docs/manual/reference/configuration-options/) (official)
**平台**: bare
**scope**: storage-engine-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> Printing audit events to a file in JSON format degrades server performance more than printing to a file in BSON format.

### 场景 (中文转述)
在 MongoDB Enterprise 或 Atlas 上启用审计日志并将 `auditLog.destination` 设置为 `file` 时，选择 JSON 还是 BSON 格式会显著影响 mongod 写审计事件的性能开销。

### 推荐
- 值: ``auditLog.format BSON``
- 层: mongodb-config
- 原文:
  > The auditLog.format option can have one of the following values: Value Description JSON Output the audit events in JSON format to the file specified in auditLog.path . BSON Output the audit events in BSON binary format to the file specified in auditLog.path . Printing audit events to a file in JSON format degrades server performance more than printing to a file in BSON format

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> Printing audit events to a file in JSON format degrades server performance more than printing to a file in BSON format.
JSON 格式需要将审计事件序列化为可读文本（编码开销较大），而 BSON 是 MongoDB 原生二进制格式，序列化效率更高，因此以 BSON 格式写审计日志对服务器性能影响更小。

### 违反时的风险 (warning)
> Printing audit events to a file in JSON format degrades server performance more than printing to a file in BSON format.
使用 JSON 格式写审计日志时，高审计量场景下服务器性能退化比 BSON 格式更严重，影响正常查询吞吐量。

---

## 使用 Linux logrotate 工具时须将 systemLog.logRotate 设为 reopen 以避免日志丢失

**case_id**: `mongo-config-logrotate-reopen-logrotated-01`
**来源**: [https://www.mongodb.com/docs/manual/reference/configuration-options/](https://www.mongodb.com/docs/manual/reference/configuration-options/) (official)
**平台**: bare
**scope**: storage-engine-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> Use reopen when using the Linux/Unix logrotate utility to avoid log loss.

### 场景 (中文转述)
在 Linux/Unix 系统上使用系统自带的 `logrotate` 工具对 MongoDB 日志进行轮转管理时，需要选择与 logrotate 信号机制兼容的轮转模式，否则会导致日志丢失。

### 推荐
- 值: ``systemLog.logRotate reopen``
- 层: mongodb-config
- 原文:
  > systemLog.logRotate Type : string Default : rename Determines the behavior for the logRotate command when rotating the server log and/or the audit log. Specify either rename or reopen : rename renames the log file. reopen closes and reopens the log file following the typical Linux/Unix log rotate behavior. Use reopen when using the Linux/Unix logrotate utility to avoid log loss.

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> reopen closes and reopens the log file following the typical Linux/Unix log rotate behavior. Use reopen when using the Linux/Unix logrotate utility to avoid log loss. If you specify reopen , you must also set systemLog.logAppend to true .
`rename` 模式下，logrotate 重命名旧日志文件后，mongod 仍持有原文件描述符继续向已被重命名的文件写入，直到 mongod 重启才切换到新文件，期间产生的日志写入旧文件且可能丢失。`reopen` 模式响应信号关闭并重新打开日志文件，与 logrotate 的 postrotate 钩子正确配合，保证不丢日志。

### 违反时的风险 (warning)
使用 `rename` 模式配合 logrotate 时，日志文件被重命名后 mongod 仍向原文件描述符写入，导致轮转期间的日志丢失，无法用于事后分析。

---

## mongos 部署中客户端连接泄漏时须显式设置 maxIncomingConnections 防止分片连接风暴

**case_id**: `mongo-config-mongos-maxconn-connection-leak-01`
**来源**: [https://www.mongodb.com/docs/manual/reference/configuration-options/](https://www.mongodb.com/docs/manual/reference/configuration-options/) (official)
**平台**: bare
**scope**: storage-engine-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> This is particularly useful for a mongos if you have a client that creates multiple connections and allows them to timeout rather than closing them.

### 场景 (中文转述)
在分片集群中，若客户端应用程序创建大量连接后不主动关闭而是让连接自然超时（连接泄漏模式），mongos 会将这些连接对应的请求扇出到各个分片，导致分片上出现连接风暴。

### 推荐
- 值: ``net.maxIncomingConnections slightly higher than max client connections``
- 层: mongodb-config
- 原文:
  > set maxIncomingConnections to a value slightly higher than the maximum number of connections that the client creates, or the maximum size of the connection pool.

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> This setting prevents the mongos from causing connection spikes on the individual shards . Spikes like these may disrupt the operation and memory allocation of the sharded cluster .
mongos 作为连接代理，若接受的连接数超过分片可承受的上限，会在分片层面产生连接风暴；通过限制 mongos 的最大入站连接数，可以在客户端与 mongos 之间建立背压，防止分片被过载。

### 违反时的风险 (warning)
连接风暴导致分片的内存分配压力激增，可能引发各分片 OOM 或响应超时，进而影响整个分片集群的可用性。

---

## 生产环境禁用 systemLog.quiet 模式 · 保留完整日志输出

**case_id**: `mongo-config-quiet-mode-disable-production-01`
**来源**: [https://www.mongodb.com/docs/manual/reference/configuration-options/](https://www.mongodb.com/docs/manual/reference/configuration-options/) (official)
**平台**: bare
**scope**: storage-engine-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> systemLog.quiet Type : boolean Default : false Run mongos or mongod in a quiet mode that attempts to limit the amount of output. systemLog.quiet is not recommended for production systems

### 场景 (中文转述)
在生产环境部署的 mongod 或 mongos 上，若启用了 `systemLog.quiet: true`，MongoDB 会限制日志输出量，这在生产故障排查时会造成严重信息缺失。

### 推荐
- 值: ``systemLog.quiet false``
- 层: mongodb-config
- 原文:
  > systemLog.quiet Type : boolean Default : false Run mongos or mongod in a quiet mode that attempts to limit the amount of output. systemLog.quiet is not recommended for production systems as it may make tracking problems during particular connections much more difficult.

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
quiet 模式会主动减少 mongod/mongos 的日志输出量；在生产事故中，这些被抑制的日志通常是定位连接问题、认证失败、慢查询等问题的关键依据，缺失会大幅延长 MTTR。

### 违反时的风险 (warning)
quiet 模式下，特定连接的诊断信息缺失，生产问题难以追踪，故障排查时间大幅延长。

---

## 生产环境 systemLog.destination 应设为 file 而非 syslog · 避免时间戳误导

**case_id**: `mongo-config-syslog-destination-file-production-01`
**来源**: [https://www.mongodb.com/docs/manual/reference/configuration-options/](https://www.mongodb.com/docs/manual/reference/configuration-options/) (official)
**平台**: bare
**scope**: storage-engine-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> The syslog daemon generates timestamps when it logs a message, not when MongoDB issues the message. This can lead to misleading timestamps for log entries, especially when the system is under heavy load.

### 场景 (中文转述)
将 `systemLog.destination` 设置为 `syslog` 时，syslog 守护进程在接收到消息时才生成时间戳，而非 MongoDB 实际发出消息的时刻。在系统高负载时，两者时间差会使日志时间戳严重失真。

### 推荐
- 值: ``file option for production systems``
- 层: mongodb-config
- 原文:
  > We recommend using the file option for production systems to ensure accurate timestamps.

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> The syslog daemon generates timestamps when it logs a message, not when MongoDB issues the message. This can lead to misleading timestamps for log entries, especially when the system is under heavy load.
syslog 的时间戳反映的是 syslogd 写日志的时刻，而非 mongod 生成事件的时刻。高负载下 syslog 消息队列可能积压，导致时间戳偏差数秒甚至更长，严重干扰性能分析和事故时序还原。

### 违反时的风险 (warning)
> This can lead to misleading timestamps for log entries, especially when the system is under heavy load.
使用 syslog 目标时，高负载下日志时间戳严重失准，导致性能分析和故障排查时序混乱，难以正确关联事件。

---

## 启用 database profiler 前优先考虑 Atlas Query Profiler / Performance Advisor / $queryStats 等替代方案 · profiler 可能 degrade 性能

**case_id**: `mongo-profiler-prefer-atlas-alternatives-before-enabling-02`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/) (official)
**平台**: bare
**scope**: storage-engine-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> When enabled, profiling affects database performance and disk use.

### 场景 (中文转述)
mongod 实例在准备启用 database profiler 之前(无论 level 1 / level 2)。Profiler 一旦开启,不仅影响数据库 CPU / I/O 性能,还会消耗磁盘空间(写 `system.profile` capped collection 与 mongod logfile)。这是文档顶部 Warning callout 警示的通用场景,不限于特定部署形态。

### 推荐
- 值: ``before enabling profiler · 优先用 Atlas Query Profiler / Atlas Performance Advisor / $queryStats(aggregation stage)等替代方案做慢查询观测 · 仅在替代方案无法覆盖时再启用 profiler``
- 层: mongodb-config
- 原文:
  > Before enabling the database profiler, consider using one of the following alternatives:

### 检测方法
> "db.getProfilingStatus()"
违规模式: "When enabled, profiling affects database performance and disk use"

### 机制 / 原因
profiler 不是免费观察工具:它在两条物理写路径上同时产生开销 — ① 性能(同步拦截每次操作的元数据 → CPU / 锁开销);② 磁盘(写 `system.profile` capped collection 与 mongod logfile)。所以任何相同观测目的能用更轻的替代方案完成时,应优先选替代方案,把 profiler 留作专项排查工具。Atlas 系列(Query Profiler / Performance Advisor)与 `$queryStats` aggregation stage 都是 mongod 自身或 Atlas 控制面提供的低侵入观测路径,不会触发 profiler 那两条额外写路径的开销。这一机制在本页 Profiler Overhead H2 段以 because-it-writes-to-the-system-profile-collection-and-the-MongoDB-logfile 显式给出,但跨 H2,不能作 bp2 的 rationale_quote。

### 违反时的风险 (warning)
> The database profiler can degrade MongoDB performance.
不评估替代方案就直接启用 database profiler,可能让 mongod 的整体性能 degrade(尤其 level 2 / level 1 + 低 slowms 组合下)+ 磁盘空间被 `system.profile` 与 mongod logfile 持续占用 → 影响业务读写 SLA / 拉高磁盘使用率。

---

## profiler / diagnostic log slowms 阈值应设为业务可接受的最高值 · 避免性能退化

**case_id**: `mongo-profiler-slowms-highest-useful-value-01`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/) (official)
**平台**: bare
**scope**: storage-engine-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> The slow operation threshold applies to all databases in a mongod instance. It is used by both the database profiler and the diagnostic log.

### 场景 (中文转述)
mongod 实例启用 database profiler 或 diagnostic log 时,`slowms` 慢操作阈值是**进程级全局**配置,影响该实例上所有数据库,且同时控制 profiler 写 `system.profile` 与 mongod log 中 slow-query 行的判定门槛。默认 100ms 在高 QPS / 短查询负载场景会判定大量操作为偏慢,拉高记录开销。

### 推荐
- 值: ``slowms = highest-useful-value`(业务可接受的最大慢查询阈值 · 默认 100ms 仅在低 QPS/SLA 紧张时合理 · 高吞吐场景应调大至 200/500ms 等)`
- 层: mongodb-config
- 原文:
  > Set it to the highest useful value to avoid performance degradation.

### 检测方法
> "db.getProfilingStatus()"
违规模式: "By default, the slow operation threshold is 100 milliseconds"

### 机制 / 原因
`slowms` 同时被 profiler 和 diagnostic log 复用为慢操作判定门槛。当阈值低于业务真实慢边界时,会:① 把正常短查询误判为慢 → 写入 `system.profile`(占 capped collection 容量 + 磁盘 I/O);② 同样的事件写入 mongod log → 拉高 logfile 增长率。两个写路径都竞争 I/O / 锁 / 缓存。所以应把 `slowms` 调到实际能用来定位问题的最高值——既不放过真异常,也不淹没在伪慢里。原文用 to-avoid-performance-degradation 这一目的语隐含上述机制,但未给出 because/since 的因果分句。

### 违反时的风险 (warning)
> Set it to the highest useful value to avoid performance degradation.
`slowms` 被设得过低(默认 100ms 在高 QPS / 短查询场景就偏低),profiler 与 diagnostic log 会记录大量虚假慢日志,带来额外 I/O / 锁 / 磁盘空间开销,导致整体性能退化(performance degradation),和开 profiler 来定位慢的初衷相悖。

---

## storage.directoryPerDB: enable when using separate storage volumes for each database

**case_id**: `wt-directory-per-db-separate-volumes-01`
**来源**: [https://dev.to/devaaai/complete-configuration-guide-for-maximum-read-and-write-performance-2bm6](https://dev.to/devaaai/complete-configuration-guide-for-maximum-read-and-write-performance-2bm6) (community-canonical)
**平台**: bare
**scope**: storage-engine-other
**case_pattern**: parameter-best-practice

### 场景 (中文转述)
在有多个独立存储卷（如多块磁盘、RAID 阵列分组或云盘分卷）的部署环境中，不同数据库的数据目录分布到不同卷上，可以将 I/O 负载分散到多个物理设备。

### 推荐
- 值: ``storage.directoryPerDB = true``
- 层: mongodb-config

### 机制 / 原因
directoryPerDB=true 让每个数据库的数据文件落在独立子目录，便于通过挂载点映射到不同存储卷。I/O 负载分散到多个设备，避免单一磁盘成为所有数据库的共同瓶颈，从而提升整体 I/O 吞吐。

### 违反时的风险 (info)
若有多个独立存储卷但未启用 directoryPerDB，所有数据库的数据文件混在同一目录，无法利用多卷并行 I/O；单一磁盘吞吐量限制了整体数据库 I/O 性能。

---
