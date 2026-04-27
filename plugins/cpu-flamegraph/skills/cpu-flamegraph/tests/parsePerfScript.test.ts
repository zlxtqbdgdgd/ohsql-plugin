import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePerfScript, moduleFromDso } from "../src/parsePerfScript.js";

describe("parsePerfScript", () => {
  it("解析单个样本 + 多帧栈", () => {
    const text = [
      "mongod 911593/911593  12345.678901:    10000000 task-clock:",
      "    ffff8001a3f4b0c8 arch_cpu_idle+0x18 ([kernel.kallsyms])",
      "    aaaabb00c1234 mongo::FTDCController::doLoop+0x1 (/usr/bin/mongod)",
      "    ffff7f9a2b00 deflate+0x40 (/usr/lib64/libz.so.1.2.11)",
      "",
    ].join("\n");
    const samples = parsePerfScript(text);
    assert.equal(samples.length, 1);
    const s = samples[0]!;
    assert.equal(s.comm, "mongod");
    assert.equal(s.pid, 911593);
    assert.equal(s.tid, 911593);
    assert.equal(s.eventName, "task-clock");
    assert.equal(s.period, 10000000);
    assert.deepEqual(
      s.stack.map((f) => f.fn),
      // perf script 是 leaf-first，parser 反转为 root-first
      ["deflate", "mongo::FTDCController::doLoop", "arch_cpu_idle"],
    );
    assert.equal(s.stack[0]!.dso, "/usr/lib64/libz.so.1.2.11");
    assert.equal(s.stack[2]!.dso, "[kernel.kallsyms]");
  });

  it("空文本返回空数组", () => {
    assert.equal(parsePerfScript("").length, 0);
  });

  it("跳过 # 注释行", () => {
    const text = [
      "# this is a comment",
      "mongod 1/1  1.000000:    1 task-clock:",
      "    aaaa foo+0x0 (/bin/mongod)",
      "",
    ].join("\n");
    const samples = parsePerfScript(text);
    assert.equal(samples.length, 1);
    assert.equal(samples[0]!.stack[0]!.fn, "foo");
  });

  it("多个样本由空行分隔", () => {
    const text = [
      "mongod 1/1  1.0:    100 task-clock:",
      "    aa foo+0x0 (/bin/mongod)",
      "",
      "mongod 1/1  1.5:    200 task-clock:",
      "    bb bar+0x0 (/bin/mongod)",
      "",
    ].join("\n");
    const samples = parsePerfScript(text);
    assert.equal(samples.length, 2);
    assert.equal(samples[0]!.period, 100);
    assert.equal(samples[1]!.period, 200);
    assert.equal(samples[0]!.stack[0]!.fn, "foo");
    assert.equal(samples[1]!.stack[0]!.fn, "bar");
  });
});

describe("moduleFromDso", () => {
  it("方括号形式原样保留", () => {
    assert.equal(moduleFromDso("[kernel.kallsyms]"), "[kernel.kallsyms]");
    assert.equal(moduleFromDso("[vdso]"), "[vdso]");
  });

  it("用户态走 basename", () => {
    assert.equal(moduleFromDso("/usr/bin/mongod"), "mongod");
    assert.equal(moduleFromDso("/usr/lib64/libz.so.1.2.11"), "libz.so.1.2.11");
  });

  it("vmlinux 归到 kernel.kallsyms", () => {
    assert.equal(moduleFromDso("/boot/vmlinux-5.10.0"), "[kernel.kallsyms]");
  });

  it("空 / unknown 兜底", () => {
    assert.equal(moduleFromDso(""), "[unknown]");
    assert.equal(moduleFromDso("[unknown]"), "[unknown]");
  });
});
