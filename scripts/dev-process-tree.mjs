import { spawnSync } from "node:child_process";

const DEFAULT_DEV_API_PORT = "3001";

function envValue(value) {
  return value == null ? "" : String(value).trim();
}

export function createDevEnvironments(baseEnv = process.env) {
  const apiPort =
    envValue(baseEnv.LIS_DEV_API_PORT) || envValue(baseEnv.PORT) || DEFAULT_DEV_API_PORT;
  const apiProxyTarget = envValue(baseEnv.VITE_API_PROXY_TARGET) || `http://localhost:${apiPort}`;

  return {
    apiPort,
    apiProxyTarget,
    serverEnv: {
      ...baseEnv,
      PORT: apiPort,
    },
    frontendEnv: {
      ...baseEnv,
      VITE_API_PROXY_TARGET: apiProxyTarget,
    },
  };
}

function killChild(child, signal) {
  if (!child || child.killed || typeof child.kill !== "function") return;

  try {
    child.kill(signal);
  } catch {
  }
}

export function stopChildProcessTree(child, signal = "SIGTERM", options = {}) {
  if (!child?.pid) return false;

  const platform = options.platform ?? process.platform;

  if (platform === "win32") {
    const runSpawnSync = options.spawnSync ?? spawnSync;
    const result = runSpawnSync("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    if (result.error) {
      killChild(child, signal);
    }
    return true;
  }

  const kill = options.kill ?? process.kill;

  try {
    kill(-child.pid, signal);
  } catch {
    killChild(child, signal);
  }

  return true;
}
