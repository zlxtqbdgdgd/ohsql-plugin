/**
 * shared/legacy-checks — Phase 4 整合 · 5 个 deprecated 模块合并到此一个文件。
 *
 * @deprecated 原 5 文件 (arm64-checks / kunpeng-checks / openeuler-checks /
 *             os-checks / rules-catalog) 内容原样收纳 · 待 rule-engine.ts +
 *             data/*\/rules.json 完成 67 条 CheckFn 迁移后整文件删除 (Phase 4)。
 *
 * 本文件由 4 个 *-checks.ts + rules-catalog.ts 内容拼接而成 · 各 section 间
 * 互不依赖 · 顶部 import 已合并。维护时请保持 section 边界清晰。
 */

import {
  type CheckFn,
  type CheckResult,
  type DiagContext,
  type EngineName,
  type Scope,
  deriveScope,
  finding,
  infoResult,
  okResult,
  osVal,
} from "../models.js";
import { toInt, toFloat, KUNPENG_REFS } from "./utils.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";


// ============================================================================
// SECTION: arm64-checks (原 src/shared/arm64-checks.ts)
// ============================================================================

function requireArm64(ctx: DiagContext, id: string, title: string, bucket: 1 | 2 | 3 | 4 | 5) {
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);
  if (scope.arch !== "arm64") {
    return {
      skip: infoResult({
        id,
        title,
        bucket,
        scope,
        summary: "规则仅适用 ARM64,已跳过",
        reason: `检测到 arch=${scope.arch ?? "unknown"}`,
        skip_reason: "arch_mismatch",
      }),
      scope,
    };
  }
  return { skip: null, scope };
}

// ---------------------------------------------------------------------------
// ARM64-01 · LSE atomics CPU 支持(lscpu)
// ---------------------------------------------------------------------------

export const check_arm64_lse_cpu: CheckFn = (ctx) => {
  const id = "arm64.lse.cpu_flag";
  const title = "LSE atomics CPU 支持";
  const { skip, scope } = requireArm64(ctx, id, title, 1);
  if (skip) return skip;

  const has = osVal<boolean>(ctx, "lse_cpu_atomics", false);
  const raw = osVal<string>(ctx, "lse_cpu_raw", "");
  if (!raw) {
    return infoResult({ id, title, bucket: 1, scope, summary: "未采集到 CPU flags", reason: "lscpu Flags 行读取失败" });
  }
  if (has) {
    return okResult({ id, title, bucket: 1, scope, summary: "atomics flag 已启用", reason: "CPU 支持 Armv8.1 LSE 原子指令" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: "CPU flags 未列出 atomics",
    description: "CPU 不支持 LSE atomics(Armv8.1+),退回 ldxr/stxr 循环,DB 竞争路径性能显著降低",
    reason: "lscpu | grep ^Flags: 未发现 atomics 标志",
    threshold_display: "atomics flag 存在",
    evidence: [{ kind: "config", value: `lscpu_flags=${raw.slice(0, 120)}` }],
    impact: { metric: "latency_p95_ms", value: 30, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.arm64Porting,
      { title: "AWS Graviton · ARM64 LSE atomics", url: "https://github.com/aws/aws-graviton-getting-started/blob/main/c-c%2B%2B.md" },
      { title: "AWS Graviton Technical Guide · optimizing", url: "https://github.com/aws/aws-graviton-getting-started/blob/main/optimizing.md" },
    ],
    recommendations: [
      {
        action: "升级到支持 Armv8.1 的 CPU · 或确认 BIOS 未禁用 LSE",
        rationale: "硬件 / BIOS 级 · 非 sysctl 可改",
        type: "detect",
        fix_cost: "restart_engine",
        verifiable: false,
      },
    ],
    surfaceable_only: true,
    rationale: {
      summary: "LSE(Large System Extensions · Armv8.1+)是 ARM64 多核原子指令集 · cas/ldadd/swp/stlr 等 · 现代 DB 的锁和原子计数几乎全走这些指令。CPU 不支持 LSE 时所有原子操作退化成 ldxr/stxr load-linked/store-conditional 循环 · 竞争下 retry 成本指数上升。",
      mechanism: "无 LSE 时一次 atomic increment 的冲突路径是:ldxr 把变量 load 到 exclusive monitor → 尝试 stxr · 若 monitor 被其他核踩到则失败 → loop 重来。16 核并发下每个 atomic op 平均重试 3-10 次 · 等同 3-10 倍指令数。带 LSE 时 cas/ldadd 是 single-cycle atomic · 硬件保证无重试。",
      trade_offs: "LSE 是硬件 + 内核 + 用户态三方协作 · 必须 Armv8.1+ 芯片 + 内核识别 + 二进制带 -march=armv8.1-a 或 -moutline-atomics。换 CPU 是硬成本但鲲鹏 920 / Graviton 2+ / Ampere Altra 原生支持 · 只需确认 BIOS 没禁。",
      when_to_deviate: "Armv8.0 老芯片(树莓派 3/4 · 早期工业板)· 只读 / 低并发场景下 LSE 影响可忽略。生产 OLTP / 高并发读写必须 LSE。",
    },
  });
};

// ---------------------------------------------------------------------------
// ARM64-02 · LSE atomics 内核已启用(dmesg)
// ---------------------------------------------------------------------------

export const check_arm64_lse_kernel: CheckFn = (ctx) => {
  const id = "arm64.lse.kernel_enabled";
  const title = "LSE atomics 内核日志";
  const { skip, scope } = requireArm64(ctx, id, title, 1);
  if (skip) return skip;

  const hasKernel = osVal<boolean>(ctx, "lse_dmesg_has_lse", false);
  if (!hasKernel) {
    // dmesg 可能权限不足 · 不直接报 warning,给 info 让人注意
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "dmesg 未显示 LSE atomics 启用信息",
      reason: "可能 dmesg 权限不足(非 root)或启动日志已轮转 · 可用 lscpu atomics 交叉确认",
    });
  }
  return okResult({ id, title, bucket: 1, scope, summary: "内核启动日志确认 LSE 启用", reason: "Linux 内核在启动时识别并启用了 LSE atomics" });
};

// ---------------------------------------------------------------------------
// ARM64-03 · DB 二进制 LSE opcode 计数(objdump)
// ---------------------------------------------------------------------------

function engineBinary(engine: EngineName): "mongod" | null {
  if (engine === "mongo") return "mongod";
  return null;
}

export const check_arm64_lse_binary: CheckFn = (ctx) => {
  const id = "arm64.lse.db_binary_opcodes";
  const title = "DB 二进制 LSE 指令";
  const { skip, scope } = requireArm64(ctx, id, title, 1);
  if (skip) return skip;
  const engine = scope.engine;
  const bin = engineBinary(engine);
  if (!bin) {
    return infoResult({ id, title, bucket: 1, scope, summary: `${engine} 不适用`, reason: "仅 mongod 需要检查" });
  }
  const count = osVal<number | null>(ctx, "lse_mongod_count", null);
  if (count === null) {
    return infoResult({ id, title, bucket: 1, scope, summary: `未找到 ${bin} 二进制`, reason: `command -v ${bin} 无返回(或 nm 不可用)` });
  }
  if (count > 0) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `${bin} .dynsym 含 ${count} 个 outline-atomics 符号`,
      reason: `二进制编译时带了 -moutline-atomics(默认 gcc 10+),运行期在鲲鹏 CPU 上会调度到 LSE 原子指令`,
    });
  }
  return finding({
    id,
    title,
    severity: "info",
    bucket: 1,
    scope,
    summary: `${bin} .dynsym 未发现 outline-atomics 符号 · 需手动确认 LSE 是否启用`,
    description: `${bin} 二进制 .dynsym 段没有 __aarch64_(cas|ldadd|swp|ldset) 等 outline-atomics 动态符号。这有三种可能,无法靠 nm -D 区分: (a) 编译时既没带 -moutline-atomics 也没 -march=armv8.1-a+lse · 竞争路径退回 ldxr/stxr · ARM64 上吞吐腰斩(最常见 · 老 distro repo build); (b) 用 -march=armv8.1-a+lse 直接内联 LSE · 已是最优 build 但 outline 符号自然不出现; (c) 静态链接 libgcc · outline-atomics 函数被 inline 进二进制 · 也不在 .dynsym。建议手动 readelf -A / 或对比 perf 火焰图的 ldxr/stxr 占比来区分。`,
    reason: `nm -D $(command -v ${bin}) 中 __aarch64_(have_lse_atomics|cas|ldadd|swp|ldset) 等 outline-atomics 动态符号出现 0 次 · 但无法据此独立判断是否走了 LSE`,
    threshold_display: "> 0 outline-atomics symbols (info-only · 不判 warning)",
    evidence: [{ kind: "metric", value: `lse_outline_symbols_${bin}=0` }],
    impact: { metric: "throughput_qps", value: 25, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.arm64Porting,
      { title: "AWS Graviton · C/C++ LSE (-moutline-atomics)", url: "https://github.com/aws/aws-graviton-getting-started/blob/main/c-c%2B%2B.md" },
      { title: "Percona · ARM64 MySQL builds", url: "https://www.percona.com/blog/percona-server-for-mysql-and-percona-xtrabackup-now-available-for-arm64/" },
    ],
    recommendations: [
      {
        action: `换装带 LSE 的 ${bin} 构建(Percona ARM64 RPM / 自编译 -march=armv8.1-a / -moutline-atomics)`,
        rationale: "LSE atomics 是 ARM64 DB 吞吐的最大单一杠杆",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: true,
      },
    ],
    rationale: {
      summary: "即使 CPU 和内核都支持 LSE · DB 二进制本身必须用 LSE-aware 编译器构建才能用上。老发行版 repo 的 mongod / mysqld 常是 -march=armv8-a 构建 · 运行在鲲鹏上也是 ldxr 循环 · 硬件白给不用。",
      mechanism: "二进制里有没有 outline-atomics 看 nm -D 输出中的 __aarch64_(have_lse_atomics|cas|ldadd|swp|ldset) 等动态符号。若 0 命中说明编译器既没带 -march=armv8.1-a+lse(内联 LSE),也没带 -moutline-atomics(默认 gcc10+)。后者更实用:编译时生成 runtime-dispatch · 老 CPU 走 ldxr 路径 · LSE CPU 走 cas 路径 · 一个二进制两处跑。nm -D 只读 .dynsym 段,毫秒级,远比 objdump -d 反汇编整段二进制要快(避免 30~120s 超时)。",
      trade_offs: "换带 LSE 的二进制需要重装 package(Percona ARM64 repo / MongoDB 官方 aarch64 rpm)或自编译。重装引入 engine restart · rolling restart 无损。LSE 吞吐增益在高竞争 OLTP 场景可达 25-40%。",
      when_to_deviate: "受限环境只能装发行版 repo 二进制时没得选。可考虑 LD_PRELOAD 的 glibc atomics 兼容层 · 但效果不如重编译彻底。",
    },
  });
};

