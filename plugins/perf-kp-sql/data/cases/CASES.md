<!-- ============ Diagnostic-Flow (96 cases) ============ -->

## case_id: kunpeng-nohz-clock-tick-overhead-03

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **engine**: kunpeng-platform
- **symptom_category**: cpu-high
- **case_pattern**: core-perf-diagnosis
- **title**: 周期时钟中断浪费 CPU 资源(nohz 未启用)
- **source_heading**: 1.3.3 定时器机制调整,减少不必要的时钟中断
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 1
- **source_url**: https://www.cnblogs.com/huaweicloud/p/11861191.html
- **source_url_lang**: zh-cn

### symptom_description

> 在Linux内核2.6.17版本之前,Linux内核为每个CPU设置一个周期性的时钟中断,Linux内核利用这个中断处理一些定时任务,如线程调度等。这样导致就算CPU不需要定时器的时候,也会有很多时钟中断,导致资源的浪费。

### diagnostic_steps

```
[step 1] 看内核启动参数是否含 nohz=off
  metric_name: /proc/cmdline 中是否含 `nohz=off`
  collection_layer: os
  collection_method_quote: "执行cat /proc/cmdline查看Linux 内核的启动参数,如果有nohz=off关键字,说明nohz机制被关闭,需要打开。"
  abnormal_pattern_quote: "如果有nohz=off关键字,说明nohz机制被关闭"
  abnormal_pattern_threshold: `nohz=off` 出现在 /proc/cmdline
  metric_unit: bool
  prerequisite_steps: []

[step 2] 用 perf sched 观察 timer_tick 调度次数
  metric_name: timer_tick 调度次数(单位时间内)
  collection_layer: os
  collection_method_quote: "perf sched record -- sleep 1 -p $PID" 配 "perf sched latency -s max"
  abnormal_pattern_quote: "输出信息中有如下信息,其中591字段表示统计时间内的调度次数,数字变小说明修改生效。"
  abnormal_pattern_threshold: 修改前后调度次数显著未减小
  metric_unit: count
  prerequisite_steps: [1]
```

### likely_causes

```
[parameter_causes · cause 1] 内核启动参数 nohz=off
  param_name: kernel boot cmdline `nohz=off`
  abnormal_value_pattern: 显式设了 nohz=off · 或某些 OS 默认 off(原文示例 Euler:nohz=off)
  reasoning_quote: "在Linux内核2.6.17版本之前,Linux内核为每个CPU设置一个周期性的时钟中断"
  linked_diagnostic_step_no: 1
```


## case_id: kunpeng-tlb-miss-page-size-04

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **engine**: kunpeng-platform
- **symptom_category**: cpu-high
- **case_pattern**: core-perf-diagnosis
- **title**: 4K 页大小导致 TLB 命中率低
- **source_heading**: 1.3.4 调整内存页的大小为64K,提升TLB命中率
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.cnblogs.com/huaweicloud/p/11861191.html
- **source_url_lang**: zh-cn

### symptom_description

> TLB（Translation lookaside buffer）为页表（存放虚拟地址的页地址和物理地址的页地址的映射关系）在CPU内部的高速缓存。TLB的命中率越高,页表查询性能就越好。

### diagnostic_steps

```
[step 1] perf stat 看 TLB 命中率
  metric_name: dTLB-load-misses 比率 / iTLB-load-misses 比率
  collection_layer: os
  collection_method_quote: "perf stat -p $PID -d -d -d"
  abnormal_pattern_quote: "其中1.21%和0.59%分别表示数据的miss率和指令的miss率。"
  abnormal_pattern_threshold: dTLB miss > 1% / iTLB miss > 0.5%(原文示例值,可作经验阈值)
  metric_unit: %
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] 内核编译时 PAGESIZE=4K
  param_name: Linux kernel `Page size` 编译选项
  abnormal_value_pattern: 4K(默认)
  reasoning_quote: "TLB管理的内存大小 = TLB行数 x 内存的页大小"
  linked_diagnostic_step_no: 1
```


## case_id: kunpeng-thread-concurrency-overload-05

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **engine**: kunpeng-platform
- **symptom_category**: cpu-high
- **case_pattern**: core-perf-diagnosis
- **title**: 线程并发数超过最佳点导致性能下降
- **source_heading**: 1.3.5 调整线程并发数
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.cnblogs.com/huaweicloud/p/11861191.html
- **source_url_lang**: zh-cn

### symptom_description

> 程序从单线程变为多线程时,CPU和内存资源得到充分利用,性能得到提升。但是系统的性能并不会随着线程数的增长而线性提升,因为随着线程数量的增加,线程之间的调度、上下文切换、关键资源和锁的竞争也会带来很大开销。

### diagnostic_steps

```
[step 1] 不同并发数下做 TPS 测试,找性能拐点
  metric_name: TPS / 业务吞吐 vs 线程并发数
  collection_layer: os
  collection_method_quote: "下面数据为某业务场景下,不同并发线程数下的TPS,可以看到并发线程数达到128后,性能达到高峰,随后开始下降。"
  abnormal_pattern_quote: "我们需要针对不同的业务模型和使用场景做多组测试,找到适合本业务场景的最佳并发线程数。"
  abnormal_pattern_threshold: 增加并发后 TPS 反降 → 已过拐点
  metric_unit: TPS
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] 应用并发参数未调
  param_name: MySQL `innodb_thread_concurrency` / Nginx `worker_processes` / 其他应用并发设置
  abnormal_value_pattern: 设置过大,超过最佳并发拐点
  reasoning_quote: "MySql可以通过innodb_thread_concurrency设置工作线程的最大并发数。" 与 "Nginx可以通过worker_processes参数设置并发的进程个数。"
  linked_diagnostic_step_no: 1
```


## case_id: mongo-fs-mount-noatime-nobarrier-missing-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-x86_64-generic
- **engine**: linux-os
- **symptom_category**: disk-io-saturation
- **case_pattern**: parameter-audit
- **title**: XFS mount 未加 noatime/nobarrier 导致文件系统冗余开销
- **source_heading**: 文件系统调优
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0006.html
- **source_url_lang**: zh-cn

### symptom_description

> 通常情况下，我们对文件的操作更多是读取而不是写入，而且我们很少需要关注一个文件最近被访问的时间。因此，我们建议使用noatime选项，这样文件系统在程序访问文件或文件夹时，不会更新对应的访问时间。文件系统不再记录访问时间，可以避免不必要的资源浪费。

### diagnostic_steps

```
[step 1] 读取数据盘当前 mount 选项
  metric_name: mount.options
  collection_layer: os
  collection_method_quote: (NULL · 原文未给读取命令 · 见 reference/inferred-references.md#mongo-fs-mount-readout-from-shell-knowledge)
  abnormal_pattern_quote: "建议在文件系统的mount参数上加上noatime、nobarrier两个选项，其中数据盘以及数据目录以实际为准。"
  abnormal_pattern_threshold: `mount options does NOT contain "noatime" OR does NOT contain "nobarrier" (XFS only)`
  metric_unit: flag
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] 数据盘 mount 选项未加 noatime
  param_name: mount.options.noatime
  abnormal_value_pattern: `noatime not in mount options`
  reasoning_quote: "通常情况下，我们对文件的操作更多是读取而不是写入，而且我们很少需要关注一个文件最近被访问的时间。因此，我们建议使用noatime选项，这样文件系统在程序访问文件或文件夹时，不会更新对应的访问时间。文件系统不再记录访问时间，可以避免不必要的资源浪费。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 2] XFS mount 未加 nobarrier(开启 write barriers)
  param_name: mount.options.nobarrier
  abnormal_value_pattern: `nobarrier not in mount options (XFS only) AND storage backend has battery-backed cache (RAID/Flash)`
  reasoning_quote: "在这种情况下，我们可以安全地使用nobarrier挂载文件系统，以避免write barriers的性能损失。对于ext3、ext4和reiserfs文件系统可以在mount时指定barrier=0。对于XFS可以指定nobarrier选项。"
  linked_diagnostic_step_no: 1
```


## case_id: mongo-os-tcp-stack-tuning-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-x86_64-generic
- **engine**: linux-os
- **symptom_category**: network-latency
- **case_pattern**: parameter-audit
- **title**: OS 层 TCP 协议栈参数审计 (7 条 sysctl)
- **source_heading**: 网络参数调优
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 7
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0010.html
- **source_url_lang**: zh-cn

### symptom_description

> 对于不同的操作系统，通过在OS层面调整网络参数的配置，可以有效提升服务器性能。

### diagnostic_steps

```
[step 1] 读取 7 个 TCP 协议栈参数当前值
  metric_name: sysctl.net.* (7 keys)
  collection_layer: os
  collection_method_quote: (NULL · 原文只给 echo 写命令未给 sysctl 读命令 · 见 reference/inferred-references.md#mongo-os-tcp-readout-from-shell-knowledge)
  abnormal_pattern_quote: "tcp_max_syn_backlog是指定所能接收SYN同步包的最大客户端数量。"
  abnormal_pattern_threshold: `current value < recommended value (per-key)`
  metric_unit: mixed (count / bytes / triple)
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] tcp_max_syn_backlog 偏小
  param_name: net.ipv4.tcp_max_syn_backlog
  abnormal_value_pattern: `current = 2048 (default) < 8192 (recommended)`
  reasoning_quote: "tcp_max_syn_backlog是指定所能接收SYN同步包的最大客户端数量。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 2] somaxconn 偏小
  param_name: net.core.somaxconn
  abnormal_value_pattern: `current = 128 (default) < 1024 (recommended)`
  reasoning_quote: "服务端所能accept即处理数据的最大客户端数量，即完成连接上限。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 3] rmem_max 偏小
  param_name: net.core.rmem_max
  abnormal_value_pattern: `current = 229376 (default) < 16777216 (recommended)`
  reasoning_quote: "接收套接字缓冲区大小的最大值。单位为字节。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 4] wmem_max 偏小
  param_name: net.core.wmem_max
  abnormal_value_pattern: `current = 229376 (default) < 16777216 (recommended)`
  reasoning_quote: "发送套接字缓冲区大小的最大值。单位为字节。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 5] tcp_rmem 第三值偏小
  param_name: net.ipv4.tcp_rmem
  abnormal_value_pattern: `current = "4096 87380 6291456" (default) · 第三值 < 16777216 (recommended)`
  reasoning_quote: "配置读缓冲区的大小，共三个值，第一个是这个读缓冲区的最小值，第三个是最大值，中间的是默认值。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 6] tcp_wmem 第三值偏小
  param_name: net.ipv4.tcp_wmem
  abnormal_value_pattern: `current = "4096 16384 4194304" (default) · 第三值 < 16777216 (recommended)`
  reasoning_quote: "配置写缓冲区的大小，共三个值，第一个是这个写缓冲区的最小值，第三个是最大值，中间的是默认值。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 7] tcp_max_tw_buckets 偏小
  param_name: net.ipv4.tcp_max_tw_buckets
  abnormal_value_pattern: `current = 262144 (default) < 360000 (recommended)`
  reasoning_quote: "表示系统同时保持TIME_WAIT套接字的最大数量。"
  linked_diagnostic_step_no: 1
```


## case_id: mongo-client-os-tcp-tuning-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-x86_64-generic
- **engine**: linux-os
- **symptom_category**: network-latency
- **case_pattern**: parameter-audit
- **title**: MongoDB 客户端侧 OS 层 TCP 参数审计 (8 条 sysctl)
- **source_heading**: 客户端优化
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 8
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0031.html
- **source_url_lang**: zh-cn

### symptom_description

> 通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。

### diagnostic_steps

```
[step 1] 读取 8 个 TCP 客户端参数当前值
  metric_name: sysctl.net.* (8 keys)
  collection_layer: os
  collection_method_quote: (NULL · 原文只给 vim 编辑 sysctl.conf 写法未给读命令 · 见 reference/inferred-references.md#mongo-client-os-tcp-readout-from-shell-knowledge)
  abnormal_pattern_quote: "允许将TIME-WAIT sockets重新用于新的TCP连接。"
  abnormal_pattern_threshold: `current value ≠ recommended value (per-key)`
  metric_unit: mixed (count / range / seconds)
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] ip_local_port_range 偏窄
  param_name: net.ipv4.ip_local_port_range
  abnormal_value_pattern: `range narrower than "1024 65535"`
  reasoning_quote: "用于向外连接的端口范围。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 2] tcp_tw_reuse 关闭
  param_name: net.ipv4.tcp_tw_reuse
  abnormal_value_pattern: `current = 0 (closed) ≠ 1 (recommended)`
  reasoning_quote: "允许将TIME-WAIT sockets重新用于新的TCP连接。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 3] somaxconn 偏小
  param_name: net.core.somaxconn
  abnormal_value_pattern: `current = 128 (default) < 65535 (recommended)`
  reasoning_quote: "定义了系统中每一个端口最大的监测队列的长度，这是个全局的参数，默认值为128。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 4] netdev_max_backlog 偏小
  param_name: net.core.netdev_max_backlog
  abnormal_value_pattern: `current < 8096 (recommended)`
  reasoning_quote: "每个网络接口接收数据包的速率比内核处理这些包的速率快时，允许送到队列的数据包的最大数目。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 5] tcp_max_syn_backlog 偏小
  param_name: net.ipv4.tcp_max_syn_backlog
  abnormal_value_pattern: `current = 1024 (default) < 8192 (recommended)`
  reasoning_quote: "表示那些尚未收到客户端确认信息的连接（SYN消息）队列的长度，默认为1024，加大队列长度为262144，可以容纳更多等待连接的网络连接数。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 6] tcp_keepalive_time 过长
  param_name: net.ipv4.tcp_keepalive_time
  abnormal_value_pattern: `current = 7200 (default 2h) ≠ 600 (recommended)`
  reasoning_quote: "表示如果套接字由本端要求关闭，这个参数决定了它保持在FIN-WAIT-2状态的时间，默认为2小时。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 7] tcp_fin_timeout 过长
  param_name: net.ipv4.tcp_fin_timeout
  abnormal_value_pattern: `current = 0 (closed quick recycle) ≠ 30 (recommended)`
  reasoning_quote: "表示开启TCP连接中TIME-WAIT sockets的快速回收，默认为0，表示关闭。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 8] tcp_max_tw_buckets 偏大(被动客户端侧建议下调)
  param_name: net.ipv4.tcp_max_tw_buckets
  abnormal_value_pattern: `current = 180000 (default) ≠ 3000 (recommended for client)`
  reasoning_quote: "表示系统同时保持TIME_WAIT sockets的最大数量，默认为180000。"
  linked_diagnostic_step_no: 1
```


## case_id: kunpeng-bios-smmu-enabled-non-virt-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **engine**: kunpeng-platform
- **symptom_category**: disk-io-saturation
- **case_pattern**: parameter-audit
- **title**: 鲲鹏 BIOS 中 SMMU 在非虚拟化场景未关闭(影响数据库 IO 性能)
- **source_heading**: BIOS调优
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0007.html
- **source_url_lang**: zh-cn

### symptom_description

> 因为数据库通常会使用大量的内存和IO资源，而SMMU会增加额外的开销和延迟，从而降低系统的性能。

### diagnostic_steps

```
[step 1] 读取 BIOS 中 Support Smmu 当前值
  metric_name: bios.advanced.misc_config.support_smmu
  collection_layer: bios-readout
  collection_method_quote: (NULL · 原文给的是"重启进入 BIOS 设置界面"操作流而非可脚本化读法 · 见 reference/inferred-references.md#kunpeng-bios-smmu-readout-from-shell)
  abnormal_pattern_quote: "将“Support Smmu”设置为“Disable”。"
  abnormal_pattern_threshold: `current = "Enable" ≠ "Disable" (in non-virtualization scenario)`
  metric_unit: enum (Enable/Disable)
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] BIOS Support Smmu 在非虚拟化场景仍为 Enable
  param_name: bios.advanced.misc_config.support_smmu
  abnormal_value_pattern: `current = "Enable" AND scenario = non-virtualization`
  reasoning_quote: "因为数据库通常会使用大量的内存和IO资源，而SMMU会增加额外的开销和延迟，从而降低系统的性能。因此在数据库场景，开启SMMU并不能获得更好的性能。"
  linked_diagnostic_step_no: 1
```


## case_id: kunpeng-bios-cpu-prefetch-enabled-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **engine**: kunpeng-platform
- **symptom_category**: cpu-high
- **case_pattern**: parameter-audit
- **title**: 鲲鹏 BIOS 中硬件预取(CPU Prefetching)未关闭(影响数据库随机访问性能)
- **source_heading**: BIOS调优
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0007.html
- **source_url_lang**: zh-cn

### symptom_description

> 硬件预取是通过跟踪指令和数据地址的变化，将指令和地址提前读到Cache里，硬件预取对数据库场景的性能有影响，建议在BIOS中将预取功能关闭。

### diagnostic_steps

```
[step 1] 读取 BIOS 中 CPU Prefetching Configuration 当前值
  metric_name: bios.advanced.misc_config.cpu_prefetching_configuration
  collection_layer: bios-readout
  collection_method_quote: (NULL · 原文给的是"重启进入 BIOS 设置界面"操作流而非可脚本化读法 · 见 reference/inferred-references.md#kunpeng-bios-prefetch-readout-from-shell)
  abnormal_pattern_quote: "将“CPU Prefetching Configuration”设置为“Disabled”，按“F10”键保存退出。"
  abnormal_pattern_threshold: `current = "Enabled" ≠ "Disabled"`
  metric_unit: enum (Enabled/Disabled)
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] BIOS CPU Prefetching Configuration 仍为 Enabled
  param_name: bios.advanced.misc_config.cpu_prefetching_configuration
  abnormal_value_pattern: `current = "Enabled" (default)`
  reasoning_quote: "硬件预取是通过跟踪指令和数据地址的变化，将指令和地址提前读到Cache里，硬件预取对数据库场景的性能有影响，建议在BIOS中将预取功能关闭。"
  linked_diagnostic_step_no: 1
```


## case_id: kunpeng-net-irq-not-bound-irqbalance-on-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-x86_64-generic
- **engine**: linux-os
- **symptom_category**: network-latency
- **case_pattern**: parameter-audit
- **title**: 鲲鹏服务器网卡中断未绑核(irqbalance 在线/中断分散到非本地 CPU)
- **source_heading**: 网卡中断绑核
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 2
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0013.html
- **source_url_lang**: zh-cn

### symptom_description

> 手动绑定网卡中断，根据网卡所属CPU将其进行分配，从而优化系统网络性能。

### diagnostic_steps

```
[step 1] 查看 irqbalance 服务当前状态
  metric_name: systemd.unit.irqbalance.service.active_state
  collection_layer: os
  collection_method_quote: "systemctl status irqbalance.service"
  abnormal_pattern_quote: "状态为inactive即为关闭。"
  abnormal_pattern_threshold: `active_state ≠ "inactive" (i.e. running)`
  metric_unit: enum (active/inactive)
  prerequisite_steps: []

[step 2] 查看网卡中断 smp_affinity 是否已绑定到本地 NUMA CPU
  metric_name: proc.interrupts.smp_affinity_list
  collection_layer: os
  collection_method_quote: (NULL · 原文给的是 mitigation 脚本中的 grep 片段而非独立读命令 · 见 reference/inferred-references.md#kunpeng-net-irq-affinity-readout)
  abnormal_pattern_quote: "对于不同的硬件配置，用于绑中断的最佳CPU数目会有差异，比如对于鲲鹏920 5250处理器 + Huawei TM280 25G网卡（鲲鹏服务器的板载网卡）来说，最多可以绑定32个中断队列，建议将所有的队列都用在中断绑定上来获得最佳性能。"
  abnormal_pattern_threshold: `smp_affinity_list of NIC IRQs spans cores NOT on NIC's local NUMA node`
  metric_unit: cpu_id list
  prerequisite_steps: [1]
```

### likely_causes

```
[parameter_causes · cause 1] irqbalance 在线导致中断动态飘移到非本地 NUMA CPU
  param_name: systemd.unit.irqbalance.service
  abnormal_value_pattern: `state = active (running)`
  reasoning_quote: "进行网卡中断绑核之前，需要先关闭irqbalance。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 2] 网卡中断 smp_affinity 未手动绑定
  param_name: proc.irq.<N>.smp_affinity_list
  abnormal_value_pattern: `smp_affinity_list NOT on NIC local NUMA cores`
  reasoning_quote: "手动绑定网卡中断，根据网卡所属CPU将其进行分配，从而优化系统网络性能。"
  linked_diagnostic_step_no: 2
```


## case_id: linux-blockdev-nr-requests-too-low-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-x86_64-generic
- **engine**: linux-os
- **symptom_category**: disk-io-saturation
- **case_pattern**: parameter-audit
- **title**: 块设备 nr_requests 队列长度偏小(限制磁盘吞吐)
- **source_heading**: IO参数调优
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0018.html
- **source_url_lang**: zh-cn

### symptom_description

> 提升磁盘吞吐量，可以调整到更大。

### diagnostic_steps

```
[step 1] 读取 /sys/block/<device>/queue/nr_requests 当前值
  metric_name: blockdev.queue.nr_requests
  collection_layer: os
  collection_method_quote: (NULL · 原文给 echo 写命令未给 cat 读命令 · 见 reference/inferred-references.md#linux-blockdev-nr-requests-readout-from-shell)
  abnormal_pattern_quote: "将指定设备的IO请求队列长度设置为“2048”。"
  abnormal_pattern_threshold: `current < 2048 (recommended)`
  metric_unit: int (request slots)
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] nr_requests 小于 2048
  param_name: /sys/block/${device}/queue/nr_requests
  abnormal_value_pattern: `current < 2048 (most distros default = 128/256)`
  reasoning_quote: "提升磁盘吞吐量，可以调整到更大。"
  linked_diagnostic_step_no: 1
```


## case_id: kvm-vcpupin-not-bound-numa-cross-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-x86_64-generic
- **engine**: linux-os
- **symptom_category**: cpu-high
- **case_pattern**: parameter-audit
- **title**: KVM 虚拟机 vCPU 未绑核(跨 NUMA / 跨 DIE 切换)
- **source_heading**: 虚拟机绑核
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0019.html
- **source_url_lang**: zh-cn

### symptom_description

> 虚拟机绑核可以有效地减少操作系统的上下文切换和负载均衡的开销，从而提高程序的执行效率。

### diagnostic_steps

```
[step 1] 读取虚拟机 xml 当前 vcpupin/cputune 配置
  metric_name: libvirt.domain.cputune.vcpupin
  collection_layer: os
  collection_method_quote: (NULL · 原文给的是 `virsh edit vm1` 编辑写流程,未给独立读命令 · 见 reference/inferred-references.md#kvm-vcpupin-readout-from-shell)
  abnormal_pattern_quote: "若不配置此参数，虚拟机任务线程会在CPU任意core上浮动，会存在更多的跨NUMA和跨DIE损耗。"
  abnormal_pattern_threshold: `xml does NOT contain <cputune><vcpupin .../></cputune> AND <vcpu placement='static' cpuset=...>`
  metric_unit: xml 节点
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] KVM 虚拟机 xml 缺 vcpupin 配置 → vCPU 漂移
  param_name: libvirt.domain.cputune.vcpupin
  abnormal_value_pattern: `<vcpupin> 节点缺失`
  reasoning_quote: "vcpupin用于限制对CPU线程做虚拟机和物理机的一对一绑核。若不使用vcpupin绑CPU线程，则线程会在4～7这个4个核之间切换，造成额外开销。"
  linked_diagnostic_step_no: 1
```


## case_id: kvm-host-hugepages-not-allocated-tlb-miss-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-x86_64-generic
- **engine**: linux-os
- **symptom_category**: memory-pressure
- **case_pattern**: parameter-audit
- **title**: KVM Host 未分配大页(虚拟机 TLB Miss / 内存访问密集业务下降)
- **source_heading**: 虚拟机使用内存大页
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0021.html
- **source_url_lang**: zh-cn

### symptom_description

> 使用内存大页能保证虚拟机的所有内存在Host上始终以大页形式存在，并且保证物理连续，可以有效地减少TLB Miss，显著提升内存访问密集型业务的性能。

### diagnostic_steps

```
[step 1] 在 Host 侧查看各 NUMA 节点大页分配情况
  metric_name: sys.node.meminfo.hugepages
  collection_layer: os
  collection_method_quote: "cat /sys/devices/system/node/node*/meminfo
  abnormal_pattern_quote: "如果HugePages显示信息为0，说明此时系统没有配置内存大页。"
  abnormal_pattern_threshold: `HugePages_Total = 0 on any NUMA node`
  metric_unit: count (pages per node)
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] Host /etc/grub2-efi.cfg 未配 default_hugepagesz/hugepagesz/hugepages
  param_name: grub.linux.default_hugepagesz
  abnormal_value_pattern: `kernel cmdline NOT contain "default_hugepagesz" AND HugePages_Total = 0`
  reasoning_quote: "使用内存大页能保证虚拟机的所有内存在Host上始终以大页形式存在，并且保证物理连续，可以有效地减少TLB Miss，显著提升内存访问密集型业务的性能。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 2] 虚拟机 xml 缺 `<memoryBacking><hugepages/></memoryBacking>`
  param_name: libvirt.domain.memoryBacking.hugepages
  abnormal_value_pattern: `domain xml does NOT contain <hugepages/>`
  reasoning_quote: "虚拟机配置大页内存。虚拟机xml文件的配置参考如下。"
  linked_diagnostic_step_no: 1
```


## case_id: kunpeng-numa-cross-node-memory-access-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **engine**: kunpeng-platform
- **symptom_category**: cpu-high
- **case_pattern**: core-perf-diagnosis
- **title**: 跨 NUMA 节点访问内存导致应用性能下降
- **source_heading**: NUMA优化,减少跨NUMA访问内存
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0014.html
- **source_url_lang**: zh-cn

### symptom_description

> 不同NUMA内的CPU core访问同一个位置的内存,性能不同。内存访问延时从高到低为:跨CPU > 跨NUMA不跨CPU > NUMA内。

### diagnostic_steps

```
[step 1] 看进程当前的 NUMA 亲和绑定
  metric_name: 进程 NUMA 亲和绑定状态
  collection_layer: os
  collection_method_quote: 原文未直接给出**采集命令**,只给出**修改命令**(`numactl -C 28-31 ./test`)。诊断侧建议用 `numactl -H`(看节点拓扑)+ `numastat -p $PID`(看进程跨节点内存命中率)兜底,**该方法属于诊断常识推断,不是原文字面**(标 `inferred:true`)
  abnormal_pattern_quote: (原文未明示阈值)进程跨节点 numa_miss 计数显著大于 numa_hit
  abnormal_pattern_threshold: numa_miss / (numa_hit + numa_miss) > 0.1(经验值,非原文)
  metric_unit: ratio
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] 应用未做线程 CPU 亲和性绑定
  param_name: (非操作系统参数,而是**应用启动方式**或**应用配置**)`numactl -C` / `sched_setaffinity` / 应用配置中的 worker_cpu_affinity
  abnormal_value_pattern: 默认不绑定核 → 调度器自由迁移线程 → 跨 NUMA 内存访问
  reasoning_quote: "在应用程序运行时要尽可能地避免跨NUMA访问内存,我们可以通过设置线程的CPU亲和性来实现。"
  linked_diagnostic_step_no: 1
```


## case_id: kunpeng-network-irq-cross-numa-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **engine**: kunpeng-platform
- **symptom_category**: network-latency
- **case_pattern**: core-perf-diagnosis
- **title**: 网卡中断与网卡不在同一 NUMA 节点导致跨 NUMA 访问内存
- **source_heading**: 网络NUMA绑核
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0026.html
- **source_url_lang**: zh-cn

### symptom_description

> 在网卡开启多队列时，操作系统通过irqbalance服务来确定网卡队列中的网络数据包交由哪个CPU core处理，但是当处理中断的CPU core和网卡不在一个NUMA时，会触发跨NUMA访问内存。

### diagnostic_steps

```
[step 1] 查询网卡中断号 + 当前绑定 core
  metric_name: NIC IRQ → CPU core 绑定分布
  collection_layer: os
  collection_method_quote: `# cat /proc/interrupts \
  abnormal_pattern_quote: "处理中断的CPU core和网卡不在一个NUMA时，会触发跨NUMA访问内存。"
  abnormal_pattern_threshold: (定性) IRQ 处理 core ∉ NIC NUMA node
  metric_unit: core id list
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] 网卡中断未通过 smp_affinity_list 显式绑定到本 NUMA 核
  param_name: /proc/irq/$irq/smp_affinity_list
  abnormal_value_pattern: 默认未显式绑定 → 继承 irqbalance 自由分发结果
  reasoning_quote: "我们可以将处理网卡中断的CPU core设置在网卡所在的NUMA上，从而减少跨NUMA的内存访问所带来的额外开销，提升网络处理性能。"
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] irqbalance 服务运行中导致中断分配随机
  cause_type: application-design
  description_quote: "在网卡开启多队列时，操作系统通过irqbalance服务来确定网卡队列中的网络数据包交由哪个CPU core处理"
  linked_diagnostic_step_no: 1
  mitigation_quote: "# systemctl stop irqbalance.service"
```


## case_id: linux-nic-interrupt-coalescing-audit-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-x86_64-generic
- **engine**: linux-os
- **symptom_category**: network-latency
- **case_pattern**: parameter-audit
- **title**: 网卡中断聚合参数（ethtool -C）未按业务调优
- **source_heading**: 中断聚合参数调整
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0027.html
- **source_url_lang**: zh-cn

### symptom_description

> 中断聚合特性允许网卡收到报文之后不立即产生中断，而是等待一小段时间有更多的报文到达之后再产生中断，这样就能让CPU一次中断处理多个报文，减少开销。

### diagnostic_steps

