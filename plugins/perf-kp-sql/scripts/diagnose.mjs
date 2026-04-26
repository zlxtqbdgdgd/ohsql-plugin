#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath as __fileURLToPath } from "url";
import { dirname as __pathDirname } from "path";
const require = createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __pathDirname(__filename);
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// skills/perf-kp-sql/src/cli-diagnose.ts
import { readFile } from "node:fs/promises";
import { join as join3, dirname as dirname2 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// skills/perf-kp-sql/src/models.ts
function osVal(ctx, key, def) {
  const v = ctx.os_metrics[key];
  return v === void 0 ? def : v;
}
function dbVal(ctx, key, def) {
  const v = ctx.db_metrics[key];
  return v === void 0 ? def : v;
}
function deriveScope(ctx, engine, instance = "default") {
  const os = ctx.os_metrics;
  const db = ctx.db_metrics;
  const archRaw = String(os.arch ?? "").toLowerCase();
  const arch = archRaw.includes("aarch64") || archRaw.includes("arm") ? "arm64" : archRaw.includes("x86") || archRaw.includes("amd64") ? "x86_64" : void 0;
  const cpuVendor = String(os.cpu_vendor ?? os.cpu_model ?? "").toLowerCase();
  const vendor = cpuVendor.includes("hisilicon") || cpuVendor.includes("kunpeng") || cpuVendor.includes("taishan") ? "kunpeng" : cpuVendor.includes("graviton") || cpuVendor.includes("aws") ? "graviton" : cpuVendor.includes("ampere") || cpuVendor.includes("altra") ? "ampere" : cpuVendor.includes("amd") ? "amd" : cpuVendor.includes("intel") || cpuVendor.includes("genuine") ? "intel" : void 0;
  const osName = String(os.os_id ?? os.os_name ?? "").toLowerCase();
  const osTag = osName.includes("openeuler") ? "openeuler" : osName.includes("almalinux") || osName.includes("alma") ? "almalinux" : osName.includes("ubuntu") ? "ubuntu" : osName.includes("centos") ? "centos" : osName.includes("rhel") || osName.includes("redhat") ? "rhel" : void 0;
  const engine_version = db.version;
  return {
    engine,
    instance,
    arch,
    vendor,
    os: osTag,
    engine_version
  };
}
function okResult(args) {
  return {
    id: args.id,
    title: args.title ?? args.id,
    severity: "ok",
    scope: args.scope,
    summary: args.summary ?? "",
    description: args.description ?? args.summary ?? "",
    reason: args.reason ?? "",
    evidence: args.evidence ?? [],
    impact: { metric: args.impactMetric ?? "db_time_pct", value: 0, unit: "percent", confidence: "high" },
    citations: args.citations ?? [],
    recommendations: [],
    bucket: args.bucket,
    needs_human_review: false,
    threshold_display: args.threshold_display
  };
}
function infoResult(args) {
  const base = { ...okResult(args), severity: "info" };
  if (args.skip_reason) {
    return { ...base, skip_reason: args.skip_reason };
  }
  return base;
}
function finding(args) {
  return {
    id: args.id,
    title: args.title ?? args.id,
    severity: args.severity,
    scope: args.scope,
    summary: args.summary ?? "",
    description: args.description ?? args.summary ?? "",
    reason: args.reason ?? "",
    evidence: args.evidence,
    impact: args.impact,
    citations: args.citations ?? [],
    recommendations: args.recommendations ?? [],
    bucket: args.bucket,
    workload_tag: args.workload_tag,
    needs_human_review: args.needs_human_review ?? (args.recommendations ?? []).length === 0,
    rationale: args.rationale,
    surfaceable_only: args.surfaceable_only,
    threshold_display: args.threshold_display
  };
}
var DEFAULT_GUARDRAILS = [
  { metric: "error_rate", threshold: 0.01, direction: "gt", unit: "fraction" },
  { metric: "slow_query_delta", threshold: 5, direction: "gt", unit: "count_per_min" },
  { metric: "connection_reset_rate", threshold: 5e-3, direction: "gt", unit: "fraction" }
];
function templateFixExperiment(args) {
  const id = `exp-${args.findingId}-${Date.now().toString(36)}`;
  return {
    id,
    finding_id: args.findingId,
    rule_title: args.ruleTitle,
    apply: {
      action: args.action,
      reverse: args.reverse ?? "(\u672A\u58F0\u660E reverse \xB7 \u4E0D\u652F\u6301\u81EA\u52A8\u9A8C\u8BC1)"
    },
    expected_signal: {
      metric: args.expectedMetric,
      direction: args.expectedDirection,
      min_effect: args.expectedMinEffect ?? 15,
      unit: "percent"
    },
    guardrails: args.guardrails ?? DEFAULT_GUARDRAILS,
    window_sec: args.windowSec ?? 300,
    warm_sec: args.warmSec ?? 60,
    before: null,
    after: null,
    classification: "pending",
    drift_kl: null,
    rolled_back: false,
    evidence_table: null,
    templated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// skills/perf-kp-sql/src/shared/utils.ts
function isDigitString(v) {
  return /^\d+$/.test(String(v));
}
function toInt(v, def = 0) {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && /^-?\d+$/.test(v)) return parseInt(v, 10);
  return def;
}
function toFloat(v, def = 0) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return def;
}
var KUNPENG_REFS = {
  /** BoostKit 数据库使能套件 · MongoDB 参数调优(主要 citation 源) */
  boostkitMongo: {
    title: "\u9CB2\u9E4F BoostKit \xB7 MongoDB \u8C03\u4F18\u6307\u5357",
    url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html"
  },
  /** BoostKit 数据库使能套件 · 总览(MongoDB / MySQL / Redis) */
  boostkitOverview: {
    title: "\u9CB2\u9E4F BoostKit \xB7 \u6570\u636E\u5E93\u4F7F\u80FD\u5957\u4EF6",
    url: "https://www.hikunpeng.com/developer/boostkit"
  },
  /** ARM64 代码编译 · LSE atomics / -march=armv8.1-a / -moutline-atomics
   *  (替代旧 kunpengtpc_06_0001.html 死链 · 2026-04-25 实测 200 OK) */
  arm64Porting: {
    title: "\u9CB2\u9E4F\u6BD5\u6607\u7F16\u8BD1\u5668\u4F18\u5316\u4E0E\u7F16\u7A0B\u6307\u5BFC(ARM64 \u7F16\u8BD1\u5165\u53E3)",
    url: "https://www.hikunpeng.com/document/detail/zh/kunpengdevps/compiler/opg-bisheng/kunpengbisheng_30_0001.html"
  },
  /** 鲲鹏性能故障处理 · NUMA 跨节点访存优化
   *  (替代旧 kunpengtroubleshooting/ 死链 · 2026-04-25 实测 200 OK) */
  troubleshooting: {
    title: "\u9CB2\u9E4F\u6027\u80FD\u4F18\u5316\u5341\u677F\u65A7 \xB7 NUMA \u4F18\u5316(\u51CF\u5C11\u8DE8 NUMA \u8BBF\u95EE\u5185\u5B58)",
    url: "https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0014.html"
  },
  /** openEuler 官方 MySQL 调优指南(类推 MongoDB · sysctl / sched / NIC) */
  openeulerTuning: {
    title: "openEuler \xB7 MySQL \u6027\u80FD\u8C03\u4F18\u6307\u5357",
    url: "https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html"
  },
  /** 鲲鹏性能调优 · THP / 内存大页(2026-04-25 新增 · 替代 boostkitMongo 在 OS 级错配) */
  thpTuning: {
    title: "\u9CB2\u9E4F\u6027\u80FD\u4F18\u5316\u5341\u677F\u65A7 \xB7 \u8C03\u6574\u5185\u5B58\u9875\u7684\u5927\u5C0F(THP)",
    url: "https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0015.html"
  },
  /** numactl 工具(2026-04-25 新增) */
  numactlTool: {
    title: "\u9CB2\u9E4F\u6027\u80FD\u4F18\u5316\u5341\u677F\u65A7 \xB7 numactl \u5DE5\u5177",
    url: "https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0009.html"
  }
};
var WAIT_CLASS_MAP = {
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
  "os.thp.kernel_mode": "\u5185\u5B58",
  "os.hugepages.static_reserved": "\u5185\u5B58",
  "os.vm.swappiness": "\u5185\u5B58",
  "os.vm.zone_reclaim_mode": "\u5185\u5B58",
  "os.vm.max_map_count": "\u5185\u5B58",
  "os.vm.overcommit_memory": "\u5185\u5B58",
  "kunpeng.numa.balancing": "\u5185\u5B58",
  "kunpeng.numa.topology": "\u5185\u5B58",
  "kunpeng.numa.distance_matrix": "\u5185\u5B58",
  "mongo.config.wt_cache_vs_memory": "\u5185\u5B58",
  "mongo.runtime.wt_cache_hit_rate": "\u5185\u5B58",
  "mongo.config.db_cache_vs_total_mem": "\u5185\u5B58",
  "kunpeng.vm.swappiness_strict": "\u5185\u5B58",
  "kunpeng.numa.interleave_recommendation": "\u5185\u5B58",
  "mongo.config.wt_cache_pct_kunpeng": "\u5185\u5B58",
  "mongo.runtime.wt_cache_dirty_pct": "\u5185\u5B58",
  "mongo.runtime.wt_pages_read_volume": "\u5185\u5B58",
  // ---- 并发 (连接 / 复制 / 慢日志 / 锁 / 票证) ----
  "mongo.runtime.connection_pool": "\u5E76\u53D1",
  "mongo.config.oplog_window_hours": "\u5E76\u53D1",
  "mongo.runtime.wt_ticket_read": "\u5E76\u53D1",
  "mongo.runtime.wt_ticket_write": "\u5E76\u53D1",
  "mongo.runtime.global_lock_queue": "\u5E76\u53D1",
  "mongo.runtime.current_op_slow": "\u5E76\u53D1",
  "mongo.runtime.connections_available": "\u5E76\u53D1",
  "mongo.runtime.sharded_index_consistency": "\u5E76\u53D1",
  "mongo.runtime.asserts_warning_total": "\u5E76\u53D1",
  "mongo.storage.journaling_enabled": "\u5E76\u53D1",
  // ---- 网络 (TCP 栈) ----
  "os.net.somaxconn": "\u7F51\u7EDC",
  "os.net.tcp_keepalive_time": "\u7F51\u7EDC",
  "os.net.tcp_retrans_pct": "\u7F51\u7EDC",
  "os.net.tcp_max_syn_backlog": "\u7F51\u7EDC",
  "kunpeng.net.somaxconn_strict": "\u7F51\u7EDC",
  "kunpeng.net.tcp_keepalive_time_strict": "\u7F51\u7EDC",
  "kunpeng.net.tcp_max_syn_backlog_mongo": "\u7F51\u7EDC"
};
function waitClassOf(ruleId) {
  return WAIT_CLASS_MAP[ruleId] ?? "\u5176\u4ED6";
}
function countByWaitClass(ruleIds) {
  const counts = {
    CPU: 0,
    "I/O": 0,
    \u5185\u5B58: 0,
    \u5E76\u53D1: 0,
    \u7F51\u7EDC: 0,
    \u5176\u4ED6: 0
  };
  let total = 0;
  for (const id of ruleIds) {
    counts[waitClassOf(id)] += 1;
    total += 1;
  }
  return { total, by_wait_class: counts };
}
function moduleOf(ruleId) {
  const prefix = ruleId.split(".", 1)[0];
  switch (prefix) {
    case "os":
    case "openeuler":
      return "os";
    case "arm64":
    case "kunpeng":
      return "\u786C\u4EF6";
    case "mongo":
      return "mongo";
    default:
      return "\u5176\u4ED6";
  }
}
var MODULE_ORDER = [
  "os",
  "\u786C\u4EF6",
  "mongo",
  "\u5176\u4ED6"
];
function parseOsBatch(stdout, out) {
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
  const iostatRaw = getSection(sections, "IOSTAT");
  if (iostatRaw && iostatRaw !== "N/A") {
    let maxAwait = 0;
    for (const line of iostatRaw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("Device") || t.startsWith("Linux")) continue;
      const parts = t.split(/\s+/);
      if (parts.length >= 10) {
        const v = parseFloat(parts[9]);
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
    0
  );
  out["tcp_keepalive_intvl"] = parseIntOr(
    getSection(sections, "TCPKEEPALIVEINTVL").trim(),
    0
  );
  out["vm_dirty_ratio"] = parseIntOr(getSection(sections, "DIRTYRATIO").trim(), 0);
  out["vm_dirty_background_ratio"] = parseIntOr(
    getSection(sections, "DIRTYBGRATIO").trim(),
    0
  );
  out["smt_threads_per_core"] = parseIntOr(getSection(sections, "SMT").trim(), 0);
  out["irqbalance_active"] = getSection(sections, "IRQBALANCE").trim() || "unknown";
  out["env_virt_type"] = getSection(sections, "VIRT").trim() || "unknown";
  out["env_sys_vendor"] = getSection(sections, "SYSVENDOR").trim() || "unknown";
  out["env_product_name"] = getSection(sections, "PRODUCT").trim() || "unknown";
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
  out["lse_mongod_count"] = lseMongodFirst === "na" ? null : parseIntOr(lseMongodFirst, 0);
  out["pagesize_bytes"] = parseIntOr(getSection(sections, "PAGESIZE").trim(), 0);
  const numaDist = getSection(sections, "NUMA_DIST");
  if (numaDist && numaDist !== "unknown") {
    out["numa_dist_raw"] = numaDist;
    const nums = [];
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
function getSection(sections, tag) {
  for (let i = 0; i < sections.length; i++) {
    if (sections[i]?.trim() === tag) {
      return (sections[i + 1] ?? "").trim();
    }
  }
  return "";
}
function parseIntOr(s, fallback) {
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  return fallback;
}

// skills/perf-kp-sql/src/shared/legacy-checks.ts
function requireArm64(ctx, id, title, bucket) {
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  if (scope.arch !== "arm64") {
    return {
      skip: infoResult({
        id,
        title,
        bucket,
        scope,
        summary: "\u89C4\u5219\u4EC5\u9002\u7528 ARM64,\u5DF2\u8DF3\u8FC7",
        reason: `\u68C0\u6D4B\u5230 arch=${scope.arch ?? "unknown"}`,
        skip_reason: "arch_mismatch"
      }),
      scope
    };
  }
  return { skip: null, scope };
}
var check_arm64_lse_cpu = (ctx) => {
  const id = "arm64.lse.cpu_flag";
  const title = "LSE atomics CPU \u652F\u6301";
  const { skip, scope } = requireArm64(ctx, id, title, 1);
  if (skip) return skip;
  const has = osVal(ctx, "lse_cpu_atomics", false);
  const raw = osVal(ctx, "lse_cpu_raw", "");
  if (!raw) {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u672A\u91C7\u96C6\u5230 CPU flags", reason: "lscpu Flags \u884C\u8BFB\u53D6\u5931\u8D25" });
  }
  if (has) {
    return okResult({ id, title, bucket: 1, scope, summary: "atomics flag \u5DF2\u542F\u7528", reason: "CPU \u652F\u6301 Armv8.1 LSE \u539F\u5B50\u6307\u4EE4" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: "CPU flags \u672A\u5217\u51FA atomics",
    description: "CPU \u4E0D\u652F\u6301 LSE atomics(Armv8.1+),\u9000\u56DE ldxr/stxr \u5FAA\u73AF,DB \u7ADE\u4E89\u8DEF\u5F84\u6027\u80FD\u663E\u8457\u964D\u4F4E",
    reason: "lscpu | grep ^Flags: \u672A\u53D1\u73B0 atomics \u6807\u5FD7",
    threshold_display: "atomics flag \u5B58\u5728",
    evidence: [{ kind: "config", value: `lscpu_flags=${raw.slice(0, 120)}` }],
    impact: { metric: "latency_p95_ms", value: 30, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.arm64Porting,
      { title: "AWS Graviton \xB7 ARM64 LSE atomics", url: "https://github.com/aws/aws-graviton-getting-started/blob/main/c-c%2B%2B.md" },
      { title: "AWS Graviton Technical Guide \xB7 optimizing", url: "https://github.com/aws/aws-graviton-getting-started/blob/main/optimizing.md" }
    ],
    recommendations: [
      {
        action: "\u5347\u7EA7\u5230\u652F\u6301 Armv8.1 \u7684 CPU \xB7 \u6216\u786E\u8BA4 BIOS \u672A\u7981\u7528 LSE",
        rationale: "\u786C\u4EF6 / BIOS \u7EA7 \xB7 \u975E sysctl \u53EF\u6539",
        type: "detect",
        fix_cost: "restart_engine",
        verifiable: false
      }
    ],
    surfaceable_only: true,
    rationale: {
      summary: "LSE(Large System Extensions \xB7 Armv8.1+)\u662F ARM64 \u591A\u6838\u539F\u5B50\u6307\u4EE4\u96C6 \xB7 cas/ldadd/swp/stlr \u7B49 \xB7 \u73B0\u4EE3 DB \u7684\u9501\u548C\u539F\u5B50\u8BA1\u6570\u51E0\u4E4E\u5168\u8D70\u8FD9\u4E9B\u6307\u4EE4\u3002CPU \u4E0D\u652F\u6301 LSE \u65F6\u6240\u6709\u539F\u5B50\u64CD\u4F5C\u9000\u5316\u6210 ldxr/stxr load-linked/store-conditional \u5FAA\u73AF \xB7 \u7ADE\u4E89\u4E0B retry \u6210\u672C\u6307\u6570\u4E0A\u5347\u3002",
      mechanism: "\u65E0 LSE \u65F6\u4E00\u6B21 atomic increment \u7684\u51B2\u7A81\u8DEF\u5F84\u662F:ldxr \u628A\u53D8\u91CF load \u5230 exclusive monitor \u2192 \u5C1D\u8BD5 stxr \xB7 \u82E5 monitor \u88AB\u5176\u4ED6\u6838\u8E29\u5230\u5219\u5931\u8D25 \u2192 loop \u91CD\u6765\u300216 \u6838\u5E76\u53D1\u4E0B\u6BCF\u4E2A atomic op \u5E73\u5747\u91CD\u8BD5 3-10 \u6B21 \xB7 \u7B49\u540C 3-10 \u500D\u6307\u4EE4\u6570\u3002\u5E26 LSE \u65F6 cas/ldadd \u662F single-cycle atomic \xB7 \u786C\u4EF6\u4FDD\u8BC1\u65E0\u91CD\u8BD5\u3002",
      trade_offs: "LSE \u662F\u786C\u4EF6 + \u5185\u6838 + \u7528\u6237\u6001\u4E09\u65B9\u534F\u4F5C \xB7 \u5FC5\u987B Armv8.1+ \u82AF\u7247 + \u5185\u6838\u8BC6\u522B + \u4E8C\u8FDB\u5236\u5E26 -march=armv8.1-a \u6216 -moutline-atomics\u3002\u6362 CPU \u662F\u786C\u6210\u672C\u4F46\u9CB2\u9E4F 920 / Graviton 2+ / Ampere Altra \u539F\u751F\u652F\u6301 \xB7 \u53EA\u9700\u786E\u8BA4 BIOS \u6CA1\u7981\u3002",
      when_to_deviate: "Armv8.0 \u8001\u82AF\u7247(\u6811\u8393\u6D3E 3/4 \xB7 \u65E9\u671F\u5DE5\u4E1A\u677F)\xB7 \u53EA\u8BFB / \u4F4E\u5E76\u53D1\u573A\u666F\u4E0B LSE \u5F71\u54CD\u53EF\u5FFD\u7565\u3002\u751F\u4EA7 OLTP / \u9AD8\u5E76\u53D1\u8BFB\u5199\u5FC5\u987B LSE\u3002"
    }
  });
};
var check_arm64_lse_kernel = (ctx) => {
  const id = "arm64.lse.kernel_enabled";
  const title = "LSE atomics \u5185\u6838\u65E5\u5FD7";
  const { skip, scope } = requireArm64(ctx, id, title, 1);
  if (skip) return skip;
  const hasKernel = osVal(ctx, "lse_dmesg_has_lse", false);
  if (!hasKernel) {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "dmesg \u672A\u663E\u793A LSE atomics \u542F\u7528\u4FE1\u606F",
      reason: "\u53EF\u80FD dmesg \u6743\u9650\u4E0D\u8DB3(\u975E root)\u6216\u542F\u52A8\u65E5\u5FD7\u5DF2\u8F6E\u8F6C \xB7 \u53EF\u7528 lscpu atomics \u4EA4\u53C9\u786E\u8BA4"
    });
  }
  return okResult({ id, title, bucket: 1, scope, summary: "\u5185\u6838\u542F\u52A8\u65E5\u5FD7\u786E\u8BA4 LSE \u542F\u7528", reason: "Linux \u5185\u6838\u5728\u542F\u52A8\u65F6\u8BC6\u522B\u5E76\u542F\u7528\u4E86 LSE atomics" });
};
function engineBinary(engine) {
  if (engine === "mongo") return "mongod";
  return null;
}
var check_arm64_lse_binary = (ctx) => {
  const id = "arm64.lse.db_binary_opcodes";
  const title = "DB \u4E8C\u8FDB\u5236 LSE \u6307\u4EE4";
  const { skip, scope } = requireArm64(ctx, id, title, 1);
  if (skip) return skip;
  const engine = scope.engine;
  const bin = engineBinary(engine);
  if (!bin) {
    return infoResult({ id, title, bucket: 1, scope, summary: `${engine} \u4E0D\u9002\u7528`, reason: "\u4EC5 mongod \u9700\u8981\u68C0\u67E5" });
  }
  const count = osVal(ctx, "lse_mongod_count", null);
  if (count === null) {
    return infoResult({ id, title, bucket: 1, scope, summary: `\u672A\u627E\u5230 ${bin} \u4E8C\u8FDB\u5236`, reason: `command -v ${bin} \u65E0\u8FD4\u56DE(\u6216 nm \u4E0D\u53EF\u7528)` });
  }
  if (count > 0) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `${bin} .dynsym \u542B ${count} \u4E2A outline-atomics \u7B26\u53F7`,
      reason: `\u4E8C\u8FDB\u5236\u7F16\u8BD1\u65F6\u5E26\u4E86 -moutline-atomics(\u9ED8\u8BA4 gcc 10+),\u8FD0\u884C\u671F\u5728\u9CB2\u9E4F CPU \u4E0A\u4F1A\u8C03\u5EA6\u5230 LSE \u539F\u5B50\u6307\u4EE4`
    });
  }
  return finding({
    id,
    title,
    severity: "info",
    bucket: 1,
    scope,
    summary: `${bin} .dynsym \u672A\u53D1\u73B0 outline-atomics \u7B26\u53F7 \xB7 \u9700\u624B\u52A8\u786E\u8BA4 LSE \u662F\u5426\u542F\u7528`,
    description: `${bin} \u4E8C\u8FDB\u5236 .dynsym \u6BB5\u6CA1\u6709 __aarch64_(cas|ldadd|swp|ldset) \u7B49 outline-atomics \u52A8\u6001\u7B26\u53F7\u3002\u8FD9\u6709\u4E09\u79CD\u53EF\u80FD,\u65E0\u6CD5\u9760 nm -D \u533A\u5206: (a) \u7F16\u8BD1\u65F6\u65E2\u6CA1\u5E26 -moutline-atomics \u4E5F\u6CA1 -march=armv8.1-a+lse \u00B7 \u7ADE\u4E89\u8DEF\u5F84\u9000\u56DE ldxr/stxr \u00B7 ARM64 \u4E0A\u541E\u5410\u8170\u65A9(\u6700\u5E38\u89C1 \u00B7 \u8001 distro repo build); (b) \u7528 -march=armv8.1-a+lse \u76F4\u63A5\u5185\u8054 LSE \u00B7 \u5DF2\u662F\u6700\u4F18 build \u4F46 outline \u7B26\u53F7\u81EA\u7136\u4E0D\u51FA\u73B0; (c) \u9759\u6001\u94FE\u63A5 libgcc \u00B7 outline-atomics \u51FD\u6570\u88AB inline \u8FDB\u4E8C\u8FDB\u5236 \u00B7 \u4E5F\u4E0D\u5728 .dynsym\u3002\u5EFA\u8BAE\u624B\u52A8 readelf -A / \u6216\u5BF9\u6BD4 perf \u706B\u7130\u56FE\u7684 ldxr/stxr \u5360\u6BD4\u6765\u533A\u5206\u3002`,
    reason: `nm -D $(command -v ${bin}) \u4E2D __aarch64_(have_lse_atomics|cas|ldadd|swp|ldset) \u7B49 outline-atomics \u52A8\u6001\u7B26\u53F7\u51FA\u73B0 0 \u6B21 \u00B7 \u4F46\u65E0\u6CD5\u636E\u6B64\u72EC\u7ACB\u5224\u65AD\u662F\u5426\u8D70\u4E86 LSE`,
    threshold_display: "> 0 outline-atomics symbols (info-only \xB7 \u4E0D\u5224 warning)",
    evidence: [{ kind: "metric", value: `lse_outline_symbols_${bin}=0` }],
    impact: { metric: "throughput_qps", value: 25, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.arm64Porting,
      { title: "AWS Graviton \xB7 C/C++ LSE (-moutline-atomics)", url: "https://github.com/aws/aws-graviton-getting-started/blob/main/c-c%2B%2B.md" },
      { title: "Percona \xB7 ARM64 MySQL builds", url: "https://www.percona.com/blog/percona-server-for-mysql-and-percona-xtrabackup-now-available-for-arm64/" }
    ],
    recommendations: [
      {
        action: `\u6362\u88C5\u5E26 LSE \u7684 ${bin} \u6784\u5EFA(Percona ARM64 RPM / \u81EA\u7F16\u8BD1 -march=armv8.1-a / -moutline-atomics)`,
        rationale: "LSE atomics \u662F ARM64 DB \u541E\u5410\u7684\u6700\u5927\u5355\u4E00\u6760\u6746",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true
      }
    ],
    rationale: {
      summary: "\u5373\u4F7F CPU \u548C\u5185\u6838\u90FD\u652F\u6301 LSE \xB7 DB \u4E8C\u8FDB\u5236\u672C\u8EAB\u5FC5\u987B\u7528 LSE-aware \u7F16\u8BD1\u5668\u6784\u5EFA\u624D\u80FD\u7528\u4E0A\u3002\u8001\u53D1\u884C\u7248 repo \u7684 mongod / mysqld \u5E38\u662F -march=armv8-a \u6784\u5EFA \xB7 \u8FD0\u884C\u5728\u9CB2\u9E4F\u4E0A\u4E5F\u662F ldxr \u5FAA\u73AF \xB7 \u786C\u4EF6\u767D\u7ED9\u4E0D\u7528\u3002",
      mechanism: "\u4E8C\u8FDB\u5236\u91CC\u6709\u6CA1\u6709 LSE \u770B objdump -d \u4E2D\u7684 cas*/ldadd*/swp*/cas* \u7CFB\u5217 opcode\u3002\u82E5\u8BA1\u6570\u4E3A 0 \u8BF4\u660E\u7F16\u8BD1\u5668\u6CA1\u5E26 -march=armv8.1-a \u6216 -moutline-atomics\u3002\u540E\u8005\u66F4\u5B9E\u7528:\u7F16\u8BD1\u65F6\u751F\u6210 runtime-dispatch stub \xB7 \u8001 CPU \u8D70 ldxr \u8DEF\u5F84 \xB7 LSE CPU \u8D70 cas \u8DEF\u5F84 \xB7 \u4E00\u4E2A\u4E8C\u8FDB\u5236\u4E24\u5904\u8DD1\u3002",
      trade_offs: "\u6362\u5E26 LSE \u7684\u4E8C\u8FDB\u5236\u9700\u8981\u91CD\u88C5 package(Percona ARM64 repo / MongoDB \u5B98\u65B9 aarch64 rpm)\u6216\u81EA\u7F16\u8BD1\u3002\u91CD\u88C5\u5F15\u5165 engine restart \xB7 rolling restart \u65E0\u635F\u3002LSE \u541E\u5410\u589E\u76CA\u5728\u9AD8\u7ADE\u4E89 OLTP \u573A\u666F\u53EF\u8FBE 25-40%\u3002",
      when_to_deviate: "\u53D7\u9650\u73AF\u5883\u53EA\u80FD\u88C5\u53D1\u884C\u7248 repo \u4E8C\u8FDB\u5236\u65F6\u6CA1\u5F97\u9009\u3002\u53EF\u8003\u8651 LD_PRELOAD \u7684 glibc atomics \u517C\u5BB9\u5C42 \xB7 \u4F46\u6548\u679C\u4E0D\u5982\u91CD\u7F16\u8BD1\u5F7B\u5E95\u3002"
    }
  });
};
var check_arm64_pagesize = (ctx) => {
  const id = "arm64.kernel.page_size";
  const title = "ARM64 \u5185\u6838\u9875\u5927\u5C0F";
  const { skip, scope } = requireArm64(ctx, id, title, 1);
  if (skip) return skip;
  const sz = toInt(osVal(ctx, "pagesize_bytes", 0), 0);
  if (sz === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u672A\u91C7\u96C6 PAGESIZE", reason: "getconf PAGESIZE \u65E0\u8FD4\u56DE" });
  }
  const label = sz === 4096 ? "4K(\u53D1\u884C\u7248\u9ED8\u8BA4)" : sz === 16384 ? "16K" : sz === 65536 ? "64K(\u5927 buffer DB \u53EF\u9009)" : `${sz}B`;
  return infoResult({
    id,
    title,
    bucket: 1,
    scope,
    summary: `PAGESIZE=${sz} \xB7 ${label}`,
    reason: "\u5927 buffer DB \u53EF\u9009 64K \u51CF TLB stall,\u4F46\u8981\u5148\u7528 perf stat -e stall_frontend_tlb \u6D4B\u91CF\u6536\u76CA"
  });
};
var arm64Checks = [
  check_arm64_lse_cpu,
  check_arm64_lse_kernel,
  check_arm64_lse_binary,
  check_arm64_pagesize
];
function requireKunpeng(ctx, id, title, bucket) {
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  if (scope.vendor !== "kunpeng") {
    return infoResult({
      id,
      title,
      bucket,
      scope,
      summary: "\u89C4\u5219\u4EC5\u9002\u7528 Kunpeng ARM64,\u5DF2\u8DF3\u8FC7",
      reason: `\u68C0\u6D4B\u5230 vendor=${scope.vendor ?? "unknown"} \xB7 arch=${scope.arch ?? "unknown"},\u975E\u9CB2\u9E4F\u5E73\u53F0`,
      skip_reason: "vendor_mismatch"
    });
  }
  return { scope };
}
var check_cpu_governor = (ctx) => {
  const id = "kunpeng.cpu.governor";
  const title = "CPU Governor \u8C03\u9891\u7B56\u7565";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;
  const governor = osVal(ctx, "cpu_governor", "");
  if (!governor || governor === "SKIP") {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "\u672A\u91C7\u96C6\u5230 scaling_governor",
      reason: "cpufreq \u4E0D\u53EF\u8BFB(\u53EF\u80FD\u5185\u6838\u4E0D\u652F\u6301\u6216\u6743\u9650\u4E0D\u8DB3)"
    });
  }
  const governors = governor.split(",").map((g) => g.trim()).filter(Boolean);
  const bad = governors.filter((g) => g === "powersave" || g === "ondemand");
  if (bad.length === 0) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `governor=${governor}`,
      reason: "\u5DF2\u914D\u7F6E\u9AD8\u6027\u80FD\u8C03\u9891\u7B56\u7565"
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `governor=${bad.join(",")} \u975E\u9AD8\u6027\u80FD\u6A21\u5F0F`,
    description: "CPU \u8C03\u9891\u7B56\u7565\u5728 powersave/ondemand \u4E0B,\u8D1F\u8F7D\u5CF0\u503C\u4F1A\u56E0\u9891\u7387\u5207\u6362\u5F15\u5165\u989D\u5916\u5EF6\u8FDF,\u9CB2\u9E4F\u4E0A\u5C24\u5176\u660E\u663E\u3002",
    reason: `governor=${governor} \xB7 \u6570\u636E\u5E93\u751F\u4EA7\u573A\u666F\u8981\u6C42 performance`,
    threshold_display: "performance",
    evidence: [
      { kind: "config", value: `scaling_governor=${governor}`, source_url: "/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor" }
    ],
    impact: { metric: "latency_p95_ms", value: 15, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitOverview,
      { title: "Ampere Redis Setup and Tuning Guide \xB7 CPU scaling", url: "https://amperecomputing.com/en/tuning-guides/Redis-setup-and-tuning-guide" },
      { title: "openEuler MySQL Performance Tuning", url: "https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html" }
    ],
    recommendations: [
      {
        action: "echo performance | tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor",
        rationale: "DB \u751F\u4EA7\u8D1F\u8F7D\u8981\u6C42\u9891\u7387\u7A33\u5B9A,\u907F\u514D\u8C03\u9891\u5F15\u5165\u6296\u52A8",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true
      }
    ],
    rationale: {
      summary: "CPU governor \u63A7\u5236\u9891\u7387\u52A8\u6001\u8C03\u8282 \xB7 powersave/ondemand \u5728\u4F4E\u8D1F\u8F7D\u65F6\u964D\u9891\u7701\u7535 \xB7 \u7A81\u53D1\u8BF7\u6C42\u65F6\u9700 \u03BCs \u7EA7\u722C\u9891 \xB7 DB \u573A\u666F\u4E0B\u5BB9\u6613\u8BA9 p99 \u5EF6\u8FDF\u6296\u52A8\u3002performance \u56FA\u5B9A\u6700\u9AD8\u9891 \xB7 \u7A33\u6001\u529F\u8017\u7565\u9AD8\u4F46\u6027\u80FD\u53EF\u9884\u6D4B\u3002",
      mechanism: "ondemand \u6BCF 10ms \u91C7\u6837 CPU \u5229\u7528\u7387\u51B3\u5B9A\u662F\u5426\u5347\u9891 \xB7 \u5347\u9891\u8981 CPU \u53D1 PMIC \u547D\u4EE4 \xB7 \u5178\u578B 50-200\u03BCs \u5EF6\u8FDF\u3002DB \u8BF7\u6C42\u547D\u4E2D\u4F4E\u9891\u7A97\u53E3\u65F6 \xB7 \u5F00\u59CB\u5904\u7406\u540E\u624D\u89E6\u53D1\u5347\u9891 \xB7 \u9996 request \u989D\u5916\u62C9\u957F 100\u03BCs+\u3002performance \u907F\u5F00\u8FD9\u4E2A\u6296\u52A8 \xB7 \u4EE3\u4EF7\u662F\u95F2\u65F6\u6301\u7EED\u9AD8\u9891\u3002",
      trade_offs: "performance \u6BD4 powersave \u6574\u673A\u529F\u8017\u9AD8 10-20W(2U \u9CB2\u9E4F 920 \u670D\u52A1\u5668\u5178\u578B)\xB7 \u6362\u6765 p99 \u7A33\u5B9A\u3002\u751F\u4EA7 DB \u7269\u7406\u673A\u51E0\u4E4E\u90FD\u8BE5 performance \xB7 \u529F\u8017\u654F\u611F\u7684\u8FB9\u7F18\u8282\u70B9\u53EF\u4FDD ondemand\u3002",
      when_to_deviate: "VM / \u5BB9\u5668\u573A\u666F governor \u5E38\u7531 hypervisor \u63A7\u5236 \xB7 cpufreq \u63A5\u53E3\u53EF\u80FD\u65E0\u6548 \xB7 \u6B64\u65F6\u9700 hypervisor \u5C42\u914D\u7F6E\u3002\u6D4B\u8BD5 / \u5F00\u53D1\u73AF\u5883\u529F\u8017\u4F18\u5148\u53EF\u4FDD powersave\u3002"
    }
  });
};
var check_numa = (ctx) => {
  const id = "kunpeng.numa.balancing";
  const title = "NUMA \u81EA\u52A8\u5E73\u8861";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;
  const numa_nodes = toInt(osVal(ctx, "numa_nodes", 1), 1);
  const numa_balancing = String(osVal(ctx, "numa_balancing", "0")).trim();
  if (numa_nodes <= 1 || numa_balancing === "0") {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `nodes=${numa_nodes} \xB7 balancing=${numa_balancing}`,
      reason: "\u5355 NUMA \u8282\u70B9\u6216\u5DF2\u5173\u95ED\u81EA\u52A8\u5E73\u8861"
    });
  }
  return finding({
    id,
    title,
    severity: "critical",
    bucket: 1,
    scope,
    summary: `NUMA balancing=${numa_balancing} \u4E14 ${numa_nodes} \u8282\u70B9`,
    description: "\u9CB2\u9E4F 920 \u53CC\u8DEF\u7269\u7406\u673A\u5178\u578B 4 NUMA \u8282\u70B9,\u5F00\u542F\u81EA\u52A8\u5E73\u8861\u4F1A\u5BFC\u81F4\u8DE8 die/socket \u5185\u5B58\u8FC1\u79FB,\u5F15\u5165\u8FDC\u7AEF\u8BBF\u5B58\u5EF6\u8FDF\u3002",
    reason: `numa_nodes=${numa_nodes} \xB7 numa_balancing=${numa_balancing} \xB7 \u591A\u8282\u70B9\u4E0B balancing \u4F1A\u5F15\u53D1\u4E25\u91CD\u8FDC\u7AEF\u5185\u5B58\u8BBF\u95EE\u5EF6\u8FDF`,
    threshold_display: "== 0",
    evidence: [
      { kind: "metric", value: `numa_nodes=${numa_nodes}` },
      { kind: "config", value: `numa_balancing=${numa_balancing}`, source_url: "/proc/sys/kernel/numa_balancing" }
    ],
    impact: { metric: "latency_p95_ms", value: 30, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.troubleshooting,
      { title: "Huawei Kunpeng NUMA 5-Step Tuning", url: "https://www.cnblogs.com/huaweicloud/p/12166354.html" },
      { title: "Chips and Cheese \xB7 Kunpeng 920 / TaiShan v110 architecture", url: "https://chipsandcheese.com/p/huaweis-kunpeng-920-and-taishan-v110" }
    ],
    recommendations: [
      {
        action: "echo 0 > /proc/sys/kernel/numa_balancing",
        rationale: "\u5173\u95ED\u81EA\u52A8\u5E73\u8861,\u914D\u5408 numactl --cpunodebind/--membind \u7ED1\u5B9A DB \u8FDB\u7A0B\u5230\u56FA\u5B9A\u8282\u70B9",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true
      }
    ],
    rationale: {
      summary: "\u9CB2\u9E4F 920 \u53CC\u8DEF\u7269\u7406\u673A\u6709 4 NUMA \u8282\u70B9(\u6BCF CPU 2 die \xD7 2 socket)\xB7 \u5F00\u542F numa_balancing \u5185\u6838\u4F1A\u5B9A\u671F\u8FC1\u79FB\u8FDB\u7A0B\u9875\u5230 access-local \u8282\u70B9 \xB7 \u4F46 DB \u5DE5\u4F5C\u96C6\u8DE8\u8282\u70B9\u5171\u4EAB \xB7 \u8FC1\u79FB\u53CD\u590D\u6765\u56DE \xB7 \u53CD\u800C\u8BA9 remote access \u6BD4\u4F8B\u66F4\u9AD8\u3002",
      mechanism: "numa_balancing=1 \u65F6\u5185\u6838 sched \u5468\u671F\u6027\u626B\u63CF\u6BCF\u4E2A\u8FDB\u7A0B\u7684 working set \xB7 \u53D1\u73B0\u8DE8\u8282\u70B9 access hotspot \u5C31\u8FC1\u79FB\u9875\u9762\u5230\u88AB\u9891\u7E41\u8BBF\u95EE\u7684 CPU \u6240\u5728 node\u3002DB \u8FDE\u63A5\u7EBF\u7A0B\u88AB scheduler \u8DE8\u6838\u8C03\u5EA6 \xB7 \u8FC1\u79FB\u8FFD\u4E0D\u4E0A\u8C03\u5EA6\u53D8\u5316 \xB7 \u4EA7\u751F ping-pong\u3002\u9CB2\u9E4F 920 \u8FDC\u7AEF\u8BBF\u5B58\u5EF6\u8FDF 2-3\xD7 \u672C\u5730 \xB7 \u591A\u8282\u70B9\u7CFB\u7EDF\u4E0A\u9020\u6210\u6574\u4F53\u5EF6\u8FDF\u65B9\u5DEE\u7FFB\u500D\u3002",
      trade_offs: "\u5173\u95ED numa_balancing \u8981\u6C42\u624B\u52A8\u7528 numactl \u6216 systemd CPUAffinity \u628A mongod/mysqld/redis \u7ED1\u5230\u56FA\u5B9A node \xB7 \u589E\u52A0\u90E8\u7F72\u590D\u6742\u5EA6\u3002\u6362\u6765\u5EF6\u8FDF\u7A33\u5B9A\u3002\u9CB2\u9E4F 920 \u573A\u666F\u4E0B\u5173\u95ED\u6536\u76CA\u660E\u663E\u5927\u4E8E\u5F00\u542F\u3002",
      when_to_deviate: "\u5355\u8DEF\u5355\u8282\u70B9 / VM \u5355 vnode \u4E0B numa_balancing \u4E0D\u505A\u8DE8\u8282\u70B9\u5DE5\u4F5C \xB7 \u7559\u7740\u65E0\u5BB3\u3002\u51B3\u7B56\u524D\u5148\u770B numactl -H \u786E\u8BA4\u8282\u70B9\u6570\u3002"
    }
  });
};
var check_smt = (ctx) => {
  const id = "kunpeng.smt.threads_per_core";
  const title = "SMT \xB7 CPU \u6BCF\u6838\u7EBF\u7A0B\u6570";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;
  const threadsPerCore = toInt(osVal(ctx, "smt_threads_per_core", 0), 0);
  if (threadsPerCore === 0) {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "\u672A\u91C7\u96C6\u5230 Thread(s) per core",
      reason: "lscpu \u672A\u8FD4\u56DE\u5B57\u6BB5"
    });
  }
  return infoResult({
    id,
    title,
    bucket: 1,
    scope,
    summary: `${threadsPerCore} thread(s)/core`,
    reason: threadsPerCore === 1 ? "\u9CB2\u9E4F 920 \u65E0 SMT(logical=physical),\u7EBF\u7A0B\u6C60\u6309\u7269\u7406\u6838\u6570\u914D\u7F6E\u5373\u53EF" : "\u591A\u7EBF\u7A0B/\u6838 \xB7 \u7EBF\u7A0B\u6C60\u6309\u7269\u7406\u6838\u6570\u914D,\u907F\u514D\u8BEF\u4E58 threads/core"
  });
};
var check_numa_topology = (ctx) => {
  const id = "kunpeng.numa.topology";
  const title = "NUMA \u8282\u70B9\u62D3\u6251";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;
  const nodes = toInt(osVal(ctx, "numa_nodes", 0), 0);
  if (nodes === 0) {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "\u672A\u91C7\u96C6\u5230 NUMA \u8282\u70B9\u6570",
      reason: "\u672A\u80FD\u8BFB\u53D6 /sys/devices/system/node"
    });
  }
  const label = nodes >= 4 ? "2P \u9CB2\u9E4F\u7269\u7406\u673A\u5178\u578B(4 \u8282\u70B9)" : nodes === 2 ? "\u5355\u8DEF\u9CB2\u9E4F\u6216\u865A\u62DF\u673A(2 \u8282\u70B9)" : "\u5355\u8282\u70B9(VM \u6216\u5355\u8DEF\u88C1\u526A\u578B\u53F7)";
  return infoResult({
    id,
    title,
    bucket: 1,
    scope,
    summary: `${nodes} \u8282\u70B9(${label})`,
    reason: "\u62D3\u6251\u4FE1\u606F \xB7 \u5F71\u54CD\u5206\u7247\u90E8\u7F72/\u7EBF\u7A0B\u7ED1\u6838\u67B6\u6784\u51B3\u7B56"
  });
};
var check_irqbalance = (ctx) => {
  const id = "kunpeng.irqbalance.active";
  const title = "irqbalance IRQ \u5747\u8861";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;
  const active = osVal(ctx, "irqbalance_active", "");
  if (!active || active === "unknown") {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "\u672A\u91C7\u96C6\u5230 irqbalance \u72B6\u6001",
      reason: "systemctl \u4E0D\u53EF\u7528\u6216\u672A\u5B89\u88C5 irqbalance"
    });
  }
  if (active === "active") {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "irqbalance active",
      reason: "IRQ \u81EA\u52A8\u5206\u6563\u5230\u5404 CPU \u6838"
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `irqbalance ${active}`,
    description: "irqbalance \u672A\u8FD0\u884C\u65F6 IRQ \u5BB9\u6613\u96C6\u4E2D\u5230 CPU0,\u9AD8\u5E76\u53D1 DB \u573A\u666F\u6253\u6EE1\u5355\u6838\u3002",
    reason: `irqbalance=${active} \xB7 \u672A\u7ED1\u5B9A IRQ \u4EB2\u548C\u6027\u65F6 IRQ \u96C6\u4E2D CPU0,\u9AD8\u5E76\u53D1\u6253\u6EE1\u5355\u6838`,
    threshold_display: "active",
    evidence: [
      { kind: "config", value: `irqbalance=${active}` }
    ],
    impact: { metric: "latency_p95_ms", value: 10, unit: "percent", confidence: "medium" },
    citations: [
      { title: "Red Hat Performance Tuning \xB7 IRQ balancing", url: "https://access.redhat.com/sites/default/files/attachments/rhel7_numa_perf_brief.pdf" }
    ],
    recommendations: [
      {
        action: "systemctl enable --now irqbalance",
        rationale: "\u542F\u52A8 irqbalance \u8BA9\u5185\u6838\u81EA\u9002\u5E94\u5206\u6563\u4E2D\u65AD;\u6216\u624B\u52A8 /proc/irq/$irq/smp_affinity_list \u7ED1\u5B9A",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true
      }
    ],
    rationale: {
      summary: "irqbalance \u662F userspace daemon \xB7 \u628A\u7F51\u5361 / \u5B58\u50A8 / \u5176\u5B83 PCI \u8BBE\u5907\u7684\u786C\u4E2D\u65AD\u5747\u5300\u5206\u6563\u5230\u5404 CPU\u3002\u672A\u542F\u52A8\u65F6 IRQ \u9ED8\u8BA4\u96C6\u4E2D\u5728 CPU0 \xB7 \u9AD8\u5E76\u53D1 DB \u573A\u666F\u4E0B CPU0 \u88AB\u4E2D\u65AD\u6253\u6EE1 \xB7 DB \u8FDE\u63A5\u7EBF\u7A0B\u4E5F\u62A2 CPU0 \xB7 \u6574\u673A\u53D8\u74F6\u9888\u3002",
      mechanism: "Linux \u542F\u52A8\u65F6\u9ED8\u8BA4\u628A\u6240\u6709 IRQ \u7684 smp_affinity \u8BBE\u6210 CPU0 \xB7 \u9664\u975E irqbalance \u542F\u52A8\u540E\u52A8\u6001\u8C03\u6574\u3002\u9CB2\u9E4F 920 \u5355\u673A\u5E38\u89C1 64/128 \u6838 \xB7 \u4E0D\u5206\u6563 IRQ \u5C31\u662F 1/64 \u7684 CPU \u5728\u670D\u52A1\u7F51\u7EDC \xB7 softirq \u6392\u961F \xB7 \u7F51\u7EDC\u6536\u5305\u5EF6\u8FDF\u653E\u5927\u3002DB \u5BA2\u6237\u7AEF\u611F\u77E5\u5230\u7684\u662F p95/p99 \u6296\u52A8\u3002",
      trade_offs: "\u542F irqbalance \u5BF9 CPU \u5F00\u9500\u6781\u5C0F(< 1%)\xB7 \u517C\u5BB9\u6027\u597D\u3002\u5BF9\u8D85\u4F4E\u5EF6\u8FDF\u573A\u666F(HFT / in-memory KV)\u53EF\u9009\u62E9\u5173 irqbalance \u5E76\u624B\u52A8\u7ED1\u5B9A\u7279\u5B9A IRQ \u5230\u4E13\u95E8\u7684\u6838 \xB7 \u4F46\u9700\u8981\u7CBE\u7EC6\u8C03\u4F18\u3002\u901A\u7528 DB \u90E8\u7F72\u542F irqbalance \u5373\u53EF\u3002",
      when_to_deviate: "\u5DF2\u624B\u52A8\u7ED1\u5B9A IRQ smp_affinity \u7684\u4E13\u4E1A\u8C03\u4F18\u573A\u666F \xB7 \u4FDD\u6301\u624B\u52A8\u7ED1\u5B9A\u5373\u53EF\u4E0D\u542F irqbalance\u3002\u5355\u6838 / VM \u573A\u666F irqbalance \u610F\u4E49\u4E0D\u5927\u4F46\u65E0\u5BB3\u3002"
    }
  });
};
var check_numa_distance_matrix = (ctx) => {
  const id = "kunpeng.numa.distance_matrix";
  const title = "NUMA \u8DDD\u79BB\u77E9\u9635";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;
  const raw = osVal(ctx, "numa_dist_raw", "");
  const max = toInt(osVal(ctx, "numa_dist_max", 0), 0);
  const min = toInt(osVal(ctx, "numa_dist_min", 0), 0);
  if (!raw || max === 0) {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "\u672A\u91C7\u96C6 NUMA \u8DDD\u79BB\u77E9\u9635",
      reason: "numactl -H \u4E0D\u53EF\u7528\u6216\u4E0D\u542B distances \u6BB5"
    });
  }
  if (max === min) {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `\u8DDD\u79BB\u5747\u5300 \xB7 \u6240\u6709\u8282\u70B9\u8DDD\u79BB = ${max}`,
      reason: "\u5355\u8DEF\u9CB2\u9E4F\u6216\u865A\u62DF\u673A \xB7 \u65E0\u8DE8 die/socket \u6210\u672C\u5DEE\u5F02,\u65E0\u9700\u5206\u7247\u7ED1\u6838\u4F18\u5316"
    });
  }
  return okResult({
    id,
    title,
    bucket: 1,
    scope,
    summary: `\u8DDD\u79BB\u975E\u5BF9\u79F0 min=${min} max=${max}`,
    description: "\u68C0\u6D4B\u5230\u8DE8 die/socket \u8DDD\u79BB\u5DEE \xB7 \u5EFA\u8BAE\u7528 numactl --cpunodebind/--membind \u628A DB \u8FDB\u7A0B\u7ED1\u5230\u5355\u8282\u70B9,\u907F\u514D\u8FDC\u7AEF\u8BBF\u5B58",
    reason: "\u591A NUMA \u8282\u70B9\u5E03\u5C40\u9700\u8981\u7ED1\u6838\u90E8\u7F72"
  });
};
var check_kunpeng_somaxconn_strict = (ctx) => {
  const id = "kunpeng.net.somaxconn_strict";
  const title = "somaxconn";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;
  const val = toInt(osVal(ctx, "net_somaxconn", 0), 0);
  if (val === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u672A\u91C7\u96C6 somaxconn", reason: "sysctl \u4E0D\u53EF\u8BFB" });
  }
  if (val >= 65535) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `somaxconn=${val}`,
      reason: "\u5DF2\u8FBE\u9CB2\u9E4F BoostKit Mongo \u63A8\u8350 \u2265 65535",
      threshold_display: "\u2265 65535",
      citations: [{ title: "\u9CB2\u9E4F BoostKit \xB7 MongoDB \u8C03\u4F18 \xB7 somaxconn", url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html" }]
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `somaxconn=${val} < 65535`,
    description: "\u9CB2\u9E4F BoostKit MongoDB \u8C03\u4F18\u6307\u5357\u8981\u6C42 net.core.somaxconn \u2265 65535,\u901A\u7528 Linux 1024 \u7684\u9608\u503C\u5728\u9CB2\u9E4F\u9AD8\u5E76\u53D1 DB \u4E0B\u504F\u5C0F",
    reason: `net.core.somaxconn=${val} \xB7 \u9CB2\u9E4F\u5B98\u65B9\u5EFA\u8BAE \u2265 65535`,
    threshold_display: "\u2265 65535",
    evidence: [{ kind: "config", value: `net.core.somaxconn=${val}` }],
    impact: { metric: "connection_util_pct", value: 10, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo
    ],
    recommendations: [
      {
        action: "sysctl -w net.core.somaxconn=65535",
        rationale: "\u5BF9\u9F50\u9CB2\u9E4F BoostKit DB \u8C03\u4F18\u5EFA\u8BAE \xB7 \u907F\u5F00\u9AD8\u5E76\u53D1 SYN \u4E22\u5305",
        type: "mitigate",
        fix_cost: "trivial",
        verifiable: true
      }
    ]
  });
};
var check_kunpeng_tcp_keepalive_strict = (ctx) => {
  const id = "kunpeng.net.tcp_keepalive_time_strict";
  const title = "TCP keepalive";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;
  const kt = toInt(osVal(ctx, "tcp_keepalive_time", 0), 0);
  if (kt === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u672A\u91C7\u96C6", reason: "sysctl \u4E0D\u53EF\u8BFB" });
  }
  if (kt === 120) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `tcp_keepalive_time=120s`,
      reason: "\u5DF2\u5BF9\u9F50\u9CB2\u9E4F BoostKit MongoDB \u8C03\u4F18\u63A8\u8350\u503C",
      threshold_display: "== 120s",
      citations: [{ title: "\u9CB2\u9E4F BoostKit \xB7 MongoDB \u8C03\u4F18 \xB7 tcp_keepalive_time", url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html" }]
    });
  }
  const severity = kt > 300 ? "warning" : "info";
  if (severity === "info") {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `tcp_keepalive_time=${kt}s`,
      reason: "\u5DF2\u4F4E\u4E8E Linux \u9ED8\u8BA4 7200s \xB7 \u4F46\u9CB2\u9E4F BoostKit \u660E\u786E\u63A8\u8350 120s(\u5B98\u65B9\u9608\u503C)",
      threshold_display: "== 120s",
      citations: [{ title: "\u9CB2\u9E4F BoostKit \xB7 MongoDB \u8C03\u4F18", url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html" }]
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `tcp_keepalive_time=${kt}s \u504F\u79BB\u63A8\u8350\u503C 120s`,
    description: "\u9CB2\u9E4F BoostKit MongoDB \u8C03\u4F18\u6307\u5357\u660E\u786E net.ipv4.tcp_keepalive_time=120,\u9AD8\u4E8E 300s \u4F1A\u8BA9\u65AD\u8FDE\u611F\u77E5\u5EF6\u8FDF\u8FC7\u5927",
    reason: `tcp_keepalive_time=${kt}s \xB7 \u9CB2\u9E4F\u5B98\u65B9\u63A8\u8350 120s`,
    threshold_display: "== 120s",
    evidence: [{ kind: "config", value: `net.ipv4.tcp_keepalive_time=${kt}` }],
    impact: { metric: "connection_util_pct", value: 8, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Production Notes \xB7 TCP keepalive", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }
    ],
    recommendations: [
      {
        action: "sysctl -w net.ipv4.tcp_keepalive_time=120",
        rationale: "\u5BF9\u9F50\u9CB2\u9E4F BoostKit + MongoDB Production Notes \u53CC\u6587\u6863\u63A8\u8350",
        type: "mitigate",
        fix_cost: "trivial",
        verifiable: true
      }
    ]
  });
};
var check_kunpeng_swappiness_strict = (ctx) => {
  const id = "kunpeng.vm.swappiness_strict";
  const title = "swappiness";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;
  const val = toInt(osVal(ctx, "swappiness", -1), -1);
  if (!Number.isInteger(val) || val < 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u672A\u91C7\u96C6 swappiness", reason: "sysctl \u4E0D\u53EF\u8BFB" });
  }
  if (val <= 1) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `swappiness=${val}`,
      reason: "\u5DF2\u5BF9\u9F50\u9CB2\u9E4F BoostKit \u63A8\u8350",
      threshold_display: "== 1",
      citations: [{ title: "\u9CB2\u9E4F BoostKit \xB7 MongoDB \u8C03\u4F18 \xB7 vm.swappiness", url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html" }]
    });
  }
  const severity = val > 10 ? "warning" : "info";
  if (severity === "info") {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `swappiness=${val}`,
      reason: "\u4F4E\u4E8E 10 \xB7 \u901A\u7528\u53EF\u63A5\u53D7;\u4F46\u9CB2\u9E4F BoostKit \u660E\u786E == 1(\u66F4\u4E25)",
      threshold_display: "== 1",
      citations: [{ title: "\u9CB2\u9E4F BoostKit \xB7 MongoDB \u8C03\u4F18", url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html" }]
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `swappiness=${val} \u4E0D\u7B26\u9CB2\u9E4F\u4E25\u683C\u9608\u503C`,
    description: '\u9CB2\u9E4F BoostKit \u8C03\u4F18\u6307\u5357\u539F\u6587:\u5C06 vm.swappiness \u8BBE\u7F6E\u4E3A\u8F83\u4F4E\u503C "1" \u4EE5\u51CF\u5C11\u4EA4\u6362\u5206\u533A\u4F7F\u7528',
    reason: `vm.swappiness=${val} \xB7 \u9CB2\u9E4F\u5B98\u65B9\u63A8\u8350 1`,
    threshold_display: "== 1",
    evidence: [{ kind: "config", value: `vm.swappiness=${val}` }],
    impact: { metric: "latency_p95_ms", value: 15, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo
    ],
    recommendations: [
      {
        action: "sysctl -w vm.swappiness=1",
        rationale: "\u5BF9\u9F50\u9CB2\u9E4F BoostKit MongoDB \u8C03\u4F18\u6307\u5357",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true
      }
    ]
  });
};
var check_kunpeng_tcp_max_syn_backlog_mongo = (ctx) => {
  const id = "kunpeng.net.tcp_max_syn_backlog_mongo";
  const title = "tcp_max_syn_backlog \xB7 \u9CB2\u9E4F Mongo";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;
  if (scope.engine !== "mongo") {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u4EC5\u5BF9 MongoDB", reason: `db_type=${scope.engine}` });
  }
  const val = toInt(osVal(ctx, "tcp_max_syn_backlog", 0), 0);
  if (val === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u672A\u91C7\u96C6", reason: "sysctl \u4E0D\u53EF\u8BFB" });
  }
  if (val >= 8192) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `tcp_max_syn_backlog=${val}`,
      reason: "\u5DF2\u8FBE\u9CB2\u9E4F BoostKit Mongo \u63A8\u8350 \u2265 8192",
      threshold_display: "\u2265 8192",
      citations: [{ title: "\u9CB2\u9E4F BoostKit \xB7 MongoDB \u8C03\u4F18 \xB7 tcp_max_syn_backlog", url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html" }]
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `tcp_max_syn_backlog=${val} < 8192`,
    description: "\u9CB2\u9E4F BoostKit MongoDB \u8C03\u4F18\u6307\u5357\u8981\u6C42 tcp_max_syn_backlog \u2265 8192 \u4EE5\u627F\u63A5\u9AD8\u5E76\u53D1 SYN \u8BF7\u6C42",
    reason: `net.ipv4.tcp_max_syn_backlog=${val} \xB7 \u9CB2\u9E4F\u5B98\u65B9\u5EFA\u8BAE \u2265 8192`,
    threshold_display: "\u2265 8192",
    evidence: [{ kind: "config", value: `net.ipv4.tcp_max_syn_backlog=${val}` }],
    impact: { metric: "connection_util_pct", value: 10, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo
    ],
    recommendations: [
      {
        action: "sysctl -w net.ipv4.tcp_max_syn_backlog=8192",
        rationale: "\u6269\u5BB9 SYN \u961F\u5217 \xB7 \u5BF9\u9F50\u9CB2\u9E4F BoostKit \u63A8\u8350",
        type: "mitigate",
        fix_cost: "trivial",
        verifiable: true
      }
    ]
  });
};
var check_kunpeng_numa_interleave = (ctx) => {
  const id = "kunpeng.numa.interleave_recommendation";
  const title = "NUMA interleave \u542F\u52A8\u5EFA\u8BAE";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;
  const nodes = toInt(osVal(ctx, "numa_nodes", 0), 0);
  if (nodes <= 1) {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `numa_nodes=${nodes} \xB7 \u5355\u8282\u70B9\u65E0\u9700 interleave`,
      reason: "\u5355 NUMA \u8282\u70B9 / \u865A\u62DF\u673A\u4E0B\u4E0D\u9002\u7528"
    });
  }
  return infoResult({
    id,
    title,
    bucket: 1,
    scope,
    summary: `${nodes} NUMA \u8282\u70B9 \xB7 \u5EFA\u8BAE numactl \u542F\u52A8`,
    reason: scope.engine === "mongo" ? "MongoDB Production Notes + \u9CB2\u9E4F BoostKit \u5EFA\u8BAE:\u5355\u5B9E\u4F8B\u7528 'numactl --interleave=all mongod',\u591A\u5206\u7247\u573A\u666F\u6309 NUMA \u8282\u70B9\u5404\u7ED1 1 \u4E2A mongod" : "\u591A\u8282\u70B9\u4E0B\u5EFA\u8BAE\u7528 numactl \u9650\u5B9A CPU/\u5185\u5B58\u4EB2\u548C\u6027,\u907F\u514D\u8FDC\u7AEF\u8BBF\u5B58",
    threshold_display: "numactl --interleave=all \u6216 --cpunodebind/--membind",
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Production Notes \xB7 NUMA", url: "https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-production-numa" }
    ]
  });
};
var kunpengChecks = [
  check_cpu_governor,
  check_numa,
  check_smt,
  check_numa_topology,
  check_irqbalance,
  check_numa_distance_matrix,
  check_kunpeng_somaxconn_strict,
  check_kunpeng_tcp_keepalive_strict,
  check_kunpeng_swappiness_strict,
  check_kunpeng_tcp_max_syn_backlog_mongo,
  check_kunpeng_numa_interleave
];
function requireOpenEuler(ctx, id, title, bucket) {
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  if (scope.os !== "openeuler") {
    return {
      skip: infoResult({
        id,
        title,
        bucket,
        scope,
        summary: "\u89C4\u5219\u4EC5\u9002\u7528 openEuler,\u5DF2\u8DF3\u8FC7",
        reason: `\u68C0\u6D4B\u5230 os=${scope.os ?? "unknown"}`,
        skip_reason: "os_mismatch"
      }),
      scope
    };
  }
  return { skip: null, scope };
}
var check_openeuler_sched_steal_cmdline = (ctx) => {
  const id = "openeuler.sched.steal_node_limit";
  const title = "sched_steal_node_limit";
  const { skip, scope } = requireOpenEuler(ctx, id, title, 1);
  if (skip) return skip;
  const cmdline = osVal(ctx, "sched_steal_node_limit", null);
  if (!cmdline) {
    return finding({
      id,
      title,
      severity: "warning",
      bucket: 1,
      scope,
      summary: "cmdline \u672A\u8BBE\u7F6E sched_steal_node_limit",
      description: "openEuler \u5B98\u65B9 MySQL \u8C03\u4F18\u6307\u5357\u660E\u786E\u5728 Kunpeng \u4E0A\u8981\u6C42 sched_steal_node_limit=4,\u9ED8\u8BA4\u503C\u4E0B\u8DE8 NUMA \u4EFB\u52A1\u8FC1\u79FB\u53D7\u9650",
      reason: "/proc/cmdline grep sched_steal_node_limit \u65E0\u8FD4\u56DE",
      threshold_display: "\u2265 4",
      evidence: [{ kind: "config", value: "sched_steal_node_limit=not-set" }],
      impact: { metric: "throughput_qps", value: 10, unit: "percent", confidence: "medium" },
      citations: [
        { title: "openEuler MySQL Performance Tuning", url: "https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html" }
      ],
      recommendations: [
        {
          action: "grubby --update-kernel=ALL --args='sched_steal_node_limit=4' && reboot",
          rationale: "openEuler \u63A8\u8350\u5728\u9CB2\u9E4F\u53CC\u8DEF 4 NUMA \u8282\u70B9\u4E0A\u542F\u7528\u8DE8\u8282\u70B9\u4EFB\u52A1\u7A83\u53D6",
          type: "repair",
          fix_cost: "restart_engine",
          verifiable: false
        }
      ]
    });
  }
  const m = /=(\d+)/.exec(cmdline);
  const val = m ? parseInt(m[1], 10) : 0;
  if (val >= 4) {
    return okResult({ id, title, bucket: 1, scope, summary: cmdline, reason: "\u8DE8\u8282\u70B9\u4EFB\u52A1\u7A83\u53D6\u5DF2\u5408\u7406\u914D\u7F6E" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `${cmdline} \u503C\u504F\u4F4E`,
    description: "openEuler \u63A8\u8350 sched_steal_node_limit=4 \u5339\u914D\u53CC\u8DEF\u9CB2\u9E4F 4 NUMA \u8282\u70B9\u5E03\u5C40",
    reason: `\u5F53\u524D\u503C ${val} < 4`,
    threshold_display: "\u2265 4",
    evidence: [{ kind: "config", value: cmdline }],
    impact: { metric: "throughput_qps", value: 8, unit: "percent", confidence: "medium" },
    citations: [
      { title: "openEuler MySQL Performance Tuning", url: "https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html" }
    ],
    recommendations: [
      {
        action: "grubby --update-kernel=ALL --args='sched_steal_node_limit=4' && reboot",
        rationale: "\u5339\u914D\u9CB2\u9E4F 4 NUMA \u8282\u70B9\u5E03\u5C40",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: false
      }
    ]
  });
};
var check_openeuler_sched_feature_steal = (ctx) => {
  const id = "openeuler.sched.feature_steal";
  const title = "sched_features STEAL";
  const { skip, scope } = requireOpenEuler(ctx, id, title, 1);
  if (skip) return skip;
  const on = osVal(ctx, "sched_feature_steal_on", false);
  const raw = osVal(ctx, "sched_features_raw", "");
  if (!raw) {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u672A\u91C7\u96C6 sched_features", reason: "/sys/kernel/debug/sched_features \u4E0D\u53EF\u8BFB(\u9700 root)" });
  }
  if (on) {
    return okResult({ id, title, bucket: 1, scope, summary: "STEAL \u5DF2\u542F\u7528", reason: "openEuler \u5185\u6838\u4EFB\u52A1\u7A83\u53D6\u7279\u6027\u751F\u6548" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: "STEAL \u7279\u6027\u672A\u542F\u7528",
    description: "openEuler \u5185\u6838\u652F\u6301 STEAL \u8C03\u5EA6\u5668\u7279\u6027 \xB7 \u9AD8\u5E76\u53D1 DB \u573A\u666F\u5E94\u5F00\u542F",
    reason: `sched_features \u91CC\u542B NO_STEAL \u6216\u672A\u5217 STEAL: ${raw.slice(0, 80)}`,
    threshold_display: "STEAL",
    evidence: [{ kind: "config", value: `sched_features=${raw.slice(0, 120)}` }],
    impact: { metric: "throughput_qps", value: 6, unit: "percent", confidence: "medium" },
    citations: [
      { title: "openEuler MySQL Performance Tuning \xB7 STEAL feature", url: "https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html" }
    ],
    recommendations: [
      {
        action: "echo STEAL > /sys/kernel/debug/sched_features",
        rationale: "\u8FD0\u884C\u65F6\u542F\u7528 STEAL \xB7 \u6301\u4E45\u5316\u9700\u5199 systemd unit",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true
      }
    ]
  });
};
var check_openeuler_nohz_cmdline = (ctx) => {
  const id = "openeuler.cmdline.nohz";
  const title = "kernel cmdline nohz";
  const { skip, scope } = requireOpenEuler(ctx, id, title, 1);
  if (skip) return skip;
  const nohz = osVal(ctx, "nohz_cmdline", null);
  if (!nohz) {
    return okResult({ id, title, bucket: 1, scope, summary: "cmdline \u65E0 nohz=off", reason: "\u9ED8\u8BA4 tickless(nohz=on),\u6B63\u786E\u8BBE\u7F6E" });
  }
  if (nohz === "nohz=off") {
    return finding({
      id,
      title,
      severity: "warning",
      bucket: 1,
      scope,
      summary: "cmdline \u542B nohz=off",
      description: "nohz=off \u5F3A\u5236\u56FA\u5B9A\u9891\u7387 tick,\u589E\u52A0 idle \u65F6 CPU \u4E2D\u65AD\u5F00\u9500,\u751F\u4EA7 DB \u573A\u666F\u5E94\u542F\u7528 tickless",
      reason: "/proc/cmdline \u542B nohz=off",
      threshold_display: "absent / nohz=on",
      evidence: [{ kind: "config", value: `cmdline=${nohz}` }],
      impact: { metric: "latency_p95_ms", value: 5, unit: "percent", confidence: "medium" },
      citations: [
        { title: "Huawei Kunpeng CPU/Mem Tuning \xB7 nohz", url: "https://www.cnblogs.com/huaweicloud/p/11861191.html" }
      ],
      recommendations: [
        {
          action: "grubby --update-kernel=ALL --remove-args='nohz=off' && reboot",
          rationale: "\u6062\u590D tickless \u8282\u7701 idle CPU \u4E2D\u65AD",
          type: "repair",
          fix_cost: "restart_engine",
          verifiable: false
        }
      ]
    });
  }
  return okResult({ id, title, bucket: 1, scope, summary: `cmdline nohz=${nohz}`, reason: "\u975E off \u6A21\u5F0F,\u5408\u7406" });
};
var openeulerChecks = [
  check_openeuler_sched_steal_cmdline,
  check_openeuler_sched_feature_steal,
  check_openeuler_nohz_cmdline
];
function mongoMajor(version) {
  if (!version) return 0;
  const m = /^(\d+)\./.exec(version);
  return m ? parseInt(m[1], 10) : 0;
}
var check_thp = (ctx) => {
  const id = "os.thp.kernel_mode";
  const title = "THP \u900F\u660E\u5927\u9875";
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  const raw = osVal(ctx, "thp_status", "");
  const m = /\[(\w+)\]/.exec(raw);
  const mode = m ? m[1] : raw;
  if (!mode) {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "\u672A\u91C7\u96C6\u5230 THP \u72B6\u6001",
      reason: "\u65E0\u6CD5\u8BFB\u53D6 /sys/kernel/mm/transparent_hugepage/enabled"
    });
  }
  let expected = "never";
  let rationaleWhyBad = "";
  const major = mongoMajor(scope.engine_version);
  if (major >= 8) {
    expected = "always";
    rationaleWhyBad = `MongoDB ${scope.engine_version ?? "8.0+"} \u9ED8\u8BA4\u8981\u6C42 THP=always`;
  } else {
    expected = "never";
    rationaleWhyBad = "khugepaged \u5185\u5B58\u788E\u7247\u6574\u7406\u4F1A\u4EA7\u751F\u786C\u4E2D\u65AD,CPU sys% \u98D9\u5347";
  }
  const okModes = expected === "never" ? ["never", "madvise"] : ["always", "madvise"];
  if (okModes.includes(mode)) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `THP=${mode}`,
      reason: `\u7B26\u5408 mongo${scope.engine_version ? ` ${scope.engine_version}` : ""} \u7684\u5EFA\u8BAE\u503C`
    });
  }
  return finding({
    id,
    title,
    severity: expected === "always" ? "warning" : "critical",
    bucket: 1,
    scope,
    summary: `THP=${mode} \u4E0D\u7B26\u5408 mongo${scope.engine_version ? ` ${scope.engine_version}` : ""} \u671F\u671B`,
    description: `mongo \u671F\u671B THP=${expected}\u3002` + (rationaleWhyBad ? ` ${rationaleWhyBad}\u3002` : ""),
    reason: `\u5F53\u524D THP=${mode} \xB7 \u671F\u671B ${expected} \xB7 ${rationaleWhyBad}`,
    evidence: [
      { kind: "config", value: `/sys/kernel/mm/transparent_hugepage/enabled=${raw}` }
    ],
    threshold_display: okModes.join(" / "),
    impact: { metric: "latency_p95_ms", value: 25, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Production Notes \xB7 Disable THP", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" },
      ...major >= 8 ? [{ title: "MongoDB 8.0 THP Enable Note", url: "https://www.mongodb.com/docs/v8.0/tutorial/transparent-huge-pages/" }] : [{ title: "MongoDB 7.0 Disable THP", url: "https://www.mongodb.com/docs/v7.0/tutorial/transparent-huge-pages/" }]
    ],
    recommendations: [
      {
        action: `echo ${expected} > /sys/kernel/mm/transparent_hugepage/enabled`,
        rationale: `\u5C06 THP \u8C03\u6574\u5230 mongo${scope.engine_version ? ` ${scope.engine_version}` : ""} \u63A8\u8350\u6A21\u5F0F`,
        type: "repair",
        fix_cost: "trivial",
        verifiable: true
      }
    ],
    rationale: major >= 8 ? {
      summary: "MongoDB 8.0+ \u66F4\u6362\u4E86 WiredTiger \u5185\u5B58\u5206\u914D\u5668 \xB7 \u4ECE 2M \u5927\u9875\u83B7\u76CA\u66F4\u660E\u663E \xB7 \u5B98\u65B9\u53CD\u5411\u8C03\u4F18\u5EFA\u8BAE THP=always \xB7 \u8FD9\u662F MongoDB 7\u21928 \u7684\u91CD\u8981\u884C\u4E3A\u53D8\u5316\u3002",
      mechanism: "8.0 \u4E4B\u524D WT \u9891\u7E41 munmap \u5C0F\u5757\u5185\u5B58 \xB7 2M \u5927\u9875\u4EA7\u751F\u5185\u90E8\u788E\u7247 \xB7 khugepaged \u626B\u63CF\u5408\u5E76\u662F\u4E3B\u8981\u5EF6\u8FDF\u6E90\u30028.0 \u540E WT \u6539\u4E3A arena-style \u5206\u914D \xB7 \u5927\u5757\u9A7B\u7559 \xB7 2M \u5927\u9875\u53CD\u800C\u51CF\u5C11 TLB miss 10-20% \xB7 khugepaged \u626B\u63CF\u4EE3\u4EF7\u644A\u8584\u3002",
      trade_offs: "\u82E5\u4ECD\u4ECE < 7 \u7684 Mongo \u5347\u7EA7\u4E14\u4FDD\u7559 THP=never \xB7 \u4F1A\u635F\u5931 8.0 \u7684\u5185\u5B58\u4F18\u5316\u6536\u76CA(\u5B9E\u6D4B p95 \u5EF6\u8FDF\u9AD8 10-15%)\u3002\u53CD\u4E4B\u5728 7.0 \u4E0A\u8BEF\u5F00 THP=always \u4F1A\u660E\u663E CPU sys% \u98D9\u3002",
      when_to_deviate: "\u77ED\u671F\u6DF7\u5408\u7248\u672C\u7684 replica set(\u540C\u4E00\u96C6\u7FA4\u4E0D\u540C\u8282\u70B9\u7248\u672C)\u53EF\u5148\u7528 madvise \u4F5C\u8FC7\u6E21 \xB7 \u5347\u7EA7\u6536\u5C3E\u540E always\u3002"
    } : {
      summary: "MongoDB \u2264 7.0 \u5F3A\u5236\u8981\u6C42 THP=never\u3002khugepaged \u540E\u53F0\u5408\u5E76 2M \u5927\u9875\u4F1A\u4EA7\u751F\u6BEB\u79D2\u7EA7 stop-the-world \u505C\u987F \xB7 \u4E0E WT fsync \u8DEF\u5F84\u4E0A\u7684 page fault \u76F8\u4E92\u653E\u5927\u5EF6\u8FDF\u3002",
      mechanism: "khugepaged \u5468\u671F\u6027\u626B\u63CF 4K \u9875\u8BD5\u56FE\u5408\u5E76\u6210 2M \u5927\u9875 \xB7 \u626B\u63CF\u65F6\u9700\u8981\u77ED\u6682\u6301\u6709 mm->page_table_lock \xB7 mongod \u7684 WT page fault \u5FC5\u987B\u7B49\u5F85\u3002CPU sys% \u6301\u7EED 15-30% \xB7 p99 \u5EF6\u8FDF\u4ECE\u6BEB\u79D2\u8DF3\u5230\u767E\u6BEB\u79D2\u7EA7\u3002",
      trade_offs: "\u5173 THP \u4E0D\u5F71\u54CD MongoDB \u81EA\u8EAB\u5185\u5B58\u4F7F\u7528(WT cache \u4E0D\u4F9D\u8D56\u5927\u9875)\u3002\u7CFB\u7EDF\u4E0A\u6709\u5176\u4ED6 big-memory workload(\u5982 JVM)\u65F6 \xB7 \u5173 THP \u53EF\u80FD\u8BA9\u90A3\u4E9B workload TLB miss \u7565\u5347 \xB7 \u4F46\u5BF9 Mongo \u662F\u7EAF\u6536\u76CA\u3002",
      when_to_deviate: "madvise \u6A21\u5F0F\u5728 7.0 \u4E5F\u88AB\u5B98\u65B9\u63A5\u53D7(\u53EA\u5BF9\u663E\u5F0F madvise \u7684\u8FDB\u7A0B\u7528\u5927\u9875 \xB7 mongod \u4E0D madvise)\xB7 \u5B9E\u7528\u7B49\u4EF7 never\u3002"
    }
  });
};
var check_hugepage = (ctx) => {
  const id = "os.hugepages.static_reserved";
  const title = "\u9759\u6001 HugePages";
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  const nr = toInt(osVal(ctx, "nr_hugepages", 0), 0);
  if (nr === 0) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "nr_hugepages=0",
      reason: "WT/Redis/InnoDB \u81EA\u7BA1 cache \u4E0D\u8D70 hugetlb,\u4FDD\u6301 0 \u5373\u53EF"
    });
  }
  return infoResult({
    id,
    title,
    bucket: 1,
    scope,
    summary: `nr_hugepages=${nr}`,
    reason: "\u5DF2\u9884\u7559\u9759\u6001\u5927\u9875(\u53EF\u80FD\u4F9B\u540C\u673A\u5176\u5B83\u670D\u52A1\u4F7F\u7528,DB \u672C\u8EAB\u65E0\u76F4\u63A5\u5F71\u54CD)"
  });
};
var check_io_scheduler = (ctx) => {
  const id = "os.iosched.device_scheduler";
  const title = "IO \u8C03\u5EA6\u5668";
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  const raw = osVal(ctx, "io_scheduler", "");
  const m = /\[(\w[\w-]*)\]/.exec(raw);
  const sched = m ? m[1] : raw;
  if (!raw.toLowerCase().includes("[cfq]")) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `scheduler=${sched}`,
      reason: "\u8C03\u5EA6\u5668\u914D\u7F6E\u5408\u7406(\u975E CFQ)",
      threshold_display: "mq-deadline / none / kyber",
      // Linux kernel doc 是 I/O scheduler 行为的权威定义 · Kunpeng 只转述
      citations: [{ title: "Red Hat Performance Tuning \xB7 I/O scheduler", url: "https://access.redhat.com/sites/default/files/attachments/rhel7_numa_perf_brief.pdf" }]
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `scheduler=[cfq] \u4E0D\u9002\u5408 DB`,
    description: "CFQ \u8C03\u5EA6\u5668\u4F1A\u5F15\u5165\u961F\u5217\u5EF6\u8FDF,DB \u968F\u673A IO \u9700\u8981\u4F4E\u5EF6\u8FDF(none/mq-deadline)",
    reason: "CFQ \u5BF9 SSD \u5F15\u5165\u4E0D\u5FC5\u8981\u961F\u5217\u5EF6\u8FDF",
    threshold_display: "mq-deadline / none / kyber",
    evidence: [{ kind: "config", value: `io_scheduler=${raw}` }],
    impact: { metric: "latency_p95_ms", value: 10, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "Red Hat Performance Tuning \xB7 I/O scheduler", url: "https://access.redhat.com/sites/default/files/attachments/rhel7_numa_perf_brief.pdf" }
    ],
    recommendations: [
      {
        action: "echo none > /sys/block/sda/queue/scheduler",
        rationale: "SSD \u7528 none \xB7 HDD \u7528 mq-deadline",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true
      }
    ]
  });
};
var check_swappiness = (ctx) => {
  const id = "os.vm.swappiness";
  const title = "Swap \u503E\u5411";
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  const raw = osVal(ctx, "swappiness", -1);
  const val = typeof raw === "number" ? raw : toInt(raw, -1);
  if (!Number.isInteger(val) || val < 0) {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "\u672A\u91C7\u96C6\u5230 vm.swappiness",
      reason: "sysctl \u8BFB\u53D6\u5931\u8D25"
    });
  }
  if (val <= 10) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `swappiness=${val}`,
      reason: "Swap \u503E\u5411\u4F4E,\u7B26\u5408 DB \u751F\u4EA7\u73AF\u5883"
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `swappiness=${val} \u504F\u9AD8`,
    description: "\u9AD8 swappiness \u4F1A\u8BA9 DB \u7F13\u5B58\u88AB\u6362\u51FA\u5230\u78C1\u76D8,\u5F15\u53D1\u6027\u80FD\u6296\u52A8",
    reason: `vm.swappiness=${val} > 10`,
    threshold_display: "\u2264 1",
    evidence: [{ kind: "config", value: `vm.swappiness=${val}`, source_url: "/proc/sys/vm/swappiness" }],
    impact: { metric: "latency_p95_ms", value: 20, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Production Notes \xB7 swappiness", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" },
      { title: "Redis Latency \xB7 swap", url: "https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/" }
    ],
    recommendations: [
      {
        action: "sysctl -w vm.swappiness=1",
        rationale: "DB \u72EC\u5360\u4E3B\u673A \xB7 \u7981\u6B62\u6D3B\u8DC3\u9875\u88AB\u6362\u51FA",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true
      }
    ],
    rationale: {
      summary: "swappiness \u63A7\u5236\u5185\u6838\u628A anonymous \u9875\u9762\u4EA4\u6362\u5230\u78C1\u76D8\u7684\u79EF\u6781\u7A0B\u5EA6\u3002\u9ED8\u8BA4 60 \u5BF9\u684C\u9762\u7CFB\u7EDF\u5408\u9002 \xB7 \u5BF9 DB \u573A\u666F\u81F4\u547D \xB7 DB \u5DE5\u4F5C\u96C6\u5927\u90E8\u5206\u662F anonymous \u5185\u5B58(mmap/mongod buffer)\xB7 \u88AB swap \u51FA\u53BB\u540E\u8BBF\u95EE\u662F\u78C1\u76D8\u5EF6\u8FDF\u7EA7\u522B\u3002",
      mechanism: "Linux kswapd \u5728\u5185\u5B58\u538B\u529B\u4E0B\u4ECE LRU \u6DD8\u6C70\u9875 \xB7 swappiness \u51B3\u5B9A anonymous \u9875 vs file-backed \u9875\u7684\u6DD8\u6C70\u6BD4\u4F8B\u300260 \u610F\u5473 anonymous \u9875\u4F18\u5148\u88AB\u6362\u51FA \xB7 DB \u7F13\u51B2\u6C60\u9996\u5F53\u5176\u51B2\u3002\u6362\u51FA\u540E\u4E0B\u6B21\u8BBF\u95EE\u89E6\u53D1 major page fault \xB7 \u8D70 swap \u76D8 IO \xB7 \u5EF6\u8FDF\u4ECE 100ns \u8DF3\u5230 100\u03BCs-ms\u3002",
      trade_offs: "\u964D\u5230 1 \u8BA9\u5185\u6838\u53EA\u5728\u51E0\u4E4E OOM \u65F6\u624D\u52A8 swap \xB7 \u51E0\u4E4E\u6D88\u706D DB swap \u6296\u52A8\u3002\u4EE3\u4EF7:\u82E5\u771F\u9047 OOM scenario \xB7 swap \u665A\u542F\u52A8\u53EF\u80FD\u8BA9 OOM Killer \u63D0\u524D\u4ECB\u5165\u3002\u4F46 DB \u573A\u666F\u4E0B OOM \u672C\u8EAB\u5C31\u662F\u9700\u8981\u544A\u8B66\u7684\u4E8B\u4EF6 \xB7 \u4E0D\u5E94\u9760 swap \u515C\u5E95\u3002",
      when_to_deviate: "\u6DF7\u5408\u90E8\u7F72\u573A\u666F(DB \u548C\u5176\u4ED6\u670D\u52A1\u5171\u4EAB\u4E3B\u673A)\xB7 \u53EF\u4FDD swappiness=10 \u4F5C\u6298\u4E2D\u3002\u7EAF DB \u7269\u7406\u673A\u5FC5\u987B 1 \u6216 0\u3002\u5BB9\u5668\u73AF\u5883 swap \u901A\u5E38\u88AB cgroup \u9650\u5236\u65E0\u6548 \xB7 \u8BBE\u7F6E\u4ECD\u6709\u610F\u4E49\u9632\u6B62\u672A\u6765\u5BB9\u5668\u7B56\u7565\u53D8\u5316\u3002"
    }
  });
};
var check_net_somaxconn = (ctx) => {
  const id = "os.net.somaxconn";
  const title = "somaxconn \u76D1\u542C\u961F\u5217";
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  const val = toInt(osVal(ctx, "net_somaxconn", 0), 0);
  if (val === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u672A\u91C7\u96C6\u5230", reason: "\u65E0\u6CD5\u8BFB\u53D6 net.core.somaxconn" });
  }
  if (val >= 1024) {
    return okResult({ id, title, bucket: 1, scope, summary: `somaxconn=${val}`, reason: "\u961F\u5217\u957F\u5EA6\u5145\u8DB3", threshold_display: "\u2265 4096", citations: [{ title: "MongoDB Production Notes \xB7 TCP", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }] });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `somaxconn=${val} < 1024`,
    description: "\u76D1\u542C\u961F\u5217\u8FC7\u77ED,\u9AD8\u5E76\u53D1\u65F6 TCP \u8FDE\u63A5\u8BF7\u6C42\u4F1A\u88AB\u5185\u6838\u4E22\u5F03",
    reason: `somaxconn=${val} \xB7 DB \u670D\u52A1\u5668\u5EFA\u8BAE \u2265 1024(Ampere/Mongo \u5EFA\u8BAE 65535)`,
    threshold_display: "\u2265 4096",
    evidence: [{ kind: "config", value: `net.core.somaxconn=${val}` }],
    impact: { metric: "connection_util_pct", value: 15, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "Ampere MongoDB Tuning \xB7 somaxconn", url: "https://amperecomputing.com/tuning-guides/mongoDB-tuning-guide" }
    ],
    recommendations: [
      {
        action: "sysctl -w net.core.somaxconn=4096",
        rationale: "\u51CF\u5C11\u9AD8\u5E76\u53D1\u65F6 SYN \u4E22\u5305",
        type: "mitigate",
        fix_cost: "trivial",
        verifiable: true
      }
    ]
  });
};
var check_tcp_keepalive = (ctx) => {
  const id = "os.net.tcp_keepalive_time";
  const title = "TCP Keepalive";
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  const kt = toInt(osVal(ctx, "tcp_keepalive_time", 0), 0);
  const ki = toInt(osVal(ctx, "tcp_keepalive_intvl", 0), 0);
  if (kt === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u672A\u91C7\u96C6\u5230", reason: "\u65E0\u6CD5\u8BFB\u53D6 tcp_keepalive_time" });
  }
  const current = `keepalive_time=${kt}s \xB7 keepalive_intvl=${ki}s`;
  if (kt <= 300) {
    return okResult({ id, title, bucket: 1, scope, summary: current, reason: "\u5728\u63A8\u8350\u8303\u56F4\u5185" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `keepalive_time=${kt}s \u8FC7\u9AD8`,
    description: "\u7A7A\u95F2\u8FDE\u63A5\u5931\u6548\u65F6\u5BA2\u6237\u7AEF\u611F\u77E5\u6EDE\u540E,\u52A0\u5267\u8FDE\u63A5\u98CE\u66B4",
    reason: `tcp_keepalive_time=${kt}s \xB7 MongoDB \u5EFA\u8BAE \u2264 120s`,
    threshold_display: "\u2264 120s",
    evidence: [{ kind: "config", value: current }],
    impact: { metric: "connection_util_pct", value: 8, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Production Notes \xB7 TCP keepalive", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }
    ],
    recommendations: [
      {
        action: "sysctl -w net.ipv4.tcp_keepalive_time=120 && sysctl -w net.ipv4.tcp_keepalive_intvl=10",
        rationale: "\u8BA9\u5BA2\u6237\u7AEF\u5FEB\u901F\u611F\u77E5\u65AD\u8FDE,\u914D\u5408\u8FDE\u63A5\u6C60\u56DE\u6536",
        type: "mitigate",
        fix_cost: "trivial",
        verifiable: true
      }
    ],
    rationale: {
      summary: "Linux \u9ED8\u8BA4 tcp_keepalive_time=7200s(2 \u5C0F\u65F6)\xB7 \u5BF9\u6570\u636E\u5E93\u573A\u666F\u8FC7\u9AD8 \xB7 \u5BA2\u6237\u7AEF\u611F\u77E5\u8FDE\u63A5\u6B7B\u4EA1\u8981\u7B49 2 \u5C0F\u65F6 \xB7 \u671F\u95F4\u8FDE\u63A5\u6C60\u91CC\u7684\u5047\u8FDE\u63A5\u4F1A\u88AB\u5206\u914D\u7ED9\u65B0\u8BF7\u6C42 \xB7 \u8868\u73B0\u4E3A\u5BA2\u6237\u7AEF hang \u5230 timeout\u3002",
      mechanism: "TCP keepalive \u673A\u5236\u5728\u8FDE\u63A5\u7A7A\u95F2\u8D85\u8FC7 tcp_keepalive_time \u79D2\u540E \xB7 \u5185\u6838\u6BCF tcp_keepalive_intvl \u79D2\u53D1\u63A2\u6D4B\u5305 \xB7 \u7D2F\u8BA1 tcp_keepalive_probes \u6B21(\u9ED8\u8BA4 9)\u6CA1 ACK \u5C31\u6807\u8BB0\u8FDE\u63A5\u6B7B\u3002\u9ED8\u8BA4\u5168\u94FE\u8DEF\u9700 2h + 9\xD775s \u2248 2h11m\u3002MongoDB \u5B98\u65B9\u63A8\u8350 120s + 10s \u95F4\u9694 \xB7 \u8FDE\u63A5\u95EE\u9898 3 \u5206\u949F\u5185\u88AB\u53D1\u73B0\u3002",
      trade_offs: "\u8C03\u4F4E\u589E\u52A0\u5C11\u91CF keepalive \u63A2\u6D4B\u5305\u6D41\u91CF(\u53EF\u5FFD\u7565)\xB7 \u6362\u6765\u5FEB\u901F\u6545\u969C\u611F\u77E5\u3002\u8D1F\u8F7D\u5747\u8861\u5668 / NAT \u8D85\u65F6\u5E38\u8BBE\u5728 5-15 \u5206\u949F \xB7 keepalive \u5FC5\u987B\u77ED\u4E8E\u8FD9\u4E2A\u503C\u624D\u80FD\u9632\u6B62 NAT \u63D0\u524D\u6E05\u8868\u3002",
      when_to_deviate: "\u6781\u4F4E\u5EF6\u8FDF / HFT \u573A\u666F\u76F4\u63A5\u7981 keepalive \u9760\u5E94\u7528\u5C42\u5FC3\u8DF3\u3002\u666E\u901A OLTP / \u670D\u52A1\u7AEF mongod \u540E\u63A5 NAT \u6216\u4E91 LB \u7684\u5FC5\u987B \u2264 300s\u3002"
    }
  });
};
var check_vm_dirty_ratio = (ctx) => {
  const id = "os.vm.dirty_ratio";
  const title = "\u810F\u9875\u5199\u56DE\u7B56\u7565";
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  const dr = toInt(osVal(ctx, "vm_dirty_ratio", 0), 0);
  const dbg = toInt(osVal(ctx, "vm_dirty_background_ratio", 0), 0);
  if (dr === 0 && dbg === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u672A\u91C7\u96C6\u5230", reason: "sysctl \u8BFB\u53D6\u5931\u8D25" });
  }
  const current = `dirty_ratio=${dr}% \xB7 dirty_background_ratio=${dbg}%`;
  if (dr < 10 && dbg < 5) {
    return okResult({ id, title, bucket: 1, scope, summary: current, reason: "\u810F\u9875\u53C2\u6570\u5408\u7406" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `${current} \u504F\u9AD8`,
    description: "\u5927\u91CF\u810F\u9875\u79EF\u538B\u540E\u96C6\u4E2D\u5237\u76D8\u4F1A\u5BFC\u81F4\u5199\u505C\u987F(write stall)",
    reason: `dirty_ratio=${dr}% / dirty_background_ratio=${dbg}% \xB7 DB \u573A\u666F\u5E94 \u2264 5/2`,
    threshold_display: "dirty_ratio \u2264 5% \xB7 dirty_bg \u2264 2%",
    evidence: [{ kind: "config", value: current }],
    impact: { metric: "latency_p95_ms", value: 15, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "Red Hat Performance Tuning \xB7 dirty ratio", url: "https://access.redhat.com/sites/default/files/attachments/rhel7_numa_perf_brief.pdf" }
    ],
    recommendations: [
      {
        action: "sysctl -w vm.dirty_ratio=5 && sysctl -w vm.dirty_background_ratio=2",
        rationale: "\u8BA9\u810F\u9875\u6301\u7EED\u5C0F\u6279\u91CF\u5237\u76D8 \xB7 \u907F\u514D\u96C6\u4E2D IO \u98CE\u66B4",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true
      }
    ],
    rationale: {
      summary: "\u5185\u6838 page cache \u7684\u810F\u9875\u6BD4\u4F8B\u4E0A\u9650\u7531 vm.dirty_ratio \u63A7\u5236 \xB7 \u9ED8\u8BA4 20%\u3002256GB \u7269\u7406\u673A = \u6700\u591A 50GB \u810F\u9875 \xB7 \u89E6\u53D1\u9608\u503C\u65F6\u5E94\u7528\u7EBF\u7A0B\u88AB\u963B\u585E\u76F4\u5230 pdflush \u5237\u5B8C \xB7 DB \u5199\u8BF7\u6C42\u88AB\u6574\u4F53 freeze \u51E0\u79D2\u5230\u51E0\u5341\u79D2(write stall)\u3002",
      mechanism: "Linux \u6709\u4E24\u7EA7\u9608\u503C:dirty_background_ratio(\u9ED8\u8BA4 10%)\u89E6\u53D1\u540E pdflush \u540E\u53F0\u5F02\u6B65\u5237 \xB7 dirty_ratio(\u9ED8\u8BA4 20%)\u89E6\u53D1\u540E**\u5E94\u7528\u7EBF\u7A0B\u540C\u6B65\u5237**\u4E0D\u518D\u8FD4\u56DE\u3002DB \u6279\u91CF\u5199(checkpoint / redo rotate / bulk insert)\u77AC\u65F6\u751F\u6210\u5927\u91CF\u810F\u9875 \xB7 \u8F7B\u677E\u89E6\u8FBE 20% \xB7 \u6574\u4E2A mongod \u8FDB\u7A0B\u88AB write() syscall \u5361\u4F4F\u3002",
      trade_offs: "\u964D\u4F4E\u9608\u503C\u8BA9\u5237\u76D8\u66F4\u9891\u7E41\u4F46\u66F4\u5E73\u6ED1 \xB7 5%/2% \u5BF9 NVMe \u662F\u6BCF\u79D2 MB \u7EA7\u5C0F\u6279\u91CF \xB7 \u5F71\u54CD\u53EF\u5FFD\u7565\u3002\u63D0\u9AD8\u4F1A\u4EA7\u751F\u66F4\u5927 IO bursts \xB7 \u5BF9 DB \u662F\u81F4\u547D\u7684\u3002\u751F\u4EA7 DB \u573A\u666F\u4E0D\u5B58\u5728\u8BA9\u9608\u503C\u53D8\u9AD8\u7684\u5408\u7406\u7406\u7531\u3002",
      when_to_deviate: "\u7EAF\u65E5\u5FD7 workload(append-only + fsync \u9891\u7E41)\u53EF\u4FDD\u9ED8\u8BA4 \xB7 \u53CD\u6B63\u810F\u9875\u5F88\u5FEB\u88AB fsync \u6E05\u6389\u3002\u4F46 MongoDB WT checkpoint \u8D70 OS fsync \xB7 \u8FD8\u662F\u53D7\u5F71\u54CD \xB7 \u4E0D\u7B97\u4F8B\u5916\u3002"
    }
  });
};
var check_disk_latency = (ctx) => {
  const id = "os.io.disk_await_ms";
  const title = "\u78C1\u76D8 IO \u5EF6\u8FDF";
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  const await_val = toFloat(osVal(ctx, "disk_await_ms", 0), 0);
  if (await_val <= 20) {
    return okResult({ id, title, bucket: 1, scope, summary: `await=${await_val.toFixed(1)}ms`, reason: "\u78C1\u76D8\u5EF6\u8FDF\u6B63\u5E38", threshold_display: "< 10ms", citations: [{ title: "Red Hat iostat \xB7 await", url: "https://www.redhat.com/en/blog/analysing-perf-data-sysstat-and-iostat" }] });
  }
  return finding({
    id,
    title,
    severity: "critical",
    bucket: 1,
    scope,
    summary: `await=${await_val.toFixed(1)}ms > 20ms`,
    description: "\u78C1\u76D8 IO \u5EF6\u8FDF\u8FC7\u9AD8 \xB7 DB \u68C0\u67E5\u70B9 / \u65E5\u5FD7\u5199\u5165\u53D7\u963B",
    reason: `iostat await=${await_val.toFixed(1)}ms \xB7 \u9608\u503C 20ms`,
    threshold_display: "< 20ms",
    evidence: [{ kind: "metric", value: `disk_await_ms=${await_val.toFixed(1)}` }],
    impact: { metric: "latency_p95_ms", value: 40, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Production Notes \xB7 disk latency", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }
    ],
    recommendations: [
      {
        action: "\u68C0\u67E5\u78C1\u76D8\u7C7B\u578B(SSD/HDD)\xB7 \u786E\u8BA4 IO \u8C03\u5EA6\u5668 \xB7 \u6392\u67E5\u5176\u4ED6\u8FDB\u7A0B\u7ADE\u4E89",
        rationale: "\u78C1\u76D8\u786C\u4EF6\u7EA7\u6392\u67E5(\u975E sysctl \u53EF\u6539)",
        type: "detect",
        fix_cost: "restart_engine",
        verifiable: false
      }
    ]
  });
};
var check_disk_usage = (ctx) => {
  const id = "os.io.disk_usage_pct";
  const title = "\u78C1\u76D8\u5BB9\u91CF";
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  const pct = toFloat(osVal(ctx, "disk_usage_pct", 0), 0);
  if (pct <= 80) {
    return okResult({ id, title, bucket: 1, scope, summary: `usage=${pct.toFixed(0)}%`, reason: "\u78C1\u76D8\u7A7A\u95F4\u5145\u8DB3", threshold_display: "< 80%", citations: [{ title: "MongoDB Production Notes \xB7 disk space", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }] });
  }
  const severity = pct > 90 ? "critical" : "warning";
  return finding({
    id,
    title,
    severity,
    bucket: 1,
    scope,
    summary: `usage=${pct.toFixed(0)}% \u8D85\u9608\u503C`,
    description: "\u78C1\u76D8\u7A7A\u95F4\u4E0D\u8DB3\u5F71\u54CD DB \u65E5\u5FD7 / \u68C0\u67E5\u70B9\u5199\u5165",
    reason: `data dir \u4F7F\u7528\u7387 ${pct.toFixed(0)}% \xB7 DB \u573A\u666F\u5E94 \u2264 80%`,
    threshold_display: "< 80%",
    evidence: [{ kind: "metric", value: `disk_usage_pct=${pct.toFixed(0)}` }],
    impact: { metric: "wasted_bytes", value: pct, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Production Notes \xB7 disk space", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }
    ],
    recommendations: [
      {
        action: "\u6E05\u7406\u65E5\u5FD7 / \u6269\u5BB9\u6570\u636E\u5377 / \u5F52\u6863\u5386\u53F2\u6570\u636E",
        rationale: "\u907F\u514D\u78C1\u76D8\u5199\u6EE1\u5BFC\u81F4 DB \u505C\u5199",
        type: "prevent",
        fix_cost: "schema_migration",
        verifiable: false
      }
    ]
  });
};
var check_tcp_retransmit = (ctx) => {
  const id = "os.net.tcp_retrans_pct";
  const title = "TCP \u91CD\u4F20\u7387";
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  const pct = toFloat(osVal(ctx, "tcp_retrans_pct", 0), 0);
  if (pct <= 1) {
    return okResult({ id, title, bucket: 1, scope, summary: `retrans=${pct.toFixed(2)}%`, reason: "TCP \u91CD\u4F20\u7387\u6B63\u5E38" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `retrans=${pct.toFixed(2)}% > 1%`,
    description: "\u9AD8\u91CD\u4F20\u7387\u5BFC\u81F4 DB \u5BA2\u6237\u7AEF\u8FDE\u63A5\u8D85\u65F6 / \u6162\u67E5\u8BE2\u653E\u5927",
    reason: `tcp_retrans=${pct.toFixed(2)}% \xB7 \u9608\u503C 1%`,
    threshold_display: "\u2264 1%",
    evidence: [{ kind: "metric", value: `tcp_retrans_pct=${pct.toFixed(2)}` }],
    impact: { metric: "latency_p95_ms", value: 20, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "Red Hat Performance Tuning \xB7 TCP retransmission", url: "https://access.redhat.com/sites/default/files/attachments/rhel7_numa_perf_brief.pdf" }
    ],
    recommendations: [
      {
        action: "\u6392\u67E5\u4EA4\u6362\u673A\u62E5\u585E \xB7 \u68C0\u67E5 MTU / TCP congestion algorithm / \u7F51\u7EDC\u8D1F\u8F7D",
        rationale: "\u94FE\u8DEF\u8D28\u91CF\u95EE\u9898,\u975E DB \u4FA7\u76F4\u63A5\u53EF\u4FEE",
        type: "detect",
        fix_cost: "restart_engine",
        verifiable: false
      }
    ]
  });
};
var check_vm_zone_reclaim = (ctx) => {
  const id = "os.vm.zone_reclaim_mode";
  const title = "vm.zone_reclaim_mode";
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  if (engine !== "mongo") {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u4EC5\u5BF9 MongoDB \u5F3A\u63A8", reason: `db_type=${engine}` });
  }
  const val = toInt(osVal(ctx, "vm_zone_reclaim_mode", -1), -1);
  if (val < 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u672A\u91C7\u96C6 zone_reclaim_mode", reason: "sysctl \u4E0D\u53EF\u8BFB" });
  }
  if (val === 0) {
    return okResult({ id, title, bucket: 1, scope, summary: "zone_reclaim_mode=0", reason: "\u7981\u7528\u533A\u57DF\u56DE\u6536 \xB7 \u7B26\u5408 MongoDB \u5EFA\u8BAE" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `zone_reclaim_mode=${val} \u2260 0`,
    description: "\u5F00\u542F zone_reclaim \u4F1A\u5BFC\u81F4 WiredTiger \u5206\u914D\u65F6\u4F18\u5148\u56DE\u6536\u672C\u8282\u70B9 \xB7 \u5F15\u5165\u610F\u5916\u5EF6\u8FDF \xB7 MongoDB \u660E\u786E\u8981\u6C42 0",
    reason: `vm.zone_reclaim_mode=${val} \xB7 MongoDB Production Notes \u8981\u6C42 0`,
    threshold_display: "== 0",
    evidence: [{ kind: "config", value: `vm.zone_reclaim_mode=${val}` }],
    impact: { metric: "latency_p95_ms", value: 12, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Production Notes \xB7 zone_reclaim_mode", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }
    ],
    recommendations: [
      {
        action: "sysctl -w vm.zone_reclaim_mode=0",
        rationale: "\u7981\u7528 NUMA \u533A\u57DF\u56DE\u6536 \xB7 \u907F\u514D\u5206\u914D\u65F6\u5EF6\u8FDF",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true
      }
    ]
  });
};
var check_vm_max_map_count = (ctx) => {
  const id = "os.vm.max_map_count";
  const title = "vm.max_map_count";
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  if (engine !== "mongo") {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u4EC5\u5BF9 MongoDB \u5F3A\u63A8", reason: `db_type=${engine}` });
  }
  const val = toInt(osVal(ctx, "vm_max_map_count", 0), 0);
  if (val === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u672A\u91C7\u96C6", reason: "sysctl \u4E0D\u53EF\u8BFB" });
  }
  if (val >= 128e3) {
    return okResult({ id, title, bucket: 1, scope, summary: `max_map_count=${val}`, reason: "\u5DF2\u8FBE MongoDB \u63A8\u8350 \u2265 128000", threshold_display: "\u2265 128000", citations: [{ title: "MongoDB sysctl \xB7 vm.max_map_count", url: "https://www.mongodb.com/docs/manual/reference/ulimit/" }] });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `max_map_count=${val} < 128000`,
    description: "\u5927 collection / \u591A sharded \u573A\u666F\u4E0B\u4F1A\u89E6\u8FBE mmap \u4E0A\u9650,mongod \u62A5 mmap failed",
    reason: `vm.max_map_count=${val} \xB7 Ampere MongoDB \u8C03\u4F18\u6307\u5357\u8981\u6C42 \u2265 128000`,
    threshold_display: "\u2265 128000",
    evidence: [{ kind: "config", value: `vm.max_map_count=${val}` }],
    impact: { metric: "db_time_pct", value: 8, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "Ampere MongoDB Tuning \xB7 vm.max_map_count", url: "https://amperecomputing.com/tuning-guides/mongoDB-tuning-guide" }
    ],
    recommendations: [
      {
        action: "sysctl -w vm.max_map_count=262144",
        rationale: "\u6309 Ampere/Mongo \u6700\u4F73\u5B9E\u8DF5\u8C03\u9AD8\u81F3 262144",
        type: "prevent",
        fix_cost: "trivial",
        verifiable: true
      }
    ]
  });
};
var check_env_virt_type = (ctx) => {
  const id = "os.env.virt_type";
  const title = "\u865A\u62DF\u5316\u7C7B\u578B";
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  const virt = osVal(ctx, "env_virt_type", "unknown");
  const vendor = osVal(ctx, "env_sys_vendor", "unknown");
  const product = osVal(ctx, "env_product_name", "unknown");
  if (!virt || virt === "unknown") {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "\u672A\u91C7\u96C6\u5230\u865A\u62DF\u5316\u7C7B\u578B",
      reason: "systemd-detect-virt \u4E0D\u53EF\u7528"
    });
  }
  if (virt === "none") {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `bare-metal \xB7 sys_vendor=${vendor}`,
      reason: `\u7269\u7406\u673A\u90E8\u7F72(${product}) \xB7 \u5B8C\u6574\u8C03\u4F18\u624B\u6BB5\u53EF\u843D\u5730`
    });
  }
  return infoResult({
    id,
    title,
    bucket: 1,
    scope,
    summary: `virt=${virt} \xB7 sys_vendor=${vendor}`,
    reason: "\u865A\u62DF\u5316\u73AF\u5883 \xB7 CPU \u8C03\u9891 / NUMA / IRQ \u8C03\u4F18\u53EF\u80FD\u53D7 hypervisor \u9650\u5236 \xB7 \u5185\u5B58 ballooning \u9700\u5728 hypervisor \u4FA7\u5173\u95ED",
    citations: [
      { title: "MongoDB Production Notes \xB7 Virtualization", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }
    ]
  });
};
var check_cpu_cores_minimum = (ctx) => {
  const id = "os.cpu.cores_minimum";
  const title = "CPU \u6838\u5FC3\u6570";
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  const cores = toInt(osVal(ctx, "cpu_cores", 0), 0);
  if (cores === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u672A\u91C7\u96C6\u5230 CPU \u6838\u5FC3\u6570", reason: "nproc \u4E0D\u53EF\u7528" });
  }
  if (cores >= 2) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `cpu_cores=${cores}`,
      reason: "CPU \u6838\u5FC3\u5145\u8DB3",
      threshold_display: "\u2265 2 cores",
      citations: [{ title: "MongoDB Production Notes \xB7 CPU requirements", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }]
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `cpu_cores=${cores} < 2`,
    description: "MongoDB / \u5927\u591A\u6570 DB \u5728\u751F\u4EA7\u73AF\u5883\u81F3\u5C11\u9700\u8981 2 \u4E2A\u771F\u5B9E\u6838\u5FC3 \xB7 \u5355\u6838\u673A\u5668\u65E0\u6CD5\u627F\u53D7 DB + OS \u53CC\u65B9\u7EBF\u7A0B\u8C03\u5EA6",
    reason: `cpu_cores=${cores} \xB7 \u751F\u4EA7\u5EFA\u8BAE \u2265 2 real cores`,
    threshold_display: "\u2265 2 cores",
    evidence: [{ kind: "metric", value: `cpu_cores=${cores}` }],
    impact: { metric: "throughput_qps", value: 40, unit: "percent", confidence: "high" },
    citations: [
      { title: "MongoDB Production Notes \xB7 CPU requirements", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }
    ],
    recommendations: [
      {
        action: "\u5347\u7EA7\u5230 \u2265 2 cores \u7684\u5B9E\u4F8B\u89C4\u683C",
        rationale: "\u89C4\u907F DB \u8FDB\u7A0B\u4E0E OS \u5185\u6838\u7EBF\u7A0B\u4E89\u62A2\u5355\u6838",
        type: "prevent",
        fix_cost: "restart_engine",
        verifiable: false
      }
    ]
  });
};
var check_kernel_version_rseq = (ctx) => {
  const id = "os.kernel.version_rseq";
  const title = "\u5185\u6838\u7248\u672C \xB7 rseq \u652F\u6301";
  const engine = ctx.db_type;
  const scope = deriveScope(ctx, engine);
  if (engine !== "mongo") {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u4EC5\u5BF9 MongoDB \u68C0\u67E5", reason: `db_type=${engine}` });
  }
  const kv = osVal(ctx, "kernel_version", "");
  if (!kv) {
    return infoResult({ id, title, bucket: 1, scope, summary: "\u672A\u91C7\u96C6 kernel version", reason: "uname -r \u4E0D\u53EF\u8BFB" });
  }
  const m = /^(\d+)\.(\d+)/.exec(kv);
  if (!m) {
    return infoResult({ id, title, bucket: 1, scope, summary: `kernel=${kv}`, reason: "\u65E0\u6CD5\u89E3\u6790 major.minor" });
  }
  const major = parseInt(m[1], 10);
  const minor = parseInt(m[2], 10);
  const ok = major > 4 || major === 4 && minor >= 18;
  if (ok) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `kernel=${kv}`,
      reason: "\u5185\u6838\u652F\u6301 rseq \xB7 tcmalloc per-CPU caches \u53EF\u542F\u7528",
      threshold_display: "\u2265 4.18",
      citations: [{ title: "MongoDB \xB7 tcmalloc-google and Linux kernel", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }]
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `kernel=${kv} < 4.18`,
    description: "MongoDB 8.0+ \u9ED8\u8BA4\u542F\u7528 tcmalloc-google per-CPU caches,\u4F9D\u8D56 glibc rseq,rseq \u5728 kernel < 4.18 \u4E0A\u672A\u6210\u719F\u652F\u6301,\u53EF\u80FD\u9000\u56DE\u5230 per-thread caches",
    reason: `kernel ${kv} \u65E9\u4E8E 4.18 \xB7 \u53EF\u80FD\u65E0\u6CD5\u4F7F\u7528 tcmalloc per-CPU caches`,
    threshold_display: "\u2265 4.18",
    evidence: [{ kind: "config", value: `kernel_version=${kv}` }],
    impact: { metric: "throughput_qps", value: 8, unit: "percent", confidence: "medium" },
    citations: [
      { title: "MongoDB Production Notes \xB7 tcmalloc", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }
    ],
    recommendations: [
      {
        action: "\u5347\u7EA7\u5230\u652F\u6301 rseq \u7684\u5185\u6838(\u2265 4.18,RHEL 8 / openEuler 20.03 / Ubuntu 18.04+)",
        rationale: "\u8BA9 tcmalloc-google \u80FD\u7A33\u5B9A\u542F\u7528 per-CPU caches,\u63D0\u5347\u9AD8\u5E76\u53D1\u5206\u914D\u6027\u80FD",
        type: "prevent",
        fix_cost: "restart_engine",
        verifiable: false
      }
    ]
  });
};
var osChecks = [
  check_hugepage,
  check_thp,
  check_io_scheduler,
  check_swappiness,
  check_net_somaxconn,
  check_tcp_keepalive,
  check_vm_dirty_ratio,
  check_disk_latency,
  check_disk_usage,
  check_tcp_retransmit,
  check_vm_zone_reclaim,
  check_vm_max_map_count,
  check_env_virt_type,
  check_cpu_cores_minimum,
  check_kernel_version_rseq
];

