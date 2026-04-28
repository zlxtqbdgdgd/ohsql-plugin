# mongo-best-practice-app-other

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 4 条 case。

---

## cursorTimeoutMillis 调小降低空闲游标资源开销

**case_id**: `mongo-cursor-timeout-idle-resource-overhead-04`
**来源**: [https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations](https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations) (official)
**平台**: bare
**scope**: app-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 如果游标的空闲时间超过该阈值，则MongoDB会自动清理该游标

### 场景 (中文转述)
默认空闲游标超时阈值为 600000ms（10 分钟），允许游标长时间空闲会持续占用服务端内存资源，带来不必要的开销，同时业务侧应避免产生长时间空闲游标。

### 推荐
- 值: ``setParameter.cursorTimeoutMillis = 300000``
- 层: mongodb-setparam
- 原文:
  > 不建议调大，为了降低空闲游标的资源开销，可以适当调小（比如300000）

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> 为了降低空闲游标的资源开销，可以适当调小（比如300000）。无论何种场景，业务侧都应尽量避免出现长时间空闲游标的情况
空闲游标在服务端持续占用内存等资源，超时时间越长占用越久。调小 cursorTimeoutMillis 可以更及时地释放空闲游标资源，降低内存压力；同时督促业务侧尽量不产生长时间空闲游标，从根源上降低资源开销。

### 违反时的风险 (warning)
> (NULL · 原文 cursor 报错描述「cursor id xxxxxxx not found / ErrorCode: CursorNotFound(43)」仅是客户端报错，无推论词描述违反推荐的后果，依 §4.5 risk_quote 须含推论词规则置 NULL)
cursorTimeoutMillis 保持过大默认值（600000ms）时，空闲游标长时间占用服务器内存等资源，在高并发场景下累积过多空闲游标会导致内存压力上升；业务若依赖长时间保持游标活跃而未正确管理，会增加 CursorNotFound 报错风险。

---

## oplogSizeMB 在高更新频率工作负载下调大——避免 oplog 空洞和从节点延迟

**case_id**: `mongo-oplog-size-high-write-update-workload-03`
**来源**: [https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations](https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations) (official)
**平台**: bare
**scope**: app-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 业务的workload属于数据量不大但更新很多的情况，oplog产生速度比较快

### 场景 (中文转述)
业务数据量不大但更新操作非常频繁，导致 oplog 产生速度很快。此时默认的 oplogSizeMB（磁盘空间的 10%）可能不足以覆盖足够时长的 oplog 记录，存在从节点同步异常和备份空洞风险。

### 推荐
- 值: ``replication.oplogSizeMB >= 1小时以上的oplog记录量``
- 层: mongodb-config
- 原文:
  > 此时适当调大oplogSizeMB可以使得oplog表能够覆盖更长时间的oplog记录，避免出现oplog记录空洞的问题。最佳实践为设置的oplogSize至少应可以保留1小时以上的oplog记录

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> (NULL · 原文无纯因果机制句，最接近机制候选「参数设置过小，可能会导致从节点跟不上...」含「设置」触发 lint prescription_in_rationale，依 §4.4 NULL 优先原则置 NULL)
高更新频率的写入会快速覆盖旧 oplog 记录。当 oplog 容量不足时，从节点来不及消费就已经被覆盖，导致同步中断进入 RECOVERING 状态；同时备份无法覆盖完整 oplog 记录，出现空洞，导致按时间点恢复（PITR）失败。

### 违反时的风险 (critical)
> 参数设置过小，可能会导致从节点跟不上而进入异常的RECOVERING状态；也有可能导致日志备份来不及覆盖所有oplog记录而出现空洞，进而无法进行按时间点恢复
oplogSizeMB 过小将导致从节点进入 RECOVERING 异常状态，以及按时间点恢复（PITR）失败，严重影响数据高可用和灾备能力。

---

## tcmallocAggressiveMemoryDecommit 在内存 OOM/碎片场景启用加速内存回收

