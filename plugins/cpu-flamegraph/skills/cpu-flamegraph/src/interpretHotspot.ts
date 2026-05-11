/**
 * 热点函数 → 一句话业务侧解读。
 *
 * 关键词归类：futex/mutex/cond → 锁等待；epoll/poll/io → IO 等待；
 * mongosh/async/await → 客户端异步开销；mongod/wiredtiger → 引擎侧；
 * sched/idle → 整机闲。
 *
 * 没匹配上时给一条兜底，但不再带任何"数据库"假设——本 skill 是通用 CPU
 * 火焰图工具，不绑数据库。
 */
export function interpretHotspot(
  name: string | null,
  module: string | null,
  isOffcpu: boolean,
): string {
  if (!name) {
    return isOffcpu
      ? "未识别到明确的等待热点，需结合业务高峰期再次采样"
      : "未识别到明确的 CPU 热点，需结合业务高峰期再次采样";
  }

  const lowerName = name.toLowerCase();
  const lowerModule = (module ?? "").toLowerCase();

  if (isOffcpu) {
    if (lowerName.includes("futex") || lowerName.includes("mutex") || lowerName.includes("cond")) {
      return "热点更像锁等待或线程同步等待，优先排查并发争用而不是 CPU 算力不足";
    }
    if (lowerName.includes("epoll") || lowerName.includes("poll") || lowerName.includes("io") || lowerModule.includes("io")) {
      return "热点更像 IO/事件等待，优先排查磁盘、网络或上游调用链路";
    }
    return "热点主要体现等待时间消耗，需结合调用链判断是锁、IO 还是网络等待";
  }

  if (lowerModule.includes("mongosh") || lowerName.includes("async") || lowerName.includes("await")) {
    return "热点更像采集侧或客户端异步开销，本次未见 mongod 核心执行路径成为主要 CPU 瓶颈";
  }
  if (lowerModule.includes("mongod") || lowerModule.includes("wiredtiger")) {
    return "热点已进入数据库引擎侧，建议结合慢查询、锁与缓存指标继续深挖";
  }
  if (lowerName.includes("sched") || lowerName.includes("idle")) {
    return "样本更多反映调度或空闲行为，不像稳定的业务热点，建议在负载更高时复查";
  }
  return "热点已定位到具体函数，可结合报告中的调用链和可视化产物继续判断业务含义";
}
