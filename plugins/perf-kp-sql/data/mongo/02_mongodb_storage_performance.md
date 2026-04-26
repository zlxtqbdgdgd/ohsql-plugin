---
source: https://www.mongodb.com/docs/manual/core/wiredtiger/
authority: mongodb_official
authority_level: ⭐⭐⭐ MongoDB 官方文档
title: "MongoDB 存储引擎与性能调优指南（官方整合版）"
last_verified: 2026-04-11
topics: WiredTiger, cacheSizeGB, TCMalloc, THP透明大页, IO调度, Swap/OOM
---

# MongoDB 存储引擎与性能调优指南

> 整合自 MongoDB 官方文档：WiredTiger + TCMalloc/THP + IO/Swap 调优

---

## 第一部分：WiredTiger 存储引擎

> 来源: https://www.mongodb.com/docs/manual/core/wiredtiger/


# MongoDB WiredTiger 存储引擎 (官方)

> 来源: https://www.mongodb.com/docs/manual/core/wiredtiger/

## Note
All MongoDB Atlas deployments use the WiredTiger storage engine.
- [MongoDB Enterprise](https://www.mongodb.com/docs/manual/administration/install-enterprise/#std-label-install-mdb-enterprise): The
subscription-based, self-managed version of MongoDB
- [MongoDB Community](https://www.mongodb.com/docs/manual/administration/install-community/#std-label-install-mdb-community-edition): The
source-available, free-to-use, and self-managed version of MongoDB
[MongoDB Enterprise](https://www.mongodb.com/docs/manual/administration/install-enterprise/#std-label-install-mdb-enterprise): The subscription-based, self-managed version of MongoDB
[MongoDB Community](https://www.mongodb.com/docs/manual/administration/install-community/#std-label-install-mdb-community-edition): The source-available, free-to-use, and self-managed version of MongoDB

## https://www.mongodb.com/docs/manual/core/wiredtiger/#operation-and-limitationsOperation and Limitations
The following operational notes and limitations apply to the WiredTiger engine:
- You can't pin documents to the WiredTiger cache.
- WiredTiger doesn't reserve a portion of the cache for reads and
another for writes.
- WiredTiger allocates its cache to the entire [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)
instance.
WiredTiger doesn't allocate cache on a per-database or per-collection
level.
You can't pin documents to the WiredTiger cache.
WiredTiger doesn't reserve a portion of the cache for reads and another for writes.
WiredTiger allocates its cache to the entire [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance. WiredTiger doesn't allocate cache on a per-database or per-collection level.

```
mongod
```

## https://www.mongodb.com/docs/manual/core/wiredtiger/#transaction--read-and-write--concurrencyTransaction (Read and Write) Concurrency
Starting in version 7.0, MongoDB uses a default algorithm to dynamically adjust the maximum number of concurrent storage engine transactions, or read and write tickets. The dynamic concurrent storage engine transaction algorithm optimizes database throughput during cluster overload.

## Note
The dynamic algorithm also results in lower overall ticket usage, even under normal conditions, because the algorithm starts with a much lower baseline number of available tickets. As a result, when upgrading to MongoDB 7.0, you may observe a significant drop in ticket usage, which is expected behavior.
The maximum number of concurrent storage engine transactions, or read and write tickets, never exceeds 128 read tickets and 128 write tickets and may differ across nodes in a cluster. The maximum number of read tickets and write tickets within a single node are always equal.
To specify a maximum number of read and write transactions, or read and write tickets, that the dynamic maximum can not exceed, use [storageEngineConcurrentReadTransactions](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.storageEngineConcurrentReadTransactions) and [storageEngineConcurrentWriteTransactions.](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.storageEngineConcurrentWriteTransactions)

```
storageEngineConcurrentReadTransactions
```

```
storageEngineConcurrentWriteTransactions
```

If you want to disable the dynamic concurrent storage engine transactions algorithm, file a support request to work with a MongoDB Technical Services Engineer.
To view the number of concurrent read transactions (read tickets) and write transactions (write tickets) allowed in the WiredTiger storage engine, use the [serverStatus](https://www.mongodb.com/docs/manual/reference/command/serverStatus/#mongodb-dbcommand-dbcmd.serverStatus) command and see the [queues.execution](https://www.mongodb.com/docs/manual/reference/command/serverStatus/#mongodb-serverstatus-serverstatus.queues.execution) response document.

```
serverStatus
```

```
queues.execution
```

## Note
A low value of [available](https://www.mongodb.com/docs/manual/reference/command/serverStatus/#mongodb-serverstatus-serverstatus.available) in [queues.execution](https://www.mongodb.com/docs/manual/reference/command/serverStatus/#mongodb-serverstatus-serverstatus.queues.execution) does not indicate a cluster overload. Use the number of queued read and write tickets as an indication of cluster overload.

```
available
```

```
queues.execution
```

## https://www.mongodb.com/docs/manual/core/wiredtiger/#document-level-concurrencyDocument Level Concurrency
WiredTiger uses document-level concurrency control for write operations. As a result, multiple clients can modify different documents of a collection at the same time.
For most read and write operations, WiredTiger uses optimistic concurrency control. WiredTiger uses only intent locks at the global, database and collection levels. When the storage engine detects conflicts between two operations, one will incur a write conflict causing MongoDB to transparently retry that operation.
Some global operations, typically short lived operations involving multiple databases, still require a global "instance-wide" lock. Some other operations, such as [renameCollection](https://www.mongodb.com/docs/manual/reference/command/renameCollection/#mongodb-dbcommand-dbcmd.renameCollection), still require an exclusive database lock in certain circumstances.

```
renameCollection
```

## https://www.mongodb.com/docs/manual/core/wiredtiger/#snapshots-and-checkpointsSnapshots and Checkpoints
WiredTiger uses MultiVersion Concurrency Control (MVCC). At the start of an operation, WiredTiger provides a point-in-time snapshot of the data to the operation. A snapshot presents a consistent view of the in-memory data.
When writing to disk, WiredTiger writes all the data in a snapshot to disk in a consistent way across all data files. The now-[durable](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-durable) data act as a checkpoint in the data files. The checkpoint ensures that the data files are consistent up to and including the last checkpoint; i.e. checkpoints can act as recovery points.
MongoDB configures WiredTiger to create checkpoints, specifically, writing the snapshot data to disk at intervals of 60 seconds.
During the write of a new checkpoint, the previous checkpoint is still valid. As such, even if MongoDB terminates or encounters an error while writing a new checkpoint, upon restart, MongoDB can recover from the last valid checkpoint.
The new checkpoint becomes accessible and permanent when WiredTiger's metadata table is atomically updated to reference the new checkpoint. Once the new checkpoint is accessible, WiredTiger frees pages from the old checkpoints.

Starting in MongoDB 5.0, you can use the [minSnapshotHistoryWindowInSeconds](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.minSnapshotHistoryWindowInSeconds) parameter to specify how long WiredTiger keeps the snapshot history.

```
minSnapshotHistoryWindowInSeconds
```

Increasing the value of [minSnapshotHistoryWindowInSeconds](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.minSnapshotHistoryWindowInSeconds) increases disk usage because the server must maintain the history of older modified values within the specified time window. The amount of disk space used depends on your workload, with higher volume workloads requiring more disk space.

```
minSnapshotHistoryWindowInSeconds
```

MongoDB maintains the snapshot history in the WiredTigerHS.wt file, located in your specified [dbPath.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath)

```
WiredTigerHS.wt
```

```
dbPath
```

## https://www.mongodb.com/docs/manual/core/wiredtiger/#journalJournal
WiredTiger uses a write-ahead log (i.e. journal) in combination with [checkpoints](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger-checkpoints) to ensure data durability.
The WiredTiger journal persists all data modifications between checkpoints. If MongoDB exits between checkpoints, it uses the journal to replay all data modified since the last checkpoint. For information on the frequency with which MongoDB writes the journal data to disk, see [Journaling Process.](https://www.mongodb.com/docs/manual/core/journaling/#std-label-journal-process)
WiredTiger journal is compressed using the [snappy](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-snappy) compression library. To specify a different compression algorithm or no compression, use the [storage.wiredTiger.engineConfig.journalCompressor](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.journalCompressor) setting. For details on changing the journal compressor, see [Change WiredTiger Journal Compressor.](https://www.mongodb.com/docs/manual/tutorial/manage-journaling/#std-label-manage-journaling-change-wt-journal-compressor)

```
storage.wiredTiger.engineConfig.journalCompressor
```

## Note
If a log record is less than or equal to 128 bytes, which is the minimum [log record size for WiredTiger](https://www.mongodb.com/docs/manual/core/journaling/#std-label-wt-jouraling-record), WiredTiger does not compress that record.

## Tip
- Journaling with WiredTiger

## https://www.mongodb.com/docs/manual/core/wiredtiger/#compressionCompression
With WiredTiger, MongoDB supports compression for all collections and indexes. Compression minimizes storage use at the expense of additional CPU.
By default, WiredTiger uses block compression with the [snappy](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-snappy) compression library for most collections and [prefix compression](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-prefix-compression) for all indexes. However, the default block compression for time-series collections is [zstd.](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-zstd)
For collections, the following block compression libraries are also available:
- [zlib](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-zlib)
- [zstd](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-zstd)
To specify an alternate compression algorithm or no compression, use the [storage.wiredTiger.collectionConfig.blockCompressor](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.collectionConfig.blockCompressor) setting.

```
storage.wiredTiger.collectionConfig.blockCompressor
```

For indexes, to disable [prefix compression](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-prefix-compression), use the [storage.wiredTiger.indexConfig.prefixCompression](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.indexConfig.prefixCompression) setting.

```
storage.wiredTiger.indexConfig.prefixCompression
```

Compression settings are also configurable on a per-collection and per-index basis during collection and index creation. See [Specify Storage Engine Options](https://www.mongodb.com/docs/manual/reference/method/db.createCollection/#std-label-create-collection-storage-engine-options) and [db.collection.createIndex() storageEngine option.](https://www.mongodb.com/docs/manual/reference/method/db.collection.createIndex/#std-label-createIndex-options)
For most workloads, the default compression settings balance storage efficiency and processing requirements.
The WiredTiger journal is also compressed by default. For information on journal compression, see [Journal.](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger-journal)

## https://www.mongodb.com/docs/manual/core/wiredtiger/#memory-useMemory Use
With WiredTiger, MongoDB utilizes both the WiredTiger internal cache and the filesystem cache.

The default WiredTiger internal cache size is the larger of either:
- 50% of (RAM - 1GB), or
- 0.256 GB.
50% of (RAM - 1GB), or
0.256 GB.
For example, on a system with a total of 4GB of RAM the WiredTiger cache uses 1.5GB of RAM (0.5 * (4GB - 1GB) = 1.5 GB). When providing a specific cache size ensure the RAM does not exceed the bounds of 0.256GB to 10000GB.

```
0.5 * (4GB - 1GB) = 1.5 GB
```

Avoid increasing the WiredTiger internal cache size above its default value. If your case requires to do so, you can use --wiredTigerCacheSizePct to account for changes in memory due to vertical. You must specify a percentage of up to 80% of available memory. Calculated values can range from 0.256GB to 10000GB. For example, on a system with 2GB of RAM the --wiredTigerCacheSizePct cannot be set to 10 because 10% of 2GB is 0.2 GB, which is less than 0.256GB.

```
--wiredTigerCacheSizePct
```

```
--wiredTigerCacheSizePct
```

In some instances, such as when running in a container that is configured to use less RAM than the amount of memory provisioned for the host, you must account for the limits. You may need to configure the WiredTiger cache to an appropriate value, as WiredTiger may not account for the memory limits of the specific container in certain cases.
To view the [memory limit](https://www.mongodb.com/docs/manual/reference/command/[hostInfo](https://www.mongodb.com/docs/manual/reference/command/hostInfo/#mongodb-dbcommand-dbcmd.hostInfo)/#mongodb-data-hostInfo.system.memLimitMB), the value that WiredTiger utilizes as the maximum amount of RAM available use the hostInfo command.

```
memory limit
```

```
hostInfo
```

By default, WiredTiger uses Snappy block compression for all collections and prefix compression for all indexes. Compression defaults are configurable at a global level and can also be set on a per-collection and per-index basis during collection and index creation.
Different representations are used for data in the WiredTiger internal cache versus the on-disk format:
- Data in the filesystem cache is the same as the on-disk format, including
benefits of any compression for data files. The filesystem cache is used
by the operating system to reduce disk I/O.
- Indexes loaded in the WiredTiger internal cache have a different data
representation to the on-disk format, but can still take advantage of
index prefix compression to reduce RAM usage. Index prefix compression
deduplicates common prefixes from indexed fields.
- Collection data in the WiredTiger internal cache is uncompressed
and uses a different representation from the on-disk format. Block
compression can provide significant on-disk storage savings, but
data must be uncompressed to be manipulated by the server.
Data in the filesystem cache is the same as the on-disk format, including benefits of any compression for data files. The filesystem cache is used by the operating system to reduce disk I/O.
Indexes loaded in the WiredTiger internal cache have a different data representation to the on-disk format, but can still take advantage of index prefix compression to reduce RAM usage. Index prefix compression deduplicates common prefixes from indexed fields.
Collection data in the WiredTiger internal cache is uncompressed and uses a different representation from the on-disk format. Block compression can provide significant on-disk storage savings, but data must be uncompressed to be manipulated by the server.
With the filesystem cache, MongoDB automatically uses all free memory that is not used by the WiredTiger cache or by other processes.
To adjust the size of the WiredTiger internal cache, see [--wiredTigerCacheSizeGB](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--wiredTigerCacheSizeGB) and [storage.wiredTiger.engineConfig.cacheSizeGB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizeGB). Avoid increasing the WiredTiger internal cache size above its default value. If your use case requires increased internal cache size, see [--wiredTigerCacheSizePct](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--wiredTigerCacheSizePct) and [storage.wiredTiger.engineConfig.cacheSizePct.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizePct)

```
--wiredTigerCacheSizeGB
```

```
storage.wiredTiger.engineConfig.cacheSizeGB
```

```
--wiredTigerCacheSizePct
```

```
storage.wiredTiger.engineConfig.cacheSizePct
```

With the filesystem cache, MongoDB automatically uses all free memory that is not used by the WiredTiger cache or by other processes.

The [--wiredTigerCacheSizeGB](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--wiredTigerCacheSizeGB) limits the size of the WiredTiger internal cache. The operating system uses the available free memory for filesystem cache, which allows the compressed MongoDB data files to stay in memory. In addition, the operating system uses any free RAM to buffer file system blocks and file system cache.

```
--wiredTigerCacheSizeGB
```

To accommodate the additional consumers of RAM, you may have to decrease WiredTiger internal cache size.
The default WiredTiger internal cache size value assumes that there is a single [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance per machine. If a single machine contains multiple MongoDB instances, decrease the setting to accommodate the other mongod instances.

```
mongod
```

```
mongod
```

If you run [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) in a container (for example, lxc, cgroups, Docker, etc.) that does not have access to all of the RAM available in a system, you must set [--wiredTigerCacheSizeGB](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--wiredTigerCacheSizeGB) or [--wiredTigerCacheSizePct](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--wiredTigerCacheSizePct) to a value less than the amount of RAM available in the container. The exact amount depends on the other processes running in the container. See [memLimitMB.](https://www.mongodb.com/docs/manual/reference/command/hostInfo/#mongodb-data-hostInfo.system.memLimitMB)

```
mongod
```

```
lxc
```

```
cgroups
```

```
--wiredTigerCacheSizeGB
```

```
--wiredTigerCacheSizePct
```

```
memLimitMB
```

You can only provide one of either [--wiredTigerCacheSizeGB](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--wiredTigerCacheSizeGB) or [--wiredTigerCacheSizePct.](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--wiredTigerCacheSizePct)

```
--wiredTigerCacheSizeGB
```

```
--wiredTigerCacheSizePct
```

Back
Storage Engines
Next
Change Standalone to WiredTiger
On this page

- [Document Level Concurrency](https://www.mongodb.com/docs/manual/core/wiredtiger/#document-level-concurrency)
- [Snapshots and Checkpoints](https://www.mongodb.com/docs/manual/core/wiredtiger/#snapshots-and-checkpoints)
- [Journal](https://www.mongodb.com/docs/manual/core/wiredtiger/#journal)
- [Compression](https://www.mongodb.com/docs/manual/core/wiredtiger/#compression)
- [Memory Use](https://www.mongodb.com/docs/manual/core/wiredtiger/#memory-use)
- Operation and Limitations
- Transaction (Read and Write) Concurrency
- Document Level Concurrency
- Snapshots and Checkpoints

- Journal
- Compression
- Memory Use
On this page
- [Operation and Limitations](https://www.mongodb.com/docs/manual/core/wiredtiger/#operation-and-limitations)
- [Transaction (Read and Write) Concurrency](https://www.mongodb.com/docs/manual/core/wiredtiger/#transaction--read-and-write--concurrency)
- [Document Level Concurrency](https://www.mongodb.com/docs/manual/core/wiredtiger/#document-level-concurrency)
- [Snapshots and Checkpoints](https://www.mongodb.com/docs/manual/core/wiredtiger/#snapshots-and-checkpoints)
- [Journal](https://www.mongodb.com/docs/manual/core/wiredtiger/#journal)
- [Compression](https://www.mongodb.com/docs/manual/core/wiredtiger/#compression)
- [Memory Use](https://www.mongodb.com/docs/manual/core/wiredtiger/#memory-use)
- Operation and Limitations
- Transaction (Read and Write) Concurrency
- Document Level Concurrency
- Snapshots and Checkpoints
- Journal
- Compression
- Memory Use


---

### WiredTiger 缓存配置补充


# MongoDB 调优知识库 — WiredTiger 缓存与内存管理

## WiredTiger Cache 配置原则

### 默认行为
WiredTiger 存储引擎默认使用以下公式计算最大缓存：
- `max(256MB, (总内存 - 1GB) * 50%)`

### 常见问题

#### 1. Cache 过大导致 OOM
当多个服务共存时，WiredTiger 的默认 50% 内存占用可能导致 OOM Killer 介入。

**解决方案**：
```javascript
// 动态调整（立即生效）
db.adminCommand({setParameter: 1, wiredTigerEngineRuntimeConfig: "cache_size=2G"})

// 永久配置（需重启）
// mongod.conf:
// storage:
//   wiredTiger:
//     engineConfig:
//       cacheSizeGB: 2
```

#### 2. Eviction 自旋锁 (__wt_spin_lock)
当脏页比例超过 eviction_target 水位时，WiredTiger 的驱逐线程会疯狂自旋等待刷盘完成。
火焰图表现为 `__wt_cache_evict_server → __wt_spin_lock` 占用 80%+ CPU。

**解决方案**：
```javascript
// 调低驱逐触发水位，增加驱逐工作线程
db.adminCommand({
    setParameter: 1,
    wiredTigerEngineRuntimeConfig: "eviction=(threads_max=4),eviction_target=80"
})

// 验证
db.serverStatus().wiredTiger.cache
```

#### 3. 大页（HugePages）与 WiredTiger
WiredTiger 自身不使用 Linux HugePages。但如果同机部署的其他服务（如 GaussDB）配置了 `shared_buffers` 依赖大页，需确保 `vm.nr_hugepages` 足够覆盖。

### NUMA 绑核建议
在多 NUMA 节点的鲲鹏服务器上，MongoDB 的 mongod 进程应绑定到单个 NUMA 节点以避免远端内存访问延迟：
```bash
numactl --cpunodebind=0 --membind=0 mongod --config /etc/mongod.conf
```

同时需关闭 NUMA Balancing：
```bash
echo 0 > /proc/sys/kernel/numa_balancing
```

### 参考来源
- MongoDB WiredTiger Storage Engine: https://www.mongodb.com/docs/manual/core/wiredtiger/
- WiredTiger Tuning: https://source.wiredtiger.com/develop/tune_cache.html


---

### WiredTiger 官方配置参考



---

.. _storage-wiredtiger:
.. _storage-wiredTiger:

=========================
WiredTiger Storage Engine
=========================

.. default-domain:: mongodb

.. facet::
   :name: genre
   :values: reference

.. meta:: 
   :description: Learn how WiredTiger, MongoDB's default storage engine, works.

.. contents:: On this page
   :local:
   :backlinks: none
   :depth: 1
   :class: singlecol

The WiredTiger storage engine is the default storage engine. For existing 
deployments, if you do not specify the ``--storageEngine`` or the 
:setting:`storage.engine` setting, the :binary:`~bin.mongod` instance can 
automatically determine the storage engine used to create the data files in the 
``--dbpath`` or :setting:`storage.dbPath`. 

Deployments hosted in the following environments can use the WiredTiger
storage engine:

.. include:: /includes/fact-environments-atlas-only.rst

.. note::

   All {+atlas+} deployments use the WiredTiger storage engine.

.. include:: /includes/fact-environments-onprem-only.rst

.. |link-topic-ing| replace:: WiredTiger memory use

.. |atlas-url| replace:: :atlas:`Memory </sizing-tier-selection/#memory>`

.. include:: /includes/fact-atlas-link.rst

Operation and Limitations
-------------------------

The following operational notes and limitations apply to the WiredTiger
engine:

- You can't pin documents to the WiredTiger cache.
- WiredTiger doesn't reserve a portion of the cache for reads and 
  another for writes.
- A heavy write workload can affect performance, but WiredTiger
  prioritizes index caching in such cases.
- WiredTiger allocates its cache to the entire :binary:`~bin.mongod`
  instance. 
  WiredTiger doesn't allocate cache on a per-database or per-collection
  level.

Transaction (Read and Write) Concurrency
----------------------------------------

.. include:: /includes/fact-dynamic-concurrency.rst

To view the number of concurrent read transactions (read tickets) and
write transactions (write tickets) allowed in the WiredTiger storage
engine, use the :dbcommand:`serverStatus` command and see the
:serverstatus:`queues.execution` response document.

.. note::

   A low value of :serverstatus:`available` in 
   :serverstatus:`queues.execution` does not indicate a cluster 
   overload. Use the number of queued read and write tickets as 
   an indication of cluster overload.

Document Level Concurrency
--------------------------

WiredTiger uses *document-level* concurrency control for write
operations. As a result, multiple clients can modify different
documents of a collection at the same time.

.. include:: /includes/fact-wiredtiger-locks.rst

.. _storage-wiredtiger-checkpoints:

Snapshots and Checkpoints
-------------------------

WiredTiger uses MultiVersion Concurrency Control (MVCC). At the start
of an operation, WiredTiger provides a point-in-time snapshot of the
data to the operation. A snapshot presents a consistent view of the
in-memory data.

When writing to disk, WiredTiger writes all the data in a snapshot to
disk in a consistent way across all data files. The now-:term:`durable`
data act as a *checkpoint* in the data files. The *checkpoint* ensures
that the data files are consistent up to and including the last
checkpoint; i.e. checkpoints can act as recovery points.

.. include:: /includes/extracts/wt-snapshot-frequency.rst

During the write of a new checkpoint, the previous checkpoint is still
valid. As such, even if MongoDB terminates or encounters an error while
writing a new checkpoint, upon restart, MongoDB can recover from the
last valid checkpoint.

The new checkpoint becomes accessible and permanent when WiredTiger's
metadata table is atomically updated to reference the new checkpoint.
Once the new checkpoint is accessible, WiredTiger frees pages from the
old checkpoints.

.. _storage-snapshot-history:

Snapshot History Retention
~~~~~~~~~~~~~~~~~~~~~~~~~~

Starting in MongoDB 5.0, you can use the
:parameter:`minSnapshotHistoryWindowInSeconds` parameter to specify how
long WiredTiger keeps the snapshot history.

Increasing the value of :parameter:`minSnapshotHistoryWindowInSeconds`
increases disk usage because the server must maintain the history of
older modified values within the specified time window. The amount of
disk space used depends on your workload, with higher volume workloads
requiring more disk space.

MongoDB maintains the snapshot history in the ``WiredTigerHS.wt`` file,
located in your specified :setting:`~storage.dbPath`.

.. _storage-wiredtiger-journal:

Journal
-------

WiredTiger uses a write-ahead log (i.e. journal) in combination with
:ref:`checkpoints <storage-wiredtiger-checkpoints>` to ensure data
durability.

The WiredTiger journal persists all data modifications between
checkpoints. If MongoDB exits between checkpoints, it uses the journal
to replay all data modified since the last checkpoint. For information
on the frequency with which MongoDB writes the journal data to disk,
see :ref:`journal-process`.

WiredTiger journal is compressed using the :term:`snappy` compression
library. To specify a different compression algorithm or no
compression, use the
:setting:`storage.wiredTiger.engineConfig.journalCompressor` setting.
For details on changing the journal compressor, see
:ref:`manage-journaling-change-wt-journal-compressor`.

.. note::

   .. include:: /includes/extracts/wt-log-compression-limit.rst

.. seealso::

   :ref:`Journaling with WiredTiger <journaling-wiredTiger>`

.. _storage-wiredtiger-compression:

Compression
-----------

With WiredTiger, MongoDB supports compression for all collections and
indexes. Compression minimizes storage use at the expense of additional
CPU.

By default, WiredTiger uses block compression with the :term:`snappy`
compression library for all collections and :term:`prefix compression`
for all indexes.

For collections, the following block compression libraries are also available:

- :term:`zlib` 

- :term:`zstd` 

To specify an alternate compression algorithm or no compression, use
the :setting:`storage.wiredTiger.collectionConfig.blockCompressor`
setting.

For indexes, to disable :term:`prefix compression`, use the
:setting:`storage.wiredTiger.indexConfig.prefixCompression` setting.

Compression settings are also configurable on a per-collection and
per-index basis during collection and index creation. See
:ref:`create-collection-storage-engine-options` and
:ref:`db.collection.createIndex() storageEngine option
<createIndex-options>`.

For most workloads, the default compression settings balance storage
efficiency and processing requirements.

The WiredTiger journal is also compressed by default. For information
on journal compression, see :ref:`storage-wiredtiger-journal`.

.. _wiredtiger-RAM:

Memory Use
----------

.. include:: /includes/extracts/wt-cache-utilization.rst

.. include:: /includes/extracts/wt-cache-setting.rst


---

## 第二部分：TCMalloc 与 THP 性能优化

> 来源: https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/


# MongoDB TCMalloc 与 THP 性能优化 (官方)

> 来源: https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/

## https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#platform-supportPlatform Support
Operating systems that support MongoDB 8.0 also support the updated TCMalloc, except for the following:
- RHEL 8 / Oracle 8 on the
[PPC64LE](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-prod-notes-supported-platforms-PPC64LE) and
[s390x](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-prod-notes-supported-platforms-s390x) architectures
- RHEL 9 / CentOS 9 / Oracle 9 on the
[PPC64LE](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-prod-notes-supported-platforms-PPC64LE) architecture
RHEL 8 / Oracle 8 on the [PPC64LE](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-prod-notes-supported-platforms-PPC64LE) and [s390x](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-prod-notes-supported-platforms-s390x) architectures
RHEL 9 / CentOS 9 / Oracle 9 on the [PPC64LE](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-prod-notes-supported-platforms-PPC64LE) architecture
These operating systems use the legacy TCMalloc version. If you use these operating systems, [disable THP.](https://www.mongodb.com/docs/manual/tutorial/disable-transparent-huge-pages/#std-label-disable-thp)
Windows uses the legacy TCMalloc version and does not support the updated TCMalloc.

## https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#enable-transparent-hugepages--thp-Enable Transparent Hugepages (THP)
Transparent Hugepages (THP) is a Linux memory management system that reduces the overhead of Translation Lookaside Buffer (TLB) lookups. THP achieves this by combining small pages and making them appear as larger memory pages to the application.

```
mongod
```

## Note
THP operates at a system level, so it applies to all processes under the system. You cannot enable or disable THP per-process level.

```
ktune
```

```
tuned
```

```
tuned
```

To create a service file that enables THP, use the built-in initialization system for your platform. Recent versions of Linux typically use systemd, which uses the systemctl command. Older versions of Linux tend to use System V init, which uses the service command. For more information, see the documentation for your operating system.

```
systemctl
```

```
service
```

Use the initialization system for your platform:

#### https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#create-the-systemd-unit-fileCreate the systemd unit file

```
systemd
```

Create the following file and save it at /etc/systemd/system/enable-transparent-huge-pages.service:

```
/etc/systemd/system/enable-transparent-huge-pages.service
```

```
```

```
```

Some versions of Red Hat Enterprise Linux, and potentially other Red Hat-based derivatives, use a different path for the THP enabled file:

```
enabled
```

```
/sys/kernel/mm/redhat_transparent_hugepage/enabled
```

```
/sys/kernel/mm/redhat_transparent_hugepage/enabled
```

Verify which path is in use on your system and update the enable-transparent-huge-pages.service file accordingly.

```
enable-transparent-huge-pages.service
```

#### https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#reload-systemd-unit-filesReload systemd unit files

```
systemd
```

To reload the systemd unit files and make enable-transparent-huge-pages.service available for use, run the following command :

```
systemd
```

```
enable-transparent-huge-pages.service
```

```
sudo systemctl daemon-reload
```

```
sudo systemctl daemon-reload
```

#### https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#start-the-serviceStart the service
Run:

```
sudo systemctl start enable-transparent-huge-pages
```

```
sudo systemctl start enable-transparent-huge-pages
```

To verify that the relevant THP settings have changed, run the following command:

```
cat /sys/kernel/mm/transparent_hugepage/enabled && cat /sys/kernel/mm/transparent_hugepage/defrag && cat /sys/kernel/mm/transparent_hugepage/khugepaged/max_ptes_none && cat /proc/sys/vm/overcommit_memory
```

```
cat /sys/kernel/mm/transparent_hugepage/enabled && cat /sys/kernel/mm/transparent_hugepage/defrag && cat /sys/kernel/mm/transparent_hugepage/khugepaged/max_ptes_none && cat /proc/sys/vm/overcommit_memory
```

On Red Hat Enterprise Linux and potentially other Red Hat-based derivatives, you may instead need to use the following:

```
cat /sys/kernel/mm/redhat_transparent_hugepage/enabled && cat /sys/kernel/mm/redhat_transparent_hugepage/defrag && cat /sys/kernel/mm/redhat_transparent_hugepage/khugepaged/max_ptes_none && cat /proc/sys/vm/overcommit_memory
```

```
cat /sys/kernel/mm/redhat_transparent_hugepage/enabled && cat /sys/kernel/mm/redhat_transparent_hugepage/defrag && cat /sys/kernel/mm/redhat_transparent_hugepage/khugepaged/max_ptes_none && cat /proc/sys/vm/overcommit_memory
```

The output should resemble the following:

```
alwaysdefer+madvise01
```

```
alwaysdefer+madvise01
```

#### https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#configure-your-operating-system-to-run-it-on-boot.Configure your operating system to run it on boot.
To ensure that this setting is applied each time the operating system starts, run the following command:

```
sudo systemctl enable enable-transparent-huge-pages
```

```
sudo systemctl enable enable-transparent-huge-pages
```

#### https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#-optional--customize-tuned-or-ktune-profile(Optional) Customize tuned or ktune profile
If you use tuned or ktune proffiles on RHEL/ CentOS, you must also create a custom tuned profile.

```
tuned
```

```
ktune
```

```
tuned
```

#### https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#create-the-init.d-scriptCreate the init.d script

```
init.d
```

Create the following file and save it at /etc/init.d/enable-transparent-hugepages:

```
/etc/init.d/enable-transparent-hugepages
```

```
#!/bin/bash### BEGIN INIT INFO# Provides: enable-transparent-hugepages# Required-Start: $local_fs# Required-Stop:# X-Start-Before: mongod mongodb-mms-automation-agent# Default-Start: 2 3 4 5# Default-Stop: 0 1 6# Short-Description: Enable Linux Transparent Hugepages# Description: Enable Linux Transparent Hugepages, to improve# database performance.### END INIT INFOcase $1 in start) if [ -d /sys/kernel/mm/transparent_hugepage ]; then thp_path=/sys/kernel/mm/transparent_hugepage elif [ -d /sys/kernel/mm/redhat_transparent_hugepage ]; then thp_path=/sys/kernel/mm/redhat_transparent_hugepage else return 0 fi echo 'always' | tee ${thp_path}/enabled > /dev/null && echo defer+madvise | tee ${thp_path}/defrag > /dev/null && echo 0 | tee ${thp_path}/khugepaged/max_ptes_none > /dev/null && echo 1 | tee /proc/sys/vm/overcommit_memory > /dev/null' unset thp_path ;;esac
```

```
#!/bin/bash### BEGIN INIT INFO# Provides: enable-transparent-hugepages# Required-Start: $local_fs# Required-Stop:# X-Start-Before: mongod mongodb-mms-automation-agent# Default-Start: 2 3 4 5# Default-Stop: 0 1 6# Short-Description: Enable Linux Transparent Hugepages# Description: Enable Linux Transparent Hugepages, to improve# database performance.### END INIT INFOcase $1 in start) if [ -d /sys/kernel/mm/transparent_hugepage ]; then thp_path=/sys/kernel/mm/transparent_hugepage elif [ -d /sys/kernel/mm/redhat_transparent_hugepage ]; then thp_path=/sys/kernel/mm/redhat_transparent_hugepage else return 0 fi echo 'always' | tee ${thp_path}/enabled > /dev/null && echo defer+madvise | tee ${thp_path}/defrag > /dev/null && echo 0 | tee ${thp_path}/khugepaged/max_ptes_none > /dev/null && echo 1 | tee /proc/sys/vm/overcommit_memory > /dev/null' unset thp_path ;;esac
```

#### https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#make-the-script-executableMake the script executable
Run:

```
sudo chmod 755 /etc/init.d/enable-transparent-hugepages
```

```
sudo chmod 755 /etc/init.d/enable-transparent-hugepages
```

#### https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#run-the-scriptRun the script
Run:

```
sudo /etc/init.d/enable-transparent-hugepages start
```

```
sudo /etc/init.d/enable-transparent-hugepages start
```

To verify that the relevant THP settings have changed, run the following command:

```
cat /sys/kernel/mm/transparent_hugepage/enabled && cat /sys/kernel/mm/transparent_hugepage/defrag && cat /sys/kernel/mm/transparent_hugepage/khugepaged/max_ptes_none && cat /proc/sys/vm/overcommit_memory
```

```
cat /sys/kernel/mm/transparent_hugepage/enabled && cat /sys/kernel/mm/transparent_hugepage/defrag && cat /sys/kernel/mm/transparent_hugepage/khugepaged/max_ptes_none && cat /proc/sys/vm/overcommit_memory
```

On Red Hat Enterprise Linux and potentially other Red Hat-based derivatives, you may instead need to use the following:

```
cat /sys/kernel/mm/redhat_transparent_hugepage/enabled
```

```
cat /sys/kernel/mm/redhat_transparent_hugepage/enabled
```

The output should resemble the following:

```
alwaysdefer+madvise01
```

```
alwaysdefer+madvise01
```

#### https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#configure-your-operating-system-to-run-it-on-bootConfigure your operating system to run it on boot
To ensure that this setting is applied each time the operating sytem starts, run the following command for your Linux distribution:
Ubuntu and Debian

```
sudo update-rc.d enable-transparent-hugepages defaults
```

```
sudo update-rc.d enable-transparent-hugepages defaults
```

SUSE

```
sudo insserv /etc/init.d/enable-transparent-hugepages
```

```
sudo insserv /etc/init.d/enable-transparent-hugepages
```

Red Hat, CentOS, Amazon Linux, and derivatives

```
sudo chkconfig --add enable-transparent-hugepages
```

```
sudo chkconfig --add enable-transparent-hugepages
```

#### https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#-optional--customize-tuned-or-ktune-profile-1(Optional) Customize tuned or ktune profile
If you are using tuned or ktune profiles on RHEL/ CentOS, you must also create a custom tuned profile.

```
tuned
```

```
ktune
```

```
tuned
```

```
tuned
```

```
ktune
```

## Important
If you use tuned or ktune, perform the steps in this section after creating the service file.

```
tuned
```

```
ktune
```

tuned and ktune are kernel tuning utilities that can affect the Transparent Hugepages setting on your system. If you are using tuned or ktune on your RHEL or CentOS system while running mongod, you must create a custom tuned profile to ensure that THP stays enabled.

```
tuned
```

```
ktune
```

```
tuned
```

```
ktune
```

```
mongod
```

```
tuned
```

#### https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#create-a-new-profileCreate a new profile
Create a new directory to store the custom tuned profile. The following example inherits from the existing virtual-guest profile, and uses virtual-guest-thp as the new profile:

```
tuned
```

```
virtual-guest
```

```
virtual-guest-thp
```

```
sudo mkdir /etc/tuned/virtual-guest-thp
```

```
sudo mkdir /etc/tuned/virtual-guest-thp
```

#### https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#edit-tuned.confEdit tuned.conf

```
tuned.conf
```

Create and edit /etc/tuned/virtual-guest-thp/tuned.conf. Add the following text:

```
/etc/tuned/virtual-guest-thp/tuned.conf
```

```
[main]include=virtual-guest[vm]transparent_hugepages=always
```

```
[main]include=virtual-guest[vm]transparent_hugepages=always
```

This example inherits from the existing virtual-guest profile. Select the appropriate profile for your system.

```
virtual-guest
```

#### https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#enable-the-new-profileEnable the new profile
Run:

```
sudo tuned-adm profile virtual-guest-thp
```

```
sudo tuned-adm profile virtual-guest-thp
```

## https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#enable-per-cpu-cachesEnable Per-CPU Caches
To verify that TCMalloc is running with per-CPU caches, ensure that:
- [tcmalloc.usingPerCPUCaches](https://www.mongodb.com/docs/manual/reference/command/serverStatus/#mongodb-serverstatus-serverstatus.tcmalloc.usingPerCPUCaches) is true.
- [tcmalloc.tcmalloc.cpu_free](https://www.mongodb.com/docs/manual/reference/command/serverStatus/#mongodb-serverstatus-serverstatus.tcmalloc.tcmalloc.cpu_free) is greater than 0.
[tcmalloc.usingPerCPUCaches](https://www.mongodb.com/docs/manual/reference/command/serverStatus/#mongodb-serverstatus-serverstatus.tcmalloc.usingPerCPUCaches) is true.

```
tcmalloc.usingPerCPUCaches
```

```
true
```

[tcmalloc.tcmalloc.cpu_free](https://www.mongodb.com/docs/manual/reference/command/serverStatus/#mongodb-serverstatus-serverstatus.tcmalloc.tcmalloc.cpu_free) is greater than 0.

```
tcmalloc.tcmalloc.cpu_free
```

```

```

If per-CPU caches aren't enabled, ensure that:
- You disable glibc rseq.
- You're using Linux kernel version 4.18 or later.
You disable glibc rseq.
You're using Linux kernel version 4.18 or later.

### https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#disable-glibc-rseqDisable glibc rseq
The new TCMalloc requires [Restartable Sequences (rseq)](https://github.com/google/tcmalloc/blob/master/docs/design.md#restartable-sequences-and-per-cpu-tcmalloc) to implement per-CPU caches. If another application, such as the glibc library, registers an rseq structure before TCMalloc, TCMalloc can't use rseq. Without rseq, TCMalloc uses per-thread caches, which are used by the legacy TCMalloc version.
To ensure that TCMalloc can use rseq to enable per-CPU caches, you can disable glibc’s registration of a rseq structure. To disable glibc rseq, set the following environment variable before you start mongod:

```
mongod
```

```
GLIBC_TUNABLES=glibc.pthread.rseq=0export GLIBC_TUNABLES
```

```
GLIBC_TUNABLES=glibc.pthread.rseq=0export GLIBC_TUNABLES
```

### https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#check-kernel-versionCheck Kernel Version
If you disabled glibc rseq and per-CPU caches are still not enabled, ensure that you're using Linux kernel version 4.18 or later. To check your kernel version, run the following command:

```
uname -r
```

```
uname -r
```

- [Upgraded TCMalloc](https://www.mongodb.com/docs/manual/release-notes/8.0/#std-label-8.0-tcmalloc-upgrade)
- [Google's TCMalloc Tuning Guide](https://google.github.io/tcmalloc/tuning.html)
- [tcmalloc serverStatus metrics](https://www.mongodb.com/docs/manual/reference/command/serverStatus/#std-label-server-status-tcmalloc)
- tcmalloc serverStatus metrics
Back
UNIX ulimit Settings
Next
Disable Transparent Huge Pages
On this page

- [Enable Per-CPU Caches](https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#enable-per-cpu-caches)
- [Learn More](https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#learn-more)
On this page
- [Platform Support](https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#platform-support)

- [Enable Transparent Hugepages (THP)](https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#enable-transparent-hugepages--thp-)
- [Enable Per-CPU Caches](https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#enable-per-cpu-caches)
- [Learn More](https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/#learn-more)


---

### THP 透明大页配置


# MongoDB 调优知识库 — 透明大页 (THP)

## 透明大页对 MongoDB 的影响

### 问题描述
在 Linux 系统中，Transparent Huge Pages (THP) 默认为 `always` 模式。此模式会导致 MongoDB 的 WiredTiger 存储引擎出现严重的内存延迟抖动。

### 根因
THP=always 会强制将所有内存分配合并为 2MB 大页。当操作系统后台的 khugepaged 守护进程进行内存碎片整理时，会造成：
- CPU 硬中断导致 System 耗时飙升（通常体现为 CPU sys% 突然从 5% 跳到 40%+）
- WiredTiger 的 cache 分配因内核锁竞争出现数百毫秒级的 stall
- 写入重型工作负载下尤其明显

### 官方建议
MongoDB 官方文档明确要求在部署前关闭 THP：

```bash
# 修改命令
echo never > /sys/kernel/mm/transparent_hugepage/enabled
echo never > /sys/kernel/mm/transparent_hugepage/defrag

# 验证命令
cat /sys/kernel/mm/transparent_hugepage/enabled
# 期望输出：always madvise [never]

# 持久化（写入 /etc/rc.local 或 systemd unit）
```

### 参考来源
- MongoDB Production Notes: https://www.mongodb.com/docs/manual/administration/production-notes/
- Linux Kernel Documentation: Transparent Hugepage Support


---

### 禁用 THP 官方指南



---

.. _disable-thp:

================================================================
Disable Transparent Hugepages (THP) for Self-Managed Deployments
================================================================

.. meta:: 
   :keywords: on-prem

.. default-domain:: mongodb

.. contents:: On this page
   :local:
   :backlinks: none
   :depth: 1
   :class: singlecol

.. important:: Upgraded TCMalloc in MongoDB 8.0

   Starting in MongoDB 8.0, MongoDB uses an upgraded version of TCMalloc 
   that improves performance with Transparent Hugepages enabled. If you are 
   using MongoDB 8.0 or later, see :ref:`enable-thp`. 

.. include:: /includes/fact-thp-intro.rst

When running MongoDB 7.0 or earlier on Linux, THP should be disabled 
for best performance. In earlier versions of MongoDB, database workloads often 
experience decreased performance with THP enabled because they often use 
non-contiguous, memory access patterns. 

.. note:: 

   .. include:: /includes/fact-thp-process-level.rst

To ensure that THP is disabled before :binary:`~bin.mongod` starts,
create a service file for your operating system that disables THP at boot. The 
following instructions include examples for both the **systemd** and the 
**System V init** initialization systems.

Additionally, for :abbr:`RHEL (Red Hat Enterprise Linux)` and CentOS
systems that use ``ktune`` and ``tuned`` performance profiles, you must create 
a custom ``tuned`` profile as well.

Create a Service File
---------------------

To create a service file that disables THP, use the built-in initialization 
system for your operating system. Recent versions of Linux typically use 
**systemd**, which uses the ``systemctl`` command. Older versions of 
Linux use **System V init**, which uses the ``service`` command. For more 
information, see the documentation for your operating system.

Use the initialization system for your operating system:

.. tabs::

   .. tab:: systemd (systemctl)
      :tabid: systemd-systemctl

      .. include:: /includes/steps-disable-thp-in-systemd.rst

   .. tab:: System V Init (service)
      :tabid: initd-service

      .. include:: /includes/steps-disable-thp-in-initd.rst


.. _disable-thp-configure-thp-tuned:

Using ``tuned`` and ``ktune``
-----------------------------

.. include:: /includes/fact-tuned-ktune-profiles.rst

``tuned`` and ``ktune`` are kernel tuning utilities that can affect the 
Transparent Hugepages setting on your system. If you use ``tuned`` or ``ktune`` 
on your :abbr:`RHEL (Red Hat Enterprise Linux)` or CentOS system while running 
``mongod``, you must create a custom ``tuned`` profile to ensure that THP 
stays disabled.

Red Hat/CentOS 6
~~~~~~~~~~~~~~~~

.. include:: /includes/steps/disable-thp-in-tuned-rhel-6.rst

Red Hat/CentOS 7 and 8
~~~~~~~~~~~~~~~~~~~~~~

.. include:: /includes/steps/disable-thp-in-tuned-rhel-7.rst


---

## 第三部分：IO 调度与系统参数

### IO 调度器


# Linux IO 调度器与 MongoDB 存储适配

## IO 调度器类型

Linux 提供多种 IO 调度器，不同调度器适用于不同的存储硬件和工作负载：

| 调度器 | 适用场景 | 特点 |
|--------|---------|------|
| none/noop | NVMe SSD | 零重排序，最低延迟 |
| mq-deadline | SATA SSD | 保证读写截止时间 |
| bfq | HDD / 桌面 | 公平带宽分配 |
| cfq | 传统 HDD | 完全公平队列（已被废弃） |

## MongoDB 推荐配置

### SSD 存储（含 NVMe）
```bash
# 查看当前调度器
cat /sys/block/sda/queue/scheduler

# 设置为 none（NVMe 通常已默认）
echo none > /sys/block/sda/queue/scheduler

# 持久化
echo 'ACTION=="add|change", KERNEL=="sd*", ATTR{queue/scheduler}="none"' > /etc/udev/rules.d/60-scheduler.rules
```

### HDD 存储
```bash
echo mq-deadline > /sys/block/sda/queue/scheduler
```

## 为什么 CFQ 对 MongoDB 有害

CFQ (Completely Fair Queuing) 调度器会对 IO 请求进行公平排队。但 MongoDB 的 WiredTiger 引擎产生的是高度随机的 4KB IO 模式，CFQ 的排队机制会引入 2-5ms 的额外延迟，在高并发场景下严重影响 P99 延迟。

## 读写预读 (readahead) 调优

MongoDB 建议将预读值降低到 32 个扇区：
```bash
blockdev --setra 32 /dev/sda
```

过大的预读值会导致不必要的数据预取，浪费 IO 带宽和内存。

## 参考来源
- MongoDB Storage FAQ: https://www.mongodb.com/docs/manual/faq/storage/
- Linux Block Layer: https://www.kernel.org/doc/Documentation/block/
- Red Hat Performance Guide: https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/8/html/monitoring_and_managing_system_status_and_performance


---

### Swap 与 OOM 配置

MongoDB Swap 与 OOM Killer 防护指南
======================================

1. 为什么数据库服务器必须控制 Swap
----------------------------------
MongoDB 的 WiredTiger 引擎依赖 mmap 进行内存映射 IO。当 OS 将数据库缓存页换出到 Swap 分区时，
后续访问会产生严重的磁盘随机读，导致查询延迟从微秒级跳到毫秒甚至秒级。

在生产环境中，Swap 活动是 MongoDB 性能抖动的头号杀手。

2. vm.swappiness 参数
---------------------
- 默认值: 60（表示内核倾向于积极使用 Swap）
- 推荐值: 1（仅在物理内存极度不足时才使用 Swap）
- 设置方法:
  sysctl -w vm.swappiness=1
  echo "vm.swappiness=1" >> /etc/sysctl.conf

注意: 设置为 0 在某些 Linux 版本中可能导致 OOM Killer 过早触发。

3. OOM Killer 防护
------------------
Linux OOM Killer 在内存不足时会杀死占用内存最多的进程。数据库进程通常是首选目标。

防护方法:
  # 降低 mongod 被 OOM Kill 的优先级
  echo -17 > /proc/$(pgrep mongod)/oom_adj

  # 或使用 oom_score_adj (新版内核)
  echo -1000 > /proc/$(pgrep mongod)/oom_score_adj

4. 内存规划建议
--------------
- WiredTiger Cache: 不超过物理内存的 60%
- 预留 OS Cache: 至少 20% 给文件系统缓存
- 预留其他进程: 至少 10%
- Swap 分区: 建议保留但设置 swappiness=1

参考来源:
- MongoDB Production Notes: https://www.mongodb.com/docs/manual/administration/production-notes/
- Linux vm.swappiness: https://www.kernel.org/doc/Documentation/sysctl/vm.txt