```
[step 1] 读取网卡当前中断聚合参数
  metric_name: NIC interrupt coalescing settings (rx/tx-usecs, rx/tx-frames, adaptive-rx/tx)
  collection_layer: os
  collection_method_quote: (NULL · 原文只给"调整命令"`ethtool -C`，未给"读取命令" `ethtool -c`，避免污染字段 · 见 reference/inferred-references.md#linux-nic-coalescing-readout)
  abnormal_pattern_quote: "为了确保使用静态值，需禁用自适应调节，关闭Adaptive RX和Adaptive TX。"
  abnormal_pattern_threshold: (定性) Adaptive RX/TX = on ∧ 业务对延迟/吞吐有明确诉求
  metric_unit: usecs / frames
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] 自适应中断聚合开启导致聚合度不可控
  param_name: ethtool -C $eth adaptive-rx / adaptive-tx
  abnormal_value_pattern: adaptive-rx=on / adaptive-tx=on (默认)
  reasoning_quote: "为了确保使用静态值，需禁用自适应调节，关闭Adaptive RX和Adaptive TX。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 2] 静态聚合参数过大导致单包延迟增加
  param_name: ethtool -C $eth rx-usecs / tx-usecs / rx-frames / tx-frames
  abnormal_value_pattern: N 取过大值
  reasoning_quote: "当增大聚合度时，单个数据包的延时会以微秒的级别增加。"
  linked_diagnostic_step_no: 1
```


## case_id: linux-rps-single-queue-nic-softirq-bottleneck-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-x86_64-generic
- **engine**: linux-os
- **symptom_category**: network-latency
- **case_pattern**: core-perf-diagnosis
- **title**: 单队列网卡软中断集中单 core 形成性能瓶颈（未启用 RPS）
- **source_heading**: 单队列网卡中断散列
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 3
- **source_url**: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0030.html
- **source_url_lang**: zh-cn

### symptom_description

> 对单队列网卡可以使用RPS将中断分散到各个core处理，避免软中断集中到一个core导致该core软中断过高形成性能瓶颈。

### diagnostic_steps

```
[step 1] 读取 RPS 当前配置（rps_cpus / rps_flow_cnt / rps_sock_flow_entries）
  metric_name: RPS configuration (rps_cpus mask, flow tables)
  collection_layer: os
  collection_method_quote: "/sys/class/net/eth0/queues/rx-0/rps_cpus 0" + "/sys/class/net/eth0/queues/rx-0/rps_flow_cnt 0" + "/proc/sys/net/core/rps_sock_flow_entries 0"（原文以三行分别给出）
  abnormal_pattern_quote: "避免软中断集中到一个core导致该core软中断过高形成性能瓶颈。"
  abnormal_pattern_threshold: rps_cpus = 0（所有 bits 全 0 表示 RPS 未启用，软中断集中到默认 core）
  metric_unit: hex bitmask / count
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] RPS 未启用（rps_cpus=0）
  param_name: /sys/class/net/$nic/queues/rx-0/rps_cpus
  abnormal_value_pattern: 0（默认值，全 0 bitmask 表示未启用 RPS）
  reasoning_quote: "对单队列网卡可以使用RPS将中断分散到各个core处理"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 2] rps_flow_cnt / rps_sock_flow_entries 未配置
  param_name: /sys/class/net/$nic/queues/rx-0/rps_flow_cnt + /proc/sys/net/core/rps_sock_flow_entries
  abnormal_value_pattern: 都为 0（默认）
  reasoning_quote: "将并发活动连接的最大预期数目设置为32768，因为这是Linux官方的内核推荐值。"
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] 网卡硬件不支持多队列（设计限制）
  cause_type: hardware-network
  description_quote: "RPS采用软件模拟的方式，实现了多队列网卡所提供的功能，分散了在多CPU系统上数据接收时的负载，把软中断分到各个CPU处理，而不需要硬件支持"
  linked_diagnostic_step_no: 1
  mitigation_quote: "#echo ff > /sys/class/net/eth0/queues/rx-0/rps_cpus"
```


## case_id: linux-vm-dirty-flush-burst-io-wait-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-x86_64-generic
- **engine**: linux-os
- **symptom_category**: disk-io-saturation
- **case_pattern**: core-perf-diagnosis
- **title**: 脏页刷盘策略不当导致突发 I/O 等待与文件读写阻塞
- **source_heading**: 调整脏数据刷新策略，减小磁盘的I/O压力
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 4
- **source_url**: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0037.html
- **source_url_lang**: zh-cn

### symptom_description

> 此参数的默认值为40，对于写入为主的业务，可以增加此参数，避免磁盘过早的进入到同步写状态。

### diagnostic_steps

```
[step 1] iostat 观察磁盘 await 时间波动 + 读取 dirty_* 三参数当前值
  metric_name: disk await time + vm dirty params
  collection_layer: os
  collection_method_quote: "可以结合业务并通过观察await的时间波动范围来识别。"
  abnormal_pattern_quote: "文件读写变为同步模式后，应用程序的文件读写操作的阻塞时间变长，会导致系统性能下降。"
  abnormal_pattern_threshold: (定性) await 突发性飙升 ∨ dirty_ratio 触发同步写
  metric_unit: ms (await) / ratio (%) / centisecs
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] dirty_expire_centisecs 过大 → 脏数据集中老化引发突发 I/O
  param_name: /proc/sys/vm/dirty_expire_centisecs
  abnormal_value_pattern: 默认 3000（30s）— 写入连续场景
  reasoning_quote: "如果业务的数据是连续性的写，可以适当调小此参数，这样可以避免I/O集中，导致突发的I/O等待。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 2] dirty_background_ratio 过大导致回写不及时数据积压
  param_name: /proc/sys/vm/dirty_background_ratio
  abnormal_value_pattern: 默认 10 — 写入为主业务可调小
  reasoning_quote: "但对于磁盘写入操作为主的业务，可以调小这个值，避免数据积压太多最后成为瓶颈"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 3] dirty_ratio 过小导致过早进入同步写
  param_name: /proc/sys/vm/dirty_ratio
  abnormal_value_pattern: 默认 40 — 写入为主业务可适当增大
  reasoning_quote: "为脏页面占用总内存最大的比例，超过这个值，系统不会新增加脏页面，文件读写也变为同步模式。"
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] 应用未使用 O_DIRECT 写关键数据，依赖 PageCache 增加同步写风险
  cause_type: application-design
  description_quote: "对于需要立即存盘的数据，应该采用O_DIRECT模式避免关键数据的丢失。"
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文未给出"如何让应用切到 O_DIRECT"的命令，只给出风险提示)
```


## case_id: linux-block-scheduler-mismatch-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-x86_64-generic
- **engine**: linux-os
- **symptom_category**: disk-io-saturation
- **case_pattern**: core-perf-diagnosis
- **title**: I/O 调度器与磁盘类型/业务模式不匹配（HDD 数据库使用 CFQ；SSD 未用 NOOP）
- **source_heading**: 优化磁盘I/O调度方式
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0040.html
- **source_url_lang**: zh-cn

### symptom_description

> 这个算法在I/O压力大，且I/O主要集中在某几个进程的时候，性能不太友好。

### diagnostic_steps

```
[step 1] 读取当前块设备 I/O 调度模式
  metric_name: block device I/O scheduler
  collection_layer: os
  collection_method_quote: "# cat /sys/block/$DEVICE-NAME/queue/scheduler"
  abnormal_pattern_quote: "[]中为当前使用的磁盘I/O调度模式。"
  abnormal_pattern_threshold: 当前调度器（[]中标识） ≠ 业务推荐值（HDD 数据库→deadline / SSD→noop）
  metric_unit: enum
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] HDD + 数据库/大数据业务仍用默认 CFQ
  param_name: /sys/block/$DEVICE-NAME/queue/scheduler
  abnormal_value_pattern: cfq（默认）∧ 磁盘类型=HDD ∧ 业务=数据库/大数据（I/O 集中型）
  reasoning_quote: "适合I/O压力大且I/O集中在某几个进程的场景，比如大数据、数据库使用HDD磁盘的场景。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 2] SSD 未配置为 noop 调度器
  param_name: /sys/block/$DEVICE-NAME/queue/scheduler
  abnormal_value_pattern: cfq / deadline ∧ 磁盘类型=SSD
  reasoning_quote: "因为固态硬盘支持随机读写，所以固态硬盘可以选择这种最简单的调度策略，性能最好。"
  linked_diagnostic_step_no: 1
```


## case_id: linux-fs-mount-nobarrier-audit-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-x86_64-generic
- **engine**: linux-os
- **symptom_category**: disk-io-saturation
- **case_pattern**: parameter-audit
- **title**: 带电池 RAID 卡环境未使用 nobarrier 挂载选项
- **source_heading**: 磁盘挂载方式优化nobarrier原理
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0041.html
- **source_url_lang**: zh-cn

### symptom_description

> Barrier（栅栏），即先加一个栅栏，保证日志总是先写入，然后对应数据才刷新到磁盘，这种方式保证了系统崩溃后磁盘恢复的正确性，但对写入性能有影响。

### diagnostic_steps

```
[step 1] 读取当前文件系统挂载选项
  metric_name: mount options for filesystem
  collection_layer: os
  collection_method_quote: (NULL · 原文未给"读取挂载选项"命令 · 见 reference/inferred-references.md#linux-fs-mount-options-readout)
  abnormal_pattern_quote: "服务器如果采用了RAID卡，并且RAID本身有电池，或者采用其它保护方案，那么就可以避免异常断电后日志的丢失，我们就可以关闭这个栅栏"
  abnormal_pattern_threshold: 挂载未含 nobarrier ∧ RAID 卡有电池
  metric_unit: enum (mount options)
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] 带电池 RAID 卡环境仍使用默认 barrier 挂载
  param_name: mount option · barrier / nobarrier
  abnormal_value_pattern: barrier (默认) ∧ RAID 有电池保护
  reasoning_quote: "nobarrier参数使得系统在异常断电时无法确保文件系统日志已经写入磁盘介质，因此只适用于使用了带有保护的RAID卡的情况。"
  linked_diagnostic_step_no: 1
```


## case_id: linux-fs-xfs-blocksize-audit-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-x86_64-generic
- **engine**: linux-os
- **symptom_category**: disk-io-saturation
- **case_pattern**: parameter-audit
- **title**: 大文件场景未选用 XFS 文件系统或 blocksize 仍为默认 4KB
- **source_heading**: 选用性能更优的文件系统XFS原理
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0041.html
- **source_url_lang**: zh-cn

### symptom_description

> XFS是一种高性能的日志文件系统，XFS极具伸缩性，非常健壮，特别擅长处理大文件，同时提供平滑的数据传输。

### diagnostic_steps

```
[step 1] 读取当前文件系统类型 + blocksize
  metric_name: filesystem type + blocksize
  collection_layer: os
  collection_method_quote: (NULL · 原文未给"读取文件系统类型/blocksize"命令 · 见 reference/inferred-references.md#linux-fs-type-blocksize-readout)
  abnormal_pattern_quote: "XFS文件系统在创建时，可先选择加大文件系统的block，更加适用于大文件的操作场景。"
  abnormal_pattern_threshold: filesystem ≠ xfs ∧ workload=大文件 ∨ blocksize=4096 ∧ workload=大文件
  metric_unit: enum / bytes
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] 大文件场景仍用 ext4 等非 XFS 文件系统
  param_name: filesystem type (mkfs.xfs vs mkfs.ext4)
  abnormal_value_pattern: ext4 / 其他 ∧ workload=大文件
  reasoning_quote: "XFS是一种高性能的日志文件系统，XFS极具伸缩性，非常健壮，特别擅长处理大文件，同时提供平滑的数据传输。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 2] XFS blocksize 仍为默认 4KB（4096B）
  param_name: mkfs.xfs -b size=
  abnormal_value_pattern: 4096 (默认) ∧ workload=大文件
  reasoning_quote: "指定blocksize，默认情况下为4KB（4096B），我们假设在格式化时指定为8192B"
  linked_diagnostic_step_no: 1
```


## case_id: kunpeng-arm64-spinlock-cas-cpu-waste-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **engine**: kunpeng-platform
- **symptom_category**: cpu-high
- **case_pattern**: core-perf-diagnosis
- **title**: 自旋锁/CAS 失败循环导致 CPU 资源浪费（perf top 锁函数占比 ≥ 5%）
- **source_heading**: 锁优化
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 4
- **source_url**: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0050.html
- **source_url_lang**: zh-cn

### symptom_description

> 自旋锁和CAS指令都是基于原子操作指令实现，当应用程序在执行原子操作失败后，并不会释放CPU资源，而是一直循环运行直到原子操作执行成功为止，导致CPU资源浪费。

### diagnostic_steps

```
[step 1] perf top 观察锁/原子操作函数 CPU 占比
  metric_name: perf top top-N functions（关注锁/原子操作类）
  collection_layer: flamegraph
  collection_method_quote: "可以通过perf top分析占用CPU资源靠前的函数"
  abnormal_pattern_quote: "如果锁的申请和释放在5%以上，可以考虑优化锁的实现"
  abnormal_pattern_threshold: lock_acquire+lock_release 函数 cpu_share ≥ 0.05
  metric_unit: ratio (%)
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] 全局锁导致每个 CPU core 都竞争同一变量
  cause_type: application-design
  description_quote: "并发任务高的场景下，如果系统中存在唯一的全局变量，那么每个CPU core都会申请这个全局变量对应的锁，导致这个锁的争抢严重。"
  linked_diagnostic_step_no: 1
  mitigation_quote: "可以基于业务逻辑，为每个CPU core或者线程分配对应的资源。"

[non_parameter_causes · cause 2] 高频访问的锁变量未按 CacheLine 对齐发生伪共享
  cause_type: application-design
  description_quote: "对于高频访问的锁变量，实际是对锁变量进行高频的读写操作，容易发生伪共享问题。"
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文给的是设计建议描述非可执行命令 · 见 reference/inferred-references.md#kunpeng-spinlock-cacheline-mitigation-narrative)

[non_parameter_causes · cause 3] 使用 ldxr+stxr+dmb ish 而非 ldaxr+stlxr 原子指令组合
  cause_type: application-design
  description_quote: "使用ldaxr+stlxr两条指令实现原子操作时，可以同时保证内存一致性，而ldxr+stxr指令并不能保证内存一致性，从而需要内存屏障指令（dmb ish）配合来实现内存一致性。从测试情况看，ldaxr+stlxr指令比ldxr+stxr+dmb ish指令的性能高。"
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文未给具体替换命令，仅说明指令组合差异)

[non_parameter_causes · cause 4] 线程并发数过高引发锁竞争激增
  cause_type: application-design
  description_quote: "减少线程并发数：参考调整线程并发数章节。"
  linked_diagnostic_step_no: 1
  mitigation_quote: "减少线程并发数：参考调整线程并发数章节。"
```


## case_id: kunpeng-cacheline-false-sharing-arm64-128b-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-arm64-kunpeng
- **engine**: kunpeng-platform
- **symptom_category**: cpu-high
- **case_pattern**: core-perf-diagnosis
- **title**: x86 上对齐良好的代码迁移到鲲鹏 920（CacheLine 128B）出现伪共享
- **source_heading**: CacheLine优化
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0052.html
- **source_url_lang**: zh-cn

### symptom_description

> writeHighFreq在一个CPU core中被改写后，这个Cache中对应的CacheLine长度的数据被标识为无效，也就是readHighFreq被CPU core标识为无效数据，虽然readHighFreq并没有被修改，但是CPU在访问readHighFreq时，依然会从内存重新导入，出现伪共享导致性能降低。

### diagnostic_steps

```
[step 1] 通过 perf 观察 Cache 命中率/伪共享指标
  metric_name: L1/L2/L3 cache miss + false-sharing event
  collection_layer: flamegraph
  collection_method_quote: (NULL · 原文未给具体 perf 命令 · 见 reference/inferred-references.md#kunpeng-cacheline-false-sharing-readout)
  abnormal_pattern_quote: "出现伪共享导致性能降低。"
  abnormal_pattern_threshold: (定性) cache miss 率显著升高 + 高频访问的读/写变量在同 CacheLine
  metric_unit: ratio / events
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] 高频访问的相邻变量未做 CacheLine 对齐（典型 false sharing）
  cause_type: application-design
  description_quote: "出现伪共享的常见原因是高频访问的数据未按照CacheLine大小对齐。"
  linked_diagnostic_step_no: 1
  mitigation_quote: "使用动态申请内存的对齐方法：1int posix_memalign(void **memptr, size_t alignment, size_t size)"

[non_parameter_causes · cause 2] 代码沿用 x86 的 64B CacheLine 假设但实际运行在 128B 的鲲鹏 920
  cause_type: bios-firmware-issue
  description_quote: "x86 L3 Cache的CacheLine大小为64字节，鲲鹏920的CacheLine为128字节。"
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文给的是源码改造建议描述非可执行命令 · 见 reference/inferred-references.md#kunpeng-cacheline-128b-mitigation-narrative)
```


## case_id: linux-vm-dirty-ratio-pause-on-large-memory-01

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-x86_64-generic
- **engine**: linux-os
- **symptom_category**: disk-io-saturation
- **case_pattern**: core-perf-diagnosis
- **title**: dirty_ratio 默认 20-30% 在大内存机上累积巨量脏页,触发同步 flush 卡顿
- **source_heading**: Virtual Memory · Dirty Ratio
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://www.percona.com/blog/tuning-linux-for-mongodb/
- **source_url_lang**: en

### symptom_description

> The “dirty_ratio” is the percentage of total system memory that can hold dirty pages. The default on most Linux hosts is between 20-30%. When you exceed the limit the dirty pages are committed to disk, creating a small pause.

### diagnostic_steps

```
[step 1] 读 dirty 比例当前值
  metric_name: vm.dirty_ratio / vm.dirty_background_ratio
  collection_layer: os
  collection_method_quote: "$ sysctl -a
  abnormal_pattern_quote: "on large-memory database servers, this can be a lot of memory! For example, on a 128GB-memory host, this can allow up to 38.4GB of dirty pages. The background ratio won’t kick in until 12.8GB!"
  abnormal_pattern_threshold: dirty_ratio 默认 20-30% 且物理内存 ≥ 64GB
  metric_unit: percent
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] 大内存机 dirty_ratio 默认值过高
  param_name: vm.dirty_ratio / vm.dirty_background_ratio
  abnormal_value_pattern: dirty_ratio = 20-30(默认) · dirty_background_ratio = 10-15(默认)
  reasoning_quote: "A recommended setting for dirty ratios on large-memory (64GB+ perhaps) database servers is: “vm.dirty_ratio = 15″ and “vm.dirty_background_ratio = 5″, or possibly less. (Red Hat recommends lower ratios of 10 and 3 for high-performance/large-memory servers.)"
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] 一次性大批量落盘吞吐反不如分批
  cause_type: application-design
  description_quote: "Reducing caches sizes also guarantees data gets written to disk in smaller batches more frequently, which increases disk throughput (than huge bulk writes less often)."
  linked_diagnostic_step_no: 1
  mitigation_quote: "vm.dirty_ratio = 15<br>vm.dirty_background_ratio = 5"
```


## case_id: linux-thp-mongodb-sparse-memory-access-02

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-x86_64-generic
- **engine**: linux-os
- **symptom_category**: memory-pressure
- **case_pattern**: core-perf-diagnosis
- **title**: Transparent HugePages 在 MongoDB 稀疏内存访问场景下产生开销
- **source_heading**: Transparent HugePages
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://www.percona.com/blog/tuning-linux-for-mongodb/
- **source_url_lang**: en

### symptom_description

> Transparent HugePages is an optimization introduced in CentOS/RedHat 6.0, with the goal of reducing overhead on systems with large amounts of memory. However, due to the way MongoDB uses memory, this feature actually does more harm than good as memory access are rarely contiguous.

### diagnostic_steps

```
[step 1] 读 THP 启动参数
  metric_name: kernel boot option transparent_hugepage
  collection_layer: os
  collection_method_quote: (NULL · 原文给出的是设置值 `transparent_hugepage=never`,未给读取命令 · 见 reference/inferred-references.md#thp-read-cat-cross-from-mongodb-doc)
  abnormal_pattern_quote: "due to the way MongoDB uses memory, this feature actually does more harm than good as memory access are rarely contiguous."
  abnormal_pattern_threshold: (Pre-8.0 视角)/sys/kernel/mm/transparent_hugepage/enabled 当前不为 `never`
  metric_unit: enum
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] transparent_hugepage 未禁用(legacy guidance)
  param_name: kernel.transparent_hugepage
  abnormal_value_pattern: always 或 madvise(非 never)
  reasoning_quote: "due to the way MongoDB uses memory, this feature actually does more harm than good as memory access are rarely contiguous."
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] MongoDB 内存访问稀疏的应用层特性
  cause_type: application-design
  description_quote: "due to the way MongoDB uses memory, this feature actually does more harm than good as memory access are rarely contiguous."
  linked_diagnostic_step_no: 1
  mitigation_quote: "transparent_hugepage=never"
```


## case_id: linux-readahead-default-128kb-wastes-fs-cache-04

- **entry_kind**: diagnostic-flow
- **db**: _common
- **platform**: linux-x86_64-generic
- **engine**: linux-os
- **symptom_category**: memory-pressure
- **case_pattern**: core-perf-diagnosis
- **title**: 块设备 read-ahead 默认 128KB 浪费 MongoDB 文件系统缓存
- **source_heading**: Read-Ahead
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://www.percona.com/blog/tuning-linux-for-mongodb/
- **source_url_lang**: en

### symptom_description

> MongoDB tends to have very random disk patterns and often does not benefit from the default read-ahead setting, wasting memory that could be used for more hot data. Most Linux systems have a default setting of 128KB/256 sectors (128KB = 256 x 512-byte sectors). This means if MongoDB fetches a 64kb document from disk, 128kb of filesystem cache is used and maybe the extra 64kb is never accessed later, wasting memory.

### diagnostic_steps

```
[step 1] 读 read-ahead 当前值
  metric_name: block device read_ahead_kb / sectors
  collection_layer: os
  collection_method_quote: "$ sudo blockdev --getra /dev/sda"
  abnormal_pattern_quote: "Most Linux systems have a default setting of 128KB/256 sectors (128KB = 256 x 512-byte sectors)."
  abnormal_pattern_threshold: 默认 256 扇区(=128KB),建议 32 扇区(=16KB)
  metric_unit: sectors
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] read_ahead_kb / 扇区数过大
  param_name: block device queue/read_ahead_kb(udev ATTR{bdi/read_ahead_kb})
  abnormal_value_pattern: 默认 128(=256 扇区),建议 16(=32 扇区)
  reasoning_quote: "For this setting, we suggest a starting-point of 32 sectors (=16KB) for most MongoDB workloads. From there you can test increasing/reducing this setting and then monitor a combination of query performance, cached memory usage, and disk read activity to find a better balance."
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] MongoDB 应用层访问模式偏随机
  cause_type: application-design
  description_quote: "MongoDB tends to have very random disk patterns and often does not benefit from the default read-ahead setting, wasting memory that could be used for more hot data."
  linked_diagnostic_step_no: 1
  mitigation_quote: "ACTION==\"add
```


## case_id: mongo-cache-spike-replication-lag-cascade-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: replica-lag
- **case_pattern**: core-perf-diagnosis
- **title**: WiredTiger Cache 峰值与复制延迟级联失败 (MongoDB 3.0 → 3.4 升级修复)
- **source_heading**: Troubleshooting a MongoDB Performance Issue
- **diagnostic_steps_count**: 3
- **likely_causes_count**: 4
- **source_url**: https://alexbevi.com/blog/2018/05/28/troubleshooting-a-mongodb-performance-issue/
- **source_url_lang**: en

### symptom_description

> This chart (48 hours sampled from 1 week ago) shows Cache Usage spiking and Replication Lag spiking. The cache spikes occur as new writes trigger index activity, which invalidates (dirties) cached memory and causes cache eviction.

### diagnostic_steps

```
[step 1] 观察 Cache Usage 是否在 spike
  metric_name: wiredTiger.cache.bytes_currently_in_the_cache
  collection_layer: mongo-internal-counter
  collection_method_quote: (NULL · 原文未给具体采集命令 · 见 reference/inferred-references.md#alexbevi-cache-usage-collection-cmd)
  abnormal_pattern_quote: "Cache Usage spiking"
  abnormal_pattern_threshold: NULL
  metric_unit: bytes
  prerequisite_steps: []

[step 2] 观察 Replication Lag 是否在 spike
  metric_name: replication_lag
  collection_layer: mongo-shell
  collection_method_quote: (NULL · 原文未给具体采集命令 · 见 reference/inferred-references.md#alexbevi-repl-lag-collection-cmd)
  abnormal_pattern_quote: "Replication Lag spiking"
  abnormal_pattern_threshold: NULL
  metric_unit: seconds
  prerequisite_steps: []

[step 3] 观察主节点是否需要重启来释放 cache
  metric_name: mongod_process_state
  collection_layer: os
  collection_method_quote: (NULL · 原文未给具体采集命令 · 见 reference/inferred-references.md#alexbevi-restart-cycle-cmd)
  abnormal_pattern_quote: "cache usage hits a certain point on the primary (left) server after which we have to kill the instance"
  abnormal_pattern_threshold: NULL
  metric_unit: NULL
  prerequisite_steps: [1]
```

### likely_causes

```
[non_parameter_causes · cause 1] 写入触发索引活动 → cache 脏化 → eviction → 复制变慢
  cause_type: application-design
  description_quote: "The cache spikes occur as new writes trigger index activity, which invalidates (dirties) cached memory and causes cache eviction."
  linked_diagnostic_step_no: 1
  mitigation_quote: NULL

[non_parameter_causes · cause 2] Secondaries 拉取数据被慢化 → lag 上升
  cause_type: application-design
  description_quote: "This slows down the speed at which the secondaries can request data from the primary, which spikes the lag."
  linked_diagnostic_step_no: 2
  mitigation_quote: NULL

[non_parameter_causes · cause 3] Secondaries 大量请求反过来锁定 primary,新写入被节流
  cause_type: application-design
  description_quote: "When the secondaries request more data, it would lock up the primary, which in turn affected the primary server's ability to ingest new content and write it to disk. The read/write buffers back up and new write requests are throttled."
  linked_diagnostic_step_no: 2
  mitigation_quote: "As of MongoDB 4.0, non-blocking secondary reads have been added to address these types of latency issues."

[non_parameter_causes · cause 4] MongoDB 3.0 老版本的 cache management / checkpoint / WAL 优化未引入
  cause_type: os-version-bug
  description_quote: "the improvements to cache management and checkpoint areas were more likely to have improved my situation"
  linked_diagnostic_step_no: 1
  mitigation_quote: "We completed a significant upgrade on Tuesday that brings our cluster up to mongodb-server 3.4.15 (from 3.0.15)."
```


## case_id: mongo-ulimit-low-defaults-mongod-issues-03

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: linux-os
- **symptom_category**: startup-failure
- **case_pattern**: fault-management
- **title**: 系统默认 ulimit 过低导致 mongod 运行异常
- **source_heading**: ulimit(in "Tuning For Performance")
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://amperecomputing.com/tuning-guides/mongoDB-tuning-guide
- **source_url_lang**: en

### symptom_description

> Most UNIX-like operating systems, including Linux and macOS, provide ways to limit and control the usage of system resources such as threads, files, and network connections on a per-process and per-user basis. These "ulimits" prevent single users from using too many system resources. Sometimes, these limits have low default values that can cause a number of issues in the course of normal MongoDB operation.

### diagnostic_steps

```
[step 1] 看 mongod 进程的 ulimit
  metric_name: mongod 进程 nofile / nproc / fsize / memlock 等 ulimit
  collection_layer: os
  collection_method_quote: (Ampere 文档未直接给读法 · 通用方法 `cat /proc/$(pgrep -f mongod)/limits`)
  abnormal_pattern_quote: "these limits have low default values that can cause a number of issues"
  abnormal_pattern_threshold: nofile < 64000 / nproc < 64000(基于 mitigation 给定的推荐值)
  metric_unit: count
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] 系统级 limits.conf 未调
  param_name: /etc/security/limits.conf 中各 ulimit 项
  abnormal_value_pattern: 默认偏低(发行版自带)
  reasoning_quote: "To configure ulimit value for these versions, create a file named /etc/security/limits.d/99-mongodb-nproc.conf with new values to increase the process limit."
  linked_diagnostic_step_no: 1
```


## case_id: mongo-shard-chunk-migration-x-lock-timeout-balancer-stuck-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: lock-contention
- **case_pattern**: core-perf-diagnosis
- **title**: shard chunk migration 卡死 LockTimeout · balancer 一直 abort
- **source_heading**: MongoDB Chunk Migration Failed Solution: Unable to acquire X lock
- **diagnostic_steps_count**: 5
- **likely_causes_count**: 3
- **source_url**: https://finisky.github.io/en/mongodb-chunk-migration-failed/
- **source_url_lang**: en

### symptom_description

> balancer is not working. sh.status() displays many chunk migration errors

### diagnostic_steps

```
[step 1] 用 sh.status() 看各 shard 的 chunk 分布与 24h migration 结果
  metric_name: sharding.balancer.migration_24h_results · sharding.collection.chunks_per_shard
  collection_layer: mongo-shell
  collection_method_quote: (NULL · 原文给的是 sh.status() 的输出而非显式调用命令的字面 quote · 见 reference/inferred-references.md#mongo-sh-status-readout-shell-knowledge)
  abnormal_pattern_quote: "7 : Failed with error 'aborted', from mongo-1 to mongo-3"
  abnormal_pattern_threshold: {"failed_migrations_24h": ">= 7000", "chunk_skew_max_min_ratio": ">= 1.5"}
  metric_unit: count
  prerequisite_steps: []

[step 2] 在 config server 上 grep mongodb.log 的 SHARDING 模块 Migration failed log
  metric_name: log.SHARDING.MigrationFailed.error
  collection_layer: log-grep
  collection_method_quote: (NULL · 原文只说 "debug the issue through mongodb.log on the config server" 未给具体 grep 命令字面 · 见 reference/inferred-references.md#mongo-config-server-log-grep-shell-knowledge)
  abnormal_pattern_quote: "LockTimeout: Unable to acquire X lock on '{13328793763114131834: Collection, 1799578717045662184, X.A}' within 500ms. opId: 669456657, op: MoveChunk, connId: 0."
  abnormal_pattern_threshold: {"error_class": "LockTimeout", "op": "MoveChunk", "lock_timeout_ms": 500}
  metric_unit: log_event
  prerequisite_steps: [1]

[step 3] 手动 sh.moveChunk 验证错误重现
  metric_name: sh.moveChunk.errmsg
  collection_layer: mongo-shell
  collection_method_quote: "sh.moveChunk(\"X.A\", {\"Uuid\": \"XX\"}, \"mongo-3\" )"
  abnormal_pattern_quote: "Unable to acquire X lock on '{13328793763114131834: Collection, 1799578717045662184, X.A}' within 500ms. opId: 719103624, op: MoveChunk, connId: 0."
  abnormal_pattern_threshold: {"errmsg_class": "LockTimeout", "code": 24, "codeName": "LockTimeout"}
  metric_unit: error_message
  prerequisite_steps: [2]

[step 4] 排查 jumbo chunks 是否触发(经典误区)
  metric_name: sharding.collection.jumbo_chunks
  collection_layer: mongo-shell
  collection_method_quote: "sh.status(true)"
  abnormal_pattern_quote: "jumbo chunks might lead to migration failure. So we checked the collection chunks by sh.status(true), NO jumbo chunks found."
  abnormal_pattern_threshold: {"jumbo_chunks_count": "> 0 → suspect; == 0 → 排除"}
  metric_unit: count
  prerequisite_steps: [3]

[step 5] db.currentOp() 看正在持锁的 op
  metric_name: currentOp.locks · currentOp.waitingForLock
  collection_layer: mongo-shell
  collection_method_quote: "db.currentOp()"
  abnormal_pattern_quote: "We also try to check the current operations and locks via db.currentOp() , but not have a clue."
  abnormal_pattern_threshold: {"hint": "线索缺失 · 进入下一步源端切主验证"}
  metric_unit: n/a
  prerequisite_steps: [4]
```

