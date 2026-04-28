# os-diagnostic-flow-diagnostic-flow

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 16 条 case。

---

## 鲲鹏服务器网卡中断未绑核(irqbalance 在线/中断分散到非本地 CPU)

**case_id**: `kunpeng-net-irq-not-bound-irqbalance-on-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0013.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0013.html) (unknown)
**平台**: linux-x86_64-generic
**case_pattern**: parameter-audit
**source_heading**: 网卡中断绑核

**engine**: linux-os
**symptom_category**: network-latency

### 症状 (原文)
> 手动绑定网卡中断，根据网卡所属CPU将其进行分配，从而优化系统网络性能。

**症状关键词**: irqbalance / smp_affinity_list / /proc/interrupts / 网卡中断 / 鲲鹏 920 / 5250 / TM280

### 诊断步骤
#### Step 1: 查看 irqbalance 服务当前状态
- metric: `systemd.unit.irqbalance.service.active_state`
- 采集层: os
- 异常模式: > "状态为inactive即为关闭。"
- 阈值: `active_state ≠ "inactive" (i.e. running)`

#### Step 2: 查看网卡中断 smp_affinity 是否已绑定到本地 NUMA CPU
- metric: `proc.interrupts.smp_affinity_list`
- 采集层: os
- 异常模式: > "对于不同的硬件配置，用于绑中断的最佳CPU数目会有差异，比如对于鲲鹏920 5250处理器 + Huawei TM280 25G网卡（鲲鹏服务器的板载网卡）来说，最多可以绑定32个中断队列，建议将所有的队列都用在中断绑定上来获得最佳性能。"
- 阈值: `smp_affinity_list of NIC IRQs spans cores NOT on NIC's local NUMA node`

### possible 根因 (参数类)
#### Cause 1: irqbalance 在线导致中断动态飘移到非本地 NUMA CPU
- param: `systemd.unit.irqbalance.service`
- 异常值模式: `state = active (running)`
- 原文: > "进行网卡中断绑核之前，需要先关闭irqbalance。"

#### Cause 2: 网卡中断 smp_affinity 未手动绑定
- param: `proc.irq.<N>.smp_affinity_list`
- 异常值模式: `smp_affinity_list NOT on NIC local NUMA cores`
- 原文: > "手动绑定网卡中断，根据网卡所属CPU将其进行分配，从而优化系统网络性能。"

---

## KVM Host 未分配大页(虚拟机 TLB Miss / 内存访问密集业务下降)

**case_id**: `kvm-host-hugepages-not-allocated-tlb-miss-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0021.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0021.html) (unknown)
**平台**: linux-x86_64-generic
**case_pattern**: parameter-audit
**source_heading**: 虚拟机使用内存大页

**engine**: linux-os
**symptom_category**: memory-pressure

### 症状 (原文)
> 使用内存大页能保证虚拟机的所有内存在Host上始终以大页形式存在，并且保证物理连续，可以有效地减少TLB Miss，显著提升内存访问密集型业务的性能。

**症状关键词**: hugepages / HugePages / TLB Miss / default_hugepagesz / memoryBacking / /sys/devices/system/node/node*/meminfo

### 诊断步骤
#### Step 1: 在 Host 侧查看各 NUMA 节点大页分配情况
- metric: `sys.node.meminfo.hugepages`
- 采集层: os
- 异常模式: > "如果HugePages显示信息为0，说明此时系统没有配置内存大页。"
- 阈值: `HugePages_Total = 0 on any NUMA node`

### possible 根因 (参数类)
#### Cause 1: Host /etc/grub2-efi.cfg 未配 default_hugepagesz/hugepagesz/hugepages
- param: `grub.linux.default_hugepagesz`
- 异常值模式: `kernel cmdline NOT contain "default_hugepagesz" AND HugePages_Total = 0`
- 原文: > "使用内存大页能保证虚拟机的所有内存在Host上始终以大页形式存在，并且保证物理连续，可以有效地减少TLB Miss，显著提升内存访问密集型业务的性能。"

#### Cause 2: 虚拟机 xml 缺 `<memoryBacking><hugepages/></memoryBacking>`
- param: `libvirt.domain.memoryBacking.hugepages`
- 异常值模式: `domain xml does NOT contain <hugepages/>`
- 原文: > "虚拟机配置大页内存。虚拟机xml文件的配置参考如下。"

---

## KVM 虚拟机 vCPU 未绑核(跨 NUMA / 跨 DIE 切换)

**case_id**: `kvm-vcpupin-not-bound-numa-cross-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0019.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0019.html) (unknown)
**平台**: linux-x86_64-generic
**case_pattern**: parameter-audit
**source_heading**: 虚拟机绑核

