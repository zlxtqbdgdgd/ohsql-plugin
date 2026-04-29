# 参数采集清单 · KB 关心的参数 vs 现 collect-cmds 覆盖度

> 输入:
> - `plugins/perf-kp-sql/data/knowledge.sqlite` · `case_param_names` 表(179 unique `param_name`)
> - `plugins/perf-kp-sql/data/collect-cmds.json` · `osBatchCmd` + `dbBatchTemplates.mongo`
>
> 目标: 路径 A(配置审计)依赖 `snapshot.config_dump.<param>`,KB 关心的参数必须在 collect-cmds 中真采到,否则规则永远不命中。

---

## 汇总

- **KB 总 unique `param_name`**: 179
- **清洗后 well-formed**: 96(同义合并/去重后,见 §A+§B)
- **非 db 类**: 47 — 已采 17 · 未采 30
- **db 类**: 49 — 已采 28 · 未采 21(其中 5 是 client-side 不可远程采)
- **噪音 / 不采集**: 83(原 param_name 含中文描述、并列符号、命令行 flag、应用层并发参数等)
- **建议补全采集点**: **30**(osBatchCmd `+22` + dbBatchTemplates.mongo `+8`),其中 client-side 5 项不补、需在报告侧标注「应用层」

---

## A · 非 db (sysctl / proc / sys / 文件系统 / BIOS / IRQ / boot cmdline / 资源限制)

> "已采?" 列符号: ✅ 已直接采集 · ◐ 间接覆盖(信息已在 osBatchCmd 输出中, parser 可拆) · ❌ 未采

### A1. sysctl 类 (`vm.* / net.* / kernel.* / fs.*`)

| 参数 | KB 引用 | 已采? | 现采集命令 / 建议补充 |
|---|---:|:---:|---|
| `vm.swappiness` | 3 | ✅ | `cat /proc/sys/vm/swappiness` (osBatchCmd `###SWAP###`) |
| `vm.dirty_ratio` | 2 + 1 | ✅ | `sysctl -n vm.dirty_ratio` (`###DIRTYRATIO###`) |
| `vm.dirty_background_ratio` | 2 + 1 | ✅ | `sysctl -n vm.dirty_background_ratio` (`###DIRTYBGRATIO###`) |
| `vm.zone_reclaim_mode` | 1 | ✅ | `###VM_ZONE_RECLAIM###` |
| `vm.max_map_count` | 1 | ✅ | `###VM_MAX_MAP_COUNT###` |
| `vm.nr_hugepages` | 1 | ✅ | `cat /proc/sys/vm/nr_hugepages` (`###HUGEPAGES###`) |
| `vm.transparent_hugepage` (alias of THP) | 1 | ✅ | `cat /sys/kernel/mm/transparent_hugepage/enabled` (`###THP###`) |
| `kernel.transparent_hugepage` (同上) | 2 | ✅ | 同 `###THP###` |
| `net.core.somaxconn` | 4 | ✅ | `sysctl -n net.core.somaxconn` (`###SOMAXCONN###`) |
| `net.ipv4.tcp_keepalive_time` | 4 | ✅ | `sysctl -n net.ipv4.tcp_keepalive_time` (`###TCPKEEPALIVE###`) |
| `net.ipv4.tcp_max_syn_backlog` | 3 | ✅ | `###TCP_MAX_SYN_BACKLOG###` |
| `net.core.netdev_max_backlog` | 2 | ❌ | **建议补**: `sysctl -n net.core.netdev_max_backlog` |
| `net.ipv4.tcp_max_tw_buckets` | 3 | ❌ | **建议补**: `sysctl -n net.ipv4.tcp_max_tw_buckets` |
| `net.ipv4.tcp_fin_timeout` | 2 | ❌ | **建议补**: `sysctl -n net.ipv4.tcp_fin_timeout` |
| `net.ipv4.tcp_tw_reuse` | 2 | ❌ | **建议补**: `sysctl -n net.ipv4.tcp_tw_reuse` |
| `net.ipv4.ip_local_port_range` | 2 | ❌ | **建议补**: `sysctl -n net.ipv4.ip_local_port_range` |
| `net.core.rmem_max` | 1 | ❌ | **建议补**: `sysctl -n net.core.rmem_max` |
| `net.core.wmem_max` | 1 | ❌ | **建议补**: `sysctl -n net.core.wmem_max` |
| `net.ipv4.tcp_rmem` | 1 | ❌ | **建议补**: `sysctl -n net.ipv4.tcp_rmem` |
| `net.ipv4.tcp_wmem` | 1 | ❌ | **建议补**: `sysctl -n net.ipv4.tcp_wmem` |
| `vm.dirty_writeback_centisecs` | 1 | ❌ | **建议补**: `sysctl -n vm.dirty_writeback_centisecs` |
| `vm.dirty_expire_centisecs` (`/proc/sys/vm/dirty_expire_centisecs`) | 1 | ❌ | **建议补**: `sysctl -n vm.dirty_expire_centisecs` |
| `vm.force_cgroup_v2_swappiness` | 1 | ❌ | **建议补**(可能不存在): `sysctl -n vm.force_cgroup_v2_swappiness 2>/dev/null \|\| echo na` |