// ---------------------------------------------------------------------------
// ARM64-04 · kernel 页大小(INFO)
// ---------------------------------------------------------------------------

export const check_arm64_pagesize: CheckFn = (ctx) => {
  const id = "arm64.kernel.page_size";
  const title = "ARM64 内核页大小";
  const { skip, scope } = requireArm64(ctx, id, title, 1);
  if (skip) return skip;

  const sz = toInt(osVal(ctx, "pagesize_bytes", 0), 0);
  if (sz === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "未采集 PAGESIZE", reason: "getconf PAGESIZE 无返回" });
  }
  const label = sz === 4096 ? "4K(发行版默认)" : sz === 16384 ? "16K" : sz === 65536 ? "64K(大 buffer DB 可选)" : `${sz}B`;
  return infoResult({
    id,
    title,
    bucket: 1,
    scope,
    summary: `PAGESIZE=${sz} · ${label}`,
    reason: "大 buffer DB 可选 64K 减 TLB stall,但要先用 perf stat -e stall_frontend_tlb 测量收益",
  });
};

export const arm64Checks: ReadonlyArray<CheckFn> = [
  check_arm64_lse_cpu,
  check_arm64_lse_kernel,
  check_arm64_lse_binary,
  check_arm64_pagesize,
];

// ============================================================================
// SECTION: kunpeng-checks (原 src/shared/kunpeng-checks.ts)
// ============================================================================

// ---------------------------------------------------------------------------
// Scope gating · 非鲲鹏直接 skip(infoResult 表达"未适用"),不制造噪音
// ---------------------------------------------------------------------------

function requireKunpeng(ctx: DiagContext, id: string, title: string, bucket: 1 | 2 | 3 | 4 | 5): { scope: Scope } | CheckResult {
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);
  if (scope.vendor !== "kunpeng") {
    return infoResult({
      id,
      title,
      bucket,
      scope,
      summary: "规则仅适用 Kunpeng ARM64,已跳过",
      reason: `检测到 vendor=${scope.vendor ?? "unknown"} · arch=${scope.arch ?? "unknown"},非鲲鹏平台`,
      skip_reason: "vendor_mismatch",
    });
  }
  return { scope };
}

// ---------------------------------------------------------------------------
// K-CPU-GOV · CPU 调频策略
// ---------------------------------------------------------------------------

export const check_cpu_governor: CheckFn = (ctx) => {
  const id = "kunpeng.cpu.governor";
  const title = "CPU Governor 调频策略";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;

  const governor = osVal<string>(ctx, "cpu_governor", "");
  if (!governor || governor === "SKIP") {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "未采集到 scaling_governor",
      reason: "cpufreq 不可读(可能内核不支持或权限不足)",
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
      reason: "已配置高性能调频策略",
    });
  }

  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `governor=${bad.join(",")} 非高性能模式`,
    description: "CPU 调频策略在 powersave/ondemand 下,负载峰值会因频率切换引入额外延迟,鲲鹏上尤其明显。",
    reason: `governor=${governor} · 数据库生产场景要求 performance`,
    threshold_display: "performance",
    evidence: [
      { kind: "config", value: `scaling_governor=${governor}`, source_url: "/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor" },
    ],
    impact: { metric: "latency_p95_ms", value: 15, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitOverview,
      { title: "Ampere Redis Setup and Tuning Guide · CPU scaling", url: "https://amperecomputing.com/en/tuning-guides/Redis-setup-and-tuning-guide" },
      { title: "openEuler MySQL Performance Tuning", url: "https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html" },
    ],
    recommendations: [
      {
        action: "echo performance | tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor",
        rationale: "DB 生产负载要求频率稳定,避免调频引入抖动",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
    rationale: {
      summary: "CPU governor 控制频率动态调节 · powersave/ondemand 在低负载时降频省电 · 突发请求时需 μs 级爬频 · DB 场景下容易让 p99 延迟抖动。performance 固定最高频 · 稳态功耗略高但性能可预测。",
      mechanism: "ondemand 每 10ms 采样 CPU 利用率决定是否升频 · 升频要 CPU 发 PMIC 命令 · 典型 50-200μs 延迟。DB 请求命中低频窗口时 · 开始处理后才触发升频 · 首 request 额外拉长 100μs+。performance 避开这个抖动 · 代价是闲时持续高频。",
      trade_offs: "performance 比 powersave 整机功耗高 10-20W(2U 鲲鹏 920 服务器典型)· 换来 p99 稳定。生产 DB 物理机几乎都该 performance · 功耗敏感的边缘节点可保 ondemand。",
      when_to_deviate: "VM / 容器场景 governor 常由 hypervisor 控制 · cpufreq 接口可能无效 · 此时需 hypervisor 层配置。测试 / 开发环境功耗优先可保 powersave。",
    },
  });
};

// ---------------------------------------------------------------------------
// K-NUMA · NUMA 自动平衡
// ---------------------------------------------------------------------------

export const check_numa: CheckFn = (ctx) => {
  const id = "kunpeng.numa.balancing";
  const title = "NUMA 自动平衡";
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
      summary: `nodes=${numa_nodes} · balancing=${numa_balancing}`,
      reason: "单 NUMA 节点或已关闭自动平衡",
    });
  }

  return finding({
    id,
    title,
    severity: "critical",
    bucket: 1,
    scope,
    summary: `NUMA balancing=${numa_balancing} 且 ${numa_nodes} 节点`,
    description: "鲲鹏 920 双路物理机典型 4 NUMA 节点,开启自动平衡会导致跨 die/socket 内存迁移,引入远端访存延迟。",
    reason: `numa_nodes=${numa_nodes} · numa_balancing=${numa_balancing} · 多节点下 balancing 会引发严重远端内存访问延迟`,
    threshold_display: "== 0",
    evidence: [
      { kind: "metric", value: `numa_nodes=${numa_nodes}` },
      { kind: "config", value: `numa_balancing=${numa_balancing}`, source_url: "/proc/sys/kernel/numa_balancing" },
    ],
    impact: { metric: "latency_p95_ms", value: 30, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.troubleshooting,
      { title: "Huawei Kunpeng NUMA 5-Step Tuning", url: "https://www.cnblogs.com/huaweicloud/p/12166354.html" },
      { title: "Chips and Cheese · Kunpeng 920 / TaiShan v110 architecture", url: "https://chipsandcheese.com/p/huaweis-kunpeng-920-and-taishan-v110" },
    ],
    recommendations: [
      {
        action: "echo 0 > /proc/sys/kernel/numa_balancing",
        rationale: "关闭自动平衡,配合 numactl --cpunodebind/--membind 绑定 DB 进程到固定节点",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
    rationale: {
      summary: "鲲鹏 920 双路物理机有 4 NUMA 节点(每 CPU 2 die × 2 socket)· 开启 numa_balancing 内核会定期迁移进程页到 access-local 节点 · 但 DB 工作集跨节点共享 · 迁移反复来回 · 反而让 remote access 比例更高。",
      mechanism: "numa_balancing=1 时内核 sched 周期性扫描每个进程的 working set · 发现跨节点 access hotspot 就迁移页面到被频繁访问的 CPU 所在 node。DB 连接线程被 scheduler 跨核调度 · 迁移追不上调度变化 · 产生 ping-pong。鲲鹏 920 远端访存延迟 2-3× 本地 · 多节点系统上造成整体延迟方差翻倍。",
      trade_offs: "关闭 numa_balancing 要求手动用 numactl 或 systemd CPUAffinity 把 mongod/mysqld/redis 绑到固定 node · 增加部署复杂度。换来延迟稳定。鲲鹏 920 场景下关闭收益明显大于开启。",
      when_to_deviate: "单路单节点 / VM 单 vnode 下 numa_balancing 不做跨节点工作 · 留着无害。决策前先看 numactl -H 确认节点数。",
    },
  });
};

// ---------------------------------------------------------------------------
// K-SMT · 硬件属性披露(INFO)
// ---------------------------------------------------------------------------

export const check_smt: CheckFn = (ctx) => {
  const id = "kunpeng.smt.threads_per_core";
  const title = "SMT · CPU 每核线程数";
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
      summary: "未采集到 Thread(s) per core",
      reason: "lscpu 未返回字段",
    });
  }
  return infoResult({
    id,
    title,
    bucket: 1,
    scope,
    summary: `${threadsPerCore} thread(s)/core`,
    reason: threadsPerCore === 1
      ? "鲲鹏 920 无 SMT(logical=physical),线程池按物理核数配置即可"
      : "多线程/核 · 线程池按物理核数配,避免误乘 threads/core",
  });
};

// ---------------------------------------------------------------------------
// K-NUMA-TOPO · NUMA 节点拓扑(INFO 级架构信息)
// ---------------------------------------------------------------------------

