# MongoDB on Kunpeng 920 · 调优规则集(业界首份公开拼装版)

> **为什么有这份文档?**
>
> Huawei BoostKit 公开覆盖 **MySQL / openGauss / Redis** 的 Kunpeng 调优指南,
> 但 **MongoDB 缺席**。我们把三份权威来源拼起来,形成业界第一份可复现的
> Mongo-on-Kunpeng 调优规则集:
>
> 1. [Ampere MongoDB Tuning Guide](https://amperecomputing.com/tuning-guides/mongoDB-tuning-guide)
>    —— 另一家 ARM64 厂商的通用 ARM MongoDB 建议
> 2. [MongoDB Production Notes](https://www.mongodb.com/docs/manual/administration/production-notes/)
>    —— MongoDB 官方生产环境清单
> 3. Kunpeng 920 NUMA 拓扑(4 节点/双路 · [Chips and Cheese 架构分析](https://chipsandcheese.com/p/huaweis-kunpeng-920-and-taishan-v110))
>    + openEuler MySQL 调优指南的 scheduler knobs
>
> 本文档只做**拼装**,不做创造;每条建议都可追到上述权威出处之一。

---

## 一、MongoDB 版本分界(关键!)

| Mongo 版本 | THP 期望 | 依据 |
|---|---|---|
| ≤ 7.0 | `never` | MongoDB v7.0 "Disable Transparent Huge Pages" 页面明确要求 |
| ≥ 8.0 | `always` | MongoDB v8.0 "Transparent Huge Pages" 页面改为要求启用(WiredTiger 改造) |

**硬编码 "THP=never" 在 Mongo 8.0+ 实例上是误报。** 规则必须 version-aware
(perf-kp-sql v0.3 已实装 · 参考 `os.thp.kernel_mode`)。

---

## 二、Kunpeng 920 专属(BIOS + kernel 层)

### 2.1 · BIOS 设置(surfaceable_only · shell 不可改)

| 参数 | 建议值 | 依据 |
|---|---|---|
| SMMU | **关闭** | [openEuler MySQL 指南](https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html) |
| CPU Prefetching | **关闭**(DB 场景) | [Huawei Kunpeng CPU/Memory Tuning](https://www.cnblogs.com/huaweicloud/p/11861191.html) |

检测:`dmesg | grep -i smmu`(空 = SMMU 关闭)。

### 2.2 · NUMA 布局(双路 = 4 节点,必做绑核)

Kunpeng 920 双路 = 2 socket × 2 SCCL(super-chip cluster locality)= **4 NUMA 节点**。
与 Graviton(1/socket 均匀)、x86(2 节点)**都不一样**。

**建议部署**(每 NUMA 节点独立 mongod 分片):

```bash
# 4 节点 · 4 mongod 分片
numactl --cpunodebind=0 --membind=0 mongod --config /etc/mongod-shard0.conf &
numactl --cpunodebind=1 --membind=1 mongod --config /etc/mongod-shard1.conf &
numactl --cpunodebind=2 --membind=2 mongod --config /etc/mongod-shard2.conf &
numactl --cpunodebind=3 --membind=3 mongod --config /etc/mongod-shard3.conf &
```

**必须**先关自动平衡:

```bash
echo 0 > /proc/sys/kernel/numa_balancing
```

依据:perf-kp-sql `kunpeng.numa.balancing` 规则 · Huawei Kunpeng NUMA 5-Step Tuning。

### 2.3 · IRQ / NIC(Hi1822)

```bash
# 停掉 irqbalance,手动绑定 NIC IRQ 到非 DB 核
systemctl stop irqbalance
# NIC 中断绑到 cores 91-95(openEuler MySQL 指南配置 · 鲲鹏 96 核双路示例)
for irq in $(cat /proc/interrupts | grep <nic> | awk '{print $1}' | tr -d ':'); do
  echo 91-95 > /proc/irq/$irq/smp_affinity_list
done

# NIC ring buffer 最大化(Hi1822 max 4096)
ethtool -G <nic> rx 4096 tx 4096

# NIC combined queue ≥ NUMA 节点数
ethtool -L <nic> combined 4
```

依据:[Huawei Kunpeng Redis Ring Buffer Tuning](https://support.huaweicloud.com/tngg-kunpengbds/kunpengredishdp_05_0011.html)
(Redis 规则直接类推 MongoDB)。

### 2.4 · openEuler kernel(若使用 openEuler)

```bash
# grubby 写入 kernel cmdline,重启生效
grubby --update-kernel=ALL --args='sched_steal_node_limit=4'
grubby --update-kernel=ALL --remove-args='nohz=off'

# 运行时启用 STEAL 调度器特性
echo STEAL > /sys/kernel/debug/sched_features
```

依据:[openEuler MySQL 性能调优指南](https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html)(Mongo 类推)。

---

## 三、ARM64 通用(所有 ARM64 适用)

### 3.1 · LSE atomics 三连查(ARM64 DB 吞吐最大杠杆)

发行版自带的 MongoDB 包**经常没带** `-moutline-atomics` 或 `-march=armv8.2-a+`,
在 ARM64 上吞吐腰斩。必查三件套:

```bash
# 1. CPU 支持?
lscpu | grep atomics
# Flags 行应含 "atomics"(Armv8.1 LSE)

# 2. 内核识别?
dmesg -T | grep -i LSE
# 启动日志应有 "LSE atomics supported" / "CPU features: LSE"

# 3. mongod 二进制带 LSE opcode?
objdump -d $(command -v mongod) | grep -cE '[[:space:]](cas|casa|casal|ldadd|swp|ldset)[[:space:]]'
# 应 > 0(通常数千条)· 若 = 0,换装带 LSE 的构建
```

依据:[AWS Graviton Technical Guide · C/C++ LSE](https://github.com/aws/aws-graviton-getting-started/blob/main/c-c%2B%2B.md)。
perf-kp-sql v0.3 已实装三条规则(`arm64.lse.cpu_flag` / `arm64.lse.kernel_enabled` /
`arm64.lse.db_binary_opcodes`)。

### 3.2 · 内核页大小(可选 · 先测收益再改)

```bash
getconf PAGESIZE
# 典型 4096(4K) · 大 buffer DB 可选 64K
# 先用 perf stat -e stall_frontend_tlb,stall_backend_tlb 测 TLB stall · 再决定
```

依据:[Ampere ARM64 Page Size Guide](https://amperecomputing.com/tuning-guides/understanding-memory-page-sizes-on-arm64)。

---

## 四、MongoDB 通用 sysctl(官方要求)

| 参数 | 值 | 依据 | perf-kp-sql 规则 |
|---|---|---|---|
| `vm.zone_reclaim_mode` | `0` | MongoDB Prod Notes | `os.vm.zone_reclaim_mode` |
| `vm.swappiness` | `1` | MongoDB Prod Notes | `os.vm.swappiness` |
| `vm.max_map_count` | `≥ 128000` | Ampere Mongo | `os.vm.max_map_count` |
| `net.ipv4.tcp_keepalive_time` | `120` | MongoDB Prod Notes | `os.net.tcp_keepalive_time` |
| `net.core.somaxconn` | `≥ 65535` | Ampere Mongo | `os.net.somaxconn` |
| ulimit nofile | `≥ 64000` | MongoDB Prod Notes / Ampere | (Phase 2 实装) |
| 数据 FS | `XFS`(不是 ext4) | MongoDB Prod Notes | (Phase 2 实装) |
| 块设备 readahead | `8–32` sectors | MongoDB Prod Notes | (Phase 2 实装) |
| 启动 flag | `numactl --interleave=all mongod` | MongoDB Prod Notes(单实例非分片场景) | (Phase 2 实装) |

---

## 五、WiredTiger 压缩算法(鲲鹏敏感)

| compressor | Kunpeng 建议 | 依据 |
|---|---|---|
| `snappy` | ✅ 默认推荐 | Kunpeng BoostKit 类推 |
| `zstd` | ✅ 可选(压缩比更高) | MongoDB 4.2+ |
| `zlib` | ❌ Kunpeng 上 CPU 消耗显著高 | perf-kp-sql `mongo.config.wt_block_compressor` + Huawei BoostKit |

MongoDB 里配置:

```yaml
# mongod.conf
storage:
  wiredTiger:
    collectionConfig:
      blockCompressor: snappy  # 或 zstd · 禁用 zlib
```

---

## 六、与 perf-kp-sql 规则的对应表

| 本文档章节 | 对应规则 id |
|---|---|
| 一 · THP 版本分界 | `os.thp.kernel_mode`(version-aware) |
| 2.1 BIOS · SMMU/Prefetch | (BIOS surfaceable · Phase 2 实装) |
| 2.2 NUMA 4 节点 | `kunpeng.numa.topology` · `kunpeng.numa.distance_matrix` · `kunpeng.numa.balancing` |
| 2.3 IRQ / NIC | `kunpeng.irqbalance.active`(NIC ring buffer / queue · Phase 2) |
| 2.4 openEuler kernel | `openeuler.sched.steal_node_limit` · `openeuler.sched.feature_steal` · `openeuler.cmdline.nohz` |
| 3.1 LSE atomics | `arm64.lse.cpu_flag` · `arm64.lse.kernel_enabled` · `arm64.lse.db_binary_opcodes` |
| 3.2 页大小 | `arm64.kernel.page_size`(INFO) |
| 四 · sysctls | `os.vm.swappiness` · `os.vm.zone_reclaim_mode` · `os.vm.max_map_count` · `os.net.somaxconn` · `os.net.tcp_keepalive_time` |
| 五 · 压缩算法 | `mongo.config.wt_block_compressor` |

---

## 七、**我们做了什么独门的事?**

- **LSE atomics 三连查** —— 业界 DB 工具**全线不查**(Datadog / pganalyze / PMM /
  Mongo Atlas)· 我们是第一个
- **Kunpeng 4-NUMA 距离矩阵感知** —— 不硬编码节点数 · 读 `numactl -H` 距离矩阵
- **THP 版本感知** —— Mongo 8.0 的分界线 · 业界静态规则会误报
- **openEuler 独门 knob** —— `sched_steal_node_limit` / STEAL feature 只有
  openEuler 内核有
- **Mongo-on-Kunpeng 调优规则集** —— Huawei BoostKit 缺席,这是业界**第一份**
  公开可复现版本

---

## 参考文献

- MongoDB Production Notes: https://www.mongodb.com/docs/manual/administration/production-notes/
- MongoDB v7.0 Disable THP: https://www.mongodb.com/docs/v7.0/tutorial/transparent-huge-pages/
- MongoDB v8.0 THP Note: https://www.mongodb.com/docs/v8.0/tutorial/transparent-huge-pages/
- Ampere MongoDB Tuning: https://amperecomputing.com/tuning-guides/mongoDB-tuning-guide
- Ampere MySQL Tuning: https://amperecomputing.com/tuning-guides/mysql-tuning-guide
- Ampere Redis Tuning: https://amperecomputing.com/en/tuning-guides/Redis-setup-and-tuning-guide
- Ampere ARM64 Page Size: https://amperecomputing.com/tuning-guides/understanding-memory-page-sizes-on-arm64
- AWS Graviton Technical Guide: https://aws.github.io/graviton/
- AWS Graviton C/C++ LSE: https://github.com/aws/aws-graviton-getting-started/blob/main/c-c%2B%2B.md
- Huawei Kunpeng CPU/Memory Tuning: https://www.cnblogs.com/huaweicloud/p/11861191.html
- Huawei Kunpeng NUMA 5-Step: https://www.cnblogs.com/huaweicloud/p/12166354.html
- Huawei Kunpeng Redis: https://support.huaweicloud.com/tngg-kunpengbds/kunpengredishdp_05_0011.html
- openEuler MySQL Tuning: https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html
- Chips and Cheese Kunpeng 920: https://chipsandcheese.com/p/huaweis-kunpeng-920-and-taishan-v110