### A2. /sys/block · /sys/kernel · /sys/class/net (per-device)

| 参数 | KB 引用 | 已采? | 现采集命令 / 建议补充 |
|---|---:|:---:|---|
| `/sys/block/<dev>/queue/scheduler` (I/O 调度器) | 3 + 1 + 1 | ✅ | osBatchCmd 已含 `cat /sys/block/{vda,sda,nvme0n1}/queue/scheduler`(白名单) · **建议改通配** |
| `/sys/block/<dev>/queue/nr_requests` | 2 | ❌ | **建议补**: `for q in /sys/block/*/queue; do echo "BLOCK[${q}]nr_requests=$(cat $q/nr_requests)"; done` |
| `/sys/block/<dev>/queue/read_ahead_kb` | 1 + 1 + 1(`block_device.read_ahead_kb` / `blockdev` / `readahead`) | ❌ | **建议补**: `for q in /sys/block/*/queue; do echo "BLOCK[${q}]read_ahead_kb=$(cat $q/read_ahead_kb)"; done` |
| `/sys/kernel/mm/transparent_hugepage/enabled` | 1 | ✅ | 同 `###THP###` |
| `/sys/kernel/mm/transparent_hugepage/defrag` | 1 | ❌ | **建议补**: `cat /sys/kernel/mm/transparent_hugepage/defrag` |
| `/sys/class/net/<nic>/queues/rx-0/rps_cpus` | 1 | ❌ | **建议补**: `for n in /sys/class/net/*/queues/rx-0/rps_cpus; do echo "RPS[$n]=$(cat $n)"; done` |
| `/sys/class/net/<nic>/queues/rx-0/rps_flow_cnt` + `/proc/sys/net/core/rps_sock_flow_entries` | 1 | ❌ | **建议补**: 同上 + `sysctl -n net.core.rps_sock_flow_entries` |

### A3. IRQ / 中断亲和

| 参数 | KB 引用 | 已采? | 现采集命令 / 建议补充 |
|---|---:|:---:|---|
| `irqbalance.service` 状态 | 1 + 1 | ✅ | `systemctl is-active irqbalance` (`###IRQBALANCE###`) |
| `/proc/irq/<N>/smp_affinity` / `smp_affinity_list` | 1 + 1 + 1 | ❌ | **建议补**: `for f in /proc/irq/*/smp_affinity_list; do echo "IRQ[$f]=$(cat $f 2>/dev/null)"; done \| head -50` (限输出量) |

### A4. boot cmdline / kernel 编译选项

| 参数 | KB 引用 | 已采? | 现采集命令 / 建议补充 |
|---|---:|:---:|---|
| `nohz` (kernel boot cmdline) | 1 | ✅ | `###NOHZ_CMDLINE###` (grep `nohz=` /proc/cmdline) |
| `default_hugepagesz` / `hugepagesz` (boot cmdline) | 1 + 1 + 1 | ❌ | **建议补**: `grep -oE '(default_)?hugepagesz=[^ ]+' /proc/cmdline \|\| echo none` |
| `Linux kernel Page size` 编译选项 | 1 | ✅ | `getconf PAGESIZE` (`###PAGESIZE###`) |
| `sched_steal_node_limit` boot cmdline | (隐含 `cpu_steal`) | ✅ | `###SCHED_STEAL###` |
| `/sys/kernel/debug/sched_features` | (隐含) | ✅ | `###SCHED_FEATURES###` |

### A5. 文件系统 / 挂载 / 块设备

