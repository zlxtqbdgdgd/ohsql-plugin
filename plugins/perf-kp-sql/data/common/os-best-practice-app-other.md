# os-best-practice-app-other

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 6 条 case。

---

## 重要数据写入应使用 w:majority，防止主节点故障转移时写操作被回滚

**case_id**: `app-other-write-concern-majority-mongodb-failover-01`
**来源**: [https://mongoing.com/archives/3895](https://mongoing.com/archives/3895) (community-canonical)
**平台**: bare
**scope**: app-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 默认情况下应用的写操作（更新，插入或者删除）在主节点上完成后就会立即返回。写操作则通过OPLOG方式在后台异步方式复制到其他节点。在极端情况下，这些写操作可能还未在复制到从节点的时候主节点就出现宕机。这个时候发生主备节点切换，原主节点的写操作会被回滚到文件而对应用不可见。

### 场景 (中文转述)
MongoDB 复制集默认写关注（Write Concern）为 w:1，即写操作在主节点写入成功后立即返回，从节点通过 oplog 异步复制。极端情况下（主节点崩溃时 oplog 尚未复制至从节点），发生故障转移后这些写入会被回滚，对应用不可见，存在数据丢失风险。

### 推荐
- 值: ``w = "majority"``
- 层: mongodb-config
- 原文:
  > MongoDB建议对重要的数据使用 {w: "majority"} 的选项。{w: "majority"} 可以保证数据在复制到多数节点后才返回成功结果。使用该机制可以有效防止数据回滚的发生。

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
> {w: "majority"} 可以保证数据在复制到多数节点后才返回成功结果。使用该机制可以有效防止数据回滚的发生。
使用 w:majority 要求 MongoDB 等待多数（通常为 ≥2/3 节点）确认写入后才向应用返回成功，确保在任何合法故障转移场景中，新主节点上都已包含该写入，从而避免回滚。w:1 默认值仅等待主节点确认，异步复制窗口期内的宕机会导致已确认写入丢失。

### 违反时的风险 (critical)
> 这个时候发生主备节点切换，原主节点的写操作会被回滚到文件而对应用不可见。
使用默认 w:1 写关注时，主节点崩溃触发故障转移后，尚未复制到从节点的写操作会被回滚，已向应用返回「写入成功」的数据实际丢失，造成数据不一致，影响业务正确性。

---

## 副本集部署需 ≥3 个数据承载 voting 成员 + 写操作走 w:majority · 否则数据耐久性无法满足

**case_id**: `mongo-replica-set-data-durability-three-voting-majority-01`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-checklist-development/](https://www.mongodb.com/docs/manual/administration/production-checklist-development/) (official)
**平台**: bare
**scope**: app-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> Ensure that your replica set includes at least three data-bearing voting members and that your write operations use

### 场景 (中文转述)
任何用于生产的 MongoDB 副本集部署场景。"data-bearing voting member" 指既保存
数据也参与选举投票的副本(区别于 arbiter 仅投票不存数据)。本建议适用于副本集
单独部署、副本集成员组成的分片集群成员、以及云托管 / 自建的所有 replica set
拓扑。

### 推荐
- 值: ``replica set ≥ 3 data-bearing voting members + write concern w: majority``
- 层: mongodb-config
- 原文:
  > Ensure that your replica set includes at least three data-bearing voting members

### 检测方法

### 机制 / 原因
`w: majority` 写入要求过半 voting 成员持久化才算成功提交,这是基于多数派
(majority quorum)的耐久性保证 — 任何 N/2 + 1 个成员故障同时 lost 才会导致
数据丢失。三个 voting 成员是"过半多数"的最小拓扑(majority = 2),允许容忍单
节点故障且仍能完成多数派提交;两 voting 成员或一 voting 成员的部署不能同时
满足"高可用 + 多数派耐久"二者。"data-bearing"(非 arbiter)要求是因为多数派
里至少要有真正持有数据的成员投票,arbiter 只投票不存数据,无法对耐久性出力。

### 违反时的风险 (critical)
不满足任一条件(< 3 voting 数据成员 / 写操作不走 w:majority):
1. 单 primary 故障可能导致已确认写丢失(rollback) — 即数据丢失;
2. 双 voting 成员部署在网络分区下两边互不构成多数派,选举僵局,写不可用;
3. 用 arbiter 替代第三 data-bearing 成员的 P-S-A 拓扑在 secondary 失联时退化为
   单成员组多数,缺乏 majority 持久化保证 — 已在 MongoDB 官方文档中明确为
   "已知耐久性弱化场景"。
评级 critical:数据丢失类风险。

---

## 副本集投票成员需为奇数(最多 7 个)· 偶数时用 arbiter 凑奇数 · 否则选举平票卡死

**case_id**: `mongo-replica-set-odd-voting-members-elections-02`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-checklist-development/](https://www.mongodb.com/docs/manual/administration/production-checklist-development/) (official)
**平台**: bare
**scope**: app-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> If you have an even number of voting members, and constraints, such as cost, prohibit adding another secondary to be a voting member, you can add an arbiter to ensure an odd number of votes

### 场景 (中文转述)
任何 MongoDB 副本集部署在规划 voting 成员数时的场景。典型情况:成本约束下两数据
中心各部一 voting secondary 凑成偶数(2/4 voting),或拓扑天然偶数(4 voting,需
凑成 5);此时引入 arbiter(只投票不存数据)凑奇数。

### 推荐
- 值: ``voting members ∈ {1,3,5,7} (odd, ≤7)``
- 层: mongodb-config
- 原文:
  > Use an odd number of voting members to ensure that elections proceed successfully. You can have up to 7 voting members

### 检测方法

### 机制 / 原因
副本集选举遵循"过半 voter 同意才能选出 primary"。voter 数为偶数 N 时,过半 = N/2 + 1
但其反面 = N/2 也可达到"过半"——网络分区时两边可能同时拿到 N/2 票,陷入平票
僵局,任一方都选不出 primary。voter 数为奇数 2k+1 时,过半 k+1,任一分区只能
有一方达到多数;选举有确定胜者。 7 是上限因投票协议消息数(round-trip)随成员
增长 quadratic 上升,> 7 voter 选举耗时不可接受;且实际 HA 需求下 5/7 已足。
arbiter 只投票不持久化数据,可以低成本凑奇数(典型 P-S-A 三成员组合)。

### 违反时的风险 (critical)
偶数 voter 拓扑下,网络分区或多节点同时故障可能让两侧各凑出 N/2 票却互不
认可,选举僵局持续 → primary 缺失 → 整个副本集写不可用(读 secondary 仍可,
但延迟/不一致)。> 7 voter 时选举消息 RTT 暴增,主从切换可能慢到分钟级,业务
切流期间所有写都失败。评级 critical:可用性丧失类风险。

---

## 长事务导致 WiredTiger 缓存压力：拆分事务并确保索引覆盖

**case_id**: `mongo-txn-long-running-wt-cache-pressure`
**来源**: [https://www.mongodb.com/resources/products/capabilities/performance-best-practices-transactions-and-read-write-concerns](https://www.mongodb.com/resources/products/capabilities/performance-best-practices-transactions-and-read-write-concerns) (official)
**平台**: bare
**scope**: app-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> Creating long-running transactions, or attempting to perform an excessive number of operations in a single ACID transaction can result in high pressure on the WiredTiger storage engine cache.

### 场景 (中文转述)
在创建长时间运行的事务、或在单个 ACID 事务中执行过多操作时，会对 WiredTiger 存储引擎缓存产生过高的压力，需要通过合理拆分事务来缓解。

### 机制 / 原因
> the cache must maintain state for all subsequent writes since the oldest snapshot was created. As a transaction always uses the same snapshot while it is running, new writes accumulate in the cache throughout the duration of the transaction. These writes cannot be flushed until transactions currently running on old snapshots commit or abort, at which time the transactions release their locks and WiredTiger can evict the snapshot.
WiredTiger 必须为最旧快照之后的所有后续写入维护状态。事务在运行期间始终使用同一快照，新写入会在事务生命周期内持续累积于缓存中，直到旧快照上的事务提交或中止后才能被驱逐。事务越长，累积的未刷写数据越多，缓存压力越大。

### 违反时的风险 (warning)
> Creating long-running transactions, or attempting to perform an excessive number of operations in a single ACID transaction can result in high pressure on the WiredTiger storage engine cache.
若不拆分长事务，WiredTiger 缓存将承受过高压力，旧快照对应的脏页无法及时驱逐，可能导致缓存耗尽、写入停滞和整体性能下降。

---

## 单次事务修改文档上限 1000 条：超出须拆批处理

**case_id**: `mongo-txn-modify-1000-docs-max-batch`
**来源**: [https://www.mongodb.com/resources/products/capabilities/performance-best-practices-transactions-and-read-write-concerns](https://www.mongodb.com/resources/products/capabilities/performance-best-practices-transactions-and-read-write-concerns) (official)
**平台**: bare
**scope**: app-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> There are no hard limits to the number of documents that can be read within a transaction. As a best practice, no more than 1,000 documents should be modified within a transaction.

### 场景 (中文转述)
在需要修改大量文档的事务场景中，虽然读取文档数量没有硬性限制，但单次事务内修改的文档数量若超过 1000 条，需要按最佳实践进行拆分批处理。

### 机制 / 原因
> Creating long-running transactions, or attempting to perform an excessive number of operations in a single ACID transaction can result in high pressure on the WiredTiger storage engine cache. This is because the cache must maintain state for all subsequent writes since the oldest snapshot was created.
单次事务修改文档越多，WiredTiger 缓存需要维护的快照状态就越多。过多的操作导致缓存持续积压，旧快照无法被驱逐，从而对缓存造成过高压力。拆分为小批次可以让每个批次及时释放锁、驱逐旧快照，维持稳定的数据库性能。

### 违反时的风险 (warning)
> Creating long-running transactions, or attempting to perform an excessive number of operations in a single ACID transaction can result in high pressure on the WiredTiger storage engine cache.
若单次事务修改文档超过 1000 条而不拆分，会对 WiredTiger 缓存造成过高压力，影响数据库整体性能稳定性。

---

## MongoDB maxIncomingConnections: raise above default 64k for high-connection deployments

**case_id**: `os-mongod-maxincomingconnections-high-conn-01`
**来源**: [https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections](https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections) (official)
**平台**: linux-x86_64-generic
**scope**: app-other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> Even MongoDB itself has an option to limit the maximum number of incoming connections . It defaults to 64k.

### 场景 (中文转述)
在需要支持超过 64k 个并发连接的大规模 MongoDB 部署场景中（如性能基准测试或超高并发业务），mongod 默认的 `maxIncomingConnections` 限制（默认值 64k）会成为连接数瓶颈，需显式提高。

### 推荐
- 值: ``maxIncomingConnections = 999999``
- 层: mongodb-config
- 原文:
  > maxIncomingConnections: 999999

### 机制 / 原因
mongod 内部设有软性连接上限（默认 64k），该限制独立于 OS 的 ulimit 之外。在高并发连接场景下，即使 OS 资源已充足，若未提高 `maxIncomingConnections`，mongod 自身也会拒绝超过 64k 的新连接请求。将其设置为远大于预期最大并发连接数的值（如 999999）可消除该软性上限。

### 违反时的风险 (warning)
若不调高 `maxIncomingConnections`，在连接数超过 64k 时 mongod 将拒绝新连接建立，即使 OS 层面资源仍然充足也无法突破该上限，导致客户端连接失败。

---
