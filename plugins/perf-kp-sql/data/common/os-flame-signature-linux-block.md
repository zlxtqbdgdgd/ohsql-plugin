# os-flame-signature-linux-block

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 1 条 case。

---

## Off-Wake flame graph stack chain: disk I/O block completion interrupt waking blocked vfs_read()

**case_id**: `linux-block-offwake-disk-io-block-completion-01`
**来源**: [https://www.brendangregg.com/FlameGraphs/offcpuflamegraphs.html](https://www.brendangregg.com/FlameGraphs/offcpuflamegraphs.html) (community-canonical)
**平台**: bare
**scope**: linux-block

**signature_type**: stack-pattern
**match_layer**: stack-frame-pattern
**pattern_regex**: ``^(blkif_interrupt\`

### 火焰图原文模式
> blkif_interrupt __blk_mq_complete_request blk_mq_end_request blk_update_request mpage_end_io wake_up_page_bit __wake_up_common autoremove_wake_function -- -- finish_task_switch __schedule schedule io_schedule generic_file_read_iter __vfs_read vfs_read SyS_pread64 entry_SYSCALL_64_fastpath __GI___libc_pread

### 机制
> As an intermediate and more practical step, I began by associating off-CPU stacks with a single wakeup stack. This is my offwaketime bcc/eBPF tool.
`offwaketime` (bcc/eBPF) 把每个 off-CPU 栈与唤醒它的 waker 栈关联到同一条火焰图记录里。读图法是：从中间分隔符 `--` 起,向下读 off-CPU 栈(被阻塞线程的当前栈),向上倒序读 waker 栈(把目标线程从睡眠唤醒的代码路径)。block I/O 路径下,off-CPU 半段会出现 `finish_task_switch → __schedule → io_schedule → vfs_read` 经典阻塞链,waker 半段会出现 `blkif_interrupt → __blk_mq_complete_request → wake_up_page_bit → __wake_up_common` 块设备完成中断唤醒链——两段在 `--` 处对接。

### 负载含义
> Zoom into the do_command() function (use Search on the top right, if you can't find it) and you can see the block I/O completion interrupts waking up our vfs_read() stacks.
火焰图中若同时观察到内核 block I/O 完成中断路径(`blkif_interrupt` / `__blk_mq_complete_request` / `wake_up_page_bit`)与应用线程在 `vfs_read` / `io_schedule` 上阻塞——两条栈在 off-wake 中点 `--` 对接,说明该应用线程的 off-CPU 时间确实由块设备 I/O 完成所触发的唤醒所终结(即真正阻塞在 disk I/O 上)。这是同步 read 路径上典型的 disk-I/O-bound 信号,与"线程在锁/select/poll 上空等"的场景区分明确。

### 调优方向
- (#1) [high]
  > "As an intermediate and more practical step, I began by associating off-CPU stacks with a single wakeup stack. This is my offwaketime bcc/eBPF tool."

---