**engine**: linux-os
**symptom_category**: cpu-high

### 症状 (原文)
> 虚拟机绑核可以有效地减少操作系统的上下文切换和负载均衡的开销，从而提高程序的执行效率。

**症状关键词**: vcpupin / cpuset / emulatorpin / vcpu placement / KVM / 跨 NUMA / 跨 DIE

### 诊断步骤
#### Step 1: 读取虚拟机 xml 当前 vcpupin/cputune 配置
- metric: `libvirt.domain.cputune.vcpupin`
- 采集层: os
- 异常模式: > "若不配置此参数，虚拟机任务线程会在CPU任意core上浮动，会存在更多的跨NUMA和跨DIE损耗。"
- 阈值: `xml does NOT contain <cputune><vcpupin .../></cputune> AND <vcpu placement='static' cpuset=...>`

### possible 根因 (参数类)
#### Cause 1: KVM 虚拟机 xml 缺 vcpupin 配置 → vCPU 漂移
- param: `libvirt.domain.cputune.vcpupin`
- 异常值模式: `<vcpupin> 节点缺失`
- 原文: > "vcpupin用于限制对CPU线程做虚拟机和物理机的一对一绑核。若不使用vcpupin绑CPU线程，则线程会在4～7这个4个核之间切换，造成额外开销。"

---

## I/O 调度器与磁盘类型/业务模式不匹配（HDD 数据库使用 CFQ；SSD 未用 NOOP）

**case_id**: `linux-block-scheduler-mismatch-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0040.html](https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0040.html) (unknown)
**平台**: linux-x86_64-generic
**case_pattern**: core-perf-diagnosis
**source_heading**: 优化磁盘I/O调度方式

**engine**: linux-os
**symptom_category**: disk-io-saturation

### 症状 (原文)
> 这个算法在I/O压力大，且I/O主要集中在某几个进程的时候，性能不太友好。

**症状关键词**: I/O调度器 / CFQ / Deadline / NOOP / scheduler / HDD / SSD

### 诊断步骤
#### Step 1: 读取当前块设备 I/O 调度模式
- metric: `block device I/O scheduler`
- 采集层: os
- 异常模式: > "[]中为当前使用的磁盘I/O调度模式。"
- 阈值: 当前调度器（[]中标识） ≠ 业务推荐值（HDD 数据库→deadline / SSD→noop）

### possible 根因 (参数类)
#### Cause 1: HDD + 数据库/大数据业务仍用默认 CFQ
- param: `/sys/block/$DEVICE-NAME/queue/scheduler`
- 异常值模式: cfq（默认）∧ 磁盘类型=HDD ∧ 业务=数据库/大数据（I/O 集中型）
- 原文: > "适合I/O压力大且I/O集中在某几个进程的场景，比如大数据、数据库使用HDD磁盘的场景。"

#### Cause 2: SSD 未配置为 noop 调度器
- param: `/sys/block/$DEVICE-NAME/queue/scheduler`
- 异常值模式: cfq / deadline ∧ 磁盘类型=SSD
- 原文: > "因为固态硬盘支持随机读写，所以固态硬盘可以选择这种最简单的调度策略，性能最好。"

---

## 块设备 nr_requests 队列长度偏小(限制磁盘吞吐)

**case_id**: `linux-blockdev-nr-requests-too-low-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0018.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0018.html) (unknown)
**平台**: linux-x86_64-generic
**case_pattern**: parameter-audit
**source_heading**: IO参数调优

**engine**: linux-os
**symptom_category**: disk-io-saturation

### 症状 (原文)
> 提升磁盘吞吐量，可以调整到更大。

**症状关键词**: nr_requests / /sys/block / queue / IO 请求队列

### 诊断步骤
#### Step 1: 读取 /sys/block/<device>/queue/nr_requests 当前值
- metric: `blockdev.queue.nr_requests`
- 采集层: os
- 异常模式: > "将指定设备的IO请求队列长度设置为“2048”。"
- 阈值: `current < 2048 (recommended)`