export const check_numa_topology: CheckFn = (ctx) => {
  const id = "kunpeng.numa.topology";
  const title = "NUMA 节点拓扑";
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
      summary: "未采集到 NUMA 节点数",
      reason: "未能读取 /sys/devices/system/node",
    });
  }
  const label =
    nodes >= 4 ? "2P 鲲鹏物理机典型(4 节点)"
      : nodes === 2 ? "单路鲲鹏或虚拟机(2 节点)"
        : "单节点(VM 或单路裁剪型号)";
  return infoResult({
    id,
    title,
    bucket: 1,
    scope,
    summary: `${nodes} 节点(${label})`,
    reason: "拓扑信息 · 影响分片部署/线程绑核架构决策",
  });
};

// ---------------------------------------------------------------------------
// K-IRQBALANCE · IRQ 分配守护进程
// ---------------------------------------------------------------------------

export const check_irqbalance: CheckFn = (ctx) => {
  const id = "kunpeng.irqbalance.active";
  const title = "irqbalance IRQ 均衡";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;

  const active = osVal<string>(ctx, "irqbalance_active", "");
  if (!active || active === "unknown") {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "未采集到 irqbalance 状态",
      reason: "systemctl 不可用或未安装 irqbalance",
    });
  }
  if (active === "active") {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "irqbalance active",
      reason: "IRQ 自动分散到各 CPU 核",
    });
  }

  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `irqbalance ${active}`,
    description: "irqbalance 未运行时 IRQ 容易集中到 CPU0,高并发 DB 场景打满单核。",
    reason: `irqbalance=${active} · 未绑定 IRQ 亲和性时 IRQ 集中 CPU0,高并发打满单核`,
    threshold_display: "active",
    evidence: [
      { kind: "config", value: `irqbalance=${active}` },
    ],
    impact: { metric: "latency_p95_ms", value: 10, unit: "percent", confidence: "medium" },
    citations: [
      { title: "Red Hat Performance Tuning · IRQ balancing", url: "https://access.redhat.com/sites/default/files/attachments/rhel7_numa_perf_brief.pdf" },
    ],
    recommendations: [
      {
        action: "systemctl enable --now irqbalance",
        rationale: "启动 irqbalance 让内核自适应分散中断;或手动 /proc/irq/$irq/smp_affinity_list 绑定",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
    rationale: {
      summary: "irqbalance 是 userspace daemon · 把网卡 / 存储 / 其它 PCI 设备的硬中断均匀分散到各 CPU。未启动时 IRQ 默认集中在 CPU0 · 高并发 DB 场景下 CPU0 被中断打满 · DB 连接线程也抢 CPU0 · 整机变瓶颈。",
      mechanism: "Linux 启动时默认把所有 IRQ 的 smp_affinity 设成 CPU0 · 除非 irqbalance 启动后动态调整。鲲鹏 920 单机常见 64/128 核 · 不分散 IRQ 就是 1/64 的 CPU 在服务网络 · softirq 排队 · 网络收包延迟放大。DB 客户端感知到的是 p95/p99 抖动。",
      trade_offs: "启 irqbalance 对 CPU 开销极小(< 1%)· 兼容性好。对超低延迟场景(HFT / in-memory KV)可选择关 irqbalance 并手动绑定特定 IRQ 到专门的核 · 但需要精细调优。通用 DB 部署启 irqbalance 即可。",
      when_to_deviate: "已手动绑定 IRQ smp_affinity 的专业调优场景 · 保持手动绑定即可不启 irqbalance。单核 / VM 场景 irqbalance 意义不大但无害。",
    },
  });
};

// ---------------------------------------------------------------------------
// K-NUMA-DIST · 距离矩阵感知(鲲鹏 920 四节点专有)
// ---------------------------------------------------------------------------

export const check_numa_distance_matrix: CheckFn = (ctx) => {
  const id = "kunpeng.numa.distance_matrix";
  const title = "NUMA 距离矩阵";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;

  const raw = osVal<string>(ctx, "numa_dist_raw", "");
  const max = toInt(osVal(ctx, "numa_dist_max", 0), 0);
  const min = toInt(osVal(ctx, "numa_dist_min", 0), 0);
  if (!raw || max === 0) {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "未采集 NUMA 距离矩阵",
      reason: "numactl -H 不可用或不含 distances 段",
    });
  }
  // 均匀矩阵(max==min)意味着只有一种距离 · 可能是单路 / VM / 单节点
  if (max === min) {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `距离均匀 · 所有节点距离 = ${max}`,
      reason: "单路鲲鹏或虚拟机 · 无跨 die/socket 成本差异,无需分片绑核优化",
    });
  }
  // 鲲鹏 920 典型:同 SCCL ~10 · 跨 SCCL 同 socket ~15 · 跨 socket ~20
  return okResult({
    id,
    title,
    bucket: 1,
    scope,
    summary: `距离非对称 min=${min} max=${max}`,
    description: "检测到跨 die/socket 距离差 · 建议用 numactl --cpunodebind/--membind 把 DB 进程绑到单节点,避免远端访存",
    reason: "多 NUMA 节点布局需要绑核部署",
  });
};

// ---------------------------------------------------------------------------
// K-NET-SOMAXCONN-STRICT · 鲲鹏 BoostKit Mongo 严格阈值(≥ 65535)
// ---------------------------------------------------------------------------

