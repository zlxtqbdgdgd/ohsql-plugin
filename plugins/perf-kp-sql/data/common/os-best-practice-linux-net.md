# os-best-practice-linux-net

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 11 条 case。

---

## 鲲鹏网卡性能调优：禁用自适应中断聚合（adaptive-rx/tx off），使用静态 ethtool -C 参数

**case_id**: `bp-linux-net-nic-interrupt-coalescing-static-kunpeng-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0027.html](https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0027.html) (official)
**平台**: linux-arm64-kunpeng
**scope**: linux-net
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 中断聚合特性允许网卡收到报文之后不立即产生中断，而是等待一小段时间有更多的报文到达之后再产生中断，这样就能让CPU一次中断处理多个报文，减少开销。

### 场景 (中文转述)
在鲲鹏 ARM64 主机网络性能调优场景下，网卡中断聚合特性允许将多个报文批量合并成一次 CPU 中断处理，从而减少中断频率和 CPU 上下文切换开销。为使中断聚合行为可预测（固定延时上限），需禁用网卡默认的自适应中断调节（adaptive-rx/adaptive-tx），改用静态参数。

### 推荐
- 值: ``adaptive-rx off, adaptive-tx off``
- 层: other
- 原文:
  > 为了确保使用静态值，需禁用自适应调节，关闭Adaptive RX和Adaptive TX。

### 检测方法

### 机制 / 原因
网卡自适应中断调节（adaptive-rx/tx）会根据当前流量动态调整聚合延时，导致中断行为不可预测，在流量突变时可能产生额外延时抖动。禁用自适应调节、改用静态 rx-usecs / tx-usecs / rx-frames / tx-frames 参数后，CPU 每次中断处理的报文批量大小固定，中断频率可控，整体 CPU 中断开销降低，适合对延时一致性有要求的数据库工作负载（如 MongoDB 在高并发写/读场景下的网络 IO）。

### 违反时的风险 (info)
> 当增大聚合度时，单个数据包的延时会以微秒的级别增加。
如将 N 值调得过大（过度增大聚合度），单个数据包的端到端延时会在微秒级别增加，对延时敏感型业务（如低延时 OLTP、实时读取）产生可感知影响。同时，若不禁用自适应调节而依赖 adaptive-rx/tx，中断行为动态可变，在流量突发场景下聚合度可能骤降导致 CPU 中断频率飙升，难以形成稳定的调优基线。

---

## 鲲鹏服务器手动绑定网卡中断到本地 NUMA · 关闭 irqbalance · 32 队列绑满获最佳网络性能

**case_id**: `kunpeng-net-irq-affinity-bind-all-queues-to-local-numa-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0013.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0013.html) (official)
**平台**: linux-arm64-kunpeng
**scope**: linux-net
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 网卡中断绑核。对于不同的硬件配置，用于绑中断的最佳CPU数目会有差异，比如对于鲲鹏920 5250处理器 + Huawei TM280 25G网卡（鲲鹏服务器的板载网卡）来说，最多可以绑定32个中断队列，建议将所有的队列都用在中断绑定上来获得最佳性能。

### 场景 (中文转述)
鲲鹏服务器(典型样机为鲲鹏 920 5250 处理器 + Huawei TM280 25G 板载网卡)用于承载高并发数据库网络流量时,默认 irqbalance 服务在线、网卡中断由内核动态分配,可能漂到非网卡所属 NUMA 节点的 CPU 上,导致跨 NUMA 内存访问与 cache 失效;此场景下需要做"网卡中断绑核"调优。

### 推荐
- 值: ``所有 NIC IRQ 队列(典型 32 个)绑到本地 NUMA CPU · /proc/irq/<N>/smp_affinity_list = 本地 NUMA 核 ID(前置:irqbalance 关闭)``
- 层: os-sysctl
- 原文:
  > 对于不同的硬件配置，用于绑中断的最佳CPU数目会有差异，比如对于鲲鹏920 5250处理器 + Huawei TM280 25G网卡（鲲鹏服务器的板载网卡）来说，最多可以绑定32个中断队列，建议将所有的队列都用在中断绑定上来获得最佳性能。

### 检测方法
> "systemctl status irqbalance.service"

