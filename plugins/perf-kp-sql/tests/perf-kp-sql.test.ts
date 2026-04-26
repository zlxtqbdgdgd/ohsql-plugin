import { describe, expect, it } from "vitest";
import { __perfKpSqlCollectorTestables } from "../src/engines/mongo/collector.js";


describe("perf-kp-sql collector helpers", () => {
  it("extracts the trailing JSON object from noisy mongosh output", () => {
    const stdout = [
      "Using MongoDB: 7.0.0",
      "warning: some startup notice",
      '{"serverStatus":{"connections":{"current":12}},"currentOp":{"inprog":[]},"oplog":null,"blockCompressor":"snappy"}',
    ].join("\n");

    expect(__perfKpSqlCollectorTestables.extractJsonObject(stdout)).toBe(
      '{"serverStatus":{"connections":{"current":12}},"currentOp":{"inprog":[]},"oplog":null,"blockCompressor":"snappy"}',
    );
  });

  it("coerces common BSON/EJSON number wrappers", () => {
    const value = __perfKpSqlCollectorTestables.coerceEjsonNumbers({
      a: { $numberLong: "42" },
      b: { high: 1, low: 0, unsigned: false },
      c: [{ $numberInt: "7" }],
    }) as { a: number; b: number; c: number[] };

    expect(value).toEqual({
      a: 42,
      b: 4294967296,
      c: [7],
    });
  });

  it("shell-escapes host and port when building mongosh command", () => {
    const cmd = __perfKpSqlCollectorTestables.buildDbBatchCmd(
      "127.0.0.1; touch /tmp/pwned",
      "27017",
    );

    expect(cmd).toContain("--host '127.0.0.1; touch /tmp/pwned'");
    expect(cmd).toContain("--port '27017'");
  });
});
