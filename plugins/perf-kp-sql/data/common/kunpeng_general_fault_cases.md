---
source: https://www.hikunpeng.com/doc_center/source/zh/kunpenggrf/
authority: huawei_kunpeng_official
authority_level: ⭐⭐⭐ 华为鲲鹏官方文档
title: "鲲鹏通用故障案例"
description: "涵盖高性能网络、磁盘IO等通用性能调优失败案例"
last_verified: 2026-04-11
---

# 鲲鹏通用故障案例

> 来源: 华为鲲鹏社区官方 PDF 文档
> 涵盖高性能网络、磁盘IO等通用性能调优失败案例

--- 第 1 页 ---
鲲鹏通用
故障案例
文档版本
01
发布日期
2024-06-18
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
 
 
 
 
 
 
 
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
i


--- 第 3 页 ---
 
 
安全声明
 
漏洞处理流程
华为公司对产品漏洞管理的规定以“漏洞处理流程”为准，该流程的详细内容请参见如下网址：
https://www.huawei.com/cn/psirt/vul-response-process
如企业客户须获取漏洞信息，请参见如下网址：
https://securitybulletin.huawei.com/enterprise/cn/security-advisory
 
 
 
 
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
ii


--- 第 4 页 ---
目 录
1 在鲲鹏服务器上使用WinSCP 无法上传文件的解决方法....................................................... 1
2 编译Scalpel 时提示undefined reference to rpl_malloc 的解决方法.............................. 2
3 编译CMake 时提示internal compiler error 的解决方法................................................... 3
4 Lmbench.stream 测试工具编译失败的解决方法................................................................... 5
5 运行SPECCpu 2017 提示'unrecognized option '-mabi=lp64'..........................................7
6 Euler OS 下编译fio 2.1.10 提示collect2: error: ld returned 1 exit status 的解决方法
.......................................................................................................................................................11
7 SPECCpu 2006 连跑提示libstdc++.so.6 cannot open shared object............................14
8 鲲鹏服务器上编译netperf 工具时提示“无法确认系统架构类型”的解决方法............... 16
9 编译gfortran 提示Nonnegative width required in format string at (1)的解决方法
.......................................................................................................................................................18
10 编译libnice 时gst 插件的libgstnice 动态库无法生成问题的解决方法..........................19
11 CentOS 7.6 ARM 系统vmcore 文件无法解析...................................................................21
A 修订记录................................................................................................................................... 23
鲲鹏通用
故障案例
目 录
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
iii


--- 第 5 页 ---
1 在鲲鹏服务器上使用WinSCP 无法上传文件
的解决方法
问题现象描述
连接UniVPN后，打开WinSCP工具输入鲲鹏服务器的IP地址和用户密码，进行文件上
传操作，但上传速度很慢，10s后提示失败。
关键过程、根本原因分析
可能是由于网络不稳定原因导致文件上传失败。
结论、解决方案及效果
1.
如果是传输大文件，建议选用WinSCP，可以不间断传输。
2.
通常情况下，采用UniVPN客户端上传速度2~4M/s，下载速度1M/s左右（下载较
差）；采用SecoClient客户端上传速度2~3M/s，下载速度6~10M/s（特别快）。
说明
以上数据为华为蓝区Guest网实测结果，可能还会受用户本地带宽网速、实时流量、用户本
地防火墙限速等影响。
3.
如果出现传输中断问题，大概率是因为电脑休眠虚拟网卡不工作导致VPN断开导
致。建议根据实际情况修改电源设置，设置电脑不休眠。
鲲鹏通用
故障案例
1 在鲲鹏服务器上使用WinSCP 无法上传文件的解决方
法
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
1


--- 第 6 页 ---
2 编译Scalpel 时提示undefined reference
to rpl_malloc 的解决方法
问题现象描述
使用make命令编译Scalpel过程中提示“undefined reference to rpl_malloc”。
关键过程、根本原因分析
查找“rpl_malloc”参数定义的位置。
grep -R "rpl_malloc"
confefs.h文件内有重define，交叉编译时，autotools认为工具链的libc中不包含malloc
和realloc，建议删除“define malloc rpl_malloc”，“define realloc rpl_realloc”。
结论、解决方案及效果
步骤1 打开configure文件。
步骤2 将$as_echo "define malloc rpl_malloc" >>confdefs.h和$as_echo "define realloc
rpl_realloc" >>confdefs.h删除后保存并退出。
步骤3 重新执行编译命令。
----结束
鲲鹏通用
故障案例
2 编译Scalpel 时提示undefined reference to
rpl_malloc 的解决方法
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
2