### possible 根因 (参数类)
#### Cause 1: nr_requests 小于 2048
- param: `/sys/block/${device}/queue/nr_requests`
- 异常值模式: `current < 2048 (most distros default = 128/256)`
- 原文: > "提升磁盘吞吐量，可以调整到更大。"

---

## 带电池 RAID 卡环境未使用 nobarrier 挂载选项

**case_id**: `linux-fs-mount-nobarrier-audit-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0041.html](https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0041.html) (unknown)
**平台**: linux-x86_64-generic
**case_pattern**: parameter-audit
**source_heading**: 磁盘挂载方式优化nobarrier原理

**engine**: linux-os
**symptom_category**: disk-io-saturation

### 症状 (原文)
> Barrier（栅栏），即先加一个栅栏，保证日志总是先写入，然后对应数据才刷新到磁盘，这种方式保证了系统崩溃后磁盘恢复的正确性，但对写入性能有影响。

**症状关键词**: nobarrier / barrier / 日志文件系统 / RAID 卡 / 电池

### 诊断步骤
#### Step 1: 读取当前文件系统挂载选项
- metric: `mount options for filesystem`
- 采集层: os
- 异常模式: > "服务器如果采用了RAID卡，并且RAID本身有电池，或者采用其它保护方案，那么就可以避免异常断电后日志的丢失，我们就可以关闭这个栅栏"
- 阈值: 挂载未含 nobarrier ∧ RAID 卡有电池

### possible 根因 (参数类)
#### Cause 1: 带电池 RAID 卡环境仍使用默认 barrier 挂载
- param: `mount option · barrier / nobarrier`
- 异常值模式: barrier (默认) ∧ RAID 有电池保护
- 原文: > "nobarrier参数使得系统在异常断电时无法确保文件系统日志已经写入磁盘介质，因此只适用于使用了带有保护的RAID卡的情况。"

---

## 大文件场景未选用 XFS 文件系统或 blocksize 仍为默认 4KB

**case_id**: `linux-fs-xfs-blocksize-audit-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0041.html](https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0041.html) (unknown)
**平台**: linux-x86_64-generic
**case_pattern**: parameter-audit
**source_heading**: 选用性能更优的文件系统XFS原理

**engine**: linux-os
**symptom_category**: disk-io-saturation

### 症状 (原文)
> XFS是一种高性能的日志文件系统，XFS极具伸缩性，非常健壮，特别擅长处理大文件，同时提供平滑的数据传输。

**症状关键词**: XFS / blocksize / mkfs.xfs / 大文件 / ext4

### 诊断步骤
#### Step 1: 读取当前文件系统类型 + blocksize
- metric: `filesystem type + blocksize`
- 采集层: os
- 异常模式: > "XFS文件系统在创建时，可先选择加大文件系统的block，更加适用于大文件的操作场景。"
- 阈值: filesystem ≠ xfs ∧ workload=大文件 ∨ blocksize=4096 ∧ workload=大文件

### possible 根因 (参数类)
#### Cause 1: 大文件场景仍用 ext4 等非 XFS 文件系统
- param: `filesystem type (mkfs.xfs vs mkfs.ext4)`
- 异常值模式: ext4 / 其他 ∧ workload=大文件
- 原文: > "XFS是一种高性能的日志文件系统，XFS极具伸缩性，非常健壮，特别擅长处理大文件，同时提供平滑的数据传输。"

#### Cause 2: XFS blocksize 仍为默认 4KB（4096B）
- param: `mkfs.xfs -b size=`
- 异常值模式: 4096 (默认) ∧ workload=大文件
- 原文: > "指定blocksize，默认情况下为4KB（4096B），我们假设在格式化时指定为8192B"

---

## 网卡中断聚合参数（ethtool -C）未按业务调优

