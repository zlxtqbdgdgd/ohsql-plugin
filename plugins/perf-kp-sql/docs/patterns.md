# 蒸馏故障画像库（14 条）

本库为 agent 做症状匹配提供「四段式推理知识」。14 条画像通过 LLM 从 254 篇业界调优文档蒸馏而来，
每条按 **Trigger → Observation → Hypothesis → Resolution** 四段组织。

**使用方式**：先按用户症状匹配 Top-N 画像（关键词 + RAG），再沿四段式推理回答。
**来源总览**：12 条社区画像 + 2 条华为官方画像（经同类合并精简）。

---

### 画像 01 · 副本切换 + I/O 高（XFS/THP/swap/ulimit 综合）
<!-- source: distillation/data/generated_skills/community/skill_16ede649347c19f4b787b53eeb014b59.md -->

#### 核心故障镜像 (Trigger)
MongoDB副本集在运行一段时间后频繁发生主节点切换和无故重启，导致服务不稳定。同时，某台机器的I/O负载异常高，系统响应缓慢。

#### 检测探针 (Observation)
观察到的指标包括wa（I/O等待时间）异常高。需要检查系统的I/O性能指标和MongoDB日志以确认重启原因。

#### 根因推演 (Hypothesis)
可能的原因包括：
1. 使用不当的文件系统或存储配置导致I/O瓶颈。
2. Transparent Huge Pages未禁用，导致内存管理效率低下。
3. Swappiness设置不当，导致过多的内存交换到磁盘。
4. ulimit设置不当，限制了MongoDB的资源使用。

#### 战术执行与修复 (Resolution Path)
1. 确保使用XFS文件系统以优化WiredTiger存储引擎的性能。
2. 禁用Transparent Huge Pages以提高内存管理效率。
3. 将`vm.swappiness`设置为1以减少不必要的内存交换。
4. 调整ulimit设置，确保MongoDB有足够的文件描述符和进程资源。

---

### 画像 02 · ARM 编译问题 · 低端设备与虚机资源不足
<!-- source: distillation/data/generated_skills/community/skill_27a0659313304cc974f3c2b3b6c7bb6a.md, distillation/data/generated_skills/official/skill_kunpeng_general_fault_cases.md -->

#### 核心故障镜像 (Trigger)
在 ARM 平台（ODROID-XU4 / 鲲鹏 KVM 虚机等）上编译 MongoDB 或其依赖组件时，因资源受限（内存不足、磁盘空间不足）或架构差异导致编译失败。典型场景：2GB 内存设备编译遇到多种错误；鲲鹏虚机分配 3GB 内存执行 make -j 20 时进程被 OOM kill。

#### 检测探针 (Observation)
- 编译错误：`fatal error: js-config.h: No such file or directory`
- 磁盘空间不足：`No space left on device`
- 链接器I/O错误：`file too short: read only 18202 of 26977 bytes`
- 内存不足：`ld terminated with signal 9 [Killed]` 或 `g++: internal compiler error: Killed (program cc1plus)`
- 浮点对齐错误：`Invalid access at address`
- 检查虚拟机内存分配与 SWAP 配置

#### 根因推演 (Hypothesis)
1. ARM 架构缺失对应的 SpiderMonkey 配置（armhf）。
2. 编译需要超过 16GB 空间，受限于设备存储。
3. GNU gold 链接器在处理向量 I/O 时未正确处理部分读取。
4. 内存不足（2-3GB）又未配置交换空间，高并发编译被 OOM kill。
5. ARM 数据对齐要求严格，未对齐访问导致崩溃。
6. TCMalloc 使用 libunwind 在 ARM 上支持有限。

#### 战术执行与修复 (Resolution Path)
1. 使用`get_sources.sh`下载完整 SpiderMonkey 源代码并生成适当配置。
2. 将编译移至更大存储的机器，或使用 NFS 挂载远程存储。
3. 修改`SConstruct`切换回 GNU ld 链接器，或使用 LLVM lld。
4. 启用 zram 提供压缩内存交换，或限制并发编译作业数量。
5. 鲲鹏虚机场景：增加虚机内存到 16GB+（`virsh edit` 修改配置后重启）。
6. 修复 ARM 对齐错误，回溯 MongoDB 3.3.3 的修复。
7. 使用`--enable-stacktrace-via-backtrace`重新编译 TCMalloc。

