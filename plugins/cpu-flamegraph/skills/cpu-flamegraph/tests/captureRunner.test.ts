/**
 * captureRunner 单测——用 vi.mock 拦截 child_process.spawn，验证 ssh argv 拼接
 * 正确（端口、BatchMode、user@host、cmd）。不触真实 ssh 连接。
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { Readable, Writable } from "node:stream";

// vi.mock 必须在 import 被测代码前定义
const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (cmd: string, args: string[], opts: unknown) => spawnMock(cmd, args, opts),
}));

const { openRemoteSession, shellEscape } = await import("../src/captureRunner.js");

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
  child.kill = vi.fn();
  setTimeout(() => {
    child.emit("close", opts.exitCode ?? 0);
  }, opts.exitDelayMs ?? 0);
  return child;
}

describe("captureRunner.openRemoteSession", () => {
  beforeEach(() => spawnMock.mockReset());

  it("exec 拼接正确的 ssh argv（端口/BatchMode/target/cmd）", async () => {
    spawnMock.mockImplementation(() => makeFakeChild({ stdout: "hello\n", exitCode: 0 }));
    const sess = openRemoteSession({ host: "1.2.3.4", user: "root", port: 2222 });
    const res = await sess.exec("echo hello");
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe("hello\n");

    expect(spawnMock).toHaveBeenCalledOnce();
    const [cmd, args] = spawnMock.mock.calls[0]!;
    expect(cmd).toBe("ssh");
    expect(args).toContain("-p");
    expect(args).toContain("2222");
    expect(args).toContain("-o");
    expect(args).toContain("BatchMode=yes");
    expect(args).toContain("root@1.2.3.4");
    expect(args[args.length - 1]).toBe("echo hello");
  });

  it("默认端口 22", async () => {
    spawnMock.mockImplementation(() => makeFakeChild({ exitCode: 0 }));
    const sess = openRemoteSession({ host: "h", user: "u" });
    await sess.exec("true");
    const args: string[] = spawnMock.mock.calls[0]![1];
    const portIdx = args.indexOf("-p");
    expect(args[portIdx + 1]).toBe("22");
  });

  it("privateKeyPath 通过 -i 传入", async () => {
    spawnMock.mockImplementation(() => makeFakeChild({ exitCode: 0 }));
    const sess = openRemoteSession({ host: "h", user: "u", privateKeyPath: "/tmp/id_rsa" });
    await sess.exec("true");
    const args: string[] = spawnMock.mock.calls[0]![1];
    const iIdx = args.indexOf("-i");
    expect(iIdx).toBeGreaterThan(-1);
    expect(args[iIdx + 1]).toBe("/tmp/id_rsa");
  });

  it("ssh exitCode=255 → err 字段被填充", async () => {
    spawnMock.mockImplementation(() =>
      makeFakeChild({ stderr: "ssh: connect to host: Connection refused\n", exitCode: 255 }),
    );
    const sess = openRemoteSession({ host: "h", user: "u" });
    const res = await sess.exec("true");
    expect(res.exitCode).toBe(255);
    expect(res.err).toMatch(/SSH connection failed \(255\)/);
    expect(res.err).toContain("Connection refused");
  });

  it("远端命令非零退出码 ≠ ssh 通道错误（无 err 字段）", async () => {
    spawnMock.mockImplementation(() => makeFakeChild({ exitCode: 1 }));
    const sess = openRemoteSession({ host: "h", user: "u" });
    const res = await sess.exec("false");
    expect(res.exitCode).toBe(1);
    expect(res.err).toBeUndefined();
  });

  it("uploadFile 走 ssh + cat heredoc", async () => {
    spawnMock.mockImplementation(() => makeFakeChild({ exitCode: 0 }));
    const sess = openRemoteSession({ host: "h", user: "u" });
    await sess.uploadFile("/tmp/foo.txt", "hello world");
    expect(spawnMock).toHaveBeenCalledOnce();
    const [cmd, args] = spawnMock.mock.calls[0]!;
    expect(cmd).toBe("ssh");
    // 最后一个 argv 元素是远端命令
    const remoteCmd = args[args.length - 1];
    expect(remoteCmd).toMatch(/^cat > /);
    expect(remoteCmd).toContain("/tmp/foo.txt");
  });

  it("uploadFile 失败抛错（exitCode != 0）", async () => {
    spawnMock.mockImplementation(() =>
      makeFakeChild({ stderr: "Permission denied\n", exitCode: 1 }),
    );
    const sess = openRemoteSession({ host: "h", user: "u" });
    await expect(sess.uploadFile("/etc/passwd", "x")).rejects.toThrow(/Permission denied/);
  });

  it("超时杀进程并返回 err", async () => {
    spawnMock.mockImplementation(() =>
      makeFakeChild({ exitCode: 0, exitDelayMs: 200 }),
    );
    const sess = openRemoteSession({ host: "h", user: "u" });
    const res = await sess.exec("sleep 5", { timeoutMs: 50 });
    expect(res.err).toMatch(/timed out/);
  });
});

describe("shellEscape", () => {
  it("alphanumeric 不加引号", () => {
    expect(shellEscape("mongod")).toBe("mongod");
    expect(shellEscape("/tmp/foo.txt")).toBe("/tmp/foo.txt");
  });

  it("含空格加引号", () => {
    expect(shellEscape("hello world")).toBe("'hello world'");
  });

  it("含单引号要转义", () => {
    expect(shellEscape("a'b")).toBe("'a'\\''b'");
  });
});
