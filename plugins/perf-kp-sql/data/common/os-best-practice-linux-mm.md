# os-best-practice-linux-mm

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 9 条 case。

---

## KVM 上跑 mongod · 为虚机预留全部内存 · 不禁用 balloon driver

**case_id**: `linux-mm-kvm-reserve-full-vm-memory-15`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (official)
**平台**: bare
**scope**: linux-mm
**case_pattern**: parameter-best-practice

### 场景 (原文)
> KVM supports memory overcommitment, where you can assign more memory to your virtual machines than the physical machine has available. When memory is overcommitted, the hypervisor reallocates memory between the virtual machines.

### 场景 (中文转述)
mongod 部署在 KVM 虚机上的场景。KVM 同样支持内存超配 + balloon driver(virtio-balloon),行为机制与 VMware 同源。

### 推荐
- 值: ``为 mongod KVM 虚机预留 (reserve) 全部分配内存 · 不禁用 balloon driver``
- 层: other
- 原文:
  > To prevent negative performance impact from the balloon driver and memory overcommitment features, reserve the full amount of memory for the virtual machine running MongoDB.

### 机制 / 原因
> Reserving the appropriate amount of memory for the virtual machine prevents the balloon from inflating in the local operating system when there is memory pressure in the hypervisor.
KVM 与 VMware 同源:预留全量内存阻止 virtio-balloon 在 mongod 虚机内膨胀,保护 mongod 工作集;同时不能禁用 balloon——禁用后 hypervisor 只能走自己的 swap 来满足超配请求,降级更严重。

### 违反时的风险 (warning)
> when the balloon driver expands, it can interfere with MongoDB's memory management and affect MongoDB's performance.
不预留则 balloon 撑大、挤压工作集,mongod 慢;禁用 balloon 则 hypervisor swap,更慢。

---

## NUMA 主机上 mongod 必须经 numactl --interleave=all 启动

**case_id**: `linux-mm-numactl-interleave-all-mongod-startup-07`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (official)
**平台**: bare
**scope**: linux-mm
**case_pattern**: parameter-best-practice

### 场景 (原文)
> Running MongoDB on a system with Non-Uniform Memory Access (NUMA) can cause a number of operational problems, including slow performance for periods of time and high system process usage.

### 场景 (中文转述)
部署 mongod 在多 socket NUMA 主机上的场景。NUMA 架构里每个 socket 有自己的 local memory,跨 socket 访问慢——MongoDB 默认 malloc 不感知 NUMA,会出现间歇性慢请求、system 进程 CPU 飙高。

### 推荐
- 值: ``numactl --interleave=all <mongod-cmd>``
- 层: mongodb-cli-flag
- 原文:
  > When running MongoDB servers and clients on NUMA hardware, you should configure a memory interleave policy so that the host behaves in a non-NUMA fashion.

### 检测方法
> "ps --no-headers -o comm 1"
违规模式: "MongoDB checks NUMA settings on start up when deployed on Linux"

### 机制 / 原因
> Running MongoDB on a system with Non-Uniform Memory Access (NUMA) can cause a number of operational problems, including slow performance for periods of time and high system process usage.
NUMA 默认策略让进程倾向于在 local node 分配内存——但 mongod 的 WT cache 通常远超单 node 内存,跨 node 访问触发 zone reclaim 与远端访问延迟。`numactl --interleave=all` 让所有页均匀打散到所有 node,变相把多 node 当成一块大内存,避开了"local 满 → 频繁 reclaim → 抖动"的链路。

### 违反时的风险 (warning)
> slow performance for periods of time and high system process usage.
不用 numactl 启动 mongod,在 NUMA 机器上会出现:间歇性慢请求(分钟级抖动 / 长尾延迟)、system / kswapd 进程 CPU 飙高(zone reclaim 频繁触发)、`numad` 守护进程进一步加剧抖动。

---

## 鲲鹏 BoostKit 数据库场景 vm.dirty_ratio 设为 5 限制脏页堆积

