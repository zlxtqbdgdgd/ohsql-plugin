---
authority: project_case
authority_level: ⭐⭐ 项目实战案例
last_verified: 2026-04-10
---

# MongoDB 调优知识库 — WiredTiger 缓存与内存管理

## WiredTiger Cache 配置原则

### 默认行为
WiredTiger 存储引擎默认使用以下公式计算最大缓存：
- `max(256MB, (总内存 - 1GB) * 50%)`

### 常见问题

#### 1. Cache 过大导致 OOM
当多个服务共存时，WiredTiger 的默认 50% 内存占用可能导致 OOM Killer 介入。

**解决方案**：
```javascript
// 动态调整（立即生效）
db.adminCommand({setParameter: 1, wiredTigerEngineRuntimeConfig: "cache_size=2G"})

// 永久配置（需重启）
// mongod.conf:
// storage:
//   wiredTiger:
//     engineConfig:
//       cacheSizeGB: 2
```

#### 2. Eviction 自旋锁 (__wt_spin_lock)
当脏页比例超过 eviction_target 水位时，WiredTiger 的驱逐线程会疯狂自旋等待刷盘完成。
火焰图表现为 `__wt_cache_evict_server → __wt_spin_lock` 占用 80%+ CPU。

**解决方案**：
```javascript
// 调低驱逐触发水位，增加驱逐工作线程
db.adminCommand({
    setParameter: 1,
    wiredTigerEngineRuntimeConfig: "eviction=(threads_max=4),eviction_target=80"
})

// 验证
db.serverStatus().wiredTiger.cache
```

#### 3. 大页（HugePages）与 WiredTiger
WiredTiger 自身不使用 Linux HugePages。但如果同机部署的其他服务（如 GaussDB）配置了 `shared_buffers` 依赖大页，需确保 `vm.nr_hugepages` 足够覆盖。

### NUMA 绑核建议
在多 NUMA 节点的鲲鹏服务器上，MongoDB 的 mongod 进程应绑定到单个 NUMA 节点以避免远端内存访问延迟：
```bash
numactl --cpunodebind=0 --membind=0 mongod --config /etc/mongod.conf
```

同时需关闭 NUMA Balancing：
```bash
echo 0 > /proc/sys/kernel/numa_balancing
```

### 参考来源
- MongoDB WiredTiger Storage Engine: https://www.mongodb.com/docs/manual/core/wiredtiger/
- WiredTiger Tuning: https://source.wiredtiger.com/develop/tune_cache.html