**case_id**: `linux-nic-interrupt-coalescing-audit-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0027.html](https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0027.html) (unknown)
**平台**: linux-x86_64-generic
**case_pattern**: parameter-audit
**source_heading**: 中断聚合参数调整

**engine**: linux-os
**symptom_category**: network-latency

### 症状 (原文)
> 中断聚合特性允许网卡收到报文之后不立即产生中断，而是等待一小段时间有更多的报文到达之后再产生中断，这样就能让CPU一次中断处理多个报文，减少开销。

**症状关键词**: 中断聚合 / ethtool / rx-usecs / tx-usecs / rx-frames / tx-frames / Adaptive RX

### 诊断步骤
#### Step 1: 读取网卡当前中断聚合参数
- metric: `NIC interrupt coalescing settings (rx/tx-usecs, rx/tx-frames, adaptive-rx/tx)`
- 采集层: os
- 异常模式: > "为了确保使用静态值，需禁用自适应调节，关闭Adaptive RX和Adaptive TX。"
- 阈值: (定性) Adaptive RX/TX = on ∧ 业务对延迟/吞吐有明确诉求

### possible 根因 (参数类)
#### Cause 1: 自适应中断聚合开启导致聚合度不可控
- param: `ethtool -C $eth adaptive-rx / adaptive-tx`
- 异常值模式: adaptive-rx=on / adaptive-tx=on (默认)
- 原文: > "为了确保使用静态值，需禁用自适应调节，关闭Adaptive RX和Adaptive TX。"

#### Cause 2: 静态聚合参数过大导致单包延迟增加
- param: `ethtool -C $eth rx-usecs / tx-usecs / rx-frames / tx-frames`
- 异常值模式: N 取过大值
- 原文: > "当增大聚合度时，单个数据包的延时会以微秒的级别增加。"

---

## 块设备 read-ahead 默认 128KB 浪费 MongoDB 文件系统缓存

**case_id**: `linux-readahead-default-128kb-wastes-fs-cache-04`
**来源**: [https://www.percona.com/blog/tuning-linux-for-mongodb/](https://www.percona.com/blog/tuning-linux-for-mongodb/) (unknown)
**平台**: linux-x86_64-generic
**case_pattern**: core-perf-diagnosis
**source_heading**: Read-Ahead

**engine**: linux-os
**symptom_category**: memory-pressure

### 症状 (原文)
> MongoDB tends to have very random disk patterns and often does not benefit from the default read-ahead setting, wasting memory that could be used for more hot data. Most Linux systems have a default setting of 128KB/256 sectors (128KB = 256 x 512-byte sectors). This means if MongoDB fetches a 64kb document from disk, 128kb of filesystem cache is used and maybe the extra 64kb is never accessed later, wasting memory.

**症状关键词**: read-ahead / blockdev --getra / filesystem cache / random disk pattern / 128KB

### 诊断步骤
#### Step 1: 读 read-ahead 当前值
- metric: `block device read_ahead_kb / sectors`
- 采集层: os
- 异常模式: > "Most Linux systems have a default setting of 128KB/256 sectors (128KB = 256 x 512-byte sectors)."
- 阈值: 默认 256 扇区(=128KB),建议 32 扇区(=16KB)

### possible 根因 (参数类)
#### Cause 1: read_ahead_kb / 扇区数过大
- param: `block device queue/read_ahead_kb(udev ATTR{bdi/read_ahead_kb})`
- 异常值模式: 默认 128(=256 扇区),建议 16(=32 扇区)
- 原文: > "For this setting, we suggest a starting-point of 32 sectors (=16KB) for most MongoDB workloads. From there you can test increasing/reducing this setting and then monitor a combination of query performance, cached memory usage, and disk read activity to find a better balance."

### possible 根因 (非参数类)
#### Cause 1: MongoDB 应用层访问模式偏随机
- type: application-design
- 原文: > "MongoDB tends to have very random disk patterns and often does not benefit from the default read-ahead setting, wasting memory that could be used for more hot data."
- 缓解: > "ACTION==\"add

---

## 单队列网卡软中断集中单 core 形成性能瓶颈（未启用 RPS）

**case_id**: `linux-rps-single-queue-nic-softirq-bottleneck-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0030.html](https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0030.html) (unknown)
**平台**: linux-x86_64-generic
**case_pattern**: core-perf-diagnosis
**source_heading**: 单队列网卡中断散列

**engine**: linux-os
**symptom_category**: network-latency

### 症状 (原文)
> 对单队列网卡可以使用RPS将中断分散到各个core处理，避免软中断集中到一个core导致该core软中断过高形成性能瓶颈。

**症状关键词**: RPS / Receive Packet Steering / 单队列网卡 / 软中断 / rps_cpus / rps_flow_cnt

