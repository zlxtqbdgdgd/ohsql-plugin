# WiredTiger 核心热点函数源码注解 (MongoDB 7.0.31)

> 来源：`mongo-src-7.0.31/src/third_party/wiredtiger/`，真实行号已按 v7.0.31 校对。
> 用途：当火焰图输出 Top-N 热点函数时，运维同学可以用这份文档把函数映射成「行为→瓶颈→对应配置项→修复方向」。

关键词（RAG 检索锚点）：`__wt_evict` `__wt_cache_eviction_worker` `__evict_reconcile` `__wt_checkpoint` `__checkpoint_tree` `__wt_txn_checkpoint` `__wt_cache_eviction_check` `__wt_spin_lock` `__wt_spin_trylock` WiredTiger eviction reconcile checkpoint spinlock 驱逐 检查点 热点 火焰图 dirty page THP transparent huge page cacheSizeGB eviction_trigger eviction_target rollback-to-stable

---

## 一、Eviction（页面驱逐）路径

WT cache 使用率越过 `eviction_trigger`（默认 95%）时，**应用线程被强制参与驱逐**，直接放大用户查询延迟。这是 "CPU 飙升 + 查询变慢" 最常见的根因之一。

### 1. `__wt_cache_eviction_check`

- **源码**：`src/third_party/wiredtiger/src/include/cache_inline.h:449`
- **调用方**：任何进入 eviction 判定的代码路径（例如每次 page 访问）
- **行为**：快速检查当前 cache 填充度，决定是否要触发驱逐
- **关键源码片段**：
  ```c
  // cache_inline.h
  return (__wt_cache_bytes_plus_overhead(cache, cache->bytes_hs_dirty) >=
          ((uint64_t)(cache->eviction_dirty_trigger * bytes_max) / 100));
  ```
- **性能影响**：内联函数，单次调用开销极低；但**调用频次极高**，当 cache 压力大时，整条热路径会被 `__wt_cache_eviction_check → __wt_cache_eviction_worker` 占据
- **关联配置**：`eviction_trigger`（默认 95）、`eviction_dirty_trigger`（默认 20）

### 2. `__wt_cache_eviction_worker`

- **源码**：`src/third_party/wiredtiger/src/evict/evict_lru.c:2494`
- **行为**：**应用线程亲自驱逐**的入口。当专用 eviction 线程跟不上 dirty-page 产生速度时，WT 让应用线程下场自救
- **关键源码片段**：
  ```c
  // evict_lru.c:2587
  max_progress = busy ? 5 : 20;
  ```
  解释：若线程已经在忙（`busy=true`），每次最多只驱逐 5 个页面后立刻返回避免进一步阻塞用户请求；否则最多 20 个
- **性能影响**：**用户查询线程被迫同步做驱逐 → 延迟直接放大**，这是 `serverStatus().wiredTiger.cache["application threads page evicted"]` 计数器上涨的直接原因
- **火焰图特征**：在应用栈（worker thread）里占 15%-40%，同时会把 `__wt_evict` / `__evict_reconcile` 一起带上来
- **关联配置**：`cacheSizeGB`（加 cache）、`eviction=(threads_min=4,threads_max=8)`（加专用驱逐线程）

### 3. `__wt_evict`

- **源码**：`src/third_party/wiredtiger/src/evict/evict_page.c:190`
- **函数签名**：`int __wt_evict(WT_SESSION_IMPL *session, WT_REF *ref, uint8_t previous_state, uint32_t flags)`
- **行为**：驱逐单个页面的主逻辑。获取页面独占锁 → hazard pointer 检查 → 若 dirty 调用 `__evict_reconcile` 写回 → 释放内存
- **性能影响**：干净页很快（纯内存释放）；**脏页必须走 reconcile 路径，CPU+I/O 双重开销**
- **火焰图信号**：`__wt_evict` 占比高 + 下方有 `__evict_reconcile` → 当前负载是"脏页主导"，该加 cache/降写入速度；只有 `__wt_evict` 没有 reconcile → "干净页驱逐"，多半是 cache 配小了但写少

