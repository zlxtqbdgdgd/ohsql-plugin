---
authority: project_case
authority_level: ⭐⭐ 项目实战案例
last_verified: 2026-04-10
---

# MongoDB 性能分析与火焰图方法论

## perf 工具采集流程

perf 是 Linux 内核自带的性能分析工具，可以采集进程的 CPU 调用栈热点。

### 基础采集命令
```bash
# 采集 mongod 进程 10 秒的 CPU 调用栈（采样频率 99Hz）
perf record -F 99 -p $(pgrep mongod) -g -- sleep 10

# 生成文本格式的调用栈
perf script > perf.stacks

# 折叠堆栈并生成火焰图 SVG
stackcollapse-perf.pl perf.stacks | flamegraph.pl > flamegraph.svg
```

### 采样频率选择
- 99Hz：标准采样频率，约 3% CPU 额外开销
- 199Hz：高精度采样，约 5% 额外开销
- 49Hz：低开销采样，适合生产环境长时间监控

## 常见 MongoDB 热点函数解读

### 1. __wt_cache_evict_server / __wt_spin_lock
**含义**：WiredTiger 缓存驱逐线程在自旋等待
**根因**：脏页比例超过 eviction_target 水位，驱逐线程忙不过来
**修复**：
```javascript
db.adminCommand({
  setParameter: 1,
  wiredTigerEngineRuntimeConfig: "eviction=(threads_max=4),eviction_target=80"
})
```

### 2. __wt_txn_checkpoint / __os_file_write
**含义**：Checkpoint 期间大量同步 IO 写入
**根因**：Checkpoint 间隔太短或 journal 太大
**修复**：调整 `storage.wiredTiger.engineConfig.checkpointSizeMB`

### 3. SSL_do_handshake / __pthread_mutex_lock
**含义**：TLS 握手的互斥锁竞争
**根因**：短连接风暴导致频繁的 TLS 握手
**修复**：应用层启用连接池复用

### 4. BtreeCursor::advance / __wt_page_in_func
**含义**：B-tree 游标推进时频繁缺页
**根因**：缺少索引导致集合扫描
**修复**：通过 explain() 分析查询计划并添加索引

## Off-CPU 分析

除了 CPU 热点，Off-CPU 分析可以发现阻塞在 IO、锁等待上的时间：
```bash
# 使用 bcc/BPF 工具
offcputime-bpfcc -p $(pgrep mongod) 10 > offcpu.stacks
```

## 参考来源
- Brendan Gregg's Flame Graphs: https://www.brendangregg.com/flamegraphs.html
- perf Examples: https://www.brendangregg.com/perf.html
- MongoDB Performance Troubleshooting: https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/
