<!-- source URL cache · perf-kp-sql LLM-as-Judge (a3) input -->
<!-- url: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0037.html -->
<!-- url_final: https://www.hikunpeng.com/document/detail/zh/perftuning/tuningtip/kunpengtuning_12_0038.html -->
<!-- fetched_at: 2026-05-03T08:51:21.868Z -->
<!-- html_bytes: 102081 · text_chars: 1336 -->
<!-- used_by_cases: 1 -->
调整脏数据刷新策略，减小磁盘的I/O压力-优化方法-磁盘I/O子系统性能调优-鲲鹏性能优化十板斧-鲲鹏性能调优开发文档-鲲鹏社区 

调整脏数据刷新策略，减小磁盘的I/O压力 原理PageCache中需要回写到磁盘的数据为脏数据。在应用程序通知系统保存脏数据时，应用可以选择直接将数据写入磁盘（O_DIRECT），或者先写到PageCache（非O_DIRECT模式）。非O_DIRECT模式，对于缓存在PageCache中的数据的操作，都在内存中进行，减少了对磁盘的操作。 修改方式系统中提供了以下参">

调整脏数据刷新策略，减小磁盘的I/O压力 原理PageCache中需要回写到磁盘的数据为脏数据。在应用程序通知系统保存脏数据时，应用可以选择直接将数据写入磁盘（O_DIRECT），或者先写到PageCache（非O_DIRECT模式）。非O_DIRECT模式，对于缓存在PageCache中的数据的操作，都在内存中进行，减少了对磁盘的操作。 修改方式系统中提供了以下参">

主页 
开发

文档 
活动

学习

论坛 
博客

开发者计划

鲲鹏社区首页 
支持 
积分兑换 

开发场景
鲲鹏一码多芯、同辕开发

鲲鹏系统迁移

工具
鲲鹏开发套件DevKit

鲲鹏应用使能套件BoostKit

鲲鹏高性能计算

鲲鹏部件开发套件Data Acceleration Kit

开发资源
HiDevLab-在线开发

资源下载

兼容性查询

openFuyao

openGauss

openEuler

openUBMC

灵衢UnifiedBus

DFX能力共享

专区
开发板专区

活动 鲲鹏昇腾开发者大会2026
HOT 
鲲鹏开发者创享日

大赛
鲲鹏创新大赛2025

鲲鹏高性能计算全球挑战赛

直播 

学习 学习路径

在线课程

在线实验

人才认证

博客

官方技术文章

鲲鹏开发者计划

鲲鹏众智计划

鲲鹏MVP

鲲鹏KDE

鲲鹏校园大使

鲲鹏昇腾创新汇

开发者 

0 /100

BoostKit 

产品

解决方案

开发者与合作伙伴

支持与服务

文档 

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

合作伙伴
致力于帮助鲲鹏生态伙伴构建产业竞争力、联接客户创造商机

教育科研
助力新一代科研工作者、教师、学生及高校创业者加速创新

鲲鹏解决方案市场
一站式软硬件产品、解决方案、伙伴和专家技术服务的展示和互动平台

技术支持

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

文档

0 /100

返回顶部