### 诊断步骤
#### Step 1: 读取 RPS 当前配置（rps_cpus / rps_flow_cnt / rps_sock_flow_entries）
- metric: `RPS configuration (rps_cpus mask, flow tables)`
- 采集层: os
- 异常模式: > "避免软中断集中到一个core导致该core软中断过高形成性能瓶颈。"
- 阈值: rps_cpus = 0（所有 bits 全 0 表示 RPS 未启用，软中断集中到默认 core）

### possible 根因 (参数类)
#### Cause 1: RPS 未启用（rps_cpus=0）
- param: `/sys/class/net/$nic/queues/rx-0/rps_cpus`
- 异常值模式: 0（默认值，全 0 bitmask 表示未启用 RPS）
- 原文: > "对单队列网卡可以使用RPS将中断分散到各个core处理"

#### Cause 2: rps_flow_cnt / rps_sock_flow_entries 未配置
- param: `/sys/class/net/$nic/queues/rx-0/rps_flow_cnt + /proc/sys/net/core/rps_sock_flow_entries`
- 异常值模式: 都为 0（默认）
- 原文: > "将并发活动连接的最大预期数目设置为32768，因为这是Linux官方的内核推荐值。"

### possible 根因 (非参数类)
#### Cause 1: 网卡硬件不支持多队列（设计限制）
- type: hardware-network
- 原文: > "RPS采用软件模拟的方式，实现了多队列网卡所提供的功能，分散了在多CPU系统上数据接收时的负载，把软中断分到各个CPU处理，而不需要硬件支持"
- 缓解: > "#echo ff > /sys/class/net/eth0/queues/rx-0/rps_cpus"

---

## Transparent HugePages 在 MongoDB 稀疏内存访问场景下产生开销