--- 第 7 页 ---
3 编译CMake 时提示internal compiler
error 的解决方法
问题现象描述
在鲲鹏服务器CentOS 7.6操作系统上安装KVM虚拟机，分配20vCPU、3GB内存的情况
下，执行make -j 20命令编译CMake时，提示“g++: internal compiler error: Killed
(program cc1plus)”。
关键过程、根本原因分析
运行时观察虚拟机资源，发现内存不够用了，而虚拟机没有配置SWAP分区。
编译CMake消耗CPU和内存资源，在编译卡顿时，需要观察CPU和内存资源，如果不
够用需要及时添加。
结论、解决方案及效果
尝试增加虚拟机内存。当前用的虚拟机是mysql虚拟机。
鲲鹏通用
故障案例
3 编译CMake 时提示internal compiler error 的解决
方法
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
3


--- 第 8 页 ---
步骤1 编辑虚拟机配置文件。
# virsh edit mysql
步骤2 修改成16GB内存。
步骤3 重启虚拟机。
说明
执行virsh reboot后无法使内存修改生效。
# virsh shutdown mysql
# virsh start mysql
重新进入虚拟机，已经分配了16GB内存。
步骤4 再次编译CMake正常。
----结束
鲲鹏通用
故障案例
3 编译CMake 时提示internal compiler error 的解决
方法
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
4


--- 第 9 页 ---
4 Lmbench.stream 测试工具编译失败的解决
方法
问题现象描述
环境配置：
硬件配置
鲲鹏服务器（鲲鹏916处理器，8*32G，DDR4 2400MHz）
测试工具
Lmbench.stream测试工具
操作系统与
软件
CentOS 7.6，GCC 7.3.0，glibc 2.2.8
 