**case_id**: `linux-mm-vm-dirty-ratio-5-kunpeng-dbs-os-cache-tuning-02`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0017.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0017.html) (official)
**平台**: linux-arm64-kunpeng
**scope**: linux-mm
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 对于不同系统的内存使用情况，通过在OS层面调整一些缓存相关参数配置，可以有效提升服务器性能。

### 场景 (中文转述)
鲲鹏 BoostKit 数据库场景下,DB 服务对内核脏页回写策略极敏感:mongod / MySQL / openGauss 等
DB 内核都自管 buffer pool(WT cache / InnoDB buffer pool / shared_buffers),OS page cache
里大部分脏页是 DB 写产生的中间脏数据。脏页堆积超过阈值会触发同步刷盘风暴(`pdflush` / writeback
线程满载 + 应用线程因 dirty 页超阈值被强制阻塞写),造成 DB 写延迟尖峰。本场景覆盖鲲鹏 BoostKit
DB 调优指南——操作系统调优 → 缓存参数调优——主题,通过把 vm.dirty_ratio 调小为 5 让脏页保持
少积多刷的节奏,平滑写延迟。

### 推荐
- 值: ``vm.dirty_ratio=5``
- 层: os-sysctl
- 原文:
  > 将dirty_ratio参数设置为“5”。

### 机制 / 原因
vm.dirty_ratio 是内核脏页占系统内存上限百分比;一旦 page cache 中脏页 / 总内存超过该值,产生
脏页的写线程会被同步阻塞直到内核 writeback 把脏页刷到磁盘。默认值在主流发行版上是 20-40,
对大内存(数百 GB 起步的鲲鹏 DB 主机)意味着可堆积数十~一百 GB 脏页,集中刷盘时形成 I/O 风暴
+ 长时间写阻塞。设为 5 等于把"脏页缓冲水位"从大池子改成小池子,内核更频繁触发后台 writeback,
单次刷盘量小、延迟分布平滑;DB 写更接近"小步快走"模式,尾延迟和 P99 都会被拉低。该机制对鲲鹏
ARM64 平台同样成立 — 与 CPU 架构无关 · 跟内存大小 + 存储带宽相关。

### 违反时的风险 (warning)
保持发行版默认 vm.dirty_ratio(常见 20-40),鲲鹏 BoostKit 大内存 DB 主机上可堆积几十 GB 脏页,
触发集中 writeback 时:(1) 应用写线程因脏页超阈被同步阻塞 → DB 写 P99 / P999 飙升 + 偶发
"写卡 N 秒";(2) 大批量回写挤满底层块设备队列 → 跟 mongod / MySQL 自身的 WAL / journal 落盘
竞争 → 放大尾延迟;(3) 极端情况下触发 OOM-killer 误判内存压力。

---

## mongod 主机 vm.swappiness 设为 1 或 0(默认 60 太激进)

**case_id**: `linux-mm-vm-swappiness-1-or-0-mongo-host-05`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (official)
**平台**: bare
**scope**: linux-mm
**case_pattern**: parameter-best-practice

### 场景 (原文)
> A setting of 60 tells the kernel to swap to disk often, and is the default value on many Linux distributions.

### 场景 (中文转述)
部署 mongod 的 Linux 主机大多发行版默认 `vm.swappiness=60`,内核会"经常往 swap 换页",对延迟敏感型 DB 工作负载不友好。该建议覆盖 dedicated mongod host 与 shared host 两种场景。

### 推荐
- 值: ``vm.swappiness ∈ {0, 1}`(同机有 webserver 用 1 / dedicated 可用 0)`
- 层: os-sysctl
- 原文:
  > As such you should set vm.swappiness to either 1 or 0 depending on your application needs and cluster configuration.

### 检测方法
> "cat /proc/sys/vm/swappiness"
违规模式: "is the default value on many Linux distributions"

### 机制 / 原因
> MongoDB performs best where swapping can be avoided or kept to a minimum, as retrieving data from swap will always be slower than accessing data in RAM.
MongoDB 工作集尽量驻留 RAM 才性能最好——从 swap 取数据永远比从 RAM 慢(swap 在磁盘上,即便是 SSD 也比 DRAM 慢 2-3 个数量级)。`swappiness=60` 让内核倾向于换页,即使 RAM 还够也会主动 swap;`swappiness=1` 只在内存压到 OOM 边缘才 swap,`swappiness=0` 干脆禁用 swap。两者都是为了让 MongoDB 尽量留在 RAM。