// skills/perf-kp-sql/src/shared/index.ts
var sharedChecks = [
  ...kunpengChecks,
  ...arm64Checks,
  ...openeulerChecks,
  ...osChecks
];

// skills/perf-kp-sql/src/engines/mongo/checks.ts
function mongoScope(ctx) {
  return deriveScope(ctx, "mongo");
}
function notMongoSkip(ctx, id, title, bucket) {
  if (ctx.db_type !== "mongo") {
    return infoResult({
      id,
      title,
      bucket,
      scope: mongoScope(ctx),
      summary: "\u975E MongoDB \u73AF\u5883,\u5DF2\u8DF3\u8FC7",
      reason: `db_type=${ctx.db_type}`
    });
  }
  return null;
}
var check_mongo_connections = (ctx) => {
  const id = "mongo.runtime.connection_pool";
  const title = "MongoDB \u8FDE\u63A5\u6C60\u4F7F\u7528\u7387";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);
  const raw = dbVal(ctx, "connections", {});
  let current = 0;
  if (raw && typeof raw === "object") {
    current = toInt(raw["current"] ?? 0, 0);
  } else if (isDigitString(raw)) {
    current = toInt(raw);
  }
  if (current <= 500) {
    return okResult({ id, title, bucket: 5, scope, summary: `connections.current=${current}`, reason: "\u8FDE\u63A5\u6570\u5728\u5408\u7406\u8303\u56F4", threshold_display: "< 500", citations: [{ title: "MongoDB Production Notes \xB7 connections", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }] });
  }
  const severity = current > 1e3 ? "critical" : "warning";
  return finding({
    id,
    title,
    severity,
    bucket: 5,
    scope,
    summary: `connections.current=${current}`,
    description: "\u8FDE\u63A5\u6570\u8FC7\u9AD8\u5BFC\u81F4\u7EBF\u7A0B\u5207\u6362\u5F00\u9500\u548C\u5185\u5B58\u538B\u529B,mongod worker \u6C60\u6296\u52A8\u3002",
    reason: `serverStatus.connections.current=${current} \xB7 \u751F\u4EA7\u5EFA\u8BAE \u2264 500`,
    threshold_display: "\u2264 500",
    evidence: [{ kind: "metric", value: `connections.current=${current}` }],
    impact: { metric: "connection_util_pct", value: Math.min(100, current / 10), unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Server Parameters \xB7 net.maxIncomingConnections", url: "https://www.mongodb.com/docs/manual/reference/parameters/" }
    ],
    recommendations: [
      {
        action: "\u5BA1\u89C6\u5E94\u7528\u8FDE\u63A5\u6C60\u4E0A\u9650 \xB7 \u8BBE\u7F6E maxPoolSize \xB7 \u6392\u67E5\u8FDE\u63A5\u6CC4\u9732",
        rationale: "\u4ECE\u5BA2\u6237\u7AEF\u4FA7\u63A7\u5236\u603B\u8FDE\u63A5\u6570 \xB7 mongod \u4FA7 maxIncomingConnections \u662F\u515C\u5E95",
        type: "mitigate",
        fix_cost: "trivial",
        verifiable: false
      }
    ],
    rationale: {
      summary: "MongoDB \u7684\u8FDE\u63A5\u6A21\u578B\u662F thread-per-connection(\u975E\u5F02\u6B65)\xB7 \u6BCF\u8FDE\u63A5\u4E00\u4E2A\u7EBF\u7A0B + 1MB \u7EBF\u7A0B\u6808 + \u4E0A\u4E0B\u6587\u5207\u6362\u5F00\u9500\u3002\u8FDE\u63A5\u6570 > 500 \u5F00\u59CB\u7EBF\u7A0B\u8C03\u5EA6\u6210\u672C\u62A2 CPU \xB7 > 1000 worker \u6C60\u6296\u52A8\u660E\u663E \xB7 > 2000 \u8FDB\u7A0B\u7A33\u5B9A\u6027\u53D7\u5A01\u80C1\u3002",
      mechanism: "\u6BCF\u4E2A TCP \u8FDE\u63A5 mongod \u5206\u914D\u4E00\u4E2A worker \u7EBF\u7A0B\u5904\u7406\u8BF7\u6C42 \xB7 \u7EBF\u7A0B\u6808 1MB \u9ED8\u8BA4\u30022000 \u8FDE\u63A5 = 2GB \u8FDE\u63A5\u6808 + CPU \u5728\u591A\u4E2A\u7EBF\u7A0B\u95F4\u5207\u6362 \xB7 Linux CFS \u8C03\u5EA6\u5F00\u9500\u5FEB\u901F\u7D2F\u79EF\u3002\u8FDE\u63A5\u7A7A\u95F2\u65F6 worker \u5360\u4F4F\u8D44\u6E90\u4E0D\u91CA\u653E \xB7 \u76F4\u5230\u8FDE\u63A5\u5173\u95ED\u3002",
      trade_offs: "\u5BA2\u6237\u7AEF\u8BBE maxPoolSize \u9650\u5236\u8FDE\u63A5\u603B\u6570 \xB7 \u662F\u6B63\u9053 \xB7 \u4E0D\u5F71\u54CD\u6027\u80FD\u53EA\u662F\u8BF7\u6C42 queue\u3002mongod \u4FA7 net.maxIncomingConnections \u662F\u786C\u4E0A\u9650 \xB7 \u88AB\u62D2\u8FDE\u63A5\u8FD4\u56DE\u9519 \xB7 \u5BF9\u5E94\u7528\u4E0D\u53CB\u597D\u6545\u53EA\u4F5C\u515C\u5E95\u3002",
      when_to_deviate: "Mongo 4.2+ \u6709 serverlessWorkerThreadMode \u5B9E\u9A8C\u6027 async \xB7 \u6B64\u65F6\u53EF\u5BB9\u5FCD 5000+ \u8FDE\u63A5\u3002\u5927\u90E8\u5206\u751F\u4EA7\u90E8\u7F72\u4E0D\u5EFA\u8BAE\u5F00\u3002"
    }
  });
};
var check_wt_cache_vs_memory = (ctx) => {
  const id = "mongo.config.wt_cache_vs_memory";
  const title = "WiredTiger Cache \u4E0E OS \u5185\u5B58";
  const skip = notMongoSkip(ctx, id, title, 2);
  if (skip) return skip;
  const scope = mongoScope(ctx);
  const total_mem_mb = toInt(osVal(ctx, "total_mem_mb", 0), 0);
  const wt_bytes = toInt(dbVal(ctx, "wt_cache_maximum_bytes", 0), 0);
  const conns_raw = dbVal(ctx, "connections", {});
  const active = conns_raw && typeof conns_raw === "object" ? toInt(conns_raw["current"] ?? 0, 0) : 0;
  if (wt_bytes === 0 && active > 0) {
    return infoResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: "\u672A\u80FD\u8BFB\u53D6 WT cache size",
      reason: "serverStatus.wiredTiger.cache \u8FD4\u56DE\u7A7A \xB7 \u53EF\u80FD\u6743\u9650\u4E0D\u8DB3",
      skip_reason: "runtime_data_missing"
    });
  }
  const wt_mb = Math.floor(wt_bytes / 1024 / 1024);
  const pct = total_mem_mb > 0 ? wt_bytes / (total_mem_mb * 1024 * 1024) * 100 : 0;
  if (total_mem_mb === 0 || pct <= 80) {
    return okResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: `WT=${wt_mb}MB \xB7 OS=${total_mem_mb}MB \xB7 ${pct.toFixed(1)}%`,
      reason: "WT Cache \u5728\u5B89\u5168\u8303\u56F4\u5185",
      threshold_display: "< 50% \u7269\u7406\u5185\u5B58",
      citations: [{ title: "MongoDB Memory Use", url: "https://www.mongodb.com/docs/manual/administration/production-notes/#memory-use" }]
    });
  }
  return finding({
    id,
    title,
    severity: "critical",
    bucket: 2,
    scope,
    summary: `WT=${wt_mb}MB / OS=${total_mem_mb}MB = ${pct.toFixed(1)}% \xB7 \u8D85 80%`,
    description: "WiredTiger \u7F13\u5B58\u8D85\u51FA OS \u5B89\u5168\u8FB9\u754C\u4F1A\u5F15\u53D1 swap,\u5BFC\u81F4 IO \u963B\u585E\u7EA7\u6B7B\u9501\u3002",
    reason: `WT cacheSizeGB \u2248 ${wt_mb} MiB,\u8D85\u8FC7\u7269\u7406\u5185\u5B58 80% \u9608\u503C`,
    threshold_display: "\u2264 50% \u7269\u7406\u5185\u5B58",
    evidence: [
      { kind: "metric", value: `wt_cache_maximum_bytes=${wt_bytes}` },
      { kind: "metric", value: `os_total_mem_mb=${total_mem_mb}` }
    ],
    impact: { metric: "cache_miss_rate", value: 35, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB WiredTiger \xB7 cache sizing", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" }
    ],
    recommendations: [
      {
        action: "db.adminCommand({setParameter:1, wiredTigerEngineRuntimeConfig:'cache_size=XG'})  # X \u2264 mem*0.5",
        rationale: "\u6807\u51C6\u63A8\u8350:WT cache \u2264 \u7269\u7406\u5185\u5B58 50%",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true
      }
    ],
    rationale: {
      summary: "WT cache \u8D85\u8FC7\u7269\u7406\u5185\u5B58 80% \u65F6 \xB7 mongod \u5269\u4F59\u5185\u5B58\u4E0D\u8DB3\u4EE5\u627F\u8F7D\u8FDE\u63A5\u6808 / \u7F51\u7EDC\u7F13\u51B2 / \u540E\u53F0\u7EBF\u7A0B \xB7 \u5BB9\u6613\u89E6\u53D1 OS swap \xB7 \u4E00\u65E6 swap \u542F\u52A8 WT \u81EA\u8EAB\u7684 fsync/checkpoint \u88AB\u963B\u585E \xB7 \u6574\u5E93 IO \u4E32\u8054\u5361\u987F\u3002",
      mechanism: "WT cache \u4E0D\u662F\u4E00\u6B21 malloc \u5206\u914D \xB7 \u6309 working set \u589E\u957F\u3002OS \u5269\u4F59\u5185\u5B58\u88AB mongod \u8FDE\u63A5\u7EBF\u7A0B(\u6BCF\u8FDE\u63A5\u7EA6 1MB \u6808)\xB7 \u5185\u6838 page cache \xB7 journal buffer \u7ADE\u4E89\u3002\u8D85 80% \u65F6 Linux kswapd \u542F\u52A8 page reclaim \xB7 \u8FFD\u4E0D\u4E0A\u5C31\u8F6C direct reclaim \u963B\u585E\u5E94\u7528\u7EBF\u7A0B\u3002swap \u8D70\u78C1\u76D8 IO \xB7 \u4E0E WT \u81EA\u5DF1\u7684 checkpoint \u5728\u540C\u4E00\u78C1\u76D8\u4E92\u76F8\u6392\u961F \xB7 \u5EF6\u8FDF\u4ECE\u6BEB\u79D2\u8DF3\u5230\u79D2\u7EA7\u3002",
      trade_offs: "\u8C03\u4F4E cache \u727A\u7272\u90E8\u5206 working set \u547D\u4E2D\u7387(\u5178\u578B 5-15% p95 \u5EF6\u8FDF\u4E0A\u5347 \xB7 \u53D6\u51B3 working set \u662F\u5426\u5927\u4E8E\u5269\u4F59 cache)\xB7 \u6362\u6765\u907F\u514D\u96EA\u5D29\u3002\u5B98\u65B9\u63A8\u8350 cacheSizeGB \u2248 (mem-1GB)\xD70.5 \xB7 \u4FDD\u5B88\u573A\u666F\u53D6 0.4 mem \u66F4\u7A33\u3002",
      when_to_deviate: "\u7EAF\u5185\u5B58\u6570\u636E\u96C6 \xB7 mem \u2265 2\xD7 dataset \xB7 \u4E14\u65E0\u5E76\u53D1 index build \u6216 backup \xB7 \u53EF\u63D0\u5230 60%\u3002\u4E91\u6570\u636E\u5E93\u5171\u4EAB\u5BBF\u4E3B\u5185\u5B58\u573A\u666F\u5FC5\u987B \u2264 40% \u907F\u5F00 noisy neighbor\u3002"
    }
  });
};
var check_wt_cache_hit = (ctx) => {
  const id = "mongo.runtime.wt_cache_hit_rate";
  const title = "WiredTiger \u7F13\u5B58\u547D\u4E2D\u7387";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);
  const detail = dbVal(ctx, "_wt_cache_detail", {});
  const pages_read = toInt(detail["pages read into cache"] ?? 0, 0);
  const pages_req = toInt(detail["pages requested from the cache"] ?? 0, 0);
  const hit = pages_req > 0 ? (1 - pages_read / pages_req) * 100 : 100;
  if (hit >= 95) {
    return okResult({ id, title, bucket: 5, scope, summary: `hit=${hit.toFixed(1)}%`, reason: "\u7F13\u5B58\u547D\u4E2D\u7387\u6B63\u5E38", threshold_display: "\u2265 95%", citations: [{ title: "MongoDB WiredTiger", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" }] });
  }
  const severity = hit < 90 ? "critical" : "warning";
  return finding({
    id,
    title,
    severity,
    bucket: 5,
    scope,
    summary: `hit=${hit.toFixed(1)}% < ${severity === "critical" ? 90 : 95}%`,
    description: "\u4F4E\u7F13\u5B58\u547D\u4E2D\u7387\u5BFC\u81F4\u9891\u7E41\u78C1\u76D8\u8BFB\u53D6,\u653E\u5927 IOPS \u548C\u5EF6\u8FDF\u3002",
    reason: `pages_read=${pages_read} / pages_requested=${pages_req}`,
    threshold_display: "\u2265 95%",
    evidence: [
      { kind: "metric", value: `wt_pages_read=${pages_read}` },
      { kind: "metric", value: `wt_pages_requested=${pages_req}` }
    ],
    impact: { metric: "cache_miss_rate", value: +(100 - hit).toFixed(1), unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB WiredTiger \xB7 Cache and Eviction", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" }
    ],
    recommendations: [
      {
        action: "\u589E\u5927 wiredTigerCacheSizeGB(\u4E0D\u8D85\u8FC7\u7269\u7406\u5185\u5B58 50%)\xB7 \u6216\u6392\u67E5 working set \u662F\u5426\u66B4\u589E",
        rationale: "\u7F13\u5B58\u4E0D\u8DB3\u4EE5\u5BB9\u7EB3\u5DE5\u4F5C\u96C6,\u63D0\u5347 cache \u6216\u7F29\u51CF\u5DE5\u4F5C\u96C6",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true
      }
    ],
    rationale: {
      summary: "WT cache \u547D\u4E2D\u7387 < 95% \u8BF4\u660E\u5DE5\u4F5C\u96C6\u8D85\u51FA cache \u5BB9\u91CF \xB7 \u6BCF\u6B21 miss \u8D70 read() syscall \u62C9\u78C1\u76D8 \xB7 \u5EF6\u8FDF\u4ECE\u4E9A\u6BEB\u79D2\u8DC3\u5347\u5230\u6BEB\u79D2\u7EA7 \xB7 \u8BFB IOPS \u6309 miss \u7387\u653E\u5927\u5230\u5B58\u50A8\u5C42\u3002",
      mechanism: "mongod \u6BCF\u6B21\u8BFB\u8BF7\u6C42\u5148\u67E5 WT cache \xB7 miss \u5C31\u8C03 pread() \u4ECE\u78C1\u76D8\u62C9 page \xB7 \u5373\u4F7F SSD \u4E5F\u6709 100-500\u03BCs \u5EF6\u8FDF \xB7 \u662F cache hit (< 10\u03BCs) \u7684 10-50 \u500D\u3002cache \u5BB9\u91CF\u4E0D\u8DB3\u65F6 evict \u7EBF\u7A0B\u9891\u7E41\u6E05\u7406 dirty page \xB7 \u8FDB\u4E00\u6B65\u6D88\u8017 CPU \xB7 \u5F62\u6210\u6076\u6027\u5FAA\u73AF\u3002",
      trade_offs: "\u589E\u5927 cacheSizeGB \u51CF\u5C11 miss \u4F46\u53D7\u7269\u7406\u5185\u5B58\u4E0A\u9650\u7EA6\u675F(\u89C1 wt_cache_vs_memory \u89C4\u5219)\u3002\u538B\u7F29\u96C6\u5408\u6216\u52A0\u7D22\u5F15\u7F29\u5C0F\u5DE5\u4F5C\u96C6\u662F\u53E6\u4E00\u8DEF\u5F84 \xB7 \u4F46\u538B\u7F29\u63D0\u9AD8 CPU \u4F7F\u7528\u7387 \xB7 \u7D22\u5F15\u591A\u5360\u78C1\u76D8\u548C\u5199\u5165\u5F00\u9500\u3002",
      when_to_deviate: "\u6279\u5904\u7406 / OLAP workload \u672C\u8EAB\u6D41\u5F0F\u626B\u63CF \xB7 cache \u547D\u4E2D\u7387\u4F4E\u6B63\u5E38 \xB7 \u5173\u6CE8 pages evicted rate \u5373\u53EF\u3002OLTP \u573A\u666F < 95% \u5FC5\u987B\u6392\u67E5\u3002"
    }
  });
};
var check_oplog_window = (ctx) => {
  const id = "mongo.config.oplog_window_hours";
  const title = "Oplog \u4FDD\u7559\u7A97\u53E3";
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
      summary: "\u975E\u526F\u672C\u96C6 / \u672A\u80FD\u8BFB\u53D6 oplog",
      reason: "\u5355\u5B9E\u4F8B\u90E8\u7F72\u6216\u6743\u9650\u4E0D\u8DB3",
      skip_reason: "runtime_data_missing"
    });
  }
  if (hours >= 24) {
    return okResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: `oplog window=${hours.toFixed(1)}h`,
      reason: "Oplog \u7A97\u53E3\u5145\u8DB3(\u2265 24h)"
    });
  }
  return finding({
    id,
    title,
    severity: "critical",
    bucket: 2,
    scope,
    summary: `oplog window=${hours.toFixed(1)}h < 24h`,
    description: "Oplog \u7A97\u53E3\u8FC7\u77ED,\u8282\u70B9\u7EF4\u62A4\u6216\u5EF6\u8FDF\u6062\u590D\u53EF\u80FD\u89E6\u53D1\u5168\u91CF\u540C\u6B65",
    reason: `\u5F53\u524D\u7A97\u53E3 ${hours.toFixed(1)} \u5C0F\u65F6 \xB7 \u4F4E\u4E8E\u751F\u4EA7 24h \u63A8\u8350`,
    threshold_display: "\u2265 24h",
    evidence: [{ kind: "metric", value: `oplog_window_hours=${hours.toFixed(2)}` }],
    impact: { metric: "db_time_pct", value: 25, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB \xB7 Troubleshoot Replica Sets (Oplog window)", url: "https://www.mongodb.com/docs/manual/tutorial/troubleshoot-replica-sets/" }
    ],
    recommendations: [
      {
        action: "\u589E\u5927 replication.oplogSizeMB \u6216\u901A\u8FC7 replSetResizeOplog \u547D\u4EE4\u6269\u5BB9",
        rationale: "\u63D0\u4F9B\u5145\u88D5\u7684\u91CD\u65B0\u540C\u6B65\u7A97\u53E3",
        type: "prevent",
        fix_cost: "restart_engine",
        verifiable: false
      }
    ],
    rationale: {
      summary: "Oplog \u7A97\u53E3 < 24h \u65F6 \xB7 secondary \u7EF4\u62A4\u79BB\u7EBF\u8D85\u8FC7\u7A97\u53E3\u5C31\u5FC5\u987B initial sync \xB7 \u5BF9 TB \u7EA7\u5E93\u662F\u5C0F\u65F6\u7EA7\u505C\u673A\u98CE\u9669\u300224h \u662F MongoDB \u5B98\u65B9\u751F\u4EA7\u63A8\u8350\u4E0B\u9650\u3002",
      mechanism: "secondary \u901A\u8FC7 tailing primary \u7684 local.oplog.rs \u96C6\u5408\u590D\u5236\u6570\u636E\u3002oplog \u662F\u56FA\u5B9A\u5927\u5C0F capped collection \xB7 \u5199\u5165\u901F\u7387\u51B3\u5B9A\u7A97\u53E3\u65F6\u957F\u3002\u5F53 secondary \u79BB\u7EBF\u8D85\u8FC7\u7A97\u53E3 \xB7 \u5B83\u8981\u8BFB\u7684 oplog entries \u5DF2\u88AB\u8986\u76D6 \xB7 \u65E0\u6CD5\u589E\u91CF\u8FFD\u8D76 \xB7 \u89E6\u53D1\u5168\u91CF initial sync\u3002initial sync \u8D70\u5168\u91CF collection \u590D\u5236 + \u6240\u6709 index \u91CD\u5EFA \xB7 TB \u7EA7\u6570\u636E\u96C6\u901A\u5E38 6-12 \u5C0F\u65F6\u3002",
      trade_offs: "\u589E\u5927 oplog \u5360\u7528\u78C1\u76D8 \xB7 \u6BCF GB oplog \u2248 \u652F\u6301 1-2 \u5C0F\u65F6\u9AD8\u5CF0\u5199\u5165(\u53D6\u51B3\u5199\u5165\u901F\u7387)\u3002\u78C1\u76D8\u7A7A\u95F4\u6362\u8FD0\u7EF4\u5B89\u5168 \xB7 \u4E0D\u5F71\u54CD\u8BFB\u5199\u6027\u80FD\u3002",
      when_to_deviate: "\u5F00\u53D1\u73AF\u5883 / \u5141\u8BB8\u624B\u52A8 resync \u7684\u5C0F\u5E93 \xB7 oplog \u53EF\u77ED\u3002\u751F\u4EA7 OLTP \u5FC5\u987B \u2265 24h \xB7 \u9AD8\u5199\u5165\u6216\u8DE8\u673A\u623F\u573A\u666F\u5EFA\u8BAE 48-72h \u7ED9 DBA \u8DB3\u591F\u6392\u969C\u65F6\u95F4\u3002"
    }
  });
};
var check_compression_algorithm = (ctx) => {
  const id = "mongo.config.wt_block_compressor";
  const title = "WiredTiger \u5757\u538B\u7F29\u7B97\u6CD5";
  const skip = notMongoSkip(ctx, id, title, 2);
  if (skip) return skip;
  const scope = mongoScope(ctx);
  const compressor = dbVal(ctx, "_wt_block_compressor", "");
  if (!compressor) {
    return infoResult({ id, title, bucket: 2, scope, summary: "\u672A\u91C7\u96C6 compressor", reason: "\u53EF\u80FD\u4F7F\u7528\u5F15\u64CE\u9ED8\u8BA4 snappy" });
  }
  if (compressor !== "zlib") {
    return okResult({ id, title, bucket: 2, scope, summary: `compressor=${compressor}`, reason: "\u538B\u7F29\u7B97\u6CD5\u5408\u7406" });
  }
  const severityOnKunpeng = scope.vendor === "kunpeng" ? "warning" : "info";
  if (severityOnKunpeng === "info") {
    return infoResult({ id, title, bucket: 2, scope, summary: `compressor=zlib`, reason: "zlib \u538B\u7F29\u6BD4\u9AD8\u4F46 CPU \u5F00\u9500\u5927,\u975E\u9CB2\u9E4F\u73AF\u5883\u4EC5\u63D0\u793A" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 2,
    scope,
    summary: `compressor=zlib on ${scope.vendor}`,
    description: "zlib \u538B\u7F29\u5728 Kunpeng / ARM64 \u4E0A CPU \u6D88\u8017\u663E\u8457\u9AD8\u4E8E x86,FTDC \u4E2D deflate_slow \u70ED\u70B9\u660E\u663E\u3002",
    reason: "Kunpeng \u4E0A zlib \u538B\u7F29\u6210\u672C\u8FC7\u9AD8 \xB7 \u5EFA\u8BAE snappy \u6216 zstd",
    threshold_display: "snappy / zstd",
    evidence: [{ kind: "config", value: `wiredTigerCollectionBlockCompressor=zlib` }],
    impact: { metric: "db_time_pct", value: 20, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo
    ],
    recommendations: [
      {
        action: "\u5728 mongod.conf \u8BBE\u7F6E storage.wiredTiger.collectionConfig.blockCompressor: snappy (\u6216 zstd)",
        rationale: "Kunpeng \u4E0A\u66F4\u6362 compressor \u663E\u8457\u964D\u4F4E CPU \u538B\u529B",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true
      }
    ],
    rationale: {
      summary: "\u9CB2\u9E4F 920 \u4E0A zlib \u538B\u7F29/\u89E3\u538B\u5B8C\u5168\u8D70\u901A\u7528 ALU \u8DEF\u5F84 \xB7 \u6CA1\u6709 Intel ISA-L \u6216\u7B49\u4EF7\u7684\u786C\u4EF6\u538B\u7F29\u52A0\u901F \xB7 \u76F8\u540C\u541E\u5410\u4E0B CPU \u5360\u7528\u663E\u8457\u9AD8\u4E8E x86\u3002FTDC \u706B\u7130\u56FE\u4E2D deflate_slow \u5E38\u5E74\u5360 15-30% CPU \xB7 \u538B\u7F29\u5F00\u9500\u5403\u6389\u67E5\u8BE2 CPU \u9884\u7B97\u3002",
      mechanism: "zlib \u7684 deflate_slow \u5927\u91CF\u4F7F\u7528 sliding window \u67E5\u627E\u548C Huffman \u7F16\u7801 \xB7 \u7EAF CPU \u8BA1\u7B97 \xB7 ARM64 \u65E0\u5BF9\u5E94\u52A0\u901F ISA(\u9CB2\u9E4F\u6709 SMMU \u52A0\u5BC6\u52A0\u901F\u4F46\u4E0D\u8986\u76D6 compression)\u3002snappy \u662F byte-level LZ77 \xB7 zstd \u6709\u8F7B\u91CF dictionary \xB7 \u4E24\u8005\u90FD\u5BF9 ARM64 \u6307\u4EE4\u96C6\u53CB\u597D \xB7 \u5176\u4E2D snappy \u89E3\u538B\u53EF SIMD \u5316\u8FDB\u4E00\u6B65\u51CF\u5F00\u9500\u3002",
      trade_offs: "snappy \u538B\u7F29\u6BD4 ~2x \xB7 zlib ~3x \xB7 zstd ~3.2x \xB7 zstd \u538B\u7F29\u6BD4\u63A5\u8FD1 zlib \u4F46 CPU \u53EA\u7528 zlib \u7684 50-70%\u3002\u78C1\u76D8\u5360\u7528\u5207\u6362\u540E\u53EF\u80FD\u4E0A\u5347 40-50% \xB7 \u4F46\u6362\u6765 CPU \u9884\u7B97\u53EF\u4EE5\u6D88\u5316\u66F4\u591A QPS\u3002NVMe \u573A\u666F\u78C1\u76D8\u6210\u672C\u8FDC\u4F4E\u4E8E CPU\u3002",
      when_to_deviate: "\u5F52\u6863\u96C6\u5408\u8BFB\u5199\u6781\u5C11 \xB7 \u53EF\u4FDD\u7559 zlib \u7701\u78C1\u76D8\u3002\u70ED\u6570\u636E\u96C6\u5408\u5F3A\u70C8\u63A8\u8350 snappy \u6216 zstd\u3002MongoDB 4.2+ \u539F\u751F\u652F\u6301 zstd \xB7 3.x \u53EA zlib/snappy \u53EF\u9009\u3002"
    }
  });
};
var check_db_cache_vs_memory = (ctx) => {
  const id = "mongo.config.db_cache_vs_total_mem";
  const title = "DB \u7F13\u5B58 vs \u7269\u7406\u5185\u5B58";
  const scope = mongoScope(ctx);
  const total_mem = toInt(osVal(ctx, "total_mem_mb", 0), 0);
  const shared = toInt(dbVal(ctx, "shared_buffers_mb", 0), 0);
  if (total_mem === 0 || shared === 0) {
    return okResult({ id, title, bucket: 2, scope, summary: `total=${total_mem}MB \xB7 buffer=${shared}MB`, reason: "\u672A\u91C7\u96C6\u5230\u6216\u7F13\u5B58\u8BBE\u7F6E\u5408\u7406" });
  }
  if (shared <= total_mem) {
    return okResult({ id, title, bucket: 2, scope, summary: `total=${total_mem}MB \xB7 buffer=${shared}MB`, reason: "\u7F13\u5B58\u672A\u8D85\u7269\u7406\u5185\u5B58" });
  }
  return finding({
    id,
    title,
    severity: "critical",
    bucket: 2,
    scope,
    summary: `DB buffer ${shared}MB > OS total ${total_mem}MB`,
    description: "DB \u7F13\u5B58\u8BBE\u7F6E\u8D85\u8FC7\u7269\u7406\u5185\u5B58,\u5FC5\u7136 OOM",
    reason: `shared_buffers=${shared}MB > total_mem=${total_mem}MB`,
    threshold_display: "\u2264 \u7269\u7406\u5185\u5B58",
    evidence: [
      { kind: "metric", value: `total_mem_mb=${total_mem}` },
      { kind: "metric", value: `shared_buffers_mb=${shared}` }
    ],
    impact: { metric: "cache_miss_rate", value: 100, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB WiredTiger \xB7 cache sizing", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" }
    ],
    recommendations: [
      {
        action: "\u8C03\u4F4E wiredTigerCacheSizeGB \u81F3 mem*0.5 \u4EE5\u4E0B",
        rationale: "\u907F\u514D OOM \u89E6\u53D1 OOM Killer \u6740\u6389 mongod",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true
      }
    ]
  });
};
var check_storage_journaling_enabled = (ctx) => {
  const id = "mongo.storage.journaling_enabled";
  const title = "MongoDB journaling \u542F\u7528";
  const skip = notMongoSkip(ctx, id, title, 2);
  if (skip) return skip;
  const scope = mongoScope(ctx);
  const se = dbVal(ctx, "storageEngine", {});
  const persistent = se["persistent"];
  if (persistent === void 0 || persistent === null) {
    return infoResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: "\u672A\u91C7\u96C6 storageEngine.persistent",
      reason: "serverStatus.storageEngine \u4E3A\u7A7A\u6216\u6743\u9650\u4E0D\u8DB3",
      skip_reason: "runtime_data_missing"
    });
  }
  if (persistent === true) {
    return okResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: "storageEngine.persistent=true",
      reason: "\u6301\u4E45\u5316\u5F15\u64CE\u5DF2\u542F\u7528,journaling \u6709\u6548",
      threshold_display: "== true",
      citations: [{ title: "MongoDB Journaling", url: "https://www.mongodb.com/docs/manual/core/journaling/" }]
    });
  }
  return finding({
    id,
    title,
    severity: "critical",
    bucket: 2,
    scope,
    summary: "storageEngine.persistent=false \xB7 journaling \u672A\u751F\u6548",
    description: "journaling \u672A\u542F\u7528\u65F6,\u4E0A\u4E00\u4E2A checkpoint \u4E4B\u540E\u7684\u5199\u5165\u5728\u5F02\u5E38\u65AD\u7535/kill \u540E\u4F1A\u6C38\u4E45\u4E22\u5931;MongoDB \u660E\u786E\u8981\u6C42\u751F\u4EA7\u5F00\u542F",
    reason: "serverStatus.storageEngine.persistent \u4E3A false",
    threshold_display: "== true",
    evidence: [{ kind: "metric", value: `storageEngine.persistent=${persistent}` }],
    impact: { metric: "db_time_pct", value: 50, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Journaling", url: "https://www.mongodb.com/docs/manual/core/journaling/" }
    ],
    recommendations: [
      {
        action: "\u5728 mongod.conf \u8BBE storage.journal.enabled: true \u5E76\u91CD\u542F\u5B9E\u4F8B",
        rationale: "\u907F\u514D\u5F02\u5E38\u6389\u7535\u4E22\u5931\u5DF2\u63D0\u4EA4\u5199",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true
      }
    ]
  });
};
function pickTicketsSubtree(ss, kind) {
  const wt = ss.db_metrics["wiredTiger"] ?? {};
  const ct = wt["concurrentTransactions"] ?? {};
  const ctSub = ct[kind] ?? {};
  const a = toInt(ctSub["available"], -1);
  const o = toInt(ctSub["out"], -1);
  const t = toInt(ctSub["totalTickets"], -1);
  if (a >= 0 && o >= 0) {
    return { available: a, out: o, totalTickets: t > 0 ? t : a + o };
  }
  const q = ss.db_metrics["queues"] ?? {};
  const qe = q["execution"] ?? {};
  const qk = qe[kind] ?? {};
  const a2 = toInt(qk["available"], -1);
  const o2 = toInt(qk["out"], -1);
  const t2 = toInt(qk["totalTickets"], -1);
  if (a2 >= 0) {
    return { available: a2, out: Math.max(o2, 0), totalTickets: t2 > 0 ? t2 : a2 + Math.max(o2, 0) };
  }
  return null;
}
function makeTicketCheck(kind) {
  return (ctx) => {
    const id = `mongo.runtime.wt_ticket_${kind}`;
    const title = `WiredTiger ${kind === "read" ? "\u8BFB" : "\u5199"}\u7968\u8BC1`;
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
        summary: "\u672A\u91C7\u96C6\u5230\u7968\u8BC1\u6307\u6807",
        reason: "serverStatus.wiredTiger.concurrentTransactions / queues.execution \u5747\u4E0D\u53EF\u8BFB",
        skip_reason: "runtime_data_missing"
      });
    }
    const { available, out, totalTickets } = t;
    const total = totalTickets > 0 ? totalTickets : Math.max(available + out, 1);
    const utilPct = total > 0 ? out / total * 100 : 0;
    if (available > 0 && utilPct < 90) {
      return okResult({
        id,
        title,
        bucket: 5,
        scope,
        summary: `out=${out} / total=${total} \xB7 ${utilPct.toFixed(0)}%`,
        reason: "\u7968\u8BC1\u8D44\u6E90\u5145\u8DB3",
        threshold_display: "available > 0 && util < 90%",
        citations: [{ title: "MongoDB \xB7 WiredTiger Tickets", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" }]
      });
    }
    const severity = available === 0 ? "critical" : "warning";
    return finding({
      id,
      title,
      severity,
      bucket: 5,
      scope,
      summary: `${kind} tickets out=${out} / total=${total} \xB7 \u53EF\u7528 ${available}`,
      description: `WiredTiger ${kind} \u5E76\u53D1 ${kind === "read" ? "\u8BFB" : "\u5199"}\u7968\u8BC1\u63A5\u8FD1\u8017\u5C3D \xB7 \u65B0\u8BF7\u6C42\u88AB storage engine \u6392\u961F \xB7 \u5EF6\u8FDF\u6025\u5267\u653E\u5927`,
      reason: available === 0 ? `${kind}.available=0 \xB7 \u6240\u6709 ${total} \u5F20\u7968\u8BC1\u5747\u5DF2\u53D1\u51FA,\u540E\u7EED\u8BF7\u6C42 100% \u6392\u961F` : `${kind} \u4F7F\u7528\u7387 ${utilPct.toFixed(0)}% \xB7 \u9AD8\u4E8E 90% \u9608\u503C`,
      threshold_display: "available > 0 \xB7 util < 90%",
      evidence: [
        { kind: "metric", value: `wt_${kind}_tickets_out=${out}` },
        { kind: "metric", value: `wt_${kind}_tickets_available=${available}` }
      ],
      impact: { metric: "latency_p95_ms", value: available === 0 ? 60 : 20, unit: "percent", confidence: "high" },
      citations: [
        KUNPENG_REFS.boostkitMongo,
        { title: "MongoDB \xB7 WiredTiger Tickets & Concurrency", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" }
      ],
      recommendations: [
        {
          action: kind === "read" ? "db.adminCommand({setParameter:1, storageEngineConcurrentReadTransactions: 256})" : "db.adminCommand({setParameter:1, storageEngineConcurrentWriteTransactions: 256})",
          rationale: `\u6269\u5BB9 WT ${kind} \u5E76\u53D1\u7968\u8BC1\u5230 256(\u9ED8\u8BA4 128);\u540C\u65F6\u6392\u67E5\u6162\u67E5\u8BE2 / \u9501\u963B\u585E`,
          type: "mitigate",
          fix_cost: "trivial",
          verifiable: true
        }
      ]
    });
  };
}
var check_wt_ticket_read = makeTicketCheck("read");
var check_wt_ticket_write = makeTicketCheck("write");
var check_tcmalloc_per_cpu = (ctx) => {
  const id = "mongo.config.tcmalloc_per_cpu_caches";
  const title = "tcmalloc per-CPU caches";
  const skip = notMongoSkip(ctx, id, title, 2);
  if (skip) return skip;
  const scope = mongoScope(ctx);
  const tc = dbVal(ctx, "tcmalloc", {});
  const using = tc["usingPerCPUCaches"];
  if (using === void 0 || using === null) {
    return infoResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: "\u672A\u91C7\u96C6 tcmalloc.usingPerCPUCaches",
      reason: "\u53EF\u80FD\u4F7F\u7528 tcmalloc-gperftools(MongoDB < 8.0)\xB7 \u672A\u66B4\u9732\u8BE5\u5B57\u6BB5"
    });
  }
  if (using === true) {
    return okResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: "usingPerCPUCaches=true",
      reason: "tcmalloc \u5DF2\u542F\u7528 per-CPU caches",
      threshold_display: "== true",
      citations: [{ title: "MongoDB \xB7 tcmalloc-google", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }]
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 2,
    scope,
    summary: "usingPerCPUCaches=false",
    description: "tcmalloc \u56DE\u9000\u5230 per-thread caches \xB7 \u9AD8\u5E76\u53D1\u5206\u914D\u573A\u666F\u4E0B\u5185\u5B58\u788E\u7247\u548C\u5206\u914D\u5EF6\u8FDF\u5347\u9AD8 \xB7 MongoDB 8.0+ \u9ED8\u8BA4\u671F\u671B per-CPU caches",
    reason: "serverStatus.tcmalloc.usingPerCPUCaches \u4E3A false(\u901A\u5E38\u662F kernel < 4.18 \u6216 glibc rseq \u5173\u95ED)",
    threshold_display: "== true",
    evidence: [{ kind: "metric", value: "tcmalloc.usingPerCPUCaches=false" }],
    impact: { metric: "throughput_qps", value: 8, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB \xB7 tcmalloc-google", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }
    ],
    recommendations: [
      {
        action: "\u786E\u8BA4 kernel \u2265 4.18 \u4E14\u672A\u8BBE GLIBC_TUNABLES=glibc.pthread.rseq=0 \xB7 \u5FC5\u8981\u65F6\u91CD\u542F mongod",
        rationale: "\u5141\u8BB8 tcmalloc \u542F\u7528 per-CPU caches \xB7 \u63D0\u5347\u9AD8\u5E76\u53D1\u5206\u914D\u6548\u7387",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true
      }
    ]
  });
};
var check_sharded_index_consistency = (ctx) => {
  const id = "mongo.runtime.sharded_index_consistency";
  const title = "\u5206\u7247\u7D22\u5F15\u4E00\u81F4\u6027";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);
  const raw = dbVal(ctx, "shardedIndexConsistency", {});
  let inconsistent = 0;
  if (typeof raw === "number") {
    inconsistent = raw;
  } else if (raw && typeof raw === "object") {
    inconsistent = toInt(raw["numShardedCollectionsWithInconsistentIndexes"] ?? 0, 0);
  }
  if (raw === void 0 || raw === null || typeof raw === "object" && Object.keys(raw).length === 0) {
    return infoResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "\u975E sharded cluster \u6216\u672A\u91C7\u96C6",
      reason: "\u5355\u5B9E\u4F8B / \u526F\u672C\u96C6\u4E0D\u8F93\u51FA shardedIndexConsistency \u5B57\u6BB5",
      skip_reason: "runtime_data_missing"
    });
  }
  if (inconsistent === 0) {
    return okResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "0 \u4E2A\u4E0D\u4E00\u81F4\u96C6\u5408",
      reason: "\u6240\u6709 sharded collection \u7D22\u5F15\u5728\u5404 shard \u4E00\u81F4",
      threshold_display: "== 0",
      citations: [{ title: "MongoDB \xB7 Sharded Index Consistency", url: "https://www.mongodb.com/docs/manual/tutorial/manage-indexes/" }]
    });
  }
  return finding({
    id,
    title,
    severity: "critical",
    bucket: 5,
    scope,
    summary: `${inconsistent} \u4E2A sharded collection \u7D22\u5F15\u4E0D\u4E00\u81F4`,
    description: "\u4E0D\u4E00\u81F4\u7D22\u5F15\u4F1A\u5BFC\u81F4\u67E5\u8BE2\u5728\u4E0D\u540C shard \u8FD4\u56DE\u4E0D\u540C\u7ED3\u679C\u6216\u6267\u884C\u8BA1\u5212\u504F\u79BB \xB7 MongoDB \u660E\u786E\u544A\u8B66\u6B64\u9879",
    reason: `shardedIndexConsistency.numShardedCollectionsWithInconsistentIndexes=${inconsistent}`,
    threshold_display: "== 0",
    evidence: [{ kind: "metric", value: `shardedIndexConsistency=${inconsistent}` }],
    impact: { metric: "db_time_pct", value: 20, unit: "percent", confidence: "high" },
    citations: [
      { title: "MongoDB \xB7 shardedIndexConsistency \xB7 Manage Indexes", url: "https://www.mongodb.com/docs/manual/tutorial/manage-indexes/" }
    ],
    recommendations: [
      {
        action: "mongos \u4FA7\u7528 db.collection.createIndex() \u91CD\u5EFA \xB7 \u6216 sh.reshardCollection \u540E\u91CD\u5EFA",
        rationale: "\u7EDF\u4E00\u5206\u7247\u7D22\u5F15\u5B9A\u4E49 \xB7 \u6062\u590D\u6B63\u786E\u67E5\u8BE2\u8DEF\u7531",
        type: "repair",
        fix_cost: "schema_migration",
        verifiable: true
      }
    ]
  });
};
var check_global_lock_queue = (ctx) => {
  const id = "mongo.runtime.global_lock_queue";
  const title = "Global lock \u961F\u5217";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);
  const gl = dbVal(ctx, "globalLock", {});
  const cq = gl["currentQueue"] ?? {};
  const total = toInt(cq["total"] ?? -1, -1);
  const readers = toInt(cq["readers"] ?? 0, 0);
  const writers = toInt(cq["writers"] ?? 0, 0);
  if (total < 0) {
    return infoResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "\u672A\u91C7\u96C6 globalLock.currentQueue",
      reason: "serverStatus.globalLock \u4E3A\u7A7A"
    });
  }
  if (total === 0) {
    return okResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "globalLock \u961F\u5217\u7A7A\u95F2",
      reason: "\u65E0\u8BF7\u6C42\u963B\u585E\u5728 global lock",
      threshold_display: "== 0",
      citations: [{ title: "MongoDB \xB7 serverStatus.globalLock", url: "https://www.mongodb.com/docs/manual/reference/command/serverStatus/#globalLock" }]
    });
  }
  const severity = total > 100 ? "critical" : "warning";
  return finding({
    id,
    title,
    severity,
    bucket: 5,
    scope,
    summary: `globalLock queue total=${total}(\u8BFB ${readers} \xB7 \u5199 ${writers})`,
    description: "global lock \u961F\u5217\u975E\u96F6\u8BF4\u660E\u6709\u8BF7\u6C42\u88AB\u963B\u585E\u7B49\u5F85\u9501 \xB7 \u6301\u7EED\u975E\u96F6\u610F\u5473\u7740\u9501\u7ADE\u4E89\u5DF2\u6210\u74F6\u9888",
    reason: `globalLock.currentQueue.total=${total}`,
    threshold_display: "== 0",
    evidence: [
      { kind: "metric", value: `globalLock.currentQueue.total=${total}` },
      { kind: "metric", value: `readers=${readers}` },
      { kind: "metric", value: `writers=${writers}` }
    ],
    impact: { metric: "latency_p95_ms", value: total > 100 ? 50 : 20, unit: "percent", confidence: "high" },
    citations: [
      { title: "MongoDB \xB7 serverStatus.globalLock", url: "https://www.mongodb.com/docs/manual/reference/command/serverStatus/#globalLock" }
    ],
    recommendations: [
      {
        action: "\u6392\u67E5\u957F\u65F6\u95F4\u8FD0\u884C\u7684\u5199\u4E8B\u52A1 / index build \xB7 \u68C0\u67E5\u662F\u5426\u6709 db-level lock \u64CD\u4F5C(collMod / createIndex foreground)",
        rationale: "global lock \u901A\u5E38\u7531\u663E\u5F0F admin \u64CD\u4F5C\u6216\u6162\u4E8B\u52A1\u5F15\u8D77",
        type: "investigate",
        fix_cost: "trivial",
        verifiable: false
      }
    ]
  });
};
var check_current_op_slow = (ctx) => {
  const id = "mongo.runtime.current_op_slow";
  const title = "currentOp \u6162\u64CD\u4F5C";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);
  const co = dbVal(ctx, "currentOp", {});
  const active = toInt(co["active_count"] ?? 0, 0);
  const slow = toInt(co["slow_count"] ?? 0, 0);
  const top = toInt(co["top_slow_secs"] ?? 0, 0);
  if (slow === 0) {
    return okResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: `active=${active} \xB7 slow=0`,
      reason: "\u65E0\u8D85\u8FC7 3s \u7684\u6D3B\u8DC3\u64CD\u4F5C",
      threshold_display: "slow_count == 0",
      citations: [{ title: "MongoDB \xB7 db.currentOp()", url: "https://www.mongodb.com/docs/manual/reference/method/db.currentOp/" }]
    });
  }
  const severity = top > 60 ? "critical" : "warning";
  return finding({
    id,
    title,
    severity,
    bucket: 5,
    scope,
    summary: `slow_count=${slow} \xB7 \u6700\u957F ${top}s`,
    description: "\u6D3B\u8DC3 op \u4E2D\u5B58\u5728\u8D85\u8FC7 3s \u7684\u8BF7\u6C42 \xB7 \u6700\u957F\u8FBE " + top + "s \xB7 \u53EF\u80FD\u662F\u6162\u67E5\u8BE2 / \u7D22\u5F15\u6784\u5EFA / \u8DE8\u5206\u7247\u805A\u5408",
    reason: `currentOp.slow_count=${slow} \xB7 top_slow_secs=${top}`,
    threshold_display: "slow_count == 0",
    evidence: [
      { kind: "metric", value: `currentOp.slow_count=${slow}` },
      { kind: "metric", value: `currentOp.top_slow_secs=${top}` },
      { kind: "metric", value: `currentOp.active_count=${active}` }
    ],
    impact: { metric: "latency_p95_ms", value: top > 60 ? 50 : 15, unit: "percent", confidence: "medium" },
    citations: [
      { title: "MongoDB \xB7 db.currentOp()", url: "https://www.mongodb.com/docs/manual/reference/method/db.currentOp/" }
    ],
    recommendations: [
      {
        action: "db.currentOp({secs_running: {$gt: 3}}) \u9010\u6761 explain \xB7 \u5BF9\u6162\u67E5\u8BE2\u52A0\u7D22\u5F15 \xB7 \u53D6\u6D88\u65E0\u610F\u4E49\u957F\u8DD1 op",
        rationale: "\u6162 op \u6301\u7EED\u5360\u7968\u8BC1 \xB7 \u653E\u5927\u6574\u4F53\u5EF6\u8FDF",
        type: "investigate",
        fix_cost: "trivial",
        verifiable: true
      }
    ]
  });
};
var check_connections_available = (ctx) => {
  const id = "mongo.runtime.connections_available";
  const title = "\u8FDE\u63A5\u53EF\u7528\u4F59\u91CF";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);
  const raw = dbVal(ctx, "connections", {});
  const current = toInt(raw["current"] ?? 0, 0);
  const available = toInt(raw["available"] ?? -1, -1);
  if (available < 0) {
    return infoResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "\u672A\u91C7\u96C6 connections.available",
      reason: "serverStatus.connections.available \u7F3A\u5931"
    });
  }
  const total = current + available;
  const usedPct = total > 0 ? current / total * 100 : 0;
  if (usedPct < 80) {
    return okResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: `current=${current} \xB7 available=${available} \xB7 ${usedPct.toFixed(0)}%`,
      reason: "\u8FDE\u63A5\u4F59\u91CF\u5145\u8DB3",
      threshold_display: "used < 80%",
      citations: [{ title: "MongoDB \xB7 connections", url: "https://www.mongodb.com/docs/manual/reference/command/serverStatus/#connections" }]
    });
  }
  const severity = usedPct >= 95 ? "critical" : "warning";
  return finding({
    id,
    title,
    severity,
    bucket: 5,
    scope,
    summary: `connections \u4F7F\u7528\u7387 ${usedPct.toFixed(0)}%(current=${current} \xB7 available=${available})`,
    description: "\u8FDE\u63A5\u6C60\u63A5\u8FD1 net.maxIncomingConnections \u4E0A\u9650 \xB7 \u65B0\u8BF7\u6C42\u53EF\u80FD\u88AB\u62D2\u7EDD\u6216\u5BA2\u6237\u7AEF\u91CD\u8FDE\u98CE\u66B4",
    reason: `connections.current / (current + available) = ${usedPct.toFixed(1)}%`,
    threshold_display: "used < 80%",
    evidence: [
      { kind: "metric", value: `connections.current=${current}` },
      { kind: "metric", value: `connections.available=${available}` }
    ],
    impact: { metric: "connection_util_pct", value: +usedPct.toFixed(1), unit: "percent", confidence: "high" },
    citations: [
      { title: "MongoDB \xB7 connections \xB7 net.maxIncomingConnections", url: "https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.maxIncomingConnections" }
    ],
    recommendations: [
      {
        action: "\u8C03\u9AD8 net.maxIncomingConnections \u6216\u6392\u67E5\u5BA2\u6237\u7AEF\u8FDE\u63A5\u6CC4\u9732 \xB7 \u7F29\u5C0F\u5BA2\u6237\u7AEF maxPoolSize",
        rationale: "\u907F\u514D\u63A5\u8FD1\u4E0A\u9650\u88AB\u62D2\u8FDE\u63A5\u5F15\u53D1\u5E94\u7528\u8D85\u65F6",
        type: "mitigate",
        fix_cost: "restart_engine",
        verifiable: true
      }
    ]
  });
};
var check_asserts_warning = (ctx) => {
  const id = "mongo.runtime.asserts_warning_total";
  const title = "Asserts.warning \u7D2F\u8BA1";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);
  const a = dbVal(ctx, "asserts", {});
  const warning = toInt(a["warning"] ?? -1, -1);
  const regular = toInt(a["regular"] ?? 0, 0);
  const msg = toInt(a["msg"] ?? 0, 0);
  if (warning < 0) {
    return infoResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "\u672A\u91C7\u96C6 asserts",
      reason: "serverStatus.asserts \u7F3A\u5931"
    });
  }
  if (warning === 0 && regular === 0) {
    return okResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "0 assert \xB7 \u5B9E\u4F8B\u5E72\u51C0",
      reason: "\u81EA mongod \u542F\u52A8\u4EE5\u6765\u65E0 assert \u8BB0\u5F55",
      threshold_display: "warning == 0",
      citations: [{ title: "MongoDB \xB7 serverStatus.asserts", url: "https://www.mongodb.com/docs/manual/reference/command/serverStatus/#asserts" }]
    });
  }
  return infoResult({
    id,
    title,
    bucket: 5,
    scope,
    summary: `\u7D2F\u8BA1:warning=${warning} \xB7 regular=${regular} \xB7 msg=${msg}`,
    reason: "serverStatus.asserts \u662F\u542F\u52A8\u4EE5\u6765\u7D2F\u8BA1\u503C \xB7 \u5927\u6570\u4E0D\u4E00\u5B9A\u662F\u5F53\u524D\u95EE\u9898 \xB7 \u5EFA\u8BAE\u7ED3\u5408 mongod.log \u65F6\u95F4\u6233\u6392\u67E5",
    citations: [{ title: "MongoDB \xB7 serverStatus.asserts", url: "https://www.mongodb.com/docs/manual/reference/command/serverStatus/#asserts" }]
  });
};
var check_wt_cache_dirty_pct = (ctx) => {
  const id = "mongo.runtime.wt_cache_dirty_pct";
  const title = "WT Cache dirty \u6BD4\u4F8B";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);
  const detail = dbVal(ctx, "_wt_cache_detail", {});
  const dirty = toInt(detail["tracked dirty bytes in the cache"] ?? -1, -1);
  const inCache = toInt(detail["bytes currently in the cache"] ?? 0, 0);
  if (dirty < 0 || inCache === 0) {
    return infoResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "\u672A\u91C7\u96C6 WT cache dirty \u5B57\u6BB5",
      reason: "wiredTiger.cache \u7F3A\u5C11 dirty \u5B57\u6BB5"
    });
  }
  const pct = dirty / inCache * 100;
  if (pct <= 20) {
    return okResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: `dirty=${pct.toFixed(1)}%`,
      reason: "\u810F\u6570\u636E\u6BD4\u4F8B\u6B63\u5E38(WT eviction \u672A\u89E6\u53D1 target \u9608\u503C)",
      threshold_display: "\u2264 20%",
      citations: [{ title: "MongoDB \xB7 WT eviction", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" }]
    });
  }
  const severity = pct > 30 ? "critical" : "warning";
  return finding({
    id,
    title,
    severity,
    bucket: 5,
    scope,
    summary: `WT dirty=${pct.toFixed(1)}% \u8D85 20% eviction \u9608\u503C`,
    description: "WT cache \u810F\u9875\u6BD4\u4F8B\u8D85\u8FC7 eviction trigger(20% dirty target \xB7 30% hard)\xB7 \u5199 worker \u4F1A\u88AB stall \u53C2\u4E0E\u6E05\u7406",
    reason: `tracked_dirty_bytes / bytes_in_cache = ${pct.toFixed(1)}%`,
    threshold_display: "\u2264 20%",
    evidence: [
      { kind: "metric", value: `wt_dirty_bytes=${dirty}` },
      { kind: "metric", value: `wt_in_cache_bytes=${inCache}` }
    ],
    impact: { metric: "latency_p95_ms", value: pct > 30 ? 40 : 20, unit: "percent", confidence: "medium" },
    citations: [
      { title: "MongoDB \xB7 WT eviction \xB7 dirty target 20%", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" }
    ],
    recommendations: [
      {
        action: "\u589E\u52A0 wiredTigerCacheSizeGB \xB7 \u6216\u8C03\u5927 eviction_dirty_trigger \xB7 \u6216\u964D\u4F4E\u5199\u5165\u901F\u7387",
        rationale: "\u810F\u9875\u8FC7\u591A\u89E6\u53D1 eviction storm \xB7 \u5199 worker \u88AB\u62C9\u53BB\u6E05\u7406\u5BFC\u81F4\u5E94\u7528\u5199 stall",
        type: "mitigate",
        fix_cost: "trivial",
        verifiable: true
      }
    ]
  });
};
var check_mongo_arm64_microarch = (ctx) => {
  const id = "mongo.platform.arm64_microarch";
  const title = "ARM64 \u5FAE\u67B6\u6784\u8981\u6C42";
  const skip = notMongoSkip(ctx, id, title, 1);
  if (skip) return skip;
  const scope = mongoScope(ctx);
  if (scope.arch !== "arm64") {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "\u975E arm64 \u5E73\u53F0",
      reason: `arch=${scope.arch ?? "unknown"}`,
      skip_reason: "arch_mismatch"
    });
  }
  const vendor = scope.vendor ?? "unknown";
  const cpuModel = osVal(ctx, "cpu_model", "unknown");
  return infoResult({
    id,
    title,
    bucket: 1,
    scope,
    summary: `arm64 \xB7 vendor=${vendor} \xB7 ${cpuModel}`,
    reason: "MongoDB 8.0+ \u8981\u6C42 ARMv8.2-A \xB7 \u9CB2\u9E4F 920 / Graviton 2+ / Ampere Altra \u539F\u751F\u6EE1\u8DB3 \xB7 \u65E9\u671F Armv8.0 \u82AF\u7247\u4E0D\u652F\u6301",
    threshold_display: "ARMv8.2-A \u6216\u66F4\u9AD8",
    citations: [
      { title: "MongoDB 8.0 \xB7 Production Notes \xB7 arm64 microarchitecture", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }
    ]
  });
};
var check_wt_cache_pct_kunpeng = (ctx) => {
  const id = "mongo.config.wt_cache_pct_kunpeng";
  const title = "WT Cache \u5360\u7269\u7406\u5185\u5B58\u6BD4\u4F8B \xB7 \u9CB2\u9E4F";
  const skip = notMongoSkip(ctx, id, title, 2);
  if (skip) return skip;
  const scope = mongoScope(ctx);
  if (scope.vendor !== "kunpeng") {
    return infoResult({ id, title, bucket: 2, scope, summary: "\u4EC5\u9CB2\u9E4F\u573A\u666F", reason: `vendor=${scope.vendor ?? "unknown"}` });
  }
  const total_mem_mb = toInt(osVal(ctx, "total_mem_mb", 0), 0);
  const wt_bytes = toInt(dbVal(ctx, "wt_cache_maximum_bytes", 0), 0);
  if (total_mem_mb === 0 || wt_bytes === 0) {
    return infoResult({ id, title, bucket: 2, scope, summary: "WT cache \u6216\u7269\u7406\u5185\u5B58\u672A\u91C7\u96C6", reason: "wt_cache_maximum_bytes \u6216 total_mem_mb \u4E3A 0" });
  }
  const pct = wt_bytes / (total_mem_mb * 1024 * 1024) * 100;
  if (pct >= 40 && pct <= 60) {
    return okResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: `WT=${pct.toFixed(1)}% \xB7 \u843D\u5728\u63A8\u8350 40-60% \u533A\u95F4`,
      reason: "\u9CB2\u9E4F BoostKit \u63A8\u8350\u533A\u95F4 \xB7 \u7559\u8DB3\u5185\u5B58\u7ED9\u8FDE\u63A5\u6808 / page cache",
      threshold_display: "40% \u2264 pct \u2264 60%",
      citations: [{ title: "\u9CB2\u9E4F BoostKit \xB7 MongoDB \u8C03\u4F18 \xB7 cacheSizeGB", url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html" }]
    });
  }
  if (pct < 40) {
    return infoResult({
      id,
      title,
      bucket: 2,
      scope,
      summary: `WT=${pct.toFixed(1)}% \u504F\u4F4E`,
      reason: "WT cache \u5360\u6BD4 < 40% \xB7 \u53EF\u80FD\u5DE5\u4F5C\u96C6\u53D7\u9650 \xB7 \u82E5 working set \u5927\u4E8E cache \u4F1A\u964D\u4F4E\u547D\u4E2D\u7387",
      threshold_display: "40% \u2264 pct \u2264 60%",
      citations: [{ title: "\u9CB2\u9E4F BoostKit \xB7 MongoDB \u8C03\u4F18", url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html" }]
    });
  }
  const severity = pct > 80 ? "critical" : "warning";
  return finding({
    id,
    title,
    severity,
    bucket: 2,
    scope,
    summary: `WT=${pct.toFixed(1)}% \xB7 \u9CB2\u9E4F\u5EFA\u8BAE \u2264 60%`,
    description: "\u9CB2\u9E4F BoostKit MongoDB \u8C03\u4F18\u63A8\u8350 cacheSizeGB \u2248 (mem-1GB)*0.5 \xB7 \u4E0D\u8D85\u8FC7 60% \u7269\u7406\u5185\u5B58 \xB7 80% \u662F\u786C\u4E0A\u9650",
    reason: `WT cache \u5360\u6BD4 ${pct.toFixed(1)}% \xB7 \u9AD8\u4E8E\u9CB2\u9E4F\u63A8\u8350 60%`,
    threshold_display: "40% \u2264 pct \u2264 60%",
    evidence: [
      { kind: "metric", value: `wt_cache_bytes=${wt_bytes}` },
      { kind: "metric", value: `total_mem_mb=${total_mem_mb}` }
    ],
    impact: { metric: "cache_miss_rate", value: 15, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo
    ],
    recommendations: [
      {
        action: "\u8C03\u4F4E wiredTigerCacheSizeGB \u81F3 (mem-1GB)*0.5 \u4EE5\u5185 \xB7 \u91CA\u653E\u5185\u5B58\u7ED9\u8FDE\u63A5\u6808 / page cache",
        rationale: "\u5BF9\u9F50\u9CB2\u9E4F BoostKit MongoDB \u63A8\u8350\u533A\u95F4",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true
      }
    ]
  });
};
var check_wt_pages_read_volume = (ctx) => {
  const id = "mongo.runtime.wt_pages_read_volume";
  const title = "WT \u7D2F\u8BA1 page-read \u91CF";
  const skip = notMongoSkip(ctx, id, title, 5);
  if (skip) return skip;
  const scope = mongoScope(ctx);
  const detail = dbVal(ctx, "_wt_cache_detail", {});
  const pages_read = toInt(detail["pages read into cache"] ?? -1, -1);
  const pages_req = toInt(detail["pages requested from the cache"] ?? 0, 0);
  if (pages_read < 0) {
    return infoResult({
      id,
      title,
      bucket: 5,
      scope,
      summary: "\u672A\u91C7\u96C6 pages read into cache",
      reason: "wiredTiger.cache \u7F3A\u5931"
    });
  }
  return infoResult({
    id,
    title,
    bucket: 5,
    scope,
    summary: `\u7D2F\u8BA1 pages read=${pages_read} \xB7 requested=${pages_req}`,
    reason: "\u542F\u52A8\u4EE5\u6765\u4ECE\u78C1\u76D8\u52A0\u8F7D\u5230 WT cache \u7684\u7D2F\u8BA1\u9875\u6570 \xB7 \u5927\u6570\u4E0D\u76F4\u63A5\u610F\u5473\u95EE\u9898 \xB7 \u4E0E cache hit rate \u914D\u5408\u770B",
    citations: [{ title: "MongoDB \xB7 WT pages read", url: "https://www.mongodb.com/docs/manual/core/wiredtiger/" }]
  });
};
var mongoChecks = [
  check_mongo_connections,
  check_wt_cache_vs_memory,
  check_wt_cache_hit,
  check_oplog_window,
  check_compression_algorithm,
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
  check_wt_pages_read_volume
];

// skills/perf-kp-sql/src/engines/mongo/collector.ts
var OS_BATCH_CMD = [
  "echo '###THP###'",
  "cat /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || echo unknown",
  "echo '###NUMA_NODES###'",
  "ls -d /sys/devices/system/node/node* 2>/dev/null | wc -l",
  "echo '###NUMA_BAL###'",
  "cat /proc/sys/kernel/numa_balancing 2>/dev/null || echo 0",
  "echo '###HUGEPAGES###'",
  "cat /proc/sys/vm/nr_hugepages 2>/dev/null || echo 0",
  "echo '###MEM###'",
  "awk '/MemTotal/{print int($2/1024)}' /proc/meminfo",
  "echo '###IOSCHED###'",
  "cat /sys/block/{vda,sda,nvme0n1}/queue/scheduler 2>/dev/null | head -n 1 || echo none",
  "echo '###SWAP###'",
  "cat /proc/sys/vm/swappiness 2>/dev/null || echo -1",
  "echo '###ARCH###'",
  "uname -m",
  "echo '###IOSTAT###'",
  "iostat -xdm 1 2 2>/dev/null | tail -n +4 | head -20 || echo 'N/A'",
  "echo '###DISKUSAGE###'",
  "df -h / | awk 'NR==2{print $5}' | tr -d '%' || echo 0",
  "echo '###TCPRETRANS###'",
  `cat /proc/net/snmp 2>/dev/null | awk '/Tcp:/{if(NR%2==0){retrans=$13; segs=$12; if(segs>0) printf "%.4f", retrans/segs*100; else print 0}}' || echo 0`,
  "echo '###CPUGOV###'",
  "cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor 2>/dev/null | sort -u | tr '\\n' ',' | sed 's/,$//' || echo SKIP",
  "echo '###SOMAXCONN###'",
  "sysctl -n net.core.somaxconn 2>/dev/null || echo 0",
  "echo '###TCPKEEPALIVE###'",
  "sysctl -n net.ipv4.tcp_keepalive_time 2>/dev/null || echo 0",
  "echo '###TCPKEEPALIVEINTVL###'",
  "sysctl -n net.ipv4.tcp_keepalive_intvl 2>/dev/null || echo 0",
  "echo '###DIRTYRATIO###'",
  "sysctl -n vm.dirty_ratio 2>/dev/null || echo 0",
  "echo '###DIRTYBGRATIO###'",
  "sysctl -n vm.dirty_background_ratio 2>/dev/null || echo 0",
  // ── 鲲鹏 L1 平台层专用 ──
  "echo '###SMT###'",
  `lscpu 2>/dev/null | awk -F: '/^Thread\\(s\\) per core/{gsub(/ /,"",$2); print $2}' || echo 0`,
  "echo '###IRQBALANCE###'",
  "systemctl is-active irqbalance 2>/dev/null || echo unknown",
  // ── 环境识别（meta，不是独立 check，但影响 K-* 条件检查是否执行）──
  "echo '###VIRT###'",
  "systemd-detect-virt 2>/dev/null || echo unknown",
  "echo '###SYSVENDOR###'",
  "cat /sys/class/dmi/id/sys_vendor 2>/dev/null || echo unknown",
  "echo '###PRODUCT###'",
  "cat /sys/class/dmi/id/product_name 2>/dev/null || echo unknown",
  "echo '###DISCOVERY###'",
  // mongod 进程 + 端口 + bind IP 自发现
  `PID=$(pgrep -o mongod 2>/dev/null); if [ -z "$PID" ]; then PID=$(ps aux | awk '/[m]ongod/{print $2}' | head -1); fi; if [ -n "$PID" ]; then   LISTEN_LINE=$(ss -lntp 2>/dev/null | grep "pid=$PID" | head -1);   PORT=$(echo "$LISTEN_LINE" | awk '{print $4}' | grep -oE '[0-9]+$' | head -1);   BIND=$(echo "$LISTEN_LINE" | awk '{print $4}' | sed 's/:.*//');   if [ "$BIND" = "*" ] || [ "$BIND" = "0.0.0.0" ] || [ "$BIND" = "::" ]; then BIND="127.0.0.1"; fi;   if [ -z "$BIND" ]; then BIND="127.0.0.1"; fi;   echo "PID=$PID PORT=\${PORT:-27017} BIND=$BIND"; else   PORT_LINE=$(ss -lntp 2>/dev/null | grep -E ':2701[0-9]\\b' | head -1);   if [ -n "$PORT_LINE" ]; then     BIND=$(echo "$PORT_LINE" | awk '{print $4}' | sed 's/:.*//');     if [ "$BIND" = "*" ] || [ "$BIND" = "0.0.0.0" ] || [ "$BIND" = "::" ]; then BIND="127.0.0.1"; fi;     echo "PID=unknown PORT=$(echo $PORT_LINE | awk '{print $4}' | grep -oE '[0-9]+$') BIND=$BIND";   else echo "PID= PORT= BIND=127.0.0.1"; fi; fi`
].join("; ");
function buildContext(osStdout, dbStdout, dbStderr = "", dbExitCode = 0) {
  const os_metrics = {};
  const db_metrics = {};
  let mongoPort = "27017";
  let mongoBind = "127.0.0.1";
  let pid;
  if (osStdout) {
    parseOsBatch(osStdout, os_metrics);
    const disc = getSection(osStdout.split("###"), "DISCOVERY");
    if (disc) {
      for (const part of disc.split(/\s+/)) {
        if (part.startsWith("PORT=") && /^\d+$/.test(part.slice(5))) mongoPort = part.slice(5);
        if (part.startsWith("BIND=") && part.slice(5)) mongoBind = part.slice(5);
      }
      db_metrics["_discovered_port"] = mongoPort;
      db_metrics["_discovered_bind"] = mongoBind;
      const pidPart = disc.split(/\s+/).find((p) => p.startsWith("PID="));
      if (pidPart && pidPart.slice(4)) {
        pid = pidPart.slice(4);
        db_metrics["_discovered_pid"] = pid;
      }
    }
  }
  parseDbBatch({ stdout: dbStdout, stderr: dbStderr, exitCode: dbExitCode }, db_metrics);
  return {
    context: { os_metrics, db_metrics, db_type: "mongo" },
    discovered: { port: mongoPort, bind: mongoBind, pid }
  };
}
function coerceEjsonNumbers(v) {
  if (v === null || v === void 0) return v;
  if (typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(coerceEjsonNumbers);
  const o = v;
  if (typeof o["$numberLong"] === "string") {
    const n = Number(o["$numberLong"]);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof o["$numberInt"] === "string") {
    const n = Number(o["$numberInt"]);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof o["$numberDouble"] === "string") {
    const n = Number(o["$numberDouble"]);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof o["high"] === "number" && typeof o["low"] === "number" && typeof o["unsigned"] === "boolean" && Object.keys(o).length === 3) {
    const high = o["high"];
    const low = o["low"];
    const n = high * 4294967296 + (low >>> 0);
    return Number.isFinite(n) ? n : 0;
  }
  const out = {};
  for (const [k, val] of Object.entries(o)) out[k] = coerceEjsonNumbers(val);
  return out;
}
function parseDbBatch(res, out) {
  if (res.err) {
    out["_db_collection_failed"] = true;
    out["_db_collection_error"] = res.err;
    return;
  }
  const txt = res.stdout.trim();
  if (!txt) {
    out["_db_collection_failed"] = true;
    out["_db_collection_error"] = "mongosh \u8FD4\u56DE\u7A7A\u8F93\u51FA";
    return;
  }
  let raw;
  try {
    raw = JSON.parse(extractJsonObject(txt));
  } catch {
    out["_db_collection_failed"] = true;
    out["_db_collection_error"] = "mongosh \u8FD4\u56DE\u975E JSON \u683C\u5F0F";
    return;
  }
  raw = coerceEjsonNumbers(raw);
  const ss = raw["serverStatus"] ?? {};
  for (const [k, v] of Object.entries(ss)) {
    out[k] = v;
  }
  out["serverStatus"] = ss;
  if (raw["hostInfo"]) out["hostInfo"] = raw["hostInfo"];
  if (raw["getCmdLineOpts"]) out["getCmdLineOpts"] = raw["getCmdLineOpts"];
  if (raw["t0_serverStatus"]) out["t0_serverStatus"] = raw["t0_serverStatus"];
  if (raw["t1_serverStatus"]) out["t1_serverStatus"] = raw["t1_serverStatus"];
  if (typeof raw["sample_interval_sec"] === "number") {
    out["sample_interval_sec"] = raw["sample_interval_sec"];
  }
  out["_db_collection_failed"] = false;
  const wt = (ss["wiredTiger"] ?? {})["cache"] ?? {};
  if (Object.keys(wt).length > 0) {
    out["_wt_cache_detail"] = wt;
    out["wt_cache_maximum_bytes"] = wt["maximum bytes configured"] ?? 0;
  }
  const co = raw["currentOp"] ?? {};
  const inprog = co["inprog"] ?? [];
  const activeOps = inprog.filter((op) => op["active"]);
  const getSec = (op) => {
    const v = op["secs_running"];
    if (v && typeof v === "object") {
      const vo = v;
      return parseIntOr(String(vo["$numberLong"] ?? vo["$numberInt"] ?? 0), 0);
    }
    if (typeof v === "number") return Math.trunc(v);
    if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
    return 0;
  };
  const slowOps = activeOps.filter((op) => getSec(op) > 3);
  out["currentOp"] = {
    active_count: activeOps.length,
    slow_count: slowOps.length,
    top_slow_secs: slowOps.length > 0 ? Math.max(...slowOps.map((op) => getSec(op))) : 0
  };
  const oplog = raw["oplog"];
  if (oplog && typeof oplog === "object") {
    const w = oplog["windowHours"];
    const wn = typeof w === "number" ? w : parseFloat(String(w));
    out["_oplog_window_hours"] = Number.isFinite(wn) ? wn : -1;
  }
  const bc = raw["blockCompressor"];
  if (typeof bc === "string" && bc) out["_wt_block_compressor"] = bc;
}
function extractJsonObject(stdout) {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  let lastObject = "";
  for (let i = 0; i < stdout.length; i++) {
    const ch = stdout[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
      continue;
    }
    if (ch === "}") {
      if (depth === 0) continue;
      depth--;
      if (depth === 0 && start >= 0) {
        lastObject = stdout.slice(start, i + 1);
        start = -1;
      }
    }
  }
  if (!lastObject) {
    throw new Error("no JSON object found");
  }
  return lastObject;
}

// skills/perf-kp-sql/src/report.ts
var SEVERITY_WEIGHT = {
  critical: 10,
  warning: 5,
  info: 1,
  ok: 0
};
var CONFIDENCE_WEIGHT = {
  high: 1,
  medium: 0.7,
  low: 0.4
};
var FIX_COST_WEIGHT = {
  trivial: 1,
  restart_engine: 3,
  schema_migration: 10
};
function inferAuthority(url) {
  const u = url.toLowerCase();
  if (u.includes("hikunpeng.com")) {
    if (u.includes("/kunpengdbs/")) return { tier: "vendor-primary", label: "[\u9CB2\u9E4F BoostKit]" };
    if (u.includes("/perftuning/")) return { tier: "vendor-primary", label: "[\u9CB2\u9E4F\u6027\u80FD\u4F18\u5316\u5341\u677F\u65A7]" };
    if (u.includes("/kunpengdevps/")) return { tier: "vendor-primary", label: "[\u9CB2\u9E4F DevKit]" };
    if (u.includes("/kunpengtroubleshooting/")) return { tier: "vendor-primary", label: "[\u9CB2\u9E4F\u6545\u969C\u5904\u7406\u624B\u518C]" };
    if (u.includes("/kunpengdevtoolkit/")) return { tier: "vendor-primary", label: "[\u9CB2\u9E4F\u4EE3\u7801\u79FB\u690D\u6307\u5357]" };
    return { tier: "vendor-primary", label: "[\u9CB2\u9E4F\u539F\u5382]" };
  }
  if (u.includes("aws.amazon.com") && u.includes("graviton")) return { tier: "vendor-primary", label: "[AWS Graviton]" };
  if (u.includes("amperecomputing.com")) return { tier: "vendor-primary", label: "[Ampere]" };
  if (u.includes("mongodb.com/docs")) return { tier: "official", label: "[MongoDB \u5B98\u65B9]" };
  if (u.includes("percona.com/blog") || u.includes("mongodb.com/blog") || u.includes("huaweicloud.com"))
    return { tier: "vendor-blog", label: "[\u5382\u5546\u535A\u5BA2]" };
  return { tier: "community", label: "[\u793E\u533A]" };
}
function primaryFixCost(r) {
  return r.recommendations[0]?.fix_cost ?? "trivial";
}
function computeImpactScore(r) {
  const sev = SEVERITY_WEIGHT[r.severity] ?? 0;
  const conf = CONFIDENCE_WEIGHT[r.impact?.confidence ?? "high"] ?? 1;
  const cost = FIX_COST_WEIGHT[primaryFixCost(r)] ?? 1;
  const costSafe = cost <= 0 ? 1 : cost;
  return +(sev * conf * (1 / costSafe)).toFixed(3);
}
function priorityFor(r) {
  switch (r.severity) {
    case "critical":
      return "P1";
    case "warning":
      return r.impact?.confidence === "low" ? "P3" : "P2";
    case "info":
      return "P3";
    default:
      return "P4";
  }
}
function aggregateByModule(results) {
  const out = {};
  for (const m of MODULE_ORDER) {
    out[m] = { critical: 0, warning: 0, ok: 0 };
  }
  for (const r of results) {
    const m = moduleOf(r.id);
    if (r.severity === "critical") out[m].critical += 1;
    else if (r.severity === "warning") out[m].warning += 1;
    else out[m].ok += 1;
  }
  return out;
}
var REMEDY_BY_RULE_ID = {
  // mongo runtime data missing · 配复制集 / sharded cluster / 升权限
  "mongo.config.oplog_window_hours": "\u914D mongod \u526F\u672C\u96C6\u540E\u624D\u6709 oplog \xB7 /etc/mongod.conf \u52A0 replication.replSetName=rs0 \xB7 \u91CD\u542F \xB7 \u8FDB mongosh \u8DD1 rs.initiate()",
  "mongo.runtime.sharded_index_consistency": "\u9700 sharded cluster \u624D\u6709\u6B64\u5B57\u6BB5 \xB7 standalone / \u526F\u672C\u96C6\u6CA1\u6709 \xB7 \u4E0D\u9700\u8865",
  "mongo.runtime.wt_ticket_read": "serverStatus.wiredTiger.concurrentTransactions \u5B57\u6BB5\u8BFB\u4E0D\u5230 \xB7 \u68C0\u67E5 mongo \u7528\u6237\u89D2\u8272\u81F3\u5C11 clusterMonitor \xB7 \u6216\u5347 mongod 7.0+",
  "mongo.runtime.wt_ticket_write": "\u540C wt_ticket_read \xB7 \u540C\u6837\u9760\u89D2\u8272\u6216\u7248\u672C",
  "mongo.platform.arm64_microarch": "\u672C\u673A\u975E arm64(\u53EF\u80FD\u662F x86_64)\xB7 \u9CB2\u9E4F arm64 \u7269\u7406\u673A\u624D\u9002\u7528 \xB7 \u4E0D\u9700\u8865",
  "mongo.config.wt_cache_vs_memory": "wiredTiger.cache \u5B57\u6BB5\u8BFB\u4E0D\u5230 \xB7 mongo \u7528\u6237\u89D2\u8272\u5347\u5230 clusterMonitor \xB7 \u6216\u52A0 --eval 'db.serverStatus({wiredTiger:1})' \u663E\u5F0F\u5F00\u542F",
  "mongo.storage.journaling_enabled": "storageEngine.persistent \u5B57\u6BB5\u4E0D\u66B4\u9732 \xB7 \u901A\u5E38 mongo 4.0 \u8D77\u9ED8\u8BA4 true \xB7 \u5347 mongo \u7528\u6237\u89D2\u8272\u5230 clusterMonitor \u53EF\u8BFB"
};
var REMEDY_BY_SKIP_REASON = {
  arch_mismatch: "\u5207\u5230 arm64 \u7269\u7406\u673A(\u9CB2\u9E4F / Graviton / Ampere)\u518D\u8DD1",
  vendor_mismatch: "\u5207\u5230 Kunpeng \u9CB2\u9E4F\u7269\u7406\u673A\u518D\u8DD1",
  os_mismatch: "\u5207\u5230 openEuler \u7CFB\u7EDF\u518D\u8DD1",
  runtime_data_missing: "\u5347 mongo \u7528\u6237\u89D2\u8272 / \u68C0\u67E5\u6743\u9650 / \u542F\u7528\u76F8\u5173 mongod \u914D\u7F6E"
};
function deriveUnfiredRules(results) {
  return results.filter((r) => r.skip_reason === "runtime_data_missing").map((r) => ({
    id: r.id,
    title: r.title,
    skip_reason: r.skip_reason,
    remedy_hint: REMEDY_BY_RULE_ID[r.id] ?? REMEDY_BY_SKIP_REASON[r.skip_reason]
  }));
}
function rankResults(results) {
  return results.map((r) => ({
    ...r,
    impact_score: computeImpactScore(r),
    priority: priorityFor(r)
  }));
}
function buildReportInput(opts) {
  const { results, metadata } = opts;
  const topN = opts.topN ?? 5;
  const ranked = rankResults(results).sort((a, b) => b.impact_score - a.impact_score);
  const actionable = ranked.filter((r) => r.severity === "critical" || r.severity === "warning");
  const info = ranked.filter((r) => r.severity === "info");
  const ok = ranked.filter((r) => r.severity === "ok");
  const top_issues = actionable.slice(0, topN);
  const full_findings = [...actionable, ...info];
  const ok_findings = ok;
  const summary = {
    total: ranked.length,
    critical: actionable.filter((r) => r.severity === "critical").length,
    warning: actionable.filter((r) => r.severity === "warning").length,
    info: info.length,
    ok: ok.length
  };
  const evidence_trail = collectEvidenceTrail(ranked);
  const urlToN = new Map(evidence_trail.map((e) => [e.url, e.footnote_n]));
  const attachFootnotes = (arr) => arr.map((r) => ({ ...r, footnote_refs: r.citations.map((c) => urlToN.get(c.url) ?? 0).filter((n) => n > 0) }));
  const by_module = aggregateByModule(results);
  const unfired_rules = deriveUnfiredRules(results);
  return {
    metadata: { ...metadata, scanned_rules: ranked.length },
    top_issues: attachFootnotes(top_issues),
    full_findings: attachFootnotes(full_findings),
    ok_findings: attachFootnotes(ok_findings),
    summary,
    by_module,
    unfired_rules,
    evidence_trail
  };
}
function collectEvidenceTrail(ranked) {
  const byUrl = /* @__PURE__ */ new Map();
  for (const r of ranked) {
    for (const c of r.citations) {
      const existing = byUrl.get(c.url);
      if (existing) {
        if (!existing.used_by_rules.includes(r.id)) existing.used_by_rules.push(r.id);
      } else {
        const { tier, label } = inferAuthority(c.url);
        byUrl.set(c.url, {
          url: c.url,
          title: c.title,
          anchor: c.anchor,
          used_by_rules: [r.id],
          tier,
          label,
          footnote_n: 0
          // 占位 · sort 后再分配
        });
      }
    }
  }
  const tierOrder = {
    "vendor-primary": 0,
    "official": 1,
    "vendor-blog": 2,
    "community": 3
  };
  const sorted = [...byUrl.values()].sort((a, b) => {
    const t = tierOrder[a.tier] - tierOrder[b.tier];
    if (t !== 0) return t;
    return b.used_by_rules.length - a.used_by_rules.length;
  });
  sorted.forEach((e, i) => {
    e.footnote_n = i + 1;
  });
  return sorted;
}

// skills/perf-kp-sql/src/rule-engine-v2.ts
var FIELD_BRACKET_RE = /^\['([^']+)'\]|^\["([^"]+)"\]|^\[(\d+)\]/;
function resolveField(metrics, path) {
  let cur = metrics;
  let i = 0;
  let token = "";
  while (i < path.length) {
    const ch = path[i];
    if (ch === ".") {
      if (token) {
        cur = cur?.[token];
        token = "";
      }
      i++;
    } else if (ch === "[") {
      if (token) {
        cur = cur?.[token];
        token = "";
      }
      const sub = path.slice(i);
      const m = sub.match(FIELD_BRACKET_RE);
      if (!m) return void 0;
      const key = m[1] ?? m[2] ?? m[3];
      cur = cur?.[key];
      i += m[0].length;
    } else {
      token += ch;
      i++;
    }
  }
  if (token) cur = cur?.[token];
  return cur;
}
function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === " " || ch === "	" || ch === "\n") {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ kind: "comma" });
      i++;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ kind: "op", v: ch });
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let j = i + 1;
      while (j < input.length && input[j] !== quote) j++;
      if (j >= input.length) throw new Error(`unterminated string literal at ${i}`);
      tokens.push({ kind: "str", v: input.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      tokens.push({ kind: "num", v: parseFloat(input.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < input.length) {
        const c = input[j];
        if (c === void 0) break;
        if (/[a-zA-Z0-9_]/.test(c)) {
          j++;
          continue;
        }
        if (c === ".") {
          j++;
          continue;
        }
        if (c === "[") {
          const sub = input.slice(j);
          const m = sub.match(FIELD_BRACKET_RE);
          if (m) {
            j += m[0].length;
            continue;
          }
          break;
        }
        break;
      }
      tokens.push({ kind: "ident", v: input.slice(i, j) });
      i = j;
      continue;
    }
    throw new Error(`unexpected char '${ch}' at ${i}`);
  }
  return tokens;
}
function peek(p) {
  return p.tokens[p.i];
}
function eat(p) {
  return p.tokens[p.i++];
}
function parseExpr(p) {
  let l = parseTerm(p);
  while (true) {
    const t = peek(p);
    if (t?.kind === "op" && (t.v === "+" || t.v === "-")) {
      eat(p);
      const r = parseTerm(p);
      l = { kind: "binop", op: t.v, l, r };
    } else break;
  }
  return l;
}
function parseTerm(p) {
  let l = parseFactor(p);
  while (true) {
    const t = peek(p);
    if (t?.kind === "op" && (t.v === "*" || t.v === "/")) {
      eat(p);
      const r = parseFactor(p);
      l = { kind: "binop", op: t.v, l, r };
    } else break;
  }
  return l;
}
function parseFactor(p) {
  const t = eat(p);
  if (t.kind === "num") return { kind: "num", v: t.v };
  if (t.kind === "str") return { kind: "str", v: t.v };
  if (t.kind === "lparen") {
    const e = parseExpr(p);
    const rp = eat(p);
    if (rp.kind !== "rparen") throw new Error("expected )");
    return e;
  }
  if (t.kind === "ident") {
    const next = peek(p);
    if (next?.kind === "lparen") {
      eat(p);
      const args = [];
      if (peek(p)?.kind !== "rparen") {
        args.push(parseExpr(p));
        while (peek(p)?.kind === "comma") {
          eat(p);
          args.push(parseExpr(p));
        }
      }
      const rp = eat(p);
      if (rp.kind !== "rparen") throw new Error("expected ) in fn");
      return { kind: "fn", name: t.v, args };
    }
    return { kind: "field", path: t.v };
  }
  throw new Error(`unexpected token ${JSON.stringify(t)}`);
}
function evalAst(ast, metrics) {
  if (ast.kind === "num") return ast.v;
  if (ast.kind === "str") {
    throw new Error(`unexpected string literal '${ast.v}' outside fn arg`);
  }
  if (ast.kind === "field") {
    const v = resolveField(metrics, ast.path);
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = parseFloat(v);
      if (Number.isFinite(n)) return n;
    }
    if (typeof v === "boolean") return v ? 1 : 0;
    throw new Error(`field ${ast.path} not numeric (got ${JSON.stringify(v)})`);
  }
  if (ast.kind === "fn") {
    if (ast.name === "rate") return evalRate(ast, metrics);
    if (ast.name === "baseline") return evalBaseline(ast, metrics);
    const args = ast.args.map((a) => evalAst(a, metrics));
    if (ast.name === "max") return Math.max(...args);
    if (ast.name === "min") return Math.min(...args);
    if (ast.name === "safe_divide") {
      if (args.length !== 2) throw new Error("safe_divide needs 2 args");
      return args[1] === 0 ? 0 : args[0] / args[1];
    }
    if (ast.name === "abs") return Math.abs(args[0]);
    throw new Error(`unknown fn ${ast.name}`);
  }
  if (ast.kind === "binop") {
    const l = evalAst(ast.l, metrics);
    const r = evalAst(ast.r, metrics);
    if (ast.op === "+") return l + r;
    if (ast.op === "-") return l - r;
    if (ast.op === "*") return l * r;
    if (ast.op === "/") {
      if (r === 0) throw new Error("division by zero (use safe_divide)");
      return l / r;
    }
  }
  throw new Error("unreachable");
}
function evalRate(ast, metrics) {
  if (ast.args.length !== 2) throw new Error("rate needs 2 args: rate(path, '5s')");
  const pathAst = ast.args[0];
  const intvAst = ast.args[1];
  if (pathAst.kind !== "field") throw new Error("rate arg 1 must be a field path");
  if (intvAst.kind !== "str") throw new Error("rate arg 2 must be string literal like '5s'");
  const m = intvAst.v.match(/^(\d+)\s*s$/i);
  if (!m) throw new Error(`rate interval must be '<number>s', got '${intvAst.v}'`);
  const actualSec = metrics.sample_interval_sec;
  if (typeof actualSec !== "number" || actualSec <= 0) {
    throw new Error("sample_interval_sec missing or invalid (collector v2 \u53CC\u91C7\u6837\u672A\u751F\u6548?)");
  }
  const path = pathAst.path;
  if (!path.startsWith("serverStatus")) {
    throw new Error(`rate only supports serverStatus.* paths, got '${path}'`);
  }
  const t0Path = "t0_" + path;
  const t1Path = "t1_" + path;
  const t0 = numericOrNull(resolveField(metrics, t0Path));
  const t1 = numericOrNull(resolveField(metrics, t1Path));
  if (t0 === null) throw new Error(`rate: t0 field ${t0Path} not collected`);
  if (t1 === null) throw new Error(`rate: t1 field ${t1Path} not collected`);
  return (t1 - t0) / actualSec;
}
function evalBaseline(ast, metrics) {
  if (ast.args.length !== 1) throw new Error("baseline needs 1 arg: baseline(path)");
  const pathAst = ast.args[0];
  if (pathAst.kind !== "field") throw new Error("baseline arg 1 must be a field path");
  const baselines = metrics.baseline;
  if (!baselines || typeof baselines !== "object") {
    throw new Error("baseline data missing (~/.ohsql/perf-kp-sql/baselines/<host>.json \u672A\u52A0\u8F7D?)");
  }
  const v = baselines[pathAst.path];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(`baseline: no value for '${pathAst.path}'`);
  }
  return v;
}
function numericOrNull(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  return null;
}
function evalCompute(expr, metrics) {
  const tokens = tokenize(expr);
  const p = { i: 0, tokens };
  const ast = parseExpr(p);
  if (p.i !== tokens.length) throw new Error("trailing tokens");
  return evalAst(ast, metrics);
}
function applyOp(op, actual, expected) {
  switch (op) {
    case "eq":
      return actual === expected;
    case "ne":
      return actual !== expected;
    case "gt":
      return Number(actual) > Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "ge":
      return Number(actual) >= Number(expected);
    case "le":
      return Number(actual) <= Number(expected);
    case "contains":
      return String(actual).includes(String(expected));
    case "not_contains":
      return !String(actual).includes(String(expected));
  }
}
function evaluateCheck(check, metrics) {
  let actual;
  try {
    if (check.compute) {
      actual = evalCompute(check.compute, metrics);
    } else if (check.metric) {
      actual = resolveField(metrics, check.metric);
      if (actual === void 0) return { triggered: false, actual: "(undefined)", error: "metric not collected" };
    } else {
      return { triggered: false, actual: "(none)", error: "no compute / metric" };
    }
  } catch (e) {
    return { triggered: false, actual: "(error)", error: e?.message ?? String(e) };
  }
  return { triggered: applyOp(check.op, actual, check.value), actual };
}
function evaluateRule(rule, metrics) {
  if (rule.when && rule.when.length > 0) {
    for (const w of rule.when) {
      const r = evaluateCheck(w, metrics);
      if (r.error) return { rule_id: rule.rule_id, status: "skipped", skipped_reason: `when: ${r.error}` };
      if (!r.triggered) return { rule_id: rule.rule_id, status: "skipped", skipped_reason: `when not satisfied: ${w.compute ?? w.metric} ${w.op} ${w.value} \xB7 actual=${r.actual}` };
    }
  }
  for (const c of rule.checks) {
    const r = evaluateCheck(c, metrics);
    if (r.error) return { rule_id: rule.rule_id, status: "error", error: r.error };
    if (r.triggered) {
      return { rule_id: rule.rule_id, status: "finding", triggered_check: { ...c, actual: r.actual } };
    }
  }
  return { rule_id: rule.rule_id, status: "ok" };
}

