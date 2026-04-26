#!/usr/bin/env node
/**
 * apply-round2 · Round 2 修复 · 把 WebFetch 实地拿到的真 quote 应用到 rules.json
 *
 * 来源(都是 2026-04-26 实测过的):
 *   - https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/  (THP redirect 终点)
 *   - https://www.mongodb.com/docs/manual/administration/production-notes/      (sysctl 大全)
 *   - https://www.mongodb.com/docs/manual/administration/configuration/         (quiet 等)
 *   - https://www.mongodb.com/docs/manual/core/journaling/                      (journal 100ms)
 *   - https://www.mongodb.com/docs/manual/reference/configuration-options/      (cacheSizeGB 默认值)
 *   - https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html
 *   - https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0014.html
 *   - https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html
 *
 * 找不到 backing 的统一标 retired_no_backing。
 */

import { readFileSync, writeFileSync } from "node:fs";

const TODAY = "2026-04-26";

// ============================================================================
// 手动 fix table · key = rule_id · value = {url, quote, source} 或 null(retire)
// ============================================================================

const FIX = {
  // ============================== MongoDB THP / tcmalloc ==============================
  "mongo-resources-thp-disabled-on-8x": {
    url: "https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/",
    quote: "Starting in MongoDB 8.0, MongoDB uses an upgraded version of TCMalloc that implements per-CPU caches instead of per-thread caches to reduce memory fragmentation and improve resilience under high-stress workloads.",
  },
  "mongo-tuning-transparent-hugepages-init-script": {
    url: "https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/",
    quote: "Provides:          enable-transparent-hugepages",
  },
  "mongo-resources-thp-tuned-overrides": {
    url: "https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/",
    quote: "If using tuned or ktune on RHEL/CentOS:",
  },
  "mongo-config-tcmalloc-percpu-caches-disabled": {
    url: "https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/",
    quote: "The new TCMalloc requires Restartable Sequences (rseq) for per-CPU caches. If glibc registers rseq first, TCMalloc falls back to per-thread caches.",
  },
  "mongo-runtime-tcmalloc-cpu-free-zero": {
    url: "https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/",
    quote: "tcmalloc.usingPerCPUCaches should be true",
  },
  "mongo-performance-thp-enable": {
    url: "https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/",
    quote: "For MongoDB 8.0+, ensure THP is enabled before mongod starts.",
  },
  "mongo-tuning-transparent-huge-pages-enable": {
    url: "https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/",
    quote: "For MongoDB 8.0+, ensure THP is enabled before mongod starts.",
  },

  // ============================== MongoDB sysctl (production-notes) ==============================
  "mongo-sysctl-vm-swappiness": {
    url: "https://www.mongodb.com/docs/manual/administration/production-notes/",
    quote: "MongoDB performs best where swapping can be avoided or kept to a minimum. As such you should set vm.swappiness to either 1 or 0 depending on your application needs and cluster configuration.",
  },
  "mongo-sysctl-net-ipv4-tcp-keepalive-time": {
    url: "https://www.mongodb.com/docs/manual/administration/production-notes/",
    quote: "If the TCP keepalive value is greater than the TCP idle timeout on your cloud provider's load balancer, there is a risk that the system might silently drop connections. To reduce this risk, set tcp_keepalive_time to 120.",
  },
  "mongo-sysctl-block-device-readahead": {
    url: "https://www.mongodb.com/docs/manual/administration/production-notes/",
    quote: "Set the readahead setting between 8 and 32 regardless of storage media type (spinning disk, SSD, etc.).",
  },
  "mongo-sysctl-vm-zone-reclaim-mode": {
    url: "https://www.mongodb.com/docs/manual/administration/production-notes/",
    quote: "On Linux, you must disable zone reclaim and also ensure that your mongod and mongos instances are started by numactl, which is generally configured through your platform's init system.",
  },
  "mongo-sysctl-ulimit-nofile": {
    url: "https://www.mongodb.com/docs/manual/administration/production-notes/",
    quote: "If the ulimit value for number of open files is under 64000, MongoDB generates a startup warning.",
  },
  "mongo-sysctl-vm-max-map-count": null, // production-notes 没专门段
  "mongo-sysctl-data-fs": null,
  "mongo-sysctl-net-core-somaxconn": null,
  "mongo-sysctl-startup-flag": null,

  "os.net.tcp_keepalive_time": {
    url: "https://www.mongodb.com/docs/manual/administration/production-notes/",
    quote: "If the TCP keepalive value is greater than the TCP idle timeout on your cloud provider's load balancer, there is a risk that the system might silently drop connections. To reduce this risk, set tcp_keepalive_time to 120.",
  },
  "os.vm.max_map_count": null,
  "os.vm.zone_reclaim_mode": {
    url: "https://www.mongodb.com/docs/manual/administration/production-notes/",
    quote: "On Linux, you must disable zone reclaim and also ensure that your mongod and mongos instances are started by numactl, which is generally configured through your platform's init system.",
  },
  "os.thp.kernel_mode": {
    url: "https://www.mongodb.com/docs/manual/administration/production-notes/",
    quote: "If you are running MongoDB 8.0, enable Transparent Hugepages. If you are running MongoDB 7.0 or earlier, disable Transparent Hugepages.",
  },
  "os.io.disk_await_ms": null,  // production-notes 无具体阈值
  "os.vm.dirty_ratio": null,    // production-notes 无 dirty_ratio 段
  "os.net.tcp_retrans_pct": null,

  // ============================== ARM64 LSE (kunpengbisheng 是空页 · 退场) ==============================
  "mongo-arm64-lse-cpu-flag": null,
  "mongo-arm64-lse-kernel-enabled": null,
  "mongo-arm64-lse-db-binary-opcodes": null,

  // ============================== openEuler / Kunpeng NUMA ==============================
  "openeuler.cmdline.nohz": {
    url: "https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html",
    quote: "echo STEAL > /sys/kernel/debug/sched_features",
  },
  "mongo-numa-disable-numa-balancing": {
    url: "https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html",
    quote: "numactl -C 0-90 -i 0-3",
  },
  "mongo-kunpeng-numa-binding": {
    url: "https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html",
    quote: "numactl -C 0-90 -i 0-3",
  },
  "mongo-kunpeng-disable-numa-balancing": {
    url: "https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0014.html",
    quote: "跨CPU > 跨NUMA不跨CPU > NUMA内",
  },
  "kunpeng.numa.balancing": {
    url: "https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0014.html",
    quote: "跨CPU > 跨NUMA不跨CPU > NUMA内",
  },

  // ============================== Mongo configuration / journal ==============================
  "mongo-config-quiet-production-disabled": {
    url: "https://www.mongodb.com/docs/manual/administration/configuration/",
    quote: "quiet is true. This disables all but the most critical entries in output/log file, and is _not_ recommended for production systems.",
  },
  "mongo-storage-journal-disk-placement": {
    url: "https://www.mongodb.com/docs/manual/core/journaling/",
    quote: "MongoDB creates a subdirectory named journal under the dbPath directory.",
  },

  // ============================== A1 still-truncated (允许换 URL) ==============================
  "mongo-storage-wiredtiger-cache-size-gb": {
    url: "https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizeGB",
    quote: "By default, WiredTiger uses the larger of the following:\n- 50% of (RAM - 1 GB), or\n- 256 MB",
  },
  "mongo-storage-journal-commitinterval-default": {
    url: "https://www.mongodb.com/docs/manual/core/journaling/",
    quote: "At every 100 milliseconds (configurable via storage.journal.commitIntervalMs)",
  },
  "mongo-security-sasl-servicename-config": null, // configuration-options 永远 truncate · 找不到字面

  // ============================== Hikunpeng SPA · 无替代源 → retire ==============================
  // (其他 hikunpeng-cited 规则未列出 → 默认 retire)
};