### 机制 / 原因
irqbalance 默认在线时内核会按全局负载动态调度网卡中断,可能把同一 NIC 的多队列中断分到不同 NUMA 节点的 CPU。鲲鹏 920 是多 die 多 NUMA 架构(单路 5250 含 4 个 NUMA · 跨 die 访存延迟显著高于本 die),网卡 PCIe 控制器物理上挂在某一固定 NUMA · 中断处理代码若运行在远端 NUMA CPU,会触发跨 die 访问网卡 DMA 缓冲、跨 die 唤醒接收线程,导致 L3 cache miss 与 NUMA 远端访存,最终拉高网络收发延迟、压低高并发数据库吞吐。手动把 NIC 全部 IRQ 队列绑到 NIC 本地 NUMA 的足够多 CPU 上,中断处理 + 后续协议栈软中断都在本地完成,cache locality 与 NUMA locality 同时达到最佳。

### 违反时的风险 (warning)
不关闭 irqbalance 且不手动绑核,会出现:(1) NIC 中断在多 NUMA 之间漂移,大量跨 die 访存抬升网络协议栈延迟;(2) cache locality 被破坏,接收路径 hot path 频繁 L3 miss;(3) 高 QPS 数据库连接(MongoDB / MySQL 等)吞吐下降、p99 抖动加剧;(4) 多核扩展性变差,网络敏感型 workload 不能充分利用鲲鹏的多核大宽度。整体表现为"鲲鹏服务器网络密集型业务性能不达标"。严重度归为 warning(性能损失 · 非可用性 / 数据安全级风险)。

---

## net.ipv4.ip_local_port_range: expand ephemeral port range on benchmark/client hosts

**case_id**: `os-net-ip-local-port-range-client-01`
**来源**: [https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections](https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections) (official)
**平台**: linux-x86_64-generic
**scope**: linux-net
**case_pattern**: parameter-best-practice

### 场景 (原文)
> I was surprised to learn that by default Linux wouldn't even use the full range of 65k ports that TCP has possible. Even this had to be configured

### 场景 (中文转述)
在基准测试客户端或需要从单机发起大量出站 TCP 连接的场景下，Linux 默认的临时端口范围（ephemeral port range）远小于 TCP 协议允许的 65535 个端口，导致可建立的出站连接数被操作系统默认配置限制。注意：此参数仅需在发起连接的客户端侧调整，MongoDB 服务端侧无需修改。

### 推荐
- 值: ``net.ipv4.ip_local_port_range = 1024 65530``
- 层: os-sysctl
- 原文:
  > echo "net.ipv4.ip_local_port_range = 1024 65530" | sudo tee -a /etc/sysctl.conf

### 机制 / 原因
TCP 连接由四元组（本地 IP、本地端口、远端 IP、远端端口）唯一标识，单个 IP 地址最多使用 65535 个端口，因此从单机发起的出站连接数受本地临时端口范围制约。Linux 默认不使用全部端口范围，通过扩展 `net.ipv4.ip_local_port_range` 至 1024–65530 可最大化单机可用出站连接数，突破操作系统默认限制。

### 违反时的风险 (warning)
若不扩展 `net.ipv4.ip_local_port_range`，Linux 客户端的出站连接数将被操作系统默认临时端口范围限制（通常约 28000 个端口），远低于 TCP 协议理论上限，导致基准测试或高并发出站场景下连接数达到上限后内核返回 EADDRNOTAVAIL 错误，新连接无法建立。

---

## MongoDB 客户端调大 netdev_max_backlog 至 8096 避免高入流量丢包

**case_id**: `os-net-netdev-max-backlog-mongo-client-8096-04`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html) (official)
**平台**: linux-arm64-kunpeng
**scope**: linux-net
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### 场景 (中文转述)
MongoDB 客户端主机在万兆 / 多队列网卡 + 高并发查询响应回流场景下,网卡入向数据包
速率超过单 CPU softirq 处理能力时,内核 input queue 在 ksoftirqd 调度间隙溢出。
默认 `net.core.netdev_max_backlog = 1000` 偏小,无法吸收 burst。

### 推荐
- 值: ``net.core.netdev_max_backlog = 8096``
- 层: os-sysctl
- 原文:
  > 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### 机制 / 原因
NIC 收到数据包后通过 NAPI 递交给 ksoftirqd 处理,中间走 per-CPU input queue
(`backlog`)缓冲。当 NIC RX 速率 >> ksoftirqd 处理速率(典型在 GC stall / 调度延迟 /
跨 NUMA 内存访问下),队列在 1000 处溢出 → 内核直接丢包,`/proc/net/softnet_stat`
第二列(dropped)递增。8096 提供 8x 缓冲深度吸收 burst,代价是占用极少 RAM(每 entry
~256B)。