### likely_causes

```
[non_parameter_causes · cause 1] 源 mongod 进程内部状态不一致 · X 锁释放卡死(本案根因)
  cause_type: application-design
  description_quote: "the original mongod process has inconsistent states. Restart is just a simple way to force another member to become primary, which bypass the inconsistent states issue of the original mongod."
  linked_diagnostic_step_no: 5
  mitigation_quote: "we restart the source mongod process through MongoDB Ops Manager to change the primary in the shard"

[non_parameter_causes · cause 2] jumbo chunks 阻塞迁移(本案排除 · 但作为标准排查项保留)
  cause_type: data-distribution
  description_quote: "jumbo chunks might lead to migration failure"
  linked_diagnostic_step_no: 4
  mitigation_quote: (NULL · 原文未给 jumbo chunks 的 split / forceJumbo 命令字面 · 见 reference/inferred-references.md#mongo-jumbo-chunk-split-cross-from-mongodb-doc)

[non_parameter_causes · cause 3] maxTransactionLockRequestTimeoutMillis 默认 500ms 过短(本案怀疑但未尝试)
  cause_type: application-design
  description_quote: "Google a similar discussion here, which suggests to set maxTransactionLockRequestTimeoutMillis longer."
  linked_diagnostic_step_no: 3
  mitigation_quote: (NULL · 原作者顾虑生产副作用未尝试 · 备择方案 · 见 reference/inferred-references.md#mongo-maxtxnlocktimeout-tuning-not-tested)
```


## case_id: mongo-wt-large-page-eviction-fetch-pause-server-16479

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: core-perf-diagnosis
- **title**: WiredTiger 大页驱逐导致 fetch 期间多次显著停顿
- **source_heading**: Description (SERVER-16479)
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 3
- **source_url**: https://jira.mongodb.org/browse/SERVER-16479
- **source_url_lang**: en

### symptom_description

> Test consists of a single thread inserting about 800 MB worth of documents then fetching them back. Under rc1 significant pauses would be observed during the inserts; rc2 has eliminated the pauses during inserts, but at the expense of comparable pauses during the fetches.

### diagnostic_steps

```
[step 1] 监测 wiredTiger.cache.pages written from cache 与 read into cache 同步峰值
  metric_name: wiredTiger.cache.pages written from cache / pages read into cache
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · JIRA 描述未给具体读取命令 · 见 reference/inferred-references.md#wt-cache-pages-from-serverstatus-cross)
  abnormal_pattern_quote: "First query experiences about half a dozen regularly spaced significant pauses (e.g. D and E), coinciding with page evictions due to the large in-memory pages created by the insertions, as indicated by the coincident peaks in pages written from cache."
  abnormal_pattern_threshold: fetch 期间 pages written from cache 与 pages read into cache 周期性同步出现尖峰
  metric_unit: count
  prerequisite_steps: []

[step 2] gdb 抽样定位驱逐发生在 WiredTigerSession::releaseCursor
  metric_name: mongod 进程栈采样函数命中分布
  collection_layer: flamegraph
  collection_method_quote: "sampling periodically with gdb. The eviction shows up as a pause between the first query and the getmores from the app, coinciding with pages being written"
  abnormal_pattern_quote: "The gdb samples coinciding with this interval show that the eviction is occuring in __wt_btcur_reset called from WiredTigerSession::releaseCursor during the traversal of the collection."
  abnormal_pattern_threshold: gdb 采样栈中重复出现 `__wt_btcur_reset` / `WiredTigerSession::releaseCursor`
  metric_unit: enum
  prerequisite_steps: [1]
```

### likely_causes

```
[parameter_causes · cause 1] memory_page_max 过大导致单页驱逐成本极高
  param_name: wiredTiger.engineConfig.memory_page_max(诊断专用 · 实际生产不应调)
  abnormal_value_pattern: 设到接近 1GB(诊断时为复现单次大停顿设的)
  reasoning_quote: "Profile was obtained by increasing memory_page_max to 1GB to move all the pauses to a single long pause as the 1GB page is evicted"
  linked_diagnostic_step_no: 2

[non_parameter_causes · cause 1] MongoDB 2.8.0-rc2 的 WiredTiger 实现把 insert 阶段的卡顿迁移到了 fetch 阶段
  cause_type: os-version-bug
  description_quote: "Under rc1 significant pauses would be observed during the inserts; rc2 has eliminated the pauses during inserts, but at the expense of comparable pauses during the fetches."
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 该 ticket Resolution=Duplicate · 真正修复在 SERVER-16269 · 升级 mongod 到 ≥ 3.0 GA 含修复)

[non_parameter_causes · cause 2] WiredTigerSession::releaseCursor 触发 page eviction 在游标释放路径上同步发生
  cause_type: application-design
  description_quote: "the eviction is occuring in __wt_btcur_reset called from WiredTigerSession::releaseCursor during the traversal of the collection."
  linked_diagnostic_step_no: 2
  mitigation_quote: (NULL · ticket 描述未给应用侧绕过方法)
```


## case_id: mongo-wt-btree-sweep-eviction-collection-blocked-server-17907

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: core-perf-diagnosis
- **title**: sweep server 整 b-tree 驱逐期间集合访问被阻塞数分钟
- **source_heading**: Description (SERVER-17907)
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 3
- **source_url**: https://jira.mongodb.org/browse/SERVER-17907
- **source_url_lang**: en

### symptom_description

> The sweep server under some conditions will evict entire b-trees, and for a large b-tree this can take an extended time (many minutes in some cases). While this is occurring any attempt to access the b-tree hangs.

### diagnostic_steps

```
[step 1] 用 mongostat 观察 cache 利用率从 80% 跌到 0%
  metric_name: wiredTiger cache used % (mongostat 输出列 used)
  collection_layer: mongo-runtime-cmd
  collection_method_quote: "Start mongostat to monitor the cache statistics while paging in the b-trees using this command:"
  abnormal_pattern_quote: "While this is running you should observe the cache utilization climb to its limit, 80%."
  abnormal_pattern_threshold: cache 利用率从 80% 在数分钟内跌到 0%
  metric_unit: percent
  prerequisite_steps: []

[step 2] 用 db.c.stats() 观察集合大小
  metric_name: db.collection.stats(1024*1024).size + totalIndexSize
  collection_layer: mongo-shell
  collection_method_quote: "s = db.c.stats(1024*1024)"
  abnormal_pattern_quote: "Soon after this (within a minute) the sweep server will begin evicting the test.c collection and _id index b-trees; you will see cache utilization drop from 80% to 0% over the course of some time (a couple minutes, somewhat longer on Windows than Linux). During this time accesses to test.c block."
  abnormal_pattern_threshold: size + totalIndexSize 接近 cacheSize 上限 + 长时间未访问后被 sweep
  metric_unit: MB
  prerequisite_steps: [1]
```

### likely_causes

```
[parameter_causes · cause 1] cacheSize 与单 b-tree 大小不匹配 · 8GB 数据 + 9GB cache 触发整树驱逐
  param_name: storage.wiredTiger.engineConfig.cacheSizeGB
  abnormal_value_pattern: cache 容纳了几乎一棵完整 b-tree;sweep 时整树一次性驱逐
  reasoning_quote: "Example: start mongod with --storageEngine wiredTiger --wiredTigerCacheSizeGB 9. Then populate a collection with 8 GB of collection and index data"
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] MongoDB 3.0.1 WiredTiger sweep 实现 bug · 整 b-tree 同步驱逐
  cause_type: os-version-bug
  description_quote: "The sweep server under some conditions will evict entire b-trees, and for a large b-tree this can take an extended time (many minutes in some cases). While this is occurring any attempt to access the b-tree hangs."
  linked_diagnostic_step_no: 2
  mitigation_quote: (NULL · ticket Resolution=Done · Fix Version 3.0.3 / 3.1.2 · 升级 mongod 即可)

[non_parameter_causes · cause 2] 小文档加剧驱逐 · 待释放 buffer 数极多
  cause_type: application-design
  description_quote: "using small documents as below probably exacerbates the issue because it makes the eviction slower due to the number of buffers that must be freed during the eviction"
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 文档大小一般由业务设计,不是诊断侧能改的)
```


## case_id: mongo-tcmalloc-decommit-madvise-lock-stall-server-31417

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: core-perf-diagnosis
- **title**: tcmalloc 归还大量 pageheap free memory 时持内部锁数秒 · 全线程延迟尖峰
- **source_heading**: Description (SERVER-31417)
- **diagnostic_steps_count**: 4
- **likely_causes_count**: 2
- **source_url**: https://jira.mongodb.org/browse/SERVER-31417
- **source_url_lang**: en

### symptom_description

> tcmalloc may occasionally release large amounts of pageheap free memory to the kernel by calling madvise. This can take seconds when the amount of memory involved is many GB. A tcmalloc internal lock is held while this happens, so this can potentially stall many threads, causing widespread latency spikes.

### diagnostic_steps

```
[step 1] 同一时刻 tcmalloc.pageheap_free_bytes 跌至接近 0
  metric_name: serverStatus.tcmalloc.tcmalloc.pageheap_free_bytes
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · ticket 描述未给具体读取命令 · 见 reference/inferred-references.md#tcmalloc-stats-from-serverstatus)
  abnormal_pattern_quote: "tcmalloc pageheap free memory decreases to near zero"
  abnormal_pattern_threshold: pageheap_free_bytes 在数秒内由数 GB 跌到接近 0
  metric_unit: bytes
  prerequisite_steps: []

[step 2] 同时 tcmalloc unmapped 内存对应增加
  metric_name: serverStatus.tcmalloc.tcmalloc.pageheap_unmapped_bytes
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 同 ref)
  abnormal_pattern_quote: "tcmalloc unmapped memory increases by a corresponding amount"
  abnormal_pattern_threshold: unmapped_bytes 同时段对称增加
  metric_unit: bytes
  prerequisite_steps: [1]

[step 3] mongod 进程 RSS 同步下降
  metric_name: mongod 进程 RSS
  collection_layer: os
  collection_method_quote: (NULL · 同 ref 见 reference/inferred-references.md#mongod-vsz-from-ps-shell)
  abnormal_pattern_quote: "resident memory decreases by the same amount"
  abnormal_pattern_threshold: RSS 同时段下降相同量级
  metric_unit: bytes
  prerequisite_steps: [1]

[step 4] 系统 free memory 同步上升
  metric_name: /proc/meminfo MemFree
  collection_layer: os
  collection_method_quote: (NULL · ticket 未给读取命令 · 见 reference/inferred-references.md#meminfo-from-proc)
  abnormal_pattern_quote: "system free memory increases by that amount"
  abnormal_pattern_threshold: OS 层 MemFree 同时段对应上升
  metric_unit: bytes
  prerequisite_steps: [1]
```

### likely_causes

```
[non_parameter_causes · cause 1] tcmalloc decommit 实现持全局锁,madvise 慢操作放大延迟尖峰
  cause_type: application-design
  description_quote: "A tcmalloc internal lock is held while this happens, so this can potentially stall many threads, causing widespread latency spikes."
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · ticket Resolution=Fixed · Fix Version 8.0.0 · 升级 mongod 到 ≥ 8.0 即可获得改进)

[non_parameter_causes · cause 2] 直接指标缺失,SERVER-31380 才会补充
  cause_type: application-design
  description_quote: "There is no direct metric that diagnoses this (SERVER-31380 would provide that), but it can be indirectly inferred to be a likely cause from the following:"
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 暂只能用 4 间接指标共发推断;直接指标待 SERVER-31380 上线)
```


## case_id: mongo-tcmalloc-heap-fragmentation-pageheap-free-server-33296

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: memory-pressure
- **case_pattern**: core-perf-diagnosis
- **title**: mongod 内存远超已分配数据 · pageheap_free_bytes 持续累积
- **source_heading**: Description (SERVER-33296)
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 3
- **source_url**: https://jira.mongodb.org/browse/SERVER-33296
- **source_url_lang**: en

### symptom_description

> Over time allocated memory never exceeds 8 GB but heap size and resident memory reach nearly 14 GB this is due to an accumulation of pageheap_free_bytes

### diagnostic_steps

```
[step 1] 比较 mongod allocated 与 RSS / 堆大小
  metric_name: mongod tcmalloc.tcmalloc.generic.heap_size / current_allocated_bytes / pageheap_free_bytes
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · ticket 描述未给具体读取命令 · 见 reference/inferred-references.md#tcmalloc-stats-from-serverstatus)
  abnormal_pattern_quote: "allocated memory never exceeds 8 GB but heap size and resident memory reach nearly 14 GB this is due to an accumulation of pageheap_free_bytes"
  abnormal_pattern_threshold: (heap_size - current_allocated_bytes) ≈ pageheap_free_bytes 且持续增长
  metric_unit: bytes
  prerequisite_steps: []

[step 2] 读 mongod 进程 RSS
  metric_name: mongod 进程 RSS
  collection_layer: os
  collection_method_quote: (NULL · 同 ref 见 reference/inferred-references.md#mongod-vsz-from-ps-shell)
  abnormal_pattern_quote: "but heap size and resident memory reach nearly 14 GB"
  abnormal_pattern_threshold: RSS ≫ allocated_bytes(原文示例 ≈ 14GB vs 8GB)
  metric_unit: bytes
  prerequisite_steps: [1]
```

### likely_causes

```
[parameter_causes · cause 1] TCMALLOC_AGGRESSIVE_DECOMMIT 默认未启用
  param_name: TCMALLOC_AGGRESSIVE_DECOMMIT(环境变量 / 启动参数)
  abnormal_value_pattern: 未启用(默认),pageheap_free_bytes 不主动归还 OS
  reasoning_quote: "Setting TCMALLOC_AGGRESSIVE_DECOMMIT can address this issue by causing tcmalloc to aggressively return the free pages to the o/s where they can then be re-used by tcmalloc to satisfy new memory requests. However can have an unacceptable negative performance impact."
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] 内存分配 size 分布在变化 · free pages 卡在某 size 类不可被新 size 复用
  cause_type: application-design
  description_quote: "A common cause of this is a shifting distribution of allocated memory sizes, which leaves free pages dedicated to one size of buffer unable to be used for new memory requests because they are for a different size buffer."
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · ticket Resolution=Unresolved · 修复路线尚在 backlog;部分情形可启用 AGGRESSIVE_DECOMMIT 但有性能代价)

[non_parameter_causes · cause 2] MongoDB 3.6.2 的 WiredTiger 整体内存占用模型与 tcmalloc decommit 不友好
  cause_type: os-version-bug
  description_quote: "The changes described in SERVER-20306 eliminated a common source of memory fragmentation, but it can still occur for other reasons."
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · ticket 仍未解决)
```


## case_id: mongo-wt-tcmalloc-fragmentation-durable-history-wt-6175

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: memory-pressure
- **case_pattern**: core-perf-diagnosis
- **title**: 4.4 引入 durable history 后 tcmalloc 碎片化加剧 · mongod VSZ 比 4.2.6 多约 9G
- **source_heading**: Description (WT-6175)
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 3
- **source_url**: https://jira.mongodb.org/browse/WT-6175
- **source_url_lang**: en

### symptom_description

> The accumulation of many small data structures (typically associated with inserts and updates) in the WiredTiger cache can cause the system's memory allocator to use more space than is requested by WiredTiger.

### diagnostic_steps

```
[step 1] 比较 mongod 进程 VSZ 与配置 cacheSize 的差距
  metric_name: mongod 进程 VSZ
  collection_layer: os
  collection_method_quote: (NULL · ticket 描述未给具体读取命令 · 见 reference/inferred-references.md#mongod-vsz-from-ps-shell)
  abnormal_pattern_quote: "For 4.4.0-rc4, VSZ for the mongod process is ~9G larger after create index compared to VSZ for 4.2.6 or 4.4 prior to the durable history merge."
  abnormal_pattern_threshold: mongod VSZ 比 cacheSizeGB + 合理开销大数 GB(原文示例 4.4-rc4 多 9G)
  metric_unit: GB
  prerequisite_steps: []

[step 2] 观察 cache dirty % 是否被新 eviction_updates_target 拖低
  metric_name: wiredTiger cache dirty %
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · ticket 描述未给具体读取命令 · 见 reference/inferred-references.md#wt-cache-dirty-percent-from-serverstatus)
  abnormal_pattern_quote: "If this occurs you will notice that cache dirty % tends more toward the eviction_updates_target of 2.5% rather than the eviction_dirty_target of 5%."
  abnormal_pattern_threshold: cache dirty % 长期接近 2.5% 而非 5%(说明被新 updates trigger 主导)
  metric_unit: percent
  prerequisite_steps: [1]
```

### likely_causes

```
[parameter_causes · cause 1] WT 4.4+ 新增的 eviction_updates_trigger=10% / target=2.5% 限制 small-object 累积
  param_name: wiredTiger.cache.eviction_updates_trigger / eviction_updates_target
  abnormal_value_pattern: 默认 trigger=10%(eviction_dirty_trigger/2),target=2.5%(eviction_dirty_target/2);若与 workload 不匹配会过早 eviction 或不够 eviction
  reasoning_quote: "Adding a configurable trigger (eviction_updates_trigger) on the amount of small objects in the cache, to prompt eviction of that content. The default value is eviction_dirty_trigger / 2 (10%). Adding a configurable target (eviction_updates_target) to serve as a goal for the eviction process. The default value is eviction_dirty_target / 2 (2.5%)."
  linked_diagnostic_step_no: 2

[non_parameter_causes · cause 1] MongoDB 4.4 durable history 设计致小对象数量激增
  cause_type: application-design
  description_quote: "With the introduction of durable history in MongoDB 4.4, it is more common that small memory allocations associated with these small objects are contributing more to fragmentation than in previous versions."
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · ticket Resolution=Fixed · Fix Version 4.4.0-rc10 / 4.7.0 · 升级 mongod 即可)

[non_parameter_causes · cause 2] cache 中 small-object 重新驻留 + checkpoint 后被标 clean · 这部分不在脏页 trigger 控制范围
  cause_type: application-design
  description_quote: "However, some WiredTiger cache pages with many associated small memory allocations can remain in cache after a checkpoint and be marked as clean pages. The clean/dirty distinction helps limit the amount of work done in checkpoints, but is in this way an estimate of memory allocator fragmentation."
  linked_diagnostic_step_no: 1
  mitigation_quote: "Tracking insert and update data structures as a separate attribute of cache usage. Extending the cache eviction process to manage the proportion of cache associated with small allocations, similarly to how it manages clean and dirty content."
```


## case_id: mongo-globallock-current-queue-high-lock-contention-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: lock-contention
- **case_pattern**: core-perf-diagnosis
- **title**: globalLock.currentQueue.total 持续高 → 大量请求等锁 → 性能降级
- **source_heading**: 锁性能
- **diagnostic_steps_count**: 3
- **likely_causes_count**: 1
- **source_url**: https://mongoing.com/archives/39593
- **source_url_lang**: zh-cn

### symptom_description

> MongoDB使用一套锁机制确保数据集的一致性。如果某个操作执行时间较长或是一个队列表单，下一操作请求由于要等待当前操作释放锁而出现性能降级。

### diagnostic_steps

```
[step 1] 用 serverStatus 查 globalLock.currentQueue.total 是否持续高
  metric_name: globalLock.currentQueue.total
  collection_layer: mongo-shell
  collection_method_quote: (NULL · 原文未给字面 db.serverStatus() 命令 · 见 reference/inferred-references.md#mongoing-39593-serverStatus-cmd)
  abnormal_pattern_quote: "如果 globalLock.currentQueue.total 值持续较高，有可能有大量的请求在等待锁释放。说明可能有影响性能的并发问题。"
  abnormal_pattern_threshold: NULL
  metric_unit: count
  prerequisite_steps: []

[step 2] 比较 globalLock.totalTime 与 uptime 看死锁是否长期持续
  metric_name: globalLock.totalTime_vs_uptime
  collection_layer: mongo-shell
  collection_method_quote: (NULL · 同上 · 见 reference/inferred-references.md#mongoing-39593-serverStatus-cmd)
  abnormal_pattern_quote: "如果  globalLock.totalTime  相对于  uptime 较高，说明数据库的死锁已经维持一段时间了。"
  abnormal_pattern_threshold: NULL
  metric_unit: NULL
  prerequisite_steps: [1]

[step 3] 计算 locks.timeAcquiringMicros / acquireWaitCount 平均等待时间
  metric_name: locks.avg_acquire_wait_micros
  collection_layer: mongo-shell
  collection_method_quote: (NULL · 原文给指标名未给字面命令 · 见 reference/inferred-references.md#mongoing-39593-serverStatus-cmd)
  abnormal_pattern_quote: "locks.timeAcquiringMicros除以locks.acquireWaitCount能计算出特定锁模式的平均等待时间。"
  abnormal_pattern_threshold: NULL
  metric_unit: micros
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] 索引无效 / 表设计差 / 查询结构差 / 内存不足触发磁盘读 → 慢查询长持锁
  cause_type: application-design
  description_quote: "慢查询可能的原因：索引的无效使用；非最优表设计模式；糟糕的查询结构；系统架构问题；内存不足触发磁盘读取。"
  linked_diagnostic_step_no: 1
  mitigation_quote: NULL
```


## case_id: mongo-pagination-skip-deep-page-rewrite-02

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: core-perf-diagnosis
- **title**: 大翻页 skip 性能塌陷: skip 100 页 12.8s → 改写 $gt 后稳定 10-20ms
- **source_heading**: 分页翻页案例以及执行效率
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://mongoing.com/archives/74118
- **source_url_lang**: zh-cn

### symptom_description

> 分页翻页，尤其是结果集特别多越往后翻页越慢，常规写法

### diagnostic_steps

```
[step 1] explain 翻不同页位置的 skip 查询,看时间随页号增长
  metric_name: explain.executionTimeMillis_per_page
  collection_layer: mongo-shell
  collection_method_quote: "db.test.find({org:\"10000\", signT:{$gte:new Date(1590940800000), $lte: new Date(1591027199999)},signStatus:{$in:[0,1]} }).sort({no:1}).skip(50).limit(50).explain(\"executionStats\")"
  abnormal_pattern_quote: "翻第二页(每页50条)\n\n\"executionStats\" : {\n\"executionSuccess\" : true,\n\"nReturned\" : 50,\n\"executionTimeMillis\" : 29,\n\"totalKeysExamined\" : 876,\n\"totalDocsExamined\" : 100,"
  abnormal_pattern_threshold: {"page2_ms": 29, "page10_ms": 1001, "page100_ms": 12830}
  metric_unit: ms / keys
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] skip 必须扫前面所有 keys → 越深越慢
  cause_type: application-design
  description_quote: "索引:org:1,no:1,signT:1,翻页从第一页到100页，执行时间从29ms到12830ms。其实100页数据才5000条,但是totalKeysExamined检查是108725,此时返回5000条，相当于indexkey:doc=20:1,显然是低效索引的。"
  linked_diagnostic_step_no: 1
  mitigation_quote: "取消skip方式,对排序列增加一个大于上一页最大值来快速获取分页，性能基本上在10-20ms之间。"

[non_parameter_causes · cause 2] 改写为 no:{$gt:lastValue}.limit(50) 后 indexkey:doc=1:1 性能稳定
  cause_type: application-design
  description_quote: "如果id是唯一或者想办法使用唯一列来排序，此时可以将翻页语句修改如下：\n\ndb.test.find({org:\"10000\",staDate:ISODate(\"2020-07-17T00:00:00.000+08:00\"),\nsignStatus:{$in:[0,1]},no{$gt:N}，}).sort({no:1}).limit(50);"
  linked_diagnostic_step_no: 1
  mitigation_quote: "db.test.find({org:\"10000\", staDate: ISODate(\"2020-07-17T00:00:00.000+08:00\"), signStatus:{$in:[ 0, 1 ] } ,no:{$gt:latest.no}}).sort({no:1}).limit(50)"
```


## case_id: mongo-wt-checkpoint-period-tuning-disk-io-spike-02

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: disk-io-saturation
- **case_pattern**: core-perf-diagnosis
- **title**: WiredTiger checkpoint 周期偏长 → 磁盘 IO 短暂 100% 抖动
- **source_heading**: 优化策略3：存储引擎checkpoint优化
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://mongoing.com/archives/77972
- **source_url_lang**: zh-cn

### symptom_description

> 少部分实例存在如下现象：一会儿磁盘IO几乎空闲0%，一会儿磁盘IO短暂性100%。

### diagnostic_steps

```
[step 1] 监控磁盘 IO 是否周期性 0% ↔ 100% 抖动
  metric_name: disk_io_util
  collection_layer: os
  collection_method_quote: (NULL · 原文未给字面 iostat 命令 · 见 reference/inferred-references.md#mongoing-77972-iostat-cmd)
  abnormal_pattern_quote: "一会儿磁盘IO几乎空闲0%，一会儿磁盘IO短暂性100%"
  abnormal_pattern_threshold: {"disk_util_pct_low": 0, "disk_util_pct_high": 100}
  metric_unit: pct
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] checkpoint 周期默认 60s + journal 2GB 阈值,脏数据积压后集中刷盘
  param_name: wiredTigerEngineRuntimeConfig.checkpoint.wait / log_size
  abnormal_value_pattern: "默认 wait=60s, log_size=2GB"
  reasoning_quote: "该优化总体思路：缩短checkpoint周期，减少checkpoint期间积压的脏数据，缓解磁盘IO高问题。"
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] 优化后 checkpoint=(wait=30,log_size=1GB) 可缓解
  cause_type: application-design
  description_quote: "进行如下优化后可以缓解该问题:\ncheckpoint=(wait=30,log_size=1GB)"
  linked_diagnostic_step_no: 1
  mitigation_quote: "checkpoint=(wait=30,log_size=1GB)"
```


## case_id: mongo-system-sessions-update-storm-primary-shard-degradation-03

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: replica-lag
- **case_pattern**: core-perf-diagnosis
- **title**: mongos 集中更新 system.sessions 拖垮主分片 → 集群瞬间数倍下降
- **source_heading**: 优化策略4：sharding集群system.session优化
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://mongoing.com/archives/77972
- **source_url_lang**: zh-cn

### symptom_description

> 大流量大数据量集群客户端链接众多，大量更新sessions表，最终主分片性能下降引起整个集群性能瞬间数倍下降。

### diagnostic_steps

```
[step 1] 看 mongostat / 慢日志 在 sessions 表更新时的瞬时尖峰
  metric_name: mongostat.qrw_arw_or_slow_log_count
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 原文该 case 节未给字面采集命令(同篇问答 18 给的是另案命令) · 见 reference/inferred-references.md#mongoing-77972-sessions-mongostat-cmd)
  abnormal_pattern_quote: "该优化后system.sessions表更新引起的瞬间性能数倍降低和大量慢日志问题得到了解决。"
  abnormal_pattern_threshold: NULL
  metric_unit: NULL
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] system.sessions 未分片 + 集中时间点更新 → 主分片热点
  cause_type: application-design
  description_quote: "之前代理集中式更新单个分片，优化为散列到不同时间点更新多个分片。"
  linked_diagnostic_step_no: 1
  mitigation_quote: "config库的system.sessions表启用分片功能。\n\n\nmongos定期更新优化为散列到不同时间点进行更新。"
```


## case_id: mongo-slow-log-currentop-long-query-kill-02

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: core-perf-diagnosis
- **title**: 慢日志 grep + currentOp 定位长时执行操作并 kill
- **source_heading**: 【慢日志分析】
- **diagnostic_steps_count**: 3
- **likely_causes_count**: 1
- **source_url**: https://mongoing.com/archives/78150
- **source_url_lang**: zh-cn

### symptom_description

> 慢日志只有当请求执行完毕才会，如果一个表很大，一个查询扫表，则整个执行过程可能需要数小时，可能还没记录慢日志，则可以通过如下命令获取当前执行时间超过5s的所有请求，查询请求，command请求

### diagnostic_steps

```
[step 1] grep mongod.log 找出 COLLSCAN 慢操作
  metric_name: mongod.log.COLLSCAN_count
  collection_layer: log-grep
  collection_method_quote: "tail mongod.log -n 1000000
  abnormal_pattern_quote: "找出文件末尾1000000行中存在扫表的操作，不包含oplog，getMore"
  abnormal_pattern_threshold: NULL
  metric_unit: count
  prerequisite_steps: []

[step 2] grep 找出执行时间 1-10s 慢请求
  metric_name: mongod.log.slow_query_1_10s
  collection_layer: log-grep
  collection_method_quote: "tail mongodb.log -n 1000000
  abnormal_pattern_quote: "找出文件末尾1000000行中执行时间1-10s的请求，不包含oplog，getMore"
  abnormal_pattern_threshold: {"window_ms_low": 1000, "window_ms_high": 10000}
  metric_unit: ms
  prerequisite_steps: []

[step 3] currentOp 取当前 > 5s 操作
  metric_name: currentOp.secs_running
  collection_layer: mongo-shell
  collection_method_quote: "db.currentOp({“secs_running”:{“$gt”:5}})"
  abnormal_pattern_quote: "可以通过如下命令获取当前执行时间超过5s的所有请求"
  abnormal_pattern_threshold: {"secs_running_gt_seconds": 5}
  metric_unit: seconds
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] 大表无索引扫表查询长时间不结束,日志未落
  cause_type: application-design
  description_quote: "如果一个表很大，一个查询扫表，则整个执行过程可能需要数小时，可能还没记录慢日志"
  linked_diagnostic_step_no: 3
  mitigation_quote: "kill查询时间超过5s的所有请求：\ndb.currentOp().inprog.forEach(function(item){if(item.secs_running > 5 )db.killOp(item.opid)})"
```