---

### 画像 03 · 高并发网络线程瓶颈 · reuse_port 优化
<!-- source: distillation/data/generated_skills/community/skill_471f08c47e554cb82e73260f36ca7dfa.md -->

#### 核心故障镜像 (Trigger)
在高并发场景下，MongoDB集群的系统负载过高，导致时延巨增，性能瓶颈明显。

#### 检测探针 (Observation)
观察mongos和mongod的网络配置，特别是conn线程的数量和负载情况。使用工具如mongostat或ftdc-utils分析诊断数据。

#### 根因推演 (Hypothesis)
由于默认配置下，每个连接都有一个单独的conn线程负责处理，导致在高并发情况下，线程数量过多，系统负载过高。即使使用adaptive配置，动态调整线程数也会导致类似问题，因为磁盘I/O才是真正的瓶颈。

#### 战术执行与修复 (Resolution Path)
1. 利用内核的reuse_port功能，允许多个线程监听同一个端口，实现自动负载均衡。
2. 减少处理客户端网络数据的线程数，充分利用epoll异步事件处理和多路复用技术。
3. 将网络I/O和磁盘I/O处理分离，合理分配线程资源，更多线程用于磁盘I/O处理。

---

### 画像 04 · WiredTiger 存储引擎调优 · 缓存大小与压缩算法
<!-- source: distillation/data/generated_skills/community/skill_4bcfa732df13c89630931a7836b81280.md, distillation/data/generated_skills/community/skill_79729f6fe4231ebe25659b1eeae464cb.md -->

#### 核心故障镜像 (Trigger)
MongoDB 在高负载下出现性能瓶颈（读写延迟增加、磁盘 I/O 频繁），或在低端硬件上内存分配增长导致系统交换。两种极端场景：缓存过小导致频繁磁盘 I/O；缓存过大（默认配置）导致低内存设备 swap 暴涨。

#### 检测探针 (Observation)
- `db.hostInfo().system.memLimitMB` 查看系统内存限制。
- `db.serverStatus().wiredTiger.cache` 查看 WiredTiger 缓存统计。
- `mongostat` 监控 I/O 等待时间和网络吞吐量。
- 检查配置文件中的 `wiredTiger.engineConfig.cacheSizeGB`。

#### 根因推演 (Hypothesis)
- **高负载环境**：WiredTiger 缓存配置不当导致缓存不足，磁盘 I/O 频繁。未合理配置压缩算法导致 CPU 资源浪费。
- **低内存环境**：WiredTiger 默认缓存占用过大（如 4GB 内存默认用 1.5GB），导致系统 swap 暴涨、性能急剧下降。

#### 战术执行与修复 (Resolution Path)
1. **正常环境**：调整 `cacheSizeGB` 分配系统内存的 40%-60%。
2. **低内存环境**（4GB 以下）：将 `cacheSizeGB` 设为较低值（如 0.5GB），减少 MongoDB 内存占用。
3. 启用 `storage.wiredTiger.engineConfig.directoryForIndexes` 和 `storage.directoryPerDB`，实现 I/O 隔离。
4. 根据业务场景选择压缩算法：写入密集型用 `blockCompressor: snappy`，读取密集型用 `blockCompressor: zstd`。
5. 跨地域部署启用 `net.compression.compressors: zstd`，减少网络延迟和带宽成本。
6. 持续监控：通过 `db.serverStatus()` 和 `mongostat` 验证优化效果。

---

### 画像 05 · 慢查询诊断与索引优化
<!-- source: distillation/data/generated_skills/community/skill_6a415f1371ec904f3e9822736dc421ac.md, distillation/data/generated_skills/community/skill_8631ba1bb2f5e644e4db32ed77f22d5a.md -->

#### 核心故障镜像 (Trigger)
MongoDB 查询速度缓慢导致业务受影响。典型案例：BI 服务聚合操作返回一天的记录需要约 10 秒，profile 发现 COLLSCAN 全表扫描了 260 万条文档。

#### 检测探针 (Observation)
- 使用 `db.setProfilingLevel(1, {slowms: 1000})` 记录慢查询。
- 使用 `explain()` 查看执行计划，确认是否 COLLSCAN。
- MongoDB Compass 监控实时性能指标。
- 检查 `nscannedObjects` 与返回文档数的比例。

