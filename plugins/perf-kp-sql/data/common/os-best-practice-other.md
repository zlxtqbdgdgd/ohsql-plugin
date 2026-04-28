# os-best-practice-other

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 8 条 case。

---

## Graviton2 部署后用 dmesg/lscpu 验证 LSE 原子指令已被内核检测启用

**case_id**: `arm64-lse-dmesg-lscpu-deploy-verify-percona-02`
**来源**: [https://dev.to/aws-builders/large-system-extensions-for-aws-graviton-processors-3eci](https://dev.to/aws-builders/large-system-extensions-for-aws-graviton-processors-3eci) (community-canonical)
**平台**: linux-arm64-graviton
**scope**: other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> All of the AWS EC2 instances based on the Neoverse-N1 processor, M6g, T4g, C6g, and R6g as well as the C7g include the atomic instructions. One of the common performance issues when migrating to Graviton2 is running software that does not utilize LSE.

### 场景 (中文转述)
在将数据库或服务器应用迁移到 AWS Graviton2/3 实例(M6g、T4g、C6g、R6g、C7g)后，需在上线前验证操作系统内核已成功检测到 LSE 原子指令，且 CPU flags 中含 "atomics" 标记，以确认 LSE 硬件能力可被软件栈利用。A1 实例(Cortex-A72/ARMv8.0-A)不含原子指令，需区别对待。

### 推荐
- 值: ``sudo dmesg`
- 层: other
- 原文:
  > sudo dmesg | grep LSE

### 检测方法
> `sudo dmesg
违规模式: "atomics"

### 机制 / 原因
> The atomic instructions result in faster performance and less variability.
LSE 原子指令由内核在启动时检测并向上层软件栈暴露。`dmesg | grep LSE` 输出 `[0.001296] CPU features: detected: LSE atomic instructions` 即确认内核已启用；`lscpu` 的 Flags 字段含 `atomics` 则进一步确认 CPU 报告 LSE 能力。未见该输出时说明运行在不支持 LSE 的旧 ARM64 硬件(如 A1/Cortex-A72)上，应用无法利用 LSE 加速。

### 违反时的风险 (warning)
> One of the common performance issues when migrating to Graviton2 is running software that does not utilize LSE. Software built with load exclusives and store exclusives usually runs slower on Graviton2 instances.
若跳过 dmesg/lscpu 验证步骤直接上线，可能在不支持 LSE 的实例(如 A1)或错误配置的系统上运行，导致原本期望利用 LSE 加速的代码实际使用低效的 ldxr/stxr 序列，在高并发场景下性能显著低于预期，且无法在事故前识别原因。

---

## ARM64 Graviton2+ 编译时用 -march=armv8.2-a 启用 LSE 原子指令

**case_id**: `arm64-lse-march-armv82a-compile-flag-graviton-01`
**来源**: [https://raw.githubusercontent.com/aws/aws-graviton-getting-started/main/c-c++.md](https://raw.githubusercontent.com/aws/aws-graviton-getting-started/main/c-c++.md) (official)
**平台**: linux-arm64-graviton
**scope**: other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> The compiler needs to generate LSE instructions for applications that use atomic operations.  For example, the code of databases like PostgreSQL contain atomic constructs; c++11 code with std::atomic statements translate into atomic operations.  GCC's `-march=armv8.2-a` flag enables all instructions supported by Graviton2, including LSE.

### 场景 (中文转述)
在 AWS Graviton2/3/4 平台上编译使用原子操作的应用程序(如数据库、并发库)时,需要编译器生成 LSE 指令。数据库代码(如 PostgreSQL 的 atomic 结构体、C++11 std::atomic)在编译时若未启用 LSE,将退回到 load/store exclusive 指令序列,性能低一个数量级。

### 推荐
- 值: ``-march=armv8.2-a``
- 层: other
- 原文:
  > GCC's `-march=armv8.2-a` flag enables all instructions supported by Graviton2, including LSE.  To confirm that LSE instructions are created, the output of `objdump` command line utility should contain LSE instructions:

### 检测方法
> `$ objdump -d app \
违规模式: `$ objdump -d app \

### 机制 / 原因
> All Graviton processors after Graviton1 have support for the Large-System Extensions (LSE) which was first introduced in vArmv8.1. LSE provides low-cost atomic operations which can improve system throughput for CPU-to-CPU communication, locks, and mutexes. The improvement can be up to an order of magnitude when using LSE instead of load/store exclusives.
Graviton1 之后所有代 Graviton 处理器均支持 LSE(ARMv8.1 引入)。LSE 提供低成本原子操作,相比 load/store exclusive 指令序列,在 CPU 间通信、锁和 mutex 场景下吞吐量最高可提升一个数量级。编译时若不启用 -march=armv8.2-a,编译器默认回退到 ARMv8.0 的 ldxr/stxr 序列,性能损失极大。

### 违反时的风险 (warning)
> The improvement can be up to an order of magnitude when using LSE instead of load/store exclusives.
若不启用 -march=armv8.2-a,数据库等使用大量原子操作的程序将使用低效的 load/store exclusive 指令序列,原子操作吞吐量损失最高可达一个数量级,在高并发锁竞争场景下性能大幅下降。

---

## ARM64 多代兼容部署时用 -moutline-atomics 运行期检测 LSE 支持

**case_id**: `arm64-lse-outline-atomics-runtime-detect-graviton-02`
**来源**: [https://raw.githubusercontent.com/aws/aws-graviton-getting-started/main/c-c++.md](https://raw.githubusercontent.com/aws/aws-graviton-getting-started/main/c-c++.md) (official)
**平台**: linux-arm64-graviton
**scope**: other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> For some applications, it may be necessary to support a broad range of Arm64 targets while still making use of more advanced features such as LSE (Large System Extensions) or SVE (Scalable Vector Extension). For this case choose a more conservative build flag, such as `-march=armv8-a` and make use of runtime CPU support detection of features such as SVE.

### 场景 (中文转述)
当需要在多代 ARM64 平台(包括不支持 LSE 的旧版 Graviton1 或 A1 实例)上同一二进制文件兼容运行,同时希望在支持 LSE 的 Graviton2+ 上利用 LSE 原子指令加速时,需要运行期 CPU 特性检测。

### 推荐
- 值: ``-moutline-atomics``
- 层: other
- 原文:
  > You can enable runtime detection and use of LSE atomics instructions by adding the additional compiler flag, `-moutline-atomics`.

### 机制 / 原因
> All Graviton processors after Graviton1 have support for the Large-System Extensions (LSE) which was first introduced in vArmv8.1. LSE provides low-cost atomic operations which can improve system throughput for CPU-to-CPU communication, locks, and mutexes.
-moutline-atomics 让编译器生成包含两套原子操作路径的二进制:在支持 LSE 的硬件(Graviton2+)上使用 LSE 指令,在旧硬件上回退到 ARMv8.0 指令。这样单一二进制即可跨代兼容,同时在新硬件上获得 LSE 性能收益。

### 违反时的风险 (info)
若在多代兼容场景下不使用 -moutline-atomics 而直接用 -march=armv8-a,则在 Graviton2+ 上无法获得 LSE 原子操作加速。若使用 -march=armv8.2-a 则无法在旧 ARM v8.0 系统(如 AWS A1 实例)上运行。-moutline-atomics 以少量性能损失换取跨代兼容。

---

## 鲲鹏平台数据库场景 · 在 BIOS 中关闭 CPU 硬件预取以避免无效缓存流量

**case_id**: `kunpeng-bios-cpu-prefetch-disable-db-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0007.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0007.html) (official)
**平台**: linux-arm64-kunpeng
**scope**: other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 硬件预取是通过跟踪指令和数据地址的变化，将指令和地址提前读到Cache里，硬件预取对数据库场景的性能有影响

### 场景 (中文转述)
鲲鹏 TaiShan 服务器 BIOS 默认开启 CPU Prefetching(硬件预取),通过追踪指令与数据地址变化、把后续可能访问的内容提前读入 L1/L2/L3 Cache。本最佳实践适用于**数据库工作负载**——尤其是 OLTP / 索引随机访问 / hash table 探查这类访问模式无规律的场景,此时硬件预取的预测命中率低,反而带来无效 cache line 流量与无效 TLB miss。

### 推荐
- 值: ``CPU Prefetching Configuration = Disabled``
- 层: bios-firmware
- 原文:
  > 将“CPU Prefetching Configuration”设置为“Disabled”

### 机制 / 原因
CPU 硬件预取器面向「访问地址有空间局部性」的代码(典型如顺序数组扫描 / 矩阵乘法),通过追踪 stride 与 history 提前把下一段 cacheline 拉进 cache。但数据库 OLTP 工作负载典型是**指针跳跃**(B+Tree / hash table 探查)和**随机块访问**(buffer pool 命中后跳到不同 page),空间局部性弱、stride 不稳定 — 预取器命中率低,反而把不会用到的 cacheline 拉进 L1/L2,挤掉真正热的 cacheline,导致 TLB / LLC 污染与额外 memory bandwidth 占用。所以鲲鹏在数据库场景建议关闭硬件预取,让 cache 层保持「按需」语义,把宝贵的 cache 容量留给真实工作集。

### 违反时的风险 (warning)
若在鲲鹏数据库场景保持 BIOS 默认开启 CPU Prefetching,**会引起**两类性能损耗:(1) 大量预测错误的 cacheline 被预取上来挤占 L1 / L2 / LLC,工作集真实热数据被驱逐 → cache miss rate 升高、内存带宽被无效流量占用;(2) prefetch 同时引入额外 TLB miss 与 page-walk 开销 → CPU 周期被浪费在错误预测上。整体表现为同等 workload 下 IPC 下降、QPS 抖动与 P99 延迟轻幅抬升。属于「默认硬件优化反而拖后腿」型 warning(性能下降可观测但不至崩溃 / 丢数据)。

---

## 鲲鹏平台非虚拟化场景下 · 在 BIOS 中关闭 SMMU 以避免数据库 IO 开销

**case_id**: `kunpeng-bios-smmu-disable-non-virt-db-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0007.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0007.html) (official)
**平台**: linux-arm64-kunpeng
**scope**: other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 此优化项只在非虚拟化场景使用，在虚拟化场景，则开启SMMU。

### 场景 (中文转述)
鲲鹏 TaiShan 服务器 + Kunpeng 920 处理器,默认 BIOS 中 SMMU(System Memory Management Unit)处于开启状态。本最佳实践仅适用于**非虚拟化**部署场景(裸机数据库 / 物理机直连 IO),此时数据库直接使用大量内存与 IO 资源,SMMU 的虚→实地址转换桥反而成为额外开销;若是虚拟化场景(KVM / VMware 等需要 IO 设备地址隔离),反而要保留 SMMU 开启。

### 推荐
- 值: ``Support Smmu = Disable``
- 层: bios-firmware
- 原文:
  > 将“Support Smmu”设置为“Disable”

### 机制 / 原因
> 因为数据库通常会使用大量的内存和IO资源，而SMMU会增加额外的开销和延迟
数据库工作负载是 I/O 密集型(大块顺序写 + 小块随机读 + WAL/journal 频繁刷盘),会产生大量 DMA 与跨设备总线访问。SMMU 作为 IO 设备到内存总线的地址转换桥,在每次 DMA 路径上插入一层 IOVA → PA 翻译及权限检查,会消耗 TLB 条目并引入额外延迟与 CPU 开销。在非虚拟化场景里这层翻译并无安全 / 隔离收益(没有多租户的 guest IOVA 隔离需求),纯粹是无谓开销 — 因此关闭 SMMU 可让数据库 IO 走最短路径,获得更优的性能与更低的 jitter。

### 违反时的风险 (warning)
> SMMU会增加额外的开销和延迟，从而降低系统的性能
若在鲲鹏裸机数据库场景仍保持 BIOS 默认开启 SMMU,数据库的每条 DMA / IO 路径都要走 SMMU 翻译表,**增加额外开销与延迟**,**降低系统(数据库)的整体性能**。表现为高 IOPS / 高吞吐 workload 下 CPU 负载偏高、IO 平均延迟与 P99 抖动同步抬升,且这部分损耗无配置可在 OS 层兜底——只能改 BIOS。属于「保守默认配置带来不必要性能税」类后果,严重度 warning(可观测的性能下降但不至崩溃 / 丢数据)。

---

## Enable MongoDB network compression to reduce client-server bandwidth

**case_id**: `mongo-net-compressor-enable-bandwidth-reduction-03`
**来源**: [https://www.percona.com/blog/compression-methods-in-mongodb-snappy-vs-zstd/](https://www.percona.com/blog/compression-methods-in-mongodb-snappy-vs-zstd/) (community-canonical)
**平台**: bare
**scope**: other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> This can further reduce the amount of data that needs to be transmitted between server and client over the network. This, in turn, requires less bandwidth and network resources, which can improve performance and reduce costs.

### 场景 (中文转述)
在网络带宽有限、客户端与服务器之间传输大量数据（如频繁 find 操作）的场景下，启用 MongoDB 网络压缩可显著降低出站流量。实测从 2.33 MB/s 降至 1 MB/s（约 57% 减少）。适用于跨数据中心、云环境带宽计费、或网络 I/O 成为瓶颈的部署。

### 推荐
- 值: ``net.compression.compressors = snappy``
- 层: mongodb-config
- 原文:
  > To enable network compression in mongod and mongos, you can specify the compression algorithm by adding the following line to the configuration file.

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
MongoDB 网络压缩采用协商机制：服务器端配置压缩算法（如 snappy）后，客户端连接字符串中也必须声明对应算法，双端协商一致后数据才以压缩格式传输。若双端算法不匹配，协商失败，网络数据仍以未压缩方式传输，浪费带宽。实测启用 zstd 网络压缩后，出站流量从 2.33 MB/s 降至约 1 MB/s，带宽节省约 57%。

### 违反时的风险 (warning)
> Note that network compression can have a significant impact on network performance and CPU usage.
不启用网络压缩导致客户端与服务器之间数据以原始大小传输，带宽消耗高。在网络受限环境（如跨数据中心或有带宽费用的云环境）中会增加延迟和成本。启用压缩会占用额外 CPU，但实测表明在常规负载下 CPU 影响不显著。

---

## 使用配置管理工具（Puppet/Chef/Ansible）时 · 必须通过 tuned profile 部署调参而非直接修改系统文件

**case_id**: `os-cm-deploy-tuning-via-tuned-profile-not-direct-02`
**来源**: [https://www.percona.com/blog/tuning-linux-for-mongodb-automated-tuning-redhat-and-centos/](https://www.percona.com/blog/tuning-linux-for-mongodb-automated-tuning-redhat-and-centos/) (community-canonical)
**平台**: linux-x86_64-generic
**scope**: other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> If you use configuration management systems like Puppet, Chef, Salt, Ansible, etc., I suggest you configure those systems to deploy tunings via tuned profiles instead of applying tunings directly

### 场景 (中文转述)
使用 Puppet、Chef、Salt、Ansible 等配置管理（CM）工具管理 RHEL/CentOS 服务器，同时系统启用了 tuned daemon（RHEL/CentOS 默认活跃）的 MongoDB 部署场景。CM 工具和 tuned 均有权修改 OS 参数，两者同时运行时会产生冲突。

### 推荐
- 值: ``configure those systems to deploy tunings via tuned profiles``
- 层: other
- 原文:
  > configure those systems to deploy tunings via tuned profiles instead of applying tunings directly

### 机制 / 原因
> tunings are not overridden or ignored
tuned daemon 在 RHEL/CentOS 系统上持续运行并按 active profile 强制系统参数。如果 CM 工具直接写 sysctl.conf 或 /etc/udev.d 等文件，tuned 在下一次 profile 应用周期（重启或 tuned-adm 操作）会覆盖这些直接修改，造成 CM 工具期望的调参无法持久生效。通过 CM 工具部署 tuned profile（而非直接写参数），利用 tuned 的 Standards compliance 机制确保调参不被覆盖忽略，CM 工具和 tuned 协同而非互搏。

### 违反时的风险 (warning)
CM 工具直接修改系统参数时，tuned daemon 会与自动化工具对抗并覆盖掉 CM 工具设置的值。结果是：CM 工具每次运行后调参被写入，但 tuned 随后将其恢复，调参实际不生效——MongoDB 运行在 OS 默认配置下，I/O 调度器/readahead/THP 等关键参数未按推荐值配置，导致持续性能退化且难以排查根因。

---

## RHEL/CentOS 7+ 运行 MongoDB · 使用 tuned-percona-mongodb profile 一键自动化应用所有 Linux 调参

**case_id**: `os-tuned-percona-mongodb-profile-rhel-centos-automated-01`
**来源**: [https://www.percona.com/blog/tuning-linux-for-mongodb-automated-tuning-redhat-and-centos/](https://www.percona.com/blog/tuning-linux-for-mongodb-automated-tuning-redhat-and-centos/) (community-canonical)
**平台**: linux-x86_64-generic
**scope**: other
**case_pattern**: parameter-best-practice

### 场景 (原文)
> tuned-percona-mongodb applies the following tunings (from the previous tuning article ) on a Redhat/CentOS 7+ host

### 场景 (中文转述)
在 RHEL/CentOS 7+ 服务器上部署 MongoDB，需要同时应用多项 Linux 系统调参（THP 禁用、读预取、I/O 调度器、VM dirty ratio、swappiness、CPU C-States 等）。以往需要逐项手动修改 sysctl/udev 等配置，操作繁琐且在某些 RHEL 新版本上会被 tuned daemon 覆盖。使用 Percona 提供的 tuned-percona-mongodb profile，可通过一键安装 + 激活自动化应用所有推荐调参。

### 推荐
- 值: ``sudo make enable``
- 层: other
- 原文:
  > sudo make enable

### 检测方法
> `tuned-adm active`
违规模式: `Current active profile: percona-mongodb`

### 机制 / 原因
> performance-focused tuned profile for MongoDB on Linux
tuned 是 RHEL/CentOS 7+ 中统一管理系统调参的 daemon，通过文件型 profile 集中描述所有调参并在系统启动时原子性应用，确保调参不被后续覆盖（Standards compliance）。tuned-percona-mongodb 是专为 MongoDB on Linux 设计的性能优化型 profile，将 THP 禁用、readahead、I/O 调度器、VM dirty、swappiness、CPU C-States 等多个分散的调参打包为单一 profile，通过 `sudo make enable` 一键安装激活，消除了逐项手动修改的操作复杂度和易错性。

### 违反时的风险 (warning)
在某些较新 RHEL/CentOS 版本上，通过 /etc/udev.d 等文件直接修改的 Linux 调参会被 tuned daemon 静默覆盖忽略，导致 MongoDB 实际运行在未调优的 OS 配置上——I/O 调度器、readahead、THP 等参数恢复默认值，引起不可预期的性能退化（高尾延迟、写入抖动）且难以排查根因。

---
