import { cpSync, existsSync, rmSync } from "fs";
import { resolve } from "path";

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

cpSync(dist, root, {
  recursive: true,
  force: true,
});

console.log("Built files copied from dist to the Apache-served root.");
