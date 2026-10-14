import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const processes = [
  {
    name: "web",
    cwd: resolve(rootDirectory, "frontend"),
    args: [resolve(rootDirectory, "node_modules/vite/bin/vite.js")],
  },
  {
    name: "api",
    cwd: resolve(rootDirectory, "backend"),
    args: [resolve(rootDirectory, "node_modules/tsx/dist/cli.mjs"), "watch", "src/index.ts"],
  },
];

const children = processes.map(({ name, cwd, args }) => {
  const child = spawn(process.execPath, args, { cwd, stdio: "inherit" });
  child.on("error", (error) => {
    console.error(`[${name}] ${error.message}`);
    stopChildren(child);
  });
  child.on("exit", (code) => {
    if (childrenStopping) return;
    process.exitCode = code ?? 1;
    stopChildren(child);
  });
  return child;
});

let childrenStopping = false;

function stopChildren(exitedChild) {
  if (childrenStopping) return;
  childrenStopping = true;
  for (const child of children) {
    if (child !== exitedChild && child.exitCode === null) child.kill();
  }
}

process.on("SIGINT", () => stopChildren());
process.on("SIGTERM", () => stopChildren());