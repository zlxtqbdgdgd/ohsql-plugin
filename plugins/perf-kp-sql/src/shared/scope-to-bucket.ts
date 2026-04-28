// Phase 1 · M3 · 把 distill-v2 case 的 scope/engine/symptom_category 映射到 NotebookLM 集成方案约定的 bucket (1-5)
//
// 约定 (docs/linear-wishing-trinket.md §8 + PHASE-1-SCHEMA-AND-USAGE.md §2.1):
//   1 = 硬件 (CPU/内存/磁盘/BIOS)         → os-kb + kunpeng-kb
//   2 = OS  (内核参数/调度器/网络栈)      → os-kb + kunpeng-kb
//   3 = 引擎配置 (静态参数/启动选项)      → <engine>-kb
//   4 = 运行时 (连接池/锁/缓存命中率)     → <engine>-kb
//   5 = 业务   (慢查询/索引/schema)       → <engine>-kb
//
// 优先级: scope > engine + symptomCategory (BP/Flame 用 scope · DF 没 scope 用 engine)

export type EntryKind = "best-practice" | "diagnostic-flow" | "flame-signature";
export type Bucket = 1 | 2 | 3 | 4 | 5;

export interface ScopeToBucketArgs {
  scope?: string | null;
  engine?: string | null;
  symptomCategory?: string | null;
  entryKind: EntryKind;
}

const SCOPE_BUCKETS: Record<string, Bucket> = {
  // bucket 2 · OS / 中间层
  "linux-mm": 2,
  "linux-net": 2,
  "linux-fs": 2,
  "linux-sched": 2,
  "linux-block": 2,
  "mem-allocator-jemalloc": 2,
  "mem-allocator-glibc": 2,
  "tls-crypto": 2,
  // bucket 3 · 引擎静态配置
  "storage-engine-other": 3,
  // bucket 4 · 引擎运行时
  "storage-engine-wt": 4,
  // bucket 5 · 业务层
  "app-other": 5,
  "app-query-layer": 5,
  other: 5,
};

const SYMPTOM_BUCKETS: Record<string, Bucket> = {
  "startup-failure": 3,        // 启动配置类
  "cpu-high": 4,
  "memory-pressure": 4,
  "lock-contention": 4,
  "disk-io-saturation": 4,
  "disk-space-pressure": 4,
  "replica-lag": 4,
  "connection-storm": 4,
  "network-latency": 4,
  "query-slow": 5,             // 业务慢查询
  other: 5,
};

export function scopeToBucket(args: ScopeToBucketArgs): Bucket {
  // 1. scope 优先 (BP/Flame · 也含 DF 中显式带 scope 的少数 case)
  if (args.scope) {
    return SCOPE_BUCKETS[args.scope] ?? 5;
  }

  // 2. engine (DF 主路径)
  if (args.engine === "kunpeng-platform") return 1;
  if (args.engine === "linux-os") return 2;

  if (args.engine === "mongodb" || args.engine === "mixed") {
    if (args.symptomCategory) {
      return SYMPTOM_BUCKETS[args.symptomCategory] ?? 4;
    }
    return 4; // mongodb 默认运行时
  }

  // 3. 兜底 → 业务
  return 5;
}
