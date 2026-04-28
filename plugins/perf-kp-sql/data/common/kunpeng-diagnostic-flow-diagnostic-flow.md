# kunpeng-diagnostic-flow-diagnostic-flow

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 9 条 case。

---

## 自旋锁/CAS 失败循环导致 CPU 资源浪费（perf top 锁函数占比 ≥ 5%）

**case_id**: `kunpeng-arm64-spinlock-cas-cpu-waste-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0050.html](https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0050.html) (unknown)
**平台**: linux-arm64-kunpeng
**case_pattern**: core-perf-diagnosis
**source_heading**: 锁优化

**engine**: kunpeng-platform
**symptom_category**: cpu-high

### 症状 (原文)
> 自旋锁和CAS指令都是基于原子操作指令实现，当应用程序在执行原子操作失败后，并不会释放CPU资源，而是一直循环运行直到原子操作执行成功为止，导致CPU资源浪费。

**症状关键词**: 自旋锁 / CAS / 原子操作 / ldaxr / stlxr / perf top / 伪共享 / 全局锁 / ARM64

### 诊断步骤
#### Step 1: perf top 观察锁/原子操作函数 CPU 占比
- metric: `perf top top-N functions（关注锁/原子操作类）`
- 采集层: flamegraph
- 异常模式: > "如果锁的申请和释放在5%以上，可以考虑优化锁的实现"
- 阈值: lock_acquire+lock_release 函数 cpu_share ≥ 0.05

### possible 根因 (非参数类)
#### Cause 1: 全局锁导致每个 CPU core 都竞争同一变量
- type: application-design
- 原文: > "并发任务高的场景下，如果系统中存在唯一的全局变量，那么每个CPU core都会申请这个全局变量对应的锁，导致这个锁的争抢严重。"
- 缓解: > "可以基于业务逻辑，为每个CPU core或者线程分配对应的资源。"

#### Cause 2: 高频访问的锁变量未按 CacheLine 对齐发生伪共享
- type: application-design
- 原文: > "对于高频访问的锁变量，实际是对锁变量进行高频的读写操作，容易发生伪共享问题。"

#### Cause 3: 使用 ldxr+stxr+dmb ish 而非 ldaxr+stlxr 原子指令组合
- type: application-design
- 原文: > "使用ldaxr+stlxr两条指令实现原子操作时，可以同时保证内存一致性，而ldxr+stxr指令并不能保证内存一致性，从而需要内存屏障指令（dmb ish）配合来实现内存一致性。从测试情况看，ldaxr+stlxr指令比ldxr+stxr+dmb ish指令的性能高。"

#### Cause 4: 线程并发数过高引发锁竞争激增
- type: application-design
- 原文: > "减少线程并发数：参考调整线程并发数章节。"
- 缓解: > "减少线程并发数：参考调整线程并发数章节。"

---

## 鲲鹏 BIOS 中硬件预取(CPU Prefetching)未关闭(影响数据库随机访问性能)

**case_id**: `kunpeng-bios-cpu-prefetch-enabled-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0007.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0007.html) (unknown)
**平台**: linux-arm64-kunpeng
**case_pattern**: parameter-audit
**source_heading**: BIOS调优

**engine**: kunpeng-platform
**symptom_category**: cpu-high

### 症状 (原文)
> 硬件预取是通过跟踪指令和数据地址的变化，将指令和地址提前读到Cache里，硬件预取对数据库场景的性能有影响，建议在BIOS中将预取功能关闭。

**症状关键词**: CPU Prefetching / 硬件预取 / BIOS / 鲲鹏 / MISC Config

### 诊断步骤
#### Step 1: 读取 BIOS 中 CPU Prefetching Configuration 当前值
- metric: `bios.advanced.misc_config.cpu_prefetching_configuration`
- 采集层: bios-readout
- 异常模式: > "将“CPU Prefetching Configuration”设置为“Disabled”，按“F10”键保存退出。"
- 阈值: `current = "Enabled" ≠ "Disabled"`