#### 根因推演 (Hypothesis)
查询未能有效利用索引，导致全表扫描和高内存消耗。WiredTiger 缓存配置不当可能导致内存使用效率低下。大数据量聚合操作时 IO 性能成为瓶颈。

#### 战术执行与修复 (Resolution Path)
1. 创建针对性索引：
   ```shell
   db.collection.ensureIndex({"insertTime": 1, "eventType": 1});
   db.collection.ensureIndex({"insertTime": 1});
   ```
2. 使用复合索引和部分索引覆盖高频查询模式。
3. 调整 WiredTiger 缓存大小，确保占用 60-70% 可用 RAM。
4. 优化查询结构：避免正则表达式和非选择性条件。
5. 聚合管道优化：调整管道阶段顺序减少文档处理量。
6. 对大数据量聚合，考虑预计算和缓存减少实时查询负担。
7. 定期监控并调整连接池配置。

---

### 画像 06 · NUMA 内存交错 · numactl --interleave
<!-- source: distillation/data/generated_skills/community/skill_8129deb36402b4141fa652a4ebea835d.md -->

#### 核心故障镜像 (Trigger)
MongoDB在NUMA架构上运行时，可能会出现性能下降、无法使用所有可用RAM以及系统进程使用率高的问题。

#### 检测探针 (Observation)
使用`numactl --interleave`命令配置内存交错策略，以观察是否有性能改善。

#### 根因推演 (Hypothesis)
由于NUMA架构的内存访问不均匀，MongoDB可能无法有效利用所有内存，导致性能下降。

#### 战术执行与修复 (Resolution Path)
在NUMA硬件上运行MongoDB服务器和客户端时，使用`numactl --interleave`命令配置内存交错策略，以确保内存的均匀访问，提升性能。

---

### 画像 07 · MongoDB vs PostgreSQL 聚合性能差
<!-- source: distillation/data/generated_skills/community/skill_9ab8fcb345694d731c5f512c47c0c3c8.md -->

#### 核心故障镜像 (Trigger)
MongoDB聚合查询在处理5.5百万行数据时，性能显著低于PostgreSQL，执行时间从9000毫秒到高达130,000毫秒不等，而PostgreSQL仅需不到2000毫秒。

#### 检测探针 (Observation)
使用MongoDB的`explain`命令查看查询计划，发现`nscannedObjects`和`nscanned`均为559572，表明MongoDB扫描了大量文档。PostgreSQL的`EXPLAIN (BUFFERS, ANALYZE)`显示其使用了Bitmap Heap Scan和Bitmap Index Scan，且共享缓存命中较高。

#### 根因推演 (Hypothesis)
MongoDB在处理复杂聚合查询时，尤其是涉及大量数据扫描和计算的情况下，性能可能会受到影响。WiredTiger存储引擎在处理大数据集时，可能由于内存管理和索引策略不当，导致查询效率低下。此外，MongoDB的索引策略不如PostgreSQL优化，尤其是在多字段过滤和聚合的场景下。

#### 战术执行与修复 (Resolution Path)
1. 优化MongoDB索引：为`datetime`和`prevdatetime`创建复合索引`{datetime: 1, prevdatetime: 1}`，以减少扫描的文档数量。
2. 调整WiredTiger缓存配置：确保MongoDB实例有足够的内存分配，调整`wiredTiger.cacheSizeGB`参数以优化内存使用。
3. 考虑数据模型优化：减少文档中的空字段，或者将不必要的字段排除在查询之外，以减少数据处理量。
4. 在可能的情况下，使用MongoDB的分片功能来分散负载，提升查询性能。

---

### 画像 08 · 迁移后性能退化 · 冷热数据预热
<!-- source: distillation/data/generated_skills/community/skill_a5ec2ed5e0ef7631aa4ed7027ef75016.md -->

#### 核心故障镜像 (Trigger)
MongoDB在迁移到新服务器后，出现了严重的性能问题，包括读写队列堆积、连接超时、数据库锁死和最终宕机。

#### 检测探针 (Observation)
通过MongoStat观察到读写队列堆积，Locked值居高不下，连接数增加导致超时。MongoDB日志显示大量慢查询，最长达到370秒。

