# os-best-practice-mem-allocator-jemalloc

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 1 条 case。

---

## 多线程高并发场景下应用链接 jemalloc 替代 glibc 默认分配器以减少锁竞争

**case_id**: `app-malloc-jemalloc-multithread-01`
**来源**: [https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0051.html](https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0051.html) (official)
**平台**: linux-arm64-kunpeng
**scope**: mem-allocator-jemalloc
**case_pattern**: parameter-best-practice

### 场景 (原文)
> jemalloc是一款内存分配器，与其它内存分配器（glibc）相比，其最大优势在于多线程场景下内存分配性能高以及内存碎片减少。充分发挥鲲鹏芯片多核多并发优势，推荐业务应用代码使用jemalloc进行内存分配。

### 场景 (中文转述)
在鲲鹏芯片多核多并发环境（或任何多线程高并发服务）中，应用使用 glibc 默认内存分配器时，跨线程锁竞争会造成性能瓶颈；jemalloc 通过 thread-local arena 机制大幅减少锁争用，适用于多线程业务进程（MongoDB mongod、MySQL mysqld、自研服务等）。

### 推荐
- 值: ``-ljemalloc``
- 层: other
- 原文:
  > 修改应用软件的链接库的方式，在编译选项中添加如下编译选项：-I`jemalloc-config --includedir`-L`jemalloc-config --libdir` -Wl,-rpath,`jemalloc-config --libdir` -ljemalloc `jemalloc-config --libs`

### 检测方法
> NULL
违规模式: NULL

### 机制 / 原因
glibc 默认的 ptmalloc 分配器在多线程场景下需通过全局/arena 锁来保证内存分配的线程安全，锁争用在高并发时造成线程等待、CPU 利用率低下。jemalloc 为每个线程分配独立的 arena（thread-local），线程内完成内存分配无需竞争他线程锁，从而在鲲鹏多核场景下充分发挥并发优势、减少内存碎片。

### 违反时的风险 (warning)
> 在内存分配过程中，锁会造成线程等待，对性能影响巨大。
若未切换至 jemalloc，继续使用 glibc 默认分配器，多线程高并发场景下锁竞争会导致线程频繁等待、内存分配吞吐下降，CPU 整体利用率偏低，在鲲鹏多核场景尤为显著。

---