// skills/perf-kp-sql/src/rule-engine.ts
function evaluateRule2(rule, collected) {
  const base = {
    rule_id: rule.rule_id,
    engine: rule.engine,
    bucket: rule.bucket,
    severity: rule.severity,
    title: rule.title,
    description: rule.description,
    recommendations: rule.recommendations,
    source_url: rule.source_url
  };
  if (!rule.checks || rule.checks.length === 0) {
    return { ...base, status: "info", summary: `${rule.title}\uFF08\u4FE1\u606F\u91C7\u96C6\uFF09` };
  }
  for (const check of rule.checks) {
    if (check.when) {
      const condVal = collected.get(check.when.key);
      if (condVal === void 0) continue;
      if (!evalOp(check.when.op, condVal, check.when.value)) continue;
    }
    const actual = collected.get(check.metric);
    if (actual === void 0) continue;
    if (check.op === "custom") continue;
    if (evalOp(check.op, actual, check.value)) {
      return {
        ...base,
        status: "finding",
        summary: `${check.metric}=${actual} \xB7 \u671F\u671B ${check.op} ${check.value}`,
        triggered_check: {
          metric: check.metric,
          actual,
          op: check.op,
          expected: check.value
        }
      };
    }
  }
  return { ...base, status: "ok", summary: `${rule.title}\uFF08\u6B63\u5E38\uFF09` };
}
function evaluateAll(rules, collected) {
  return rules.map((r) => evaluateRule2(r, collected));
}
function parseRuleRow(row) {
  return {
    rule_id: row.rule_id,
    engine: row.engine,
    bucket: row.bucket,
    severity: row.severity,
    title: row.title,
    description: row.description || null,
    metrics: safeParseJson(row.metrics, []),
    checks: safeParseJson(row.checks, []),
    recommendations: safeParseJson(row.recommendations, []),
    source_url: row.source_url || null,
    source_title: row.source_title || null,
    engine_version_min: row.engine_version_min || null,
    engine_version_max: row.engine_version_max || null,
    arch: row.arch || null,
    vendor: row.vendor || null,
    enabled: row.enabled
  };
}
function evalOp(op, actual, expected) {
  if (actual === void 0 || actual === null) return false;
  const a = actual.trim();
  const e = expected.trim();
  switch (op) {
    case "eq":
      return a === e;
    case "ne":
      return a !== e;
    case "gt": {
      const na = parseFloat(a), ne = parseFloat(e);
      return Number.isFinite(na) && Number.isFinite(ne) && na > ne;
    }
    case "gte": {
      const na = parseFloat(a), ne = parseFloat(e);
      return Number.isFinite(na) && Number.isFinite(ne) && na >= ne;
    }
    case "lt": {
      const na = parseFloat(a), ne = parseFloat(e);
      return Number.isFinite(na) && Number.isFinite(ne) && na < ne;
    }
    case "lte": {
      const na = parseFloat(a), ne = parseFloat(e);
      return Number.isFinite(na) && Number.isFinite(ne) && na <= ne;
    }
    case "regex":
      try {
        return new RegExp(e).test(a);
      } catch {
        return false;
      }
    case "contains":
      return a.toLowerCase().includes(e.toLowerCase());
    default:
      return false;
  }
}
function safeParseJson(s, fallback) {
  if (!s) return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}