### possible 根因 (参数类)
#### Cause 1: BIOS CPU Prefetching Configuration 仍为 Enabled
- param: `bios.advanced.misc_config.cpu_prefetching_configuration`
- 异常值模式: `current = "Enabled" (default)`
- 原文: > "硬件预取是通过跟踪指令和数据地址的变化，将指令和地址提前读到Cache里，硬件预取对数据库场景的性能有影响，建议在BIOS中将预取功能关闭。"

---

## 鲲鹏 BIOS 中 SMMU 在非虚拟化场景未关闭(影响数据库 IO 性能)

**case_id**: `kunpeng-bios-smmu-enabled-non-virt-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0007.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0007.html) (unknown)
**平台**: linux-arm64-kunpeng
**case_pattern**: parameter-audit
**source_heading**: BIOS调优

**engine**: kunpeng-platform
**symptom_category**: disk-io-saturation

### 症状 (原文)
> 因为数据库通常会使用大量的内存和IO资源，而SMMU会增加额外的开销和延迟，从而降低系统的性能。

**症状关键词**: SMMU / BIOS / 鲲鹏 / Support Smmu / MISC Config

### 诊断步骤
#### Step 1: 读取 BIOS 中 Support Smmu 当前值
- metric: `bios.advanced.misc_config.support_smmu`
- 采集层: bios-readout
- 异常模式: > "将“Support Smmu”设置为“Disable”。"
- 阈值: `current = "Enable" ≠ "Disable" (in non-virtualization scenario)`

### possible 根因 (参数类)
#### Cause 1: BIOS Support Smmu 在非虚拟化场景仍为 Enable
- param: `bios.advanced.misc_config.support_smmu`
- 异常值模式: `current = "Enable" AND scenario = non-virtualization`
- 原文: > "因为数据库通常会使用大量的内存和IO资源，而SMMU会增加额外的开销和延迟，从而降低系统的性能。因此在数据库场景，开启SMMU并不能获得更好的性能。"

---

## x86 上对齐良好的代码迁移到鲲鹏 920（CacheLine 128B）出现伪共享

**case_id**: `kunpeng-cacheline-false-sharing-arm64-128b-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0052.html](https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0052.html) (unknown)
**平台**: linux-arm64-kunpeng
**case_pattern**: core-perf-diagnosis
**source_heading**: CacheLine优化

**engine**: kunpeng-platform
**symptom_category**: cpu-high

### 症状 (原文)
> writeHighFreq在一个CPU core中被改写后，这个Cache中对应的CacheLine长度的数据被标识为无效，也就是readHighFreq被CPU core标识为无效数据，虽然readHighFreq并没有被修改，但是CPU在访问readHighFreq时，依然会从内存重新导入，出现伪共享导致性能降低。

**症状关键词**: CacheLine / 伪共享 / false sharing / Cache 命中率 / 鲲鹏920 / x86 / posix_memalign / CACHE_LINE_SIZE

### 诊断步骤
#### Step 1: 通过 perf 观察 Cache 命中率/伪共享指标
- metric: `L1/L2/L3 cache miss + false-sharing event`
- 采集层: flamegraph
- 异常模式: > "出现伪共享导致性能降低。"
- 阈值: (定性) cache miss 率显著升高 + 高频访问的读/写变量在同 CacheLine

### possible 根因 (非参数类)
#### Cause 1: 高频访问的相邻变量未做 CacheLine 对齐（典型 false sharing）
- type: application-design
- 原文: > "出现伪共享的常见原因是高频访问的数据未按照CacheLine大小对齐。"
- 缓解: > "使用动态申请内存的对齐方法：1int posix_memalign(void **memptr, size_t alignment, size_t size)"

#### Cause 2: 代码沿用 x86 的 64B CacheLine 假设但实际运行在 128B 的鲲鹏 920
- type: bios-firmware-issue
- 原文: > "x86 L3 Cache的CacheLine大小为64字节，鲲鹏920的CacheLine为128字节。"

---

## 网卡中断与网卡不在同一 NUMA 节点导致跨 NUMA 访问内存

