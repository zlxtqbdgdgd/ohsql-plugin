# os-best-practice-linux-fs

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 6 条 case。

---

## XFS 数据盘 mount 加 noatime · 避免读取时更新 access time 浪费资源

**case_id**: `bp-linux-fs-mount-noatime-xfs-rdb-server-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0006.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0006.html) (official)
**平台**: linux-arm64-kunpeng
**scope**: linux-fs
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 通常情况下，我们对文件的操作更多是读取而不是写入，而且我们很少需要关注一个文件最近被访问的时间。

### 场景 (中文转述)
数据库服务器(以 XFS 为例)上,文件 IO 的主流模式是读多写少;OS 默认每次读取文件都会更新该文件的 access time(atime),即一次纯读操作也会触发 inode 元数据的小写,放大底层存储 IO 与 cache 失效。绝大多数数据库 / 业务并不消费 access time。

### 推荐
- 值: ``mount -o noatime (XFS data disk)``
- 层: linux-mount-option
- 原文:
  > 建议在文件系统的mount参数上加上noatime、nobarrier两个选项，其中数据盘以及数据目录以实际为准。

### 检测方法

### 机制 / 原因
XFS 默认每次 read 都会更新文件 inode 的 atime → 一次纯读操作变成"读 + 元数据写"双 IO,导致 inode buffer / 元数据日志 IO 放大,且对绝大多数数据库工作负载没有业务价值。挂 noatime 后内核完全跳过 atime 更新,避免冗余的元数据写。机制:数据库读多写少 + atime 不被业务消费 → atime 更新是纯冗余的 inode 元数据写。

### 违反时的风险 (warning)
> 文件系统不再记录访问时间，可以避免不必要的资源浪费。
不加 noatime → 每次文件读取都附带 atime 更新的 inode 元数据写,长期积累为可观察的「不必要的资源浪费」——元数据 IO 放大 / cache 命中率下降 / 高并发读场景下的 IO 利用率降低。属性能性损耗,非数据安全风险。

---

## 底层存储具备掉电保护(RAID/Flash)时 · XFS 数据盘 mount 加 nobarrier · 避免 write barrier 性能损失

**case_id**: `bp-linux-fs-mount-nobarrier-xfs-battery-backed-storage-02`
**来源**: [https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0006.html](https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0006.html) (official)
**平台**: linux-arm64-kunpeng
**scope**: linux-fs
**case_pattern**: parameter-best-practice

### 场景 (原文)
> 我们数据库服务器底层存储设备要么采用RAID控制卡，RAID控制卡本身的电池可以掉电保护；要么采用Flash卡，它也有自我保护机制，保证数据不会丢失。

### 场景 (中文转述)
数据库服务器使用具备「掉电保护」的存储后端 —— 带 BBU(电池备份)的 RAID 控制卡,或自带掉电保护机制的企业级 Flash/SSD 卡 —— 这种场景下,即使主机断电,缓存中尚未刷盘的数据也能被存储侧安全持久化。文件系统层的 write barrier(强制 cache flush)成为冗余保护。⚠️ 注意 openEuler 不支持 nobarrier 选项,该 BP 不适用于 openEuler。

### 推荐
- 值: ``mount -o nobarrier (XFS data disk; storage with battery-backed cache; not openEuler)``
- 层: linux-mount-option
- 原文:
  > 对于ext3、ext4和reiserfs文件系统可以在mount时指定barrier=0。对于XFS可以指定nobarrier选项。

### 检测方法

### 机制 / 原因
> 许多文件系统在数据提交时会使用write barriers来强制刷新Cache，以避免数据丢失。但是，其实我们数据库服务器底层存储设备要么采用RAID控制卡，RAID控制卡本身的电池可以掉电保护；要么采用Flash卡，它也有自我保护机制，保证数据不会丢失。
write barrier 的设计目的是在主机断电时强制把文件系统页缓存 / 日志缓存刷到底层介质,防数据丢失。但当底层存储设备本身已具备 BBU RAID 或企业级 Flash 的电池/电容掉电保护时,断电场景下数据已由存储侧负责持久化,文件系统层的 barrier 变成纯冗余的同步刷盘操作 → 写延迟升高且 IOPS 损耗,而不带来额外的数据安全收益。原文以「但是」承接,即承认 barrier 的初始机制(防数据丢失),但在数据库服务器+掉电保护存储这一前提下论证其冗余。

### 违反时的风险 (warning)
如已具备掉电保护的存储后端但仍开启 write barriers(默认行为) → 每次同步写都会强制刷盘 → 写延迟升高和 IOPS 下降(原文称「write barriers的性能损失」),且不带来任何数据安全增益。属性能性损耗,非数据安全风险。

---

## dbPath 不要用 NFS · 用本地 / VMware 虚拟盘

**case_id**: `linux-fs-avoid-nfs-for-dbpath-checklist-01`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-checklist-operations/](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/) (official)
**平台**: bare
**scope**: linux-fs
**case_pattern**: parameter-best-practice

### 场景 (原文)
> Avoid using NFS drives for your ... dbPath. Using NFS drives can result in degraded and unstable performance.

### 场景 (中文转述)
为 mongod 的 `dbPath`(数据目录)选择存储介质的部署场景。NFS(网络文件系统)在生产 MongoDB 部署中是反推荐选择,本页清单明确把它列为 "Avoid"。VMware 虚拟化环境下的特例:VMware 用户应使用 VMware 虚拟盘而非 NFS。

### 推荐
- 值: ``dbPath ∉ NFS · 用本地块设备 / VMware 虚拟盘``
- 层: linux-mount-option
- 原文:
  > Avoid using NFS drives for your ... dbPath. Using NFS drives can result in degraded and unstable performance.

### 机制 / 原因
NFS(NFSv3 / NFSv4)走网络协议栈,fsync 语义跟本地 ext4/xfs 不一致,WiredTiger 大量 mmap + 写时复制 + checkpoint fsync 路径在 NFS 上会被网络 RTT / NLM 锁竞争 / cache coherency 协议拖慢,出现 "degraded and unstable performance"(原文 risk 用语)。VMware 在 hypervisor 层提供的"虚拟盘"是块设备语义,不走 NFS 协议,所以例外允许。

### 违反时的风险 (warning)
> Using NFS drives can result in degraded and unstable performance.
`dbPath` 落在 NFS 上时,WT 写吞吐 / fsync 延迟出现退化,且不稳定(NFS server 抖动 / 网络丢包都会传导到 mongod 写延迟),业务表现为间歇性慢写 / cache eviction 拥塞。

---

## 必须用 NFS 时 · /etc/fstab 加 bg / hard / nolock / noatime / nointr 选项

**case_id**: `linux-fs-nfs-mount-options-bg-hard-nolock-noatime-nointr-03`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (official)
**平台**: bare
**scope**: linux-fs
**case_pattern**: parameter-best-practice

### 场景 (原文)
> With the WiredTiger storage engine, WiredTiger objects may be stored on remote file systems if the remote file system conforms to ISO/IEC 9945-1:1996 (POSIX.1).

### 场景 (中文转述)
部署 mongod 时把数据目录挂在 NFS 远端文件系统的场景(典型:虚拟化 / 共享存储 / NAS 池)。WT 允许对象落 NFS,但远端 FS 通常比本地慢——这是不得不用 NFS 时的兜底配置。

### 推荐
- 值: ``/etc/fstab 挂载选项含 bg, hard, nolock, noatime, nointr``
- 层: linux-mount-option
- 原文:
  > If you decide to use NFS, add the following NFS options to your /etc/fstab file:

### 检测方法
> "/etc/fstab"
违规模式: "Depending on your kernel version, some of these values may already be set as the default"

### 机制 / 原因
NFS 挂载选项各自的语义:`bg` 让首次挂载失败时后台重试避免启动卡死;`hard` 让 IO 在服务端短暂不可达时持续重试而非直接报错(对数据库这种不能容忍 EIO 的场景至关重要);`nolock` 关掉 NLM 文件锁(与 mongod 的内置锁冲突时易死锁);`noatime` 关闭访问时间更新(每次读都触发 inode 写,放大 NFS 负载);`nointr` 让"hard mount"下的 IO 不被信号打断,避免半截写。整套配置目的:让 NFS 行为尽可能像本地块设备,把语义裂缝降到最低。

### 违反时的风险 (warning)
> using a remote file system for storage may degrade performance.
未配齐这五项挂载选项,NFS 性能会进一步下降:atime 写放大、`soft` mount 下的 EIO 抖动、文件锁冲突死锁、信号被中断后产生半截写,这些都会让 mongod 出现间歇性写慢、journal flush 失败、甚至数据一致性风险。

---

## 大文件操作场景使用 XFS 文件系统并将 blocksize 设为 8192B 以提升 I/O 吞吐

**case_id**: `linux-fs-xfs-blocksize-large-file-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0041.html](https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0041.html) (official)
**平台**: bare
**scope**: linux-fs
**case_pattern**: parameter-best-practice