function toFixCost(cost) {
  if (cost === "trivial") return "trivial";
  if (cost === "restart_engine" || cost === "\u9700\u91CD\u542F\u670D\u52A1") return "restart_engine";
  return "schema_migration";
}
function toBucket(n) {
  if (n >= 1 && n <= 5) return n;
  return 1;
}
function toCheckResult(r, scope) {
  const bucket = toBucket(r.bucket);
  const recommendations = (r.recommendations || []).map((rec) => ({
    action: rec.action,
    rationale: rec.rationale,
    type: "mitigate",
    fix_cost: toFixCost(rec.cost),
    verifiable: rec.cost === "trivial"
  }));
  const citations = r.source_url ? [{ title: r.title, url: r.source_url }] : [];
  if (r.status === "finding") {
    const t = r.triggered_check;
    return finding({
      id: r.rule_id,
      title: r.title,
      severity: r.severity,
      bucket,
      scope,
      summary: r.summary,
      description: r.description || r.summary,
      reason: `${t.metric}=${t.actual}\uFF08\u671F\u671B ${t.op} ${t.expected}\uFF09`,
      evidence: [{
        kind: "metric",
        value: `${t.metric}=${t.actual}`,
        measured_at: (/* @__PURE__ */ new Date()).toISOString()
      }],
      impact: {
        metric: "db_time_pct",
        value: r.severity === "critical" ? 30 : 10,
        unit: "percent",
        confidence: "medium"
      },
      citations,
      recommendations,
      needs_human_review: recommendations.length === 0
    });
  }
  if (r.status === "info") {
    return infoResult({
      id: r.rule_id,
      title: r.title,
      bucket,
      scope,
      summary: r.summary,
      reason: r.description || "\u4FE1\u606F\u91C7\u96C6"
    });
  }
  return okResult({
    id: r.rule_id,
    title: r.title,
    bucket,
    scope,
    summary: r.summary,
    reason: r.description || "\u68C0\u67E5\u901A\u8FC7",
    citations
  });
}
function evaluateRulesAsCheckResults(rules, collected, scope) {
  return evaluateAll(rules, collected).map((r) => toCheckResult(r, scope));
}
function parseV2RuleRow(row) {
  return {
    ...parseRuleRow(row),
    v2_when: row.v2_when || null,
    v2_checks: row.v2_checks || null,
    fix: row.fix || null,
    fix_cost: row.fix_cost || null,
    source_quote: row.source_quote || null
  };
}
function evaluateV2RulesAsCheckResults(rows, metrics, scope) {
  const out = [];
  for (const row of rows) {
    let when = [];
    let checks = [];
    try {
      when = row.v2_when ? JSON.parse(row.v2_when) : [];
      checks = row.v2_checks ? JSON.parse(row.v2_checks) : [];
    } catch {
      out.push(infoResult({
        id: row.rule_id,
        title: row.title,
        bucket: toBucket(row.bucket),
        scope,
        summary: `${row.title}\uFF08v2 \u89C4\u5219\u89E3\u6790\u5931\u8D25\uFF09`,
        reason: "v2_when/v2_checks \u4E0D\u662F\u5408\u6CD5 JSON"
      }));
      continue;
    }
    if (checks.length === 0) continue;
    const rule = { rule_id: row.rule_id, when, checks };
    const r = evaluateRule(rule, metrics);
    if (r.status === "finding") {
      const t = r.triggered_check;
      const expr = t.compute ?? t.metric ?? "";
      const recs = row.fix ? [{
        action: row.fix,
        rationale: row.description || row.title,
        type: "mitigate",
        fix_cost: toFixCost(row.fix_cost || ""),
        verifiable: row.fix_cost === "trivial"
      }] : [];
      const citations = row.source_url ? [{ title: row.source_title || row.title, url: row.source_url }] : [];
      const sev = (row.severity || "warning").toLowerCase();
      const severity = sev === "critical" ? "critical" : sev === "info" ? "info" : "warning";
      const impactValue = severity === "critical" ? 30 : severity === "warning" ? 10 : 3;
      out.push(finding({
        id: row.rule_id,
        title: row.title,
        severity,
        bucket: toBucket(row.bucket),
        scope,
        summary: `${expr}=${formatActual(t.actual)} \xB7 \u671F\u671B ${t.op} ${t.value}`,
        description: row.description || row.title,
        reason: `${expr} \u2192 ${formatActual(t.actual)}\uFF08\u671F\u671B ${t.op} ${t.value}${t.unit ? " " + t.unit : ""}\uFF09`,
        evidence: [{
          kind: "metric",
          value: `${expr}=${formatActual(t.actual)}`,
          measured_at: (/* @__PURE__ */ new Date()).toISOString(),
          source_url: row.source_url || void 0
        }],
        impact: {
          metric: "db_time_pct",
          value: impactValue,
          unit: "percent",
          confidence: "medium"
        },
        citations,
        recommendations: recs,
        needs_human_review: recs.length === 0
      }));
    } else if (r.status === "ok") {
      out.push(okResult({
        id: row.rule_id,
        title: row.title,
        bucket: toBucket(row.bucket),
        scope,
        summary: `${row.title}\uFF08\u6B63\u5E38\uFF09`,
        reason: row.description || "v2 \u68C0\u67E5\u901A\u8FC7",
        citations: row.source_url ? [{ title: row.source_title || row.title, url: row.source_url }] : []
      }));
    } else if (r.status === "skipped") {
      out.push(infoResult({
        id: row.rule_id,
        title: row.title,
        bucket: toBucket(row.bucket),
        scope,
        summary: `${row.title}\uFF08\u6761\u4EF6\u4E0D\u6EE1\u8DB3 \xB7 \u5DF2\u8DF3\u8FC7\uFF09`,
        reason: r.skipped_reason || "when \u4E0D\u6EE1\u8DB3",
        skip_reason: "runtime_data_missing"
      }));
    } else {
      out.push(infoResult({
        id: row.rule_id,
        title: row.title,
        bucket: toBucket(row.bucket),
        scope,
        summary: `${row.title}\uFF08\u8BC4\u4F30\u9519\u8BEF\uFF09`,
        reason: r.error || "unknown error",
        skip_reason: "runtime_data_missing"
      }));
    }
  }
  return out;
}
function formatActual(v) {
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(4);
  }
  return String(v);
}

