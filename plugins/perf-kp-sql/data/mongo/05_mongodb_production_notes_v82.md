---
source: https://www.mongodb.com/docs/manual/administration/production-notes/
authority: mongodb_official
authority_level: ⭐⭐⭐ MongoDB 官方文档 v8.2
title: "MongoDB v8.2 Production Notes（官方完整版）"
last_verified: 2026-04-11
topics: 生产部署, 平台支持, 硬件要求, 文件系统
---

# MongoDB v8.2 Production Notes（官方完整版）

> 来源: https://www.mongodb.com/docs/v8.2/administration/production-notes/


# MongoDB Production Notes (官方 v8.2)

> 来源: https://www.mongodb.com/docs/manual/administration/production-notes/

## Note
- Security: Atlas reduces configuration required for security
features like encryption, auditing, and role-based access control.
- Scalability: You can automatically scale your Atlas cluster
based on usage. You can also configure granular scaling for
compute, IOPS, and storage.
- Availability: Atlas has a 99.995% uptime SLA. You can also
configure multi-region and multi-cloud deployments with automated
failover and continuous backups.
- Performance: You can use built-in tools like Query Insights and
Performance Advisor to optimize performance, improve database
operations, and manage costs.
- Full Text Search: You can build performant, relevance-based
search functionality into your Atlas application.
Security: Atlas reduces configuration required for security features like encryption, auditing, and role-based access control.
Scalability: You can automatically scale your Atlas cluster based on usage. You can also configure granular scaling for compute, IOPS, and storage.
Availability: Atlas has a 99.995% uptime SLA. You can also configure multi-region and multi-cloud deployments with automated failover and continuous backups.
Performance: You can use built-in tools like Query Insights and Performance Advisor to optimize performance, improve database operations, and manage costs.
Full Text Search: You can build performant, relevance-based search functionality into your Atlas application.

## https://www.mongodb.com/docs/manual/administration/production-notes/#platform-supportPlatform Support
For running in production, refer to the [Recommended Platforms](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-prod-notes-recommended-platforms) for operating system recommendations.

### MongoDB 8.0 Incompatible with Kernel 6.19
Due to an incompatibility between a new kernel release and the currently vendored version of TCMalloc, running MongoDB 8.0 or newer with Linux kernel version 6.19 can cause MongoDB to crash on startup. This applies to all MongoDB packages, including those obtained from the MongoDB website, or obtained from package managers or Docker.
As soon as a patched version of TCMalloc is available, MongoDB will upgrade to use it, and this compatibility issue will be resolved.

### https://www.mongodb.com/docs/manual/administration/production-notes/#x86_64x86_64

```
x86_64
```

- For Intel x86_64, MongoDB requires one of:a Haswell or later Core processor, ora Tiger Lake or later Celeron or Pentium processor.
- a Haswell or later Core processor, or
- a Tiger Lake or later Celeron or Pentium processor.
- For AMD x86_64, MongoDB requires:a Bulldozer or later processor.
- a Bulldozer or later processor.
For Intel x86_64, MongoDB requires one of:

```
x86_64
```

- a Haswell or later Core processor, or
- a Tiger Lake or later Celeron or Pentium processor.
a Haswell or later Core processor, or
a Tiger Lake or later Celeron or Pentium processor.
For AMD x86_64, MongoDB requires:

```
x86_64
```

- a Bulldozer or later processor.
a Bulldozer or later processor.

```
mongod
```

```
mongos
```

```
mongo
```

```
x86_64
```

