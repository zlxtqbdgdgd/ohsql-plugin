/**
 * shared/utils — 跨 engine / cross-checker 通用工具集合。
 *
 * 合并自 (Phase 4 整合):
 *   - numeric.ts       — 数字解析(toInt / toFloat / isDigitString)
 *   - kunpeng-refs.ts  — 鲲鹏 / openEuler 原厂权威引用常量
 *   - wait-class.ts    — rule_id → wait_class / module 映射
 *   - os-collector.ts  — OS 批量 stdout 解析(###标签### 切片)
 *
 * 各 section 互不依赖,内部按需 import 单个 named export。
 */

import type { Citation } from "../models.js";

// ===========================================================================
// 1) NUMERIC · 数字相关的小工具
// ===========================================================================
//
// 规则引擎从 SSH stdout / mongosh 拿的字段都是 `unknown`
// (string / number / 混杂),这里把它们安全转成 number,不抛异常,带默认
// fallback。对标 lodash.toInteger / lodash.toNumber,避免引入完整 lodash 依赖。

/** `/^\d+$/.test(String(v))` 的语义封装:是否是非负整数字符串。 */
export function isDigitString(v: unknown): boolean {
  return /^\d+$/.test(String(v));
}

/** unknown → int(支持 number / 正负整数字符串 · 其他返回 `def`,默认 0)。 */
export function toInt(v: unknown, def = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && /^-?\d+$/.test(v)) return parseInt(v, 10);
  return def;
}

/** unknown → float(支持 number / 可解析字符串 · 其他返回 `def`,默认 0)。 */
export function toFloat(v: unknown, def = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return def;
}

// ===========================================================================
// 2) KUNPENG REFS · 共享鲲鹏原厂权威引用常量(v0.3.5)
// ===========================================================================
//
// 让 arm64 / kunpeng / openeuler / os / mongo 相关的规则都能挂鲲鹏原厂引用 ·
// 让报告"参考资料汇总"按 tier 分组时真出现 `[鲲鹏 BoostKit]` / `[鲲鹏原厂]` 前缀。
//
// 在 check 函数的 `citations: [...]` 数组里按场景 push 对应 ref · 维持**现有**
// AWS Graviton / MongoDB 官方 / Ampere 等 citation 不变 · 只是再加 1 条鲲鹏。

export const KUNPENG_REFS = {
  /** BoostKit 数据库使能套件 · MongoDB 参数调优(主要 citation 源) */
  boostkitMongo: {
    title: "鲲鹏 BoostKit · MongoDB 调优指南",
    url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html",
  } as Citation,

  /** BoostKit 数据库使能套件 · 总览(MongoDB / MySQL / Redis) */
  boostkitOverview: {
    title: "鲲鹏 BoostKit · 数据库使能套件",
    url: "https://www.hikunpeng.com/developer/boostkit",
  } as Citation,

  /** ARM64 代码编译 · LSE atomics / -march=armv8.1-a / -moutline-atomics
   *  (替代旧 kunpengtpc_06_0001.html 死链 · 2026-04-25 实测 200 OK) */
  arm64Porting: {
    title: "鲲鹏毕昇编译器优化与编程指导(ARM64 编译入口)",
    url: "https://www.hikunpeng.com/document/detail/zh/kunpengdevps/compiler/opg-bisheng/kunpengbisheng_30_0001.html",
  } as Citation,

  /** 鲲鹏性能故障处理 · NUMA 跨节点访存优化
   *  (替代旧 kunpengtroubleshooting/ 死链 · 2026-04-25 实测 200 OK) */
  troubleshooting: {
    title: "鲲鹏性能优化十板斧 · NUMA 优化(减少跨 NUMA 访问内存)",
    url: "https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0014.html",
  } as Citation,

  /** openEuler 官方 MySQL 调优指南(类推 MongoDB · sysctl / sched / NIC) */
  openeulerTuning: {
    title: "openEuler · MySQL 性能调优指南",
    url: "https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html",
  } as Citation,

  /** 鲲鹏性能调优 · THP / 内存大页(2026-04-25 新增 · 替代 boostkitMongo 在 OS 级错配) */
  thpTuning: {
    title: "鲲鹏性能优化十板斧 · 调整内存页的大小(THP)",
    url: "https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0015.html",
  } as Citation,

  /** numactl 工具(2026-04-25 新增) */
  numactlTool: {
    title: "鲲鹏性能优化十板斧 · numactl 工具",
    url: "https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0009.html",
  } as Citation,
} as const;

