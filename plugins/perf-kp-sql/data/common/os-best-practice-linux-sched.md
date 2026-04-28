# os-best-practice-linux-sched

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 6 条 case。

---

## KVM 虚拟机部署 mongod 时 · vcpu placement=static + cpuset 限定 worker 线程范围 · 防跨 NUMA 跨 DIE

**case_id**: `kvm-vcpu-placement-static-cpuset-numa-affinity-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0019.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/systuningguide/tngg/kunpengdbs_tuningguide_05_0019.html) (official)
**平台**: bare
**scope**: linux-sched
**case_pattern**: parameter-best-practice

### 场景 (原文)
> vcpu placement = 'static' cpuset='4-7'：该参数用于IO线程或worker threads线程时仅能使用4～7这4个核。

### 场景 (中文转述)
KVM 虚拟机部署 mongod / 数据库工作负载的场景。在多 NUMA 节点 / 多 DIE 物理机上 · 默认 KVM 配置下虚拟机 IO 线程 / worker 线程会在 host 任意 CPU 核上浮动 · 触发跨 NUMA / 跨 DIE 远程访存开销 · 影响数据库延迟。

### 推荐
- 值: ``vcpu placement='static' cpuset='<同 NUMA 节点 cpu 列表 · 例 4-7>'(用 cpuset 把 IO/worker threads 限定在同一 NUMA / DIE)``
- 层: other
- 原文:
  > vcpu placement = 'static' cpuset='4-7'：该参数用于IO线程或worker threads线程时仅能使用4～7这4个核。

### 检测方法

### 机制 / 原因
把 vcpu placement 设为 static + cpuset 限定到同一 NUMA 节点 / DIE 内的物理 CPU 范围 · 让 IO 线程 / worker 线程不跨 NUMA / 跨 DIE 调度。这样所有内存访问都走本地 NUMA · 避免远程 NUMA 节点访存的 ~2x 延迟惩罚与 cross-DIE coherence 流量 · 也避免 host 调度器把同一虚拟机线程在多 socket 间均衡迁移引发的 cache cold-miss。

### 违反时的风险 (warning)
> 若不配置此参数，虚拟机任务线程会在CPU任意core上浮动，会存在更多的跨NUMA和跨DIE损耗。
若不配置 vcpu placement=static + cpuset · 虚拟机的 IO / worker 线程会被 host 调度器在所有物理 CPU 上自由浮动 · 引发跨 NUMA / 跨 DIE 的远程访存损耗(远程 LLC + 跨 socket 内存控制器访问) · 数据库延迟升高、抖动加剧。

---

## RHEL / CentOS 上用 tuned 时必须自定义 tuned profile

**case_id**: `linux-sched-customize-tuned-profile-rhel-centos-checklist-04`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-checklist-operations/](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/) (official)
**平台**: bare
**scope**: linux-sched
**case_pattern**: parameter-best-practice

### 场景 (原文)
> If using tuned on RHEL / CentOS, you must customize your tuned profile.

### 场景 (中文转述)
mongod 部署在 RHEL / CentOS 系列发行版上,且系统启用了 `tuned`(RHEL 默认调优 daemon · 通过 tuned-adm 切 profile 来一键应用 sysctl/cpu/disk 调参)的部署场景。tuned 自带的 profile(`throughput-performance` / `latency-performance` / `virtual-guest` 等)对通用工作负载调优,**未必适合 MongoDB**。

### 推荐
- 值: ``customize tuned profile (THP per MongoDB version · readahead 8-32)``
- 层: os-sysctl
- 原文:
  > If using tuned on RHEL / CentOS, you must customize your tuned profile.

### 机制 / 原因
> Many of the tuned profiles that ship with RHEL / CentOS can negatively impact performance with their default settings.
tuned 自带的 stock profile 是为通用工作负载设计的——例如 `throughput-performance` 默认开启 transparent_hugepage 总是 always,而 MongoDB 7.0 及以下要求关闭 THP(8.0 及以后又要打开),版本切换时 stock profile 不会自动跟随。同理,readahead / IO scheduler 默认值也跟 MongoDB 推荐(WT 8-32 / NVMe SSD 用 none)不一致。直接用 stock profile,等价于在 MongoDB 上跑非最优 OS 调优,出现性能退化。

### 违反时的风险 (warning)
> Many of the tuned profiles that ship with RHEL / CentOS can negatively impact performance with their default settings.
不自定义 profile · 直接用 RHEL/CentOS stock tuned 配置,会负面影响 MongoDB 性能——典型为 THP / readahead / scheduler 三者中至少一个跟 MongoDB 推荐相反,出现 cache eviction 抖动 / 长尾延迟。

---

## 同 VM / 自建机房多负载混跑 · I/O scheduler 用 kyber(kernel 4.12+)

**case_id**: `linux-sched-kyber-for-multi-workload-11`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (official)
**平台**: bare
**scope**: linux-sched
**case_pattern**: parameter-best-practice

### 场景 (原文)
> If you are running multiple workloads in the same VM or in your own data center, use the kyber scheduler.

### 场景 (中文转述)
同一 VM 或自建机房里跑多种工作负载(eg. mongod + 其他 DB / 应用)的场景,需要在多个 IO 流量竞争同一块磁盘时给出公平分配。

### 推荐
- 值: ``I/O scheduler = kyber`(需 Linux kernel 4.12+)`
- 层: os-sysctl
- 原文:
  > use the kyber scheduler.

### 机制 / 原因
`kyber` 是 Linux 4.12 引入的多队列 IO 调度器,目标就是"多负载混跑场景下控制读写延迟":根据 token-bucket 限制并发 + 隔离读 / 写,保证混跑里不出现单一负载霸占磁盘。在 mongod 跟其他高 IO 应用同盘场景比 mq-deadline 更合适。

### 违反时的风险 (info)
多负载混跑场景如果用 mq-deadline,在 IO 突发时易出现单负载吃满磁盘 → 其他负载饿死,延迟尖峰。

---

## 物理服务器 + 转盘 · I/O scheduler 用 mq-deadline

**case_id**: `linux-sched-mq-deadline-for-spinning-disk-10`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (official)
**平台**: bare
**scope**: linux-sched
**case_pattern**: parameter-best-practice

### 场景 (原文)
> For physical servers using spinning disks, the operating system should use the mq-deadline scheduler.

### 场景 (中文转述)
mongod 部署在物理机 + 转盘存储场景。转盘有物理寻道延迟,需要内核做 I/O 排序以减少寻道。

### 推荐
- 值: ``I/O scheduler = mq-deadline``
- 层: os-sysctl
- 原文:
  > the operating system should use the mq-deadline scheduler.

### 机制 / 原因
> The mq-deadline scheduler caps maximum latency per request and maintains a good disk throughput that is best for disk-intensive database applications.
`mq-deadline` 给每个 request 设最大等待时长(deadline),既排序合并以提高转盘吞吐,又防止某个请求被无限延后造成长尾,正好契合 DB 这类"既要吞吐又要可控延迟"的工作负载。

### 违反时的风险 (info)
转盘场景用 `none` 或非 deadline 类调度器,转盘寻道无序、长尾请求被忽略,P99 / P999 延迟会更差。

---

## VM / 云主机 + hypervisor 块设备 · I/O scheduler 用 none

**case_id**: `linux-sched-none-for-vm-cloud-09`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (official)
**平台**: bare
**scope**: linux-sched
**case_pattern**: parameter-best-practice

### 场景 (原文)
> For local block devices attached to a virtual machine instance via the hypervisor or hosted by a cloud hosting provider, the guest operating system should use the none scheduler for best performance.

### 场景 (中文转述)
mongod 部署在 VM 或云主机的场景:Guest OS 看到的"块设备"实际是 hypervisor / cloud provider 提供的虚拟设备,底层调度由 hypervisor 管;Guest OS 自己再做一遍 I/O 调度只是浪费 CPU + 引入额外延迟。

### 推荐
- 值: ``I/O scheduler = none``
- 层: os-sysctl
- 原文:
  > the guest operating system should use the none scheduler for best performance.

### 机制 / 原因
> The none scheduler allows the operating system to defer I/O scheduling to the underlying hypervisor.
VM / 云主机里 Guest 的「块设备」已被 hypervisor 抽象,Guest 内核再做 mq-deadline 这类调度只会引入二次排队 / 重排序,而真正知道物理盘排队情况的是 hypervisor。`none` 把调度让渡给 hypervisor,避免「两层调度争夺」。

### 违反时的风险 (info)
> the guest operating system should use the none scheduler for best performance.
VM 里使用 mq-deadline / kyber 等带排队 / 排序逻辑的调度器,会做无效的排序工作,延迟不会下降反而引入抖动;不属于灾难性,但是次优配置(典型 P99 抖动来源之一)。

---

## Linux ulimit nproc: raise thread count limit for high-connection MongoDB deployments

**case_id**: `os-ulimit-nproc-high-conn-02`
**来源**: [https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections](https://www.mongodb.com/company/blog/technical/tuning-mongodb--linux-to-allow-for-tens-of-thousands-connections) (official)
**平台**: linux-x86_64-generic
**scope**: linux-sched
**case_pattern**: parameter-best-practice

### 场景 (原文)
> RHEL ships with default ulimit and other configurations that are appropriate for your laptop, and to really get the full performance of a large production server you need to do a lot of tuning to increase various limits and buffers.

### 场景 (中文转述)
MongoDB 默认为每个连接创建一个独立线程（per-connection thread model）。在大型生产服务器上运行高并发连接时，操作系统默认的 `nproc`（进程/线程数上限）ulimit 面向桌面场景，连接数较多时线程数极易触及上限，需显式调高。

### 推荐
- 值: ``nproc = 9999999``
- 层: os-sysctl
- 原文:
  > echo "ec2-user soft nproc 9999999" | sudo tee -a /etc/security/limits.conf

### 机制 / 原因
> For historical reasons, nproc is really the number of threads. Historically a Linux process was a single thread and concurrent workloads were multi-process.
Linux 的 `nproc` ulimit 历史上是进程数上限，但现代 Linux 中每个线程也占用一个 nproc 配额。MongoDB 默认的 per-connection 线程模型使线程数与连接数相等，高并发连接下线程数快速增长，若不调高 `nproc`，新线程（即新连接）将无法创建。

### 违反时的风险 (critical)
若不调高 `nproc`，当 MongoDB 进程的线程数超过系统默认上限时，新线程创建失败，等价于新连接无法建立，mongod 将拒绝超限的并发连接请求。

---