## case_id: wt-eviction-trigger-app-thread-throttle-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: memory-pressure
- **case_pattern**: core-perf-diagnosis
- **title**: cache 用量持续接近 eviction_trigger (默认 95%) → application threads 被拉去做 eviction
- **source_heading**: Eviction tuning
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 2
- **source_url**: https://source.wiredtiger.com/mongodb-6.0/tune_cache.html
- **source_url_lang**: en

### symptom_description

> The eviction_trigger configuration value (default 95%) is the level at which application threads start to perform eviction. This will throttle application operations, increasing operation latency, usually resulting in the cache usage staying at this level when there is more cache pressure than eviction worker threads can handle in the background.

### diagnostic_steps

```
[step 1] 看 page eviction statistics 评估 cache size 效果
  metric_name: wiredTiger.cache.bytes currently in the cache / wiredTiger.cache.maximum bytes configured
  collection_layer: mongo-internal-counter
  collection_method_quote: "The effectiveness of the chosen cache size can be measured by reviewing the page eviction statistics for the database"
  abnormal_pattern_quote: "the cache usage staying at this level when there is more cache pressure than eviction worker threads can handle in the background"
  abnormal_pattern_threshold: bytes_in_cache / maximum_bytes 持续 ≈ 0.95
  metric_unit: bytes / ratio
  prerequisite_steps: []

[step 2] 看 application threads 是否在做 eviction(latency spike)
  metric_name: wiredTiger.cache.eviction worker thread evicting pages / application thread time evicting
  collection_layer: mongo-internal-counter
  collection_method_quote: "Operations will stall when the cache reaches 100% of the cache size"
  abnormal_pattern_quote: "application threads start to perform eviction"(对应 serverStatus.wiredTiger.cache 中 `Application thread time evicting` 计数 · 该字段名为内部启发式)
  abnormal_pattern_threshold: application thread evicting time per sec 显著 > 0
  metric_unit: microseconds/sec
  prerequisite_steps: [1]
```

### likely_causes

```
[parameter_causes · cause 1] eviction_trigger 默认 95% 与业务负载不匹配 → 余量太小
  param_name: eviction_trigger
  abnormal_value_pattern: 默认 95% · 业务峰值下 worker 来不及消化 → 应调低 trigger 给 worker 更多缓冲
  reasoning_quote: "The eviction_trigger configuration value (default 95%) is the level at which application threads start to perform eviction"
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] cache size 配过小,工作集装不下
  cause_type: application-design
  description_quote: "The size of the cache is the single most important tuning knob for a WiredTiger application. Ideally the cache should be configured to be large enough to hold an application's working set"
  linked_diagnostic_step_no: 1
  mitigation_quote: "Ideally the cache should be configured to be large enough to hold an application's working set"
```


## case_id: mongo-snappy-hotspot-cpu-high-arm64-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: cpu-high
- **case_pattern**: core-perf-diagnosis
- **title**: MongoDB Snappy 压缩热点函数在鲲鹏 ARM64 上 CPU 占用偏高
- **source_heading**: 压缩算法调优
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0030.html
- **source_url_lang**: zh-cn

### symptom_description

> 针对Snappy热点函数CPU占用较高的场景，通过升级Snappy压缩算法版本，可以有效提升服务器性能。

### diagnostic_steps

```
[step 1] 在 mongod 进程上采 perf CPU 火焰图,看 Snappy 函数占比
  metric_name: flamegraph.snappy.cpu_pct
  collection_layer: flamegraph
  collection_method_quote: (NULL · 原文未给采集命令 · 见 reference/inferred-references.md#mongo-snappy-flamegraph-readout)
  abnormal_pattern_quote: "针对Snappy热点函数CPU占用较高的场景，通过升级Snappy压缩算法版本，可以有效提升服务器性能。"
  abnormal_pattern_threshold: `snappy_*函数 CPU 占比 > 10% on flamegraph (qualitative)`
  metric_unit: percent
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] MongoDB 内置 Snappy-1.1.3 在 ARM64 上未优化
  cause_type: application-design
  description_quote: "针对Snappy热点函数CPU占用较高的场景，通过升级Snappy压缩算法版本，可以有效提升服务器性能。"
  linked_diagnostic_step_no: 1
  mitigation_quote: "下载最新版本的Snappy源码。解压下载的Snappy源码，并替换MongoDB源码中的老版本Snappy。"
```


## case_id: app-thread-concurrency-mismatch-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: linux-arm64-kunpeng
- **engine**: mixed
- **symptom_category**: cpu-high
- **case_pattern**: parameter-audit
- **title**: 应用线程并发数过高导致上下文切换/锁竞争开销加大
- **source_heading**: 调整线程并发数
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0013.html
- **source_url_lang**: zh-cn

### symptom_description

> 但是系统的性能并不会随着线程数的增长而线性提升，因为随着线程数量的增加，线程之间的调度、上下文切换、关键资源和锁的竞争也会带来很大开销。当资源的争抢比较严重时，甚至会导致性能明显下降。

### diagnostic_steps

```
[step 1] 读取应用当前并发线程数配置 + 业务 TPS
  metric_name: application thread concurrency setting + business TPS
  collection_layer: mongo-shell
  collection_method_quote: (NULL · 原文未给出"如何采集当前并发数"命令 · 见 reference/inferred-references.md#kunpeng-thread-concurrency-collection)
  abnormal_pattern_quote: "当资源的争抢比较严重时，甚至会导致性能明显下降。"
  abnormal_pattern_threshold: (定性) thread_count > optimal_concurrency_for_workload ∧ TPS 单调下降
  metric_unit: thread count
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] 应用工作线程并发数高于业务最佳值
  param_name: innodb_thread_concurrency (MySQL) / worker_processes (Nginx) / 应用自有并发参数
  abnormal_value_pattern: 高于"针对不同业务模型多组测试找出的最佳并发数"
  reasoning_quote: "MySQL可以通过innodb_thread_concurrency设置工作线程的最大并发数。"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 2] Nginx worker_processes 配置过高
  param_name: worker_processes
  abnormal_value_pattern: 超过 CPU core 数或业务最佳并发值
  reasoning_quote: "Nginx可以通过worker_processes参数设置并发的进程个数。"
  linked_diagnostic_step_no: 1
```


## case_id: app-malloc-jemalloc-multithread-audit-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: linux-arm64-kunpeng
- **engine**: mixed
- **symptom_category**: cpu-high
- **case_pattern**: parameter-audit
- **title**: 多线程内存分配场景未启用 jemalloc，glibc 默认分配器锁竞争激烈
- **source_heading**: 使用jemalloc优化内存分配
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0051.html
- **source_url_lang**: zh-cn

### symptom_description

> 在内存分配过程中，锁会造成线程等待，对性能影响巨大。jemalloc采用如下措施避免线程竞争锁的发生：使用线程变量，每个线程有自己的内存管理器，分配在这个线程内完成，就不需要和其它线程竞争锁。

### diagnostic_steps

```
[step 1] 检查应用当前链接的内存分配库
  metric_name: application linked memory allocator library
  collection_layer: os
  collection_method_quote: (NULL · 原文未给"如何检查当前 allocator"命令 · 见 reference/inferred-references.md#kunpeng-jemalloc-allocator-readout)
  abnormal_pattern_quote: "推荐业务应用代码使用jemalloc进行内存分配。"
  abnormal_pattern_threshold: 当前 allocator ∈ {glibc-malloc, tcmalloc} ∧ 业务为多线程高分配率
  metric_unit: enum
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] 应用未通过编译选项链接 jemalloc
  param_name: linker flags · -ljemalloc + -L`jemalloc-config --libdir`
  abnormal_value_pattern: 链接默认 glibc malloc（编译选项中无 -ljemalloc）
  reasoning_quote: "修改应用软件的链接库的方式，在编译选项中添加如下编译选项"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 2] MySQL 等通过配置文件指定的 allocator 仍为默认值
  param_name: malloc-lib (my.cnf) 或类似配置
  abnormal_value_pattern: malloc-lib 未设置 / 设置为非 jemalloc
  reasoning_quote: "部分开源软件可以修改配置参数来指定内存分配库，如MySQL可以配置my.cnf文件：malloc-lib=/usr/local/lib/libjemalloc.so"
  linked_diagnostic_step_no: 1
```


## case_id: mongo-aggregation-unbounded-pipeline-no-early-match-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: core-perf-diagnosis
- **title**: seller analytics 看板聚合 8.2s: $match 在 $lookup 之后
- **source_heading**: Fix 2: Aggregation Pipeline Refactoring
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mafiree.com/blog/mongodb-query-optimization-ecommerce-case-study
- **source_url_lang**: en

### symptom_description

> The seller analytics dashboard used a complex aggregation pipeline that processed the entire orders collection before filtering. The fix was straightforward but impactful: move $match and $sort stages to the beginning of the pipeline so MongoDB can leverage indexes before processing downstream stages.

### diagnostic_steps

```
[step 1] 跑慢 pipeline 看 working set 规模
  metric_name: aggregation_pipeline_duration
  collection_layer: mongo-shell
  collection_method_quote: "// BEFORE: Unoptimized pipeline (8.2s)\ndb.orders.aggregate([\n  { $lookup: { from: \"products\", ... } },\n  { $unwind: \"$items\" },\n  { $match: { sellerId: ObjectId(\"...\"), status: \"completed\" } },\n  { $group: { _id: \"$items.category\", revenue: { $sum: \"$total\" } } }\n])"
  abnormal_pattern_quote: "Dashboard load time: 8.2s → 1.8s. Working set reduced from 80M to ~45K documents before $lookup runs."
  abnormal_pattern_threshold: {"before_seconds": 8.2, "before_doc_count": 80000000}
  metric_unit: seconds
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] pipeline 顺序错: $match/$sort 应在 $lookup/$unwind 之前
  cause_type: application-design
  description_quote: "Aggregation stages like $lookup and $unwind that run without an early $match stage force MongoDB to process the entire collection before filtering. This turns what should be a 5ms operation into a 5-second one."
  linked_diagnostic_step_no: 1
  mitigation_quote: "// AFTER: Optimized pipeline (1.8s)\ndb.orders.aggregate([\n  { $match: { sellerId: ObjectId(\"...\"), status: \"completed\" } },\n  { $sort: { orderDate: -1 } },\n  { $lookup: { from: \"products\", ... } },\n  { $unwind: \"$items\" },\n  { $group: { _id: \"$items.category\", revenue: { $sum: \"$total\" } } }\n])"
```


## case_id: mongo-schema-too-many-lookups-should-embed-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: core-perf-diagnosis
- **title**: $lookup 用得过多 → 应改为 embed 单集合内
- **source_heading**: Schema Suggestions
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/atlas/performance-advisor/schema-suggestions/
- **source_url_lang**: en

### symptom_description

> You are running too many $lookup operations on your data. Take advantage of MongoDB's rich schema model to embed related data in a single collection.

### diagnostic_steps

```
[step 1] Atlas Advisor / 慢查询 profile 中统计 $lookup 频率
  metric_name: 慢查询中 $lookup pipeline stage 出现频率
  collection_layer: atlas-advisor / mongo-runtime-cmd
  collection_method_quote: "The Performance Advisor monitors slow queries to recognize certain schema issues, namely too many $lookup operations and not utilizing an index for case-sensitive regex queries."
  abnormal_pattern_quote: "You are running too many $lookup operations on your data."
  abnormal_pattern_threshold: (Atlas 内部启发式 · 自管理部署可统计 system.profile 中 $lookup 占比)
  metric_unit: count
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] 数据被过度规范化(模仿关系数据库)
  cause_type: application-design
  description_quote: "Take advantage of MongoDB's rich schema model to embed related data in a single collection."
  linked_diagnostic_step_no: 1
  mitigation_quote: (使用 Extended Reference Pattern / 嵌入 frequently-read 字段)
```


## case_id: mongo-schema-unused-indexes-bloat-03

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: disk-space-pressure
- **case_pattern**: core-perf-diagnosis
- **title**: 集合上有未使用 index → 占盘 + 拖慢写性能
- **source_heading**: Schema Suggestions
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/atlas/performance-advisor/schema-suggestions/
- **source_url_lang**: en

### symptom_description

> You have unnecessary indexes in your collection, which can consume disk space and degrade write performance.

### diagnostic_steps

```
[step 1] 看每索引的访问计数
  metric_name: $indexStats accesses.ops · 每索引使用次数
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (Atlas 文档未给具体命令 · 自管理标准做法 `db.coll.aggregate([{$indexStats:{}}])`)
  abnormal_pattern_quote: "You have unnecessary indexes in your collection, which can consume disk space and degrade write performance."
  abnormal_pattern_threshold: 索引 accesses.ops 长期为 0 / 极低
  metric_unit: count
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] 历史遗留索引 / 测试时建的索引未清
  cause_type: application-design
  description_quote: "You have unnecessary indexes in your collection, which can consume disk space and degrade write performance."
  linked_diagnostic_step_no: 1
  mitigation_quote: (确认无业务依赖后 `db.coll.dropIndex(name)`)
```


## case_id: mongo-schema-document-too-large-04

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: core-perf-diagnosis
- **title**: 文档体积过大 → 频繁查询性能差
- **source_heading**: Schema Suggestions
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/atlas/performance-advisor/schema-suggestions/
- **source_url_lang**: en

### symptom_description

> You have excessively large documents, which can degrade the performance of your most frequent queries.

### diagnostic_steps

```
[step 1] 看集合 avgObjSize 与最大文档大小
  metric_name: collStats.avgObjSize / 文档大小 P99
  collection_layer: mongo-runtime-cmd
  collection_method_quote: "The Performance Advisor analyzes the 20 most active collections based on the output of the top command."
  abnormal_pattern_quote: "You have excessively large documents, which can degrade the performance of your most frequent queries."
  abnormal_pattern_threshold: avgObjSize 显著大(原文未给数字 · 经验值 > 1MB 即应警惕)
  metric_unit: bytes
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] 文档结构未拆分 / 嵌入了大型 array 或子文档
  cause_type: application-design
  description_quote: (NULL · 原文未给 cause 描述,仅给 mitigation pattern · 见 reference/inferred-references.md#schema-doc-too-large-cause-not-explicit-in-source)
  linked_diagnostic_step_no: 1
  mitigation_quote: "Use The Outlier Pattern to handle a few large documents in an otherwise standard collection."
```


## case_id: mongo-query-targeting-high-scan-ratio-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: core-perf-diagnosis
- **title**: Atlas Query Targeting alert: high scanned-to-returned document ratio
- **source_heading**: Query Targeting
- **diagnostic_steps_count**: 3
- **likely_causes_count**: 2
- **source_url**: https://www.mongodb.com/docs/atlas/reference/alert-resolutions/query-targeting/
- **source_url_lang**: en

### symptom_description

> Ideally, the ratio of scanned documents to returned documents should be

### diagnostic_steps

```
[step 1] 查看 Atlas Query Targeting metrics(Scanned/Returned 与 Scanned Objects/Returned)
  metric_name: Atlas Query Targeting: Scanned/Returned & Scanned Objects/Returned
  collection_layer: atlas-advisor
  collection_method_quote: (NULL · 原文为 Atlas UI 操作而非命令 · 见 reference/inferred-references.md#query-targeting-ui-step)
  abnormal_pattern_quote: "uses a 1000:1 threshold"
  abnormal_pattern_threshold: {"scanned_objects_to_returned": ">= 1000:1 (default)", "scanned_index_keys_to_returned": "user-defined"}
  metric_unit: ratio
  prerequisite_steps: []

[step 2] 通过 mongod 慢查询日志确认 planSummary / docsExamined / nreturned
  metric_name: mongod slow query log: planSummary / keysExamined / docsExamined / nreturned
  collection_layer: log-grep
  collection_method_quote: (NULL · 原文给的是日志样例而非采集命令 · 见 reference/inferred-references.md#query-targeting-mongod-log-grep)
  abnormal_pattern_quote: "planSummary: COLLSCAN keysExamined:0docsExamined: 10000 cursorExhausted:1 numYields:234nreturned:4  protocol:op_query 358ms"
  abnormal_pattern_threshold: {"planSummary": "COLLSCAN", "keysExamined": 0, "docsExamined_to_nreturned_ratio_observed": 2500}
  metric_unit: log line tokens
  prerequisite_steps: [1]

[step 3] 用 cursor.explain() 查看具体查询执行计划
  metric_name: explain.executionStats
  collection_layer: mongo-shell
  collection_method_quote: "The cursor.explain()\ncommand for mongosh provides performance details for\nall queries."
  abnormal_pattern_quote: "This query scanned 10,000 documents and returned only 4 for a ratio\nof 2500, which is highly inefficient. No index keys were examined"
  abnormal_pattern_threshold: {"docsExamined": 10000, "nreturned": 4, "ratio": 2500}
  metric_unit: documents / ratio
  prerequisite_steps: [2]
```

### likely_causes

```
[non_parameter_causes · cause 1] 缺少支持查询的索引,导致全表扫描
  cause_type: application-design
  description_quote: "The query targeting alert typically occurs when there is no index to\nsupport a query or queries or when an existing index only partially\nsupports a query or queries."
  linked_diagnostic_step_no: 2
  mitigation_quote: "Add one or more indexes to better serve the inefficient queries."

[non_parameter_causes · cause 2] MongoDB Search (mongot) change-stream cursor 拉高比值
  cause_type: external-service
  description_quote: "The change streams cursors that the MongoDB Search\nprocess (mongot) uses to keep MongoDB Search indexes updated can\ncontribute to the query targeting ratio and trigger\nquery targeting alerts if the ratio\nis high."
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文未给针对 mongot 的修复 · 见 reference/inferred-references.md#query-targeting-mongot-no-mitigation)
```


## case_id: mongo-slow-query-profiler-metric-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: core-perf-diagnosis
- **title**: Atlas Query Profiler: identify and interpret slow queries by multiple metrics
- **source_heading**: Find Slow Queries with the Query Profiler
- **diagnostic_steps_count**: 3
- **likely_causes_count**: 5
- **source_url**: https://www.mongodb.com/docs/atlas/tutorial/query-profiler/
- **source_url_lang**: en

### symptom_description

> monitoring can expose slow-running queries

### diagnostic_steps

```
[step 1] 检查 Operation Execution Time + planSummary
  metric_name: Operation Execution Time (ms) + planSummary
  collection_layer: atlas-advisor
  collection_method_quote: (NULL · 原文是 Atlas UI 操作 · 见 reference/inferred-references.md#query-profiler-ui-step)
  abnormal_pattern_quote: "If you see \"planSummary\": \"COLLSCAN\": in the query log, the query performed a\ncollection scan and did not use an index. This is a strong signal to add an index\nor rewrite the query."
  abnormal_pattern_threshold: {"planSummary": "COLLSCAN", "operation_execution_time_ms": "consistently high"}
  metric_unit: ms / enum
  prerequisite_steps: []

[step 2] 检查 Docs Examined / Keys Examined / Examined:Returned 比
  metric_name: docsExamined / keysExamined / Docs Examined : Returned Ratio
  collection_layer: atlas-advisor
  collection_method_quote: (NULL · 原文是 Atlas UI 字段 · 见 reference/inferred-references.md#query-profiler-ui-step)
  abnormal_pattern_quote: "If this metric is 0 for a query that includes filter conditions, it's highly likely\nthere is no index and MongoDB scanned the entire collection. This is a primary cause of slowness."
  abnormal_pattern_threshold: {"keysExamined_with_filter": 0, "docsExamined_to_docsReturned": ">> 1 (high)"}
  metric_unit: documents / index keys
  prerequisite_steps: [1]

[step 3] 检查 Num Yields / Has Index Coverage / hasSort
  metric_name: numYields / usedIndex / hasSort
  collection_layer: atlas-advisor
  collection_method_quote: (NULL · 原文是 Atlas UI 字段 · 见 reference/inferred-references.md#query-profiler-ui-step)
  abnormal_pattern_quote: "Num Yields (numYields): Frequent yields suggest resource contention\nor long-running operations that are pausing, potentially impacting overall throughput."
  abnormal_pattern_threshold: {"numYields": "frequent", "usedIndex": false, "hasSort_unindexed": true}
  metric_unit: count / boolean
  prerequisite_steps: [1]
```

### likely_causes

```
[parameter_causes · cause 1] slow query threshold 与 Profiler 阈值
  param_name: slowOpThresholdMs (Atlas-managed dynamic / fixed 100ms)
  abnormal_value_pattern: 阈值过高时漏报慢查询;过低时 Profiler 写入开销大
  reasoning_quote: "This threshold can be changed using the\ndb.setProfilingLevel\nmongosh command."
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] 缺索引 / 索引选择性差导致全表扫描
  cause_type: application-design
  description_quote: "If Docs Examined is very high and Keys Examined is 0 or\nvery low compared to Docs Examined, you're likely scanning the collection\nor a very unselective index."
  linked_diagnostic_step_no: 2
  mitigation_quote: "Has Index Coverage (usedIndex): This boolean confirms whether a MongoDB\nindex was used. If set to false for a query that should be indexed, add an index."

[non_parameter_causes · cause 2] 资源争用 / 长时间操作引发 yield
  cause_type: application-design
  description_quote: "Num Yields (numYields): Frequent yields suggest resource contention\nor long-running operations that are pausing, potentially impacting overall throughput."
  linked_diagnostic_step_no: 3
  mitigation_quote: (NULL · 原文未给 yield 类直接修复 · 见 reference/inferred-references.md#query-profiler-yield-no-mitigation)

[non_parameter_causes · cause 3] 未走索引的 sort 极耗资源
  cause_type: application-design
  description_quote: "Unindexed sort() methods can be very resource intensive."
  linked_diagnostic_step_no: 3
  mitigation_quote: "Check your search index configuration and confirm whether it supports the\nsort() method."

[non_parameter_causes · cause 4] 返回过多字段(无 projection)放大网络/序列化开销
  cause_type: application-design
  description_quote: "Response Length: Unusually large response lengths indicate that queries\nare returning more data than necessary. Consider using projections to limit the fields\nreturned."
  linked_diagnostic_step_no: 3
  mitigation_quote: "Consider using projections to limit the fields\nreturned."
```


## case_id: mongo-locking-queue-buildup-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: lock-contention
- **case_pattern**: core-perf-diagnosis
- **title**: 锁等待队列堆积导致请求被阻塞
- **source_heading**: Locking Performance
- **diagnostic_steps_count**: 3
- **likely_causes_count**: 2
- **source_url**: https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/
- **source_url_lang**: en

### symptom_description

> MongoDB uses a locking system to ensure data set consistency. If certain operations are long-running or a queue forms, performance will degrade as requests and operations wait for the lock.

### diagnostic_steps

```
[step 1] 看 globalLock.currentQueue.total 是否持续高位
  metric_name: globalLock.currentQueue.total
  collection_layer: mongo-runtime-cmd
  collection_method_quote: "globalLock section of the"
  abnormal_pattern_quote: "If globalLock.currentQueue.total is consistently high, then there is a chance that a large number of requests are waiting for a lock."
  abnormal_pattern_threshold: currentQueue.total 持续 > 0(即业务 RPS 远低于 globalLock 排队增量)
  metric_unit: count
  prerequisite_steps: []

[step 2] 看 globalLock.totalTime 与 uptime 比
  metric_name: globalLock.totalTime / uptime
  collection_layer: mongo-runtime-cmd
  collection_method_quote: "globalLock section of the"
  abnormal_pattern_quote: "If globalLock.totalTime is high relative to uptime, the database has existed in a lock state for a significant amount of time."
  abnormal_pattern_threshold: totalTime / uptime ≫ 等同业务持续在 lock 状态
  metric_unit: microseconds / seconds
  prerequisite_steps: [1]

[step 3] 看 deadlock 与等锁均值
  metric_name: locks.<type>.deadlockCount + locks.<type>.timeAcquiringMicros / acquireWaitCount
  collection_layer: mongo-runtime-cmd
  collection_method_quote: "Dividing locks.<type>.timeAcquiringMicros by locks.<type>.acquireWaitCount can give an approximate average wait time for a particular lock mode."
  abnormal_pattern_quote: "locks.<type>.deadlockCount provide the number of times the lock acquisitions encountered deadlocks."
  abnormal_pattern_threshold: 平均等锁时间(微秒)偏离基线 ≫ 1× 或 deadlockCount > 0
  metric_unit: microseconds + count
  prerequisite_steps: [1]
```

### likely_causes

```
[non_parameter_causes · cause 1] 索引/schema 不当导致长事务持锁
  cause_type: application-design
  description_quote: "Long queries can result from ineffective use of indexes; non-optimal schema design; poor query structure; system architecture issues; or insufficient RAM resulting in disk reads."
  linked_diagnostic_step_no: 3
  mitigation_quote: (NULL · 原文未给具体修复命令 · 见 reference/inferred-references.md#mongo-locking-mitigation-not-explicit)

[non_parameter_causes · cause 2] 内存不足触发磁盘读 → 锁持有时间拉长
  cause_type: hardware-memory-physical
  description_quote: "insufficient RAM resulting in disk reads"
  linked_diagnostic_step_no: 2
  mitigation_quote: (NULL · 原文未给具体修复 · 同上 ref)
```


## case_id: mongo-connection-storm-driver-error-02

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: connection-storm
- **case_pattern**: core-perf-diagnosis
- **title**: 连接数飙升 → 服务器吃不下请求
- **source_heading**: Number of Connections
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 3
- **source_url**: https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/
- **source_url_lang**: en

### symptom_description

> In some cases, the number of connections between the applications and the database can overwhelm the ability of the server to handle requests.

### diagnostic_steps

```
[step 1] 看 connections.current 与 connections.available
  metric_name: connections.current / connections.available
  collection_layer: mongo-runtime-cmd
  collection_method_quote: "The following fields in the serverStatus document can provide insight"
  abnormal_pattern_quote: "If there are numerous concurrent application requests, the database may have trouble keeping up with demand."
  abnormal_pattern_threshold: connections.current 接近 maxIncomingConnections;available → 0
  metric_unit: count
  prerequisite_steps: []

[step 2] 比对 connections.current 与实际 workload
  metric_name: connections.current vs workload (opcounters)
  collection_layer: mongo-runtime-cmd
  collection_method_quote: "the total number of current clients connected to the database instance."
  abnormal_pattern_quote: "An extremely high number of connections, particularly without corresponding workload, is often indicative of a driver or other configuration error."
  abnormal_pattern_threshold: connections.current 高 但 opcounters 平稳 → 驱动 / 配置异常
  metric_unit: count
  prerequisite_steps: [1]
```

### likely_causes

```
[parameter_causes · cause 1] maxIncomingConnections 偏小或 ulimit 卡住
  param_name: maxIncomingConnections / ulimit -n
  abnormal_value_pattern: maxIncomingConnections < 业务峰值;ulimit -n < maxIncomingConnections
  reasoning_quote: "Unless constrained by system-wide limits, the maximum number of incoming connections supported by MongoDB is configured with the maxIncomingConnections setting."
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] 应用未用 connection pooling 或 driver 异常重连
  cause_type: application-design
  description_quote: "Spikes in the number of connections can also be the result of application or driver errors. All of the officially supported MongoDB drivers implement connection pooling, which allows clients to use and reuse connections more efficiently."
  linked_diagnostic_step_no: 2
  mitigation_quote: (NULL · 原文未给逐字修复命令 · driver-side fix · 见 reference/inferred-references.md#mongo-driver-pooling-mitigation-not-explicit)

[non_parameter_causes · cause 2] 写密集型应用未做 sharding
  cause_type: application-design
  description_quote: "For write-heavy applications, deploy sharding and add one or more shards to a sharded cluster to distribute load among mongod instances."
  linked_diagnostic_step_no: 1
  mitigation_quote: "deploy sharding and add one or more shards to a sharded cluster to distribute load among mongod instances"
```


## case_id: mongo-wt-tickets-exhausted-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: lock-contention
- **case_pattern**: core-perf-diagnosis
- **title**: WiredTiger 读写 ticket 持续 < 128 → 并发被限流
- **source_heading**: Run Your Queries at Top Speed → WiredTiger Ticket Number metric
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 3
- **source_url**: https://www.mongodb.com/docs/manual/administration/performance-tuning/
- **source_url_lang**: en

### symptom_description

> The read and write tickets control the maximum number of concurrent transactions. The WiredTiger ticket number should always be at 128. Sustained values below 128 indicates a server delay and consequential potential issues.

### diagnostic_steps

```
[step 1] 用 serverStatus 看读写 ticket 当前数
  metric_name: wiredTiger.concurrentTransactions.{read,write}.{available,out,totalTickets}
  collection_layer: mongo-runtime-cmd
  collection_method_quote: "You can use the serverStatus command to check the current number of read and write tickets and their usage"
  abnormal_pattern_quote: "Sustained values below 128 indicates a server delay and consequential potential issues"
  abnormal_pattern_threshold: available 持续 < 128(7.0+ 动态阈值;6.x 默认 128)
  metric_unit: count
  prerequisite_steps: []

[step 2] 看 queues.execution 段判负载与 ticket 可用性
  metric_name: queues.execution.read / queues.execution.write
  collection_layer: mongo-internal-counter
  collection_method_quote: "Look at the queues.execution section to understand the current load and ticket availability"
  abnormal_pattern_quote: "any new read or write requests will be queued until a new read or write ticket is available"
  abnormal_pattern_threshold: queues.execution.read 或 .write > 0 持续
  metric_unit: count
  prerequisite_steps: [1]
```

### likely_causes