### 4. `__evict_reconcile`

- **源码**：`src/third_party/wiredtiger/src/evict/evict_page.c:773`
- **函数签名**：`static int __evict_reconcile(WT_SESSION_IMPL *session, WT_REF *ref, uint32_t evict_flags)`
- **行为**：把脏页序列化成 disk image，做可见性处理（snapshot、history store），再交给块管理器写盘
- **性能特征**：**CPU 密集**（序列化、排序、checksum）+ **内存密集**（临时缓冲）+ **I/O 密集**（写盘）
- **THP 关联**：reconcile 过程中分配较大的临时缓冲区，`THP=always` 会触发 `khugepaged` 在后台合并大页，造成 `madvise` / 页迁移延迟放大 3-5 倍，表现为 reconcile 单次时长飙升
- **火焰图信号**：进入 reconcile 就意味着 dirty page 写回路径饱和，**往往伴随 `__wt_log_write` 激增**
- **关联配置**：`cacheSizeGB`、`eviction_dirty_trigger`、THP 状态

### 5. `__wt_evict_file`

- **源码**：`src/third_party/wiredtiger/src/evict/evict_file.c:16`
- **行为**：关闭/sync 文件时的批量驱逐（通常在 close、checkpoint 结束时触发）
- **火焰图信号**：在平时只是窄窄一条；**在 checkpoint 频繁的场景下，会和 `__checkpoint_tree` 串在一起变粗** → 典型"checkpoint 间隔过短"信号

---

## 二、Checkpoint（检查点）路径

Checkpoint 把 cache 里的脏页一次性同步到磁盘，是 WT 的"持久化脉搏"。间隔过短或 log_size 阈值过小 → 频繁 checkpoint 抢 I/O + CPU；间隔过长 → 单次 checkpoint 体量大，形成明显抖动。

### 6. `__wt_txn_checkpoint`

- **源码**：`src/third_party/wiredtiger/src/txn/txn_ckpt.c:1440`
- **函数签名**：`int __wt_txn_checkpoint(WT_SESSION_IMPL *session, const char *cfg[], bool waiting)`
- **行为**：公共入口，由后台 checkpoint server 线程或显式 `db.fsyncLock()` 调用
- **关联配置**：`checkpoint=(wait=60)`（MongoDB 默认 60 秒）、`checkpoint=(log_size=2GB)`

### 7. `__txn_checkpoint`

- **源码**：`src/third_party/wiredtiger/src/txn/txn_ckpt.c:974`
- **行为**：实际执行 checkpoint 的主过程：锁元数据 → 对所有 btree 逐个 `__checkpoint_tree` → 推进稳定时间戳 → 写 metadata
- **性能影响**：**期间元数据锁占用**，会阻塞 create/drop 等 DDL

### 8. `__checkpoint_tree`

- **源码**：`src/third_party/wiredtiger/src/txn/txn_ckpt.c:2174`
- **函数签名**：`static int __checkpoint_tree(WT_SESSION_IMPL *session, bool is_checkpoint, const char *cfg[])`
- **行为**：对单个 btree 做 checkpoint。调用 reconcile 把脏页落盘 → 调用 block manager 切换快照
- **火焰图信号**：`__checkpoint_tree` 粗 + `__evict_reconcile` 粗 → checkpoint 和 eviction 路径共享 reconcile，两者叠加意味着 **"写放大风暴"**
- **关联配置**：`checkpoint=(log_size=)`，log_size 越小 → checkpoint 越频繁 → 本函数占比越高

### 9. `__wt_checkpoint`

- **源码**：`src/third_party/wiredtiger/src/txn/txn_ckpt.c:2405`
- **行为**：文件级 checkpoint 入口（被 `__txn_checkpoint` 循环调用）

---

## 三、Spin Lock（自旋锁）路径

### 10. `__wt_spin_lock` / `__wt_spin_trylock`