| 参数 | KB 引用 | 已采? | 现采集命令 / 建议补充 |
|---|---:|:---:|---|
| `(deployment) dbPath 挂载点文件系统` | 2 | ❌ | **建议补**(需先拿到 dbPath, 见 D1.5): `df -T <dbPath>` + `findmnt -no FSTYPE,OPTIONS <dbPath>` |
| `filesystem type (mkfs.xfs vs ext4)` | 1 | ❌ | 同上(`findmnt -no FSTYPE`) |
| `mount.options.noatime` | 1 | ❌ | 同上(`findmnt -no OPTIONS` 后 grep `noatime`) |
| `mount.options.nobarrier` / `mount option · barrier` | 1 + 1 | ❌ | 同上(`findmnt -no OPTIONS` 后 grep `barrier`) |
| `mkfs.xfs -b size=` | 1 + 1(`-b size`) | ❌ | **建议补**: `xfs_info <dbPath> 2>/dev/null \|\| tune2fs -l <devnode> 2>/dev/null` (XFS 看 `bsize=`) |
| `fstab` | 1 | ◐ | 间接(`findmnt` 输出与 fstab 等价 · 不必再读 fstab) |
| `nfs mount options` | 1 | ◐ | 同 `findmnt`(若挂的是 nfs 自然显示) |

### A6. BIOS / 硬件 / 虚拟化

| 参数 | KB 引用 | 已采? | 现采集命令 / 建议补充 |
|---|---:|:---:|---|
| `bios.advanced.misc_config.cpu_prefetching_configuration` | 2 | ❌ | **建议补**: `dmidecode -t bios -t processor 2>/dev/null \| grep -iE 'prefetch'` (需 root · 可能无值) |
| `bios.advanced.misc_config.support_smmu` | 2 | ❌ | **建议补**: `dmesg \| grep -iE 'smmu\|iommu'`(已有 dmesg 段, 可加 keyword) + `cat /sys/class/iommu/*/type 2>/dev/null` |
| `KVM reservation` / `vcpu placement` / `emulatorpin` / `libvirt.domain.cputune.vcpupin` / `libvirt.domain.memoryBacking.hugepages` / `virtio-balloon` | 6 项 | ◐ | osBatchCmd 已含 `systemd-detect-virt`(`###VIRT###`) · 但 libvirt domain XML 是宿主机端事 · **现场 mongod 端拿不到 · 标"宿主机侧 · 不可在 guest 内远程审计"** |

### A7. 进程绑核 / NUMA / CPU 调度

| 参数 | KB 引用 | 已采? | 现采集命令 / 建议补充 |
|---|---:|:---:|---|
| `numactl` / `numactl --interleave=all` (启动 mongod 时) | 1 + 1 | ◐ | mongod 这种由 `db.adminCommand({getCmdLineOpts:1}).argv[0]` 看不出(numactl 包装在 systemd ExecStart) · **建议补**: `ps -p $(pgrep -o mongod) -o args=` 看完整启动行 |
| `cpuset` / `taskset` | 1 | ◐ | **建议补**: `cat /proc/$(pgrep -o mongod)/status \| grep -iE 'Cpus_allowed_list\|Mems_allowed_list'` |
| `tuned profile` / `tuned.profile` | 1 + 1 | ❌ | **建议补**: `tuned-adm active 2>/dev/null \|\| echo no-tuned` |

### A8. 资源限制 / 编译时优化 / glibc

| 参数 | KB 引用 | 已采? | 现采集命令 / 建议补充 |
|---|---:|:---:|---|
| `/etc/security/limits.conf 中各 ulimit 项` / `nofile` / `nproc` / `stack` | 1 + 1 + 1 + 1 | ❌ | **建议补**: `cat /proc/$(pgrep -o mongod)/limits 2>/dev/null` (Real effective limits 比 limits.conf 静态更准) |
| `LSE` / `atomics` | 3 + 1 | ✅ | osBatchCmd `###LSE_CPU###` (lscpu Flags) + `###LSE_MONGOD###` / `###LSE_MYSQLD###` (nm symbols) + `###LSE_DMESG###` |
| `-march=armv8-a` / `-march=armv8.2-a` / `-moutline-atomics` | 1 + 1 + 1 | ◐ | 这些是**编译选项** · 二进制级唯一可见证据就是 LSE symbols(已采 nm) · **不可直接采编译 flag · 由 LSE 推断** |
| `GLIBC_TUNABLES` (env) | 1 | ❌ | **建议补**: `cat /proc/$(pgrep -o mongod)/environ 2>/dev/null \| tr '\\0' '\\n' \| grep -E '^(GLIBC_TUNABLES\|MALLOC_\|TCMALLOC_)'` |
| `TCMALLOC_AGGRESSIVE_DECOMMIT` (env) | 1 | ❌ | 同上(同一条 environ 命令覆盖) |

---

## B · db (mongo config / WiredTiger / driver client option / runtime command)

> mongo 配置主要靠 `db.adminCommand({getCmdLineOpts:1})` 一次性拿到 yaml 解析后的全树(在 `.parsed` 字段)。
> 凡是 `storage.* / net.* / replication.* / operationProfiling.* / security.* / systemLog.* / setParameter.* / auditLog.*` 都已被覆盖。

