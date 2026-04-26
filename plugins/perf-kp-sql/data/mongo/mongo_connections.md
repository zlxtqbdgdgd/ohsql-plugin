---
authority: project_case
authority_level: ⭐⭐ 项目实战案例
last_verified: 2026-04-10
---

# MongoDB 连接池管理与 maxConns 调优

## 连接池工作原理

MongoDB 使用线程池模型处理客户端连接。每个连接占用约 1MB 内存（栈空间），连接数过多会导致：
- 内存压力：1000 连接 ≈ 1GB 额外内存开销
- 线程切换：OS 上下文切换开销随连接数线性增长
- 文件描述符耗尽：默认 ulimit -n 通常为 65536

## 关键参数

### maxIncomingConnections
控制 mongod 实例接受的最大并发连接数。

```yaml
# mongod.conf
net:
  maxIncomingConnections: 1000
```

### 驱动端连接池配置
```javascript
// Node.js 驱动
const client = new MongoClient(uri, {
  maxPoolSize: 100,      // 每个连接池最大连接数
  minPoolSize: 10,       // 最小保持连接数
  maxIdleTimeMS: 30000,  // 空闲连接超时
  waitQueueTimeoutMS: 5000  // 等待连接超时
});
```

## 连接风暴诊断

当 `db.serverStatus().connections.current` 持续超过 500 时：
1. 检查应用层是否存在连接泄漏（未正确关闭连接）
2. 检查是否使用了连接池（而非每次请求创建新连接）
3. 通过 `db.currentOp()` 查看活跃操作分布

## 最佳实践
- 生产环境建议 maxPoolSize=100，视并发量调整
- 开启连接复用，避免短连接风暴导致 TLS 握手锁竞争
- 监控 `connections.available` 确保有余量

## 参考来源
- MongoDB Connection Pool: https://www.mongodb.com/docs/manual/administration/connection-pool-overview/
- MongoDB maxIncomingConnections: https://www.mongodb.com/docs/manual/reference/configuration-options/#mongodb-setting-net.maxIncomingConnections