```
[parameter_causes · cause 1] Dynamic Adjustment 未启用 / storageEngineConcurrent* 手调过紧
  param_name: storageEngineConcurrentReadTransactions / storageEngineConcurrentWriteTransactions
  abnormal_value_pattern: 7.0+ 已禁用动态调整 或 手动设到 < 业务并发需求
  reasoning_quote: "If you need to manually adjust the maximum number of concurrent transactions, you can modify the storageEngineConcurrentReadTransactions and storageEngineConcurrentWriteTransactions parameters"
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] 集群 CPU/内存资源吃紧 → ticket 被持有时间拉长
  cause_type: hardware-cpu-physical
  description_quote: "Ensure that your cluster has sufficient resources, such as CPU and memory, to handle the workload"
  linked_diagnostic_step_no: 1
  mitigation_quote: "Ensure that your cluster has sufficient resources, such as CPU and memory, to handle the workload"

[non_parameter_causes · cause 2] 索引 / schema 不当导致单事务持锁过久
  cause_type: application-design
  description_quote: "Locking performance problems can indicate suboptimal indexes and poor schema design patterns, which can both lead to locks being held longer than necessary"
  linked_diagnostic_step_no: 2
  mitigation_quote: (NULL · 原文未给单条 fix 命令 · 见 reference/inferred-references.md#mongo-suboptimal-index-mitigation-not-explicit)
```


## case_id: mongo-replication-lag-multi-cause-02

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: replica-lag
- **case_pattern**: core-perf-diagnosis
- **title**: 复制集 secondary 落后 primary(4 类互斥根因)
- **source_heading**: Replication Lag
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 4
- **source_url**: https://www.mongodb.com/docs/manual/administration/performance-tuning/
- **source_url_lang**: en

### symptom_description

> Replication lag occurs when a secondary member of a replica set falls behind the primary.

### diagnostic_steps

```
[step 1] 看 oplog-related metrics 与 replSetGetStatus
  metric_name: replSetGetStatus.members[].optimeDate / oplog window
  collection_layer: mongo-runtime-cmd
  collection_method_quote: "you can examine the oplog-related metrics"
  abnormal_pattern_quote: "the following problems are the most common causes of replication lag"
  abnormal_pattern_threshold: secondary optimeDate 落后 primary > SLA(原文未给具体阈值)
  metric_unit: seconds
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] primary↔secondary 网络问题导致节点不可达
  cause_type: network-physical-link
  description_quote: "A networking issue between the primary and secondary"
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文未给修复命令 · 见 reference/inferred-references.md#mongo-replication-lag-mitigation-not-explicit)

[non_parameter_causes · cause 2] secondary 应用 oplog 速度比 primary 慢
  cause_type: application-design
  description_quote: "A secondary node applying data slower than the primary node"
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 同上 ref)

[non_parameter_causes · cause 3] 写入容量不足
  cause_type: application-design
  description_quote: "Insufficient write capacity, in which case you should add more shards"
  linked_diagnostic_step_no: 1
  mitigation_quote: "you should add more shards"

[non_parameter_causes · cause 4] primary 节点上有慢操作阻塞复制
  cause_type: application-design
  description_quote: "Slow operations on the primary node, blocking replication"
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 同 cause 1 ref)
```


## case_id: mongo-open-cursor-rising-no-traffic-03

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: other
- **case_pattern**: core-perf-diagnosis
- **title**: open cursor 持续上升但流量未变
- **source_heading**: Open Cursors
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/administration/performance-tuning/
- **source_url_lang**: en

### symptom_description

> If the number of open cursors is rising without a corresponding growth of traffic, this might be the result of poorly indexed queries, or long-running queries due to large result sets.

### diagnostic_steps

```
[step 1] 跟踪 metrics.cursor.open.total 趋势,与 opcounters 对比
  metric_name: metrics.cursor.open.total / opcounters.{query,getmore}
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 原文未直接给采集命令 · 见 reference/inferred-references.md#mongo-cursor-metric-collection-method-not-explicit)
  abnormal_pattern_quote: "the number of open cursors is rising without a corresponding growth of traffic"
  abnormal_pattern_threshold: metrics.cursor.open.total 增速 ≫ opcounters 增速
  metric_unit: count
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] 查询缺索引导致单 cursor 长时间不归还
  cause_type: application-design
  description_quote: "this might be the result of poorly indexed queries, or long-running queries due to large result sets"
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文未给单条 fix · 见 reference/inferred-references.md#mongo-suboptimal-index-mitigation-not-explicit)
```


## case_id: mongo-scan-and-order-high-04

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: memory-pressure
- **case_pattern**: core-perf-diagnosis
- **title**: Scan and Order 数高 → 服务端排序内存压力
- **source_heading**: Query Metrics
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/administration/performance-tuning/
- **source_url_lang**: en

### symptom_description

> A high Scan and Order number, such as 20 or more, indicates that the server is having to sort results, increasing query result time and server memory load.

### diagnostic_steps

```
[step 1] 读 metrics.operation.scanAndOrder
  metric_name: metrics.operation.scanAndOrder
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 原文未给逐字采集命令 · 见 reference/inferred-references.md#mongo-scanandorder-collection-not-explicit)
  abnormal_pattern_quote: "A high Scan and Order number, such as 20 or more"
  abnormal_pattern_threshold: scanAndOrder 计数(累计或每秒) >= 20
  metric_unit: count
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] 索引顺序与查询 sort 不匹配 / 索引缺失
  cause_type: application-design
  description_quote: "indicates that the server is having to sort results, increasing query result time and server memory load"
  linked_diagnostic_step_no: 1
  mitigation_quote: "To fix a high Scan and Order number, sort your indexes according to query requirements, or add any missing indexes"
```


## case_id: mongo-unbound-array-rewrite-pressure-05

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: core-perf-diagnosis
- **title**: 文档中 array 无上限增长 → 每次更新触发整文档重写
- **source_heading**: Document Structure Antipatterns
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/administration/performance-tuning/
- **source_url_lang**: en

### symptom_description

> Unbound arrays: Arrays in a document that can grow without a size limit cause performance problems, because each time you update the array, MongoDB must rewrite the array into the document.

### diagnostic_steps

```
[step 1] 看慢查询日志中重复出现的 array-update 操作
  metric_name: system.profile / slow query log + collStats.avgObjSize 趋势
  collection_layer: log-grep
  collection_method_quote: "The query plan does not contain any metrics to reveal document structure antipatterns, but you can look for antipatterns when debugging slow queries."
  abnormal_pattern_quote: "each time you update the array, MongoDB must rewrite the array into the document"
  abnormal_pattern_threshold: collStats.avgObjSize 单调增长 + 同一 array $push 慢查询反复出现
  metric_unit: bytes / ms
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] 应用层 schema 设计未对 array 设大小上限
  cause_type: application-design
  description_quote: "Arrays in a document that can grow without a size limit cause performance problems"
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文给的是反模式说明 + "see Avoid Unbounded Arrays" 跨文档跳转 · 见 reference/inferred-references.md#mongo-unbound-array-mitigation-not-explicit)
```


## case_id: mongo-driver-pool-size-too-small-vs-concurrent-requests-02

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: connection-storm
- **case_pattern**: parameter-audit
- **title**: driver 连接池大小 < 1.10×并发请求数 → 池排队
- **source_heading**: Drivers
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-checklist-development/
- **source_url_lang**: en

### symptom_description

> Adjust the connection pool size to suit your use case, beginning at 110-115% of the typical number of concurrent database requests.

### diagnostic_steps

```
[step 1] 比对 driver maxPoolSize 与应用层典型并发请求数
  metric_name: driver maxPoolSize · 应用层典型并发请求数
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 原文未给读取命令 · 见 reference/_pending/agent2.md#mongo-pool-maxpoolsize-readout-from-driver-knowledge)
  abnormal_pattern_quote: "beginning at 110-115% of the typical number of concurrent database requests"
  abnormal_pattern_threshold: maxPoolSize < 1.10 × 应用层典型并发请求数
  metric_unit: connections
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] driver maxPoolSize 未按"110-115% × 并发请求数"设置
  param_name: maxPoolSize
  abnormal_value_pattern: < 1.10 × 应用层典型并发请求数
  reasoning_quote: "Adjust the connection pool size to suit your use case, beginning at 110-115% of the typical number of concurrent database requests."
  linked_diagnostic_step_no: 1
```


## case_id: mongo-fs-nfs-dbpath-degraded-unstable-perf-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: disk-io-saturation
- **case_pattern**: parameter-audit
- **title**: dbPath 用 NFS 卷 → 性能下降且不稳定
- **source_heading**: Filesystem
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-checklist-operations/
- **source_url_lang**: en

### symptom_description

> Using NFS drives can result in degraded and unstable performance.

### diagnostic_steps

```
[step 1] 检查 dbPath 所在挂载点的文件系统类型是否为 NFS
  metric_name: dbPath 挂载点文件系统类型
  collection_layer: os
  collection_method_quote: (NULL · 原文未给读取命令 · 见 reference/_pending/agent2.md#mongo-fs-mount-readout-from-shell-knowledge)
  abnormal_pattern_quote: "Using NFS drives can result in degraded and unstable performance."
  abnormal_pattern_threshold: 文件系统类型 ∈ {nfs, nfs4}
  metric_unit: (枚举)
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] dbPath 部署到 NFS,fsync/锁语义不一致
  param_name: (deployment) dbPath 挂载点文件系统
  abnormal_value_pattern: NFS / NFSv4
  reasoning_quote: "Using NFS drives can result in degraded and unstable performance."
  linked_diagnostic_step_no: 1
```


## case_id: mongo-fs-ext4-wiredtiger-perf-issue-should-use-xfs-02

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: disk-io-saturation
- **case_pattern**: parameter-audit
- **title**: WiredTiger + EXT4 → 已知性能问题 · 应改 XFS
- **source_heading**: Filesystem
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-checklist-operations/
- **source_url_lang**: en

### symptom_description

> to avoid performance issues found when using EXT4 with WiredTiger

### diagnostic_steps

```
[step 1] 检查 dbPath 文件系统类型
  metric_name: dbPath 挂载点文件系统类型
  collection_layer: os
  collection_method_quote: (NULL · 原文未给读取命令 · 见 reference/_pending/agent2.md#mongo-fs-mount-readout-from-shell-knowledge)
  abnormal_pattern_quote: "to avoid performance issues found when using EXT4 with WiredTiger"
  abnormal_pattern_threshold: 文件系统 = ext4 且 storage engine = wiredTiger
  metric_unit: (枚举)
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] dbPath 文件系统是 EXT4 与 WiredTiger 不匹配
  param_name: (deployment) dbPath 挂载点文件系统
  abnormal_value_pattern: ext4(配 storage.engine=wiredTiger)
  reasoning_quote: "If possible, use XFS as it generally performs better with MongoDB."
  linked_diagnostic_step_no: 1
```


## case_id: mongo-tuned-profile-default-rhel-perf-impact-05

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: linux-os
- **symptom_category**: other
- **case_pattern**: parameter-audit
- **title**: RHEL/CentOS tuned profile 用默认值 → 对 MongoDB 性能负向影响
- **source_heading**: Linux
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-checklist-operations/
- **source_url_lang**: en

### symptom_description

> RHEL / CentOS can negatively impact performance with their default

### diagnostic_steps

```
[step 1] 读当前 active tuned profile
  metric_name: tuned-adm active 当前 profile 名
  collection_layer: os
  collection_method_quote: (NULL · 原文未给读取命令 · 见 reference/_pending/agent2.md#linux-tuned-profile-readout-from-linux-doc)
  abnormal_pattern_quote: "RHEL / CentOS can negatively impact performance with their default"
  abnormal_pattern_threshold: active profile ∈ 出厂默认 {throughput-performance, balanced, virtual-guest, ...} 且未做 MongoDB 适配
  metric_unit: (枚举)
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] active tuned profile 是出厂默认未定制
  param_name: tuned profile
  abnormal_value_pattern: 出厂默认未做 MongoDB 适配(THP / readahead / scheduler 等)
  reasoning_quote: "RHEL / CentOS can negatively impact performance with their default"
  linked_diagnostic_step_no: 1
```


## case_id: mongo-startup-kernel-6-19-tcmalloc-incompat-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: startup-failure
- **case_pattern**: fault-management
- **title**: MongoDB 8.0+ 在 Linux Kernel 6.19 上启动 crash
- **source_heading**: MongoDB 8.0 Incompatible with Kernel 6.19
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_url_lang**: en

### symptom_description

> Due to an incompatibility between a new kernel release and the currently vendored version of TCMalloc, running MongoDB 8.0 or newer with Linux kernel version 6.19 can cause MongoDB to crash on startup. This applies to all MongoDB packages, including those obtained from the MongoDB website, or obtained from package managers or Docker.

### diagnostic_steps

```
[step 1] 同时看 mongod 版本 + kernel 版本
  metric_name: mongod --version + uname -r
  collection_layer: os
  collection_method_quote: (原文未给具体命令 · 通用 `mongod --version` + `uname -r`)
  abnormal_pattern_quote: "running MongoDB 8.0 or newer with Linux kernel version 6.19 can cause MongoDB to crash on startup"
  abnormal_pattern_threshold: mongod major >= 8 AND kernel == 6.19.x
  metric_unit: version
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] TCMalloc 版本与 6.19 内核的 ABI 冲突
  cause_type: os-version-bug
  description_quote: "Due to an incompatibility between a new kernel release and the currently vendored version of TCMalloc"
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文给的是未来通告而非可执行 mitigation · 见 reference/inferred-references.md#kernel-6-19-mitigation-no-actionable-fix-in-source)
```


## case_id: mongo-network-tcp-keepalive-too-long-cloud-lb-drops-02

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: linux-os
- **symptom_category**: network-latency
- **case_pattern**: parameter-audit
- **title**: tcp_keepalive_time 大于云 LB 空闲超时 → 连接被静默切断
- **source_heading**: Adjust tcp_keepalive_time
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_url_lang**: en

### symptom_description

> If the TCP keepalive value is greater than the TCP idle timeout on your cloud provider's load balancer, there is a risk that the system might silently drop connections.

### diagnostic_steps

```
[step 1] 看当前 tcp_keepalive_time
  metric_name: net.ipv4.tcp_keepalive_time
  collection_layer: os
  collection_method_quote: "sysctl net.ipv4.tcp_keepalive_time"
  abnormal_pattern_quote: "If the TCP keepalive value is greater than the TCP idle timeout on your cloud provider's load balancer"
  abnormal_pattern_threshold: 当前值 > 云 LB 空闲超时(常见 60-120 秒)
  metric_unit: seconds
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] tcp_keepalive_time 默认值偏大
  param_name: net.ipv4.tcp_keepalive_time
  abnormal_value_pattern: 默认 7200(2 小时),远大于云 LB 空闲超时
  reasoning_quote: "To reduce this risk, set tcp_keepalive_time to 120."
  linked_diagnostic_step_no: 1
```


## case_id: mongo-numa-cross-node-memory-degradation-04

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: cpu-high
- **case_pattern**: core-perf-diagnosis
- **title**: MongoDB 在 NUMA 硬件上跨节点访问导致间歇性慢
- **source_heading**: MongoDB and NUMA Hardware
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 2
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_url_lang**: en

### symptom_description

> Running MongoDB on a system with Non-Uniform Memory Access (NUMA) can cause a number of operational problems, including slow performance for periods of time and high system process usage.

### diagnostic_steps

```
[step 1] 看 mongod 启动日志中是否有 NUMA warning
  metric_name: mongod startup log · NUMA warning 行
  collection_layer: log-grep
  collection_method_quote: "MongoDB checks NUMA settings on start up when deployed on Linux (since version 2.0) and Windows (since version 2.6) machines. If the NUMA configuration may degrade performance, MongoDB prints a warning."
  abnormal_pattern_quote: "If the NUMA configuration may degrade performance, MongoDB prints a warning."
  abnormal_pattern_threshold: mongod 启动日志含 "NUMA" warning
  metric_unit: bool
  prerequisite_steps: []

[step 2] 看 numad daemon 是否在跑
  metric_name: numad 进程
  collection_layer: os
  collection_method_quote: (通用 `pgrep -f numad`)
  abnormal_pattern_quote: "The numad daemon process can also reduce mongod performance. You should ensure numad is not enabled on MongoDB servers."
  abnormal_pattern_threshold: numad 进程在跑
  metric_unit: bool
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] 未配 memory interleave policy
  param_name: numactl --interleave=all (启动 mongod 时)
  abnormal_value_pattern: 直接 `mongod` 启动 · 未走 numactl interleave
  reasoning_quote: "you should configure a memory interleave policy so that the host behaves in a non-NUMA fashion"
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] numad daemon 在跑
  cause_type: application-design
  description_quote: "The numad daemon process can also reduce mongod performance."
  linked_diagnostic_step_no: 2
  mitigation_quote: "You should ensure numad is not enabled on MongoDB servers."
```


## case_id: mongo-os-vm-swappiness-default-60-aggressive-swap-05

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: linux-os
- **symptom_category**: memory-pressure
- **case_pattern**: parameter-audit
- **title**: vm.swappiness 默认 60 → MongoDB 频繁 swap 性能下降
- **source_heading**: Set vm.swappiness to 1 or 0
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_url_lang**: en

### symptom_description

> "Swappiness" is a Linux kernel setting that influences the behavior of the Virtual Memory manager. The vm.swappiness setting ranges from 0 to 100: the higher the value, the more strongly it prefers swapping memory pages to disk over dropping pages from RAM.

### diagnostic_steps

```
[step 1] 看当前 vm.swappiness
  metric_name: vm.swappiness
  collection_layer: os
  collection_method_quote: (通用 `cat /proc/sys/vm/swappiness` 或 `sysctl vm.swappiness`)
  abnormal_pattern_quote: "A setting of 60 tells the kernel to swap to disk often, and is the default value on many Linux distributions."
  abnormal_pattern_threshold: 当前值 > 1
  metric_unit: int
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] vm.swappiness 未调
  param_name: vm.swappiness
  abnormal_value_pattern: 默认 60
  reasoning_quote: "MongoDB performs best where swapping can be avoided or kept to a minimum. As such you should set vm.swappiness to eithe"(原文截断,完整意为应设 0 或 1)
  linked_diagnostic_step_no: 1
```


## case_id: mongo-aws-ec2-storage-network-tuning-06

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: disk-io-saturation
- **case_pattern**: core-perf-diagnosis
- **title**: AWS EC2 上 MongoDB 性能不可重现 / 不达上限
- **source_heading**: AWS EC2
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 3
- **source_url**: https://www.mongodb.com/docs/manual/administration/production-notes/
- **source_url_lang**: en

### symptom_description

> There are two performance configurations to consider: Reproducible performance for performance testing or benchmarking, and Raw maximum performance

### diagnostic_steps

```
[step 1] 看 EC2 实例类型 + 网络与存储配置
  metric_name: EC2 instance type / Enhanced Networking 状态 / EBS provisioned IOPS
  collection_layer: os
  collection_method_quote: (原文未给读取命令 · AWS 侧通用 `aws ec2 describe-instances` 或 `cat /sys/class/net/<eth>/queues/`)
  abnormal_pattern_quote: "Not all instance types support Enhanced Networking."
  abnormal_pattern_threshold: Enhanced Networking 未启用 / 用 ephemeral SSD 而非 provisioned IOPS
  metric_unit: bool / IOPS
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] tcp_keepalive_time 未设 120
  param_name: net.ipv4.tcp_keepalive_time
  abnormal_value_pattern: 默认 7200,EC2 ELB/NLB 切连接
  reasoning_quote: "Set tcp_keepalive_time to 120."
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] 实例未启用 Enhanced Networking
  cause_type: hardware-network
  description_quote: (NULL · 原文是 mitigation 句而非 cause 描述 · 见 reference/inferred-references.md#aws-ec2-enhanced-networking-cause-not-explicit)
  linked_diagnostic_step_no: 1
  mitigation_quote: (升级到支持 Enhanced Networking 的实例类型)

[non_parameter_causes · cause 2] 用 ephemeral SSD 替代 provisioned IOPS
  cause_type: hardware-disk
  description_quote: (NULL · 原文是 mitigation 句而非 cause 描述 · 见 reference/inferred-references.md#aws-ec2-ephemeral-ssd-cause-not-explicit)
  linked_diagnostic_step_no: 1
  mitigation_quote: (改用 provisioned IOPS EBS · journal/data 分独立卷)
```


## case_id: mongo-tcmalloc-percpu-caches-not-enabled-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: linux-arm64-kunpeng
- **engine**: mixed
- **symptom_category**: memory-pressure
- **case_pattern**: core-perf-diagnosis
- **title**: MongoDB 8.0 TCMalloc per-CPU caches 未启用 → 高负载下内存碎片与性能退化
- **source_heading**: TCMalloc Performance Optimization for a Self-Managed Deployment
- **diagnostic_steps_count**: 3
- **likely_causes_count**: 3
- **source_url**: https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/
- **source_url_lang**: en

### symptom_description

> per-CPU caches, instead of per-thread caches, to reduce memory fragmentation and make your database more resilient to high-stress workloads.

### diagnostic_steps

```
[step 1] 读 serverStatus 中 tcmalloc 字段判断 per-CPU caches 是否生效
  metric_name: tcmalloc.usingPerCPUCaches / tcmalloc.tcmalloc.cpu_free
  collection_layer: mongo-runtime-cmd
  collection_method_quote: "To verify that TCMalloc is running with per-CPU caches, ensure that"
  abnormal_pattern_quote: "tcmalloc.usingPerCPUCaches is true"
  abnormal_pattern_threshold: usingPerCPUCaches != true 或 cpu_free <= 0
  metric_unit: bool / count
  prerequisite_steps: []

[step 2] 检查 glibc 是否抢先注册了 rseq
  metric_name: glibc.pthread.rseq tunable / GLIBC_TUNABLES env
  collection_layer: os
  collection_method_quote: (NULL · 原文给的是 mitigation env 设置,未给只读检查命令 · 见 reference/inferred-references.md#tcmalloc-glibc-rseq-readonly-check-not-explicit)
  abnormal_pattern_quote: "If another application, such as the glibc library, registers an rseq structure before TCMalloc, TCMalloc can't use rseq"
  abnormal_pattern_threshold: glibc rseq 已注册而 TCMalloc 启动时拿不到
  metric_unit: flag
  prerequisite_steps: [1]

[step 3] 检查内核版本是否 >= 4.18
  metric_name: kernel version
  collection_layer: os
  collection_method_quote: "uname -r"
  abnormal_pattern_quote: "If you disabled glibc rseq and per-CPU caches are still not enabled, ensure that you're using Linux kernel version 4.18 or later"
  abnormal_pattern_threshold: uname -r 主版本 < 4.18
  metric_unit: version
  prerequisite_steps: [1, 2]
```

### likely_causes

```
[parameter_causes · cause 1] GLIBC_TUNABLES 未禁用 glibc.pthread.rseq
  param_name: GLIBC_TUNABLES (env)
  abnormal_value_pattern: 未设 glibc.pthread.rseq=0 → glibc 抢先注册 rseq
  reasoning_quote: "To ensure that TCMalloc can use rseq to enable per-CPU caches, you can disable glibc"
  linked_diagnostic_step_no: 2

[non_parameter_causes · cause 1] 内核版本 < 4.18 → rseq 不可用
  cause_type: os-version-bug
  description_quote: "You're using Linux kernel version 4.18 or later"
  linked_diagnostic_step_no: 3
  mitigation_quote: (NULL · 原文未给具体升级命令 · 见 reference/inferred-references.md#tcmalloc-kernel-upgrade-not-explicit)

[non_parameter_causes · cause 2] 操作系统在 legacy TCMalloc 名单上(RHEL/Oracle PPC64LE/s390x · Windows)
  cause_type: os-version-bug
  description_quote: "These operating systems use the legacy TCMalloc version. If you use these operating systems, disable THP."
  linked_diagnostic_step_no: 1
  mitigation_quote: "If you use these operating systems, disable THP."
```


## case_id: mongo-inmemory-cache-full-overflow-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: memory-pressure
- **case_pattern**: fault-management
- **title**: In-memory storage engine 数据超出 inMemorySizeGB → WT_CACHE_FULL
- **source_heading**: Memory Use
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/core/inmemory/
- **source_url_lang**: en

### symptom_description

> If a write operation would cause the data to exceed the specified memory size, MongoDB returns with the error

### diagnostic_steps

```
[step 1] 看 mongod 日志中是否含 WT_CACHE_FULL 错误
  metric_name: mongod log "WT_CACHE_FULL" 出现频次
  collection_layer: log-grep
  collection_method_quote: (NULL · 原文未给具体 grep 命令 · 见 reference/inferred-references.md#mongo-wtcachefull-grep-not-explicit)
  abnormal_pattern_quote: "WT_CACHE_FULL: operation would overflow cache"
  abnormal_pattern_threshold: 任意一次出现该错误即异常
  metric_unit: count
  prerequisite_steps: []

[step 2] 比对当前 in-memory 用量与 inMemorySizeGB 配置
  metric_name: dbStats / collStats 总 size vs inMemorySizeGB
  collection_layer: mongo-runtime-cmd
  collection_method_quote: "To specify a new size, use the"
  abnormal_pattern_quote: "If a write operation would cause the data to exceed the specified memory size"
  abnormal_pattern_threshold: sum(dbStats.dataSize) + indexes + oplog 接近 inMemorySizeGB
  metric_unit: bytes
  prerequisite_steps: [1]
```

### likely_causes

```
[parameter_causes · cause 1] inMemorySizeGB 配置过小(默认 50% RAM-1GB,业务数据已经增长超出)
  param_name: storage.inMemory.engineConfig.inMemorySizeGB / --inMemorySizeGB
  abnormal_value_pattern: inMemorySizeGB < 当前业务总数据(含索引 + oplog)
  reasoning_quote: "By default, the in-memory storage engine uses 50% of physical RAM minus 1 GB"
  linked_diagnostic_step_no: 2
```


## case_id: mongo-psa-majority-writeconcern-perf-degradation-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: replica-lag
- **case_pattern**: core-perf-diagnosis
- **title**: PSA 架构 + majority write concern · secondary 不可用/落后导致写性能下降与读 stale
- **source_heading**: Performance Issues with PSA replica sets
- **diagnostic_steps_count**: 3
- **likely_causes_count**: 3
- **source_url**: https://www.mongodb.com/docs/manual/core/replica-set-arbiter/
- **source_url_lang**: en

### symptom_description

> performance issues if a secondary is unavailable or lagging

### diagnostic_steps

```
[step 1] 检查副本集拓扑是否为 PSA 三成员架构
  metric_name: replSetGetStatus.members[] 的 stateStr 分布(PRIMARY/SECONDARY/ARBITER)
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 原文未给读取拓扑命令 · 见 reference/_pending/agent2.md#mongo-replset-status-readout-from-mongo-doc)
  abnormal_pattern_quote: "three-member primary-secondary-arbiter (PSA) architecture"
  abnormal_pattern_threshold: 拓扑 = 1 PRIMARY + 1 SECONDARY + 1 ARBITER(只有 1 个 data-bearing secondary)
  metric_unit: (枚举)
  prerequisite_steps: []

[step 2] 检查 secondary 是否健康及 lag 情况
  metric_name: secondary 的 health/state · optimeDate 与 primary 的差距
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 原文未给具体命令 · 见 reference/_pending/agent2.md#mongo-replset-secondary-health-readout-from-mongo-doc)
  abnormal_pattern_quote: "if a secondary is unavailable or lagging"
  abnormal_pattern_threshold: secondary state ≠ SECONDARY · 或 lag (primary.optimeDate − secondary.optimeDate) 显著 > 0
  metric_unit: seconds
  prerequisite_steps: [1]

[step 3] 读取当前 default write concern / 关注业务侧使用的 write concern
  metric_name: getDefaultRWConcern → defaultWriteConcern.w
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 原文未给具体命令 · 见 reference/_pending/agent2.md#mongo-default-rwconcern-readout-from-mongo-doc)
  abnormal_pattern_quote: "and the write concern is less than the size of the majority, your queries may return stale (not fully replicated) data."
  abnormal_pattern_threshold: default write concern w < majority(== 2 in PSA) → 风险:stale read;w == majority → 风险:secondary 异常时写卡
  metric_unit: (枚举)
  prerequisite_steps: [1]
```

### likely_causes

```
[parameter_causes · cause 1] 默认 / 业务侧 write concern 与 PSA 拓扑搭配不当
  param_name: defaultWriteConcern.w(及业务调用侧 write concern)
  abnormal_value_pattern: `"majority"` 同时 secondary 不健康(写卡);或 < majority(读 stale)
  reasoning_quote: "performance issues if a secondary is unavailable or lagging"
  linked_diagnostic_step_no: 3

[non_parameter_causes · cause 1] PSA 架构本身只有 1 个 data-bearing secondary,故障容忍度低
  cause_type: application-design
  description_quote: "If you are using a three-member primary-secondary-arbiter (PSA) architecture, consider the following:"
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文未给改架构的 mitigation,只链接到外部 mitigation 文档 · 见 reference/_pending/agent2.md#mongo-psa-mitigation-not-explicit)

[non_parameter_causes · cause 2] secondary 物理 / 网络故障导致不可用或 lag
  cause_type: hardware-disk
  description_quote: "if a secondary is unavailable or lagging"
  linked_diagnostic_step_no: 2
  mitigation_quote: (NULL · 本页不展开物理排查 · 见 reference/_pending/agent2.md#mongo-secondary-unavailable-mitigation-not-explicit)
```


## case_id: mongo-wt-cache-size-misconfigured-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: memory-pressure
- **case_pattern**: parameter-audit
- **title**: WiredTiger 内部 cache 大小被人工调高 → 与 filesystem cache 抢内存
- **source_heading**: Cache Configuration Settings
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://www.mongodb.com/docs/manual/core/wiredtiger/
- **source_url_lang**: en

### symptom_description

> Avoid increasing the WiredTiger internal cache size above its default value

### diagnostic_steps

```
[step 1] 读 storage.wiredTiger.engineConfig.cacheSizeGB / cacheSizePct 当前值
  metric_name: storage.wiredTiger.engineConfig.cacheSizeGB / cacheSizePct
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 原文未给具体读取命令 · 见 reference/inferred-references.md#mongo-wt-cachesize-readonly-not-explicit)
  abnormal_pattern_quote: "Avoid increasing the WiredTiger internal cache size above its default value"
  abnormal_pattern_threshold: cacheSizeGB > 默认 50%(RAM - 1GB);或 cacheSizePct > 80%
  metric_unit: bytes / percent
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] cacheSizeGB / cacheSizePct 被人工调高
  param_name: storage.wiredTiger.engineConfig.cacheSizeGB / cacheSizePct
  abnormal_value_pattern: 超过 "50% of (RAM - 1GB)" 默认基线 · 原文允许上限 80%
  reasoning_quote: "The default WiredTiger internal cache size is the larger of either"
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] WT cache 不能区分读写,加大也不解决读热点
  cause_type: application-design
  description_quote: "WiredTiger doesn't reserve a portion of the cache for reads and another for writes"
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文给的是机制说明而非 fix · 见 reference/inferred-references.md#mongo-wt-cache-readwrite-mitigation-not-explicit)
```


