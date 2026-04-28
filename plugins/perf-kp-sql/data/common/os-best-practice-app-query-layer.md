# os-best-practice-app-query-layer

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 6 条 case。

---

## 应用侧操作慢但 DB 侧未见对应 · 设 connectTimeoutMS 防止驱动连接阶段无限等待

**case_id**: `bp-mongo-pool-connecttimeoutms-network-latency-01`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/](https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/) (official)
**平台**: bare
**scope**: app-query-layer
**case_pattern**: parameter-best-practice

### 场景 (原文)
> Slow application-side operation times ... server logs or the real time panel

### 场景 (中文转述)
应用层观测到操作时间长(慢请求 / 长尾延迟),但是数据库服务器日志或 Atlas 实时监控面板里并没有相应的慢操作记录——这种"应用慢、DB 不慢"的不对称往往出在驱动连接阶段:网络抖动 / 跨可用区延迟 / 部分副本集成员不可达,driver 在建连阶段卡住直到默认超时(很长)才返回。

### 推荐
- 值: ``connectTimeoutMS > longest network latency to any replica set member``
- 层: other
- 原文:
  > Set connectTimeoutMS to a value greater than the longest network latency you have to a member of the set

### 机制 / 原因
> if a member has a latency of 10000 milliseconds, setting connectTimeoutMS to 5000 (milliseconds) prevents the driver from connecting to that member
connectTimeoutMS 决定 driver 在 TCP 建连阶段的最大等待。如果设得**比最长合法网络延迟还小**,driver 在合法但稍慢的副本成员上就会建连失败,被踢出可达成员名单——文档示例:成员真实 latency=10000ms · 把 connectTimeoutMS 设到 5000ms 反而把这个成员"误诊为不可达"。所以阈值的下界由"集群中最慢但仍可达成员的延迟"决定,默认或过大值则倒过来引发"无限等待"问题。

### 违反时的风险 (warning)
不设 connectTimeoutMS 或设过大,driver 在网络问题(如网络黑洞 / 防火墙静默丢包 / 副本成员宕机但 TCP 半开)时会**无限等待**建连;表象就是应用延迟尖刺,而 DB 服务端日志看不到对应慢请求(因为请求根本没发出去)。

---

## 应用启动时连接创建占用过多时间 · 设 minPoolSize 预热池子

**case_id**: `bp-mongo-pool-minpoolsize-startup-warmup-03`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/](https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/) (official)
**平台**: bare
**scope**: app-query-layer
**case_pattern**: parameter-best-practice

### 场景 (原文)
> The server logs or real time panel show that the application spends too much time creating new connections

### 场景 (中文转述)
通过服务端日志或 Atlas 实时面板观察到:大量时间用于"创建新连接",而不是真正执行 op。典型出现在应用冷启动 / 流量突增时——池子初始为空,每个新请求都要走一次完整 TLS handshake + auth,延迟和服务端 CPU 都被拉高。

### 推荐
- 值: ``minPoolSize = number of connections required at startup``
- 层: other
- 原文:
  > Set minPoolSize to the number of connections you want to be available at startup

### 机制 / 原因
> The MongoClient instance ensures that number of connections exists at all times
minPoolSize 是 driver 池底线:MongoClient 会**始终**保持至少这么多 socket 处于建立状态——启动期间预热(主动建立 minPoolSize 条到所有副本成员的连接),之后即便流量低也不会缩到 0。这把「建连成本(TCP handshake + TLS + auth)」摊到启动期一次性完成,业务期就能直接复用,避免冷启动慢请求 / 突发流量打爆。

### 违反时的风险 (warning)
不设 minPoolSize(默认 0),应用首次接到请求才开始建连,冷启动 P99 / P999 延迟显著抬升;流量瞬增场景里每条新请求都触发新建,服务端 auth / TLS 开销叠加,可能进一步打爆服务端 CPU,形成正反馈式抖动。

---

## 防火墙半关闭 socket · 设 socketTimeoutMS 为最慢 op 时长的 2~3 倍以确保 socket 总能释放

