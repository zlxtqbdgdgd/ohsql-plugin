---
source: https://www.hikunpeng.com/doc_center/source/zh/kunpengdbs/ecosystemEnable/MongoDB/
authority: huawei_kunpeng_official
authority_level: ⭐⭐⭐ 华为鲲鹏官方调优指南
title: "鲲鹏BoostKit数据库使能套件 MongoDB 移植&安装&调优指南"
last_verified: 2026-04-11
---

# 鲲鹏BoostKit数据库使能套件 MongoDB 移植&安装&调优指南

> 来源: 华为鲲鹏社区官方 PDF 文档

--- 第 1 页 ---
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
文档版本
04
发布日期
2024-04-30
华为技术有限公司


--- 第 2 页 ---
 
 
版权所有 © 华为技术有限公司 2025。 保留一切权利。
非经本公司书面许可，任何单位和个人不得擅自摘抄、复制本文档内容的部分或全部，并不得以任何形式传
播。
 
商标声明
和其他华为商标均为华为技术有限公司的商标。
本文档提及的其他所有商标或注册商标，由各自的所有人拥有。
 
注意
您购买的产品、服务或特性等应受华为公司商业合同和条款的约束，本文档中描述的全部或部分产品、服务或
特性可能不在您的购买或使用范围之内。除非合同另有约定，华为公司对本文档内容不做任何明示或暗示的声
明或保证。
由于产品版本升级或其他原因，本文档内容会不定期进行更新。除非另有约定，本文档仅作为使用指导，本文
档中的所有陈述、信息和建议不构成任何明示或暗示的担保。
 
 
 
 
 
 
 
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
i


--- 第 3 页 ---
 
 
安全声明
 
漏洞处理流程
华为公司对产品漏洞管理的规定以“漏洞处理流程”为准，该流程的详细内容请参见如下网址：
https://www.huawei.com/cn/psirt/vul-response-process
如企业客户须获取漏洞信息，请参见如下网址：
https://securitybulletin.huawei.com/enterprise/cn/security-advisory
 
 
 
 
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
ii


--- 第 4 页 ---
目 录
1 移植&安装指南........................................................................................................................... 1
1.1 介绍.............................................................................................................................................................................................. 1
1.2 环境要求......................................................................................................................................................................................2
1.3 配置安装环境............................................................................................................................................................................. 3
1.3.1 关闭防火墙.............................................................................................................................................................................. 3
1.3.2 搭建数据盘.............................................................................................................................................................................. 4
1.3.3 配置Yum 源............................................................................................................................................................................4
1.4 安装.............................................................................................................................................................................................. 9
1.4.1 通过源码编译安装................................................................................................................................................................. 9
1.4.1.1 安装依赖包.......................................................................................................................................................................... 9
1.4.1.2 安装libyaml-devel......................................................................................................................................................... 11
1.4.1.3 安装libmpcdec-devel.................................................................................................................................................... 11
1.4.1.4 安装libpcap-devel..........................................................................................................................................................12
1.4.1.5 升级CMake...................................................................................................................................................................... 13
1.4.1.6 升级GCC............................................................................................................................................................................13
1.4.1.7 安装Cython...................................................................................................................................................................... 14
1.4.1.8 安装PyYAML.................................................................................................................................................................... 15
1.4.1.9 安装typing........................................................................................................................................................................16
1.4.1.10 安装Cheetah3...............................................................................................................................................................17
1.4.1.11 编译和安装MongoDB.................................................................................................................................................18
1.4.1.12 编译和安装MongoDB Tools..................................................................................................................................... 21
1.4.2 通过RPM 包安装................................................................................................................................................................ 27
1.5 运行............................................................................................................................................................................................ 28
1.5.1 运行MongoDB....................................................................................................................................................................29
1.5.2 运行MongoDB Tools........................................................................................................................................................ 35
1.6 卸载............................................................................................................................................................................................ 36
1.6.1 卸载MongoDB（通过源码编译安装）........................................................................................................................ 36
1.6.2 卸载MongoDB（通过RPM 包安装）..........................................................................................................................37
1.6.3 卸载MongoDB Tools（通过源码编译安装）.............................................................................................................38
1.6.4 卸载MongoDB Tools（通过RPM 包安装）.............................................................................................................. 38
1.7 故障排除................................................................................................................................................................................... 38
1.7.1 编译MongoDB 时提示code for hash md5 was not found..................................................................................39
1.8 视频帮助................................................................................................................................................................................... 39
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
目 录
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
iii


--- 第 5 页 ---
2 调优指南....................................................................................................................................40
2.1 调优概述................................................................................................................................................................................... 40
2.1.1 调优原则................................................................................................................................................................................40
2.1.2 调优思路................................................................................................................................................................................41
2.2 硬件调优................................................................................................................................................................................... 42
2.2.1 BIOS 调优..............................................................................................................................................................................42
2.3 操作系统调优...........................................................................................................................................................................42
2.3.1 文件系统调优....................................................................................................................................................................... 42
2.3.2 网卡中断绑核....................................................................................................................................................................... 43
2.3.3 网络参数调优....................................................................................................................................................................... 44
2.3.4 IO 参数调优.......................................................................................................................................................................... 45
2.3.5 缓存参数调优....................................................................................................................................................................... 46
2.4 数据库调优............................................................................................................................................................................... 47
2.4.1 数据库参数调优...................................................................................................................................................................47
2.4.2 客户端优化........................................................................................................................................................................... 48
2.4.3 压缩算法调优....................................................................................................................................................................... 49
A 修订记录................................................................................................................................... 50
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
目 录
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
iv


--- 第 6 页 ---
1 移植&安装指南
1.1 介绍
本文主要介绍如何在使用openEuler或CentOS操作系统的鲲鹏服务器上部署
MongoDB，并提供了编译MongoDB过程中遇到故障的解决方法。文中将介绍两种安
装MongoDB的方式：编译安装和RPM安装，请根据实际情况选择其中一种安装方式。
1.2 环境要求
本文基于鲲鹏服务器和CentOS或openEuler操作系统提供指导，在正式操作前请确保
软硬件均满足要求。
1.3 配置安装环境
1.4 安装
1.5 运行
1.6 卸载
1.7 故障排除
1.8 视频帮助
1.1 介绍
本文主要介绍如何在使用openEuler或CentOS操作系统的鲲鹏服务器上部署
MongoDB，并提供了编译MongoDB过程中遇到故障的解决方法。文中将介绍两种安
装MongoDB的方式：编译安装和RPM安装，请根据实际情况选择其中一种安装方式。
简要介绍
MongoDB是一个基于分布式文件存储的数据库。由C++语言编写，旨在为Web应用提
供可扩展的高性能数据存储解决方案。MongoDB是一个介于关系数据库和非关系数据
库之间的产品，是非关系数据库当中功能最丰富，最像关系数据库的。
开发语言：C++
一句话描述：分布式文件存储数据库
建议的版本
MongoDB 3.6.13、MongoDB 4.0.12或MongoDB 6.1.0。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
1


--- 第 7 页 ---
1.2 环境要求
本文基于鲲鹏服务器和CentOS或openEuler操作系统提供指导，在正式操作前请确保
软硬件均满足要求。
硬件要求
硬件要求如表1-1所示。
表1-1 硬件要求
项目
说明
服务器
鲲鹏服务器
处理器
鲲鹏920处理器
硬盘
●进行性能测试时，数据目录需使用单独硬盘，即一个系统
盘，一个数据盘，至少两块硬盘。
●非性能测试时，直接在系统盘上建数据目录即可。
●具体硬盘数量根据实际需求配置。
 
