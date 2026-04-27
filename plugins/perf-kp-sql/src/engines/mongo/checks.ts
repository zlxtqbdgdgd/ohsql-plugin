/**
 * @deprecated Phase 3 · 该文件已被 rule-engine.ts + rules 表替代。
 * 保留仅为向后兼容，请在回归测试通过后删除。
 */
/**
 * engines/mongo/checks — MongoDB 专用规则(v0.3 Gold Standard schema)。
 *
 * 6 条规则:连接数 / WT cache vs memory / WT 缓存命中 / Oplog 窗口 /
 *           压缩算法(鲲鹏敏感)/ DB 缓存 vs 物理内存。
 */

import {
  type CheckFn,
  type DiagContext,
  deriveScope,
  finding,
  infoResult,
  okResult,
  dbVal,
  osVal,
} from "../../models.js";
import { isDigitString, toInt, toFloat, KUNPENG_REFS } from "../../shared/utils.js";

function mongoScope(ctx: DiagContext) {
  return deriveScope(ctx, "mongo");
}

function notMongoSkip(ctx: DiagContext, id: string, title: string, bucket: 1 | 2 | 3 | 4 | 5) {
  if (ctx.db_type !== "mongo") {
    return infoResult({
      id,
      title,
      bucket,
      scope: mongoScope(ctx),
      summary: "非 MongoDB 环境,已跳过",
      reason: `db_type=${ctx.db_type}`,
    });
  }
  return null;
}

// ---------------------------------------------------------------------------
// D-MONGO-CONNECTIONS
// ---------------------------------------------------------------------------

export const check_mongo_connections: CheckFn = (ctx) => {
  const id = "mongo.runtime.connection_pool";
  const title = "MongoDB 连接池使用率";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;

  const scope = mongoScope(ctx);
  const raw = dbVal(ctx, "connections", {} as Record<string, unknown>);
  let current = 0;
  if (raw && typeof raw === "object") {
    current = toInt((raw as Record<string, unknown>)["current"] ?? 0, 0);
  } else if (isDigitString(raw)) {
    current = toInt(raw);
  }

  if (current <= 500) {
    return okResult({ id, title, bucket: 5, scope, summary: `connections.current=${current}`, reason: "连接数在合理范围", threshold_display: "< 500", citations: [{ title: "MongoDB Production Notes · connections", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }] });
  }

  const severity = current > 1000 ? "critical" : "warning";
  return finding({
    id,
    title,
    severity,
    bucket: 5,
    scope,
    summary: `connections.current=${current}`,
    description: "连接数过高导致线程切换开销和内存压力,mongod worker 池抖动。",
    reason: `serverStatus.connections.current=${current} · 生产建议 ≤ 500`,
    threshold_display: "≤ 500",
    evidence: [{ kind: "metric", value: `connections.current=${current}` }],
    impact: { metric: "connection_util_pct", value: Math.min(100, current / 10), unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Server Parameters · net.maxIncomingConnections", url: "https://www.mongodb.com/docs/manual/reference/parameters/" },
    ],
    recommendations: [
      {
        action: "审视应用连接池上限 · 设置 maxPoolSize · 排查连接泄露",
        rationale: "从客户端侧控制总连接数 · mongod 侧 maxIncomingConnections 是兜底",
        type: "mitigate",
        fix_cost: "trivial",
        verifiable: false,
      },
    ],
    rationale: {
      summary: "MongoDB 的连接模型是 thread-per-connection(非异步)· 每连接一个线程 + 1MB 线程栈 + 上下文切换开销。连接数 > 500 开始线程调度成本抢 CPU · > 1000 worker 池抖动明显 · > 2000 进程稳定性受威胁。",
      mechanism: "每个 TCP 连接 mongod 分配一个 worker 线程处理请求 · 线程栈 1MB 默认。2000 连接 = 2GB 连接栈 + CPU 在多个线程间切换 · Linux CFS 调度开销快速累积。连接空闲时 worker 占住资源不释放 · 直到连接关闭。",
      trade_offs: "客户端设 maxPoolSize 限制连接总数 · 是正道 · 不影响性能只是请求 queue。mongod 侧 net.maxIncomingConnections 是硬上限 · 被拒连接返回错 · 对应用不友好故只作兜底。",
      when_to_deviate: "Mongo 4.2+ 有 serverlessWorkerThreadMode 实验性 async · 此时可容忍 5000+ 连接。大部分生产部署不建议开。",
    },
  });
};

// ---------------------------------------------------------------------------
// D-MONGO-WT-CACHE-VS-MEM
// ---------------------------------------------------------------------------

