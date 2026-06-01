import { cpSync, existsSync, rmSync, renameSync, writeFileSync } from "fs";
import { resolve } from "path";
import { devIndexHtml } from "./restore-index.mjs";

const root = resolve(".");
const dist = resolve(root, "dist");
const rootAssets = resolve(root, "assets");

if (!existsSync(dist)) {
  throw new Error("dist directory does not exist. Run vite build first.");
}

// Vite emits content-hashed filenames; old hashed files would otherwise
// accumulate alongside new ones on every build.
if (existsSync(rootAssets)) {
  rmSync(rootAssets, { recursive: true, force: true });
}

// Copy the build output into the Apache-served root (assets/, auth.html, and the
// built index.html). dist is gitignored, so this copy is what auto-sync commits
// and pushes to production.
cpSync(dist, root, {
  recursive: true,
  force: true,
});

// The built index.html references hashed assets and must NOT stay at index.html:
// that path is the Vite dev template, and auto-sync would otherwise toggle the
// served file between dev and prod state. Serve production from app.html instead
// (.htaccess DirectoryIndex + SPA fallback point here), and restore index.html
// back to the dev template so root/index.html is ALWAYS dev.
const builtIndex = resolve(root, "index.html");
const appHtml = resolve(root, "app.html");
if (existsSync(builtIndex)) {
  renameSync(builtIndex, appHtml);
}
writeFileSync(builtIndex, devIndexHtml, "utf8");

console.log("Built files copied: production entry → app.html, index.html kept as dev template.");