**case_id**: `kunpeng-network-irq-cross-numa-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0026.html](https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0026.html) (unknown)
**平台**: linux-arm64-kunpeng
**case_pattern**: core-perf-diagnosis
**source_heading**: 网络NUMA绑核

**engine**: kunpeng-platform
**symptom_category**: network-latency

### 症状 (原文)
> 在网卡开启多队列时，操作系统通过irqbalance服务来确定网卡队列中的网络数据包交由哪个CPU core处理，但是当处理中断的CPU core和网卡不在一个NUMA时，会触发跨NUMA访问内存。

**症状关键词**: 网卡多队列 / irqbalance / NUMA / smp_affinity_list / 中断

### 诊断步骤
#### Step 1: 查询网卡中断号 + 当前绑定 core
- metric: `NIC IRQ → CPU core 绑定分布`
- 采集层: os
- 异常模式: > "处理中断的CPU core和网卡不在一个NUMA时，会触发跨NUMA访问内存。"
- 阈值: (定性) IRQ 处理 core ∉ NIC NUMA node

### possible 根因 (参数类)
#### Cause 1: 网卡中断未通过 smp_affinity_list 显式绑定到本 NUMA 核
- param: `/proc/irq/$irq/smp_affinity_list`
- 异常值模式: 默认未显式绑定 → 继承 irqbalance 自由分发结果
- 原文: > "我们可以将处理网卡中断的CPU core设置在网卡所在的NUMA上，从而减少跨NUMA的内存访问所带来的额外开销，提升网络处理性能。"

### possible 根因 (非参数类)
#### Cause 1: irqbalance 服务运行中导致中断分配随机
- type: application-design
- 原文: > "在网卡开启多队列时，操作系统通过irqbalance服务来确定网卡队列中的网络数据包交由哪个CPU core处理"
- 缓解: > "# systemctl stop irqbalance.service"

---

## 周期时钟中断浪费 CPU 资源(nohz 未启用)

**case_id**: `kunpeng-nohz-clock-tick-overhead-03`
**来源**: [https://www.cnblogs.com/huaweicloud/p/11861191.html](https://www.cnblogs.com/huaweicloud/p/11861191.html) (unknown)
**平台**: linux-arm64-kunpeng
**case_pattern**: core-perf-diagnosis
**source_heading**: 1.3.3 定时器机制调整,减少不必要的时钟中断

**engine**: kunpeng-platform
**symptom_category**: cpu-high

### 症状 (原文)
> 在Linux内核2.6.17版本之前,Linux内核为每个CPU设置一个周期性的时钟中断,Linux内核利用这个中断处理一些定时任务,如线程调度等。这样导致就算CPU不需要定时器的时候,也会有很多时钟中断,导致资源的浪费。

**症状关键词**: nohz / 时钟中断 / timer_tick / 调度开销

### 诊断步骤
#### Step 1: 看内核启动参数是否含 nohz=off
- metric: `/proc/cmdline 中是否含 `nohz=off``
- 采集层: os
- 异常模式: > "如果有nohz=off关键字,说明nohz机制被关闭"
- 阈值: `nohz=off` 出现在 /proc/cmdline

#### Step 2: 用 perf sched 观察 timer_tick 调度次数
- metric: `timer_tick 调度次数(单位时间内)`
- 采集层: os
- 异常模式: > "输出信息中有如下信息,其中591字段表示统计时间内的调度次数,数字变小说明修改生效。"
- 阈值: 修改前后调度次数显著未减小

### possible 根因 (参数类)
#### Cause 1: 内核启动参数 nohz=off
- param: `kernel boot cmdline `nohz=off``
- 异常值模式: 显式设了 nohz=off · 或某些 OS 默认 off(原文示例 Euler:nohz=off)
- 原文: > "在Linux内核2.6.17版本之前,Linux内核为每个CPU设置一个周期性的时钟中断"

---

## 跨 NUMA 节点访问内存导致应用性能下降

**case_id**: `kunpeng-numa-cross-node-memory-access-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0014.html](https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0014.html) (unknown)
**平台**: linux-arm64-kunpeng
**case_pattern**: core-perf-diagnosis
**source_heading**: NUMA优化,减少跨NUMA访问内存

**engine**: kunpeng-platform
**symptom_category**: cpu-high

### 症状 (原文)
> 不同NUMA内的CPU core访问同一个位置的内存,性能不同。内存访问延时从高到低为:跨CPU > 跨NUMA不跨CPU > NUMA内。

**症状关键词**: NUMA / 跨NUMA访问 / 内存访问延时 / CPU亲和性