### 违反时的风险 (warning)
不调整时,大查询响应包(eg. 数十 MB findResult / aggregation 流式回包)被网卡接收
速率压垮 ksoftirqd · 内核在 backlog 溢出处直接丢包 · TCP 触发重传 · 客户端表现
为查询尾延迟 P99 飙升 / 网络抖动 · `softnet_stat` dropped 字段非零持续累积。

---

## MongoDB 客户端 listen() backlog 上限 somaxconn 调至 65535 防 accept 队列溢出

**case_id**: `os-net-somaxconn-mongo-client-65535-03`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html) (official)
**平台**: linux-arm64-kunpeng
**scope**: linux-net
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### 场景 (中文转述)
MongoDB 客户端主机在自身也提供 listen socket 服务的混合负载场景(eg. mongos sharding
路由层 + 应用网关同机部署),`net.core.somaxconn` 默认 128 对每个 listen socket 限制
完成三次握手后等待 accept() 的连接数;高并发下 accept 队列溢出 → SYN/ACK 不再 ACK ·
新连接被静默拒绝(取决于 tcp_abort_on_overflow)。

### 推荐
- 值: ``net.core.somaxconn = 65535``
- 层: os-sysctl
- 原文:
  > 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### 机制 / 原因
`somaxconn` 是内核对所有 listen socket 全连接队列(accept queue)的全局上限。应用调
`listen(fd, backlog)` 时,实际 backlog = min(应用传值, somaxconn)。Mongo client 主机
若复合部署 mongos / 应用 listen 服务,128 默认值在突发连接(eg. 上游 LB 切换 / 灰度
发布拨流)极易溢出,握手完成后请求停在 accept 队列等不到 accept() · 表现为客户端
"connection timeout" 而服务端 mongod / 应用进程 CPU 不忙。65535 给出量级缓冲。

### 违反时的风险 (warning)
不调整时,突发并发连接到达后,accept 队列在 128 处溢出,内核丢弃后续 SYN-ACK 已确认连
接 · 客户端表现为 "connect timeout" / SYN 重传 · `netstat -s | grep listen` 出现
`overflowed listen queue` 计数攀升 · 业务请求大面积超时但服务端 CPU/内存均正常。

---

## MongoDB 客户端调小 tcp_fin_timeout 至 30 秒缩短 FIN-WAIT-2 占用

**case_id**: `os-net-tcp-fin-timeout-mongo-client-30s-07`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html) (official)
**平台**: linux-arm64-kunpeng
**scope**: linux-net
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### 场景 (中文转述)
MongoDB 客户端短连接频繁主动 close() 后,连接进入 FIN-WAIT-2 等待对端 FIN。
OS 默认 `net.ipv4.tcp_fin_timeout = 60`(秒)在客户端短连接 + 中间设备/对端不规
范关闭时,大量连接堆积在 FIN-WAIT-2 占用文件描述符与 socket 内存。

### 推荐
- 值: ``net.ipv4.tcp_fin_timeout = 30``
- 层: os-sysctl
- 原文:
  > 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### 机制 / 原因
`tcp_fin_timeout` 控制本端主动 close() 后等待对端 FIN-ACK 的最长时间(状态
FIN-WAIT-2)· 默认 60 秒在大量短连接客户端场景下让 socket 资源长时间占用 FD /
kmem。30 秒在保留一定容错的前提下加快回收。注:本参数原文表 1 描述写"表示如果套
接字由本端要求关闭，这个参数决定了它保持在FIN-WAIT-2状态的时间，默认为2小时"
偏离实际默认值 60s(可能引用旧文档),但推荐值 30 仍然是合理调小方向。

### 违反时的风险 (info)
不调整时,大量短连接 close() 后停留 FIN-WAIT-2 60 秒,占用 FD 与少量 socket 内存
(per-socket ~4-16KB)· 高 QPS 客户端可能触达 ulimit nofile 上限 → `accept: too many
open files` · 但风险量级低于端口耗尽与队列溢出 · 标 info。

---

## 云 LB 后部署 mongod 时 · tcp_keepalive_time 设为 120 秒以避免静默断连

**case_id**: `os-net-tcp-keepalive-time-cloud-lb-120s-01`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (official)
**平台**: bare
**scope**: linux-net
**case_pattern**: parameter-best-practice

