---
source: https://www.mongodb.com/docs/manual/core/wiredtiger/
authority: mongodb_official
authority_level: ⭐⭐⭐ MongoDB 官方文档
title: "WiredTiger Storage Engine - Database Manual - MongoDB Docs"
last_verified: 2026-04-11
---

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
