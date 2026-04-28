# mongo-flame-signature-storage-engine-wt

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 7 条 case。

---

## WiredTiger 应用线程被迫参与 eviction 助手(cache 使用率超阈值压力 signature)

**case_id**: `wt-app-thread-evict-assist-pressure-01`
**来源**: [https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/MongoDB%E5%9C%A8%E7%BA%BF%E8%B0%83%E6%95%B4cache_size%E6%85%A2%E7%9A%84%E6%B7%B1%E5%BA%A6%E5%88%86%E6%9E%90.md](https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/MongoDB%E5%9C%A8%E7%BA%BF%E8%B0%83%E6%95%B4cache_size%E6%85%A2%E7%9A%84%E6%B7%B1%E5%BA%A6%E5%88%86%E6%9E%90.md) (community-canonical)
**平台**: bare
**scope**: storage-engine-wt

**signature_type**: function-prefix
**match_layer**: function
**pattern_regex**: ``^__wt_cache_eviction_.*``

### 火焰图原文模式
> * __wt_cache_eviction_check -- *     如果 cache 使用量超过阈值，阻塞应用线程， *     强制其参与 eviction

### 机制
> 如果 cache 使用量超过阈值，阻塞应用线程， 强制其参与 eviction
WiredTiger 在每次应用线程进入用户 API 路径前会调 `__wt_cache_eviction_check`,该函数读取 cache 当前使用率与配置阈值,若超过 eviction trigger,则把应用线程"借调"成临时 eviction worker,通过 `__wt_cache_eviction_worker` 循环逐出页面直到压力降到阈值以下或超时。机制本质是用应用线程算力代偿 evict-server / evict-worker 的逐出带宽不足。

### 负载含义
> 总耗时: 几百毫秒到几秒
火焰图中若 `__wt_cache_eviction_check` / `__wt_cache_eviction_worker` 函数显著出现在应用查询线程(insert / update / find)栈帧中,说明 cache 使用率已超过 eviction trigger,应用线程正在被迫代偿做脏页逐出,单次操作耗时从正常的几毫秒膨胀到几百毫秒到几秒,客户端会明显感受到延迟严重。常见诱因:在线下调 cache_size、突发大批量写入、checkpoint 与高负载叠加。

