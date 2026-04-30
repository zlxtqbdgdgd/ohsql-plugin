<!-- ============ Best-Practice (93 cases) ============ -->

## case_id: arm64-lse-march-armv82a-compile-flag-graviton-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-graviton
- **scope**: other
- **case_pattern**: parameter-best-practice
- **title**: ARM64 Graviton2+ 编译时用 -march=armv8.2-a 启用 LSE 原子指令
- **recommendation_value**: `-march=armv8.2-a`
- **recommendation_layer**: other
- **detection_layer**: os
- **related_param_names**: `["-march=armv8.2-a", "LSE"]`
- **risk_severity**: warning
- **source_url**: https://raw.githubusercontent.com/aws/aws-graviton-getting-started/main/c-c++.md
- **source_authority**: official
- **source_url_lang**: en

### scenario_description_quote

> The compiler needs to generate LSE instructions for applications that use atomic operations. For example, the code of databases like PostgreSQL contain atomic constructs; c++11 code with std::atomic statements translate into atomic operations. GCC's `-march=armv8.2-a` flag enables all instructions supported by Graviton2, including LSE.

### recommendation_quote

> GCC's `-march=armv8.2-a` flag enables all instructions supported by Graviton2, including LSE. To confirm that LSE instructions are created, the output of `objdump` command line utility should contain LSE instructions:

### rationale_quote

> All Graviton processors after Graviton1 have support for the Large-System Extensions (LSE) which was first introduced in vArmv8.1. LSE provides low-cost atomic operations which can improve system throughput for CPU-to-CPU communication, locks, and mutexes. The improvement can be up to an order of magnitude when using LSE instead of load/store exclusives.

### risk_quote

> The improvement can be up to an order of magnitude when using LSE instead of load/store exclusives.


## case_id: arm64-lse-outline-atomics-runtime-detect-graviton-02

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-graviton
- **scope**: other
- **case_pattern**: parameter-best-practice
- **title**: ARM64 多代兼容部署时用 -moutline-atomics 运行期检测 LSE 支持
- **recommendation_value**: `-moutline-atomics`
- **recommendation_layer**: other
- **related_param_names**: `["-moutline-atomics", "-march=armv8-a", "LSE"]`
- **risk_severity**: info
- **source_url**: https://raw.githubusercontent.com/aws/aws-graviton-getting-started/main/c-c++.md
- **source_authority**: official
- **source_url_lang**: en

### scenario_description_quote

> For some applications, it may be necessary to support a broad range of Arm64 targets while still making use of more advanced features such as LSE (Large System Extensions) or SVE (Scalable Vector Extension). For this case choose a more conservative build flag, such as `-march=armv8-a` and make use of runtime CPU support detection of features such as SVE.

### recommendation_quote

> You can enable runtime detection and use of LSE atomics instructions by adding the additional compiler flag, `-moutline-atomics`.

### rationale_quote

> All Graviton processors after Graviton1 have support for the Large-System Extensions (LSE) which was first introduced in vArmv8.1. LSE provides low-cost atomic operations which can improve system throughput for CPU-to-CPU communication, locks, and mutexes.