### B1. mongo 静态配置(getCmdLineOpts.parsed.* 全覆盖)

| 参数 | KB 引用 | 已采? | 备注 |
|---|---:|:---:|---|
| `storage.dbPath` / `dbPath` | 3 + 2 | ✅ | `gco.parsed.storage.dbPath` |
| `storage.engine` | 1 | ✅ | `gco.parsed.storage.engine` |
| `storage.directoryPerDB` | 1 | ✅ | `gco.parsed.storage.directoryPerDB` |
| `storage.syncPeriodSecs` | 1 | ✅ | `gco.parsed.storage.syncPeriodSecs` |
| `storage.journal.enabled` | 2 | ✅ | `gco.parsed.storage.journal.enabled` |
| `storage.journal.commitIntervalMs` | 2 | ✅ | `gco.parsed.storage.journal.commitIntervalMs` |
| `storage.wiredTiger.engineConfig.cacheSizeGB` | 4 + 2 + 1 | ✅ | `gco.parsed.storage.wiredTiger.engineConfig.cacheSizeGB` |
| `storage.wiredTiger.engineConfig.cacheSizePct` | 2 | ✅ | 同上 cacheSizePct |
| `storage.wiredTiger.engineConfig.configString` | 2 + 2 + 1 + 1 (含 `eviction_*` / `io_capacity` / `verbose`) | ✅ | `gco.parsed.storage.wiredTiger.engineConfig.configString` (字符串需正则解析子项) |
| `storage.wiredTiger.engineConfig.directoryForIndexes` | 1 | ✅ | gco |
| `storage.wiredTiger.collectionConfig.blockCompressor` | 3 | ✅ | osBatchCmd 已专门解析 `blockCompressor`(2 路径 fallback) |
| `storage.wiredTiger.indexConfig.prefixCompression` | 1 | ✅ | gco |
| `storage.inMemory.engineConfig.inMemorySizeGB` | 1 | ✅ | gco |
| `net.maxIncomingConnections` / `maxIncomingConnections` | 1 + 1 | ✅ | `gco.parsed.net.maxIncomingConnections` |
| `net.bindIp` | 1 | ✅ | `gco.parsed.net.bindIp` |
| `net.compression.compressors` | 1 | ✅ | gco |
| `net.serviceExecutor` | 1 | ✅ | gco |
| `replication.replSetName` | 1 | ✅ | gco |
| `replication.oplogSizeMB` | 1 | ✅ | gco · 也可由 oplog window 计算 |
| `operationProfiling.mode` | 1 | ✅ | gco |
| `operationProfiling.slowOpThresholdMs` | 2 + 1 | ✅ | gco · runtime 值另见 B4 `db.getProfilingStatus()` |
| `operationProfiling.slowOpSampleRate` | 1 | ✅ | gco |
| `security.enableEncryption` / `security.encryptionCipherMode` | 2 | ✅ | gco |
| `auditLog.destination` / `format` / `localAuditKeyFile` / `auditEncryptionKeyIdentifier` | 4 | ✅ | gco |
| `systemLog.destination` / `path` / `logAppend` / `logRotate` / `quiet` | 5 | ✅ | gco |

### B2. WiredTiger runtime config / setParameter

