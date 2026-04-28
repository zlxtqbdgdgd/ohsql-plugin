# os-flame-signature-mem-allocator-glibc

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 1 条 case。

---

## glibc malloc allocator tracing hot stack — application allocation code path

**case_id**: `glibc-malloc-allocator-hot-stack-01`
**来源**: [https://www.brendangregg.com/FlameGraphs/memoryflamegraphs.html](https://www.brendangregg.com/FlameGraphs/memoryflamegraphs.html) (community-canonical)
**平台**: bare
**scope**: mem-allocator-glibc

**signature_type**: stack-pattern
**match_layer**: stack-frame-pattern
**pattern_regex**: ``^(__GI___libc_malloc\`

### 火焰图原文模式
> __GI___libc_malloc Perl_sv_grow Perl_sv_setpvn Perl_newSVpvn_flags Perl_pp_split Perl_runops_standard

### 机制
> This is where the memory allocator functions, malloc(), free(), etc, are traced. Imagine you could run Valgrind memcheck with "-p PID" on a process, and gather memory leak statistics for 60 seconds or so. Not a complete picture, but hopefully enough to catch egregious leaks.
火焰图叶子若密集落在 glibc 的 `__GI___libc_malloc` 等内存分配器入口函数,说明启用了
allocator-level uprobe/eBPF 跟踪。该方法把每次 `malloc()` / `free()` 的调用栈采样上来,
等价于用类似 `valgrind memcheck -p PID` 的方式追踪 60 秒内的分配热点。叶子是 `__GI___libc_malloc`、
中间几层是语言运行时(此处为 Perl)、栈底是应用业务函数(此处为 `Perl_pp_split`)。

### 负载含义
> This tells us that the most malloc() calls were in st_select_lex::optimize() -> JOIN::optimize(). But that's not where most of the bytes were allocated.
allocator 火焰图栈宽 = "该路径下 `malloc()` 调用次数 / 申请字节数"。看到某条栈链路宽
(如 MySQL `JOIN::optimize` / `JOIN::exec` 段)→ 说明该业务路径正在频繁申请内存,
是 allocator 子系统压力 / 内存增长 / leak 嫌疑代码路径。**注意**:调用次数热不等于
字节数热——`JOIN::optimize` 调用次数最多,但实际字节数最大的是 `JOIN::exec`,
排查时需同时看 `--countname=calls` 和 `--countname=bytes` 两版火焰图。

### 调优方向
- (#1) [high]
  > "remember to trace all allocator functions: malloc(), realloc(), calloc(), etc. You can also instrument the size of the allocation, and include that instead of the sample count, so that the flame graph shows bytes allocated rather than a count of calls"
- (#2) [high]
  > "Because of overhead, I try to use other memory analysis techniques described in the sections that follow (brk(), mmap(), page faults)"

---
