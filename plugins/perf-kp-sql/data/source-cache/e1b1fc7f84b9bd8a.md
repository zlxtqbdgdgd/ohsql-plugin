<!-- source URL cache · perf-kp-sql LLM-as-Judge (a3) input -->
<!-- url: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0006.html -->
<!-- url_final: https://www.hikunpeng.com/document/detail/zh/kunpengdbs/ecosystemEnable/MongoDB/kunpengdbstune_05_0007.html -->
<!-- fetched_at: 2026-05-03T18:10:58.622Z -->
<!-- html_bytes: 189110 · text_chars: 2028 -->
<!-- used_by_cases: 3 -->
文件系统调优-操作系统调优-调优指南-MongoDB-开源使能-鲲鹏BoostKit数据库场景开发文档-鲲鹏社区 

文件系统调优 目的通过调整文件系统相关参数配置，可以有效提升服务器性能。 方法 以XFS文件系统为例，解释文件系统调优步骤。 建议在文件系统的mount参数上加上noatime、nobarrier两个选项，其中数据盘以及数据目录以实际为准。 1mount -o noatime,nobarrier /dev/sdb /data 一般来说，Linux会给文件记录以下三个">

文件系统调优 目的通过调整文件系统相关参数配置，可以有效提升服务器性能。 方法 以XFS文件系统为例，解释文件系统调优步骤。 建议在文件系统的mount参数上加上noatime、nobarrier两个选项，其中数据盘以及数据目录以实际为准。 1mount -o noatime,nobarrier /dev/sdb /data 一般来说，Linux会给文件记录以下三个">

Kunpeng Home 

Developers 

主页 
开发 

文档 
活动 

学习 
论坛 
博客 
开发者计划 

More 

0 /100

support 
积分兑换 NEW 

BoostKit 

产品 

解决方案 

开发者与合作伙伴 

支持与服务 
More 

BoostKit 

硬件
鲲鹏处理器 
鲲鹏服务器主板及整机产品 
鲲鹏模组 
鲲鹏BMC 
通用服务器部件 

软件
多瑙套件 

行业解决方案
政府 
运营商 
金融 
电力 
制造 
交通 
互联网 

高性能计算解决方案 气象 
生命科学 
教育科研 
制造 
半导体 
油气 

通用解决方案
安全 
RAG 

用户案例 

开发者
从入门到进阶，开启鲲鹏开发者成长之旅
View Details 

合作伙伴
致力于帮助鲲鹏生态伙伴构建产业竞争力、联接客户创造商机
View Details 

教育科研
助力新一代科研工作者、教师、学生及高校创业者加速创新
View Details 

鲲鹏解决方案市场
一站式软硬件产品、解决方案、伙伴和专家技术服务的展示和互动平台
View Details 

技术支持
论坛求助 
技术工单 

自助服务
常见问题 
案例库 
文档 
鲲鹏论坛 

资讯
产品公告 

培训服务
鲲鹏工程师培训及认证 
鲲鹏工程师进阶培训及认证 
鲲鹏人才培养专家进阶服务 

专业服务
鲲鹏物理资源 

0 /100

Documentation 
在线开发 
资源 

Back to Top 

Rate This Document

Findability
Accuracy
Completeness
Readability

0 /200

Submit Close 

在线提单

论坛求助

文件系统调优

目的
通过调整文件系统相关参数配置，可以有效提升服务器性能。

方法
以XFS文件系统为例，解释文件系统调优步骤。

建议在文件系统的mount参数上加上noatime、nobarrier两个选项，其中数据盘以及数据目录以实际为准。

``` 1 ``` | ``` mount -o noatime,nobarrier /dev/sdb /data ```

一般来说，Linux会给文件记录以下三个时间： access time指文件最后一次被读取的时间。
modify time指的是文件的文本内容最后发生变化的时间。
change time指的是文件的inode最后发生变化（比如位置、用户属性、组属性等）的时间。

通常情况下，我们对文件的操作更多是读取而不是写入，而且我们很少需要关注一个文件最近被访问的时间。因此，我们建议使用noatime选项，这样文件系统在程序访问文件或文件夹时，不会更新对应的访问时间。文件系统不再记录访问时间，可以避免不必要的资源浪费。

许多文件系统在数据提交时会使用write barriers来强制刷新Cache，以避免数据丢失。但是，其实我们数据库服务器底层存储设备要么采用RAID控制卡，RAID控制卡本身的电池可以掉电保护；要么采用Flash卡，它也有自我保护机制，保证数据不会丢失。在这种情况下，我们可以安全地使用nobarrier挂载文件系统，以避免write barriers的性能损失。 对于ext3、ext4和reiserfs文件系统可以在mount时指定barrier=0。
对于XFS可以指定nobarrier选项。

openEuler不支持nobarrier选项。

父主题： 操作系统调优 

版权所有 © 2021-2026华为技术有限公司 保留一切权利 粤A2-20044005号 

法律声明 
隐私政策 
Cookie协议 
用户协议 
联系我们