export const check_wt_cache_vs_memory: CheckFn = (ctx) => {
  const id = "mongo.config.wt_cache_vs_memory";
  const title = "WiredTiger Cache 与 OS 内存";
  const skip = notMongoSkip(ctx, id, title, 2);
  if (skip) return skip;
  const scope = mongoScope(ctx);

  const total_mem_mb = toInt(osVal(ctx, "total_mem_mb", 0), 0);
  const wt_bytes = toInt(dbVal(ctx, "wt_cache_maximum_bytes", 0), 0);
  const conns_raw = dbVal(ctx, "connections", {} as Record<string, unknown>);
  const active =
    conns_raw && typeof conns_raw === "object"
      ? toInt((conns_raw as Record<string, unknown>)["current"] ?? 0, 0)
      : 0;

  if (wt_bytes === 0 && active > 0) {
    return infoResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: "未能读取 WT cache size",
      reason: "serverStatus.wiredTiger.cache 返回空 · 可能权限不足",
      skip_reason: "runtime_data_missing",
    });
  }
  const wt_mb = Math.floor(wt_bytes / 1024 / 1024);
  const pct = total_mem_mb > 0 ? (wt_bytes / (total_mem_mb * 1024 * 1024)) * 100 : 0;

  if (total_mem_mb === 0 || pct <= 80) {
    return okResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: `WT=${wt_mb}MB · OS=${total_mem_mb}MB · ${pct.toFixed(1)}%`,
      reason: "WT Cache 在安全范围内",
      threshold_display: "< 50% 物理内存",
      citations: [{ title: "MongoDB Memory Use", url: "https://www.mongodb.com/docs/manual/administration/production-notes/#memory-use" }],
    });
  }

  return finding({
    id,
    title,
    severity: "critical",
    bucket: 2,
    scope,
    summary: `WT=${wt_mb}MB / OS=${total_mem_mb}MB = ${pct.toFixed(1)}% · 超 80%`,
    description: "WiredTiger 缓存超出 OS 安全边界会引发 swap,导致 IO 阻塞级死锁。",
    reason: `WT cacheSizeGB ≈ ${wt_mb} MiB,超过物理内存 80% 阈值`,
    threshold_display: "≤ 50% 物理内存",
    evidence: [
      { kind: "metric", value: `wt_cache_maximum_bytes=${wt_bytes}` },
      { kind: "metric", value: `os_total_mem_mb=${total_mem_mb}` },
    ],
    impact: { metric: "cache_miss_rate", value: 35, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB WiredTiger · cache sizing", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" },
    ],
    recommendations: [
      {
        action: "db.adminCommand({setParameter:1, wiredTigerEngineRuntimeConfig:'cache_size=XG'})  # X ≤ mem*0.5",
        rationale: "标准推荐:WT cache ≤ 物理内存 50%",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true,
      },
    ],
    rationale: {
      summary: "WT cache 超过物理内存 80% 时 · mongod 剩余内存不足以承载连接栈 / 网络缓冲 / 后台线程 · 容易触发 OS swap · 一旦 swap 启动 WT 自身的 fsync/checkpoint 被阻塞 · 整库 IO 串联卡顿。",
      mechanism: "WT cache 不是一次 malloc 分配 · 按 working set 增长。OS 剩余内存被 mongod 连接线程(每连接约 1MB 栈)· 内核 page cache · journal buffer 竞争。超 80% 时 Linux kswapd 启动 page reclaim · 追不上就转 direct reclaim 阻塞应用线程。swap 走磁盘 IO · 与 WT 自己的 checkpoint 在同一磁盘互相排队 · 延迟从毫秒跳到秒级。",
      trade_offs: "调低 cache 牺牲部分 working set 命中率(典型 5-15% p95 延迟上升 · 取决 working set 是否大于剩余 cache)· 换来避免雪崩。官方推荐 cacheSizeGB ≈ (mem-1GB)×0.5 · 保守场景取 0.4 mem 更稳。",
      when_to_deviate: "纯内存数据集 · mem ≥ 2× dataset · 且无并发 index build 或 backup · 可提到 60%。云数据库共享宿主内存场景必须 ≤ 40% 避开 noisy neighbor。",
    },
  });
};

// ---------------------------------------------------------------------------
// D-MONGO-WT-HIT
// ---------------------------------------------------------------------------

export const check_wt_cache_hit: CheckFn = (ctx) => {
  const id = "mongo.runtime.wt_cache_hit_rate";
  const title = "WiredTiger 缓存命中率";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);

  const detail = dbVal<Record<string, unknown>>(ctx, "_wt_cache_detail", {});
  const pages_read = toInt(detail["pages read into cache"] ?? 0, 0);
  const pages_req = toInt(detail["pages requested from the cache"] ?? 0, 0);
  const hit = pages_req > 0 ? (1 - pages_read / pages_req) * 100 : 100;

  if (hit >= 95) {
    return okResult({ id, title, bucket: 5, scope, summary: `hit=${hit.toFixed(1)}%`, reason: "缓存命中率正常", threshold_display: "≥ 95%", citations: [{ title: "MongoDB WiredTiger", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" }] });
  }
  const severity = hit < 90 ? "critical" : "warning";
  return finding({
    id,
    title,
    severity,
    bucket: 5,
    scope,
    summary: `hit=${hit.toFixed(1)}% < ${severity === "critical" ? 90 : 95}%`,
    description: "低缓存命中率导致频繁磁盘读取,放大 IOPS 和延迟。",
    reason: `pages_read=${pages_read} / pages_requested=${pages_req}`,
    threshold_display: "≥ 95%",
    evidence: [
      { kind: "metric", value: `wt_pages_read=${pages_read}` },
      { kind: "metric", value: `wt_pages_requested=${pages_req}` },
    ],
    impact: { metric: "cache_miss_rate", value: +(100 - hit).toFixed(1), unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB WiredTiger · Cache and Eviction", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" },
    ],
    recommendations: [
      {
        action: "增大 wiredTigerCacheSizeGB(不超过物理内存 50%)· 或排查 working set 是否暴增",
        rationale: "缓存不足以容纳工作集,提升 cache 或缩减工作集",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true,
      },
    ],
    rationale: {
      summary: "WT cache 命中率 < 95% 说明工作集超出 cache 容量 · 每次 miss 走 read() syscall 拉磁盘 · 延迟从亚毫秒跃升到毫秒级 · 读 IOPS 按 miss 率放大到存储层。",
      mechanism: "mongod 每次读请求先查 WT cache · miss 就调 pread() 从磁盘拉 page · 即使 SSD 也有 100-500μs 延迟 · 是 cache hit (< 10μs) 的 10-50 倍。cache 容量不足时 evict 线程频繁清理 dirty page · 进一步消耗 CPU · 形成恶性循环。",
      trade_offs: "增大 cacheSizeGB 减少 miss 但受物理内存上限约束(见 wt_cache_vs_memory 规则)。压缩集合或加索引缩小工作集是另一路径 · 但压缩提高 CPU 使用率 · 索引多占磁盘和写入开销。",
      when_to_deviate: "批处理 / OLAP workload 本身流式扫描 · cache 命中率低正常 · 关注 pages evicted rate 即可。OLTP 场景 < 95% 必须排查。",
    },
  });
};

// ---------------------------------------------------------------------------
// D-MONGO-OPLOG-WINDOW
// ---------------------------------------------------------------------------

export const check_oplog_window: CheckFn = (ctx) => {
  const id = "mongo.config.oplog_window_hours";
  const title = "Oplog 保留窗口";
  const skip = notMongoSkip(ctx, id, title, 2);
  if (skip) return skip;
  const scope = mongoScope(ctx);

  const hours = toFloat(dbVal(ctx, "_oplog_window_hours", -1), -1);
  if (hours < 0) {
    return infoResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: "非副本集 / 未能读取 oplog",
      reason: "单实例部署或权限不足",
      skip_reason: "runtime_data_missing",
    });
  }
  if (hours >= 24) {
    return okResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: `oplog window=${hours.toFixed(1)}h`,
      reason: "Oplog 窗口充足(≥ 24h)",
    });
  }
  return finding({
    id,
    title,
    severity: "critical",
    bucket: 2,
    scope,
    summary: `oplog window=${hours.toFixed(1)}h < 24h`,
    description: "Oplog 窗口过短,节点维护或延迟恢复可能触发全量同步",
    reason: `当前窗口 ${hours.toFixed(1)} 小时 · 低于生产 24h 推荐`,
    threshold_display: "≥ 24h",
    evidence: [{ kind: "metric", value: `oplog_window_hours=${hours.toFixed(2)}` }],
    impact: { metric: "db_time_pct", value: 25, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB · Troubleshoot Replica Sets (Oplog window)", url: "https://www.mongodb.com/docs/manual/tutorial/troubleshoot-replica-sets/" },
    ],
    recommendations: [
      {
        action: "增大 replication.oplogSizeMB 或通过 replSetResizeOplog 命令扩容",
        rationale: "提供充裕的重新同步窗口",
        type: "prevent",
        fix_cost: "restart_engine",
        verifiable: false,
      },
    ],
    rationale: {
      summary: "Oplog 窗口 < 24h 时 · secondary 维护离线超过窗口就必须 initial sync · 对 TB 级库是小时级停机风险。24h 是 MongoDB 官方生产推荐下限。",
      mechanism: "secondary 通过 tailing primary 的 local.oplog.rs 集合复制数据。oplog 是固定大小 capped collection · 写入速率决定窗口时长。当 secondary 离线超过窗口 · 它要读的 oplog entries 已被覆盖 · 无法增量追赶 · 触发全量 initial sync。initial sync 走全量 collection 复制 + 所有 index 重建 · TB 级数据集通常 6-12 小时。",
      trade_offs: "增大 oplog 占用磁盘 · 每 GB oplog ≈ 支持 1-2 小时高峰写入(取决写入速率)。磁盘空间换运维安全 · 不影响读写性能。",
      when_to_deviate: "开发环境 / 允许手动 resync 的小库 · oplog 可短。生产 OLTP 必须 ≥ 24h · 高写入或跨机房场景建议 48-72h 给 DBA 足够排障时间。",
    },
  });
};