| 参数 | KB 引用 | 已采? | 现采集命令 / 建议补充 |
|---|---:|:---:|---|
| `wiredTigerEngineRuntimeConfig` (动态字符串) | 1 + 1 + 1 (含 `eviction.threads_*` / `eviction_dirty_*` / `checkpoint.wait` / `log_size`) | ◐ | dbBatchTemplates 当前**只**为 blockCompressor 拉了一次 · **建议改为完整 dump**: `db.adminCommand({getParameter:1, wiredTigerEngineRuntimeConfig:1})` 输出完整字符串供路径 A 正则匹配 `eviction_*` / `checkpoint=*` / `io_capacity` |
| `wiredTiger.cache.eviction_updates_trigger` / `eviction_updates_target` | 1 | ❌ | 包含在上面 runtimeConfig 字符串 · **同 B2.1 一并解决** |
| `wiredTiger.engineConfig.memory_page_max` | 1 | ❌ | 同 runtimeConfig |
| `wiredTigerCacheSizeGB` (alias) / `wiredTigerCacheSizePct` | 2 + 1 | ✅ | `getParameter` setParameter alias · 也存在于 gco · **建议同时拉 runtime**: `db.adminCommand({getParameter:1, wiredTigerCacheSizeGB:1, wiredTigerCacheSizePct:1})` |
| `wiredTigerConcurrentReadTransactions` | 1 | ❌ | **建议补**: `db.adminCommand({getParameter:1, wiredTigerConcurrentReadTransactions:1})` |
| `wiredTigerConcurrentWriteTransactions` | 1 | ❌ | 同上 |
| `storageEngineConcurrentReadTransactions` / `storageEngineConcurrentWriteTransactions` | 1 | ❌ | **建议补**: `db.adminCommand({getParameter:1, storageEngineConcurrentReadTransactions:1, storageEngineConcurrentWriteTransactions:1})` (5.0+ 优先于 wiredTigerConcurrent*) |
| `setParameter.cursorTimeoutMillis` | 1 | ❌ | **建议补**: `db.adminCommand({getParameter:1, cursorTimeoutMillis:1})` |
| `setParameter.transactionLifetimeLimitSeconds` | 1 | ❌ | **建议补**: `db.adminCommand({getParameter:1, transactionLifetimeLimitSeconds:1})` |
| `setParameter.minSnapshotHistoryWindowInSeconds` | 1 + 1 | ❌ | **建议补**: 同上 `getParameter:1, minSnapshotHistoryWindowInSeconds:1` |
| `setParameter.maxTargetSnapshotHistoryWindowInSeconds` | 1 | ❌ | 同上 |
| `setParameter.tcmallocAggressiveMemoryDecommit` | 1 | ❌ | **建议补**: `getParameter:1, tcmallocAggressiveMemoryDecommit:1` |
| `internalQueryFrameworkControl` | 1 | ❌ | **建议补**: `getParameter:1, internalQueryFrameworkControl:1` |
| `flowControlTargetLagSeconds` | 1 | ❌ | **建议补**: `getParameter:1, flowControlTargetLagSeconds:1` |

### B3. replSet / writeConcern 配置

| 参数 | KB 引用 | 已采? | 现采集命令 / 建议补充 |
|---|---:|:---:|---|
| `replicaSet.config.writeConcernMajorityJournalDefault` | 1 + 1 | ❌ | **建议补**: `rs.conf()` 即 `db.adminCommand({replSetGetConfig:1})` |
| `defaultWriteConcern.w` | 1 + 1 | ❌ | 同 `replSetGetConfig` 输出的 `settings.getLastErrorDefaults` 或 `getDefaultRWConcern` · **建议补**: `db.adminCommand({getDefaultRWConcern:1})` |

### B4. profiling runtime

| 参数 | KB 引用 | 已采? | 现采集命令 / 建议补充 |
|---|---:|:---:|---|
| `slowms` (runtime) / `--slowms` / `--profile` | 2 + 1 + 1 | ❌ | **建议补**: `db.getProfilingStatus()` (返回 `{ was, slowms, sampleRate }`) — 区别于配置文件静态值,反映 admin 在线 setProfilingLevel 的实际 runtime |
| `sampleRate` | 1 | ❌ | 同 `db.getProfilingStatus().sampleRate` |
| `slowOpThresholdMs` (Atlas 动态 vs fixed 100) | 1 | ◐ | 同 `getProfilingStatus()` (Atlas-managed 时由 Atlas 写入,本地仍可读) |

### B5. driver client-side / 应用层 (path A 远程不可采 · 报告侧标"应用配置侧")

| 参数 | KB 引用 | 已采? | 处理 |
|---|---:|:---:|---|
| `maxPoolSize` | 4 | ❌ | **client-side · 不可远程采**(由应用 SDK URI 设置) · 但可侧面观察:`db.serverStatus().connections.current/active` + `db.runCommand({connPoolStats:1})` 推断池上限 |
| `minPoolSize` | 3 | ❌ | 同上 client-side |
| `socketTimeoutMS` | 3 | ❌ | 同上 client-side |
| `connectTimeoutMS` | 2 | ❌ | 同上 client-side |
| `serverSelectionTimeoutMS` (KB 未直接出现 · 相关) | — | — | — |
| `maxIdleTimeMS` | 1 | ❌ | client-side |
| `maxTimeMS` | 1 | ❌ | client-side(per-query) · 仅可在 `currentOp` 看到具体 op 携带值 |
| `waitQueueTimeoutMS` | 1 | ❌ | client-side |
| `expireAfterSeconds` (TTL index) | 1 | ◐ | **建议补 (per-collection)**: 一次性扫所有库的 TTL index — 但开销大 · 可作为 opt-in 探针 |
| `memLimitMB` | 1 | ◐ | (通常是 cgroup limit · 已在 path B 监控) · 可由 `cat /sys/fs/cgroup/memory/memory.limit_in_bytes` 或 `cat /sys/fs/cgroup/memory.max` 拿到 — **建议补到 osBatchCmd** |

