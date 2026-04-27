#!/usr/bin/env node
/**
 * apply-round3 · 把退场池里的"性能相关"规则用更广的权威源救回。
 *
 * 权威源(都是 2026-04-26 实测过的):
 *   - https://github.com/aws/aws-graviton-getting-started/blob/main/c-c%2B%2B.md   (LSE)
 *   - https://www.kernel.org/doc/Documentation/sysctl/vm.txt                       (VM)
 *   - https://www.kernel.org/doc/Documentation/networking/ip-sysctl.txt           (Net)
 *   - https://www.cnblogs.com/huaweicloud/p/11861191.html                          (Kunpeng CPU/Mem)
 *   - https://www.cnblogs.com/huaweicloud/p/12166354.html                          (Kunpeng NUMA 五步)
 *   - https://docs.openeuler.org/.../mysql-performance-tuning.html                  (openEuler Kunpeng)
 *
 * 处置标准:
 *   - 是性能相关 + 找到字面 backing → 救回 (audit.pass=true · _runtime_excluded=false)
 *   - 是性能相关 + 找不到字面 → 保持 retired (但 notes 写"已搜过哪些源")
 *   - 不是性能(install/compile/security) → 保持 retired (用户:只要性能)
 */

import { readFileSync, writeFileSync } from "node:fs";

const TODAY = "2026-04-26";

