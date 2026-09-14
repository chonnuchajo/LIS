import assert from "node:assert/strict";
import test from "node:test";

import { createDevEnvironments, stopChildProcessTree } from "./dev-process-tree.mjs";

test("dev-all uses port 3002 by default so local service can keep port 3001", () => {
  const env = { PATH: "C:\\\\tools" };

  const result = createDevEnvironments(env);

  assert.equal(result.apiPort, "3002");
  assert.equal(result.serverEnv.PORT, "3002");
  assert.equal(result.frontendEnv.VITE_API_PROXY_TARGET, "http://localhost:3002");
  assert.equal(env.PORT, undefined);
});

test("dev-all respects explicit LIS_DEV_API_PORT", () => {
  const result = createDevEnvironments({ LIS_DEV_API_PORT: "3301" });

  assert.equal(result.apiPort, "3301");
  assert.equal(result.serverEnv.PORT, "3301");
  assert.equal(result.frontendEnv.VITE_API_PROXY_TARGET, "http://localhost:3301");
});

test("dev-all keeps explicit VITE_API_PROXY_TARGET", () => {
  const result = createDevEnvironments({
    LIS_DEV_API_PORT: "3301",
    VITE_API_PROXY_TARGET: "http://127.0.0.1:4500",
  });

  assert.equal(result.serverEnv.PORT, "3301");
  assert.equal(result.frontendEnv.VITE_API_PROXY_TARGET, "http://127.0.0.1:4500");
});

test("Windows shutdown terminates the whole spawned command tree", () => {
  const calls = [];
  const child = {
    pid: 1234,
    killed: false,
    kill: () => assert.fail("child.kill should not be used first on Windows"),
  };

  stopChildProcessTree(child, "SIGTERM", {
    platform: "win32",
    spawnSync: (...args) => {
      calls.push(args);
      return { status: 0 };
    },
  });

  assert.deepEqual(calls, [
    ["taskkill.exe", ["/pid", "1234", "/T", "/F"], { stdio: "ignore" }],
  ]);
});

test("POSIX shutdown targets the spawned process group", () => {
  const calls = [];

  stopChildProcessTree({ pid: 5678, killed: false }, "SIGINT", {
    platform: "linux",
    kill: (...args) => calls.push(args),
  });

  assert.deepEqual(calls, [[-5678, "SIGINT"]]);
});
