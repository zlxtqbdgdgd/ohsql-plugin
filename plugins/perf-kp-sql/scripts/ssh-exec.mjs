#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath as __fileURLToPath } from "url";
import { dirname as __pathDirname } from "path";
const require = createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __pathDirname(__filename);

// skills/perf-kp-sql/src/cli-ssh-exec.ts
import { Client } from "ssh2";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";
function parseArgs(argv) {
  const kv = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a || !a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      kv[key] = next;
      i++;
    }
  }
  const host = kv.host;
  const user = kv.user;
  if (!host || !user) {
    die("\u5FC5\u987B\u63D0\u4F9B --host \u548C --user");
  }
  return {
    host,
    user,
    password: kv.password,
    privateKeyPath: kv.privateKeyPath ?? kv["private-key-path"],
    port: parseInt(kv.port ?? "22", 10) || 22,
    command: kv.command ?? "",
    timeout: parseInt(kv.timeout ?? "120000", 10) || 12e4,
    outputFile: kv.outputFile ?? kv["output-file"]
  };
}
function output(r) {
  process.stdout.write(JSON.stringify(r) + "\n");
  process.exit(r.err ? 1 : 0);
}
function die(msg) {
  output({ stdout: "", stderr: "", exitCode: null, err: msg });
}
var READY_TIMEOUT_MS = 6e4;
var RETRY_BACKOFFS = [0, 3e3, 6e3];
var TRANSIENT_PATTERNS = [
  /timed out while waiting for handshake/i,
  /all configured authentication methods failed/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /EPIPE/i
];
function isTransient(msg) {
  return TRANSIENT_PATTERNS.some((p) => p.test(msg));
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function loadPrivateKey(path) {
  const fs = await import("node:fs/promises");
  return fs.readFile(path);
}
async function connectOnce(args) {
  const client = new Client();
  await new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        client.end();
      } catch {
      }
      reject(new Error("SSH \u63E1\u624B\u8D85\u65F6"));
    }, READY_TIMEOUT_MS + 2e3);
    client.on("ready", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.removeListener("error", onError);
      resolve();
    });
    function onError(e) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        client.end();
      } catch {
      }
      client.on("error", () => {
      });
      reject(e);
    }
    client.on("error", onError);
    const cfg = {
      host: args.host,
      port: args.port,
      username: args.user,
      readyTimeout: READY_TIMEOUT_MS,
      keepaliveInterval: 1e4,
      keepaliveCountMax: 3
    };
    if (args.privateKeyPath) {
      loadPrivateKey(args.privateKeyPath).then((key) => {
        cfg.privateKey = key;
        cfg.authHandler = ["publickey"];
        client.connect(cfg);
      }).catch((e) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(e);
        }
      });
    } else if (args.password) {
      cfg.password = args.password;
      cfg.authHandler = ["password"];
      client.connect(cfg);
    } else {
      clearTimeout(timer);
      reject(new Error("\u5FC5\u987B\u63D0\u4F9B --password \u6216 --privateKeyPath"));
    }
  });
  return client;
}
async function connectWithRetry(args) {
  let lastErr = null;
  for (const delay of RETRY_BACKOFFS) {
    if (delay > 0) await sleep(delay);
    try {
      return await connectOnce(args);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!isTransient(msg)) throw e;
      lastErr = e instanceof Error ? e : new Error(msg);
    }
  }
  throw lastErr ?? new Error("SSH \u8FDE\u63A5\u5931\u8D25");
}
function execCommand(client, command, timeoutMs, outputFile) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let bytesWritten = 0;
    let settled = false;
    const finish = (r) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    let writeStream = null;
    let writeStreamErr = null;
    if (outputFile) {
      try {
        mkdirSync(dirname(outputFile), { recursive: true });
      } catch (e) {
        finish({
          stdout: "",
          stderr: "",
          exitCode: null,
          err: `\u521B\u5EFA\u76EE\u5F55\u5931\u8D25 ${dirname(outputFile)}: ${e instanceof Error ? e.message : String(e)}`
        });
        return;
      }
      writeStream = createWriteStream(outputFile);
      writeStream.on("error", (e) => {
        writeStreamErr = e;
      });
    }
    const timer = setTimeout(() => {
      try {
        if (writeStream) writeStream.destroy();
      } catch {
      }
      finish({ stdout, stderr, exitCode: null, err: "\u547D\u4EE4\u8D85\u65F6" });
      try {
        client.end();
      } catch {
      }
    }, timeoutMs);
    client.exec(command, (e, stream) => {
      if (e) {
        clearTimeout(timer);
        try {
          if (writeStream) writeStream.destroy();
        } catch {
        }
        finish({ stdout: "", stderr: "", exitCode: null, err: e.message });
        return;
      }
      try {
        stream.end();
      } catch {
      }
      stream.on("close", (code) => {
        clearTimeout(timer);
        const exitCode = typeof code === "number" ? code : null;
        if (writeStream) {
          writeStream.end(() => {
            if (writeStreamErr) {
              finish({
                stdout: "",
                stderr,
                exitCode,
                err: `\u5199\u76D8\u5931\u8D25 ${outputFile}: ${writeStreamErr.message}`
              });
              return;
            }
            finish({
              stdout: `<wrote ${bytesWritten} bytes to ${outputFile}>`,
              stderr,
              exitCode,
              bytesWritten,
              outputFile
            });
          });
        } else {
          finish({ stdout, stderr, exitCode });
        }
      }).on("data", (c) => {
        if (writeStream) {
          writeStream.write(c);
          bytesWritten += c.length;
        } else {
          stdout += c.toString("utf-8");
        }
      }).stderr.on("data", (c) => {
        stderr += c.toString("utf-8");
      });
    });
  });
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command) {
    die("\u5FC5\u987B\u63D0\u4F9B --command");
  }
  let client;
  try {
    client = await connectWithRetry(args);
  } catch (e) {
    die(e instanceof Error ? e.message : String(e));
  }
  try {
    const result = await execCommand(client, args.command, args.timeout, args.outputFile);
    output(result);
  } finally {
    try {
      client.end();
    } catch {
    }
  }
}
var isCli = (() => {
  try {
    const entry = process.argv[1] ?? "";
    return /(^|[\\/])ssh-exec\.(mjs|js|ts)$/.test(entry) || /cli-ssh-exec/.test(entry);
  } catch {
    return false;
  }
})();
if (isCli) {
  main().catch((err) => {
    die(err instanceof Error ? err.message : String(err));
  });
}