## case_id: arm64-lse-dmesg-lscpu-deploy-verify-percona-02

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-graviton
- **scope**: other
- **case_pattern**: parameter-best-practice
- **title**: Graviton2 部署后用 dmesg/lscpu 验证 LSE 原子指令已被内核检测启用
- **recommendation_value**: `sudo dmesg
- **recommendation_layer**: other
- **detection_layer**: os
- **related_param_names**: `["LSE", "dmesg", "lscpu", "atomics"]`
- **risk_severity**: warning
- **source_url**: https://dev.to/aws-builders/large-system-extensions-for-aws-graviton-processors-3eci
- **source_authority**: community-canonical
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> All of the AWS EC2 instances based on the Neoverse-N1 processor, M6g, T4g, C6g, and R6g as well as the C7g include the atomic instructions. One of the common performance issues when migrating to Graviton2 is running software that does not utilize LSE.

### recommendation_quote

> sudo dmesg | grep LSE

### rationale_quote

> The atomic instructions result in faster performance and less variability.

### risk_quote

> One of the common performance issues when migrating to Graviton2 is running software that does not utilize LSE. Software built with load exclusives and store exclusives usually runs slower on Graviton2 instances.


## case_id: bp-linux-fs-mount-noatime-xfs-rdb-server-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **scope**: linux-fs
- **case_pattern**: parameter-best-practice
- **title**: XFS 数据盘 mount 加 noatime · 避免读取时更新 access time 浪费资源
- **recommendation_value**: `mount -o noatime (XFS data disk)`
- **recommendation_layer**: linux-mount-option
- **detection_layer**: os
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0006.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 通常情况下，我们对文件的操作更多是读取而不是写入，而且我们很少需要关注一个文件最近被访问的时间。

### recommendation_quote

> 建议在文件系统的mount参数上加上noatime、nobarrier两个选项，其中数据盘以及数据目录以实际为准。

### risk_quote

> 文件系统不再记录访问时间，可以避免不必要的资源浪费。


## case_id: bp-linux-fs-mount-nobarrier-xfs-battery-backed-storage-02

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **scope**: linux-fs
- **case_pattern**: parameter-best-practice
- **title**: 底层存储具备掉电保护(RAID/Flash)时 · XFS 数据盘 mount 加 nobarrier · 避免 write barrier 性能损失
- **recommendation_value**: `mount -o nobarrier (XFS data disk; storage with battery-backed cache; not openEuler)`
- **recommendation_layer**: linux-mount-option
- **detection_layer**: os
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0006.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 我们数据库服务器底层存储设备要么采用RAID控制卡，RAID控制卡本身的电池可以掉电保护；要么采用Flash卡，它也有自我保护机制，保证数据不会丢失。

### recommendation_quote

> 对于ext3、ext4和reiserfs文件系统可以在mount时指定barrier=0。对于XFS可以指定nobarrier选项。

### rationale_quote

> 许多文件系统在数据提交时会使用write barriers来强制刷新Cache，以避免数据丢失。但是，其实我们数据库服务器底层存储设备要么采用RAID控制卡，RAID控制卡本身的电池可以掉电保护；要么采用Flash卡，它也有自我保护机制，保证数据不会丢失。


## case_id: os-net-tcp-tw-reuse-enable-mongo-client-02

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **scope**: linux-net
- **case_pattern**: parameter-best-practice
- **title**: MongoDB 客户端启用 tcp_tw_reuse 让 TIME-WAIT socket 可复用以新建连接
- **recommendation_value**: `net.ipv4.tcp_tw_reuse = 1`
- **recommendation_layer**: os-sysctl
- **related_param_names**: `["net.ipv4.tcp_tw_reuse"]`
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### recommendation_quote

> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。


## case_id: os-net-somaxconn-mongo-client-65535-03

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **scope**: linux-net
- **case_pattern**: parameter-best-practice
- **title**: MongoDB 客户端 listen() backlog 上限 somaxconn 调至 65535 防 accept 队列溢出
- **recommendation_value**: `net.core.somaxconn = 65535`
- **recommendation_layer**: os-sysctl
- **related_param_names**: `["net.core.somaxconn"]`
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### recommendation_quote

> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。


## case_id: os-net-netdev-max-backlog-mongo-client-8096-04

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **scope**: linux-net
- **case_pattern**: parameter-best-practice
- **title**: MongoDB 客户端调大 netdev_max_backlog 至 8096 避免高入流量丢包
- **recommendation_value**: `net.core.netdev_max_backlog = 8096`
- **recommendation_layer**: os-sysctl
- **related_param_names**: `["net.core.netdev_max_backlog"]`
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### recommendation_quote

> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。


## case_id: os-net-tcp-max-syn-backlog-mongo-client-8192-05

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **scope**: linux-net
- **case_pattern**: parameter-best-practice
- **title**: MongoDB 客户端调大 tcp_max_syn_backlog 至 8192 防 SYN 队列溢出
- **recommendation_value**: `net.ipv4.tcp_max_syn_backlog = 8192`
- **recommendation_layer**: os-sysctl
- **related_param_names**: `["net.ipv4.tcp_max_syn_backlog"]`
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### recommendation_quote

> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。


## case_id: os-net-tcp-fin-timeout-mongo-client-30s-07

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **scope**: linux-net
- **case_pattern**: parameter-best-practice
- **title**: MongoDB 客户端调小 tcp_fin_timeout 至 30 秒缩短 FIN-WAIT-2 占用
- **recommendation_value**: `net.ipv4.tcp_fin_timeout = 30`
- **recommendation_layer**: os-sysctl
- **related_param_names**: `["net.ipv4.tcp_fin_timeout"]`
- **risk_severity**: info
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### recommendation_quote

> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。


## case_id: os-net-tcp-max-tw-buckets-mongo-client-3000-08

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **scope**: linux-net
- **case_pattern**: parameter-best-practice
- **title**: MongoDB 客户端调小 tcp_max_tw_buckets 至 3000 加快 TIME-WAIT 强制回收
- **recommendation_value**: `net.ipv4.tcp_max_tw_buckets = 3000`
- **recommendation_layer**: os-sysctl
- **related_param_names**: `["net.ipv4.tcp_max_tw_buckets"]`
- **risk_severity**: info
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### recommendation_quote

> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。


## case_id: linux-mm-vm-dirty-ratio-5-kunpeng-dbs-os-cache-tuning-02

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **scope**: linux-mm
- **case_pattern**: parameter-best-practice
- **title**: 鲲鹏 BoostKit 数据库场景 vm.dirty_ratio 设为 5 限制脏页堆积
- **recommendation_value**: `vm.dirty_ratio=5`
- **recommendation_layer**: os-sysctl
- **related_param_names**: `["vm.dirty_ratio","vm.dirty_background_ratio","vm.dirty_writeback_centisecs"]`
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0017.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 对于不同系统的内存使用情况，通过在OS层面调整一些缓存相关参数配置，可以有效提升服务器性能。

### recommendation_quote

> 将dirty_ratio参数设置为“5”。


## case_id: kvm-vcpu-placement-static-cpuset-numa-affinity-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-sched
- **case_pattern**: parameter-best-practice
- **title**: KVM 虚拟机部署 mongod 时 · vcpu placement=static + cpuset 限定 worker 线程范围 · 防跨 NUMA 跨 DIE
- **recommendation_value**: `vcpu placement='static' cpuset='<同 NUMA 节点 cpu 列表 · 例 4-7>'(用 cpuset 把 IO/worker threads 限定在同一 NUMA / DIE)`
- **recommendation_layer**: other
- **related_param_names**: `["vcpu placement", "cpuset", "emulatorpin"]`
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0019.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> vcpu placement = 'static' cpuset='4-7'：该参数用于IO线程或worker threads线程时仅能使用4～7这4个核。

### recommendation_quote

> vcpu placement = 'static' cpuset='4-7'：该参数用于IO线程或worker threads线程时仅能使用4～7这4个核。

### risk_quote

> 若不配置此参数，虚拟机任务线程会在CPU任意core上浮动，会存在更多的跨NUMA和跨DIE损耗。


## case_id: os-kvm-vm-hugepages-allocate-tlb-miss-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-mm
- **case_pattern**: parameter-best-practice
- **title**: KVM 虚拟化场景为 mongod 虚机分配 512MB 大页(Host kernel cmdline + VM xml memoryBacking)
- **recommendation_value**: `default_hugepagesz=512M hugepagesz=512M hugepages=256`
- **recommendation_layer**: kernel-cmdline
- **detection_layer**: os
- **related_param_names**: `["default_hugepagesz", "hugepagesz", "hugepages", "vm.nr_hugepages", "libvirt.domain.memoryBacking.hugepages"]`
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0021.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> KVM虚拟化场景下，配置内存大页时，至少要预留总内存的15%给Host。

### recommendation_quote

> 在Linux字段一行的最后输入以下配置。 1 default_hugepagesz=512M hugepagesz=512M hugepages=256 pci=realloc


## case_id: linux-block-read-ahead-kb-sequential-io-4096-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-block
- **case_pattern**: parameter-best-practice
- **title**: 磁盘顺序读场景下将 read_ahead_kb 从默认 128KB 调大至 4096KB 以充分利用预取性能提升
- **recommendation_value**: `read_ahead_kb = 4096`
- **recommendation_layer**: other
- **detection_layer**: os
- **related_param_names**: `["/sys/block/$DEVICE-NAME/queue/read_ahead_kb"]`
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0039.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 如果预读的数据是后续会使用的数据，那么系统性能会提升，如果后续不使用，就浪费了磁盘带宽。在磁盘顺序读的场景下，调大预取值效果会尤其明显。

### recommendation_quote

> 此参数的默认值128KB，可使用echo来调整，仍以CentOS为例，将预取值调整为4096KB：1# echo 4096 > /sys/block/$DEVICE-NAME/queue/read_ahead_kb

### rationale_quote

> 文件预取的原理，就是根据局部性原理，在读取数据时，会多读一定量的相邻数据缓存到内存。如果预读的数据是后续会使用的数据，那么系统性能会提升


## case_id: linux-fs-xfs-blocksize-large-file-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-fs
- **case_pattern**: parameter-best-practice
- **title**: 大文件操作场景使用 XFS 文件系统并将 blocksize 设为 8192B 以提升 I/O 吞吐
- **recommendation_value**: `mkfs.xfs -b size=8192`
- **recommendation_layer**: linux-mount-option
- **related_param_names**: `["mkfs.xfs", "-b size"]`
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0041.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> XFS文件系统在创建时，可先选择加大文件系统的block，更加适用于大文件的操作场景。

### recommendation_quote

> mkfs.xfs /dev/sda1 -b size=8192


## case_id: app-malloc-jemalloc-multithread-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **scope**: mem-allocator-jemalloc
- **case_pattern**: parameter-best-practice
- **title**: 多线程高并发场景下应用链接 jemalloc 替代 glibc 默认分配器以减少锁竞争
- **recommendation_value**: `-ljemalloc`
- **recommendation_layer**: other
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0051.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> jemalloc是一款内存分配器，与其它内存分配器（glibc）相比，其最大优势在于多线程场景下内存分配性能高以及内存碎片减少。充分发挥鲲鹏芯片多核多并发优势，推荐业务应用代码使用jemalloc进行内存分配。

### recommendation_quote

> 修改应用软件的链接库的方式，在编译选项中添加如下编译选项：-I`jemalloc-config --includedir`-L`jemalloc-config --libdir` -Wl,-rpath,`jemalloc-config --libdir` -ljemalloc `jemalloc-config --libs`

### risk_quote

> 在内存分配过程中，锁会造成线程等待，对性能影响巨大。


## case_id: mongo-txn-long-running-wt-cache-pressure

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: app-other
- **case_pattern**: parameter-best-practice
- **title**: 长事务导致 WiredTiger 缓存压力：拆分事务并确保索引覆盖
- **recommendation_layer**: app-other
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/resources/products/capabilities/performance-best-practices-transactions-and-read-write-concerns
- **source_authority**: official
- **source_url_lang**: en
- **database_version_min**: 4.0.0
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh

### scenario_description_quote

> Creating long-running transactions, or attempting to perform an excessive number of operations in a single ACID transaction can result in high pressure on the WiredTiger storage engine cache.

### recommendation_quote

> the transaction should be broken into smaller parts that allow execution within the configured time limit. You should also ensure your query patterns are properly optimized with the appropriate index coverage to allow fast data access within the transaction.

### rationale_quote

> the cache must maintain state for all subsequent writes since the oldest snapshot was created. As a transaction always uses the same snapshot while it is running, new writes accumulate in the cache throughout the duration of the transaction. These writes cannot be flushed until transactions currently running on old snapshots commit or abort, at which time the transactions release their locks and WiredTiger can evict the snapshot.

### risk_quote

> Creating long-running transactions, or attempting to perform an excessive number of operations in a single ACID transaction can result in high pressure on the WiredTiger storage engine cache.


## case_id: mongo-txn-modify-1000-docs-max-batch

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: app-other
- **case_pattern**: parameter-best-practice
- **title**: 单次事务修改文档上限 1000 条：超出须拆批处理
- **recommendation_layer**: app-other
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/resources/products/capabilities/performance-best-practices-transactions-and-read-write-concerns
- **source_authority**: official
- **source_url_lang**: en
- **database_version_min**: 4.0.0
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh

### scenario_description_quote

> There are no hard limits to the number of documents that can be read within a transaction. As a best practice, no more than 1,000 documents should be modified within a transaction.

### recommendation_quote

> For operations that need to modify more than 1,000 documents, developers should break the transaction into separate parts that process documents in batches.

### rationale_quote

> Creating long-running transactions, or attempting to perform an excessive number of operations in a single ACID transaction can result in high pressure on the WiredTiger storage engine cache. This is because the cache must maintain state for all subsequent writes since the oldest snapshot was created.

### risk_quote

> Creating long-running transactions, or attempting to perform an excessive number of operations in a single ACID transaction can result in high pressure on the WiredTiger storage engine cache.


## case_id: mongo-read-concern-linearizable-maxtimems

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: app-query-layer
- **case_pattern**: parameter-best-practice
- **title**: linearizable 读关注配合 maxTimeMS 防止操作无限挂起
- **recommendation_layer**: mongodb-config
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/resources/products/capabilities/performance-best-practices-transactions-and-read-write-concerns
- **source_authority**: official
- **source_url_lang**: en
- **database_version_min**: 3.4.0
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh

### scenario_description_quote

> MongoDB supports a readConcern level of "Linearizable". The linearizable read concern ensures that a node is still the primary member of the replica set at the time of the read and that the data it returns will not be rolled back if another node is subsequently elected as the new primary member.

### recommendation_quote

> Configuring this read concern level can have a significant impact on latency, therefore a maxTimeMS value should be supplied in order to timeout long-running operations.

### rationale_quote

> Configuring this read concern level can have a significant impact on latency, therefore a maxTimeMS value should be supplied in order to timeout long-running operations.

### risk_quote

> Configuring this read concern level can have a significant impact on latency, therefore a maxTimeMS value should be supplied in order to timeout long-running operations.


## case_id: linux-block-journal-separate-volume-mongodb-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-block
- **case_pattern**: parameter-best-practice
- **title**: MongoDB Journal 和系统日志应使用独立物理卷，避免日志 IO 竞争数据盘带宽
- **recommendation_layer**: linux-block
- **risk_severity**: warning
- **source_url**: https://mongoing.com/archives/3895
- **source_authority**: community-canonical
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> MongoDB很多的性能瓶颈和IO相关。建议为日志盘（Journal和系统日志）单独设定一个物理卷，减少对数据盘IO的资源占用。

### recommendation_quote

> 建议为日志盘（Journal和系统日志）单独设定一个物理卷，减少对数据盘IO的资源占用。

### rationale_quote

> MongoDB很多的性能瓶颈和IO相关。建议为日志盘（Journal和系统日志）单独设定一个物理卷，减少对数据盘IO的资源占用。


## case_id: app-other-write-concern-majority-mongodb-failover-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: app-other
- **case_pattern**: parameter-best-practice
- **title**: 重要数据写入应使用 w:majority，防止主节点故障转移时写操作被回滚
- **recommendation_value**: `w = "majority"`
- **recommendation_layer**: mongodb-config
- **risk_severity**: critical
- **source_url**: https://mongoing.com/archives/3895
- **source_authority**: community-canonical
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 默认情况下应用的写操作（更新，插入或者删除）在主节点上完成后就会立即返回。写操作则通过OPLOG方式在后台异步方式复制到其他节点。在极端情况下，这些写操作可能还未在复制到从节点的时候主节点就出现宕机。这个时候发生主备节点切换，原主节点的写操作会被回滚到文件而对应用不可见。

### recommendation_quote

> MongoDB建议对重要的数据使用 {w: "majority"} 的选项。{w: "majority"} 可以保证数据在复制到多数节点后才返回成功结果。使用该机制可以有效防止数据回滚的发生。

### rationale_quote

> {w: "majority"} 可以保证数据在复制到多数节点后才返回成功结果。使用该机制可以有效防止数据回滚的发生。

### risk_quote

> 这个时候发生主备节点切换，原主节点的写操作会被回滚到文件而对应用不可见。


## case_id: linux-block-nvme-wt-dirty-eviction-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-block
- **case_pattern**: parameter-best-practice
- **title**: WiredTiger 高脏页率 + 高 modified evictions 场景应换用 NVMe 替代机械盘
- **recommendation_value**: `NVMe instead of spinning disk`
- **recommendation_layer**: other
- **detection_layer**: mongo-shell
- **related_param_names**: `["storage.dbPath"]`
- **risk_severity**: warning
- **source_url**: https://oneuptime.com/blog/post/2026-03-31-mongodb-wiredtiger-storage-engine/view
- **source_authority**: community-canonical
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> High dirty % combined with high modified page evictions indicates that WiredTiger is struggling to flush dirty pages fast enough.

### recommendation_quote

> Use faster storage (NVMe instead of spinning disk).


## case_id: kunpeng-bios-smmu-disable-non-virt-db-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **scope**: other
- **case_pattern**: parameter-best-practice
- **title**: 鲲鹏平台非虚拟化场景下 · 在 BIOS 中关闭 SMMU 以避免数据库 IO 开销
- **recommendation_value**: `Support Smmu = Disable`
- **recommendation_layer**: bios-firmware
- **related_param_names**: `["bios.advanced.misc_config.support_smmu"]`
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0007.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 此优化项只在非虚拟化场景使用，在虚拟化场景，则开启SMMU。

### recommendation_quote

> 将“Support Smmu”设置为“Disable”

### rationale_quote

> 因为数据库通常会使用大量的内存和IO资源，而SMMU会增加额外的开销和延迟

### risk_quote

> SMMU会增加额外的开销和延迟，从而降低系统的性能


## case_id: kunpeng-bios-cpu-prefetch-disable-db-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **scope**: other
- **case_pattern**: parameter-best-practice
- **title**: 鲲鹏平台数据库场景 · 在 BIOS 中关闭 CPU 硬件预取以避免无效缓存流量
- **recommendation_value**: `CPU Prefetching Configuration = Disabled`
- **recommendation_layer**: bios-firmware
- **related_param_names**: `["bios.advanced.misc_config.cpu_prefetching_configuration"]`
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0007.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 硬件预取是通过跟踪指令和数据地址的变化，将指令和地址提前读到Cache里，硬件预取对数据库场景的性能有影响

### recommendation_quote

> 将“CPU Prefetching Configuration”设置为“Disabled”


## case_id: kunpeng-net-irq-affinity-bind-all-queues-to-local-numa-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **scope**: linux-net
- **case_pattern**: parameter-best-practice
- **title**: 鲲鹏服务器手动绑定网卡中断到本地 NUMA · 关闭 irqbalance · 32 队列绑满获最佳网络性能
- **recommendation_value**: `所有 NIC IRQ 队列(典型 32 个)绑到本地 NUMA CPU · /proc/irq/<N>/smp_affinity_list = 本地 NUMA 核 ID(前置:irqbalance 关闭)`
- **recommendation_layer**: os-sysctl
- **detection_layer**: os
- **related_param_names**: `["irqbalance.service.active_state", "/proc/irq/<N>/smp_affinity_list", "/proc/irq/<N>/smp_affinity"]`
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0013.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, rationale_quote_lang, risk_zh, recommendation_value, violation_pattern_quote

### scenario_description_quote

> 网卡中断绑核。对于不同的硬件配置，用于绑中断的最佳CPU数目会有差异，比如对于鲲鹏920 5250处理器 + Huawei TM280 25G网卡（鲲鹏服务器的板载网卡）来说，最多可以绑定32个中断队列，建议将所有的队列都用在中断绑定上来获得最佳性能。

### recommendation_quote

> 对于不同的硬件配置，用于绑中断的最佳CPU数目会有差异，比如对于鲲鹏920 5250处理器 + Huawei TM280 25G网卡（鲲鹏服务器的板载网卡）来说，最多可以绑定32个中断队列，建议将所有的队列都用在中断绑定上来获得最佳性能。


## case_id: linux-thp-disabled-db-mem-fragmentation-bp-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **scope**: linux-mm
- **case_pattern**: parameter-best-practice
- **title**: 数据库场景下关闭透明大页(THP)以减少内存碎片与利用率下降
- **recommendation_value**: `transparent_hugepage/enabled=never AND transparent_hugepage/defrag=never`
- **recommendation_layer**: os-sysctl
- **detection_layer**: os
- **related_param_names**: `["/sys/kernel/mm/transparent_hugepage/enabled","/sys/kernel/mm/transparent_hugepage/defrag"]`
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0016.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 传统的malloc在分配和释放内存时会造成内存碎片，这会导致内存的利用率下降，甚至会导致内存不足的情况。

### recommendation_quote

> echo never > /sys/kernel/mm/transparent_hugepage/enabled echo never > /sys/kernel/mm/transparent_hugepage/defrag

### risk_quote

> 这会导致内存的利用率下降，甚至会导致内存不足的情况。


## case_id: os-blockdev-scheduler-not-deadline-mysql-db-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-block
- **case_pattern**: parameter-best-practice
- **title**: 数据库场景下 · 块设备 IO 调度器配置为 deadline(NVMe 除外)
- **recommendation_value**: `/sys/block/${device}/queue/scheduler = deadline`
- **recommendation_layer**: os-sysctl
- **detection_layer**: os
- **related_param_names**: `["/sys/block/${device}/queue/scheduler"]`
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0018.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 对于不同的IO设备，通过在OS层面调整一些IO相关参数配置，可以有效提升服务器性能。

### recommendation_quote

> echo deadline > /sys/block/${device}/queue/scheduler


## case_id: os-blockdev-nr-requests-too-low-disk-throughput-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-block
- **case_pattern**: parameter-best-practice
- **title**: 数据库高并发写入场景下 · 块设备 nr_requests 调到 2048 提升磁盘吞吐
- **recommendation_value**: `/sys/block/${device}/queue/nr_requests = 2048`
- **recommendation_layer**: os-sysctl
- **detection_layer**: os
- **related_param_names**: `["/sys/block/${device}/queue/nr_requests"]`
- **risk_severity**: warning
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0018.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 对于不同的IO设备，通过在OS层面调整一些IO相关参数配置，可以有效提升服务器性能。

### recommendation_quote

> echo 2048 > /sys/block/${device}/queue/nr_requests


## case_id: bp-linux-net-nic-interrupt-coalescing-static-kunpeng-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **scope**: linux-net
- **case_pattern**: parameter-best-practice
- **title**: 鲲鹏网卡性能调优：禁用自适应中断聚合（adaptive-rx/tx off），使用静态 ethtool -C 参数
- **recommendation_value**: `adaptive-rx off, adaptive-tx off`
- **recommendation_layer**: other
- **risk_severity**: info
- **source_url**: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0027.html
- **source_authority**: official
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 中断聚合特性允许网卡收到报文之后不立即产生中断，而是等待一小段时间有更多的报文到达之后再产生中断，这样就能让CPU一次中断处理多个报文，减少开销。

### recommendation_quote

> 为了确保使用静态值，需禁用自适应调节，关闭Adaptive RX和Adaptive TX。

### risk_quote

> 当增大聚合度时，单个数据包的延时会以微秒的级别增加。


## case_id: os-mongod-maxincomingconnections-high-conn-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-x86_64-generic
- **scope**: app-other
- **case_pattern**: parameter-best-practice
- **title**: MongoDB maxIncomingConnections: raise above default 64k for high-connection deployments
- **recommendation_value**: `maxIncomingConnections = 999999`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["maxIncomingConnections"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> Even MongoDB itself has an option to limit the maximum number of incoming connections . It defaults to 64k.

### recommendation_quote

> maxIncomingConnections: 999999


## case_id: os-ulimit-nofile-high-conn-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-x86_64-generic
- **scope**: linux-net
- **case_pattern**: parameter-best-practice
- **title**: Linux ulimit nofile: raise open-file descriptor limit for high-connection MongoDB servers
- **recommendation_value**: `nofile = 9999999`
- **recommendation_layer**: os-sysctl
- **related_param_names**: `["nofile"]`
- **risk_severity**: critical
- **source_url**: https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> RHEL ships with default ulimit and other configurations that are appropriate for your laptop, and to really get the full performance of a large production server you need to do a lot of tuning to increase various limits and buffers.

### recommendation_quote

> echo "ec2-user soft nofile 9999999" | sudo tee -a /etc/security/limits.conf

### rationale_quote

> TCP/IP connections are open files as far as ulimit is concerned.


## case_id: os-ulimit-nproc-high-conn-02

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-x86_64-generic
- **scope**: linux-sched
- **case_pattern**: parameter-best-practice
- **title**: Linux ulimit nproc: raise thread count limit for high-connection MongoDB deployments
- **recommendation_value**: `nproc = 9999999`
- **recommendation_layer**: os-sysctl
- **related_param_names**: `["nproc"]`
- **risk_severity**: critical
- **source_url**: https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> RHEL ships with default ulimit and other configurations that are appropriate for your laptop, and to really get the full performance of a large production server you need to do a lot of tuning to increase various limits and buffers.

### recommendation_quote

> echo "ec2-user soft nproc 9999999" | sudo tee -a /etc/security/limits.conf

### rationale_quote

> For historical reasons, nproc is really the number of threads. Historically a Linux process was a single thread and concurrent workloads were multi-process.


## case_id: os-ulimit-stack-high-conn-03

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-x86_64-generic
- **scope**: linux-mm
- **case_pattern**: parameter-best-practice
- **title**: Linux ulimit stack: raise per-thread stack size limit for high-connection MongoDB deployments
- **recommendation_value**: `stack = 9999999`
- **recommendation_layer**: os-sysctl
- **related_param_names**: `["stack"]`
- **risk_severity**: critical
- **source_url**: https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> RHEL ships with default ulimit and other configurations that are appropriate for your laptop, and to really get the full performance of a large production server you need to do a lot of tuning to increase various limits and buffers.

### recommendation_quote

> echo "ec2-user soft stack 9999999" | sudo tee -a /etc/security/limits.conf

### rationale_quote

> Threads allocate memory from the stack, which also has a maximum size.


## case_id: os-vm-max-map-count-thread-mmap-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-x86_64-generic
- **scope**: linux-mm
- **case_pattern**: parameter-best-practice
- **title**: vm.max_map_count: raise kernel mmap limit when running many threads (MongoDB high-connection)
- **recommendation_value**: `vm.max_map_count = 9999999`
- **recommendation_layer**: os-sysctl
- **related_param_names**: `["vm.max_map_count"]`
- **risk_severity**: critical
- **source_url**: https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> Creating threads uses mmap to allocate memory from stack. And on the kernel level there's a setting for max number of mmapped memory blocks per process, which must be increased too

### recommendation_quote

> echo "vm.max_map_count=9999999" | sudo tee -a /etc/sysctl.conf

### rationale_quote

> Creating threads uses mmap to allocate memory from stack. And on the kernel level there's a setting for max number of mmapped memory blocks per process, which must be increased too


## case_id: os-net-ip-local-port-range-client-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-x86_64-generic
- **scope**: linux-net
- **case_pattern**: parameter-best-practice
- **title**: net.ipv4.ip_local_port_range: expand ephemeral port range on benchmark/client hosts
- **recommendation_value**: `net.ipv4.ip_local_port_range = 1024 65530`
- **recommendation_layer**: os-sysctl
- **related_param_names**: `["net.ipv4.ip_local_port_range"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> I was surprised to learn that by default Linux wouldn't even use the full range of 65k ports that TCP has possible. Even this had to be configured

### recommendation_quote

> echo "net.ipv4.ip_local_port_range = 1024 65530" | sudo tee -a /etc/sysctl.conf


## case_id: mongo-replica-set-data-durability-three-voting-majority-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: app-other
- **case_pattern**: parameter-best-practice
- **title**: 副本集部署需 ≥3 个数据承载 voting 成员 + 写操作走 w:majority · 否则数据耐久性无法满足
- **recommendation_value**: `replica set ≥ 3 data-bearing voting members + write concern w: majority`
- **recommendation_layer**: mongodb-config
- **detection_layer**: mongo-runtime-cmd
- **related_param_names**: `["replication.replSetName","writeConcern","members[].votes","members[].arbiterOnly"]`
- **risk_severity**: critical
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-checklist-development/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> Ensure that your replica set includes at least three data-bearing voting members and that your write operations use

### recommendation_quote

> Ensure that your replica set includes at least three data-bearing voting members


## case_id: mongo-replica-set-odd-voting-members-elections-02

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: app-other
- **case_pattern**: parameter-best-practice
- **title**: 副本集投票成员需为奇数(最多 7 个)· 偶数时用 arbiter 凑奇数 · 否则选举平票卡死
- **recommendation_value**: `voting members ∈ {1,3,5,7} (odd, ≤7)`
- **recommendation_layer**: mongodb-config
- **detection_layer**: mongo-runtime-cmd
- **related_param_names**: `["members[].votes","members[].arbiterOnly","replSetReconfig"]`
- **risk_severity**: critical
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-checklist-development/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> If you have an even number of voting members, and constraints, such as cost, prohibit adding another secondary to be a voting member, you can add an arbiter to ensure an odd number of votes

### recommendation_quote

> Use an odd number of voting members to ensure that elections proceed successfully. You can have up to 7 voting members


## case_id: mongo-driver-connection-pool-size-110-115pct-concurrent-03

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: app-query-layer
- **case_pattern**: parameter-best-practice
- **title**: driver 连接池大小起点应为应用层"典型并发请求数 × 110-115%" · 池太小将请求排队
- **recommendation_value**: `connection pool size = 110-115% × typical concurrent database requests`
- **recommendation_layer**: other
- **detection_layer**: mongo-runtime-cmd
- **related_param_names**: `["maxPoolSize","minPoolSize","waitQueueTimeoutMS","maxIdleTimeMS"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-checklist-development/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> Make use of connection pooling. Most MongoDB drivers support connection pooling

### recommendation_quote

> Adjust the connection pool size to suit your use case, beginning at 110-115% of the typical number of concurrent database requests


## case_id: linux-fs-avoid-nfs-for-dbpath-checklist-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-fs
- **case_pattern**: parameter-best-practice
- **title**: dbPath 不要用 NFS · 用本地 / VMware 虚拟盘
- **recommendation_value**: `dbPath ∉ NFS · 用本地块设备 / VMware 虚拟盘`
- **recommendation_layer**: linux-mount-option
- **related_param_names**: `["dbPath","storage.dbPath"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-checklist-operations/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> Avoid using NFS drives for your ... dbPath. Using NFS drives can result in degraded and unstable performance.

### recommendation_quote

> Avoid using NFS drives for your ... dbPath. Using NFS drives can result in degraded and unstable performance.

### risk_quote

> Using NFS drives can result in degraded and unstable performance.


## case_id: linux-fs-xfs-strongly-recommended-for-wt-checklist-02

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-fs
- **case_pattern**: parameter-best-practice
- **title**: WiredTiger 数据盘强烈建议用 XFS · 不用 EXT4
- **recommendation_value**: `XFS for WT data drive (avoid EXT4 with WT)`
- **recommendation_layer**: linux-mount-option
- **related_param_names**: `["dbPath","storage.engine"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-checklist-operations/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> Linux/Unix: format your drives into XFS or EXT4. If possible, use XFS as it generally performs better with MongoDB.

### recommendation_quote

> With the WiredTiger storage engine, use of XFS is strongly recommended to avoid performance issues found when using EXT4 with WiredTiger.

### risk_quote

> use of XFS is strongly recommended to avoid performance issues found when using EXT4 with WiredTiger.


## case_id: linux-sched-customize-tuned-profile-rhel-centos-checklist-04

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-sched
- **case_pattern**: parameter-best-practice
- **title**: RHEL / CentOS 上用 tuned 时必须自定义 tuned profile
- **recommendation_value**: `customize tuned profile (THP per MongoDB version · readahead 8-32)`
- **recommendation_layer**: os-sysctl
- **related_param_names**: `["tuned.profile","vm.transparent_hugepage","block_device.read_ahead_kb"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-checklist-operations/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> If using tuned on RHEL / CentOS, you must customize your tuned profile.

### recommendation_quote

> If using tuned on RHEL / CentOS, you must customize your tuned profile.

### rationale_quote

> Many of the tuned profiles that ship with RHEL / CentOS can negatively impact performance with their default settings.

### risk_quote

> Many of the tuned profiles that ship with RHEL / CentOS can negatively impact performance with their default settings.


## case_id: linux-block-avoid-replica-set-members-same-san-checklist-05

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-block
- **case_pattern**: parameter-best-practice
- **title**: 副本集成员不要全放同一 SAN · 避免单点故障
- **recommendation_value**: `replica set members spread across ≥2 SANs (or mix SAN + local disk)`
- **recommendation_layer**: other
- **related_param_names**: `["replication.replSetName","storage.dbPath"]`
- **risk_severity**: critical
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-checklist-operations/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> Avoid placing all replica set members on the same SAN, as the SAN can be a single point of failure.

### recommendation_quote

> Avoid placing all replica set members on the same SAN, as the SAN can be a single point of failure.

### risk_quote

> Avoid placing all replica set members on the same SAN, as the SAN can be a single point of failure.


## case_id: os-net-tcp-keepalive-time-cloud-lb-120s-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-net
- **case_pattern**: parameter-best-practice
- **title**: 云 LB 后部署 mongod 时 · tcp_keepalive_time 设为 120 秒以避免静默断连
- **recommendation_value**: `net.ipv4.tcp_keepalive_time = 120`
- **recommendation_layer**: os-sysctl
- **detection_layer**: os
- **related_param_names**: `["net.ipv4.tcp_keepalive_time"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> If the TCP keepalive value is greater than the TCP idle timeout on your cloud provider's load balancer, there is a risk that the system might silently drop connections.

### recommendation_quote

> To reduce this risk, set tcp_keepalive_time to 120.

### risk_quote

> there is a risk that the system might silently drop connections.


## case_id: linux-block-raid-10-not-5-or-6-02

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-block
- **case_pattern**: parameter-best-practice
- **title**: 存储层用 RAID-10 · 不要用 RAID-5 / RAID-6
- **recommendation_value**: `RAID-10`(并明确反对 RAID-5 / RAID-6)
- **recommendation_layer**: other
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> For optimal performance in terms of the storage layer, use disks backed by RAID-10.

### recommendation_quote

> For optimal performance in terms of the storage layer, use disks backed by RAID-10.

### risk_quote

> RAID-5 and RAID-6 do not typically provide sufficient performance to support a MongoDB deployment.


## case_id: linux-fs-nfs-mount-options-bg-hard-nolock-noatime-nointr-03

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-fs
- **case_pattern**: parameter-best-practice
- **title**: 必须用 NFS 时 · /etc/fstab 加 bg / hard / nolock / noatime / nointr 选项
- **recommendation_value**: `/etc/fstab 挂载选项含 bg, hard, nolock, noatime, nointr`
- **recommendation_layer**: linux-mount-option
- **detection_layer**: os
- **related_param_names**: `["fstab","nfs mount options"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> With the WiredTiger storage engine, WiredTiger objects may be stored on remote file systems if the remote file system conforms to ISO/IEC 9945-1:1996 (POSIX.1).

### recommendation_quote

> If you decide to use NFS, add the following NFS options to your /etc/fstab file:

### risk_quote

> using a remote file system for storage may degrade performance.


## case_id: linux-block-use-ssd-for-random-io-04

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-block
- **case_pattern**: parameter-best-practice
- **title**: I/O 吞吐瓶颈时 · 优先用 SSD(SATA SSD 性价比好)而非堆贵转盘
- **recommendation_value**: `Use SSD if available and economical`
- **recommendation_layer**: other
- **risk_severity**: info
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> MongoDB has good results and a good price-performance ratio with SATA SSD (Solid State Disk).

### recommendation_quote

> Use SSD if available and economical.

### rationale_quote

> the random I/O performance increase with more expensive spinning drives is not that dramatic (only on the order of 2x). Using SSDs or increasing RAM may be more effective in increasing I/O throughput.

### risk_quote

> the random I/O performance increase with more expensive spinning drives is not that dramatic


## case_id: linux-mm-vm-swappiness-1-or-0-mongo-host-05

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-mm
- **case_pattern**: parameter-best-practice
- **title**: mongod 主机 vm.swappiness 设为 1 或 0(默认 60 太激进)
- **recommendation_value**: `vm.swappiness ∈ {0, 1}`(同机有 webserver 用 1 / dedicated 可用 0)
- **recommendation_layer**: os-sysctl
- **detection_layer**: os
- **related_param_names**: `["vm.swappiness","vm.force_cgroup_v2_swappiness"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> A setting of 60 tells the kernel to swap to disk often, and is the default value on many Linux distributions.

### recommendation_quote

> As such you should set vm.swappiness to either 1 or 0 depending on your application needs and cluster configuration.

### rationale_quote

> MongoDB performs best where swapping can be avoided or kept to a minimum, as retrieving data from swap will always be slower than accessing data in RAM.

### risk_quote

> retrieving data from swap will always be slower than accessing data in RAM.


## case_id: linux-mm-numactl-interleave-all-mongod-startup-07

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-mm
- **case_pattern**: parameter-best-practice
- **title**: NUMA 主机上 mongod 必须经 numactl --interleave=all 启动
- **recommendation_value**: `numactl --interleave=all <mongod-cmd>`
- **recommendation_layer**: mongodb-cli-flag
- **detection_layer**: os
- **related_param_names**: `["numactl","--interleave=all"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_authority**: official
- **source_url_lang**: en
- **database_version_min**: 2.0.0
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> Running MongoDB on a system with Non-Uniform Memory Access (NUMA) can cause a number of operational problems, including slow performance for periods of time and high system process usage.

### recommendation_quote

> When running MongoDB servers and clients on NUMA hardware, you should configure a memory interleave policy so that the host behaves in a non-NUMA fashion.

### rationale_quote

> Running MongoDB on a system with Non-Uniform Memory Access (NUMA) can cause a number of operational problems, including slow performance for periods of time and high system process usage.

### risk_quote

> slow performance for periods of time and high system process usage.


## case_id: linux-mm-vm-zone-reclaim-mode-disable-08

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-mm
- **case_pattern**: parameter-best-practice
- **title**: NUMA 主机上 vm.zone_reclaim_mode 必须设为 0 · 与 numactl 配套
- **recommendation_value**: `vm.zone_reclaim_mode = 0`
- **recommendation_layer**: os-sysctl
- **detection_layer**: os
- **related_param_names**: `["vm.zone_reclaim_mode"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> On Linux, you must disable zone reclaim and also ensure that your mongod and mongos instances are started by numactl, which is generally configured through your platform's init system.

### recommendation_quote

> On Linux, you must disable zone reclaim and also ensure that your mongod and mongos instances are started by numactl

### risk_quote

> If the NUMA configuration may degrade performance, MongoDB prints a warning.


## case_id: linux-sched-none-for-vm-cloud-09

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-sched
- **case_pattern**: parameter-best-practice
- **title**: VM / 云主机 + hypervisor 块设备 · I/O scheduler 用 none
- **recommendation_value**: `I/O scheduler = none`
- **recommendation_layer**: os-sysctl
- **related_param_names**: `["I/O scheduler","/sys/block/<dev>/queue/scheduler"]`
- **risk_severity**: info
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> For local block devices attached to a virtual machine instance via the hypervisor or hosted by a cloud hosting provider, the guest operating system should use the none scheduler for best performance.

### recommendation_quote

> the guest operating system should use the none scheduler for best performance.

### rationale_quote

> The none scheduler allows the operating system to defer I/O scheduling to the underlying hypervisor.

### risk_quote

> the guest operating system should use the none scheduler for best performance.


## case_id: linux-sched-mq-deadline-for-spinning-disk-10

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-sched
- **case_pattern**: parameter-best-practice
- **title**: 物理服务器 + 转盘 · I/O scheduler 用 mq-deadline
- **recommendation_value**: `I/O scheduler = mq-deadline`
- **recommendation_layer**: os-sysctl
- **related_param_names**: `["I/O scheduler","/sys/block/<dev>/queue/scheduler"]`
- **risk_severity**: info
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> For physical servers using spinning disks, the operating system should use the mq-deadline scheduler.

### recommendation_quote

> the operating system should use the mq-deadline scheduler.

### rationale_quote

> The mq-deadline scheduler caps maximum latency per request and maintains a good disk throughput that is best for disk-intensive database applications.


## case_id: linux-sched-kyber-for-multi-workload-11

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-sched
- **case_pattern**: parameter-best-practice
- **title**: 同 VM / 自建机房多负载混跑 · I/O scheduler 用 kyber(kernel 4.12+)
- **recommendation_value**: `I/O scheduler = kyber`(需 Linux kernel 4.12+)
- **recommendation_layer**: os-sysctl
- **related_param_names**: `["I/O scheduler"]`
- **risk_severity**: info
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> If you are running multiple workloads in the same VM or in your own data center, use the kyber scheduler.

### recommendation_quote

> use the kyber scheduler.


## case_id: linux-block-readahead-8-to-32-wt-12

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-block
- **case_pattern**: parameter-best-practice
- **title**: WiredTiger 引擎 · readahead 设 8~32 (sectors) · 不要更高
- **recommendation_value**: `blockdev --getra <dev> 结果 ∈ [8, 32]`
- **recommendation_layer**: os-sysctl
- **detection_layer**: os
- **related_param_names**: `["readahead","blockdev"]`
- **risk_severity**: info
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> Set the readahead setting between 8 and 32 regardless of storage media type (spinning disk, SSD, etc.).

### recommendation_quote

> Set the readahead setting between 8 and 32 regardless of storage media type (spinning disk, SSD, etc.).

### rationale_quote

> Higher readahead commonly benefits sequential I/O operations. Since MongoDB disk access patterns are generally random, using higher readahead settings provides limited benefit or potential performance degradation.

### risk_quote

> using higher readahead settings provides limited benefit or potential performance degradation.


## case_id: tls-crypto-ssl-symbol-version-mismatch-warn-13

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: tls-crypto
- **case_pattern**: parameter-best-practice
- **title**: mongod 启动时 libssl/libcrypto 符号版本警告 · 通常不影响 · 可用 objdump 核对
- **recommendation_value**: `用 objdump -T 核对 mongod 与系统库的符号版本是否兼容(忽略告警 / 或换库)`
- **recommendation_layer**: other
- **detection_layer**: log-grep
- **risk_severity**: info
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> On Linux platforms, you may observe one of the following statements in the MongoDB log:

### recommendation_quote

> you can use the following operations to determine the symbol versions that mongod expects:

### rationale_quote

> Typically these messages do not require intervention; however, you can use the following operations to determine the symbol versions that mongod expects

### risk_quote

> This procedure is neither exact nor exhaustive: many symbols used by mongod from the libcrypto library do not begin with CRYPTO_.


## case_id: linux-mm-kvm-reserve-full-vm-memory-15

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: linux-mm
- **case_pattern**: parameter-best-practice
- **title**: KVM 上跑 mongod · 为虚机预留全部内存 · 不禁用 balloon driver
- **recommendation_value**: `为 mongod KVM 虚机预留 (reserve) 全部分配内存 · 不禁用 balloon driver`
- **recommendation_layer**: other
- **related_param_names**: `["KVM reservation","virtio-balloon"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> KVM supports memory overcommitment, where you can assign more memory to your virtual machines than the physical machine has available. When memory is overcommitted, the hypervisor reallocates memory between the virtual machines.

### recommendation_quote

> To prevent negative performance impact from the balloon driver and memory overcommitment features, reserve the full amount of memory for the virtual machine running MongoDB.

### rationale_quote

> Reserving the appropriate amount of memory for the virtual machine prevents the balloon from inflating in the local operating system when there is memory pressure in the hypervisor.

### risk_quote

> when the balloon driver expands, it can interfere with MongoDB's memory management and affect MongoDB's performance.


## case_id: bp-mongo-pool-connecttimeoutms-network-latency-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: app-query-layer
- **case_pattern**: parameter-best-practice
- **title**: 应用侧操作慢但 DB 侧未见对应 · 设 connectTimeoutMS 防止驱动连接阶段无限等待
- **recommendation_value**: `connectTimeoutMS > longest network latency to any replica set member`
- **recommendation_layer**: other
- **related_param_names**: `["connectTimeoutMS"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> Slow application-side operation times ... server logs or the real time panel

### recommendation_quote

> Set connectTimeoutMS to a value greater than the longest network latency you have to a member of the set

### rationale_quote

> if a member has a latency of 10000 milliseconds, setting connectTimeoutMS to 5000 (milliseconds) prevents the driver from connecting to that member


## case_id: bp-mongo-pool-sockettimeoutms-firewall-half-close-02

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: app-query-layer
- **case_pattern**: parameter-best-practice
- **title**: 防火墙半关闭 socket · 设 socketTimeoutMS 为最慢 op 时长的 2~3 倍以确保 socket 总能释放
- **recommendation_value**: `socketTimeoutMS = 2~3 × longest legitimate operation duration`
- **recommendation_layer**: other
- **related_param_names**: `["socketTimeoutMS"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> A misconfigured firewall closes a socket connection incorrectly and the driver cannot detect that the connection closed improperly

### recommendation_quote

> Set socketTimeoutMS to two or three times the length of the slowest operation that the driver runs

### rationale_quote

> socketTimeoutMS to ensure that sockets are always closed


## case_id: bp-mongo-pool-minpoolsize-startup-warmup-03

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: app-query-layer
- **case_pattern**: parameter-best-practice
- **title**: 应用启动时连接创建占用过多时间 · 设 minPoolSize 预热池子
- **recommendation_value**: `minPoolSize = number of connections required at startup`
- **recommendation_layer**: other
- **related_param_names**: `["minPoolSize"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> The server logs or real time panel show that the application spends too much time creating new connections

### recommendation_quote

> Set minPoolSize to the number of connections you want to be available at startup

### rationale_quote

> The MongoClient instance ensures that number of connections exists at all times


## case_id: bp-mongo-pool-sockettimeoutms-not-for-server-cancel-use-maxtimems-06

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: app-query-layer
- **case_pattern**: parameter-best-practice
- **title**: 想取消服务端长 op 时不要用 socketTimeoutMS · 改用 maxTimeMS() 让服务端真正取消
- **recommendation_value**: `use maxTimeMS() instead of small socketTimeoutMS for server-side op cancellation`
- **recommendation_layer**: other
- **related_param_names**: `["socketTimeoutMS","maxTimeMS"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> Do not use socketTimeoutMS to prevent long-running server operations

### recommendation_quote

> use maxTimeMS() with queries so that the server can cancel long-running operations


## case_id: mongo-net-compressor-enable-bandwidth-reduction-03

- **entry_kind**: best-practice
- **db**: _common
- **platform**: bare
- **scope**: other
- **case_pattern**: parameter-best-practice
- **title**: Enable MongoDB network compression to reduce client-server bandwidth
- **recommendation_value**: `net.compression.compressors = snappy`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["net.compression.compressors"]`
- **risk_severity**: warning
- **source_url**: https://www.percona.com/blog/compression-methods-in-mongodb-snappy-vs-zstd/
- **source_authority**: community-canonical
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> This can further reduce the amount of data that needs to be transmitted between server and client over the network. This, in turn, requires less bandwidth and network resources, which can improve performance and reduce costs.

### recommendation_quote

> To enable network compression in mongod and mongos, you can specify the compression algorithm by adding the following line to the configuration file.

### risk_quote

> Note that network compression can have a significant impact on network performance and CPU usage.


## case_id: os-tuned-percona-mongodb-profile-rhel-centos-automated-01

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-x86_64-generic
- **scope**: other
- **case_pattern**: parameter-best-practice
- **title**: RHEL/CentOS 7+ 运行 MongoDB · 使用 tuned-percona-mongodb profile 一键自动化应用所有 Linux 调参
- **recommendation_value**: `sudo make enable`
- **recommendation_layer**: other
- **detection_layer**: os
- **related_param_names**: `["vm.swappiness","vm.dirty_ratio","vm.dirty_background_ratio","net.core.somaxconn"]`
- **risk_severity**: warning
- **source_url**: https://www.percona.com/blog/tuning-linux-for-mongodb-automated-tuning-redhat-and-centos/
- **source_authority**: community-canonical
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> tuned-percona-mongodb applies the following tunings (from the previous tuning article ) on a Redhat/CentOS 7+ host

### recommendation_quote

> sudo make enable

### rationale_quote

> performance-focused tuned profile for MongoDB on Linux


## case_id: os-cm-deploy-tuning-via-tuned-profile-not-direct-02

- **entry_kind**: best-practice
- **db**: _common
- **platform**: linux-x86_64-generic
- **scope**: other
- **case_pattern**: parameter-best-practice
- **title**: 使用配置管理工具（Puppet/Chef/Ansible）时 · 必须通过 tuned profile 部署调参而非直接修改系统文件
- **recommendation_value**: `configure those systems to deploy tunings via tuned profiles`
- **recommendation_layer**: other
- **related_param_names**: `[]`
- **risk_severity**: warning
- **source_url**: https://www.percona.com/blog/tuning-linux-for-mongodb-automated-tuning-redhat-and-centos/
- **source_authority**: community-canonical
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> If you use configuration management systems like Puppet, Chef, Salt, Ansible, etc., I suggest you configure those systems to deploy tunings via tuned profiles instead of applying tunings directly

### recommendation_quote

> configure those systems to deploy tunings via tuned profiles instead of applying tunings directly

### rationale_quote

> tunings are not overridden or ignored


## case_id: mongo-service-executor-adaptive-high-concurrency-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **case_pattern**: parameter-best-practice
- **title**: 高并发场景启用 serviceExecutor adaptive 实现网络 IO 复用
- **recommendation_value**: `serviceExecutor: adaptive`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["net.serviceExecutor"]`
- **risk_severity**: warning
- **source_url**: https://cloud.tencent.com/developer/news/710321
- **source_authority**: community-canonical
- **source_url_lang**: zh-cn
- **database_version_min**: 3.6.0
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 由于集群tps高，同时整点有大量推送，因此整点并发会更高，mongodb默认的一个请求一个线程这种模式将会严重影响系统负载，该默认配置不适合高并发的读写应用场景。

### recommendation_quote

> mongodb-3.6开始引入serviceExecutor: adaptive配置，该配置根据请求数动态调整网络线程数，并尽量做到网络IO复用来降低线程创建消耗引起的系统高负载问题。

### rationale_quote

> 加上serviceExecutor: adaptive配置后，借助boost:asio网络模块实现网络IO复用，同时实现网络IO和磁盘IO分离。这样高并发情况下，通过网络链接IO复用和mongodb的锁操作来控制磁盘IO访问线程数，最终降低了大量线程创建和消耗带来的高系统负载

### risk_quote

> 这样进一步加剧了系统负载，同时进一步增加了数据库的抖动，特别是在PHP这种短链接业务中更加明显，频繁的创建线程销毁线程造成系统高负债。


## case_id: mongo-wt-eviction-dirty-target-3pct-high-write-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **case_pattern**: parameter-best-practice
- **title**: 高写入负载下调低 eviction_dirty_target/trigger 让后台线程尽早淘汰脏页
- **recommendation_value**: `eviction_dirty_target=3%,eviction_dirty_trigger=25%`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["storage.wiredTiger.engineConfig.configString"]`
- **risk_severity**: critical
- **source_url**: https://cloud.tencent.com/developer/news/710321
- **source_authority**: community-canonical
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 调整cacheSize从120G到50G后，如果脏数据比例达到5%，则极端情况下如果淘汰速度跟不上客户端写入速度，这样还是容易引起I/O瓶颈，最终造成阻塞。

### recommendation_quote

> 优化调整存储引起配置如下: eviction_target: 75% eviction_trigger：97% eviction_dirty_target: %3 eviction_dirty_trigger：25% evict.threads_min：8 evict.threads_min：12

### rationale_quote

> 总体思想是让后台evict尽量早点淘汰脏页page到磁盘，同时调整evict淘汰线程数来加快脏数据淘汰，调整后mongostat及客户端超时现象进一步缓解。

### risk_quote

> 如果脏数据及内存占用比例进一步增加，那么用户线程就会开始做page淘汰，这是个非常危险的阻塞过程，造成用户请求验证阻塞


## case_id: mongo-wt-checkpoint-wait-25s-io-smoothing-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **case_pattern**: parameter-best-practice
- **title**: 高写入负载下缩短 checkpoint wait 周期至 25s 均摊 IO
- **recommendation_value**: `checkpoint=(wait=25,log_size=1GB)`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["storage.wiredTiger.engineConfig.configString"]`
- **risk_severity**: warning
- **source_url**: https://cloud.tencent.com/developer/news/710321
- **source_authority**: community-canonical
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 如果在两次checkpoint的时间间隔类evict淘汰线程淘汰的dirty page越少，那么积压的脏数据就会越多，也就是checkpoint的时候脏数据就会越多，造成checkpoint的时候大量的IO写盘操作。

### recommendation_quote

> checkpoint调整后的值如下: checkpoint=(wait=25,log_size=1GB)

### rationale_quote

> 如果我们把checkpoint的周期缩短，那么两个checkpoint期间的脏数据相应的也就会减少，磁盘IO 100%持续的时间也就会缩短。

### risk_quote

> 造成checkpoint的时候大量的IO写盘操作。


## case_id: mongo-ttl-expiry-offpeak-window-high-write-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: app-other
- **case_pattern**: parameter-best-practice
- **title**: 高写入集群将 TTL 过期删除窗口移至夜间低峰期规避白天 delete 高峰
- **recommendation_value**: `expireAfterSeconds=0`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["expireAfterSeconds"]`
- **risk_severity**: warning
- **source_url**: https://cloud.tencent.com/developer/news/710321
- **source_authority**: community-canonical
- **source_url_lang**: zh-cn
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 该集群总文档数百亿条，每条文档记录默认保存三天，业务随机散列数据到三天后任意时间点随机过期淘汰。由于文档数目很多，白天平峰监控可以发现从节点经常有大量delete操作，甚至部分时间点delete删除操作数已经超过了业务方读写流量

### recommendation_quote

> 考虑把delete过期操作放入夜间进行，过期索引添加方法如下: Db.collection.createIndex( { "expireAt": 1 }, { expireAfterSeconds: 0 } )

### rationale_quote

> 通过随机散列expireAt在三天后的凌晨任意时间点，即可规避白天高峰期触发过期索引引入的集群大量delete，从而降低了高峰期集群负载，最终减少业务平均时延及抖动。


## case_id: mongo-atlas-rolling-index-build-non-tolerant-workloads-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-other
- **case_pattern**: parameter-best-practice
- **title**: 对不能容忍 index build 期间性能下降的 workload 启用滚动方式构建索引
- **recommendation_value**: index build mode = rolling
- **recommendation_layer**: other
- **related_param_names**: `["operationProfiling.slowOpThresholdMs"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/atlas/performance-advisor/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> For workloads which cannot tolerate performance decrease due to index builds, consider building indexes in a rolling fashion

### recommendation_quote

> Enable building indexes in a rolling fashion

### risk_quote

> Building an index in a rolling fashion reduces the resiliency of your cluster and increases index build times


## case_id: wt-journal-commit-interval-high-throughput-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **case_pattern**: parameter-best-practice
- **title**: WiredTiger commitIntervalMs: increase to 200-300ms for higher write throughput
- **recommendation_value**: `storage.journal.commitIntervalMs = 200`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["storage.journal.commitIntervalMs", "storage.journal.enabled"]`
- **risk_severity**: warning
- **source_url**: https://dev.to/devaaai/complete-configuration-guide-for-maximum-read-and-write-performance-2bm6
- **source_authority**: community-canonical
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value


## case_id: wt-journal-disable-non-critical-max-write-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **case_pattern**: parameter-best-practice
- **title**: WiredTiger journal.enabled: disable for temporary/non-critical data to maximize write speed
- **recommendation_value**: `storage.journal.enabled = false`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["storage.journal.enabled", "storage.journal.commitIntervalMs"]`
- **risk_severity**: critical
- **source_url**: https://dev.to/devaaai/complete-configuration-guide-for-maximum-read-and-write-performance-2bm6
- **source_authority**: community-canonical
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value


## case_id: wt-block-compressor-none-max-write-speed-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **case_pattern**: parameter-best-practice
- **title**: WiredTiger blockCompressor: set to none for maximum write speed (no compression overhead)
- **recommendation_value**: `storage.wiredTiger.collectionConfig.blockCompressor = none`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["storage.wiredTiger.collectionConfig.blockCompressor"]`
- **risk_severity**: info
- **source_url**: https://dev.to/devaaai/complete-configuration-guide-for-maximum-read-and-write-performance-2bm6
- **source_authority**: community-canonical
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value


## case_id: wt-directory-per-db-separate-volumes-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-other
- **case_pattern**: parameter-best-practice
- **title**: storage.directoryPerDB: enable when using separate storage volumes for each database
- **recommendation_value**: `storage.directoryPerDB = true`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["storage.directoryPerDB", "storage.wiredTiger.engineConfig.directoryForIndexes"]`
- **risk_severity**: info
- **source_url**: https://dev.to/devaaai/complete-configuration-guide-for-maximum-read-and-write-performance-2bm6
- **source_authority**: community-canonical
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value


## case_id: mongo-oplog-size-high-write-update-workload-03

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: app-other
- **case_pattern**: parameter-best-practice
- **title**: oplogSizeMB 在高更新频率工作负载下调大——避免 oplog 空洞和从节点延迟
- **recommendation_value**: `replication.oplogSizeMB >= 1小时以上的oplog记录量`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["replication.oplogSizeMB"]`
- **risk_severity**: critical
- **source_url**: https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations
- **source_authority**: official
- **source_url_lang**: zh-cn
- **database_version_min**: 3.0.0
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 业务的workload属于数据量不大但更新很多的情况，oplog产生速度比较快

### recommendation_quote

> 此时适当调大oplogSizeMB可以使得oplog表能够覆盖更长时间的oplog记录，避免出现oplog记录空洞的问题。最佳实践为设置的oplogSize至少应可以保留1小时以上的oplog记录

### risk_quote

> 参数设置过小，可能会导致从节点跟不上而进入异常的RECOVERING状态；也有可能导致日志备份来不及覆盖所有oplog记录而出现空洞，进而无法进行按时间点恢复


## case_id: mongo-cursor-timeout-idle-resource-overhead-04

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: app-other
- **case_pattern**: parameter-best-practice
- **title**: cursorTimeoutMillis 调小降低空闲游标资源开销
- **recommendation_value**: `setParameter.cursorTimeoutMillis = 300000`
- **recommendation_layer**: mongodb-setparam
- **related_param_names**: `["setParameter.cursorTimeoutMillis"]`
- **risk_severity**: warning
- **source_url**: https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations
- **source_authority**: official
- **source_url_lang**: zh-cn
- **database_version_min**: 3.0.0
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 如果游标的空闲时间超过该阈值，则MongoDB会自动清理该游标

### recommendation_quote

> 不建议调大，为了降低空闲游标的资源开销，可以适当调小（比如300000）

### rationale_quote

> 为了降低空闲游标的资源开销，可以适当调小（比如300000）。无论何种场景，业务侧都应尽量避免出现长时间空闲游标的情况


## case_id: mongo-transaction-lifetime-long-wt-cache-pressure-05

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **case_pattern**: parameter-best-practice
- **title**: transactionLifetimeLimitSeconds 调小防长事务压垮 WiredTiger 缓存
- **recommendation_value**: `setParameter.transactionLifetimeLimitSeconds = 30`
- **recommendation_layer**: mongodb-setparam
- **related_param_names**: `["setParameter.transactionLifetimeLimitSeconds"]`
- **risk_severity**: critical
- **source_url**: https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations
- **source_authority**: official
- **source_url_lang**: zh-cn
- **database_version_min**: 4.0.0
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 如果事务的整体执行时间超过了此限制，会被标记为过期并被后台的周期性清理线程主动处理并abort掉

### recommendation_quote

> 可以适当调小（比如到30），不建议调大

### risk_quote

> 未提交的长事务可能会给WiredTiger存储引擎的缓存带来很大压力，一旦缓存压力超载通常会带来更多问题，包括数据库卡顿、请求延迟大幅增加、CPU使用率满等，导致业务受损


## case_id: mongo-wt-block-compressor-cold-data-zstd-06

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **case_pattern**: parameter-best-practice
- **title**: 冷数据存储场景将 blockCompressor 改为 zstd 提升压缩比
- **recommendation_value**: `storage.wiredTiger.collectionConfig.blockCompressor = zstd`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["storage.wiredTiger.collectionConfig.blockCompressor"]`
- **risk_severity**: info
- **source_url**: https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations
- **source_authority**: official
- **source_url_lang**: zh-cn
- **database_version_min**: 4.2.0
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 如果实例主要用来存储冷数据，那么为了获得更高的压缩比，可以考虑将此参数修改为zstd

### recommendation_quote

> 可以考虑将此参数修改为zstd

### rationale_quote

> 不同的压缩算法有着不同的表现，有的压缩率更高但压缩和解压时的CPU开销更大


## case_id: mongo-tcmalloc-aggressive-decommit-oom-fragment-07

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: app-other
- **case_pattern**: parameter-best-practice
- **title**: tcmallocAggressiveMemoryDecommit 在内存 OOM/碎片场景启用加速内存回收
- **recommendation_value**: `setParameter.tcmallocAggressiveMemoryDecommit = 1`
- **recommendation_layer**: mongodb-setparam
- **related_param_names**: `["setParameter.tcmallocAggressiveMemoryDecommit"]`
- **risk_severity**: warning
- **source_url**: https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations
- **source_authority**: official
- **source_url_lang**: zh-cn
- **database_version_min**: 4.2.0
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 因为查询请求消耗过大，内存来不及回收而出现mongod节点OOM的情况。随着不断使用，堆内存碎片空间越来越多，表现上为内存使用率超过80%且稳定缓慢上升

### recommendation_quote

> 有内存相关问题时可以考虑在业务低峰期时调整


## case_id: mongo-snapshot-history-window-no-atclustertime-08

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **case_pattern**: parameter-best-practice
- **title**: 不使用历史快照读时将 minSnapshotHistoryWindowInSeconds 调小到 0 释放 WT 缓存压力
- **recommendation_value**: `setParameter.minSnapshotHistoryWindowInSeconds = 0`
- **recommendation_layer**: mongodb-setparam
- **related_param_names**: `["setParameter.minSnapshotHistoryWindowInSeconds", "setParameter.maxTargetSnapshotHistoryWindowInSeconds"]`
- **risk_severity**: warning
- **source_url**: https://help.aliyun.com/zh/mongodb/user-guide/parameter-tuning-recommendations
- **source_authority**: official
- **source_url_lang**: zh-cn
- **database_version_min**: 4.4.0
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> 如果业务侧确定不会使用读历史快照（read atClusterTime）的功能，可以将此参数调小到0，以获得一定的性能提升

### recommendation_quote

> 如果业务侧确定不会使用读历史快照（read atClusterTime）的功能，可以将此参数调小到0，以获得一定的性能提升

### rationale_quote

> 此参数会带来一定的WT缓存（WT cache）压力，尤其是相同文档频繁更新的场景


## case_id: wt-concurrent-tickets-low-increase-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **case_pattern**: parameter-best-practice
- **title**: WiredTiger 并发读写 tickets 持续低于 10 时应用 setParameter 增加上限
- **recommendation_value**: `wiredTigerConcurrentReadTransactions = 256`
- **recommendation_layer**: mongodb-setparam
- **detection_layer**: mongo-shell
- **related_param_names**: `["wiredTigerConcurrentReadTransactions","wiredTigerConcurrentWriteTransactions"]`
- **risk_severity**: warning
- **source_url**: https://oneuptime.com/blog/post/2026-03-31-mongodb-wiredtiger-storage-engine/view
- **source_authority**: community-canonical
- **source_url_lang**: en
- **database_version_min**: 3.2.0
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> WiredTiger uses a ticket system to limit concurrent operations. By default, 128 read tickets and 128 write tickets are available.

### recommendation_quote

> db.adminCommand({ setParameter: 1, wiredTigerConcurrentReadTransactions: 256 })

### rationale_quote

> WiredTiger uses a ticket system to limit concurrent operations. By default, 128 read tickets and 128 write tickets are available.

### risk_quote

> Monitor wiredTiger.concurrentTransactions and increase tickets if throughput is limited.


## case_id: wt-cache-size-default-half-ram-minus-1g-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **case_pattern**: parameter-best-practice
- **title**: WiredTiger 内部缓存默认值 = max(50% × (RAM - 1GB), 0.256GB) · 不应擅自调高
- **recommendation_value**: `wiredTigerCacheSizeGB = max(0.5 × (RAM - 1GB), 0.256GB)`
- **recommendation_layer**: mongodb-config
- **detection_layer**: mongo-shell
- **related_param_names**: `["storage.wiredTiger.engineConfig.cacheSizeGB","wiredTigerCacheSizeGB"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_authority**: official
- **source_url_lang**: en
- **database_version_min**: 3.2.0
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> With WiredTiger, MongoDB utilizes both the WiredTiger internal cache and the filesystem cache.

### recommendation_quote

> The default WiredTiger internal cache size is the larger of either:

### rationale_quote

> The storage.wiredTiger.engineConfig.cacheSizeGB limits the size of the WiredTiger internal cache. The operating system uses the available free memory for filesystem cache, which allows the compressed MongoDB data files to stay in memory.

### risk_quote

> To accommodate the additional consumers of RAM, you may have to decrease WiredTiger internal cache size.


## case_id: wt-compression-snappy-default-block-collections-03

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **case_pattern**: parameter-best-practice
- **title**: WiredTiger 集合默认采用 Snappy 块压缩 · 索引默认前缀压缩
- **recommendation_value**: `storage.wiredTiger.collectionConfig.blockCompressor = snappy`
- **recommendation_layer**: mongodb-config
- **detection_layer**: mongo-runtime-cmd
- **related_param_names**: `["storage.wiredTiger.collectionConfig.blockCompressor","storage.wiredTiger.indexConfig.prefixCompression"]`
- **risk_severity**: info
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_authority**: official
- **source_url_lang**: en
- **database_version_min**: 3.2.0
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> WiredTiger can compress collection data using one of the following compression library:

### recommendation_quote

> By default, WiredTiger uses snappy compression library.

### rationale_quote

> Provides a lower compression rate than zlib or zstd but has a lower CPU cost than either.

### risk_quote

> Block compression can provide significant on-disk storage savings, but data must be uncompressed to be manipulated by the server.


## case_id: wt-encrypted-storage-aes-ni-cpu-required-04

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **case_pattern**: parameter-best-practice
- **title**: 使用 Encrypted Storage Engine 时 · 选支持 AES-NI 指令集的 CPU
- **recommendation_value**: `CPU 支持 AES-NI 指令集扩展`
- **recommendation_layer**: bios-firmware
- **detection_layer**: os
- **related_param_names**: `["security.enableEncryption","security.encryptionCipherMode"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> When using encryption, CPUs equipped with AES-NI instruction-set extensions show significant performance advantages.

### recommendation_quote

> If you are using MongoDB Enterprise with the Encrypted Storage Engine, choose a CPU that supports AES-NI for better performance.

### rationale_quote

> CPUs equipped with AES-NI instruction-set extensions show significant performance advantages.


## case_id: wt-cache-size-container-cgroup-explicit-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **case_pattern**: parameter-best-practice
- **title**: 容器(lxc / cgroups / Docker)部署 mongod 时必须显式设 wiredTigerCacheSizeGB 或 wiredTigerCacheSizePct
- **recommendation_value**: `--wiredTigerCacheSizeGB or --wiredTigerCacheSizePct < amount of RAM available in the container`
- **recommendation_layer**: mongodb-cli-flag
- **related_param_names**: `["storage.wiredTiger.engineConfig.cacheSizeGB","storage.wiredTiger.engineConfig.cacheSizePct","wiredTigerCacheSizeGB","wiredTigerCacheSizePct","memLimitMB"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/core/wiredtiger/
- **source_authority**: official
- **source_url_lang**: en
- **database_version_min**: 3.2.0
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> If you run mongod in a container (for example, lxc, cgroups, Docker, etc.) that does not have access to all of the RAM available in a system

### recommendation_quote

> you must set --wiredTigerCacheSizeGB or --wiredTigerCacheSizePct to a value less than the amount of RAM available in the container

### rationale_quote

> as WiredTiger may not account for the memory limits of the specific container in certain cases

### risk_quote

> WiredTiger may not account for the memory limits of the specific container in certain cases


## case_id: wt-cache-size-multi-instance-decrease-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **case_pattern**: parameter-best-practice
- **title**: 单机多 mongod 实例时须按实例数缩减每个实例的 WiredTiger 缓存配置
- **recommendation_value**: `storage.wiredTiger.engineConfig.cacheSizeGB decrease to accommodate`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["storage.wiredTiger.engineConfig.cacheSizeGB", "storage.wiredTiger.engineConfig.cacheSizePct"]`
- **risk_severity**: critical
- **source_url**: https://www.mongodb.com/docs/manual/reference/configuration-options/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> The default WiredTiger internal cache size value assumes that there is a single mongod instance per machine. If a single machine contains multiple MongoDB instances, decrease the setting to accommodate the other mongod instances.

### recommendation_quote

> If a single machine contains multiple MongoDB instances, decrease the setting to accommodate the other mongod instances.

### rationale_quote

> The default WiredTiger internal cache size value assumes that there is a single mongod instance per machine.

### risk_quote

> To accommodate the additional consumers of RAM, you may have to decrease WiredTiger internal cache size.


## case_id: mongo-config-syncperiodsecs-production-default-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **case_pattern**: parameter-best-practice
- **title**: 生产环境禁止将 storage.syncPeriodSecs 设为 0 · 保持默认值 60
- **recommendation_value**: `storage.syncPeriodSecs != 0`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["storage.syncPeriodSecs"]`
- **risk_severity**: critical
- **source_url**: https://www.mongodb.com/docs/manual/reference/configuration-options/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> The amount of time that can pass before MongoDB flushes data to the data files. Do not set this value on production systems. In almost every situation, you should use the default setting.

### recommendation_quote

> storage.syncPeriodSecs has no effect on Journaling , but if storage.syncPeriodSecs is set to 0 the journal eventually consumes all available disk space.


## case_id: mongo-config-quiet-mode-disable-production-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-other
- **case_pattern**: parameter-best-practice
- **title**: 生产环境禁用 systemLog.quiet 模式 · 保留完整日志输出
- **recommendation_value**: `systemLog.quiet false`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["systemLog.quiet"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/reference/configuration-options/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> systemLog.quiet Type : boolean Default : false Run mongos or mongod in a quiet mode that attempts to limit the amount of output. systemLog.quiet is not recommended for production systems

### recommendation_quote

> systemLog.quiet Type : boolean Default : false Run mongos or mongod in a quiet mode that attempts to limit the amount of output. systemLog.quiet is not recommended for production systems as it may make tracking problems during particular connections much more difficult.


## case_id: mongo-config-syslog-destination-file-production-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-other
- **case_pattern**: parameter-best-practice
- **title**: 生产环境 systemLog.destination 应设为 file 而非 syslog · 避免时间戳误导
- **recommendation_value**: `file option for production systems`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["systemLog.destination", "systemLog.path"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/reference/configuration-options/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> The syslog daemon generates timestamps when it logs a message, not when MongoDB issues the message. This can lead to misleading timestamps for log entries, especially when the system is under heavy load.

### recommendation_quote

> We recommend using the file option for production systems to ensure accurate timestamps.

### rationale_quote

> The syslog daemon generates timestamps when it logs a message, not when MongoDB issues the message. This can lead to misleading timestamps for log entries, especially when the system is under heavy load.

### risk_quote

> This can lead to misleading timestamps for log entries, especially when the system is under heavy load.


## case_id: mongo-config-logrotate-reopen-logrotated-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-other
- **case_pattern**: parameter-best-practice
- **title**: 使用 Linux logrotate 工具时须将 systemLog.logRotate 设为 reopen 以避免日志丢失
- **recommendation_value**: `systemLog.logRotate reopen`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["systemLog.logRotate", "systemLog.logAppend"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/reference/configuration-options/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> Use reopen when using the Linux/Unix logrotate utility to avoid log loss.

### recommendation_quote

> systemLog.logRotate Type : string Default : rename Determines the behavior for the logRotate command when rotating the server log and/or the audit log. Specify either rename or reopen : rename renames the log file. reopen closes and reopens the log file following the typical Linux/Unix log rotate behavior. Use reopen when using the Linux/Unix logrotate utility to avoid log loss.

### rationale_quote

> reopen closes and reopens the log file following the typical Linux/Unix log rotate behavior. Use reopen when using the Linux/Unix logrotate utility to avoid log loss. If you specify reopen , you must also set systemLog.logAppend to true .


## case_id: mongo-config-auditlog-bson-format-perf-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-other
- **case_pattern**: parameter-best-practice
- **title**: 审计日志落文件时使用 BSON 格式而非 JSON · 降低性能开销
- **recommendation_value**: `auditLog.format BSON`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["auditLog.format", "auditLog.destination"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/reference/configuration-options/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> Printing audit events to a file in JSON format degrades server performance more than printing to a file in BSON format.

### recommendation_quote

> The auditLog.format option can have one of the following values: Value Description JSON Output the audit events in JSON format to the file specified in auditLog.path . BSON Output the audit events in BSON binary format to the file specified in auditLog.path . Printing audit events to a file in JSON format degrades server performance more than printing to a file in BSON format

### rationale_quote

> Printing audit events to a file in JSON format degrades server performance more than printing to a file in BSON format.

### risk_quote

> Printing audit events to a file in JSON format degrades server performance more than printing to a file in BSON format.


## case_id: mongo-config-audit-kmip-not-local-key-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-other
- **case_pattern**: parameter-best-practice
- **title**: 审计日志加密密钥生产环境必须使用外部 KMIP 服务 · 禁止使用 localAuditKeyFile
- **recommendation_value**: `auditLog.auditEncryptionKeyIdentifier = <kmip-key-id>`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["auditLog.localAuditKeyFile", "auditLog.auditEncryptionKeyIdentifier"]`
- **risk_severity**: critical
- **source_url**: https://www.mongodb.com/docs/manual/reference/configuration-options/
- **source_authority**: official
- **source_url_lang**: en
- **database_version_min**: 5.3.0
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> Only use auditLog.localAuditKeyFile for testing because the key is not secured.

### recommendation_quote

> To secure the key, use auditLog.auditEncryptionKeyIdentifier and an external Key Management Interoperability Protocol (KMIP) server.

### rationale_quote

> Only use auditLog.localAuditKeyFile for testing because the key is not secured.


## case_id: mongo-config-mongos-maxconn-connection-leak-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-other
- **case_pattern**: parameter-best-practice
- **title**: mongos 部署中客户端连接泄漏时须显式设置 maxIncomingConnections 防止分片连接风暴
- **recommendation_value**: `net.maxIncomingConnections slightly higher than max client connections`
- **recommendation_layer**: mongodb-config
- **related_param_names**: `["net.maxIncomingConnections"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/reference/configuration-options/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> This is particularly useful for a mongos if you have a client that creates multiple connections and allows them to timeout rather than closing them.

### recommendation_quote

> set maxIncomingConnections to a value slightly higher than the maximum number of connections that the client creates, or the maximum size of the connection pool.

### rationale_quote

> This setting prevents the mongos from causing connection spikes on the individual shards . Spikes like these may disrupt the operation and memory allocation of the sharded cluster .


## case_id: mongo-profiler-slowms-highest-useful-value-01

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-other
- **case_pattern**: parameter-best-practice
- **title**: profiler / diagnostic log slowms 阈值应设为业务可接受的最高值 · 避免性能退化
- **recommendation_value**: `slowms = highest-useful-value`(业务可接受的最大慢查询阈值 · 默认 100ms 仅在低 QPS/SLA 紧张时合理 · 高吞吐场景应调大至 200/500ms 等)
- **recommendation_layer**: mongodb-config
- **detection_layer**: mongo-shell
- **related_param_names**: `["operationProfiling.slowOpThresholdMs","slowms","--slowms"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> The slow operation threshold applies to all databases in a mongod instance. It is used by both the database profiler and the diagnostic log.

### recommendation_quote

> Set it to the highest useful value to avoid performance degradation.

### risk_quote

> Set it to the highest useful value to avoid performance degradation.


## case_id: mongo-profiler-prefer-atlas-alternatives-before-enabling-02

- **entry_kind**: best-practice
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-other
- **case_pattern**: parameter-best-practice
- **title**: 启用 database profiler 前优先考虑 Atlas Query Profiler / Performance Advisor / $queryStats 等替代方案 · profiler 可能 degrade 性能
- **recommendation_value**: `before enabling profiler · 优先用 Atlas Query Profiler / Atlas Performance Advisor / $queryStats(aggregation stage)等替代方案做慢查询观测 · 仅在替代方案无法覆盖时再启用 profiler`
- **recommendation_layer**: mongodb-config
- **detection_layer**: mongo-shell
- **related_param_names**: `["operationProfiling.mode","--profile","slowms","sampleRate"]`
- **risk_severity**: warning
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/
- **source_authority**: official
- **source_url_lang**: en
- **inferred_fields**: scenario_description_zh, rationale_zh, risk_zh, recommendation_value

### scenario_description_quote

> When enabled, profiling affects database performance and disk use.

### recommendation_quote

> Before enabling the database profiler, consider using one of the following alternatives:

### risk_quote

> The database profiler can degrade MongoDB performance.

