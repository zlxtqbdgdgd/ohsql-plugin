# os-best-practice-tls-crypto

本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。

包含 1 条 case。

---

## mongod 启动时 libssl/libcrypto 符号版本警告 · 通常不影响 · 可用 objdump 核对

**case_id**: `tls-crypto-ssl-symbol-version-mismatch-warn-13`
**来源**: [https://www.mongodb.com/docs/manual/administration/production-notes/](https://www.mongodb.com/docs/manual/administration/production-notes/) (official)
**平台**: bare
**scope**: tls-crypto
**case_pattern**: parameter-best-practice

### 场景 (原文)
> On Linux platforms, you may observe one of the following statements in the MongoDB log:

### 场景 (中文转述)
Linux 系统中 mongod 启动时,日志出现 libssl / libcrypto 符号版本不匹配的告警。原因是 mongod 编译时绑定的 TLS/SSL 库版本与运行时系统提供的不一致。

### 推荐
- 值: ``用 objdump -T 核对 mongod 与系统库的符号版本是否兼容(忽略告警 / 或换库)``
- 层: other
- 原文:
  > you can use the following operations to determine the symbol versions that mongod expects:

### 检测方法
> "no version information available"
违规模式: "the system's TLS/SSL libraries are different from the TLS/SSL libraries that the mongod was compiled against"

### 机制 / 原因
> Typically these messages do not require intervention; however, you can use the following operations to determine the symbol versions that mongod expects
mongod 二进制的 SSL_* / CRYPTO_* 符号大多向后兼容,系统库小版本差异通常不影响功能,所以这条告警常态下「不需要干预」。但如果出现连接 TLS 失败 / SSL handshake 错,可以用 objdump 对比期待符号版本与系统库实际符号版本,定位是否需要替换库。这是「先观察、再确认、可不动手」的运维经验。

### 违反时的风险 (info)
> This procedure is neither exact nor exhaustive: many symbols used by mongod from the libcrypto library do not begin with CRYPTO_.
完全忽略告警通常没事(typically),但极少数情况下符号缺失会导致 TLS handshake 失败 / mongod 起不来。objdump 对比是手动比对,不是穷尽校验,需结合实际握手结果判定。

---
