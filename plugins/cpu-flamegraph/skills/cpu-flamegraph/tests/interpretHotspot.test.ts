import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { interpretHotspot } from "../src/interpretHotspot.js";

describe("interpretHotspot", () => {
  it("识别 mongosh async 为客户端开销", () => {
    const text = interpretHotspot(
      "Builtins_AsyncFunctionAwaitResolveClosure",
      "mongosh",
      false,
    );
    assert.ok(text.includes("客户端异步开销"), text);
    assert.ok(text.includes("mongod 核心执行路径"), text);
  });

  it("off-cpu + futex → 锁等待", () => {
    const text = interpretHotspot("__futex_wait", "libpthread.so.0", true);
    assert.ok(text.includes("锁等待"), text);
  });

  it("off-cpu + epoll → IO 等待", () => {
    const text = interpretHotspot("epoll_wait", "libc.so.6", true);
    assert.ok(text.includes("IO"), text);
  });

  it("on-cpu + 引擎符号 → 引擎侧热点", () => {
    const text = interpretHotspot(
      "WiredTigerRecordStore::_insertRecords",
      "mongod",
      false,
    );
    assert.ok(text.includes("数据库引擎侧"), text);
  });

  it("on-cpu + idle 类符号 → 整机闲", () => {
    const text = interpretHotspot("default_idle_call", "[kernel.kallsyms]", false);
    assert.ok(text.includes("调度"), text);
  });

  it("空热点 (off-cpu)", () => {
    assert.ok(interpretHotspot(null, null, true).includes("等待热点"));
  });

  it("空热点 (on-cpu)", () => {
    assert.ok(interpretHotspot(null, null, false).includes("CPU 热点"));
  });
});