问题描述：
Lmbench.stream软件解压后，编译失败，提示：
/tmp/ccid4aB6.o：在函数‘seekto’中：disk.c:(.text+0x44)：对‘llseek’未定义的引用
/tmp/ccid4aB6.o：在函数‘seekto’中：disk.c:(.text+0x44)：对‘llseek’未定义的引用
collect2: 错误：ld 返回 1
gmake[2]: *** [../bin//disk] Error 1
gmake[2]: Leaving directory   `/home/username/lmbench3/src'
make[1]: *** [lmbench] Error 2
make[1]: Leaving directory   `/home/username/lmbench3/src'
make: *** [build] Error 2
关键过程、根本原因分析
分析过程：
1.
首先从提示信息已经很明确的反应出问题的发生点即在disk.c文件中seekto函数中
llseek参数未定义就引用。
2.
在本地搜索出该源代码的位置./src/disk.c，打开源码文件并搜索出llseek的位置。
seekto(int fd, uint64 off)
{
#ifdef  __linux__
        extern  loff_t llseek(int, loff_t, int);
 
        if (llseek(fd, (loff_t)off, SEEK_SET) == (loff_t)-1) {
                return(-1);
        }
鲲鹏通用
故障案例
4 Lmbench.stream 测试工具编译失败的解决方法
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
5


--- 第 10 页 ---
        return (0);
#else
        uint64  here = 0;
 
        lseek(fd, 0, 0);
        while ((uint64)(off - here) > (uint64)BIGSEEK) {
                if (lseek(fd, BIGSEEK, SEEK_CUR) == -1) break;
                here += BIGSEEK;
        }
        assert((uint64)(off - here) <= (uint64)BIGSEEK);
        if (lseek(fd, (int)(off - here), SEEK_CUR) == -1) return (-1);
        return (0);
#endif
3.
将问题代码拷贝出来，简单写一个main函数单独编译。
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <sys/types.h>
#include <unistd.h>
#include <stdlib.h>
 
int main(int argc, char **argv)
{
int fd = 0;
int off = 0;
#if 1
if (llseek(fd, (loff_t)off, SEEK_SET) == (loff_t)-1) {
                return(-1);
        }
        return 0;
#endif
}
根本原因分析：大数据重新定位读/写文件偏移量时，llseek接口函数在GCC 7.3.0编译
器中被lseek64替代。
结论、解决方案及效果
将测试工具的disk.c源码文件中的llseek接口函数全部替换成lseek64，重新编译。
鲲鹏通用
故障案例
4 Lmbench.stream 测试工具编译失败的解决方法
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
6


--- 第 11 页 ---
5 运行SPECCpu 2017 提示'unrecognized
option '-mabi=lp64'
问题现象描述
环境配置：
类别
子项
版本
硬件
CPU
鲲鹏920处理器
网络
Ethernet-GE
存储
SATA 4TB
内存
-
操作系统
CentOS
7.6.0
Kernel
-
软件
SPECCpu
2017
 
问题描述：
在CentOS 7.6上运行SPECCpu 2017的测试命令./runcpu -c ../config/Example-gcc-
linux-aarch64.cfg intrate时，提示“'unrecognized option '-mabi=lp64'”。
鲲鹏通用
故障案例
5 运行SPECCpu 2017 提示'unrecognized option '-
mabi=lp64'
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
7


--- 第 12 页 ---
关键过程、根本原因分析
从上述截图中看不到具体原因，查看文件benchspec/CPU/999.specrand_ir/build/
build_base_mytest-64.0000/make.out中的信息，发现有错误打印gcc: error:
unrecognized command line option '-mabi=lp64'，经确认GCC是系统自带的GCC
4.8.5，该GCC版本不支持-mabi=lp64编译选项，需要升级GCC版本。
结论、解决方案及效果
需要升级GCC版本，推荐升级到GCC 7.3.0。
升级GCC
步骤1 下载GCC 7.3.0版本软件包。
wget https://mirrors.tuna.tsinghua.edu.cn/gnu/gcc/gcc-7.3.0/gcc-7.3.0.tar.gz --no-check-certificate
步骤2 解压源码包。
tar -xf gcc-7.3.0.tar.gz
步骤3 配置。
cd gcc-7.3.0
./contrib/download_prerequisites
上述命令会下载依赖包“gmp-6.1.0.tar.bz2”、“isl-0.16.1.tar.bz2”、
“mpc-1.0.3.tar.gz”或“mpfr-3.1.4.tar.bz2”，如果某依赖包下载失败，可根据需要
执行相应的命令下载，然后重新执行./contrib/download_prerequisites命令配置。
wget https://gcc.gnu.org/pub/gcc/infrastructure/gmp-6.1.0.tar.bz2 --no-check-certificate
wget https://gcc.gnu.org/pub/gcc/infrastructure/isl-0.16.1.tar.bz2 --no-check-certificate
wget https://gcc.gnu.org/pub/gcc/infrastructure/mpc-1.0.3.tar.gz --no-check-certificate
wget https://gcc.gnu.org/pub/gcc/infrastructure/mpfr-3.1.4.tar.bz2 --no-check-certificate
步骤4 创建gcc-7.3.0_build目录，配置GCC。
mkdir gcc-7.3.0_build
cd gcc-7.3.0_build
../configure --prefix=/usr/local/gcc-7.3.0 --mandir=/usr/share/man --infodir=/usr/share/info --enable-
bootstrap --enable-shared --enable-threads=posix --enable-checking=release --with-system-zlib --enable-
__cxa_atexit --disable-libunwind-exceptions --enable-gnu-unique-object --enable-linker-build-id --with-
鲲鹏通用
故障案例
5 运行SPECCpu 2017 提示'unrecognized option '-
mabi=lp64'
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
8


--- 第 13 页 ---
linker-hash-style=gnu --enable-languages=c,c++,objc,obj-c++,fortran,lto --enable-plugin --enable-initfini-
array --disable-libgcj
步骤5 编译安装GCC。
make -j 96
make -j96 install
步骤6 配置环境变量。
1.
打开profile文件。
vi /etc/profile
2.
增加如下配置。
PATH=/usr/local/gcc-7.3.0/bin:$PATH
3.
使配置生效。
source /etc/profile
步骤7 将libstdc++.so.6添加到uar/lib64目录下。
rm -rf /lib64/libstdc++.so.6
cp /usr/local/gcc-7.3.0/lib64/libstdc++.so.6.0.24 /usr/lib64
步骤8 制作软连接。
cd /usr/lib64
ln -s libstdc++.so.6.0.24 libstdc++.so.6
步骤9 在/etc/ld.so.conf文件中增加如下内容。
/usr/local/gcc-7.3.0/lib64
步骤10 使配置生效。
ldconfig
----结束
GCC/G++/C++全局增加-fsigned-char编译选项
增加-fsigned-char编译选项是因为在ARM和x86架构上针对char类型理解有差异，x86
架构上默认识别char是无符号类型，ARM架构上默认识别是有符号类型，所以需要增
加编译选项。
同步把/bin目录下gcc/g++/c++也修改为如下。
步骤1 查看GCC安装目录。
[root@localhost target]# which gcc
/usr/local/gcc-7.3.0/bin/gcc
步骤2 备份原来的gcc文件。
mv /usr/local/gcc-7.3.0/bin/gcc /usr/local/gcc-7.3.0/bin/gcc-arm
步骤3 新建gcc文件。
vi /usr/local/gcc-7.3.0/bin/gcc
步骤4 输入如下内容保存。
#!/bin/sh
gcc-arm -fsigned-char "$@"
步骤5 修改gcc文件权限。
chmod 755 /usr/local/gcc-7.3.0/bin/gcc
步骤6 验证GCC版本。
gcc -v
----结束
鲲鹏通用
故障案例
5 运行SPECCpu 2017 提示'unrecognized option '-
mabi=lp64'
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
9


--- 第 14 页 ---
说明
同样的步骤修改g++和c++。由于环境变量中优先取“/usr/local/gcc-7.3.0/bin”目录，实际/bin/
gcc、/bin/c++、/bin/g++脚本中重定向到“/usr/local/gcc-7.3.0/bin”下的文件。
cd /bin
mv gcc gcc-arm
mv g++ g++-arm
mv c++ c++-arm
cp /usr/local/gcc-7.3.0/bin/gcc ./
cp /usr/local/gcc-7.3.0/bin/g++ ./
cp /usr/local/gcc-7.3.0/bin/c++ ./
鲲鹏通用
故障案例
5 运行SPECCpu 2017 提示'unrecognized option '-
mabi=lp64'
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
10


--- 第 15 页 ---
6 Euler OS 下编译fio 2.1.10 提示collect2:
error: ld returned 1 exit status 的解决方法
问题现象描述
在鲲鹏服务器上安装Euler for ARM系统，编译fio执行make后提示“collect2: error: ld
returned 1 exit status”。
关键过程、根本原因分析
无
结论、解决方案及效果
步骤1 修改os-linux.h，在os-linux.h文件中添加头文件。
#include <sys/sysmacros.h>
鲲鹏通用
故障案例
6 Euler OS 下编译fio 2.1.10 提示collect2: error: ld
returned 1 exit status 的解决方法
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
11


--- 第 16 页 ---
步骤2 重新执行make && make install，编译安装成功。
鲲鹏通用
故障案例
6 Euler OS 下编译fio 2.1.10 提示collect2: error: ld
returned 1 exit status 的解决方法
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
12


--- 第 17 页 ---
步骤3 查看fio版本。
----结束
鲲鹏通用
故障案例
6 Euler OS 下编译fio 2.1.10 提示collect2: error: ld
returned 1 exit status 的解决方法
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
13


--- 第 18 页 ---
7 SPECCpu 2006 连跑提示libstdc++.so.6
cannot open shared object
问题现象描述
环境配置：
类别
子项
版本
硬件
CPU
鲲鹏920处理器
网络
1822网卡
存储
SATA 4T
内存
-
操作系统
CentOS
7.6
Kernel
4.14.0-115.el7a.0.1.aarch64
软件
SPECCpu
2006
GCC
7.3.0
 
问题描述：升级GCC到7.3.0后连跑SPECCpu 2006报错libstdc++.so.6: cannot open
shared object file: No such file or directory。
鲲鹏通用
故障案例
7 SPECCpu 2006 连跑提示libstdc++.so.6 cannot open
shared object
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
14


--- 第 19 页 ---
关键过程、根本原因分析
编译的GCC 7.3.0在lib64目录下存在libstdc++.so.6库，但是SPECCpu却打印不存在，可
能是环境变量设置问题。
结论、解决方案及效果
步骤1 在“/etc/profile”中添加如下内容。
LD_LIBRARY_PATH环境变量主要用于指定查找共享库（动态链接库）时除了默认路径
之外的其他路径。（该路径在默认路径之前查找。）
1.
打开配置文件。
vi /etc/profile
2.
添加如下环境变量。
export LD_LIBRARY_PATH=/usr/local/gcc-7.3.0/lib64:$LD_LIBRARY_PATH
3.
使配置生效。
source /etc/profile
步骤2 重新执行测试。
----结束
鲲鹏通用
故障案例
7 SPECCpu 2006 连跑提示libstdc++.so.6 cannot open
shared object
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
15


--- 第 20 页 ---
8 鲲鹏服务器上编译netperf 工具时提示“无
法确认系统架构类型”的解决方法
问题现象描述
下载netperf源码，直接在鲲鹏服务器的Linux系统上执行configure命令会出现“无法
确认系统架构类型”的报错。
关键过程、根本原因分析
究其原因，在netperf源码文件的config.guess文件中会猜测系统的架构，而该文件中
通过uname -m命令获取系统架构名称，在鲲鹏服务器中，该命令会返回aarch64，而
在config.guess文件中列出的架构中，却没有该架构，只有ARM架构。
结论、解决方案及效果
解决方案1：
手动修改config.guess文件，将uname -m命令直接改为arm即可。
原文件内容如下：
修改为：
解决方案2：
新增加arm64v8类型，configure时候指定类型。
鲲鹏通用
故障案例
8 鲲鹏服务器上编译netperf 工具时提示“无法确认系
统架构类型”的解决方法
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
16


--- 第 21 页 ---
1.
修改配置文件“config.sub”。
vi config.sub
2.
查找“x86”内容的位置，在其位置后面增加“aarch64”类型。
在“case $basic_machine in”区域的两个位置修改。
原内容1：
| x86 | xscale | xscalee[bl] | xstormy16 | xtensa \
修改后为：
| x86 | aarch64 | xscale | xscalee[bl] | xstormy16 | xtensa \
原内容2：
| x86-* | x86_64-* | xps100-* | xscale-* | xstormy16-* \
修改后为：
| x86-* | aarch64-* | x86_64-* | xps100-* | xscale-* | xstormy16-* \
3.
指定host和build为aarch64，配置netperf生成Makefile。
./configure --host=aarch64 --build=aarch64
鲲鹏通用
故障案例
8 鲲鹏服务器上编译netperf 工具时提示“无法确认系
统架构类型”的解决方法
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
17


--- 第 22 页 ---
9 编译gfortran 提示Nonnegative width
required in format string at (1)的解决方法
问题现象描述
通过gfortran对Makefile执行make编译时报“Error: Nonnegative width required in
format string at (1)”错误，详细报错类似如下：
test_MyFile.f:1156:51:
     read( Test_OutputParamterVal(test_para, '(I)')
Error: Nonnegative width required in format string at (1)
关键过程、根本原因分析
因为需要对字符指定非负的位宽，未指定情况下使用gfortran编译会报错。
结论、解决方案及效果
步骤1 修改test_MyFile.f文件。
将read( Test_OutputParamterVal(test_para, '(I)')修改为
read( Test_OutputParamterVal(test_para, '(I5)')。
说明
对于动态位宽的字符（及定长位宽的字符）可以统一使用*替换，read和write都可以用*替换（*
不带括号和引号）。
例如：
原写法：READ(test1,'(I)')
替换后写法：READ(test1,*)
步骤2 执行make即可正常编译通过。
----结束
鲲鹏通用
故障案例
9 编译gfortran 提示Nonnegative width required in
format string at (1)的解决方法
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
18


--- 第 23 页 ---
10 编译libnice 时gst 插件的libgstnice 动
态库无法生成问题的解决方法
问题现象描述
环境配置：
类别
子项
版本
硬件
CPU
鲲鹏920处理器
网络
Ethernet-GE
存储
SATA 4T
内存
-
OS
Ubuntu
18.04
Kernel
-
软件
libnice
-
Gstreamer
1.5
 
问题描述：
编译libnice时，需要编译gst插件的libgstnice动态库，gstreamer 1.5已经编译完成，
但是编译libnice时没有生成libgstnice.so文件。
关键过程、根本原因分析
分析configure文件脚本逻辑，发现编译时只会根据1.0版本找gstreamer，如果找不到
则不编译gst插件动态库，因此可以通过修改configure文件解决该问题。
结论、解决方案及效果
libnice源码的编译对于gstreamer 1.5的支持存在问题，需要手动修改configure文件再
进行编译。
鲲鹏通用
故障案例
10 编译libnice 时gst 插件的libgstnice 动态库无法生
成问题的解决方法
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
19


--- 第 24 页 ---
1.
参考以下命令修改configure文件。
sed -i s/gstreamer-1.0/gstreamer-1.5/g configure
sed -i s/gstreamer-base-1.0/gstreamer-base-1.5/g configure
sed -i s/gstreamer-check-1.0/gstreamer-check-1.5/g configure
sed -i s/GST_MAJORMINOR=1.0/GST_MAJORMINOR=1.5/g configure
2.
重新执行configure进行后续编译，即可生成需要的libgstnice.so。
鲲鹏通用
故障案例
10 编译libnice 时gst 插件的libgstnice 动态库无法生
成问题的解决方法
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
20


--- 第 25 页 ---
11 CentOS 7.6 ARM 系统vmcore 文件无
法解析
问题现象描述
在CentOS 7.6系统 + RAID卡MR9560-8i环境中，内核crash生成的vmcore无法被正常
解析，提示报错“crash: seek error: kernel virtual address: ffffa03ff7740090 type:
"IRQ stack pointer" ”。
关键过程、根本原因分析
无。
结论、解决方案及效果
步骤1 获取kexec-tools rpm包。
cd /opt/
mkdir kexec-tools && cd kexec-tools/
wget https://archive.kernel.org/centos-vault/8.3.2011/BaseOS/aarch64/os/Packages/kexec-
tools-2.0.20-34.el8.aarch64.rpm
rpm2cpio kexec-tools-2.0.20-34.el8.aarch64.rpm | cpio -div
步骤2 替换makedumpfile。
cp /opt/kexec-tools/usr/sbin/makedumpfile /usr/sbin/makedumpfile
步骤3 删除原有kdump.img。
rm /boot/initramfs-4.14.0-115.el7a.0.1.aarch64kdump.img 
kdump.img的名字格式一般是initramfs+内核版本+kdump.img，具体操作根据实际情
况修改。
步骤4 重启kdump服务。
systemctl restart kdump
重启kdump服务之后会重新生成一个kdump.img。
步骤5 触发kdump。
echo c > /proc/sysrq-trigger
执行该命令后会自动重启，等待系统重启完成。
步骤6 安装crash工具。
鲲鹏通用
故障案例
11 CentOS 7.6 ARM 系统vmcore 文件无法解析
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
21


--- 第 26 页 ---
yum install crash kernel-debuginfo*-`uname -r`
步骤7 重新启动调试。
crash /usr/lib/debug/usr/lib/modules/4.14.0-115.el7a.0.1.aarch64/vmlinux /var/crash/127.0.0.1-xxxx/vmcore
xxx表示生成vmcore文件的时间。
----结束
鲲鹏通用
故障案例
11 CentOS 7.6 ARM 系统vmcore 文件无法解析
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
22


--- 第 27 页 ---
A 修订记录
发布日期
修订记录
2024-06-18
第一次正式发布。
鲲鹏通用
故障案例
A 修订记录
文档版本 01 (2024-06-18)
版权所有 © 华为技术有限公司
23