// ---------------------------------------------------------------------------
// D-MONGO-COMPRESSION · zlib-on-kunpeng 警告
// ---------------------------------------------------------------------------

export const check_compression_algorithm: CheckFn = (ctx) => {
  const id = "mongo.config.wt_block_compressor";
  const title = "WiredTiger 块压缩算法";
  const skip = notMongoSkip(ctx, id, title, 2);
  if (skip) return skip;
  const scope = mongoScope(ctx);

  const compressor = dbVal<string>(ctx, "_wt_block_compressor", "");
  if (!compressor) {
    return infoResult({ id, title, bucket: 2, scope, summary: "未采集 compressor", reason: "可能使用引擎默认 snappy" });
  }
  // zlib 在 Kunpeng/ARM64 上 CPU 开销明显 · 非 kunpeng 也警告但 severity 低
  if (compressor !== "zlib") {
    return okResult({ id, title, bucket: 2, scope, summary: `compressor=${compressor}`, reason: "压缩算法合理" });
  }
  const severityOnKunpeng = scope.vendor === "kunpeng" ? "warning" : "info";
  if (severityOnKunpeng === "info") {
    return infoResult({ id, title, bucket: 2, scope, summary: `compressor=zlib`, reason: "zlib 压缩比高但 CPU 开销大,非鲲鹏环境仅提示" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 2,
    scope,
    summary: `compressor=zlib on ${scope.vendor}`,
    description: "zlib 压缩在 Kunpeng / ARM64 上 CPU 消耗显著高于 x86,FTDC 中 deflate_slow 热点明显。",
    reason: "Kunpeng 上 zlib 压缩成本过高 · 建议 snappy 或 zstd",
    threshold_display: "snappy / zstd",
    evidence: [{ kind: "config", value: `wiredTigerCollectionBlockCompressor=zlib` }],
    impact: { metric: "db_time_pct", value: 20, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
    ],
    recommendations: [
      {
        action: "在 mongod.conf 设置 storage.wiredTiger.collectionConfig.blockCompressor: snappy (或 zstd)",
        rationale: "Kunpeng 上更换 compressor 显著降低 CPU 压力",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true,
      },
    ],
    rationale: {
      summary: "鲲鹏 920 上 zlib 压缩/解压完全走通用 ALU 路径 · 没有 Intel ISA-L 或等价的硬件压缩加速 · 相同吞吐下 CPU 占用显著高于 x86。FTDC 火焰图中 deflate_slow 常年占 15-30% CPU · 压缩开销吃掉查询 CPU 预算。",
      mechanism: "zlib 的 deflate_slow 大量使用 sliding window 查找和 Huffman 编码 · 纯 CPU 计算 · ARM64 无对应加速 ISA(鲲鹏有 SMMU 加密加速但不覆盖 compression)。snappy 是 byte-level LZ77 · zstd 有轻量 dictionary · 两者都对 ARM64 指令集友好 · 其中 snappy 解压可 SIMD 化进一步减开销。",
      trade_offs: "snappy 压缩比 ~2x · zlib ~3x · zstd ~3.2x · zstd 压缩比接近 zlib 但 CPU 只用 zlib 的 50-70%。磁盘占用切换后可能上升 40-50% · 但换来 CPU 预算可以消化更多 QPS。NVMe 场景磁盘成本远低于 CPU。",
      when_to_deviate: "归档集合读写极少 · 可保留 zlib 省磁盘。热数据集合强烈推荐 snappy 或 zstd。MongoDB 4.2+ 原生支持 zstd · 3.x 只 zlib/snappy 可选。",
    },
  });
};

// ---------------------------------------------------------------------------
// D-MONGO-SHARED-BUFFERS(跨 engine 兜底,主要防止误配置)
// ---------------------------------------------------------------------------

export const check_db_cache_vs_memory: CheckFn = (ctx) => {
  const id = "mongo.config.db_cache_vs_total_mem";
  const title = "DB 缓存 vs 物理内存";
  const scope = mongoScope(ctx);

  const total_mem = toInt(osVal(ctx, "total_mem_mb", 0), 0);
  const shared = toInt(dbVal(ctx, "shared_buffers_mb", 0), 0);
  if (total_mem === 0 || shared === 0) {
    return okResult({ id, title, bucket: 2, scope, summary: `total=${total_mem}MB · buffer=${shared}MB`, reason: "未采集到或缓存设置合理" });
  }
  if (shared <= total_mem) {
    return okResult({ id, title, bucket: 2, scope, summary: `total=${total_mem}MB · buffer=${shared}MB`, reason: "缓存未超物理内存" });
  }
  return finding({
    id,
    title,
    severity: "critical",
    bucket: 2,
    scope,
    summary: `DB buffer ${shared}MB > OS total ${total_mem}MB`,
    description: "DB 缓存设置超过物理内存,必然 OOM",
    reason: `shared_buffers=${shared}MB > total_mem=${total_mem}MB`,
    threshold_display: "≤ 物理内存",
    evidence: [
      { kind: "metric", value: `total_mem_mb=${total_mem}` },
      { kind: "metric", value: `shared_buffers_mb=${shared}` },
    ],
    impact: { metric: "cache_miss_rate", value: 100, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB WiredTiger · cache sizing", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" },
    ],
    recommendations: [
      {
        action: "调低 wiredTigerCacheSizeGB 至 mem*0.5 以下",
        rationale: "避免 OOM 触发 OOM Killer 杀掉 mongod",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// D-MONGO-JOURNAL-ENABLED · storageEngine.persistent == true(CRITICAL)
// ---------------------------------------------------------------------------

export const check_storage_journaling_enabled: CheckFn = (ctx) => {
  const id = "mongo.storage.journaling_enabled";
  const title = "MongoDB journaling 启用";
  const skip = notMongoSkip(ctx, id, title, 2);
  if (skip) return skip;
  const scope = mongoScope(ctx);

  const se = dbVal<Record<string, unknown>>(ctx, "storageEngine", {});
  const persistent = se["persistent"];
  if (persistent === undefined || persistent === null) {
    return infoResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: "未采集 storageEngine.persistent",
      reason: "serverStatus.storageEngine 为空或权限不足",
      skip_reason: "runtime_data_missing",
    });
  }
  if (persistent === true) {
    return okResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: "storageEngine.persistent=true",
      reason: "持久化引擎已启用,journaling 有效",
      threshold_display: "== true",
      citations: [{ title: "MongoDB Journaling", url: "https://www.mongodb.com/docs/manual/core/journaling/" }],
    });
  }
  return finding({
    id,
    title,
    severity: "critical",
    bucket: 2,
    scope,
    summary: "storageEngine.persistent=false · journaling 未生效",
    description: "journaling 未启用时,上一个 checkpoint 之后的写入在异常断电/kill 后会永久丢失;MongoDB 明确要求生产开启",
    reason: "serverStatus.storageEngine.persistent 为 false",
    threshold_display: "== true",
    evidence: [{ kind: "metric", value: `storageEngine.persistent=${persistent}` }],
    impact: { metric: "db_time_pct", value: 50, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Journaling", url: "https://www.mongodb.com/docs/manual/core/journaling/" },
    ],
    recommendations: [
      {
        action: "在 mongod.conf 设 storage.journal.enabled: true 并重启实例",
        rationale: "避免异常掉电丢失已提交写",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// D-MONGO-WT-READ-TICKETS · 并发读票证耗尽(WT 128 默认)
// ---------------------------------------------------------------------------

function pickTicketsSubtree(ss: DiagContext, kind: "read" | "write"): { available: number; out: number; totalTickets: number } | null {
  // 优先 wiredTiger.concurrentTransactions(老版 + 8.0 前普遍有)
  // 回退 queues.execution.{read,write}(8.0+ 新暴露)
  const wt = (ss.db_metrics["wiredTiger"] ?? {}) as Record<string, unknown>;
  const ct = (wt["concurrentTransactions"] ?? {}) as Record<string, unknown>;
  const ctSub = (ct[kind] ?? {}) as Record<string, unknown>;
  const a = toInt(ctSub["available"], -1);
  const o = toInt(ctSub["out"], -1);
  const t = toInt(ctSub["totalTickets"], -1);
  if (a >= 0 && o >= 0) {
    return { available: a, out: o, totalTickets: t > 0 ? t : a + o };
  }
  const q = (ss.db_metrics["queues"] ?? {}) as Record<string, unknown>;
  const qe = (q["execution"] ?? {}) as Record<string, unknown>;
  const qk = (qe[kind] ?? {}) as Record<string, unknown>;
  const a2 = toInt(qk["available"], -1);
  const o2 = toInt(qk["out"], -1);
  const t2 = toInt(qk["totalTickets"], -1);
  if (a2 >= 0) {
    return { available: a2, out: Math.max(o2, 0), totalTickets: t2 > 0 ? t2 : a2 + Math.max(o2, 0) };
  }
  return null;
}

function makeTicketCheck(kind: "read" | "write"): CheckFn {
  return (ctx) => {
    const id = `mongo.runtime.wt_ticket_${kind}`;
    const title = `WiredTiger ${kind === "read" ? "读" : "写"}票证`;
    const skip = notMongoSkip(ctx, id, title, 5);
    if (skip) return skip;
    const scope = mongoScope(ctx);

    const t = pickTicketsSubtree(ctx, kind);
    if (!t) {
      return infoResult({
        id,
        title,
        bucket: 5,
        scope,
        summary: "未采集到票证指标",
        reason: "serverStatus.wiredTiger.concurrentTransactions / queues.execution 均不可读",
        skip_reason: "runtime_data_missing",
      });
    }
    const { available, out, totalTickets } = t;
    // 若 totalTickets 不可得,用 available+out
    const total = totalTickets > 0 ? totalTickets : Math.max(available + out, 1);
    const utilPct = total > 0 ? (out / total) * 100 : 0;
    if (available > 0 && utilPct < 90) {
      return okResult({
        id,
        title,
        bucket: 5,
        scope,
        summary: `out=${out} / total=${total} · ${utilPct.toFixed(0)}%`,
        reason: "票证资源充足",
        threshold_display: "available > 0 && util < 90%",
        citations: [{ title: "MongoDB · WiredTiger Tickets", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" }],
      });
    }
    const severity = available === 0 ? "critical" : "warning";
    return finding({
      id,
      title,
      severity,
      bucket: 5,
      scope,
      summary: `${kind} tickets out=${out} / total=${total} · 可用 ${available}`,
      description: `WiredTiger ${kind} 并发 ${kind === "read" ? "读" : "写"}票证接近耗尽 · 新请求被 storage engine 排队 · 延迟急剧放大`,
      reason: available === 0
        ? `${kind}.available=0 · 所有 ${total} 张票证均已发出,后续请求 100% 排队`
        : `${kind} 使用率 ${utilPct.toFixed(0)}% · 高于 90% 阈值`,
      threshold_display: "available > 0 · util < 90%",
      evidence: [
        { kind: "metric", value: `wt_${kind}_tickets_out=${out}` },
        { kind: "metric", value: `wt_${kind}_tickets_available=${available}` },
      ],
      impact: { metric: "latency_p95_ms", value: available === 0 ? 60 : 20, unit: "percent", confidence: "high" },
      citations: [
        KUNPENG_REFS.boostkitMongo,
        { title: "MongoDB · WiredTiger Tickets & Concurrency", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" },
      ],
      recommendations: [
        {
          action: kind === "read"
            ? "db.adminCommand({setParameter:1, storageEngineConcurrentReadTransactions: 256})"
            : "db.adminCommand({setParameter:1, storageEngineConcurrentWriteTransactions: 256})",
          rationale: `扩容 WT ${kind} 并发票证到 256(默认 128);同时排查慢查询 / 锁阻塞`,
          type: "mitigate",
          fix_cost: "trivial",
          verifiable: true,
        },
      ],
    });
  };
}

export const check_wt_ticket_read = makeTicketCheck("read");
export const check_wt_ticket_write = makeTicketCheck("write");

// ---------------------------------------------------------------------------
// D-MONGO-TCMALLOC-PERCPU · serverStatus.tcmalloc.usingPerCPUCaches
// ---------------------------------------------------------------------------

export const check_tcmalloc_per_cpu: CheckFn = (ctx) => {
  const id = "mongo.config.tcmalloc_per_cpu_caches";
  const title = "tcmalloc per-CPU caches";
  const skip = notMongoSkip(ctx, id, title, 2);
  if (skip) return skip;
  const scope = mongoScope(ctx);

  const tc = dbVal<Record<string, unknown>>(ctx, "tcmalloc", {});
  const using = tc["usingPerCPUCaches"];
  if (using === undefined || using === null) {
    return infoResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: "未采集 tcmalloc.usingPerCPUCaches",
      reason: "可能使用 tcmalloc-gperftools(MongoDB < 8.0)· 未暴露该字段",
    });
  }
  if (using === true) {
    return okResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: "usingPerCPUCaches=true",
      reason: "tcmalloc 已启用 per-CPU caches",
      threshold_display: "== true",
      citations: [{ title: "MongoDB · tcmalloc-google", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }],
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 2,
    scope,
    summary: "usingPerCPUCaches=false",
    description: "tcmalloc 回退到 per-thread caches · 高并发分配场景下内存碎片和分配延迟升高 · MongoDB 8.0+ 默认期望 per-CPU caches",
    reason: "serverStatus.tcmalloc.usingPerCPUCaches 为 false(通常是 kernel < 4.18 或 glibc rseq 关闭)",
    threshold_display: "== true",
    evidence: [{ kind: "metric", value: "tcmalloc.usingPerCPUCaches=false" }],
    impact: { metric: "throughput_qps", value: 8, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB · tcmalloc-google", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" },
    ],
    recommendations: [
      {
        action: "确认 kernel ≥ 4.18 且未设 GLIBC_TUNABLES=glibc.pthread.rseq=0 · 必要时重启 mongod",
        rationale: "允许 tcmalloc 启用 per-CPU caches · 提升高并发分配效率",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// D-MONGO-SHARDED-INDEX-CONSISTENCY · CRITICAL
// ---------------------------------------------------------------------------

export const check_sharded_index_consistency: CheckFn = (ctx) => {
  const id = "mongo.runtime.sharded_index_consistency";
  const title = "分片索引一致性";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);

  const raw = dbVal<Record<string, unknown> | number>(ctx, "shardedIndexConsistency", {} as Record<string, unknown>);
  // 字段可能是对象 {numShardedCollectionsWithInconsistentIndexes: N} 或直接数字
  let inconsistent = 0;
  if (typeof raw === "number") {
    inconsistent = raw;
  } else if (raw && typeof raw === "object") {
    inconsistent = toInt(raw["numShardedCollectionsWithInconsistentIndexes"] ?? 0, 0);
  }
  // 非 sharded cluster serverStatus 不会输出该字段
  if (raw === undefined || raw === null || (typeof raw === "object" && Object.keys(raw).length === 0)) {
    return infoResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "非 sharded cluster 或未采集",
      reason: "单实例 / 副本集不输出 shardedIndexConsistency 字段",
      skip_reason: "runtime_data_missing",
    });
  }
  if (inconsistent === 0) {
    return okResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "0 个不一致集合",
      reason: "所有 sharded collection 索引在各 shard 一致",
      threshold_display: "== 0",
      citations: [{ title: "MongoDB · Sharded Index Consistency", url: "https://www.mongodb.com/docs/manual/tutorial/manage-indexes/" }],
    });
  }
  return finding({
    id,
    title,
    severity: "critical",
    bucket: 5,
    scope,
    summary: `${inconsistent} 个 sharded collection 索引不一致`,
    description: "不一致索引会导致查询在不同 shard 返回不同结果或执行计划偏离 · MongoDB 明确告警此项",
    reason: `shardedIndexConsistency.numShardedCollectionsWithInconsistentIndexes=${inconsistent}`,
    threshold_display: "== 0",
    evidence: [{ kind: "metric", value: `shardedIndexConsistency=${inconsistent}` }],
    impact: { metric: "db_time_pct", value: 20, unit: "percent", confidence: "high" },
    citations: [
      { title: "MongoDB · shardedIndexConsistency · Manage Indexes", url: "https://www.mongodb.com/docs/manual/tutorial/manage-indexes/" },
    ],
    recommendations: [
      {
        action: "mongos 侧用 db.collection.createIndex() 重建 · 或 sh.reshardCollection 后重建",
        rationale: "统一分片索引定义 · 恢复正确查询路由",
        type: "repair",
        fix_cost: "schema_migration",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// D-MONGO-GLOBAL-LOCK-QUEUE · globalLock.currentQueue.total
// ---------------------------------------------------------------------------

export const check_global_lock_queue: CheckFn = (ctx) => {
  const id = "mongo.runtime.global_lock_queue";
  const title = "Global lock 队列";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);

  const gl = dbVal<Record<string, unknown>>(ctx, "globalLock", {});
  const cq = (gl["currentQueue"] ?? {}) as Record<string, unknown>;
  const total = toInt(cq["total"] ?? -1, -1);
  const readers = toInt(cq["readers"] ?? 0, 0);
  const writers = toInt(cq["writers"] ?? 0, 0);
  if (total < 0) {
    return infoResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "未采集 globalLock.currentQueue",
      reason: "serverStatus.globalLock 为空",
    });
  }
  if (total === 0) {
    return okResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "globalLock 队列空闲",
      reason: "无请求阻塞在 global lock",
      threshold_display: "== 0",
      citations: [{ title: "MongoDB · serverStatus.globalLock", url: "https://www.mongodb.com/docs/manual/reference/command/serverStatus/#globalLock" }],
    });
  }
  const severity = total > 100 ? "critical" : "warning";
  return finding({
    id,
    title,
    severity,
    bucket: 5,
    scope,
    summary: `globalLock queue total=${total}(读 ${readers} · 写 ${writers})`,
    description: "global lock 队列非零说明有请求被阻塞等待锁 · 持续非零意味着锁竞争已成瓶颈",
    reason: `globalLock.currentQueue.total=${total}`,
    threshold_display: "== 0",
    evidence: [
      { kind: "metric", value: `globalLock.currentQueue.total=${total}` },
      { kind: "metric", value: `readers=${readers}` },
      { kind: "metric", value: `writers=${writers}` },
    ],
    impact: { metric: "latency_p95_ms", value: total > 100 ? 50 : 20, unit: "percent", confidence: "high" },
    citations: [
      { title: "MongoDB · serverStatus.globalLock", url: "https://www.mongodb.com/docs/manual/reference/command/serverStatus/#globalLock" },
    ],
    recommendations: [
      {
        action: "排查长时间运行的写事务 / index build · 检查是否有 db-level lock 操作(collMod / createIndex foreground)",
        rationale: "global lock 通常由显式 admin 操作或慢事务引起",
        type: "investigate",
        fix_cost: "trivial",
        verifiable: false,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// D-MONGO-CURRENTOP-SLOW · currentOp.slow_count(已解析的)
// ---------------------------------------------------------------------------

export const check_current_op_slow: CheckFn = (ctx) => {
  const id = "mongo.runtime.current_op_slow";
  const title = "currentOp 慢操作";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);

  const co = dbVal<Record<string, unknown>>(ctx, "currentOp", {});
  const active = toInt(co["active_count"] ?? 0, 0);
  const slow = toInt(co["slow_count"] ?? 0, 0);
  const top = toInt(co["top_slow_secs"] ?? 0, 0);
  if (slow === 0) {
    return okResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: `active=${active} · slow=0`,
      reason: "无超过 3s 的活跃操作",
      threshold_display: "slow_count == 0",
      citations: [{ title: "MongoDB · db.currentOp()", url: "https://www.mongodb.com/docs/manual/reference/method/db.currentOp/" }],
    });
  }
  const severity = top > 60 ? "critical" : "warning";
  return finding({
    id,
    title,
    severity,
    bucket: 5,
    scope,
    summary: `slow_count=${slow} · 最长 ${top}s`,
    description: "活跃 op 中存在超过 3s 的请求 · 最长达 " + top + "s · 可能是慢查询 / 索引构建 / 跨分片聚合",
    reason: `currentOp.slow_count=${slow} · top_slow_secs=${top}`,
    threshold_display: "slow_count == 0",
    evidence: [
      { kind: "metric", value: `currentOp.slow_count=${slow}` },
      { kind: "metric", value: `currentOp.top_slow_secs=${top}` },
      { kind: "metric", value: `currentOp.active_count=${active}` },
    ],
    impact: { metric: "latency_p95_ms", value: top > 60 ? 50 : 15, unit: "percent", confidence: "medium" },
    citations: [
      { title: "MongoDB · db.currentOp()", url: "https://www.mongodb.com/docs/manual/reference/method/db.currentOp/" },
    ],
    recommendations: [
      {
        action: "db.currentOp({secs_running: {$gt: 3}}) 逐条 explain · 对慢查询加索引 · 取消无意义长跑 op",
        rationale: "慢 op 持续占票证 · 放大整体延迟",
        type: "investigate",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// D-MONGO-CONNECTIONS-AVAILABLE · connections.available 过低
// ---------------------------------------------------------------------------

export const check_connections_available: CheckFn = (ctx) => {
  const id = "mongo.runtime.connections_available";
  const title = "连接可用余量";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);

  const raw = dbVal<Record<string, unknown>>(ctx, "connections", {});
  const current = toInt(raw["current"] ?? 0, 0);
  const available = toInt(raw["available"] ?? -1, -1);
  if (available < 0) {
    return infoResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "未采集 connections.available",
      reason: "serverStatus.connections.available 缺失",
    });
  }
  const total = current + available;
  const usedPct = total > 0 ? (current / total) * 100 : 0;
  if (usedPct < 80) {
    return okResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: `current=${current} · available=${available} · ${usedPct.toFixed(0)}%`,
      reason: "连接余量充足",
      threshold_display: "used < 80%",
      citations: [{ title: "MongoDB · connections", url: "https://www.mongodb.com/docs/manual/reference/command/serverStatus/#connections" }],
    });
  }
  const severity = usedPct >= 95 ? "critical" : "warning";
  return finding({
    id,
    title,
    severity,
    bucket: 5,
    scope,
    summary: `connections 使用率 ${usedPct.toFixed(0)}%(current=${current} · available=${available})`,
    description: "连接池接近 net.maxIncomingConnections 上限 · 新请求可能被拒绝或客户端重连风暴",
    reason: `connections.current / (current + available) = ${usedPct.toFixed(1)}%`,
    threshold_display: "used < 80%",
    evidence: [
      { kind: "metric", value: `connections.current=${current}` },
      { kind: "metric", value: `connections.available=${available}` },
    ],
    impact: { metric: "connection_util_pct", value: +usedPct.toFixed(1), unit: "percent", confidence: "high" },
    citations: [
      { title: "MongoDB · connections · net.maxIncomingConnections", url: "https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.maxIncomingConnections" },
    ],
    recommendations: [
      {
        action: "调高 net.maxIncomingConnections 或排查客户端连接泄露 · 缩小客户端 maxPoolSize",
        rationale: "避免接近上限被拒连接引发应用超时",
        type: "mitigate",
        fix_cost: "restart_engine",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// D-MONGO-ASSERTS-WARNING · serverStatus.asserts.warning 累计计数披露
// ---------------------------------------------------------------------------

export const check_asserts_warning: CheckFn = (ctx) => {
  const id = "mongo.runtime.asserts_warning_total";
  const title = "Asserts.warning 累计";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);

  const a = dbVal<Record<string, unknown>>(ctx, "asserts", {});
  const warning = toInt(a["warning"] ?? -1, -1);
  const regular = toInt(a["regular"] ?? 0, 0);
  const msg = toInt(a["msg"] ?? 0, 0);
  if (warning < 0) {
    return infoResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "未采集 asserts",
      reason: "serverStatus.asserts 缺失",
    });
  }
  if (warning === 0 && regular === 0) {
    return okResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "0 assert · 实例干净",
      reason: "自 mongod 启动以来无 assert 记录",
      threshold_display: "warning == 0",
      citations: [{ title: "MongoDB · serverStatus.asserts", url: "https://www.mongodb.com/docs/manual/reference/command/serverStatus/#asserts" }],
    });
  }
  // 大量 assert 不一定是 critical(累计计数)· 给 info 建议排查日志
  return infoResult({
    id,
    title,
    bucket: 5,
    scope,
    summary: `累计:warning=${warning} · regular=${regular} · msg=${msg}`,
    reason: "serverStatus.asserts 是启动以来累计值 · 大数不一定是当前问题 · 建议结合 mongod.log 时间戳排查",
    citations: [{ title: "MongoDB · serverStatus.asserts", url: "https://www.mongodb.com/docs/manual/reference/command/serverStatus/#asserts" }],
  });
};

// ---------------------------------------------------------------------------
// D-MONGO-WT-CACHE-DIRTY · WT cache dirty 比例(> 20% · eviction 压力信号)
// ---------------------------------------------------------------------------

export const check_wt_cache_dirty_pct: CheckFn = (ctx) => {
  const id = "mongo.runtime.wt_cache_dirty_pct";
  const title = "WT Cache dirty 比例";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);

  const detail = dbVal<Record<string, unknown>>(ctx, "_wt_cache_detail", {});
  const dirty = toInt(detail["tracked dirty bytes in the cache"] ?? -1, -1);
  const inCache = toInt(detail["bytes currently in the cache"] ?? 0, 0);
  if (dirty < 0 || inCache === 0) {
    return infoResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "未采集 WT cache dirty 字段",
      reason: "wiredTiger.cache 缺少 dirty 字段",
    });
  }
  const pct = (dirty / inCache) * 100;
  if (pct <= 20) {
    return okResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: `dirty=${pct.toFixed(1)}%`,
      reason: "脏数据比例正常(WT eviction 未触发 target 阈值)",
      threshold_display: "≤ 20%",
      citations: [{ title: "MongoDB · WT eviction", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" }],
    });
  }
  const severity = pct > 30 ? "critical" : "warning";
  return finding({
    id,
    title,
    severity,
    bucket: 5,
    scope,
    summary: `WT dirty=${pct.toFixed(1)}% 超 20% eviction 阈值`,
    description: "WT cache 脏页比例超过 eviction trigger(20% dirty target · 30% hard)· 写 worker 会被 stall 参与清理",
    reason: `tracked_dirty_bytes / bytes_in_cache = ${pct.toFixed(1)}%`,
    threshold_display: "≤ 20%",
    evidence: [
      { kind: "metric", value: `wt_dirty_bytes=${dirty}` },
      { kind: "metric", value: `wt_in_cache_bytes=${inCache}` },
    ],
    impact: { metric: "latency_p95_ms", value: pct > 30 ? 40 : 20, unit: "percent", confidence: "medium" },
    citations: [
      { title: "MongoDB · WT eviction · dirty target 20%", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" },
    ],
    recommendations: [
      {
        action: "增加 wiredTigerCacheSizeGB · 或调大 eviction_dirty_trigger · 或降低写入速率",
        rationale: "脏页过多触发 eviction storm · 写 worker 被拉去清理导致应用写 stall",
        type: "mitigate",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// D-MONGO-ARM64-MICROARCH · arm64 平台 ARMv8.2-A 要求(INFO)
// ---------------------------------------------------------------------------

export const check_mongo_arm64_microarch: CheckFn = (ctx) => {
  const id = "mongo.platform.arm64_microarch";
  const title = "ARM64 微架构要求";
  const skip = notMongoSkip(ctx, id, title, 1);
  if (skip) return skip;
  const scope = mongoScope(ctx);

  if (scope.arch !== "arm64") {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "非 arm64 平台",
      reason: `arch=${scope.arch ?? "unknown"}`,
      skip_reason: "arch_mismatch",
    });
  }
  const vendor = scope.vendor ?? "unknown";
  const cpuModel = osVal<string>(ctx, "cpu_model", "unknown");
  // Kunpeng 920 / Graviton 2+ / Ampere Altra 都是 ARMv8.2-A 或更高 · 这里只做说明
  return infoResult({
    id,
    title,
    bucket: 1,
    scope,
    summary: `arm64 · vendor=${vendor} · ${cpuModel}`,
    reason: "MongoDB 8.0+ 要求 ARMv8.2-A · 鲲鹏 920 / Graviton 2+ / Ampere Altra 原生满足 · 早期 Armv8.0 芯片不支持",
    threshold_display: "ARMv8.2-A 或更高",
    citations: [
      { title: "MongoDB 8.0 · Production Notes · arm64 microarchitecture", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" },
    ],
  });
};

// ---------------------------------------------------------------------------
// D-MONGO-WT-CACHE-PCT · WT cache 占 OS 内存 60-80% 区间(kunpeng BoostKit 建议)
// ---------------------------------------------------------------------------

export const check_wt_cache_pct_kunpeng: CheckFn = (ctx) => {
  const id = "mongo.config.wt_cache_pct_kunpeng";
  const title = "WT Cache 占物理内存比例 · 鲲鹏";
  const skip = notMongoSkip(ctx, id, title, 2);
  if (skip) return skip;
  const scope = mongoScope(ctx);

  // 仅 kunpeng 场景下生效 · 避免和 wt_cache_vs_memory 重复
  if (scope.vendor !== "kunpeng") {
    return infoResult({ id, title, bucket: 2, scope, summary: "仅鲲鹏场景", reason: `vendor=${scope.vendor ?? "unknown"}` });
  }
  const total_mem_mb = toInt(osVal(ctx, "total_mem_mb", 0), 0);
  const wt_bytes = toInt(dbVal(ctx, "wt_cache_maximum_bytes", 0), 0);
  if (total_mem_mb === 0 || wt_bytes === 0) {
    return infoResult({ id, title, bucket: 2, scope, summary: "WT cache 或物理内存未采集", reason: "wt_cache_maximum_bytes 或 total_mem_mb 为 0" });
  }
  const pct = (wt_bytes / (total_mem_mb * 1024 * 1024)) * 100;
  // 鲲鹏 BoostKit MongoDB 建议 WT cache ≈ 50% mem · 上限 80%
  if (pct >= 40 && pct <= 60) {
    return okResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: `WT=${pct.toFixed(1)}% · 落在推荐 40-60% 区间`,
      reason: "鲲鹏 BoostKit 推荐区间 · 留足内存给连接栈 / page cache",
      threshold_display: "40% ≤ pct ≤ 60%",
      citations: [{ title: "鲲鹏 BoostKit · MongoDB 调优 · cacheSizeGB", url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html" }],
    });
  }
  if (pct < 40) {
    return infoResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: `WT=${pct.toFixed(1)}% 偏低`,
      reason: "WT cache 占比 < 40% · 可能工作集受限 · 若 working set 大于 cache 会降低命中率",
      threshold_display: "40% ≤ pct ≤ 60%",
      citations: [{ title: "鲲鹏 BoostKit · MongoDB 调优", url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html" }],
    });
  }
  // > 60%,已在 wt_cache_vs_memory 规则触发 critical;这里给 warning 收敛
  const severity = pct > 80 ? "critical" : "warning";
  return finding({
    id,
    title,
    severity,
    bucket: 2,
    scope,
    summary: `WT=${pct.toFixed(1)}% · 鲲鹏建议 ≤ 60%`,
    description: "鲲鹏 BoostKit MongoDB 调优推荐 cacheSizeGB ≈ (mem-1GB)*0.5 · 不超过 60% 物理内存 · 80% 是硬上限",
    reason: `WT cache 占比 ${pct.toFixed(1)}% · 高于鲲鹏推荐 60%`,
    threshold_display: "40% ≤ pct ≤ 60%",
    evidence: [
      { kind: "metric", value: `wt_cache_bytes=${wt_bytes}` },
      { kind: "metric", value: `total_mem_mb=${total_mem_mb}` },
    ],
    impact: { metric: "cache_miss_rate", value: 15, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
    ],
    recommendations: [
      {
        action: "调低 wiredTigerCacheSizeGB 至 (mem-1GB)*0.5 以内 · 释放内存给连接栈 / page cache",
        rationale: "对齐鲲鹏 BoostKit MongoDB 推荐区间",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// D-MONGO-WT-PAGE-READ-LATENCY · 每次 page read 平均耗时(tracked read bytes / count)
// ---------------------------------------------------------------------------

export const check_wt_pages_read_volume: CheckFn = (ctx) => {
  const id = "mongo.runtime.wt_pages_read_volume";
  const title = "WT 累计 page-read 量";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);

  const detail = dbVal<Record<string, unknown>>(ctx, "_wt_cache_detail", {});
  const pages_read = toInt(detail["pages read into cache"] ?? -1, -1);
  const pages_req = toInt(detail["pages requested from the cache"] ?? 0, 0);
  if (pages_read < 0) {
    return infoResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "未采集 pages read into cache",
      reason: "wiredTiger.cache 缺失",
    });
  }
  // 纯披露:把累计读页面数告诉用户 · 没有 critical(因是 cumulative · 单点无参考)
  return infoResult({
    id,
    title,
    bucket: 5,
    scope,
    summary: `累计 pages read=${pages_read} · requested=${pages_req}`,
    reason: "启动以来从磁盘加载到 WT cache 的累计页数 · 大数不直接意味问题 · 与 cache hit rate 配合看",
    citations: [{ title: "MongoDB · WT pages read", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" }],
  });
};

export const mongoChecks: ReadonlyArray<CheckFn> = [
  check_mongo_connections,
  check_wt_cache_vs_memory,
  check_wt_cache_hit,
  check_oplog_window,
  // check_compression_algorithm · removed 2026-04-26 audit · NO_URL (mongo.config.wt_block_compressor)
  check_db_cache_vs_memory,
  check_storage_journaling_enabled,
  check_wt_ticket_read,
  check_wt_ticket_write,
  check_tcmalloc_per_cpu,
  check_sharded_index_consistency,
  check_global_lock_queue,
  check_current_op_slow,
  check_connections_available,
  check_asserts_warning,
  check_wt_cache_dirty_pct,
  check_mongo_arm64_microarch,
  check_wt_cache_pct_kunpeng,
  check_wt_pages_read_volume,
];
