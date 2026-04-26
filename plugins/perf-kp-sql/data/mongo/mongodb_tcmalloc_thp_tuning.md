---
source: https://www.mongodb.com/docs/manual/tutorial/transparent-huge-pages/
authority: mongodb_official
authority_level: ⭐⭐⭐ MongoDB 官方文档
title: "TCMalloc Performance Optimization for a Self-Managed Deployment - Database Manual - MongoDB Docs"
last_verified: 2026-04-11
---

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
