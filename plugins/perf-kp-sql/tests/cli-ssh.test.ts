import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";

import { buildSshBaseArgs, controlPathFor } from "../src/cli-ssh.js";

describe("controlPathFor", () => {
  it("产出稳定的 socket 路径 · 同 (host, port, user) 多次调用同一字符串", () => {
    const a = controlPathFor("10.0.0.1", 22, "root");
    const b = controlPathFor("10.0.0.1", 22, "root");
    assert.equal(a, b);
  });

  it("不同 (host, port, user) 落入不同 hash", () => {
    const a = controlPathFor("10.0.0.1", 22, "root");
    const b = controlPathFor("10.0.0.1", 22, "ec2-user");
    const c = controlPathFor("10.0.0.1", 2222, "root");
    const d = controlPathFor("10.0.0.2", 22, "root");
    assert.notEqual(a, b);
    assert.notEqual(a, c);
    assert.notEqual(a, d);
  });

  it("路径在 tmpdir 内 · 长度 < 108 字节(UNIX socket 上限)", () => {
    const p = controlPathFor("very-long-hostname.example.com", 65535, "some-user");
    assert.ok(p.startsWith(tmpdir()));
    assert.ok(p.endsWith(".sock"));
    assert.ok(p.length < 108, `controlPath 长度 ${p.length} 超过 UNIX socket 上限 108`);
  });
});

describe("buildSshBaseArgs", () => {
  const ctlPath = "/tmp/perf-kp-sql-cm-abc123def456.sock";

  it("key 模式 · BatchMode=yes + privateKeyPath", () => {
    const args = buildSshBaseArgs({
      port: 22,
      controlPath: ctlPath,
      usePassword: false,
      privateKeyPath: "/home/me/.ssh/id_ed25519",
    });
    // BatchMode=yes 出现
    const idx = args.indexOf("BatchMode=yes");
    assert.ok(idx > 0, "key 模式必须含 BatchMode=yes");
    assert.equal(args[idx - 1], "-o");
    // -i privateKeyPath
    const iIdx = args.indexOf("-i");
    assert.ok(iIdx > 0);
    assert.equal(args[iIdx + 1], "/home/me/.ssh/id_ed25519");
    // 不应包含密码模式独有的 PubkeyAuthentication=no
    assert.ok(!args.includes("PubkeyAuthentication=no"), "key 模式不应禁 pubkey");
  });

  it("password 模式 · 禁 pubkey + 不开 BatchMode + PreferredAuthentications=password,...", () => {
    const args = buildSshBaseArgs({
      port: 2222,
      controlPath: ctlPath,
      usePassword: true,
    });
    assert.ok(args.includes("PreferredAuthentications=password,keyboard-interactive"));
    assert.ok(args.includes("PubkeyAuthentication=no"));
    assert.ok(args.includes("NumberOfPasswordPrompts=1"));
    // BatchMode=yes 会禁 password prompt → askpass 不触发 · 必须不出现
    assert.ok(!args.includes("BatchMode=yes"), "password 模式不应开 BatchMode=yes");
    // password 模式没传 privateKeyPath → 不应出现 -i
    assert.ok(!args.includes("-i"));
  });

  it("ControlMaster 三件套始终在", () => {
    const args = buildSshBaseArgs({
      port: 22,
      controlPath: ctlPath,
      usePassword: false,
    });
    assert.ok(args.includes("ControlMaster=auto"));
    assert.ok(args.includes(`ControlPath=${ctlPath}`));
    assert.ok(args.some((a) => a.startsWith("ControlPersist=")));
  });

  it("port 透传 · ConnectTimeout / ServerAliveInterval 默认开", () => {
    const args = buildSshBaseArgs({
      port: 2200,
      controlPath: ctlPath,
      usePassword: false,
    });
    const pIdx = args.indexOf("-p");
    assert.equal(args[pIdx + 1], "2200");
    assert.ok(args.some((a) => a.startsWith("ConnectTimeout=")));
    assert.ok(args.some((a) => a.startsWith("ServerAliveInterval=")));
    // 远端命令在 5min 探活间隔后还能连上
    assert.ok(args.includes("StrictHostKeyChecking=accept-new"));
  });
});