**case_id**: `linux-thp-mongodb-sparse-memory-access-02`
**来源**: [https://www.percona.com/blog/tuning-linux-for-mongodb/](https://www.percona.com/blog/tuning-linux-for-mongodb/) (unknown)
**平台**: linux-x86_64-generic
**case_pattern**: core-perf-diagnosis
**source_heading**: Transparent HugePages

**engine**: linux-os
**symptom_category**: memory-pressure

### 症状 (原文)
> Transparent HugePages is an optimization introduced in CentOS/RedHat 6.0, with the goal of reducing overhead on systems with large amounts of memory. However, due to the way MongoDB uses memory, this feature actually does more harm than good as memory access are rarely contiguous.

**症状关键词**: transparent_hugepage / THP / sparse memory access / MongoDB / rarely contiguous

### 诊断步骤
#### Step 1: 读 THP 启动参数
- metric: `kernel boot option transparent_hugepage`
- 采集层: os
- 异常模式: > "due to the way MongoDB uses memory, this feature actually does more harm than good as memory access are rarely contiguous."
- 阈值: (Pre-8.0 视角)/sys/kernel/mm/transparent_hugepage/enabled 当前不为 `never`

### possible 根因 (参数类)
#### Cause 1: transparent_hugepage 未禁用(legacy guidance)
- param: `kernel.transparent_hugepage`
- 异常值模式: always 或 madvise(非 never)
- 原文: > "due to the way MongoDB uses memory, this feature actually does more harm than good as memory access are rarely contiguous."

### possible 根因 (非参数类)
#### Cause 1: MongoDB 内存访问稀疏的应用层特性
- type: application-design
- 原文: > "due to the way MongoDB uses memory, this feature actually does more harm than good as memory access are rarely contiguous."
- 缓解: > "transparent_hugepage=never"

---

## 脏页刷盘策略不当导致突发 I/O 等待与文件读写阻塞

**case_id**: `linux-vm-dirty-flush-burst-io-wait-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0037.html](https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0037.html) (unknown)
**平台**: linux-x86_64-generic
**case_pattern**: core-perf-diagnosis
**source_heading**: 调整脏数据刷新策略，减小磁盘的I/O压力

**engine**: linux-os
**symptom_category**: disk-io-saturation

### 症状 (原文)
> 此参数的默认值为40，对于写入为主的业务，可以增加此参数，避免磁盘过早的进入到同步写状态。

**症状关键词**: dirty_expire_centisecs / dirty_background_ratio / dirty_ratio / PageCache / 脏页 / await / 同步写

### 诊断步骤
#### Step 1: iostat 观察磁盘 await 时间波动 + 读取 dirty_* 三参数当前值
- metric: `disk await time + vm dirty params`
- 采集层: os
- 异常模式: > "文件读写变为同步模式后，应用程序的文件读写操作的阻塞时间变长，会导致系统性能下降。"
- 阈值: (定性) await 突发性飙升 ∨ dirty_ratio 触发同步写

### possible 根因 (参数类)
#### Cause 1: dirty_expire_centisecs 过大 → 脏数据集中老化引发突发 I/O
- param: `/proc/sys/vm/dirty_expire_centisecs`
- 异常值模式: 默认 3000（30s）— 写入连续场景
- 原文: > "如果业务的数据是连续性的写，可以适当调小此参数，这样可以避免I/O集中，导致突发的I/O等待。"

#### Cause 2: dirty_background_ratio 过大导致回写不及时数据积压
- param: `/proc/sys/vm/dirty_background_ratio`
- 异常值模式: 默认 10 — 写入为主业务可调小
- 原文: > "但对于磁盘写入操作为主的业务，可以调小这个值，避免数据积压太多最后成为瓶颈"

#### Cause 3: dirty_ratio 过小导致过早进入同步写
- param: `/proc/sys/vm/dirty_ratio`
- 异常值模式: 默认 40 — 写入为主业务可适当增大
- 原文: > "为脏页面占用总内存最大的比例，超过这个值，系统不会新增加脏页面，文件读写也变为同步模式。"

### possible 根因 (非参数类)
#### Cause 1: 应用未使用 O_DIRECT 写关键数据，依赖 PageCache 增加同步写风险
- type: application-design
- 原文: > "对于需要立即存盘的数据，应该采用O_DIRECT模式避免关键数据的丢失。"

---

## dirty_ratio 默认 20-30% 在大内存机上累积巨量脏页,触发同步 flush 卡顿

**case_id**: `linux-vm-dirty-ratio-pause-on-large-memory-01`
**来源**: [https://www.percona.com/blog/tuning-linux-for-mongodb/](https://www.percona.com/blog/tuning-linux-for-mongodb/) (unknown)
**平台**: linux-x86_64-generic
**case_pattern**: core-perf-diagnosis
**source_heading**: Virtual Memory · Dirty Ratio

**engine**: linux-os
**symptom_category**: disk-io-saturation

### 症状 (原文)
> The “dirty_ratio” is the percentage of total system memory that can hold dirty pages. The default on most Linux hosts is between 20-30%. When you exceed the limit the dirty pages are committed to disk, creating a small pause.

**症状关键词**: vm.dirty_ratio / vm.dirty_background_ratio / dirty pages / pause / large memory

### 诊断步骤
#### Step 1: 读 dirty 比例当前值
- metric: `vm.dirty_ratio / vm.dirty_background_ratio`
- 采集层: os
- 异常模式: > "on large-memory database servers, this can be a lot of memory! For example, on a 128GB-memory host, this can allow up to 38.4GB of dirty pages. The background ratio won’t kick in until 12.8GB!"
- 阈值: dirty_ratio 默认 20-30% 且物理内存 ≥ 64GB

### possible 根因 (参数类)
#### Cause 1: 大内存机 dirty_ratio 默认值过高
- param: `vm.dirty_ratio / vm.dirty_background_ratio`
- 异常值模式: dirty_ratio = 20-30(默认) · dirty_background_ratio = 10-15(默认)
- 原文: > "A recommended setting for dirty ratios on large-memory (64GB+ perhaps) database servers is: “vm.dirty_ratio = 15″ and “vm.dirty_background_ratio = 5″, or possibly less. (Red Hat recommends lower ratios of 10 and 3 for high-performance/large-memory servers.)"

### possible 根因 (非参数类)
#### Cause 1: 一次性大批量落盘吞吐反不如分批
- type: application-design
- 原文: > "Reducing caches sizes also guarantees data gets written to disk in smaller batches more frequently, which increases disk throughput (than huge bulk writes less often)."
- 缓解: > "vm.dirty_ratio = 15<br>vm.dirty_background_ratio = 5"

---

## MongoDB 客户端侧 OS 层 TCP 参数审计 (8 条 sysctl)

**case_id**: `mongo-client-os-tcp-tuning-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html) (unknown)
**平台**: linux-x86_64-generic
**case_pattern**: parameter-audit
**source_heading**: 客户端优化