**case_id**: `mongo-tcmalloc-aggressive-decommit-oom-fragment-07`
**来源**: [https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations](https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations) (official)
**平台**: bare
**scope**: app-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 因为查询请求消耗过大，内存来不及回收而出现mongod节点OOM的情况。随着不断使用，堆内存碎片空间越来越多，表现上为内存使用率超过80%且稳定缓慢上升

### 场景 (中文转述)
MongoDB 内部使用 TCMalloc 作为内存分配器，在查询压力大的情况下，堆内存碎片不断积累，内存使用率超过 80% 且缓慢持续上升，存在 OOM 风险。在业务低峰期可以开启激进回收策略，促使内存归还给操作系统。

### 推荐
- 值: ``setParameter.tcmallocAggressiveMemoryDecommit = 1``
- 层: mongodb-setparam
- 原文:
  > 有内存相关问题时可以考虑在业务低峰期时调整

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> (NULL · 原文最接近机制句「此参数用于控制是否开启TCMalloc的激进回收策略。开启后，MongoDB会主动尝试合并相邻的空闲内存块并归还一部分内存给操作系统」含「使用」命中 RE_ACTION_VERB_BP 而无机制连接词，依 §4.4 NULL 优先原则置 NULL)
TCMalloc 默认不激进地将空闲内存归还给 OS，导致堆内存碎片持续积累，RSS 缓慢上升。开启激进回收策略后，MongoDB 主动合并相邻空闲内存块并归还 OS，可有效缓解内存碎片和 OOM 风险，但有一定性能退化代价，须在业务低峰期使用。

### 违反时的风险 (warning)
> (NULL · 原文「开启此参数可能会带来一定的性能退化，具体情况取决于您的工作负载」中「性能退化」无中文推论词匹配（RE_RISK_WORD_BP 含「degrade」但对应英文，中文仅有「降低/下降」），依 §4.5 risk_quote 须含推论词规则置 NULL)
不开启时内存碎片持续积累，存在 mongod OOM 导致进程崩溃的风险；开启后可能带来一定性能退化，具体取决于工作负载，需在业务低峰期谨慎启用并持续观察，如受影响应及时回滚。

---

## 高写入集群将 TTL 过期删除窗口移至夜间低峰期规避白天 delete 高峰

**case_id**: `mongo-ttl-expiry-offpeak-window-high-write-01`
**来源**: [https://cloud.tencent.com/developer/news/710321](https://cloud.tencent.com/developer/news/710321) (community-canonical)
**平台**: bare
**scope**: app-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 该集群总文档数百亿条，每条文档记录默认保存三天，业务随机散列数据到三天后任意时间点随机过期淘汰。由于文档数目很多，白天平峰监控可以发现从节点经常有大量delete操作，甚至部分时间点delete删除操作数已经超过了业务方读写流量

### 场景 (中文转述)
百亿级文档、TTL 三天过期的高写入集群中，过期删除操作随机分布到全天，导致白天业务高峰时段从节点 delete 操作量甚至超过业务读写流量，显著增加集群负载和时延抖动。

### 推荐
- 值: ``expireAfterSeconds=0``
- 层: mongodb-config
- 原文:
  > 考虑把delete过期操作放入夜间进行，过期索引添加方法如下: Db.collection.createIndex( { "expireAt": 1 }, { expireAfterSeconds: 0 } )

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> 通过随机散列expireAt在三天后的凌晨任意时间点，即可规避白天高峰期触发过期索引引入的集群大量delete，从而降低了高峰期集群负载，最终减少业务平均时延及抖动。
使用 `expireAfterSeconds=0` + 在 `expireAt` 字段存储绝对过期时间点(随机散列到夜间凌晨),将删除操作集中到业务低峰期执行,避免与白天业务写入争抢 CPU/IO 资源,降低高峰期集群负载和业务时延抖动。

### 违反时的风险 (warning)
> (NULL · 原文无含导致/引起/造成等典型推论词的违反后果句)
不控制 TTL 过期窗口时，删除操作与业务高峰重叠，从节点 delete 流量甚至超过业务读写流量，导致集群高峰期负载升高、平均时延及抖动加剧，影响业务可用性。

---