### 违反时的风险 (warning)
> retrieving data from swap will always be slower than accessing data in RAM.
保持 `swappiness=60`,内核频繁把 mongod 工作集页换到 swap,造成查询延迟抖动 / 长尾(尤其是 P99/P999 级别),业务侧可能投诉"数据库慢"。在写密集场景,swap 带来的脏页 I/O 还会和 mongod 自身写竞争磁盘。

---

## NUMA 主机上 vm.zone_reclaim_mode 必须设为 0 · 与 numactl 配套

**case_id**: `linux-mm-vm-zone-reclaim-mode-disable-08`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (official)
**平台**: bare
**scope**: linux-mm
**case_pattern**: parameter-best-practice

### 场景 (原文)
> On Linux, you must disable zone reclaim and also ensure that your mongod and mongos instances are started by numactl, which is generally configured through your platform's init system.

### 场景 (中文转述)
NUMA 主机上跑 mongod 的场景。Linux 内核 NUMA 默认会做 zone reclaim(本 node 内存吃紧时回收同 node 的页 cache 而非跨 node 分配),对 DB 这种工作集大于单 node 内存的场景会造成 cache 抖动。

### 推荐
- 值: ``vm.zone_reclaim_mode = 0``
- 层: os-sysctl
- 原文:
  > On Linux, you must disable zone reclaim and also ensure that your mongod and mongos instances are started by numactl

### 检测方法
> "sudo sysctl -w vm.zone_reclaim_mode=0"
违规模式: "You must perform both of these operations to properly disable NUMA for use with MongoDB"

### 机制 / 原因
`zone_reclaim_mode != 0` 让内核优先 reclaim 同一 NUMA node 的页 cache(把 mongod 已经载入的工作集页扔掉)而不是跨 node 分配新页。对 mongod 来说,工作集页被反复 reclaim → 重新读盘 → 缓存命中率塌陷。设 0 让内核优先跨 node 分配,保留缓存。这与 `numactl --interleave=all` 是一对(后者均匀打散页,前者关掉本地驱逐),两者必须同时做。

### 违反时的风险 (warning)
> If the NUMA configuration may degrade performance, MongoDB prints a warning.
zone_reclaim 启用且 numactl 未配,会触发 mongod 启动时的 NUMA 警告,运行期出现"间歇性慢"——本质是 page cache 反复抖动。

---

## 数据库场景下关闭透明大页(THP)以减少内存碎片与利用率下降