**engine**: linux-os
**symptom_category**: network-latency

### 症状 (原文)
> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

**症状关键词**: ip_local_port_range / tcp_tw_reuse / somaxconn / netdev_max_backlog / tcp_max_syn_backlog / tcp_keepalive_time / tcp_fin_timeout / tcp_max_tw_buckets

### 诊断步骤
#### Step 1: 读取 8 个 TCP 客户端参数当前值
- metric: `sysctl.net.* (8 keys)`
- 采集层: os
- 异常模式: > "允许将TIME-WAIT sockets重新用于新的TCP连接。"
- 阈值: `current value ≠ recommended value (per-key)`

### possible 根因 (参数类)
#### Cause 1: ip_local_port_range 偏窄
- param: `net.ipv4.ip_local_port_range`
- 异常值模式: `range narrower than "1024 65535"`
- 原文: > "用于向外连接的端口范围。"

#### Cause 2: tcp_tw_reuse 关闭
- param: `net.ipv4.tcp_tw_reuse`
- 异常值模式: `current = 0 (closed) ≠ 1 (recommended)`
- 原文: > "允许将TIME-WAIT sockets重新用于新的TCP连接。"

#### Cause 3: somaxconn 偏小
- param: `net.core.somaxconn`
- 异常值模式: `current = 128 (default) < 65535 (recommended)`
- 原文: > "定义了系统中每一个端口最大的监测队列的长度，这是个全局的参数，默认值为128。"

#### Cause 4: netdev_max_backlog 偏小
- param: `net.core.netdev_max_backlog`
- 异常值模式: `current < 8096 (recommended)`
- 原文: > "每个网络接口接收数据包的速率比内核处理这些包的速率快时，允许送到队列的数据包的最大数目。"

#### Cause 5: tcp_max_syn_backlog 偏小
- param: `net.ipv4.tcp_max_syn_backlog`
- 异常值模式: `current = 1024 (default) < 8192 (recommended)`
- 原文: > "表示那些尚未收到客户端确认信息的连接（SYN消息）队列的长度，默认为1024，加大队列长度为262144，可以容纳更多等待连接的网络连接数。"

#### Cause 6: tcp_keepalive_time 过长
- param: `net.ipv4.tcp_keepalive_time`
- 异常值模式: `current = 7200 (default 2h) ≠ 600 (recommended)`
- 原文: > "表示如果套接字由本端要求关闭，这个参数决定了它保持在FIN-WAIT-2状态的时间，默认为2小时。"

#### Cause 7: tcp_fin_timeout 过长
- param: `net.ipv4.tcp_fin_timeout`
- 异常值模式: `current = 0 (closed quick recycle) ≠ 30 (recommended)`
- 原文: > "表示开启TCP连接中TIME-WAIT sockets的快速回收，默认为0，表示关闭。"

#### Cause 8: tcp_max_tw_buckets 偏大(被动客户端侧建议下调)
- param: `net.ipv4.tcp_max_tw_buckets`
- 异常值模式: `current = 180000 (default) ≠ 3000 (recommended for client)`
- 原文: > "表示系统同时保持TIME_WAIT sockets的最大数量，默认为180000。"

---

## XFS mount 未加 noatime/nobarrier 导致文件系统冗余开销