#### 根因推演 (Hypothesis)
由于MongoDB在新服务器上未能有效利用内存，热点数据未能及时加载到内存中，导致读写性能下降。同时，身份验证机制在高并发下成为瓶颈。硬件设备不兼容和不当的数据库切换操作加剧了问题。

#### 战术执行与修复 (Resolution Path)
1. 在启动参数中使用`numactl --interleave=all`以优化内存分配。
2. 关闭MongoDB的外网访问，使用内网无密码访问以减少身份验证开销。
3. 优化索引，删除冗余索引和不必要的联合索引。
4. 使用缓存和从库分担查询压力。
5. 通过编写脚本进行全表扫描以逐步增加内存中的热点数据。
6. 在迁移和重启过程中，谨慎管理连接数和请求数，避免瞬时高负载。

---

### 画像 09 · Linux 综合调优 · dirty/swap/IO/somaxconn/THP
<!-- source: distillation/data/generated_skills/community/skill_c5b9aba15c37dc61d180a4b6f49c27bf.md -->

#### 核心故障镜像 (Trigger)
在高负载的MongoDB部署中，可能会出现内存不平衡、磁盘I/O瓶颈或网络延迟，导致查询性能下降或系统不稳定。

#### 检测探针 (Observation)
使用以下命令和配置检查系统状态：
- `sysctl -a | egrep "vm.dirty.*_ratio"` 检查当前的虚拟内存脏页比例。
- `sysctl vm.swappiness` 检查当前的交换倾向。
- `sudo numastat -p $(pidof mongod)` 检查MongoDB的NUMA设置。
- `cat /sys/block/sda/queue/scheduler` 检查I/O调度器。
- `sudo blockdev --getra /dev/sda` 检查当前的预读设置。
- `grep "/var/lib/mongo" /proc/mounts` 验证文件系统挂载选项。
- `sysctl net.core.somaxconn` 检查网络连接设置。
- `sudo getenforce` 检查SELinux模式。

#### 根因推演 (Hypothesis)
- MongoDB在NUMA架构下不具备NUMA感知能力，可能导致内存不平衡。
- 默认的Linux内核I/O调度器和预读设置可能不适合MongoDB的随机访问模式，导致磁盘I/O瓶颈。
- 高交换倾向（swappiness）可能导致不必要的磁盘交换，影响性能。
- 默认的网络设置可能限制了高并发连接的处理能力。
- 启用透明大页（Transparent HugePages）可能导致内存访问效率低下。
- SELinux未正确配置可能导致权限问题。

#### 战术执行与修复 (Resolution Path)
- 使用`numactl --interleave=all`启动MongoDB以启用NUMA交错模式。
- 在`/etc/sysctl.conf`中设置`vm.dirty_ratio = 15`和`vm.dirty_background_ratio = 5`，并运行`/sbin/sysctl -p`应用更改。
- 设置`vm.swappiness = 1`以减少不必要的交换。
- 在`/etc/udev/rules.d/`中配置I/O调度器为`deadline`，并将预读设置为16KB。
- 在`/etc/fstab`中为MongoDB数据卷添加`noatime`选项以减少不必要的磁盘I/O。
- 在`/etc/sysctl.conf`中增加`net.core.somaxconn`和`net.ipv4.tcp_max_syn_backlog`以提高网络连接处理能力。
- 禁用透明大页，通过在GRUB配置中添加`transparent_hugepage=never`。
- 确保SELinux处于`Enforcing`模式，并根据需要配置策略。

---

### 画像 10 · 鲲鹏 ARM · 调低 swappiness 减少换页开销
<!-- source: distillation/data/generated_skills/community/skill_d7ef5eeb4bd63dcf659948bd3ae137c2.md -->

#### 核心故障镜像 (Trigger)
在鲲鹏ARM64架构上运行MongoDB时，出现查询吞吐量下降和延迟增加的现象。

#### 检测探针 (Observation)
使用以下命令检查当前的swappiness值：
```
cat /proc/sys/vm/swappiness
```

#### 根因推演 (Hypothesis)
由于ARM架构的NUMA设计和内存管理特性，WiredTiger引擎的内存页在被交换到磁盘后，重新加载需要额外的CPU资源进行解压，导致性能下降。默认的swappiness值可能导致过多的内存页被交换出去。

