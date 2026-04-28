# os-flame-signature-linux-mm

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 3 条 case。

---

## brk() syscall hot frame — heap expansion code path

**case_id**: `linux-mm-brk-heap-expansion-01`
**来源**: [https://www.brendangregg.com/FlameGraphs/memoryflamegraphs.html](https://www.brendangregg.com/FlameGraphs/memoryflamegraphs.html) (community-canonical)
**平台**: bare
**scope**: linux-mm

**signature_type**: function-prefix
**match_layer**: function
**pattern_regex**: ``^(sys_brk\`

### 火焰图原文模式
> brk() can be traced via its kernel function, SyS_brk() or sys_brk(), or on 4.14+ kernels via the syscalls:sys_enter_brk tracepoint.

### 机制
> Many applications grow using brk(). This syscall sets the program break point: the end of the heap segment (aka the process data segment). brk() isn't called by the application directly, but rather the user-level allocator which provides the malloc()/free() interface. Such allocators typically don't give memory back the OS, keeping freed memory as a cache for future allocations. And so, brk() is typically for growth only (not shrinks).
火焰图内核栈出现 `sys_brk` / `SyS_brk` 帧 → 进程通过 `brk()` syscall 抬高 program break
point(heap 段末端)。`brk()` 不由应用直接调用,而由 user-level allocator(glibc malloc 等)
在 cache 不够时按需扩张 heap。因 allocator 通常只扩不缩,`brk()` 几乎只代表"增长事件"。

### 负载含义
> What brk() tracing can tell us is the code paths that lead to heap expansion. This could be either: > A memory growth code path A memory leak code path An innocent application code path, that happened to spill-over the current heap size Asynchronous allocator code path, that grew the application in response to diminishing free space
`brk()` 火焰图栈对应"导致 heap 扩张的代码路径",可能是 4 类之一:
1. 真实内存增长(workload 数据上来);
2. 内存泄漏代码路径;
3. 偶尔超过当前 heap size 的无辜代码路径;
4. allocator 后台增长路径(在 free space 减少时主动 grow)。
需结合是否能在 bug 库找到对应 leak 报告 / 是否持续增长来区分。

### 调优方向
- (#1) [high]
  > "If the rate of brk()s is low for you as well, you can just use perf in sampling mode, where it does per-event dumps"
- (#2) [high]
  > "While brk() tracing shows what led to expansion, page fault tracing, covered later, shows what then consumed that memory"

---

## mmap() syscall hot frame — VM mapping growth code path

**case_id**: `linux-mm-mmap-vm-growth-01`
**来源**: [https://www.brendangregg.com/FlameGraphs/memoryflamegraphs.html](https://www.brendangregg.com/FlameGraphs/memoryflamegraphs.html) (community-canonical)
**平台**: bare
**scope**: linux-mm

**signature_type**: function-prefix
**match_layer**: function
**pattern_regex**: ``^(sys_mmap\`

### 火焰图原文模式
> mmap() can be traced via its kernel function, SyS_mmap() or sys_mmap(), or on 4.14+ kernels via the syscalls:sys_enter_mmap tracepoint.

### 机制
> The mmap() syscall may be explicitly used by the application for loading data files or creating working segments, especially during initialization and application start. In this context, we're interested in creeping application growth, which may occur via mmap() if the allocator uses it instead of brk(). glibc does this for larger allocations, which can be returned to the system using munmap().
火焰图内核栈出现 `sys_mmap` / `SyS_mmap` 帧 → 进程通过 `mmap()` syscall 创建/扩展 VM 映射段。
两类用途:(1) 应用显式 mmap 文件 / 工作段(尤其启动和初始化阶段);(2) glibc 等 allocator
在大块分配时改走 mmap 而非 brk(可通过 munmap 还回 OS)。

### 负载含义
> Unlike brk(), mmap() calls don't necessarily mean growth, as they may be freed shortly after using munmap(). And so tracing mmap() may show many new mappings, but most or all of them are neither growth nor leaks. If your system has frequent short-lived processes (eg, doing a software build), the mmap()s as part of process initialization can flood the trace.
`mmap()` 火焰图栈宽 ≠ 一定是 leak / growth——可能很快就 `munmap()` 还回。
若系统有大量 short-lived processes(典型如 software build),进程初始化的 mmap 会
"淹没"采样。诊断 leak 时需进一步识别"未配对 munmap 的 mapping address"。

### 调优方向
- (#1) [high]
  > "As with malloc()/free() tracing, mapping addresses can be inspected and associated so that those that were not freed can be identified"
- (#2) [medium]
  > "If these are called frequently, say, over ten thousand times per second, then the overhead can become significant. That would also be a sign of a poorly designed allocator or application"

---

## page fault hot frame — physical memory population code path

**case_id**: `linux-mm-page-fault-physical-population-01`
**来源**: [https://www.brendangregg.com/FlameGraphs/memoryflamegraphs.html](https://www.brendangregg.com/FlameGraphs/memoryflamegraphs.html) (community-canonical)
**平台**: bare
**scope**: linux-mm

**signature_type**: function-prefix
**match_layer**: function
**pattern_regex**: ``^(handle_mm_fault\`

### 火焰图原文模式
> Page faults can be dynamically traced via a kernel function, eg, handle_mm_fault(), or on 4.14+ kernels via the tracepoints t:exceptions:page_fault_user and t:exceptions:page_fault_kernel.

### 机制
> brk() and mmap() tracing show virtual memory expansion. Physical memory is consumed later, when the memory is written to, causing page faults, and virtual to physical mappings to be initialized. This activity can happen in a different code path, and one that may (or may not) be more illuminating.
`brk()` / `mmap()` 只代表 VM 地址空间扩张——真正消耗物理内存发生在 first-write 时:
首次写入触发 page fault,内核 `handle_mm_fault` / `page_fault_user` / `page_fault_kernel`
路径建立 V→P 映射并按需分配物理页。因此 page fault 火焰图与 brk/mmap 火焰图的代码路径
**可能不同**——前者是"分配地址",后者是"实际填物理内存"。

### 负载含义
> Page fault tracing shows different code paths: those that are populating physical memory. They will be either: > A memory growth code path A memory leak code path
page fault 火焰图栈宽 = "实际触发物理内存分配的代码路径",对应 2 类含义:
真实内存增长 / 内存泄漏。需结合应用是否持续增长来区分。Java 例:某 page fault 火焰图
观察到 `Universe::initialize_heap` → `os::pretouch_memory`(预触摸正常)和右侧 compiler
tower(JIT 编译方法消耗内存,而非纯数据)——这种"compiler tower"是该 workload 的特征。

### 调优方向
- (#1) [high]
  > "If you are hunting leaks and have a similar application that isn't growing, then taking page fault flame graphs from each and then looking for the extra code paths can be a quick way to identify the difference"
- (#2) [high]
  > "If you are developing applications, then collecting baselines each day should let you identify not only that you have an extra growing or leaking code path, but the day that it appeared, helping you track down the change"

---
