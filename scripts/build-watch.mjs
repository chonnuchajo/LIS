import { spawn } from "child_process";
import { watch, existsSync } from "fs";
import { resolve } from "path";

const root = resolve(".");
const watchedDirs = ["src"];
const watchedFiles = [
  "vite.config.ts",
  "tailwind.config.ts",
  "postcss.config.js",
];

let building = false;
let pending = false;
let debounceTimer = null;

function stamp() {
  return new Date().toLocaleTimeString();
}

function runBuild() {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  console.log(`\n[${stamp()}] 🔨 Building...`);
  const proc = spawn("npm", ["run", "build"], {
    stdio: "inherit",
    shell: true,
    cwd: root,
  });
  proc.on("close", (code) => {
    building = false;
    if (code === 0) {
      console.log(`[${stamp()}] ✅ Build done. Watching for changes...`);
    } else {
      console.log(`[${stamp()}] ❌ Build failed (exit ${code}). Waiting for next change...`);
    }
    if (pending) {
      pending = false;
      runBuild();
    }
  });
}

function scheduleBuild() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runBuild, 300);
}

for (const dir of watchedDirs) {
  const p = resolve(root, dir);
  if (!existsSync(p)) continue;
  watch(p, { recursive: true }, () => scheduleBuild());
}

for (const file of watchedFiles) {
  const p = resolve(root, file);
  if (!existsSync(p)) continue;
  watch(p, () => scheduleBuild());
}

console.log(`👀 Watching ${watchedDirs.join(", ")} and config files. Press Ctrl+C to stop.`);
runBuild();
