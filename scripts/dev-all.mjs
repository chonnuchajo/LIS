import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const defaultNpmCliPath = path.join(
  path.dirname(process.execPath),
  "node_modules",
  "npm",
  "bin",
  "npm-cli.js",
);
const npmCliPath = process.env.npm_execpath || defaultNpmCliPath;
const npmCommand = existsSync(npmCliPath) ? process.execPath : "npm";
const npmArgs = existsSync(npmCliPath) ? [npmCliPath] : [];

const commands = [
  {
    name: "server",
    command: npmCommand,
    args: [...npmArgs, "--prefix", "server", "run", "dev"],
  },
  {
    name: "frontend",
    command: npmCommand,
    args: [...npmArgs, "run", "dev:frontend"],
  },
];

const children = new Set();
let shuttingDown = false;

function prefixOutput(name, stream, chunk) {
  const lines = chunk.toString().split(/\r?\n/);
  for (const line of lines) {
    if (!line) continue;
    stream.write(`[${name}] ${line}\n`);
  }
}

function stopAll(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const { name, command, args } of commands) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  children.add(child);

  child.stdout.on("data", (chunk) => prefixOutput(name, process.stdout, chunk));
  child.stderr.on("data", (chunk) => prefixOutput(name, process.stderr, chunk));

  child.on("error", (error) => {
    console.error(`[${name}] failed to start: ${error.message}`);
    stopAll();
    process.exitCode = 1;
  });

  child.on("exit", (code, signal) => {
    children.delete(child);

    if (!shuttingDown) {
      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      console.error(`[${name}] stopped with ${reason}`);
      stopAll();
      process.exitCode = code ?? 1;
    }
  });
}

process.on("SIGINT", () => stopAll("SIGINT"));
process.on("SIGTERM", () => stopAll("SIGTERM"));
