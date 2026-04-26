import { describe, expect, it } from "vitest";
import { interpretHotspot } from "../src/interpretHotspot.js";

describe("interpretHotspot", () => {
  it("识别 mongosh async 为客户端开销", () => {
    const text = interpretHotspot(
      "Builtins_AsyncFunctionAwaitResolveClosure",
      "mongosh",
      false,
    );
    expect(text).toContain("客户端异步开销");
    expect(text).toContain("mongod 核心执行路径");
  });

  it("off-cpu + futex → 锁等待", () => {
    const text = interpretHotspot("__futex_wait", "libpthread.so.0", true);
    expect(text).toContain("锁等待");
  });

  it("off-cpu + epoll → IO 等待", () => {
    const text = interpretHotspot("epoll_wait", "libc.so.6", true);
    expect(text).toContain("IO");
  });

  it("on-cpu + 引擎符号 → 引擎侧热点", () => {
    const text = interpretHotspot(
      "WiredTigerRecordStore::_insertRecords",
      "mongod",
      false,
    );
    expect(text).toContain("数据库引擎侧");
  });

  it("on-cpu + idle 类符号 → 整机闲", () => {
    const text = interpretHotspot("default_idle_call", "[kernel.kallsyms]", false);
    expect(text).toContain("调度");
  });

  it("空热点 (off-cpu)", () => {
    expect(interpretHotspot(null, null, true)).toContain("等待热点");
  });

  it("空热点 (on-cpu)", () => {
    expect(interpretHotspot(null, null, false)).toContain("CPU 热点");
  });
});