---

## C · 噪音 / 不入采集(共 83 条)

按类型归并。这些原 `param_name` 是 distill 阶段抽取的**非结构化片段**,不应进入 path A 的字典。

### C1. 中文描述包裹的"应用启动方式 / 应用配置"(8 条)

| 原 param_name(节选) | 处理 |
|---|---|
| `(非操作系统参数,而是**应用启动方式**或**应用配置**) numactl -C / sched_setaffinity / 应用配置中的 worker_cpu_affinity` | 跳过(混合体) |
| `(deployment) dbPath 挂载点文件系统` | 已在 §A5 拆解 |
| `kernel transparent_hugepage/enabled(可通过 systemd / init.d / kernel boot param 启用)` | 同 `###THP###` |
| `block device queue/read_ahead_kb(udev ATTR{bdi/read_ahead_kb})` | 已在 §A2 拆解 |
| `wiredTiger.engineConfig.memory_page_max(诊断专用 · 实际生产不应调)` | 已在 §B2 拆 · 注释保留 |
| `defaultWriteConcern.w(及业务调用侧 write concern)` | 已在 §B3 拆 |
| `slowOpThresholdMs (Atlas-managed dynamic / fixed 100ms)` | 已在 §B4 拆 |
| `TCMALLOC_AGGRESSIVE_DECOMMIT(环境变量 / 启动参数)` | 已在 §A8 拆 |

### C2. markdown backtick 包裹(已在 §B 同义合并 · 6 条)

`` `storage.wiredTiger.engineConfig.cacheSizeGB` `` / `` `storage.wiredTiger.engineConfig.configString` (eviction_trigger / eviction_dirty_trigger) `` / `` `storage.wiredTiger.engineConfig.configString` (io_capacity.total) `` / `` `storage.wiredTiger.engineConfig.configString` (verbose) `` / `` `setParameter.minSnapshotHistoryWindowInSeconds` ``

→ 全部规约到 §B1/§B2 对应主键。

### C3. 命令行 flag(已隐含在 mongod startup · 8 条)

| 原 param_name | 处理 |
|---|---|
| `--interleave=all` | systemd ExecStart 中,见 §A7 `ps -o args=` |
| `--profile` / `--slowms` | `getCmdLineOpts.argv` |
| `-march=armv8-a` / `-march=armv8.2-a` / `-moutline-atomics` | 编译期 flag · 由 LSE symbols 推断(§A8) |
| `--inMemorySizeGB` | gco.parsed.storage.inMemory.* (§B1) |
| `-b size` (mkfs) | 见 §A5 `xfs_info` |

### C4. 应用层并发参数(MySQL/Nginx 借喻 · KB 不应纳入 mongo 路径 A · 5 条)

`MySQL innodb_thread_concurrency` / `Nginx worker_processes` / `worker_processes` / `innodb_thread_concurrency (MySQL) / worker_processes (Nginx) / 应用自有并发参数` / `malloc-lib (my.cnf) 或类似配置`

→ 这些进入了 KB 是因为 distill 时把"类比说明"也抽成参数 · **建议在 KB rebuild 阶段过滤**(单独的 issue)

### C5. 工具名 / 检测命令(不是参数 · 7 条)

`I/O scheduler`(语义同 §A2 scheduler) / `dmesg` / `lscpu` / `blockdev`(语义同 read_ahead_kb) / `readahead`(同上) / `numactl`(工具) / `hugepages` / `hugepagesz` / `default_hugepagesz` (后三个其实是 cmdline 参数,§A4 已覆盖)

### C6. 描述性短语 / 复合表述(不可直接做字典 key · 余下约 49 条)

如 `sharding chunk size(默认 64MB)/ 25 万文档上限`、`linker flags · -ljemalloc + -L jemalloc-config --libdir`、`maxIncomingConnections / ulimit -n` (复合) 等。
均已在 §A/§B 中拆出 well-formed 主键并标注。

---

## D · 建议补全的采集点(汇总 · 给 collect-cmds.json 加哪些命令)

> 30 个建议点 · `osBatchCmd` 加 22 段、`dbBatchTemplates.mongo` 加 8 个 `getParameter`/`runCommand`。

### D1. 加到 osBatchCmd

