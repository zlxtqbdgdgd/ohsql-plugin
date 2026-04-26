# MongoDB / WiredTiger Checkpoint 调优

关键词：checkpoint log_size wait `__wt_checkpoint` `__checkpoint_tree` 写放大 checkpoint 频繁 抖动 fsync journal

## 背景

WiredTiger 把 cache 里积累的脏页周期性 flush 到磁盘，这个过程叫 **checkpoint**。MongoDB 默认值：

- `checkpoint=(wait=60)` —— 每 60 秒一次
- `checkpoint=(log_size=2GB)` —— journal 文件累计写入 2GB 也强制 checkpoint

两个条件 **谁先到谁触发**。

## 何时会成为瓶颈

| 现象 | 成因 |
|:---|:---|
| 每隔几秒 IOPS 尖刺 | `log_size` 阈值调得过小（< 500MB），写压力下频繁触发 |
| CPU 周期性冲高 | checkpoint 走 `__checkpoint_tree → __evict_reconcile` 吃 CPU |
| DDL（createCollection/Index）卡 | checkpoint 持有 metadata lock |
| `__checkpoint_tree` 占火焰图 > 10% | 间隔过短 |

## 诊断命令

```bash
# 查看当前 checkpoint 配置
mongosh --quiet --eval '
  var s = db.serverStatus().wiredTiger;
  print(JSON.stringify({
    ckpt_runs: s.transaction["transaction checkpoints"],
    ckpt_elapsed: s.transaction["transaction checkpoint total time (msecs)"],
    ckpt_max_ms: s.transaction["transaction checkpoint max time (msecs)"],
    ckpt_current_running: s.transaction["transaction checkpoint currently running"]
  }, null, 2))'
```

## 调优建议

### 1. 写少场景（OLTP 读多写少）
保持默认 `wait=60, log_size=2GB`，无需调整。

### 2. 写多场景（日志/IoT）
- 调大 `log_size` → 减少触发次数
- 适当延长 `wait` 到 120s
- 但要监控 recovery 时间（checkpoint 间隔越长，崩溃恢复越慢）

```bash
mongosh --quiet --eval '
db.adminCommand({setParameter: 1,
  wiredTigerEngineRuntimeConfig: "checkpoint=(log_size=4GB,wait=120)"})'
```

### 3. 故障注入场景（本项目 demo 用）
把 `log_size` 缩到 50MB，让 checkpoint 几秒就触发一次，模拟"checkpoint 风暴"：

```bash
# 注入
db.adminCommand({setParameter: 1,
  wiredTigerEngineRuntimeConfig: "checkpoint=(log_size=50MB,wait=30)"})

# 恢复
db.adminCommand({setParameter: 1,
  wiredTigerEngineRuntimeConfig: "checkpoint=(log_size=2GB,wait=60)"})
```

## 和 Eviction 的耦合

`__checkpoint_tree` 与 `__evict_reconcile` **共享 reconcile 路径**（都是把脏页序列化写盘）。所以当两个子系统同时饱和时，火焰图里会看到 reconcile 这条主干被多股调用栈同时占用，形成典型的"**写放大风暴**"。

诊断口诀：
- 单看 eviction 热 → 扩 cache
- 单看 checkpoint 热 → 调 log_size/wait
- 两个都热 + `__wt_spin_lock` 也热 → 综合治理：关 THP + 扩 cache + 调大 log_size + 减写竞争

## 关联源码

- `__wt_txn_checkpoint` @ `src/third_party/wiredtiger/src/txn/txn_ckpt.c:1440`
- `__txn_checkpoint`    @ `src/third_party/wiredtiger/src/txn/txn_ckpt.c:974`
- `__checkpoint_tree`   @ `src/third_party/wiredtiger/src/txn/txn_ckpt.c:2174`
- `__wt_checkpoint`     @ `src/third_party/wiredtiger/src/txn/txn_ckpt.c:2405`

## 参考

- MongoDB 官方：https://www.mongodb.com/docs/manual/core/wiredtiger/#checkpoints
- WiredTiger 手册：https://source.wiredtiger.com/develop/tune_checkpoint.html