// skills/perf-kp-sql/src/kb-enrich.ts
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
function loadSqlite() {
  let Database;
  try {
    Database = __require("better-sqlite3");
  } catch {
    return null;
  }
  return Database;
}
function defaultKbPath() {
  const __dirname_local = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
  return join(__dirname_local, "..", "data", "knowledge.sqlite");
}
function enrichResultsFromKb(results, dbPath) {
  const Database = loadSqlite();
  if (!Database) return results;
  let db;
  try {
    db = new Database(dbPath ?? defaultKbPath(), { readonly: true });
  } catch {
    return results;
  }
  try {
    const has = db.prepare(
      "SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='knowledge'"
    ).get();
    if (!has || has.cnt === 0) return results;
    const stmt = db.prepare(
      "SELECT fact_type, quote, source_url FROM knowledge WHERE rule_id = ? AND quote IS NOT NULL AND quote != ''"
    );
    return results.map((r) => {
      try {
        const rows = stmt.all(r.id);
        return mergeFactsIntoResult(r, rows);
      } catch {
        return r;
      }
    });
  } finally {
    db.close();
  }
}
function mergeFactsIntoResult(r, rows) {
  const factsByType = /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (!row.quote) continue;
    if (!factsByType.has(row.fact_type)) factsByType.set(row.fact_type, []);
    factsByType.get(row.fact_type).push({ quote: row.quote, source_url: row.source_url });
  }
  const pick = (type) => factsByType.get(type)?.[0];
  const all = (type) => factsByType.get(type) ?? [];
  const out = { ...r };
  out.rationale = {
    summary: pick("summary")?.quote ?? "n/a",
    mechanism: pick("mechanism")?.quote ?? "n/a",
    trade_offs: pick("trade_off")?.quote ?? "n/a",
    when_to_deviate: pick("when_deviate")?.quote ?? "n/a"
  };
  out.summary = pick("summary")?.quote ?? pick("citation")?.quote ?? "";
  const summaryPart = pick("summary")?.quote;
  const mechanismPart = pick("mechanism")?.quote;
  out.description = [summaryPart, mechanismPart].filter(Boolean).join("\n\n") || "";
  out.reason = pick("mechanism")?.quote ?? pick("summary")?.quote ?? "";
  const thr = pick("threshold");
  out.threshold_display = thr?.quote;
  const remediations = all("remediation");
  if (remediations.length > 0) {
    out.recommendations = remediations.map((f) => ({
      action: f.quote,
      rationale: pick("summary")?.quote ?? "",
      type: "mitigate",
      fix_cost: "restart_engine",
      // 保守默认(KB 不评 fix_cost)
      verifiable: false,
      fix_url: f.source_url ?? void 0
      // 角注绑该 quote 的 source_url(footer 渲染用)
    }));
  } else {
    out.recommendations = [];
  }
  const citationMap = /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (!row.source_url) continue;
    if (citationMap.has(row.source_url)) continue;
    citationMap.set(row.source_url, {
      url: row.source_url,
      title: r.title || r.id,
      anchor: row.quote.slice(0, 80)
    });
  }
  out.citations = [...citationMap.values()];
  if (rows.length === 0) {
    out.needs_human_review = true;
  }
  return out;
}