// ===========================================================================
// 3) WAIT CLASS · rule_id → wait_class / module 映射
// ===========================================================================
//
// 所有 CheckFn 用 canonical rule_id(如 "os.thp.kernel_mode")标识 ·
// 本节按 rule_id 前缀 + 尾段语义 归到 5 类 wait class:CPU / I/O / 内存 / 并发 / 网络
//
// 用途:
//   - diagnose.mjs 汇报 "加载 54 条规则 · CPU 16 · I/O 4 · 内存 17 · 并发 10 · 网络 7"
//   - render-report.mjs 双表按 wait_class 分组折叠

export type WaitClass = "CPU" | "I/O" | "内存" | "并发" | "网络" | "其他";

/** rule_id → wait_class 精准映射表 · 覆盖当前 mongo + 通用 (os/kunpeng/arm64/openeuler) 全部 CheckFn */
const WAIT_CLASS_MAP: Record<string, WaitClass> = {
  // ---- CPU (CPU 时间 / 调度 / 指令集) ----
  "arm64.lse.cpu_flag": "CPU",
  "arm64.lse.kernel_enabled": "CPU",
  "arm64.lse.db_binary_opcodes": "CPU",
  "arm64.kernel.page_size": "CPU",
  "kunpeng.cpu.governor": "CPU",
  "kunpeng.smt.threads_per_core": "CPU",
  "kunpeng.irqbalance.active": "CPU",
  "openeuler.sched.steal_node_limit": "CPU",
  "openeuler.sched.feature_steal": "CPU",
  "openeuler.cmdline.nohz": "CPU",
  "mongo.config.wt_block_compressor": "CPU",
  "os.cpu.cores_minimum": "CPU",
  "os.kernel.version_rseq": "CPU",
  "os.env.virt_type": "CPU",
  "mongo.platform.arm64_microarch": "CPU",
  "mongo.config.tcmalloc_per_cpu_caches": "CPU",

  // ---- I/O (磁盘 I/O · 写回 · 调度) ----
  "os.iosched.device_scheduler": "I/O",
  "os.vm.dirty_ratio": "I/O",
  "os.io.disk_await_ms": "I/O",
  "os.io.disk_usage_pct": "I/O",

  // ---- 内存 (页表 / 大页 / swap / NUMA 本地性 / cache 命中) ----
  "os.thp.kernel_mode": "内存",
  "os.hugepages.static_reserved": "内存",
  "os.vm.swappiness": "内存",
  "os.vm.zone_reclaim_mode": "内存",
  "os.vm.max_map_count": "内存",
  "os.vm.overcommit_memory": "内存",
  "kunpeng.numa.balancing": "内存",
  "kunpeng.numa.topology": "内存",
  "kunpeng.numa.distance_matrix": "内存",
  "mongo.config.wt_cache_vs_memory": "内存",
  "mongo.runtime.wt_cache_hit_rate": "内存",
  "mongo.config.db_cache_vs_total_mem": "内存",
  "kunpeng.vm.swappiness_strict": "内存",
  "kunpeng.numa.interleave_recommendation": "内存",
  "mongo.config.wt_cache_pct_kunpeng": "内存",
  "mongo.runtime.wt_cache_dirty_pct": "内存",
  "mongo.runtime.wt_pages_read_volume": "内存",

  // ---- 并发 (连接 / 复制 / 慢日志 / 锁 / 票证) ----
  "mongo.runtime.connection_pool": "并发",
  "mongo.config.oplog_window_hours": "并发",
  "mongo.runtime.wt_ticket_read": "并发",
  "mongo.runtime.wt_ticket_write": "并发",
  "mongo.runtime.global_lock_queue": "并发",
  "mongo.runtime.current_op_slow": "并发",
  "mongo.runtime.connections_available": "并发",
  "mongo.runtime.sharded_index_consistency": "并发",
  "mongo.runtime.asserts_warning_total": "并发",
  "mongo.storage.journaling_enabled": "并发",

  // ---- 网络 (TCP 栈) ----
  "os.net.somaxconn": "网络",
  "os.net.tcp_keepalive_time": "网络",
  "os.net.tcp_retrans_pct": "网络",
  "os.net.tcp_max_syn_backlog": "网络",
  "kunpeng.net.somaxconn_strict": "网络",
  "kunpeng.net.tcp_keepalive_time_strict": "网络",
  "kunpeng.net.tcp_max_syn_backlog_mongo": "网络",
};