操作系统和软件要求
●
查看环境操作系统的信息：cat /etc/*-release
查看环境处理器相关信息：lscpu
●
如果需要全新安装操作系统，可选择“Minimal Install”安装方式并勾选
Development Tools套件，否则很多软件包需要手动安装。
操作系统和软件要求如表1-2所示。
表1-2 操作系统和软件要求
项目
版本
下载地址
openEuler
20.03 LTS SP1 for ARM
获取链接
22.03 LTS SP1 for ARM
获取链接
CentOS
7.6 for ARM
获取链接
8.1 for ARM
获取链接
CMake
3.4.3及以上
通过Yum源安装
GCC
5.3及以上
通过Yum源安装
Cython
3.0.0a9
获取链接
PyYAML
3.11
获取链接
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
2


--- 第 8 页 ---
项目
版本
下载地址
typing
3.6.1
获取链接
Cheetah3
3.0.0
获取链接
MongoDB
3.6.13
获取链接
4.0.12
获取链接
6.1.0
获取链接
 
说明
●
MongoDB 3.6.13在安装的时候，“/root”分区大小设置不小于100GB；MongoDB 4.0.12在
安装的时候，“/root”分区大小设置不小于50GB;MongoDB 6.1.0在安装的时候，“/root”
分区大小设置不小于500GB
查看“/root”分区大小的命令为：
df -h /root
或者
lsblk
●
MongoDB文件解压并编译后目录大小为133GB，MongoDB编译目录建议大于150GB。
本文档已经验证的MongoDB版本与操作系统版本的配套关系如表1-3所示。
表1-3 已验证的MongoDB 版本与操作系统版本配套关系
MongoDB版本
操作系统版本
●MongoDB 3.6.13
●MongoDB 4.0.12
●openEuler 20.03
●CentOS 7.6
●CentOS 8.1
●MongoDB 3.6.13
●MongoDB 4.0.12
●MongoDB 6.1.0
openEuler 22.03
 
1.3 配置安装环境
1.3.1 关闭防火墙
测试环境下通常需要关闭防火墙以避免部分网络因素影响，请根据实际需求做配置。
步骤1 停止防火墙。
systemctl stop firewalld.service
步骤2 关闭防火墙。
systemctl disable firewalld.service
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
3


--- 第 9 页 ---
说明
关闭防火墙的同时，也取消了防火墙开机自启动功能。
步骤3 查看防火墙状态。
systemctl status firewalld.service
显示Active: inactive (dead)即表示防火墙服务已关闭。
----结束
1.3.2 搭建数据盘
创建数据目录以存储MongoDB的数据文件。
执行如下命令创建数据目录。
mkdir /data
mkdir -p /data/mongo
说明
●
编译数据库以及挂载“/data”数据的时候，请尽量保证目录所在的分区大小不小于50GB。
查看“/root”分区大小的命令为：
df -h /root
或者
lsblk
●
本文档中默认使用“/root”目录进行编译及挂载数据。
1.3.3 配置Yum 源
正确配置Yum源以便于后续能够正常安装所需依赖包和软件。请根据网络情况和使用
的操作系统类型选择配置Yum源方法。
说明
●
如果环境可以访问外网，CentOS操作系统请参见配置外网Yum源（CentOS），openEuler
操作系统请参见配置外网Yum源（openEuler）。
●
如果环境无法访问外网，请参见配置本地Yum源（CentOS&openEuler）。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
4


--- 第 10 页 ---
配置外网Yum 源（CentOS）
步骤1 使用curl命令访问任意网站，若能显示网站信息则表示代理配置成功，可以访问外
网。
步骤2 查看Yum源，如果存在外网Yum源（存在后缀为.repo的文件），则直接执行步骤6。
ls /etc/yum.repos.d/
步骤3 备份Yum源至bak目录。
cd /etc/yum.repos.d
mkdir bak
mv *.repo bak
步骤4 配置外网Yum源。
●
CentOS 7.6：
wget -O /etc/yum.repos.d/CentOS-Base.repo https://mirrors.huaweicloud.com/repository/conf/CentOS-
AltArch-7.repo
●
CentOS 8.1：
wget -O /etc/yum.repos.d/CentOS-Base.repo https://repo.huaweicloud.com/repository/conf/CentOS-8-
reg.repo
说明
如果未安装wget，执行以下命令安装wget。
yum -y install wget
步骤5 查看Yum源。
●
CentOS 7.6：
ls /etc/yum.repos.d/
cat /etc/yum.repos.d/CentOS-Base.repo
●
CentOS 8.1：
sed -i "s/\$releasever/8-stream/g" /etc/yum.repos.d/CentOS-Base.repo
cat /etc/yum.repos.d/CentOS-Base.repo
步骤6 使Yum源生效。
yum clean all
yum makecache
yum list
----结束
配置外网Yum 源（openEuler）
步骤1 使用curl命令访问任意网站，若能显示网站信息则表示代理配置成功，可以访问外
网。
步骤2 查看Yum源，如果存在外网Yum源（存在后缀为.repo的文件），则直接执行步骤7。
ls /etc/yum.repos.d/
步骤3 备份Yum源至bak目录。
cd /etc/yum.repos.d
mkdir bak
mv *.repo bak
步骤4 打开文件。
vi /etc/yum.repos.d/openEuler.repo
步骤5 按“i”进入编辑模式。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
5


--- 第 11 页 ---
●
如果操作系统为openEuler 20.03，则将文件内容修改为如下所示。
[OS]
name=OS
baseurl=http://repo.openeuler.org/openEuler-20.03-LTS-SP1/OS/$basearch/
enabled=1
gpgcheck=1
gpgkey=http://repo.openeuler.org/openEuler-20.03-LTS-SP1/OS/$basearch/RPM-GPG-KEY-openEuler
[EPOL]
name=EPOL
baseurl=http://repo.openeuler.org/openEuler-20.03-LTS-SP1/EPOL/update/$basearch/
enabled=1
gpgcheck=1
gpgkey=http://repo.openeuler.org/openEuler-20.03-LTS-SP1/OS/$basearch/RPM-GPG-KEY-openEuler
[debuginfo]
name=debuginfo
baseurl=http://repo.openeuler.org/openEuler-20.03-LTS-SP1/debuginfo/$basearch/
enabled=1
gpgcheck=1
gpgkey=http://repo.openeuler.org/openEuler-20.03-LTS-SP1/debuginfo/$basearch/RPM-GPG-KEY-
openEuler
[source]
name=source
baseurl=http://repo.openeuler.org/openEuler-20.03-LTS-SP1/source/
enabled=1
gpgcheck=1
gpgkey=http://repo.openeuler.org/openEuler-20.03-LTS-SP1/source/RPM-GPG-KEY-openEuler
[update]
name=update
baseurl=http://repo.openeuler.org/openEuler-20.03-LTS-SP1/update/$basearch/
enabled=1
gpgcheck=1
gpgkey=http://repo.openeuler.org/openEuler-20.03-LTS-SP1/OS/$basearch/RPM-GPG-KEY-openEuler
[everything]
name=everything
baseurl=http://repo.openeuler.org/openEuler-20.03-LTS-SP1/everything/$basearch/
enabled=1
gpgcheck=1
gpgkey=http://repo.openeuler.org/openEuler-20.03-LTS-SP1/everything/$basearch/RPM-GPG-KEY-
openEuler
●
如果操作系统为openEuler 22.03，则将文件内容修改为如下所示。
[OS]
name=OS
baseurl=http://repo.openeuler.org/openEuler-22.03-LTS-SP1/OS/$basearch/
enabled=1
gpgcheck=1
gpgkey=http://repo.openeuler.org/openEuler-22.03-LTS-SP1/OS/$basearch/RPM-GPG-KEY-openEuler
[everything]
name=everything
baseurl=http://repo.openeuler.org/openEuler-22.03-LTS-SP1/everything/$basearch/
enabled=1
gpgcheck=1
gpgkey=http://repo.openeuler.org/openEuler-22.03-LTS-SP1/everything/$basearch/RPM-GPG-KEY-
openEuler
[EPOL]
name=EPOL
baseurl=http://repo.openeuler.org/openEuler-22.03-LTS-SP1/EPOL/main/$basearch/
enabled=1
gpgcheck=1
gpgkey=http://repo.openeuler.org/openEuler-22.03-LTS-SP1/OS/$basearch/RPM-GPG-KEY-openEuler
[debuginfo]
name=debuginfo
baseurl=http://repo.openeuler.org/openEuler-22.03-LTS-SP1/debuginfo/$basearch/
enabled=1
gpgcheck=1
gpgkey=http://repo.openeuler.org/openEuler-22.03-LTS-SP1/debuginfo/$basearch/RPM-GPG-KEY-
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
6


--- 第 12 页 ---
openEuler
[source]
name=source
baseurl=http://repo.openeuler.org/openEuler-22.03-LTS-SP1/source/
enabled=1
gpgcheck=1
gpgkey=http://repo.openeuler.org/openEuler-22.03-LTS-SP1/source/RPM-GPG-KEY-openEuler
[update]
name=update
baseurl=http://repo.openeuler.org/openEuler-22.03-LTS-SP1/update/$basearch/
enabled=1
gpgcheck=1
gpgkey=http://repo.openeuler.org/openEuler-22.03-LTS-SP1/OS/$basearch/RPM-GPG-KEY-openEuler
[update-source]
name=update-source
baseurl=http://repo.openeuler.org/openEuler-22.03-LTS-SP1/update/source/
enabled=1
gpgcheck=1
gpgkey=http://repo.openeuler.org/openEuler-22.03-LTS-SP1/source/RPM-GPG-KEY-openEuler
步骤6 按“Esc”键，输入:wq!，按“Enter”保存并退出编辑。
步骤7 使Yum源生效。
yum clean all
yum makecache
yum list
----结束
配置本地Yum 源（CentOS&openEuler）
步骤1 下载OS镜像文件。
操作系统镜像下载地址：
●
openEuler 22.03 LTS SP1镜像
●
openEuler 20.03 LTS SP1镜像
●
CentOS 7.6镜像
●
CentOS 8.1镜像
步骤2 挂载OS镜像文件。
●
方法一：上传OS镜像文件至“/root”路径，并挂载OS镜像文件至“/mnt”目录
下。
–
CentOS 7.6：
mount /root/CentOS-7-aarch64-Everything-1810.iso /mnt
–
CentOS 8.1：
mount /root/CentOS-8.1.1911-aarch64-dvd1.iso /mnt
–
openEuler 20.03：
mount /root/openEuler-20.03-LTS-SP1-everything-aarch64-dvd.iso /mnt
–
openEuler 22.03：
mount /root/openEuler-22.03-LTS-SP1-everything-aarch64-dvd.iso /mnt
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
7


--- 第 13 页 ---
说明
iso文件名请根据实际情况修改，该操作单次生效，重启后失效，可执行下列操作开机
自动挂载OS镜像文件。
1. 打开fstab文件。
vim /etc/fstab
2. 按“i”进入编辑模式，在文件末尾添加如下信息。
○
CentOS 7.6：
/root/CentOS-7-aarch64-Everything-1810.iso /mnt iso9660 loop 0 0
○
CentOS 8.1：
/root/CentOS-8.1.1911-aarch64-dvd1.iso /mnt iso9660 loop 0 0
○
openEuler 20.03：
/root/openEuler-20.03-LTS-SP1-everything-aarch64-dvd.iso /mnt iso9660 loop 0 0
○
openEuler 22.03：
/root/openEuler-22.03-LTS-SP1-everything-aarch64-dvd.iso /mnt iso9660 loop 0 0
3. 按“Esc”键，输入:wq!，按“Enter”保存并退出编辑。
●
方法二：使用浏览器登录BMC，通过KVM加载OS镜像文件。
a.
查看OS镜像对应的设备符号。
ls /dev/sr*
b.
将OS镜像文件挂载至“/mnt”目录下。
mount /dev/sr0 /mnt
df -h | grep /mnt
ls /mnt/
说明
/dev/sr0为OS镜像对应的设备符号，需要跟步骤2.a中查看的设备符号保持一致。
步骤3 备份Yum源。
cd /etc/yum.repos.d
mkdir bak
mv *.repo bak
步骤4 配置本地Yum源。
1.
进入“/etc/yum.repos.d”目录。
cd /etc/yum.repos.d
2.
创建local.repo文件。
a.
打开local.repo文件。
vim local.repo
b.
按“i”进入编辑模式，在文件中添加如下内容。
[local]
name=local.repo
baseurl=file:///mnt
enabled=1
gpgcheck=0
说明
其中，baseurl中file路径为镜像挂载路径，与步骤步骤2的挂载目录“/mnt”对应。
c.
按“Esc”键，输入:wq!，按“Enter”保存并退出编辑。
d.
查看local.repo文件。
cat local.repo
步骤5 使Yum源生效。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
8


--- 第 14 页 ---
yum clean all
yum makecache
yum list
----结束
1.4 安装
1.4.1 通过源码编译安装
1.4.1.1 安装依赖包
安装依赖包的作用是为编译和安装MongoDB提供必要的依赖和环境。
●
当操作系统为CentOS 7.6、CentOS 8.1或openEuler 20.03，且安装的MongoDB
版本为3.6.13或4.0.12时，使用如下安装命令安装依赖包。
cd ~
yum -y install gcc gcc-c++ cmake wget net-tools libyaml python2 python2-setuptools libcurl-devel 
python2-devel gmp gmp-devel mpfr mpfr-devel libmpc libpcap net-tools
开始回显:
结束回显:
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
9


--- 第 15 页 ---
●
当操作系统为openEuler 22.03，且安装的MongoDB版本为6.1.0时，使用如下安
装命令安装依赖包。
cd ~
yum -y install gcc gcc-c++ cmake wget net-tools libyaml python3 python3-setuptools libcurl-devel 
python3-devel gmp gmp-devel mpfr mpfr-devel libmpc libpcap net-tools
pip3 install jsonschema memory_profiler puremagic networkx cxxfilt requirements_parser
●
当操作系统为openEuler 22.03，且安装的MongoDB版本为3.6.13或4.0.12时，由
于openEuler 22.03版本操作系统已停止支持和维护Python 2，无法通过Yum源安
装Python2及其管理工具，需要手动编译安装。详细操作步骤请参见通过源码安装
Python、通过源码安装setuptools和通过源码安装pip。
通过源码安装Python
步骤1 下载并解压Python源码包。
wget https://www.python.org/ftp/python/2.7.10/Python-2.7.10.tgz
tar -zxvf Python-2.7.10.tgz
步骤2 进入解压后的Python源码目录。
cd Python-2.7.10
步骤3 执行configure脚本，设置Python安装路径。
./configure --prefix=/usr/local/python-2.7.10
步骤4 编译安装Python。
make && make install
----结束
通过源码安装setuptools
步骤1 下载setuptools源码包。
wget https://files.pythonhosted.org/
packages/b2/40/4e00501c204b457f10fe410da0c97537214b2265247bc9a5bc6edd55b9e4/
setuptools-44.1.1.zip
步骤2 解压setuptools源码包。
unzip setuptools-44.1.1.zip
步骤3 进入setuptools源码目录。
cd setuptools-44.1.1
步骤4 编译安装setuptools。
python2 setup.py install
----结束
通过源码安装pip
步骤1 下载pip源码包。
wget https://files.pythonhosted.org/packages/0b/f5/
be8e741434a4bf4ce5dbc235aa28ed0666178ea8986ddc10d035023744e6/pip-20.2.4.tar.gz
步骤2 解压pip源码包。
tar zxvf pip-20.2.4.tar.gz
步骤3 进入pip源码目录。
cd pip-20.2.4
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
10


--- 第 16 页 ---
步骤4 编译安装pip。
python2 setup.py install
----结束
1.4.1.2 安装libyaml-devel
MongoDB需要libyaml-devel依赖包来支持使用YAML格式的配置文件。
步骤1 下载libyaml-devel的RPM包。
wget http://mirror.centos.org/centos/8-stream/PowerTools/aarch64/os/Packages/libyaml-
devel-0.1.7-5.el8.aarch64.rpm --no-check-certificate
步骤2 安装libyaml-devel。
yum install -y libyaml-devel-0.1.7-5.el8.aarch64.rpm
说明
使用yum install命令安装RPM包会自适配当前RPM的版本，建议使用当前方式安装。
----结束
1.4.1.3 安装libmpcdec-devel
安装libmpcdec-devel的作用是为了支持MongoDB的Snappy压缩算法。Snappy压缩算
法是一种快速的压缩算法，它在压缩和解压缩数据时都非常快速，并且能够在保持压
缩率的同时大幅度提高数据的读取速度。MongoDB使用Snappy压缩算法来压缩数据
文件，可以提高数据读取性能。
步骤1 下载libmpcdec-devel-1.2.6。
wget http://mirror.centos.org/centos/8-stream/PowerTools/aarch64/os/Packages/libmpcdec-
devel-1.2.6-20.el8.aarch64.rpm --no-check-certificate
步骤2 安装libmpcdec-devel。
yum install -y libmpcdec-devel-1.2.6-20.el8.aarch64.rpm
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
11


--- 第 17 页 ---
说明
使用yum install命令安装RPM包会自适配当前RPM的版本，建议使用当前方式安装。
----结束
1.4.1.4 安装libpcap-devel
安装libpcap-devel的作用是为了支持MongoDB的网络侦听功能。libpcap-devel是一个
网络数据包捕获库，它提供了一组API，可以在Linux系统中捕获和处理网络数据包。
MongoDB使用这个库来侦听网络流量并捕获MongoDB协议的数据包。
步骤1 下载libpcap-devel-1.9.1-5。
wget http://mirror.centos.org/centos/8-stream/PowerTools/aarch64/os/Packages/libpcap-
devel-1.9.1-5.el8.aarch64.rpm --no-check-certificate
步骤2 安装libpcap-devel。
yum install -y libpcap-devel-1.9.1-5.el8.aarch64.rpm
说明
●
libpcap-devel是编译和安装MongoDB Tools过程需要的依赖包。
●
使用yum install命令安装RPM包会自适配当前RPM的版本，建议使用当前方式安装。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
12


--- 第 18 页 ---
----结束
1.4.1.5 升级CMake
为了确保编译过程中使用的CMake版本符合MongoDB的要求，需要升级CMake。
CMake版本要求3.4.3或者以上。若CMake版本低于3.4.3，需要升级CMake。
步骤1 查看CMake版本。
cmake --version
说明
查看CMake版本时，如果提示“cmake: symbol lookup error: cmake: undefined symbol:
archive_write_add_filter_zstd”，安装如下依赖即可解决。
yum install -y libarchive
步骤2 可选: 如果需要升级CMake，请参见升级CMake。
----结束
1.4.1.6 升级GCC
为了避免编译和安装过程中出现错误，需要升级GCC。GCC版本要求5.3或者以上。若
GCC版本低于5.3，需要升级GCC。
步骤1 查看GCC版本。
gcc --version
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
13


--- 第 19 页 ---
步骤2 可选: 如果需要升级GCC，请参见升级GCC。
----结束
1.4.1.7 安装Cython
Cython主要用于编译MongoDB的Python驱动程序pymongo，以提高MongoDB的性
能和稳定性。为了使MongoDB正常编译安装，需要安装Cython依赖。
步骤1 进入“/root”目录。
cd /root
步骤2 克隆Git代码仓库中的Cython。
说明
如果执行git clone命令失败，请将github.com替换为github.com.cnpmjs.org后再执行下载命
令。
git config --global http.sslVerify false
git clone -b 3.0.0a9 https://github.com/cython/cython.git
步骤3 安装Cython。
●
当安装的MongoDB版本为3.6.13或4.0.12时，使用如下安装命令。
cd /root/cython
python2 setup.py install
●
当安装的MongoDB版本为6.1.0时，使用如下安装命令。
cd /root/cython
python3 setup.py install
开始回显：
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
14


--- 第 20 页 ---
结束回显：
----结束
1.4.1.8 安装PyYAML
安装PyYAML的作用是为了在MongoDB的配置文件中使用PyYAML库来正确地解析和
读取YAML格式的配置文件。
步骤1 进入“/root”目录。
cd /root
步骤2 克隆Git代码仓库中的PyYAML。
说明
如果执行git clone命令失败，请将github.com替换为github.com.cnpmjs.org后再执行下载命
令。
git clone -b 3.11 https://github.com/yaml/pyyaml.git
步骤3 安装PyYAML。
●
当安装的MongoDB版本为3.6.13或4.0.12时，使用如下安装命令。
cd /root/pyyaml
python2 setup.py install
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
15


--- 第 21 页 ---
●
当安装的MongoDB版本为6.1.0时，使用如下安装命令。
cd /root/pyyaml
python3 setup.py install
开始回显：
结束回显：
----结束
1.4.1.9 安装typing
typing是Python的子模块，为了使MongoDB正常编译安装，需要安装typing依赖。
步骤1 进入“/root”目录。
cd /root
步骤2 克隆Git代码仓库中的typing。
说明
如果执行git clone命令失败，请将github.com替换为github.com.cnpmjs.org后再执行下载命
令。
git clone -b 3.6.1 https://github.com/python/typing.git
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
16


--- 第 22 页 ---
步骤3 安装typing。
●
当安装的MongoDB版本为3.6.13或4.0.12时，使用如下安装命令。
cd /root/typing
python2 setup.py install
●
当安装的MongoDB版本为6.1.0时，使用如下安装命令：
cd /root/typing
python3 setup.py install
----结束
1.4.1.10 安装Cheetah3
Cheetah3是Python的子模块，为了使MongoDB正常编译安装，需要安装Cheetah3依
赖。
步骤1 进入“/root”目录。
cd /root
步骤2 克隆Git代码仓库中的Cheetah3 。
说明
如果执行git clone命令失败，请将github.com替换为github.com.cnpmjs.org后再执行下载命
令。
git clone -b 3.0.0 https://github.com/CheetahTemplate3/cheetah3.git
步骤3 安装Cheetah3 。
●
当安装的MongoDB版本为3.6.13或4.0.12时，使用如下安装命令。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
17


--- 第 23 页 ---
cd /root/cheetah3
python2 setup.py install
●
当安装的MongoDB版本为6.1.0时，使用如下安装命令。
cd /root/cheetah3
python3 setup.py install
开始回显：
结束回显：
----结束
1.4.1.11 编译和安装MongoDB
下文以MongoDB 3.6.13版本为例描述通过源码编译和安装MongoDB的操作步骤，其
他版本的MongoDB也可参考本章节。
以下命令中，“3.6.13”表示MongoDB的版本号。安装其他版本的MongoDB时，请
将“3.6.13”替换为对应的MongoDB版本号。
步骤1 下载MongoDB源码包。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
18


--- 第 24 页 ---
cd /root
wget https://github.com/mongodb/mongo/archive/r3.6.13.tar.gz --no-check-certificate
说明
如果执行wget命令失败，请将github.com替换为github.com.cnpmjs.org后再执行下载命令。
步骤2 解压MongoDB源码包。
mv r3.6.13.tar.gz mongo-r3.6.13.tar.gz
tar -xvf mongo-r3.6.13.tar.gz
步骤3 进入“/root/mongo-r3.6.13”源码文件夹。
cd mongo-r3.6.13
步骤4 编译MongoDB。编译时间大概持续10~15分钟。
须知
执行编译的目录空间必须足够大，大于100GB。
●
当MongoDB版本为3.6.13或4.0.12时，使用如下编译命令。
python2 buildscripts/scons.py MONGO_VERSION=3.6.13 all CFLAGS="-march=armv8-a+crc -
mtune=generic" -j 96 --disable-warnings-as-errors
●
当MongoDB版本为6.1.0时，则跳过当前步骤，直接执行步骤5中的安装命令。
说明
-j 96参数表示充分利用CPU多核优势，加快编译速度。参数-j后数字为CPU核数，可通过cat /
proc/cpuinfo | grep processor | wc -l命令进行查看，此数值应小于等于CPU核数。
开始回显：
结束回显：
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
19


--- 第 25 页 ---
步骤5 安装MongoDB。
●
当安装的MongoDB版本为3.6.13或4.0.12时，使用如下安装命令，通过prefix选项
指定安装目录。
mkdir /usr/local/mongo
python2 buildscripts/scons.py MONGO_VERSION=3.6.13 --prefix=/usr/local/mongo --disable-warnings-
as-errors CFLAGS="-march=armv8-a+crc" install -j 64
●
当安装的MongoDB版本为6.1.0时，则使用如下安装命令，通过DESTDIR选项指定
安装目录。
mkdir /usr/local/mongo
python3 buildscripts/scons.py MONGO_VERSION=6.1.0 DESTDIR=/usr/local/mongo install-all-meta 
CFLAGS="-march=armv8-a+crc -mtune=generic" -j 96 --disable-warnings-as-errors
说明
-j 64与-j 96参数表示充分利用CPU多核优势，加快编译速度。参数-j后数字为CPU核数，可
通过cat /proc/cpuinfo | grep processor | wc -l命令进行查看，此数值应小于等于CPU核
数。
开始回显：
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
20


--- 第 26 页 ---
结束回显：
安装完成后，在“/usr/local/mongo”下会自动生成bin目录。执行如下命令查看bin目
录下的内容。
ll /usr/local/mongo/bin
步骤6 删除调试信息。
cd /usr/local/mongo/bin
strip mongos
strip mongod
strip mongo
----结束
1.4.1.12 编译和安装MongoDB Tools
下文以MongoDB 3.6.13版本为例描述通过源码编译和安装MongoDB Tools的操作步
骤，其他版本的MongoDB也可参考本章节。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
21


--- 第 27 页 ---
以下命令中，“3.6.13”表示MongoDB的版本号。安装其他版本的MongoDB时，请
将“3.6.13”替换为对应的MongoDB版本号。
步骤1 下载Go编译器源码包。
cd /root
wget https://dl.google.com/go/go1.13.5.linux-arm64.tar.gz
步骤2 解压Go源码包到“/usr/local”目录下。
tar -C /usr/local -xzf go1.13.5.linux-arm64.tar.gz
ls /usr/local/go
步骤3 设置Go编译器环境变量。
1.
配置环境变量。
a.
打开profile文件。
vim /etc/profile
b.
按“i”进入编辑模式，在文件末尾加入内容。
export PATH=$PATH:/usr/local/go/bin
export GOROOT="/usr/local/go"
c.
按“Esc”键，输入:wq!，按“Enter”保存并退出编辑。
2.
使环境变量生效。
source /etc/profile
3.
查看Go编译器环境变量是否设置成功。
go env
步骤4 查看Go编译器版本。
whereis go
/usr/local/go/bin/go version
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
22


--- 第 28 页 ---
步骤5 下载MongoDB Tools源码包。
cd /root 
wget https://github.com/mongodb/mongo-tools/archive/r3.6.13.tar.gz --no-check-certificate
说明
如果执行wget命令失败，请将github.com替换为github.com.cnpmjs.org后再执行下载命令。
步骤6 解压MongoDB Tools源码包。
mv r3.6.13.tar.gz mongo-tools-r3.6.13.tar.gz
tar -xvf mongo-tools-r3.6.13.tar.gz
ll mongo-tools-r3.6.13
步骤7 设置MongoDB Tools环境变量。
cd /root/mongo-tools-r3.6.13
chmod +x set_goenv.sh
source set_goenv.sh
ls
步骤8 变更MongoDB Tools的编译目录。
解压后的目录是mongo-tools-r3.6.13，需要进行如下操作更换目录结构，否则编译会
报错。
在mongo-tools-r3.6.13的同级目录下（本文档是“/root”）执行如下命令：
cd /root
mkdir -p mongodb-tools-3.6.13/src/github.com/mongodb
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
23


--- 第 29 页 ---
mv mongo-tools-r3.6.13 mongodb-tools-3.6.13/src/github.com/mongodb/mongo-tools
ls
步骤9 下载解压gopacket，替换MongoDB Tools的gopacket。
1.
下载gopacket。
cd /root 
wget https://github.com/google/gopacket/archive/master.zip --no-check-certificate
说明
如果执行wget命令失败，请将github.com替换为github.com.cnpmjs.org后再执行下载命
令。
2.
解压gopacket。
unzip master.zip
ll gopacket-master
3.
替换MongoDB Tools的gopacket。
ls /root/mongodb-tools-3.6.13/src/github.com/mongodb/mongo-tools/vendor/github.com/google/
gopacket/
rm -rf /root/mongodb-tools-3.6.13/src/github.com/mongodb/mongo-tools/vendor/github.com/google/
gopacket/
mv gopacket-master /root/mongodb-tools-3.6.13/src/github.com/mongodb/mongo-tools/vendor/
github.com/google/gopacket
ls /root/mongodb-tools-3.6.13/src/github.com/mongodb/mongo-tools/vendor/github.com/google/
gopacket/
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
24


--- 第 30 页 ---
步骤10 建立GCC软链接。
1.
查看GCC路径以及版本。
whereis gcc
/usr/bin/gcc --version
2.
创建并查看GCC软链接。
mkdir -p /opt/mongodbtoolchain/v3/bin
ln -s /usr/bin/gcc /opt/mongodbtoolchain/v3/bin/aarch64-mongodb-linux-gcc
ll /opt/mongodbtoolchain/v3/bin/aarch64-mongodb-linux-gcc
说明
–
aarch64-mongodb-linux-gcc：待创建的软链接文件名称。
–
/opt/mongodbtoolchain/v3/bin：软链接文件的存放路径。
–
/usr/bin/gcc：软链接文件所链接的源文件。
–
如果需要删除软链接，请执行如下命令，其中“/opt/mongodbtoolchain/v3/bin/
aarch64-mongodb-linux-gcc”为创建的软链接文件。
rm -rf /opt/mongodbtoolchain/v3/bin/aarch64-mongodb-linux-gcc
步骤11 编译安装MongoDB Tools。
cd /root/mongodb-tools-3.6.13/src/github.com/mongodb/mongo-tools/
./build.sh
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
25


--- 第 31 页 ---
查看生成的二进制可执行文件。
ll /root/mongodb-tools-3.6.13/src/github.com/mongodb/mongo-tools/bin
步骤12 验证MongoDB Tools命令是否正常。本文以mongostat和mongoexport为例进行说
明。
/root/mongodb-tools-3.6.13/src/github.com/mongodb/mongo-tools/bin/mongostat --version
/root/mongodb-tools-3.6.13/src/github.com/mongodb/mongo-tools/bin/mongoexport --version
/root/mongodb-tools-3.6.13/src/github.com/mongodb/mongo-tools/bin/mongodump --version
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
26


--- 第 32 页 ---
----结束
1.4.2 通过RPM 包安装
下文以MongoDB 3.6.13版本为例描述通过RPM包安装MongoDB和MongoDB Tools的
操作步骤，其他版本的MongoDB也可参考本章节。
步骤1 下载MongoDB的RPM包。
表1-4 支持通过RPM 包安装的MongoDB 版本与RPM 包下载链接
软件版本
操作系统
RPM包下载链接
MongoDB 3.6.13
CentOS 8.1
●获取链接1
●获取链接2
MongoDB 4.0.12
CentOS 7.6
●获取链接1
●获取链接2
CentOS 8.1
●获取链接1
●获取链接2
 
步骤2 安装依赖包。
cd ~
yum -y install python2 python2-setuptools python2-devel net-tools
步骤3 将安装包上传至服务器“/root”目录下。
cd /root
wget https://mirrors.huaweicloud.com/kunpeng/yum/el/8/aarch64/Packages/database/
mongodb-3.6.13-1.el8.aarch64.rpm --no-check-certificate
wget https://mirrors.huaweicloud.com/kunpeng/yum/el/8/aarch64/Packages/database/mongodb-
tools-3.6.13-1.el8.aarch64.rpm --no-check-certificate
步骤4 安装MongoDB和MongoDB Tools的RPM包。
rpm -ivh mongodb-3.6.13-1.el8.aarch64.rpm
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
27


--- 第 33 页 ---
rpm -ivh mongodb-tools-3.6.13-1.el8.aarch64.rpm
步骤5 查看安装后的MongoDB和MongoDB Tools的RPM包。
rpm -qa | grep mongodb-3.6.13
rpm -qa | grep mongodb-tools-3.6.13
步骤6 查看安装后的MongoDB和MongoDB Tools的路径。
ll /usr/local/mongo/bin/
ll /usr/local/mongodb-tools/bin/
----结束
1.5 运行
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
28


--- 第 34 页 ---
1.5.1 运行MongoDB
以下内容是关于运行、配置、启动、登录和验证MongoDB数据库的详细步骤。
步骤1 查看MongoDB版本。
cd ~
find / -name mongod
/usr/local/mongo/bin/mongod --version
步骤2 修改MongoDB的配置文件。
1.
删除并新建“/etc/mongodb.cnf”文件。
rm -f /etc/mongodb.cnf
vim /etc/mongodb.cnf
2.
按“i”进入编辑模式，添加如下内容:
dbpath=/data/mongo
logpath=/data/mongo/mongo.log
logappend=true
port=27017
fork=true
auth=false
bind_ip=0.0.0.0
说明
配置文件参数说明：
–
dbpath代表数据文件存放目录。
–
logpath代表日志文件存放目录。
–
logappend=true代表日志以追加的形式添加。
–
port代表端口号。
–
fork=true代表以守护程序的方式启用，即在后台运行。
–
auth=false代表连接数据库不需要验证用户名和密码。
–
bind_ip代表可以访问的地址。127.0.0.1表示自己访问，0.0.0.0 表示所有人都能访问。
3.
按“Esc”键，输入:wq!，按“Enter”保存并退出编辑。
步骤3 启动MongoDB数据库。
1.
使用配置文件启动MongoDB数据库。
nohup /usr/local/mongo/bin/mongod -f /etc/mongodb.cnf &
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
29


--- 第 35 页 ---
2.
确认MongoDB数据库进程是否正常启动。
ps -ef | grep mongod
可以看到数据库进程ID为36249且已正常启动。
3.
查看MongoDB数据库的监测端口。
netstat -anpt
在本例中MongoDB数据库的监测端口为27017。
步骤4 登录MongoDB数据库并验证数据库是否可以正常运行。
1.
本地登录MongoDB数据库。
cd /usr/local/mongo/bin
./mongo
说明
查看登录参数。
/usr/local/mongo/bin/mongo --h
/usr/local/mongo/bin/mongo --help
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
30


--- 第 36 页 ---
2.
查看当前存在的数据库。
show dbs
3.
创建数据库。
use mongotest-database
show dbs
说明
–
使用use DATABASE_NAME创建数据库，如果数据库不存在，则创建数据库，否则切换
到指定数据库。
–
可以看到刚才创建的数据库mongotest-database并不在数据库的列表中，要显示新增
的数据库，需要向mongotest-database数据库插入一些数据。
4.
创建集合。
use mongotest-database
show collections
db.createCollection("mongo_test")
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
31


--- 第 37 页 ---
说明
如果要查看已有集合，可以使用show collections或show tables命令。
show collections
show tables
5.
插入文档。
db.mongo_test.insert({title: 'MongoDB 教程',
... description: 'MongoDB 是一个 Nosql 数据库',
... by: 'xx教程',
... url: 'http://www.xxxxxx.com',
... tags: ['mongodb', 'database', 'NoSQL'],
... likes: 100
... })
以上实例中mongo_test是集合名，如果该集合不在数据库中，MongoDB会自动
创建集合并插入文档。
查看已插入文档：
db.mongo_test.find()
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
32


--- 第 38 页 ---
6.
更新文档。
通过update（）方法来更新文档标题（title）。
db.mongo_test.update({'title':'MongoDB 教程'},{$set:{'title':'MongoDB'}})
db.mongo_test.find()
7.
删除title为“MongoDB”的文档。
db.mongo_test.remove({'title':'MongoDB'})
db.mongo_test.find()
8.
查看并创建索引。
db.mongo_test.getIndexes()
db.mongo_test.createIndex({"title_test":1})
db.mongo_test.getIndexes()
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
33


--- 第 39 页 ---
9.
删除步骤4.8新增的索引“title_test_1”。
db.mongo_test.dropIndex("title_test_1")
10. 删除集合。
use mongotest-database
show collections
db.mongo_test.drop()
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
34


--- 第 40 页 ---
11. 删除数据库。
use mongotest-database
show dbs
db.dropDatabase()
步骤5 退出数据库。
exit
----结束
1.5.2 运行MongoDB Tools
以下内容是关于如何进入MongoDB Tools的安装目录以及如何验证MongoDB Tools中
的命令是否正常。
步骤1 进入bin目录。
●
源码安装。
cd /root/mongodb-tools-3.6.13/src/github.com/mongodb/mongo-tools/bin
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
35


--- 第 41 页 ---
●
RPM安装。
cd /usr/local/mongodb-tools/bin/
步骤2 验证MongoDB Tools命令是否正常。本文以mongorestore和mongoreplay为例进行说
明。
./mongorestore --version
./mongorestore --help
./mongoreplay --version
./mongoreplay --help
----结束
1.6 卸载
1.6.1 卸载MongoDB（通过源码编译安装）
请根据安装MongoDB的方式选择对应的卸载方式。如果是通过源码编译安装的
MongoDB，请按照本章节的操作指导卸载MongoDB。
步骤1 查看并关闭数据库进程。在本例中，36249为MongoDB程序的ID，请根据实际情况填
写。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
36


--- 第 42 页 ---
ps -ef | grep mongod
kill -9 36249
步骤2 删除数据库的软件安装目录和数据目录。
rm -rf /usr/local/mongo
rm -rf /data/mongo
----结束
1.6.2 卸载MongoDB（通过RPM 包安装）
请根据安装MongoDB的方式选择对应的卸载方式。如果是通过RPM包安装的
MongoDB，请按照本章节的操作指导卸载MongoDB。
步骤1 查看并关闭数据库进程。在本例中，112876为MongoDB程序的ID，请根据实际情况
填写。
ps -ef | grep mongod
kill -9 112876
步骤2 卸载数据库RPM包。
以下命令中，“3.6.13”表示MongoDB的版本号。安装其他版本的MongoDB时，请
将“3.6.13”替换为对应的MongoDB版本号。
rpm -qa | grep mongodb-3.6.13
rpm -e mongodb-3.6.13-1.el8.aarch64
步骤3 删除数据库的软件安装目录和数据目录。
ll /usr/local/mongo/
ll /data
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
37


--- 第 43 页 ---
rm -rf /usr/local/mongo/
rm -rf /data
----结束
1.6.3 卸载MongoDB Tools（通过源码编译安装）
请根据安装MongoDB Tools的方式选择对应的卸载方式。如果是通过源码编译安装的
MongoDB Tools，请按照本章节的操作指导卸载MongoDB Tools。
以下命令中，“3.6.13”表示MongoDB的版本号。安装其他版本的MongoDB时，请
将“3.6.13”替换为对应的MongoDB版本号。
删除MongoDB Tools的安装目录。
ll /root/mongodb-tools-3.6.13
rm -rf /root/mongodb-tools-3.6.13
ll /root/mongodb-tools-3.6.13
1.6.4 卸载MongoDB Tools（通过RPM 包安装）
请根据安装MongoDB Tools的方式选择对应的卸载方式。如果是通过RPM包安装的
MongoDB Tools，请按照本章节的操作指导卸载MongoDB Tools。
以下命令中，“3.6.13”表示MongoDB的版本号。安装其他版本的MongoDB时，请
将“3.6.13”替换为对应的MongoDB版本号。
步骤1 卸载MongoDB Tools。
rpm -qa | grep mongodb-tools
rpm -e mongodb-tools-3.6.13-1.el8
步骤2 删除安装目录。
ll /usr/local/mongodb-tools/
rm -rf /usr/local/mongodb-tools/
----结束
1.7 故障排除
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
38


--- 第 44 页 ---
1.7.1 编译MongoDB 时提示code for hash md5 was not found
问题现象描述
编译MongoDB时提示“ERROR:root:code for hash md5 was not found.”。
关键过程、根本原因分析
Python没有成功安装hashlib模块。
结论、解决方案及效果
步骤1 下载hashlib源码包，并对hashlib进行编译安装。
wget https://files.pythonhosted.org/packages/74/bb/
9003d081345e9f0451884146e9ea2cff6e4cc4deac9ffd4a9ee98b318a49/hashlib-20081119.zip
unzip hashlib-20081119.zip
cd hashlib-20081119
python2 setup.py install
步骤2 重新编译MongoDB。
----结束
1.8 视频帮助
安装MongoDB的操作视频请参见：
●
如何安装MongoDB（openEuler 20.03）
●
如何安装MongoDB（CentOS 8.1）
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
1 移植&安装指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
39


--- 第 45 页 ---
2 调优指南
2.1 调优概述
2.2 硬件调优
2.3 操作系统调优
2.4 数据库调优
2.1 调优概述
2.1.1 调优原则
性能调优是一个涉及多个层面的复杂过程，从硬件和操作系统的选择到子系统的设计
和算法选择，都需要仔细考虑。在调优过程中，必须遵循一定的原则以确保得到正确
的结果。
性能调优从大的方面来说，在系统设计之初，需要考虑硬件的选择、操作系统的选择
以及基础软件的选择；从小的方面来说，包括每个子系统的设计、算法选择、如何使
用编译器的选项，以及如何发挥硬件最大的性能等。
性能优化原则主要有以下几个方面：
●
对性能进行分析时，需要从多方面分析系统的资源瓶颈所在。因为系统如果在某
一方面性能低，也许不是系统本身的原因，而是受到其他因素的影响。例如，
CPU利用率100%可能是内存容量过小、CPU忙于处理内存调度的原因所导致的。
●
一次只对影响性能的某方面的一个参数进行调整，如果对多个参数同时进行调
整，将难以界定影响性能的真正原因。
●
进行系统性能分析时，性能分析工具本身会占用一定的系统资源，如CPU资源、
内存资源等，因此分析工具本身运行可能会导致系统某方面的资源瓶颈情况更加
严重。
●
必须确保调优后的程序运行正确。
●
调优过程是持续的过程，每一次调优的结果都需要反馈到后续的版本开发中去。
●
性能调优不能以牺牲代码的可读性和可维护性为代价。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
2 调优指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
40


--- 第 46 页 ---
2.1.2 调优思路
调优思路主要围绕精准定位问题、分析性能瓶颈以及选择优化方法展开。
性能优化首先需要较为精准地定位问题，分析系统性能瓶颈，然后根据其性能指标以
及所处层级选择优化的方式。
具体的调优思路和分析过程如图2-1所示。
图2-1 调优思路
调优分析思路如下：
1.
很多情况下压测流量并没有完全进入到服务端，在网络上可能就会出现由于各种
规格（带宽、最大连接数、新建连接数等）限制，导致压测结果达不到预期的情
况。
2.
接着看关键指标是否满足要求，如果不满足，需要确定是哪个地方有问题，一般
情况下，服务器端问题可能性比较大，也有可能是客户端问题（这种情况比较
少）。
3.
对于服务器端问题，需要定位的是硬件相关指标，例如CPU、Memory、Disk
IO、Network IO，如果是某个硬件指标有问题，需要深入地进行分析。
4.
如果硬件指标都没有问题，需要查看数据库相关指标，例如：等待事件、内存命
中率等。
5.
如果以上指标都正常，应用程序的算法、缓冲、缓存、同步或异步可能有问题，
需要具体深入地分析。
瓶颈点
说明
硬件/规格
一般指的是CPU、内存、磁盘IO方面的问题，分为服务器硬件瓶
颈、网络瓶颈（对局域网可以不考虑）。
操作系统
一般指的是Windows、UNIX、Linux等操作系统。例如，在进行性
能测试，出现物理内存不足时，虚拟内存设置也不合理，虚拟内
存的交换效率就会大大降低，从而导致行为的响应时间大大增
加，这时认为操作系统上出现性能瓶颈。
数据库
一般指的是数据库配置等方面的问题。例如，由于参数配置不合
理，导致数据库处理速度慢的问题，可认为是数据库层面的问
题。
 
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
2 调优指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
41


--- 第 47 页 ---
2.2 硬件调优
2.2.1 BIOS 调优
目的
对于不同的硬件设备，通过在BIOS中设置一些高级选项，可以有效提升服务器性能。
方法
SMMU（System Memory Management Unit）是IO设备与总线桥之间的一个地址转
换桥，可以实现虚拟地址到物理地址的转换，同时还可以对内存访问进行权限控制和
缓存管理，确保系统内存的安全和高效使用。因为数据库通常会使用大量的内存和IO
资源，而SMMU会增加额外的开销和延迟，从而降低系统的性能。因此在数据库场
景，开启SMMU并不能获得更好的性能。此外，关闭SMMU还可以减少系统的复杂性
和维护成本。因此在鲲鹏平台，建议在BIOS中将SMMU关闭。
硬件预取是通过跟踪指令和数据地址的变化，将指令和地址提前读到Cache里，硬件预
取对数据库场景的性能有影响，建议在BIOS中将预取功能关闭。
步骤1 关闭SMMU（System Memory Management Unit）。
说明
此优化项只在非虚拟化场景使用，在虚拟化场景，则开启SMMU。
1.
重启服务器，进入BIOS设置界面。
具体操作请参见《TaiShan 服务器 BIOS 参数参考（鲲鹏920处理器）》中“进入
BIOS界面”的相关内容。
2.
选择“Advanced > MISC Config”，按“Enter”键进入。
3.
将“Support Smmu”设置为“Disable”。
步骤2 关闭预取。
1.
在BIOS中，选择“Advanced>MISC Config”，按“Enter”键进入。
2.
将“CPU Prefetching Configuration”设置为“Disabled”，按“F10”键保存退
出。
----结束
2.3 操作系统调优
2.3.1 文件系统调优
目的
通过调整文件系统相关参数配置，可以有效提升服务器性能。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
2 调优指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
42


--- 第 48 页 ---
方法
说明
以XFS文件系统为例，解释文件系统调优步骤。
建议在文件系统的mount参数上加上noatime、nobarrier两个选项，其中数据盘以及
数据目录以实际为准。
mount -o noatime,nobarrier /dev/sdb /data
1.
一般来说，Linux会给文件记录以下三个时间：
–
access time指文件最后一次被读取的时间。
–
modify time指的是文件的文本内容最后发生变化的时间。
–
change time指的是文件的inode最后发生变化（比如位置、用户属性、组属
性等）的时间。
通常情况下，我们对文件的操作更多是读取而不是写入，而且我们很少需要关注
一个文件最近被访问的时间。因此，我们建议使用noatime选项，这样文件系统在
程序访问文件或文件夹时，不会更新对应的访问时间。文件系统不再记录访问时
间，可以避免不必要的资源浪费。
2.
许多文件系统在数据提交时会使用write barriers来强制刷新Cache，以避免数据
丢失。但是，其实我们数据库服务器底层存储设备要么采用RAID控制卡，RAID控
制卡本身的电池可以掉电保护；要么采用Flash卡，它也有自我保护机制，保证数
据不会丢失。在这种情况下，我们可以安全地使用nobarrier挂载文件系统，以避
免write barriers的性能损失。
–
对于ext3、ext4和reiserfs文件系统可以在mount时指定barrier=0。
–
对于XFS可以指定nobarrier选项。
说明
openEuler不支持nobarrier选项。
2.3.2 网卡中断绑核
目的
手动绑定网卡中断，根据网卡所属CPU将其进行分配，从而优化系统网络性能。
须知
进行网卡中断绑核之前，需要先关闭irqbalance。
方法
步骤1 停止irqbalance服务。
systemctl stop irqbalance.service
步骤2 关闭irqbalance服务。
systemctl disable irqbalance.service
步骤3 查看irqbalance服务状态是否已关闭。
systemctl status irqbalance.service
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
2 调优指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
43


--- 第 49 页 ---
状态为inactive即为关闭。
步骤4 网卡中断绑核。
对于不同的硬件配置，用于绑中断的最佳CPU数目会有差异，比如对于鲲鹏920 5250
处理器 + Huawei TM280 25G网卡（鲲鹏服务器的板载网卡）来说，最多可以绑定32
个中断队列，建议将所有的队列都用在中断绑定上来获得最佳性能。
以下脚本是在鲲鹏920 5250处理器 + Huawei TM280 25G网卡上的最佳绑中断设置。
#!/bin/bash
eth1=$1
cnt=$2
bus=$3
ethtool -L $eth1 combined $cnt
irq1=`cat /proc/interrupts| grep -E ${bus} | head -n$cnt | awk -F ':' '{print $1}'`
irq1=`echo $irq1`
cpulist=(0 1 2 3 4 5 6 7 {51..71} 93 94 95)
c=0
for irq in $irq1
do
    echo ${cpulist[c]} "->" $irq
    echo ${cpulist[c]} > /proc/irq/$irq/smp_affinity_list
    let "c++"
done
脚本中第一个参数$1是网卡名称，第二个参数$2是队列数目32，第三个参数$3是网卡
对应的总线名。
●
网卡名称可通过如下命令查询。
ip a
●
队列数目可以通过如下命令查询获得。
ethtool -l 网卡名称
●
总线名可以通过如下命令查询获得。
ethtool -i 网卡名称
步骤5 恢复irqbalance服务。
systemctl start irqbalance.service
systemctl enable irqbalance.service
----结束
2.3.3 网络参数调优
目的
对于不同的操作系统，通过在OS层面调整网络参数的配置，可以有效提升服务器性
能。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
2 调优指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
44


--- 第 50 页 ---
方法
Linux参数
参数含义
默认值
建议值
tcp_max_syn_ba
cklog
tcp_max_syn_backlog是指定
所能接收SYN同步包的最大客
户端数量。
2048
建议修改成
“8192”。
net.core.somaxc
onn
服务端所能accept即处理数据
的最大客户端数量，即完成连
接上限。
128
建议修改成
“1024”。
net.core.rmem_
max
接收套接字缓冲区大小的最大
值。单位为字节。
229376
建议修改成
“16777216”。
net.core.wmem_
max
发送套接字缓冲区大小的最大
值。单位为字节。
229376
建议修改成
“16777216”。
net.ipv4.tcp_rme
m
配置读缓冲区的大小，共三个
值，第一个是这个读缓冲区的
最小值，第三个是最大值，中
间的是默认值。
4096
87380
6291456
建议修改成
“4096 87380
16777216”。
net.ipv4.tcp_wm
em
配置写缓冲区的大小，共三个
值，第一个是这个写缓冲区的
最小值，第三个是最大值，中
间的是默认值。
4096
16384
4194304
建议修改成
“4096 65536
16777216”。
net.ipv4.tcp_max
_tw_buckets
表示系统同时保持TIME_WAIT
套接字的最大数量。
262144
建议修改成
“360000”。
 
修改命令
echo "8192" > /proc/sys/net/ipv4/tcp_max_syn_backlog
echo "1024" > /proc/sys/net/core/somaxconn
echo "16777216" > /proc/sys/net/core/rmem_max
echo "16777216" > /proc/sys/net/core/wmem_max
echo "4096 87380 16777216" > /proc/sys/net/ipv4/tcp_rmem
echo "4096 65536 16777216" > /proc/sys/net/ipv4/tcp_wmem
echo "360000" > /proc/sys/net/ipv4/tcp_max_tw_buckets
2.3.4 IO 参数调优
目的
对于不同的IO设备，通过在OS层面调整一些IO相关参数配置，可以有效提升服务器性
能。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
2 调优指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
45


--- 第 51 页 ---
方法
Linux参数
参数含义
建议值
/sys/block/${device}/
queue/scheduler
配置IO调度，deadline或
者noop更适用于MySQL数
据库场景。
命令中的${device}为磁盘
名称，使用ls -l /sys/
block/查看该目录下存在
的磁盘设备名称，根据实
际磁盘名称进行修改。
须知
NVMe盘不支持此操作。
将指定块设备的IO调度器
设置为“deadline”。
/sys/block/${device}/
queue/nr_requests
提升磁盘吞吐量，可以调
整到更大。
命令中的${device}为磁盘
名称，使用ls -l /sys/
block/查看该目录下存在
的磁盘设备名称，根据实
际磁盘名称进行修改。
将指定设备的IO请求队列
长度设置为“2048”。
 
修改命令
echo deadline > /sys/block/${device}/queue/scheduler
echo 2048 > /sys/block/${device}/queue/nr_requests
2.3.5 缓存参数调优
目的
对于不同系统的内存使用情况，通过在OS层面调整一些缓存相关参数配置，可以有效
提升服务器性能。
方法
通过设置以下系统参数进行调优。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
2 调优指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
46


--- 第 52 页 ---
表2-1 缓存调优参数
Linux参数
参数含义
操作
swappine
ss
值越大，越积极使用交换分区；
值越小，越积极使用内存。
将vm.swappiness设置为较低值
“1”，以减少交换分区的使用。
1. 打开文件。
vim /etc/sysctl.conf
2. 按“i”进入编辑模式，将如下信
息添加到文件底部。
vm.swappiness = 1
3. 按“Esc”键，输入:wq!，按
“Enter”保存并退出编辑。
4. 使修改生效。
sysctl -p
dirty_ratio
内存里的脏数据百分比不能超过
这个值。
将dirty_ratio参数设置为“5”。
echo 5 > /proc/sys/vm/dirty_ratio
 
2.4 数据库调优
2.4.1 数据库参数调优
目的
通过调整数据库的配置参数，可以有效提升数据库的性能和可靠性。
方法
请参见表2-2修改数据库的配置文件。配置文件默认为“/etc/mongodb.cnf”，修改配
置文件后需重启数据库生效。
表2-2 数据库参数调优建议
参数
说明
建议
cacheSizeGB
cacheSizeGB参数控制
WiredTiger引擎使用内存上限。
如果一台机器只部署一个
MongoDB，建议设置成内存的
60%。
Oplog
Oplog用于MongoDB的复制。
建议大小设置为可用disk空间的
5%。
commitInterv
alMs
控制MongoDB的journal日志刷
新。
建议使用默认值，值越大，性能
越好，但数据丢失可能性更大。
syncPeriodSec
s
控制flush到磁盘的时间间隔。
建议使用默认值，值越大，性能
越好，但影响数据库可靠性。
noprealloc
是否启用数据文件预分配。
建议设置为true。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
2 调优指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
47


--- 第 53 页 ---
参数
说明
建议
noscripting
是否启用脚本引擎。
建议设置为true。
notablescan
是否允许表扫描。
建议设置为true。
 
2.4.2 客户端优化
目的
通过在OS层面调整一些参数配置，可以有效提升客户端网络性能。
方法
步骤1 打开“/etc/sysctl.conf”文件。
vim /etc/sysctl.conf
步骤2 按“i”进入编辑模式，增加以下内容。
net.ipv4.ip_local_port_range = 1024     65535
net.ipv4.tcp_tw_reuse = 1
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 8096
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_max_tw_buckets = 3000
表2-3 网络调优参数
参数
说明
net.ipv4.tcp_tw_reuse
允许将TIME-WAIT sockets重新用于新的TCP连接。
●0：关闭（default）
●1：开启
net.ipv4.ip_local_port_
range
用于向外连接的端口范围。
net.core.somaxconn
定义了系统中每一个端口最大的监测队列的长度，这是个
全局的参数，默认值为128。
net.core.netdev_max_
backlog
每个网络接口接收数据包的速率比内核处理这些包的速率
快时，允许送到队列的数据包的最大数目。
net.ipv4.tcp_max_syn_
backlog
表示那些尚未收到客户端确认信息的连接（SYN消息）队
列的长度，默认为1024，加大队列长度为262144，可以容
纳更多等待连接的网络连接数。
net.ipv4.tcp_keepalive
_time
表示如果套接字由本端要求关闭，这个参数决定了它保持
在FIN-WAIT-2状态的时间，默认为2小时。
net.ipv4.tcp_fin_timeo
ut
表示开启TCP连接中TIME-WAIT sockets的快速回收，默认
为0，表示关闭。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
2 调优指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
48


--- 第 54 页 ---
参数
说明
net.ipv4.tcp_max_tw_
buckets
表示系统同时保持TIME_WAIT sockets的最大数量，默认
为180000。
 
步骤3 按“Esc”键，输入:wq!，按“Enter”保存并退出编辑。
步骤4 使修改结果立即生效。
sysctl -p
----结束
2.4.3 压缩算法调优
目的
针对Snappy热点函数CPU占用较高的场景，通过升级Snappy压缩算法版本，可以有效
提升服务器性能。
方法
步骤1 下载最新版本的Snappy源码。
步骤2 解压下载的Snappy源码，并替换MongoDB源码中的老版本Snappy。
tar xvf snappy-1.1.7.tar.gz
cp snappy-1.1.7/* /home/mongodb-r4.0.12/src/third_party/snappy-1.1.3/
步骤3 重新编译MongoDB。
----结束
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
2 调优指南
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
49


--- 第 55 页 ---
A 修订记录
发布日期
修订记录
2024-04-30
第四次正式发布。
●新增支持在openEuler 22.03操作系统下部署MongoDB
3.6.13、MongoDB 4.0.12或MongoDB 6.1.0。
●移植指南和安装指南合并为移植&安装指南。
2021-12-28
第三次正式发布。
新增支持在CentOS 8.1操作系统下部署MongoDB 3.6.13或
MongoDB 4.0.12。
2021-06-30
第二次正式发布。
新增支持在openEuler 20.03操作系统下部署MongoDB 3.6.13
或MongoDB 4.0.12。
2019-08-15
第一次正式发布。
鲲鹏BoostKit 数据库使能套件
MongoDB 移植&安装&调优指南
A 修订记录
文档版本 04 (2024-04-30)
版权所有 © 华为技术有限公司
50