**case_id**: `bp-mongo-pool-sockettimeoutms-firewall-half-close-02`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/](https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/) (official)
**平台**: bare
**scope**: app-query-layer
**case_pattern**: parameter-best-practice

### 场景 (原文)
> A misconfigured firewall closes a socket connection incorrectly and the driver cannot detect that the connection closed improperly

### 场景 (中文转述)
应用与 mongod 之间的链路上有防火墙(企业内网 / 云 SG / NAT)且配置不当,会"悄悄"关闭已建立的 TCP 连接而不发 RST/FIN——driver 看不到链路断开信号,池里残留半开 socket,业务发请求时才挂起或报错。

### 推荐
- 值: ``socketTimeoutMS = 2~3 × longest legitimate operation duration``
- 层: other
- 原文:
  > Set socketTimeoutMS to two or three times the length of the slowest operation that the driver runs

### 机制 / 原因
> socketTimeoutMS to ensure that sockets are always closed
socketTimeoutMS 是 driver 在已建连 socket 上等待响应的上限——超时即主动断开。设为"最慢合法操作的 2~3 倍",一方面给慢但合法的 op 足够裕量,另一方面在防火墙半关闭、远端 hang 等异常时确保 socket 能被强制释放归池,不会一直黑洞。下界(2x)防止误杀正常长 op,上界(3x)避免黑洞 socket 占池太久。

### 违反时的风险 (warning)
不设 socketTimeoutMS 或设过大,半关闭的 socket 会在驱动池里「以为还活着」,新请求被分配到这个 socket 时挂起到操作系统级 TCP keepalive 探测才发现已死(默认 7200s);业务表现为间歇请求 hang / 单连接级别长尾延迟。

---

## 想取消服务端长 op 时不要用 socketTimeoutMS · 改用 maxTimeMS() 让服务端真正取消

**case_id**: `bp-mongo-pool-sockettimeoutms-not-for-server-cancel-use-maxtimems-06`
**来源**: [https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/](https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/) (official)
**平台**: bare
**scope**: app-query-layer
**case_pattern**: parameter-best-practice

### 场景 (原文)
> Do not use socketTimeoutMS to prevent long-running server operations

### 场景 (中文转述)
需要在客户端层「杀掉」运行时间过长的服务端 op 的场景(典型:应用 SLA 要求 5s 以内必须返回;批量任务想限制单 op 上限)。误用模式:把 socketTimeoutMS 调小到 SLA 时长——表面看起来「超时就断」达到目的,实际并没有取消服务端 op。

### 推荐
- 值: ``use maxTimeMS() instead of small socketTimeoutMS for server-side op cancellation``
- 层: other
- 原文:
  > use maxTimeMS() with queries so that the server can cancel long-running operations

### 机制 / 原因
socketTimeoutMS 只让 **driver** 主动断开 socket—— mongod 服务端那条 op **依然在跑**,继续吃 CPU / 持锁,直到自然完成或被外部 kill。`maxTimeMS()` 是 op 级别的预算,driver 把它编码进 wire protocol,mongod 在执行链路里**自己**检测超时并真正中止 op、释放 lock / 资源。两者作用域不同:socketTimeoutMS 是连接级别 + 客户端单边失效;maxTimeMS 是 op 级别 + 服务端协同取消。要真正"防长 op"必须用后者。

### 违反时的风险 (warning)
误用 socketTimeoutMS 当「服务端长 op 杀手」:driver 提前断 socket,但 mongod 那条 op 仍在跑,服务端资源(CPU / lock / 内存)仍被吃。叠加 driver 自动重试机制,客户端可能反复重发 op,服务端同时跑多条相同 op,雪崩级 CPU 飙升 + lock contention,比不超时更糟。

---

## driver 连接池大小起点应为应用层"典型并发请求数 × 110-115%" · 池太小将请求排队