#### 战术执行与修复 (Resolution Path)
调整swappiness参数以减少内存页交换：
```
echo "vm.swappiness=1" >> /etc/sysctl.conf
sysctl -p
```
在内存充足的情况下（如64GB以上），可以考虑将swappiness设置为0以完全禁用交换分区，但需确保监控内存使用情况。

---

### 画像 11 · 数据量超 RAM · 脏页比例 + NUMA + THP 组合调优
<!-- source: distillation/data/generated_skills/community/skill_e594698e4371ff154c7968c26113dc12.md -->

#### 核心故障镜像 (Trigger)
在MongoDB大规模部署中，随着数据量超过RAM，系统性能下降，查询响应时间增加，甚至可能导致服务中断。

#### 检测探针 (Observation)
使用`sysctl -a | egrep "vm.dirty.*_ratio"`检查当前的脏页比例设置，以及`numastat -p $(pidof mongod)`查看NUMA节点的内存使用情况。

#### 根因推演 (Hypothesis)
由于Linux默认的脏页比例设置过高，导致大量内存被脏页占用，触发硬盘写入时产生长时间暂停。同时，MongoDB对NUMA架构不敏感，可能导致内存不平衡，进一步影响性能。

#### 战术执行与修复 (Resolution Path)
1. 调整脏页比例：在`/etc/sysctl.conf`中设置`vm.dirty_ratio = 15`和`vm.dirty_background_ratio = 5`，然后执行`/sbin/sysctl -p`应用更改。
2. 使用`numactl --interleave=all mongod <options here>`命令启动MongoDB，以启用NUMA交错模式，确保内存均衡使用。
3. 禁用透明大页（THP）：在GRUB配置中添加`transparent_hugepage=never`，并重启系统以确保设置生效。

---

### 画像 12 · XFS 文件系统推荐 + vm.max_map_count 调优
<!-- source: distillation/data/generated_skills/community/skill_e99c6d55e668f8b23a7241a4a67faa8d.md -->

#### 核心故障镜像 (Trigger)
MongoDB 启动时出现警告，提示使用的文件系统和内核参数设置可能导致性能问题。

#### 检测探针 (Observation)
在 MongoDB 启动日志中观察到以下警告：
- 推荐使用 XFS 文件系统。
- `vm.max_map_count` 设置过低。

#### 根因推演 (Hypothesis)
- 因为 WiredTiger 存储引擎在 XFS 文件系统上具有更好的可扩展性和性能特性。
- `vm.max_map_count` 控制进程可以拥有的最大内存映射区域数，设置过低可能限制 MongoDB 的内存使用能力，导致性能下降。

#### 战术执行与修复 (Resolution Path)
- 切换到 XFS 文件系统以提高 WiredTiger 的性能（如果可能）。
- 调整 `vm.max_map_count` 参数：
  - 临时调整：使用命令 `sudo sysctl -w vm.max_map_count=262144`。
  - 永久调整：编辑 `/etc/sysctl.conf` 文件，添加 `vm.max_map_count=262144`，然后运行 `sudo sysctl -p` 应用更改。

---

### 画像 13 · 鲲鹏 BoostKit · MongoDB 调优指南（官方）
<!-- source: distillation/data/generated_skills/official/skill_kunpeng_boostkit_mongodb_tuning_guide.md -->

#### 核心故障镜像 (Trigger)
在鲲鹏服务器上运行MongoDB时，可能会遇到性能瓶颈，尤其是在高负载或大规模数据处理时，表现为系统响应缓慢或资源利用率不均衡。

#### 检测探针 (Observation)
- 使用`systemctl status firewalld.service`检查防火墙状态。
- 使用`df -h /root`或`lsblk`查看分区大小。
- 使用`cmake --version`和`gcc --version`检查CMake和GCC版本。
- 使用`ps -ef | grep mongod`查看MongoDB进程状态。
- 使用`netstat -anpt`查看MongoDB监听端口。
- 使用`sysctl -p`应用网络参数调整。