### 诊断步骤
#### Step 1: 看进程当前的 NUMA 亲和绑定
- metric: `进程 NUMA 亲和绑定状态`
- 采集层: os
- 异常模式: > (原文未明示阈值)进程跨节点 numa_miss 计数显著大于 numa_hit
- 阈值: numa_miss / (numa_hit + numa_miss) > 0.1(经验值,非原文)

### possible 根因 (参数类)
#### Cause 1: 应用未做线程 CPU 亲和性绑定
- param: `(非操作系统参数,而是**应用启动方式**或**应用配置**)`numactl -C` / `sched_setaffinity` / 应用配置中的 worker_cpu_affinity`
- 异常值模式: 默认不绑定核 → 调度器自由迁移线程 → 跨 NUMA 内存访问
- 原文: > "在应用程序运行时要尽可能地避免跨NUMA访问内存,我们可以通过设置线程的CPU亲和性来实现。"

---

## 线程并发数超过最佳点导致性能下降

**case_id**: `kunpeng-thread-concurrency-overload-05`
**来源**: [https://www.cnblogs.com/huaweicloud/p/11861191.html](https://www.cnblogs.com/huaweicloud/p/11861191.html) (unknown)
**平台**: linux-arm64-kunpeng
**case_pattern**: core-perf-diagnosis
**source_heading**: 1.3.5 调整线程并发数

**engine**: kunpeng-platform
**symptom_category**: cpu-high

### 症状 (原文)
> 程序从单线程变为多线程时,CPU和内存资源得到充分利用,性能得到提升。但是系统的性能并不会随着线程数的增长而线性提升,因为随着线程数量的增加,线程之间的调度、上下文切换、关键资源和锁的竞争也会带来很大开销。

**症状关键词**: 线程并发 / TPS / 上下文切换 / 锁竞争

### 诊断步骤
#### Step 1: 不同并发数下做 TPS 测试,找性能拐点
- metric: `TPS / 业务吞吐 vs 线程并发数`
- 采集层: os
- 异常模式: > "我们需要针对不同的业务模型和使用场景做多组测试,找到适合本业务场景的最佳并发线程数。"
- 阈值: 增加并发后 TPS 反降 → 已过拐点

### possible 根因 (参数类)
#### Cause 1: 应用并发参数未调
- param: `MySQL `innodb_thread_concurrency` / Nginx `worker_processes` / 其他应用并发设置`
- 异常值模式: 设置过大,超过最佳并发拐点
- 原文: > "MySql可以通过innodb_thread_concurrency设置工作线程的最大并发数。" 与 "Nginx可以通过worker_processes参数设置并发的进程个数。"

---

## 4K 页大小导致 TLB 命中率低

**case_id**: `kunpeng-tlb-miss-page-size-04`
**来源**: [https://www.cnblogs.com/huaweicloud/p/11861191.html](https://www.cnblogs.com/huaweicloud/p/11861191.html) (unknown)
**平台**: linux-arm64-kunpeng
**case_pattern**: core-perf-diagnosis
**source_heading**: 1.3.4 调整内存页的大小为64K,提升TLB命中率

**engine**: kunpeng-platform
**symptom_category**: cpu-high

### 症状 (原文)
> TLB（Translation lookaside buffer）为页表（存放虚拟地址的页地址和物理地址的页地址的映射关系）在CPU内部的高速缓存。TLB的命中率越高,页表查询性能就越好。

**症状关键词**: TLB / page size / 64K / dTLB-load-misses / iTLB-load-misses

### 诊断步骤
#### Step 1: perf stat 看 TLB 命中率
- metric: `dTLB-load-misses 比率 / iTLB-load-misses 比率`
- 采集层: os
- 异常模式: > "其中1.21%和0.59%分别表示数据的miss率和指令的miss率。"
- 阈值: dTLB miss > 1% / iTLB miss > 0.5%(原文示例值,可作经验阈值)

### possible 根因 (参数类)
#### Cause 1: 内核编译时 PAGESIZE=4K
- param: `Linux kernel `Page size` 编译选项`
- 异常值模式: 4K(默认)
- 原文: > "TLB管理的内存大小 = TLB行数 x 内存的页大小"

---