// skills/perf-kp-sql/src/baseline-store.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join as join2 } from "node:path";
import { homedir } from "node:os";
var BASELINE_DIR = join2(homedir(), ".ohsql", "perf-kp-sql", "baselines");
function baselinePath(hostname) {
  const safe = hostname.replace(/[^\w.-]/g, "_");
  return join2(BASELINE_DIR, `${safe}.json`);
}
function snapshotFromServerStatus(serverStatus) {
  const out = {};
  if (!serverStatus || typeof serverStatus !== "object") return out;
  flattenNumericLeaves(serverStatus, "serverStatus", out);
  return out;
}
function flattenNumericLeaves(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const safeK = /^[A-Za-z_][\w]*$/.test(k) ? `.${k}` : `['${k.replace(/'/g, "\\'")}']`;
    const path = `${prefix}${safeK}`;
    if (typeof v === "number" && Number.isFinite(v)) {
      out[path] = v;
    } else if (typeof v === "boolean") {
      out[path] = v ? 1 : 0;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      flattenNumericLeaves(v, path, out);
    }
  }
}
function saveBaseline(hostname, snapshot) {
  if (!existsSync(BASELINE_DIR)) mkdirSync(BASELINE_DIR, { recursive: true });
  const payload = {
    saved_at: (/* @__PURE__ */ new Date()).toISOString(),
    hostname,
    ...snapshot
  };
  const path = baselinePath(hostname);
  writeFileSync(path, JSON.stringify(payload, null, 2));
  return path;
}
function tryLoadBaseline(hostname) {
  const path = baselinePath(hostname);
  if (!existsSync(path)) return null;
  try {
    const obj = JSON.parse(readFileSync(path, "utf8"));
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "saved_at" || k === "hostname") continue;
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

// skills/perf-kp-sql/src/cli-diagnose.ts
async function main() {
  const inputs = await readInputs();
  let ctx;
  let discovered = {};
  let results = [];
  if (inputs.engine === "mongo") {
    const built = buildContext(
      inputs.osStdout,
      inputs.dbStdout,
      inputs.dbStderr,
      inputs.dbExitCode
    );
    ctx = built.context;
    discovered = built.discovered;
    results = [...runAll(sharedChecks, ctx), ...runAll(mongoChecks, ctx)];
  } else {
    writeError(`unknown --engine ${inputs.engine} (must be mongo)`);
  }
  const hostname = pickHostname(ctx);
  if (hostname) {
    const bl = tryLoadBaseline(hostname);
    if (bl) {
      ctx.db_metrics.baseline = bl;
    }
  }
  try {
    const scope = deriveScope(ctx, inputs.engine);
    const ruleEngineResults = runRuleEngine(ctx, inputs.engine, scope);
    if (ruleEngineResults.length > 0) {
      const existingIds = new Set(results.map((r) => r.id));
      for (const r of ruleEngineResults) {
        if (!existingIds.has(r.id)) {
          results.push(r);
          existingIds.add(r.id);
        }
      }
    }
  } catch (e) {
    results.push(
      infoResult({
        id: "internal.rule_engine.load_error",
        title: "rule-engine fallback",
        bucket: 5,
        scope: deriveScope(ctx, inputs.engine),
        summary: `rule-engine: ${e instanceof Error ? e.message : String(e)}`,
        reason: "rule-engine \u52A0\u8F7D\u5931\u8D25\uFF0C\u5DF2\u4F7F\u7528\u65E7 CheckFn \u8DEF\u5F84"
      })
    );
  }
  try {
    results = enrichResultsFromKb(results);
  } catch (e) {
    results.push(
      infoResult({
        id: "internal.kb_enrich.error",
        title: "kb-enrich fallback",
        bucket: 5,
        scope: deriveScope(ctx, inputs.engine),
        summary: `kb-enrich: ${e instanceof Error ? e.message : String(e)}`,
        reason: "KB enrich \u5931\u8D25\uFF0C\u7ED3\u679C\u672A\u6CE8\u5165 rationale/recommendations"
      })
    );
  }
  const checkCatalog = countByWaitClass(results.map((r) => r.id));
  const summary = summarize(results, checkCatalog.total);
  if (results.length + summary.skipped !== checkCatalog.total) {
  }
  const reportInput = buildReportInput({
    results,
    metadata: {
      engine: inputs.engine,
      host: String(discovered.bind ?? "?"),
      port: numOrUndef(discovered.port),
      db_version: pickDbVersion(ctx, inputs.engine),
      arch: String(ctx.os_metrics.arch ?? "?"),
      scanned_kb_docs: 0,
      generated_at: (/* @__PURE__ */ new Date()).toISOString(),
      ascii_fallback: inputs.ascii
    }
  });
  const fixExperiments = synthesizeFixExperiments(results);
  const payload = JSON.stringify({
    ok: true,
    engine: inputs.engine,
    baseline: ctx,
    discovered,
    summary,
    check_catalog: checkCatalog,
    results,
    report_input: reportInput,
    fix_experiments: fixExperiments,
    with_verify_mode: inputs.withVerify
  });
  const summaryPayload = JSON.stringify({
    ok: true,
    engine: inputs.engine,
    discovered,
    summary,
    check_catalog: checkCatalog
  });
  if (inputs.saveBaseline && hostname) {
    const ss = ctx.db_metrics.serverStatus ?? ctx.db_metrics.t1_serverStatus;
    if (ss) {
      const snap = snapshotFromServerStatus(ss);
      const path = saveBaseline(hostname, snap);
      process.stderr.write(`[baseline] saved ${Object.keys(snap).length} numeric leaves to ${path}
`);
    } else {
      process.stderr.write(`[baseline] serverStatus \u7F3A\u5931 \xB7 \u8DF3\u8FC7\u4FDD\u5B58
`);
    }
  }
  if (inputs.outJson) {
    const { writeFileSync: wfs } = await import("node:fs");
    wfs(inputs.outJson, payload);
    if (inputs.summaryOnly) {
      const stdoutObj = {
        ok: true,
        engine: inputs.engine,
        discovered,
        summary,
        check_catalog: checkCatalog,
        wrote: inputs.outJson,
        bytes: payload.length
      };
      process.stdout.write(JSON.stringify(stdoutObj));
    } else {
      process.stdout.write(JSON.stringify({ ok: true, wrote: inputs.outJson, bytes: payload.length }));
    }
  } else if (inputs.summaryOnly) {
    process.stdout.write(summaryPayload);
  } else {
    process.stdout.write(payload);
  }
}
function expectedDirection(metric) {
  switch (metric) {
    case "throughput_qps":
      return "up";
    default:
      return "down";
  }
}
function synthesizeFixExperiments(results) {
  const out = [];
  for (const r of results) {
    if (r.severity !== "warning" && r.severity !== "critical") continue;
    for (const rec of r.recommendations) {
      if (rec.fix_cost !== "trivial") continue;
      if (rec.verifiable === false) continue;
      out.push(
        templateFixExperiment({
          findingId: r.id,
          ruleTitle: r.title,
          action: rec.action,
          // reverse 启发式:若 action 是 sysctl -w X=Y,暂无"原 Y"的采集能力 ·
          // 模板留占位,Phase 2 runner 实装时再填
          reverse: "(Phase 2 runner \u586B\u5165\u539F\u503C)",
          expectedMetric: r.impact.metric,
          expectedDirection: expectedDirection(r.impact.metric),
          expectedMinEffect: 15
        })
      );
    }
  }
  return out;
}
function runAll(checks, ctx) {
  const out = [];
  const engine = ctx.db_type || "mongo";
  for (const fn of checks) {
    try {
      out.push(fn(ctx));
    } catch (e) {
      out.push(
        infoResult({
          id: `internal.rule_exception.${out.length}`,
          title: "internal rule error",
          bucket: 5,
          scope: { engine, instance: "default" },
          summary: "rule execution threw",
          reason: e instanceof Error ? e.message : String(e)
        })
      );
    }
  }
  return out;
}
function runRuleEngine(ctx, engineName, scope) {
  let Database;
  try {
    Database = __require("better-sqlite3");
  } catch {
    return [];
  }
  const __dirname_local = typeof __dirname !== "undefined" ? __dirname : dirname2(fileURLToPath2(import.meta.url));
  const dbPath = join3(__dirname_local, "..", "data", "knowledge.sqlite");
  let db;
  try {
    db = new Database(dbPath, { readonly: true });
  } catch {
    return [];
  }
  try {
    const hasRules = db.prepare(
      `SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='rules'`
    ).get();
    if (!hasRules || hasRules.cnt === 0) return [];
    const cols = db.prepare(`PRAGMA table_info(rules)`).all();
    const hasV2 = cols.some((c) => c.name === "v2_checks");
    const rows = db.prepare(
      `SELECT * FROM rules WHERE engine = ? OR engine = 'any'`
    ).all(engineName);
    const allResults = [];
    if (hasV2) {
      const v2Rows = [];
      const v1Rows = [];
      for (const r of rows) {
        if (r.v2_checks && String(r.v2_checks).trim() && r.v2_checks !== "[]") {
          v2Rows.push(r);
        } else {
          v1Rows.push(r);
        }
      }
      if (v1Rows.length > 0) {
        const rules = v1Rows.map(parseRuleRow);
        const collected = buildCollectedMap(ctx);
        allResults.push(...evaluateRulesAsCheckResults(rules, collected, scope));
      }
      if (v2Rows.length > 0) {
        const v2Rules = v2Rows.map(parseV2RuleRow);
        const dbm = ctx.db_metrics;
        allResults.push(...evaluateV2RulesAsCheckResults(v2Rules, dbm, scope));
      }
    } else {
      const rules = rows.map(parseRuleRow);
      const collected = buildCollectedMap(ctx);
      allResults.push(...evaluateRulesAsCheckResults(rules, collected, scope));
    }
    return allResults;
  } finally {
    db.close();
  }
}
function buildCollectedMap(ctx) {
  const collected = /* @__PURE__ */ new Map();
  const osm = ctx.os_metrics;
  const dbm = ctx.db_metrics;
  for (const [k, v] of Object.entries(osm)) {
    if (v !== void 0 && v !== null) collected.set(k, String(v));
  }
  for (const [k, v] of Object.entries(dbm)) {
    if (v !== void 0 && v !== null) collected.set(k, String(v));
  }
  return collected;
}
function summarize(results, catalogTotal) {
  const total = results.length;
  const critical = results.filter((r) => r.severity === "critical").length;
  const warning = results.filter((r) => r.severity === "warning").length;
  const info = results.filter((r) => r.severity === "info").length;
  const ok = results.filter((r) => r.severity === "ok").length;
  const skipped = Math.max(0, catalogTotal - total);
  return { total, critical, warning, info, ok, skipped };
}
function pickDbVersion(ctx, engine) {
  const m = ctx.db_metrics;
  if (engine === "mongo") return m.version || void 0;
  return void 0;
}
function pickHostname(ctx) {
  const m = ctx.db_metrics;
  const hi = m.hostInfo;
  const sys = hi?.system;
  const h = sys?.hostname;
  return typeof h === "string" && h.length > 0 ? h : void 0;
}
function numOrUndef(v) {
  if (v === void 0 || v === null) return void 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : void 0;
}
async function readInputs() {
  const argv = parseArgs(process.argv.slice(2));
  const engine = argv.engine || "mongo";
  if (argv["os-file"] || argv["db-file"]) {
    if (!argv["os-file"]) writeError("missing --os-file");
    if (!argv["db-file"]) writeError("missing --db-file");
    const osStdout2 = await readFileSafe(argv["os-file"], "os-file");
    const dbStdout2 = await readFileSafe(argv["db-file"], "db-file");
    const dbStderr2 = argv["db-stderr-file"] ? await readFileSafe(argv["db-stderr-file"], "db-stderr-file") : "";
    const dbExitCode2 = argv["db-exit-code"] ? Number.parseInt(argv["db-exit-code"], 10) || 0 : 0;
    return {
      engine,
      osStdout: osStdout2,
      dbStdout: dbStdout2,
      dbStderr: dbStderr2,
      dbExitCode: dbExitCode2,
      ascii: !!argv.ascii,
      withVerify: !!argv["with-verify"],
      outJson: argv["out-json"],
      summaryOnly: !!argv["summary-only"],
      saveBaseline: !!argv["save-baseline"]
    };
  }
  const raw = await readStdin();
  if (!raw) writeError("no input: pass --os-file/--db-file or JSON on stdin");
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    writeError(`invalid JSON on stdin: ${e instanceof Error ? e.message : String(e)}`);
  }
  const { osStdout, dbStdout, dbStderr, dbExitCode } = obj;
  if (typeof osStdout !== "string" || typeof dbStdout !== "string") {
    writeError("osStdout and dbStdout required as strings");
  }
  return {
    engine,
    osStdout,
    dbStdout,
    dbStderr: typeof dbStderr === "string" ? dbStderr : "",
    dbExitCode: typeof dbExitCode === "number" ? dbExitCode : 0,
    ascii: !!argv.ascii,
    withVerify: !!argv["with-verify"],
    outJson: argv["out-json"],
    summaryOnly: !!argv["summary-only"],
    saveBaseline: !!argv["save-baseline"]
  };
}
function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a || !a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}
async function readFileSafe(path, label) {
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    try {
      return await readFile(path, "utf8");
    } catch (e2) {
      writeError(
        `failed to read ${label} (${path}): ${e2 instanceof Error ? e2.message : String(e2)}`
      );
    }
  }
}
async function readStdin() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}
function writeError(message) {
  process.stdout.write(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}
main().catch((err) => {
  writeError(err instanceof Error ? err.message : String(err));
});