## case_id: mongo-explain-sort-stage-disk-spill-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: memory-pressure
- **case_pattern**: core-perf-diagnosis
- **title**: $sort 或 SORT 阶段 spill 到磁盘 → 排序内存压力
- **source_heading**: Sort Stage · $sort and $group Stages
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 2
- **source_url**: https://www.mongodb.com/docs/manual/reference/explain-results/
- **source_url_lang**: en

### symptom_description

> If MongoDB cannot use an index or indexes

### diagnostic_steps

```
[step 1] 看 explain output 中是否含显式 SORT stage
  metric_name: explain.queryPlanner.winningPlan SORT stage 是否存在
  collection_layer: mongo-shell
  collection_method_quote: "If the explain plan does not contain an explicit"
  abnormal_pattern_quote: "in-memory sort operation"
  abnormal_pattern_threshold: winningPlan 树中存在 stage='SORT' 节点(意味没用 index 排序)
  metric_unit: enum
  prerequisite_steps: []

[step 2] 在 executionStats / allPlansExecution mode 看 $sort/$group 的 usedDisk / spills 计数
  metric_name: $sort.usedDisk / $sort.spills / $sort.spilledBytes / $sort.spilledRecords / $sort.spilledDataStorageSize
  collection_layer: mongo-shell
  collection_method_quote: "Whether the stage wrote to disk"
  abnormal_pattern_quote: "The number of times the stage spilled to disk"
  abnormal_pattern_threshold: usedDisk == true · spills > 0 · spilledBytes > 0
  metric_unit: bool / count / bytes
  prerequisite_steps: [1]
```

### likely_causes

```
[non_parameter_causes · cause 1] 排序字段未建索引,数据量超过 sort buffer
  cause_type: application-design
  description_quote: "If MongoDB cannot use an index or indexes"
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文未给 fix 命令 · 见 reference/inferred-references.md#mongo-sort-spill-mitigation-not-explicit)

[non_parameter_causes · cause 2] $group 输入数据量大,internalQueryMaxBlockingSortMemoryUsageBytes 不够
  cause_type: application-design
  description_quote: "An estimate of the number of bytes written to disk"
  linked_diagnostic_step_no: 2
  mitigation_quote: (NULL · 原文是字段定义而非 fix · 同上 ref)
```


## case_id: mongo-pool-connect-timeout-too-large-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: network-latency
- **case_pattern**: parameter-audit
- **title**: connectTimeoutMS 默认或过大 → 应用侧操作时间慢但 DB 侧未见
- **source_heading**: Tuning Your Connection Pool Settings
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/
- **source_url_lang**: en

### symptom_description

> Slow application-side operation times that are not reflected in

### diagnostic_steps

```
[step 1] 读 driver connectTimeoutMS 当前值,与到副本集成员的最长网络延迟对比
  metric_name: driver connectTimeoutMS 当前值 vs 副本集成员最长网络延迟
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 原文是建议而非读取命令 · 见 reference/_pending/agent2.md#mongo-pool-connecttimeoutms-readout-from-driver-knowledge)
  abnormal_pattern_quote: "Slow application-side operation times that are not reflected in"
  abnormal_pattern_threshold: connectTimeoutMS 小于到副本集任一成员的网络延迟
  metric_unit: milliseconds
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] connectTimeoutMS 太小 · driver 在握手阶段超时切换成员
  param_name: connectTimeoutMS
  abnormal_value_pattern: < (副本集任一成员到 client 的网络延迟)
  reasoning_quote: "Set connectTimeoutMS to a value greater than the longest network latency you have to a member of the set."
  linked_diagnostic_step_no: 1
```


## case_id: mongo-pool-socket-timeout-firewall-half-close-02

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: connection-storm
- **case_pattern**: parameter-audit
- **title**: 防火墙错关连接 driver 不感知 → 应通过 socketTimeoutMS 兜底
- **source_heading**: Tuning Your Connection Pool Settings
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/
- **source_url_lang**: en

### symptom_description

> A misconfigured firewall closes a socket connection incorrectly and the driver cannot detect that the connection closed improperly.

### diagnostic_steps

```
[step 1] 读 driver socketTimeoutMS 当前值,与最慢操作耗时对比
  metric_name: driver socketTimeoutMS 当前值 vs 应用最慢合法操作耗时
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 原文是建议而非读取命令 · 见 reference/_pending/agent2.md#mongo-pool-sockettimeoutms-readout-from-driver-knowledge)
  abnormal_pattern_quote: "A misconfigured firewall closes a socket connection incorrectly and the driver cannot detect that the connection closed improperly."
  abnormal_pattern_threshold: socketTimeoutMS 未设 / 设过大,导致 driver 持有半关连接长时间挂死
  metric_unit: milliseconds
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] socketTimeoutMS 未设 / 不合理 · driver 无超时机制兜底半关连接
  param_name: socketTimeoutMS
  abnormal_value_pattern: 未设 / 远大于业务最慢操作耗时
  reasoning_quote: "Set socketTimeoutMS to two or three times the length of the slowest operation that the driver runs."
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] 网络中间件/防火墙错关连接
  cause_type: network-physical-link
  description_quote: "A misconfigured firewall closes a socket connection incorrectly and the driver cannot detect that the connection closed improperly."
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文 mitigation 是 socketTimeoutMS 兜底 · 物理修法是修防火墙 · 见 reference/_pending/agent2.md#mongo-pool-firewall-mitigation-not-explicit)
```


## case_id: mongo-pool-minpoolsize-too-low-startup-creating-conns-03

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: connection-storm
- **case_pattern**: parameter-audit
- **title**: 启动期可用连接不足 → 应用频繁建新连接 → minPoolSize 太小
- **source_heading**: Tuning Your Connection Pool Settings
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/
- **source_url_lang**: en

### symptom_description

> the application spends too much time creating new connections

### diagnostic_steps

```
[step 1] 比较 driver minPoolSize 当前值与"启动期希望可用连接数"
  metric_name: driver minPoolSize · 服务器日志 / real time 面板 connection 创建速率
  collection_layer: log-grep
  collection_method_quote: (NULL · 原文未给具体读取命令,仅说"server logs or real time panel show" · 见 reference/_pending/agent2.md#mongo-pool-conn-create-rate-readout-shell-knowledge)
  abnormal_pattern_quote: "the application spends too much time creating new connections"
  abnormal_pattern_threshold: minPoolSize 远小于启动期峰值并发(导致大量临时建连)
  metric_unit: connections / second
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] minPoolSize 太小 · 池中预热连接不够,启动期被迫现建
  param_name: minPoolSize
  abnormal_value_pattern: 远小于启动期实际并发数
  reasoning_quote: "Set minPoolSize to the number of connections you want to be available at startup."
  linked_diagnostic_step_no: 1
```


## case_id: mongo-pool-maxpoolsize-too-low-underutilized-04

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: parameter-audit
- **title**: DB 负载低、活跃连接少、应用吞吐低于预期 → maxPoolSize 太小限流了
- **source_heading**: Tuning Your Connection Pool Settings
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/
- **source_url_lang**: en

### symptom_description

> The load on the database is low and there's a small number of active connections at any time.

### diagnostic_steps

```
[step 1] 读 driver maxPoolSize 与应用层活跃线程数
  metric_name: driver maxPoolSize · 应用活跃线程数 / 实际每秒操作数
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 原文未给读取命令,实际需读 driver 配置 + 应用线程池配置 · 见 reference/_pending/agent2.md#mongo-pool-maxpoolsize-readout-from-driver-knowledge)
  abnormal_pattern_quote: "The load on the database is low and there's a small number of active connections at any time."
  abnormal_pattern_threshold: maxPoolSize 接近活跃线程数;DB 资源未饱和但吞吐受限
  metric_unit: connections
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] maxPoolSize 设置过小,把并发量从客户端限死
  param_name: maxPoolSize
  abnormal_value_pattern: 小于应用层活跃线程数 / 实际并发需求
  reasoning_quote: "Increase maxPoolSize, or increase the number of active threads in your application or the framework you are using."
  linked_diagnostic_step_no: 1
```


## case_id: mongo-pool-maxpoolsize-too-high-cpu-pressure-05

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: cpu-high
- **case_pattern**: parameter-audit
- **title**: DB CPU 比预期高 + 连接尝试比预期多 → maxPoolSize 太大压垮服务端
- **source_heading**: Tuning Your Connection Pool Settings
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/connection-pool-performance-tuning/
- **source_url_lang**: en

### symptom_description

> Database CPU usage is higher than expected. The server logs or real time panel show more connection attempts than expected.

### diagnostic_steps

```
[step 1] 比较 driver maxPoolSize 与服务端 CPU / connection 接受速率
  metric_name: driver maxPoolSize · 服务端 CPU% · connection accept rate
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 原文未给读取命令 · 见 reference/_pending/agent2.md#mongo-pool-server-cpu-readout-from-shell-knowledge)
  abnormal_pattern_quote: "Database CPU usage is higher than expected. The server logs or real time panel show more connection attempts than expected."
  abnormal_pattern_threshold: 服务端 CPU 持续高位 + 连接尝试速率显著上升
  metric_unit: percent / connections per second
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] maxPoolSize 过大或应用线程池过大 → 服务端被并发压垮
  param_name: maxPoolSize
  abnormal_value_pattern: 远大于服务端可承载并发,或应用线程数远大于实际需要
  reasoning_quote: "Decrease the maxPoolSize or reduce the number of threads in your application."
  linked_diagnostic_step_no: 1
```


## case_id: mongo-slow-query-explain-multi-stage-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: core-perf-diagnosis
- **title**: 慢查询 explain() 五步排查链路
- **source_heading**: Explain Slow Queries
- **diagnostic_steps_count**: 4
- **likely_causes_count**: 2
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/explain-slow-queries/
- **source_url_lang**: en

### symptom_description

> If the execution time is above an acceptable period, further analysis is required to determine why the query takes so long to execute.

### diagnostic_steps

```
[step 1] 看 executionTimeMillis 判定是否超 SLA
  metric_name: explain.executionStats.executionTimeMillis
  collection_layer: mongo-shell
  collection_method_quote: "to see the execution time in milliseconds"
  abnormal_pattern_quote: "If the execution time is above an acceptable period, further analysis is required to determine why the query takes so long to execute"
  abnormal_pattern_threshold: 单条 query executionTimeMillis > 业务 SLA 上限(原文未给数值)
  metric_unit: ms
  prerequisite_steps: []

[step 2] 看 executionStages.inputStage.stage 是否为 COLLSCAN
  metric_name: explain.executionStats.executionStages.inputStage.stage
  collection_layer: mongo-shell
  collection_method_quote: "for each execution stage"
  abnormal_pattern_quote: "Queries that perform filter or sort operations"
  abnormal_pattern_threshold: inputStage.stage == COLLSCAN(应是 IXSCAN)
  metric_unit: enum
  prerequisite_steps: [1]

[step 3] 看 keysExamined vs docsExamined 比
  metric_name: executionStats.totalKeysExamined / executionStats.totalDocsExamined
  collection_layer: mongo-shell
  collection_method_quote: "Compare the number of keys examined to the number of documents examined. If the number of keys is significantly less than the number of documents, it indicates the indexes were ineffective"
  abnormal_pattern_quote: "Queries on collections with indexes may not make effective use of the indexes"
  abnormal_pattern_threshold: totalKeysExamined ≪ totalDocsExamined → 索引未生效
  metric_unit: ratio
  prerequisite_steps: [1]

[step 4] 看 totalDocsExamined / nReturned 比
  metric_name: executionStats.totalDocsExamined / executionStats.nReturned
  collection_layer: mongo-shell
  collection_method_quote: "Queries that use filters to specify the results may have issues"
  abnormal_pattern_quote: "indicates an ineffective index. That is, MongoDB had to scan the collection in order to filter the results"
  abnormal_pattern_threshold: totalDocsExamined / nReturned ≫ 1 → 过滤效率差
  metric_unit: ratio
  prerequisite_steps: [1]
```

### likely_causes

```
[non_parameter_causes · cause 1] 索引未覆盖查询字段(应加索引覆盖)
  cause_type: application-design
  description_quote: "If the query returns a small number of fields and the application is not write intensive on this collection, consider adding indexes to cover the query."
  linked_diagnostic_step_no: 2
  mitigation_quote: "consider adding indexes to cover the query"

[non_parameter_causes · cause 2] 现有索引前缀与查询条件不匹配
  cause_type: application-design
  description_quote: "If the number of keys examined is much lower than the number of documents examined"
  linked_diagnostic_step_no: 3
  mitigation_quote: (NULL · 原文该段被 anchor 拍平 · 见 reference/inferred-references.md#mongo-explain-keyexam-mitigation-not-explicit)
```


## case_id: mongo-profiler-threshold-sampling-audit-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: other
- **case_pattern**: parameter-audit
- **title**: profiler 慢查询阈值 / 抽样率默认配置审计
- **source_heading**: Specify the Threshold for Slow Operations · Profile a Random Sample of Slow Operations
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 3
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/
- **source_url_lang**: en

### symptom_description

> By default, the slow operation threshold is 100 milliseconds

### diagnostic_steps

```
[step 1] 用 db.getProfilingStatus() 看当前 slowms 与 sampleRate
  metric_name: profile.slowms / profile.sampleRate / profile.was
  collection_layer: mongo-shell
  collection_method_quote: "db.getProfilingStatus()"
  abnormal_pattern_quote: "By default, the slow operation threshold is 100 milliseconds"
  abnormal_pattern_threshold: slowms != 业务期望(默认 100ms);sampleRate < 1.0 但又依赖完整慢日志
  metric_unit: ms / ratio
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] slowOpThresholdMs 默认 100ms 与业务 SLA 不匹配
  param_name: operationProfiling.slowOpThresholdMs / db.setProfilingLevel slowms
  abnormal_value_pattern: 默认 100ms · 业务期望更紧或更宽
  reasoning_quote: "To change the slow operation threshold, use one of the following"
  linked_diagnostic_step_no: 1

[parameter_causes · cause 2] sampleRate 默认 1.0,profiler 在 level 1 高负载下成本不可忽视
  param_name: operationProfiling.slowOpSampleRate / setProfilingLevel sampleRate
  abnormal_value_pattern: sampleRate == 1.0 + profiling level 1 + 高 QPS → 写 system.profile 占比拉升
  reasoning_quote: "By default, sampleRate is set to"
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] profiler 本身有开销,不是免费观察工具
  cause_type: application-design
  description_quote: "When enabled, profiling affects database performance, especially at"
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文给出建议是"用 sampleRate 抽样" + "短期开启" · 见 reference/inferred-references.md#mongo-profiler-overhead-mitigation-not-explicit)
```


## case_id: mongo-8x-thp-disabled-tcmalloc-suboptimal-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: memory-pressure
- **case_pattern**: core-perf-diagnosis
- **title**: THP 未启用导致 MongoDB 8.0+ 新 TCMalloc 优化失效
- **source_heading**: Enable Transparent Hugepages (THP)
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/
- **source_url_lang**: en

### symptom_description

> Transparent Hugepages (THP) is a Linux memory management system that reduces the overhead of Translation Lookaside Buffer (TLB) lookups. THP achieves this by combining small pages and making them appear as larger memory pages to the application. In MongoDB 8.0 and later, ensure that THP is enabled before .

### diagnostic_steps

```
[step 1] 读当前 THP / defrag / khugepaged 状态
  metric_name: /sys/kernel/mm/transparent_hugepage/{enabled,defrag,khugepaged/defrag}
  collection_layer: os
  collection_method_quote: "cat /sys/kernel/mm/transparent_hugepage/enabled && cat /sys/kernel/mm/transparent_hugepage/defrag && cat /sys/kernel/mm/transparent_hugepage/khugepaged"
  abnormal_pattern_quote: (启用应为 `[always] madvise never`,即方括号在 always 上;若为 `[never]` 则 THP 未启用)
  abnormal_pattern_threshold: enabled 当前值不是 `always`
  metric_unit: enum
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] /sys/kernel/mm/transparent_hugepage/enabled 未设 always
  param_name: kernel transparent_hugepage/enabled(可通过 systemd / init.d / kernel boot param 启用)
  abnormal_value_pattern: never 或 madvise(对 MongoDB 8.0+ 新 TCMalloc 不优化)
  reasoning_quote: "In MongoDB 8.0 and later, ensure that THP is enabled before ."
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] 系统使用 tuned/ktune profile 反向覆盖
  cause_type: application-design
  description_quote: "tuned and ktune are kernel tuning utilities that can affect the Transparent Hugepages setting on your system."
  linked_diagnostic_step_no: 1
  mitigation_quote: "If you are using tuned or ktune on your RHEL or CentOS system while running mongod, you must create a custom tuned profile to ensure that THP stays enabled."
```


## case_id: mongo-replica-set-replication-lag-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: replica-lag
- **case_pattern**: core-perf-diagnosis
- **title**: 副本集复制延迟(replication lag)
- **source_heading**: Check the Replication Lag
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 6
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/troubleshoot-replica-sets/
- **source_url_lang**: en

### symptom_description

> Replication lag is a delay between an operation on the primary and the application of that operation from the oplog to the secondary. Replication lag can be a significant issue and can seriously affect MongoDB replica set deployments. Excessive replication lag makes "lagged" members ineligible to quickly become primary and increases the possibility that distributed read operations will be inconsistent.

### diagnostic_steps

```
[step 1] 检查每个 secondary 的同步进度
  metric_name: syncedTo time per secondary
  collection_layer: mongo-shell
  collection_method_quote: `rs.printSecondaryReplicationInfo()`
  abnormal_pattern_quote: `45 secs (0 hrs) behind the primary`(原文 Flow Control 段示例:某成员 syncedTo 落后 45 秒)
  abnormal_pattern_threshold: 落后秒数显著大于 0;持续增长更可疑
  metric_unit: seconds
  prerequisite_steps: []

[step 2] 看是否触发 flow control
  metric_name: flowControl.isLagged
  collection_layer: mongo-runtime-cmd
  collection_method_quote: `db.runCommand( { serverStatus: 1 } ).flowControl.isLagged`
  abnormal_pattern_quote: "If flow control has not engaged, investigate the secondary to determine the cause of the replication lag, such as limitations in the hardware, network, or application."
  abnormal_pattern_threshold: `flowControl.isLagged === true` 表示已触发流控,主在限速等待 secondary
  metric_unit: bool
  prerequisite_steps: [1]
```

### likely_causes

```
[parameter_causes · cause 1] majority write concern 未启用
  param_name: writeConcernMajorityJournalDefault / 应用层 writeConcern
  abnormal_value_pattern: unacknowledged / w:1(未要求多数节点确认)
  reasoning_quote: "For best results, configure write concern to require confirmation of replication to secondaries. This prevents write operations from returning if replication cannot keep up with the write load."
  linked_diagnostic_step_no: 1

[parameter_causes · cause 2] flowControlTargetLagSeconds 阈值
  param_name: flowControlTargetLagSeconds
  abnormal_value_pattern: 默认值偏宽 / 业务期望更紧的延迟容忍度
  reasoning_quote: "With flow control enabled, as the lag grows close to the flowControlTargetLagSeconds, writes on the primary must obtain tickets before taking locks to apply writes. By limiting the number of tickets issued per second, the flow control mechanism attempts to keep the lag under the target."
  linked_diagnostic_step_no: 2

[non_parameter_causes · cause 1] 网络丢包/路由
  cause_type: network-physical-link
  description_quote: "Check the network routes between the members of your set to ensure that there is no packet loss or network routing issue."
  linked_diagnostic_step_no: 1
  mitigation_quote: "Use tools including ping to test latency between set members and traceroute to expose the routing of packets network endpoints."

[non_parameter_causes · cause 2] secondary 磁盘 IO 跟不上
  cause_type: hardware-disk
  description_quote: "If the file system and disk device on the secondary is unable to flush data to disk as quickly as the primary, then the secondary will have difficulty keeping state. Disk-related issues are incredibly prevalent on multi-tenant systems, including virtualized instances, and can be transient if the system accesses disk devices over an IP network (as is the case with Amazon's EBS system.)"
  linked_diagnostic_step_no: 1
  mitigation_quote: "Use system-level tools to assess disk status, including iostat or vmstat."

[non_parameter_causes · cause 3] primary 长事务/慢查询
  cause_type: application-design
  description_quote: "In some cases, long-running operations on the primary can block replication on secondaries."
  linked_diagnostic_step_no: 1
  mitigation_quote: "use the database profiler to see if there are slow queries or long-running operations that correspond to the incidences of lag."

[non_parameter_causes · cause 4] 大批量写入 + unacknowledged
  cause_type: application-design
  description_quote: "If you are performing a large data ingestion or bulk load operation that requires a large number of writes to the primary, particularly with unacknowledged write concern, the secondaries will not be able to read the oplog fast enough to keep up with changes."
  linked_diagnostic_step_no: 1
  mitigation_quote: "request write acknowledgment write concern after every 100, 1,000, or another interval to provide an opportunity for secondaries to catch up with the primary."
```


## case_id: mongo-replica-set-member-connectivity-03

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: network-latency
- **case_pattern**: fault-management
- **title**: replica set 成员双向连通性失败
- **source_heading**: Test Connections Between all Members
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 3
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/troubleshoot-replica-sets/
- **source_url_lang**: en

### symptom_description

> All members of a replica set must be able to connect to every other member of the set to support replication. Always verify connections in both "directions." Networking topologies and firewall configurations can prevent normal and required connectivity, which can block replication.

### diagnostic_steps

```
[step 1] 双向 mongosh 连接测试
  metric_name: inter-member TCP reachability
  collection_layer: mongo-shell
  collection_method_quote: `mongosh --host m2.example.net --port 27017` (从 m1 到 m2)+ `mongosh --host m1.example.net --port 27017` (从 m2 到 m1) — 三节点两两双向都需测
  abnormal_pattern_quote: "If any connection, in any direction fails, check your networking and firewall configuration and reconfigure your environment to allow these connections."
  abnormal_pattern_threshold: 任一方向连接失败
  metric_unit: bool
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] bind_ip 仅绑 localhost
  param_name: net.bindIp
  abnormal_value_pattern: 仅含 localhost / 未含其他成员可达的 IP 或 hostname
  reasoning_quote: "MongoDB binaries, mongod and mongos, bind to localhost by default."
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] 防火墙/网络拓扑阻断
  cause_type: network-physical-link
  description_quote: "Networking topologies and firewall configurations can prevent normal and required connectivity, which can block replication."
  linked_diagnostic_step_no: 1
  mitigation_quote: "If any connection, in any direction fails, check your networking and firewall configuration and reconfigure your environment to allow these connections."

[non_parameter_causes · cause 2] split horizon DNS 仅 IP 配置(MongoDB 5.0+)
  cause_type: os-version-bug
  description_quote: "Starting in MongDB 5.0, split horizon DNS nodes that are only configured with an IP address fail startup validation and report an error."
  linked_diagnostic_step_no: 1
  mitigation_quote: "See disableSplitHorizonIPCheck."(原文紧接此句给出绕过参数 · 详见 source URL anchor)
```


## case_id: mongo-replica-set-reboot-multi-secondary-04

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: startup-failure
- **case_pattern**: fault-management
- **title**: 同时重启 ≥2 secondary 导致集群失去多数票
- **source_heading**: Socket Exceptions when Rebooting More than One Secondary
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/troubleshoot-replica-sets/
- **source_url_lang**: en

### symptom_description

> When you reboot members of a replica set, ensure that the set is able to elect a primary during the maintenance. This means ensuring that a majority of the set's members[n].votes are available. When a set's active members can no longer form a majority, the set's primary steps down and becomes a secondary. The primary does not close client connections when it steps down. Clients cannot write to the replica set until the members elect a new primary.

### diagnostic_steps

```
[step 1] 数有效投票成员
  metric_name: rs.status() members[].votes (active count)
  collection_layer: mongo-shell
  collection_method_quote: "members[n].votes"
  abnormal_pattern_quote: "Given a three-member replica set where every member has one vote, the set can elect a primary if at least two members can connect to each other. If you reboot the two secondaries at once, the primary steps down and becomes a secondary."
  abnormal_pattern_threshold: active votes < ceil((total_votes + 1) / 2)
  metric_unit: count
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] 维护流程未保多数
  cause_type: application-design
  description_quote: "When you reboot members of a replica set, ensure that the set is able to elect a primary during the maintenance. This means ensuring that a majority of the set's members[n].votes are available."
  linked_diagnostic_step_no: 1
  mitigation_quote: (原文隐含建议:同时重启不超过总票数 - 多数所需的差。例 3 节点集合一次只重启 1 个)
```


## case_id: mongo-shard-mongos-unavailable-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: startup-failure
- **case_pattern**: fault-management
- **title**: mongos / 应用服务器不可用
- **source_heading**: Application Servers or mongos Instances Become Unavailable
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/troubleshoot-sharded-clusters/
- **source_url_lang**: en

### symptom_description

> If each application server has its own mongos instance, other application servers can continue to access the database. Furthermore, mongos instances do not maintain persistent state, and they can restart and become unavailable without losing any state or data. When a mongos instance starts, it retrieves a copy of the config database and can begin routing queries.

### diagnostic_steps

```
[step 1] 看 mongos 进程状态 + 监听端口
  metric_name: mongos process aliveness
  collection_layer: os
  collection_method_quote: (原文未给具体读法 · 通用 `pgrep -f mongos` + `ss -tlnp \
  abnormal_pattern_quote: "instances do not maintain persistent state, and they can restart and become unavailable without losing any state or data."(隐含异常 = mongos 进程不在)
  abnormal_pattern_threshold: mongos PID 不存在 / 端口未监听
  metric_unit: bool
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] mongos 进程崩溃
  cause_type: application-design
  description_quote: "If each application server has its own mongos instance, other application servers can continue to access the database."
  linked_diagnostic_step_no: 1
  mitigation_quote: (重启 mongos · 由于不持久化,重启后会从 config server 拉一份元数据继续路由)
```


## case_id: mongo-shard-replica-member-down-02

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: replica-lag
- **case_pattern**: fault-management
- **title**: shard replica set 单成员不可用
- **source_heading**: A Single Member Becomes Unavailable in a Shard Replica Set
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/troubleshoot-sharded-clusters/
- **source_url_lang**: en

### symptom_description

> Always investigate availability interruptions and failures. If a system is unrecoverable, replace it and create a new member of the replica set as soon as possible to replace the lost redundancy.

### diagnostic_steps

```
[step 1] rs.status() 看成员状态
  metric_name: rs.status() members[].state
  collection_layer: mongo-shell
  collection_method_quote: (本页未明示;通用 `rs.status()`,见 troubleshoot-replica-sets 文档)
  abnormal_pattern_quote: "If the unavailable mongod is a primary, then the replica set will elect a new primary."
  abnormal_pattern_threshold: 至少 1 个成员 state != PRIMARY/SECONDARY/ARBITER
  metric_unit: enum
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] 成员节点宕机或网络隔离
  cause_type: network-physical-link
  description_quote: "If the unavailable mongod is a secondary, and it disconnects the primary and secondary will continue to hold all data. In a three member replica set, even if a single member of the set experiences catastrophic failure, two other members have full copies of the data."
  linked_diagnostic_step_no: 1
  mitigation_quote: "If an unavailable secondary becomes available while it still has current oplog entries, it can catch up to the latest state of the set using the normal replication process"
```


## case_id: mongo-shard-all-members-down-data-unavailable-03

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: startup-failure
- **case_pattern**: fault-management
- **title**: shard 全部成员不可用 → 该 shard 数据不可达
- **source_heading**: All Members of a Shard Become Unavailable
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/troubleshoot-sharded-clusters/
- **source_url_lang**: en

### symptom_description

> If all members of a replica set shard are unavailable, all data held in that shard is unavailable. However, the data on all other shards will remain available, and it is possible to read and write data to the other shards. However, your application must be able to deal with partial results, and you should investigate the cause of the interruption and attempt to recover the shard as soon as possible.

### diagnostic_steps

```
[step 1] 对每 shard 跑 rs.status()
  metric_name: each shard's rs.status() · 至少有 1 个 PRIMARY/SECONDARY 节点
  collection_layer: mongo-shell
  collection_method_quote: (原文用"In a sharded cluster, mongod and mongos instances monitor the replica sets in the sharded cluster"暗示;具体命令为 connect each shard primary 跑 rs.status())
  abnormal_pattern_quote: "If all members of a replica set shard are unavailable, all data held in that shard is unavailable."
  abnormal_pattern_threshold: 某 shard 全成员不可达
  metric_unit: bool
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] shard 整体故障(机房断电 / 网络分区)
  cause_type: network-physical-link
  description_quote: "your application must be able to deal with partial results, and you should investigate the cause of the interruption"
  linked_diagnostic_step_no: 1
  mitigation_quote: (从备份恢复或重新初始化 shard)
```


## case_id: mongo-shard-config-server-no-primary-04

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: startup-failure
- **case_pattern**: fault-management
- **title**: config server replica set 失主导致集群元数据冻结
- **source_heading**: A Config Server Replica Set Member Become Unavailable
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/troubleshoot-sharded-clusters/
- **source_url_lang**: en

### symptom_description

> If the replica set config server loses its primary and cannot elect a primary, the cluster's metadata becomes read only. You can still read and write data from the shards, but no chunk migration or chunk splits will occur until a primary is available.

### diagnostic_steps

```
[step 1] 检查 config server replica set 状态
  metric_name: config server replica set rs.status() · primary 是否存在
  collection_layer: mongo-shell
  collection_method_quote: "Replica sets provide high availability for the config servers. If an unavailable config server is a primary, then the replica set will elect a new primary."
  abnormal_pattern_quote: "If the replica set config server loses its primary and cannot elect a primary, the cluster's metadata becomes read only."
  abnormal_pattern_threshold: config server replica set 无 primary
  metric_unit: bool
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] config server 多数成员宕机/网络隔离
  cause_type: network-physical-link
  description_quote: "All config servers must be running and available when you first initiate a sharded cluster."
  linked_diagnostic_step_no: 1
  mitigation_quote: "For production deployments, we recommend deplying config server and shard replica sets on at least three data centers. This configuration provides high availability in case a single data center goes down."