**case_id**: `linux-thp-disabled-db-mem-fragmentation-bp-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0016.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0016.html) (official)
**平台**: linux-arm64-kunpeng
**scope**: linux-mm
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 传统的malloc在分配和释放内存时会造成内存碎片，这会导致内存的利用率下降，甚至会导致内存不足的情况。

### 场景 (中文转述)
数据库进程(mongod / MariaDB / 通用 DB)在 Linux 主机上长期运行,频繁 malloc/free 小块内存,在传统 glibc malloc + 内核透明大页(THP)开启的默认状态下,会出现内存碎片堆积、page promotion / khugepaged defrag 抖动、内存利用率下降的问题。鲲鹏 BoostKit 数据库场景调优文档把「关闭 THP」与「使用 TCMalloc」作为一对配方,本条 best-practice 仅蒸 THP 关闭部分(MongoDB 自带 TCMalloc,不走 LD_PRELOAD 路径)。

### 推荐
- 值: ``transparent_hugepage/enabled=never AND transparent_hugepage/defrag=never``
- 层: os-sysctl
- 原文:
  > echo never > /sys/kernel/mm/transparent_hugepage/enabled echo never > /sys/kernel/mm/transparent_hugepage/defrag

### 检测方法

### 机制 / 原因
鲲鹏 BoostKit 数据库调优文档把「关闭 THP」与「使用 TCMalloc」作为一对配方提出 · 共同目标是减少 DB 工作负载下的内存碎片。其中关闭 THP 的机制原文未直接给出,实际原因:THP 让内核把 4 KB 小页合并为 2 MB 大页(page promotion)以提高 TLB 命中,但 DB 进程的小对象分配模式与 THP 的 2 MB 粒度不匹配——一旦页内有少量被改写,khugepaged 会把整页拆回小页(split / fault around),defrag 也会触发跨 NUMA 内存压缩,引入分钟级 stall 与内存抖动;同时 THP 与 userspace 内存分配器(glibc malloc / TCMalloc)交互时会绕开分配器自己的内存复用路径,放大 RSS 浪费。所以 DB 场景把 enabled 与 defrag 都设为 never,关闭 page promotion 与 defragmentation,把内存管理权完整交还给 userspace 分配器。原文 TCMalloc 段同主题给出「减少内存碎片 / 提高内存利用率」作为整段配方目标,可作为整体方向佐证(但因含动作动词不能作为 rationale_quote 直引)。

### 违反时的风险 (warning)
> 这会导致内存的利用率下降，甚至会导致内存不足的情况。
不关闭 THP 时,DB 进程长跑下内存碎片堆积,内存利用率下降,严重时触发 OOM(内存不足)。运行期典型表现:RSS 远大于实际工作集 / khugepaged 占用 CPU / 偶发分钟级 stall(THP defrag 触发时)/ NUMA 跨节点抖动。属于不致命但 P99 / 长尾延迟显著恶化的次优配置。

---

## KVM 虚拟化场景为 mongod 虚机分配 512MB 大页(Host kernel cmdline + VM xml memoryBacking)

**case_id**: `os-kvm-vm-hugepages-allocate-tlb-miss-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0021.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0021.html) (official)
**平台**: bare
**scope**: linux-mm
**case_pattern**: parameter-best-practice

### 场景 (原文)
> KVM虚拟化场景下，配置内存大页时，至少要预留总内存的15%给Host。

### 场景 (中文转述)
KVM 虚拟化部署 mongod / 内存访问密集型数据库的场景:虚机内存默认以 4KB 普通页方式由 Host 映射给 Guest,Guest 内进程访问内存时经过 GVA → GPA → HPA 二次地址翻译(EPT/Stage-2),TLB 项极易耗尽。原文以「openEuler 20.03 LTS SP1 + 4U8G 虚机 + 300 个 512MB 大页」为典型部署样例,并强调至少留 15% 内存给 Host(防 Host OOM)。

### 推荐
- 值: ``default_hugepagesz=512M hugepagesz=512M hugepages=256``
- 层: kernel-cmdline
- 原文:
  > 在Linux字段一行的最后输入以下配置。 1 default_hugepagesz=512M hugepagesz=512M  hugepages=256 pci=realloc

### 检测方法
> "cat /sys/devices/system/node/node*/meminfo
违规模式: "如果HugePages显示信息为0，说明此时系统没有配置内存大页。"

### 机制 / 原因
KVM 虚机内存通过 EPT(Intel)/ Stage-2 page table(ARMv8 含鲲鹏)走二级翻译:GVA → GPA(Guest 页表)→ HPA(EPT)。默认 4KB 页时每次访问需查 2 级 × 4 层共 24 次内存(最坏)·TLB 项有限会被耗尽 → TLB Miss 飙升 → 访存延迟数十倍恶化。启用 512MB 大页后(1)Host 给虚机的内存物理连续,Guest 看到的"伪物理地址"在 Host 侧对应大段连续物理内存,(2)EPT 二级翻译同样使用 huge page entry,TLB 项覆盖范围扩大数千倍,(3)pagetable 自身占用内存大幅减少。对 mongod 的 WiredTiger cache(几 GB ~ 几十 GB,内存访问密集)效果尤其显著。