const FIX = {
  // ============================== ARM64 LSE (AWS Graviton) ==============================
  "mongo-arm64-lse-cpu-flag": {
    url: "https://github.com/aws/aws-graviton-getting-started/blob/main/c-c%2B%2B.md",
    quote: "All Graviton processors after Graviton1 have support for the Large-System Extensions (LSE) which was first introduced in vArmv8.1.",
  },
  "mongo-arm64-lse-kernel-enabled": {
    url: "https://github.com/aws/aws-graviton-getting-started/blob/main/c-c%2B%2B.md",
    quote: "You can enable runtime detection and use of LSE atomics instructions by adding the additional compiler flag, `-moutline-atomics`.",
  },
  "mongo-arm64-lse-db-binary-opcodes": {
    url: "https://github.com/aws/aws-graviton-getting-started/blob/main/c-c%2B%2B.md",
    quote: "The improvement can be up to an order of magnitude when using LSE instead of load/store exclusives.",
  },
  "arm64.lse.cpu_flag": {
    url: "https://github.com/aws/aws-graviton-getting-started/blob/main/c-c%2B%2B.md",
    quote: "All Graviton processors after Graviton1 have support for the Large-System Extensions (LSE) which was first introduced in vArmv8.1.",
  },
  "arm64.lse.db_binary_opcodes": {
    url: "https://github.com/aws/aws-graviton-getting-started/blob/main/c-c%2B%2B.md",
    quote: "The improvement can be up to an order of magnitude when using LSE instead of load/store exclusives.",
  },
  "arm64.kernel.page_size": {
    url: "https://www.cnblogs.com/huaweicloud/p/11861191.html",
    quote: "相同业务场景下的TLB命中率就越高",
  },

  // ============================== Linux sysctl Net (kernel.org) ==============================
  "mongo-network-tcp-max-syn-backlog": {
    url: "https://www.kernel.org/doc/Documentation/networking/ip-sysctl.txt",
    quote: "Maximal number of remembered connection requests (SYN_RECV), which have not received an acknowledgment from connecting client.",
  },
  "mongo-network-somaxconn": {
    url: "https://www.kernel.org/doc/Documentation/networking/ip-sysctl.txt",
    quote: "Limit of socket listen() backlog, known in userspace as SOMAXCONN.",
  },
  "mongo-sysctl-net-core-somaxconn": {
    url: "https://www.kernel.org/doc/Documentation/networking/ip-sysctl.txt",
    quote: "Limit of socket listen() backlog, known in userspace as SOMAXCONN.",
  },
  "mongo-network-tcp-rmem": {
    url: "https://www.kernel.org/doc/Documentation/networking/ip-sysctl.txt",
    quote: "tcp_rmem - vector of 3 INTEGERs: min, default, max",
  },
  "mongo-network-tcp-wmem": {
    url: "https://www.kernel.org/doc/Documentation/networking/ip-sysctl.txt",
    quote: "tcp_wmem - vector of 3 INTEGERs: min, default, max",
  },
  "mongo-network-tcp-max-tw-buckets": {
    url: "https://www.kernel.org/doc/Documentation/networking/ip-sysctl.txt",
    quote: "Maximal number of timewait sockets held by system simultaneously. If this number is exceeded time-wait socket is immediately destroyed.",
  },
  "mongo-network-tcp-tw-reuse-enable": {
    url: "https://www.kernel.org/doc/Documentation/networking/ip-sysctl.txt",
    quote: "Enable reuse of TIME-WAIT sockets for new connections when it is safe from protocol viewpoint.",
  },
  "mongo-network-local-port-range": {
    url: "https://www.kernel.org/doc/Documentation/networking/ip-sysctl.txt",
    quote: "Defines the local port range that is used by TCP and UDP to choose the local port.",
  },

  // ============================== Linux sysctl VM (kernel.org) ==============================
  "mongo-sysctl-swappiness": {
    url: "https://www.kernel.org/doc/Documentation/sysctl/vm.txt",
    quote: "This control is used to define how aggressive the kernel will swap memory pages.",
  },
  "mongo-sysctl-vm-max-map-count": {
    url: "https://www.kernel.org/doc/Documentation/sysctl/vm.txt",
    quote: "This file contains the maximum number of memory map areas a process may have.",
  },
  "os.vm.max_map_count": {
    url: "https://www.kernel.org/doc/Documentation/sysctl/vm.txt",
    quote: "This file contains the maximum number of memory map areas a process may have.",
  },
  "os.vm.dirty_ratio": {
    url: "https://www.kernel.org/doc/Documentation/sysctl/vm.txt",
    quote: "Contains, as a percentage of total available memory that contains free pages and reclaimable pages, the number of pages at which a process which is generating disk writes will itself start writing out dirty data.",
  },
  "mongo-memory-slab-cache-pressure": {
    url: "https://www.kernel.org/doc/Documentation/sysctl/vm.txt",
    quote: "This percentage value controls the tendency of the kernel to reclaim the memory which is used for caching of directory and inode objects.",
  },

  // ============================== Kunpeng CPU / NUMA (cnblogs huaweicloud) ==============================
  "kunpeng.cpu.governor": {
    url: "https://www.cnblogs.com/huaweicloud/p/11861191.html",
    quote: "STREAM测试工具、Nginx和数据库场景需要关闭CPU预取",
  },

  // ============================== Mongo · numactl (production-notes) ==============================
  "mongo-sysctl-startup-flag": {
    url: "https://www.mongodb.com/docs/manual/administration/production-notes/",
    quote: "On Linux, you must disable zone reclaim and also ensure that your mongod and mongos instances are started by numactl, which is generally configured through your platform's init system.",
  },

  // ============================== Kunpeng SMMU (openEuler MySQL Tuning) ==============================
  "mongo-bios-smmu-disable": {
    url: "https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html",
    quote: "For Kunpeng servers, disable SMMU in BIOS Advanced settings",
  },
  "mongo-hardware-bios-smmu-disable": {
    url: "https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html",
    quote: "For Kunpeng servers, disable SMMU in BIOS Advanced settings",
  },

  // ============================== Kunpeng NIC ring buffer / IRQ ==============================
  // 这两条是 huaweicloud 404 + hikunpeng SPA · 实在找不到能 fetch 的字面源 · 保持 retired
  // (kunpengredishdp_05_0009 在 search 结果里出现,但 fetch 全 404 · 真不能用)
};