```


## case_id: mongo-shard-cursor-stale-config-05

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: fault-management
- **title**: cursor 因 mongos 元数据陈旧失败
- **source_heading**: Cursor Fails Because of Stale Config Data
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 1
- **source_url**: https://www.mongodb.com/docs/manual/tutorial/troubleshoot-sharded-clusters/
- **source_url_lang**: en

### symptom_description

> A query returns the following warning when one or more of the mongos instances has not yet updated its cache of the cluster's metadata from the config database: > could not initialize cursor across all shards because : stale config detected

### diagnostic_steps

```
[step 1] 在 mongos 日志或客户端拿到的 warning 中匹配 "stale config detected"
  metric_name: mongos warning log · "stale config detected" 出现频次
  collection_layer: log-grep
  collection_method_quote: "could not initialize cursor across all shards because : stale config detected"
  abnormal_pattern_quote: "This warning should not propagate back to your application. The warning will repeat until all the mongos instances refresh their caches."
  abnormal_pattern_threshold: warning 持续出现
  metric_unit: count
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] mongos 元数据缓存与 config server 不同步
  cause_type: application-design
  description_quote: "one or more of the mongos instances has not yet updated its cache of the cluster's metadata from the config database"
  linked_diagnostic_step_no: 1
  mitigation_quote: "To force an instance to refresh its cache, run the flushRouterConfig command."
```


## case_id: mongo-replica-lag-secondary-behind-primary-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: replica-lag
- **case_pattern**: core-perf-diagnosis
- **title**: Ops Manager replication lag alert: secondary behind primary
- **source_heading**: Replication Lag
- **diagnostic_steps_count**: 3
- **likely_causes_count**: 3
- **source_url**: https://www.mongodb.com/docs/ops-manager/current/reference/alerts/replication-lag/
- **source_url_lang**: en

### symptom_description

> secondary of replica set ABC was behind the most recent

### diagnostic_steps

```
[step 1] 查看 Replication Lag chart 确认延迟时长与持续时间
  metric_name: Replication Lag (seconds)
  collection_layer: atlas-advisor
  collection_method_quote: "View the following charts to monitor your progress"
  abnormal_pattern_quote: "Adjust the settings for this alert to only trigger if the replication\nlag persists for longer than 2 minutes."
  abnormal_pattern_threshold: {"replication_lag_persistent_seconds": ">= 120"}
  metric_unit: seconds
  prerequisite_steps: []

