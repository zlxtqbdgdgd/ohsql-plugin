/**
 * captureRunner 单测——通过 _setSpawnImpl 注入 spawn mock，验证 ssh argv 拼接
 * 正确（端口、BatchMode、user@host、cmd）。不触真实 ssh 连接。
 *
 * 历史上用 vitest + vi.mock("node:child_process") 做模块级 mock;
 * 0.21.0 起改用 node:test + 模块级 spawn 注入点(_setSpawnImpl),不再依赖
 * vitest npm 包,统一与本仓 cli-ssh.test.ts 风格。
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable, Writable } from "node:stream";
import type { ChildProcess } from "node:child_process";

import { _setSpawnImpl, openRemoteSession, shellEscape } from "../src/captureRunner.js";

interface FakeChild extends EventEmitter {
  stdout: Readable;
  stderr: Readable;
  stdin: Writable;
  kill: (sig?: string) => void;
}

function makeFakeChild(opts: {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  exitDelayMs?: number;
} = {}): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = Readable.from([opts.stdout ?? ""]);
  child.stderr = Readable.from([opts.stderr ?? ""]);
  const writes: Buffer[] = [];
  child.stdin = new Writable({
    write(chunk, _enc, cb) {
      writes.push(Buffer.from(chunk));
      cb();
    },
  });
  child.kill = mock.fn();
  setTimeout(() => {
    child.emit("close", opts.exitCode ?? 0);
  }, opts.exitDelayMs ?? 0);
  return child;
}

describe("captureRunner.openRemoteSession", () => {
  // 每个 case 独立的 spawn mock,避免互相污染
  let spawnMock: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    spawnMock = mock.fn();
    _setSpawnImpl(spawnMock as unknown as typeof import("node:child_process").spawn);
  });
  afterEach(() => {
    _setSpawnImpl();
  });

  it("exec 拼接正确的 ssh argv（端口/BatchMode/target/cmd）", async () => {
    spawnMock.mock.mockImplementation(
      () => makeFakeChild({ stdout: "hello\n", exitCode: 0 }) as unknown as ChildProcess,
    );
    const sess = openRemoteSession({ host: "1.2.3.4", user: "root", port: 2222 });
    const res = await sess.exec("echo hello");
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout, "hello\n");

    assert.equal(spawnMock.mock.callCount(), 1);
    const [cmd, args] = spawnMock.mock.calls[0]!.arguments as [string, string[], unknown];
    assert.equal(cmd, "ssh");
    assert.ok(args.includes("-p"), "args should include -p");
    assert.ok(args.includes("2222"), "args should include port 2222");
    assert.ok(args.includes("-o"), "args should include -o");
    assert.ok(args.includes("BatchMode=yes"), "args should include BatchMode=yes");
    assert.ok(args.includes("root@1.2.3.4"), "args should include target");
    assert.equal(args[args.length - 1], "echo hello");
  });

  it("默认端口 22", async () => {
    spawnMock.mock.mockImplementation(
      () => makeFakeChild({ exitCode: 0 }) as unknown as ChildProcess,
    );
    const sess = openRemoteSession({ host: "h", user: "u" });
    await sess.exec("true");
    const args = spawnMock.mock.calls[0]!.arguments[1] as string[];
    const portIdx = args.indexOf("-p");
    assert.equal(args[portIdx + 1], "22");
  });

  it("privateKeyPath 通过 -i 传入", async () => {
    spawnMock.mock.mockImplementation(
      () => makeFakeChild({ exitCode: 0 }) as unknown as ChildProcess,
    );
    const sess = openRemoteSession({ host: "h", user: "u", privateKeyPath: "/tmp/id_rsa" });
    await sess.exec("true");
    const args = spawnMock.mock.calls[0]!.arguments[1] as string[];
    const iIdx = args.indexOf("-i");
    assert.ok(iIdx > -1, "-i flag should be present");
    assert.equal(args[iIdx + 1], "/tmp/id_rsa");
  });

  it("ssh exitCode=255 → err 字段被填充", async () => {
    spawnMock.mock.mockImplementation(
      () =>
        makeFakeChild({
          stderr: "ssh: connect to host: Connection refused\n",
          exitCode: 255,
        }) as unknown as ChildProcess,
    );
    const sess = openRemoteSession({ host: "h", user: "u" });
    const res = await sess.exec("true");
    assert.equal(res.exitCode, 255);
    assert.match(res.err ?? "", /SSH connection failed \(255\)/);
    assert.ok(res.err?.includes("Connection refused"), `err should mention Connection refused: ${res.err}`);
  });

  it("远端命令非零退出码 ≠ ssh 通道错误（无 err 字段）", async () => {
    spawnMock.mock.mockImplementation(
      () => makeFakeChild({ exitCode: 1 }) as unknown as ChildProcess,
    );
    const sess = openRemoteSession({ host: "h", user: "u" });
    const res = await sess.exec("false");
    assert.equal(res.exitCode, 1);
    assert.equal(res.err, undefined);
  });

  it("uploadFile 走 ssh + cat heredoc", async () => {
    spawnMock.mock.mockImplementation(
      () => makeFakeChild({ exitCode: 0 }) as unknown as ChildProcess,
    );
    const sess = openRemoteSession({ host: "h", user: "u" });
    await sess.uploadFile("/tmp/foo.txt", "hello world");
    assert.equal(spawnMock.mock.callCount(), 1);
    const [cmd, args] = spawnMock.mock.calls[0]!.arguments as [string, string[], unknown];
    assert.equal(cmd, "ssh");
    // 最后一个 argv 元素是远端命令
    const remoteCmd = args[args.length - 1]!;
    assert.match(remoteCmd, /^cat > /);
    assert.ok(remoteCmd.includes("/tmp/foo.txt"), `remote cmd should reference target: ${remoteCmd}`);
  });

  it("uploadFile 失败抛错（exitCode != 0）", async () => {
    spawnMock.mock.mockImplementation(
      () =>
        makeFakeChild({
          stderr: "Permission denied\n",
          exitCode: 1,
        }) as unknown as ChildProcess,
    );
    const sess = openRemoteSession({ host: "h", user: "u" });
    await assert.rejects(sess.uploadFile("/etc/passwd", "x"), /Permission denied/);
  });

  it("超时杀进程并返回 err", async () => {
    spawnMock.mock.mockImplementation(
      () => makeFakeChild({ exitCode: 0, exitDelayMs: 200 }) as unknown as ChildProcess,
    );
    const sess = openRemoteSession({ host: "h", user: "u" });
    const res = await sess.exec("sleep 5", { timeoutMs: 50 });
    assert.match(res.err ?? "", /timed out/);
  });
});

describe("shellEscape", () => {
  it("alphanumeric 不加引号", () => {
    assert.equal(shellEscape("mongod"), "mongod");
    assert.equal(shellEscape("/tmp/foo.txt"), "/tmp/foo.txt");
  });

  it("含空格加引号", () => {
    assert.equal(shellEscape("hello world"), "'hello world'");
  });

  it("含单引号要转义", () => {
    assert.equal(shellEscape("a'b"), "'a'\\''b'");
  });
});