**case_id**: `mongo-fs-mount-noatime-nobarrier-missing-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0006.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0006.html) (unknown)
**平台**: linux-x86_64-generic
**case_pattern**: parameter-audit
**source_heading**: 文件系统调优

**engine**: linux-os
**symptom_category**: disk-io-saturation

### 症状 (原文)
> 通常情况下，我们对文件的操作更多是读取而不是写入，而且我们很少需要关注一个文件最近被访问的时间。因此，我们建议使用noatime选项，这样文件系统在程序访问文件或文件夹时，不会更新对应的访问时间。文件系统不再记录访问时间，可以避免不必要的资源浪费。

**症状关键词**: noatime / nobarrier / XFS / mount / access time / write barriers

### 诊断步骤
#### Step 1: 读取数据盘当前 mount 选项
- metric: `mount.options`
- 采集层: os
- 异常模式: > "建议在文件系统的mount参数上加上noatime、nobarrier两个选项，其中数据盘以及数据目录以实际为准。"
- 阈值: `mount options does NOT contain "noatime" OR does NOT contain "nobarrier" (XFS only)`

### possible 根因 (参数类)
#### Cause 1: 数据盘 mount 选项未加 noatime
- param: `mount.options.noatime`
- 异常值模式: `noatime not in mount options`
- 原文: > "通常情况下，我们对文件的操作更多是读取而不是写入，而且我们很少需要关注一个文件最近被访问的时间。因此，我们建议使用noatime选项，这样文件系统在程序访问文件或文件夹时，不会更新对应的访问时间。文件系统不再记录访问时间，可以避免不必要的资源浪费。"

#### Cause 2: XFS mount 未加 nobarrier(开启 write barriers)
- param: `mount.options.nobarrier`
- 异常值模式: `nobarrier not in mount options (XFS only) AND storage backend has battery-backed cache (RAID/Flash)`
- 原文: > "在这种情况下，我们可以安全地使用nobarrier挂载文件系统，以避免write barriers的性能损失。对于ext3、ext4和reiserfs文件系统可以在mount时指定barrier=0。对于XFS可以指定nobarrier选项。"

---

## OS 层 TCP 协议栈参数审计 (7 条 sysctl)

**case_id**: `mongo-os-tcp-stack-tuning-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0010.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0010.html) (unknown)
**平台**: linux-x86_64-generic
**case_pattern**: parameter-audit
**source_heading**: 网络参数调优

**engine**: linux-os
**symptom_category**: network-latency

### 症状 (原文)
> 对于不同的操作系统，通过在OS层面调整网络参数的配置，可以有效提升服务器性能。

**症状关键词**: tcp_max_syn_backlog / somaxconn / rmem_max / wmem_max / tcp_rmem / tcp_wmem / tcp_max_tw_buckets

### 诊断步骤
#### Step 1: 读取 7 个 TCP 协议栈参数当前值
- metric: `sysctl.net.* (7 keys)`
- 采集层: os
- 异常模式: > "tcp_max_syn_backlog是指定所能接收SYN同步包的最大客户端数量。"
- 阈值: `current value < recommended value (per-key)`

### possible 根因 (参数类)
#### Cause 1: tcp_max_syn_backlog 偏小
- param: `net.ipv4.tcp_max_syn_backlog`
- 异常值模式: `current = 2048 (default) < 8192 (recommended)`
- 原文: > "tcp_max_syn_backlog是指定所能接收SYN同步包的最大客户端数量。"

#### Cause 2: somaxconn 偏小
- param: `net.core.somaxconn`
- 异常值模式: `current = 128 (default) < 1024 (recommended)`
- 原文: > "服务端所能accept即处理数据的最大客户端数量，即完成连接上限。"

#### Cause 3: rmem_max 偏小
- param: `net.core.rmem_max`
- 异常值模式: `current = 229376 (default) < 16777216 (recommended)`
- 原文: > "接收套接字缓冲区大小的最大值。单位为字节。"

#### Cause 4: wmem_max 偏小
- param: `net.core.wmem_max`
- 异常值模式: `current = 229376 (default) < 16777216 (recommended)`
- 原文: > "发送套接字缓冲区大小的最大值。单位为字节。"

#### Cause 5: tcp_rmem 第三值偏小
- param: `net.ipv4.tcp_rmem`
- 异常值模式: `current = "4096 87380 6291456" (default) · 第三值 < 16777216 (recommended)`
- 原文: > "配置读缓冲区的大小，共三个值，第一个是这个读缓冲区的最小值，第三个是最大值，中间的是默认值。"

#### Cause 6: tcp_wmem 第三值偏小
- param: `net.ipv4.tcp_wmem`
- 异常值模式: `current = "4096 16384 4194304" (default) · 第三值 < 16777216 (recommended)`
- 原文: > "配置写缓冲区的大小，共三个值，第一个是这个写缓冲区的最小值，第三个是最大值，中间的是默认值。"

#### Cause 7: tcp_max_tw_buckets 偏小
- param: `net.ipv4.tcp_max_tw_buckets`
- 异常值模式: `current = 262144 (default) < 360000 (recommended)`
- 原文: > "表示系统同时保持TIME_WAIT套接字的最大数量。"

---