### 场景 (原文)
> If the TCP keepalive value is greater than the TCP idle timeout on your cloud provider's load balancer, there is a risk that the system might silently drop connections.

### 场景 (中文转述)
云数据库部署中,mongod / mongos 通常位于云厂商 LB 之后,LB 有空闲连接超时(典型 60-350 秒)。当 OS 默认 `tcp_keepalive_time = 7200` 远大于 LB 超时,LB 在中间静默回收连接,客户端 / mongos 不能感知。

### 推荐
- 值: ``net.ipv4.tcp_keepalive_time = 120``
- 层: os-sysctl
- 原文:
  > To reduce this risk, set tcp_keepalive_time to 120.

### 检测方法
> "sysctl net.ipv4.tcp_keepalive_time"
违规模式: "the TCP keepalive value is greater than the TCP idle timeout on your cloud provider's load balancer"

### 机制 / 原因
LB 在 idle timeout 到期后悄悄回收 TCP 连接,但 OS 侧若 keepalive 探测周期(默认 7200 秒)远大于 LB 超时,客户端就不会主动发探测包,内核也不会发现连接已死,直到下一次写报文才得到 RST/ICMP——此时业务表现为「间歇性慢请求 / connection reset / silently dropped」。把 keepalive 调到 120s(< 大多数 LB 超时)能让 OS 在 LB 回收前就发探测包,保住连接活性。

### 违反时的风险 (warning)
> there is a risk that the system might silently drop connections.
不调整时,云 LB 静默丢连接,客户端 / mongos 看不到中断信号,表现为间歇性请求挂起 / 慢写 / connection reset by peer,业务侧可能误诊为"DB 不稳定"。

---

## MongoDB 客户端调大 tcp_max_syn_backlog 至 8192 防 SYN 队列溢出

**case_id**: `os-net-tcp-max-syn-backlog-mongo-client-8192-05`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html) (official)
**平台**: linux-arm64-kunpeng
**scope**: linux-net
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### 场景 (中文转述)
MongoDB 客户端主机若同时承接业务上游入站连接(eg. mongos 路由层 / 网关同机部署),
新建连接 SYN 流量峰值 > ksoftirqd accept 速率时,半连接队列(SYN queue)溢出。
默认 `net.ipv4.tcp_max_syn_backlog = 1024` 在大促 / 流量切换场景偏小。

### 推荐
- 值: ``net.ipv4.tcp_max_syn_backlog = 8192``
- 层: os-sysctl
- 原文:
  > 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### 机制 / 原因
`tcp_max_syn_backlog` 是 listen socket 半连接队列(SYN_RECV 状态)上限。新连接经过
SYN→SYN-ACK→ACK 三次握手,中间状态在该队列等待。突发 SYN 流量超过队列容量时,内核丢
弃后续 SYN(或回 RST,取决于 tcp_syncookies),client 看到的是 connect timeout。1024 在
现代 burst 场景过紧,8192 给出 8x 缓冲。注意配合 syncookies=1 可在更严重 SYN flood 下
继续服务。

### 违反时的风险 (warning)
不调整时,突发连接(灰度发布 / LB 切流 / 应用重启拨流)新建 SYN 速率超 1024,内核
直接丢 SYN · 客户端 SYN 重传(默认 6 次,~60s 后失败)· 业务表现为大面积"connect
timeout"且服务端 ESTABLISHED 计数远低于实际请求量 · `nstat | grep -i listen` 出现
`ListenDrops` 递增。

---

## MongoDB 客户端调小 tcp_max_tw_buckets 至 3000 加快 TIME-WAIT 强制回收

**case_id**: `os-net-tcp-max-tw-buckets-mongo-client-3000-08`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html) (official)
**平台**: linux-arm64-kunpeng
**scope**: linux-net
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### 场景 (中文转述)
MongoDB 客户端短连接场景下 TIME-WAIT socket 累积。OS 默认
`net.ipv4.tcp_max_tw_buckets = 180000` 偏大,占用大量 socket 控制块内存。在
ip_local_port_range + tcp_tw_reuse 已优化前提下,客户端实际不需要保留这么多
TIME-WAIT bucket。

### 推荐
- 值: ``net.ipv4.tcp_max_tw_buckets = 3000``
- 层: os-sysctl
- 原文:
  > 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### 机制 / 原因
