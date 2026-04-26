---
authority: project_case
authority_level: ⭐⭐ 项目实战案例
last_verified: 2026-04-10
---

# Linux IO 调度器与 MongoDB 存储适配

## IO 调度器类型

Linux 提供多种 IO 调度器，不同调度器适用于不同的存储硬件和工作负载：

| 调度器 | 适用场景 | 特点 |
|--------|---------|------|
| none/noop | NVMe SSD | 零重排序，最低延迟 |
| mq-deadline | SATA SSD | 保证读写截止时间 |
| bfq | HDD / 桌面 | 公平带宽分配 |
| cfq | 传统 HDD | 完全公平队列（已被废弃） |

## MongoDB 推荐配置

### SSD 存储（含 NVMe）
```bash
# 查看当前调度器
cat /sys/block/sda/queue/scheduler

# 设置为 none（NVMe 通常已默认）
echo none > /sys/block/sda/queue/scheduler

# 持久化
echo 'ACTION=="add|change", KERNEL=="sd*", ATTR{queue/scheduler}="none"' > /etc/udev/rules.d/60-scheduler.rules
```

### HDD 存储
```bash
echo mq-deadline > /sys/block/sda/queue/scheduler
```

## 为什么 CFQ 对 MongoDB 有害

CFQ (Completely Fair Queuing) 调度器会对 IO 请求进行公平排队。但 MongoDB 的 WiredTiger 引擎产生的是高度随机的 4KB IO 模式，CFQ 的排队机制会引入 2-5ms 的额外延迟，在高并发场景下严重影响 P99 延迟。

## 读写预读 (readahead) 调优

MongoDB 建议将预读值降低到 32 个扇区：
```bash
blockdev --setra 32 /dev/sda
```

过大的预读值会导致不必要的数据预取，浪费 IO 带宽和内存。

## 参考来源
- MongoDB Storage FAQ: https://www.mongodb.com/docs/manual/faq/storage/
- Linux Block Layer: https://www.kernel.org/doc/Documentation/block/
- Red Hat Performance Guide: https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/8/html/monitoring_and_managing_system_status_and_performance