[step 2] 查看 Replication Headroom 判断 secondary 是否会掉出 oplog 窗口
  metric_name: Replication Headroom
  collection_layer: atlas-advisor
  collection_method_quote: "Monitor replication headroom to determine whether the secondary might fall off the oplog."
  abnormal_pattern_quote: (NULL · 原文未给定量阈值 · 见 reference/inferred-references.md#opsmgr-replag-headroom-threshold)
  abnormal_pattern_threshold: (NULL · 见 reference/inferred-references.md#opsmgr-replag-headroom-threshold)
  metric_unit: seconds
  prerequisite_steps: [1]

[step 3] 查看 Network metrics 判断带宽 / 网络问题
  metric_name: Network metrics
  collection_layer: atlas-advisor
  collection_method_quote: "Monitor network metrics to track network performance."
  abnormal_pattern_quote: (NULL · 原文未给定量阈值 · 见 reference/inferred-references.md#opsmgr-replag-network-threshold)
  abnormal_pattern_threshold: (NULL · 见 reference/inferred-references.md#opsmgr-replag-network-threshold)
  metric_unit: bytes/sec
  prerequisite_steps: [1]
```

### likely_causes

```
[non_parameter_causes · cause 1] 副本集空闲(误报)· lag = 距上次写时间
  cause_type: application-design
  description_quote: "An idle replica set. The reported replication lag is actually just the\ntime since the last write."
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文为 alert 阈值调整建议非 fix 命令 · 见 reference/inferred-references.md#mongo-replication-lag-alert-tuning-narrative)

[non_parameter_causes · cause 2] Secondary 配置不足,跟不上 primary
  cause_type: hardware-cpu-physical
  description_quote: "The secondary is under-provisioned, which means it needs more\nallocated resources, and cannot keep up with the primary\n(common if using secondaries for read scaling)."
  linked_diagnostic_step_no: 2
  mitigation_quote: "Move (or upgrade in place) the secondary to a machine that is\nidentically (or better) provisioned to the current primary."

[non_parameter_causes · cause 3] primary↔secondary 网络带宽不足或网络问题
  cause_type: hardware-network
  description_quote: "There is insufficient bandwidth, or some other networking problem,\nbetween the primary and secondary."
  linked_diagnostic_step_no: 3
  mitigation_quote: "Resolve networking issues between the primary and secondary."
```


## case_id: mongo-slow-log-queue-wait-vs-working-time-mongodb8-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: core-perf-diagnosis
- **title**: MongoDB 8.0 慢日志: workingMillis 与 durationMillis 分离 → 区分真慢查询 vs queue 等待
- **source_heading**: Practical Diagnosis of Slow Queries
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 3
- **source_url**: https://www.mydbops.com/blog/mongodb-8-slow-query-analysis-working-time-vs-duration-metrics
- **source_url_lang**: en

### symptom_description

> In previous versions of MongoDB, slow queries were flagged based on total duration, which included time spent waiting on locks and flow control. While this was helpful, it often meant that some queries appeared “slow” despite having minimal execution time.

### diagnostic_steps

```
[step 1] 读取 mongod 慢日志,提取 workingMillis / durationMillis / queues.execution.totalTimeQueuedMicros
  metric_name: mongod_slow_log.workingMillis
  collection_layer: log-grep
  collection_method_quote: (NULL · 原文未给读取慢日志的字面命令 · 见 reference/inferred-references.md#mydbops-mongo8-slowlog-grep)
  abnormal_pattern_quote: "workingMillis: 120,\n        \"durationMillis\": 300,\n        \"queues\": {\n            \"execution\": {\n                \"totalTimeQueuedMicros\": 180000\n            }\n        }"
  abnormal_pattern_threshold: {"example_workingMillis": 120, "example_durationMillis": 300, "example_totalTimeQueuedMicros": 180000}
  metric_unit: ms / micros
  prerequisite_steps: []

[step 2] 比较 workingMillis 和 totalTimeQueuedMicros 走判断三分支
  metric_name: workingMillis_vs_totalTimeQueuedMicros
  collection_layer: log-grep
  collection_method_quote: (NULL · 原文未给字面比较命令 · 见 reference/inferred-references.md#mydbops-mongo8-slowlog-classify)
  abnormal_pattern_quote: "High workingMillis, Low totalTimeQueuedMicrosDiagnosis: The query is expensive in terms of actual execution time."
  abnormal_pattern_threshold: NULL
  metric_unit: NULL
  prerequisite_steps: [1]
```

### likely_causes

```
[non_parameter_causes · cause 1] 真慢查询: workingMillis 高 + queue wait 低 → CPU/IO 紧张
  cause_type: application-design
  description_quote: "High workingMillis, Low totalTimeQueuedMicrosDiagnosis: The query is expensive in terms of actual execution time.Action: Focus on optimizing the query itself by considering indexing improvements, refining query patterns, or reworking the schema."
  linked_diagnostic_step_no: 2
  mitigation_quote: "Focus on optimizing the query itself by considering indexing improvements, refining query patterns, or reworking the schema."

[non_parameter_causes · cause 2] queue 等待: workingMillis 低 + queue wait 高 → ticket / 锁瓶颈
  cause_type: application-design
  description_quote: "Low workingMillis, High totalTimeQueuedMicrosDiagnosis: The query executes quickly but is delayed due to waiting for resources (e.g., lock or flow control).Action: Improve concurrency by tweaking settings like increasing ticket counts or considering horizontal scaling to better handle query load."
  linked_diagnostic_step_no: 2
  mitigation_quote: "Improve concurrency by tweaking settings like increasing ticket counts or considering horizontal scaling to better handle query load."

[non_parameter_causes · cause 3] 双重瓶颈: workingMillis 高 + queue wait 高 → 既慢又被排队
  cause_type: application-design
  description_quote: "High workingMillis and High totalTimeQueuedMicrosDiagnosis: The query is both expensive and frequently delayed due to being stuck in the queue.Action: Prioritize query optimization. If the query remains queued, explore resource allocation and concurrency configurations to ensure smoother execution."
  linked_diagnostic_step_no: 2
  mitigation_quote: "Prioritize query optimization. If the query remains queued, explore resource allocation and concurrency configurations to ensure smoother execution."
```


## case_id: mongo-plancache-bloat-sbe-7-0-oom-kills-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: memory-pressure
- **case_pattern**: core-perf-diagnosis
- **title**: MongoDB 7.0 SBE plan cache 膨胀: 单 query shape 5 万+ plan → OOM kill
- **source_heading**: MongoDB 7.0 High Memory Usage: Environment and Initial Symptoms
- **diagnostic_steps_count**: 5
- **likely_causes_count**: 3
- **source_url**: https://www.mydbops.com/blog/mongodb-plancache-memory-issue-sbe-fix
- **source_url_lang**: en

### symptom_description

> We operate a 5-node MongoDB replica set where everything initially looked normal: CPU was low, cache behavior was healthy, and no slow-query spikes were visible. Over time, however, resident memory kept climbing until the Linux OOM killer started terminating mongod processes.

### diagnostic_steps

```
[step 1] 读 top 看 mongod 进程 RES 是否远超 cache + heap 配置
  metric_name: mongod_resident_memory
  collection_layer: os
  collection_method_quote: "top - 19:14:57 up 80 days,  6:05,  5 users,  load average: 0.93, 0.89, 0.99"
  abnormal_pattern_quote: "704060 mongodb   20   0   73.6g  65.5g  36660 S 236.7  53.1   1746:34 mongod"
  abnormal_pattern_threshold: {"VIRT_GB": 73.6, "RES_GB": 65.5, "RAM_total_GiB": 123}
  metric_unit: GB
  prerequisite_steps: []

[step 2] 启用 heapProfilingEnabled 看内存分配 hot path
  metric_name: heap_profile_alloc_hotspots
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 原文未给具体启用命令字面 · 见 reference/inferred-references.md#mydbops-plancache-heap-profile-cmd)
  abnormal_pattern_quote: "There was a high number of memory allocation logs for the query planner."
  abnormal_pattern_threshold: NULL
  metric_unit: NULL
  prerequisite_steps: [1]

[step 3] 在慢日志中观察同一 query shape 的 queryHash / planCacheKey 是否变化
  metric_name: queryHash_uniqueness_per_shape
  collection_layer: log-grep
  collection_method_quote: "zgrep -i 'prod.test' /var/log/mongodb/mongod.log
  abnormal_pattern_quote: "For the query below, the queryHash and planCacheKey values were changing with each query, even though the query itself remained the same."
  abnormal_pattern_threshold: NULL
  metric_unit: count
  prerequisite_steps: [2]

[step 4] 用 getPlanCache().list() 看单集合 plan 缓存条目数
  metric_name: planCache.entries_count
  collection_layer: mongo-shell
  collection_method_quote: "db.test.getPlanCache().list().length"
  abnormal_pattern_quote: "A single collection had 52,891 query plans for one query shape, causing memory usage to rise with planCache growth."
  abnormal_pattern_threshold: {"plan_cache_entries": 52891}
  metric_unit: entries
  prerequisite_steps: [3]

[step 5] 跨版本对比(6.0 / 7.0 / 8.0) queryFramework + queryHash 行为
  metric_name: queryFramework_per_version
  collection_layer: log-grep
  collection_method_quote: (NULL · 原文展示了 3 版本的日志样例但未给比对命令 · 见 reference/inferred-references.md#mydbops-plancache-version-compare)
  abnormal_pattern_quote: "The issue occurred in MongoDB 7.0 but not in 6.0 or 8.0. It was identified as a bug in the SBE (Slot-Based Execution) engine introduced in 7.0. The issue is tracked in MongoDB JIRA SERVER-96924."
  abnormal_pattern_threshold: {"affected_versions": ["7.0"], "fixed_in": "8.0", "jira": "SERVER-96924"}
  metric_unit: NULL
  prerequisite_steps: [4]
```

### likely_causes

```
[parameter_causes · cause 1] internalQueryFrameworkControl 默认走 SBE,触发 7.0 bug
  param_name: internalQueryFrameworkControl
  abnormal_value_pattern: (默认 trySbeEngine,在 7.0 上触发 SBE plan cache 不稳定 hash bug)
  reasoning_quote: "Forced the classic query engine:db.adminCommand({ setParameter: 1, internalQueryFrameworkControl: \"forceClassicEngine\" });This server parameter forces MongoDB to use the classic query engine instead of SBE, bypassing the bug entirely."
  linked_diagnostic_step_no: 5

[non_parameter_causes · cause 1] MongoDB 7.0 SBE 引擎 plan cache key hashing bug (SERVER-96924)
  cause_type: os-version-bug
  description_quote: "What started as occasional OOM kills turned into a weeks-long investigation that eventually traced back to an unexpected interaction between MongoDB's SBE query engine and the plan cache. This post walks through the full investigation, step by step, and how we finally nailed down the root cause - a bug specific to MongoDB 7.0's SBE implementation."
  linked_diagnostic_step_no: 5
  mitigation_quote: "Both solutions worked. Memory usage stabilized with forceClassicEngine, and the issue was fully resolved in MongoDB 8.0."

[non_parameter_causes · cause 2] 流量与内存增长正相关
  cause_type: application-design
  description_quote: "During Diwali week (low traffic), memory growth slowed significantly. When traffic resumed, memory spiked again—confirming the leak was tied to query execution volume."
  linked_diagnostic_step_no: 1
  mitigation_quote: NULL
```


## case_id: mongo-sharding-jumbo-chunk-uneven-write-load-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: disk-io-saturation
- **case_pattern**: core-perf-diagnosis
- **title**: jumbo chunks 无法被 balancer 迁移导致单 shard 写热点
- **source_heading**: What are jumbo chunks? + Ok, I have Jumbo chunks in my shard, but why should I bother
- **diagnostic_steps_count**: 3
- **likely_causes_count**: 3
- **source_url**: https://www.percona.com/blog/2018/04/09/mongodb-sharding-are-chunks-balanced-part-1/
- **source_url_lang**: en

### symptom_description

> If jumbo chunks are created on the shard1, that means the chunks are more than 64MB of size. shard1 fills up faster compared to shard2, even though the number of chunks is balanced. More data to shard1 leads to more queries route to shard1 as compare to shard2. This causes one shard with a higher load compared to the other, and leads to performance issues.

### diagnostic_steps

```
[step 1] 检查 balancer 状态
  metric_name: sh.getBalancerState()
  collection_layer: mongo-shell
  collection_method_quote: "mongos> sh.getBalancerState()"
  abnormal_pattern_quote: "Before we start, please check that the balancer is running:"
  abnormal_pattern_threshold: 返回 false 即异常(本 case 期望 true 才能继续)
  metric_unit: bool
  prerequisite_steps: []

[step 2] 用 sh.status(true) 看 chunk 标记
  metric_name: sh.status verbose 输出中的 jumbo flag
  collection_layer: mongo-shell
  collection_method_quote: "sh.status(true)"
  abnormal_pattern_quote: "Please note, only one chunk is moved to the other shard, while the other is not. The balancer can’t move that, and it is flagged as “jumbo”. So sometimes when moving a chunk is triggered, the mongos will mark a large chunk as “jumbo”."
  abnormal_pattern_threshold: sh.status 输出中含 `jumbo` 标记的 chunk 行
  metric_unit: flag
  prerequisite_steps: [1]

[step 3] config.chunks 查询 jumbo 标记
  metric_name: config.chunks { jumbo: true }
  collection_layer: mongo-shell
  collection_method_quote: "mongos> db.chunks.find({\"shard\" : \"shard0000\"},{\"shard\":1,\"jumbo\":1}).pretty()"
  abnormal_pattern_quote: "Jumbo found! Now at this time, mongos is aware that it has a jumbo chunk."
  abnormal_pattern_threshold: 返回包含 `"jumbo" : true` 的文档
  metric_unit: flag
  prerequisite_steps: [2]
```

### likely_causes

```
[parameter_causes · cause 1] 单 chunk 超过配置 chunk size(64MB)/ 25 万文档无法 split
  param_name: sharding chunk size(默认 64MB)/ 25 万文档上限
  abnormal_value_pattern: 单 chunk 实际大小或文档数超出此阈值
  reasoning_quote: "MongoDB splits chunks when they increase beyond the configured chunk size (i.e., 64 MB) or exceeds 250000 documents. ... Sometimes chunks cannot be broken up and continue to grow beyond the configured size. The balancer cannot move it."
  linked_diagnostic_step_no: 3

[non_parameter_causes · cause 1] 多 mongos 或 mongos 频繁重启 · splitIfShould 计数器丢失
  cause_type: application-design
  description_quote: "The main reason for jumbos is multiple mongos, or restarting mongos regularly. This causes the splitIfShould not to be called enough, and prevents chunks from splitting. The balancer won’t be able to move it."
  linked_diagnostic_step_no: 3
  mitigation_quote: "Each mongos measures how much data it has seen inserted or updated for each chunk. With each write, a call to ShouldSplit is made by sending an internal command “splitVector” to the primary that owns the chunks. If mongos is restarted, it loses this memory."

[non_parameter_causes · cause 2] 已存在 jumbo,需手动 split
  cause_type: application-design
  description_quote: "Yes, these can be fixed by performing a manual split, using the “split” command. These chunks can be split into smaller pieces and easily moved by the balancer."
  linked_diagnostic_step_no: 3
  mitigation_quote: "For more specific information on how to manually use the splitAt() and splitFind() commands, please refer this blog post written by Miguel Angel Nieto."
```


## case_id: mongo-sharding-equal-chunks-skewed-data-getshard-distribution-02

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: disk-io-saturation
- **case_pattern**: core-perf-diagnosis
- **title**: chunk 计数均衡但数据/查询全压在一个 shard(getShardDistribution 100%/0%)
- **source_heading**: I cannot see any jumbo chunks, and chunks are distributed evenly in each shard but of different sizes
- **diagnostic_steps_count**: 1
- **likely_causes_count**: 2
- **source_url**: https://www.percona.com/blog/2018/04/09/mongodb-sharding-are-chunks-balanced-part-1/
- **source_url_lang**: en

### symptom_description

> A common misconception about the balancer is that it balances the chunks by data size. This isn’t true. It just balances the number of chunks when a particular shard reaches maximum thershold counts (that’s why you see chunks equally distributed). Hence a chunk with 0 documents in it counts just the same as one with 500k documents.

### diagnostic_steps

```
[step 1] 用 db.col.getShardDistribution() 看每 shard 实际数据/文档数
  metric_name: getShardDistribution: per-shard data / docs / chunks
  collection_layer: mongo-shell
  collection_method_quote: "mongos> db.col.getShardDistribution()"
  abnormal_pattern_quote: "It says two chunks in each shard (shard0000 and shard0001), and shard0001 has no data while shard0000 has all the data, 129MB each chunk. Here the two chunks are on each shard because range-based sharding is being used."
  abnormal_pattern_threshold: 单 shard 占 100% 数据 / 100% docs;其他 shard 0%
  metric_unit: percent
  prerequisite_steps: []
```

### likely_causes

```
[non_parameter_causes · cause 1] range-based sharding 在初始 chunk 边界已固定
  cause_type: application-design
  description_quote: "Here the two chunks are on each shard because range-based sharding is being used. MongoDB allocated two chunks for each shard initially, then documents are allocated to these chunks."
  linked_diagnostic_step_no: 1
  mitigation_quote: "Hashed sharding is considered good for shard keys with fields that change monotonically. If you need the data to be exactly split among shards, then a hashed index must be used."

[non_parameter_causes · cause 2] 单调递增/递减 shard key
  cause_type: application-design
  description_quote: "A good shard key enables MongoDB to distribute documents evenly throughout shards. A key that has high cardinality for better horizontal scaling and low frequency to prevent uneven document distribution, and does not increase or decrease monotonically is considered a good shard key."
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文未给"换 shard key"的具体命令 · 仅给方向)
```


## case_id: mongo-k8s-container-wt-cache-fallback-256mb-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: memory-pressure
- **case_pattern**: core-perf-diagnosis
- **title**: 容器中 WiredTiger 无法识别容器内存限制,回退 256MB 最小 cache
- **source_heading**: Changing the cacheSizeRatio
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 2
- **source_url**: https://www.percona.com/blog/configure-wiredtiger-cachesize-inside-percona-distribution-for-mongodb-kubernetes-operator/
- **source_url_lang**: en

### symptom_description

> Now login into the shard and check the default memory allocated to the container and to the mongod instance. In below, the memory size available is 15G, but the memory limit to use in this container is 476MB only:

### diagnostic_steps

```
[step 1] 用 db.hostInfo() 查容器 vs 主机内存差异
  metric_name: hostInfo.system.memSizeMB / memLimitMB
  collection_layer: mongo-shell
  collection_method_quote: "rs0:PRIMARY> db.hostInfo()"
  abnormal_pattern_quote: "the memory size available is 15G, but the memory limit to use in this container is 476MB only"
  abnormal_pattern_threshold: memSizeMB ≫ memLimitMB(本例 15006 vs 476)
  metric_unit: MB
  prerequisite_steps: []

[step 2] 读 wiredTiger.cache.maximum bytes configured
  metric_name: wiredTiger.cache."maximum bytes configured"
  collection_layer: mongo-runtime-cmd
  collection_method_quote: "rs0:PRIMARY> db.serverStatus().wiredTiger.cache[\"maximum bytes configured\"]/1024/1024"
  abnormal_pattern_quote: "The cache size of 256MB is too low for the real environment."
  abnormal_pattern_threshold: maximum_bytes_configured = 256MB(回退到最小值)
  metric_unit: MB
  prerequisite_steps: [1]
```

### likely_causes

```
[parameter_causes · cause 1] operator cacheSizeRatio 默认 0.5,容器 memLimitMB 又过小 → 256MB 兜底
  param_name: replsets.storage.wiredTiger.engineConfig.cacheSizeRatio + container resources.limits.memory
  abnormal_value_pattern: cacheSizeRatio=0.5 默认 + memlimit ≤ 1G → 触发 minWiredTigerCacheSizeGB(256MB) 回退
  reasoning_quote: "Here, the memory calculation for WT is done roughly as follows (Memory limit should be more than 1G, else 256MB is allocated by default:(Memory limit – 1G) * cacheSizeRatio"
  linked_diagnostic_step_no: 2

[non_parameter_causes · cause 1] WiredTiger 在 Docker 容器中无法自检测到 cgroup 内存限制
  cause_type: hypervisor-issue
  description_quote: "In normal situations WiredTiger does this default-sizing correctly but under Docker containers WiredTiger fails to detect the memory limit of the Docker container. We explicitly set the WiredTiger cache size to fix this."
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文 yaml 配置块在 .txt 中被 jsdom `<pre><code>` 抽取压平 · 见 reference/inferred-references.md#percona-k8s-operator-cachesizeratio-yaml-flattened)
```


## case_id: mongo-k8s-operator-cachesize-bug-cpu-limit-required-02

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: memory-pressure
- **case_pattern**: core-perf-diagnosis
- **title**: PSMDB operator v1.9 / v1.10 已知 bug · cacheSizeRatio 改了但 mongod 仍按默认 cache 启动
- **source_heading**: (Conclusion 段附录 / K8SPSMDB-603)
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 1
- **source_url**: https://www.percona.com/blog/configure-wiredtiger-cachesize-inside-percona-distribution-for-mongodb-kubernetes-operator/
- **source_url_lang**: en

### symptom_description

> Till PSMDB operator v1.10.0, the operator takes the change of cacheSizeRatio only if the resources.limit.cpu is also set. This is a bug and it got fixed in v1.11.0 – refer https://jira.percona.com/browse/K8SPSMDB-603 . So if you’re in an older version, don’t be surprised and you have to make sure the resources.limit.cpu is set as well.

### diagnostic_steps

```
[step 1] 检查 operator 版本 + cr.yaml 中 cpu limit 是否存在
  metric_name: operator version + replsets.resources.limits.cpu
  collection_layer: os
  collection_method_quote: "$ kubectl get pods"
  abnormal_pattern_quote: "Till PSMDB operator v1.10.0, the operator takes the change of cacheSizeRatio only if the resources.limit.cpu is also set."
  abnormal_pattern_threshold: operator ≤ v1.10 且 cr.yaml 中 cpu limit 缺失或为 0
  metric_unit: string
  prerequisite_steps: []

[step 2] 进 mongod pod 验证 wt cache 实际值
  metric_name: wiredTiger.cache.maximum bytes configured
  collection_layer: mongo-runtime-cmd
  collection_method_quote: "rs0:PRIMARY> db.serverStatus().wiredTiger.cache[\"maximum bytes configured\"]/1024/1024"
  abnormal_pattern_quote: "Till PSMDB operator v1.10.0, the operator takes the change of cacheSizeRatio only if the resources.limit.cpu is also set."
  abnormal_pattern_threshold: yaml cacheSizeRatio 已改但 mongod 实际 cache 与 ratio*memlimit 公式不匹配
  metric_unit: MB
  prerequisite_steps: [1]
```

### likely_causes

```
[non_parameter_causes · cause 1] operator 源码仅在 ResourceCPU.limit 非零时才追加 --wiredTigerCacheSizeGB
  cause_type: application-design
  description_quote: "if limit, ok := resources.Limits[corev1.ResourceCPU]; ok && !limit.IsZero() {<br>args = append(args, fmt.Sprintf(<br>\"--wiredTigerCacheSizeGB=%.2f\",<br>getWiredTigerCacheSizeGB(resources.Limits, replset.Storage.WiredTiger.EngineConfig.CacheSizeRatio, true),<br>))<br>}"
  linked_diagnostic_step_no: 1
  mitigation_quote: "From v1.11.0:" + "if limit, ok := resources.Limits[corev1.ResourceMemory]; ok && !limit.IsZero() {<br>    args = append(args, fmt.Sprintf(<br>       \"--wiredTigerCacheSizeGB=%.2f\",<br>       getWiredTigerCacheSizeGB(resources.Limits, replset.Storage.WiredTiger.EngineConfig.CacheSizeRatio, true),<br>))<br>}"
```


## case_id: mongo-8-0-tcmalloc-percpu-prerequisite-not-met-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: memory-pressure
- **case_pattern**: core-perf-diagnosis
- **title**: MongoDB 8.0 升级后未拿到预期性能提升 · TCMalloc 实际未启用 per-CPU caches
- **source_heading**: Important change for Transparent Huge Pages (THP)
- **diagnostic_steps_count**: 4
- **likely_causes_count**: 3
- **source_url**: https://www.percona.com/blog/memory-management-in-mongodb-8-0-testing-the-new-tcmalloc/
- **source_url_lang**: en

### symptom_description

> MongoDB has used TCMalloc as its default allocator, but version 8.0 includes a major upgrade to a newer implementation aligned with upstream Google TCMalloc changes that uses per-CPU caches, instead of per-thread caches. This brings improved multithreaded scalability, better memory release behavior to the OS, more predictable RSS (Resident Set Size) under heavy workloads.

### diagnostic_steps

```
[step 1] 检查 serverStatus.tcmalloc.usingPerCpuCaches
  metric_name: serverStatus.tcmalloc.usingPerCpuCaches
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 原文给的是判定值"is true / is greater than 0",未给具体读取命令 · 见 reference/inferred-references.md#tcmalloc-percpu-from-serverstatus)
  abnormal_pattern_quote: "tcmalloc.usingPerCpuCaches is true"
  abnormal_pattern_threshold: usingPerCpuCaches != true → 异常(说明回退到 legacy per-thread 实现)
  metric_unit: bool
  prerequisite_steps: []

[step 2] 检查 serverStatus.tcmalloc.tcmalloc.cpu_free
  metric_name: serverStatus.tcmalloc.tcmalloc.cpu_free
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 原文给的是判定值"is greater than 0",未给具体读取命令 · 同 ref)
  abnormal_pattern_quote: "tcmalloc.tcmalloc.cpu_free is greater than 0"
  abnormal_pattern_threshold: cpu_free 不大于 0 → 异常(per-CPU 缓存未真正建立)
  metric_unit: count
  prerequisite_steps: [1]

[step 3] 检查内核版本
  metric_name: uname -r kernel version
  collection_layer: os
  collection_method_quote: (NULL · 原文未给具体读取命令 · 见 reference/inferred-references.md#kernel-version-uname-cross)
  abnormal_pattern_quote: "Kernel version 4.18 or later"
  abnormal_pattern_threshold: 内核版本 < 4.18
  metric_unit: version
  prerequisite_steps: []

[step 4] 检查 THP 是否启用
  metric_name: /sys/kernel/mm/transparent_hugepage/enabled
  collection_layer: os
  collection_method_quote: (NULL · 同 ref · 见 reference/inferred-references.md#thp-read-cat-cross-from-mongodb-doc)
  abnormal_pattern_quote: "THP enabled"
  abnormal_pattern_threshold: (MongoDB 8.0 视角)THP 当前为 `never` → 异常(与 7.0 时代相反!)
  metric_unit: enum
  prerequisite_steps: []
```

### likely_causes

```
[parameter_causes · cause 1] THP 被禁用(legacy 7.0 调优习惯延续到 8.0)
  param_name: kernel.transparent_hugepage
  abnormal_value_pattern: never · 但 mongod 是 8.0+
  reasoning_quote: "If you are a long time user of MongoDB, you probably know that one of the more common best practices for OS tuning was to disable THP. Starting from MongoDB 8.0 the best practice is exactly the opposite: in order to benefit from the new TCMalloc, THP now must be enabled."
  linked_diagnostic_step_no: 4

[non_parameter_causes · cause 1] 内核 < 4.18 不支持 rseq
  cause_type: os-version-bug
  description_quote: "Kernel version 4.18 or later"
  linked_diagnostic_step_no: 3
  mitigation_quote: (NULL · 原文未给升级命令,只列前置条件)

[non_parameter_causes · cause 2] glibc rseq 先注册占用了 rseq 槽位 → TCMalloc 无法使用
  cause_type: os-version-bug
  description_quote: "glibc rseq disabled: if another application, such as the glibc library, registers an rseq structure before TCMalloc, TCMalloc can’t use rseq. Without rseq, TCMalloc uses per-thread caches, which are used by the legacy TCMalloc version."
  linked_diagnostic_step_no: 1
  mitigation_quote: (NULL · 原文未给禁用 glibc rseq 的具体命令)
```


## case_id: mongo-query-ixscan-poor-selectivity-extra-sort-02

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: core-perf-diagnosis
- **title**: 索引存在但 totalDocsExamined ≫ nReturned + 出现独立 SORT stage
- **source_heading**: Example 3
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 2
- **source_url**: https://www.percona.com/blog/mongodb-investigate-queries-with-explain-index-usage-part-2/
- **source_url_lang**: en

### symptom_description

> Let’s return now to the original query. We can also notice that the number of documents examined is still too high (2517) compared to the documents returned (493). That’s not optimal.

### diagnostic_steps

```
[step 1] 用 explain 比较 totalDocsExamined 与 nReturned 的比值
  metric_name: executionStats.totalDocsExamined / executionStats.nReturned
  collection_layer: mongo-shell
  collection_method_quote: "MongoDB > var exp = db.restaurants.explain(\"executionStats\")"
  abnormal_pattern_quote: "the number of documents examined is still too high (2517) compared to the documents returned (493). That’s not optimal."
  abnormal_pattern_threshold: totalDocsExamined / nReturned ≫ 1(原文示例 ≈ 5×)
  metric_unit: ratio
  prerequisite_steps: []

[step 2] 检查 winningPlan 是否含独立 SORT stage
  metric_name: explain.queryPlanner.winningPlan.stage(子节点是否含 SORT)
  collection_layer: mongo-shell
  collection_method_quote: "MongoDB > exp.find( {\"cuisine\" : {$ne : \"American \"}, ... \"grades.grade\" :\"A\", ... \"borough\": \"Brooklyn\"}).sort({\"name\":1})"
  abnormal_pattern_quote: "In this case, we have fewer documents examined but since the cuisine_1 index cannot be used, a SORT stage is needed, and the index used to fetch the document is borough_1. While MongoDB has examined fewer documents, the execution time is worse because of the extra stage used to sort the documents."
  abnormal_pattern_threshold: winningPlan 包含独立 "stage": "SORT" 节点(非索引天然有序)
  metric_unit: enum
  prerequisite_steps: [1]
```

### likely_causes

```
[non_parameter_causes · cause 1] 单字段索引覆盖度不够,需要复合索引(字段顺序按选择性)
  cause_type: application-design
  description_quote: "Let’s see if we can further improve the query by adding another compound index on (cuisine,borough,grades.grade)."
  linked_diagnostic_step_no: 1
  mitigation_quote: "MongoDB > db.restaurants.createIndex({cuisine:1,borough:1,\"grades.grade\":1})"

[non_parameter_causes · cause 2] 排序键不在索引前缀内导致额外 SORT stage
  cause_type: application-design
  description_quote: "There is not a SORT stage because the documents are already extracted using the index, and so they are already sorted."
  linked_diagnostic_step_no: 2
  mitigation_quote: (NULL · 原文未给单独修复命令 · 把排序键纳入索引前缀,与 cause 1 mitigation 同语义)
```


## case_id: mongo-write-regression-default-writeconcern-majority-journal-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: query-slow
- **case_pattern**: core-perf-diagnosis
- **title**: MongoDB 5.0+ 默认 writeConcern=majority 致 JournalFlusher 写盘成为热点
- **source_heading**: Strange behavior + Digging for the truth
- **diagnostic_steps_count**: 3
- **likely_causes_count**: 3
- **source_url**: https://www.percona.com/blog/mongodb-performance-regression-benchmarking-and-the-truth-behind-journaling/
- **source_url_lang**: en

### symptom_description

> A customer had come with a problem in that the write performance dropped drastically after testing their writes between v4.4 and v7.0 as part of their upgrade. So I did tests around this by creating a write load with a million documents inserted into a collection on my system. I have chosen a single-member replicaSet just to keep the environment simple. In MongoDB v4.4, it took 6 minutes with the default settings, but the same set of tests took 127 minutes in v7.0 which was strange for me.

### diagnostic_steps

```
[step 1] 用 Flamegraph 定位 CPU 热点
  metric_name: flamegraph CPU stack profile
  collection_layer: flamegraph
  collection_method_quote: "I collected a Flamegraph (see here-https://github.com/brendangregg/FlameGraph) to see where the CPU resources spend a huge amount of time."
  abnormal_pattern_quote: "Running with the default RW concern values and Flamegraph showed the culprit: the Journal Flusher was causing the long execution. Here is a screenshot of the Flamegraph where JournalFlusher is visible at the bottom left."
  abnormal_pattern_threshold: flamegraph 中 JournalFlusher 函数占据显著比例(对照态:disabled writeConcernMajorityJournalDefault 后 1.52%)
  metric_unit: percent
  prerequisite_steps: []

[step 2] 读取当前 default writeConcern
  metric_name: getDefaultRWConcern.defaultWriteConcern
  collection_layer: mongo-shell
  collection_method_quote: (NULL · 原文给的是 setDefaultRWConcern 修改命令(写入),未给读取版本 · 见 reference/inferred-references.md#getdefaultrwconcern-from-shell)
  abnormal_pattern_quote: "I tested above with the default writeConcern: majority in v7.0 as I was using a single member only and didn’t consider setting writeConcern:1."
  abnormal_pattern_threshold: mongod 版本 ≥ 5.0 且 defaultWriteConcern.w = "majority" 且业务写延迟敏感
  metric_unit: enum
  prerequisite_steps: []

[step 3] 读 rs.conf().writeConcernMajorityJournalDefault
  metric_name: rs.conf().writeConcernMajorityJournalDefault
  collection_layer: mongo-shell
  collection_method_quote: "rs.conf()"
  abnormal_pattern_quote: "If journaling is enabled, w: “majority” may imply j: true. The writeConcernMajorityJournalDefault replica set configuration setting determines the behavior. See Acknowledgment Behavior for details."
  abnormal_pattern_threshold: writeConcernMajorityJournalDefault = true(默认) 且业务对写延迟敏感
  metric_unit: bool
  prerequisite_steps: [2]
```

### likely_causes

```
[parameter_causes · cause 1] default writeConcern 升级后变为 majority
  param_name: defaultWriteConcern.w
  abnormal_value_pattern: 5.0+ 默认 "majority"(对比 4.4 默认 1)
  reasoning_quote: "the default global write concern is changed from 1 to “majority” for the replicaset & sharded cluster environments. ... This changed how MongoDB behaves for every request to maintain the data integrity between the replicaSet members"
  linked_diagnostic_step_no: 2

[parameter_causes · cause 2] writeConcernMajorityJournalDefault=true 隐式 j:true
  param_name: replicaSet.config.writeConcernMajorityJournalDefault
  abnormal_value_pattern: true(默认)
  reasoning_quote: "With j: true, MongoDB returns only after the requested number of members, including the primary, have written to the journal. Previously j: true write concern in a replica set only requires the primary to write to the journal, regardless of the w: <value> write concern."
  linked_diagnostic_step_no: 3

[non_parameter_causes · cause 1] MongoDB 5.0+ 服务端实现使 majority + journaling 形成同步写盘热路径
  cause_type: application-design
  description_quote: "Usually, mongod acknowledges the writes when a majority of the members write into the on-disk journal file."
  linked_diagnostic_step_no: 1
  mitigation_quote: "I did another test while keeping the majority RWConcern and writeConcernMajorityJournalDefault: false in rs.conf() to acknowledge the write operation with writing on memory only instead of waiting until the journal writing into the disk. Usually, mongod acknowledges the writes when a majority of the members write into the on-disk journal file. This time as expected after the change, a million documents were inserted within 10 minutes."
```


## case_id: mongo-wt-checkpoint-time-grows-bulk-load-stall-01

- **entry_kind**: diagnostic-flow
- **db**: mongodb
- **platform**: bare
- **engine**: mongodb
- **symptom_category**: disk-io-saturation
- **case_pattern**: core-perf-diagnosis
- **title**: bulk-load 期间 WiredTiger checkpoint 时间从几秒增至数分钟,期间业务停滞
- **source_heading**: Tuning MongoDB for Bulk Loads(全文主线)
- **diagnostic_steps_count**: 2
- **likely_causes_count**: 4
- **source_url**: https://www.percona.com/blog/tuning-mongodb-for-bulk-loads/
- **source_url_lang**: en

### symptom_description

> What we noticed is the load started at a decent rate, but after some time it started to slow down considerably. Doing some research by looking at metrics, we noticed WiredTiger checkpoint time was increasing more and more as time passed. We went from only a few seconds to checkpoints taking even a few minutes(!). During checkpoints, performance basically tanked:

### diagnostic_steps

```
[step 1] 监测 WiredTiger checkpoint 时间(PMM/趋势工具)
  metric_name: wiredTiger checkpoint duration
  collection_layer: mongo-internal-counter
  collection_method_quote: (NULL · 原文未给具体读取命令,仅说"Doing some research by looking at metrics" + 强调 PMM 趋势 · 见 reference/inferred-references.md#wt-checkpoint-time-from-serverstatus)
  abnormal_pattern_quote: "WiredTiger checkpoint time was increasing more and more as time passed. We went from only a few seconds to checkpoints taking even a few minutes(!). During checkpoints, performance basically tanked:"
  abnormal_pattern_threshold: checkpoint 时长持续上升;原文期望 < 10s 视为合理
  metric_unit: seconds
  prerequisite_steps: []

[step 2] 评估 cache 中脏页规模与 eviction 触发阈值
  metric_name: wiredTiger.cache (eviction_dirty_trigger / eviction_dirty_target context)
  collection_layer: mongo-runtime-cmd
  collection_method_quote: (NULL · 原文段落给的是 setParameter 命令(写入,见 mitigation),未给读取阈值的命令 · 见 reference/inferred-references.md#wt-eviction-config-from-serverstatus)
  abnormal_pattern_quote: "Remember that in a sharp or full checkpoint, all dirty pages have to be flushed to disk. This will use all of your disk write capacity for as long as it takes. That explains the reason why these values have “low” defaults, as we want to limit the amount of work that the database has to do at each checkpoint."
  abnormal_pattern_threshold: dirty 页规模超出磁盘单次 checkpoint 可消化容量
  metric_unit: percent / bytes
  prerequisite_steps: [1]
```

### likely_causes

```
[parameter_causes · cause 1] eviction_dirty_trigger=20 / eviction_dirty_target=5 默认值在大 cache 上仍是巨量
  param_name: wiredTigerEngineRuntimeConfig.eviction_dirty_trigger / eviction_dirty_target
  abnormal_value_pattern: dirty_trigger 默认 20% · dirty_target 默认 5% · 256GB cache 时 1% 即 2.56GB
  reasoning_quote: "These parameters are again, expressed as a percentage of total WiredTiger cache usage. The lowest we can go is 1% (no floating-point values are allowed). 1% can still be quite a lot on a server with a high memory! A 256G cache is not uncommon these days, and 1% of that is 2.56 Gb. To be flushed all at once, one time per minute."
  linked_diagnostic_step_no: 2

[parameter_causes · cause 2] eviction 线程默认 4 个跟不上脏页生成速率
  param_name: wiredTigerEngineRuntimeConfig.eviction.threads_min / threads_max
  abnormal_value_pattern: 默认 threads_min=threads_max=4,bulk-load 下不足
  reasoning_quote: "By default, MongoDB allocates four background threads to perform eviction. ... For this particular case, the default four threads weren’t enough to keep up with the rate of dirty page generation, as evidenced by Percona Monitoring and Management (PMM) graphics:"
  linked_diagnostic_step_no: 1

[non_parameter_causes · cause 1] sharp checkpoint 模型把脏页一次性刷盘,占满写带宽
  cause_type: application-design
  description_quote: "As of MongoDB 4.2, the WiredTiger engine does a full checkpoint every 60 seconds (controlled by checkpoint=(wait=60)). This means that all dirty pages in the WiredTiger cache have to be flushed to disk every 60 seconds."
  linked_diagnostic_step_no: 1
  mitigation_quote: "db.adminCommand( { \"setParameter\": 1, \"wiredTigerEngineRuntimeConfig\": \"eviction=(threads_min=20,threads_max=20),checkpoint=(wait=60),eviction_dirty_trigger=5,eviction_dirty_target=1,eviction_trigger=95,eviction_target=80\"})"

[non_parameter_causes · cause 2] cache 满时应用线程被强制参与 eviction 致延迟飙升
  cause_type: application-design
  description_quote: "If the pressure is too high, and cache usage increases to as high as 95 Gb (eviction_trigger), then application/client threads will be throttled. How? they will be asked to help the background threads perform eviction before being allowed to do their job, helping to relieve some of the pressure, at the expense of increasing latency to the clients. If even this is not enough, and the cache reaches 100% of the configured cache size, operations will stall."
  linked_diagnostic_step_no: 2
  mitigation_quote: "After doing some experiments with the available hardware, we decided to increase the number of eviction threads to the maximum 20, reduce the dirty thresholds to the one to five-percent range, and also set a small WiredTiger cache of 1 Gb, which would limit the number of dirty pages to 10-50 Mb."
```


<!-- ============ Flame-Signature (13 cases) ============ -->

## case_id: linux-fs-mmap-metadata-archiver-01

- **entry_kind**: flame-signature
- **db**: _common
- **platform**: bare
- **scope**: linux-fs
- **signature_type**: stack-pattern
- **match_layer**: stack-frame-pattern
- **title**: Linux FS metadata syscall hotspot in mmap-based archiver workload
- **pattern_regex**: `^(sys_newfstatat\
- **source_url**: https://www.brendangregg.com/FlameGraphs/cpuflamegraphs.html
- **source_authority**: community-canonical
- **source_url_lang**: en

### pattern_quote

> Most of the kernel time is in sys_newfstatat() and sys_getdents(): metadata work as the file system is walked. sys_openat() is on the right, as files are opened to be read, which are then mmap()d (look to the right of sys_getdents(), these are in alphabetical order), and finally page faulted into user-space (see the page_fault() mountain on the left).

### mechanism_quote

> Most of the kernel time is in sys_newfstatat() and sys_getdents(): metadata work as the file system is walked. sys_openat() is on the right, as files are opened to be read, which are then mmap()d (look to the right of sys_getdents(), these are in alphabetical order), and finally page faulted into user-space (see the page_fault() mountain on the left). The actual work of moving bytes is then spent in user-land on the mmap'd segments (and not shown in this kernel flame graph).

### workload_implication_quote

> As an example of a different workload, this shows the Linux kernel CPU time while an ext4 file system was being archived


## case_id: glibc-malloc-allocator-hot-stack-01

- **entry_kind**: flame-signature
- **db**: _common
- **platform**: bare
- **scope**: mem-allocator-glibc
- **signature_type**: stack-pattern
- **match_layer**: stack-frame-pattern
- **title**: glibc malloc allocator tracing hot stack — application allocation code path
- **pattern_regex**: `^(__GI___libc_malloc\
- **source_url**: https://www.brendangregg.com/FlameGraphs/memoryflamegraphs.html
- **source_authority**: community-canonical
- **source_url_lang**: en

### pattern_quote

> __GI___libc_malloc Perl_sv_grow Perl_sv_setpvn Perl_newSVpvn_flags Perl_pp_split Perl_runops_standard

### mechanism_quote

> This is where the memory allocator functions, malloc(), free(), etc, are traced. Imagine you could run Valgrind memcheck with "-p PID" on a process, and gather memory leak statistics for 60 seconds or so. Not a complete picture, but hopefully enough to catch egregious leaks.

### workload_implication_quote

> This tells us that the most malloc() calls were in st_select_lex::optimize() -> JOIN::optimize(). But that's not where most of the bytes were allocated.


## case_id: linux-mm-brk-heap-expansion-01

- **entry_kind**: flame-signature
- **db**: _common
- **platform**: bare
- **scope**: linux-mm
- **signature_type**: function-prefix
- **match_layer**: function
- **title**: brk() syscall hot frame — heap expansion code path
- **pattern_regex**: `^(sys_brk\
- **source_url**: https://www.brendangregg.com/FlameGraphs/memoryflamegraphs.html
- **source_authority**: community-canonical
- **source_url_lang**: en

### pattern_quote

> brk() can be traced via its kernel function, SyS_brk() or sys_brk(), or on 4.14+ kernels via the syscalls:sys_enter_brk tracepoint.

### mechanism_quote

> Many applications grow using brk(). This syscall sets the program break point: the end of the heap segment (aka the process data segment). brk() isn't called by the application directly, but rather the user-level allocator which provides the malloc()/free() interface. Such allocators typically don't give memory back the OS, keeping freed memory as a cache for future allocations. And so, brk() is typically for growth only (not shrinks).

### workload_implication_quote

> What brk() tracing can tell us is the code paths that lead to heap expansion. This could be either: > A memory growth code path A memory leak code path An innocent application code path, that happened to spill-over the current heap size Asynchronous allocator code path, that grew the application in response to diminishing free space


## case_id: linux-mm-mmap-vm-growth-01

- **entry_kind**: flame-signature
- **db**: _common
- **platform**: bare
- **scope**: linux-mm
- **signature_type**: function-prefix
- **match_layer**: function
- **title**: mmap() syscall hot frame — VM mapping growth code path
- **pattern_regex**: `^(sys_mmap\
- **source_url**: https://www.brendangregg.com/FlameGraphs/memoryflamegraphs.html
- **source_authority**: community-canonical
- **source_url_lang**: en

### pattern_quote

> mmap() can be traced via its kernel function, SyS_mmap() or sys_mmap(), or on 4.14+ kernels via the syscalls:sys_enter_mmap tracepoint.

### mechanism_quote

> The mmap() syscall may be explicitly used by the application for loading data files or creating working segments, especially during initialization and application start. In this context, we're interested in creeping application growth, which may occur via mmap() if the allocator uses it instead of brk(). glibc does this for larger allocations, which can be returned to the system using munmap().

### workload_implication_quote

> Unlike brk(), mmap() calls don't necessarily mean growth, as they may be freed shortly after using munmap(). And so tracing mmap() may show many new mappings, but most or all of them are neither growth nor leaks. If your system has frequent short-lived processes (eg, doing a software build), the mmap()s as part of process initialization can flood the trace.


## case_id: linux-mm-page-fault-physical-population-01

- **entry_kind**: flame-signature
- **db**: _common
- **platform**: bare
- **scope**: linux-mm
- **signature_type**: function-prefix
- **match_layer**: function
- **title**: page fault hot frame — physical memory population code path
- **pattern_regex**: `^(handle_mm_fault\
- **source_url**: https://www.brendangregg.com/FlameGraphs/memoryflamegraphs.html
- **source_authority**: community-canonical
- **source_url_lang**: en

### pattern_quote

> Page faults can be dynamically traced via a kernel function, eg, handle_mm_fault(), or on 4.14+ kernels via the tracepoints t:exceptions:page_fault_user and t:exceptions:page_fault_kernel.

### mechanism_quote

> brk() and mmap() tracing show virtual memory expansion. Physical memory is consumed later, when the memory is written to, causing page faults, and virtual to physical mappings to be initialized. This activity can happen in a different code path, and one that may (or may not) be more illuminating.

### workload_implication_quote

> Page fault tracing shows different code paths: those that are populating physical memory. They will be either: > A memory growth code path A memory leak code path


## case_id: linux-block-offwake-disk-io-block-completion-01

- **entry_kind**: flame-signature
- **db**: _common
- **platform**: bare
- **scope**: linux-block
- **signature_type**: stack-pattern
- **match_layer**: stack-frame-pattern
- **title**: Off-Wake flame graph stack chain: disk I/O block completion interrupt waking blocked vfs_read()
- **pattern_regex**: `^(blkif_interrupt\
- **source_url**: https://www.brendangregg.com/FlameGraphs/offcpuflamegraphs.html
- **source_authority**: community-canonical
- **source_url_lang**: en

### pattern_quote

> blkif_interrupt __blk_mq_complete_request blk_mq_end_request blk_update_request mpage_end_io wake_up_page_bit __wake_up_common autoremove_wake_function -- -- finish_task_switch __schedule schedule io_schedule generic_file_read_iter __vfs_read vfs_read SyS_pread64 entry_SYSCALL_64_fastpath __GI___libc_pread

### mechanism_quote

> As an intermediate and more practical step, I began by associating off-CPU stacks with a single wakeup stack. This is my offwaketime bcc/eBPF tool.

### workload_implication_quote

> Zoom into the do_command() function (use Search on the top right, if you can't find it) and you can see the block I/O completion interrupts waking up our vfs_read() stacks.


## case_id: wt-evict-cold-page-compact-cure-01

- **entry_kind**: flame-signature
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **signature_type**: stack-pattern
- **match_layer**: stack-frame-pattern
- **title**: WiredTiger 冷数据 evict 后 checkpoint 不再处理 · compact 触发 reconciliation 强制回收
- **pattern_regex**: `(compact\
- **source_url**: https://github.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/blob/main/%E7%A3%81%E7%9B%98%E7%A9%BA%E9%97%B4%E6%B3%84%E6%BC%8F%E5%AE%9E%E9%AA%8C%E7%BB%93%E6%9E%9C%E5%88%86%E6%9E%90.md
- **source_authority**: community-canonical
- **source_url_lang**: zh-cn
- **inferred_fields**: mechanism_zh, workload_implication_zh, pattern_regex, hotness_threshold, case_id, title

### pattern_quote

> 删除操作： - DELETE冷数据时 - 需要读取page到内存 - 删除后可能被evict（因为是冷数据） - 后续没有访问 - 🔥 Page不再进入内存 - 🔥 Checkpoint不会处理 - 🔥 磁盘空间不会被回收 > 解决： db.runCommand({compact: "collection"}) - 强制读取所有page - 触发reconciliation - 清理过时数据

### mechanism_quote

> 访问模式： - 热数据：最近1小时的数据（在cache中） - 温数据：最近1天的数据（偶尔在cache中） - 冷数据：7天前的数据（永远不在cache中）

### workload_implication_quote

> ### 为什么生产环境会有问题？ > ``` 生产环境特点： - Cache: 几GB - 数据: 几百GB到几TB - Cache只能容纳1-5%的数据 - 大部分数据在磁盘上


## case_id: wt-app-thread-evict-assist-pressure-01

- **entry_kind**: flame-signature
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **signature_type**: function-prefix
- **match_layer**: function
- **title**: WiredTiger 应用线程被迫参与 eviction 助手(cache 使用率超阈值压力 signature)
- **pattern_regex**: `^__wt_cache_eviction_.*`
- **source_url**: https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/MongoDB%E5%9C%A8%E7%BA%BF%E8%B0%83%E6%95%B4cache_size%E6%85%A2%E7%9A%84%E6%B7%B1%E5%BA%A6%E5%88%86%E6%9E%90.md
- **source_authority**: community-canonical
- **source_url_lang**: zh-cn
- **inferred_fields**: mechanism_zh, workload_implication_zh, pattern_regex, hotness_threshold, database_version_min, database_version_max

### pattern_quote

> * __wt_cache_eviction_check -- * 如果 cache 使用量超过阈值，阻塞应用线程， * 强制其参与 eviction

### mechanism_quote

> 如果 cache 使用量超过阈值，阻塞应用线程， 强制其参与 eviction

### workload_implication_quote

> 总耗时: 几百毫秒到几秒


## case_id: wt-evict-reconcile-blocked-ebusy-01

- **entry_kind**: flame-signature
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **signature_type**: stack-pattern
- **match_layer**: stack-frame-pattern
- **title**: WiredTiger eviction reconcile 被多重 EBUSY 阻碍(__evict_review → __evict_reconcile 链路热点)
- **pattern_regex**: `^__evict_(review\
- **source_url**: https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/MongoDB%E5%9C%A8%E7%BA%BF%E8%B0%83%E6%95%B4cache_size%E6%85%A2%E7%9A%84%E6%B7%B1%E5%BA%A6%E5%88%86%E6%9E%90.md
- **source_authority**: community-canonical
- **source_url_lang**: zh-cn
- **inferred_fields**: mechanism_zh, workload_implication_zh, pattern_regex, hotness_threshold, database_version_min, database_version_max

### pattern_quote

> // ⚠️ 关键检查: 页面是否可以被逐出？ WT_ERR(__evict_review(session, ref, flags, &inmem_split)); > // 🔥 如果页面是脏的，需要 reconcile if (!tree_dead && __wt_page_is_modified(page)) WT_ERR(__evict_reconcile(session, ref, flags)); // ← 耗时操作！

### mechanism_quote

> * __evict_reconcile -- * 对页面进行 reconcile（对账），准备写入磁盘 * * 这是 eviction 过程中最耗时的操作！

### workload_implication_quote

> Eviction 线程尝试逐出 → 返回 EBUSY


## case_id: wt-capacity-throttle-cond-signal-crash-01

- **entry_kind**: flame-signature
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **signature_type**: stack-pattern
- **match_layer**: stack-frame-pattern
- **title**: WiredTiger io_capacity 配置语法错误后,后台 eviction 线程经 capacity_throttle 调用 __wt_cond_signal 解引用 NULL capacity_cond 触发 SIGSEGV
- **pattern_regex**: `(__wt_capacity_throttle\
- **source_url**: https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/MongoDB_io_capacity_crash%E5%AE%8C%E6%95%B4%E4%BF%AE%E5%A4%8D%E6%96%B9%E6%A1%88.md
- **source_authority**: community-canonical
- **source_url_lang**: zh-cn
- **inferred_fields**: mechanism_zh, workload_implication_zh, pattern_regex, hotness_threshold, database_version_min, database_version_max

### pattern_quote

> T9: __wt_capacity_throttle() 被调用 ↓ T10: __capacity_signal() 尝试发送信号 ↓ T11: __wt_cond_signal(conn->capacity_cond)

### mechanism_quote

> T5: capacity_cond条件变量未正确创建或保持为NULL

### workload_implication_quote

> T13: 💥 Segmentation Fault!


## case_id: wt-reconcile-row-tombstone-skip-01

- **entry_kind**: flame-signature
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **signature_type**: stack-pattern
- **match_layer**: stack-frame-pattern
- **title**: WiredTiger reconcile 在 row leaf 上跳过全局可见 stop_ts 的 key(磁盘清理读-判-跳路径 signature)
- **pattern_regex**: `^(__wt_row_leaf_value_cell\
- **source_url**: https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/%E7%A3%81%E7%9B%98%E5%B7%B2%E6%8C%81%E4%B9%85%E5%8C%96%E6%95%B0%E6%8D%AE%E7%9A%84%E6%B8%85%E7%90%86%E4%BB%A3%E7%A0%81%E8%B7%AF%E5%BE%84.md
- **source_authority**: community-canonical
- **source_url_lang**: zh-cn
- **inferred_fields**: mechanism_zh, workload_implication_zh, pattern_regex, hotness_threshold, database_version_min, database_version_max

### pattern_quote

> if (upd == NULL && __wt_txn_tw_stop_visible_all(session, twp))

### mechanism_quote

> 如果我们 reconcile 一个磁盘上的 key，该 key 有一个全局可见的 stop 时间点，

### workload_implication_quote

> 结果：这个 key 不会被写入新的磁盘页面


## case_id: wt-reconcile-write-wrapup-block-free-01

- **entry_kind**: flame-signature
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **signature_type**: function-prefix
- **match_layer**: function
- **title**: WiredTiger reconcile 写入 wrapup 阶段释放旧页面磁盘块(block manager free-list 入队 signature)
- **pattern_regex**: `^(__rec_write_wrapup\
- **source_url**: https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/%E7%A3%81%E7%9B%98%E5%B7%B2%E6%8C%81%E4%B9%85%E5%8C%96%E6%95%B0%E6%8D%AE%E7%9A%84%E6%B8%85%E7%90%86%E4%BB%A3%E7%A0%81%E8%B7%AF%E5%BE%84.md
- **source_authority**: community-canonical
- **source_url_lang**: zh-cn
- **inferred_fields**: mechanism_zh, workload_implication_zh, pattern_regex, hotness_threshold, database_version_min, database_version_max

### pattern_quote

> __wt_btree_block_free(WT_SESSION_IMPL *session, const uint8_t *addr, size_t addr_size)

### mechanism_quote

> * Helper function to free a block from the current tree.

### workload_implication_quote

> 后续写入优先使用 free list 中的块


## case_id: wt-reconcile-row-leaf-tombstone-not-globally-visible-01

- **entry_kind**: flame-signature
- **db**: mongodb
- **platform**: bare
- **scope**: storage-engine-wt
- **signature_type**: stack-pattern
- **match_layer**: stack-frame-pattern
- **title**: WiredTiger 行叶页 reconcile 路径下 tombstone 非全局可见 → 已删除数据被整页保留(oldest_timestamp 推进不足 signature)
- **pattern_regex**: `^(__wti_rec_row_leaf\
- **source_url**: https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/%E4%B8%BA%E4%BB%80%E4%B9%88%E5%B7%B2%E5%88%A0%E9%99%A4%E6%95%B0%E6%8D%AE%E4%BB%8D%E5%9C%A8%E6%96%87%E4%BB%B6%E4%B8%AD_%E6%B7%B1%E5%BA%A6%E5%88%86%E6%9E%90.md
- **source_authority**: community-canonical
- **source_url_lang**: zh-cn
- **inferred_fields**: mechanism_zh, workload_implication_zh, pattern_regex, hotness_threshold, database_version_min, database_version_max

### pattern_quote

> // __wti_rec_row_leaf() - 行叶页 reconciliation > /* For each entry in the page... */ WT_ROW_FOREACH (page, rip, i) { // 遍历页面中的每一行 > /* Look for an update. */ WT_ERR(__wti_rec_upd_select(session, r, NULL, rip, vpack, &upd_select)); upd = upd_select.upd; > // 对于每个 key 单独判断 if (upd == NULL && __wt_txn_tw_stop_visible_all(session, twp)) upd = &upd_tombstone; // 这个 key 可以跳过 > if (upd->type == WT_UPDATE_TOMBSTONE) goto leaf_insert; // 跳过这个 key > // 否则写入这个 key __wti_rec_image_copy(session, r, key); __wti…

### mechanism_quote

> Reconciliation 逻辑： - 遍历整个页面的所有 key - 只要有任何一个 key 的 tombstone 不是全局可见 - 整个页面都会被保留（包括那些很旧的 key）

### workload_implication_quote

> 结果： - Z=4 虽然很旧，但和 Z=1997571 在同一页 - Z=1997571 不能删除（仍在窗口内） - → 整个页面被保留 - → Z=4 也被保留