```bash
# === D1.1 网络 sysctl(7 项) ===
echo '###NET_NETDEV_BACKLOG###' && sysctl -n net.core.netdev_max_backlog 2>/dev/null || echo 0
echo '###NET_TCP_MAX_TW###'     && sysctl -n net.ipv4.tcp_max_tw_buckets 2>/dev/null || echo 0
echo '###NET_TCP_FIN_TO###'     && sysctl -n net.ipv4.tcp_fin_timeout 2>/dev/null || echo 0
echo '###NET_TCP_TW_REUSE###'   && sysctl -n net.ipv4.tcp_tw_reuse 2>/dev/null || echo 0
echo '###NET_LOCAL_PORT###'     && sysctl -n net.ipv4.ip_local_port_range 2>/dev/null || echo none
echo '###NET_RMEM_MAX###'       && sysctl -n net.core.rmem_max 2>/dev/null || echo 0
echo '###NET_WMEM_MAX###'       && sysctl -n net.core.wmem_max 2>/dev/null || echo 0
echo '###NET_TCP_RMEM###'       && sysctl -n net.ipv4.tcp_rmem 2>/dev/null || echo none
echo '###NET_TCP_WMEM###'       && sysctl -n net.ipv4.tcp_wmem 2>/dev/null || echo none

# === D1.2 vm 写回 / dirty(2 项) ===
echo '###VM_DIRTY_WRITEBACK###' && sysctl -n vm.dirty_writeback_centisecs 2>/dev/null || echo 0
echo '###VM_DIRTY_EXPIRE###'    && sysctl -n vm.dirty_expire_centisecs 2>/dev/null || echo 0

# === D1.3 block device queue 全设备循环(替换/补充 IOSCHED · 2 项) ===
echo '###BLOCK_NRREQ###' && for q in /sys/block/*/queue/nr_requests; do d=${q%/queue/nr_requests}; echo "${d##*/}=$(cat $q 2>/dev/null)"; done | head -20
echo '###BLOCK_RAKB###'  && for q in /sys/block/*/queue/read_ahead_kb; do d=${q%/queue/read_ahead_kb}; echo "${d##*/}=$(cat $q 2>/dev/null)"; done | head -20

# === D1.4 transparent_hugepage defrag + RPS(3 项) ===
echo '###THP_DEFRAG###' && cat /sys/kernel/mm/transparent_hugepage/defrag 2>/dev/null || echo unknown
echo '###RPS_CPUS###'   && for f in /sys/class/net/*/queues/rx-0/rps_cpus; do n=${f%/queues/rx-0/rps_cpus}; echo "${n##*/}=$(cat $f 2>/dev/null)"; done | head -20
echo '###RPS_FLOW_ENT###' && sysctl -n net.core.rps_sock_flow_entries 2>/dev/null || echo 0

# === D1.5 文件系统 / 挂载(3 项 · 依赖 mongod dbPath 已知 · 由 ssh.mjs 在拿到 gco 后第二轮采) ===
# 入参 __DB_PATH__ 由调用侧从 mongo 端 getCmdLineOpts 解析后填入
echo '###FS_INFO###' && findmnt -no FSTYPE,SOURCE,OPTIONS '__DB_PATH__' 2>/dev/null || echo none
echo '###XFS_INFO###' && xfs_info '__DB_PATH__' 2>/dev/null | head -5 || echo na
echo '###CGROUP_MEM_LIMIT###' && (cat /sys/fs/cgroup/memory.max 2>/dev/null || cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null || echo na)

# === D1.6 boot cmdline · hugepagesz(1 项) ===
echo '###HUGEPAGESZ###' && grep -oE '(default_)?hugepagesz=[^ ]+' /proc/cmdline 2>/dev/null || echo none

# === D1.7 IRQ smp_affinity(1 项 · 输出量大 · head 截断) ===
echo '###IRQ_AFFINITY###' && for f in /proc/irq/*/smp_affinity_list; do echo "${f}=$(cat $f 2>/dev/null)"; done | head -30 || echo na

# === D1.8 进程级亲和 / limits / environ(3 项 · 依赖 mongod PID) ===
echo '###MONGOD_AFFINITY###' && (PID=$(pgrep -o mongod); [ -n "$PID" ] && grep -E 'Cpus_allowed_list|Mems_allowed_list' /proc/$PID/status 2>/dev/null || echo na)
echo '###MONGOD_LIMITS###'  && (PID=$(pgrep -o mongod); [ -n "$PID" ] && cat /proc/$PID/limits 2>/dev/null | grep -E 'open files|processes|stack|memory' || echo na)
echo '###MONGOD_ENV###'     && (PID=$(pgrep -o mongod); [ -n "$PID" ] && tr '\0' '\n' < /proc/$PID/environ 2>/dev/null | grep -E '^(GLIBC_TUNABLES|MALLOC_|TCMALLOC_|LD_PRELOAD)' || echo na)

# === D1.9 tuned profile(1 项) ===
echo '###TUNED_PROFILE###' && tuned-adm active 2>/dev/null | sed -n 's/Current active profile: //p' || echo no-tuned

# === D1.10 mongod 启动行(numactl wrapper 检测 · 1 项) ===
echo '###MONGOD_ARGS###' && (PID=$(pgrep -o mongod); [ -n "$PID" ] && tr '\0' ' ' < /proc/$PID/cmdline 2>/dev/null || echo na)
```

