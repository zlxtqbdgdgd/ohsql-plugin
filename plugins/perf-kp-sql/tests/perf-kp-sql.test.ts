import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { __perfKpSqlCollectorTestables } from "../src/engines/mongo/collector.js";

describe("perf-kp-sql collector helpers", () => {
  it("extracts the trailing JSON object from noisy mongosh output", () => {
    const stdout = [
      "Using MongoDB: 7.0.0",
      "warning: some startup notice",
      '{"serverStatus":{"connections":{"current":12}},"currentOp":{"inprog":[]},"oplog":null,"blockCompressor":"snappy"}',
    ].join("\n");

    assert.equal(
      __perfKpSqlCollectorTestables.extractJsonObject(stdout),
      '{"serverStatus":{"connections":{"current":12}},"currentOp":{"inprog":[]},"oplog":null,"blockCompressor":"snappy"}',
    );
  });

  it("coerces common BSON/EJSON number wrappers", () => {
    const value = __perfKpSqlCollectorTestables.coerceEjsonNumbers({
      a: { $numberLong: "42" },
      b: { high: 1, low: 0, unsigned: false },
      c: [{ $numberInt: "7" }],
    }) as { a: number; b: number; c: number[] };

    assert.deepEqual(value, {
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

    assert.ok(
      cmd.includes("--host '127.0.0.1; touch /tmp/pwned'"),
      `cmd should contain shell-escaped host: ${cmd}`,
    );
    assert.ok(cmd.includes("--port '27017'"), `cmd should contain shell-escaped port: ${cmd}`);
  });
});
