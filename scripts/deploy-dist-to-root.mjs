import { cpSync, existsSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "fs";
import { resolve } from "path";
import { devIndexHtml } from "./restore-index.mjs";

const root = resolve(".");
const dist = resolve(root, "dist");

if (!existsSync(dist)) {
  throw new Error("dist directory does not exist. Run vite build first.");
}

// Stage and validate the complete build before touching the live files. The
// live root is only changed after every new file is ready, and is restored if
// any rename fails, so a failed deploy keeps the previous build serving.
const staging = mkdtempSync(resolve(root, ".deploy-staging-"));
const backup = mkdtempSync(resolve(root, ".deploy-backup-"));
const movedTargets = [];

try {
  cpSync(dist, staging, { recursive: true, force: true });

  const stagedIndex = resolve(staging, "index.html");
  const stagedApp = resolve(staging, "app.html");
  if (!existsSync(stagedIndex) || statSync(stagedIndex).size === 0) {
    throw new Error("Built index.html is missing or empty.");
  }
  renameSync(stagedIndex, stagedApp);

  const stagedEntries = readdirSync(staging);
  if (!stagedEntries.includes("assets") || !statSync(resolve(staging, "assets")).isDirectory()) {
    throw new Error("Built assets directory is missing.");
  }

  for (const entry of stagedEntries) {
    const target = resolve(root, entry);
    const stagedTarget = resolve(staging, entry);
    const backupTarget = resolve(backup, entry);
    if (existsSync(target)) renameSync(target, backupTarget);
    movedTargets.push({ target, backupTarget });
    renameSync(stagedTarget, target);
  }

  // index.html is always the Vite development template; production is app.html.
  writeFileSync(resolve(root, "index.html"), devIndexHtml, "utf8");
  rmSync(backup, { recursive: true, force: true });
  rmSync(staging, { recursive: true, force: true });
  console.log("Built files deployed atomically: production entry → app.html, index.html kept as dev template.");
} catch (error) {
  for (const { target, backupTarget } of movedTargets.reverse()) {
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    if (existsSync(backupTarget)) renameSync(backupTarget, target);
  }
  rmSync(staging, { recursive: true, force: true });
  rmSync(backup, { recursive: true, force: true });
  throw error;
}