### D2. 加到 dbBatchTemplates.mongo

> 在现有 `mongosh --eval` 末尾 `print(JSON.stringify(...))` 之前追加以下 3 段调用,将结果合入 JSON 输出。

```javascript
// === D2.1 profiling runtime(1 个 · 替代多次 getParameter slowms) ===
var profilingStatus = null;
try { profilingStatus = db.getProfilingStatus(); } catch (e) {}

// === D2.2 setParameter 批量 dump(7 个目标 · 一次 RPC) ===
var runtimeParams = null;
try {
  runtimeParams = db.adminCommand({
    getParameter: 1,
    cursorTimeoutMillis: 1,
    transactionLifetimeLimitSeconds: 1,
    minSnapshotHistoryWindowInSeconds: 1,
    maxTargetSnapshotHistoryWindowInSeconds: 1,
    tcmallocAggressiveMemoryDecommit: 1,
    internalQueryFrameworkControl: 1,
    flowControlTargetLagSeconds: 1,
    storageEngineConcurrentReadTransactions: 1,
    storageEngineConcurrentWriteTransactions: 1,
    wiredTigerConcurrentReadTransactions: 1,
    wiredTigerConcurrentWriteTransactions: 1,
    wiredTigerCacheSizeGB: 1,
    wiredTigerCacheSizePct: 1,
    wiredTigerEngineRuntimeConfig: 1
  });
} catch (e) {}

// === D2.3 副本集 / writeConcern 配置(2 个) ===
var replSetConfig = null, defaultRWC = null;
try { replSetConfig = db.adminCommand({ replSetGetConfig: 1 }); } catch (e) {}
try { defaultRWC = db.adminCommand({ getDefaultRWConcern: 1 }); } catch (e) {}

// === D2.4 connPoolStats(诊断 · 1 个 · 输出可能大) ===
var connPool = null;
try { connPool = db.adminCommand({ connPoolStats: 1 }); } catch (e) {}

// 合入最终 JSON:
// { ..., profilingStatus, runtimeParams, replSetConfig, defaultRWC, connPool }
```

### D3. 不补的(client-side · 报告侧标注「应用层 · 不可远程审计」)

| 参数 | 备选侧面证据 |
|---|---|
| `maxPoolSize` / `minPoolSize` / `waitQueueTimeoutMS` | `connPoolStats.totalCreated` / `serverStatus.connections.current` |
| `socketTimeoutMS` / `connectTimeoutMS` | `currentOp.inprog[].millis` 长尾 / 连接重建率 |
| `maxIdleTimeMS` | 连接 churn 间接观测 |

→ cli-diagnose 的报告页应在命中这些规则时显式提示:**"此参数为应用 SDK 端配置 · 服务端无法直接读 · 请在应用 mongo URI 检查"**

---

## E · 给 KB rebuild 的反馈(不在本次任务范围 · 仅记录)

1. distill 阶段把"非操作系统参数,而是应用启动方式..."这种**否定性描述句**作为 `param_name` 抽取了 → 应在抽取规则上排除带括号、长 > 60 字符的项。
2. 借喻类参数(`MySQL innodb_thread_concurrency` / `Nginx worker_processes`)出现在 mongo case 中 · 应在抽取阶段做 `database` 字段过滤。
3. 同一参数的 backtick 版本(`` `xxx` ``)、复合版本(`xxx / yyy`)、带尾注释版本(`xxx (诊断专用)`) 应在 KB 入库时 normalize 为同一主键 — 减少 path A 字典空间。

---

## 完成

- KB 已读 179 unique `param_name`
- collect-cmds.json 已扫:`osBatchCmd` 现采 17 类非 db 参数;`dbBatchTemplates.mongo` 现采 28 类 db 参数(主要靠 `getCmdLineOpts.parsed`)
- 建议补 30 个采集点 · 拆分到 osBatchCmd(22 行)+ dbBatchTemplates.mongo(8 个 getParameter/runCommand)· 5 个 client-side 参数标注「不可远程采」