export const check_kunpeng_somaxconn_strict: CheckFn = (ctx) => {
  const id = "kunpeng.net.somaxconn_strict";
  const title = "somaxconn";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;

  const val = toInt(osVal(ctx, "net_somaxconn", 0), 0);
  if (val === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "未采集 somaxconn", reason: "sysctl 不可读" });
  }
  if (val >= 65535) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `somaxconn=${val}`,
      reason: "已达鲲鹏 BoostKit Mongo 推荐 ≥ 65535",
      threshold_display: "≥ 65535",
      citations: [{ title: "鲲鹏 BoostKit · MongoDB 调优 · somaxconn", url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html" }],
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `somaxconn=${val} < 65535`,
    description: "鲲鹏 BoostKit MongoDB 调优指南要求 net.core.somaxconn ≥ 65535,通用 Linux 1024 的阈值在鲲鹏高并发 DB 下偏小",
    reason: `net.core.somaxconn=${val} · 鲲鹏官方建议 ≥ 65535`,
    threshold_display: "≥ 65535",
    evidence: [{ kind: "config", value: `net.core.somaxconn=${val}` }],
    impact: { metric: "connection_util_pct", value: 10, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
    ],
    recommendations: [
      {
        action: "sysctl -w net.core.somaxconn=65535",
        rationale: "对齐鲲鹏 BoostKit DB 调优建议 · 避开高并发 SYN 丢包",
        type: "mitigate",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// K-NET-TCP-KEEPALIVE-STRICT · 鲲鹏 BoostKit Mongo 明确 == 120s
// ---------------------------------------------------------------------------

export const check_kunpeng_tcp_keepalive_strict: CheckFn = (ctx) => {
  const id = "kunpeng.net.tcp_keepalive_time_strict";
  const title = "TCP keepalive";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;

  const kt = toInt(osVal(ctx, "tcp_keepalive_time", 0), 0);
  if (kt === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "未采集", reason: "sysctl 不可读" });
  }
  // 鲲鹏 BoostKit + MongoDB 官方:120s
  if (kt === 120) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `tcp_keepalive_time=120s`,
      reason: "已对齐鲲鹏 BoostKit MongoDB 调优推荐值",
      threshold_display: "== 120s",
      citations: [{ title: "鲲鹏 BoostKit · MongoDB 调优 · tcp_keepalive_time", url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html" }],
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
      reason: "已低于 Linux 默认 7200s · 但鲲鹏 BoostKit 明确推荐 120s(官方阈值)",
      threshold_display: "== 120s",
      citations: [{ title: "鲲鹏 BoostKit · MongoDB 调优", url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html" }],
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `tcp_keepalive_time=${kt}s 偏离推荐值 120s`,
    description: "鲲鹏 BoostKit MongoDB 调优指南明确 net.ipv4.tcp_keepalive_time=120,高于 300s 会让断连感知延迟过大",
    reason: `tcp_keepalive_time=${kt}s · 鲲鹏官方推荐 120s`,
    threshold_display: "== 120s",
    evidence: [{ kind: "config", value: `net.ipv4.tcp_keepalive_time=${kt}` }],
    impact: { metric: "connection_util_pct", value: 8, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Production Notes · TCP keepalive", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" },
    ],
    recommendations: [
      {
        action: "sysctl -w net.ipv4.tcp_keepalive_time=120",
        rationale: "对齐鲲鹏 BoostKit + MongoDB Production Notes 双文档推荐",
        type: "mitigate",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// K-VM-SWAPPINESS-STRICT · 鲲鹏 BoostKit 明确 == 1
// ---------------------------------------------------------------------------

export const check_kunpeng_swappiness_strict: CheckFn = (ctx) => {
  const id = "kunpeng.vm.swappiness_strict";
  const title = "swappiness";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;

  const val = toInt(osVal(ctx, "swappiness", -1), -1);
  if (!Number.isInteger(val) || val < 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "未采集 swappiness", reason: "sysctl 不可读" });
  }
  if (val <= 1) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `swappiness=${val}`,
      reason: "已对齐鲲鹏 BoostKit 推荐",
      threshold_display: "== 1",
      citations: [{ title: "鲲鹏 BoostKit · MongoDB 调优 · vm.swappiness", url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html" }],
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
      reason: "低于 10 · 通用可接受;但鲲鹏 BoostKit 明确 == 1(更严)",
      threshold_display: "== 1",
      citations: [{ title: "鲲鹏 BoostKit · MongoDB 调优", url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html" }],
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `swappiness=${val} 不符鲲鹏严格阈值`,
    description: "鲲鹏 BoostKit 调优指南原文:将 vm.swappiness 设置为较低值 \"1\" 以减少交换分区使用",
    reason: `vm.swappiness=${val} · 鲲鹏官方推荐 1`,
    threshold_display: "== 1",
    evidence: [{ kind: "config", value: `vm.swappiness=${val}` }],
    impact: { metric: "latency_p95_ms", value: 15, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
    ],
    recommendations: [
      {
        action: "sysctl -w vm.swappiness=1",
        rationale: "对齐鲲鹏 BoostKit MongoDB 调优指南",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// K-NET-TCP-MAX-SYN-BACKLOG-MONGO · 鲲鹏 Mongo ≥ 8192
// ---------------------------------------------------------------------------

export const check_kunpeng_tcp_max_syn_backlog_mongo: CheckFn = (ctx) => {
  const id = "kunpeng.net.tcp_max_syn_backlog_mongo";
  const title = "tcp_max_syn_backlog · 鲲鹏 Mongo";
  const gate = requireKunpeng(ctx, id, title, 1);
  if ("severity" in gate) return gate;
  const { scope } = gate;
  // 避免与 redis 版重复
  if (scope.engine !== "mongo") {
    return infoResult({ id, title, bucket: 1, scope, summary: "仅对 MongoDB", reason: `db_type=${scope.engine}` });
  }
  const val = toInt(osVal(ctx, "tcp_max_syn_backlog", 0), 0);
  if (val === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "未采集", reason: "sysctl 不可读" });
  }
  if (val >= 8192) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `tcp_max_syn_backlog=${val}`,
      reason: "已达鲲鹏 BoostKit Mongo 推荐 ≥ 8192",
      threshold_display: "≥ 8192",
      citations: [{ title: "鲲鹏 BoostKit · MongoDB 调优 · tcp_max_syn_backlog", url: "https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0029.html" }],
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `tcp_max_syn_backlog=${val} < 8192`,
    description: "鲲鹏 BoostKit MongoDB 调优指南要求 tcp_max_syn_backlog ≥ 8192 以承接高并发 SYN 请求",
    reason: `net.ipv4.tcp_max_syn_backlog=${val} · 鲲鹏官方建议 ≥ 8192`,
    threshold_display: "≥ 8192",
    evidence: [{ kind: "config", value: `net.ipv4.tcp_max_syn_backlog=${val}` }],
    impact: { metric: "connection_util_pct", value: 10, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
    ],
    recommendations: [
      {
        action: "sysctl -w net.ipv4.tcp_max_syn_backlog=8192",
        rationale: "扩容 SYN 队列 · 对齐鲲鹏 BoostKit 推荐",
        type: "mitigate",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// K-NUMA-INTERLEAVE · 鲲鹏多 NUMA 节点下建议 numactl 启动(非分片场景)
// ---------------------------------------------------------------------------

export const check_kunpeng_numa_interleave: CheckFn = (ctx) => {
  const id = "kunpeng.numa.interleave_recommendation";
  const title = "NUMA interleave 启动建议";
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
      summary: `numa_nodes=${nodes} · 单节点无需 interleave`,
      reason: "单 NUMA 节点 / 虚拟机下不适用",
    });
  }
  // engine=mongo 单实例部署强推 numactl --interleave=all(无法探测实际启动参数),给 info
  return infoResult({
    id,
    title,
    bucket: 1,
    scope,
    summary: `${nodes} NUMA 节点 · 建议 numactl 启动`,
    reason: scope.engine === "mongo"
      ? "MongoDB Production Notes + 鲲鹏 BoostKit 建议:单实例用 'numactl --interleave=all mongod',多分片场景按 NUMA 节点各绑 1 个 mongod"
      : "多节点下建议用 numactl 限定 CPU/内存亲和性,避免远端访存",
    threshold_display: "numactl --interleave=all 或 --cpunodebind/--membind",
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Production Notes · NUMA", url: "https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-production-numa" },
    ],
  });
};

export const kunpengChecks: ReadonlyArray<CheckFn> = [
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
  check_kunpeng_numa_interleave,
];

// ============================================================================
// SECTION: openeuler-checks (原 src/shared/openeuler-checks.ts)
// ============================================================================

function requireOpenEuler(ctx: DiagContext, id: string, title: string, bucket: 1 | 2 | 3 | 4 | 5) {
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);
  if (scope.os !== "openeuler") {
    return {
      skip: infoResult({
        id,
        title,
        bucket,
        scope,
        summary: "规则仅适用 openEuler,已跳过",
        reason: `检测到 os=${scope.os ?? "unknown"}`,
        skip_reason: "os_mismatch",
      }),
      scope,
    };
  }
  return { skip: null, scope };
}

// ---------------------------------------------------------------------------
// OPENEULER-01 · sched_steal_node_limit
// ---------------------------------------------------------------------------

export const check_openeuler_sched_steal_cmdline: CheckFn = (ctx) => {
  const id = "openeuler.sched.steal_node_limit";
  const title = "sched_steal_node_limit";
  const { skip, scope } = requireOpenEuler(ctx, id, title, 1);
  if (skip) return skip;

  const cmdline = osVal<string | null>(ctx, "sched_steal_node_limit", null);
  if (!cmdline) {
    return finding({
      id,
      title,
      severity: "warning",
      bucket: 1,
      scope,
      summary: "cmdline 未设置 sched_steal_node_limit",
      description: "openEuler 官方 MySQL 调优指南明确在 Kunpeng 上要求 sched_steal_node_limit=4,默认值下跨 NUMA 任务迁移受限",
      reason: "/proc/cmdline grep sched_steal_node_limit 无返回",
      threshold_display: "≥ 4",
      evidence: [{ kind: "config", value: "sched_steal_node_limit=not-set" }],
      impact: { metric: "throughput_qps", value: 10, unit: "percent", confidence: "medium" },
      citations: [
        { title: "openEuler MySQL Performance Tuning", url: "https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html" },
      ],
      recommendations: [
        {
          action: "grubby --update-kernel=ALL --args='sched_steal_node_limit=4' && reboot",
          rationale: "openEuler 推荐在鲲鹏双路 4 NUMA 节点上启用跨节点任务窃取",
          type: "repair",
          fix_cost: "restart_engine",
          verifiable: false,
        },
      ],
    });
  }
  const m = /=(\d+)/.exec(cmdline);
  const val = m ? parseInt(m[1]!, 10) : 0;
  if (val >= 4) {
    return okResult({ id, title, bucket: 1, scope, summary: cmdline, reason: "跨节点任务窃取已合理配置" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `${cmdline} 值偏低`,
    description: "openEuler 推荐 sched_steal_node_limit=4 匹配双路鲲鹏 4 NUMA 节点布局",
    reason: `当前值 ${val} < 4`,
    threshold_display: "≥ 4",
    evidence: [{ kind: "config", value: cmdline }],
    impact: { metric: "throughput_qps", value: 8, unit: "percent", confidence: "medium" },
    citations: [
      { title: "openEuler MySQL Performance Tuning", url: "https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html" },
    ],
    recommendations: [
      {
        action: "grubby --update-kernel=ALL --args='sched_steal_node_limit=4' && reboot",
        rationale: "匹配鲲鹏 4 NUMA 节点布局",
        type: "repair",
        fix_cost: "restart_engine",
        verifiable: false,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// OPENEULER-02 · sched_features STEAL 特性
// ---------------------------------------------------------------------------

export const check_openeuler_sched_feature_steal: CheckFn = (ctx) => {
  const id = "openeuler.sched.feature_steal";
  const title = "sched_features STEAL";
  const { skip, scope } = requireOpenEuler(ctx, id, title, 1);
  if (skip) return skip;

  const on = osVal<boolean>(ctx, "sched_feature_steal_on", false);
  const raw = osVal<string>(ctx, "sched_features_raw", "");
  if (!raw) {
    return infoResult({ id, title, bucket: 1, scope, summary: "未采集 sched_features", reason: "/sys/kernel/debug/sched_features 不可读(需 root)" });
  }
  if (on) {
    return okResult({ id, title, bucket: 1, scope, summary: "STEAL 已启用", reason: "openEuler 内核任务窃取特性生效" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: "STEAL 特性未启用",
    description: "openEuler 内核支持 STEAL 调度器特性 · 高并发 DB 场景应开启",
    reason: `sched_features 里含 NO_STEAL 或未列 STEAL: ${raw.slice(0, 80)}`,
    threshold_display: "STEAL",
    evidence: [{ kind: "config", value: `sched_features=${raw.slice(0, 120)}` }],
    impact: { metric: "throughput_qps", value: 6, unit: "percent", confidence: "medium" },
    citations: [
      { title: "openEuler MySQL Performance Tuning · STEAL feature", url: "https://docs.openeuler.org/en/docs/22.09/docs/SystemOptimization/mysql-performance-tuning.html" },
    ],
    recommendations: [
      {
        action: "echo STEAL > /sys/kernel/debug/sched_features",
        rationale: "运行时启用 STEAL · 持久化需写 systemd unit",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// OPENEULER-03 · nohz=off 不应在 cmdline
// ---------------------------------------------------------------------------

export const check_openeuler_nohz_cmdline: CheckFn = (ctx) => {
  const id = "openeuler.cmdline.nohz";
  const title = "kernel cmdline nohz";
  const { skip, scope } = requireOpenEuler(ctx, id, title, 1);
  if (skip) return skip;

  const nohz = osVal<string | null>(ctx, "nohz_cmdline", null);
  if (!nohz) {
    return okResult({ id, title, bucket: 1, scope, summary: "cmdline 无 nohz=off", reason: "默认 tickless(nohz=on),正确设置" });
  }
  if (nohz === "nohz=off") {
    return finding({
      id,
      title,
      severity: "warning",
      bucket: 1,
      scope,
      summary: "cmdline 含 nohz=off",
      description: "nohz=off 强制固定频率 tick,增加 idle 时 CPU 中断开销,生产 DB 场景应启用 tickless",
      reason: "/proc/cmdline 含 nohz=off",
      threshold_display: "absent / nohz=on",
      evidence: [{ kind: "config", value: `cmdline=${nohz}` }],
      impact: { metric: "latency_p95_ms", value: 5, unit: "percent", confidence: "medium" },
      citations: [
        { title: "Huawei Kunpeng CPU/Mem Tuning · nohz", url: "https://www.cnblogs.com/huaweicloud/p/11861191.html" },
      ],
      recommendations: [
        {
          action: "grubby --update-kernel=ALL --remove-args='nohz=off' && reboot",
          rationale: "恢复 tickless 节省 idle CPU 中断",
          type: "repair",
          fix_cost: "restart_engine",
          verifiable: false,
        },
      ],
    });
  }
  return okResult({ id, title, bucket: 1, scope, summary: `cmdline nohz=${nohz}`, reason: "非 off 模式,合理" });
};

export const openeulerChecks: ReadonlyArray<CheckFn> = [
  check_openeuler_sched_steal_cmdline,
  check_openeuler_sched_feature_steal,
  check_openeuler_nohz_cmdline,
];

// ============================================================================
// SECTION: os-checks (原 src/shared/os-checks.ts)
// ============================================================================

// ---------------------------------------------------------------------------
// O-THP · 透明大页 · engine+version+vendor 感知(v0.3 bug-fix)
// ---------------------------------------------------------------------------

/** 解析 Mongo 版本主号(如 "7.0.31" → 7) */
function mongoMajor(version: string | undefined): number {
  if (!version) return 0;
  const m = /^(\d+)\./.exec(version);
  return m ? parseInt(m[1]!, 10) : 0;
}

export const check_thp: CheckFn = (ctx) => {
  const id = "os.thp.kernel_mode";
  const title = "THP 透明大页";
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);

  const raw = osVal<string>(ctx, "thp_status", "");
  const m = /\[(\w+)\]/.exec(raw);
  const mode = m ? m[1]! : raw; // "always" | "madvise" | "never"
  if (!mode) {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "未采集到 THP 状态",
      reason: "无法读取 /sys/kernel/mm/transparent_hugepage/enabled",
    });
  }

  // ---- mongo · 按版本决定期望值 ----
  let expected: "never" | "always" = "never";
  let rationaleWhyBad = "";

  const major = mongoMajor(scope.engine_version);
  if (major >= 8) {
    expected = "always"; // Mongo 8.0+ 反而建议 always(WiredTiger 改造)
    rationaleWhyBad = `MongoDB ${scope.engine_version ?? "8.0+"} 默认要求 THP=always`;
  } else {
    expected = "never"; // Mongo ≤ 7.0
    rationaleWhyBad = "khugepaged 内存碎片整理会产生硬中断,CPU sys% 飙升";
  }

  const okModes =
    expected === "never" ? ["never", "madvise"] : ["always", "madvise"];

  if (okModes.includes(mode)) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `THP=${mode}`,
      reason: `符合 mongo${scope.engine_version ? ` ${scope.engine_version}` : ""} 的建议值`,
    });
  }

  return finding({
    id,
    title,
    severity: expected === "always" ? "warning" : "critical",
    bucket: 1,
    scope,
    summary: `THP=${mode} 不符合 mongo${scope.engine_version ? ` ${scope.engine_version}` : ""} 期望`,
    description: `mongo 期望 THP=${expected}。` + (rationaleWhyBad ? ` ${rationaleWhyBad}。` : ""),
    reason: `当前 THP=${mode} · 期望 ${expected} · ${rationaleWhyBad}`,
    evidence: [
      { kind: "config", value: `/sys/kernel/mm/transparent_hugepage/enabled=${raw}` },
    ],
    threshold_display: okModes.join(" / "),
    impact: { metric: "latency_p95_ms", value: 25, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Production Notes · Disable THP", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" },
      ...(major >= 8
        ? [{ title: "MongoDB 8.0 THP Enable Note", url: "https://www.mongodb.com/docs/v8.0/tutorial/transparent-huge-pages/" }]
        : [{ title: "MongoDB 7.0 Disable THP", url: "https://www.mongodb.com/docs/v7.0/tutorial/transparent-huge-pages/" }]),
    ],
    recommendations: [
      {
        action: `echo ${expected} > /sys/kernel/mm/transparent_hugepage/enabled`,
        rationale: `将 THP 调整到 mongo${scope.engine_version ? ` ${scope.engine_version}` : ""} 推荐模式`,
        type: "repair",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
    rationale: major >= 8
      ? {
          summary: "MongoDB 8.0+ 更换了 WiredTiger 内存分配器 · 从 2M 大页获益更明显 · 官方反向调优建议 THP=always · 这是 MongoDB 7→8 的重要行为变化。",
          mechanism: "8.0 之前 WT 频繁 munmap 小块内存 · 2M 大页产生内部碎片 · khugepaged 扫描合并是主要延迟源。8.0 后 WT 改为 arena-style 分配 · 大块驻留 · 2M 大页反而减少 TLB miss 10-20% · khugepaged 扫描代价摊薄。",
          trade_offs: "若仍从 < 7 的 Mongo 升级且保留 THP=never · 会损失 8.0 的内存优化收益(实测 p95 延迟高 10-15%)。反之在 7.0 上误开 THP=always 会明显 CPU sys% 飙。",
          when_to_deviate: "短期混合版本的 replica set(同一集群不同节点版本)可先用 madvise 作过渡 · 升级收尾后 always。",
        }
      : {
          summary: "MongoDB ≤ 7.0 强制要求 THP=never。khugepaged 后台合并 2M 大页会产生毫秒级 stop-the-world 停顿 · 与 WT fsync 路径上的 page fault 相互放大延迟。",
          mechanism: "khugepaged 周期性扫描 4K 页试图合并成 2M 大页 · 扫描时需要短暂持有 mm->page_table_lock · mongod 的 WT page fault 必须等待。CPU sys% 持续 15-30% · p99 延迟从毫秒跳到百毫秒级。",
          trade_offs: "关 THP 不影响 MongoDB 自身内存使用(WT cache 不依赖大页)。系统上有其他 big-memory workload(如 JVM)时 · 关 THP 可能让那些 workload TLB miss 略升 · 但对 Mongo 是纯收益。",
          when_to_deviate: "madvise 模式在 7.0 也被官方接受(只对显式 madvise 的进程用大页 · mongod 不 madvise)· 实用等价 never。",
        },
  });
};

// ---------------------------------------------------------------------------
// O-HUGEPAGES · 静态 HugePages
// ---------------------------------------------------------------------------

export const check_hugepage: CheckFn = (ctx) => {
  const id = "os.hugepages.static_reserved";
  const title = "静态 HugePages";
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);

  const nr = toInt(osVal(ctx, "nr_hugepages", 0), 0);
  if (nr === 0) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "nr_hugepages=0",
      reason: "WT/Redis/InnoDB 自管 cache 不走 hugetlb,保持 0 即可",
    });
  }
  return infoResult({
    id,
    title,
    bucket: 1,
    scope,
    summary: `nr_hugepages=${nr}`,
    reason: "已预留静态大页(可能供同机其它服务使用,DB 本身无直接影响)",
  });
};

// ---------------------------------------------------------------------------
// O-IOSCHED · IO 调度器
// ---------------------------------------------------------------------------

export const check_io_scheduler: CheckFn = (ctx) => {
  const id = "os.iosched.device_scheduler";
  const title = "IO 调度器";
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);

  const raw = osVal<string>(ctx, "io_scheduler", "");
  const m = /\[(\w[\w-]*)\]/.exec(raw);
  const sched = m ? m[1]! : raw;
  if (!raw.toLowerCase().includes("[cfq]")) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `scheduler=${sched}`,
      reason: "调度器配置合理(非 CFQ)",
      threshold_display: "mq-deadline / none / kyber",
      // Linux kernel doc 是 I/O scheduler 行为的权威定义 · Kunpeng 只转述
      citations: [{ title: "Red Hat Performance Tuning · I/O scheduler", url: "https://access.redhat.com/sites/default/files/attachments/rhel7_numa_perf_brief.pdf" }],
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `scheduler=[cfq] 不适合 DB`,
    description: "CFQ 调度器会引入队列延迟,DB 随机 IO 需要低延迟(none/mq-deadline)",
    reason: "CFQ 对 SSD 引入不必要队列延迟",
    threshold_display: "mq-deadline / none / kyber",
    evidence: [{ kind: "config", value: `io_scheduler=${raw}` }],
    impact: { metric: "latency_p95_ms", value: 10, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "Red Hat Performance Tuning · I/O scheduler", url: "https://access.redhat.com/sites/default/files/attachments/rhel7_numa_perf_brief.pdf" },
    ],
    recommendations: [
      {
        action: "echo none > /sys/block/sda/queue/scheduler",
        rationale: "SSD 用 none · HDD 用 mq-deadline",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// O-SWAP · swappiness
// ---------------------------------------------------------------------------

export const check_swappiness: CheckFn = (ctx) => {
  const id = "os.vm.swappiness";
  const title = "Swap 倾向";
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);

  const raw = osVal(ctx, "swappiness", -1);
  const val = typeof raw === "number" ? raw : toInt(raw, -1);
  if (!Number.isInteger(val) || val < 0) {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "未采集到 vm.swappiness",
      reason: "sysctl 读取失败",
    });
  }
  if (val <= 10) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `swappiness=${val}`,
      reason: "Swap 倾向低,符合 DB 生产环境",
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `swappiness=${val} 偏高`,
    description: "高 swappiness 会让 DB 缓存被换出到磁盘,引发性能抖动",
    reason: `vm.swappiness=${val} > 10`,
    threshold_display: "≤ 1",
    evidence: [{ kind: "config", value: `vm.swappiness=${val}`, source_url: "/proc/sys/vm/swappiness" }],
    impact: { metric: "latency_p95_ms", value: 20, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Production Notes · swappiness", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" },
      { title: "Redis Latency · swap", url: "https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/" },
    ],
    recommendations: [
      {
        action: "sysctl -w vm.swappiness=1",
        rationale: "DB 独占主机 · 禁止活跃页被换出",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
    rationale: {
      summary: "swappiness 控制内核把 anonymous 页面交换到磁盘的积极程度。默认 60 对桌面系统合适 · 对 DB 场景致命 · DB 工作集大部分是 anonymous 内存(mmap/mongod buffer)· 被 swap 出去后访问是磁盘延迟级别。",
      mechanism: "Linux kswapd 在内存压力下从 LRU 淘汰页 · swappiness 决定 anonymous 页 vs file-backed 页的淘汰比例。60 意味 anonymous 页优先被换出 · DB 缓冲池首当其冲。换出后下次访问触发 major page fault · 走 swap 盘 IO · 延迟从 100ns 跳到 100μs-ms。",
      trade_offs: "降到 1 让内核只在几乎 OOM 时才动 swap · 几乎消灭 DB swap 抖动。代价:若真遇 OOM scenario · swap 晚启动可能让 OOM Killer 提前介入。但 DB 场景下 OOM 本身就是需要告警的事件 · 不应靠 swap 兜底。",
      when_to_deviate: "混合部署场景(DB 和其他服务共享主机)· 可保 swappiness=10 作折中。纯 DB 物理机必须 1 或 0。容器环境 swap 通常被 cgroup 限制无效 · 设置仍有意义防止未来容器策略变化。",
    },
  });
};

// ---------------------------------------------------------------------------
// O-NET-SOMAXCONN · 监听队列长度
// ---------------------------------------------------------------------------

export const check_net_somaxconn: CheckFn = (ctx) => {
  const id = "os.net.somaxconn";
  const title = "somaxconn 监听队列";
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);

  const val = toInt(osVal(ctx, "net_somaxconn", 0), 0);
  if (val === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "未采集到", reason: "无法读取 net.core.somaxconn" });
  }
  if (val >= 1024) {
    return okResult({ id, title, bucket: 1, scope, summary: `somaxconn=${val}`, reason: "队列长度充足", threshold_display: "≥ 4096", citations: [{ title: "MongoDB Production Notes · TCP", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }] });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `somaxconn=${val} < 1024`,
    description: "监听队列过短,高并发时 TCP 连接请求会被内核丢弃",
    reason: `somaxconn=${val} · DB 服务器建议 ≥ 1024(Ampere/Mongo 建议 65535)`,
    threshold_display: "≥ 4096",
    evidence: [{ kind: "config", value: `net.core.somaxconn=${val}` }],
    impact: { metric: "connection_util_pct", value: 15, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "Ampere MongoDB Tuning · somaxconn", url: "https://amperecomputing.com/tuning-guides/mongoDB-tuning-guide" },
    ],
    recommendations: [
      {
        action: "sysctl -w net.core.somaxconn=4096",
        rationale: "减少高并发时 SYN 丢包",
        type: "mitigate",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// O-NET-KEEPALIVE · TCP Keepalive(主要对 Mongo)
// ---------------------------------------------------------------------------

export const check_tcp_keepalive: CheckFn = (ctx) => {
  const id = "os.net.tcp_keepalive_time";
  const title = "TCP Keepalive";
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);

  const kt = toInt(osVal(ctx, "tcp_keepalive_time", 0), 0);
  const ki = toInt(osVal(ctx, "tcp_keepalive_intvl", 0), 0);
  if (kt === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "未采集到", reason: "无法读取 tcp_keepalive_time" });
  }
  const current = `keepalive_time=${kt}s · keepalive_intvl=${ki}s`;
  if (kt <= 300) {
    return okResult({ id, title, bucket: 1, scope, summary: current, reason: "在推荐范围内" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `keepalive_time=${kt}s 过高`,
    description: "空闲连接失效时客户端感知滞后,加剧连接风暴",
    reason: `tcp_keepalive_time=${kt}s · MongoDB 建议 ≤ 120s`,
    threshold_display: "≤ 120s",
    evidence: [{ kind: "config", value: current }],
    impact: { metric: "connection_util_pct", value: 8, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Production Notes · TCP keepalive", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" },
    ],
    recommendations: [
      {
        action: "sysctl -w net.ipv4.tcp_keepalive_time=120 && sysctl -w net.ipv4.tcp_keepalive_intvl=10",
        rationale: "让客户端快速感知断连,配合连接池回收",
        type: "mitigate",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
    rationale: {
      summary: "Linux 默认 tcp_keepalive_time=7200s(2 小时)· 对数据库场景过高 · 客户端感知连接死亡要等 2 小时 · 期间连接池里的假连接会被分配给新请求 · 表现为客户端 hang 到 timeout。",
      mechanism: "TCP keepalive 机制在连接空闲超过 tcp_keepalive_time 秒后 · 内核每 tcp_keepalive_intvl 秒发探测包 · 累计 tcp_keepalive_probes 次(默认 9)没 ACK 就标记连接死。默认全链路需 2h + 9×75s ≈ 2h11m。MongoDB 官方推荐 120s + 10s 间隔 · 连接问题 3 分钟内被发现。",
      trade_offs: "调低增加少量 keepalive 探测包流量(可忽略)· 换来快速故障感知。负载均衡器 / NAT 超时常设在 5-15 分钟 · keepalive 必须短于这个值才能防止 NAT 提前清表。",
      when_to_deviate: "极低延迟 / HFT 场景直接禁 keepalive 靠应用层心跳。普通 OLTP / 服务端 mongod 后接 NAT 或云 LB 的必须 ≤ 300s。",
    },
  });
};

// ---------------------------------------------------------------------------
// O-VM-DIRTY · 脏页写回
// ---------------------------------------------------------------------------

export const check_vm_dirty_ratio: CheckFn = (ctx) => {
  const id = "os.vm.dirty_ratio";
  const title = "脏页写回策略";
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);

  const dr = toInt(osVal(ctx, "vm_dirty_ratio", 0), 0);
  const dbg = toInt(osVal(ctx, "vm_dirty_background_ratio", 0), 0);
  if (dr === 0 && dbg === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "未采集到", reason: "sysctl 读取失败" });
  }
  const current = `dirty_ratio=${dr}% · dirty_background_ratio=${dbg}%`;
  if (dr < 10 && dbg < 5) {
    return okResult({ id, title, bucket: 1, scope, summary: current, reason: "脏页参数合理" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `${current} 偏高`,
    description: "大量脏页积压后集中刷盘会导致写停顿(write stall)",
    reason: `dirty_ratio=${dr}% / dirty_background_ratio=${dbg}% · DB 场景应 ≤ 5/2`,
    threshold_display: "dirty_ratio ≤ 5% · dirty_bg ≤ 2%",
    evidence: [{ kind: "config", value: current }],
    impact: { metric: "latency_p95_ms", value: 15, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "Red Hat Performance Tuning · dirty ratio", url: "https://access.redhat.com/sites/default/files/attachments/rhel7_numa_perf_brief.pdf" },
    ],
    recommendations: [
      {
        action: "sysctl -w vm.dirty_ratio=5 && sysctl -w vm.dirty_background_ratio=2",
        rationale: "让脏页持续小批量刷盘 · 避免集中 IO 风暴",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
    rationale: {
      summary: "内核 page cache 的脏页比例上限由 vm.dirty_ratio 控制 · 默认 20%。256GB 物理机 = 最多 50GB 脏页 · 触发阈值时应用线程被阻塞直到 pdflush 刷完 · DB 写请求被整体 freeze 几秒到几十秒(write stall)。",
      mechanism: "Linux 有两级阈值:dirty_background_ratio(默认 10%)触发后 pdflush 后台异步刷 · dirty_ratio(默认 20%)触发后**应用线程同步刷**不再返回。DB 批量写(checkpoint / redo rotate / bulk insert)瞬时生成大量脏页 · 轻松触达 20% · 整个 mongod 进程被 write() syscall 卡住。",
      trade_offs: "降低阈值让刷盘更频繁但更平滑 · 5%/2% 对 NVMe 是每秒 MB 级小批量 · 影响可忽略。提高会产生更大 IO bursts · 对 DB 是致命的。生产 DB 场景不存在让阈值变高的合理理由。",
      when_to_deviate: "纯日志 workload(append-only + fsync 频繁)可保默认 · 反正脏页很快被 fsync 清掉。但 MongoDB WT checkpoint 走 OS fsync · 还是受影响 · 不算例外。",
    },
  });
};

// ---------------------------------------------------------------------------
// IO-LAT / IO-USAGE
// ---------------------------------------------------------------------------

export const check_disk_latency: CheckFn = (ctx) => {
  const id = "os.io.disk_await_ms";
  const title = "磁盘 IO 延迟";
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);

  const await_val = toFloat(osVal(ctx, "disk_await_ms", 0), 0);
  if (await_val <= 20) {
    return okResult({ id, title, bucket: 1, scope, summary: `await=${await_val.toFixed(1)}ms`, reason: "磁盘延迟正常", threshold_display: "< 10ms", citations: [{ title: "Red Hat iostat · await", url: "https://www.redhat.com/en/blog/analysing-perf-data-sysstat-and-iostat" }] });
  }
  return finding({
    id,
    title,
    severity: "critical",
    bucket: 1,
    scope,
    summary: `await=${await_val.toFixed(1)}ms > 20ms`,
    description: "磁盘 IO 延迟过高 · DB 检查点 / 日志写入受阻",
    reason: `iostat await=${await_val.toFixed(1)}ms · 阈值 20ms`,
    threshold_display: "< 20ms",
    evidence: [{ kind: "metric", value: `disk_await_ms=${await_val.toFixed(1)}` }],
    impact: { metric: "latency_p95_ms", value: 40, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Production Notes · disk latency", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" },
    ],
    recommendations: [
      {
        action: "检查磁盘类型(SSD/HDD)· 确认 IO 调度器 · 排查其他进程竞争",
        rationale: "磁盘硬件级排查(非 sysctl 可改)",
        type: "detect",
        fix_cost: "restart_engine",
        verifiable: false,
      },
    ],
  });
};

export const check_disk_usage: CheckFn = (ctx) => {
  const id = "os.io.disk_usage_pct";
  const title = "磁盘容量";
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);

  const pct = toFloat(osVal(ctx, "disk_usage_pct", 0), 0);
  if (pct <= 80) {
    return okResult({ id, title, bucket: 1, scope, summary: `usage=${pct.toFixed(0)}%`, reason: "磁盘空间充足", threshold_display: "< 80%", citations: [{ title: "MongoDB Production Notes · disk space", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }] });
  }
  const severity = pct > 90 ? "critical" : "warning";
  return finding({
    id,
    title,
    severity,
    bucket: 1,
    scope,
    summary: `usage=${pct.toFixed(0)}% 超阈值`,
    description: "磁盘空间不足影响 DB 日志 / 检查点写入",
    reason: `data dir 使用率 ${pct.toFixed(0)}% · DB 场景应 ≤ 80%`,
    threshold_display: "< 80%",
    evidence: [{ kind: "metric", value: `disk_usage_pct=${pct.toFixed(0)}` }],
    impact: { metric: "wasted_bytes", value: pct, unit: "percent", confidence: "high" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Production Notes · disk space", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" },
    ],
    recommendations: [
      {
        action: "清理日志 / 扩容数据卷 / 归档历史数据",
        rationale: "避免磁盘写满导致 DB 停写",
        type: "prevent",
        fix_cost: "schema_migration",
        verifiable: false,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// NET-RETRANS · TCP 重传
// ---------------------------------------------------------------------------

export const check_tcp_retransmit: CheckFn = (ctx) => {
  const id = "os.net.tcp_retrans_pct";
  const title = "TCP 重传率";
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);

  const pct = toFloat(osVal(ctx, "tcp_retrans_pct", 0), 0);
  if (pct <= 1.0) {
    return okResult({ id, title, bucket: 1, scope, summary: `retrans=${pct.toFixed(2)}%`, reason: "TCP 重传率正常" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `retrans=${pct.toFixed(2)}% > 1%`,
    description: "高重传率导致 DB 客户端连接超时 / 慢查询放大",
    reason: `tcp_retrans=${pct.toFixed(2)}% · 阈值 1%`,
    threshold_display: "≤ 1%",
    evidence: [{ kind: "metric", value: `tcp_retrans_pct=${pct.toFixed(2)}` }],
    impact: { metric: "latency_p95_ms", value: 20, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "Red Hat Performance Tuning · TCP retransmission", url: "https://access.redhat.com/sites/default/files/attachments/rhel7_numa_perf_brief.pdf" },
    ],
    recommendations: [
      {
        action: "排查交换机拥塞 · 检查 MTU / TCP congestion algorithm / 网络负载",
        rationale: "链路质量问题,非 DB 侧直接可修",
        type: "detect",
        fix_cost: "restart_engine",
        verifiable: false,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// O-VM-ZONE-RECLAIM · NUMA 内存回收(engine=mongo)
// ---------------------------------------------------------------------------

export const check_vm_zone_reclaim: CheckFn = (ctx) => {
  const id = "os.vm.zone_reclaim_mode";
  const title = "vm.zone_reclaim_mode";
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);
  if (engine !== "mongo") {
    return infoResult({ id, title, bucket: 1, scope, summary: "仅对 MongoDB 强推", reason: `db_type=${engine}` });
  }
  const val = toInt(osVal(ctx, "vm_zone_reclaim_mode", -1), -1);
  if (val < 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "未采集 zone_reclaim_mode", reason: "sysctl 不可读" });
  }
  if (val === 0) {
    return okResult({ id, title, bucket: 1, scope, summary: "zone_reclaim_mode=0", reason: "禁用区域回收 · 符合 MongoDB 建议" });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `zone_reclaim_mode=${val} ≠ 0`,
    description: "开启 zone_reclaim 会导致 WiredTiger 分配时优先回收本节点 · 引入意外延迟 · MongoDB 明确要求 0",
    reason: `vm.zone_reclaim_mode=${val} · MongoDB Production Notes 要求 0`,
    threshold_display: "== 0",
    evidence: [{ kind: "config", value: `vm.zone_reclaim_mode=${val}` }],
    impact: { metric: "latency_p95_ms", value: 12, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "MongoDB Production Notes · zone_reclaim_mode", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" },
    ],
    recommendations: [
      {
        action: "sysctl -w vm.zone_reclaim_mode=0",
        rationale: "禁用 NUMA 区域回收 · 避免分配时延迟",
        type: "repair",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// O-VM-MAX-MAP-COUNT · mmap 区域数上限(engine=mongo)
// ---------------------------------------------------------------------------

export const check_vm_max_map_count: CheckFn = (ctx) => {
  const id = "os.vm.max_map_count";
  const title = "vm.max_map_count";
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);
  if (engine !== "mongo") {
    return infoResult({ id, title, bucket: 1, scope, summary: "仅对 MongoDB 强推", reason: `db_type=${engine}` });
  }
  const val = toInt(osVal(ctx, "vm_max_map_count", 0), 0);
  if (val === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "未采集", reason: "sysctl 不可读" });
  }
  if (val >= 128000) {
    return okResult({ id, title, bucket: 1, scope, summary: `max_map_count=${val}`, reason: "已达 MongoDB 推荐 ≥ 128000", threshold_display: "≥ 128000", citations: [{ title: "MongoDB sysctl · vm.max_map_count", url: "https://www.mongodb.com/docs/manual/reference/ulimit/" }] });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `max_map_count=${val} < 128000`,
    description: "大 collection / 多 sharded 场景下会触达 mmap 上限,mongod 报 mmap failed",
    reason: `vm.max_map_count=${val} · Ampere MongoDB 调优指南要求 ≥ 128000`,
    threshold_display: "≥ 128000",
    evidence: [{ kind: "config", value: `vm.max_map_count=${val}` }],
    impact: { metric: "db_time_pct", value: 8, unit: "percent", confidence: "medium" },
    citations: [
      KUNPENG_REFS.boostkitMongo,
      { title: "Ampere MongoDB Tuning · vm.max_map_count", url: "https://amperecomputing.com/tuning-guides/mongoDB-tuning-guide" },
    ],
    recommendations: [
      {
        action: "sysctl -w vm.max_map_count=262144",
        rationale: "按 Ampere/Mongo 最佳实践调高至 262144",
        type: "prevent",
        fix_cost: "trivial",
        verifiable: true,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// O-ENV-VIRT · 虚拟化类型披露(info · 影响 memory ballooning / DVFS 建议可行性)
// ---------------------------------------------------------------------------

export const check_env_virt_type: CheckFn = (ctx) => {
  const id = "os.env.virt_type";
  const title = "虚拟化类型";
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);

  const virt = osVal<string>(ctx, "env_virt_type", "unknown");
  const vendor = osVal<string>(ctx, "env_sys_vendor", "unknown");
  const product = osVal<string>(ctx, "env_product_name", "unknown");

  if (!virt || virt === "unknown") {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: "未采集到虚拟化类型",
      reason: "systemd-detect-virt 不可用",
    });
  }
  // none = bare metal,其它都是 VM / container
  if (virt === "none") {
    return infoResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `bare-metal · sys_vendor=${vendor}`,
      reason: `物理机部署(${product}) · 完整调优手段可落地`,
    });
  }
  // 典型 VM:kvm / vmware / hyperv / xen / microsoft
  return infoResult({
    id,
    title,
    bucket: 1,
    scope,
    summary: `virt=${virt} · sys_vendor=${vendor}`,
    reason: "虚拟化环境 · CPU 调频 / NUMA / IRQ 调优可能受 hypervisor 限制 · 内存 ballooning 需在 hypervisor 侧关闭",
    citations: [
      { title: "MongoDB Production Notes · Virtualization", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" },
    ],
  });
};

// ---------------------------------------------------------------------------
// O-CPU-CORES · 最少物理核数(MongoDB 建议 ≥ 2 real cores)
// ---------------------------------------------------------------------------

export const check_cpu_cores_minimum: CheckFn = (ctx) => {
  const id = "os.cpu.cores_minimum";
  const title = "CPU 核心数";
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);

  const cores = toInt(osVal(ctx, "cpu_cores", 0), 0);
  if (cores === 0) {
    return infoResult({ id, title, bucket: 1, scope, summary: "未采集到 CPU 核心数", reason: "nproc 不可用" });
  }
  if (cores >= 2) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `cpu_cores=${cores}`,
      reason: "CPU 核心充足",
      threshold_display: "≥ 2 cores",
      citations: [{ title: "MongoDB Production Notes · CPU requirements", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }],
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `cpu_cores=${cores} < 2`,
    description: "MongoDB / 大多数 DB 在生产环境至少需要 2 个真实核心 · 单核机器无法承受 DB + OS 双方线程调度",
    reason: `cpu_cores=${cores} · 生产建议 ≥ 2 real cores`,
    threshold_display: "≥ 2 cores",
    evidence: [{ kind: "metric", value: `cpu_cores=${cores}` }],
    impact: { metric: "throughput_qps", value: 40, unit: "percent", confidence: "high" },
    citations: [
      { title: "MongoDB Production Notes · CPU requirements", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" },
    ],
    recommendations: [
      {
        action: "升级到 ≥ 2 cores 的实例规格",
        rationale: "规避 DB 进程与 OS 内核线程争抢单核",
        type: "prevent",
        fix_cost: "restart_engine",
        verifiable: false,
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// O-KERNEL-RSEQ · Mongo 8.0+ tcmalloc-google 要求 kernel ≥ 4.18
// ---------------------------------------------------------------------------

export const check_kernel_version_rseq: CheckFn = (ctx) => {
  const id = "os.kernel.version_rseq";
  const title = "内核版本 · rseq 支持";
  const engine = ctx.db_type as EngineName;
  const scope = deriveScope(ctx, engine);

  // mongo 8.0+ tcmalloc-google percpu caches 依赖 rseq(kernel 4.18+ 才可靠)
  if (engine !== "mongo") {
    return infoResult({ id, title, bucket: 1, scope, summary: "仅对 MongoDB 检查", reason: `db_type=${engine}` });
  }

  const kv = osVal<string>(ctx, "kernel_version", "");
  if (!kv) {
    return infoResult({ id, title, bucket: 1, scope, summary: "未采集 kernel version", reason: "uname -r 不可读" });
  }
  const m = /^(\d+)\.(\d+)/.exec(kv);
  if (!m) {
    return infoResult({ id, title, bucket: 1, scope, summary: `kernel=${kv}`, reason: "无法解析 major.minor" });
  }
  const major = parseInt(m[1]!, 10);
  const minor = parseInt(m[2]!, 10);
  // 4.18+
  const ok = major > 4 || (major === 4 && minor >= 18);
  if (ok) {
    return okResult({
      id,
      title,
      bucket: 1,
      scope,
      summary: `kernel=${kv}`,
      reason: "内核支持 rseq · tcmalloc per-CPU caches 可启用",
      threshold_display: "≥ 4.18",
      citations: [{ title: "MongoDB · tcmalloc-google and Linux kernel", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" }],
    });
  }
  return finding({
    id,
    title,
    severity: "warning",
    bucket: 1,
    scope,
    summary: `kernel=${kv} < 4.18`,
    description: "MongoDB 8.0+ 默认启用 tcmalloc-google per-CPU caches,依赖 glibc rseq,rseq 在 kernel < 4.18 上未成熟支持,可能退回到 per-thread caches",
    reason: `kernel ${kv} 早于 4.18 · 可能无法使用 tcmalloc per-CPU caches`,
    threshold_display: "≥ 4.18",
    evidence: [{ kind: "config", value: `kernel_version=${kv}` }],
    impact: { metric: "throughput_qps", value: 8, unit: "percent", confidence: "medium" },
    citations: [
      { title: "MongoDB Production Notes · tcmalloc", url: "https://www.mongodb.com/docs/manual/administration/production-notes/" },
    ],
    recommendations: [
      {
        action: "升级到支持 rseq 的内核(≥ 4.18,RHEL 8 / openEuler 20.03 / Ubuntu 18.04+)",
        rationale: "让 tcmalloc-google 能稳定启用 per-CPU caches,提升高并发分配性能",
        type: "prevent",
        fix_cost: "restart_engine",
        verifiable: false,
      },
    ],
  });
};

export const osChecks: ReadonlyArray<CheckFn> = [
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
  check_kernel_version_rseq,
];

// ============================================================================
// SECTION: rules-catalog (原 src/shared/rules-catalog.ts)
// ============================================================================


// ---------------------------------------------------------------------------
// rules.json 里单条规则的外部格式(和蒸馏产物对齐 · 不改动)
// ---------------------------------------------------------------------------
export interface RulesJsonEntry {
  id: string;
  bucket: number;
  severity: "CRITICAL" | "WARNING" | "INFO";
  metric_expr?: string;
  threshold?: string;
  reason?: string;
  recommend?: string;
  fix?: string;
  fix_cost?: string;
  source?: {
    tier?: string;
    url?: string;
    title?: string;
    quote?: string;
    accessed?: string;
  };
  engine?: string;
  scope?: Record<string, unknown>;
  confidence?: string;
  refs?: string[];
  needs_human_review?: boolean;
}

// ---------------------------------------------------------------------------
// 配置常量
// ---------------------------------------------------------------------------

/** CheckFn 已覆盖的主题关键词 · rules.json 命中这些关键词的规则跳过 */
const CHECKFN_COVERED_TOPICS = [
  // OS 内核 / 内存
  "thp", "transparent_hugepage", "hugepages", "hugepage", "static_reserved",
  "swappiness", "zone_reclaim", "max_map_count", "overcommit",
  "dirty_ratio", "dirty_bg",
  // I/O
  "iosched", "io_scheduler", "disk_await", "disk_usage", "device_scheduler",
  // 网络
  "somaxconn", "tcp_keepalive", "tcp_retrans", "tcp_max_syn",
  // ARM64 / kunpeng / openeuler
  "lse", "pagesize", "page_size",
  "cpu.governor", "cpu_governor", "scaling_governor",
  "numa.balancing", "numa_balancing", "numa.topology", "numa_topology", "numa.distance", "numa_distance",
  "smt", "threads_per_core", "irqbalance",
  "sched_steal", "sched_feature_steal", "nohz",
  // mongo 专项
  "wt_cache", "wt_block_compressor", "compression",
  "oplog_window", "connection_pool", "db_cache_vs",
];

/** 非诊断类前缀(安装 / 升级 / 依赖 · 不作运行时判定) */
const NON_DIAGNOSTIC_PREFIXES = [
  "mongo-installation-",
  "mongo-install-dependencies-",
  "mongo-upgrade-",
  "mongo-install-",
  "mongo-configuration-file-settings",
];

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/** id 规范化:小写 · 去分隔符 · 给模糊匹配用 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[_\-.]/g, "");
}

/** 判断该规则是否被 CheckFn 精确或主题覆盖 */
function isCheckFnCovered(rule: RulesJsonEntry, checkFnIds: Set<string>): boolean {
  if (checkFnIds.has(rule.id)) return true;
  const idNorm = normalize(rule.id);
  for (const topic of CHECKFN_COVERED_TOPICS) {
    if (idNorm.includes(normalize(topic))) return true;
  }
  return false;
}

/** 判断非诊断类规则(安装 / 升级 / 依赖) */
function isNonDiagnostic(rule: RulesJsonEntry): boolean {
  for (const p of NON_DIAGNOSTIC_PREFIXES) {
    if (rule.id.startsWith(p)) return true;
  }
  return false;
}

/** 提取规则主题 · 用于同主题去重 · 规则 id 末两段拼接 */
function topicOf(id: string): string {
  const parts = id.toLowerCase().split(/[-_.]/);
  return parts.slice(-2).join("-");
}

/** severity 权重 · 用于同主题选最高 */
const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 3,
  WARNING: 2,
  INFO: 1,
};

// ---------------------------------------------------------------------------
// 主 API
// ---------------------------------------------------------------------------

export interface RulesCatalogResult {
  /** 最终 surface 到 CheckResult · 作 info finding 合进诊断输出 */
  surfaced: CheckResult[];
  /** 载入诊断摘要 · 供 diagnose.mjs 输出 JSON 和进度行展示 */
  meta: {
    loaded_common: number;
    loaded_engine: number;
    skipped_checkfn_covered: number;
    skipped_non_diagnostic: number;
    skipped_topic_duplicate: number;
    surfaced: number;
  };
}

/**
 * 加载 common/kunpeng-rules.json + data/<engine>/rules.json · 去重 · 转 CheckResult[]
 *
 * @param engine - "mongo" | "mysql" | "redis"
 * @param checkFnIds - 当前已跑 CheckFn 的 rule_id 集合(从 results 里取)
 * @param dataRoot - data/ 目录绝对路径(默认由 diagnose.mjs 传入)
 */
export function loadRulesCatalog(
  engine: EngineName,
  checkFnIds: Set<string>,
  dataRoot: string,
): RulesCatalogResult {
  const raw: RulesJsonEntry[] = [];
  const meta = {
    loaded_common: 0,
    loaded_engine: 0,
    skipped_checkfn_covered: 0,
    skipped_non_diagnostic: 0,
    skipped_topic_duplicate: 0,
    surfaced: 0,
  };

  // 1. common/kunpeng-rules.json
  try {
    const kpJson = JSON.parse(readFileSync(join(dataRoot, "common/kunpeng-rules.json"), "utf8"));
    const kpRules: RulesJsonEntry[] = Array.isArray(kpJson) ? kpJson : (kpJson.rules || []);
    meta.loaded_common = kpRules.length;
    raw.push(...kpRules);
  } catch (_e) {
    // 文件缺失时降级(不抛)
  }

  // 2. data/<engine>/rules.json · 今晚只装 mongo(按用户指示)
  if (engine === "mongo") {
    try {
      const mgJson = JSON.parse(readFileSync(join(dataRoot, "mongo/rules.json"), "utf8"));
      const mgRules: RulesJsonEntry[] = Array.isArray(mgJson) ? mgJson : (mgJson.rules || []);
      meta.loaded_engine = mgRules.length;
      raw.push(...mgRules);
    } catch (_e) {
      // 忽略
    }
  }

  // 3. 过滤 + 主题去重
  const byTopic = new Map<string, RulesJsonEntry>();
  for (const r of raw) {
    if (isCheckFnCovered(r, checkFnIds)) {
      meta.skipped_checkfn_covered += 1;
      continue;
    }
    if (isNonDiagnostic(r)) {
      meta.skipped_non_diagnostic += 1;
      continue;
    }
    const t = topicOf(r.id);
    const existing = byTopic.get(t);
    if (!existing) {
      byTopic.set(t, r);
      continue;
    }
    // 同主题 · 选 severity 最高
    const newRank = SEVERITY_RANK[r.severity] ?? 0;
    const oldRank = SEVERITY_RANK[existing.severity] ?? 0;
    if (newRank > oldRank) {
      byTopic.set(t, r);
    }
    meta.skipped_topic_duplicate += 1;
  }

  // 4. 转 CheckResult[] · severity=info · needs_human_review=true
  const surfaced: CheckResult[] = [];
  for (const r of byTopic.values()) {
    const scope = deriveScope({ os_metrics: {}, db_metrics: {}, db_type: engine }, engine);
    const res = infoResult({
      id: r.id,
      title: (r.reason ?? r.id).slice(0, 60),
      bucket: (r.bucket ?? 1) as 1 | 2 | 3 | 4 | 5,
      scope,
      summary: r.recommend ?? r.reason ?? "见原文",
      reason: r.reason ?? "",
    });
    // 附加 rules.json 的 source + fix 作 evidence 便于报告渲染
    res.needs_human_review = true;
    if (r.source?.url) {
      res.citations = [
        {
          title: r.source.title ?? "参考",
          url: r.source.url,
          anchor: r.source.tier ?? undefined,
        } as never,
      ];
    }
    if (r.recommend) {
      res.recommendations = [
        {
          action: r.recommend,
          rationale: r.reason ?? "",
          type: "configure",
          fix_cost: (r.fix_cost ?? "restart_engine") as never,
        } as never,
      ];
    }
    surfaced.push(res);
  }
  meta.surfaced = surfaced.length;

  return { surfaced, meta };
}