**case_id**: `mongo-driver-connection-pool-size-110-115pct-concurrent-03`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-checklist-development/](https://www.mongodb.com/docs/manual/administration/production-checklist-development/) (official)
**平台**: bare
**scope**: app-query-layer
**case_pattern**: parameter-best-practice

### 场景 (原文)
> Make use of connection pooling. Most MongoDB drivers support connection pooling

### 场景 (中文转述)
应用通过 MongoDB driver 连接 mongod / mongos 的所有部署场景(单机 / 副本集 /
分片集群均适用)。多数 official driver 默认启用连接池(maxPoolSize 默认 100
或类似),用户需结合"典型并发数据库请求数"调参。典型工作负载:Web/API 服务、
后台 worker、批处理脚本——前两者并发可观测,后者通常池规模可手算。

### 推荐
- 值: ``connection pool size = 110-115% × typical concurrent database requests``
- 层: other
- 原文:
  > Adjust the connection pool size to suit your use case, beginning at 110-115% of the typical number of concurrent database requests

### 检测方法

### 机制 / 原因
连接池起点取"并发数 × 110-115%"而非 100% 是给短时尖峰留 10-15% 缓冲——并发请求
分布并非匀速,实际短窗口尖峰常超平均 5-15%;若池大小恰等于平均并发,任何短峰
都立刻让请求排队等连接,P99 延迟剧烈抬升。另一面起点也不应远超 115%(如 200%
或 500%):闲置连接占应用进程内存(每条 socket buffer + driver 内部状态)且
mongod 侧每条连接对应一个工作线程(legacy)或 connection slot,过多空闲连接
浪费服务端 RAM 与 CPU(线程上下文切换 / scan-all-conns 操作)。**110-115% 是
"既吸收尖峰、又不浪费"的经验起点**,实际部署应根据观测到的池利用率/排队事件
继续微调。

### 违反时的风险 (warning)
池太小(< 110% × 并发):请求等连接 → 应用线程阻塞 → P99 延迟尖峰、可能连锁阻塞
应用线程池(尤其 Java/Node.js 场景)→ 业务超时;池过大(>> 115%):mongod 侧
连接 slot 占用过多内存 / CPU(线程或 cooperative 调度开销)、应用进程 socket
buffer 内存浪费;在副本集滚动重启 / 主从切换时,过多空闲连接会让重连风暴更
剧烈(thundering herd)。本规则是 perf-kp-sql 实际可比对的 driver 连接池审计
点,值 < 1.10× 并发即触发 warning。评级 warning:延迟抖动 / 资源浪费类风险,
非数据丢失。

---

## linearizable 读关注配合 maxTimeMS 防止操作无限挂起

**case_id**: `mongo-read-concern-linearizable-maxtimems`
**来源**: [https://www.mongodb.com/resources/products/capabilities/performance-best-practices-transactions-and-read-write-concerns](https://www.mongodb.com/resources/products/capabilities/performance-best-practices-transactions-and-read-write-concerns) (official)
**平台**: bare
**scope**: app-query-layer
**case_pattern**: parameter-best-practice

### 场景 (原文)
> MongoDB supports a readConcern level of "Linearizable". The linearizable read concern ensures that a node is still the primary member of the replica set at the time of the read and that the data it returns will not be rolled back if another node is subsequently elected as the new primary member.

### 场景 (中文转述)
在使用 linearizable 读关注级别时，该级别能确保读取时节点仍为主节点，且返回的数据在后续主节点选举中不会被回滚；但该特性会对延迟产生显著影响，因此需要搭配超时保护机制。

### 机制 / 原因
> Configuring this read concern level can have a significant impact on latency, therefore a maxTimeMS value should be supplied in order to timeout long-running operations.
linearizable 读关注要求确认当前节点仍为主节点，需要额外的网络往返来验证，因此会对读取延迟产生显著影响。若不设置 maxTimeMS，长时间未完成的读操作将无限挂起，直到操作最终完成或连接中断，严重影响应用程序响应性。

### 违反时的风险 (warning)
> Configuring this read concern level can have a significant impact on latency, therefore a maxTimeMS value should be supplied in order to timeout long-running operations.
若使用 linearizable 读关注时不设置 maxTimeMS，长时间运行的操作将无法超时，导致查询无限挂起，应用程序响应延迟无法预测，严重时影响可用性。

---