`tcp_max_tw_buckets` 是系统同时持有 TIME-WAIT 状态 socket 的硬上限。超过后内核直接
销毁最老的 TIME-WAIT(`TCP: time wait bucket table overflow` 内核日志)· 跳过 2*MSL
等待。客户端配合 `tcp_tw_reuse=1` 已能复用 TIME-WAIT 端口建立新连接,把 bucket 上限
从 180000 收紧到 3000,主动让超出部分跳过 2MSL → 节省 ~177000 * 个 sock 控制块
内存(~每个 ~600B,合计 ~100MB),并加速端口流转。注:tcp_max_tw_buckets 跳过 2MSL
理论上有报文回绕风险,但配合 timestamp 选项(默认开启)可消除。

### 违反时的风险 (info)
不调整时,客户端 TIME-WAIT bucket 默认上限 180000 占用 ~100MB 内核内存,且
TIME-WAIT 数量长时间维持在高位影响 `ss -s` 统计可读性 · 但实际不构成性能瓶颈
(只是资源利用率低)· 标 info。

---

## MongoDB 客户端启用 tcp_tw_reuse 让 TIME-WAIT socket 可复用以新建连接

**case_id**: `os-net-tcp-tw-reuse-enable-mongo-client-02`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html) (official)
**平台**: linux-arm64-kunpeng
**scope**: linux-net
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### 场景 (中文转述)
MongoDB 客户端在高 QPS 短连接场景(典型如批处理 ETL / 网关型微服务)下,client side TCP
进入大量 TIME-WAIT 状态。OS 默认 `net.ipv4.tcp_tw_reuse = 0` 禁止复用 TIME-WAIT 端口,
端口资源被冻结 60 秒,加重 ip_local_port_range 端口压力。

### 推荐
- 值: ``net.ipv4.tcp_tw_reuse = 1``
- 层: os-sysctl
- 原文:
  > 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### 机制 / 原因
`tcp_tw_reuse=1` 允许内核在 4-tuple 不冲突的前提下复用 TIME-WAIT 状态的 source port
建立新连接(依赖 timestamp 选项 RFC 7323 防陈旧报文回绕)。客户端短连接场景下,TIME-WAIT
本就是因正常 close() 累积,reuse 不引入语义错误。开启后,端口流转速度从"60s 后释放"
变为"立即可复用",显著缓解端口耗尽。

### 违反时的风险 (warning)
不开启时,客户端 60s 内无法复用 TIME-WAIT 端口 → 端口池实际可用容量缩水到原值的
1/N(N 取决于 QPS 与 close 速率)→ 高峰期端口耗尽,出现 `EADDRNOTAVAIL`,业务侧大量
连接失败、driver 重试风暴、应用线程阻塞在 `connect()`。

---

## Linux ulimit nofile: raise open-file descriptor limit for high-connection MongoDB servers

**case_id**: `os-ulimit-nofile-high-conn-01`
**来源**: [https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections](https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections) (official)
**平台**: linux-x86_64-generic
**scope**: linux-net
**case_pattern**: parameter-best-practice

### 场景 (原文)
> RHEL ships with default ulimit and other configurations that are appropriate for your laptop, and to really get the full performance of a large production server you need to do a lot of tuning to increase various limits and buffers.

### 场景 (中文转述)
在运行 MongoDB 的大型生产 Linux 服务器上（尤其是 RHEL / CentOS / Amazon Linux 系列），操作系统默认的 `nofile`（文件描述符数）ulimit 面向桌面场景，每个 TCP/IP 连接占用一个文件描述符，高并发连接数下极易触及上限，需显式调高。

### 推荐
- 值: ``nofile = 9999999``
- 层: os-sysctl
- 原文:
  > echo "ec2-user soft nofile 9999999" | sudo tee -a /etc/security/limits.conf

### 机制 / 原因
> TCP/IP connections are open files as far as ulimit is concerned.
Linux 将每个 TCP/IP 连接视为一个打开的文件，受进程的文件描述符数量上限（`nofile`）约束。MongoDB 高连接数场景下，进程的文件描述符消耗量与连接数成正比，若不调高 `nofile`，超出默认上限后新连接将无法建立。

### 违反时的风险 (critical)
若不调高 `nofile`，当 MongoDB 进程打开的文件描述符数量超过系统默认上限时，新 TCP 连接建立将返回 "Too many open files" 错误，MongoDB 将无法接受超限的并发连接请求。

---