/** 单条 rule_id → wait_class 查询 · 未登记回退到"其他" */
export function waitClassOf(ruleId: string): WaitClass {
  return WAIT_CLASS_MAP[ruleId] ?? "其他";
}

/** 对一组 rule_id 按 wait_class 聚合 · 返回 {CPU: n, "I/O": n, ...} + total */
export function countByWaitClass(ruleIds: Iterable<string>): {
  total: number;
  by_wait_class: Record<WaitClass, number>;
} {
  const counts: Record<WaitClass, number> = {
    CPU: 0,
    "I/O": 0,
    内存: 0,
    并发: 0,
    网络: 0,
    其他: 0,
  };
  let total = 0;
  for (const id of ruleIds) {
    counts[waitClassOf(id)] += 1;
    total += 1;
  }
  return { total, by_wait_class: counts };
}

/** 5 wait class 固定顺序 · 用于报告渲染 */
export const WAIT_CLASS_ORDER: ReadonlyArray<WaitClass> = [
  "CPU",
  "I/O",
  "内存",
  "并发",
  "网络",
  "其他",
];

/**
 * 模块归属 · 按 rule_id 前缀决定。
 *
 * 口径 · 规则**来源归属**(非"技术领域"):
 *   - `os.*`        → "os"   · Linux 通用 sysctl / 内核参数
 *   - `openeuler.*` → "os"   · openEuler 内核特性 · 仍属 OS 层
 *   - `arm64.*`     → "硬件" · ARM64 ISA 级
 *   - `kunpeng.*`   → "硬件" · 鲲鹏平台 CPU/NUMA/SMT
 *   - `mongo.*` → 对应 engine 名
 */
export type Module = "os" | "硬件" | "mongo" | "其他";

export function moduleOf(ruleId: string): Module {
  const prefix = ruleId.split(".", 1)[0];
  switch (prefix) {
    case "os":
    case "openeuler":
      return "os";
    case "arm64":
    case "kunpeng":
      return "硬件";
    case "mongo":
      return "mongo";
    default:
      return "其他";
  }
}

/** 模块固定顺序 · 矩阵渲染从 OS 到 engine */
export const MODULE_ORDER: ReadonlyArray<Module> = [
  "os",
  "硬件",
  "mongo",
  "其他",
];

/**
 * 按 module × wait_class 二维聚合。
 *
 * 输出形如:
 *   { total: 67,
 *     by_module: {
 *       os:    { CPU: 0, "I/O": 6, 内存: 7, 并发: 0, 网络: 4, 其他: 0 },
 *       硬件:  { CPU: 7, "I/O": 0, 内存: 5, 并发: 0, 网络: 3, 其他: 0 },
 *       mongo: { CPU: 4, "I/O": 0, 内存: 5, 并发: 9, 网络: 0, 其他: 0 },
 *       ...
 *     } }
 */
export function countByModuleWaitClass(ruleIds: Iterable<string>): {
  total: number;
  by_module: Record<Module, Record<WaitClass, number>>;
} {
  const empty = (): Record<WaitClass, number> => ({
    CPU: 0,
    "I/O": 0,
    内存: 0,
    并发: 0,
    网络: 0,
    其他: 0,
  });
  const by_module: Record<Module, Record<WaitClass, number>> = {
    os: empty(),
    硬件: empty(),
    mongo: empty(),
    其他: empty(),
  };
  let total = 0;
  for (const id of ruleIds) {
    by_module[moduleOf(id)][waitClassOf(id)] += 1;
    total += 1;
  }
  return { total, by_module };
}