- **源码**：`src/third_party/wiredtiger/src/include/mutex_inline.h`
  - SPINLOCK_PTHREAD_MUTEX 平台：`trylock` 在 67/155/231，`lock` 在 79/167/244（按 build 选一个）
  - 常见 Linux 默认走 `SPINLOCK_PTHREAD_MUTEX_ADAPTIVE`（167 / 244）
- **行为**：封装 `pthread_mutex_lock`，WT 内部 hot path 的同步原语
- **性能特征**：
  - **内核 futex 争用** 表现为 `__wt_spin_lock → pthread_mutex_lock → futex_wait`
  - **用户态自旋** 表现为 `__wt_spin_trylock → pthread_mutex_trylock` 在热点路径上反复出现
- **火焰图信号**：总占比 > 10% 通常意味着**热点 btree 页写竞争**或 **dhandle 共享锁竞争**。在 ARM / 鲲鹏 上，CAS 开销比 x86 大，这一项更敏感
- **关联配置**：`conn->hash_size`、`eviction=(threads_max=N)`、业务层面要考虑分集合/分 shard

---

## 四、火焰图 → 源码 → 修复 速查表

| 火焰图 Top 函数 | 源码文件:行 | 最可能根因 | 一线修复 |
|:---|:---|:---|:---|
| `__wt_cache_eviction_worker` > 20% | evict_lru.c:2494 | WT cache 太小 / 写压力大 | 调大 `cacheSizeGB` 到物理内存 60% |
| `__evict_reconcile` > 15% | evict_page.c:773 | 脏页驱逐风暴 | 关闭 THP + 调大 `eviction_dirty_trigger` |
| `__checkpoint_tree` > 10% | txn_ckpt.c:2174 | checkpoint 过于频繁 | 调大 `checkpoint=(log_size=)` 和 `(wait=)` |
| `__wt_spin_lock` > 10% | mutex_inline.h | 并发写同一集合 / 锁竞争 | 分集合、加索引减短临界区 |
| `__wt_evict + __evict_reconcile` 成对 | evict_page.c | dirty page 驱逐主导 | cache 扩容 + 慢查询优化 |
| `__wt_evict` 无 reconcile | evict_page.c:190 | 干净页驱逐（读热） | cache 扩容即可 |

---

## 五、典型复合故障：写放大风暴

当同时出现以下三条，**就是本项目 demo 的 `eviction_checkpoint_storm` 场景**：

1. `__wt_cache_eviction_worker` + `__evict_reconcile` 合计 > 30%（eviction 失控）
2. `__checkpoint_tree` > 10%（checkpoint 太频）
3. `__wt_spin_lock` > 8%（并发写竞争）

根因链条：**cacheSizeGB 偏小 → dirty trigger 常态触发 → 应用线程下场驱逐 → 同时 checkpoint 又在抢 reconcile 路径 → THP 放大每次 reconcile 延迟 → 用户查询线程被连环阻塞**。

对应修复（按优先级）：
1. [CRITICAL] 关闭 THP：`echo never > /sys/kernel/mm/transparent_hugepage/enabled`
2. [CRITICAL] 扩 WT cache：`db.adminCommand({setParameter:1, wiredTigerEngineRuntimeConfig:"cache_size=4096M"})`
3. [WARNING] 调大 checkpoint log_size：`wiredTigerEngineRuntimeConfig:"checkpoint=(log_size=2GB,wait=60)"`
4. [WARNING] 关闭 numa_balancing：`echo 0 > /proc/sys/kernel/numa_balancing`（鲲鹏 NUMA 抖动敏感）

---

## 参考

- MongoDB 7.0.31 源码：`mongodb/mongo` 仓库 tag `r7.0.31`
- WiredTiger optrack 工具：`src/third_party/wiredtiger/src/docs/tool-optrack.dox`（注意其第 338 行提到 `__wt_cache_eviction_worker` 超过 15ms 的观测方法）
