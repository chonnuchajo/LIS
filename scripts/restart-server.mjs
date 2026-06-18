import { spawnSync } from "child_process";
import { existsSync, utimesSync, closeSync, openSync } from "fs";
import { resolve } from "path";

// Run AFTER the frontend build (deploy-dist-to-root.mjs). Re-imports the data
// into the server DB, then nudges nodemon so the running server restarts.
const serverDir = resolve(".", "server");

if (!existsSync(serverDir)) {
  throw new Error(`server directory not found at ${serverDir}`);
}

// 1) Run `npm run seed:import` inside ./server (equivalent to: cd server && npm run seed:import).
console.log("→ Running seed:import in", serverDir);
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCmd, ["run", "seed:import"], {
  cwd: serverDir,
  stdio: "inherit",
});

if (result.status !== 0) {
  throw new Error(`seed:import failed with exit code ${result.status}`);
}

// 2) Touch server/index.js so nodemon (watching .js files) detects a change and
// auto-restarts the running server. Updating mtime is enough — no content change.
const entry = resolve(serverDir, "index.js");
if (existsSync(entry)) {
  const now = new Date();
  utimesSync(entry, now, now);
  console.log("→ Touched server/index.js — nodemon will restart the server.");
} else {
  // No index.js to touch; create/touch a watched trigger file as a fallback.
  closeSync(openSync(resolve(serverDir, ".nodemon-restart"), "a"));
  console.log("→ index.js not found; touched .nodemon-restart instead.");
}

console.log("seed:import + server restart complete.");
