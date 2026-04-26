import { describe, expect, it } from "vitest";
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
    expect(samples).toHaveLength(1);
    const s = samples[0]!;
    expect(s.comm).toBe("mongod");
    expect(s.pid).toBe(911593);
    expect(s.tid).toBe(911593);
    expect(s.eventName).toBe("task-clock");
    expect(s.period).toBe(10000000);
    expect(s.stack.map((f) => f.fn)).toEqual([
      // perf script 是 leaf-first，parser 反转为 root-first
      "deflate",
      "mongo::FTDCController::doLoop",
      "arch_cpu_idle",
    ]);
    expect(s.stack[0]!.dso).toBe("/usr/lib64/libz.so.1.2.11");
    expect(s.stack[2]!.dso).toBe("[kernel.kallsyms]");
  });

  it("空文本返回空数组", () => {
    expect(parsePerfScript("")).toHaveLength(0);
  });

  it("跳过 # 注释行", () => {
    const text = [
      "# this is a comment",
      "mongod 1/1  1.000000:    1 task-clock:",
      "    aaaa foo+0x0 (/bin/mongod)",
      "",
    ].join("\n");
    const samples = parsePerfScript(text);
    expect(samples).toHaveLength(1);
    expect(samples[0]!.stack[0]!.fn).toBe("foo");
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
    expect(samples).toHaveLength(2);
    expect(samples[0]!.period).toBe(100);
    expect(samples[1]!.period).toBe(200);
    expect(samples[0]!.stack[0]!.fn).toBe("foo");
    expect(samples[1]!.stack[0]!.fn).toBe("bar");
  });
});

describe("moduleFromDso", () => {
  it("方括号形式原样保留", () => {
    expect(moduleFromDso("[kernel.kallsyms]")).toBe("[kernel.kallsyms]");
    expect(moduleFromDso("[vdso]")).toBe("[vdso]");
  });

  it("用户态走 basename", () => {
    expect(moduleFromDso("/usr/bin/mongod")).toBe("mongod");
    expect(moduleFromDso("/usr/lib64/libz.so.1.2.11")).toBe("libz.so.1.2.11");
  });

  it("vmlinux 归到 kernel.kallsyms", () => {
    expect(moduleFromDso("/boot/vmlinux-5.10.0")).toBe("[kernel.kallsyms]");
  });

  it("空 / unknown 兜底", () => {
    expect(moduleFromDso("")).toBe("[unknown]");
    expect(moduleFromDso("[unknown]")).toBe("[unknown]");
  });
});