### 调优方向
- (#1) ``storage.wiredTiger.engineConfig.configString` (eviction_trigger / eviction_dirty_trigger)` [high]
  > "wiredTigerEngineRuntimeConfig: \"eviction_trigger=80,eviction_dirty_trigger=15\""
- (#2) ``storage.wiredTiger.engineConfig.cacheSizeGB`` [high]
  > "第一次: 8GB → 6GB (等待 1-2 分钟)"
- (#3) [high]
  > "在调整 cache_size 之前，手动触发 checkpoint"

---

## WiredTiger io_capacity 配置语法错误后,后台 eviction 线程经 capacity_throttle 调用 __wt_cond_signal 解引用 NULL capacity_cond 触发 SIGSEGV

**case_id**: `wt-capacity-throttle-cond-signal-crash-01`
**来源**: [https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/MongoDB_io_capacity_crash%E5%AE%8C%E6%95%B4%E4%BF%AE%E5%A4%8D%E6%96%B9%E6%A1%88.md](https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/MongoDB_io_capacity_crash%E5%AE%8C%E6%95%B4%E4%BF%AE%E5%A4%8D%E6%96%B9%E6%A1%88.md) (community-canonical)
**平台**: bare
**scope**: storage-engine-wt

**signature_type**: stack-pattern
**match_layer**: stack-frame-pattern
**pattern_regex**: ``(__wt_capacity_throttle\`

### 火焰图原文模式
> T9: __wt_capacity_throttle() 被调用 ↓ T10: __capacity_signal() 尝试发送信号 ↓ T11: __wt_cond_signal(conn->capacity_cond)

### 机制
> T5: capacity_cond条件变量未正确创建或保持为NULL
WiredTiger 的 `__capacity_config()` 在解析 `io_capacity=(total=...)` 子配置时若用户写错语法(如 `io_capacity=[total=200M]` 用方括号),`__wt_config_gets("io_capacity.total", &cval)` 返回 `WT_NOTFOUND` 但代码继续推进,导致 `conn->capacity_cond` 条件变量未被正确初始化(保持 NULL 或野指针)。后台 eviction 线程 `__wt_evict_thread_run` 不知配置已损坏,继续以 `__wt_evict → __wt_reconcile → __wt_blkcache_write → __wt_block_write_off → __wt_capacity_throttle → __capacity_signal → __wt_cond_signal(conn->capacity_cond)` 链路执行 throttle 信号路径,在 `__wt_cond_signal` 内部访问 NULL+0x60 偏移触发 SIGSEGV。链路上**任意函数帧的火焰图共现**都强烈提示 io_capacity 配置错误后的崩溃前夜状态。

### 负载含义
> T13: 💥 Segmentation Fault!
火焰图(无论 on-CPU 还是事故后 core dump backtrace)中若 `__wt_capacity_throttle` / `__capacity_signal` / `__wt_cond_signal` 三者共现于 eviction worker / app 写入线程栈帧顶部,且伴随 `__wt_evict_thread_run` 或 `__wt_evict → __wt_reconcile → __wt_blkcache_write → __wt_block_write_off` 的下行链路,意味着 io_capacity 配置已通过 `wiredTigerEngineRuntimeConfig` 在线下发但语法错误,后续任何写入触发的 throttle 信号都会 NULL 解引用,workload 后果是**进程因 Signal 11 (SIGSEGV) 整体崩溃**(不仅是单请求失败而是整个 mongod 进程被 abruptQuitWithAddrSignal 杀死)。事故现场的 mongod.log 会出现 `Signal: 11 (Segmentation fault)` 与 `Invalid access at address: 0x60`。

### 调优方向
- (#1) ``storage.wiredTiger.engineConfig.configString` (io_capacity.total)` [high]
  > "io_capacity=(total=200M)"
- (#2) [high]
  > "在使用前检查NULL指针"
- (#3) [high]
  > "重启MongoDB清除错误状态"

---

## WiredTiger 冷数据 evict 后 checkpoint 不再处理 · compact 触发 reconciliation 强制回收

**case_id**: `wt-evict-cold-page-compact-cure-01`
**来源**: [https://github.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/blob/main/%E7%A3%81%E7%9B%98%E7%A9%BA%E9%97%B4%E6%B3%84%E6%BC%8F%E5%AE%9E%E9%AA%8C%E7%BB%93%E6%9E%9C%E5%88%86%E6%9E%90.md](https://github.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/blob/main/%E7%A3%81%E7%9B%98%E7%A9%BA%E9%97%B4%E6%B3%84%E6%BC%8F%E5%AE%9E%E9%AA%8C%E7%BB%93%E6%9E%9C%E5%88%86%E6%9E%90.md) (community-canonical)
**平台**: bare
**scope**: storage-engine-wt

**signature_type**: stack-pattern
**match_layer**: stack-frame-pattern
**pattern_regex**: ``(compact\`

### 火焰图原文模式
> 删除操作： - DELETE冷数据时 - 需要读取page到内存 - 删除后可能被evict（因为是冷数据） - 后续没有访问 - 🔥 Page不再进入内存 - 🔥 Checkpoint不会处理 - 🔥 磁盘空间不会被回收 > 解决： db.runCommand({compact: "collection"}) - 强制读取所有page - 触发reconciliation - 清理过时数据

### 机制
> 访问模式： - 热数据：最近1小时的数据（在cache中） - 温数据：最近1天的数据（偶尔在cache中） - 冷数据：7天前的数据（永远不在cache中）
WiredTiger cache 按温度分层使用：热数据稳定占据 cache，温数据偶尔命中，冷数据（7 天前）几乎永远不会被加载回内存。当对冷数据执行 DELETE 时虽然会临时把 page 读入并打上删除标记，但完成后该 page 极易被 evict 出 cache。后续应用层不再访问 → 这个被删除标记的 page 既不在脏页 list 也不会被任何 cursor scan 触达 → 内存里 reconciliation tree walk 完全跳过它 → 文件物理空间无法回收。在火焰图层面，这一类 workload 期间几乎看不到 `__wt_evict_*` / `__wt_reconcile_*` 在冷页区间的栈帧（除非走 `compact` 路径）。

### 负载含义
> ### 为什么生产环境会有问题？ > ``` 生产环境特点： - Cache: 几GB - 数据: 几百GB到几TB - Cache只能容纳1-5%的数据 - 大部分数据在磁盘上
生产环境 cache 与数据规模比通常只有 1%–5%，绝大部分 page 在磁盘上。这种容量比下，删除冷数据后几乎可以肯定 page 会被 evict 且不再被访问，磁盘文件大小持续大于逻辑数据量。火焰图上若 `compact` 不在运行而磁盘使用率仍在涨，就要把它当成 stack-pattern 信号——即 reconciliation 路径在冷页上长期缺失。

### 调优方向
- (#1) [high]
  > "定期执行compact（尤其是大量删除后）"
- (#2) [high]
  > "对于时间序列数据，考虑使用TTL或分区"
- (#3) ``storage.wiredTiger.engineConfig.cacheSizeGB`` [medium]
  > "合理配置cache大小"

---

## WiredTiger eviction reconcile 被多重 EBUSY 阻碍(__evict_review → __evict_reconcile 链路热点)

**case_id**: `wt-evict-reconcile-blocked-ebusy-01`
**来源**: [https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/MongoDB%E5%9C%A8%E7%BA%BF%E8%B0%83%E6%95%B4cache_size%E6%85%A2%E7%9A%84%E6%B7%B1%E5%BA%A6%E5%88%86%E6%9E%90.md](https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/MongoDB%E5%9C%A8%E7%BA%BF%E8%B0%83%E6%95%B4cache_size%E6%85%A2%E7%9A%84%E6%B7%B1%E5%BA%A6%E5%88%86%E6%9E%90.md) (community-canonical)
**平台**: bare
**scope**: storage-engine-wt

**signature_type**: stack-pattern
**match_layer**: stack-frame-pattern
**pattern_regex**: ``^__evict_(review\`

### 火焰图原文模式
> // ⚠️ 关键检查: 页面是否可以被逐出？ WT_ERR(__evict_review(session, ref, flags, &inmem_split)); >     // 🔥 如果页面是脏的，需要 reconcile if (!tree_dead && __wt_page_is_modified(page)) WT_ERR(__evict_reconcile(session, ref, flags));  // ← 耗时操作！

### 机制
> * __evict_reconcile -- *     对页面进行 reconcile（对账），准备写入磁盘 * *     这是 eviction 过程中最耗时的操作！
`__wt_evict` 入口先调 `__evict_review` 做可逐出性预检(refcount 是否 >1 / 是否被 pin / checkpoint 是否在处理 HS / WT_SESSION_NO_RECONCILE 标志等),通过则调 `__evict_reconcile`,后者再委托 `__wt_reconcile` 完成更新链合并 / 历史版本写 HS / 构建磁盘镜像 / 写 I/O 全流程,此 reconcile 阶段是 eviction 路径上最耗时的操作(原文标注"100ms+ per page")。

### 负载含义
> Eviction 线程尝试逐出 → 返回 EBUSY
火焰图中若 `__evict_review` / `__evict_reconcile` 在 eviction worker 线程栈帧持续高占比,且伴随 reconcile 调用栈(`__wt_reconcile`),说明 eviction 路径正在大量遭遇 EBUSY 阻碍(页面被 pin / checkpoint 处理 HS / 另一线程正在 reconcile / HS 脏内容压力)而无法快速完成逐出,可能与 cache_size 在线下调、checkpoint 处理 HS、或 HS 脏占比高时段叠加。表现为 cache 使用量降不下来、应用层操作延迟剧增。

### 调优方向
- (#1) [high]
  > "在调整 cache_size 之前，手动触发 checkpoint"
- (#2) ``storage.wiredTiger.engineConfig.configString` (eviction_trigger / eviction_dirty_trigger)` [high]
  > "wiredTigerEngineRuntimeConfig: \"eviction_trigger=80,eviction_dirty_trigger=15\""

---

## WiredTiger 行叶页 reconcile 路径下 tombstone 非全局可见 → 已删除数据被整页保留(oldest_timestamp 推进不足 signature)

**case_id**: `wt-reconcile-row-leaf-tombstone-not-globally-visible-01`
**来源**: [https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/%E4%B8%BA%E4%BB%80%E4%B9%88%E5%B7%B2%E5%88%A0%E9%99%A4%E6%95%B0%E6%8D%AE%E4%BB%8D%E5%9C%A8%E6%96%87%E4%BB%B6%E4%B8%AD_%E6%B7%B1%E5%BA%A6%E5%88%86%E6%9E%90.md](https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/%E4%B8%BA%E4%BB%80%E4%B9%88%E5%B7%B2%E5%88%A0%E9%99%A4%E6%95%B0%E6%8D%AE%E4%BB%8D%E5%9C%A8%E6%96%87%E4%BB%B6%E4%B8%AD_%E6%B7%B1%E5%BA%A6%E5%88%86%E6%9E%90.md) (community-canonical)
**平台**: bare
**scope**: storage-engine-wt

**signature_type**: stack-pattern
**match_layer**: stack-frame-pattern
**pattern_regex**: ``^(__wti_rec_row_leaf\`

### 火焰图原文模式
> // __wti_rec_row_leaf() - 行叶页 reconciliation > /* For each entry in the page... */ WT_ROW_FOREACH (page, rip, i) {  // 遍历页面中的每一行 >     /* Look for an update. */ WT_ERR(__wti_rec_upd_select(session, r, NULL, rip, vpack, &upd_select)); upd = upd_select.upd; >     // 对于每个 key 单独判断 if (upd == NULL && __wt_txn_tw_stop_visible_all(session, twp)) upd = &upd_tombstone;  // 这个 key 可以跳过 >     if (upd->type == WT_UPDATE_TOMBSTONE) goto leaf_insert;  // 跳过这个 key >     // 否则写入这个 key __wti_rec_image_copy(session, r, key); __wti_rec_image_copy(session, r, val); }

### 机制
> Reconciliation 逻辑： - 遍历整个页面的所有 key - 只要有任何一个 key 的 tombstone 不是全局可见 - 整个页面都会被保留（包括那些很旧的 key）
WiredTiger 在 checkpoint / eviction 触发的行叶页 reconcile 路径上调 `__wti_rec_row_leaf`,通过 `WT_ROW_FOREACH` 宏遍历页面每一行 entry,对每个 entry 调 `__wti_rec_upd_select` 选出当前可见的 update,然后调 `__wt_txn_tw_stop_visible_all(session, twp)` 判断该 key 的 stop tombstone 是否全局可见(底层判断条件为 `tw->durable_stop_ts < conn->txn_global.oldest_timestamp`)。只有 stop_ts < oldest_timestamp 时该 key 才会走 tombstone 跳过分支(`upd = &upd_tombstone` → `goto leaf_insert`),否则 fallthrough 到 `__wti_rec_image_copy` 把 key/value 写回新的页面镜像。机制的关键是:reconcile 是页面级整页重写,只要单一 key 不可被全局可见地丢弃,整页所有 key(含很旧的、tombstone 已落 5 分钟前的)都跟着重写到新页 → 已删除数据留在数据文件中。

### 负载含义
> 结果： - Z=4 虽然很旧，但和 Z=1997571 在同一页 - Z=1997571 不能删除（仍在窗口内） - → 整个页面被保留 - → Z=4 也被保留
火焰图中若 `__wti_rec_row_leaf` / `__wti_rec_upd_select` / `__wt_txn_tw_stop_visible_all` / `__wti_rec_image_copy` 共现于 reconcile 调用栈(checkpoint 线程 / eviction worker / 应用线程被借调路径都可能),且 `__wti_rec_image_copy` 占比明显偏高(意味着多数 key 走了"写回页面"分支而非 tombstone 跳过分支),说明集群 oldest_timestamp 推进严重滞后(MongoDB 侧:复制集 oplog 阻塞 / readConcern majority 长事务挂起 / minSnapshotHistoryWindowInSeconds 设置过大),导致已删除数据在数据文件中堆积、磁盘空间持续增长、collection-stats 中 storageSize / freeStorageSize 显著大于 dataSize。同 snapshot `## 最终答案` 段量化:数据文件有 301,368 条记录,全部都是已删除的(都有 stop_ts),但 oldest_timestamp ≈ 0,所以全部被保留 — 这是该 signature 出现时的极端工作负载状态。

### 调优方向
- (#1) [high]
  > "checkpoint 后推进 oldest_timestamp"
- (#2) ``setParameter.minSnapshotHistoryWindowInSeconds`` [medium]
  > "推进 oldest_timestamp 到 current_ts - 窗口"
- (#3) [medium]
  > "每 10000 次操作推进一次"

---

## WiredTiger reconcile 在 row leaf 上跳过全局可见 stop_ts 的 key(磁盘清理读-判-跳路径 signature)

**case_id**: `wt-reconcile-row-tombstone-skip-01`
**来源**: [https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/%E7%A3%81%E7%9B%98%E5%B7%B2%E6%8C%81%E4%B9%85%E5%8C%96%E6%95%B0%E6%8D%AE%E7%9A%84%E6%B8%85%E7%90%86%E4%BB%A3%E7%A0%81%E8%B7%AF%E5%BE%84.md](https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/%E7%A3%81%E7%9B%98%E5%B7%B2%E6%8C%81%E4%B9%85%E5%8C%96%E6%95%B0%E6%8D%AE%E7%9A%84%E6%B8%85%E7%90%86%E4%BB%A3%E7%A0%81%E8%B7%AF%E5%BE%84.md) (community-canonical)
**平台**: bare
**scope**: storage-engine-wt

**signature_type**: stack-pattern
**match_layer**: stack-frame-pattern
**pattern_regex**: ``^(__wt_row_leaf_value_cell\`

### 火焰图原文模式
> if (upd == NULL && __wt_txn_tw_stop_visible_all(session, twp))

### 机制
> 如果我们 reconcile 一个磁盘上的 key，该 key 有一个全局可见的 stop 时间点，
WiredTiger 在 reconcile 行存叶页面时,先用 `__wt_row_leaf_value_cell` 解包磁盘 cell
拿到 `vpack->tw`(含 start_ts / stop_ts),再用 `__wti_rec_upd_select` 在内存更新链中查
该 key 的最新更新。若内存无更新(`upd == NULL`)则使用磁盘上的时间窗口,接着调
`__wt_txn_tw_stop_visible_all` 判断 stop_ts 是否对所有事务全局可见(等价于
`stop_ts <= oldest_timestamp`),命中则把 upd 指向哨兵 `&upd_tombstone` 并在
`WT_UPDATE_TOMBSTONE` 分支 `break` 直接跳过该 key 写入新页。火焰图中应用线程或
checkpoint / eviction worker 栈帧若大量出现这三个函数共现,说明 reconcile 正在密集
处理"磁盘上已存在但语义已过期"的 key。

### 负载含义
> 结果：这个 key 不会被写入新的磁盘页面
火焰图中若 `__wt_txn_tw_stop_visible_all` / `__wti_rec_upd_select` /
`__wt_row_leaf_value_cell` 共现于 reconcile 调用栈,且采样占比明显高于平时,说明本轮
reconcile 在密集做"读旧页 → 判过时 → 跳写"的清理路径。两种相反负载形态都可能:
(a) oldest_timestamp 正常推进,大量历史 stop_ts 数据本轮才被回收 → 这是健康清理动作;
(b) 反例如 ex_access.c 因 oldest_timestamp 从未推进,该判断路径恒为 false → 旧 key 全
被复制到新页,文件持续增长且看似清理但无实际效果。两种形态需结合
`oldest_timestamp` 是否推进 / 文件大小走势 / WiredTiger.log 中 `skip writing` 频次综合判定。

### 调优方向
- (#1) [high]
  > "让 oldest_timestamp 能够推进"
- (#2) ``storage.wiredTiger.engineConfig.configString` (verbose)` [high]
  > "verbose=[reconcile:3,evict:3]"
- (#3) [high]
  > "grep \"skip writing\" WiredTiger.log"

---

## WiredTiger reconcile 写入 wrapup 阶段释放旧页面磁盘块(block manager free-list 入队 signature)

**case_id**: `wt-reconcile-write-wrapup-block-free-01`
**来源**: [https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/%E7%A3%81%E7%9B%98%E5%B7%B2%E6%8C%81%E4%B9%85%E5%8C%96%E6%95%B0%E6%8D%AE%E7%9A%84%E6%B8%85%E7%90%86%E4%BB%A3%E7%A0%81%E8%B7%AF%E5%BE%84.md](https://raw.githubusercontent.com/y123456yz/reading-and-annotate-wiredtiger-11.3.1/main/%E7%A3%81%E7%9B%98%E5%B7%B2%E6%8C%81%E4%B9%85%E5%8C%96%E6%95%B0%E6%8D%AE%E7%9A%84%E6%B8%85%E7%90%86%E4%BB%A3%E7%A0%81%E8%B7%AF%E5%BE%84.md) (community-canonical)
**平台**: bare
**scope**: storage-engine-wt

**signature_type**: function-prefix
**match_layer**: function
**pattern_regex**: ``^(__rec_write_wrapup\`

### 火焰图原文模式
> __wt_btree_block_free(WT_SESSION_IMPL *session, const uint8_t *addr, size_t addr_size)

### 机制
> *     Helper function to free a block from the current tree.
reconcile 完成新页面写入后,`__rec_write_wrapup` 根据旧页 `mod->rec_result` 状态分支
处理:首次 reconcile(case 0)调 `__wt_ref_block_free` 释放原始 ref 地址块;1-for-1
替换(`WT_PM_REC_REPLACE`)调 `__wt_btree_block_free` 释放替换页地址块;multi-block
拆分(`WT_PM_REC_MULTIBLOCK`)调 `__rec_split_discard` 丢弃多个替换块。`__wt_btree_block_free`
最终通过 `bm->free()` 把块地址塞进 block manager 的 free-list,**不立即物理删除**,而是
等下次 checkpoint 写元数据时才确认真正可回收,后续写入优先复用 free-list 中的块完成空间
回收。火焰图中这些函数密集出现于 checkpoint / eviction worker 栈帧。

### 负载含义
> 后续写入优先使用 free list 中的块
火焰图中若 `__rec_write_wrapup` / `__wt_ref_block_free` / `__wt_btree_block_free` 在
checkpoint 或 eviction 栈帧持续高占比,说明该批 reconcile 正在以高频率把旧块归还到 block
manager free-list,典型场景:大量 tombstone 跳写后旧叶页整体被替换、checkpoint 周期内大批
脏页 reconcile 完成、`compact` 显式压缩。空间是**异步回收**——块进入 free-list 后不立即缩减
文件,需等下次写入复用或独立 free-space 整理才反映为磁盘占用下降;**反例**:如果业务侧
oldest_timestamp 不推进,旧 key 仍被原样复制到新页,这条路径仍执行 free 但只是"释放再立刻
被新页占回",对外表现为文件持续增长无回缩。

### 调优方向
- (#1) [high]
  > "session->checkpoint(session, NULL)"
- (#2) [high]
  > "session->compact()"
- (#3) [medium]
  > "wt verify -d dump_pages file:insert_delete_test.wt"

---
