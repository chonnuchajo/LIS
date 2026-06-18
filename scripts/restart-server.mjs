import { existsSync, utimesSync, closeSync, openSync } from "fs";
import { resolve } from "path";

// Run AFTER the frontend build (deploy-dist-to-root.mjs). Nudges nodemon so the
// running server restarts to pick up the freshly deployed frontend.
// NOTE: seed:import is intentionally NOT run here — a build must never overwrite
// the live DB with committed seed-data. Restore from seed-data manually with
// `cd server && npm run seed:import` only when you actually mean to.
const serverDir = resolve(".", "server");

if (!existsSync(serverDir)) {
  throw new Error(`server directory not found at ${serverDir}`);
}

// Touch server/index.js so nodemon (watching .js files) detects a change and
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

console.log("server restart complete (no seed:import).");
