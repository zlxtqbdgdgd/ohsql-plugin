---
source: https://www.mongodb.com/docs/manual/administration/production-notes/
authority: mongodb_official
authority_level: ⭐⭐⭐ MongoDB 官方文档
title: "MongoDB 生产部署与运维指南（官方整合版）"
last_verified: 2026-04-11
topics: 生产部署, 运维检查清单, ulimit配置, 平台支持
---

# MongoDB 生产部署与运维指南

> 整合自 MongoDB 官方文档：Production Notes + Operations Checklist + ulimit Settings

---

## 第一部分：生产环境注意事项 (Production Notes)

> 来源: https://www.mongodb.com/docs/manual/administration/production-notes/



---

.. _production-notes:

=============================================
Production Notes for Self-Managed Deployments
=============================================

.. default-domain:: mongodb

.. facet::
   :name: genre
   :values: reference

.. meta:: 
   :description: System configurations that affect MongoDB, especially when running in production.
   :keywords: on-prem

.. contents:: On this page
   :local:
   :backlinks: none
   :depth: 1
   :class: twocols

This page details system configurations that affect MongoDB,
especially when running in production.

.. note::

   `MongoDB Atlas
   <https://www.mongodb.com/atlas/database?tck=docs_server>`_ is a
   cloud-hosted database-as-a-service. If you can leverage public
   clouds, Atlas automatically addresses many of the considerations
   present in these Production Notes, as well as offering the following
   benefits:

   - **Security:** Atlas reduces configuration required for security
     features like encryption, auditing, and role-based access control.

   - **Scalability:** You can automatically scale your Atlas cluster
     based on usage. You can also configure granular scaling for
     compute, IOPS, and storage.

   - **Availability:** Atlas has a 99.995% uptime SLA. You can also
     configure multi-region and multi-cloud deployments with automated
     failover and continuous backups.

   - **Performance:** You can use built-in tools like Query Insights and
     Performance Advisor to optimize performance, improve database
     operations, and manage costs.


   - **Full Text Search:** You can build performant, relevance-based
     search functionality into your Atlas application.

   For more information, see the `Atlas documentation
   <https://docs.atlas.mongodb.com?tck=docs_server>`__ and :atlas:`Atlas
   Production Notes </production-notes/>`.

.. _prod-notes-supported-platforms:

Platform Support
----------------

For running **in production**, refer to the
:ref:`prod-notes-recommended-platforms` for operating system
recommendations.

Platform Support Notes
----------------------

x86_64
~~~~~~

MongoDB requires the following minimum ``x86_64`` microarchitectures:

- For Intel ``x86_64``, MongoDB requires one of:

  - a *Sandy Bridge* or later Core processor, or
  - a *Tiger Lake* or later Celeron or Pentium processor.

- For AMD ``x86_64``, MongoDB requires:

  - a *Bulldozer* or later processor.

Starting in MongoDB 5.0, :binary:`~bin.mongod`, :binary:`~bin.mongos`,
and the legacy :binary:`~bin.mongo` shell no longer support ``x86_64``
platforms which do not meet this minimum microarchitecture requirement.

- MongoDB only supports Oracle Linux running the  Red Hat Compatible
  Kernel (RHCK). MongoDB does **not** support the Unbreakable
  Enterprise Kernel (UEK).

- MongoDB 5.0 requires use of the AVX instruction set, available on
  `select Intel and AMD processors
  <https://en.wikipedia.org/wiki/Advanced_Vector_Extensions#CPUs_with_AVX>`__.

.. _prod-notes-supported-platforms-ARM64:

ARM64
~~~~~

MongoDB on ``arm64`` requires the *ARMv8.2-A* or later
microarchitecture.

Starting in MongoDB 5.0, :binary:`~bin.mongod`, :binary:`~bin.mongos`,
and the legacy :binary:`~bin.mongo` shell no longer support ``arm64``
platforms which do not meet this minimum microarchitecture requirement.

To use the *ARM v8.4-A* or later microarchitecture, use MongoDB version 7.0 or later.

.. note:: MongoDB no longer supports single board hardware lacking the proper 
   CPU architecture (Raspberry Pi 4). See `Compatibility Changes in MongoDB 5.0 
   <https://www.mongodb.com/docs/manual/release-notes/5.0-compatibility/#removed-raspberry-pi-support>`_ 
   for more information.

.. _prod-notes-supported-platforms-x86_64:
.. _prod-notes-supported-platforms-PPC64LE:
.. _prod-notes-supported-platforms-s390x:

Platform Support Matrix
-----------------------

.. include:: includes/platform-support-updates.rst

.. include:: includes/platform-support.rst