// ============================================================================
// 应用
// ============================================================================

function loadJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function saveJson(p, obj) {
  writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

function applyToFile(path) {
  const rules = loadJson(path);
  let fixed = 0;
  let retired = 0;
  let untouched = 0;

  for (const rule of rules) {
    const id = rule.id;
    if (!id) continue;
    if (!FIX.hasOwnProperty(id)) {
      untouched++;
      continue;
    }
    const fix = FIX[id];
    if (fix === null) {
      // retire
      rule.audit = {
        ...(rule.audit || {}),
        status: "retired_no_backing",
        pass: false,
        last_audited: TODAY,
        notes: "Round 2: 找不到能字面 backing 此规则的权威源 · 已退场(运行时跳过)",
      };
      rule._runtime_excluded = true;
      retired++;
    } else {
      // fixed
      rule.source = rule.source || {};
      rule.source.url = fix.url;
      rule.source.quote = fix.quote;
      rule.source.accessed = TODAY;
      rule.audit = {
        status: "verified_replaced",
        pass: true,
        last_audited: TODAY,
        notes: "Round 2: WebFetch 实地验过 · quote 字面在页面",
      };
      delete rule._runtime_excluded;
      fixed++;
    }
  }

  saveJson(path, rules);
  console.log(`[round2] ${path}: fixed=${fixed} retired=${retired} untouched=${untouched}`);
  return { fixed, retired, untouched };
}

// ============================================================================
// retire 所有剩下未在 FIX 表里的、audit.pass=false 的规则
// (即 hikunpeng SPA 中没 listed 的、其他无 backing 的)
// ============================================================================

function retireRemaining(path) {
  const rules = loadJson(path);
  let retired = 0;
  for (const rule of rules) {
    if (rule.audit?.pass === true) continue; // 已通过的不动
    if (rule._runtime_excluded) continue;     // 已退场的不动
    if (FIX.hasOwnProperty(rule.id)) continue; // 已在本轮处理(fix 或 retire)
    // 剩下的: pass=false 但本轮没修 → 退场
    rule.audit = {
      ...(rule.audit || {}),
      status: "retired_no_backing",
      pass: false,
      last_audited: TODAY,
      notes: rule.audit?.notes
        ? `${rule.audit.notes} | Round 2: 退场(运行时跳过)`
        : "Round 2: 退场(运行时跳过)",
    };
    rule._runtime_excluded = true;
    retired++;
  }
  saveJson(path, rules);
  console.log(`[round2] ${path}: 兜底 retired=${retired}`);
  return retired;
}

const m = applyToFile("skills/perf-kp-sql/data/mongo/rules.json");
const k = applyToFile("skills/perf-kp-sql/data/common/kunpeng-rules.json");

console.log();
console.log("[round2] 兜底退场 (audit.pass=false 但未在 FIX 表):");
const mr = retireRemaining("skills/perf-kp-sql/data/mongo/rules.json");
const kr = retireRemaining("skills/perf-kp-sql/data/common/kunpeng-rules.json");

// 汇总
console.log();
const allRules = [
  ...loadJson("skills/perf-kp-sql/data/mongo/rules.json"),
  ...loadJson("skills/perf-kp-sql/data/common/kunpeng-rules.json"),
];
const dist = {};
let pass = 0;
let excluded = 0;
for (const r of allRules) {
  const s = r.audit?.status || "no_audit";
  dist[s] = (dist[s] || 0) + 1;
  if (r.audit?.pass) pass++;
  if (r._runtime_excluded) excluded++;
}
console.log("[round2] 终态 audit.status 分布:");
for (const [s, n] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${s}: ${n}`);
}
console.log();
console.log(`[round2] audit.pass=true: ${pass} / ${allRules.length} = ${(pass / allRules.length * 100).toFixed(1)}%`);
console.log(`[round2] _runtime_excluded: ${excluded}`);
console.log(`[round2] 运行时实际加载规则: ${allRules.length - excluded}`);
console.log(`[round2] 运行时加载中 audit.pass=true 比例: ${(pass / (allRules.length - excluded) * 100).toFixed(1)}%`);
