# os-flame-signature-linux-fs

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 1 条 case。

---

## Linux FS metadata syscall hotspot in mmap-based archiver workload

**case_id**: `linux-fs-mmap-metadata-archiver-01`
**来源**: [https://www.brendangregg.com/FlameGraphs/cpuflamegraphs.html](https://www.brendangregg.com/FlameGraphs/cpuflamegraphs.html) (community-canonical)
**平台**: bare
**scope**: linux-fs

**signature_type**: stack-pattern
**match_layer**: stack-frame-pattern
**pattern_regex**: ``^(sys_newfstatat\`

### 火焰图原文模式
> Most of the kernel time is in sys_newfstatat() and sys_getdents(): metadata work as the file system is walked. sys_openat() is on the right, as files are opened to be read, which are then mmap()d (look to the right of sys_getdents(), these are in alphabetical order), and finally page faulted into user-space (see the page_fault() mountain on the left).

### 机制
> Most of the kernel time is in sys_newfstatat() and sys_getdents(): metadata work as the file system is walked. sys_openat() is on the right, as files are opened to be read, which are then mmap()d (look to the right of sys_getdents(), these are in alphabetical order), and finally page faulted into user-space (see the page_fault() mountain on the left). The actual work of moving bytes is then spent in user-land on the mmap'd segments (and not shown in this kernel flame graph).
内核 CPU 时间主要消耗在文件系统元数据遍历(`sys_newfstatat` + `sys_getdents`)和文件打开(`sys_openat`)。归档程序使用 mmap 方式读取文件,触发大量 `page_fault` 将文件内容按需换入用户空间。真正的字节搬运发生在用户态 mmap 段,不在内核火焰图中体现。

### 负载含义
> As an example of a different workload, this shows the Linux kernel CPU time while an ext4 file system was being archived
当火焰图中 `sys_newfstatat`/`sys_getdents`/`page_fault` 等函数显著占据内核 CPU 时间,说明当前负载以文件系统元数据遍历为主(典型场景:归档、备份、目录扫描),且使用了 mmap 映射方式读取文件内容。

### 调优方向
- (#1) [medium]
  > "Had the archiver used the read() syscall instead, this flame graph would look very different, and have a large sys_read() component"

---