### 场景 (原文)
> XFS文件系统在创建时，可先选择加大文件系统的block，更加适用于大文件的操作场景。

### 场景 (中文转述)
在以大文件读写为主的工作负载场景下（如数据库数据文件、日志文件、大型对象存储等），文件系统的 block 大小会直接影响 I/O 的对齐效率和吞吐量。XFS 格式化时可以通过 `-b size=` 选项指定更大的 block，默认 4KB 在大文件场景下不够最优。

### 推荐
- 值: ``mkfs.xfs -b size=8192``
- 层: linux-mount-option
- 原文:
  > mkfs.xfs /dev/sda1 -b size=8192

### 机制 / 原因
XFS 文件系统的 block 大小决定了文件系统分配和读写 I/O 的最小单位。大文件场景下，文件内容连续分布，每次 I/O 请求覆盖的数据量远大于 4KB；若 block 仍为默认 4KB，需要多次小 I/O 拼接，增加了 I/O 次数和寻址开销。将 block 调大至 8192B（8KB）后，单次 I/O 可覆盖更多连续数据，降低 I/O 次数，提升大文件操作的吞吐量。

### 违反时的风险 (warning)
在大文件操作场景下若保留默认 4KB blocksize，文件系统 I/O 不对齐，导致单次读写需要更多次小 I/O 请求，整体 I/O 吞吐量下降，可能成为大文件密集工作负载的性能瓶颈。