- MongoDB only supports Oracle Linux running the  Red Hat Compatible
Kernel (RHCK). MongoDB does not support the Unbreakable
Enterprise Kernel (UEK).
- MongoDB 5.0 requires use of the AVX instruction set, available on
MongoDB only supports Oracle Linux running the Red Hat Compatible Kernel (RHCK). MongoDB does not support the Unbreakable Enterprise Kernel (UEK).
MongoDB 5.0 requires use of the AVX instruction set, available on [select Intel and AMD processors.](https://en.wikipedia.org/wiki/Advanced_Vector_Extensions#CPUs_with_AVX)

MongoDB on arm64 requires the ARMv8.2-A or later microarchitecture.

```
arm64
```

Starting in MongoDB 5.0, [[mongo](https://www.mongodb.com/docs/manual/reference/mongo/#mongodb-binary-bin.mongo)d](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod), [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos), and the legacy mongo shell no longer support arm64 platforms which do not meet this minimum microarchitecture requirement.

```
mongod
```

```
mongos
```

```
mongo
```

```
arm64
```

To use the ARM v8.4-A or later microarchitecture, use MongoDB version 7.0 or later.

## Note
MongoDB no longer supports single board hardware lacking the proper CPU architecture (Raspberry Pi 4). See [Compatibility Changes in MongoDB 5.0](https://www.mongodb.com/docs/manual/release-notes/5.0-compatibility/#removed-raspberry-pi-support) for more information.

## https://www.mongodb.com/docs/manual/administration/production-notes/#platform-support-matrixPlatform Support Matrix
MongoDB 8.0 supports the following minimum OS minor versions:
- Red Hat Enterprise Linux 8.8
- Red Hat Enterprise Linux 9.3
- SUSE Linux Enterprise Server 15 SP5
- Amazon Linux 2023 version 2023.3
Red Hat Enterprise Linux 8.8
Red Hat Enterprise Linux 9.3
SUSE Linux Enterprise Server 15 SP5
Amazon Linux 2023 version 2023.3

v6.0 reached end of life on July 31, 2025 and is no longer supported by MongoDB.
Amazon Linux 2023
x86_64
Enterprise
Amazon Linux 2023
x86_64
Community
Amazon Linux V2
x86_64
Enterprise
Amazon Linux V2
x86_64
Community
Debian 12
x86_64
Enterprise
Debian 12
x86_64
Community
Debian 11
x86_64
Enterprise
Debian 11
x86_64
Community
RHEL/Rocky/Alma/Oracle Linux 9.0+ [[1]](https://www.mongodb.com/docs/manual/administration/production-notes/#footnote-oracle-support)
x86_64
Enterprise
RHEL/Rocky/Alma/Oracle Linux 9.0+ [[1]](https://www.mongodb.com/docs/manual/administration/production-notes/#footnote-oracle-support)
x86_64
Community
RHEL/Rocky/Alma/Oracle Linux 8.0+ [[1]](https://www.mongodb.com/docs/manual/administration/production-notes/#footnote-oracle-support)
x86_64
Enterprise
RHEL/Rocky/Alma/Oracle Linux 8.0+ [[1]](https://www.mongodb.com/docs/manual/administration/production-notes/#footnote-oracle-support)
x86_64
Community
RHEL/Oracle Linux 7.0+ [[1]](https://www.mongodb.com/docs/manual/administration/production-notes/#footnote-oracle-support)
x86_64
Enterprise
RHEL/Oracle Linux 7.0+ [[1]](https://www.mongodb.com/docs/manual/administration/production-notes/#footnote-oracle-support)
x86_64
Community
SLES 15
x86_64
Enterprise
SLES 15
x86_64
Community
SLES 12
x86_64
Enterprise
SLES 12
x86_64
Community
Ubuntu 24.04
x86_64
Enterprise
Ubuntu 24.04
x86_64
Community
Ubuntu 22.04
x86_64
Enterprise
Ubuntu 22.04
x86_64
Community
Ubuntu 20.04
x86_64
Enterprise
Ubuntu 20.04
x86_64
Community
Windows 11
x86_64
Enterprise
Windows 11
x86_64
Community
Windows Server 2022
x86_64
Enterprise
Windows Server 2022
x86_64
Community
Windows Server 2019
x86_64
Enterprise
Windows Server 2019
x86_64
Community
macOS 14
x86_64
Enterprise
macOS 14
x86_64
Community
macOS 13
x86_64
Enterprise
macOS 13
x86_64
Community
macOS 12
x86_64
Enterprise
macOS 12
x86_64
Community
macOS 11
x86_64
Enterprise
macOS 11
x86_64
Community
macOS 14
arm64
Enterprise
macOS 14
arm64
Community
macOS 13
arm64
Enterprise
macOS 13
arm64
Community
macOS 12
arm64
Enterprise
macOS 12
arm64
Community
macOS 11
arm64
Enterprise
macOS 11
arm64
Community
Amazon Linux 2023
arm64
Enterprise
Amazon Linux 2023
arm64
Community
Amazon Linux 2
arm64
Enterprise
Amazon Linux 2
arm64
Community
RHEL/Rocky/Alma 9
arm64
Enterprise
RHEL/Rocky/Alma 9
arm64
Community
RHEL/Rocky/Alma 8
arm64
Enterprise
RHEL/Rocky/Alma 8
arm64
Community
Ubuntu 24.04
arm64
Enterprise
Ubuntu 24.04
arm64
Community
Ubuntu 22.04
arm64
Enterprise
Ubuntu 22.04
arm64
Community
Ubuntu 20.04
arm64
Enterprise
Ubuntu 20.04
arm64
Community
RHEL/Rocky/Alma 9 [[6]](https://www.mongodb.com/docs/manual/administration/production-notes/#footnote-RHEL9-tcmalloc-support)
ppc64le
Enterprise
8.0.7+
RHEL/Rocky/Alma 8 [[5]](https://www.mongodb.com/docs/manual/administration/production-notes/#footnote-RHEL8-tcmalloc-support)
ppc64le
Enterprise
RHEL/Rocky/Alma 9
s390x
Enterprise
8.0.7+
7.0.20+
RHEL/Rocky/Alma 8 [[5]](https://www.mongodb.com/docs/manual/administration/production-notes/#footnote-RHEL8-tcmalloc-support)
s390x
Enterprise
- TCMalloc Performance Optimization for a Self-Managed Deployment.
- TCMalloc Performance Optimization for a Self-Managed Deployment.

While MongoDB supports a variety of platforms, the following operating systems are recommended for production use on x86_64 architecture:

```
x86_64
```

- Amazon Linux
- Debian
- SLES
- Ubuntu LTS
- Windows Server
Amazon Linux
Debian
SLES
Ubuntu LTS
Windows Server
For best results, run the latest version of your platform. If you run an older version, make sure that your version is supported by its provider.

- Platform Specific Considerations

Be sure you have the latest stable release.
For details on upgrading to the most current minor release, see [Upgrade to the Latest Self-Managed Patch Release of MongoDB.](https://www.mongodb.com/docs/manual/tutorial/upgrade-revision/#std-label-upgrade-to-latest-revision)
For other MongoDB products, see their [respective documentation](https://www.mongodb.com/docs/).

```
dbPath
```

The files in the [[dbPath](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath)](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath) directory must correspond to the configured [storage engine](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-storage-engine). mongod will not start if dbPath contains data files created by a storage engine other than the one specified by [--storageEngine.](https://www.mongodb.com/docs/manual/reference/program/mongod/#std-option-mongod.--storageEngine)

```
dbPath
```

```
mongod
```

```
dbPath
```

```
--storageEngine
```

- mongod must possess read and write permissions for the specified dbPath.

```
mongod
```

```
dbPath
```

If you use an antivirus (AV) scanner or an endpoint detection and response (EDR) scanner, configure your scanner to exclude the [database storage path](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.dbPath) and the [database log path](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-systemLog.path) from the scan.

```
database storage path
```

```
database log path
```

The data files in the database storage path are compressed. Additionally, if you use the [encrypted storage engine](https://www.mongodb.com/docs/manual/core/security-encryption-at-rest/#std-label-security-encryption-at-rest), the data files are also encrypted. The I/O and CPU costs to scan these files may significantly decrease performance without providing any security benefits.

```
database storage path
```

If you don't exclude the directories in your database storage path and database log path, the scanner could quarantine or delete important files. Missing or quarantined files can corrupt your database and crash your MongoDB instance.

```
database storage path
```

```
database log path
```

[WiredTiger](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger) supports concurrent access by readers and writers to the documents in a collection. Clients can read documents while write operations are in progress, and multiple threads can modify different documents in a collection at the same time.

[Allocate Sufficient RAM and CPU](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-prod-notes-ram) provides information about how WiredTiger takes advantage of multiple CPU cores and how to improve operation throughput.

### https://www.mongodb.com/docs/manual/administration/production-notes/#journalingJournaling
MongoDB uses write ahead logging to an on-disk [journal](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/glossary/#std-term-journal). [Journaling](https://www.mongodb.com/docs/manual/core/journaling/#std-label-journaling-internals) guarantees that MongoDB can quickly recover [write operations](https://www.mongodb.com/docs/manual/crud/#std-label-crud) that were written to the journal but not written to data files in cases where mongod terminated due to a crash or other serious failure. See Journaling for more information.

```
mongod
```

### https://www.mongodb.com/docs/manual/administration/production-notes/#read-concernRead Concern
You can use [causally consistent sessions](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/#std-label-sessions) to read your own writes, if the writes request acknowledgment.

### https://www.mongodb.com/docs/manual/administration/production-notes/#write-concernWrite Concern
[Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/#std-label-write-concern) describes the level of acknowledgment requested from MongoDB for write operations. The level of the write concerns affects how quickly the write operation returns. When write operations have a weak write concern, they return quickly. With stronger write concerns, clients must wait after sending a write operation until MongoDB confirms the write operation at the requested write concern level. With insufficient write concerns, write operations may appear to a client to have succeeded, but may not persist in some cases of server failure.
See the [Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/#std-label-write-concern) document for more information about choosing an appropriate write concern level for your deployment.

Always run MongoDB in a trusted environment, with network rules that prevent access from all unknown machines, systems, and networks. As with any sensitive system that is dependent on network access, your MongoDB deployment should only be accessible to specific systems that require access, such as application servers, monitoring services, and other MongoDB components.

By default, [[authorization](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-security.authorization)](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/core/authorization/#std-label-authorization) is not enabled, and mongod assumes a trusted environment. Enable authorization mode as needed. For more information on authentication mechanisms supported in MongoDB as well as authorization in MongoDB, see [Authentication on Self-Managed Deployments](https://www.mongodb.com/docs/manual/core/authentication/#std-label-authentication) and [Role-Based Access Control in Self-Managed Deployments.](https://www.mongodb.com/docs/manual/core/authorization/#std-label-authorization)

```
mongod
```

```
authorization
```

For additional information and considerations on security, refer to the documents in the [Security Section](https://www.mongodb.com/docs/manual/security/#std-label-security), specifically:
- [Security Checklist for Self-Managed Deployments](https://www.mongodb.com/docs/manual/administration/security-checklist/)
- [Network and Configuration Hardening for Self-Managed Deployments](https://www.mongodb.com/docs/manual/core/security-hardening/)
- Security Checklist for Self-Managed Deployments
- Network and Configuration Hardening for Self-Managed Deployments
For Windows users, consider the [Windows Server Technet Article on TCP Configuration](http://technet.microsoft.com/en-us/library/dd349797.aspx) when deploying MongoDB on Windows.

### https://www.mongodb.com/docs/manual/administration/production-notes/#disable-http-interfaceDisable HTTP Interface
The HTTP interface is disabled by default. Do not enable the HTTP interface in production environments.

### https://www.mongodb.com/docs/manual/administration/production-notes/#manage-connection-pool-sizesManage Connection Pool Sizes
Avoid overloading the connection resources of a [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instance by adjusting the connection pool size to suit your use case. Start at 110-115% of the typical number of current database requests, and modify the connection pool size as needed. Refer to the [Connection Pool Options](https://www.mongodb.com/docs/manual/reference/connection-string-options/#std-label-connection-pool-options) for adjusting the connection pool size.

```
mongod
```

```
mongos
```

The [connPoolStats](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/command/connPoolStats/#mongodb-dbcommand-dbcmd.connPoolStats) command returns information regarding the number of open connections to the current database for [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) and mongod instances in sharded clusters.

```
connPoolStats
```

```
mongos
```

```
mongod
```

See also [Allocate Sufficient RAM and CPU.](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-prod-notes-ram)

### https://www.mongodb.com/docs/manual/administration/production-notes/#adjust-tcp_keepalive_timeAdjust tcp_keepalive_time
If the TCP keepalive value is greater than the TCP idle timeout on your cloud provider's load balancer, there is a risk that the system might silently drop connections. To reduce this risk, set tcp_keepalive_time to 120.

```
tcp_keepalive_time
```

You need to restart [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) and [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) processes for new system-wide keepalive settings to take effect.

```
mongod
```

```
mongos
```

- To view the keepalive setting on Linux, use one of the following

tcp_keepalive_time value applies to both IPv4 and IPv6.
- To change the tcp_keepalive_time value, you can use one of the
following commands, supplying a <value> in seconds:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"sudo sysctl -w net.ipv4.tcp_keepalive_time=&lt;value&gt;","programmingLanguage":"Bash"}sudo sysctl -w net.ipv4.tcp_keepalive_time=<value>Or:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"echo &lt;value&gt; | sudo tee /proc/sys/net/ipv4/tcp_keepalive_time","programmingLanguage":"Bash"}echo <value> | sudo tee /proc/sys/net/ipv4/tcp_keepalive_timeThese operations do not persist across system reboots. To persist
the setting, add the following line to /etc/sysctl.conf,
supplying a <value> in seconds, and reboot the machine:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"net.ipv4.tcp_keepalive_time = &lt;value&gt;","programmingLanguage":"Bash"}net.ipv4.tcp_keepalive_time = <value>Keepalive values greater than 300 seconds,
(5 minutes) will be overridden on [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) and
[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) sockets and set to 300 seconds.
To view the keepalive setting on Linux, use one of the following commands:

```
```

```
```

Or:

```
cat /proc/sys/net/ipv4/tcp_keepalive_time
```

```
cat /proc/sys/net/ipv4/tcp_keepalive_time
```

The value is measured in seconds.

Although the setting name includes ipv4, the tcp_keepalive_time value applies to both IPv4 and IPv6.

```
ipv4
```

```
tcp_keepalive_time
```

To change the tcp_keepalive_time value, you can use one of the following commands, supplying a <value> in seconds:

```
tcp_keepalive_time
```

```
sudo sysctl -w net.ipv4.tcp_keepalive_time=<value>
```

```
sudo sysctl -w net.ipv4.tcp_keepalive_time=<value>
```

Or:

```
echo <value> | sudo tee /proc/sys/net/ipv4/tcp_keepalive_time
```

```
echo <value> | sudo tee /proc/sys/net/ipv4/tcp_keepalive_time
```

These operations do not persist across system reboots. To persist the setting, add the following line to /etc/sysctl.conf, supplying a <value> in seconds, and reboot the machine:

```
/etc/sysctl.conf
```

```
net.ipv4.tcp_keepalive_time = <value>
```

```
net.ipv4.tcp_keepalive_time = <value>
```

Keepalive values greater than 300 seconds, (5 minutes) will be overridden on [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) and [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) sockets and set to 300 seconds.

```
300
```

```
mongod
```

```
mongos
```

```
300
```

- To view the keepalive setting on Windows, issue the following command:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"reg query HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters /v KeepAliveTime"}reg query HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters /v KeepAliveTimeThe registry value is not present by default. The system default,
used if the value is absent, is 7200000 milliseconds or
0x6ddd00 in hexadecimal.
- To change the KeepAliveTime value, use the following command in
expressed in hexadecimal (e.g. 120000 is 0x1d4c0):{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"reg add HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\ /t REG_DWORD /v KeepAliveTime /d &lt;value&gt;"}reg add HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\ /t REG_DWORD /v KeepAliveTime /d <value>Windows users should consider the [Windows Server Technet Article on
KeepAliveTime](https://technet.microsoft.com/en-us/library/cc957549.aspx) for
more information on setting keepalive for MongoDB deployments on
Windows systems. Keepalive values greater than or equal to
600000 milliseconds (10 minutes) will be ignored by
- mongod and mongos.
To view the keepalive setting on Windows, issue the following command:

```
reg query HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters /v KeepAliveTime
```

```
reg query HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters /v KeepAliveTime
```

The registry value is not present by default. The system default, used if the value is absent, is 7200000 milliseconds or 0x6ddd00 in hexadecimal.

```
7200000
```

```
0x6ddd00
```

```
KeepAliveTime
```

```
<value>
```

```
120000
```

```
0x1d4c0
```

```
reg add HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\ /t REG_DWORD /v KeepAliveTime /d <value>
```

```
reg add HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\ /t REG_DWORD /v KeepAliveTime /d <value>
```

Windows users should consider the [Windows Server Technet Article on KeepAliveTime](https://technet.microsoft.com/en-us/library/cc957549.aspx) for more information on setting keepalive for MongoDB deployments on Windows systems. Keepalive values greater than or equal to 600000 milliseconds (10 minutes) will be ignored by [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) and [mongos.](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)

```
mongod
```

```
mongos
```

MongoDB is designed specifically with commodity hardware in mind and has few hardware requirements or limitations. MongoDB's core components run on little-endian hardware, primarily x86/x86_64 processors. Client libraries (i.e. drivers) can run on big or little endian systems.

At a minimum, ensure that each [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instance has access to two real cores or one multi-core physical CPU.

```
mongod
```

```
mongos
```

#### https://www.mongodb.com/docs/manual/administration/production-notes/#wiredtiger-1WiredTiger
The [WiredTiger](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger) storage engine is multithreaded and can take advantage of additional CPU cores. Specifically, the total number of active threads (i.e. concurrent operations) relative to the number of available CPUs can impact performance:
- Throughput increases as the number of concurrent active operations
increases up to the number of CPUs.
- Throughput decreases as the number of concurrent active operations
exceeds the number of CPUs by some threshold amount.
Throughput increases as the number of concurrent active operations increases up to the number of CPUs.
Throughput decreases as the number of concurrent active operations exceeds the number of CPUs by some threshold amount.
The threshold depends on your application. You can determine the optimum number of concurrent active operations for your application by experimenting and measuring throughput. The output from [mongostat](https://www.mongodb.com/docs/database-tools/mongostat/#mongodb-binary-bin.mongostat) provides statistics on the number of active reads/writes in the (ar|aw) column.

```
mongostat
```

```
ar|aw
```

With WiredTiger, MongoDB utilizes both the WiredTiger internal cache and the filesystem cache.

##### https://www.mongodb.com/docs/manual/administration/production-notes/#cache-configuration-settingsCache Configuration Settings
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

## Note
The [storage.wiredTiger.engineConfig.cacheSizeGB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizeGB) limits the size of the WiredTiger internal cache. The operating system uses the available free memory for filesystem cache, which allows the compressed MongoDB data files to stay in memory. In addition, the operating system uses any free RAM to buffer file system blocks and file system cache.

```
storage.wiredTiger.engineConfig.cacheSizeGB
```

To accommodate the additional consumers of RAM, you may have to decrease WiredTiger internal cache size.
The default WiredTiger internal cache size value assumes that there is a single [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance per machine. If a single machine contains multiple MongoDB instances, decrease the setting to accommodate the other mongod instances.

```
mongod
```

```
mongod
```

If you run [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) in a container (for example, lxc, cgroups, Docker, etc.) that does not have access to all of the RAM available in a system, you must set [storage.wiredTiger.engineConfig.cacheSizeGB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizeGB) or [storage.wiredTiger.engineConfig.cacheSizePct](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizePct) to a value less than the amount of RAM available in the container. The exact amount depends on the other processes running in the container. See [memLimitMB.](https://www.mongodb.com/docs/manual/reference/command/hostInfo/#mongodb-data-hostInfo.system.memLimitMB)

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
storage.wiredTiger.engineConfig.cacheSizeGB
```

```
storage.wiredTiger.engineConfig.cacheSizePct
```

```
memLimitMB
```

You can only provide one of either [storage.wiredTiger.engineConfig.cacheSizeGB](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizeGB) or [storage.wiredTiger.engineConfig.cacheSizePct.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.cacheSizePct)

```
storage.wiredTiger.engineConfig.cacheSizeGB
```

```
storage.wiredTiger.engineConfig.cacheSizePct
```

To view statistics on the cache and eviction rate, see the [wiredTiger.cache](https://www.mongodb.com/docs/manual/reference/command/[serverStatus](https://www.mongodb.com/docs/manual/reference/command/serverStatus/#mongodb-dbcommand-dbcmd.serverStatus)/#mongodb-serverstatus-serverstatus.wiredTiger.cache) field returned from the serverStatus command.

```
wiredTiger.cache
```

```
serverStatus
```

#### https://www.mongodb.com/docs/manual/administration/production-notes/#compression-and-encryptionCompression and Encryption
When using encryption, CPUs equipped with AES-NI instruction-set extensions show significant performance advantages. If you are using MongoDB Enterprise with the [Encrypted Storage Engine](https://www.mongodb.com/docs/manual/core/security-encryption-at-rest/#std-label-encrypted-storage-engine), choose a CPU that supports AES-NI for better performance.

## Tip
- Concurrency

### https://www.mongodb.com/docs/manual/administration/production-notes/#use-solid-state-disks--ssds-Use Solid State Disks (SSDs)
MongoDB has good results and a good price-performance ratio with SATA SSD (Solid State Disk).
Use SSD if available and economical.
Commodity (SATA) spinning drives are often a good option, as the random I/O performance increase with more expensive spinning drives is not that dramatic (only on the order of 2x). Using SSDs or increasing RAM may be more effective in increasing I/O throughput.

### https://www.mongodb.com/docs/manual/administration/production-notes/#mongodb-and-numa-hardwareMongoDB and NUMA Hardware
Running MongoDB on a system with Non-Uniform Memory Access (NUMA) can cause a number of operational problems, including slow performance for periods of time and high system process usage.
When running MongoDB servers and clients on NUMA hardware, you should configure a memory interleave policy so that the host behaves in a non-NUMA fashion. MongoDB checks NUMA settings on start up when deployed on Linux (since version 2.0) and Windows (since version 2.6) machines. If the NUMA configuration may degrade performance, MongoDB prints a warning.
The numad daemon process can also reduce [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) performance. You should ensure numad is not enabled on MongoDB servers.

```
numad
```

```
mongod
```

```
numad
```

- [The MySQL "swap insanity" problem and the effects of NUMA](http://jcole.us/blog/archives/2010/09/28/mysql-swap-insanity-and-the-numa-architecture/)
post, which describes the effects of
NUMA on databases. The post introduces NUMA and its goals, and
illustrates how these goals are not compatible with production
databases. Although the blog post addresses the impact of NUMA for
MySQL, the issues for MongoDB are similar.
- [NUMA: An Overview](https://queue.acm.org/detail.cfm?id=2513149).
[The MySQL "swap insanity" problem and the effects of NUMA](http://jcole.us/blog/archives/2010/09/28/mysql-swap-insanity-and-the-numa-architecture/) post, which describes the effects of NUMA on databases. The post introduces NUMA and its goals, and illustrates how these goals are not compatible with production databases. Although the blog post addresses the impact of NUMA for MySQL, the issues for MongoDB are similar.
[NUMA: An Overview](https://queue.acm.org/detail.cfm?id=2513149).

#### https://www.mongodb.com/docs/manual/administration/production-notes/#configuring-numa-on-windowsConfiguring NUMA on Windows
On Windows, memory interleaving must be enabled through the machine's BIOS. Consult your system documentation for details.

#### https://www.mongodb.com/docs/manual/administration/production-notes/#configuring-numa-on-linuxConfiguring NUMA on Linux
On Linux, you must disable zone reclaim and also ensure that your [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) and [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances are started by numactl, which is generally configured through your platform's init system. You must perform both of these operations to properly disable NUMA for use with MongoDB.

```
mongod
```

```
mongos
```

```
numactl
```

1. Disable zone reclaim with one of the following commands:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"echo 0 | sudo tee /proc/sys/vm/zone_reclaim_mode","programmingLanguage":"Bash"}echo 0 | sudo tee /proc/sys/vm/zone_reclaim_mode{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"sudo sysctl -w vm.zone_reclaim_mode=0","programmingLanguage":"Bash"}sudo sysctl -w vm.zone_reclaim_mode=0
2. Ensure that [[[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) and [[[[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) are
started by numactl. This is generally configured through your
platform's init system. Run the following command to determine which
init system is in use on your platform:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"ps --no-headers -o comm 1","programmingLanguage":"Bash"}ps --no-headers -o comm 1If "systemd", your platform uses the systemd init
system, and you must follow the steps in the systemd tab
below to edit your MongoDB service file(s).If "init", your platform uses the SysV Init system, and you
do not need to perform this step. The default MongoDB init script
for SysV Init includes the necessary steps to start MongoDB
instances via numactl by default.If you manage your own init scripts (i.e. you are not using either
of these init systems), you must follow the steps in the
Custom init scripts tab below to edit your custom init

0deg,
#E8EDEB 1px,
rgb(255 255 255 / 0%) 1px
mongod instances, including all
[[config servers](https://www.mongodb.com/docs/manual/core/sharded-cluster-config-servers/#std-label-sharding-config-server)](https://www.mongodb.com/docs/manual/core/sharded-cluster-config-servers/#std-label-sharding-config-server),
mongos instances, and clients. Edit the default

systemd service file for each as follows:Copy the default MongoDB service file:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"sudo cp /lib/systemd/system/mongod.service /etc/systemd/system/","programmingLanguage":"Bash"}sudo cp /lib/systemd/system/mongod.service /etc/systemd/system/Edit the /etc/systemd/system/mongod.service file, and

mongos instances.You must use numactl to start each of your
mongod instances, including all
config servers,
mongos instances, and clients.Install numactl for your platform if not already
installed. Refer to the documentation for your operating
system for information on installing the numactl
package.Configure each of your custom init scripts to start each
MongoDB instance via numactl:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"numactl --interleave=all &lt;path&gt; &lt;options&gt;","programmingLanguage":"Bash"}numactl --interleave=all <path> <options>Where <path> is the path to the program you are starting
and <options> are any optional arguments to pass to that
program.Example{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"numactl --interleave=all /usr/local/bin/mongod -f /etc/mongod.conf","programmingLanguage":"Bash"}numactl --interleave=all /usr/local/bin/mongod -f /etc/mongod.conf
3. If "systemd", your platform uses the systemd init
system, and you must follow the steps in the systemd tab
below to edit your MongoDB service file(s).
4. If "init", your platform uses the SysV Init system, and you
do not need to perform this step. The default MongoDB init script
for SysV Init includes the necessary steps to start MongoDB
instances via numactl by default.
5. If you manage your own init scripts (i.e. you are not using either
of these init systems), you must follow the steps in the
Custom init scripts tab below to edit your custom init
script(s).
6. Copy the default MongoDB service file:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"sudo cp /lib/systemd/system/mongod.service /etc/systemd/system/","programmingLanguage":"Bash"}sudo cp /lib/systemd/system/mongod.service /etc/systemd/system/
7. Edit the /etc/systemd/system/mongod.service file, and

8. Apply the change to systemd:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"sudo systemctl daemon-reload","programmingLanguage":"Bash"}sudo systemctl daemon-reload

10. If applicable, repeat these steps for any
[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances.
11. Install numactl for your platform if not already
installed. Refer to the documentation for your operating
system for information on installing the numactl
package.
12. Configure each of your custom init scripts to start each
MongoDB instance via numactl:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"numactl --interleave=all &lt;path&gt; &lt;options&gt;","programmingLanguage":"Bash"}numactl --interleave=all <path> <options>Where <path> is the path to the program you are starting
and <options> are any optional arguments to pass to that
program.Example{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"numactl --interleave=all /usr/local/bin/mongod -f /etc/mongod.conf","programmingLanguage":"Bash"}numactl --interleave=all /usr/local/bin/mongod -f /etc/mongod.conf
Disable zone reclaim with one of the following commands:

```
echo 0 | sudo tee /proc/sys/vm/zone_reclaim_mode
```

```
echo 0 | sudo tee /proc/sys/vm/zone_reclaim_mode
```

```
sudo sysctl -w vm.zone_reclaim_mode=0
```

```
sudo sysctl -w vm.zone_reclaim_mode=0
```

Ensure that [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) and [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) are started by numactl. This is generally configured through your platform's init system. Run the following command to determine which init system is in use on your platform:

```
mongod
```

```
mongos
```

```
numactl
```

```
ps --no-headers -o comm 1
```

```
ps --no-headers -o comm 1
```

- If "systemd", your platform uses the systemd init
system, and you must follow the steps in the systemd tab
below to edit your MongoDB service file(s).
- If "init", your platform uses the SysV Init system, and you
do not need to perform this step. The default MongoDB init script
for SysV Init includes the necessary steps to start MongoDB
instances via numactl by default.
- If you manage your own init scripts (i.e. you are not using either
of these init systems), you must follow the steps in the
Custom init scripts tab below to edit your custom init
script(s).
If "systemd", your platform uses the systemd init system, and you must follow the steps in the systemd tab below to edit your MongoDB service file(s).

```
systemd
```

If "init", your platform uses the SysV Init system, and you do not need to perform this step. The default MongoDB init script for SysV Init includes the necessary steps to start MongoDB instances via numactl by default.

```
init
```

```
numactl
```

If you manage your own init scripts (i.e. you are not using either of these init systems), you must follow the steps in the Custom init scripts tab below to edit your custom init script(s).
You must use numactl to start each of your [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instances, including all [config servers](https://www.mongodb.com/docs/manual/core/sharded-cluster-config-servers/#std-label-sharding-config-server), [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances, and clients. Edit the default systemd service file for each as follows:

```
numactl
```

```
mongod
```

```
mongos
```

1. Copy the default MongoDB service file:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"sudo cp /lib/systemd/system/mongod.service /etc/systemd/system/","programmingLanguage":"Bash"}sudo cp /lib/systemd/system/mongod.service /etc/systemd/system/
2. Edit the /etc/systemd/system/mongod.service file, and
3. Apply the change to systemd:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"sudo systemctl daemon-reload","programmingLanguage":"Bash"}sudo systemctl daemon-reload

## Tip
5. If applicable, repeat these steps for any
[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances.
Copy the default MongoDB service file:

```
sudo cp /lib/systemd/system/mongod.service /etc/systemd/system/
```

```
sudo cp /lib/systemd/system/mongod.service /etc/systemd/system/
```

Edit the /etc/systemd/system/mongod.service file, and update the ExecStart statement to begin with:

```
/etc/systemd/system/mongod.service
```

```
ExecStart
```

```
/usr/bin/numactl --interleave=all
```

```
/usr/bin/numactl --interleave=all
```

## Example
If your existing ExecStart statement reads:

```
ExecStart
```

```
ExecStart=/usr/bin/mongod --config /etc/mongod.conf
```

```
ExecStart=/usr/bin/mongod --config /etc/mongod.conf
```

Update that statement to read:

```
ExecStart=/usr/bin/numactl --interleave=all /usr/bin/mongod --config /etc/mongod.conf
```

```
ExecStart=/usr/bin/numactl --interleave=all /usr/bin/mongod --config /etc/mongod.conf
```

Apply the change to systemd:

```
systemd
```

```
sudo systemctl daemon-reload
```

```
sudo systemctl daemon-reload
```

Restart any running mongod instances:

```
mongod
```

```
sudo systemctl stop mongodsudo systemctl start mongod
```

```
sudo systemctl stop mongodsudo systemctl start mongod
```

If applicable, repeat these steps for any [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances.

```
mongos
```

You must use numactl to start each of your [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instances, including all [config servers](https://www.mongodb.com/docs/manual/core/sharded-cluster-config-servers/#std-label-sharding-config-server), [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances, and clients.

```
numactl
```

```
mongod
```

```
mongos
```

1. Install numactl for your platform if not already
installed. Refer to the documentation for your operating
system for information on installing the numactl
package.
2. Configure each of your custom init scripts to start each
MongoDB instance via numactl:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"numactl --interleave=all &lt;path&gt; &lt;options&gt;","programmingLanguage":"Bash"}numactl --interleave=all <path> <options>Where <path> is the path to the program you are starting
and <options> are any optional arguments to pass to that
program.Example{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"numactl --interleave=all /usr/local/bin/mongod -f /etc/mongod.conf","programmingLanguage":"Bash"}numactl --interleave=all /usr/local/bin/mongod -f /etc/mongod.conf
Install numactl for your platform if not already installed. Refer to the documentation for your operating system for information on installing the numactl package.

```
numactl
```

```
numactl
```

Configure each of your custom init scripts to start each MongoDB instance via numactl:

```
numactl
```

```
numactl --interleave=all <path> <options>
```

```
numactl --interleave=all <path> <options>
```

Where <path> is the path to the program you are starting and <options> are any optional arguments to pass to that program.

```
<path>
```

```
<options>
```

```
numactl --interleave=all /usr/local/bin/mongod -f /etc/mongod.conf
```

```
numactl --interleave=all /usr/local/bin/mongod -f /etc/mongod.conf
```

For more information, see the [Documentation for /proc/sys/vm/*](http://www.kernel.org/doc/Documentation/sysctl/vm.txt).

#### https://www.mongodb.com/docs/manual/administration/production-notes/#swapSwap
MongoDB performs best where swapping can be avoided or kept to a minimum, as retrieving data from swap will always be slower than accessing data in RAM. However, if the system hosting MongoDB runs out of RAM, swapping can prevent the Linux OOM Killer from terminating the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) process.

```
mongod
```

Generally, you should choose one of the following swap strategies:
1. Assign swap space on your system, and configure the kernel to only
permit swapping under high memory load, or
2. Do not assign swap space on your system, and configure the kernel to
disable swapping entirely
Assign swap space on your system, and configure the kernel to only permit swapping under high memory load, or
Do not assign swap space on your system, and configure the kernel to disable swapping entirely
See [Set vm.swappiness](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-set-swappiness) for instructions on configuring swap on your Linux system following these guidelines.

## Note
If your MongoDB instance is hosted on a system that also runs other software, such as a webserver, you should choose the first swap strategy. Do not disable swap in this case. If possible, it is highly recommended that you run MongoDB on its own dedicated system.

#### https://www.mongodb.com/docs/manual/administration/production-notes/#raidRAID
For optimal performance in terms of the storage layer, use disks backed by RAID-10. RAID-5 and RAID-6 do not typically provide sufficient performance to support a MongoDB deployment.

#### https://www.mongodb.com/docs/manual/administration/production-notes/#remote-filesystems--nfs-Remote Filesystems (NFS)
With the WiredTiger storage engine, WiredTiger objects may be stored on remote file systems if the remote file system conforms to ISO/IEC 9945-1:1996 (POSIX.1). Because remote file systems are often slower than local file systems, using a remote file system for storage may degrade performance.
If you decide to use NFS, add the following NFS options to your /etc/fstab file:

```
/etc/fstab
```

- bg
- hard
- nolock
- noatime
- nointr

```

```

hard

```
hard
```

nolock

```
nolock
```

noatime

```
noatime
```

nointr

```
nointr
```

Depending on your kernel version, some of these values may already be set as the default. Consult your platform's documentation for more information.

#### https://www.mongodb.com/docs/manual/administration/production-notes/#separate-components-onto-different-storage-devicesSeparate Components onto Different Storage Devices
For improved performance, consider separating your database's data, journal, and logs onto different storage devices, based on your application's access and write pattern. Mount the components as separate filesystems and use symbolic links to map each component's path to the device storing it.
For the WiredTiger storage engine, you can also store the indexes on a different storage device. See [storage.wiredTiger.engineConfig.directoryForIndexes.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.engineConfig.directoryForIndexes)

```
storage.wiredTiger.engineConfig.directoryForIndexes
```

## Note
Using different storage devices will affect your ability to create snapshot-style backups of your data, since the files will be on different devices and volumes.

#### https://www.mongodb.com/docs/manual/administration/production-notes/#schedulingScheduling

##### https://www.mongodb.com/docs/manual/administration/production-notes/#scheduling-for-virtual-or-cloud-hosted-devicesScheduling for Virtual or Cloud Hosted Devices
For local block devices attached to a virtual machine instance via the hypervisor or hosted by a cloud hosting provider, the guest operating system should use the [none scheduler](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-none-scheduler) for best performance. The none scheduler allows the operating system to defer I/O scheduling to the underlying hypervisor.

```
none
```

If you are running multiple workloads in the same VM or in your own data center, use the [kyber scheduler.](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-kyber-scheduler)

## Note
The [kyber scheduler](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-kyber-scheduler) is only available on Linux kernels starting in version 4.12.

##### https://www.mongodb.com/docs/manual/administration/production-notes/#scheduling-for-physical-serversScheduling for Physical Servers
For physical servers using NVMe or SSD drives, the operating system should use the [none scheduler.](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-none-scheduler)
For physical servers using spinning disks, the operating system should use the mq-deadline scheduler. The mq-deadline scheduler caps maximum latency per request and maintains a good disk throughput that is best for disk-intensive database applications.

### https://www.mongodb.com/docs/manual/administration/production-notes/#replica-setsReplica Sets
See the [Replica Set Architectures](https://www.mongodb.com/docs/manual/core/replica-set-architectures/#std-label-replica-set-architecture) document for an overview of architectural considerations for replica set deployments.

### https://www.mongodb.com/docs/manual/administration/production-notes/#sharded-clustersSharded Clusters
See [Sharded Cluster Production Architecture](https://www.mongodb.com/docs/manual/core/sharded-cluster-components/#std-label-sharding-shards) for an overview of recommended sharded cluster architectures for production deployments.

## Tip
- Development Checklist

## https://www.mongodb.com/docs/manual/administration/production-notes/#compressionCompression
WiredTiger can compress collection data using one of the following compression library:
zstd but has a lower CPU cost than either.
- [zlib](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-zlib)Provides better compression rate than snappy but has a
higher CPU cost than both snappy and zstd.
- [zstd](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-zstd)Provides better compression rate than both snappy and
zlib and has a lower CPU cost than zlib.
- snappy

```
zlib
```

```
zstd
```

```
snappy
```

```
snappy
```

```
zstd
```

```
snappy
```

```
zlib
```

```
zlib
```

By default, WiredTiger uses [snappy](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-snappy) compression library. To change the compression setting, see [storage.wiredTiger.collectionConfig.blockCompressor.](https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-storage.wiredTiger.collectionConfig.blockCompressor)

```
storage.wiredTiger.collectionConfig.blockCompressor
```

WiredTiger uses [prefix compression](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-prefix-compression) on all indexes by default.

MongoDB [components](https://www.mongodb.com/docs/manual/reference/program/#std-label-mongodb-package-components) keep logical clocks for supporting time-dependent operations. Using [NTP](http://www.ntp.org/) to synchronize host machine clocks mitigates the risk of clock drift between components. Clock drift between components increases the likelihood of incorrect or abnormal behavior of time-dependent operations like the following:
- If the underlying system clock of any given MongoDB
component drifts a year or more from other components in the same
deployment, communication between those members may become unreliable
or halt altogether.The [maxAcceptableLogicalClockDriftSecs](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.maxAcceptableLogicalClockDriftSecs) parameter controls
the amount of acceptable clock drift between components. Clusters with
a lower value of maxAcceptableLogicalClockDriftSecs have a
correspondingly lower tolerance for clock drift.
- Two cluster members with different system clocks may return
different values for operations that return the current
cluster or system time, such as [Date()](https://www.mongodb.com/docs/manual/reference/method/Date/#mongodb-method-Date),
- NOW, and CLUSTER_TIME.
- Features which rely on timekeeping may have inconsistent or
unpredictable behavior in clusters with clock drift between MongoDB
components.
If the underlying system clock of any given MongoDB component drifts a year or more from other components in the same deployment, communication between those members may become unreliable or halt altogether.
The [maxAcceptableLogicalClockDriftSecs](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.maxAcceptableLogicalClockDriftSecs) parameter controls the amount of acceptable clock drift between components. Clusters with a lower value of maxAcceptableLogicalClockDriftSecs have a correspondingly lower tolerance for clock drift.

```
maxAcceptableLogicalClockDriftSecs
```

```
maxAcceptableLogicalClockDriftSecs
```

Two cluster members with different system clocks may return different values for operations that return the current cluster or system time, such as [Date()](https://www.mongodb.com/docs/manual/reference/method/Date/#mongodb-method-Date), [NOW](https://www.mongodb.com/docs/manual/reference/aggregation-variables/#mongodb-variable-variable.NOW), and [CLUSTER_TIME.](https://www.mongodb.com/docs/manual/reference/aggregation-variables/#mongodb-variable-variable.CLUSTER_TIME)

```
Date()
```

```
NOW
```

```
CLUSTER_TIME
```

Features which rely on timekeeping may have inconsistent or unpredictable behavior in clusters with clock drift between MongoDB components.

#### https://www.mongodb.com/docs/manual/administration/production-notes/#kernel-and-file-systemsKernel and File Systems
When running MongoDB in production on Linux, you should use Linux kernel version 2.6.36 or later, with either the XFS or EXT4 filesystem. If possible, use XFS as it generally performs better with MongoDB.
With the [WiredTiger storage engine](https://www.mongodb.com/docs/manual/core/wiredtiger/#std-label-storage-wiredtiger), using XFS is strongly recommended for data bearing nodes to avoid performance issues that may occur when using EXT4 with WiredTiger.
- In general, if you use the XFS file system, use at least version
2.6.25 of the Linux Kernel.
- If you use the EXT4 file system, use at least version
2.6.28 of the Linux Kernel.
- On Red Hat Enterprise Linux and CentOS, use at least version
2.6.18-194 of the Linux kernel.
In general, if you use the XFS file system, use at least version 2.6.25 of the Linux Kernel.

```
2.6.25
```

If you use the EXT4 file system, use at least version 2.6.28 of the Linux Kernel.

```
2.6.28
```

On Red Hat Enterprise Linux and CentOS, use at least version 2.6.18-194 of the Linux kernel.

```
2.6.18-194
```

#### https://www.mongodb.com/docs/manual/administration/production-notes/#system-c-librarySystem C Library
MongoDB uses the [GNU C Library](http://www.gnu.org/software/libc/) (glibc) on Linux. Generally, each Linux distro provides its own vetted version of this library. For best results, use the latest update available for this system-provided version. You can check whether you have the latest version installed by using your system's package manager. For example:
- On RHEL / CentOS, the following
command updates the system-provided GNU C Library:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"sudo yum update glibc","programmingLanguage":"Bash"}sudo yum update glibc
- On Ubuntu / Debian, the following command updates the system-provided
GNU C Library:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"sudo apt-get install libc6","programmingLanguage":"Bash"}sudo apt-get install libc6
On RHEL / CentOS, the following command updates the system-provided GNU C Library:

```
sudo yum update glibc
```

```
sudo yum update glibc
```

On Ubuntu / Debian, the following command updates the system-provided GNU C Library:

```
sudo apt-get install libc6
```

```
sudo apt-get install libc6
```

#### https://www.mongodb.com/docs/manual/administration/production-notes/#fsync---on-directoriesfsync() on Directories

```
fsync()
```

## Important
MongoDB requires a filesystem that supports fsync() on directories. For example, HGFS and Virtual Box's shared folders do not support this operation.

```
fsync()
```

#### https://www.mongodb.com/docs/manual/administration/production-notes/#set-vm.swappiness-to-1-or-0Set vm.swappiness to 1 or 0

```
vm.swappiness
```

```

```

```

```

"Swappiness" is a Linux kernel setting that influences the behavior of the Virtual Memory manager. The vm.swappiness setting ranges from 0 to 100: the higher the value, the more strongly it prefers swapping memory pages to disk over dropping pages from RAM.

```
vm.swappiness
```

```

```

```
100
```

- A setting of 0 disables swapping entirely
[[8]](https://www.mongodb.com/docs/manual/administration/production-notes/#footnote-swappiness-kernel-version).
- A setting of 1 permits the kernel to swap only to avoid
out-of-memory problems.
- A setting of 60 tells the kernel to swap to disk often, and is the
default value on many Linux distributions.
- A setting of 100 tells the kernel to swap aggressively to disk.
A setting of 0 disables swapping entirely [[8]](https://www.mongodb.com/docs/manual/administration/production-notes/#footnote-swappiness-kernel-version).

```

```

A setting of 1 permits the kernel to swap only to avoid out-of-memory problems.

```

```

A setting of 60 tells the kernel to swap to disk often, and is the default value on many Linux distributions.

```

```

A setting of 100 tells the kernel to swap aggressively to disk.

```
100
```

MongoDB performs best where swapping can be avoided or kept to a minimum. As such you should set vm.swappiness to either 1 or 0 depending on your application needs and cluster configuration.

```
vm.swappiness
```

```

```

```

```

## Note
Most system and user processes run within a cgroup, which, by default, sets the vm.swappiness to 60. If you are running RHEL / CentOS, set vm.force_cgroup_v2_swappiness to 1 to ensure that the specified vm.swappiness value overrides any cgroup defaults.

```
vm.swappiness
```

```

```

```
vm.force_cgroup_v2_swappiness
```

```

```

```
vm.swappiness
```

```
3.5
```

```
2.6.32-303
```

```
vm.swappiness
```

```

```

If your MongoDB instance is hosted on a system that also runs other software, such as a webserver, you should set vm.swappiness to 1. If possible, it is highly recommended that you run MongoDB on its own dedicated system.

```
vm.swappiness
```

```

```

- To check the current swappiness setting on your system, run:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"cat /proc/sys/vm/swappiness","programmingLanguage":"Bash"}cat /proc/sys/vm/swappiness
- To change swappiness on your system:Edit the /etc/sysctl.conf file and add the following line:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"vm.swappiness = 1","programmingLanguage":"Bash"}vm.swappiness = 1Run the following command to apply the setting:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"sudo sysctl -p","programmingLanguage":"Bash"}sudo sysctl -p
- Edit the /etc/sysctl.conf file and add the following line:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"vm.swappiness = 1","programmingLanguage":"Bash"}vm.swappiness = 1
- Run the following command to apply the setting:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"sudo sysctl -p","programmingLanguage":"Bash"}sudo sysctl -p
To check the current swappiness setting on your system, run:

```
cat /proc/sys/vm/swappiness
```

```
cat /proc/sys/vm/swappiness
```

To change swappiness on your system:
1. Edit the /etc/sysctl.conf file and add the following line:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"vm.swappiness = 1","programmingLanguage":"Bash"}vm.swappiness = 1
2. Run the following command to apply the setting:{"@context":"https://schema.org","@type":"SoftwareSourceCode","codeSampleType":"code snippet","text":"sudo sysctl -p","programmingLanguage":"Bash"}sudo sysctl -p
Edit the /etc/sysctl.conf file and add the following line:

```
/etc/sysctl.conf
```

```
vm.swappiness = 1
```

```
vm.swappiness = 1
```

Run the following command to apply the setting:

```
sudo sysctl -p
```

```
sudo sysctl -p
```

## Note
If you are running RHEL / CentOS and using a tuned performance profile, you must also edit your chosen profile to set vm.swappiness to 1 or 0.

```
tuned
```

```
vm.swappiness
```

```

```

```

```

#### https://www.mongodb.com/docs/manual/administration/production-notes/#recommended-configurationRecommended Configuration
For all MongoDB deployments:
- Use the Network Time Protocol (NTP) to synchronize time among
your hosts. This is especially important in sharded clusters.
Use the Network Time Protocol (NTP) to synchronize time among your hosts. This is especially important in sharded clusters.
For the WiredTiger storage engines, consider the following recommendations:
- Turn off atime for the storage volume containing the [database
files.](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-dbpath)
- Adjust the [ulimit](https://www.mongodb.com/docs/manual/reference/ulimit/#std-label-ulimit) settings for your platform according to the
recommendations in the ulimit reference.
Low ulimit values will negatively affect MongoDB when under heavy
use and can lead to failed connections to MongoDB processes and loss
of service.NoteIf the ulimit value for number of open files is under 64000, MongoDB
generates a startup warning.
- If you are running MongoDB 8.0, [enable Transparent Hugepages.](https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/#std-label-enable-thp)If you are running MongoDB 7.0 or earlier, [disable Transparent
Hugepages](https://www.mongodb.com/docs/manual/tutorial/disable-transparent-huge-pages/#std-label-disable-thp). In earlier versions, MongoDB performs better with
typical (4096 bytes) virtual memory pages.
- If you are running MongoDB 7.0 or earlier, [disable Transparent
Hugepages](https://www.mongodb.com/docs/manual/tutorial/disable-transparent-huge-pages/#std-label-disable-thp). In earlier versions, MongoDB performs better with
typical (4096 bytes) virtual memory pages.
- Disable NUMA in your BIOS. If that is not possible, see
- MongoDB on NUMA Hardware.
- Configure SELinux for MongoDB if you are not using the
default MongoDB directory paths or [ports.](https://www.mongodb.com/docs/manual/reference/default-mongodb-port/)NoteIf you are using SELinux, any MongoDB operation that requires
[server-side JavaScript](https://www.mongodb.com/docs/manual/core/server-side-javascript/#std-label-server-side-javascript) will
result in segfault errors. [Disable Server-Side Execution of JavaScript](https://www.mongodb.com/docs/manual/core/server-side-javascript/#std-label-disable-server-side-js) describes
how to disable execution of server-side JavaScript.
Turn off atime for the storage volume containing the [database files.](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-dbpath)

```
atime
```

Adjust the [ulimit](https://www.mongodb.com/docs/manual/reference/ulimit/#std-label-ulimit) settings for your platform according to the recommendations in the ulimit reference. Low ulimit values will negatively affect MongoDB when under heavy use and can lead to failed connections to MongoDB processes and loss of service.

```
ulimit
```

```
ulimit
```

## Note
If the ulimit value for number of open files is under 64000, MongoDB generates a startup warning.

```
ulimit
```

```
64000
```

If you are running MongoDB 8.0, [enable Transparent Hugepages.](https://www.mongodb.com/docs/manual/administration/tcmalloc-performance/#std-label-enable-thp)
- If you are running MongoDB 7.0 or earlier, [disable Transparent
Hugepages](https://www.mongodb.com/docs/manual/tutorial/disable-transparent-huge-pages/#std-label-disable-thp). In earlier versions, MongoDB performs better with
typical (4096 bytes) virtual memory pages.
If you are running MongoDB 7.0 or earlier, [disable Transparent Hugepages](https://www.mongodb.com/docs/manual/tutorial/disable-transparent-huge-pages/#std-label-disable-thp). In earlier versions, MongoDB performs better with typical (4096 bytes) virtual memory pages.
Disable NUMA in your BIOS. If that is not possible, see [MongoDB on NUMA Hardware.](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-production-numa)
Configure SELinux for MongoDB if you are not using the default MongoDB directory paths or [ports.](https://www.mongodb.com/docs/manual/reference/default-mongodb-port/)

If you are using SELinux, any MongoDB operation that requires [server-side JavaScript](https://www.mongodb.com/docs/manual/core/server-side-javascript/#std-label-server-side-javascript) will result in segfault errors. [Disable Server-Side Execution of JavaScript](https://www.mongodb.com/docs/manual/core/server-side-javascript/#std-label-disable-server-side-js) describes how to disable execution of server-side JavaScript.
For the WiredTiger storage engine:
- Set the readahead setting between 8 and 32 regardless of storage
media type (spinning disk, SSD, etc.).Higher readahead commonly benefits sequential I/O operations.
Since MongoDB disk access patterns are generally random, using higher
readahead settings provides limited benefit or potential performance
degradation. As such, for optimal MongoDB performance, set
readahead between 8 and 32, unless testing shows a measurable,
repeatable, and reliable benefit in a higher readahead value.
[MongoDB commercial support](https://support.mongodb.com/welcome) can
provide advice and guidance on alternate readahead configurations.
Set the readahead setting between 8 and 32 regardless of storage media type (spinning disk, SSD, etc.).
Higher readahead commonly benefits sequential I/O operations. Since MongoDB disk access patterns are generally random, using higher readahead settings provides limited benefit or potential performance degradation. As such, for optimal MongoDB performance, set readahead between 8 and 32, unless testing shows a measurable, repeatable, and reliable benefit in a higher readahead value. [MongoDB commercial support](https://support.mongodb.com/welcome) can provide advice and guidance on alternate readahead configurations.

#### https://www.mongodb.com/docs/manual/administration/production-notes/#mongodb-and-tls-ssl-librariesMongoDB and TLS/SSL Libraries
On Linux platforms, you may observe one of the following statements in the MongoDB log:

```
<path to TLS/SSL libs>/libssl.so.<version>: no version information available (required by /usr/bin/mongod)<path to TLS/SSL libs>/libcrypto.so.<version>: no version information available (required by /usr/bin/mongod)
```

```
<path to TLS/SSL libs>/libssl.so.<version>: no version information available (required by /usr/bin/mongod)<path to TLS/SSL libs>/libcrypto.so.<version>: no version information available (required by /usr/bin/mongod)
```

These warnings indicate that the system's TLS/SSL libraries are different from the TLS/SSL libraries that the [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) was compiled against. Typically these messages do not require intervention; however, you can use the following operations to determine the symbol versions that mongod expects:

```
mongod
```

```
mongod
```

```
objdump -T <path to mongod>/mongod | grep " SSL_"objdump -T <path to mongod>/mongod | grep " CRYPTO_"
```

```
objdump -T <path to mongod>/mongod | grep " SSL_"objdump -T <path to mongod>/mongod | grep " CRYPTO_"
```

These operations will return output that resembles one the of the following lines:

```
0000000000000000 DF *UND* 0000000000000000 libssl.so.10 SSL_write0000000000000000 DF *UND* 0000000000000000 OPENSSL_1.0.0 SSL_write
```

```
0000000000000000 DF *UND* 0000000000000000 libssl.so.10 SSL_write0000000000000000 DF *UND* 0000000000000000 OPENSSL_1.0.0 SSL_write
```

The last two strings in this output are the symbol version and symbol name. Compare these values with the values returned by the following operations to detect symbol version mismatches:

```
objdump -T <path to TLS/SSL libs>/libssl.so.1*objdump -T <path to TLS/SSL libs>/libcrypto.so.1*
```

```
objdump -T <path to TLS/SSL libs>/libssl.so.1*objdump -T <path to TLS/SSL libs>/libcrypto.so.1*
```

This procedure is neither exact nor exhaustive: many symbols used by [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) from the libcrypto library do not begin with CRYPTO_.

```
mongod
```

```
libcrypto
```

```
CRYPTO_
```

### https://www.mongodb.com/docs/manual/administration/production-notes/#mongodb-on-windowsMongoDB on Windows
For MongoDB instances using the WiredTiger storage engine, performance on Windows is comparable to performance on Linux.

### https://www.mongodb.com/docs/manual/administration/production-notes/#mongodb-on-virtual-environmentsMongoDB on Virtual Environments
This section describes considerations when running MongoDB in some of the more common virtual environments.
For all platforms, consider [Scheduling.](https://www.mongodb.com/docs/manual/administration/production-notes/#std-label-virtualized-disks-scheduling)

#### https://www.mongodb.com/docs/manual/administration/production-notes/#aws--amazon-web-services--ec2--elastic-compute-cloud-AWS EC2
There are two performance configurations to consider:
- Reproducible performance for performance testing or benchmarking, and
- Raw maximum performance
Reproducible performance for performance testing or benchmarking, and
Raw maximum performance
To tune performance on EC2 for either configuration, you should:
- Enable AWS
for your instance. Not all instance types support Enhanced Networking.To learn more about Enhanced Networking, see to the
[AWS documentation](http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/enhanced-networking.html#enabling_enhanced_networking).
- Set tcp_keepalive_time to 120.
Enable AWS [Enhanced Networking](http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/enhanced-networking.html#enabling_enhanced_networking) for your instance. Not all instance types support Enhanced Networking.
To learn more about Enhanced Networking, see to the [AWS documentation](http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/enhanced-networking.html#enabling_enhanced_networking).
Set tcp_keepalive_time to 120.

```
tcp_keepalive_time
```

If you are concerned more about reproducible performance on EC2, you should also:
- Use provisioned IOPS
for the storage, with separate devices for journal and data. Do not
use the ephemeral (SSD) storage available
on most instance types as their performance changes moment to moment.
(The i series is a notable exception, but very expensive.)
- Disable DVFS and
CPU power saving modes.Tip[Amazon documentation on Processor State Control](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/processor_state_control.html)
- Disable hyperthreading.Tip[Amazon blog post on disabling Hyper-Threading](https://aws.amazon.com/blogs/compute/disabling-intel-hyper-threading-technology-on-amazon-linux/).
- Use numactl to bind memory locality to a single socket.
Use provisioned IOPS for the storage, with separate devices for journal and data. Do not use the ephemeral (SSD) storage available on most instance types as their performance changes moment to moment. (The i series is a notable exception, but very expensive.)

```

```

Disable DVFS and CPU power saving modes.

Disable hyperthreading.

[Amazon blog post on disabling Hyper-Threading](https://aws.amazon.com/blogs/compute/disabling-intel-hyper-threading-technology-on-amazon-linux/).
Use numactl to bind memory locality to a single socket.

```
numactl
```

#### https://www.mongodb.com/docs/manual/administration/production-notes/#azureAzure
Use [Premium Storage](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-block-blob-premium). Microsoft Azure offers two general types of storage: Standard storage, and Premium storage. MongoDB on Azure has better performance when using Premium storage than it does with Standard storage.

#### https://www.mongodb.com/docs/manual/administration/production-notes/#vmwareVMware
MongoDB is compatible with VMware.
VMware supports memory overcommitment, where you can assign more memory to your virtual machines than the physical machine has available. When memory is overcommitted, the hypervisor reallocates memory between the virtual machines. VMware's balloon driver (vmmemctl) reclaims the pages that are considered least valuable.

```
vmmemctl
```

The balloon driver resides inside the guest operating system. Under certain configurations, when the balloon driver expands, it can interfere with MongoDB's memory management and affect MongoDB's performance.
To prevent negative performance impact from the balloon driver and memory overcommitment features, reserve the full amount of memory for the virtual machine running MongoDB. Reserving the appropriate amount of memory for the virtual machine prevents the balloon from inflating in the local operating system when there is memory pressure in the hypervisor.
Even though the balloon driver and memory overcommitment features can negatively affect MongoDB performance under certain configurations, do not disable these features. If you disable these features, the hypervisor may use its swap space to fulfill memory requests, which negatively affects performance.
Ensure that virtual machines stay on a specific ESX/ESXi host by setting VMware's [affinity rules](https://docs.vmware.com/en/VMware-vSphere/7.0/com.vmware.vsphere.resmgmt.doc/GUID-2FB90EF5-7733-4095-8B66-F10D6C57B820.html). If you must manually migrate a virtual machine to another host and the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance on the virtual machine is the [primary](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-primary), you must first [step down](https://www.mongodb.com/docs/manual/reference/method/rs.stepDown/#mongodb-method-rs.stepDown) the primary and then [shut down the instance.](https://www.mongodb.com/docs/manual/reference/method/db.shutdownServer/#mongodb-method-db.shutdownServer)

```
mongod
```

```
step down
```

```
shut down the instance
```

Follow the networking best practices for [vMotion](https://docs.vmware.com/en/VMware-vSphere/7.0/com.vmware.vsphere.vcenterhost.doc/GUID-7DAD15D4-7F41-4913-9F16-567289E22977.html) and [VMKernel](https://knowledge.broadcom.com/external/article?legacyId=2054994). Failure to follow the best practices can result in performance problems and affect [replica set](https://www.mongodb.com/docs/manual/core/replica-set-high-availability/) and [sharded cluster](https://www.mongodb.com/docs/manual/sharding/#std-label-sharding-sharded-cluster) high availability mechanisms.
You can clone a virtual machine running MongoDB. You might use this function to deploy a new virtual host to add as a member of a replica set.

#### https://www.mongodb.com/docs/manual/administration/production-notes/#kvmKVM
MongoDB is compatible with KVM.
KVM supports memory overcommitment, where you can assign more memory to your virtual machines than the physical machine has available. When memory is overcommitted, the hypervisor reallocates memory between the virtual machines. KVM's balloon driver reclaims the pages that are considered least valuable.
The balloon driver resides inside the guest operating system. Under certain configurations, when the balloon driver expands, it can interfere with MongoDB's memory management and affect MongoDB's performance.
To prevent negative performance impact from the balloon driver and memory overcommitment features, reserve the full amount of memory for the virtual machine running MongoDB. Reserving the appropriate amount of memory for the virtual machine prevents the balloon from inflating in the local operating system when there is memory pressure in the hypervisor.

Even though the balloon driver and memory overcommitment features can negatively affect MongoDB performance under certain configurations, do not disable these features. If you disable these features, the hypervisor may use its swap space to fulfill memory requests, which negatively affects performance.

### https://www.mongodb.com/docs/manual/administration/production-notes/#iostatiostat
On Linux, use the iostat command to check if disk I/O is a bottleneck for your database. Specify a number of seconds when running iostat to avoid displaying stats covering the time since server boot.

```
iostat
```

For example, the following command will display extended statistics and the time for each displayed report, with traffic in MB/s, at one second intervals:

```
iostat -xmt 1
```

```
iostat -xmt 1
```

Key fields from iostat:

```
iostat
```

- %util: this is the most useful field for a quick check, it
indicates what percent of the time the device/drive is in use.
- avgrq-sz: average request size. Smaller number for this value
reflect more random IO operations.
%util: this is the most useful field for a quick check, it indicates what percent of the time the device/drive is in use.

```
%util
```

avgrq-sz: average request size. Smaller number for this value reflect more random IO operations.

```
avgrq-sz
```

### https://www.mongodb.com/docs/manual/administration/production-notes/#bwm-ngbwm-ng
[bwm-ng](http://www.gropp.org/?id=projects&sub=bwm-ng) is a command-line tool for monitoring network use. If you suspect a network-based bottleneck, you may use bwm-ng to begin your diagnostic process.

```
bwm-ng
```

To make backups of your MongoDB database, please refer to [MongoDB Backup Methods Overview.](https://www.mongodb.com/docs/manual/core/backups/#std-label-backup-methods)
Back
Operations Checklist
Next
Exit Codes & Statuses
On this page

- [Platform Support Matrix](https://www.mongodb.com/docs/manual/administration/production-notes/#platform-support-matrix)
- [Concurrency](https://www.mongodb.com/docs/manual/administration/production-notes/#concurrency)
- [Data Consistency](https://www.mongodb.com/docs/manual/administration/production-notes/#data-consistency)
- [Networking](https://www.mongodb.com/docs/manual/administration/production-notes/#networking)
- [Hardware Considerations](https://www.mongodb.com/docs/manual/administration/production-notes/#hardware-considerations)
- [Architecture](https://www.mongodb.com/docs/manual/administration/production-notes/#architecture)

- [Compression](https://www.mongodb.com/docs/manual/administration/production-notes/#compression)
- [Clock Synchronization](https://www.mongodb.com/docs/manual/administration/production-notes/#clock-synchronization)
- [Platform Specific Considerations](https://www.mongodb.com/docs/manual/administration/production-notes/#platform-specific-considerations)
- [Performance Monitoring](https://www.mongodb.com/docs/manual/administration/production-notes/#performance-monitoring)
- [Backups](https://www.mongodb.com/docs/manual/administration/production-notes/#backups)
- Platform Support
- Platform Support Notes
- Platform Support Matrix

```
dbPath
```

- Concurrency
- Data Consistency
- Networking
- Hardware Considerations
- Architecture
- Compression
- Clock Synchronization
- Platform Specific Considerations
- Performance Monitoring
- Backups
On this page
- [Platform Support](https://www.mongodb.com/docs/manual/administration/production-notes/#platform-support)
- [Platform Support Notes](https://www.mongodb.com/docs/manual/administration/production-notes/#platform-support-notes)
- [Platform Support Matrix](https://www.mongodb.com/docs/manual/administration/production-notes/#platform-support-matrix)
- [MongoDB dbPath](https://www.mongodb.com/docs/manual/administration/production-notes/#mongodb-dbpath)
- [Concurrency](https://www.mongodb.com/docs/manual/administration/production-notes/#concurrency)
- [Data Consistency](https://www.mongodb.com/docs/manual/administration/production-notes/#data-consistency)
- [Networking](https://www.mongodb.com/docs/manual/administration/production-notes/#networking)
- [Hardware Considerations](https://www.mongodb.com/docs/manual/administration/production-notes/#hardware-considerations)
- [Architecture](https://www.mongodb.com/docs/manual/administration/production-notes/#architecture)
- [Compression](https://www.mongodb.com/docs/manual/administration/production-notes/#compression)
- [Clock Synchronization](https://www.mongodb.com/docs/manual/administration/production-notes/#clock-synchronization)
- [Platform Specific Considerations](https://www.mongodb.com/docs/manual/administration/production-notes/#platform-specific-considerations)
- [Performance Monitoring](https://www.mongodb.com/docs/manual/administration/production-notes/#performance-monitoring)
- [Backups](https://www.mongodb.com/docs/manual/administration/production-notes/#backups)
- Platform Support
- Platform Support Notes
- Platform Support Matrix
- MongoDB dbPath

```
dbPath
```

- Concurrency
- Data Consistency

- Networking
- Hardware Considerations
- Architecture
- Compression
- Clock Synchronization
- Platform Specific Considerations
- Performance Monitoring
- Backups