### 违反时的风险 (warning)
KVM 虚机不配置大页(Host 内核 cmdline 缺 default_hugepagesz · 或 VM xml 缺 `<memoryBacking><hugepages/></memoryBacking>`)·则:(1)Guest 内 mongod 工作集大于 TLB 覆盖范围时频繁 TLB miss,内存访问延迟从纳秒级跳到几十~数百纳秒级,(2)EPT walk 频繁挤占 L1/L2 cache,(3)mongod 长尾延迟显著(P99 / P999 抖动),(4)同一物理 Host 上多虚机竞争 TLB 时雪崩式恶化。对 OLTP / 分析混合 workload(读多 random IO、cache 命中敏感)影响 5%~30% 不等(原文称"显著提升内存访问密集型业务的性能" · 反向即不启用时显著低于上限)。注意:不可不预留 15% 给 Host(原文显式约束),否则 Host 自身 OOM,引起整虚机故障。

---

## Linux ulimit stack: raise per-thread stack size limit for high-connection MongoDB deployments

**case_id**: `os-ulimit-stack-high-conn-03`
**来源**: [https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections](https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections) (official)
**平台**: linux-x86_64-generic
**scope**: linux-mm
**case_pattern**: parameter-best-practice

### 场景 (原文)
> RHEL ships with default ulimit and other configurations that are appropriate for your laptop, and to really get the full performance of a large production server you need to do a lot of tuning to increase various limits and buffers.

### 场景 (中文转述)
MongoDB 默认 per-connection 线程模型下，每个线程从栈空间分配内存。操作系统默认的 `stack` ulimit（每线程栈大小上限）可能不足以支持大量线程并发运行，需显式调高以确保线程可正常分配栈内存。

### 推荐
- 值: ``stack = 9999999``
- 层: os-sysctl
- 原文:
  > echo "ec2-user soft stack 9999999" | sudo tee -a /etc/security/limits.conf

### 机制 / 原因
> Threads allocate memory from the stack, which also has a maximum size.
每个线程在创建时从栈空间分配固定内存，栈大小受 `stack` ulimit 上限约束。在高连接数（即大量线程）场景下，若单线程栈内存与线程数的乘积超过系统允许范围，线程创建将因栈内存分配失败而中止。

### 违反时的风险 (critical)
若 `stack` ulimit 不足，高并发连接产生的大量线程在分配栈内存时失败，导致线程无法创建，等价于 MongoDB 无法建立新连接，高并发场景下服务降级。

---

## vm.max_map_count: raise kernel mmap limit when running many threads (MongoDB high-connection)

**case_id**: `os-vm-max-map-count-thread-mmap-01`
**来源**: [https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections](https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections) (official)
**平台**: linux-x86_64-generic
**scope**: linux-mm
**case_pattern**: parameter-best-practice

### 场景 (原文)
> Creating threads uses mmap to allocate memory from stack. And on the kernel level there's a setting for max number of mmapped memory blocks per process, which must be increased too

### 场景 (中文转述)
在高并发连接场景下，MongoDB 每个连接对应一个线程，每个线程创建时通过 `mmap` 从栈分配内存。当线程数极多时，进程的 mmap 映射块数会超过内核默认的 `vm.max_map_count` 上限，导致线程（即连接）无法继续创建。

### 推荐
- 值: ``vm.max_map_count = 9999999``
- 层: os-sysctl
- 原文:
  > echo "vm.max_map_count=9999999" | sudo tee -a /etc/sysctl.conf

### 机制 / 原因
> Creating threads uses mmap to allocate memory from stack. And on the kernel level there's a setting for max number of mmapped memory blocks per process, which must be increased too
Linux 内核通过 `vm.max_map_count` 限制单个进程可拥有的内存映射区域（VMA）数量上限。MongoDB 在高连接数下产生大量线程，每线程的栈内存通过 mmap 分配，VMA 数量随线程数线性增长。若不调高该参数，达到默认上限（通常 65530）后新线程创建将失败，即新连接无法建立。

### 违反时的风险 (critical)
若 `vm.max_map_count` 未调高，当 MongoDB 进程的 VMA 数量达到内核上限时，线程创建（即连接建立）将失败，导致 mongod 无法接受新连接，高并发场景下服务实际可用连接数将被内核级限制截断，且难以从应用层感知。

---
