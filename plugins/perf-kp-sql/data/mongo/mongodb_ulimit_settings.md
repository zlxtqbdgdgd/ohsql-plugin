---
source: https://www.mongodb.com/docs/manual/reference/ulimit/
authority: mongodb_official
authority_level: ⭐⭐⭐ MongoDB 官方文档
title: "UNIX ulimit Settings for Self-Managed Deployments - Database Manual - MongoDB Docs"
last_verified: 2026-04-11
---

# MongoDB UNIX ulimit 配置 (官方)

> 来源: https://www.mongodb.com/docs/manual/reference/ulimit/

### https://www.mongodb.com/docs/manual/reference/ulimit/#mongodmongod
```
mongod
```

- 1 file descriptor for each data file in use by the
[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance.
- 1 file descriptor for each journal file used by the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)
instance.
- In replica sets, each [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) maintains a connection to
all other members of the set.
1 file descriptor for each data file in use by the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance.

```
mongod
```

1 file descriptor for each journal file used by the [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance.

```
mongod
```

In replica sets, each [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) maintains a connection to all other members of the set.

```
mongod
```

[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) uses background threads for a number of internal processes, including [TTL collections](https://www.mongodb.com/docs/manual/tutorial/expire-data/#std-label-ttl-collections), replication, and replica set health checks, which may require a small number of additional resources.

```
mongod
```

### https://www.mongodb.com/docs/manual/reference/ulimit/#mongosmongos
```
mongos
```

In addition to the threads and file descriptors for client connections, [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) must maintain connections to all config servers and all shards, which includes all members of all replica sets.

```
mongos
```

For [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos), consider the following behaviors:

```
mongos
```

- [[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances maintain a connection pool to each shard
so that the mongos can reuse connections and quickly
fulfill requests without needing to create new connections.
- You can limit the number of incoming connections using
the [net.maxIncomingConnections](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-net.maxIncomingConnections) run-time option.
By restricting the number of incoming connections you can prevent a
cascade effect where the [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) creates too many
connections on the mongod instances.
[[mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos)](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances maintain a connection pool to each shard so that the mongos can reuse connections and quickly fulfill requests without needing to create new connections.

```
mongos
```

```
mongos
```

You can limit the number of incoming connections using the [net.maxIncomingConnections](https://www.[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)b.com/docs/manual/reference/configuration-options/#mongodb-setting-net.maxIncomingConnections) run-time option. By restricting the number of incoming connections you can prevent a cascade effect where the [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) creates too many connections on the mongod instances.

```
net.maxIncomingConnections
```

```
mongos
```

```
mongod
```

```
ulimit
```

You can use the ulimit command at the system prompt to check system limits, as in the following example:

```
ulimit
```

```
```

```
```

ulimit refers to the per-user limitations for various resources. Therefore, if your [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instance executes as a user that is also running multiple processes, or multiple mongod processes, you might see contention for these resources. Also, be aware that the processes value (i.e. -u) refers to the combined number of distinct processes and sub-process threads.

```
ulimit
```

```
mongod
```

```
mongod
```

```
processes
```

```

```

On Linux, you can change ulimit settings by issuing a command in the following form:

```
ulimit
```

```
ulimit -n <value>
```

```
ulimit -n <value>
```

There are both "hard" and the "soft" ulimit s that affect MongoDB's performance. The "hard" ulimit refers to the maximum number of processes that a user can have active at any time. This is the ceiling: no non-root process can increase the "hard" ulimit. In contrast, the "soft" ulimit is the limit that is actually enforced for a session or process, but any process can increase it up to "hard" ulimit maximum.

```
ulimit
```

```
ulimit
```

```
ulimit
```

```
ulimit
```

```
ulimit
```

A low "soft" ulimit can cause can't create new thread, closing connection errors if the number of connections grows too high. For this reason, it is extremely important to set both ulimit values to the recommended values.

```
ulimit
```

```
can't create new thread, closing connection
```

```
ulimit
```

ulimit will modify both "hard" and "soft" values unless the -H or -S modifiers are specified when modifying limit values.

```
ulimit
```

```

```

```

```

For many distributions of Linux you can change values by substituting the -n option for any possible value in the output of ulimit -a.

```

```

```
ulimit -a
```

After changing the ulimit settings, you must restart the process to take advantage of the modified settings. On Linux, you can use the /proc file system to see the current limitations on a running process.

```
ulimit
```

```
/proc
```

Depending on your system's configuration, and default settings, any change to system limits made using ulimit may revert following a system restart. Check your distribution and operating system documentation for more information.

```
ulimit
```

You should typically start [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) using systemctl, which uses the ulimit settings:

```
mongod
```

```
systemctl
```

```
ulimit
```

```
systemctl start mongod.service
```

```
systemctl start mongod.service
```

If you do not start [[mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod)](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) using systemctl, systemd overrides some of the ulimit settings. For example, if you start mongod as shown in the following command, then a user slice (such as user-1000.slice) systemd setting is used:

```
mongod
```

```
systemctl
```

```
systemd
```

```
ulimit
```

```
mongod
```

```
user-1000.slice
```

```
systemd
```

```
mongod --config ~/mongod.conf
```

```
mongod --config ~/mongod.conf
```

A systemd user slice limits the resources for the user's processes.

```
systemd
```

#### https://www.mongodb.com/docs/manual/reference/ulimit/#macosmacOS
For macOS systems that have installed MongoDB Community Edition using the Homebrew installation method, the open files limit might not be automatically set when starting MongoDB through brew services. You might need to manually configure the ulimit values.

```
brew services
```

```
ulimit
```

```
ulimit
```

#### https://www.mongodb.com/docs/manual/reference/ulimit/#red-hat-linux-enterprise-server-and-centosRed Hat Linux Enterprise Server and CentOS
Red Hat Enterprise Linux and CentOS 6 and 7 enforce a separate max process limitation, nproc, which overrides ulimit settings. This value is defined in the following configuration file, depending on version:

```
nproc
```

```
ulimit
```

RHEL / CentOS 7
4096
/etc/security/limits.d/20-nproc.conf

```
/etc/security/limits.d/20-nproc.conf
```

RHEL / CentOS 6
1024
/etc/security/limits.d/90-nproc.conf

```
/etc/security/limits.d/90-nproc.conf
```

To configure an nproc value for these versions, create a file named /etc/security/limits.d/99-mongodb-nproc.conf with new soft nproc and hard nproc values to increase the process limit. For recommended values, see [Recommended ulimit Settings.](https://www.mongodb.com/docs/manual/reference/ulimit/#std-label-recommended-ulimit-settings)

```
nproc
```

```
/etc/security/limits.d/99-mongodb-nproc.conf
```

```
soft nproc
```

```
hard nproc
```

```
ulimit
```

With RHEL / CentOS 8, separate nproc values are no longer necessary. The ulimit command is sufficient to configure the required max process values on RHEL / CentOS 8.

```
nproc
```

```
ulimit
```

```
ulimit
```

Every deployment may have unique requirements and settings; however, the following thresholds and settings are particularly important for [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) and [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) deployments:

```
mongod
```

```
mongos
```

- -f (file size): unlimited
- -t (cpu time): unlimited
- -v (virtual memory): unlimited [[1]](https://www.mongodb.com/docs/manual/reference/ulimit/#footnote-memory-size)
- -l (locked-in-memory size): unlimited
- -n (open files): 64000
- -m (memory size): unlimited [[1]](https://www.mongodb.com/docs/manual/reference/ulimit/#footnote-memory-size) [[2]](https://www.mongodb.com/docs/manual/reference/ulimit/#footnote-rss-linux)
- -u (processes/threads): 64000
-f (file size): unlimited

```

```

```
unlimited
```

-t (cpu time): unlimited

```

```

```
unlimited
```

-v (virtual memory): unlimited [[1]](https://www.mongodb.com/docs/manual/reference/ulimit/#footnote-memory-size)

```

```

```
unlimited
```

-l (locked-in-memory size): unlimited

```

```

```
unlimited
```

-n (open files): 64000

```

```

```
64000
```

-m (memory size): unlimited [[1]](https://www.mongodb.com/docs/manual/reference/ulimit/#footnote-memory-size) [[2]](https://www.mongodb.com/docs/manual/reference/ulimit/#footnote-rss-linux)

```

```

```
unlimited
```

-u (processes/threads): 64000

```

```

```
64000
```

Always remember to restart your [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) and [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances after changing the ulimit settings to ensure that the changes take effect.

```
mongod
```

```
mongos
```

```
ulimit
```

#### https://www.mongodb.com/docs/manual/reference/ulimit/#considerationsConsiderations
- Incoming connections to a [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instance require
two file descriptors.
- For the macOS platform, the recommended process limit is 2500,
which is the maximum configurable value for this platform.
Incoming connections to a [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instance require two file descriptors.

```
mongod
```

```
mongos
```

For the macOS platform, the recommended process limit is 2500, which is the maximum configurable value for this platform.

```
2500
```

### https://www.mongodb.com/docs/manual/reference/ulimit/#linux-distributions-using-upstartLinux distributions using Upstart
For Linux distributions that use Upstart, you can specify limits within service scripts if you start [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) and/or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instances as Upstart services. You can do this by using limit [stanzas](http://upstart.ubuntu.com/wiki/Stanzas#limit).

```
mongod
```

```
mongos
```

```
limit
```

Specify the [Recommended ulimit Settings](https://www.mongodb.com/docs/manual/reference/ulimit/#std-label-recommended-ulimit-settings), as in the following example:

```
ulimit
```

```
limit fsize unlimited unlimited # (file size)limit cpu unlimited unlimited # (cpu time)limit as unlimited unlimited # (virtual memory size)limit memlock unlimited unlimited # (locked-in-memory size)limit nofile 64000 64000 # (open files)limit nproc 64000 64000 # (processes/threads)
```

```
limit fsize unlimited unlimited # (file size)limit cpu unlimited unlimited # (cpu time)limit as unlimited unlimited # (virtual memory size)limit memlock unlimited unlimited # (locked-in-memory size)limit nofile 64000 64000 # (open files)limit nproc 64000 64000 # (processes/threads)
```

Each limit stanza sets the "soft" limit to the first value specified and the "hard" limit to the second.

```
limit
```

After changing limit stanzas, ensure that the changes take effect by restarting the application services, using the following form:

```
limit
```

```
restart <service name>
```

```
restart <service name>
```

### https://www.mongodb.com/docs/manual/reference/ulimit/#linux-distributions-using-systemdLinux distributions using systemd
```
systemd
```

If you start a [mongod](https://www.mongodb.com/docs/manual/reference/program/mongod/#mongodb-binary-bin.mongod) and/or [mongos](https://www.mongodb.com/docs/manual/reference/program/mongos/#mongodb-binary-bin.mongos) instance as a systemd service, you can specify limits within the [Service] section of its service file. The service file has a location like /etc/systemd/system/<process-name>.service.

```
mongod
```

```
mongos
```

```
systemd
```

```
[Service]
```

```
/etc/systemd/system/<process-name>.service
```

You can set limits by using [resource limit directives](http://www.freedesktop.org/software/systemd/man/systemd.exec.html#LimitCPU=).
Specify the [Recommended ulimit Settings](https://www.mongodb.com/docs/manual/reference/ulimit/#std-label-recommended-ulimit-settings), as in the following example:

```
ulimit
```

```
[Service]# Other directives omitted# (file size)LimitFSIZE=infinity# (cpu time)LimitCPU=infinity# (virtual memory size)LimitAS=infinity# (locked-in-memory size)LimitMEMLOCK=infinity# (open files)LimitNOFILE=64000# (processes/threads)LimitNPROC=64000
```

```
[Service]# Other directives omitted# (file size)LimitFSIZE=infinity# (cpu time)LimitCPU=infinity# (virtual memory size)LimitAS=infinity# (locked-in-memory size)LimitMEMLOCK=infinity# (open files)LimitNOFILE=64000# (processes/threads)LimitNPROC=64000
```

Each systemd limit directive sets both the "hard" and "soft" limits to the value specified.

```
systemd
```

After changing limit stanzas, ensure that the changes take effect by restarting the application services, using the following form:

```
limit
```

```
systemctl restart <service name>
```

```
systemctl restart <service name>
```

If you installed MongoDB via a package manager such as yum or apt, the service file installed as part of your installation already contains these ulimit values.

```
yum
```

```
apt
```

```
/proc
```

This section applies only to Linux operating systems.
The /proc file-system stores the per-process limits in the file system object located at /proc/<pid>/limits, where <pid> is the process's [PID](https://www.mongodb.com/docs/manual/reference/glossary/#std-term-PID) or process identifier. You can use the following bash function to return the content of the limits object for a process or processes with a given name:

```
/proc
```

```
/proc/<pid>/limits
```

```
<pid>
```

```
bash
```

```
limits
```

```
```

```
```

You can copy and paste this function into a current shell session or load it as part of a script. Call the function with one the following invocations:

```
return-limits mongodreturn-limits mongosreturn-limits mongod mongos
```

```
return-limits mongodreturn-limits mongosreturn-limits mongod mongos
```

```

```

```
ulimit
```

```

```

Back
Configure the Rate Limiter
Next
TCMalloc Performance
On this page

- Resource Utilization
- Review and Set Resource Limits
On this page
- [Resource Utilization](https://www.mongodb.com/docs/manual/reference/ulimit/#resource-utilization)
- [Review and Set Resource Limits](https://www.mongodb.com/docs/manual/reference/ulimit/#review-and-set-resource-limits)
- Resource Utilization
- Review and Set Resource Limits