.. [#SLES12-SP-info]

   MongoDB versions 5.0 and greater are tested against SLES 12 service 
   pack 5. Earlier versions of MongoDB are tested against SLES 12 
   with no service pack.

.. [#SLES15-SP-info]

   MongoDB versions 7.0 and later are tested against SLES 15 service pack 4. 
   Earlier versions of MongoDB are tested against SLES 15 with no service pack.

.. [#RHEL7-compat]

   MongoDB version 7.0 is built and tested against RHEL 7.9. Earlier versions

of MongoDB are tested against RHEL 7 and assume forward compatibility.

.. [#RHEL8-tcmalloc-support]

   RHEL 8 on PPC64LE and s390x does not support the updated version of TCMalloc 
   used in MongoDB versions 8.0 and later.  On these architectures, RHEL 8 uses 
   the legacy TCMalloc version. To learn more, see :ref:`tcmalloc-performance`.

.. [#RHEL9-tcmalloc-support]

   RHEL 9 on PPC64LE does not support the updated version of TCMalloc 
   used in MongoDB versions 8.0 and later.  On this architecture, RHEL 9 uses 
   the legacy TCMalloc version. To learn more, see :ref:`tcmalloc-performance`.

.. _prod-notes-recommended-platforms:

Recommended Platforms
~~~~~~~~~~~~~~~~~~~~~

While MongoDB supports a variety of platforms, the following operating
systems are recommended for production use on ``x86_64`` architecture:

- Amazon Linux
- Debian
- :abbr:`RHEL (Red Hat Enterprise Linux)` [#rocky-almalinux]_
- SLES
- Ubuntu LTS
- Windows Server

For best results, run the latest version of your platform. If you run an
older version, make sure that your version is supported by its provider.

.. [#rocky-almalinux]

   MongoDB on-premises products released for RHEL version 8.0+ are
   compatible with Rocky Linux version 8.0+ and AlmaLinux version 8.0+,
   contingent upon those distributions meeting their obligation to
   deliver full RHEL compatibility.

.. seealso::

   :ref:`prod-notes-platform-considerations`

Use the Latest Stable Packages
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Be sure you have the latest stable release.

MongoDB releases are available on the MongoDB Download Center:

- `MongoDB Enterprise Advanced 
  <https://www.mongodb.com/try/download/enterprise-advanced>`_
- `MongoDB Community Edition
  <https://www.mongodb.com/try/download/community-edition>`_

For details on upgrading to the most current minor release, see
:ref:`upgrade-to-latest-revision`.

The following related packages are also available on the MongoDB 
Download Center:

- `Tools <https://www.mongodb.com/try/download/tools>`_
- `Atlas SQL Interface <https://www.mongodb.com/try/download/atlas-sql>`_
- `Mobile & Edge <https://www.mongodb.com/try/download/realm>`_

For other MongoDB products, see their `respective documentation 
<https://www.mongodb.com/docs/?tck=docs_server>`_.

MongoDB ``dbPath``
------------------

The files in the :setting:`~storage.dbPath` directory must correspond
to the configured :term:`storage engine`. :binary:`~bin.mongod` will not start if
:setting:`~storage.dbPath` contains data files created by a storage
engine other than the one specified by :option:`--storageEngine <mongod --storageEngine>`.

:binary:`~bin.mongod` must possess read and write permissions for the specified
:setting:`~storage.dbPath`.

.. include:: /includes/security/fact-antivirus-scan.rst

.. _prod-notes-concurrency:

Concurrency
-----------

.. _prod-notes-wired-tiger-concurrency:

WiredTiger
~~~~~~~~~~

:ref:`WiredTiger <storage-wiredtiger>` supports concurrent access by
readers and writers to the documents in a collection. Clients can read
documents while write operations are in progress, and multiple threads
can modify different documents in a collection at the same time.

.. seealso::

   :ref:`prod-notes-ram` provides information about how WiredTiger
   takes advantage of multiple CPU cores and how to improve operation
   throughput.


Data Consistency
----------------

Journaling
~~~~~~~~~~

MongoDB uses *write ahead logging* to an on-disk :term:`journal`.
Journaling guarantees that MongoDB can quickly recover :ref:`write
operations <crud>` that were written to the journal
but not written to data files in cases where :binary:`~bin.mongod`
terminated due to a crash or other serious failure. See 
:ref:`<journaling-internals>` for more information.

Read Concern
~~~~~~~~~~~~

.. include:: /includes/fact-read-own-writes.rst

Write Concern
~~~~~~~~~~~~~

.. include:: /includes/introduction-write-concern.rst

See the :ref:`Write Concern <write-concern>` document for more
information about choosing an appropriate write concern level for your
deployment.

Networking
----------

Use Trusted Networking Environments
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Always run MongoDB in a *trusted environment*, with network rules that
prevent access from *all* unknown machines, systems, and networks. As
with any sensitive system that is dependent on network access, your
MongoDB deployment should only be accessible to specific systems that

require access, such as application servers, monitoring services, and
other MongoDB components.

.. important::
   By default, :ref:`authorization <authorization>` is not
   enabled, and :binary:`~bin.mongod` assumes a trusted environment. Enable
   :setting:`~security.authorization` mode as needed. For more
   information on authentication mechanisms supported in MongoDB as
   well as authorization in MongoDB, see :ref:`<authentication>`
   and :ref:`<authorization>`.

For additional information and considerations on security, refer to the
documents in the :ref:`Security Section <security>`, specifically:

- :doc:`/administration/security-checklist`
- :doc:`/core/security-hardening`

For Windows users, consider the `Windows Server Technet Article on TCP
Configuration <http://technet.microsoft.com/en-us/library/dd349797.aspx>`_
when deploying MongoDB on Windows.

Disable HTTP Interface
~~~~~~~~~~~~~~~~~~~~~~

The HTTP interface is disabled by default. Do not enable the HTTP interface in 
production environments.

.. _prod-notes-connection-pools:

Manage Connection Pool Sizes
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Avoid overloading the connection resources of a :binary:`~bin.mongod` or
:binary:`~bin.mongos` instance by adjusting the connection pool size to suit
your use case. Start at 110-115% of the typical number of current database
requests, and modify the connection pool size as needed. Refer to the
:ref:`connection-pool-options` for adjusting the connection pool size.

The :dbcommand:`connPoolStats` command returns information regarding
the number of open connections to the current database for
:binary:`~bin.mongos` and :binary:`~bin.mongod` instances in sharded clusters.

See also :ref:`prod-notes-ram`.

Adjust tcp_keepalive_time
~~~~~~~~~~~~~~~~~~~~~~~~~

If the TCP keepalive value is greater than the TCP idle timeout on your
cloud provider's load balancer, there is a risk that the system might
silently drop connections. To reduce this risk, set
``tcp_keepalive_time`` to 120.

.. note::

   You need to restart :binary:`~bin.mongod` and :binary:`~bin.mongos`
   processes for new system-wide keepalive settings to take effect.

.. include:: /includes/fact-tcp-keepalive-linux.rst

.. include:: /includes/fact-tcp-keepalive-windows.rst

Hardware Considerations
-----------------------

MongoDB is designed specifically with commodity hardware in mind and
has few hardware requirements or limitations. MongoDB's core components
run on little-endian hardware, primarily x86/x86_64 processors. Client
libraries (i.e. drivers) can run on big or little endian systems.

.. _prod-notes-ram:

Allocate Sufficient RAM and CPU
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

At a minimum, ensure that each :binary:`~bin.mongod` or
:binary:`~bin.mongos` instance has access to two real cores or
one multi-core physical CPU.

WiredTiger
``````````

The :ref:`WiredTiger <storage-wiredtiger>` storage engine is multithreaded and can take advantage
of additional CPU cores. Specifically, the total number of active threads
(i.e. concurrent operations) relative to the number of available CPUs can impact
performance:

- Throughput *increases* as the number of concurrent active operations
  increases up to the number of CPUs.

- Throughput *decreases* as the number of concurrent active operations
  exceeds the number of CPUs by some threshold amount.

The threshold depends on your application. You can determine the
optimum number of concurrent active operations for your application by
experimenting and measuring throughput. The output from
:binary:`~bin.mongostat` provides statistics on the number of active
reads/writes in the (``ar|aw``) column.

.. include:: /includes/extracts/wt-configure-cache.rst

Compression and Encryption
``````````````````````````

When using encryption, CPUs equipped with AES-NI instruction-set
extensions show significant performance advantages.
If you are using MongoDB Enterprise with the
:ref:`encrypted-storage-engine`, choose a CPU that supports AES-NI for
better performance.

.. seealso::

   :ref:`prod-notes-concurrency`

Use Solid State Disks (SSDs)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

MongoDB has good results and a good price-performance ratio with
SATA SSD (Solid State Disk).

Use SSD if available and economical.

Commodity (SATA) spinning drives are often a good option, as the
random I/O performance increase with more expensive spinning drives
is not that dramatic (only on the order of 2x). Using SSDs or

increasing RAM may be more effective in increasing I/O throughput.

.. _production-numa:

MongoDB and NUMA Hardware
~~~~~~~~~~~~~~~~~~~~~~~~~

Running MongoDB on a system with Non-Uniform Memory Access (NUMA) can
cause a number of operational problems, including slow performance for
periods of time and high system process usage.

When running MongoDB servers and clients on NUMA hardware, you should configure
a memory interleave policy so that the host behaves in a non-NUMA fashion.
MongoDB checks NUMA settings on start up when deployed on Linux (since version
2.0) and Windows (since version 2.6) machines. If the
NUMA configuration may degrade performance, MongoDB prints a warning.

The ``numad`` daemon process can also reduce :binary:`~bin.mongod` performance. 
You should ensure ``numad`` is not enabled on MongoDB servers.

.. seealso::

   - `The MySQL "swap insanity" problem and the effects of NUMA
     <http://jcole.us/blog/archives/2010/09/28/mysql-swap-insanity-and-the-numa-architecture/>`_
     post, which describes the effects of
     NUMA on databases. The post introduces NUMA and its goals, and
     illustrates how these goals are not compatible with production
     databases. Although the blog post addresses the impact of NUMA for
     MySQL, the issues for MongoDB are similar.

   - `NUMA: An Overview <https://queue.acm.org/detail.cfm?id=2513149>`_.

Configuring NUMA on Windows
```````````````````````````

On Windows, memory interleaving must be enabled through the machine's BIOS.
Consult your system documentation for details.

Configuring NUMA on Linux
`````````````````````````

On Linux, you must disable *zone reclaim* and also ensure that your
:binary:`~bin.mongod` and :binary:`~bin.mongos` instances are started by
``numactl``, which is generally configured through your platform's init
system. You must perform both of these operations to properly disable
NUMA for use with MongoDB.

# . Disable *zone reclaim* with one of the following commands:
.. code-block:: bash

      echo 0 | sudo tee /proc/sys/vm/zone_reclaim_mode

   .. code-block:: bash

      sudo sysctl -w vm.zone_reclaim_mode=0

# . Ensure that :binary:`~bin.mongod` and :binary:`~bin.mongos` are
started by ``numactl``. This is generally configured through your
   platform's init system. Run the following command to determine which
   init system is in use on your platform:

   .. code-block:: bash

      ps --no-headers -o comm 1

   - If "``systemd``", your platform uses the **systemd** init
     system, and you *must* follow the steps in the **systemd** tab
     below to edit your MongoDB service file(s).

   - If "``init``", your platform uses the *SysV Init* system, and you
     *do not* need to perform this step. The default MongoDB init script
     for SysV Init includes the necessary steps to start MongoDB
     instances via ``numactl`` by default.

   - If you manage your own init scripts (i.e. you are not using either
     of these init systems), you *must* follow the steps in the
     **Custom init scripts** tab below to edit your custom init
     script(s).

     |

   .. tabs::

      .. tab:: systemd
         :tabid: systemd-numa-steps

         You must use ``numactl`` to start each of your
         :binary:`~bin.mongod` instances, including all
         :ref:`config servers <sharding-config-server>`,
         :binary:`~bin.mongos` instances, and clients. Edit the default
         **systemd** service file for each as follows:

         #. Copy the default MongoDB service file:

            .. code-block:: bash

               sudo cp /lib/systemd/system/mongod.service /etc/systemd/system/

         #. Edit the ``/etc/systemd/system/mongod.service`` file, and
            update the ``ExecStart`` statement to begin with:

            .. code-block:: bash

               /usr/bin/numactl --interleave=all

            .. example::

               If your existing ``ExecStart`` statement reads:

               .. code-block:: bash
                  :copyable: false

                  ExecStart=/usr/bin/mongod --config /etc/mongod.conf

               Update that statement to read:

               .. code-block:: bash
                  :copyable: false

                  ExecStart=/usr/bin/numactl --interleave=all /usr/bin/mongod --config /etc/mongod.conf

         #. Apply the change to ``systemd``:

            .. code-block:: bash

               sudo systemctl daemon-reload

         #. Restart any running ``mongod`` instances:

            .. code-block:: bash

               sudo systemctl stop mongod
               sudo systemctl start mongod

         #. If applicable, repeat these steps for any
            :binary:`~bin.mongos` instances.

      .. tab:: Custom init scripts
         :tabid: custom-scripts-numa-steps

         You must use ``numactl`` to start each of your
         :binary:`~bin.mongod` instances, including all
         :ref:`config servers <sharding-config-server>`,
         :binary:`~bin.mongos` instances, and clients.

         #. Install ``numactl`` for your platform if not already
            installed. Refer to the documentation for your operating
            system for information on installing the ``numactl``
            package.

         #. Configure each of your custom init scripts to start each
            MongoDB instance via ``numactl``:

            .. code-block:: bash

               numactl --interleave=all <path> <options>

            Where ``<path>`` is the path to the program you are starting
            and ``<options>`` are any optional arguments to pass to that
            program.

            .. example::

               .. code-block:: bash
                  :copyable: false

                  numactl --interleave=all /usr/local/bin/mongod -f /etc/mongod.conf

For more information, see the `Documentation for /proc/sys/vm/*
<http://www.kernel.org/doc/Documentation/sysctl/vm.txt>`_.

Disk and Storage Systems
~~~~~~~~~~~~~~~~~~~~~~~~

Swap

````

MongoDB performs best where swapping can be avoided or kept to a
minimum, as retrieving data from swap will always be slower
than accessing data in RAM. However, if the system hosting MongoDB runs
out of RAM, swapping can prevent the Linux OOM Killer from terminating
the :binary:`~bin.mongod` process.

Generally, you should choose one of the following swap strategies:

#. Assign swap space on your system, and configure the kernel to only
   permit swapping under high memory load, or
#. Do not assign swap space on your system, and configure the kernel to
   disable swapping entirely

See :ref:`Set vm.swappiness <set-swappiness>` for instructions on
configuring swap on your Linux system following these guidelines.

.. note::

   If your MongoDB instance is hosted on a system that also runs other
   software, such as a webserver, you should choose the first swap
   strategy. Do *not* disable swap in this case. If possible, it is
   highly recommended that you run MongoDB on its own dedicated system.

RAID
````

For optimal performance in terms of the storage layer, use disks
backed by RAID-10. RAID-5 and RAID-6 do not typically provide
sufficient performance to support a MongoDB deployment.

.. _production-nfs:

Remote Filesystems (NFS)
````````````````````````

With the WiredTiger storage engine, WiredTiger objects may be stored on
remote file systems if the remote file system conforms to ISO/IEC
9945-1:1996 (POSIX.1). Because remote file systems are often slower
than local file systems, using a remote file system for storage may
degrade performance.

If you decide to use NFS, add the following NFS options to your
``/etc/fstab`` file:

- ``bg``
- ``hard``
- ``nolock``
- ``noatime``
- ``nointr``

Depending on your kernel version, some of these values may already be
set as the default. Consult your platform's documentation for more
information.

Separate Components onto Different Storage Devices
``````````````````````````````````````````````````

For improved performance, consider separating your database's data,
journal, and logs onto different storage devices, based on your application's
access and write pattern. Mount the components as separate filesystems
and use symbolic links to map each component's path to the device
storing it.

For the WiredTiger storage engine, you can also store the indexes on a
different storage device. See
:setting:`storage.wiredTiger.engineConfig.directoryForIndexes`.

.. note::

   Using different storage devices will affect your ability to create
   snapshot-style backups of your data, since the files will be on
   different devices and volumes.

.. _virtualized-disks-scheduling:

Scheduling

``````````

Scheduling for Virtual or Cloud Hosted Devices
++++++++++++++++++++++++++++++++++++++++++++++

For local block devices attached to a virtual machine instance via
the hypervisor or hosted by a cloud hosting provider, the guest operating system
should use the :term:`cfq` scheduler for best performance. The
``cfq`` scheduler allows the operating system to defer I/O scheduling to
the underlying hypervisor.

.. note::

   The :term:`noop` scheduler can be used for scheduling if all the 
   following conditions are met:

   - The hypervisor is VMware.
   - A replica set topology or sharded cluster is used.
   - The virtual machines are located on the same virtual host.
   - The underlying storage containing the DBpaths is a common 
     :abbr:`LUN (logical unit number)` blockstore.

Scheduling for Physical Servers
+++++++++++++++++++++++++++++++

For physical servers, the operating system should use a *deadline*
scheduler. The *deadline* scheduler caps maximum latency per request
and maintains a good disk throughput that is best for disk-intensive
database applications.

Architecture
------------

Replica Sets
~~~~~~~~~~~~

See the :ref:`Replica Set Architectures <replica-set-architecture>`
document for an overview of architectural considerations for replica
set deployments.

Sharded Clusters
~~~~~~~~~~~~~~~~

See :ref:`Sharded Cluster Production Architecture
<sharding-shards>` for an
overview of recommended sharded cluster architectures for production
deployments.

.. seealso::

   :doc:`/administration/production-checklist-development`

Compression
-----------

WiredTiger can compress collection data using one of the following
compression library:

- :term:`snappy`
      Provides a lower compression rate than ``zlib`` or
      ``zstd`` but has a lower CPU cost than either.

- :term:`zlib`
      Provides better compression rate than ``snappy`` but has a
      higher CPU cost than both ``snappy`` and ``zstd``.

- :term:`zstd` 
      Provides better compression rate than both ``snappy`` and
      ``zlib`` and has a lower CPU cost than ``zlib``.

By default, WiredTiger uses :term:`snappy` compression library. To
change the compression setting, see
:setting:`storage.wiredTiger.collectionConfig.blockCompressor`.

WiredTiger uses :term:`prefix compression` on all indexes by default.

.. _production-notes-clock-synchronization:

Clock Synchronization
---------------------

MongoDB :ref:`components <mongodb-package-components>` keep logical clocks for
supporting time-dependent operations. Using `NTP <http://www.ntp.org/>`_
to synchronize host machine clocks mitigates the risk of clock drift
between components. Clock drift between components increases the
likelihood of incorrect or abnormal behavior of time-dependent
operations like the following:

- If the underlying system clock of any given MongoDB
  component drifts a year or more from other components in the same
  deployment, communication between those members may become unreliable
  or halt altogether.

  The :parameter:`maxAcceptableLogicalClockDriftSecs` parameter controls
  the amount of acceptable clock drift between components. Clusters with
  a lower value of ``maxAcceptableLogicalClockDriftSecs`` have a
  correspondingly lower tolerance for clock drift.

- Two cluster members with different system clocks may return 
  different values for operations that return the current 
  cluster or system time, such as :method:`Date()`, 
  :variable:`NOW`, and :variable:`CLUSTER_TIME`.

- Features which rely on timekeeping may have inconsistent or
  unpredictable behavior in clusters with clock drift between MongoDB
  components. 

.. _prod-notes-platform-considerations:

Platform Specific Considerations
--------------------------------

MongoDB on Linux
~~~~~~~~~~~~~~~~

.. _prod-notes-linux-file-system:

Kernel and File Systems
```````````````````````

When running MongoDB in production on Linux, you should use Linux
kernel version 2.6.36 or later, with either the XFS or EXT4 filesystem.
If possible, use XFS as it generally performs better with MongoDB.

With the :ref:`WiredTiger storage engine <storage-wiredtiger>`, using
XFS is **strongly recommended** for data bearing nodes to avoid
performance issues that may occur when using EXT4 with WiredTiger.

- In general, if you use the XFS file system, use at least version
  ``2.6.25`` of the Linux Kernel.

  .. Required for fallocate()

- If you use the EXT4 file system, use at least version

``2.6.28`` of the Linux Kernel.

- On Red Hat Enterprise Linux and CentOS, use at least version
  ``2.6.18-194`` of the Linux kernel.

System C Library
````````````````

MongoDB uses the `GNU C Library <http://www.gnu.org/software/libc/>`_
(glibc) on Linux. Generally, each Linux distro provides its own
vetted version of this library. For best results, use the latest update
available for this system-provided version. You can check whether you have
the latest version installed by using your system's package manager. For
example:

- On :abbr:`RHEL (Red Hat Enterprise Linux)` / CentOS, the following
  command updates the system-provided GNU C Library:

  .. code-block:: bash

     sudo yum update glibc

- On Ubuntu / Debian, the following command updates the system-provided
  GNU C Library:

  .. code-block:: bash

     sudo apt-get install libc6

``fsync()`` on Directories
``````````````````````````

.. important::
   MongoDB requires a filesystem that supports ``fsync()``
   *on directories*. For example, HGFS and Virtual Box's shared
   folders do *not* support this operation.

.. _set-swappiness:

Set ``vm.swappiness`` to ``1`` or ``0``
```````````````````````````````````````

"Swappiness" is a Linux kernel setting that influences the behavior of
the Virtual Memory manager. The ``vm.swappiness`` setting ranges from
``0`` to ``100``: the higher the value, the more strongly it prefers
swapping memory pages to disk over dropping pages from RAM.

- A setting of ``0`` disables swapping entirely
  [#swappiness-kernel-version]_.

- A setting of ``1`` permits the kernel to swap only to avoid
  out-of-memory problems.

- A setting of ``60`` tells the kernel to swap to disk often, and is the
  default value on many Linux distributions.

- A setting of ``100`` tells the kernel to swap aggressively to disk.

MongoDB performs best where swapping can be avoided or kept to a
minimum. As such you should set ``vm.swappiness`` to either ``1`` or
``0`` depending on your application needs and cluster configuration.

.. note:: 
   
   Most system and user processes run within a cgroup, which, by default, sets 
   the ``vm.swappiness`` to ``60``. If you are running 
   :abbr:`RHEL (Red Hat Enterprise Linux)` / CentOS, set 
   ``vm.force_cgroup_v2_swappiness`` to ``1`` to ensure that the specified 
   ``vm.swappiness`` value overrides any cgroup defaults.

.. [#swappiness-kernel-version]

   With Linux kernel versions previous to ``3.5``, or
   :abbr:`RHEL (Red Hat Enterprise Linux)` / CentOS kernel versions
   previous to ``2.6.32-303``,  a ``vm.swappiness`` setting of ``0``
   would still allow the kernel to swap in certain emergency situations.

.. note::

   If your MongoDB instance is hosted on a system that also runs other
   software, such as a webserver, you should set ``vm.swappiness`` to
   ``1``. If possible, it is highly recommended that you run MongoDB on
   its own dedicated system.

- To check the current swappiness setting on your system, run:

  .. code-block:: bash

     cat /proc/sys/vm/swappiness

- To change swappiness on your system:

  #. Edit the ``/etc/sysctl.conf`` file and add the following line:

     .. code-block:: bash

        vm.swappiness = 1

  #. Run the following command to apply the setting:

     .. code-block:: bash

        sudo sysctl -p

.. note::

   If you are running RHEL / CentOS and using a ``tuned`` performance
   profile, you must also edit your chosen profile to set
   ``vm.swappiness`` to ``1`` or ``0``.

.. _linux-recommended-configuration:

Recommended Configuration
`````````````````````````

For **all** MongoDB deployments:

- Use the Network Time Protocol (NTP) to synchronize time among
  your hosts. This is especially important in sharded clusters.

For the **WiredTiger** storage engines,
consider the following recommendations:

- Turn off ``atime`` for the storage volume containing the :term:`database
  files <dbpath>`.

- Adjust the ``ulimit`` settings for your platform according to the
  recommendations in the :ref:`ulimit <ulimit>` reference.
  Low ``ulimit`` values will negatively affect MongoDB when under heavy
  use and can lead to failed connections to MongoDB processes and loss
  of service. 

  .. note:: 

     .. include:: /includes/fact-ulimit-minimum.rst

- If you are running MongoDB 8.0, :ref:`enable Transparent Hugepages 
  <enable-thp>`.

  - If you are running MongoDB 7.0 or earlier, :ref:`disable Transparent

Hugepages <disable-thp>`. In earlier versions, MongoDB performs better with 
    typical (4096 bytes) virtual memory pages.

- Disable NUMA in your BIOS. If that is not possible, see
  :ref:`MongoDB on NUMA Hardware <production-numa>`.

- Configure SELinux for MongoDB **if** you are **not** using the
  default MongoDB directory paths or :doc:`ports
  </reference/default-mongodb-port>`.

  .. include:: /includes/fact-selinux-server-side-js.rst

.. _readahead:

For the **WiredTiger** storage engine:

- Set the readahead setting between 8 and 32 regardless of storage
  media type (spinning disk, SSD, etc.).

  Higher readahead commonly benefits sequential I/O operations.
  Since MongoDB disk access patterns are generally random, using higher
  readahead settings provides limited benefit or potential performance
  degradation. As such, for optimal MongoDB performance, set
  readahead between 8 and 32, unless testing shows a measurable,
  repeatable, and reliable benefit in a higher readahead value.
  `MongoDB commercial support 
  <https://support.mongodb.com/welcome?tck=docs_server>`_ can
  provide advice and guidance on alternate readahead configurations.

MongoDB and TLS/SSL Libraries
`````````````````````````````

On Linux platforms, you may observe one of the following statements in
the MongoDB log:

.. code-block:: none

   <path to TLS/SSL libs>/libssl.so.<version>: no version information available (required by /usr/bin/mongod)
   <path to TLS/SSL libs>/libcrypto.so.<version>: no version information available (required by /usr/bin/mongod)

These warnings indicate that the system's TLS/SSL libraries are different
from the TLS/SSL libraries that the :binary:`~bin.mongod` was compiled against.
Typically these messages do not require intervention; however, you can
use the following operations to determine the symbol versions that
:binary:`~bin.mongod` expects:

.. code-block:: bash

   objdump -T <path to mongod>/mongod | grep " SSL_"
   objdump -T <path to mongod>/mongod | grep " CRYPTO_"

These operations will return output that resembles one the of the
following lines:

.. code-block:: none

   0000000000000000      DF *UND*       0000000000000000  libssl.so.10 SSL_write
   0000000000000000      DF *UND*       0000000000000000  OPENSSL_1.0.0 SSL_write

The last two strings in this output are the symbol version and symbol
name. Compare these values with the values returned by the following
operations to detect symbol version mismatches:

.. code-block:: bash

   objdump -T <path to TLS/SSL libs>/libssl.so.1*
   objdump -T <path to TLS/SSL libs>/libcrypto.so.1*

This procedure is neither exact nor exhaustive: many symbols used by
:binary:`~bin.mongod` from the ``libcrypto`` library do not begin with
``CRYPTO_``.

.. _production-virtualization:

MongoDB on Windows
~~~~~~~~~~~~~~~~~~


For MongoDB instances using the WiredTiger storage engine, performance
on Windows is comparable to performance on Linux.

MongoDB on Virtual Environments
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

This section describes considerations when running MongoDB in some of
the more common virtual environments.

For all platforms, consider :ref:`virtualized-disks-scheduling`.

:abbr:`AWS (Amazon Web Services)` :abbr:`EC2 (Elastic Compute Cloud)`
`````````````````````````````````````````````````````````````````````

There are two performance configurations to consider:

- Reproducible performance for performance testing or benchmarking, and
- Raw maximum performance

To tune performance on :abbr:`EC2 (Elastic Compute Cloud)` for either
configuration, you should:

- Enable :abbr:`AWS (Amazon Web Services)`
  `Enhanced Networking <http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/enhanced-networking.html#enabling_enhanced_networking>`_
  for your instance. Not all instance types support Enhanced Networking.

  To learn more about Enhanced Networking, see to the
  `AWS documentation <http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/enhanced-networking.html#enabling_enhanced_networking>`_.

-  Set ``tcp_keepalive_time`` to 120. 

If you are concerned more about reproducible performance on
:abbr:`EC2 (Elastic Compute Cloud)`, you should also:

- Use provisioned :abbr:`IOPS (Input/Output Operations Per Second)`
  for the storage, with separate devices for journal and data. Do not
  use the ephemeral (:abbr:`SSD (Solid State Disk)`) storage available
  on most instance types as their performance changes moment to moment.

(The ``i`` series is a notable exception, but very expensive.)

- Disable :abbr:`DVFS (dynamic voltage and frequency scaling)` and
  :abbr:`CPU (central processing unit)` power saving modes.

  .. seealso::

     `Amazon documentation on Processor State Control <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/processor_state_control.html>`_

- Disable hyperthreading.

  .. seealso::

     `Amazon blog post on disabling Hyper-Threading <https://aws.amazon.com/blogs/compute/disabling-intel-hyper-threading-technology-on-amazon-linux/>`_.

- Use ``numactl`` to bind memory locality to a single socket.

.. _windows-azure-production-notes:

Azure
`````

Use `Premium Storage
<https://azure.microsoft.com/en-us/documentation/articles/storage-premium-storage/>`_.
Microsoft Azure offers two general types of storage:
Standard storage, and Premium storage. MongoDB on Azure has better
performance when using Premium storage than it does with Standard
storage.

VMware
``````

.. include:: /includes/extracts/vm-memory-considerations-vmware.rst

Ensure that virtual machines stay on a specific ESX/ESXi host by
setting VMware's `affinity rules <https://docs.vmware.com/en/VMware-vSphere/7.0/com.vmware.vsphere.resmgmt.doc/GUID-2FB90EF5-7733-4095-8B66-F10D6C57B820.html>`_.
If you must manually migrate a virtual machine
to another host and the :binary:`~bin.mongod` instance on the virtual machine is the
:term:`primary`, you must first :method:`step down <rs.stepDown>` the primary and then
:method:`shut down the instance <db.shutdownServer>`.

Follow the networking best practices for `vMotion
<https://docs.vmware.com/en/VMware-vSphere/7.0/com.vmware.vsphere.vcenterhost.doc/GUID-7DAD15D4-7F41-4913-9F16-567289E22977.html>`_
and `VMKernel
<https://knowledge.broadcom.com/external/article?legacyId=2054994>`_.
Failure to follow the best practices can result in performance problems
and affect :doc:`replica set </core/replica-set-high-availability>` and
:ref:`sharded cluster <sharding-sharded-cluster>` high
availability mechanisms.

You can clone a virtual machine running MongoDB. You might use this
function to deploy a new virtual host to add as a member of a replica
set.

KVM
```

.. include:: /includes/extracts/vm-memory-considerations-kvm.rst

Performance Monitoring
----------------------

iostat
~~~~~~

On Linux, use the ``iostat`` command to check if disk I/O is a bottleneck
for your database. Specify a number of seconds when running iostat to
avoid displaying stats covering the time since server boot.

For example, the following command will display extended statistics and
the time for each displayed report, with traffic in MB/s, at one second
intervals:

.. code-block:: bash

   iostat -xmt 1

Key fields from ``iostat``:

- ``%util``: this is the most useful field for a quick check, it
  indicates what percent of the time the device/drive is in use.

- ``avgrq-sz``: average request size. Smaller number for this value
  reflect more random IO operations.

bwm-ng
~~~~~~

`bwm-ng <http://www.gropp.org/?id=projects&sub=bwm-ng>`_ is a
command-line tool for monitoring network use. If you suspect a
network-based bottleneck, you may use ``bwm-ng`` to begin your
diagnostic process.

Backups
-------

To make backups of your MongoDB database, please refer to
:ref:`MongoDB Backup Methods Overview <backup-methods>`.

.. include:: /includes/unicode-checkmark.rst


---

## 第二部分：运维检查清单 (Operations Checklist)

> 来源: https://www.mongodb.com/docs/manual/administration/production-checklist-operations/


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


---

## 第三部分：UNIX ulimit 配置

> 来源: https://www.mongodb.com/docs/manual/reference/ulimit/


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