---

## WiredTiger 数据盘强烈建议用 XFS · 不用 EXT4

**case_id**: `linux-fs-xfs-strongly-recommended-for-wt-checklist-02`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-checklist-operations/](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/) (official)
**平台**: bare
**scope**: linux-fs
**case_pattern**: parameter-best-practice

### 场景 (原文)
> Linux/Unix: format your drives into XFS or EXT4. If possible, use XFS as it generally performs better with MongoDB.

### 场景 (中文转述)
Linux / Unix 平台部署 mongod 时,需要为 dbPath 数据盘选择文件系统。本页清单明确把 XFS 跟 EXT4 列为允许选项,并强烈推荐 XFS——尤其对 WiredTiger 存储引擎(自 MongoDB 3.2 起的默认引擎)。

### 推荐
- 值: ``XFS for WT data drive (avoid EXT4 with WT)``
- 层: linux-mount-option
- 原文:
  > With the WiredTiger storage engine, use of XFS is strongly recommended to avoid performance issues found when using EXT4 with WiredTiger.

### 机制 / 原因
WiredTiger 大量使用 mmap 与稀疏文件 / 高频 fsync / 大块顺序追加 + 随机短读;XFS 的 allocation group / delaylog / inode64 在并发分配大文件块时锁粒度更细,journal 路径写惩罚比 EXT4 ordered-mode 更轻;EXT4 在大文件 fallocate / fsync 路径有 journal contention 跟 i_mutex 竞争,WT 高 IOPS 工作负载下表现为长尾写延迟 / checkpoint 卡顿——这就是原文所谓 "performance issues found when using EXT4 with WiredTiger"。

### 违反时的风险 (warning)
> use of XFS is strongly recommended to avoid performance issues found when using EXT4 with WiredTiger.
WT 数据盘用 EXT4 时,在高写并发 / 大数据集 / 频繁 checkpoint 场景下出现性能问题——典型表现是 fsync 延迟高、p99 写延迟长尾、checkpoint 期 WT cache 阻塞。

---