#### 根因推演 (Hypothesis)
在Kunpeng ARM64架构上，MongoDB的性能可能受到以下因素的影响：
1. 防火墙未关闭可能导致网络通信延迟。
2. 分区大小不足可能导致磁盘I/O瓶颈。
3. CMake和GCC版本过低可能导致编译效率低下。
4. 网络参数未优化可能导致连接数限制和数据传输效率低下。
5. BIOS设置未优化可能导致内存和I/O性能不佳。

#### 战术执行与修复 (Resolution Path)
1. 关闭防火墙以减少网络延迟：
   ```bash
   systemctl stop firewalld.service
   systemctl disable firewalld.service
   ```

2. 确保分区大小足够：
   ```bash
   df -h /root
   lsblk
   ```

3. 升级CMake和GCC版本：
   ```bash
   yum install -y cmake gcc
   ```

4. 优化网络参数：
   ```bash
   echo "8192" > /proc/sys/net/ipv4/tcp_max_syn_backlog
   echo "1024" > /proc/sys/net/core/somaxconn
   echo "16777216" > /proc/sys/net/core/rmem_max
   echo "16777216" > /proc/sys/net/core/wmem_max
   echo "4096 87380 16777216" > /proc/sys/net/ipv4/tcp_rmem
   echo "4096 65536 16777216" > /proc/sys/net/ipv4/tcp_wmem
   echo "360000" > /proc/sys/net/ipv4/tcp_max_tw_buckets
   sysctl -p
   ```

5. 调整BIOS设置以关闭SMMU和预取功能：
   - 进入BIOS设置界面，关闭SMMU和预取功能。

通过这些调整，可以有效提升MongoDB在Kunpeng ARM64架构上的性能和稳定性。

---

### 画像 14 · 鲲鹏 · 系统崩溃 / OOM / 内存泄漏 排查（官方手册）
<!-- source: distillation/data/generated_skills/official/skill_kunpeng_troubleshooting_manual.md -->

#### 核心故障镜像 (Trigger)
在鲲鹏平台上运行的某软件出现系统崩溃、死锁、内存泄漏、OOM、进程异常结束等问题。

#### 检测探针 (Observation)
1. 使用 `kdump` 服务配置和 `vmcore` 文件生成来捕获系统崩溃信息。
2. 使用 `GDB`、`jstack`、`jmap`、`jstat` 等工具分析进程状态和内存使用。
3. 检查 `/proc/meminfo` 和 `slabtop` 以监控内存使用情况。
4. 使用 `top` 命令查看进程的CPU和内存占用情况。

#### 根因推演 (Hypothesis)
1. 系统崩溃可能由于内核死锁或符号冲突导致。
2. 内存泄漏可能是由于程序中未释放的动态分配内存。
3. OOM 问题可能是由于内存消耗过大，未及时释放。
4. 进程异常结束可能是由于访问非法内存地址或信号处理不当。

#### 战术执行与修复 (Resolution Path)
1. **配置kdump服务**：
   ```bash
   yum install kexec-tools -y
   vi /etc/default/grub
   # 添加或修改GRUB_CMDLINE_LINUX中的“crashkernel”参数
   grub2-mkconfig -o /boot/efi/EFI/openEuler/grub.cfg
   systemctl start kdump.service
   systemctl enable kdump.service
   ```

2. **内核参数配置**：
   ```bash
   echo 1 > /proc/sys/kernel/hung_task_panic
   echo 60 > /proc/sys/kernel/hung_task_timeout_secs
   echo 1 > /proc/sys/kernel/softlockup_panic
   echo 1 > /proc/sys/vm/panic_on_oom
   echo 1 > /proc/sys/kernel/panic_on_warn
   ```

3. **内存泄漏检测与修复**：
   - 使用鲲鹏性能分析工具进行内存泄漏诊断。
   - 在代码中增加内存释放逻辑，例如：
     ```c
     free(p);
     p = NULL;
     ```

4. **OOM问题解决**：
   - 调整应用程序的内存使用逻辑，确保及时释放不再使用的内存。
   - 使用 `ulimit` 命令调整系统资源限制：
     ```bash
     ulimit -c unlimited
     echo "/home/core.%e.%p.%t" > /proc/sys/kernel/core_pattern
     ```

5. **进程异常结束调试**：
   - 使用 `GDB` 调试生成的 core 文件，定位异常结束的原因。
   - 修改代码逻辑，避免非法内存访问或信号处理错误。