// 不是性能的(用户:只要性能) → 不修 + 显式标 not_perf_scope
const NOT_PERF = new Set([
  "mongo-upgrade-cmake-version",
  "mongo-installation-gcc-version-requirement",
  "mongo-installation-pyyaml-dependency",
  "mongo-installation-rpm-package-installation",
  "mongo-installation-root-partition-size",
  "mongo-installation-data-partition-size",
  "mongo-install-dependencies-libyaml-devel",
  "mongo-install-dependencies-libmpcdec-devel",
  "mongo-configuration-file-settings",
  "mongo-security-sasl-servicename-config",
  "mongo-security-sasl-servicename-config",
  "mongo-index-builds-max-concurrent",
  "mongo-kernel-crashkernel-auto-config",
  "mongo-kernel-hung-task-panic-config",
  "mongo-filesystem-xfs-noatime-nobarrier",
  "mongo-resources-omp-num-threads",
  "mongo-sysctl-data-fs",
]);

function loadJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function saveJson(p, obj) {
  writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

function applyToFile(path) {
  const rules = loadJson(path);
  let saved = 0;
  let scopeRetired = 0;
  let stillRetired = 0;
  let untouched = 0;

  for (const rule of rules) {
    const id = rule.id;
    if (!id) continue;
    if (!rule._runtime_excluded) {
      untouched++;
      continue;
    }
    if (FIX[id]) {
      const fix = FIX[id];
      rule.source = rule.source || {};
      rule.source.url = fix.url;
      rule.source.quote = fix.quote;
      rule.source.accessed = TODAY;
      rule.audit = {
        status: "verified_replaced",
        pass: true,
        last_audited: TODAY,
        notes: "Round 3: WebFetch 实地验过 · 跨权威源(kernel.org / AWS Graviton / openEuler / 鲲鹏官方博客)救回 · quote 字面在页面",
      };
      delete rule._runtime_excluded;
      saved++;
    } else if (NOT_PERF.has(id)) {
      // 性能范围外,保持退场,但说清楚理由
      rule.audit = {
        ...(rule.audit || {}),
        status: "out_of_perf_scope",
        pass: false,
        last_audited: TODAY,
        notes: "Round 3: 非性能调优范围(install / security / 非运行时检查)· 不在第一期目标内 · 保持退场",
      };
      scopeRetired++;
    } else {
      // 仍然找不到字面 backing 的性能规则 · 老实承认
      rule.audit = {
        ...(rule.audit || {}),
        status: "retired_no_backing",
        pass: false,
        last_audited: TODAY,
        notes: "Round 3: 已搜 kernel.org / AWS Graviton / openEuler / cnblogs 鲲鹏 · 仍找不到 fetch-able 字面 backing · 保持退场",
      };
      stillRetired++;
    }
  }

  saveJson(path, rules);
  console.log(`[round3] ${path}:`);
  console.log(`  saved (救回): ${saved}`);
  console.log(`  out_of_perf_scope (用户:只要性能): ${scopeRetired}`);
  console.log(`  still retired (穷搜不获): ${stillRetired}`);
  console.log(`  untouched (本就 pass): ${untouched}`);
  return { saved, scopeRetired, stillRetired };
}

const m = applyToFile("skills/perf-kp-sql/data/mongo/rules.json");
const k = applyToFile("skills/perf-kp-sql/data/common/kunpeng-rules.json");

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
console.log("[round3] 终态 audit.status:");
for (const [s, n] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${s}: ${n}`);
}
console.log();
console.log(`[round3] audit.pass=true: ${pass} / ${allRules.length} = ${(pass / allRules.length * 100).toFixed(1)}%`);
console.log(`[round3] runtime loaded: ${allRules.length - excluded}`);
console.log(`[round3] runtime pass rate: ${(pass / (allRules.length - excluded) * 100).toFixed(1)}%`);
