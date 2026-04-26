---
source: https://www.mongodb.com/docs/manual/administration/production-checklist-operations/
authority: mongodb_official
authority_level: ⭐⭐⭐ MongoDB 官方文档
title: "Operations Checklist for Self-Managed Deployments - Database Manual - MongoDB Docs"
last_verified: 2026-04-11
---

# MongoDB Operations Checklist (官方)

> 来源: https://www.mongodb.com/docs/manual/administration/production-checklist-operations/

## Note
The replication oplog window doesn't need to cover the time needed to restore a replica set member via initial sync as the oplog records are pulled during the data copy. However, the member being restored must have enough disk space in the [local](https://www.mongodb.com/docs/manual/reference/local-database/#std-label-replica-set-local-database) database to temporarily store these oplog records for the duration of this data copy stage.
Ensure that your replica set includes at least three data-bearing voting members that run with journaling and that you issue writes with w: majority [write concern](https://www.mongodb.com/docs/manual/reference/write-concern/) for availability and durability.

```
w: majority
```

Use hostnames when configuring replica set members, rather than IP addresses.
Ensure full bidirectional network connectivity between all [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instances.

```
mongod
```

Ensure that each host can resolve itself.
Ensure that your replica set contains an odd number of voting members.
Ensure that [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instances have 0 or 1 votes.

```
mongod
```

```

```

```

```

For [high availability](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-high-availability), deploy your replica set into a minimum of three data centers.

## https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#shardingSharding
- Place your [config servers](https://www.mongodb.com/docs/manual/core/sharded-cluster-config-servers/#std-label-sharding-config-server) on dedicated hardware for
optimal performance in large clusters. Ensure that the hardware has
enough RAM to hold the data files entirely in memory and that it
has dedicated storage.
- Deploy [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) routers in accordance with the
[Production Configuration](https://www.mongodb.com/docs/manual/core/sharded-cluster-components/#std-label-sc-production-configuration) guidelines.
- Use NTP to synchronize the clocks on all components of your sharded
cluster.
- Ensure full bidirectional network connectivity between
[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod), [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos), and config servers.
Place your [config servers](https://www.mongodb.com/docs/manual/core/sharded-cluster-config-servers/#std-label-sharding-config-server) on dedicated hardware for optimal performance in large clusters. Ensure that the hardware has enough RAM to hold the data files entirely in memory and that it has dedicated storage.
Deploy [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) routers in accordance with the [Production Configuration](https://www.mongodb.com/docs/manual/core/sharded-cluster-components/#std-label-sc-production-configuration) guidelines.

```
mongos
```

Use NTP to synchronize the clocks on all components of your sharded cluster.
Ensure full bidirectional network connectivity between [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod), [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos), and config servers.

```
mongod
```

```
mongos
```

## https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#journaling--wiredtiger-storage-engineJournaling: WiredTiger Storage Engine
- Ensure that all instances use [journaling.](https://www.mongodb.com/docs/manual/core/journaling/#std-label-journaling-internals)
- Place the journal on its own low-latency disk for write-intensive
workloads. Note that this will affect snapshot-style backups as
the files constituting the state of the database will reside on
separate volumes.
Ensure that all instances use [journaling.](https://www.mongodb.com/docs/manual/core/journaling/#std-label-journaling-internals)
Place the journal on its own low-latency disk for write-intensive workloads. Note that this will affect snapshot-style backups as the files constituting the state of the database will reside on separate volumes.

## https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#hardwareHardware
- Use RAID10 and SSD drives for optimal performance.
- SAN and Virtualization:Ensure that each [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) has provisioned IOPS for its
[dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath), or has its own physical drive or LUN.Avoid dynamic memory features, such as memory ballooning, when
running in virtual environments.Avoid placing all replica set members on the same SAN, as the SAN
can be a single point of failure.
- Ensure that each [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) has provisioned IOPS for its
[dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath), or has its own physical drive or LUN.
- Avoid dynamic memory features, such as memory ballooning, when
running in virtual environments.
- Avoid placing all replica set members on the same SAN, as the SAN
can be a single point of failure.
Use RAID10 and SSD drives for optimal performance.
SAN and Virtualization:
- Ensure that each [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) has provisioned IOPS for its
[dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath), or has its own physical drive or LUN.
- Avoid dynamic memory features, such as memory ballooning, when
running in virtual environments.
- Avoid placing all replica set members on the same SAN, as the SAN
can be a single point of failure.
Ensure that each [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) has provisioned IOPS for its [dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath), or has its own physical drive or LUN.

```
mongod
```

```
dbPath
```

Avoid dynamic memory features, such as memory ballooning, when running in virtual environments.
Avoid placing all replica set members on the same SAN, as the SAN can be a single point of failure.

## https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#deployments-to-cloud-hardwareDeployments to Cloud Hardware
- Windows Azure: Adjust the TCP keepalive (tcp_keepalive_time) to
100-120. The TCP idle timeout on the Azure load balancer is too
slow for MongoDB's connection pooling behavior. See:
- Azure Production Notes
for more information.
- Use MongoDB version 2.6.4 or later on systems with high-latency
storage, such as Windows Azure, as these versions include
performance improvements for those systems.
Windows Azure: Adjust the TCP keepalive (tcp_keepalive_time) to 100-120. The TCP idle timeout on the Azure load balancer is too slow for MongoDB's connection pooling behavior. See: [Azure Production Notes](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-windows-azure-production-notes) for more information.

```
tcp_keepalive_time
```

Use MongoDB version 2.6.4 or later on systems with high-latency storage, such as Windows Azure, as these versions include performance improvements for those systems.

- If running MongoDB 8.0 or later, [turn on Transparent Hugepages.](https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/#std-label-enable-thp)
- If running MongoDB 7.0 or earlier, [turn off Transparent Hugepages.](https://www.mongodb.com/docs/manual/tutorial/disable-transparent-huge-pages/#std-label-disable-thp)
- [Adjust the readahead settings](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-readahead) on the devices
storing your database files.For the WiredTiger storage engine, set readahead between 8
and 32 regardless of storage media type (spinning disk, SSD,
etc.), unless testing shows a measurable, repeatable, and
advice and guidance on alternate readahead configurations.
- For the WiredTiger storage engine, set readahead between 8
and 32 regardless of storage media type (spinning disk, SSD,
etc.), unless testing shows a measurable, repeatable, and
advice and guidance on alternate readahead configurations.
- If using tuned on RHEL / CentOS, you must customize your
tuned profile. Many of the tuned profiles that ship with
RHEL / CentOS can negatively impact performance with their default
settings. Customize your chosen tuned profile to:Enable or disable Transparent Hugepages, depending on your MongoDB version.If you are using MongoDB 8.0 or later, see [using tuned and ktune
to enable THP.](https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/#std-label-enable-thp-configure-thp-tuned)If you are using MongoDB 7.0 or earlier, see [using tuned and ktune

to disable THP.](https://www.mongodb.com/docs/manual/tutorial/disable-transparent-huge-pages/#std-label-disable-thp-configure-thp-tuned)Set readahead between 8 and 32 regardless of storage media type.
See [Readahead settings](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-readahead) for more information.
- Enable or disable Transparent Hugepages, depending on your MongoDB version.If you are using MongoDB 8.0 or later, see [using tuned and ktune
to enable THP.](https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/#std-label-enable-thp-configure-thp-tuned)If you are using MongoDB 7.0 or earlier, see [using tuned and ktune
to disable THP.](https://www.mongodb.com/docs/manual/tutorial/disable-transparent-huge-pages/#std-label-disable-thp-configure-thp-tuned)
- If you are using MongoDB 8.0 or later, see [using tuned and ktune
to enable THP.](https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/#std-label-enable-thp-configure-thp-tuned)
- If you are using MongoDB 7.0 or earlier, see [using tuned and ktune
to disable THP.](https://www.mongodb.com/docs/manual/tutorial/disable-transparent-huge-pages/#std-label-disable-thp-configure-thp-tuned)
- Set readahead between 8 and 32 regardless of storage media type.
See [Readahead settings](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-readahead) for more information.
- Use the none disk schedulers for NVMe or SSD drives.
- Use the none disk scheduler for virtualized drives in guest VMs.
If there are no neighbors, or if the neighbors do not produce heavy I/O
patterns, there will be little HBA contention and the default none
scheduler suffices.Use kyber to run multiple workloads in the same VM or in your own
data center. kyber improves the I/O interpolation under contention, and
reduces the impact of noisy neighbors. Additionally, kyber works
efficiently in self hosted situations, such as on-premises virtualization and
collocated workloads in one large cloud VM. However, kyber is only
available on linux kernels starting in version 4.12.
- Disable NUMA or set vm.zone_reclaim_mode to 0 and run [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)
instances with node interleaving. See: [MongoDB and NUMA Hardware](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-production-numa)
for more information.
- Adjust the ulimit values on your hardware to suit your use case. If
multiple [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances are
running under the same user, scale the ulimit values
accordingly. See: [UNIX ulimit Settings for Self-Managed Deployments](https://www.mongodb.com/docs/manual/reference/ulimit/) for more information.
- Use noatime for the [dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath) mount point.
- Configure sufficient file handles (fs.file-max), kernel pid
limit (kernel.pid_max), maximum threads per process
(kernel.threads-max), and maximum number of memory map areas per
process (vm.max_map_count) for your deployment. For large systems,
the following values provide a good starting point:fs.file-max value of 98000,kernel.pid_max value of 64000,kernel.threads-max value of 64000, andvm.max_map_count value of 131060
- fs.file-max value of 98000,
- kernel.pid_max value of 64000,
- kernel.threads-max value of 64000, and
- vm.max_map_count value of 131060
- To manage swap space, perform one of the following:Ensure that your system has swap space configured. Refer to your
operating system's documentation for details on appropriate sizing.Do not assign swap space on your system, and configure the kernel
to disable swapping entirely.
- Ensure that your system has swap space configured. Refer to your
operating system's documentation for details on appropriate sizing.
- Do not assign swap space on your system, and configure the kernel
to disable swapping entirely.
- Ensure that the system default TCP keepalive is set correctly. A
value of 120 often provides better performance for replica sets and
sharded clusters. See: [Does TCP keepalive time affect MongoDB Deployments?](https://www.mongodb.com/docs/manual/faq/diagnostics/#std-label-faq-keepalive) in the Frequently Asked

Questions for more information.
If running MongoDB 8.0 or later, [turn on Transparent Hugepages.](https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/#std-label-enable-thp)
If running MongoDB 7.0 or earlier, [turn off Transparent Hugepages.](https://www.mongodb.com/docs/manual/tutorial/disable-transparent-huge-pages/#std-label-disable-thp)
[Adjust the readahead settings](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-readahead) on the devices storing your database files.
- For the WiredTiger storage engine, set readahead between 8
and 32 regardless of storage media type (spinning disk, SSD,
etc.), unless testing shows a measurable, repeatable, and
advice and guidance on alternate readahead configurations.
For the WiredTiger storage engine, set readahead between 8 and 32 regardless of storage media type (spinning disk, SSD, etc.), unless testing shows a measurable, repeatable, and reliable benefit in a higher readahead value.
If using tuned on RHEL / CentOS, you must customize your tuned profile. Many of the tuned profiles that ship with RHEL / CentOS can negatively impact performance with their default settings. Customize your chosen tuned profile to:

```
tuned
```

```
tuned
```

```
tuned
```

```
tuned
```

- Enable or disable Transparent Hugepages, depending on your MongoDB version.If you are using MongoDB 8.0 or later, see [using tuned and ktune
to enable THP.](https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/#std-label-enable-thp-configure-thp-tuned)If you are using MongoDB 7.0 or earlier, see [using tuned and ktune

to disable THP.](https://www.mongodb.com/docs/manual/tutorial/disable-transparent-huge-pages/#std-label-disable-thp-configure-thp-tuned)
- If you are using MongoDB 8.0 or later, see [using tuned and ktune
to enable THP.](https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/#std-label-enable-thp-configure-thp-tuned)
- If you are using MongoDB 7.0 or earlier, see [using tuned and ktune
to disable THP.](https://www.mongodb.com/docs/manual/tutorial/disable-transparent-huge-pages/#std-label-disable-thp-configure-thp-tuned)
- Set readahead between 8 and 32 regardless of storage media type.
See [Readahead settings](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-readahead) for more information.
Enable or disable Transparent Hugepages, depending on your MongoDB version.
- If you are using MongoDB 8.0 or later, see [using tuned and ktune
to enable THP.](https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/#std-label-enable-thp-configure-thp-tuned)
- If you are using MongoDB 7.0 or earlier, see [using tuned and ktune
to disable THP.](https://www.mongodb.com/docs/manual/tutorial/disable-transparent-huge-pages/#std-label-disable-thp-configure-thp-tuned)
If you are using MongoDB 8.0 or later, see [using tuned and ktune to enable THP.](https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/#std-label-enable-thp-configure-thp-tuned)
If you are using MongoDB 7.0 or earlier, see [using tuned and ktune to disable THP.](https://www.mongodb.com/docs/manual/tutorial/disable-transparent-huge-pages/#std-label-disable-thp-configure-thp-tuned)
Set readahead between 8 and 32 regardless of storage media type. See [Readahead settings](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-readahead) for more information.
Use the none disk schedulers for NVMe or SSD drives.

```
none
```

Use the none disk scheduler for virtualized drives in guest VMs. If there are no neighbors, or if the neighbors do not produce heavy I/O patterns, there will be little HBA contention and the default none scheduler suffices.

```
none
```

```
none
```

Use kyber to run multiple workloads in the same VM or in your own data center. kyber improves the I/O interpolation under contention, and reduces the impact of noisy neighbors. Additionally, kyber works efficiently in self hosted situations, such as on-premises virtualization and collocated workloads in one large cloud VM. However, kyber is only available on linux kernels starting in version 4.12.

```
kyber
```

```
kyber
```

```
kyber
```

```
kyber
```

Disable NUMA or set vm.zone_reclaim_mode to 0 and run [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instances with node interleaving. See: [MongoDB and NUMA Hardware](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-production-numa) for more information.

```
mongod
```

Adjust the ulimit values on your hardware to suit your use case. If multiple [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances are running under the same user, scale the ulimit values accordingly. See: [UNIX ulimit Settings for Self-Managed Deployments](https://www.mongodb.com/docs/manual/reference/ulimit/) for more information.

```
ulimit
```

```
mongod
```

```
mongos
```

```
ulimit
```

```
ulimit
```

Use noatime for the [dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath) mount point.

```
noatime
```

```
dbPath
```

Configure sufficient file handles (fs.file-max), kernel pid limit (kernel.pid_max), maximum threads per process (kernel.threads-max), and maximum number of memory map areas per process (vm.max_map_count) for your deployment. For large systems, the following values provide a good starting point:

```
fs.file-max
```

```
kernel.pid_max
```

```
kernel.threads-max
```

```
vm.max_map_count
```

- fs.file-max value of 98000,
- kernel.pid_max value of 64000,
- kernel.threads-max value of 64000, and
- vm.max_map_count value of 131060
fs.file-max value of 98000,

```
fs.file-max
```

kernel.pid_max value of 64000,

```
kernel.pid_max
```

kernel.threads-max value of 64000, and

```
kernel.threads-max
```

vm.max_map_count value of 131060

```
vm.max_map_count
```

### https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#linuxLinux
To manage swap space, perform one of the following:
- Ensure that your system has swap space configured. Refer to your
operating system's documentation for details on appropriate sizing.
- Do not assign swap space on your system, and configure the kernel
to disable swapping entirely.
Ensure that your system has swap space configured. Refer to your operating system's documentation for details on appropriate sizing.
Do not assign swap space on your system, and configure the kernel to disable swapping entirely.
Ensure that the system default TCP keepalive is set correctly. A value of 120 often provides better performance for replica sets and sharded clusters. See: [Does TCP keepalive time affect MongoDB Deployments?](https://www.mongodb.com/docs/manual/faq/diagnostics/#std-label-faq-keepalive) in the Frequently Asked Questions for more information.

```
keepalive
```

### https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#windowsWindows
- Consider disabling NTFS "last access time"  updates. This is
analogous to disabling atime on Unix-like systems.
- Format NTFS disks using the default
Consider disabling NTFS "last access time" updates. This is analogous to disabling atime on Unix-like systems.

```
atime
```

## https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#backupsBackups
- Schedule periodic tests of your back up and restore process to have
time estimates on hand, and to verify its functionality.
Schedule periodic tests of your back up and restore process to have time estimates on hand, and to verify its functionality.

## https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#monitoringMonitoring
monitor key database metrics and set up alerts for them. Include
alerts for the following metrics:replication lagreplication oplog windowassertionsqueuespage faults
- replication lag
- replication oplog window
- assertions
- queues
- page faults
- Monitor hardware statistics for your servers. In particular,
pay attention to the disk use, CPU, and available disk space.In the absence of disk space monitoring, or as a precaution:Create a dummy 4 GB file on the [storage.dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath) drive
to ensure available space if the disk becomes full.A combination of cron+df can alert when disk space hits a
high-water mark, if no other monitoring tool is available.
- Create a dummy 4 GB file on the [storage.dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath) drive
to ensure available space if the disk becomes full.
- A combination of cron+df can alert when disk space hits a
high-water mark, if no other monitoring tool is available.
- replication lag
- replication oplog window
- assertions
- queues
- page faults
replication lag
replication oplog window
assertions
queues
page faults
Monitor hardware statistics for your servers. In particular, pay attention to the disk use, CPU, and available disk space.
In the absence of disk space monitoring, or as a precaution:
- Create a dummy 4 GB file on the [storage.dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath) drive
to ensure available space if the disk becomes full.
- A combination of cron+df can alert when disk space hits a
high-water mark, if no other monitoring tool is available.
Create a dummy 4 GB file on the [storage.dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath) drive to ensure available space if the disk becomes full.

```
storage.dbPath
```

A combination of cron+df can alert when disk space hits a high-water mark, if no other monitoring tool is available.

```
cron+df
```

## https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#load-balancingLoad Balancing
- Configure load balancers to enable "sticky sessions" or "client
affinity", with a sufficient timeout for existing connections.
- Avoid placing load balancers between MongoDB cluster or replica set
components.
Configure load balancers to enable "sticky sessions" or "client affinity", with a sufficient timeout for existing connections.
Avoid placing load balancers between MongoDB cluster or replica set components.

For a list of security measures to protect your MongoDB installation, see the [MongoDB Security Checklist.](https://www.mongodb.com/docs/manual/administration/security-checklist/#std-label-security-checklist)
Back
OpenSSL Client
Next
Production Notes
On this page

- [Sharding](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#sharding)
- [Journaling: WiredTiger Storage Engine](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#journaling--wiredtiger-storage-engine)
- [Hardware](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#hardware)
- [Deployments to Cloud Hardware](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#deployments-to-cloud-hardware)
- [Operating System Configuration](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#operating-system-configuration)
- [Backups](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#backups)
- [Monitoring](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#monitoring)

- [Load Balancing](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#load-balancing)
- [Security](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#security)
- Filesystem
- Replication
- Sharding
- Journaling: WiredTiger Storage Engine
- Hardware
- Deployments to Cloud Hardware
- Operating System Configuration
- Backups
- Monitoring
- Load Balancing
- Security
On this page
- [Filesystem](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#filesystem)
- [Replication](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#replication)
- [Sharding](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#sharding)
- [Journaling: WiredTiger Storage Engine](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#journaling--wiredtiger-storage-engine)
- [Hardware](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#hardware)
- [Deployments to Cloud Hardware](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#deployments-to-cloud-hardware)
- [Operating System Configuration](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#operating-system-configuration)
- [Backups](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#backups)
- [Monitoring](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#monitoring)
- [Load Balancing](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#load-balancing)
- [Security](https://www.mongodb.com/docs/manual/administration/production-checklist-operations/#security)
- Filesystem
- Replication
- Sharding
- Journaling: WiredTiger Storage Engine
- Hardware
- Deployments to Cloud Hardware
- Operating System Configuration
- Backups
- Monitoring
- Load Balancing
- Security