// ===========================================================================
// 4) OS COLLECTOR · OS 批量 stdout 解析(###标签### 切片)
// ===========================================================================
//
// 跨 engine 共享:osBatchCmd 的输出(###THP### ###NUMA### 等标签分段)
// 对所有 engine 都一样,本节负责把 stdout 解析成 os_metrics Record。

export function parseOsIntoMetrics(osStdout: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  parseOsBatch(osStdout, out);
  return out;
}

export function parseOsBatch(stdout: string, out: Record<string, unknown>): void {
  const sections = stdout.split("###");

  const thp = getSection(sections, "THP");
  if (thp) out["thp_status"] = thp;

  const numaNodes = getSection(sections, "NUMA_NODES");
  if (/^\d+$/.test(numaNodes)) out["numa_nodes"] = parseInt(numaNodes, 10);

  const numaBal = getSection(sections, "NUMA_BAL");
  if (numaBal) out["numa_balancing"] = numaBal;

  const huge = getSection(sections, "HUGEPAGES");
  if (/^\d+$/.test(huge)) out["nr_hugepages"] = parseInt(huge, 10);

  const mem = getSection(sections, "MEM");
  if (/^\d+$/.test(mem)) out["total_mem_mb"] = parseInt(mem, 10);

  const sched = getSection(sections, "IOSCHED");
  if (sched) out["io_scheduler"] = sched;

  const swap = getSection(sections, "SWAP");
  if (/^-?\d+$/.test(swap)) out["swappiness"] = parseInt(swap, 10);

  const arch = getSection(sections, "ARCH");
  if (arch) out["arch"] = arch;

  const kernel = getSection(sections, "KERNEL");
  if (kernel) out["kernel_version"] = kernel;

  const nproc = getSection(sections, "NPROC").trim();
  out["cpu_cores"] = parseIntOr(nproc, 0);

  // iostat:取所有数据行的 await 列(第 10 列),取最大
  const iostatRaw = getSection(sections, "IOSTAT");
  if (iostatRaw && iostatRaw !== "N/A") {
    let maxAwait = 0;
    for (const line of iostatRaw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("Device") || t.startsWith("Linux")) continue;
      const parts = t.split(/\s+/);
      if (parts.length >= 10) {
        const v = parseFloat(parts[9]!);
        if (Number.isFinite(v) && v > maxAwait) maxAwait = v;
      }
    }
    out["disk_await_ms"] = maxAwait;
  }

  const usage = getSection(sections, "DISKUSAGE");
  if (/^\d+$/.test(usage.trim())) {
    out["disk_usage_pct"] = parseInt(usage.trim(), 10);
  }

  const tcpRetrans = getSection(sections, "TCPRETRANS").trim();
  out["tcp_retrans_pct"] = (() => {
    const v = parseFloat(tcpRetrans);
    return Number.isFinite(v) ? v : 0;
  })();

  const cpuGov = getSection(sections, "CPUGOV").trim();
  if (cpuGov) out["cpu_governor"] = cpuGov;

  out["net_somaxconn"] = parseIntOr(getSection(sections, "SOMAXCONN").trim(), 0);
  out["tcp_keepalive_time"] = parseIntOr(
    getSection(sections, "TCPKEEPALIVE").trim(),
    0,
  );
  out["tcp_keepalive_intvl"] = parseIntOr(
    getSection(sections, "TCPKEEPALIVEINTVL").trim(),
    0,
  );
  out["vm_dirty_ratio"] = parseIntOr(getSection(sections, "DIRTYRATIO").trim(), 0);
  out["vm_dirty_background_ratio"] = parseIntOr(
    getSection(sections, "DIRTYBGRATIO").trim(),
    0,
  );
  out["smt_threads_per_core"] = parseIntOr(getSection(sections, "SMT").trim(), 0);
  out["irqbalance_active"] = getSection(sections, "IRQBALANCE").trim() || "unknown";
  out["env_virt_type"] = getSection(sections, "VIRT").trim() || "unknown";
  out["env_sys_vendor"] = getSection(sections, "SYSVENDOR").trim() || "unknown";
  out["env_product_name"] = getSection(sections, "PRODUCT").trim() || "unknown";

  // --- Wave 2 新增字段(v0.3 § 4.5 鲲鹏 ARM64 规则集) ---
  const osRelease = getSection(sections, "OS_RELEASE");
  if (osRelease) {
    out["os_release_raw"] = osRelease;
    const idLine = osRelease.split("\n").find((l) => l.startsWith("ID="));
    if (idLine) out["os_id"] = idLine.replace(/^ID="?|"?$/g, "").trim();
  }

  const cpuModel = getSection(sections, "CPU_MODEL");
  if (cpuModel) {
    out["cpu_model_raw"] = cpuModel;
    const modelLine = cpuModel.split("\n").find((l) => /model name/i.test(l));
    if (modelLine) out["cpu_model"] = modelLine.split(":").slice(1).join(":").trim();
    const vendorLine = cpuModel.split("\n").find((l) => /vendor\s*id|cpu implementer/i.test(l));
    if (vendorLine) out["cpu_vendor"] = vendorLine.split(":").slice(1).join(":").trim();
  }

  const lseCpu = getSection(sections, "LSE_CPU");
  if (lseCpu) {
    out["lse_cpu_raw"] = lseCpu;
    out["lse_cpu_atomics"] = /\batomics\b/.test(lseCpu);
  }

  const lseDmesg = getSection(sections, "LSE_DMESG");
  if (lseDmesg) {
    out["lse_dmesg_has_lse"] = /LSE/i.test(lseDmesg);
  }

  const lseMongodFirst = getSection(sections, "LSE_MONGOD").trim().split("\n")[0]?.trim() ?? "";
  out["lse_mongod_count"] =
    lseMongodFirst === "na" ? null : parseIntOr(lseMongodFirst, 0);

  out["pagesize_bytes"] = parseIntOr(getSection(sections, "PAGESIZE").trim(), 0);

  const numaDist = getSection(sections, "NUMA_DIST");
  if (numaDist && numaDist !== "unknown") {
    out["numa_dist_raw"] = numaDist;
    const nums: number[] = [];
    for (const line of numaDist.split("\n")) {
      for (const tok of line.trim().split(/\s+/)) {
        const n = parseInt(tok, 10);
        if (Number.isFinite(n) && n > 0 && n < 255) nums.push(n);
      }
    }
    out["numa_dist_max"] = nums.length > 0 ? Math.max(...nums) : 0;
    out["numa_dist_min"] = nums.length > 0 ? Math.min(...nums) : 0;
  }

  const schedSteal = getSection(sections, "SCHED_STEAL").trim();
  out["sched_steal_node_limit"] = schedSteal === "none" ? null : schedSteal;
  const schedFeatures = getSection(sections, "SCHED_FEATURES");
  if (schedFeatures) {
    out["sched_features_raw"] = schedFeatures;
    out["sched_feature_steal_on"] = /\bSTEAL\b(?!_)/.test(schedFeatures) && !/NO_STEAL\b/.test(schedFeatures);
  }
  const nohz = getSection(sections, "NOHZ_CMDLINE").trim();
  out["nohz_cmdline"] = nohz === "none" ? null : nohz;

  out["vm_zone_reclaim_mode"] = parseIntOr(getSection(sections, "VM_ZONE_RECLAIM").trim(), -1);
  out["vm_max_map_count"] = parseIntOr(getSection(sections, "VM_MAX_MAP_COUNT").trim(), 0);
  out["vm_overcommit_memory"] = parseIntOr(getSection(sections, "VM_OVERCOMMIT").trim(), -1);
  out["tcp_max_syn_backlog"] = parseIntOr(getSection(sections, "TCP_MAX_SYN_BACKLOG").trim(), 0);
}

export function getSection(sections: string[], tag: string): string {
  for (let i = 0; i < sections.length; i++) {
    if (sections[i]?.trim() === tag) {
      return (sections[i + 1] ?? "").trim();
    }
  }
  return "";
}

export function parseIntOr(s: string, fallback: number): number {
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  return fallback;
}
