import { cpSync, existsSync } from "fs";
import { resolve } from "path";

const root = resolve(".");
const dist = resolve(root, "dist");

if (!existsSync(dist)) {
  throw new Error("dist directory does not exist. Run vite build first.");
}

cpSync(dist, root, {
  recursive: true,
  force: true,
});

console.log("Built files copied from dist to the Apache-served root.");
